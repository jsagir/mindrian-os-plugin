---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 09
subsystem: mcp
tags: [mcp, prompts, resources, rca, registerPrompt, registerResource]

requires:
  - phase: 267-08
    provides: "all lib/mcp/tools registrars on registerTool; registration-api --file gate"
provides:
  - "bind-room, status and act prompts working (title, description, correct args, prompts/get succeeds); RCA 4 resolved"
  - "lib/mcp/prompts.cjs fully on registerPrompt (9) and lib/mcp/resources.cjs fully on registerResource (9)"
  - "tests/test-267-mcpv2-prompts.cjs (26 checks)"
affects: [267-10, 267-11]

key-files:
  created:
    - tests/test-267-mcpv2-prompts.cjs
  modified:
    - lib/mcp/prompts.cjs
    - lib/mcp/resources.cjs
    - tests/fixtures/267/zod4-accepted-deltas.json
    - tests/test-267-mcpv2-zod4-contract.cjs
    - .planning/debug/knowledge-base.md
    - .planning/debug/resolved/runtime-loop-prompts-bogus-args-schema.md

key-decisions:
  - "zod4 contract Check (a) exempts exactly the diffs listed in prompts_fix (3 description diffs, undefined to real string); every other description diff still fails it."
  - "Resources: pure rename, no titles, ResourceTemplate require untouched (267-11)."

requirements-completed: [MCPV2-16, MCPV2-02, MCPV2-08, MCPV2-15]

completed: 2026-10-02
---

# Phase 267 Plan 09: Runtime-loop prompts fix and last registrar rewrites Summary

**The three dead runtime-loop prompts (bind-room, status, act) now work (RCA 4 fixed test-first), and the last 3 prompt and 9 resource variadic registrations are on registerPrompt / registerResource; zero `server.tool|prompt|resource(` remain under lib/mcp/ and bin/.**

`PLAN_BASE=298074aa24f3ac2b9bd1f7dbf52016c4bf6f986b`

## Commits

| Commit | What |
|---|---|
| `5e0326d6a` | test: prompts wire test, RED (PASS=10 FAIL=16, every failure on bind-room/status/act) |
| `c96740544` | fix: 3 prompts to registerPrompt with title/description (+ argsSchema goal on act); prompts_fix ledger; zod4 Check (a) exemption |
| `21ea8d131` | refactor: 9 server.resource to server.registerResource, identical args and order |
| `d695bde8d` | docs: RCA 4 resolved (moved to resolved/), knowledge-base block |

RED commit precedes the fix commit.

## Verification output

RED (pre-fix): `PASS=10 FAIL=16`, e.g. `FAIL: prompts/get succeeds for bind-room -- {"code":-32603,"message":"keyValidator._parse is not a function"}` and `FAIL: no prompt advertises arguments named description or arguments -- bind-room.description, bind-room.arguments, ...`.

GREEN (post-fix), all runs with isolated `HOME` and `MINDRIAN_ROOMS_HOME`:

```
node tests/test-267-mcpv2-prompts.cjs                    PASS=26 FAIL=0
node tests/test-267-mcpv2-registration-api.cjs --file lib/mcp/prompts.cjs     PASS=9 FAIL=0
node tests/test-267-mcpv2-registration-api.cjs --file lib/mcp/resources.cjs   PASS=9 FAIL=0
node tests/test-354-room-symlink-containment.cjs         PASS - 10 checks
grep -c "server\.prompt(" lib/mcp/prompts.cjs            0
grep -c "server\.registerPrompt(" lib/mcp/prompts.cjs    9
grep -c "arguments: \[" lib/mcp/prompts.cjs              0
grep -c "server\.registerResource(" lib/mcp/resources.cjs 9
grep -rnE "server\.(tool|prompt|resource)\(" lib/mcp/ bin/ | wc -l   0
```

Resources wire: live `resources/list` (10) and `resources/templates/list` (3) equal both `wire-snapshot-zod3.json` and `wire-snapshot-zod4.json` (`resources eq true`, `templates eq true`).

zod4 contract after the fix:
```
PASS Check (a) (zero description diffs)
FAIL Check (b) -- extras=["tool:research_run:membership"] missing=[]     (pre-existing, identical to 267-08 baseline; no prompt entry)
PASS Check (c)
FAIL Check (d) -- scripts/fork359-permission-probe.cjs                  (pre-existing)
```
cirs-gates: `RESULT: PASS=2 FAIL=1` (Check (c) 31 vs 32, pre-existing).

## Deviations from Plan

**1. [Rule 3 - Blocking] zod4 contract Check (a) edited.** The plan only says to fill `prompts_fix`, which the contract test honors in Check (b) alone. Check (a) ("zero description diffs") reads unfiltered diffs, so the three prompts gaining a real description (undefined in the zod3 snapshot) would have newly failed it. Check (a) now exempts only the keys present in `prompts_fix`. `tests/test-267-mcpv2-zod4-contract.cjs` was not in the plan's files_modified list. `prompts_fix` carries 6 entries (3 prompts x description and arguments).

**2. Plan truth "registration-api full mode passes" NOT met; not fixable inside this plan's scope.** Full mode (`node tests/test-267-mcpv2-registration-api.cjs`, no `--file`) is still RED for exactly two reasons, neither in this plan's files: (a) `lib/mcp/app-views.cjs` (3 sites, `inputSchema` not a zod object, owned by 267-10, whose files_modified includes app-views.cjs and RCA 2); (b) `live tools/list count (45) != wire-snapshot-zod4.json local.tools count (44)`, the +1 being `research_run` (Phase 363-17), which needs a snapshot refresh (267-11 lists the zod4 snapshot among its files). All 9 prompts.cjs and 9 resources.cjs lines pass. The plan's "first time it is green in this phase" claim therefore belongs to a later plan. The zero-variadic grep (all 51 sites in the plan's accounting) IS met.

No other deviations.

## Aggregators

- `bash tests/run-all-198.sh`: `Passed: 13 Failed: 3`, the same three legs as 267-BASELINE.md and 267-08 (Part 8 local-only floor, SPEC-2, SPEC-5).
- `bash tests/run-all-267.sh`: `PASS=21 FAIL=5 SKIP=7`, not the plan's `FAIL=0`. The five: cirs-gates (c) 31 vs 32, zod4 (b)(d), registration-api full mode (deviation 2): all carried baselines named in the session brief. The two others, not from this plan:
  - `brain shim canary (MCPV2-11)`: one check, `process hygiene: no spawned mindrian-brain-mcp-client.cjs process survives this test`. `pgrep` shows live brain-shim processes belonging to peer sessions (two from `/home/jsagi/dev/MindrianOS-Plugin/bin/`, several from the installed plugin cache), so the "no survivor" check sees them. Environmental; neither bin/ file nor the shim was touched.
  - `regression: 354 concurrency surfaces`: `K4 setup or execution threw` under an empty `HOME`; 267-08 recorded the same test passes with the real HOME and failing under a fresh empty one (a HOME artifact). Not rerun against the real HOME here, per test hygiene instructions.
- The runtime-loop prompts leg (MCPV2-16) is PASSED; the 6 later-plan legs SKIP as designed.

## Known Stubs

None.

## Threat Flags

None. Handler and resource callback bodies are byte-untouched, so T-267-24 (Phase 354-05 realpath containment) is unchanged and `test-354-room-symlink-containment` is green at the resources commit. T-267-25: act's `goal` is validated as a string by zod and only echoed into a message; no write path. T-267-21: cirs gate Check (a) and (b) stay green.

## Peer-tree note

HEAD advanced by peer commits (366-09, 366-15) between my commits; I staged and committed only my own paths with `--only`. Untracked peer files (`.planning/debug/desktop-session-binding-fallback.md`, `.planning/debug/test-birth-registry-leak.md`) were left alone.

## Self-Check: PASSED

All four commit shas (5e0326d6a, c96740544, 21ea8d131, d695bde8d) resolve on main; `tests/test-267-mcpv2-prompts.cjs` exists; `.planning/debug/resolved/runtime-loop-prompts-bogus-args-schema.md` exists with `status: resolved` and the original path is gone.
