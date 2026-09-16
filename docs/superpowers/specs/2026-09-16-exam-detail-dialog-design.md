# Exam Detail Dialog Redesign — 2026-09-16

## Context
`src/components/admin/detail-dialogs.tsx:ExamDetailDialog` (opened via `/admin/exams?modal=exam&exam=`).
Before: 4 MetricCards + candidate-access card + 4 bordered detail boxes + cohost card + activity card = card-heavy. QR missing despite `sharePath` + `qrcode.react` dependency. Only "Copy exam link", no Exam ID copy, no social share.

## Decision (approved)
Approach A — lean 2-col, divider-based, distribution-first. Rejected B (tabbed, hides context) and C (single-column, wastes desktop space).

## Layout
- `DialogContent sm:max-w-3xl` (was 5xl).
- Header: title + StatusBadge, description `audience · subjects`, Exam ID row `code + Copy ID` (copiedId state).
- Stat strip: single `dl flex divide-x border-y` — Questions / Duration / Attempts(submitted/total) / Camera. No cards.
- Main `grid sm:grid-cols-[180px_1fr]`:
  - Left QR: `QRCodeSVG value={origin+sharePath}` in single bordered white box, "Scan to open · Rev N", `QR PNG` (SVG→canvas→PNG download) + `Open` (new-tab).
  - Right Distribute: link row + `Copy link`, hint "Raw URL stays hidden", `Share` (navigator.share fallback copy) + via WhatsApp / Telegram / X / Email icon buttons (`wa.me`, `t.me/share`, `twitter/intent`, `mailto:` with title+URL+Exam ID), manage row Edit / Open-Close / Duplicate / Delete(ghost destructive), locked hint.
- Details: `dl divide-y border-y` rows Mode / Integrity threshold / Instructions. No boxes.
- Cohost: `<details>` collapsible wrapping lean CohostManager (card chrome removed).
- Activity: plain `divide-y` list, header with submitted/active counts.

## Share contracts
- `shareUrl = origin + sharePath` (absolute, scannable off-device).
- `shareText = {title} — join here {url} (Exam ID: {id})`.
- Download: serialize QR SVG → Image → 640px canvas → `{examId}-qr.png`.
- a11y: aria-labels on icon buttons, role=alert errors, keyboard-focus preserved via Dialog primitive.

## Verification
- `pnpm tsc --noEmit` passes.
- Biome `useAnchorContent` warnings on `Button render={<a/>}` are pre-existing pattern (same as before), not new.
