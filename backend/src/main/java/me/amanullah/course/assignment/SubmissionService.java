package me.amanullah.course.assignment;

import me.amanullah.course.assignment.AssignmentDtos.AssignmentDto;
import me.amanullah.course.assignment.AssignmentDtos.ReviewRequest;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionDetailDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmissionSummaryDto;
import me.amanullah.course.assignment.AssignmentDtos.SubmitRequest;
import me.amanullah.course.common.exception.ConflictException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.common.util.TextLimits;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.learning.ItemProgress;
import me.amanullah.course.learning.ItemProgressRepository;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.notification.EmailTemplates;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.security.CurrentUser;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Submitting, reviewing and grading assignment work. */
@Service
public class SubmissionService {

    private final AssignmentService assignmentService;
    private final SubmissionRepository submissions;
    private final CourseAccess access;
    private final LearnerAccess learnerAccess;
    private final MediaService mediaService;
    private final ItemProgressRepository progress;
    private final UserRepository users;
    private final NotificationService notifications;
    private final EmailTemplates templates;
    private final AssignmentMapper mapper;
    private final Clock clock;

    public SubmissionService(AssignmentService assignmentService, SubmissionRepository submissions,
                             CourseAccess access, LearnerAccess learnerAccess, MediaService mediaService,
                             ItemProgressRepository progress, UserRepository users,
                             NotificationService notifications, EmailTemplates templates, AssignmentMapper mapper,
                             Clock clock) {
        this.assignmentService = assignmentService;
        this.submissions = submissions;
        this.access = access;
        this.learnerAccess = learnerAccess;
        this.mediaService = mediaService;
        this.progress = progress;
        this.users = users;
        this.notifications = notifications;
        this.templates = templates;
        this.mapper = mapper;
        this.clock = clock;
    }

    // ---------------- learner ----------------

    @Transactional
    public List<SubmissionDto> mine(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        Assignment a = assignmentService.ensureFor(learnerAccess.item(itemId, me, now));
        return submissions.findByAssignmentIdAndStudentIdOrderByVersionNoAsc(a.getId(), me.id()).stream()
                .map(mapper::toLearnerDto).toList();
    }

    @Transactional
    public SubmissionDto submit(CurrentUser me, UUID itemId, SubmitRequest req) {
        Instant now = Instant.now(clock);
        ContentItem item = learnerAccess.item(itemId, me, now);
        Assignment a = assignmentService.ensureFor(item);
        AssignmentSubmission latest = submissions.findLatest(a.getId(), me.id()).orElse(null);
        int used = (int) submissions.countByAssignmentIdAndStudentId(a.getId(), me.id());
        String blocked = AssignmentService.blockedReason(a, latest, used, now);
        if (blocked != null) {
            throw new ConflictException("SUBMISSION_" + blocked, "A new version cannot be submitted right now")
                    .key("error.SUBMISSION_" + blocked);
        }

        String text = req.textAnswer() == null ? "" : req.textAnswer().strip();
        List<UUID> mediaIds = req.mediaIds() == null ? List.of() : List.copyOf(new LinkedHashSet<>(req.mediaIds()));
        if (!a.isAllowText() && !text.isEmpty()) {
            throw ValidationException.field("textAnswer", "validation.assignment.textNotAllowed");
        }
        if (mediaIds.size() > a.getMaxFiles()) {
            throw ValidationException.field("mediaIds", "validation.assignment.maxFiles", a.getMaxFiles());
        }
        if (text.isEmpty() && mediaIds.isEmpty()) {
            throw ValidationException.field(a.isAllowText() ? "textAnswer" : "mediaIds",
                    "validation.assignment.empty");
        }
        List<SubmissionFile> files = new ArrayList<>();
        for (int i = 0; i < mediaIds.size(); i++) {
            try {
                files.add(new SubmissionFile(mediaService.requireUsable(mediaIds.get(i), me.id(), false), false));
            } catch (NotFoundException e) {
                throw ValidationException.field("mediaIds[" + i + "]", "validation.invalidValue");
            }
        }

        boolean late = latest == null
                ? a.getDueAt() != null && now.isAfter(a.getDueAt()) : latest.isLate();
        User student = users.getReferenceById(me.id());
        AssignmentSubmission s = new AssignmentSubmission(a, student, latest == null ? 1 : latest.getVersionNo() + 1,
                now, late);
        s.setTextAnswer(text.isEmpty() ? null : text);
        s.setFiles(files);
        submissions.save(s);

        // like quizzes: handing in work counts as working through the item
        if (!progress.existsByStudentIdAndItemId(me.id(), item.getId())) {
            progress.save(new ItemProgress(student, item, now));
        }
        Course course = item.getModule().getCourse();
        User instructor = course.getInstructor();
        if (!instructor.getId().equals(me.id())) {
            notifications.notify(instructor, NotificationType.ASSIGNMENT_SUBMITTED, "notification.assignmentSubmitted",
                    Links.instructorSubmission(course.getId(), s.getId()), null,
                    users.findById(me.id()).map(User::getFullName).orElse(""), item.getTitle());
        }
        return mapper.toLearnerDto(s);
    }

    // ---------------- instructor ----------------

    @Transactional(readOnly = true)
    public List<SubmissionSummaryDto> forItem(CurrentUser me, UUID itemId, SubmissionStatus status) {
        ContentItem item = access.item(itemId, me);
        Assignment a = assignmentService.ensureFor(item);
        return submissions.findLatestPerStudent(a.getId(), status).stream().map(mapper::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<SubmissionSummaryDto> forCourse(CurrentUser me, UUID courseId, SubmissionStatus status) {
        Course course = access.course(courseId, me);
        return submissions.findLatestForCourse(course.getId(), status).stream().map(mapper::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public SubmissionDetailDto detail(CurrentUser me, UUID id) {
        return detailOf(requireManageable(me, id));
    }

    @Transactional
    public SubmissionDetailDto review(CurrentUser me, UUID id, ReviewRequest req) {
        Instant now = Instant.now(clock);
        AssignmentSubmission s = requireManageable(me, id);
        Assignment a = s.getAssignment();
        AssignmentSubmission latest = submissions.findLatest(a.getId(), s.getStudent().getId()).orElse(s);
        if (!latest.getId().equals(s.getId())) {
            throw new ConflictException("SUBMISSION_SUPERSEDED", "A newer version exists").key("error.SUBMISSION_SUPERSEDED");
        }
        if (s.getStatus() == SubmissionStatus.RETURNED) {
            throw new ConflictException("SUBMISSION_RETURNED", "Waiting for the learner's revision")
                    .key("error.SUBMISSION_RETURNED");
        }
        String feedback = TextLimits.requireMax("feedback", HtmlSanitizer.sanitize(req.feedback()), 20_000);
        boolean hasFeedback = feedback != null && !HtmlSanitizer.toPlainText(feedback).isBlank();
        List<UUID> feedbackIds = req.feedbackMediaIds() == null ? List.of()
                : List.copyOf(new LinkedHashSet<>(req.feedbackMediaIds()));
        Double points = req.points() == null ? null : Math.round(req.points() * 100.0) / 100.0;
        if (points != null && points > a.getMaxPoints()) {
            throw ValidationException.field("points", "validation.grade.max", a.getMaxPoints());
        }
        if (req.action() == ReviewAction.GRADE && points == null) {
            throw ValidationException.field("points", "validation.required");
        }
        if (req.action() == ReviewAction.RETURN && !hasFeedback && feedbackIds.isEmpty()) {
            throw ValidationException.field("feedback", "validation.assignment.feedbackRequired");
        }
        List<SubmissionFile> files = new ArrayList<>(s.getFiles().stream().filter(f -> !f.isFeedbackFile()).toList());
        for (int i = 0; i < feedbackIds.size(); i++) {
            try {
                MediaAsset m = mediaService.requireUsable(feedbackIds.get(i), me.id(), me.isAdmin());
                files.add(new SubmissionFile(m, true));
            } catch (NotFoundException e) {
                throw ValidationException.field("feedbackMediaIds[" + i + "]", "validation.invalidValue");
            }
        }
        s.setFiles(files);
        s.setFeedback(hasFeedback ? feedback : null);
        s.setPoints(points);
        s.setStatus(req.action() == ReviewAction.GRADE ? SubmissionStatus.GRADED : SubmissionStatus.RETURNED);
        s.setGradedBy(users.getReferenceById(me.id()));
        s.setGradedAt(now);
        submissions.flush();

        ContentItem item = a.getItem();
        UUID courseId = item.getModule().getCourse().getId();
        User student = s.getStudent();
        boolean returned = req.action() == ReviewAction.RETURN;
        String link = Links.learnSubmission(courseId, item.getId(), s.getId());
        notifications.notifyWithEmail(student, NotificationType.ASSIGNMENT_REVIEWED,
                returned ? "notification.assignmentReturned" : "notification.assignmentGraded", link, null,
                templates.assignmentReviewed(student, item.getTitle(), returned, templates.link(link)),
                item.getTitle());
        return detailOf(s);
    }

    private SubmissionDetailDto detailOf(AssignmentSubmission s) {
        Assignment a = s.getAssignment();
        List<AssignmentSubmission> all = submissions.findByAssignmentIdAndStudentIdOrderByVersionNoAsc(a.getId(),
                s.getStudent().getId());
        boolean latest = all.isEmpty() || all.get(all.size() - 1).getId().equals(s.getId());
        AssignmentDto settings = mapper.toDto(a);
        return new SubmissionDetailDto(mapper.toSummary(s), settings, mapper.toInstructorDto(s),
                all.stream().map(mapper::toInstructorDto).toList(), latest);
    }

    private AssignmentSubmission requireManageable(CurrentUser me, UUID id) {
        AssignmentSubmission s = submissions.findWithContext(id)
                .orElseThrow(() -> NotFoundException.of("Submission"));
        if (!CourseAccess.canManage(s.getAssignment().getItem().getModule().getCourse(), me)) {
            throw NotFoundException.of("Submission");
        }
        return s;
    }
}
