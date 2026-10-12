package me.amanullah.course.flashcard;

import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ItemCopyContributor;
import me.amanullah.course.course.ItemType;
import java.time.Instant;
import java.util.function.UnaryOperator;
import org.springframework.stereotype.Component;

/** Cloning a FLASHCARDS item copies its cards (media is shared by reference); learners' review state stays. */
@Component
public class FlashcardCopyContributor implements ItemCopyContributor {

    private final FlashcardRepository cards;

    public FlashcardCopyContributor(FlashcardRepository cards) {
        this.cards = cards;
    }

    @Override
    public void copy(ContentItem source, ContentItem target, UnaryOperator<Instant> dates) {
        if (source.getType() != ItemType.FLASHCARDS) {
            return;
        }
        for (Flashcard c : cards.findByItemIdOrderByPositionAsc(source.getId())) {
            Flashcard copy = new Flashcard(target);
            copy.setFront(c.getFront());
            copy.setBack(c.getBack());
            copy.setArticle(c.getArticle());
            copy.setPlural(c.getPlural());
            copy.setExample(c.getExample());
            copy.setAudio(c.getAudio());
            copy.setImage(c.getImage());
            copy.setPosition(c.getPosition());
            cards.save(copy);
        }
    }
}
