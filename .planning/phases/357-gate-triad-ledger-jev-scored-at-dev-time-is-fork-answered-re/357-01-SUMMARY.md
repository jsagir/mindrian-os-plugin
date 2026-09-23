---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 01
subsystem: testing
tags: [card-fire, replay, corpus, fixtures, test-scaffolding, gate-triad]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "Phase 354 CLOSED (354-16-SUMMARY.md), the D-15 execution gate"
provides:
  - "scripts/card-fire-replay-corpus.cjs: loadCorpus, adapt238, validateEntry, readPrePhase, SOURCES, LABEL_ORIGINS, ENVELOPE_MODES, SOURCE_FILES, CORPUS_DIR, CORPUS_238_PATH"
  - "tests/fixtures/card-fire-replay/pre-phase.json: pinned pre-phase sha plus 7 runtime-file digests"
  - "three empty-entries fixture files (debug-cases.json, live-2026-09-23.json, dogfood.json) with sanitization_statement meta, ready for plans 04/05/06 to fill"
  - "tests/test-357-corpus-loader.cjs: L1-L6 loader assertions plus --dogfood-strict mode (GATE357-09)"
  - "tests/run-all-357.sh: the Phase 357 aggregator, all 8 legs pre-declared once (D-14)"
affects: [357-02, 357-03, 357-04, 357-05, 357-06, 357-07, 357-08, 357-09, 357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-state 238 adapter: Half A (expect_fire=false) emits one direct-mode pass entry; Half B (expect_fire=true) emits two direct-mode block entries (healthy+corroborated, unavailable+uncorroborated) (RESEARCH Finding 6)"
    - "Non-throwing leg recorder in the loader test (L1-L6 run independently, all failures collected and printed before exit), mirroring test-238-card-fire-corpus.cjs's state1Failures pattern -- the 238-07 tests-first precedent for an expected-red window"
    - "Aggregator written once (D-14): tests/run-all-357.sh pre-declares every later-plan leg behind run_if guards so no later 357 plan edits this file"

key-files:
  created:
    - scripts/card-fire-replay-corpus.cjs
    - tests/fixtures/card-fire-replay/pre-phase.json
    - tests/fixtures/card-fire-replay/debug-cases.json
    - tests/fixtures/card-fire-replay/live-2026-09-23.json
    - tests/fixtures/card-fire-replay/dogfood.json
    - tests/test-357-corpus-loader.cjs
    - tests/run-all-357.sh
  modified: []

key-decisions:
  - "PLAN_BASE = 973deb3296f60c8583fe2ba2eac1ba5d32d62024 (= pre_phase_sha, since no runtime file had uncommitted diffs and this plan makes no runtime change)"
  - "354 gate (D-15) passed: .planning/phases/354-*/354-16-SUMMARY.md exists, Phase 354 CLOSED"
  - "R-D snapshot verified: sha256sum -c ~/.cache/mindrian-dev/357-raw/SHA256SUMS reported OK for all 5 files (4 session jsonl + card-fire-intercepts.log)"
  - "EM_DASH constant built via String.fromCharCode(0x2014), not a literal em-dash character in source, so the loader module itself passes the em-dash guard it enforces on fixtures"
  - "L4 (mode rule) currently passes vacuously with 0 live/dogfood entries; only L3 (sources and floor) is the observed red leg today, matching the acceptance criteria's 'L3 or L4' wording"
  - "All 6 regression legs (209-primary-sidechannel, 238-card-fire-corpus, 198-stop-gate-retry-ceiling, larry-handoff-seam, gate-native-fire-w1, larry-voice-mark-182) measured green under hermetic env at plan time; none removed from the aggregator"

patterns-established:
  - "Pattern 1 (RESEARCH): three envelope modes (direct / transcript / sidechannel), enforced in validateEntry -- live and dogfood entries must use a transcript-containing mode; direct mode forbids gate_is_fresh"
  - "Corpus loader never throws: malformed files or entries become error strings in loadCorpus({}).errors, loading continues"

requirements-completed: [GATE357-01, GATE357-08]

# Metrics
duration: 5min
completed: 2026-09-23
---

# Phase 357 Plan 01: Corpus Foundation Summary

**Single-loader scaffolding for the Phase 357 replay corpus: 238-adapter (18 per-state entries), three sanitization-stamped empty source files, pinned pre-phase anchor, loader test, and the once-written phase aggregator.**

## Performance

- **Duration:** ~5 min (excluding read/context-gathering time)
- **Started:** 2026-09-23T16:56:04Z (pre-phase anchor recorded)
- **Completed:** 2026-09-23T20:00:32+03:00 (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 7 created, 0 modified

## Accomplishments
- 354 gate (D-15) passed: `354-16-SUMMARY.md` exists, Phase 354 is CLOSED.
- R-D evidence snapshot verified: `sha256sum -c` against `~/.cache/mindrian-dev/357-raw/SHA256SUMS` returned OK for all 5 files (the intercept log plus sessions 56924067, 0f86dd63, 0208790f, 21829408).
- Pre-phase anchor pinned: `PRE=973deb3296f60c8583fe2ba2eac1ba5d32d62024`, with sha256 digests of the 7 runtime files it must not have changed yet, in `tests/fixtures/card-fire-replay/pre-phase.json`.
- `scripts/card-fire-replay-corpus.cjs` built with the full D-02 entry shape validator, the 238 per-state adapter (18 entries: 10 `:s1` pass, 4 `:s2` + 4 `:s3` block), and a never-throws `loadCorpus`.
- Three empty-entries fixture files (`debug-cases.json`, `live-2026-09-23.json`, `dogfood.json`) created with their source-specific `sanitization_statement` wording, ready for plans 04, 05, and 06 to populate.
- `tests/test-357-corpus-loader.cjs` encodes L1-L6 (structure, 238 adapter, sources/floor, mode rule, known lists, em-dash guard) plus `--dogfood-strict` (GATE357-09), all as non-throwing recorded legs so a red leg does not hide the rest.
- `tests/run-all-357.sh` written once: 8 pre-declared `run_if "357: ..."` legs (GATE357-01 through -09 plus D-11 tripwires), 6 regression legs, the vendor no-api.typesafe.ai-under-lib/hooks gate, and the targeted em-dash guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: 354 gate, pre-phase anchor, corpus loader and empty-entries fixture files** - `64fa2735f` (feat)
2. **Task 2: Loader test and the run-all-357.sh aggregator (written once)** - `2f4a29be6` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `scripts/card-fire-replay-corpus.cjs` - loader, adapt238, validateEntry, readPrePhase and the 6 frozen exports
- `tests/fixtures/card-fire-replay/pre-phase.json` - pre_phase_sha plus 7 runtime-file sha256 digests
- `tests/fixtures/card-fire-replay/debug-cases.json` - empty-entries, debug sanitization_statement
- `tests/fixtures/card-fire-replay/live-2026-09-23.json` - empty-entries, live sanitization_statement
- `tests/fixtures/card-fire-replay/dogfood.json` - empty-entries, dogfood sanitization_statement
- `tests/test-357-corpus-loader.cjs` - L1-L6 loader test plus --dogfood-strict
- `tests/run-all-357.sh` - the Phase 357 aggregator (written once)

## Decisions Made
- `PLAN_BASE` and `pre_phase_sha` are the same commit (`973deb329`): the 354-16 close-out commit, since the plan does not create a new commit before recording the anchor and no peer diffs existed on any of the 7 guarded runtime files at plan start.
- Kept `L4` (mode rule) as a normal, non-vacuously-red check rather than force-failing it: with 0 live/dogfood entries today it has nothing to violate, so it legitimately passes. The plan's acceptance criteria anticipated this ("names L3 or L4 as the only failing legs" — not "both"), so this is plan-conformant, not a shortcut.
- Built the `EM_DASH` sentinel via `String.fromCharCode(0x2014)` instead of a literal em-dash character in the source file — the literal character would have tripped the loader's own em-dash guard when grepped as part of the phase's em-dash-guard tooling. This was caught by the plan's own acceptance-criteria grep check and fixed before committing (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal em-dash character in the EM_DASH sentinel constant**
- **Found during:** Task 1, running the acceptance-criteria em-dash grep check (`grep -c "$(printf '\xe2\x80\x94')" scripts/card-fire-replay-corpus.cjs ...`)
- **Issue:** The initial `const EM_DASH = '—';` line embedded a literal U+2014 character in the source file, which the acceptance check (and the phase's own em-dash-guard doctrine) flags as a violation, even though the character's purpose here is detection, not prose.
- **Fix:** Changed to `const EM_DASH = String.fromCharCode(0x2014);`, which expresses the same codepoint with zero literal em-dash bytes in the file.
- **Files modified:** `scripts/card-fire-replay-corpus.cjs`
- **Verification:** Re-ran `grep -c "$(printf '\xe2\x80\x94')" scripts/card-fire-replay-corpus.cjs` → 0. Re-ran the full verify command (`loadCorpus({})` returns 18 238 entries, 0 errors) → still passes.
- **Committed in:** `64fa2735f` (part of Task 1 commit; fixed before commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Self-contained fix caught by the plan's own acceptance criteria before committing. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Regression Leg Results (Task 2, action step 3)

All six regression legs measured green under hermetic env at plan time; none removed from `tests/run-all-357.sh`:

| Leg | Result |
|-----|--------|
| `tests/test-209-primary-sidechannel.cjs` | PASS (36 assertions) |
| `tests/test-238-card-fire-corpus.cjs` | PASS (32 assertions) |
| `tests/test-198-stop-gate-retry-ceiling.test.cjs` | PASS (15 assertions) |
| `tests/test-larry-handoff-seam.cjs` | PASS (6/6) |
| `tests/test-gate-native-fire-w1.cjs` | PASS (12 assertions) |
| `tests/test-larry-voice-mark-182.cjs` | PASS (106/106) |

Excluded per R-J (pre-existing reds, not touched): `tests/test-card-fire-relevance-gate.cjs`, `tests/test-ga4-card-fire-e2e-179.cjs`.

## Loader Test Red Legs (expected, documented in the header comment)

`node tests/test-357-corpus-loader.cjs` (no flag): 1/11 legs red.
- L1 structure: PASS
- L2 238 adapter: PASS
- **L3 sources and floor (SPEC R1): FAIL** — `debug`, `live`, `dogfood` each have 0 entries (floor >=1); total 18 entries < 45 floor. Expected until plans 04/05/06 land their entries.
- L4 mode rule (R-I): PASS (vacuous — no live/dogfood entries yet to violate the rule)
- L5 known lists: PASS (`known_miss ids: []`, `known_false_block ids: []`)
- L6 no em-dash: PASS

`node tests/test-357-corpus-loader.cjs --dogfood-strict`: 2/12 legs red (adds the expected `dogfood-strict (GATE357-09)` red — dogfood has 0 entries, no `verdict_preservation: 'checked'` meta yet — held for the plan-08 human checkpoint).

`bash tests/run-all-357.sh`: PASS=9, FAIL=1 (the corpus-loader leg, expected), SKIP=6 (legs guarded on files that land in later plans). No unexpected failures.

## Gate Results (Task 1, action step 1-2)

- **354 gate (D-15):** `ls .planning/phases/354-*/354-16-SUMMARY.md` found the file. Phase 354 is CLOSED. Proceeded.
- **R-D snapshot check:** `cd ~/.cache/mindrian-dev/357-raw && sha256sum -c SHA256SUMS` returned OK for all 5 entries (`0208790f-...jsonl`, `0f86dd63-...jsonl`, `21829408-...jsonl`, `56924067-...jsonl`, `card-fire-intercepts.log`). Proceeded.
- **Pre-phase anchor:** `PRE=973deb3296f60c8583fe2ba2eac1ba5d32d62024`. `git status --short` on the 7 guarded runtime files printed nothing (no peer diffs). `git log --format=%s $PRE -- lib/hmi/turn-text.cjs scripts/check-card-fire.cjs lib/core/gate-relevance.cjs | grep -c '357-'` returned 0 (no prior 357 runtime commit). Anchor recorded to `tests/fixtures/card-fire-replay/pre-phase.json`.

## Next Phase Readiness
- `scripts/card-fire-replay-corpus.cjs` is the single seam every later 357 plan (02 harness, 03 Jev labeler, 04/05 authored entries, 06 dogfood extractor, 09 baseline/mutation) must consume — no re-parsing of fixture files elsewhere.
- `tests/run-all-357.sh` is closed for editing per D-14; later plans only need their own `tests/test-357-*.cjs` file to land for the corresponding `run_if` leg to activate.
- No runtime file (`lib/`, `hooks/`, `scripts/check-card-fire.cjs`) was touched in this plan, consistent with the plan's own "No runtime (lib/, hooks/, check-card-fire) change" objective.
- Blocker for the next plan (04/05): debug and live entries are still empty; L3 stays red until they land.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 01*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 7 created files verified present on disk (`scripts/card-fire-replay-corpus.cjs`, the 4 `tests/fixtures/card-fire-replay/*.json` files, `tests/test-357-corpus-loader.cjs`, `tests/run-all-357.sh`). All 3 commits (`64fa2735f` Task 1, `2f4a29be6` Task 2, `8070997b9` this summary) verified present in `git log`. No missing items.
