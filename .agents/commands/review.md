# Review

Operational entry for independent review of a change.

1. Read `AGENTS.md`, [`.agents/protocol.md`](../protocol.md),
   [`roles/reviewer.md`](../roles/reviewer.md), the workflow used for the change, and
   [validation and reporting](../doctrine/validation-and-reporting.md).
2. Inspect the actual diff, current repository state, and implementation handoffs. Do not assume
   the implementing agent is correct.
3. Load review skills by changed scope (data skills for server/data changes; mandatory frontend
   skills plus `react-doctor` for material UI changes).
4. Run or independently sample the applicable gates — INCLUDING the Festacol gate sequence and,
   for data changes, the migrated/seeded asserts (relation SQL, RPC/RLS applies). For server
   scope, sample at least one success and one failure path against the real surface. If the
   implementer's handoff lacks gate output plus live surface evidence, immediately Block with
   `missing verification`. For cross-surface work, verify the real seam: real shape, real
   server response, real parser, rendered states.
5. Apply the global `dogfood` skill (`/dogfood`) gate as the final completeness check whenever
   a runnable surface exists; otherwise record explicitly which checks were not applicable and
   why. Dogfood MUST include live surface evidence — do not let compilation stand in.

Return exactly one verdict — `Pass`, `Pass with evidenced pre-existing issues`, or `Block` —
using the standard handoff envelope. Every blocking finding names severity, evidence, owning
role, concrete remediation, and required re-verification. Re-review after fixes.
