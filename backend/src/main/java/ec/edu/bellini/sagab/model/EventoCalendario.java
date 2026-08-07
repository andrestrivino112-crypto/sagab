package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "evento_calendario")
@Getter @Setter
public class EventoCalendario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_evento")
    private Long id;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(length = 2000)
    private String descripcion;

    @Column(nullable = false)
    private OffsetDateTime inicio;

    @Column(nullable = false)
    private OffsetDateTime fin;

    @Column(length = 180)
    private String lugar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Categoria categoria;

    @Column(nullable = false, length = 7)
    private String color = "#2E75B6";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Estado estado = Estado.BORRADOR;

    @Column(name = "publicar_en")
    private OffsetDateTime publicarEn;

    @Column(name = "adjunto_nombre")
    private String adjuntoNombre;

    @Column(name = "adjunto_url", length = 500)
    private String adjuntoUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creado_por")
    private Usuario creador;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public enum Categoria { INSTITUCIONAL, ACADEMICO, REUNION, CAPACITACION, EVALUACION, DEPORTIVO, CULTURAL, OTRO }
    public enum Estado { BORRADOR, PUBLICADO, OCULTO, PROGRAMADO, CANCELADO }
}
