# Bug Fix

Operational entry for defects and regressions. The [bugfix workflow](../workflows/bugfix.md) owns
the full procedure; this command is the reproduce-first loop in short form.

1. Reproduce on the real runtime before editing:
   - browser defect: exercise the real route with a real browser, capture the failing state,
     viewports, themes, role, and console/network evidence;
   - server/data defect: reproduce against the migrated and seeded path (or the live dev
     server), capturing status, body, and shape validity.
2. Trace ownership per the workflow (producer before consumer) and route the root cause to the
   owning engineer.
3. Establish the narrowest failing check, then implement the smallest correct fix at the root
   cause. Do not suppress symptoms and do not bypass RLS, role re-checks, or secret
   verification.
4. Rerun the exact reproduction, then relevant regression checks and the
   global `dogfood` skill (`/dogfood`) pass on the affected surface.
5. If still failing, keep iterating or report a concrete blocker. Never declare success while the
   reproduced defect remains.

Return reproduction evidence, fix description, verification results, dogfood result, and remaining
risks in the standard handoff envelope from [`.agents/protocol.md`](../protocol.md).
