package me.amanullah.course.common.web;

import java.util.UUID;

/** Frontend paths used in notification links and e-mails (relative to {@code app.frontend-url}). */
public final class Links {

    private Links() {
    }

    public static String learnCourse(UUID courseId) {
        return "/learn/" + courseId;
    }

    public static String learnItem(UUID courseId, UUID itemId) {
        return "/learn/" + courseId + "/" + itemId;
    }

    /** Opens the result view of one attempt inside the learning player. */
    public static String learnAttempt(UUID courseId, UUID itemId, UUID attemptId) {
        return learnItem(courseId, itemId) + "?attempt=" + attemptId;
    }

    public static String publicCourse(String slug) {
        return "/courses/" + slug;
    }

    /** Registration with a pre-filled e-mail address that continues to {@code next} (a relative path) afterwards. */
    public static String register(String email, String next) {
        return "/register?email=" + java.net.URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8)
                + "&next=" + java.net.URLEncoder.encode(next, java.nio.charset.StandardCharsets.UTF_8);
    }

    public static String studentDashboard() {
        return "/dashboard";
    }

    public static String instructorEnrollments(UUID courseId) {
        return "/instructor/courses/" + courseId + "/enrollments";
    }

    public static String instructorAttempt(UUID attemptId) {
        return "/instructor/attempts/" + attemptId;
    }
}
