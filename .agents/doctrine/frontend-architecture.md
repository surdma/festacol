# Doctrine: Next.js frontend architecture

Owner of: frontend layering, React Server Component boundaries, Server Action usage, API
consumption, type safety, runtime safety, and frontend performance.
Cited by: frontend engineer, planner, reviewer.

## Frontend responsibility

The frontend is Festacol's product interface and the consumer of its own server surface (Server
Actions and Route Handlers backed by Supabase). It owns presentation, interaction, route
composition, client-side state, and frontend validation. It does not own persistence,
authorization, or exam invariants — those live server-side.

The frontend must remain understandable as a product system. Do not organize it as pages full of
fetch calls, effects, local types, and ad hoc components.

## Required structure

Follow the current repository structure:

```text
src/
├── app/                        Next.js routes + framework boundaries
│   ├── actions/                "use server" mutations and server reads (backend-owned)
│   └── api/                    Route Handlers: admin, exam(s), realtime, student (backend-owned)
├── components/
│   ├── ui/                     local shadcn primitives (business-free)
│   └── admin/                  intentional product components
├── hooks/                      client interaction hooks
├── lib/
│   ├── supabase/               clients, SSR session, queries (backend-owned)
│   ├── auth/                   role helpers (backend-owned)
│   └── utils.ts nav.ts         shared helpers
└── types/                      db.ts (backend-owned) + admin/exam view types
```

Routes compose hooks and product components. Route files do not become feature
implementations. `components/ui` contains local shadcn source and genuinely reusable
business-free primitives — no domain rules, server calls, or authorization.

## Server Component and Client Component decision

Server Components are the default.

Use a Server Component when the component composes a route, renders request-derived content,
and needs no state, effects, event handlers, or browser APIs.

Use a Client Component when the component requires event handlers, `useState`/`useEffect`,
hook-driven Supabase reads, browser APIs, focus management, or interactive shadcn primitives.

Boundary rules:

- Place `"use client"` at the smallest stable interactive boundary.
- A Server Component may render a Client Component and pass serializable props only — no
  functions, class instances, or non-serializable values.
- Do not import a Client Component hook into a Server Component.
- Do not make an async Client Component.
- Do not mark an entire route client-side to solve one leaf interaction.

## Server Actions and Route Handlers

- Mutations go through Server Actions (`src/app/actions/*`) or the owning Route Handler.
  Validate every argument with Zod at the boundary; re-check the caller's role server-side.
- `src/app/api/*` handlers own webhook verification, admin bootstrap/staff operations, and exam
  runtime endpoints. They contain transport + auth + delegation only — business rules live in
  the `src/lib` data libraries they call.
- Never call Supabase service-role or bypass RLS from the browser. Never trust a role, attempt
  ID, or score submitted by the client without server verification.

## Next.js framework boundaries

Use special files intentionally: `layout.tsx` for shared structure, `loading.tsx` for
meaningful streaming fallback, `error.tsx` for recoverable route errors, `not-found.tsx` and
`notFound()` for true missing resources, metadata APIs for route metadata, Suspense around
independently loading regions.

Do not use `suppressHydrationWarning` as a general repair.

## Runtime-safe data consumption

Server data reaches UI through Server Actions, Route Handlers, or the `lib/supabase` query
layer — and it is validated before render:

- parse Supabase rows into `src/types` shapes; never return raw unvalidated payloads to hooks;
- convert server errors into a stable typed error with a safe message;
- never parse or normalize server data inside a visual component.

## Type-safe and null-safe frontend

- Keep strict TypeScript enabled. No `any`, broad `unknown` casts, double assertions, or
  `@ts-ignore` to complete a feature. No non-null assertions for data that can be absent.
- Parse URL, storage, and server data before use.
- Model loading, empty, unauthorized, forbidden, unavailable, partial, and success states
  explicitly with discriminated unions and exhaustive switches.
- Distinguish `null`, `undefined`, empty collections, and missing resources when they differ.
- Do not make fields optional merely to silence a component error, and do not hide required
  missing data behind long optional chains or `?? ""`.
- Prefer a visible fallback or modeled error state to silently rendering incomplete UI.

## Component architecture

- Create components around stable product concepts (`MetricCard`, `StatusBadge`,
  `ExamIdDialog`, `AccessDenied`) — not to reduce line count.
- Prefer composition over boolean-prop matrices; use explicit semantic variants.
- Keep providers narrow and near the subtree that needs them.
- Separate data acquisition from presentational rendering, without ceremonial container
  wrappers.
- Do not define React components inside other components. Use stable domain identifiers as keys.
- Derive values during render; do not mirror props or server data into state through effects.
- Do not create generic `DataCard`/`InfoBox` page-builder APIs without several proven uses.

## Performance

Apply `vercel-react-best-practices` from evidence and impact, not as a reason to add complexity:
eliminate avoidable request waterfalls, keep client bundles narrow (charts/QR/exam runners load
at their usage boundary), avoid duplicate server/client requests, minimize serialized data
across Server/Client boundaries, keep hook subscriptions narrow, paginate large collections,
measure before memoizing.
