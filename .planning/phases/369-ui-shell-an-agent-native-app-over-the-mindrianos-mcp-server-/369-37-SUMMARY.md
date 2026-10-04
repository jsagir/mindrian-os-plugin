---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 37
subsystem: ui-shell-server
tags: [gap-closure, review, security, cr-01, wr-09, wr-11, wr-14, sign-in, sessions, d-08, d-15, d-19]
requires:
  - phase: 369-19
    provides: "origin guard, session cookie, CSRF, the sign-in exchange"
  - phase: 369-32
    provides: "browser sessions over MCP, the feed relay, status"
  - phase: 369-34
    provides: "relay poll change (committed 5cab00eca); its SUMMARY had not landed when this plan ran"
provides:
  - "the sign-in exchange answers only a top-level browser navigation; curl-shaped requests are 403 before the code is read"
  - "GET /auth/start and the control-armed single-use 60 s start slot (no secret in a URL)"
  - "an exclusive 0600 control token file (O_EXCL, symlink refused, no chmod of a foreign directory)"
  - "expiry hooks on read, a hint stream that ends with its session, a room feed that never pairs two rooms"
affects: [369-40, 369-42, 369-47]
tech-stack:
  added: []
  patterns: ["fetch-metadata triple as the browser-navigation proof", "expiry-hook registry shared by the sweep and the read path", "non-refreshing peek for long-lived streams"]
key-files:
  created:
    - ui/shell/app/auth/start/route.ts
    - tests/test-369-feed-guards.cjs
  modified:
    - ui/shell/server/auth.ts
    - ui/shell/server/bootstrap.ts
    - ui/shell/server/control.ts
    - ui/shell/server/sessions.ts
    - ui/shell/server/feed-routes.ts
    - ui/shell/app/api/feed/hint/route.ts
    - ui/shell/client/replica/feed-fetch.ts
    - ui/shell/README.md
    - tests/test-369-shell-server.cjs
    - tests/test-369-human-only.cjs
    - tests/test-369-shell-actions.cjs
    - lib/ui-shell/dist/
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SESSION-CONTRACT.md
key-decisions:
  - "Both exchanges require Sec-Fetch-Site none + Mode navigate + Dest document exactly, checked after the Host/Origin/cross-site guard and before the code or slot is touched"
  - "The start slot is one slot in the bootstrap store (armStart/redeemStart), armed only by POST /control/bootstrap { start: true }; { sha256 } and { start } are mutually exclusive (400)"
  - "The expiry-hook registry moved into auth.ts (sessions.ts re-exports onSessionExpired) so the default session store can run the hooks without a circular import; the remembered room is forgotten through a hook sessions.ts registers once"
  - "store.peek() reads without refreshing lastSeen, so a heartbeat check never keeps an idle session alive"
  - "The stream is not wired to close the pool entry directly (the pool has no per-key drop); ending the relay subscription stops recreation and the pool's idle sweep closes the entry"
requirements-completed: [REV369-01, REV369-08, REV369-10, REV369-13]
duration: ~1h20
completed: 2026-10-04
---

# Phase 369 Plan 37: Navigation-only sign-in, secret-free start, session-bound streams Summary

The shell server now redeems a sign-in only from a real browser navigation, can start a sign-in with no secret in any URL, writes its control token without following planted files or symlinks, ends every stream and gate record with its browser session, and refuses to pair one room's document with another room's checkpoint.

## Commits

- `fa5808890` test(369-37): RED arms for the exchange, start slot, control file, expiry and room pairing. First FAIL line: `FAIL exchange (CR-01): a curl-shaped request (no Origin, no fetch metadata) is 403 before the code is read` (shell-server 8 failing arms, feed-guards 8 failing arms).
- `586d2a27a` feat(369-37): navigation-only sign-in, /auth/start slot, exclusive control token file, amended contract, README, dist.
- `1a284f031` fix(369-37): sessions end their streams and run expiry hooks on read (WR-11); the room feed never pairs two rooms (WR-09), dist.

## What changed

### Task 1 - RED
tests/test-369-shell-server.cjs gained unit arms (curl-shaped and wrong-metadata exchanges, start slot life cycle with an injected clock, both/neither body 400, control file replace/symlink/foreign directory) and two live arms over real HTTP against the built shell. tests/test-369-feed-guards.cjs (new, 11 arms: 4 for WR-11, 6 for WR-09 incl. 9c as the consistent-room control, plus a dash guard) loads the server modules and the browser fetcher as erasable TypeScript through the registerHooks resolver.

### Task 2 - sign-in, start slot, control file
- `auth.ts`: `isBrowserNavigation`; `handleBootstrapRequest` and the new `handleStartRequest` return 403 before the code or slot is read unless the three-header triple is exact.
- `bootstrap.ts`: `armStart(ttl=60000)` / `redeemStart()`, one slot, single use, injectable clock.
- `control.ts`: `{ start: true }` or `{ sha256 }`, exactly one; `writeControlToken` lstat-refuses symlinks and directories, unlinks a regular file, creates with `wx` and 0600, chmods only a directory it created.
- `app/auth/start/route.ts`: thin adapter.
- Test drivers that sign in over raw HTTP now send the browser triple (one constant each in test-369-human-only.cjs and test-369-shell-actions.cjs).

### Task 3 - streams and rooms
- `auth.ts`: the expiry-hook registry (`onSessionExpired`, `runExpiryHooks`), `createSessionStore({ onExpire })`, `peek()`; `read()` runs the hooks on an expired session; the default store is wired to the registry. `sessions.ts` re-exports `onSessionExpired`, registers the remembered-room hook once and the timer sweep now calls `runExpiryHooks`.
- `feed-routes.ts`: `openHintStream` takes `sessions` and `sessionId`, peeks every heartbeat, ends and unsubscribes on a dead session; `handleFeedRoom` answers `room_switched` (409) when the head's room differs; the hint route passes the store and session id.
- `feed-fetch.ts`: `room` required (throws without it); `wrongRoom` is `page.room !== options.room`, so a null room is wrong. ReplicaProvider already passes the room and already retries on a non-200 room read, so it needed no change and is not in the commits.

## The exchange contract for plans 40 and 42

(Also recorded in 369-SESSION-CONTRACT.md section 3, "Amendment 2026-10-04".)

1. `GET /auth/bootstrap?code=...` and `GET /auth/start` answer only `Sec-Fetch-Site: none` + `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document`, on loopback Host, with no foreign Origin. Anything else is 403 `Forbidden` before the code or slot is touched; a refusal burns nothing. A real browser (typed address, followed link, `xdg-open`/`open`, Playwright `page.goto`) sends the triple; raw-HTTP test drivers must send it explicitly.
2. Start: `POST /control/bootstrap` with `x-mos-control-token` (no Origin, no Sec-Fetch-Site) and body `{ "start": true }` returns `{ "ok": true, "expires_in_ms": 60000 }` and arms the slot. `{ "sha256": ... }` still arms a one-time code. Both together or `start` not `true` is 400. Then the launcher opens `http://127.0.0.1:<port>/auth/start`: 303 to `/` with the cookie once; afterwards, nothing armed, expired (60 s) or a repeat visit shows the Not signed in page (401).
3. Plan 40 (launcher): print the `/auth/bootstrap?code=` link only on a real terminal; otherwise arm the start slot and open `/auth/start` (no code in argv or stdout). Plan 42: use `page.goto('/auth/start')` after arming, or the bootstrap link; `page.goto` supplies the triple.
4. Control token file: any launcher or test that points `MOS_SHELL_CONTROL_TOKEN_FILE` at a path must not pre-create a symlink there; a regular file there is replaced (new inode).

Residual risk (stated, not closed): a same-user process that forges the three navigation headers inside the 60-second window can still sign in. That is the CR-02 class; plan 369-47 records it as a navigator item.

## Verification

All green after the final commit (`node scripts/build-ui-shell.cjs --check` exit 0, source hash 6f4d97ee5764197c):

| Suite | Result |
|-------|--------|
| tests/test-369-feed-guards.cjs | PASS=11 FAIL=0 |
| tests/test-369-shell-server.cjs | 43 passed, 0 failed (incl. live curl-shaped refusal, browser-shaped start) |
| tests/test-369-human-only.cjs | PASS=10 (HTTP arm 8 "over real HTTP") |
| tests/test-369-shell-actions.cjs | PASS=17 |
| tests/test-369-shared-core.cjs | PASS=15 |
| tests/test-369-session-indicator.cjs | 11/11 |
| tests/e2e-369/replica.cjs | all 12 arms |
| tests/e2e-369/views.cjs | all 12 arms |
| tests/e2e-369/gate-button.cjs | all 15 arms |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route list static arm in tests/test-369-shell-actions.cjs**
- **Found during:** Task 2
- **Issue:** arm 4 enumerates every `route.ts` under ui/shell/app; the new `auth/start/route.ts` made it fail. The plan said only the NONE constant changes in that file.
- **Fix:** added `'auth/start/route.ts'` to the expected list (one token). The NONE constant change and this list entry are the only edits.
- **Commit:** 586d2a27a

**2. [Rule 1 - Test bug] Two existing arms in tests/test-369-shell-server.cjs**
- The "missing code" exchange arm sent only a Host header and now (correctly) gets 403; it now sends the browser triple. The control-file inode arm could not distinguish a replaced file from a reused inode number after unlink; it now holds a hard link to the planted file so a write into it would show through. Both edits ride in 586d2a27a (the RED commit carried the original forms).

**3. [Scope note] Expiry-hook registry moved to auth.ts**
- The plan named auth.ts for the read-path hook; the registry previously lived in sessions.ts, which imports auth.ts. To avoid a circular import it moved to auth.ts and sessions.ts re-exports `onSessionExpired` (callers in actions.ts unchanged).

### Deferred (out of scope)

- tests/test-369-launch-surface.cjs arm 6b fails on `test-267-mcpv2-registration-api.cjs` ("... as a non-empty title (48 tools checked)"), an MCP tool-registration check in lib/mcp that none of this plan's files touch. Not investigated, not fixed. Everything else in that suite passes (PASS=70 FAIL=1).
- A peer's `tests/e2e-369/journey.cjs --soak-restart` process (pid 1579592) was running during verification; it was left alone.

## Parallel-tree notes

- 369-34's code (5cab00eca) was committed and `git status` for ui/shell, ui/shared, lib/ui-shell/dist and tests/e2e-369 was clean before each rebuild. 369-34-SUMMARY.md had not landed when I finished; I polled for it for part of the run and proceeded on the clean tree because feed-fetch.ts and ReplicaProvider.tsx carried no in-flight diff and my change does not depend on the relay-poll change.
- No STATE.md, ROADMAP.md, lib/ui-shell/launch.cjs, commands/* or 369.1-owned file was touched. No `git stash`/reset/clean was run by this plan.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: `/auth/start` is the one new network entry and is covered by T-369-37-02.

## Self-Check: PASSED

Created files exist (ui/shell/app/auth/start/route.ts, tests/test-369-feed-guards.cjs); commits fa5808890, 586d2a27a and 1a284f031 are on main; `build-ui-shell.cjs --check` exits 0.
