package ec.edu.bellini.sagab.config;

import ec.edu.bellini.sagab.middleware.JwtAuthFilter;
import ec.edu.bellini.sagab.middleware.SecurityFailureHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configuración de seguridad SAGAB (RNF-03, LOPDP):
 *  - API stateless con JWT (sin sesiones de servidor)
 *  - BCrypt fuerza 12
 *  - CORS restringido al frontend institucional
 *  - Autorización por rol y por método (@PreAuthorize)
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${sagab.cors.origenes}")
    private List<String> origenesPermitidos;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtFilter,
                                           SecurityFailureHandler failureHandler) throws Exception {
        http.csrf(csrf -> csrf.disable())               // API stateless con JWT: CSRF no aplica
            .cors(cors -> cors.configurationSource(corsSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h
                .contentTypeOptions(o -> {})
                .frameOptions(f -> f.deny())
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000)))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint(failureHandler)
                .accessDeniedHandler(failureHandler))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                // Descarga local firmada y de corta duración. El token HMAC sustituye al JWT
                // porque window.open/img no pueden adjuntar Authorization; el permiso del
                // recurso se verifica antes de emitir el enlace.
                .requestMatchers(HttpMethod.GET, "/api/storage/local/**").permitAll()
                .requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/auditoria/**").hasAnyRole("AUDITOR", "ADMIN", "SUPER_ADMIN")
                .requestMatchers("/api/personal/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                // Regla específica antes de la general de abajo: la cola de revisión es solo ADMIN
                // (coincide con @PreAuthorize de FinanzasController.colaRevision(), documentado aquí
                // también para que SecurityConfig no sugiera una regla más permisiva de la real).
                .requestMatchers(HttpMethod.GET, "/api/finanzas/pagos/revision").hasAnyRole("ADMIN", "SUPER_ADMIN")
                // Drill-down "Estudiantes en mora" del Dashboard: mismos roles que ya ven el Dashboard
                // (DashboardController.resumen), no la regla general de abajo (que incluye a las
                // familias) — es un listado institucional completo, no el de un único estudiante.
                .requestMatchers(HttpMethod.GET, "/api/finanzas/mora").hasAnyRole("ADMIN", "SUPER_ADMIN", "AUDITOR")
                .requestMatchers(HttpMethod.GET, "/api/finanzas/pendientes").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/finanzas/pendientes/*/notificacion").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/finanzas/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "REPRESENTANTE", "ESTUDIANTE")
                // El estudiante o su representante suben comprobantes de su propia transferencia
                // (verificado además por FinanzasService.esPropio); el admin únicamente revisa
                // (aprobar/rechazar), nunca sube. El resto de /api/finanzas/** sigue siendo solo ADMIN.
                .requestMatchers(HttpMethod.POST, "/api/finanzas/pagos/transferencia").hasAnyRole("REPRESENTANTE", "ESTUDIANTE")
                .requestMatchers("/api/finanzas/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // Los patrones permiten autorizar de forma explícita un subdominio temporal de demo
        // (p. ej. https://*.trycloudflare.com) sin abrir CORS globalmente.
        cfg.setAllowedOriginPatterns(origenesPermitidos);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", cfg);
        return src;
    }
}
