package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Notificación en la aplicación para el destinatario (estudiante o representante).
 * Hoy solo se generan por calificación baja (&lt; 7); el modelo es genérico a propósito
 * para poder reutilizarse desde otros módulos (faltas, pagos) sin cambiar el esquema.
 */
@Entity
@Table(name = "notificacion")
@Getter @Setter
public class Notificacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_notificacion")
    private Long id;

    @Column(name = "id_destinatario", nullable = false)
    private Long idDestinatario;

    @Column(name = "id_calificacion")
    private Long idCalificacion;

    @Column(nullable = false, length = 100)
    private String materia;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal calificacion;

    @Column(nullable = false, length = 500)
    private String mensaje;

    @Column(name = "leido_en")
    private OffsetDateTime leidoEn;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;
}
