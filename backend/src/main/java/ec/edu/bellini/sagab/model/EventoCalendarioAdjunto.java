package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Archivo privado de un evento institucional, almacenado en el bucket S3 de SAGAB. */
@Entity
@Table(name = "evento_calendario_adjunto")
@Getter @Setter
public class EventoCalendarioAdjunto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_adjunto")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_evento")
    private EventoCalendario evento;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(name = "archivo_url", nullable = false, length = 500)
    private String archivoUrl;

    @Column(name = "archivo_nombre_original", nullable = false)
    private String archivoNombreOriginal;

    @Column(name = "archivo_mime_type", nullable = false, length = 100)
    private String archivoMimeType;

    @Column(name = "archivo_tamano_bytes", nullable = false)
    private Long archivoTamanoBytes;

    @Column(name = "creado_por", nullable = false)
    private Long creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;
}
