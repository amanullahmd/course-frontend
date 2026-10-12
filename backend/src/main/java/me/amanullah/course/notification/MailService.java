package me.amanullah.course.notification;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Entry point for sending e-mails. Inside a transaction the mail is only dispatched after a successful commit;
 * the actual delivery happens asynchronously so requests never block on SMTP.
 */
@Service
public class MailService {

    private final AsyncMailSender sender;

    public MailService(AsyncMailSender sender) {
        this.sender = sender;
    }

    public void send(String to, EmailTemplates.Email email) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sender.send(to, email);
                }
            });
        } else {
            sender.send(to, email);
        }
    }
}
