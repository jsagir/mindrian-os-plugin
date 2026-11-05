# Phase 384 - S2 PLACEHOLDER (not a plan)

Written 2026-11-06 by the Wave 2 planning run. This file is a note. It is not a PLAN file, no executor runs it, and it holds no task. S2 is planned in a later planning run.

## Why S2 has no plan now

Owner decision 7 (384-OWNER-DECISIONS.md): one short measurement of PostToolUse:Write with the cascade running comes before any S2 fix plan. That measurement is plan 384-11, written by another planner. Owner decision 1 lists S2 for Wave 2; the order of the two decisions is: measure Write first, then plan S2.

## What is known (all from 384-RANKING.md and measurements/, labelled there)

- S2 is the hook fan-out per event: UserPromptSubmit 8 hooks, Stop 8 hooks (7 blocking, 1 async) with 35 to 38 node starts and 4 find walks, a Read 2 hooks, a Write 8 hooks. Verdict CONFIRMED by the fixed rule of plan 384-09.
- Cost per occurrence on the fixture room (CPU of blocking hooks): Stop 1,500 ms, UserPromptSubmit 240 ms, Write 425 ms, Read 40 ms. Local copy: Stop 2,575 ms, UserPromptSubmit 505 ms, Write 900 ms, Read 85 ms. These are sums over hooks that run side by side, so they are above the waiting time (Stop wait 1.2 s fixture, 1.7 s local copy).
- The Write rows are a lower bound. The harness touched ROOM.md on the fixture, and the cascade skips that file; a Write that runs the cascade on a harness-layout room cost 2,995.2 and 2,987.4 ms more (plan 384-10, n 15, spread 0.3 percent). Plan 384-11 re-measures this. No S2 plan may use a Write number from before plan 384-11.
- Plan 384-10 readings that bear on S2: operator-update costs 6.5 to 8.0 ms above a bare node start per call and does no room work on the registry shape the product writes (T02); the cascade is skipped at 59.4 ms on a default-layout room (T04); the Stop HMI poll costs 119.5 and 121.4 ms, 46.0 and 47.0 ms above doctor alone (T05).

## What the S2 planning run must read first

1. The result of plan 384-11 (its summary and measurement files).
2. The state of Phase 385. Plans 385-08 to 385-11 edit hooks/hooks.json and unwire the operator-update Stop entry and matcher, the jtbd-update Stop leg, query-efficiency on Read and SlashCommand telemetry. S2 candidates that overlap with those entries are not planned twice. Find code by symbol, never by line number from a measurement file.
3. Part 11 of the canon: merging or removing a hook entry changes the born-wired registry and the harness manifest, so each such change regenerates them with the repo's own generator (`node scripts/build-connector-registry.cjs` and `node scripts/build-orchestration-projection.cjs`; check mode `--check`).

## Rules that carry over unchanged to the S2 plans

- One plan per fix. A failing test first. A parity test for each changed hook: the stdout envelope stays byte-identical.
- Measure with the Wave 2 tooling of plan 384-12 (ab-verdict, pin-tree, interleaved A B, B A, A B, B A on pinned exports, n of 7 or more, median and p95, flock `$HOME/.cache/mos-perf-384.lock`, taskset -c 0-3, fixture room). Floor: 50 ms per event (owner decision 2). A change stays only on a KEEP verdict.
- The plans are serial (one host, one lock): the plan numbers continue after 384-18, and each takes a wave number above the last Wave 2 plan.
- Hooks and the MCP server stay .cjs. Do not change the spawns in room-scan or room-render-analyze. Do not change lib/core/mcp-dep-heal.cjs. Real-room copies stay local, counts and timings only (Canon Part 8). No push, tag or release without the commit review and an explicit owner go (owner decision 12).
- Requirement id reserved for S2: PERF384-F08.
