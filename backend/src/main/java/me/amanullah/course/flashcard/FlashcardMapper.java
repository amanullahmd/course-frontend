package me.amanullah.course.flashcard;

import me.amanullah.course.flashcard.FlashcardDtos.FlashcardDto;
import me.amanullah.course.media.MediaMapper;
import org.springframework.stereotype.Component;

@Component
public class FlashcardMapper {

    private final MediaMapper media;

    public FlashcardMapper(MediaMapper media) {
        this.media = media;
    }

    public FlashcardDto toDto(Flashcard c) {
        return new FlashcardDto(c.getId(), c.getFront(), c.getBack(), c.getArticle(), c.getPlural(), c.getExample(),
                media.toDto(c.getAudio()), media.toDto(c.getImage()), c.getPosition());
    }

    public MediaMapper media() {
        return media;
    }
}
