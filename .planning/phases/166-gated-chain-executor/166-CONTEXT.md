---
kind: context
phase: 166
slug: gated-chain-executor
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
spec_loaded: true
status: context-captured
sequence: "SECOND in v1.14.0 (163 done -> 166 -> 164 -> 165)"
---

# Phase 166 Context: Gated Chain Executor (runChain spine)

<domain>
Ship ONE shared runtime, `lib/core/chain-executor.cjs` (`runChain`), that takes a sequence of
reaches/commands and runs it as gated autopilot: invoke a step, capture its structured output, pass
it forward, loop; auto-run `autonomous_safe` steps and HALT at material-decision steps at the
Tri-Context Decision Gate. This is the execution RUNTIME that the suggester (122/143/144) and the
orchestration projection (157/SEED-024) assume exists, and the runtime SEED-032 (harness-as-code)
declares. ~80-85 percent repoint of shipped code; the net-new is the contract, the gate, and the
migration.
</domain>

<spec_lock>
Requirements are LOCKED by `.planning/phases/166-gated-chain-executor/166-SPEC.md`. MUST read before
planning. The SPEC defines EXEC-01..04 + pre-work blockers B1-B4. Do NOT re-derive WHAT/WHY; this
CONTEXT captures only the HOW decisions resolved in discussion. The discussion ADDED two requirements
(EXEC-05, EXEC-06) and RESOLVED the four pre-work blockers (see decisions).
</spec_lock>

<decisions>

### D-166-01: EXEC-05 retry/backoff is a HARD REQUIREMENT in this phase (navigator-LOCKED 2026-06-18)
Fold SEED-028 (workflow synthesis retry/fallback) into Phase 166 as EXEC-05, NOT a fast-follow. The
executor ships reliability-complete: a transient 5xx (500/502/503/529) on any chain step -- especially
the terminal synthesis step -- triggers bounded retry-with-backoff, and on exhaustion returns a
GRACEFUL PARTIAL (upstream results preserved + a failure marker) so the chain is never silently
dropped (the AION failure mode, SEED-028). Reuse the existing resume/journal substrate for partial
re-run; do not build a new orchestration path. EXEC-06 (token budget + early-kill: maxSteps, quality
early-stop, distilled output-passing, per-step model routing) is also IN-scope (from the token
analysis).

### D-166-02: pipeline-state.cjs is the SOLE chain-state source of truth (B1 resolved)
Standardize chain resume/position on `lib/mcp/pipeline-state.cjs` (`room/.mindrian/pipeline-state.json`
-- explicit chain_position / gating / history). The artifact-frontmatter scan
(`commands/pipeline.md:59-79`) becomes a SECONDARY index only, not a competing source. This
reconciliation must land BEFORE any runChain loop code (it is the load-bearing pre-work). Promote
`checkPosition.isNext` to a hard gate.

### D-166-03: three-map recipe-source layering, one job per map (B4 resolved)
The cook reads three EXISTING maps, each for exactly ONE job; they are layered, not merged:
- `data/command-registry.json` (Phase 122) -> posture/autonomy authority (`postureFn` reads `autonomous_safe`).
- `data/connector-registry.json` (Phase 143.3) -> reach -> surface wiring (`onStep` dispatch target).
- `data/brain-orchestration-projection.json` (Phase 157) -> ranked next-reach (the chef's suggestion).
This gives the dark 207-node projection a NAMED CONSUMER (Phase 166) and prevents the three maps from
drifting into the divergence the executor exists to kill. No map is merged or retired in this phase.

### D-166-04: runChain lives in lib/core (shared CLI+MCP); migrate one surface per wave (B3 + build shape)
`runChain` ships in `lib/core/chain-executor.cjs` (shared by the CLI entry and the MCP server, thin
command wrappers, Tri-Polar parity per CLAUDE.md). Migration cadence: act (DONOR -- extract the spine
from `scripts/act-command.cjs`) -> pipeline (CONSUMER, add `provenanceFn` + resume via D-166-02) ->
ignite (CONSUMER, all-material 3-gate birth with the birthRoom ordering guard) -> larry-extended /
larry-personality handoff seam. ONE surface per wave; CI green between each. B2 holds: do NOT change
`decide()`'s return shape (`navigation-engine.cjs:596`; many consumers) -- the executor re-calls
`decide()` per loop and joins posture from the registry.

### D-166-05: canon guards are non-negotiable build constraints (carried from the SPEC + 163 precedent)
- Part 3: gateFn MUST halt on any non-`autonomous_safe` step ("the navigator always decides",
  larry-personality SKILL.md:59); irreversible steps (email/deploy/publish/external write) are
  forced-material regardless of tag.
- Part 8: zero Brain egress; posture joined from the LOCAL registry; typed packets only.
- Part 9: all writes via the navigation.cjs chokepoint; truth-claims land `proposed`.
- No em-dashes (CLAUDE.md HARD RULE). Harness-as-code 9 properties incl. an adversarial structured
  verdict wave (mirror the Phase 163 verify wave that caught FINDING-163-06-01).
</decisions>

<canonical_refs>
- `.planning/phases/166-gated-chain-executor/166-SPEC.md` -- LOCKED requirements; MUST read before planning.
- `.planning/phases/166-gated-chain-executor/166-RESEARCH.md` -- the phase research log.
- `.planning/research/2026-06-18-orchestration-executor-dual-graph-conversation.md` -- full Q&A + 11-agent fan-out.
- `.planning/seeds/SEED-032-harness-as-code.md` -- the harness manifest this is the runtime for.
- `.planning/seeds/SEED-024-brain-as-orchestration-graph-framework-tiers.md` -- the suggester/orchestration graph.
- `.planning/seeds/SEED-028-workflow-synthesis-step-retry-and-fallback.md` -- EXEC-05 retry contract.
- `.planning/phases/157-brain-orchestration-graph-and-methodology-tiers/` -- the projection (Phase 166 is its first consumer).
- `docs/MINDRIAN-CANON.md` (v1.10) Parts 3/4/7/8/9/10; `CLAUDE.md` (Tri-Polar, reuse-before-build, no em-dashes).
</canonical_refs>

<code_context>
Reusable assets (the ~80-85 percent repoint):
- `scripts/act-command.cjs:13-26` -- loop runner + stop-condition + kill-switch (the DONOR; extract the spine).
- `lib/workflow/command-resolver.cjs:131-152` -- validateChainAutonomy + composeWorkflow (postureFn + step resolution).
- `agents/framework-runner.md:40-41,120-136` -- the per-step brick (previous_output -> chain_output; carries quality).
- `lib/core/navigation-engine.cjs` decide() (do NOT change return shape; navigation-engine.cjs:596).
- `lib/core/model-profiles.cjs:18-57,119-149` -- per-step model routing (EXEC-06).
- `lib/mcp/pipeline-state.cjs` -- the chain-state store (D-166-02 sole truth).
- `lib/core/navigation.cjs` -- the write chokepoint (Part 9).
- `commands/act.md`, `commands/pipeline.md`, `commands/ignite.md` -- the three loops to migrate.
- `data/command-registry.json`, `data/connector-registry.json`, `data/brain-orchestration-projection.json` -- the three recipe maps (D-166-03).
- Phase 163 verify wave (`tests/test-trending-to-absurd-verdict.cjs`) -- the adversarial-verdict pattern to mirror.
</code_context>

<deferred>
- The full SEED-032 harness MANIFEST schema (this phase ships the runtime the manifest will later declare).
- Live Brain consumption of the Phase 157 projection (deferred with 157; 166 reads decide() + the local projection cache).
- Collapsing/merging the three recipe maps (explicitly NOT done; layering chosen, D-166-03).
</deferred>
