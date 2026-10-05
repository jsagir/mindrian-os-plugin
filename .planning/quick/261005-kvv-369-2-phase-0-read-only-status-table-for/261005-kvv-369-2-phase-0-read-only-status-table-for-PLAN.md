---
phase: quick
plan: 261005-kvv
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/369.2-research-searches-online-for-real/369.2-PHASE0-STATUS.md
  - .planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/**
autonomous: true
planner: orchestrator-authored (navigator budget ruling 2026-10-04 precedent; Phase 0 is reading, not building)
must_haves:
  truths:
    - "Every failure id in the 369.2 brief (CODE-01..10, HARNESS-01..12, AI-01..10, UI-01..06), the register (SW-01..22, ACT, OK, REV), SEED-120 (BUG-01, BUG-02, UX-01, UX-02, REC-01) and the critical path's J1/J2 items has exactly one row with a status from the closed set: reproduced, fixed, obsolete, needs evidence"
    - "Every reproduced or fixed row cites a command that was actually run against HEAD and a fixture file holding its raw output; every needs-evidence row names the evidence that would decide it"
    - "No tracked file outside .planning/ is modified; no room under ~/MindrianRooms and no live registry (~/.mindrian) is touched; every reproduction runs under an isolated HOME"
    - "Line numbers are re-measured on HEAD, never copied from the reports"
---

# Quick 261005-kvv: 369.2 Phase 0, inspect and reproduce (read-only status table)

## Why

The critical path (section 6) and the brief (Phase 0) both say: before any fix is claimed, every failure id gets a status against the current tree, with raw outputs kept as fixtures. The reports were written on beta.43, beta.55 and beta.57; HEAD is 2.0.0-beta.58 (in progress). Some sites moved already (the four `datetime.UTC` sites are now `scripts/room-registry:389`, `:614`, `scripts/resolve-room:157`, `scripts/on-cwd-changed:97`; the city fence lives in `lib/core/cross-room-aggregator.cjs`, not `lib/workflow/`).

## Status vocabulary (closed)

- `reproduced`: a command run against HEAD exhibits the failure; the raw output is in the fixture.
- `fixed`: HEAD carries the change AND a run or test on HEAD shows the symptom gone; cite the commit when `git log -S` finds it.
- `obsolete`: the reported file, symbol or mechanism no longer exists on HEAD, so the failure cannot occur as reported.
- `needs evidence`: the tree alone cannot reproduce or refute it (needs a live session, a provider key, a second OS, a human, or data not on this machine); the row names what would decide it.

## Tasks

### Task 1 (wave 1, four parallel read-only investigators; no commits)

Each investigator reads `261005-kvv-INVESTIGATOR-CONTRACT.md` in this directory and produces `fixtures/phase0/partial-<family>.md` plus one fixture directory per id.

- Family A (rooms, install, key gate): CODE-01, SW-01, SW-02, SW-15, SW-20, SW-21, ACT-01..04, REV-03, REV-05, HARNESS-06, J1 (Desktop payload paths, marketplace sync), J2 (no key on the Theo path: `MINDRIAN_BRAIN_KEY`, bearer, Tier 0, `no_key`; the legacy `pws-brain-mcp` connector).
- Family B (research composition and execution truth): CODE-02..06, CODE-09, SW-13, SW-14, SW-16, HARNESS-01, HARNESS-02, HARNESS-03, HARNESS-09, HARNESS-10, ACT-05..08, ACT-10, ACT-12, REV-01, REV-02, REV-04, REV-06, OK-02, OK-03, OK-05, OK-06.
- Family C (Theo policy, graph, judge, analogies): CODE-07, CODE-08, CODE-10, SW-10, SW-17, SW-18, SW-19, SW-22, HARNESS-04, ACT-09, ACT-11, J4 (the 37-token freeform guard; the city fence; three verbs disagree).
- Family D (harness state, UI, AI behavior): HARNESS-05, HARNESS-07, HARNESS-08, HARNESS-11, HARNESS-12, UI-01..06, BUG-01, BUG-02, UX-01, UX-02, REC-01, AI-01..10, OK-01, OK-04.

### Task 2 (wave 2, one executor)

Assemble `369.2-PHASE0-STATUS.md` from the four partials: one table, every id once, sorted by family then id; a counts line (reproduced / fixed / obsolete / needs evidence); a "sites that moved" list; a "what Phase 0 could not do on this machine" list. Verify every fixture path cited exists and is non-empty. Commit with `git add -f` on the status file and the fixtures directory and `git commit --only -- <paths>`; write the SUMMARY.md.

## Verification

- `grep -c '^| ' 369.2-PHASE0-STATUS.md` equals the id count stated in the counts line plus header rows.
- Every `fixtures/phase0/<ID>/` cited exists and holds at least one non-empty file.
- `git status --short` shows nothing outside `.planning/`.
