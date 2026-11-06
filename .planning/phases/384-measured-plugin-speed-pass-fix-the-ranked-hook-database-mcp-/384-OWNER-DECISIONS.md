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

## Later decisions (owner card answers)

13. 2026-11-06, Q2 and C-D: SPLIT. Take now: name the doctor-all timeout, and fail the point on an unreadable result. Take later, after the registry entries with missing folders are cleaned up behind a gate card: the drift count. The 60 s limit stays.
14. 2026-11-06, Phase 387 option A (Eureka): adopt an engine checkout the person already has, never fetch or ship it, check uv and Python without installing them, one optional setup step behind a card, then every engine run offline, all 23 tools stay listed with typed refusals. The licence of the engine repo stays an open owner item.
15. 2026-11-06, Phase 386: the owner confirmed the PRD section "Accepted hardening and measurement status" (lazy folder-memory import as Part 8 hardening, S3 not measured, credential-only PreToolUse for WebSearch, WebFetch and Tavily). Also: extend the 2026-10-05 web-line ruling to Semantic Scholar, grants.gov and research-speaker (recorded in 386-PRD.md).

## Not decided

- Pushing, tagging, releasing.
- C-B: whether to land commit 23ab77410 (plan 384-18 stops at a checkpoint with numbers).
