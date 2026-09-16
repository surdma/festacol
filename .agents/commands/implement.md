# Implement

Operational entry for executing an accepted task end to end.

1. Read `AGENTS.md`, [`.agents/protocol.md`](../protocol.md), the assigned
   [role](../roles/), and the one governing [workflow](../workflows/) selected by the orchestrator.
2. Load only the skills the role and changed scope require.
3. Implement the smallest complete solution inside your ownership boundary — no placeholders,
   no fixtures standing in for available server capability, no unrelated cleanup.
4. Verify with the gates owned by
   [validation and reporting](../doctrine/validation-and-reporting.md): exact repository commands
   (`seed:check`, runtime-contract check, `prisma validate`, `db:generate`, `tsc --noEmit`,
   `build`, scoped `biome lint`), real runtime behavior on success and failure paths, and the
   global `dogfood` skill (`/dogfood`) acceptance pass when a runnable surface exists.
   **Mandatory for any server/data change** — before handoff, prove the migrated and seeded
   path: `migrate deploy` → `db:seed` → `seed-relations.sql` → `auth-rpc.sql` + `rls.sql`
   applied with the platform asserts, plus dev-server evidence (one success, one relevant
   failure: unauthenticated, forbidden role, expired link, or closed exam). Paste every
   command plus truncated output into the handoff `VERIFIED` field. A handoff with only
   typecheck/build output and no live surface evidence is incomplete and will be Blocked by
   the reviewer.
5. If verification fails, iterate: reproduce → diagnose → fix → rerun the failing check →
   rerun relevant regression checks. Do not document an unverified pass.

Return to the orchestrator using the standard handoff envelope from `.agents/protocol.md` with
exact evidence. The reviewer owns the completion verdict; an implementing role never declares
overall completion.
