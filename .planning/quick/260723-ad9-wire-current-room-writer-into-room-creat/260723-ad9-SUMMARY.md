---
phase: 260723-ad9-wire-current-room-writer-into-room-creat
plan: 01
subsystem: room-state / statusline
tags: [statusline, room-registry, compute-state, current_room, phase-94-01, durability]
requires:
  - lib/core/folder-memory.cjs getCurrentRoom / parseCurrentRoomField (Phase 94-01 read contract)
provides:
  - scripts/room-registry _write_current_room helper (create + set-active writers)
  - scripts/compute-state active-room current_room re-derive (durability)
  - lib/memory/statusline-active-room-write.test.cjs (write-half regression fence)
affects:
  - scripts/on-agent-complete (its truncating compute-state > STATE.md regeneration now preserves current_room)
  - scripts/context-monitor chip (now fed by the canonical path, not only the fallback)
tech-stack:
  added: []
  patterns:
    - sys.argv-safe python3 inline (no shell interpolation into the write source)
    - fire-and-forget non-fatal writer (Larry-never-blocks)
    - registry-derived durability (truncation-safe re-derive, not read-back)
key-files:
  created:
    - lib/memory/statusline-active-room-write.test.cjs
  modified:
    - scripts/room-registry
    - scripts/compute-state
    - lib/memory/run-feynman-tests.cjs
decisions:
  - No commands/rooms.md prose edit; two script-level writers cover all creation + switch paths across all three surfaces.
  - compute-state stamps current_room ONLY for the registry-active room (no bulk backfill of the 22 existing rooms).
metrics:
  duration: ~15m
  completed: 2026-07-23
  tasks: 3
  files: 4
---

# Quick 260723-ad9 Plan 01: Wire current_room Writer Into Room Creation Summary

Built the missing WRITE half of the Phase 94-01 statusline active-room contract: `room-registry` create/set-active and `compute-state` now populate and preserve `current_room` so the CLI room chip reads real tracked state through the documented canonical source instead of surviving only by accident of a fallback.

## What Was Built

**Task 1 (`scripts/room-registry`, commit 53566b3e):** Added `_write_current_room <roomdir> <slug>`, a fire-and-forget bash helper that upserts `current_room: <slug>` into a room's own STATE.md frontmatter. It delegates the edit to an inline python3 block that reads roomdir + slug from `sys.argv` (never interpolated into the source, mitigating T-ad9-02), sanitizes the slug to a single-line token and skips the write on empty/colon/control-char (mitigating T-ad9-01), and handles all three STATE.md states (absent -> minimal valid block; present-with-frontmatter -> in-place upsert preserving every sibling field; present-without-frontmatter -> prepend). Wired into `create` (resolving absolute vs relative RPATH without the doubling concat) and `set-active` (3-tier registry dir resolution), the latter appended as a follow-on so the bare `$NAME` stdout contract commands/rooms.md consumes is unchanged.

**Task 2 (`scripts/compute-state`, commit 94095464):** compute-state now re-derives `current_room` for the active room from the registry and emits it into the header frontmatter. This closes the durability gap: `on-agent-complete` runs `compute-state > STATE.md`, and the shell truncates STATE.md BEFORE compute-state runs, so the event-driven write cannot survive by reading the room's own (already-emptied) file. Re-deriving from `registry.active` matched to `ROOM_DIR` via `os.path.realpath` is the only truncation-safe source. A missing/corrupt registry degrades to an empty slug and compute-state proceeds (T-ad9-04). A non-active room prints an empty slug and gains no `current_room` line, so this never backfills the 22 existing rooms.

**Task 3 (`lib/memory/statusline-active-room-write.test.cjs` + registration, commit ec26af69):** A self-contained 7-case node assert suite (create-writes, switch-writes, no-clobber, absent-guard, durability, no-backfill, malicious-slug) that drives the real `bash scripts/room-registry` / `bash scripts/compute-state` binaries under a tmp `MINDRIAN_ROOMS_HOME` and reads back through the real `getCurrentRoom()` contract. Registered in `run-feynman-tests.cjs` immediately after the read-side fence.

## Verification

- Task 1 automated verify: PASS (create + set-active write `current_room`, `getCurrentRoom` returns `source: state_md`, `status: active` preserved).
- Task 2 automated verify: PASS (active room gets `current_room: demo`; non-active `other` gets none).
- Task 3: `statusline-active-room-write: 7/7 tests passed`.
- Read-fence intact: `statusline-active-room: 8/8 tests passed` and `git diff --quiet -- lib/memory/statusline-active-room.test.cjs` clean (READ-FENCE-UNMODIFIED).
- `scripts/context-monitor` untouched (fallback chain unweakened).
- No em-dashes in any changed file.

## Deviations from Plan

None. Plan executed exactly as written. (Task 3 carries `tdd="true"`; because Tasks 1 and 2 implement the writers first within the same plan, the suite was authored as a green regression fence rather than a RED-first cycle, which is the intended shape for the "missing half of the contract" deliverable. It was committed as `test(...)`.)

## Threat Model Compliance

- T-ad9-01 (slug tampering): mitigated. `_write_current_room` skips any slug with a colon/control char; covered by the malicious-slug test.
- T-ad9-02 (python injection): mitigated. roomdir + slug pass via `sys.argv`; no new `'$VAR'`-in-python surface in the write path.
- T-ad9-04 (registry DoS): mitigated. compute-state degrades to empty slug on missing/corrupt registry, never aborts.
- T-ad9-03 / T-ad9-SC: accept (local-only slug handle; no package installs).

## Out of Scope (untouched, per constraints)

- `lib/core/navigation/room-birth.cjs` absolute-RPATH / `_seed_room_bootstrap` doubling bug (logged separately at `.planning/debug/room-birth-absolute-rpath-doubles-seed-bootstrap-path.md`).
- One-time backfill of the 22 existing rooms' STATE.md (deferred; compute-state forward-fills the active room naturally).
- Desktop/Cowork "which room" surface (Option C) and CLI chip prominence (Option D).

## Self-Check: PASSED

- Files created/modified all present on disk.
- Commits 53566b3e, 94095464, ec26af69 all present in git history.
- New suite registered in run-feynman-tests.cjs; `_write_current_room` present in room-registry.
