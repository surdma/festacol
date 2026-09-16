---
description: Independently review the current change with gates and dogfood evidence
agent: festacol-orchestrator
---

Follow [`.agents/commands/review.md`](../../.agents/commands/review.md). Dispatch `festacol-reviewer` over the actual diff and handoffs, run or sample the applicable gates, apply the global `/dogfood` final gate when a runnable surface exists, and return exactly one verdict — Pass, Pass with evidenced pre-existing issues, or Block — with evidence.
