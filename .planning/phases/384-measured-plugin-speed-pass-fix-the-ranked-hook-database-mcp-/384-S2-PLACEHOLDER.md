# Phase 384 - S2 note (superseded)

This note is not a PLAN file and holds no task. It replaces the placeholder of the first Wave 2 planning run.

Plan 384-11 is done. Its Write measurement (the cascade costs about 3,553 ms wall and 5,015 ms CPU per artifact Write on the harness layout) and its counted session frequency (median 0 Write or Edit per development session) unblock S2 on the Write path. That part is planned in `384-20-PLAN.md` (requirement PERF384-F09): an RCA of the cascade path rule, one owner decision, and only then a behavior-preserving change with a measured before and after.

Not planned yet: S2 on the Stop event (8 hooks, 35 to 38 node starts, 1,500 ms CPU per Stop on the fixture room) and on UserPromptSubmit (8 hooks, 240 ms CPU). They are the larger S2 costs per event. Phase 385 plans 385-08 to 385-11 unwire some of their entries (the operator-update Stop entry and matcher, the jtbd-update Stop leg, query-efficiency on Read, SlashCommand telemetry), and the per-turn doctor poll needs an owner ruling first. A later planning run decides whether to plan Stop and UserPromptSubmit early exits after Phase 385 has landed. Merging or removing a hook entry then needs the Part 11 regeneration (`node scripts/build-connector-registry.cjs` and `node scripts/build-orchestration-projection.cjs`).

Requirement ids: PERF384-F08 is the split doctor-all gate (plan 384-19). PERF384-F09 is the S2 Write path (plan 384-20).
