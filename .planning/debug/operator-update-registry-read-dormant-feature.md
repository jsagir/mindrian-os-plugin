---
status: investigating
kind: rca
trigger: "operator-update-registry-read-dormant-feature"
issue_id: "B3"
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [7, 9]
created: 2026-11-06T07:43:00Z
updated: 2026-11-06T07:43:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 717ae8343 (working tree of /home/jsagi/dev/MindrianOS-Plugin-release, plugin 2.0.0-beta.80)
- **WIRE claims probe against:** none (no Brain call, no network in this RCA)
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim below carries PROVEN (run in this session), UNVERIFIED or ASSUMED.

## Current Focus

hypothesis: scripts/operator-update.cjs reads the registry with a private legacy-shape copy (active_room plus a rooms array), so on every real registry (active plus a rooms object) it exits at the silent-success branch and the operator feature is dormant.
test: ran the script as a child process on a temporary registry of each shape, with a trace copy.
expecting: keyed shape exits at no-room; legacy shape reaches the event switch.
next_action: owner decision (repair the read, or leave the hook to the Phase 385 unwire).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: auditor findings B3 and T02 (auditor hypotheses)
- Date first observed: 2026-11-05
- Related debug sessions: none

## Problem Statement

scripts/operator-update.cjs resolves the active room with a private reader that only understands the legacy registry shape. On a real install it never finds a room, so the conversation operator state machine never moves from a hook, and every hook firing is a wasted process.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: on a prompt or tool call in an active room, the hook updates the operator state file and writes the operator transition to room.db.
actual: the hook prints `{"continue":true,"suppressOutput":true}` and exits 0 for every event, and writes nothing.
errors: none (silent success by design of the branch).
reproduction:
  1. Build a temporary MINDRIAN_ROOMS_HOME and register one fixture room with `scripts/room-registry create` (keyed shape).
  2. Run a trace copy of scripts/operator-update.cjs with `{"hook_event_name":"UserPromptSubmit","prompt":"I want to build the room and file this into a section"}` on stdin.
  3. Read the trace line on stderr and list the room files.
started: Phase 127.3 changed the registry reader to the canonical resolver (lib/core/resolve-active-room.cjs) and fixed jtbd-update. operator-update.cjs was not part of that change (git log of the file: 41b43973b Phase 99-04 add, 3b8c30c61 Phase 121.5 contributors, a6ca075a5 Phase 129-03 navigation routing; none touches the registry read).

## Scope and Impact

- Affected surfaces: cli (hooks fire only there). Desktop and Cowork do not run this hook.
- Affected commands: hook only; `/mos:operator` (scripts/operator-command.cjs) is a separate path.
- Affected users: all installs with the current registry shape.
- Version range: first bad is Phase 127.3 shape change; last checked beta.80.
- Severity: medium (dormant feature plus wasted process; no data risk today).
- Blast radius: the same private reader sits in `contributeOperator` and `contributeJtbd` in the same file. Both are called by scripts/sessionstart-coordinator.cjs (lines 69-70), so the SessionStart resume hint for BUILD_ROOM is also dead. The jtbd hint reads through the same dead reader.

## Eliminated

- hypothesis: the script crashes or errors on the keyed shape.
  evidence: exit code 0, valid envelope, no stderr other than the trace line (PROVEN).
  timestamp: 2026-11-06T07:42:00Z
- hypothesis: the Stop case does real work if a room resolves.
  evidence: `case 'Stop'` returns silentSuccess with no write. The state file and room.db were byte-identical before and after a Stop run on the resolved-room copy (PROVEN).
  timestamp: 2026-11-06T07:42:30Z

## Evidence

- timestamp: 2026-11-06T07:41:48Z
  checked: registry written by `scripts/room-registry create` into a temporary MINDRIAN_ROOMS_HOME
  found: `{"version":1,"active":"fixture-b3","rooms":{"fixture-b3":{"path":...}}}`. Key `active`, an object for `rooms`, and key `path` (no `abs_path`). (PROVEN)
  implication: the private reader checks `reg.active_room` and `Array.isArray(reg.rooms)` and `room.abs_path`. All three checks fail on this shape.
- timestamp: 2026-11-06T07:42:00Z
  checked: trace copy of the script, keyed registry, events SessionStart, Stop, PostToolUse, UserPromptSubmit
  found: all 4 events print `BRANCH no-room-silent-success`, stdout `{"continue":true,"suppressOutput":true}`, rc 0. (PROVEN)
  implication: on the keyed shape the script exits at the `if (!room) return silentSuccess()` branch in `main()` for every event.
- timestamp: 2026-11-06T07:42:05Z
  checked: trace copy, legacy-shape registry `{"active_room":..., "rooms":[{"slug":..., "abs_path":...}]}`
  found: Stop and UserPromptSubmit print `BRANCH room-resolved <event>`. The UserPromptSubmit run created `.mindrian/conversation-operator.json` (462 bytes). Stop wrote nothing. (PROVEN)
  implication: the script works on the legacy shape only. tests/test-operator-hooks.cjs passes because its fixture uses the legacy shape (planner note in Phase 385 plan 08; not re-run here, UNVERIFIED).
- timestamp: 2026-11-06T07:42:20Z
  checked: scratch copy with the private reader replaced by `require('lib/core/resolve-active-room.cjs').resolveActiveRoom()`, keyed registry
  found: SessionStart and Stop reach the switch and write nothing. A PostToolUse AskUserQuestion moved the state to DECISION_GATE (previous BUILD_ROOM) and set `decision_gate_pending` in `conversation-operator.json`. (PROVEN)
  implication: with the canonical resolver the PostToolUse and UserPromptSubmit legs become live. Stop and SessionStart stay free of writes.
- timestamp: 2026-11-06T07:42:40Z
  checked: same scratch copy, fixture room with a room.db created by `openRoomDb`, prompt "I want to build the room and file this into a section"
  found: shipped copy (keyed registry): nodes 0, edges 0 before and after. Canonical copy: nodes 3 (two `operator` nodes and one `memory_event`), edges 1 (`OPERATOR_TRANSITION` from `operator:JUST_TALK` to `operator:BUILD_ROOM`, property trigger `user_message`). (PROVEN)
  implication: repair turns on room.db writes through the navigation chokepoint (Part 9 path), on a plain prompt.
- timestamp: 2026-11-06T07:42:55Z
  checked: repo modules loaded by one process (`require.cache` entries under the repo)
  found: shipped copy on `{"prompt":"hello"}`: 2 (operator.cjs, classifier.cjs). Canonical copy, a transition fires: 169. (PROVEN, count only; no timing measured, Phase 384 owns timing)
  implication: a firing that transitions pulls navigation.cjs and its chain (169 repo modules). A firing with no transition loads 3.

## Technical Root Cause

- Site: scripts/operator-update.cjs, function `resolveActiveRoom` (private copy; also used by `contributeOperator` and `contributeJtbd`).
- Cause: the function checks `reg.active_room`, `Array.isArray(reg.rooms)` and `room.abs_path`. The registry written by scripts/room-registry has `active`, a `rooms` object and `path`. The function always returns null on a real install, so `main()` returns at the `if (!room) return silentSuccess()` branch. This is a private legacy-shape copy that Phase 127.3 (lib/core/resolve-active-room.cjs, the one resolver) did not replace in this file. The Phase 127.3 header of that resolver names four such copies and operator-update.cjs is a fifth that was missed.
- Why it surfaces now: the audit (B3, T02) ran the script against a real registry shape. The silent success hides the fault from users and from tests that use a legacy-shape fixture.

What the hook does when the read works (facts from the code and the scratch run):

- Events and matchers (hooks/hooks.json, PROVEN by parsing): Stop (timeout 5), PostToolUse with matcher `Write|Edit|MultiEdit|Read|Grep|Glob|AskUserQuestion|Bash|Task|TodoWrite` (timeout 5), UserPromptSubmit (timeout 3). SessionStart goes through the coordinator.
- Reads: registry, `.mindrian/conversation-operator.json`, the prompt text (classifier).
- Writes: `.mindrian/conversation-operator.json` on a transition; through `lib/core/navigation.cjs` `logOperatorTransition` an `operator_transitioned` memory_event node, two `operator` nodes and one `OPERATOR_TRANSITION` edge in `.mindrian/room.db`, only when room.db exists (without room.db the call returns `no_room_db` and writes nothing; PROVEN).
- Consumers of the state that change behavior if the state moves (PROVEN by code read, not run): scripts/intent-classifier.cjs reads `operator.getCurrent` to drive the JUST_TALK silence rule (Phase 135 SC6; default JUST_TALK today); lib/core/navigation/packet.cjs reads it for the packet operator field; scripts/statusline-fallback-echo.cjs shows it in the status line.
- Cost per firing: one Node process each for every matched tool call (10 tool names), every prompt and every Stop; a transitioning firing loads 169 repo modules. No timing was measured.

Phase 385 overlap: plan 385-08 unwires only the Stop entry and keeps the script. The PostToolUse and UserPromptSubmit entries stay and are named as owner item R2 in plan 385-12. The Stop leg is a no-op even after repair (`case 'Stop'`), so unwiring it is correct under both options.

## Required Code Changes

<!-- Only if the owner picks repair. None in this plan. -->

- Change 1 (repair path, plan 386-08):
  - Location: scripts/operator-update.cjs, function `resolveActiveRoom`
  - Current behavior: private legacy-shape read, returns null on every real registry.
  - Required behavior: call `resolveActiveRoom` from lib/core/resolve-active-room.cjs and map the result to `{slug, abs_path}`. Keep the sealed-room no-op (the canonical resolver already returns null for sealed and archived rooms).
  - Short-term patch: none needed beyond Change 1.
  - Long-term fix: the same replacement for the two contributors in the file (they share the function).
  - Plain statement: this turns on operator state transitions, room.db writes, the JUST_TALK silence rule input and the BUILD_ROOM resume hint on real installs. It is new behavior on nearly every prompt and matched tool call.
- Change 2 (unwire path): none in this plan. Phase 385 plan 08 removes the Stop entry; the owner ruling for the other two entries is item R2 of plan 385-12.

## Tests to Add or Update

- Test 1 (repair path only):
  - Type: integration
  - Location: tests/test-operator-hooks.cjs (add a keyed-shape fixture next to the legacy one)
  - Given: a registry of the shape scripts/room-registry writes
  - When: UserPromptSubmit runs with a build-room prompt
  - Then: `conversation-operator.json` shows BUILD_ROOM
  - Runner registration: existing runner of that test file.

## Non-Code Follow-ups

- CHANGELOG.md: owner of plan 386-21 handles it. No entry from this RCA.
- Release lockstep: applies only if a repair ships.
- Canon: Part 9 (the room.db write goes through the navigation chokepoint; this RCA adds no new write path). Part 8: no Brain call in the hook (PROVEN by code read: no brain client require).
- Tri-Polar: the hook fires on the CLI surface only. The state file is read by Desktop-side code through navigation packets, so a repair would change what packets carry. UNVERIFIED on Desktop and Cowork.
- Cross-platform: the hook uses `node` directly, not run-hook.cmd. Verified on Linux only.
- Fixture note: scratch files lived under the session scratchpad. No repo product file was edited.

## Resolution

root_cause: private legacy-shape registry read in scripts/operator-update.cjs `resolveActiveRoom` (see Technical Root Cause).
fix: none applied. Awaiting the owner decision (repair now, or unwire through Phase 385).
verification: see Evidence (all rows PROVEN on fixtures).
files_changed: none
commits: see git log of this file

## Owner decision

decision: unwire

- Date: 2026-11-06
- Choice: leave the operator state feature off. Do not repair the registry read. The answer reached this session through the coordinating session, relayed from the owner's answer card.
- Reason: repair would turn on room.db writes and change the JUST_TALK silence rule input, the packet operator field and the status line on every real install, for a feature that has been silent since Phase 127.3.
- Hand-off to Phase 385:
  - Plan 385-08 unwires the Stop leg of the operator-update hook and keeps scripts/operator-update.cjs unchanged.
  - The PostToolUse and UserPromptSubmit entries are item R2 of plan 385-12. The owner will rule on R2 together with this decision.
  - The feature and the SessionStart BUILD_ROOM resume hint stay off. Both use the same dead private reader.
  - A later plan may repair the read. That plan must add a keyed-shape fixture test (see Tests to Add or Update) and must record that it turns on operator transitions.
- Effect on this phase: plan 386-08 ends as a recorded skip. No product file changes in plan 386-07 or 386-08.

## Plan 386-08 gate

decision: unwire
target: PRESENT

- Checked 2026-11-06. The script scripts/operator-update.cjs exists and still holds its private `resolveActiveRoom` (legacy registry shape). The target is present, but the owner chose unwire, so the repair does not run.
- Plan 386-08 is a recorded skip. No test file was created. No product file changed. The Phase 385 hand-off in the Owner decision block above stands.
