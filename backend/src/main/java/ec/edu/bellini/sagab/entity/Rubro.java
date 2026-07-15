package ec.edu.bellini.sagab.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.math.BigDecimal;

@Entity
@Table(name = "rubro")
@Getter @Setter
public class Rubro {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rubro")
    private Integer id;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "tipo_rubro")
    private TipoRubro tipo;

    @Column(nullable = false, length = 80)
    private String nombre;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal valor;

    @Column(name = "anio_lectivo", nullable = false, length = 9)
    private String anioLectivo;

    public enum TipoRubro { MATRICULA, PENSION, EXTRACURRICULAR, OTRO }
}
