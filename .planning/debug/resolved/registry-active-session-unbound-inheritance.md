---
status: resolved
kind: rca
trigger: "registry-active-session-unbound-inheritance"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: [8, 9]
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:00:00Z
---

## Resolution

**Confirmed on the strength of its own behavioral evidence, 2026-07-28** -- five-scenario
before/after proof (fix stashed vs applied), 37 new assertions, six independent gate suites
clean including the structural rar.11/rar.12 tripwires, fail-open verified at every uncertain
path. Same evidence bar already accepted for this session's other fixes (`d0535d3e`, `9eabf912`,
`6fa37e89`).

- **root_cause:** `registry.json`'s machine-wide `active` field carried no ownership signal, so
  an unbound session could not distinguish "I am the only live session" from "a different,
  concurrently-live session set this."
- **fix:** the sole writer (`scripts/room-registry set-active`) now stamps its own session id +
  PID alongside `active`; a new `resolveActiveOwnership` reader probes the stored PID
  (`process.kill(pid, 0)`) for a three-way unowned/mine-or-dead/foreign-live answer. Opt-in only
  (`requireOwnership`, default false) at the single F.1 hook site -- `resolveWriteRoom` and all
  9 MCP tool modules stay byte-identical, zero blast radius on the write path.
  files_changed: `scripts/room-registry`, `lib/core/resolve-active-room.cjs`,
  `scripts/intent-classifier.cjs`, `tests/test-active-session-ownership.cjs` (new),
  `tests/run-all-194.sh`.
- **verification:** behavioral, five ownership scenarios, only the foreign-live row changes
  (2 leaked traces -> 0); tier-0-no-ownership row byte-identical. Committed `3566cfaa`.
- **Residual, filed not fixed:** the F.8 binding-gate site deliberately does not opt in (would
  reopen the answered-gate-refire shape `d0535d3e` already closed) -- its marker files still
  land in the machine-wide room. Separate follow-up if it matters in practice.

## Current Focus

reasoning_checkpoint:
  hypothesis: >
    The missing THIRD state is OWNERSHIP LIVENESS, and it needs no new liveness infrastructure
    at all, because the ONLY writer of `reg.active` (`scripts/room-registry set-active`, plus
    the `create` stanza) already runs inside the owning session's own process tree and
    therefore already has BOTH halves of the answer sitting in its environment:
    `CLAUDE_CODE_SESSION_ID` (the session UUID the hook reader also uses) and `CLAUDE_PID`
    (verified live == `$PPID` == the `claude` CLI process, which lives exactly as long as the
    session). Recording those two values next to `active` turns `registry.json` itself into the
    liveness record: the reader probes the stored pid with `process.kill(pid, 0)` and gets a
    THREE-way answer -- unowned / mine-or-dead / foreign-and-live -- instead of a binary
    id match.
  confirming_evidence:
    - "LIVE, this machine: a Bash tool subprocess sees CLAUDE_PID=2561202, PPID=2561202, and
       `ps -p 2561202` is `claude`, ELAPSED 03:16:37. CLAUDE_CODE_SESSION_ID is set to this
       session's real UUID. Both signals are free at set-active time; nothing must be built."
    - "`grep -rn set-active --include=*.cjs lib/ scripts/` returns ZERO product-code callers.
       The only real writer today is the bash script invoked from inside a Claude Code session
       (via commands/rooms.md Step 3), which is exactly the process that carries those env vars."
    - "session-presence.cjs already exports `isAlive(pid)` (process.kill(pid,0), cloned from
       write-lock.cjs) as a named, tested primitive. The pid probe is REUSE, not net-new code
       (Canon Part 7). Its DEAD half (the per-room ledger) is not needed and is not revived."
    - "The F.1 bleed site is a single, already-isolated call site:
       scripts/intent-classifier.cjs:2932-2935 (machineWideDir -> sessionId -> roomDir), and
       the RCA scopes the genuine bleed to exactly that card header + trace write location."
  falsification_test: >
    Two sessions, one MINDRIAN_ROOMS_HOME. Session A sets active=room-x recording
    (active_session=A, active_session_pid=P). Session B unbound, runs the real hook.
    If the design is right: with P ALIVE, B writes 0 traces into room-x and renders no F.1
    block; with P DEAD, B writes traces into room-x exactly as today; with the ownership
    fields ABSENT, B writes traces into room-x exactly as today. If B behaves identically in
    all three, the ownership gate is not wired; if B declines in the pid-DEAD or field-ABSENT
    case, tier-0 is regressed and the hypothesis is wrong.
  fix_rationale: >
    Ownership is recorded by the writer, evaluated by the reader, and applied at ONE opt-in
    call site. `resolveActiveOwnership()` is a new pure predicate; `resolveSessionRoom` gains
    an OPT-IN `requireOwnership` flag that defaults FALSE, so `resolveWriteRoom` and all 9 MCP
    tool modules stay byte-identical (zero blast radius on the write path). Only the F.1 hook
    site opts in. Fail-open everywhere: no session id, no ownership fields, unparseable pid,
    dead pid, or any thrown error all resolve to TODAY'S behavior, which is what preserves the
    tier-0 promise by construction rather than by luck.
  blind_spots: >
    (1) PID recycling: a recycled pid reads as live and would make an unbound session decline.
    Mitigated by a generous OWNERSHIP_MAX_AGE_MS = 24h fail-open ceiling and bounded in
    consequence (a declined card, never a wrong-room claim). (2) The F.8 binding-gate site
    (intent-classifier:664) deliberately does NOT opt in, so its per-session marker files still
    land in the machine-wide room -- residual, documented, NOT silently expanded into, because
    changing it moves gate state mid-conversation when ownership flips and would re-open the
    answered-gate-refire shape. (3) Desktop/Cowork never run intent-classifier.cjs (hooks:false
    in surface-detect CAPABILITY_MAP), so their F.1 equivalent is the MCP tools' own
    flag-gated helper; the registry SCHEMA half lands for them, the reader half arrives when
    MINDRIAN_MCP_FIRST flips. Same staged-cutover posture the sibling RCA already documented.

rejected_alternatives:
  - "Revive session-presence.cjs as the liveness signal: it is PER-ROOM
    (<roomDir>/.mindrian/sessions/), so answering 'is another session live on this machine'
    means scanning every room (45 on this machine); it needs a net-new per-turn heartbeat
    write plus a reaper plus a pre-binding call site; and even fully revived it answers 'is
    SOMEONE live' not 'is the session that SET reg.active live'. Loses on cost AND precision.
    Its `isAlive` primitive is reused; its ledger is not."
  - "Age/mtime-only staleness window: needs no pid, but a user who quits Claude Code and
    reopens within the window gets an unbound session that refuses to inherit -- a direct
    tier-0 regression -- while a live-but-idle foreign session ages out and bleeds anyway.
    Wrong on both ends."
  - "flock on registry.json: serializes concurrent writes but carries no ownership
    information, so it cannot answer the question at all."
  - "Match active_session against my own id only (binary): a fresh unbound session never wrote
    active, so this is always false, which IS the already-rejected 'suppress F.1 for unbound
    sessions'."

hypothesis: this is a DESIGN IMPLEMENTATION task, not a bug hunt -- the root cause and the
recommended direction are both already fully written in the resolved sibling RCA
`.planning/debug/resolved/resolve-active-room-cross-session-bleed.md` (its "OPEN design
finding" section). Read that section in full first; do not re-derive the problem statement.
Navigator has now explicitly approved the recommended direction: record `active_session`
alongside `active` in `registry.json` (backward-compatible: an absent field reproduces today's
behavior exactly), via a schema change plus a setter that knows the session id.
test: the real design question this session needs to resolve (not yet answered by the sibling
RCA, genuinely open): once `active_session` exists, what should an UNBOUND session actually DO
with it? Simply checking "does active_session match my own session id" will almost always be
false for a fresh unbound session (it never wrote `active` itself) and would functionally
degrade to "always distrust reg.active", which is the ALREADY-REJECTED "suppress F.1 for
unbound sessions" option -- re-read why that was rejected (kills the core card for the
tier-0 single-session user who never binds) before implementing a check that accidentally
reproduces it. The design likely needs a THIRD state, not just match/no-match: e.g. distinguish
"this machine has exactly one live session right now" (safe to inherit `active`, matches the
tier-0 single-user promise) from "multiple sessions are concurrently live and reg.active was
set by a DIFFERENT one" (the actual bleed case this whole cluster exists to prevent). Investigate
whether `session-presence.cjs` (named in the sibling RCA's Eliminated section as "a dead
primitive in practice, 0 presence files on disk, registerPresence only reachable via the F.8
consumer") can be revived cheaply as part of THIS fix, since without some live-session signal,
`active_session` alone cannot distinguish those two cases.
expecting: a design that keeps the tier-0 single-session promise (an unbound session with no
concurrent siblings still inherits `active` exactly as today) while stopping the bleed
specifically when reg.active was written by a DIFFERENT, still-live session.
next_action: read the sibling RCA's OPEN design finding section in full, read
`session-presence.cjs` and its one call site to assess real revival cost, read
`scripts/room-registry` (the writer that sets `active` today) to scope the schema change, then
design before implementing -- this is exactly the kind of task where jumping straight to "add a
field, add a check" without resolving the match/no-match ambiguity above would ship a fix that
either still bleeds (if the check is too permissive) or breaks tier-0 (if too strict).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51 (HEAD at time of filing)
- Reported by: navigator explicit decision via AskUserQuestion, 2026-07-28, choosing
  "Record active_session in registry.json (Recommended)" over "leave it parked" and
  "suppress F.1 for unbound sessions", in direct response to the mechanical D1+D2 fix
  (commit `6fa37e89`) that closed the BOUND-session half of this bug cluster but explicitly
  left the unbound-session half open by design.
- Filed by: Claude, continuing the navigator-directed pattern this whole session (fold an
  approved direction into a real debug/build session rather than leaving it as a report).
- Related: `.planning/debug/resolved/resolve-active-room-cross-session-bleed.md` (READ FIRST,
  full problem context + the four candidate closures already evaluated + why three of them
  were rejected), `.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`
  (the sibling WRITER fix, commit `c123f3d7`).

## Problem Statement

An unbound Claude Code session inherits `registry.json`'s machine-wide `active` field with no
way to distinguish "I am the only live session, this is a safe single-user default" from "a
different, concurrently-live session just set this, and it has nothing to do with me."

## Scope and Impact

- Affected surfaces: any surface with concurrent sessions against one MINDRIAN_ROOMS_HOME.
- Severity: medium -- the higher-severity bound-session half is already fixed (commit
  `6fa37e89`); this is the residual unbound-session case, which the standing judgment-gated
  decline rule already catches in practice (per this whole session's live evidence), so the
  urgency is closing the gap structurally rather than relying on judgment every time.

## Technical Root Cause

Not a defect in one line of code -- a MISSING SIGNAL. `registry.json` recorded WHAT room was
active and never WHO made it active or WHETHER they are still here. With only a slug on disk,
an unbound reader has two states available (matches me / does not match me) and needs three.
Two of the three real-world situations collapse into "does not match me":

- the tier-0 restart (I quit Claude Code, reopened, my previous session set this and is gone)
  -- must INHERIT, and it is the single-session promise, Decision #8;
- the bleed (a different session set this seconds ago and is running right now)
  -- must DECLINE.

Any binary check therefore had to be wrong on one of them, which is precisely why the sibling
RCA could name the right FIELD and still not close the question.

## Required Code Changes

- Change 1 (writer): `scripts/room-registry` -- `set-active` and `create` stamp
  `active_session` / `active_session_pid` / `active_session_at` beside `active`, sourced from
  `MINDRIAN_ACTIVE_SESSION_ID|_PID` (test seams) then `CLAUDE_CODE_SESSION_ID` / `CLAUDE_PID`.
  `archive` clears them with `active`. No session id resolvable => the fields are CLEARED, so a
  manual shell `set-active` can never leave a previous session owning a room it did not choose.
  Ownership mutators defined once as `$_OWNER_PY` (the established `$NORMWIN_SHIM`
  code-interpolation pattern); every VALUE still travels by `sys.argv`, so the
  windows-python-interp structural tripwire stays green. DONE.
- Change 2 (classifier): `lib/core/resolve-active-room.cjs` -- new `resolveActiveOwnership()`
  returning `{state, owner, pid, at, inheritable}` over
  `unowned | override | anonymous-reader | self | stale | foreign-live`. Liveness composes
  `session-presence.cjs`'s shipped `isAlive` (Canon Part 7; the module's dead per-room ledger
  is NOT revived). `OWNERSHIP_MAX_AGE_MS = 24h` is a fail-open pid-recycle ceiling, not a
  liveness window, and is not a frozen-family scalar. DONE.
- Change 3 (gate): `resolveSessionRoom` gains an OPT-IN `requireOwnership` that defaults FALSE,
  so `resolveWriteRoom` and the 9 MCP tool modules are byte-identical and the write path takes
  zero blast radius. Only leg B is gated, so a bound session always outranks ownership. DONE.
- Change 4 (consumer): `scripts/intent-classifier.cjs` -- `resolveSessionRoomDir` takes
  `{requireOwnership}` and returns null on a DELIBERATE decline (a thrown fault still falls
  back to the machine-wide value). The F.1 engine-block site now gates on `roomDir` instead of
  `machineWideDir`. Sites 588/644 deliberately do NOT opt in. DONE.

## Tests Added

- `tests/test-active-session-ownership.cjs` (new, 37 assertions, ALL GREEN): real liveness
  fixtures (`process.pid` live, a reaped `spawnSync` child dead), the six-way classifier, the
  opt-in default staying byte-identical, the gate itself, the real `scripts/room-registry`
  writer including the clear-on-no-session-id case, and four END-TO-END legs that run the real
  `scripts/intent-classifier.cjs` hook and count decision-trace files on disk.
- Registered in `tests/run-all-194.sh` (the owning phase runner): 15 -> 16 legs, 0 failures.

## Non-Code Follow-ups

- Update the resolved sibling RCA's "OPEN design finding" section to point at this session's
  resolution rather than leaving it as an open question. DONE.
- Residual, deliberately not expanded into: the F.8 binding-gate site
  (`intent-classifier.cjs:664`) does not opt into the gate, so an unbound session's per-session
  gate MARKER files still land in the machine-wide room. Opting it in would move gate state
  mid-conversation whenever ownership flips (a foreign owner exiting), which is exactly the
  answered-gate-refire shape commit `d0535d3e` fixed. Closing it properly needs a stable,
  session-scoped location for unbound gate state -- its own item.
- Tri-Polar: Desktop and Cowork never run `intent-classifier.cjs`
  (`surface-detect.cjs` CAPABILITY_MAP `hooks:false`), so they get the registry SCHEMA half now
  and the reader half when `MINDRIAN_MCP_FIRST` flips and their tool modules move onto the
  session-aware resolver. Same staged-cutover posture the sibling RCA documented; Cowork stays
  the highest-exposure surface to re-check at the flip.
- CHANGELOG.md: add a Fixed entry under the next version.

## Resolution

root_cause: `registry.json` recorded the active room slug with no record of WHO set it or
whether that session is still alive, so an unbound reader could not distinguish the tier-0
restart case (inherit) from a concurrently-live foreign setter (bleed). Every binary check over
`active_session` alone had to be wrong on one of those two.

fix: stamp ownership at the writer (`scripts/room-registry`), classify it three ways at the
reader via a pid probe (`resolveActiveOwnership` in `lib/core/resolve-active-room.cjs`), and
apply it at exactly one opt-in consumer (the F.1 site in `scripts/intent-classifier.cjs`).
Fail-open on every uncertain path, so the tier-0 promise holds by construction.
files_changed: `scripts/room-registry`, `lib/core/resolve-active-room.cjs`,
`scripts/intent-classifier.cjs`, `tests/test-active-session-ownership.cjs` (new),
`tests/run-all-194.sh`.

verification: BEHAVIORAL, before/after, on the real hook (matching the bar set by commits
`d0535d3e`, `9eabf912`, `6fa37e89`). Two sessions against one scratch MINDRIAN_ROOMS_HOME,
session B unbound, decision-trace files counted on disk across five ownership scenarios.
BEFORE (fix stashed): 5/5 scenarios wrote 2 trace entries into the stranger's room, including
the bleed. AFTER: only `owner-foreign-LIVE` declined (0 files, 0 entries); tier-0-no-ownership,
owner-self, owner-foreign-exited and the 25h-stale case all still wrote 2, unchanged. The new
test file hard-fails against pre-fix code (exit 1). Also proven with the REAL production env
vars end-to-end: `create` + `set-active` in this live session stamped
`active_session=4773eddb-...`, `active_session_pid=2561202` (the actual `claude` process), a
foreign reader classified `foreign-live` + declined, this session classified `self` + inherited,
and a v3-shaped registry round-tripped `version` / `root` / `sessions` / `last_active` intact.
Gates: `build-connector-registry --check` OK; `check-shape-declaration --check` advisory WARNs
unchanged (pre-existing skills/update, skills/vault, skills/visualize); run-all-194 16/16;
run-all-198 13/13; run-all-225 5/5; run-all-127.3 2/2;
`test-resolve-active-room-canonical` 12/12 including the rar.11/rar.12 source-grep tripwires;
`test-cross-session-room-bleed`, `test-resolve-write-room`, `test-resolve-session-scope`,
`test-session-binding-file`, `test-session-binding-consumer`, `test-226-session-binding-key-alignment`,
`test-room-birth`, `test-room-state-*`, `test-tool-router-active-room-misroute`,
`statusline-active-room[-write]`, and all four `test-room-registry-windows-*` all PASS.
Zero em-dashes across every touched file.
