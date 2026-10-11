package de.sprachweg.learning;

import de.sprachweg.common.persistence.BaseEntity;
import de.sprachweg.course.ContentItem;
import de.sprachweg.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "item_progress")
public class ItemProgress extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private ContentItem item;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected ItemProgress() {
    }

    public ItemProgress(User student, ContentItem item, Instant completedAt) {
        this.student = student;
        this.item = item;
        this.completedAt = completedAt;
    }

    public User getStudent() { return student; }
    public ContentItem getItem() { return item; }
    public Instant getCompletedAt() { return completedAt; }
}
