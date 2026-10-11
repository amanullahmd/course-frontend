package me.amanullah.course.course;

import me.amanullah.course.common.persistence.AuditedEntity;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.publication.Publishable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "course_modules")
public class CourseModule extends AuditedEntity implements Publishable {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 5000)
    private String description;

    @Column(name = "sort_order", nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "publish_status", nullable = false, length = 20)
    private PublishStatus publishStatus = PublishStatus.DRAFT;

    @Column(name = "publish_at")
    private Instant publishAt;

    @Column(name = "unpublish_at")
    private Instant unpublishAt;

    @OneToMany(mappedBy = "module")
    @OrderBy("position ASC")
    private List<ContentItem> items = new ArrayList<>();

    protected CourseModule() {
    }

    public CourseModule(Course course, String title, String description, int position) {
        this.course = course;
        this.title = title;
        this.description = description;
        this.position = position;
    }

    public Course getCourse() { return course; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    @Override public PublishStatus getPublishStatus() { return publishStatus; }
    @Override public void setPublishStatus(PublishStatus publishStatus) { this.publishStatus = publishStatus; }
    @Override public Instant getPublishAt() { return publishAt; }
    @Override public void setPublishAt(Instant publishAt) { this.publishAt = publishAt; }
    @Override public Instant getUnpublishAt() { return unpublishAt; }
    @Override public void setUnpublishAt(Instant unpublishAt) { this.unpublishAt = unpublishAt; }
    public List<ContentItem> getItems() { return items; }
}
