---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 32
subsystem: ui-shell
tags: [ui-shell, sessions, actions, exposure-policy, feed-relay, connection-state, d-08, d-14, d-15, d-19]
requires: [369-08, 369-13, 369-14, 369-17, 369-19]
provides:
  - one legacy MCP session per browser session (ui/shell/server/sessions.ts, pool key = mcpKey, client name mindrian-shell)
  - the ten review-and-decision actions with server-side exposure enforcement (createShellActions, invoke)
  - the one browser action route POST /api/actions/<name> behind origin guard, session and CSRF
  - feed relay endpoints (changes, hint SSE, room) and GET /api/status with an honest connection state
  - RoomPicker registered as the root route
affects: [369-20, 369-21, 369-22, 369-23, 369-24, 369-25, 369-26, 369-27, 369-28]
key-files:
  created:
    - ui/shell/server/sessions.ts
    - ui/shell/server/actions.ts
    - ui/shell/server/feed-routes.ts
    - ui/shell/server/connection-state.ts
    - ui/shell/client/RoomPicker.tsx
    - ui/shell/app/api/actions/[name]/route.ts
    - ui/shell/app/api/feed/changes/route.ts
    - ui/shell/app/api/feed/hint/route.ts
    - ui/shell/app/api/feed/room/route.ts
    - ui/shell/app/api/status/route.ts
    - tests/test-369-shell-actions.cjs
  modified:
    - ui/shell/client/routes.ts (appends RoomPicker as the root route)
    - tests/test-369-shell-server.cjs (one narrow scan exception, see Deviations)
decisions:
  - "Route directory: workroom won the bake-off, so the five route modules sit at ui/shell/app/api/... (Next app router); no agent-native mapping was needed"
  - "The principal is read only from invoke's context argument; a principal key in the input is deleted before validation; one refusal word, human_only, covers both directions (plan arm 3), and the answer carries the action's exposure so the direction is readable"
  - "openRoom binds through the pool's bind() (bake-off transplant 1); the browser session also remembers its room, so a reconnect that failed while the daemon was down (the pool then forgets the bound room) is re-bound by ensureBound on the next call"
  - "A confirmed room switch moves the old room's open gates into an abandoned set: readGate and approveDecision for them answer room_switched without reaching the daemon (T-369-32-04)"
  - "A gate answered, or answered as unknown_or_expired_gate, leaves the record; a refused answer leaves it open; a pool reconnect clears every record of that session (the ids died with the old MCP session)"
  - "SEED-106 item 7 weighed: data/command-registry.json as the single action description is not needed (ten task actions in one registry; the 1:1 adapter is generated from the wire snapshot); not built, CONTEXT deferred"
metrics:
  tasks: 2
  commits: 2
  completed: 2026-10-03
---

# Phase 369 Plan 32: The signed-in browser's door to the room Summary

A signed-in browser now reaches the room only through its own legacy MCP session and ten server-composed review-and-decision actions: exposure is enforced by the server (the agent can propose a decision but never approve one), the action route runs the origin guard, the session and the CSRF check before it looks up any action, and the feed, hint and status endpoints serve the bound room with a connection state that says "connected" only after an acknowledged MCP round trip.

## What was built

- **sessions.ts (D-19).** One `createSessionPool` (client name `mindrian-shell`, idle window equal to the 30-minute browser idle), the browser session's `mcpKey` as the pool key (`sessionFor`), a remembered room per browser session with `ensureBound`, `authorizeApi` (origin guard, then `readSession`, then `requireCsrf` for a POST, in that order), `apiJson`, and `sweepSessions` plus a 60 s unref'd timer that forgets expired browser sessions and closes idle MCP sessions. State lives in `globalThis` slots because the chassis bundles routes separately.
- **actions.ts (D-08, D-14, D-15).** `createShellActions({ pool, proposalSource, relay, connection })` registers exactly: listRooms (both), openRoom (human), roomDoc (both), readArtifact (both), feedChanges (human), askClaude (human), proposeDecision (agent), readGate (human), listOpenGates (human), approveDecision (human). fileArtifact, reviseClaim, attachEvidence and publishDeliverable are absent (one comment line names them, D-08 and D-13). Every MCP call goes through the generated wrappers on the browser session's own pool key. `askClaude` runs the ProposalSource and then calls `proposeDecision` through the in-process agent path, which mints the gate with `gate_render` on the BROWSER session's MCP key and records it (gate id, room, mcp key, card). `approveDecision` is the only action that reaches the gate-answer tool and returns the server's answer unchanged. `getShellActions()` is the per-process singleton the routes use; it picks `roomProposalSource` when `MOS_PROPOSAL_SOURCE=adapter`.
- **feed-routes.ts and connection-state.ts (SHELL369-05, D-18).** `/api/feed/changes` (via feedChanges), `/api/feed/hint` (SSE from `createFeedRelay.subscribeHints`, `: connected` opener, a heartbeat comment every 15 s, `Cache-Control: no-store, no-transform`, frames carry only roomId and latestSeq), `/api/feed/room` (the room document as a one-row page plus `checkpoint { epoch, seq: latest_seq }`), `/api/status` (a `contract_version` round trip through the session's own MCP session; connected only on an acknowledgement, `reconnecting` after a failure that followed an acknowledgement, `disconnected` after three failures or with none ever).
- **Routes.** Five route modules under `ui/shell/app/api/`; only the action route contains `invoke(` and it passes `principal: 'human'` itself. No route imports the generated adapter.
- **RoomPicker.tsx.** Lists rooms, opens one, shows the "No room open" and "no rooms" copy with `LAUNCH_COMMAND`, and the one UI-SPEC confirmation ("Leave this decision unanswered?") when `openRoom` answers `gate_open`. Unstyled; plan 20 skins it.

## Verification

| Check | Result |
|-------|--------|
| `cd ui/shell && npm run build` | exit 0 (Turbopack, typecheck clean; nine routes listed) |
| `node tests/test-369-shell-actions.cjs` | PASS=17 FAIL=0 (arms 1, 2, 3, 4, 4b, 4c, 5a-5f, 6, 7, 8, 9, 10), run 4 times |
| `node tests/test-369-shell-server.cjs` | 35 passed, 0 failed (after the one scan exception) |
| `node tests/test-369-walled-manifest.cjs` | 8 passed, 0 failed |
| `node tests/test-369-ts-erasable-gate.cjs` | 8 passed, 0 failed |
| `node tests/test-369-shared-core.cjs`, `test-369-claude-adapter.cjs` | PASS=13, PASS=9 |
| `gen-mcp-adapter.mjs --check` | up to date |
| `git diff --quiet -- package.json npm-shrinkwrap.json` | clean (root manifest untouched) |
| acceptance greps | write-action names: 1 comment line; `createSessionPool` in sessions.ts: 3; generated adapter imported under ui/shell/app: 0 |

Real-HTTP results (arms 6-9, built shell run from a plugin-like tree that reaches only the root node_modules): a POST without the CSRF header is 403, with it 200 and lists the fixture rooms, with `Origin: http://evil.example` 403, with `Sec-Fetch-Site: cross-site` 403, with no cookie 401, an unknown action 404, `proposeDecision` from the browser 403 `human_only`, a body `principal: 'agent'` on `approveDecision` does not change the human principal, an oversize body 413. A second signed-in browser session is not bound to the first one's room and gets 409 `room_unbound` from the feed and hint endpoints. The hint stream delivered `room.changed` (only roomId and latestSeq) 153 to 288 ms after an outside write (child spawn included). Status read `connected` with a fresh `lastAckAt`, an 8-character session prefix, room slug and contract version, then `reconnecting` after the daemon was killed and `disconnected` after more failed round trips; a session that never had an acknowledgement read `disconnected` with `lastAckAt: null`.

### Reconnect measure (bake-off transplant 1, target 315 ms)

Arm 5f: the daemon is restarted (same rooms home), six new claims are written to the room by child processes, then the shell's `feedChanges` is polled every 20 ms until all six are visible, with NO `openRoom` call and no reload. The first call hits the dead MCP session, so the pool closes it, reconnects, re-binds the room and retries.

| Run | Time to all six visible |
|-----|-------------------------|
| 1 | 308 ms |
| 2 | 379 ms |
| 3 | 333 ms |
| 4 | 357 ms |

Median about 345 ms against the 315 ms target: the target was met in none of the later runs and in the first only by 7 ms, so I report it as NOT reliably met, about 10 percent over. Room restoration itself is fixed (6 of 6 visible, where the workroom bake-off build never recovered them); the remaining time is the daemon's cold start. A bare fresh client (connect, `room_bind`, first `room_changes`) against a freshly restarted daemon measured 494, 579 and 591 ms in a scratch probe, so the shell's recovery is at or below the floor of this machine and the 315 ms figure was measured under different conditions. The arm asserts under 2000 ms and prints MET or NOT MET.

## Deviations from Plan

**1. [Rule 3 - Blocking] One narrow exception in `tests/test-369-shell-server.cjs` (not in files_modified).** Bundling the MCP client into the shell pulls in ajv, whose code-generation template string spells `require("ajv-formats/dist/formats")`. Plan 19's bare-import scan flagged it, although it is text for ajv's standalone-validator emitter that the MCP client never runs, and `ajv-formats` is not a root dependency. The acceptance criterion requires that test to stay green, so `KNOWN_TEMPLATE_STRINGS` skips exactly that one specifier, with a comment saying why. Every live arm still passes against the bundle, which exercises the MCP client through the shell.

**2. [Rule 3 - Blocking] Test-time module resolution.** `ui/shell/node_modules/mos-ui-shared` is a COPY of `ui/shared` in this checkout (installed 2026-10-03 11:13), not a link, and Node refuses to strip types for files under `node_modules`. The new test registers a `module.registerHooks` resolver that maps `mos-ui-shared/<name>` to `ui/shared/src/<name>.ts` for the in-process arms, so it works with either install shape. The chassis build is unaffected (it bundles the same files; the copy equals `ui/shared/src` today, `diff -rq` empty).

**3. [Rule 2 - Missing critical] Room restore beyond the pool.** The pool forgets a bound room when its reconnect attempt fails while the daemon is down, so a daemon restart after an outage would have left the session unbound even with the transplant. `sessions.ts` therefore remembers each browser session's room and `ensureBound` re-binds it. Proven by arm 5e (daemon killed, a failing feed call, daemon restarted, the next call returns the room with no `openRoom`).

**4. [Rule 2 - Missing critical] Abandoned gates.** The plan says `openRoom` refuses `gate_open` unless `confirmLeave` is set; it does not say what happens to the old room's gates afterwards. They move to an abandoned set and answer `room_switched` (UI-SPEC refusal copy exists for that state) without reaching the daemon, so a stale tab can never answer a gate in the wrong room (T-369-32-04, arm 5d).

**5. Wording note, not a deviation.** The plan's arm 3 names `human_only` for a browser path calling the agent-only `proposeDecision` as well. Implemented as written; the answer adds `exposure: 'agent'` so the direction is readable.

## Notes for later plans

- `MOS_PROPOSAL_SOURCE` defaults to `fixed` (plan 19) and the shell carries no fixed proposal of its own, so `askClaude` answers `no_proposal` unless the launcher (plan 22) sets `MOS_PROPOSAL_SOURCE=adapter` (the ruled room-proposal path). Worth settling before the end-to-end plans: either the launcher sets it or the config default flips.
- Plan 21 adds the single-use render nonce inside `readGate` and `approveDecision` in `actions.ts`; the exposed `recordedGate(mcpKey, gateId)` and the gate record shape are the seam. The action text never contains the literal gate-answer tool name outside the wrapper call, so a "gate_answer appears only inside approveDecision" static check can hold.
- Before the Phase 289 consume-after-checks fix, a stranger's refused `gate_answer` burns the owner's gate. Arm 5b/5c print the KNOWN line and fall back to a fresh gate; after 289 the same arms ratify the original gate.
- `tests/run-all-369.sh` was not touched (not in files_modified); the new test is not listed there yet.
- Environment: the repo root `node_modules` is currently damaged (no `ajv`, leftover `.ajv-*`, `.accepts-*`, `.node_modules-*` temp directories from an interrupted npm run, directory mtime 2026-10-03 11:44), so any daemon-based test fails to start there ("Cannot find module 'ajv/dist/2020'"). I did not repair it (shared tree, root manifest not mine). All my runs set `NODE_PATH` to the cached root-equivalent tree `os.tmpdir()/mos-369-root-deps-<hash>`, which has ajv. Someone should run a clean `npm ci` at the root.

## Known Stubs

None. `askClaude` under the default `fixed` source answering `no_proposal` is the configured behavior, documented above, not a stub.

## Threat Flags

None beyond the plan's register. T-369-32-01 (CSRF over HTTP, arm 6), -02 (principal from the code path, arm 3), -03 (no adapter route, arms 4 and 10), -04 (gate on the browser key, gate_open and room_switched, arms 5b and 5d), -05 (bound room only, no cookie no page, a second session sees nothing, arms 6 and 7), -06 (room text rendered as React text, static arm), -07 (connected only after an acknowledgement, arms 4b and 9) are mitigated and tested.

## Commits

- `99e25b190` feat(369-32): browser sessions over MCP, the ten review-and-decision actions with exposure enforcement, feed relay and connection state
- `d26efc950` feat(369-32): action, feed and status routes behind the origin guard, session and CSRF; HTTP-proven test
- this SUMMARY (see git log)

## Self-Check: PASSED

All eleven created files and the two modified files exist; both task commits are on `main`; the plan's test, the shell-server test, the walled manifest and the erasable gate are green; the root manifest is untouched.
