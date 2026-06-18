---
kind: research
phase: 166
slug: gated-chain-executor
title: Research log - chaining/pipelining the whole surface (the Gated Chain Executor)
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
source: navigator Q&A session 2026-06-18 (7-lens multi-agent fan-out)
consumed_by:
  - Phase 166 (gated-chain-executor) 166-SPEC.md
shared_with:
  - SEED-024 (brain-as-orchestration-graph)
  - SEED-028 (workflow synthesis retry/fallback)
  - SEED-032 (harness-as-code)
  - Phase 157 (brain-orchestration-projection)
method: parallel read-only subagents, file:line citation discipline, navigator-gated forks
note: ".planning is gitignored; commit with git add -f per repo convention"
---

# Research log: the Gated Chain Executor

This is a faithful capture of the navigator Q&A that produced the Phase 166 SPEC.
It preserves the questions verbatim and the substance of each answer, plus HOW each
finding was produced. Any phase dealing with chaining, the harness, or the dual
graph should read this for the reasoning trail, not just the conclusion.

---

## 1. The navigator's line of inquiry (questions, in order, verbatim intent)

1. "What GSD phase or seed deals with pipelining, chaining, and utilizing every skill, agent, and command in MindrianOS, per Larry reacting with the graph spine and the dual graph as a suggester?"
2. "Where are those on the pipeline in terms of Mindrian versions?"
3. "I have a feeling the harness and the invocation of commands/agents/pipelines do not even exist to make what we are talking about happen."
4. "Fan out agents to look for how we might accomplish this - can a harness help, how, why - as a systems-thinking process with process mapping and causalities understood. Utilize the fable-mode + harness-as-code + Larry/PAI architecture concepts."
5. "This is an architectural change that enhances larry-extended, the larry skill, the ignite skill, etc."
6. "We have many relevant skills/agents/commands - not only the ones I mentioned - all relevant to the user."
7. "File the finding as a full phase SPEC in the mindrianOS room." (chose: Hybrid - gated autopilot)
8. "Explain all of this in Feynman style: what I asked, the findings, how they were found, the expected behavior, what was considered and deferred."
9. "Who is the cook, and what is its relationship to ICM and the dual graph (remote and local)? We modified the local graph - its current status?"
10. "What is the role of the remote graph, the local graph, and ICM?"
11. "File all my questions and your answers as research for any phase dealing with these challenges." (this document)

---

## 2. Method - how the findings were produced

- **Read-only fan-out.** Findings came from parallel subagents reading the live code, each required to cite file:line. No conclusions from memory.
- **Wave structure.** (a) locate the orchestration machinery; (b) map phases to versions; (c) two independent audits - one of the PLANS, one of the LIVE code - to test the "no executor exists" hunch; (d) a 7-lens fan-out (systems-thinking, harness control-plane, PAI memory/hooks, fable-mode discipline, build-vs-graft, blast-radius, full-catalog classification).
- **Navigator-gated forks.** At each branch the navigator chose the direction (locate vs assess-gaps; the gated-autopilot category; file as full SPEC). The research did not assume.
- **Self-verification.** When one subagent returned no detail, the catalog was counted directly from the filesystem (96 commands / 13 skills / 9 agents; posture-tag coverage). Live status (room.db, projection cache) was read directly, not asserted.

---

## 3. Findings

### 3.1 The suggester exists; the executor does not (the core finding)
There are two machines. The machine that DECIDES the next step exists; the machine that RUNS a chain does not.
- Suggester (shipped): graph spine (Phase 122), insight sensors (Phase 143), navigation-engine decide() (Phase 144), reach selector (Phase 148). All v1.13.0 / v1.13.1.
- Executor (absent): no invoke -> capture -> pass -> loop runner, in either shipped code or the v1.14.0 plans.

How found: two independent audits agreed. The plans-audit quoted Phase 157-SPEC ("nav-engine live CONSUMPTION ... deferred"). The code-audit showed act --chain (act.md:258-277) and pipeline (pipeline.md:82-109) are human-gated checklists, not loops; framework-runner runs ONE step.

### 3.2 But the executor is ~80-85% already built and scattered
- Loop + stop + kill-switch: scripts/act-command.cjs:13-26
- Posture gate: lib/workflow/command-resolver.cjs:131-152 (validateChainAutonomy reads autonomous_safe)
- Model routing: lib/core/model-profiles.cjs:18-57,119-149
- Per-step brick: agents/framework-runner.md:40-41,120-136 (previous_output -> chain_output)
- Posture authority: data/command-registry.json (autonomous_safe field)
The gap is NOT a greenfield engine; it is three divergent loop copies (act/pipeline/ignite) with no shared runtime, no single posture authority at runtime, no single trace.

### 3.3 Version placement
- Graph spine: Phase 122, v1.13.0 (shipped)
- Sensors / engine flip / selector: Phases 141/143/144/148, v1.13.1 (shipped)
- Dual graph (orchestration projection): Phase 157, v1.14.0-candidate (partial; consumption deferred)
- SEED-024 / SEED-032 vision seeds: v1.14.0+ (open/dormant)
- The executor itself: NEW, proposed as Phase 166, v1.14.0.

### 3.4 Catalog reality (counted live 2026-06-18)
96 commands, 13 skills, 9 agents. 50 of 96 commands declare autonomous_safe (45 true); 51 carry posture + reach_id. Over half the catalog is already chain-ready, so the spine upgrades ~40 framework commands into chainable step-bricks with near-zero per-command work.

### 3.5 The shared contract (the net-new ~15-20%)
runChain(steps, {postureFn, gateFn, onStep, provenanceFn, maxSteps, onHalt}) in lib/core/chain-executor.cjs.
Requirements EXEC-01 loop runner, EXEC-02 output-passing (carry quality signal), EXEC-03 posture x evidence-quality gate, EXEC-04 kill-switch + single trace. See 166-SPEC.md.

### 3.6 Three pre-work blockers
- B1: two resume stores (lib/mcp/pipeline-state.cjs vs frontmatter scan, pipeline.md:59-79). Pick one source of truth.
- B2: decide() returns ONE decision, not a ranked list (navigation-engine.cjs:596). Do not change its shape; re-call per loop.
- B3: reject the harness "all PASSING -> stop" convergence; the canon stop condition is the material-step halt (Part 3).

---

## 4. The mental model (the kitchen)

A recipe is not a cook. The system had recipes (who decides the order) but no cook (who runs the order).

| Role | MindrianOS component |
|---|---|
| Recipe book | dual graph + connector spine (connector-registry.json, Phase 157 projection) |
| Head chef (calls next dish) | Larry via navigation-engine.cjs decide() |
| The cook (NEW) | lib/core/chain-executor.cjs (runChain loop) |
| Line cook (one dish) | agents/framework-runner.md |
| Judge / owner | the human at the Tri-Context Decision Gate |

The cook is deliberately obedient: it does not pick the menu (chef) and does not own truth (human). That separation is what keeps Canon Part 9 intact.

### The three-graph division of labor (library / notebook / building)
- **Remote graph (Brain) = library of HOW TO THINK.** Methodology (pws tier) + generic machinery projection (mindrian-operation tier). Shared by all users. NEVER holds user data (Part 8).
- **Local graph (room.db) = notebook of WHAT YOU THOUGHT.** Claims, decisions, rejections, edges, memory events, chain state. The user's own. NEVER egresses to the Brain (Part 9).
- **ICM (folders) = the BUILDING the thinking happens in.** Identity (Layer 0), routing (Layer 1), cascade contracts (Layer 2), reference (Layer 3), artifacts (Layer 4). The folder IS the orchestration.

Allowed edge: Brain -> Local (generic methodology). Forbidden edge: Local -> Brain (user data). ICM gives meaning; the local graph gives navigability; the remote Brain gives technique.

The cook touches all three under the boundary: reads recipe SHAPE from the LOCAL cache of the remote machinery projection (never phones the Brain with user data); reads context and writes results to the LOCAL graph via navigation.cjs; walks the ICM folders to know where results belong and what cascades.

---

## 5. Live status snapshot (mindrianOS room, read 2026-06-18)

- room.db present at ~/MindrianRooms/mindrianOS/.mindrian/room.db plus 8 sub-room databases (venture/gtm, opportunities, fundraising, communications x2, qa, feedback). (Row counts not read - no sqlite client in the sandbox.)
- LOCAL dual-graph projection cache EXISTS and is populated: data/brain-orchestration-projection.json, generated 2026-06-15, 207 nodes = 180 mindrian-operation + 27 pws.
- connector-registry.json exists (~30 KB). Generator (build-orchestration-projection.cjs) and health check (check-dual-graph-health.cjs) exist.
- NOT live yet: continuous remote sync (Phase 137, deferred); nav-engine consumption of the projection for a ranked next-reach (deferred). This session showed routing_source: legacy, tier_0, BRAIN.md absent - the simple local fallback, not the rich projection.

Net: the local graph is real and rich, the local recipe map is built and tier-tagged, but the wire that lets the cook read that map for its next move is still on paper. Phase 166 (cook) + the deferred Phase 157 consumption (chef reads the richer recipe) close it together.

---

## 6. Considered and deferred (decision ledger)

Considered and CHOSEN:
- Gated autopilot over the two extremes (full robot / pure suggester). Keeps speed AND the human judge.
- Reuse-before-build: extract and repoint the ~80% that exists rather than write a new engine. No LangChain/CrewAI (Claude IS the model; the spine IS the harness).
- Spine-not-per-surface: one runChain that act/pipeline/ignite/larry-extended/larry-personality all call (DRY, one gate logic, one trace).

Considered and DEFERRED (named, not forgotten):
- The full SEED-032 harness MANIFEST schema (ship the runtime first; declare it later).
- Live Brain consumption of the Phase 157 projection for ranked next-reach (deferred with 157).
- SEED-028 retry/backoff on transient 5xx - recommended to fold in as onStep retry, but flagged as a scope fork (hard EXEC-05 vs fast-follow) for the navigator to decide at plan-phase.

Guardrails written down:
- Any irreversible step (email, deploy, publish, external write) is forced-material regardless of tag.
- gateFn MUST halt on any non-autonomous_safe step (larry-personality SKILL.md:59 "the navigator always decides").
- Quality signal carried in output so a low-quality step halts even when tagged safe (stops garbage propagation).

---

## 7. Open questions for plan-phase

- Does runChain live purely in lib/core/ (CLI + MCP shared) with thin command wrappers, confirming Tri-Polar parity (CLI / Desktop / Cowork)?
- Is the SEED-028 retry contract a hard requirement (EXEC-05) here, or a fast-follow?
- Migration order: act (donor) first, then pipeline, then ignite, then the larry-extended / larry-personality handoff seam - one surface per wave to keep CI green?
- B1 reconciliation: confirm pipeline-state.cjs as the single chain-state source of truth before any loop code lands.
