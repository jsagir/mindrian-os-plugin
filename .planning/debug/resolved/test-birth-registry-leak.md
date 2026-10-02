---
status: resolved
kind: rca
trigger: "test-birth-registry-leak: tests/test-section-nodes-birth-and-migration.cjs calls birthRoom() on /tmp dirs without sandboxing the room registry (see symptoms)"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-10-02
updated: 2026-10-02
classification: NEW FAILURE
---

# test-birth-registry-leak

## Current Focus

hypothesis: CONFIRMED and FIXED. birthRoom() STEP 4 registered a temp-dir room into whichever registry env/HOME pointed at; the test sandboxed only the room dir. The registry writer had no notion that a throwaway path must not enter a durable registry.
test: n/a (verified, see Resolution)
expecting: n/a
next_action: none. Navigator-side follow-ups only: (1) optional cleanup of the stale real-tree artifacts listed under Non-Code Follow-ups, (2) live Desktop re-probe once the sibling RCA desktop-session-binding-fallback is fixed.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.56 (dev tree)
- Reported by: navigator, via 267-TRIPOLAR-PROBES.md F-3 (live Claude Desktop, 2026-10-02)
- Date first observed: 2026-10-02 (leaking since 162-02, first run 2026-06-17 by the tmp-dir record)
- Related debug sessions: desktop-session-binding-fallback (filed, open: the Desktop fallback that made this damaging), registry-active-room-concurrent-session-collision, registry-active-session-unbound-inheritance

## Source-of-Truth Preamble

- **CODE claims read against:** working tree of branch `main` at HEAD a290afda3 plus the uncommitted edits listed in Resolution (plugin 2.0.0-beta.56).
- **WIRE claims probe against:** none (no Brain or network call; every probe ran under a throwaway HOME with MINDRIAN_BRAIN_KEY unset).
- **Date of audit:** 2026-10-02
- **Re-verification rule:** any source-code claim here must be re-verified against `origin/main` HEAD before it is cited as a finding elsewhere.

## Problem Statement

A unit test that births rooms in /tmp registered them in the navigator's real room registry and flipped the machine-wide `active` pointer onto a throwaway fixture, so Claude Desktop (no session id) wrote a claim into the fixture instead of the bound room.

## Symptoms
<!-- IMMUTABLE -->

- **Expected:** tests never read or write the navigator's real room registry
  (`~/MindrianRooms/.rooms/registry.json`). A test that births a room in a temp
  dir resolves the registry under a temp `MINDRIAN_ROOMS_HOME` / `HOME`.
- **Actual:** at 2026-10-02T01:21:37-38Z a run of
  `tests/test-section-nodes-birth-and-migration.cjs` (Test 1 `my-room`, Test 2
  `idem-room`, `tmpDir('birth-')` / `tmpDir('birth-idem-')`) registered
  `/tmp/birth-PEn6Mx/my-room` and `/tmp/birth-idem-2RRSMu/idem-room` in the REAL
  registry and set `active: "idem-room"`; `active_session` was stamped with the
  running Claude Code session id (85e48f8b-...), `active_session_at`
  2026-10-02T01:21:38Z. The run came from a gsd-executor (267-08) in that session.
- **Errors:** none raised. Silent pollution.
- **Downstream impact (observed live, Claude Desktop, 2026-10-02):** with no
  session id on Desktop stdio, `claim_write` and room-state reads fell back to the
  registry `active` room, i.e. the /tmp fixture. `claim_write` wrote
  `claim:nosession:8e71dd1e` into `/tmp/birth-idem-2RRSMu/idem-room/.mindrian/room.db`
  instead of the bound `ador-ip-test`. Claude Code hooks in other sessions also
  reported the active room as `idem-room`.
- **Timeline:** test added in 162-02 (commits e1943940a, 2259c08db). Likely leaked
  on every run since; this is the first observed downstream damage.
- **Reproduction:** `node tests/test-section-nodes-birth-and-migration.cjs` with
  the real HOME, then inspect `~/MindrianRooms/.rooms/registry.json` `active` and
  `/tmp/` room entries. DO NOT reproduce against the real registry: run with
  `HOME=$(mktemp -d)` (and `MINDRIAN_ROOMS_HOME` if it is honored) and assert the
  temp registry gets written, and spy/compare the real registry mtime is unchanged.
- **Remediation already done:** navigator repaired the registry (removed both
  /tmp entries, `active` back to `egain-des-liquid-conductor`; backup
  `registry.json.bak-idem`).

## Scope and Impact

- Affected surfaces: all three. CLI hooks reported `idem-room` as active; Desktop wrote into it; Cowork shares the same registry writer, verified by construction only.
- Affected commands: any command reading the registry `active` field (`/mos:status`, hooks, `claim_write`, `status_read`).
- Affected users: the machine running the test suite (navigator and any contributor with a real ~/MindrianRooms).
- Version range: 162-02 (Phase 162, Section nodes at birth) to 2.0.0-beta.56.
- Severity: high (silent wrong-room writes on Desktop).
- Blast radius: `scripts/room-registry create` is the single registration door; every caller (birthRoom STEP 4, /mos:rooms new, direct calls) now passes the guard.

## Eliminated

- hypothesis: only the registry file leaks.
  evidence: the same run also nested `~/MindrianRooms/tmp/birth-*/<slug>/` (66 stale dirs since 2026-06-17), wrote `.rooms/sessions/sess-1.json` + `sess-2.json`, and rewrote `.rooms/.room-graph/rooms.db`. Four artifact classes, one cause.
  timestamp: ~2026-10-02T01:30Z
- hypothesis: a fresh empty `HOME=$(mktemp -d)` is a valid sandbox for the repro.
  evidence: with no `MindrianRooms/` dir, the registry write silently FAILS (the `[ -d "$1" ]` override test in scripts/room-registry:29 is false, so the rooms-home path is parsed as the subcommand: exit 1, swallowed by birthRoom STEP 4's catch). That repro showed NO registry write and would have falsely suggested "no leak". The sandbox must pre-create `$HOME/MindrianRooms`.
  timestamp: ~2026-10-02T01:31Z
- hypothesis: many tests leak the same way.
  evidence: dynamic sweep (below): of 263 static candidates under a canary HOME exactly 1 mutated the canary registry; of 1,674 tests under a non-temp canary HOME with the guard armed, 0 changed it and 0 hit the guard.
  timestamp: ~2026-10-02T01:50Z
- hypothesis: a second, JS-side guard inside birthRoom is needed before scaffolding.
  evidence: not needed. The single bash chokepoint refuses before any registry/session/graph-sync write; the scaffold it leaves is in the temp dir (nothing durable). A duplicate implementation would drift.
  timestamp: ~2026-10-02T01:40Z

## Evidence

- timestamp: ~2026-10-02T01:29Z
  checked: lib/core/navigation/room-birth.cjs:410-412 (`_roomsHome`) and STEP 4 (:1214-1228)
  found: ROOMS_HOME = `process.env.MINDRIAN_ROOMS_HOME || os.homedir()/MindrianRooms`, passed as first arg to `bash scripts/room-registry <home> create <slug> <roomDir> ...`. The create stanza appends the room, sets `reg['active']=name`, stamps active_session from CLAUDE_CODE_SESSION_ID / CLAUDE_PID, then `mkdir -p "${ROOMS_HOME}/${RPATH}"` (absolute RPATH => nested copy of the temp path under ROOMS_HOME), seeds bootstrap files there, and spawns sync-rooms-graph.
  implication: the registry path is purely env/HOME-derived; nothing checks that the room is throwaway.
- timestamp: ~2026-10-02T01:29Z
  checked: tests/test-section-nodes-birth-and-migration.cjs Tests 1+2
  found: only the ROOM dir is a mkdtemp; MINDRIAN_ROOMS_HOME and HOME are never set.
  implication: half-sandboxed fixture. The room is isolated, the registry is not.
- timestamp: ~2026-10-02T01:32Z
  checked: hermetic repro (HOME=<scratch>, `MindrianRooms/` pre-created, MINDRIAN_ROOMS_HOME unset); real registry mtime 04:26:58.32 (+0300) and size 27221 compared before and after
  found: sandbox registry gets `my-room` -> /tmp/birth-H1n5Hu/my-room and `idem-room` -> /tmp/birth-idem-yONSIf/idem-room, `active=idem-room`; also `MindrianRooms/tmp/birth-*/<slug>/{ROOM,STATE,USER}.md`, `.rooms/sessions/sess-{1,2}.json`, `.rooms/.room-graph/rooms.db`. Real registry unchanged.
  implication: exact symptom reproduced hermetically.
- timestamp: ~2026-10-02T01:33Z
  checked: read-only listing of the REAL ~/MindrianRooms
  found: `tmp/` holds 66 stale dirs (31 `birth-*`, 31 `birth-idem-*`, plus one each of `ac-*`, `bch18-*`, `before-fix-*`, `after-fix-*` from other tests, dir names only, none reproduced by the current suite), earliest 2026-06-17, latest 2026-10-02 04:21:37; `.rooms/sessions/` holds `sess-1.json`, `sess-2.json` and two other test-id files (`sdk-should-win-55556666.json`, `env-fallback-session-11112222.json`, from tests/test-room-bind-stdio-session-fallback.cjs, now hermetic).
  implication: the test leaked on every run since 162-02; registry damage was visible only once `active` was left on the fixture.
- timestamp: ~2026-10-02T01:36Z
  checked: dynamic sweep 1: 263 static-candidate tests (grep for birthRoom/room-registry/registry.json/room_bind/set-active/session-binding/healRoom/new-project/sync-rooms-graph) each run under a fresh canary HOME (tmp), MINDRIAN_ROOMS_HOME/session/brain-key env unset, canary tree hashed before and after
  found: exactly one test mutated the canary registry: tests/test-section-nodes-birth-and-migration.cjs (registry + tmp nesting + sessions + room-graph). Static grep also found no hard-hardcoded real-path writes.
  implication: the leak is this one test; the other birth/registry tests (test-room-birth, test-195-*, test-sentinel-self-heal, test-353-subroom-birth, ...) already sandbox MINDRIAN_ROOMS_HOME.
- timestamp: ~2026-10-02T01:45Z
  checked: guard RED/GREEN (tests/test-registry-tmp-leak-guard.cjs)
  found: before the guard: G1, G1b, G4, G4b, G7 FAIL (exit 0 / ok:true instead of refusal), controls G2/G3/G3b/G5/G6 PASS. After: all PASS. R1 (the original leaky test under a NON-temp canary HOME) FAILED closed (birthRoom ok:false registry_guard_refused) until the test itself was sandboxed, then PASSED.
  implication: the guard fails closed for the original bug and does not break temp-registry tests.
- timestamp: ~2026-10-02T01:55Z
  checked: dynamic sweep 2: 1,674 tests (every tests/test-*, *.test.cjs under tests/, test/, lib/, scripts/; manual/ + 25 shared-tree-hazard tests excluded) under a NON-temp canary HOME (stand-in for a real home) with the guard armed
  found: 0 canary registry changes, 0 `MindrianRooms/tmp` nesting, 0 sessions files, 0 REGISTRY_GUARD_* tokens in any log. Exit codes: 1459 pass, 199 fail, 9 timeout, 5 skip-77, 2 worker scripts. Failing-set vs a HEAD baseline copy: 46 registry/birth-related failures compared, 42 identical; the 4 differences were re-run: 1 flaky, 3 environmental (a peer agent worktree under .claude/worktrees, peer in-flight lib/mcp edits). With my two changed files overlaid on the baseline those 3 gave the baseline results, so the change is not the cause.
  implication: no other leaking test; no regression from the guard. Real registry mtime/size/sha, tmp-dir count (66), and rooms.db mtime unchanged throughout.
- timestamp: ~2026-10-02T01:58Z
  checked: side effects of my own sweep on the shared tree
  found: tests rewrote 9 TRACKED files (`.planning/DRIFT.md`, `353-FLEET-REPORT.json`, `scripts/__pycache__/compute-hsi.cpython-312.pyc`, 6 `tests/fixtures/sample-room-personas/personas/*.md` deleted by tests/test-phase-14.sh `rm -f`). I restored exactly those 9 paths from HEAD; nothing else touched.
  implication: separate test-hygiene debt (tests that write tracked repo files) noted below; not fixed here.

## Technical Root Cause

- Site: lib/core/navigation/room-birth.cjs STEP 4 (`_roomsHome` :410-412; registry create :1214-1228) and scripts/room-registry `create` stanza (formerly :~290-316); trigger in tests/test-section-nodes-birth-and-migration.cjs Tests 1 and 2.
- Cause: the registry location is derived only from env/HOME. The test isolated the room dir but not the registry, and the registry writer accepted any path including one under the OS temp dir, so each run registered fixtures in the real registry, set `active`, stamped `active_session`, nested `~/MindrianRooms/tmp/<abs path>/`, wrote session-binding files and re-synced the room graph.
- Why it surfaces now: Claude Desktop has no session id, so its reads/writes fall back to registry `active` (see desktop-session-binding-fallback). The 267-08 executor's run left `active` on the fixture, which turned a long-standing silent leak into an observable wrong-room write.

## Required Code Changes (applied)

- Change 1 (structural guard):
  - Location: scripts/room-registry, new `_registry_leak_guard`, called by `create` (before `ensure_registry`) and by `update <name> path|abs_path <value>`.
  - Required behavior: refuse (exit 3, stderr `REGISTRY_GUARD_REFUSED`, zero writes) when realpath(room) is under a temp root and realpath(registry file) is not. Allowed: temp-to-temp, non-temp-to-non-temp, non-temp-into-temp. Temp roots = tempfile.gettempdir() + TMPDIR/TEMP/TMP + (POSIX) /tmp, /var/tmp; a filesystem-root temp root is ignored. Audited opt-out `MINDRIAN_ALLOW_TMP_ROOM=1` (exact value) is loud (`REGISTRY_GUARD_BYPASSED`). A guard crash does not block creation (`REGISTRY_GUARD_ERROR`, Larry-never-blocks).
  - Why this guard: it is the single chokepoint every registration passes through, it PREVENTS the write (a suite-level mtime assertion only detects it after `active` has already moved), it is ~90 lines of bash+python already required by `create`, and it needs no cooperation from tests.
- Change 2 (honest failure):
  - Location: lib/core/navigation/room-birth.cjs STEP 4 catch.
  - Required behavior: exit status 3 / token REGISTRY_GUARD_REFUSED returns `{ok:false, reason:'registry_guard_refused', detail, roomDir, slug}` and writes one stderr line, instead of a false success.
- Change 3 (the leaking test):
  - Location: tests/test-section-nodes-birth-and-migration.cjs.
  - Required behavior: sandbox MINDRIAN_ROOMS_HOME + HOME + USERPROFILE to a mkdtemp dir before any require, assert the registry write lands in the sandbox, assert the real registry stat is unchanged (Test 6), restore env, clean temp dirs.
- Change 4: CHANGELOG.md `[Unreleased]` Fixed entry.

## Tests to Add or Update

- Test 1: tests/test-registry-tmp-leak-guard.cjs (new, auto-collected by tests/run-all.sh `test-*.cjs`): G1, G1b, G2, G3, G3b, G4, G4b, G4c, G5, G6 (symlinks, POSIX), G7 (birthRoom fails closed) and R1 x6 (the original leaky test plus five birth tests run under a non-temp canary HOME must leave it byte-identical). Exit 77 SKIP when python3 or a non-temp base dir is unavailable.
- Test 2: tests/test-section-nodes-birth-and-migration.cjs updated (Test 6 hermeticity proof, registry-in-sandbox assertion in Test 1).

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under `[Unreleased]`.
- Release lockstep: ships with the next release; no version fields touched by this change.
- Canon: Part 8 not touched (no Brain wire). Part 9: local only. No docs/CANON-PHASE-MAP.md change.
- NAVIGATOR (real tree, not touched by me): stale artifacts from the leak remain in the real `~/MindrianRooms`: `tmp/` (66 dirs: 31 `birth-*`, 31 `birth-idem-*`, `ac-*`, `bch18-*`, `before-fix-*`, `after-fix-*`), `.rooms/sessions/sess-1.json` and `sess-2.json` (also `sdk-should-win-55556666.json`, `env-fallback-session-11112222.json` from an older, now hermetic test). `.rooms/.room-graph/rooms.db` was re-synced after the registry repair (04:30) and needs nothing.
- OPEN (separate, not fixed here):
  1. `scripts/room-registry` create: `mkdir -p "${ROOMS_HOME}/${RPATH}"` + `ROOMDIR="${ROOMS_HOME}/${RPATH}"; _seed_room_bootstrap` double an ABSOLUTE RPATH. The real tree shows it in production too: `~/MindrianRooms/home/jsagi/MindrianRooms/<room>/` nested copies carrying a `.mindrian/` dir (dir dated 2026-06-11). Quick 260723-ad9 fixed only the `_write_current_room` half.
  2. `scripts/room-registry:29`: the rooms-home override uses `[ -d "$1" ]`; a not-yet-existing rooms home makes the path parse as the SUBCOMMAND and birthRoom swallows the exit 1, so a fresh install registers nothing silently.
  3. Tests that write TRACKED files (test-phase-14.sh deletes sample-room-personas/personas/*.md; test-drift-baseline rewrites .planning/DRIFT.md; test-353-fleet-report rewrites 353-FLEET-REPORT.json; a test recompiles scripts/__pycache__/compute-hsi.cpython-312.pyc). Running the suite dirties the tree.
  4. Tests also write the global `~/.mindrian/{scratchpad.json,bridge/,telemetry/}` under the real HOME. Global user state, not the room registry; a different concern.
  5. Linux only verified. macOS (/var -> /private/var) and Windows (drive-letter case, Git Bash paths) are covered by construction (realpath + normcase + normwin), not run.
  6. Sibling RCA filed: .planning/debug/desktop-session-binding-fallback.md (status open).
- knowledge-base.md: block added.

## Resolution

root_cause: birthRoom() STEP 4 registers the room through scripts/room-registry using a registry location derived only from MINDRIAN_ROOMS_HOME or os.homedir(); tests/test-section-nodes-birth-and-migration.cjs isolated the room dir but not the registry, and the writer accepted a temp-dir room into a non-temp registry, so every run registered fixtures in the real registry, flipped `active`, nested ~/MindrianRooms/tmp/<abs path>, and wrote session-binding and room-graph files. Claude Desktop (no session id) then fell back to that `active` fixture.
fix: (1) scripts/room-registry `_registry_leak_guard` on `create` and `update path|abs_path` (fails closed, exit 3); (2) birthRoom returns ok:false `registry_guard_refused` instead of false success; (3) the leaking test sandboxes MINDRIAN_ROOMS_HOME/HOME/USERPROFILE and proves the real registry did not move; (4) regression test tests/test-registry-tmp-leak-guard.cjs; (5) CHANGELOG Fixed entry.
verification: hermetic only (throwaway HOME; real registry sha/mtime/size unchanged before and after every sweep). tests/test-registry-tmp-leak-guard.cjs 17/17 (RED first: G1, G1b, G4, G4b, G7, R1-leaky FAILED before the guard/test fix); tests/test-section-nodes-birth-and-migration.cjs 6/6; tests/run-all-162.sh 6/6; sweep 1 (263 static candidates, canary HOME): 1 leaker found; sweep 2 (1,674 tests, non-temp canary HOME, guard armed): 0 leaks, 0 guard hits, no regression vs HEAD baseline. One verification run of the already-fixed test used the real environment (guard armed, test sandboxed); real registry mtime/size and the real tmp dir count were unchanged afterwards.
files_changed:
  - scripts/room-registry (guard)
  - lib/core/navigation/room-birth.cjs (fail closed on guard refusal)
  - tests/test-section-nodes-birth-and-migration.cjs (sandbox + hermeticity proof)
  - tests/test-registry-tmp-leak-guard.cjs (new)
  - CHANGELOG.md (Unreleased/Fixed)
commits: see git log (fix commit and docs commit; shas recorded in the knowledge-base block)
