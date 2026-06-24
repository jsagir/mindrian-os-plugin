---
phase: 179-ignite-b1-starting-point-fix
plan: 06
subsystem: ignite-b1-front-door
tags: [ignite, cv-second-select, multiSelect, engine-1, auto-fire, decision-gate, part-3, part-8, part-10]
wave: 6
requires:
  - commands/ignite.md (Door 2 CV path, Waves 1-5)
  - lib/core/shallow-doc-parser.cjs (extractDomains, Phase 155-07)
  - lib/hmi/selector-dispatcher.cjs (SEED-020 multiSelect archetype, Phase 148-03)
  - commands/explore-domains.md (Engine 1 / Act 1 decomposition, shipped)
provides:
  - "Door 2 CV-second-select multiSelect:true CHECKBOX domain gate over extractDomains()"
  - "arrival auto-fire-Engine-1-then-gate doctrine (auto-fire the math, gate the results)"
  - "tests/test-cv-multiselect-and-engine1.cjs + Wave-6 aggregator loader"
affects:
  - commands/ignite.md
tech-stack:
  added: []
  patterns:
    - "REUSE extractDomains verbatim (no rebuild of domain extraction)"
    - "REUSE /mos:explore-domains verbatim (no clone of the decomposition engine)"
    - "thin-loader aggregator pattern (Wave-5 test-abstraction-gate-179.cjs idiom) so run-all-179.sh un-SKIPs Wave 6"
key-files:
  created:
    - tests/test-cv-multiselect-and-engine1.cjs
    - tests/test-cv-multiselect-179.cjs
  modified:
    - commands/ignite.md
decisions:
  - "CV-second-select is a multiSelect:true CHECKBOX (Req 4 + Req 12), routed through the SEED-020 selector-dispatcher archetype, distinct from the single-select doors (multiSelect:false)"
  - "Auto-fire-then-gate: arrival auto-fires the Act 1 triple-filter math (Part 10 sub-claim 5) but the findings surface at the next Decision Gate (B3) for APPROVE/REJECT/DEFER (Part 3), never silently cascaded"
  - "Engine 1 findings gate at B3 (the first in-room Decision Gate) as candidate Opportunity Bank ADDs; only an explicit APPROVE cascades them"
metrics:
  duration: "~12 min"
  completed: 2026-06-25
  tasks: 1
  files: 3
---

# Phase 179 Plan 06: CV-second-select multiSelect + auto-fire Engine 1 Summary

Door 2 (CV) now fires a Shape F multiSelect:true CHECKBOX over extractDomains() output recording 2-3 domain picks, and arrival auto-fires the Engine 1 triple-filter math with results surfaced at a Decision Gate (never auto-cascaded); the Wave-6 proof suite is green.

## What was built

**Task 1 (commit 41bdbcda):** Two coupled doctrines added to `commands/ignite.md`, plus the proof suite.

1. **CV-second-select domain multiSelect (Req 4 + Req 12).** Added to the Door 2 block, immediately after the existing Phase 115 dual-path parse and reflect-back: after `detect_dual_path -> extract_shallow`, the doctrine calls `extractDomains` (reused VERBATIM from `lib/core/shallow-doc-parser.cjs`) to pull up to 8 audited domain handles, then fires a Shape F `multiSelect:true` CHECKBOX AskUserQuestion card titled "which 2-3 domains pull you?" routed through the SEED-020 selector-dispatcher (archetype `multiSelect` -> `{ multiSelect: true }`). The card is arrow-key navigable, allows multiple picks (distinct from the single-select doors), never renders as an ASCII box only (SEED-021 / GA-4 interceptor), and records the navigator's 2-3 picks to the scratchpad via `writeScratchpadBirthAnswer` (the Wave-2 widened whitelist). Best-effort: zero handles -> skip the multiSelect and proceed.

2. **Arrival auto-fire-Engine-1-then-gate (Req 8).** Added a dedicated "Auto-fire the Engine 1 math; gate the results" section before Gate B2. On arrival (persona/CV/hypothesis), the Act 1 triple-filter math (decomposition / whitespace / reverse-salient) auto-fires WITHOUT an explicit command (Part 10 sub-claim 5), run via `/mos:explore-domains` (reused, not cloned). The findings are NEVER silently cascaded: per Part 3 + Part 2 Engine 1, they surface at the next Decision Gate (B3, the first in-room F.1 gate) as candidate Opportunity Bank ADDs for APPROVE / REJECT / DEFER. Auto-fire the math; gate the results.

3. **Proof suite.** `tests/test-cv-multiselect-and-engine1.cjs` (8 deterministic assertions, no LLM/network): extractDomains is real on a generic CV fixture (>= 1 audited handle, capped at 8); Door 2 renders the multiSelect:true CHECKBOX over extractDomains output with the 2-3-picks-to-scratchpad contract; the arrival auto-fire doctrine is present (explore-domains reused, fires without an explicit command, names the triple-filter); the gate-not-auto-write contract (Decision Gate + APPROVE/REJECT/DEFER + "never auto-written"); the selector-dispatcher multiSelect archetype yields `{ multiSelect: true }` (real code, distinct from `select` -> `{ multiSelect: false }`); Part 8 LOCAL-only sweep; and an em-dash/en-dash sweep. A thin aggregator loader `tests/test-cv-multiselect-179.cjs` (Wave-5 idiom) un-SKIPs Wave 6 in `run-all-179.sh`.

## Verification

- `node tests/test-cv-multiselect-and-engine1.cjs`: 8 passed, 0 failed, exit 0.
- `bash tests/run-all-179.sh`: 10 passed, 0 failed, 1 skipped (only Wave 7, not in this plan), exit 0. Waves 1-5 stayed green; Wave 6 flipped from SKIP to PASS.
- `grep -c 'multiSelect' commands/ignite.md` = 2; `grep -c 'extractDomains' commands/ignite.md` = 3.
- `grep -nP '\x{2014}|\x{2013}'` over `commands/ignite.md` + both test files: zero matches (no em-dashes / en-dashes).
- Part 8 sweep: no new Brain egress lines; the CV-second-select picks are audited (auditQueryString) and LOCAL; no CV text / user_id / role_blend weights cross to Brain.
- No file deletions in the commit.
- Pre-commit hooks passed (command-registry OK, connector-registry OK, orchestration-projection OK).
- No new reach / edge / node / posture minted; frozen Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 gate, 6-reach bank) untouched (carried reach-ids-drift + posture-ids-drift fences stay green).

## Deviations from Plan

**1. [Rule 3 - Blocking] Test filename reconciled to the run-all-179.sh wiring.**
- **Found during:** Task 1 (authoring the test).
- **Issue:** The plan's `<verify>` and `files_modified` name the test `tests/test-cv-multiselect-and-engine1.cjs`, but the shipped `tests/run-all-179.sh` keys the Wave-6 `run_if` guard off `tests/test-cv-multiselect-179.cjs`. Authoring only the plan-named file would leave Wave 6 permanently SKIPPED (the aggregator would never un-SKIP it), so the phase gate could never flip Wave 6 to PASS.
- **Fix:** Authored the canonical test under the plan's name (`tests/test-cv-multiselect-and-engine1.cjs`, all 8 assertions) AND added a thin aggregator loader `tests/test-cv-multiselect-179.cjs` that `require()`s it. This mirrors the EXACT precedent the Wave-5 plan set (`tests/test-abstraction-gate-179.cjs` is a thin loader for the canonical `tests/test-abstraction-gate.cjs`). Both files committed; Wave 6 now flips to PASS.
- **Files modified:** tests/test-cv-multiselect-and-engine1.cjs (new), tests/test-cv-multiselect-179.cjs (new).
- **Commit:** 41bdbcda.

No other deviations. The Door 2 multiSelect doctrine and the auto-fire-then-gate doctrine were implemented exactly as the plan's `<action>` specified.

## Self-Check: PASSED

- `commands/ignite.md` -- FOUND (modified, tracked).
- `tests/test-cv-multiselect-and-engine1.cjs` -- FOUND.
- `tests/test-cv-multiselect-179.cjs` -- FOUND.
- Commit `41bdbcda` -- FOUND in git log.
