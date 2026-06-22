# Phase 172 — External Research (web, 2024-2026)

> Filed by the parent from 6 web-research streams (Tavily-live where noted; WebSearch fallback
> where Tavily 433'd before the quota was lifted). Every pillar of 172's dual-graph + memory +
> fractal + routing design has NAMED prior art. Net verdict: **172 is current SOTA, not novel-risky.**

---

## 0. ICM paper — VERIFIED REAL (with a canon correction)

- arXiv **2603.16021**, *"Interpretable Context Methodology: Folder Structure as Agentic Architecture,"*
  **Jake Van Clief, David McDermott**, 2026-03-17 (cs.AI, cs.HC). Resolves online; corroborated by
  2 GitHub implementations + an AI Tinkerers talk + the authors' "Clief Notes" community.
- **Correction:** ICM = **Interpretable Context Methodology**, NOT "Iterative Context Management"
  (some internal refs mis-expand it). Authors/ID/thesis are correct.
- ICM ships a **3-layer routing model**: L0 Root Router (`CLAUDE.md`) → L1 Workspace Router
  (`workspace/CLAUDE.md`) → L2 Stage Contract (`CONTEXT.md`). Core construct = **Model Workspace
  Protocol (MWP)**: numbered folders = workflow stages, each governed by a CONTEXT.md contract;
  filesystem IS the state machine; review gates at every handoff.
- **Implication:** ICM independently validates 172's routing-as-folder-hierarchy thesis. Our internal
  5-layer ICM (Identity/Routing/Contracts/Reference/Artifacts) is a SUPERSET of ICM's L0/L1/L2 —
  reconcile the layer count + fix the acronym in the phase doc.

---

## 1. Dual-graph (remote orchestration ↔ local room) — Tavily-live

- **Control-plane vs data-plane** (Forrester 3-plane: build/orchestration/**oversight**; oversight must
  sit OUT-OF-BAND). Shared graph = control plane (capabilities, routing, policy); per-room graphs =
  data plane. **Rule: policy flows down, tenant data never flows up.** Refactoring later is the
  documented failure mode — decide plane separation now.
- **Capability graph ≠ memory graph** (Neo4j tools-vs-skills; arXiv 2602.05665 memory taxonomy).
  Separate stores, separate write paths, different change cadence (capability = small/stable/shared;
  memory = large/churny/per-room).
- **CQRS read-model projection** (Azure CQRS; abstractalgorithms 3 markers). The local capability view
  is a DERIVED, non-authoritative materialized view of the shared graph. Carry **3 durable markers:
  source commit/version, per-projection checkpoint, freshness budget.** Invalidate-by-version,
  rebuild lazily. Never let the room view become write-authoritative over capabilities.
- **T-Box/A-Box federation** (Cagle; Actian; Ontotext FedX). Shared graph = the small, expensive,
  shared **T-Box (ontology/capability schema)**; room graphs = the churny **A-Box (instances)**.
  T-Box changes can invalidate A-Box inferences → keep it thin and shared. Cross-room intelligence =
  federated query / governed contract, NEVER lifting instances up.
- **Solid pods** = the cleanest "no data leaks up" precedent (TU Wien TIDAL 2025): the coordinating
  tier holds capabilities + access policy, never the data. Per-room graphs = Pods; shared graph = the
  app/protocol layer with scoped, revocable access.
- **Coverage gate — no off-the-shelf exists.** Closest analog = **IaC drift-detection in CI**
  (driftctl, CloudFormation detect-stack-drift, GitLab CI-Lint) + Microsoft "tool-space interference"
  (registry size as a measurable risk). Port the drift pattern: a CI job that walks the capability
  graph and FAILS the build on any command/intent/state with no reachable capability ("no dark
  capability"). **This is INV-10's external blueprint — adapt drift tooling, none turnkey.**

## 2. Fractal / nested graphs (NESTED_WITHIN roll-up) — Tavily-live

- **Simon near-decomposability, formalized** (arXiv 2501.12748, Jan 2025): NDH (structure) + NDBP
  (behavior); intra-subsystem interactions stronger by ORDERS OF MAGNITUDE; cross-boundary signals
  travel ONLY as an **Aggregate Vertex** (per-subsystem summary node) at the level above.
  → `NESTED_WITHIN` IS the NDH; depth-3 IS the OOM cutoff; engineer a per-room **Aggregate Vertex**.
- **Recursive CTE / Cypher roll-up** (Databricks recursive CTE; VLDB Cypher). One recursive query,
  `MAX RECURSION LEVEL`-capped, does subtree roll-up. **Recursion cap = correctness, not just speed**
  → depth-3 contract is the termination guard.
- **GraphRAG hierarchical Leiden** (arXiv 2404.16130): recursive community detection; **higher-level
  summaries generated FROM lower-level summaries** (one bottom-up operator applied at every level =
  scale-invariant). Root summaries = 97% fewer tokens; leaf = 26-33% fewer.
  → precompute ONE summary node per room per level via the SAME `rollup()` operator.
- **LeanRAG LCA routing** (arXiv 2508.10391, AAAI 2025): bottom-up semantic clustering + **Lowest
  Common Ancestor** retrieval — anchor at leaves (drill-down), ascend to LCA (roll-up) in one pass.
  → a query spanning two child rooms resolves to their LCA room's summary, not a full subtree scan.
- **Self-similar networks** (Song-Havlin-Makse box-covering, Nature 2005; Sci. Reports 2024 normalized
  box-mass): make the aggregate **normalized** (divide by subtree mass) so a 50-child room and a
  2-child room produce comparable rolled-up signals.
- **Takeaway:** ONE scale-invariant `rollup(room)` operator, recursive up `NESTED_WITHIN`, precomputed
  per-level summary nodes, normalized aggregates, LCA query routing, depth-3 cap. Roll-up (bottom-up)
  + drill-down (top-down) FUSED in one recursive walk.

## 3. Agent memory (Canon Part 9 validation) — Tavily-live + WebSearch

- **Two-tier memory** (MemGPT/Letta core/recall/archival; Zep/Graphiti graph-as-truth): local
  structured authoritative store + external semantic/reasoning store. 172's SQL-local / Brain-remote
  split ≈ Zep "graph is truth, LLM reasons over it" — arguably STRONGER than MemGPT (which mingles
  authority + reasoning). Validate the local layer is **self-editable** (typed updates), not just
  append-only.
- **Bi-temporal temporal KG** (Zep arXiv 2501.13956; Graphiti; Engram arXiv 2606.09900): **FOUR
  timestamps per edge** — valid-time (`valid_at`/`invalid_at`, true-in-world) + transaction-time
  (`created_at`/`expired_at`, when learned/retracted). **Invalidate, never delete; supersedes pointer;
  full provenance.** Conflict resolution often WITHOUT an LLM call per fact. → 172 carries
  `valid_from/valid_until` already; ADD transaction/provenance time (the audit half). Split
  retrieval-recency (last-used) from pruning-decay (ingestion time).
- **Propose-vs-confirm HITL** (Fountain City; CleanGraph arXiv 2405.03932; memory-poisoning:
  MINJA/MemoryGraft arXiv 2606.04329, 2512.16962). Agent PROPOSES to a pending/review queue with
  provenance; HUMAN promotes. This is the documented defense against memory poisoning (>95% injection,
  ~70% success when ungated). **Most managed memory systems DON'T do step-4 natively — a native review
  gate is a differentiator.** Exactly Canon Part 9 role 5 + the nugget-routing HARD RULE.
- **Typed-packet privacy** (AMP PMLR v317 redact→pack→hydrate; MemPrivacy arXiv 2605.09530: typed >
  untyped placeholders; PlanTwin arXiv 2603.18377). "Send structure not content" is named prior art;
  **type info must SURVIVE the boundary** to keep utility. Make the packet schema the SINGLE egress
  surface (gateway pattern) that strips raw text/PII.

## 4. Contextual tool/capability routing (INV-07/08/10) — Tavily-live + WebSearch

- **Catalogs collapse at scale** (arXiv 2606.17519 real 584-tool/110-agent: F1 −16-23pp, recall-driven;
  BFCL 43%→2% at 4→51; 78%→13.6% at 10→100+; "lost in the middle"). **172's 124 surfaces are IN the
  collapse zone** — string-match/load-all is the highest-risk divergence.
- **Tool-RAG retrieve-then-select** (Red Hat; RAG-MCP; Anthropic code-execution-with-MCP progressive
  disclosure ~85% context cut). Retrieve top-k by embedding BEFORE the model sees tools. But pure
  embedding FAILS on under-specified queries (arXiv 2603.20313) → fold **conversational context +
  room/JTBD state** into the query (= INV-07 "context, not keyword").
- **Context-aware FSM routing** (arXiv 2509.07571): states = room conditions; transitions gated by
  context; ineligible capabilities **masked**. Maps directly to INV-07: problem-state predicates over
  the room graph, deterministic + local, with an explicit ambiguous→ask fallback.
- **Earned chain confidences** (AutoTool arXiv 2511.14650 **Tool Inertia Graph**, conditional entropy
  **3.62 bits** = next-tool is highly predictable/learnable; TRAJECT-Bench; TrajRoute edges weighted
  by frequency + distinct users; NBA-RL Q-values). Two cheap earning mechanisms: (a) usage-derived
  transition probabilities from trajectories (no training), (b) outcome-weighted reward. **Seed
  curated, overwrite with usage-derived as trajectories accumulate** (= decision (d)).
- **Coverage gate** (MCP registry CI governance — JFrog/QVeris "every tool needs valid inputSchema";
  Capability Square 80/20). Every capability registered + triggerable + reachable + in ≥1 chain; CI
  fails otherwise; continuous usage monitoring for regressions.

---

## RED FLAGS (where MindrianOS may diverge — verify against the spec)

1. **String-match routing across 124 surfaces** = documented collapse zone. INV-07 must be
   state-conditioned semantic routing, not keyword. (Sensors already read LOCAL state — good direction.)
2. **Uniform/placeholder chain confidences** contradict the earned-weight consensus. INV-08 must rank
   with curated-prior + usage-derived weights, not hand-set uniform edges.
3. **Two-timestamp (valid-only) memory** is a partial divergence — the field moved to FOUR timestamps
   (valid + transaction) for "what did we believe then" audits.
4. **LLM-driven invalidation without a gate** can silently erase confirmed truth — invalidation of a
   CONFIRMED node should itself require confirmation (symmetry with the write gate).
5. **Procedural-memory gap** — every surveyed framework under-serves "what was learned from doing."
   A declarative-only graph inherits the blind spot; consider a procedural lane for methodology moves.
6. **"Files preserve meaning" as a second uncontrolled write path** — ensure the redaction/provenance
   gate covers the file channel too, or PII can leak there while the packet path stays clean.

## Citation index (high-confidence primary sources)
- ICM: arXiv 2603.16021 · GraphRAG: arXiv 2404.16130 · LeanRAG: arXiv 2508.10391 · Simon ND:
  arXiv 2501.12748 · Zep/Graphiti: arXiv 2501.13956 · Engram: arXiv 2606.09900 · A-MEM: arXiv
  2502.12110 · Memory poisoning: arXiv 2606.04329, 2512.16962 · AMP: PMLR v317 · MemPrivacy: arXiv
  2605.09530 · PlanTwin: arXiv 2603.18377 · Enterprise routing: arXiv 2606.17519 · RAG-MCP: arXiv
  2505.03275 · AutoTool: arXiv 2511.14650 · CA-FSM: arXiv 2509.07571 · Anthropic code-execution-MCP
  (2025-11) · CQRS: Azure Architecture Center · Self-similar nets: Nature 433 (2005), Sci.Rep 2024.
