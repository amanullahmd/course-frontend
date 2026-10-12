package me.amanullah.course.flashcard;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.media.MediaAsset;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** One vocabulary card of a FLASHCARDS item (a deck). */
@Entity
@Table(name = "flashcards")
public class Flashcard extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ContentItem item;

    @Column(nullable = false, length = 500)
    private String front;

    @Column(nullable = false, length = 500)
    private String back;

    /** der, die or das (nouns); null otherwise. */
    @Column(length = 3)
    private String article;

    @Column(length = 200)
    private String plural;

    @Column(length = 1000)
    private String example;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audio_media_id")
    private MediaAsset audio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_media_id")
    private MediaAsset image;

    @Column(name = "sort_order", nullable = false)
    private int position;

    protected Flashcard() {
    }

    public Flashcard(ContentItem item) {
        this.item = item;
    }

    public ContentItem getItem() { return item; }
    public String getFront() { return front; }
    public void setFront(String front) { this.front = front; }
    public String getBack() { return back; }
    public void setBack(String back) { this.back = back; }
    public String getArticle() { return article; }
    public void setArticle(String article) { this.article = article; }
    public String getPlural() { return plural; }
    public void setPlural(String plural) { this.plural = plural; }
    public String getExample() { return example; }
    public void setExample(String example) { this.example = example; }
    public MediaAsset getAudio() { return audio; }
    public void setAudio(MediaAsset audio) { this.audio = audio; }
    public MediaAsset getImage() { return image; }
    public void setImage(MediaAsset image) { this.image = image; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
