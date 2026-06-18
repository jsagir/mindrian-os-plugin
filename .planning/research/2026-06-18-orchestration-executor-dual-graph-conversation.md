---
kind: research
title: "Conversation capture - orchestration, the Gated Chain Executor, the dual graph, ICM, efficiency, tokens"
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
source: navigator Q&A session 2026-06-18, with an 11-subagent read-only fan-out
status: critical-record
primary_phase: 166 (gated-chain-executor)
consumed_by:
  - Phase 166 166-SPEC.md + 166-RESEARCH.md
  - v1.14.0 milestone research
shared_with:
  - SEED-024 (brain-as-orchestration-graph)
  - SEED-028 (workflow synthesis retry/fallback)
  - SEED-032 (harness-as-code)
  - Phase 157 (brain-orchestration-projection)
mirror_copy: "~/MindrianRooms/mindrianOS/solution-design/2026-06-18-gated-chain-executor-architecture/"
note: ".planning is gitignored; commit with git add -f per repo convention"
---

# Conversation capture: the Gated Chain Executor, the dual graph, ICM

This is the full critical record of the 2026-06-18 navigator session. It preserves
EVERY question (verbatim intent), EVERY answer (full substance), and the COMPLETE
fan-out (each subagent's purpose, verdict, and file:line citations). It is the
canonical context for any phase touching chaining, the harness, the executor, the
dual graph, or ICM. Filed in BOTH the GSD planning tree and the mindrianOS product
Data Room.

---

## PART A - The questions (verbatim intent, in order)

1. What GSD phase or seed deals with pipelining, chaining, and utilizing every skill, agent, and command in MindrianOS, per Larry reacting with the graph spine and the dual graph as a suggester?
2. Where are those on the pipeline in terms of Mindrian versions?
3. I have a feeling the harness and the invocation of commands/agents/pipelines do not even exist to make what we are talking about happen.
4. Fan out agents to find how we might accomplish this - can a harness help, how, why - as a systems-thinking process with process mapping and causalities understood. Use the fable-mode + harness-as-code + Larry/PAI architecture concepts (full doc pasted).
5. This is an architectural change that enhances larry-extended, the larry skill, the ignite skill, etc.
6. We have many relevant skills/agents/commands - not only the ones I mentioned - all relevant to the user.
7. File the finding as a full phase SPEC. (Navigator chose: Hybrid - gated autopilot.)
8. Explain all of this in Feynman style: what I asked, the findings, how they were found, expected behavior, what was considered and deferred.
9. Who is the cook, and what is its relationship to ICM and the dual graph (remote and local)? We modified the local graph - its current status?
10. What is the role of the remote graph, the local graph, and ICM?
11. What is the relationship between them when a user is doing X - doing X, filing, extraction?
12. Is this efficient, and do we need harnesses in place?
13. What about token consumption?
14. Reconcile the three divergent loop copies (act/pipeline/ignite) - each what, where, when.
15. Reconcile the built-but-dark 207-node projection map.
16. File this whole conversation - all questions, all answers, all the fan-out - in the product room and in the GSD v1.14.0 research phase and related phases.

---

## PART B - The fan-out (every subagent, purpose, verdict, citations)

### Wave 1 - locate the machinery
- **Agent: "Find pipeline/chaining orchestration phase"** (Explore). Found the three operational layers: the dual graph (Phase 157, methodology_tier boundary), the graph spine (Phase 122 + 143), the navigation engine (Phase 144). Best match for the user's idea = SEED-024 (Brain Orchestration Graph) + Phase 122. All decided-layers shipped; full projection pending Phase 157 Plans 02-05.

### Wave 2 - version mapping
- **Agent: "Map phases to Mindrian versions"** (Explore). Phase 122 = v1.13.0 (shipped). Phases 141/143/144/148/150.10 = v1.13.1 "Larry Reaches" (shipped). Phase 157 = v1.14.0-candidate (planned). SEED-024 = v1.14.0+ dormant. Current stable: v1.13.1 (2026-06-17). Next: v1.14.0 (Phase 163 first to execute).

### Wave 3 - the two audits (testing the "no executor" hunch)
- **Agent: "Audit existing invocation harness"** (Explore) - STALLED (watchdog, 600s). Re-run tightly as Wave 3b.
- **Agent: "Audit planned invocation harness"** (Explore). VERDICT: the plans build a SUGGESTER GRAPH + REGISTRY + RANKING, not an execution harness. Quote: Phase 157-SPEC.md:94-99 "Nav-engine live CONSUMPTION ... deferred; this phase exposes the inputs + defines the cache contract only." No phase scopes invoke->capture->pass->loop. Larry-as-conversational-invoker is the de facto runtime (Canon Part 10).
- **Agent: "Check act-chain/swarm/pipeline executor"** (Explore, Wave 3b). VERDICT: no real invoke->capture->pass->loop executor exists. act --chain (act.md:258-277) = manual checkpoints; pipeline (pipeline.md:82-109) = manual stage gates; framework-runner = single-shot EXECUTOR of ONE step; act --swarm = DISPATCHER (parallel, no output-passing). Every "chain" depends on human/Larry running each step. This is by canon design (Part 3 Tri-Context gate), not oversight.

### Wave 4 - the 7-lens fan-out
- **Systems-thinking causal model** (ae89c11c). Stocks: artifacts, graph edges, context tokens, user trust, trace. Loops: R1 graph flywheel (the moat, reinforcing), R2 convergence autopilot (reinforcing), B1 trust gate (balancing, sacred), B2 budget brake, R3 garbage propagation (pathological). LEVERAGE POINT = posture/autonomous_safe tagging (EXEC-03); second = output-passing carrying the quality signal (EXEC-02). EXEC-01/02/03 ~90% present: validateChainAutonomy (command-resolver.cjs:131-143), 3-posture vocabulary (sensor-types.cjs:54-58 -> push_forward=auto, hold/pull_back=halt). Design move: gate on posture x evidence-quality, not step index.
- **Harness control-plane fit** (af4fdf01). VERDICT: the harness pattern is real but ALREADY largely implemented - a thin consolidation/facade over four shipped modules: act-command.cjs:13-26 (loop + stop + kill), command-resolver.cjs:131-152 (validateChainAutonomy + composeWorkflow), model-profiles.cjs:18-57,119-149 (routing), dispatch-optimizer.cjs (budgets). What harness adds: resumability + structured verify. CORE MISMATCH: "all PASSING -> stop" is autonomous convergence; canon mandates halt at first non-autonomous_safe step. Do NOT add a feature-list.json (STATE.md + room.db are the truth). /mos:bono is the reference impl to consume.
- **PAI memory + hooks fit** (a35ef477). The "three memory layers" are HMI/JTBD (memory.md:25-31): L1 within-session jtbd-state.json, L2 across-session jtbd-history.json (atomic O_EXCL), L3 cross-room Brain/local. L2's atomic store is reusable as chain state. Phase 157 dual graph exists as docs/canon; generator + CI scaffolded; projection generated, NOT live-synced (live write = Phase 137). CONTRADICTION: two resume mechanisms - pipeline-state.cjs (room/.mindrian/pipeline-state.json) vs pipeline.md frontmatter scan; reconcile onto pipeline-state.cjs. Minimal adds: fix PreCompact glob, SessionStart resume fragment, promote checkPosition.isNext to a hard gate.
- **fable-mode discipline fit** (a56ce63a). Maps plan->delegate->verify->self-critique onto per-step framework-runner; VERIFY + SELF-CRITIQUE become the coupling that escalates a step from autonomous_safe to halt; stops R3 garbage propagation in a chain.
- **Build-vs-graft reuse map** (a12c3e7f). Offered to draft lib/core/chain-executor.cjs; confirmed framework-runner is the per-step brick; act-command.cjs composes but does not auto-execute. ~80-85% repoint.
- **Blast-radius surface map** (a2b1ecd1). Surface table: larry-extended (MODIFY handoff), larry-personality (MODIFY contract; SKILL.md:59 "navigator always decides"), ignite (MODIFY->CONSUMER), act (MODIFY donor), pipeline (MODIFY consumer), framework-runner (BENEFIT), navigation-engine decide() (MODIFY - exposes posture/terminal or executor joins externally; decide() returns ONE decision not a list, navigation-engine.cjs:596 - do NOT change shape; many consumers). Shared contract: runChain(steps, {postureFn, gateFn, onStep, provenanceFn}). Strategic point: spine-not-per-surface = DRY + single posture logic + single trace.
- **Full catalog classification** (afcccf79) - returned "Complete" only; counted directly by Bash instead (see Wave 5).

### Wave 5 - direct Bash recon (self-verification)
- Catalog counts (live 2026-06-18): 96 commands, 13 skills, 9 agents. 50/96 commands declare autonomous_safe (45 true), 51 carry posture + reach_id. Over half the catalog is chain-ready.
- Local graph status (mindrianOS): room.db present + 8 sub-room dbs. LOCAL projection cache data/brain-orchestration-projection.json generated 2026-06-15, 207 nodes = 180 mindrian-operation + 27 pws. connector-registry.json ~30 KB. Generator + check-dual-graph-health.cjs exist. routing_source observed: legacy (tier_0, BRAIN.md absent) - the rich projection is NOT yet consumed.
- The three loops (file:line): act commands/act.md:224-228,258-277 + scripts/act-command.cjs:116-119 (planChainRun); pipeline commands/pipeline.md:82-115 + lib/mcp/pipeline-state.cjs (initChain/recordStep/checkPosition); ignite commands/ignite.md:57-76 (B1), 82-94 (B2), 98-123 (B3).

---

## PART C - The answers (full substance)

### C1. The core finding
Two machines: the SUGGESTER (decides next step) is shipped; the EXECUTOR (runs a chain) does not exist - but is ~80-85% already built and scattered. The gap is not a greenfield engine; it is the absence of ONE extracted, shared, gated loop runner. Three divergent loop copies (act/pipeline/ignite, ~60 dup lines) exist with no shared runtime, no single posture authority at runtime, no single trace.

### C2. The decision
Navigator chose GATED AUTOPILOT over full-robot and pure-suggester. The Decision Gate becomes a throttle, not an on/off: fast on safe steps, stop where judgment matters. This preserves the Canon Part 9 human-judgment moat.

### C3. The phase
Phase 166 (gated-chain-executor): ship lib/core/chain-executor.cjs with runChain(steps, {postureFn, gateFn, onStep, provenanceFn, maxSteps, onHalt}). Requirements EXEC-01 loop runner, EXEC-02 output-passing with quality signal, EXEC-03 posture x evidence-quality gate, EXEC-04 kill-switch + single trace. Pre-work blockers B1 (reconcile two resume stores), B2 (do not change decide() shape), B3 (reject all-passing convergence). v1.14.0; ~80-85% repoint. See 166-SPEC.md.

### C4. Feynman model - the kitchen (who is the cook)
A recipe is not a cook. The system had recipes (who decides order) but no cook (who runs the order). Cast:
- Recipe book = dual graph + connector spine.
- Head chef (calls next dish) = Larry via navigation-engine.cjs decide().
- The cook (NEW) = lib/core/chain-executor.cjs (runChain loop).
- Line cook (one dish) = agents/framework-runner.md.
- Judge/owner = the human at the Tri-Context Decision Gate.
The cook is deliberately obedient: does not pick the menu (chef) or own truth (human). That separation keeps Part 9 intact.

### C5. The three-graph division of labor (library / notebook / building)
- REMOTE graph (Brain) = library of HOW TO THINK. Methodology (pws tier) + generic machinery projection (mindrian-operation tier). Shared by all. NEVER user data (Part 8).
- LOCAL graph (room.db) = notebook of WHAT YOU THOUGHT. Claims, decisions, rejections, edges, memory events, chain state. User-owned. NEVER egresses (Part 9).
- ICM (folders) = the BUILDING. Identity (L0), routing (L1), cascade contracts (L2), reference (L3), artifacts (L4). The folder IS the orchestration.
Allowed edge: Brain -> Local (generic methodology). Forbidden: Local -> Brain (user data). ICM gives meaning; the local graph gives navigability; the remote Brain gives technique.

### C6. The runtime choreography (user does X)
Fixed order on every action: ICM (where) -> Local (extract -> nodes + memory_event, proposed; cross-relationship scan: INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) -> Remote (typed packet, generic handles only - the ONLY remote beat) -> Larry surfaces at the Tri-Context Gate (LOCAL+BRAIN+SIGNAL) -> user APPROVE/REJECT(reason)/DEFER -> Local (decision -> typed edge; proposed -> confirmed) -> ICM (artifact + edges legible = receipt) -> next scan smarter. The Brain participates in exactly one beat, with generic handles only. The cook runs this whole cycle per step, gating only material/low-quality/irreversible steps.

### C7. Efficiency + harness-need
Efficiency is measured against the JTBD (time from insight to validated decision). Architecture is efficient (3 distinct jobs, local cache, no duplication). Multi-step OPERATION is not: human-latency-bound, three loop copies, the projection is dark. The cook is a throughput fix. WARNING: efficiency fights legitimacy - too much auto-run destroys the human-judgment moat; the gate is the deliberate inefficiency kept. Harness: you ALREADY run one, unnamed and scattered (SEED-032). You NEED the cook (the minimal runtime) - load-bearing. You do NOT need the full harness-as-code manifest now (canon forbids fire-and-forget convergence; thin runtime + existing registry suffices).

### C8. Token consumption
The flywheel is token-CHEAP by design: intelligence accrues in cheap durable SQL (queried as small ranked neighborhoods via navigation.cjs), not re-stuffed into the expensive context window every turn. Brain calls are light (typed packets, summary maxLength 120, prose sha256-hashed). Cost centers + brakes: framework-runner per step (heavy -> Haiku/Opus routing via model-profiles.cjs); output passed down chain (grows -> pass DISTILLED result, not raw); cross-relationship scan (mixed -> structural is SQL-cheap). RISK: the cook is a token AMPLIFIER - a human stops, the cook does not. Net-positive only if bounded by: maxSteps cap, posture gate (short chains), quality early-kill (stop bad chains early - highest-leverage saver), distilled output-passing, per-step routing. Proposed EXEC-06: token budget + early-kill as acceptance criteria. Principle: spend tokens where judgment/generation happens; never spend them re-remembering.

### C9. Reconciliation 1 - the three loops
Not three copies; three points on the auto-run spectrum. act = mostly-auto with gates at unsafe steps (DONOR; spine extracted from act-command.cjs; migrate Wave 1). pipeline = all-manual stage loop + provenance + resume (CONSUMER #1; needs provenanceFn; resolve B1 resume-store first; migrate Wave 2). ignite = fixed 3-gate birth sequence, all-material, hard ordering (B3 after birthRoom; CONSUMER #2 special; migrate Wave 3). Callback mapping: act -> gateFn halt-on-unsafe, provenanceFn null; pipeline -> gateFn halt-each, provenanceFn stage frontmatter, resume pipeline-state.cjs; ignite -> gateFn halt-each + pre-step guard (birthRoom before B3). One per wave keeps CI green.

### C10. Reconciliation 2 - the dark projection + the THREE recipe maps
The 207-node projection is built ahead of its consumer on purpose (Phase 157 deferred consumption), not waste-by-accident - it becomes waste only if no consumer arrives. Reconciliation: the cook (Phase 166) is the declared first consumer. Deeper finding: THREE overlapping recipe maps exist and must be layered, not merged:
- data/command-registry.json (Phase 122) -> "is this step safe to auto-run?" (posture authority; postureFn).
- data/connector-registry.json (Phase 143.3) -> "what surface does this reach invoke?" (wiring; onStep dispatch).
- data/brain-orchestration-projection.json (Phase 157) -> "given where we are, what is the ranked next reach?" (the chef's suggestion; what decide() should consume).
Proposed pre-work blocker B4: recipe-source authority - each map read for exactly one job; the projection gets a named consumer; prevents the three maps from drifting and reproducing the divergence.

---

## PART D - Considered and deferred (decision ledger)

CHOSEN: gated autopilot; reuse-before-build (~80-85% repoint, no LangChain/CrewAI); spine-not-per-surface.
DEFERRED (named): full SEED-032 harness manifest schema; live Brain consumption of the Phase 157 projection (with 157); SEED-028 retry/backoff (fold as EXEC-05 or fast-follow - navigator decides at plan-phase).
GUARDRAILS: irreversible steps (email/deploy/publish/external write) forced-material regardless of tag; gateFn must halt on any non-autonomous_safe step; quality signal carried so low-quality halts even when tagged safe.

## PART E - Open questions for plan-phase
- runChain in lib/core/ (CLI + MCP shared) with thin wrappers (Tri-Polar parity)?
- SEED-028 retry as hard EXEC-05 or fast-follow?
- Migration order act->pipeline->ignite->larry handoff, one surface per wave?
- B1: confirm pipeline-state.cjs as the single chain-state source of truth before any loop code.
- B4: ratify the three-map layering (posture / wiring / ranking).

---

_Filed 2026-06-18. Mirror copy in the mindrianOS Data Room solution-design section. Cross-linked: SEED-024, SEED-028, SEED-032, Phase 157, Phase 166._
