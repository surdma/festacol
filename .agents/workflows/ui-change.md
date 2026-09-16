# Workflow: UI change

Use when presentation, component composition, interaction, responsive behavior, theme, or
accessibility changes without changing server behavior, authorization, persistence, or data
shapes.

## Sequence

```text
orchestrator ├── frontend engineer ├── reviewer
```

Use the planner only for a large multi-route redesign, a new product-wide visual system, or a
specification requiring staged work.

## Procedure

### 1. Observe

The frontend engineer: opens the real surface; identifies the user task and current hierarchy;
records relevant viewports, themes, states, and interaction behavior; inspects local shadcn
primitives, tokens, and related product components; confirms the existing server shape supports
the desired behavior.

### 2. Define intent

Before coding, define: primary user task; primary action; information order; component
responsibilities; state behavior; responsive transformation; accessibility and keyboard
behavior; intended theme and contrast behavior.

Do not implement a visual treatment with no product rationale.

### 3. Implement

- Keep Server Components as the default; add a Client Component only at the interaction boundary.
- Use existing shadcn primitives first; add missing ones through the project-aware CLI only when
  required.
- Compose intentional product components from shadcn primitives.
- Replace touched raw interactive reimplementations with the correct local primitive.
- Use Tailwind utilities and semantic tokens only — no component CSS, CSS-in-JS, or inline styles.
- Preserve unrelated behavior and structure.
- Implement all relevant loading, empty, error, disabled, pending, long-content, responsive,
  and theme states.
- Use explicit variants and composition rather than boolean-prop expansion.

### 4. Verify

Run applicable Biome/lint, typecheck, React diagnostics, and production build. Verify:
360×640 minimum, 375×812, 768×1024, 1280×800, and short-viewport behavior; light and dark
themes; WCAG AA contrast; keyboard navigation and focus; accessible names, labels,
descriptions, and announcements; reduced motion; no overflow, clipping, hydration warning,
console error, or failed request; the real route and all relevant states.

Capture before/after evidence for material visual changes.

### 5. Review

The reviewer evaluates the UI against the user task, design-system rules, component
architecture, responsive behavior, accessibility, and verification evidence — not personal
taste.

## Escalation

If the UI change requires new server data, a mutation, different authorization, or a changed
data shape, stop the UI-only workflow and use [feature](feature.md). Do not smuggle server
behavior into the browser, invent a local shape, or fake completion with fixtures.
