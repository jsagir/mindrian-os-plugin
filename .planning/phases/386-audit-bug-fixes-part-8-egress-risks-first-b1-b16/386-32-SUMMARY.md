---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "32"
subsystem: part8-egress
tags: [part8, over-block, rca, owner-decision, owner-acknowledgement]
requires: [386-26, 386-31, 386-37, 386-39, 386-42]
provides:
  - RCA with the option-e rule-change table (rows R1 to R8, needed_by_route column)
  - Owner decision block (decision: option-e) and Owner acknowledgement block (owner_ack: yes)
affects: [386-33, 386-34, 386-40]
key-files:
  modified:
    - .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
decisions:
  - "decision: option-e (context-based decomposition), owner words 'follow last asnwer for this one as well'"
  - "owner_ack: yes for X8 and the 4 unmarked probe strings; unreadable room.db: short sprouts go, credentials still block"
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 32: Over-blocking RCA, rule table and owner acknowledgement Summary

The RCA reproduces the three over-block causes with synthetic strings (name rule, ordinary business words on the deny list, my or our rule and the sticky unreadable-database cache) and measures them on the corpora. No product file was edited.

## Results

- Rule table R1 to R8 with a needed_by_route column. Plan 386-33 builds R1, R2, R3, R5, R6, R7, R8. R4 (vocabulary exemption for 8 plugin-noun edges) is not built.
- negatives_sprout_ids X3,X4,X6,X7,X8,X10; always block X3,X4,X6; split X7,X10; residual plain X8.
- Probe set: 16 private-claim sprouts; 12 hold a marker (split), 4 leave as written (C:plurai:24, C:plurai:26, C:plurai:29, C:plurai:31).
- Unreadable room.db: today every question blocks; the target design lets a short sprout through (class room_check_skipped), including one that holds a room-lexicon term.
- Owner decision (option-e) and Owner acknowledgement (owner_ack: yes, owner_ack_ids X8, owner_ack_probe_ids the 4 unmarked keys, split_probe_ids the 12 marked keys, owner_ack_unreadable_db_lexicon: yes) are recorded with the owner choices verbatim. The checkpoint answers reached this run through the coordinating session.

## Deviations from Plan

**1. [Rule 3 - blocking] An earlier RCA existed with the pre-option-e options A, B, C**
- The earlier Task 1 commit (24144cc21) predates the owner decision. I rewrote the rule table with the needed_by_route column, added the split, residual and unreadable-database lines, and re-ran the probes on HEAD (same numbers).
- Commits: 44e980eb3, 67a679f69, 8a5abcd1c.

## Self-Check: PASSED

Anchored lines present: decision: option-e, owner_ack: yes, owner_ack_ids, owner_ack_probe_ids, owner_ack_unreadable_db_lexicon: yes.
