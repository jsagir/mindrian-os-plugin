# Phase 369 Session Contract (SESS369-04)

Settled by plan 369-07. The shell server plans (plan 19 for sign-in, the MCP client plans for the wire) implement exactly this unless the navigator overrules it. Evidence is the live-daemon acceptance `tests/test-369-sessionful-acceptance.cjs` (arms 1-6) and `tests/test-369-daemon-env-scrub.cjs`.

Why this exists in one sentence: the flag-ON daemon keeps room binding, gate ownership and the ledger keyed on one thing, the transport session id, so the shell must be a client that always has one, and nothing the daemon inherited from a terminal may stand in for it.

## 1. Client mode (D-19)

The shell server's MCP client is `@modelcontextprotocol/client` `Client` with `versionNegotiation: { mode: 'legacy' }` set explicitly, one client per browser session, over `StreamableHTTPClientTransport` to the flag-ON daemon on 127.0.0.1. Never agent-native's own MCP client (it negotiates the modern era). The explicit `mode: 'legacy'` matters: an SDK default change must not be able to move the shell onto the stateless leg without a test going red.

Evidence, all against the shipped Phase 267 server:

- Arm 1 (bind): a legacy client's `room_bind` answers `effective: true` and `carries_to_later_calls: true`, and a binding file `<roomsHome>/.rooms/sessions/<transport session id>.json` exists.
- Arm 2 (mint): `gate_render` on a claim answers renderer `askuserquestion` and a gate id (the daemon surface is cowork, a Claude host surface, and the client declares no elicitation).
- Arm 3 (answer): `gate_answer` approve answers `ok` and `ratified`, and node `decision:gate:<id>` lands in the bound room only.
- Arm 4 (isolation): a second client, unbound or bound to another room, is refused `session_mismatch` for a gate it did not mint and writes nothing.
- Arm 5 (reconnect): after a daemon restart the old transport fails with the HTTP 400 "No valid session ID" class of error; a fresh client starts unbound (`room_binding.bound: false`); a write-scoped call before re-binding is refused `no_bound_room`; after `room_bind` it is effective; the old gate id answers `unknown_or_expired_gate` (the ledger is in memory by contract) while the decision node is still on disk (the durable anchor plan 26's replay builds on).
- Arm 6 (modern, PINNED): an auto-negotiating client negotiates 2026-07-28 and its `room_bind` answers `no_session_id`. Modern request identity is NOT proven, so the shell uses the legacy sessionful path explicitly and no discovery shim is built.

Consequence for the shell: on a 400 or a lost transport the shell server reconnects with a fresh legacy client, re-binds the browser session's room, and treats any gate id minted before the restart as gone (replay is plan 26).

## 2. Host identity (RESEARCH open question 4, Pitfall 10)

The shell is NOT added to `HOST_TIER_MAP` (lib/mcp/surface-detect.cjs). The launcher starts or reuses the daemon with `MINDRIAN_MCP_FIRST=cowork`, because per-connection sessions exist only flag-ON. The shell's `clientInfo.name` is `mindrian-shell`.

The review-and-decision scope (D-08) writes only through `gate_answer`, which is not behind `isWritePathEnabled` (arm 3 ratifies and writes the decision node through it). Any later write action (fileArtifact, reviseClaim, attachEvidence) goes through tools that are behind `isWritePathEnabled`; the explicit `MINDRIAN_MCP_FIRST` flag already makes that true on every host (precedence 1), but each such action revisits host identity in its own phase rather than inheriting this ruling.

## 3. Bootstrap authentication (A3; the 2026-09-20 review line 122: "Store session credentials server-side and avoid tokens in URLs or browser storage")

A one-time bootstrap code, not a token.

- The launcher mints a 32-byte random code (`crypto.randomBytes`, base64url). 32 bytes is a contract default: 256 bits, the same size as every other token in this plan set and far above the 64-bit session-token minimum of OWASP ASVS V3.2.2.
- Valid for 60 seconds. A contract default: long enough to open the printed link from a terminal into a browser on the same machine, short enough that a link left in scrollback is dead before anyone else could read it; a fresh link costs one re-run of the launcher.
- Single use, and bound to the shell server process: only the process that armed its sha256 accepts it. The launcher hands the server only the sha256, through the environment at start or the 0600 control token channel for a running server, so the code itself never appears in a process argument list.
- The printed link carries the code once. The server exchanges it on first request for an HttpOnly, `SameSite=Strict`, `Path=/` session cookie holding an opaque server-side session id, burns the code whether the exchange succeeds or not, and answers with a 303 redirect to a code-free URL so the code leaves the address bar and history. Nothing is written to browser storage.
- A reused or expired code shows the UI-SPEC "Not signed in" copy.
- Login CSRF and DNS rebinding on the exchange: the exchange endpoint answers only a request whose Host is `127.0.0.1:<port>` and that is not cross-site. An Origin other than `http://127.0.0.1:<port>`, or `Sec-Fetch-Site` cross-site or same-site, is refused 403 before the code is touched (a link opened from the terminal arrives as `none`). So a page elsewhere cannot sign the browser into a session someone else armed, and a rebinding hostname is refused.

Reason: no reusable credential ever sits in a URL or in browser storage, which is the review's concern. A single-use code that dies in 60 seconds or at first use is the authorization-code pattern, not a bearer token. The navigator may overrule this; the shell server plan builds exactly this unless told otherwise.

### Amendment 2026-10-04 (gap closure, CR-01; plan 369-37 server half, plan 369-40 launcher half, plan 369-42 browser legs)

Source: 369-REVIEW.md CR-01 (the one-time link was printed to stdout and relayed into a model's context, and the exchange accepted a request with no Origin and no fetch metadata, so a curl or an agent's fetch tool could redeem it, then read a gate nonce and approve a decision) and WR-14. This amendment tightens the bullets above; nothing above is withdrawn.

The exchange contract plans 40 and 42 build on:

1. **Both sign-in exchanges answer only a top-level browser navigation.** `GET /auth/bootstrap?code=...` and `GET /auth/start` pass the Host and Origin allow-list and the cross-site refusal as before, AND require `Sec-Fetch-Site: none`, `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document` exactly. Anything else is 403 `Forbidden` BEFORE the code (or the start slot) is read or burned, so a refused attempt costs the person nothing: the same link still signs in the browser. A browser sends these three headers when the address is typed, a link is followed, or `xdg-open`/`open` launches it; curl and agent fetch tools send none. Test drivers that sign in over raw HTTP send exactly that triple (tests/test-369-human-only.cjs, tests/test-369-shell-actions.cjs); a real browser driver gets it from `page.goto`.
2. **The secret-free start.** `POST /control/bootstrap` (token in `x-mos-control-token`, no Origin, no Sec-Fetch-Site) takes exactly one of `{ "sha256": "<64 hex>" }` (arms a one-time code, as before) or `{ "start": true }` (arms the start slot). A body with both, or `start` that is not `true`, is 400. The slot is single use, valid 60 seconds from arming, replaced by a second arm, and burned by a redemption that passes the guards. `GET /auth/start` redeems it: 303 to `/` with the session cookie, or the Not signed in page (401) when nothing is armed, the slot was used, or it expired. The response to arming is `{ "ok": true, "expires_in_ms": 60000 }`. The launcher (plan 369-40) therefore opens the browser at `http://127.0.0.1:<port>/auth/start` after arming the slot: no code in a URL, in a process argument, on a terminal or in a model's context; a printed `/auth/bootstrap?code=` link remains only for a human at a real terminal.
3. **The control token file (WR-14).** Created with `O_EXCL` and mode 0600 after any regular file already there is unlinked (replaced, never written into); a symbolic link or a directory at the path makes the server refuse to start (`mos-ui-shell refused to start`, exit 1); a directory the server did not create is never chmodded.

Residual risk, in plain words: a process running as the same user that forges the three navigation headers inside the 60-second window can still sign in. That is the CR-02 class (a same-user process acting as the person, because the MCP `gate_answer` has no human principal), which this plan does not answer. It is recorded as a navigator ruling item in 369-REVIEW-FIX.md (plan 369-47). What this amendment removes is the passive path: reading a link off a terminal or a relayed command output and redeeming it with a plain HTTP client.

## 4. The env scrub, the callers, the CLI rung (b) note, and the known 289 result

**The scrub (SESS369-03).** `ensureDaemon` in `lib/mcp/daemon-lifecycle.cjs` now runs `delete env.CLAUDE_CODE_SESSION_ID` after the child env is assembled (spawner env plus `opts.env`) and before `spawn(`. Reason, pinned by arm 6: `resolveEffectiveSessionId` falls back to `process.env.CLAUDE_CODE_SESSION_ID`, so a daemon that inherited one CLI's id binds every stateless modern request, from any client, to that one CLI session (arm 6 spawns a daemon directly with `CLAUDE_CODE_SESSION_ID=cli-session-369` and shows the binding file keyed by it). `tests/test-369-daemon-env-scrub.cjs` proves the delete statically and live (a fixture server records its own env: no `CLAUDE_CODE_SESSION_ID` whether the id came from the spawner or from `opts.env`; `MINDRIAN_TRANSPORT=http` and `MINDRIAN_MCP_DAEMON=1` kept). The hook-driven session variable (RCA 7 / SEED-108) is deliberately untouched. Cost: a modern request to a daemon is now honestly `no_session_id` instead of silently bound to whichever terminal woke the daemon.

**ensureDaemon callers (grep of lib bin hooks scripts):**

- `lib/mcp/adapter-client.cjs` (line 41, `queryDaemon`, which opens its own per-call legacy sessions, proven by `tests/test-267-mcpv2-clients.cjs`)
- `bin/mindrian-mcp-shim.cjs` (line 59, the stdio-to-HTTP proxy)

No other caller. The plugin's own `.mcp.json` runs `bin/mindrian-mcp-server.cjs` directly over stdio, not the shim, so the stdio server's own process env (which keeps `CLAUDE_CODE_SESSION_ID`) is untouched.

**CLI rung (b) note (`267-TRIPOLAR-PROBES.md` lines 69-87).** Claude Code 2.1.287 opens stdio with `server/discover` to the server or shim it spawns itself; that process keeps its own environment, and the scrub only changes the daemon child's env object. On the shim path the shim sets no `versionNegotiation` of its own (it forwards messages verbatim) and passes `process.env.MINDRIAN_SESSION_ID` into the client options' `sessionId` (shim lines 46-73), so the daemon connection never depended on the daemon's inherited `CLAUDE_CODE_SESSION_ID` (static arm 2 of the scrub test pins this). Caveat worth knowing, not caused by this plan: the existing RCA 7 pin in `tests/test-267-mcpv2-clients.cjs` records that the daemon mints its own session id and the hook id is NOT the binding key on that path, and a 2026-era downstream client forwarded verbatim would reach the stateless leg, where the inherited id was the only identity (the bug this scrub removes, not a feature). Neither path relied on the inherited id for correct per-session binding.

**KNOWN owner-after-stranger result (Phase 289 dependency, D-16).** Today `consumeGate` in `lib/mcp/gate-ledger.cjs` deletes the ledger entry before the session check, so a stranger's refused answer burns the owner's gate: the owner's later answer is `unknown_or_expired_gate` (spike 007 burn-probe). Arm 4 records this as `KNOWN` and detects Phase 289's consume-after-checks fix by reading `consumeGate` (a delete after the session check); when it lands, the same arm expects the owner's answer to ratify, with no edit. This plan does not touch the ledger. Shell consequence until 289 lands: the shell must mint and answer a gate on one client only (it does, one client per browser session) and must never forward an answer for a gate id from another browser session.
