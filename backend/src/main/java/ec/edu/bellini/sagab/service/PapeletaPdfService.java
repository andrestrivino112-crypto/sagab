package ec.edu.bellini.sagab.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import ec.edu.bellini.sagab.model.AsignacionDocente;
import ec.edu.bellini.sagab.model.Asistencia;
import ec.edu.bellini.sagab.model.Calificacion;
import ec.edu.bellini.sagab.model.Estudiante;
import ec.edu.bellini.sagab.model.PeriodoAcademico;
import ec.edu.bellini.sagab.repository.AsignacionDocenteRepository;
import ec.edu.bellini.sagab.repository.AsistenciaRepository;
import ec.edu.bellini.sagab.repository.CalificacionRepository;
import ec.edu.bellini.sagab.repository.EstudianteRepository;
import ec.edu.bellini.sagab.repository.PeriodoAcademicoRepository;

import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Genera la "Papeleta de Calificaciones" en PDF con OpenPDF — maquetado directo (tablas,
 * fuentes, colores), no HTML convertido a PDF. La tabla de notas usa exactamente los campos que
 * existen en el modelo (parcial 1/2/3, cada uno con su promedio ya calculado por PostgreSQL) —
 * no se inventan columnas que el sistema no registra (p. ej. "Pruebas"/"Lecciones"/"Proyecto"
 * no son datos separados en este modelo; la nota de cada parcial ya combina tarea 20% + clase
 * 20% + examen 60%). La sección "Comportamiento" queda con un renglón en blanco: no existe hoy
 * un módulo de observaciones disciplinarias — es un espacio para completar a mano, igual que las
 * firmas. Tampoco hay foto de estudiante ni logo institucional almacenados: se usan un
 * placeholder con iniciales y un membrete de texto respectivamente.
 */
@Service
public class PapeletaPdfService {

    private static final String NOMBRE_INSTITUCION = "Unidad Educativa Particular Giovanni Bellini";
    private static final Color AZUL_INSTITUCIONAL = new Color(31, 78, 121);   // #1F4E79
    private static final Color AZUL_CLARO = new Color(234, 242, 251);        // #EAF2FB
    private static final Color GRIS_CLARO = new Color(245, 247, 250);        // #F5F7FA
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EstudianteRepository estudiantes;
    private final CalificacionRepository calificaciones;
    private final AsignacionDocenteRepository asignaciones;
    private final AsistenciaRepository asistencias;
    private final PeriodoAcademicoRepository periodos;

    public PapeletaPdfService(EstudianteRepository estudiantes, CalificacionRepository calificaciones,
                               AsignacionDocenteRepository asignaciones, AsistenciaRepository asistencias,
                               PeriodoAcademicoRepository periodos) {
        this.estudiantes = estudiantes;
        this.calificaciones = calificaciones;
        this.asignaciones = asignaciones;
        this.asistencias = asistencias;
        this.periodos = periodos;
    }

    public byte[] generar(Long idEstudiante, Integer idPeriodoParam) {
        Estudiante est = estudiantes.findById(idEstudiante)
                .orElseThrow(() -> new NoSuchElementException("El estudiante no existe"));

        PeriodoAcademico periodo = idPeriodoParam != null
                ? periodos.findById(idPeriodoParam).orElseThrow(() -> new NoSuchElementException("El período no existe"))
                : periodos.findFirstByActivoTrueOrderByFechaInicioDesc()
                        .orElseThrow(() -> new IllegalArgumentException("No hay un período académico activo"));

        List<FilaMateria> filas = filasDeNotas(idEstudiante, periodo);
        ResumenAsistencia asistencia = resumenAsistencia(idEstudiante, periodo);

        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        try {
            Document documento = new Document(PageSize.A4, 36, 36, 90, 54);
            PdfWriter.getInstance(documento, salida);
            documento.open();

            documento.add(encabezado(est, periodo));
            documento.add(espacio(14));
            documento.add(tablaNotas(filas));
            documento.add(espacio(14));
            documento.add(tituloSeccion("Asistencia"));
            documento.add(tablaAsistencia(asistencia));
            documento.add(espacio(14));
            documento.add(tituloSeccion("Comportamiento"));
            documento.add(lineaEnBlanco());
            documento.add(espacio(24));
            documento.add(tablaFirmas());

            documento.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("No se pudo generar el PDF de la papeleta", e);
        }
        return salida.toByteArray();
    }

    // ── Datos ────────────────────────────────────────────────────────────

    private record FilaMateria(String materia, BigDecimal p1, BigDecimal p2, BigDecimal p3, String observaciones) {}

    private List<FilaMateria> filasDeNotas(Long idEstudiante, PeriodoAcademico periodo) {
        List<Calificacion> notas = calificaciones.findByEstudianteIdOrderByParcialAsc(idEstudiante);
        Map<Long, AsignacionDocente> asigPorId = asignaciones.findAllById(
                        notas.stream().map(Calificacion::getIdAsignacion).distinct().toList())
                .stream().collect(Collectors.toMap(AsignacionDocente::getId, Function.identity()));

        record Acumulador(BigDecimal[] parciales, List<String> observaciones) {}
        Map<String, Acumulador> porMateria = new LinkedHashMap<>();

        for (Calificacion c : notas) {
            AsignacionDocente a = asigPorId.get(c.getIdAsignacion());
            if (a == null || !a.getPeriodo().getId().equals(periodo.getId())) continue;
            String materia = a.getMateria().getNombre();
            Acumulador acc = porMateria.computeIfAbsent(materia, m -> new Acumulador(new BigDecimal[3], new ArrayList<>()));
            if (c.getParcial() >= 1 && c.getParcial() <= 3) {
                acc.parciales()[c.getParcial() - 1] = c.getPromedio();
            }
            if (c.getObservacion() != null && !c.getObservacion().isBlank()) {
                acc.observaciones().add(c.getObservacion());
            }
        }

        return porMateria.entrySet().stream()
                .map(e -> new FilaMateria(e.getKey(), e.getValue().parciales()[0], e.getValue().parciales()[1],
                        e.getValue().parciales()[2], String.join("; ", e.getValue().observaciones())))
                .sorted(Comparator.comparing(FilaMateria::materia))
                .toList();
    }

    private record ResumenAsistencia(long total, long justificadas, long injustificadas, long atrasos, double porcentaje) {}

    private ResumenAsistencia resumenAsistencia(Long idEstudiante, PeriodoAcademico periodo) {
        List<Asistencia> registros = asistencias.findByEstudianteIdAndFechaBetweenOrderByFechaDesc(
                idEstudiante, periodo.getFechaInicio(), periodo.getFechaFin());
        long total = registros.size();
        long presentes = registros.stream().filter(a -> a.getEstado() == Asistencia.EstadoAsistencia.PRESENTE).count();
        long justificadas = registros.stream().filter(a -> a.getEstado() == Asistencia.EstadoAsistencia.AUSENCIA_JUSTIFICADA).count();
        long injustificadas = registros.stream().filter(a -> a.getEstado() == Asistencia.EstadoAsistencia.AUSENCIA_INJUSTIFICADA).count();
        long atrasos = registros.stream().filter(a -> a.getEstado() == Asistencia.EstadoAsistencia.ATRASO).count();
        double porcentaje = total == 0 ? 100.0 : (presentes * 100.0 / total);
        return new ResumenAsistencia(total, justificadas, injustificadas, atrasos, porcentaje);
    }

    // ── Maquetado ────────────────────────────────────────────────────────

    private PdfPTable encabezado(Estudiante est, PeriodoAcademico periodo) throws DocumentException {
        PdfPTable tabla = new PdfPTable(new float[]{1f, 3f});
        tabla.setWidthPercentage(100);

        PdfPCell logo = new PdfPCell(new Phrase(iniciales(NOMBRE_INSTITUCION), fuente(18, Font.BOLD, Color.WHITE)));
        logo.setBackgroundColor(AZUL_INSTITUCIONAL);
        logo.setHorizontalAlignment(Element.ALIGN_CENTER);
        logo.setVerticalAlignment(Element.ALIGN_MIDDLE);
        logo.setFixedHeight(56f);
        logo.setBorder(Rectangle.NO_BORDER);
        tabla.addCell(logo);

        PdfPCell titulo = new PdfPCell();
        titulo.setBorder(Rectangle.NO_BORDER);
        titulo.setPaddingLeft(12f);
        titulo.setVerticalAlignment(Element.ALIGN_MIDDLE);
        Paragraph p = new Paragraph();
        p.add(new Chunk(NOMBRE_INSTITUCION + "\n", fuente(13, Font.BOLD, AZUL_INSTITUCIONAL)));
        p.add(new Chunk("Papeleta de Calificaciones\n", fuente(10, Font.NORMAL, Color.DARK_GRAY)));
        p.add(new Chunk(periodo.etiqueta(), fuente(9, Font.ITALIC, Color.GRAY)));
        titulo.addElement(p);
        tabla.addCell(titulo);

        PdfPTable datos = new PdfPTable(new float[]{1f, 3f, 1f, 3f});
        datos.setWidthPercentage(100);
        datos.setSpacingBefore(10f);
        agregarDato(datos, "Estudiante", est.nombreCompleto());
        agregarDato(datos, "Código", est.getCodigo());
        agregarDato(datos, "Curso", est.getParalelo() != null ? est.getParalelo().getNivel() : "—");
        agregarDato(datos, "Paralelo", est.getParalelo() != null ? est.getParalelo().getSeccion() : "—");
        agregarDato(datos, "Período", periodo.getNombre());
        agregarDato(datos, "Año lectivo", periodo.getAnioLectivo());
        agregarDato(datos, "Representante",
                est.getRepresentante() != null ? est.getRepresentante().getUsuario().nombreCompleto() : "—");
        agregarDato(datos, "Emitido", java.time.LocalDate.now().format(FECHA));

        PdfPTable envoltorio = new PdfPTable(1);
        envoltorio.setWidthPercentage(100);
        PdfPCell celdaEncabezado = new PdfPCell(tabla);
        celdaEncabezado.setBorder(Rectangle.NO_BORDER);
        envoltorio.addCell(celdaEncabezado);
        PdfPCell celdaDatos = new PdfPCell(datos);
        celdaDatos.setBorder(Rectangle.NO_BORDER);
        celdaDatos.setPaddingTop(6f);
        envoltorio.addCell(celdaDatos);
        return envoltorio;
    }

    private void agregarDato(PdfPTable tabla, String etiqueta, String valor) {
        PdfPCell celdaEtiqueta = new PdfPCell(new Phrase(etiqueta, fuente(8, Font.BOLD, Color.GRAY)));
        celdaEtiqueta.setBorder(Rectangle.NO_BORDER);
        celdaEtiqueta.setBackgroundColor(GRIS_CLARO);
        celdaEtiqueta.setPadding(4f);
        tabla.addCell(celdaEtiqueta);

        PdfPCell celdaValor = new PdfPCell(new Phrase(valor != null ? valor : "—", fuente(9, Font.NORMAL, Color.BLACK)));
        celdaValor.setBorder(Rectangle.NO_BORDER);
        celdaValor.setPadding(4f);
        tabla.addCell(celdaValor);
    }

    private PdfPTable tablaNotas(List<FilaMateria> filas) {
        PdfPTable tabla = new PdfPTable(new float[]{3f, 1f, 1f, 1f, 1.2f, 2.5f});
        tabla.setWidthPercentage(100);
        tabla.setSpacingBefore(4f);
        for (String h : new String[]{"Materia", "Parcial 1", "Parcial 2", "Parcial 3", "Promedio", "Observaciones"}) {
            tabla.addCell(celdaEncabezadoTabla(h));
        }
        if (filas.isEmpty()) {
            PdfPCell vacio = new PdfPCell(new Phrase("Sin calificaciones registradas en este período.", fuente(9, Font.ITALIC, Color.GRAY)));
            vacio.setColspan(6);
            vacio.setPadding(8f);
            vacio.setHorizontalAlignment(Element.ALIGN_CENTER);
            tabla.addCell(vacio);
            return tabla;
        }
        boolean par = false;
        for (FilaMateria f : filas) {
            Color fondo = par ? Color.WHITE : GRIS_CLARO;
            tabla.addCell(celdaCuerpo(f.materia(), Element.ALIGN_LEFT, fondo));
            tabla.addCell(celdaCuerpo(formatoNota(f.p1()), Element.ALIGN_CENTER, fondo));
            tabla.addCell(celdaCuerpo(formatoNota(f.p2()), Element.ALIGN_CENTER, fondo));
            tabla.addCell(celdaCuerpo(formatoNota(f.p3()), Element.ALIGN_CENTER, fondo));
            tabla.addCell(celdaCuerpo(formatoNota(promedioFinal(f)), Element.ALIGN_CENTER, fondo));
            tabla.addCell(celdaCuerpo(f.observaciones().isBlank() ? "—" : f.observaciones(), Element.ALIGN_LEFT, fondo));
            par = !par;
        }
        return tabla;
    }

    private BigDecimal promedioFinal(FilaMateria f) {
        List<BigDecimal> valores = new ArrayList<>();
        for (BigDecimal v : List.of(f.p1() != null ? f.p1() : BigDecimal.valueOf(-1),
                f.p2() != null ? f.p2() : BigDecimal.valueOf(-1),
                f.p3() != null ? f.p3() : BigDecimal.valueOf(-1))) {
            if (v.signum() >= 0) valores.add(v);
        }
        if (valores.isEmpty()) return null;
        BigDecimal suma = valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return suma.divide(BigDecimal.valueOf(valores.size()), 2, RoundingMode.HALF_UP);
    }

    private PdfPTable tablaAsistencia(ResumenAsistencia r) {
        PdfPTable tabla = new PdfPTable(5);
        tabla.setWidthPercentage(100);
        tabla.setSpacingBefore(4f);
        for (String h : new String[]{"Total registros", "Faltas justificadas", "Faltas injustificadas", "Atrasos", "% Asistencia"}) {
            tabla.addCell(celdaEncabezadoTabla(h));
        }
        tabla.addCell(celdaCuerpo(String.valueOf(r.total()), Element.ALIGN_CENTER, Color.WHITE));
        tabla.addCell(celdaCuerpo(String.valueOf(r.justificadas()), Element.ALIGN_CENTER, Color.WHITE));
        tabla.addCell(celdaCuerpo(String.valueOf(r.injustificadas()), Element.ALIGN_CENTER, Color.WHITE));
        tabla.addCell(celdaCuerpo(String.valueOf(r.atrasos()), Element.ALIGN_CENTER, Color.WHITE));
        tabla.addCell(celdaCuerpo(String.format("%.1f%%", r.porcentaje()), Element.ALIGN_CENTER, Color.WHITE));
        return tabla;
    }

    private PdfPTable tablaFirmas() {
        PdfPTable tabla = new PdfPTable(4);
        tabla.setWidthPercentage(100);
        for (String firma : new String[]{"Profesor Tutor", "Inspector", "Secretaría", "Representante"}) {
            PdfPCell celda = new PdfPCell();
            celda.setBorder(Rectangle.NO_BORDER);
            celda.setPaddingTop(30f);
            Paragraph p = new Paragraph();
            p.add(new Chunk("_______________________\n", fuente(10, Font.NORMAL, Color.BLACK)));
            p.add(new Chunk(firma, fuente(8, Font.NORMAL, Color.GRAY)));
            p.setAlignment(Element.ALIGN_CENTER);
            celda.addElement(p);
            celda.setHorizontalAlignment(Element.ALIGN_CENTER);
            tabla.addCell(celda);
        }
        return tabla;
    }

    private Paragraph tituloSeccion(String texto) {
        Paragraph p = new Paragraph(texto, fuente(11, Font.BOLD, AZUL_INSTITUCIONAL));
        p.setSpacingAfter(2f);
        return p;
    }

    private PdfPTable lineaEnBlanco() {
        PdfPTable tabla = new PdfPTable(1);
        tabla.setWidthPercentage(100);
        PdfPCell celda = new PdfPCell(new Phrase(" "));
        celda.setFixedHeight(40f);
        celda.setBackgroundColor(GRIS_CLARO);
        tabla.addCell(celda);
        return tabla;
    }

    private PdfPCell celdaEncabezadoTabla(String texto) {
        PdfPCell celda = new PdfPCell(new Phrase(texto, fuente(8, Font.BOLD, Color.WHITE)));
        celda.setBackgroundColor(AZUL_INSTITUCIONAL);
        celda.setHorizontalAlignment(Element.ALIGN_CENTER);
        celda.setPadding(5f);
        return celda;
    }

    private PdfPCell celdaCuerpo(String texto, int alineacion, Color fondo) {
        PdfPCell celda = new PdfPCell(new Phrase(texto, fuente(8, Font.NORMAL, Color.BLACK)));
        celda.setHorizontalAlignment(alineacion);
        celda.setVerticalAlignment(Element.ALIGN_MIDDLE);
        celda.setBackgroundColor(fondo);
        celda.setPadding(5f);
        return celda;
    }

    private Paragraph espacio(float puntos) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingAfter(puntos);
        return p;
    }

    private Font fuente(int tamano, int estilo, Color color) {
        return FontFactory.getFont(FontFactory.HELVETICA, tamano, estilo, color);
    }

    private String formatoNota(BigDecimal nota) {
        return nota != null ? nota.setScale(2, RoundingMode.HALF_UP).toString() : "—";
    }

    private String iniciales(String nombre) {
        StringBuilder sb = new StringBuilder();
        for (String palabra : nombre.split(" ")) {
            if (!palabra.isBlank() && Character.isUpperCase(palabra.charAt(0))) sb.append(palabra.charAt(0));
        }
        return sb.length() > 4 ? sb.substring(0, 4) : sb.toString();
    }
}
