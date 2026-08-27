---
phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp
plan: 17
subsystem: docs
tags: [mcp, tool-router, comment-drift, versioned-doc, phase-coordination]

# Dependency graph
requires: []
provides:
  - "Server header comment that names the four MCP registration seams and defers live numbers to tests/test-234-tool-description-floor.cjs instead of restating a frozen count"
  - "Three corrected docs (two research diagrams, one versioned briefing) with no wire-contradicted tool count"
  - "A recorded Phase 266 handoff: the same '9 tools'/'7000 token budget' defect at lib/mcp/tool-router.cjs:4-6, with exact replacement text, for plan 266-02 to apply"
affects: [266-02, 265-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Point comments/docs at the measuring test (tests/test-234-tool-description-floor.cjs) instead of typing a new frozen literal that will rot again -- follows the CLAUDE.md Canon Part 11 run-time-enumeration precedent"
    - "Versioned briefing docs get a bracketed correction annotation with figure + date, never a silent rewrite"

key-files:
  created: []
  modified:
    - bin/mindrian-mcp-server.cjs
    - docs/research/PLATFORM-INDEPENDENCE-STRATEGY.md
    - docs/research/MCP-APPS-STRATEGIC-RESEARCH.md
    - docs/LAWRENCE-BRIEFING-v1.6.3.md

key-decisions:
  - "No --tool-count CLI arm added: it would only duplicate what /mos:doctor reports once plan 265-23's MCP surface organ lands, and building it here would require partially booting or duplicating the registration seam inside an entry point this plan is scoped to touch only in comments."
  - "lib/mcp/tool-router.cjs:4-6 (same '9 tools'/'under 7000 tokens' defect) is handed to Phase 266's MCPFIX-02 with exact replacement text rather than edited across the phase boundary."
  - "MCP-APPS-STRATEGIC-RESEARCH.md:789 ('9 tool routers, 64 commands') was also corrected -- same file, same rot pattern, not explicitly named by the plan but fixed under deviation Rule 1 rather than left half-fixed in one document."
  - "CHANGELOG.md:2145 deliberately left untouched -- true when written, superseded by Phase 127-00 commit 5308e678, recorded for plan 265-23's ledger as 'superseded', not 'wrong'."

patterns-established:
  - "Counted facts in comments/docs point at the wire-measuring test, not a re-typed literal."

requirements-completed: [RADAR-17]

# Metrics
duration: 25min
completed: 2026-08-27
---

# Phase 265 Plan 17: Retire Frozen Tool-Count Claims Summary

**Corrected the server header and three docs that stated a "9 tools / under 7000 token budget" claim the wire contradicts (actual: 11 router tools, 36 total server tools, ~7,062 tokens already over budget), pointing every corrected passage at `tests/test-234-tool-description-floor.cjs` instead of a new frozen literal, and handed the one copy of the same defect living in a Phase 266 file across the boundary instead of editing it.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-27T09:03:00Z (approx, first read)
- **Completed:** 2026-08-27T09:28:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 4

## Accomplishments

- `bin/mindrian-mcp-server.cjs`'s header (both the top-of-file comment and its inline repetition at the router-registration call) now names all four registration seams (`tool-router.cjs`, `register-core-tools.cjs`, the two inline tools, `app-views.cjs`) and points at the measuring test rather than a frozen count.
- Named `register-core-tools.cjs:56` as the auto-discovery loop that is the actual mechanism of silent growth.
- Corrected two research-doc architecture diagrams ("9 tools" -> "11 tools", pointing at `test-234-tool-description-floor.cjs`) plus a third occurrence of the same defect in the same file (`MCP-APPS-STRATEGIC-RESEARCH.md:789`).
- Corrected the versioned `LAWRENCE-BRIEFING-v1.6.3.md` with a bracketed Phase 265 annotation rather than a silent rewrite.
- Left `CHANGELOG.md:2145` untouched as a deliberate decision (superseded history, not wrong-when-written).
- Recorded the Phase 266 handoff for `lib/mcp/tool-router.cjs` without editing that file.

## Task Commits

1. **Task 1: Retire the frozen counted facts in the server header** - `99ac692c` (docs)
2. **Task 2: Correct the three docs that re-typed the tool count** - `9f92af65` (docs)

**Plan metadata:** (this commit, added after SUMMARY self-check)

## Files Created/Modified

- `bin/mindrian-mcp-server.cjs` - header comment (lines 6-8 originally) and the inline registration comment (line 154 originally) rewritten to name the four registration seams and point at `tests/test-234-tool-description-floor.cjs`; no frozen `36`/`42` count typed anywhere.
- `docs/research/PLATFORM-INDEPENDENCE-STRATEGY.md:207` - diagram box label corrected from "Tool Router (9 tools, 66+ commands)" to "Tool Router (11 tools, ~64 commands; see test-234)".
- `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md:525` - nested diagram box label corrected from "Tool Router (9 tools, 64 commands)" to "Tool Router (11 tools, 64 cmds; test-234)" (box alignment preserved).
- `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md:789` - "9 tool routers, 64 commands" corrected to "11 tool routers, ~64 commands (see tests/test-234-tool-description-floor.cjs)".
- `docs/LAWRENCE-BRIEFING-v1.6.3.md:26` - "49 MCP tools" corrected to "42 MCP tools" with a bracketed `[CORRECTED, Phase 265, 2026-08-27: originally stated as 49; measured 42 on the wire (36 mindrian-os + 6 mindrian-brain), so this figure is corrected rather than silently rewritten]` annotation.

## --tool-count CLI Arm Decision

Skipped. The plan left this to executor's judgment: add a `--tool-count` arm on `bin/mindrian-mcp-server.cjs` if genuinely useful to an operator, or skip if it would only duplicate `/mos:doctor`'s future report. Decision: skip. Reasoning:

1. Plan 265-23's MCP surface organ is explicitly slated to feed `/mos:doctor` with exactly this live count, so a second, narrower reporting path on this entry point would be redundant within one milestone.
2. Building it correctly here would mean either (a) partially booting the server (calling `createServer()` and inspecting its registered tools without connecting a transport) or (b) duplicating the four-seam counting logic outside `createServer()` -- both add real surface to a file this plan is scoped to touch only in comments, and both risk drifting out of sync with `createServer()`'s actual registration order the same way the header comment itself just did.
3. `tests/test-234-tool-description-floor.cjs` already measures the live count over the wire (the ground-truth method this whole plan defers to); a second, weaker measurement path is not an improvement.

## Phase 266 Coordination Handoff

`lib/mcp/tool-router.cjs` carries the same two false claims and is Phase 266's MCPFIX-02 territory (not edited by this plan). Exact location and exact replacement text for plan 266-02 to apply in one edit:

**File:** `lib/mcp/tool-router.cjs`
**Lines 4-6 (current):**
```
 * Registers 9 high-level MCP tools that dispatch to all 64 CLI commands.
 * Hierarchical design keeps total tool definition under 7000 tokens
 * (vs 30-60K for flat 64-tool registration).
```

**Replacement text:**
```
 * Registers 11 high-level MCP tools that dispatch to all 64 CLI commands.
 * The live tool count and eager-load token total for the full server
 * (this router plus the other three registration seams) are measured by
 * tests/test-234-tool-description-floor.cjs, not restated here as a frozen
 * number.
```

This mirrors the exact language already applied in `bin/mindrian-mcp-server.cjs` by this plan's Task 1, so 266-02 can drop it in verbatim. Plan 265-23 also records this as a capability-ledger row per the plan's instruction.

## Load-Bearing Check (Task 2 acceptance requirement)

- `docs/research/PLATFORM-INDEPENDENCE-STRATEGY.md:207` - **incidental.** The "9 tools" figure sits only inside an ASCII architecture-diagram box label; no downstream calculation, budget math, or argument in the document consumes the number. Corrected in place with no argument repair needed.
- `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md:525` (and the same-file `:789` occurrence) - **incidental.** Both are diagram/bullet labels describing the server's shape for a reader; the document's token-economics argument (lines ~490-494, ~759, ~779) is about MCP Apps rendering client-side at zero token cost versus CLI text, and never uses the "9" figure as an input. Corrected in place with no argument repair needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a third occurrence of the same defect in a file already being edited**
- **Found during:** Task 2
- **Issue:** `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md:789` ("9 tool routers, 64 commands") carries the identical wrong-count defect as the `:525` occurrence the plan named, in the same file, a few hundred lines away.
- **Fix:** Corrected to "11 tool routers, ~64 commands (see tests/test-234-tool-description-floor.cjs)", consistent with the `:525` fix in the same document.
- **Files modified:** `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md`
- **Commit:** `9f92af65`

No other deviations. Plan executed as written otherwise, including the `--tool-count` executor's-judgment call (documented above) and the deliberate `CHANGELOG.md` non-edit.

## Known Stubs

None.

## Threat Flags

None. Every edit in this plan is a comment or a doc line; no new network surface, auth path, file-access pattern, or schema change.

## Verification Results

- `node lib/mcp/no-instructions.test.cjs` -> exit 0, 9 passed, 0 failed.
- `grep -c '9 tools' bin/mindrian-mcp-server.cjs docs/research/PLATFORM-INDEPENDENCE-STRATEGY.md docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` -> 0 for all three.
- `grep -c 'under 7000 token budget' bin/mindrian-mcp-server.cjs` -> 0.
- `grep -c '49 MCP tools' docs/LAWRENCE-BRIEFING-v1.6.3.md` -> 0.
- `git diff --stat CHANGELOG.md lib/mcp/tool-router.cjs lib/mcp/larry-context.cjs lib/mcp/runtime-instructions.cjs lib/core/mcp-dep-heal.cjs tests/test-234-tool-description-floor.cjs` -> no output (all five Phase 266 files + CHANGELOG.md untouched).
- `LC_ALL=C.UTF-8 grep -cP '\x{2014}' bin/mindrian-mcp-server.cjs docs/research/PLATFORM-INDEPENDENCE-STRATEGY.md docs/research/MCP-APPS-STRATEGIC-RESEARCH.md docs/LAWRENCE-BRIEFING-v1.6.3.md` -> 0 for all four files.

## Self-Check: PASSED

- All 4 modified source files confirmed present on disk.
- SUMMARY.md itself confirmed present on disk.
- Both task commits (`99ac692c`, `9f92af65`) confirmed in `git log`.
