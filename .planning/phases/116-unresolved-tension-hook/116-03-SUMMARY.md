---
phase: 116-unresolved-tension-hook
plan: "116-03"
subsystem: decay-state-machine
tags: [tension-hook, decay, state-machine, jsonl-lww, three-strikes, canon-part-4, canon-part-8, canon-part-10-subclaim-3, graph-native]

# Dependency graph
requires:
  - phase: 116-00 (Wave 0 scaffold)
    provides: tension_decayed + tension_skipped EVENT_TYPES; Wave-0 decay test stub that this plan promotes to GREEN
  - phase: 116-01 (Wave 1 detection substrate)
    provides: lib/memory/pending-tension-store.cjs (appendTension + readTensions + markSurfaced + markResolved + markDropped + requeue + computeTensionId + jsonlPath) + scripts/preflight-tension-surface.cjs main() flow with pendingStore lazy-required + findSurfaceableTensions filter excluding terminal states
  - phase: 116-02 (Wave 2 F.1 surface)
    provides: lib/agents/tension-hook-agent.cjs handleUserResponse paths; Wave-2 LATER path correctly preserves surfacing_count (NOT decremented) so Wave-3 evaluateAndDecay pre-pass observes a faithful strike count
provides:
  - lib/memory/pending-tension-store.cjs evaluateAndDecay + getDecayCandidates (10 total exports = 8 from 116-01 + 2 from this plan)
  - scripts/preflight-tension-surface.cjs evaluateAndDecay pre-pass call before navigation query
  - tests/test-tension-hook-decay.cjs promoted from Wave-0 stub (3 substrate asserts) to 15 real assertions covering AC-4 + AC-5 (state machine + 3-strikes + cross-session JSONL replay + idempotency + concurrency)
affects: [116-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONL append-only LWW replay decay state machine: evaluateAndDecay scans the latest entry per tension_id (last-write-wins from RESEARCH 6.4) and writes state='dropped' transitions for the (surfacing_count >= 3 AND state IN ('queued','surfaced')) intersection. Idempotency falls out for free because 'resolved' and 'dropped' are excluded from the scan."
    - "Pre-dispatch decay pre-pass: scripts/preflight-tension-surface.cjs main() now calls pendingStore.evaluateAndDecay(roomSlug) IMMEDIATELY BEFORE navigation.findSurfaceableTensions. Dropped tensions are then filtered out by the existing 'exclude state IN (resolved, dropped)' clause that shipped in 116-01 findSurfaceableTensions per D-03b."
    - "Wave-3 -> Wave-4 telemetry contract handoff: evaluateAndDecay returns { droppedTensionIds: string[], evaluatedCount: number }. Wave 4 (116-04) will consume droppedTensionIds and emit one tension_decayed memory_event per id (per CONTEXT.md D-04b for Phase 121 trajectory-telemetry resolve-vs-decay ratio)."
    - "Cross-session JSONL durability simulation pattern (Test 11): mutate require.cache between session writes to prove the in-memory module state never carries forward, and reads in session N+1 see exactly what session N wrote. Establishes JSONL is the source of truth across SessionStart boundaries."
    - "Boundary case implicit-via-terminal-state: surfacing_count==3 AND markResolved BEFORE evaluateAndDecay -> state stays 'resolved'. Test 8 verifies the boundary by terminal-state filter alone (no special-case code in evaluateAndDecay) -- the simplest correct implementation of the D-03a rule."

key-files:
  created: []
  modified:
    - lib/memory/pending-tension-store.cjs (added 2 functions evaluateAndDecay + getDecayCandidates; added them to module.exports; 8 prior exports + 4 prior constants byte-identical)
    - scripts/preflight-tension-surface.cjs (added 5 lines: pre-pass call + comment block; pre-existing fs/path/os requires preserved at 3; pendingStore + navigation already lazy-required in main() from 116-01)
    - tests/test-tension-hook-decay.cjs (Wave-0 stub of 3 substrate asserts replaced with 15 real assertions; 385 LOC)

key-decisions:
  - "evaluateAndDecay terminal-state filter excludes 'resolved' AND 'dropped' from the scan, which makes the function idempotent on re-runs WITHOUT explicit state-tracking logic. Dropped tensions cannot be re-dropped because state='dropped' fails the (state === 'queued' || state === 'surfaced') guard. Resolved tensions cannot be re-dropped because state='resolved' fails the same guard. Falls out naturally from RESEARCH Section 11.2 rows 8 + 9."
  - "Pre-pass placement BEFORE navigation.findSurfaceableTensions (not after) is load-bearing: the navigation query filter already excludes state IN (resolved, dropped) per D-03b shipped in 116-01. Running evaluateAndDecay first ensures that the moment a tension crosses the 3-strikes threshold, its NEXT session start sees state='dropped' in the JSONL and findSurfaceableTensions correctly skips it. Running AFTER would leak a 4th surface."
  - "decayResult is captured via `void decayResult` in 116-03 because Wave 4 (116-04) will mirror droppedTensionIds to memory_event. The void assignment makes the variable explicitly intentional rather than letting a linter strip it. Wave 4 will replace `void decayResult` with a recordSelectorMirror call sequence."
  - "Test 11 (4-session simulation) uses delete require.cache + re-require between sessions to prove cross-session durability. This is more pessimistic than reality (real session boundaries also reset module state) but tighter than reality would be (real session boundaries also exit + re-spawn the process). The require.cache mutation is the most pessimistic in-process simulation we can run without spawning child processes; child-process simulation is unnecessary for the LWW invariant."
  - "Test 12 (concurrent-write smoke) asserts only the file remains parseable and surfacing_count lands in [1,2]. Per RESEARCH Section 11.4 INV-4 the race window is acceptable for v1; v1.13.x revisits if Cowork data shows real conflict pattern. The test guards against JSONL corruption (catastrophic) without over-specifying the race outcome (acceptable variance)."
  - "Plan executed exactly as written. Two tasks. No deviations. Acceptance criteria all green on first run. The decision-density of the plan (45+ lines per task with verbatim implementation pseudocode) made executor work mechanical."

requirements-completed: [TENSION-116-DECAY]
# TENSION-116-TELEMETRY remains for Wave 4 (116-04).

# Metrics
duration: 9min
completed: 2026-05-06
---

# Phase 116 Plan 116-03: Decay State Machine + Cross-Session JSONL Replay Summary

**Lands the D-03 / D-03a 3-strikes rule + cross-session JSONL replay verification + decay state machine pre-pass. The closed loop now decays gracefully: after 3 surfacings without resolution, the next SessionStart writes state='dropped' to JSONL ground truth before findSurfaceableTensions runs, so the dropped tension is filtered out at selection time and never wastes a 4th surface tax on the user. Boundary case (surfacing_count==3 AND user picks RESOLVE) preserved via the terminal-state filter falling out for free.**

## Performance

- **Duration:** ~9 minutes
- **Started:** 2026-05-06 (Wave-3 decay state machine)
- **Tasks:** 2 (both auto + tdd; plan said autonomous=true)
- **Files created:** 0
- **Files modified:** 3 (pending-tension-store.cjs +91 LOC; preflight-tension-surface.cjs +8 LOC; test-tension-hook-decay.cjs +385 / -26 = +359 net LOC)
- **Total Wave-3 LOC delta:** +458 / -26
- **Parallel-executor mode:** all 2 commits used --no-verify per orchestrator contract

## Accomplishments

- 2 new exports on `lib/memory/pending-tension-store.cjs`:
  - `evaluateAndDecay(roomSlug)` -- pre-pass that scans the LWW-replayed tension set and writes state='dropped' transitions for tensions where surfacing_count >= 3 AND state IN ('queued','surfaced'). Returns `{ droppedTensionIds: string[], evaluatedCount: number }`. Sync + never throws (try/catch envelope returns `{droppedTensionIds:[],evaluatedCount:0}` on any failure).
  - `getDecayCandidates(roomSlug)` -- read-only diagnostic returning the same candidate set without mutating JSONL. Useful for /mos:tension status diagnostics (out of scope v1; OQ-8) and Wave-4 telemetry trace inspection.
- `scripts/preflight-tension-surface.cjs` main() gains a 5-line pre-pass insertion BEFORE the navigation.findSurfaceableTensions call: `const decayResult = pendingStore.evaluateAndDecay(roomSlug); void decayResult;` plus a 3-line comment block explaining the Wave-4 telemetry handoff. No new top-level requires (pendingStore was already lazy-required in main() at 116-01). Tier 0 / db_not_initialized silence preserved.
- `tests/test-tension-hook-decay.cjs` promoted from Wave-0 stub (3 substrate asserts) to 15 real assertions across 4 coverage groups:
  - **State machine forward-pass (Tests 1-4):** queued -> markSurfaced -> state='surfaced' surfacing_count=1; queued -> markSurfaced -> markResolved -> state='resolved'; queued -> markSurfaced -> requeue -> surfacing_count NOT decremented; markSurfaced * 3 -> surfacing_count=3 state='surfaced'.
  - **3-strikes / decay (Tests 5-9):** evaluateAndDecay flips surfacing_count=3+state=surfaced to state='dropped'; evaluateAndDecay is idempotent on already-dropped (Test 6 returns evaluatedCount=0); 3-strikes threshold respected (Test 7 surfacing_count=2 -> evaluatedCount=0); boundary case (Test 8 surfacing_count=3 + markResolved BEFORE evaluateAndDecay -> state stays 'resolved'); getDecayCandidates is read-only (Test 9 verifies file-size unchanged).
  - **Cross-session simulation (Tests 10-12):** queued + close + re-read returns identical entry; 4-session simulation (write across sessions, evaluateAndDecay drops on session 4) using `delete require.cache` between session writes to prove module-state durability; concurrent-write smoke (2 parallel markSurfaced calls -> JSONL parses cleanly with surfacing_count in [1,2] per RESEARCH 11.4 INV-4 acceptable race window).
  - **Anti-pattern + module hygiene (Tests 13-15):** zero console.log / process.stdout.write in pending-tension-store.cjs; zero room-db.cjs require (Phase 109 D-06 chokepoint preserved); zero brain-client require (Canon Part 8 boundary preserved).
- 8-row state transition table from CONTEXT.md interfaces verified end-to-end via the 15-assertion suite. Boundary case (surfacing_count==3 + RESOLVE preserves resolved state) verified in Test 8.
- R1 byte-equal invariant preserved on `lib/hmi/shape-f6-renderer.cjs` (sha256 `1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`).
- Wave 0+1+2 sibling tests (54 assertions across 4 files: detection + persistence + f1-integration + rendering) still PASS unchanged.

## Task Commits

Each task was committed atomically with --no-verify (parallel executor mode):

1. **Task 1: Add evaluateAndDecay + getDecayCandidates + promote decay test to 15 real assertions** - `0e9d47c` (feat) - 456 insertions / 15 deletions
2. **Task 2: Wire evaluateAndDecay pre-pass into preflight-tension-surface.cjs** - `0ce19fa` (feat) - 8 insertions / 0 deletions

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Modified

### Modified (3 files, 0 created)

- `lib/memory/pending-tension-store.cjs` -- added 2 functions and 2 export lines. evaluateAndDecay (~30 LOC) wraps a try/catch around readTensions + a forEach loop that filters (surfacing_count >= 3 AND state IN queued|surfaced) and writes a new appendTension with state='dropped' last_response='DROPPED'. getDecayCandidates (~15 LOC) is the read-only diagnostic mirroring the same filter without the appendTension write. Anti-pattern guard preserved: zero room-db requires (Phase 109 D-06 chokepoint), zero brain-client requires (Canon Part 8 boundary), zero console.log / process.stdout.write calls (RESEARCH 13.9 telemetry side-channel rule). Total exports: 8 functions + 4 constants from 116-01 -> 10 functions + 4 constants now.
- `scripts/preflight-tension-surface.cjs` -- added 5 lines (pre-pass call + comment block). The pre-pass call is `const decayResult = pendingStore.evaluateAndDecay(roomSlug); void decayResult;` placed IMMEDIATELY BEFORE the existing navigation.findSurfaceableTensions call. The void assignment is intentional: Wave 4 (116-04) replaces it with a recordSelectorMirror sequence; the explicit void prevents linter/optimizer from stripping the variable. Pre-pass placement verified by awk ordering check: line 154 (evaluateAndDecay) < line 159 (findSurfaceableTensions). No new top-level requires (pendingStore + navigation lazy-required in main() at 116-01). Tier 0 silence preserved.
- `tests/test-tension-hook-decay.cjs` -- Wave-0 stub (3 substrate asserts at 26 LOC) replaced with 15 real assertions (385 LOC). Per-test temp roomSlug pattern (`'phase-116-03-decay-' + label + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex')`) mirrors test-tension-hook-persistence.cjs precedent so parallel test runs and real user data are both safe. cleanupSlug() in try/finally ensures JSONL files are always removed even on assertion failure.

## Decisions Made

- **Terminal-state filter idempotency.** evaluateAndDecay's `(state === 'queued' || state === 'surfaced')` guard makes the function idempotent on re-runs WITHOUT explicit state-tracking. Dropped tensions cannot be re-dropped because state='dropped' fails the guard. Resolved tensions cannot be re-dropped because state='resolved' fails the same guard. This is the simplest correct implementation per RESEARCH Section 11.2 rows 8 + 9.
- **Boundary case via terminal-state filter (not special-case code).** Test 8 verifies surfacing_count==3 + markResolved BEFORE evaluateAndDecay -> state stays 'resolved'. The reason it works: markResolved writes state='resolved' which is terminal; the subsequent evaluateAndDecay scan filters out resolved and writes nothing. No special-case code in evaluateAndDecay needed -- the boundary case falls out for free from the terminal-state filter. This is the most pedagogically clean implementation of the D-03a rule.
- **Pre-pass placement BEFORE navigation query (load-bearing).** The acceptance criteria's awk ordering check enforces that evaluateAndDecay runs BEFORE findSurfaceableTensions. Running AFTER would leak a 4th surface for any tension that crossed the 3-strikes threshold in the last session. Running BEFORE means findSurfaceableTensions sees the JSONL with state='dropped' already written and its D-03b filter (`exclude state IN (resolved, dropped)`) correctly skips it.
- **decayResult capture via `void decayResult` (Wave-4 handoff).** The void assignment makes the variable explicitly intentional. Wave 4 (116-04) replaces `void decayResult` with a `for (const tid of decayResult.droppedTensionIds) { recordSelectorMirror(roomDir, 'tension_decayed', { tension_id: tid }); }` block. The hook is structured so the future insertion is one block edit at a single line.
- **Test 11 4-session simulation via require.cache mutation.** Most pessimistic in-process simulation we can run without spawning child processes. Real session boundaries also exit + re-spawn the process; child-process simulation is unnecessary for the LWW JSONL durability invariant because LWW is purely filesystem-grounded. The require.cache mutation simulates module-state-reset, which is the strictest in-process variant; if the assertion holds under module-state-reset, it holds under process-exit + re-spawn a fortiori.
- **Test 12 concurrent-write smoke asserts surfacing_count IN [1,2].** Per RESEARCH Section 11.4 INV-4 the race window is acceptable for v1. The test guards against JSONL corruption (catastrophic, file unparseable) without over-specifying the race outcome (acceptable variance). v1.13.x revisits if Cowork data shows real conflict pattern.

## Deviations from Plan

None. Plan executed exactly as written. Two tasks, both auto + tdd, both acceptance criteria green on first run.

## Wave-3 -> Wave-4 Handoff

Wave 4 (116-04) wires the telemetry mirror that consumes evaluateAndDecay's return value:

- **At the suppression branches in `tension-hook-agent.cjs surfaceFinding`:** insert `recordSelectorMirror(roomDir, 'tension_detected', { ..., suppress_reason: 'tier_0' | 'just_talk' })` per CONTEXT.md D-04c / RESEARCH Pitfall 5.
- **On successful F.1 dispatch in surfaceFinding:** insert `recordSelectorMirror(roomDir, 'tension_surfaced', { tension_id, latency_ms, surfacing_count })`.
- **On user response paths in handleUserResponse:** insert `recordSelectorMirror(roomDir, 'tension_resolved' | 'tension_skipped' | 'tension_decayed', payload)`.
- **At the pre-pass return in scripts/preflight-tension-surface.cjs:** replace `void decayResult` with `for (const tid of decayResult.droppedTensionIds) { recordSelectorMirror(roomDir, 'tension_decayed', { tension_id: tid }); }`. This is the production path that emits tension_decayed for Phase 121 trajectory-telemetry resolve-vs-decay ratio.
- **Real assertions in `tests/test-tension-hook-telemetry.cjs`** (currently Wave-0 stub) replace the placeholder, covering AC-3 + AC-7 (Canon Part 8 substring audit on JSON.stringify(payload)).
- **v1.13.0-beta.5 release plumbing:** CHANGELOG bump, plugin.json version, marketplace ref. The decay state machine ground truth is shipped; Wave-4 mirrors it to telemetry without restructuring the agent or the hook.

## Anti-pattern Guard Verification

```
$ grep -E "require.*core/room-db" lib/memory/pending-tension-store.cjs scripts/preflight-tension-surface.cjs | wc -l
0  -- Phase 109 D-06 chokepoint preserved

$ grep -E "brain-client|brain_client" lib/memory/pending-tension-store.cjs scripts/preflight-tension-surface.cjs | wc -l
0  -- Canon Part 8 boundary preserved

$ grep -E "console\.log|process\.stdout\.write" lib/memory/pending-tension-store.cjs | wc -l
0  -- RESEARCH 13.9 telemetry side-channel rule (process.stdout.write in preflight-tension-surface.cjs is intentional via emitEnvelope helper)

$ grep -P "\x{2014}" lib/memory/pending-tension-store.cjs scripts/preflight-tension-surface.cjs tests/test-tension-hook-decay.cjs | wc -l
0  -- zero em-dashes across all 3 116-03 deliverables (memory rule feedback_no_emdashes)

$ node -e "const m=require('./lib/memory/pending-tension-store.cjs'); ['evaluateAndDecay','getDecayCandidates'].forEach(k=>{ if(typeof m[k]!=='function') throw new Error(k); }); console.log('OK new exports');"
OK new exports

$ node -e "const m=require('./lib/memory/pending-tension-store.cjs'); ['computeTensionId','jsonlPath','appendTension','readTensions','markSurfaced','markResolved','markDropped','requeue'].forEach(k=>{ if(typeof m[k]!=='function') throw new Error(k); }); console.log('OK 8 prior exports preserved');"
OK 8 prior exports preserved

$ awk '/evaluateAndDecay\(roomSlug\)/{e=NR} /findSurfaceableTensions/{f=NR} END{if(e==0||f==0||e>=f) exit 1; print "OK e="e" f="f}' scripts/preflight-tension-surface.cjs
OK e=154 f=159  -- pre-pass call ordered correctly BEFORE navigation query

$ MINDRIAN_ROOM_DIR=/tmp/missing-decay-$$ node scripts/preflight-tension-surface.cjs
{"continue":true}  -- Tier 0 still silent after decay wiring

$ node -e "const o=JSON.parse(require('node:fs').readFileSync('hooks/hooks.json','utf8')); console.log('SessionStart len:'+o.hooks.SessionStart.length);"
SessionStart len:7  -- hooks.json non-regression

$ node --test tests/test-tension-hook-decay.cjs 2>&1 | grep -E "^# (tests|pass|fail)"
# tests 15
# pass 15
# fail 0

$ node --test tests/test-tension-hook-detection.cjs tests/test-tension-hook-persistence.cjs tests/test-tension-hook-f1-integration.cjs tests/test-tension-hook-rendering.cjs tests/test-tension-hook-decay.cjs 2>&1 | grep -E "^# (tests|pass|fail)"
# tests 69
# pass 69
# fail 0
```

## R1 Invariant Confirmation

```
$ sha256sum lib/hmi/shape-f6-renderer.cjs
1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf  lib/hmi/shape-f6-renderer.cjs
```

Phase 101-01 R1 byte-equal preserved across this plan.

## Canon Part 8 Boundary Confirmation

- `lib/memory/pending-tension-store.cjs`: zero Brain client imports verified by grep; the storage substrate is graph-LOCAL throughout (per CONTEXT line 144: "Phase 116 has NO direct dependency on Phase 110 -- it stays graph-LOCAL throughout"). Reads + writes route through filesystem JSONL only; zero outbound network surface.
- `scripts/preflight-tension-surface.cjs`: zero new requires; pre-existing fs/path/os top-level requires preserved at 3. Reads route through lib/core/navigation.cjs (Phase 109 D-06 chokepoint). The pre-pass insertion adds zero new modules to the hook's dependency surface.
- The dropped-state JSONL entries carry only enum scalars + sha256 hashes + integers + ISO timestamps (state='dropped', last_response='DROPPED', tension_id:32-hex, all inherited fields from the prior LWW entry). Zero user-content strings.

## D-03a State Machine Confirmation

| Current state | Trigger | Next state | Verified by Test |
|---------------|---------|------------|------------------|
| (none) | findSurfaceableTensions returns candidate | queued | (Wave 1; verified in 116-01-SUMMARY) |
| queued | session start picks it | surfaced | Test 1 |
| surfaced | user picks Resolve | resolved | Test 2 |
| surfaced | user picks Later | queued (surfacing_count NOT decremented) | Test 3 |
| surfaced | user picks Skip | surfaced (no change) | (Wave 2; verified in 116-02-SUMMARY) |
| surfaced | user dismisses | queued (no transition until next session start) | (implicit; no JSONL write) |
| queued | session start sees surfacing_count >= 3 | dropped | Test 5 (load-bearing 3-strikes) |
| resolved | (any) | resolved (terminal) | Test 8 (boundary case) |
| dropped | (any) | dropped (terminal) | Test 6 (idempotency) |

## D-03b Selection Priority Order Confirmation

The CONTEXT.md D-03b selection order is (1) CONTRADICTS edges sorted by created_at DESC excluding surfacing_count >= 3 OR state IN (resolved, dropped); (2) CONVERGES edges same sort + filter; (3) silent. Wave 1's findSurfaceableTensions implemented (1) and (2) with the exclude-terminal-states filter. This plan's evaluateAndDecay pre-pass ensures the JSONL state IS UP TO DATE before findSurfaceableTensions reads it -- closing the temporal gap that would have existed if a tension crossed the 3-strikes threshold mid-session.

## Self-Check: PASSED

**Modified files (3) verified on disk:**
- FOUND: lib/memory/pending-tension-store.cjs (2 new exports, 8 prior preserved, syntax check OK)
- FOUND: scripts/preflight-tension-surface.cjs (pre-pass at line 154, navigation query at line 159)
- FOUND: tests/test-tension-hook-decay.cjs (385 LOC, 15/15 tests PASS)

**Commits verified in git log:**
- FOUND: 0e9d47c (Task 1: evaluateAndDecay + getDecayCandidates + 15-assertion decay test)
- FOUND: 0ce19fa (Task 2: pre-pass wiring into preflight-tension-surface.cjs)

**Verification gates (10 of 10 GREEN):**
- 15/15 decay tests PASS
- 69/69 cumulative Wave 0+1+2+3 tests PASS together
- 2 new exports landed (evaluateAndDecay + getDecayCandidates)
- 8 prior exports preserved (regression check green)
- Pre-pass call ordered BEFORE navigation query (awk check: e=154, f=159)
- Tier 0 silence preserved (MINDRIAN_ROOM_DIR=/tmp/missing -> {"continue":true})
- hooks.json SessionStart len=7 (no regression on 116-01 wiring)
- Phase 109 navigation closed surface preserved (7 functions intact)
- 4 anti-pattern greps return 0 (room-db, brain-client, console-in-store, em-dashes)
- R1 byte-equal preserved (sha256 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf)

---
*Phase: 116-unresolved-tension-hook*
*Completed: 2026-05-06*
