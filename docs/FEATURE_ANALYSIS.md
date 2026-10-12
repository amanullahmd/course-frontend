# Sprachweg: feature analysis and roadmap

Product and architecture review, 12 Oct 2026. Goal from the owner: *"the most dynamic course system"* for German
language teaching by independent instructors and small schools.
Related: [STORY.md](STORY.md) (vision, stories), [PLAN.md](PLAN.md) (domain, API), [QA_REPORT.md](QA_REPORT.md).

Some features are being built in parallel right now. This document treats them as existing:

* strict exam timing (window, time limit, server autosave, auto-submit, open/close schedule events)
* GitHub Actions CI
* instructor reports (KPIs, joins over time, gradebook, per-learner report and PDF, per-question analytics, drop-off funnel, CSV)
* enrollment management (bulk remove, restore, add by e-mail, invite)
* announcements (scheduled, e-mail, read tracking) and instructor/learner direct messages
* the course Active/Inactive switch
* **course completion certificates** (auto-issued on criteria, PDF with QR verification, public verify page,
  instructor settings, revoke and manual issue). This one uses Flyway **V7**.

The migrations proposed here start at **V8**. The repository currently has V1, V2, V3 and V5. V4 and V6 are presumably
held by in-flight branches, so check before merging (see §5.6).

---

## TL;DR

Sprachweg already has a clean, well-tested core: modules and items of any type, three-level draft/publish/schedule
with visibility evaluated at request time, an approval-based enrollment flow, a learning player, quizzes and exams with
answers snapshotted per attempt, EN/DE everywhere, and good robustness. It is a **solid general course CMS**. It is
**not yet a language-learning platform**, and it is **not yet dynamic per learner**: every approved learner sees
exactly the same content at the same calendar time, and the only interactive practice is a six-type quiz with
all-or-nothing scoring.

The three things that would change that most:

1. **Per-learner release rules**: drip by days after enrollment, prerequisites with a minimum score, sequential
   progression, and required versus optional items. Add course, module and item **duplication and cloning** next to it.
2. **Language-specific exercise types with partial credit**: cloze with several blanks, word bank, matching, ordering,
   dictation with spelling tolerance, and **spoken answers** recorded in the browser and graded by the instructor.
3. **Practice loops that bring learners back**: vocabulary **flashcards with spaced repetition**, **assignments**
   with file submission, feedback and resubmission, and **live sessions** with iCal and attendance.

These are proposed as three parallel workstreams (§4). Payments, cohorts/groups, co-instructors and GDPR
self-service come right after (§3).

---

## 1. Current capability inventory

Maturity scale: **1** = missing, **2** = basic, **3** = solid for a single instructor, **4** = competitive,
**5** = best in class. Items marked *(in flight)* are being built by other agents.

| Area | What exists (code) | Notable gaps | Maturity |
|---|---|---|---|
| **Authoring** | `course/` (`Course`, `CourseModule`, `ContentItem`, `ContentService`): modules and items, Tiptap rich text, any number of attachments, dnd-kit reorder and move across modules (`builder/curriculum-board.tsx`, `module-card.tsx`, `item-row.tsx`), preview as student | No duplication or cloning, no templates, no versioning or undo, no bulk edit, no content reuse across courses | 3 |
| **Content types** | `ItemType`: TEXT, DOCUMENT (inline PDF/txt), VIDEO (upload or YouTube/Vimeo), AUDIO (speed control), IMAGE (gallery), EMBED (allow-list incl. H5P and LearningApps), QUIZ, EXAM | No interactive language exercises outside quizzes, no transcripts or captions, no flashcards, no assignments, no live sessions | 3 |
| **Publishing / scheduling** | `common/publication` (`Visibility.isLive`): draft/publish/schedule/auto-unpublish on course, module and item, evaluated at request time; calendar and agenda (`schedule/`, `instructor/schedule-view.tsx`); exam open/close events *(in flight)*; Active switch *(in flight)* | Absolute dates only. No relative drip, prerequisites, sequential unlock or per-learner/group release | 4 (absolute) / 1 (per learner) |
| **Enrollment** | `enrollment/`: APPROVAL/OPEN mode, capacity, waitlist by application time, approve/reject/revoke, bulk decisions, withdraw and re-apply; bulk remove, restore, add by e-mail and invitations *(in flight, V5)* | No automatic promotion from the waitlist, no groups or cohorts, no access expiry, no payments or coupons, no co-instructors | 3 |
| **Learning** | `learning/` (`LearnerAccess`, `LearningService`, `ProgressService`), `learn/learn-shell.tsx`, `learn-item-view.tsx`, `viewers.tsx`: outline, prev/next, mark complete, progress %, student dashboard | No "continue where I left off", notes, bookmarks, search, glossary, offline mode, or time-on-task tracking (`ItemProgress` stores only `completedAt`) | 3 |
| **Assessment** | `assessment/`: 6 question types (single, multiple, true/false, short answer, fill blank, essay), media per question, points, attempts limit, pass mark, question shuffle, show answers, timer, server autosave and auto-submit *(in flight)*, manual essay grading, full **question and option snapshot per attempt** (`AttemptAnswer`, `AnswerOptionSnapshot`) | `Grader` is all-or-nothing (no partial credit). One blank per FILL_BLANK. No matching, ordering, word bank, dictation or speaking. No question bank or random pools, option shuffle, regrade, per-learner extra time, rubrics, or tab-switch log | 3 |
| **Communication** | `notification/`: in-app bell, transactional e-mails via Resend (async), localized; announcements and DMs *(in flight)* | No per-lesson discussion or Q&A, no comments, no digests, no web push, no notification preferences | 2, rising to 3 |
| **Analytics** | `report/` *(in flight)*: KPIs, gradebook, per-learner, per-question, drop-off funnel, CSV | Based on completions and attempts only. No view or time events and no learner-facing analytics (skills, weak vocabulary) | 3 |
| **Admin** | `admin/`: user search, role change, enable/disable, platform stats | No audit log, course moderation, school/tenant, platform settings, instructor approval, or GDPR tools | 2 |
| **i18n** | next-intl EN/DE (about 1,200 keys, parity tested), backend `messages*.properties`, user locale for e-mails | Course content is single-language. No per-course "instruction language" and no glossary translations | 4 |
| **Platform / ops** | Docker Compose, Postgres 17, Flyway, OpenAPI, actuator health, virtual threads, CI *(in flight)* | Local disk storage only (`LocalFileStorage`), `@Scheduled` jobs not cluster-safe, no metrics or tracing, no rate limiting, Swagger public in prod, tests only on H2 | 2 to 3 |
| **Security** | JWT plus rotating hashed refresh cookie, account status checked on each request, signed media URLs, jsoup `HtmlSanitizer`, active file types forced to download, CSP frame-ancestors on media | No login or e-mail throttling. Anyone can self-register as INSTRUCTOR. No 2FA or SSO, no AV scan, no upload quota (any user can upload 500 MB of any type) | 3 |
| **Legal (DE)** | none found | No Impressum (§5 DDG), privacy policy (Datenschutzerklärung) or terms pages, no data export or account deletion | 1 |

**Honest summary.** The engineering quality is clearly above average for this stage: snapshotted attempts, request-time
visibility, RFC 7807 errors, i18n parity tests and a QA pass with 32 fixed bugs. Product depth is a different matter.
It sits roughly where Teachable or Thinkific were five years ago, minus payments, and well below Moodle or Canvas on
per-learner logic and assessment.

---

## 2. Benchmark

### 2.1 Feature matrix

Yes = native, Part = partial or plugin, No = absent. This is from general product knowledge as of 2026; details vary
by plan or edition.

| Capability | Moodle | Canvas | Teachable / Thinkific | Kajabi | Duolingo | Babbel | Goethe online¹ | **Sprachweg** |
|---|---|---|---|---|---|---|---|---|
| Absolute scheduling of content | Yes | Yes | Part | Part | – | – | Yes | **Yes** |
| Drip (days after enrollment) | Part | Part | Yes | Yes | – | – | Part | **No** |
| Prerequisites / completion gating | Yes (restrict access) | Yes (module requirements, mastery paths) | Yes | Part | Yes (path) | Yes (path) | Yes | **No** |
| Groups / cohorts with own dates | Yes | Yes (sections, differentiated dates) | Part (Thinkific cohorts) | Part | – | Part (Babbel Live) | Yes | **No** |
| Course / module duplication | Yes | Yes | Yes | Yes | – | – | Yes | **No** |
| Rich language exercises (cloze, matching, ordering, word bank) | Yes (+H5P) | Part | Part | No | Yes | Yes | Yes | **Part** (single blank) |
| Dictation / listening with typing | Part | Part | No | No | Yes | Yes | Yes | **Part** (audio + short answer) |
| Speaking: record and grade | Part (plugins) | Part (media recording) | No | No | Yes (ASR) | Yes (ASR) | Yes (tutor) | **No** |
| Vocabulary SRS | Part (plugins) | No | No | No | Yes | Yes (Review) | Part | **No** |
| Question bank and random pools | Yes | Yes | Part | No | – | – | Yes | **No** |
| Partial credit and rubrics | Yes | Yes | Part | No | – | – | Yes | **No** (essays only) |
| Accommodations (extra time) | Yes | Yes | No | No | – | – | Yes | **No** |
| Assignments with file and feedback | Yes | Yes (SpeedGrader) | Part | Part | – | – | Yes | **No** |
| Certificates with verification | Yes | Part | Yes | Yes | Part | Part | Yes | **Yes** *(in flight)* |
| Discussion / Q&A per lesson | Yes | Yes | Yes (comments) | Yes (community) | Part | No | Yes | **No** |
| Live classes, calendar, attendance | Part (BBB) | Part | Part | Yes (coaching, events) | Part | Yes (Babbel Live) | Yes | **No** |
| Gamification (streaks, XP, badges) | Part (badges) | No | No | Part | Yes (core) | Part | No | **No** |
| Payments, coupons, bundles | Part | No | Yes | Yes | Subscription | Subscription | Yes (shop) | **No** |
| Co-instructors / roles per course | Yes | Yes | Yes | Part | – | – | Yes | **No** |
| Organisation / school tenant | Yes | Yes | Part | No | – | B2B | Yes | **No** |
| SCORM / xAPI / LTI / H5P | Yes | Yes | No | No | – | – | Part | **Part** (H5P embed only) |
| Mobile app or PWA, offline | Yes (app) | Yes (app) | Yes (app) | Yes (app) | Yes | Yes | Part | **No** (responsive web) |
| Placement test | Part | Part | No | No | Yes | Yes | Yes (Einstufungstest) | **No** |
| Reports and gradebook | Yes | Yes | Yes | Yes | – | – | Yes | **Yes** *(in flight)* |
| Announcements and messaging | Yes | Yes | Yes | Yes | – | – | Yes | **Yes** *(in flight)* |

¹ The Goethe-Institut's online and blended courses run on its own tutor-led learning platform. It has historically
been Moodle-based. Treat this column as a "tutor-supported language course" reference, not as a product spec.

### 2.2 What matters for this market

Independent DaF/DaZ teachers and small schools usually teach **small groups** (6 to 15) on a **weekly rhythm**, from
**A1 to B2**, often preparing for **Goethe/telc/ÖSD exams** or integration courses. They compete with Babbel and
Duolingo on convenience and beat them on **human feedback**. The winning product therefore combines:

1. **Human-graded productive skills.** Writing and speaking (record, comment, return) are the gap that apps cannot
   close and teachers sell.
2. **Low-effort reuse.** The same A1 course runs every 8 weeks for a new group, so cloning, relative dates and
   cohorts matter more than any single content type.
3. **Practice between lessons.** Vocabulary SRS and short auto-graded drills with partial credit give daily contact
   at low cost to the teacher.
4. **Exam-style assessment.** Timed exams with a listening part, a writing part (essay or assignment), a speaking part
   (recording) and per-learner accommodations, mirroring the Goethe/telc formats.
5. **Getting paid and staying legal in Germany.** Stripe with SEPA and invoices, Impressum and privacy pages, DSGVO
   tooling, and EU data residency.
6. **Gamification for adults only.** Streaks and a weekly goal, with no leaderboards by default and opt-in only.

Out of scope or low value for this audience: full LTI provider/consumer, competencies frameworks, the Moodle-style
"workshop" peer assessment, marketplaces.

---

## 3. Gap analysis and prioritized backlog

Priorities: **P0** = makes the product dynamic or is a legal/security must-have, do next. **P1** = strong value, next
quarter. **P2** = later or opportunistic. Effort: **S** ≈ 1 to 3 dev-days, **M** ≈ 1 to 2 weeks, **L** ≈ 3+ weeks
(full stack, including tests and i18n).

### 3.1 P0

#### P0-1 Per-learner release rules (drip, prerequisites, sequential, required/optional)
* **Problem:** `Visibility.isLive` uses calendar time only, so a learner who joins in week 5 gets everything at once,
  and nothing enforces "pass test 1 before unit 2". `ProgressService` counts every live item as mandatory.
* **Story:** *As Anna, I set unit 2 to open 7 days after a learner is accepted and only once they score ≥ 60 % in the
  unit 1 test, so every learner follows the path at their own pace.*
* **Spec:** item and module get `releaseOffsetDays` (relative to the enrollment start). The course gets
  `progression = FREE | SEQUENTIAL_MODULES | SEQUENTIAL_ITEMS`. Items and modules can have explicit prerequisites
  `{requiresItemId, minPercent?}`. Items get `required` (default true), and progress counts required items only.
  Locked items **appear** in the outline with a lock and a reason ("opens on 14 Oct", "complete *Test 1* (≥ 60 %)"),
  but their content is 403 `ITEM_LOCKED`. Calendar visibility still applies first. Instructors and admins in preview
  bypass the rules but see the reasons.
* **Data/API:** see §4 Workstream A (V8).
* **UI:** "Release rules" panel in the item editor and module settings, progression select in the course form,
  lock states in `learn-shell` and `learn-item-view`.
* **Effort / Value:** M / **Very high**. This is the single biggest "dynamic" lever.

#### P0-2 Duplicate item and module, clone course
* **Problem:** reusing an A1 course for the next group means rebuilding it by hand.
* **Story:** *As Anna, I clone "A1 Spring" into "A1 Autumn" as a draft with all content, quizzes and attachments,
  and optionally shift all dates by 26 weeks.*
* **Spec:** deep copy of modules, items, attachments (MediaAsset rows are **shared, not copied**: no storage
  duplication, which is safe because media is only deleted explicitly by the owner) and assessments with questions
  and options. Copies are always DRAFT. Optionally shift absolute dates by N days or drop them. Enrollments, attempts
  and progress are never copied. The course records `clonedFromId`.
* **Effort / Value:** S to M / **Very high**.

#### P0-3 Language exercise types with partial credit
* **Problem:** `QuestionType` has six types and `Grader.award` is all-or-nothing, so a 5-blank cloze cannot be
  scored fairly, and matching or ordering exercises (the core of A1 to B1 drills) are impossible.
* **Story:** *As Luca, I fill five blanks in a dialogue and get 4/5 points with each wrong blank highlighted.*
* **Spec:** new types CLOZE (multiple `{{n}}` blanks, each with its own accepted answers), WORD_BANK (cloze plus
  draggable chips, correct words plus distractors), MATCHING (pairs: word to translation or picture, article to noun),
  ORDERING (sentence parts or text sections into order, which suits German V2 word order), and DICTATION (audio
  prompt, typed answer, scored by token-level edit distance with optional umlaut/ß tolerance: `ae`→`ä`, `ss`→`ß`).
  A per-question `scoring = ALL_OR_NOTHING | PARTIAL`. Choice options can be shuffled.
* **Effort / Value:** M to L / **Very high**. See §4 Workstream B.

#### P0-4 Spoken answers (record in browser, instructor grades)
* **Problem:** speaking is half of every Goethe/telc exam and the teacher's unique value. There is no way to submit audio.
* **Story:** *As Luca, I record a 60-second self-introduction in the exam. Anna listens, awards points and leaves
  written or recorded feedback.*
* **Spec:** question type SPEAKING with a `maxRecordingSeconds` limit. The learner records with `MediaRecorder`
  (webm/opus, or mp4/aac on Safari), uploads it as their own media and attaches `responseMediaId` to the answer.
  It is graded manually like ESSAY.
* **Effort / Value:** M / **Very high**. See Workstream B.

#### P0-5 Legal and data protection basics (Germany)
* **Problem:** a German-operated platform without an Impressum, privacy policy, data export or account deletion
  carries real legal risk (§5 DDG, DSGVO Art. 13/15/17/20). The current FKs `on delete cascade` from `users` would
  also silently delete an instructor's courses together with all learner records.
* **Story:** *As a learner, I download my data and delete my account. As the operator, I publish an Impressum and
  privacy policy.*
* **Spec:** static `/impressum`, `/datenschutz` and `/agb` pages (content configurable). `GET /api/users/me/export`
  returns a ZIP of JSON and uploads. `DELETE /api/users/me` requires the password, anonymises the student's attempts
  and progress (name becomes "Deleted user") instead of cascading, and is blocked for instructors who still own live
  courses. Deletion requests from instructors go to an admin. A record of processing and DPAs with Resend and the
  hosting provider are organisational tasks to track.
* **Effort / Value:** M / **Must-have** (compliance, not "dynamic").

#### P0-6 Abuse protection
* **Problem:** there is no throttling on `/api/auth/login`, `/forgot-password` or `/resend-verification` (credential
  stuffing, e-mail bombing through Resend). Anyone can register as INSTRUCTOR. Any verified user can upload 500 MB
  files of any type.
* **Spec:** Bucket4j (in-memory now, Redis later) per IP and e-mail on auth endpoints, returning 429 `RATE_LIMITED`.
  Instructor accounts start in `INSTRUCTOR_PENDING` until an admin approves them, or an admin setting allows open
  registration. Per-user storage quota (for example 2 GB for instructors, 200 MB for students) and a type allow-list
  for student uploads (audio, image, pdf, docx). Disable Swagger in `application-prod.yml`.
* **Effort / Value:** S to M / **High** (risk reduction).

### 3.2 P1

#### P1-1 Vocabulary flashcards with spaced repetition
* **Problem:** vocabulary retention happens between lessons, and today learners leave for Anki or Quizlet.
* **Story:** *As Luca, I review today's 20 due cards (der/die/das colour-coded, with audio) in 5 minutes on my phone.*
* **Spec:** item type FLASHCARDS (a deck). Card fields: front, back, article, plural, example, audio and image. SM-2
  scheduling per learner and card (FSRS later). A "Review" view across all decks of a course, CSV import, and a
  dashboard tile "N cards due".
* **Effort / Value:** M / **Very high** for retention. See §4 Workstream C.

#### P1-2 Assignments with file submission, feedback and resubmission
* **Story:** *As Luca, I upload my letter (Brief schreiben, B1) as a photo or docx. Anna returns it with comments and
  an annotated file, and I resubmit.*
* **Spec:** item type ASSIGNMENT with due date, late policy, max files, max points and resubmissions. Each submission
  is versioned. States: SUBMITTED → RETURNED (revise) or GRADED. Due dates appear on the schedule.
* **Effort / Value:** M / **High**. See Workstream C.

#### P1-3 Live sessions (calendar, video link, iCal, attendance)
* **Story:** *As Anna, I schedule 8 weekly Zoom/Jitsi lessons. Learners see them in the course and in their own
  calendar via an iCal feed, and I take attendance afterwards.*
* **Spec:** sessions are linked to the course, with title, start, duration, join URL (shown only to enrolled learners
  and only 15 minutes before the start), an optional recording link, and attendance (PRESENT/LATE/ABSENT/EXCUSED).
  A per-user tokenized `.ics` feed. Reminder notifications go out 24 hours before.
* **Effort / Value:** M / **High**. See Workstream C.

#### P1-4 Question banks and random pools
* **Problem:** a fixed question list leaks between learners and attempts.
* **Story:** *As Anna, I keep a "Perfekt" bank of 60 questions tagged by topic and level. Each attempt of the exam
  draws 10 at random.*
* **Spec:** `question_banks` (per instructor, optionally per course) hold questions with the same schema as
  assessment questions, plus `tags`. An assessment section is either a fixed set of questions or `{bankId, tags[],
  count, pointsEach}`. Draws happen on `AttemptService.start` and are frozen by the existing snapshot model (which
  already makes this cheap). CSV import is `type;prompt;options;correct;points`.
* **Effort / Value:** L / **High**. Do it after Workstream B to avoid conflicts in `assessment/`.

#### P1-5 Exam accommodations and per-learner overrides
* **Spec:** `assessment_overrides(assessmentId, studentId, extraTimePercent | extraMinutes, availableUntil override,
  extraAttempts)`. Applied in deadline computation in `AttemptService.start`. A "Regrade" action recomputes auto-graded
  answers when the answer key changes, with a choice between the current key and the snapshot.
* **Effort / Value:** S to M / **High** (fairness, a legal topic for disabled learners). Extends the in-flight exam
  timing work.

#### P1-6 Groups and cohorts with their own schedules
* **Story:** *As a school, I run "A1 Mo/Mi abends" and "A1 Sa vormittags" in one course, each with its own start
  date and live sessions.*
* **Spec:** `course_groups(id, courseId, name, startsAt, capacity)`, and an enrollment gets a `groupId`. A per-group
  start date becomes the anchor for P0-1's `releaseOffsetDays`. Per-group item visibility goes in
  `item_group_visibility`. Reports, announcements and live sessions get filtered by group.
* **Effort / Value:** L / **High**. P0-1 is designed so the anchor can come from the group later.

#### P1-7 Co-instructors and teaching assistants
* **Problem:** `CourseAccess.canManage` is "owner or admin". Schools need several teachers.
* **Spec:** `course_staff(courseId, userId, role OWNER|INSTRUCTOR|TA)`. A TA can grade and message but cannot edit
  content or publish. Every `canManage` check moves to `CourseAccess.require(course, me, Permission)`.
* **Effort / Value:** M / **High** (precondition for schools and tenants).

#### P1-8 Payments (Stripe), free versus paid, coupons, waitlist auto-promotion
* **Spec:** course `priceCents`, `currency=EUR`, `vatIncluded`. Stripe Checkout (cards, SEPA, PayPal via Stripe)
  creates an APPROVED enrollment from a webhook (idempotent on event id). Coupons are percent or fixed, with expiry
  and max uses. Invoices come from Stripe Invoicing (German requirements: sequential numbers, VAT ID,
  Kleinunternehmer note). When a capacity spot frees up, the waitlist auto-promotes with a 48-hour acceptance window.
  Stripe Connect is for multi-instructor payouts later.
* **Effort / Value:** L / **Very high** commercially (it is how instructors earn).

#### P1-9 Discussion and Q&A per lesson
* **Spec:** threaded comments per item (`item_comments`), with an instructor "answered" mark, notifications, an
  instructor inbox across courses, and moderation (hide or delete). It can be disabled per course.
* **Effort / Value:** M / **Medium to high**.

#### P1-10 Storage on S3/MinIO, thumbnails, AV scanning
* **Spec:** an `S3FileStorage` implementation of the existing `FileStorage` interface (EU region, for example Hetzner
  or Scaleway object storage), direct-to-S3 presigned uploads for large files, and signed GET redirects
  (`MediaController` returns a 302 to a presigned URL, which offloads streaming). A ClamAV sidecar scans files
  asynchronously (`scanStatus` PENDING/CLEAN/INFECTED; infected files are blocked). An image thumbnail job generates
  covers and gallery images.
* **Effort / Value:** M / **High** for operations and scale.

#### P1-11 Learner self-service: placement test, resume, notes and bookmarks
* **Spec:** "Continue where you left off" (`lastViewedItemId` per enrollment). Private notes per item and bookmarks
  (`learner_notes`). Placement test: an instructor or admin marks one public EXAM as a placement test (no enrollment
  needed). Score bands map to a CEFR level and the catalog is filtered for that level.
* **Effort / Value:** M / **Medium to high**.

#### P1-12 Audit log
* **Spec:** `audit_events(actor, action, entityType, entityId, at, details JSON text)` for publish/unpublish, grading
  changes, enrollment decisions, role changes and deletions. There is an admin view, and an instructor view per
  course. It is needed for grade disputes.
* **Effort / Value:** S to M / **Medium**.

### 3.3 P2

| ID | Feature | Problem / story | Spec sketch (data, API, UI) | Effort | Value |
|---|---|---|---|---|---|
| P2-1 | Module and lesson templates | Recurring lesson shapes (warm-up, input, practice, homework) | A course flag `isTemplate` (hidden from the catalog), plus "New from template" using the P0-2 clone service | S | Medium |
| P2-2 | Item-level visibility per learner or group | Remedial content for weak learners only | `item_audience(itemId, groupId or studentId)`, checked in the release policy | M | Medium |
| P2-3 | Image hotspot question | "Click on the Bahnhof" | HOTSPOT type: image plus polygons in normalized coordinates, scored point-in-polygon | M | Medium |
| P2-4 | Rubrics for essays, speaking and assignments | Consistent B1 writing scores (Erfüllung, Kohärenz, Wortschatz, Strukturen) | `rubrics(criteria[levels, points])` attached to a question or assignment, with a grading UI grid | M | High |
| P2-5 | Proctoring-lite | Tab switching during exams | Log `visibilitychange` and `blur` events to `attempt_events`, optional fullscreen request, flags in the attempt review (no webcam) | S | Medium |
| P2-6 | Per-question time limits | Listening items with timed answers | `questions.timeLimitSeconds`, one question per page in the quiz player, server tolerance | M | Low to medium |
| P2-7 | Gamification for adults | Habit building | Daily streak (any completion, review or attempt), weekly goal in minutes, a few badges (first module, 7-day streak, 500 cards); opt-in leaderboard per course. `learner_activity_days` table | M | Medium |
| P2-8 | Course reviews and ratings, wishlist | Social proof in the catalog | `course_reviews(rating 1-5, text)` only from enrolled learners after 30 % progress, moderated by the instructor; `wishlist` | S to M | Medium |
| P2-9 | Glossary per course | Course-specific vocabulary reference | Glossary entries are reused from flashcard decks (P1-1). Searchable, with hover tooltips in rich text | S | Medium |
| P2-10 | Organisation / school tenant | Schools with several teachers, branding and invoices | `organizations`, `org_members(role)`, `courses.orgId`; subdomain or path branding. Requires P1-7 | L | High (B2B) |
| P2-11 | Import/export | Moving between systems | Course export ZIP (JSON plus media) and import, symmetrical with clone. CSV question import (with P1-4). H5P: keep embedding. SCORM 1.2 player and xAPI only if a B2B customer asks | M (ZIP) / L (SCORM) | Medium |
| P2-12 | Search | Find "Dativ" across lessons | Postgres full-text search (`german` config) over titles, bodies and glossary, limited to visible items | M | Medium |
| P2-13 | PWA and offline | Learning on the U-Bahn | Manifest, service worker caching the app shell, offline flashcard review with a sync queue | M | Medium |
| P2-14 | Mobile app readiness | Native apps later | Already API-first. Add a refresh-token flow without cookies (body token for native), push token registration, and a stable versioned API (`/api/v1`) | S to M | Medium |
| P2-15 | Accessibility | WCAG 2.1 AA; the BFSG may apply to paid consumer offerings | WebVTT captions on VIDEO and AUDIO items (attachment kind `CAPTION`), transcripts, focus management in the quiz player, an axe check in CI | M | High (legal for paid B2C) |
| P2-16 | 2FA and SSO | Schools ask for it | TOTP 2FA (mandatory for admins), "Sign in with Google/Microsoft" via Spring OAuth2 client; SAML only for tenants | M | Medium |
| P2-17 | Video transcoding and HLS | 500 MB MP4 over a single range stream | An ffmpeg worker producing HLS renditions and a poster frame; Bunny Stream or Mux as a managed alternative | L | Medium |
| P2-18 | Notification preferences and digests | E-mail fatigue | Per-type in-app/e-mail toggles and a daily digest of "new content unlocked" (needed once P0-1 drip lands) | S to M | Medium |
| P2-19 | AI assist (**optional**) | Speed up authoring and feedback | See §3.4 | M to L | Medium to high |

### 3.4 AI assist (optional, human in the loop)

* **Generate exercises from text:** the instructor pastes a text, and the AI proposes cloze, matching and comprehension
  questions as **draft** questions in the assessment editor. Nothing is published without review.
* **Writing feedback draft:** for ESSAY and ASSIGNMENT, the AI suggests rubric scores and comments (grammar, case
  endings, word order). The instructor edits and accepts them. Learners never see raw AI output, and the result shows
  "feedback by Anna (AI-assisted)".
* **Translation and hint helper:** on-demand gloss for a highlighted word, cached per course glossary.
* **Speaking:** the transcript of a SPEAKING answer, shown to the grader only (a speech-recognition draft, not a score).

Privacy: this is off by default per platform and per course. Use an EU-hosted model or provider with a DPA and
zero data retention. Learner content is only sent when the instructor triggers an action. Strip names and e-mails
before sending. Log every AI call in the audit log, and disclose it in the privacy policy. Note that EU AI Act
transparency duties apply to AI-generated feedback in education. Keep humans deciding grades. Fully automated scoring
in education may fall under the high-risk category.

---

## 4. Recommended next implementation wave

Seven items, chosen for "dynamic" impact, feasibility now, and low overlap with the in-flight work:

| # | Item | Backlog | Workstream |
|---|---|---|---|
| 1 | Per-learner release rules (drip, prerequisites, sequential, required/optional) | P0-1 | **A: Dynamic course structure** |
| 2 | Duplicate item and module, clone course with date shift | P0-2 | A |
| 3 | Language exercise types (cloze, word bank, matching, ordering, dictation) with partial credit and option shuffle | P0-3 | **B: Language exercises** |
| 4 | Spoken answers (SPEAKING) with instructor grading | P0-4 | B |
| 5 | Vocabulary flashcards with spaced repetition | P1-1 | **C: Practice and teaching loop** |
| 6 | Assignments with file submission, feedback and resubmission | P1-2 | C |
| 7 | Live sessions with iCal and attendance | P1-3 | C |

P0-5 (legal/GDPR) and P0-6 (abuse protection) are small and mostly independent. Schedule them as a fourth, smaller
track for whoever is free (proposed migration V11 for the instructor-pending state and anonymisation).

### 4.0 Coordination rules for all three workstreams

* **Migrations:** A = `V8__release_rules_and_cloning.sql`, B = `V9__language_question_types.sql`,
  C = `V10__flashcards_assignments_live.sql`. Reserve V11 (track 4), then V12 to V14 for follow-ups of A, B and C.
  All SQL must stay portable between H2 (MODE=PostgreSQL) and Postgres: no `jsonb`, no partial indexes, JSON stored
  as `varchar`.
* **Shared files** (append-only, in separate blocks to keep merges trivial):
  `frontend/src/lib/api/types.ts` (one section per workstream), `frontend/messages/en.json` and `de.json` (new
  top-level namespaces: `release`/`clone` for A, `exercises` for B, `flashcards`/`assignments`/`live` for C),
  `backend/src/main/resources/messages*.properties` (prefixes `release.`, `question.`, `flashcards.` and so on),
  `NotificationType` (append constants only).
* **Ownership of `ItemType`:** only C adds enum values (FLASHCARDS, ASSIGNMENT). A and B do not touch it.
* **Ownership of `learn-item-view.tsx`:** A adds the locked state at the top (early return). C adds the new type
  branches. Each wraps its addition in its own component file (`locked-item.tsx`, `flashcard-deck-view.tsx`,
  `assignment-view.tsx`, `live-session-card.tsx`), so the shared file changes by a few lines only.
* **Dependencies on in-flight work:** B starts after **exam timing** merges (both touch `AttemptService`,
  `quiz-player.tsx`, `question-input.tsx`). B and A must extend the **report** package's per-question analytics and
  progress so new question types and the `required` flag show up correctly. Agree on this with the reports owner, or
  do it as a follow-up in V12/V13. **Certificates** completion criteria should use the `required` flag from A
  (through `ProgressService`), so no certificate code changes are needed if certificates call `ProgressService`.
* Every workstream: OpenAPI snapshot test updated (`OpenApiSnapshotTest`), en/de parity (`MessageBundlesTest` and the
  frontend key-parity check), `mvn verify` and `npm run lint && npm run build` green, PLAN.md API section updated.

---

### 4.1 Workstream A: Dynamic course structure (release rules and cloning)

**Touches:** `backend/.../course/` (Course, CourseModule, ContentItem, CourseDtos, CourseMapper, CourseService,
ContentService, InstructorCourseController, new `CourseCloner`), `backend/.../learning/` (LearnerAccess,
LearningService, ProgressService, LearningDtos, new `ReleasePolicy`, `ReleaseContext`), `common/publication`
(read-only use), migration **V8**. Frontend: `components/builder/` (item-editor, module-card, item-row, course-form,
course-builder, new `release-rules-panel.tsx`, `clone-course-dialog.tsx`), `components/instructor/course-list.tsx`,
`components/learn/` (learn-shell, learn-item-view, new `locked-item.tsx`), `lib/api/instructor.ts`,
`lib/api/student.ts`, `hooks/queries/*`.
**Does not touch:** assessment, enrollment, report (read-only use of `Enrollment.decidedAt`).

#### Migration `V8__release_rules_and_cloning.sql`
```sql
alter table courses        add column progression varchar(20) default 'FREE' not null;   -- FREE|SEQUENTIAL_MODULES|SEQUENTIAL_ITEMS
alter table courses        add column cloned_from_id uuid references courses (id) on delete set null;
alter table course_modules add column release_offset_days integer;                        -- null = no drip
alter table content_items  add column release_offset_days integer;
alter table content_items  add column required boolean default true not null;

create table release_prerequisites (
    id               uuid primary key,
    target_type      varchar(10) not null,            -- MODULE|ITEM
    target_id        uuid        not null,
    requires_item_id uuid        not null references content_items (id) on delete cascade,
    min_percent      integer,                          -- only for QUIZ/EXAM; null = completed is enough
    constraint ck_release_prereq_target check (target_type in ('MODULE','ITEM')),
    constraint uk_release_prereq unique (target_type, target_id, requires_item_id)
);
create index ix_release_prereq_target on release_prerequisites (target_type, target_id);
```
(`target_id` is polymorphic, so delete prerequisites for a module or item in `ContentService.deleteModule/deleteItem`.)

#### Domain logic
* `ReleasePolicy` is a **pure** function, unit-testable like `Visibility`:
  `ReleaseState evaluate(CourseOutline outline, ReleaseContext ctx, Instant now)`, where `ReleaseContext` holds
  `anchor` (= `enrollment.decidedAt` of the APPROVED enrollment, or now for preview), `completedItemIds`, and
  `bestPercentByItem`. The result maps each id to
  `AVAILABLE | LOCKED_DATE(unlockAt) | LOCKED_PREREQ(List<PrereqRef>) | LOCKED_SEQUENCE(previousItemId)`.
  * Drip: `unlockAt = anchor + module.offset` and `anchor + item.offset`; the effective value is the later one.
  * SEQUENTIAL_MODULES: module *n* requires all **required** live items of module *n-1* completed (and passed, if
    they are assessments with a passing score). SEQUENTIAL_ITEMS: each item requires the previous required item.
  * Explicit prerequisites: AND semantics. `minPercent` uses the best attempt percent (graded or auto-graded).
* `LearnerAccess.item(...)` → after the existing live check, evaluate the policy for non-managers. A locked item
  returns `403 ITEM_LOCKED` with `ProblemDetail` properties `{lockReason, unlockAt, prerequisites:[{itemId,title,minPercent}]}`.
* `AttemptService.start` already goes through `LearnerAccess.item`, so locked exams cannot be started. Verify this
  with a test.
* `ProgressService`: percent = completed **required** live items / required live items. If no item is required, fall
  back to all items. This benefits reports and certificates automatically.
* `CourseCloner`: `clone(courseId, CloneRequest{title, shiftDays?, keepSchedule})` deep-copies modules, items,
  attachment references, assessments, questions, options, accepted answers and prerequisites (remapping ids through an
  old→new map). Everything becomes DRAFT. A new slug comes from `SlugGenerator`. `duplicateModule` and `duplicateItem`
  reuse the same copier within a course, with the title suffix " (copy)" / " (Kopie)" localized with `Messages`.
  B's new question columns are copied generically by a `Question.copy()` method that B extends. Agree on the method
  name up front.

#### API
| Method | Path | Body → response |
|---|---|---|
| POST | `/api/instructor/courses/{id}/clone` | `{title, shiftDays?: int, keepSchedule: boolean}` → 201 CourseDto |
| POST | `/api/instructor/modules/{id}/duplicate` | → 201 ModuleDto (inserted after the source) |
| POST | `/api/instructor/items/{id}/duplicate` | `{targetModuleId?}` → 201 ContentItemDto |
| PUT | `/api/instructor/items/{id}/release` | `ReleaseRulesDto {required, releaseOffsetDays?, prerequisites:[{itemId, minPercent?}]}` → ContentItemDto |
| PUT | `/api/instructor/modules/{id}/release` | `{releaseOffsetDays?, prerequisites:[...]}` → ModuleDto |
| PUT | `/api/instructor/courses/{id}` | `CourseUpsert` gains `progression` |

Validation: prerequisites must be in the same course, no self-reference, no cycles (DFS, error `400 PREREQUISITE_CYCLE`),
`minPercent` 0 to 100 and only for QUIZ/EXAM, `releaseOffsetDays` 0 to 3650.
DTO additions: `ContentItemDto` and `ModuleDto` get `required`, `releaseOffsetDays`, `prerequisites`. `CourseDto`
gets `progression`. Learner `LearnCourseDto.items[]` and `LearnItemDto` get `required`,
`lock: {reason, unlockAt?, prerequisites?}` or null. Prev/next still point to locked items, and the player shows the
lock.

#### UI
* `release-rules-panel.tsx` (item editor tab "Release"): Required switch, "Opens N days after enrollment" number
  input with a live example ("for a learner accepted today: 19 Oct"), prerequisite picker (combobox of course items
  plus a "min. score" input for assessments).
* Module card menu: "Release rules…" dialog with the same component, and "Duplicate".
* Item row menu: "Duplicate", "Duplicate to module…".
* Course form: "Progression" segmented control (Free / Module by module / Step by step) with explanatory text.
* Course list and builder header: "Clone course" dialog (title, shift dates by N weeks / remove dates).
* Builder badges: "Day +7", "Optional", a lock icon with a tooltip listing prerequisites.
* Learner: outline lock icon and muted style, `locked-item.tsx` with the reason and a link to the prerequisite, and a
  progress bar label "of required content".

#### Tests
* `ReleasePolicyTest` (unit): drip with module/item max, sequential modules and items, `minPercent`, optional items
  skipped by the sequence, preview bypass.
* `ReleaseRulesIT`: a locked item returns 403 `ITEM_LOCKED` with properties, unlocks after completing the
  prerequisite, attempt start is blocked, the clock is advanced through the injectable `Clock` for drip, and cycle
  detection returns 400.
* `CloneIT`: deep copy equality (counts, question options, attachments shared), all DRAFT, dates shifted,
  enrollments not copied, other instructors get 404.
* `ProgressService` required-only percent. Frontend: lint and build, plus a Playwright smoke test if available.

#### i18n (en/de)
`release.*` (`required`, `optional`, `opensAfterDays` "Opens {days} days after enrollment" / "Öffnet {days} Tage
nach der Aufnahme", `lockedUntil` "Available from {date}" / "Verfügbar ab {date}", `lockedPrereq` "Complete
“{title}” first" / "Schließe zuerst „{title}“ ab", `minScore` "at least {percent} %" / "mindestens {percent} %",
progression labels), `clone.*`. Backend: `error.ITEM_LOCKED`, `error.PREREQUISITE_CYCLE`, `copySuffix`.

**Effort:** about 2 weeks for one developer.

---

### 4.2 Workstream B: Language exercises (new question types, partial credit, speaking)

**Touches:** `backend/.../assessment/` (QuestionType, Question, QuestionOption, AttemptAnswer, AnswerOptionSnapshot,
Grader, AssessmentDtos, AssessmentService, AttemptService.applyAnswers, AttemptMapper, new `ClozeParser`,
`TextSimilarity`), `media/MediaService` (a small hook so learners can attach their own recordings), migration **V9**.
Frontend: `components/builder/question-editor.tsx` (split into `question-editors/*.tsx` per type),
`assessment-editor.tsx`, `components/quiz/question-input.tsx` (split into `inputs/*.tsx`), `results-view.tsx`,
`instructor/attempts/[attemptId]/page.tsx` (grading of SPEAKING), new `components/quiz/audio-recorder.tsx`.
**Does not touch:** course, learning, enrollment. **Starts after the exam-timing branch merges.**

#### Migration `V9__language_question_types.sql`
```sql
alter table questions add column scoring varchar(20) default 'ALL_OR_NOTHING' not null;   -- ALL_OR_NOTHING|PARTIAL
alter table questions add column shuffle_options boolean default false not null;
alter table questions add column lenient_spelling boolean default false not null;          -- umlaut/ß/typo tolerance
alter table questions add column max_recording_seconds integer;                            -- SPEAKING
alter table question_options add column match_text varchar(2000);                          -- MATCHING right side
alter table question_options add column blank_index integer;                               -- WORD_BANK correct chips
alter table question_accepted_answers add column blank_index integer default 0 not null;   -- CLOZE per blank

alter table attempt_answers add column scoring varchar(20) default 'ALL_OR_NOTHING' not null;
alter table attempt_answers add column lenient_spelling boolean default false not null;
alter table attempt_answers add column response_json varchar(20000);   -- blanks / pairs / order, see below
alter table attempt_answers add column response_media_id uuid references media_assets (id) on delete set null;
alter table attempt_answer_options add column match_text varchar(2000);
alter table attempt_answer_options add column blank_index integer;
alter table attempt_answer_accepted add column blank_index integer default 0 not null;
```
Widen `question_type` checks if any are added. They are `varchar(20)` today, and `MULTIPLE_CHOICE` (15) still fits
the new names.

#### Types and grading
| Type | Authoring | Learner response (`response_json`) | Scoring |
|---|---|---|---|
| CLOZE | Prompt with `{{1}}`, `{{2}}`… markers; accepted answers per `blank_index` | `{"blanks":{"1":"habe","2":"gemacht"}}` | Per blank; PARTIAL = points × correct/total, rounded to 0.5 |
| WORD_BANK | Same as CLOZE. Options = chips; `blank_index` set for correct chips, null = distractor | `{"blanks":{"1":"<optionId>"}}` | As CLOZE, by option id |
| MATCHING | Options with `option_text` (left) and `match_text` (right); the right side is shuffled for display | `{"pairs":{"<leftOptionId>":"<rightOptionId>"}}` (right ids = option ids) | Correct pairs / total |
| ORDERING | Options in correct order (`sort_order`); shuffled for display | `{"order":["<optionId>",…]}` | ALL_OR_NOTHING, or PARTIAL = longest correct subsequence / n |
| DICTATION | Question media must be AUDIO; accepted answers = reference sentence(s) | `text_answer` | Token-level Levenshtein against the closest reference: PARTIAL = max(0, 1 − errors/words); `lenient_spelling` maps ae/oe/ue/ss to umlauts and ß and ignores punctuation |
| SPEAKING | Prompt plus optional media, `max_recording_seconds` (10 to 600) | `response_media_id` | Manual (pending), like ESSAY |

* `Grader.grade` gets one method per type. `award(a, fraction)` replaces `award(a, ok)`, with `correct = fraction == 1`.
  The existing types keep their behaviour. MULTIPLE_CHOICE with PARTIAL uses (correct selected − wrong selected) /
  correct, floored at 0.
* `shuffle_options`: shuffle once at `AttemptService.start` and persist the order in the snapshot (`sort_order` of
  `AnswerOptionSnapshot`) so reloads and results are stable.
* The learner session DTO must **never** leak keys. For CLOZE send only the blank count, for WORD_BANK the chips
  without `blank_index`, for MATCHING the left texts plus shuffled right texts, for ORDERING the shuffled options.
* SPEAKING upload: the learner uploads through the existing `POST /api/media` (owner = learner), then sends
  `responseMediaId` in the autosave or submit payload. `AttemptService` validates that the media belongs to the
  learner, is AUDIO and is at most 25 MB. The instructor sees it through a signed URL in `AttemptResultDto`. Add a
  student-upload allow-list in `MediaService` (audio, image, pdf, office) as part of P0-6.
* `AssessmentService` validation per type: at least one blank, every marker has an answer, ≥ 2 pairs, ≥ 2 ordering
  items, dictation needs AUDIO media, SPEAKING requires `max_recording_seconds`. Error codes `QUESTION_INVALID.*`.

#### API changes (contract additions, no new endpoints)
* `QuestionDto` += `scoring, shuffleOptions, lenientSpelling, maxRecordingSeconds, blanks:[{index, acceptedAnswers[]}]`,
  and `options[]` += `matchText, blankIndex`.
* `SubmittedAnswer` += `blanks?: Record<string,string>`, `pairs?: Record<string,string>`, `order?: string[]`,
  `responseMediaId?: string` (serialized into `response_json`).
* `AttemptSessionDto.questions[]` += `blankCount`, `matchTargets:[{id,text}]`, `maxRecordingSeconds`.
* `AttemptResultDto.answers[]` += the same response fields, `blankResults:[{index, given, correct, expected?}]`,
  `responseMedia?: MediaDto`.

#### UI
* Question editor: a type picker with icons and one-line descriptions (DE-focused examples: "Ergänze die Verbformen",
  "Ordne die Satzteile"). CLOZE editor: a textarea where selecting a word and pressing "Make blank" inserts `{{n}}`
  and adds an accepted-answers row (tags input). MATCHING: a two-column pair list. ORDERING: a sortable list (dnd-kit,
  already present). DICTATION: an audio upload slot plus reference text. SPEAKING: max duration. A scoring toggle
  ("Partial credit") on every auto-graded type.
* Quiz player inputs: inline blanks inside the rendered prompt (accessible `<input aria-label="Lücke 1">`), word bank
  chips (click or drag, keyboard selectable), matching through select-per-row on mobile and drag on desktop, ordering
  with keyboard up/down buttons, and `audio-recorder.tsx` (permission prompt, level meter, countdown, re-record,
  playback, upload with progress, Safari mp4 fallback, clear error if there is no microphone).
* Results: per-blank green and red with the expected answer when `showCorrectAnswers` is on, and an audio player for
  SPEAKING with the instructor's feedback.
* Instructor grading page: an audio player for the recording, points (0.5 steps) and feedback, as for ESSAY.

#### Tests
`GraderTest` (each type, PARTIAL and ALL_OR_NOTHING, lenient spelling: "Mädchen" = "Maedchen", ordering LCS, matching
with duplicate right texts), `ClozeParserTest`, `TextSimilarityTest`, `LanguageQuestionsIT` (author → start (no keys
leaked) → autosave → submit → score; SPEAKING with someone else's media returns 403/400; option shuffle stable across
resume), OpenAPI snapshot.

#### i18n
`exercises.*` (type names and hints, "Lücke {n}", "Wortbank", "Ordne", "Aufnahme starten/stoppen", "Mikrofon nicht
verfügbar", "Teilpunkte"), backend `question.invalid.*`.

**Effort:** about 2.5 to 3 weeks.

---

### 4.3 Workstream C: Practice and teaching loop (flashcards, assignments, live sessions)

**Touches:** new backend packages `flashcard/`, `assignment/`, `live/`. Additive changes to `course/ItemType`
(**owner of the enum change**: `FLASHCARDS`, `ASSIGNMENT`), `course/CourseMapper` (item summary), `schedule/ScheduleService`
(append DUE and SESSION events), `notification/NotificationType` (append), `learning/LearningService` (expose
assignment/flashcard info on `LearnItemDto`, a few lines), `security/SecurityConfig` (permit the tokenized iCal
path), migration **V10**. Frontend: new `components/flashcards/`, `components/assignments/`, `components/live/`,
`builder/add-content.tsx` (two new types), `builder/item-editor.tsx` (type branches mount new editors),
`learn/learn-item-view.tsx` (type branches), `course/item-type-icon.tsx`, `student/student-dashboard.tsx` (due cards
and next session tiles), new routes `learn/[courseId]/review/page.tsx`,
`instructor/courses/[courseId]/live/page.tsx`, `instructor/courses/[courseId]/submissions/page.tsx` (or a builder tab
next to `submissions-panel.tsx`).

#### Migration `V10__flashcards_assignments_live.sql`
```sql
-- Flashcards: a FLASHCARDS item is a deck
create table flashcards (
    id uuid primary key, item_id uuid not null references content_items (id) on delete cascade,
    front varchar(500) not null, back varchar(500) not null,
    article varchar(3), plural varchar(200), example varchar(1000),
    audio_media_id uuid references media_assets (id) on delete set null,
    image_media_id uuid references media_assets (id) on delete set null,
    sort_order integer not null);
create index ix_flashcards_item on flashcards (item_id, sort_order);
create table flashcard_reviews (
    id uuid primary key, card_id uuid not null references flashcards (id) on delete cascade,
    student_id uuid not null references users (id) on delete cascade,
    repetitions integer not null default 0, interval_days integer not null default 0,
    ease double precision not null default 2.5, lapses integer not null default 0,
    due_at timestamp with time zone not null, last_reviewed_at timestamp with time zone,
    constraint uk_flashcard_review unique (card_id, student_id));
create index ix_flashcard_reviews_due on flashcard_reviews (student_id, due_at);

-- Assignments
create table assignments (
    id uuid primary key, item_id uuid not null references content_items (id) on delete cascade,
    due_at timestamp with time zone, allow_late boolean not null default true,
    max_points integer not null default 10, max_files integer not null default 3,
    max_submissions integer not null default 3, allow_text boolean not null default true,
    constraint uk_assignments_item unique (item_id));
create table assignment_submissions (
    id uuid primary key, assignment_id uuid not null references assignments (id) on delete cascade,
    student_id uuid not null references users (id) on delete cascade,
    version_no integer not null, text_answer varchar(20000),
    status varchar(20) not null,                       -- SUBMITTED|RETURNED|GRADED
    submitted_at timestamp with time zone not null, late boolean not null default false,
    points double precision, feedback varchar(20000),
    graded_by uuid references users (id) on delete set null, graded_at timestamp with time zone,
    version bigint not null default 0,
    constraint uk_submission_version unique (assignment_id, student_id, version_no));
create index ix_submissions_assignment_status on assignment_submissions (assignment_id, status);
create table assignment_submission_files (
    submission_id uuid not null references assignment_submissions (id) on delete cascade,
    sort_order integer not null, media_id uuid not null references media_assets (id) on delete cascade,
    feedback_file boolean not null default false,
    primary key (submission_id, sort_order));

-- Live sessions
create table live_sessions (
    id uuid primary key, course_id uuid not null references courses (id) on delete cascade,
    title varchar(200) not null, description varchar(5000),
    starts_at timestamp with time zone not null, duration_minutes integer not null,
    join_url varchar(2000), recording_url varchar(2000),
    cancelled boolean not null default false,
    created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create index ix_live_sessions_course_start on live_sessions (course_id, starts_at);
create table live_attendance (
    session_id uuid not null references live_sessions (id) on delete cascade,
    student_id uuid not null references users (id) on delete cascade,
    status varchar(10) not null,                       -- PRESENT|LATE|ABSENT|EXCUSED
    primary key (session_id, student_id));
alter table users add column calendar_token varchar(64);  -- iCal feed secret, rotatable
create unique index uk_users_calendar_token on users (calendar_token);
```

#### C1: Flashcards (SRS)
* Instructor: `GET/PUT /api/instructor/items/{id}/flashcards` (replace semantics like the assessment PUT, cards with
  an id are updated), and `POST /api/instructor/items/{id}/flashcards/import` (CSV `front;back;article;plural;example`,
  UTF-8, semicolon or tab, preview and error report, max 2,000 cards).
* Learner: `GET /api/student/items/{id}/flashcards` (deck browse mode), `GET /api/student/courses/{courseId}/review?limit=20`
  (due cards plus up to `newPerDay=15` new cards from **visible** decks only, so it respects visibility and A's
  release rules through `LearnerAccess`), `POST /api/student/flashcards/{cardId}/review {grade: AGAIN|HARD|GOOD|EASY}`
  → next due date, and `GET /api/student/review/summary` → `{dueToday, byCourse[]}` for the dashboard.
* `Sm2Scheduler` is a pure class (unit tested): AGAIN resets repetitions and sets interval 1 day (10 minutes for
  learning steps, kept simple with a 1-day minimum), HARD ×1.2, GOOD ×ease, EASY ×ease×1.3, ease is clamped ≥ 1.3.
  Completing a deck item (marking it complete) is independent of SRS.
* UI: deck editor (table with inline edit, article select der/die/das, audio upload, CSV import dialog), review player
  (`/learn/[courseId]/review`: card flip with Space, 1 to 4 grade keys, audio auto-play option, article colour coding
  der = blue, die = red, das = green with a non-colour cue for accessibility, session summary), and a dashboard tile.

#### C2: Assignments
* Instructor: `GET/PUT /api/instructor/items/{id}/assignment` (settings), `GET /api/instructor/items/{id}/submissions?status=`
  (latest version per learner plus history), `POST /api/instructor/submissions/{id}/review {points?, feedback,
  action: RETURN|GRADE, feedbackMediaIds[]}`.
* Learner: `GET /api/student/items/{id}/submissions` (mine, all versions), `POST /api/student/items/{id}/submissions
  {textAnswer?, mediaIds[]}` (validates ownership of the media, max files, max submissions, `late`; blocked once
  GRADED unless the instructor has returned it).
* Rules: submitting marks the item **completed** (consistent with quizzes, QA bug #8). Notifications
  `ASSIGNMENT_SUBMITTED` (to the instructor) and `ASSIGNMENT_REVIEWED` (to the learner, deep link
  `/learn/{c}/{i}?submission={id}`). `ScheduleService` adds `action: "DUE"` events.
* UI: an assignment view in the player (instructions = item body, due badge, dropzone reusing `ui/file-dropzone.tsx`
  and `use-uploads`, version history, feedback card), and an instructor submissions table plus a review drawer
  (file viewers from `learn/viewers.tsx`, points, rich-text feedback, feedback-file upload, Return / Grade).
* Reports follow-up (V12+): include assignment points in the gradebook.

#### C3: Live sessions
* Instructor: `GET/POST /api/instructor/courses/{id}/live-sessions`, `PUT/DELETE /api/instructor/live-sessions/{id}`
  (cancel sends a notification), `POST /api/instructor/courses/{id}/live-sessions/series {title, firstStartsAt,
  weeks, durationMinutes, joinUrl}` (weekly series in Europe/Berlin local time, so DST is handled),
  `PUT /api/instructor/live-sessions/{id}/attendance {entries:[{studentId,status}]}`.
* Learner: `GET /api/student/courses/{id}/live-sessions` (`joinUrl` is returned only to APPROVED learners, and only
  from 15 minutes before the start until the end), `GET /api/student/live-sessions/upcoming` (dashboard).
* iCal: `GET /api/calendar/{token}.ics` (public, token-authenticated, text/calendar with VEVENTs for sessions,
  assignment due dates and exam windows of approved courses; no join URLs in the feed, only a link to the course
  page), `POST /api/users/me/calendar-token` to rotate the token.
* Reminder job: `@Scheduled` every 5 minutes, notifying 24 hours before the start (idempotent via a
  `reminder_sent_at` column; add it to V10 if wanted). Use a lock (see §5.4) if more than one instance runs.
* UI: a "Live" tab in the builder (list, series dialog, attendance sheet with "all present" shortcut), a "Next live
  lesson" card in the learn outline and on the dashboard with a countdown and Join button, and "Subscribe in calendar"
  in settings (copy URL, rotate). Sessions also appear on the instructor schedule.

#### Tests
`Sm2SchedulerTest`, `FlashcardIT` (import, review queue respects visibility, other learners cannot review cards of
courses they are not in), `AssignmentIT` (submit → return → resubmit → grade, max submissions, foreign media 400,
late flag, item completed, notifications), `LiveSessionIT` (join URL hidden before the window and for non-enrolled
users, series across the DST change on 25 Oct 2026, attendance, iCal parses and has no join URL), `CsvImportTest`.

#### i18n
`flashcards.*` (Karteikarten, Wiederholen, Nochmal/Schwer/Gut/Leicht, "{count} Karten fällig"), `assignments.*`
(Abgabe, Einreichen, Zur Überarbeitung zurückgeben, Bewertet, verspätet), `live.*` (Live-Unterricht, Beitreten,
Anwesenheit, anwesend/verspätet/abwesend/entschuldigt, Kalender abonnieren), new notification types in
`messages*.properties`.

**Effort:** about 3 weeks. It splits cleanly into C1, C2 and C3 if more developers are available, because each is
its own package. Keep a single V10 file, or split it into V10 (C1), V12 (C2) and V13 (C3) if the parts are developed
by different people.

---

## 5. Risks and non-functional improvements

### 5.1 Performance
* **Per-learner visibility cost.** After Workstream A, outline and progress depend on the learner. `ProgressService.liveItems`
  already loads whole outlines into memory, which is fine for courses with fewer than about 500 items. Keep one
  outline query per request, compute `ReleasePolicy` in memory, and add `(student_id, item_id)` lookups in batch
  (already indexed). For instructor reports over many learners, cache outlines per course for about 30 seconds
  (Caffeine) and invalidate on content change.
* **Media streaming through the JVM.** Videos up to 500 MB stream through Tomcat. Move to S3 presigned redirects plus
  a CDN (P1-10) before you have more than about 50 concurrent video viewers. Use HLS for long videos (P2-17).
* **Unbounded lists.** `GET /courses/{id}/enrollments`, attempts per item and notifications should all be paginated
  (`PageResponse` exists). Add this before schools with 300+ learners arrive.
* **Per-request account lookup** (QA #1): add a 30-second cache keyed by user id with a `tokenVersion` column to
  invalidate on role or enable changes.

### 5.2 Security
* Rate limiting and instructor approval (P0-6). These are the most urgent gaps.
* Upload hardening: a type allow-list for learners, per-user quotas, ClamAV scanning, magic-byte sniffing (Apache Tika)
  instead of trusting the declared `Content-Type`, and an image re-encode to strip EXIF GPS data (privacy).
* Swagger UI and `/v3/api-docs` should be disabled in prod (`springdoc.api-docs.enabled=false`), or admin only.
* Frontend: add a strict CSP (`script-src 'self'` plus nonces), `Referrer-Policy: strict-origin-when-cross-origin`
  (signed media URLs must not leak via Referer to embedded sites), and `Permissions-Policy` with
  `microphone=(self)` once SPEAKING lands.
* Refresh tokens: verify reuse detection, so that presenting an already rotated token revokes the whole family.
  Add it if it is missing.
* Signed media URLs are bearer links for 6 hours. Acceptable, but shorten the TTL for SPEAKING and assignment uploads
  (personal data) to 15 minutes.
* 2FA for admins (P2-16) before any school tenant onboarding.

### 5.3 Data protection (DSGVO)
* Impressum, privacy policy, data export, account deletion and anonymisation (P0-5).
* **Cascades:** `users → courses → … → attempts` uses `on delete cascade`. Replace hard deletes of users with
  anonymisation, and forbid deleting instructors who own courses with learners.
* Retention: automatically delete or anonymise attempts, recordings and submissions N months after the course ends
  (an instructor setting with a default of 24 months). Voice recordings are personal data. State this explicitly in
  the privacy policy and require consent text on first recording.
* Processors: Resend (check region and DPA), the hosting provider, and future Stripe and AI providers. Prefer
  EU-hosted object storage.
* Analytics: if product analytics is ever added, use a cookieless EU tool (Plausible, Matomo), so no consent banner
  is required.

### 5.4 Scalability and operations
* **Cluster-safe jobs:** `AttemptExpirySweeper`, the refresh-token cleanup and the planned reminder and announcement
  jobs run on every instance. Add ShedLock (JDBC provider, one small table) before running two replicas.
* **Storage:** `LocalFileStorage` ties the app to one node and one disk. Implement `S3FileStorage` (P1-10). The
  interface is already in place.
* **Tests on Postgres:** tests run on H2 in PostgreSQL mode. Add a Testcontainers Postgres profile to CI for the
  integration tests. Migrations with `varchar(1000000)` and polymorphic FKs behave differently enough to matter.
* **Observability:** Micrometer with a Prometheus endpoint (secured), structured JSON logs with `traceId` (already in
  ProblemDetail), and OpenTelemetry later. Alert on 5xx rate, mail failures and sweeper lag.
* **Backups:** daily Postgres dumps plus object storage versioning, with a restore drill documented.

### 5.5 Product and UX risks
* **Complexity creep in the builder.** Release rules, groups, banks and new types can overwhelm a freelance teacher.
  Keep defaults "Free progression, everything required, no drip", hide advanced settings behind a "Release" tab, and
  show a learner's-eye explanation of the effect, as A specifies.
* **Calendar visibility versus per-learner rules.** Instructors need to understand both layers. Show both in the
  builder badge ("Live · Day +7 · after Test 1") and in "Preview as learner (accepted N days ago)".
* **Offline and PWA expectations** grow once flashcards land. Plan P2-13 right after C1.

### 5.6 Delivery risks
* **Flyway ordering:** V4 and V6 are missing on the main branch (in-flight branches), and V7 is certificates.
  `outOfOrder` is off, so a database that has already applied V9 rejects a later V8. Merge in numeric order, or
  enable `spring.flyway.out-of-order=true` **in dev and test only** during the parallel phase. Never ship a release
  with gaps that a later merge fills.
* **Hot files:** `AttemptService`, `quiz-player.tsx`, `learn-item-view.tsx`, `types.ts`, and `en.json`/`de.json`.
  Follow the ownership rules in §4.0. Rebase B onto exam timing first.
* **Report and certificate coupling:** both should rely on `ProgressService` and the generic `Grader` results, so A's
  required flag and B's partial credit flow through without each team changing the other's code.
