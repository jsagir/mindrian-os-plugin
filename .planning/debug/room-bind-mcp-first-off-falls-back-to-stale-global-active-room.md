---
status: diagnosed
kind: rca
trigger: "room-bind-mcp-first-off-falls-back-to-stale-global-active-room"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [9, 11]
created: 2026-07-28T04:00:43Z
updated: 2026-07-28T04:08:55Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED - `room_bind` reports success and names the correct room, but every MCP read tool ignores that session-scoped binding unless `MINDRIAN_MCP_FIRST` covers the calling surface (unset by default), and falls back through the global `resolveActiveRoom()` registry pointer to a frozen boot-time `fallbackRoomDir` closure instead.
test: live-fired `room_bind({room: "mindrianOS"})` then `suggest_next` / `reach_candidates` in the same MCP session, before and after correcting the global registry pointer with `room-registry set-active mindrianOS`.
expecting: after `room_bind` succeeds, subsequent tool calls in the SAME session resolve to the bound room regardless of the global registry or the MCP-first flag state.
next_action: NONE for this session (goal: diagnose_and_route only, per explicit instruction not to jump the Phase 235 -> 237 dependency order). Route as an already-scoped input to Phase 237 (REACH-03) in .planning/ROADMAP.md; do not re-plan Phase 237 itself; do not implement the structural fix out of sequence.

## Source-of-Truth Preamble
<!-- MANDATORY per docs/RCA-TEMPLATE.md section 2.5. Added 2026-07-28T04:08Z during validation. -->

- **CODE claims read against:** dev repo `/home/jsagi/dev/MindrianOS-Plugin` @ local HEAD `f0e4a439` (19 commits ahead of `origin/main` @ `b6683bea`, 0 behind). NOT the install cache.
- **WIRE claims probe against:** the live MCP session's own server, served from the marketplace install cache `~/.claude/plugins/mindrian-os/` @ v1.15.3-beta.50.
- **Date of audit:** 2026-07-28
- **Re-verification rule discharged:** YES. The cited site `lib/mcp/tools/sensors.cjs:58-71` `resolveSessionRoomDir` is **byte-identical on `origin/main`** (verified `git show origin/main:lib/mcp/tools/sensors.cjs`, same line numbers 58-71, same `isMcpFirst` gate, same `resolveActiveRoom()` fallthrough, same `fallback` return). The `mcp-first-flag.cjs` delta between HEAD and `origin/main` is purely ADDITIVE (Phase 234-05's `isWritePathEnabled`); `isMcpFirst` itself is byte-unchanged and still defaults OFF on both. No finding here is tagged `needs-source-reverify`.
- **Known CODE-vs-WIRE delta:** the 19 local commits ahead of `origin/main` are NOT in the beta.50 cache the wire probe hit. This delta does NOT invalidate any finding above, because the specific cited functions were confirmed identical across all three points (cache-era behavior, `origin/main`, and local HEAD). Recorded here so a future reader does not have to re-derive it (the 2026-05-23 false-positive pattern this preamble exists to prevent).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.50 (marketplace cache; see Source-of-Truth Preamble for the code-vs-wire split)
- Target version: TBD (Phase 237)
- Reported by: Larry (this session's own live investigation), prompted by the navigator asking to scrutinize whether the SENS sensor spine invocation is properly wired and triggers
- Date first observed: 2026-07-28
- Related debug sessions:
  - `.planning/debug/intern-w1-rooms-new-silent-fail.md` - same "room-state cluster" family: an MCP/orchestration path reports room-state success without the underlying state actually changing (there: `rooms-new`/`birthRoom()` never invoked; here: `room_bind`'s effect is silently gated behind an unrelated flag).
  - `.planning/debug/intern-w1-research-reach-broken.md` - sibling reach-dispatch failure (the `deep_research` reach echoes doc-spec text instead of executing); different mechanism, same theme of a reach silently not doing what it claims.
  - `.planning/debug/cascade-rooms-module-ignores-abs-path-registry-field.md` - worth checking for registry-field overlap (not yet cross-checked this session).
  - Room-side durable copy: `rethinking-mindrianos/research/2026-07-22-room-bind-no-session-id-and-monday-class-qa/` - the 2026-07-22 entry that first proved "an MCP tool reported success without changing the state it claims to control" (there via `room_bind` outright `no_session_id` failure and a `rooms-open` no-op). This file is the same root-cause family's second, differently-shaped reproduction.

## Problem Statement

`room_bind({room: "mindrianOS"})` returns a clean success naming the right room, but every MCP read-path tool in the same session (`suggest_next`, `reach_candidates`, and by identical shared code pattern also `room.cjs`, `graph.cjs`, `gate.cjs`, `chain.cjs`, `status.cjs`, `views.cjs`) silently ignored that binding and resolved to an unrelated stray directory, producing zero candidate reaches from an otherwise-correctly-wired sensor spine.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: after `room_bind({room: "mindrianOS"})` returns `{ok: true, bound: true, primary: "mindrianOS"}`, subsequent `suggest_next`/`reach_candidates` calls in the same session resolve `room_dir` to `mindrianOS`'s real path and evaluate its actual room state.
actual: `suggest_next` and `reach_candidates` both returned `room_dir: "/home/jsagi/room"` (a real but unrelated pre-registry legacy room, not mindrianOS) and `suggestion: null` / `candidates: []`.
errors: none thrown - both calls returned well-formed `{ok: true, ...}` payloads; the failure is silent and well-formed, not a crash.
reproduction:
  1. Call `room_bind({room: "mindrianOS"})` via the MCP server (no `MINDRIAN_MCP_FIRST` env var set).
  2. Call `suggest_next({user_text: "..."})` or `reach_candidates({user_text: "..."})` in the same session immediately after.
  3. Inspect the returned `room_dir` field against the room name just bound.
started: observed 2026-07-28, plugin v1.15.3-beta.50. Not bisected against earlier versions; the mechanism (isMcpFirst default-off, per-tool-module independent fallback copies) reads as present since the Phase 198 MCP-first rollout design, not a recent regression.

## Scope and Impact

- Affected surfaces: cli (confirmed, this session's MCP transport). Desktop/Cowork not yet verified but share the same `lib/mcp/tools/*.cjs` code, so likely affected identically - unverified, not assumed clean.
- Affected commands: any MCP tool call that depends on `resolveSessionRoomDir`-equivalent resolution without `MINDRIAN_MCP_FIRST` enabled for the surface: `suggest_next`, `reach_candidates`, `contradiction_check`, `whitespace_scan` (sensors.cjs), and by the same duplicated pattern likely `room.cjs`, `graph.cjs`, `gate.cjs`, `chain.cjs`, `status.cjs`, `views.cjs` (not each individually re-verified live this session; flagged by shared-code-pattern, not by independent reproduction).
- Affected users: any install where `MINDRIAN_MCP_FIRST` is unset (the documented default for every install today) AND the global registry's `active` field is empty or stale relative to the room the navigator actually intends.
- Version range: v1.15.3-beta.50 confirmed; earlier versions not bisected.
- Severity: high - the reach/sensor spine (a core, actively-being-scrutinized subsystem) can silently evaluate the wrong room's state with a fully successful-looking call chain at every step.
- Blast radius: every MCP tool module sharing the `(ctx && ctx.fallbackRoomDir) || process.cwd()` independent-copy fallback pattern (7 modules per this session's grep, see Technical Root Cause).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "the sensor spine / dispatchSensors itself is broken or unwired"
  evidence: after correcting the global registry's `active` field to `mindrianOS` (operational mitigation, no code change), the identical `suggest_next`/`reach_candidates` calls returned `room_dir: "/home/jsagi/MindrianRooms/mindrianOS"` and a real, contextually-plausible candidate reach (`reach_id: "context_block"`, `signal: "jtbd_changed"`, `evidence: {jtbd: "ship-native-fire", prior_jtbd: "audit-room"}`). The dispatch/ranking machinery works correctly once given the right room; the defect is entirely upstream, in room-state resolution.
  timestamp: 2026-07-28T04:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-28T03:40:00Z
  checked: live call `room_bind({room: "mindrianOS"})`
  found: `{ok: true, bound: true, primary: "mindrianOS", source: "explicit"}`
  implication: the tool claims an authoritative session-scoped binding.

- timestamp: 2026-07-28T03:41:00Z
  checked: live calls `suggest_next(...)` / `reach_candidates(...)` immediately after the bind above
  found: both returned `room_dir: "/home/jsagi/room"`, `suggestion: null`, `candidates: []`
  implication: the binding from the prior call had zero effect on this call's room resolution.

- timestamp: 2026-07-28T03:43:00Z
  checked: `ls -la /home/jsagi/room`
  found: a real, populated, but unrelated legacy room directory (STATE.md dated April 9, business-model/, competitive-analysis/, graph.json, etc.) - not mindrianOS, not a broken path.
  implication: the resolver is not failing to find a room; it is finding the WRONG real room.

- timestamp: 2026-07-28T03:45:00Z
  checked: `lib/mcp/tools/sensors.cjs:58-71`, function `resolveSessionRoomDir(sessionId, ctx)`
  found: session-scoped resolution (`resolveWriteRoom`) is only attempted when `isMcpFirst(ctx.surface)` is true; otherwise the function calls the global `resolveActiveRoom()` and, on a miss, falls to `ctx.fallbackRoomDir`.
  implication: `room_bind`'s session-scoped write is architecturally unreachable from this read path whenever MCP-first is off for the surface.

- timestamp: 2026-07-28T03:47:00Z
  checked: `lib/mcp/mcp-first-flag.cjs` (`isMcpFirst`/`mcpFirstSurfaces`)
  found: `MINDRIAN_MCP_FIRST` unset -> `isMcpFirst(surface)` returns `false` for every surface, by explicit documented design (D-07 byte-identical-legacy default).
  implication: this is the default state for essentially every install today, not an edge case.

- timestamp: 2026-07-28T03:50:00Z
  checked: `bash scripts/room-registry get-active` and raw `MindrianRooms/.rooms/registry.json`
  found: `active: ""`, `active_room: null` - the global registry had no active room set at all at time of reproduction.
  implication: `resolveActiveRoom()` (lib/core/resolve-active-room.cjs) misses on both its precedence-chain fields and falls through to the boot-time `fallbackRoomDir` closure.

- timestamp: 2026-07-28T03:52:00Z
  checked: `grep -rn "fallbackRoomDir" lib/mcp` and `lib/mcp/tool-router.cjs:1805`
  found: `fallbackRoomDir` is a ONE-TIME value computed at MCP server boot (`registerCoreTools(server, { fallbackRoomDir: roomDir, ... })`), before any session or `room_bind` call exists, and is duplicated verbatim (`(ctx && ctx.fallbackRoomDir) || process.cwd()`) in `sensors.cjs`, `room.cjs`, `graph.cjs`, `gate.cjs`, `chain.cjs`, `status.cjs`, and `views.cjs`.
  implication: seven independent copies of the same resolution pattern, all sharing the same frozen boot-time fallback and the same MCP-first gate - a single-site fix is not possible without touching all seven, or collapsing them into one shared resolver.

- timestamp: 2026-07-28T03:55:00Z
  checked: `bash scripts/room-registry set-active mindrianOS`, then `get-active`, then re-fired `suggest_next`/`reach_candidates`
  found: `get-active` -> `mindrianOS`; both tools then returned `room_dir: "/home/jsagi/MindrianRooms/mindrianOS"` and `suggest_next` produced a real candidate (`context_block`, `jtbd_changed`, `ship-native-fire` vs prior `audit-room`).
  implication: confirms the fix locus - correcting the global registry pointer alone is sufficient to restore correct end-to-end behavior when MCP-first is off, without any code change. This is the mitigation, not the structural fix (see Required Code Changes).

- timestamp: 2026-07-28T04:08:00Z
  checked: source-of-truth re-verification of every code claim against `origin/main` (`git show origin/main:lib/mcp/tools/sensors.cjs`, `git diff origin/main HEAD -- lib/mcp/`), per docs/RCA-TEMPLATE.md section 2.5
  found: `resolveSessionRoomDir` at `sensors.cjs:58-71` is byte-identical on `origin/main` and on local HEAD `f0e4a439`, same line numbers. `grep -rln fallbackRoomDir lib/mcp/tools/` returns exactly the 7 modules named (graph, sensors, room, gate, chain, status, views). `lib/mcp/mcp-first-flag.cjs` differs between HEAD and `origin/main` by pure addition only, and that addition's own comment states `isMcpFirst()` is "called here BYTE-UNCHANGED".
  implication: the diagnosis is NOT an artifact of local uncommitted work or of a stale install cache. It holds against the published branch. The re-verification rule is discharged; no finding is provisional.

- timestamp: 2026-07-28T04:09:00Z
  checked: `lib/mcp/mcp-first-flag.cjs` `isWritePathEnabled` (added by Phase 234-05, D-05 Gap D), found while re-verifying the flag module
  found: the WRITE path already received exactly the precedence fix this bug needs on the READ path: "an explicit flag still wins, and when there is no explicit flag, a CONFIDENTLY-RECOGNIZED non-Claude-Code Tier-0 host gets the write path by default instead of silently getting nothing." Its own header comment names the failure mode in the same words this RCA uses: the product "could read the room graph and never record into it", gated on a flag that "defaults OFF".
  implication: strong in-repo precedent and a ready-made shape for Phase 237. The read path is the unfixed half of a gap whose write half was already diagnosed and closed one phase earlier. Phase 237 should follow `isWritePathEnabled`'s precedence ladder rather than invent a new one, and should consider whether the shared resolver reads a single `roomResolutionMode` helper that both halves share. Recorded as scoping input only; NOT implemented here.

- timestamp: 2026-07-28T04:10:00Z
  checked: `grep -rn "room_bind" lib/mcp/` to pin the exact handler site named in Required Code Changes / Change 2
  found: `room_bind` is registered and handled in `lib/mcp/tool-router.cjs:1611-1621`, with its born-wired connector + F.8 HITL declaration at `tool-router.cjs:1808-1821`. It is NOT in `lib/mcp/tools/room.cjs` (that module only references the name in a tool description string at line 219).
  implication: Change 2's location is now exact rather than "or wherever room_bind's handler lives". Note that `tool-router.cjs` is also where the boot-time `fallbackRoomDir` closure is passed in (line ~1805) and where `resolveWriteTargetDir` (lines 116-132) reimplements the SAME gate-then-fallthrough ladder a ninth time. Phase 237's shared-resolver collapse must include `tool-router.cjs:resolveWriteTargetDir`, not only the 7 tool modules.

## Technical Root Cause

`room_bind`'s session-scoped write and every MCP read tool's room resolution are two disconnected systems that only converge when an orthogonal rollout flag (`MINDRIAN_MCP_FIRST`) is on for the calling surface. Off (the default), reads fall through to a global, non-session-scoped registry pointer, and on a miss there, to a value frozen once at server boot - neither of which `room_bind` can influence.

- Site: `lib/mcp/tools/sensors.cjs:58-71`, function `resolveSessionRoomDir(sessionId, ctx)` (and the identical duplicated logic in `room.cjs`, `graph.cjs`, `gate.cjs`, `chain.cjs`, `status.cjs`, `views.cjs`, each per the deliberate "disjoint-file tool-module contract").
- Cause: `if (isMcpFirst(ctx.surface)) { try resolveWriteRoom(sessionId) } ; then try resolveActiveRoom() (global) ; then fallback = ctx.fallbackRoomDir (boot-time closure) || process.cwd()`. `room_bind`'s effect only lives in the `resolveWriteRoom` branch, which is skipped entirely when `isMcpFirst` is false.
- Why it surfaces now: surfaced by this session's own live-fire scrutiny of the SENS sensor spine (navigator-requested red-team), not by a version bump or known regression; the mechanism has read as present since the Phase 198 MCP-first rollout design and would affect any install running with the documented default (`MINDRIAN_MCP_FIRST` unset).

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (Phase 237 / REACH-03 scope - do not implement ahead of Phase 235 dependency):
  - Location: `lib/mcp/tools/sensors.cjs:58-71`, the six sibling copies in `room.cjs`, `graph.cjs`, `gate.cjs`, `chain.cjs`, `status.cjs`, `views.cjs`, AND an eighth copy at `lib/mcp/tool-router.cjs:116-132` (`resolveWriteTargetDir`, found 2026-07-28 during validation - it runs the identical gate-then-fallthrough ladder and was missed in the original 7-module count).
  - Current behavior: each module independently re-implements `resolveSessionRoomDir`/equivalent, all gated on `isMcpFirst`, all sharing the same frozen boot-time fallback.
  - Required behavior: collapse the seven copies into one shared resolver (matches the precedent already set by `lib/core/resolve-active-room.cjs`, itself created to collapse a prior "FOUR guessers" bug class), and make an explicit `room_bind` call authoritative for the rest of that session regardless of `MINDRIAN_MCP_FIRST` state.
  - Short-term patch: `room_bind` also writes through to the global registry `active` field as a side effect (matches this session's manual `room-registry set-active` mitigation, done in code instead of by hand), so an explicit bind is authoritative even with MCP-first off. Simpler than the long-term fix; does not by itself fix the 7-copy duplication.
  - Long-term fix: the shared-resolver collapse above, plus `room_bind`'s response reporting explicitly whether `MINDRIAN_MCP_FIRST` covers the calling surface (so a misleading "success" is never returned about an effect that will not actually apply).
- Change 2 (also Phase 237 scope):
  - Location: `lib/mcp/tool-router.cjs:1611-1621` (`room_bind`'s registration + handler; confirmed 2026-07-28, NOT `lib/mcp/tools/room.cjs`) - response contract. Its born-wired connector and F.8 HITL declaration sit at `tool-router.cjs:1808-1821` and must stay consistent with any response-shape change.
  - Current behavior: unconditional `{ok: true, bound: true, primary: <room>}` regardless of whether the binding will be honored by read tools this session.
  - Required behavior: either the write-through above makes this moot, or the response includes an explicit `effective: bool` / `reason` field when the binding will NOT be read-path-authoritative.

## Tests to Add or Update

- Test 1:
  - Type: integration (two-call MCP sequence)
  - Location: TBD - a new `tests/test-237-room-bind-session-authoritative.cjs` (or folded into Phase 237's own test suite once planned)
  - Given: `MINDRIAN_MCP_FIRST` unset, global registry `active` field empty or pointing elsewhere
  - When: `room_bind({room: X})` succeeds, then any read tool (`suggest_next` at minimum) is called in the same session
  - Then: the read tool's `room_dir` matches room `X`, not the global registry or boot-time fallback
- Test 2:
  - Type: integration (two-process/two-session)
  - Location: TBD, per Phase 237 REACH-03's own stated acceptance shape ("two concurrent sessions live on one machine")
  - Given: session A and session B both live, session A seeds a stale marker
  - When: session B pulls a candidate reach
  - Then: session B's candidate reflects only B's own turn signals, never A's stale marker

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version once Phase 237 ships this.
- Release lockstep: applies once shipped (see `.claude/includes/release-process.md`).
- Canon: touches Part 9 (Memory Locality / the SQL chokepoint's room-resolution precondition) and Part 11 (CIRS - `room_bind`'s honest-success contract); note in `docs/CANON-PHASE-MAP.md` when Phase 237 lands.
- `.planning/ROADMAP.md`: add this file's slug to the "Already-scoped inputs (routed in, not re-planned)" line for Phase 237 (~line 19) - done in this session, see commit.
- Room-side durable copy: file in `rethinking-mindrianos/research/` as a 2026-07-28-dated entry, cross-linked to the 2026-07-22 sibling entry and to this file's repo-relative path - done in this session, see room commit.
- knowledge-base.md: NOT yet added - this file is `status: diagnosed`, not `resolved`; add the knowledge-base block only once Phase 237 actually resolves this.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: room_bind's session-scoped binding and every MCP read tool's room resolution are disconnected unless MINDRIAN_MCP_FIRST covers the calling surface; off by default, reads fall through to a global registry pointer and then a frozen boot-time fallback, neither of which room_bind's success response discloses.
fix: NOT YET APPLIED (code-level). Operational mitigation applied and verified live this session: `room-registry set-active mindrianOS` corrects the global registry pointer, restoring correct end-to-end resolution without a code change. The structural fix (shared resolver collapse + honest room_bind contract) is routed as input to Phase 237 (REACH-03), which depends on Phase 235 (not yet done) - intentionally not implemented out of sequence.
verification: see Evidence section above - before/after live tool calls, exact payloads captured.
files_changed:
  - (mitigation only, no code changed) `MindrianRooms/.rooms/registry.json` `active` field, via `scripts/room-registry set-active mindrianOS`
commits: TBD (this file + ROADMAP.md routing line, committed this session)
