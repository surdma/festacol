# Festacol Admin UI/UX Governance and Depth Contract

**Date:** 2026-09-12  
**Status:** Binding revision — awaiting product-owner approval  
**Applies to:** `prototype/admin.html`, `prototype/js/admin.js`, and every teacher-facing admin workflow  
**Extends:** `docs/superpowers/specs/2026-09-12-admin-experience-revamp-design.md`

## 1. Authority and purpose

This document is a binding extension of the main admin experience revamp specification. Where this document is more specific about UI/UX process, interaction architecture, visual depth, overlays, nested screens, or admin redesign quality, this document controls.

The administration surface is **not** a cleanup, restyle, component swap, or incremental polish of the existing admin page. It is a **complete UI/UX revamp** of the teacher-facing experience while preserving the verified academic/domain behavior described in the main specification.

The redesign must feel deliberately designed for examination administration: clear hierarchy, strong information architecture, high-quality interaction states, predictable navigation, meaningful visual depth, responsive behavior, and accessible control semantics.

A technically correct admin implementation that preserves old layout weaknesses, shallow interaction design, generic cards, inconsistent spacing, weak modal behavior, or ad-hoc overlays does **not** satisfy this contract.

---

## 2. Mandatory Superpowers and UI/UX skill governance

Every meaningful UI decision must be made under the current RelvorLabs engineering bootstrap and current agent-controller skills. UI implementation must never begin from memory or from generic aesthetic preference alone.

### 2.1 Mandatory decision path

For every admin screen, nested screen, major component, modal, popover, form flow, chart, table, stepper, responsive behavior, or interaction-state decision, use this path:

1. **Engineering Lead** refreshes and applies `skills/using-superpowers`.
2. **UI/UX Product Engineer** owns the interaction contract before substantial frontend implementation.
3. The UI/UX Product Engineer loads and applies the current agent-controller skills:
   - `skills/ui-ux-pro-max`;
   - `skills/product-designer`;
   - `skills/frontend-design`;
   - `skills/tailwindcss`.
4. **Frontend Engineer** implements the approved interaction contract and loads the relevant current UI skills again, especially `ui-ux-pro-max` and `tailwindcss`.
5. Flowbite documentation and Flowbite Icons are checked for any standard component before custom behavior is introduced.
6. Browser Dogfood independently validates the finished interaction at mobile, tablet, and desktop sizes.

`shadcn` components are **not** part of this prototype stack. The UI/UX persona requirement to use shadcn “where relevant” does not override this project’s explicit Flowbite-only component contract. Do not add shadcn or a second component system.

### 2.2 No ad-hoc UI decisions

Before a screen or interaction is implemented, the owning UI/UX pass must explicitly resolve:

- user goal and primary task;
- information hierarchy;
- primary, secondary, tertiary, and destructive actions;
- Flowbite component choice;
- page versus nested page versus modal versus popover decision;
- empty, loading, success, warning, error, locked, disabled, and destructive states;
- responsive behavior at mobile/tablet/desktop widths;
- keyboard/focus/accessibility behavior;
- visual depth/elevation role;
- animation/motion purpose;
- URL/query-state behavior and Back/Forward behavior where navigation is meaningful;
- data relationship or domain contract required by the UI;
- exact acceptance evidence for Dogfood.

A component must not be created simply because it is easy to render. Every visible control must have a defined purpose, state model, and real effect.

---

## 3. Complete admin redesign requirement

The entire admin surface must be visually and interactionally rebuilt. Existing repository behavior is preserved; existing visual composition is not sacred.

The redesign must cover all eight top-level admin areas:

1. Overview
2. Students
3. Staff
4. Examinations
5. Classes
6. Question Bank
7. Reports
8. Settings

For each area, redesign:

- page header and context;
- navigation and breadcrumbs where useful;
- page-level primary action;
- summary/metric presentation;
- filters/search controls;
- table/list/card presentation;
- nested record views;
- modal and confirmation behavior;
- empty/loading/error states;
- action feedback;
- responsive behavior;
- keyboard/focus path;
- mobile touch affordances;
- visual density and whitespace.

Do not preserve an old screen merely because the same data can still be displayed. The purpose is to improve how teachers understand and operate the system.

---

## 4. Visual direction and depth system

The product direction remains neutral black/white with restrained semantic status color. Depth must come from hierarchy, spacing, border treatment, controlled shadow, overlay behavior, and purposeful blur — not from arbitrary gradients or decorative effects.

### 4.1 Depth levels

Use one consistent elevation model:

- **Level 0 — page canvas:** neutral application background and main content flow.
- **Level 1 — base surfaces:** cards, tables, grouped form regions, metric strips; subtle border, minimal or no shadow.
- **Level 2 — raised interactive surfaces:** menus, compact dropdowns, contextual controls; stronger edge separation and restrained shadow.
- **Level 3 — popovers/floating panels:** anchored above page content with clear trigger relationship and visible separation.
- **Level 4 — modal layer:** centered/bounded Flowbite modal above a dimmed + blurred backdrop.
- **Level 5 — transient system feedback:** toast/critical notification layer above other content when necessary.

Recommended z-index discipline should remain predictable, for example page content < sticky navigation < dropdown/popover < backdrop < modal < toast. Do not create arbitrary one-off z-index values that compete unpredictably.

### 4.2 Blur policy

Backdrop blur is a functional dismissal/depth cue, not decoration.

- Use blur for modal backdrops.
- Do not blur normal cards or large page regions merely to create visual interest.
- Popovers should normally use opaque/near-opaque surfaces with shadow/border, not a full-screen blur layer.

### 4.3 Shadow policy

Use a small consistent shadow scale. Avoid multiple unrelated heavy shadows. A surface should look elevated only when it behaves elevated.

---

## 5. Interaction primitive decision rules

Use the following product rules before choosing a component.

| User need | Required pattern |
| --- | --- |
| Major destination or workflow | Full page / nested page state |
| Record details with substantial content | Nested page or large modal depending on context |
| Create/edit form that should preserve parent context | Flowbite Modal |
| Destructive confirmation | Compact confirmation Modal |
| Multi-stage exam creation | Flowbite Stepper in a dedicated builder screen/modal composition |
| Short contextual explanation | Popover or Tooltip |
| Notifications list from bell | Anchored Popover/Dropdown |
| Contextual action menu | Dropdown |
| Persistent page-level warning/error | Inline Alert |
| Transient success/failure feedback | Toast |
| Field validation | Inline field error/helper text |
| Search/filter state | Page control, query-backed where meaningful |
| Mobile detail navigation | Nested page/modal, never a hidden side drawer |

### 5.1 “Popup” terminology

For this prototype, “popup” means a controlled in-page floating UI such as a Flowbite Popover, Dropdown, or Modal. Do not open browser popup windows.

### 5.2 No side drawers

Do not reintroduce detail drawers, right-side sheets, or off-canvas record editors as substitutes for good nested navigation or modal design.

---

## 6. Nested page and URL-state architecture

The admin must support deep, navigable nested screens instead of flattening every workflow into one page.

### 6.1 Navigation layers

The intended hierarchy is:

1. **Top-level route** — `page=`
2. **Entity or report context** — `student=`, `staff=`, `exam=`, `class=`, `question=`, `attempt=`, `view=`
3. **Nested section/tab** — `tab=`
4. **Overlay state** — `modal=`
5. **Overlay substate / builder stage** — `step=` or another explicitly normalized overlay substate key

Examples:

```text
admin.html?page=students&student=ST-2401&tab=exams
admin.html?page=exams&exam=ABC123&tab=results
admin.html?page=exams&exam=ABC123&tab=results&modal=attempt&attempt=ATTEMPT_HASH
admin.html?page=questions&level=SS2&pathway=Science&modal=edit-question&question=204
admin.html?page=exams&modal=create-exam&step=3
```

### 6.2 Back/Forward contract

- Opening a meaningful nested screen changes URL state.
- Opening a meaningful modal pushes overlay state.
- Closing a modal removes only modal-specific state and restores the exact parent screen/filter/tab.
- Browser Back closes the current overlay or returns to the previous nested screen before abandoning the top-level page.
- Browser Forward restores it.
- Invalid deep-link IDs return to the nearest valid parent with a visible non-blocking alert/toast.

### 6.3 Nested modal navigation

Large modals may contain internal sections or steps when preserving parent context is valuable, but avoid stacking modal on modal.

If a subflow becomes too deep for one modal, either:

- replace the modal’s internal view while preserving a visible Back control and URL substate; or
- navigate to a proper nested page.

Never create multiple simultaneously stacked record modals as the normal navigation model.

---

## 7. Modal quality contract

Every admin modal must be deliberately designed rather than treated as a generic white box.

### 7.1 Backdrop

Use a Flowbite dynamic backdrop with classes equivalent to:

```text
fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm
```

The background must remain recognizable but clearly de-emphasized.

### 7.2 Modal anatomy

A substantial modal should have:

- clear title and context;
- optional eyebrow/breadcrumb/back control when nested;
- close button with accessible name;
- concise supporting text only when useful;
- structured sections rather than an undifferentiated form dump;
- visible validation close to fields;
- scrollable content region when required;
- sticky or visually stable footer actions for long forms;
- one visually dominant primary action;
- secondary/cancel action;
- destructive action visually separated from normal save actions.

### 7.3 Size policy

- **Small:** confirmation and narrow actions.
- **Medium:** simple forms and focused record edits.
- **Large:** exam edit, question edit, attempt detail, complex record workflows.
- On mobile, modals may use near-full-width / near-full-height bounded layouts, but still behave as centered/bounded overlays rather than side drawers.

### 7.4 Focus and dismissal

- focus enters the modal predictably;
- focus remains trapped while modal is active;
- Escape closes dismissible modals;
- backdrop click closes only when safe;
- destructive/critical flows may require explicit cancellation;
- focus returns to the originating control when the modal closes.

---

## 8. Popover, dropdown, alert, toast, and tooltip contract

### 8.1 Popovers

Use for contextual information/actions that belong to a trigger. They must be anchored, bounded, and spatially connected to the trigger.

Examples:

- notification center;
- quick student/class context;
- explanation of an integrity score;
- compact filter help;
- short distribution information.

### 8.2 Dropdowns

Use for compact action or selection menus. Do not hide critical primary actions inside dropdowns.

### 8.3 Alerts

Use inline Flowbite Alert patterns for persistent or contextual information that must remain visible until the user resolves or dismisses it, such as:

- insufficient eligible questions;
- occupied class cannot be deleted;
- structural examination fields are locked;
- failed deep-link lookup;
- destructive data-reset scope.

### 8.4 Toasts

Use to acknowledge short-lived outcomes:

- copied examination address;
- saved question;
- student moved successfully;
- exam reopened/closed;
- recoverable action failure.

Toasts must not be the only place a persistent validation/error condition is explained.

### 8.5 Tooltips

Use for compact clarification of icon-only controls, unfamiliar metrics, or short definitions. Tooltips are not a replacement for visible labels on important form controls.

---

## 9. High-quality Stepper and multi-stage flows

The examination builder is a flagship interaction and must demonstrate the new UI quality.

Use Flowbite Stepper patterns with:

- visible current stage;
- completed-stage check state;
- concise stage labels;
- progress that remains understandable on mobile;
- Back and Continue actions in a stable footer;
- inline validation before advancing;
- preservation of entered values when navigating backward;
- clear branch behavior for Entrance Exam versus Class Assessment versus External Practice;
- summary review before publish;
- contextual warning/alert when inventory or fairness constraints block progress;
- reduced-motion-safe transitions;
- direct transition to the distribution state after publish.

The stepper must not be a row of decorative circles disconnected from real form state.

---

## 10. Admin screen-depth map

Each top-level area must have meaningful nested depth rather than a single flat table.

### 10.1 Overview

Required composition:

- operational page header;
- real metric strip;
- attention queue;
- active/recent examinations;
- placement capacity attention;
- integrity exceptions;
- recent submissions/results;
- at most a small number of useful charts;
- quick actions that route to the real destination/builder.

No generic dashboard-card wall.

### 10.2 Students

Depth:

```text
Students directory
→ student profile
  → Overview
  → Class & pathway
  → Examinations
    → exact attempt
      → score / subject stats
      → integrity timeline
      → rewrite/archive relationship
  → Placement
  → Merit / performance context
```

Use a nested page profile plus focused modals for edit/status/attempt detail where appropriate.

### 10.3 Staff

Depth:

```text
Staff directory
→ staff record
  → profile/role/status
  → edit/status modal
```

Do not inherit student academic tabs.

### 10.4 Examinations

Depth:

```text
Examinations directory
→ examination detail
  → Distribute
  → Control
  → Candidates
    → candidate attempt
  → Results & Analytics
    → merit
    → integrity exceptions
→ Create examination builder
→ Edit examination
```

The detail experience should feel like an examination operations console, not a raw record dump.

### 10.5 Classes

Depth:

```text
Classes by SS level/pathway
→ class detail
  → capacity/occupancy
  → current students
  → WhatsApp group + QR
  → performance report
  → edit/delete controls
```

### 10.6 Question Bank

Depth:

```text
Question Bank
→ filtered inventory
→ question detail
  → reveal answer
  → compatibility preview
  → edit question
→ create question
```

The editor must be type-aware and visually structured by question type.

### 10.7 Reports

Depth:

```text
Reports overview
→ class
→ pathway
→ exam
→ student
→ merit
→ placement
→ integrity
  → source student/exam/attempt
```

Charts and summary metrics must always permit source-record drill-down.

### 10.8 Settings

Depth:

- prototype state/data management;
- local academic data controls;
- granular reset actions;
- explicit destructive confirmation with scope explanation.

Settings must not become a dumping ground for normal academic workflows.

---

## 11. Responsive behavior

The redesign must be intentionally designed at, at minimum:

- 390×844 mobile;
- 820×1000 tablet;
- 1440×1000 desktop.

Rules:

- no page-level horizontal overflow;
- primary actions remain reachable without precision tapping;
- important touch targets are approximately 44×44px or larger;
- wide tables transform to responsive cards or controlled scroll only where genuinely necessary;
- nested detail pages prioritize core information before secondary analytics on mobile;
- popovers stay within viewport bounds;
- modals remain bounded and usable without content escaping the viewport;
- sticky action bars must not cover content;
- navigation must remain clear at all widths.

---

## 12. Accessibility and interaction-state requirements

Every redesigned screen must include:

- visible focus states;
- keyboard-operable controls;
- labels bound to inputs;
- sequential heading hierarchy;
- accessible names for icon-only buttons;
- semantic radio/checkbox controls rather than click-only imitation;
- sufficient foreground/background contrast;
- errors near the relevant field/action;
- non-color status indicators;
- Escape/back route from overlays and multi-stage flows;
- `prefers-reduced-motion` respect;
- readable text and touch-friendly mobile density.

The UI/UX pass must challenge any visually attractive choice that harms these requirements.

---

## 13. Motion and feedback

Motion must communicate causality and hierarchy.

Use short, restrained transitions, generally in the 150–300ms range where motion adds clarity. Favor transform/opacity transitions and avoid decorative animation that delays task completion.

Examples of useful motion:

- page content entering after route transition;
- modal/popover entrance/exit;
- stepper stage transition;
- row/card expansion where used;
- toast feedback.

All nonessential motion must disable under reduced-motion preferences.

---

## 14. UI/UX acceptance gate

The admin revamp is not acceptable until all of the following are proven:

1. Current `using-superpowers` and relevant UI skills were loaded for the implementation session.
2. UI/UX Product Engineer defined the interaction contract before substantial Frontend implementation.
3. `ui-ux-pro-max`, `product-designer`, `frontend-design`, and `tailwindcss` requirements informed the resulting decisions.
4. Flowbite components are used for standard controls instead of ad-hoc reimplementations.
5. Flowbite Icons are used consistently; no guessed SVGs or emoji UI icons remain.
6. All eight admin top-level routes have been visibly redesigned, not merely restyled.
7. Nested pages/screens expose meaningful record depth and source relationships.
8. Modal design includes correct blurred backdrop, focus behavior, bounded responsive layout, and stable actions.
9. Popovers/dropdowns are anchored to triggers and do not masquerade as centered modals.
10. Inline alerts, toasts, field errors, tooltips, and destructive confirmations are used for their correct semantic purpose.
11. The examination builder uses a polished, stateful Stepper with real validation and Back/Forward behavior.
12. Browser Back/Forward restores meaningful nested page, tab, modal, and builder state.
13. Mobile, tablet, and desktop layouts pass Dogfood without page-level overflow or unusable overlays.
14. Independent review finds no blocking accessibility, hierarchy, interaction, or Flowbite-policy regression.
15. The final admin feels like a complete examination-management product rather than the old UI with new classes.

Production implementation remains blocked until the product owner approves the complete revised planning set.