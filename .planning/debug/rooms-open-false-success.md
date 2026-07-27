---
status: awaiting_human_verify
kind: rca
trigger: "rooms-open-false-success"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: [7, 8, 11]
created: 2026-07-27T00:00:00.000Z
updated: 2026-07-27T00:00:00.000Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` working tree
  at `main` / `2d4aa8ce9`. Includes commit `c123f3d7` (the sibling `room_bind` stdio
  session-id fix), confirmed present.
- **WIRE claims probe against:** the 2026-07-22 live before/after ground-truth repro recorded
  in `~/MindrianRooms/rethinking-mindrianos/research/2026-07-22-room-bind-no-session-id-and-monday-class-qa/`.
  Not re-derived this session (the reproduction is already proven, not hypothesized).
- **Date of audit:** 2026-07-27
- **Scope fence:** the `room_bind` / `no_session_id` half is CLOSED
  (`.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`). This file
  covers ONLY the `orchestration` / `rooms-open` false-success gap that RCA's own Scope and
  Impact section named as separately confirmed and not covered by its fix.

## Current Focus

status: ROOT CAUSE CONFIRMED (shape (a), and it is STRUCTURAL, not one bad handler).

reasoning_checkpoint:
  hypothesis: >
    `rooms-open` has NO handler at all in the `orchestration` MCP tool. It falls through to a
    generic reference-echo fallback (`lib/mcp/tool-router.cjs:1473-1491`) shared by 18 of the
    22 orchestration commands. That fallback constructs its entire response from two sources
    that are structurally incapable of reflecting a state change: (1) `loadRoomState(roomDir)`,
    where `roomDir` is the boot-time-frozen closure directory captured once at MCP server
    start, and (2) a verbatim echo of the caller's own `room` argument under a
    `### Target Room` heading. It then appends a `Suggested Next` block whose rationale
    literally reads "Room operation complete - check status". No active-room-setting primitive
    is called, so "success" was never gated on a write happening -- there is no write.
  confirming_evidence:
    - "grep for `rooms-open` across lib/ and scripts/ returns exactly ONE hit: its membership in the ORCHESTRATION_COMMANDS enum (tool-router.cjs:302). There is no handler, no branch, no dispatch site."
    - "The orchestration tool handler (tool-router.cjs:1429-1492) has explicit branches ONLY for act/act-chain/act-dry-run/act-swarm. Every other command, rooms-open included, hits the `// All other orchestration commands use reference-based pattern` fallback at line 1473."
    - "grep for `set-active` across --include=*.cjs lib/ scripts/ returns ZERO product-code callers. The only hits are in test files (lib/memory/statusline-active-room-write.test.cjs) and two comments. No CJS code anywhere in the product ever sets the active room."
    - "`roomDir` is documented in-file (tool-router.cjs:38-47) as boot-frozen: 'the MCP server resolves its write target ONCE at boot ... A mid-session `room-registry set-active X` never reaches the long-lived server.' The orchestration router still reads raw `roomDir`, never the per-call `resolveWriteTargetDir` chokepoint that room_content/room_state were migrated to. This exactly explains the primary source's observation that the returned Room State payload matched 'neither this room's real structure nor content' -- it was some OTHER room's STATE.md."
    - "`commands/rooms.md:291-298` documents the real contract: 'Step 3: Switch Active Room -- run `bash scripts/room-registry set-active <name>`'. The reference-echo fallback returns this markdown as its `### Reference` section, i.e. it hands back the INSTRUCTIONS for the switch, wrapped in a payload shaped like a completion report."
    - "`scripts/write-scope-check.cjs:400-402` emits the observed verbatim block message 'Active room is <X>' from the unbound-session fallback leg, which compares the write target against `readActiveRoom()` (registry.json `active`). Nothing rooms-open does can move that value."
  falsification_test: >
    If shape (b) were true instead, there would be a set-active-style call somewhere on the
    rooms-open path whose error was swallowed. A repo-wide grep for every product-code caller
    of `set-active` (and for any writer of registry.json's `active` field outside
    `scripts/room-registry`) would find it. It finds none. Shape (b) is refuted; shape (a) is
    confirmed. A second falsifier: if the reference-echo path DID mutate, the boot-frozen
    `roomDir` would be irrelevant to the payload -- but the payload's Room State demonstrably
    came from the wrong room, which only the frozen-closure read explains.
  fix_rationale: >
    Two layers, because the evidence shows a shared pattern, not one bad handler.
    (1) ROOT CAUSE: give `rooms-open` a real executing handler that calls the ONE authoritative
    writer (`scripts/room-registry set-active`, per the repo's own "Bash scripts in scripts/
    stay authoritative; CJS wraps them" convention and Canon Part 7), then constructs its
    response FROM a `get-active` read-back -- the exact ground-truth check the human performed
    by hand. If the read-back does not equal the requested room, the tool returns an ERROR, not
    a success. Success becomes structurally impossible without the write landing.
    (2) STRUCTURAL CONTAINMENT: the same reference-echo fallback also asserts "Room operation
    complete" for `rooms-new`, `rooms-close`, and `rooms-archive`, which likewise never
    execute. Those get an unmissable NOT EXECUTED banner and a corrected Suggested Next
    rationale, so the shared pattern can no longer emit a completion-shaped payload for an
    operation it did not perform.
  blind_spots: >
    - Layer (2) makes the sibling mutating commands HONEST; it does not IMPLEMENT them.
      `rooms-new` has its own separate open RCA (`.planning/debug/intern-w1-rooms-new-silent-fail.md`,
      status: diagnosed) with a different root cause (birthRoom + resolve-room silent legacy
      fallback). Implementing it here would collide with that session. Cross-linked, not fixed.
    - The read-back verification uses `get-active` (registry `active`). Under heavy concurrency
      (the sibling RCA's 4-simultaneous-CLI scenario) another process could in principle flip
      `active` between the write and the read-back, producing a false `verify_failed`. That is
      a LOUD failure, not a silent success, so it fails in the safe direction. The durable
      answer is the session-binding write this handler also performs, which is per-session and
      unraceable.
    - The `check-card-fire.cjs` over-enforcement cluster is NOT proven by this RCA's evidence
      to share this root cause. Cross-linked only, per scope instructions.
  next_action: implemented -- see Resolution.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version at observation: 1.15.3-beta.47
- Reported by: Jonathan Sagir, via a criticality-ordering pass over rethinking-mindrianos
  seeds/research; underlying finding first filed by Larry 2026-07-22 as a room research entry
- Date first observed: 2026-07-22
- Related debug sessions:
  - `.planning/debug/resolved/registry-active-room-concurrent-session-collision.md` -- SIBLING,
    CLOSED. Fixed the `room_bind` `no_session_id` half (commit `c123f3d7`). Its Scope and
    Impact section named THIS gap as separately confirmed and not covered.
  - `.planning/debug/intern-w1-rooms-new-silent-fail.md` -- OPEN, status `diagnosed`. Same
    failure FAMILY (a room operation reporting success it never performed), different
    mechanism (CLI/skill narration + `resolve-room` silent legacy fallback, not the MCP
    reference-echo). Layer (2) of this fix makes the MCP `rooms-new` payload honest; it does
    not resolve that session.
  - `.planning/debug/resolved/intern-w1-room-state-false-empty.md` -- the boot-frozen `roomDir`
    stale-closure class, fixed for `room_state`'s read branches. The orchestration router was
    never migrated; this RCA is the third instance of that same unmigrated closure.
  - `~/MindrianRooms/rethinking-mindrianos/research/2026-07-22-room-bind-no-session-id-and-monday-class-qa/`
    -- PRIMARY SOURCE, the live before/after ground-truth repro.

## Problem Statement

`orchestration`'s `rooms-open` command reports success (a full, plausible "Room State" payload
with the correct target-room name in its footer) while never actually invoking the real
room-switch mechanism, leaving the shared active-room state unchanged. Any code, hook, or human
that trusts the "success" response is now operating on a false belief about which room is active.

## Symptoms

expected: after `orchestration({command:"rooms-open", room:"rethinking-mindrianos"})` returns a
success-shaped Room State payload, `bash scripts/room-registry get-active` should return
`rethinking-mindrianos`, and a subsequent Write into that room should not be blocked by
`write-scope-check.cjs`.
actual: `get-active` continued to return the PRIOR room (`iia-deeptech-centers` in the observed
live incident) after the "successful" `rooms-open` call, and the very next Write attempt into
`rethinking-mindrianos` was blocked again, verbatim: "Active room is iia-deeptech-centers."
Only calling `bash scripts/room-registry set-active rethinking-mindrianos` directly (bypassing
the MCP tool) actually changed `get-active`'s output.
errors: none surfaced -- this is the dangerous case, a confirmation-shaped success with no
error at all.
reproduction: before/after `get-active` diff around a `rooms-open` call is the whole repro.
started: not pinned to a version; first directly proven 2026-07-22, present since the
`orchestration` router's reference-echo fallback shipped.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork. This is the MCP router, so all three. Desktop and
  Cowork are WORSE off: they have no shell, so `bash scripts/room-registry set-active` is not
  available to them as a manual workaround. Before this fix the MCP surface advertised
  "multi-room management" while having NO working room-switch capability at all.
- Affected commands: `orchestration rooms-open` (primary). Structurally identical exposure on
  `rooms-new`, `rooms-close`, `rooms-archive` (state-mutating, same reference-echo fallback,
  same "Room operation complete" assertion). Read-only siblings (`rooms-list`, `rooms-where`,
  `scout*`, `models`, `admin`, `hat-briefing`, `scheduled-tasks`, `reanalyze`, `onboard`) share
  the fallback but do not claim a mutation, so their exposure is the stale-`roomDir` Room State
  block only.
- Affected users: every user on every surface who asks Larry to switch rooms and gets the MCP
  path rather than the CLI skill path.
- Severity: high -- a purpose-built "switch room" tool reporting success without switching
  poisons every downstream mechanism that trusts it (write-scope-check, statusline, cascade
  routing, room-bind agreement), and it does so silently.
- Blast radius: this is plausibly upstream of the whole "which room am I in" confusion family.
  Cross-linked, NOT claimed as proven: `check-card-fire.cjs` over-enforcement cluster.

## Eliminated

- hypothesis: shape (b) -- `rooms-open` calls a set-active-style write that silently no-ops or
  errors, with the error never propagating into the response.
  evidence: `grep -rn "set-active" --include=*.cjs lib/ scripts/` returns ZERO product-code
  call sites (only test files and two comments). Independently, the sibling resolved RCA had
  already established via `grep -rln "writeFileSync.*registry" lib/ scripts/` that no `.cjs`
  file writes `registry.json` at all -- the only writer is `scripts/room-registry` itself.
  There is no swallowed error because there is no call.
  timestamp: 2026-07-27
- hypothesis: `rooms-open` is dispatched somewhere outside `lib/mcp/tool-router.cjs` (a
  separate orchestration module) and the router entry is only an enum declaration.
  evidence: `grep -rn "rooms-open\|rooms_open" lib/ scripts/` returns exactly one hit, the
  ORCHESTRATION_COMMANDS enum membership at tool-router.cjs:302. No other file in the codebase
  mentions the command.
  timestamp: 2026-07-27
- hypothesis: the misleading "Room State" content was a rendering bug in an otherwise-working
  handler.
  evidence: the Room State block is `loadRoomState(roomDir)` reading the boot-frozen closure
  directory, documented as such at tool-router.cjs:38-47. It is not a rendering bug; it is the
  payload being assembled from ambient state that has no relationship to the requested
  operation. This is the mechanism of the false success, not a cosmetic defect.
  timestamp: 2026-07-27

## Evidence

- timestamp: 2026-07-27
  checked: `grep -rn "rooms-open\|rooms_open" lib/ scripts/`
  found: one hit only -- `lib/mcp/tool-router.cjs:302`, inside the `ORCHESTRATION_COMMANDS`
  array literal.
  implication: `rooms-open` is a declared command with no implementation anywhere. It is
  accepted by the Zod enum and then handled by whatever generic path catches unmatched
  commands.
- timestamp: 2026-07-27
  checked: `lib/mcp/tool-router.cjs:1429-1492`, the full `orchestration` tool handler
  found: explicit branches for `act`, `act-chain`, `act-dry-run`, `act-swarm` only (lines
  1431-1471). Line 1473 comment: `// All other orchestration commands use reference-based
  pattern`. Lines 1474-1491 build the response as: `loadReference(pluginRoot, command)` (a
  markdown doc off disk) + `loadRoomState(roomDir)` + echoed `context` + echoed `room` +
  `formatSuggestedNext(... 'Room operation complete - check status')`.
  implication: the response is a pure function of (disk documentation, boot-frozen ambient
  room state, the caller's own arguments). Not one byte of it derives from an operation. It is
  incapable of reporting failure because it never attempts anything.
- timestamp: 2026-07-27
  checked: `grep -rn "set-active" --include=*.cjs lib/ scripts/`
  found: zero product-code callers. Hits are `lib/memory/statusline-active-room-write.test.cjs`
  (test harness), `lib/memory/run-feynman-tests.cjs` (comment), and two explanatory comments in
  `tool-router.cjs`.
  implication: NO Node code in the shipped product has ever set the active room. The entire
  MCP surface (Desktop, Cowork, and CLI-via-tool-call) has no room-switch capability. Shape (a)
  confirmed decisively.
- timestamp: 2026-07-27
  checked: `lib/mcp/tool-router.cjs:38-47` and `:116-136` (`resolveWriteTargetDir`)
  found: the in-file comment states the MCP server freezes `roomDir` at boot and that "a
  mid-session `room-registry set-active X` never reaches the long-lived server". A per-call
  re-resolution chokepoint (`resolveWriteTargetDir`) exists and was adopted by `room_content`
  writes and (later) `room_state` reads. The orchestration router reads raw `roomDir`.
  implication: explains the primary source's exact observation -- the returned payload showed
  "13 generic VC sections, venture_stage: Investment, 35 entries, computed 2026-04-09 --
  matching neither this room's real structure nor content". That was a different room's
  STATE.md, read through the stale closure. Third instance of this unmigrated-closure class.
- timestamp: 2026-07-27
  checked: `commands/rooms.md:265-315` (Subcommand: open)
  found: the documented contract is Step 1 validate via `room-registry read`, Step 2 warn +
  await confirmation if status is `archived`, Step 3 `bash scripts/room-registry set-active
  <name>`, Step 4 report success.
  implication: the reference-echo fallback literally returns this instruction sheet as its
  `### Reference` payload. The MCP tool hands back the recipe wrapped in a wrapper that reads
  as the finished dish. Also: any executing fix MUST preserve the Step 2 archived-room human
  gate, or it would trade a false-success bug for a gate-skip bug.
- timestamp: 2026-07-27
  checked: `scripts/write-scope-check.cjs:374-403`
  found: two legs. Leg A -- if the session has a binding (`session.primary`/`bound`), authorize
  by set membership. Leg B (unbound fallback) -- `targetRoom !== activeRoom` produces the
  verbatim observed message `Blocked: write to <X> denied. Active room is <Y>.`, where
  `activeRoom` comes from registry.json.
  implication: a correct `rooms-open` must write BOTH the per-session binding (so Leg A
  authorizes this session immediately, and unraceably) AND registry `active` (so Leg B, the
  statusline, and every other `reg.active` reader agree). Writing only one leaves a
  half-switched machine.
- timestamp: 2026-07-27
  checked: `lib/core/room-discard-cascade.cjs:129-143`
  found: established in-repo precedent for a CJS module wrapping the authoritative bash
  registry script -- `child_process.execFileSync('bash', [registryScript, 'archive', slug],
  { env: { ...process.env, MINDRIAN_ROOMS_HOME: roomsHome }, stdio: 'pipe', timeout: 5000 })`.
  implication: Canon Part 7 route for the fix is settled. Wrap `scripts/room-registry`, do not
  reimplement registry writing in Node (which would create a second writer and silently skip
  set-active's own side effects: parking the old room, `last_opened`, the statusline
  `current_room` write, and the Quick-260723-ad9 STATE.md `current_room` write).

## Technical Root Cause

- Site: `lib/mcp/tool-router.cjs:1473-1491` (the `orchestration` tool's reference-echo
  fallback), reached by `rooms-open` because no handler for it exists anywhere in the codebase.
- Cause: `rooms-open` is a DECLARED-BUT-UNIMPLEMENTED command. It passes Zod validation via its
  membership in `ORCHESTRATION_COMMANDS`, misses all four `act*` branches, and lands in a
  generic fallback whose response is assembled from three sources that are all structurally
  independent of any state mutation:
    1. `loadReference(pluginRoot, command)` -- reads `commands/rooms.md` off disk via the
       `GROUPED_PREFIX_FALLBACK` family map. This is the instruction sheet, not a result.
    2. `loadRoomState(roomDir)` -- reads STATE.md from the boot-time-frozen closure directory,
       which by design never tracks room switches (documented at tool-router.cjs:38-47).
    3. `if (room) parts.push('### Target Room\n' + room)` -- a verbatim echo of the caller's
       own argument. This is the footer that read as confirmation; it confirms only that the
       caller typed the room name.
  The payload is then capped with `formatSuggestedNext(..., 'Room operation complete - check
  status')`, an explicit assertion of completion. Because no active-room-setting primitive is
  called (confirmed: zero product-code callers of `set-active` in the entire repo), success was
  never gated on a write happening. There is no swallowed error; there is no attempt.
- Why it is structural, not one bad handler: 18 of the 22 orchestration commands share this
  exact fallback. Four of them (`rooms-open`, `rooms-new`, `rooms-close`, `rooms-archive`) are
  state-mutating and all four receive the same "Room operation complete" assertion for an
  operation none of them perform. The defect is the fallback's licence to emit a
  completion-shaped payload for any command it does not implement, not the absence of one
  specific function.
- Why it surfaces now: it does not "surface now" -- it has always been this way. It became
  VISIBLE only when a `write-scope-check.cjs` block forced a human to check ground truth
  (`get-active`) immediately before and after the call. Every prior occurrence degraded
  silently into the "which room am I in" confusion family.

## Required Code Changes

- Change 1 (ROOT CAUSE):
  - Location: new `lib/core/room-open.cjs` + a new executing branch in
    `lib/mcp/tool-router.cjs`'s orchestration handler, ahead of the reference-echo fallback.
  - Current behavior: no handler; a documentation echo shaped like a completion report.
  - Required behavior: validate the room in the registry; refuse an archived room without
    explicit confirmation (preserving `commands/rooms.md` Step 2's human gate); call the ONE
    authoritative writer `bash scripts/room-registry set-active <room>`; VERIFY by reading back
    `bash scripts/room-registry get-active`; return `ok:false` unless the read-back equals the
    requested room. Also write the per-session binding so `write-scope-check.cjs` Leg A
    authorizes this session unraceably.
  - Why not a post-hoc check bolted on the end: the verification read-back is not the fix, it
    is the proof. The fix is that the operation now HAPPENS and the response is constructed
    from its verified result rather than from echoed inputs.
- Change 2 (STRUCTURAL CONTAINMENT):
  - Location: `lib/mcp/tool-router.cjs`, the reference-echo fallback.
  - Current behavior: emits "Room operation complete - check status" for every `rooms-*`
    command, including three that never execute.
  - Required behavior: an explicit set of declared-but-unimplemented MUTATING commands
    (`rooms-new`, `rooms-close`, `rooms-archive`) receives an unmissable NOT EXECUTED banner
    and a Suggested Next rationale that does not claim completion.
  - Not in scope: implementing those three. `rooms-new` has its own open RCA with a different
    root cause.

## Tests to Add or Update

- Test 1 (the regression test that would have caught this): given a temp `MINDRIAN_ROOMS_HOME`
  with two registered rooms and `active` = room A, when `openRoom({ room: 'B' })` runs, then
  `room-registry get-active` must actually return `B`. Asserts GROUND TRUTH, not response shape.
- Test 2: a structural tripwire asserting the `orchestration` handler does not reach the
  reference-echo fallback for `rooms-open`, and that no mutating orchestration command can emit
  the "operation complete" assertion without an executing handler.
- Test 3: failure paths return `ok:false` -- unknown room, archived room without confirmation,
  and a verify-failed read-back mismatch.

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under `[Unreleased] -- v1.15.3-beta.49`.
- Release lockstep: N/A. No version bump; this rides the in-progress beta.49 entry.
- Canon: Part 7 honored (wraps `scripts/room-registry`, mints no second registry writer).
  Part 8 honored (`room-open.cjs` reads local files and spawns a local script; zero network).
  Part 11 unaffected (no new invocable surface; `rooms-open` was already declared and
  projected, it just had no implementation).
- LOWER-SEVERITY GAP LEFT OPEN DELIBERATELY: the read-only siblings on the same fallback
  (`rooms-list`, `rooms-where`, `scout*`, `models`, `admin`, `reanalyze`, `onboard`,
  `hat-briefing`, `scheduled-tasks`) still return documentation where a caller may expect data,
  and still read STATE.md through the boot-frozen `roomDir`. They cannot produce this RCA's
  proven failure class (a false claim about a state change), so they are documented rather than
  changed. Implementing them is feature work, not this bug fix.
- `.planning/debug/intern-w1-rooms-new-silent-fail.md` stays OPEN. Its own root cause
  (`resolve-room` silent legacy fallback + a skipped B1/B2 gate) is untouched here. The only
  change affecting it is that the MCP `rooms-new` payload can no longer claim completion.
- Cross-link only, NOT proven by this RCA's evidence: the `check-card-fire.cjs`
  over-enforcement cluster and `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`
  speculate this defect is upstream of the "which room am I in" family. This investigation
  proves the mechanism of the false success; it does not prove that mechanism causes the
  card-fire instances. Do not close those on the strength of this fix.
- Dev-research compositing: mirror this RCA's finding back into
  `~/MindrianRooms/rethinking-mindrianos/research/2026-07-22-room-bind-no-session-id-and-monday-class-qa/`
  as the resolution of its Section 1(b) (currently marked "status=active, owner=unassigned,
  target=TBD").

## Resolution

root_cause: `rooms-open` was a DECLARED-BUT-UNIMPLEMENTED command. Membership in the
`ORCHESTRATION_COMMANDS` Zod enum made it a valid, accepted call; no handler existed anywhere
in the codebase (single grep hit, the enum entry itself); so it fell through to the generic
reference-echo fallback at `lib/mcp/tool-router.cjs:1473-1491`, shared by 18 of the 22
orchestration commands. That fallback assembles its response from three sources that are all
structurally independent of any state mutation -- `commands/rooms.md` read off disk (the
instruction sheet), STATE.md read through the boot-time-frozen `roomDir` closure (some other
room's content, which is why the payload matched neither the requested room's structure nor
its content), and a verbatim echo of the caller's own `room` argument under a `### Target Room`
heading (the footer that read as confirmation) -- and then appended a Suggested Next rationale
literally asserting "Room operation complete - check status". Success was never gated on a
write because no write was ever attempted: a repo-wide grep confirmed ZERO product-code callers
of `room-registry set-active`, meaning the entire MCP surface advertised multi-room management
while possessing no room-switch capability at all. This is hypothesis shape (a) from the
Current Focus, and it is STRUCTURAL rather than one bad handler: four state-mutating commands
(`rooms-open`, `rooms-new`, `rooms-close`, `rooms-archive`) reached the same fallback and all
four received the same completion assertion for operations none of them performed.

fix:
  1. ROOT CAUSE -- new `lib/core/room-open.cjs`, the one "switch the active room" chokepoint.
     It validates the room against the registry, preserves the `commands/rooms.md` Step 2 human
     gate (an archived room is REFUSED with `archived_needs_confirmation` unless the caller
     passes `confirmArchived: true`, so fixing a false-success bug does not introduce a
     gate-skip bug), calls the one authoritative writer `bash scripts/room-registry set-active`
     (Canon Part 7: wraps the script rather than minting a second registry writer, which would
     also have skipped set-active's own side effects -- parking the previous room, stamping
     `last_opened`, the statusline `current_room` write, and the STATE.md `current_room` write),
     and then READS `get-active` BACK off disk. `ok: true` is returned only when that read-back
     equals the requested room. Every other path returns `ok: false` with a machine-readable
     reason. It additionally writes the per-session binding (with the same rooms-home, see the
     self-caught defect below) so `write-scope-check.cjs` Leg A authorizes this session by
     bound-set membership rather than depending on the raceable global `reg.active` field the
     sibling RCA documented. `lib/mcp/tool-router.cjs` now dispatches `rooms-open` to this
     chokepoint BEFORE the reference-echo fallback, constructs its success payload from the
     verified result, reads the SWITCHED room's STATE.md (not the boot-frozen closure's), and
     returns an explicit `isError` response naming the reason on any failure.
  2. STRUCTURAL CONTAINMENT -- a new `UNIMPLEMENTED_MUTATING_ORCHESTRATION` set
     (`rooms-new`, `rooms-close`, `rooms-archive`) makes the shared fallback incapable of
     claiming completion for a mutation it never performed: those commands now carry an
     explicit NOT EXECUTED banner and a Suggested Next rationale that does not assert
     completion, and the argument echo is relabelled "Requested Room (echo of your argument,
     not a confirmation)". The set carries a stated membership rule: a command belongs there
     if it mutates persistent state AND has no executing branch; adding a handler removes it.
     These three are deliberately NOT implemented here -- `rooms-new` has its own open RCA with
     a different root cause.
  Explicitly rejected: bolting a post-hoc verification step onto the end of the existing
  fallback. The read-back is the PROOF, not the fix; the fix is that the operation now happens
  and the response is constructed from its verified result instead of from echoed inputs.

self_caught_defect: the first run of the new regression suite FAILED T6 -- `openRoom` called
`writeSessionBinding` without forwarding the rooms-home, and `session-binding.cjs` resolves its
home independently (`opts.home` > `MINDRIAN_ROOMS_HOME` > `os.homedir()`). The binding was
landing in the ambient default home while the registry flip landed elsewhere: a half-switched
machine in production, and in tests a write straight through the hermetic fixture into the real
`~/MindrianRooms/.rooms/sessions/` (the stray file was found and removed). Fixed by passing
`{ home: roomsHome }`. Worth recording because this is the same class of bug as the one under
investigation -- an operation reporting success while its effect landed somewhere nobody was
looking -- and it was caught only because the test asserts ground truth off disk rather than
inspecting the return value.

verification:
  - `node tests/test-rooms-open-actually-switches.cjs` (NEW, 10 assertions) -- ALL PASS.
    Every assertion reads registry ground truth via `bash scripts/room-registry get-active`,
    deliberately NOT the return value, because the bug being guarded produced a perfect-looking
    return value. T1 is the live 2026-07-22 shape (active = A, open B, ground truth must say B).
    T2 a blocked write never yields ok:true. T3 unknown room refused, active untouched. T4 the
    archived-room human gate holds and then permits on explicit confirmation. T5 empty and
    traversal-shaped args refused. T6 the session binding lands in the right rooms-home. T7 a
    structural tripwire that fails if `rooms-open` ever loses its executing branch or its
    chokepoint import, or if a mutating sibling loses the NOT EXECUTED containment. T8-T10 run
    END TO END through the real registered `orchestration` MCP handler via the fake-McpServer
    harness: T8 proves a tool call moves ground truth with the boot `roomDir` deliberately
    pointed at the WRONG room, T9 proves a failed switch returns `isError` and never emits the
    confirmation-shaped `### Target Room` footer, T10 proves the mutating siblings say NOT
    EXECUTED and never "Room operation complete".
  - 14 related pre-existing suites, 0 failures: test-205-surface-fence,
    test-198-contract-schema, test-198-flag-off-parity, test-198-concurrency-mcp,
    test-room-bind-stdio-session-fallback, test-tool-router-active-room-misroute,
    test-tool-router-grouped-reference, test-room-state-active-room-misroute,
    test-room-state-no-registry-regression, test-write-scope-set-membership,
    test-resolve-write-room, test-session-binding-file, test-226-session-binding-key-alignment,
    test-resolve-active-room-canonical.
  - Gates: `build-orchestration-projection --check` OK, `build-connector-registry --check` OK,
    `check-render-coverage` 0 gap / 0 unwired, `doctor --acceptance` 14/15 (the single FAIL is
    `verify-release-clean-tree`, which reports the uncommitted working tree and is an artifact
    of having pending changes, not a defect).
  - Cross-platform: `room-open.cjs` uses the repo's established `execFileSync('bash', [script])`
    convention (same as `lib/core/room-discard-cascade.cjs:134`). If bash or python3 is
    unavailable, `runRegistry` returns null and the tool reports `set_active_failed` LOUDLY.
    Degradation is a visible failure, never a false success -- the exact property this RCA is
    about.
  - Tri-Polar: this is the MCP router, so the fix lands on CLI, Desktop, and Cowork together.
    Desktop and Cowork gain a working room switch for the first time (they have no shell, so
    the manual `bash scripts/room-registry set-active` workaround was never available to them).
    The CLI skill path (`commands/rooms.md`) is unchanged and still authoritative.
  - No em-dashes in any added file (grep-verified).

files_changed:
  - lib/core/room-open.cjs (NEW -- the room-switch chokepoint)
  - lib/mcp/tool-router.cjs (executing rooms-open branch + UNIMPLEMENTED_MUTATING_ORCHESTRATION containment + confirmArchived schema field + extra param for session id)
  - tests/test-rooms-open-actually-switches.cjs (NEW -- 10 ground-truth regression tests)
  - CHANGELOG.md (Fixed entry under [Unreleased] v1.15.3-beta.49)
  - .planning/debug/rooms-open-false-success.md (this file)
