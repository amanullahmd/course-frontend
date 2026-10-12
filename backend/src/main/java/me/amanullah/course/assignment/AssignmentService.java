package me.amanullah.course.assignment;

import me.amanullah.course.assignment.AssignmentDtos.AssignmentDto;
import me.amanullah.course.assignment.AssignmentDtos.AssignmentUpsert;
import me.amanullah.course.assignment.AssignmentDtos.LearnerAssignmentDto;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.security.CurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Assignment settings: instructor editor and the learner's view of the rules. */
@Service
public class AssignmentService {

    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final CourseAccess access;
    private final LearnerAccess learnerAccess;
    private final AssignmentMapper mapper;
    private final Clock clock;

    public AssignmentService(AssignmentRepository assignments, SubmissionRepository submissions, CourseAccess access,
                             LearnerAccess learnerAccess, AssignmentMapper mapper, Clock clock) {
        this.assignments = assignments;
        this.submissions = submissions;
        this.access = access;
        this.learnerAccess = learnerAccess;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** The assignment of an ASSIGNMENT item; created with defaults on first use. */
    @Transactional
    public Assignment ensureFor(ContentItem item) {
        if (item.getType() != ItemType.ASSIGNMENT) {
            throw new NotFoundException("ASSIGNMENT_NOT_FOUND", "This item is not an assignment");
        }
        return assignments.findByItemId(item.getId()).orElseGet(() -> assignments.save(new Assignment(item)));
    }

    @Transactional
    public AssignmentDto get(CurrentUser me, UUID itemId) {
        return mapper.toDto(ensureFor(access.item(itemId, me)));
    }

    @Transactional
    public AssignmentDto replace(CurrentUser me, UUID itemId, AssignmentUpsert req) {
        ContentItem item = access.item(itemId, me);
        Assignment a = ensureFor(item);
        boolean allowText = req.allowText() == null || req.allowText();
        int maxFiles = req.maxFiles() == null ? 3 : req.maxFiles();
        if (!allowText && maxFiles == 0) {
            throw ValidationException.field("allowText", "validation.assignment.nothingToSubmit");
        }
        a.setDueAt(req.dueAt());
        a.setAllowLate(req.allowLate() == null || req.allowLate());
        a.setMaxPoints(req.maxPoints() == null ? 10 : req.maxPoints());
        a.setMaxFiles(maxFiles);
        a.setMaxSubmissions(req.maxSubmissions() == null ? 3 : req.maxSubmissions());
        a.setAllowText(allowText);
        item.touch();
        return mapper.toDto(a);
    }

    @Transactional
    public LearnerAssignmentDto learnerView(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = learnerAccess.item(itemId, me, now);
        Assignment a = ensureFor(item);
        var latest = submissions.findLatest(a.getId(), me.id()).orElse(null);
        int used = (int) submissions.countByAssignmentIdAndStudentId(a.getId(), me.id());
        String blocked = blockedReason(a, latest, used, now);
        boolean overdue = a.getDueAt() != null && now.isAfter(a.getDueAt());
        return new LearnerAssignmentDto(item.getId(), a.getDueAt(), a.isAllowLate(), a.getMaxPoints(), a.getMaxFiles(),
                a.getMaxSubmissions(), a.isAllowText(), used, overdue, blocked == null, blocked);
    }

    /** null when a new version may be submitted. */
    static String blockedReason(Assignment a, AssignmentSubmission latest, int used, Instant now) {
        if (latest == null) {
            return a.getDueAt() != null && now.isAfter(a.getDueAt()) && !a.isAllowLate() ? "CLOSED" : null;
        }
        return switch (latest.getStatus()) {
            case SUBMITTED -> "UNDER_REVIEW";
            case GRADED -> "GRADED";
            case RETURNED -> used >= a.getMaxSubmissions() ? "MAX_SUBMISSIONS" : null;
        };
    }
}
