---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 10
subsystem: doctor
tags: [doctor, room-registry, cleanup, f0-gate, digest, canon-part-8, seed-117]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: plan 03 stopped new doubled trees at the source (room-registry classifies the RPATH before any write); plan 09 registered room-runtime
provides:
  - the doubled-room-trees doctor row (check-only, lists the folders and a 12-char digest)
  - the sibling flag --clean-doubled-rooms=<digest> (digest-bound delete, never under --fix or --all)
  - the F.0 gated repair doctrine in commands/doctor.md
affects: [383-11]

tech-stack:
  added: []
  patterns:
    - "Destructive repair = sibling flag outside the engine fix flow, bound to a listing digest, behind an F.0 card (icm-walk dispatch precedent)"

key-files:
  created:
    - lib/core/doctor/doubled-room-trees-module.cjs
    - tests/test-383-doubled-room-trees.cjs
  modified:
    - data/doctor-modules.json
    - scripts/doctor.cjs
    - commands/doctor.md
    - skills/doctor/SKILL.md
    - CHANGELOG.md

key-decisions:
  - "The delete is a sibling flag dispatched before the class-flag block, so --fix (which sets baseWanted) and --all can never reach it; the module exports no fix (D-02)"
  - "A leaf is removable only when STATE.md and USER.md are byte-equal to the room-registry heredocs, ROOM.md matches the seed template (room_id equals the folder name, name equals heading, stage equals the Stage line), .mindrian is an empty directory, nothing else is present, and the copied path is a real room or a registry path"
  - "No recursive delete: unlink for the three files, rmdir for .mindrian, the leaf and each empty parent up to, not including, the rooms home. grep -c rmSync prints 0"
  - "Test T13 parses the two heredocs out of scripts/room-registry, so a template change in the registry fails the test instead of silently making the module match nothing"

requirements-completed: [QA383-10]

duration: 55min
completed: 2026-11-05
---

# Phase 383 Plan 10: doubled-room-trees row and the gated cleanup Summary

**`/mos:doctor` lists the doubled-path folders that older room births left under the rooms home with a digest, and `--clean-doubled-rooms=<digest>` deletes only unchanged seed folders that mirror a real room, after the F.0 Approve and never under `--fix`.**

## Accomplishments

- `lib/core/doctor/doubled-room-trees-module.cjs` exports `listDoubledTrees`, `listingDigest`, `check`, `clean`. No `fix` export. The walk uses lstat only, skips symlinks, stops at depth 16 and 5000 entries, skips real rooms (`.room-root`, `.mindrian/room.db`, registry slug) and dot folders.
- `kept` carries the reason: `holds edited or extra files` or `no matching real room`. A top folder named `C:` or `C` plus U+F03A is read as a drive-letter path for the mirror check.
- Registered in `data/doctor-modules.json` after `room-runtime` (introduced 2.0.0-beta.78, cadence always, flag null, fix_supported false).
- `scripts/doctor.cjs`: `flags.cleanDoubledRooms`, a help block, and a dispatch next to `--icm-walk`. A mismatch prints three plain lines and exits 1; success exits 0.
- `commands/doctor.md`: inventory rows for `room-runtime` and `doubled-room-trees`, the argument-hint, a Step 1 line, and the section "The doubled-path folder repair (F.0 gated)". `skills/doctor/SKILL.md` rebuilt by `build-skill-mirrors`.
- CHANGELOG: one bullet under Added, committed alone.

## The real-home listing (read only, for plan 383-11)

Command: `node -e "require('./lib/core/doctor/doubled-room-trees-module.cjs').check({})"` against `~/MindrianRooms`. `find ~/MindrianRooms -newer <marker made before the run>` printed nothing, so the run wrote nothing.

- status `warn`; 8 leaves; top folder `home`; digest `677711508073`
- leaves: `home/jsagi/MindrianRooms/` plus `aion-eureka-synergy`, `air-temp-map`, `axiom`, `egain-des-liquid-conductor`, `google-verifiable-quantum-circuit-compilation`, `haim-battlefield-intake`, `iris-lev-joint-venture`, `orly-abramovitz`. This matches the 8 entries of the research read.
- 78 other seed-like folders are KEPT, not removable: 12 under `_archive/` and `rooms/` (`holds edited or extra files`) and 66 under `tmp/` (`no matching real room`; throwaway test births whose /tmp room is gone). Plan 383-11 may mention them to the navigator; this plan does not remove them.
- The `C:` entry sits on the Windows side and is not visible from Linux. Plan 383-11 needs the Windows-side run for it.
- NOT RUN: the delete. Nothing under `~/MindrianRooms` was changed by this plan.

## Engine row at running=2.0.0-beta.78 (hermetic fixture)

The bare CLI on this host defers modules introduced above the installed cache version (see plan 09), so the row was proven with `runAccumulativeEngine({home, running: '2.0.0-beta.78', dryRun: true})` on a mkdtemp home:
`status warn; detail "1 doubled-path folder(s) under the rooms home (tmp); digest 1358ab278dac; nothing is deleted without the navigator approval: doctor --clean-doubled-rooms=1358ab278dac"`.

## Task Commits

1. Task 1: module, registry entry, flag, test - `d855fc02c`
2. Task 2: doctor.md doctrine and skill mirror - `b3ef5bbe5`; CHANGELOG bullet (alone, `--only CHANGELOG.md`) - `1b0d00adb`

## Verification (quoted)

- `node tests/test-383-doubled-room-trees.cjs`: `PASS: 16 FAIL: 0 PENDING: 0`, exit 0. Legs T1 to T16 cover: list and mirror, edited file kept, no real room kept, `C:` and U+F03A tops, check() lists only with an unchanged tree snapshot, wrong digest deletes nothing, current digest deletes and prunes parents, symlinks not followed, depth 16, no fix export and no `rmSync`, CLI wrong digest exit 1 and current digest exit 0, `doctor --fix` leaves the doubled folder in place (T12), heredoc parity with `scripts/room-registry`, registry entry, an edited sibling survives, a stale digest deletes nothing.
- `grep -c rmSync lib/core/doctor/doubled-room-trees-module.cjs`: 0. `typeof m.fix` is `undefined`.
- `bash tests/run-all-383.sh`: `Phase 383: PASS=16 FAIL=0 SKIP=0` (was 15; the new file adds one). Part 8 source sweep PASSED (it lists the new module as clean). Dash fence PASSED. `PENDING U3` printed by the sourced-number file.
- Gates, each exit 0: `build-connector-registry --check` (`connector-registry: OK`), `build-orchestration-projection --check` (`orchestration-projection: OK`), `check-render-coverage` (`198 wired, 2 excluded, 0 unwired`), `build-harness-manifest --check` (`OK`), `build-skill-mirrors --check` (`112 mirrors match`), `build-command-registry --check` (`OK`), `run-harness --check` (`12 pass, 0 fail, 2 ghost, 5 declared, 19 total`).
- `node tests/test-doctor-module-contract-parity.cjs`: exit 0 (`ALL PASS`). `node tests/test-doctor-doc-parity.cjs`: exit 0 (`ALL PASS (3 assertions)`). `node tests/test-doctor-acceptance-self-coverage.cjs`: exit 0 (`6 passed, 0 failed`).
- `node tests/test-369-hook-require-graph.cjs`: exit 0 (`5 passed, 0 failed`). `node tests/test-227-mode-select-checkpoint.cjs`: exit 0. `node tests/test-harness-manifest-precommit-wiring.cjs`: exit 0 (`9 passed`).
- `node tests/test-card-fire-relevance-gate.cjs`: exit 1, `6 passed, 5 failed`, the baseline (the 5 expected RED legs; not worse).
- `node scripts/doctor.cjs --acceptance`: `Acceptance full: 24/25 points passed; failed: verify-release-clean-tree.` The one failing point reports tracked-file drift of 1 file: `.planning/phases/384-.../bench/process-census.cjs`, modified by the Phase 384 session. Not mine, not fixed. The shell exit code of the acceptance run was not captured (the run finished in a background job).
- `node scripts/check-shape-declaration.cjs --check`: 51 advisory WARN lines listed; `commands/doctor.md` is one of them for the existing F.0 plus `connector.excluded` overlap, which predates this plan. CLAUDE.md quotes 53 at Appendix D entry 40, so the count did not rise.
- Dash fence: `grep -P "[\x{2013}\x{2014}]"` finds nothing in the module and the test.

## Deviations from Plan

None in scope. Two small design notes:

1. ROOM.md is checked against the full seed template (venture name equals the heading, stage equals the Stage line), stricter than the plan's "frontmatter keys and room_id". A looser match was not needed and a stricter one can only keep more.
2. `check()` returns `kept_count` and the first 10 `kept` entries, not all 78, so the doctor row stays readable on the dev machine.

## Known Stubs

None.

## Threat Flags

None. The module and the flag read and delete only under the local rooms home; no Brain call, no network (Canon Part 8). T-383-04 and T-383-17 are mitigated as planned: template byte-equality, a mirror-of-a-real-room requirement, a digest bound to the listing, no recursive delete, no symlink follow, rmdir only when empty, a sibling flag outside `--fix` and `--all`, and the F.0 Approve in the doctrine.

## Issues Encountered

- The `verify-release-clean-tree` acceptance point fails because of the Phase 384 session's modified bench file. Known, not fixed.

## Self-Check: PASSED

- FOUND: lib/core/doctor/doubled-room-trees-module.cjs, tests/test-383-doubled-room-trees.cjs, commands/doctor.md, data/doctor-modules.json
- FOUND commits: d855fc02c, b3ef5bbe5, 1b0d00adb
