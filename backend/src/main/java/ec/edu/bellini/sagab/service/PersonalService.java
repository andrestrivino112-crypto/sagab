package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.PersonalDtos;
import ec.edu.bellini.sagab.model.Docente;
import ec.edu.bellini.sagab.model.Rol;
import ec.edu.bellini.sagab.model.Usuario;
import ec.edu.bellini.sagab.repository.DocenteRepository;
import ec.edu.bellini.sagab.repository.RolRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import ec.edu.bellini.sagab.utils.CedulaEcuatoriana;
import ec.edu.bellini.sagab.utils.UsernameGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Alta de cuentas de personal (no familia) por un ADMIN: DOCENTE, DECE, AUDITOR — mismo mecanismo
 * de cuenta que MatriculaService usa para el representante (username generado, contraseña
 * temporal aleatoria devuelta una sola vez, debe_cambiar_clave=true). ADMIN/REPRESENTANTE/
 * ESTUDIANTE quedan fuera a propósito: tienen sus propios flujos (matrícula) o son demasiado
 * sensibles para un alta genérica sin controles adicionales.
 */
@Service
public class PersonalService {

    private static final List<String> ROLES_PERSONAL = List.of("DOCENTE", "DECE", "AUDITOR");
    private static final String ALFABETO_CLAVE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private final SecureRandom random = new SecureRandom();

    private final UsuarioRepository usuarios;
    private final RolRepository roles;
    private final DocenteRepository docentes;
    private final PasswordEncoder encoder;

    public PersonalService(UsuarioRepository usuarios, RolRepository roles, DocenteRepository docentes,
                           PasswordEncoder encoder) {
        this.usuarios = usuarios;
        this.roles = roles;
        this.docentes = docentes;
        this.encoder = encoder;
    }

    @Transactional
    public PersonalDtos.PersonalResponse crear(PersonalDtos.CrearPersonalRequest req) {
        if (!ROLES_PERSONAL.contains(req.rol())) {
            throw new IllegalArgumentException("rol debe ser DOCENTE, DECE o AUDITOR");
        }
        if (!CedulaEcuatoriana.esValida(req.cedula())) {
            throw new IllegalArgumentException("Cédula inválida");
        }
        String email = req.email().toLowerCase().trim();
        if (usuarios.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Ya existe un usuario con ese correo");
        }
        if (usuarios.existsByCedula(req.cedula())) {
            throw new IllegalArgumentException("Ya existe un usuario con esa cédula");
        }
        Rol rol = roles.findByCodigo(req.rol())
                .orElseThrow(() -> new IllegalStateException("Falta el rol " + req.rol() + " en la base de datos"));

        Usuario u = new Usuario();
        u.setEmail(email);
        u.setUsername(UsernameGenerator.generar(req.nombres(), req.apellidos(),
                x -> usuarios.findByUsername(x).isPresent()));
        u.setNombres(req.nombres().trim());
        u.setApellidos(req.apellidos().trim());
        u.setCedula(req.cedula());
        u.setTelefono(req.telefono());
        String claveTemporal = generarClaveTemporal();
        u.setHashPassword(encoder.encode(claveTemporal));
        u.setDebeCambiarClave(true);
        Set<Rol> rolesNuevos = new HashSet<>();
        rolesNuevos.add(rol);
        u.setRoles(rolesNuevos);
        u = usuarios.save(u);

        if ("DOCENTE".equals(req.rol())) {
            Docente d = new Docente();
            d.setUsuario(u);
            d.setTitulo(req.tituloDocente());
            d.setFechaIngreso(LocalDate.now());
            docentes.save(d);
        }

        return new PersonalDtos.PersonalResponse(u.getId(), u.nombreCompleto(), u.getUsername(), u.getEmail(),
                req.rol(), claveTemporal);
    }

    @Transactional(readOnly = true)
    public List<PersonalDtos.PersonalResumen> listar() {
        return usuarios.findByRoles_CodigoInOrderByApellidosAscNombresAsc(ROLES_PERSONAL).stream()
                .map(u -> new PersonalDtos.PersonalResumen(
                        u.getId(), u.nombreCompleto(), u.getUsername(), u.getEmail(),
                        u.getRoles().stream().map(Rol::getCodigo).filter(ROLES_PERSONAL::contains).findFirst().orElse("—"),
                        u.getEstado().name()))
                .toList();
    }

    private String generarClaveTemporal() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(ALFABETO_CLAVE.charAt(random.nextInt(ALFABETO_CLAVE.length())));
        }
        return sb.toString();
    }
}
