---
phase: 179-ignite-b1-starting-point-fix
plan: 03
subsystem: ignite-front-door
tags: [b1, persona-first, role_blend, four-door, keyboard-contract, canon-part-2a, canon-part-3]
requires:
  - 179-01 (GA-4 card-fire interceptor -- the R-1 cure, enforces the card fires)
  - 179-02 (widened scratchpad whitelist -- role_blend + blueprint_family + hypothesis_text persist)
  - lib/core/persona-override.cjs ROLE_BLEND_KEYS (frozen 7-key vocab)
  - lib/core/shallow-doc-parser.cjs blendFromCanonicalRole (single-axis {key:1.0})
  - lib/core/navigation/room-birth.cjs (the byte-unchanged 7-step birth txn)
provides:
  - "the ONE canonical persona-first 4-door B1 card (Persona / CV / Hypothesis / Free-Text)"
  - "the {role_blend, blueprintFamily, arrival_asset} tuple per door, threaded to B2 birthRoom opts"
  - "the hypothesis-arrival arrival_asset value (Door 3 capture)"
  - "tests/test-b1-four-door-contract.cjs (the four-door contract proof)"
affects:
  - commands/ignite.md (B1 block rewritten)
  - tests/run-all-179.sh (W3 wired to the contract test)
tech-stack:
  added: []
  patterns:
    - "doctrine-contract test: read the markdown source, assert the load-bearing prose + frozen-vocab import"
    - "single-axis role_blend {key:1.0} drawn from the frozen ROLE_BLEND_KEYS (imported, never redefined)"
    - "unicode-escape dash detection so the test file is itself em-dash-free (Phase 175 self-consistency idiom)"
key-files:
  created:
    - tests/test-b1-four-door-contract.cjs
  modified:
    - commands/ignite.md
    - tests/run-all-179.sh
decisions:
  - "Door 3 (Hypothesis) sets arrival_asset=hypothesis-arrival + captures hypothesis_text this wave; the hypothesis blueprint family + truth-claim filing + abstraction gate land Waves 4-5 (per plan boundary)"
  - "Named the test tests/test-b1-four-door-contract.cjs (the plan's name) and repointed run-all-179.sh W3 from the placeholder tests/test-persona-first-b1-179.cjs to it (one canonical W3 suite)"
metrics:
  duration: ~12m
  completed: 2026-06-25
  tasks: 1
  files: 3
---

# Phase 179 Plan 03: Canonical Persona-First 4-Door B1 Card Summary

One-liner: ignite B1 is now ONE persona-first AskUserQuestion card with four doors (Persona / CV / Hypothesis / Free-Text), each resolving a single-axis `{role_blend, blueprintFamily, arrival_asset}` tuple threaded through the Wave-2 widened scratchpad whitelist into the byte-unchanged birthRoom contract, with the arrow-key single-select keyboard contract enforced (no ASCII-box-only render).

## What shipped

- **commands/ignite.md B1 rewrite.** The prose stopgap (6 personas + Paste-my-CV) became the ONE canonical 4-door card:
  - **Door 1 (Persona pick, default, single-select arrow-key):** six persona options, each `role_blend={key:1.0}` from the frozen `ROLE_BLEND_KEYS`, deriving `blueprintFamily` (researcher / student / domain_expert -> exploration; founder / operator / investor -> venture).
  - **Door 2 (CV, arrival_asset=cv-upload):** Phase 115 dual-path (detect_dual_path -> extract_shallow, reused verbatim); `role_blend` via `blendFromCanonicalRole` (single-axis); venture -> blueprintFamily=venture.
  - **Door 3 (Hypothesis, arrival_asset=hypothesis-arrival):** captures one falsifiable "I believe ___" (the `hypothesis_text`); routes `role_blend` if known, else empty -> frozen SECTION_NAMES default. The hypothesis family + truth-claim filing + abstraction gate are explicitly deferred to Waves 4-5.
  - **Door 4 (Free-Text):** the AskUserQuestion Other/free-text row; Larry interprets and routes to Doors 1-3; the routing is itself an arrow-key single-select card.
- **Keyboard / checkbox contract section (Canon Part 3 F.1, Phase 88.2 invariant):** every single-pick gate renders as an arrow-key single-select AskUserQuestion card; "no card, no picture" (SEED-021); the Wave-1 GA-4 interceptor catches a reached-gate-no-card turn. The frozen F.1 contract is honored, never redefined.
- **Scratchpad threading:** the `writeScratchpadBirthAnswer` call now threads `role_blend` + `blueprint_family` + `arrival_asset` + (Door 3) `hypothesis_text` through the Wave-2 widened whitelist so the B1 signal survives to B2.
- **tests/test-b1-four-door-contract.cjs** (23 checks): four doors named, each door's arrival_asset, the tuple, ROLE_BLEND_KEYS cited-not-redefined, the blueprintFamily derivation mapping, the writeScratchpadBirthAnswer threading, the keyboard contract prose, the frozen length-7 vocab import, and the em-dash sweep.
- **tests/run-all-179.sh** W3 repointed to the contract test.

## Acceptance (all green)

- `node tests/test-b1-four-door-contract.cjs` exits 0 -- 23/23.
- `git diff --quiet HEAD -- lib/core/navigation/room-birth.cjs` exits 0 (the 7-step birth txn + approvedBy gate byte-unchanged).
- `grep -nP '\x{2014}|\x{2013}' commands/ignite.md tests/test-b1-four-door-contract.cjs` -- zero matches (em-dash sweep clean).
- `bash tests/run-all-179.sh` -- Passed 7 / Failed 0 / Skipped 4, exit 0. Wave 1 (GA-4) green, Wave 2 (scratchpad whitelist) green, Wave 3 (4-door B1) now PASSING; frozen reach-ids (6) + posture-ids (3) drift fences green.
- `node scripts/check-render-coverage.cjs --check` exit 0 (R15 render gate OK; ignite stays a wired render surface).
- `node tests/test-ignite-on-runchain.cjs` 5/6 (no regression from the B1 edit -- the 1 non-pass is the pre-existing skip).
- Part 8 sweep on the B1 block: `role_blend` weights + `user_id` are LOCAL-only, never to Brain.

## TDD Gate Compliance

- RED: `d0be4713` -- `test(179-03): add failing 4-door B1 contract test` (8/23 fail against the stopgap).
- GREEN: `c3380f14` -- `feat(179-03): canonical persona-first 4-door B1 card + single-axis role_blend` (23/23).
- No REFACTOR commit needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test self-inconsistency: literal dash bytes in the em-dash detection regex**
- **Found during:** Task 1 (GREEN, em-dash acceptance sweep)
- **Issue:** the test's own no-em-dash detector used a literal `[em-dash en-dash]` character class, so `grep -nP` flagged the test file itself (the exact Phase 175 self-inconsistency).
- **Fix:** rewrote the character class to unicode escapes (the \u2014 / \u2013 char class) so the test file carries zero literal dash bytes while still detecting them in the B1 source.
- **Files modified:** tests/test-b1-four-door-contract.cjs
- **Commit:** c3380f14

**2. [Rule 3 - Blocking] run-all-179.sh W3 pointed at a placeholder filename**
- **Found during:** Task 1 (wiring the contract test into the aggregator)
- **Issue:** the Wave-1 scaffold aggregator guarded W3 with `tests/test-persona-first-b1-179.cjs`, but the plan names the suite `tests/test-b1-four-door-contract.cjs`; the contract test would have stayed a permanent SKIP.
- **Fix:** repointed the W3 `run_if` line to `tests/test-b1-four-door-contract.cjs` so the now-landed suite runs (W3 flips SKIP -> PASS).
- **Files modified:** tests/run-all-179.sh
- **Commit:** c3380f14

## Self-Check: PASSED

- FOUND: tests/test-b1-four-door-contract.cjs
- FOUND: commands/ignite.md (B1 block carries "Who are you arriving as" + all four doors)
- FOUND commit d0be4713 (RED)
- FOUND commit c3380f14 (GREEN)
