---
status: investigating
kind: rca
trigger: "registry-active-room-concurrent-session-collision"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-22T20:20:00Z
updated: 2026-07-22T20:20:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` working tree (includes commit `0bec81b9`, the F-01 fix, already applied here). NOT yet re-verified against `origin/main` HEAD.
- **WIRE claims probe against:** live behavioral observation in this Claude Code CLI session, plus the deployed install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.34/` (confirmed identical to the dev copy for every file inspected: `scripts/room-registry`, `lib/core/resolve-active-room.cjs`).
- **Date of audit:** 2026-07-22
- **Re-verification rule:** the code-site claims below (tool-router.cjs line numbers, session-binding.cjs function names) must be re-checked against `origin/main` HEAD before this is treated as closed; this session worked entirely from the working tree.

## Current Focus

hypothesis: `session.primary` (the per-session write-target binding) can never be written for
any stdio-connected Claude Code CLI session, because its only writer lives inside `room_bind`'s
MCP handler, which always returns early with `no_session_id` on stdio (no `extra.sessionId`).
This forces every CLI session's write-target resolution to fall through to the single, global,
un-locked `registry.json` `active` field (Leg 3 of `resolveWriteRoom`) -- and with multiple
concurrent `claude` CLI processes confirmed running on this machine right now, each with its own
MCP server, that shared field becomes a last-writer-wins race between unrelated sessions.
test: confirmed via static trace (see Evidence) that `writeSessionBinding` has exactly one
call site in the entire codebase, gated behind the `no_session_id` early return.
expecting: with that call site unreachable on stdio, `session.primary` should be absent from
every real session file created during a normal CLI session. Not yet directly checked by
reading an actual `.mindrian/sessions/*.json` file from a live session -- see Still Open.
next_action: read a live session-binding file from one of the 4 running `claude` processes'
`.mindrian/` state (or this session's own) to directly confirm `primary` is unset, closing the
one remaining static-trace-only gap in this chain.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.34 (this session), 1.15.3-beta.32 (two other concurrently-running
  `claude` processes on the same machine, see Evidence)
- Reported by: Jonathan Sagir (session run via `/mos:root-cause "run it on the dev !"`)
- Date first observed: 2026-07-22
- Related debug sessions: none found under this slug family; related room content filed at
  `~/MindrianRooms/rethinking-mindrianos/research/2026-07-22-room-bind-no-session-id-and-monday-class-qa/`
  (same-day sibling investigation, room-artifact side rather than dev-repo side)

## Problem Statement

The shared room registry's `active` room field reverts to a different room within seconds of
being explicitly set, with no action taken by the session that set it -- observed live, twice,
in one conversation.

## Symptoms

expected: `bash scripts/room-registry set-active <room>` followed immediately by
`get-active` returns `<room>`, and that value holds until this session explicitly changes it
again.
actual: `set-active jonathan-sagir` -> `get-active` returned `jonathan-sagir` (correct,
immediate). Within roughly one tool-call's worth of wall-clock time, a `PreToolUse:Edit`
`write-scope-check` hook reported `Active room is iia-deeptech-centers`, and a direct
`get-active` re-check confirmed the file itself now said `iia-deeptech-centers` -- a room
never mentioned anywhere in this session.
errors: hook error text: `Blocked: write to jonathan-sagir denied. Active room is
iia-deeptech-centers.` (verbatim, `write-scope-check.cjs`'s PreToolUse block message).
reproduction:
  1. `bash scripts/room-registry set-active <room-A>`
  2. `bash scripts/room-registry get-active` -> confirms `<room-A>` immediately
  3. Perform one or more unrelated MCP tool calls / wait a short interval
  4. `bash scripts/room-registry get-active` (or trigger a `write-scope-check` PreToolUse hook)
     -> returns a DIFFERENT room (`iia-deeptech-centers` in both observed instances)
started: not a regression pinned to a version; this is architecture that has likely always
behaved this way on any machine running more than one concurrent Claude Code CLI session
against the same `MINDRIAN_ROOMS_HOME`.

## Scope and Impact

- Affected surfaces: cli (this is a stdio-specific failure mode; desktop/cowork use a
  different MCP transport that may populate `extra.sessionId`, unconfirmed either way, see
  Still Open)
- Affected commands: any Write/Edit tool call gated by `write-scope-check.cjs`; `room_bind`
  MCP tool directly; `orchestration rooms-open`
- Affected users: any user who runs more than one `claude` CLI session concurrently against
  the same `~/MindrianRooms` (confirmed: this machine has 4 concurrent `claude` processes
  right now, 2 on beta.32, 2 on beta.34)
- Version range: present in 1.15.3-beta.32 and beta.34 (both observed running concurrently);
  likely present since `room_bind` (Phase 198-02) and the Leg-2/Leg-3 `resolveWriteRoom`
  precedence (referenced as PSB-02/PSB-15) shipped
- Severity: high -- silent cross-session data misattribution risk (a write intended for room A
  can be scope-checked against room B's identity), not just an annoyance
- Blast radius: `write-scope-check.cjs` (this session's F-01 fix only touches its OWN
  fallback-hash identity, not this Leg-2/Leg-3 issue), `room_bind` MCP tool, `orchestration`
  tool's `rooms-open` command (separately confirmed to report success without calling
  `room-registry set-active` -- see `2026-07-22-room-bind-no-session-id-and-monday-class-qa/`
  research entry for that sibling finding), any future feature that trusts `session.primary`

## Eliminated

- hypothesis: F-01 (wrong `CLAUDE_SESSION_ID` vs real `CLAUDE_CODE_SESSION_ID` env var name in
  `write-scope-check.cjs`) fully explains the observed active-room reversion.
  evidence: F-01 only affects `write-scope-check.cjs`'s own internal fallback-hash identity
  computation (used for its day-hash last-resort). It does not write `registry.json`, and does
  not touch `resolveWriteRoom`'s Leg 2/Leg 3 precedence at all. Fixing it (commit `0bec81b9`,
  tested, verified) does not, by itself, stop two concurrent sessions from overwriting the
  same global `active` field. Real bug, real fix, wrong scope for this specific symptom.
  timestamp: 2026-07-22T19:40:00Z
- hypothesis: `registry.json` writes are corrupted or non-atomic (a torn write).
  evidence: `scripts/room-registry`'s own header comment states it manages the file "with
  atomic writes (tmp + mv)". Atomicity rules out corruption; it does not rule out (and does
  not attempt to rule out) a clean, complete, unwanted overwrite from a second concurrent
  writer.
  timestamp: 2026-07-22T20:05:00Z

## Evidence

- timestamp: 2026-07-22T19:50:00Z
  checked: `ps -eo pid,ppid,etime,cmd | grep -i claude`
  found: 4 distinct `claude` CLI processes currently running on this machine (PIDs 12748,
  50996, 89826, 107207), each spawning its own `mindrian-mcp-server.cjs` child process. Two
  on plugin version 1.15.3-beta.32, two on 1.15.3-beta.34 (this session is one of the
  beta.34 pair).
  implication: multiple independent MCP server instances are live simultaneously, each
  capable of calling `room-registry set-active` against the SAME shared
  `~/MindrianRooms/.rooms/registry.json`, with no evidence of any cross-process coordination.
- timestamp: 2026-07-22T20:00:00Z
  checked: `grep -n "room_bind" lib/mcp/tool-router.cjs`
  found: lines 1461-1464 -- `const effectiveSessionId = sessionId || (extra && extra.sessionId)
  || null; if (!effectiveSessionId) return textResponse(JSON.stringify({ ok: false,
  reason: 'no_session_id' }, ...), true);`
  implication: `room_bind` requires an explicit `sessionId` tool argument (nothing in this
  stack currently supplies one automatically) or SDK-populated `extra.sessionId`. On stdio,
  per this file's own comment at line 110 ("undefined on stdio / unbound"), `extra.sessionId`
  is never populated, so this branch is taken on every stdio call, every time.
- timestamp: 2026-07-22T20:08:00Z
  checked: `grep -n "writeSessionBinding" lib/mcp/tool-router.cjs`
  found: exactly two call sites, both inside `room_bind`'s handler (lines 1469 and 1480),
  both unreachable when `effectiveSessionId` is null.
  implication: `writeSessionBinding` -- the only function in the codebase that sets
  `session.primary` -- has no other caller. `session.primary` cannot be populated by any
  means other than a successful `room_bind` call. On stdio, `room_bind` never succeeds
  (previous evidence item), so `session.primary` is architecturally unreachable for the CLI
  surface as currently wired.
- timestamp: 2026-07-22T20:12:00Z
  checked: `lib/core/resolve-active-room.cjs` (`resolveWriteRoom`, lines 169-243), read in full
  found: documented 3-leg precedence -- Leg 1 `.room-root` walk-up, Leg 2 `session.primary`
  (only when the room exists on disk), Leg 3 `reg.active` "DEMOTED to the fresh-session
  seed-default", explicitly commented as reached "only when no `.room-root` wins and the
  session is unbound."
  implication: with Leg 2 permanently dead on CLI (previous two evidence items) and no
  `.room-root` sentinel present in most write targets, EVERY CLI write-target resolution
  falls to Leg 3 -- the single shared file -- regardless of session, by design intended to be
  a rare fallback but in practice the ONLY leg that ever fires on this surface.
- timestamp: 2026-07-22T20:15:00Z
  checked: `grep -rln "writeFileSync.*registry" lib/ scripts/` (looking for a second, hidden
  writer of `registry.json`)
  found: no `.cjs`/`.js` file writes `registry.json` directly; the only writer is
  `scripts/room-registry` itself (confirmed via its own `old_active = reg.get('active', '')`
  read-then-write pattern, atomic tmp+mv).
  implication: rules out a rogue JS module as a second writer. The write path itself is
  singular and clean; the contention is purely inter-PROCESS (multiple invocations of the
  same script from different sessions), not inter-CODE-PATH.
- timestamp: 2026-07-22T19:08:14Z (file mtime, captured live during the incident)
  checked: `stat -c '%y' ~/MindrianRooms/.rooms/registry.json`
  found: mtime matches the observed window of the second live reversion (`rethinking-mindrianos`
  -> `iia-deeptech-centers`), consistent with a write landing from an outside process during
  this session's own tool-call sequence.
  implication: corroborates timing, though does not by itself identify WHICH of the other 3
  running `claude` processes performed the write (see Still Open).

## Technical Root Cause

- Site: `lib/mcp/tool-router.cjs:1461-1464` (function: the `room_bind` tool handler) +
  `lib/core/resolve-active-room.cjs:201-243` (function: `resolveWriteRoom`)
- Cause: `room_bind` is the sole writer of `session.primary` (via `writeSessionBinding`,
  `lib/core/session-binding.cjs:107`), and it hard-requires a truthy `sessionId` (explicit
  param or MCP SDK `extra.sessionId`). The stdio transport used by local Claude Code CLI
  sessions never populates `extra.sessionId` (acknowledged in this file's own comment,
  line 110), and nothing in this stack currently supplies an explicit `sessionId` argument
  automatically. Consequently `session.primary` is never written for any CLI session, Leg 2
  of `resolveWriteRoom` is permanently unreachable on this surface, and every CLI write-target
  resolution falls to Leg 3 -- the single, un-locked, machine-wide `registry.json` `active`
  field. With multiple concurrent `claude` CLI processes on one machine (confirmed: 4, right
  now), each independently calling `room-registry set-active` for its own room, that shared
  field becomes a last-writer-wins race across unrelated, uncoordinated sessions.
- Why it surfaces now: not a new regression -- a structural gap present since `room_bind`
  (Phase 198-02) and the Leg 2/Leg 3 precedence shipped. It surfaces as a VISIBLE symptom only
  when (a) more than one `claude` CLI session is open against the same `MINDRIAN_ROOMS_HOME`
  at once, which this machine's actual usage pattern (4 concurrent sessions) satisfies daily,
  and (b) a session tries to rely on `reg.active` staying stable across more than a few
  seconds, which every hook and tool that reads "the active room" implicitly does.

## Required Code Changes

- Change 1:
  - Location: `lib/mcp/tool-router.cjs:1461-1464`, `room_bind` handler
  - Current behavior: returns `no_session_id` and gives up whenever `extra.sessionId` is
    absent and no explicit `sessionId` argument was passed.
  - Required behavior: on stdio (no `extra.sessionId`), derive a stable per-process session
    identifier as a fallback instead of failing outright -- for example `process.ppid` (the
    parent `claude` CLI process id) combined with process start time, or by threading through
    whatever value the harness already uses for `CLAUDE_CODE_SESSION_ID` (see the sibling F-01
    finding) as the `sessionId` default when the tool caller does not supply one explicitly.
  - Short-term patch: accept `process.env.CLAUDE_CODE_SESSION_ID` as a fallback `sessionId`
    source inside `room_bind` itself, mirroring the pattern F-01 already established in
    `write-scope-check.cjs`.
  - Long-term fix: a documented, tested stdio session-identity contract shared by every
    consumer (`room_bind`, `write-scope-check.cjs`, `intent-classifier.cjs`, etc.) so there is
    exactly one way stdio sessions get identified, not one per file.
- Change 2:
  - Location: `scripts/room-registry` (the `set-active` code path)
  - Current behavior: atomic tmp+mv write of the whole registry, with no cross-process lock
    and no per-session scoping -- any invocation from any session overwrites the single
    `active` field machine-wide.
  - Required behavior: treat `reg.active` as informational/legacy only once Change 1 ships
    (i.e. stop having tools read `reg.active` as an authority once `session.primary` is
    reliably populated), OR add a real advisory lock (flock) around read-modify-write so at
    least concurrent writes serialize instead of silently racing.
  - Short-term patch: none recommended -- locking without fixing Change 1 only serializes the
    race, it does not stop unrelated sessions from still overwriting each other's intended
    "active" room.
  - Long-term fix: Change 1 (session-scoped binding working on stdio) should make Leg 3 truly
    rare, per its own "DEMOTED... fresh-session seed-default" design intent; once that is real,
    the multi-writer risk on `reg.active` naturally shrinks to first-time/unbound sessions only.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `lib/mcp/tool-router.test.cjs` (or a new `room-bind-stdio-fallback.test.cjs`)
  - Given: `room_bind` called with no explicit `sessionId` and `extra.sessionId` undefined
    (the stdio shape), but `process.env.CLAUDE_CODE_SESSION_ID` set
  - When: the tool handler runs
  - Then: it does NOT return `no_session_id`; it writes a `session.primary` binding keyed by
    the env-derived id
- Test 2:
  - Type: integration
  - Location: a new test alongside `tests/test-226-session-binding-key-alignment.cjs`
  - Given: two simulated concurrent "sessions" (two different env-derived session ids) each
    call `room-registry set-active` for a different room
  - When: each session's own `resolveWriteRoom` is then called
  - Then: each session resolves ITS OWN room via Leg 2 (`session.primary`), not whichever
    room the other session set most recently via Leg 3

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry for F-01 under the next version (already committed,
  `0bec81b9`); add a separate Known Issue or Fixed entry once Change 1/2 above ship.
- Release lockstep: N/A until Change 1/2 are implemented and ready to ship.
- Canon: none identified yet; re-check once Change 1 is implemented (may touch Part 9 memory
  locality if session-scoping logic changes how writes are attributed).
- knowledge-base.md: add a summary block once this moves to `resolved`.
- Docs / monitoring / process notes: worth a `doctor.cjs --acceptance` check that counts
  concurrent `claude` processes against the same `MINDRIAN_ROOMS_HOME` and warns, since this
  machine's normal usage pattern (4 concurrent sessions today) makes this a routine trigger,
  not an edge case.

## Resolution

root_cause: `room_bind` cannot write a per-session room binding on stdio (no session id
available to it), so every CLI session's write-target resolution permanently falls through to
the single, unlocked, machine-wide `registry.json` active-room field, which multiple
concurrent CLI sessions on this machine (confirmed: 4, right now) then race to overwrite.
fix: not yet implemented (Required Code Changes above are proposed, not applied). F-01 (a
related but distinct bug -- wrong env var name in `write-scope-check.cjs`'s own fallback
identity hash) was found and fixed separately this same session, commit `0bec81b9`; it does
not resolve this issue.
verification: pending Change 1/2 implementation.
files_changed:
  - none yet for this specific finding (F-01's file is `scripts/write-scope-check.cjs`,
    already committed separately)
commits: none yet for this finding
