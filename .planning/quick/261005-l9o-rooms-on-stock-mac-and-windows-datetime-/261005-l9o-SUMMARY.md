---
phase: quick
plan: 261005-l9o
status: complete
completed: 2026-10-05
requirements: [SEED-117, CODE-01, SW-01, SW-02, SW-20, ACT-04, HARNESS-06]
key-files:
  created:
    - tests/test-l9o-rooms-python-floor.cjs
  modified:
    - scripts/room-registry
    - scripts/resolve-room
    - scripts/on-cwd-changed
    - lib/core/room-open.cjs
    - lib/core/navigation/room-birth.cjs
    - lib/core/room-skeleton-scaffold.cjs
    - lib/mcp/tool-router.cjs
    - agents/larry-extended.md
    - commands/rooms.md
    - skills/rooms/SKILL.md
    - scripts/doctor.cjs
    - CHANGELOG.md
commits:
  red: b97c9d5df
  green: 5b42ad733
---

# Quick 261005-l9o: rooms work on stock Mac and Windows (Python 3.9 floor)

Rooms now create and switch under Python 3.9 (`datetime.timezone.utc` at four sites), a failed registry call carries its own stderr and the Python version out to the tester, `birthRoom` can no longer report `ok:true` for a room the registry does not list, and the agent doctrine says to stop and report instead of hand-building a room.

## Root cause

Four Python stanzas called the 3.11-only UTC alias (`room-registry` create and set-active, `resolve-room --adopt`, `on-cwd-changed`). On the macOS default Python 3.9 every write path died with `AttributeError`, while `list`, `get-active` and `read` (no timestamp) kept working, so the room list looked healthy. Two things then hid the failure: `runRegistry` in `room-open.cjs` threw the child's stderr away in a bare catch, and `birthRoom` STEP 4 tolerated a failed registry flip.

## Before / after (before = Phase 0 fixtures at HEAD 52843d875, after = measured on this commit)

| Measure | Before | After |
|---|---|---|
| create / set-active / get-active exit, python 3.12 | 0 / 0 / 0 | 0 / 0 / 0 |
| create / set-active / get-active exit, python 3.9.24 | 1 / 1 / 0 | 0 / 0 / 0 |
| `resolve-room --adopt` under 3.9 | exit 1, no registry | exit 0, registry written (test arm) |
| `on-cwd-changed` under 3.9 | exit 0, registry byte-identical (error swallowed) | `last_opened` restamped (test arm) |
| write-scope recovery chain under 3.9 (HARNESS-06): set-active | exit 1, retry still denied | exit 0 (same script the chain runs) |
| stderr present in the openRoom failure payload | 0 of 2 failing runs | 2 of 2 failing runs (no-python3 PATH, failing-python3 stub); the 3.9 case no longer fails |
| payload keys on `set_active_failed` | ok, reason, room, previous | + stderr, python, status |
| no-python3 failure line | none (bare "command not found", swallowed) | `room-registry: python3 not found on PATH (...install Python 3 or run inside WSL)`, exit 127 |
| `birthRoom` under 3.9: returns / registry lists the room | `ok:true`, registry `{"active": "", "rooms": {}}`, `list` = `[]` (no) | `ok:true`, registry lists it (yes), room.db reads back, governed write ok:true |
| `birthRoom` with a failing registry: result / directory left behind | `ok:true` / yes | `ok:false`, `reason: registry_create_failed:<cause line>`, stderr + python / no |
| `scaffoldRoomSkeleton` result | `ok:true` only | `ok:true, ready:false, room_db:false` |

## Results

- `tests/test-l9o-rooms-python-floor.cjs`: RED on b97c9d5df was 3 passed, 14 failed (R1a, R2 3.9 create and adopt, R3 x3, R4 x3, R5, R6 x2, R7, R9; R1b, R2 control and R8 pass on HEAD by construction). GREEN: 18 passed, 0 failed, 0 skipped (the 3.9 stand-in exists here). Arms: R1a PASS, R1b PASS, R2 py39 create/set-active/get-active PASS, R2 system control PASS, R2 py39 resolve-room --adopt PASS, R2 py39 on-cwd-changed PASS, R3 no python3 PASS, R3 failing python3 PASS, R3 MCP text PASS, R4 birthRoom 3.9 PASS, R4 failing registry rollback PASS, R4 pre-existing dir kept PASS, R5 PASS, R6 doctrine PASS, R6 banner PASS, R7 doctor PASS, R8 dash guard PASS, R9 changelog PASS.
- doctor `python-floor` point: `python3_version: 3.12.3`, `py311_only_api_hits: 0`, ok. `node scripts/doctor.cjs --acceptance --pre-tag --json`: 20/20 points passed.
- Gates, all OK: `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `build-skill-mirrors --check` (113 mirrors), `check-tool-honesty --check`; the commit hook's own sweeps passed; dash guard over added lines: 0.
- `bash tests/run-all-369.sh`: PASS=62 FAIL=1 SKIP=1. The FAIL is `267 zod4 contract (MCPV2-03)`: `tool:brain_write` description diff. Not caused by this task: it passes on a clean archive of HEAD and still passes on that archive with all 13 of this commit's files overlaid; the working tree carries another executor's uncommitted `lib/brain/*`, `lib/mcp/brain-router.cjs`, `lib/core/brain-client.cjs` edits (the Theo path). The SKIP is `installed layout exact floor (TS369-04)`: ENV GAP, no Node 22.18.0 binary and no Docker here.
- Regression sweep: every `tests/` and `lib/` test that names birthRoom, room-registry, scaffoldRoomSkeleton, resolve-room or on-cwd-changed (59 `.cjs` files run, 50 exit 0). The 8 unrelated tests that exit non-zero (the ninth was this task's own test, run before its CHANGELOG line existed) were each re-run on a clean `git archive` of HEAD: `guardian-onstop-reaches-user`, `session-start-triple-injection`, `userpromptsubmit-integration` (and `run-feynman-tests`, same hooks.json cause), `test-234-plugin-root-migrated`, `test-depth2-full-citizen`, `test-tool-router-active-room-misroute` also fail there (pre-existing). `minto-debounce-consumer-census` fails only in the live tree because 13 stale `.claude/worktrees/agent-*` checkouts exist (passes on the archive); unrelated to this change. `lib/core/room-skeleton-scaffold.test.cjs`, `room-auto-create.test.cjs`, the birth, born-wired, sub-room, registry leak guard and rooms-open suites pass.

## Deviations from Plan

1. **[Rule 3] `agents/larry.md` does not exist.** Larry is `agents/larry-extended.md` (the only Larry agent file in git). The doctrine paragraph went there; the R6 arm asserts the sentence on every listed file that exists (3 of 4) and requires at least 3.
2. **[Rule 3] `skills/rooms/SKILL.md` is a generated mirror of `commands/rooms.md`.** It was regenerated with `node scripts/build-skill-mirrors.cjs` (1 file overwritten) rather than hand-edited, so the mirror gate stays green. The `dist/` copies of the rooms skill were not touched (built at release).
3. **[Rule 1] Rollback never deletes a pre-existing directory.** `_bornWiredRollback` does `rm -rf roomDir`; `birthRoom` accepts an existing directory, so a registry hiccup would have deleted a user's folder. New `_rollbackFailedBirth` records whether the directory existed before the mkdir: created by this call means full teardown (`rolled_back: directory_removed`), pre-existing means only the db handle and registry key are unwound (`rolled_back: registry_only`). Covered by its own R4 arm.
4. **Failure reason uses the cause line, not the first stderr line.** For a Python traceback the first line is just `Traceback ...`; the reason is `registry_create_failed:<last non-note stderr line>` (the exception line), with the 3-line tail in `stderr`. Same prefix the plan and `autoCreatePlaceholderRoom` use.
5. **`runRegistry` contract changed deliberately.** It returned `string|null`; it now returns `{ok, out, stderr, status, python}`. It is module-private with exactly two callers (`getActive`, `openRoom`), both adapted so no dead `null` check remains. `pythonVersion` and `stderrTail` are exported for `room-birth.cjs`. It now uses `spawnSync` instead of `execFileSync` to capture stderr on success and failure.
6. **Extra: `room-registry` prints an exit note on failure** (`room-registry: exited N; python3 is <version>`), implementing the plan's "print the resolved python3 --version on failure paths only" via an EXIT trap; silent on exit 0.
7. **`on-cwd-changed` runtime arm added** (not in the plan's R2): in a legacy workspace registry it restamps `last_opened` under 3.9 (red on HEAD because the error was swallowed by `|| true`).
8. **doctor point shape.** The plan said "id contains python-floor" via `--json`; the doctor registers acceptance points, so R7 drives `--acceptance --pre-tag --json` with the existing `DOCTOR_TEST_MODE`/`DOCTOR_TEST_ONLY_POINTS` seam. The point is `applies_to: [pre-tag, full]`, FAIL on any 3.11-only API hit, WARN (ok with a finding) when python3 is missing or below 3.9.
9. **R8 dash guard** checks the test file, the new doctrine lines and the new CHANGELOG line (existing files carry older text that predates this task); a diff-based guard over all added lines was run separately: 0 hits.

## Process incident (mine)

During the work I ran a stray `git checkout -q HEAD~0 --` in the shared tree (inside a larger command, meant as a no-op). It detached HEAD at 19fb0a720; the orchestrator re-attached to main at f6f655024 with the working tree and index untouched. Verified afterwards: HEAD on `refs/heads/main`, my working-tree edits intact, nothing lost. No other `checkout`, `stash`, `reset` or `restore` was run.

## Not done / limits

- On-cwd-changed and the other `.cmd`-free Windows paths were not exercised on a real Windows host; "no python3" is simulated with a PATH that has everything in `/usr/bin` except python. CI still has 0 Python 3.9 legs (ACT-02, out of scope).
- Out of scope per the fence and untouched: the Node rewrite of the three Python scripts, making MCP `rooms-new` execute, Windows `.cmd` plumbing, Accept.
- `installed layout exact floor (TS369-04)` skipped (no Node 22.18.0 / Docker on this machine).

## Self-Check: PASSED

Commits b97c9d5df and 5b42ad733 exist on main; `tests/test-l9o-rooms-python-floor.cjs` runs 18/18 on HEAD.
