# tests/fixtures/icm-rooms

Phase 353 fixture rooms for the room-map, doctor room-map, sub-room birth, and
self-location legs. A NEW sibling of `tests/fixtures/195-nested-room-tree/`,
never an edit of it: `tests/test-195-recursive-reconcile.cjs:172` asserts an
exact `files.length === 16` against that tree, so a new file added there
would break an unrelated phase.

## Hard rule: --fix only ever runs here

`doctor room-map --fix` (and any future `doctor section-ruling --fix`) is
scoped, for this phase's own test suite, to paths under
`tests/fixtures/icm-rooms/` only. No test in this phase may invoke a fixer
against `~/MindrianRooms` or any other real room. See
`lib/core/doctor/room-map-module.cjs`'s `recoverable: false` guard, which
enforces the same rule at runtime, not just by test-author convention.

## Committed-tree compromise: the pre-commit Data Room invariant

`scripts/hooks/pre-commit-room-minto-guard.sh` (Canon decision 15) refuses
ANY commit that stages a file inside a `.room-root`-marked directory unless
that exact directory carries both `ROOM.md` and `MINTO.md`, with NO
exception for an artifact folder (Key Decision 16) or a deliberately-missing
root identity file. That means the two "missing" scenarios this phase's
tests need (a root with no `ROOM.md`, an artifact folder with no `ROOM.md`)
cannot be PERSISTED in this git-tracked fixture tree; the hook would refuse
the commit outright.

Every directory below therefore carries both `ROOM.md` and `MINTO.md`
(satisfying the hook), and the two "missing" scenarios are exercised at
TEST RUNTIME instead: the relevant test copies the fixture room into a
temp directory (`os.tmpdir()`), deletes the file under test, and asserts
against the copy. This is the same "copy under `os.tmpdir()`, never test
against the fixture in place" idiom Task 4's doctor tests already require.

## Case index

### `alpha-room/`

A well-formed room, one root, three sections, one structural directory, one
Key-Decision-16-shaped nested-artifact folder, one declared sub-room.

- `.room-root` -- root sentinel.
- `ROOM.md` -- root identity vocabulary (`directory_type`, `icm_layer`,
  `auto_scaffolded`, `purpose`).
- `STATE.md`, `MINTO.md`, `USER.md` -- minimal memory complement.
- `problem-definition/`, `market-analysis/`, `business-model/` -- three
  sections, each with a section-vocabulary `ROOM.md` (`section`, real
  `statement:`, `purpose`, `stage_relevance`, `default_methodologies`,
  `icm_layer`, `auto_scaffolded`) and a `MINTO.md`.
- `problem-definition/first-cut/first-cut.md` -- a Key-Decision-16-shaped
  nested artifact (the artifact sits in its own subfolder). Carries a
  placeholder `ROOM.md` + `MINTO.md` ONLY to satisfy the pre-commit
  invariant above; `room-map.cjs` classifies this folder as `kind:
  'artifact'` structurally (nested under a section, not itself a section,
  structural dir, or sub-room), never by ROOM.md presence. Tests that need
  a TRUE artifact-folder-with-no-ROOM.md delete this file from a tmpdir
  copy first.
- `meetings/` -- one structural directory (`STRUCTURAL_DIRS`), with its own
  identity-vocabulary `ROOM.md` + `MINTO.md`.
- `sub-rooms/beta-sub/` -- one declared sub-room: `.room-root` plus a
  `ROOM.md` that DECLARES `job_id: find-problem` (the declared-at-birth
  case, D-353-5) plus `MINTO.md`.

### `gamma-room/`

The single-section and undeclared-job cases.

- `.room-root` -- root sentinel.
- `ROOM.md` + `MINTO.md` -- present (see the compromise note above: the
  "missing root ROOM.md, created from the identity template" scenario Task
  3 needs is exercised by copying this room to a tmpdir and deleting
  `ROOM.md` there, never by omitting it from the committed tree).
- `solution-design/` -- one section whose `ROOM.md` + `MINTO.md` already
  exist.
- `sub-rooms/delta-sub/` -- one undeclared sub-room: `.room-root` plus a
  `ROOM.md` carrying NO `job_id` (the parent-fallback, doctor-flagged case,
  D-353-5) plus `MINTO.md`.

## Sentinel count

`find tests/fixtures/icm-rooms -name .room-root | wc -l` is 4: `alpha-room`,
`alpha-room/sub-rooms/beta-sub`, `gamma-room`, `gamma-room/sub-rooms/delta-sub`.

Every file here is small, authored prose, hyphens only (no em-dashes).
