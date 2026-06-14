# Futures Wheel Agent - Research (deep-research, navigator-provided 2026-06-14)

Source: navigator (Jonathan) pasted deep-research during the 150.10 session. Filed verbatim-in-substance so a fresh session can resume. Repo-grounding verified 2026-06-14 (engines confirmed real).

## The vision

The Futures Wheel (Jerome Glenn, 1971) maps cascading consequences of a central change outward in rings: first-order (direct), second-order (effects of effects), third-order (deep systemic ripples). Classically a human-facilitated whiteboard exercise. The proposal: reimagine it as a PROACTIVE, autonomous, research-oriented AI agent that treats any "thing" (technology, regulation, trend, decision) as a living seed node in a perpetually expanding consequence graph, running a never-stopping loop asking "and then what?"

## The agent loop (ReAct tuned for foresight)

SEED -> SCAN (horizon scanning across curated sources, weak-signal detection across PESTEL) -> REASON (LLM extracts first-order consequence nodes, PESTEL-tagged) -> PROPAGATE (forward-chaining graph traversal over a DAG of <cause, relation, effect> to N-th order) -> EVALUATE (probabilistic confidence scoring, contradiction detection, signal-strength weighting) -> REFLECT (audit past predictions vs observed reality, close the feedback loop) -> ALERT/OUTPUT (updated consequence graph + narrative + divergence alerts) -> LOOP (continuous, new signals trigger re-entry).

## Core capabilities

1. Autonomous horizon scanning (continuous, weak-signal detection).
2. Causal graph construction + traversal (nodes = world-states, edges = CAUSES/AFFECTS/LEADS_TO/ACCELERATES/DAMPENS; forward + backward chaining for downstream + counterfactual).
3. Multi-agent specialization: Scan / Consequence / Propagation / Evaluation / Synthesis / Reflection sub-agents.
4. Proactive not reactive (monitors seeds, fires alerts when the graph changes).
5. PESTEL-layered domain coverage (every node tagged Political/Economic/Social/Technological/Environmental/Legal; coverage enforced structurally).
6. Temporal horizoning (near 0-2y / mid 2-10y / long 10-30y, with lag estimates).

## Outputs

Live consequence graph (Neo4j-style) + narrative futures briefings + divergence alerts (confidence upgrades when reality confirms a branch) + scenario clusters (co-occurring branches = coherent futures).

## Design principles

Seeds as living objects; uncertainty as a first-class citizen (confidence + provenance + temporal estimate on every edge); feedback loops as core logic (reflection audits predictions); human-in-the-loop as optional override; source traceability (every node traces to its signals).

## Classical vs Agentic (the essential shift)

| Dimension | Classical Wheel | Futures Wheel Agent |
|---|---|---|
| Trigger | Human workshop | Always-on, self-initiating |
| Data | Room's knowledge | Curated global sources |
| Signal detection | Manual | Automated weak-signal detection |
| Depth | ~3rd order | N-th order via graph traversal |
| Updates | One session | Continuous, event-driven |
| Domain coverage | Workshop composition | PESTEL-enforced |
| Uncertainty | Qualitative +/- | Probabilistic confidence |
| Learning | None | Reflection / prediction-audit loop |

## Repo grounding: ICM + HSI can be USED (verified 2026-06-14)

The deep-research claim "both ICM and HSI are real, functional engines you can use directly" was VERIFIED against the repo:

### ICM (Interpretable Context Methodology) - the structural backbone
Paper at .planning/research/ICM-2603.16021v2.pdf. 5-layer fractal maps onto the Futures Wheel:
- Layer 0 Identity (CLAUDE.md / ROOM.md) -> the seed node (the "thing" tracked)
- Layer 1 Routing (INDEX.md) -> consequence branch router (which PESTEL domain to probe)
- Layer 2 Contracts (STATE.md) -> per-horizon confidence contracts (near/mid/long)
- Layer 3 Reference (Brain + methodology) -> the causal graph (CAUSES/LEADS_TO/ENABLES)
- Layer 4 Artifacts (claims + evidence) -> live consequence nodes (each ripple = a filed artifact)
SEED-022 (ICM Fractal Memory Contract) specifies "identity-begets-memory": each consequence node = a sub-room with its own STATE.md (confidence, horizon, provenance). A 3rd-order consequence is literally a depth-3 sub-room. BLOCKER: SEED-004 (nested-room write-scope bug, status scheduled-v1.14.0) must be fixed before sub-room creation is safe. MVP avoids sub-rooms (consequence nodes as artifacts within one room).

### HSI (Hybrid Similarity Index) - the hidden-connection engine
Verified real files: scripts/compute-hsi.py (30KB), scripts/hsi-to-graph.cjs, references/hsi/HSI-TOOLS-REFERENCE.md, requirements-hsi.txt. PLUS a whole whitespace suite (discover-hsi-whitespace.py, compute-whitespace-gaps.py, discover-rs-whitespace.py, whitespace-to-graph.cjs) + opportunity-ops.cjs.
Formula: HSI(a_i, a_j) = |BERT_sim - LSA_sim| x Integrative_Factor. High HSI = "connected in ways nobody sees." For the Futures Wheel this finds HIDDEN consequence bridges - exactly where unexpected 2nd/3rd-order effects live. The engine already emits typed edges ENABLES/INFORMS/CONTRADICTS/CONVERGES/INVALIDATES (the causal edge types a consequence graph needs). 3 tiers: Tier 0 keyword, Tier 1 LSA+MiniLM (default), Tier 2 LSA+Pinecone+Neo4j.

### Composition
SEED NODE (ICM Layer 0) -> SCAN+FILE (weak signals as Layer 4 artifacts) -> HSI PIPELINE (compute-hsi.py finds high-differential pairs = hidden consequence bridges) -> GRAPH EDGES (hsi-to-graph.cjs writes typed edges; ICM Layer 3 grows) -> ICM Layer 1 routing (Larry surfaces "I found a hidden connection") -> HITL approve/reject/defer -> loop. This IS the Proactive Discovery Loop already in .claude/includes/architecture.md ("Artifact filed -> cross-relationship scan -> new edges -> Larry surfaces -> user decision -> graph data -> next scan smarter") - just not named "Futures Wheel" yet.

## What to ADD (assemble, not rebuild)

1. Temporal horizon + confidence frontmatter on artifacts (horizon: near|mid|long, confidence: 0.0-1.0).
2. PESTEL domain tag on consequence nodes (domain: Political|Economic|...).
3. A seed command /mos:futures:seed [concept] that creates the Layer 0 ICM room.
4. Fix SEED-004 first (safe sub-room creation = N-th order nodes).
5. A reflection pass (scheduled scan comparing past consequence predictions vs new artifacts).

## The Larry reframe (from the session)

Separate the GRAND vision (always-on, 200k sources, autonomous multi-agent) - a research program - from what is ASSEMBLE-ABLE TODAY: a Futures Wheel context that takes a seed, files consequences as ICM artifacts, runs HSI to find hidden consequence bridges, tags PESTEL + temporal, banks them as opportunity candidates via the existing proactive discovery loop. The MVP avoids sub-rooms (SEED-004 gate). "The classical tool asked humans to imagine ripples. The agent watches the water."

## Open challenges (from the research)

Causal extraction quality (LLM hallucination in causal edges; hybrid linguistic+LLM better); signal-to-noise at scale; foresight evaluation rubrics (open problem); temporal calibration (lag estimation is more art than science); feedback-loop latency (long-horizon predictions take years to close; need interim proxy signals).
