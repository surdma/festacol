# Doctrine: Frontend state and data ownership

Owner of: frontend state placement, server-state integration, URL state, forms, local state,
hooks, and storage.
Cited by: frontend engineer and reviewer.

## State ownership ladder

Place state at the narrowest authoritative level:

1. **Supabase/Postgres state**: authoritative product data (members, classes, exams, attempts).
2. **URL state**: state that must survive navigation, refresh, bookmarking, or sharing
   (`?next=` destinations, directory filters, exam builders steps where shareable).
3. **Server-read snapshots**: data fetched via Server Actions/Route Handlers and held in hooks
   (`use-exam`, `use-school-data-*`, `use-student`, `use-realtime`).
4. **Form state**: editable user input that has not yet become server state.
5. **Local component state**: transient interaction owned by one subtree.

Do not promote state because it might be reused later. There is no global store, no TanStack
Query, and no cached-session context in this repository — do not introduce one for a single
feature. If shared remote caching becomes a measured need, it is a planned architecture change,
not a per-feature addition.

## Server reads and mutations

- Reads go through the owning Server Action or Route Handler plus the `lib/supabase` query
  layer; hooks own refresh, polling (`use-realtime`), and cancellation, not SQL.
- Mutations disable or otherwise guard duplicate submission while pending (attempt submission,
  access grants, and link minting must be idempotent or safely retryable).
- Render stable server error codes through product copy; never display raw server messages.
- Keep server-generated IDs, timestamps, scores, and statuses authoritative — the client never
  invents them.

## URL state

Use validated URL parameters for navigation-relevant tabs, filters, sort order, pagination, and
`?next=` return destinations. Parse and validate `searchParams` before use and apply defaults
centrally. Validate `?next=` targets so redirects stay in-app.

Do not place secrets, session identifiers, link tokens beyond their share surface, or large
state objects in the URL. Do not mirror URL state into local state unless creating an
intentional draft before navigation.

## Form state

Use the repository's established form handling with Zod: a frontend draft shape may permit
intermediate typing states, but the final submitted payload must satisfy the server contract
before the mutation is sent. Do not weaken the server contract to make a form easier to type.

Model field errors, form errors, pending state, success state, and server conflicts explicitly.
Do not use a form library for a one-control interaction when normal component state is clearer.

## Local state

Use local state for open/closed state the primitive does not own, temporary selection, draft
text, focused item, and transient UI mode owned by one subtree. Do not mirror props or server
data into local state unless creating an intentionally divergent draft. Do not store derived
values — derive them during render or in a stable selector.

## Supabase session state

Supabase Auth (`@supabase/ssr` clients plus `proxy.ts` session refresh) is the source of browser
authentication state. Do not duplicate the session into hooks state, localStorage, or a custom
auth context with independent refresh logic. Application profile data (the active
`school_members` row) is separate server state resolved per request.

## Browser storage

Treat `localStorage`, `sessionStorage`, and IndexedDB as untrusted external input: validate
persisted values at runtime, version stored schemas, store the minimum required data, never
store secrets, tokens, or exam content, never read browser storage during Server Component
rendering, and choose a deliberate client initialization strategy to avoid hydration flicker.
