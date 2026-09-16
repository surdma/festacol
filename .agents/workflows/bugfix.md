# Workflow: Bugfix

Use for a defect, regression, visual inconsistency, runtime failure, type defect, hydration
issue, accessibility defect, or unexpected behavior.

## Sequence

```text
orchestrator ├── owning engineer(s) ├── reviewer
```

Use the planner only when the defect spans several systems or requires a migration/deployment
strategy.

## Procedure

### 1. Reproduce before editing

Capture the smallest reliable reproduction: route and user action; expected behavior; actual
behavior; viewport and theme when visual; authentication state and role; console/network
evidence; relevant server response; failing check or diagnostic when practical.

Do not begin by rewriting the visible component.

### 2. Trace ownership

For a UI-visible failure, inspect in this order:

1. server surface reachability and status (Action/handler, Supabase, RLS/RPC);
2. data-shape validity (schema, fixture, banned-token contract);
3. hook request, session, and parsing behavior;
4. view-model derivation;
5. Server/Client Component boundary and hydration;
6. component state and composition;
7. shadcn primitive usage;
8. Tailwind token, theme, responsive layout, and accessibility behavior.

Route the root cause: Server Action/handler, Supabase query, RPC/RLS, fixture/seed, gating, or
migration defect → backend engineer; route, hook, state, component, theme, responsive, or
accessibility defect → frontend engineer; producer/consumer mismatch → backend engineer repairs
the producer shape first, then the frontend engineer updates the consumer.

### 3. Establish a failing check

Add or identify the narrowest useful regression check: fixture-contract case, runtime-contract
case, relation-SQL assert, unit/component test, browser reproduction, typecheck failure,
Biome finding, or React diagnostic finding. Do not create brittle tests for implementation
details when behavior can be tested.

### 4. Fix the root cause

Implement the smallest complete correction.

Bugfix guardrails:

- do not weaken the Zod parser or the fixture contract;
- do not add `any`, `@ts-ignore`, non-null assertions, or unsafe casts;
- do not add optional chaining to hide a missing required state;
- do not disable lint or Biome rules;
- do not use `suppressHydrationWarning` without proving the mismatch is expected;
- do not move a subtree client-side merely to silence a Server Component error;
- do not copy server data into local state to force rerenders;
- do not replace shadcn behavior with raw markup;
- do not add inline styles or a CSS file as a layout patch;
- do not bypass RLS, role re-checks, or webhook/secret verification to make a path work;
- do not redesign unrelated UI;
- do not introduce a generic abstraction for a one-location defect.

When touched code violates the local shadcn or Tailwind rules and the violation directly caused
or complicates the defect, correct it within the touched scope.

### 5. Verify

Run, as applicable: `seed:check` and the runtime-contract check when data-adjacent; scoped
Biome check during iteration; full scoped lint; typecheck; targeted regression checks;
production build; React diagnostics; the original reproduction in the relevant themes and
viewports; console and network inspection; and the real server surface for any server/data
defect (migrated/seeded asserts plus live success and failure evidence, pasted into the
handoff — not just compilation).

### 6. Review

The reviewer confirms: the original reproduction now passes; the fix belongs to the correct
owner; no data, auth, state, RSC, component, styling, or accessibility boundary was bypassed;
no unsafe suppression or unnecessary abstraction was introduced; regression coverage matches
the defect.

Do not expand the bugfix into an unrelated refactor.
