package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.OffsetDateTime;

@Entity
@Table(name = "mensaje_destinatario")
@IdClass(MensajeDestinatario.Pk.class)
@Getter @Setter
public class MensajeDestinatario {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_mensaje")
    private Mensaje mensaje;

    @Id
    @Column(name = "id_destinatario")
    private Long idDestinatario;

    @Column(name = "leido_en")
    private OffsetDateTime leidoEn;

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private Long mensaje;
        private Long idDestinatario;
    }
}
