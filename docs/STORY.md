# Sprachweg — Product Story

Vision, personas and user stories. Technical plan: [PLAN.md](PLAN.md).

---
## 1. Vision

**Sprachweg** ("the language path") is a course platform built for German teachers and
learners. Instructors can build a course in any shape they like: text lessons, PDFs,
Word/PowerPoint files, audio for listening practice, video, images, embedded links,
quizzes and timed exams. They decide exactly **when** each piece goes live.
Learners find a course, apply, and once the instructor accepts them, they work through
whatever content is published, at their own pace.

Guiding principles:

* **Fully dynamic**: no fixed course template. A course is a list of modules, and a module
  is a list of content items of any type, each with any number of file attachments.
* **The instructor stays in control**: draft / publish / unpublish / schedule at the
  course, module and item level, with a calendar of everything that is scheduled.
* **Gated learning**: registration → e-mail verification → login → apply →
  instructor approval → access to published content only.
* **Calm, professional UX**: clear hierarchy, keyboard friendly, responsive, dark mode.

## 2. Personas

| Persona | Goals | Pain points we solve |
|---|---|---|
| **Anna, instructor** (freelance DaF teacher) | Build A1–B2 courses quickly from her existing PDFs, slides and audio; release one unit per week; keep groups small | Scattered files, no control over release timing, manual sign-up lists |
| **Luca, learner** (moving to Berlin) | Find a course for his level, get accepted, learn on mobile and desktop, test himself | Unclear course structure, no feedback on progress |
| **Admin** (platform operator) | Manage users and roles, keep the platform healthy | — |

## 3. User stories

### 3.1 Account & access
| ID | Story | Acceptance criteria |
|---|---|---|
| A1 | As a visitor I can register as a **student** or **instructor** | Name, e-mail, password (≥ 8 chars, letter + digit); duplicate e-mail rejected |
| A2 | As a new user I receive a verification e-mail | Link `/verify-email?token=…` valid for 24 h; can resend |
| A3 | As a user I can only log in after verifying my e-mail | Login of an unverified account returns `EMAIL_NOT_VERIFIED`; UI offers resend |
| A4 | As a user I stay logged in securely | Short-lived JWT access token (15 min) in memory + rotating http-only refresh cookie (14 days) |
| A5 | As a user I can reset a forgotten password | Reset link valid for 1 h, single use |
| A6 | As a user I can edit my profile (name, bio, avatar) and change my password | — |

### 3.2 Course building (instructor)
| ID | Story | Acceptance criteria |
|---|---|---|
| C1 | Create a course with title, subtitle, description, CEFR level (A1–C2), tags, cover image, enrollment mode (approval required / open) and optional capacity | Slug generated and unique; course starts as **draft** |
| C2 | Organise content into **modules** and reorder them with drag & drop | Order persisted |
| C3 | Add **content items** of any type: Text, Document, Video, Audio, Image, Embed/Link, Quiz, Exam | Every item has rich-text body + any number of attachments |
| C4 | Upload **any file type** (pdf, docx, pptx, xlsx, txt, mp3, mp4, png, zip, …) via drag & drop with progress | Max size configurable (default 500 MB) |
| C5 | Reorder items within a module and move items between modules | — |
| C6 | Build quizzes/exams with single choice, multiple choice, true/false, short answer, fill-in-the-blank and essay questions, optionally with an audio/image per question (listening/reading comprehension) | Points per question, time limit, attempts, passing score, availability window, shuffle, show answers |
| C7 | Grade essay answers manually and give feedback | Attempt becomes `GRADED` once all manual answers are graded |
| C8 | Preview the course as a student would see it | — |
| C-REL | Control the pace per learner: open an item or module N days after enrollment, require other items (with a minimum quiz score), mark items optional, run the course module by module or step by step | Builder: item tab **Release**, module menu "Release rules…", course setting **Progression**; badges "Day +7", "Optional", lock count |
| C-DUP | Duplicate a lesson or module, and clone a whole course (optionally moving all dates) | Item/module menus "Duplicate"; "Clone course" in the course menu and the course list; the copy is a draft, enrollments are not copied |

### 3.3 Publishing & scheduling (instructor)
| ID | Story | Acceptance criteria |
|---|---|---|
| P1 | Publish / unpublish a course, a module or a single item instantly | Visibility updates immediately |
| P2 | Schedule publication (`publishAt`) and optional automatic unpublication (`unpublishAt`) | Shown as **Scheduled** until `publishAt`, **Expired** after `unpublishAt` |
| P3 | See a **schedule** (calendar + agenda) of every upcoming publish/unpublish event across all my courses | Filter by course; click navigates to the item |
| P4 | See the effective visibility status at a glance (Draft · Scheduled · Live · Expired) | Badges everywhere in the builder |

Visibility rule (evaluated at request time, so no background job is needed for correctness):

```
live(x) = x.publishStatus == PUBLISHED
          && (x.publishAt   == null || x.publishAt   <= now)
          && (x.unpublishAt == null || x.unpublishAt >  now)
learner sees item  ⇔ live(course) && live(module) && live(item)
```

### 3.4 Enrollment (student & instructor)
| ID | Story | Acceptance criteria |
|---|---|---|
| E1 | As a visitor I can browse/search the catalog and open a course page (outline, instructor, level) without logging in | Only live courses; outline shows titles of live modules/items |
| E2 | As a verified student I can **apply** to a course with an optional message | Status `PENDING`; `OPEN` courses approve instantly |
| E3 | As an instructor I see a **waiting list** per course (ordered by application time) and approve / reject (with reason) / revoke, individually or in bulk | Capacity respected; student notified (in-app + e-mail) |
| E4 | As a student I see the status of my applications and can withdraw | — |
| E5 | As an approved student I see **only live content** of the course | Draft/scheduled/expired content is invisible and inaccessible (403/404 on direct URL) |

### 3.5 Learning (student)
| ID | Story | Acceptance criteria |
|---|---|---|
| L1 | Learn in a focused player: outline sidebar, content area, previous/next | Responsive; sidebar collapses on mobile |
| L2 | View PDFs, images, video and audio inline; download office files | Media streamed with HTTP range support |
| L3 | Mark items complete and see course progress | Progress % per course |
| L4 | Take quizzes/exams with timer and attempt limit; see score and (if allowed) correct answers | Auto-grading for objective questions; essay = pending until graded |
| L5 | Receive in-app notifications (application approved/rejected, essay graded) | Bell with unread count |
| L6 | See which lessons are not open yet and why | Lock icon in the outline with "Available from 19 Oct" or "Complete “X” first"; a friendly locked page with links to what is missing; unlocks as soon as I finish the prerequisite |
| L7 | Progress only counts what is required | Optional lessons are marked "Optional"; the progress bar reads "x of y required items done" |

### 3.6 Administration
| ID | Story |
|---|---|
| AD1 | As an admin I can list/search users, change their role, enable/disable accounts |
| AD2 | As an admin I see platform statistics |

### 3.7 Certificates
"Can I download a certificate after finishing a course?" – yes.

| ID | Story | Acceptance criteria |
|---|---|---|
| Z1 | As an instructor I switch certificates on for a course and set the requirements: required progress (default 100 %), all quizzes and exams passed (default on, so essays must be graded), optional minimum average score | Course builder tab **Certificate** (`?tab=certificate`) |
| Z2 | As an instructor I design the certificate: title (default "Certificate of Completion" / "Teilnahmebestätigung", or "Zertifikat", or my own), CEFR level shown, signer name and role, optional signature image, organisation, a short personal text, the language (learner's language or fixed EN/DE) and whether the final score is printed | A live preview next to the form looks exactly like the PDF |
| Z3 | As a learner I see in the course player what is still missing for my certificate | "Certificate" entry at the end of the outline with a checklist (progress 72 % / 100 %, quizzes and exams 1 / 2, essays awaiting grading, …) |
| Z4 | As a learner I automatically receive my certificate as soon as I meet all requirements, with an in-app notification and an e-mail in my language | Issued once (idempotent), after item completion, quiz/exam submission or grading |
| Z5 | As a learner I download my certificate as a beautiful A4 PDF, copy its verification link and add it to my LinkedIn profile | PDF with umlauts, logo, signature, certificate ID and QR code; celebratory card (confetti only without reduced motion) |
| Z6 | As a learner I find all my certificates on my dashboard | "My certificates" section with downloads; a certificate badge on completed course cards |
| Z7 | As an instructor I see all issued certificates of a course, search them, export them as CSV, download any PDF, issue a certificate manually (override) and revoke one with a reason | Confirm dialogs; the learner is notified about a revocation |
| Z8 | As an employer or school I check a certificate on a public page via its QR code or ID | `/certificates/verify/{code}` shows "Valid certificate", "Certificate revoked" or "Certificate not found", with the learner's name, course, level, dates, instructor and organisation – never the e-mail address |

### 3.8 Announcements
| ID | Story | Acceptance criteria |
|---|---|---|
| N1 | As an instructor I post an announcement to everyone in my course (approved learners) or to selected learners | Course builder tab **Announcements** (`?tab=announcements`): title, rich text, audience, e-mail toggle, pin |
| N2 | As an instructor I save drafts, schedule an announcement for later or send it right away | Send confirmation shows the number of recipients; scheduled ones go out automatically within a minute |
| N3 | As an instructor I see which announcements went out and how many learners read them | List with status (Draft · Scheduled · Sent), date, recipients and read %, plus edit, duplicate and delete |
| N4 | As a learner I get a notification (and, if the instructor chose it, an e-mail in my language) for each announcement | In-app notification links to the course's announcement feed |
| N5 | As a learner I read the announcements of a course in the course player | "Announcements" entry with an unread badge at the top of the outline; feed with pinned ones first; viewing marks them read; unread hint on my dashboard course cards |

### 3.9 Messaging
| ID | Story | Acceptance criteria |
|---|---|---|
| M1 | As a learner I can message the instructor of a course I am enrolled in (or have applied to) | "Message instructor" in the course player and on the course page |
| M2 | As an instructor I can message any learner of my courses | "Message" on the Students tab rows and on a learner's report page |
| M3 | As a user I have one inbox with all my conversations | `/messages`: list with search, unread dots, course chip and time; thread with date separators, Enter to send, Shift+Enter for a new line; on phones list and thread are separate screens |
| M4 | As a user I see new messages without reloading | Open threads refresh every 10 s, the header badge every 60 s; screen readers announce new messages |
| M5 | As a user I am told by e-mail when a message stays unread | At most one e-mail per conversation every 30 minutes, only if the message is still unread after 2 minutes |
| M6 | As the platform we prevent abuse | Only instructor ↔ learner (and admin) conversations; 30 messages per minute and user (429) |
