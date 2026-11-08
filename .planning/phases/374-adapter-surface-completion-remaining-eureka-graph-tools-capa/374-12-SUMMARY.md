---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 12
subsystem: mcp
tags: [eureka, top-k, paging, job-result, cache, part-8]
requires: ["374-01", "374-07", "374-11"]
provides:
  - "TOP_K_MAX = 200 in lib/mcp/eureka-pair-screen.cjs, read by the scout input schema (one constant)"
  - "pageResult, slimForCache, PAGE_LIMIT_BYTES in lib/mcp/eureka-pair-screen.cjs"
  - "optional page on eureka_capability_job_result; resultPages cache (4 entries, 30 minutes, memory only); dropCachedResult(jobId) for plan 374-13"
affects: [374-13, 374-14]
key-files:
  created:
    - tests/test-374-caps.cjs
    - tests/test-374-paging.cjs
  modified:
    - lib/mcp/eureka-pair-screen.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - lib/mcp/tools/eureka-graph-opportunity-scout.cjs
    - tests/test-374-engine-busy.cjs
    - tests/test-374-plan-gate.cjs
key-decisions:
  - "Gate lines read: ACT OD-3 TOPK-200 go, ACT OD-7 PAGE-ARG go, PLAN-GO 374-12, exit 0. Both parts ran; no part was skipped, so verify-declined was not needed. BASE = adf5939cc9831001f53b1ca7e31883ec412d7373."
  - "node_ids and max_artifacts stay 2,500 (D-06). The engine caps prepare_artifact_bundle at 2,500 and the Eureka session confirmed it."
  - "A later page (2 or more) never starts an engine read. With no live session and no cache entry it answers job_result_page_expired."
  - "The cache stores the verified answer without file text, only after the hash and lineage checks passed."
requirements-completed: [PLG374-09, ADAPT374-03]
canon_parts: [8]
---

# Phase 374 Plan 12: top_k 200 and paged job results above 256 KiB

A person can ask the pair screen and the scout for up to 200 pairs, and a job result above 256 KiB no longer reaches the model in one piece. It comes back as the verified summary plus one page of pairs; the file text stays inside the plugin.

## Gate

`node 374-gate.cjs plan 374-12` printed `ACT OD-3 TOPK-200 go`, `ACT OD-7 PAGE-ARG go`, `PLAN-GO 374-12`, exit 0. Both parts ran. verify-declined and --part-files were not needed (no part skipped).

## Engine limit lines (read only)

- `/home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/limits.py:11`: `MAX_TOP_K: Final[int] = 200`
- `limits.py:14`: `MAX_ARTIFACTS = 3000`; `limits.py:18`: `HARD_MAX_ARTIFACTS = 5000` (the plugin node cap stays 2,500).
- `hsi_engine.py:65-66`, `run/command.py:80`, `opportunity_pairs/runner.py:47-48` all check against MAX_TOP_K.

## RED output (before the code)

Task 1 (`node tests/test-374-caps.cjs`):
```
FAIL - C1 scout schema: top_k 200 accepted ... :: top_k 200 refused
FAIL - C2 pair-screen request check ...      :: Expected values to be strictly equal
ok   - C3 node caps stay 2,500 ...           (passes in RED by design: it guards what must NOT change)
test-374-caps: 1 passed, 2 failed
```
Task 2 (`node tests/test-374-paging.cjs`, jobs file unchanged; the pure `pageResult` function had been drafted in the pair-screen module but nothing called it):
```
ok   - Q1 (regression arm, passes in RED by design)
FAIL - Q2 ... :: page 1 is 952942 bytes
FAIL - Q3 ... Q4 :: Cannot read properties of undefined (reading 'total_pages')
FAIL - Q5, Q6, Q8, Q9 :: Cannot read properties of undefined (reading 'clear')   (no resultPages export yet)
FAIL - Q7 :: Cannot read properties of undefined (reading 'page')
test-374-paging: 1 passed, 8 failed
```

## GREEN output

```
ok - C1 .. C3         (3 ok)   test-374-caps: 3 passed, 0 failed
ok - Q1 .. Q9         (9 ok)   test-374-paging: 9 passed, 0 failed
bash tests/run-all-374.sh:     PASS=17 FAIL=0 SKIPPED=1   (the skip is T12, owner-run)
```
Also green: test-eureka-graph-opportunity-scout, test-341-eureka-no-brain-reach, test-387-eureka-egress, test-eureka-capability-run, test-387-eureka-engine-states, test-270 (5 passed, 0 failed).

## What changed

- `eureka-pair-screen.cjs`: `TOP_K_MAX` 100 to 200. New pure `pageResult(verified, page, opts)`: builds the summary (counts, label, manifest hash, caps_hit, warnings, host handoff, file entries with path, bytes, sha256, inline and `verified: true`, no file text) and one page of `engine_result.outputs` with the matching `id_map` rows. Page size starts at 25 and halves while any page is over 200 KiB (minimum 1); it depends on the answer only, so all calls give the same pages. A page of 0, below 1, a non-integer, or past the end gives `page_out_of_range` (fixed sentence). Generic (non pair-screen) results keep every field and page their `outputs` array; one with no outputs array is left whole. `slimForCache` drops file text and keeps outputs and id_map for the cache.
- `eureka-graph-opportunity-scout.cjs`: `top_k` max reads `TOP_K_MAX`. Description untouched.
- `eureka-capability-jobs.cjs`: `resultSchema` (job_id plus optional integer page 1 to 100000, strict) for `eureka_capability_job_result` only; status and cancel keep `jobIdSchema`. The old `jobResult` body became `fetchResult` (unchanged). New `jobResult` wraps it: an explicit page first looks in `resultPages` (owner check, 30 minute lifetime from an injectable clock `deps.now`); a page of 2 or more with no live session and no cache entry answers `job_result_page_expired` with no engine call; otherwise it fetches, verifies (shapeResult, the same check for the live and the recovery path) and `deliver` returns the answer whole if it is 256 KiB or less and no page was asked, else stores the verified answer and returns the page. `resultPages` (Map), `RESULT_PAGE_TTL_MS`, `RESULT_PAGE_MAX` (4) and `dropCachedResult(jobId)` are exported. The Map is process memory only (T-374-54).
- Tests: `test-374-caps.cjs` (C1 to C3), `test-374-paging.cjs` (Q1 to Q9). Q3 also covers a generic large result.

## Deviations from Plan

**1. [Rule 1 - pin owned by this change] `tests/test-374-plan-gate.cjs` P2 pinned `TOP_K_MAX` to 100.** Plan 374-08 left that to this plan ("plan 374-12 owns that"). Changed the one assertion to 200. The test file is outside `files_modified`; added to the commit.

**2. [Rule 1 - pin owned by this change] `tests/test-374-engine-busy.cjs` B9 pinned the test-270 budget line.** The new `page` property raises schema bytes by 55: `budget: 75 tools, 36269 desc bytes, 47586 schema bytes, 83855 total, ~20964 approx tokens (router 9 / atomic 66)` (was 47531, 83800, ~20950). Updated `BASELINE_BUDGET_LINE` only and added a comment. test-270 itself stays 5 passed, 0 failed with 75 tools. Plan 374-13 moves this line again with the description rewrite. B9's job-tool fingerprint (`util.inspect` of `_def`, depth 12) did NOT change with the new schema: it does not see zod object properties, so it does not detect this schema change. The budget line is the arm that did.

Both files are in the commit; they are outside the plan list.

## Pins: which are red and why (NOT refreshed, by design, for plan 374-13)

The reason in every case is only the two schema changes of this plan (`eureka_graph_opportunity_scout` top_k max, `eureka_capability_job_result` page):

| Pin | Result | Detail |
|-----|--------|--------|
| `node tests/test-384-s7-mcp-start.cjs parity` (384 golden) | RED, 1 line | `FAIL P1 tools/list equals the golden (... differs: eureka_capability_job_result,eureka_graph_opportunity_scout)`. Tool count and names still equal the golden. |
| `tests/test-267-mcpv2-dual-era.cjs` (267 wire snapshot) | RED, 2 arms | both eras: `tool:eureka_capability_job_result:inputSchema`, `tool:eureka_graph_opportunity_scout:inputSchema` are the only deltas. |
| test-270 | GREEN | 5 passed, 0 failed, 75 tools, total 83855 bytes (+55). |
| other 267 files | GREEN | 13 of 16 exit 0. |

Not caused here (same as plans 374-10 and 374-11): `test-267-mcpv2-cirs-gates.cjs` Check (c) (expected 35 connector descriptors, got 62) and `test-267-mcpv2-cli-probe.cjs` (exit 77). The 276 failing-line count is 5 before and 5 after. `--neighbors` was not run. No file under tests/fixtures and no test-270 constant was edited.

## Descriptions and notes for plan 374-13 (none changed here)

- `eureka_capability_job_result` description does not mention the `page` argument, the 256 KiB rule, the 30 minute page cache, or `job_result_page_expired` / `page_out_of_range`.
- The same description and the job status/cancel/start descriptions still say a job cannot resume after a restart (stale since plan 374-10).
- `eureka_graph_opportunity_scout` description does not state the top_k range; no description says 100. Say 1 to 200.
- The forget tool should call `dropCachedResult(jobId)` from `eureka-capability-jobs.cjs`.
- B9 budget line in `test-374-engine-busy.cjs` must follow the final byte total.

## Open assumption

The near-limit pair-screen result is about 0.5 MB. This is ASSUMED by the run contract and was NOT measured: no live engine ran (D-02). The tests use in-process fake results of about 950 KB (400 long-title pairs plus 300 KiB of file text) and a 60-pair result with 20 KB titles that forces the page size below 25.

## Verification (PROVEN, run in this tree)

- C1 to C3 and Q1 to Q9 pass; run-all-374 PASS=17 FAIL=0 SKIPPED=1.
- Non-ASCII byte grep over all seven edited or created code and test files: clean. This SUMMARY is plain ASCII.
- Nothing pushed, tagged, released or regenerated. STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.

## Known Stubs

None.

## Threat Flags

None. The cache holds verified text in process memory only (T-374-54), at most 4 entries for 30 minutes (T-374-55), and paged answers carry no file text (T-374-57).
