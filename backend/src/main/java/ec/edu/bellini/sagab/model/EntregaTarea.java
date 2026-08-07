package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entrega de un deber. Nace en PENDIENTE (creada en lote al publicar la Tarea, una por cada
 * estudiante activo del paralelo); pasa a ENTREGADO cuando se sube el archivo, y a REVISADO
 * cuando el docente la evalúa.
 */
@Entity
@Table(name = "entrega_tarea")
@Getter @Setter
public class EntregaTarea {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_entrega")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_tarea")
    private Tarea tarea;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_estudiante")
    private Estudiante estudiante;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "estado_entrega")
    private EstadoEntrega estado = EstadoEntrega.PENDIENTE;

    // "archivo_url" guarda la CLAVE del objeto en el bucket S3, no una URL pública navegable
    // — la descarga siempre pasa por un endpoint que verifica permisos y firma una URL temporal.
    @Column(name = "archivo_url")
    private String archivoUrl;

    @Column(name = "archivo_nombre_original")
    private String archivoNombreOriginal;

    @Column(name = "archivo_mime_type")
    private String archivoMimeType;

    @Column(name = "archivo_tamano_bytes")
    private Long archivoTamanoBytes;

    @Column(name = "fecha_entrega")
    private OffsetDateTime fechaEntrega;

    @Column(name = "observacion_docente", length = 500)
    private String observacionDocente;

    /** Calificación numérica opcional de la entrega — una entrega puede quedar REVISADO solo con observación. */
    @Column(precision = 4, scale = 2)
    private BigDecimal nota;

    @Column(name = "revisado_por")
    private Long revisadoPor;

    @Column(name = "fecha_revision")
    private OffsetDateTime fechaRevision;

    public enum EstadoEntrega { PENDIENTE, ENTREGADO, REVISADO }
}
