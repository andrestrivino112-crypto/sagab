package ec.edu.bellini.sagab.service;

import ec.edu.bellini.sagab.dto.ParaleloDtos;

import ec.edu.bellini.sagab.model.Paralelo;
import ec.edu.bellini.sagab.repository.ParaleloRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ParaleloService {

    private final ParaleloRepository paralelos;
    private final PeriodoAcademicoRepository periodos;

    public ParaleloService(ParaleloRepository paralelos, PeriodoAcademicoRepository periodos) {
        this.paralelos = paralelos;
        this.periodos = periodos;
    }

    /** Paralelos del año lectivo del período académico activo (para el selector de Matrícula). */
    @Transactional(readOnly = true)
    public List<ParaleloDtos.ParaleloResponse> delAnioLectivoVigente() {
        List<Paralelo> lista = periodos.findFirstByActivoTrueOrderByFechaInicioDesc()
                .map(p -> paralelos.findByAnioLectivoOrderByNivelAscSeccionAsc(p.getAnioLectivo()))
                .orElseGet(paralelos::findAll);

        return lista.stream()
                .map(p -> new ParaleloDtos.ParaleloResponse(p.getId(), p.getNivel(), p.getSeccion(), p.getAnioLectivo(), p.etiqueta()))
                .toList();
    }
}
