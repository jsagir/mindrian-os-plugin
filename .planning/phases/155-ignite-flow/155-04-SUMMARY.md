---
phase: "155"
plan: "04"
subsystem: "mva-option-router/birth-flow"
tags: ["mva", "option-router", "ignite-from-brief", "from-brief", "express-branch", "venture-nudge", "reward-before-investment"]
dependency_graph:
  requires: ["155-02", "155-03"]
  provides:
    - "resolveOption2 (mva-option-router.cjs) -- reads sha8 brief side-file, returns ignite_from_brief action"
    - "--express branch documented in commands/new-project.md"
    - "--from-brief <sha8> argument documented and wired"
    - "venture_classified nudge repointed from /mos:new-project to /mos:ignite"
    - "T-155-04-01 sha8 path-traversal guard"
    - "T-155-04-03 malformed brief JSON handler"
  affects:
    - "lib/core/mva-option-router.cjs"
    - "lib/core/venture-shape-nudge.cjs"
    - "scripts/room-auto-create-nudge.cjs"
    - "commands/new-project.md"
    - "tests/run-all-155.sh"
tech_stack:
  added: []
  patterns: ["TDD RED/GREEN", "hermetic HOME fixture", "sha8 path-traversal validation", "module-cache invalidation for hermetic testing"]
key_files:
  created:
    - "tests/test-mva-from-brief.cjs"
  modified:
    - "lib/core/mva-option-router.cjs"
    - "lib/core/venture-shape-nudge.cjs"
    - "scripts/room-auto-create-nudge.cjs"
    - "commands/new-project.md"
    - "tests/run-all-155.sh"
decisions:
  - "STUB_MESSAGE_119 kept as null const + comment (historic reference) rather than deleted -- grep can confirm stub is replaced, not silently removed"
  - "resolveOption2 exported as a separate function (not inlined into routeOption) to enable hermetic testing with module cache invalidation"
  - "brief_reward_pending: true when no mva_brief_shown/mva_brief_rendered in telemetry JSONL -- trusts absence as signal (fresh install or cold start)"
  - "SHA8_RE = /^[0-9a-f]{8}$/ blocks path traversal (T-155-04-01) AND oversized inputs (> 8 chars)"
  - "setTimeout removed from test fixture -- second brief written synchronously to avoid race with resolveOption2 auto-discovery"
  - "venture-shape-nudge.cjs doc comment repointed (comment only); room-auto-create-nudge.cjs verb array repointed (live code)"
metrics:
  duration: "~17 minutes"
  completed: "2026-06-12"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 6
requirements: ["GAP-4"]
---

# Phase 155 Plan 04: MVA Option 2 Unstub (ignite_from_brief) Summary

**One-liner:** STUB_MESSAGE_119 replaced with a real resolveOption2() handler that reads ~/.mindrian/mva/briefs/<sha8>.json and returns {action:'ignite_from_brief', brief_content, invoke_command:'/mos:ignite --from-brief <sha8>', brief_reward_pending} per reward-before-investment Decision 8; --express and --from-brief branches documented in new-project.md; venture_classified nudge repointed to /mos:ignite.

## Tasks Completed

### Task 1: Unstub MVA option 2 + --express branch + nudge repoint (TDD RED+GREEN)

| Phase | Commit | Result |
|-------|--------|--------|
| RED | b39f8ef5 | 1/21 PASS (expected -- resolveOption2 not yet exported) |
| GREEN | 89157192 | 21/21 PASS |

## What Was Built

### resolveOption2() -- the unstub (GAP-4)

`lib/core/mva-option-router.cjs` now exports `resolveOption2(sha8Input)`:

1. Resolves sha8: uses provided arg or falls back to `resolveCurrentSha8()` (reads state.json)
2. Validates sha8 against `/^[0-9a-f]{8}$/` -- T-155-04-01 path-traversal guard
3. Reads `~/.mindrian/mva/briefs/<sha8>.json`
4. On missing file: returns `{action:'no_brief_available', message:'No MVA brief found. Run /mos:mva-brief first...'}`
5. On malformed JSON: returns `{action:'brief_parse_error', sha8, message}` -- T-155-04-03
6. On success: checks telemetry JSONL for `mva_brief_shown`/`mva_brief_rendered` event (reward-before-investment guard)
7. Returns `{action:'ignite_from_brief', sha8, brief_content, canon_verb:8, invoke_command:'/mos:ignite --from-brief '+sha8, brief_reward_pending: boolean}`

`OPTION_BEHAVIOR[2]` updated: action now `'ignite_from_brief'`, narrative is the loading message. `STUB_MESSAGE_119` const is `null` (kept as a historic reference comment, not the returned narrative).

### --express and --from-brief branches in new-project.md

Added an "Argument Handling" section above Step 1:

- `--express`: skips Steps 2-3 (deep exploration), uses current session context as blueprint input, jumps to B2. Reward-before-investment invariant preserved (instant brief rendered if no reward yet).
- `--from-brief <sha8>`: reads the Phase 118 brief side-file via `resolveOption2(sha8)`. Handles all three result actions (ignite_from_brief / no_brief_available / brief_parse_error). Renders instant brief before B2 when `brief_reward_pending:true`.

Both paths preserve the B2 gate (no approval gate is skipped).

### venture_classified nudge repoint

- `lib/core/venture-shape-nudge.cjs`: doc comment line 12 updated from `[/mos:new-project]` to `[/mos:ignite]` with repoint comment.
- `scripts/room-auto-create-nudge.cjs`: the actual verb in the `pickShape` call changed from `'/mos:new-project'` to `'/mos:ignite'`. The doc comment in the file header is also updated.

### run-all-155.sh extended to Wave 3

Added `test-mva-from-brief.cjs` to the suite (now 5 suites: Wave 1 + Wave 2 + Wave 3).

## Verification Gates (all GREEN)

| Gate | Result |
|------|--------|
| node tests/test-mva-from-brief.cjs | 21/21 PASS |
| bash tests/run-all-155.sh | 5/5 PASS (Wave 1+2+3) |
| bash tests/run-all-148.sh | 18/18 PASS |
| bash tests/run-all-150.5.sh | 7/7 PASS |
| bash tests/run-all-150.8.sh | GREEN |
| bash tests/test-no-bespoke-brain-prompts.sh | PASS |
| grep -c 'ignite_from_brief' lib/core/mva-option-router.cjs | 8 (>= 1) |
| grep -c 'express' commands/new-project.md | 4 (>= 1) |
| grep -c '/mos:ignite' lib/core/venture-shape-nudge.cjs | 2 (>= 1) |
| OPTION_BEHAVIOR[2].action | 'ignite_from_brief' (not 'phase_119_stub') |
| STUB_MESSAGE_119 export | null (not the narrative) |

## Deviations from Plan

### Minor deviation: STUB_MESSAGE_119 appears 6 times not 0 or 1

The plan verification check says "returns 0 if fully replaced (or 1 if kept as a comment label only)". The file has 6 occurrences because STUB_MESSAGE_119 appears in: the const declaration, 3 comment references explaining the historic label, the docstring header, and the module.exports. The critical invariant holds: STUB_MESSAGE_119 is null (not the narrative), and OPTION_BEHAVIOR[2].action is 'ignite_from_brief'. This is correct behavior -- the plan explicitly permits keeping the stub as a "code comment or be removed; it must NOT be the returned narrative."

### Minor fix: test setTimeout removed (race condition)

The RED test used `setTimeout(10ms)` to write the second brief, intending to simulate a later mtime. But `resolveOption2(null)` ran before the timeout fired, causing the auto-discovery tests (5 and 6) to fail with 'no_brief_available'. Fixed by writing the second brief synchronously. Auto-discovery via state.json `current_sha8` works correctly -- no ordering dependency on file mtime.

## Known Stubs

None -- all three plan truths are satisfied:
1. `ignite_from_brief` action returned with sha8 brief content
2. `--express` branch documented and `--from-brief` wired in new-project.md
3. `venture_classified` nudge repointed to `/mos:ignite`

The `/mos:ignite` command itself (Plan 05-06) reads `brief_reward_pending` and `invoke_command` from the result. Those plans own the actual invocation surface.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The sha8 path-traversal guard (T-155-04-01) is implemented as a regex validation before any filesystem access. Brief content (T-155-04-02) stays LOCAL -- `resolveOption2` returns the parsed JSON to the caller; the caller (new-project.md / /mos:ignite) feeds it to B2 (local gate), never to Brain. Malformed JSON (T-155-04-03) is caught in try/catch and returns a user-facing error action, never unhandled exception.

## Self-Check: PASSED

Files exist:
- lib/core/mva-option-router.cjs: FOUND (resolveOption2 exported, OPTION_BEHAVIOR[2].action='ignite_from_brief')
- commands/new-project.md: FOUND ('express' count=4)
- tests/test-mva-from-brief.cjs: FOUND
- lib/core/venture-shape-nudge.cjs: FOUND ('/mos:ignite' count=2)
- scripts/room-auto-create-nudge.cjs: FOUND ('/mos:ignite' in verb array)
- tests/run-all-155.sh: FOUND (5 suites)

Commits exist:
- b39f8ef5 (test RED): confirmed in git log
- 89157192 (feat GREEN): confirmed in git log
