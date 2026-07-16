package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Calificación por parcial. El promedio es una columna GENERADA en PostgreSQL
 * (tarea 20% + clase 20% + examen 60%), por eso es de solo lectura aquí.
 * Toda modificación queda registrada por trigger en auditoria.registro_cambio.
 */
@Entity
@Table(name = "calificacion")
@Getter @Setter
public class Calificacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_calificacion")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_estudiante")
    private Estudiante estudiante;

    @Column(name = "id_asignacion", nullable = false)
    private Long idAsignacion;

    @Column(nullable = false)
    private short parcial;

    @Column(name = "nota_tarea", precision = 4, scale = 2)
    private BigDecimal notaTarea;

    @Column(name = "nota_clase", precision = 4, scale = 2)
    private BigDecimal notaClase;

    @Column(name = "nota_examen", precision = 4, scale = 2)
    private BigDecimal notaExamen;

    @Column(insertable = false, updatable = false, precision = 4, scale = 2)
    private BigDecimal promedio;

    @Column(length = 250)
    private String observacion;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;
}
