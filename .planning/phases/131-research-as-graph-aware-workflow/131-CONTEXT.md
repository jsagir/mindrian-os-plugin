---
phase: 131
slug: research-as-graph-aware-workflow
status: scoped (ready for /gsd:discuss-phase 131)
priority: P0 -- transforms /mos:research from fortune-cookie command to canonical workflow step; proves the source-lens pattern so v1.14.0 can fan-out to 13 remaining surfaces
created: 2026-05-16
updated: 2026-06-01 (4.7-to-4.8 re-baseline restructure: corpus-cache -> Phase 130.5; correlation_id -> Phase 130.7 lands first; HSI deferred; forward contracts locked for 136. See 131-REVIEW-4.8.md.)
milestone: v1.13.1
beta_target: 1.13.1-beta.5c
wave: 6.7 (between Phase 130 and Phase 121.5 capstone)
absorbed_from: synthesis plan P13 PILOT (source-lens family pilot via /mos:research)
absorption_source: .planning/v1.13.1-EXECUTION-PLAN.md "Synthesis-Plan Absorption (2026-05-16)" section
canon_parts:
  - Part 2 Engine 1 (Act 1 intelligence surface -- research becomes a graph-aware Act 1 surface)
  - Part 3 (Tri-Context Decision Gate -- F.1 filing selector for every finding)
  - Part 4 (every choice is graph data -- typed EvidenceClaim nodes + INFORMS/CONTRADICTS/SUPERSEDES cascade edges; REJECTED_BECAUSE on reject)
  - Part 5 (evidence graded by context -- findings carry evidence_tier; thresholds shift by stage)
  - Part 8 (graph boundary -- pre-egress audit on every external fetch; provenance preserved; LOCAL stays LOCAL)
  - Part 9 (memory locality -- all reads + writes through navigation.cjs; mandatory memory_event)
depends_on:
  - Phase 109 sql-context-memory-navigation-spine (shipped -- the chokepoint reads + writes go through)
  - Phase 110 brain-context-packet-contract (shipped -- the typed packet for any Brain calls within source-lens rotation)
  - Phase 127 brain-mcp-local-stdio-shim (Wave W2 v1.13.1 -- the Brain wire this phase consumes)
  - Phase 128 substrate-contract-adr (Wave 4 Stream E -- CI guards enforce navigation.cjs as only door)
  - Phase 129 spine-repair-memory-event (Wave 4 Stream F -- the memory_event tail this phase READS for context extraction)
  - Phase 130 lens-engine-skeleton (Wave 6.5 -- the engine substrate this phase's source-lens driver plugs into)
  - Phase 130.5 shared-corpus-cache-cjs-fetcher-substrate (NEW 2026-06-01 -- Stage 4 fetcher + cache; 131 adds NO fetcher of its own; 134 reuses the same module)
  - Phase 130.7 correlation-id-contract-dual-graph-ci-gates (NEW 2026-06-01 -- lands BEFORE 131 so 131's cascade edges land on canonical correlation_ids, not cross-label duplicates)
dependents:
  - v1.14.0 source-lens fan-out (13 remaining research surfaces: scout / opportunities / scheduled-tasks / radar / rs-fetch's research arm / 4 GSD researchers / file-meeting research / reanalyze / find-analogies external arm)
  - v1.14.0 P9 framework-lens migration (uses the same lens-engine + cascade-edge pattern proven here)
brain_impact: NONE-NEW (uses existing brain_ask via Phase 110 packet; no new Brain endpoints)
hotfix_discipline: NO (substantial rewrite of /mos:research surface + new core libraries)
estimated_days: 5-7
---

# Phase 131: Research as Graph-Aware Workflow Step (Source-Lens Pilot)

## Goal

Transform `/mos:research` from a standalone topic-string-to-prose command into the canonical workflow step that other methodologies can dispatch. After this phase: research INVOCATION extracts context from the room (via navigation.cjs), understands WHY it was called (the calling workflow's intent), surfaces findings with computed candidate target sections (F.1 selector per Canon Part 3), and WIRES accepted findings as typed `EvidenceClaim` nodes with cascade edges (INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE).

This is the **source-lens family's pilot**. The 13 other research surfaces (scout / opportunities / scheduled-tasks / radar / rs-fetch's research arm / 4 GSD researchers / file-meeting research / reanalyze / find-analogies external arm) follow in v1.14.0 with this pilot as the template.

## Why this matters

The deep-research audit (2026-05-15) found:
- **0 of 14 research surfaces** are Canon Part 9 compliant
- None emit `memory_event` on invocation
- None route writes through `navigation.cjs`
- None surface findings via F-shape selectors
- Research findings exist as prose markdown -- not as typed graph artifacts other commands can consume
- `web_research_tier` field is declared in `section-8-trace-schema.cjs:88` but **never written by any code** (dead field)
- Duplicate fetchers: `/mos:research` hits OpenAlex via Tavily; `rs-discovery-engine` hits OpenAlex directly. Same paper, two code paths, no shared cache, duplicate API quota.

The user vision (2026-05-16): research must extract context from SQLite graph, understand the workflow that called it, ask if to file findings in room-relevant locations, and wire them as graph data.

## The pipeline (8-stage)

### Stage 1 -- PRE-FLIGHT (navigation.cjs reads, 8 inputs)

Before fetching, the extractor reads:
1. **Active workflow** -- which command (if any) called /mos:research, from /mos:act state
2. **Active JTBD** -- via /mos:jtbd state node
3. **Operator mode** -- via /mos:operator state node
4. **Current section** -- room location + STATE.md focus pointer
5. **Recent memory_event tail** -- last 10 transitions (the conversation arc)
6. **Evidence gaps** -- claims in current section with `review_status: needs_evidence`
7. **Prior research dedup** -- Pinecone semantic search on the topic, returns prior `EvidenceClaim` nodes if any
8. **Persona role_blend** -- via Phase 115 USER.md frontmatter

### Stage 2 -- CONTEXT SUMMARY (Larry-voiced)

The pre-flight produces a one-paragraph context summary surfaced to the user before fetching: *"You're in /mos:build-thesis Step 4 (Investability gate), JTBD=thesis-build, current section=financial-model. You have 3 evidence gaps tagged needs_evidence. I'll research <topic> against THIS context."*

This is the explicit moment where research becomes context-aware rather than blind.

### Stage 3 -- LENS SET COMPUTATION

Source-lens set computed from context:
- `financial-model` section gap → `scholarly + industry + patent` lenses
- `thesis-build` JTBD → add `brain` (methodology chain) lens
- `persona=investor` → add `competitive-intelligence` weight
- `persona=researcher` → add `scholarly` weight
- `persona=founder.grant` → add `grants` lens

Output: ordered lens list with weights.

### Stage 4 -- EXECUTION (lens-engine source-lens rotation)

Plugs into Phase 130's `lib/core/lens-engine.cjs` substrate via a new `lib/lens-engine/source-lens-driver.cjs`:
- Fetch via the SHARED corpus module from Phase 130.5 (`lib/core/research-corpus.cjs` + `research-cache.cjs`). 131 adds NO fetcher of its own; Phase 134 reuses the SAME module. (Revised 2026-06-01 per 131-REVIEW-4.8 section 3 + coherence change 1.)
- Pre-egress audit on every fetch (Canon Part 8 -- inherited from the 130.5 shared audit hook; no user content in query strings)
- Parallel fetch where possible (Tavily / OpenAlex / arXiv / PubMed / industry / Brain Cypher)
- Deduped against prior research (Stage 1 input 7)
- Findings ranked by evidence-tier (Part 5) + relevance (% match to section claim graph). **HSI-scoring of findings is DEFERRED to the v1.14.0 source-lens fan-out** (once Phase 134's CJS `@huggingface/transformers` HSI exists). 131 ships ZERO Python hard-dependency on the user machine -- it does NOT call `scripts/hsi-*.py`. (Revised 2026-06-01 per 131-REVIEW-4.8 section 3, decision 3: 131 ships in v1.13.1 before 134 in v1.14.0, so it cannot gate behind 134; it ranks without Python HSI.)

### Stage 5 -- FINDINGS PRESENTATION

5 findings ranked by relevance + evidence-tier (Canon Part 5). For each:
- Title + 1-line summary
- Source + URL + retrieval timestamp + evidence_tier
- **Pre-mapped to candidate room location(s)** with % match score against each section's existing claim graph
- Persona-aware framing per Phase 115 role_blend

### Stage 6 -- F.1 FILING SELECTOR (per Canon Part 3)

For each finding, F.1 selector with computed options:
- File to `<primary section>` (recommended, N% match)
- File to `<secondary section>` (M% match)
- Split: file primary to X, reference to Y
- Defer to milestone audit
- Reject (capture reason → REJECTED_BECAUSE edge per Canon Part 4)

### Stage 7 -- WIRING (navigation.cjs typed-node writes)

**ACCEPT path:**
- `EvidenceClaim` node written (review_status: proposed per Part 9)
- `INFORMS` edge → target section's primary claim
- `CONTRADICTS` edge if finding kills an existing claim
- `SUPERSEDES` edge if better-evidence-tier version found
- `memory_event: research_filed` (provenance: URL + timestamp + tier)

**REJECT path:**
- `REJECTED_BECAUSE` edge (reason captured per Canon Part 4 -- rejection IS data)
- `memory_event: research_rejected` (teaches next run's dedup)

**DEFER path:**
- `DEFERRED` memory_event, queued to milestone audit

### Stage 8 -- POST-FILING (chain back to caller)

- If called BY another methodology: return `EvidenceClaim` IDs so the calling command can resume with the evidence it needed
- If called STANDALONE: surface F.1 next-move selector ("now /mos:build-thesis can consume these claims" etc.)

## Concrete deliverables

1. **`lib/core/research-context-extractor.cjs`** -- the Stage 1 pre-flight (reads 8 inputs via navigation.cjs)
2. **`lib/lens-engine/source-lens-driver.cjs`** -- the Stage 3-4 driver (plugs into Phase 130 lens-engine)
3. **`lib/core/findings-wirer.cjs`** -- the Stage 7 typed-edge writer (INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE)
4. **`commands/research.md`** rewritten to invoke Stages 1-8 in sequence
5. **`scripts/check-research-isomorphism.cjs`** -- CI guard asserting /mos:research output structure matches the typed-node contract (every finding has provenance, every cascade edge has a typed predicate)
6. **Tests**: 5 E2E
   - Standalone invocation
   - Called by /mos:build-thesis (chains back EvidenceClaim IDs)
   - Called by /mos:user-needs (different lens set, different filing destination)
   - Rejection-as-data path (verify REJECTED_BECAUSE edge written + reason captured)
   - Dedup against prior research (Stage 1 input 7 + Pinecone semantic)
7. **Documentation**: `docs/RESEARCH-AS-WORKFLOW-STEP.md` -- how methodologies declare `requires_evidence:` to auto-dispatch /mos:research; how the calling command consumes returned EvidenceClaim IDs

## Open design decisions

1. **Auto-dispatch threshold**: should methodologies declaring `requires_evidence_tier: academic` automatically invoke /mos:research when room evidence is below threshold, or always ask the user? Recommend: ask the user via F.1 selector ("evidence is thin here -- run /mos:research?"). Per the GUIDED-default Brain rule, never auto-fire material work.
2. **Multi-section filing**: when a finding has 70%+ match to TWO sections, do we file twice (with cross-reference) or pick the higher? Recommend: F.1 selector exposes "split" option, user decides.
3. **Stage 2 context summary**: render as Body Shape A (one paragraph) or Body Shape E (action report header)? Recommend Body Shape A -- this is conversational context-setting, not a structured action.
4. **Provenance retention**: if user REJECTS a finding, do we keep the source URL + timestamp on the REJECTED_BECAUSE edge? Recommend YES -- the rejection's evidence is data per Canon Part 4.
5. **Cache scope**: RESOLVED 2026-06-01 -- the shared cache is now Phase 130.5 (`lib/core/research-cache.cjs` + `research-corpus.cjs`), which 131 consumes, 134 reuses, and rs-discovery-engine migrates onto. This closes the duplicate-API-quota drift AND prevents 131+134 from building the fetcher twice. No longer an open question; it is a hard dependency (see depends_on).

## Forward contracts (LOCKED 2026-06-01 -- consumed by Phase 136)

Per 131-REVIEW-4.8 section 4, these shapes are locked NOW so Phase 136's render spine consumes them without a migration:

- **EvidenceClaim node schema:** `review_status: proposed` + provenance fields (`source`, `url`, `retrieved_at`, `evidence_tier`). Phase 136's detail-pane dual-render and `getConfirmedFacts` read exactly these fields.
- **Cascade-edge predicates:** INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE must be members of the allow-listed `ALLOWED_EDGE_TYPES` (INFORMS + REJECTED_BECAUSE shipped via 130-01; CONTRADICTS / SUPERSEDES added additively, never invented per-phase). Phase 136 renders CONTRADICTS as BOTH a graph edge and a sentence (D-06).
- **F.1 filing selector IS the gate-as-write-node:** Stage 6 mirrors `lib/hmi/selector-dispatcher.cjs` (no bespoke research selector), so Phase 136's richer multi-select gate widget (D-13) is a strict superset of 131's inline F.1 gate -- "file a finding" and "commit a decision" are the same write path.
- **Cascade-edge targets are canonical correlation_ids** (from Phase 130.7), not raw names -- so edges do not fork across cross-label duplicates.

## Acceptance criteria

- [ ] All 8 stages of the pipeline run for a standalone invocation, producing typed graph artifacts
- [ ] `/mos:research` can be called BY another methodology with returned EvidenceClaim IDs consumed by the caller
- [ ] Findings surface via F.1 selector with computed candidate target sections (% match scores)
- [ ] ACCEPT writes EvidenceClaim node + INFORMS/CONTRADICTS/SUPERSEDES edges + memory_event
- [ ] REJECT writes REJECTED_BECAUSE edge + reason + memory_event (rejection-as-data)
- [ ] DEFER writes DEFERRED memory_event queued to milestone audit
- [ ] Pre-egress audit passes Canon Part 8 (no user content in any query string)
- [ ] CI guard `scripts/check-research-isomorphism.cjs` passes
- [ ] All 5 E2E tests pass
- [ ] Pre-commit substrate guard (Phase 128) passes against new code
- [ ] Pattern documented in `docs/RESEARCH-AS-WORKFLOW-STEP.md` so v1.14.0 fan-out has a template

## Cross-references

- `.planning/v1.13.1-EXECUTION-PLAN.md` (Wave 6.7)
- `docs/MINDRIAN-CANON.md` Part 2 Engine 1 + Part 3 + Part 4 + Part 5 + Part 8 + Part 9
- 5-cluster Cluster 4 audit (Research/external/scout/meetings) -- 2026-05-15
- Deep-research-across-MindrianOS audit -- 2026-05-15
- Phase 130 lens-engine-skeleton (the substrate this pilot exercises)
- Phase 127 brain-mcp-local-stdio-shim (the Brain wire this pilot consumes)
