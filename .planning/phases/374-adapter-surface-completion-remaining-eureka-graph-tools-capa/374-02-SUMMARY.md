---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 02
subsystem: testing
tags: [eureka, fake-engine, pair-screen, fixture, mcp]
requires: []
provides:
  - fake engine with the pair-screen plan, start and delete routes, file-backed jobs and receipts, and a restart switch
  - self-test arms F7 to F11 (F11 checks the fake shapes against the engine JSON schemas, read only)
affects: [374-08, 374-10, 374-11, 374-13]
tech-stack:
  added: []
  patterns: [file-backed fixture state shared by two fake processes, control files read at call time]
key-files:
  created: []
  modified:
    - tests/fixtures/eureka-fake-engine-387/fake-uv.cjs
    - tests/test-387-eureka-fake-engine.cjs
decisions:
  - "The fake keeps one live receipt for one plan digest: a second plan of the same request refreshes the receipt. The real engine inserts one receipt for each plan call. The fake is stricter on purpose (one plan, one start)."
  - "The fake has no plan_expired refusal. The real gate has it. A later plan that needs it adds a control file."
  - "scout_status and scout_result use the job file only for job ids that start with fake-ps-. Every other job id keeps the old fixed answer, so the 7 old tools stay byte-compatible."
metrics:
  tasks: 2
  files: 3
requirements: [PLG374-01]
canon_parts: [8]
---

# Phase 374 Plan 02: Fake engine with the pair-screen routes Summary

The fake engine now serves the pair-screen plan, start and delete tools, keeps jobs and plan receipts in files so a second fake process in the same folder sees them, and has a restart switch. Later gated plans test plan, gate, start, recovery, the busy guard and forget against it with no live engine.

## RED output (before the fake was edited)

The self-test arms F1, F2 and F7 to F11 were written first. Output of `node tests/test-387-eureka-fake-engine.cjs`, shortened to the status lines:

```
FAIL - F1 the fake serves the 10 tools
FAIL - F2 scout_capabilities returns the 4 catalog entries
ok - F3 ... F6 (unchanged)
FAIL - F7 the pair-screen plan route        (Tool scout_plan_pair_screen not found)
FAIL - F8 the pair-screen start route       (arm did not complete)
FAIL - F9 jobs across processes             (arm did not complete)
FAIL - F10 the observed rows keep the key set and a digest, no string value
FAIL - F11 the fake shapes validate against the engine schemas
test-387-eureka-fake-engine: 4 passed, 7 failed
```

A first draft of the arms let F8 and F9 pass without being run, because an exception skipped them. The catch block now fails F8 and F9 too. The RED run above is from the fixed arms.

## GREEN output (after the fake was edited)

```
ok - F1 the fake serves the 10 tools through the real StdioClientTransport
ok - F2 scout_capabilities returns 4 experimental entries on their routes
ok - F3 observed.jsonl records argv, working folder, sorted env keys and the 3 offline values
ok - F4 sync creates .venv/pyvenv.cfg and the marker folders for the --extra names, exit 0
ok - F5 the doctor entry prints a doctor-shaped JSON with one failing check, exit 1
ok - F6 the fake writes only in its working folder; no network require, no fetch call
ok - F7 the plan gives a ready plan, a closed key set, a blocked plan from the control file, and ignores the approval block
ok - F8 the start gives approval_missing, plan_unknown, plan_mismatch, one job, plan_consumed and an idempotent retry
ok - F9 jobs live in files: 2 processes share the walk, the restart switch, the result shape and the delete
ok - F10 pair-screen rows hold the key set and a digest and no string value; the folder holds only the fake files
ok - F11 the fake request examples and the fake result validate against the engine pair-screen schemas

test-387-eureka-fake-engine: 11 passed, 0 failed
```

F11 ran (it did not skip). It used ajv 8.18.0 (`ajv/dist/2020`, because the schema names draft 2020-12) from the repo node_modules, and read the two schemas from `/home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/data/schemas/` read only. When the Eureka tree or ajv is absent, F11 prints `skip - F11 <reason>` and does not count.

## The three tools

- `scout_plan_pair_screen {request}`: ready plan, blocked plan, or refusal. It starts nothing.
- `scout_start_pair_screen {request, idempotency_key?}`: starts a job after the receipt checks, or refuses.
- `scout_delete_job {job_id}`: answers `{job_id, deleted}`. Deleted is true only for a known `fake-ps-` job.

Catalog entry 4: `opportunity.run_pair_screen`, status experimental, `routes.mcp.tool = scout_start_pair_screen`, `routes.mcp.plan_tool = scout_plan_pair_screen`.

Existing tools `scout_status` and `scout_result` also read the job file, but only for job ids that start with `fake-ps-`. A missing pair job answers an error result with the text `job not found`.

## Files in the working folder (later plans read this list)

State files, written by the fake:
- `observed.jsonl`: one row for each start and each tool call (as before).
- `jobs.json`: `{next, jobs{}}`. A job row holds job_id, state, step, scope ids, plan digest, approval_ref, artifact count and the id, source_ref and title of the first 3 artifacts. It holds no text.
- `receipts.json`: `{receipts[]}`. A receipt holds digest, used, job_id, approval_ref, idempotency_key, scope ids and expires_at (24 hours).

Control files, written by a test, all optional, read at call time:
- `plan-mode.json`: `{mode: "blocked"|"refused", reason}`. Forces the plan answer. A blocked plan records no receipt. A request with a bad key set is still refused as bad_request first.
- `job-script.json`: `{statuses: [...]}`. Each `scout_status` call on a job that is not final moves one step. The last entry stays. Without the file the script is `["completed"]`. A start answers `queued`. `scout_result` does not move the walk: it returns the full result when the last seen state is completed, otherwise the current state.
- `restart.json`: any JSON. While it exists, the next `scout_status` or `scout_result` call on a job that is not final (the last seen state is not completed, completed_empty, failed or cancelled) answers `failed`, `progress: "interrupted"`, `failure_code: "server_restarted"` and keeps that state in `jobs.json`. A job that is already final does not change. The test removes the file when the simulated restart is over.
- `watch.json` and `expected-lineage.json`: unchanged from before.

Engine rules that the fake follows: the request key set is closed (top level and artifact); the digest is the sha256 of the canonical JSON (keys sorted) of the request without `approval`; the fake computes its own digest and the plugin must never recompute it; a start needs a live, unused receipt whose digest equals the request digest (`approval_missing`, `plan_unknown`, `plan_mismatch`, `plan_consumed`, `bad_request`); the same idempotency key plus the same approval_ref returns the same job (while the job still exists); `verified_by_engine` is always false.

## Shape of the observed.jsonl rows for the new tools

The row for `scout_plan_pair_screen`, `scout_start_pair_screen` and `scout_delete_job` has the same fields as every call row (kind, tool, argv, cwd, env fields, `request` with every string replaced by its length, `shape`, `watch_hits`) plus:
- `canon_sha256`: sha256 of the canonical JSON of `args.request` without `approval`, or null when there is no request object.
- `request_keys`: sorted top-level keys of `args.request`, or null.

Arm F10 proves that no request string of 8 characters or more appears in these fields, and that the working folder holds only the fake's own files.

## Fake result

Deterministic. Three outputs from the first artifacts: one by the unusual-pairs engine only, one by the wording-and-meaning engine only, one by both (the plan text said "two pairs, one per engine plus one found by both"; two distinct pairs cannot hold three cases, so the fake uses three outputs, counts 2 and 2). Four inline files (unusual-pairs.json, wording-and-meaning-pairs.json, ranked-pairs.md, manifest.json) with real sha256 values, and one non-inline file `corpus/records.jsonl` with a hash and no content. `manifest_sha256` is the sha256 of the inline manifest.json. Label is `candidate, not verified`.

## Neighbor tests, before and after the fake edit

| Test | Before | After |
|------|--------|-------|
| tests/test-387-eureka-egress.cjs | 22 passed, 0 failed | 22 passed, 0 failed |
| tests/test-387-eureka-installed-layout.cjs | 9 passed, 0 failed | 9 passed, 0 failed |
| tests/test-387-eureka-route-needs.cjs | 9 passed, 0 failed | 9 passed, 0 failed |

Note: a peer session had an uncommitted edit on `tests/test-387-eureka-egress.cjs` during the run. This plan did not touch it and did not stage it.

## Task 2 checks (no network, writes inside the folder)

Arm F6 still scans the whole fake source for code. The scan list is wider now: a require of http, https, http2, net, dns, tls, dgram or child_process, a `fetch(` call, and a spawn, exec, execFile or fork call all fail the arm. The new code uses only `node:fs`, `node:path` and `node:crypto` (pure modules). Arm F10 lists the working folder after a full run: only fake-uv.cjs, pyproject.toml, repo-root.txt, observed.jsonl, jobs.json, receipts.json and the control files. The repo fixture folder still holds only fake-uv.cjs and pyproject.toml (checked by F6).

## Deviations from Plan

- [Rule 1 - Bug, found in the arms] The first draft of F8 and F9 passed when F7 threw an exception. Fixed so F8 and F9 fail in that case. Seen in the RED run.
- [Rule 1 - Bug, found in the fake] A second plan of the same request made a second receipt, so a "second start" got the second receipt instead of `plan_consumed`. Fixed: one live unused receipt for one digest.
- The fake result has three outputs, not two (see above).
- No other deviation. No package was added. package.json is unchanged.

## Known Stubs

None. The whole file is a synthetic fixture by design (D-02).

## UNVERIFIED

The real engine was not started and no local model was used. The plan, start and result shapes are copies of the engine contract (read from host_run/plan.py, gate.py, api.py and the two JSON schemas on 2026-11-08). A change of the real shape is UNVERIFIED here. The fake does not model plan_expired, the 30-day job store, cancel of a pair job, or the engine's own digest value. The fake digest differs from the engine digest on purpose.

## Threat Flags

None. No new endpoint, auth path or trust boundary. The fake makes no network call.

## Commits

Task 1 and Task 2 go in one commit (the plan requires one commit for the three files). The hash is in the final report.
