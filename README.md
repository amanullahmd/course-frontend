# Sprachweg: German Language Course Platform

A full-stack platform where instructors build fully dynamic German courses (text, documents, PDF/DOCX/PPTX,
audio, video, images, embeds, quizzes, exams), publish or schedule every piece of content, and admit learners
from a waiting list. Learners register, verify their e-mail, apply, and learn the published content once accepted.

| Folder | Contents |
|---|---|
| [`docs/`](docs) | [Product story & user stories](docs/STORY.md) · [Development plan, architecture & API contract](docs/PLAN.md) · [QA report & screenshots](docs/QA_REPORT.md) |
| [`backend/`](backend) | Spring Boot 4.1.1 · Java 25 · Maven (jar) · YAML config · JPA + Flyway · JWT security |
| [`frontend/`](frontend) | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query |

## Quick start (development)

```bash
# 1. Backend: http://localhost:8080 (H2 database, seeded demo data, e-mails logged to the console)
cd backend && mvn spring-boot:run

# 2. Frontend: http://localhost:3000
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

Demo accounts (password `Password123!`): `admin@sprachweg.de`, `lehrer@sprachweg.de` (instructor),
`student@sprachweg.de` (student).

## Full stack with Docker

```bash
docker compose up --build
```

UI languages: English (default) and German, switchable in the header.

This starts PostgreSQL 17, Mailpit (catch-all mail UI at http://localhost:8025), the backend and the frontend.

## CI

Two GitHub Actions workflows, each in stages (jobs of a stage run in parallel; the next stage `needs` the previous one).
Both run on pushes to `main` and on pull requests that touch their paths, and can be started by hand ("Run workflow").
They use path filters, so if you make their jobs *required* status checks in branch protection, a PR that does not touch
those paths would wait for them forever: either keep them non-required or require them only for the matching paths.

### Backend: [`.github/workflows/backend-ci.yml`](.github/workflows/backend-ci.yml)

Paths `backend/**`, `docs/PLAN.md`, `.gitleaks.toml` and the workflow file; also nightly at 02:17 UTC.

| Stage | Job | What it does | Run it locally |
|---|---|---|---|
| check | `migrations:lint` | Flyway files named `V<n>__<snake_case>.sql`, unique and contiguous versions, no empty files; on PRs no migration that exists on the base branch may be changed or deleted | `python3 backend/ci/lint-migrations.py [--base-ref origin/main]` |
| check | `openapi:breaking` | `oasdiff breaking --fail-on ERR` between the base branch's and this branch's `backend/openapi/openapi.json` (skipped while the base has no snapshot) | `oasdiff breaking old.json backend/openapi/openapi.json --fail-on ERR` |
| check | `postman:check` | Starts the jar (dev profile, seeded, `MAIL_ENABLED=false`) and runs the Postman smoke suite `backend/postman/` with newman | `npx newman run backend/postman/sprachweg.postman_collection.json -e backend/postman/sprachweg.postman_environment.json --env-var baseUrl=http://localhost:8080` |
| check | `scan:sast` | Semgrep (`p/java`, `p/owasp-top-ten`, `p/secrets`) on `backend/`, SARIF to code scanning; fails on ERROR findings | `semgrep scan backend --config p/java --config p/owasp-top-ten --config p/secrets --severity ERROR --error` |
| check | `scan:secrets` | gitleaks over the whole git history (`.gitleaks.toml` allowlists only public dev defaults) | `gitleaks git . --config .gitleaks.toml --redact` |
| build | `build:test` | `mvn verify` (unit + integration tests incl. the OpenAPI snapshot test), uploads reports and the jar, builds the Docker image | `cd backend && ./mvnw verify` |
| build | `coverage:nightly` | Nightly / manual only: JaCoCo report + summary | `./mvnw -Pcoverage verify` → `target/site/jacoco/` |
| build | `scan:dependencies` | Trivy (fixable HIGH/CRITICAL fail the job), SARIF, Maven dependency tree | `trivy fs backend --severity HIGH,CRITICAL --ignore-unfixed` |
| build | `scan:spotbugs` | SpotBugs + FindSecBugs, threshold Medium, exclusions with reasons in `backend/spotbugs-exclude.xml` | `./mvnw -Pspotbugs -DskipTests verify` |
| database | `db:verify` | Full test suite on PostgreSQL 17 (Flyway migrate + Hibernate validate), then boots the `prod` profile against an empty database until health is UP | see [backend/README.md](backend/README.md#tests) |

**OpenAPI snapshot.** `backend/openapi/openapi.json` is the committed API contract (normalized: sorted keys, no
`servers`). `OpenApiSnapshotTest` fails when the generated `/v3/api-docs` differs (the generated file is written to
`backend/target/openapi/openapi.generated.json`). After an intentional API change, regenerate and commit it:

```bash
cd backend && ./mvnw test -Dtest=OpenApiSnapshotTest -Dopenapi.update=true
```

### Frontend: [`.github/workflows/frontend-ci.yml`](.github/workflows/frontend-ci.yml)

Paths `frontend/**`, `backend/openapi/**` and the workflow file. Node 22, `npm ci`.

| Stage | Job | What it does | Run it locally (in `frontend/`) |
|---|---|---|---|
| verify | `lint-typecheck-test` | ESLint, `next typegen && tsc --noEmit`, Vitest unit tests (message parity, error mapping, API client refresh, formatting, utils) | `npm run lint && npm run typecheck && npm test` |
| verify | `e2e:check` | Builds the backend jar and the frontend, Playwright starts both and runs the smoke tests in `e2e/` (report + traces as artifacts) | `NEXT_PUBLIC_API_URL=http://localhost:8080 npm run build && npm run test:e2e` (backend jar built first) |
| verify | `contract-drift` | Manual only: every endpoint used in `src/lib/api/**` must exist in `backend/openapi/openapi.json` (method + path), and TS DTO fields must exist in the matching schemas | `npm run contract:drift` |
| build | `build` | Production build with `NEXT_PUBLIC_API_URL=https://api.course.amanullah.me`, standalone artifact, Docker image | `npm run build` |
