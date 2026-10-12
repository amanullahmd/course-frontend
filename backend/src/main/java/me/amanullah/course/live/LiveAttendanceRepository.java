package me.amanullah.course.live;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LiveAttendanceRepository extends JpaRepository<LiveAttendance, LiveAttendance.Key> {

    List<LiveAttendance> findBySessionId(UUID sessionId);

    List<LiveAttendance> findByStudentIdAndSessionIdIn(UUID studentId, Collection<UUID> sessionIds);

    Optional<LiveAttendance> findBySessionIdAndStudentId(UUID sessionId, UUID studentId);

    List<LiveAttendance> findBySessionIdIn(Collection<UUID> sessionIds);
}
