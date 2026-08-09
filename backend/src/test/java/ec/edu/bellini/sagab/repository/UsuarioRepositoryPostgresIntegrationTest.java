package ec.edu.bellini.sagab.repository;

import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Prueba opt-in contra PostgreSQL local; es estrictamente de solo lectura y usa .pgpass. */
@SpringJUnitConfig(UsuarioRepositoryPostgresIntegrationTest.Config.class)
@EnabledIfSystemProperty(named = "sagab.live-db", matches = "true")
class UsuarioRepositoryPostgresIntegrationTest {

    @Autowired
    private UsuarioRepository usuarios;

    @Test
    @Transactional(readOnly = true)
    void consultaPaginadaMapeaTodosLosCamposDelDtoSeguro() {
        var pagina = usuarios.buscarCuentas("", "", "", PageRequest.of(0, 20));

        assertFalse(pagina.isEmpty());
        pagina.forEach(fila -> {
            assertNotNull(fila.getIdUsuario());
            assertNotNull(fila.getNombreCompleto());
            assertNotNull(fila.getEmail());
            assertNotNull(fila.getRoles());
            assertNotNull(fila.getEstado());
            fila.getUltimoAcceso();
            assertNotNull(fila.getCreadoEn());
            assertNotNull(fila.getDebeCambiarClave());
        });
    }

    @Test
    @Transactional(readOnly = true)
    void buscaSinTildesEnCualquierOrdenYAplicaRolYConteo() {
        var pagina = usuarios.buscarCuentas(
                "trivino superadministrador", "SUPER_ADMIN", "", PageRequest.of(0, 1));

        assertEquals(1, pagina.getTotalElements());
        assertEquals("triviño", pagina.getContent().get(0).getUsername());
        assertTrue(pagina.getContent().get(0).getRoles().contains("SUPER_ADMIN"));
    }

    @Configuration
    @EnableTransactionManagement
    @EnableJpaRepositories(basePackageClasses = UsuarioRepository.class)
    static class Config {
        @Bean
        DataSource dataSource() {
            return new AbstractDataSource() {
                private final String url = "jdbc:postgresql://localhost:5432/sagab?currentSchema=sagab";

                @Override
                public Connection getConnection() throws SQLException {
                    Properties props = new Properties();
                    props.setProperty("user", "sagab_app");
                    return DriverManager.getConnection(url, props);
                }

                @Override
                public Connection getConnection(String username, String password) throws SQLException {
                    return getConnection();
                }
            };
        }

        @Bean
        LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource) {
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(dataSource);
            factory.setPackagesToScan("ec.edu.bellini.sagab.model");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of(
                    "hibernate.hbm2ddl.auto", "none",
                    "hibernate.default_schema", "sagab",
                    "hibernate.jdbc.time_zone", "America/Guayaquil",
                    "hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect"));
            return factory;
        }

        @Bean
        PlatformTransactionManager transactionManager(EntityManagerFactory factory) {
            return new JpaTransactionManager(factory);
        }
    }
}
