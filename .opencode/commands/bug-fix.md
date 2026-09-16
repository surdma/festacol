---
description: Reproduce a Festacol defect first, fix the root cause, and verify with regression evidence
agent: festacol-orchestrator
---

Follow [`.agents/commands/bug-fix.md`](../../.agents/commands/bug-fix.md). Reproduce on the real runtime before editing, trace ownership per the bugfix workflow, establish the narrowest failing check, fix the root cause without suppressing symptoms, rerun the reproduction plus regression checks and the global `/dogfood` pass, and return evidence in the standard handoff envelope.
