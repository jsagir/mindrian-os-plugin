---
phase: 231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont
plan: 02
subsystem: eureka
tags: [eureka, entity-extraction, code-review, cr-01, evidenceTier, reconciliation, rca, human-verify, verify-not-build]

# Dependency graph
requires:
  - phase: 231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont
    plan: 01
    provides: FIX A/B/C committed in 3000d06e; scripts/entity-extract.cjs physically carries the CR-01 IIFE
provides:
  - CR-01 duplicate-name evidenceTier reconciliation regression test (tests/test-218-duplicate-entity-reconciliation.cjs)
  - Phase 218 suite wiring for both new legs f.2 (low-trust-exclusion) and f.3 (CR-01 reconciliation) in tests/run-all-218.sh
  - RCA handoff-eureka-entity-noise-2026-07-19 dispositioned to status resolved_offline
  - knowledge-base summary block for the eureka entity-noise investigation
affects: [eureka pairing/ranking, entity-extraction provenance, phase 231 close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Highest-trust-wins reconciliation over a shared-key write set: normalize every same-name entry to the single best evidenceTier via a trustRank reduce BEFORE the write loop, never let filesystem read order decide a trust verdict"
    - "Map.has() presence + literal-'None' normalization to escape the Map.get() undefined-ambiguity trap when the legitimate stored value can itself be undefined"
    - "In-place normalization (no entry removal) so every artifact's DESCRIBES edge survives the reconciliation"

key-files:
  created:
    - tests/test-218-duplicate-entity-reconciliation.cjs
  modified:
    - tests/run-all-218.sh
    - .planning/debug/handoff-eureka-entity-noise-2026-07-19.md
    - .planning/debug/knowledge-base.md

key-decisions:
  - "Accepted on OFFLINE PROOF (checkpoint Path B): the hermetic suite proves the mechanism; the live keyed acceptance (tier2_model > 0 on a real room) is a deferred fast-follow, blocked on a valid Anthropic key (repo .env key resolves but returns non-2xx)"
  - "RCA status set to resolved_offline (NOT resolved) and the file kept in .planning/debug/ (NOT moved to resolved/) because the live leg is genuinely open"
  - "Committed on branch seeds/host-runtime-research-2026-07-18 (NOT main), per navigator decision; no merge/rebase/cherry-pick attempted -- the navigator merges to main themselves"
  - "CR-01 IIFE (reconcileEvidenceTierAcrossDuplicateNames) was already committed in 3000d06e (231-01) since it shares entity-extract.cjs with FIX A; this plan added only the regression test + wiring, and did not re-commit or re-claim the IIFE as new"

requirements-completed: [EEN-05, EEN-06]

# Metrics
duration: 8min
completed: 2026-07-19
---

# Phase 231 Plan 02: Eureka Entity-Noise Fix (CR-01 reconciliation + human-verify close) Summary

**Verified the CR-01 duplicate-name evidenceTier reconciliation offline, cleared the RCA-mandated human-verify checkpoint on offline proof (Path B), and landed the CR-01 regression test + suite wiring plus the RCA disposition (resolved_offline) as two scoped commits on the current branch -- the live keyed acceptance is a documented, deferred fast-follow.**

## Continuation context

This was a CONTINUATION after the plan's blocking human-verify checkpoint cleared. Task 1 (CR-01 source verification + full-suite roll-up) and Task 2 (the checkpoint itself) were completed by prior agents. This agent executed Task 3 only: the final scoped commits, RCA disposition, and this SUMMARY.

The navigator's resume signal was **"approved-offline"** with two explicit course corrections applied to the plan's Task 3:
1. Accept on offline proof; set RCA to `resolved_offline`, not `resolved`; live keyed acceptance deferred.
2. Commit directly onto the CURRENT branch `seeds/host-runtime-research-2026-07-18`; do NOT switch to main, do NOT merge/rebase/cherry-pick. This overrides the plan's original "confirm branch is main" WORKSPACE GUARD sub-step.

## Performance

- **Duration:** ~8 min (Task 3 only)
- **Completed:** 2026-07-19
- **Tasks:** 1 of 3 (Task 3; Tasks 1-2 done by prior agents)
- **Files modified:** 4 (1 new test + 3 modified)

## Pre-commit re-confirmation (no silent drift)

Before committing anything, re-ran the gates to confirm nothing drifted since the checkpoint agent's last check:

- `git status --short`: exactly the expected set -- `tests/run-all-218.sh` (M), `tests/test-218-duplicate-entity-reconciliation.cjs` (??), the RCA doc (M), plus the two known unrelated files (`evals/plurai/211-baseline.json`, `.planning/debug/resolved/card-fire-block-surface.md`).
- `node tests/test-218-duplicate-entity-reconciliation.cjs`: exit 0, 1/1 (highest-trust verdict wins, both DESCRIBES edges survive).
- `bash tests/run-all-218.sh`: **Phase 218 PASS=15 FAIL=3 SKIP=0**, the 3 failures the exact pre-existing unrelated ones (test-218-edge-vocab + test-218-entity-writer: `edges` table has no column named `review_status`; test-218-eureka-auto-extract leg 5: `encoder_unavailable`), embedded **Phase 211 PASS=10 FAIL=0**. Zero new failures.

## Accomplishments

- **Commit 1 (`58c1f773`, fix):** `tests/test-218-duplicate-entity-reconciliation.cjs` (new, 193 insertions with wiring) + `tests/run-all-218.sh` (wires leg f.2 low-trust-exclusion and leg f.3 CR-01 reconciliation). The `reconcileEvidenceTierAcrossDuplicateNames()` IIFE itself was NOT in this commit -- it landed in `3000d06e` (231-01) since it shares `scripts/entity-extract.cjs` with FIX A. The commit message states this explicitly so the IIFE is not double-claimed as new.
- **Commit 2 (`151de2b2`, docs):** RCA `handoff-eureka-entity-noise-2026-07-19.md` frontmatter `status: awaiting_human_verify -> resolved_offline`, with a DISPOSITION section recording both phase commits, the offline-proof acceptance, and the deferred live leg; plus a knowledge-base summary block (root cause, four-change fix, open live leg, four pattern lessons). Both force-added (`.planning/` is gitignored).
- **Scope stayed clean:** after both commits, `git status --short` still lists `evals/plurai/211-baseline.json` and `.planning/debug/resolved/card-fire-block-surface.md` as modified -- proof neither unrelated change rode either commit.

## Files Created/Modified

- `tests/test-218-duplicate-entity-reconciliation.cjs` (NEW) - seeds the exact two-artifact same-name disagreement (one tier-2b call succeeds, one fails); asserts the highest-trust verdict wins regardless of write order and both DESCRIBES edges survive.
- `tests/run-all-218.sh` - wires leg (f.2) `test-218-low-trust-exclusion` and leg (f.3) `test-218-duplicate-entity-reconciliation` into the Phase 218 roll-up.
- `.planning/debug/handoff-eureka-entity-noise-2026-07-19.md` - status `resolved_offline`; DISPOSITION section; kept in place (not moved to `resolved/`).
- `.planning/debug/knowledge-base.md` - new summary block for the investigation.

## Decisions Made

- **(a) Accepted on offline proof (Path B):** the hermetic suite (22/22 classifier contract, 3/3 low-trust-exclusion, 1/1 CR-01 reconciliation, Phase 218 15/3 pre-existing-only, Phase 211 10/0) proves the mechanism. `tier2_model > 0` only additionally proves the key is valid, which is an environment fact.
- **(b) `resolved_offline`, file kept in place:** the live keyed acceptance is genuinely open, so the RCA is not fully resolved. Per the plan's approved-offline path and the navigator's "if in doubt, leave it in place" instruction, the file was NOT moved to `.planning/debug/resolved/`. It should be promoted to `resolved` and moved once a valid key confirms the live number.
- **(c) Committed on `seeds/host-runtime-research-2026-07-18`, not main:** per navigator decision. No merge/rebase/cherry-pick/switch performed. This branch already carries d5a2e9b0, 3000d06e, 1b605a1b (this phase) plus the SEED-067..SEED-071 handoff commits; the navigator merges to main themselves.

## Deviations from Plan

The plan's Task 3 was written to commit "the six phase files in one atomic commit" and to "confirm branch is main (WORKSPACE GUARD)". Both were superseded by the navigator's explicit course corrections, applied as directed:

1. **Commit shape:** five of the six phase files (mva-classifier.cjs, entity-classifier.cjs, entity-extract.cjs, eureka-portfolio-report.cjs, test-218-low-trust-exclusion.cjs) had ALREADY landed in 231-01's `3000d06e`. Only the CR-01 test file and the suite wiring remained uncommitted, so Commit 1 carried exactly those two. Not a drift -- the plan's "six files" assumption predated 231-01 committing the shared file.
2. **Branch:** committed on the current branch per navigator decision, not main. The plan's fail-closed-on-not-main sub-step was explicitly overridden.
3. **RCA status:** `resolved_offline` (plan's approved-offline branch), not `resolved`.

No auto-fixes (Rules 1-3) were needed; no code changed in this plan.

## Fast-Follow Ledger (carried forward, non-blocking unless noted)

From `231-REVIEW.md` and CONTEXT.md, surfaced at the checkpoint, none fixed here:

- **WR-01** (truncation-tail drop): a truncation-tail per-term model answer is coerced to `noise`, which could drop a legitimately-truncated valid label. Fast-follow candidate.
- **WR-02** (non-hermetic no-key test): the no-key classifier test is not hermetic against a real repo `.env` present on the machine.
- **WR-03** (test cleanup not in finally): the CR-01 / low-trust test temp-dir cleanup is not wrapped in a `finally`, so a mid-test throw can leak a temp dir.
- **WR-04** (.env leg depth assumption): FIX B's 4th key leg assumes a fixed two-levels-up depth from `lib/core/` to plugin root.
- **IN-02** (no duplicate-entity-names counter): no observability counter for how many same-name reconciliations fired -- a silent-flip would still be silent in aggregate telemetry.
- **SEED-034** (room.db-population sequencing, CRITICAL, still OPEN): the room.db population sequencing note flagged in CONTEXT.md is NOT resolved by this phase and stays critical/open. Not silently dropped.
- **DEFERRED live keyed acceptance:** run `entity-extract` against a real keyed room (e.g. aion-eureka-synergy) with a VALID Anthropic key and confirm `tier2_model > 0` and no "Windows"/"CSFs" in the eureka top-N. Blocked because the repo .env key resolves but returns non-2xx (looks expired/invalid). This is the single gate between `resolved_offline` and `resolved`.

## TDD Gate Compliance

Not a TDD plan (verify-and-accept). The CR-01 regression test was pre-written and re-run green during verification; no RED/GREEN/REFACTOR gate applies.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or trust-boundary schema changes were introduced by this plan (it added one hermetic test + doc updates). The phase's own threat register (T-231-04..06, T-231-SC) is fully addressed by the committed code.

## User Setup Required

None for the offline-accepted disposition. For the deferred live leg: a VALID Anthropic API key in `/home/jsagi/dev/MindrianOS-Plugin/.env` (or `~/.mindrian.env`), then the Path A steps in 231-02-PLAN.md's checkpoint.

## Next Phase Readiness

- **Phase 231 COMPLETE** (offline-accepted). Both plans committed; RCA dispositioned; knowledge-base updated.
- **One open fast-follow of note:** the live keyed acceptance (environment-blocked, not code-blocked) and SEED-034 (critical, separate) remain tracked.
- **Merge to main is the navigator's step**, deliberately not done here.

## Self-Check: PASSED

- FOUND: `tests/test-218-duplicate-entity-reconciliation.cjs`
- FOUND: commit `58c1f773`
- FOUND: commit `151de2b2`
- FOUND: `.planning/debug/handoff-eureka-entity-noise-2026-07-19.md` status `resolved_offline`
- FOUND: `.planning/debug/knowledge-base.md` block for handoff-eureka-entity-noise-2026-07-19

---
*Phase: 231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont*
*Completed: 2026-07-19*
