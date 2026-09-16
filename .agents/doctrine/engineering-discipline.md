# Doctrine: Engineering discipline

Owner of: evidence-driven implementation, professional judgment, type/runtime safety, and scope.
Cited by: every implementing and reviewing role.

## Professional stance

Work as an industry engineer responsible for correctness, operability, security, and maintenance.
Do not optimize for the amount of code produced. Do not imitate architecture patterns without a
problem that requires them.

A strong implementation is the smallest coherent design that:

- satisfies the user's requirement;
- preserves system invariants (exam integrity, role separation, relational history);
- handles realistic failure modes;
- can be tested and operated;
- remains understandable to the next engineer.

## Working loop

1. **Inspect** the relevant implementation, schema, fixtures, configuration, scripts, and specs.
2. **Observe** current behavior or reproduce the defect — against the live dev server and real
   Supabase/Postgres path when a server surface exists; reproduction against mocks alone is
   insufficient.
3. **Define** acceptance criteria and affected ownership surfaces.
4. **Implement** one coherent increment.
5. **Execute** the narrowest useful verification immediately — for server/data changes this means
   the Festacol gate sequence (fixture contract, runtime contract, `prisma validate`,
   `db:generate`, typecheck, scoped lint) plus exercising the changed route or action, not just
   `pnpm build`.
6. **Diagnose from evidence** when it fails; do not guess repeatedly.
7. **Complete the whole requested slice**, including fixtures/migrations when the data shape
   changes, and consumer integration.
8. **Run completion gates** — including the full verification order in the root `AGENTS.md` —
   and inspect the final diff.

A file creation is not evidence of a working feature. A green typecheck without exercising the
changed route is not evidence either.

## Scope judgment

- Do not perform unrelated cleanup.
- Do not defer a required part of the requested capability (including the migration, fixture, or
  RLS/RPC half of a data change).
- Do not introduce speculative infrastructure.
- Do not preserve a known defect in the exact path being implemented merely to keep the diff
  small.
- When a necessary fix crosses owned surfaces, use the correct workflow rather than hiding it in
  one role.

## Type safety

- Use `unknown` for untrusted values and narrow them.
- Do not introduce `any` in application code.
- Do not use casts or non-null assertions to silence a real uncertainty.
- A library interop cast is acceptable only after runtime validation or a proven invariant and
  should be isolated at the boundary.
- Derive shared shapes from Zod schemas and the canonical DB types; do not hand-write a second
  interface for the same row.
- Model lifecycle states (exam `draft`/`open`/`closed`, attempt progress, access decisions) with
  discriminated unions where states have different valid data.
- Preserve meaningful distinctions between absent, empty, zero, and false.

## Runtime safety

Validate all untrusted boundaries:

- HTTP requests and webhook payloads (including `SUPABASE_WEBHOOK_SECRET` verification);
- environment variables;
- cookies and session data through Supabase Auth;
- fixture files before seeding;
- URLs and redirect destinations (`?next=` targets);
- RPC inputs and Server Action arguments.

Static types do not replace runtime parsing.

## Exception judgment

Do not wrap every `await` in `try/catch`.

Catch only when the current layer can do at least one of the following:

- recover;
- perform a bounded, safe retry;
- translate a known infrastructure error into an application error;
- add essential context not available to the global logger;
- release a manually acquired resource;
- convert a provider-specific condition into a modeled result.

Otherwise, allow the error to propagate to the centralized handling path. Do not log and rethrow
at several layers.

## Edge cases

For changed behavior, consider the cases relevant to the feature:

- absent, empty, one, and many;
- slow and timed out;
- invalid and unauthorized;
- duplicate and concurrent (double submit, double attempt allocation);
- stale and retried;
- dependency unavailable (Supabase unreachable, pooler failure);
- expired links, closed exams, revoked grants;
- long text and large numeric values.

Do not force UI-only edge cases onto a data-only task or database-only edge cases onto a visual
change. Apply judgment to the actual surface.

## Comments and documentation

Comments explain non-obvious reasons, invariants, or external constraints (pooler behavior, RLS
assumptions, exam-integrity rules). They do not narrate the syntax.

When implementation changes architecture or a data contract, update the owning doctrine, decision
record, or fixture/spec artifact in the same task.
