package me.amanullah.course.seed;

import me.amanullah.course.assessment.Assessment;
import me.amanullah.course.assessment.AssessmentRepository;
import me.amanullah.course.assessment.Question;
import me.amanullah.course.assessment.QuestionOption;
import me.amanullah.course.assessment.QuestionType;
import me.amanullah.course.assessment.Scoring;
import me.amanullah.course.common.publication.PublishStatus;
import me.amanullah.course.common.web.Links;
import me.amanullah.course.common.util.SlugGenerator;
import me.amanullah.course.course.CefrLevel;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.ContentItemRepository;
import me.amanullah.course.course.Course;
import me.amanullah.course.course.CourseModule;
import me.amanullah.course.course.CourseModuleRepository;
import me.amanullah.course.course.CourseRepository;
import me.amanullah.course.course.EnrollmentMode;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.enrollment.Enrollment;
import me.amanullah.course.enrollment.EnrollmentRepository;
import me.amanullah.course.enrollment.EnrollmentStatus;
import me.amanullah.course.learning.ItemProgress;
import me.amanullah.course.learning.ItemProgressRepository;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.notification.NotificationService;
import me.amanullah.course.notification.NotificationType;
import me.amanullah.course.user.Role;
import me.amanullah.course.user.User;
import me.amanullah.course.user.UserRepository;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Seeds demo data (users, three German courses, quiz, exam, enrollments) when {@code app.seed.enabled=true} and the
 * database contains no users yet. All accounts use the password {@code Password123!}.
 */
@Component
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class DevDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);
    public static final String PASSWORD = "Password123!";

    private final UserRepository users;
    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final ContentItemRepository items;
    private final AssessmentRepository assessments;
    private final EnrollmentRepository enrollments;
    private final ItemProgressRepository progress;
    private final MediaService mediaService;
    private final NotificationService notifications;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate tx;
    private final Clock clock;

    public DevDataSeeder(UserRepository users, CourseRepository courses, CourseModuleRepository modules,
                         ContentItemRepository items, AssessmentRepository assessments,
                         EnrollmentRepository enrollments, ItemProgressRepository progress, MediaService mediaService,
                         NotificationService notifications, PasswordEncoder passwordEncoder, TransactionTemplate tx,
                         Clock clock) {
        this.users = users;
        this.courses = courses;
        this.modules = modules;
        this.items = items;
        this.assessments = assessments;
        this.enrollments = enrollments;
        this.progress = progress;
        this.mediaService = mediaService;
        this.notifications = notifications;
        this.passwordEncoder = passwordEncoder;
        this.tx = tx;
        this.clock = clock;
    }

    @Override
    public void run(String... args) {
        if (users.count() > 0) {
            log.info("Seed skipped: database already contains users");
            return;
        }
        tx.executeWithoutResult(status -> seed());
        log.info("Seeded demo data. Accounts (password '{}'): admin@sprachweg.de, lehrer@sprachweg.de, "
                + "student@sprachweg.de, sofia@sprachweg.de, mehmet@sprachweg.de, emma@sprachweg.de", PASSWORD);
    }

    private void seed() {
        Instant now = Instant.now(clock);
        String hash = passwordEncoder.encode(PASSWORD);
        user("Admin Sprachweg", "admin@sprachweg.de", hash, Role.ADMIN, null, "en");
        User anna = user("Anna Schneider", "lehrer@sprachweg.de", hash, Role.INSTRUCTOR,
                "DaF-Lehrerin aus Berlin mit über zehn Jahren Erfahrung. Ich unterrichte Deutsch von A1 bis C1 und "
                        + "bereite auf Goethe- und telc-Prüfungen vor.", "en");
        User luca = user("Luca Rossi", "student@sprachweg.de", hash, Role.STUDENT,
                "Ich komme aus Mailand und ziehe bald nach Berlin.", "de");
        User sofia = user("Sofia Martins", "sofia@sprachweg.de", hash, Role.STUDENT, null, "en");
        User mehmet = user("Mehmet Yılmaz", "mehmet@sprachweg.de", hash, Role.STUDENT, null, "en");
        User emma = user("Emma Johansson", "emma@sprachweg.de", hash, Role.STUDENT, null, "en");

        MediaAsset vocab = storeText(anna, "Vokabelliste_Begrüßungen.txt", SeedContent.VOCAB_FILE);

        // ---------------- Deutsch A1 ----------------
        Course a1 = course(anna, "Deutsch A1: Erste Schritte", "Begrüßen, vorstellen, zählen – dein Start ins Deutsche",
                SeedContent.A1_DESCRIPTION, CefrLevel.A1, List.of("Grundlagen", "Grammatik", "Alltag"),
                EnrollmentMode.APPROVAL, 20, PublishStatus.PUBLISHED, null);

        CourseModule a1m1 = module(a1, "Hallo! Begrüßen und vorstellen",
                "Die wichtigsten Begrüßungen und wie du dich auf Deutsch vorstellst.", 0, PublishStatus.PUBLISHED, null);
        ContentItem greet = item(a1m1, ItemType.TEXT, "Begrüßungen im Alltag", "Formell und informell grüßen",
                SeedContent.GREETINGS, 15, 0, PublishStatus.PUBLISHED, null);
        ContentItem intro = item(a1m1, ItemType.TEXT, "Sich vorstellen", "Name, Herkunft, Wohnort und Sprachen",
                SeedContent.INTRODUCE, 20, 1, PublishStatus.PUBLISHED, null);
        ContentItem vocabItem = item(a1m1, ItemType.DOCUMENT, "Vokabelliste: Begrüßungen",
                "Zum Ausdrucken und Wiederholen", "<p>Lade dir die Vokabelliste herunter und lerne jeden Tag zehn "
                        + "Wörter. Tipp: Sprich die Wörter laut aus!</p>", 10, 2, PublishStatus.PUBLISHED, null);
        vocabItem.setAttachments(List.of(vocab));
        ContentItem embed = item(a1m1, ItemType.EMBED, "DW: Deutsch lernen",
                "Kostenlose Übungen der Deutschen Welle", SeedContent.EMBED_BODY, 30, 3, PublishStatus.PUBLISHED, null);
        embed.setExternalUrl("https://learngerman.dw.com/de/overview");
        ContentItem quizItem = item(a1m1, ItemType.QUIZ, "Quiz: Begrüßungen und Artikel",
                "Teste dein Wissen – beliebig viele Versuche", "<p>Fünf kurze Fragen zu Modul 1 und 2.</p>", 10, 4,
                PublishStatus.PUBLISHED, null);
        seedQuiz(quizItem);
        ContentItem exercisesItem = item(a1m1, ItemType.QUIZ, "Übungen: Lücken, Wortbank, Zuordnen",
                "Sprachübungen mit Teilpunkten, Diktat und Sprechaufgabe", "<p>Je eine Aufgabe pro Übungstyp.</p>",
                15, 5, PublishStatus.PUBLISHED, null);
        seedLanguageExercises(exercisesItem, anna);

        CourseModule a1m2 = module(a1, "Artikel und Zahlen",
                "Der, die, das – und alles rund um Zahlen, Wochentage und Uhrzeit.", 1, PublishStatus.PUBLISHED, null);
        item(a1m2, ItemType.TEXT, "Der, die, das – das Genus", "Warum jedes Nomen einen Artikel hat",
                SeedContent.ARTICLES, 25, 0, PublishStatus.PUBLISHED, null);
        item(a1m2, ItemType.TEXT, "Zahlen von 0 bis 100", "Zählen, Telefonnummern, Preise", SeedContent.NUMBERS,
                20, 1, PublishStatus.PUBLISHED, null);
        item(a1m2, ItemType.TEXT, "Wochentage und Uhrzeit", "Wird in drei Tagen freigeschaltet", SeedContent.TIME,
                20, 2, PublishStatus.PUBLISHED, now.plus(Duration.ofDays(3)));

        CourseModule a1m3 = module(a1, "Abschluss A1", "Teste dein Können am Ende des Kurses.", 2,
                PublishStatus.PUBLISHED, null);
        ContentItem examItem = item(a1m3, ItemType.EXAM, "Abschlusstest A1", "30 Minuten, ein Versuch",
                "<p>Nimm dir Zeit und lies jede Frage genau. Die Schreibaufgabe wird von deiner Lehrerin bewertet.</p>",
                30, 0, PublishStatus.PUBLISHED, null);
        seedExam(examItem);
        item(a1m3, ItemType.TEXT, "Im Restaurant bestellen", "Entwurf – noch nicht veröffentlicht",
                "<p>Kommt bald: Bestellen, bezahlen und nach der Rechnung fragen.</p>", 20, 1, PublishStatus.DRAFT, null);

        // ---------------- Deutsch B1 ----------------
        Course b1 = course(anna, "Deutsch B1: Alltag & Beruf", "Über Erfahrungen sprechen und im Job überzeugen",
                SeedContent.B1_DESCRIPTION, CefrLevel.B1, List.of("Perfekt", "Beruf", "Schreiben"),
                EnrollmentMode.APPROVAL, 15, PublishStatus.PUBLISHED, null);
        CourseModule b1m1 = module(b1, "Über Vergangenes sprechen: das Perfekt",
                "Erzähle, was du erlebt hast – im Gespräch benutzt man fast immer das Perfekt.", 0,
                PublishStatus.PUBLISHED, null);
        item(b1m1, ItemType.TEXT, "Das Perfekt bilden", "haben/sein + Partizip II", SeedContent.PERFEKT, 30, 0,
                PublishStatus.PUBLISHED, null);
        item(b1m1, ItemType.TEXT, "haben oder sein?", "Bewegung, Zustandsänderung und Ausnahmen",
                SeedContent.HABEN_SEIN, 20, 1, PublishStatus.PUBLISHED, null);
        CourseModule b1m2 = module(b1, "Im Beruf", "Bewerbung, Vorstellungsgespräch und formelle E-Mails.", 1,
                PublishStatus.PUBLISHED, null);
        item(b1m2, ItemType.TEXT, "Formelle E-Mails schreiben", "Anrede, Aufbau, Grußformel", SeedContent.EMAIL,
                25, 0, PublishStatus.PUBLISHED, null);
        item(b1m2, ItemType.TEXT, "Das Vorstellungsgespräch", "Typische Fragen und gute Antworten",
                SeedContent.INTERVIEW, 25, 1, PublishStatus.PUBLISHED, null);

        // ---------------- Goethe B2 (draft) ----------------
        Course b2 = course(anna, "Prüfungsvorbereitung Goethe B2", "Strategien und Übungen für alle vier Module",
                "<p>Gezielte Vorbereitung auf das <strong>Goethe-Zertifikat B2</strong>: Lesen, Hören, Schreiben und "
                        + "Sprechen mit Musteraufgaben und Prüfungstipps.</p>",
                CefrLevel.B2, List.of("Prüfung", "Goethe", "B2"), EnrollmentMode.APPROVAL, 12, PublishStatus.DRAFT, null);
        CourseModule b2m1 = module(b2, "Modul Lesen", "Aufgabentypen und Lesestrategien.", 0,
                PublishStatus.PUBLISHED, now.plus(Duration.ofDays(7)));
        item(b2m1, ItemType.TEXT, "Prüfungsaufbau Goethe B2", "Was dich erwartet", SeedContent.GOETHE, 15, 0,
                PublishStatus.PUBLISHED, null);
        module(b2, "Modul Schreiben", "Forumsbeitrag und formelle Nachricht.", 1, PublishStatus.DRAFT, null);

        // ---------------- enrollments & progress ----------------
        enroll(a1, luca, EnrollmentStatus.APPROVED, "Ich ziehe bald nach Berlin und möchte Deutsch lernen!",
                now.minus(Duration.ofDays(10)));
        enroll(a1, emma, EnrollmentStatus.APPROVED, null, now.minus(Duration.ofDays(9)));
        enroll(a1, sofia, EnrollmentStatus.PENDING, "Ich fange gerade erst an – freue mich auf den Kurs.",
                now.minus(Duration.ofDays(2)));
        enroll(a1, mehmet, EnrollmentStatus.PENDING, "Ich brauche Deutsch für meine Arbeit in München.",
                now.minus(Duration.ofDays(1)));
        enroll(b1, emma, EnrollmentStatus.PENDING, "Ich habe A2 abgeschlossen.", now.minus(Duration.ofDays(3)));
        enroll(b1, luca, EnrollmentStatus.PENDING, "Ich möchte nach A1 direkt weitermachen.",
                now.minus(Duration.ofHours(30)));
        enroll(b1, sofia, EnrollmentStatus.PENDING, null, now.minus(Duration.ofHours(5)));

        progress.save(new ItemProgress(luca, greet, now.minus(Duration.ofDays(8))));
        progress.save(new ItemProgress(luca, intro, now.minus(Duration.ofDays(7))));

        // rendered in each recipient's language (Luca: German, Anna: English)
        notifications.notify(luca, NotificationType.ENROLLMENT_APPROVED, "notification.enrollmentApproved",
                Links.learnCourse(a1.getId()), null, a1.getTitle());
        notifications.notify(anna, NotificationType.ENROLLMENT_REQUESTED, "notification.enrollmentRequested",
                Links.instructorEnrollments(b1.getId()), null, sofia.getFullName(), b1.getTitle());
    }

    private User user(String name, String email, String hash, Role role, String bio, String locale) {
        User u = new User(name, email, hash, role);
        u.setLocale(locale);
        u.setEmailVerified(true);
        u.setBio(bio);
        return users.save(u);
    }

    private MediaAsset storeText(User owner, String name, String content) {
        try {
            return mediaService.store(owner.getId(), name, "text/plain; charset=UTF-8",
                    new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private Course course(User instructor, String title, String subtitle, String description, CefrLevel level,
                          List<String> tags, EnrollmentMode mode, Integer capacity, PublishStatus status,
                          Instant publishAt) {
        Course c = new Course(instructor, SlugGenerator.unique(title, courses::existsBySlug));
        c.setTitle(title);
        c.setSubtitle(subtitle);
        c.setDescription(description);
        c.setLevel(level);
        c.setTags(tags);
        c.setEnrollmentMode(mode);
        c.setCapacity(capacity);
        c.setPublishStatus(status);
        c.setPublishAt(publishAt);
        return courses.save(c);
    }

    private CourseModule module(Course course, String title, String description, int position, PublishStatus status,
                                Instant publishAt) {
        CourseModule m = new CourseModule(course, title, description, position);
        m.setPublishStatus(status);
        m.setPublishAt(publishAt);
        return modules.save(m);
    }

    private ContentItem item(CourseModule module, ItemType type, String title, String summary, String body,
                             Integer minutes, int position, PublishStatus status, Instant publishAt) {
        ContentItem i = new ContentItem(module, type, position);
        i.setTitle(title);
        i.setSummary(summary);
        i.setBody(body);
        i.setDurationMinutes(minutes);
        i.setPublishStatus(status);
        i.setPublishAt(publishAt);
        return items.save(i);
    }

    private void enroll(Course course, User student, EnrollmentStatus status, String message, Instant appliedAt) {
        Enrollment e = new Enrollment(course, student);
        e.apply(message, appliedAt);
        if (status != EnrollmentStatus.PENDING) {
            e.decide(status, null, appliedAt.plus(Duration.ofHours(6)));
        }
        enrollments.save(e);
    }

    private void seedQuiz(ContentItem item) {
        Assessment a = new Assessment(item);
        a.setInstructions("<p>Beantworte alle Fragen. Du kannst das Quiz so oft wiederholen, wie du möchtest.</p>");
        a.setMaxAttempts(0);
        a.setPassingScore(60);
        a.setShowCorrectAnswers(true);
        choice(a, 0, QuestionType.SINGLE_CHOICE, "Wie begrüßt man jemanden am Morgen höflich?",
                "„Guten Morgen“ sagt man bis etwa 10 Uhr.", 1,
                new String[]{"Guten Morgen!", "Gute Nacht!", "Tschüss!", "Bis später!"}, 0);
        choice(a, 1, QuestionType.MULTIPLE_CHOICE, "Welche Nomen haben den Artikel <strong>die</strong>?",
                "Die Lampe, die Frau, die Zeitung – aber: der Tisch, das Kind.", 2,
                new String[]{"Lampe", "Tisch", "Frau", "Kind", "Zeitung"}, 0, 2, 4);
        choice(a, 2, QuestionType.TRUE_FALSE, "„Das Mädchen“ ist grammatisch neutral.",
                "Alle Wörter auf -chen und -lein sind neutral.", 1, new String[]{"Richtig", "Falsch"}, 0);
        text(a, 3, QuestionType.SHORT_ANSWER, "Schreibe die Zahl 21 in Worten.",
                "Im Deutschen nennt man zuerst die Einer: einundzwanzig.", 1, "einundzwanzig");
        text(a, 4, QuestionType.FILL_BLANK, "Ergänze das Verb <em>sein</em>: „Ich ___ Luca.“",
                "ich bin, du bist, er/sie/es ist", 1, "bin");
        assessments.save(a);
    }

    /** One example of every language question type: cloze, word bank, matching, ordering, dictation and speaking. */
    private void seedLanguageExercises(ContentItem item, User owner) {
        Assessment a = new Assessment(item);
        a.setInstructions("<p>Hier übst du Lücken, Wortbank, Zuordnen, Ordnen, Hören und Sprechen. "
                + "Für die meisten Aufgaben gibt es <strong>Teilpunkte</strong>.</p>");
        a.setMaxAttempts(0);
        a.setPassingScore(60);
        a.setShowCorrectAnswers(true);

        Question cloze = question(a, 0, QuestionType.CLOZE,
                "Ergänze die Verbformen: Ich {{1}} gestern im Kino und {{2}} einen Film gesehen.",
                "Perfekt mit „haben“: ich habe ... gesehen. Aber: ich bin ... gewesen.", 4);
        cloze.setScoring(Scoring.PARTIAL);
        cloze.setLenientSpelling(true);
        cloze.setBlankAnswers(java.util.Map.of(1, List.of("war", "bin gewesen"), 2, List.of("habe")));
        a.getQuestions().add(cloze);

        Question bank = question(a, 1, QuestionType.WORD_BANK,
                "Wähle die richtigen Wörter: Das Mädchen {{1}} nach Berlin und {{2}} dort Deutsch.", null, 4);
        bank.setScoring(Scoring.PARTIAL);
        bank.setShuffleOptions(true);
        chip(bank, 0, "fährt", 1);
        chip(bank, 1, "lernt", 2);
        chip(bank, 2, "fahren", null);
        chip(bank, 3, "lernen", null);
        a.getQuestions().add(bank);

        Question matching = question(a, 2, QuestionType.MATCHING, "Ordne den Artikel dem Nomen zu.",
                "Merke dir Nomen immer mit Artikel.", 4);
        matching.setScoring(Scoring.PARTIAL);
        pair(matching, 0, "der", "Tisch");
        pair(matching, 1, "die", "Lampe");
        pair(matching, 2, "das", "Kind");
        pair(matching, 3, "die", "Zeitung");
        a.getQuestions().add(matching);

        Question ordering = question(a, 3, QuestionType.ORDERING,
                "Bringe die Satzteile in die richtige Reihenfolge.", "Im Hauptsatz steht das Verb an Position 2.", 4);
        ordering.setScoring(Scoring.PARTIAL);
        for (int i = 0; i < 4; i++) {
            QuestionOption o = new QuestionOption(ordering);
            o.setText(new String[]{"Morgen", "fahre", "ich", "nach Hamburg"}[i]);
            o.setPosition(i);
            ordering.getOptions().add(o);
        }
        a.getQuestions().add(ordering);

        Question dictation = question(a, 4, QuestionType.DICTATION,
                "Höre zu und schreibe den Satz auf (Demo: ein Signalton – in echten Kursen lädst du eine Aufnahme hoch).",
                "Umlaute dürfen als ae, oe, ue geschrieben werden.", 4);
        dictation.setScoring(Scoring.PARTIAL);
        dictation.setLenientSpelling(true);
        dictation.setAcceptedAnswers(List.of("Das Mädchen trinkt gern Tee."));
        dictation.setMedia(storeAudio(owner, "Diktat_Demo.wav"));
        a.getQuestions().add(dictation);

        Question speaking = question(a, 5, QuestionType.SPEAKING,
                "<p>Stell dich vor: Wie heißt du, woher kommst du und was machst du gern? Sprich etwa 30 Sekunden.</p>",
                null, 5);
        speaking.setMaxRecordingSeconds(60);
        a.getQuestions().add(speaking);
        assessments.save(a);
    }

    private static Question question(Assessment a, int pos, QuestionType type, String prompt, String explanation,
                                     int points) {
        Question q = new Question(a);
        q.setType(type);
        q.setPrompt(prompt);
        q.setExplanation(explanation);
        q.setPoints(points);
        q.setPosition(pos);
        return q;
    }

    private static void chip(Question q, int pos, String text, Integer blankIndex) {
        QuestionOption o = new QuestionOption(q);
        o.setText(text);
        o.setPosition(pos);
        o.setBlankIndex(blankIndex);
        o.setCorrect(blankIndex != null);
        q.getOptions().add(o);
    }

    /** A MATCHING pair: {@code text} is shown on the left, {@code matchText} is what it has to be matched with. */
    private static void pair(Question q, int pos, String matchText, String text) {
        QuestionOption o = new QuestionOption(q);
        o.setText(text);
        o.setMatchText(matchText);
        o.setPosition(pos);
        q.getOptions().add(o);
    }

    /** A short two-tone beep as a stand-in for a spoken sentence (16-bit mono WAV). */
    private MediaAsset storeAudio(User owner, String name) {
        int rate = 8000;
        int samples = rate * 2;
        java.nio.ByteBuffer buf = java.nio.ByteBuffer.allocate(44 + samples * 2).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        buf.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + samples * 2)
                .put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
                .putInt(rate).putInt(rate * 2).putShort((short) 2).putShort((short) 16)
                .put("data".getBytes(StandardCharsets.US_ASCII)).putInt(samples * 2);
        for (int i = 0; i < samples; i++) {
            double t = i / (double) rate;
            double freq = (int) (t * 4) % 2 == 0 ? 440 : 554;
            double envelope = Math.min(1, Math.min(t * 4 % 1, 1 - t * 4 % 1) * 8);
            buf.putShort((short) (Math.sin(2 * Math.PI * freq * t) * envelope * 9000));
        }
        try {
            return mediaService.store(owner.getId(), name, "audio/wav", new ByteArrayInputStream(buf.array()));
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private void seedExam(ContentItem item) {
        Assessment a = new Assessment(item);
        a.setInstructions("<p>Du hast <strong>30 Minuten</strong> Zeit und einen Versuch. Viel Erfolg!</p>");
        a.setTimeLimitMinutes(30);
        a.setMaxAttempts(1);
        a.setPassingScore(60);
        a.setShowCorrectAnswers(false);
        choice(a, 0, QuestionType.SINGLE_CHOICE, "Welcher Artikel passt? „___ Buch ist spannend.“", null, 2,
                new String[]{"Der", "Die", "Das"}, 2);
        text(a, 1, QuestionType.FILL_BLANK, "Ergänze das Verb <em>kommen</em>: „Wir ___ aus Italien.“", null, 2,
                "kommen");
        Question essay = new Question(a);
        essay.setType(QuestionType.ESSAY);
        essay.setPrompt("<p>Stell dich in 5–6 Sätzen vor: Name, Herkunft, Wohnort, Beruf und Hobbys.</p>");
        essay.setPoints(10);
        essay.setPosition(2);
        a.getQuestions().add(essay);
        assessments.save(a);
    }

    private static void choice(Assessment a, int pos, QuestionType type, String prompt, String explanation, int points,
                               String[] options, int... correct) {
        Question q = new Question(a);
        q.setType(type);
        q.setPrompt(prompt);
        q.setExplanation(explanation);
        q.setPoints(points);
        q.setPosition(pos);
        for (int i = 0; i < options.length; i++) {
            QuestionOption o = new QuestionOption(q);
            o.setText(options[i]);
            o.setPosition(i);
            final int idx = i;
            o.setCorrect(java.util.Arrays.stream(correct).anyMatch(c -> c == idx));
            q.getOptions().add(o);
        }
        a.getQuestions().add(q);
    }

    private static void text(Assessment a, int pos, QuestionType type, String prompt, String explanation, int points,
                             String... accepted) {
        Question q = new Question(a);
        q.setType(type);
        q.setPrompt(prompt);
        q.setExplanation(explanation);
        q.setPoints(points);
        q.setPosition(pos);
        q.setAcceptedAnswers(List.of(accepted));
        a.getQuestions().add(q);
    }
}
