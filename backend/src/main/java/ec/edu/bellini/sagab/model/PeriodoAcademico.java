package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDate;

@Entity
@Table(name = "periodo_academico")
@Getter
public class PeriodoAcademico {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_periodo")
    private Integer id;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(name = "anio_lectivo", nullable = false, length = 9)
    private String anioLectivo;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin", nullable = false)
    private LocalDate fechaFin;

    @Column(nullable = false)
    private boolean activo;

    public String etiqueta() { return nombre + " · " + anioLectivo; }
}
