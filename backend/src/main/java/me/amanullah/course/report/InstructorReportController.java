package me.amanullah.course.report;

import me.amanullah.course.report.ReportDtos.AssessmentAnalyticsDto;
import me.amanullah.course.report.ReportDtos.GradebookDto;
import me.amanullah.course.report.ReportDtos.OverviewDto;
import me.amanullah.course.report.ReportDtos.StudentReportDto;
import me.amanullah.course.report.ReportExportService.CsvFile;
import me.amanullah.course.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Course reports, gradebook, learner reports, assessment analytics and their CSV exports (owner or admin only). */
@Tag(name = "Instructor: reports")
@RestController
@RequestMapping("/api/instructor")
@PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
public class InstructorReportController {

    static final MediaType TEXT_CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final ReportService reports;
    private final ReportExportService exports;

    public InstructorReportController(ReportService reports, ReportExportService exports) {
        this.reports = reports;
        this.exports = exports;
    }

    @GetMapping("/courses/{courseId}/reports/overview")
    public OverviewDto overview(@PathVariable UUID courseId) {
        return reports.overview(CurrentUser.get(), courseId);
    }

    @GetMapping("/courses/{courseId}/reports/gradebook")
    public GradebookDto gradebook(@PathVariable UUID courseId) {
        return reports.gradebook(CurrentUser.get(), courseId);
    }

    @GetMapping("/courses/{courseId}/reports/students/{studentId}")
    public StudentReportDto student(@PathVariable UUID courseId, @PathVariable UUID studentId) {
        return reports.student(CurrentUser.get(), courseId, studentId);
    }

    @GetMapping("/items/{itemId}/reports/assessment")
    public AssessmentAnalyticsDto assessment(@PathVariable UUID itemId) {
        return reports.assessment(CurrentUser.get(), itemId);
    }

    @Operation(summary = "Gradebook as CSV (UTF-8 with BOM, localized headers)")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "text/csv",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/courses/{courseId}/reports/gradebook.csv")
    public ResponseEntity<byte[]> gradebookCsv(@PathVariable UUID courseId) {
        return csv(exports.gradebook(CurrentUser.get(), courseId));
    }

    @Operation(summary = "Learner progress table as CSV (UTF-8 with BOM, localized headers)")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "text/csv",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/courses/{courseId}/reports/progress.csv")
    public ResponseEntity<byte[]> progressCsv(@PathVariable UUID courseId) {
        return csv(exports.progress(CurrentUser.get(), courseId));
    }

    @Operation(summary = "Learner report as CSV (UTF-8 with BOM, localized headers)")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "text/csv",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/courses/{courseId}/reports/students/{studentId}.csv")
    public ResponseEntity<byte[]> studentCsv(@PathVariable UUID courseId, @PathVariable UUID studentId) {
        return csv(exports.student(CurrentUser.get(), courseId, studentId));
    }

    @Operation(summary = "All attempts of a quiz/exam with per-question points as CSV")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "text/csv",
            schema = @Schema(type = "string", format = "binary")))
    @GetMapping("/items/{itemId}/reports/attempts.csv")
    public ResponseEntity<byte[]> attemptsCsv(@PathVariable UUID itemId) {
        return csv(exports.attempts(CurrentUser.get(), itemId));
    }

    private static ResponseEntity<byte[]> csv(CsvFile file) {
        return ResponseEntity.ok()
                .contentType(TEXT_CSV)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName()).build().toString())
                .body(file.content());
    }
}
