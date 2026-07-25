---
kind: rca
slug: eureka-fts5-missing-windows-node-sqlite
status: fix-routed
opened: 2026-07-13
routed_to: Phase 219 Wave 1 (FTS5 capability probe + bi-modal degrade)
---

# RCA: eureka crashes on Windows - SQLite "no such module: fts5"

## Symptom

Navigator ran `/mos:eureka` live on the Windows/Desktop machine (Eyal's evacuated-tube freight
room; OPP-01 vacuum load-lock was the selected opportunity). Runner crashed in 11ms - before
the embedding-model download - with SQLite error: `no such module: fts5`.

## Root cause (traced, two-session)

The Eureka tri-modal retrieval (lib/core/eureka/tri-modal-index.cjs) creates/queries an FTS5
virtual table. FTS5 is a compile-time SQLite feature; the `node:sqlite` (DatabaseSync) build on
that Windows Node binary was compiled WITHOUT it. Environment/build gap, not room data. The
Windows-side session independently confirmed via a `:memory:` FTS5 probe. The Linux dev machine
(Node v22.22.2) has FTS5 available, which is why every 218/219 live check passed here - a
single-platform blind spot, exactly the Tri-Polar rule failure class.

## Classification

NEW FAILURE (cross-platform SQLite feature variance). Same defect family as the vec0
load-inference bug fixed by quick 260706-5b7: a capability assumed instead of probed.

## Fix (routed, not applied here)

Phase 219 Wave 1 task (injected into the planner 2026-07-13): FTS5 capability probe at
index-open (attempt `CREATE VIRTUAL TABLE t USING fts5(x)` on `:memory:`, cache verdict);
absent -> skip FTS table creation, degrade tri-modal to bi-modal (vector + graph), provenance
reports `fts_backend: absent (bi-modal degrade)`; never crash. Offline test forces probe-false
path (tests/test-219-fts5-degrade.cjs). Live acceptance: the corepower-isolation validation run
(REQ-7 release gate, that same Windows machine) completes without an fts5 crash.

## Gates before calling it done

- Part 8 boundary: unchanged (probe is local).
- Tri-Polar: verified on Windows via the REQ-7 corepower run.
- Release lockstep: ships inside the Phase 219 version cut.
- Reuse-before-build: clones the 260706-5b7 probe discipline; no new pattern minted.

## Open items

- [ ] Windows session's final environment report (node -v, builtin fts5 probe result) - paste
      into this file when the navigator brings it back.
- [ ] On resolve: move to .planning/debug/resolved/ + knowledge-base.md summary block.
