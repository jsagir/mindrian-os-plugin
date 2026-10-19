---
phase: 371-navigator-startup-ui-first-room-and-returning-workday
reviewed: 2026-10-19T11:55:00Z
depth: deep
reviewer: Claude (gsd-code-reviewer), release-gate review for v2.0.0-beta.71
commits_reviewed: [ecde228dc, ec3d56380, b0e4a43de, e4eb3cebb, cec325d5b, c338b89e7, 5c0f344fc, c483674b9]
commits_skipped: [c53beea37, f6bf6cb92]
peer_commits_seen_during_review: [dbb9a3efd, 2c5f006a0, 0d434f2df, 1322656e1]
files_reviewed: 22
files_reviewed_list:
  - lib/core/navigation.cjs
  - lib/core/navigation/room-birth.cjs
  - lib/core/navigation/room-workday.cjs
  - lib/mcp/startup-operations.cjs
  - lib/mcp/tools/startup.cjs
  - lib/mcp/tools/gate.cjs
  - lib/mcp/tools/room.cjs
  - lib/mcp/tool-router.cjs
  - lib/mcp/room-app.cjs
  - lib/mcp/room-assets.cjs
  - lib/mcp/app-views.cjs
  - lib/mcp/runtime-instructions.cjs
  - lib/mcp/app-html/rooms.html
  - lib/mcp/app-html/rooms.css
  - lib/mcp/assets/FONT-SOURCES.md
  - data/connector-registry.json
  - data/mcp-tool-connectors.json
  - data/harness-manifest.json
  - docs/GPT-PLUGIN-UI.md
  - tests/run-all-371.sh
  - tests/test-startup-flows.cjs
  - tests/test-371-startup-ui.cjs
findings:
  critical: 2
  warning: 5
  info: 6
  total: 13
status: issues_found
verdict: BLOCK
---

# Phase 371: Release-gate code review (Codex commits before v2.0.0-beta.71)

**Reviewed:** 2026-10-19
**Depth:** deep (cross-file trace of gate ledger, gate observers, session binding, birth, workday)
**Status:** issues_found
**Verdict:** BLOCK (2 blockers, both small fixes)

## Summary

The install path is safe. The new files ship inside the npm package. No new dependency is required. No hook loads the changed MCP modules. The MCP server starts and the 371 suite passes. Part 8 holds: the new server code makes no Brain, Theo or network call. Part 9 creation holds: a room is born only through `navigation.birthRoom`, and the approval receipt commits inside the birth transaction.

Two defects give incorrect behavior in normal use. CR-01: creating a second room writes the new room's name and purpose into the currently bound room. CR-02: on a stdio server (Claude Desktop, a stdio wrapper behind ChatGPT) every later chat in the same server process gets the first chat's frozen workday briefing and no next-move choice. Both are proven by probes. Both have one-place fixes.

Four repository contract suites are red because of these commits (WR-01). They are not in the release gate (`tests/run-all-366.sh`). The one gate leg that was red at c483674b9 (`test-270`) was repaired by peer commit dbb9a3efd during this review.

## Local implementation readiness vs the open ChatGPT checkpoint

| Track | State | Evidence |
|---|---|---|
| Local implementation | NOT READY until CR-01 and CR-02 are fixed; otherwise sound | Probes below; `bash tests/run-all-371.sh` exit 0 |
| Release gate suite | PASS at HEAD 1322656e1 after rerun of 1 timed-out leg | `run-all-366.sh`: 74 pass, 1 fail (I3 timeout under load), 1 known; leg rerun alone 12/0 |
| Real ChatGPT checkpoint (STARTUI371-08) | OPEN, 0 of 3 UAT checks passed | 371-UAT.md, 371-HOST-VALIDATION-ATTEMPT.md; this review did not touch it |

CR-02 bears directly on UAT check 3 ("Start a clean chat and select the same room"). If the ChatGPT connection runs one long-lived stdio process, check 3 will fail for the reason in CR-02. Fix CR-02 before the real-host run.

## Commands run

| Command | Result |
|---|---|
| `bash tests/run-all-371.sh` (Node 24.21.0) | PASS, exit 0, "Phase 371 local acceptance: PASS" |
| `bash tests/run-all-366.sh` (release gate) at HEAD | 74 passed, 1 failed, 1 known. Failed leg: `test-366-semantic-index-integrity` I3 (gate timed out under parallel load). Rerun alone: 12 passed, 0 failed |
| `node scripts/check-require-integrity.cjs` | OK, 3088 files, 7938 references, 90 to 97 s |
| `npm pack --dry-run --json` | All 11 new files present, including both woff2 fonts and both OFL notices |
| `node lib/mcp/no-instructions.test.cjs` | 18 passed, 0 failed (instructions budget and Part 8 tail hold) |
| Baseline f6bf6cb92 vs c483674b9 vs HEAD: tests 267, 270, 276, 369-launch-surface | See WR-01 |
| Probe `same-process-workday.cjs` (scratchpad) | Proves CR-02 |
| Probe `second-room.cjs` (scratchpad) | Proves CR-01; also proves replay works for a bound navigator |
| Probe `retry-pending.cjs` (scratchpad) | Proves WR-02 |

## Checklist results (priority order from the request)

1. Install and start: PASS. `lib` is in the package `files` allowlist; the Desktop artifact derives from the npm pack. `@modelcontextprotocol/ext-apps` and `zod` were already in `package.json` and `npm-shrinkwrap.json`. `navigation.cjs` adds only a lazy require. `room-assets.cjs` reads files at first request, not at load. Hooks reference the changed modules only in comments.
2. Canon: Part 8 PASS. Part 9 creation PASS. Part 9 locality FAIL (CR-01). Gate discipline: F.0 before the birth write PASS; single-use and replay PASS (the second answer of the same gate replays, a raced second gate returns `room_exists`); F.0 human-only NOT enforced (WR-04, pre-existing SEED-114 class).
3. Security: path containment PASS (slug regex, realpath containment, symlink escape refused, `lstat` collision, recheck against the same real home at approval). Shell injection CLOSED by this work: `execSync` with double-quoted `JSON.stringify` arguments let `$(...)` in a display name run; `execFileSync` with literal argv fixes it. No secrets. No new server network call. CSP: `connectDomains: []`; `resourceDomains` adds `data:` for fonts; the SDK still loads from jsdelivr (IN-01).
4. UI and copy: no `innerHTML`; all text through `textContent` and DOM nodes. No em-dash or en-dash added in changed source. Plain English. v5 tokens. Defects: WR-02, WR-05, IN-03.

## Critical Issues

### CR-01: Creating a second room writes the new room's name and purpose into the bound room

**File:** `lib/mcp/startup-operations.cjs:55` (entry has no room and no opt-out) and `lib/mcp/tools/gate.cjs:466-481` (`_roomForMintedGate`, `_onGateMinted`)
**Issue:** The room-creation gate entry carries `roomCreation: true` and no room. The ledger mint observer then falls back to the session's bound room and calls `gateRaised.recordRaised(roomDir, ...)`. A navigator bound to room A who creates room B gets a `gate_raised` row in A's `room.db` that carries B's header, purpose and folder. The release of the gate then adds a `gate_closed` row in A. While the gate is open (up to 30 minutes), A's workday briefing lists "Create B?" under Pending decisions. In a shared Cowork room this discloses B's private purpose to A's collaborators. This is a write to the wrong room (Part 9 locality).
**Proof (PROVEN):** probe `second-room.cjs`: `rows in A about B gate 2 gate_raised:carries-B-purpose:carries-B-name gate_closed:no-purpose:no-name`.
**Fix:** skip creation gates in the observer, the same way the recovery card is skipped:
```js
// lib/mcp/tools/gate.cjs, _onGateMinted, beside the recovery skip
if (entry.recovery === true || entry.roomCreation === true) return;
```
Add a test leg: bind room A, prepare and approve room B, assert A has no row whose properties contain B's gate id.

### CR-02: On a stdio server, every later chat gets the first chat's frozen workday briefing

**File:** `lib/core/navigation/room-workday.cjs:18,24,34-39`; `lib/mcp/startup-operations.cjs:80-86`; session source `lib/core/session-binding.cjs:155-183`
**Issue:** `visit_id = sha256([roomId, sessionId, navigatorId])`. On stdio, `sessionId` is the process key `stdio-<pid>-<hex>`, which lives as long as the server process. Claude Desktop keeps one server process across conversations (ASSUMED from host behavior); a stdio wrapper behind a ChatGPT tunnel does the same unless it spawns per session. Every later `room_startup` in that process finds `current`, so:
- `opened_at` and the baseline stay at the first chat's values;
- the change window is capped at the first `opened_at`, so work done after the first chat never appears;
- the next-move gate id is the same, its answer anchor exists, so `next_move.status` is `answered` and the navigator gets no next-move choice ("The startup choice was already recorded").
The briefing is then untruthful ("No previous checkpoint", "No changes were recorded") against STARTUI371-04.
**Proof (PROVEN):** probe `same-process-workday.cjs`: chat 1 answered its move; work was logged; chat 2 returned `opened 2026-10-19T11:41:46.991Z` (same as chat 1), `changes no_previous_checkpoint` with no items, `next "answered"`.
**Fix:** scope a visit to one binding, not to the process. Keep retry stability inside one binding.
```js
// startup.cjs: pass the binding generation of the effective room binding
const bindingGen = room.bound_at || room.binding_id;   // from resolveMcpWriteRoom / the binding file
navigation.startRoomWorkday(db, room.dir, { roomId: room.slug, sessionId, navigatorId, bindingGen });
// room-workday.cjs
const visitId = sha256(JSON.stringify([roomId, sessionId, navigatorId, opts.bindingGen || null]));
```
If the binding record has no timestamp, add one at `room_bind` time (each `room_bind` call starts a new visit; repeat `room_startup` calls keep the visit). Add a test: one client connection, bind, startup, answer, log work, bind again, startup; assert a new `opened_at`, the logged work in `changes.items`, and a live next-move card.

## Warnings

### WR-01: Four contract suites regressed; one release-gate leg was red at c483674b9

**Files:** `tests/fixtures/267/wire-snapshot-zod3.json`, `tests/fixtures/267/wire-snapshot-zod4.json`, the 276 honesty ledger, `lib/mcp/tools/room.cjs:83` (room_list description)
**Issue (PROVEN by baseline comparison f6bf6cb92 vs c483674b9 vs HEAD 1322656e1):**
| Suite | f6bf6cb92 | c483674b9 | HEAD |
|---|---|---|---|
| test-270 tool schema budget (release gate leg) | 5/0 | 4/1 (`measured=50 after=48`) | 5/0, fixed by peer dbb9a3efd |
| test-267 registration API | 71/0 | 72/1 (`live tools/list count (50) != wire-snapshot (48)`) | 72/1 |
| test-276 honesty findings | 149/1 (room_search, pre-existing) | 147/4: new `room_list` HIGH_RISK row, `frozen_sweep.tools 45 vs 47`, `branches 140 vs 142` | 147/4 |
| test-369-launch-surface | arm 4 and 6b fail (pre-existing) | adds arm 6 FAIL: "the live room_list description carries the two sentences with /mos:dashboard shell" | same |
`run-all-267.sh` and `run-all-369.sh` are red for these reasons. The release gate does not run them, so the cut is not stopped mechanically. Arm 6 guards a navigator ruling for Desktop delivery. The new room_list text replaces that ruled copy with "do not route an embedded room-opening request to Claude Code".
**Fix:** regenerate both 267 wire snapshots for 50 tools; re-freeze the 276 ledger with a disposition for the `room_list` "Read-only" claim (the claim is true; the scanner flags a claim on a tool with no write); for arm 6, either restore the two ruled sentences in the `room_list` description or record a new navigator ruling and update the arm. The ruling choice needs the human (see NEXT).

### WR-02: A retried briefing lists its own next-move card as a pending decision

**File:** `lib/core/navigation/room-workday.cjs:52,72`; `lib/mcp/tools/startup.cjs:35-37`
**Issue:** The first `room_startup` mints the next-move gate; the mint observer records `gate_raised` in the room. A later `room_startup` in the same visit reads open raised gates before it peeks the live gate, so the briefing shows "What would you like to work on in <room>?" under Pending decisions next to the same choice buttons.
**Proof (PROVEN):** probe `retry-pending.cjs`: `pending headers ["What would you like to work on in probe-room?"]`.
**Fix:** in `startRoomWorkday`, drop the visit's own gate: `pending.filter(g => g.gate_id !== 'workday-' + visitId.slice(0, 32))`. Keep the id formula in one exported helper so both modules use it.

### WR-03: The change list can report "no changes" when changes exist

**File:** `lib/core/navigation/room-workday.cjs:38-40,70`
**Issue (code read, not run):** `findRecentChanges` returns the newest 201 events after the baseline. The code then drops events newer than `opened_at`. If 201 or more events were written after `opened_at` (a busy session, then a briefing retry), every pre-open change is dropped and the status reads `no_recorded_changes`. `truncated` is computed after the filter, so `events.length === 201` can never be true there.
**Fix:** bound the query at both ends (add an `until` option to `findRecentChanges`: `AND n.created_at <= ?`), and compute `truncated` from the raw result length before any filter.

### WR-04: Room birth approval is not human-only, and the record says "navigator" for a model relay

**File:** `lib/mcp/startup-operations.cjs:60-63`; `lib/mcp/tools/gate.cjs:1451,1545-1548`
**Issue:** The `room_create` result gives the model the gate id. The model can call `gate_answer` approve itself; the route is recorded as `mcp_relayed`, but `birthRoom` receives `approvedBy: 'navigator'` in every case. This is the known SEED-114 class, now extended to a filesystem-creating step. The tool description says the folder is created "until the navigator answers that gate", which a relay satisfies without the navigator.
**Fix:** pass the route into the attribution: `approvedBy: answer.answered_via === 'browser_nonce' ? 'navigator' : 'navigator_via_host_relay'`. State the relay limit in the `room_create` description. Keep SEED-114 as the owner of the human-only route.

### WR-05: The room view treats a retryable refusal as final and removes the receipt check

**File:** `lib/mcp/app-html/rooms.html:71-80,91-96,328`
**Issue:** `call()` marks every `ok:false` as `definitive`. `gate_answer` returns `replay_lookup_failed` when it could not read the room, and its own message says "Try again in a moment". The view then clears `pendingCreation`, hides "Check creation result", and shows the generic "The room operation was refused". A navigator whose creation did succeed can then prepare again under a new name and get a second room.
**Fix:** treat `replay_lookup_failed` as not definitive (keep the pending payload and the recovery button), and add a plain-English line to `friendly()`: "The saved result could not be checked yet. Check creation result again in a moment."

## Info

### IN-01: The room view still needs a CDN fetch for the Apps SDK
**File:** `lib/mcp/app-identity.js:4,77`; `lib/mcp/room-app.cjs:13`
Fonts are bundled, but the SDK loads from `cdn.jsdelivr.net` without an integrity check (a dynamic `import()` cannot carry SRI). Pre-existing pattern from the reviewed commits. Offline or a host that refuses jsdelivr gets the failure text, not the view. Consider serving the pinned `app-with-deps.js` from the package as an inline script for the startup view.

### IN-02: Release-gate leg I3 has a thin timeout margin
**File:** `tests/test-366-semantic-index-integrity.cjs:54`
`check-require-integrity.cjs` takes 90 to 97 s alone against a 120 s `spawnSync` cap. Under parallel load it timed out once in this review. Run `run-all-366.sh` with no other suite in parallel before the cut, or raise the cap.

### IN-03: A non-Latin room name gets an opaque folder name
**File:** `lib/mcp/startup-operations.cjs:12-15`
A Hebrew name becomes `room-<10 hex>`. The preview shows it, so nothing is hidden, but the folder is hard to recognize. Consider transliteration or a slug field in the view.

### IN-04: The 371 "CSP" check does not enforce a CSP
**File:** `tests/test-371-startup-ui.cjs:15,33`
The test asserts the declared `resourceDomains` and listens for console CSP errors, but the `srcdoc` iframe has no CSP applied. CSP enforcement stays a real-host item (UAT check 1).

### IN-05: Every startup choice mints a decision node
**File:** `lib/mcp/startup-operations.cjs:88-96` with the general-gate approve path in `lib/mcp/tools/gate.cjs`
Each answered next-move card writes a typed decision node "What would you like to work on in <room>?". Over many workdays this adds routine rows to the room's decision record. Consider a non-ratifying kind for the startup card, or a label the decision views can filter.

### IN-06: Pre-existing reds recorded for completeness
`test-369-launch-surface` arm 4 (Part 8 paragraph text) and `test-276` `room_search` row were already red at f6bf6cb92 (outside this review's commits). `pin 355 direction agreement` is a known red in the release gate.

---

## Agent report (protocol fields)

STATUS: DONE
CHANGED: .planning/phases/371-navigator-startup-ui-first-room-and-returning-workday/371-CLAUDE-RELEASE-REVIEW.md (new, not committed). No source file changed. No commit, push, publish, credential, tunnel or Theo change.
VERIFIED: `bash tests/run-all-371.sh` (Node 24.21.0) exit 0. `run-all-366.sh` at HEAD 74 pass, 1 timeout fail, leg rerun alone 12/0. `npm pack --dry-run` lists all new files. Baseline comparison of tests 267, 270, 276 and 369-launch-surface at f6bf6cb92, c483674b9 and HEAD. Probes prove CR-01, CR-02 and WR-02.
UNVERIFIED: real ChatGPT host (checkpoint open; not touched). Whether the ChatGPT connection gives each chat a new MCP session (decides how often CR-02 occurs there). Whether Claude Desktop keeps one server process across chats (ASSUMED yes). WR-03 is from code reading, not a run.
RISKS: shipping as is writes a new room's name and purpose into the bound room (CR-01) and gives stale workday briefings on stdio hosts (CR-02). Contract suites 267, 276 and 369-launch-surface stay red. A navigator ruling on Desktop room_list copy was replaced without a recorded ruling.
NEXT: run a /gsd-quick to fix CR-01 and CR-02 (with their test legs) and WR-02, then re-run `bash tests/run-all-371.sh` and `bash tests/run-all-366.sh` alone before the beta.71 cut.
NEEDS_HUMAN: Keep the ruled Desktop sentences in the room_list description, or accept the new room-first description as a new ruling?
