---
status: root_cause_found
trigger: "MindrianOS background workers (gsd-graph-derive-drain.cjs --worker, and rs-engine runModeInternal scout) peg the CPU on a Windows PC running Claude Code in WSL. Windows node hooks then time out."
created: 2026-10-21
updated: 2026-10-21
goal: find_root_cause_only
---

## Symptoms

expected: A MindrianOS session start and each prompt finish background work in seconds. Hooks finish inside their 2000 to 3000 ms budget.

actual: One node process of gsd-graph-derive-drain.cjs --worker (beta.69) used about 8 to 10 of 12 cores in WSL. System CPU 100 percent, 76 percent in kernel time. After the owner stopped the worker with a terminate signal, CPU fell to about 32 percent. A second process, rs-engine runModeInternal on room jhtv-oliver-kuntz, stays near 80 to 100 percent of one core for 2 minutes or more, and it restarts on each session start.

errors: UserPromptSubmit hooks timed out and their output was discarded: auto-explore-drain.cjs (3s), jtbd-update.cjs userprompt (3s), brain-derivation-drain.cjs (3s), mva-detect.cjs (3s), first-install-router.cjs (3s), operator-update.cjs (3s), admin-command-gate.cjs (3s), run-hook.cmd intent-classifier (5s), send-event.ps1 (30s). 15 MCP servers also timed out at startup.

timeline: Owner reports the slowness began after the Eureka work. The owner expects release beta.73. npm latest is beta.69. GitHub main is beta.72. beta.73 was never published.

reproduction: Start a Claude Code session in WSL with room jhtv-oliver-kuntz bound. Then watch ps for node processes.

## Owner theory (UNVERIFIED at start, now answered)

The CPU load comes from the Eureka work (an embedding encoder installed locally). RESULT: half right. The encoder exists since 2026-07-05 and the Eureka adapter branch did not touch it. The Eureka JHTV workflow filed 2119 markdown files into the room on 2026-10-18, and that data growth (44 to 2163 artifacts) is what made old code explode. See Resolution.

## Facts already PROVEN by the main session (2026-10-21, this machine)

- Process PID 6258 is live. Command: node -e require(".../mos/2.0.0-beta.69/lib/core/rs-engine.cjs").runModeInternal(roomDir, {}) with roomDir /home/jsagi/MindrianRooms/jhtv-oliver-kuntz.
- PID 6258 has run 1842 s, uses 97 percent of 1 core, holds 383 MB RSS, has 7 threads, parent PID 5290, working directory /home/jsagi.
- Dev repo /home/jsagi/dev/MindrianOS-Plugin is on branch feat/eureka-adapter-rebased, version 2.0.0-beta.72, 0 dirty files.
- scripts/gsd-graph-derive-drain.cjs already has a single-flight lock (commit 4d76dd352) and a self-detach (commit a21ef5638).
- Last commits on the drain and producer files: 00a6e5f85, 68ed02a73, 7a44a2bda, fb31472d8, 4c3bbf7cf, c327fc707.

## Open questions for the debugger

1. Why does runModeInternal run for more than 30 minutes on a room with 39 entries? Find the loop or the missing bound.
2. Why did the drain worker use 8 to 10 cores? Find the thread count of the encoder or the number of concurrent workers.
3. Did the single-flight lock fail? Check stale-lock reclaim (LOCK_STALE_MS) against a worker that is still alive.
4. Is the encoder added by the Eureka work (feat/eureka-adapter-rebased) or by the older graph-derive work? Show the commit that added it.
5. Is the scout started on every SessionStart without a single-flight guard?
6. Why does the hook budget not protect the prompt path from a starved CPU?

## Limits

- Diagnose only. Do not edit source files. Do not commit.
- Do not kill PID 6258 before the debugger has sampled it.
- Do not call AskUserQuestion.

## Current Focus

hypothesis: CONFIRMED. (1) Scout: O(n^3) pure-JS Jacobi eigen-solver on a 2000 x 2000 matrix, no timeout, no size guard. (2) Drain: one never-finishing room-scoped job of 2,338,203 pairs, 2 full encoder calls per pair, ORT default thread pool (11 spinning threads), plus a lock with no heartbeat. Both were triggered by room growth from 44 to 2163 artifacts on 2026-10-18.
test: sampled live PID 6258 and live drain PID 33787; replayed the same code paths on copies; ran the production lock in a temp room.
expecting: n/a (done)
next_action: none for the debugger. Fix proposals are in Resolution. Main session decides.
reasoning_checkpoint: done
tdd_checkpoint: n/a

## Evidence

Machine: aarch64 (Windows on ARM, WSL2), 12 logical cores, node v22.23.1. The code in plugin cache beta.69 is byte-identical (md5) to the dev repo for rs-engine.cjs, svd.cjs, rs-math.cjs, gsd-graph-derive-drain.cjs, scout-cadence-runner.cjs, scout-cadence-guard.cjs, hooks.json, embedding-spine.cjs. So findings hold for beta.69 and beta.72. [PROVEN: cmp]

### E1. Live scout process PID 6258 (sampled before any action)
- Parent PID 5290 = node scripts/scout-cadence-runner.cjs <room> (beta.69 cache). PID 6258 is its step 7 child (rs-engine-cjs). [PROVEN: ps]
- top -H: main thread 99.9 percent, 31 min CPU time; the 6 other threads are idle (0.0 to 0.64 s total). State R. [PROVEN]
- /proc/6258/io: rchar 9,752,559 and wchar 10, UNCHANGED between t=1914 s and t=3377 s. The md text of the room is 6.8 MB. The embedding cache file .rs-engine-cache.json is 25 MB. So the process has not read the cache, so it has not reached computeEmbeddings. [PROVEN]
- RSS 383,764 kB at three samples (t=1914, 2561, 3327 s): constant. In-place numeric loop, no allocation. [PROVEN]
- 7 threads, no onnxruntime library threads. The encoder is NOT loaded in the scout. [PROVEN]
- Conclusion by elimination: the process is inside rsMath.buildLsaMatrix, before the semantic leg. The only stage there that scales past minutes is the Jacobi eigen-solver (E2). [PROVEN for "before computeEmbeddings"; Jacobi identification PROVEN by reproduction in E2, not by a stack of PID 6258 (no inspector was attached, per limits)]

### E2. Reproduction of the scout hot loop on a copy (scratchpad scripts, read-only on the room)
- discoverArtifacts finds 2163 artifacts (not 39). 39 is the count of top-level entries. 2125 files are under solution-design, 2119 under solution-design/full-catalog-run-2026-10-18. [PROVEN]
- stat birth time of those files: 2026-10-18 17:27 +0300. Before that the room had 44 artifacts (2163 - 2119). The Eureka JHTV workflow created them. [PROVEN: stat]
- fitTfidf gives a 2163 x 2000 matrix (max_features 2000) in 2.0 s. m=2163 > n=2000, so svd.cjs builds the Gram matrix on the 2000 side: 2000 x 2000, 1.8 s. [PROVEN]
- jacobiEigenSymmetric (lib/core/numeric/svd.cjs:202-257) rotates every off-diagonal pair each sweep: 1,999,000 rotations per sweep, each touching 4 x 2000 array cells with column-strided access. Measured: sweep 0 = 1137 s (19 min) on a niced probe under CPU contention. First 1000 rows ran at 0.33 ms per rotation, which gives about 11 min per sweep uncontended. [PROVEN: measured]
- Stop rule is offDiagSum < 1e-20 (absolute). Sweep cap is 60 (DEFAULT_ITERATIONS). offDiagSum went 10117.8 to 5511.7 after sweep 0. [PROVEN]
- On a 300-document Gram matrix of the same data the solver needs 9 sweeps (offDiagSum 181 to 1e-24). At n=2000 the first sweep cuts the error only 1.8x (3.3x at n=300), so 10 to 14 sweeps are likely. Estimate 2 to 4 hours per run. [ASSUMED: extrapolation; full run not completed]
- Corroboration: in the earlier completed run, .hsi-results.json was written 2026-10-20 01:09 local and .rs-engine-cache.json 02:55:43 local, and the scout throttle stamp 02:56:06 local. That is at most 1 h 46 min for the rs-engine step. Same order as the estimate. [ASSUMED: both files from the same scout run]
- Other stages (L1 matrix 2163^2 x 80, absDiffTopk k=100 x n^2, cosine matrix) are about 10^8 to 10^9 simple operations each: seconds to a minute. [UNVERIFIED: not timed]
- Header comment of svd.cjs says "n_docs up to a few hundred". The design bound is exceeded 10x. discoverArtifacts has no artifact cap. [PROVEN: read]
- No timeout anywhere on the path: scout-cadence-runner.cjs runStep uses execFileSync with no timeout option (line 93); node -e has no timer. [PROVEN: read]

### E3. Live drain worker PID 33787 (appeared during the session; sampled)
- Command: node .../2.0.0-beta.69/scripts/gsd-graph-derive-drain.cjs --worker (no --room). Started 12:44:10 local (lock file written with PID 33787 at that time). Parent was reparented to /init. No --room means it came from the SessionStart hook self-detach (main(), line 603), not from the per-write spawn. cwd is /home/jsagi, so the room came from the registry active room (jhtv-oliver-kuntz). [PROVEN]
- 22 threads. top -H: 11 onnxruntime threads each 45 to 100 percent in state R, main thread 54 percent. Total 704 to 711 percent CPU. RSS 514 MB growing (532 MB 11 s later). Load average 18.65 on 12 cores. [PROVEN]
- Maps show libonnxruntime.so (arm64) from ~/.mindrian/eureka-deps and model_quantized.onnx_data from ~/.mindrian/model-cache. [PROVEN]
- Queue file .mindrian/graph-derive-queue.json holds exactly ONE entry: {roomDir, enqueued_at: 2026-07-06T16:35:35.836Z}, no filePath. A room-scoped entry makes drainScoreBased call classifier.buildAllPairs(room) (line 446). The entry is 107 days old and has never been cleared. No graph-derive-failures.json exists. [PROVEN]
- Pair count: N=2163 gives N(N-1)/2 = 2,338,203 pairs. [PROVEN: arithmetic]

### E4. Encoder cost and thread count (replica of embedding-spine pipeline call, default options)
- embedding-spine.cjs:405 calls pipeline('feature-extraction', model, {dtype}) with no session_options. Repo grep: no intra-op thread cap, no os.setPriority, no nice anywhere. [PROVEN]
- transformers.js 4.3.0, onnxruntime-node 1.30.0. Thread count 11 before load, 22 after load: ORT adds 11 threads (all logical cores minus 1). [PROVEN: measured]
- Embedding one pair (2 room texts, median 2823 chars, truncated by the model): run 1 = 1840 ms per pair, 8.69 cores average; run 2 = 1660 ms per pair, 10.43 cores average. System share of CPU time 0 to 1 percent in WSL. [PROVEN: measured]
- Projection: full backfill 2,338,203 pairs x 1.66 to 1.84 s = 1078 to 1195 hours (45 to 50 days). One per-write drain: 2162 pairs = 60 to 66 minutes. [PROVEN rate; projection is arithmetic]
- Per pair, scoreMeasured (rs-differential-scorer.cjs:550) calls embedTexts([a, b]) on the full texts. makeArtifact (graph-derive-classifier.cjs:249) never sets a vector, so the vector-reuse seam at classifier line 178 is never used. Each document is encoded about 2(N-1) = 4324 times instead of once. [PROVEN: read]
- The 76 percent kernel share the owner saw is not reproduced here (0 to 1 percent). [UNVERIFIED: likely hypervisor accounting or spin-wait; not tested]

### E5. Lock behaviour
- acquireDrainLock (drain.cjs:259-284): creates the lock with open('wx'), writes the PID, and treats the lock as stale when mtime is older than LOCK_STALE_MS (10 min). The mtime is never refreshed. The PID is never read back. releaseDrainLock removes the file without checking the owner. [PROVEN: read]
- Hermetic run of the production drainDerive in a temp room with injected deriveFn: with a FRESH lock the second drain returned locked=true (single-flight works). After the lock mtime was backdated by 11 min while worker A was still running, worker B reclaimed the lock and both ran at the same time (max concurrent = 2). [PROVEN: run]
- Real state: before 12:44 the lock file held PID 1468, which was dead (the owner killed that worker; SIGTERM leaves the lock). The lock was 50 min old, so PID 33787 reclaimed it. [PROVEN]
- Effect: a drain that runs longer than 10 minutes (every drain on this room) is treated as dead. Any later SessionStart, clear, compact, or per-write spawn starts another full job at 9 cores. Also every kill restarts the same job from pair 0, because the entry clears only after the whole entry finishes. [PROVEN by the run and by the queue state]

### E6. Spawn sites and guards
- Drain: hooks.json SessionStart matcher startup|clear|compact, timeout 5000, async false, runs gsd-graph-derive-drain.cjs. main() re-spawns itself detached with --worker and exits (drain.cjs:603-617). Second spawn site: intelligence-cascade.cjs:371-381 (Step 2b) spawns one detached worker per queued markdown write. [PROVEN]
- Scout: scripts/session-start lines 1793-1796 run ( node scout-cadence-runner.cjs <room> >/dev/null 2>&1 || true ) & on every SessionStart (same matcher, via run-hook.cmd session-start, timeout 10000). Only guard: scout-cadence-guard.shouldFire, a 24 h timestamp. recordRun is called at the END of the run (runner line 497). There is no lock, no in-flight marker, no PID check for the scout. The "ambient-run.lock" in the guard belongs to the ambient ledger, not to this runner. [PROVEN]
- Throttle state: ~/.mindrian/scout-cadence/last-run-<hash>.txt = 2026-10-19T23:56:06Z. It is older than 24 h since 2026-10-20T23:56Z, so every session start fires the scout again. A run that is killed (WSL stop, restart) never arms the throttle. [PROVEN]
- Emergency switch exists for the scout: SCOUT_CADENCE_SKIP=1 (session-start line 1794). No equivalent switch exists for the drain. [PROVEN: read]

### E7. Hook budget under load (measured)
- Test: 8 parallel node cold starts (one per UserPromptSubmit hook; hooks.json has 8). Idle-ish baseline: 489 and 847 ms wall. Earlier noisy baseline: 1982 and 3893 ms. While the encoder replica ran (10.4 cores busy): 20,112 ms. About 24 to 40 times slower. [PROVEN: measured, 1 sample under load]
- hooks.json timeouts are wall-clock kills (1500 to 3000 ms on the prompt path). Nothing reserves CPU for them. The workers run at default priority, with 11 spinning threads and no cap. [PROVEN: read plus measurement]
- On the Windows host the hooks run as Windows processes while the WSL VM competes for the same logical processors. [UNVERIFIED: not observable from inside WSL]
- The hook list in the owner error log (intent-classifier 5 s, send-event.ps1 30 s) does not match this hooks.json (intent-classifier 2000 ms, no send-event.ps1). Another install or wrapper adds those. [UNVERIFIED]

### E8. Git history (git log, git blame)
- svd.cjs Jacobi solver: 0025138f1, 2026-08-31, Phase 272-05. rs-engine.cjs: 73398c39f, 2026-08-31, Phase 272-08.
- Scout calls runModeInternal: b04bec07f, 2026-09-24, Phase 355-11 (D-52), replaced the Python detector. Scout spawn in session-start: Phase 145 (June 2026); lines last touched 44787a432, 2026-09-03.
- Local encoder: a9aa9ea39, 2026-07-05, Phase 211-01, first file lib/core/eureka/embedding-spine.cjs (moved to lib/core/semantic-index by 3ab26df38, 2026-10-02). Model swap e87f61f63, 2026-07-06. Dependency moved to ~/.mindrian/eureka-deps by 341-02 (ac69095d4, 2026-09-09).
- Drain queue and SessionStart drain: bdb3a6bc9, 2026-06-19, Phase 169-05. Score-based drain, buildAllPairs, per-pair scoreMeasured: 2eaa1b1e2 and ae5030a3e, 2026-07-15, Phase 224. Per-write spawn: 04bb005c7. Lock: 4d76dd352. Self-detach: a21ef5638. All 2026-07-15.
- Branch feat/eureka-adapter-rebased is 16 commits ahead of origin/main (1ebed69e3 to bd433635a). `git diff --stat origin/main..HEAD` over rs-engine, svd, rs-math, embedding-spine, classifier, drain, sweep, scout runner, guard, session-start, hooks.json, intelligence-cascade, scorer: EMPTY. [PROVEN]
- Plugin cache beta.59 vs beta.69: all suspect files identical except the classifier (adds BRIEF.md to the scaffold skip list) and an unrelated part of session-start. So the code did not change between the two releases. [PROVEN: cmp, diff]

## Eliminated

- "The Eureka adapter branch added the encoder or the scout call": NO. Zero changed lines in those files on the branch (E8).
- "A code regression between beta.59 and beta.69 caused the slowdown": NO. The suspect files are identical (E8).
- "The scout loads the encoder": NO. PID 6258 has 7 threads, no ORT library, no cache read (E1).
- "The scout has an infinite loop": NO. The Jacobi loop is finite (cap 60 sweeps) but each sweep costs about 11 to 19 min (E2).
- "Several drain workers ran at once on the owner PC": NOT NEEDED to explain 8 to 10 cores. One worker alone uses 8.7 to 10.4 cores (E4). Concurrency is possible by design (E5) but not shown on the PC. [UNVERIFIED for the PC]
- "A bad entry crashed the drain and is retried": NO. No failure log exists. The entry never finishes, so no failure is ever recorded (E3).

## Resolution

root_cause:
1. SCOUT (rs-engine runModeInternal). Algorithm cost explodes with room size and nothing bounds it. buildLsaMatrix builds a 2000 x 2000 Gram matrix and diagonalises it with a hand-written cyclic Jacobi solver in plain JS (svd.cjs, Phase 272-05, written for "a few hundred" documents). One sweep is 2 million rotations (11 to 19 min here), 10 to 14 sweeps are needed (cap 60). No size guard in discoverArtifacts or runModeInternal, no timeout in the scout runStep. The scout is spawned by every SessionStart with only a 24 h timestamp that is written after the run ends, so a long or killed run re-fires at every session start. Trigger: on 2026-10-18 the Eureka JHTV workflow filed 2119 generated files (full-catalog-run-2026-10-18, engine input data) into the room, so artifacts went from 44 to 2163 and the Gram dimension from 44 to 2000. Cost went from milliseconds to hours.
2. DRAIN (gsd-graph-derive-drain.cjs --worker). A room-scoped queue entry (enqueued 2026-07-06, never cleared) makes the worker score all N(N-1)/2 = 2,338,203 pairs. Each pair runs a separate encoder call on two full texts (no vector reuse), at 1.7 to 1.8 s per pair, so the job needs about 1100 hours and never finishes. The encoder runs on the onnxruntime default thread pool (11 spinning threads on 12 cores), so one process takes 8.7 to 10.4 cores. The single-flight lock expires after 10 min without a heartbeat or PID check, so any long job is treated as dead, and every kill or new session restarts the job at pair 0. Same trigger as above: N went from 44 (946 pairs, seconds) to 2163.
3. HOOK STARVATION. Prompt-path hooks cold-start node (8 parallel starts per prompt). The budgets are wall-clock kills with no CPU reservation. Workers run at normal priority with an uncapped thread pool. Measured 24 to 40 times slower node starts under the encoder load, so every hook exceeds its 1.5 to 3 s budget and its output is discarded.
4. NOT the Eureka adapter branch. The code is from June to September 2026 and is identical in beta.59, beta.69, beta.72. The Eureka link is the DATA the Eureka workflow wrote into the room.

fix: NOT APPLIED (goal is find_root_cause_only). Proposal, smallest first:
  A. Scout bound (2 small edits): (1) in rs-engine.cjs runModeInternal, return the existing degraded envelope when artifacts.length exceeds a cap (for example 400, env-tunable) before buildLsaMatrix; (2) add timeout (for example 300000 ms) and killSignal to the rs-engine-cjs runStep in scout-cadence-runner.cjs. Better root fix later: replace the full Jacobi with top-80 subspace (block power or Lanczos) iteration, which is seconds at n=2000, and add the generated directories (engine-input-room, domain-map, full-catalog-run-*) to SKIP_DIRS or mark them non-artifacts.
  B. Scout single-flight: take an O_EXCL lock (with PID liveness check, process.kill(pid, 0)) at the top of scout-cadence-runner main, or write the throttle stamp at the START of the run.
  C. Drain bound: refuse or skip with a disclosure marker when pair count exceeds a cap (the encoder-unavailable skip path already clears the entry); embed each artifact once (fill vector in makeArtifact from one batched embedTexts and the existing .rs-engine-cache.json) so the cost is N encodes, not 2 per pair; this uses the vector seam that already exists at classifier line 178.
  D. Drain resource caps: pass session_options with intra_op_num_threads of 2 to pipeline() in embedding-spine.cjs, and call os.setPriority(0, 19) in the --worker.
  E. Lock: refresh the lock mtime on a timer or check the PID in acquireDrainLock; verify ownership in releaseDrainLock.
  F. Operator mitigation now, no code: SCOUT_CADENCE_SKIP=1 stops the scout spawn (exists). The drain has no switch; the stale queue entry must be removed by the owner, and per-write drains still cost 60 to 66 min each until fix C ships. Needs a human decision.

verification: Root cause confirmed by (a) sampling both live processes, (b) reproducing the Jacobi cost on a copy (sweep time, sweep count on a small proxy), (c) reproducing encoder thread count, core use and per-pair cost, (d) running the production lock code in a temp room, (e) git history and diff of the branch. Not done: a full Jacobi run to convergence (hours), a stack sample of PID 6258 (inspector not attached), measurement on the Windows host side.

files_changed: none (only this debug file). Probe scripts and logs are in /tmp/claude-1000/-home-jsagi/1b58f9b8-3dd0-4337-9fcc-c2cdb16188ea/scratchpad/ (jacobi-probe.cjs, jacobi-converge.cjs, encoder-probe.cjs, lock-probe.cjs and their logs).
