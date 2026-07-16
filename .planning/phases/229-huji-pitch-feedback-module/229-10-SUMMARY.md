---
phase: 229-huji-pitch-feedback-module
plan: 10
subsystem: infra
tags: [async, execFile, mcp, cascade-06, plugin-pinning, huji, pws-grading, parity-test]

# Dependency graph
requires:
  - phase: 229-07
    provides: "scripts/huji-run-one.cjs runOne + all Stage A/B helpers (scaffoldScratchRoom, buildStageAPrompt, buildStageAArgs, buildStageBArgs, parseEnvelope, renderFeedbackMarkdown, runGuardrails, resolveConfig)"
  - phase: 229-08
    provides: "scripts/huji-batch.cjs (the sync-only batch orchestrator that must stay on runOne)"
  - phase: 87-04
    provides: "the CASCADE-06 sync/async split precedent (lib/core/room-ops-async.cjs) and its parity-test shape"
provides:
  - "runOneAsync: an MCP-daemon-safe async twin of runOne that never calls the blocking sync spawn primitive"
  - "runClaudeAsync: the execFile-to-spawnSync envelope translation helper"
  - "D14 CI-blocking parity gate proving runOne and runOneAsync return identical failure envelopes"
  - "a real, evidenced verification that the git-tag-pin mechanism resolves /mos:pipeline PWS_grading from outside this repo"
  - "the live finding that the external repo's documented v1.15.2 pin is STALE (no recipe until v1.15.3-beta.22)"
affects: [mindrian-pitch-feedback-mcp, 229-09, mcp-server]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CASCADE-06 async twin: await execFile (promisified) instead of the blocking sync spawn primitive, in a dedicated *-async.cjs sibling, for any function an MCP daemon would call"
    - "envelope translation: reconstruct spawnSync's {status,stdout,stderr,error} from execFile's resolve/reject split at one chokepoint (runClaudeAsync)"
    - "in-source stability contract: name the exhaustive reason-code set in the file header as a documented breaking-change surface"
    - "live pin smoke test: verify a tag carries the recipe via git show BEFORE cloning, then prove routing with a real capped claude --plugin-dir call, classified from model output + permission_denials"

key-files:
  created:
    - scripts/huji-run-one-async.cjs
    - lib/memory/huji-run-one-async-parity.test.cjs
    - scripts/huji-pin-smoketest.cjs
    - .planning/phases/229-huji-pitch-feedback-module/229-10-PIN-SMOKETEST.md
  modified:
    - tests/run-all-229.sh

key-decisions:
  - "runOneAsync is a NEW sibling file; huji-run-one.cjs stays byte-for-byte unmodified (reuse before build, Canon Part 7)"
  - "The one translation point (execFile REJECTS on non-zero exit vs the sync spawn primitive RETURNING a .status field) is isolated in runClaudeAsync and proven identical by the D14 gate"
  - "The pin smoke test classifies RESOLVED from the model output AND permission_denials, so a turn/budget cap that empties the result field cannot hide a genuine routing success"
  - "Live finding recorded, not assumed: the external repo's README pin v1.15.2 does NOT carry PWS_grading; it must be re-pinned to a recipe-bearing tag (>= v1.15.3-beta.22)"

patterns-established:
  - "CASCADE-06 async twin pattern for the grading engine, mirroring the room-ops sync/async split"
  - "phase-local test wiring: Phase 229 tests attach through tests/run-all-229.sh run_if legs, not the general cross-phase registry"

requirements-completed: [D14]

# Metrics
duration: 16min
completed: 2026-07-16
---

# Phase 229 Plan 10: MCP-Safe Async Engine Twin + Pin Verification Summary

**runOneAsync - a CASCADE-06 execFile-based async twin of runOne that never blocks the event loop - plus a D14 parity gate proving the two failure envelopes are identical, and a live smoke test that RESOLVED the git-tag-pin mechanism and caught the external repo's stale v1.15.2 pin.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-16T12:28:21Z
- **Completed:** 2026-07-16T12:44:08Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Built `runOneAsync` (scripts/huji-run-one-async.cjs): the MCP-daemon-safe twin that awaits `execFile` (promisified) instead of the blocking sync spawn primitive, so a long-lived event loop never stalls for the 8-12 minute grading window. It reuses every Stage A/B helper from the shipped sync engine - zero re-implementation, zero new dependencies.
- Isolated the one real translation point in `runClaudeAsync`: execFile REJECTS on a non-zero exit where the sync spawn primitive RETURNS a `.status` field; the helper catches that rejection and rebuilds the exact `{status,stdout,stderr,error}` shape.
- Shipped the D14 CI-blocking parity gate (lib/memory/huji-run-one-async-parity.test.cjs): stubs a fake `claude` on PATH and proves runOne and runOneAsync return structurally identical `{ok,reason,detail}` envelopes for an injected Stage A failure AND an injected Stage B failure. Wired as a new guarded leg in run-all-229.sh (now PASS=10 FAIL=0 SKIP=0).
- Ran the pin smoke test for real: confirmed live that the external repo's documented `v1.15.2` pin does NOT carry the PWS_grading recipe (STALE), that the recipe first appears at `v1.15.3-beta.22`, and that `claude --plugin-dir <v1.15.3-beta.26 checkout>` resolves `/mos:pipeline PWS_grading` from a scratch dir outside this repo (verdict RESOLVED).

## Task Commits

Each task was committed atomically:

1. **Task 1: runOneAsync CASCADE-06 async twin** - `ee9246b1` (feat)
2. **Task 2: D14 async/sync parity gate + run-all-229 wiring** - `894229a0` (test)
3. **Task 3: live pin smoke test (RESOLVED)** - `62b6f8f8` (feat)

_Note: Task 1 carried `tdd="true"`; its behavior contract is proven by Task 2's D14 parity gate (the plan structures the failing-behavior proof as the dedicated Task 2 test), so the implementation and its gate are separate atomic commits rather than a RED/GREEN pair within one task._

## Files Created/Modified
- `scripts/huji-run-one-async.cjs` - The async twin: `runOneAsync` (mirrors runOne line for line, awaiting the async spawn) + `runClaudeAsync` (the execFile-to-status-field translation). File header carries the stability contract naming the exhaustive reason-code set.
- `lib/memory/huji-run-one-async-parity.test.cjs` - The D14 gate: file-existence + AsyncFunction assertion, caller-side audit (batch stays on sync runOne; no lib/mcp bypass), and the two-fixture parity proof.
- `scripts/huji-pin-smoketest.cjs` - Tag resolution (git show recipe check, fail-closed), local shallow clone, live capped `claude --plugin-dir` probe, and RESOLVED/UNRESOLVED classification from model output + permission_denials.
- `.planning/phases/229-huji-pitch-feedback-module/229-10-PIN-SMOKETEST.md` - The real, non-fabricated findings: RESOLVED verdict, the v1.15.2-is-stale correction note, and the pipeline tool-attempt evidence (`checkout/pipelines/PWS_grading/CHAIN.md`).
- `tests/run-all-229.sh` - Added the guarded D14 run_if leg after the D10 kill/resume leg.

## Decisions Made
- Kept `scripts/huji-run-one.cjs` and `scripts/huji-batch.cjs` byte-for-byte unmodified (verified via empty `git diff --stat`), honoring reuse-before-build and the isolation invariant that the batch loop stays on the synchronous runOne.
- Added exactly one new parameter to runOneAsync beyond runOne's: an optional `onStage(stageName)` progress callback, each call wrapped in its own try/catch so a throwing callback can never alter control flow.
- The onStage callback is forward-compatible plumbing for a future external progress-reporting caller; no MCP registration, job registry, or transport was built here (those belong to the separate mindrian-pitch-feedback-mcp repo).

## Deviations from Plan

None - plan executed exactly as written. Two implementation details were resolved during execution (see Issues Encountered); neither changed scope, added functionality, or altered the plan's contract.

## Issues Encountered
- **Fake-claude Stage A/B discrimination (Task 2):** the parity fixture first detected Stage B via a substring match on `PWS_grading`, but the Stage A intake prompt itself contains that substring (methodology text), so Stage A was misclassified and exited 0 - surfacing as `stageA_unparseable_evidence` instead of the expected `stageA_nonzero`. Root cause: substring vs exact-arg match. Fixed by matching the exact Stage B `-p` value (`/mos:pipeline PWS_grading`), which the Stage A prompt never equals. Both fixtures then passed.
- **Pin smoke-test classifier vs a turn/budget cap (Task 3):** the first live run returned an `is_error` envelope with an EMPTY `result` field (the model hit the 3-turn / $0.10 cap mid-run), so a result-only classifier reported a false UNRESOLVED. Root cause: routing evidence also lives in `permission_denials` (the command's pipeline-file tool attempts), not just `result`. Fixed by classifying over model output PLUS permission_denials; the re-run RESOLVED with self-contained evidence (attempts to Read `checkout/pipelines/PWS_grading/CHAIN.md`). This is a genuine, evidenced RESOLVED, not a forced pass.

## User Setup Required
None - no external service configuration required. (The live smoke test used the already-configured local `claude` CLI 2.1.211 and this repo's own git tags.)

## Next Phase Readiness
- The single MindrianOS-Plugin-side prerequisite for the external `mindrian-pitch-feedback-mcp` wrapper is now true and proven: an MCP-safe async engine twin exists, its failure contract is CI-gated, and the tag-pin mechanism is verified live.
- **Action for the external repo (recorded, not owned here):** re-pin from the stale `v1.15.2` to a recipe-bearing tag. No stable (non-beta) tag carries PWS_grading yet - that gap is exactly what 229-09 Task 3 (git-tag the checkout before the first 200-student batch) exists to close.
- No blockers introduced. All 229 structural legs remain green (PASS=10 FAIL=0 SKIP=0).

## Self-Check: PASSED
- Files verified present: scripts/huji-run-one-async.cjs, lib/memory/huji-run-one-async-parity.test.cjs, scripts/huji-pin-smoketest.cjs, .planning/phases/229-huji-pitch-feedback-module/229-10-PIN-SMOKETEST.md
- Commits verified in git log: ee9246b1, 894229a0, 62b6f8f8
- run-all-229.sh: PASS=10 FAIL=0 SKIP=0; shipped huji-run-one.cjs and huji-batch.cjs untouched.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
