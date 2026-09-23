---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 11
subsystem: hsi-classifier
tags: [direction-convention, python-retirement, scout, cascade, rs-engine, d-52]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (classify, classifyDiff, DIRECTIONS, NONE)"
  - phase: 355-02
    provides: "tests/fixtures/355/direction-pairs.json, tests/test-355-direction-agreement.cjs (leg G scoped to this plan)"
provides:
  - "lib/core/intelligence-cascade.cjs no longer spawns detect-reverse-salients.py; stepsResult.reverseSalients reports { status: 'retired', reason }"
  - "scripts/scout-cadence-runner.cjs's SCHED-02 reverse-salient sensor is a new rs-engine-cjs step (lib/core/rs-engine.cjs's runModeInternal, in-process via a node -e child), unconditional -- not gated on scikit-learn"
  - "commands/scout.md and skills/scout/SKILL.md step 2 document and invoke the same CJS RS engine instead of python3 detect-reverse-salients.py"
  - "scripts/detect-reverse-salients.py and scripts/compute-hsi.py carry Phase 355 D-52 header notes marking them offline-reference-only (comment-only diffs, zero logic change)"
  - "leg G of tests/test-355-direction-agreement.cjs turns green"
affects: [355-12]

tech-stack:
  added: []
  patterns:
    - "In-process engine via a child node -e call: scripts/scout-cadence-runner.cjs's runStep helper is synchronous (execFileSync), but lib/core/rs-engine.cjs's runModeInternal is async; bridged with a two-line node -e script (require + .then/.catch + process.exit) run as a child process, so the existing synchronous step-capture contract (exit code, stdout, stderr) needs no restructuring"
    - "Retire-in-place result shape: when a step is removed from a live path, the result object keeps its key with a { status: 'retired', reason } value instead of disappearing, so any caller reading stepsResult.reverseSalients sees a stable, typed answer rather than a missing property"

key-files:
  created: []
  modified:
    - lib/core/intelligence-cascade.cjs
    - scripts/scout-cadence-runner.cjs
    - tests/test-scout-cadence-fires.cjs
    - commands/scout.md
    - skills/scout/SKILL.md
    - scripts/detect-reverse-salients.py
    - scripts/compute-hsi.py
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "The rs-engine-cjs cadence step calls runModeInternal(roomDir, {}) -- empty opts, so DEFAULT_TOPK (100) and DEFAULT_THRESHOLD (0.3) govern, matching the module's own documented 'internal mode' defaults -- rather than the topk:1 override commands/find-bottlenecks.md uses for its single top-finding probe. A scheduled background sensor writing graph edges should capture every above-threshold pair, not just the top one; topk:1 would have silently narrowed SCHED-02's reverse-salient coverage relative to what the retired Python detector wrote (T-355-52 territory)."
  - "hsi-engine.cjs's now-unused-after-the-block-removal hsiSuccess variable (three assignment sites, zero reads) was left untouched in lib/core/intelligence-cascade.cjs: the plan's action text explicitly says 'leave the HSI backend dispatch and hsi-to-graph step untouched', and hsiSuccess belongs to that dispatch block, not to the removed reverse-salient block. Removing it would be an unrequested cleanup of code outside this task's declared change."
  - "Leg H (the 'one rule' repo sweep) is NOT this plan's scope, despite 355-10-SUMMARY.md's forward-looking note suggesting otherwise. 355-11-PLAN.md's own frontmatter must_haves name only 'leg G ... passes'; leg H's last two unresolved hits (lib/core/rs-chain-feeder.cjs, lib/memory/test-rs-discovery-engine.cjs) are outside this plan's files_modified list. Corrected in deferred-items.md rather than silently expanding scope to touch two files this plan was never asked to change."
  - "The must_haves-mandated REVERSE_SALIENT-reader sweep is reporting-only for this plan (355-12's job is to fix them); lib/core/leverage-scan.cjs's query looked unfiltered in SQL but is filtered in JS immediately after (props.source !== 'rs-engine' continue) -- verified before excluding it from the five-reader list, not assumed clean from the SQL text alone."

patterns-established:
  - "Synchronous-runner-calls-async-engine bridge (node -e + a stdlib require, run as a captured child process) for wiring an async lib/core/*.cjs API into a script built around execFileSync-style step capture, without restructuring the runner to be async top-to-bottom."

requirements-completed: [HIPS-01]

duration: ~55min
completed: 2026-09-24
---

# Phase 355 Plan 11: Python Reverse-Salient Detector Retired From All Four Live Callers (D-52) Summary

**`detect-reverse-salients.py` (the Python detector that wrote the opposite, Convention B, direction label) is off every live path -- `lib/core/intelligence-cascade.cjs` and `scripts/scout-cadence-runner.cjs` now retire/replace the step in-process via `lib/core/rs-engine.cjs`'s `runModeInternal` (the same engine `/mos:find-bottlenecks` uses), and `commands/scout.md` / `skills/scout/SKILL.md` document the same CJS engine as scout's step 2 -- leg G of the cross-producer agreement test turns green, and both Python scripts are marked offline-reference-only with comment-only diffs.**

## Performance

- **Duration:** ~55 min (single continuous session, sequential executor on the shared main tree)
- **Tasks:** 2 completed
- **Files modified:** 0 created, 9 modified (7 plan-declared files + deferred-items.md + ROADMAP.md)

## Accomplishments

- `lib/core/intelligence-cascade.cjs`: removed the unconditional `execFileSync('python3', [...detect-reverse-salients.py...])` block; `stepsResult.reverseSalients` now always reports `{ status: 'retired', reason: 'Phase 355 D-52: Python detector off the live path; reverse salients come from lib/core/rs-engine.cjs' }` so the result shape stays stable for any caller. The HSI backend dispatch (`resolveBackend()`, the python/cjs branches, `hsiSuccess`) and the `hsi-to-graph.cjs` bridge step are byte-unchanged, per the plan's own instruction.
- `scripts/scout-cadence-runner.cjs`: removed both the live `detect-reverse-salients` step and its skipped (sklearn-absent) twin; added a new `rs-engine-cjs` step that runs `process.execPath -e <two-line script>` (`require(rs-engine.cjs).runModeInternal(roomDir, {}).then(...).catch(...)`) via the existing synchronous `runStep` helper. Placed OUTSIDE the `hsiDepsAvailable()` gate entirely, so it fires on every cadence run regardless of whether scikit-learn is installed (the CJS engine has no Python dependency) -- SCHED-02's reverse-salient sensor is now strictly more reliable than the step it replaces, which used to degrade to a `skipped` stub on a sklearn-absent box.
- Smoke-tested the `rs-engine-cjs` step's full `execFileSync` wiring against a scratch room (0-2 artifacts, offline, no network) before committing: exits 0, produces `{pairs: []}` on a too-small room, degrades gracefully per `runModeInternal`'s own documented contract.
- `tests/test-scout-cadence-fires.cjs`: amended the SCHED-02 reverse-salient assertion from `names.includes('detect-reverse-salients')` to `names.includes('rs-engine-cjs')`, with a "Amended Phase 355 D-52" comment; also amended the file's top-of-file doc comment (sklearn-tolerance paragraph, the SCHED-02-to-step-name map) so the header no longer describes a removed step. All 3 tests in the file pass (`node tests/test-scout-cadence-fires.cjs` exits 0).
- `commands/scout.md` and `skills/scout/SKILL.md`: Step 2 of the HSI pipeline bash block now reads "Reverse salients from the CJS RS engine (the engine /mos:find-bottlenecks uses)" and invokes `node -e "require('${PLUGIN_ROOT}/lib/core/rs-engine.cjs').runModeInternal(...)..." "$ROOM_DIR"` instead of `python3 .../detect-reverse-salients.py`. Step 1 (compute-hsi.py) and Step 3 (hsi-to-graph.cjs) are byte-unchanged except the renumbered comment. Added the required sentence under the block: direction labels in `.hsi-results.json` are re-derived from the stored similarity pair, never trusted as written.
- `scripts/detect-reverse-salients.py` and `scripts/compute-hsi.py`: each gained a one-block `#` comment note (offline-reference-only for the detector; MINDRIAN_RS_BACKEND=python fallback + scout HSI step 1 for compute-hsi) placed right after the module docstring. Verified comment-only: `git diff -U0` on both files shows every added/removed line starts with `#` (0 non-comment diff lines); `python3 -m py_compile` on both confirms no syntax break.
- Legs A through G of `tests/test-355-direction-agreement.cjs` are now fully green (0 FAIL across A/B/C/D/E/F/G). Only leg H remains red, with 2 unresolved hits (`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`) -- see Deviations below; leg H is not this plan's scope per its own frontmatter.
- Per the plan's must_haves, swept every `REVERSE_SALIENT` reader in `lib`/`scripts` and recorded five unfiltered readers plus one adjacent writer finding in `deferred-items.md` for 355-12 (full detail there, summarized in Deviations below).

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: Remove the detector spawn from the cascade and the cadence runner; CJS RS step for SCHED-02** - `b04bec07f` (fix)
2. **Task 2: Scout docs name the CJS engine; Python scripts marked as reference; registry gates green** - `f8d1fb22f` (docs)

**Plan metadata:**
- `0687e672a` (docs: ROADMAP checkbox + Plans counter, staged via a hand-built patch against HEAD's blob to avoid sweeping a peer session's concurrent unrelated whitespace hunk elsewhere in the file, exactly as the 355-10 precedent)
- `7183f3608` (docs: deferred-items.md leg H scope correction + five unfiltered REVERSE_SALIENT readers for 355-12)

## Files Created/Modified

- `lib/core/intelligence-cascade.cjs` - detector `execFileSync` block removed; `stepsResult.reverseSalients` reports `{ status: 'retired', reason }`
- `scripts/scout-cadence-runner.cjs` - both detector steps removed; new `rs-engine-cjs` step added, unconditional on the sklearn gate
- `tests/test-scout-cadence-fires.cjs` - SCHED-02 reverse-salient assertion amended to `rs-engine-cjs`, header doc comment updated
- `commands/scout.md` - Step 2 of the HSI pipeline now invokes the CJS RS engine; direction-honesty sentence added
- `skills/scout/SKILL.md` - identical Step 2 edit (mirrors commands/scout.md)
- `scripts/detect-reverse-salients.py` - header comment only: offline-reference-only, D-52
- `scripts/compute-hsi.py` - header comment only: reference implementation + python-backend-fallback note, D-07
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - leg H scope correction, five unfiltered REVERSE_SALIENT readers + one writer finding, for 355-12
- `.planning/ROADMAP.md` - 355-11 row checked, Plans counter 9/28 -> 10/28

## Decisions Made

See key-decisions in frontmatter: the `runModeInternal(roomDir, {})` (default topk/threshold, not `find-bottlenecks`'s `topk:1`) choice for the cadence sensor, leaving `hsiSuccess` untouched as out-of-block scope, the leg-H scope correction, and confirming `leverage-scan.cjs` was already correctly filtered before excluding it from the reader list.

## Deviations from Plan

### Auto-fixed Issues

None - both tasks' action steps were followed as written. No Rule 1/2/3 auto-fixes were needed to any of the seven plan-declared files.

### Documented scope corrections (no functional impact on this plan's own deliverables)

**1. [Scope correction, not a fix] Leg H is not closed by this plan; 355-10-SUMMARY.md's forward-looking note was incorrect**
- **Found during:** Task 1's own verification (`node tests/test-355-direction-agreement.cjs`)
- **Issue:** `355-10-SUMMARY.md`'s "Next Phase Readiness" section stated leg H's remaining duplication "remain[s] for 355-11" to close. Re-reading `355-11-PLAN.md`'s own frontmatter (`must_haves.truths`, `files_modified`) shows this plan's stated leg scope is "RED-to-GREEN: leg G ... passes" only; `lib/core/rs-chain-feeder.cjs` and `lib/memory/test-rs-discovery-engine.cjs` (leg H's last two unresolved hits) are not in `files_modified`.
- **Why not fixed:** Editing either file's own comparison-to-label rule is a real code change to a file this plan was never asked to touch (Scope Boundary rule / Rule 4 territory -- an architectural edit to an undeclared surface, not a bug in this plan's own work).
- **Files modified:** none beyond the planned seven; logged to `deferred-items.md` instead.
- **Verification:** `node tests/test-355-direction-agreement.cjs 2>&1 | grep -E "^FAIL: [A-G] "` -- zero matches (confirmed A through G all green); the sole remaining `FAIL:` line is `H one rule: ... (unresolved hits: lib/core/rs-chain-feeder.cjs, lib/memory/test-rs-discovery-engine.cjs)`.
- **Committed in:** `7183f3608` (deferred-items.md correction)

**2. [Documented finding, not a fix] Five unfiltered REVERSE_SALIENT readers + one adjacent writer conflict, recorded for 355-12**
- **Found during:** Task 1's must_haves-mandated `grep -rn "REVERSE_SALIENT" lib scripts --include=*.cjs` sweep
- **Issue:** `lib/core/nl-graph-queries.cjs`, `lib/chat/fabric-chat.cjs`, `lib/core/futures/orchestrator.cjs` (`runRSReverseSalient`'s post-invocation count), `scripts/generate-snapshot.cjs`, and `scripts/extract-room-intelligence.cjs` all query or tally `REVERSE_SALIENT`-typed edges without filtering on `properties.source === 'rs-engine'`. Additionally, `scripts/hsi-to-graph.cjs`'s own cleanup DELETE is unconditional on type, not source -- it would delete rs-engine-sourced edges too, contradicting this plan's own must_haves claim that they are "unaffected" by an hsi-to-graph run.
- **Why not fixed:** Reading and filtering these readers is explicitly 355-12's stated scope ("stored-label readers re-derive direction through the module"), not this plan's. `hsi-to-graph.cjs` is not in this plan's `files_modified` either.
- **Files modified:** none (documentation only, `deferred-items.md`)
- **Verification:** each of the five readers re-read directly at its cited line; `lib/core/leverage-scan.cjs`'s superficially-similar query was checked and confirmed already correctly filtered in JS, excluded from the list.
- **Committed in:** `7183f3608`

---

**Total deviations:** 0 auto-fixed; 2 documented scope items (both informational carry-forwards for 355-12, no functional impact on this plan's own seven-file deliverable).
**Impact on plan:** None on this plan's own acceptance criteria -- both tasks' verify commands and acceptance_criteria lines pass exactly as specified; leg G (this plan's stated gate) is fully green.

## Issues Encountered

- `git commit --only -- <path>` failed with "pathspec did not match" the first time on `-m` message ordering (the `-m "..."` flag must precede `--only -- <paths>`, not follow it) -- corrected on the retry, no functional issue.
- `.planning/ROADMAP.md` on disk carried a peer session's concurrent, unrelated whitespace hunk (a blank-line removal near Phase 267), exactly as flagged in the shared-tree briefing. Resolved via the 355-10 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, then committed the index directly (no `--only`, no `-a`). Confirmed via `git diff --cached` before committing that exactly my two hunks were staged; confirmed via `git diff` after committing that the peer's hunk remains unstaged and untouched on disk.
- `.planning/phases/355-.../deferred-items.md` is gitignored (`.planning/phases/**`) but was already tracked from a prior plan's `git add -f`; `git commit --only -- <path>` on an ignored-but-tracked path failed with "The following paths are ignored" (the `--only` pathspec resolution respects `.gitignore` even for already-tracked files). Resolved with `git add -f <path>` first, confirmed via `git diff --cached --name-only` that only this one file was staged, then a plain `git commit` (no `--only`, no `-a`) on the clean single-file index.
- `bash tests/run-all-355.sh` re-run in full this session (not skipped, unlike the 355-09/355-10 precedent): `PASS=34 FAIL=3 SKIP=6`, up from the pre-plan baseline `PASS=33 FAIL=3 SKIP=6` the orchestrator's briefing quoted -- the +1 PASS is `test-355-direction-agreement.cjs`'s own internal count improving (leg G's 4 checks flipping PASS), and the FAIL count stayed at exactly the 3 pre-existing, already-documented failures (`test-355-direction-agreement.cjs` -- now leg-H-only; `run-all-272.sh` -- the `@huggingface/transformers` version gap; `part8-egress-guard.test.cjs` -- PB8-03). No new regression introduced by this plan.
- `node scripts/build-command-registry.cjs --check`, `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs` all pass. `check-shape-declaration.cjs --check` prints the same 53 pre-existing WARN-level advisories (non-blocking per CLAUDE.md's Canon Part 11 description) unrelated to any file this plan touched; exit code 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Leg G of `tests/test-355-direction-agreement.cjs` is green (the Python detector is off all four live callers: `lib/core/intelligence-cascade.cjs`, `scripts/scout-cadence-runner.cjs`, `commands/scout.md`, `skills/scout/SKILL.md`). Leg H remains red with exactly 2 unresolved hits (`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`) -- outside this plan's declared scope, carried forward; **the agreement test is NOT fully green after this plan** (legs A-G pass, leg H does not).
- `deferred-items.md` carries two new entries for 355-12: the leg H scope correction, and five unfiltered `REVERSE_SALIENT` readers (`lib/core/nl-graph-queries.cjs`, `lib/chat/fabric-chat.cjs`, `lib/core/futures/orchestrator.cjs`, `scripts/generate-snapshot.cjs`, `scripts/extract-room-intelligence.cjs`) plus one adjacent writer conflict (`scripts/hsi-to-graph.cjs`'s unconditional DELETE potentially clearing rs-engine-sourced edges too) -- all read_first material for 355-12's "stored-label readers re-derive direction through the module" scope.
- `scripts/scout-cadence-runner.cjs`'s `rs-engine-cjs` step is a new SCHED-02 sensor now strictly more reliable than what it replaced (runs regardless of scikit-learn availability); any future cadence-suite change should keep this step name (`names.includes('rs-engine-cjs')` is now the pinned assertion in `tests/test-scout-cadence-fires.cjs`).
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..10 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-11 checked, Plans counter 10/28) is the durable progress record instead.
- Blocker/concern carried forward: none blocking 355-12 or any other 355 plan; every deviation above is documentation-only, logged for the next executor's read_first, not a functional gap in this plan's own seven-file deliverable.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*
