package ec.edu.bellini.sagab.finanzas;

import ec.edu.bellini.sagab.entity.ObligacionPago;
import ec.edu.bellini.sagab.entity.Pago;
import ec.edu.bellini.sagab.estudiante.EstudianteService;
import ec.edu.bellini.sagab.repository.ObligacionPagoRepository;
import ec.edu.bellini.sagab.repository.PagoRepository;
import ec.edu.bellini.sagab.repository.UsuarioRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;

@Service
public class FinanzasService {

    private final ObligacionPagoRepository obligaciones;
    private final PagoRepository pagos;
    private final UsuarioRepository usuarios;
    private final EstudianteService estudianteService;
    private final SecureRandom random = new SecureRandom();

    public FinanzasService(ObligacionPagoRepository obligaciones, PagoRepository pagos,
                           UsuarioRepository usuarios, EstudianteService estudianteService) {
        this.obligaciones = obligaciones;
        this.pagos = pagos;
        this.usuarios = usuarios;
        this.estudianteService = estudianteService;
    }

    @Transactional(readOnly = true)
    public List<FinanzasDtos.ObligacionResponse> porEstudiante(Long idEstudiante, Authentication auth) {
        if (!estudianteService.esPropio(idEstudiante, auth)) {
            throw new AccessDeniedException("No autorizado para consultar este estudiante");
        }
        return obligaciones.findByEstudianteIdOrderByFechaVencimientoDesc(idEstudiante).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FinanzasDtos.ObligacionResponse registrarPago(FinanzasDtos.PagoRequest req, Authentication auth) {
        Long idUsuario = usuarios.findByEmail(auth.getName()).orElseThrow().getId();
        ObligacionPago obligacion = obligaciones.findById(req.idObligacion())
                .orElseThrow(() -> new IllegalArgumentException("La obligación de pago no existe"));

        Pago pago = new Pago();
        pago.setObligacion(obligacion);
        pago.setValorPagado(req.valorPagado());
        pago.setMetodo(req.metodo() != null && !req.metodo().isBlank() ? req.metodo() : "EFECTIVO");
        pago.setNumeroRecibo(generarNumeroRecibo());
        pago.setRegistradoPor(idUsuario);
        pagos.save(pago);

        BigDecimal totalPagado = pagos.findByObligacionIdOrderByFechaPagoDesc(obligacion.getId()).stream()
                .map(Pago::getValorPagado)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalPagado.compareTo(obligacion.getValor()) >= 0) {
            obligacion.setEstado(ObligacionPago.EstadoPago.PAGADO);
            obligaciones.save(obligacion);
        }

        return toResponse(obligacion);
    }

    private FinanzasDtos.ObligacionResponse toResponse(ObligacionPago o) {
        Pago ultimoPago = pagos.findByObligacionIdOrderByFechaPagoDesc(o.getId()).stream().findFirst().orElse(null);
        FinanzasDtos.PagoResponse pagoResponse = ultimoPago == null ? null : new FinanzasDtos.PagoResponse(
                ultimoPago.getId(), ultimoPago.getValorPagado(), ultimoPago.getMetodo(),
                ultimoPago.getNumeroRecibo(), ultimoPago.getFechaPago());
        return new FinanzasDtos.ObligacionResponse(
                o.getId(), o.getRubro().getNombre(), o.getRubro().getTipo().name(),
                o.getMes(), o.getValor(), o.getFechaVencimiento(), o.getEstado().name(),
                pagoResponse);
    }

    private String generarNumeroRecibo() {
        StringBuilder sb = new StringBuilder("REC-");
        for (int i = 0; i < 10; i++) sb.append(random.nextInt(10));
        return sb.toString();
    }
}
