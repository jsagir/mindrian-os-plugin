---
status: awaiting_human_verify
kind: rca
trigger: "intent-classifier-hook-timeout"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8, 9]
created: 2026-11-09T21:55:00Z
updated: 2026-11-09T22:58:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ fb91d2dc2 (2.0.0-beta.82), worktree /home/jsagi/gsd-workspaces/hook-timeout/MindrianOS-Plugin, branch quick/261109-intent-classifier-timeout. The owner's terminal ran the install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.81`; `scripts/intent-classifier`, `scripts/intent-classifier.cjs`, `scripts/resolve-room`, `scripts/minto-drain-on-prompt.cjs` and `hooks/hooks.json` are byte-identical between the cache and HEAD (diff -q, 2026-11-09), so the measurements on either tree describe the same code.
- **WIRE claims probe against:** none. The hook path makes no Brain call (brain-client.isAvailable() is a cached scalar; the io-trace recorded zero net.connect calls).
- **Date of audit:** 2026-11-09
- **Re-verification rule:** every source-code claim below is read against `origin/main` HEAD fb91d2dc2.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED and FIXED in the worktree (see Technical Root Cause and Resolution). The reach-reject penalty fold re-issued one full scan of room.db 29 to 48 times per prompt; with the room on /mnt/c (9p) every scan was a host round trip; no timer could interrupt the synchronous calls; machine load multiplied the latency.
test: RED test went RED (47 reads) on HEAD and GREEN (2 reads) after; interleaved A/B of the install cache (before) against the worktree (after) on the real 9p room, on an ext4 copy, with and without 2 busy loops.
expecting: the human confirms, in a live session on this machine, that the UserPromptSubmit hook no longer times out and the NAVIGATION DECISION block is present each turn; then the two open decisions (the Phase 345-03 require cycle, the 5 s timeout) get a ruling.
next_action: human verification in the owner's real session; then archive to .planning/debug/resolved/ and add the knowledge-base block.

reasoning_checkpoint:
  hypothesis: "scripts/intent-classifier.cjs:2737 calls lib/workflow/reach-reject-reader.cjs computeReachPenalties, which calls presentationsCount and rejectCountInWindow up to 8 times per reach id for 6 reach ids; every call runs navigation.findRecentChanges, a full scan of the 14,082 memory_event rows (json_extract has no index; plan: SEARCH nodes USING INDEX idx_nodes_type + TEMP B-TREE FOR ORDER BY); the room.db is on /mnt/c (9p drvfs) so every scan re-reads about 17 MB across the WSL2 host boundary, 200 to 3,600 ms per scan under load; 29 scans took 11,333 ms of a 12,451 ms run. The NAV_HARD_TIMEOUT_MS race cannot stop synchronous sqlite calls, so nothing bounds the fold."
  confirming_evidence:
    - "io-trace on the real room: sqlite.stmt.all 11,332.7 ms over 45 calls in a 12,451 ms run (91 percent); user CPU 580 ms, sys 829 ms; fsRead 290,300 block reads."
    - "stack-trace preload: the same SQL ran 29 times from reach-reject-reader.cjs:149/200/230 via computeReachPenalties, called at intent-classifier.cjs:2737; only 6 distinct parameter sets."
    - "Controlled experiment, same code, same db bytes, same load (about 12): ext4 copy 754 to 1,243 ms wall (5 runs), the 45 stmt.all calls 459 ms; /mnt/c 9,774 to 28,268 ms wall (5 runs). Only the filesystem changed."
    - "direct-1.out shows a full NAVIGATION DECISION block after a 3,643 ms single statement: the 1,200 ms race did not take effect, which matches callDecideWithTimeout running decide() synchronously on setImmediate."
  falsification_test: "If the hook on the ext4 copy also took 10 s or more, or if the stack-trace showed the 29 calls coming from a different site, or if the fixed reader still issued more than 2 chokepoint reads per computeReachPenalties call, the hypothesis is wrong."
  fix_rationale: "Reading reach_presented and f_selector_decision once each (limit 200, since 0) and deriving the six per-reach counts in memory reproduces the exact semantics of the per-reach readers (the newest 200 rows newer than a floor equal the newest 200 rows overall filtered to createdAt > floor, because every row newer than the floor sorts before every row older than it), and cuts the scans from 29 to 2. The time guard skips the fold when the engine already spent its own 1,200 ms envelope, so a slow filesystem or a loaded machine degrades to the documented un-discounted render instead of a lost turn."
  blind_spots: "Not measured on an idle machine (load 8 to 56 during every run). Not measured on Windows Git Bash or macOS. The 2 remaining scans still grow with the memory_event count (the hook writes 2 events per prompt); the structural follow-up (an expression index or a created_at-ordered plan, and memory_event retention) is proposed, not shipped."

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (dev tree, not touched); work in the worktree /home/jsagi/gsd-workspaces/hook-timeout/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.81 installed; 2.0.0-beta.82 at origin/main HEAD
- Reported by: owner's terminal, 2026-11-09
- Date first observed: 2026-11-09
- Related debug sessions: folder-memory-eager-timeline-runner-widens-guard-dependencies (386 LZ5 module counts), 379-1-1-10-large-room-drain-clock-breach, resolve-active-room-cross-session-bleed

## Problem Statement

The UserPromptSubmit hook `intent-classifier` timed out at its declared 5 s during a session with many agents and two pytest suites on the machine. The per-turn NAVIGATION DECISION block was lost for that turn.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: the hook returns its NAVIGATION DECISION block within the 5 s budget on every prompt; the 2026-10-29 baseline fixture records p50 37.6 ms, p95 39.3 ms, max 42.2 ms for this hook in an idle sandbox with no room.
actual: `UserPromptSubmit hook ["${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" intent-classifier] timed out after 5s - output discarded. Raise the hook's "timeout" to allow more time.`
errors: the Claude Code timeout message above; no hook stderr was captured.
reproduction:
  1. Session on this machine with 6 to 8 agents and two 2,000-test pytest suites running (load average reached 24 on 12 cores).
  2. Submit a prompt in a Claude Code session with the mos plugin (beta.81) installed.
  3. Observe the timeout message; the NAVIGATION DECISION block is absent from that turn.
started: observed 2026-11-09 under heavy load; not observed in the idle baseline of 2026-10-29.

## Scope and Impact

- Affected surfaces: cli (hooks run only on the CLI surface)
- Affected commands: every prompt turn (UserPromptSubmit); the NAVIGATION DECISION block and the F8 selector output for that turn
- Affected users: every CLI install whose active room has a large memory_event table; severe when the room lives on a slow or remote filesystem (WSL2 /mnt/c, a network share); worse under machine load
- Version range: 2.0.0-beta.81 (observed) to 2.0.0-beta.82 (HEAD, same hook bytes); the fold shipped in Phase 158-03 (commit 736986ccf)
- Severity: high (the turn loses navigation; nothing is corrupted)
- Blast radius: any caller of computeReachPenalties (only the hook today); the other 7 UserPromptSubmit hooks do not open room.db in this way (not measured individually)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: (a) machine load alone pushed a normally sub-second hook past 5 s
  evidence: under the same load (about 12) the same code against the same db on ext4 took 754 to 1,243 ms; load is a multiplier (2x to 7x on 9p latency: 9.8 s at load 17, 28 s at load 28, 70 s at load 56), not the cause. The idle no-room baseline is 37 ms; the bound-room path is never sub-second on 9p.
  timestamp: 2026-11-09T22:05:00Z

- hypothesis: (b) a heavy cold load (large require graph, eager Part 8 guard or navigation engine, a model file)
  evidence: 216 modules in require.cache (171 repo, 45 node_modules); the slowest require was navigation-engine.cjs at 49 ms; the main module's synchronous phase took 1,345 ms of a 12,036 ms run and the rest was the async engine phase; part8-egress-guard.cjs is not loaded; node start is 32 to 45 ms; graph-derive-vectors.json (921 KB) is not read by this hook (all /mnt/c readFileSync calls together: 40 ms, 14 files).
  timestamp: 2026-11-09T22:05:00Z

- hypothesis: (c2) a room.db write lock held by another process (a second session's classifier on the same active room)
  evidence: the io-trace shows all time inside stmt.all SELECT statements, not in the 4 run() writes (109 ms) or open (33 ms); a busy wait would appear on the writes; sqlite.open with timeout 5000 took 16 ms each.
  timestamp: 2026-11-09T22:08:00Z

- hypothesis: (c3) a network probe or child process with a long timeout
  evidence: io-trace recorded 0 net.connect, 0 spawnSync/execSync; the only child is the detached minto regen spawn, which did not fire (no drained queue entries).
  timestamp: 2026-11-09T22:08:00Z

- hypothesis: (c4) the 9p filesystem alone (directory scans and JSON reads on /mnt/c)
  evidence: all fs calls on /mnt/c together cost 281 ms (statSync 98 ms over 35 calls, existsSync 79 ms over 31, readFileSync 40 ms over 14, mkdirSync 22 ms over 5); the 9p cost that matters is the sqlite page reads inside the repeated scans, not the fs calls.
  timestamp: 2026-11-09T22:10:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-09T21:54:00Z
  checked: /proc/loadavg, nproc, free -m at the start of this session
  found: load average 9.82 / 7.85 / 4.15 on 12 cores, 17.9 GB RAM, 1.0 GB free, 9.2 GB cache; node v22.23.1; ps shows a second intent-classifier.cjs from /home/jsagi/dev/MindrianOS-Plugin-release at 77 percent CPU, two find processes, a check script at 97 percent and codex processes
  implication: the machine is not idle now; every number below is "as loaded now", with the load recorded next to it.

- timestamp: 2026-11-09T21:56:00Z
  checked: hooks/run-hook.cmd, scripts/intent-classifier, hooks/hooks.json:340-348
  found: run-hook.cmd execs `bash scripts/intent-classifier`; the shim runs `scripts/resolve-room` (bash plus python3 to parse the registry) and then `exec node scripts/intent-classifier.cjs`; the hook timeout is 5 (seconds). There is no hooks/intent-classifier file on HEAD.
  implication: one prompt costs bash + bash + python3 + node process starts (about 100 ms together) before the classifier runs its first line.

- timestamp: 2026-11-09T21:57:00Z
  checked: tests/fixtures/369/hook-cold-start-baseline.json
  found: intent-classifier p50 37.6 ms, p95 39.3 ms, max 42.2 ms, n 10, measured 2026-10-29 in a throwaway sandbox (no room, no registry)
  implication: the baseline measures the no-room early-exit path, not the bound-room path a real session runs.

- timestamp: 2026-11-09T21:59:00Z
  checked: 5 cold runs of the real command on the beta.81 install cache, cwd /home/jsagi, stdin the UserPromptSubmit payload (scratchpad time-hook.sh)
  found: 28,268 / 18,853 / 9,774 / 10,459 / 12,900 ms wall, rc 0 each, stdout 1,512 then 329 bytes; load 27.95 before, 17.29 after
  implication: reproduced; 2x to 5.6x over the 5 s budget on every run.

- timestamp: 2026-11-09T22:00:00Z
  checked: scripts/resolve-room /home/jsagi and ~/MindrianRooms/.rooms/registry.json
  found: the active room is /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab (58 rooms registered); /mnt/c is a 9p drvfs mount (cache=0x5, msize 65536); room.db is 17,215,488 bytes, WAL mode, 4,218 pages of 4,096 bytes
  implication: every sqlite page read crosses the WSL2 host boundary; a fresh process has no page cache.

- timestamp: 2026-11-09T22:01:00Z
  checked: node -e 0, bash -c true, python3 -c pass, scripts/resolve-room, 5 runs each
  found: node 31 to 45 ms, bash 4 ms, python3 34 to 38 ms, resolve-room 46 to 52 ms
  implication: process starts are not the cost.

- timestamp: 2026-11-09T22:03:00Z
  checked: 3 direct runs of node scripts/intent-classifier.cjs with bash time (worktree HEAD, real room)
  found: real 15.3 s user 0.81 s sys 1.32 s; real 10.2 s user 0.80 s sys 0.95 s; real 70.5 s user 0.77 s sys 11.0 s (load rose to 56 during run 3)
  implication: the process computes for under 1 s and waits for the rest; the high sys time is kernel I/O.

- timestamp: 2026-11-09T22:04:00Z
  checked: count-modules preload (Module._load wrapper) on the worktree against the real room
  found: 216 files in require.cache (171 repo, 45 node_modules, 179 builtin requires); node:sqlite loaded; slowest requires navigation-engine.cjs 49 ms, navigation.cjs 41 ms, minto-debouncer.cjs 27 ms; main module synchronous phase 1,345 ms; process 12,036 ms
  implication: the require graph costs well under 1 s; the time is in the async engine phase.

- timestamp: 2026-11-09T22:06:00Z
  checked: io-trace preload (fs sync, node:sqlite, child_process, net wrappers) on the real room
  found: wall 12,451 ms, user 580 ms, sys 829 ms, fsRead 290,300; sqlite.stmt.all 11,332.7 ms over 45 calls; stmt.get 382 ms over 34; stmt.run 109 ms over 4; all /mnt/c fs calls 281 ms; 0 net.connect; 0 sync child spawns; the slowest single statements 3,643 / 805 / 760 / 462 ms, all the same SELECT on nodes WHERE type = 'memory_event' with json_extract(event_type)
  implication: one repeated statement is 91 percent of the run.

- timestamp: 2026-11-09T22:09:00Z
  checked: the same hook against an ext4 copy of the room (cp to the scratchpad, private registry via MINDRIAN_ROOMS_HOME), 5 cold runs plus io-trace; load 12.2 before, 11.8 after
  found: 1,243 / 754 / 844 / 820 / 812 ms wall; io-trace wall 760 ms, user 540 ms, sys 195 ms, fsRead 0, the same 45 stmt.all calls 459 ms
  implication: same code, same bytes, same load; the filesystem is the 25x multiplier on the repeated scans. The hook is also never 37 ms with a bound room: 0.75 to 1.24 s is the ext4 floor on HEAD.

- timestamp: 2026-11-09T22:12:00Z
  checked: stack-trace preload (StatementSync.all/get wrapper with repo-frame stacks) on the ext4 copy
  found: SQL `SELECT n.id, json_extract(n.properties, '$.event_type') ..., n.properties FROM nodes n WHERE n.type = 'memory_event' AND n.created_at > ? AND json_extract(n.properties, '$.event_type') = ? ORDER BY n.created_at DESC LIMIT ?` ran 29 times, 6 distinct parameter sets, from lib/core/navigation/memory-events.cjs:926 (findRecentChanges) via lib/workflow/reach-reject-reader.cjs:149 (presentationsCount), :200 and :230 (rejectCountInWindow), via :270/:300/:303 (countPenalty, isHardSuppressed) and :338/:346 (computeReachPenalties), called from scripts/intent-classifier.cjs:2737
  implication: the repeat is structural in computeReachPenalties, not data dependent.

- timestamp: 2026-11-09T22:13:00Z
  checked: room.db schema and counts (read-only, on the ext4 copy); EXPLAIN QUERY PLAN of the statement
  found: nodes 14,749 rows, 14,082 of them memory_event (2.16 MB of properties); indexes on nodes: type, review_status, source_path, created_by, created_at, last_seen_at, two partial indexes; no index covers json_extract(properties, '$.event_type'); plan: `SEARCH n USING INDEX idx_nodes_type (type=?)` then `USE TEMP B-TREE FOR ORDER BY`; event_type distribution: reach_presented 5,573, gate_reached 1,858, feynman_timeline_refreshed 1,597, dial_memory_refreshed 1,587, brain_egress_allowed 1,184, spine_read 838, brain_egress_blocked 763
  implication: every call walks all memory_event rows and reads every properties blob (95 percent of the table pages) to find 200 rows; the hook itself writes reach_presented and gate_reached on every prompt (lines 2700 to 2720), so each prompt makes the next scan larger.

- timestamp: 2026-11-09T22:14:00Z
  checked: scripts/intent-classifier.cjs:1994-2030 callDecideWithTimeout, :2446-2462, :2541
  found: decide() runs synchronously inside setImmediate and the 1,200 ms arm is a timer; Promise.race resolves with the decision because the timer callback cannot run while the synchronous work holds the loop; elapsedMs is computed after decide at :2541 and is not consulted before the penalty fold at :2730-2760
  implication: the hook's own envelope does not bound synchronous sqlite work; a time check before the fold is the only place to degrade.

- timestamp: 2026-11-09T22:30:00Z
  checked: tests/test-261109-intent-classifier-query-count.cjs on unmodified HEAD, first with navigation.cjs required before the reader, then with the reader required first (the hook's order)
  found: navigation-first: the reader returned 0 for every read and made 0 chokepoint calls (vacuous pass); reader-first: 47 findRecentChanges calls per computeReachPenalties with 2 distinct parameter sets (RED as intended)
  implication: the pin is honest only in the hook's load order; the test now loads the reader first and asserts the reader is alive before trusting a count.

- timestamp: 2026-11-09T22:32:00Z
  checked: Module._load trace of `require('lib/core/navigation.cjs')` in a fresh process; bash tests/run-all-158.sh on unmodified HEAD; node tests/test-159-integration-2turn-suppress.cjs on HEAD
  found: a require cycle navigation.cjs > navigation/calibration-log.cjs > workflow/f-selector-ranker.cjs > core/navigation-engine.cjs > core/strategy/strategy-throttle.cjs > workflow/reach-reject-reader.cjs > navigation.cjs; the reader captures the placeholder {} export (navigation.cjs reassigns module.exports at :84), so when navigation.cjs loads first every reader call returns 0 silently; on HEAD 4 of 11 Phase 158 suites FAIL (presentation-counter, reject-only, orchestrator-pure, part8-no-reason) and test-159-integration-2turn-suppress fails ("N=3 REAL rejects; got 0"); the cycle dates from Phase 345-03 (cc73dff63, strategy-throttle.cjs requires the reader); the knowledge base has no entry for it; the hook is not affected because it requires navigation-engine (hence the reader) before navigation.cjs is in its cache, which the 29 live reads in the stack trace confirm
  implication: a SECOND, pre-existing defect (classified NEW FAILURE, filed below as a follow-up, not fixed here): in any process that loads navigation.cjs first (the MCP server is the likely case) the reach penalty fold is silently inert. Waking it is a behavior change that needs a human call.

- timestamp: 2026-11-09T22:40:00Z
  checked: the new test after the two source changes; tests/test-369-hook-require-graph.cjs; bash tests/run-all-158.sh; the related suites (159 x2, 345-cooldown, 222-readonly-rank, six classifier suites)
  found: new test PASS 5 of 5 (reads per fold 2, parity with the per-reach readers, guard predicate, fold site gated); 369 PASS 5 of 5 (415 reachable files, 0 TypeScript, baseline p95 below timeout for 45 entries); 158: the same 4 pre-existing failures and no new failure; related suites: identical results to HEAD (159 integration and 222 readonly-rank fail on HEAD and after, the rest pass); no em-dashes in the changed files
  implication: the fix is green on its own test and changes no other suite's outcome.

- timestamp: 2026-11-09T22:48:00Z
  checked: bash tests/run-all-386.sh after the fix
  found: Phase 386: PASS=37 FAIL=0 SKIP=0 (LZ5 fresh-process module counts for the guard, the hook and the statusline unchanged; LZ6 passes)
  implication: the Part 8 hardening pins are untouched.

- timestamp: 2026-11-09T22:50:00Z
  checked: count-modules preload, install cache (before) and worktree (after) on the same ext4 room
  found: before 217 files in require.cache (172 repo, 45 node_modules, 182 builtin requires); after 217 (172, 45, 182); the earlier 216 on the /mnt/c room is room dependent (one lazy module), not fix dependent
  implication: the fix adds no module to the hook's cold load.

- timestamp: 2026-11-09T22:52:00Z
  checked: io-trace after the fix, real 9p room (load about 12)
  found: wall 2,467 ms, user 218 ms, sys 292 ms, fsRead 43,639 (was 290,300); sqlite.stmt.all 924 ms over 18 calls (was 11,333 ms over 45); stmt.get 621 ms over 34; stmt.run 125 ms over 4 but one INSERT of a memory_event took 1,339 ms in a second run; the slowest single statements are now one each: the two reader scans (708, 639 ms), the room-home claims read (703 ms), the dedupe lookup (684 ms), `SELECT id FROM nodes WHERE source_section = ?` (646 ms, no index on source_section), the two memory_event INSERTs (1,339 and 372 ms, WAL on 9p)
  implication: no single hotspot remains; the floor on a 9p room is 6 to 8 statements at 200 to 1,300 ms each, a structural property of room.db on /mnt/c with unindexed reads and per-prompt writes (the proposed phase).

- timestamp: 2026-11-09T22:55:00Z
  checked: interleaved A/B, install cache beta.81 (before, byte-identical hook) against the worktree (after), real command through run-hook.cmd, fresh process each run
  found: real 9p room, load 10.98 to 13.53, no extra load: before 17,617 / 13,053 / 11,452 / 12,239 / 16,733 ms; after 4,835 / 2,744 / 2,424 / 2,352 / 3,238 ms (every before run over 5,000 ms; every after run under it; 4.5x to 5.2x). ext4 copy, load 10.6: before 918 / 634 / 968 / 951 / 959 ms; after 350 / 364 / 387 / 636 / 521 ms. real 9p room plus 2 busy loops (node while(1)), load 10.8 to 12.6: before 21,615 / 19,267 / 18,913 ms; after 3,760 / 4,440 / 3,817 ms (slowdown factor of the 2 loops about 1.4x before, 1.3x after). ext4 copy plus busy loops (4 loops: 2 strays from the previous arm plus 2 new; the strays were found and killed afterwards), load 12.3: before 784 / 836 / 777 ms; after 427 / 387 / 464 ms. First reproduction earlier (cache only, load 28 falling to 17): 28,268 / 18,853 / 9,774 / 10,459 / 12,900 ms.
  implication: the dominant cause is removed; on a /mnt/c room at load 12 to 13 the after-fix worst case is 4.8 s, inside the 5 s budget with little margin; at the incident's load 24 a /mnt/c room may still breach until the structural phase lands or the room moves to the Linux filesystem (ext4 after: 0.35 to 0.64 s).

## Technical Root Cause

- Site: lib/workflow/reach-reject-reader.cjs:328-362 function `computeReachPenalties`, through `presentationsCount` (:143-167) and `rejectCountInWindow` (:184-250); the consumer is scripts/intent-classifier.cjs:2730-2760 (the Phase 158-03 penalty fold); the scan is lib/core/navigation/memory-events.cjs:909-935 `findRecentChanges`.
- Cause: computeReachPenalties calls isHardSuppressed, countPenalty and isHardSuppressed again for each of 6 reach ids; each of those calls presentationsCount and rejectCountInWindow, and each of those re-issues findRecentChanges with the same parameters (since 0, eventType reach_presented, limit 200; and the f_selector_decision read). That is 29 to 48 identical full scans of the memory_event rows per prompt. findRecentChanges filters on json_extract(properties, '$.event_type'), which no index covers, so each scan reads every memory_event properties blob (14,082 rows, about 95 percent of a 17 MB file) and sorts in a temp b-tree. The calls are synchronous, so the NAV_HARD_TIMEOUT_MS race cannot interrupt them.
- Why it surfaces now: the room is large (14,082 memory_event rows after 6 weeks; the hook adds 2 per prompt), the active room lives on /mnt/c (9p drvfs: every page read is a host round trip and a fresh process has no page cache), and the machine was under heavy load (9p latency rose 2x to 7x). On ext4 the same scans cost 459 ms and the hook stayed inside 5 s, which is why the idle baseline (no room) and the ext4 rooms never showed it.

## Required Code Changes

- Change 1:
  - Location: lib/workflow/reach-reject-reader.cjs, function `computeReachPenalties` (:328-362), new helper `precomputeReachCounters`
  - Current behavior: each per-reach reader call re-reads room.db through navigation.findRecentChanges (29 to 48 scans per call of computeReachPenalties).
  - Required behavior: read reach_presented once and f_selector_decision once (since 0, limit 200, through the navigation chokepoint), derive presentationsCount and rejectCountInWindow for all 6 reach ids in memory with the same semantics, and pass them to the per-reach readers through the shipped roomState injection seam (a derived object; the caller's roomState is not mutated and caller-supplied counters win). Result: 2 scans per call.
  - Short-term patch: the same as the required behavior (it is small).
  - Long-term fix: see Non-Code Follow-ups (index or plan change in findRecentChanges, memory_event retention).
- Change 2:
  - Location: scripts/intent-classifier.cjs:2730-2760 (the penalty fold), new exported predicate `shouldSkipReachPenalties(elapsedMs)`
  - Current behavior: the fold runs whenever roomDb is open and cortexNodes is non-empty, regardless of elapsed time.
  - Required behavior: skip the fold when the engine phase has already spent its own envelope (elapsedMs >= NAV_HARD_TIMEOUT_MS); the render degrades to the documented un-discounted reach list (the same path the existing catch already uses) instead of adding synchronous scans to a turn that is already slow.
  - Short-term patch: the same.
  - Long-term fix: a process-wide deadline for the hook (one clock from process start) is a design change for a phase, not this quick.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-261109-intent-classifier-query-count.cjs
  - Given: a fresh room.db (openRoomDb) seeded through navigation.logMemoryEvent with reach_presented and reject f_selector_decision rows for the 6 reach ids; navigation.findRecentChanges wrapped with a counter
  - When: reader.computeReachPenalties(db, { reachScores: six finite priors })
  - Then: findRecentChanges is called at most 2 times (RED on HEAD: 29 or more); the result equals the reference computed with the per-reach public readers (parity); the predicate shouldSkipReachPenalties is false below NAV_HARD_TIMEOUT_MS and true at or above it; the fold site in scripts/intent-classifier.cjs consults the predicate
  - Runner registration: standalone node test; add to the hook's own test list in the next release gate sweep
- Test 2 (not added, proposed):
  - Type: integration
  - Location: tests/fixtures/369/hook-cold-start-baseline.json plus scripts/measure-hook-cold-start.cjs
  - Given: a bound room fixture with 10,000 memory_event rows
  - When: the baseline is measured
  - Then: intent-classifier p95 stays below its timeout on the bound-room path, not only the no-room path

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the next version (the fix is in the worktree; the release session adds the entry at cut time).
- Release lockstep: the fix ships through scripts/release.sh; nothing in this RCA bumps a version by hand.
- Proposed phase (design, not this quick): (1) make findRecentChanges use a plan that stops early (ORDER BY created_at DESC through idx_nodes_created_at, or an expression index on json_extract(properties, '$.event_type') for type = 'memory_event', shipped as a room-db migration); (2) memory_event retention or roll-up (the hook writes reach_presented and gate_reached on every prompt; 7,431 such rows in 6 weeks); (3) a bound-room entry in the 369 cold-start baseline.
- knowledge-base.md: on resolve, add the summary block.
- Canon: Part 9 unchanged (every read stays on the navigation chokepoint); Part 8 unchanged (no Brain wire in this path).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: computeReachPenalties (lib/workflow/reach-reject-reader.cjs, Phase 158-03) re-issued the same unindexed full scan of the 14,082 memory_event rows 29 to 48 times per prompt through synchronous sqlite calls that the NAV_HARD_TIMEOUT_MS timer cannot interrupt; with room.db on /mnt/c (9p drvfs) each scan re-read about 17 MB across the WSL2 host boundary (11.3 s of a 12.5 s run), and machine load multiplied the per-scan latency 2x to 7x, so the 5 s UserPromptSubmit budget was lost together with the NAVIGATION DECISION block.
fix: (1) lib/workflow/reach-reject-reader.cjs: new precomputeReachCounters reads reach_presented once and f_selector_decision once through the navigation chokepoint and derives the six per-reach counts in memory with identical semantics; computeReachPenalties feeds them to the per-reach readers through the shipped roomState injection seam (2 scans per fold instead of 29 to 48; the caller's roomState is not mutated; caller-supplied finite counters win). (2) scripts/intent-classifier.cjs: shouldSkipReachPenalties(elapsedMs) skips the fold when the engine phase has already reached NAV_HARD_TIMEOUT_MS (fresh clock at the fold), degrading to the documented un-discounted render instead of losing the turn; the predicate and the constant are exported. (3) tests/test-261109-intent-classifier-query-count.cjs: RED-then-GREEN pin (reads per fold at most 2), parity with the per-reach readers, the guard predicate, the fold-site gate, and an anti-vacuous "reader is alive" check in the hook's load order. The hooks.json timeout is unchanged at 5 s.
verification: node tests/test-261109-intent-classifier-query-count.cjs: RED on HEAD (47 reads), PASS 5 of 5 after. node tests/test-369-hook-require-graph.cjs: 5 passed, 0 failed. bash tests/run-all-386.sh: PASS=37 FAIL=0 SKIP=0. bash tests/run-all-158.sh: the same 4 pre-existing failures as HEAD (presentation-counter, reject-only, orchestrator-pure, part8-no-reason: the Phase 345-03 require cycle), no new failure. Related suites identical to HEAD (159 turn-start-wiring, 345-cooldown, six classifier suites PASS; 159 integration and 222 readonly-rank FAIL on HEAD and after). A/B timing: real 9p room before 11.5 to 17.6 s, after 2.4 to 4.8 s; ext4 before 0.63 to 0.97 s, after 0.35 to 0.64 s; 9p plus 2 busy loops before 18.9 to 21.6 s, after 3.8 to 4.4 s. Module count unchanged (217 both arms). No em-dashes in the changed files.
files_changed:
  - lib/workflow/reach-reject-reader.cjs (precomputeReachCounters; computeReachPenalties uses the injection seam; export)
  - scripts/intent-classifier.cjs (shouldSkipReachPenalties; fold gate with a fresh clock; two exports)
  - tests/test-261109-intent-classifier-query-count.cjs (new regression)
  - .planning/debug/intent-classifier-hook-timeout.md (this RCA)
commits: 598b62422 (fix plus test, branch quick/261109-intent-classifier-timeout, worktree /home/jsagi/gsd-workspaces/hook-timeout/MindrianOS-Plugin); this RCA lands in the commit that follows it
