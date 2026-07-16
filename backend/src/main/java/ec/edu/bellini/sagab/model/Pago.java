package ec.edu.bellini.sagab.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "pago")
@Getter @Setter
public class Pago {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pago")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_obligacion")
    private ObligacionPago obligacion;

    @Column(name = "valor_pagado", nullable = false, precision = 8, scale = 2)
    private BigDecimal valorPagado;

    @Column(nullable = false, length = 30)
    private String metodo = "EFECTIVO";

    @Column(name = "numero_recibo", nullable = false, unique = true, length = 20)
    private String numeroRecibo;

    @Column(name = "recibo_url", length = 255)
    private String reciboUrl;

    @Column(name = "registrado_por", nullable = false)
    private Long registradoPor;

    @Column(name = "fecha_pago", nullable = false)
    private OffsetDateTime fechaPago = OffsetDateTime.now();
}
