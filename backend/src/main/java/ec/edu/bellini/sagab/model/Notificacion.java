package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Notificación en la aplicación para el destinatario (estudiante o representante).
 * Modelo genérico: además de las alertas automáticas por calificación baja (&lt; 7),
 * se reutiliza desde otros módulos (pagos, mensajes) a través de {@link TipoNotificacion}
 * — ver NotificacionService.crearGenerica().
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

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "tipo_notificacion")
    private TipoNotificacion tipo = TipoNotificacion.CALIFICACION;

    /** Solo aplica cuando {@code tipo == CALIFICACION}; null en el resto de casos. */
    @Column(length = 100)
    private String materia;

    /** Solo aplica cuando {@code tipo == CALIFICACION}; null en el resto de casos. */
    @Column(precision = 4, scale = 2)
    private BigDecimal calificacion;

    @Column(nullable = false, length = 500)
    private String mensaje;

    @Column(name = "leido_en")
    private OffsetDateTime leidoEn;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    public enum TipoNotificacion { CALIFICACION, PAGO, MENSAJE, SISTEMA }
}
