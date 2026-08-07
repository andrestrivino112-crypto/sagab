package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tarea")
@Getter @Setter
public class Tarea {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_tarea")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_asignacion")
    private AsignacionDocente asignacion;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(length = 1000)
    private String descripcion;

    @Column(name = "fecha_limite", nullable = false)
    private OffsetDateTime fechaLimite;

    @Column(nullable = false)
    private short parcial;

    /** Puntaje máximo del deber (independiente de la nota 1-10 de cada entrega). */
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal puntaje = new BigDecimal("10.00");

    @Column(name = "creado_por", nullable = false)
    private Long creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;
}
