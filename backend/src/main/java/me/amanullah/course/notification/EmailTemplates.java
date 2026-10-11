package me.amanullah.course.notification;

import me.amanullah.course.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/** Simple, inline-styled HTML e-mails (German) with plain-text alternatives. */
@Component
public class EmailTemplates {

    public record Email(String subject, String html, String text) {
    }

    private final AppProperties props;

    public EmailTemplates(AppProperties props) {
        this.props = props;
    }

    public Email verifyEmail(String name, String link) {
        return build("Bitte bestätige deine E-Mail-Adresse", name,
                "willkommen bei Sprachweg! Bitte bestätige deine E-Mail-Adresse, damit du dich anmelden kannst. "
                        + "Der Link ist 24 Stunden gültig.",
                "E-Mail bestätigen", link);
    }

    public Email passwordReset(String name, String link) {
        return build("Passwort zurücksetzen", name,
                "wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Der Link ist eine Stunde gültig "
                        + "und kann nur einmal verwendet werden. Falls du das nicht warst, ignoriere diese E-Mail einfach.",
                "Neues Passwort festlegen", link);
    }

    public Email newApplication(String instructorName, String studentName, String courseTitle, String link) {
        return build("Neue Bewerbung für „" + courseTitle + "“", instructorName,
                studentName + " möchte am Kurs „" + courseTitle + "“ teilnehmen. Du kannst die Bewerbung in deiner "
                        + "Warteliste annehmen oder ablehnen.",
                "Warteliste öffnen", link);
    }

    public Email enrollmentApproved(String name, String courseTitle, String link) {
        return build("Du bist dabei: „" + courseTitle + "“", name,
                "gute Nachrichten! Deine Bewerbung für „" + courseTitle + "“ wurde angenommen. Viel Erfolg beim Lernen!",
                "Jetzt loslernen", link);
    }

    public Email enrollmentRejected(String name, String courseTitle, String reason, String link) {
        String text = "leider wurde deine Bewerbung für „" + courseTitle + "“ abgelehnt."
                + (reason == null || reason.isBlank() ? "" : " Begründung: " + reason);
        return build("Deine Bewerbung für „" + courseTitle + "“", name, text, "Weitere Kurse entdecken", link);
    }

    public Email enrollmentRevoked(String name, String courseTitle, String reason, String link) {
        String text = "dein Zugang zum Kurs „" + courseTitle + "“ wurde beendet."
                + (reason == null || reason.isBlank() ? "" : " Begründung: " + reason);
        return build("Zugang zu „" + courseTitle + "“ beendet", name, text, "Zu meinen Kursen", link);
    }

    public Email attemptGraded(String name, String itemTitle, String link) {
        return build("Dein Ergebnis für „" + itemTitle + "“ ist da", name,
                "deine Abgabe für „" + itemTitle + "“ wurde bewertet. Sieh dir jetzt dein Ergebnis und das Feedback an.",
                "Ergebnis ansehen", link);
    }

    public String link(String path) {
        return props.frontendUrl() + path;
    }

    private Email build(String subject, String name, String message, String cta, String link) {
        String esc = HtmlUtils.htmlEscape(message);
        String html = """
                <!doctype html>
                <html lang="de"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
                <tr><td align="center">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
                <tr><td style="background:#1e3a8a;padding:20px 32px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">Sprachweg</td></tr>
                <tr><td style="padding:32px">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">%s</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hallo %s,</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6">%s</p>
                <p style="margin:0 0 24px"><a href="%s" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px">%s</a></p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br><a href="%s" style="color:#1e3a8a;word-break:break-all">%s</a></p>
                </td></tr>
                <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa">Sprachweg · Dein Weg zur deutschen Sprache</td></tr>
                </table></td></tr></table></body></html>
                """.formatted(HtmlUtils.htmlEscape(subject), HtmlUtils.htmlEscape(name), esc,
                HtmlUtils.htmlEscape(link), HtmlUtils.htmlEscape(cta), HtmlUtils.htmlEscape(link), HtmlUtils.htmlEscape(link));
        String text = "Hallo " + name + ",\n\n" + message + "\n\n" + cta + ": " + link + "\n\n— Sprachweg";
        return new Email(subject, html, text);
    }
}
