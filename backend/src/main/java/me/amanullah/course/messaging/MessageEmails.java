package me.amanullah.course.messaging;

import java.util.Locale;
import me.amanullah.course.common.i18n.Messages;
import me.amanullah.course.config.AppProperties;
import me.amanullah.course.notification.EmailTemplates.Email;
import me.amanullah.course.user.User;
import org.springframework.stereotype.Component;

/** "You have a new message from X" in the recipient's language, with a short preview and a reply link. */
@Component
public class MessageEmails {

    private final AppProperties props;
    private final Messages messages;

    public MessageEmails(AppProperties props, Messages messages) {
        this.props = props;
        this.messages = messages;
    }

    public Email newMessage(User to, User from, String courseTitle, String preview, String path) {
        Locale locale = to.preferredLocale();
        String link = props.frontendUrl() + path;
        String subject = messages.get(locale, "mail.message.subject", from.getFullName());
        String greeting = messages.get(locale, "mail.greeting", to.getFullName());
        String intro = courseTitle == null
                ? messages.get(locale, "mail.message.message", from.getFullName())
                : messages.get(locale, "mail.message.messageCourse", from.getFullName(), courseTitle);
        String cta = messages.get(locale, "mail.message.cta");
        String footer = messages.get(locale, "mail.message.footer");
        String quote = preview == null ? "" : preview;
        String content = MailLayout.paragraph(greeting) + MailLayout.paragraph(intro)
                + "<blockquote style=\"margin:16px 0 0;padding:12px 16px;border-left:3px solid #1e3a8a;background:#f8fafc;"
                + "font-size:15px;line-height:1.6;color:#3f3f46;white-space:pre-line\">" + MailLayout.esc(quote)
                + "</blockquote>";
        String html = MailLayout.render(locale.getLanguage(), subject, content, cta, link,
                messages.get(locale, "mail.linkHint"), footer);
        String text = greeting + "\n\n" + intro + "\n\n> " + quote + "\n\n" + cta + ": " + link + "\n\n-- \n" + footer;
        return new Email(subject, html, text);
    }
}
