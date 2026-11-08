---
phase: 390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table
plan: 04
subsystem: testing
tags: [answer-gate, owner-card, sha256, node-builtins]
requires:
  - phase: 390
    provides: card grammar defined in plan 390-04
provides:
  - 390-gate.cjs with selftest, check-decision, seal, gate-group, gate-item, resolve
affects: [390-05, later Phase 390 wave plans]
tech-stack:
  added: []
  patterns: ["per-group owner answer with an options hash and a HEAD ancestor check", "fenced blocks ignored by the card parser"]
key-files:
  created:
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-gate.cjs
    - .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-04-SUMMARY.md
  modified: []
key-decisions:
  - "Structure is checked before the answer token (S12), so a PENDING token on a broken card gives BLOCKED-STRUCTURE."
  - "The ancestor check runs in the card folder by default; --repo DIR overrides it (the selftest cards live in a temp folder, outside the repository)."
requirements-completed: [R390-FIX, R390-CUT-n]
duration: 25min
completed: 2026-11-08
---

# Phase 390 Plan 04: Answer gate for the owner cards Summary

390-gate.cjs reads a card in the plan grammar and tells a later plan, per group or per item, whether the owner answered, whether the answer still matches the options, and what it resolves to. The selftest runs 13 synthetic cases. No product file changed.

## Tasks

| Task | What | Result |
|------|------|--------|
| 1 | Selftest first (RED), then parser, gate-group, gate-item, resolve (GREEN) | S1 to S8, S11, S12 pass |
| 2 | check-decision and seal with S9, S10, S13 (RED then GREEN), one commit | 13 cases pass |

## RED output (PROVEN, saved before any implementation)

Task 1, selftest against stubs (exit 1). First lines:

```
FAIL S1 PENDING gives exit 1 and BLOCKED-PENDING: exit 3 want 1 (gate-group: not implemented); missing "BLOCKED-PENDING" in: gate-group: not implemented
FAIL S2 unknown token APPROVE-MOST gives exit 1 and BLOCKED-TOKEN: exit 3 want 1 (gate-group: not implemented); missing "BLOCKED-TOKEN" in: gate-group: not implemented
FAIL S3 KEEP-ALL gives exit 2, DECLINED and a KEEP line per member: exit 3 want 2 (gate-group: not implemented); missing "DECLINED" in: ...
FAIL S4 RECOMMENDED: exit 0 with a non-KEEP recommendation, exit 2 when all recommend KEEP: exit 3 want 0 (gate-group: not implemented); ...
```

Task 2, after S9, S10, S13 were added (S1 to S8, S11, S12 already green):

```
FAIL S9 check-decision: names each defect with PROBLEM; OK line on a valid card: exit 3 want 1 (check-decision: not implemented); ...
FAIL S10 seal writes hashes and HEAD, keeps answers and other lines byte for byte, refuses an answered card: exit 3 want 0 (seal: not implemented); ...
FAIL S13 seal on a card with no GROUP-SHA256 line for a group: BLOCKED-STRUCTURE with the group id, file unchanged: exit 3 want 1 (seal: not implemented); ...
selftest FAILED: S9 S10 S13
```

## GREEN output (PROVEN)

```
ok   S1 PENDING gives exit 1 and BLOCKED-PENDING
ok   S2 unknown token APPROVE-MOST gives exit 1 and BLOCKED-TOKEN
ok   S3 KEEP-ALL gives exit 2, DECLINED and a KEEP line per member
ok   S4 RECOMMENDED: exit 0 with a non-KEEP recommendation, exit 2 when all recommend KEEP
ok   S5 CUSTOM: missing member, bad option, foreign OD, duplicate pair give BLOCKED-TOKEN; all KEEP exit 2; one non-KEEP exit 0
ok   S6 an OPTIONS line edited after the hash gives exit 1 and BLOCKED-HASH
ok   S7 HEAD-AT-DECISION of 40 zeros gives BLOCKED-HEAD; the live HEAD passes
ok   S8 gate-item: match exit 0, MISMATCH exit 1, resolved KEEP exit 2, PENDING group exit 1
ok   S11 a fenced example OWNER-ANSWER line is ignored
ok   S12 two OWNER-ANSWER lines, or a member with no OPTIONS line, give BLOCKED-STRUCTURE before the token
ok   S9 check-decision: names each defect with PROBLEM; OK line on a valid card
ok   S10 seal writes hashes and HEAD, keeps answers and other lines byte for byte, refuses an answered card
ok   S13 seal on a card with no GROUP-SHA256 line for a group: BLOCKED-STRUCTURE with the group id, file unchanged
selftest passed
```

Case numbering note: the plan lists S1 to S8, S11, S12 for Task 1 and S9, S10, S13 for Task 2. The selftest prints them in that order.

## Exit codes

| Code | Meaning | Words printed |
|------|---------|---------------|
| 0 | go | ANSWERED-ACTION (gate-group), RESOLVED OD-x=OPTION (gate-item) |
| 2 | the owner said keep | DECLINED |
| 1 | blocked | BLOCKED-PENDING, BLOCKED-TOKEN, BLOCKED-HASH, BLOCKED-HEAD, BLOCKED-STRUCTURE, MISMATCH OD-x have=A need=B |

Exit 3 is used only for a usage error or an unreadable file. It is never a gate answer.

## Manual run on a hand-made card (PROVEN)

The group hash on this card was computed with `sha256sum`, not with the script, so it also checks the hash definition independently.

| Command | Exit | Output |
|---------|------|--------|
| gate-group G1, answer PENDING | 1 | BLOCKED-PENDING group G1 has no owner answer |
| gate-group G1, answer KEEP-ALL | 2 | DECLINED, RESOLVED OD-1=KEEP, RESOLVED OD-2=KEEP |
| gate-group G1, answer RECOMMENDED | 0 | ANSWERED-ACTION, RESOLVED OD-1=CUT-A, RESOLVED OD-2=KEEP |
| gate-item OD-1 --need CUT-A | 0 | RESOLVED OD-1=CUT-A |
| gate-item OD-1 --need KEEP | 1 | MISMATCH OD-1 have=CUT-A need=KEEP |
| gate-item OD-2 | 2 | DECLINED OD-2=KEEP |
| resolve | 0 | tab lines: OD-1, G1, CUT-A and OD-2, G1, KEEP |
| check-decision | 0 | OK check-decision groups=1 items=2 |

## Command lines for later plans

Run from the repository root. P is `.planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table`.

- Group: `node $P/390-gate.cjs gate-group $P/390-DECISION.md Gn`
- Item: `node $P/390-gate.cjs gate-item $P/390-DECISION.md OD-x --need OPTION`
- Rule: exit 0 means go. Exit 2 means stop with STATUS DONE and no change, because the owner said keep. Exit 1 means stop with NEEDS_HUMAN and the printed BLOCKED word.

Plan 390-05 uses: `seal FILE` (writes the GROUP-SHA256 lines and HEAD-AT-DECISION, refuses an answered card; every group needs a GROUP-SHA256 line first, a placeholder of 64 zeros) and `check-decision FILE --expect-pending`.

## Deviations from Plan

None in scope. Small design choices inside the plan:
- `--repo DIR` option on gate-group, gate-item, resolve and seal. The default stays the card folder, as the plan says. The selftest needs the option because its cards live in a temp folder outside the repository.
- `resolve` prints PENDING for a pending group and the BLOCKED word (for example BLOCKED-HASH) for another block, so a stale answer is never shown as PENDING.
- `check-decision` also reports an answer token that is not valid (not only the defects the plan lists).
- A line at column 1 that starts with HEAD-AT-DECISION, GROUP, GROUP-SHA256, OPTIONS or OWNER-ANSWER and does not match the grammar gives a structure problem (fails closed). Card prose must not start a line with one of these words; put examples in a fence.

## Known Stubs

None.

## Threat Flags

None. The script reads one text file, runs `git merge-base` and `git rev-parse`, and writes only through `seal` (temp file and rename).

## Checks

- Script uses Node built-ins only (fs, os, path, crypto, child_process). No em dash, no non-ASCII byte (grep checked).
- Only two files in the commit. No product file, no push, tag or release.

## Self-Check: PASSED
