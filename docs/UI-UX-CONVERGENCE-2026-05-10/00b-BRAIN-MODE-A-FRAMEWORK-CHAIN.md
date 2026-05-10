---
type: brain-mode-a-enrichment
created: 2026-05-10
brain_mode: mode-a (Neo4j Aura live; queried directly via the my-neo4j MCP per the brain-offline -> neo4j-as-brain fallback rule)
supersedes: the Tier-0 framework-chain guesses in 01-08 (which were produced while Aura was paused)
graph_size_at_query: 23,466 nodes / 166,960 relationships
---

# Brain Mode-A Enrichment -- The Graph-Confirmed Framework Chain

`01`-`08` of this bundle were produced while Neo4j Aura was paused, so their framework recommendations were Tier 0 (embedded Layer 3 references + Canon). Aura was resumed mid-session; this file re-runs those recommendations against the live graph. **Verdict: the Tier-0 guesses were essentially right -- the graph confirms them and adds precision (named sub-chains, stage placement, and one edge that ties the whole bundle together).**

## 1. The chain, as the graph encodes it

```
                         Design Thinking  (type: iterative; ADDRESSES Ill-Defined Problem)
                                 |  FEEDS_INTO
                 +---------------+---------------+
                 v                               v
        Jobs to Be Done (JTBD)          User Journey Mapping
        (analytical; Ill-Defined)       (REVEALS "Making the Invisible Visible")
        HAS_PROCESS_STEP:               HAS_PROCESS_STEP:
          Identify Situation              Cast a Wide Net
          Define Need                     Track Multiple Dimensions
          Expected Outcome                Find Hidden Problems
                 |                        Follow Workarounds
                 |  FEEDS_INTO            |  FEEDS_INTO
                 +-----------+------------+
                             v
              Process Mapping for Innovation   (TYPICAL_AT "Opportunity Identified")
                             |  FEEDS_INTO
                             v
              Reverse Salient Analysis  <----- FEEDS_INTO ----- Systems Thinking
              (TYPICAL_AT Pre-Opportunity              ^ FEEDS_INTO
               + Opportunity Identified)               |
                             |  FEEDS_INTO       Hierarchy Mapping  <-- FEEDS_INTO -- "MAP THE HIERARCHY"
                             v                   (TYPICAL_AT Pre-Opportunity; ADDRESSES Ill-Defined)
                  PWS Value Proposition
                  (VPS = R*0.35 + W*0.35 + V*0.30; gates R>=6.0 / W>=5.5 / V>=5.0;
                   ADDRESSES "Ill-Defined + Wicked")

   Also feeding Reverse Salient Analysis (the activation-gap connection -- see 09):
     - "Algorithmic Generation of Reverse Salient Solutions"  --FEEDS_INTO-->  Reverse Salient Analysis
     - "HSI Semantic Surprise Analysis Assistant" (type: analytical)  --FEEDS_INTO-->  Reverse Salient Analysis  (also --> Domain Selection)
```

**Reading it:** the graph encodes two parallel routes into Reverse Salient Analysis -- the *system-decomposition* route (`Map the Hierarchy -> Hierarchy Mapping -> Systems Thinking -> Reverse Salient Analysis`) and the *user-need* route (`Design Thinking -> {JTBD, User Journey Mapping} -> Process Mapping -> Reverse Salient Analysis`). They converge at Reverse Salient Analysis, which then feeds the PWS Value Proposition score. **That is exactly the path this session walked** (`/mos:analyze-systems` -> `/mos:find-bottlenecks`, alongside `/mos:analyze-needs`), and exactly what `09` argues (the dormant algorithmic workflows -- HSI, reverse-salient generation -- are encoded *in the graph itself* as feeders of Reverse Salient Analysis; not triggering them starves the analysis that feeds the moat score).

## 2. Stage placement (the `TYPICAL_AT` edges)

| Stage | Frameworks the graph places here |
|---|---|
| **Pre-Opportunity** | Hierarchy Mapping, Systems Thinking, Cynefin Framework, Reverse Salient Analysis |
| **Opportunity Identified** | JTBD, User Journey Mapping, Process Mapping for Innovation, Six Thinking Hats, Reverse Salient Analysis (spans both) |
| **Problem Validation** | The Pyramid Principle, Red Teaming |

MindrianOS-as-a-venture, for this UI/UX problem, is sitting at the **Pre-Opportunity -> Opportunity-Identified boundary** -- which is why the natural next moves are the decomposition / reverse-salient / JTBD cluster, and why `/mos:structure-argument` (Pyramid Principle -> "Problem Validation") and `/mos:challenge-assumptions` (Red Teaming -> "Problem Validation") are the *next* stage, not this one.

## 3. The spine reorder -- graph-confirmed, with the precise chain

The Tier-0 correction said: "Decompose the system FIRST, then JTBD, then journey-map, then token-map" -- not "Design Thinking -> JTBD -> User Journey Mapping -> Process Mapping." The live graph confirms this and names the sub-chain. **The v1.14.0 "The Visible Room" methodology-spine line should read:**

> Design Thinking (outer loop) -> [ Map the Hierarchy -> Hierarchy Mapping -> Systems Thinking ] -> { JTBD, User Journey Mapping } -> Process Mapping for Innovation -> Reverse Salient Analysis (already shipped, Phase 89) -> feeds PWS Value Proposition.

And the four `User Journey Mapping HAS_PROCESS_STEP` nodes -- **Cast a Wide Net / Track Multiple Dimensions / Find Hidden Problems / Follow Workarounds** -- are confirmed live; they map 1:1 onto the v1.14.0 sub-plans (104-02 graph-as-homepage = "Cast a Wide Net"; 104-03 Wikipedia zones = "Track Multiple Dimensions" + "Find Hidden Problems"; 104-04 click-red-link-to-research = "Follow Workarounds"; 104-05 freshness + gap dashboard = "Find Hidden Problems" + "Track Multiple Dimensions"). And the edge `User Journey Mapping REVEALS "Making the Invisible Visible"` is confirmed live -- which is precisely the RECOMMENDED-marker-worthy edge the v1.14.0 TODO entry cited.

## 4. Contradiction-resolution chain -- graph-confirmed

`Knowns and Unknowns Matrix Framework --FEEDS_INTO--> Cynefin Framework` (Cynefin: ADDRESSES Wicked Problem; CO_OCCURS Root Cause Analysis; PREREQUISITE Domain Selection). `MECE (Mutually Exclusive, Collectively Exhaustive) --FEEDS_INTO--> The Pyramid Principle --FEEDS_INTO--> Problem Definition Transformation Framework`. So the Tier-0 chain for the 13 contradictions ("Cynefin-sort -> MECE -> Pyramid Principle -> challenge-assumptions") is confirmed. The devil's-advocate step terminates at `Red Teaming` (graph: `Six Thinking Hats --FEEDS_INTO--> Red Teaming`; `PWS-Bias Devil's Advocate Agent --FEEDS_INTO--> Red Teaming`; `Opposite Plan --FEEDS_INTO--> Red Teaming`).

## 5. Problem-type classification -- graph-confirmed

Our "Ill-defined x Complex bordering Wicked" classification has direct graph support: a large family of frameworks `ADDRESSES_PROBLEM_TYPE -> Ill-Defined Problem` (Design Thinking, JTBD, Adaptive Leadership, Hierarchy Mapping, Causal Loop Diagrams, ...); Wicked is addressed by Cynefin Framework, Causal Loop Diagrams, ESG DD; and there is a literal node **"Ill-Defined + Wicked"** that `PWS Value Proposition --ADDRESSES_PROBLEM_TYPE-->`. So the classification in `01` is the graph's classification.

## 6. The activation-gap argument -- graph-confirmed (this is the load-bearing one)

`Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`. The PWS VP framework's own properties (from the graph): `formula: VPS = R*0.35 + W*0.35 + V*0.30`; `gates: Is It Real (R>=6.0), Can We Win (W>=5.5), Is It Worth It (V>=5.0)`; `teaching_note: A value proposition is not good or bad -- it is strong or weak. The Samsonite Test: strength beats premium.` W is the defensibility dimension. The reverse salient `09` identifies -- the activation layer (the Navigation Engine / insight sensor not firing the Brain, the algorithmic workflows, or web research) -- is, per the graph's own chain, an *input to the W score*. If it isn't fired, the analysis that feeds W is starved, W drops below its gate, VPS fails its gate. The Brain's own beautiful-question node states the remedy: *"How might we design 'insight sensors' that trigger the most appropriate methodology lens?"* (domain: `Dynamic Switching`; action: `Create smart triggers`; LEADS_TO *"What if methodologies activated automatically based on the type of customer insight emerging?"*; ENABLES_EXPERIMENT *"Insight Sensor Prototype"* -- which the roadmap calls the Navigation Engine, Phase 91). **The graph contains both the diagnosis and the prescription.** See `09` for the full treatment.

## 7. What this changes in the bundle

- `01`-`08` frontmatter `brain_mode:` updated from `tier-0` to `mode-a confirmed (re-run 2026-05-10; see 00b)`.
- The v1.14.0 methodology-spine line (in `08` and in `.planning/TODO.md`) should adopt the precise chain in section 3 above.
- `09`'s argument is now graph-backed, not Tier-0 inference: `Reverse Salient Analysis --FEEDS_INTO--> PWS Value Proposition`, and the algorithmic workflows are `--FEEDS_INTO--> Reverse Salient Analysis` in the graph itself.
- No structural overturn anywhere. The Tier-0 work held.
