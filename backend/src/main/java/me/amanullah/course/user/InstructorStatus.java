package me.amanullah.course.user;

/**
 * Review state of an INSTRUCTOR account ({@code null} for students and admins). PENDING and REJECTED instructors
 * can log in and edit their profile, but cannot create or change courses (403 INSTRUCTOR_NOT_APPROVED).
 */
public enum InstructorStatus {
    PENDING, APPROVED, REJECTED
}
