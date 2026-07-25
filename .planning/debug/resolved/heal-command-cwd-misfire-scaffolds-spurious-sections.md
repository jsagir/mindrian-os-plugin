---
status: resolved
trigger: "heal-command falls back to process.cwd() when no room-dir arg; misfire scaffolds spurious sections in non-room container directories"
created: 2026-05-17T00:00:00Z
updated: 2026-05-17T12:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED. Human verification complete.
test: 4 production tests by user + 12 automated unit tests -- all pass.
expecting: N/A -- resolved.
next_action: Archive session.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: heal-command MUST verify the target directory is a legitimate room before scaffolding sections. Acceptable behaviors: (a) require the room-dir positional arg and refuse CWD fallback when CWD lacks .room-root sentinel + STATE.md; (b) consult the room registry when no arg passed; (c) abort if resolved directory contains child dirs that carry .room-root (container pattern).

actual: heal-command resolved room_dir to /home/jsagi/MindrianRooms/motj-ecosystem/sub-rooms/ due to prior `cd` polluting shell CWD. Heal scaffolded 8 spurious section dirs, wrote STATE.md (6452b), created .mindrian/ — all in sub-rooms/ which is a container not a room.

errors: No error. Silent misfire. Exit code 0. Summary "ok=9 blocked=0 skipped=1 error=0 exit_code=0". Detected only by inspecting heal-log.json path in output.

reproduction: |
  cd ~/MindrianRooms/motj-ecosystem/sub-rooms
  for r in motj-canon sanhedrin; do touch "$r/.room-root"; done
  node ~/.claude/plugins/mindrian-os/scripts/heal-command.cjs
  # Heal targets sub-rooms/ instead of motj-ecosystem/

started: 2026-05-17 during /mos:heal session on motj-ecosystem. Second occurrence of CWD-pollution class bug in same session.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-17T00:01:00Z
  checked: symptoms / context pointers from caller
  found: Root cause is definitively at line 1007 (CWD fallback) with no assertIsRoom guard. Lines 849 and 856/876 also relevant.
  implication: Fix requires (1) room validation before scaffold, (2) container detection, (3) optionally registry fallback before CWD.

- timestamp: 2026-05-17T00:10:00Z
  checked: scripts/heal-command.cjs full source, scripts/room-registry, commands/heal.md
  found: parseCliArgs line 1007 is the sole CWD injection point. runHeal() only has existsSync check before all 10 steps fire. step02ScaffoldSections creates all 8 canonical dirs unconditionally. commands/heal.md is a soft-alias stub -- same underlying heal-command.cjs, same vulnerability. Fix must be in heal-command.cjs so all callers benefit.
  implication: Two-layer guard needed in runHeal() itself plus registry-first resolution in parseCliArgs().

- timestamp: 2026-05-17T00:20:00Z
  checked: Production misfire scenario in /tmp (cd sub-rooms && node heal-command.cjs) and explicit container path
  found: Registry resolution routes no-arg invocation to motj-ecosystem correctly. Container guard rejects explicit sub-rooms path with error_container_dir + exit 2, naming the child rooms. Not-a-room guard rejects bare directory with error_not_a_room + exit 2.
  implication: Both defense layers confirmed working. 12/12 unit tests pass.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: scripts/heal-command.cjs parseCliArgs() line 1007 fell back to process.cwd() with zero validation. runHeal() only checked directory existence before scaffolding all 10 steps. Any shell CWD pollution caused heal to silently target and scaffold the wrong directory with no error and exit 0.

fix: Three-part fix in scripts/heal-command.cjs -- (1) assertIsRoom(dir): checks .room-root OR STATE.md OR ROOM.md; (2) isContainerDir(dir): detects 2+ direct child dirs each with .room-root; (3) buildErrorEnvelope(): shared helper for structured error envelopes; (4) runHeal() guard block after existsSync: runs container check then room-sentinel check, returns error envelope on failure, accepts opts.skipRoomCheck for internal bypass; (5) parseCliArgs(): tries resolveActiveRoomFromRegistry() before falling back to process.cwd(); (6) resolveActiveRoomFromRegistry(): spawnSync helper with 3s timeout, resolves relative paths against MINDRIAN_ROOMS_HOME; (7) printUsage() updated; (8) module.exports extended. New test file: tests/test-heal-command-room-validation.cjs (12 tests, all pass).

verification: 12 unit tests pass + 4 production tests by user. Test 1: no-arg from polluted CWD correctly routes to registry active room (exit 0). Test 2: explicit container path rejected with child-room list + exit 2. Test 3: bare /tmp caught as container (exit 2). Test 4: explicit valid path heals normally (exit 0). Human confirmed fixed 2026-05-17.

follow_up_candidates:
  - OBS-1: Container-guard "parent" suggestion is nonsensical when the rejected path is one level from filesystem root (e.g., /tmp -> suggests /). Fix: suppress or validate the suggested parent before printing (check that dirname(resolved) is itself a meaningful room parent, not / or equivalent).
  - OBS-2: .mindrian/ dir and heal-log.json are written to the rejected target BEFORE the container/room guards fire (side-effect leak). Fix: move guards to before step_01_backup, or stage heal-log to a tmp path until guards pass. Not a data-corruption risk but leaves litter in rejected dirs.
  - Both are defer-or-fix candidates for a future hardening pass (docs/install-cache-family-premortem.md sweep or a standalone /gsd:add-backlog item).

files_changed:
  - scripts/heal-command.cjs
  - tests/test-heal-command-room-validation.cjs (new)
