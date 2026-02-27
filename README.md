# TODO (Team Tracker)

- [ ] Route registration create through DB-side atomic function (`create_foundathon_registration_with_cap`) to eliminate race windows during high concurrency.
- [ ] Add/commit explicit SQL for `eventsregistrations` schema, indexes, and RLS policies (currently only function migration is in repo).
- [ ] Add CI pipeline (`bun run test`, `bun run lint`, `bun run build`) for PR gating.

# Foundathon Landing + Registration App

A Next.js 16 app for Foundathon 3.0 that includes:

- Public landing experience
- Supabase Google OAuth auth flow
- Problem statement board + locking system
- Team registration wizard (SRM and Non-SRM)
- Team dashboard for updates and deletion
- Per-statement cap enforcement in API logic

This README is intentionally verbose and operational. It is meant to be a handoff document for frontend, backend, and DevOps contributors.

## Quick Start (TL;DR)

```bash
bun install
cp .env.example .env.local
# fill env values (see Environment section)

# if you use Doppler
# doppler run -- bun dev

# normal local
bun dev
```

Open `http://localhost:3000`.

## Table of Contents

- [1) Product and architecture overview](#1-product-and-architecture-overview)
- [2) Tech stack](#2-tech-stack)
- [3) Local setup](#3-local-setup)
- [4) Environment variables](#4-environment-variables)
- [5) Supabase setup checklist](#5-supabase-setup-checklist)
- [6) Scripts](#6-scripts)
- [7) Project structure (annotated)](#7-project-structure-annotated)
- [8) Route map](#8-route-map)
- [9) API contracts and status codes](#9-api-contracts-and-status-codes)
- [10) Data model and payload shapes](#10-data-model-and-payload-shapes)
- [11) Constants map](#11-constants-map)
- [12) Validation and business rules](#12-validation-and-business-rules)
- [13) UI architecture and state flow](#13-ui-architecture-and-state-flow)
- [14) Auth and session behavior](#14-auth-and-session-behavior)
- [15) Registration and dashboard flows](#15-registration-and-dashboard-flows)
- [16) Database notes and scaling concerns](#16-database-notes-and-scaling-concerns)
- [17) Testing guide](#17-testing-guide)
- [18) Common change recipes](#18-common-change-recipes)
- [19) Deployment checklist](#19-deployment-checklist)
- [20) Troubleshooting](#20-troubleshooting)
- [21) Known limitations](#21-known-limitations)

## 1) Product and architecture overview

### What the app does

1. User lands on `/` and explores event information.
2. User signs in with Google via Supabase OAuth.
3. User opens `/register`, fills team details, and locks exactly one problem statement.
4. User creates team registration.
5. User is redirected to `/dashboard/[teamId]` for edits and team management.

### High-level flow

```text
Browser UI
  -> Next.js route handlers (/api/*)
    -> Supabase Auth (session + OAuth)
    -> Supabase Postgres (eventsregistrations table)
```

### Core design decisions

- App Router (`src/app/*`) with server and client components mixed by need.
- Zod schema validation on both client flow and server route boundaries.
- Statement lock token is signed server-side with HMAC (`FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET`).
- Current cap enforcement is done in application logic before insert/update.

## 2) Tech stack

- Framework: `next@16.1.6` (App Router)
- UI runtime: `react@19.2.3`, `react-dom@19.2.3`
- Language: TypeScript with `strict: true` (`tsconfig.json`)
- Styling: Tailwind CSS v4 + CSS variables (`src/app/globals.css`)
- UI helper libs:
  - `class-variance-authority`
  - `radix-ui`
  - `lucide-react`
  - `motion`
  - `canvas-confetti`
- Auth/data: `@supabase/ssr`, `@supabase/supabase-js`
- Validation: `zod`
- Testing: `vitest`, `@testing-library/react`, `jsdom`
- Lint/format: `@biomejs/biome`
- Package manager default: `bun@1.2.22`

## 3) Local setup

### Prerequisites

- Bun installed and available in shell
- Node.js 20+ compatible runtime
- Supabase project and OAuth credentials ready

### Install dependencies

```bash
bun install
```

### Configure environment

```bash
cp .env.example .env.local
```

Then fill `.env.local` with required values (see Environment Variables section).

### Start development server

Option A: plain local env

```bash
bun dev
```

Option B: with Doppler (if your team stores env there)

```bash
doppler run -- bun dev
```

### Run tests and checks

```bash
bun run test
bun run lint
bun run build
```

## 4) Environment variables

### Important note about current `.env.example`

Current `/.env.example` in this repo includes all runtime keys used by API/auth/email routes.

If your team uses Doppler/CI secret injection, that is fine, but local dev still needs these keys available in process env.

### Full env matrix

| Variable | Required Local | Required Prod | Public/Server | Used In | Notes |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Public + Server | `src/lib/register-api.ts`, `src/utils/supabase/*`, auth routes | Base Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | Public + Server | `src/lib/register-api.ts`, `src/utils/supabase/*`, auth routes | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` | Optional | Recommended for PPT uploads | Server only | `src/server/supabase/service-role-client.ts`, registration service storage ops | Bypasses Storage RLS for server-side upload/delete/list |
| `UPSTASH_REDIS_REST_URL` | Optional | Yes | Server | `src/server/security/rate-limit.ts` | Upstash REST URL for distributed API rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Yes | Server | `src/server/security/rate-limit.ts` | Upstash REST token for distributed API rate limiting |
| `FOUNDATHON_ALLOWED_REDIRECT_HOSTS` | Optional | Recommended | Server | `src/server/auth/oauth.ts` | Comma-separated host allowlist for trusted OAuth callback redirect hosts |
| `FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET` | Yes (for lock flow) | Yes | Server only | `src/lib/problem-lock-token.ts` | HMAC signing secret |
| `FOUNDATHON_NEXT_PUBLIC_SITE_URL` | Optional | Recommended | Public + Server | `src/app/sitemap.ts`, `src/app/robots.ts`, auth + send routes | Canonical host + callback base |
| `FOUNDATHON_NODE_ENV` | Optional | Optional | Runtime | auth login/callback | Set to `development` locally |
| `FOUNDATHON_RESEND_API_KEY` | Optional | Optional | Server | `src/app/api/send/route.ts` | Enables lock notification emails |

### Recommended `.env.local` template

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE=<service-role-key>
UPSTASH_REDIS_REST_URL=https://<upstash-host>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<upstash-token>
FOUNDATHON_ALLOWED_REDIRECT_HOSTS=localhost:3000,foundathon.thefoundersclub.tech
FOUNDATHON_NEXT_PUBLIC_SITE_URL=http://localhost:3000
FOUNDATHON_RESEND_API_KEY=<resend-key>
FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET=<openssl-random>
FOUNDATHON_NODE_ENV=development
```

### Generate `FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET`

```bash
openssl rand -base64 48
```

### Security hardening notes

- Mutating API endpoints enforce strict same-origin checks via `Origin` or `Referer`.
- API endpoints use distributed rate limits backed by Upstash Redis.
- OAuth callback redirects only trust `x-forwarded-host` values present in `FOUNDATHON_ALLOWED_REDIRECT_HOSTS`.
- App responses include a CSP and production HSTS via `next.config.ts`.
- This pass does **not** change DB migrations/RLS constraints; that remains a separate hardening track.

## 5) Supabase setup checklist

This project expects Supabase Auth and a Postgres table named `eventsregistrations`.

### 5.1 Auth provider configuration

Configure in Supabase Dashboard:

- Enable Google provider
- Set site URL to your deployed frontend domain
- Allow callback:
  - `https://<your-domain>/api/auth/callback`
- For local dev, add callback:
  - `http://localhost:3000/api/auth/callback`

### 5.2 Migration currently in repository

File:

- `supabase/migrations/202602190001_create_foundathon_registration_with_cap.sql`

It adds:

- `public.create_foundathon_registration_with_cap(...)` function
- grant execute to `authenticated`

### 5.3 Expected table contract from app code

The app reads/writes these columns on `eventsregistrations`:

- `id`
- `created_at`
- `updated_at`
- `event_id`
- `event_title`
- `application_id`
- `registration_email`
- `is_team_entry`
- `details` (json/jsonb)

### 5.4 Event identity expected by app

Constants in `src/lib/register-api.ts`:

- `EVENT_ID = "583a3b40-da9d-412a-a266-cc7e64330b16"`
- `EVENT_TITLE = "Foundathon 3.0"`

If backend has event FK constraints, this event id must exist.

### 5.5 Recommended backend hardening (not fully codified in repo yet)

- Unique constraint: `(event_id, application_id)`
- Helpful indexes:
  - `event_id`
  - `(event_id, application_id)`
  - expression index for `details ->> 'problemStatementId'`
- RLS policies that scope mutable actions to `auth.uid()` and expected event rows

## 6) Scripts

From `package.json`:

- `bun dev` -> Next dev server
- `bun run build` -> production build
- `bun start` -> run built app
- `bun run lint` -> Biome checks
- `bun format` -> format write
- `bun run test` -> Vitest run
- `bun run test:watch` -> Vitest watch mode

## 7) Project structure (annotated)

```text
.
├─ .env.example                         # runtime env template
├─ biome.json                           # lint + formatter config
├─ components.json                      # shadcn settings and aliases
├─ next.config.ts                       # security headers, reactCompiler
├─ package.json                         # scripts and deps
├─ postcss.config.mjs                   # Tailwind PostCSS
├─ tsconfig.json                        # TS strict config + @ alias
├─ vitest.config.ts                     # test runner config
├─ vitest.setup.ts                      # test setup hooks
├─ public/
│  ├─ favicon.svg
│  ├─ logo.svg
│  ├─ opengraph-image.png
│  └─ textures/
│     ├─ circle-16px.svg
│     └─ noise-main.svg
├─ supabase/
│  ├─ config.toml
│  └─ migrations/
│     └─ 202602190001_create_foundathon_registration_with_cap.sql
└─ src/
   ├─ app/
   │  ├─ layout.tsx                     # root layout + metadata + providers
   │  ├─ page.tsx                       # landing page (Hero + About)
   │  ├─ loading.tsx                    # app-level loading shell
   │  ├─ not-found.tsx                  # custom 404
   │  ├─ globals.css                    # theme tokens + utility styles
   │  ├─ robots.ts                      # robots metadata route
   │  ├─ sitemap.ts                     # sitemap metadata route
   │  ├─ auth/
   │  │  └─ auth-code-error/page.tsx    # OAuth error page
   │  ├─ (auth)/
   │  │  └─ auth/callback/route.ts      # compatibility redirect to /api/auth/callback
   │  ├─ api/
   │  │  ├─ auth/
   │  │  │  ├─ login/route.ts
   │  │  │  ├─ callback/route.ts
   │  │  │  └─ logout/route.ts
   │  │  ├─ problem-statements/
   │  │  │  ├─ route.ts
   │  │  │  └─ lock/route.ts
   │  │  └─ register/
   │  │     ├─ route.ts
   │  │     └─ [teamId]/route.ts
   │  ├─ problem-statements/
   │  │  ├─ page.tsx
   │  │  └─ loading.tsx
   │  ├─ register/
   │  │  ├─ page.tsx
   │  │  ├─ register-client.tsx
   │  │  ├─ loading.tsx
   │  │  └─ success/[teamId]/
   │  │     ├─ page.tsx
   │  │     └─ loading.tsx
   │  ├─ dashboard/[teamId]/
   │  │  ├─ page.tsx
   │  │  └─ loading.tsx
   │  └─ team/[teamId]/
   │     ├─ page.tsx
   │     └─ loading.tsx
   ├─ components/
   │  ├─ sections/
   │  │  ├─ Header.tsx
   │  │  ├─ HeaderClient.tsx
   │  │  ├─ Hero.tsx
   │  │  ├─ HeroRegisterButton.tsx
   │  │  └─ About.tsx
   │  └─ ui/
   │     ├─ button.tsx
   │     ├─ confetti-button.tsx
   │     ├─ fn-button.tsx
   │     ├─ in-view.tsx
   │     ├─ line-shadow-text.tsx
   │     ├─ magnetic.tsx
   │     ├─ route-progress.tsx
   │     ├─ sign-in-required-modal.tsx
   │     ├─ toast.tsx
   │     └─ toaster.tsx
   ├─ data/
   │  └─ problem-statements.ts
   ├─ hooks/
   │  └─ use-toast.ts
   ├─ lib/
   │  ├─ auth-ui-state.ts
   │  ├─ constants.ts
   │  ├─ problem-lock-token.ts
   │  ├─ problem-lock-token.test.ts
   │  ├─ problem-statement-availability.ts
   │  ├─ register-api.ts
   │  ├─ register-schema.ts
   │  ├─ register-schema.test.ts
   │  ├─ team-ui-events.ts
   │  └─ utils.ts
   ├─ proxy.ts                          # Next.js request proxy hook
   └─ utils/supabase/
      ├─ client.ts
      ├─ server.ts
      └─ proxy.ts
```

## 8) Route map

### UI routes

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Landing page |
| `/problem-statements` | `src/app/problem-statements/page.tsx` | Public board of statements |
| `/register` | `src/app/register/page.tsx` | Registration entry gate |
| `/dashboard/[teamId]` | `src/app/dashboard/[teamId]/page.tsx` | Team management UI |
| `/register/success/[teamId]` | `src/app/register/success/[teamId]/page.tsx` | Post-registration success UI |
| `/team/[teamId]` | `src/app/team/[teamId]/page.tsx` | Redirect to dashboard |
| `/auth/auth-code-error` | `src/app/auth/auth-code-error/page.tsx` | OAuth failure fallback |

### API routes

| Endpoint | Method | Handler | Primary purpose |
| --- | --- | --- | --- |
| `/api/auth/login` | `GET` | `src/app/api/auth/login/route.ts` | Begin Google OAuth |
| `/api/auth/callback` | `GET` | `src/app/api/auth/callback/route.ts` | Exchange auth code for session |
| `/api/auth/logout` | `GET`/`POST` | `src/app/api/auth/logout/route.ts` | Sign out current user |
| `/api/problem-statements` | `GET` | `src/app/api/problem-statements/route.ts` | Authenticated availability listing |
| `/api/problem-statements/lock` | `POST` | `src/app/api/problem-statements/lock/route.ts` | Lock statement, return lock token |
| `/api/register` | `GET`/`POST`/`DELETE` | `src/app/api/register/route.ts` | Team list/create/delete |
| `/api/register/[teamId]` | `GET`/`PATCH`/`DELETE` | `src/app/api/register/[teamId]/route.ts` | Team read/update/delete |

### Metadata routes

- `/robots.txt` -> `src/app/robots.ts`
- `/sitemap.xml` -> `src/app/sitemap.ts`

## 9) API contracts and status codes

### Common error envelope

Most routes return:

```json
{ "error": "Human-readable message" }
```

### `GET /api/problem-statements`

Success `200`:

```json
{
  "statements": [
    {
      "id": "ps-01",
      "title": "Campus Mobility Optimizer",
      "summary": "...",
      "isFull": false
    }
  ]
}
```

Common statuses:

- `401` unauthenticated
- `500` Supabase/config/query failure

### `POST /api/problem-statements/lock`

Request:

```json
{ "problemStatementId": "ps-01" }
```

Success `200`:

```json
{
  "locked": true,
  "lockToken": "<token>",
  "lockExpiresAt": "2026-02-20T10:00:00.000Z",
  "problemStatement": {
    "id": "ps-01",
    "title": "Campus Mobility Optimizer"
  }
}
```

Common statuses:

- `400` invalid payload or unknown statement
- `401` unauthenticated
- `409` statement full
- `415` wrong content-type
- `500` server/db/config issue

### `POST /api/register`

Request:

```json
{
  "lockToken": "<token>",
  "problemStatementId": "ps-01",
  "team": {
    "teamType": "srm",
    "teamName": "Team Name",
    "lead": {},
    "members": []
  }
}
```

Success `201`:

```json
{ "team": { "id": "<uuid>" } }
```

Common statuses:

- `400` schema invalid, lock invalid, team id invalid
- `401` unauthenticated
- `409` already registered or statement full
- `415` wrong content-type
- `500` db/config issue

### `GET /api/register`

Success `200`:

```json
{
  "teams": [
    {
      "id": "<uuid>",
      "teamName": "...",
      "teamType": "srm",
      "leadName": "...",
      "memberCount": 4,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### `DELETE /api/register?id=<uuid>`

Success `200`:

```json
{ "teams": [/* refreshed list */] }
```

Common statuses: `400`, `401`, `404`, `500`.

### `GET /api/register/:teamId`

Success `200`:

```json
{ "team": { "id": "...", "teamType": "srm", "lead": {}, "members": [] } }
```

Common statuses: `400`, `401`, `404`, `422`, `500`.

### `PATCH /api/register/:teamId`

Mode A: update team details only

```json
{
  "teamType": "srm",
  "teamName": "...",
  "lead": {},
  "members": []
}
```

Mode B: assign statement to legacy team

```json
{
  "teamType": "srm",
  "teamName": "...",
  "lead": {},
  "members": [],
  "lockToken": "<token>",
  "problemStatementId": "ps-01"
}
```

Success `200`:

```json
{ "team": { /* normalized TeamRecord */ } }
```

### `DELETE /api/register/:teamId`

Success `200`:

```json
{ "deleted": true }
```

## 10) Data model and payload shapes

### Type ownership

- Main schema/types live in `src/lib/register-schema.ts`
- API row transform helpers in `src/lib/register-api.ts`

### Team submission discriminated union

`teamType` determines payload shape:

- `"srm"` -> uses `srmMemberSchema`
- `"non_srm"` -> uses `nonSrmMemberSchema`

### `details` JSON stored in DB

On creation/update, team payload plus statement metadata gets stored in `eventsregistrations.details`.

Expected optional metadata keys:

- `problemStatementId`
- `problemStatementTitle`
- `problemStatementCap`
- `problemStatementLockedAt`

### Example details payload (SRM)

```json
{
  "teamType": "srm",
  "teamName": "Board Breakers",
  "lead": {
    "name": "Lead",
    "raNumber": "RA1234567890123",
    "netId": "ab1234@srmist.edu.in",
    "dept": "CSE",
    "contact": 9876543210
  },
  "members": [
    {
      "name": "Member One",
      "raNumber": "RA1234567890124",
      "netId": "cd5678@srmist.edu.in",
      "dept": "ECE",
      "contact": 9876543211
    }
  ],
  "problemStatementId": "ps-01",
  "problemStatementTitle": "Campus Mobility Optimizer",
  "problemStatementCap": 10,
  "problemStatementLockedAt": "2026-02-20T10:00:00.000Z"
}
```

### Example details payload (Non-SRM)

```json
{
  "teamType": "non_srm",
  "teamName": "Outside Innovators",
  "collegeName": "ABC Institute",
  "isClub": true,
  "clubName": "Entrepreneurship Cell",
  "lead": {
    "name": "Lead",
    "collegeId": "C123",
    "collegeEmail": "lead@college.edu",
    "contact": 9876543210
  },
  "members": [
    {
      "name": "Member",
      "collegeId": "C124",
      "collegeEmail": "member@college.edu",
      "contact": 9876543211
    }
  ]
}
```

## 11) Constants map

### Business constants

| Constant | File | Value | Purpose |
| --- | --- | --- | --- |
| `PROBLEM_STATEMENT_CAP` | `src/data/problem-statements.ts` | `10` | Per-statement registration cap |
| `PROBLEM_LOCK_TOKEN_TTL_MS` | `src/lib/problem-lock-token.ts` | `30 * 60 * 1000` | Lock token lifetime |
| `EVENT_ID` | `src/lib/register-api.ts` | UUID | Event scoping key |
| `EVENT_TITLE` | `src/lib/register-api.ts` | `Foundathon 3.0` | Event label persisted in rows |
| `SRM_EMAIL_DOMAIN` | `src/lib/register-api.ts` | `@srmist.edu.in` | NetID normalization |
| `UUID_PATTERN` | `src/lib/register-api.ts` | regex | Route param validation |
| `JSON_HEADERS` | `src/lib/register-api.ts` | cache-control header | No-store API responses |

### UI/system constants

| Constant | File | Purpose |
| --- | --- | --- |
| `TEAM_CREATED_EVENT` | `src/lib/team-ui-events.ts` | Header/dashboard event sync |
| `springOptions` | `src/lib/constants.ts` | Motion spring defaults |
| `MAX_MEMBERS` | register/dashboard client files | Max team size in UI interactions |
| `ABANDONED_DRAFT_KEY` | `src/app/register/register-client.tsx` | localStorage warning state |
| `TOAST_LIMIT` | `src/hooks/use-toast.ts` | Concurrent toast limit |
| `MIN_VISIBLE_MS` / `MAX_VISIBLE_MS` | `src/components/ui/route-progress.tsx` | Route progress visibility timing |

## 12) Validation and business rules

### Team rules (schema-level)

- Team size: 3 to 5 total members
- `members` array: min 2, max 4
- SRM constraints:
  - `raNumber` must match `RA` + 13 digits
  - `netId` must be 2 lowercase letters + 4 digits (in UI)
- Non-SRM constraints:
  - valid `collegeEmail`
  - unique `collegeId` across lead + members
- Contact number:
  - integer
  - 10 digits
  - starts with 6-9

### Statement and lock rules (API-level)

- Statement id must exist in `PROBLEM_STATEMENTS`
- Lock token must be valid signature and unexpired
- Lock token must match both user id and statement id
- Registration create requires valid lock
- One registration per user per event

### Legacy dashboard assignment rule

For a team without stored statement metadata, dashboard can assign once via lock+patch path.

## 13) UI architecture and state flow

### Root shell

`src/app/layout.tsx` sets:

- Metadata defaults (OpenGraph/Twitter)
- Global header
- Route progress provider/bar
- Toast provider host

### Navigation and auth-aware CTA behavior

- `src/components/sections/Header.tsx` is server-side wrapper using `getAuthUiState`
- `src/components/sections/HeaderClient.tsx` contains:
  - desktop/mobile nav
  - sign-in/register/dashboard CTA logic
  - account dropdown + logout

### Registration wizard client state

`src/app/register/register-client.tsx` handles:

- Step state (`1` team details, `2` statement lock)
- Draft lead/members for both team types
- Validation and UX toasts
- Statement availability loading
- Lock expiration countdown and invalidation
- Create-team request and redirect
- abandoned draft tracking via localStorage

### Dashboard client state

`src/app/dashboard/[teamId]/page.tsx` handles:

- Team fetch and hydration
- optimistic editing state for lead/members
- save, delete, and legacy statement assignment flows
- fallback recovery to latest team if requested team is unavailable

## 14) Auth and session behavior

### Sign-in sequence

1. `GET /api/auth/login` creates Supabase server client.
2. Calls `signInWithOAuth({ provider: "google" })`.
3. Redirect URL points to `/api/auth/callback`.
4. Callback exchanges auth code for session and redirects to safe internal path.

### Sign-out sequence

`/api/auth/logout` signs out via Supabase then redirects to home with HTTP 303.

### Session sync and protected routes

- `src/proxy.ts` delegates to `src/utils/supabase/proxy.ts`.
- `updateSession()` refreshes/auth-syncs cookies each request.
- Unauthenticated access to `/register` paths is redirected to `/`.

Note: `/dashboard/*` is not blocked in proxy; auth failures are handled by API responses and page logic.

## 15) Registration and dashboard flows

### Registration flow (`/register`)

1. Server gate checks auth/team via `getAuthUiState()`.
2. If signed out -> redirect to `/api/auth/login?next=/register`.
3. If already registered -> redirect to `/dashboard/:teamId`.
4. Wizard collects team data and validates.
5. Wizard fetches statement availability.
6. User locks statement (`/api/problem-statements/lock`).
7. User creates team (`/api/register`).
8. Client dispatches `TEAM_CREATED_EVENT` and navigates to dashboard.

### Dashboard flow (`/dashboard/[teamId]`)

1. Fetch team from `/api/register/:teamId`.
2. Allow edits in local state.
3. Save with `PATCH /api/register/:teamId`.
4. Optional legacy statement assignment via lock+patch.
5. Delete via `DELETE /api/register/:teamId`.

### Cross-page sync

`TEAM_CREATED_EVENT` is dispatched by register wizard and consumed by header so CTA changes from “Register” to “Dashboard” without full reload.

## 16) Database notes and scaling concerns

### Current cap enforcement

Current create/update flow performs:

1. Read rows for event
2. Count matching `details.problemStatementId`
3. Reject if count >= cap
4. Insert/update row

This is not fully atomic under heavy concurrent writes.

### Existing DB-side atomic helper

Migration adds `create_foundathon_registration_with_cap` using advisory lock.

App currently does not call this RPC. Routing create through this function is recommended for strict cap correctness.

### Suggested production DB posture

- Add explicit unique and supporting indexes
- Enforce RLS policies scoped by `auth.uid()`
- Keep cap checks at DB transaction boundary

## 17) Testing guide

### Current test files

- `src/lib/problem-lock-token.test.ts`
- `src/lib/register-schema.test.ts`
- `src/app/api/problem-statements/route.test.ts`
- `src/app/api/problem-statements/lock/route.test.ts`
- `src/app/api/register/route.test.ts`
- `src/app/api/register/[teamId]/route.test.ts`
- `src/app/register/page.test.tsx`

### Run tests

```bash
bun run test
```

### What is covered

- Lock token signing and verification edge cases
- Schema correctness and payload failures
- API happy paths + error paths for registration and statement routes
- Client-side register wizard basic interactions and redirects

### Suggested future test additions

- Auth callback route behavior with `x-forwarded-host`
- Proxy route behavior for protected/unprotected paths
- Dashboard legacy statement assignment regression tests

## 18) Common change recipes

### Change team cap per statement

- Edit `PROBLEM_STATEMENT_CAP` in `src/data/problem-statements.ts`

### Change allowed team size

- Edit `.min(2)` and `.max(4)` in `src/lib/register-schema.ts`

### Change event identity

- Update `EVENT_ID` and `EVENT_TITLE` in `src/lib/register-api.ts`

### Change problem statement catalog

- Update `PROBLEM_STATEMENTS` in `src/data/problem-statements.ts`

### Change lock timeout

- Edit `PROBLEM_LOCK_TOKEN_TTL_MS` in `src/lib/problem-lock-token.ts`

### Change canonical URL for sitemap/robots

- Set `FOUNDATHON_NEXT_PUBLIC_SITE_URL`
- Files:
  - `src/app/sitemap.ts`
  - `src/app/robots.ts`

### Change brand tokens and motion defaults

- `src/app/globals.css`
- `src/lib/constants.ts`

## 19) Deployment checklist

### App and env

- [ ] Deploy target sets Node runtime compatible with Next 16
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configured
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- [ ] `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` configured (recommended for PPT upload/delete)
- [ ] `FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET` configured
- [ ] `FOUNDATHON_NEXT_PUBLIC_SITE_URL` configured
- [ ] `FOUNDATHON_RESEND_API_KEY` configured (if email notifications should send)

### Supabase

- [ ] Google OAuth enabled
- [ ] Callback URL added (`/api/auth/callback`)
- [ ] Required migration applied
- [ ] `eventsregistrations` table contract verified

### Quality gates

- [ ] `bun run test` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` passes

## 20) Troubleshooting

### Error: "Supabase environment variables are not configured"

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If PPT upload/delete fails with storage policy errors, also set:

- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`)

### Error: "PROBLEM_LOCK_TOKEN_SECRET is not configured"

Set `FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET` in environment for runtime where API routes execute.

### OAuth callback is failing

Check:

- Google provider enabled in Supabase
- callback URL exactly matches host/protocol/path
- production reverse proxy sends `x-forwarded-host`
- cookies are not blocked by browser policy

### Register page loops to sign-in

Check:

- Supabase session cookie creation
- proxy integration in deployed runtime (`src/proxy.ts`)
- domain mismatch between callback and app origin

### Statement appears full unexpectedly

Inspect rows for current event id where:

- `event_id = EVENT_ID`
- `details ->> 'problemStatementId' = '<statement-id>'`

## 21) Known limitations

- Cap enforcement is app-level read/check/write and can race under concurrency.
- Database-level atomic insert function is not yet wired into registration route handlers.

---

Recommended onboarding reading order for new engineers:

1. `src/app/register/register-client.tsx`
2. `src/app/api/register/route.ts`
3. `src/app/api/register/[teamId]/route.ts`
4. `src/lib/register-api.ts`
5. `src/lib/register-schema.ts`
