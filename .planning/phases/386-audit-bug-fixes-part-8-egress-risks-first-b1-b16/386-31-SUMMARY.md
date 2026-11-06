---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "31"
subsystem: egress-guard
tags: [part8, credentials, e-key, corpus-baseline]
requires: ["386-28", "386-22"]
provides:
  - CREDENTIAL_SHAPES (12 rules) in lib/core/cross-room-aggregator.cjs, part of FORBIDDEN_PATTERNS and exported
  - auditWebCredential tests the same list (credentials only)
  - corpus baseline re-stamped: GAP1 fixed, GAP2 open
affects: [386-32, 386-33]
key-files:
  created:
    - tests/test-386-key-shapes-and-money.cjs
  modified:
    - lib/core/cross-room-aggregator.cjs
    - lib/core/rs-egress-prompts.cjs
    - tests/fixtures/3692/guard-survey-baseline.json
    - .planning/debug/part8-egress-guard-under-blocks-key-shape-and-spelled-money.md
key-decisions:
  - "Credentials always block; money, percent and k-suffix words get no pattern (owner principle). GAP2 stays open for the decision of plan 386-32."
  - "The Bearer shape needs 16 or more token characters and a digit. The web check keeps its 2 original rules next to the shared list."
requirements-completed: [E-KEY]
completed: 2026-11-06
---

# Phase 386 Plan 31: Block credential shapes Summary

Credential shapes now block on the Brain line (content_set) and are refused by the web credential check, from one shared list. No money, percent or k-suffix pattern was added.

## Root cause (PROVEN)

FORBIDDEN_PATTERNS had no credential rule. Of 14 fake shapes, 12 passed on brain_ask and 12 on brain_query (only AKIA via the upper-case identifier rule and Bearer via the proper-name look were caught, with class room_content, not content_set). auditWebCredential passed the same 12. Spelled money: 5 of 7 forms pass today (two million dollars, 750000 dollars, 750k, 40%, euro amounts); $750K and 40 percent already block. These 5 forms are input for the decision table of plan 386-32.

## Corpus gate (PROVEN)

- Plan-start numbers: ext.induced_total 0, ext.blocked_no_room 37, negatives.leaks [], GAP1 allowed_in 7, GAP2 allowed_in 7.
- Before the stamp (zero FAIL rows, ext.induced_total 0): GAP1 allowed_in 0 (IMPROVED), GAP2 allowed_in 7 (open). Every other DELTA line equal.
- Stamp: one run, `--stamp --reason "plan 386-31: credential shapes"`. The stamp also moved the catalog total from 522 to 535 (B 427, C 97), which the gate had reported as NOTE before this plan. After the stamp: GATE PASS, GAP1 fixed, GAP2 open.

## Verification (PROVEN)

- tests/test-386-key-shapes-and-money.cjs: RED (K1, K2, K6 fail; K7, K8, K9 pass), then GREEN (8 ok).
- Pass: run-all-196 (7), test-239-query-egress-canary, test-223, test-355, test-3692-theo-verdict, test-386-job-key-shortcut, test-386-typed-theo-allow-arms.
- run-all-386: 22 of 22 PASSED.

## Deviations from Plan

**1. files_modified lists lib/core/part8-egress-guard.cjs; it was not changed.** The plan says change it only if the RCA needs it. The shared scan already runs first, so the guard needed no edit (and PB8-02 forbids a private pattern copy).

**2. Fifteen shapes in the test (14 in the RCA).** The test adds an upper-case sk- variant to cover letter case. The RCA counts are for the 14 listed shapes.

## Commits

- RCA: 4445e09d0
- RED test: b7fd80ea7
- Fix and stamp: 796e69566

## Self-Check: PASSED
