---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - lib/ui-shell/launch.cjs
  - scripts/build-ui-shell.cjs
  - lib/mcp/gate-ledger.cjs
  - lib/mcp/tools/gate.cjs
  - lib/mcp/tools/feed.cjs
  - lib/mcp/tools/room.cjs
  - lib/mcp/tools/artifact-read.cjs
  - lib/mcp/daemon-lifecycle.cjs
  - lib/mcp/room-watcher.cjs
  - lib/mcp/sse-event-bus.cjs
  - lib/core/navigation.cjs
  - lib/core/navigation/room-projection.cjs
  - lib/core/navigation/room-change-log.cjs
  - lib/core/room-db.cjs
  - ui/shell/server/actions.ts
  - ui/shell/server/human-origin.ts
  - ui/shell/server/feed-routes.ts
  - ui/shell/client/api.ts
  - ui/shell/client/replica/ReplicaProvider.tsx
  - ui/shell/client/replica/feed-fetch.ts
  - ui/shared/src/replica.ts
  - ui/shared/src/feed-relay.ts
  - ui/shared/src/projection.ts
  - ui/shell/next.config.ts
findings:
  critical: 2
  warning: 19
  info: 11
  total: 32
status: issues_found
---

# Phase 369: Code Review Report

**Reviewed:** 2026-10-04
**Depth:** standard (plus read-only probes against scratch rooms and the committed dist)
**Files Reviewed:** 24 (listed above), plus the files they call that the findings cite: ui/shell/server/auth.ts, bootstrap.ts, control.ts, sessions.ts, config.ts, origin-guard.ts, csp.ts, proxy.ts, the /api and /control routes, lib/core/strategy/goal-gate.cjs, lib/hmi/jtbd-state.cjs, lib/mcp/gate-render.cjs, commands/dashboard.md
**Status:** issues_found

## Summary

The shell-side human proof is carefully built. The origin guard, session cookie, CSRF header, single-use render nonce with check-then-reserve, the pre-consume refusals and the durable-after-COMMIT release in gate_answer all read correctly, and the wrong-room guard in the fetcher works for the normal case. The weaknesses are at the edges the brief asked about, and two of them defeat the headline invariant "only a person approves":

1. The one-time sign-in link is a bearer credential that the launcher prints into the output of a command the model runs, and, with `--open`, into the argv of a child process. Whoever redeems it gets a session, can read a gate (nonce) and approve it.
2. The MCP `gate_answer` tool itself has no human principal. The nonce guards only the shell's own door; any MCP session can mint and answer its own gate and the approve is attributed to the navigator.

Beyond those: one non-SQL write (the strategy goal file) happens inside the ratification transaction; a committed answer can be reported back as `gate_expired` at the TTL boundary; the verdict-chosen coherence from 289 never applies to shell gates; the feed accepts a checkpoint from the future and has a compaction race; `handleFeedRoom` can mix two rooms; the launcher's identity check is a substring match that I reproduced killing-eligible for an unrelated process; the build script's gate verifies source freshness only.

Verified by running (read-only, scratch dirs only): ledger overwrite and boundary-expiry behaviour, `readChanges` with `after` beyond the log, `isOurShell` against an unrelated process, `room_search` following a symlink out of a room, `node scripts/build-ui-shell.cjs --check` (fresh). No source file was modified.

## Critical Issues

### CR-01: The one-time sign-in link is delivered to the agent and to argv, so a non-human can obtain a session and approve

**File:** `lib/ui-shell/launch.cjs:345-349` (also `commands/dashboard.md:116-122`, `ui/shell/server/auth.ts:178-205`)
**Issue:** `start` writes `http://127.0.0.1:<port>/auth/bootstrap?code=<256-bit code>` to stdout. `commands/dashboard.md` runs it as `!node ".../launch.cjs" start` and tells the model to "give the link to the person exactly as printed", so the credential is placed in the model's context. Redeeming it needs nothing a browser has: `handleBootstrapRequest` runs `checkRequest`, which passes when `Origin` and `Sec-Fetch-Site` are simply absent (`origin-guard.ts:156-173`), so `curl` or any fetch tool from the same machine gets `303` plus `Set-Cookie: mos_shell_sid`. From there the chain is all HTTP: GET `/` for the CSRF meta tag, POST `/api/actions/askClaude` (or `openRoom`), POST `readGate` (issues the render nonce), POST `approveDecision` with that nonce. Every control in the nonce design (`human-origin.ts`) is satisfied by a non-human holding a valid session, because the nonce proves "this session rendered the gate", not "a person clicked". Second leak: `--open` calls `openBrowser(link)`, which does `spawn('xdg-open' | 'open' | 'cmd /c start', [url])` (`lib/core/platform.cjs:230-241`), so the code sits in a process argument list for the life of that process. That contradicts the header comment at `launch.cjs:21-23` ("The code itself never appears in a process argument list") and lets another local user who can read `/proc/*/cmdline` or `ps` race the 60-second code.
**Failure scenario:** The person runs `/mos:dashboard shell`. The link is in the transcript. The model (or a prompt-injected tool result) runs `curl -si '<link>'` inside the 60 seconds, keeps the cookie, files a proposed claim, calls `askClaude`, `readGate`, `approveDecision` and the claim is confirmed "by navigator" with no person involved.
**Fix:**
```js
// launch.cjs: never put the credential in a channel the agent reads.
const link = linkFor(port, code);
if (flags.open || !process.stdout.isTTY) {
  openBrowserWithoutArgv(link);          // see below
  process.stdout.write('Opened the workspace in your browser.\n');
} else {
  process.stdout.write(link + '\n' + LINK_NOTE + '\n');   // a real terminal only
}
```
- Hand the code to the browser without argv: have the shell serve `GET /auth/start` (no secret) that the launcher opens, and let the launcher POST the code to the control endpoint bound to that start nonce, or write a 0600 one-shot redirect page and open that file path.
- In `handleBootstrapRequest`, for the code exchange require browser navigation metadata, not mere absence of cross-site: `sec-fetch-site === 'none'`, `sec-fetch-mode === 'navigate'`, `sec-fetch-dest === 'document'`. `curl` and fetch tools send none of these. This is a speed bump, not a proof (a determined agent can forge headers); the real fix is not to hand the agent the code.
- Update the `dashboard.md` instruction so the model is never asked to relay a credential.

### CR-02: MCP `gate_answer` has no human principal, so any MCP session can ratify its own gate with the navigator's name

**File:** `lib/mcp/tools/gate.cjs:802-1027` (and `lib/mcp/gate-ledger.cjs:65-68, 119-130`, `lib/core/navigation/confirm-node.cjs:72-89`)
**Issue:** The 369 invariant is enforced only inside the shell (`actions.ts`, nonce, cookie). The tool the shell calls is a plain MCP tool. `gate_render` mints a gate for the caller's session and `gate_answer` ratifies it for the same session with no proof a person acted. On approve it calls `confirmNode(..., navigation.resolveByUser(roomDir), ...)`, and `resolveByUser` returns the room's navigator identity (or the default `navigator`) for every caller. Stateless 2026-era requests (served by `modernMcpHandler`, `bin/mindrian-mcp-server.cjs:451-460`) carry no session id, so they all resolve to the one `no-session:<daemon pid>` ledger key and can even answer each other's gates. The skills in this repo (`commands/eureka.md:221`, `skills/scientific-roadmap/SKILL.md:185`) instruct the model to call `gate_answer` itself on Desktop and Cowork.
**Failure scenario:** A model turn calls `gate_render({subject_node_id: <claim>, options:[approve,reject]})` then `gate_answer({gate_id, chosen:['approve'], verdict:'approve'})`. The proposed claim becomes `confirmed`, `confirmed_by` = the navigator, with no person involved, in a room whose shell shows "Confirmed by you". The shell's nonce never enters the picture.
**Fix:** This is inherited from Phases 198/289 but Phase 369 makes "only a person approves" load-bearing and does not close it. Close it at the server: have the daemon expose the human door on a channel an MCP client cannot call (a loopback HTTP route authenticated by the shell's control token, which the shell calls instead of the MCP tool), or make `gate_answer` verdicts that confirm a truth claim require an `origin: 'human_shell'` marker that only that route can set. At minimum record `answered_via` (mcp-session vs shell route) on the decision node and stop `resolveByUser` attribution for the MCP-session path (attribute to the session's client name, not the navigator).

## Warnings

### WR-01: The strategy goal file write sits inside the ratification transaction and is not undone by a rollback

**File:** `lib/mcp/tools/gate.cjs:683-692` (calls `lib/core/strategy/goal-gate.cjs:192` -> `lib/hmi/jtbd-state.cjs:359-369`)
**Issue:** `_applyRatification` runs inside `navigation.withRoomTx`. For a strategy card it calls `goalGate.ratifyGoalProposal`, which calls `jtbdState.setGoal`, an atomic JSON file write (`writeStateAtomic`) bumping `goal_version` and appending `goal_history`. The `_softStep` SAVEPOINT rolls back SQL only. If anything after it throws, or `UPDATE room_tx_context SET tx = NULL` or `COMMIT` fails (`room-change-log.cjs:198-199`), `withRoomTx` rolls back, `gate_answer` answers `persistence_failed` "nothing was written ... the same gate can be answered again", and the goal file has already changed. The retry bumps `goal_version` again and duplicates the history row.
**Fix:** Return the goal payload from `_applyRatification` and do the file write after COMMIT and release (like the chain resume), recording the outcome on the response. Make `setGoal` idempotent per `decisionNodeId`.

### WR-02: A committed answer can be reported as `gate_expired` with "nothing was written"

**File:** `lib/mcp/gate-ledger.cjs:119-130, 168-181`; `lib/mcp/tools/gate.cjs:488-496, 818-835, 984`
**Issue:** `gate_answer` peeks (TTL ok), runs the transaction, then calls `releaseGate`, which is `consumeGate` and re-checks TTL. The window between peek and release includes `BEGIN IMMEDIATE`, which can busy-wait up to the 5 s `timeout` in `room-db.cjs:275`. If the 30 minutes run out in that window, release returns `null`, calls `_noteExpired(gateId)` and the ratification stays committed. The caller still gets `ok: true` this time, but any retry (the shell's `confirmOnce` does exactly that) reaches `_answerWithoutLiveGate`, which checks `isGateExpired` first and answers `gate_expired` "so nothing was written", never looking at the durable anchor. The shell then drops its gate record (`DROPS_THE_GATE`) and shows an expired gate that was in fact approved. Reproduced with the ledger directly: after `backdate`, `releaseGate` returned `null` and `isGateExpired` returned `true`.
**Fix:** In `_answerWithoutLiveGate` look up the anchor first; only report `gate_expired` when no anchor exists. Also let `releaseGate` after a successful commit succeed for an entry that was live at peek (take the TTL decision once, at peek).

### WR-03: Verdict-chosen coherence (289) never applies to shell gates

**File:** `lib/mcp/tools/gate.cjs:860-863`; `lib/mcp/gate-render.cjs:528-535`; `ui/shell/server/actions.ts:464-509`
**Issue:** `checkVerdictAgainstApproving` only checks entries that carry an `approving` array. `gate_render` has no input that sets it and `_mintLiveGate` never passes one, so for every gate the shell mints the check returns `null`. `approveDecision` also does not relate `verdict` to `chosen` (it only bounds `chosen` to 1-6 strings). The server will therefore accept `verdict: 'approve'` with `chosen: ['reject']`, ratify it, write a confirmed decision node and confirm the subject claim. The only thing tying the two together is the page's own code (`verdictForSelection`).
**Failure scenario:** A UI mapping bug, a stale tab, or a script in the page sends approve with the Hold option id; the claim is confirmed although the person chose Hold.
**Fix:** In `approveDecision`, recompute the verdict from the recorded card: require `verdict === 'approve'` only when `chosen` is exactly the card's approve option id, and refuse `verdict_chosen_mismatch` otherwise. Better, add an `approving` input to `gate_render` (ids only) and mint it from `proposeDecision`.

### WR-04: The stale-subject check runs outside the write transaction and covers only the subject

**File:** `lib/mcp/tools/gate.cjs:928-936` vs `969-971`
**Issue:** `_subjectChangedSinceMint` opens its own read-only handle, compares and closes it. The write transaction opens afterwards. A hook or script that updates the subject between the check and `BEGIN IMMEDIATE` (a normal event; the PostToolUse graph indexers write to room.db) lets the approve confirm a claim that changed after the person looked at it. The evidence nodes the card cites (`evidence_node_ids`) are never compared at all, so a swapped evidence node does not trip it. Also `subjectRevision` is `0` when the feed was absent at mint (`readEntityRevision`), after which any later feed row reads as "changed", a false `stale_subject`.
**Fix:** Run `readEntityRevision` for the subject (and the evidence ids) on the same `db` inside `withRoomTx` before the first write and throw a typed error mapped to `stale_subject`; treat a null/absent feed at mint as "unknown" rather than 0.

### WR-05: `mintGate` overwrites a live gate; callers choose gate ids; the ledger never purges

**File:** `lib/mcp/gate-ledger.cjs:82-90`; `lib/mcp/tools/gate.cjs:711, 780-782`
**Issue:** `gate_render` takes an optional caller-chosen `gate_id`, and `mintGate` does `_ledger.set(gateId, stored)` unconditionally. A second session that learns a live gate id re-mints it under its own session key: the owner's next `gate_answer` then reads `session_mismatch` (reproduced: `{"ok":false,"reason":"session_mismatch"}`) and the attacker holds the gate. Also re-minting an id that was already answered creates a second live gate with the same `decision:gate:<id>` anchor. Separately, expired entries are only cleared lazily on `consumeGate`; 5,000 mints left 5,001 entries. A model looping `gate_render` grows the daemon's memory without bound (each entry keeps its card and any chain closure).
**Fix:** `mintGate` must refuse (return false) when a live, unexpired entry exists for that id under any session key; reject caller-chosen ids that match an anchor in the room, or drop the `gate_id` input and always mint server-side. Add a sweep (on mint, drop entries older than the TTL) and a per-session cap.

### WR-06: A transient replay-lookup failure is reported as `unknown_gate`, and the shell deletes its record of a gate that was saved

**File:** `lib/mcp/tools/gate.cjs:497-533`; `ui/shell/server/actions.ts:54, 494`; `lib/core/navigation/room-projection.cjs:244-270`
**Issue:** `_answerWithoutLiveGate` wraps the anchor read in `catch (_e) { anchor = null; }` and falls through to `unknown_gate` ("no saved answer for it was found"). The read can fail for reasons unrelated to absence: no room resolved for the session (unbound after a daemon restart), the read-only open returning `null`, or `json_extract` raising on one malformed `properties` value in any memory_event row (it aborts the whole query). The shell treats `unknown_gate` as final (`DROPS_THE_GATE`), deletes the gate and shows "no gate", in exactly the lost-response case 369-26 exists to recover.
**Fix:** Return a distinct retryable reason (`replay_lookup_failed`) when the room could not be read or the query threw; keep it out of `DROPS_THE_GATE`. Guard the query with `json_valid(properties)`.

### WR-07: The feed accepts a checkpoint beyond the log, so a rolled-back room.db looks current

**File:** `lib/mcp/tools/feed.cjs:124-135`; `lib/core/navigation/room-projection.cjs:300-319`
**Issue:** Only `after < floor` is refused. If `after > latest_seq` (room.db restored from a backup, a synced folder replaced the file, a copy swapped back) with the same epoch, the answer is `ok: true`, no changes, `through = after`. Probed: with `latest_seq: 3`, `readChanges(after: 5000)` returned `{"changes":[],"from":5000,"through":5000,"latest_seq":3,"has_more":false}`. The replica stores `{epoch, seq: 5000}` as current and then never sees changes 4..5000.
**Fix:** In `feed.handle`, `if (after > latest) return checkpoint_expired` (same shape as the floor case); also reset the epoch when `installChangeLog` finds `MAX(change_seq)` below the stored high-water mark.

### WR-08: Meta and rows are read without a single read transaction, so a concurrent compaction can drop rows silently

**File:** `lib/mcp/tools/feed.cjs:100-136`; `lib/core/navigation/room-projection.cjs:300-381`; `lib/core/navigation/room-change-log.cjs:264-296`
**Issue:** `readChangeLogMeta` (four statements) and `readChanges` (four more) run on a read-only handle with no transaction. `compactChangeLog` runs in a writer on its own schedule (inside `installChangeLog` on any write-door open). If it commits between the floor read and the row read, `after >= floor_old` passes, the rows between `after` and the new floor are gone, the page returns the remaining rows and `through` advances: a silent gap in the browser copy that is then marked current. The code comment "No read transaction spans MCP calls" is true but the transaction is needed within one call.
**Fix:** Wrap meta plus rows in `BEGIN` / `COMMIT` on the read-only handle (a deferred read transaction is legal under `mode=ro` in WAL), or re-read the floor after reading rows and return `checkpoint_expired` if it moved above `after`.

### WR-09: `handleFeedRoom` can pair room A's document with room B's checkpoint, and the wrong-room guard is fail-open

**File:** `ui/shell/server/feed-routes.ts:96-130`; `ui/shell/client/replica/feed-fetch.ts:76-78`
**Issue:** `handleFeedRoom` calls `roomDoc` (slug A), then `feedChanges` for the head (whichever room is bound now), and builds the answer with `room: room.slug` from the first call and `epoch`/`seq` from the second. If another tab on the same browser session runs `openRoom` between the two awaits, the body says room A with room B's epoch and head. `head.room` is never compared. Separately `wrongRoom` only refuses when `page.room` is a string that differs; a page with `room: null` (feed.cjs sets `room: room.slug` and `slug` can be null, `feed.cjs:68-70`) or `options.room` unset passes straight through.
**Fix:** In `handleFeedRoom` refuse with `room_switched` unless `head.room === room.slug`. In `wrongRoom` return true for any page whose `room` is not exactly `options.room` when `options.room` is set, and make `room` required in the fetcher options.

### WR-10: The relay's safety-net poll ignores an epoch or sequence reset

**File:** `ui/shared/src/feed-relay.ts:384-399`; `lib/mcp/room-watcher.cjs:178-182`
**Issue:** `pollOnce` emits only when `latest > lastSeq`. After a rebuild or epoch change the log's sequence can restart lower; `lastSeq` (set from the old head) stays high, so no poll hint is emitted until the new sequence overtakes the old number. The watcher side tracks `seq < entry.seq` "quietly" and relies on the shell's poll to learn about it, which cannot. Combined with the hint-driven replica (it pulls only on a hint, `replica.ts:231`), the copy can sit stale after a reset.
**Fix:** Emit when `latest !== lastSeq`, and carry the epoch in the poll answer so an epoch change always emits.

### WR-11: The hint stream outlives the browser session and keeps recreating an MCP session for an expired key

**File:** `ui/shell/server/feed-routes.ts:153-225`; `ui/shell/server/auth.ts:60-71`; `ui/shared/src/feed-relay.ts:402-404`
**Issue:** Authorization is checked once when the SSE stream opens. When the session idles out, `sweepSessions` runs the expire hooks, but the stream and its relay (2 s `room_changes` poll plus a daemon `/event` connection) are never closed. Each poll calls `pool.call(sessionKey, ...)` with the dead key, so the pool opens a fresh unbound MCP session for it every sweep. Also `read()` deletes an expired session without returning its `mcpKey`, so a session found expired by a request (inside the 60 s before the sweep) never reaches the `onExpired` hooks (gate records, `answered`, nonces, remembered room, connection state leak).
**Fix:** Pass the session store into `openHintStream` and end the stream when `store.read(...)` no longer returns the session (check on each heartbeat). Make `read()` return/emit the expired key.

### WR-12: `isOurShell` accepts any process whose command line merely contains the entry path

**File:** `lib/ui-shell/launch.cjs:139-150, 296-306`
**Issue:** `cmd.indexOf(rec.serverEntry) !== -1` is a substring test over the whole joined command line. Reproduced: a process started as `node -e ... /home/someone/dist/server/server.js` is reported as ours. After the real shell exits, a recycled pid belonging to an editor, `tail -f` or `grep` on that file passes, and `stopShell` sends it SIGTERM then SIGKILL.
**Fix:** Match structurally: read `/proc/<pid>/cmdline` as NUL-separated argv and require `argv[0]` to be a node binary and `argv[1] === rec.serverEntry` (or the `next-server (v...)` title plus a cwd match as now). Also record the process start time in `shell.json` and compare it, which survives pid reuse.

### WR-13: The spawned server inherits the launcher's whole environment

**File:** `lib/ui-shell/launch.cjs:254-267`
**Issue:** The launcher runs inside a Claude Code or hook environment. `Object.assign({}, process.env)` passes everything (API keys, Brain keys, cloud credentials, `CLAUDE_CODE_OAUTH_TOKEN`, `NODE_OPTIONS`) to a long-lived detached server that never needs them; only `CLAUDE_CODE_SESSION_ID` is removed. The shell is meant to touch only loopback (Canon Part 8), so every extra secret in its environment is exposure with no purpose (readable from `/proc/<pid>/environ` by the same user, inherited by anything it ever spawns). The same applies to the daemon env in `daemon-lifecycle.cjs:297`.
**Fix:** Build the env from an allowlist: `PATH`, `HOME`, `USER`, `LANG`, `TMPDIR`, `NODE_*` you actually need, plus the `MOS_*` values.

### WR-14: Control-token file creation follows symlinks and widens permissions briefly; the launcher never checks the owner

**File:** `ui/shell/server/control.ts:25-33`; `lib/ui-shell/launch.cjs:228-242`
**Issue:** `writeFileSync(file, token, { mode: 0o600 })` ignores `mode` when the file exists, so the token is written into a pre-existing 0644 file (or through a symlink at that path) and only then `chmodSync`ed. `chmodSync(dir, 0o700)` is applied to whatever directory `MOS_SHELL_CONTROL_TOKEN_FILE` names, including a shared one. `readControlToken` checks the mode bits but not `st.uid === process.getuid()`, so a 0600 file owned by someone else at the configured path is trusted.
**Fix:** `unlinkSync` first, then open with `fs.openSync(file, 'wx', 0o600)`; only chmod a directory this process created; reject a token file whose `uid` is not the current user and a symlink (`lstatSync`).

### WR-15: `ensureDaemon` does not replace an unhealthy daemon, contrary to its comment

**File:** `lib/mcp/daemon-lifecycle.cjs:275-321`
**Issue:** When the recorded pid is alive but its port does not answer, the comment says it reaps before spawning, but `reapStale` only removes records whose pid is dead. It then spawns a second daemon, and the poll immediately reads the same (old) pidfile with a live pid and returns the old, dead-port record. The new daemon calls `discoverPort()`, which returns the old live pid's port, fails to bind and exits 1. The launcher then reports "MindrianOS is not answering" every time until the wedged daemon is killed by hand.
**Fix:** In the unhealthy-but-alive branch, signal the recorded pid (after an identity check as in WR-12) or choose a fresh port and wait for a pidfile whose `updated` is newer than the spawn time.

### WR-16: The freshness gate checks sources only; the committed dist bytes and the build inputs are unchecked

**File:** `scripts/build-ui-shell.cjs:141-148, 396-431`
**Issue:** `--check` compares `manifest.sourceHash` to a hash of `ui/shell` and `ui/shared` and confirms `serverEntry` exists and there is no `node_modules`. It never re-runs `verifyOutput` (hosts, bare imports, build-machine paths, GPL names), so a dist file edited by hand after the build, or a partially stale dist, passes the release step as long as the manifest is untouched. The hash also omits the root `package.json` and `npm-shrinkwrap.json` (the pinned `next`/`react` the dist runs against) and says nothing about what was in `ui/shell/node_modules` when it was built (`npm install` instead of `npm ci`, a patched package). Bumping the root `next` pin leaves a "fresh" dist built with the old one.
**Fix:** Add a content hash of every dist file to the manifest and verify it in `check()`; call `verifyOutput` from `check()`; include the root `package.json` dependency block and `npm-shrinkwrap.json` in the source hash; record the hash of `ui/shell/node_modules/.package-lock.json` at build time and compare it to `package-lock.json`.

### WR-17: `BUILD_UI_SHELL_DIST` is honoured by the build, which then `rmSync`s that path

**File:** `scripts/build-ui-shell.cjs:54, 360, 376`
**Issue:** The "test seam for --check" is read for every command. `build()` runs `fs.rmSync(DIST_DIR, { recursive: true, force: true })` on it, and again on a failed verification. A stray `BUILD_UI_SHELL_DIST=$HOME` in a maintainer shell deletes it.
**Fix:** Only honour the variable in `check()`, or refuse to remove a directory whose real path does not end in `lib/ui-shell/dist`.

### WR-18: The egress and path checks are narrower than their documented claims

**File:** `scripts/build-ui-shell.cjs:65-80, 209-232, 284-327`
**Issue:** (a) The header says "no file names an outside host"; `FORBIDDEN_HOSTS` is six names. The committed dist names `nextjs.org` (186 matches), `github.com`, `raw.githubusercontent.com`, `tinyurl.com`, `bit.ly`, `react.dev` and others (inert text and schema ids, so the runtime CSP `connect-src 'self'` is the real control), but the build would not notice a new fetch to any other host. (b) `foreignSpecifiers` exempts any specifier whose first segment is a Node built-in (`builtins.has(name)`) and skips any specifier ending in `/` (`209-211`), which together exempt the userland-package forms `require("buffer/")`, `require("events/")`, `require("punycode/")` that resolve to npm packages absent from the dist. (c) The path scrub and check cover `/home/`, `/Users/` and the repo root only; a build under `/root/`, `/opt/`, `/runner/`, `/__w/` or `C:\` passes, and `path.dirname(REPO_ROOT)` is computed in `roots` but never used (`slice(0, 2)`).
**Fix:** Replace the host list with a positive scan: extract every `https?://host` in the dist and fail unless the host is in a reviewed inert allowlist. Treat `builtin + "/"` as foreign. Check for any absolute path prefix (`/^\/(?:root|opt|var|srv|mnt|runner|__w|tmp)\//` and drive letters).

### WR-19: `room_search` reads files through symlinks that leave the room

**File:** `lib/mcp/tools/room.cjs:246-258`
**Issue:** The walk skips symlinked directories (Dirent) but opens symlinked files: `notes/link.md -> /elsewhere/secret.txt` is read with `readFileSync(full)` and matching lines are returned as snippets. Reproduced in a scratch room: a symlink named `link.md` returned `"TOPSECRET-outside-the-room line"` from a file outside the room. `room_artifact` is protected by `isRealpathContained`; `room_search` has no containment. A shared or cloned room with a hostile symlink turns the model's `room_search` into a local-file reader.
**Fix:** Skip `e.isSymbolicLink()` entries, or run `isRealpathContained(roomRoot, full)` before the read, as `artifact-read.cjs:278` does.

## Info

### IN-01: A second `readGate` replaces the first tab's nonce

**File:** `ui/shell/server/human-origin.ts:75-93`
**Issue:** `issue()` drops an existing `issued` record for the same (session, gate) and mints a new nonce, and also replaces a `used` record. Two tabs (or the `confirmOnce` re-read) invalidate each other's nonce; the first click answers `human_only: nonce_mismatch` and the page re-reads and needs a second click. A `used` record being replaced also weakens "terminal" in the module header (harmless today because `readGate` returns `answered` without issuing).
**Fix:** Return the existing `issued` nonce on re-issue instead of replacing it; never replace `used`.

### IN-02: The gate and answer maps live only in the shell process

**File:** `ui/shell/server/actions.ts:162-166`
**Issue:** A shell restart loses every gate record while the daemon ledger still holds the gates for up to 30 minutes under the dead session key. They cannot be answered by anyone (`session_mismatch`) and are not listed. Acceptable, but the person gets no "your open decisions were closed by a restart" signal; `listOpenGates` simply shrinks.
**Fix:** Persist nothing, but say so: return `{ reason: 'shell_restarted' }` from `readGate` for an id the session's pool key never held.

### IN-03: Tool and shell input caps disagree, and `-32602` is reported as "feed unavailable"

**File:** `lib/mcp/tools/feed.cjs:152-156`; `ui/shell/server/actions.ts:321-326`; `ui/shared/src/feed-relay.ts:291, 319`
**Issue:** The tool caps `epoch` at 64 and `snapshot_cursor` at 512; the shell action allows 200 and 2000. A snapshot cursor is base64url of `{as_of_seq, last_key}`; an edge key of two artifact paths of about 80 characters each already encodes to about 540 characters (computed), so page 2 of the `relations` snapshot fails schema validation. `FEED_TOOL_MISSING_RE` includes `-32602` and `not found`, so the validation failure becomes `feed_unavailable`, which the client retries forever. In the user's own rooms the longest edge key is 421 characters (room `formation`, 30 edges, one page, so it does not trigger today), and none of the large rooms exceed 176.
**Fix:** Raise the tool caps to match (or shrink the cursor by hashing the key), and match the tool-missing regex on `-32601` and `unknown tool` only.

### IN-04: Replica primary-key `maxLength: 200` is below real node and edge ids

**File:** `ui/shared/src/projection.ts:69`
**Issue:** Real ids exceed it: room `formation` has node ids up to 213 characters and edge keys up to 421. RxDB's memory storage accepted a 421-character id in a probe; I did not verify the Dexie storage the shell uses, whose index keys are padded to `maxLength`.
**Fix:** Verify under Dexie; raise `maxLength` to the largest id the server can emit, or hash long ids.

### IN-05: Snapshot cursors carry neither epoch nor room

**File:** `lib/core/navigation/room-projection.cjs:385-461`; `lib/mcp/tools/feed.cjs:106-112`
**Issue:** A cursor issued in one room or epoch is honoured by any later call, and the page reports the current epoch with the old `as_of_seq`. The client-side guards (`wrongRoom`, the final-page epoch comparison in `feed-fetch.ts:120`) catch it only when `options.epoch !== null`. A server-side check costs two fields.
**Fix:** Put `{epoch, room}` in the cursor and answer `epoch_changed` / `room_switched` when they differ.

### IN-06: Node and edge key changes leave a ghost in the replica

**File:** `lib/core/navigation/room-change-log.cjs:86-91`
**Issue:** The AFTER UPDATE triggers log only `NEW.id` / the NEW edge key. A writer that renames a node id or edits an edge's source/type/target never emits a delete for the old key, so the browser copy keeps the old document until a reset.
**Fix:** Add a delete row for `OLD` when the key differs (a second statement in the UPDATE trigger with `WHEN OLD.id IS NOT NEW.id`).

### IN-07: Test fault injection is compiled into the production ratification path

**File:** `lib/mcp/tools/gate.cjs:362-375, 561, 822-828`
**Issue:** With `MINDRIAN_TEST_MODE=1`, a file `.mindrian/.test-fault-gate-persist` or `-gate-expire` in the bound room forces a persistence failure or an expiry. It is env-gated and never set by the plugin, but the room is user content (possibly a cloned shared room), and the same variable already switches off `openBrowser`.
**Fix:** Move the seam behind an injected dependency used only by tests, or require a second, non-room-controlled switch.

### IN-08: Launcher polish

**File:** `lib/ui-shell/launch.cjs:37-41, 79-83, 268, 302-309`
**Issue:** (a) The 60-second code TTL starts when the server arms the hash at boot, while `LINK_NOTE` promises 60 seconds from printing, so a slow cold start eats into it. (b) On win32 `commandLineOf` returns null, `isOurShell` is always false, so `stop` never kills the server and a second `start` fails with "port in use". (c) `shell.log` grows without bound. (d) A `start` that cannot reuse a running shell (control call timed out) stops it, ending every open session and gate record.
**Fix:** Arm after the port answers, or restart the TTL on first request; add a Windows `tasklist` path or document the limit; rotate the log; retry the control call once before stopping.

### IN-09: Watcher hints leak the slug (or the absolute directory) to every `/event` subscriber

**File:** `lib/mcp/room-watcher.cjs:90-91, 177`; `lib/mcp/sse-event-bus.cjs:77-97`; `lib/mcp/tools/feed.cjs:90`
**Issue:** `roomId` is `room.slug || room.dir`, so a slugless room publishes an absolute path to every client of `/event` (the stream has no per-client scope and no subscriber cap). Watchers are keyed by that string, so two rooms with the same slug in different directories share one watcher and one wrong `roomDir`. Content-free otherwise.
**Fix:** Key watchers by the realpath of the room dir and publish only a stable opaque id.

### IN-10: The loopback bind is asserted only by the launcher's environment

**File:** `ui/shell/instrumentation.ts`; `ui/shell/server/control.ts:83-92`
**Issue:** The shell binds to 127.0.0.1 because the launcher sets `HOSTNAME`. Next's standalone `server.js` otherwise listens on the machine hostname (the shell often presets `HOSTNAME`). `startShellServer` validates `MOS_DAEMON_URL` but never `process.env.HOSTNAME`, and the Host check is satisfied by any peer that sends `Host: 127.0.0.1:<port>`.
**Fix:** In `startShellServer`, refuse to start unless `HOSTNAME === '127.0.0.1'`.

### IN-11: Build and reads that inherit more than they need

**File:** `scripts/build-ui-shell.cjs:347-352`; `lib/mcp/tools/room.cjs:385, 419`
**Issue:** `next build` receives the maintainer's whole environment, so any `NEXT_PUBLIC_*` variable in the shell would be inlined into the committed dist (none are today: grep of the dist found none). Separately `room_state_bound` and `room_search` resolve the room without `noFloor`, unlike `room_changes` and `room_artifact`, so an unbound session reads whatever room the cwd/boot/registry fallback finds.
**Fix:** Pass `next build` an allowlisted environment; use `noFloor` on the two read tools or document why they differ.

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
