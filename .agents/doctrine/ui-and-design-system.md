# Doctrine: UI, component system, and visual quality

Owner of: product interface quality, shadcn usage, Tailwind CSS styling, tokens, themes,
component intent, responsive behavior, forms, accessibility, and visual verification.
Cited by: frontend engineer and reviewer.

## Product experience standard

Festacol is an operational examination workspace used under pressure — timed exams, live
candidate queues, results review. Its interface must feel deliberate, calm, legible, responsive,
and trustworthy.

Every material UI decision must support at least one of: information hierarchy, task completion,
status comprehension, error prevention or recovery, accessibility, responsive adaptation, or
consistency with the product system. Do not add decoration without purpose.

## Intent before implementation

Before building a page or material component, identify: the user's primary task, the
component's single responsibility, the most important content, primary and secondary actions,
every relevant state, reading and interaction order, mobile transformation, accessibility
contract, and the server data and outcomes it represents.

A component is not ready because its JSX can be written. It is ready when its purpose,
hierarchy, and behavior are clear.

## One UI owner

The frontend engineer owns both frontend implementation and UI/UX execution. Do not create a
second UI engineer, design-system engineer, or component engineer with overlapping source
ownership. Standards live in this doctrine; the frontend role executes them; the reviewer
validates them.

## shadcn-first component policy

The local shadcn system (`base-nova`, Tailwind v4, lucide icons) is the default foundation.

For every UI task:

1. inspect `components.json` and `src/components/ui` before adding anything;
2. use the existing primitive when it satisfies the need, and an existing variant before adding
   a new one;
3. compose primitives into a product component;
4. add a missing shadcn component non-interactively (`pnpm dlx shadcn@latest add <component>
   --yes`) only when necessary — if shadcn wants to overwrite an existing file, stop and
   inspect the local file first;
5. read the installed source after adding it.

Do not guess component APIs from memory.

## Components instead of custom markup

Feature code must use local shadcn components for established UI concepts: `Button`, `Input`,
`Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Field`/`FieldGroup` form structure,
`AlertDialog` for confirmations, `Dialog` for modal content, `Sheet`/`Drawer` for panels,
`DropdownMenu` menus, `Badge`/`Alert` status, `Skeleton`/`Spinner`/`Progress` loading, `Empty`
empty states, `sonner` toasts, `Separator`, `Table`, `ScrollArea`, `Tooltip`/`HoverCard`/`Popover`.

Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`, clickable `<div>`/`<span>`,
raw `<table>`, and raw `<hr>` are prohibited in feature and route code when a local primitive
exists. When touched code contains a raw reimplementation of a covered concept, correct it
within the changed scope instead of copying the violation.

Semantic HTML still applies: `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`,
`<article>`, headings, paragraphs, and lists express document meaning. A plain `div`/`span` may
be a non-interactive layout wrapper but must not become a hand-built control.

## Custom product components

A custom product component composes shadcn primitives and represents a stable Festacol concept:
`MetricCard`, `StatusBadge`, `ExamIdDialog`, `AccessDenied`, `EmptyState`, `LiveExamNotice`,
`ExamStatusWatch`. They must not fork the behavior of the primitives they compose.

Do not create generic visual wrappers (`FancyCard`, `DataBox`, `UniversalModal`). Name
components after product meaning. Use `class-variance-authority` variants named by purpose
(`status`, `density`) rather than color names, and prefer composition over boolean-prop
proliferation.

## Tailwind CSS and token-only styling

Feature and component styling uses Tailwind utilities and semantic design tokens. Do not create
`*.module.css`, component `.css` files, styled-jsx, CSS-in-JS, inline `style` props,
hand-authored `<style>` tags, or JS style objects. The only approved CSS surface is
`src/app/globals.css` and the established Tailwind configuration — reusable tokens, base rules,
or keyframes only.

Token rules: semantic classes (`bg-background`, `text-foreground`, `text-muted-foreground`,
`border-border`, `text-destructive`); no raw hex/RGB/HSL, no raw palette classes
(`bg-blue-500`), no arbitrary color values, no manual `dark:` corrections when tokens cover
both themes; `cn()` for conditional classes; `gap-*` (not `space-x/y-*`) for child spacing;
`size-*` for square dimensions; built-in shadcn variants before ad hoc overrides.

## Theme, hierarchy, responsive, forms, accessibility

- Light and dark themes are independent design states. Verify contrast (WCAG AA: 4.5:1 normal
  text, 3:1 large text and meaningful boundaries), readable muted text, distinguishable
  surfaces, meaningful status colors, visible focus, and distinguishable charts in both themes.
  Status is never color alone — pair it with text, icon, shape, or position.
- One clear primary action per region. Typography, spacing, grouping, and alignment before
  borders and cards; do not wrap every section in a `Card`. Tabular figures for scores, times,
  and percentages. Icons support recognition, never replace unclear labels; icon-only controls
  need an accessible name.
- Mobile-first. Verify 360×640 minimum resilience, 375×812 mobile, 768×1024 tablet, 1280×800
  desktop, and a short desktop viewport for dialogs/sheets. No page-level horizontal overflow;
  wide tables scroll in a named container; touch targets ≥ 44×44 where practical; primary
  actions stay discoverable; content stays readable at zoom.
- Forms use the shadcn `FieldGroup`/`Field` composition with visible labels, `data-invalid` +
  `aria-invalid` validation states, duplicate-submission guards, drafts preserved where the
  product requires, first-invalid-field focus, and stable server errors near the relevant
  action. Frontend validation never replaces server validation.
- Every interactive element is keyboard reachable with visible focus following visual order;
  overlays trap and restore focus; Escape closes dismissible overlays; async status uses
  live regions; motion respects `prefers-reduced-motion`; headings describe page structure.

## Required UI states

Every data-backed surface implements every relevant state: initial and slow loading, empty or
first-run, one and many, partial or insufficient data, validation error, recoverable API error,
unauthorized or expired session, forbidden action, API unavailable/offline, mutation
in-flight and success, destructive confirmation, long text and constrained space. Do not invent
a server state; do not ignore one the server models.

## Visual verification

For every material UI change: inspect the real route before editing; compare against the stated
task; inspect both themes; test required viewports; use keyboard-only interaction; inspect
focus, labels, and announcements; check console and network; confirm no hydration warning, no
clipped overlay, no page overflow; capture before/after evidence when materially visual.
