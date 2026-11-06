---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "13"
type: execute
subsystem: reverse-salient
tags: [B10, rs-fetch, neo4j, sqlite-fallback]
requires: [386-01]
provides: [B10 fixed]
key-files:
  created: [.planning/debug/rs-fetch-neo4j-uri-typeerror-instead-of-sqlite-fallback.md, tests/test-386-rs-fetch-neo4j-fallback.cjs]
  modified: [scripts/rs-discovery-engine.cjs]
requirements-completed: [B10]
completed: 2026-11-06
---

# Phase 386 Plan 13: B10 rs-fetch with NEO4J_URI Summary

B10 was REPRODUCED in a child process on a fixture room (closed loopback port, fake credentials, fetch replaced by a counter). rs-fetch now falls back to the SQLite tier when no Aura driver exists.

## Verdict

REPRODUCED. NEO4J_URI set: exit 1, empty stdout, TypeError text from rs-neo4j-writer (opts.driver required). Control with NEO4J_URI unset: exit 0, tier0. No network call came from the Aura variable.

## Root cause

detectTier returns tier1 from NEO4J_URI alone. rs-fetch-command never builds a driver. The Aura writer throws TypeError before it reaches Aura, and the catch block only treated AuraUnreachableError as a fallback.

## Commits

- 772b4e026 docs(386-13): RCA, verdict REPRODUCED
- 696b9ce3a test(386-13): RED
- cf1914cd1 fix(386-13): fall back to SQLite when the Aura writer fails
- e7d7e3ca8 docs(386-13): RCA resolution

## Deviations from Plan

**1. [Rule 1 - Bug] Fix shape changed after a first attempt broke an existing test**
- First attempt: a guard before the writer call. It broke lib/memory/test-rs-discovery-engine.cjs T2, which expects the writer to be attempted.
- Final fix: in the catch block, a TypeError with no usable opts.driver takes the SQLite fallback (fallback_reason no_aura_driver, one stderr notice). ExternalEgressViolation and a TypeError with a driver still bubble up. This was the one allowed fix attempt, and it passed.

## Verification

- tests/test-386-rs-fetch-neo4j-fallback.cjs: RED (N1 fail, N2 ok), then GREEN.
- lib/memory/test-rs-discovery-engine.cjs rc 0, lib/memory/test-rs-explain-command.cjs rc 0 (before and after).
- Baseline: lib/memory/rs-discovery-engine.test.cjs fails at t2 (classification literal) before and after. Pre-existing and unrelated. `bash tests/run-all-386.sh` had a pre-existing FAIL from the plan 386-02 RED test.

## Known Stubs

None.

## Self-Check: PASSED
