---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 06
subsystem: mcp
tags: [mcp, sdk-v2, registerTool, tool-router, contract-version, cirs, registration-rewrite]

# Dependency graph
requires:
  - phase: 267-01
    provides: "tests/helpers/mcp-wire-267.cjs (hermeticEnv, wireSnapshot, LOCAL_SERVER), tests/run-all-267.sh aggregator (already scaffolded a run_if leg for this plan's own test file), tests/fixtures/267/wire-snapshot-zod4.json (44-tool local-server baseline)"
  - phase: 267-05
    provides: "@modelcontextprotocol/{server,core,client}@2.1.0 installed in lockstep; the registerTool arguments-normalization and SUPPORTED_PROTOCOL_VERSIONS pattern precedents"
provides:
  - "tests/test-267-mcpv2-registration-api.cjs: a recording fake McpServer driving any lib/mcp/ registrar module in isolation, stack-frame attribution (so a cascade through registerCoreTools never pollutes another file's verdict), --file <relpath> per-commit mode plus full-mode with a live wireSnapshot() title/count check"
  - "lib/mcp/tool-router.cjs's 11 registration sites (room_state, room_content, room_graph, methodology, analysis, intelligence, meeting, export, orchestration, room_bind, eureka_critic) on server.registerTool"
  - "lib/mcp/contract-version.cjs's 1 registration site (contract_version) on server.registerTool"
  - "12 of 51 phase-wide registration-rewrite sites migrated"
affects: [267-07, 267-08, 267-09, 267-10, 267-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registration-API recorder test: a fake McpServer exposing both the removed-in-v2 variadic methods (tool/prompt/resource) and the v2 config methods (registerTool/registerPrompt/registerResource), attributing each captured call to its source file via new Error().stack (first frame under lib/mcp/, skipping node_modules), so a registrar that cascades into other registrars (tool-router.cjs -> registerCoreTools -> contract-version.cjs + every tools/*.cjs module) can still be graded file-by-file."
    - "Registration rewrite rule (267-06..267-08): server.tool(NAME, DESC, SHAPE, CB) -> server.registerTool(NAME, { title: TITLE, description: DESC, inputSchema: z.object(SHAPE) }, CB). DESC and SHAPE move verbatim; TITLE is mechanically derived (split NAME on _/-, capitalize each word, join with spaces); CB and its parameter names are untouched."
    - "Existing fake-server test fixtures that only understood the v1 tool(name, desc, shape, handler) capture form need a registerTool(name, config, handler) sibling added the moment their target registrar migrates -- documented here for 267-07..267-11 to recognize immediately instead of rediscovering."
  key-decisions-inline: "see key-decisions below"

key-files:
  created:
    - tests/test-267-mcpv2-registration-api.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/contract-version.cjs
    - tests/test-232.1-room-state-density.cjs
    - tests/test-248-room-bind-honest-return.cjs
    - tests/test-347-visualize-real-chain.cjs
    - tests/test-kwl-meeting-mcp-honesty.cjs
    - tests/test-room-bind-health-signal.cjs
    - tests/test-room-bind-stdio-session-fallback.cjs
    - tests/test-room-state-active-room-misroute.cjs
    - tests/test-room-state-no-registry-regression.cjs
    - tests/test-rooms-open-actually-switches.cjs
    - tests/test-tool-router-active-room-misroute.cjs
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md

key-decisions:
  - "Task 1 (the RED test) had to be committed against genuinely pre-migration code: the test file was drafted after Task 2's edits were already applied in-editor, so before running the RED verification the tool-router.cjs diff was captured (git diff), the file was reverted to HEAD (git checkout --), the test was proven RED against the real unmigrated source (11 + 1 v1-variadic FAIL lines), committed, and only then was the captured diff re-applied (git apply) for Task 2. This keeps the RED gate honest rather than RED-by-construction."
  - "The orchestration site's leading multi-line comment (Phase 355 D-23, explaining why scout-hsi's own sentence is honest) was moved to sit directly above the `description:` key inside the new config object, per the plan's explicit instruction that this comment block stays attached to the description value it explains."
  - "SHAPE properties were re-indented one level deeper (nested under the new `inputSchema: z.object({` wrapper) for readability; this is a whitespace-only change. The zod4-contract test's byte-identical-description/schema proof confirms no semantic drift."
  - "10 pre-existing test fixtures broke immediately on tool-router.cjs's own commit (each built a fake McpServer whose only capture method was the removed-in-v2 tool(name, desc, shape, handler) form; production code now calls registerTool(name, config, handler) instead). Fixed as one Rule-1 deviation commit: each fixture's makeFakeServer()/stub gained a registerTool sibling capturing the handler under the same key; test-kwl-meeting-mcp-honesty.cjs additionally extracts description/schema from the v2 config object since it asserts on those fields directly."
  - "test-347-visualize-real-chain.cjs's own Task 2 Test 7 (a hardcoded safeResolveSection occurrence-count == 6 assertion) stayed red after the registerTool fixture fix -- confirmed via git diff and git show HEAD that the actual count (7) predates this plan's own tool-router.cjs commit entirely (this plan's diff contains zero lines matching safeResolveSection). Logged to deferred-items.md as pre-existing and out of scope, not fixed."

requirements-completed: [MCPV2-02, MCPV2-08]

# Metrics
duration: ~90min
completed: 2026-09-24
---

# Phase 267 Plan 06: Registration-API Test + tool-router.cjs / contract-version.cjs to registerTool Summary

**tests/test-267-mcpv2-registration-api.cjs (a recording fake McpServer with stack-frame call attribution) went RED against the real unmigrated source, then lib/mcp/tool-router.cjs's 11 tool registrations and lib/mcp/contract-version.cjs's 1 registration moved from the removed-in-v2 `server.tool()` variadic form to `server.registerTool(name, {title, description, inputSchema: z.object(shape)}, cb)` on the still-v1 McpServer, one commit per file, both green under the per-file gate and the phase's CIRS/zod4-contract/198 suites.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-24 (PLAN_BASE `a7cb313d2c1e0a3cc5175047a7a7e7e6eb89bcc`)
- **Completed:** 2026-09-24
- **Tasks:** 2
- **Files modified:** 13 (1 created, 12 modified)

## Accomplishments
- Wrote `tests/test-267-mcpv2-registration-api.cjs`: a fake McpServer exposing both the v1 variadic methods (`tool`/`prompt`/`resource`) and the v2 config methods (`registerTool`/`registerPrompt`/`registerResource`), plus the no-op `server.server.{getClientCapabilities,getClientVersion,elicitInput}` and `server.{sendResourceListChanged,sendToolListChanged,sendPromptListChanged,isConnected}` surface production registrars defensively probe for. Every recorded call is attributed to its source file via `new Error().stack` (first frame under `lib/mcp/`, skipping `node_modules`), so `registerRouterTools`'s own cascade into `registerCoreTools` (which registers `contract_version` and every `tools/*.cjs` module on the same server) never pollutes tool-router.cjs's own per-file verdict.
- Proved genuine RED against the real pre-migration source before committing the test: `--file lib/mcp/tool-router.cjs` printed 11 `v1-variadic` FAIL lines, `--file lib/mcp/contract-version.cjs` printed 1. Required capturing and re-applying the Task 2 diff around the Task 1 commit (see key-decisions) since the edits had been drafted in the wrong order.
- Rewrote all 11 `server.tool()` sites in `lib/mcp/tool-router.cjs` (`room_state`, `room_content`, `room_graph`, `methodology`, `analysis`, `intelligence`, `meeting`, `export`, `orchestration`, `room_bind`, `eureka_critic`) to `server.registerTool(name, {title, description, inputSchema: z.object(shape)}, cb)`. Descriptions and shapes moved verbatim; titles mechanically derived (`room_state` -> `Room State`, `eureka_critic` -> `Eureka Critic`); every handler body and callback parameter name untouched (`grep -c "server\.tool(" lib/mcp/tool-router.cjs` = 0; `grep -c "server\.registerTool("` = 11).
- Rewrote `lib/mcp/contract-version.cjs`'s 1 site (`contract_version`, empty shape `{}` -> `z.object({})`, title `Contract Version`), adding a local `const { z } = require('zod')` (the file had none before).
- CIRS gate (`node tests/test-267-mcpv2-cirs-gates.cjs`) green at both commits: `build-connector-registry.cjs --check` exit 0, `check-shape-declaration.cjs --strict` drift stays within the 53-violation baseline with zero new violations under `lib/mcp/`, connector-descriptor count unchanged at 31 (matches 267-BASELINE.md). `node tests/test-267-mcpv2-zod4-contract.cjs` confirms zero description/schema drift.
- `git diff PLAN_BASE -- lib/mcp/tool-router.cjs | grep "^[-+]" | grep -c "MCP_TOOL_CONNECTORS\|hitl_shape"` = 0: neither commit touched a connector export or a hitl_shape declaration.
- Found and fixed a Rule-1 regression this plan's own tool-router.cjs commit directly caused: 10 pre-existing test fixtures (`test-232.1-room-state-density.cjs`, `test-248-room-bind-honest-return.cjs` [a plan gate], `test-347-visualize-real-chain.cjs`, `test-kwl-meeting-mcp-honesty.cjs`, `test-room-bind-health-signal.cjs`, `test-room-bind-stdio-session-fallback.cjs`, `test-room-state-active-room-misroute.cjs`, `test-room-state-no-registry-regression.cjs`, `test-rooms-open-actually-switches.cjs`, `test-tool-router-active-room-misroute.cjs`) each build their own fake `McpServer` to invoke a tool-router.cjs handler directly in-process; every one of them only understood the removed-in-v2 `tool(name, desc, shape, handler)` capture form and crashed (`TypeError: server.registerTool is not a function`) or silently failed to find their target tool the moment tool-router.cjs started calling `registerTool` instead. Added a `registerTool(name, config, handler)` sibling to each fixture's fake server, capturing the handler the same way the v1 form did (and, in `test-kwl-meeting-mcp-honesty.cjs`'s case, extracting `description`/`schema` from the v2 config object since that file asserts on those fields directly). All 10 green after the fix.
- Ran the full verification battery from the plan's `<verify>` blocks plus its success criteria: registration-API per-file checks green for both target files; `test-267-mcpv2-cirs-gates.cjs`, `test-267-mcpv2-zod4-contract.cjs`, `test-234-tool-description-floor.cjs` (188/188), `test-248-resolver-census.cjs` (4/4), `test-248-room-bind-session-authoritative.cjs` (6/6), `test-248-room-bind-honest-return.cjs` (27/27) all green; `bash tests/run-all-198.sh` = 13 pass / 3 fail / 0 skip (byte-identical to 267-BASELINE.md's documented pre-existing trio: "Part 8 local-only floor", "SPEC-2 contract-version + per-tool schema validity", "SPEC-5 hooks/ adapter-only budget"); `bash tests/run-all-267.sh` = PASS=23 FAIL=1 SKIP=9, the one FAIL being this plan's own new test's full-mode run (`--file`-less), which the plan explicitly documents stays RED until 267-09 migrates the last local-server registrar.

## Task Commits

Each task was committed atomically (Task 1 required a diff-capture/revert/re-apply cycle to keep the RED gate honest; Task 2 split into its own per-file commits plus one deviation-fix commit, per the plan's explicit "one commit per file, CIRS gate after each" instruction):

1. **Task 1: Registration-API test (RED against unmigrated registrars)** - `624beb2c0` (test)
2. **Task 2a: Rewrite tool-router.cjs (11 sites)** - `81e594def` (feat)
3. **Task 2b: [Rule 1] Fix 10 fake-server test fixtures broken by the registerTool migration** - `bd14ece53` (fix)
4. **Task 2c: Rewrite contract-version.cjs (1 site)** - `dffd3217b` (feat)
5. **Task 2d: Log the pre-existing test-347 count mismatch** - `14f5a7e77` (docs)

_This SUMMARY.md, STATE.md's additive note, and ROADMAP.md's 267-06 line land in this session's own metadata commit._

## Files Created/Modified
- `tests/test-267-mcpv2-registration-api.cjs` - the recording fake-McpServer registration-API test (new)
- `lib/mcp/tool-router.cjs` - 11 sites on `registerTool`
- `lib/mcp/contract-version.cjs` - 1 site on `registerTool`, gained a local `require('zod')`
- `tests/test-232.1-room-state-density.cjs`, `tests/test-248-room-bind-honest-return.cjs`, `tests/test-347-visualize-real-chain.cjs`, `tests/test-kwl-meeting-mcp-honesty.cjs`, `tests/test-room-bind-health-signal.cjs`, `tests/test-room-bind-stdio-session-fallback.cjs`, `tests/test-room-state-active-room-misroute.cjs`, `tests/test-room-state-no-registry-regression.cjs`, `tests/test-rooms-open-actually-switches.cjs`, `tests/test-tool-router-active-room-misroute.cjs` - each fake McpServer taught the `registerTool` capture form
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md` - logged the pre-existing test-347 `safeResolveSection` count mismatch

## Decisions Made
See `key-decisions` in the frontmatter above (the diff-capture/revert/re-apply cycle for an honest RED gate, the orchestration comment placement, the SHAPE re-indentation, the 10-fixture Rule-1 fix, and the test-347 deferred classification).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 10 pre-existing test fixtures' fake McpServer objects broke on tool-router.cjs's own registration rewrite**
- **Found during:** Task 2, step 3 (running the plan's own required gate list, specifically after `bash tests/run-all-198.sh` prompted a check of every test whose fake server used the `.tool(` pattern, per the deviation rule's scope-boundary check)
- **Issue:** Each fixture builds its own minimal fake `McpServer` to invoke a `tool-router.cjs` (or, for `test-kwl-meeting-mcp-honesty.cjs`, the same registrar) handler directly, in-process, without spawning a real server. Every one of them only implemented the removed-in-v2 `tool(name, desc, shape, handler)` capture method. The moment tool-router.cjs started calling `registerTool(name, config, handler)` instead, these fixtures either crashed outright (`TypeError: server.registerTool is not a function`) or silently registered nothing, so their target tool handler was never found.
- **Fix:** Added a `registerTool(name, config, handler)` method to each fixture's fake server, capturing the handler under the same map/key the v1 `tool()` form used. `test-kwl-meeting-mcp-honesty.cjs` additionally destructures `description`/`schema` from the v2 `config` object (rather than positional args) since it asserts directly on the `meeting` tool's description text.
- **Files modified:** `tests/test-232.1-room-state-density.cjs`, `tests/test-248-room-bind-honest-return.cjs` (a plan gate file), `tests/test-347-visualize-real-chain.cjs`, `tests/test-kwl-meeting-mcp-honesty.cjs`, `tests/test-room-bind-health-signal.cjs`, `tests/test-room-bind-stdio-session-fallback.cjs`, `tests/test-room-state-active-room-misroute.cjs`, `tests/test-room-state-no-registry-regression.cjs`, `tests/test-rooms-open-actually-switches.cjs`, `tests/test-tool-router-active-room-misroute.cjs`
- **Verification:** All 10 files re-run individually, all green (e.g. `test-248-room-bind-honest-return.cjs`: 27/27; `test-rooms-open-actually-switches.cjs`: 10/10; `test-kwl-meeting-mcp-honesty.cjs`: 37/37).
- **Commit:** `bd14ece53`

---

**Total deviations:** 1 auto-fixed (Rule 1 -- a real regression across 10 test fixtures, directly and only caused by this plan's own tool-router.cjs registration rewrite; no production/security logic touched).
**Impact on plan:** Required to keep `test-248-room-bind-honest-return.cjs` (an explicit plan gate) and the general "no NEW failures" success criterion true. No scope creep: every fixed file's breakage traces to this plan's own diff, and the fix is a mechanical, symmetric capture-method addition in each case.

## Issues Encountered
- Task 1's test file was drafted (and initially written to disk) AFTER Task 2's tool-router.cjs edits had already been applied in-editor, inverting the plan's required RED-before-GREEN order. Corrected before committing anything: captured the in-progress tool-router.cjs diff (`git diff > scratch.diff`), reverted the file to HEAD (`git checkout --`), proved the test genuinely RED against the real unmigrated source (11 + 1 FAIL lines), committed the test, then re-applied the captured diff (`git apply`) to resume Task 2. No functional impact; documented here because the SUMMARY must be honest about how the RED gate was actually reached.
- `tests/test-347-visualize-real-chain.cjs` surfaced a second, unrelated failure (Task 2 Test 7, a hardcoded `safeResolveSection` occurrence-count assertion expecting 6, actual 7) once its fake-server crash was fixed. Confirmed via `git diff` (zero lines matching `safeResolveSection` in this plan's own tool-router.cjs commit) and `git show HEAD:lib/mcp/tool-router.cjs | grep -c safeResolveSection` (already 7 before this plan touched the file) that this predates 267-06 entirely. Logged to `deferred-items.md`, not fixed (out of scope, unrelated to the registration-API migration).
- A peer session force-moved `HEAD` mid-plan (from `a7cb313d2` to `8a07a03b3`, a `test(360-05)` commit unrelated to `lib/mcp/`) between this plan's own commits; confirmed via `git log a7cb313d2..HEAD -- lib/mcp/tool-router.cjs lib/mcp/contract-version.cjs` that the peer commit touched neither of this plan's target files, so PLAN_BASE stayed valid throughout. `gsd-tools query roadmap.update-plan-progress` also introduced unrelated blank-line drift under Phase 355.1's Wave sections and incorrectly flipped 267-04's checkbox to `[x]` (267-04 is still genuinely BLOCKED per its own SUMMARY, the tool only checked for SUMMARY.md file presence); both reverted, and ROADMAP.md was hand-edited instead, touching only the Plans counter and 267-06's own line, per this plan's explicit sequential_execution instruction to check the full diff before committing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 12 of 51 phase-wide registration-rewrite sites now migrated (tool-router.cjs's 11 + contract-version.cjs's 1). The registration rewrite rule (server.tool -> server.registerTool with a z.object-wrapped shape and a mechanically-derived title) is proven end to end on the largest single registrar in the phase.
- `tests/test-267-mcpv2-registration-api.cjs` is now live for 267-07 through 267-11 to reuse as their own per-commit `--file` gate; its full mode (no `--file`) stays documented-RED (currently PASS=22 FAIL=45, 29 of 44 live tools still missing a title) until 267-09 migrates the last local-server registrar.
- Documented pattern for 267-07..267-11: any pre-existing test fixture with its own hand-rolled fake `McpServer` needs a `registerTool` (and, when 267-09 lands, `registerPrompt`/`registerResource`) capture sibling the moment ITS target registrar migrates -- check for this proactively rather than discovering it via a crash.
- No blockers for 267-07. Zero changes to any of the 51-12=39 still-unmigrated sites, `lib/core/brain-client.cjs`, `mcp-server-brain/`, or `/home/jsagi/Theo` (all verified zero-diff against PLAN_BASE for the files outside this plan's own two targets).

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All created/modified files verified present on disk (`tests/test-267-mcpv2-registration-api.cjs`,
`lib/mcp/tool-router.cjs`, `lib/mcp/contract-version.cjs`, this SUMMARY.md, and the rest of the
modified-files list above). All five task commits (`624beb2c0`, `81e594def`, `bd14ece53`,
`dffd3217b`, `14f5a7e77`) verified present in `git log --oneline --all`. No missing items.
