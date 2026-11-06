---
status: fixing
kind: rca
trigger: "check-pending-ambiguous-three-strikes-count-compactions"
issue_id: "B6a"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T08:30:00Z
updated: 2026-11-06T08:30:00Z
---

## Current Focus

hypothesis: scripts/check-pending-ambiguous.cjs runs on startup, clear and compact and adds one strike to every active ambiguous claim on every run. Three compactions in one session therefore dismiss the claims, so "3 strikes" counts hook firings and not sessions.
test: Run the hook 3 times against a fixture room with source compact and one session_id, read surfacing_count after each run.
expecting: surfacing_count 1, 2, 3 and the claims flip to dismissed on run 3.
next_action: Write the failing test, then count one strike per distinct session_id.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (main)
- Source-of-Truth Preamble: CODE claims read against branch main @ aec3a86cb (working tree, hooks/hooks.json carries a peer edit). WIRE claims: none. Date 2026-11-06.
- Reported by: auditor finding B6 (.planning/audits/AUDITOR-FINDINGS-source.md), confirmed by reproduction.
- Related debug sessions: check-pending-breakthrough-creates-room-db (the other half of B6).

## Skip Rule Check

target: PRESENT

scripts/check-pending-ambiguous.cjs exists with function throttleAndCollect. hooks/hooks.json still carries its SessionStart entry (matcher startup|clear|compact, timeout 3).

## Problem Statement

The 3-strikes dismissal of ambiguous claims counts hook firings. A compaction or a clear inside one session adds a strike, so a claim can be retired after the navigator saw it once.

## Symptoms

expected: A claim is dismissed after the navigator saw it in 3 distinct sessions.
actual: A claim is dismissed on the 3rd hook run, even when all 3 runs come from one session.
errors: none.
reproduction:
  1. Build a fixture room with a room.db and 2 synthetic ambiguous claims, with a registry entry.
  2. Run the hook 3 times with stdin {"hook_event_name":"SessionStart","source":"compact","session_id":"sess-A"}.
  3. Read surfacing_count and disambiguation after each run.
started: Phase 150.8-03 (DIKW-06).

## Scope and Impact

- Affected surfaces: cli (SessionStart hook). Desktop and Cowork do not run this hook; they reach the queue through /mos:file-meeting.
- Affected commands: SessionStart hook only.
- Affected users: any user with ambiguous claims who compacts or clears.
- Version range: Phase 150.8-03 through current main.
- Severity: low.
- Blast radius: the dismissal canary only. The queue node stays in room.db, only its disambiguation scalar flips to dismissed.

## Reproduction Result (fixture room, synthetic claims, scratch script)

| Run | source | session_id | surfacing_count of the 2 claims | disambiguation |
|-----|--------|------------|---------------------------------|----------------|
| 1 | compact | sess-A | 1, 1 | ambiguous |
| 2 | compact | sess-A | 2, 2 | ambiguous |
| 3 | compact | sess-A | 3, 3 | dismissed (hook output {"continue":true}) |

## How the model store counts (read of lib/memory/pending-tension-store.cjs)

evaluateAndDecay(roomSlug) drops a tension when surfacing_count >= 3 and the state is queued or surfaced. The count is incremented on each surfacing, not per session. The hook comment says it mirrors that store. So the store has the same granularity (per surfacing). The store is out of scope for this plan. The hook only needs a session-aware rule, because the hook fires on 3 different SessionStart sources.

## SessionStart input fields

The hook receives JSON on stdin with hook_event_name, session_id, transcript_path, cwd and source (startup, resume, clear or compact). Status: UNVERIFIED against the live docs in this run (no Context7 or web tool was available to the executor). The repo already builds synthetic payloads with session_id, hook_event_name and source (scripts/isolate-larry-voice.cjs SYNTHETIC_PAYLOAD). Also UNVERIFIED: whether a clear issues a new session_id. The rule below does not depend on it: a missing or unreadable session_id falls back to the old per-run count.

## Counting rule (decided)

One strike per distinct session_id. Each claim stores a scalar `last_strike_session_id` (string, at most 128 characters, no prose) in its properties. When the stored value equals the current session_id, add no strike and keep the claim in the active list. Otherwise add the strike and store the id. With no session_id in stdin, add one strike per run (the old behavior). The 3-strikes retire rule stays.

## Eliminated

- hypothesis: The matcher fires the hook more than once per event.
  evidence: hooks/hooks.json holds one entry for the script. The counts above rise by 1 per run, one run per event.
  timestamp: 2026-11-06T08:30:00Z

## Evidence

- timestamp: 2026-11-06T08:30:00Z
  checked: scripts/check-pending-ambiguous.cjs throttleAndCollect
  found: It reads surfacing_count, adds 1 for every row of QUEUE_SQL on every call, and sets disambiguation to dismissed at 3. It never reads stdin.
  implication: No per-session identity enters the count.
- timestamp: 2026-11-06T08:30:00Z
  checked: the reproduction table above
  found: 3 compact runs with one session_id dismiss both claims.
  implication: Root cause confirmed.

## Technical Root Cause

- Site: scripts/check-pending-ambiguous.cjs function `throttleAndCollect` (and `main`, which never reads the SessionStart stdin).
- Cause: The strike counter is incremented once per hook run. The hook runs for startup, clear and compact. A strike has no session identity, so repeats inside one session count as separate strikes.
- Why it surfaces now: Phase 150.8-03 copied the surfacing-count idea from the tension store, and the matcher includes compact and clear. The intent (3 sessions) was never encoded.

## Required Code Changes

- Change 1:
  - Location: scripts/check-pending-ambiguous.cjs, functions `main` and `throttleAndCollect`
  - Current behavior: one strike per run.
  - Required behavior: read stdin once with fs.readFileSync(0) inside try/catch (the repo pattern, with no wait on a TTY), take session_id as a bounded string, pass it to throttleAndCollect. Skip the strike when last_strike_session_id equals it. Store the id as a scalar. No session_id means the old per-run count. Keep scalar-only writes, the last_modified_at update, D-16 silence and the {continue:true} fallbacks.

## Tests to Add or Update

- Test 1:
  - Type: integration (child process on a fixture room)
  - Location: tests/test-386-check-pending-hooks.cjs
  - Given: a fixture room with 2 synthetic ambiguous claims
  - When: P1 3 runs with source compact and one session_id. P2 3 runs with 3 session ids. P3 3 runs without a session_id.
  - Then: P1 surfacing_count 1 and still ambiguous. P2 dismissed on run 3. P3 dismissed on run 3 (old behavior), no throw.
  - Runner registration: tests/run-all-386.sh discovers it by glob.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md are owned by plan 386-21. Do not edit them here.
- Follow-up (not fixed here): readActiveRoomDir in both hooks builds the room directory as path.join(roomsHome, reg.active). A nested sub-room (registry path differs from slug) does not resolve. lib/core/resolve-active-room.cjs registryRoomPath is the canonical derivation. Same class as finding B3.

## Resolution

root_cause: The strike counter in throttleAndCollect was incremented once per hook run and the hook never read the SessionStart session_id, so compactions and clears inside one session each added a strike.
fix: main reads the SessionStart stdin once (readSessionId, bounded string, null on TTY or fault). throttleAndCollect adds one strike per distinct session_id, stored as the scalar last_strike_session_id. A claim whose stored id equals the current id gets no strike and stays active. With no session_id the old per-run count applies.
verification: tests/test-386-check-pending-hooks.cjs P1 P2 P3 ok (RED showed P1 FAIL). tests/test-check-pending-ambiguous.cjs 10 checks passed. tests/test-ambiguous-queue.cjs and tests/test-120-02-scaffold.sh exit 0. bash tests/run-all-386.sh PASS=11 FAIL=0 at run time.
files_changed:
  - scripts/check-pending-ambiguous.cjs (readSessionId, throttleAndCollect, main)
  - tests/test-386-check-pending-hooks.cjs
commits: see the plan summary
