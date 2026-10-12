package me.amanullah.course.flashcard;

import me.amanullah.course.common.exception.ApiException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.publication.Visibility;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.flashcard.FlashcardData.Counts;
import me.amanullah.course.flashcard.FlashcardData.Deck;
import me.amanullah.course.flashcard.FlashcardDtos.CourseDueDto;
import me.amanullah.course.flashcard.FlashcardDtos.LearnerDeckDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewResultDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewSessionDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewSummaryDto;
import me.amanullah.course.learning.LearnerAccess;
import me.amanullah.course.learning.ProgressService;
import me.amanullah.course.security.CurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Learner side of the flashcards: deck browsing, the review queue of a course and grading. Deliberately not
 * {@code @Transactional}: every visibility probe through {@link LearnerAccess} (which also enforces the release
 * rules of the course) runs in its own transaction, so a rejected deck is simply skipped.
 */
@Service
public class LearnerFlashcardService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Berlin");
    static final int DEFAULT_LIMIT = 20;
    static final int MAX_LIMIT = 100;

    private final LearnerAccess access;
    private final ProgressService progressService;
    private final EnrollmentRepository enrollments;
    private final FlashcardRepository cards;
    private final FlashcardData data;
    private final Clock clock;

    public LearnerFlashcardService(LearnerAccess access, ProgressService progressService,
                                   EnrollmentRepository enrollments, FlashcardRepository cards, FlashcardData data,
                                   Clock clock) {
        this.access = access;
        this.progressService = progressService;
        this.enrollments = enrollments;
        this.cards = cards;
        this.data = data;
        this.clock = clock;
    }

    public LearnerDeckDto deck(CurrentUser me, UUID itemId) {
        Instant now = Instant.now(clock);
        ContentItem item = access.item(itemId, me, now);
        FlashcardService.requireDeck(item);
        return data.deck(me.id(), item.getId(), now);
    }

    public ReviewSessionDto session(CurrentUser me, UUID courseId, Integer limit) {
        Instant now = Instant.now(clock);
        access.course(courseId, me, now);
        int n = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, limit));
        return data.session(me.id(), courseId, visibleDecks(me, courseId, now), n, now, startOfDay(now));
    }

    public ReviewResultDto grade(CurrentUser me, UUID cardId, Grade grade) {
        Instant now = Instant.now(clock);
        UUID itemId = cards.findItemId(cardId).stream().findFirst()
                .orElseThrow(() -> NotFoundException.of("Flashcard"));
        access.item(itemId, me, now);
        return data.grade(me.id(), cardId, grade, now);
    }

    public ReviewSummaryDto summary(CurrentUser me) {
        Instant now = Instant.now(clock);
        Instant start = startOfDay(now);
        List<CourseDueDto> byCourse = new ArrayList<>();
        int total = 0;
        for (Enrollment e : enrollments.findByStudent(me.id())) {
            if (e.getStatus() != EnrollmentStatus.APPROVED || !Visibility.isLive(e.getCourse(), now)) {
                continue;
            }
            Counts c = data.counts(me.id(), visibleDecks(me, e.getCourse().getId(), now), now, start);
            if (c.due() + c.newCards() > 0) {
                byCourse.add(new CourseDueDto(e.getCourse().getId(), e.getCourse().getTitle(), c.due(), c.newCards()));
                total += c.due() + c.newCards();
            }
        }
        return new ReviewSummaryDto(total, byCourse);
    }

    /** Live FLASHCARDS items of the course that this learner may open right now. */
    private List<Deck> visibleDecks(CurrentUser me, UUID courseId, Instant now) {
        List<Deck> decks = new ArrayList<>();
        for (ContentItem item : progressService.liveItems(List.of(courseId), now).getOrDefault(courseId, List.of())) {
            if (item.getType() != ItemType.FLASHCARDS) {
                continue;
            }
            try {
                access.item(item.getId(), me, now);
                decks.add(new Deck(item.getId(), item.getTitle()));
            } catch (ApiException e) {
                // not reachable for this learner (e.g. locked by a release rule): its cards are not part of the queue
            }
        }
        return decks;
    }

    static Instant startOfDay(Instant now) {
        return now.atZone(ZONE).toLocalDate().atStartOfDay(ZONE).toInstant();
    }
}
