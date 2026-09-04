---
phase: quick/260904-ng7
plan: 01
subsystem: room-search
tags: [mcp, room-search, html, regex, text-extraction]

requires: []
provides:
  - "room_search finds content inside .html room artifacts (briefs, rubrics, decks), not just .md"
  - "htmlLinesToText: dependency-free, line-preserving HTML-to-text pass in lib/mcp/tools/room.cjs"
  - "Regression suite tests/test-room-search-html-blindness.cjs wired into tests/run-all-198.sh"
  - "RCA filed for the adjacent cheerio-unavailable defect in lib/core/doc-text-extractor.cjs"
affects: [room-search, graph-derivation, doc-text-extractor]

tech-stack:
  added: []
  patterns:
    - "Dependency-free line-preserving markup strip (state machine for script/style/comment regions, tag-to-space not tag-to-empty, entity decode after tag strip) as an alternative to a real HTML parser when the parser dependency is unavailable"

key-files:
  created:
    - tests/test-room-search-html-blindness.cjs
    - .planning/debug/html-artifacts-invisible-to-graph-derivation.md
  modified:
    - lib/mcp/tools/room.cjs
    - tests/run-all-198.sh

key-decisions:
  - "SEARCH_EXT allowlist is ['.md', '.html', '.htm'] -- widened from '.md' only, matching the repo's own ARTIFACT_EXT minus .docx"
  - ".txt stays excluded: nothing in this repo writes a .txt room artifact"
  - ".docx stays excluded in this fix: extractDocxText has no line structure, so every hit would falsely report line: 1"
  - "HTML text extraction is a dependency-free regex pass inside room.cjs, not a reuse of lib/core/doc-text-extractor.cjs, because that extractor's .html leg requires cheerio, which is not installed in this repo and would throw on every call"
  - "Non-.md results carry an additive extracted:true marker; .md results keep exactly their original 4 keys"

patterns-established:
  - "When a shared extractor needs an unavailable dependency, a scoped caller may carry its own dependency-free fallback rather than reuse-and-crash; the RCA for the shared extractor is filed separately so the gap is not lost"

requirements-completed: [NG7-01, NG7-02, NG7-03]

duration: ~35min
completed: 2026-09-04
---

# Quick Task 260904-ng7: Fix room_search HTML Blindness Summary

**room_search now opens `.md`, `.html`, and `.htm` files (was `.md`-only), via a new dependency-free `htmlLinesToText` line-preserving strip pass that keeps line numbers truthful and blanks `<script>`/`<style>`/comment content so it can never match or leak into a snippet.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-04T13:32:00Z (approx)
- **Completed:** 2026-09-04T14:20:00Z (approx)
- **Tasks:** 3/3
- **Files modified:** 4 (1 modified for the fix, 1 new test, 1 aggregator wire-in, 1 new RCA note)

## Accomplishments

- Closed the silent `.html` blindness in `room_search`: a term that exists only inside an `.html` file's body text is now found, at its true source line, as readable de-tagged text.
- Markup-only tokens (tag names, attribute names, attribute values, class tokens) and `<script>`/`<style>` interior content produce zero hits -- the widened allowlist introduced no false positives and no prompt-injection surface via script/style content reaching the model as a snippet (threat T-ng7-04).
- `.md` search behavior stays byte-identical: same files, same line numbers, same snippets, same `match_count`, and no new key on `.md` result objects.
- New 22-check regression suite (`tests/test-room-search-html-blindness.cjs`) wired into the Phase 198 SPEC-2 aggregator.
- Filed a full RCA (`.planning/debug/html-artifacts-invisible-to-graph-derivation.md`) for the adjacent, deliberately out-of-scope defect this investigation surfaced: `cheerio` is not installed in this repo, so `lib/core/doc-text-extractor.cjs`'s `.html` leg throws `CHEERIO_UNAVAILABLE` and three graph-side callers silently swallow it and return `''`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the room_search extension allowlist and add a line-preserving HTML text pass** - `026870e6` (fix)
2. **Task 2: Add the .html regression suite and wire it into the Phase 198 aggregator** - `781dd341` (test)
3. **Task 3: Prove no regression across the existing gates and file the adjacent defect** - `02f17772` (docs)

**Plan metadata:** handled by orchestrator after this SUMMARY (docs commit not made by this executor per plan constraints).

## Files Created/Modified

- `lib/mcp/tools/room.cjs` - `SEARCH_EXT` allowlist added (`.md`, `.html`, `.htm`); new `htmlLinesToText` function; `collectMatches`'s walk gate replaced with the allowlist lookup; matching/snippet extraction runs against de-tagged text for `.html`/`.htm`; `extracted: true` provenance marker added to non-.md results; `room_search` tool description corrected to name HTML in its stated scope; `htmlLinesToText` added to `_internal`.
- `tests/test-room-search-html-blindness.cjs` (new, 212 lines) - 22-check regression suite: load-bearing `.html`-only-term hit with true line number and de-tagged snippet; markup-only/script/style false-positive rejection; entity decoding; tag-to-space no-false-join proof; `.docx`/`.txt` exclusion pins; `.md` no-regression exact-key-set check; rank-then-cap with `.html` in the walk; malformed-`.html` safe degrade.
- `tests/run-all-198.sh` - one new `run_if` leg wiring the new suite in, gated on `lib/mcp/tools/room.cjs`, next to the existing room_search rank-then-cap leg.
- `.planning/debug/html-artifacts-invisible-to-graph-derivation.md` (new) - RCA for the cheerio-unavailable defect, `kind: rca`, classified NEW FAILURE, not fixed here by design.

## Decisions Made

- **`SEARCH_EXT` final value and per-extension reason:**
  | Extension | In/Out | Reason |
  |---|---|---|
  | `.md` | IN | Original, unchanged scope. |
  | `.html` | IN | Confirmed live gap; already in the repo's own `ARTIFACT_EXT` (`lib/core/graph-backfill.cjs:68`). |
  | `.htm` | IN | Same as `.html`; also in `ARTIFACT_EXT`. |
  | `.txt` | OUT | Nothing in this repo writes a `.txt` room artifact (every `.txt` path found is tooling scratch); also absent from `ARTIFACT_EXT`. Checked and rejected, not an oversight. |
  | `.docx` | OUT (this fix) | `extractDocxText` joins all runs into ONE space-separated string with no line structure; every hit would falsely report `line: 1`. Named as a follow-up needing its own result-shape decision, not silently dropped. |
- **HTML extraction stays dependency-free, inside `room.cjs`, not via `doc-text-extractor.cjs`:** live probe confirmed `cheerio` is absent (`node -e "require('./lib/core/doc-text-extractor.cjs').extractDocText('/tmp/x.html')"` throws `CHEERIO_UNAVAILABLE`); reusing that extractor would turn a silent miss into a thrown tool error on every `.html` file. See the filed RCA for the shared-extractor side of this gap.
- **`extracted: true` is additive-only on non-`.md` results.** Keeps the `.md` no-regression assertion exact (zero new keys) while giving the caller honest provenance for a derived-text result.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their `<action>` steps, and their verify commands were followed as specified; no Rule 1-4 deviations were needed.

## Issues Encountered

None that blocked the plan. One pre-existing, unrelated test failure was discovered during Task 3's Part A re-run and is documented below (not a deviation from this plan's own scope, since it predates this change and was independently verified to predate it).

## Part A Re-Test Results (verbatim, Task 3)

Run in the order specified by the plan, from `/home/jsagi/dev/MindrianOS-Plugin`:

**1. `node tests/test-room-search-html-blindness.cjs`** (the new gate)
```
  ok - room_search finds a term that appears only inside an .html file body
  ok - the hit is attributed to the .html file
  ok - the hit reports the TRUE 1-based source line (computed, not guessed)
  ok - the hit snippet is de-tagged (no < or >)
  ok - the hit carries the extracted:true provenance marker
  ok - a tag/attribute markup-only token produces zero hits
  ok - a class-token markup-only value produces zero hits
  ok - a <script> interior identifier produces zero hits
  ok - a <style> interior selector produces zero hits
  ok - entity decoding lets a search for at&t match AT&amp;T in source
  ok - adjacent block cells do not mint the false joined token FooBar
  ok - adjacent block cells DO produce the space-joined text "foo bar"
  ok - a .docx file in the room is still skipped (D-03)
  ok - a .txt file in the room is still skipped (D-02)
  ok - md-only room still returns a hit
  ok - md result object has exactly file, line, snippet, match_count (no extracted key)
  ok - a late-walked, term-dense .html file survives the 50-slot cap
  ok - the relevant .html file ranks first
  ok - per-file slice cap (max 5) still holds with .html in the walk
  ok - result count stays bounded by the 50-slot cap
  ok - searchRoom does not throw when a malformed .html file is in the room
  ok - a sibling well-formed file in the same room still returns its hit
PASS: test-room-search-html-blindness -- 22 checks
```
**Result: PASS (22/22 checks), exit 0.**

**2. `node tests/test-room-search-rank-before-cap.cjs`** (pre-existing room_search contract)
```
  ok - search returns a non-empty result array
  ok - late-directory relevant match survives ranking (would have been dropped by the old arrival-order cap)
  ok - relevant file ranks first (highest relevance, not last-walked)
  ok - no single file monopolizes the payload (per-file slice cap holds)
  ok - result count still bounded by SEARCH_MAX_RESULTS
  ok - each result carries a match_count relevance signal
  ok - relevant file match_count reflects full tally (> display slice)
PASS: test-room-search-rank-before-cap -- 7 checks
```
**Result: PASS (7/7 checks), exit 0. Unchanged from before this plan.**

**3. `node tests/test-198-contract-schema.test.cjs`**
```
...135 "ok -" lines pass (including every room_search / room_list / room_state_bound check)...
AssertionError [ERR_ASSERTION]: context_assemble schema PARSES a synthesized sample input
    at check (/home/jsagi/dev/MindrianOS-Plugin/tests/test-198-contract-schema.test.cjs:57:10)
    at Object.<anonymous> (/home/jsagi/dev/MindrianOS-Plugin/tests/test-198-contract-schema.test.cjs:238:3)
    ...
  code: 'ERR_ASSERTION', actual: false, expected: true, operator: '==', diff: 'simple'
```
**Result: FAILED (135 checks passed, then this one assertion threw, exit 1).**

**This failure is PRE-EXISTING and UNRELATED to this plan.** Verified directly: the pre-ng7 `lib/mcp/tools/room.cjs` (from commit `19cefe76`, the parent of Task 1's `026870e6`) was temporarily restored into the working tree and the same test was re-run -- it produced the byte-identical failure (`context_assemble schema PARSES a synthesized sample input`, same assertion, same line). `context_assemble` is a different tool entirely (unrelated to `room.cjs`/`room_search`), so this plan did not fix it and did not break it. The working tree was restored to its committed state immediately after (`git diff --stat` showed zero delta afterward).

**4. `node tests/test-234-tool-description-floor.cjs`** (live-wire description floor; spawns a real server over JSON-RPC)
```
...172 assertions run against every registered tool's description...
  ok - `room_search` description starts with a capital letter
  ok - `room_search` description ends with a sentence terminator
  ok - `room_search` description is <= 2048 bytes (got 455)
  ok - `room_search` description carries no em-dash (CLAUDE.md hard rule)
  ok - every registered tool received the full prose-shape check set (coverage: 40/40)

  172 passed, 0 failed (prose-shape coverage: 40/40 registered tools)
```
**Result: PASS (172/172), exit 0. The rewritten room_search description clears the floor at 455 bytes (was 446).**

**5. `node scripts/build-connector-registry.cjs --check`** (born-wired, Canon Part 11)
```
connector-registry: OK
```
**Result: PASS (green), exit 0. The `connectors` array in `room.cjs` was untouched by this plan, as required.**

**Full aggregator (`bash tests/run-all-198.sh`), for completeness beyond the plan's required 5 legs:** 12 passed, 3 failed, 0 skipped. The 2 room_search legs (rank-then-cap and the new HTML-blindness suite) both PASSED. The 3 failures are: (a) `test-198-contract-schema.test.cjs` (the pre-existing `context_assemble` failure documented above), (b) `test-198-local-only.test.cjs` (fails on `lib/mcp/tools/sensors.cjs` carrying a `brain-client.cjs` token -- a file this plan never touched), (c) `test-198-adapter-budget.test.cjs` (gated on `lib/mcp/hook-adapter-audit.cjs` -- also never touched by this plan). All three are pre-existing and out of this plan's scope; none regressed as a result of this change.

## Before/After room_search Description

**Before (446 chars / 446 bytes):**
> "Search the markdown entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords."

**After (455 chars / 455 bytes):**
> "Search the markdown and HTML entries of this session's bound room by case-insensitive substring, optionally scoped to a single section. Read-only, no side effects. It answers literal-recall questions well: a project name, a person, a funder, any term you expect to appear verbatim in the text. It does NOT do semantic or fuzzy matching, so for a conceptual or relational question reach for room_graph and run a graph query instead of guessing at keywords."

Only the opening clause changed ("the markdown entries" -> "the markdown and HTML entries"); every other sentence is unchanged. Both stay well within the 120-2048 byte floor/ceiling, start with a capital, end with a sentence terminator, and carry no em-dash.

## Known Limitation (named, not hidden)

A minified single-line `.html` file (all markup and body text on one physical source line) collapses every match on that file to a single reported match line under `htmlLinesToText`'s line-preserving design. Its `match_count` therefore under-represents its true term density relative to a multi-line file with the same content spread across many lines, which can cause a minified file to under-rank against an equally-relevant but well-formatted file in `rankMatches`'s term-frequency scoring. This is an accepted bound of keeping line numbers truthful (D-04): the alternative (re-flowing minified HTML into multiple logical lines) would require real HTML parsing, which this fix deliberately avoids per D-04/Finding 4 (no cheerio installed). Not fixed here; named as a limitation for a future session to weigh if minified `.html` room artifacts become common.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. All five STRIDE threats in the plan's threat model (T-ng7-01 through T-ng7-05, T-ng7-SC) were mitigated exactly as designed: the regex pass is linear/non-backtracking (no ReDoS), the walk bound and path-traversal guard are unchanged, `<script>`/`<style>`/comment regions are blanked before matching (Task 2's suite asserts both script and style interior tokens return zero hits), no network primitive was added, and no package was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `room_search` now covers `.md` and `.html`/`.htm` room artifacts; `.docx` support is a named, deliberate follow-up (needs its own result-shape decision for the `line` field) if a future task wants it.
- The filed RCA (`.planning/debug/html-artifacts-invisible-to-graph-derivation.md`) is resumable via `/gsd:debug html-artifacts-invisible-to-graph-derivation` whenever a session is ready to choose between its two candidate fixes (add-and-vendor cheerio, or give `doc-text-extractor.cjs` a dependency-free fallback modeled on this plan's `htmlLinesToText`).
- No blockers for closing this quick task.

---
*Phase: quick/260904-ng7*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: lib/mcp/tools/room.cjs
- FOUND: tests/test-room-search-html-blindness.cjs
- FOUND: tests/run-all-198.sh
- FOUND: .planning/debug/html-artifacts-invisible-to-graph-derivation.md
- FOUND: .planning/quick/260904-ng7-fix-room-search-html-blindness-lib-mcp-t/260904-ng7-SUMMARY.md
- FOUND commit: 026870e6
- FOUND commit: 781dd341
- FOUND commit: 02f17772
- No em-dashes in this file.
