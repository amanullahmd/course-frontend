package me.amanullah.course.announcement;

import java.util.Locale;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.common.util.HtmlSanitizer;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.messaging.MailLayout;
import me.amanullah.course.notification.EmailTemplates.Email;
import me.amanullah.course.user.User;
import org.springframework.stereotype.Component;

/**
 * Announcement e-mails in the recipient's language: subject {@code [Course] Title}, the sanitized HTML body and a
 * call to action that opens the course's announcement feed.
 */
@Component
public class AnnouncementEmails {

    private final AppProperties props;
    private final Messages messages;

    public AnnouncementEmails(AppProperties props, Messages messages) {
        this.props = props;
        this.messages = messages;
    }

    public Email announcement(User to, Announcement a, String path) {
        Locale locale = to.preferredLocale();
        String course = a.getCourse().getTitle();
        String author = a.getAuthor().getFullName();
        String link = props.frontendUrl() + path;
        String subject = "[" + course + "] " + a.getTitle();
        String greeting = messages.get(locale, "mail.greeting", to.getFullName());
        String intro = messages.get(locale, "mail.announcement.message", author, course);
        String cta = messages.get(locale, "mail.announcement.cta");
        String footer = messages.get(locale, "mail.announcement.footer", course);
        // the body was sanitized when it was saved; sanitizing again is cheap and keeps the e-mail safe on its own
        String body = HtmlSanitizer.sanitize(a.getBody());
        String content = MailLayout.paragraph(greeting) + MailLayout.paragraph(intro)
                + "<div style=\"margin:16px 0 0;padding:16px 20px;border-left:3px solid #1e3a8a;background:#f8fafc;"
                + "font-size:15px;line-height:1.6\">" + body + "</div>";
        String html = MailLayout.render(locale.getLanguage(), a.getTitle(), content, cta, link,
                messages.get(locale, "mail.linkHint"), footer);
        String text = greeting + "\n\n" + intro + "\n\n" + a.getTitle() + "\n\n" + HtmlSanitizer.toPlainText(body)
                + "\n\n" + cta + ": " + link + "\n\n-- \n" + footer;
        return new Email(subject, html, text);
    }
}
