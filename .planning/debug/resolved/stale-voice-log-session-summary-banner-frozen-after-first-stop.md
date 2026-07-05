---
status: resolved
kind: rca
trigger: "stale-voice-log-session-summary-banner-frozen-after-first-stop"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: [8, 9]
created: 2026-07-06T01:10:00Z
updated: 2026-07-06T02:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `/home/jsagi/dev/MindrianOS-Plugin` working tree, `main` @ commit `500ed3d4` (post quick-task 260705-x85).
- **WIRE claims probe against:** N/A (no Brain/network involved; strictly LOCAL room.db + filesystem).
- **Date of audit:** 2026-07-06
- **Re-verification rule:** unchanged from template default.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED (see Resolution). `scripts/memory-lifecycle.cjs::cmdStop` no longer deletes the session pointer in `finally`; it is now safe to run on every Stop event.
test: end-to-end verified two ways: (1) the new regression suite `tests/test-memory-lifecycle-stop-repeated.cjs` (24/24 assertions green; proven RED against the pre-fix code first, then GREEN against the fix); (2) a manual live run of the real bash `scripts/on-stop` hook invoked twice in one simulated session -- systemMessage's SESSION SUMMARY timestamp and answer_summary both advanced on the second call (previously frozen byte-for-byte).
expecting: n/a -- resolved.
next_action: none. Session resolved and archived.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.10
- Reported by: navigator, live session, flagged as "the statusline still is mostly static... seems can be using [a stale Stop-says banner]"
- Date first observed: 2026-07-06 (banner text itself carries a 2026-07-05 13:54:48Z origin timestamp, i.e. the underlying stale row was written the PRIOR calendar day and never refreshed since)
- Related debug sessions: `.planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md` (a SIBLING staleness bug in a different subsystem -- that one is the Decision-Gate relevance predicate comparing against the wrong text, fixed today via quick task 260705-x85, commit `62b09ee8`; THIS bug is a separate mechanism -- the voice_log writer no-oping after turn 1 of a session -- in `scripts/memory-lifecycle.cjs` / `scripts/on-stop`, unrelated code path, no shared root cause with that RCA's Finding 2 beyond the shared symptom category "stale cached text re-displayed as if live").

## Problem Statement

The Stop-hook systemMessage banner's "SESSION SUMMARY" segment (built from the `voice_log` table's most recent row) freezes after the first Stop event of a session and never updates again, so the navigator sees the same summary, artifact count, contradiction count, and an increasingly stale timestamp on every subsequent turn regardless of what actually happened since.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: each Stop event (which fires after every assistant turn) writes a FRESH `voice_log` row reflecting that turn's activity, so the banner's timestamp and content advance turn over turn.
actual: `scripts/memory-lifecycle.cjs::cmdStop` only performs its work (transcript ingest, fragment/session close-out, `writeVoiceLogRow`/`writeVoiceLogStub`) when `readPointer(roomDir)` returns a non-null pointer; the SAME function unconditionally calls `deletePointer(roomDir)` in its `finally` block on every successful run, including the very first one. From the second Stop event onward in the same session, `readPointer` returns `null` (line 326: `if (!pointer) return;`), so the entire body is skipped -- no transcript ingest, no new fragment, no new `voice_log` row. `scripts/on-stop`'s `read-voice-tail` reader (lines 226-243) then keeps returning the SAME first-turn row forever, and `FINAL_SM` (line 447-456) keeps emitting the identical `SESSION SUMMARY: ...` text turn after turn.
errors: none (silent no-op by design -- `cmdStop`'s early return is intentional code, not a crash; this is a logic/architecture bug, not an exception)
reproduction:
  1. Start a Claude Code session with an active MindrianOS room (SessionStart hook fires, `memory-lifecycle.cjs session-start` writes `.mindrian/current-session.json`).
  2. Complete one assistant turn (Stop hook fires, `cmdStop` runs its full body since the pointer exists, writes a `voice_log` row, then deletes the pointer in `finally`).
  3. Complete a SECOND assistant turn (Stop hook fires again -- Claude Code fires Stop after every turn, not once per session). `readPointer` now returns `null`; `cmdStop` returns immediately at line 326.
  4. Observe: `node scripts/memory-lifecycle.cjs read-voice-tail <roomDir>` returns the IDENTICAL row as after step 2, no matter how many further turns run.
started: architectural since Phase 84-03 (`cmdStop`'s pointer-delete-in-finally design); the STALE-BANNER SYMPTOM only became visible/testable once Phase 84-07's voice-tail reader + Phase 88.1-03's systemMessage retrofit shipped the banner surface that renders it to the navigator every turn.

## Scope and Impact

- Affected surfaces: cli (Stop-hook systemMessage banner is a CLI/terminal-only surface; Desktop/Cowork Stop-hook equivalents not yet checked for the same pointer lifecycle)
- Affected commands: none directly -- this is a session-lifecycle background mechanism, not a `/mos:*` command
- Affected users: every session longer than 1 turn with an active room bound (i.e. nearly all real usage) -- the SECOND turn onward always shows a stale banner
- Version range: present since Phase 84-03's `cmdStop` shipped the pointer-delete-in-finally design; not yet bisected to a specific version because the design has been architecturally the same since introduction
- Severity: medium (cosmetic/trust-eroding, not data-lossy -- the underlying room.db, STATE.md, and session-snapshot.json writes in `scripts/on-stop`'s bash portion are UNCONDITIONAL and keep working every turn; only the `voice_log`-derived banner segment freezes)
- Blast radius: `scripts/memory-lifecycle.cjs::cmdStop` and `cmdPreCompact` share the same `readPointer`/pointer-gating pattern (`cmdPreCompact` explicitly keeps the pointer per its own comment, so it is NOT affected the same way); only `cmdStop`'s unconditional `deletePointer` in `finally` is implicated. `read-voice-tail` and `on-stop`'s `VOICE_SUMMARY_LINE`/`FINAL_SM` composition are downstream victims, not root causes.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The banner text is a hand-written or hardcoded template string somewhere that never gets updated.
  evidence: `grep -rn "session snapshot saved" --include=*.cjs --include=*.js --include=*.md .` and broader whole-repo greps for "sections drained", "snapshot saved", "session-summary" all resolve to LIVE, dynamically-composed code in `scripts/on-stop:431` and `scripts/on-stop:238` (inside a `node -e` block reading `memory-lifecycle.cjs read-voice-tail`'s JSON output) -- not a static string. The composition IS live; the underlying DATA SOURCE (`voice_log` tail) is what freezes.
  timestamp: 2026-07-06T01:10:00Z
- hypothesis: This is the same bug as `.planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md` Finding 2 (the Decision-Gate relevance predicate).
  evidence: Different subsystem entirely -- that bug is in `scripts/check-card-fire.cjs` / `lib/core/gate-relevance.cjs` and concerns whether an AskUserQuestion card force-fires; already fixed today (commit `62b09ee8`, quick task 260705-x85) by threading the reach's real subject text through. This bug is in `scripts/memory-lifecycle.cjs`'s session-pointer lifecycle and concerns the Stop-hook's `voice_log` write cadence. No shared code, no shared root cause.
  timestamp: 2026-07-06T01:10:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-06T01:10:00Z
  checked: `scripts/on-stop:429-431` and `:225-243`
  found: `STOP_SUMMARY_LINE="session snapshot saved, ${SECTION_COUNT} sections drained, health ${HEALTH_GLYPH}"` matches the navigator's literal "session snapshot saved, 8 sections drained, health low" report; the `VOICE_SUMMARY_LINE` composition (`'SESSION SUMMARY: ' + cmd + ' | ' + cited + ' artifacts | ' + flagged + ' contradictions | ' + ts + 'Z'` optionally `+ ' | ' + ans`) matches the reported "SESSION SUMMARY: session-summary | 0 artifacts | 0 contradictions | 2026-07-05 13:54:48Z | [contradiction text]" exactly, including the `ans` (the last assistant fragment's content, truncated to 120 chars) tail.
  implication: the banner's FORMAT is fully explained; the frozen CONTENT means the underlying `voice_log` row has not changed since it was written, even though many turns and real elapsed time (including a date rollover) have passed.
- timestamp: 2026-07-06T01:10:00Z
  checked: `scripts/memory-lifecycle.cjs:324-392` (`cmdStop`)
  found: line 325-326, `const pointer = readPointer(roomDir); if (!pointer) return;` -- an early, silent return with NO voice_log write, NO fragment write, NO transcript ingest, whenever no pointer file exists. Line 388-391, the `finally` block: `await closeRoomDb(handle); deletePointer(roomDir);` -- runs unconditionally after every SUCCESSFUL (non-early-return) invocation, deleting the very pointer the NEXT invocation depends on.
  implication: the FIRST Stop event of a session (pointer present, written by `session-start`) does the full job AND deletes the pointer. The SECOND and every subsequent Stop event in that same session (pointer now absent) does nothing. Given Claude Code's Stop hook fires after every assistant turn (empirically confirmed within this very session -- multiple distinct check-card-fire.cjs Stop-hook interceptions were observed across many separate turns, proving Stop is a per-turn event, not a per-session event), this means `voice_log` receives exactly ONE row per session, written after the FIRST turn, and never again.
- timestamp: 2026-07-06T01:10:00Z
  checked: `scripts/memory-lifecycle.cjs:1-47` (module header doc comment)
  found: the documented design explicitly states "stop <roomDir> ... delete pointer" as the intended contract, and separately notes "A stale .mindrian/current-session.json pointer (from a crashed session) causes the next session-start to simply create a new session row. No cleanup needed" -- this anticipates a pointer SURVIVING across an unexpected termination, but never anticipates or documents the Stop hook firing MULTIPLE times per session, which is the actual Claude Code hook cardinality.
  implication: this is an architectural mismatch between the code's implicit model (SessionStart:Stop is 1:1, "Stop" means "the session is over") and the real event cardinality (SessionStart:Stop is 1:N, "Stop" means "this turn is over"). The design comment for `pre-compact` ("Pointer kept") shows the codebase DOES know how to keep a pointer alive across an intermediate lifecycle event elsewhere -- `cmdStop` is the one handler that treats its own event as terminal when it is not.

## Technical Root Cause

- Site: `scripts/memory-lifecycle.cjs:324-392`, function `cmdStop`
- Cause: `cmdStop` unconditionally deletes the session pointer (`deletePointer(roomDir)`, line 390, inside `finally`) every time it successfully runs, but Claude Code's Stop hook fires after EVERY assistant turn, not once per session. The pointer, once deleted after turn 1's Stop event, is never recreated until the NEXT true SessionStart (new session, resume, or a post-compact rewrite) -- so `cmdStop`'s guard `if (!pointer) return;` (line 326) makes every Stop event from turn 2 onward a silent no-op: no transcript ingest, no fresh fragment, no new `voice_log` row.
- Why it surfaces now: it has always been true architecturally (Phase 84-03), but only became a VISIBLE navigator-facing defect once the Phase 88.1-03 systemMessage retrofit started surfacing the `voice_log` tail (via `VOICE_SUMMARY_LINE`) to the terminal on every Stop event -- before that retrofit, the frozen data sat silently in the database with no per-turn UI surface exposing its staleness.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `scripts/memory-lifecycle.cjs:324-392`, function `cmdStop`
  - Current behavior: deletes the session pointer unconditionally in `finally` on every successful run, so only the FIRST Stop event of a session ever writes a `voice_log` row.
  - Required behavior: `cmdStop` must be safe to call on EVERY Stop event (once per assistant turn) and write a FRESH `voice_log` row / fragment each time, while the underlying "session" (the room.db `sessions` row keyed by `pointer.id`) stays OPEN across the whole conversation. Stop must no longer treat itself as the terminal, one-time close-out event.
  - Short-term patch: remove the unconditional `deletePointer(roomDir)` from `cmdStop`'s `finally` block (mirror `cmdPreCompact`'s existing "Pointer kept" pattern, which already proves the codebase can keep the pointer alive across an intermediate lifecycle event). Do NOT call `memory.endSession` on every turn either (that call should represent the TRUE end of the conversation, not turn N's end) -- gate `endSession` + pointer deletion behind a real termination signal if one exists in the Stop-hook stdin envelope (check `stop_hook_active` and any other stdin fields Claude Code's Stop event actually carries), or, if no such signal exists, keep the pointer alive indefinitely and instead make `writeVoiceLogRow`/fragment-append idempotent-and-repeatable per turn (i.e. `cmdStop` becomes "append a fragment/voice_log row for what just happened," not "close the session"), deferring the true `endSession` + pointer cleanup to `SessionStart` finding and closing an orphaned pointer at the START of the NEXT real session (the module's own header comment already documents this exact recovery path for a "stale pointer from a crashed session" -- extend that same recovery logic to also be the mechanism that finally calls `endSession` for the PRIOR session, rather than requiring Stop to do it inline).
  - Long-term fix: determine, from Claude Code's actual Stop-hook stdin contract, whether there is ANY reliable per-turn vs. per-session distinguishing signal (e.g. `stop_hook_active`, or the absence of a subsequent `UserPromptSubmit` within some window is NOT a viable synchronous signal). If no such signal exists, the correct architecture treats a "session" as spanning from `SessionStart` to the NEXT `SessionStart` (i.e., sessions are closed retroactively, at the start of the next one, not proactively at Stop), and `cmdStop` becomes a purely additive per-turn logger with no pointer deletion at all.

## Open Design Question -- Resolved Before Implementation

Investigated all three sub-questions before writing the fix:

1. **Stop-stdin fields available:** `scripts/on-stop` only ever extracts `transcript_path` from the Stop-hook stdin JSON (line 33). `scripts/check-card-fire.cjs`'s header comment (BL-01) documents the real envelope shape as `{ hook_event_name, transcript_path, stop_hook_active, session_id, ... }`, but greeping that file's actual logic shows `stop_hook_active` is never read anywhere in this codebase -- only `session_id` and `hook_event_name` are consumed. `stop_hook_active` is a Claude Code infinite-loop guard (true when a Stop hook's own `decision:'block'` caused a re-prompt), NOT a per-turn-vs-session-end signal. Conclusion: no reliable termination signal exists in the Stop-stdin envelope. The long-term fix's premise (sessions close retroactively at the next SessionStart) is the correct model, not an achievable proactive signal at Stop.
2. **Is `memory.endSession` idempotent-safe?** Yes -- read `lib/core/memory-ops.cjs:298-319`: it is a single `UPDATE sessions SET ended_at=?, summary=?, ... WHERE id=?`. No insert, no side effects, no downstream reader anywhere in the codebase checks `sessions.ended_at IS NULL` as a "session still live" signal (grepped all `ended_at` usages). Calling it every turn just keeps `ended_at`/`summary` fresh with the latest known state; harmless to call on every Stop event. Chose to KEEP calling it every turn (simplest correct option) rather than deferring it to the next SessionStart.
3. **Does `fragments` role='session-summary' growing per-turn matter?** Grepped every consumer of `fragments` (role-filtered or not): no reader anywhere filters specifically on `role='session-summary'` except the writer itself. However, `lib/core/navigation/room-context.cjs`'s Leg B windows the **last ~6 fragments of ANY role** (`DEFAULT_FRAGMENT_WINDOW`) to seed Larry's in-process focus-node resolver -- an unbounded per-turn `session-summary` insert would dilute that window with duplicate summary noise as a session got longer. Resolution: made the session-summary fragment an UPSERT (one row per session_id, refreshed in place), not an append. Zero downstream consumer depended on the old append-only history, so this is a pure improvement, not a compatibility risk.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: new or extended `tests/test-memory-lifecycle-stop-repeated.cjs`
  - Given: an active room with a `session-start` pointer written, then `cmdStop` run once (simulating turn 1's Stop event)
  - When: `cmdStop` is invoked a SECOND time (simulating turn 2's Stop event, pointer still present per the fix)
  - Then: a SECOND, distinct `voice_log` row exists (different `id`/timestamp from the first), and `read-voice-tail` returns the second row's content, not the first's
  - Runner registration: register in the memory-lifecycle test suite / `tests/run-all-84.sh` if one exists, else the closest relevant `run-all-*.sh`
- Test 2:
  - Type: integration
  - Location: same test file
  - Given: N simulated Stop events in one session (N >= 3)
  - When: each runs in sequence
  - Then: `voice_log` has N rows (or however many the fix's actual cadence produces -- document the chosen cadence explicitly in the test name/comment), none of them silently skipped after the first
  - Runner registration: same suite as Test 1

## Non-Code Follow-ups

- CHANGELOG.md: DEFERRED, explicitly out of scope for this debug-fix task (no version bump / release cut here; the navigator triggers the actual release cut separately later).
- Release lockstep: not applicable to this quick-task commit itself; applies whenever the containing version is actually cut.
- Canon: Part 9 (Memory Locality) is touched -- the fix changes when/how the LOCAL room.db `sessions`/`voice_log`/`fragments` tables are written across a session's lifetime; no Brain-boundary change (Part 8 stays clean, this is 100% LOCAL). CONFIRMED after the fix: every changed read/write (`readPointer`, `writePointer`, `endSession`, `addFragment`/upsert, `writeVoiceLogRow`) stays inside `scripts/memory-lifecycle.cjs` + `lib/core/memory-ops.cjs` operating on the room's own `room.db`; nothing crosses to Brain MCP.
- knowledge-base.md: added (see resolved/ move).
- Docs / monitoring: DONE -- `scripts/memory-lifecycle.cjs`'s header doc comment rewritten in place to describe the new per-turn Stop contract and explicitly document the Stop-cardinality fix and its rationale.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- `cmdStop`'s unconditional `deletePointer` in `finally` treats every Stop event as if it were the one-time end of the session, but Stop fires once per assistant turn; the pointer is gone after turn 1, so every subsequent Stop silently no-ops the entire voice_log-writing body.
fix: Implemented the short-term patch exactly as scoped, informed by the resolved open design question above. In `scripts/memory-lifecycle.cjs`: (1) `cmdStop`'s `finally` block no longer calls `deletePointer(roomDir)` -- the pointer now survives every Stop event and is only ever replaced by the next `session-start`. (2) `ingestTranscriptFragments` changed from a one-shot "skip if any fragments already ingested" guard to an INCREMENTAL slice (`turns.slice(alreadyHas)`), so each Stop event ingests only the NEW transcript turns since the last Stop, keeping `voice_log`'s `answer_summary`/`question`/`artifacts_cited` genuinely fresh instead of frozen at turn 1's snapshot. (3) Added `upsertSessionSummaryFragment` -- the `role='session-summary'` fragment is now updated in place (one row per session_id) instead of appended every turn, preventing unbounded fragment growth that would have diluted `navigation/room-context.cjs` Leg B's "last ~6 fragments" window. (4) `memory.endSession` continues to be called every Stop event (confirmed idempotent-safe: a plain UPDATE, no reader depends on `ended_at IS NULL` as a liveness signal). (5) `writeVoiceLogRow`/`writeVoiceLogStub` were unchanged -- they already inserted a fresh row per call, which is exactly what makes the banner advance once cmdStop itself runs every turn.
verification: (1) `tests/test-memory-lifecycle-stop-repeated.cjs` (new, 24 assertions) -- proven RED against the pre-fix code (11 failures reproducing the exact bug: pointer deleted after stop 1, only 1 voice_log row ever, no re-ingestion) via `git stash`, then GREEN against the fix (24/24 pass): pointer survives repeated Stop events, N Stop events produce N distinct strictly-increasing voice_log rows each reflecting its own turn's content, session-summary fragment count stays at exactly 1, conversation fragments ingested exactly 2/turn with no duplication. (2) Manual end-to-end run of the real bash `scripts/on-stop` hook invoked twice in a simulated session: systemMessage's SESSION SUMMARY timestamp advanced (13:27:14Z -> 13:27:17Z) and answer_summary advanced ("real turn one answer" -> "real turn two answer") on the second call -- previously this would have been byte-for-byte frozen. (3) No regression: `tests/test-memory-hook-integration.cjs` (10/10 pass, unaffected Stop-hook scripts). (4) `test/84-smart-notebook-copilot.test.cjs` has 9 pre-existing failures (cases 01-04, 06, 07, 12, 13, 15) confirmed present BYTE-FOR-BYTE IDENTICAL both with and without this fix (isolated via `git stash` on `scripts/memory-lifecycle.cjs` alone) -- root cause is an unrelated, pre-existing test-harness bug (`mkFixtureRoom` returns the bare `DatabaseSync` per the Phase 109-02 `room-db.cjs` contract, but the test's case12/13 code reads `handle.db.prepare(...)`, which is `undefined.prepare`); case 15 recursively spawns the full 41-file Feynman suite and times out under current machine load, also reproduced identically pre-fix. None of these 9 are caused by or related to this change.
files_changed: [scripts/memory-lifecycle.cjs, tests/test-memory-lifecycle-stop-repeated.cjs]
commits: [b3a1f5c88f8e4c9180ec68e4059d5e53d0fc00e6]
