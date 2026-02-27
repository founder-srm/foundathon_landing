# Security Hardening Implementation Plan (API + Auth + Upload + Headers)

## Summary
Implement a full app-layer security hardening pass for the Next.js API/auth flows with these decided choices:
- Use distributed rate limiting with **Upstash Redis**.
- Enforce **strict Origin/Referer CSRF checks** on mutating routes.
- Harden OAuth callback redirects with **allowlist + fallback**.
- Add stronger browser security headers (**CSP + HSTS**).
- Add upload file **magic-byte validation** for PPT/PPTX.
- Standardize throttle responses as `429` JSON with `Retry-After`.
- Keep DB SQL changes and service-role env naming unchanged for this pass (explicitly requested).

## Scope
1. In scope:
- `src/app/api/**` route hardening.
- Shared security utilities under `src/server/**` and `src/server/http/**`.
- `next.config.ts` headers hardening.
- Client logout flow update to use POST instead of GET-triggered logout.
- Tests and docs for all behavior changes.

2. Out of scope for this pass (accepted risks):
- No new Supabase SQL migrations for RLS/constraints.
- No change to current `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` support.

## Public API / Interface Changes
1. New environment variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `FOUNDATHON_ALLOWED_REDIRECT_HOSTS` (comma-separated hostnames, optional ports allowed)

2. Route behavior changes:
- Mutating routes return `403` for CSRF failures with JSON error payload.
- Rate-limited routes return `429` with JSON body:
  - `{ "error": "Too many requests. Please try again later.", "code": "RATE_LIMITED" }`
- `429` responses include:
  - `Retry-After`
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
- `/api/auth/logout` will be POST-only (GET removed; framework returns 405 automatically).

3. OAuth callback redirect policy:
- `x-forwarded-host` is used only if in `FOUNDATHON_ALLOWED_REDIRECT_HOSTS`.
- Otherwise fallback order: request origin (dev) -> configured site URL/origin (prod fallback-safe).

## Implementation Details

### 1) Add Security Modules
1. Add `src/server/security/client-ip.ts`
- Resolve client IP from headers in order:
  - `cf-connecting-ip`
  - `x-real-ip`
  - first IP in `x-forwarded-for`
  - fallback `"unknown"`

2. Add `src/server/security/rate-limit.ts`
- Initialize Upstash Redis + `@upstash/ratelimit`.
- Define named policies with explicit windows/limits:
  - `auth_login_ip`: 20 / 10 min
  - `auth_callback_ip`: 60 / 10 min
  - `problem_lock_ip`: 40 / 10 min
  - `problem_lock_user`: 10 / 10 min
  - `register_create_ip`: 20 / 10 min
  - `register_create_user`: 5 / 10 min
  - `register_modify_ip`: 60 / 10 min
  - `register_modify_user`: 20 / 10 min
  - `presentation_upload_ip`: 10 / hour
  - `presentation_upload_user`: 5 / hour
- Provide a helper returning either `null` (allowed) or a ready `NextResponse` 429.
- Fail-mode behavior:
  - Development: fail-open if Redis unavailable.
  - Production: fail-closed with `503` JSON for protected endpoints.

3. Add `src/server/security/csrf.ts`
- Validate mutating requests (`POST/PATCH/DELETE`) by requiring same-origin via:
  - `Origin` header match OR
  - `Referer` origin match.
- Return standardized 403 JSON on failure.

4. Extend `src/server/http/response.ts`
- Add helper for throttled responses with required headers.
- Keep current no-store behavior.

### 2) Integrate Route Protections
1. `/api/auth/login` GET
- Apply IP limiter before OAuth call.

2. `/api/auth/callback` GET
- Apply IP limiter.
- Replace current host trust logic with allowlist check.

3. `/api/auth/logout` POST
- Keep sign-out logic.
- Remove GET handler.
- Add CSRF check on POST.

4. `/api/problem-statements/lock` POST
- CSRF check first.
- IP limiter.
- After auth context, user limiter.

5. `/api/register` POST/DELETE
- CSRF check.
- IP limiter.
- After auth context, user limiter.
- Keep GET unmodified except optional read limiter (not required in this pass).

6. `/api/register/[teamId]` PATCH/DELETE
- CSRF check.
- IP limiter.
- After auth context, user limiter.

7. `/api/register/[teamId]/presentation` POST
- CSRF check.
- IP limiter.
- After auth context, user limiter.

### 3) Upload Hardening
1. Add magic-byte validation in `src/lib/presentation.ts` (or new helper under `src/server/security`):
- `.ppt` must match CFB signature: `D0 CF 11 E0 A1 B1 1A E1`.
- `.pptx` must match ZIP signature: `50 4B 03 04` (or valid ZIP variant supported by Office).
2. Enforce this in `submitTeamPresentation` before upload.
3. Keep existing extension + MIME + size checks as additional gates.

### 4) Security Headers
1. Update `next.config.ts` headers:
- Add CSP with sources compatible with existing app behavior:
  - `default-src 'self'`
  - `script-src 'self'` (dev may include `'unsafe-eval'` only)
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' https://fonts.gstatic.com data:`
  - `img-src 'self' data: blob: https:`
  - `connect-src 'self' https://*.supabase.co`
  - `frame-src https://view.officeapps.live.com`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
- Add HSTS in production responses:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Keep existing headers.

### 5) Frontend Logout Flow
1. Update `HeaderClient` logout action:
- Replace `window.location.assign("/api/auth/logout")` with POST form submission to `/api/auth/logout`.
- Preserve current UX (disable while logging out, close menu first).

### 6) Observability
1. Add structured security logs for:
- Rate-limit denies (`route`, `policy`, `keyType`, `ip`, optional `userId`).
- CSRF rejects (`route`, `ip`, origin/referrer presence).
- OAuth host allowlist rejects (`forwardedHost`, `origin`).
2. Use sanitized logs (no tokens, no raw PII beyond hashed/partial identifiers where needed).

## Test Plan

## 1) Unit tests
1. `rate-limit` helper:
- allows under limit
- blocks over limit with correct headers/body
- dev fail-open when Redis missing
- prod fail-closed when Redis missing
2. `csrf` helper:
- accepts matching origin
- accepts matching referer origin
- rejects cross-origin
- rejects missing both
3. upload magic-byte validator:
- valid ppt
- valid pptx
- extension/signature mismatch rejected

## 2) Route tests
1. `/api/auth/login`:
- returns 429 when limited
2. `/api/auth/callback`:
- uses allowlisted forwarded host
- ignores non-allowlisted forwarded host and falls back
3. `/api/auth/logout`:
- GET returns 405
- POST with invalid origin returns 403
- POST success still returns 303 redirect
4. `/api/problem-statements/lock`, `/api/register`, `/api/register/[teamId]`, `/presentation`:
- CSRF reject case (403)
- rate-limit reject case (429)
- existing success paths still pass

## 3) Regression checks
1. `bun run test` full suite.
2. Verify no API contract regressions in existing frontend flows:
- sign-in
- register
- lock statement
- upload presentation
- logout redirect.

## Documentation Updates
1. Update `.env.example`:
- add Upstash vars
- add `FOUNDATHON_ALLOWED_REDIRECT_HOSTS` example
2. Update README security section:
- rate-limit policies and fail modes
- CSRF requirement for mutating API calls
- redirect allowlist behavior
- note unresolved DB-level hardening due current scope decision.

## Assumptions and Defaults
1. Chosen defaults from your decisions:
- Upstash REST for limiter backend.
- Strict Origin/Referer CSRF enforcement.
- OAuth host allowlist + fallback.
- 429 responses include `Retry-After` and rate headers.
- No SQL migration hardening this pass.
- No service-role env naming changes this pass.
2. Operational assumption:
- Production will provide valid Upstash credentials before deploy; without them, protected routes return 503 (fail-closed in prod).
