package me.amanullah.course.notification;

import java.util.Locale;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.user.User;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * Simple, inline-styled HTML e-mails with plain-text alternatives, rendered in the recipient's preferred language
 * (keys {@code mail.*} in {@code messages*.properties}).
 */
@Component
public class EmailTemplates {

    public record Email(String subject, String html, String text) {
    }

    private final AppProperties props;
    private final Messages messages;

    public EmailTemplates(AppProperties props, Messages messages) {
        this.props = props;
        this.messages = messages;
    }

    public Email verifyEmail(User to, String link) {
        return build(to, "mail.verify", link, null);
    }

    public Email passwordReset(User to, String link) {
        return build(to, "mail.reset", link, null);
    }

    public Email newApplication(User instructor, String studentName, String courseTitle, String link) {
        return build(instructor, "mail.newApplication", link, null, courseTitle, studentName);
    }

    public Email enrollmentApproved(User to, String courseTitle, String link) {
        return build(to, "mail.approved", link, null, courseTitle);
    }

    public Email enrollmentRejected(User to, String courseTitle, String reason, String link) {
        return build(to, "mail.rejected", link, reason, courseTitle);
    }

    public Email enrollmentRevoked(User to, String courseTitle, String reason, String link) {
        return build(to, "mail.revoked", link, reason, courseTitle);
    }

    /** Access granted again after a removal or withdrawal. */
    public Email enrollmentRestored(User to, String courseTitle, String link) {
        return build(to, "mail.restored", link, null, courseTitle);
    }

    /** The instructor added the learner directly; {@code note} is the instructor's optional personal message. */
    public Email enrollmentAdded(User to, String courseTitle, String instructorName, String note, String link) {
        Locale locale = to.preferredLocale();
        return build(locale, messages.get(locale, "mail.greeting", to.getFullName()), "mail.added", link,
                noteLine(locale, instructorName, note), courseTitle, instructorName);
    }

    /** Invitation to register, for an address without an account (rendered in {@code locale}). */
    public Email courseInvitation(Locale locale, String courseTitle, String instructorName, String note, String link) {
        return build(locale, messages.get(locale, "mail.greetingNoName"), "mail.invite", link,
                noteLine(locale, instructorName, note), courseTitle, instructorName);
    }

    public Email attemptGraded(User to, String itemTitle, String link) {
        return build(to, "mail.graded", link, null, itemTitle);
    }

    /** An assignment submission was graded or returned for revision. */
    public Email assignmentReviewed(User to, String itemTitle, boolean returned, String link) {
        return build(to, returned ? "mail.assignmentReturned" : "mail.assignmentGraded", link, null, itemTitle);
    }

    /** "Congratulations, your certificate is ready" with a link to the learner's certificate page. */
    public Email certificateIssued(User to, String courseTitle, String link) {
        return build(to, "mail.certificate", link, null, courseTitle);
    }

    /** Instructor account approved by an admin (security &amp; privacy). */
    public Email instructorApproved(User to, String link) {
        return build(to, "mail.instructorApproved", link, null);
    }

    /** Instructor account rejected by an admin; {@code reason} is optional. */
    public Email instructorRejected(User to, String reason, String link) {
        return build(to, "mail.instructorRejected", link, reason);
    }

    public String link(String path) {
        return props.frontendUrl() + path;
    }

    private String noteLine(Locale locale, String instructorName, String note) {
        return note == null || note.isBlank() ? null : messages.get(locale, "mail.note", instructorName, note.strip());
    }

    private Email build(User to, String prefix, String link, String reason, Object... args) {
        Locale locale = to.preferredLocale();
        String extra = reason != null && !reason.isBlank() ? messages.get(locale, "mail.reason", reason) : null;
        return build(locale, messages.get(locale, "mail.greeting", to.getFullName()), prefix, link, extra, args);
    }

    private Email build(Locale locale, String greeting, String prefix, String link, String extra, Object... args) {
        String subject = messages.get(locale, prefix + ".subject", args);
        String message = messages.get(locale, prefix + ".message", args);
        if (extra != null) {
            message = message + " " + extra;
        }
        String cta = messages.get(locale, prefix + ".cta", args);
        String linkHint = messages.get(locale, "mail.linkHint");
        String footer = messages.get(locale, "mail.footer");
        String signature = messages.get(locale, "mail.signature");
        String l = HtmlUtils.htmlEscape(link);
        String html = """
                <!doctype html>
                <html lang="%s"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
                <tr><td align="center">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
                <tr><td style="background:#1e3a8a;padding:20px 32px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">Sprachweg</td></tr>
                <tr><td style="padding:32px">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">%s</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6">%s</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6">%s</p>
                <p style="margin:0 0 24px"><a href="%s" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px">%s</a></p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a">%s<br><a href="%s" style="color:#1e3a8a;word-break:break-all">%s</a></p>
                <p style="margin:0;font-size:15px;line-height:1.6">%s</p>
                </td></tr>
                <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa">%s</td></tr>
                </table></td></tr></table></body></html>
                """.formatted(locale.getLanguage(), esc(subject), esc(greeting), esc(message), l, esc(cta),
                esc(linkHint), l, l, esc(signature), esc(footer));
        String text = greeting + "\n\n" + message + "\n\n" + cta + ": " + link + "\n\n" + signature + "\n-- \n" + footer;
        return new Email(subject, html, text);
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s);
    }
}
