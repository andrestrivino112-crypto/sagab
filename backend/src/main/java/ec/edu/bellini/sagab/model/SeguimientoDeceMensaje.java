package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "seguimiento_dece_mensaje")
@Getter @Setter
public class SeguimientoDeceMensaje {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_seguimiento_mensaje")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_seguimiento", nullable = false)
    private SeguimientoDece seguimiento;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_mensaje", nullable = false, unique = true)
    private Mensaje mensaje;

    @Column(name = "id_destinatario", nullable = false)
    private Long idDestinatario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enviado_por", nullable = false)
    private Usuario enviadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;
}
