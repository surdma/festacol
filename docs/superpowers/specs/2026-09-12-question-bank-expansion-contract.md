# Festacol Question Bank Expansion Contract

**Date:** 2026-09-12  
**Status:** Product-owner approved requirement  
**Applies to:** Task 5 of the Festacol prototype revamp

## Revised seed-bank target

The earlier “at least 500” requirement is raised to **at least 720 validated seed questions**.

The increase must improve usable inventory, not inflate a counter with filler or duplicate records. The final bank must maintain enough eligible inventory for realistic 5–150 question examinations across the supported purposes and student groups.

## Required distribution

The bank must cover:

- incoming SS1 Entrance/BECE readiness across every `q-*` subject;
- SS1 senior-secondary common/pathway subjects;
- SS2 common/pathway subjects;
- SS3 senior/external-practice subjects;
- Science, Arts, and Social Science pathway routing where academically applicable;
- every supported response type: `single`, `multi`, `boolean`, `fill`, and `fill-multi`.

No subject/level/mode/pathway combination advertised by the UI may have zero eligible questions.

## Quality requirements

Every seed question must have:

- unique integer `id`;
- `subject` and `subjectCode`;
- `domain`;
- `label` and `prompt`;
- explicit `levels`;
- explicit `pathways`;
- explicit `examModes`;
- `difficulty` (`easy`, `medium`, or `hard`);
- answer metadata matching its response type;
- an explanation suitable for teacher-side answer review.

Answer metadata is:

- `single` → `answer` contained in `options`;
- `boolean` → boolean `answer`;
- `multi` → `answers` matching `requiredSelections` and contained in `options`;
- `fill` / `fill-multi` → non-empty `acceptedAnswers`.

## Anti-filler rules

- Do not duplicate a prompt merely by changing its ID.
- Do not mark level-specific material as SS1–SS3 only to raise eligible counts.
- Do not mark Science-only material as Arts or Social Science compatible.
- Parameterized mathematics/science items must use materially different values and validated answers.
- Teacher-facing inventory numbers must be derived from the actual validated dataset.

## Validation gate

`prototype/scripts/prototype-audit.mjs` and `prototype/scripts/state-contract.mjs` must eventually fail on:

- fewer than 720 validated seed records;
- duplicate IDs;
- malformed answer metadata;
- unsupported response types;
- missing difficulty/pathway/level/mode metadata;
- advertised routing slices with zero eligible inventory;
- scoring that disagrees with the answer metadata.

This contract supersedes only the older numeric 500-question minimum. All other approved Question Bank requirements remain binding.
