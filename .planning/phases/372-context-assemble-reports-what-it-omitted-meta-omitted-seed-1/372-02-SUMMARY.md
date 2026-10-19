---
phase: 372
plan: "02"
subsystem: mcp tool description / tests
tags: [context-assemble, omitted, tool-description, wire-pins, tests, canon-part-8]
requires: ["372-01"]
provides:
  - "context_assemble description names _meta.omitted (one sentence, decision D3)"
  - "tests/test-372-omitted.cjs: 34 legs for SPEC requirements 1 to 7"
  - "tests/run-all-372.sh: phase aggregator"
affects:
  - lib/mcp/tools/context.cjs
  - tests/fixtures/267/wire-snapshot-zod4.json
  - tests/fixtures/267/wire-snapshot-zod3.json
key-files:
  created:
    - tests/test-372-omitted.cjs
    - tests/run-all-372.sh
  modified:
    - lib/mcp/tools/context.cjs
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/fixtures/267/wire-snapshot-zod3.json
requirements-completed: [OMIT372-01, OMIT372-02, OMIT372-03, OMIT372-04, OMIT372-05, OMIT372-06, OMIT372-07]
status: PARTIAL
completed: 2026-10-19
---

# Phase 372 Plan 02: Description sentence, wire pins, tests - Summary

STATUS: PARTIAL. All three tasks are committed. The five legs that start the MCP server (the two 267 wire tests, 270, 234, 265) did NOT run, because the repository `node_modules` folder is absent and the server would start an npm install. Those legs are UNVERIFIED. Every other leg is green.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 2 (test file) | b5ee2a46b | tests/test-372-omitted.cjs |
| 1 (description + pins) | 78f0aa353 | lib/mcp/tools/context.cjs, tests/fixtures/267/wire-snapshot-zod4.json, tests/fixtures/267/wire-snapshot-zod3.json |
| 3 (aggregator) | 7f642a42b | tests/run-all-372.sh |

Order note: Task 2 was committed before Task 1. Task 1 waited on a wire run that could not start (see Environment). Commit b5ee2a46b alone has leg R1d red, because R1d reads the new description from the working tree. HEAD has both.

## Environment (PROVEN)

- Repository `node_modules` was present and healthy at 23:15, then disappeared by 23:23 and stayed absent until the last check at about 23:47. A peer or the main session is probably mid-reinstall. package.json and npm-shrinkwrap.json carry peer edits (a `devDependencies` entry for `mindrian-design-system`).
- `lib/core/mcp-dep-heal.cjs` `ensureDepsPresent` treats a missing `node_modules` as a reason to start a detached `npm install` in the repository when the MCP server starts. The wire tests start the server. So I did not run them. This follows the limit: no `npm install`, no change to node_modules.
- `/home/jsagi/Theo/node_modules` has `ajv` but not `gray-matter`, so `navigation.cjs` still fails to load with only that path. I used the read-only plugin cache `/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.69/node_modules` (full set) for my own runs.
- `tests/run-all-372.sh` handles this: it keeps the existing NODE_PATH when `ajv/dist/2020` and `gray-matter` resolve; else it tries `$HOME/Theo/node_modules`, then each plugin cache `node_modules`, and prints one note line. Wire legs use `run_wire`: if the repository `node_modules` is missing, the leg reports FAILED with the reason and does not start the server. With `node_modules` present the same legs run normally.
- Flaky baseline seen: when navigation.cjs fails to load (ajv or gray-matter missing), the honesty scan and the 276 test show a third row, `memory_event.(default)`. With the full dependency set the rows are exactly `room_list.(default)` and `room_search.(default)`. The third row is an environment effect (the scanner cannot read the write-primitive names), not a result of this phase.

## D3: per-pin answer

Baseline measured on the repository `node_modules` while it was healthy (before the description edit):

| Pin | Baseline | Result |
|-----|----------|--------|
| 270 tool-schema budget | 50 tools, 26150 desc bytes, 33154 schema bytes, 59304 total, +0.48 percent vs AFTER 59020, 5 passed | The sentence adds 170 bytes (sentence plus one space). Expected total 59474, +0.77 percent vs AFTER, limit 10 percent, tool count unchanged. No re-baseline needed. UNVERIFIED by a post-edit run (server not startable). |
| 267 wire snapshots (zod4 and zod3) | dual-era 5 passed, zod4-contract 4 passed | Both pin the description byte for byte, so BOTH moved in this plan. See below. Wire run UNVERIFIED. |
| 276 ledger | 149 passed, 2 failed (room_list.(default), room_search.(default)) | After the edit, with full deps: 149 passed, 2 failed, same two rows. context_assemble not named. PROVEN. |
| honesty scan | 2 HIGH_RISK (room_list, room_search) | After the edit, with full deps: same 2 rows, no context_assemble line. PROVEN. |
| 234 floor | 212 passed | UNVERIFIED after the edit (needs the server). The new description is 844 bytes, ends with a period, has no dash, no newline. |
| 265 hygiene | 228 passed | UNVERIFIED after the edit (needs the server). |

Wire snapshot move. I could not start the live server, so I did not read the description from the wire. I set it from the code: a throwaway script in /tmp (not committed) registers `context.cjs` on a stub `registerTool`, reads the registered description, and writes it into `local.tools[context_assemble].description` of both snapshots (`JSON.stringify(obj, null, 2)` plus a final newline; a round trip of the unchanged files was byte identical, checked first). Before writing, I proved the method: the old snapshot description equals the registered description with the new sentence removed, for both files (so for this tool, source string equals wire string at baseline). The zod4 `refreshed_by` string got the planned suffix. `git diff --stat`: zod3 1 line, zod4 2 lines (description and refreshed_by). No other line changed. `zod4-accepted-deltas.json` untouched (no schema change).

Description change: one sentence inserted before "Never returns raw file contents.": "Every result also carries _meta.omitted, a list of what was left out and why: each entry names the leg, a reason and a count, and the count is null when it is not known." No input parameter and no inputSchema byte changed.

## Requirement-to-leg map

All legs are in `tests/test-372-omitted.cjs`. Result: 34 legs passed, 0 failed (PROVEN, run with the plugin cache NODE_PATH, branch A).

| SPEC | Legs |
|------|------|
| 1 additive omitted list | R1a (entry shape), R1b (room141 empty array), R1c (closed reason set, no depth_cap), R1d (tool seam output and description) |
| 2 existing fields stable | R2a (golden compare), R2b (key order, omitted last), R2c (prepare count), R2d (two runs equal) |
| 3 thrown leg reported | R3a legA, R3b legB, R3c filter lookup, R3d legC, R3e legD, R3f Leg E outer, R3g Leg E inner, R3h (no-throw control), R3i (no message text), R7e (catch census 10) |
| 4 type exclusion | R4a (default count 3), R4b (every topK 1 to 18), R4c (no entry for room141 and explicit focus), R4d (chain_state focus carve-out) |
| 5 cap reasons | R5a (top_k_cap at every topK, both depths, null count, tie probe), R5b (no depth text at maxDepth 1, 2, 3, 5), R5c (window_cap, both lanes), R5d (char_cap, both lanes), R5e (never a count of 0) |
| 6 estimate mode | R6a (four estimate_only entries, bodies null), R6b (default has none), R6c (parity) |
| 7 no content, no egress, cost | R7a (details are fixed labels or class names; no fixture text), R7b (require set pinned, no network text), R7c (network guard recorded zero calls), R7d (default and caps_small under 1200 ms), R7e (catch census) |

All seven report sites are forced one by one with a Proxy seam (legA, legB, filter lookup, legC, legD) or a room-map patch (Leg E outer, Leg E inner). Each yields exactly one `leg_failed` entry with the class name only (TypeError, SyntaxError for the inner parse). The secret marker in the thrown message and the bad properties text never appear in the result. No leg needed a change to room-context.cjs, so room-context.cjs was not touched in this plan.

Network guard: patches `fetch`, `http.request/get`, `https.request/get`, `net.connect/createConnection`, `dns.lookup`. It stayed installed for the whole file, including the tool seam leg (R1d). It recorded zero calls, so it was not narrowed.

## Aggregator run (`bash tests/run-all-372.sh`)

Last line: `PASS=14 FAIL=5 SKIP=0`. The 14 passes: the new test, golden compare, get-room-context, latency, Part 8 invariant, 347 focus, 347 ranked-set exclusion, 353 turn budget, legD recency golden, connector registry check, 276 failure-set leg, honesty-scan leg, dash guard, `git diff --check`. The 5 FAILED legs are exactly the wire legs; each printed "repository node_modules is missing; the server would start an npm install, so this leg did not run". They are not product failures. Re-run the aggregator once `node_modules` is back; expected `FAIL=0`.

## Baseline reds not from this phase

- `room_list.(default)` and `room_search.(default)` in the 276 ledger and the honesty scan (left for the navigator by quick 261019-ksf).
- `memory_event.(default)` appears as a third row only when navigation.cjs cannot load (missing ajv or gray-matter). Environment effect.

## Deviations from Plan

1. [Rule 3 - Blocking] Task 1 Step 4 asked for a live-wire read. The server could not start safely (see Environment), so the snapshots were set from the registered description string, with a baseline equality proof. The wire tests still owe a run. Commit order changed (Task 2 before Task 1).
2. [Rule 3 - Blocking] The prompt named `/home/jsagi/Theo/node_modules` as the fallback. It lacks `gray-matter`, so `run-all-372.sh` also tries the plugin cache directories after Theo.
3. Task 1 Step 1 and Step 6 numbers for 270, 234, 265 and the two 267 tests after the edit were not measured (server not startable). The 270 post-edit figure is computed (+170 bytes), not measured.

No fix was made to room-context.cjs. No SPEC, CONTEXT, ROADMAP, REQUIREMENTS, STATE, package.json or shrinkwrap file was touched.

## Known Stubs

None.

## Threat Flags

None. No new network surface; the new tests install a guard and prove zero calls.

## Owed to the main session

- Restore the repository `node_modules` (not done here by order), then run `bash tests/run-all-372.sh`. Expect `FAIL=0`. If `test-267-mcpv2-dual-era` or `test-267-mcpv2-zod4-contract` is red on the description line, refresh the two snapshots from the live wire as planned.
- Run `node tests/test-270-tool-schema-budget.cjs`; expect about 59474 total bytes, +0.77 percent, 5 passed.
- ROADMAP plan list for phase 372 (372-01 done, 372-02 done after the wire run). A CHANGELOG line is optional; release lockstep is untouched.
- The SessionStart envelope can adopt `OMITTED_REASONS` later (D8).

## Self-Check: PASSED (the wire legs remain UNVERIFIED, see Status)

- Files exist: tests/test-372-omitted.cjs, tests/run-all-372.sh, the two 267 snapshots, lib/mcp/tools/context.cjs (all FOUND).
- Commits b5ee2a46b, 78f0aa353, 7f642a42b: all exist; ancestry of HEAD confirmed.
