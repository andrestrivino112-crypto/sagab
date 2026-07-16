package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.LocalDate;

@Entity
@Table(name = "asistencia")
@Getter @Setter
public class Asistencia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_asistencia")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_estudiante")
    private Estudiante estudiante;

    @Column(name = "id_paralelo", nullable = false)
    private Integer idParalelo;

    @Column(nullable = false)
    private LocalDate fecha = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "estado_asistencia")
    private EstadoAsistencia estado = EstadoAsistencia.PRESENTE;

    @Column(length = 300)
    private String justificacion;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;

    public enum EstadoAsistencia { PRESENTE, AUSENCIA_JUSTIFICADA, AUSENCIA_INJUSTIFICADA, ATRASO }
}
