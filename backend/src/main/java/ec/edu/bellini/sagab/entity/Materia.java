package ec.edu.bellini.sagab.entity;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(name = "materia")
@Getter
public class Materia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_materia")
    private Integer id;

    @Column(nullable = false, unique = true, length = 15)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nombre;

    @Column(length = 60)
    private String area;
}
