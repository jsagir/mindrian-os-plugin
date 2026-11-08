# Phase 374 tool budget decision record

Date: 2026-11-08. Plan: 374-14. Requirement: ADAPT374-01 (card OD-1). Repo version at the time: 2.0.0-beta.82.

## The question

ADAPT374-01: the Eureka tools grew the local tool list. Build a tool router for them, or only record a new baseline?

## The owner's answer

Card G1, item OD-1. The owner answered RECOMMENDED on all seven cards on 2026-11-08, in his own words. The recommended option of OD-1 is KEEP. The gate wrapper confirms it:

```
node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs plan 374-14
ACT OD-1 KEEP go
...
PLAN-GO 374-14
```

Meaning of KEEP: the router question is closed for Phase 374. The recorded re-baseline below is the decision. No router is built. No code changes for this card. Because the answer is not ROUTER-NEXT, this record has no "Router handoff" section.

## How the numbers were measured

Command (run from the repo root, with MINDRIAN_EUREKA_ROOT unset so no engine can start):

```
env -u MINDRIAN_EUREKA_ROOT node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-measure.cjs
```

The probe starts bin/mindrian-mcp-server.cjs over stdio the same way tests/test-270-tool-schema-budget.cjs does and calls the exported `measure(tools)` of that file. The totals therefore come from the same function as the budget test. The Eureka family is every tool whose name starts with `eureka_` or `rs_`. The tolerance and the recorded AFTER were read from the test file by code, not retyped.

Cross-check with the test itself:

```
env -u MINDRIAN_EUREKA_ROOT node tests/test-270-tool-schema-budget.cjs
budget: 76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total, ~21400 approx tokens (router 9 / atomic 67)
5 passed, 0 failed
```

The probe and the test print the same totals. PROVEN.

## The table

Tokens are bytes divided by 4. This is a proxy. It is good only for comparing numbers from the same function (here: `measure()` of test-270). It is not a count from a real tokenizer.

| Point in time | Tools | Total bytes | Approx tokens | Eureka family (tools, bytes) | Source |
|---------------|-------|-------------|---------------|------------------------------|--------|
| Before the phase (2026-11-08, planner, HEAD 62e2a4ec9) | 75 | 83,800 | 20,950 | 26 tools, 25,977 bytes | planner run of test-270 and a scratch probe (CITED from 374-RESEARCH.md; the 83,800 line was re-run by plan 374-07 and 374-11) |
| After plan 374-12 (before plan 374-13) | 75 | 83,855 | 20,964 | not measured | 374-12 and 374-13 summaries (the 374-13 BEFORE line) |
| After the phase (this run) | 76 | 85,599 | 21,400 | 27 tools, 27,776 bytes | this plan's probe |

Signed change, before the phase to after the phase:

| Measure | Change | Percent |
|---------|--------|---------|
| Tools | +1 | +1.33 |
| Total bytes | +1,799 | +2.15 |
| Approx tokens | +450 | +2.15 |
| Eureka family bytes | +1,799 | +6.93 |

The whole growth of the phase is inside the Eureka family: the total grew by 1,799 bytes and the family grew by 1,799 bytes. PROVEN by the two probe runs.

Split of the Eureka family now (this probe):

| Group | Tools | Bytes | Approx tokens | Change since the planner figure |
|-------|-------|-------|---------------|----------------------------------|
| Whole family | 27 | 27,776 | 6,944 | +1,799 bytes |
| eureka_graph_* tools | 17 | 17,034 | 4,259 | +81 bytes (scout top_k and description) |
| eureka_capability_* tools (run, start, 4 job tools) | 6 | 5,328 | 1,332 | +1,718 bytes (the forget tool and the rewritten descriptions) |
| Share of the whole surface | | 32.4 percent | | was 31.0 percent |

Another measure, for the record: plan 374-13 measured the S7 stdio tools/list wire (test-384 environment) at 73 tools in total and 25 Eureka tools, 26,506 bytes, up 1,799 bytes in that plan. This is a different tool profile from the test-270 list (76 tools, 27 Eureka tools). The reason for the difference was not traced in this plan. Do not add the two lists together.

## Headroom to the test-270 tolerance

Test-270 allows the measured total to differ from the recorded AFTER by `DRIFT_TOLERANCE_PCT` (read from the file: 10 percent). The recorded AFTER now is the 374-13 line (85,599 bytes).

| Reference | Ceiling (bytes) | Headroom now (bytes) | Headroom (approx tokens) |
|-----------|-----------------|----------------------|---------------------------|
| Recorded AFTER 374-13 (85,599), the value the test uses today | 94,158.9 | 8,559.9 | 2,140 |
| Older uqs block AFTER (83,522, the value the planner used) | 91,874.2 | 6,275.2 | 1,569 |

Test-270 also needs the exact tool count (76). Any new tool trips the count first, so the 10 percent band is not the real limit; the exact count is.

## What changed the number

From the plan summaries:

- Plans 374-01 to 374-11: no description or input schema of a tool changed. The test-270 line stayed at 75 tools, 83,800 bytes through plan 374-11 (374-08, 374-10 and 374-11 state it).
- Plan 374-12: the optional `page` argument of `eureka_capability_job_result` added 55 schema bytes (83,800 to 83,855). The scout `top_k` cap went from 100 to 200 (a number, not a size change worth measuring on its own).
- Plan 374-13: the forget tool `eureka_capability_job_forget` (75 to 76 tools) and honest descriptions for start, status, result, cancel, run and the scout: +1,744 bytes (+1,495 description, +249 schema) and +436 approx tokens.

## Other readings, and who owns them

- The doctor mcp-surface reading was 81 tools (about 21,853 tokens) before Phase 374. After the forget tool it is expected near 82 tools (about 22,289 tokens). This figure is ASSUMED. It was not measured here (`node scripts/doctor.cjs --acceptance` was not run, see the summary).
- Phase 392 owns the doctor budget and the alwaysLoad decision. This plan did not change the doctor budget.
- No client limit on the tool count was found for the Claude hosts. This is UNVERIFIED for Claude Desktop, Claude Code and Cowork: nobody read a host limit, and no host was asked.
- No rule in the repo caps the tool count. The only gate is test-270 (exact count plus the byte band).

## Decision

KEEP. The surface has room (about 8.5 KB to the band), nothing found blocks it, and a router would rename 23 shipped tools that three fixtures, two command docs and one skill pin by name, for a saving nobody measured. If a router is wanted later, it needs its own phase and its own measurement. The upper bound of the saving is the bytes of the 17 eureka_graph tools (17,034 bytes, about 4,259 tokens) minus the router's own size, which is unmeasured.
