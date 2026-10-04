---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
review: 369-REVIEW.md
date: 2026-10-04
plan: 369-47
findings: 32
fixed: 18
handed_off: 2
navigator: 12
status: complete
---

# Phase 369: Code Review Fix Record

**Review:** `369-REVIEW.md` (2026-10-04, 2 Critical, 19 Warning, 11 Info, 32 findings, status issues_found)
**Fix plans:** 369-33 to 369-46 (RED-first arms, one finding group per commit group); this record is plan 369-47's.
**Counts:** fixed 18 (CR-01, WR-01 to WR-12, WR-14, WR-16 to WR-19), handed off with a named owner 2 (WR-13 daemon half, WR-15), navigator items 12 (CR-02, IN-01 to IN-11). 18 + 2 + 12 = 32. WR-13 is split: its shell half is fixed (plan 369-40) and its daemon half is the hand-off; IN-08 (a) is fixed on the way (plan 369-40), the rest of IN-08 is the navigator's.

Rule applied: a "fixed" row names the plan, the commits, the proving arm, and where the reviewer ran a probe, that probe re-run now with its before and after. Everything below was measured in this session (2026-10-04) by the commands in `369-CLOSE-GATE.md` ("Gap closure re-run (369-47)") unless a row says it cites a gap SUMMARY.

## Disposition table

| ID | Sev | Disposition | Plan and commits | Proving arm (green this session) |
|----|-----|-------------|------------------|----------------------------------|
| CR-01 | Critical | fixed (residual named below) | 369-37: fa5808890 (RED), 586d2a27a; 369-40: 6bc358a63 (RED), a4b3081b9, 92f444e73, f898b1970 | `test-369-shell-server` 43 passed (live curl-shaped exchange 403 before the code is read; browser-shaped `/auth/start` signs in once); `test-369-launch-surface` 30 passed (arms 1a to 1k: no code on a pipe, opener gets `/auth/start`); journey step 1 asserts the launcher printed no code, 5 of 5 runs |
| CR-02 | Critical | navigator item | context only: 369-37 (browser door), 369-36 (mirrors never let one session consume another's gate) | none: not built, by ruling; see the CR-02 section |
| WR-01 | Warning | fixed | 369-38: 16e3a347f (RED), 45c78351b, cd27faa94 | `test-369-gate-hardening` WR-01a/b/c (rolled-back answer leaves the goal file byte-identical; the retry writes it once) |
| WR-02 | Warning | fixed | 369-38: cd27faa94 | `test-369-gate-hardening` WR-02a/b (a committed answer replays as recorded, never `gate_expired`) |
| WR-03 | Warning | fixed (server half 369-38, shell half 369-42) | 369-38: cd27faa94; 369-42: 58aea386a (RED), 808f3daf0 | `test-369-gate-hardening` WR-03a/b/c; `test-369-gate-mirror-shell` arm 6 (`verdict_chosen_mismatch` before any MCP call) |
| WR-04 | Warning | fixed | 369-38: cd27faa94 | `test-369-gate-hardening` WR-04a/b/c (check on the transaction handle, evidence covered, unknown-at-mint not "changed") |
| WR-05 | Warning | fixed | 369-38: cd27faa94 | `test-369-gate-hardening` WR-05a/b/c/d |
| WR-06 | Warning | fixed (369-33 guard, 369-38 server, 369-42 and 369-44 shell) | 369-33: d8b649a1e; 369-38: cd27faa94; 369-42: 808f3daf0; 369-44: e681f4aa5 | `test-369-gate-raised` arm 9 (malformed row aborts nothing); `test-369-gate-hardening` WR-06a/b/c/d (d: live daemon, unbound client after a SIGKILL restart); `e2e-369/gate-button.cjs` arm 15 (gate kept, Check again) |
| WR-07 | Warning | fixed | 369-39: 0dbe55d0a (RED), ea9ed3698 | `test-369-read-surfaces` WR-07a/b |
| WR-08 | Warning | fixed | 369-39: ea9ed3698 | `test-369-read-surfaces` WR-08a/b/c (detector, compaction interleave, cursor overtaken) |
| WR-09 | Warning | fixed | 369-37: fa5808890 (RED), 1a284f031 | `test-369-feed-guards` (six WR-09 arms incl. 9c, the consistent-room control) |
| WR-10 | Warning | fixed | 369-34: f7ae7b8f6 and c2e8e6be2 (RED), 5cab00eca | `test-369-shared-core` arms 3c and 3d |
| WR-11 | Warning | fixed | 369-37: fa5808890 (RED), 1a284f031 | `test-369-feed-guards` (four WR-11 arms) |
| WR-12 | Warning | fixed | 369-40: 6bc358a63 (RED), a4b3081b9 | `test-369-launch-surface` arms 1p and 1q (decoy, start time, Next title with cwd) |
| WR-13 | Warning | split: shell half fixed; daemon half handed off | 369-40: a4b3081b9 (shell); daemon half owner Phase 369.1 plan 04 | `test-369-launch-surface` arm 1n (canary secrets absent from the server's environment); daemon half: no proof, handed off |
| WR-14 | Warning | fixed (server half 369-37, launcher half 369-40) | 369-37: 586d2a27a; 369-40: a4b3081b9 | `test-369-shell-server` (control file replace, symlink, foreign directory); `test-369-launch-surface` arms 1r and 1s |
| WR-15 | Warning | handed off | owner: Phase 369.1 plan 04 (`lib/mcp/daemon-lifecycle.cjs`) | none here |
| WR-16 | Warning | fixed | 369-45: 0f766b139 (RED), 3f559c57a | `test-369-ui-dist-fresh` arms 11a to 11d and 13 (18 passed under the strict ceiling) |
| WR-17 | Warning | fixed | 369-45: 3f559c57a | `test-369-ui-dist-fresh` arm 14 (the build refuses while the seam is set; a sentinel file survives) |
| WR-18 | Warning | fixed | 369-45: 3f559c57a | `test-369-ui-dist-fresh` arms 11d and 12 (positive host allow-list, `buffer/` foreign, absolute path prefixes) |
| WR-19 | Warning | fixed | 369-39: 0dbe55d0a (RED), ea9ed3698 | `test-369-read-surfaces` WR-19a/b/c |
| IN-01 | Info | navigator item | untouched | none |
| IN-02 | Info | navigator item (largely overtaken, see table) | context: 369-33, 369-42 | journey step 7 |
| IN-03 | Info | navigator item | untouched | none |
| IN-04 | Info | navigator item | untouched | none |
| IN-05 | Info | navigator item | untouched | none |
| IN-06 | Info | navigator item | untouched | none |
| IN-07 | Info | navigator item | untouched (per 369-45) | none |
| IN-08 | Info | navigator item; (a) fixed on the way | 369-40: a4b3081b9 for (a) | by construction (arming follows the port probe and the token file); every `start` arm of `test-369-launch-surface` runs that path |
| IN-09 | Info | navigator item | untouched | none |
| IN-10 | Info | navigator item | untouched | none |
| IN-11 | Info | navigator item | untouched (per 369-45) | none |

## Reviewer probes re-run (before and after)

Scratch directories only; nothing was written to the repository.

| Probe (finding) | Before, from the review | After, this session |
|-----------------|-------------------------|---------------------|
| Ledger overwrite: a second session mints a live id (WR-05) | the owner's next `gate_answer` read `session_mismatch`; 5,000 mints left 5,001 entries | `mintGate` under the second session returns `false`; the owner's peek is intact. The ledger itself still holds all 5,000 live entries of one session until their TTL (the cap of 200 lives in `gate_render`; see "Noticed, not fixed") |
| `releaseGate` after the TTL ran out mid-answer, then a retry (WR-02) | retry answered `gate_expired` with "nothing was written" although the answer was committed | retry answers the recorded verdict (`replayed: true`); `test-369-gate-hardening` WR-02a/b |
| `readChanges(after: 5000)` with `latest_seq: 3` (WR-07) | `{"changes":[],"through":5000,...}` with `ok: true` | `checkpoint_expired` with `snapshot_revision` = head; the RED line was `future cursor must not be ok: ... through=5003 latest_seq=3`; `test-369-read-surfaces` WR-07a/b pass |
| `isOurShell` against `node -e ... <entry path>` (WR-12) | true (substring match), so `stopShell` could signal it | false, with or without a recorded start time |
| `room_search` through `notes/link.md -> /elsewhere/secret.txt` (WR-19) | returned the outside line as a snippet | symlinks skipped, real path re-checked before each read; WR-19a passes |
| `node scripts/build-ui-shell.cjs --check` on a dist with one hand-edited byte (WR-16) | exit 0 "fresh" | exit 1, "the dist bytes do not match manifest.files" (an untouched copy: exit 0, 270 dist files verified) |
| `curl -si '<sign-in link>'` with no Origin and no fetch metadata (CR-01) | 303 with `Set-Cookie: mos_shell_sid` | 403 `Forbidden` before the code is read, nothing burned; `test-369-shell-server` live arms |

## CR-02 for the navigator: MCP `gate_answer` has no human principal

**The finding, in plain words.** The promise of Phase 369 is that only a person approves. The shell keeps that promise at its own door with a cookie, a CSRF header and a one-time nonce. But the shell reaches the room through the same MCP tool every model session can call. Any MCP session can mint its own gate with `gate_render` and ratify it with `gate_answer`, and the approve is recorded as the navigator's, because the server attributes every caller to the room's navigator identity (`resolveByUser`). The skills in this repo even tell the model to call `gate_answer` itself on Desktop and Cowork, where there is no shell.

**What the gap closure changed around it.**
- The browser door now needs a navigation-shaped sign-in (plans 369-37, 369-40): a fetch tool or curl cannot redeem the link, and the launcher no longer puts the link in the conversation or in a process argument list. A person's browser still can.
- Gate mirrors never let one session consume another's gate (plan 369-36): the session-scoped ledger and the owner-after-stranger guarantee are unchanged; a mirror is the mirroring session's own entry and the answer is one transaction.
- A gate id cannot be taken over, a verdict that contradicts the chosen option is refused, and a stale subject is caught inside the write transaction (plans 369-38, 369-42).

**What it did not change.** Any MCP session can still mint and answer its own gate, and the approve is still attributed to the navigator. The sign-in boundary is a speed bump, not a proof: a same-user process that forges the three navigation headers inside the 60-second start window can still sign in (recorded in `369-SESSION-CONTRACT.md`, section 3).

**The tradeoff.** Closing it changes `gate_answer`, a frozen, session-scoped Phase 289 contract that the CLI card, Desktop and Cowork rely on. Any fix that makes the MCP path non-human changes what Larry may do on hookless surfaces today, so it needs a ruling, not a quiet patch.

**Options (stated, not chosen).**
1. A human-only route. The daemon exposes a loopback HTTP route authenticated by the shell's control token, which the shell calls instead of the MCP tool for truth-claim approvals; `gate_answer` refuses a verdict that confirms a truth claim unless the call carries an `origin: 'human_shell'` marker only that route can set. Strongest; touches the daemon, the tool contract and the wire snapshots, and changes Desktop and Cowork behaviour for truth-claim gates.
2. An `answered_via` marker. Record on every decision node whether the answer came from a shell route or an MCP session, and attribute the MCP-session path to the session's client name instead of the navigator. Smaller; it does not stop the act, it makes it visible and honest in the room and in "Confirmed by you".
3. Leave as is and say so in the canon. Write the residual into Part 9 and `369-SESSION-CONTRACT.md` (the sign-in boundary is a speed bump; MCP sessions are trusted principals of the same machine and user). Cheapest; the "only a person approves" line then reads "only a person, or a same-user model with the navigator's account".

**Recommendation.** Option 2 now (a post-369 quick: small, honest, visible), with option 1 scheduled as its own phase if the navigator wants the guarantee to be a proof. Option 3 alone is the most honest minimum.

## Handed off (named owner)

- **WR-15** (`ensureDaemon` does not replace an unhealthy daemon) and the **daemon half of WR-13** (the daemon inherits the spawner's whole environment, `lib/mcp/daemon-lifecycle.cjs` around line 297): owner Phase 369.1 plan 04, or a post-369.1 quick. The exact hand-off line from 369-40's SUMMARY: "WR-13 daemon half: ensureDaemon passes the spawner's whole env to the daemon (daemon-lifecycle.cjs around line 297); WR-15: the unhealthy-but-alive branch spawns a second daemon that cannot bind; both from 369-REVIEW.md, owner 369.1-04 or a post-369 quick." Not edited here: that file is 369.1's.

## Info items: navigator items with a one-line recommended disposition

| ID | State after the gap closure | Recommended disposition |
|----|-----------------------------|-------------------------|
| IN-01 | `human-origin.ts` untouched: a second `readGate` still replaces an `issued` nonce and can replace a `used` record | Return the existing `issued` nonce on re-issue and never replace `used`; small post-369 quick |
| IN-02 | Largely overtaken: every gate for a room-bound session leaves a room record (369-33), any session of the room lists and mirrors an open gate (369-42), and an old gate id reads "This decision was already recorded." after a restart (journey step 7, 5 of 5 runs). The explicit "closed by a restart" signal was not built | Accept as closed by gap 1 and gap 2; no further work |
| IN-03 | Tool and shell input caps still disagree; `-32602` still maps to `feed_unavailable` | Raise the tool caps to the shell's (epoch 200, snapshot cursor 2000) and match the tool-missing regex on `-32601` and `unknown tool` only; small quick |
| IN-04 | `projection.ts` `maxLength: 200` untouched, Dexie behaviour unverified | Measure under Dexie, then raise to the largest emittable id or hash long ids |
| IN-05 | Snapshot cursors still carry neither epoch nor room | Put `{epoch, room}` in the cursor and answer `epoch_changed` / `room_switched`; do it with IN-03 (same files) |
| IN-06 | The AFTER UPDATE triggers still leave a ghost for a renamed key | Add a delete row for `OLD` when the key differs; changes the change-log DDL (epoch re-mint), so schedule with the next feed change |
| IN-07 | Untouched per 369-45: `.test-fault-gate-*` seam still compiled into `gate.cjs` | Inject through a test-only dependency or require a second non-room switch; moving it re-pins GATE_BASE, so batch with the next gate.cjs change |
| IN-08 | (a) fixed on the way: the sign-in is armed only after the port answers (369-40). (b) win32 `stop` still finds no live shell; (c) `shell.log` still grows; (d) a timed-out control call still stops the shell | (b) document the limit or add a `tasklist` path; (c) rotate the log; (d) retry the control call once before stopping |
| IN-09 | `room-watcher.cjs` untouched: hints still carry the slug or the directory | Key watchers by the realpath and publish an opaque stable id |
| IN-10 | The launcher sets `HOSTNAME`; `startShellServer` still does not refuse another value | Refuse to start unless `HOSTNAME === '127.0.0.1'`; small |
| IN-11 | Untouched per 369-45: `next build` still inherits the full environment; `room_state_bound` and `room_search` still resolve without `noFloor` | Pass `next build` an allow-listed environment; use `noFloor` on the two read tools or document why they differ |

## Re-review note

Each fixed region was re-read against the finding's stated failure scenario on 2026-10-04 (not against the fix commit's own description). Line ranges are at HEAD `6ce5d9e80`.

| Finding | Region re-read | Addresses the failure scenario? |
|---------|----------------|---------------------------------|
| CR-01 | `ui/shell/server/auth.ts:215-289` (`isBrowserNavigation`, `handleBootstrapRequest`, `handleStartRequest`); `ui/shell/server/bootstrap.ts:26-70` (start slot); `lib/ui-shell/launch.cjs:275-290`, `:509-540` (print only on a terminal, otherwise arm the slot and open `/auth/start`) | Yes for the stated scenario: a `curl` or fetch tool with the link, or reading the argv, gets 403 before the code is read and the link never enters the conversation off a terminal. Residual (named): headers forged by a same-user process inside the 60 s window. |
| WR-01 | `lib/mcp/tools/gate.cjs:1530-1556`; `lib/core/strategy/goal-gate.cjs:119-257`; `lib/hmi/jtbd-state.cjs:300-332` | Yes: the file write follows COMMIT and release and is idempotent per decision node. A crash between COMMIT and the file write leaves the decision recorded and the goal unwritten (369-38 states it; the replay path writes nothing by contract). |
| WR-02 | `lib/mcp/tools/gate.cjs:606-700` | Yes: the room's anchor is read first and wins over the TTL; `releaseGate` was deliberately left unchanged, so the first answer still returns ok. |
| WR-03 | `lib/mcp/tools/gate.cjs:1214-1215` (input), the 289 `checkVerdictAgainstApproving` now reachable; `ui/shell/server/actions.ts:710-720` | Yes for gates that declare `approving` (the shell's proposals and mirrors do). A gate raised by another surface without `approving` has none, and the shell then makes no coherence check (369-42 states it). |
| WR-04 | `lib/mcp/tools/gate.cjs:297-330`, `:382-420`, `:917-960` | Yes: the authoritative check runs on the transaction handle after the anchor reads and before the first write, and covers evidence nodes. A subject whose revision was unknown at mint is never reported changed, and also never checked: with no feed at mint, stale detection is off for that card (new, named below). |
| WR-05 | `lib/mcp/gate-ledger.cjs:109-165`; `lib/mcp/tools/gate.cjs:1238-1258` | Yes for takeover and for `gate_render` loops (cap 200, `gate_id_in_use`, `gate_id_answered`). Other minters are not capped (new, named below). |
| WR-06 | `lib/core/navigation/room-projection.cjs:253-293`, `:443`; `lib/mcp/tools/gate.cjs:606-700`; shell `DROPS_THE_GATE` and `gate-model.ts` | Yes: a failed lookup is `replay_lookup_failed`, retryable, and one bad `properties` row cannot abort the read. Two carve-outs (a caller with no identity; the `cwd` floor) keep `unknown_gate` by design. |
| WR-07 | `lib/core/navigation/room-projection.cjs:548` | Yes: `after > latest` answers `checkpoint_expired`. The epoch-reset half was deliberately not built (a restored file carries its own epoch, nothing inside it reveals the regression; residual accepted in 369-39). |
| WR-08 | `lib/core/navigation/room-projection.cjs:496-631` | Yes: meta and rows come from one read transaction, with a floor re-check after the rows as the second line. Snapshot mode still reads its meta and snapshot rows separately (as_of_seq travels with the cursor); out of scope, stated in 369-39. |
| WR-09 | `ui/shell/server/feed-routes.ts:96-130`; `ui/shell/client/replica/feed-fetch.ts:80-83` | Yes: `room_switched` (409) unless the head's room equals the document's, and a null room is wrong. |
| WR-10 | `ui/shared/src/feed-relay.ts:170-205` | Yes: any change of head or epoch emits; a lower head after a reset is news. |
| WR-11 | `ui/shell/server/auth.ts:44-80`, `:107`; `ui/shell/server/feed-routes.ts:159-225` | Yes: a read that finds a session expired runs the same hooks as the sweep, and the stream ends on its next heartbeat when `peek` finds no session. The stream ends at heartbeat granularity, and the pool entry is closed by its idle sweep, not dropped directly (369-37 states both). |
| WR-12 | `lib/ui-shell/launch.cjs:175-225` | Yes: exact `argv[1]` or the Next title with a matching cwd, plus the recorded start time; the probe above returns false for the unrelated process. |
| WR-13 (shell half) | `lib/ui-shell/launch.cjs:66-80`, `:373-390` | Yes for the shell: an allow-list, the canary arm proves no secret reaches the server. The daemon half is open (hand-off). |
| WR-14 | `ui/shell/server/control.ts:25-52`; `lib/ui-shell/launch.cjs:313-345` | Yes: exclusive `wx` create at 0600 after unlinking a plain file, symlink and directory refused, no chmod of a directory the server did not create; the launcher reads with `O_NOFOLLOW` and checks owner and mode. |
| WR-16 | `scripts/build-ui-shell.cjs:633-` (`check`, `manifest.files`), `:89` (`RUNTIME_PACKAGES`), `:518` (`assertWalledInstallMatchesLock`) | Yes for bytes and output (probe above). Deviation from the review's fix, with its reason in 369-45: the source hash covers the resolved version and integrity of next, react, react-dom and ajv, not the whole root package.json and shrinkwrap, so a Phase 369.1 edit that does not change a byte the dist runs does not stale it; the walled install's lock hash is recorded in the manifest and checked at build time, not by `--check`. |
| WR-17 | `scripts/build-ui-shell.cjs:78-80`, `:396`, `:633-636` | Yes: the seam is read by `check()` only; the build refuses while it is set; every removal goes through `assertDistRemovable`. |
| WR-18 | `scripts/build-ui-shell.cjs:113-` (`INERT_HOSTS`), `:302-` (`foreignSpecifiers`) | Yes: a positive host allow-list with a reason per entry, `buffer/`-style specifiers foreign, absolute path prefixes and drive paths refused; fonts and images are skipped by extension for the path scan only (hosts are scanned everywhere). |
| WR-19 | `lib/mcp/tools/room.cjs:244-262` | Yes: symlinks are skipped and the real path is re-checked before each read. By design an in-room symlink alias is also skipped (arm WR-19b pins it). |

### Noticed while re-reading, named and not fixed

1. **Ledger cap only at `gate_render`.** The per-session cap of 200 and the id guards sit in `gate_render`; `mintGate` itself bounds only expired entries. Chain halts, the research planner and the operator command mint without the cap. The probe above held 5,000 live entries of one session. Owner: a post-369 quick on `lib/mcp/gate-ledger.cjs` (pinned file: re-pins GATE_BASE).
2. **No stale detection when the feed was absent at mint.** `_changedSinceMint` skips a subject whose recorded revision is `null`. In practice the gate-raised observer opens the write door right after mint, so a feed exists (369-38); on a room with no change log the check is off for that card.
3. **Sign-in slot armed when the opener fails.** On a non-terminal start the launcher arms the 60-second slot and then tries to open the browser; if no opener works the slot stays armed until it expires. Only a navigation-shaped request can redeem it (the CR-02 class residual).
4. **Process-hygiene flakes.** `test-267-mcpv2-dual-era.cjs` and `test-289-cli-card-dual-era.cjs` (and 369.1's bin-relocation test) count repo-anchored `mindrian-mcp-server` pids before and after and kill the extras; one failure of each family was seen in this session's first aggregator runs (`369-CLOSE-GATE.md`). Owner: Phase 369.1 or a post-369 quick (sweep only processes the test started), the hand-off 369-34 already wrote.
5. **Two 369-36 open items.** A never-do proposal gate resumed through a mirror reads `decision_node_missing` (a safe refusal); a strategy card mirrored from the record has its previews capped at 1,000 characters, so a long goal proposal can fail its goal ratification softly. Owner: `lib/mcp/never-do-gate.cjs` reading `payload.decision_node_id`, and a record cap decision; navigator item.
6. **`test-365-never-do-gate` N12's `shape()` reads zod 3 `_def.typeName`,** so under zod 4 its schema comparison cannot see field changes (369-41, deviation 3); the real schema pins are the zod4 snapshot and `gen-mcp-adapter --check`.
