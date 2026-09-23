---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 02
subsystem: testing
tags: [card-fire, replay, tri-polar, hermetic, mcp, gate-triad]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 01
    provides: "scripts/card-fire-replay-corpus.cjs (loadCorpus, readPrePhase, validateEntry), tests/fixtures/card-fire-replay/pre-phase.json, run-all-357.sh"
provides:
  - "scripts/replay-card-fire.cjs: runReplay, runEntry, prepareCodeRoot, classifyOutcome, main -- the one command that replays the labeled corpus through the REAL deriveTurnSignals -> classifyCardFire (CLI) and handleStopEvent (MCP), hermetically, on HEAD or a git-archived pre-phase commit"
  - "tests/test-357-replay.cjs: L1-L5 proven (network ban, exit semantics, hermeticity negative control, envelope-mode bookkeeping, code-root parity); L6/L7 written and SKIP-gated, waiting on 357-05/357-09 inputs"
affects: [357-03, 357-04, 357-05, 357-06, 357-07, 357-08, 357-09, 357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-entry, per-surface hermetic env (withHermeticEnv): a fresh mkdtemp sets MINDRIAN_HOME, CARD_FIRE_SIDECHANNEL_PATH, MINDRIAN_ROOMS_HOME and MINDRIAN_ROOMS_ROOT together, restored (or deleted) in a finally, regardless of what the LAUNCHING environment had set -- proven by L3's decoy-room negative control, which points the child env at a decoy machine-wide active room and shows the harness's own per-entry override still wins"
    - "Three envelope modes (direct / transcript / sidechannel, combinable) materialized against the REAL seams: a temp transcript.jsonl read by lib/hmi/turn-text.cjs, and the real card-fire-sidechannel.cjs recordReachedGate with back-dated ts -- never a second, hand-rolled envelope"
    - "CLI surface mirrors check-card-fire.cjs's main() bookkeeping exactly (read both counters, classify, bump-or-clear both counters, consumeReachedGatesForVerdict on every TERMINAL verdict) instead of calling classifyCardFire raw, so retry/session ceilings and record consumption are exercised for real"
    - "MCP/CLI parity compared by verdict CLASS only (block vs pass), with dedup-already-fired-this-session excluded -- an MCP fire:true carries no reason string"
    - "--code-root pre-phase: git archive of the pinned pre_phase_sha into a fresh mkdtemp, digest-verified per-file against pre-phase.json's runtime_files, node_modules symlinked in -- stateless, no .git/worktrees entry"

key-files:
  created:
    - scripts/replay-card-fire.cjs
    - tests/test-357-replay.cjs
  modified: []

key-decisions:
  - "predicate-error (classifyCardFire's own defensive catch-all) is reported as its own outcome class 'error', not folded into 'pass' -- classifyOutcome checks cls==='error' FIRST, ahead of known_false_block/envelope_partial, so a harness/predicate fault can never be silently reclassified as OK or a known-annotated outcome. The plan's own prose lists known_false_block before the error case; this is a deliberate, documented departure from that literal ordering (Rule 1: a harness bug masquerading as OK would be a correctness regression in the measuring instrument itself)."
  - "The --mutation argv flag (reserved for 357-09) is implemented as a top-of-file guard in tests/test-357-replay.cjs itself (the TEST's own invocation mode), not as a flag scripts/replay-card-fire.cjs's argv parser recognizes -- re-reading the plan's Task 2 action text, the SKIP behavior it describes belongs to the test runner, not the harness CLI."
  - "loadCodeRootModules memoizes per code-root absolute path as a light convenience layer on top of require()'s own path-keyed cache; HEAD and a pre-phase mkdtemp are always different absolute paths, so the two code roots never share cached module state."

requirements-completed: [GATE357-02, GATE357-06]

# Metrics
duration: 55min
completed: 2026-09-23
---

# Phase 357 Plan 02: Replay Harness Summary

**One command (`scripts/replay-card-fire.cjs`) replays the Phase 357 corpus through the real Stop-hook card gate on both the CLI and MCP surfaces, hermetically (fresh MINDRIAN_HOME/ROOMS_HOME/SIDECHANNEL per entry per surface, zero network), against HEAD or a git-archived pre-phase commit, and exits non-zero exactly when false blocks or new misses exist -- proven by a 10-leg test suite (5 more written and SKIP-gated, waiting on later plans' inputs).**

## Performance

- **Duration:** ~55 min (from PLAN_BASE to the Task 2 commit; excludes SUMMARY authoring)
- **PLAN_BASE:** `a5042fea9` (HEAD at plan start; peer sessions landed unrelated commits on `main` during this plan's execution -- both of this plan's commits are verified clean of any file outside their own declared `files_modified`)
- **Task 1 commit:** `7d8b9086d` at 2026-09-23T20:10:24+03:00
- **Task 2 commit:** `1fd52f351` at 2026-09-23T20:49:41+03:00
- **Tasks:** 2/2 completed
- **Files modified:** 2 created, 0 modified

## Accomplishments

- `scripts/replay-card-fire.cjs` built (769 lines): `prepareCodeRoot`, `withHermeticEnv`, `materializeEnvelope` (+ `seedSidechannelRecords`/`seedCounters`), `runCliStop` (mirrors `main()`'s exact bookkeeping), `runMcpStop`, `runEntry` (multi-step, per-surface hermetic), `classifyOutcome`, `runReplay` (baseline write/compare, `--only`/`--source` filters, JSON + human output), `parseArgs`/`main`.
- The full 238 corpus (18 entries, both states) replays green on both surfaces: `node scripts/replay-card-fire.cjs --surface both --source 238 --json` -> `{entries:18, errors:0, parity_mismatches:0, false_blocks:0}`, exit 0.
- `--code-root pre-phase` archives `973deb3296f60c8583fe2ba2eac1ba5d32d62024` (`git archive` + `tar -x` into a fresh mkdtemp), digest-verifies all 7 pinned runtime files against `pre-phase.json`, symlinks `node_modules`, replays the same 18 entries identically (since 238 predates every 357 runtime change), and leaves zero `replay-357-root-*` directories in `os.tmpdir()` afterward.
- `tests/test-357-replay.cjs` built (485 lines, 10 active legs + 2 SKIP-gated): L1 network ban, L2(a-d) exit semantics (FALSE_BLOCK/NEW_MISS/KNOWN_MISS/KNOWN_FALSE_BLOCK), L3 hermeticity negative control (a decoy machine-wide active room, pointed at directly in the child env, is never resolved or touched), L4(a-c) envelope-mode bookkeeping and CLI/MCP parity (tool_result pass, human-typed block, multi-step consumption), L5 code-root parity + archive cleanup. L6 (live anchors) and L7 (standing bar) are written and gated on `live-2026-09-23.json` entries (357-05) and `baseline.json` (357-09) respectively; both currently SKIP as designed.
- The real `~/.mindrian/card-fire-retries.json` mtime was recorded before and after a full `--surface both` replay run: `1790180261` both times (file untouched), confirming per-entry hermetic isolation held for real, no fallback to the Task 1 step-4 coarser isolation was needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replay core (hermetic env, envelope modes, CLI and MCP surfaces, code root, metrics, exit codes)** - `7d8b9086d` (feat)
2. **Task 2: Replay test (network ban, exit semantics, hermeticity negative control, modes, parity, live anchors, bar)** - `1fd52f351` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `scripts/replay-card-fire.cjs` - the replay harness (769 lines): CLI + MCP surfaces, three envelope modes, `--code-root`, `--baseline`, `--only`, `--source`, `--json`
- `tests/test-357-replay.cjs` - the harness's own test suite (485 lines): 10 active legs, 2 SKIP-gated legs written ahead of their inputs

## Decisions Made

See `key-decisions` in the frontmatter (predicate-error precedence in `classifyOutcome`, `--mutation` living in the test runner not the harness CLI, per-code-root module memoization).

## Deviations from Plan

None requiring a fix -- the harness worked correctly on the first full run against both the HEAD and pre-phase code roots, and every test leg passed on the first execution. Two clarifying interpretations of ambiguous plan prose are recorded as key-decisions above (not deviations from behavior, deviations from how one sentence of Task 2's action text was read).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No secrets, no network egress (proven by L1's backstop-detector spawn).

## Verification Results

- `node tests/test-357-replay.cjs` -> `PASS 10/10`, exit 0.
- `node scripts/replay-card-fire.cjs --surface both --source 238 --json` -> `{entries:18, errors:0, parity_mismatches:0, false_blocks:0}`, exit 0.
- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface cli --source 238` -> exit 0, `ls -d /tmp/replay-357-root-* | wc -l` -> `0`.
- `grep -v '^\s*//' scripts/replay-card-fire.cjs | grep -c "require(.*tests/"` -> `0`.
- `grep -v '^\s*//' scripts/replay-card-fire.cjs | grep -c "MINDRIAN_ROOMS_HOME"` -> `4`; `grep -c "_resetForTest"` -> `3`.
- `grep -v '^\s*//' scripts/replay-card-fire.cjs | grep -c "network forbidden in replay-card-fire"` -> `1`.
- `~/.mindrian/card-fire-retries.json` mtime before/after a full `--surface both` run: `1790180261` / `1790180261` (unchanged).
- Em-dash guard: `grep -c $'\xe2\x80\x94'` -> `0` on both new files.
- Protected-file check (this plan's two commits only, not the shared branch's concurrent peer commits): `git diff --name-only <commit>~1 <commit> -- lib/mcp/brain-router.cjs lib/core/write-lock.cjs lib/core/part8-egress-guard.cjs scripts/doctor.cjs lib/core/graph-ops.cjs scripts/eval-icm-writers.cjs tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs lib/core/navigation.cjs docs/OPEN-HANDOFFS.md` -> empty for both commits.
- No-runtime-change check (this plan's two commits only): `git diff --name-only <commit>~1 <commit> -- lib hooks scripts/check-card-fire.cjs` -> empty for both commits (this plan ships only `scripts/replay-card-fire.cjs` and `tests/test-357-replay.cjs`, no `lib/`, `hooks/`, or `check-card-fire.cjs` change).

## Next Phase Readiness

- `scripts/replay-card-fire.cjs` is the measuring instrument every later 357 plan (03 Jev labeler + egress profile, 04/05/06 corpus authoring, 07 the D-07/D-08a fixes, 08 the Jev label ratification checkpoint, 09 baseline + standing gate + mutation leg, 10 closure) reads for its own pass/fail signal.
- L6 (live anchors) activates automatically once 357-05 lands >=2 entries in `tests/fixtures/card-fire-replay/live-2026-09-23.json`; no edit to this plan's test file is needed.
- L7 (standing bar) and the `--mutation` leg activate automatically once 357-09 writes `tests/fixtures/card-fire-replay/baseline.json`; no edit to this plan's test file is needed for L7, and 357-09 implements the real mutation-leg body behind the existing reserved flag.
- No runtime file (`lib/`, `hooks/`, `scripts/check-card-fire.cjs`) was touched in this plan, consistent with the plan's own "No runtime change" objective -- D-07/D-08a land in 357-07, measured against this same harness.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 02*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 3 created files verified present on disk (`scripts/replay-card-fire.cjs`, `tests/test-357-replay.cjs`, this summary). All 3 commits (`7d8b9086d` Task 1, `1fd52f351` Task 2, `62dd55ca0` this summary) verified present in `git log`. No missing items.
