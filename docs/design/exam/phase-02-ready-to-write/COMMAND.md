# Phase 02 — Ready to Write brainstorm command

Status: executed for the redesigned low-fidelity A–G wireframe selection board
Prerequisite: Phase 01 remains the approved Admission Pass direction.
Governing plan: `docs/plans/2026-09-17-phase-02-ready-to-write.md`

## Product rule

Phase 02 combines academic information when needed, concise examination instructions, quiet device readiness and Start/Resume into one student-facing surface.

The candidate wants to write the examination. The design must hide internal preparation mechanics and make Start/Resume the obvious outcome.

## Design-system search command

```bash
python3 skills/ui-ux-pro-max/scripts/search.py \
  "secondary school examination wireframe unconventional layout editorial physical paper desk exam hall low friction ready to start" \
  --design-system \
  -p "Festacol Exam — Phase 02 Ready to Write Wireframe Studies"
```

The current artifact was authored from the repository contract plus the current `ui-ux-pro-max`, `product-designer`, `frontend-design`, and responsive-layout guidance. The search script itself was not executed locally because an executable skill checkout was not available.

## Generation brief

```text
/using-superpowers
/ui-ux-pro-max
/product-designer
/frontend-design

Design ONLY Phase 02: "Ready to Write" for Festacol's student examination journey.

The candidate has already completed Phase 01 identity. Do not create a multi-step preparation wizard.

PRIMARY USER GOAL
The student wants to understand the examination quickly and start writing.

DEFAULT HAPPY PATH
One surface contains:
- examination identity and only useful paper facts;
- three or fewer essential instructions;
- a quiet readiness signal;
- one dominant Start Examination / Resume Examination action.

CONDITIONAL ADAPTATION
Only reveal extra UI when the candidate must act:
- class information is genuinely missing;
- qualifier + no class + SS1 requires known-class vs placement choice;
- required camera permission is missing;
- connection is unavailable;
- the attempt is a resume;
- access is genuinely unavailable.

Do not turn these conditions into separate phases.

SERVER AUTHORITY TO PRESERVE
- `my_exam_access` remains examination-access authority;
- class/SS1 placement persistence remains server-owned;
- `allocate_my_exam_attempt` remains the Start/Resume attempt authority;
- opening the Ready to Write surface must not allocate an attempt;
- do not invent scores, recommendations, biometric checks, microphone requirements or new academic capabilities.

WIRE FRAME, NOT POLISHED UI
The output is a low-fidelity wireframe comparison board. Use grayscale, linework, type hierarchy, simple shapes, paper/desk/board metaphors and annotations.

Do NOT solve low fidelity by producing generic application layouts.

ANTI-GENERIC RULES
Do not use seven variations of:
- cards;
- dashboard grids;
- content-left/sidebar-right;
- stacked rounded containers;
- status-pill systems;
- centered hero + three cards + CTA;
- the same DOM composition with different decoration.

Every concept must be visually and spatially distinguishable even if all text labels are blurred.

Create seven territories:
A — Examination Threshold
B — Folded Examination Booklet
C — Candidate Desk Plan
D — Start Instrument
E — Invigilator Board
F — Academic Broadsheet
G — Projection Stage

Each option must use a different information architecture and spatial metaphor while preserving the same Ready to Write behavior.

LOW-FIDELITY REQUIREMENTS
- exactly seven A–G concepts;
- one concept per viewport, at least 100dvh;
- vertical `scroll-snap-type: y mandatory` and per-option `scroll-snap-align: start`;
- fixed A–G comparison navigation;
- keyboard-visible focus and approximately 44px interactive targets;
- responsive down to 360px;
- reduced-motion handling;
- no production React/Next.js implementation;
- no backend simulation;
- no preparation progress rail;
- no Next/Back sequence.

DESIGN INTENT FOR EACH OPTION
A / Threshold — make Start physically bridge the boundary between preparation and the paper.
B / Booklet — use a real two-page exam-booklet grammar and perforated Start strip.
C / Desk — use overlapping physical exam sheet/candidate slip/readiness stamp/start tab.
D / Instrument — make Start the center and paper/readiness facts orbit it.
E / Invigilator Board — use an exam-hall board with pinned notices rather than app panels.
F / Broadsheet — use strong editorial masthead/column hierarchy and a press-bar Start action.
G / Stage — present the examination as the event; system checks live in the wings and appear only when needed.

SELECTION GATE
Stop after redesigning the A–G wireframe board. Production Phase 02 remains untouched until the product owner selects a direction or explicit hybrid.
```

## Review checklist

- exactly seven concepts A–G;
- all seven have genuinely different spatial grammars;
- no repeated generic card/dashboard skeleton;
- wireframe treatment remains grayscale and low fidelity;
- every concept keeps Start Examination as the main action;
- academic/device exceptions adapt the same surface;
- no preparation wizard or progress rail;
- responsive/focus/reduced-motion intent remains visible;
- no unsupported backend capability is implied;
- no production `src/**`, Prisma or Supabase file is changed.
