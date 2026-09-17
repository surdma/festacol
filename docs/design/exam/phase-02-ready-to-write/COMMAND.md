# Phase 02 — Ready to Write brainstorm command

Status: executed for the low-fidelity A–G selection board
Prerequisite: Phase 01 remains the approved Admission Pass direction.
Governing plan: `docs/plans/2026-09-17-phase-02-ready-to-write.md`

## Product rule

Phase 02 combines what was previously treated as three separate phases:

- academic eligibility / placement when needed;
- examination briefing / instructions;
- device readiness / Start or Resume.

The candidate should experience these as **one calm pre-examination surface**, not a sequence of screens.

## Design-system search command

```bash
python3 skills/ui-ux-pro-max/scripts/search.py \
  "secondary school computer based examination ready to start single screen briefing simple candidate low friction academic exam" \
  --design-system \
  -p "Festacol Exam — Phase 02 Ready to Write"
```

The low-fidelity artifact in this branch was authored from the current repository contract and the current `ui-ux-pro-max`, `product-designer`, and `frontend-design` guidance. This environment does not expose the skill repository as an executable local checkout, so the search script itself was **not run** and must not be reported as executed.

## Generation brief

```text
/using-superpowers
/ui-ux-pro-max
/product-designer
/frontend-design

Design ONLY Phase 02: "Ready to Write" for Festacol's student examination journey.

The candidate has already passed Phase 01 identity. Do not create a multi-step preparation wizard.

PRODUCT INTENT
The student wants to write the examination. Hide internal complexity. The default happy path is one surface with:
- the examination they are about to write;
- only the essential instructions;
- quiet readiness confirmation;
- one dominant Start Examination / Resume Examination action.

ACADEMIC INFORMATION
- If the candidate's academic record is already sufficient, do not ask for it again.
- If class information is missing, reveal only the minimum class question inside the same Phase 02 experience.
- For qualifier + no class + SS1 only, allow the existing choice between known class and needing placement.
- Do not show placement controls to everyone.
- A genuine access denial should be explained directly rather than disguised as onboarding.

INSTRUCTIONS
Do not build a separate instructions screen. Keep the essential rules on the same surface. Long school-authored instructions may be progressively disclosed.

DEVICE READINESS
Check requirements automatically. When healthy, use a small calm confirmation. Do not show a technical capability table. Expand only the failed requirement. Camera controls appear only when the examination requires a camera. Do not mention microphone access.

START
The Start / Resume action is the dominant CTA. Opening this surface must not imply an attempt has already started.

DO NOT USE STUDENT-FACING JARGON
Avoid: onboarding, eligibility processing, preflight, checkpoint, configuration, system validation, capability detection, academic workflow, step 1/2/3/4.

USE SIMPLE EXAM LANGUAGE
Prefer: Ready to write, Your examination, Your class, Important instructions, Device ready, Camera required, Start Examination, Resume Examination, Need help?

VERIFIED DATA AVAILABLE AFTER AUTHENTICATION
The existing experience can provide:
- examination title, mode, duration, question count, instructions, start/end window and configured integrity policy;
- candidate name, class label and student number where present;
- subject names;
- allowed/used attempts and active attempt id;
- camera-required state;
- online/camera/fullscreen client capability state;
- academic levels/classes/enrollment only when academic information must be completed.

SERVER AUTHORITY TO PRESERVE
- `my_exam_access` remains examination-access authority;
- class/SS1 placement writes remain server-owned;
- `allocate_my_exam_attempt` remains the start/resume attempt authority;
- no design may invent scores, recommendations, biometric checks, microphone requirements, or new academic capabilities.

OUTPUT
Create exactly seven materially different low-fidelity full-screen concepts A–G in:
`docs/design/exam/phase-02-ready-to-write/brainstorm.html`

Each concept is a SINGLE pre-exam surface, not several screens hidden inside one option.

Explore these territories:
A — Exam Cover Sheet
B — Start Desk
C — One Focus
D — Readiness Ribbon
E — Candidate Brief
F — Adaptive Decision Surface
G — Quiet Start Console

LOW-FIDELITY REQUIREMENTS
- grayscale / wireframe semantics;
- one concept per viewport, at least 100dvh;
- vertical `scroll-snap-type: y mandatory` and per-option `scroll-snap-align: start`;
- fixed A–G comparison navigation;
- keyboard-visible focus and ~44px interactive targets;
- responsive down to 360px;
- `prefers-reduced-motion` respected;
- no production React/Next.js implementation;
- no fake backend data or server simulation;
- no preparation progress rail;
- no Next/Back sequence between overview, instructions, readiness and start.

SHOW ADAPTATION, NOT FRICTION
Across the seven options, annotate or demonstrate where the same surface adapts for:
- missing class information;
- SS1 placement choice;
- required camera permission;
- offline/blocking state;
- resuming an existing attempt.

SELECTION GATE
Stop after the A–G board. Production Phase 02 remains untouched until the product owner selects a direction or explicit hybrid.
```

## Review checklist

- exactly seven concepts A–G;
- every concept is one pre-examination surface;
- no preparation stepper or four-screen sequence;
- Start/Resume is the primary action;
- academic input is conditional rather than permanent;
- instructions are concise and on-surface;
- healthy device checks are visually quiet;
- camera appears only as a conditional requirement;
- blockers are actionable in plain language;
- no unsupported academic or proctoring claims;
- no production `src/**`, Prisma or Supabase file is changed by this brainstorm step.
