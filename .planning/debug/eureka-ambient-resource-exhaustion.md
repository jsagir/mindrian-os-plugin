---
title: Eureka / ambient-run background children can exhaust RAM, CPU and battery on user laptops
status: open
severity: high (user-facing perf + battery); medium (dev test suite)
reported: 2026-09-30
reporter: field observation on the founder's laptop (Windows 11 + WSL2, 32 GB RAM)
plugin_version: 2.0.0-beta.52 (repo HEAD 6c68075c2)
area: eureka, ambient-run (Phase 355.1), auto-explore fire child, test harness
---

# Eureka / ambient-run resource exhaustion

## 1. Symptom (what the user sees)

- The laptop gets slow and "memory clogs"; Windows was down to **3.2 GB free of 31.6 GB** within **28 minutes of boot**.
- Battery drops by **tens of percent** during a session.
- The fan spins up audibly; it did not before these phases shipped.

## 2. Evidence captured (2026-09-30, ~07:20 WSL time)

Windows side:

| Process | RAM | Note |
|---|---|---|
| `vmmemWSL` | 15,244 MB | WSL VM; `.wslconfig` caps it at 18 GB, and 8 GB swap is allowed |
| `claude` x9 | 1,794 MB | several concurrent Claude Code sessions |
| `python` x32 / `node` x21 | 1,225 / 1,185 MB | MCP servers **duplicated per session** (6x arxiv, 6x git, 4-6x neo4j, 4x nanobanana, ...) |

Inside WSL (`ps aux --sort=-%mem`):

| PID | CPU | RSS | Command |
|---|---|---|---|
| 202790 | **360%** | **5.9 GB** (VSZ 65 GB) | `node tests/test-216-eureka-command.cjs` - running 8 min of CPU time |
| 204134 | 62% | 260 MB | `.venv/bin/python3 mention_candidates.py ...` |
| 214423 | 189% | 71 MB | `python3 -c import sklearn` |
| 214374 | 107% | 163 MB | `node tests/test-220-ingest-safety.cjs` |

WSL memory: 7.9 GB used, **4.5 GB of 8 GB swap in use**.

About 8 minutes later, PID 202790 had exited, but `test-216-eureka-command.cjs` had **started again** as PID 337801. It was at about 1 GB RSS after one minute. Around it were `run-harness.cjs --check --json`, `test-355-eureka-ranking-pin.cjs` and `python3 -c import sentence_transformers` (Theo). This means a Claude session was re-running the full suite in a loop.

## 3. Root-cause analysis

The problem has two layers. **Layer A** is what real users will hit. **Layer B** is what made it acute on the dev machine.

### Layer A - production code paths (affects every user)

**A1. Detached children have no resource limits of any kind.**
`grep` for `max-old-space-size`, `os.setPriority`, `nice`, or any battery/power check across `scripts/`, `lib/` and `hooks/` finds no hit on any eureka or ambient path. Each of these spawn sites runs a heavy child at normal priority, with an unbounded V8 heap and an unbounded ONNX thread pool:

| Spawn site | Child | Guards present | Guards missing |
|---|---|---|---|
| `lib/core/ambient-trigger.cjs:342` `evaluateAndMaybeSpawn` | `scripts/auto-explore-fire.cjs` (detached, `stdio:'ignore'`, `unref`) | 1 run/hour/room (`AMBIENT_MAX_RUNS_PER_HOUR`), lock (stale after 8 min), 4 min total budget, top-N=10 | memory cap, CPU priority, battery/AC check, global (cross-room) cap |
| `scripts/auto-explore-fire.cjs:215,244` | `node discovery-cycle.cjs --steps all` + `python3 rs-engine.py --mode hybrid --topk 5` in parallel | 30 s per pipeline, 60 s total, SIGKILL on timeout | memory cap, priority |
| `scripts/eureka-command.cjs:478` `cmdStart` (`/mos:eureka` fire-and-return) | `node eureka-command.cjs <room> run` (detached, `unref`) | **none** | timeout, memory cap, priority, orphan reaping |

**A2. The throttle is per room, not per machine.**
`AMBIENT_LEDGER_RELPATH` and `AMBIENT_LOCK_RELPATH` sit under `<room>/.mindrian/`. A user who touches 3 rooms in an hour can get 3 concurrent ambient runs. Each run starts node, python `rs-engine` and possibly transformers.js/ONNX. Several Claude sessions multiply this further.

**A3. `eureka-command start` has no ceiling at all.**
Unlike the ambient child, the `/mos:eureka start` child has no wall-clock budget. On a large room, or with a real encoder and reranker loading, it runs until it finishes. Nothing kills it if the parent session ends.

**A4. ONNX thread fan-out (plausible, not confirmed).**
A single node process at 360% CPU with 65 GB of virtual memory looks like the onnxruntime / transformers.js thread pool, not V8. `lib/core/eureka/hybrid-retrieve.cjs:185` lazy-loads `@huggingface/transformers` for the FlashRank rerank. `embedding-spine.cjs` loads it for embeddings. No `intraOpNumThreads` / `numThreads` setting exists anywhere under `lib/core/eureka/`, so ONNX defaults to every core. The HF cache on this machine already holds models (`all-MiniLM-L6-v2`, `all-mpnet-base-v2`, `multilingual-e5-large`, `llm-embedder`), so a cache-only load **succeeds** and the model actually runs.
*Verification needed:* profile PID of a running eureka child with `--cpu-prof`, or check `/proc/<pid>/task | wc -l` and the loaded `.so` libs (`grep onnx /proc/<pid>/maps`).

### Layer B - dev test suite (affects contributors and CI, and was the acute trigger)

**B1. `test-216` runs the whole Eureka pipeline many times, and nests another suite.**
It makes 11 in-process `runner.main` / `dispatcher.main` calls on fixture rooms (up to `--top 5000`). Behavior 6 then `spawnSync`s `tests/test-215-portfolio-report.cjs` (`test-216:251`) with **no `timeout`** option.

**B2. The offline preload does not reach the in-process calls.**
`tests/eureka-offline-preload.cjs` (which sets `transformers.env.allowRemoteModels=false`) is injected only through `NODE_OPTIONS` into **spawned children** (behaviors 6 and 12). The test's own process loads it only when an aggregator preloads it. `--offline` switches the *embedding* to `stubEncode` (`eureka-portfolio-report.cjs:1021`). It is not established that every rerank/classifier path honours `--offline`. With models cached locally, a real ONNX load in-process is plausible (see A4).

**B3. Behavior 12 can leave an orphaned detached child.**
`test-216:348` runs `eureka-command start`, which spawns a detached, unref'd `run` child, then polls for at most 30 s. If the child is slow (a loaded machine), the test fails the assertion and **its `finally` deletes the fixture room with `fs.rmSync`**. The detached child keeps running with no parent and no timeout, against a deleted directory. When the suite is looped, these orphans pile up.

**B4. Harness looping.**
The repo has 1,305 `tests/test-*.cjs` files plus about 190 `run-all-*.sh` aggregators. An agent session looping `run-harness.cjs --check` re-runs B1-B3 every cycle while other heavy tests (`test-220`, sklearn, `sentence_transformers`) run at the same time.

### Environment amplifiers (not plugin bugs, but they worsen the symptom)

- MCP servers are started **per Claude session**. With 4+ sessions that is about 50 duplicate processes.
- `.wslconfig memory=18GB` + `swap=8GB` lets WSL take most of RAM. `autoMemoryReclaim=dropcache` returns memory lazily.

## 4. Impact on other users

- Any user with the eureka deps installed (a doctor L1 `deps_present` requirement) and a warm HF cache gets real ONNX inference in background children. It runs at full core count and normal priority, including on battery.
- Laptop users see fan noise, battery drain and memory pressure about once an hour per active room. It is worse with several rooms or sessions.
- `/mos:eureka start` on a large room can run without limit and outlive the session.
- Contributors running the test suite locally can make their machine unusable.

## 5. Reproduction

Production path (A):
1. Install the plugin with eureka deps; make sure `~/.cache/huggingface/hub` has an embedding model.
2. Open 2-3 rooms in separate Claude Code sessions and make edits that change the room delta hash.
3. Watch `ps -eo pid,pcpu,rss,etime,cmd | grep -E "auto-explore-fire|eureka|rs-engine"`: several detached children run at once at high CPU.
4. Separately, run `/mos:eureka start` on a room with 200+ entries and watch the child's lifetime and RSS.

Test path (B):
1. `cd MindrianOS-Plugin && /usr/bin/time -v node tests/test-216-eureka-command.cjs`. Note the max RSS and elapsed time.
2. Run it again with `stress-ng --cpu 4` in the background. Behavior 12 times out, then `ps` shows the orphaned `eureka-command.cjs ... run` child still alive.

## 6. Proposed fixes

Priority order. Every fix is small and local.

| # | Fix | Where |
|---|---|---|
| F1 | Spawn all background children at low priority: `os.setPriority(child.pid, 10)` (POSIX nice 10; on Windows it maps to BELOW_NORMAL) right after `spawn`. | `ambient-trigger.cjs:342`, `eureka-command.cjs:478`, `auto-explore-fire.cjs` spawnAsync |
| F2 | Cap the V8 heap: add `--max-old-space-size=1024` (configurable via `MINDRIAN_BG_HEAP_MB`) to the child argv. | same three sites |
| F3 | Cap ONNX threads: set `env.backends.onnx.numThreads` / session `intraOpNumThreads` to `max(1, floor(cpus/4))` in background mode (`MINDRIAN_BG_THREADS`). | `embedding-spine.cjs`, `hybrid-retrieve.cjs` |
| F4 | Add a battery/AC gate: skip or defer the ambient run when on battery below N%. Linux: `/sys/class/power_supply/*/online`. Windows: `Win32_Battery.BatteryStatus`. macOS: `pmset -g batt`. Record `skipped:on_battery` in the ledger. | `ambient-trigger.cjs::evaluateAndClaim` |
| F5 | Add a machine-global concurrency lock: at most one ambient or eureka child across all rooms and sessions (lock under `~/.mindrian/bg.lock`, stale after 8 min like the room lock). | `scout-cadence-guard.cjs` |
| F6 | Give `eureka-command start` a wall-clock budget (for example 10 min) with a SIGKILL watchdog inside the child, and write `state:'timeout'` to status.json. | `eureka-command.cjs` `run` path |
| F7 | Test hygiene: add `timeout: 120000` to the `test-216:251` spawnSync; in behavior 12, record the child PID from status.json and `process.kill(pid)` in `finally` before `rmSync`; load the offline preload in-process at the top of test-216 (`require('./eureka-offline-preload.cjs')`); set `MINDRIAN_FORCE_RERANK_ABSENT=1` for hermetic runs. | `tests/test-216-eureka-command.cjs` |
| F8 | Doctor check: `/mos:doctor` reports orphaned eureka/ambient children (older than the budget) and offers to reap them. | doctor |

## 7. Acceptance criteria

- [ ] No background child runs at normal priority. Verify with `ps -o ni` (value 10 or higher).
- [ ] Every background node child stays under 1.2 GB peak RSS on the 36-entry and 200-entry fixtures.
- [ ] ONNX inference in background mode uses no more than `floor(cpus/4)` threads.
- [ ] No ambient run starts on battery below the threshold. The ledger shows `skipped:on_battery`.
- [ ] Opening 3 rooms at once produces at most 1 concurrent background child.
- [ ] `eureka-command start` children die by the budget and report `state:'timeout'`.
- [ ] `test-216` leaves zero surviving child processes, even when behavior 12 times out, and has a bounded wall time.
- [ ] A regression test pins F1, F2 and F5: it spawns through the real trigger with a stub fire script and checks the nice value, execArgv and the global lock.

## 8. Open questions

- Is A4 (ONNX thread fan-out) confirmed? Profile it first; it decides whether F3 is the main fix or a secondary one.
- Should the ambient run be off by default on battery, or only deferred? This is a product decision.
- Should MCP server duplication across sessions be documented in install guidance? It is outside the plugin's control.
