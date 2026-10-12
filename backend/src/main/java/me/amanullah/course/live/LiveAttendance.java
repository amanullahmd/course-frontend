package me.amanullah.course.live;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "live_attendance")
@IdClass(LiveAttendance.Key.class)
public class LiveAttendance {

    public static class Key implements Serializable {
        private UUID sessionId;
        private UUID studentId;

        public Key() {
        }

        public Key(UUID sessionId, UUID studentId) {
            this.sessionId = sessionId;
            this.studentId = studentId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(sessionId, k.sessionId) && Objects.equals(studentId, k.studentId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(sessionId, studentId);
        }
    }

    @Id
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Id
    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private AttendanceStatus status;

    protected LiveAttendance() {
    }

    public LiveAttendance(UUID sessionId, UUID studentId, AttendanceStatus status) {
        this.sessionId = sessionId;
        this.studentId = studentId;
        this.status = status;
    }

    public UUID getSessionId() { return sessionId; }
    public UUID getStudentId() { return studentId; }
    public AttendanceStatus getStatus() { return status; }
    public void setStatus(AttendanceStatus status) { this.status = status; }
}
