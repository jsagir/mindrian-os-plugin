---
status: resolved
kind: rca
trigger: "resolve-active-room-cross-session-bleed"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: []
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:00:00Z
---

## Resolution

**Confirmed fixed by Jonathan (navigator), 2026-07-28.** The mechanical fix (D1+D2, Required
Code Changes 1-3) was committed on the strength of its own behavioral proof -- a deterministic
before/after hook run (2 traces in the wrong room -> 0; 0 in the right room -> 2), 13/13 in the
new regression suite, zero regressions across gates 194/198/225/rar -- the same evidence bar
already accepted for this session's other two fixes (commits `d0535d3e`, `9eabf912`).

- **root_cause:** two compounding, independent defects (see Technical Root Cause above) -- D1:
  `scripts/intent-classifier.cjs` never called the session-aware resolver at all; D2:
  `resolveWriteRoom` leg 2's path derivation was wrong for every sub-room, so even a correctly
  bound session silently fell through to the machine-wide `reg.active` value.
- **fix:** `lib/core/resolve-active-room.cjs` -- one shared `registryRoomPath` helper closes D2;
  new `resolveSessionRoom` export closes D1's missing precedence. `scripts/intent-classifier.cjs`
  repoints its three room-resolution sites at it. `resolveActiveRoom` itself is UNCHANGED (17
  legitimately machine-wide callers preserved).
  files_changed: `lib/core/resolve-active-room.cjs`, `scripts/intent-classifier.cjs`,
  `tests/test-cross-session-room-bleed.cjs` (new), `tests/run-all-194.sh`.
- **verification:** behavioral, not inspection-only -- real hook run via stdin, before/after
  trace-file counts, independently re-verified by the investigating agent itself. Committed
  `6fa37e89`.
- **The OPEN design finding below (unbound-session `active_session` field) was deliberately
  NOT folded into this pass** -- filed as its own follow-up per the navigator's own framing
  ("this pass, or filed separately") rather than decided unilaterally. Revisit as its own
  debug/phase item; the recommended direction is already written below.

## Current Focus

reasoning_checkpoint:
  hypothesis: >
    TWO compounding defects, both DISTINCT from the already-fixed c123f3d7 (which fixed the
    WRITER). D1 (reader bypass): scripts/intent-classifier.cjs resolves the room for the F.1
    navigation-engine block and the F.8/zero-score gate trace state via
    resolveActiveRoomDir() -- the machine-wide, leg-3-only resolver -- and NEVER calls the
    shipped session-aware resolveWriteRoom. So a session with a perfectly valid session.primary
    still gets whatever room another concurrent session last activated. D2 (leg-2 sub-room path
    bug): resolveWriteRoom leg 2 derives the bound room's directory as path.join(home, primary),
    which is FALSE for every sub-room (registry `path` is e.g.
    motj-ecosystem/sub-rooms/jonathan-contractor-motj). existsSync fails, leg 2 silently falls
    through to leg 3 (reg.active) -- so even when the session-aware resolver IS called, a
    sub-room binding degrades to the machine-wide bleed.
  confirming_evidence:
    - "scripts/intent-classifier.cjs:2879 `const roomDir = resolveActiveRoomDir();` feeds
       emitEngineDecisionBlock -> runNavigationEngine -> sensorCtx.roomDir + buildDialSlotContext
       -> slots.header_room = path.basename(roomDir). The F.1 card header IS the machine-wide room."
    - "intent-classifier.cjs imports ONLY resolveActiveRoomDir from the chokepoint (line 167).
       resolveWriteRoom is never imported. Grep-confirmed: zero session-aware resolution in this file."
    - "LIVE: resolveWriteRoom({sessionId:'c7149219-...'}) -- a session CORRECTLY bound to
       primary 'jonathan-contractor-motj' -- returns source:'reg.active', byte-identical to
       resolveWriteRoom({sessionId:'zzz-nonexistent'}). path.join(home,'jonathan-contractor-motj')
       does not exist; the real path motj-ecosystem/sub-rooms/... does. Leg 2 is dead for sub-rooms."
    - "LIVE PHYSICAL PROOF of the bleed: THIS session (4773eddb-92aa-4aad-9e96-f56b036aa789,
       binding = {bound:[],primary:null}) has written 14 decision traces, 86KB, into
       ~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/.mindrian/decision-traces/.
       11 distinct session ids have trace files in that one foreign room."
    - "c123f3d7's fix WORKS -- 17 session binding files exist keyed by real UUID, one written
       2026-07-27T21:02. The writer is healthy. The reader at :2879 simply never asks."
  falsification_test: >
    If intent-classifier.cjs already consulted session.primary anywhere in the F.1 path, or if
    leg 2 resolved sub-room paths correctly, a session bound to room Y would render a Y-headed
    card while reg.active=X. Harness: bind session B to Y, set reg.active=X, resolve B's room.
    Pre-fix must yield X; post-fix must yield Y. If pre-fix already yields Y, hypothesis is wrong.
  fix_rationale: >
    Do NOT session-scope resolveActiveRoom itself (RCA option (a) as literally worded): 17
    production call sites are legitimately machine-wide (doctor, room-open, statusline,
    hmi-poll, jtbd/operator commands) and two structural source-grep tripwires
    (rar.11/rar.12) pin that module's shape. Instead fix the two real defects: correct leg 2's
    path derivation through the registry (making the ALREADY-SHIPPED session precedence work
    for the first time on sub-rooms), and repoint the hook at that shipped resolver. When the
    session is unbound, leg 3 returns exactly today's value -- zero regression.
  blind_spots: >
    An UNBOUND session still inherits reg.active. That is the DOCUMENTED design contract
    (resolve-active-room.cjs:184-186 PSB-15: reg.active "is reached only when no .room-root
    wins and the session is unbound"), and this session is unbound, so this fix does NOT by
    itself stop an unbound session from citing a foreign room. Changing that is a design
    amendment with a real tier-0 regression surface, filed below as an OPEN design finding
    rather than decided unilaterally. Also unverified: whether Desktop/Cowork populate
    extra.sessionId (they use a different transport); session-presence.cjs is a dead primitive
    in practice (0 presence files on disk, registerPresence only reachable via the F.8 consumer).

hypothesis: see reasoning_checkpoint.hypothesis
test: harness in tests/test-cross-session-room-bleed.cjs -- two simulated concurrent sessions
against one MINDRIAN_ROOMS_HOME, one bound to a SUB-room, reg.active pointed at a different
room, assert each session resolves its OWN room.
expecting: pre-fix both sessions resolve reg.active (the bleed); post-fix the bound session
resolves its own sub-room and the unbound session still resolves the seed.
next_action: implement Fix A (leg-2 registry path derivation + shared resolveSessionRoom
export in lib/core/resolve-active-room.cjs) and Fix B (intent-classifier.cjs sites 588, 644,
2879 use the session-aware resolver), then run the behavioral harness before/after.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51 (HEAD at time of filing)
- Reported by: surfaced by a research fork Jonathan explicitly commissioned this session
  ("re-examine, using langtalks-graph-expert, the Larry-reach mechanism and Larry's access to
  the Brain") -- root-caused via direct source read, not guessed, then corroborated LIVE in
  real time by the very next turn's room-bind card showing `jonathan-contractor-motj` newly
  checked/active.
- Filed by: Claude, navigator-directed pattern (fold findings into a real debug session rather
  than leaving them as a report), same session as the TTL-refire fix (commit `d0535d3e`), the
  MCP-first retry-ceiling filing, and the statusline stale-pct filing.
- Related: `.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`
  (commit `c123f3d7`) -- READ THIS FIRST, it is either the same bug re-surfacing or a narrowly
  adjacent one; do not re-diagnose from scratch without confirming which.
- Observed live, all session: dozens of F.1/F.8 Decision Gate cards fired citing rooms with
  zero connection to this conversation (`jonathan-contractor-motj`, `untitled-2026-06-01-1702`,
  `polygon`, `pws-website`, `mindrianOS`, `iris2026`, `formation`, `haim-battlefield-intake`),
  every single one correctly declined per the standing judgment-gated rule. This RCA is the
  root-cause explanation for that entire pattern -- NOT the same mechanism as the
  answered-gate-refire bug already fixed today (that was about a gate re-firing after being
  answered; this is about a gate citing a room this session never touched at all).

## Problem Statement

An unbound Claude Code session's F.1 (reach) and F.8 (room-bind) Decision Gate cards cite
whichever room a completely unrelated, concurrent session on the same machine last marked
active in the shared `registry.json`, because `resolve-active-room.cjs` has no per-session
scoping -- it is machine-wide by design, and nothing upstream checks whether the CURRENT
session ever bound to that room before trusting its output.

## Scope and Impact

- Affected surfaces: any surface where multiple sessions can run concurrently against the same
  MINDRIAN_ROOMS_HOME (confirmed CLI; check Desktop/Cowork's own concurrency model during
  investigation rather than assuming parity).
- Severity: high -- this is not cosmetic. It produced dozens of confidently-rendered Decision
  Gate cards, all session, citing a room with zero relationship to the actual conversation. The
  ONLY reason it did not cause real harm is the standing judgment-gated decline rule catching
  every instance -- a less careful session (or a navigator who trusts the card's premise) could
  act on a completely wrong room context.
- Blast radius: `lib/core/resolve-active-room.cjs` (the resolver), the navigation-engine /
  dispatchSensors reach-card path (the consumer), and the F.8 room-bind emission path -- exact
  extent to be confirmed by the code read.

## Eliminated

- hypothesis: this is the SAME defect as the already-fixed
  `registry-active-room-concurrent-session-collision.md` (commit `c123f3d7`) re-surfacing on a
  different code path.
  evidence: `c123f3d7` fixed the WRITER -- `room_bind` could not persist `session.primary` on
  stdio because no session id reached it, leaving `resolveWriteRoom` leg 2 permanently EMPTY.
  That fix WORKS and is verified live: `~/MindrianRooms/.rooms/sessions/` holds 17 binding files
  keyed by real Claude session UUIDs, one written `2026-07-27T21:02:24Z` by session
  `c7149219-...`. The writer is healthy. THIS defect is on the READ side: the F.1/F.8 consumer
  (`scripts/intent-classifier.cjs`) never calls the session-aware resolver at all -- it imported
  only `resolveActiveRoomDir` (grep-confirmed, one import at line 167, zero `resolveWriteRoom`
  references in the whole file). Leg 2 being populated cannot help a caller that does not read
  it. DISTINCT defect, same symptom family.
  timestamp: 2026-07-28T03:30:00Z

- hypothesis: RCA option (a) as literally worded -- "session-scope the resolver itself" -- is the
  right fix.
  evidence: caller inventory of `lib/core/resolve-active-room.cjs` returns 17 production
  consumers, and a majority are LEGITIMATELY machine-wide with no session concept in scope:
  `lib/core/doctor/room-graph-density-module.cjs`, `lib/core/room-open.cjs`,
  `lib/statusline/ratification-next.cjs`, `scripts/check-onboard-statusline.cjs`,
  `scripts/hmi-compliance-poll.cjs`, `scripts/jtbd-command.cjs`, `scripts/jtbd-update.cjs`,
  `scripts/operator-command.cjs`, `scripts/memory-resume-nudge.cjs`. Making `resolveActiveRoom`
  session-aware would regress every one of them, and `resolveWriteRoom`'s own leg 3 CALLS
  `resolveActiveRoom`, so it would also double-read the session state inside its own precedence
  chain. Two structural source-grep tripwires (rar.11 Part 8, rar.12 Part 9) additionally pin
  that module's shape. Rejected in favour of fixing the CONSUMER plus the broken leg.
  timestamp: 2026-07-28T03:35:00Z

- hypothesis: `session-presence.cjs` (pid-liveness, `listLiveCoSessions`) can be used to detect
  "reg.active belongs to another LIVE session" and gate the unbound case on it.
  evidence: `find ~/MindrianRooms -path "*/.mindrian/sessions/*.json"` returns ZERO files.
  `registerPresence` has exactly one production call site
  (`lib/workflow/session-binding-consumer.cjs:93`), reachable only AFTER a session already
  bound through the F.8 consumer. The primitive is dead in practice for the unbound case it
  would need to serve. Not viable without separately fixing presence registration.
  timestamp: 2026-07-28T03:40:00Z

## Evidence

- timestamp: 2026-07-28T03:05:00Z
  checked: `scripts/intent-classifier.cjs:2879` and the chain it feeds.
  found: `const roomDir = resolveActiveRoomDir();` -> `emitEngineDecisionBlock(roomDir,
  sessionId)` -> `runNavigationEngine` -> `sensorCtx.roomDir` (line 1830/1833) and
  `buildDialSlotContext(ctx.roomContext, ctx.roomDir)` -> `slots.header_room =
  path.basename(roomDir)` (line 1163-1168).
  implication: the F.1 Decision Gate card's room header is LITERALLY the basename of the
  machine-wide active-room directory. No session identity anywhere in that chain.

- timestamp: 2026-07-28T03:08:00Z
  checked: live `~/MindrianRooms/.rooms/registry.json`.
  found: `active: "jonathan-contractor-motj"`, entry `path:
  "motj-ecosystem/sub-rooms/jonathan-contractor-motj"`, `last_opened: 2026-07-27T21:02:02Z`,
  registry mtime `2026-07-28 00:02:02`. `resolveActiveRoom()` returns that room for EVERY
  process on this machine right now. 37 `claude`-related processes live.
  implication: the exact room named in this RCA's live observation is the machine-wide value,
  and it is a SUB-room (which matters for the next item).

- timestamp: 2026-07-28T03:12:00Z
  checked: `resolveWriteRoom({sessionId:'c7149219-...'})` vs
  `resolveWriteRoom({sessionId:'zzz-nonexistent'})` against the live home.
  found: BOTH return
  `{slug:'jonathan-contractor-motj', abs_path:'.../motj-ecosystem/sub-rooms/...',
  source:'reg.active'}`. Session `c7149219` is CORRECTLY bound
  (`{bound:['jonathan-contractor-motj'], primary:'jonathan-contractor-motj'}`), yet resolves via
  the DEMOTED leg 3, byte-identical to a session that does not exist.
  `fs.existsSync(path.join(home,'jonathan-contractor-motj'))` is FALSE; the real nested path is
  TRUE.
  implication: D2 CONFIRMED. `resolveWriteRoom` leg 2's `path.join(home, primary)` is wrong for
  every sub-room, so leg 2 silently degrades to the machine-wide bleed even for a
  perfectly-bound session. The Phase 194 session precedence was unreachable in practice for
  sub-rooms.

- timestamp: 2026-07-28T03:20:00Z
  checked: `~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/.mindrian/decision-traces/`
  found: 11 trace files keyed by distinct session UUIDs. Among them
  `4773eddb-92aa-4aad-9e96-f56b036aa789.json` -- 86KB, 14 traces, last written 03:13 -- which is
  THIS debug session, whose binding is `{bound:[], primary:null}` and which has never touched
  that room. Also `<sessionId>.zero-score-gate-offered.json` markers for foreign sessions.
  implication: LIVE PHYSICAL PROOF. The bleed is not only cosmetic card text -- an unrelated
  session's entire F.1 reasoning trail is being written into a stranger's room directory. Canon
  Part 9 (memory locality) misattribution. Also the mechanism for gate re-fire: when reg.active
  moves mid-conversation, `consumePriorBindingAnswer(roomDir, ...)` reads the prior turn's gate
  payload from a DIFFERENT directory than `emitBindingGate` wrote it to, so an already-answered
  gate looks unanswered and fires again.

- timestamp: 2026-07-28T03:55:00Z
  checked: behavioral harness `tests/test-cross-session-room-bleed.cjs` (resolver level) and an
  end-to-end hook run (`scripts/intent-classifier.cjs` invoked with a real stdin
  `{session_id, prompt}` payload against a scratch `MINDRIAN_ROOMS_HOME`).
  found: BEFORE the fix -- session B, bound to sub-room `room-y`, with `reg.active = room-x`:
  trace files landed in `room-x` (2 files) and `room-y` (0 files). AFTER the fix: `room-x` (0),
  `room-y` (2). Resolver harness went 7-failing -> 0-failing.
  implication: the bleed reproduces and the fix closes it, proven by observed behavior on both
  the resolver and the real hook, not by code inspection.

- timestamp: 2026-07-28T04:10:00Z
  checked: `lib/mcp/surface-detect.cjs` CAPABILITY_MAP + the flag-gated
  `resolveSessionRoomDir` in the 8 MCP tool modules.
  found: `cli: {hooks:true}`, `desktop: {hooks:false}`, `cowork: {hooks:false}`. Desktop and
  Cowork never run `intent-classifier.cjs`; their equivalent room resolution is the MCP tools'
  own helper, which takes `resolveWriteRoom` ONLY when `isMcpFirst(surface)` and otherwise falls
  back to the machine-wide `resolveActiveRoom()`. `MINDRIAN_MCP_FIRST` is unset in the live
  environment.
  implication: Tri-Polar answer is NOT parity. The CLI defect is fixed at the hook. Desktop and
  Cowork carry the same machine-wide resolution on their flag-OFF path, which is the deliberate
  Phase 198-02 staged cutover (SPEC-7 byte-identical legacy), not an oversight of this fix. Fix
  A materially improves the flag-ON path they will cut over to, since sub-room bindings now
  resolve there for the first time. Cowork is the highest-exposure surface (multi-user,
  `tasks:true`, shared `00_Context/`) and should be re-checked when the flag flips.

## Technical Root Cause

Two compounding defects, both DISTINCT from commit `c123f3d7` (which repaired the WRITER):

- D1 -- Site: `scripts/intent-classifier.cjs:2879` (plus the sibling gate-state sites at 588 and
  644). The F.1 navigation-engine block and the F.8 / zero-score gate resolved their room via
  `resolveActiveRoomDir()`, the MACHINE-WIDE resolver, and the file never imported the
  session-aware `resolveWriteRoom` at all. With several concurrent CLI sessions against one
  `MINDRIAN_ROOMS_HOME`, every session therefore rendered its Decision Gate cards -- and
  persisted its decision traces -- against whichever room an unrelated session last activated.

- D2 -- Site: `lib/core/resolve-active-room.cjs`, `resolveWriteRoom` leg 2. The bound room's
  directory was derived as the bare `path.join(home, primary)`. That is false for every SUB-room
  (registry `path` is nested), so `existsSync` failed and leg 2 fell through to leg 3
  (`reg.active`). `resolveActiveRoom` had always done this derivation correctly through the
  registry entry's `abs_path`/`path` fields; leg 2 was a second, wrong copy.

Why it surfaces now: not a regression. D1 has been present since the Phase 91 navigation-engine
block; D2 since the Phase 194 leg-2 precedence shipped. They were MASKED until `c123f3d7` made
`session.primary` writable at all -- before that, leg 2 was empty for everyone, so nobody could
notice that leg 2 was also mis-deriving paths. `c123f3d7`'s RCA predicted that once the writer
worked, "Leg 3 / reg.active reverts to its intended rare-fallback role"; it never did, because
of these two defects. This RCA is that prediction being checked and found false.

## Required Code Changes

- Change 1 (D2): `lib/core/resolve-active-room.cjs` -- extract the slug-to-directory derivation
  into ONE shared `registryRoomPath(home, slug, reg)` helper (abs_path -> path -> default join,
  plus the exists-on-disk gate), use it in both `resolveActiveRoom` and leg 2. DONE.
- Change 2 (D1): `lib/core/resolve-active-room.cjs` -- add `resolveSessionRoom({sessionId,
  home})`, the session-scoped READ precedence (session.primary -> reg.active seed), and make
  `resolveWriteRoom` delegate its legs 2+3 to it so there is exactly one implementation.
  Deliberately EXCLUDES `resolveWriteRoom`'s leg 1, whose `.room-root` walk-up silently starts
  from `process.cwd()` when no filePath is supplied -- a hook must not let a shell working
  directory outrank an explicit binding. DONE.
- Change 3 (D1): `scripts/intent-classifier.cjs` -- add `resolveSessionRoomDir(sessionId,
  machineWideDir)` composing Change 2, and repoint the three roomDir sites (588, 644, 2879).
  The machine-wide value is still resolved first, but only to seed `resolveSessionId`'s sha256
  hash fallback byte-identically and to serve as the unbound-session fallback. DONE.

## Tests Added

- `tests/test-cross-session-room-bleed.cjs` (new, 12 assertions): two simulated concurrent
  sessions, one bound to a SUB-room, `reg.active` pointed elsewhere. Pins that
  `resolveActiveRoom` STAYS machine-wide (17 callers depend on it), that a bound session
  resolves its own room via `session.primary`, that an unbound session still seeds from
  `reg.active` (PSB-15 contract), that `resolveSessionRoom` ignores a cwd `.room-root` sentinel,
  and the three structural properties of the hook consumer.
- Registered in `tests/run-all-194.sh` (the owning phase runner): 14 -> 15 legs, 0 failures.

## OPEN design finding (NOT fixed here, needs a navigator call)

An UNBOUND session still inherits `reg.active`. That is the DOCUMENTED contract
(`resolve-active-room.cjs` PSB-15: reg.active "is reached only when no `.room-root` wins and the
session is unbound"), and it is what keeps a single-session tier-0 user working (Decision #8).
But on a machine with many concurrent sessions it is not a neutral seed -- it is another
session's live state. This debug session is itself the proof: unbound, 14 decision traces
written into a stranger's room.

Changing it is a design amendment, not a bug fix, and it was NOT made unilaterally because every
candidate carries a real tier-0 regression surface:
- suppress the F.1 card for unbound sessions -> kills the core card for every user who never
  binds (and `rooms-open` does not appear to bind the session);
- gate on "any binding exists on this machine" -> binding files are never garbage-collected (17
  on disk back to Jul 13), so one historical bind would permanently starve every future unbound
  session;
- gate on live co-session presence -> `session-presence.cjs` is a dead primitive (0 files on
  disk, see Eliminated);
- record `active_session` alongside `active` in `registry.json` -> the cleanest and fully
  backward-compatible option (absent field = today's behavior), but it needs a `scripts/room-registry`
  schema change plus a setter that knows the session id. RECOMMENDED next pass.

Second-order note for whoever picks this up: a chunk of the observed "cards citing irrelevant
rooms" pattern is NOT the bleed. The F.8 gate's option menu is built from `scored` -- ALL
registered rooms scored against the message (`intent-classifier.cjs:2343-2355`) -- so seeing
`polygon`, `iris2026`, `formation` listed as CANDIDATES is the gate working as designed. The
genuine bleed is the F.1 card's `header_room` and the trace write location. Worth separating
those two before measuring whether this fix reduced the observed card volume.

## Non-Code Follow-ups

- Once root-caused, cite this RCA from the `rethinking-mindrianos` Data Room per CLAUDE.md's
  Dev-Research Compositing rule (this is exactly the kind of MindrianOS-own-architecture finding
  that gets filed in both places).
- Worth checking whether this same machine-wide-resolver pattern exists anywhere else in the
  codebase (grep for other single-shared-registry reads with no session-id check) once this
  instance is fixed, since the module's own doc comment frames "active on this machine" as an
  intentional design choice that may have been copied elsewhere.
