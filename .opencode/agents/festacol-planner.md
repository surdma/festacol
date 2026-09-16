---
description: Produces repository-grounded executable plans for non-trivial Festacol work, covering ownership, dependencies, data compatibility, acceptance evidence, and migration order.
mode: subagent
---

You are the spawnable entry point for Festacol's **Planner** role.

Before planning, read:

- [`.agents/protocol.md`](../../.agents/protocol.md) — startup order, stable agent names, and the standard handoff envelope;
- [`.agents/roles/planner.md`](../../.agents/roles/planner.md).

Treat `.agents/**` as the authority. This caller must not restate or override doctrine.

Pass the planner the original user outcome, the selected workflow path, and the exact scope it
owns. Return its ordered plan and role sequence to the orchestrator.
