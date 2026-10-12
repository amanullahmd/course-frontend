# Sprachweg Backend

REST API of the Sprachweg German language course platform.
Spring Boot **4.1.1** · Java **25** · Maven (jar) · Spring MVC · Spring Security 7 (JWT, OAuth2 resource server) ·
Spring Data JPA / Hibernate 7 · Flyway · Spring Mail · springdoc-openapi.

The API contract is defined in [`../docs/PLAN.md`](../docs/PLAN.md) §6; product stories are in
[`../docs/STORY.md`](../docs/STORY.md).

## Requirements

* JDK 25 (`JAVA_HOME` pointing to it)
* Maven 3.9+ (or the bundled wrapper `./mvnw`)
* For production: PostgreSQL 17 and an SMTP account (Resend)

## Run in development

```bash
cd backend
./mvnw spring-boot:run          # or: mvn spring-boot:run
```

The default profile is `dev`:

* H2 file database at `./data/sprachweg-db` (PostgreSQL compatibility mode, migrated by Flyway)
* uploads stored under `./data/uploads`
* e-mails are **not sent** but logged at INFO, including the verification / reset links
* demo data is seeded on first start (empty database only)

Reset everything with `rm -rf data/`.

| URL | |
|---|---|
| http://localhost:8080/swagger-ui.html | Swagger UI |
| http://localhost:8080/v3/api-docs | OpenAPI JSON |
| http://localhost:8080/actuator/health | Health check |

### Seeded accounts (password `Password123!`)

| E-mail | Role | Notes |
|---|---|---|
| `admin@sprachweg.de` | ADMIN | all other accounts use locale **en** |
| `lehrer@sprachweg.de` | INSTRUCTOR | Anna Schneider, owns all demo courses |
| `student@sprachweg.de` | STUDENT | Luca Rossi: APPROVED in A1, PENDING in B1; locale **de** (German notifications/e-mails) |
| `sofia@sprachweg.de`, `mehmet@sprachweg.de`, `emma@sprachweg.de` | STUDENT | pending applications (waiting lists) |

Demo courses: **Deutsch A1: Erste Schritte** (live, approval; text lessons, a document with a `.txt` attachment, an
embed, a quiz with 5 question types, an exam with an essay, an item scheduled 3 days ahead, a draft item),
**Deutsch B1: Alltag & Beruf** (live) and **Prüfungsvorbereitung Goethe B2** (draft, module scheduled in 7 days).

## Tests

```bash
./mvnw verify
```

Unit tests (visibility rule, slug generation, grading helpers, media URL signing, en/de bundle key parity) and
`@SpringBootTest` integration tests run against in-memory H2 (`test` profile):

* MockMvc flows: auth incl. refresh rotation, instructor course builder & publishing & schedule, enrollment gating,
  quiz auto-grading + essay grading, media upload with signed URLs and HTTP Range, admin.
* `I18nTest`: English default vs. `Accept-Language: de` for domain errors, bean validation and service field errors;
  user locale; notifications and e-mails in the recipient's language.
* `RobustnessTest`: ~120 bad requests (malformed JSON, wrong types, invalid UUIDs/enums, unknown/foreign ids, wrong
  methods and content types, missing multipart parts, …) as anonymous, student, instructor and admin. All of them
  must return the expected 4xx with a `code`, and none may return a 5xx. Paging parameters are clamped.
* `HttpRobustnessTest` (real Tomcat, `RANDOM_PORT`): multipart size limits (413), `/error`, exceptions and
  `sendError` raised in servlet filters, and URLs rejected by the HTTP firewall. The same suite also passes against PostgreSQL:

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/sprachweg_test \
SPRING_DATASOURCE_USERNAME=postgres SPRING_DATASOURCE_PASSWORD=postgres ./mvnw test
```

## Run in production

```bash
./mvnw -DskipTests package
SPRING_PROFILES_ACTIVE=prod java -jar target/sprachweg-backend-0.1.0-SNAPSHOT.jar
```

or build the container: `docker build -t sprachweg-backend .` (multi-stage, `eclipse-temurin:25`, runs as non-root,
uploads volume at `/data/uploads`). The repository root contains a `docker-compose.yml` with PostgreSQL 17,
Mailpit, backend and frontend.

### Sending real e-mail (Resend)

E-mail goes through Resend SMTP (`smtp.resend.com:587`, user `resend`, password = API key).
For local runs, copy `backend/.env.example` to `backend/.env` (git-ignored, loaded automatically) and set
`RESEND_API_KEY`, `MAIL_FROM` and `MAIL_ENABLED=true`. For Docker Compose, copy the root `.env.example` to `.env`.
The sender domain (`course.amanullah.me`) must be verified in Resend. Never commit the key.

### Environment variables (`prod` profile)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_URL` | yes | | JDBC URL, e.g. `jdbc:postgresql://db:5432/sprachweg` |
| `DB_USERNAME` / `DB_PASSWORD` | yes | | Database credentials |
| `JWT_SECRET` | yes | | HMAC secret for access tokens, **≥ 32 characters** |
| `MEDIA_SECRET` | yes | | HMAC secret for signed media URLs, **≥ 32 characters** |
| `FRONTEND_URL` | no | `https://course.amanullah.me` | Public URL of the frontend (used in e-mail links) |
| `PUBLIC_BASE_URL` | no | `https://api.course.amanullah.me` | Public URL of this API (used for absolute media URLs) |
| `CORS_ORIGINS` | no | `https://course.amanullah.me` | Comma-separated allowed origins |
| `MAIL_FROM` | no | `Sprachweg <no-reply@course.amanullah.me>` | Sender; the domain (`course.amanullah.me`) must be verified in Resend |
| `RESEND_API_KEY` | yes* | | Resend API key, used as SMTP password |
| `MAIL_HOST` | no | `smtp.resend.com` | SMTP host |
| `MAIL_PORT` | no | `587` | SMTP port (587 = STARTTLS) |
| `MAIL_USERNAME` | no | `resend` | SMTP user |
| `MAIL_SMTP_AUTH` | no | `true` | SMTP authentication |
| `MAIL_SMTP_STARTTLS` | no | `true` | STARTTLS enabled + required |
| `MAIL_SMTP_SSL` | no | `false` | Implicit TLS (use with port 465 and `MAIL_SMTP_STARTTLS=false`) |
| `MAIL_ENABLED` | no | `true` | `false` logs e-mails instead of sending |
| `COOKIE_SECURE` | no | `true` | `Secure` flag of the refresh cookie (needs HTTPS) |
| `STORAGE_LOCATION` | no | `/data/uploads` | Directory for uploaded files |
| `MAX_UPLOAD_SIZE` | no | `500MB` | Max size of one uploaded file (all profiles) |
| `MAX_REQUEST_SIZE` | no | `510MB` | Max size of a whole multipart request (all profiles) |
| `SEED_ENABLED` | no | `false` | Seed demo data into an empty database |
| `DB_POOL_SIZE` | no | `10` | Hikari pool size |
| `PORT` | no | `8080` | HTTP port |

\* not needed when `MAIL_SMTP_AUTH=false` (e.g. Mailpit).

### E-mail via Resend SMTP

Production mail goes through [Resend SMTP](https://resend.com/docs/send-with-smtp): host `smtp.resend.com`,
port `587` with STARTTLS, user `resend`, password = your API key. Create an API key with "Sending access", verify your
sending domain in Resend and use an address on it in `MAIL_FROM`. Mails are sent asynchronously after the database
transaction commits, so SMTP latency never blocks requests; failures are logged.

For local testing with Docker Compose the backend talks to **Mailpit** (`MAIL_HOST=mailpit`, `MAIL_PORT=1025`,
no auth / TLS); open http://localhost:8025 to read the mails.

## Languages (English / German)

* Supported locales: `en` (default) and `de`, chosen per request from `Accept-Language` (e.g. `de-DE` → `de`, anything
  else → `en`). Texts live in `src/main/resources/messages.properties` (English, fallback) and `messages_de.properties`
  (German, informal "du").
* Error `detail` and field `errors` are localized: domain errors use `error.<CODE>` keys (with more specific keys for
  some codes), service-level field errors use `validation.*` keys, and bean validation uses Hibernate Validator's
  built-in translations plus `{validation.*}` keys from the same bundles.
* Every user has a preferred `locale` (`users.locale`, migration `V2__user_locale.sql`). It is set at registration
  (`locale` field, otherwise taken from `Accept-Language`) and changed with `PUT /api/users/me/locale`. E-mails and
  in-app notifications are rendered in the **recipient's** language.

## Error responses

All errors are `application/problem+json`:

```json
{"type":"about:blank","title":"Bad Request","status":400,"detail":"Some fields are invalid. Please check your input.",
 "instance":"/api/auth/register","code":"VALIDATION_FAILED","errors":{"email":"must be a well-formed email address"}}
```

Client mistakes are always 4xx. A 500 only happens for real server bugs: it has `code=INTERNAL_ERROR`, a generic
message, no exception details, and a `traceId` that also appears in the server log. A client that disconnects
(broken pipe) is logged at DEBUG only. `/error` and errors raised by servlet filters or the HTTP firewall return
the same JSON shape. Paging parameters are clamped (`page ≥ 0`, `1 ≤ size ≤ 100`).

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Bean validation or business validation failed; see `errors` (field → message) |
| 400 | `MALFORMED_REQUEST` | Body missing, not JSON, wrong JSON types, invalid enum/UUID/date values in the body |
| 400 | `INVALID_PARAMETER` | Path/query parameter with the wrong type (e.g. invalid UUID in the path, unknown enum) |
| 400 | `BAD_REQUEST` | Missing parameter/header/cookie, URL rejected by the firewall, other invalid input |
| 400 | `FILE_REQUIRED` · `FILE_EMPTY` | Upload is not multipart or has no `file` part · file is empty |
| 400 | `INVALID_ROLE` · `INVALID_TOKEN` · `TOKEN_USED` · `TOKEN_EXPIRED` | Registration role · verification/reset links |
| 400 | `INVALID_PASSWORD` · `AVATAR_NOT_IMAGE` · `CANNOT_MODIFY_SELF` · `OWN_COURSE` · `NO_QUESTIONS` | see detail |
| 401 | `UNAUTHORIZED` · `INVALID_CREDENTIALS` | Missing/invalid access token · wrong e-mail or password |
| 401 | `INVALID_REFRESH_TOKEN` · `REFRESH_TOKEN_EXPIRED` | Refresh cookie missing, invalid, reused or expired |
| 403 | `FORBIDDEN` · `EMAIL_NOT_VERIFIED` · `ACCOUNT_DISABLED` | Role not allowed · e-mail not verified · disabled |
| 403 | `NOT_ENROLLED` · `ASSESSMENT_NOT_AVAILABLE` | No approved enrollment · outside the availability window |
| 403 | `INVALID_SIGNATURE` · `LINK_EXPIRED` | Signed media URL tampered with · expired |
| 404 | `NOT_FOUND` · `<ENTITY>_NOT_FOUND` | Unknown route; `COURSE_`, `MODULE_`, `ITEM_`, `MEDIA_`, `USER_`, `ENROLLMENT_`, `ATTEMPT_`, `NOTIFICATION_`, `ASSESSMENT_NOT_FOUND` (also for other people's resources and non-live content) |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 406 | `NOT_ACCEPTABLE` | `Accept` excludes JSON |
| 409 | `EMAIL_TAKEN` · `ALREADY_ENROLLED` · `INVALID_STATUS` · `CAPACITY_REACHED` | Account/enrollment conflicts |
| 409 | `MAX_ATTEMPTS_REACHED` · `ATTEMPT_ALREADY_SUBMITTED` · `ATTEMPT_NOT_SUBMITTED` | Assessment attempts |
| 409 | `CONFLICT` · `CONCURRENT_MODIFICATION` | Data integrity violation · optimistic locking |
| 413 | `FILE_TOO_LARGE` | Upload exceeds `MAX_UPLOAD_SIZE` / `MAX_REQUEST_SIZE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Wrong `Content-Type` |
| 503 | `SERVICE_UNAVAILABLE` | Async request timeout |
| 500 | `INTERNAL_ERROR` | Unexpected server error (with `traceId`) |

## Configuration reference (`app.*`)

All application settings are bound to `me.amanullah.course.config.AppProperties` and validated at startup:
`app.frontend-url`, `app.public-base-url`, `app.jwt.{secret,issuer,access-token-ttl (15m),refresh-token-ttl (14d)}`,
`app.auth.{email-verification-ttl (24h),password-reset-ttl (1h),refresh-cookie-name,secure-cookie,cookie-same-site}`,
`app.media.{secret,url-ttl (6h)}`, `app.storage.location`, `app.mail.{enabled,from}`, `app.cors.allowed-origins`,
`app.seed.enabled`.

## Architecture

```
me.amanullah.course
├── common        i18n (locale resolver, messages), exceptions + RFC 7807 handler + /error controller, PageResponse, visibility rule, slugs, HTML sanitizer, base entities
├── config        AppProperties, clock/async/scheduling, OpenAPI
├── security      SecurityFilterChain, JWT (HS256 via Nimbus), CurrentUser
├── auth          register/verify/login/refresh/logout/forgot/reset, refresh tokens (SHA-256 hashed, rotating)
├── user          /api/users/me
├── media         uploads (local disk), HMAC-signed URLs, Range streaming
├── course        courses, modules, items, publication, ordering, public catalog
├── assessment    quizzes/exams, attempts, auto-grading, manual grading
├── enrollment    applications, waiting list, approve/reject/revoke/bulk
├── learning      learner access gate, player endpoints, progress
├── notification  in-app notifications, e-mail templates and async delivery
├── schedule      publish/unpublish calendar, instructor dashboard
├── admin         stats and user management
└── seed          demo data (dev)
```

Key rules:

* **Visibility** is computed at request time: `live(x) = PUBLISHED && (publishAt == null || publishAt <= now) &&
  (unpublishAt == null || unpublishAt > now)`. Learners see an item only if course, module and item are live and
  they have an APPROVED enrollment (course owner/admin may preview). Non-live content → 404, not enrolled → 403.
* **Ownership**: instructors manage only their own courses (others' resources return 404); admins manage all.
* **Errors** are localized `application/problem+json` with `type`, `title`, `status`, `detail`, `code`, an `errors`
  map (`field → message`) for validation failures, and a `traceId` for 500s (see [Error responses](#error-responses)).
* **Media URLs** (`/api/media/{id}/content?expires=…&sig=…[&download=true]`) need no auth header, are valid for
  `app.media.url-ttl`, support HTTP Range (206) and are served with RFC 5987 `Content-Disposition` file names.
  Active content types (HTML, SVG, XML, JS) are always served as attachments.
* **Assessments** store a snapshot of every question in each attempt, so editing a quiz never changes old results.
