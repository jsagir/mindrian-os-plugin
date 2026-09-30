---
methodology: research
title: "Eureka rethink: retire the engine, keep the perspective inside the research planner; the MCP canvas tooling; one home for Claude model routing"
created: 2026-10-01
status: active
room_section: research
informs: "dev/MindrianOS-Plugin SEED-099, SEED-100, SEED-101, SEED-103; .planning/REVIEWS/2026-10-01-eureka-architecture-review.md; .planning/REVIEWS/2026-10-01-eureka-v2-design.md; Phase 366 (promotes SEED-103); branch seed-103-eureka-perspective"
related: 2026-10-01-deep-research-planner-363-close-out.md, 2026-09-25-phase-355-hidden-in-plain-sight-close-out.md, 2026-09-27-ambient-trigger-room-starts-the-run.md
sources: "355-VERIFICATION.md; 355-26-SUMMARY.md; 355-JEV-MEASUREMENT.md; Phase 355 D-10/D-14/D-44/D-46; Phase 355.1 ambient composition; Phase 363 research-planner CONTEXT.md; SEED-097 MOS-CANVAS perspectives; docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md; icm-architect and mcp-builder skills; langtalks-graph-expert citations; claude-api reference (cached 2026-09-25); dogfood room.db counts 2026-10-01; tests/run-all-seed103.sh"
---

# Eureka rethink, the Eureka perspective in the research planner, and the MCP canvas tooling

Filed 2026-10-01. Research trail for SEED-099, SEED-100, SEED-101, SEED-103, the
2026-10-01 architecture reviews, and the SEED-103 implementation on branch
`seed-103-eureka-perspective` (commit 00a6e5f85 plus the mcp-builder pass).
Counts and citations only; no room content. Hyphens only.

## What was asked

The navigator's laptop slowed under a background Eureka run (a test child at
360% CPU and 5.9 GB RSS). The questions that followed, in order: what is wrong
with Eureka; should it be rethought with Jev and a larger Claude model; can the
canvas use the local graph and the ICM structure instead of embeddings; is
Eureka redundant with the MCP-based canvas layer; and should the room's nodes be
reformed to play better with Theo.

## Sources, and what each contributed

| Source | Contribution |
|---|---|
| `.planning/phases/355-*/355-VERIFICATION.md` | the measured record: engine output useful 43 of 96 (44.8%); direction right 16 of 96; Theo not asked for 80.2% of pairings; strong-tier stamp carried no measured information; 45 of 96 already known to the navigator |
| `.planning/phases/355-*/355-26-SUMMARY.md`, `355-JEV-MEASUREMENT.md` | Jev usefulness judge 76.04% agreement (n 96), 53.85% on strong (n 13); already_known 2 of 96; citation check 95.35% with the rule stated; costs of those runs; vendor list price |
| Phase 355 D-10, D-14, D-44, D-46 | local canon-name resolution; judge none at runtime; Jev dev-time only; bands from measured buckets only |
| Phase 355.1 (`ambient-run.cjs`, `scout-cadence-guard.cjs`) | the ambient composition: throttle 1 per hour per room, lock, 4-minute budget; no priority, heap, thread, battery or machine-global guard |
| Phase 363 (`lib/core/research-planner/CONTEXT.md`, 20 of 22 plans) | the one plan-and-run engine; a command contributes questions, a lens, a falsifier |
| SEED-097 (MOS-CANVAS) | the Eureka perspective row and V5 (reuse selectively, no compulsory re-embedding) |
| `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` and the icm-architect skill | the ten invariants, the system-map form, who-verifies, orthogonality |
| langtalks-graph-expert (citations only) | LLM-as-a-judge: Vanishing Gradients Ep. 57, LangTalks #61, Lex Fridman #490, the navigator's Agent Factory note; reranking: LangTalks #25; MCP: LangTalks #44 (MCP intro), #55 (Context Engineering), #70 (Claude Code tips), Fragmented #307 (Harness Engineering); knowledge graph + ingestion: Memgraph (2025-09-30) |
| mcp-builder skill (`reference/mcp_best_practices.md`) | tool annotations, pagination (limit, offset, has_more, next_offset, total), actionable errors, descriptions that match functionality |
| claude-api skill (cached 2026-09-25) | current model ids and per-generation request rules; the rule that Opus is the default and no role is downgraded for cost by default |
| Dogfood rooms (`~/MindrianRooms/*/.mindrian/room.db`, counted 2026-10-01) | 14 rooms, 700 to 11,145 nodes; all-pairs on the largest is about 62 million |

## Findings filed

1. `.planning/REVIEWS/2026-10-01-eureka-architecture-review.md`: the engine's cost is
   algorithmic (uncapped all-pairs, per-pair cohort re-sort, 2-3 whole-room re-embeds); the
   FlashRank rerank has no production caller; `--offline` still escalates entity extraction
   to Haiku; the side channel cannot fire (critic object vs string; no roomDir); ADRs E1-E7;
   the ICM system-map addendum (lib/core/eureka/ is the shared semantic index, about 40
   outside importers; live / leftover / ghost universes).
2. `.planning/REVIEWS/2026-10-01-eureka-v2-design.md`: retire the standalone engine, keep the
   perspective inside the planner; recall local with the room graph as the exclusion set;
   Jev the human-routed first-pass judge and citation checker; one declared egress policy;
   ADRs E12-E16; the spike with the 44.8% bar.
3. `.planning/debug/eureka-ambient-resource-exhaustion.md` and
   `.planning/debug/newborn-room-graph-not-connected-2026-09-30.md` (the Windows field report,
   re-verified at HEAD; client room name redacted).
4. Seeds: SEED-099 (guards, then algorithmic fixes first), SEED-100 (spike, superseded by
   SEED-103), SEED-101 (newborn room graph, health check folded into the Phase 343 organ),
   SEED-103 (retire the engine, keep the perspective).

## What shipped on the branch

Stages 01-03 of the Eureka perspective (`eureka-recall.cjs`, `eureka-judge.cjs`), the
`eureka` question template and lenses, MCP `research_run` ops `eureka_recall`,
`eureka_candidates`, `eureka_judge`, the CLI door, the dev-time Jev first pass, and
`lib/core/claude-routing.cjs` as the one home for Claude model ids under lib/. Aggregator
`tests/run-all-seed103.sh` green. Measured on a copy of a real 798-node room: 51 things,
9 sections, 47 candidates, canon_resolved 0.

## Open, carried into the phase

The runtime-Jev ruling; the Haiku entity pre-step as a planner egress line or a separate
producer; the spike with the navigator's gold; retiring the standalone runner; the
semantic-index split; canon Framework handles on room nodes so Theo can be asked; the
section column on `artifact_file` claims (SEED-101 P1-3).
