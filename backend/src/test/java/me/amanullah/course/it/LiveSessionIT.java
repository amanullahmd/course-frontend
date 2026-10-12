package me.amanullah.course.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import me.amanullah.course.live.LiveReminderJob;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** Live sessions: join window, series across DST, attendance, cancellation, reminders and the iCal feed. */
class LiveSessionIT extends PracticeTestSupport {

    private static final String JOIN = "https://meet.example.org/secret-room";

    @Autowired
    LiveReminderJob reminders;

    private Map<String, Object> body(String title, Instant start, int minutes, String join, String recording,
                                     boolean cancelled) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("description", "Beschreibung, mit Komma; und Semikolon");
        m.put("startsAt", start == null ? null : start.toString());
        m.put("durationMinutes", minutes);
        m.put("joinUrl", join);
        m.put("recordingUrl", recording);
        m.put("cancelled", cancelled);
        return m;
    }

    private String create(Setup s, String title, Instant start, int minutes, String recording, boolean cancelled)
            throws Exception {
        return read(mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + s.courseId() + "/live-sessions"),
                body(title, start, minutes, JOIN, recording, cancelled)), s.teacher()))
                .andExpect(status().isCreated()).andReturn(), "$.id");
    }

    private static List<String> unfold(String ics) {
        String[] raw = ics.split("\r\n", -1);
        List<String> lines = new ArrayList<>();
        for (String r : raw) {
            if (r.startsWith(" ") && !lines.isEmpty()) {
                lines.set(lines.size() - 1, lines.get(lines.size() - 1) + r.substring(1));
            } else if (!r.isEmpty()) {
                lines.add(r);
            }
        }
        return lines;
    }

    private int notifications(String token, String type) throws Exception {
        MvcResult r = mvc.perform(auth(get("/api/notifications?size=100"), token)).andReturn();
        List<String> types = read(r, "$.content[*].type");
        return (int) types.stream().filter(type::equals).count();
    }

    @Test
    void joinUrlIsOnlyVisibleToEnrolledLearnersInTheJoinWindow() throws Exception {
        Setup s = course();
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        String soon = create(s, "Gleich", now.plus(Duration.ofMinutes(10)), 60, null, false);
        String later = create(s, "Später", now.plus(Duration.ofHours(2)), 60, null, false);
        String running = create(s, "Läuft", now.minus(Duration.ofMinutes(30)), 60, null, false);
        String ended = create(s, "Vorbei", now.minus(Duration.ofHours(3)), 60, "https://rec.example.org/1", false);
        String cancelled = create(s, "Abgesagt", now.plus(Duration.ofMinutes(5)), 60, null, true);
        String student = learner(s, "lv-stud");
        String outsider = signUp(uniqueEmail("lv-out"), "STUDENT");
        String list = "/api/student/courses/" + s.courseId() + "/live-sessions";

        MvcResult r = mvc.perform(auth(get(list), student)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5)).andReturn();
        List<Map<String, Object>> sessions = read(r, "$");
        Map<String, Map<String, Object>> byTitle = new HashMap<>();
        sessions.forEach(x -> byTitle.put((String) x.get("title"), x));
        assertThat(byTitle.get("Gleich").get("joinUrl")).isEqualTo(JOIN);
        assertThat(byTitle.get("Läuft").get("joinUrl")).isEqualTo(JOIN);
        assertThat(byTitle.get("Später").get("joinUrl")).isNull();
        assertThat(byTitle.get("Vorbei").get("joinUrl")).isNull();
        assertThat(byTitle.get("Abgesagt").get("joinUrl")).isNull();
        assertThat(byTitle.get("Abgesagt").get("cancelled")).isEqualTo(true);
        assertThat(byTitle.get("Vorbei").get("recordingUrl")).isEqualTo("https://rec.example.org/1");
        assertThat(byTitle.get("Später").get("joinOpensAt")).isNotNull();
        assertThat(r.getResponse().getContentAsString()).doesNotContain("secret-room\"" + "x");
        // sorted by start
        assertThat(sessions.stream().map(x -> x.get("title"))).containsExactly("Vorbei", "Läuft", "Abgesagt", "Gleich", "Später");

        // not enrolled / pending / anonymous
        mvc.perform(auth(get(list), outsider)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ENROLLED"));
        mvc.perform(get(list)).andExpect(status().isUnauthorized());
        mvc.perform(auth(get("/api/student/courses/" + UUID.randomUUID() + "/live-sessions"), student))
                .andExpect(status().isNotFound());
        mvc.perform(auth(get("/api/student/live-sessions/upcoming"), outsider)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // upcoming: not ended, not cancelled, ordered
        MvcResult up = mvc.perform(auth(get("/api/student/live-sessions/upcoming"), student)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3)).andReturn();
        List<String> titles = read(up, "$[*].title");
        assertThat(titles).containsExactly("Läuft", "Gleich", "Später");
        assertThat((String) read(up, "$[0].courseTitle")).isEqualTo("Übungskurs");

        // the instructor sees all join URLs
        mvc.perform(auth(get("/api/instructor/courses/" + s.courseId() + "/live-sessions"), s.teacher()))
                .andExpect(jsonPath("$.length()").value(5)).andExpect(jsonPath("$[?(@.title=='Später')].joinUrl").value(JOIN));

        // APPROVAL courses: a pending application sees nothing
        String teacher2 = signUp(uniqueEmail("lv-t2"), "INSTRUCTOR");
        String approvalCourse = liveCourse(teacher2, "Mit Freigabe", "APPROVAL");
        mvc.perform(auth(jsonBody(post("/api/instructor/courses/" + approvalCourse + "/live-sessions"),
                body("Geheim", now.plus(Duration.ofMinutes(5)), 30, JOIN, null, false)), teacher2)).andExpect(status().isCreated());
        apply(outsider, approvalCourse);
        mvc.perform(auth(get("/api/student/courses/" + approvalCourse + "/live-sessions"), outsider))
                .andExpect(status().isForbidden());
        assertThat(soon + later + running + ended + cancelled).isNotBlank();
    }

    @Test
    void validationOwnershipAndSeriesAcrossTheDstChange() throws Exception {
        Setup s = course();
        String other = signUp(uniqueEmail("lv-other"), "INSTRUCTOR");
        String student = learner(s, "lv-val");
        String base = "/api/instructor/courses/" + s.courseId() + "/live-sessions";
        Instant start = Instant.now().plus(Duration.ofDays(3));

        for (Map<String, Object> bad : List.of(body(" ", start, 60, null, null, false), body("T", null, 60, null, null, false),
                body("T", start, 4, null, null, false), body("T", start, 721, null, null, false),
                body("T", start, 60, "javascript:alert(1)", null, false), body("T", start, 60, null, "ftp://x.org/a", false),
                body("T", start, 60, "not a url", null, false), body("x".repeat(201), start, 60, null, null, false))) {
            mvc.perform(auth(jsonBody(post(base), bad), s.teacher())).andExpect(status().isBadRequest());
        }
        mvc.perform(auth(jsonBody(post(base), Map.of("title", "T", "startsAt", "gestern", "durationMinutes", 60)), s.teacher()))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post(base), body("T", start, 60, null, null, false)), other)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(post(base), body("T", start, 60, null, null, false)), student)).andExpect(status().isForbidden());
        mvc.perform(auth(get(base), other)).andExpect(status().isNotFound());
        mvc.perform(auth(get(base), student)).andExpect(status().isForbidden());

        // weekly series, wall-clock time stays 18:00 in Berlin although the clocks change on 25 Oct 2026
        Map<String, Object> series = new HashMap<>();
        series.put("title", "Montagskurs");
        series.put("firstStartsAt", "2026-10-17T16:00:00Z"); // Sat 18:00 CEST
        series.put("weeks", 4);
        series.put("durationMinutes", 90);
        series.put("joinUrl", JOIN);
        MvcResult created = mvc.perform(auth(jsonBody(post(base + "/series"), series), s.teacher()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.length()").value(4)).andReturn();
        List<String> starts = read(created, "$[*].startsAt");
        assertThat(starts.stream().map(Instant::parse).toList()).containsExactly(Instant.parse("2026-10-17T16:00:00Z"),
                Instant.parse("2026-10-24T16:00:00Z"), Instant.parse("2026-10-31T17:00:00Z"),
                Instant.parse("2026-11-07T17:00:00Z"));
        List<String> seriesIds = read(created, "$[*].seriesId");
        assertThat(seriesIds).hasSize(4).containsOnly(seriesIds.get(0));
        assertThat((String) read(created, "$[0].endsAt")).isEqualTo("2026-10-17T17:30:00Z");
        for (Object bad : List.of(0, 53, -1)) {
            Map<String, Object> b = new HashMap<>(series);
            b.put("weeks", bad);
            mvc.perform(auth(jsonBody(post(base + "/series"), b), s.teacher())).andExpect(status().isBadRequest());
        }
        mvc.perform(auth(jsonBody(post(base + "/series"), Map.of()), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(post(base + "/series"), series), other)).andExpect(status().isNotFound());

        // update / delete ownership and unknown ids
        String id = read(created, "$[0].id");
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + id), body("Neu", start, 45, null, null, false)), other))
                .andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + id), other)).andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + id), student)).andExpect(status().isForbidden());
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + UUID.randomUUID()),
                body("Neu", start, 45, null, null, false)), s.teacher())).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + id), body("Neu", start, 45, null, null, false)),
                s.teacher())).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Neu"))
                .andExpect(jsonPath("$.joinUrl").doesNotExist());
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + id), s.teacher())).andExpect(status().isNoContent());
        mvc.perform(auth(get(base), s.teacher())).andExpect(jsonPath("$.length()").value(3));

        // sessions are part of the instructor schedule
        MvcResult schedule = mvc.perform(auth(get("/api/instructor/schedule?courseId=" + s.courseId()
                + "&from=2026-10-01T00:00:00Z&to=2030-01-01T00:00:00Z"), s.teacher())).andExpect(status().isOk()).andReturn();
        List<String> actions = read(schedule, "$[?(@.entityType=='SESSION')].action");
        assertThat(actions).hasSize(3).containsOnly("SESSION");
    }

    @Test
    void attendanceIsRecordedForApprovedLearnersOnly() throws Exception {
        Setup s = course();
        String id = create(s, "Mit Anwesenheit", Instant.now().minus(Duration.ofHours(1)), 45, null, false);
        String anna = learner(s, "lv-anna");
        String ben = learner(s, "lv-ben");
        String outsider = signUp(uniqueEmail("lv-att-out"), "STUDENT");
        String other = signUp(uniqueEmail("lv-att-other"), "INSTRUCTOR");
        String annaId = read(mvc.perform(auth(get("/api/users/me"), anna)).andReturn(), "$.id");
        String benId = read(mvc.perform(auth(get("/api/users/me"), ben)).andReturn(), "$.id");
        String outsiderId = read(mvc.perform(auth(get("/api/users/me"), outsider)).andReturn(), "$.id");
        String url = "/api/instructor/live-sessions/" + id + "/attendance";

        mvc.perform(auth(get(url), s.teacher())).andExpect(status().isOk()).andExpect(jsonPath("$.rows.length()").value(2))
                .andExpect(jsonPath("$.rows[0].status").doesNotExist());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", annaId, "status", "PRESENT"),
                Map.of("studentId", benId, "status", "LATE")))), s.teacher())).andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[?(@.student.id=='" + annaId + "')].status").value("PRESENT"))
                .andExpect(jsonPath("$.rows[?(@.student.id=='" + benId + "')].status").value("LATE"));
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", benId, "status", "EXCUSED")))),
                s.teacher())).andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[?(@.student.id=='" + benId + "')].status").value("EXCUSED"))
                .andExpect(jsonPath("$.rows[?(@.student.id=='" + annaId + "')].status").value("PRESENT"));
        mvc.perform(auth(get("/api/instructor/courses/" + s.courseId() + "/live-sessions"), s.teacher()))
                .andExpect(jsonPath("$[0].attendanceRecorded").value(2)).andExpect(jsonPath("$[0].presentCount").value(1));
        // learners see their own status only
        mvc.perform(auth(get("/api/student/courses/" + s.courseId() + "/live-sessions"), anna))
                .andExpect(jsonPath("$[0].myAttendance").value("PRESENT"));
        mvc.perform(auth(get("/api/student/courses/" + s.courseId() + "/live-sessions"), ben))
                .andExpect(jsonPath("$[0].myAttendance").value("EXCUSED"));

        // bad entries
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", outsiderId, "status", "PRESENT")))),
                s.teacher())).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['entries[0].studentId']").exists());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", annaId, "status", "PRESENT"),
                Map.of("studentId", annaId, "status", "ABSENT")))), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", annaId, "status", "SICK")))),
                s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of(Map.of("studentId", "nope", "status", "PRESENT")))),
                s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(jsonBody(put(url), Map.of()), s.teacher())).andExpect(status().isBadRequest());
        mvc.perform(auth(get(url), other)).andExpect(status().isNotFound());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of())), other)).andExpect(status().isNotFound());
        mvc.perform(auth(get(url), anna)).andExpect(status().isForbidden());
        mvc.perform(auth(jsonBody(put(url), Map.of("entries", List.of())), anna)).andExpect(status().isForbidden());
    }

    @Test
    void cancellationAndRemindersNotifyLearnersInTheirLanguage() throws Exception {
        Setup s = course();
        String annaEmail = uniqueEmail("lv-rem-anna");
        String anna = signUp(annaEmail, "STUDENT");
        mvc.perform(auth(jsonBody(post("/api/student/courses/" + s.courseId() + "/enrollments"), Map.of()), anna))
                .andExpect(status().isCreated());
        setLocale(annaEmail, "de");
        String ben = learner(s, "lv-rem-ben");
        String outsider = signUp(uniqueEmail("lv-rem-out"), "STUDENT");
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);

        // ---- reminders: 24 hours ahead, once, only for sessions in range, not cancelled
        String inRange = create(s, "Morgen", now.plus(Duration.ofHours(23)), 60, null, false);
        create(s, "Übermorgen", now.plus(Duration.ofHours(30)), 60, null, false);
        create(s, "Abgesagt", now.plus(Duration.ofHours(22)), 60, null, true);
        create(s, "Vorbei", now.minus(Duration.ofHours(2)), 60, null, false);
        assertThat(reminders.sendDue(now)).isEqualTo(1);
        assertThat(notifications(anna, "LIVE_SESSION_REMINDER")).isEqualTo(1);
        assertThat(notifications(ben, "LIVE_SESSION_REMINDER")).isEqualTo(1);
        assertThat(notifications(outsider, "LIVE_SESSION_REMINDER")).isZero();
        MvcResult n = mvc.perform(auth(get("/api/notifications"), anna)).andReturn();
        assertThat((String) read(n, "$.content[0].title")).isEqualTo("Live-Unterricht bald: Morgen");
        assertThat((String) read(n, "$.content[0].link")).isEqualTo("/learn/" + s.courseId() + "/live");
        MvcResult nb = mvc.perform(auth(get("/api/notifications"), ben)).andReturn();
        assertThat((String) read(nb, "$.content[0].title")).isEqualTo("Live lesson coming up: Morgen");
        assertThat(reminders.sendDue(now)).isZero(); // idempotent
        assertThat(reminders.sendDue(now.plus(Duration.ofHours(8)))).isEqualTo(1); // "Übermorgen" is now in range
        // moving a session announces it again; editing other fields does not
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + inRange),
                body("Morgen (neu)", now.plus(Duration.ofHours(23)), 60, JOIN, null, false)), s.teacher())).andExpect(status().isOk());
        assertThat(reminders.sendDue(now)).isZero();
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + inRange),
                body("Morgen (neu)", now.plus(Duration.ofHours(20)), 60, JOIN, null, false)), s.teacher())).andExpect(status().isOk());
        assertThat(reminders.sendDue(now)).isEqualTo(1);

        // ---- cancellation: notifies once, also when deleting; past sessions are silent
        String future = create(s, "Wird abgesagt", now.plus(Duration.ofDays(5)), 60, null, false);
        int before = notifications(anna, "LIVE_SESSION_CANCELLED");
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + future),
                body("Wird abgesagt", now.plus(Duration.ofDays(5)), 60, JOIN, null, true)), s.teacher()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cancelled").value(true));
        assertThat(notifications(anna, "LIVE_SESSION_CANCELLED")).isEqualTo(before + 1);
        assertThat(notifications(outsider, "LIVE_SESSION_CANCELLED")).isZero();
        MvcResult cn = mvc.perform(auth(get("/api/notifications"), anna)).andReturn();
        assertThat((String) read(cn, "$.content[0].title")).isEqualTo("Live-Unterricht abgesagt: Wird abgesagt");
        mvc.perform(auth(jsonBody(put("/api/instructor/live-sessions/" + future),
                body("Wird abgesagt (nochmal)", now.plus(Duration.ofDays(5)), 60, JOIN, null, true)), s.teacher()))
                .andExpect(status().isOk());
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + future), s.teacher())).andExpect(status().isNoContent());
        assertThat(notifications(anna, "LIVE_SESSION_CANCELLED")).isEqualTo(before + 1);
        String future2 = create(s, "Wird gelöscht", now.plus(Duration.ofDays(6)), 60, null, false);
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + future2), s.teacher())).andExpect(status().isNoContent());
        assertThat(notifications(anna, "LIVE_SESSION_CANCELLED")).isEqualTo(before + 2);
        String past = create(s, "Alt", now.minus(Duration.ofDays(2)), 60, null, false);
        mvc.perform(auth(delete("/api/instructor/live-sessions/" + past), s.teacher())).andExpect(status().isNoContent());
        assertThat(notifications(anna, "LIVE_SESSION_CANCELLED")).isEqualTo(before + 2);
    }

    @Test
    void icalFeedIsTokenProtectedValidAndFreeOfJoinUrls() throws Exception {
        Setup s = course();
        String task = item(s, "ASSIGNMENT", "Schreibaufgabe, bitte");
        Instant due = Instant.now().plus(Duration.ofDays(4)).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        mvc.perform(auth(jsonBody(put("/api/instructor/items/" + task + "/assignment"), Map.of("dueAt", due.toString())),
                s.teacher())).andExpect(status().isOk());
        create(s, "Sprechstunde, Teil 1; Übung", Instant.now().plus(Duration.ofDays(1)).truncatedTo(java.time.temporal.ChronoUnit.SECONDS), 60, null, false);
        create(s, "Abgesagte Stunde", Instant.now().plus(Duration.ofDays(2)).truncatedTo(java.time.temporal.ChronoUnit.SECONDS), 60, null, true);
        String student = learner(s, "ic-stud");
        String outsider = signUp(uniqueEmail("ic-out"), "STUDENT");

        MvcResult t = mvc.perform(auth(get("/api/users/me/calendar-token"), student)).andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty()).andExpect(jsonPath("$.url").isNotEmpty()).andReturn();
        String token = read(t, "$.token");
        String url = read(t, "$.url");
        assertThat(url).endsWith("/api/calendar/" + token + ".ics");
        assertThat((String) read(mvc.perform(auth(get("/api/users/me/calendar-token"), student)).andReturn(), "$.token"))
                .isEqualTo(token); // stable until rotated
        mvc.perform(get("/api/users/me/calendar-token")).andExpect(status().isUnauthorized());

        // the feed needs no login, even a stale bearer token does not matter
        MvcResult feed = mvc.perform(get("/api/calendar/" + token + ".ics").header("Authorization", "Bearer garbage"))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("text/calendar")).andReturn();
        String ics = feed.getResponse().getContentAsString();
        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).doesNotContain("secret-room").doesNotContain("meet.example.org");
        List<String> lines = unfold(ics);
        assertThat(lines.stream().filter("BEGIN:VEVENT"::equals).count()).isEqualTo(3);
        assertThat(lines).contains("SUMMARY:[Übungskurs] Sprechstunde\\, Teil 1\\; Übung",
                "SUMMARY:Due: Schreibaufgabe\\, bitte [Übungskurs]", "STATUS:CANCELLED");
        assertThat(lines).anyMatch(l -> l.startsWith("DTSTART:") && l.endsWith("Z"));
        assertThat(lines).anyMatch(l -> l.equals("URL:http://localhost:3000/learn/" + s.courseId()));
        assertThat(lines.stream().filter(l -> l.startsWith("UID:")).distinct().count()).isEqualTo(3);

        // other people get their own (empty) calendar
        String otherToken = read(mvc.perform(auth(get("/api/users/me/calendar-token"), outsider)).andReturn(), "$.token");
        assertThat(otherToken).isNotEqualTo(token);
        String otherIcs = mvc.perform(get("/api/calendar/" + otherToken + ".ics")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(otherIcs).doesNotContain("BEGIN:VEVENT");
        // the instructor's feed contains the own course
        String teacherToken = read(mvc.perform(auth(get("/api/users/me/calendar-token"), s.teacher())).andReturn(), "$.token");
        assertThat(mvc.perform(get("/api/calendar/" + teacherToken + ".ics")).andReturn().getResponse().getContentAsString())
                .contains("Sprechstunde");

        // unknown / malformed tokens are 404 and rotation invalidates the old URL
        mvc.perform(get("/api/calendar/" + "x".repeat(43) + ".ics")).andExpect(status().isNotFound());
        mvc.perform(get("/api/calendar/short.ics")).andExpect(status().isNotFound());
        mvc.perform(get("/api/calendar/" + "y".repeat(500) + ".ics")).andExpect(status().isNotFound());
        MvcResult rotated = mvc.perform(auth(post("/api/users/me/calendar-token"), student)).andExpect(status().isOk()).andReturn();
        String newToken = read(rotated, "$.token");
        assertThat(newToken).isNotEqualTo(token);
        mvc.perform(get("/api/calendar/" + token + ".ics")).andExpect(status().isNotFound());
        mvc.perform(get("/api/calendar/" + newToken + ".ics")).andExpect(status().isOk());
        mvc.perform(post("/api/users/me/calendar-token")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/calendar/" + newToken + ".ics")).andExpect(status().is4xxClientError());
    }
}
