package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "seguimiento_dece")
@Getter @Setter
public class SeguimientoDece {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_seguimiento")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_estudiante", nullable = false, unique = true)
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "registrado_por", nullable = false)
    private Usuario registradoPor;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoSeguimiento estado = EstadoSeguimiento.ACTIVO;

    @Column(length = 2000)
    private String observacion;

    @Column(nullable = false)
    private boolean eliminado;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public enum EstadoSeguimiento { ACTIVO, EN_OBSERVACION, INTERVENCION, RESUELTO, ARCHIVADO }
}
