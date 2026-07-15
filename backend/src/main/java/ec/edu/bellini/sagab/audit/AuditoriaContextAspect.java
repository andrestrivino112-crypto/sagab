package ec.edu.bellini.sagab.audit;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Propaga la identidad del usuario de la aplicación hacia PostgreSQL
 * mediante SET LOCAL (set_config con is_local = true), de modo que los
 * triggers de auditoria.fn_auditar() registren QUIÉN hizo cada cambio.
 *
 * Se ejecuta DENTRO de la transacción (Order = LOWEST_PRECEDENCE hace que
 * este aspecto corra después del interceptor @Transactional).
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class AuditoriaContextAspect {

    @PersistenceContext
    private EntityManager em;

    @Before("@within(org.springframework.transaction.annotation.Transactional) || " +
            "@annotation(org.springframework.transaction.annotation.Transactional)")
    public void propagarContexto() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) return;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String usuario = (auth != null && auth.isAuthenticated()) ? auth.getName() : "sistema";

        String ip = "";
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) {
            ip = sra.getRequest().getRemoteAddr();
        }

        em.createNativeQuery("SELECT set_config('sagab.usuario_app', :u, true), " +
                             "       set_config('sagab.ip_cliente', :ip, true)")
          .setParameter("u", usuario)
          .setParameter("ip", ip)
          .getSingleResult();
    }
}
