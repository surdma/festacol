# Festacol Single-Shell Tailwind-Only Routing Contract

**Date:** 2026-09-12  
**Status:** Binding architecture correction — awaiting product-owner approval  
**Repository baseline:** `master` at `43313acc38ba682a66bda3706ac444d905da7844`  
**Scope:** `/prototype` only

## 1. Authority and precedence

This specification is a binding correction to the existing Festacol prototype planning set.

Where any earlier planning document conflicts with this file, this file controls for:

- HTML entry-point architecture;
- Admin / Student / Exam surface routing;
- Tailwind CSS ownership of authored styling;
- CSS-file removal;
- shared `<head>` dependencies and theme configuration;
- Flowbite CSS versus Flowbite JavaScript usage;
- route-aware runtime loading.

In particular, any earlier statement that treats `admin.html`, `student.html`, or `exam.html` as target runtime pages is superseded. Any earlier statement that requires or permits a Festacol `.css` file, the Flowbite stylesheet CDN, or a second regular application `<style>` block is superseded.

This remains a planning-only contract. It does not authorize production implementation by itself.

---

## 2. Verified current-state gap

The current prototype still has four HTML files:

- `prototype/index.html`, which redirects to `student.html`;
- `prototype/admin.html`;
- `prototype/student.html`;
- `prototype/exam.html`.

The current prototype also contains repository CSS files under `prototype/assets/`, including:

- `academic-v3.css`;
- `festacol-admin.css`;
- `festacol-foundation.css`;
- `festacol.css`.

Current Student HTML loads local CSS files, and the Admin / Student / Exam documents load the Flowbite CSS CDN.

The target architecture removes this fragmentation instead of preserving it.

---

## 3. Single HTML shell is mandatory

The target prototype contains exactly one runtime HTML document:

```text
prototype/
├── index.html
├── data/
│   └── questions.json
└── js/
    ├── shared.js
    ├── admin.js
    ├── student.js
    └── exam.js
```

Target rules:

1. `prototype/index.html` is the only application shell and only runtime HTML entry point.
2. `prototype/admin.html` is deleted after every internal consumer has been migrated.
3. `prototype/student.html` is deleted after every internal consumer has been migrated.
4. `prototype/exam.html` is deleted after every internal consumer has been migrated.
5. No replacement per-surface HTML file, partial, include, iframe shell, or hidden duplicate page is introduced.
6. Admin, Student, and Exam inherit the same `index.html` `<head>`, theme, global dependencies, accessibility baseline, and application root.
7. Surface-specific markup is rendered by the corresponding page runtime into the shared application shell.

The single-shell requirement is architectural, not cosmetic. A solution that leaves the old HTML pages in active use fails this contract.

---

## 4. Canonical surface routing

The static prototype uses query-driven routing so it remains deep-linkable without requiring server rewrite rules.

The canonical top-level selector is:

```text
route=student
route=admin
route=exam
```

Canonical examples:

```text
prototype/index.html?route=student
prototype/index.html?route=admin&page=overview
prototype/index.html?route=admin&page=students&student=ST-2401&tab=exams
prototype/index.html?route=admin&page=exams&exam=ABC123&tab=results
prototype/index.html?route=admin&page=exams&exam=ABC123&tab=results&modal=attempt&attempt=ATTEMPT_HASH
prototype/index.html?route=admin&page=exams&modal=create-exam&step=3
prototype/index.html?route=exam&<existing-session-and-candidate-query-state>
```

Routing rules:

- missing `route` defaults to `student`;
- unsupported `route` values normalize to `student` with non-blocking feedback where appropriate;
- Admin keeps its existing nested `page=`, record, `tab=`, `modal=`, `attempt=`, `view=`, and `step=` query-state model;
- Exam keeps the existing session/candidate query contract unless repository investigation proves a migration is required;
- QR links, Exam ID links, copied links, shared links, navigation links, and redirects must point to `index.html` with the correct `route` value;
- meaningful route changes use the History API so Back/Forward restores the correct surface and nested state;
- closing an Admin overlay removes only overlay-specific query state and preserves its parent route/page/filter/tab context;
- no surface navigation may depend on browser popup windows or separate page shells.

A route helper must be centralized so Admin, Student, Exam, QR generation, clipboard/share logic, and redirects do not independently assemble competing URLs.

---

## 5. Route-aware runtime loading

The target still contains exactly four local runtime JavaScript files:

- `prototype/js/shared.js`;
- `prototype/js/admin.js`;
- `prototype/js/student.js`;
- `prototype/js/exam.js`.

No `router.js`, `app.js`, `bootstrap.js`, or fifth local runtime file is added merely to support the single HTML shell.

`index.html` owns a small allowlisted bootstrap that:

1. parses `route`;
2. normalizes it to `student`, `admin`, or `exam`;
3. loads `shared.js` first;
4. loads only the selected surface runtime;
5. exposes the normalized route to the surface runtime without duplicating domain rules;
6. updates document title/metadata where needed;
7. provides a shared application root and accessible loading/failure state.

The bootstrap must use an explicit allowlist. It must never construct an arbitrary script path directly from untrusted query text.

Preferred shape:

```html
<script src="./js/shared.js"></script>
<script>
  // Pseudocode only. Implementation must be allowlisted and validated.
  const allowedRoutes = new Set(["student", "admin", "exam"]);
  const route = /* normalize URLSearchParams route */;
  const script = document.createElement("script");
  script.src = `./js/${route}.js`;
  document.body.append(script);
</script>
```

The actual implementation may use an equivalent inline loader, but it may not create an extra local runtime file.

---

## 6. Tailwind-only authored styling contract

Festacol-authored styling must be expressed through Tailwind CSS v4 utilities and the Tailwind browser configuration in `index.html`.

### 6.1 No repository CSS files

The final `/prototype` tree must contain **zero `.css` files**.

The implementation plan must remove the current CSS files after their behavior has been mapped to Tailwind utilities:

```text
prototype/assets/academic-v3.css
prototype/assets/festacol-admin.css
prototype/assets/festacol-foundation.css
prototype/assets/festacol.css
```

No replacement `.css` file may be introduced under a different name or directory.

### 6.2 No application/component stylesheet links

`index.html` must not load:

- a local Festacol stylesheet;
- a generated prototype stylesheet;
- a page-specific stylesheet;
- `flowbite.min.css` or any other Flowbite CSS file;
- a second component-library stylesheet.

Flowbite remains the interaction/component reference and JavaScript behavior library, but its component visual styling must be represented by the Tailwind utility classes carried by the copied/adapted Flowbite markup.

Flowbite JavaScript 4.0.1 may remain loaded once from CDN for modal, dropdown, popover, tooltip, and related interactive behavior.

### 6.3 Head-owned Tailwind theme and style configuration

The shared `index.html` `<head>` remains responsible for the product theme and Tailwind browser setup.

The target keeps a head structure equivalent to:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme {
    --font-sans: "DM Sans", sans-serif;
    --font-display: "Manrope", sans-serif;
  }

  html { scroll-behavior: smooth; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
</style>
```

The font stylesheet is permitted only as font delivery; it is not an application/component styling surface.

There must not be a second regular `<style>` block containing a hidden component system such as `.surface`, `.metric-strip`, `.icon-button`, `.attention-row`, or page-specific selectors. Those patterns must become direct Tailwind utilities in markup/rendered templates.

### 6.4 Tailwind authoring rules

- Layout, spacing, typography, color, radius, border, shadow, elevation, blur, transitions, responsive behavior, focus, hover, active, disabled, and reduced-motion behavior use Tailwind utilities.
- Use complete Tailwind class names. Do not generate utility names through unsafe string concatenation that the Tailwind browser cannot reliably detect.
- Arbitrary values such as `max-w-[1600px]`, `z-[120]`, or tuned shadow utilities are allowed when the UI system requires them.
- Prefer semantic composition in the rendering code over custom CSS selectors.
- Do not use app-authored `style="..."` attributes or CSSOM-injected layout/component styling as a workaround for removing CSS files.
- Third-party libraries may inject internal runtime styles required for their own rendering, but Festacol must not use that as a styling escape hatch.
- ApexCharts configuration may control chart-specific visual properties where the library requires JavaScript options, but surrounding product UI remains Tailwind-authored.

---

## 7. Shared `index.html` dependency contract

The single shell loads shared dependencies once.

Required shared head/body dependencies remain:

- DM Sans 400/500/600/700;
- Manrope 500/600/700/800;
- Tailwind CSS browser v4;
- Flowbite JavaScript 4.0.1 only, with no Flowbite CSS stylesheet;
- ApexCharts exactly 3.46.0 when required by the active surface;
- Simple-DataTables exactly 9.0.3 when required by the active surface.

Heavy surface-specific libraries should not be initialized on routes that do not use them. The implementation may conditionally initialize or load these dependencies so the Student and Exam surfaces do not pay unnecessary Admin-only runtime cost, provided the one-HTML-shell rule is preserved.

There must be only one ApexCharts version in the prototype.

---

## 8. Surface inheritance contract

All three product surfaces inherit the shell rather than duplicating it.

### 8.1 Student

`student.js` renders the Student dashboard into the shared root and owns Student presentation plus Exam ID UI. It must not assume `student.html` exists.

### 8.2 Admin

`admin.js` renders the complete Admin application into the shared root, including its responsive shell, nested pages, modals, popovers, alerts, toasts, Stepper, reports, and DataTables/Charts integration. It must not assume `admin.html` exists.

### 8.3 Exam

`exam.js` renders the candidate examination workspace into the shared root. It must not assume `exam.html` exists. Session, candidate, camera, timer, integrity, resume, review, and submit behavior must read the preserved query/state contract from the shared URL.

The three runtimes may render different layouts, but they share one HTML document and theme/dependency baseline.

---

## 9. Link and consumer migration requirements

Before deleting the old HTML files, implementation must search the repository for every reference to:

- `admin.html`;
- `student.html`;
- `exam.html`;
- `/admin.html`;
- `/student.html`;
- `/exam.html`;
- the four current prototype CSS filenames;
- `flowbite.min.css`.

Known consumer classes that must be traced include:

- Admin navigation links;
- Student navigation links;
- QR/session-link generation;
- Exam ID resolution;
- copy/share examination links;
- redirects;
- tests/audit scripts;
- documentation fixtures/examples;
- any browser-local helper that derives a URL from `location.href`.

Deletion is allowed only after these consumers point to canonical `index.html?route=...` URLs or are intentionally removed.

---

## 10. Source-contract validation additions

The permanent Node/source audit must fail if any of the following is true after implementation:

1. `prototype/admin.html` exists.
2. `prototype/student.html` exists.
3. `prototype/exam.html` exists.
4. any `.css` file exists under `prototype/`.
5. `index.html` links a local application stylesheet.
6. `index.html` loads `flowbite.min.css`.
7. more than one runtime HTML entry point exists.
8. a local runtime JavaScript file outside `shared.js`, `admin.js`, `student.js`, and `exam.js` is introduced.
9. a canonical surface link points to a removed HTML file.
10. Admin/Student/Exam cannot be opened directly from `index.html` route state.
11. unsupported route values can inject an arbitrary script path.
12. nested Admin Back/Forward behavior loses parent route/page/tab state.

The audit should also verify the shared `index.html` contains the Tailwind browser script and the required `text/tailwindcss` theme block.

---

## 11. Browser acceptance matrix

Dogfood must open the same HTML file for all surfaces:

```text
index.html?route=student
index.html?route=admin&page=overview
index.html?route=exam&<valid-session-state>
```

Minimum viewports remain:

- 390×844 mobile;
- 820×1000 tablet;
- 1440×1000 desktop.

For each surface, verify:

- shell loads without a missing stylesheet;
- no old HTML page request occurs;
- no old CSS file request occurs;
- expected route runtime loads and other surface runtime does not accidentally take ownership;
- typography/theme is consistent because the `<head>` is shared;
- meaningful Back/Forward behavior works;
- Flowbite JavaScript interactions still work without the Flowbite CSS file;
- rendered components remain fully styled through Tailwind utilities;
- no horizontal overflow or lost focus states were introduced by CSS migration;
- reduced-motion behavior still works.

---

## 12. Acceptance criteria

This architecture correction is satisfied only when the implementation plan and eventual production work enforce all of the following:

1. `prototype/index.html` is the sole application HTML entry point.
2. Admin, Student, and Exam are route-selected surfaces inheriting that shell.
3. `route=student`, `route=admin`, and `route=exam` are canonical surface selectors.
4. nested Admin query-state behavior remains compatible with the existing deep-navigation contract.
5. Exam preserves its validated session/candidate query state while moving to the index shell.
6. exactly four local runtime JavaScript files remain: `shared.js`, `admin.js`, `student.js`, and `exam.js`.
7. no fifth router/bootstrap JavaScript file is introduced.
8. the final `/prototype` tree contains zero `.css` files.
9. no Flowbite CSS stylesheet is loaded.
10. Festacol-authored styling is Tailwind utility driven.
11. shared Tailwind theme/reduced-motion configuration remains in the `index.html` head.
12. no regular second application `<style>` block recreates a hidden CSS component framework.
13. all current old-page and old-CSS consumers are traced before deletion.
14. QR, Exam ID, copied, shared, redirected, and navigated links resolve through `index.html` routes.
15. source-contract validation enforces the one-shell/no-CSS architecture permanently.
16. UI/UX governance, Flowbite component semantics, accessibility, responsive behavior, and Dogfood gates from the earlier planning set remain binding.

**Status after this correction:** `PLANNED` only. Production implementation remains blocked until product-owner approval.