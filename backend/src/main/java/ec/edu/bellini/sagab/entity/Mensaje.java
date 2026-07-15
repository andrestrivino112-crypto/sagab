package ec.edu.bellini.sagab.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mensaje")
@Getter @Setter
public class Mensaje {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_mensaje")
    private Long id;

    @Column(name = "id_remitente", nullable = false)
    private Long idRemitente;

    @Column(nullable = false, length = 150)
    private String asunto;

    @Column(nullable = false, columnDefinition = "text")
    private String cuerpo;

    @Column(name = "es_circular", nullable = false)
    private boolean esCircular = false;

    @Column(name = "enviado_en", nullable = false)
    private OffsetDateTime enviadoEn = OffsetDateTime.now();
}
