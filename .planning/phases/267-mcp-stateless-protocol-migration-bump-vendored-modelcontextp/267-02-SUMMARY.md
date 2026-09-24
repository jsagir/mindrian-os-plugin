---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 02
subsystem: testing
tags: [rca, qa, new-failure, mcp, streamable-http, sigterm, session-binding]

# Dependency graph
requires:
  - phase: 267-01
    provides: "tests/helpers/mcp-wire-267.cjs (hermetic stdio JSON-RPC helper), 267-BASELINE.md, deferred-items.md"
provides:
  - "Seven filed RCA docs under .planning/debug/, one per NEW FAILURE named in 267-CONTEXT.md (3) or found live at plan time (4), each with a live-reproduced Evidence section against this tree"
  - "mcp-http-flag-off-one-request-per-process.md: live-captured the SDK's exact thrown error text via a non-invasive node -r preload instrumentation (no repo file touched), proving hono's handleFetchError swallows it into an empty 500"
  - "mcp-shim-preseeded-session-id-rejected.md: live-reproduced both the broken (with MINDRIAN_SESSION_ID) and working (without) cases, with the plan-checker-required user-impact statement confirming the flag-ON NORMAL case is the broken one"
affects: [267-07, 267-09, 267-10, 267-12, 267-13, 267-15, 267-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node -r preload monkey-patch to surface an SDK's internally-swallowed error text without editing any repo file (used for RCA 1: patches WebStandardStreamableHTTPServerTransport.prototype.handleRequest via Module.createRequire resolved from the server's own module graph, so it patches the same cached module instance)"
    - "Fake-out-of-scope hermetic reproduction scripts (scratchpad-only, never committed) reused the hermeticEnv() shape from tests/helpers/mcp-wire-267.cjs for HTTP-mode and shim reproductions that the stdio-only helper doesn't itself cover"

key-files:
  created:
    - .planning/debug/mcp-http-flag-off-one-request-per-process.md
    - .planning/debug/app-views-schema-key-drops-input-schemas.md
    - .planning/debug/gate-elicitation-premise-stale-comment.md
    - .planning/debug/runtime-loop-prompts-bogus-args-schema.md
    - .planning/debug/mcp-server-sigterm-no-exit.md
    - .planning/debug/mcp-http-listen-error-false-started.md
    - .planning/debug/mcp-shim-preseeded-session-id-rejected.md
  modified: []

key-decisions:
  - "RCA 1's Evidence needed two reproductions, not one: the plain HTTP POST sequence shows the wire-visible symptom (200 then empty 500), but the SDK's own error text ('Stateless transport cannot be reused across requests') never reaches the wire at all -- hono's handleFetchError maps any rejected fetch-handler promise to a null-body Response. A second, non-invasive node -r preload reproduction was added to surface the literal text the plan's acceptance criteria required, without editing any repo file."
  - "RCA 5's SIGTERM reproduction was extended beyond the plan's HTTP-only literal text to also test the stdio case with stdin left open, confirming the hang is NOT HTTP-socket-specific (registerShutdownHandler's listener installation itself removes Node's default exit-on-signal, independent of transport) -- this strengthens the root-cause claim beyond what the plan's acceptance criteria strictly required."
  - "RCA 7's fix field copies the plan's exact required text verbatim (including the parenthetical about design (a) being a fast-follow candidate) since the plan explicitly said this RCA was amended post-plan-checker-review and the exact wording matters for the navigator handoff."

requirements-completed: [MCPV2-15]

# Metrics
duration: ~65min
completed: 2026-09-24
---

# Phase 267 Plan 02: RCA Filing for the Seven NEW FAILURES Summary

**Seven RCA docs filed to docs/RCA-TEMPLATE.md standard, each with a live-reproduced Evidence section against the current tree (three HTTP-mode server spawns, four stdio-mode server/shim spawns, one non-invasive SDK error-text instrumentation) -- zero production code touched.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-09-24T07:36:00Z
- **Completed:** 2026-09-24T07:51:20Z
- **Tasks:** 2
- **Files modified:** 7 (all new, all under `.planning/debug/`)

## Accomplishments
- Filed RCA 1 (`mcp-http-flag-off-one-request-per-process.md`): live-reproduced the flag-OFF HTTP branch's one-request-per-process bug with a real HTTP client (request 1 = 200, request 2+ = empty 500), THEN added a second, non-invasive `node -r` preload reproduction that patches the SDK's own `handleRequest` (via `Module.createRequire`, no repo file edited) to surface the literal thrown text `Stateless transport cannot be reused across requests. Create a new transport per request.` -- proving both the wire-visible symptom and the SDK's internal cause in one session.
- Filed RCA 2 (`app-views-schema-key-drops-input-schemas.md`): live `tools/list` confirms all three MCP Apps tools (`room-dashboard`, `room-wiki`, `room-graph`) publish `{"type":"object","properties":{}}` on the unchanged tree.
- Filed RCA 3 (`gate-elicitation-premise-stale-comment.md`): quoted the stale comment verbatim from the current tree and cited 267-RESEARCH.md's live wire tee (Claude Code 2.1.280 declaring `elicitation:{}`) as the corrected premise; confirmed the CODE itself (`detectClientCapabilities`) is already correct, only the comment is wrong.
- Filed RCA 4 (`runtime-loop-prompts-bogus-args-schema.md`): live `prompts/list` + `prompts/get` against `bind-room`, `status`, `act` reproduced the exact bogus-argument advertisement and `-32603 keyValidator._parse is not a function` crash on all three, on the unchanged tree.
- Filed RCA 5 (`mcp-server-sigterm-no-exit.md`): live SIGTERM against both an HTTP-mode server (port stayed bound past 5000ms) and a stdio-mode server (stdin left open, also hung past 5000ms) -- confirming the hang is a shared-handler defect, not an HTTP-socket artifact.
- Filed RCA 6 (`mcp-http-listen-error-false-started.md`): held port 3847 with a test-owned listener, spawned the flag-OFF server, and captured the false "started" stderr line printing anyway while the process stayed alive.
- Filed RCA 7 (`mcp-shim-preseeded-session-id-rejected.md`): live-reproduced BOTH cases -- with `MINDRIAN_SESSION_ID` set, every POST gets 400 `Bad Request: No valid session ID provided` and the shim never delivers a response; without it, the identical flow succeeds (unbound). Included the plan-checker-required user-impact statement verbatim, and both candidate fix designs without choosing one.

## Task Commits

Each task was committed atomically:

1. **Task 1: RCAs 1-3 (the three CONTEXT.md NEW FAILURES)** - `27b8eaca1` (test)
2. **Task 2: RCAs 4-7 (the four plan-time NEW FAILURES)** - `c800673e3` (test)

_No plan-metadata-only commit was made separately; this SUMMARY.md and STATE/ROADMAP updates land in the standard final metadata commit._

## Files Created/Modified
- `.planning/debug/mcp-http-flag-off-one-request-per-process.md` - RCA 1, fix owned by 267-12
- `.planning/debug/app-views-schema-key-drops-input-schemas.md` - RCA 2, fix owned by 267-10
- `.planning/debug/gate-elicitation-premise-stale-comment.md` - RCA 3, fix owned by 267-07
- `.planning/debug/runtime-loop-prompts-bogus-args-schema.md` - RCA 4, fix owned by 267-09
- `.planning/debug/mcp-server-sigterm-no-exit.md` - RCA 5, fix owned by 267-13
- `.planning/debug/mcp-http-listen-error-false-started.md` - RCA 6, fix owned by 267-13
- `.planning/debug/mcp-shim-preseeded-session-id-rejected.md` - RCA 7, fix PENDING a navigator decision (267-15 pins, 267-18 seeds)

## Decisions Made
- RCA 1 required a second reproduction technique (a non-invasive SDK-internals instrumentation via `node -r` preload) because the plain HTTP wire never carries the SDK's own error text -- hono's `handleFetchError` swallows any rejected fetch-handler promise into a null-body 500. No repo file was edited to get this; the preload patches the SDK's own cached module instance from outside the repo tree.
- RCA 5's reproduction was extended beyond the plan's literal HTTP-only description to also test stdio (stdin left open), which confirmed the SIGTERM hang is caused by `registerShutdownHandler`'s listener installation itself (removing Node's default exit-on-signal) rather than being specific to the HTTP listening socket. This is a stronger, more precise root-cause claim than the plan's own framing implied, and it directly informs 267-13's required fix scope (the exit call belongs in each entry point, not in the shared `session-catchup.cjs`).
- RCA 7's `Resolution.fix` field copies the plan's exact required text (including the design-(a)-as-fast-follow parenthetical) verbatim, since the plan stated this RCA was specifically amended after plan-checker review to add this text, and the navigator handoff depends on the exact wording surviving unedited.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; this plan's own objective was RCA-filing only (zero production code changes), and every acceptance criterion passed against the live reproductions on the first attempt.

**Total deviations:** 0.
**Impact on plan:** None. Every RCA's Evidence section carries live, tree-verified facts; no acceptance criterion required a second pass.

## Issues Encountered
- RCA 1's initial plain-HTTP reproduction returned a 500 with an EMPTY body (no error text on the wire at all), which did not by itself satisfy the acceptance criterion requiring the literal SDK error string. Root-caused this to hono's `handleFetchError` (`node_modules/@hono/node-server/dist/listener.js`) mapping any rejected fetch-handler promise to `new Response(null, { status: 500 })` with no body. Resolved by adding a second, non-invasive `node -r` preload reproduction that instruments the SDK's own `WebStandardStreamableHTTPServerTransport.prototype.handleRequest` to log the raw `Error.message` before it is swallowed -- no repo file was touched, and both reproductions are documented in RCA 1's Evidence section as complementary facts (wire symptom + internal cause).
- Two files in the working tree carry unrelated, uncommitted peer-session changes (`evals/plurai/211-baseline.json` modified; `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` and `docs/reviews/mindrian-system-atlas.html` untracked) throughout this plan's execution, consistent with the documented multi-session shared-tree reality (see `.planning/STATE.md`'s collision-protocol note). Neither was staged or touched by either task commit; both commits used `git commit --only -- <explicit paths>` per the sequential-execution protocol, and `git status --short` was checked immediately before each commit to confirm only this plan's own files were staged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 267-07, 267-09, 267-10, 267-12, 267-13 each now have a named, live-verified RCA to implement against, with a confirmed Technical Root Cause at file:line and explicit Required Code Changes -- no further investigation needed before those plans start their own fix work.
- 267-15 and 267-18 have RCA 7's full evidence (both broken and working cases) and both candidate fix designs to hand to the navigator; no further reproduction work is needed before that decision is made.
- No blockers for the remaining Wave 0/1 plans. All seven RCA files verified present on disk and via `git log --oneline --all` for both task commits.

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All seven RCA files verified present on disk, plus this SUMMARY.md. Both task commits (`27b8eaca1`, `c800673e3`) verified present in `git log --oneline --all`. No missing items.
