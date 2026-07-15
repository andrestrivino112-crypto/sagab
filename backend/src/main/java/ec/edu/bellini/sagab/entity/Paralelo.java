package ec.edu.bellini.sagab.entity;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(name = "paralelo")
@Getter
public class Paralelo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_paralelo")
    private Integer id;

    @Column(nullable = false, length = 30)
    private String nivel;

    @Column(nullable = false, length = 1)
    private String seccion;

    @Column(name = "anio_lectivo", nullable = false, length = 9)
    private String anioLectivo;

    public String etiqueta() { return nivel + " " + seccion; }
}
