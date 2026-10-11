package me.amanullah.course.enrollment;

public enum EnrollmentStatus {
    PENDING, APPROVED, REJECTED, WITHDRAWN, REVOKED;

    public boolean isActive() {
        return this == PENDING || this == APPROVED;
    }
}
