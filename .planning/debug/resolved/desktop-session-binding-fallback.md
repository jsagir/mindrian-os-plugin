---
status: resolved
kind: rca
trigger: "desktop-session-binding-fallback"
issue_id: ""
severity: high
surfaces: [desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-10-02
updated: 2026-10-02
resolved: 2026-10-02
classification: NEW FAILURE
---

> RESOLVED 2026-10-02 (navigator ruling "process key + refuse", see the bottom of this file).
> Originally filed by the test-birth-registry-leak debug session (Scope item 5) from evidence in
> `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-TRIPOLAR-PROBES.md`
> (F-1, F-2, F-3). Fixed and verified by an automated Desktop-surrogate end-to-end test; a human Desktop smoke
> on the real client is still owed (MCPV2-13 stays open for that leg).

## Current Focus

hypothesis: CONFIRMED and fixed. Two stacked gaps: (1) Desktop stdio has no re-derivable session identity, so `resolveEffectiveSessionId` returned null; (2) every room-writing MCP tool resolved the room through the read-side ladder that falls to the machine-wide registry `active` pointer, with no write-authority check.
test: Desktop-surrogate e2e (tests/test-desktop-stdio-session-binding.cjs) against the real stdio server, RED then GREEN.
expecting: n/a (done).
next_action: none. Human Desktop smoke on the real client is the only open item.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.56 (dev tree; HEAD 73246744d at filing time)
- Reported by: navigator, live Claude Desktop (Windows 11 + `wsl.exe -d Ubuntu`) probe, 2026-10-02
- Date first observed: 2026-10-02
- Related debug sessions: test-birth-registry-leak (the poisoned `active` value that made this visible), registry-active-room-concurrent-session-collision (added the CLAUDE_CODE_SESSION_ID fallback, CLI only), registry-active-session-unbound-inheritance (ownership gate, opt-in, reach-card only), resolve-active-room-cross-session-bleed (resolveSessionRoom), room-bind-mcp-first-off-falls-back-to-stale-global-active-room, mcp-shim-preseeded-session-id-rejected

## Source-of-Truth Preamble

- **CODE claims read against:** working tree of branch `main` @ 73246744d (plugin 2.0.0-beta.56), read-only. Not re-verified against `origin/main` HEAD; tag `needs-source-reverify` before any fix lands.
- **WIRE claims probe against:** the navigator's Desktop tee log `/tmp/mos-tee-desktop.jsonl` (22 lines) as summarized in 267-TRIPOLAR-PROBES.md, server `mindrian-os` 2.0.0-beta.56 (dev tree, pre-267-11 v1 McpServer). Not re-probed by this filing.
- **Date of audit:** 2026-10-02
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding.

## Problem Statement

On Claude Desktop (stdio, no session id) `room_bind` fails with `no_session_id`; an explicit-sessionId bind reports `effective: true`, yet `claim_write` and room-state reads ignore that binding and silently use the global registry `active` room. A write can therefore land in a room the navigator never chose.

## Symptoms

expected: after `room_bind` (with or without an explicit sessionId) on Desktop, every later write and read in that conversation targets the bound room; an unbound session never writes into a room it did not choose.
actual: `room_bind` with no args returns `{"ok": false, "reason": "no_session_id"}`. The model re-bound with an explicit sessionId and got `effective: true`. The next `claim_write` wrote `claim:nosession:8e71dd1e` into the registry `active` room (at that moment the leaked fixture `/tmp/birth-idem-2RRSMu/idem-room`, see test-birth-registry-leak) instead of the bound `ador-ip-test`, and reported the location truthfully (tool text matched that room.db).
errors: `no_session_id` (lib/mcp/tool-router.cjs:2186). Stderr token `MCP_FIRST_DEPRECATED_ACTIVE_WRITE session=undefined room=<slug>` is the only trace of the fallback and Desktop does not surface MCP stderr.
reproduction:
  1. Claude Desktop, MindrianOS MCP server over stdio (no CLAUDE_CODE_SESSION_ID in the server env, SDK `extra.sessionId` unset).
  2. Ask Larry to `room_bind` a room (no sessionId): observe `no_session_id`.
  3. Bind again with an explicit `sessionId`: observe `effective: true, resolved_source: session.primary`.
  4. Call `claim_write` (no sessionId): observe the claim lands in the registry `active` room with id `claim:nosession:<hash>`.
started: not a regression of a single commit. The explicit-sessionId bind + `effective` round-trip shipped in Phase 248-02; the stdio `CLAUDE_CODE_SESSION_ID` fallback (RCA registry-active-room-concurrent-session-collision) covers the CLI only. First observed live 2026-10-02 because the registry `active` pointed at a fixture (test-birth-registry-leak), which made the wrong target visible.

## Scope and Impact

- Affected surfaces: Claude Desktop (stdio) confirmed; Cowork unknown until the A7 probe in 267-TRIPOLAR-PROBES.md (Cowork leg) runs. CLI is not affected (CLAUDE_CODE_SESSION_ID exists).
- Affected commands: every MCP tool that resolves its room through `resolveMcpSessionRoom` / `resolveSessionRoomDir` without a model-supplied sessionId: `claim_write`, `status_read`, room-state reads, anything under lib/mcp/tools/*.
- Affected users: every Desktop stdio user with more than one room, or whose registry `active` differs from the room they bound.
- Version range: from Phase 248-02 (explicit-sessionId `room_bind`) to 2.0.0-beta.56.
- Severity: high (silent write to the wrong room; truthful reporting limits it to "detectable if read carefully").
- Blast radius: any code path that treats `reg.active` as a write target for an unbound session. The D-04 comment in lib/mcp/session-room.cjs says `reg.active` is "a READ-fallback ... not write authority anymore" but the code still returns `{dir: hit.abs_path}` for `forWrite` and only logs to stderr.

## Eliminated

- hypothesis: the explicit-sessionId bind did not persist.
  evidence: `room_bind` returned `effective: true` with `resolved_source: session.primary`; `honestBindResult` round-trips the write through `resolveMcpSessionRoom` with the SAME explicit id (lib/mcp/tool-router.cjs:2200-2215). The write/read pair agrees for that key.
  timestamp: 2026-10-02
- hypothesis: closing the `forWrite` branch of `resolveMcpSessionRoom` (the filing's "Change 2" location) is enough to stop wrong-room writes.
  evidence: only the tool-router `resolveWriteTargetDir` sites call that branch; claim_write, memory_event, artifact_file, graph_write, gate_answer, claim_verify, question_set and chain_run resolve through the read-side `resolveSessionRoomDir`, which has no write notion at all. A new write-authority gate (`resolveMcpWriteRoom`) was required at every writing tool.
  timestamp: 2026-10-02

## Evidence

- timestamp: 2026-10-02
  checked: 267-TRIPOLAR-PROBES.md F-2 plus the tee log summary (22 lines; `initialize` first, no `server/discover`, clientInfo `claude-ai`, tools/call x3)
  found: Desktop opens with a 2025-11-25 `initialize`; no session identifier is exposed to the server beyond what the model passes as tool arguments.
  implication: the server cannot derive a stable per-connection key from the transport on Desktop stdio.
- timestamp: 2026-10-02
  checked: lib/core/session-binding.cjs:139-141 `resolveEffectiveSessionId`
  found: `return explicitSessionId || (extra && extra.sessionId) || process.env.CLAUDE_CODE_SESSION_ID || null;`
  implication: on Desktop stdio all three inputs are absent unless the model passes `sessionId` explicitly, so every call that does not pass it gets null.
- timestamp: 2026-10-02
  checked: lib/mcp/tools/room.cjs:383,412 and the other tool modules call `resolveEffectiveSessionId(undefined, extra)` then `resolveSessionRoomDir(sessionId, ctx)`
  found: only `room_bind` accepts an explicit `sessionId` input (lib/mcp/tool-router.cjs:2162-2164); the model has no reason to repeat it on other tools.
  implication: the binding is written under a key no later call can reproduce.
- timestamp: 2026-10-02
  checked: lib/mcp/session-room.cjs `resolveMcpSessionRoom` (forWrite branch)
  found: when the ladder lands on `reg.active` for a write it logs `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` to stderr and still returns the room as the write target.
  implication: the "reg.active is not write authority" doctrine is stated in comments but not enforced; an unbound Desktop session writes to whatever the machine-wide pointer says.
- timestamp: 2026-10-02
  checked: read-only listing of the real `~/MindrianRooms/.rooms/sessions/` (one file read)
  found: `claude-ai-chat-2026-10-02.json` = `{"bound":["ador-ip-test"],"primary":"ador-ip-test","sticky":false,"updated":"2026-10-02T01:24:11.633Z"}`. The id is not a UUID: it is a string the model invented for the explicit-sessionId re-bind, written ~2.5 minutes after the fixture leak (01:21:38Z).
  implication: direct physical evidence of the orphaned binding. The write under that key succeeded and is correct; no later call can present that key, so it is never read. This matches the provisional root cause.
- timestamp: 2026-10-02
  checked: test-birth-registry-leak debug session
  found: the poisoned `active` came from a test run, now fixed and guarded. The fallback itself is untouched.
  implication: the next time anything moves `active` (another session's `set-active`, a manual `/mos:rooms open`), Desktop writes follow it silently.

- timestamp: 2026-10-02 (resolve session)
  checked: re-verification of every code claim against HEAD 98fe4f783 (post v2 migration; line numbers moved)
  found: `resolveEffectiveSessionId` is now lib/core/session-binding.cjs:127-141 (same three tiers, same null). `lib/mcp/session-room.cjs` forWrite branch unchanged (logs the token, still returns the room). CORRECTION to the filing: `claim_write`, `memory_event`, `artifact_file`, `graph_write`, `gate_answer`, `claim_verify`, `question_set` and `chain_run` never call the forWrite branch at all; they resolve through `resolveSessionRoomDir(sessionId, ctx)` (the read-side ladder), so they did not even emit the stderr token. Only the tool-router `resolveWriteTargetDir` sites (room_content writes, file-meeting, eureka legacy) reached it. So "Change 2" had to be a new write-authority gate, not an edit to the forWrite leg.
  implication: the doctrine "reg.active is not write authority" (D-04) was unenforced everywhere on the MCP surface, and untraced for the nine tool modules.
- timestamp: 2026-10-02 (resolve session)
  checked: RED run of the new surrogate test against unfixed HEAD (clientInfo claude-ai 0.1.0, protocol 2025-11-25, extensions-only capabilities, no session id, temp rooms home, room-a registry active, room-b present, real room.db in both)
  found: `room_bind {room:'room-b'}` -> `{"ok": false, "reason": "no_session_id"}`; `status_read` and `room_state_bound` report room-a; an unbound `claim_write` returns ok:true with `room_dir` room-a and `node_id` `claim:nosession:260cab80` (the exact incident); an ungated `gate_answer` approve wrote 3 nodes into room-a. 15 of 17 arms RED, for the right reasons. (A fixture without a pre-created room.db shows `no_room_db` instead, because `openRoomDbForCaller` refuses to create one; the first RED attempt hid the bug that way, so the fixture now gives both rooms a real room.db.)
  implication: reproduced hermetically, end to end, post-migration. Root cause confirmed.
- timestamp: 2026-10-02 (resolve session)
  checked: peer interaction, gate ledger and research gates
  found: `gate-ledger.ledgerSessionKey(sessionId)` returns a non-empty string unchanged and collapses null/undefined/'' to `no-session:<pid>`. research.cjs mints `kind: 'material_step'` gates with `sessionId` from `resolveEffectiveSessionId`, answered through `gate_answer` which compares through the same function. Both sides take the same resolver, so a process-scoped stdio key flows through unchanged on mint and consume.
  implication: no change to `ledgerSessionKey` was needed; the only difference is its INPUT on stdio (null before, the stdio key now), identical on both sides.
- timestamp: 2026-10-02 (resolve session)
  checked: first full regression diff (389 MCP-adjacent test files, hermetic HOME, HEAD archive baseline vs HEAD+change)
  found: exactly one regression, tests/test-234-host-tier.cjs: it drives the stdio server unbound with `CLAUDE_ACTIVE_ROOM=<room>` and expects `graph_write` to land. `CLAUDE_ACTIVE_ROOM` is a per-process env pin (resolveActiveRoom step 1), not the shared registry pointer.
  implication: the refusal exists for the shared mutable pointer; an operator's per-process pin is a room the operator chose. Carved out in `isOperatorPinnedRoom` and covered by arm 2f.

## Technical Root Cause

CONFIRMED (reproduced hermetically against the real stdio server on HEAD 98fe4f783).

- Site 1: lib/core/session-binding.cjs `resolveEffectiveSessionId` (no key on Desktop stdio) and the `no_session_id` return in tool-router `room_bind`.
- Site 2: every room-writing tool resolved its room through `resolveSessionRoomDir` (lib/mcp/session-room.cjs, read-side ladder) whose leg B is the machine-wide registry `active` pointer, with no write-authority check anywhere.
- Cause: two stacked gaps. (1) Desktop stdio has no re-derivable session identity, so a binding written under a model-supplied id is orphaned (no later call can present that key). (2) The resolver treats the machine-wide `active` pointer as an acceptable write target for an unbound session; the D-04 "not write authority" doctrine existed only in comments and, for most tools, was not even logged.
- Why it surfaced now: the registry `active` was a /tmp fixture (test-birth-registry-leak), which turned a latent wrong-room write into an observable one.

## Code Changes Applied

- Change 1 (key the binding to something Desktop can re-derive): `registerStdioProcessSession()` in lib/core/session-binding.cjs mints ONE key per process (`stdio-<pid>-<12 hex>`, module state, not an env var, so a child process cannot inherit it). It is the 4th tier of `resolveEffectiveSessionId` (explicit > SDK `extra.sessionId` > `CLAUDE_CODE_SESSION_ID` > stdio key > null). bin/mindrian-mcp-server.cjs registers it ONLY on the two stdio serve paths (main stdio branch and the express-missing fallback), never on an HTTP branch, so a daemon serving many clients stays session-less and a binding is never shared across clients.
- Change 2 (do not write to `reg.active` for an unbound session): `resolveMcpWriteRoom` in lib/mcp/session-room.cjs is the write-authority gate. `session.primary` and `room-root` may be written; `reg.active` is refused with the typed reason `no_bound_room` ("bind a room first") once the session has an identity to bind under; a CLAUDE_ACTIVE_ROOM env pin (operator's per-process choice) stays allowed; `boot-fallback` stays allowed only if the directory exists; `none` is refused. Called by claim_write, memory_event, artifact_file, graph_write, gate_answer, claim_verify, question_set, chain_run (start path), and the tool-router write sites (room_content file-opportunity / create-funding / update-funding-stage, meeting file-meeting, eureka legacy). A session-less caller (HTTP flag-OFF, in-process) cannot bind, so it keeps the legacy behavior with the stderr token as its trace.
- Change 3 (honest `effective`): `room_bind` now returns `carries_to_later_calls` and, when an explicit sessionId will not be resolved by later calls, a `warning` that says to bind again without sessionId.
- Point 2 (reads): `describeRoomBinding` labels an unbound read as the registry fallback (`bound:false`, `registry_fallback:true`, plain-words note). status_read (`segments.room_binding`), room_state_bound (`room_binding` + `note`) and room_state status/get-state (appended line) carry it.
- Point 4 (`claim:nosession:`): claim_write and meeting file-meeting refuse with `no_session_id` when the connection has no session identity at all, before any room db is opened. A binding-card gate (kind `binding`) still ratifies when unbound, with no room write, so the F.8 "which room?" ceremony cannot deadlock.

## Tests Added

- tests/test-desktop-stdio-session-binding.cjs (new, 18 arms, RED in 9048d82a3, GREEN in 96804284d): 1a-1d bind-then-act (bind with no sessionId, reads follow it, claim_write lands in room-b's room.db under a non-nosession id with room-a unchanged, gate_render -> gate_answer approve in the same process); 2a-2f nothing bound (typed refusal on every write tool with room-a byte-for-byte unchanged, reads labelled as the registry fallback, binding-card gate still ratifies, non-binding gate_answer refuses, operator pin carve-out); 3 two windows do not share a binding; 4 explicit sessionId wins and warns; 5 CLI path (CLAUDE_CODE_SESSION_ID keys the binding, no stdio-* file); 6a-6c key mechanics (precedence, per-process distinct, ledgerSessionKey unchanged, mint/consume round trip); 7 HTTP flag-OFF still answers no_session_id.
- Registered in tests/run-all-248.sh (own-file run_if leg plus the em-dash sweep) and tests/run-all-267.sh (regression leg).

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under [Unreleased] v2.0.0-beta.56 (also removed the stale "Known issues" bullet for this defect). Done.
- Release lockstep applies when this ships (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5); not done here, never bump versions by hand.
- Canon Part 9 (memory locality): the stdio key is LOCAL only (a binding file name under .rooms/sessions); zero Brain egress; the Part 8 local-only floor on session-binding.cjs stays green (no http/fetch token in the file).
- Tri-Polar: Desktop fixed; CLI unchanged by construction for a bound session (CLAUDE_CODE_SESSION_ID outranks the stdio key); Cowork: the flag-OFF HTTP route is session-less and unchanged (A7 still pending: does Cowork reach it?), the flag-ON daemon keys by transport session id and now refuses unbound writes.
- 267-TRIPOLAR-PROBES.md F-1 ("list my rooms" returned a reference doc rather than data) remains a separate, smaller defect, not covered here.

## Resolution

root_cause: Claude Desktop is stdio with no session id anywhere, so `resolveEffectiveSessionId` returned null (room_bind failed with `no_session_id`; a bind under a model-invented explicit id was orphaned because no later call could present that key). Independently, every room-writing MCP tool resolved the room through the read-side ladder whose last leg is the machine-wide registry `active` pointer, with no write-authority check, so an unbound session wrote into whatever room another session or a manual `rooms open` last activated, minting `claim:nosession:<hash>`. Reproduced hermetically end to end against the real stdio server on HEAD 98fe4f783.
fix: process-scoped stdio session key (4th tier of `resolveEffectiveSessionId`, registered only on the stdio serve paths) plus a write-authority gate `resolveMcpWriteRoom` that refuses `reg.active` for a session with an identity (typed `no_bound_room`), applied at claim_write, memory_event, artifact_file, graph_write, gate_answer (binding-card exempt), claim_verify, question_set, chain_run, meeting file-meeting and the router room-content writes; claims from an identity-less connection are refused (`no_session_id`); reads label the registry fallback; `room_bind` reports `carries_to_later_calls`. Operator CLAUDE_ACTIVE_ROOM pin carved out. No inputSchema or description changed, so no wire-snapshot or honesty-ledger refresh.
verification: RED first (9048d82a3): 15 of 17 arms failed for the right reasons, reproducing `no_session_id` and `claim:nosession:260cab80` landing in room-a. GREEN (96804284d): tests/test-desktop-stdio-session-binding.cjs 18/18. Regression: 389 MCP-adjacent test files plus 56 more, hermetic HOME, HEAD-archive baseline vs HEAD+change: no regression after the CLAUDE_ACTIVE_ROOM carve-out (one regression found and fixed: test-234-host-tier). run-all-267: 30 PASS / 3 FAIL, where CIRS gates and zod4 contract fail identically on the baseline (pre-existing wire-snapshot drift from peer work: orchestration description, research_run membership, connector count 32 vs 31) and 354 concurrency surfaces fails only under the hermetic HOME because the Playwright browser cache is missing there (25/25 PASS with PLAYWRIGHT_BROWSERS_PATH set; K4 drives artifact_file through bound clients). run-all-248: 11/11. Dual-era, clients, flag-on, http-flag-off all PASS. Automated Desktop-surrogate only: NOT a human smoke on real Claude Desktop (MCPV2-13 Desktop leg still owed).
files_changed: [bin/mindrian-mcp-server.cjs, lib/core/session-binding.cjs, lib/mcp/session-room.cjs, lib/mcp/tool-router.cjs, lib/mcp/tools/claim.cjs, lib/mcp/tools/graph.cjs, lib/mcp/tools/views.cjs, lib/mcp/tools/gate.cjs, lib/mcp/tools/question.cjs, lib/mcp/tools/claim-verify.cjs, lib/mcp/tools/chain.cjs, lib/mcp/tools/status.cjs, lib/mcp/tools/room.cjs, tests/test-desktop-stdio-session-binding.cjs, tests/run-all-248.sh, tests/run-all-267.sh, CHANGELOG.md]
commits: [9048d82a3 (RED test), 96804284d (fix)]
open_items:
  - research.cjs (peer-owned, quick 261002-cud) still accepts `reg.active` for an unbound session in its own `resolveRoom`; it should call `resolveMcpWriteRoom` (its material_step gates are answered through gate_answer, which now refuses an unbound non-binding gate, so an unbound research flow now fails at answer time instead of at start).
  - tool-router `room_content` file-opportunity / create-funding / update-funding-stage take a JSON payload in `section`, but the wire schema restricts `section` to [a-z0-9-]+, so those three writes are unreachable over MCP (pre-existing, found by the test; guarded anyway).
  - `.rooms/sessions/stdio-<pid>-*.json` files accumulate one per Desktop window launch with no reaper (the CLI's per-session files have the same property); the RCA's "persist with the server pid and reap on next start" long-term item is not done.
  - `boot-fallback` (MINDRIAN_ROOM or `./room`) remains a write target for an unbound session when the directory exists (the operator's own pin); a stray `./room` under the server's cwd would still be written.
  - A session-less caller (HTTP flag-OFF Cowork route) keeps the legacy reg.active write with only the stderr token as trace, because it cannot bind.
  - Human Desktop smoke on the real client (MCPV2-13 Desktop leg) and the Cowork A7 probe.

## Navigator Ruling (2026-10-02)

Fix shape chosen: **process key + refuse**.
1. On a stdio connection with no client-supplied session id (Desktop), mint ONE process-scoped session key (stdio = one client per server process). `room_bind` with no `sessionId` succeeds under it, and every later read and write in that process resolves the same key, so the bind is followed.
2. When nothing is bound for the effective session, WRITES refuse (typed reason, e.g. `no_bound_room`, with a "bind a room first" message) instead of silently falling back to the registry `active` room. Reads may still show the active room but must label it as the registry fallback, never as a binding.
3. Must not regress CLI (CLAUDE_CODE_SESSION_ID path) or HTTP flag-ON/OFF (per-request or per-session ids). An explicit `sessionId` still wins.
4. The `claim:nosession:` id prefix must not be producible for a write that lands in a room.
Shared tree: peers jsagi-be (Phase 366: research.cjs, tool-router.cjs for 366-22, connector data, the honesty fixture) and jsagi-59. Coordinate before editing tool-router.cjs. Use commit --only. Make no STATE/ROADMAP writes. Run tests hermetically (HOME and MINDRIAN_ROOMS_HOME set to mktemp -d). If an inputSchema or description changes, refresh `tests/fixtures/267/wire-snapshot-zod4.json` and the honesty ledger in the same commit.
