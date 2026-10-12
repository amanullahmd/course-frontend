package me.amanullah.course.assignment;

import me.amanullah.course.common.persistence.BaseEntity;
import me.amanullah.course.course.ContentItem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Settings of an ASSIGNMENT item (the instructions are the item's body). */
@Entity
@Table(name = "assignments")
public class Assignment extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false, unique = true)
    private ContentItem item;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "allow_late", nullable = false)
    private boolean allowLate = true;

    @Column(name = "max_points", nullable = false)
    private int maxPoints = 10;

    @Column(name = "max_files", nullable = false)
    private int maxFiles = 3;

    @Column(name = "max_submissions", nullable = false)
    private int maxSubmissions = 3;

    @Column(name = "allow_text", nullable = false)
    private boolean allowText = true;

    protected Assignment() {
    }

    public Assignment(ContentItem item) {
        this.item = item;
    }

    public ContentItem getItem() { return item; }
    public Instant getDueAt() { return dueAt; }
    public void setDueAt(Instant dueAt) { this.dueAt = dueAt; }
    public boolean isAllowLate() { return allowLate; }
    public void setAllowLate(boolean allowLate) { this.allowLate = allowLate; }
    public int getMaxPoints() { return maxPoints; }
    public void setMaxPoints(int maxPoints) { this.maxPoints = maxPoints; }
    public int getMaxFiles() { return maxFiles; }
    public void setMaxFiles(int maxFiles) { this.maxFiles = maxFiles; }
    public int getMaxSubmissions() { return maxSubmissions; }
    public void setMaxSubmissions(int maxSubmissions) { this.maxSubmissions = maxSubmissions; }
    public boolean isAllowText() { return allowText; }
    public void setAllowText(boolean allowText) { this.allowText = allowText; }
}
