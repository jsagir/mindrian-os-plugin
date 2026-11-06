---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "28"
subsystem: egress-guard
tags: [part8, job-key, packet, e-job]
requires: ["386-25"]
provides:
  - classify() decides a free-form string with theoVerdict before the packet arm
  - _proveMoveSet requires payload keys within the packet schema for the job
affects: [386-31, 386-33]
key-files:
  created:
    - tests/test-386-job-key-shortcut.cjs
    - .planning/debug/part8-job-key-skips-room-word-rules.md
  modified:
    - lib/core/part8-egress-guard.cjs
key-decisions:
  - "The allowed packet keys are the in.properties of the job in data/brain-packet-schema.json plus the five handle fields _proveMoveSet already checks (framework, slug, handle, reach_id, methodology). The shipped e2e smoke packet uses a handle key, so it stays allow."
requirements-completed: [E-JOB]
completed: 2026-11-06
---

# Phase 386 Plan 28: Close the job-key shortcut Summary

A job key no longer changes the verdict of a free-form string. A packet with a key outside its schema is no longer allow.

## Root cause (PROVEN)

The packet arm was chosen by the presence of `job` (or `packet_version`), before the free-form arm. `_proveMoveSet` did not check the other keys. Before the fix, for brain_ask on both prefixes: an edge string and a room-lexicon hit were block/room_content without the key and allow/move_set with it. A nested-object sibling, a short free-text sibling and a credential-shaped sibling next to a job key were all allow/move_set on a packet.

## Verification (PROVEN)

- tests/test-386-job-key-shortcut.cjs: RED (J1 to J5 FAIL, J6 to J8 ok), then GREEN (9 ok).
- Corpus gate: DELTA lines identical to the pre-plan run, GATE PASS, MEASURED_SHA256 unchanged. Baseline file not touched.
- Pass: run-all-196 (7), test-386-typed-theo-allow-arms, test-239-query-egress-canary, part8-egress-e2e-smoke, test-245-egress-contentless, test-223, test-355, test-363.1-eureka-exclusion, test-260906-fda, test-361-egress-shapes, lib/core/part8-egress-guard.test.cjs.
- run-all-386: 20 of 20 PASSED on the final run. One earlier run showed a failing cascade test of a peer plan while that peer was mid-edit; it passed on the rerun.

## Deviations from Plan

**1. [Rule 1] Allowed key set includes the five handle fields.** The plan says exact packet-schema keys. The shipped smoke test and `_proveMoveSet` use handle fields (framework and others) that are not schema keys. They are still checked one by one (generic handle shape plus the content audit). Without them the smoke fixture would stop allowing.

**2. Parity fixtures.** In the room-lexicon test the plain form of a sprout with the fixture venture name is block, so parity (plain equals job form) is the proof, not a fixed expected verdict.

## Commits

- RCA: 4910b4f36
- RED test: c5342b1b9
- Fix: d4e295b38

## Self-Check: PASSED
