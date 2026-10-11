package de.sprachweg.learning;

import de.sprachweg.assessment.Assessment;
import de.sprachweg.assessment.AssessmentRepository;
import de.sprachweg.assessment.Attempt;
import de.sprachweg.assessment.AttemptRepository;
import de.sprachweg.assessment.AttemptStatus;
import de.sprachweg.assessment.Grader;
import de.sprachweg.course.ContentItem;
import de.sprachweg.course.Course;
import de.sprachweg.course.CourseMapper;
import de.sprachweg.course.CourseModule;
import de.sprachweg.course.CourseStats;
import de.sprachweg.enrollment.EnrollmentStatus;
import de.sprachweg.learning.LearningDtos.LearnAssessmentDto;
import de.sprachweg.learning.LearningDtos.LearnCourseDto;
import de.sprachweg.learning.LearningDtos.LearnItemDto;
import de.sprachweg.learning.LearningDtos.LearnModule;
import de.sprachweg.learning.LearningDtos.LearnOutlineItem;
import de.sprachweg.media.MediaMapper;
import de.sprachweg.security.CurrentUser;
import de.sprachweg.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LearningService {

    private final LearnerAccess access;
    private final CourseMapper courseMapper;
    private final CourseStats stats;
    private final ProgressService progressService;
    private final ItemProgressRepository progress;
    private final AssessmentRepository assessments;
    private final AttemptRepository attempts;
    private final UserRepository users;
    private final MediaMapper mediaMapper;
    private final Clock clock;

    public LearningService(LearnerAccess access, CourseMapper courseMapper, CourseStats stats,
                           ProgressService progressService, ItemProgressRepository progress,
                           AssessmentRepository assessments, AttemptRepository attempts, UserRepository users,
                           MediaMapper mediaMapper, Clock clock) {
        this.access = access;
        this.courseMapper = courseMapper;
        this.stats = stats;
        this.progressService = progressService;
        this.progress = progress;
        this.assessments = assessments;
        this.attempts = attempts;
        this.users = users;
        this.mediaMapper = mediaMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public LearnCourseDto course(CurrentUser me, UUID courseId) {
        Instant now = Instant.now(clock);
        Course course = access.course(courseId, me, now);
        List<CourseModule> modules = courseMapper.liveModules(course, now);
        List<UUID> itemIds = modules.stream().flatMap(m -> courseMapper.liveItems(m, now).stream())
                .map(ContentItem::getId).toList();
        Set<UUID> done = progressService.completedItemIds(me.id(), itemIds);
        List<LearnModule> outline = modules.stream().map(m -> new LearnModule(m.getId(), m.getTitle(), m.getDescription(),
                courseMapper.liveItems(m, now).stream().map(i -> new LearnOutlineItem(i.getId(), i.getTitle(),
                        i.getType(), i.getDurationMinutes(), done.contains(i.getId()))).toList())).toList();
        int completed = (int) itemIds.stream().filter(done::contains).count();
        return new LearnCourseDto(courseMapper.toDetail(course, stats.count(course.getId(), EnrollmentStatus.APPROVED), now),
                ProgressService.percent(completed, itemIds.size()), outline);
    }

    @Transactional(readOnly = true)
    public LearnItemDto item(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = access.item(itemId, me, now);
        Course course = item.getModule().getCourse();
        List<ContentItem> live = progressService.liveItems(List.of(course.getId()), now)
                .getOrDefault(course.getId(), List.of());
        int idx = -1;
        for (int i = 0; i < live.size(); i++) {
            if (live.get(i).getId().equals(item.getId())) {
                idx = i;
                break;
            }
        }
        UUID prev = idx > 0 ? live.get(idx - 1).getId() : null;
        UUID next = idx >= 0 && idx < live.size() - 1 ? live.get(idx + 1).getId() : null;
        boolean completed = progress.existsByStudentIdAndItemId(me.id(), item.getId());
        LearnAssessmentDto assessment = item.getType().isAssessment()
                ? assessments.findByItemId(item.getId()).map(a -> assessmentInfo(a, me.id())).orElse(null)
                : null;
        return new LearnItemDto(item.getId(), course.getId(), item.getModule().getId(), item.getType(), item.getTitle(),
                item.getSummary(), courseMapper.html(item.getBody()), item.getExternalUrl(), item.getDurationMinutes(),
                item.getAttachments().stream().map(mediaMapper::toDto).toList(), completed, prev, next, assessment);
    }

    private LearnAssessmentDto assessmentInfo(Assessment a, UUID studentId) {
        List<Attempt> mine = attempts.findByAssessmentAndStudent(a.getId(), studentId);
        Double best = mine.stream().filter(x -> x.getStatus() == AttemptStatus.GRADED)
                .map(x -> Grader.percent(x.getScore(), x.getMaxScore()))
                .max(Double::compare).orElse(null);
        UUID inProgress = mine.stream().filter(x -> x.getStatus() == AttemptStatus.IN_PROGRESS)
                .map(Attempt::getId).findFirst().orElse(null);
        return new LearnAssessmentDto(a.getInstructions(), a.getTimeLimitMinutes(), a.getMaxAttempts(),
                a.getPassingScore(), a.getQuestions().size(), a.totalPoints(), a.getAvailableFrom(),
                a.getAvailableUntil(), mine.size(), best, inProgress);
    }

    @Transactional
    public void complete(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = access.item(itemId, me, now);
        if (!progress.existsByStudentIdAndItemId(me.id(), item.getId())) {
            progress.save(new ItemProgress(users.getReferenceById(me.id()), item, now));
        }
    }

    @Transactional
    public void uncomplete(CurrentUser me, UUID itemId) {
        ContentItem item = access.item(itemId, me, Instant.now(clock));
        progress.findByStudentIdAndItemId(me.id(), item.getId()).ifPresent(progress::delete);
    }
}
