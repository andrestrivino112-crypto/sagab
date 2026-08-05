package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "pago")
@Getter @Setter
public class Pago {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pago")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_obligacion")
    private ObligacionPago obligacion;

    @Column(name = "valor_pagado", nullable = false, precision = 8, scale = 2)
    private BigDecimal valorPagado;

    @Column(nullable = false, length = 30)
    private String metodo = "EFECTIVO";

    @Column(name = "numero_recibo", nullable = false, unique = true, length = 20)
    private String numeroRecibo;

    @Column(name = "recibo_url", length = 255)
    private String reciboUrl;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;

    @Column(name = "fecha_pago", nullable = false)
    private OffsetDateTime fechaPago = OffsetDateTime.now();

    // ── Pago por transferencia con comprobante ──────────────────────────
    @Column(name = "banco_origen", length = 60)
    private String bancoOrigen;

    @Column(name = "numero_referencia", length = 50)
    private String numeroReferencia;

    @Column(length = 150)
    private String asunto;

    /** Guarda la CLAVE del objeto en el bucket S3, no una URL pública navegable. */
    @Column(name = "comprobante_url", length = 500)
    private String comprobanteUrl;

    @Column(name = "comprobante_nombre_original")
    private String comprobanteNombreOriginal;

    @Column(name = "comprobante_mime_type")
    private String comprobanteMimeType;

    @Column(name = "comprobante_tamano_bytes")
    private Long comprobanteTamanoBytes;

    @Column(name = "comprobante_hash", length = 64)
    private String comprobanteHash;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "estado_revision", nullable = false, columnDefinition = "estado_revision_pago")
    private EstadoRevision estadoRevision = EstadoRevision.APROBADO;

    @Column(name = "revisado_por")
    private Long revisadoPor;

    @Column(name = "fecha_revision")
    private OffsetDateTime fechaRevision;

    @Column(name = "observaciones_admin", length = 500)
    private String observacionesAdmin;

    public enum EstadoRevision { EN_REVISION, APROBADO, RECHAZADO }
}
