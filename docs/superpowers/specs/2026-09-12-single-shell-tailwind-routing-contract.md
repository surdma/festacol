# Festacol Entry-Shell Inheritance and Tailwind-Only Routing Contract

**Date:** 2026-09-12  
**Status:** Binding architecture correction — awaiting product-owner approval  
**Repository baseline:** `master` at `43313acc38ba682a66bda3706ac444d905da7844`  
**Scope:** `/prototype` only

## 1. Authority and precedence

This specification is the canonical routing/styling architecture for the Festacol prototype revamp.

Where any earlier planning document conflicts with this file, this file controls for:

- the relationship between `index.html`, `admin.html`, `student.html`, and `exam.html`;
- canonical surface routing;
- what “inherit from index” means in this static prototype;
- Tailwind CSS ownership of application styling;
- CSS-file removal;
- shared head/theme/dependency ownership;
- permanent source-contract expectations.

The following earlier interpretations are explicitly invalid and must not be implemented:

- deleting `admin.html`, `student.html`, or `exam.html`;
- making `index.html` the only HTML file under `/prototype`;
- allowing each surface HTML file to own an independent full application shell/head/theme;
- keeping `index.html` as only a simple redirect to `student.html`;
- failing source contracts merely because the three surface HTML aliases exist.

This remains a planning-only contract. It does not authorize production implementation by itself.

---

## 2. Correct target HTML architecture

The target keeps four HTML files:

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

Their roles are intentionally different.

### 2.1 `index.html` — canonical entry point and base application shell

`prototype/index.html` is the canonical application entry point and the only HTML file that owns the real application shell.

It owns:

- the shared `<head>` contract;
- DM Sans and Manrope font delivery;
- Tailwind CSS browser v4;
- the shared Tailwind theme/configuration block;
- global metadata/accessibility baseline;
- Flowbite JavaScript where required;
- the shared application root;
- route parsing and normalization;
- loading `shared.js` first;
- allowlisted selection/loading of the active surface runtime.

`index.html` is therefore the source of truth from which all product surfaces inherit their shell, theme, dependency baseline, and application root.

### 2.2 `admin.html`, `student.html`, and `exam.html` — inherited route aliases

These files remain supported URLs, but they do **not** become separate application shells.

Static HTML has no native document-inheritance syntax. For this project, “inherits from `index.html`” has one precise meaning:

> each surface HTML file is a thin compatibility/route document that preserves its query state and forwards into the canonical `index.html` shell for that surface.

Required behavior:

```text
admin.html?page=students
→ index.html?route=admin&page=students

student.html
→ index.html?route=student

exam.html?<session/candidate query state>
→ index.html?route=exam&<same session/candidate query state>
```

The aliases may contain only the minimal metadata/forwarding bootstrap and a useful `<noscript>` fallback.

They must not:

- duplicate the full shared `<head>`;
- load their own Tailwind browser runtime;
- load their own theme block;
- load local CSS;
- load `shared.js` or their surface runtime directly;
- mount independent Admin/Student/Exam page markup;
- create a separate component/design system.

This gives the product both stable route-specific HTML addresses and one real shared application shell.

---

## 3. Canonical surface routing

Canonical top-level surface state is:

```text
route=student
route=admin
route=exam
```

Canonical URLs are:

```text
index.html?route=student
index.html?route=admin&page=overview
index.html?route=admin&page=students&student=ST-2401&tab=exams
index.html?route=admin&page=exams&exam=ABC123&tab=results
index.html?route=admin&page=exams&exam=ABC123&tab=results&modal=attempt&attempt=ATTEMPT_HASH
index.html?route=admin&page=exams&modal=create-exam&step=3
index.html?route=exam&<existing-session-and-candidate-query-state>
```

Routing rules:

- missing `route` in `index.html` defaults safely to Student;
- unsupported `route` values normalize safely to Student;
- `admin.html` always forwards with `route=admin`;
- `student.html` always forwards with `route=student`;
- `exam.html` always forwards with `route=exam`;
- aliases preserve all unrelated required query parameters;
- Admin preserves nested `page`, record identifiers, `tab`, `modal`, `attempt`, `view`, and `step` state;
- Exam preserves the validated session/candidate query contract unless a separately approved migration changes it;
- meaningful navigation uses History API state so Back/Forward restores nested Admin pages and overlays predictably;
- canonical link construction is centralized rather than independently reimplemented by each surface.

Internally generated links should prefer canonical `index.html?route=...` URLs. The three surface HTML aliases remain supported for compatibility, bookmarks, and direct human navigation.

---

## 4. Route-aware runtime loading

The target contains exactly four local runtime JavaScript files:

- `prototype/js/shared.js`;
- `prototype/js/admin.js`;
- `prototype/js/student.js`;
- `prototype/js/exam.js`.

No `router.js`, `app.js`, `bootstrap.js`, or fifth local runtime file is introduced merely to support routing.

`index.html` owns the allowlisted route bootstrap:

1. parse and normalize `route`;
2. load `shared.js` first;
3. select only `student`, `admin`, or `exam` through an explicit allowlist;
4. load only the selected surface runtime;
5. expose normalized surface state without duplicating domain rules;
6. update document title/metadata when needed;
7. provide the common application root and accessible loading/failure state.

The route loader must never construct an arbitrary script URL directly from untrusted query text.

The alias HTML files do not load `admin.js`, `student.js`, or `exam.js` themselves; they forward into the index shell, which owns runtime selection.

---

## 5. Tailwind-only authored styling contract

Festacol-authored styling must be expressed through Tailwind CSS v4 utilities plus the Tailwind browser theme/configuration owned by `index.html`.

### 5.1 Zero repository CSS files

The final `/prototype` tree must contain zero repository `.css` files.

The current migration/removal targets are:

```text
prototype/assets/academic-v3.css
prototype/assets/festacol-admin.css
prototype/assets/festacol-foundation.css
prototype/assets/festacol.css
```

No replacement application stylesheet may be introduced under a different name or directory.

### 5.2 `index.html` owns the real theme/configuration

The canonical shell keeps head setup equivalent to:

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

The Google Fonts stylesheet is permitted only for font delivery.

The application must not recreate its design system in:

- local `.css` files;
- generated CSS assets;
- page-specific stylesheets;
- a second ordinary `<style>` block;
- app-authored `style="..."` attributes used as a styling escape hatch;
- CSSOM-injected application layout/component rules.

### 5.3 Tailwind authoring rules

Use Tailwind utilities for:

- layout and spacing;
- typography and color;
- borders, radius, rings;
- depth, elevation, and shadows;
- modal backdrop blur;
- focus, hover, active, and disabled states;
- responsive transformations;
- transitions and reduced-motion behavior.

Use complete utility class names. Arbitrary values are allowed where the approved UI system requires them.

Flowbite remains the component/interaction reference. Flowbite JavaScript 4.0.1 may provide interaction behavior, while the component markup carries its visual styling through Tailwind utilities. The target does not depend on a Flowbite CSS stylesheet.

ApexCharts may use chart-specific JavaScript visual options required by the library; surrounding application UI remains Tailwind-authored.

---

## 6. Dependency inheritance

`index.html` owns the dependency baseline inherited by all surfaces:

- DM Sans 400/500/600/700;
- Manrope 500/600/700/800;
- Tailwind CSS browser v4;
- the one shared `text/tailwindcss` theme/configuration block;
- Flowbite JavaScript 4.0.1;
- `shared.js` before the selected surface runtime.

ApexCharts exactly 3.46.0 and Simple-DataTables exactly 9.0.3 are available only where required by the selected surface if conditional loading can be done without introducing another local runtime file.

The three alias HTML files must not maintain divergent dependency heads.

---

## 7. Surface inheritance behavior

### Student

Canonical runtime surface:

```text
index.html?route=student
```

Compatibility alias:

```text
student.html?<query>
```

The alias preserves relevant query state, forces `route=student`, and forwards to `index.html`. `student.js` owns Student rendering and Exam ID UI after the canonical shell loads.

### Admin

Canonical runtime surface:

```text
index.html?route=admin&page=overview
```

Compatibility alias:

```text
admin.html?page=overview
```

The alias preserves Admin nested query state, forces `route=admin`, and forwards to `index.html`. `admin.js` owns the complete Admin rendering after the canonical shell loads.

### Exam

Canonical runtime surface:

```text
index.html?route=exam&<session/candidate state>
```

Compatibility alias:

```text
exam.html?<session/candidate state>
```

The alias preserves the full meaningful Exam query state, forces `route=exam`, and forwards to `index.html`. `exam.js` owns the candidate workspace after the canonical shell loads.

---

## 8. Consumer migration requirements

Before implementation changes URL generation, trace all current references to:

- `index.html`;
- `admin.html`;
- `student.html`;
- `exam.html`;
- session/QR URL builders;
- Exam ID resolution;
- copy/share examination links;
- `location.assign`, `location.replace`, `location.href`, and `new URL(...)` call sites;
- the four existing CSS filenames;
- `flowbite.min.css`.

The migration must distinguish:

- canonical application links, which should resolve through `index.html?route=...`;
- supported route aliases, which remain present and forward correctly;
- obsolete independent page-shell logic, which must be removed from the aliases.

No compatibility alias may silently lose a nested Admin query, Exam session identifier, candidate state, or other required parameter.

---

## 9. Permanent source-contract rules

After implementation, the Node/source audit must enforce all of the following:

1. `prototype/index.html` exists and is the canonical application shell.
2. `prototype/admin.html`, `prototype/student.html`, and `prototype/exam.html` also exist as required thin aliases.
3. the aliases do not contain full duplicated application UIs.
4. the aliases forward to the correct `index.html?route=...` surface while preserving required query state.
5. the aliases do not load local application CSS or independent page-specific runtime stacks.
6. exactly four local runtime JavaScript files remain: `shared.js`, `admin.js`, `student.js`, and `exam.js`.
7. no `.css` file exists under `prototype/`.
8. no Flowbite CSS stylesheet is loaded.
9. `index.html` contains the Tailwind browser v4 script.
10. `index.html` contains the required `style[type="text/tailwindcss"]` theme/configuration block.
11. route selection is allowlisted to Student/Admin/Exam.
12. unsupported route values cannot inject an arbitrary script path.
13. internally generated links resolve to canonical index routes unless a compatibility alias is intentionally being exercised.
14. nested Admin history and Exam query-state preservation remain intact.

The audit must **not** fail merely because `admin.html`, `student.html`, or `exam.html` exists; their continued presence is required.

---

## 10. Browser acceptance matrix

Dogfood must exercise both canonical and inherited alias paths.

Canonical paths:

```text
index.html?route=student
index.html?route=admin&page=overview
index.html?route=exam&<valid-session-state>
```

Alias paths:

```text
student.html
admin.html?page=overview
exam.html?<valid-session-state>
```

For each alias verify:

- it forwards to `index.html`;
- it selects the correct surface;
- required query state survives;
- no redirect loop occurs;
- no duplicate shell flashes or initializes;
- no local `.css` request occurs;
- the resulting UI uses the shared index head/theme/dependency contract.

Minimum viewports remain:

- 390×844 mobile;
- 820×1000 tablet;
- 1440×1000 desktop.

All prior UX, accessibility, modal, Stepper, nested navigation, responsive, and Back/Forward acceptance requirements remain binding.

---

## 11. Acceptance criteria

The correction is satisfied only when the eventual implementation and source contracts enforce all of the following:

1. `index.html` is the canonical application entry point and real base shell.
2. `admin.html`, `student.html`, and `exam.html` remain supported route aliases.
3. those aliases inherit from index by forwarding into the appropriate canonical route rather than duplicating the shell.
4. `route=student`, `route=admin`, and `route=exam` are canonical surface selectors.
5. alias forwarding preserves meaningful query state and cannot loop.
6. exactly four local runtime JavaScript files remain.
7. no fifth router/bootstrap local JavaScript file is added.
8. the final `/prototype` tree contains zero `.css` files.
9. Festacol-authored styling is Tailwind utility driven.
10. the shared Tailwind theme/configuration remains in the `index.html` head.
11. no second CSS component system is recreated through ordinary style blocks, inline style attributes, or CSSOM injection.
12. Admin nested navigation remains compatible with the approved deep-navigation contract.
13. Exam preserves the validated session/candidate query contract.
14. canonical and alias routes are both covered by source contracts and Dogfood.
15. the older requirements to delete the three surface HTML files are invalid and must not be followed.
16. the existing UI/UX governance, Flowbite component semantics, accessibility, responsive behavior, and validation gates remain binding.

**Status after this correction:** `PLANNED` only. Production implementation remains blocked until product-owner approval.
