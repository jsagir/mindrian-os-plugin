---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 33
subsystem: gate-ledger
tags: [gap-closure, gap-1, gap-2, gate, ledger, cross-process, gate_list, d-14, d-15, d-16, d-19]
requires:
  - phase: 289
    provides: "peekGate/consumeGate contract, verdict/chosen coherence, the gate_answer anchor"
  - phase: 369-26
    provides: "withRoomTx ratification, releaseGate after COMMIT, replay, readGateAnswerAnchor"
provides:
  - "a durable gate_raised record in the room for every gate minted for a room-bound session, in any process"
  - "a gate_closed record for a take that leaves without a recorded answer"
  - "the read-only gate_list tool (list open gates, read one gate's state) born wired"
  - "three room readers (readRaisedGate, readGateState, readOpenRaisedGates) and the json_valid guard"
affects: [369-36, 369-41, 369-42, 369-44]
tech-stack:
  added: []
  patterns: ["ledger observers installed by the tool module (no minter edited)", "contract-only room record, never session identity"]
key-files:
  created:
    - lib/mcp/gate-raised.cjs
    - tests/test-369-gate-raised.cjs
    - tests/helpers/cli-gate-369.cjs
  modified:
    - lib/mcp/gate-ledger.cjs
    - lib/mcp/tools/gate.cjs
    - lib/core/navigation/room-projection.cjs
    - lib/core/navigation.cjs
key-decisions:
  - "The gate_raised payload is plain nested fields in the mcp_client_event_logged memory_event; logEvent accepts them, so no contract_json string field was needed"
  - "gate_list treats the machine-wide registry pointer (source reg.active) as unbound and answers room_unbound; only a session binding (or a cwd room root) is a bound room"
  - "The observer resolves a room with an empty ctx: with noFloor:true the resolver never reads ctx, so the observer works for minters that never see one"
requirements-completed: [SHELL369-12, GREC369-05, REV369-06]
duration: ~2h
completed: 2026-10-04
---

# Phase 369 Plan 33: gate_raised records and the read-only gate_list tool Summary

A gate Larry raises in Claude Code's own stdio process now leaves one contract-only record in its room, and a daemon session bound to the same room lists it (and reads any gate's state) through the new read-only `gate_list` tool, with the 289 ledger rule set untouched.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 461afc04e | tests/helpers/cli-gate-369.cjs + tests/test-369-gate-raised.cjs; exit 1, 10 of 11 arms red (first line: `gate_list (room-x): {"__error":"Tool gate_list not found"}`; arm 10: `setGateObservers is exported`); arm 7 (no record for an unbound session or a binding card) passed as the regression guard |
| 2 | d8b649a1e | setGateObservers in gate-ledger.cjs; lib/mcp/gate-raised.cjs; readRaisedGate / readGateState / readOpenRaisedGates and the json_valid guard in room-projection.cjs, re-exported by navigation.cjs |
| 3 | 6b9f50365 | observers installed in gate.cjs; gate_list registered with its connectors entry; gate_render description made honest |

## What was built

- **Ledger observers.** `setGateObservers({ onMint, onTake })` (null clears). `mintGate` calls `onMint(gateId, stored)` after the set; a successful `consumeGate` (so `releaseGate`) calls `onTake(gateId, entry)` after the one delete; each call sits in its own try/catch. `consumeGate` and `peekGate` still declare two parameters; non-comment lines of gate-ledger.cjs hold exactly one `_ledger.delete(`.
- **Records.** `contractOf` builds the bounded card contract (header 200, at most 20 options with id/label 200, description 500, preview 1000, notice 500, at most 20 evidence ids of 200, plus approving, framework, minted_at, expires_at = minted_at + 1,800,000, resumes). It copies by field name and never spreads the entry, so there is no session id, session key or ledger key in the row (arm 2 walks the raw row recursively). `kind: binding` and mirror entries return null. `recordRaised` writes label `gate_raised`, dedupe key `gate_raised:<id>`; `recordClosedIfUnanswered` writes `gate_closed:<id>` only when no answer anchor exists. Neither throws.
- **Readers** (read-only handle, no write): state precedence answered, closed, expired, open, else unknown (an anchor without a raise reads answered). `readOpenRaisedGates` rejects expired rows in memory before the two per-gate lookups, lists oldest first, at most 50. Every by-key read goes through one helper that wraps `json_extract` in `CASE WHEN json_valid(properties)` (WR-06), including `readGateAnswerAnchor`, which also returns `answered_via` and reports `decision:gate:<answered_via>` as `decision_node_id` when that node exists (for plan 369-36). The reader re-bounds every field it serves.
- **gate_list.** Input `{ gate_id? }` (1 to 200 characters). Bound room via `resolveMcpSessionRoom({ noFloor: true })`; unbound answers `room_unbound`; the room is opened with `openRoomDbReadOnlyForCaller` and closed in a finally; a null handle or a thrown read answers `lookup_failed`, never `unknown`. Without gate_id: `{ ok, room, gates, count }`. With gate_id: `{ ok, room, gate: { gate_id, state, contract (open), answered (answered) } }`. Connectors entry: hitl_shape `none`, layer `harness`.
- **Observer install** (gate.cjs, at module load): room is `entry.mintedRoomDir`, else `entry.roomDir`, else the session's binding accepted only from a write-authority source (the `_mintContext` rule). A written record sets `raisedRoomDir` on the stored entry so the take closes the same room. gate_render's inline elicitation consume closes its record through onTake with no special case.

ctx finding (the plan asked for it): `ctx` is process-wide boot configuration (`fallbackRoomDir`, `surface`, `pluginRoot`), never per connection; with `noFloor: true` the resolver does not read it, so the observer resolves with an empty ctx and works for minters that never see one. Session lookup works through the session-binding file.

## Verification (all on the final tree, nvm Node)

- `node tests/test-369-gate-raised.cjs`: PASS 11, FAIL 0 (live stdio CLI process plus live daemon; binding route chosen: the room_bind tool is effective on stdio when CLAUDE_CODE_SESSION_ID is set, stated in the helper header). It spawned `scripts/mindrian-mcp-server.cjs` (369.1-04 had already moved it; `bin/` is the forwarding shim).
- `node tests/test-234-tool-description-floor.cjs`: 204 passed, coverage 48/48 (gate_list and the new gate_render text within 2048 bytes).
- `node tests/test-369-gate-recovery.cjs`: PASS=11 FAIL=0. `node tests/test-369-sessionful-acceptance.cjs`: PASS=6 FAIL=0. `node tests/test-369-289-precondition.cjs`: PASS. `bash tests/run-all-238.sh`: PASS=10 FAIL=0. `node tests/test-369-human-only.cjs` green.
- `bash tests/run-all-289.sh`: `PASSED=43 FAILED=4 SKIPPED=0 KNOWN=1` (pre-plan 47/0/1); the four failures are exactly the expected-red window below. A first run under load (a baseline sweep running in parallel) read FAILED=5; the repeat read 4 twice, so I count the fifth as a load flake I could not name.
- Gate-touching sweep (69 files from `grep -lE "gate_render|gate_answer|gate-ledger" tests/*.cjs`) compared with a `git archive` copy of the pre-plan tree: the only flips to red are tests/test-365-never-do-gate.cjs and tests/test-267-mcpv2-dual-era.cjs, both plan 369-41 pins. test-369-shared-core and test-369-shell-actions read green after (red / skip before): peer-tree state, not this plan.
- Dash guard over all seven files: `LC_ALL=C /usr/bin/grep -nP "\xE2\x80\x94|\xE2\x80\x93"` prints nothing.

## Expected-red window (measured, owned by plan 369-41; GATE_BASE NOT re-pinned)

From commit 6b9f50365 (the first gate.cjs commit) until plan 41:

| Check | Measured red |
|-------|--------------|
| tests/test-365-never-do-gate.cjs N12 | `gate_render description and title are byte-identical to PLAN_BASE`; `lib/mcp/tools/gate.cjs is byte-identical to GATE_BASE` (73 pass, 2 fail). Last gate.cjs commit to pin is 6b9f50365 once nothing else changes it |
| tests/test-267-mcpv2-zod4-contract.cjs | (a) description diffs gate_render and room_list; (b) extras `tool:gate_list:membership`, `tool:gate_render:description`, `tool:room_list:description`; (d) two zod importers scripts/mindrian-brain-mcp-client.cjs and scripts/mindrian-mcp-server.cjs. The room_list diff and the (d) importers are pre-existing / 369.1-04, not this plan |
| tests/test-267-mcpv2-registration-api.cjs | `live tools/list count (48) != wire-snapshot-zod4.json local.tools count (47)` |
| tests/test-267-mcpv2-dual-era.cjs | both eras: `tool:gate_list:membership`, `tool:gate_render:description` |
| tests/test-270-tool-schema-budget.cjs | `the measured surface matches the recorded AFTER toolCount` (4 passed, 1 failed) |
| tests/test-276-tool-honesty-findings-closed.cjs | Group C `gate_render.(default) (expects eventual OK) is absent from the live non-OK set` (the honest description removed its non-OK finding); Group F frozen sweep tools and branches differ from live. `node scripts/check-tool-honesty.cjs --check` itself reads OK: 45 tools, 140 branches, 0 high-risk (frozen was 44 / 139) |
| `node scripts/build-connector-registry.cjs --check` | `data/connector-registry.json is STALE`, `data/mcp-tool-connectors.json is STALE` (gate_list is in the source of truth; regenerating is plan 41) |
| `node ui/shared/scripts/gen-mcp-adapter.mjs --check` | measured GREEN ("up to date") at this tree, not red as the plan predicted; plan 41 should still regenerate and re-check |

Other reds in the existing tests are pre-existing (red in the pre-plan archive too): test-237-approve-executes, test-237-autonomy-parity, test-345-gate-ratify, test-363-mcp-tool, test-365-floor-gate, test-366-gated-term-release.

`node scripts/check-shape-declaration.cjs --strict` prints no line naming gate_list; its existing advisory WARNs are unrelated surfaces.

## Deviations from Plan

**1. [Plan wording] `grep -c "json_valid(properties)" room-projection.cjs` is 2 code sites plus 1 comment, not 3 code sites**
- All by-key reads (anchor, raise, close) share one helper, `eventRowByDedupeKey`, so the guard sits once for them; `readOpenRaisedGates` has its own. The doc comment on the helper names the guard. Behaviour is what the criterion protects (arm 9 proves a malformed row aborts nothing); I chose one helper over three copies.

**2. [Plan wording] Task 3 said the connector-registry gate is OK for gate_list**
- The plan also forbids regenerating data/*.json and gives that to plan 41, so `--check` is STALE by design in this window. The born-wired source (the `connectors` entry, hitl_shape none) is in place and the shape-declaration check names nothing for gate_list.

**3. [Rule 2 - hardening] gate_list refuses the machine-wide registry pointer as a binding**
- The read ladder falls back to the registry `active` room for an unbound session. The plan's own rule (lists only the caller's bound room, T-369-33-02) and its `room_unbound` answer mean that is not a binding, so source `reg.active` answers `room_unbound`. Daemon and CLI sessions bind through room_bind, so nothing in the plan's arms changes.

No other deviations. No auth gates.

## Known Stubs

None.

## Notes for later plans

- **Plan 369-36 (mirror):** the reader already reports `answered_via` and maps `decision_node_id` to `decision:gate:<answered_via>`; `contractOf` and the observer skip entries carrying `mirrorOf`, and `readOpenRaisedGates` skips rows carrying `mirror_of`.
- **Plan 369-41:** move every pin in the table above once, after the last gate.cjs commit; add a disposition for gate_list only if the sweep asks (it read 45 / 140, 0 high-risk). GATE_BASE should become the full sha of that last commit (currently 6b9f50365).
- **Process coverage:** the observer is installed when lib/mcp/tools/gate.cjs loads (every MCP server process via register-core-tools, and any process that requires it). A process that mints into the ledger without ever loading gate.cjs, notably `scripts/operator-command.cjs` (it requires gate-ledger.cjs directly and mints `kind: general`), leaves no record. A handoff, not edited here: if that command must be visible to the shell, it should require lib/mcp/tools/gate.cjs (or a small install shim) before it mints.
- **Cost:** gate_render is now a room write when a room is bound (one `mcp_client_event_logged` row, plus one more at a take without an answer), visible as activity rows in the change feed; its description says so. A gate whose owning process ends before an answer stays listed until its 30-minute window closes.

## Threat Flags

None new. T-369-33-01 (no session identity in the record) is asserted by arm 2; -03 (observers cannot change a result) by arm 10; -04 (caps, 50 items) by arm 11; -06 (room-local only, no Brain call) holds by construction (gate-raised.cjs requires only navigation.cjs and gate-ledger.cjs).

## Self-Check: PASSED

Created files exist (lib/mcp/gate-raised.cjs, tests/test-369-gate-raised.cjs, tests/helpers/cli-gate-369.cjs); commits 461afc04e, d8b649a1e and 6b9f50365 are ancestors of HEAD; no STATE.md, ROADMAP.md or 369.1-owned file was edited by this plan.
