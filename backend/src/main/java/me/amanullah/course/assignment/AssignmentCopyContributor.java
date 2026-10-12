package me.amanullah.course.assignment;

import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ItemCopyContributor;
import me.amanullah.course.course.ItemType;
import java.time.Instant;
import java.util.function.UnaryOperator;
import org.springframework.stereotype.Component;

/** Cloning an ASSIGNMENT item copies its settings (the due date goes through the schedule shift). Submissions stay. */
@Component
public class AssignmentCopyContributor implements ItemCopyContributor {

    private final AssignmentRepository assignments;

    public AssignmentCopyContributor(AssignmentRepository assignments) {
        this.assignments = assignments;
    }

    @Override
    public void copy(ContentItem source, ContentItem target, UnaryOperator<Instant> dates) {
        if (source.getType() != ItemType.ASSIGNMENT) {
            return;
        }
        assignments.findByItemId(source.getId()).ifPresent(a -> {
            Assignment copy = new Assignment(target);
            copy.setDueAt(a.getDueAt() == null ? null : dates.apply(a.getDueAt()));
            copy.setAllowLate(a.isAllowLate());
            copy.setMaxPoints(a.getMaxPoints());
            copy.setMaxFiles(a.getMaxFiles());
            copy.setMaxSubmissions(a.getMaxSubmissions());
            copy.setAllowText(a.isAllowText());
            assignments.save(copy);
        });
    }
}
