package me.amanullah.course.flashcard;

import me.amanullah.course.flashcard.FlashcardDtos.DeckDto;
import me.amanullah.course.flashcard.FlashcardDtos.DeckUpsert;
import me.amanullah.course.flashcard.FlashcardDtos.ImportResultDto;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Instructor: flashcards")
@RestController
@RequestMapping("/api/instructor/items/{id}/flashcards")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorFlashcardController {

    private final FlashcardService service;

    public InstructorFlashcardController(FlashcardService service) {
        this.service = service;
    }

    @GetMapping
    public DeckDto get(@PathVariable UUID id) {
        return service.get(CurrentUser.get(), id);
    }

    /** Replace semantics: cards with an id are updated, new ones created, missing ones deleted. */
    @PutMapping
    public DeckDto replace(@PathVariable UUID id, @Valid @RequestBody DeckUpsert request) {
        return service.replace(CurrentUser.get(), id, request);
    }

    /** CSV import ({@code front;back;article;plural;example}); {@code commit=false} only previews. */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResultDto importCsv(@PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                     @RequestParam(defaultValue = "false") boolean commit) {
        return service.importCsv(CurrentUser.get(), id, file, commit);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@PathVariable UUID id) {
        FlashcardService.CsvExport export = service.exportCsv(CurrentUser.get(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(export.fileName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(export.bytes());
    }
}
