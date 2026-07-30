---
phase: quick-260730-mps
plan: 01
subsystem: mcp
tags: [mcp, prompts, zod, sdk, regression-test, desktop, cowork]
requires:
  - "@modelcontextprotocol/sdk@1.29.0 (already installed, vendored)"
  - "zod@3.25.76 (already installed)"
provides:
  - "All 6 MCP methodology prompts working on Desktop and Cowork"
  - "tests/mcp-prompts-argsschema.test.cjs as a durable regression + sweep gate"
affects:
  - "lib/mcp/prompts.cjs"
tech-stack:
  added: []
  patterns:
    - "server.registerPrompt(name, {title, description, argsSchema}, cb) with zod raw shapes"
    - "argsSchema OMITTED (not {}) for argument-less prompts"
    - "Real McpServer + real Client over InMemoryTransport in tests, never a hand-rolled stub"
key-files:
  created:
    - "tests/mcp-prompts-argsschema.test.cjs"
  modified:
    - "lib/mcp/prompts.cjs"
decisions:
  - "Rule B held: depth and methodology stay free z.string(), NOT z.enum. Tightening would turn today's graceful fallbacks into hard InvalidParams rejections, a behavior change this fix was not authorized to make."
  - "Rule S held: suggest-next omits argsSchema entirely rather than passing {}. Proven live in the RED run, which returned -32602 on that exact call."
  - "T-MPS-03 (reason-section path traversal) left untouched and flagged for a follow-up /gsd-debug rather than silently fixed inside this plan."
metrics:
  duration: "~25 min"
  completed: 2026-07-30
  tasks: 3
  files: 2
  tests: "42 assertions PASS, 0 FAIL"
---

# Quick Task 260730-mps: Fix MCP Prompts argsSchema Crash Summary

All 6 MCP methodology prompts were dead on Desktop and Cowork because they were
registered through the legacy `McpServer#prompt()` positional overload with an
old-style `{description, arguments:[...]}` object where SDK 1.29.0 wanted a zod
raw shape; converted to `registerPrompt` with real zod shapes and locked it
behind a mutation-proven regression gate.

## What Was Actually Broken

`McpServer#prompt(name, ...rest)` (mcp.js:709-722) shifts `rest[0]` off as the
description ONLY when it is `typeof === 'string'`. All 6 call sites passed an
OBJECT, so `description` stayed `undefined` and the whole
`{description, arguments:[...]}` object fell through into the `argsSchema` slot.

`_createRegisteredPrompt` then ran that object through `objectFromShape`
(zod-compat.js:49). Its values are a string and an array, not zod schemas, so
`objectFromShape` happily built `z3rt.object({description, arguments})`. A
ZodObject built over non-schema values does not fail at construction time; it
fails at PARSE time inside `ZodObject._parse`, when it calls `keyValidator._parse`
on a plain string. That is exactly why registration succeeded silently and the
FIRST `prompts/get` was what died.

Three symptoms, one root cause, all three now closed:

1. Every `prompts/get` threw `keyValidator._parse is not a function`, surfacing
   to the client as MCP error -32603. Total outage of the prompts surface.
2. `prompt.description` was `undefined` on all 6, so `prompts/list` showed no
   description for any of them.
3. `prompts/list` advertised two fabricated REQUIRED arguments literally named
   `description` and `arguments` on every prompt.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Write the acceptance test RED-first and prove it reproduces the production crash | `bfcd7998` |
| 2 | Convert all 6 registrations to registerPrompt with zod raw shapes | `7eb6dce1` |
| 3 | Mutation-prove the gate, sweep the repo, and commit | (no net file change; proof recorded below) |

Task 2 and Task 3 share commit `7eb6dce1`: Task 3's mutation was applied and
reverted in the working tree before the commit (md5 verified identical to the
pre-mutation fixed file), so there was no second net change to commit. The
`test(...)` RED gate and the `fix(...)` GREEN gate are separate commits in the
correct order.

## The RED Run (verbatim, against the unfixed code)

`node tests/mcp-prompts-argsschema.test.cjs` exited 1 with **Passed: 9, Failed: 28**.

Scenario A, the exact `prompts/get` parse call (mcp.js:432-433), on 5 of 6:

```
  FAIL A/file-meeting
    TypeError: keyValidator._parse is not a function
    at ZodObject._parse (node_modules/zod/v3/types.cjs:1983:37)
    at ZodObject.safeParseAsync (node_modules/zod/v3/types.cjs:198:39)
    at safeParseAsync (node_modules/@modelcontextprotocol/sdk/dist/cjs/server/zod-compat.js:79:35)
```

Identical for `analyze-room`, `grade-venture`, `run-methodology`, `reason-section`.

The bogus argument keys, caught on `suggest-next` in Scenario A:

```
  FAIL A/suggest-next
    AssertionError: suggest-next must have NO argsSchema (Rule S),
      found: ["description","arguments"]
```

Scenario C, the missing descriptions, on all 6:

```
  FAIL C/file-meeting description
    AssertionError: description must be a string, got undefined (undefined)
  FAIL C/file-meeting arg shape
    AssertionError: declared arg keys are the FABRICATED pair from the legacy
      overload, not real argument names
```

Scenario D, the real `Client` <-> real `McpServer` round-trip, which is the
production error verbatim:

```
  FAIL D/get grade-venture (argsSchema branch, arguments:{})
    McpError: MCP error -32603: keyValidator._parse is not a function
  FAIL D/get reason-section (argsSchema branch, required arg)
    McpError: MCP error -32603: keyValidator._parse is not a function
  FAIL D/get suggest-next (no-argsSchema cb(extra) branch, arguments omitted)
    McpError: MCP error -32602: Invalid arguments for prompt suggest-next:
      [{ "code": "invalid_type", "expected": "object", "received": "undefined",
         "path": [], "message": "Required" }]
```

That last one is worth naming: it is **Rule S proven live, not argued**. Passing
an empty `arguments: []` (which `objectFromShape` turned into a parseable object)
made an argument-less `suggest-next` call fail with InvalidParams, because
`GetPromptRequestSchema` does not default `params.arguments`. This is precisely
why the fix OMITS `argsSchema` on `suggest-next` rather than passing `{}`, which
would have reproduced the same -32602 on the "fixed" code.

Scenario E, the sweep gate:

```
  FAIL E/sweep
    Error: 6 legacy-overload call site(s) still in tracked source:
      lib/mcp/prompts.cjs:100 / :153 / :180 / :213 / :243 / :268
```

## The GREEN Run (after the fix, zero edits to the test file)

`node tests/mcp-prompts-argsschema.test.cjs` exits 0 with **Passed: 42, Failed: 0**.
Every scenario PASS, including the three real `prompts/get` round-trips and the
sweep gate at 0 hits.

## Mutation Proof (both directions, observed)

A gate that has never been seen failing is not a gate. One registration
(`analyze-room`) was temporarily reverted to the old
`server.prompt(name, {description, arguments:[...]}, cb)` shape:

| Direction | Result |
|-----------|--------|
| Mutant applied | exit **1**, Passed 35 / Failed 6. `keyValidator._parse is not a function` present. Failures: `A/analyze-room`, `B/analyze-room`, `C/analyze-room description`, `C/analyze-room arg shape`, `D/prompts-list`, and `E/sweep` (which named the reintroduced site `lib/mcp/prompts.cjs:155`). |
| Restored | exit **0**, Passed 42 / Failed 0. `md5sum` of the restored file matched the pre-mutation fixed file byte-for-byte (`08228565ce873c83e4da587304825a05`). |

Four independent scenarios went red on a single-registration regression, and the
sweep gate pointed at the exact line. The gate has teeth.

## Sweep Result (proven, not asserted)

| Sweep | Scope | Hits |
|-------|-------|------|
| Legacy overload call sites | all tracked `*.cjs` `*.js` `*.mjs`, comment-only hits filtered | **0** |
| `arguments: [` old-shape arrays | `lib/**/*.cjs`, `bin/**/*.cjs`, comment-only hits filtered | 13, **all unrelated** |

The 13 `arguments: [` hits are all in `lib/memory/*.test.cjs` and are MINTO
reasoning-block fixtures (the `arguments` field of a reasoning object, e.g.
`reasoning: { exists: false, governing_thought: null, ..., arguments: [] }`), not
MCP prompt registrations. No additional old-shape prompt site exists anywhere.

Read-only spot check confirmed the tool callers are correct and were left
untouched: `bin/mindrian-brain-mcp-client.cjs:72` (`brain_ask`, plus 5 more) and
`bin/mindrian-mcp-server.cjs:146` (`detect_dual_path`, plus more) all pass a
description STRING in position 2, which is the shape the legacy `tool()` overload
actually expects. Zero edits made to either file.

## Conversion Applied

| # | name | title | argsSchema |
|---|------|-------|------------|
| 1 | `file-meeting` | File Meeting | `transcript` (required), `meetingDate` (optional) |
| 2 | `analyze-room` | Analyze Room | `focus` (optional) |
| 3 | `grade-venture` | Grade Venture | `depth` (optional) |
| 4 | `run-methodology` | Run Methodology | `methodology` (required), `focus` (optional) |
| 5 | `suggest-next` | Suggest Next | **omitted entirely** (Rule S) |
| 6 | `reason-section` | Reason Section | `section` (required) |

Rules honored: **B** (no enum tightening on `depth` or `methodology`, so today's
graceful fallbacks survive), **O** (`.optional()` before `.describe()`), **C**
(every callback body byte-for-byte unchanged, verified in `git diff`), **Z** (zod
require added, zero package-manager operations), **E** (no em-dashes on any added
line, verified against the diff). `run-methodology`'s framework list stays a
template literal over `METHODOLOGY_NAMES`, so the 25 names stay live rather than
frozen into a string.

## NOT LIVE FOR ANY USER YET (including this session)

**This fix is committed on `main`. It is NOT live for anyone.** Per this repo's
standing rule (`feedback_dev_repo_fix_not_live_until_released.md`, proven by four
independent occurrences in
`.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`, still
open):

- A commit on `main` is not live until `scripts/release.sh <version>` ships a
  release AND that release is actually picked up by a fresh install.
- **A running session never hot-reloads the plugin cache.** That includes this
  session's own MCP server process, which is still running the broken
  `server.prompt()` code loaded at process start. Restarting the MCP server
  against this checkout would pick it up; nothing short of that will.
- Desktop and Cowork users will keep hitting -32603 on every prompt until they
  run `/plugin marketplace update` and
  `claude plugin update mos@mindrian-marketplace` against a release that contains
  commit `7eb6dce1`.

Per the plan's scope guard, this task deliberately did NOT run
`scripts/release.sh`, did NOT bump any version, and did NOT touch `CHANGELOG.md`,
`.claude-plugin/plugin.json`, or `package.json`. Verified with
`git diff bfcd7998~1 7eb6dce1 --name-only`: the two commits touch exactly two
files (`lib/mcp/prompts.cjs`, `tests/mcp-prompts-argsschema.test.cjs`).
The release is the user's separate explicit step.

## Deviations from Plan

None. The plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed
and no Rule 4 architectural question arose.

## Deferred Items

- **T-MPS-03 (accepted, pre-existing, unchanged):** `reason-section` joins a
  client-supplied `section` straight onto `roomDir`
  (`path.join(roomDir, args.section)`), so a traversal-shaped value (`../..`)
  would read `.md` files outside the room. This predates the fix and Rule C
  forbade touching callback bodies here, so the scope is unchanged rather than
  widened. Flagged for a follow-up `/gsd-debug`; deliberately NOT silently fixed
  inside this plan.
- **Unrelated dirty working tree (not touched, not mine):** seven files carrying
  uncommitted statusline / context-monitor work dated 2026-07-29 18:25 were
  already modified in the working tree when this task started
  (`lib/statusline/ctx-window.cjs`, `scripts/context-monitor`,
  `scripts/statusline-fallback-echo.cjs`, `package-lock.json`, and three
  statusline tests). They belong to a different session's in-flight work. Files
  were staged individually so none of them entered either commit; verified via
  `git diff bfcd7998~1 7eb6dce1 --name-only`, which lists exactly the two
  intended files.
- **Concurrent session activity observed (no conflict, no action needed):** while
  this task was finishing, another session committed Phase 240 planning docs
  (`7fd2a42a`, `05c6714a`) on top of this work. Both of this task's commits remain
  ancestors of `HEAD` (verified with `git merge-base --is-ancestor`), the
  committed `lib/mcp/prompts.cjs` still shows 6 `registerPrompt` sites and the zod
  require, and the test still exits 0. This repo has a documented history of
  concurrent-session collisions, so it is recorded here rather than assumed benign.

## Verification

```
node --check lib/mcp/prompts.cjs                      OK
node tests/mcp-prompts-argsschema.test.cjs            exit 0, Passed 42 Failed 0
git grep -n "<legacy overload>" -- '*.cjs' '*.js' '*.mjs'   0 hits
grep -c "server.registerPrompt(" lib/mcp/prompts.cjs  6
node -e "require('./lib/mcp/prompts.cjs')"            module still loads
git diff bfcd7998~1 7eb6dce1 --name-only              exactly the 2 intended files
```

Canon gates: no em-dashes on any added line; no Brain egress touched (Part 8 not
in scope, prompts are local-only); pre-commit chain ran intact on both commits
(`COMMIT_NO_VERIFY` never set). Tri-polar impact is Desktop plus Cowork, the two
surfaces that consume MCP prompts; CLI unaffected.

## Self-Check: PASSED

- FOUND: `lib/mcp/prompts.cjs`
- FOUND: `tests/mcp-prompts-argsschema.test.cjs` (449 lines)
- FOUND commit: `bfcd7998` (test, RED gate)
- FOUND commit: `7eb6dce1` (fix, GREEN gate)

## TDD Gate Compliance

RED gate `bfcd7998` (`test(...)`) precedes GREEN gate `7eb6dce1` (`fix(...)`) in
git log. No REFACTOR commit was needed. The RED gate was observed failing for the
real defect (`keyValidator._parse is not a function`), not a harness error, before
any implementation existed.
