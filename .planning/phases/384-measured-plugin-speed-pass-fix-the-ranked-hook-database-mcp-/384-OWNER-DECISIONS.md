# Phase 384 - Owner decisions at the ranking checkpoint

Date: 2026-11-06. Given by the owner on the checkpoint card ("Approve all"), covering the bundle listed below. Source of the questions: `384-RANKING.md` and `384-09-SUMMARY.md`.

## Decisions

1. Findings to fix (Wave 2): S2, S8, S1, S7 and S4. S5 only if the local room class ranks it. Dropped: S6, S9, S10.
2. Floor: 50 ms per event is the smallest saving that matters (Q5b).
3. Isolation check stays strict. No sidecar exception (Q1).
4. The doctor-all limit stays 60 s (Q3).
5. The local real-room copy is the room class that ranks (Q4). The mount class stays NOT MEASURED.
6. The plan 08 re-run after the exit-3 take is accepted as measured (Q6, option a).
7. One short measurement of PostToolUse:Write with the cascade running, before any S2 fix plan (Q7).
8. One counting run over all project folders to replace the assumed session frequency; counts only, labelled development sessions (Q8).
9. Commit fb295a541 (clear the 15 s prewarm timer) comes in as a measured work item (C-A).
10. Commit 23ab77410 only together with its test ce5e4d8b9 (C-B). The 987-line helpers (bc3421a8b) stay on the branch (C-C).
11. The stricter doctor-all gate (Q2, C-D) is decided after its diff is read in Wave 2 planning. Not decided here.
12. Commit review before any push (C-E): review the commits ahead of origin by subject and file list. No push without a separate explicit go.

## Not decided

- Q2 and C-D (stricter gate).
- Pushing, tagging, releasing.
