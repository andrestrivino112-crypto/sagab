package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.MatriculaDtos;
import ec.edu.bellini.sagab.utils.CedulaEcuatoriana;
import ec.edu.bellini.sagab.utils.UsernameGenerator;

import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.model.Representante;
import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.RepresentanteRepository;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.List;

/**
 * Alta de matrícula (RF de admisión): crea al estudiante y su cuenta de acceso
 * (rol ESTUDIANTE, clave inicial = cédula cifrada con BCrypt) y, si el correo
 * del representante no existe todavía, también la cuenta de este (rol
 * REPRESENTANTE, clave inicial basada en la cédula y nunca devuelta). Nunca otorga un rol nuevo a una cuenta
 * ajena existente — si el correo pertenece a otro usuario sin rol
 * REPRESENTANTE, se rechaza explícitamente (evita escalamiento de privilegios
 * silencioso).
 */
@Service
public class MatriculaService {

    private static final List<String> DOCUMENTOS_REQUERIDOS =
            List.of("cedula_est", "partida", "foto", "conducta");
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
        Set<String> documentosEntregados = req.documentos() == null
                ? Set.of()
                : new HashSet<>(req.documentos());
        if (req.documentos() == null
                || req.documentos().size() != DOCUMENTOS_REQUERIDOS.size()
                || !documentosEntregados.equals(new HashSet<>(DOCUMENTOS_REQUERIDOS))) {
            throw new IllegalArgumentException(
                    "No se puede matricular al estudiante sin todos los documentos requeridos");
        }
        if (!CedulaEcuatoriana.esValida(req.estudianteCedula())) {
            throw new IllegalArgumentException("Cédula del estudiante inválida");
        }
        if (!CedulaEcuatoriana.esValida(req.representanteCedula())) {
            throw new IllegalArgumentException("Cédula del representante inválida");
        }
        if (req.estudianteCedula().equals(req.representanteCedula())) {
            throw new IllegalArgumentException("La cédula del estudiante y la del representante no pueden ser iguales");
        }
        if (estudiantes.existsByCedula(req.estudianteCedula())) {
            throw new IllegalArgumentException("Ya existe un estudiante matriculado con esa cédula");
        }
        if (usuarios.existsByCedula(req.estudianteCedula())) {
            throw new IllegalArgumentException("Ya existe un usuario con la cédula del estudiante");
        }

        String tipoSangre = normalizarTipoSangre(req.tipoSangre());

        Paralelo paralelo = paralelos.findByNivelAndSeccionAndAnioLectivo(req.nivel(), req.seccion(), req.anioLectivo())
                .orElseThrow(() -> new IllegalArgumentException("El paralelo seleccionado no existe"));

        String emailRep = req.representanteEmail().toLowerCase().trim();
        Rol rolRepresentante = roles.findByCodigo("REPRESENTANTE")
                .orElseThrow(() -> new IllegalStateException("Falta el rol REPRESENTANTE en la base de datos"));
        Rol rolEstudiante = roles.findByCodigo("ESTUDIANTE")
                .orElseThrow(() -> new IllegalStateException("Falta el rol ESTUDIANTE en la base de datos"));

        boolean representanteNuevo = false;
        Usuario usuarioRep = usuarios.findByEmail(emailRep).orElse(null);

        if (usuarioRep == null) {
            if (usuarios.existsByCedula(req.representanteCedula())) {
                throw new IllegalArgumentException("Ya existe un usuario con la cédula del representante");
            }
            usuarioRep = new Usuario();
            usuarioRep.setEmail(emailRep);
            usuarioRep.setUsername(UsernameGenerator.generar(
                    req.representanteNombres(), req.representanteApellidos(),
                    u -> usuarios.findByUsername(u).isPresent()));
            usuarioRep.setNombres(req.representanteNombres().trim());
            usuarioRep.setApellidos(req.representanteApellidos().trim());
            usuarioRep.setCedula(req.representanteCedula());
            usuarioRep.setTelefono(req.representanteTelefono());
            usuarioRep.setHashPassword(encoder.encode(req.representanteCedula()));
            usuarioRep.setDebeCambiarClave(true);
            Set<Rol> rolesNuevos = new HashSet<>();
            rolesNuevos.add(rolRepresentante);
            usuarioRep.setRoles(rolesNuevos);
            usuarioRep = usuarios.save(usuarioRep);
            representanteNuevo = true;
        } else {
            if (!req.representanteCedula().equals(usuarioRep.getCedula())) {
                throw new IllegalArgumentException(
                        "El correo del representante ya existe, pero no corresponde a la cédula enviada");
            }
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
                u -> usuarios.findByUsername(u).isPresent()
                        || usuarios.existsByEmail(u + "@estudiante.bellini.edu.ec"));

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
        est.setTipoSangre(tipoSangre);
        est.setCondicionMedica(req.condicionMedica());
        est.setInstitucionProcedencia(req.institucionProcedencia());
        est.setContactoEmergencia(req.contactoEmergencia());
        est.setDocumentosEntregados(String.join(",", DOCUMENTOS_REQUERIDOS));
        est.setActivo(true);
        est = estudiantes.save(est);

        return new MatriculaDtos.MatriculaResponse(est.getId(), est.getCodigo(), usernameEstudiante,
                representanteNuevo, usuarioRep.getUsername());
    }

    private String normalizarTipoSangre(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String limpio = valor.trim().toUpperCase();
        if (!List.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-").contains(limpio)) {
            throw new IllegalArgumentException("El tipo de sangre debe ser un tipo real o quedar vacío");
        }
        return limpio;
    }
}
