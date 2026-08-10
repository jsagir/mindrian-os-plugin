---
status: resolved
kind: rca
trigger: "room-bind-mcp-first-off-falls-back-to-stale-global-active-room"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [9, 11]
created: 2026-07-28T04:00:43Z
updated: 2026-08-10T00:00:00Z
---

## Source-of-Truth Preamble (code-vs-wire, resolution)
<!-- Added 2026-08-10 per docs/RCA-TEMPLATE.md section 2.5, at resolve time. -->

- **CODE claims read against:** dev repo `/home/jsagi/dev/MindrianOS-Plugin` local HEAD at
  the fix commits (Phase 248 plans 01+02: `f3bbdaa5`, `da0cc1af`, `907b1708`, plus 248-01's
  own commits for the nine-copy collapse).
- **WIRE claims probe against:** (a) `tests/test-248-surface-probes.cjs`, scripted five-step
  probes against FRESH spawns on CLI-, Desktop-, and Cowork-equivalent transports, 25/25
  green, 0 skips; (b) the live CLI before/after in a genuinely fresh Claude Code CLI session
  against this dev repo's `.mcp.json`, navigator-approved 2026-08-10, verbatim payloads in
  `.planning/phases/248-mcp-first-room-resolution/248-02-LIVE-RESULT.md`.
- **Date of resolution:** 2026-08-10.
- **Fix-not-live-until-released status:** NOT yet released. The fix is verified live on the
  dev-repo code only (per the two WIRE legs above). It has not shipped in a version, so no
  install running a released build has this fix yet, per the standing
  fix-not-live-until-released hard rule (see the Non-Code Follow-ups "release pickup TODO"
  below for the two real-host legs that stay deferred until it does).

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED 2026-08-10 (Phase 248, plans 01+02) - `room_bind` now round-trips through the shared resolver on every write and reports honestly whether the binding will apply; every MCP read tool resolves a bound session's binding unconditionally, regardless of `MINDRIAN_MCP_FIRST` state.
test: live-fired `room_bind({room: "mindrianOS"})` then `suggest_next` / `reach_candidates` in the same MCP session, before and after correcting the global registry pointer with `room-registry set-active mindrianOS` (original diagnosis); re-verified 2026-08-10 via a fresh CLI session against the fixed dev-repo code, plus scripted CLI/Desktop/Cowork-equivalent probes - see Resolution.
expecting: after `room_bind` succeeds, subsequent tool calls in the SAME session resolve to the bound room regardless of the global registry or the MCP-first flag state. CONFIRMED live 2026-08-10.
next_action: NONE - resolved and moved to `.planning/debug/resolved/`. Release pickup TODO (Desktop/Cowork real-host legs) tracked in Non-Code Follow-ups.

PRIOR (2026-07-29, Phase 237-08 close-out), kept for the record: Phase 237 (REACH-03) is now COMPLETE and closed the session-scoping/signal-staleness leg this RCA's own Test 2 named (ROADMAP SC3's wording): `lib/core/insight-sensors.cjs::deriveTurnSignals` / `sensorArtifactFiled` are now scoped to the calling session via `isMarkerOwnedByCaller`, and both reach-signal marker writers (`scripts/post-write`, `scripts/auto-explore-fingerprint.cjs`/`auto-explore-fire.cjs`) now stamp `session_id`, proven end to end against the live hooks with a real two-process `fork()` fence (tests/test-237-session-scope.cjs, tests/test-237-session-scope-degrade.cjs, tests/test-237-post-write-session-stamp.cjs). This RCA's Test 1 leg -- the STRUCTURAL eight-copy room-resolver collapse (`lib/mcp/tools/*.cjs` each keeping an independent `resolveSessionRoomDir`/`isMcpFirst` copy) and making `room_bind` authoritative regardless of the MCP-first flag state -- is UNCHANGED and remains open, still carried to the **v1.17.0 "MCP-First" milestone**, because that defect is the MCP-first flag's own semantics failing, not a reach-seam defect. Phase 237-02 and 237-08 (the two 237 plans that touched `lib/mcp/tools/chain.cjs`, one of the eight resolver copies) both carried an explicit `git diff` fence proving zero touches to `isMcpFirst`/`resolveWriteRoom`/`resolveActiveRoom`/`fallbackRoomDir`, so the structural leg genuinely was not touched. Do not mark `status` resolved on the strength of the Phase 237 close-out alone -- the Test 1 leg this file's own hypothesis names is still live.

UPDATED 2026-07-29 (independent live re-reproduction, `room_state_bound` at `lib/mcp/tools/room.cjs:226-249` -- a ninth site sharing this file's exact read-path pattern, not previously named). Confirms the core diagnosis again: bound to `mindrianOS`, then to `jonathan-sagir`, and `room_state_bound` still resolved to `mindrianOS` -- the first bind's remnant, since neither `room_bind` call moved the global registry pointer. No change to the v1.17.0 routing above; this is corroborating evidence, not a new defect. It DID surface one genuinely new, UNCONFIRMED wrinkle worth carrying into the v1.17.0 scoping pass alongside the resolver-collapse work: the stale-resolved room's STATE.md payload was not merely wrong-but-readable (as this file's original Evidence documents for `/home/jsagi/room`) -- it was several thousand literal null bytes. Traced the read path (`room.cjs` -> `state-ops.cjs::getState` -> `index.cjs::safeReadFile`, a plain `fs.readFileSync`) and confirmed it cannot itself produce this from a genuinely empty file (a 0-byte file reads as `''`, which correctly hits `room.cjs:242`'s existing `state || 'No STATE.md found...'` fallback). This points at a SEPARATE, UNCONFIRMED write-side suspect -- `state-ops.cjs:44`'s `computeState()` writes STATE.md via a non-atomic `fs.writeFileSync` fed by a 10-second-timeout `execSync`, and this session independently observed a MINTO-regen/auto-commit pipeline firing on every room write, so a race or a killed exec could plausibly leave a torn/null-padded file. See the new Evidence entry below for the full trace. Not reproduced twice, not root-caused, not folded into this file's Resolution -- if it recurs, it earns its own debug file rather than being absorbed here.

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
  - **`.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`** - REUSE-CHECK GAP, caught late: this is the dev-repo-side companion RCA to the 2026-07-22 room entry above (same day, same investigation, resolved via F-01, commit `0bec81b9`, BEFORE this session started). It fixed `room_bind`'s MCP handler always hitting `no_session_id` early-return on stdio (so `writeSessionBinding`/Leg A was structurally unreachable). That fix is why THIS session's `room_bind({room:"mindrianOS"})` call succeeded cleanly instead of failing outright. This file's finding is downstream and different: even with Leg A reachable and successfully written, `sensors.cjs` (and its 6 siblings) never READ Leg A unless `MINDRIAN_MCP_FIRST` covers the surface -- 0bec81b9 fixed the write side, this file diagnoses the read side, still open. Should have been found during this session's own REUSE-CHECK before filing; noted here for the record per the Critical Pathway process (`.planning/SESSION-HANDOFF-2026-07-28-critical-pathway-rooms-open-phase-233-release.md`).

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

- timestamp: 2026-07-29T00:00:00Z
  checked: live reproduction via `room_state_bound` (a NINTH site sharing this RCA's read-path pattern, not yet named above -- `lib/mcp/tools/room.cjs:226-249`, distinct from the bare `room_state` grouped router tool). Sequence: `room_bind({room:"mindrianOS"})` -> ok, then `room_bind({room:"jonathan-sagir"})` -> ok, then `room_state_bound()` in the same session.
  found: `room_state_bound` returned `room_dir: "/home/jsagi/MindrianRooms/mindrianOS"` (the FIRST bind, not the second -- confirms the same stale-global-pointer mechanism this RCA already diagnoses, since only `bash scripts/room-registry set-active` moves that pointer and neither bind call did). Additionally, `state` was not the room's real STATE.md content -- it was several thousand literal null bytes (` ` repeated), returned as a non-empty string.
  implication: the room-dir half is the SAME bug, ninth confirmed site. The null-byte half is a DIFFERENT, NOT-YET-CONFIRMED defect worth flagging separately: `room.cjs:242`'s own fallback (`state: state || 'No STATE.md found in this room.'`) can only be bypassed by a TRUTHY `state`, and `state-ops.cjs::getState` -> `index.cjs::safeReadFile` is a plain `fs.readFileSync(filePath, 'utf-8')` with no fixed-size buffer or byte-slicing -- a genuinely 0-byte file reads as `''` and WOULD hit the graceful fallback. So the null bytes were very likely actually ON DISK in `mindrianOS/STATE.md` at read time, not a read-path mishandling of emptiness. A follow-up disk check (2026-07-29, later the same day) found that file at 0 bytes, which is consistent with the corruption having since been overwritten by a subsequent regen, not with the read path being the culprit. Candidate write-side suspect, UNCONFIRMED: `state-ops.cjs:44`'s `computeState()` writes STATE.md via a plain `fs.writeFileSync(path.join(resolved, 'STATE.md'), result)` -- not atomic (no temp-file-then-rename) -- fed by `execSync(...bash compute-state..., {timeout: 10000})` at line 36-40; a killed/timed-out exec or a second concurrent `computeState()` call (this session observed the MINTO-regen/auto-commit pipeline firing on every room write) racing that same non-atomic write could plausibly leave a torn or null-padded file for a reader to catch mid-flight. NOT reproduced or root-caused this session -- flagged here because it surfaced via this RCA's own reproduction sequence and shares its file family (`lib/mcp/tools/room.cjs`), not because it is proven to be the same root cause. If this recurs, it should get its OWN debug file rather than being folded into this one's Resolution.

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
- `.planning/ROADMAP.md`: this file's slug is on the "Already-scoped inputs (routed in, not re-planned)" line (~line 19). A gsd-debug-session-manager validation pass ALSO added a "SPLIT ROUTING" annotation there and a CARRIED-IN DEFECT bullet in the v1.17.0 "MCP-First" Next Milestone section, both still uncommitted, both attributed in-file to a "navigator decision 2026-07-28" that the orchestrating session has NOT independently verified was actually made by the human navigator (it may be real -- the v1.17.0 slot and its "lets plan it for 1.17.beta" quote genuinely predate this validation pass and are independently corroborated in ROADMAP.md -- but the SECOND quote, "make sure this sends a note to milestone 1.17.0 that will do this work, MCP", has no corroboration found yet). CORRECTION per Canon Part 9 (only a human confirms a truth-claim): do not commit this attribution as fact until the navigator explicitly confirms it in-session. Held uncommitted pending that confirmation.
- `.planning/STATE.md`: same status and same correction as ROADMAP.md above -- v1.17.0 slot entry (~line 22) carries the mirrored CARRIED-IN DEFECT note, written but uncommitted, same unverified-attribution caveat.
- **This file itself was committed** (MindrianOS-Plugin commit e65dadc2, then re-verified/annotated by the validation pass, still uncommitted after that pass -- see commits line below for final status).
- Room-side durable copy: VERIFIED PRESENT and NOW COMMITTED at `~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-room-bind-session-scope-ignored-mcp-first-off/`, cross-linked to the 2026-07-22 sibling entry. CORRECTION: the validation pass's cited commit hash (245621d59) was WRONG -- that hash is the pre-existing 2026-07-22 entry's commit, not this file's. This file was actually still untracked at validation time; committed separately as rethinking-mindrianos room commit 990f545f5. NOTE: the room copy predates the v1.17.0 split-routing proposal and still says Phase 237 owns the full structural fix; update if the split routing is confirmed.
- knowledge-base.md: ADDED 2026-08-10 - block appended covering this slug, the nine-copy
  census correction, and the rejected write-through tripwire.
- **Release pickup TODO (stated deferral, not an oversight):** two real-host legs remain
  unverified and are tracked here for the release checklist to find: (1) Desktop real-host
  confirmation, (2) Cowork real-host confirmation. Both surfaces are proven only via scripted
  equivalents (`tests/test-248-surface-probes.cjs`) today. Re-verify both against a real
  Desktop app session and a real Cowork multi-user session once v2.0.0-beta ships and is
  picked up (a running session never hot-reloads; a fresh install/session is required per the
  fix-not-live-until-released hard rule).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: room_bind's session-scoped binding and every MCP read tool's room resolution were disconnected unless MINDRIAN_MCP_FIRST covered the calling surface; off by default, reads fell through to a global registry pointer and then a frozen boot-time fallback, neither of which room_bind's success response disclosed. Root cause stands as originally diagnosed; nothing in the fix changed the diagnosis, only closed the gap.
fix: Phase 248, plans 01+02, combined. Plan 01 collapsed the resolver copies into `lib/mcp/session-room.cjs` with UNCONDITIONAL session-binding reads (bound sessions are now authoritative regardless of `MINDRIAN_MCP_FIRST` state). Plan 02 made `room_bind` honest: a post-write round-trip through the SAME shared resolver, SAME sessionId, reports `effective`/`resolved_dir`/`resolved_source`/`reason` on every call, so the unqualified `{ok:true, bound:true}` about an inert effect can no longer be reproduced. Census correction: the original filing counted eight resolver copies; the real count is NINE - `lib/mcp/stop-gate-handler.cjs:78` was the missed ninth site sharing the identical gate-then-fallthrough pattern (found and collapsed in Phase 248-01); `tools/stop-gate.cjs` has no copy of its own, it was never a tenth site. The RCA's own short-term-patch suggestion (`room_bind` writing through to the global registry `active` field) was REJECTED at plan time: one session's bind would clobber every concurrent session's Leg B read, reintroducing the machine-wide race that commit `0bec81b9`/PSB already fixed. The structural fix (the resolver collapse) makes the write-through patch unnecessary, and `tests/test-248-room-bind-honest-return.cjs` Test 5 stands as the permanent tripwire proving `room_bind` never touches `registry.json`'s `active` field.
verification: Source-of-Truth Preamble above states the code-vs-wire split. CODE = dev repo local HEAD at the fix commits. WIRE = (a) `tests/test-248-surface-probes.cjs` scripted five-step probes on CLI-, Desktop-, and Cowork-equivalent transports against fresh spawns (25/25 green, 0 skips); (b) the live CLI before/after from the human checkpoint, navigator-approved 2026-08-10, exact payloads recorded in `.planning/phases/248-mcp-first-room-resolution/248-02-LIVE-RESULT.md` (room_bind mindrianOS -> effective:true, resolved_dir the real mindrianOS path; room_state_bound followed the binding, not the stale global active pointer; a re-bind took effect for the next read; the room-not-on-disk negative returned effective:false, reason room_not_on_disk). Desktop and Cowork REAL-HOST legs are a STATED DEFERRAL (Tri-Polar rule: a skip is a stated call, never an oversight) to v2.0.0-beta release pickup, per the fix-not-live-until-released hard rule - see the Non-Code Follow-ups "release pickup TODO" line above. Scripted equivalents stand as the merge evidence in the interim.
files_changed:
  - lib/mcp/session-room.cjs (Phase 248-01: the shared resolver collapse, unconditional session-binding reads)
  - lib/mcp/tool-router.cjs (Phase 248-02: room_bind handler, honestBindResult() post-write round-trip)
  - lib/mcp/stop-gate-handler.cjs (Phase 248-01: the ninth resolver copy, collapsed)
  - tests/test-248-room-bind-honest-return.cjs, tests/test-248-surface-probes.cjs (new, Phase 248-02)
  - tests/run-all-248.sh, CHANGELOG.md, docs/ENV-TUNING.md, docs/CANON-PHASE-MAP.md
commits: MindrianOS-Plugin e65dadc2 (original filing). ROADMAP.md/STATE.md split-routing edits from the validation pass, and the earlier v1.17.0 routing attribution, are superseded by Phase 248 actually landing the fix (Phase 248, not Phase 237, owns the structural fix - see the room-side compositing correction below). Phase 248-01 commits per `248-01-SUMMARY.md`; Phase 248-02 commits `f3bbdaa5` (test, RED), `da0cc1af` (feat, GREEN, honest return), `907b1708` (feat, CTX-03 probes + docs), plus this close-out commit. Room side: rethinking-mindrianos commit 990f545f5 (original filing; the validation pass cited 245621d59, which was wrong), corrected 2026-08-10 to name Phase 248 as the owner of the structural fix (see `~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-room-bind-session-scope-ignored-mcp-first-off/`).
