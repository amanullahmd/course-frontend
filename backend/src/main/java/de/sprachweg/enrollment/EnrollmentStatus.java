package de.sprachweg.enrollment;

public enum EnrollmentStatus {
    PENDING, APPROVED, REJECTED, WITHDRAWN, REVOKED;

    public boolean isActive() {
        return this == PENDING || this == APPROVED;
    }
}
