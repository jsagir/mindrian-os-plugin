---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 08
subsystem: mcp-surface
tags: [tri-polar, mcp, methodology-enum, desktop, cowork, ignite, entry-points, cirs]
requires:
  - phase: 364-03
    provides: "sr-steps.cjs readSrSteps/readCoverage/renderStatus and the fake brain helper"
  - phase: 364-04
    provides: "sr-entry.cjs resolveEntry/renderEntry and the entry-room fixture"
  - phase: 364-07
    provides: "commands/scientific-roadmap.md served as the methodology reference"
provides:
  - "MCP methodology tool accepts command scientific-roadmap and appends the read-only entry proposal and Theo step status"
  - "ALL_TOOL_COMMANDS 65 to 66, moved deliberately in four pinned tests"
  - "/mos:ignite after-birth offer of /mos:scientific-roadmap to Researcher and Door 3 arrivals"
  - "tests/test-364-mcp.cjs (M1-M10) and tests/test-364-entry-points.cjs (P1-P6)"
affects: [364-09, 364-10, 364-11, 364-12, 364-13]
key-files:
  created:
    - tests/test-364-mcp.cjs
    - tests/test-364-entry-points.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - tests/test-205-surface-fence.cjs
    - tests/test-366-router-redirects.cjs
    - tests/test-366-eureka-alias.cjs
    - tests/test-eureka-mcp-tools.cjs
    - commands/ignite.md
    - skills/ignite/SKILL.md
    - tests/test-364-registry-gates.cjs
    - tests/test-364-sr-door.cjs
    - tests/test-364-sr-entry.cjs
    - tests/test-364-sr-steps.cjs
key-decisions:
  - "KNOWN_METHODOLOGIES in lib/mcp/brain-router.cjs deliberately not changed (adding a slug reshapes the already-red framework-command ledger); follow-on."
  - "Entry check runs first; Theo is read only when a WHAT exists, so an empty room routes to /mos:analyze-needs with zero Theo calls (NV-2, ROOT)."
  - "pipelineState.recordStep still runs for the command and can throw on a non-directory roomDir (pre-existing, not changed); M9 simulates the entry failure instead."
requirements-completed: [SRM364-17, SRM364-18, SRM364-03]
completed: 2026-10-03
---

# Phase 364 Plan 08: MCP reach and ignite offer Summary

Desktop and Cowork now reach `/mos:scientific-roadmap` through the existing `methodology` tool (the command reference plus the same read-only entry proposal and Theo step status the CLI start step returns, entry check first so an empty room makes zero Theo calls), and `/mos:ignite` offers the command once after birth to Researcher and Door 3 arrivals, never auto-run.

PLAN_BASE: `0db7964d30a55dc5acd9d34f296d026fc5573c41`

## Commits

| Task | Commit | Files |
| ---- | ------ | ----- |
| 0 (orchestrator) dash-literal fix | 1b5cca182 | tests/test-364-registry-gates.cjs, test-364-sr-door.cjs, test-364-sr-entry.cjs, test-364-sr-steps.cjs |
| 1 methodology enum, handler, 66 pins | 31381c8dc | lib/mcp/tool-router.cjs, tests/test-364-mcp.cjs, tests/test-205-surface-fence.cjs, tests/test-366-router-redirects.cjs, tests/test-366-eureka-alias.cjs, tests/test-eureka-mcp-tools.cjs |
| 2 ignite offer | 18bcdbe5e | commands/ignite.md, skills/ignite/SKILL.md, tests/test-364-entry-points.cjs |

All three are ancestors of HEAD and were made with `git commit --only`.

## What was built

- `METHODOLOGY_COMMANDS` gains `scientific-roadmap` (the three "14 commands" comments now say 15). A module-level `scientificRoadmapStatus(roomDir)` lazily requires sr-entry and sr-steps, returns the entry card, and only when `route !== 'define_what'` appends `renderStatus` over `readSrSteps({})` and `readCoverage({})`, then the exact Desktop line (gate_render and gate_answer for gates, research_run op plan for planning, filing runs in Claude Code). Every failure path returns a plain line instead of throwing. The methodology handler branches on exact equality `command === 'scientific-roadmap'`.
- The four 65 pins moved to 66, each with a comment naming Phase 364-08, measured against current HEAD (the pins were still 65 at HEAD, the peer's moves were in other tests). `test-270-tool-schema-budget` passes unedited.
- The ignite paragraph sits after the Door 3 abstraction gate and before Door 4: Door 3 arrivals get `/mos:scientific-roadmap --from-hypothesis`, Researcher arrivals get `/mos:scientific-roadmap`, after Gate B2 only, never auto-run, never replacing the B3 first win. Additions only (no removed lines); the mirror regenerated with only `skills/ignite/SKILL.md` changing.
- Tests: M1-M10 (schema accepts and still rejects; 66 unique; refusal, research offer, uncovered and Desktop line; seven labels in list order inside the status block; empty room zero calls; wire shapes and the planted MARKER never on a call across six room states; no new files, node or edge counts unchanged; non-roadmap command has no block; a throwing entry check still returns the reference; zero network) and P1-P6 (placement, wording, mirror, twelve ignite-reading tests, three generator gates, no dashes).

## Verification

- `node tests/test-364-mcp.cjs`, `test-364-entry-points.cjs`, the four pinned tests, `test-270-tool-schema-budget.cjs`, `test-276-meeting-gate-wiring.cjs`: all exit 0.
- `node scripts/build-skill-mirrors.cjs --check`, `build-command-registry --check`, `check-render-coverage`, `build-orchestration-projection --check`, `check-cirs-declaration --check` (this plan): all exit 0.
- `bash tests/run-all-364.sh`: PASSED=57 FAILED=0 SKIPPED=4 KNOWN=3 (the three KNOWN are the pre-existing reds: framework command ledger, section command ledger, connector part8 boundary). The dash scan leg is green.
- STATE.md and ROADMAP.md untouched.

## Deviations from Plan

### Orchestrator-assigned extra task (own commit, done first)

**1. [Rule 3 - Blocking] Escape dash literals in 364 test regexes**
- **Found during:** pre-task orchestrator request (run-all-364 dash scan failing).
- **Issue:** `tests/test-364-registry-gates.cjs`, `test-364-sr-door.cjs`, `test-364-sr-entry.cjs` and `test-364-sr-steps.cjs` each held `const NO_DASH = /[U+2014 U+2013]/;` with literal characters, which the dash scan flagged.
- **Fix:** replaced with `/[—–]/` (identical behaviour). All four tests re-run and pass; the dash leg is green.
- **Files modified:** the four tests above.
- **Commit:** 1b5cca182

### Auto-fixed Issues

None beyond the above.

### Notes (not deviations)

- `tests/test-b1-reconcile-canonical.cjs` asserts `git diff --quiet HEAD` on `commands/ignite.md`, so it fails while the ignite edit is uncommitted and passes once committed. P4 in `test-364-entry-points.cjs` therefore only goes green after the Task 2 commit; this is inherent to that older test, not a regression.
- No peer-dirty pinned test was encountered; none of the files this plan wrote were dirty before editing.
- The plan's `files_modified` lists no generated-registry drift; none occurred (registry, render-coverage and projection gates all green after the ignite edit, so nothing extra was committed).

## Known Stubs

None.

## Threat Flags

None. The only new surface is the existing zod-enum-gated methodology tool taking one more fixed slug; the only wire calls are the already-guarded `framework_step {framework}` and `recommend_chain {problem_type, max_steps}` (T-364-33..37 mitigated and tested by M1, M5, M6, M9, P2).

## Follow-on

- `KNOWN_METHODOLOGIES` in `lib/mcp/brain-router.cjs` still lacks the slug on purpose (out of bounds here; would reshape the already-red framework-command ledger).

## Self-Check: PASSED

- Files found: tests/test-364-mcp.cjs, tests/test-364-entry-points.cjs, lib/mcp/tool-router.cjs, commands/ignite.md, skills/ignite/SKILL.md.
- Commits found as ancestors of HEAD: 1b5cca182, 31381c8dc, 18bcdbe5e.
