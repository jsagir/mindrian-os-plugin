# 404-05 Part A Summary

## OR-47

1. A top professional checks the method against its primary source, defines observable pass conditions, isolates the write, and preserves evidence for review.
2. The raw material is the approved method source, the tool contract, the fixture room, the artifact file, and the room database.
3. The method uses the approved plan, the MCP wire helper, the fixture room helper, a temporary environment, and direct file and database checks.
4. Outside evidence is the test output, the file on disk, the artifact node in room.db, and the server reply after replay.

## Task 0

### Step 0: base

- STAGE: `4314d335ad4e40b87797623f6ebed1ddbaa8b821`.
- BASE: `d393c938a3fdedfbdee25761be558846be80e0ea`.
- STAGE ancestry of the lane branch: PASS, supplied by the task facts.
- STAGE ancestry of HEAD: PASS, checked in this run.
- HEAD equals BASE: PASS, checked in this run.
- Tracked tree clean before edits: PASS, checked in this run.
- Boundary marker `tests/run-all-261127-bnd.sh`: on HEAD, supplied by the task facts.
- Card-fire marker `tests/test-402-card-fire-envelope.cjs`: on HEAD, supplied by the task facts.
- F1 markers `scripts/check-tool-grants.cjs` and `data/tool-grants.json`: on HEAD, supplied by the task facts.

### Step 1: Part A need

- `lib/mcp/tools/views.cjs` contains `artifact_file`: PROVEN by the task facts.
- The `artifact_file` schema has no `client_write_id`: PROVEN by the task facts.

### Step 3: baseline

- `bash tests/run-all-404.sh`: `PASS=73 FAIL=0`, supplied by the task facts.
- Known base reds are listed in the task brief. They are not changed here.

### Step 4: answers and values

- OR-47 answers are recorded above before the first code edit.
- The Part A switch is `MINDRIAN_404_K1_FORCE`.
- The output behavior for a stale owner recovery path is not present on this base. The test checks the specified `replayed` receipt. Confirm the alternate path with the reviewer if it occurs.

## Commit list

- `tests/test-404-stop-replay.cjs`

## Part A Report

STATUS: DONE
CHANGED: `.planning/phases/404-theo-recipes/404-05-SUMMARY.md`; `tests/test-404-stop-replay.cjs`. No commit was made.
VERIFIED: STAGE ancestry of HEAD, HEAD equals BASE, and the clean tracked tree before edits. `node --check tests/test-404-stop-replay.cjs` passed.
UNVERIFIED: The red and green runs were not run by instruction. The reviewer must run them with `MINDRIAN_404_K1_FORCE=1` and without the switch.
RISKS: The base lacks 405 slice 3. The alternate stale owner recovery shape is not available for inspection. K1-c has no run-sequence module on this base.
NEXT: The reviewer runs the red and green steps and returns any needed fixes.

## Run 2

### OR-47 answers

1. A person outside the builder session checks that K1 fails before the receipt fix and passes after it.
2. The evidence includes the test output, the file, the room database node, and the reply after replay.
3. The test uses the repository wire helper, a fixture room, temporary folders, and direct state checks.
4. A person outside the builder session checks the result and reports any copied sentence for the method review.

### Finding

The first red run did not reach the write. Both server processes had the write path disabled. The reviewer proved that each K1-b failure came from `write_path_disabled`. K1-d also recorded this refusal instead of the server behavior with the key on an open write path. Set `MINDRIAN_MCP_FIRST=desktop` in the environment for both server processes. Then K1-b can test the write, stop, and replay. K1-d can record whether the server refuses or ignores the key.

### Run 2 result

- The test sets `MINDRIAN_MCP_FIRST=desktop` in the shared temporary environment. Both server processes inherit this value.
- The forced run returned `PASS=3 FAIL=6`. The helper returned no initialize response, no tool response, and no stderr. The child process limit blocked the write test. This result does not verify a server refusal or a replay.
- The switch-off run returned `PASS=6 FAIL=0`. K1-d recorded no tool reply for the same sandbox limit. This result does not verify how the server handles the key.
- The red output is in `red/run2-stop-replay.txt`.

STATUS: PARTIAL
CHANGED: `tests/test-404-stop-replay.cjs`; this summary; `red/run2-stop-replay.txt`. No commit was made.
VERIFIED: `node --check tests/test-404-stop-replay.cjs` passed. The switch-off test returned `PASS=6 FAIL=0`. `git diff --check` passed.
UNVERIFIED: The outside-sandbox reviewer must run both modes. The forced test did not reach the server write, stop, or replay.
RISKS: The base does not declare `client_write_id`. The test must be reviewed with the required 405 changes present.
NEXT: The reviewer runs both modes outside the sandbox and checks the real write and replay.

## Run 3

### OR-47 answers

1. A storage engineer would confirm that the fixture is a registered room before testing a write. The previous run did not ask for that check.
2. Start from the wire fixture helper, the room database helper code, the artifact handler, and the three named wire test files.
3. Read the room creation paths. Use `openRoomDb` and `closeRoomDb` before either server starts. Then inspect the file, database node, and replay reply.
4. The test output, artifact file, artifact node in room.db, and server reply provide evidence outside this code change.

### Finding and change

The reviewer proved that the fixture room has no `.mindrian/room.db`. The artifact handler refuses both server calls with `no_room_db`, so the write and replay do not run.

The test now calls `openRoomDb` and `closeRoomDb` on the wire helper's fixture room before starting either server. This follows the room setup pattern in `tests/helpers/fixture-room-354.cjs`. That helper opens the room through the repository API and closes the handle, which creates the database and room identity. The test already imports these functions for the artifact node check.

The `tests/test-354-poc-room-journey.cjs` setup uses the shared scratch room helper. The `tests/test-354-theo-journey.cjs` setup assumes that helper has created the database. The `tests/test-36925-working-sequence.cjs` setup copies an existing room database. The 354 fixture helper is the direct match because this test has a new room and needs the repository database creation path.

The switch-off run returned no tool reply on two runs. It did not show whether the server ignores or refuses the key. Report this as an open gap. Do not choose a server behavior.

### Run 3 result

- The forced run returned `PASS=3 FAIL=6`. This BASE has no `client_write_id` schema. The full write assertions did not run successfully.
- The switch-off run returned `PASS=6 FAIL=0` twice. K1-d logged no tool reply both times. This does not prove the server response to the key.
- The known `no_room_db` refusal is addressed by room database setup. The current BASE still does not verify the write and replay because it lacks 405 slice 3.

STATUS: PARTIAL
CHANGED: `tests/test-404-stop-replay.cjs`; this summary. No commit was made.
VERIFIED: `node --check tests/test-404-stop-replay.cjs` passed. `git diff --check` passed. The switch-off run returned `PASS=6 FAIL=0` twice. The forced run returned `PASS=3 FAIL=6`.
UNVERIFIED: The real write, stop, replay, and server response to the key remain unverified. The forced assertions need 405 slice 3. The summary is ignored by `.gitignore` but has been updated in the worktree.
RISKS: K1-d does not establish whether the server ignores or refuses the key. The reviewer must run the test on a base with 405 slice 3.
NEXT: The reviewer runs both modes with 405 slice 3 and records the actual K1-d reply.

## Reviewer record (outside the sandbox)

- Commit: the K1 test commit named in the lane report (1 file, tests/test-404-stop-replay.cjs). PROVEN.
- Red (MINDRIAN_404_K1_FORCE=1): PASS=7 FAIL=2. Failed: "K1-b requires client_write_id input" (the artifact_file schema has no client_write_id) and "K1-b replay reply is ok and names recovery" (the second reply is ok: true with no replayed key; the server ignores the key). The file write, the kill after the write, 1 file and 1 artifact node passed. Saved: red/stop-replay.txt. PROVEN.
- Green (switch off): PASS=6 FAIL=0; K1-d prints "waits for 405 slice 3". PROVEN.
- Fixes found in review (runs 2 and 3): the write path env was not open (write_path_disabled); the fixture room had no room.db (no_room_db). PROVEN.
- No file under lib or scripts changed. PROVEN.
