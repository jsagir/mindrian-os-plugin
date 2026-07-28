---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 02
subsystem: api
tags: [mcp, tool-descriptions, json-rpc, stdio, portability, tier-0, d-03]

# Dependency graph
requires:
  - phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core (plan 01)
    provides: "tests/run-all-234.sh, the glob-discovering phase gate this plan's test wires into automatically, plus the D-03 no-instructions invariant this plan is the other half of"
provides:
  - "All 33 default-registered MCP tools now carry instruction-quality descriptions (>=120 chars), the only per-tool guidance channel a Tier-0 foreign host is guaranteed to honor"
  - "tests/test-234-tool-description-floor.cjs: a wire-level regression gate that drives real initialize -> notifications/initialized -> tools/list over stdio and enforces the 120-char D-03 floor on EVERY tool, not just the 8 rewritten ones"
  - "Six explicit tool-disambiguation pairs written into the descriptions themselves (room_content/room_state, room_graph/graph_query, analysis/intelligence, room_list/room_bind, room_search/room_graph)"
affects: [234-03, 234-04, 234-05, host-adapter work, any future plan registering a new MCP tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wire-level tool-metadata assertion: spawn the real server and read tools/list rather than grepping source, because room_state assembles its description at runtime from a larryContext slice that a grep would misread"
    - "Universal floor + named-subset shape checks: the length floor applies to every registered tool so a NEW tool cannot be added below it, while capital/period/ceiling/em-dash checks pin the 8 this plan authored"

key-files:
  created:
    - tests/test-234-tool-description-floor.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/tools/room.cjs

key-decisions:
  - "The 120-char floor is enforced on EVERY registered tool, not only the 8 rewritten ones, so the gate catches a future tool born as a label rather than only defending the eight already fixed"
  - "Descriptions carry explicit disambiguation ('use X instead when...') because on a Tier-0 host, naming a capability does not tell a model which of two overlapping tools to pick"
  - "Measured over the wire, not grepped: a source grep cannot read room_state's runtime-assembled template literal and cannot see what a host actually receives"
  - "Harness honesty is asserted before grading: a wedged server, a tools/list error, or a catalog under 20 tools each FAIL rather than reporting a vacuous 'no short descriptions found'"

patterns-established:
  - "Tool descriptions are product copy under test: any new MCP tool must clear the D-03 instruction floor or tests/run-all-234.sh goes red"
  - "An em-dash check rides inside the test itself, making the CLAUDE.md hard rule machine-enforced on this surface rather than review-enforced"

requirements-completed: [D-03]

# Metrics
duration: 21min
completed: 2026-07-28
---

# Phase 234 Plan 02: Tool descriptions as instructions, not labels - Summary

**The 8 label-length MCP tool descriptions (66-91 chars) rewritten as instruction-quality prose carrying explicit tool-vs-tool disambiguation, with a wire-level 120-char floor test that now grades all 33 registered tools.**

## Performance

- **Duration:** 21 min
- **Completed:** 2026-07-28
- **Tasks:** 1 (TDD: RED then GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Why this mattered (the root cause, not the symptom)

These 8 descriptions were not sloppy when they were written. They were written under an assumption that has since been removed. When Larry's system prompt was assumed present, a short label was sufficient: the model already knew what a room was, what a Data Room entry was, and roughly when to reach for what. The description only had to name the tool.

D-03 deletes that assumption. Persona now ships as a SKILL and explicitly never through MCP `InitializeResult.instructions` (the sibling invariant 234-01 locked, because that field is the single highest-leverage methodology-leak surface). On a Tier-0 foreign host - VS Code, Cursor, Zed, Goose - there is no Larry system prompt at all. The description string is the entire brief the model receives about a tool. At 66 to 91 characters, these named a capability without teaching its use, which on a foreign host reads as a menu item rather than something to reach for.

The load-bearing part of the rewrite is therefore not length, it is **disambiguation**. Naming what a tool does still does not tell a model which of two overlapping tools to pick. Each rewrite now states what it does, then states when to reach for its neighbour instead.

## Accomplishments

- **8 descriptions rewritten** following the in-repo exemplars (`chain_run` 552, `stop_gate_check` 460, `framework_run` 424): what it does, then when and why to reach for it.

  | Tool | Before | After | Disambiguation written in |
  |------|--------|-------|---------------------------|
  | `room_content` | 78 | 494 | WRITE surface; use `room_state` for READ |
  | `room_graph` | 68 | 512 | full graph lifecycle; `graph_query` is read-only |
  | `analysis` | 77 | 546 | HOW/WHERE it breaks; `intelligence` for HOW GOOD |
  | `meeting` | 66 | 489 | transcript -> filed Data Room content |
  | `export` | 86 | 490 | picks a format by audience |
  | `orchestration` | 91 | 539 | carries the `act-*` supervision caution |
  | `room_list` | 76 | 434 | WHICH rooms exist; then `room_bind` / `room_state` |
  | `room_search` | 85 | 434 | literal recall only, NOT semantic |

- **The floor is now locked at the wire.** `tests/test-234-tool-description-floor.cjs` spawns `node bin/mindrian-mcp-server.cjs` for real, completes a genuine JSON-RPC `initialize -> notifications/initialized -> tools/list` sequence, and measures the description strings a host would actually receive.
- **The gate defends the future, not just the past.** The 120-char floor applies to all 33 registered tools, so a new tool added below the floor fails immediately. Only the 8 prose-shape checks (capital start, period end, 600-char ceiling, no em-dash) are scoped to the named set.
- **Verified RED before GREEN, with the RED matching independent evidence.** The pre-rewrite run reported exactly 8 failures at `room_content 78, room_graph 68, analysis 77, meeting 66, export 86, orchestration 91, room_list 76, room_search 85` - the same eight tools at the same lengths that 234-RESEARCH.md Section F measured separately. Two independent measurements agreeing is what makes the RED trustworthy rather than a coincidence of one script.

## Task Commits

1. **Task 1 (RED): the D-03 instruction-floor test** - `a47d8163` (test)
2. **Task 1 (GREEN): the 8 description rewrites** - `71f15a3c` (feat)

No REFACTOR commit: the GREEN implementation is 8 replaced string literals with nothing to clean up.

## Files Created/Modified

- `tests/test-234-tool-description-floor.cjs` (created) - Wire-level D-03 floor gate. Drives a real stdio handshake, asserts every tool description >= 120 chars, plus prose-shape bounds on the 8 rewritten ones. Glob-discovered by `tests/run-all-234.sh` with no edit to that harness.
- `lib/mcp/tool-router.cjs` (modified) - 6 description string literals replaced in place (`room_content`, `room_graph`, `analysis`, `meeting`, `export`, `orchestration`).
- `lib/mcp/tools/room.cjs` (modified) - 2 description string literals replaced in place (`room_list`, `room_search`).

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-234-tool-description-floor.cjs` (RED, pre-rewrite) | 34 passed, **1 failed** - exactly the 8 named tools at the 8 recorded lengths |
| `node tests/test-234-tool-description-floor.cjs` (GREEN, post-rewrite) | **35 passed, 0 failed**, exit 0 |
| `node -e "const {z}=require('zod'); require('./lib/mcp/tool-router.cjs')"` | loads clean, no syntax regression |
| Diff scope (acceptance: no schema/handler touched) | **exactly 8 changed lines across 2 files**, all second-argument string literals; zero zod schemas, handlers, tool names, or registration ordering touched |
| `bash tests/run-all-234.sh` | PASS=6 FAIL=1 - the single FAIL is the `check-skill-spec --check` leg that run-all-234.sh's own header documents as the EXPECTED RED baseline until 234-03/234-04 land. This plan's leg is green and was picked up by the glob with no harness edit. |
| No-regression: `test-205-surface-fence.cjs` (the CLI<->MCP 65-command parity guard) | PASS |
| No-regression: `test-198-contract-schema.test.cjs` | PASS |
| No-regression: `test-tool-router-grouped-reference.cjs` | PASS |
| No-regression: `test-room-search-rank-before-cap.cjs` | PASS |
| No-regression: `test-232.1-room-state-density.cjs` | PASS |
| No-regression: `test-212-part8-boundary.cjs` | PASS |
| Part 8 sweep (inside run-all-234.sh, self-tested first) | PASSED |

## Canon Compliance

- **Part 8 (Graph Boundary):** held. The 8 rewritten strings describe LOCAL room operations only and introduce no Brain reference, no hostname, no key name. Nothing new crosses the boundary. The new test spawns a local process under an mkdtemp HOME with `MINDRIAN_BRAIN_KEY` unset and makes zero network reach; the run-all-234.sh Part 8 sweep passes with its self-test green.
- **Part 7 (Reuse Before Build):** the test reuses `lib/mcp/no-instructions.test.cjs`'s spawn-and-drive-stdio harness shape rather than inventing a second MCP test idiom, and extends the handshake by exactly one step (`notifications/initialized` + `tools/list`).
- **Part 11 (CIRS):** no new invocable surface. Zero tools added, renamed, or removed; the connector registry and shape declarations are untouched.
- **No em-dashes:** enforced in the test itself, not just in review.
- **Out of scope, untouched as instructed:** `mcp-server-brain/lib/auth.cjs`, entitlement, and pricing (SEED-069's payment mechanism).

## Decisions Made

1. **Enforce the floor on every tool, not the 8.** The plan's must_have names all 33. Scoping the length check to a hardcoded list of 8 would defend only the tools already fixed and would let the next tool be born as a label. The universal floor makes the gate forward-looking; the named list is kept solely for the prose-shape assertions this plan authored.
2. **Wire-level, not grep.** `room_state` builds its description at runtime from `${compact.slice(0, 80)}`. A source grep would misread that template literal, and would also miss anything the SDK adds. The wire is the only place that reports what a foreign host actually receives.
3. **Assert harness honesty before grading.** A tools/list of zero tools would make "no descriptions below the floor" trivially true. The test fails loudly on a wedged server, a tools/list error, or a catalog under 20 tools - the same false-success shape this phase exists to close, so the harness proves it reached real data first.
4. **Ship the em-dash check inside the test.** CLAUDE.md's no-em-dash rule was review-enforced on this surface. Since these strings are now product copy that ships to foreign hosts, the rule is machine-enforced here.

## Deviations from Plan

None - plan executed exactly as written. All four acceptance_criteria met, including the "no third or fourth argument touched" constraint verified by a line-level diff (8 changed lines, all second-argument string literals).

## Issues Encountered

**Concurrent sessions committing into the same tree.** Two unrelated sessions (a statusline effort and a `quick-260728-7kc-02` MCP pull-tools change, the latter also touching `lib/mcp/tool-router.cjs`) landed commits interleaved with this plan's. Handled by staging only this plan's specific paths on every commit, never `git add -A`. Verified after the fact: `a47d8163` contains only `tests/test-234-tool-description-floor.cjs`; `71f15a3c` contains only the two `lib/mcp/` files at 8 changed lines. The floor test was re-run after the interleaved `tool-router.cjs` commit landed and remained green.

## Known Stubs

None. Every rewritten description is final product copy, and the test measures the real wire output rather than a placeholder.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **D-03 is now fully closed on the MCP side.** 234-01 locked the negative half (no `instructions` on InitializeResult); this plan lands the positive half (tool descriptions carry the guidance instead). Both are regression-gated.
- **Ready for 234-03 / 234-04.** The one red leg in `tests/run-all-234.sh` is still the `check-skill-spec --check` baseline (9 required-field breaches, 105 skills on the experimental `allowed-tools` array form). Those plans turning that leg green is how the phase knows they landed. Nothing in this plan changes that count.
- **Note for host-adapter work (234-05+):** the Zed 50KB catalog budget leg reports 12,860 / 51,200 bytes (25%) across 125 skills. That budget covers SKILL.md name+description pairs, not MCP tool descriptions, so this plan's longer strings do not consume it. A future plan that lengthens SKILL.md descriptions the way this one lengthened tool descriptions must re-check that leg.
- **Contract for any future MCP tool:** born at >=120 chars with disambiguation against its nearest neighbour, or `tests/run-all-234.sh` goes red.

---
*Phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core*
*Completed: 2026-07-28*

## Self-Check: PASSED

All claimed artifacts verified present on disk (`tests/test-234-tool-description-floor.cjs`, `lib/mcp/tool-router.cjs`, `lib/mcp/tools/room.cjs`, this SUMMARY) and both claimed commits verified in git history (`a47d8163`, `71f15a3c`).
