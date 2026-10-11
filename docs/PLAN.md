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
`{type,title,status,detail,code?,errors?:{field:msg}}`; pages as
`{content:[],page,size,totalElements,totalPages}` (page is 0-based).

### Auth `/api/auth`
| Method | Path | Body → Response |
|---|---|---|
| POST | `/register` | `{fullName,email,password,role:"STUDENT"\|"INSTRUCTOR"}` → 201 `{message}` |
| POST | `/verify-email` | `{token}` → `{message}` |
| POST | `/resend-verification` | `{email}` → `{message}` |
| POST | `/login` | `{email,password}` → `AuthResponse` + `Set-Cookie: refresh_token` (403 `code=EMAIL_NOT_VERIFIED`) |
| POST | `/refresh` | cookie → `AuthResponse` (rotated cookie) |
| POST | `/logout` | → 204 |
| POST | `/forgot-password` | `{email}` → `{message}` |
| POST | `/reset-password` | `{token,password}` → `{message}` |

`AuthResponse = {accessToken, expiresIn, user: UserDto}`
`UserDto = {id, fullName, email, role, emailVerified, bio, avatarUrl, createdAt}`

### Me `/api/users/me`
`GET` → UserDto · `PUT {fullName,bio,avatarMediaId}` → UserDto · `PUT /password {currentPassword,newPassword}` → 204

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
| POST | `/enrollments/{id}/approve` · `/reject {reason}` · `/revoke {reason}` | EnrollmentDto |
| POST | `/enrollments/bulk` | `{ids:[],action:"APPROVE"\|"REJECT",reason?}` → EnrollmentDto[] |
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
ScheduleEventDto   = {id, entityType:"COURSE"|"MODULE"|"ITEM", entityId, courseId, courseTitle, title, itemType?, action:"PUBLISH"|"UNPUBLISH", at}
AttemptSummaryDto  = {id, student:{id,fullName,email,avatarUrl}, status, startedAt, submittedAt, score, maxScore, percent, passed, pendingManualGrading}
AttemptResultDto   = AttemptSummaryDto + {itemId, itemTitle, deadline, answers:[{questionId, type, prompt, points, selectedOptionIds[], textAnswer,
                      correct?, pointsAwarded?, feedback, options?:[{id,text,correct?}], acceptedAnswers?[]}]}
```

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
| POST | `/items/{itemId}/attempts` | → `AttemptSessionDto = {id,status,startedAt,deadline,questions:[{id,type,prompt,points,media?,options:[{id,text}]}]}` (resumes in-progress attempt) |
| POST | `/attempts/{id}/submit` | `{answers:[{questionId,selectedOptionIds[],textAnswer}]}` → AttemptResultDto |
| GET | `/attempts/{id}` | AttemptResultDto (correct answers only if `showCorrectAnswers`) |

### Notifications `/api/notifications`
`GET ?page=&size=` → Page<{id,type,title,body,link,read,createdAt}> · `GET /unread-count` → `{count}` ·
`POST /{id}/read` · `POST /read-all`

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

Future enhancements: live classes (video conferencing), certificates, discussion forum per item,
S3/MinIO storage adapter, push/e-mail digests for newly published content, i18n of the UI (de/en),
pronunciation practice with speech recognition, payments.
