---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 02
subsystem: testing
tags: [jev, typesafe, egress-guard, shared-client, part8, cross-session]

# Dependency graph
requires:
  - phase: 356-01
    provides: "tests/fixtures/356-no-network-preload.cjs, tests/run-all-356.sh, HOOKS_BANNED_LEDGER_SCRIPTS"
provides:
  - "scripts/jev-devtime-client.cjs (D-07 interface: loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES)"
  - "tests/fixtures/356-section-guard-parity.json (16-case parity corpus recorded from the pre-extraction 353 guard)"
  - "tests/test-356-jev-client.cjs (80 checks, legs a-n)"
  - ".planning/phases/356-.../deferred-items.md (build-section-command-ledger.cjs refactor DEFERRED, recipe written)"
affects: [356-03, 356-07, 357, 354-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One guard file, one profile per builder, never a merged union (D-08): makeEgressGuard(profile, opts) dispatches on profile.kind (candidates_v1 for 353-style ceilings, exact_state_v1 for 356/357-style exact-key ledgers)"
    - "Refuse, never strip (D-09): every guard violation throws an Error with err.code = 'EGRESS_REFUSED', err.profile, err.key"
    - "fetchImpl resolved at CALL time (opts.fetchImpl || globalThis.fetch), never captured at module load, so tests can swap globalThis.fetch after requiring"
    - "must_equal_file reads referenced file bytes ONCE at guard construction (not per call), so a post-construction file edit cannot silently change what an already-built guard compares against"
    - "Extract-if-missing (D-06): 356 was first to reach scripts/jev-devtime-client.cjs (354-17 has only an amendment commit, not an execution; jev-devtime-client.cjs was ABSENT at start of this plan)"

key-files:
  created:
    - scripts/jev-devtime-client.cjs
    - tests/fixtures/356-section-guard-parity.json
    - tests/test-356-jev-client.cjs
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md
  modified: []

key-decisions:
  - "DEFER branch taken for the 353 builder refactor: scripts/eval-icm-writers.cjs and tests/test-353-{grader-agreement,ledger-shape}.cjs still carried unowned uncommitted diffs at execution time (confirmed by git status immediately before Task 1 and re-confirmed immediately before Task 2's refactor decision); scripts/build-section-command-ledger.cjs itself was left byte-identical, matching the D-18 guard jsagi-25 applied to 354-17 (commit 873363114)"
  - "recorded_from in the parity fixture was written as 'assertEgressCeiling at <sha> (scripts/build-section-command-ledger.cjs)' rather than the plan prose's literal template ('scripts/build-section-command-ledger.cjs assertEgressCeiling at <sha>'), because the plan's own acceptance criteria requires recorded_from.indexOf('assertEgressCeiling at ') === 0 -- the two plan passages conflicted, and the machine-checked acceptance criterion was treated as authoritative"

patterns-established:
  - "Pattern: parity corpus recorded from a git-pinned pre-extraction commit (git show <sha>:<path> into a scratchpad file, required from there so the guard needs no repo paths), replayed against both the new extraction and the untouched original export, proving equivalence without requiring the original to change"

requirements-completed: [R356-08, R356-07]

# Metrics
duration: ~35min
completed: 2026-09-23
---

# Phase 356 Plan 02: Shared dev-time Jev client (extract-if-missing) Summary

**Extracted scripts/jev-devtime-client.cjs (D-06..D-09 interface, both candidates_v1 and exact_state_v1 guard kinds, max_len_by_key and must_equal_file optional fields) with a 16-case parity corpus proving byte-identical behavior to the pre-extraction 353 guard, while deferring the 353 builder's own refactor because its unowned consumers are still mid-edit.**

## Preflight

**Git status immediately before Task 1** (`git status --short -- scripts/eval-icm-writers.cjs tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs scripts/build-section-command-ledger.cjs scripts/jev-devtime-client.cjs`):
```
 M scripts/eval-icm-writers.cjs
 M tests/test-353-grader-agreement.cjs
 M tests/test-353-ledger-shape.cjs
```
(`scripts/build-section-command-ledger.cjs` clean; `scripts/jev-devtime-client.cjs` did not exist -- ABSENT branch.)

**Unowned-diff digest** (`git diff -- scripts/eval-icm-writers.cjs tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs | md5sum`): `4a5403ff3a1e304bb1bf9e6738d90836`. Re-checked identical after Task 2's edits (no drift, no peer commit landed in between).

**353 baselines** (all `env -u TYPESAFE_API_KEY`), recorded before any edit and re-confirmed after Task 2:
- `node tests/test-353-ledger-shape.cjs`: **PASS=13 FAIL=6** (expected; pre-existing red, not 356's to fix per 356-RESEARCH.md Pitfall 5)
- `node tests/test-353-grader-agreement.cjs`: **PASS=30 FAIL=0**
- `node tests/test-353-release-wiring.cjs`: **PASS=8 FAIL=0**
- `node tests/test-353-tripwires.cjs`: **PASS=5 FAIL=0** (green)

All four baselines held unchanged after Task 2.

**Branch taken:** ABSENT (356 is the extractor; `scripts/jev-devtime-client.cjs` did not exist, and 354-17's only related commit was a plan-amendment, not an execution).

**Refactor outcome:** DEFER (see "## Peer messages" and the Deviations section below for the reasoning already logged to `deferred-items.md`).

**Final profile names in EGRESS_PROFILES:** `section_command_ledger` only (356-07 adds `material_step_ledger`; 354-17 and 357 add their own from their own builders, per D-08).

## Peer messages

No live agent-messaging tool (ListAgents or equivalent) was available in this execution context, so the D-06 peer notice is relayed here for the orchestrator/user to forward:

> 356 (jsagi-a7) is running extract-if-missing for scripts/jev-devtime-client.cjs now, with the optional max_len_by_key and must_equal_file profile fields. If you already extracted it, say so and 356 will import yours.

Addressed to: jsagi-25 (354-17) and jsagi-e0 (357). As of this plan's execution, `scripts/jev-devtime-client.cjs` was absent and neither peer had landed an execution commit for it (354-17's `873363114` is a plan amendment only), so 356 proceeded as the extractor without blocking on a reply, per the plan's "do not block on replies" instruction.

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23T11:28:40Z
- **Tasks:** 2/2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- `scripts/jev-devtime-client.cjs`: pure module (`node:fs`, `node:path` only) exporting `DEFAULT_ENDPOINT`, `loadKey`, `makeEgressGuard`, `jev`, `pool`, `EGRESS_PROFILES`. `makeEgressGuard` supports two kinds (`candidates_v1` reproducing 353's exact semantics; `exact_state_v1` for 356/357's stricter exact-key-set ledgers) plus the two orchestrator-addendum optional fields (`max_len_by_key`, `must_equal_file`), applied additively after the kind-specific checks, always refusing and never stripping, always naming the offending key via `err.code`/`err.profile`/`err.key`.
- `tests/fixtures/356-section-guard-parity.json`: 16 cases recorded by replaying the pre-extraction `assertEgressCeiling` (git-pinned at commit `201c10cf65d`, the last commit to touch `build-section-command-ledger.cjs` before this plan) over the exact case list the plan specifies (minimal valid, disallowed top/state/candidate keys, 140/141-char and 400/401-char boundaries, arbitrary unchecked `criteria`, null/string payloads, absent state/candidates, numeric candidate value, two-candidate second-key-named-in-message).
- `tests/test-356-jev-client.cjs`: 80 checks across legs (a) interface, (b) parity (every case replayed against BOTH the extracted client and the 353 builder's own untouched `assertEgressCeiling` export -- both agree with the recorded corpus and with each other), (c) guard-required, (d) guard-before-fetch, (e) retry semantics (4 calls / `[1000,2000,4000]` sleeps / status 0 on network exhaustion; 5 calls / `[800,1600,3200,6400]` sleeps / status 429 on repeated 429; 1 call / parsed json / `text.length <= 200` on a clean 200), (f) call-time `fetchImpl` resolution, (g) `loadKey` (env-wins, quote-stripped file value, null on both-missing, zero console/stdout writes captured), (h) `pool` order-preservation and concurrency ceiling, (i) `max_len_by_key`, (j) `must_equal_file` (byte identity including trailing-newline sensitivity, `opts.root` required at construction, path-escape refused at construction, bytes read once so a post-construction file edit doesn't change the comparison), (k) additivity (a profile copy with neither optional field present matches the base on every parity case), (l) refuse-never-strip (payload deep-equal to its pre-call snapshot after a refusal), (m) no-local-copies (R8), (n) zero network egress.
- `.planning/phases/356-.../deferred-items.md`: new file, `## 356-02: build-section-command-ledger.cjs refactor DEFERRED` section with the git-status snapshot, the D-18 reasoning, the confirmed zero-impact-on-356-02 statement, and the exact 9-step recipe to apply once the three unowned files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`) are clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Preflight, parity corpus, and scripts/jev-devtime-client.cjs** - `7336e5215` (feat)
2. **Task 2: tests/test-356-jev-client.cjs and the 353 builder refactor decision (DEFER)** - `40fb70b6f` (test)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `scripts/jev-devtime-client.cjs` - shared dev-time Jev client and per-profile egress guard
- `tests/fixtures/356-section-guard-parity.json` - 16-case parity corpus recorded from the pre-extraction guard
- `tests/test-356-jev-client.cjs` - interface, parity, retry, optional-field, and no-local-copies tests (80 checks)
- `.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md` - the 353 builder refactor deferral and its recipe

## Decisions Made
- ABSENT branch confirmed by `test -f scripts/jev-devtime-client.cjs` before writing anything; 356 is the extractor.
- DEFER branch confirmed twice (before Task 1 and again inside Task 2's refactor decision, per the plan's re-check instruction): `scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, and `tests/test-353-ledger-shape.cjs` were all still dirty both times, so `scripts/build-section-command-ledger.cjs` was left byte-identical and the refactor recipe was written to `deferred-items.md` instead of applied.
- The parity fixture's `recorded_from` string was written to satisfy the plan's own machine-checked acceptance criterion (`indexOf('assertEgressCeiling at ') === 0`) rather than its prose template, since the two conflicted; documented as a deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's own acceptance criteria and action-step prose disagreed on `recorded_from`'s required prefix**
- **Found during:** Task 1, STEP 1 (writing the parity fixture)
- **Issue:** The action text specifies `"recorded_from": "scripts/build-section-command-ledger.cjs assertEgressCeiling at <commit sha>"`, but the task's own `<acceptance_criteria>` runs `recorded_from.indexOf('assertEgressCeiling at ') === 0`, which only passes if the string STARTS with `"assertEgressCeiling at "`. The prose template's string does not satisfy the acceptance check (the string starts with `"scripts/..."`, not `"assertEgressCeiling at "`).
- **Fix:** Wrote `recorded_from` as `"assertEgressCeiling at 201c10cf65dc5f09300fd3c8e41324827309f4df (scripts/build-section-command-ledger.cjs)"`, which starts with the required literal and still names the source file and commit.
- **Files modified:** tests/fixtures/356-section-guard-parity.json
- **Verification:** `node -e "process.exit(require('./tests/fixtures/356-section-guard-parity.json').recorded_from.indexOf('assertEgressCeiling at ')===0?0:1)"` exits 0.
- **Committed in:** 7336e5215 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, a plan self-contradiction resolved in favor of the machine-checked criterion)
**Impact on plan:** No scope creep. The fixture still records the exact commit sha and source file; only the string's word order changed to satisfy the plan's own verification gate.

## Issues Encountered
None beyond the deviation above. No live peer-messaging tool was available; the D-06 peer notice is relayed in writing in the "## Peer messages" section for the orchestrator to forward to jsagi-25 and jsagi-e0.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Both created code files (`scripts/jev-devtime-client.cjs`, `tests/test-356-jev-client.cjs`) are complete, runnable, non-placeholder implementations. `EGRESS_PROFILES` intentionally carries only `section_command_ledger` (356-07 adds `material_step_ledger` later, as the plan specifies; this is documented behavior, not a stub).

## Threat Flags

None. This plan introduces no new network endpoint, auth path, or schema at a trust boundary beyond what the threat_model in 356-02-PLAN.md already names (T-356-04, T-356-05, T-356-06, T-356-07, T-356-14, T-356-SC), all of which are addressed: parity corpus (T-356-04), captured-zero-writes test (T-356-05), digest-unchanged confirmation (T-356-06), guard-required test (T-356-07), byte-comparison-refuse tests (T-356-14), zero package installs (T-356-SC).

## Next Phase Readiness
- `scripts/jev-devtime-client.cjs` is ready for 356-07 (`material_step_ledger` profile, with `must_equal_file` for `policy`) and for 356-03/later 356 plans that need `jev()`/`pool()`/`loadKey()`.
- The DEFER recipe in `deferred-items.md` is ready for whichever future 356 plan (or a dedicated follow-up) finds all four gate paths clean (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `scripts/build-section-command-ledger.cjs`) and wants to complete the builder refactor.
- `tests/run-all-356.sh` (from 356-01) will automatically pick up `tests/test-356-jev-client.cjs` now that it exists; no aggregator edit needed.
- No blockers for 356-03 or 356-07.

## Self-Check: PASSED

- FOUND: scripts/jev-devtime-client.cjs
- FOUND: tests/fixtures/356-section-guard-parity.json
- FOUND: tests/test-356-jev-client.cjs
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/deferred-items.md
- FOUND: .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-02-SUMMARY.md
- FOUND commit: 7336e5215
- FOUND commit: 40fb70b6f

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*
