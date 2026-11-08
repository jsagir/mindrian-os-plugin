---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 14
subsystem: mcp
tags: [eureka, tool-budget, engine-guide, release-suite, phase-close, part-7, part-8, part-11]
requires: ["374-13"]
provides:
  - "374-measure.cjs: a tools/list probe that reuses measure() of tests/test-270-tool-schema-budget.cjs"
  - "374-BUDGET.md: the tool-budget decision record with the token figure (OD-1 = KEEP, no router)"
  - "docs/integrations/mindrian-eureka-engine.md: a section on the pair screen, saved job records, forget, restart limit, busy guard, paging, caps and the open asks EXT-01 to EXT-05"
  - "tests/run-all-366.sh: one hard run line for tests/run-all-374.sh"
affects: []
key-files:
  created:
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-measure.cjs
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-BUDGET.md
  modified:
    - docs/integrations/mindrian-eureka-engine.md
    - tests/run-all-366.sh
key-decisions:
  - "Gate lines read: ACT OD-1 KEEP go, READ OD-2 ADD-FORGET-TOOL, OD-3 TOPK-200, OD-4 USER-DIR, OD-5A F6, OD-5B SCREEN, OD-6 ENGINE-BUSY-GUARD, OD-7 PAGE-ARG, PLAN-GO 374-14, exit 0. BASE = c5e436289f5033038ac0a008135ce75cd68f98de."
  - "OD-1 is KEEP: the router question is closed for Phase 374; the recorded re-baseline is the decision. No router, no Router handoff section."
  - "The budget figures were taken from the live tools/list output by the probe, not retyped. The probe starts no engine and runs with MINDRIAN_EUREKA_ROOT unset."
  - "tests/run-all-366.sh was clean (git diff --quiet HEAD exit 0, git status empty) so the registration was made, not carried over."
requirements-completed: [ADAPT374-01, PLG374-11]
requirements-open: [ADAPT374-06]
canon_parts: [7, 8, 11]
---

# Phase 374 Plan 14: tool budget record, engine guide and release suite registration

The Phase 374 close. The tool-budget call is written down with a measured token figure, the engine guide tells the truth about the pair screen and its limits, and the phase tests now run inside the release gate suite. No live engine was started. ADAPT374-06 stays open.

## Gate

`node 374-gate.cjs plan 374-14` printed `ACT OD-1 KEEP go`, `READ OD-2 ADD-FORGET-TOOL`, `READ OD-3 TOPK-200`, `READ OD-4 USER-DIR`, `READ OD-5A F6`, `READ OD-5B SCREEN`, `READ OD-6 ENGINE-BUSY-GUARD`, `READ OD-7 PAGE-ARG`, `PLAN-GO 374-14`, exit 0. Every behaviour sentence of the guide applies.

## What was built across Phase 374

| Plan | One line | Commit |
|------|----------|--------|
| 374-01 | Refreshed the stale 267 wire pins for the 25 Eureka and RS tools (50 to 75) and fixed the registration attribution | 6aaa7496e, b51bb25b9 |
| 374-02 | Fake engine with the pair-screen routes, job files and a restart switch | 5b839f7fc |
| 374-03 | One shared approval gate minter, resolve receives its gate id | 2a8a15a93 |
| 374-04 | Answer gate wrapper (374-gate.cjs) for the owner cards | 83fe9c48c |
| 374-05 | RED tests for the start guards, owner binding, result verifier, catalog cache; phase aggregator | e28de7e18 |
| 374-06 | Start guards, lineage check, job owner binding, catalog cache, pair-screen verifier | 6cce4e7fc |
| 374-07 | Seven owner decision cards (owner answered RECOMMENDED on all seven, 2026-11-08) | 4c034ceb1, eeb24c8b3 |
| 374-08 | Pair screen route: plan, one approval gate (F.6 card), start, verified result | b3f253e0e |
| 374-09 | `/mos:eureka screen` subcommand | 31b3afd3b |
| 374-10 | Saved job record under ~/.mindrian/eureka-jobs/ and recovery by asking the engine; T12 live restart test written | baea19a8f |
| 374-11 | Interim `engine_busy` guard (one host process) | f3ca1e674 |
| 374-12 | `top_k` 200 and paged job results above 256 KiB | 37bf7ecd4 |
| 374-13 | Forget tool, honest job tool descriptions, every pin moved once | c5e436289 |
| 374-14 | This plan: budget record, guide, release suite registration | the commit with subject `docs(374-14)` (hash in the report) |

No gated plan was declined or re-planned. All seven owner answers resolved to the recommended option, so every gated plan ran in full.

## Task 1: measure, record, guide

- `374-measure.cjs` is a probe, not a test. It starts bin/mindrian-mcp-server.cjs over stdio as test-270 does, calls the exported `measure()` of test-270, and adds the Eureka family. It prints JSON, exits 0 and never starts an engine.
- Command quoted for the record: `env -u MINDRIAN_EUREKA_ROOT node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-measure.cjs`.
- The probe and `node tests/test-270-tool-schema-budget.cjs` print the same line: `budget: 76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total, ~21400 approx tokens (router 9 / atomic 67)`, 5 passed, 0 failed. PROVEN.

Budget figures (from 374-BUDGET.md):

| Point | Tools | Total bytes | Approx tokens | Eureka family |
|-------|-------|-------------|---------------|---------------|
| Before the phase (planner, 2026-11-08) | 75 | 83,800 | 20,950 | 26 tools, 25,977 bytes |
| After plan 374-12 | 75 | 83,855 | 20,964 | not measured |
| After the phase (this run) | 76 | 85,599 | 21,400 | 27 tools, 27,776 bytes (32.4 percent of the surface) |

Phase change: +1 tool, +1,799 bytes (+2.15 percent), +450 approx tokens. All of it is inside the Eureka family (+1,799 bytes). Plan 374-13 alone: +1,744 bytes, +436 tokens. The eureka_graph_* tools: 17 tools, 17,034 bytes, 4,259 tokens. The capability and job tools: 6 tools, 5,328 bytes. Headroom to the test-270 band (10 percent, read from the file) against the recorded AFTER of 374-13: 8,559.9 bytes (about 2,140 tokens). The exact tool count (76) is the tighter limit. Tokens are bytes divided by 4, a proxy that is good only for comparing numbers from the same function. No client tool-count limit was found (UNVERIFIED for the Claude hosts).

Note on a second figure: plan 374-13 measured the S7 stdio list at 73 tools with 25 Eureka tools, 26,506 bytes. The test-270 list has 76 tools with 27 Eureka tools. They are different tool profiles. The reason for the gap was not traced here.

Engine guide: a new subsection "The pair screen, saved job records and limits" before "CLI handoff" covers the pair screen through the capability tools (plan, review card, start; the answer is a candidate list), the 30 day record and how to forget a run, recovery after a restart and its limit (no resume), the busy guard, paging above 256 KiB, the caps (top_k 200; node cap stays 2,500 and why), a table of EXT-01 to EXT-05, and a short "not yet checked" line. Two stale sentences were corrected: "Jobs ... cannot resume after that process restarts" (now: a finished job can be read again through its saved record, a run does not resume) and "Results at or above 256 KiB carry a size warning" (now: paged).

Verified: `node tests/test-387-eureka-docs-wording.cjs`: 9 passed, 0 failed. No em dash or en dash in the guide or in 374-BUDGET.md (grep).

## Task 2: registration and final gates

Registration: `tests/run-all-366.sh` was clean (`git diff --quiet HEAD` exit 0). One comment block and one hard run line were added after the Phase 370 line: `run "374 adapter surface completion (generic path guards, pair screen, job record, caps, paging, forget)" bash tests/run-all-374.sh`. `bash -n tests/run-all-366.sh`: OK. The registered run is the plain mode (no --neighbors); it uses fake clients and the fake engine; the live restart test exits 77 without `MOS_374_LIVE=1` and counts as SKIPPED. `tests/run-all-374.sh` itself needed no edit (it finds test-374-* files by glob). The full `tests/run-all-366.sh` was NOT run (it is the whole release suite, out of scope for this plan); only the syntax and the 374 leg were checked.

Final gates (all run with MINDRIAN_EUREKA_ROOT and MINDRIAN_EUREKA_RS_MODEL_PATH unset; PROVEN):

| Gate | Exit | Last line |
|------|------|-----------|
| `bash tests/run-all-374.sh` | 0 | `Phase 374: PASS=19 FAIL=0 SKIPPED=1` (skip = T12 live restart, owner-run) |
| `bash tests/run-all-374.sh --neighbors` | 0 | `Phase 374: PASS=47 FAIL=0 SKIPPED=1` |
| `node tests/test-270-tool-schema-budget.cjs` | 0 | `5 passed, 0 failed` |
| `node scripts/build-connector-registry.cjs --check` | 0 | (no mismatch printed) |
| `node scripts/build-orchestration-projection.cjs --check` | 0 | `orchestration-projection: OK` |
| `node scripts/check-render-coverage.cjs` | 0 | `193 wired, 2 excluded, 0 unwired (195 declaring commands)` |
| `node scripts/build-skill-mirrors.cjs --check` | 0 | `OK (111 mirrors match expected content ...)` |
| `node scripts/check-shape-declaration.cjs --check` (advisory) | 0 | 53 advisory WARN violations, the same count as CLAUDE.md names; none is a Phase 374 file |
| `node tests/test-384-s7-mcp-start.cjs parity` | 0 | `s7-mcp-start: ALL PASS` |
| `node tests/test-387-eureka-docs-wording.cjs` | 0 | `9 passed, 0 failed` |
| 16 files `tests/test-267-mcpv2-*.cjs` | 14 exit 0; cirs-gates exit 1; cli-probe exit 77 | see carry-over (g) |
| `tests/test-276-tool-honesty-findings-closed.cjs` failing lines | 5 | unchanged (5 before and after) |

NOT run, on purpose: any live test, `node scripts/doctor.cjs --acceptance` (unconfirmed whether its Eureka readiness point starts an engine child), `scripts/release.sh`, dist regeneration, push, tag.

## Carry-over list

### (a) Owner-run live commands (ADAPT374-06 stays open)

Run on an idle host with the engine folder prepared (`/mos:eureka enable engine --sync` with the encoder extra) and a local meaning-model folder. Record pass or fail for each.

```
export MINDRIAN_EUREKA_ROOT=<engine folder>
export MINDRIAN_EUREKA_RS_MODEL_PATH=<model folder>
node tests/test-eureka-live-bridge.cjs
node tests/test-eureka-live-capability-jobs.cjs
node tests/test-eureka-live-capability-run.cjs        # known red today, see item 1 below
node tests/test-eureka-live-graph-algorithm-services.cjs
node tests/test-eureka-live-opportunity-scout.cjs
MOS_374_LIVE=1 MINDRIAN_EUREKA_ROOT=<engine folder> MINDRIAN_EUREKA_RS_MODEL_PATH=<model folder> node tests/test-374-live-restart.cjs
node scripts/doctor.cjs --acceptance
```

For the restart test (T12) the owner records: (1) does the first engine child process linger after the host is killed, and (2) what state the engine shows after recovery (a job still running at the kill is expected to read failed with `server_restarted`; a job finished before the kill should read completed). For `doctor --acceptance`: pass or fail of each point, and whether an engine child process was started (check `ps` before and after).

### (b) Facts found today, to carry forward

1. `tests/test-eureka-live-capability-run.cjs` fails with `eureka is a known dedicated CLI route; add it to the descriptive-CLI check below before using it`. The live Eureka catalog now has a dedicated CLI route named `eureka`. A one-word list update is owed in a separate quick. NOT done in this plan.
2. A glob of `tests/test-eureka-*.cjs` also runs the LIVE tests when `MINDRIAN_EUREKA_ROOT` is set. Never glob that pattern in a verify command. (Plan 374-13 hit this by accident; see its Deviation 4.)
3. `~/.mindrian/eureka-jobs/3a9d17e1-6488-4946-a71f-a0645a8fd674/` holds 2 small record files (about 800 bytes each), written by an accidental live run on 2026-11-08 20:25. Confirmed still present at the end of this plan (the folder is the only entry in `~/.mindrian/eureka-jobs/`). They expire in 30 days. Deleting them needs the owner's explicit `rm`, because the permission layer denied an executor's delete. This plan did not touch them.
4. The doctor mcp-surface reading was 81 tools (about 21,853 tokens) before Phase 374 and is expected near 82 tools (about 22,289 tokens) after the forget tool (ASSUMED, not measured). Phase 392 owns the budget and the alwaysLoad decision. This plan recorded the figures and did not change the budget.
5. ADAPT374-06 stays open: the live restart proof (T12) is owner-run.
6. Eureka session dependencies still open on their side: EXT-01 job-store owner lock and terminal-state guard, EXT-02 a status read path that does not run recovery, EXT-03 workers that read the cancel flag, EXT-04 lift of the 2,500 artifact cap (only if NODES-3000 is ever chosen), EXT-05 the commit id of the owner lock and a distinct budget status. Interim stop-gaps are in the guide table.
7. A runtime string still says the old thing: `lib/mcp/tools/eureka-capability-jobs.cjs` line 262 (the `note` of the start answer) says "cannot resume after that process restarts", and line 352 (the `job_session_not_found` message) says "Jobs cannot resume after the MindrianOS host process restarts; start a new job." Line 352 stays true when no record exists and is pinned by test-387-eureka-installed-layout (plan 374-13 left it on purpose). Line 262 is a start-time note and is now partly stale, because a finished job can be read again. It is code, so this plan did not edit it. A small quick can reword it (and its pin, if any).

### (c) UNVERIFIED list

- Windows file permissions and behaviour of the job record and the child process handling.
- Two MindrianOS host processes on the same engine data folder (the busy guard covers one process).
- The real engine's pair-screen plan and result shapes. The tests use copies of them in the fake engine. The real `scout_delete_job` answer shape is taken from reading the engine source.
- The 0.5 MB result estimate behind the paging cap.
- A lingering engine child after a host kill.
- Claude Desktop and Cowork rendering of the F.6 review card and of the destructive-tool confirmation.
- No client tool-count limit for the Claude hosts.
- The doctor token figure after the forget tool (about 22,289 is an estimate).

### (d) Requirement rows the main session may tick after review

PLG374-01 to PLG374-11 and ADAPT374-01 to ADAPT374-05 may be ticked. One caution for the main session: the 374-11 summary lists ADAPT374-02 as "multi-host and live proof still open" and the 374-10 summary lists ADAPT374-06 as open. Judge ADAPT374-02 against that note before ticking. ADAPT374-06 stays OPEN (owner-run live restart proof). This plan did not edit REQUIREMENTS.md, STATE.md or ROADMAP.md.

### (e) 276 failures that are not ours

5 failing lines in `tests/test-276-tool-honesty-findings-closed.cjs`, unchanged before and after Phase 374.

### (f) Registration lines skipped because of a peer edit

None. `tests/run-all-366.sh` was clean and the line was added.

### (g) Pre-existing reds and notes on stale counts

- `tests/test-267-mcpv2-cirs-gates.cjs` exits 1. Check (c) expects 35 connector descriptors and now gets 63 (it was 62 in plan 374-13; the peer session's Phase 389 work moves the count). Check (b) now also names `commands/mva-brief.md` and `skills/mva-brief/SKILL.md` as new shape-declaration violations not in the baseline. Those are the peer's Phase 389 files, not Phase 374 files. The test was red before Phase 374 (stale 35 vs 62 count).
- `tests/test-267-mcpv2-cli-probe.cjs` exits 77 (it cannot run here). Pre-existing.

### (h) Card options answered that have no plan

None. All seven answers were the recommended option. The options NODES-3000, PAGE-ARG-PROJECTION and HANDLE-TOOL were not chosen, so no new plan is needed. The paging of projection tools (ADAPT374-03 for the projection tools, not the job result) stays deferred by card OD-7 as the CONTEXT file records.

## Deviations from Plan

None - the plan ran as written. Two notes that are not deviations:

- Plan text in the objective says the pre-phase Eureka family is 26 tools and 25,977 bytes. The probe now shows 27 tools and 27,776 bytes. The difference (+1 tool, +1,799 bytes) equals the total growth of the phase, which is a cross-check that the whole growth came from the forget tool and description rewrites.
- The advisory shape check needs the `--check` flag (run without it, it prints usage and exits 2). It was run with `--check`.

## Known Stubs

None.

## Threat Flags

None. The probe reads the tool list and starts no engine (T-374-63). The guide states the one-process limit, the no-resume rule and the open EXT asks (T-374-64). The budget figures come from `measure()` and the tolerance was read from the test file by code (T-374-65). The commit uses exact paths (T-374-03).

## Self-Check

PASSED (run before the commit, because the SUMMARY is inside the one commit):

- The four created or edited files exist: 374-measure.cjs, 374-BUDGET.md, the engine guide, tests/run-all-366.sh. The added lines of the guide and of run-all-366.sh and the three new .planning files hold no non-ASCII byte (grep with LC_ALL=C).
- No engine process (`eureka-mcp`) was running at the end (`ps`).
- Peer files that were dirty in the tree (docs/TELEMETRY-SCHEMA.md, lib/core/telemetry/*) were not touched and are not staged.
- The commit hash is in the executor report, because a commit cannot name its own hash.
