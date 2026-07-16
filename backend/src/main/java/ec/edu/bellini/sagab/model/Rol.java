package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(name = "rol")
@Getter
public class Rol {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rol")
    private Short id;

    @Column(nullable = false, unique = true, length = 30)
    private String codigo;   // ADMIN, DOCENTE, REPRESENTANTE, AUDITOR, DECE

    @Column(nullable = false, length = 60)
    private String nombre;
}
