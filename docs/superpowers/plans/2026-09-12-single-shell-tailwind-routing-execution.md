# Festacol Single-Shell Tailwind-Only Routing Execution Plan

**Date:** 2026-09-12  
**Status:** Planning only — awaiting product-owner approval  
**Applies to:** the Festacol prototype revamp implementation plan and UI/UX execution gates

## 1. Purpose

This plan operationalizes the binding `single-shell-tailwind-routing-contract` without authorizing production implementation.

It extends the main implementation plan and UI/UX execution gates. Where those earlier plans refer to `admin.html`, `student.html`, or `exam.html` as target pages, this plan supersedes them with one shared `prototype/index.html` shell.

It also tightens the styling target from “no Admin CSS file” to **zero repository CSS files under `/prototype`** and Tailwind-utility-driven authored styling.

---

## 2. Execution order

Production implementation, once approved, must execute in this order:

1. refresh Lead / HANDOFF / using-superpowers / relevant personas and UI skills;
2. re-verify the current branch and current prototype consumers;
3. establish the exact old-page / old-CSS reference map;
4. establish the single-shell route contract before deleting anything;
5. migrate shared state/domain logic into `shared.js`;
6. turn `index.html` into the shared shell and route bootstrap;
7. migrate Student rendering into `student.js`;
8. migrate Exam rendering into `exam.js`;
9. migrate Admin rendering into `admin.js`;
10. rewrite all internal links, QR links, Exam ID links, copy/share links, redirects, and tests/audits to index routes;
11. migrate every required visual rule from repository CSS files or regular CSS selectors into Tailwind utilities;
12. remove the old HTML files and all prototype `.css` files only after their consumers are proven migrated;
13. update permanent source/state contracts;
14. run Test, Independent Reviewer, and UX-aware Dogfood gates;
15. hand to Git/Release only after COMMIT READY.

No deletion-first shortcut is allowed.

---

## 3. Gate A — repository-wide consumer map

Before production edits, Repository Investigator / Frontend Engineer must search for every reference to:

```text
admin.html
student.html
exam.html
academic-v3.css
festacol-admin.css
festacol-foundation.css
festacol.css
flowbite.min.css
```

Also trace URL helpers and consumers that may construct page names indirectly, including:

- session/QR URL builders;
- Exam ID resolution;
- clipboard/share helpers;
- Admin navigation builders;
- Student dashboard actions;
- candidate start/resume redirects;
- report/drill-down links;
- tests and source audits;
- any `location.assign`, `location.replace`, `location.href`, `new URL(...)`, or equivalent call site.

Required handoff evidence:

- exact source path;
- exact caller/helper;
- current URL shape;
- target index-route shape;
- whether query parameters must be preserved;
- whether Back/Forward behavior is involved.

Gate A fails if deletion is proposed before this map is complete.

---

## 4. Gate B — canonical route helper

Implement one canonical URL helper in shared runtime ownership.

Required top-level route state:

```text
route=student
route=admin
route=exam
```

Required rules:

- missing/invalid route normalizes safely to Student;
- Admin nested state preserves the existing `page`, record, `tab`, `modal`, `view`, `attempt`, and `step` model;
- Exam preserves the existing validated session/candidate query contract;
- query-state updates preserve unrelated required parameters;
- URL creation uses `URL` / `URLSearchParams`, not brittle string concatenation;
- all consumers call the same helper or an explicitly thin surface wrapper;
- no runtime may hardcode `admin.html`, `student.html`, or `exam.html` after migration.

Acceptance examples:

```text
index.html?route=student
index.html?route=admin&page=overview
index.html?route=admin&page=students&student=ST-2401&tab=exams
index.html?route=admin&page=exams&exam=ABC123&tab=results
index.html?route=exam&<preserved-session-query>
```

---

## 5. Gate C — rebuild `index.html` as the sole shell

Replace the current redirect-only `prototype/index.html` with the actual application shell.

The new file owns:

- meta viewport and shared metadata baseline;
- fonts;
- Tailwind browser v4;
- the single `text/tailwindcss` theme/configuration block;
- shared body baseline;
- accessible skip/failure/loading structure;
- one application root;
- Flowbite JavaScript loaded once;
- shared runtime bootstrap;
- allowlisted surface runtime selection.

The shell must **not** contain:

- duplicated Admin/Student/Exam page markup that all remains mounted at once;
- a local stylesheet link;
- a Flowbite stylesheet link;
- a second hidden CSS component-system `<style>` block;
- a fifth local runtime file;
- an arbitrary dynamic script URL derived directly from query text.

Route bootstrap acceptance:

- loads `shared.js` first;
- allowlists `student`, `admin`, `exam`;
- loads only the selected surface runtime;
- surface takes ownership of the shared root;
- unsupported route does not produce a script-injection path;
- document title/description may be updated to match the selected surface.

---

## 6. Gate D — Student migration to the shell

Move Student shell markup and inline Exam ID behavior out of `student.html` and into `student.js` / shared helpers as appropriate.

Required preservation:

- current student dashboard behavior;
- Exam ID entry;
- case-insensitive session lookup;
- draft-exam rejection;
- camera policy decoration;
- transition to the Exam route;
- accessibility and dialog focus behavior;
- existing Student state/data relationships.

Required styling migration:

- replace classes whose definitions currently come from `festacol.css` / `academic-v3.css` with explicit Tailwind utilities;
- no app-authored inline `style=` fallback;
- no runtime-created custom stylesheet.

Student route must work directly from:

```text
index.html?route=student
```

---

## 7. Gate E — Exam migration to the shell

Move Exam shell markup from `exam.html` into `exam.js` rendering against the shared root.

Required preservation includes:

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
- submitted/locked/result state.

Every generated Exam URL must target:

```text
index.html?route=exam&...
```

The existing meaningful exam/session/candidate parameters are preserved unless an evidence-based migration is separately documented.

---

## 8. Gate F — Admin migration and complete redesign in the shell

Admin UI/UX work remains governed by the full revamp specifications and UI/UX execution gates.

The only architectural change is that Admin no longer owns a separate document.

`admin.js` must render its full application shell into the shared root when:

```text
route=admin
```

All eight routes remain required:

1. Overview
2. Students
3. Staff
4. Examinations
5. Classes
6. Question Bank
7. Reports
8. Settings

Canonical Admin navigation examples become:

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

Nested page, modal, Stepper, popover, alert, toast, report drill-down, attempt drill-down, and Back/Forward requirements remain unchanged except they inherit the index shell.

No Admin feature may create a separate HTML page as an escape hatch.

---

## 9. Gate G — Tailwind-only authored styling migration

UI/UX Product Engineer and Frontend Engineer must jointly map the current stylesheet behavior before deletion.

For each existing CSS file:

```text
prototype/assets/academic-v3.css
prototype/assets/festacol-admin.css
prototype/assets/festacol-foundation.css
prototype/assets/festacol.css
```

record:

- selectors still used;
- visible behavior supplied;
- accessibility/responsive behavior supplied;
- target Tailwind utility composition;
- target rendered component/surface;
- whether the selector is obsolete.

Then migrate the behavior to explicit Tailwind utilities.

Strict rules:

- zero `.css` files in final `/prototype`;
- no Flowbite CSS CDN;
- no generated Festacol CSS asset;
- no regular second application `<style>` block;
- no `style="..."` workaround for application UI;
- no CSSOM-injected application layout/styling workaround;
- complete Tailwind class names in source/templates;
- arbitrary values allowed where justified;
- shared theme variables/reduced-motion rules remain in `index.html` using `<style type="text/tailwindcss">`;
- Flowbite markup patterns may be used, but visual styling is carried by Tailwind utility classes;
- Flowbite JavaScript 4.0.1 remains available for interaction behavior.

The UI/UX depth model must therefore be implemented with utilities such as borders, shadows, rings, `backdrop-blur-*`, opacity, z-index, radius, and responsive variants rather than custom component selectors.

---

## 10. Gate H — dependency placement

Shared shell dependency rules:

### Always available

- fonts;
- Tailwind CSS browser v4;
- Flowbite JS 4.0.1;
- `shared.js`.

### Surface-aware

ApexCharts 3.46.0 and Simple-DataTables 9.0.3 should be loaded/initialized only when the active surface requires them if doing so can be achieved without introducing another local runtime file.

There must be:

- one ApexCharts version;
- no unpinned ApexCharts script;
- no Flowbite CSS link;
- no duplicate Tailwind loader;
- no separate per-surface dependency heads.

---

## 11. Gate I — delete old HTML/CSS only after migration

Deletion targets:

```text
prototype/admin.html
prototype/student.html
prototype/exam.html
prototype/assets/academic-v3.css
prototype/assets/festacol-admin.css
prototype/assets/festacol-foundation.css
prototype/assets/festacol.css
```

Before each deletion, re-run repository search and prove no active consumer remains.

Deletion acceptance:

- no runtime request for removed files;
- no source reference to removed page names in active code;
- no source reference to removed CSS files;
- no test/audit fixture assumes the old page structure;
- QR/Exam ID/share links already use index routes.

---

## 12. Gate J — permanent source-contract updates

Update `scripts/prototype-audit.mjs` and other relevant source contracts to enforce:

- exactly one runtime HTML file: `prototype/index.html`;
- exactly four local runtime JS files: `shared.js`, `admin.js`, `student.js`, `exam.js`;
- no `.css` file below `prototype/`;
- no reference to `admin.html`, `student.html`, or `exam.html` in active runtime code;
- no `flowbite.min.css` reference;
- Tailwind browser v4 present in index;
- `style[type="text/tailwindcss"]` theme block present;
- route allowlist contains Student/Admin/Exam only;
- shared runtime loads before selected surface runtime;
- no arbitrary user-controlled script path;
- source links use canonical index routing.

The audit should report actionable failures by file and rule.

---

## 13. Gate K — route/browser regression matrix

Dogfood must exercise one physical HTML page across all three surfaces.

### Student

- direct load;
- refresh;
- Exam ID success;
- invalid Exam ID;
- draft exam rejection;
- transition to Exam;
- Back/Forward where meaningful.

### Exam

- direct valid session URL;
- refresh/resume;
- camera required/denied/retry;
- timer/background reconciliation;
- integrity events;
- review/submit;
- timeout auto-submit;
- submitted/rewrite states.

### Admin

- all eight pages;
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

- no request for `admin.html`, `student.html`, or `exam.html`;
- no request for any removed local CSS file;
- no request for `flowbite.min.css`;
- correct surface runtime only;
- no console error from missing styles or duplicate libraries.

---

## 14. Gate L — independent review questions

Independent Reviewer must explicitly challenge:

1. Is `index.html` truly the only runtime HTML shell?
2. Are the other three HTML files actually removed rather than bypassed?
3. Is route selection allowlisted?
4. Do QR, Exam ID, share/copy, redirects, and navigation all use canonical index routes?
5. Does the Exam route preserve the real session/candidate contract?
6. Does Admin nested history remain predictable?
7. Are there truly zero `.css` files under `/prototype`?
8. Is Flowbite CSS absent?
9. Was custom CSS merely moved into JavaScript or a second regular `<style>` block?
10. Are Tailwind classes complete/static enough for the browser runtime to apply reliably?
11. Did stylesheet removal regress accessibility, responsive behavior, depth, focus, or reduced motion?
12. Did a fifth local router/bootstrap file slip into the runtime?
13. Are all prior product behavior-preservation requirements still satisfied?

Any blocking answer routes work back to the owning persona.

---

## 15. COMMIT READY additions

The implementation cannot be marked COMMIT READY until evidence proves:

- one shared `prototype/index.html` shell;
- Admin/Student/Exam inherit that shell through route state;
- no `admin.html`, `student.html`, or `exam.html` remains;
- zero `.css` files under `/prototype`;
- no Flowbite CSS CDN;
- Tailwind utilities own authored UI styling;
- shared Tailwind theme/config remains in the index head;
- route helper and route loader are centralized and allowlisted;
- exactly four local runtime JS files remain;
- old URL/CSS consumers were traced and migrated;
- permanent source contracts enforce the architecture;
- functional tests pass;
- independent review passes;
- UX-aware Dogfood passes all three viewports and all three route surfaces.

Until product-owner approval is given, status remains `PLANNED` and none of the production edits above should begin.