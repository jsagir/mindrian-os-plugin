---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 17
subsystem: brain-integration
tags: [theo, typesafe, jev, brain-router, ledger, tier-3, egress-guard]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-09 (THEO-01 exact-slug chain safety fix, KNOWN_METHODOLOGIES exported live) -- this plan sits on top of it, never inside it"
  - phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
    provides: "scripts/jev-devtime-client.cjs (loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES), extracted at commit 7336e5215 before this plan's wave ran -- this plan imports it unchanged, per its amended Task 1 STEP 0"
provides:
  - "scripts/build-framework-command-ledger.cjs -- --offline-seed / --jev-fixture <path> / default (jev-scored) / --check, sibling of scripts/build-section-command-ledger.cjs"
  - "data/framework-command-ledger.json -- committed offline-seed ledger (infrastructure only, see HONESTY below)"
  - "lib/mcp/brain-router.cjs::_lookupLedgerCommand -- consulted only after 354-09's exact KNOWN_METHODOLOGIES slug check finds nothing"
  - "lib/mcp/brain-router.cjs recommendations: provenance.ledger_assisted / provenance.ledger_source (additive)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-vetted, dev-time-scored, offline-checkable lookup consulted only AFTER an exact-match safety check fails -- never a live runtime guess, never a widening of the safety property it sits behind"
    - "Uncalibrated (offline-seed) ledger fails closed: source !== 'offline-seed' required whenever confidence_floor is null, so a fallback ledger can never silently promote a candidate"
    - "Test-only env-var path override (MINDRIAN_FRAMEWORK_LEDGER_PATH) so regression tests never touch the shared, committed data file while multiple concurrent sessions are active in the same working tree"

key-files:
  created:
    - scripts/build-framework-command-ledger.cjs
    - data/framework-command-ledger.json
    - tests/fixtures/framework-command-ledger-jev-fixture.json
    - tests/fixtures/framework-command-ledger-labels.json
    - tests/test-354-framework-command-ledger.cjs
  modified:
    - scripts/jev-devtime-client.cjs
    - lib/mcp/brain-router.cjs
    - tests/run-all-354.sh

key-decisions:
  - "The committed ledger ships as --offline-seed (build_mode: offline-seed, confidence_floor: null). _lookupLedgerCommand's own rule (source !== 'offline-seed' required when confidence_floor is null) means it promotes ZERO candidates on day one -- infrastructure, not delivered recall, until a navigator runs a jev-scored build with a real TYPESAFE_API_KEY pre-release."
  - "Ledger 'score' values are normalized to a 0..1 scale (not Jev's raw 0/1/2 Score-question level index), so they are directly comparable to a swept confidence_floor in the same range."
  - "brain-router.cjs's candidate-gather loop was restructured (additive, not a rewrite) to track which framework produced each raw command slug, and to separately track frameworks whose Theo option carried zero command-slug candidates at all -- both are the realistic 'nothing to fall back on' shapes this plan exists to recover, and 354-09's plan text (written before the shipped 354-09 code existed) described a per-candidate {slug, framework} shape that the actual flat-string implementation did not have; this restructure supplies that association without changing 354-09's exact-match outcome for any existing input."
  - "Scored the OTHER direction from the 353 sibling: outer loop = KNOWN_METHODOLOGIES-scoped commands, batch candidates = up to 20 Theo frameworks (the IP-sensitive entity the egress ceiling limits to name/jtbd/glossary), one Score question per framework candidate asking whether it fits the outer command as its right executable step."
  - "scripts/doctor.cjs was listed in the plan's files_modified frontmatter but no task body specified a doctor.cjs change (no acceptance criterion, no must_have references it) -- left untouched rather than invent scope. scripts/jev-devtime-client.cjs was NOT listed in files_modified but Task 1's amended STEP 0 explicitly requires the framework_command_ledger profile addition -- treated as the authoritative instruction over the frontmatter list."

patterns-established:
  - "_ledgerCache()/_lookupLedgerCommand() in brain-router.cjs: lazy, fail-closed (ENOENT/malformed JSON -> { rows: {} }), defense-in-depth command_id re-check against the live KNOWN_METHODOLOGIES export even though the builder already scoped it at build time"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-09-23
---

# Phase 354 Plan 17: TypeSafe/Jev Framework-Command Ledger Summary

**Sibling builder `scripts/build-framework-command-ledger.cjs` (offline-seed / jev-fixture / jev-scored / check modes) plus a `brain-router.cjs` lookup consulted only after 354-09's exact-slug safety check fails -- the committed ledger ships offline-seed and therefore promotes zero candidates by design, proving the lookup logic works (T-pos/T-neg-absent) without claiming delivered recall (T-neg-seed).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-23
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Built `scripts/build-framework-command-ledger.cjs`, the sibling of Phase 353's `scripts/build-section-command-ledger.cjs`, scoring Theo framework labels against the KNOWN_METHODOLOGIES-scoped command set (read live from `lib/mcp/brain-router.cjs`, never hand-copied). Four modes: `--offline-seed` (local substring match against `data/framework-names.json` + `data/command-registry.json`, zero network), `--jev-fixture <path>` (deterministic replay, zero network), default (live Theo pull + Jev scoring, navigator pre-release only), `--check` (fully offline, never requires `TYPESAFE_API_KEY`, catches command-id registry drift by re-reading the live registry rather than a frozen copy).
- Added `EGRESS_PROFILES.framework_command_ledger` to the shared `scripts/jev-devtime-client.cjs` (extracted by Phase 356 at commit `7336e5215`, imported unchanged per this plan's amended Task 1 STEP 0 -- Phase 356 ran first, so no re-extraction happened). Its candidate key set is `name`/`jtbd`/`glossary` only (no `description`, unlike 353's `section_command_ledger` profile) at up to 140 chars, refuse-not-strip.
- Committed `data/framework-command-ledger.json` via `--offline-seed`: 13 framework rows, `build_mode: offline-seed`, `confidence_floor: null`. **HONESTY:** by `_lookupLedgerCommand`'s own rule, this ledger promotes ZERO candidates as shipped -- infrastructure only, proven by T-neg-seed.
- Extended `lib/mcp/brain-router.cjs`'s post-354-09 candidate loop: when the exact `KNOWN_METHODOLOGIES` slug check fails for a candidate (or a framework's Theo option produced no command-slug candidate at all -- the realistic "nothing to fall back on" shape), the ledger is consulted by framework label BEFORE the candidate is rejected. A qualifying row's `command_id` joins `chain` instead, tagged via `provenance.ledger_assisted`/`provenance.ledger_source`. A miss (framework not covered, or ledger uncalibrated) still falls through to `rejected_candidates` exactly as 354-09 left it. `KNOWN_METHODOLOGIES` was already exported live by 354-09; no change needed there.
- New regression `tests/test-354-framework-command-ledger.cjs` (9 assertions across two commits): T1 (offline-seed shape + live registry scoping), T2 (`--check` against the committed ledger), T3 (egress-ceiling negative AND positive boundary, both proven), T4 (jev-fixture determinism with `global.fetch` mocked to throw), T-pos (a framework present only in a fixture-built jev-scored ledger, with no exact command-slug candidate, resolves through the ledger), T-neg-absent (an uncovered framework still rejects, chain length proven), T-neg-seed (the COMMITTED offline-seed ledger, even holding a matching row for the tested framework, still promotes nothing -- the day-one honesty guarantee, precondition explicitly asserted rather than assumed).
- Registered the new test in `tests/run-all-354.sh` (not in the plan's `files_modified` list, but required by the plan's own `<verification>` block -- otherwise the test would never run in CI; Rule 2, missing critical functionality).
- `tests/test-354-theo-router-contract.cjs` (354-09's own regression, 36 assertions: C1-C4/V1/P1/A1/D1) passes unchanged. `node scripts/build-orchestration-projection.cjs --check` exits 0. `bash tests/run-all-354.sh`: 14 passed / 0 failed / 5 skipped (skips are unrelated sibling plans' not-yet-landed test files).

## Task Commits

1. **Task 1: scripts/build-framework-command-ledger.cjs -- sibling builder, offline modes first** - `78852f333` (feat)
2. **Task 2: Consult the ledger in brain-router.cjs only after the exact-slug check finds nothing** - `11feef2d9` (feat)

## Files Created/Modified

- `scripts/build-framework-command-ledger.cjs` - New sibling builder (four build modes, KNOWN_METHODOLOGIES-scoped, zero local egress-ceiling logic of its own)
- `data/framework-command-ledger.json` - New, committed, offline-seed ledger (13 rows)
- `tests/fixtures/framework-command-ledger-jev-fixture.json` - New, named fixture for the deterministic `--jev-fixture` path (3 frameworks x 2 commands each)
- `tests/fixtures/framework-command-ledger-labels.json` - New, hand-labeled fixture (18 triples) for `calibrateFloor()`'s sweep
- `tests/test-354-framework-command-ledger.cjs` - New regression, T1-T4 plus T-pos/T-neg-absent/T-neg-seed
- `scripts/jev-devtime-client.cjs` - Added `EGRESS_PROFILES.framework_command_ledger`; no other profile touched
- `lib/mcp/brain-router.cjs` - `_ledgerCache()`, `_lookupLedgerCommand(frameworkLabel)`, restructured candidate-gather loop (framework-tracking, additive), `provenance.ledger_assisted`/`provenance.ledger_source`
- `tests/run-all-354.sh` - Registered the new test

## Decisions Made

- See `key-decisions` in frontmatter. Most load-bearing: the committed ledger is intentionally non-promoting (offline-seed), and the candidate-gather loop was restructured (not a byte-for-byte insertion) to recover per-candidate framework association that 354-09's shipped flat-string implementation did not carry, while leaving 354-09's exact-match outcome untouched for every input its own regression suite exercises.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's literal "immediately after ... call `_lookupLedgerCommand(candidate.framework)`" phrasing assumed a per-candidate `{slug, framework}` object shape 354-09's shipped code did not have**
- **Found during:** Task 2, reading the actual 354-09-shipped `brainRoute` candidate loop (flat `commandCandidates` array of raw strings, no framework association)
- **Issue:** 354-09's plan text (and this plan's Task 2 text, written against that expectation) presumed a candidate object carrying its own `.framework` field. The shipped code globally deduplicates raw command slugs across all Theo options with no such association, and a framework whose Theo option carries zero command-slug candidates at all (the single most realistic "nothing to fall back on" case this plan exists to recover) never enters that array in the first place.
- **Fix:** Additively tracked (a) a `slug -> framework` map (first-seen wins, matching the existing dedup semantics) so a failed exact-slug check can look up which framework produced it, and (b) a separate `emptyCommandFrameworks` list for frameworks whose option produced no slug at all. Both feed the SAME `_lookupLedgerCommand` call; 354-09's exact-match branch and its resulting `chain`/`frameworks` output are byte-identical for every case its own regression suite (`tests/test-354-theo-router-contract.cjs`, 36 assertions) exercises.
- **Files modified:** `lib/mcp/brain-router.cjs`
- **Verification:** `tests/test-354-theo-router-contract.cjs` (354-09's own suite) still passes 36/36 unchanged; `tests/test-354-framework-command-ledger.cjs` T-pos/T-neg-absent/T-neg-seed all pass against the new paths.
- **Commit:** `11feef2d9`

**2. [Rule 1 - Bug] Ledger "score" values needed to be normalized to 0..1, not Jev's raw 0/1/2 Score-question level index**
- **Found during:** Task 1, implementing `calibrateFloor()` and `_lookupLedgerCommand`'s `score >= confidence_floor` comparison
- **Issue:** The plan text compares a ledger row's `score` directly against `confidence_floor`, and `calibrateFloor`'s swept candidate floors are in the 0.3-0.8 range. Jev's Score question type returns a raw probability-weighted LEVEL INDEX (0..N-1 for an N-level rubric, e.g. 0..2 here) -- comparing that directly against a 0.3-0.8 floor would be meaningless (every real match would trivially exceed 1.0, false negatives on 0).
- **Fix:** Defined the ledger's `score` field as the normalized value (`raw_score / (levels - 1)`), documented at the top of both fixture files and in the builder's `buildJevScored`/`buildWithJevFixture` doc comments. `confidence` remains Jev's own unmodified 0..1 calibrated value.
- **Files modified:** `tests/fixtures/framework-command-ledger-jev-fixture.json` (values authored on the 0..1 scale directly; no production code needed a fix since this was caught before `buildJevScored`'s live-call scoring loop shipped)
- **Verification:** T4/T-pos/T-neg-absent's floor-sweep and lookup assertions pass with realistic floor thresholds.
- **Commit:** `78852f333`

**3. [Rule 2 - Missing critical functionality] New test never wired into CI**
- **Found during:** Task 2 verification, re-reading the plan's own `<verification>` block ("bash tests/run-all-354.sh shows test-354-framework-command-ledger PASSED")
- **Issue:** `tests/run-all-354.sh` is not in the plan's `files_modified` frontmatter, but without registering the new test file there, it would never run as part of the phase's CI gate.
- **Fix:** Added one `run_if` line alongside the existing Theo router contract entry.
- **Files modified:** `tests/run-all-354.sh`
- **Verification:** `bash tests/run-all-354.sh` now shows `354: framework command ledger (THEO-01): PASSED` (14 passed / 0 failed / 5 skipped overall).
- **Commit:** `11feef2d9`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** All three are needed to make the plan's own stated acceptance criteria and verification block observable and true; zero production-behavior scope creep beyond what Tasks 1-2 already specified. `scripts/doctor.cjs` (listed in the plan's `files_modified` frontmatter but referenced by no task body) was deliberately left untouched -- see key-decisions.

## Known Stubs

- **`data/framework-command-ledger.json`** (committed, offline-seed): every row carries `confidence: null`, `source: 'offline-seed'`. By `_lookupLedgerCommand`'s own rule (source must not be `'offline-seed'` whenever `confidence_floor` is null), this ledger **never promotes a candidate at runtime as shipped**. This is intentional and explicitly required by this plan's own `must_haves.truths` (plan-checker blocker 4) -- not an oversight, and proven correct by `T-neg-seed`. It becomes live recall only after a navigator runs `node scripts/build-framework-command-ledger.cjs --jev-fixture <recorded-response>` or the default (live Theo + `TYPESAFE_API_KEY`) build pre-release and re-commits the result. No further plan is currently scheduled to do this -- it is a navigator-invoked, pre-release act, same as the Phase 353 sibling.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None for this plan's committed state (offline-seed ledger, zero vendor dependency). To activate actual recall: export `TYPESAFE_API_KEY` (or populate `~/.secrets/typesafe.env`, mode 600) and run `node scripts/build-framework-command-ledger.cjs`, then commit the resulting `data/framework-command-ledger.json` -- a navigator-invoked, pre-release action, never automated by this plan or by `release.sh`.

## Next Phase Readiness

- THEO-01 is unaffected by this plan's requirement status: 354-09/354-10/354-12 already closed it, and this plan is an additive extension beyond that scope. `REQUIREMENTS.md`'s THEO-01 row and checkbox are untouched by this plan, per the plan's own success criteria.
- No blockers introduced for any later plan. `tests/run-all-354.sh` reports 14 passed / 0 failed / 5 skipped (skips are unrelated sibling plans' not-yet-landed test files, unchanged from before this plan).

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files confirmed present on disk (scripts/build-framework-command-ledger.cjs,
data/framework-command-ledger.json, tests/fixtures/framework-command-ledger-jev-fixture.json,
tests/fixtures/framework-command-ledger-labels.json, tests/test-354-framework-command-ledger.cjs,
scripts/jev-devtime-client.cjs, lib/mcp/brain-router.cjs, tests/run-all-354.sh, this SUMMARY.md).
Both task commits (78852f333, 11feef2d9) confirmed present in git log.
