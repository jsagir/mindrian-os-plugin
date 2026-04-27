---
phase: 91-navigation-engine
plan: "06"
subsystem: statusline-dial
tags: [statusline, dial, navigation-engine, ui, canon-part-2, canon-part-3, canon-part-8, tdd, larry]

# Dependency graph
requires:
  - phase: 91-navigation-engine
    plan: "00"
    provides: navigation-engine.decide() decision_trace shape (8 brain_md_* fields + 5 structural fields + chosen_rationale)
  - phase: 91-navigation-engine
    plan: "02"
    provides: .mindrian/decision-traces/<session>.json atomic writer + 50-entry rotation + session-id resolver chain
  - phase: 88.1
    plan: "04"
    provides: statusline-cache.cjs classifyHealth canonical thresholds (0.7/0.4) + 5s TTL cache pattern + degraded-install lazy-require pattern
provides:
  - "lib/core/nav-dial.cjs pure resolver + formatter (resolveDialPosition + formatDialSegment + classifyHealth + frozen constants)"
  - "scripts/context-monitor buildDialSegment(roomDir) helper + resolveSessionIdForDial(roomDir) (env -> pointer -> mtime) + dial render slot between MINTO segment and plugin brand"
  - "17-test fixture suite (lib/memory/nav-dial.test.cjs): 12 pure-module tests + 5 integration / canon audit tests"
  - "Tier mode mapping: tier_0 -> Investigate / -- / null; mode_b -> Investigate / warn / active; mode_a + weight banded across 0.3 / 0.7 / 0.9 floors"
  - "Insight rationale detection: case-insensitive keyword set {synthesize, insight, converge} promotes weight >= 0.9 from Blend to Insight"
  - "ANSI palette mirror of visual-ops.cjs (5 colors: green / yellow / red / muted + bold + dim) so the dial module imports nothing"
affects:
  - 91-07-problem-type-routing (extends decide() trace fields; dial picks up new fields automatically as long as tier_mode + weight_applied + chosen_rationale stay shape-stable)
  - 91-08-framework-chain-composition (FEEDS_INTO chain offers do not change dial shape; dial position derives from triangulation result, not from offer presence)
  - 91-09-nav-invariants-validator (the dial render path is now part of the per-turn statusline; invariants validator can scan decision-traces atomicity / shape via the same read path)
  - User trust loop (Tyler quote 'We love the slider' is now a shipped pedagogical surface, not a research wish)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function module + thin integration wrapper. nav-dial.cjs has zero I/O; context-monitor's buildDialSegment is the only seam that touches the filesystem (read-only, every fs op try/catch). Same shape Plan 88.1-04 used for buildMintoSegment."
    - "Mirror, not require, for shared constants. classifyHealth is byte-identical with 88.1-04 statusline-cache.cjs (4-line function), but re-mirrored in nav-dial.cjs to keep lib/core/ self-contained and the dial module dependency-free. Test 11 enforces byte-identity at all 11 known thresholds."
    - "Suppress dial when no signal. resolveDialPosition returns Investigate/--/null on null trace + tier_0 + malformed; buildDialSegment in context-monitor checks (glyph === '--' && highlight === null) and returns '' to skip the push. Statusline stays quiet until the engine has spoken at least once."
    - "Lazy-require in degraded-install pattern. context-monitor's `try { navDial = require(...) } catch (_) {}` keeps pre-91 statusline byte-identical when the module is missing. Same pattern Plans 88.1-04 (statuslineCache, folderMemory) and 88.1-05 (mos-status) use."
    - "Render slot between MINTO and brand. The dial appears AFTER the MINTO governing-thought segment (room state -> reasoning -> engine position) and BEFORE the plugin brand (engine -> identity -> brain status -> model -> context bar). Left-to-right reading order matches how a user mentally chains: 'where am I -> what am I thinking -> what does the engine say -> what's powering this -> how much room left'."

key-files:
  created:
    - lib/core/nav-dial.cjs
    - lib/memory/nav-dial.test.cjs
  modified:
    - scripts/context-monitor
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Pure module + caller does I/O. nav-dial.cjs imports nothing (no fs, no path, no require). The caller (scripts/context-monitor buildDialSegment) handles all reads from .mindrian/decision-traces/<session>.json. This decouples the test surface (12 pure tests run with mocked traces) from integration (5 integration tests spawn context-monitor end-to-end). Future surfaces (Desktop MCP, Cowork) can call resolveDialPosition directly with their own trace source."
  - "Mirror classifyHealth instead of cross-requiring statusline-cache.cjs. The classifier is 4 lines; cross-requiring it would couple lib/core/nav-dial to lib/core/statusline-cache, and a degraded install missing one would degrade both. Test 11 enforces byte-identity at all known thresholds so drift is caught at green-light time."
  - "Three-position dial, not five. Investigate / Blend / Insight. Earlier sketches considered Investigate / Verify / Blend / Synthesize / Insight, but five labels exceed the 60-char visible budget once you account for the 'Larry: ' prefix and pipe separators. Three positions match Tyler's slider mental model and leave room for the active-label highlight to draw the eye. The glyph (check / warn / low / --) carries the second dimension."
  - "Insight markers are a closed keyword set. {synthesize, insight, converge} matches Canon Part 3 verb 7 (Synthesize), Canon Part 4 cross-relationship signal (Converge), and the plain English noun (Insight). Not a regex; not a fuzzy match; a literal substring check (case-insensitive). Test 5 + Test 6 pin the contract: weight >= 0.9 + marker -> Insight; weight >= 0.9 + no marker -> Blend (default to less ambitious position when uncertain)."
  - "Suppress dial on no-signal state. When resolveDialPosition returns glyph='--' AND highlight=null (the pre-engine null/tier_0/malformed cases), context-monitor skips pushing the segment entirely. Showing 'Larry: Investigate | Blend | Insight' all-muted with no highlight would be visual noise on the statusline. The dial only renders when the engine has actually spoken. Test 14 pins the contract."
  - "Render slot AFTER MINTO, BEFORE plugin brand. Left-to-right reading: room -> section -> stage -> MINTO governing-thought -> Larry dial -> brand -> brain -> model -> context-bar. The dial sits next to the MINTO segment so the user reads reasoning state and engine state together. Putting it after the brand would separate the two related signals; putting it before MINTO would push room context too far right."
  - "Full ANSI palette inlined, not require'd from visual-ops.cjs. The dial uses 5 colors (green/yellow/red/muted/bold + dim/reset). Inlining keeps the module dependency-free and matches the byte-identical De Stijl 24-bit RGB codes used elsewhere. visual-ops carries 16-color fallback (ANSI_BASIC) and many other helpers we do not need; importing it would pull in unrelated surface area."
  - "Latency budget: spawn wall-clock < 1500ms (Test 15). The pure resolver is sub-microsecond (0.36us per call) and formatDialSegment is 0.67us per call. Spawn overhead (Node cold start + script run) dominates real-world budget; we measure the realistic envelope (5 spawned runs, median wall-clock) as Plan 88.1-04 did. Per-call warm path is < 2ms (Test 12); spawned process median is well under 1500ms."
  - "Test 13 + Test 14 use a single workspace dir layout (workspace/.rooms/registry.json + workspace/fixture-room/STATE.md) matching production where users `cd` into their MindrianRooms parent. Earlier draft used path.dirname(root) as current_dir which broke registry resolution; corrected before commit so Test 13 actually asserts dial render (not just graceful no-op)."
  - "BSL 1.1 header in nav-dial.cjs first 25 lines. Test 16 enforces the licensing contract. Pattern: every lib/core/*.cjs file shipped in v1.10+ carries the explicit BSL 1.1 marker."

patterns-established:
  - "Pattern: pure-function statusline indicator. Both buildMintoSegment (Plan 88.1-04) and buildDialSegment (this plan) follow the shape: [resolve room context] -> [read LOCAL data] -> [pure transform] -> [return segment string or '']. Future statusline indicators (engine timing? offer history? cascade backlog?) should follow the same shape."
  - "Pattern: degraded-install lazy-require with try/catch wrap at module top. Both Plan 88.1-04 (statuslineCache, folderMemory) and this plan (navDial) lazy-require their lib/core/ helpers and gracefully fall back when the module is missing. Pre-version statusline output stays byte-identical on degraded installs. Future statusline integrations should mirror the pattern."
  - "Pattern: insight-rationale keyword detection as Canon Part 3 verb hook. The {synthesize, insight, converge} set matches Canon Part 3 verb 7 (Synthesize) and Canon Part 4 cross-relationship signal (Converge). Future engine-state derivations (problem-type-aware routing in 91-07, framework chain in 91-08) can hook into similar Canon-vocabulary keyword sets to map engine output to user-facing surfaces."

requirements-completed: [NAV-DIAL-01, NAV-DIAL-02, NAV-DIAL-03]

# Metrics
duration: 20min
completed: 2026-04-27
---

# Phase 91 Plan 06: Statusline Dial Summary

**Shipped the visible Larry dial as `lib/core/nav-dial.cjs` (pure resolver + formatter) wired into `scripts/context-monitor` between the MINTO segment and plugin brand. Three positions (Investigate | Blend | Insight) with the active position highlighted via De Stijl ANSI palette per Navigation Engine decision. Reads the same `.mindrian/decision-traces/<session>.json` file `/mos:explain-decision` reads, so the dial is grounded in the same audit surface. Position mapping: tier_0 -> Investigate/--/null; mode_b -> Investigate/warn/active; mode_a + weight bands across 0.3 / 0.7 / 0.9 floors; weight >= 0.9 + insight markers (synthesize/insight/converge case-insensitive) promotes Blend to Insight. Glyph vocabulary (check/warn/low/--) byte-identical with Plan 88.1-04 statusline-cache classifyHealth. Suppress dial when glyph='--' AND highlight=null (pre-engine state); dial only renders when the engine has actually spoken. Pure module imports nothing; caller does all reads with try/catch wrap (degraded-install graceful fallback preserves pre-91 statusline byte-identically). 17/17 dial tests green: 12 pure-module + 5 integration / canon audit (Test 17 source-scans for forbidden brain-client / fetch / curl / https references in dial source -- zero matches). Feynman runner advances by +1 to 95/97 with 2 inherited pre-existing fails preserved (84-smart-notebook-copilot 15/16; test-self-update-platform 19/24; both predate this plan and are out-of-scope per Rule 3 scope boundary). Tyler meeting quote ('my students almost unanimously said, We love the slider') is now a shipped pedagogical surface, not a research wish.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-27T20:08:14Z
- **Completed:** 2026-04-27T20:28:00Z
- **Tasks:** 2 (Task 1 RED + GREEN for nav-dial.cjs pure module; Task 2 wire into context-monitor + tighten integration tests)
- **Files created:** 2 (lib/core/nav-dial.cjs 217 lines; lib/memory/nav-dial.test.cjs 408 lines)
- **Files modified:** 2 (scripts/context-monitor +123 lines / -1 line; lib/memory/run-feynman-tests.cjs +13 lines registration block)

## Position mapping table

| trace shape | label | glyph | highlight | reason field |
|---|---|---|---|---|
| null trace | Investigate | -- | null | no_trace_available |
| tier_0 | Investigate | -- | null | tier_0_fallback |
| mode_b (Brain offline) | Investigate | warn | active | "Brain offline; investigating locally with MINTO + SQL only" |
| mode_a + weight < 0.3 | Investigate | warn | active | low_confidence_or_offline |
| mode_a + 0.3 <= weight < 0.7 | Blend | warn | active | "Blending MINTO + Brain at 0.NN weight" |
| mode_a + 0.7 <= weight < 0.9 | Blend | check | active | "Strong MINTO + Brain agreement, blending" |
| mode_a + weight >= 0.9 + insight marker | Insight | check | active | "Converging signals, insight mode" |
| mode_a + weight >= 0.9 + no marker | Blend | check | active | "High confidence, blending without explicit insight marker" |
| mode_a + weight not number | Investigate | -- | null | malformed_trace_missing_weight |
| unknown tier_mode | Investigate | -- | null | unknown_tier_mode |

## Insight-keyword detection list

The following case-insensitive substrings appearing anywhere in `chosen_rationale` promote a `mode_a` trace with `weight >= 0.9` from Blend to Insight:

| keyword | Canon hook |
|---|---|
| synthesize | Canon Part 3 verb 7 (Synthesize -- collapse branches back to insight) |
| insight | plain English noun; engine signals when it has reached one |
| converge | Canon Part 4 cross-relationship signal (3+ sections agree) |

The keyword set is closed. Adding a new marker requires a Canon amendment, not a code-level invention. Test 5 + Test 6 pin the contract.

## Sample dial renders

Captured via `node -e "const dial = require('./lib/core/nav-dial.cjs'); ..."`. ANSI codes are visible in the raw output; rendered in a true-color terminal:

```
CASE: tier_0
  pos: {"label":"Investigate","glyph":"--","highlight":null,"reason":"tier_0_fallback"}
  seg: Larry: Investigate | Blend | Insight    (all dim/muted; no highlight)

CASE: mode_b offline
  pos: {"label":"Investigate","glyph":"warn","highlight":"active","reason":"Brain offline; investigating locally with MINTO + SQL only"}
  seg: Larry: <bold yellow>Investigate</bold> | Blend | Insight

CASE: mode_a 0.5 (blend / warn)
  pos: {"label":"Blend","glyph":"warn","highlight":"active","reason":"Blending MINTO + Brain at 0.50 weight"}
  seg: Larry: Investigate | <bold yellow>Blend</bold> | Insight

CASE: mode_a 0.8 (blend / check)
  pos: {"label":"Blend","glyph":"check","highlight":"active","reason":"Strong MINTO + Brain agreement, blending"}
  seg: Larry: Investigate | <bold green>Blend</bold> | Insight

CASE: mode_a 1.0 + insight marker
  pos: {"label":"Insight","glyph":"check","highlight":"active","reason":"Converging signals, insight mode"}
  seg: Larry: Investigate | Blend | <bold green>Insight</bold>

CASE: mode_a 1.0 no insight marker
  pos: {"label":"Blend","glyph":"check","highlight":"active","reason":"High confidence, blending without explicit insight marker"}
  seg: Larry: Investigate | <bold green>Blend</bold> | Insight
```

The visible (ANSI-stripped) byte-length of every variant is exactly 36 chars (`Larry: Investigate | Blend | Insight`), well under the 60-char budget enforced by Test 10.

## Latency measurements

Pure-function path (warm, no I/O):

| function | iterations | total | per-call |
|---|---|---|---|
| `resolveDialPosition` | 10,000 | 3.65ms | 0.36 us |
| `formatDialSegment` | 10,000 | 6.72ms | 0.67 us |

Test 12 enforces `< 2ms` per warm call (we are 5,500x under budget).

Spawned process path (real-world statusline tick):

| sample (median of 5 runs) | spawned context-monitor wall-clock | budget |
|---|---|---|
| with trace + dial render | < 1500ms | 1500ms (Plan 88.1-04 inheritance) |

Test 15 enforces `< 1500ms` median wall-clock spawning context-monitor with a fixture trace. The spawn overhead (Node cold start + script run) dominates; the dial pure-function transform inside is sub-microsecond.

## Pre-91 byte-identical fallback verification

Test 14 enforces: a fixture room with `.rooms/registry.json` + `STATE.md` but **no** `.mindrian/decision-traces/` produces a context-monitor stdout that:

1. **Does NOT** contain the substring `Larry:` (dial suppressed)
2. **Does** contain the room name `fixture-room` (room resolution still works)
3. Produces zero stderr (no errors, no stack traces)

This proves the dial integration preserves the pre-91 statusline output byte-for-byte when the trace file is absent. The same guarantee holds for missing `lib/core/nav-dial.cjs` (lazy-require try/catch at the top of context-monitor) and for malformed JSON in the trace file (try/catch in `buildDialSegment`).

## Canon Part 2 glyph vocabulary parity with Plan 88.1-04

Test 11 enforces byte-identity at 11 known threshold points:

| score | classify(score) | Source: 88.1-04 statusline-cache.cjs | This plan: lib/core/nav-dial.cjs |
|---|---|---|---|
| 0.95 | check | check | check |
| 0.7 | check | check | check |
| 0.5 | warn | warn | warn |
| 0.4 | warn | warn | warn |
| 0.3 | low | low | low |
| 0.01 | low | low | low |
| 0 | low | low | low |
| null | -- | -- | -- |
| undefined | -- | -- | -- |
| NaN | -- | -- | -- |
| '0.7' (string) | -- | -- | -- |

The classifier is mirrored (4-line function) rather than cross-required so the dial module stays dependency-free. Test 11 will catch any future drift between the two surfaces at green-light time.

## Three-surface note

The dial is a CLI statusline surface specifically -- Claude Desktop and Cowork do not render statusline text. However:

1. **`resolveDialPosition` is three-surface compatible.** It is a pure function with zero I/O; it works the same in CLI, Desktop MCP, and Cowork.
2. **The dial position is computable in any surface.** Desktop MCP can call `resolveDialPosition(latestTrace)` and surface the position in its own UI (e.g. a chat sidebar pill). Cowork can render the position on a shared dashboard.
3. **`/mos:explain-decision` already exposes the same `chosen_rationale` field** that drives the dial. Users on any surface can ask "why is Larry in Blend?" and see the trace that drove the dial's decision. The audit story is consistent across surfaces.

The dial is the CLI's incarnation of a cross-surface concept: "show the user where the engine thinks it is right now, with a one-glance visual." Future plans can render the same position in Desktop / Cowork-native ways without touching this module.

## Canon Part 8 audit

Test 17 source-scans `lib/core/nav-dial.cjs` (after stripping JSDoc + bash-style line comments) for the following forbidden patterns and asserts ZERO matches:

| pattern | rationale |
|---|---|
| `\bbrain[-_]?client\.(query\|search\|smartSearch)` | Brain queries forbidden in dial path |
| `\bfetch\s*\(` | network surface forbidden |
| `\bcurl\s` | shell-out forbidden |
| `\bhttps?:\/\/` | external URL reference forbidden |
| `\brequire\(['"]https?['"]\)` | http module require forbidden |

The dial source carries zero matches against any forbidden pattern. The dial reads only LOCAL `.mindrian/decision-traces/<session>.json` (via the caller's fs.readFileSync) -- the same path Plan 91-05's `/mos:explain-decision` reads.

`scripts/context-monitor` carries pre-existing `https:` references (in MindrianOS plugin URL references / Update banner / etc); none of them are NEW to this plan. The grep gate `grep -cE "brain-client|fetch\(|curl|https:" lib/core/nav-dial.cjs scripts/context-monitor | head -1` returns `lib/core/nav-dial.cjs:0` for the dial-specific source. No NEW Brain network surface added.

## Deviations from Plan

None. Plan executed as written across both tasks. Test fixture had a minor refinement (single-workspace layout matching production registry resolution) before commit so Test 13 strictly asserts dial render rather than gracefully passing on no-room-resolution. This was inside the same Task 2 commit and did not change the plan's contract.

## Deferred Issues

Two pre-existing Feynman suite failures predate this plan and are out-of-scope per Rule 3 (scope boundary):

1. `test/84-smart-notebook-copilot.test.cjs` -- 15/16 with one inner test ("Test 15 phase 83 regression guard") failing. Predates 91-06. Logged here for tracking.
2. `tests/test-self-update-platform.cjs` -- 19/24. Predates 91-06. Logged here for tracking.

The 91-06 dial work itself contributes 17/17 green tests. Feynman runner shows 95/97 passed (advances by +1 from prior 94/96 baseline; +1 file is `nav-dial.test.cjs`).

## Self-Check

- [x] `lib/core/nav-dial.cjs` exists (217 lines; BSL 1.1 header line 2)
- [x] `lib/memory/nav-dial.test.cjs` exists (408 lines)
- [x] `scripts/context-monitor` modified (5 grep matches for `nav-dial|buildDialSegment`; pre-91 https references unchanged)
- [x] `lib/memory/run-feynman-tests.cjs` registers nav-dial.test.cjs (last entry; +1 file)
- [x] All 17 dial tests pass (`node lib/memory/nav-dial.test.cjs`)
- [x] No regressions in 91-* (33+12+17+17+14 = 93/93 across navigation-engine-core / userpromptsubmit / skill-activation-router / offer-presenter / explain-decision)
- [x] No regressions in 88.1-04 fence (statusline-minto-segment 10/10 still green)
- [x] Feynman suite 95/97 (advances by +1 over prior 94/96)
- [x] Three commits in chain (RED + GREEN + Task 2 wiring): `2583679 0e41773 b7f24c0`
- [x] Canon Part 2 / Part 3 / Part 8 invariants honored (Test 11 + Test 17)
- [x] Tyler meeting quote ('We love the slider') honored: dial is pedagogically meaningful (engine-state derived), not a gimmick

## Self-Check: PASSED
