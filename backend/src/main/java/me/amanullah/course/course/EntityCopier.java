package me.amanullah.course.course;

import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import java.lang.reflect.Field;
import java.util.Collection;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Copies the plain columns of an entity to a fresh instance using the JPA metamodel, so columns added to an entity
 * later are cloned without touching the cloner: basic attributes and element collections are copied, many-to-one
 * references (e.g. media) are shared, everything else must be skipped by name (children are copied explicitly).
 */
@Component
public class EntityCopier {

    private static final Logger log = LoggerFactory.getLogger(EntityCopier.class);

    private final EntityManager em;

    public EntityCopier(EntityManager em) {
        this.em = em;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <T> void copyColumns(Class<T> type, T source, T target, Set<String> skip) {
        EntityType<T> entity = em.getMetamodel().entity(type);
        for (Attribute<? super T, ?> attribute : entity.getAttributes()) {
            String name = attribute.getName();
            if (name.equals("id") || skip.contains(name)) {
                continue;
            }
            if (!(attribute.getJavaMember() instanceof Field field)) {
                continue;
            }
            try {
                field.setAccessible(true);
                switch (attribute.getPersistentAttributeType()) {
                    case BASIC, MANY_TO_ONE -> field.set(target, field.get(source));
                    case ELEMENT_COLLECTION -> {
                        Collection from = (Collection) field.get(source);
                        Collection to = (Collection) field.get(target);
                        if (from != null && to != null) {
                            to.clear();
                            to.addAll(from);
                        }
                    }
                    default -> log.warn("Attribute {}.{} is not copied by the course cloner", type.getSimpleName(), name);
                }
            } catch (IllegalAccessException e) {
                throw new IllegalStateException("Cannot copy " + type.getSimpleName() + "." + name, e);
            }
        }
    }
}
