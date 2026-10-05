---
phase: quick
plan: 261005-kvv
status: complete
completed: 2026-10-05
key-files:
  created:
    - .planning/phases/369.2-research-searches-online-for-real/369.2-PHASE0-STATUS.md
    - .planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/
commit: d2373dad8
---

# Quick 261005-kvv: 369.2 Phase 0 read-only status table

Counts, Table 1 (68 ids): by status, reproduced 54, fixed 0, obsolete 0, needs evidence 14. By family, CODE 10 (10 reproduced), HARNESS 12 (12 reproduced), AI 10 (10 needs evidence), UI 6 (5 reproduced, 1 needs evidence), SW 22 (20 reproduced, 2 needs evidence), BUG 2 (1 reproduced, 1 needs evidence), UX 2 (2 reproduced), REC 1 (1 reproduced), J 3 (3 reproduced).

Counts, Table 2 (24 ids): ACT 12 (12 open, 0 done), OK 6 (6 intact, 0 broken), REV 6 (2 settled, 4 needs evidence).

Corrections to the reports:

1. Guard vocabulary: 48 tokens (reports said 37).
2. City fence: one regex with 8 alternatives in `lib/core/cross-room-aggregator.cjs:118`; it still applies on the web lines.
3. Desktop copy: 53 bad paths (52 bracket, 2 `@`, 1 both); reports said 48 + 2.
4. The four `datetime.UTC` sites: room-registry:389 and :614 (reports said 296 and 515), plus resolve-room:157 and on-cwd-changed:97.
5. CODE-08 reproduces only on a legacy-shape db; a fresh `openRoomDb` has no foreign key (D-169-11).
6. The no-key path silently registers an install token via `POST /register` and then gets Theo (28,139 nodes); the Tier 0 refusal appears only when registration is disabled or offline.
7. `birthRoom` on Python 3.9 returns `ok:true, db_created:true` with an empty registry (the "Tolerate" catch near room-birth.cjs:1261); `scaffoldRoomSkeleton` is the route that returns `ok:true` with no room.db.
8. The shell has no control labelled "Accept" and its gate action passes 18/18 e2e arms; the plugin has no transcript export at all (0 of 6 fields).
