package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.OffsetDateTime;

/**
 * Sílabo, formatos de presentación o link de clase virtual de una asignación. SILABO/FORMATO
 * guardan un archivo en S3 (archivo_url = clave del objeto, nunca una URL pública);
 * LINK_CLASE guarda una URL externa. Nunca ambos a la vez (CHECK en la base de datos).
 */
@Entity
@Table(name = "recurso_academico")
@Getter @Setter
public class RecursoAcademico {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recurso")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_asignacion")
    private AsignacionDocente asignacion;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "tipo_recurso_academico")
    private TipoRecurso tipo;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(name = "archivo_url", length = 500)
    private String archivoUrl;

    @Column(name = "archivo_nombre_original")
    private String archivoNombreOriginal;

    @Column(name = "archivo_mime_type")
    private String archivoMimeType;

    @Column(name = "archivo_tamano_bytes")
    private Long archivoTamanoBytes;

    @Column(name = "url_externa", length = 500)
    private String urlExterna;

    /** Solo aplica a MATERIAL — organiza el repositorio de la materia por semana (Semana 1, 2…). */
    private Short semana;

    @Column(length = 500)
    private String descripcion;

    @Column(name = "creado_por", nullable = false)
    private Long creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    public enum TipoRecurso { SILABO, FORMATO, LINK_CLASE, MATERIAL }
}
