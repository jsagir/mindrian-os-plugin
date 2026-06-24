---
phase: 178-universal-gate-chokepoint
plan: 03
subsystem: enforcement-wiring
tags: [render-coverage, cirs, c-3, hard-fail, four-surfaces, f7-dial, host-append, part-11-render-twin, frozen-dial-selector]

# Dependency graph
requires:
  - phase: 178-universal-gate-chokepoint (Plan 01)
    provides: data/render-coverage-registry.json (15 card-emission entries, gap=0) + scripts/build-render-coverage.cjs (the exhaustive walk + --check)
  - phase: 178-universal-gate-chokepoint (Plan 02)
    provides: scripts/check-render-coverage.cjs (the deterministic C-2 predicate + the --check fail-closed exit contract) + tests/run-all-178.sh
  - phase: 172-contextual-invocation-coverage (Plan 13 / R9)
    provides: the Phase 172-13 R9 hard-FAIL precedent -- both CIRS gates' --check wired into pre-commit + install-pre-commit.sh + release.sh + doctor --acceptance; the exact wiring idiom mirrored here
  - phase: 177-larry-behavioral-channel
    provides: lib/hmi/dial-selector.cjs (the FROZEN F.7-dial renderDialShape surface; CONFIRMED-not-edited this plan)
provides:
  - "the render-coverage gate is HARD-FAIL (C-3) at all FOUR enforcement surfaces -- a render gap cannot land at any merge/release/health surface"
  - "tests/test-f7-dial-gap-zero-confirm.cjs: the proof the F.7-dial surface is ALREADY gap=0 via the PRODUCTION engine-arm path (renderEngineDecisionWithDial); dial-selector.cjs byte-unchanged"
  - "tests/test-render-gate-wiring.cjs: the wiring proof -- each of the four surfaces references check-render-coverage --check with an exit-1 / abort fail-closed line"
affects: [178-04, check-render-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror the Phase 172-13 R9 four-surface wiring idiom byte-for-byte (pre-commit grep guard + both install-block families + release.sh abort block + doctor gates[] sibling)"
    - "Probe the PRODUCTION engine-arm path (the exported renderEngineDecisionWithDial seam on routing.source==='engine') -- NOT a synthetic pickShape call -- to prove the F.7-dial host-append (the HIGH-2 correction)"
    - "Confirm-not-edit a frozen contract: the live slip premise is FALSE; assert dial-selector.cjs byte-unchanged + run-all-177 green rather than routing renderDialShape through a new door"

key-files:
  created:
    - tests/test-f7-dial-gap-zero-confirm.cjs
    - tests/test-render-gate-wiring.cjs
  modified:
    - scripts/install-pre-commit.sh
    - scripts/release.sh
    - scripts/doctor.cjs
    - tests/run-all-178.sh

key-decisions:
  - "The F.7-dial 'live slip' premise is FALSE on the live tree -- CONFIRMED gap=0 via the host-append (the isFShape branch AND the production engine arm); the frozen Phase-177 dial-selector.cjs is NOT edited (byte-unchanged sha 485e7829...)"
  - "The render gate rides the SAME FOUR surfaces as the two CIRS gates, HARD-FAIL from day one on the already-green baseline (the Phase 172-13 sequencing principle: baseline green first, then flip; CI never goes RED)"

patterns-established:
  - "Two-plane discipline preserved: the render gate reads the SEPARATE render registry; the connector ledger (data/connector-coverage-ledger.json) stays byte-stable (sha 8bdec39b...); no reach/posture/edge/node minted; no Brain wire (Part 8 LOCAL)"

requirements-completed: [C-3, D-178-04, D-178-05]

# Metrics
duration: 14min
completed: 2026-06-24
---

# Phase 178 Plan 03: Render Gate Hard-FAIL Wiring + F.7-dial gap=0 Confirmation Summary

**check-render-coverage --check is now wired HARD-FAIL (C-3) into all four enforcement surfaces the CIRS R9 gate rides (pre-commit + install-pre-commit.sh + release.sh + doctor --acceptance), mirroring the Phase 172-13 idiom byte-for-byte; and the Phase-177 F.7-dial surface is CONFIRMED already gap=0 -- host-appended via the production engine arm (renderEngineDecisionWithDial) AND the pickShape isFShape branch -- with the frozen dial-selector.cjs left byte-unchanged because the 'live slip' premise is FALSE.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-06-24
- **Tasks:** 2 (both type=auto)
- **Files:** 2 created, 4 modified

## Accomplishments

### Task 1 - CONFIRM F.7-dial already gap=0 (do NOT edit the frozen dial-selector.cjs)

- Wrote `tests/test-f7-dial-gap-zero-confirm.cjs` (11 assertions). The load-bearing one probes the PRODUCTION engine-arm path: it drives the REAL exported seam `intent-classifier.cjs::renderEngineDecisionWithDial(decision, {source:'engine'}, ...)` and asserts the live block carries the host-appended `[AskUserQuestion contract: ...]` marker. This is the HIGH-2 correction made concrete -- the test exercises the production turn path, not merely a synthetic `pickShape` call.
- Second assertion: `pickShape({requestedShape:'F.7-dial'})` host-appends a non-empty `askuserquestion_marker` via the isFShape branch (selector-dispatcher.cjs:931-933).
- Third assertion: the 178-02 predicate reports `counts.gap === 0` on the live repo.
- Frozen-contract guard (assertions 8-11): `renderDialShape` still returns shape `F.7-dial` with the same `{ shape, hud, zones }` envelope, and does NOT itself assign a marker (host-appended downstream). The file is NOT edited.
- Verified `lib/hmi/dial-selector.cjs` sha256 stays `485e78297404f6fe58504d27e2164381c37f39ea961d2404a7c38059bea19211` (byte-unchanged) and `bash tests/run-all-177.sh` exits 0 (frozen 177 dial contracts intact).

### Task 2 - Wire check-render-coverage --check HARD-FAIL into the four surfaces

- `scripts/install-pre-commit.sh`: added `check-render-coverage.cjs --check` to (a) the hook-presence grep guard, (b) the primary `HOOK_TRAILER_RENDER` install block, and (c) the dev-clone manifest-surface block -- both install-block families with a `|| { echo 'render-coverage drift / dark surface -- run: node scripts/build-render-coverage.cjs' >&2; exit 1; }` fail-closed line. The trigger path-scopes on staged render entry points (`lib/hmi/*`, `lib/agents/*`, `lib/render/*`, `lib/core/*`, `scripts/intent-classifier.cjs`) and the render registry. Escaping matches the sibling CIRS blocks byte-for-byte (`$'` in the primary heredoc, `\$'` in the HOOK_BODY heredoc).
- `scripts/release.sh`: added an `if ! node "$PLUGIN_DIR/scripts/check-render-coverage.cjs" --check; then ABORT...; exit 1; fi` block alongside the two CIRS gate blocks (Step 2.4), with the ABORT message and recovery line in the existing idiom.
- `scripts/doctor.cjs`: added `{ id: 'render', script: 'check-render-coverage.cjs' }` to the `coverage-gate` organ's `gates[]` array (blocker severity, spawned with `--check`, aggregated into `ok = failed.length === 0`).
- `tests/test-render-gate-wiring.cjs` (11 assertions): proves each of the four surfaces references the gate with an exit-1 / abort fail-closed line (HARD-FAIL, never WARN; R-5).
- Registered both new suites in `tests/run-all-178.sh` (Wave 3 real runs); `run-all-178.sh` is 8 pass / 0 fail / 1 skip (178-04 RED-by-design).
- Proved fail-closed end-to-end: a synthesized dark entry fed via the test-only `RENDER_COVERAGE_REGISTRY` override trips `--check` to exit 1; the rendered pre-commit hook (installed into a temp repo) embeds the gate with the `exit 1` line, placeholder fully substituted, syntax valid.

## Task Commits

1. **Task 1: CONFIRM F.7-dial already gap=0 via the production engine arm** - `39a99cd1` (test)
2. **Task 2: wire check-render-coverage --check HARD-FAIL into all four enforcement surfaces** - `f02d1070` (feat)

## Files Created/Modified

- `tests/test-f7-dial-gap-zero-confirm.cjs` (created) - The F.7-dial gap=0 confirmation: production engine-arm probe + pickShape host-append + predicate gap=0 + the frozen-contract guard (dial-selector.cjs byte-unchanged).
- `tests/test-render-gate-wiring.cjs` (created) - The four-surface wiring proof: each surface references the gate with an exit-1 / abort fail-closed line.
- `scripts/install-pre-commit.sh` (modified) - grep guard + both install-block families wire the render gate, HARD-FAIL.
- `scripts/release.sh` (modified) - render-gate abort block in Step 2.4.
- `scripts/doctor.cjs` (modified) - render gate added to the coverage-gate organ's `gates[]` array.
- `tests/run-all-178.sh` (modified) - both 178-03 suites registered as Wave 3 real runs.

## Decisions Made

- **The F.7-dial 'live slip' premise is FALSE; CONFIRM-not-edit.** Per the plan's CRITICAL CORRECTION, the F.7-dial surface is ALREADY card-emission-covered: `renderDialShape` returns shape `F.7-dial` (starts with 'F'), so the pickShape isFShape host-append applies the marker, and the production engine arm appends it explicitly. The frozen Phase-177 `dial-selector.cjs` is therefore left byte-unchanged; the confirmation test asserts the byte-stability and probes the production path. No routing change, no marker assignment, no contract touch.
- **HARD-FAIL on the already-green baseline (the Phase 172-13 sequencing principle).** Because Task 1 confirms gap=0 BEFORE Task 2 flips the gate hard-FAIL, the gate passes on the clean repo and CI never goes RED -- the same sequencing the CIRS R9 flip used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's Task 2 grep-verify command string never matches release.sh (a defect inherited from the existing CIRS gates), not a wiring defect**
- **Found during:** Task 2 verification (running the plan's `<verify>` line 201 verbatim).
- **Issue:** The plan's verify is `grep -c "check-render-coverage.cjs --check" scripts/install-pre-commit.sh scripts/release.sh | grep -v ':0'`. In `release.sh` the gate is wired as `node "$PLUGIN_DIR/scripts/check-render-coverage.cjs" --check` -- there is a `"` between `.cjs` and `--check`, so the bare-space literal `check-render-coverage.cjs --check` matches 0 times in `release.sh`. This is NOT a wiring miss: running the IDENTICAL grep for the already-shipped connector gate (`grep -c "build-connector-registry.cjs --check" scripts/release.sh`) ALSO returns `0`, because the shipped CIRS gate has the exact same quote placement. The plan's verify-string is the defect; my wiring faithfully mirrors the shipped idiom byte-for-byte (verified by `bash -n` syntax + the rendered-hook test + the wiring-proof test).
- **Fix:** Did NOT alter the wiring to satisfy a buggy grep (that would diverge from the shipped CIRS idiom). Instead the wiring proof (`tests/test-render-gate-wiring.cjs`) asserts release.sh references the gate via the faithful pattern `check-render-coverage\.cjs" --check` and the ABORT block, and the four-surface grep is satisfied by `check-render-coverage.cjs --check` present in install-pre-commit.sh (count 2) plus `grep -q "check-render-coverage.cjs"` on release.sh + doctor.cjs. All four surfaces ARE wired and proven HARD-FAIL.
- **Files modified:** none beyond the intended wiring (the deviation is about not chasing a buggy verify string).
- **Committed in:** `f02d1070` (the wiring proof encodes the correct assertion).

---

**Total deviations:** 1 auto-fixed (a plan verify-string defect inherited from the shipped CIRS gates; the wiring itself mirrors the shipped idiom exactly).
**Impact on plan:** None on the deliverable. All four surfaces are wired HARD-FAIL and proven; the frozen contracts are untouched.

## Issues Encountered

None beyond the deviation above. The connector ledger stayed byte-stable (sha `8bdec39b...`), the frozen dial-selector.cjs stayed byte-unchanged (sha `485e7829...`), and the render baseline stayed gap=0 throughout.

## Known Stubs

None. The render gate is fully wired HARD-FAIL against the live 15-entry registry; gap=0 is the correct, expected baseline. The gate's value is forward enforcement: a future render-only or undeclared reachable gate surface fails the gate closed at any of the four surfaces.

## Threat Flags

None. This plan adds no new network endpoint, auth path, or trust-boundary surface. The wiring is shell + CJS over existing files; the gate is LOCAL-only (Part 8 clean): it reads the registry + source files, opens no remote wire, loads no Brain module, runs no inference. No package installs (the T-178-03-SC mitigation: no Package Legitimacy Gate triggered).

## Next Phase Readiness

- The render gate is non-bypassable at every merge/release/health surface (C-3); 178-04 (the R15 FLOOR + the R-1 PostToolUse-interceptor spike + the candidate Canon render-twin amendment) can build on a fully-enforced gate.
- Frozen contracts UNTOUCHED: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the 3 postures, the glyphs, REACH_IDS, and the frozen dial-selector.cjs. No reach/posture/edge/node minted; no Brain wire (Part 8 LOCAL). Connector ledger byte-stable.
- The R-1 residual (the terminal LLM tool-call on a real turn staying agent-honored) is named and accepted (T-178-03-04); the PostToolUse-interceptor spike is 178-04.

## Self-Check: PASSED

- Files verified present: tests/test-f7-dial-gap-zero-confirm.cjs, tests/test-render-gate-wiring.cjs, 178-03-SUMMARY.md.
- Commits verified present: 39a99cd1 (Task 1 test), f02d1070 (Task 2 feat).
- Verification gates green: dial-selector.cjs sha 485e7829... (byte-unchanged); render baseline gap=0; the production engine-arm probe + pickShape host-append both surface a non-empty marker; the render gate --check exits 0 on the green baseline and exits 1 on a synthesized dark entry (fails closed); all four enforcement surfaces wired HARD-FAIL (11/11 wiring assertions); run-all-178.sh 8 pass / 0 fail / 1 skip; run-all-177.sh exit 0; connector ledger byte-stable (sha 8bdec39b...).

---
*Phase: 178-universal-gate-chokepoint*
*Completed: 2026-06-24*
