---
phase: 261029-s9x-cache-the-telemetry-room-walk-so-read-gr
plan: 01
quick_id: 261029-s9x
subsystem: hooks
tags: [perf, hooks, telemetry, cache, part8]
status: COMPLETE
requires: [261029-qef]
provides:
  - lib/core/token-estimator.cjs estimateRoomTokensCached, walkRoomTokensAsync, TOKEN_ESTIMATE_CACHE_FILE, TOKEN_ESTIMATE_MAX_AGE_MS, WALK_FANOUT
  - scripts/query-efficiency-telemetry.cjs zero-token exit before the room is resolved or walked
  - tests/test-261029-s9x-token-estimate-cache.cjs (arms T1..T18)
key-files:
  created:
    - tests/test-261029-s9x-token-estimate-cache.cjs
  modified:
    - lib/core/token-estimator.cjs
    - scripts/query-efficiency-telemetry.cjs
    - CHANGELOG.md
decisions:
  - "DD-2 kept: the cache validity rule is the age alone (10 minutes). The probe numbers of the execution day agree with the plan: the top-level mtime check costs 9.7 ms async and 43.1 ms sync, the cache read costs 3.6 ms (load 2.65)."
  - "CHANGELOG numbers come from the paired set only (before tree and after tree run back to back, load 1.0 both). The first set (before at load 3.4, after at load 1.2) is invalid by the plan's load rule and feeds no CHANGELOG number."
completed: 2026-10-29
---

# Phase 261029-s9x Plan 01: cache the telemetry room walk Summary

STATUS is COMPLETE. All 3 tasks ran. 3 commits exist, none pushed. Every gate is green. The first measured set is invalid by the plan's load rule (load differs by more than 1.0), so the legs were run again as a paired set at equal load. The CHANGELOG uses the paired set.

Marks: PROVEN = I saw it in this run. UNVERIFIED = I did not run it. ASSUMED = inferred.

## Commits (3, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | 9b3a8f8cc | test(261029-s9x): add failing test for the cached room token estimate and the zero-token early exit |
| 2 | 5de70b8bb | perf(261029-s9x): cache the room token estimate for 10 minutes, walk with bounded async reads, and exit before the walk on a zero-token result |
| 3 | 3cdf09add | docs(261029-s9x): record the cached room estimate and the measured read-hook times in the changelog |

PROVEN: all 3 shas are ancestors of HEAD (git merge-base --is-ancestor printed "ancestor" for each). Each commit used `git commit --only` with explicit paths and ends with the Co-Authored-By line. PROVEN: no commit deleted a file (git diff --diff-filter=D printed nothing). PROVEN: the 4 owned paths are clean in git status; the only tracked change left is the peer file .planning/ROADMAP.md, which I did not touch. PROVEN: package.json, npm-shrinkwrap.json, hooks/hooks.json, scripts/on-stop-state, scripts/session-start-state and scripts/on-file-changed have no diff against 4e178bd23.

## What changed

- lib/core/token-estimator.cjs (PROVEN by git diff): new `walkRoomTokensAsync`, `estimateRoomTokensCached`, `TOKEN_ESTIMATE_CACHE_FILE`, `TOKEN_ESTIMATE_MAX_AGE_MS`, `WALK_FANOUT`, plus internal `createLimiter`, `readCacheSync`, `writeCacheSync`. The diff hunks show no change inside the bodies of `estimateRoomTokens` and `clearCache` (DD-4). The header note "NOT persisted to disk" is replaced by the measured fact and the new design.
- scripts/query-efficiency-telemetry.cjs (PROVEN): `main` is async. The order is now: tool gate, slash command, estimator require, tokens_used, `if (tokensUsed <= 0) return exitSilent();`, resolveRoomRoot, `await estimator.estimateRoomTokensCached(roomRoot)`. The outer try/catch became `main().catch(...)` with exit 0.
- tests/test-261029-s9x-token-estimate-cache.cjs: 386 lines, 18 arms.
- CHANGELOG.md: one bullet at the end of `## [Unreleased]` / `### Changed`.

## Task 1: before measurement and RED test

Host: WSL2, load average shown with each run. Room: the real room of the plan, 338 files, 156 .md files counted, 200,087 tokens. Step 0 (PROVEN): the 4 owned paths were clean; last commits of the 3 tracked files matched the plan (6452ad69c, 669b9d889, 93b3cdb78); HEAD was 4e178bd23; the real telemetry file ~/.mindrian/telemetry/query-efficiency.jsonl did not exist; ROOM/.mindrian/token-estimate.json did not exist.

Harness copies (PROVEN): hook-bench-parallel.cjs was copied byte for byte (cmp: same). hook-bench-s9x.cjs is the variant with the per-hook line (max and sorted unique exit codes), CONTENT_CHARS, TELEMETRY_HOME and PRE_RUN_DELETE. Both live in `/tmp/claude-1000/-home-jsagi/b995db30-926f-45da-bd5e-9bff0d895704/scratchpad/s9x-exec`.

### Before lines (first set)

```
B1 uptime 20:40:07 load 3.42, 3.46, 3.33
PostToolUse hooks=2 wall median=441 ms min=427 slowest: query-efficiency-telemetry.cjs=442ms, operator-update.cjs=36ms
B2 uptime 20:40:08 load 3.22, 3.42, 3.32  (CONTENT_CHARS=400, TELEMETRY_HOME scratch)
PostToolUse hooks=2 wall median=401 ms min=396 slowest: query-efficiency-telemetry.cjs=407ms, operator-update.cjs=35ms
  hook operator-update.cjs max=35 ms codes=0
  hook query-efficiency-telemetry.cjs max=407 ms codes=0
B3 uptime 20:40:15 load 3.04, 3.38, 3.30  (hook alone, Read shape, runs 1-4)
  0.48 (warm-up), 0.41, 0.41, 0.40   -> median of runs 2-4 = 0.41 s
B4 uptime 20:40:16 load 3.04, 3.38, 3.30  (hook alone, counted payload)
  0.38 (warm-up), 0.39, 0.39, 0.36   -> median of runs 2-4 = 0.39 s
B5 uptime 20:40:23 load 2.65, 3.28, 3.27
sections=17 readSmall median=3.6ms statRoot median=1.8ms topSync median=43.1ms topAsync median=9.7ms
B6 uptime 20:40:23 load 2.65, 3.28, 3.27
pool=default4 sync median=921ms async median=85ms tokens sync=200087 async=200087 mdFiles=156
```

JSONL count of step 3e (PROVEN): 7 lines in the scratch HOME (3 from B2, 4 from B4). Real-HOME check of step 3g (PROVEN): ~/.mindrian/telemetry/query-efficiency.jsonl still does not exist. B5 agrees with DD-2: the mtime check (43.1 ms sync, 9.7 ms async) costs more than the cache read (3.6 ms).

### RED check (PROVEN)

Against the unchanged tree: exit 1, 15 FAILED. ok for T16, T17, T18. FAIL for T1 to T15. T12 did not print SKIP because the user id is 1000. The set matches the plan. Commit 9b3a8f8cc holds only the test file.

## Task 2: GREEN

### Baseline and after table

| Test | Before (step 0) | After |
|------|-----------------|-------|
| lib/memory/query-efficiency-telemetry.test.cjs | exit 0, 18/18 | exit 0, 18/18 |
| tests/test-hook-envelope-shape.cjs | exit 0, 16 passed, 0 failed | exit 0, 16 passed, 0 failed |
| tests/test-369-hook-require-graph.cjs | exit 0, 5 passed, 0 failed | exit 0, 5 passed, 0 failed |
| tests/test-353-turn-budget.cjs | exit 0, PASS | exit 0, PASS |
| tests/test-353-self-block.cjs | exit 0 | exit 0 |
| tests/test-353-ruling-doc.cjs | exit 0, PASS=19 FAIL=0 | exit 0, PASS=19 FAIL=0 |
| lib/core/telemetry/writer.test.cjs | exit 0, 10/10 | exit 0, 10/10 |
| tests/test-261029-qef-hook-timeouts.cjs | exit 0, ALL PASS | exit 0, ALL PASS |
| tests/test-261029-s9x-token-estimate-cache.cjs | exit 1, 15 FAILED | exit 0, ALL PASS (18 arms, 0 SKIP) |
| bash tests/run-all-369.sh | PASS=54 FAIL=9 SKIP=1 | PASS=54 FAIL=9 SKIP=1 |

PROVEN: the run-all-369 logs before and after differ only by process ids, a millisecond value and a count of unrelated changes by other sessions (diff after removing the ms values). The 9 failures and the 1 skip are pre-existing and not caused by this task: erasable gate (TS369-03), infra helpers (TS369-07), writer inventory coverage (CHG369-04), shared core (SHELL369-01), launch surface (SHELL369-08/09), 276 tool honesty findings closed, 267 registration API, 267 CIRS gates, 267 zod4 contract. Skip: installed layout exact floor (ENV GAP). I did not investigate them (scope boundary).

Gate line (PROVEN): the verify chain of the task ran in parts and each part passed: new test ALL PASS; 18/18; envelope shape; require graph; qef timeouts; no diff of the 6 protected paths against 4e178bd23; no long dash in the added lines; `await estimator.estimateRoomTokensCached` present.

### Real-room parity (PROVEN)

```
walk-module.cjs (module's walkRoomTokensAsync), uptime 20:48:29 load 2.10, 2.30, 2.77
pool=default4 sync median=782ms async median=85ms tokens sync=200087 async=200087 mdFiles=156
```

Tokens are equal on the real room (200,087 both). Test arm T2 (50-file fixture with hidden, non-md, depth, symlink and node_modules cases) also shows equality.

## Task 3: after measurement

### After lines (first set, formal legs A1 to A7)

```
A1 uptime 20:54:30 load 1.16, 1.60, 2.31
PostToolUse hooks=2 wall median=41 ms min=36 slowest: query-efficiency-telemetry.cjs=43ms, operator-update.cjs=40ms
A2 (miss, PRE_RUN_DELETE) uptime 20:54:30 load 1.16, 1.60, 2.31
PostToolUse hooks=2 wall median=153 ms min=137 slowest: query-efficiency-telemetry.cjs=161ms, operator-update.cjs=31ms
  hook operator-update.cjs max=31 ms codes=0
  hook query-efficiency-telemetry.cjs max=161 ms codes=0
A3 (hit; 1 warm-up run first: wall 41 ms) uptime 20:54:31 load 1.16, 1.60, 2.31
PostToolUse hooks=2 wall median=39 ms min=39 slowest: query-efficiency-telemetry.cjs=40ms, operator-update.cjs=37ms
  hook operator-update.cjs max=37 ms codes=0
  hook query-efficiency-telemetry.cjs max=40 ms codes=0
A4 (hook alone, Read shape) uptime 20:54:43 load 1.22, 1.59, 2.31
  0.02, 0.02, 0.02, 0.02 s (10 ms resolution)   -> median of runs 2-4 = 0.02 s
A5 (hook alone, miss, cache deleted before each run) uptime 20:54:44 load 1.22, 1.59, 2.31
  0.11, 0.11, 0.10, 0.12 s   -> median of runs 2-4 = 0.11 s
A6 (hook alone, hit) uptime 20:54:44 load 1.22, 1.59, 2.31
  0.02, 0.02, 0.03, 0.02 s   -> median of runs 2-4 = 0.02 s
A7 uptime 20:55:32 load 1.08, 1.49, 2.24
pool=default4 sync median=398ms async median=76ms tokens sync=200087 async=200087 mdFiles=156
```

PROVEN: every exit code in the variant lines is 0. PROVEN: after A6 the JSONL count in the scratch HOME was 22 (7 before, plus 15 content runs: A2 3, A3 warm-up 1, A3 3, A5 4, A6 4); each content run added one line. The cache file written by the hook held `{"version":1,"computed_at_ms":1793300084493,"tokens":200087,"file_count":156}`.

### Verdict of the first set (plan rule): inconclusive (load)

The before set ran at load 3.0 to 3.4. The after set ran at load 1.1 to 1.2. The loads differ by more than 1.0, so by the plan's rule every first-set pair is "inconclusive (load)". I did not use first-set numbers in the CHANGELOG. I ran each leg again as a paired set.

| Leg | Before median | After median | Before load (1 min) | After load (1 min) | Verdict |
|-----|---------------|--------------|---------------------|--------------------|---------|
| B1 vs A1, event wall, Read shape | 441 ms | 41 ms | 3.42 | 1.16 | inconclusive (load); see paired set |
| B2 vs A2, event wall, counted, miss | 401 ms | 153 ms | 3.22 | 1.16 | inconclusive (load); see paired set |
| B2 vs A3, event wall, counted, hit | 401 ms | 39 ms | 3.22 | 1.16 | inconclusive (load); see paired set |
| B3 vs A4, hook alone, Read shape | 0.41 s | 0.02 s | 3.04 | 1.22 | inconclusive (load); see paired set |
| B4 vs A5, hook alone, miss | 0.39 s | 0.11 s | 3.04 | 1.22 | inconclusive (load); see paired set |
| B4 vs A6, hook alone, hit | 0.39 s | 0.02 s | 3.04 | 1.22 | inconclusive (load); see paired set |

### Paired set (the valid set)

Method (PROVEN): `git archive 4e178bd23 -- lib scripts hooks package.json` into `.../s9x-exec/before-tree`. Only 2 files differ between that tree and HEAD in lib, scripts and hooks (token-estimator.cjs and query-efficiency-telemetry.cjs; git diff --stat). The harness ran against the before tree, then against HEAD, back to back. Hook-alone legs ran with the same scratch HOME. Time resolution 1 ms (bash TIMEFORMAT=%3R).

```
PAIR1 event wall, Read shape
  BEFORE tree uptime 20:55:02 load 1.02: wall median=373 ms min=320  (telemetry max 384, operator-update max 34, codes 0,0)
  AFTER  tree uptime 20:55:03 load 1.02: wall median=36 ms  min=34   (telemetry max 36,  operator-update max 35, codes 0,0)
PAIR2 event wall, counted payload (400 chars)
  BEFORE tree uptime 20:55:04 load 1.02: wall median=383 ms min=367  (telemetry max 395, operator-update max 33)
  AFTER tree, miss uptime 20:55:05 load 1.02: wall median=120 ms min=113 (telemetry max 141, operator-update max 31)
  AFTER tree, hit  uptime 20:55:05 load 1.02: wall median=40 ms  min=37  (telemetry max 42,  operator-update max 34)
H1 hook alone, Read shape (run 1 = warm-up)
  BEFORE uptime 20:55:12 load 1.02: 0.409, 0.399, 0.319, 3.274 s   -> median of runs 2-4 = 0.399 s
  AFTER  uptime 20:55:16 load 1.01: 0.025, 0.026, 0.036, 0.028 s   -> median of runs 2-4 = 0.028 s
H2 hook alone, counted payload
  BEFORE uptime 20:55:16 load 1.01: 0.381, 0.388, 0.411, 0.418 s   -> median of runs 2-4 = 0.411 s
  AFTER miss uptime 20:55:18 load 1.01: 0.125, 0.106, 0.111, 0.104 s -> median of runs 2-4 = 0.106 s
  AFTER hit  uptime 20:55:18 load 1.01: 0.029, 0.030, 0.028, 0.028 s -> median of runs 2-4 = 0.028 s
```

| Pair (load before / after) | Before median | After median | Change | Verdict |
|----------------------------|---------------|--------------|--------|---------|
| Event wall, Read shape (1.02 / 1.02) | 373 ms | 36 ms | -90 percent | faster |
| Event wall, counted, miss (1.02 / 1.02) | 383 ms | 120 ms | -69 percent | faster |
| Event wall, counted, hit (1.02 / 1.02) | 383 ms | 40 ms | -90 percent | faster |
| Hook alone, Read shape (1.02 / 1.01) | 399 ms | 28 ms | -93 percent | faster |
| Hook alone, counted, miss (1.01 / 1.01) | 411 ms | 106 ms | -74 percent | faster |
| Hook alone, counted, hit (1.01 / 1.01) | 411 ms | 28 ms | -93 percent | faster |

The expectation stated before the run (hypothesis) held: Read shape drops to the node floor; a miss was about 100 to 120 ms (the hypothesis said 150 to 250 ms; the miss is faster than predicted); a hit is the floor plus one file read.

PROVEN: one outlier in the paired set, H1 before run 4 = 3.274 s. The median of 3 is not affected. Cause: UNVERIFIED.

### Which hook bounds the event wall (operator-update.cjs maxima)

| Leg | operator-update.cjs max | telemetry hook max | Event wall median |
|-----|-------------------------|--------------------|-------------------|
| B2 (before, counted) | 35 ms | 407 ms | 401 ms |
| A2 (after, miss) | 31 ms | 161 ms | 153 ms |
| A3 (after, hit) | 37 ms | 40 ms | 39 ms |
| PAIR1 after (Read shape) | 35 ms | 36 ms | 36 ms |
| PAIR2 after, hit | 34 ms | 42 ms | 40 ms |

After the change, the event wall on a hit or on a Read shape sits at the level of operator-update.cjs (31 to 37 ms) and of node start-up. The telemetry hook no longer sets the pace there. PROVEN. Further gain needs a change to operator-update.cjs, which is out of scope (R-2).

### Cleanup and state checks (PROVEN)

- Real room: `ROOM/.mindrian/token-estimate.json` and `token-estimate.json.tmp.*` deleted. `ls ROOM/.mindrian | grep token-estimate` printed nothing (grep exit 1), checked before the docs commit and after it. No other file in the room was touched by me.
- Scratch HOME JSONL: 43 lines at the end (22, plus 9 in PAIR2, plus 12 in H2). Each content run added one line.
- Real HOME: ~/.mindrian/telemetry/query-efficiency.jsonl does not exist, as at step 0. No leg wrote to the real HOME.

## Deviations from Plan

**1. [Extra legs] A paired before and after set was added.**
- Found during: Task 3 step 3.
- Issue: the first before set ran at load 3.0 to 3.4 and the first after set at load 1.1 to 1.2. By the plan's rule every pair is "inconclusive (load)" and the leg must run again.
- Fix: a copy of the tree at 4e178bd23 (git archive) was run back to back with HEAD at load 1.0. The CHANGELOG uses the paired numbers. All sets are in this file.
- Files modified: none in the repo. Scratch only.
- Commit: none.

**2. [Rule 2 - hardening] The cache read is bounded and the write refuses a symlinked .mindrian.**
- Found during: Task 2 step 1, threat register T-s9x-02 and the "stays inside the room" truth.
- Issue: a plain readFileSync reads a file of any size, and `statSync` follows a symlink. A crafted .mindrian symlink could send the write outside the room.
- Fix: `readCacheSync` reads at most 1024 bytes (a valid record is under 100 bytes; a larger file fails the parse and gives a walk). `writeCacheSync` uses `lstatSync` and writes only when .mindrian is a real directory. Behavior for all test arms is unchanged.
- Files modified: lib/core/token-estimator.cjs.
- Commit: 5de70b8bb.

**3. [Harness] The hook-alone legs of the first set used /usr/bin/time (10 ms resolution).** The paired set uses bash `time` with 1 ms resolution. Medians of the first set are therefore coarse (0.02 s). The CHANGELOG uses the paired set.

**4. [Comment] The comment above the entry point changed.** The old text "Outer try/catch is the soft-fail guarantee" was stale after the change to `main().catch`. I updated it. No behavior change.

No other deviation. The plan had no checkpoint. No auth gate occurred. No package install ran.

## Known Stubs

None. PROVEN by reading the diff: no placeholder text, no empty value that flows to a UI.

## Threat Flags

None new. The cache file and its write path are the plan's T-s9x-01 to T-s9x-06 surface. Mitigation status (PROVEN by test arms): T-s9x-01 (T3, T18), T-s9x-02 (T7, T8, T9 and the 1024-byte read), T-s9x-03 (bounded fan-out 32, depth 12, hit is one read), T-s9x-04 (T10), T-s9x-05 (T11, T12, T17), T-s9x-07 (scratch HOME; real file absent before and after), T-s9x-08 (cleanup result above). T-s9x-06 (two writers at once; rename on Windows) is accepted and UNVERIFIED on Windows.

## Self-Check

- PROVEN: files exist: tests/test-261029-s9x-token-estimate-cache.cjs, lib/core/token-estimator.cjs, scripts/query-efficiency-telemetry.cjs, CHANGELOG.md.
- PROVEN: 3 commit shas are ancestors of HEAD.
- PROVEN: CHANGELOG-OK chain printed; the new test prints "token-estimate-cache: ALL PASS".

## Self-Check: PASSED

## Report

STATUS: DONE

CHANGED:
- tests/test-261029-s9x-token-estimate-cache.cjs (new, 9b3a8f8cc)
- lib/core/token-estimator.cjs (5de70b8bb)
- scripts/query-efficiency-telemetry.cjs (5de70b8bb)
- CHANGELOG.md (3cdf09add)
- Not committed by me, as instructed: this SUMMARY.md.

VERIFIED:
- node tests/test-261029-s9x-token-estimate-cache.cjs: exit 0, ALL PASS, 18 arms, 0 SKIP (PROVEN). RED run before the change: 15 FAILED, ok for T16, T17, T18 (PROVEN).
- lib/memory/query-efficiency-telemetry.test.cjs 18/18; envelope shape 16/0; require graph 5/0; qef timeouts ALL PASS (PROVEN, before and after).
- bash tests/run-all-369.sh: PASS=54 FAIL=9 SKIP=1 before and after, same verdict lines (PROVEN).
- Parity on the real room: sync 200,087 tokens, async 200,087 tokens (PROVEN).
- Paired measurement on the real room at load 1.0: event wall for a Read 373 ms to 36 ms; counted payload 383 ms to 120 ms (miss) and 40 ms (hit); hook alone 411 ms to 106 ms (miss) and 28 ms (hit) (PROVEN).
- 3 commits are ancestors of HEAD; real room has no token-estimate file; no push (PROVEN).

UNVERIFIED:
- Windows native behavior of rename and the async walk (no Windows run).
- The cause of the one 3.274 s outlier (H1 before, run 4).
- The cause of the 9 pre-existing run-all-369 failures (not investigated; identical before and after).
- Behavior inside a live Claude Code session: I ran the hook through the harness and by hand, not through a Claude Code Read.

RISKS:
- R-1 (ASSUMED cause, PROVEN symptom): extractToolResponse does not read tool_response.file.content, which is where a real Read result keeps its text. A real Read gives 0 tokens, so the hook now exits silent right after the tool gate and writes no JSONL line. This was already true before (it exited after paying the walk). The real telemetry file does not exist on this machine. Part of the measured gain on the Read shape comes from this early exit, not from the cache.
- If R-1 is fixed later, every Read reaches the cache path. A hit costs one small file read, so the added load is small, but the JSONL then grows by one line per Read.
- R-3: the room estimate can be up to 10 minutes old. It feeds a telemetry ratio only and never blocks a tool call.
- R-2: operator-update.cjs (31 to 37 ms) now sets the pace of the Read event. It is out of scope.
- R-4: Windows rename and async walk are UNVERIFIED.
- R-5: the real room root holds a directory whose name is a Windows path (C:\Users\jsagi\...). Both walks count it the same way. It looks like a path bug in another writer. Out of scope.
- R-6: node_modules is not skipped by the walk, as before.
- The 1-minute load average moves slowly. The first before set and the first after set were not at equal load. Only the paired set is a valid comparison.

NEXT: Run a follow-up quick for R-1 (candidate): make `extractToolResponse` read `tool_response.file.content` so a real Read result is counted. This needs a decision, because it starts a telemetry JSONL line for every Read. After this quick, the main session should commit this SUMMARY and the STATE.md row, then decide on the follow-up for R-1.
