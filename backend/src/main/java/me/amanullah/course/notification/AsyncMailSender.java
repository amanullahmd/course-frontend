package me.amanullah.course.notification;

import me.amanullah.course.config.AppProperties;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/** Delivers mail via SMTP when {@code app.mail.enabled=true}; otherwise logs the full message (dev). */
@Component
public class AsyncMailSender {

    private static final Logger log = LoggerFactory.getLogger(AsyncMailSender.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final AppProperties props;

    public AsyncMailSender(ObjectProvider<JavaMailSender> mailSender, AppProperties props) {
        this.mailSender = mailSender;
        this.props = props;
    }

    @Async
    public void send(String to, EmailTemplates.Email email) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!props.mail().enabled() || sender == null) {
            log.info("""

                    ===== E-MAIL (mail delivery disabled) =====
                    To:      {}
                    Subject: {}
                    -------------------------------------------
                    {}
                    ===========================================""", to, email.subject(), email.text());
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            InternetAddress[] from = InternetAddress.parse(props.mail().from());
            helper.setFrom(from[0]);
            helper.setTo(to);
            helper.setSubject(email.subject());
            helper.setText(email.text(), email.html());
            sender.send(message);
            log.info("Sent e-mail '{}' to {}", email.subject(), to);
        } catch (Exception e) {
            log.error("Failed to send e-mail '{}' to {}: {}", email.subject(), to, e.getMessage(), e);
        }
    }
}
