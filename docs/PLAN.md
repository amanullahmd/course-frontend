# Sprachweg — Development Plan

Domain model, architecture, API contract and phases. Product story: [STORY.md](STORY.md).

---

## 4. Domain model

```
User (id, fullName, email, passwordHash, role[STUDENT|INSTRUCTOR|ADMIN], emailVerified, enabled, bio, avatar→MediaAsset)
VerificationToken (token, user, type[EMAIL_VERIFY|PASSWORD_RESET], expiresAt, usedAt)
RefreshToken (tokenHash, user, expiresAt, revokedAt)
MediaAsset (id, owner, originalName, contentType, sizeBytes, kind, storageKey, createdAt)
Course (id, slug, title, subtitle, description, level[A1..C2], tags, coverImage→MediaAsset, instructor→User,
        enrollmentMode[APPROVAL|OPEN], capacity?, publishStatus[DRAFT|PUBLISHED], publishAt?, unpublishAt?)
CourseModule (id, course, title, description, position, publishStatus, publishAt?, unpublishAt?)
ContentItem (id, module, type[TEXT|DOCUMENT|VIDEO|AUDIO|IMAGE|EMBED|QUIZ|EXAM], title, summary, body(html),
             externalUrl?, durationMinutes?, position, publishStatus, publishAt?, unpublishAt?, attachments→MediaAsset[])
Assessment (item 1:1, instructions, timeLimitMinutes?, maxAttempts, passingScore, shuffleQuestions,
            showCorrectAnswers, availableFrom?, availableUntil?)
Question (id, assessment, type[SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER|FILL_BLANK|ESSAY],
          prompt, explanation, points, position, caseSensitive, acceptedAnswers[], media→MediaAsset?)
QuestionOption (id, question, text, correct, position)
Attempt (id, assessment, student, status[IN_PROGRESS|SUBMITTED|GRADED], startedAt, deadline?, submittedAt, score, maxScore)
AttemptAnswer (id, attempt, questionId, selectedOptionIds, textAnswer, correct?, pointsAwarded?, feedback)
Enrollment (id, course, student, status[PENDING|APPROVED|REJECTED|WITHDRAWN|REVOKED], message, decisionReason, appliedAt, decidedAt)
ItemProgress (student, item, completedAt)
Notification (id, user, type, title, body, link, readAt, createdAt)
CertificateSettings (course 1:1, enabled, minProgressPercent, requireAssessmentsPassed, minAverageScore?, showScore, title?,
                     level?, signerName?, signerTitle?, signatureImage→MediaAsset?, organization?, customText?, language[LEARNER|EN|DE])
Certificate (id, code, course, student, learnerName, courseTitle, level, instructorName, signerTitle, organization, title,
             completedAt, finalScore?, issueType[AUTOMATIC|MANUAL], issuedBy?, issuedAt, revokedAt?, revokedReason?, revokedBy?)
Announcement (id, course, author, title ≤200, body (sanitized html ≤20k), audience[ALL_APPROVED|SELECTED], selectedUserIds[],
              sendEmail, pinned, status[DRAFT|SCHEDULED|SENT], scheduledAt?, sentAt?, createdAt, updatedAt)
AnnouncementRecipient (announcement, user, readAt?, emailedAt?, createdAt)      (who received a sent announcement)
Conversation (id, course? (context, null = general), participantA, participantB (canonical order), pairKey (unique),
              aLastReadAt?, bLastReadAt?, aMailPendingSince?, bMailPendingSince?, aLastEmailedAt?, bLastEmailedAt?,
              lastMessageAt?, lastMessagePreview?, lastMessageSenderId?, createdAt)
Message (id, conversation, sender, body (plain text ≤5000), createdAt)
```

## 5. Architecture

```
┌──────────────────────────┐   HTTPS/JSON (Bearer JWT)    ┌───────────────────────────────┐
│ Next.js 16 (App Router)  │ ───────────────────────────▶ │ Spring Boot 4.1.1 (Java 25)    │
│ React 19, TypeScript,    │ ◀─── refresh cookie (httpOnly)│ Spring MVC · Security 7 (JWT) │
│ Tailwind 4, TanStack     │                               │ Data JPA/Hibernate · Flyway   │
│ Query, RHF + Zod, Tiptap │   signed media URLs (range)   │ Mail (Resend SMTP) · OpenAPI  │
└──────────────────────────┘ ───────────────────────────▶ │ Local file storage (pluggable)│
                                                           └──────────────┬────────────────┘
                                                                          │
                                                    PostgreSQL 17 (prod) / H2 (dev & tests)
```

* **Backend**: layered by feature (`auth`, `user`, `course`, `content`, `assessment`,
  `enrollment`, `media`, `progress`, `notification`, `schedule`, `admin`), each with
  `controller → service → repository`, DTO records, Bean Validation, RFC 7807
  `ProblemDetail` errors, Flyway migrations, YAML configuration with `dev` and `prod` profiles.
* **Security**: stateless JWT (HS256 via Spring Security's OAuth2 resource server), BCrypt,
  role-based method security, ownership checks in services, rotating refresh tokens stored hashed,
  signed time-limited media URLs, so `<video>`/`<audio>`/`<iframe>` work without headers.
* **Frontend**: App Router with route groups `(marketing)`, `(auth)`, `(app)`; client-side
  auth provider with silent refresh; TanStack Query for server state; accessible primitives
  (Radix) styled with Tailwind; drag & drop with dnd-kit; rich text with Tiptap.

### 5.1 E-mail delivery (Resend SMTP)

Transactional e-mails (verification, password reset, enrollment decisions, new application) are sent
asynchronously through Spring Mail.

| Environment | Transport | Configuration |
|---|---|---|
| `dev` (default) | Logged to the console (`app.mail.enabled=false`), so links can be copied from the log | — |
| Docker Compose (local) | Mailpit catch-all SMTP, UI at http://localhost:8025 | `MAIL_HOST=mailpit`, `MAIL_PORT=1025` |
| `prod` | **Resend SMTP** | host `smtp.resend.com`, port `587` (STARTTLS) or `465` (SSL), username `resend`, password = `RESEND_API_KEY`, sender `MAIL_FROM` on a domain verified in Resend |

### 5.2 Domains & naming

| Item | Value |
|---|---|
| Frontend (Next.js) | `https://course.amanullah.me` |
| Backend API (Spring Boot) | `https://api.course.amanullah.me` (same site as the frontend, so the `SameSite=Lax` refresh cookie works) |
| Java base package / Maven groupId | `me.amanullah.course` (reverse domain of `course.amanullah.me`) |
| E-mail sender | `no-reply@course.amanullah.me` (domain verified in Resend) |

## 6. REST API contract (base `/api`)

Conventions: JSON, UUID ids, ISO-8601 UTC instants, errors as `ProblemDetail`
`{type,title,status,detail,code,errors?:{field:msg},traceId?}`; pages as
`{content:[],page,size,totalElements,totalPages}` (page is 0-based; `size` is clamped to 1–100, `page` to ≥ 0).
Languages: English (default) and German; `detail` and `errors` messages follow `Accept-Language` (`en`|`de`).
Client mistakes are always 4xx with a stable `code`; a 500 has `code=INTERNAL_ERROR` and a `traceId`.

### Auth `/api/auth`
| Method | Path | Body → Response |
|---|---|---|
| POST | `/register` | `{fullName,email,password,role:"STUDENT"\|"INSTRUCTOR",locale?:"en"\|"de"}` → 201 `{message}` (locale defaults to `Accept-Language`, else `en`) |
| POST | `/verify-email` | `{token}` → `{message}` |
| POST | `/resend-verification` | `{email}` → `{message}` |
| POST | `/login` | `{email,password}` → `AuthResponse` + `Set-Cookie: refresh_token` (403 `code=EMAIL_NOT_VERIFIED`) |
| POST | `/refresh` | cookie → `AuthResponse` (rotated cookie) |
| POST | `/logout` | → 204 |
| POST | `/forgot-password` | `{email}` → `{message}` |
| POST | `/reset-password` | `{token,password}` → `{message}` |

`AuthResponse = {accessToken, expiresIn, user: UserDto}`
`UserDto = {id, fullName, email, role, emailVerified, bio, avatarUrl, avatarMediaId, locale:"en"|"de", createdAt}`

### Me `/api/users/me`
`GET` → UserDto · `PUT {fullName,bio,avatarMediaId}` → UserDto · `PUT /password {currentPassword,newPassword}` → 204 ·
`PUT /locale {locale:"en"|"de"}` → 204 (language of e-mails and notifications)

### Public catalog `/api/public`
* `GET /courses?q=&level=&page=&size=` → Page<CourseSummaryDto>
* `GET /courses/{slug}` → CoursePublicDto

`CourseSummaryDto = {id, slug, title, subtitle, level, tags, coverImageUrl, instructor:{id,fullName,avatarUrl}, studentCount, moduleCount, itemCount, enrollmentMode, publishedAt}`
`CoursePublicDto = CourseSummaryDto + {description, capacity, instructor:{id,fullName,bio,avatarUrl}, outline:[{id,title,description,items:[{id,title,type,durationMinutes}]}]}`

### Media `/api/media`
* `POST` multipart `file` → MediaDto
* `GET /{id}` → MediaDto (owner)
* `DELETE /{id}` → 204 (owner)
* `GET /{id}/content?expires=&sig=&download=` → binary stream, `Range` supported; no auth header needed, only a valid signature

`MediaDto = {id, fileName, contentType, sizeBytes, kind:"DOCUMENT"|"VIDEO"|"AUDIO"|"IMAGE"|"ARCHIVE"|"OTHER", url, createdAt}` (`url` is an absolute, signed, time-limited URL)

### Instructor `/api/instructor` (role INSTRUCTOR or ADMIN; ownership enforced)
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | `{courseCount,liveCourseCount,studentCount,pendingCount,upcoming:ScheduleEvent[],recentApplications:EnrollmentDto[]}` |
| GET | `/courses` | `InstructorCourseDto[]` |
| POST | `/courses` | `CourseUpsert` → CourseDto |
| GET/PUT/DELETE | `/courses/{id}` | CourseDto (full tree incl. drafts) |
| PUT | `/courses/{id}/publication` | `PublicationRequest` → CourseDto |
| POST | `/courses/{id}/modules` | `{title,description}` → ModuleDto |
| PUT | `/courses/{id}/modules/order` | `{ids:[]}` → 204 |
| PUT/DELETE | `/modules/{id}` | ModuleDto |
| PUT | `/modules/{id}/publication` | `PublicationRequest` → ModuleDto |
| POST | `/modules/{id}/items` | `ItemUpsert` → ContentItemDto |
| PUT | `/modules/{id}/items/order` | `{ids:[]}` → 204 (ids may come from other modules: they are moved) |
| GET/PUT/DELETE | `/items/{id}` | ContentItemDto |
| PUT | `/items/{id}/publication` | `PublicationRequest` → ContentItemDto |
| GET/PUT | `/items/{id}/assessment` | AssessmentDto (PUT replaces settings and questions; questions/options with an existing `id` are updated, without `id` created, missing ones deleted) |
| GET | `/items/{id}/attempts` | `AttemptSummaryDto[]` |
| GET | `/attempts/{id}` | AttemptResultDto (instructor view) |
| POST | `/attempts/{id}/grade` | `{grades:[{questionId,pointsAwarded,feedback}]}` → AttemptResultDto |
| GET | `/courses/{id}/enrollments?status=` | `EnrollmentDto[]` (PENDING ordered by appliedAt → waitlist) |
| POST | `/enrollments/{id}/approve` · `/reject {reason}` · `/revoke {reason}` | EnrollmentDto (approve: PENDING/REJECTED, or restores REVOKED/WITHDRAWN; 409 `CAPACITY_REACHED` when full; revoke = "remove from course") |
| POST | `/enrollments/bulk` | `{ids:[],action:"APPROVE"\|"REJECT"\|"REVOKE",reason?,courseId?}` → EnrollmentDto[]; all or nothing (409 `INVALID_STATUS`/`CAPACITY_REACHED` changes nothing); with `courseId` every id must belong to it (400 `errors["ids[i]"]`) |
| POST | `/courses/{id}/enrollments/add` | `{emails:[1–200],message?,invite?}` → `{added:EnrollmentDto[],alreadyEnrolled:[email],invited:[email],notFound:[email],skipped:[{email,code}]}` (owner/admin; addresses trimmed, de-duplicated, lower-cased; invalid → 400 `errors["emails[i]"]`) |
| GET | `/schedule?from=&to=&courseId=` | `ScheduleEventDto[]` |

```
CourseUpsert       = {title, subtitle, description, level, tags[], coverImageId?, enrollmentMode, capacity?}
PublicationRequest = {publishStatus:"DRAFT"|"PUBLISHED", publishAt?, unpublishAt?}
Visibility         = "DRAFT"|"SCHEDULED"|"LIVE"|"EXPIRED"   (computed)
CourseDto          = {id, slug, title, subtitle, description, level, tags, coverImage:MediaDto?, enrollmentMode, capacity,
                      publishStatus, publishAt, unpublishAt, visibility, studentCount, pendingCount,
                      modules: ModuleDto[], createdAt, updatedAt}
InstructorCourseDto= {id, slug, title, subtitle, level, coverImageUrl, publishStatus, publishAt, unpublishAt, visibility,
                      studentCount, pendingCount, moduleCount, itemCount, updatedAt}
ModuleDto          = {id, courseId, title, description, position, publishStatus, publishAt, unpublishAt, visibility, items: ContentItemDto[]}
ItemUpsert         = {type, title, summary, body, externalUrl, durationMinutes, attachmentIds[]}
ContentItemDto     = {id, moduleId, courseId, type, title, summary, body, externalUrl, durationMinutes, position,
                      publishStatus, publishAt, unpublishAt, visibility, attachments: MediaDto[],
                      assessment: {questionCount,totalPoints,timeLimitMinutes}? , createdAt, updatedAt}
AssessmentDto      = {itemId, instructions, timeLimitMinutes?, maxAttempts (0 = unlimited), passingScore (0-100),
                      shuffleQuestions, showCorrectAnswers, availableFrom?, availableUntil?, questions: QuestionDto[]}
QuestionDto        = {id?, type, prompt, explanation, points, position, caseSensitive, acceptedAnswers[], mediaId?, media?: MediaDto,
                      options:[{id?, text, correct, position}]}
EnrollmentDto      = {id, courseId, courseTitle, student:{id,fullName,email,avatarUrl}, status, message, decisionReason,
                      appliedAt, decidedAt, waitlistPosition?, progressPercent}
ScheduleEventDto   = {id, entityType:"COURSE"|"MODULE"|"ITEM", entityId, courseId, courseTitle, title, itemType?,
                      action:"PUBLISH"|"UNPUBLISH"|"OPENS"|"CLOSES", at}   (OPENS/CLOSES = availableFrom/availableUntil of a
                      quiz/exam, entityType ITEM, id "ITEM:<itemId>:OPENS")
AttemptSummaryDto  = {id, student:{id,fullName,email,avatarUrl}, status, startedAt, submittedAt, score, maxScore, percent, passed, pendingManualGrading,
                      late, autoSubmitted}   (autoSubmitted: submitted by the server with the autosaved answers when time ran out)
AttemptResultDto   = AttemptSummaryDto + {itemId, itemTitle, deadline, answers:[{questionId, type, prompt, points, selectedOptionIds[], textAnswer,
                      correct?, pointsAwarded?, feedback, options?:[{id,text,correct?}], acceptedAnswers?[]}]}
```

#### Reports `/api/instructor` (owner or admin; foreign courses/items → 404, students → 403)
| Method | Path | Notes |
|---|---|---|
| GET | `/courses/{id}/reports/overview` | `OverviewDto` |
| GET | `/courses/{id}/reports/gradebook` | `GradebookDto` (approved learners × live quizzes/exams, plus ones with attempts) |
| GET | `/courses/{id}/reports/students/{studentId}` | `StudentReportDto` (any enrollment status; no enrollment → 404 `ENROLLMENT_NOT_FOUND`) |
| GET | `/items/{id}/reports/assessment` | `AssessmentAnalyticsDto` (non-quiz item → 404 `ASSESSMENT_NOT_FOUND`) |
| GET | `/courses/{id}/reports/gradebook.csv` | gradebook: per assessment best %, status, attempts → `gradebook-<slug>-<yyyy-MM-dd>.csv` |
| GET | `/courses/{id}/reports/progress.csv` | learner progress table (activity, completion, lessons, quizzes/exams taken, averages, per-assessment result) → `progress-<slug>-<date>.csv` |
| GET | `/courses/{id}/reports/students/{studentId}.csv` | learner report (profile row, item progress rows, attempt rows) → `learner-<slug>-<name>-<date>.csv` |
| GET | `/items/{id}/reports/attempts.csv` | one row per attempt with points per question → `attempts-<slug>-<item>-<date>.csv` |

CSV: `text/csv; charset=UTF-8` with a BOM, `,` delimiter, CRLF, RFC 4180 quoting, `.` decimals, timestamps
`yyyy-MM-dd HH:mm` UTC, headers and labels localized by `Accept-Language`, text starting with `= + - @` prefixed with `'`.
Percentages are 0–100 with one decimal; "best" = best **graded** attempt; `null` when there is nothing to average.

```
CourseRef         = {id, slug, title}
OverviewDto       = {course, generatedAt, kpis:{approvedLearners, pendingApplications, averageProgress, medianProgress,
                     completionRate, completedLearners, assessments, averageBestScore, passRate, pendingGrading,
                     activeLearners7d, totalLiveItems},
                     progressDistribution:[{label:"0-25"|"25-50"|"50-75"|"75-100"|"100", from, to, count}],
                     modules:[{moduleId, title, itemCount, completionPercent}],
                     funnel:{applied, pending, approved, rejected, withdrawn, revoked, approvalRate},
                     enrollmentTimeline:[{weekStart (Monday, UTC), applications, approvals}]  (last 12 weeks or since creation),
                     items:[{itemId, title, type, moduleId, moduleTitle, completed, completedPercent,
                             taken?, takenPercent?, passed?, averagePercent?}]}   (every live item in outline order)
GradebookDto      = {course, generatedAt, totalLiveItems,
                     columns:[{itemId, title, type:"QUIZ"|"EXAM", maxScore, passingScore,
                               stats:{graded, average, median, min, max, passRate, attempts, pendingGrading}}],
                     rows:[{id, fullName, email, avatarUrl, enrolledAt, progressPercent, completedItems, totalLiveItems,
                            lessonsCompleted, lessonsTotal, quizzesTaken, quizzesTotal, examsTaken, examsTotal,
                            averageQuizPercent, averageExamPercent, lastActivityAt,
                            activity:"NOT_STARTED"|"IN_PROGRESS"|"COMPLETED"|"INACTIVE", averagePercent, gradedAssessments,
                            cells:[{itemId, bestPercent, bestScore, attempts, passed,
                                    status:"NOT_STARTED"|"IN_PROGRESS"|"SUBMITTED_PENDING"|"GRADED",
                                    latestAttemptId, lastSubmittedAt}]}]}
StudentReportDto  = {course, generatedAt, student:{id,fullName,email,avatarUrl}, enrollment:{id,status,appliedAt,decidedAt},
                     progressPercent, completedItems, totalLiveItems, lastActivityAt,
                     modules:[{moduleId,title,completedItems,totalItems,progressPercent,items:[{itemId,title,type,completedAt}]}],
                     attempts:[{id,itemId,itemTitle,itemType,status,startedAt,submittedAt,score,maxScore,percent,passed,late,
                                autoSubmitted,pendingManualGrading}],
                     totals:{attempts,assessmentsAttempted,assessmentsPassed,assessments,averageBestPercent,pendingGrading},
                     feedbackCount}
AssessmentAnalyticsDto = {itemId, title, type, course, generatedAt, maxScore, passingScore, attempts (submitted),
                     uniqueLearners, gradedAttempts, pendingGrading, inProgress, averagePercent, medianPercent, averageScore,
                     passRate, averageDurationSeconds, scoreDistribution:[10 × {label:"0-10"…"90-100", from, to, count}],
                     questions:[{questionId, position, prompt (plain text), type, points, answered, unanswered,
                                 percentCorrect, averagePoints, commonWrongAnswers:[{text,count}] (top 3)}]}
```
Activity: `COMPLETED` at 100 %, `INACTIVE` without progress/attempt activity for 14+ days, `NOT_STARTED` without any
activity, else `IN_PROGRESS`. A quiz/exam counts as *taken* with at least one submitted attempt. Cell status:
`SUBMITTED_PENDING` (an attempt awaits manual grading; `latestAttemptId` points to it) > `GRADED` > `IN_PROGRESS` >
`NOT_STARTED`.

### Student / learner `/api/student` (any authenticated, verified user)
| Method | Path | Notes |
|---|---|---|
| POST | `/courses/{courseId}/enrollments` | `{message}` → EnrollmentDto |
| GET | `/courses/{courseId}/enrollment` | EnrollmentDto or 404 |
| GET | `/enrollments` | `StudentEnrollmentDto[] = {id,status,message,decisionReason,appliedAt,decidedAt,waitlistPosition,progressPercent,course:CourseSummaryDto}` |
| POST | `/enrollments/{id}/withdraw` | EnrollmentDto |
| GET | `/courses/{courseId}/learn` | `LearnCourseDto = {course:CourseSummaryDto+description, progressPercent, modules:[{id,title,description,items:[{id,title,type,durationMinutes,completed}]}]}` (live only, APPROVED only) |
| GET | `/items/{itemId}` | `LearnItemDto = {id,courseId,moduleId,type,title,summary,body,externalUrl,durationMinutes,attachments:MediaDto[],completed,prevItemId,nextItemId,assessment?:{instructions,timeLimitMinutes,maxAttempts,passingScore,questionCount,totalPoints,availableFrom,availableUntil,attemptsUsed,bestPercent,inProgressAttemptId}}` |
| POST/DELETE | `/items/{itemId}/complete` | 204 |
| GET | `/items/{itemId}/attempts` | AttemptSummaryDto[] (mine) |
| POST | `/items/{itemId}/attempts` | → `AttemptSessionDto = {id,status,startedAt,deadline,timeLimitMinutes,availableUntil,serverTime,questions:[{id,type,prompt,points,media?,options:[{id,text}]}],savedAnswers:[{questionId,selectedOptionIds[],textAnswer}]}` (resumes the in-progress attempt with its saved answers; an expired one is auto-submitted first, then a new attempt starts or 403/409; `deadline` = time limit capped at `availableUntil`, or `availableUntil` alone) |
| PUT | `/attempts/{id}/answers` | `{answers:[{questionId,selectedOptionIds[],textAnswer}]}` → 204: autosave of draft answers (owner only, not graded; unknown ids ignored); 409 `ATTEMPT_ALREADY_SUBMITTED`, or 409 `ATTEMPT_EXPIRED` after deadline + 30 s grace (the attempt is then auto-submitted) |
| POST | `/attempts/{id}/submit` | `{answers:[{questionId,selectedOptionIds[],textAnswer}]}` → AttemptResultDto (after deadline + 30 s grace the payload is ignored and the saved answers are submitted: `autoSubmitted=true`) |
| GET | `/attempts/{id}` | AttemptResultDto (correct answers only if `showCorrectAnswers`) |

Expired in-progress attempts (deadline or window end + 30 s grace) are also submitted automatically by a background
job every 60 s and lazily whenever attempts are read, with `submittedAt` = the effective deadline.

### Notifications `/api/notifications`
`GET ?page=&size=` → Page<{id,type,title,body,link,read,createdAt}> · `GET /unread-count` → `{count}` ·
`POST /{id}/read` · `POST /read-all`

### Certificates
Course completion certificates (A4 landscape PDF, en/de). Instructor endpoints: owner or admin (foreign courses and
certificates → 404, students → 403). Learner endpoints: any verified user; course status needs an approved enrollment
(403 `NOT_ENROLLED`, owners/admins see a preview without issuing).

| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/api/instructor/courses/{id}/certificate-settings` | `CertificateSettingsDto` / `CertificateSettingsUpdate`; saving with `enabled` issues certificates for approved learners who already qualify |
| GET | `/api/instructor/courses/{id}/certificates?q=` | `InstructorCertificateDto[]` (newest first, incl. revoked; `q` matches name, e-mail, code) |
| POST | `/api/instructor/courses/{id}/certificates/issue` | `{studentId}` → InstructorCertificateDto (override, criteria not checked; needs an APPROVED enrollment → else 404 `ENROLLMENT_NOT_FOUND`; 409 `CERTIFICATE_EXISTS`) |
| POST | `/api/instructor/certificates/{id}/revoke` | `{reason}` (1–500) → InstructorCertificateDto (409 `CERTIFICATE_REVOKED`); learner notified |
| GET | `/api/instructor/certificates/{id}/pdf?lang=` | `application/pdf` attachment; revoked ones carry a "revoked" stamp |
| GET | `/api/student/certificates` | `CertificateDto[]` (mine, incl. revoked) |
| GET | `/api/student/courses/{courseId}/certificate` | `CertificateStatusDto` (lazily issues when the criteria are met) |
| GET | `/api/student/certificates/{id}/pdf?lang=en\|de` | `application/pdf` attachment, owner only (others → 404 `CERTIFICATE_NOT_FOUND`; revoked → 409 `CERTIFICATE_REVOKED`), file name e.g. `Zertifikat-Deutsch-A1-Luca-Rossi.pdf` |
| GET | `/api/public/certificates/{code}` | `VerificationDto`, no auth; unknown/malformed code → 404 `CERTIFICATE_NOT_FOUND`; > 60 lookups/min per IP → 429 `RATE_LIMITED` |

```
CertificateSettingsUpdate = {enabled, minProgressPercent (0-100), requireAssessmentsPassed, minAverageScore? (0-100), showScore,
                      title? (≤80, null = "Certificate of Completion"/"Teilnahmebestätigung"), level? (null = course level),
                      signerName? (≤120, null = instructor's name), signerTitle? (≤80), signatureImageId? (own PNG/JPEG/GIF upload),
                      organization? (≤120), customText? (≤400), language:"LEARNER"|"EN"|"DE"}
CertificateSettingsDto = CertificateSettingsUpdate − signatureImageId + {courseId, signatureImage:MediaDto?, courseLevel, courseTitle,
                      defaultSignerName, issuedCount (valid certificates), updatedAt?}
CertificateDto     = {id, code, courseId, courseTitle, learnerName, level, title?, completedAt, issuedAt, finalScore?, instructorName,
                      organization?, status:"ACTIVE"|"REVOKED", issueType:"AUTOMATIC"|"MANUAL", revokedAt?, revokedReason?,
                      verificationUrl, signerTitle?, customText?, showScore, signatureImageUrl?, language:"en"|"de"}
InstructorCertificateDto = {id, code, student:{id,fullName,email,avatarUrl}, learnerName, courseTitle, level, completedAt, issuedAt,
                      finalScore?, status, issueType, issuedByName?, revokedAt?, revokedReason?, verificationUrl}
CertificateStatusDto = {status:"NOT_ENABLED"|"IN_PROGRESS"|"ISSUED"|"REVOKED", criteriaMet, certificate?:CertificateDto,
                      criteria:[{key:"PROGRESS"|"ASSESSMENTS_PASSED"|"AVERAGE_SCORE", met, current?, target?, pending}]}
VerificationDto    = {code, valid, revoked, learnerName, courseTitle, level, title?, completedAt, issuedAt, revokedAt?,
                      instructorName, organization?}   (no e-mail, no ids)
```
Criteria: PROGRESS = live-item progress ≥ `minProgressPercent`; ASSESSMENTS_PASSED (optional) = every live quiz/exam with
questions has a GRADED attempt ≥ its passing score (`pending` = submissions awaiting grading); AVERAGE_SCORE (optional) =
mean of the best graded percent per quiz/exam ≥ `minAverageScore` (met when the course has none). The same mean is the
`finalScore`. Certificates are issued automatically (re-checked after commit when an item is completed or an attempt
becomes GRADED, when the settings are saved and when the learner opens the status), at most one active certificate per
learner and course (DB unique constraint), never re-issued automatically after a revocation. Codes:
`SW-<year>-XXXX-XXXX-XXXX` (60 random bits, Crockford base32). The QR code on the PDF points to
`{frontend}/certificates/verify/{code}`.

### Announcements (course news from the instructor)
Instructor endpoints: owner or admin (foreign courses/announcements → 404 `COURSE_NOT_FOUND` / `ANNOUNCEMENT_NOT_FOUND`,
students → 403). Learner endpoints: an APPROVED enrollment in the live course (else 403 `NOT_ENROLLED`; the owner/admin
gets a preview of every sent announcement).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/instructor/courses/{courseId}/announcements` | `AnnouncementDto[]` (drafts and scheduled first, then sent, newest first) |
| POST | `/api/instructor/courses/{courseId}/announcements` | `AnnouncementUpsert` → 201 AnnouncementDto |
| GET/PUT/DELETE | `/api/instructor/announcements/{id}` | PUT on a SENT announcement only changes title, body and pinned (no new notifications) |
| POST | `/api/instructor/announcements/{id}/send` | send a DRAFT/SCHEDULED one now → AnnouncementDto (409 `INVALID_STATUS` if already sent, 409 `NO_RECIPIENTS` if it would reach nobody) |
| GET | `/api/student/courses/{courseId}/announcements` | `LearnerAnnouncementDto[]`: sent announcements addressed to me, pinned first, then newest |
| POST | `/api/student/announcements/{id}/read` | 204 (idempotent; 404 if not addressed to me) |
| GET | `/api/student/announcements/unread` | `[{courseId,count}]` for courses with unread announcements (dashboard hint) |

```
AnnouncementUpsert = {title (1-200), body (html, sanitized, ≤20000 after sanitizing, not empty), audience:"ALL_APPROVED"|"SELECTED",
                      recipientIds[] (SELECTED: 1-500 approved learners of the course, else 400 errors.recipientIds),
                      sendEmail, pinned, status:"DRAFT"|"SCHEDULED" (default DRAFT), scheduledAt? (required and in the future for SCHEDULED)}
AnnouncementDto    = {id, courseId, courseTitle, author:{id,fullName,avatarUrl}, title, body, audience, recipientIds[], sendEmail, pinned,
                      status:"DRAFT"|"SCHEDULED"|"SENT", scheduledAt?, sentAt?, createdAt, updatedAt,
                      recipientCount, readCount, readPercent}   (unsent: recipientCount = learners it would reach right now)
LearnerAnnouncementDto = {id, courseId, author, title, body, pinned, sentAt, updatedAt, edited, read}
```
Sending resolves the recipients at that moment (APPROVED, enabled learners; SELECTED ids that are no longer approved are
skipped), stores them for read tracking, creates an `ANNOUNCEMENT` notification (link `/learn/{courseId}/announcements`)
and, with `sendEmail`, queues an e-mail per recipient in their language (subject `[Course title] Announcement title`,
the sanitized HTML and a "View announcement" button; sent after commit). SCHEDULED announcements are sent by a job every
60 s once `scheduledAt` has passed (`app.announcements.scheduler.*`).

### Direct messages `/api/messages` (any authenticated user)
Rules: a learner may message the instructor of a course they are APPROVED or PENDING in; an instructor may message any
learner with an enrollment (any status) in one of their courses; admins may message anyone. With `courseId` the
relationship must exist in that course. In an existing conversation either side may reply while the relationship holds
in either direction (or one side is an admin). Otherwise 403 `MESSAGING_NOT_ALLOWED`; conversations of other people →
404 `CONVERSATION_NOT_FOUND`. At most 30 messages per user and minute (in memory, per instance) → 429 `RATE_LIMITED`
with `Retry-After` (seconds).

| Method | Path | Notes |
|---|---|---|
| GET | `/conversations?q=&page=&size=` | Page<ConversationDto>, conversations with messages, most recent first; `q` matches the other person's name or the course title |
| POST | `/conversations` | `{recipientId, courseId?, body}` → 201 ConversationDto: creates or reuses the conversation (one per course or "general" and pair) and sends the first message |
| GET | `/conversations/with/{userId}?courseId=` | the existing conversation with that user, else 404 (used by "Message" buttons) |
| GET | `/conversations/{id}` | ConversationDto |
| GET | `/conversations/{id}/messages?before=&size=` | `MessagePageDto`: newest page first (size 1-100, default 30), `before` = `nextCursor` of the previous page (a message id) |
| POST | `/conversations/{id}/messages` | `{body}` → 201 MessageDto |
| POST | `/conversations/{id}/read` | 204: marks the conversation (and its MESSAGE notifications) read |
| GET | `/unread-count` | `{count, conversations}` (unread messages / conversations with unread messages) |

```
ConversationDto = {id, course:{id,title}?, other:{id,fullName,avatarUrl,role}, lastMessage:{preview,senderId,mine,createdAt}?,
                   lastMessageAt?, unreadCount, createdAt}
MessageDto      = {id, conversationId, senderId, mine, body (plain text, 1-5000 after trimming), createdAt,
                   read}   (mine: read by the other participant; theirs: read by me)
MessagePageDto  = {items: MessageDto[] (chronological), hasMore, nextCursor?}
```
Notifications: a new message creates a `MESSAGE` notification (link `/messages/{conversationId}`) unless the recipient
still has an unread one for that conversation. E-mail ("You have a new message from X", recipient's language, with a
short preview): sent by a job every 60 s only when a message is **still unread 2 minutes** after it arrived, and **at
most once per conversation and recipient every 30 minutes** (reading or replying cancels the pending e-mail; while
throttled, the e-mail follows once the 30 minutes have passed if the messages are still unread).

### Admin `/api/admin` (ADMIN)
`GET /stats` → `{users,students,instructors,courses,liveCourses,enrollments}` ·
`GET /users?q=&role=&page=&size=` → Page<UserDto + enabled> · `PUT /users/{id} {role,enabled}` → UserDto

## 7. Development plan

| Phase | Backend | Frontend | Exit criteria |
|---|---|---|---|
| **0. Foundations** | Maven project, YAML profiles, Flyway baseline, error handling, OpenAPI | Next.js app, design system (tokens, components), layout shells | Both apps start |
| **1. Identity** | Register, verify mail, login, refresh rotation, reset password, profile | Auth pages, auth provider, guarded routes | Full sign-up → verify → login flow |
| **2. Course builder** | Courses, modules, items, media upload/streaming, ordering | Instructor dashboard, course list, builder with drag & drop, item editor, uploader | Instructor can build a course with files |
| **3. Publishing** | Publication rules, visibility, schedule endpoint | Publish/schedule controls, status badges, calendar + agenda | Scheduled content appears automatically |
| **4. Enrollment** | Apply, waitlist, approve/reject/revoke, notifications, e-mails | Catalog, course page, apply flow, student dashboard, waitlist management | Student gets access after approval |
| **5. Learning** | Learner endpoints, progress | Learning player with viewers, progress | Student consumes live content |
| **6. Assessment** | Quiz/exam builder API, attempts, auto + manual grading | Question builder, quiz player with timer, results, grading UI | End-to-end quiz/exam |
| **7. Hardening** | Tests, admin, seed data, Docker | Admin pages, empty/error/loading states, a11y, responsive polish | Build + tests green |

Future enhancements: live classes (video conferencing), discussion forum per item,
S3/MinIO storage adapter, push/e-mail digests for newly published content, i18n of the UI (de/en),
pronunciation practice with speech recognition, payments.
