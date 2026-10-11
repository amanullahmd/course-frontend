package me.amanullah.course.course;

import me.amanullah.course.common.persistence.AuditedEntity;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.publication.Publishable;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "courses")
public class Course extends AuditedEntity implements Publishable {

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 300)
    private String subtitle;

    @Column(length = 1000000)
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cefr_level", nullable = false, length = 2)
    private CefrLevel level;

    @ElementCollection
    @CollectionTable(name = "course_tags", joinColumns = @JoinColumn(name = "course_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "tag", nullable = false, length = 50)
    private List<String> tags = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_image_id")
    private MediaAsset coverImage;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instructor_id", nullable = false)
    private User instructor;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "enrollment_mode", nullable = false, length = 20)
    private EnrollmentMode enrollmentMode = EnrollmentMode.APPROVAL;

    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "publish_status", nullable = false, length = 20)
    private PublishStatus publishStatus = PublishStatus.DRAFT;

    @Column(name = "publish_at")
    private Instant publishAt;

    @Column(name = "unpublish_at")
    private Instant unpublishAt;

    /** First time the course was set to PUBLISHED. */
    @Column(name = "published_at")
    private Instant publishedAt;

    @OneToMany(mappedBy = "course")
    @OrderBy("position ASC")
    private List<CourseModule> modules = new ArrayList<>();

    protected Course() {
    }

    public Course(User instructor, String slug) {
        this.instructor = instructor;
        this.slug = slug;
    }

    @Override
    public void setPublishStatus(PublishStatus status) {
        this.publishStatus = status;
        if (status == PublishStatus.PUBLISHED && publishedAt == null) {
            publishedAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        }
    }

    /** Effective publication date shown in the catalog. */
    public Instant effectivePublishedAt() {
        return publishAt != null ? publishAt : publishedAt;
    }

    public String getSlug() { return slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSubtitle() { return subtitle; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public CefrLevel getLevel() { return level; }
    public void setLevel(CefrLevel level) { this.level = level; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags.clear(); this.tags.addAll(tags); }
    public MediaAsset getCoverImage() { return coverImage; }
    public void setCoverImage(MediaAsset coverImage) { this.coverImage = coverImage; }
    public User getInstructor() { return instructor; }
    public EnrollmentMode getEnrollmentMode() { return enrollmentMode; }
    public void setEnrollmentMode(EnrollmentMode enrollmentMode) { this.enrollmentMode = enrollmentMode; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    @Override public PublishStatus getPublishStatus() { return publishStatus; }
    @Override public Instant getPublishAt() { return publishAt; }
    @Override public void setPublishAt(Instant publishAt) { this.publishAt = publishAt; }
    @Override public Instant getUnpublishAt() { return unpublishAt; }
    @Override public void setUnpublishAt(Instant unpublishAt) { this.unpublishAt = unpublishAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public List<CourseModule> getModules() { return modules; }
}
