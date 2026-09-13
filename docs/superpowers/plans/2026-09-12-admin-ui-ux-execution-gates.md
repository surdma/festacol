# Festacol Admin UI/UX Revamp Execution Gates

**Date:** 2026-09-12  
**Status:** Binding plan extension — awaiting product-owner approval  
**Extends:** `docs/superpowers/plans/2026-09-12-admin-experience-revamp.md`  
**Design contract:** `docs/superpowers/specs/2026-09-12-admin-ui-ux-governance-and-depth-contract.md`

## Purpose

This execution addendum closes a planning gap in the main implementation plan: the admin work must not be treated as implementation-first frontend cleanup. The admin surface requires a complete UI/UX redesign, and every meaningful UI decision must pass through the current RelvorLabs Superpowers/UI skill workflow before Frontend implementation.

This addendum is mandatory for Tasks 6–13 of the main implementation plan. If this addendum conflicts with a less-specific UI instruction in the main plan, this addendum controls.

---

## Gate 0 — Mandatory UI/UX skill bootstrap before any admin UI mutation

Before editing `prototype/admin.html` or UI-rendering sections of `prototype/js/admin.js`:

- [ ] Refresh the current Engineering Lead and HANDOFF protocol.
- [ ] Refresh and apply `skills/using-superpowers`.
- [ ] Route the admin redesign to the current UI/UX Product Engineer before Frontend implementation.
- [ ] UI/UX Product Engineer loads current:
  - [ ] `skills/ui-ux-pro-max`
  - [ ] `skills/product-designer`
  - [ ] `skills/frontend-design`
  - [ ] `skills/tailwindcss`
- [ ] Frontend Engineer refreshes the relevant current UI skills again when implementation starts.
- [ ] Confirm the project stack remains Tailwind CSS v4 + Flowbite 4.0.1 + Flowbite Icons. Do not introduce shadcn or a second component system.
- [ ] Reinspect the actual current admin page, current component usage, current interactions, and existing responsive behavior before redesigning.

**Blocking rule:** if the relevant UI skills were not loaded in the current implementation session, admin UI work is not COMMIT READY.

---

## Gate 1 — Screen-by-screen interaction contract before code

For each top-level admin route, produce a short interaction contract before implementing the screen:

```text
Screen:
Primary user goal:
Primary action:
Secondary actions:
Information hierarchy:
Nested screens/tabs:
Modal flows:
Popover/dropdown flows:
Alerts/toasts/errors:
Loading/empty/locked states:
Responsive transformation:
Keyboard/focus behavior:
URL/query state:
Flowbite primitives:
Flowbite Icons required:
Dogfood acceptance path:
```

Required routes:

- [ ] Overview
- [ ] Students
- [ ] Staff
- [ ] Examinations
- [ ] Classes
- [ ] Question Bank
- [ ] Reports
- [ ] Settings

No route may be considered redesigned simply because its colors, card radius, or spacing changed.

---

## Gate 2 — Establish the admin visual hierarchy and depth system

Before page-level implementation:

- [ ] Establish one consistent page canvas/background treatment.
- [ ] Establish Level 1 base surfaces for cards/tables/forms.
- [ ] Establish Level 2 raised interactive surfaces.
- [ ] Establish Level 3 anchored popover/dropdown surfaces.
- [ ] Establish Level 4 modal/backdrop treatment.
- [ ] Establish Level 5 transient toast/system feedback treatment.
- [ ] Establish a predictable z-index order.
- [ ] Keep blur functional: modal backdrops only unless a justified exception is documented.
- [ ] Keep shadows restrained and tied to elevation, not decoration.
- [ ] Keep black/white/neutral as the dominant visual language with semantic status color only.
- [ ] Preserve the supplied admin head/style contract and no-local-CSS rule.

Acceptance: a reviewer should be able to identify page, raised, floating, modal, and toast layers consistently without reading implementation code.

---

## Gate 3 — Rebuild the admin shell, not just the content cards

This extends Main Plan Task 6.

- [ ] Redesign desktop navigation hierarchy and active-state clarity.
- [ ] Redesign mobile navigation so all eight routes remain obvious and usable.
- [ ] Add page headers with clear context, title, supporting information only where useful, and one dominant primary action.
- [ ] Use breadcrumbs/back affordances for deep nested screens where they improve orientation.
- [ ] Preserve query-addressable navigation and legacy `page=users` normalization.
- [ ] Add high-quality page-transition feedback without decorative motion overload.
- [ ] Design notification bell + anchored popover as one coherent interaction.
- [ ] Verify shell spacing, maximum widths, density, sticky elements, overflow, and z-index behavior at 390×844, 820×1000, and 1440×1000.

**Do not** copy the existing shell and only replace colors/icons.

---

## Gate 4 — Nested page/screen navigation must be deliberate

Meaningful record depth must use query-backed nested state.

Canonical navigation layers:

```text
page=         top-level area
student=      student record
staff=        staff record
exam=         examination record
class=        class record
question=     question record
attempt=      exact attempt record
view=         report context
tab=          nested subsection
modal=        overlay state
step=         builder/overlay progression
```

Implementation requirements:

- [ ] One normalized parser owns these states.
- [ ] One URL builder owns navigation changes.
- [ ] Opening a meaningful nested record changes URL state.
- [ ] Opening a meaningful modal pushes overlay state.
- [ ] Closing a modal preserves parent page/filter/tab state.
- [ ] Browser Back closes overlay/returns through nested depth in a predictable order.
- [ ] Browser Forward restores the same state.
- [ ] Invalid deep-link IDs return to the nearest valid parent with visible feedback.
- [ ] Do not stack modal-on-modal as the standard flow.
- [ ] If a modal subflow becomes deep, replace the modal’s internal view with a visible Back control or move to a nested page.

---

## Gate 5 — Modal, backdrop, and internal modal navigation quality

This extends Main Plan Tasks 6–10.

Every modal implementation must pass all of these:

- [ ] Use Flowbite Modal structure/API.
- [ ] Use dim + blur backdrop equivalent to `bg-gray-900/50 ... backdrop-blur-sm`.
- [ ] Use responsive bounded width/height.
- [ ] Keep content inside viewport bounds.
- [ ] Use internal scrolling only where required.
- [ ] Use clear title/context and close control.
- [ ] Use visible validation near affected fields.
- [ ] Use stable footer actions for long/complex flows.
- [ ] Use one dominant primary action.
- [ ] Visually separate destructive actions.
- [ ] Trap focus appropriately.
- [ ] Support Escape when dismissible.
- [ ] Restore focus to trigger on close.
- [ ] Keep URL state synchronized for deep modals.
- [ ] Support a visible Back affordance when the modal has internal navigable subviews.

Modal sizing must match task complexity rather than using one width for everything.

---

## Gate 6 — Popover, popup, alert, toast, dropdown, and tooltip semantics

Do not use one overlay component for every kind of feedback.

- [ ] **Popover:** anchored contextual content/help/notification panel.
- [ ] **Dropdown:** compact action/selection menu.
- [ ] **Alert:** persistent contextual warning/error/status within a page or modal.
- [ ] **Toast:** transient acknowledgement of an action outcome.
- [ ] **Tooltip:** small clarification, especially for icon-only controls/unfamiliar metrics.
- [ ] **Confirmation modal:** destructive or consequential confirmation.

The term “popup” means one of these in-page Flowbite primitives; do not open browser popup windows.

Required use examples:

- occupied-class deletion blocked → inline Alert;
- copy exam address success → Toast;
- notification bell → Popover/Dropdown;
- integrity-score explanation → Popover/Tooltip;
- delete/reset confirmation → Modal;
- locked examination field → inline explanatory Alert/help text, not disabled control alone.

---

## Gate 7 — Examination builder is a flagship Stepper experience

This strengthens Main Plan Task 9.

Before implementation, UI/UX Product Engineer must define the five-stage interaction and responsive behavior.

Implementation requirements:

- [ ] Flowbite Stepper, not a custom decorative progress row.
- [ ] Real active/completed/error states.
- [ ] Accessible stage labels.
- [ ] Circular completion/check indicators.
- [ ] Stable Back/Continue footer controls.
- [ ] Progressive disclosure of fields.
- [ ] Values preserved when moving backward.
- [ ] Inline validation before advancing.
- [ ] Inventory count visible before question-count selection.
- [ ] Blocking Alert when eligible inventory is insufficient.
- [ ] Purpose-specific branching without exposing internal `qualifier` terminology.
- [ ] Review stage summarizes exactly what will be published.
- [ ] Publish transitions directly to the distribution experience.
- [ ] Mobile Stepper remains understandable without horizontal overflow.
- [ ] Reduced-motion behavior remains functional.

Dogfood must complete both a normal Class Assessment and an SS1 Entrance & Placement Exam from start to distribution.

---

## Gate 8 — Route-specific complete redesign requirements

### Overview

- [ ] Operational dashboard composition, not a generic card wall.
- [ ] Real metric strip.
- [ ] Attention queue.
- [ ] Active/recent exams.
- [ ] Integrity and placement-capacity attention.
- [ ] Recent results/submissions.
- [ ] Small number of meaningful charts only.
- [ ] Quick actions route to real destinations.

### Students

- [ ] High-quality searchable/filterable directory.
- [ ] Nested student profile.
- [ ] Profile tabs/sections for class, exams, performance, placement, integrity, rewrite/merit context.
- [ ] Exact attempt modal/deep screen.
- [ ] Edit/move/suspend actions use correct modal/alert/toast patterns.

### Staff

- [ ] Separate directory and record treatment.
- [ ] No student academic metrics.
- [ ] Add/edit/status interactions redesigned coherently.

### Examinations

- [ ] Directory is redesigned for operational scanning.
- [ ] Examination detail feels like an operations console.
- [ ] Distribute, Control, Candidates, Results & Analytics are visually distinct nested sections.
- [ ] Exam edit is structured into coherent sections rather than a long form dump.
- [ ] Candidate/attempt detail uses exact source relationships.
- [ ] Copy/share/QR/Exam ID distribution is polished and immediately understandable.

### Classes

- [ ] SS level/pathway grouping is visually clear.
- [ ] Capacity/occupancy/remaining slots are prominent.
- [ ] Student list and WhatsApp group/QR are nested coherently.
- [ ] Safe deletion feedback is explicit.

### Question Bank

- [ ] Inventory/filter experience handles 500+ records without feeling crowded.
- [ ] Detail view hides answer by default.
- [ ] Reveal Answer is explicit.
- [ ] Type-aware editor visually adapts to response type.
- [ ] Compatibility preview is visible before save.
- [ ] Seed override/custom/reset states are obvious.

### Reports

- [ ] Report overview is not just chart tiles.
- [ ] Class/pathway/exam/student/merit/placement/integrity views have clear scope context.
- [ ] Every chart has numerical/table context.
- [ ] Every analytical record can drill to its source student/exam/attempt where applicable.

### Settings

- [ ] Data-management groups are clearly separated.
- [ ] Destructive scope is explained before confirmation.
- [ ] Settings does not absorb normal academic workflows.

---

## Gate 9 — Responsive and accessibility review before implementation handoff

For every redesigned route and major overlay, verify:

- [ ] 390×844 mobile.
- [ ] 820×1000 tablet.
- [ ] 1440×1000 desktop.
- [ ] No page-level horizontal overflow.
- [ ] Touch targets approximately 44×44px or larger for important controls.
- [ ] Visible focus styles.
- [ ] Keyboard order matches visual order.
- [ ] Icon-only buttons have accessible names.
- [ ] Labels are visible and associated with inputs.
- [ ] Errors appear near fields/actions.
- [ ] Status is not color-only.
- [ ] Modals/popovers stay within viewport.
- [ ] Reduced-motion preference is respected.
- [ ] Tables transform to usable mobile presentation where needed.

A screen failing these checks returns to UI/UX/Frontend ownership before Reviewer/Dogfood handoff.

---

## Gate 10 — Independent UI/UX review

This strengthens Main Plan Task 13.

Independent Code Reviewer must explicitly challenge:

- [ ] whether all eight routes are genuinely redesigned;
- [ ] whether information hierarchy is clear;
- [ ] whether any generic component was rebuilt instead of using Flowbite;
- [ ] whether icons are verified Flowbite Icons;
- [ ] whether page/modal/popover/alert/toast semantics are correct;
- [ ] whether depth/elevation is consistent;
- [ ] whether modal backdrop blur is present and purposeful;
- [ ] whether nested navigation/Back/Forward works;
- [ ] whether any side drawer slipped back in;
- [ ] whether stepper flows preserve state and validation;
- [ ] whether responsive and keyboard/focus behavior is credible;
- [ ] whether old visual weaknesses were merely reskinned.

Blocking UI/UX findings must route back to UI/UX Product Engineer or Frontend Engineer, not be accepted as polish debt.

---

## Gate 11 — Browser Dogfood must judge UX quality, not only function

Integration/Dogfood must test the real admin as a teacher/admin user and capture reproducible evidence for blocking issues.

In addition to functional journeys from the main plan, Dogfood must verify:

- [ ] visual hierarchy is understandable on first use;
- [ ] primary action is obvious on each route;
- [ ] deep screens preserve orientation;
- [ ] modal backdrop blur/dim works and content remains bounded;
- [ ] popovers are correctly anchored;
- [ ] alerts/toasts appear in the correct context;
- [ ] mobile overlays do not cover essential navigation/actions;
- [ ] Stepper progression feels coherent and recoverable;
- [ ] tables/card transformations remain readable;
- [ ] Back/Forward restores expected nested state;
- [ ] no control appears clickable without working behavior;
- [ ] no interaction relies on hover only;
- [ ] no horizontal overflow or clipped critical content exists.

A functional but low-quality interaction can fail Dogfood.

---

## Final UI/UX COMMIT READY gate

The implementation may not be handed to Git/Release as COMMIT READY until evidence proves:

- [ ] current UI skills were loaded and applied;
- [ ] UI/UX Product Engineer interaction contracts exist for all redesigned routes;
- [ ] Frontend implementation matches those contracts;
- [ ] complete admin UI revamp is visible across all routes;
- [ ] modal/backdrop/depth system is consistent;
- [ ] nested page and modal navigation works with query state;
- [ ] popover/popup/alert/toast/dropdown/tooltip patterns are semantically correct;
- [ ] examination Stepper is polished and stateful;
- [ ] responsive/a11y checks pass;
- [ ] independent review has no blocking UI/UX findings;
- [ ] Dogfood passes the real teacher/admin journeys at mobile, tablet, and desktop sizes.

This plan extension does not authorize production implementation. Implementation remains blocked until the product owner approves the revised planning set.