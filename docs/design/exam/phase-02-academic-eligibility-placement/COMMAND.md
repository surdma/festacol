# Phase 02 — Academic Eligibility & Placement brainstorm command

Status: staged, **not yet executed**
Prerequisite: Phase 01 remains the approved Admission Pass direction.
Governing plan: `docs/plans/2026-09-17-phase-02-academic-eligibility-placement.md`

This file records the exact design-generation brief that should be used when Phase 02 exploration begins. Creating this command does not approve or implement any Phase 02 production UI.

## Design-system search

Run the current `ui-ux-pro-max` design-system search first:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py \
  "academic eligibility class verification SS1 placement examination secondary school candidate registrar decision high stakes calm" \
  --design-system \
  -p "Festacol Exam — Phase 02 Academic Eligibility & Placement"
```

## Generation command

```text
/using-superpowers
/ui-ux-pro-max

Act as a principal staff UI/UX and product designer for Festacol, an academic electronic examination platform for secondary-school students.

TASK
Design ONLY Phase 02: "Academic Eligibility & Placement" for the production examination journey. Produce one standalone low-fidelity `brainstorm.html` containing exactly seven genuinely different UI/UX directions, labelled A–G. Do not implement production React/Next.js code.

CONTEXT
Phase 01 is already selected as the high-fidelity Admission Pass. Phase 02 begins only after candidate identity/authentication succeeds. It must continue the same serious academic tone while using a new interaction model appropriate to academic-record verification and SS1 placement decisions.

VERIFIED SERVER CONTRACT
The authenticated onboarding surface currently receives only:
- examination id, title, mode, status, startsAt and endsAt;
- active academic levels: id, name, ordinal;
- active classes: id, academic level, academic track and arm;
- the candidate's one persisted active class enrollment when it exists.

The server owns all academic consequences. Preserve these exact branches:

1. EXISTING ACTIVE ENROLLMENT
- Show the persisted class as an academic record to verify, not as an editable class choice.
- Candidate may confirm it.
- Candidate cannot self-transfer; staff must make class changes.
- Placement is unavailable.
- For a qualifier examination, a candidate with a confirmed class returns to the dashboard instead of writing placement.
- For a normal examination, `my_exam_access` is re-checked before continuing.

2. NO ENROLLMENT + NORMAL EXAMINATION
- Candidate selects current academic level.
- Candidate selects a valid active class belonging to that level.
- That class becomes the candidate's initial persisted class record.
- Server re-checks examination eligibility after persistence.

3. NO ENROLLMENT + SS1 QUALIFIER
Only after SS1 is selected, present two materially different academic routes:
- Placement examination: for a candidate entering SS1 who is not yet placed into Science, Humanities or Business. No class is selected. Server grants the existing one-attempt placement access and re-checks eligibility.
- Known class: candidate chooses their actual SS1 class. The class is persisted and the candidate returns to the dashboard rather than writing placement.

4. PLACEMENT ATTEMPT CONSTRAINT
If the allowed placement attempt is already consumed and there is no active attempt, only a teacher or administrator can grant a retake. Do not imply the candidate can reset or request a new attempt from this phase.

5. ERROR STATES
Represent places for:
- academic configuration unavailable;
- multiple active classes requiring staff correction;
- persisted class no longer active;
- no active classes for selected level;
- class/level mismatch;
- concurrent class confirmation conflict;
- non-qualifier placement attempt;
- placement outside SS1;
- examination access denial;
- consumed placement attempt;
- pending save / route transition.

DO NOT INVENT
Do not invent or display:
- subjects for this phase unless the server contract is extended later;
- placement score, ranking, predicted result or recommended track;
- automatic class transfer;
- class capacity allocation;
- teacher recommendation;
- pass/fail threshold;
- biometric or AI-proctor claims;
- new database fields or server capabilities.

ACADEMIC TERMINOLOGY
Prefer candidate-facing terms such as:
- Candidate
- Academic record
- Academic level
- Confirmed class
- Class arm
- Academic track
- SS1 placement
- Placement examination
- Examination eligibility
- Staff correction

Avoid prominent generic product terms such as "setup", "wizard", "path", "profile configuration", or "flow" when an academic term is available.

DESIGN PURPOSE
A student should immediately understand:
1. what academic record Festacol already holds;
2. whether they are verifying an existing record or establishing their initial class;
3. whether SS1 placement applies to them;
4. the consequence of choosing placement versus confirming a known class;
5. which decisions become staff-controlled after confirmation;
6. whether the confirmed outcome leads to the examination or back to the dashboard.

SEVEN DIRECTIONS
Create exactly seven concept screens that solve the same verified operation but are substantially different in hierarchy, interaction and spatial model. Across A–G include:
- registrar / academic-record verification;
- placement decision desk with explicit consequence comparison;
- restrained academic journey/progression;
- formal candidate dossier / record sheet;
- asymmetric school registration workstation;
- progressive-disclosure focus model;
- calm compact console / decision matrix.

Do not produce seven card-layout or color variants.

LOW-FIDELITY RULES
- Grayscale wireframe only.
- Exactly seven concepts A–G.
- Each concept occupies at least 100dvh.
- Document uses `scroll-snap-type: y mandatory`; every concept uses `scroll-snap-align: start`.
- Fixed unobtrusive A–G navigation.
- Show existing-enrollment and first-time-enrollment behavior in every concept where applicable.
- The SS1 qualifier fork must be visibly conditional, not permanently shown to every candidate.
- Make placement consent deliberate and consequential without fear-based copy.
- Show primary action, back/recovery action and error location.
- Include loading/unavailable states or clearly mark where they appear.
- Use representative labels only, no fake student data that suggests unsupported backend fields.
- Strong keyboard focus, semantic labels and approximately 44px interactive targets.
- Respect `prefers-reduced-motion`.
- No emojis as interface icons.

BRANCH SAFETY
The current PR already contains an unselected refactor of `student-wizard.tsx` and several later examination surfaces. Do not treat those visuals as the selected Phase 02 direction. Use the verified server behavior as the authoritative contract and create a fresh Phase 02 comparison board.

OUTPUT
Write the artifact to:
`docs/design/exam/phase-02-academic-eligibility-placement/brainstorm.html`

SELECTION GATE
Stop after the low-fidelity A–G board is generated and verified. Do not change Phase 02 production UI until the product owner selects A, B, C, D, E, F, G, or an explicit hybrid.
```

## Planned review checklist for the brainstorm

Before presenting A–G for selection, verify:

- all seven options are materially different;
- the same server-owned academic branches exist across the alternatives;
- existing enrollment is not presented as self-editable;
- placement is conditional on qualifier + no enrollment + SS1;
- known-class qualifier candidates are clearly routed away from placement;
- no unsupported academic data is shown;
- the options remain comparable one viewport at a time;
- reduced-motion and keyboard/focus intent are visible;
- no production `src/**`, Prisma or Supabase file is changed by the brainstorm step.