---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 05
subsystem: infra
tags: [mcp, host-detection, capability-floor, write-path, governance, stdio, json-rpc]

# Dependency graph
requires:
  - phase: 198-mcp-first-then-sdk
    provides: the MCP tool surface (graph.cjs/views.cjs/status.cjs/chain.cjs), the MINDRIAN_MCP_FIRST flag chokepoint, and the D-07 registration-gate this plan supersedes
  - phase: 234-01
    provides: tests/run-all-234.sh (the glob-discovering phase harness and its permanent Part 8 egress sweep)
provides:
  - detectHostTier(clientVersion) - the second capability axis (tier0/tier1 MCP host detection), living inside the existing surface-detect chokepoint
  - isWritePathEnabled({surface, clientVersion}) - the write-path gate, explicit-flag-first then host-tier auto-detection
  - graph_write / memory_event / artifact_file always visible in tools/list, gated per call instead of per registration
  - status_read's capability_floor segment (surface + host_tier + write_path_enabled, live)
  - tests/test-234-host-tier.cjs - 90 assertions, including a real stdio JSON-RPC drive varying clientInfo.name
affects: [234-06, 234-07, host-adapter work, v1.17.0 MCP-First milestone read-path resolver collapse]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registration is DISCOVERY, the handler is PERMISSION: never hide a tool from tools/list to express a permission decision"
    - "Lazy per-call host detection via server.server.getClientVersion(), because registration predates the initialize handshake"
    - "Honest refusal object ({ok:false, reason, hint} + isError) instead of a silent catalog omission"

key-files:
  created:
    - tests/test-234-host-tier.cjs
  modified:
    - lib/mcp/surface-detect.cjs
    - lib/mcp/mcp-first-flag.cjs
    - lib/mcp/tools/graph.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/status.cjs
    - lib/mcp/tools/chain.cjs
    - tests/run-all-234.sh
    - tests/test-198-contract-schema.test.cjs

key-decisions:
  - "The write gate moved from registration time to call time. Registration-time host gating is structurally impossible: the MCP SDK populates getClientVersion() only after the initialize handshake, while tool registration runs once inside createServer() before any client connects."
  - "An unknown or pre-initialize client keeps the write path OFF, but the tool stays visible and the refusal is explicit. That is the deliberate resolution of the defensive-default vs no-silent-skip tension (T-234-09)."
  - "Tier-1 non-Claude-Code hosts (Grok Build, OpenCode) keep the legacy OFF default. Tier, not vendor, is the discriminator: they have hook channels of their own."
  - "chain.cjs got NO write gate. The plan assumed a registration-time guard there; none exists. Adding isWritePathEnabled would have opened a regression for every Claude Code user rather than closing a gap."
  - "clientInfo.name is treated as a UX/routing signal, never an authentication boundary (T-234-08 accepted). Every write still routes through navigation.cjs's validation and CAS guard."

patterns-established:
  - "Two-axis capability floor: surface (cli/desktop/cowork) and host-tier (tier0/tier1), both stated honestly through status_read rather than left for a model to discover by trial"
  - "Behavioral verification over code inspection: the phase test spawns the real server and speaks JSON-RPC, varying only clientInfo.name"
  - "Contract-change tests are rewritten with the reason inline, not deleted, so the superseded invariant stays legible"

requirements-completed: [D-04, D-05, D-12]

# Metrics
duration: 28min
completed: 2026-07-28
---

# Phase 234 Plan 05: Two-Axis Capability Floor and the Tier-0 Write Path Summary

**Closed Gap D by splitting discovery from permission: the three graph-write MCP tools are now always in the catalog and gated per call by live host-tier detection, so a Cursor-class host can finally write into the room graph without anyone hand-setting an env var.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-28T06:53:45+03:00
- **Completed:** 2026-07-28T07:21:27+03:00
- **Tasks:** 2 of 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **Gap D is closed, and closed at the right layer.** RESEARCH.md named it the phase's single biggest functional gap: `graph_write`, `memory_event` and `artifact_file` were gated at REGISTRATION time behind `MINDRIAN_MCP_FIRST`, which is unset by default. On Claude Code that is harmless because slash commands and hooks do the writing. On every foreign MCP host it meant the tools were absent from `tools/list` entirely, so the product read the room graph and could never record into it, and the model could not even see a write tool existed to ask for. The fix was not to flip a default: it was to notice that the old gate conflated two different questions and to separate them. Registration answers "does this tool exist" (now unconditional). The handler answers "may this caller write" (now a live, per-call check).
- **The timing constraint that forced the design is documented, not worked around.** The MCP SDK populates `Server.getClientVersion()` only after the `initialize` handshake completes, while tool registration runs once inside `createServer()` before any client connects, on every transport this codebase runs. Registration-time host detection is structurally impossible. That is now written into the headers of `graph.cjs`, `views.cjs` and the superseded test assertions, so the next reader does not try to "fix" it back.
- **The floor is stated out loud (D-05).** `status_read` now carries a `capability_floor` segment reporting `surface`, `host_tier` (both the recognized host name and its tier) and `write_path_enabled`, computed live per call. A model or a human can ask "what can I actually do right now on this host" instead of discovering by trial that a visible tool refuses.
- **Verified behaviorally, not by inspection.** `tests/test-234-host-tier.cjs` spawns the real `bin/mindrian-mcp-server.cjs` over stdio and drives genuine JSON-RPC, varying only `clientInfo.name`. It proves the write tools are listed on both a Cursor-like host and Claude Code, that the Cursor-like host reaches the genuine `navigation.cjs` write path (`ok:true` against a real `room.db`, not a mock), that Claude Code is refused out loud with `reason:'write_path_disabled'` plus an actionable hint and `isError` on the wire, and that `status_read`'s reported floor matches what the write call actually did. 90/90 assertions pass.
- **No regression for existing users, proved on the wire.** Leg B5 runs a third live drive with `MINDRIAN_MCP_FIRST=all` and `clientInfo.name: claude-code`, and confirms the explicit flag still wins over host-tier auto-detection: the write succeeds and `capability_floor` reports `write_path_enabled: true` on a tier1 host.

## Task Commits

1. **Task 1 (TDD RED): failing host-tier + write-path gate test** - `59ed9cb8` (test)
2. **Task 1 (TDD GREEN): detectHostTier + isWritePathEnabled** - `a8f50d10` (feat)
3. **Task 2: move the write-path gate from registration to call time** - `793268cd` (feat)

No REFACTOR commit: the GREEN implementation needed no cleanup pass.

## Files Created/Modified

- `lib/mcp/surface-detect.cjs` - Added `HOST_TIER_MAP` (SEED-068's host matrix split by capability) and `detectHostTier(clientVersion)`, a pure, total, argument-only detector. Existing `detectSurface` and `CAPABILITY_MAP` are byte-unchanged; the only removed line in the whole diff is the old `module.exports` line, extended in place.
- `lib/mcp/mcp-first-flag.cjs` - Added `isWritePathEnabled({surface, clientVersion})`. `isMcpFirst` is called byte-unchanged inside it, so every existing call site keeps its exact current behavior.
- `lib/mcp/tools/graph.cjs` - Registration guard removed; `writePathRefusal(server, ctx)` added as the first statement of both `graph_write` and `memory_event`. Header rewritten to record why D-07's registration gate was superseded.
- `lib/mcp/tools/views.cjs` - Same treatment for `artifact_file`.
- `lib/mcp/tools/status.cjs` - `buildStatusSegments` takes an optional `capabilityFloor` (kept pure and unit-testable); the handler computes the live floor from `getClientVersion()`.
- `lib/mcp/tools/chain.cjs` - Header note only. Documents why this file deliberately has no write gate (see Deviations).
- `tests/test-234-host-tier.cjs` - New. Part A: 59 unit assertions. Part B: 31 assertions over three real stdio server drives.
- `tests/run-all-234.sh` - `lib/mcp/surface-detect.cjs` and `lib/mcp/mcp-first-flag.cjs` added to the permanent Part 8 egress sweep.
- `tests/test-198-contract-schema.test.cjs` - The three assertions that locked the old contract now lock the new one, with the reason for the change written inline, plus a new assertion that the tool catalog is identical flag-on vs flag-off.

## Decisions Made

- **Discovery and permission are separate concerns.** Hiding a tool from `tools/list` is a terrible way to express "you may not use this", because the caller cannot tell the difference between a capability that does not exist and one it lacks permission for. The refusal object carries a `reason` and a `hint` precisely so the answer is actionable.
- **Unknown hosts stay OFF, visibly.** An unidentified or pre-initialize client does not silently gain write access (the conservative floor V4 Access Control asks for), but neither does it silently lose the tool. Both halves of the tension are honored (T-234-09).
- **Tier is the discriminator, not vendor.** Grok Build and OpenCode are Tier-1 and keep the legacy OFF default because they have hook channels of their own, exactly as Claude Code does. The flip is for hosts that have no other way to write.
- **`clientInfo.name` is not a security boundary (T-234-08, accepted).** It is client-supplied and unauthenticated. It selects a default convenience gate only; `navigation.cjs`'s validation and CAS guard still run on every write regardless of how the call was gated in. A spoofed name at worst grants the same write path a legitimate Cursor user already gets by design.
- **Canon Part 8 untouched.** This plan changes WHO may reach `navigation.cjs` and WHEN. It changes nothing about what data crosses the Brain boundary, and adds no network reach (both new chokepoints are now under the Part 8 sweep).
- **D-12 respected.** Host-capability tier and commercial tier are different axes. Nothing added here reads a plan, a key, or an entitlement; `mcp-server-brain/lib/auth.cjs` was not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan/reality mismatch] chain.cjs has no registration-time write gate, and adding one would have been a regression**

- **Found during:** Task 2
- **Issue:** The plan's `read_first` and `action` both assumed `lib/mcp/tools/chain.cjs` line 66 carried "the same early-return idiom for its write tool", to be deleted and replaced with a per-call check. It does not. Line 66 is the `isMcpFirst` call inside `resolveSessionRoomDir` (the separate D-07 per-session write-room resolution concern, shared verbatim with `room.cjs`, `gate.cjs` and `sensors.cjs`). Both `chain_resolve` and `chain_run` have always been registered unconditionally. Verified against the file and its full git history (`198d87d6`, `a7642cfc`).
- **Fix:** Did NOT add a write gate. Following the plan literally would have OPENED a gap rather than closing one: `isWritePathEnabled` is false for Claude Code by design, so gating `chain_run` on it would newly break the shipped chain executor for every Claude Code user. `chain_run` already governs its own material steps through the gate ladder (halt at the first material step, render a gate, execute only on an approve verdict matched to this process's single-use resume ledger) joined to the posture data in `data/connector-registry.json`, which is a stronger and more specific control than a blanket write-path flag. Added a header note recording the finding and the reasoning so a future reader does not "correct" it.
- **Files modified:** `lib/mcp/tools/chain.cjs` (comment only, zero behavior change)
- **Verification:** `node --check`; `bash tests/run-all-198.sh` 21/21 including the SPEC-3 chain halt/resume leg and the SPEC-7 flag-off byte-identical parity leg.
- **Committed in:** `793268cd`

**2. [Rule 3 - Blocking] tests/test-198-contract-schema.test.cjs asserted the exact contract this plan supersedes**

- **Found during:** Task 2
- **Issue:** Three assertions locked the OLD behavior (`graph_write` / `memory_event` / `artifact_file` do NOT register when the flag is off). Landing Task 2 without touching them would have turned `run-all-198.sh` red, and a stale assertion left in place is worse than none because it makes the superseded rule look current.
- **Fix:** Rewrote the three assertions to lock the NEW contract, with the reason for the change written inline above them rather than silently swapped. Added a fourth assertion that the tool catalog is byte-identical flag-on vs flag-off, which is what actually stops a future change from quietly reintroducing a registration-time gate.
- **Files modified:** `tests/test-198-contract-schema.test.cjs`
- **Verification:** 113 assertions pass (up from 112).
- **Committed in:** `793268cd`

**3. [Rule 3 - Blocking] Task 1's test file also carries Task 2's live proof**

- **Found during:** Task 2
- **Issue:** The plan scoped `tests/test-234-host-tier.cjs` to unit calls only ("no MCP server spawn needed for this file"), while Task 2's acceptance criteria and the phase's own success criteria both require a real stdio drive with distinct `clientInfo.name` values, and Task 2's `files` list adds no second test file to hold it.
- **Fix:** Extended the same file with Part B rather than creating an undeclared second one. `tests/run-all-234.sh` glob-discovers `tests/test-234-*.cjs`, so the live legs join the harness automatically.
- **Files modified:** `tests/test-234-host-tier.cjs`
- **Verification:** 90/90 assertions; `bash tests/run-all-234.sh` 8/8.
- **Committed in:** `793268cd`

---

**Total deviations:** 3 auto-fixed (1x Rule 1, 2x Rule 3)
**Impact on plan:** No scope creep. Deviation 1 is the important one: it is a case where executing the plan verbatim would have shipped a regression, and the correct action was to verify the plan's premise against the code and decline the change with the reasoning written down.

## Issues Encountered

- **Concurrent-session interference in the working tree.** Another session running in this same repo repeatedly reverted uncommitted edits to `lib/mcp/tools/graph.cjs` mid-task (three separate hunks were lost across two Edit rounds). Resolved by reading the file fresh and applying the remaining changes as a single atomic write, then verifying every hunk with grep before committing. Every commit in this plan staged files individually by path; nothing from the concurrent session was swept in.
- **Harness side effect reverted.** Running `tests/run-all-198.sh` rewrote the date field in `evals/plurai/211-baseline.json` (its deferred-baseline timestamp). Reverted that single file rather than committing unrelated churn.
- **STATE.md / ROADMAP.md are mid-rewrite by a concurrent milestone session** (see Next Phase Readiness).

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. The two threats this plan does touch (T-234-08 elevation-of-privilege via spoofed `clientInfo.name`, accepted; T-234-09 silent denial-of-service via the unknown-host default, mitigated) were both already in the plan's threat register and are dispositioned as planned.

## Known Stubs

None. Every surface this plan touches is wired end to end and proved over a live JSON-RPC drive.

## User Setup Required

None. The point of the change is that no user setup is required any more on a recognized foreign host. `MINDRIAN_MCP_FIRST` remains available and still takes precedence for anyone who sets it.

## Next Phase Readiness

**Ready.** The two-axis floor is in place and the write path is reachable from a Tier-0 host, which is the precondition the remaining host-adapter work in this phase depends on.

**Two notes for whoever picks this up:**

1. **STATE.md and ROADMAP.md were NOT updated by this plan, deliberately.** A concurrent session rewrote both to open the v1.16.0 "Infrastructure Remediation" milestone (phases 235-243) and register the v1.17.0 "MCP-First" slot. `ROADMAP.md` no longer carries a Phase 234 row (the v1.15.0 roadmap was archived), so `roadmap update-plan-progress 234` has nothing to update, and running `state advance-plan` would have corrupted the milestone position that session just set. Committing either file would have swept that session's in-flight work into this plan's commit, which the execution brief explicitly forbids. This SUMMARY is the authoritative record of 234-05.
2. **The read half of this gap is still open, and is already routed.** `isWritePathEnabled` fixed the WRITE path's precedence ladder. The READ path still has the original problem: `room_bind`'s session-scoped binding is invisible to every MCP read tool unless `MINDRIAN_MCP_FIRST` covers the calling surface, across eight independent copies of the same gate-then-fallthrough resolver. The concurrent roadmap session has already carried that to the v1.17.0 MCP-First milestone and explicitly points it at the precedence ladder shipped here (`.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`). Nothing to do in this phase; do not let it get re-discovered as new.

---
*Phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core*
*Completed: 2026-07-28*
