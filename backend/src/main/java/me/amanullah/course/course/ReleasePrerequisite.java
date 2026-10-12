package me.amanullah.course.course;

import me.amanullah.course.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** "The target module/item opens only after {@code requiresItemId} is completed (optionally with a minimum score)." */
@Entity
@Table(name = "release_prerequisites")
public class ReleasePrerequisite extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 10)
    private ReleaseTarget targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "requires_item_id", nullable = false)
    private UUID requiresItemId;

    @Column(name = "min_percent")
    private Integer minPercent;

    protected ReleasePrerequisite() {
    }

    public ReleasePrerequisite(ReleaseTarget targetType, UUID targetId, UUID requiresItemId, Integer minPercent) {
        this.targetType = targetType;
        this.targetId = targetId;
        this.requiresItemId = requiresItemId;
        this.minPercent = minPercent;
    }

    public ReleaseTarget getTargetType() { return targetType; }
    public UUID getTargetId() { return targetId; }
    public UUID getRequiresItemId() { return requiresItemId; }
    public Integer getMinPercent() { return minPercent; }
}
