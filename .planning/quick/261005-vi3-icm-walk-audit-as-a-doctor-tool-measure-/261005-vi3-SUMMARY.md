---
phase: quick
plan: 261005-vi3
status: complete
completed: 2026-10-05
subsystem: doctor
tags: [doctor, icm, measurement, feyminto, icm-walk]
requirements: [navigator-ruling-2026-10-05-icm-tool]
key-files:
  created:
    - lib/core/doctor/icm-walk-module.cjs
    - tests/test-vi3-icm-walk.cjs
  modified:
    - scripts/doctor.cjs
    - commands/doctor.md
    - skills/doctor/SKILL.md
commits:
  red: d30eb4592
  green: 0dd6e5037
---

# Quick 261005-vi3: the ICM walk as a doctor tool (measurement first)

`node scripts/doctor.cjs --icm-walk [--room <dir>] [--json]` walks a room root and every nest and prints measured values for the ten ICM invariants and the walk test. It writes nothing, fixes nothing and sends nothing. It is the FEYMINTO-ICM-AUDIT.md audit turned into a tool, so the FeyMinto change (Phase 369.3a) can be measured before and after.

## What was built

- `lib/core/doctor/icm-walk-module.cjs` (pure CJS, node built-ins, gray-matter as the frontmatter reader). Exports `walkRoom`, `renderText`, `resolveRoomDir`. No `check` and no `fix` export on purpose: it is a sibling mode, not a registry module, so it never joins the drift tally or `--fix`.
- `scripts/doctor.cjs`: `--icm-walk` plus `--room <dir>` (space or `=` form), dispatched at the top of `main()` like `--bind-check`, not in `--all`, not a class flag. `--room` defaults to the registry's active room (the room-md module's own resolution). Exit 0 after printing; an unresolvable room is the one non-zero (exit 1, reason on stderr).
- `commands/doctor.md`: argument-hint, the flag line, and a five-bullet "what it measures" section. `skills/doctor/SKILL.md` regenerated with `build-skill-mirrors`.
- `tests/test-vi3-icm-walk.cjs`: 20 arms against two rooms, every literal measured by a shell command first (the command is in a comment above each table).

## Arms (tests/test-vi3-icm-walk.cjs)

RED (d30eb4592, committed alone): 1 passed (M5, by construction), 19 failed (module absent). GREEN (0dd6e5037): 20 passed, 0 failed, run three times.

| Arm | Result |
|---|---|
| W0 root + 14 nests, root first, sorted, dot dirs skipped, both rooms | PASS |
| I1 ROOM.md present, purpose or heading, CONTEXT job_id (all 15 blocks of room a) | PASS |
| I2 lines, bytes, wikilinks, over-60 flag (15-row table, room b incl. a 65-line ROOM.md) | PASS |
| I4 four ICM parts, three ruling sections, generated_at; missing CONTEXT reads null, not scored | PASS |
| I5 generated-marked vs authored per nest (15-row table + room b) | PASS |
| I6 per face present / edit-surface marker / placeholder (marker true only on room b A MINTO and A FEYNMAN) | PASS |
| I7 bytes, tokens, 8000 flag (room b B = 9546 tokens), FEYNMAN body vs 1500 (room b A = 1600) | PASS |
| I8a sources vs ROOM.md wikilinks (3 sources, 2 duplicate, 1 absent; alias, anchor and .md normalised) | PASS |
| I8b MINTO room, room.db, Room node, identity rows, agreement (room a: 7 rows, 0 naming, no node; room b: 8 / 1 / yes) | PASS |
| I8c BRAIN.md, brain_query_count, section-2 command names, restated (A: 3 names, 2 restated) | PASS |
| I9 STATE.md, last activity vs newest mtime (stale), research-run counts (room a 4/4/0/0) | PASS |
| I10 auto_scaffolded and seeded-at-birth counts | PASS |
| W reads to orient, routes, status scannable, referrers (equals a grep at test time, floored at 63/127/22) | PASS |
| M1 tree hash of both rooms, both rooms homes and HOME equal before and after (module and CLI); no `-shm`/`-wal` left in a quiet room | PASS |
| M2 `--json` parses, 15 blocks, every row in every block | PASS |
| M3 summary names duplicates and identity (room a: 1 of 3; room b: 2 of 3) | PASS |
| M4 copy of room b with no `.mindrian`: `room.db: missing`, files still walked, CLI exit 0 | PASS |
| M5 dash guard (new files + the icm-walk lines of doctor.cjs and doctor.md) | PASS |
| M6 CLI on room a: exit 0, one `== room root` block, 14 `== nest:` blocks sorted, summary last, 15 rows per label, no verdict word | PASS |
| M7 source check: reads room.db only through `openRoomDbReadOnlyForCaller` (no node:sqlite, no room-db.cjs, no write door) | PASS |

## Measured: the fixture room (release-fixture-09554f26, born offline by `real-room-run --offline`)

room.db present; Room node: no; identity rows: 7 total, 0 naming the room (expected: the identity table holds only migration sentinels); research runs 4 (plan.json 4, run.json 0, operations.json 0); referrers (lib, scripts, hooks naming the face file) MINTO.md 128, FEYNMAN.md 23, BRAIN.md 64 (63 / 127 / 22 before this quick, plus the tool's own files).

Summary block: nests walked 14, nests with every face 0, MINTO sources also in ROOM.md links 0, Theo face restating CONTEXT sequence 0, room identity in room.db no, edit-surface marker absent 12 of 12 face files, duplications found 1 of 3 (the identity one).

| nest | I2 lines/bytes/links | job_id | I5 md/gen/auth | faces M F B | I7 bytes/tokens | I8c names in CONTEXT s2 | STATE.md | W reads |
|---|---|---|---|---|---|---|---|---|
| . (root) | 35/1042/0 | none | 4/1/3 | y - - | 1775/444 | n/a | present | 1 |
| assets | 21/709/0 | none | 1/1/0 | - - - | 709/178 | n/a | missing | 1 |
| business-model | 44/1467/0 | model-business | 3/2/1 | - y - | 5914/1479 | 3 | missing | 2 |
| competitive-analysis | 44/1492/0 | understand-market | 4/2/2 | - y - | 5927/1482 | 6 | missing | 2 |
| financial-model | 44/1420/0 | model-finances | 3/2/1 | - y - | 5080/1270 | 3 | missing | 2 |
| funding | 44/1526/0 | plan-execution | 3/2/1 | - y - | 7255/1814 | 3 | missing | 2 |
| legal-ip | 44/1429/0 | protect-assets | 3/2/1 | - y - | 5024/1256 | 1 | missing | 2 |
| market-analysis | 44/1477/0 | understand-market | 4/2/2 | - y - | 5869/1468 | 3 | missing | 2 |
| opportunity-bank | 44/1523/0 | explore | 3/2/1 | - y - | 7607/1902 | 3 | missing | 2 |
| problem-definition | 44/1507/0 | find-problem | 4/2/2 | - y - | 6301/1576 | 3 | missing | 2 |
| references | 21/1031/0 | none | 3/1/2 | - - - | 1031/258 | n/a | missing | 1 |
| solution-design | 44/1474/0 | design-solution | 4/2/2 | - y - | 6423/1606 | 3 | missing | 2 |
| strategy | 44/1574/0 | find-bottleneck | 4/2/2 | - y - | 7075/1769 | 6 | missing | 2 |
| team | 21/681/0 | none | 1/1/0 | - - - | 681/171 | n/a | missing | 1 |
| team-execution | 44/1415/0 | plan-execution | 3/2/1 | - y - | 6055/1514 | 3 | missing | 2 |

Other fixture facts, every one measured: no nest has MINTO.md or BRAIN.md (only the root has a MINTO.md, with no `sources:` or `room:` key); every CONTEXT.md carries the four ICM parts, the three ruling sections and `generated_at`; no ROOM.md has a wikilink (so ROOM.md routes: no everywhere); no ROOM.md is over 60 lines; no block is over 8000 tokens; every FEYNMAN.md body is 25 to 31 tokens (the seeded-at-birth line).

## Measured: the navigator's live room (egain-des-liquid-conductor, read only)

Read with `--room ~/MindrianRooms/egain-des-liquid-conductor`; its `room.db`, `room.db-shm` and `room.db-wal` listing was byte-for-byte the same before and after (14442496 / 32768 / 0). The room is being written by other sessions, so these are the values at 23:00 on 2026-10-05.

room.db present; Room node: no; identity rows 7 total, 0 naming the room; research runs 4 (plan.json 4, run.json 1, operations.json 0).

Summary block: nests walked 8, nests with every face 2, MINTO sources also in ROOM.md links 8, Theo face restating CONTEXT sequence 0, room identity in room.db no, edit-surface marker absent 10 of 10 face files, duplications found 2 of 3.

| nest | I2 lines/bytes/links | job_id | faces M F B | MINTO sources / also in ROOM.md | I7 bytes/tokens | W reads |
|---|---|---|---|---|---|---|
| . (root) | 26/851/0 | none | y - - | 0 / 0 | 1584/396 | 1 |
| assets | 34/958/0 | none | - - - | n/a | 958/240 | 1 |
| assumptions | 31/727/1 | none | - - - | n/a | 727/182 | 1 |
| competitive-analysis | 31/696/1 | none | y - - | 1 / 1 | 4050/1013 | 1 |
| opportunity-bank | 61/2002/5 (over 60 lines) | explore | y y y | 1 / 1 | 12095/3024 | 2 |
| problem-definition | 62/2014/5 (over 60 lines) | find-problem | y y y | 2 / 2 | 11304/2826 | 2 |
| references | 35/1310/2 | none | - - - | n/a | 1310/328 | 1 |
| solution-design | 34/1032/4 | none | y - - | 4 / 4 | 5719/1430 | 1 |
| team | 34/930/0 | none | y - - | 0 / 0 | 3803/951 | 1 |

The audit's three duplications, measured on the live room: MINTO `sources:` relisting ROOM.md links, 8 entries across 4 nests (problem-definition 2 of 2, solution-design 4 of 4, opportunity-bank 1 of 1, competitive-analysis 1 of 1), none absent from ROOM.md; room identity by slug with no Room node and 0 identity rows naming the room; the Theo face restating CONTEXT.md section 2: 0 command names (the live BRAIN.md files read `(no signal)` with `brain_query_count: 0`, so the duplication the design forbids is not yet present). The edit-surface marker (`editable_fields`, `edit_surface` or `human_edited`) is absent from all 10 face files; `governing_thought_placeholder: true` on the 5 MINTO.md files that carry the key. FEYNMAN body: 168 and 169 of 1500 tokens. Only 2 nests have a CONTEXT.md on this room today (opportunity-bank, problem-definition).

## Gates

- `node tests/test-vi3-icm-walk.cjs`: 20/20 (three consecutive runs).
- `node tests/test-doctor-acceptance-self-coverage.cjs`: 6/6.
- `node scripts/doctor.cjs --acceptance --pre-tag`: 21/21 points passed (real-room-run carries its existing WARN: latest receipt is behind HEAD).
- `node tests/test-doctor-module-contract-parity.cjs`: ALL PASS.
- `node scripts/build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`: exit 0 each.
- `node scripts/build-skill-mirrors.cjs --check`: OK (113 mirrors). `node scripts/check-tool-honesty.cjs --check`: exit 0.
- Dash guard over every line the two commits added: 0 hits.
- `class-m-brain-smoke.test.cjs` not run: `shared.cjs` was not touched.

## Deviations from Plan

**1. [Rule 2 - correctness] room.db is opened on a throwaway copy, not in place.** The plan said "read-only open through the navigation read door". Measured while writing the tool: opening a WAL-mode `room.db` in place through `openRoomDbReadOnlyForCaller` (mode=ro) creates `room.db-shm` and `room.db-wal` beside it when they are absent (a tree hash of a freshly built room changed). That breaks "writes nothing to any room". The module copies `room.db` (plus `-wal` and `-shm` when present) into a temp directory under `os.tmpdir()`, opens the copy through the same navigation read door, and deletes the copy. M1 pins it (tree hash equal, no `-shm`/`-wal` in a quiet room). Cost: one file copy per run (14 MB on the live room, well under a second).

**2. [Rule 3] `--room` is parsed as a doctor flag.** The plan said `--room <dir>` "reuses the doctor's existing room resolution"; doctor had no `--room` flag. It is parsed with the `--bind-check` idiom (space or `=` form), and with no value falls back to the registry's active room, the resolution the class-E check uses.

**3. [Rule 3] `build-skill-mirrors --help` ran the build.** The script has no help flag; the call regenerated mirrors. Only `skills/doctor/SKILL.md` differed (the intended change); `git status` confirmed nothing else moved.

## Known pre-existing red (not caused by this task)

- `node tests/test-doctor-doc-parity.cjs` fails on exactly one violation: `flag --none is documented in commands/doctor.md but NOT parsed by doctor.cjs`. The token comes from the frontmatter line `interactive_first_reward: "--none (diagnostic surface)"` (Phase 267.3-04). Identical failure on a `git archive` of HEAD before this quick (checked); this quick adds no new violation (`--icm-walk` and `--room` are both documented and parsed). Fixing it means an allowlist entry or rewording that frontmatter line, outside this task's files.

## Limits

- Tokens are bytes divided by four, rounded up, as the plan says; there is no tokenizer.
- A nest is a non-dot folder holding a `ROOM.md` or a `CONTEXT.md`; an artifact folder with neither is not a nest and its files count toward the nearest enclosing nest.
- `status scannable` is "STATE.md present" and `stale` needs a recognised timestamp key in STATE.md (`computed`, `computed_at`, `last_updated_at`, `auto_created_at`, `last_activity`); a STATE.md with none reads `last activity n/a`, never stale (opportunity-bank on the live room).
- The referrer counts read `lib/`, `scripts/` and `hooks/` as files, like `grep -rIl`; the tool and its test add themselves to that count.
- Node prints its SQLite `ExperimentalWarning` on stderr when a room.db is read; stdout is unaffected.
- Not done on purpose: no CHANGELOG line (the peer executor holds CHANGELOG.md; the orchestrator adds it at the beta.61 close), no STATE.md or ROADMAP.md writes (a peer is live in the tree).

## Self-Check: PASSED

Commits d30eb4592 and 0dd6e5037 are ancestors of HEAD; `lib/core/doctor/icm-walk-module.cjs` and `tests/test-vi3-icm-walk.cjs` exist; the test runs 20/20 at HEAD.
