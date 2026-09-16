# Doctrine: Supabase Auth, authorization, and security

Owner of: identity, sessions, authorization, browser security, secrets, and abuse prevention.
Cited by: backend engineer, frontend engineer, planner, reviewer.

## Authentication standard

Supabase Auth is the authentication system. `auth.users` is owned by Supabase; application
identity lives in `school_members` linked by `auth_user_id` with a `MemberRole`
(`student` / `teacher` / `administrator`) and `RecordStatus`.

Do not add a parallel custom JWT, password table, session cookie, or authentication protocol.
Use the dependency versions present in the repository and verify current `@supabase/ssr`
cookie behavior before editing session code.

## Client topology

- Browser: `createSupabaseBrowserClient` (`src/lib/supabase/client.ts`).
- Server Components / Actions / Route Handlers: `createSupabaseServerClient`
  (`src/lib/supabase/server.ts`) with cookie `getAll`/`setAll`.
- Request middleware: `updateSession` (`src/lib/supabase/middleware.ts`), invoked from
  `src/proxy.ts` so Auth cookies stay fresh on every matched request.
- Privileged server work: `createSupabaseAdminClient` (service role, no session persistence).
  Server-only. Never import it in client components.

The frontend must not decode cookies, trust local role state, or treat `proxy.ts` redirects as
authoritative authorization — every privileged read is re-checked server-side against
`school_members` (`status = active`) and RLS.

## Route gating (`src/proxy.ts`)

- `/dashboard/exam` stays reachable so new students can join an open qualifier through an exam
  link; every other `/dashboard/*` route requires an authenticated active `student` and
  preserves its destination as `?next=`.
- `/admin/*` (except `/admin/login`) requires an authenticated active `teacher` or
  `administrator`, preserving `?next=`.
- Cross-role sessions redirect to `/denied` with `from` + `reason`, never to the opposite login
  form. Preserve this behavior and its parameters when touching gating.

## Authorization

Authentication establishes identity. Authorization is enforced by the server and the database:

1. **Route gating** through `src/proxy.ts` (UX boundary, not a security boundary).
2. **Server re-checks** in Actions and Route Handlers via `src/lib/auth/*` against the active
   member role.
3. **Row-level security** in Postgres (`supabase/rls.sql`) so unauthorized records are never
   readable, plus security-definer RPCs (`supabase/auth-rpc.sql`) for exam access, attempt
   allocation, and retake grants.

Prefer queries scoped by actor or membership so unauthorized records are never loaded. Do not
accept a user ID from the request as identity.

## Admin bootstrap and webhooks

- `POST /api/admin/bootstrap` provisions the first admin and is gated by `SETUP_SECRET`. Set it
  once, create the admin, then rotate or remove it. Never expose it client-side.
- `POST /api/realtime/webhook` verifies Supabase Database Webhook calls with
  `SUPABASE_WEBHOOK_SECRET` before trusting any field. Add replay protection and idempotent
  ingestion for any new webhook behavior.

## HTTP hardening and abuse controls

- Keep validated non-simple requests for cookie-authenticated mutations; never mutate on GET.
- Apply stricter rate and concurrency limits to sign-in, bootstrap, exam-link minting, attempt
  allocation, webhook ingestion, and any expensive aggregation.
- Validate redirect destinations. Use an exact origin allowlist wherever CORS or redirects are
  configured; never combine credentials with wildcard origins.

## Secrets and logging

Never log or expose:

- cookies and authorization headers;
- service-role keys, webhook secrets, `SETUP_SECRET`;
- password, verification, or reset material;
- full candidate-link tokens beyond their intended share surface;
- other students' attempts, exam content, or raw provider payloads containing user data;
- database URLs.

Unexpected client-facing errors use a generic safe message. Internal detail belongs only in
redacted structured logs.
