---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 12
subsystem: mcp-tools
tags: [mcp, dikw, claim-write, node-insert, typed-claim, connector-registry, tool-honesty]

# Dependency graph
requires:
  - phase: 276-05
    provides: "276-DECISIONS.md (ratified) -- OQ-276-1 knowledge_type -> epistemic_type mapping placement/scope, OQ-276-2 the claim_write tool shape and write-then-gate order"
  - phase: 276-06
    provides: "the frozen tool-honesty disposition ledger (36 tools / 130 branches at b88a39d3), now deliberately invalidated by this plan"
provides:
  - "lib/mcp/tools/claim.cjs: the claim_write MCP tool, Desktop/Cowork's first reachable path to a real DIKW claim write"
  - "lib/core/navigation/typed-claim.cjs: KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE mapping table replacing the hardcoded 'extracted_fact' constant"
  - "tests/test-276-claim-write-primitive.cjs: RED-then-GREEN proof (44 assertions) of the write, the two-layer refusal path, the chokepoint routing, and the born-wired declaration"
  - "regenerated data/mcp-tool-connectors.json, data/connector-registry.json, data/connector-coverage-ledger.json, data/harness-manifest.json with claim_write's F.1 declaration"
affects: [276-15, 276-16, meeting-filing-tri-polar-gap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MCP write tool disjoint-file seam: register(server, ctx) + connectors export, own writePathRefusal/currentClientVersion/textResponse copy (never requires a sibling tools/*.cjs module)"
    - "Success shape constructed FROM the underlying writer's own return value (Pattern 3, the rooms-open verified-result construction), never asserted independently"
    - "Hermetic MCP-tool test harness: require lib/mcp/register-core-tools.cjs directly, stub server.tool() capture, invoke the captured handler -- same style as tests/test-kwl-meeting-mcp-honesty.cjs, lighter than a full stdio spawn"

key-files:
  created:
    - tests/test-276-claim-write-primitive.cjs
    - lib/mcp/tools/claim.cjs
  modified:
    - lib/core/navigation/typed-claim.cjs
    - tests/test-270-tool-schema-budget.cjs
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "typed-claim.cjs's mapping table (Rule 2, auto-add): 276-DECISIONS.md OQ-276-1 requires the knowledge_type -> epistemic_type table to live inside typed-claim.cjs, but this plan's own frontmatter files_modified omitted that file. Built it anyway -- the ratified disposition and this session's own success_criteria both require it, and the RED test pins all 6 rows independently of the module's own claims."
  - "claim_write's hitl_shape is F.1 (material write, not a fork), matching artifact_file's precedent exactly -- the write itself decides nothing; the genuine Decision-Gate fork is gate_answer, unchanged by this plan."
  - "test-270's AFTER baseline re-measured 39->40 tools / 33509->38970 bytes, per this plan's own authorization to move the baseline when a new tool exceeds DRIFT_TOLERANCE_PCT; the drift was mostly pre-existing (phases 271-275 edits never re-measured), only the +1 toolCount is this plan's own."

requirements-completed: [TOOLHON-07]

# Metrics
duration: 7min
completed: 2026-09-03
---

# Phase 276 Plan 12: The claim-write MCP Primitive Summary

**New `claim_write` MCP tool gives Desktop/Cowork a real DIKW claim write (proposed, gate_answer-promoted) through typed-claim.cjs's writeClaimNode -> node-insert.cjs, with a per-knowledge_type epistemic_type mapping table replacing the old hardcoded constant.**

## Performance

- **Duration:** 7 min (commit-to-commit: 21:59:10 -> 22:06:14 local time, 2026-09-03; research/context-loading time not counted)
- **Started:** 2026-09-03T18:59:10Z
- **Completed:** 2026-09-03T19:06:14Z
- **Tasks:** 3 (RED, GREEN, born-wired regeneration)
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `claim_write` MCP tool ships: a Desktop/Cowork caller can now write a real 6-value-`knowledge_type` DIKW claim node, previously reachable only from the CLI's Claimify-style extraction pipeline.
- The write routes through exactly one path -- `writeClaimNode` -> `node-insert.cjs` -- proven by a source-text pin (no `node:sqlite`, no `room-db.cjs` construction, no raw `INSERT`), not by review alone.
- `typed-claim.cjs`'s hardcoded `epistemic_type: 'extracted_fact'` is gone, replaced by `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE`, pinning all 6 rows of 276-DECISIONS.md OQ-276-1's proposed mapping table.
- An invalid `knowledge_type` is refused at two independent layers (the z.enum schema boundary and typed-claim.cjs's own authoritative check), both writing nothing.
- The tool scans clean on `check-tool-honesty.cjs`'s first sweep, and is born wired with an F.1 `hitl_shape` declaration regenerated into all four downstream registry/manifest files.

## Task Commits

Each task was committed atomically:

1. **Task 1: the RED test for the claim write primitive** - `0fef3e80` (test) -- 402 lines, observed failing (0 passed / 17 failed, exit 1) against a tree with no `lib/mcp/tools/claim.cjs`.
2. **Task 2: the claim write MCP tool module** - `ddd13ddf` (feat) -- `lib/mcp/tools/claim.cjs` created; `lib/core/navigation/typed-claim.cjs` modified (mapping table, deviation documented); `tests/test-270-tool-schema-budget.cjs` re-baselined (deviation documented); `tests/test-276-claim-write-primitive.cjs` fixed for hermetic room resolution (deviation documented). All 44 assertions pass (exit 0).
3. **Task 3: the born-wired declaration and the regenerated registries** - `90b73eb0` (feat) -- `data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/connector-coverage-ledger.json` regenerated by `scripts/build-connector-registry.cjs`; `data/harness-manifest.json` regenerated by `scripts/build-harness-manifest.cjs` (pre-commit hook caught its drift, Rule 3 auto-fix).

_No plan-metadata commit yet -- see Final Commit below._

## Files Created/Modified

- `tests/test-276-claim-write-primitive.cjs` - RED-then-GREEN test, 44 assertions across groups A (registration/description shape) through G (gate order); independently reads `room.db` via `node:sqlite` after every write, never trusting the tool's own response.
- `lib/mcp/tools/claim.cjs` - the `claim_write` MCP tool: zod schema (`knowledge_type` as `z.enum` over the 6 `KNOWLEDGE_TYPES`, `text` plus optional provenance fields), `writePathRefusal` applied exactly as `graph_write`/`memory_event`/`artifact_file`, success shape constructed from `writeClaimNode`'s own return value, `connectors` export declaring F.1.
- `lib/core/navigation/typed-claim.cjs` - adds `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` (all 6 rows from 276-DECISIONS.md OQ-276-1's proposed table) next to `KNOWLEDGE_TYPES`; `writeClaimNode`'s `insertNode` call now derives `epistemic_type` from the mapping instead of the hardcoded `'extracted_fact'` constant.
- `tests/test-270-tool-schema-budget.cjs` - `AFTER` re-baselined from 270-12's snapshot (39 tools, 33509 bytes) to a fresh live measurement (40 tools, 38970 bytes, +16.30% against the stale figure); the prior 270-12 snapshot preserved as `AFTER_270_12` for history.
- `data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json` - regenerated by script (never hand-edited); each carries exactly one new additive entry/digest bump for `claim_write`.

## Decisions Made

- **Placement of the mapping table (Rule 2):** built inside `typed-claim.cjs` per 276-DECISIONS.md OQ-276-1's ratified placement ("map at the claim writer"), even though this plan's own PLAN.md frontmatter `files_modified` list omitted that file. The plan's objective, phase_rules, and this session's own success_criteria all require it; the change is the smallest one that satisfies the ratified disposition (one new frozen object, one line changed at the `insertNode` call site).
- **hitl_shape choice:** F.1, matching `artifact_file`'s existing precedent exactly (a proposed-node write, not a fork). Rejected the `connector.excluded` route the plan's Task 3 offered as an alternative, because `claim_write` is a real material write (not render-only/pure-capability) -- the exemption language in `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` is scoped to render-only surfaces, which this tool is not.
- **Schema-boundary refusal test design:** rather than spawning a full stdio server to observe the SDK's own zod-validation error, the RED/GREEN test validates the ACTUAL captured schema shape (`z.object(reg.schema).safeParse(...)`) -- the same shape the SDK internally wraps (`node_modules/@modelcontextprotocol/sdk/.../server/mcp.js:175-181`), keeping the test fast while staying honest about what it verifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Built the KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE mapping table in typed-claim.cjs**
- **Found during:** Task 2 (writing the claim-write handler)
- **Issue:** 276-DECISIONS.md OQ-276-1 (ratified) requires the knowledge_type -> epistemic_type mapping table to live in `typed-claim.cjs`, replacing the pre-existing hardcoded `epistemic_type: 'extracted_fact'` constant that collapsed all 6 `KNOWLEDGE_TYPES` onto one value. This plan's own frontmatter `files_modified` list did not name `typed-claim.cjs`, but the phase-level ratified decision and this session's directly-given success_criteria both require it, and without it the tool's `epistemic_type` output would be wrong for 5 of 6 `knowledge_type` values.
- **Fix:** Added the frozen `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` object next to `KNOWLEDGE_TYPES`, changed the `insertNode` call's `epistemic_type` from the hardcoded string to `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE[knowledge_type]`, exported the table.
- **Files modified:** `lib/core/navigation/typed-claim.cjs`
- **Verification:** RED test's assertion group B loops all 6 `EXPECTED_MAPPING` rows (transcribed independently from 276-DECISIONS.md, not imported from the module) and reads each written node's `epistemic_type` back from `room.db`.
- **Committed in:** `ddd13ddf` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed non-hermetic room resolution in the RED test itself**
- **Found during:** Task 2 (first GREEN attempt: writes reported `ok:true` but the independent `room.db` read showed 0 new rows)
- **Issue:** `lib/core/resolve-active-room.cjs` defaults its `home` to `$HOME/MindrianRooms` and consults that home's `registry.json` for an active-session hit. On this real dev machine that registry is real, so the test's writes were silently redirected into an actual room's `room.db` instead of the test's own temp room -- exactly the "never trust the tool's own success claim" discipline this whole phase exists to enforce, caught by the test's own independent verification.
- **Fix:** Pinned `MINDRIAN_ROOMS_HOME` to a fresh, registry-less scratch directory before registration (the same hermetic-override seam `resolve-active-room.cjs`'s own header names), and deleted any inherited `CLAUDE_ACTIVE_ROOM`.
- **Files modified:** `tests/test-276-claim-write-primitive.cjs`
- **Verification:** re-ran the test; all 44 assertions pass, writes land in the temp room's `room.db`.
- **Committed in:** `ddd13ddf` (Task 2 commit, alongside the GREEN implementation)

**3. [Rule 3 - Blocking] Re-baselined tests/test-270-tool-schema-budget.cjs's AFTER constant**
- **Found during:** Task 2 verification (running the full gate list named in the plan's acceptance criteria)
- **Issue:** Adding `claim_write` moved the live `tools/list` measurement from 39 to 40 tools and the total schema+description byte count from 33509 (the 270-12 AFTER snapshot) to 38970 bytes -- a 16.30% drift, exceeding `DRIFT_TOLERANCE_PCT` (10%). Most of that drift was already present before this plan touched anything (phases 271-275 edited tool descriptions/schemas between 2026-08-27 and 2026-09-03 without re-running this measurement); only the +1 toolCount is this plan's own.
- **Fix:** Re-measured `AFTER` with the file's own `measure()` function against the live server, per this plan's own acceptance criteria explicitly authorizing this move ("the baseline moves DELIBERATELY with the measured percentage recorded and named in the commit message"). The prior 270-12 snapshot is preserved as `AFTER_270_12` for history. `DRIFT_TOLERANCE_PCT` itself was never touched.
- **Files modified:** `tests/test-270-tool-schema-budget.cjs`
- **Verification:** `node tests/test-270-tool-schema-budget.cjs` -- 5/5 passed.
- **Committed in:** `ddd13ddf` (Task 2 commit)

**4. [Rule 3 - Blocking] Regenerated data/harness-manifest.json**
- **Found during:** Task 3, first commit attempt (pre-commit hook blocked with a harness-manifest drift error)
- **Issue:** `data/harness-manifest.json`'s `wiring` role tracks a digest and `source_count` of `data/connector-registry.json`. Regenerating the connector registry (208 -> 209 entries) left the harness manifest stale.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` (never hand-edited); `source_count` moved 208 -> 209 in lockstep, digest updated.
- **Files modified:** `data/harness-manifest.json`
- **Verification:** pre-commit hook's `harness-manifest: OK` line on the successful retry.
- **Committed in:** `90b73eb0` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 missing-critical, 1 bug, 2 blocking)
**Impact on plan:** All four were necessary for correctness (the mapping table is the whole point of OQ-276-1), test integrity (the hermetic fix), or the commit gate (the two regenerations). No scope creep -- nothing outside claim_write's own correctness was touched.

## Issues Encountered

- A stray `*/` inside a glob-style path reference (`276-*/276-DECISIONS.md`) in the RED test's own header comment terminated the block comment early, producing a syntax error on first run. Reworded to spell out the full phase directory name instead of using a glob. No behavior change, caught before the first RED run was even meaningful.
- A concurrent session (visible in `git log` as `docs(339): add pattern map`, `23daa956`) landed a commit on `main` between this plan's Task 2 and Task 3 commits, consistent with the shared-working-tree collision pattern named in this repo's own CLAUDE.md handoffs. No conflict: every commit here staged by explicit path (`git diff --cached --name-only` checked before each), and the concurrent commit touched unrelated files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `claim_write` is live and reachable from Desktop/Cowork; the remaining reachable-half work named in the plan's objective (the F.8 filing gate) is explicitly owned by plan 276-14, not this plan.
- The tool-honesty ledger freeze at `b88a39d3` (36 tools / 130 branches) is now invalidated BY DESIGN (live scan: 37 tools / 131 branches). `tests/test-276-tool-honesty-findings-closed.cjs` group F fails as expected; plan 276-15 re-freezes it. Do not treat that failure as a regression.
- Two pre-existing, unrelated test failures remain open in the phase suite (`tests/test-276-orchestration-scout-honesty.cjs`, `tests/test-276-room-content-honesty.cjs`), both owned by not-yet-executed plan 276-08 (`lib/mcp/tool-router.cjs` description fixes). Neither touches `claim.cjs` or `typed-claim.cjs`.
- The operator-cap comparison (`epistemic_type` vs. `lib/conversation/operator.cjs`'s `EPISTEMIC_LEVELS`) remains a named, deliberate follow-up owned by plan 276-16's close-out, per OQ-276-1's ratified scope -- not built here, not silently dropped.

## Self-Check: PASSED

- FOUND: `lib/mcp/tools/claim.cjs`
- FOUND: `lib/core/navigation/typed-claim.cjs` (KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE present)
- FOUND: `tests/test-276-claim-write-primitive.cjs`
- FOUND commit `0fef3e80` (test, RED)
- FOUND commit `ddd13ddf` (feat, GREEN)
- FOUND commit `90b73eb0` (feat, registries)

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Plan: 12*
*Completed: 2026-09-03*
