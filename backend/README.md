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
| `admin@sprachweg.de` | ADMIN | |
| `lehrer@sprachweg.de` | INSTRUCTOR | Anna Schneider, owns all demo courses |
| `student@sprachweg.de` | STUDENT | Luca Rossi: APPROVED in A1, PENDING in B1 |
| `sofia@sprachweg.de`, `mehmet@sprachweg.de`, `emma@sprachweg.de` | STUDENT | pending applications (waiting lists) |

Demo courses: **Deutsch A1: Erste Schritte** (live, approval; text lessons, a document with a `.txt` attachment, an
embed, a quiz with 5 question types, an exam with an essay, an item scheduled 3 days ahead, a draft item),
**Deutsch B1: Alltag & Beruf** (live) and **Prüfungsvorbereitung Goethe B2** (draft, module scheduled in 7 days).

## Tests

```bash
./mvnw verify
```

Unit tests (visibility rule, slug generation, grading helpers) and `@SpringBootTest` + MockMvc integration tests
(auth flow incl. refresh rotation, instructor course builder & publishing & schedule, enrollment gating, quiz
auto-grading + essay grading, media upload with signed URLs and HTTP Range, admin) run against in-memory H2
(`test` profile). The same suite also passes against PostgreSQL:

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

### Environment variables (`prod` profile)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_URL` | yes | | JDBC URL, e.g. `jdbc:postgresql://db:5432/sprachweg` |
| `DB_USERNAME` / `DB_PASSWORD` | yes | | Database credentials |
| `JWT_SECRET` | yes | | HMAC secret for access tokens, **≥ 32 characters** |
| `MEDIA_SECRET` | yes | | HMAC secret for signed media URLs, **≥ 32 characters** |
| `FRONTEND_URL` | yes | | Public URL of the frontend (used in e-mail links) |
| `PUBLIC_BASE_URL` | yes | | Public URL of this API (used for absolute media URLs) |
| `CORS_ORIGINS` | yes | | Comma-separated allowed origins, e.g. `https://sprachweg.de` |
| `MAIL_FROM` | yes | | Sender, e.g. `Sprachweg <no-reply@yourdomain.com>` (domain must be verified in Resend) |
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
| `MAX_UPLOAD_SIZE` | no | `500MB` | Max upload size (all profiles) |
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

## Configuration reference (`app.*`)

All application settings are bound to `de.sprachweg.config.AppProperties` and validated at startup:
`app.frontend-url`, `app.public-base-url`, `app.jwt.{secret,issuer,access-token-ttl (15m),refresh-token-ttl (14d)}`,
`app.auth.{email-verification-ttl (24h),password-reset-ttl (1h),refresh-cookie-name,secure-cookie,cookie-same-site}`,
`app.media.{secret,url-ttl (6h)}`, `app.storage.location`, `app.mail.{enabled,from}`, `app.cors.allowed-origins`,
`app.seed.enabled`.

## Architecture

```
de.sprachweg
├── common        exceptions + RFC 7807 handler, PageResponse, visibility rule, slugs, HTML sanitizer, base entities
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
* **Errors** are `application/problem+json` with `type`, `title`, `status`, `detail`, `code` and, for validation
  failures, an `errors` map (`field → message`).
* **Media URLs** (`/api/media/{id}/content?expires=…&sig=…[&download=true]`) need no auth header, are valid for
  `app.media.url-ttl`, support HTTP Range (206) and are served with RFC 5987 `Content-Disposition` file names.
  Active content types (HTML, SVG, XML, JS) are always served as attachments.
* **Assessments** store a snapshot of every question in each attempt, so editing a quiz never changes old results.
