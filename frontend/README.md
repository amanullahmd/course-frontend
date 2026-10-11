# Sprachweg – Frontend

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
TanStack Query · React Hook Form + Zod · Radix UI primitives · dnd-kit · Tiptap 3 · date-fns.

The UI consumes the Spring Boot API described in [`../docs/PLAN.md`](../docs/PLAN.md) §6.

## Getting started

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev                     # http://localhost:3000
```

Start the backend (dev profile, H2, seeded data) on port 8080. Seeded accounts (password `Password123!`):
`admin@sprachweg.de`, `lehrer@sprachweg.de` (instructor), `student@sprachweg.de` and more students.
In development the login page shows a "Demo accounts" helper that fills the form.

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript + React Compiler rules) |

### Environment

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | API base URL used by the browser (inlined at build time). Production: `https://api.course.amanullah.me` |
| `NEXT_PUBLIC_SITE_URL` | `https://course.amanullah.me` | Public frontend URL for `metadataBase`, canonical URLs and OpenGraph |
| `API_URL_INTERNAL` | – | Optional API base URL for server-side rendering (e.g. `http://backend:8080` in Docker) |

## Architecture

```
src/
├── app/
│   ├── (marketing)/      landing, /courses catalog, /courses/[slug] (server-rendered, graceful if API is down)
│   ├── (auth)/           login, register, check-email, verify-email, forgot/reset-password
│   └── (app)/            authenticated shell: dashboard, learn player, instructor area, settings, notifications, admin
├── components/
│   ├── ui/               hand-written shadcn-style primitives (Radix + Tailwind tokens)
│   ├── layout/           headers, sidebar, user menu, notifications bell, RequireAuth
│   ├── marketing/ course/ learn/ quiz/ builder/ instructor/ student/ account/ admin/ auth/
├── hooks/                queries/* (TanStack Query hooks + optimistic updates), uploads, hotkeys, timers…
├── lib/
│   ├── api/              client.ts (fetch wrapper), types.ts (DTOs), one module per API area, server.ts (SSR fetch)
│   └── …                 constants, dates, embed detection, validation, query keys
└── providers/            QueryClient, theme, AuthProvider, toasts
```

* **Auth** – the access token lives only in memory. On load the `AuthProvider` performs a silent
  `POST /api/auth/refresh` (single-flight, using the http-only refresh cookie). Any 401 triggers one refresh and
  a retry. Errors are parsed from RFC 7807 `ProblemDetail` into `ApiError` (status, code, field errors mapped
  onto form fields).
* **Uploads** – `POST /api/media` via XHR for progress; media is rendered from the signed `url`.
* **Visibility** – badges (Draft · Scheduled · Live · Expired) mirror the backend rule; publish toggles are optimistic.
* **Builder** – drag & drop modules and items (also across modules) with dnd-kit, keyboard accessible.
* **Learning** – outline sidebar, viewers for PDF / office files / video (incl. YouTube & Vimeo) / audio with
  speed control / images with lightbox / embeds, quiz player with timer, autosave and results review.
* **Production** – frontend at `https://course.amanullah.me`, API at `https://api.course.amanullah.me`
  (the backend must allow that origin via CORS and set the refresh cookie for the shared parent domain).
* **Notification links** – `/instructor/courses/{id}/enrollments` and `/instructor/attempts/{id}` redirect to the
  matching builder tab / grading drawer.

## Docker

```bash
docker build -t sprachweg-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.course.amanullah.me \
  --build-arg NEXT_PUBLIC_SITE_URL=https://course.amanullah.me .
docker run -p 3000:3000 -e API_URL_INTERNAL=http://backend:8080 sprachweg-frontend
```
