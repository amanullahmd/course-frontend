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
