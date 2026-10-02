---
status: open
kind: rca
trigger: "desktop-session-binding-fallback"
issue_id: ""
severity: high
surfaces: [desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-10-02
updated: 2026-10-02
classification: NEW FAILURE
---

> FILED ONLY. No fix applied. Filed by the test-birth-registry-leak debug session
> (Scope item 5) from evidence in
> `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-TRIPOLAR-PROBES.md`
> (F-1, F-2, F-3). `lib/mcp/tools/*` and `lib/mcp/tool-router.cjs` are owned by peer
> sessions in this tree, so the fix needs its own owner and its own GSD entry.

## Current Focus

hypothesis: On Claude Desktop stdio there is no per-connection session identity that later tool calls can re-derive. `room_bind` only works when the model hands it an explicit `sessionId`; every subsequent tool resolves `resolveEffectiveSessionId(undefined, extra)` = null, so the binding file written under the explicit id is never read, and writes fall through to the machine-wide registry `active` room.
test: probe `resolveEffectiveSessionId` and `resolveMcpSessionRoom` with the three Desktop-stdio inputs (no explicit id, `extra.sessionId` undefined, `CLAUDE_CODE_SESSION_ID` unset) after an explicit-id `room_bind`.
expecting: `source: reg.active` (not `session.primary`) for claim_write and state reads, claim id `claim:nosession:<hash>`.
next_action: reproduce hermetically with a spawned stdio server under a throwaway HOME (never the real registry), then decide between a process-scoped synthetic session key and refusing unbound writes (see Required Code Changes).

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

## Technical Root Cause

PROVISIONAL (not yet reproduced hermetically; tag needs-source-reverify).

- Site: lib/core/session-binding.cjs:139-141 `resolveEffectiveSessionId` (no key on Desktop stdio) and lib/mcp/session-room.cjs `resolveMcpSessionRoom` (forWrite accepts `reg.active`).
- Cause: two stacked gaps. (1) Desktop stdio has no re-derivable session identity, so a binding written under a model-supplied id is orphaned. (2) The resolver treats the machine-wide `active` pointer as an acceptable write target for an unbound session and reports it only on stderr.
- Why it surfaces now: the registry `active` was a /tmp fixture (test-birth-registry-leak), which turned a latent wrong-room write into an observable one.

## Required Code Changes

PROPOSED, NOT APPLIED. Needs an owner outside the current peers (lib/mcp/* is under the 267-08 executor).

- Change 1 (key the binding to something Desktop can re-derive):
  - Location: lib/core/session-binding.cjs:139-141, function `resolveEffectiveSessionId`.
  - Current behavior: null when explicit id, `extra.sessionId`, and `CLAUDE_CODE_SESSION_ID` are all absent.
  - Required behavior: as a last fallback on stdio, return a process-scoped synthetic key minted once at server start (a stdio server process serves exactly one client connection, so the key is naturally per-conversation and distinct across Desktop windows).
  - Short-term patch: the synthetic key only. `room_bind` with no args then works and later tools find it.
  - Long-term fix: also persist the key with the server pid so a stale file is reaped on the next start.
- Change 2 (do not write to `reg.active` for an unbound session):
  - Location: lib/mcp/session-room.cjs `resolveMcpSessionRoom`, forWrite branch.
  - Current behavior: logs `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` to stderr and returns the active room as the write target.
  - Required behavior: return a refusal the tool turns into an in-turn honest message ("no room bound; call room_bind"), never a silent write.
  - Short-term patch: surface the fallback in the tool response text, not stderr.
  - Long-term fix: remove the reg.active write leg per D-04.
- Change 3 (honest `effective`):
  - Location: lib/mcp/tool-router.cjs `honestBindResult`.
  - Required behavior: when the bind used an explicit sessionId that later calls cannot re-derive, return a warning field so the model knows the binding will not carry.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-desktop-stdio-session-binding.cjs (new)
  - Given: a spawned stdio server under a throwaway HOME and MINDRIAN_ROOMS_HOME with two rooms, no CLAUDE_CODE_SESSION_ID, registry `active` = room B.
  - When: `room_bind` room A without sessionId, then `claim_write`.
  - Then: the claim lands in room A, source `session.primary`; with no bind at all the write is refused, not sent to room B.
  - Runner registration: add to the 248 / 267 run-all scripts.

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry under the target version.
- Release lockstep applies if the fix ships (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5).
- Canon Part 9 (memory locality): the synthetic key must stay LOCAL; no Brain egress. Tri-Polar: verify Desktop and Cowork (A7 probe still pending), CLI unchanged by construction.
- knowledge-base.md: add the block on resolve.
- 267-TRIPOLAR-PROBES.md F-1 ("list my rooms" returned a reference doc rather than data) is a separate, smaller defect; not covered here.

## Resolution

root_cause: PENDING (provisional above; not reproduced).
fix: NOT APPLIED (filed only).
verification: n/a
files_changed: []
commits: []
