---
id: SEED-099
status: dormant
priority: high
planted: 2026-09-30
updated: 2026-09-30
planted_during: "field observation on the navigator's laptop (Windows 11 + WSL2), repo HEAD 6c68075c2, plugin 2.0.0-beta.52"
trigger_when: "before the next public release cut, or immediately if any user reports fan noise, battery drain or memory pressure while MindrianOS is on, whichever comes first"
scope: "small-medium (resource guards on three existing spawn sites, one global lock, one battery gate, ONNX thread cap, test-216 hygiene; no new engine, no behavior change to what the producers compute)"
depends_on: []
feeds: [Phase 355.1 ambient run, /mos:eureka, /mos:doctor]
canon_parts: [8, 9, 10]
evidence: ".planning/debug/eureka-ambient-resource-exhaustion.md"
navigator_ruling: "2026-09-30: seed the fix in the repo so other users do not hit it. Open product question: on battery, is the ambient run OFF by default or only DEFERRED?"
---

# SEED-099: Background eureka / ambient children must not exhaust the user's laptop

**Governing thought:** MindrianOS's background intelligence has to run like background work.
That means low priority, a bounded heap, bounded threads, one run at a time per machine, and no
run on battery. Today the eureka and ambient children run like a foreground build. The user
notices this before any insight reaches them, and it breaks Canon Part 10 (the conversation is
the product), because the machine goes slow before the reward arrives.

## What happened

The laptop dropped to 3.2 GB free of 31.6 GB within 28 minutes of boot. The battery drained by
tens of percent and the fan started running. One `node tests/test-216-eureka-command.cjs` process
reached **360% CPU and 5.9 GB RSS** after 8 minutes of CPU time. A looping harness session then
started it again. Full evidence tables, reproduction steps and line references are in
`.planning/debug/eureka-ambient-resource-exhaustion.md`.

## Root cause (short)

No background spawn site sets any resource guard. A grep for `max-old-space-size`,
`os.setPriority`, `nice` or any battery check on eureka and ambient paths finds nothing.

| Spawn site | Has | Missing |
|---|---|---|
| `lib/core/ambient-trigger.cjs:342` -> `auto-explore-fire.cjs` | 1/hour/room, room lock, 4-min budget, top-10 | priority, heap cap, battery gate, **machine-global** cap |
| `scripts/auto-explore-fire.cjs:215,244` (discovery-cycle + python rs-engine) | 30 s / 60 s SIGKILL | priority, heap cap |
| `scripts/eureka-command.cjs:478` (`/mos:eureka start`) | nothing | timeout, priority, heap cap, orphan reaping |

- The throttle and lock are **per room**, so N rooms or N sessions give N concurrent children.
- **Plausible, profile first:** the 360% CPU in a single node process with 65 GB of virtual
  memory points at the onnxruntime thread pool. `hybrid-retrieve.cjs:185` and
  `embedding-spine.cjs` load transformers.js without setting a thread count, and a warm HF cache
  means the model actually runs.
- **Dev layer:** `test-216` spawns test-215 with no timeout (`:251`). Its behavior 12 can orphan
  a detached `run` child and `rmSync` that child's room (`:348` + finally). The offline preload
  reaches only spawned children, not the in-process calls.

## Build this

1. **F1 priority:** call `os.setPriority(child.pid, 10)` after each background spawn. On Windows
   this maps to BELOW_NORMAL.
2. **F2 heap:** add `--max-old-space-size=${MINDRIAN_BG_HEAP_MB:-1024}` to the child execArgv.
3. **F3 threads:** in background mode, set ONNX `numThreads` / `intraOpNumThreads` to
   `max(1, floor(cpus/4))`, overridable with `MINDRIAN_BG_THREADS`.
4. **F4 battery gate:** make `evaluateAndClaim` return `skipped:on_battery` when on battery. Read
   `/sys/class/power_supply` on Linux/WSL, `Win32_Battery` on Windows, `pmset -g batt` on macOS.
   Record it in the ledger.
5. **F5 global lock:** allow at most one ambient or eureka child per machine. Put the lock in
   `~/.mindrian/bg.lock` and treat it as stale after 8 min, matching the room lock.
6. **F6 eureka start budget:** add a watchdog inside the `run` child (default 10 min) that
   SIGKILLs it and writes `state:'timeout'`.
7. **F7 test hygiene:** give the test-216 spawnSync a timeout. Kill the status.json PID in
   `finally` before `rmSync`. Require the offline preload in-process. Set
   `MINDRIAN_FORCE_RERANK_ABSENT=1` for hermetic runs.
8. **F8 doctor:** make `/mos:doctor` list and offer to reap eureka/ambient children older than
   their budget.

## Acceptance

- [ ] Every background child shows nice >= 10 (`ps -o ni`).
- [ ] Peak RSS stays <= 1.2 GB per background node child on the 36- and 200-entry fixtures.
- [ ] ONNX threads in background mode stay <= `floor(cpus/4)`.
- [ ] No ambient run starts on battery below the threshold, and the ledger shows `skipped:on_battery`.
- [ ] 3 rooms open at once produce <= 1 concurrent background child.
- [ ] `/mos:eureka start` children die at the budget with `state:'timeout'`.
- [ ] `test-216` leaves zero surviving children even when behavior 12 times out, and its wall time is bounded.
- [ ] A regression test pins F1, F2 and F5 through the real trigger with a stub fire script.

## Open questions

- Confirm or rule out the ONNX thread fan-out with `--cpu-prof`, or with `/proc/<pid>/task`
  plus a grep for onnx in `/proc/<pid>/maps`. The result decides whether F3 is the main fix.
- Product decision: on battery, is the ambient run OFF by default or only deferred?
- Out of plugin scope, but worth documenting in install guidance: MCP servers are duplicated
  once per Claude session.
