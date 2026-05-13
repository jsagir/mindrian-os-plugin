---
phase: 124-feynman-temporal-awareness
plan: "02"
subsystem: feynman-temporal-awareness
tags: [canon-part-9, canon-part-5, feynman-md, sentinel-bounded, atomic-write, idempotent, memory-event, watermark, runner]
dependency_graph:
  requires:
    - 124-00 (substrate: 4 RED test stubs + scoped runner + EVENT_TYPES floor; aggregator registration)
    - 124-01 (renderer: lib/core/feynman/timeline-renderer.cjs + isoSecond helper + firstCapturedLastTouchedBySection navigation re-export)
    - 109 (memory_event log + navigation.cjs chokepoint + findRecentChanges + logMemoryEvent re-export)
    - 110-02 (EVENT_TYPES additive +3 idiom this plan mirrors)
  provides:
    - timeline-runner-orchestrator (lib/core/feynman/timeline-runner.cjs::refreshAll + refreshSection)
    - sentinel-bounded-merge-helper (mergeSentinelSection + bodyOutsideSentinels + SHA256 byte-preservation invariant)
    - atomic-write-helper (atomicWrite: .tmp + fsync + rename)
    - frontmatter-parser-helper (parseFrontmatter + serializeFrontmatter; hand-rolled, no gray-matter)
    - findFeynmanSections-walker (room dir -> sorted list of section slugs with FEYNMAN.md)
    - feynman_timeline_refreshed-event-type (D-10 telemetry surface; success log)
    - feynman_timeline_refresh_failed-event-type (D-10 telemetry surface; failure log; reason truncated 200 chars)
  affects:
    - lib/core/navigation/memory-events.cjs (EVENT_TYPES Set +2; 35 -> 37 baseline; coexists with Phase 125-01 framework_invoked +1)
    - bash tests/run-all-124.sh (2/4 -> 3/4 green; canon-invariant stays RED for Plan 124-04)
tech_stack:
  added: []  # zero new npm deps
  patterns:
    - sentinel-bounded auto-section in a human-authored markdown file (D-02 hard invariant; first concrete instance of this pattern in the codebase)
    - hand-rolled frontmatter line-walk parse (mirrors scripts/frontmatter-schema-validator.cjs idiom; no gray-matter)
    - atomic .tmp + fsync + rename write (mirrors scripts/vault-section-minto-generator.cjs idiom)
    - additive EVENT_TYPES extension with named-block comment (mirrors Phase 110-02 brain_* idiom verbatim)
    - watermark-skip via ISO 8601 lex-compare at second resolution (D-09 cheap regen check)
key_files:
  created:
    - lib/core/feynman/timeline-runner.cjs (281 lines; the orchestrator)
  modified:
    - lib/core/navigation/memory-events.cjs (+13 lines; EVENT_TYPES Set additive +2)
    - tests/test-feynman-timeline-runner.cjs (was 9-line RED stub; now 312-line integration suite with 8 tests)
decisions:
  - "D-02 honored: human body outside sentinels is byte-preserved across regeneration, asserted via SHA256 hash equality in Test 1. The atomic .tmp + rename write means the original survives any failure -- proven in Test 6 with monkey-patched renderer throw."
  - "D-09 honored: timeline_last_rendered frontmatter watermark is set to second-resolution ISO after every successful refresh (renderer.isoSecond(now_ms)); watermark check uses string lex-compare on ISO 8601 second-resolution which is safely lex-sortable; skip path returns { status: 'skipped_watermark', reason: 'sql_older_than_rendered' } and the file stays byte-unchanged."
  - "D-10 honored: feynman_timeline_refreshed logged on every successful write; feynman_timeline_refresh_failed logged on every caught exception with reason truncated to 200 chars (never the body). Both events fire via navigation.logMemoryEvent (Phase 110-03 re-export); no direct internal-module reach."
  - "Idempotency contract met: re-running refreshSection with the same now_ms against an already-rendered section produces a byte-identical file. The watermark check forces the second run into skipped_watermark; if the user passes force=true, the deterministic renderer still produces identical bytes."
  - "Zero net new Brain surface (Canon Part 8): the runner requires only node:fs, node:path, node:crypto, ./timeline-renderer.cjs, ../navigation.cjs. No fetch, no http/https, no brain-client, no child_process. Verified by grep sweep over the source."
  - "Frontmatter is force-emitted on every refresh (even when the original file had none), so the watermark always lands at the top of the file. Pre-existing frontmatter keys are preserved byte-identical via the fmOrder round-trip stash."
  - "EVENT_TYPES size coexists with Phase 125-01 (concurrent session shipped framework_invoked +1 on the same Set). Plan 124-02 adds +2 (Phase 124 block); current size = 38 (was 35 baseline + 125-01's +1 = 36; this plan's +2 = 38). The plan invariant 'size >= 37' is satisfied."
  - "Failure-path coverage: Test 6 exercises BOTH the structural-status path (FEYNMAN.md is a directory -> skipped_no_feynman) AND the true-failure path (monkey-patched renderer throws -> failed status + reason truncated <= 200 + original file survives + feynman_timeline_refresh_failed memory_event logged)."
metrics:
  duration_minutes: 16
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  tests_added: 8
  completed: 2026-05-13
requirements:
  - TEMPORAL-124-01  # runner exists with refreshAll + refreshSection
  - TEMPORAL-124-03  # sentinel-bounded merge + body byte-identical SHA256 invariant
  - TEMPORAL-124-08  # timeline_last_rendered watermark frontmatter + skip path
  - TEMPORAL-124-09  # feynman_timeline_* memory_event logging on success + failure
---

# Phase 124 Plan 02: FEYNMAN.md Timeline Runner Summary

The side-effect orchestrator behind the pure renderer from Plan 124-01: walks a room's section folders, finds each FEYNMAN.md, applies the D-02 sentinel-bounded merge over the rendered markdown body, writes back atomically (.tmp + fsync + rename), updates the timeline_last_rendered frontmatter watermark, and logs a memory_event on every refresh attempt -- success or failure. The human body outside the sentinels is byte-preserved across regeneration, asserted by SHA256 hash equality in the integration test. The runner is idempotent: re-running with no new SQL events skips on the watermark, producing a byte-identical file. The Plan 124-04 Canon-Part-9-invariant suite stays RED-by-design; the other three Phase 124 suites are now GREEN.

## What Shipped

### 1. EVENT_TYPES extension (D-10 additive +2)

`lib/core/navigation/memory-events.cjs` -- the closed frozen Set gains two strings in a new Phase 124-02 comment block, placed immediately AFTER the Phase 110-02 brain_* block and BEFORE the Phase 125-01 framework_invoked block:

- `feynman_timeline_refreshed` -- the runner successfully rendered + wrote the sentinel-bounded `## Timeline (auto)` section for one FEYNMAN.md (per section, per refresh).
- `feynman_timeline_refresh_failed` -- the runner caught an exception during render or write; watermark NOT updated; FEYNMAN.md NOT corrupted (atomic .tmp write means the original is preserved on failure).

Mirrors the Phase 110-02 3-string idiom verbatim. logEvent already rejects event_type values outside EVENT_TYPES -- the two new strings are accepted only because they are now IN the Set. Set size growth: 36 (35 baseline + Phase 125-01's framework_invoked +1) -> 38 (Phase 124-02 +2). The plan-invariant size floor of >= 37 is satisfied.

### 2. The orchestrator: lib/core/feynman/timeline-runner.cjs (281 lines, new)

The runner exports:

- `refreshAll(roomDir, opts) -> { refreshed: [...], skipped: [...], failed: [...] }` -- walks roomDir for subdirectories containing a FEYNMAN.md, calls refreshSection for each, aggregates.
- `refreshSection(roomDir, sectionSlug, opts) -> { status, reason?, written_path?, watermark? }` -- the per-section orchestrator. status in `'refreshed' | 'skipped_watermark' | 'skipped_no_feynman' | 'failed'`.
- `SENTINEL_START` = `<!-- TIMELINE_AUTO_START -->`, `SENTINEL_END` = `<!-- TIMELINE_AUTO_END -->`, `HEADER` = `## Timeline (auto)` (constants).
- Internal helpers exported for testability: `parseFrontmatter`, `serializeFrontmatter`, `mergeSentinelSection`, `bodyOutsideSentinels`, `sha256Hex`, `atomicWrite`, `findFeynmanSections`, `shouldSkipWatermark`.

The orchestration flow per section:

1. Read FEYNMAN.md utf8 (skipped_no_feynman if file is missing or a directory).
2. Parse frontmatter (hand-rolled line-walk; preserves key order via fmOrder stash).
3. D-09 watermark check: if `timeline_last_rendered` is a string AND `firstCapturedLastTouchedBySection(db, sectionSlug)` returns total_events > 0 AND the SQL ISO is <= the frontmatter ISO (ISO 8601 second-resolution; lex-sortable) -> skipped_watermark.
4. Call `renderer.renderTimeline(db, sectionSlug, { now_ms })` to get the pure markdown body + summary stats.
5. Apply D-02 sentinel-bounded merge: if the pair exists, replace the content between SENTINEL_START and SENTINEL_END; if absent, append `\n\n## Timeline (auto)\n\n<SENTINEL_START>\n<rendered>\n<SENTINEL_END>\n` at end-of-file (ensures trailing newline).
6. Update `timeline_last_rendered` in the frontmatter (force-emit even when none existed); serialize and reassemble.
7. Atomic write: `.tmp.<pid>.<ts>` -> fsync -> rename (no partial-write corruption possible).
8. Log `feynman_timeline_refreshed` memory_event via `navigation.logMemoryEvent` (Phase 110-03 re-export).
9. On any caught exception -> log `feynman_timeline_refresh_failed` with reason truncated to 200 chars, return `{ status: 'failed', reason }`. Atomicity means the original file survives.

Requires only: `node:fs`, `node:path`, `node:crypto`, `./timeline-renderer.cjs`, `../navigation.cjs`. Zero new npm deps. Canon Part 8 boundary preserved: zero fetch / http / https / brain-client / child_process surface.

### 3. The integration test: tests/test-feynman-timeline-runner.cjs (8 tests, fills 124-00 RED stub)

| # | Name | What it Asserts |
| - | ---- | --------------- |
| 1 | EVENT_TYPES extended | Both new strings present; prior phase strings (Phase 110-02 brain_*, Phase 89-07 reverse_salient_*, Phase 116-00 tension_*, Phase 117-00 auto_explore_*) preserved; size floor >= 37 |
| 2 | Sentinel replace + body byte-identical | Seeded fixture with sentinels + human body; assert OLD CONTENT replaced; SHA256(body_outside_sentinels_pre) === SHA256(body_outside_sentinels_post). The D-02 hard invariant |
| 3 | Watermark frontmatter set | No-frontmatter fixture; assert frontmatter fence added + `timeline_last_rendered: <ISO>` key matches result.watermark |
| 4 | Idempotent re-run | Same now_ms twice -> byte-identical SHA256(file); second run is either `skipped_watermark` or `refreshed` (both produce identical bytes) |
| 5 | Watermark skip | Frontmatter set to far-future ISO + stale events; assert status=`skipped_watermark` + reason=`sql_older_than_rendered` + file byte-unchanged |
| 6 | Failure handling | a) FEYNMAN.md as directory -> structured status (no exception); b) renderer monkey-patched to throw -> status=`failed` + reason truncated <= 200 chars + original FEYNMAN.md survives byte-identical + `feynman_timeline_refresh_failed` memory_event logged |
| 7 | memory_event logged on success | findRecentChanges returns >= 1 row with eventType=`feynman_timeline_refreshed` and sourcePath=`feynman:market-analysis` |
| 8 | First-encounter sentinel append | No sentinels in fixture; assert sentinel pair + auto-header added; first 5 human lines byte-identical (post frontmatter strip); refreshAll on already-watermarked sections skips |

Framework: `node:assert/strict` + `node:sqlite` (Node 22+) + `node:fs/os/path/crypto`. Zero new npm deps. Exits 0 on PASS, 77 on SKIP (node:sqlite unavailable).

## Acceptance

### Phase 124 scoped runner

```
bash tests/run-all-124.sh
PASS test-feynman-timeline-renderer.cjs              (Plan 124-01)
PASS test-feynman-timeline-empty-state.cjs           (Plan 124-01)
PASS test-feynman-timeline-runner.cjs                (Plan 124-02 - this plan)
FAIL test-feynman-timeline-canon-part-9-invariant.cjs (Plan 124-04 - RED by design)

Summary (124 scoped): Total 4, Passed 3, Failed 1
```

This plan flips the count from 2/4 (where Plan 124-01 left it) to 3/4. The remaining RED suite is the Canon Part 9 invariant test (forbidden-substring sweep over renderer + runner source); it will be filled by Plan 124-04.

### Regression checks (no regressions)

- `bash tests/run-all-110.sh` -> 4/4 green (Brain Context Packet Contract; the additive EVENT_TYPES change does not regress the Phase 110 surface).
- `node tests/test-navigation-memory-events.cjs` -> 10/10 green (Phase 109 navigation memory events; includes test10_phase110BrainEventsAccepted which validates EVENT_TYPES extensibility).
- `node scripts/build-command-registry.cjs --check` -> exit 0 (command registry intact; no new commands shipped this plan).
- `! grep -q '"ajv"' package.json` -> ajv NOT in package.json (no new npm deps).
- `! grep -E "require\(.*brain-client|fetch\(|http\.request|https\.request|require\(.*child_process" lib/core/feynman/timeline-runner.cjs` -> 0 matches (Canon Part 8 boundary preserved).
- `! grep -P "[\x{2014}\x{2013}]" lib/core/feynman/timeline-runner.cjs lib/core/navigation/memory-events.cjs tests/test-feynman-timeline-runner.cjs` -> 0 matches (no em-dashes or en-dashes per project hard rule).

### Invariants exported by this plan

- `lib/core/feynman/timeline-runner.cjs` exists with `refreshAll`, `refreshSection`, `SENTINEL_START`, `SENTINEL_END`, `HEADER` exports.
- `SENTINEL_START === '<!-- TIMELINE_AUTO_START -->'` and `SENTINEL_END === '<!-- TIMELINE_AUTO_END -->'` (locked literals; constants per D-02).
- `lib/core/navigation/memory-events.cjs::EVENT_TYPES` contains `feynman_timeline_refreshed` and `feynman_timeline_refresh_failed`.
- `EVENT_TYPES.size >= 37` (plan-invariant; current value is 38 because Phase 125-01's framework_invoked also shipped on main).

## Concurrent Session Awareness

While this plan executed on `main`, a parallel agent shipped Phase 125-00, 125-01, 125-02, 125-03, and 125-04 commits on the same branch. The interleaving was:

```
bf4733e test(124-02): fill tests/test-feynman-timeline-runner.cjs ...   <- Task 3
e7e7fba feat(125-03): stitch framework_chain_hint into buildBrainPacket
cf5ed0b test(125-03): add failing tests for framework_chain_hint stitch
b1cfac4 docs(125-00): complete writeEdge navigation chokepoint primitive plan
6677d6c feat(124-02): add lib/core/feynman/timeline-runner.cjs ...      <- Task 2
052c05e docs(125-01): add 125-01-SUMMARY.md
ed95471 docs(125-01): complete projections-pure-helpers plan
8612040 feat(124-02): extend EVENT_TYPES with feynman_timeline_* ...    <- Task 1
014a3c1 docs(125-04): complete framework-chain-hint schema extension plan
d4642bc feat(125-02): ship Brain Cypher slice surface
```

Explicit pathspec on every commit (`git commit ... -- lib/core/feynman/timeline-runner.cjs`) kept the Phase 125 working tree out of our commits. Verified via `git show --name-only` per commit:

- 8612040 -> `lib/core/navigation/memory-events.cjs` only
- 6677d6c -> `lib/core/feynman/timeline-runner.cjs` only
- bf4733e -> `tests/test-feynman-timeline-runner.cjs` only

Zero Phase 125 contamination. The EVENT_TYPES Set additive idiom (Phase 110-02 pattern, mirrored here) is the right shape for parallel work: each phase appends in its own commented block, no merge conflicts as long as both phases append to the same array.

## Deviations from Plan

### Auto-fixed (Rules 1-3)

**1. [Rule 2 - Missing test coverage] Test 6 (failure handling) needed a true-failure path that actually exercises the runner's catch-block.**

- **Found during:** Initial run of Task 3 integration test.
- **Issue:** The plan's Test 5 (failure handling) suggested a FEYNMAN.md-as-directory fixture, but `safeIsFile` returns false for a directory -> the runner returns `skipped_no_feynman` (not `failed`) without entering the try-catch. The plan's "no exception, no corruption" invariant was met but the actual failed-status branch + reason-truncation + `feynman_timeline_refresh_failed` event logging path was not exercised.
- **Fix:** Extended Test 6 to also include a true-failure path: monkey-patched `renderer.renderTimeline` to throw a synthetic 250-char error; asserted `result.status === 'failed'` + `reason.length <= 200` (truncation) + the original FEYNMAN.md survives byte-identical (atomicity) + a `feynman_timeline_refresh_failed` memory_event was logged. Both paths now covered in a single test function.
- **Files modified:** `tests/test-feynman-timeline-runner.cjs`.
- **Why this is Rule 2 not Rule 4:** Test coverage of the failure path is essential correctness verification; the runner DOES catch exceptions (the production behavior is correct), the test simply needed to actually drive that path. No architectural change.
- **Commit:** bf4733e.

### Architectural changes

None.

### Authentication gates

None encountered.

## Known Stubs

None. The runner is fully wired into Plan 124-01's pure renderer + the Phase 109 navigation chokepoint. Plan 124-03 (the session-start cascade + the /mos:feynman-timeline-refresh manual command) is the next consumer; that's the wiring layer, not a stub. Plan 124-04 (the Canon Part 9 invariant test) is the last RED stub in Phase 124; it asserts forbidden-substring sweeps over the renderer + runner source already shipped.

## Phase 124 Progress

| Plan | Status | Suites GREEN | Notes |
| ---- | ------ | ------------ | ----- |
| 124-00 | shipped | 0/4 (substrate) | 4 RED test stubs, run-all-124.sh runner, EVENT_TYPES floor, aggregator registration |
| 124-01 | shipped | 2/4 | timeline-renderer.cjs + firstCapturedLastTouchedBySection navigation re-export |
| **124-02** | **this plan** | **3/4** | **timeline-runner.cjs + EVENT_TYPES +2 + runner integration suite** |
| 124-03 | pending | 3/4 | session-start cascade slot + /mos:feynman-timeline-refresh command |
| 124-04 | pending | 4/4 | Canon-Part-9-invariant test (the last RED stub) |

After this plan: 3 of 4 Phase 124 suites green. After Plan 124-04: 4 of 4.

## Commits

| Hash | Task | Files |
| ---- | ---- | ----- |
| 8612040 | Task 1: EVENT_TYPES +2 | lib/core/navigation/memory-events.cjs |
| 6677d6c | Task 2: timeline-runner.cjs | lib/core/feynman/timeline-runner.cjs |
| bf4733e | Task 3: integration suite | tests/test-feynman-timeline-runner.cjs |

## Self-Check: PASSED

- `lib/core/feynman/timeline-runner.cjs` -> FOUND
- `tests/test-feynman-timeline-runner.cjs` -> FOUND (real implementation, not stub; exits 0)
- `lib/core/navigation/memory-events.cjs` -> FOUND (modified; EVENT_TYPES.size = 38; both feynman_timeline_* strings present)
- Commit 8612040 -> FOUND in git log
- Commit 6677d6c -> FOUND in git log
- Commit bf4733e -> FOUND in git log
- `node tests/test-feynman-timeline-runner.cjs` exits 0 with 'PASS test-feynman-timeline-runner.cjs (8 tests)'
- `bash tests/run-all-124.sh` reports 3/4 (canon-invariant RED by design for Plan 124-04)
- `bash tests/run-all-110.sh` reports 4/4 (no regression)
- `node tests/test-navigation-memory-events.cjs` reports 10/10 (no Phase 109 regression)
- `node scripts/build-command-registry.cjs --check` exits 0
- ajv NOT in package.json (no new npm deps)
- Zero forbidden imports in `lib/core/feynman/timeline-runner.cjs` (no brain-client, no fetch, no http/https, no child_process)
- Zero em-dashes or en-dashes in any shipped file
- Each of the three commits touches exactly the files this plan owns (verified via `git show --name-only`); zero Phase 125 contamination
