---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "03"
subsystem: egress
tags: [rca, semantic-scholar, part-8, whitespace-external]
requires: []
provides:
  - Reproduced RCA for the ungated Semantic Scholar egress (fixture, fetch counter)
  - Owner decision block with the anchored line decision: option-a
affects: [386-05, 386-22, 386-23, 386-24]
tech-stack:
  added: []
  patterns: [fetch-counter preload for egress reproduction]
key-files:
  created: []
  modified:
    - .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
key-decisions:
  - "Owner decision 2026-11-06: option A plus audit record (approval card first, credential check, no content scan); not a Brain-line change"
requirements-completed: [S2]
duration: 20min
completed: 2026-11-06
---

# Phase 386 Plan 03: Semantic Scholar RCA Summary

The Semantic Scholar RCA is now reproduced on a fixture room (4 fetches on a cold cache, 0 on a warm cache, no approval step) and holds the owner decision `decision: option-a` for plan 386-05.

## Accomplishments

- Re-checked every code claim against HEAD 8bee5f739 by symbol name. All PROVEN. One item did not exist: `lib/core/web-path-gate.cjs` (plan 386-22 creates it).
- Reproduced with a `node --require` preload that replaces `globalThis.fetch` with a counter. No network, no real room, 3 synthetic titles, stub brain baseline.
  - Cold run, script direct: 4 queries built, 4 fetches to api.semanticscholar.org, query strings hold the synthetic title words, no approval step, exit 0.
  - Warm cache: 0 fetches. `--force-refresh`: 4 fetches.
  - Dispatcher `whitespace-command.cjs external`: 4 fetches.
- Wrote the Options Weighed section (A, B, C with owner effect and the Phase 363 pieces each reuses) and the concrete test for option A.
- Recorded the Owner decision block.

## Task Commits

1. Task 1, re-verify and reproduce: 3565a7c60
2. Task 2, owner decision: 5f157ca22

## Deviations from Plan

None. The plan executed as written.

## Side finding (not fixed, outside this plan)

A run where all 4 requests fail still writes `external-corpus-cache.json` with 0 papers. A later run then replays that empty result for 7 days with no fetch. Recorded in the RCA for plan 386-05 to decide. Not filed in knowledge-base.md (the plan forbids edits to it).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- RCA file present, `^decision: option-a$` and `## Owner decision` found, no em dash or en dash.
- Commits 3565a7c60 and 5f157ca22 exist on main.
