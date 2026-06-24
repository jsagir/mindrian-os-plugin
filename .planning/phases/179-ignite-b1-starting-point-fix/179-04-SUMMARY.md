---
phase: 179-ignite-b1-starting-point-fix
plan: 04
subsystem: ignite-b1-starting-point
tags: [hypothesis-family, truth-claim, per-role-framing, blueprint-ci-gate, door-3, part-9, part-5, part-8]
wave: 4
requirements: [REQ-05, REQ-07]
canon_parts: [2a, 5, 8, 9]
requires:
  - data/room-blueprints.json (the 8 prior families)
  - scripts/check-room-blueprints.cjs (the 8-family CI gate)
  - lib/core/navigation/typed-claim.cjs (writeClaimNode)
  - commands/ignite.md (Door 3, authored Wave 3)
  - lib/core/room-skeleton-scaffold.cjs (resolveBlueprint / SECTION_NAMES)
provides:
  - the hypothesis blueprint family (9th)
  - the 9-family CI gate accepting the assumptions slug
  - the Door 3 truth-claim filing doctrine (writeClaimNode at review_status proposed)
  - the per-role hypothesis framing map (researcher/founder/investor + generic fallback)
affects:
  - data/room-blueprints.json
  - scripts/check-room-blueprints.cjs
  - commands/ignite.md
tech-stack:
  added: []
  patterns:
    - atomic lockstep (family add + CI-gate 8->9 + valid-slug extension in one commit)
    - data family, NOT a frozen-set move (Part 11; no edge/node/reach minted)
    - writeClaimNode at review_status proposed (Part 9 role 5)
key-files:
  created:
    - tests/test-hypothesis-family-and-claim.cjs
    - tests/test-hypothesis-blueprint-family-179.cjs
  modified:
    - data/room-blueprints.json
    - scripts/check-room-blueprints.cjs
    - commands/ignite.md
decisions:
  - "Hypothesis family section set LOCKED (CONTEXT decision 3): problem-definition + assumptions + opportunity-bank; no dedicated hypotheses section"
  - "assumptions extended into EXTENDED_VALID_SLUGS_FOR_CHECK exactly like opportunity-bank (non-frozen slug, scaffold-skipped, CI-accepted)"
  - "the I-believe hypothesis files as knowledge_type 'assumption' (the matching DIKW enum member) at review_status proposed"
  - "per-role framing reuses the Door 1 role_blend; researcher=testable claim, founder=market bet, investor=thesis precondition, empty=generic"
metrics:
  duration_sec: 184
  tasks: 2
  files_changed: 5
  completed: 2026-06-25
---

# Phase 179 Plan 04: Hypothesis Blueprint Family + Truth-Claim Filing + Per-Role Framing Summary

The hypothesis Door 3 gets its home (the 9th blueprint family) and its legitimacy (the captured "I believe ___" files as a proposed truth-claim, never auto-confirmed), and its prompt frames per the captured role_blend.

## What shipped

**Task 1 (TDD) -- the hypothesis family + the 9-family CI gate, one atomic lockstep.**
- `data/room-blueprints.json` carries a `hypothesis` family: LOCKED sections `[problem-definition, assumptions, opportunity-bank]`, default_methodologies `[structure-argument, challenge-assumptions, validate, research]`, arrival_asset `hypothesis-arrival`.
- `scripts/check-room-blueprints.cjs`: `EXPECTED_FAMILY_COUNT` 8 -> 9, `hypothesis` added to `EXPECTED_FAMILIES`, `EXTENDED_VALID_SLUGS_FOR_CHECK` extended with `assumptions` (mirroring the `opportunity-bank` precedent + its explanatory comment). The PASS message + the docstring now read the dynamic count.
- The family add and the gate move land in the SAME commit (`8f778e69`) so the pre-commit hook never fails mid-wave; `node scripts/check-room-blueprints.cjs --check` exits 0 at 9 families.
- The frozen `SECTION_NAMES` table in `lib/core/room-skeleton-scaffold.cjs` is byte-unchanged (`git diff --quiet HEAD` exits 0). The scaffold resolves the hypothesis family (`resolveBlueprint('hypothesis')` yields problem-definition; the non-frozen assumptions + opportunity-bank slugs skip gracefully).

**Task 2 -- Door 3 truth-claim filing doctrine + per-role framing.**
- `commands/ignite.md` Door 3 now files the captured `hypothesis_text` via `writeClaimNode` (knowledge_type `assumption`, review_status `proposed`); cites Part 9 role 5 (never confirmed without a human byUser), Part 5 (initial evidence tier None/Practitioner), and Part 8 (LOCAL only, never to Brain; rides the Wave-2 scratchpad whitelist for B2 replay).
- The per-role framing map auto-selects from the Door 1 role_blend: researcher -> testable claim, founder -> market bet, investor -> thesis precondition; empty/unknown role_blend -> generic "I believe ___ because ___".
- Door 3 now resolves `blueprintFamily` to the `hypothesis` family.

## Proof suite

`tests/test-hypothesis-family-and-claim.cjs` (9 checks, all green):
- family shape (locked sections + methodologies + arrival_asset), exactly 9 families (8 prior preserved), `check-room-blueprints --check` exits 0, the assumptions slug is referenced, the scaffold resolves the family, frozen SECTION_NAMES untouched.
- Door 3 cites writeClaimNode at review_status proposed + byUser/human; names all three per-role framings + the generic fallback.
- writeClaimNode against an in-memory room.db (knowledge_type assumption) writes review_status `proposed` and a re-file does NOT reach `confirmed` (the no-auto-confirm invariant).

`tests/test-hypothesis-blueprint-family-179.cjs` is the aggregator-named thin loader so `tests/run-all-179.sh` un-SKIPs Wave 4.

## Gate results

| Gate | Result |
|------|--------|
| `tests/test-hypothesis-family-and-claim.cjs` | 9/9 PASS |
| `bash tests/run-all-179.sh` | 8 pass / 0 fail / 3 skip (Waves 1-4 green; Waves 5-7 RED-by-design SKIP) -- exit 0 |
| `node scripts/check-room-blueprints.cjs --check` | exit 0 (9 families) |
| `node scripts/check-render-coverage.cjs --check` | exit 0 (no reach/node/edge minted) |
| reach-ids-drift (frozen 6) / posture-ids-drift (frozen 3) | PASS |
| em-dash sweep (all touched files) | clean |
| frozen SECTION_NAMES byte-unchanged | git diff --quiet exits 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aggregator filename mismatch.**
- **Found during:** Task 1 (test authoring).
- **Issue:** The plan names the test `tests/test-hypothesis-family-and-claim.cjs`, but `tests/run-all-179.sh` keys the Wave-4 suite off `tests/test-hypothesis-blueprint-family-179.cjs` (a `run_if` file-existence guard). Authoring only the plan-named file would leave Wave 4 permanently SKIPPED in the phase gate.
- **Fix:** Authored the canonical assertions in the plan-named file (used by both tasks' `<verify>`) and added a thin loader at the aggregator-expected path that `require`s it. No assertion duplication; Wave 4 un-SKIPs and flips to PASS.
- **Files modified:** tests/test-hypothesis-family-and-claim.cjs, tests/test-hypothesis-blueprint-family-179.cjs.
- **Commit:** b0f42d93 (RED).

**2. [Rule 1 - Correctness] Stale hardcoded "8 families" strings in the CI gate.**
- **Found during:** Task 1 (GREEN).
- **Issue:** The PASS message and the top docstring hardcoded "8" independently of `EXPECTED_FAMILY_COUNT`; moving the count to 9 would print a misleading "8 families" on success.
- **Fix:** PASS message now interpolates `EXPECTED_FAMILY_COUNT`; the docstring references the constant and notes the 155-05 -> 179-04 move.
- **Files modified:** scripts/check-room-blueprints.cjs.
- **Commit:** 8f778e69 (GREEN).

## Out of scope / not touched

- The instances-vs-structures abstraction gate (Wave 5), the CV multiSelect + auto-fire Engine 1 (Wave 6), the B1-spec reconciliation (Wave 7) -- RED-by-design SKIP in run-all-179.sh until their waves land.
- No new edge/node/reach type minted; frozen Part 3 + Part 4 contracts unchanged (the hypothesis family is DATA per Part 11).

## Known Stubs

None. The hypothesis family is fully wired (CI-green, scaffold-resolving); Door 3 files the truth-claim and frames per role. The downstream abstraction gate is a separate wave, documented as RED-by-design in the phase aggregator, not a stub in this plan's surface.

## TDD Gate Compliance

- RED `b0f42d93` (test): failing hypothesis-family + Door-3 assertions.
- GREEN `8f778e69` (feat): the family + CI-gate lockstep (Task 1 assertions pass).
- GREEN `b2ac273b` (feat): the Door 3 doctrine (Task 2 assertions pass).
No REFACTOR commit needed.

## Self-Check: PASSED

- FOUND: data/room-blueprints.json (hypothesis family), scripts/check-room-blueprints.cjs (9), commands/ignite.md (Door 3 doctrine), tests/test-hypothesis-family-and-claim.cjs, tests/test-hypothesis-blueprint-family-179.cjs
- FOUND commits: b0f42d93, 8f778e69, b2ac273b
