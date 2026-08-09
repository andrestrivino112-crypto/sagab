package ec.edu.bellini.sagab.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EntregaTareaRepositoryContractTest {

    @Test
    void backfillEsIdempotenteYSoloIncluyeTareasAbiertasDelParalelo() throws Exception {
        var metodo = EntregaTareaRepository.class.getMethod(
                "crearPendientesParaTareasAbiertas", Long.class, Integer.class, OffsetDateTime.class);
        Query query = metodo.getAnnotation(Query.class);

        assertNotNull(metodo.getAnnotation(Modifying.class));
        assertNotNull(query);
        String sql = query.value().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        assertTrue(sql.contains("a.id_paralelo = :idparalelo"));
        assertTrue(sql.contains("t.fecha_limite > :ahora"));
        assertTrue(sql.contains("on conflict (id_tarea, id_estudiante) do nothing"));
    }
}
