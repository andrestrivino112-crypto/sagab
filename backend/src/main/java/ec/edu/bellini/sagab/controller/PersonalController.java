package ec.edu.bellini.sagab.controller;

import ec.edu.bellini.sagab.dto.PersonalDtos;
import ec.edu.bellini.sagab.service.PersonalService;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Alta y listado de cuentas de personal (DOCENTE, DECE, AUDITOR) — exclusivo de ADMIN. */
@RestController
@RequestMapping("/api/personal")
@PreAuthorize("hasRole('ADMIN')")
public class PersonalController {

    private final PersonalService service;

    public PersonalController(PersonalService service) { this.service = service; }

    @PostMapping
    public PersonalDtos.PersonalResponse crear(@Valid @RequestBody PersonalDtos.CrearPersonalRequest req) {
        return service.crear(req);
    }

    @GetMapping
    public List<PersonalDtos.PersonalResumen> listar() {
        return service.listar();
    }
}
