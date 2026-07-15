package ec.edu.bellini.sagab.matricula;

import ec.edu.bellini.sagab.entity.Estudiante;
import ec.edu.bellini.sagab.entity.Paralelo;
import ec.edu.bellini.sagab.entity.Representante;
import ec.edu.bellini.sagab.entity.Rol;
import ec.edu.bellini.sagab.entity.Usuario;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.RepresentanteRepository;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;

/**
 * Alta de matrícula (RF de admisión): crea al estudiante y su cuenta de acceso
 * (rol ESTUDIANTE, clave inicial = cédula cifrada con BCrypt) y, si el correo
 * del representante no existe todavía, también la cuenta de este (rol
 * REPRESENTANTE, contraseña temporal). Nunca otorga un rol nuevo a una cuenta
 * ajena existente — si el correo pertenece a otro usuario sin rol
 * REPRESENTANTE, se rechaza explícitamente (evita escalamiento de privilegios
 * silencioso).
 */
@Service
public class MatriculaService {

    private static final String ALFABETO_CLAVE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private final SecureRandom random = new SecureRandom();

    private final EstudianteRepository estudiantes;
    private final RepresentanteRepository representantes;
    private final UsuarioRepository usuarios;
    private final RolRepository roles;
    private final ParaleloRepository paralelos;
    private final PasswordEncoder encoder;

    public MatriculaService(EstudianteRepository estudiantes, RepresentanteRepository representantes,
                            UsuarioRepository usuarios, RolRepository roles, ParaleloRepository paralelos,
                            PasswordEncoder encoder) {
        this.estudiantes = estudiantes;
        this.representantes = representantes;
        this.usuarios = usuarios;
        this.roles = roles;
        this.paralelos = paralelos;
        this.encoder = encoder;
    }

    @Transactional
    public MatriculaDtos.MatriculaResponse crear(MatriculaDtos.MatriculaRequest req) {
        if (!esCedulaEcuatorianaValida(req.estudianteCedula())) {
            throw new IllegalArgumentException("Cédula del estudiante inválida");
        }
        if (!esCedulaEcuatorianaValida(req.representanteCedula())) {
            throw new IllegalArgumentException("Cédula del representante inválida");
        }
        if (req.estudianteCedula().equals(req.representanteCedula())) {
            throw new IllegalArgumentException("La cédula del estudiante y la del representante no pueden ser iguales");
        }
        if (estudiantes.existsByCedula(req.estudianteCedula())) {
            throw new IllegalArgumentException("Ya existe un estudiante matriculado con esa cédula");
        }

        Paralelo paralelo = paralelos.findByNivelAndSeccionAndAnioLectivo(req.nivel(), req.seccion(), req.anioLectivo())
                .orElseThrow(() -> new IllegalArgumentException("El paralelo seleccionado no existe"));

        String emailRep = req.representanteEmail().toLowerCase().trim();
        Rol rolRepresentante = roles.findByCodigo("REPRESENTANTE")
                .orElseThrow(() -> new IllegalStateException("Falta el rol REPRESENTANTE en la base de datos"));
        Rol rolEstudiante = roles.findByCodigo("ESTUDIANTE")
                .orElseThrow(() -> new IllegalStateException("Falta el rol ESTUDIANTE en la base de datos"));

        boolean representanteNuevo = false;
        String claveTemporal = null;
        Usuario usuarioRep = usuarios.findByEmail(emailRep).orElse(null);

        if (usuarioRep == null) {
            usuarioRep = new Usuario();
            usuarioRep.setEmail(emailRep);
            usuarioRep.setUsername(UsernameGenerator.generar(
                    req.representanteNombres(), req.representanteApellidos(),
                    u -> usuarios.findByUsername(u).isPresent()));
            usuarioRep.setNombres(req.representanteNombres().trim());
            usuarioRep.setApellidos(req.representanteApellidos().trim());
            usuarioRep.setCedula(req.representanteCedula());
            usuarioRep.setTelefono(req.representanteTelefono());
            claveTemporal = generarClaveTemporal();
            usuarioRep.setHashPassword(encoder.encode(claveTemporal));
            usuarioRep.setDebeCambiarClave(true);
            Set<Rol> rolesNuevos = new HashSet<>();
            rolesNuevos.add(rolRepresentante);
            usuarioRep.setRoles(rolesNuevos);
            usuarioRep = usuarios.save(usuarioRep);
            representanteNuevo = true;
        } else {
            boolean tieneRolRepresentante = usuarioRep.getRoles() != null &&
                    usuarioRep.getRoles().stream().anyMatch(r -> "REPRESENTANTE".equals(r.getCodigo()));
            if (!tieneRolRepresentante) {
                throw new IllegalArgumentException(
                        "El correo del representante ya pertenece a otro usuario del sistema con un rol distinto");
            }
            if (usuarioRep.getUsername() == null) {
                // Cuentas creadas antes de esta corrección se completan al vuelo (nunca podían iniciar sesión).
                usuarioRep.setUsername(UsernameGenerator.generar(
                        usuarioRep.getNombres(), usuarioRep.getApellidos(),
                        u -> usuarios.findByUsername(u).isPresent()));
                usuarioRep = usuarios.save(usuarioRep);
            }
        }

        final Long idUsuarioRep = usuarioRep.getId();
        Representante representante = representantes.findByUsuarioId(idUsuarioRep).orElseGet(() -> {
            Representante r = new Representante();
            r.setUsuario(usuarios.getReferenceById(idUsuarioRep));
            r.setParentesco(req.parentesco());
            r.setDireccion(req.direccion());
            return representantes.save(r);
        });

        // Cuenta de acceso del estudiante (Portal Familiar): usuario = primerNombre.primerApellido,
        // clave inicial = cédula cifrada con BCrypt, forzando el cambio en el primer ingreso.
        String usernameEstudiante = UsernameGenerator.generar(
                req.estudianteNombres(), req.estudianteApellidos(),
                u -> usuarios.findByUsername(u).isPresent());

        Usuario usuarioEst = new Usuario();
        usuarioEst.setUsername(usernameEstudiante);
        usuarioEst.setEmail(usernameEstudiante + "@estudiante.bellini.edu.ec");
        usuarioEst.setNombres(req.estudianteNombres().trim());
        usuarioEst.setApellidos(req.estudianteApellidos().trim());
        usuarioEst.setCedula(req.estudianteCedula());
        usuarioEst.setTelefono(req.telefonoEstudiante());
        usuarioEst.setHashPassword(encoder.encode(req.estudianteCedula()));
        usuarioEst.setDebeCambiarClave(true);
        Set<Rol> rolesEstudiante = new HashSet<>();
        rolesEstudiante.add(rolEstudiante);
        usuarioEst.setRoles(rolesEstudiante);
        usuarioEst = usuarios.save(usuarioEst);

        String codigo = "EST-" + String.format("%04d", estudiantes.siguienteCodigoSecuencial());

        Estudiante est = new Estudiante();
        est.setCodigo(codigo);
        est.setCedula(req.estudianteCedula());
        est.setNombres(req.estudianteNombres().trim());
        est.setApellidos(req.estudianteApellidos().trim());
        est.setFechaNacimiento(req.fechaNacimiento());
        est.setGenero(req.genero());
        est.setParalelo(paralelo);
        est.setRepresentante(representante);
        est.setUsuario(usuarioEst);
        est.setTelefono(req.telefonoEstudiante());
        est.setTipoSangre(req.tipoSangre());
        est.setCondicionMedica(req.condicionMedica());
        est.setInstitucionProcedencia(req.institucionProcedencia());
        est.setContactoEmergencia(req.contactoEmergencia());
        est.setDocumentosEntregados(req.documentos() == null ? null : String.join(",", req.documentos()));
        est.setActivo(true);
        est = estudiantes.save(est);

        return new MatriculaDtos.MatriculaResponse(est.getId(), est.getCodigo(), usernameEstudiante,
                representanteNuevo, usuarioRep.getUsername(), claveTemporal);
    }

    private String generarClaveTemporal() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(ALFABETO_CLAVE.charAt(random.nextInt(ALFABETO_CLAVE.length())));
        }
        return sb.toString();
    }

    /** Algoritmo módulo 10 de cédula ecuatoriana — mismo cálculo que valida el frontend. */
    private boolean esCedulaEcuatorianaValida(String cedula) {
        if (cedula == null || !cedula.matches("\\d{10}")) return false;
        int provincia = Integer.parseInt(cedula.substring(0, 2));
        if (provincia < 1 || provincia > 24) return false;
        int[] d = cedula.chars().map(c -> c - '0').toArray();
        if (d[2] > 6) return false;
        int[] coef = {2, 1, 2, 1, 2, 1, 2, 1, 2};
        int suma = 0;
        for (int i = 0; i < 9; i++) {
            int v = d[i] * coef[i];
            if (v >= 10) v -= 9;
            suma += v;
        }
        int verificador = (10 - (suma % 10)) % 10;
        return verificador == d[9];
    }
}
