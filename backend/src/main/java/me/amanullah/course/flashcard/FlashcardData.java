package me.amanullah.course.flashcard;

import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.flashcard.FlashcardDtos.LearnerCardDto;
import me.amanullah.course.flashcard.FlashcardDtos.LearnerDeckDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewCardDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewResultDto;
import me.amanullah.course.flashcard.FlashcardDtos.ReviewSessionDto;
import me.amanullah.course.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional database work of the learner side. Access checks (enrollment, visibility, release rules) happen
 * before, in {@link LearnerFlashcardService}, so that a rejected probe never poisons a surrounding transaction.
 */
@Component
public class FlashcardData {

    public static final int NEW_PER_DAY = 15;

    public record Deck(UUID id, String title) {
    }

    public record Counts(int due, int newCards) {
    }

    private final FlashcardRepository cards;
    private final FlashcardReviewRepository reviews;
    private final UserRepository users;
    private final FlashcardMapper mapper;

    public FlashcardData(FlashcardRepository cards, FlashcardReviewRepository reviews, UserRepository users,
                         FlashcardMapper mapper) {
        this.cards = cards;
        this.reviews = reviews;
        this.users = users;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public LearnerDeckDto deck(UUID studentId, UUID itemId, Instant now) {
        List<Flashcard> list = cards.findByItemIdOrderByPositionAsc(itemId);
        Map<UUID, FlashcardReview> byCard = new HashMap<>();
        if (!list.isEmpty()) {
            reviews.findByStudentIdAndCardIdIn(studentId, list.stream().map(Flashcard::getId).toList())
                    .forEach(r -> byCard.put(r.getCard().getId(), r));
        }
        int due = 0;
        List<LearnerCardDto> out = new ArrayList<>();
        for (Flashcard c : list) {
            FlashcardReview r = byCard.get(c.getId());
            if (r != null && !r.getDueAt().isAfter(now)) {
                due++;
            }
            out.add(new LearnerCardDto(c.getId(), c.getFront(), c.getBack(), c.getArticle(), c.getPlural(),
                    c.getExample(), mapper.media().toDto(c.getAudio()), mapper.media().toDto(c.getImage()),
                    r != null, r == null ? null : r.getDueAt()));
        }
        return new LearnerDeckDto(itemId, out, due, list.size() - byCard.size());
    }

    @Transactional(readOnly = true)
    public Counts counts(UUID studentId, List<Deck> decks, Instant now, Instant startOfDay) {
        if (decks.isEmpty()) {
            return new Counts(0, 0);
        }
        List<UUID> ids = decks.stream().map(Deck::id).toList();
        int due = (int) reviews.countDue(studentId, ids, now);
        int allowed = Math.max(0, NEW_PER_DAY - (int) reviews.countIntroducedSince(studentId, ids, startOfDay));
        return new Counts(due, (int) Math.min(allowed, cards.countUnseen(studentId, ids)));
    }

    @Transactional(readOnly = true)
    public ReviewSessionDto session(UUID studentId, UUID courseId, List<Deck> decks, int limit, Instant now,
                                    Instant startOfDay) {
        if (decks.isEmpty()) {
            return new ReviewSessionDto(courseId, List.of(), 0, 0, NEW_PER_DAY);
        }
        List<UUID> ids = decks.stream().map(Deck::id).toList();
        Map<UUID, String> titles = new HashMap<>();
        decks.forEach(d -> titles.put(d.id(), d.title()));
        Counts counts = counts(studentId, decks, now, startOfDay);
        List<ReviewCardDto> out = new ArrayList<>();
        for (FlashcardReview r : reviews.findDue(studentId, ids, now, PageRequest.of(0, limit))) {
            out.add(toCard(r.getCard(), titles, false, r.getIntervalDays()));
        }
        int room = Math.min(limit - out.size(), counts.newCards());
        if (room > 0) {
            for (Flashcard c : cards.findUnseen(studentId, ids, PageRequest.of(0, room))) {
                out.add(toCard(c, titles, true, 0));
            }
        }
        return new ReviewSessionDto(courseId, out, counts.due(), counts.newCards(), NEW_PER_DAY);
    }

    @Transactional
    public ReviewResultDto grade(UUID studentId, UUID cardId, Grade grade, Instant now) {
        Flashcard card = cards.findById(cardId).orElseThrow(() -> NotFoundException.of("Flashcard"));
        FlashcardReview review = reviews.findByStudentIdAndCardId(studentId, cardId)
                .orElseGet(() -> new FlashcardReview(card, users.getReferenceById(studentId), now));
        review.apply(Sm2Scheduler.next(review.state(), grade, now), now);
        reviews.save(review);
        return new ReviewResultDto(cardId, review.getDueAt(), review.getIntervalDays(), review.getEase(),
                review.getRepetitions(), review.getLapses());
    }

    private ReviewCardDto toCard(Flashcard c, Map<UUID, String> titles, boolean fresh, int intervalDays) {
        UUID deck = c.getItem().getId();
        return new ReviewCardDto(c.getId(), deck, titles.get(deck), c.getFront(), c.getBack(), c.getArticle(),
                c.getPlural(), c.getExample(), mapper.media().toDto(c.getAudio()), mapper.media().toDto(c.getImage()),
                fresh, intervalDays);
    }
}
