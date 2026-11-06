---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "05"
subsystem: egress-gate
tags: [part8, semantic-scholar, approval-token, audit-ledger, whitespace]
requires: ["386-01", "386-03", "386-22"]
provides:
  - query-semantic-scholar.cjs with --list-queries, --approve token, credential check, audit record
  - whitespace external approval step (dispatcher and command)
affects: [386-21]
tech-stack:
  added: []
  patterns: [list first then send with token over the exact strings; credential check only on web lines]
key-files:
  created:
    - tests/test-386-semantic-scholar-approval.cjs
  modified:
    - scripts/query-semantic-scholar.cjs
    - scripts/whitespace-command.cjs
    - commands/whitespace.md
    - skills/whitespace/SKILL.md
    - tests/test-363-command-contract.cjs
    - .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
key-decisions:
  - "Owner decision option A: approval card first, credential check, audit record, no content scan."
requirements-completed: [S2]
completed: 2026-11-06
---

# Phase 386 Plan 05: Semantic Scholar behind the web-path gate Summary

The Semantic Scholar script sends nothing without the approval token of its own query list. Each sent query passes the credential check and gets one audit record.

## Measurements (PROVEN)

- Before: a cold-cache run made 5 fetch calls with no token (test arms S1, S2, S4, S7 RED). Audit calls: 0.
- After: no token, wrong token or credential-shaped query: 0 fetch calls. List mode: 0 fetch calls. Approved run: 5 calls, 5 audit records. A warm cache: 0 calls, no token.
- A fixture title with a person name, a city and a company name is sent after approval (S9): no content scan.

## Task Commits

1. RED test: 66d2d3a14 (S1 to S5, S7 to S10 FAIL, S6 pass)
2. Fix: 8d793693b
3. RCA resolution block: see git log (docs(386-05))

## Verification

- node tests/test-386-semantic-scholar-approval.cjs: S1 to S10 and S7b pass.
- bash tests/run-all-386.sh: 18 of 18 pass. test-386-web-path-gate pass.
- test-355-no-decimal, test-355-part8-egress, test-355-floor-sweep, test-355-producer-whitespace-hsi, test-355-stamp-coverage: green before and after.
- build-connector-registry --check pass; check-render-coverage 0 gaps; check-shape-declaration advisory 51 before and after.

## Deviations from Plan

**1. [Rule 3 - Blocking] test-363-command-contract P1 byte-preservation leg**
- Issue: the leg requires the external section to equal its pre-phase text. The approval step is new text in that section.
- Fix: updated the leg in place for whitespace external only (strip the marker block and the token argument, then compare), with a comment citing plan 386-05.
- Commit: 8d793693b.

**2. [Rule 3 - Blocking] skill mirror drift**
- Issue: the commit hook refused with skill-mirror drift after commands/whitespace.md changed.
- Fix: ran node scripts/build-skill-mirrors.cjs. It changed only skills/whitespace/SKILL.md. Included in 8d793693b.

**3. Extra test arm S7b** (dispatcher with the token sends only the listed queries). Added beyond the plan list.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
