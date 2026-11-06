---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "24"
subsystem: egress-gate
tags: [part8, research-speaker, approval-token, audit-ledger, file-meeting]
requires: ["386-01", "386-22"]
provides:
  - scripts/research-speaker with --list-queries, --approve TOKEN, credential check, audit record
  - file-meeting command step: list, ask, then send
affects: [386-21]
tech-stack:
  added: []
  patterns: [bash calls the web-path-gate CLI (token, credential, record); token over the exact strings]
key-files:
  created:
    - tests/test-386-research-speaker-approval.cjs
    - .planning/debug/research-speaker-sends-names-before-the-user-is-asked.md
  modified:
    - scripts/research-speaker
    - commands/file-meeting.md
    - skills/file-meeting/SKILL.md
    - tests/test-261030-eo7-research-speaker-apply-context.cjs
    - tests/test-261030-eo7-research-speaker-urlencode.cjs
key-decisions:
  - "Owner decision 2026-11-06: research-speaker asks before it sends anything; credential check and audit record; no content scan."
requirements-completed: [E-RS]
completed: 2026-11-06
---

# Phase 386 Plan 24: research-speaker asks before it sends Summary

research-speaker sends nothing until a run carries the approval token of its 3 exact searches. Each search is checked for a credential and recorded. The file-meeting command lists the searches and asks the user first.

## Order of ask versus send (PROVEN)

- Before: the first curl ran right after the strings were built. The command asked only before the PROFILE.md write. A plain run made 3 calls and --apply made 3 more. No audit file.
- After: no token, wrong token, credential-shaped context: 0 calls. List mode: 0 calls. Approved run: 3 calls equal to the listed searches and 3 audit records.

## Task Commits

1. RCA: eb6fa300e
2. RED test (RS1 to RS9 all FAIL): 87dafaa3f
3. Fix (GREEN): a0ad2fb19

## Verification

- node tests/test-386-research-speaker-approval.cjs: RS1 to RS9 pass.
- bash tests/run-all-386.sh: 23 of 23 pass. bash tests/run-all-eo7.sh: 5 of 5 pass.
- test-265-file-meeting-gates, test-265-file-meeting-perspectives, tests/test-speaker-id.sh: pass.
- build-connector-registry --check pass; check-render-coverage 0 unwired; bash -n scripts/research-speaker ok.

## Deviations from Plan

**1. [Rule 3 - Blocking] Two existing eo7 research-speaker tests**
- Issue: test-261030-eo7-research-speaker-apply-context ran --apply with no token, and test-261030-eo7-research-speaker-urlencode compared the whole script head line for line with the old cut and ran the script with no token.
- Fix: updated in place with comments citing plan 386-24. The repo script now runs list mode first and passes --approve. Check A3 now compares the urlencode function only (still exactly 1 differing line). The old-cut oracle comparisons are unchanged.
- Commit: a0ad2fb19.

**2. [Rule 3 - Blocking] skill mirror drift**: ran node scripts/build-skill-mirrors.cjs. Only skills/file-meeting/SKILL.md changed.

## Observation (not changed)

With the token, --apply still repeats the 3 searches (approved and recorded) although the apply branch does not use their results. The plan keeps this ("--apply needs the token"). Dropping the repeat is a candidate follow-up.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
