package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "seguimiento_dece_historial")
@Getter @Setter
public class SeguimientoDeceHistorial {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_historial")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_seguimiento", nullable = false)
    private SeguimientoDece seguimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_anterior", length = 30)
    private SeguimientoDece.EstadoSeguimiento estadoAnterior;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_nuevo", nullable = false, length = 30)
    private SeguimientoDece.EstadoSeguimiento estadoNuevo;

    @Column(length = 2000)
    private String observacion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cambiado_por", nullable = false)
    private Usuario cambiadoPor;

    @Column(name = "cambiado_en", insertable = false, updatable = false)
    private OffsetDateTime cambiadoEn;
}
