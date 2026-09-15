# Festacol Entry-Shell Inheritance and Tailwind-Only Routing Execution Plan

**Date:** 2026-09-12  
**Status:** Planning only — awaiting product-owner approval  
**Applies to:** the Festacol prototype revamp implementation plan and UI/UX execution gates

## 1. Purpose and precedence

This plan operationalizes the binding `2026-09-12-single-shell-tailwind-routing-contract.md` without authorizing production implementation.

It corrects the earlier over-aggressive “single HTML file” interpretation. The target keeps four HTML files with distinct roles:

- `prototype/index.html` — canonical application entry point and real shared shell;
- `prototype/admin.html` — thin Admin route alias that inherits the index shell by forwarding to `index.html?route=admin...`;
- `prototype/student.html` — thin Student route alias that inherits the index shell by forwarding to `index.html?route=student...`;
- `prototype/exam.html` — thin Exam route alias that inherits the index shell by forwarding to `index.html?route=exam...`.

Where the broader revamp design or implementation plan still says that `index.html` remains a simple redirect, that Admin owns an independent page shell/head, or that the three surface HTML files should be removed, this execution plan and the binding routing contract control.

This plan also keeps the stricter styling requirement: **zero repository `.css` files under `/prototype`**, with Festacol-authored styling expressed through Tailwind CSS utilities and the shared Tailwind theme/configuration owned by `index.html`.

---

## 2. Correct target architecture

```text
prototype/
├── index.html
├── admin.html
├── student.html
├── exam.html
├── data/
│   └── questions.json
└── js/
    ├── shared.js
    ├── admin.js
    ├── student.js
    └── exam.js
```

Architecture rules:

1. `index.html` is the only file that owns the actual application shell, shared `<head>`, Tailwind theme/configuration, common dependency baseline, application root, and surface-runtime selection.
2. `admin.html`, `student.html`, and `exam.html` remain present and supported.
3. Those three files are intentionally thin route aliases/compatibility entry documents; they do not duplicate the application shell.
4. The aliases preserve meaningful query state and forward to the correct canonical index route.
5. Exactly four local runtime JavaScript files remain: `shared.js`, `admin.js`, `student.js`, and `exam.js`.
6. No fifth local `router.js`, `app.js`, `bootstrap.js`, or equivalent runtime file is introduced merely to implement routing.
7. The final `/prototype` tree contains zero `.css` files.

---

## 3. Execution order

Production implementation, once approved, must execute in this order:

1. refresh Engineering Lead, HANDOFF, `using-superpowers`, relevant personas, and current UI skills;
2. re-verify branch, PR, and current prototype consumers;
3. build the complete page-link/CSS/runtime consumer map;
4. define the canonical index-route helper and alias-forwarding contract;
5. consolidate shared domain/state/scoring/question/proctor/QR behavior into `shared.js`;
6. rebuild `index.html` as the canonical application shell and allowlisted route bootstrap;
7. convert `student.html`, `admin.html`, and `exam.html` into thin forwarding aliases without deleting them;
8. migrate Student rendering and Exam ID UI into `student.js`;
9. migrate Exam rendering into `exam.js`;
10. migrate Admin rendering and the complete UI/UX revamp into `admin.js`;
11. rewrite canonical generated links, QR links, Exam ID links, copy/share links, and redirects to use `index.html?route=...`;
12. migrate all Festacol-authored stylesheet behavior into Tailwind utilities;
13. remove repository `.css` files only after their consumers are proven migrated;
14. update permanent source/state contracts for the four-HTML inheritance model;
15. run Test, Independent Reviewer, and UX-aware Dogfood gates;
16. hand to Git/Release only after COMMIT READY.

No deletion-first or copy-the-whole-shell-into-each-page shortcut is allowed.

---

## 4. Gate A — repository-wide consumer map

Before production edits, Repository Investigator / Frontend Engineer must trace every reference to:

```text
index.html
admin.html
student.html
exam.html
academic-v3.css
festacol-admin.css
festacol-foundation.css
festacol.css
flowbite.min.css
```

Also trace:

- session and QR URL builders;
- Exam ID resolution;
- clipboard/share helpers;
- Admin navigation builders;
- Student dashboard actions;
- candidate start/resume redirects;
- report/drill-down links;
- tests and source audits;
- `location.assign`, `location.replace`, `location.href`, and `new URL(...)` call sites.

For each reference record:

- current source path;
- caller/helper;
- current URL shape;
- canonical target route;
- alias compatibility requirement;
- query parameters that must survive;
- Back/Forward implications.

Gate A fails if any HTML or CSS deletion is proposed before this map is complete.

---

## 5. Gate B — canonical route helper

Canonical surface state is:

```text
route=student
route=admin
route=exam
```

Canonical application examples:

```text
index.html?route=student
index.html?route=admin&page=overview
index.html?route=admin&page=students&student=ST-2401&tab=exams
index.html?route=admin&page=exams&exam=ABC123&tab=results
index.html?route=exam&<preserved-session-and-candidate-query-state>
```

Required rules:

- missing or unsupported `route` in `index.html` normalizes safely to Student;
- Admin nested state preserves `page`, record identifiers, `tab`, `modal`, `view`, `attempt`, and `step`;
- Exam preserves the validated session/candidate query contract;
- query updates preserve unrelated required parameters;
- URL creation uses `URL` / `URLSearchParams`, not brittle string concatenation;
- shared URL helpers are centralized in `shared.js` ownership;
- generated application links prefer canonical `index.html?route=...` URLs;
- compatibility aliases remain valid direct addresses.

No route helper may build an arbitrary script path directly from untrusted query text.

---

## 6. Gate C — rebuild `index.html` as the canonical entry shell

Replace the current redirect-only behavior with the actual application shell.

`index.html` owns:

- viewport and shared metadata baseline;
- DM Sans and Manrope font delivery;
- Tailwind CSS browser v4;
- the single approved `<style type="text/tailwindcss">` theme/configuration block;
- global accessibility baseline;
- shared loading/failure state;
- one application root;
- Flowbite JavaScript 4.0.1 where required;
- `shared.js` before surface-specific runtime;
- allowlisted selection of `student.js`, `admin.js`, or `exam.js`.

The shell must not contain:

- all three surfaces mounted simultaneously;
- local application stylesheet links;
- a Flowbite CSS stylesheet;
- a second regular `<style>` block recreating a component system;
- a fifth local runtime file;
- arbitrary route-to-script interpolation from raw query text.

Route bootstrap acceptance:

1. normalize `route`;
2. load `shared.js` first;
3. map only `student`, `admin`, and `exam` through an explicit allowlist;
4. load only the selected surface runtime;
5. let the selected runtime own the common application root;
6. update title/description where appropriate;
7. fail accessibly if a required runtime cannot initialize.

---

## 7. Gate D — retain and slim the three inherited route aliases

`admin.html`, `student.html`, and `exam.html` are **not deletion targets**.

They become minimal compatibility entry documents that inherit the real application experience by forwarding into `index.html`.

Required mappings:

```text
admin.html?page=students
→ index.html?route=admin&page=students

student.html
→ index.html?route=student

exam.html?<session/candidate query state>
→ index.html?route=exam&<same session/candidate query state>
```

Alias requirements:

- preserve all meaningful query parameters;
- force only their own top-level route (`admin`, `student`, or `exam`);
- use `location.replace(...)` or an equivalent non-looping forwarding mechanism where appropriate;
- include only minimal metadata/bootstrap and a useful `<noscript>` fallback;
- do not load local CSS;
- do not duplicate the Tailwind theme;
- do not load `shared.js` or a surface runtime themselves;
- do not mount independent Admin/Student/Exam UI markup;
- do not create redirect loops when reached from browser history or bookmarks.

This is the precise meaning of “Admin, Student, and Exam inherit from `index.html`” in a static HTML prototype.

---

## 8. Gate E — Student migration

`student.js` renders the Student surface inside the shared `index.html` root.

Preserve:

- student dashboard behavior;
- Exam ID entry;
- case-insensitive session lookup;
- draft-exam rejection;
- camera policy decoration;
- transition to canonical Exam route;
- accessibility/dialog focus behavior;
- current Student state/data relationships.

Migrate any visual behavior currently supplied by `festacol.css` or `academic-v3.css` to explicit Tailwind utilities.

Validate both:

```text
index.html?route=student
student.html
```

The second must forward to the first without losing required state.

---

## 9. Gate F — Exam migration

`exam.js` renders the candidate examination workspace inside the shared `index.html` root.

Preserve:

- login/start gate;
- session/candidate lookup;
- deterministic paper;
- responses;
- timer;
- camera/proctor state;
- fullscreen/integrity events;
- background-time reconciliation;
- timeout auto-submit;
- resume/recovery;
- review/submit;
- submitted/locked/result states.

Canonical generated Exam URLs use:

```text
index.html?route=exam&...
```

`exam.html?...` remains a supported alias and must preserve the exact meaningful Exam query state when forwarding.

---

## 10. Gate G — Admin migration and complete redesign

`admin.js` renders the full Admin product inside the shared `index.html` root when `route=admin`.

All eight areas remain required:

1. Overview
2. Students
3. Staff
4. Examinations
5. Classes
6. Question Bank
7. Reports
8. Settings

Canonical navigation examples:

```text
index.html?route=admin&page=overview
index.html?route=admin&page=students
index.html?route=admin&page=staff
index.html?route=admin&page=exams
index.html?route=admin&page=classes
index.html?route=admin&page=questions
index.html?route=admin&page=reports
index.html?route=admin&page=settings
```

`admin.html?...` remains a supported alias and must preserve nested Admin query state while forwarding.

All existing UI/UX governance remains binding: depth/elevation, modal blur/backdrop, nested screens, popovers, dropdowns, alerts, toasts, Stepper state, Back/Forward, accessibility, responsiveness, and Flowbite-first interaction semantics.

No Admin feature may create another standalone HTML page as an escape hatch.

---

## 11. Gate H — Tailwind-only authored styling migration

UI/UX Product Engineer and Frontend Engineer must map the visible behavior of each current CSS file before removal:

```text
prototype/assets/academic-v3.css
prototype/assets/festacol-admin.css
prototype/assets/festacol-foundation.css
prototype/assets/festacol.css
```

For each selector record:

- where it is consumed;
- visible behavior supplied;
- accessibility/responsive behavior supplied;
- target Tailwind utility composition;
- whether it is obsolete.

Strict target rules:

- zero `.css` files under `/prototype`;
- no Flowbite CSS CDN;
- no generated Festacol CSS asset;
- no page-specific stylesheet;
- no second regular application `<style>` block;
- no app-authored `style="..."` escape hatch for application UI;
- no CSSOM-injected application layout/component styling workaround;
- complete Tailwind class names in templates/render functions;
- arbitrary values are allowed where the approved design system requires them;
- the shared Tailwind theme/configuration remains in `index.html` using `<style type="text/tailwindcss">`;
- Flowbite JavaScript 4.0.1 may provide interaction behavior;
- copied/adapted Flowbite markup carries its visual treatment through Tailwind utilities.

Depth, elevation, shadows, rings, blur, z-index, motion, responsive state, focus, hover, active, disabled, and reduced-motion behavior must be implemented with Tailwind utilities/theme configuration rather than repository CSS selectors.

---

## 12. Gate I — dependency ownership

`index.html` owns the dependency baseline inherited by all surfaces:

### Always available

- DM Sans / Manrope font delivery;
- Tailwind CSS browser v4;
- the shared `text/tailwindcss` theme/configuration block;
- Flowbite JavaScript 4.0.1 where required;
- `shared.js`.

### Surface-aware

ApexCharts exactly 3.46.0 and Simple-DataTables exactly 9.0.3 should only initialize where required, provided conditional loading does not add another local runtime file.

There must be:

- no unpinned ApexCharts script;
- no Flowbite CSS link;
- no duplicate Tailwind loader;
- no divergent dependency head copied into the three aliases.

---

## 13. Gate J — CSS removal only after migration

Deletion targets are only the repository CSS files and obsolete fragmented runtime files identified by the broader revamp plan.

The following HTML files are explicitly **retained**:

```text
prototype/index.html
prototype/admin.html
prototype/student.html
prototype/exam.html
```

Before deleting each CSS file, re-run repository search and prove no active selector/consumer remains.

CSS-removal acceptance:

- no runtime request for a removed local CSS file;
- no source reference to removed CSS assets;
- no test/audit fixture assumes those CSS assets remain;
- equivalent required visual/accessibility behavior exists through Tailwind utilities.

---

## 14. Gate K — permanent source-contract updates

Update `scripts/prototype-audit.mjs` and relevant source contracts to enforce:

1. `prototype/index.html` exists and owns the canonical application shell.
2. `prototype/admin.html`, `prototype/student.html`, and `prototype/exam.html` also exist.
3. each alias forwards to the correct index route and preserves meaningful query state.
4. aliases do not contain full duplicated application UIs.
5. aliases do not load local CSS or independent runtime stacks.
6. exactly four local runtime JS files remain: `shared.js`, `admin.js`, `student.js`, and `exam.js`.
7. no `.css` file exists below `prototype/`.
8. no `flowbite.min.css` reference exists.
9. Tailwind browser v4 is present in `index.html`.
10. `index.html` contains the approved `style[type="text/tailwindcss"]` theme/configuration block.
11. route selection is allowlisted to Student/Admin/Exam.
12. shared runtime loads before selected surface runtime.
13. no arbitrary user-controlled script path exists.
14. internally generated links prefer canonical index routing.
15. the audit does **not** fail merely because the three alias HTML files exist; their presence is required.

Audit failures must identify the offending file and rule.

---

## 15. Gate L — browser regression matrix

Dogfood must exercise both canonical and alias paths.

### Student

- `index.html?route=student`;
- `student.html` alias forwarding;
- refresh;
- Exam ID success;
- invalid Exam ID;
- draft exam rejection;
- transition to Exam;
- Back/Forward where meaningful.

### Exam

- canonical valid session route;
- `exam.html?...` alias forwarding;
- refresh/resume;
- camera required/denied/retry;
- timer/background reconciliation;
- integrity events;
- review/submit;
- timeout auto-submit;
- submitted/rewrite states.

### Admin

- `index.html?route=admin&page=overview`;
- `admin.html?page=overview` alias forwarding;
- all eight Admin pages;
- nested Student/Exam/Class/Question/report views;
- modal URL state;
- Stepper state;
- popovers/dropdowns/alerts/toasts;
- Back/Forward;
- direct deep links;
- invalid record IDs;
- responsive transformations.

Minimum viewports:

- 390×844;
- 820×1000;
- 1440×1000.

Network/source checks:

- alias navigation results in canonical index routes without loops;
- no local `.css` request occurs;
- no `flowbite.min.css` request occurs;
- only the correct surface runtime initializes;
- no duplicate application shell initializes;
- no console error results from missing styles or duplicate libraries.

---

## 16. Gate M — independent review questions

Independent Reviewer must explicitly challenge:

1. Is `index.html` the canonical application entry and real shared shell?
2. Are `admin.html`, `student.html`, and `exam.html` still present as thin aliases rather than deleted?
3. Do aliases forward without losing query state or creating loops?
4. Do aliases avoid duplicating shell/head/theme/runtime markup?
5. Is route selection allowlisted?
6. Do QR, Exam ID, share/copy, redirects, and generated navigation prefer canonical index routes?
7. Does Exam preserve the real session/candidate contract?
8. Does Admin nested history remain predictable?
9. Are there truly zero `.css` files under `/prototype`?
10. Is Flowbite CSS absent while Flowbite interaction semantics remain valid?
11. Was removed CSS merely moved into JavaScript or another ordinary `<style>` block?
12. Are Tailwind classes complete/static enough for the browser runtime to apply reliably?
13. Did stylesheet removal regress accessibility, responsive behavior, depth, focus, or reduced motion?
14. Did a fifth local router/bootstrap file slip into the runtime?
15. Are all broader product behavior-preservation requirements still satisfied?

Any blocking answer routes work back to the owning persona.

---

## 17. COMMIT READY additions

The implementation cannot be marked COMMIT READY until evidence proves:

- `index.html` is the canonical application entry and real base shell;
- `admin.html`, `student.html`, and `exam.html` remain supported thin inherited route aliases;
- alias forwarding preserves required query state;
- aliases do not duplicate the app shell or dependency head;
- canonical Student/Admin/Exam routes work from `index.html`;
- exactly four local runtime JavaScript files remain;
- zero `.css` files exist under `/prototype`;
- no Flowbite CSS CDN is used;
- Tailwind utilities own Festacol-authored UI styling;
- shared Tailwind theme/configuration remains in the `index.html` head;
- URL helpers and the route loader are centralized and allowlisted;
- old URL/CSS consumers were traced and migrated;
- permanent source contracts enforce the four-HTML inheritance architecture;
- functional validation passes;
- independent review passes;
- UX-aware Dogfood passes canonical and alias routes at all three required viewports.

Until product-owner approval is given, status remains `PLANNED` and none of the production edits above should begin.
