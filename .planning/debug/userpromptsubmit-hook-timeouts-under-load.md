---
kind: rca
status: diagnosed
slug: userpromptsubmit-hook-timeouts-under-load
opened: 2026-11-26
classification: NEW FAILURE (overlaps Phase 400.3 scope: 400.3-06 hook-safe opener, 400.3-11 auto-explore-drain trace, 400.3-15 shell chain)
---

# UserPromptSubmit hooks killed at their 3 s / 5 s budgets

## Symptom (navigator paste, 2026-11-26, installed v2.0.0-beta.91)

Six UserPromptSubmit hooks timed out in one prompt and their output was discarded:
brain-derivation-drain (3 s), first-install-router (3 s), admin-command-gate (3 s), jtbd-update userprompt (3 s), auto-explore-drain (3 s), run-hook.cmd intent-classifier (5 s).

## Measurements (this session)

- Machine at the time: load average 20.5 on 12 cores, 6 interactive Claude sessions, a Python test run and git at 100% CPU.
- Isolated HOME, empty room: every hook 27-136 ms; bare `node -e ''` 32 ms.
- Large room copy (431 notes, 3,830 claims, room.db present): auto-explore-drain 3,300 ms, then 208 ms and 675 ms on reruns; CPU profile of the same run shows only ~264 ms of work (top: navigation/memory-events.cjs logEvent, hmi/selector-telemetry.cjs recordSelectorMirror). The rest is waiting.
- The other five stayed under 140 ms on the large room copy when run one at a time.

## Root cause

1. Lock wait longer than the hook budget. `lib/core/room-db.cjs:287-288` opens room.db with `timeout: 5000` (5 s busy wait). Hooks that write room.db on every prompt (auto-explore-drain via navigation logSpineRead and memory events; brain-derivation-drain; jtbd-update) inherit that 5 s wait while their host budget is 3 s. Under contention (MCP server writes, parallel hooks, other sessions) the host kills the hook mid-wait. Same class as 400.3-06.
2. Parallel cold starts under load. Six node processes start at once per prompt. At load average ~20 on 12 cores, two hooks that do no room.db work (first-install-router, admin-command-gate) still miss 3 s. intent-classifier goes cmd -> bash -> node (same class as 400.3-15).

## Fix direction

- Use the 400.3-06 hook-safe opener (busy wait derived from the remaining hook budget, about 750 ms, one retry, then a typed "busy, skipped" outcome) in every UserPromptSubmit hook that opens room.db.
- Fold the per-prompt node hooks into one process (Phase 402 hook consolidation) so one cold start serves six checks.
- intent-classifier: call node directly (400.3-15 pattern).

## Gates
Part 8 unchanged (local only). Tri-polar: hooks are CLI only; Desktop and Cowork have no UserPromptSubmit hooks.

## Update 2026-11-26 09:24 (second navigator paste: all six hooks, twice in a row)

- admin-command-gate and first-install-router also time out. admin-command-gate reads stdin and one small JSON file (~/.mindrian/admin-identity.json); measured 25-28 ms three times with the real HOME at load 2.5.
- Host at the time of the paste: /proc/pressure/io full avg60 = 12.8-14.7 (every task stalled on disk IO about 13% of the time), earlier load average 20 on 12 cores (6 Claude sessions plus test suites and git).
- Conclusion: for the hooks that touch no database, the plugin is not slow; the host is starved, and six separate node cold starts per prompt multiply the exposure (six processes must each get scheduled and read their module graph inside 3 s). Cause 1 (5 s lock wait in a 3 s budget) is real for the three room.db hooks; cause 2 is per-prompt process count.
- Added fix: one UserPromptSubmit dispatcher process runs the six checks in-process with per-check deadlines (QA-F11 part B). This takes the UserPromptSubmit slice of Phase 402's hook consolidation; Phase 402 keeps the other events.
