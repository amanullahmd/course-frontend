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

    public Email attemptGraded(User to, String itemTitle, String link) {
        return build(to, "mail.graded", link, null, itemTitle);
    }

    public String link(String path) {
        return props.frontendUrl() + path;
    }

    private Email build(User to, String prefix, String link, String reason, Object... args) {
        Locale locale = to.preferredLocale();
        String subject = messages.get(locale, prefix + ".subject", args);
        String message = messages.get(locale, prefix + ".message", args);
        if (reason != null && !reason.isBlank()) {
            message = message + " " + messages.get(locale, "mail.reason", reason);
        }
        String cta = messages.get(locale, prefix + ".cta", args);
        String greeting = messages.get(locale, "mail.greeting", to.getFullName());
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
