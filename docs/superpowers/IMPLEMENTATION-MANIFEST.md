# Festacol Prototype Revamp — Implementation Manifest

**Planning PR:** [#10](https://github.com/surdma/festacol/pull/10)  
**Implementation PR:** [#11](https://github.com/surdma/festacol/pull/11)  
**Status:** Product-owner approved; implementation in progress  
**Repository target:** current `master`, with the prototype isolated under `/prototype`

This file is the mandatory entry document for any agent implementing the Festacol prototype revamp. It exists to prevent task execution from relying on chat memory, guessed requirements, or only one planning file.

## Mandatory reading order before any implementation task

1. Read this manifest.
2. Read the task's **Primary plan** below.
3. Read every listed **Governing contract** for that task.
4. Inspect current `master` and the current PR #11 branch before editing.
5. Apply the current RelvorLabs Engineering Lead, HANDOFF protocol, and `using-superpowers` skill.
6. Do not mark a task complete until the progress ledger, validation evidence, commit, push, and PR checklist all agree.

## Precedence rules for known planning contradictions

When documents disagree, use this order rather than guessing:

1. **Current repository/master state** controls physical paths, package boundaries, and files that actually exist.
2. **This manifest** controls which documents an implementation task must read and the current PR relationship.
3. **`2026-09-12-single-shell-tailwind-routing-contract.md`** and its execution plan override older statements about `index.html`, alias pages, Flowbite CSS, standalone page shells, and final CSS ownership.
4. **`2026-09-12-question-bank-expansion-contract.md`** overrides every older `500+` seed-bank minimum with **at least 720 validated seed questions**.
5. **`2026-09-12-admin-ui-ux-governance-and-depth-contract.md`** and the UI/UX execution gates override weaker or older UI implementation guidance.
6. The broader main design/spec and implementation plan remain authoritative for requirements not superseded above.

Concrete consequences:

- the prototype is currently an isolated package under `/prototype`;
- prototype validation scripts are `prototype/scripts/prototype-audit.mjs` and `prototype/scripts/state-contract.mjs`;
- `prototype/index.html` becomes the canonical application shell;
- `admin.html`, `student.html`, and `exam.html` remain thin forwarding aliases rather than independent shells;
- the final prototype has zero repository `.css` files and no Flowbite CSS dependency;
- the final question-bank minimum is 720 validated seed questions;
- stale pre-move path snippets in older plans must not be recreated.

## Source-of-truth documents

- [Main implementation plan](./plans/2026-09-12-admin-experience-revamp.md)
- [UI/UX execution gates](./plans/2026-09-12-admin-ui-ux-execution-gates.md)
- [Single-shell/Tailwind routing execution plan](./plans/2026-09-12-single-shell-tailwind-routing-execution.md)
- [Main product/design specification](./specs/2026-09-12-admin-experience-revamp-design.md)
- [UI/UX governance and depth contract](./specs/2026-09-12-admin-ui-ux-governance-and-depth-contract.md)
- [Single-shell/Tailwind routing contract](./specs/2026-09-12-single-shell-tailwind-routing-contract.md)
- [Question-bank expansion contract](./specs/2026-09-12-question-bank-expansion-contract.md)
- [Implementation progress ledger](./progress/2026-09-12-admin-experience-revamp-progress.md)
- [Canonical Task 1–2 closure checklist](./progress/2026-09-12-task-1-2-closure.md)
- [Canonical Task 3 closure checklist](./progress/2026-09-12-task-3-closure.md)

## Task → governing-document map

| Task | Primary plan | Governing contracts that must also be read |
| --- | --- | --- |
| **1. Preservation contracts and migration guardrails** | Main implementation plan — Task 1 | Main design spec; single-shell routing contract; current master `/prototype` package layout; **Task 1–2 closure checklist for completed-step evidence** |
| **2. Consolidate shared domain behavior into `shared.js`** | Main implementation plan — Task 2 | Main design spec shared-runtime section; single-shell routing contract; preservation/state contracts; **Task 1–2 closure checklist for completed-step evidence** |
| **3. Migrate Student surface to `student.js`** | Main implementation plan — Task 3 | Single-shell routing execution **Gate E**; single-shell routing contract **Student** section; UI/UX governance; Tailwind-only styling contract; **Task 3 closure checklist for completed-step evidence** |
| **4. Migrate candidate Exam surface to `exam.js`** | Main implementation plan — Task 4 | Single-shell routing execution **Gate F**; exam behavior requirements in main design spec; UI/UX governance; Tailwind-only styling contract |
| **5. Answer-aware Question Bank and seed expansion** | Main implementation plan — Task 5 | Question-bank expansion contract; main design spec Question Bank/scoring sections; minimum **720 validated seed questions** |
| **6. Canonical index shell + Admin runtime** | Main implementation plan — Task 6 | Single-shell execution **Gates B–D**; UI/UX execution Gates 0–4; routing contract; UI/UX governance |
| **7. Students, Staff, Classes, WhatsApp, Settings** | Main implementation plan — Task 7 | Main design spec domain sections; UI/UX execution Gate 8 route-specific requirements; UI/UX governance |
| **8. Examination management and lifecycle** | Main implementation plan — Task 8 | Main design spec examination lifecycle/edit/distribution requirements; UI/UX execution Gates 4–6 and route-specific Examinations requirements |
| **9. Five-stage exam builder** | Main implementation plan — Task 9 | Main design spec builder requirements; UI/UX execution **Gate 7 Stepper**; UI/UX governance |
| **10. Advanced Question Bank administration** | Main implementation plan — Task 10 | Question-bank expansion contract; main design Question Bank requirements; UI/UX execution Question Bank route requirements |
| **11. Reports, merit, placement, integrity** | Main implementation plan — Task 11 | Main design reporting/integrity relationship; UI/UX execution Reports route requirements; nested-navigation contract |
| **12. Remove legacy runtimes/CSS/Playwright and simplify CI** | Main implementation plan — Task 12 | Single-shell routing/Tailwind contract; zero-CSS requirement; final four-runtime contract; current `/prototype/package.json` and workflow layout |
| **13. Independent Test, Review, UX-aware Dogfood** | Main implementation plan — Task 13 | UI/UX execution Gates 9–11; main acceptance matrix; HANDOFF/Test/Reviewer/Dogfood personas |
| **14. Git/Release finalization** | Main implementation plan — Task 14 | Git/Release persona; `create-pr` skill; this manifest; progress ledger; all prior task acceptance criteria |

## Repository-layout invariant

Current `master` is authoritative. The prototype is an isolated package under:

```text
prototype/
├── admin.html
├── student.html
├── exam.html
├── index.html
├── assets/
├── data/
├── js/
├── scripts/
├── tests/
├── package.json
└── playwright.config.js
```

Implementation work must not recreate the old pre-move root-level prototype scripts/tests/package layout. Prototype validation scripts belong in `prototype/scripts/` and GitHub Actions executes them with `prototype/` as the working directory.

## PR relationship invariant

- **PR #10 is the approved planning parent.** It contains the requirements and this manifest.
- **PR #11 is the implementation child.** It is based on `master`, carries the planning documents/manifest required by implementation agents, and is updated milestone-by-milestone.
- PR #11 explicitly links PR #10, and PR #10 explicitly links PR #11.
- New implementation tasks update PR #11 rather than opening disconnected implementation PRs unless the product owner explicitly requests a split.

## Completion invariant

A task is complete only when all are true:

- implementation is present in PR #11;
- relevant contracts/tests pass;
- required review/integration gates pass;
- the progress ledger marks it complete with evidence;
- the PR #11 checklist marks it complete;
- the milestone commit is pushed and its remote SHA is verified.

For Tasks 1 and 2, `progress/2026-09-12-task-1-2-closure.md` is the canonical per-step completion checklist and evidence record.  
For Task 3, `progress/2026-09-12-task-3-closure.md` is the canonical per-step completion checklist and evidence record.

These closure files exist specifically to remove ambiguity from the original planning template's historical unchecked boxes, superseded routing examples, and pre-move paths.
