---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 21
subsystem: ui-shell
tags: [ui-shell, human-only, gate, exposure-policy, render-nonce, d-15, acceptance]
requires: [369-14, 369-32]
provides:
  - createNonceStore (issue, reserve, release, burn, forgetSession) in ui/shell/server/human-origin.ts
  - readGate issues a single-use render nonce bound to one gate and one browser session
  - approveDecision reserves the nonce before any MCP call, releases it in a finally on refusal or failure, burns it only on ok
  - client readGate/approveDecision helpers that keep the nonce in page memory only
  - tests/test-369-human-only.cjs, the D-15 acceptance test
affects: [369-23, 369-24, 369-25, 369-26, 369-27, 369-31]
key-files:
  created:
    - ui/shell/server/human-origin.ts
    - tests/test-369-human-only.cjs
  modified:
    - ui/shell/server/actions.ts
    - ui/shell/client/api.ts
    - tests/test-369-shell-actions.cjs (carries the nonce through the human path, see Deviations)
decisions:
  - "Check-then-reserve in one synchronous step: the nonce goes issued -> in_flight before any await, so two concurrent submits cannot both reach gate_answer; release returns it to issued (in a finally) when the room refuses or the call throws, burn makes it used only when gate_answer returns ok"
  - "A nonce refusal is { ok: false, reason: 'human_only', detail: <nonce_missing|nonce_mismatch|nonce_in_flight|nonce_used|nonce_expired> }; an exposure refusal carries `exposure` instead, so the two are distinguishable (actionStatus already maps human_only to 403)"
  - "reserve looks the record up by (browser session, gate) and compares the token with timingSafeEqual; no record for that pair is nonce_mismatch (the token belongs to another gate or session)"
  - "A re-read while an approval is in flight returns the same reserved nonce instead of replacing it, so a re-read cannot open a second path to gate_answer"
  - "The abandoned-gate (room_switched) check stays before reserve: it makes no MCP call and changes nothing, and an abandoned gate has no nonce to present"
  - "Nonce TTL is 30 minutes, carried by value (the walled package never imports lib/); the acceptance test pins it equal to LEDGER_TTL_MS from lib/mcp/gate-ledger.cjs"
  - "Nonces are dropped with their browser session (forget) and on a pool reconnect (sessionRestarted), the same moments gate records are"
metrics:
  tasks: 2
  commits: 2
  completed: 2026-10-03
---

# Phase 369 Plan 21: The human-only gate Summary

"Only a person approves" is now a property of the code: `approveDecision` accepts only a browser-route call that carries a single-use render nonce the server issued to that browser session for that exact gate, so an agent can propose a claim but cannot approve it with a forged principal, a guessed token, or a direct MCP call.

## What was built

- **human-origin.ts (D-15).** `createNonceStore({ now, ttlMs })`: `issue` mints a 32-byte base64url token per (browser session, gate) and invalidates an earlier one (except one in flight, which is returned unchanged); `reserve` validates and marks the nonce in flight in one synchronous step; `release` returns it to issued; `burn` makes it used; `forgetSession` drops a session's records. Reasons: `nonce_missing`, `nonce_mismatch`, `nonce_in_flight`, `nonce_used`, `nonce_expired`. Comparison is `crypto.timingSafeEqual`; tokens come from `crypto.randomBytes`.
- **actions.ts.** `readGate` (human-only) is the only place a nonce is issued and returns it as `render_nonce`. `approveDecision` (still the only action whose body calls `gate_answer`) requires `render_nonce`: abandoned-room check, then `reserve`, then the room check and `gate_answer` inside a `try`, `burn` only when the answer is ok, `release` in the `finally` otherwise. A failed reserve answers `human_only` with `detail` and makes no MCP call. The store is injectable through `createShellActions({ nonces })` (the test passes its own) and defaults to one per registry.
- **client/api.ts.** `readGate` keeps the nonce in a module-level Map (page memory; no storage, cookie or URL) and strips it from what the caller gets back. `approveDecision` sends it and, on `human_only`, drops it and re-reads the gate once so the next click carries a fresh nonce.
- **tests/test-369-human-only.cjs.** The D-15 acceptance test, 10 arms, run against the hermetic daemon and the built shell.

## The D-15 acceptance result

| Arm | Proves | Result |
|-----|--------|--------|
| 1 | the agent proposes; the gate is recorded on the browser session's own MCP key (not the adapter's) | PASS |
| 2 | the agent approving through the same action, plain, with `principal: 'human'` forged, and with a guessed nonce, is refused `human_only`; the agent cannot read the gate so it cannot obtain a nonce; no `gate_answer`, G1 still listed, no decision node | PASS |
| 3 | no nonce, a blank one, another gate's, another session's, a made-up token: `human_only` with `nonce_missing` / `nonce_mismatch`; none reach `gate_answer` | PASS |
| 3b | (i) a pool-spy refusal and an injected throw both leave the nonce released, not burned (a direct reserve succeeds) and the gate answerable; (ii) a real room refusal (option outside the card) releases it too | PASS |
| 4 | the adapter's own MCP session calling `gate_answer` on a gate minted for the browser session: `session_mismatch`; nothing written | PASS |
| 5 | the click with the nonce `readGate` issued ratifies, the `decision:gate:<G1>` node exists in room.db, reuse of the nonce is `nonce_used`, a re-read replaces the earlier nonce | PASS |
| 6 | static: one `gateAnswer(` call site, inside approveDecision; reserve before it, burn after it and only on ok, release in a finally; one `nonces.issue(` inside readGate; no `render_nonce` or issued nonce in any agent-path response; no storage/cookie/URL use in api.ts; nonce TTL equals the ledger TTL | PASS |
| 6b | the nonce store on its own: single use, expiry, re-issue, in-flight, forgetSession | PASS |
| 7 | two concurrent submits with one nonce (`Promise.all`): exactly one `gate_answer` call, one decision node, the loser `nonce_in_flight` | PASS |
| 8 | over real HTTP (built shell, `MOS_PROPOSAL_SOURCE=adapter`): no cookie (401/403), no CSRF header (403 `csrf_missing`), forged Origin (403), cross-site (403): none ratify, the gate stays listed, no decision node; a body claiming `principal: 'human'` without a nonce is 403 `nonce_missing`; then the genuine click with the same, unspent nonce ratifies (200) and a replay is `nonce_used` | PASS (ran, not skipped) |

`node tests/test-369-human-only.cjs`: PASS=10 FAIL=0 SKIP=0, exit 0.

### The D-16 boundary, still visible (KNOWN until Phase 289)

Two lines print today and flip by themselves when Phase 289 lands (detected from `lib/mcp/gate-ledger.cjs` source, the same detection `test-369-sessionful-acceptance.cjs` arm 4 uses):

- Arm 4: "KNOWN: a cross-session refusal burns the owner's gate (spike 007 burn-probe); Phase 289 fixes it". The owner's own `approveDecision` after the adapter session's refusal answers `unknown_or_expired_gate` today.
- Arm 3b(ii): "KNOWN: a refused answer burns the gate before the ledger checks (lib/mcp/gate-ledger.cjs consumeGate and gate.cjs consume before validation); Phase 289 fixes it, plan 26 arm 9 and plan 27 prove it end to end". The shell-side half (the nonce is released after a refusal) is proven here on the pool spy; "a refusal leaves the gate answerable" is plan 26 arm 9 and plan 27's, as the plan states.

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-369-human-only.cjs` | PASS=10 FAIL=0 SKIP=0, exit 0 |
| `node tests/test-369-shell-actions.cjs` | PASS=17 FAIL=0 (after rebuilding the shell) |
| `node tests/test-369-shell-server.cjs` | 35 passed, 0 failed |
| `node tests/test-369-canon-skin.cjs` | 30 passed, 0 failed |
| `node tests/test-369-walled-manifest.cjs` | 8 passed, 0 failed |
| `node tests/test-369-ts-erasable-gate.cjs` | 8 passed, 0 failed |
| `cd ui/shell && npx tsc --noEmit` | exit 0 |
| `cd ui/shell && npm run build` | exit 0 |
| `grep -c render_nonce ui/shell/server/actions.ts` | 5 |
| `grep -cE "localStorage\|sessionStorage" ui/shell/client/api.ts` | 0 |
| long dashes in the touched files | none |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/test-369-shell-actions.cjs carried approveDecision calls with no nonce**
- **Found during:** Task 1
- **Issue:** Requiring `render_nonce` on `approveDecision` made arms 5c, 5d and the HTTP arm 6 of the existing plan-32 test refuse (`human_only`), and the plan's own acceptance criterion says that test still exits 0. The file is not in the plan's `files_modified`.
- **Fix:** a small `approveWith` helper reads the gate first and sends the nonce (the human click path); arm 5c's replay now reuses the burned nonce and asserts the stronger `human_only` / `nonce_used` (it is stopped before any MCP call instead of reaching the server's `unknown_or_expired_gate`); arm 6's forged-principal check now asserts `human_only` with `detail: 'nonce_missing'` and no `exposure` field (the action ran; the principal field changed nothing).
- **Files modified:** tests/test-369-shell-actions.cjs
- **Commit:** b5dcdbeab

**2. [Rule 2 - Correctness] A re-read during an in-flight approval returns the reserved nonce**
- **Found during:** Task 1 design (T-369-21-07)
- **Issue:** letting `issue` replace an in-flight nonce would let a re-read open a second path to `gate_answer` while the first call is still running.
- **Fix:** `issue` returns the in-flight nonce unchanged; covered by arm 6b.
- **Commit:** b5dcdbeab

**3. [Rule 2 - Correctness] Nonce cleanup tied to session and gate lifetime**
- **Issue:** the plan names issue/reserve/release/burn only; nonces for an expired browser session or a reconnected MCP session (whose gates are gone) would linger.
- **Fix:** `forgetSession` called from `forget` (browser session expiry) and `sessionRestarted` (pool reconnect); expired non-in-flight records are swept on every `issue`.
- **Commit:** b5dcdbeab

### Notes

- The ui/shell client has no gate view yet; the nonce handling lives in `client/api.ts` helpers (`readGate`, `approveDecision`) that the gate view built later in the phase calls. The "component memory only" property is a module-level Map in the page's JS memory; the static arm pins no storage, cookie or URL use in that file.
- `tests/run-all-369.sh` was not touched (not in this plan's files); registering the new test there is plan 31's roll-up.
- The shell build output (`ui/shell/.next`) was rebuilt locally so the HTTP arms run against the new code; it is gitignored.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the `render_nonce` field on the existing readGate and approveDecision actions, covered by T-369-21-01..08.

## Commits

- b5dcdbeab feat(369-21): single-use render nonce binds an approval to a click in the browser that was shown the gate
- 288d82edb test(369-21): D-15 acceptance, the agent proposes and is refused approval; only the click with its nonce ratifies

## Self-Check: PASSED

- FOUND: ui/shell/server/human-origin.ts, tests/test-369-human-only.cjs, ui/shell/server/actions.ts, ui/shell/client/api.ts
- FOUND commits: b5dcdbeab, 288d82edb
- STATE.md and ROADMAP.md untouched; nothing added to the root package.json
