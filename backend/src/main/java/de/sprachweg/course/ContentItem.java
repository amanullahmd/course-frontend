package de.sprachweg.course;

import de.sprachweg.common.persistence.AuditedEntity;
import de.sprachweg.common.publication.PublishStatus;
import de.sprachweg.common.publication.Publishable;
import de.sprachweg.media.MediaAsset;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "content_items")
public class ContentItem extends AuditedEntity implements Publishable {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "module_id", nullable = false)
    private CourseModule module;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "item_type", nullable = false, length = 20)
    private ItemType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String summary;

    @Column(length = 1000000)
    private String body;

    @Column(name = "external_url", length = 2000)
    private String externalUrl;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

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

    @ManyToMany
    @JoinTable(name = "content_item_attachments",
            joinColumns = @JoinColumn(name = "item_id"),
            inverseJoinColumns = @JoinColumn(name = "media_id"))
    @OrderColumn(name = "sort_order")
    private List<MediaAsset> attachments = new ArrayList<>();

    protected ContentItem() {
    }

    public ContentItem(CourseModule module, ItemType type, int position) {
        this.module = module;
        this.type = type;
        this.position = position;
    }

    public CourseModule getModule() { return module; }
    public void setModule(CourseModule module) { this.module = module; }
    public ItemType getType() { return type; }
    public void setType(ItemType type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getExternalUrl() { return externalUrl; }
    public void setExternalUrl(String externalUrl) { this.externalUrl = externalUrl; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    @Override public PublishStatus getPublishStatus() { return publishStatus; }
    @Override public void setPublishStatus(PublishStatus publishStatus) { this.publishStatus = publishStatus; }
    @Override public Instant getPublishAt() { return publishAt; }
    @Override public void setPublishAt(Instant publishAt) { this.publishAt = publishAt; }
    @Override public Instant getUnpublishAt() { return unpublishAt; }
    @Override public void setUnpublishAt(Instant unpublishAt) { this.unpublishAt = unpublishAt; }

    /** Attachments in order; gaps left by deleted media rows are skipped. */
    public List<MediaAsset> getAttachments() {
        return attachments.stream().filter(Objects::nonNull).toList();
    }

    public void setAttachments(List<MediaAsset> media) {
        attachments.clear();
        attachments.addAll(media);
    }
}
