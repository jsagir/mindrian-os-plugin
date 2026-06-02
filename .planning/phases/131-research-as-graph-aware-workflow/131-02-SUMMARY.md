---
phase: 131
plan: 02
subsystem: research-pipeline / context-extraction
tags: [research, source-lens, pre-flight, context-summary, lens-set, navigation-chokepoint, tdd]
requires:
  - Phase 131-01 research-preflight.cjs getResearchPreflight (the batched Stage-1 8-input read this plan consumes ONCE)
  - Phase 131-01 navigation.cjs re-export of getResearchPreflight (the single door)
  - Phase 130 lens-engine.cjs readRoleBlend idiom (the persona-aware framing hook mirrored here)
  - Phase 115 USER.md role_blend (delivered BY the pre-flight; the extractor never opens USER.md itself)
  - Canon Part 2a (role-blend x journey-stage framing) + Part 5 (evidence-tier gap framing)
provides:
  - "extractContext({roomDir, sessionId, topic, db}): the Stage 1+2+3 pass -> { ok, context_summary, lens_set, preflight }"
  - "computeLensSet(preflight): the context-derived ordered [{lens, weight}] source-lens set (Stage 3 rules)"
  - "renderContextSummary: the Body Shape A Larry-voiced one-paragraph context summary (module-private)"
affects:
  - Plan 131-03 source-lens driver (consumes lens_set to order the Phase 130.5 corpus fetch by priority)
  - Plan 131-05 command orchestration (surfaces context_summary before fetching)
tech-stack:
  added: []
  patterns:
    - "pure-over-navigation reader (zero node:sqlite require -> zero substrate bypass; caller-owned db handle forwarded verbatim)"
    - "composition-not-duplication (one batched getResearchPreflight read; the extractor never re-reads the room)"
    - "ordered-Map lens accumulator (first-insertion order + additive weight bump, context-derived not hardcoded)"
    - "dominant-role framing (Canon Part 2a) over the pre-flight-delivered role_blend tuple"
    - "RED-first behavior suite with a getResearchPreflight call-count spy (proves ONE batched read)"
key-files:
  created:
    - lib/core/research-context-extractor.cjs
    - tests/test-131-context-extractor.cjs
  modified: []
decisions:
  - "Stages 2 (summary) + 3 (lens set) COLLAPSE into one reasoning pass over the single Stage-1 batched read (4.8 re-baseline; 131-REVIEW-4.8 section 2)."
  - "The context summary renders as Body Shape A (one conversational paragraph), NOT Body Shape E (131-CONTEXT open-decision 3, RESOLVED recommend)."
  - "computeLensSet is context-derived via an ordered Map of rules (section gap / JTBD / role_blend), proven not-hardcoded by INEQUALITY across two contrasting preflights; the cold-room Tier-0 floor is scholarly-only."
  - "The extractor is read-only over the pre-flight: it makes ZERO corpus fetches (Plan 03 owns the fetch + pre-egress audit) and ZERO Brain calls; the summary is LOCAL-only per Canon Part 8."
metrics:
  duration: ~12m
  completed: 2026-06-01
---

# Phase 131 Plan 02: Stage 1+2+3 Research Context Extractor Summary

Shipped `research-context-extractor.cjs`: a pure-over-navigation module that calls the Plan-01 batched `getResearchPreflight` exactly ONCE, renders a Body Shape A Larry-voiced context summary framed by the dominant persona role, and computes a context-derived ordered weighted source-lens set, all in a single pre-flight-plus-plan pass. This is the explicit moment research becomes context-aware rather than blind; the Plan 03 driver consumes the lens set and the Plan 05 command surfaces the summary.

## What shipped

| Surface it extends (Canon Part 7) | What | Where |
|---|---|---|
| EXTENDS Plan 01 navigation.getResearchPreflight (the batched Stage-1 read) | extractContext: the Stage 1+2+3 single pass | `lib/core/research-context-extractor.cjs` extractContext |
| NEW pure helper (Stage 3 rule set) | computeLensSet: context-derived ordered [{lens, weight}] | `lib/core/research-context-extractor.cjs` computeLensSet |
| MIRRORS Phase 130 lens-engine readRoleBlend framing idiom | renderContextSummary: Body Shape A, dominant-role voice | `lib/core/research-context-extractor.cjs` (module-private) |

## The lens-set rules (131-CONTEXT Stage 3, computed not hardcoded)

| Context trigger | Lens added | Weight |
|---|---|---|
| current_section is a financial-model gap | scholarly + industry + patent | 1.0 / 0.8 / 0.6 |
| active_jtbd is thesis-build | brain (methodology chain) | 0.7 |
| role_blend has investor weight | competitive-intelligence | 0.7 |
| role_blend has researcher weight | scholarly (bump, seeds if absent) | +0.2 |
| role_blend has founder.grant weight | grants | 0.8 |
| cold room (no rule fires) | scholarly only (Tier-0 floor) | 1.0 |

The set is proven context-derived by INEQUALITY: a financial-model + thesis-build + investor preflight and a cold preflight produce two different ordered lists (`notDeepEqual`), so it can never be a fixed list.

## Commits

| Task | Type | Hash | Subject |
|---|---|---|---|
| 1 (RED) | test | `f306a840` | RED suite for the Stage 1+2+3 context extractor (7 assertions, 0/7 RED) |
| 2 (GREEN) | feat | `473365e5` | research-context-extractor (Stage 1+2+3 in one pass); 7/7 GREEN |

## Test results

- `node tests/test-131-context-extractor.cjs` -> 7/7 GREEN (was 0/7 RED at Task 1, as required: extractor absent).
- `bash tests/run-all-131.sh` -> 2 passed (substrate + context-extractor), 0 failed, 4 skipped (the not-yet-created Plan 03/04/05 suites skip-with-note; the aggregator stays runnable in every wave).
- `bash tests/run-all-130.sh` -> 4/4 GREEN (zero regression on the lens-engine substrate).
- `bash tests/run-all-130.7.sh` -> 7/7 GREEN (correlation-id contract intact).
- `node tests/test-navigation-acceptance.cjs` -> 1/1 GREEN (the zero-non-SQLite-reads invariant still holds).
- `node scripts/check-substrate.cjs --baseline` -> CLEAN on research-context-extractor.cjs (no bypass; caller-owned db handle, zero node:sqlite require).
- Em-dash scan on the new module -> zero. Zero-Python grep -> 0.

## The 7 assertions (Task 1 -> Task 2)

1. extractContext calls getResearchPreflight EXACTLY ONCE (spy-counted; one batched read, never 8 sequential).
2. context_summary is a single Body Shape A paragraph (no Shape E header, no selector block, no blank-line break) naming the active workflow + JTBD + current section + evidence-gap count.
3. computeLensSet is context-derived (two contrasting preflights differ) and the hot set carries scholarly + industry + patent + brain + competitive-intelligence with differentiated weights.
4. a founder.grant role_blend adds the grants lens.
5. a cold / null preflight yields a scholarly-only Tier-0 default + a graceful summary, never a throw.
6. integration: extractContext over a REAL seeded room drives the genuine navigation.getResearchPreflight (chokepoint is the only door, end to end).
7. source hygiene: zero em-dashes, zero external-process surface, zero node:sqlite require, navigation-only door.

## HARD-GATE confirmation

- **ZERO live Brain writes.** The extractor makes no Brain calls. It is read-only over the pre-flight the navigation chokepoint already produced; the summary is LOCAL-only (rendered to the user, never sent to Brain) per Canon Part 8. brain_impact: NONE-NEW honored.
- **ZERO new dependencies.** No npm/pip/cargo install. Native `node:` built-ins + existing modules (navigation.cjs) only. No corpus fetch (Plan 03 owns the fetch + the inherited 130.5 pre-egress audit).
- **navigation.cjs is the only door.** The extractor requires navigation.cjs ONLY for room.db access, forwards a caller-owned db handle verbatim to getResearchPreflight, and carries zero direct node:sqlite / room-db.cjs require. The substrate guard returns clean on it.
- **Substrate guard + brain-boundary-scan passed on every commit** (no `--no-verify`; the Phase 128 substrate guard + brain-boundary-scan pre-commit hooks ran on both commits).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hygiene test false-positive on a block-comment prose mention**
- **Found during:** Task 2 (GREEN run; test7_sourceHygiene failed 6/7).
- **Issue:** The hygiene scan stripped only `//` line-comments, so the literal token in the module-header `/* */` prose line documenting what the module does NOT do (external-process invocations) tripped the forbidden-surface regex even though there is zero executable child_process/spawn/Python code.
- **Fix:** (a) extended the test's comment-stripping to also remove `/* ... */` block comments before scanning, so the scan tests executable surface not prose; (b) rephrased the module-header prose to "external-process invocations" so the plan's own coarse line-comment-only verification grep (`grep -v '^[[:space:]]*//' ... | grep -cE "child_process|spawn|\.py"`) also returns 0 cleanly. The invariant (zero executable Python/process surface) is genuinely true and remains self-documenting.
- **Files modified:** lib/core/research-context-extractor.cjs (header prose), tests/test-131-context-extractor.cjs (comment strip).
- **Commit:** `473365e5` (both fixes landed in the GREEN commit).

No other deviations. No architectural changes (Rule 4 not triggered). No auth gates. No package installs.

## Self-Check: PASSED

- FOUND: lib/core/research-context-extractor.cjs
- FOUND: tests/test-131-context-extractor.cjs
- FOUND commit: f306a840
- FOUND commit: 473365e5
- Stub scan: none (no TODO / FIXME / placeholder / hardcoded-empty surface).
