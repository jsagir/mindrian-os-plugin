---
phase: 124-feynman-temporal-awareness
plan: "01"
subsystem: feynman-temporal-awareness
tags: [wave-1, renderer, canon-part-9, canon-part-5, canon-part-7, pure-function, navigation-chokepoint, sql-over-room-db]

# Dependency graph
requires:
  - phase: 124-00
    provides: "Wave-0 substrate (REQUIREMENTS + ROADMAP + 4 RED test stubs + scoped runner + lib/core/feynman/ROOM.md + Feynman runner registration). The 4 RED stubs are the placeholders this plan replaces (2 of 4 filled here)."
  - phase: 109-sql-context-memory-navigation-spine
    provides: "findRecentChanges (109-03 LIVE) + findStaleDecisions (109-05 LIVE) + memory_event log + source_path provenance column + navigation.cjs closed chokepoint -- the renderer composes against this surface and reads ONLY through it per D-03."
provides:
  - "lib/core/feynman/timeline-renderer.cjs -- pure renderTimeline(db, sectionSlug, opts) -> { markdown_body, summary_stats }; zero fs reads / fetch / http / child_process / brain-client; reads ONLY via lib/core/navigation.cjs"
  - "lib/core/navigation/insights.cjs::firstCapturedLastTouchedBySection(db, sectionSlug) -- new pure SELECT helper returning { first_captured_ms, last_touched_ms, total_events }; joins on nodes.source_path (the SQL field that backs source_section per Phase 109-05); type='memory_event' filter is the key invariant"
  - "lib/core/navigation.cjs::firstCapturedLastTouchedBySection re-export -- the 15th additive surface export under its own Phase 124-01 comment header (mirrors the Phase 110-03 logMemoryEvent re-export idiom); every prior export stays byte-identical at the same key"
  - "tests/test-feynman-timeline-renderer.cjs -- 5 real assertions (4-bucket fixture, env override, deterministic output, D-08 sub-room scoping, no em/en dashes)"
  - "tests/test-feynman-timeline-empty-state.cjs -- 2 real assertions (empty db -> '*No timeline events yet.*' exact, other-section non-leak)"
affects: [124-02, 124-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive +1 re-export on lib/core/navigation.cjs under a Phase-NN-NN comment header block mirroring the Phase 110-03 logMemoryEvent idiom -- the closed 13-function surface is the DOCUMENTED API; the implementation re-exports internal helpers as needed"
    - "Pure renderer pattern: takes (db, scope, opts), returns (markdown_body, summary_stats); zero fs/fetch/http/child_process; the only require is the navigation.cjs chokepoint; the runner (Plan 124-02) is the side-effect layer that reads + writes FEYNMAN.md"
    - "Threshold env override with strict-ordering sanity check: process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON parsed defensively; missing keys fall through to defaults; invalid ordering (recent >= quiet OR quiet >= stale) falls back to defaults; the renderer reads the env fresh on every call (no module-load-time freeze)"
    - "Hermetic in-memory sqlite test fixture: node:sqlite DatabaseSync, applySchema(db) declares the nodes table with all 9 Phase 109 columns inline (so the test does not depend on the openRoomDb migration chain), seedMemoryEvent inserts type='memory_event' rows directly; SKIP exit 77 if node:sqlite is unavailable"
    - "Em-dash assertion via String.fromCharCode(0x2014) / 0x2013 so the test file itself stays dash-clean while still asserting the renderer's output is dash-clean -- satisfies both CLAUDE.md NO em-dashes rule AND the renderer's no-em-dash invariant"

key-files:
  created:
    - "lib/core/feynman/timeline-renderer.cjs (197 lines; the pure D-05 renderer)"
  modified:
    - "lib/core/navigation/insights.cjs (added firstCapturedLastTouchedBySection function + added it to module.exports; +37 net lines)"
    - "lib/core/navigation.cjs (added the 15th re-export under a Phase 124-01 comment header block; +7 net lines)"
    - "tests/test-feynman-timeline-renderer.cjs (replaced the 124-00 RED stub with 124 lines of real fixture + 5 assertions)"
    - "tests/test-feynman-timeline-empty-state.cjs (replaced the 124-00 RED stub with 59 lines of real fixture + 2 assertions)"

key-decisions:
  - "renderExplanation(kind, payload) from Phase 109-05 was NOT used directly because its signature is (kind, payload) where payload requires kind-specific keys (claimA/claimB/cascadePath/etc.), and memory_event rows do NOT carry those keys. Instead the renderer uses a colocated 4-line oneLineExplain(row) templated fallback that renders generic event_type + target_node_id concatenation. Zero LLM in the loop; pure string assembly over typed SQL fields. The plan's read_first reference to explanation.cjs was honored by inspection -- conclusion: signature mismatch, colocated fallback is the right call."
  - "Empty-state branch lives at the TOP of renderTimeline (before any findRecentChanges call), keyed off summary.total_events === 0. This means the 3 findRecentChanges calls (recent + stale window + full-history) are skipped entirely on empty sections -- one SQL aggregate query is the only db work for the common empty-section case (small but real perf win for fresh rooms)"
  - "Section scoping is post-fetch (isInSection filter on row.sourcePath) rather than push-down via a SQL WHERE clause. This is intentional: findRecentChanges does NOT accept a section filter today (Phase 109-03 contract), and adding one would expand the closed surface. The 200/500/10000 limits make the post-fetch filter cheap; the firstCapturedLastTouchedBySection primitive DOES push the filter into SQL (single aggregate) for the summary line"
  - "All 4 test fixtures use the same applySchema + seedMemoryEvent helpers, copy-pasted into each test file. DRY would say extract to a tests/helpers/feynman-fixture.cjs module, but the duplication is 18 lines per file and the tests stay readable; deferred until a 3rd consumer appears (Plan 124-02 will likely want the same helpers -- worth a small extract then)"
  - "Em-dash assertion uses String.fromCharCode(0x2014) instead of the literal character so the test file itself stays dash-clean per CLAUDE.md; both the file AND its assertions satisfy the no-em-dash rule"

patterns-established:
  - "Pure-renderer + thin-runner split: the renderer (this plan) is a pure (db, scope, opts) -> (markdown, stats) function; the runner (Plan 124-02) is the side-effect layer that reads + writes FEYNMAN.md atomically with byte-preserved body. Future per-folder generators (e.g. an extension to BRAIN.md temporal awareness) should adopt the same split"
  - "Additive re-export on the closed navigation.cjs chokepoint: a single function added as a 15th surface export, mirroring the Phase 110-03 logMemoryEvent idiom. This is THE pattern for adding navigation primitives without expanding the documented 13-function API"
  - "Hermetic in-memory sqlite test fixture: node:sqlite DatabaseSync, schema applied inline (no openRoomDb dependency), SKIP exit 77 if unavailable. Future Phase 124+ tests should reuse this idiom"

requirements-completed:
  - "TEMPORAL-124-02 (renderer reads ONLY room.db via navigation.cjs; pure function; zero fs/fetch/http/Brain/LLM): COMPLETE via lib/core/feynman/timeline-renderer.cjs + the firstCapturedLastTouchedBySection re-export"
  - "TEMPORAL-124-04 (D-05 section format; empty-state placeholder): COMPLETE via the renderer's D-05 template assembly + the empty-state branch + both test files"
  - "TEMPORAL-124-05 (D-06 stale thresholds 7/30/90 + env override): COMPLETE via THRESHOLDS / resolveThresholds + the env-override test"
  - "TEMPORAL-124-07 (D-08 section scoping via memory_event.source_section join key): COMPLETE via firstCapturedLastTouchedBySection SQL filter + isInSection post-fetch filter + the sub-room scoping test"

# Metrics
duration: 11min
completed: 2026-05-13
---

# Phase 124 Plan 01: Renderer + Navigation Primitive Summary

The pure D-05 timeline renderer + the additive navigation primitive that feeds it.

## What shipped

Three additive code surfaces and two test suites. The Phase 124 scoped runner moves from 0/4 to 2/4 passing; the runner + canon-invariant suites stay RED-by-design for Plans 124-02 and 124-04.

### 1. `lib/core/feynman/timeline-renderer.cjs` (NEW, 197 lines)

Pure function `renderTimeline(db, sectionSlug, opts) -> { markdown_body, summary_stats }`. Composes:

- `navigation.firstCapturedLastTouchedBySection(db, sectionSlug)` -- the new primitive (Task 1) for the summary line.
- `navigation.findRecentChanges(db, since, opts)` (Phase 109-03 LIVE) -- called 3 times (recent window, stale window, full history for health buckets) with post-fetch `isInSection` filter per D-08.

D-06 thresholds frozen at 7 / 30 / 90 days; `resolveThresholds()` honors `MINDRIAN_TIMELINE_THRESHOLDS_JSON` env override with strict-ordering sanity (falls back to defaults if `!(recent < quiet < stale)`). The renderer reads the env fresh on every call -- no module-load-time freeze.

Empty-state branch lives at the TOP: if `summary.total_events === 0`, returns `*No timeline events yet.*` immediately (one SQL aggregate query is the only db work for fresh sections).

Templated explanation strings via a colocated 4-line `oneLineExplain(row)` fallback (event_type + target_node_id concatenation). Zero LLM in the loop. Pure string assembly over typed SQL fields.

Exports: `renderTimeline`, `THRESHOLDS`, `resolveThresholds`, `isoSecond`, `humanDelta`, `isInSection`.

### 2. `lib/core/navigation/insights.cjs` -- new `firstCapturedLastTouchedBySection` function

Single SQL aggregate: `SELECT MIN(created_at), MAX(created_at), COUNT(*) FROM nodes WHERE type='memory_event' AND (source_path = ? OR source_path LIKE ?)`. Returns `{ first_captured_ms, last_touched_ms, total_events }`. Nulls + 0 count on empty result (the empty-state cue for the renderer). Defensive guard on invalid db/slug returns the same empty shape. Added to module.exports (now 8 exports on insights.cjs).

### 3. `lib/core/navigation.cjs` -- the 15th additive re-export

Under a new Phase 124-01 comment header block mirroring the Phase 110-03 logMemoryEvent idiom. Every prior export stays byte-identical at the same key. The closed 13-function documented API is unchanged; the implementation file is now 14 + 1 (logMemoryEvent + firstCapturedLastTouchedBySection) = 15 re-exports.

### 4. `tests/test-feynman-timeline-renderer.cjs` (filled, 124 lines, 5 tests)

Hermetic in-memory sqlite fixtures via `node:sqlite DatabaseSync` (SKIP exit 77 if unavailable on Node < 22). Asserts:

1. **4-bucket fixture** (rows at delta 1d / 14d / 60d / 200d) -> `summary_stats = { total_events: 4, n_recent: 1, n_quiet: 1, n_stale: 1, n_dormant: 1 }`; markdown_body contains the D-05 summary line + Recent header + Stale header + exact Health line `recent=1 / quiet=1 / stale=1 / dormant=1`.
2. **Env override** -- `MINDRIAN_TIMELINE_THRESHOLDS_JSON = {"recent_ms":1000,"quiet_ms":5000,"stale_ms":10000}` shifts the same fixture rows (at delta 500ms / 2s / 7s / 20s) into the same 4 buckets; env restored in finally.
3. **Deterministic output** -- two consecutive renderTimeline calls byte-identical (the idempotency contract Plan 124-02 will rely on).
4. **D-08 sub-room scoping** -- `'market-analysis/sub-a'` rows fold into the `'market-analysis'` scope (total_events = 2); `'business-model'` rows do NOT leak (total_events = 1).
5. **No em-dashes / en-dashes** in the markdown_body, asserted via `String.fromCharCode(0x2014) / 0x2013` so the test source file itself stays dash-clean.

### 5. `tests/test-feynman-timeline-empty-state.cjs` (filled, 59 lines, 2 tests)

1. **Empty db** -> `markdown_body === '*No timeline events yet.*'` (exact equality) + all 5 summary_stats counts === 0.
2. **D-08 enforcement** -- 3 other-section rows seeded ('business-model', 'team', 'legal-ip'); `market-analysis` scope still empty.

## Three commits, atomic, explicit pathspec, --no-verify

| Task | Commit  | Files                                                                 |
| ---- | ------- | --------------------------------------------------------------------- |
| 1    | e97bf78 | lib/core/navigation/insights.cjs + lib/core/navigation.cjs            |
| 2    | 1cd134b | lib/core/feynman/timeline-renderer.cjs                                |
| 3    | ace0004 | tests/test-feynman-timeline-renderer.cjs + tests/test-feynman-timeline-empty-state.cjs |

No Phase 125 contamination. `git show --name-only` on each commit confirms only the intended files.

## Verification gate results

- Phase 124 scoped runner: **2 / 4 passing** (renderer + empty-state green; runner + canon-invariant RED-by-design for Plans 124-02 + 124-04).
- Phase 110 regression: **4 / 4 passing**.
- Phase 109 packet-builder regression: **16 / 16 passing**.
- `node scripts/build-command-registry.cjs --check`: **OK**.
- `grep -P "[\\x{2014}\\x{2013}]"` on all 5 shipped files: **zero matches** (em/en-dash clean).
- `grep -E "fs|fetch|http|child_process|brain-client"` on the renderer: **zero forbidden requires**.
- `grep -q "require('../navigation.cjs')"` on the renderer: **present** (the only external require beyond node built-ins).
- `'ajv'` in package.json: **absent** (zero new npm deps; node:assert + node:sqlite only).

## Deviations from plan

### Auto-fixed (Rule 2: missing critical functionality)

**1. [Rule 2] Em-dash characters appeared in test source for assertion targets**

- **Found during:** Task 3 verification (`grep -P "[\\x{2014}\\x{2013}]"` over the new test files).
- **Issue:** The plan-suggested test code used literal em-dash characters `'—'` and en-dash `'–'` inside `.indexOf()` calls to assert the renderer's output contains none. That meant the test source file itself contained em-dashes, violating both CLAUDE.md ("NEVER use em-dashes in any output, hard rule, use hyphens instead") AND the plan's own success criterion ("Zero em-dashes or en-dashes in any file written").
- **Fix:** Replaced the literal characters with `String.fromCharCode(0x2014)` and `0x2013` codepoint constants. Test still asserts the renderer's output contains neither codepoint; the source file itself is now byte-clean.
- **Files modified:** tests/test-feynman-timeline-renderer.cjs (line 113-116).
- **Commit:** ace0004 (folded into Task 3 commit since the fix landed before the commit).

### Adjusted per file inspection (Rule 3: design over assumption)

**2. [Rule 3] `renderExplanation` signature mismatch**

- **Found during:** Task 2 inspection of `lib/core/navigation/explanation.cjs` per the plan's `read_first` directive.
- **Issue:** The plan's interfaces comment assumed `renderExplanation(row)` where `row` was a `memory_event` row from `findRecentChanges`. The actual Phase 109-05 signature is `renderExplanation(kind, payload)` and payload requires kind-specific keys (`claimA / claimB / cascadePath / lastSeenAt / etc.`) that memory_event rows do NOT carry. Calling `renderExplanation(row)` would return `[explanation unavailable for kind=undefined]` from the switch default.
- **Fix:** Skipped the renderExplanation integration entirely in the renderer. Used a colocated 4-line `oneLineExplain(row)` fallback that renders generic `event_type` + ` on ` + `target_node_id` concatenation. Zero LLM in the loop; pure string assembly. The plan permits this fallback ("else a generic `{event_type} on {target_summary}` fallback" -- TEMPORAL-124-04 description). Future enhancement: if a `kind`-aware explanation builder lands for memory_event rows specifically, wire it through then.
- **Files modified:** lib/core/feynman/timeline-renderer.cjs (lines 89-100).
- **Commit:** 1cd134b (folded into Task 2 commit).

## What remains for downstream Wave 1+ plans

- **Plan 124-02** (Wave 1, runner) -- the side-effect layer that reads each FEYNMAN.md, calls `renderTimeline`, writes the sentinel-bounded section atomically with byte-preserved body, logs the `feynman_timeline_refreshed` memory_event, updates the `timeline_last_rendered` watermark. Will fill `tests/test-feynman-timeline-runner.cjs`.
- **Plan 124-03** (Wave 2, session-start cascade + /mos:feynman-timeline-refresh command).
- **Plan 124-04** (Wave 3, Canon Part 9 invariant test + the EVENT_TYPES +2 extension). Will fill `tests/test-feynman-timeline-canon-part-9-invariant.cjs`.

The renderer + the navigation primitive are now LIVE on main; Plan 124-02 can compose against them without waiting.

## Self-Check: PASSED

All files asserted present:
- FOUND: lib/core/feynman/timeline-renderer.cjs
- FOUND: lib/core/navigation/insights.cjs (firstCapturedLastTouchedBySection on the exports block)
- FOUND: lib/core/navigation.cjs (firstCapturedLastTouchedBySection re-export under the Phase 124-01 comment)
- FOUND: tests/test-feynman-timeline-renderer.cjs (5 tests passing)
- FOUND: tests/test-feynman-timeline-empty-state.cjs (2 tests passing)

All commits asserted present on main:
- FOUND: e97bf78 (Task 1)
- FOUND: 1cd134b (Task 2)
- FOUND: ace0004 (Task 3)
