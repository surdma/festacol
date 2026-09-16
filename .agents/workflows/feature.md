# Workflow: Feature

Use for a new or changed product capability.

## Sequence

```text
orchestrator
├── planner when scope is non-trivial
├── backend engineer when Server Actions, Route Handlers, auth, Supabase, schema, RPC/RLS, fixtures, or scripts change
├── frontend engineer when routes, UI, or hooks change
└── reviewer
```

Skip an implementing role only when its owned surface is genuinely unaffected. Never skip the
reviewer gate for source changes.

## Procedure

### 1. Orchestrator

Classify the requested user operation and identify affected ownership surfaces. For
prototype-revamp work, confirm the manifest task map (primary plan plus governing contracts)
before sequencing.

### 2. Planner when useful

Define: user outcome; acceptance evidence; server and data impact (schema, fixtures, RPC/RLS);
route and state impact; exam-integrity implications; responsive and accessibility expectations;
role order; explicit exclusions.

### 3. Backend engineer when affected

- updates the data shape first: schema, fixtures, RPC/RLS, Server Action or handler payload;
- runs `seed:check`, the runtime-contract check, `prisma validate`, `db:generate`, and applies
  the migration plus seed plus RPC/RLS files against real Postgres with the relation asserts;
- implements the Server Action / Route Handler slice with Zod boundaries and server-side role
  re-checks;
- exercises the changed surface live (dev server success plus one relevant failure path:
  unauthenticated, forbidden role, expired link, or closed exam) and pastes commands plus
  bodies into the handoff — a handoff without live evidence is incomplete;
- hands the exact shape, error behavior, auth behavior, and modeled outcomes to the frontend
  engineer.

### 4. Frontend engineer when affected

Before implementation: loads the mandatory frontend skills; inspects the route, hooks, local
shadcn system, theme tokens, and the real server shape; defines the user task, hierarchy,
interactions, responsive transformation, and complete states; decides Server and Client
Component boundaries.

Implementation includes, as applicable: Server Component route composition; a narrow Client
Component interaction boundary; hook integration with the real server surface; Zod-safe
URL/form/storage input; shadcn-first components and intentional product components; Tailwind
semantic-token styling; loading, empty, partial, success, error, auth, pending, and recovery
states; responsive, theme, keyboard, focus, and accessibility behavior.

The frontend engineer verifies the feature against the real server path. A rendered fixture is
not end-to-end completion.

### 5. Reviewer

Independently validates: each changed ownership surface; the real server/UI seam; type and
runtime safety; Next.js Server/Client boundaries; shadcn and Tailwind discipline; user-flow
completeness; theme, responsive, accessibility, and browser behavior; applicable gates;
completion truth.

## Contract barrier

UI implementation must not invent an unresolved changed server or data shape. The backend
engineer first produces the migration, fixture/RPC shape, and working server surface with its
stable result and error states and authorization behavior. The frontend engineer consumes that
exact shape. Visual shell work may proceed independently, but the data-backed feature is not
complete until the real surface is integrated and parsed.

## Implementation guardrails

- Do not add Prisma Client runtime reads to avoid Supabase/RLS work.
- Do not define a local interface matching a server response.
- Do not use `any`, unsafe assertions, optional fields, or fallback strings to hide missing data.
- Do not convert the route to a Client Component unnecessarily.
- Do not hand-build a component that exists in local shadcn.
- Do not add component CSS files or inline styles.
- Do not introduce a global store for remote or local subtree state.
- Do not add a generic component abstraction before the product concept is clear.
- Do not omit non-happy states.
- Do not report completion without real route/server evidence.

## Completion conditions

For a full-stack feature: server and UI use the same real shape; the migration is applied when
required; authentication and authorization are exercised when required; the real surface is
called on relevant success and failure paths with live evidence; the UI parses the real
response; state reaches the intended final server condition; every modeled outcome has
intentional UI behavior; Server/Client boundaries are justified; shadcn primitives and semantic
tokens are used; themes, responsive behavior, accessibility, console, and network are verified;
gates pass; reviewer returns Pass.

Do not replace a required server capability with fixtures or a required UI flow with
server-only proof. Do not add unrelated infrastructure or roadmap work.
