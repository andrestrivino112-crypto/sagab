package ec.edu.bellini.sagab.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Datos de menores de edad — protegidos por la LOPDP (Ecuador).
 * El acceso se restringe por rol; los representantes solo ven a sus representados.
 */
@Entity
@Table(name = "estudiante")
@Getter @Setter
public class Estudiante {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_estudiante")
    private Long id;

    @Column(nullable = false, unique = true, length = 15)
    private String codigo;

    @Column(length = 10, unique = true)
    private String cedula;

    @Column(nullable = false, length = 80)
    private String nombres;

    @Column(nullable = false, length = 80)
    private String apellidos;

    @Column(name = "fecha_nacimiento", nullable = false)
    private LocalDate fechaNacimiento;

    /** 'M', 'F' u 'O' — ver CHECK de la BD. */
    @Column(length = 1)
    private String genero;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_paralelo")
    private Paralelo paralelo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_representante")
    private Representante representante;

    /** Cuenta de acceso del estudiante (Portal Familiar), creada automáticamente al matricularlo. */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario")
    private Usuario usuario;

    @Column(length = 15)
    private String telefono;

    @Column(name = "tipo_sangre", length = 5)
    private String tipoSangre;

    @Column(name = "condicion_medica", length = 500)
    private String condicionMedica;

    @Column(name = "institucion_procedencia", length = 150)
    private String institucionProcedencia;

    @Column(name = "contacto_emergencia", length = 150)
    private String contactoEmergencia;

    /** Ids de documentos entregados, separados por coma (p. ej. "cedula_est,partida"). */
    @Column(name = "documentos_entregados")
    private String documentosEntregados;

    @Column(nullable = false)
    private boolean activo = true;

    public String nombreCompleto() { return apellidos + " " + nombres; }
}
