# Feature Review

Operational entry for end-to-end acceptance of a delivered feature.

1. Read `AGENTS.md`, [`.agents/protocol.md`](../protocol.md),
   [`roles/reviewer.md`](../roles/reviewer.md), and
   [validation and reporting](../doctrine/validation-and-reporting.md).
2. Map each acceptance criterion to a concrete user-visible or server-observable behavior.
3. Exercise the real end-to-end flow — no fixtures standing in for available server capability,
   no source inspection substituting for a runnable check.
4. Frontend: real routes, primary actions, navigation/forms/dialogs, complete state coverage
   (loading, empty, partial, error, auth, pending, recovery), responsive viewports, themes,
   keyboard/focus behavior, accessible names, console/network health, and material visual evidence.
5. Server/data: gate sequence plus real-surface checks on meaningful success, validation,
   authorization, boundary, and idempotency cases (duplicate submit, revoked grant, expired
   link, closed exam where applicable).
6. Run the global `dogfood` skill (`/dogfood`) acceptance pass and record evidence.
7. Fix findings through their owning engineers, then rerun affected checks before passing.

Return acceptance coverage, evidence, defects found and fixed, remaining risks, and a final
pass/block decision using the standard handoff envelope from `.agents/protocol.md`.
