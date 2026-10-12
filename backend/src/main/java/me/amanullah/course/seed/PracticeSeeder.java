package me.amanullah.course.seed;

import me.amanullah.course.assignment.Assignment;
import me.amanullah.course.assignment.AssignmentRepository;
import me.amanullah.course.assignment.AssignmentSubmission;
import me.amanullah.course.assignment.SubmissionRepository;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.CourseModuleRepository;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.flashcard.Flashcard;
import me.amanullah.course.flashcard.FlashcardRepository;
import me.amanullah.course.live.AttendanceStatus;
import me.amanullah.course.live.LiveAttendance;
import me.amanullah.course.live.LiveAttendanceRepository;
import me.amanullah.course.live.LiveSession;
import me.amanullah.course.live.LiveSessionRepository;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Adds a vocabulary deck, an assignment and two live sessions to the demo course "Deutsch A1" once the base demo
 * data exists (runs after the application started, so after {@link DevDataSeeder}).
 */
@Component
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class PracticeSeeder {

    private static final Logger log = LoggerFactory.getLogger(PracticeSeeder.class);
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    private final UserRepository users;
    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final FlashcardRepository cards;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final LiveSessionRepository sessions;
    private final LiveAttendanceRepository attendance;
    private final TransactionTemplate tx;
    private final Clock clock;

    public PracticeSeeder(UserRepository users, CourseRepository courses, CourseModuleRepository modules,
                          ContentItemRepository items, FlashcardRepository cards, AssignmentRepository assignments,
                          SubmissionRepository submissions, LiveSessionRepository sessions,
                          LiveAttendanceRepository attendance, TransactionTemplate tx, Clock clock) {
        this.users = users;
        this.courses = courses;
        this.modules = modules;
        this.items = items;
        this.cards = cards;
        this.assignments = assignments;
        this.submissions = submissions;
        this.sessions = sessions;
        this.attendance = attendance;
        this.tx = tx;
        this.clock = clock;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        try {
            tx.executeWithoutResult(s -> run());
        } catch (RuntimeException e) {
            log.warn("Practice demo data could not be seeded: {}", e.toString());
        }
    }

    private void run() {
        User anna = users.findByEmailIgnoreCase("lehrer@sprachweg.de").orElse(null);
        if (anna == null) {
            return;
        }
        Course a1 = courses.findByInstructorIdOrderByUpdatedAtDesc(anna.getId()).stream()
                .filter(c -> c.getTitle().startsWith("Deutsch A1")).findFirst().orElse(null);
        if (a1 == null || sessions.count() > 0) {
            return;
        }
        Instant now = Instant.now(clock);
        List<CourseModule> mods = modules.findByCourseIdOrderByPositionAsc(a1.getId());
        if (mods.size() < 2) {
            return;
        }

        // ---- vocabulary deck in the module "Artikel und Zahlen"
        CourseModule m2 = mods.get(1);
        ContentItem deck = item(m2, ItemType.FLASHCARDS, "Vokabeln: Nomen mit Artikel",
                "Zwölf Wörter für die Wohnung – mit Artikel und Plural",
                "<p>Lerne die Nomen <strong>immer mit Artikel</strong>. Klicke in der Wiederholung auf die Karte "
                        + "oder drücke die Leertaste, um sie umzudrehen.</p>", 10);
        String[][] vocab = {
                {"Tisch", "table", "der", "Tische", "Der Tisch ist aus Holz."},
                {"Lampe", "lamp", "die", "Lampen", "Die Lampe steht neben dem Sofa."},
                {"Buch", "book", "das", "Bücher", "Ich lese ein Buch."},
                {"Stuhl", "chair", "der", "Stühle", "Bitte nimm den Stuhl."},
                {"Tür", "door", "die", "Türen", "Mach bitte die Tür zu."},
                {"Fenster", "window", "das", "Fenster", "Das Fenster ist offen."},
                {"Apfel", "apple", "der", "Äpfel", "Ich esse einen Apfel."},
                {"Banane", "banana", "die", "Bananen", "Die Banane ist gelb."},
                {"Wasser", "water", "das", null, "Ich trinke ein Glas Wasser."},
                {"Katze", "cat", "die", "Katzen", "Die Katze schläft auf dem Sofa."},
                {"Hund", "dog", "der", "Hunde", "Der Hund bellt laut."},
                {"Haus", "house", "das", "Häuser", "Wir wohnen in einem kleinen Haus."}};
        for (int i = 0; i < vocab.length; i++) {
            Flashcard c = new Flashcard(deck);
            c.setFront(vocab[i][0]);
            c.setBack(vocab[i][1]);
            c.setArticle(vocab[i][2]);
            c.setPlural(vocab[i][3]);
            c.setExample(vocab[i][4]);
            c.setPosition(i);
            cards.save(c);
        }

        // ---- assignment in the module "Hallo! Begrüßen und vorstellen"
        CourseModule m1 = mods.get(0);
        ContentItem task = item(m1, ItemType.ASSIGNMENT, "Schreibaufgabe: Stell dich vor",
                "Schreibe 5 bis 6 Sätze über dich – gern mit Foto oder Audio",
                "<p>Stell dich in <strong>5 bis 6 Sätzen</strong> vor: Name, Herkunft, Wohnort, Beruf und Hobbys. "
                        + "Du kannst den Text direkt eingeben oder eine Datei hochladen.</p>", 20);
        Assignment assignment = new Assignment(task);
        assignment.setDueAt(now.plus(Duration.ofDays(5)));
        assignment.setMaxPoints(10);
        assignment.setMaxFiles(2);
        assignment.setMaxSubmissions(3);
        assignments.save(assignment);
        users.findByEmailIgnoreCase("emma@sprachweg.de").ifPresent(emma -> {
            AssignmentSubmission s = new AssignmentSubmission(assignment, emma, 1, now.minus(Duration.ofHours(20)), false);
            s.setTextAnswer("Hallo! Ich heiße Emma und komme aus Schweden. Ich wohne seit einem Jahr in Berlin. "
                    + "Ich arbeite als Designerin. Meine Hobbys sind Radfahren und Kochen.");
            submissions.save(s);
        });

        // ---- live sessions: one coming up (2 days, 18:00 Berlin), one in the past with recording and attendance
        Instant upcoming = now.atZone(BERLIN).toLocalDate().plusDays(2).atTime(LocalTime.of(18, 0))
                .atZone(BERLIN).toInstant();
        LiveSession next = new LiveSession(a1);
        next.setTitle("Sprechstunde: Aussprache üben");
        next.setDescription("Wir üben gemeinsam die Aussprache von ä, ö, ü und ch. Bringt eure Fragen mit!");
        next.setStartsAt(upcoming);
        next.setDurationMinutes(60);
        next.setJoinUrl("https://meet.example.org/sprachweg-a1");
        sessions.save(next);

        LiveSession past = new LiveSession(a1);
        past.setTitle("Kennenlernen und Kursstart");
        past.setDescription("Wir lernen uns kennen und besprechen den Ablauf des Kurses.");
        past.setStartsAt(now.minus(Duration.ofDays(6)).atZone(BERLIN).toLocalDate().atTime(LocalTime.of(18, 0))
                .atZone(BERLIN).toInstant());
        past.setDurationMinutes(45);
        past.setJoinUrl("https://meet.example.org/sprachweg-a1");
        past.setRecordingUrl("https://meet.example.org/recordings/sprachweg-a1-kickoff");
        sessions.save(past);
        users.findByEmailIgnoreCase("student@sprachweg.de")
                .ifPresent(luca -> attendance.save(new LiveAttendance(past.getId(), luca.getId(), AttendanceStatus.PRESENT)));
        users.findByEmailIgnoreCase("emma@sprachweg.de")
                .ifPresent(emma -> attendance.save(new LiveAttendance(past.getId(), emma.getId(), AttendanceStatus.LATE)));
        log.info("Seeded a flashcard deck, an assignment and live sessions in \"{}\"", a1.getTitle());
    }

    private ContentItem item(CourseModule module, ItemType type, String title, String summary, String body,
                             int minutes) {
        ContentItem i = new ContentItem(module, type, (int) items.countByModuleId(module.getId()));
        i.setTitle(title);
        i.setSummary(summary);
        i.setBody(body);
        i.setDurationMinutes(minutes);
        i.setPublishStatus(PublishStatus.PUBLISHED);
        return items.save(i);
    }
}
