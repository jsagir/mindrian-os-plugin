# Feature Landscape: Causal Reasoning Layer (v1.7.0)

**Domain:** Causal reasoning for venture intelligence / wicked problem management
**Researched:** 2026-04-03
**Confidence:** MEDIUM-HIGH

---

## Competitive Landscape Summary

### Knowledge Management Tools (Notion, Obsidian, Roam Research)

**Finding: Zero causal reasoning features.** These tools offer bidirectional links, graph visualization, and backlinks. That is it. None distinguish between "A links to B" and "A causes B." None track directionality, confidence, or mechanism. None offer prediction tracking or cascade analysis.

- **Notion**: Relational databases, kanban boards, AI summaries. No causal modeling.
- **Obsidian**: Bidirectional links and graph view. The graph is navigational, not analytical -- it shows co-occurrence, not causation.
- **Roam Research**: Block references and daily notes. "Networked thought" means associative linking, not causal chains.

**Implication:** The bar for "better than what exists" is extremely low. Any directed edge with a mechanism field already exceeds everything in the PKM space.

### Specialized Causal Tools

Three tiers exist:

1. **Systems dynamics simulators** (Vensim, Simantics, Insight Maker) -- Full stock-and-flow modeling with simulation engines. Powerful but require systems dynamics expertise. Users build mathematical models. Adoption limited to academics and trained practitioners.

2. **Causal mapping platforms** (Kumu, Causal Map) -- Visual tools for drawing causal loop diagrams. Kumu is the most accessible: browser-based, free for public projects, imports from spreadsheets. However, these are drawing tools -- they don't compute anything. No simulation, no contradiction detection, no prediction tracking.

3. **Causal AI platforms** (causaLens, DoWhy, CausalNex) -- Enterprise causal inference engines for data scientists. Require statistical datasets, Python expertise, and causal graph specification. Not applicable to qualitative venture reasoning.

**Implication:** A massive gap exists between "draw causal arrows on a whiteboard" (Kumu) and "run Monte Carlo simulations on a stock-and-flow model" (Vensim). Nobody occupies the middle ground of qualitative causal reasoning with lightweight computation. This is MindrianOS's territory.

### Prediction Tracking (Metaculus, Polymarket, PredictionBook)

- **Metaculus**: Reputation-based forecasting. Users submit probability estimates on structured questions. Brier score tracking. Calibration curves per user. No financial stakes.
- **Polymarket**: Blockchain prediction markets. Financial stakes drive accuracy. Binary yes/no resolution.
- **PredictionBook**: Personal prediction journal. Simple probability + resolution. Dead-simple UX.

**Key UX patterns from prediction platforms:**
- Questions must be falsifiable with clear resolution criteria
- Probability estimates (not binary yes/no)
- Time-bounded resolution dates
- Calibration feedback ("you said 80% and were right 60% of the time")
- Scoring via Brier score or log score

**Implication:** Personal prediction tracking works when it is dead simple: a claim, a probability, a resolution date, and an outcome. The Metaculus model (structured questions + calibration feedback) is the right pattern, not the Polymarket model (financial markets). MindrianOS should adopt PredictionBook-level simplicity with Metaculus-level calibration feedback over time.

### Assumption Tracking (Lean Startup / Innovation)

Board of Innovation and Lean UX practitioners use a 2x2 assumption map: importance vs. certainty. Assumptions in the "important + uncertain" quadrant get tested first. Miro and FigJam offer templates.

**Key insight:** Assumption mapping is standard practice in venture methodology. But nobody connects assumptions to causal chains. Nobody tracks what happens downstream when an assumption is invalidated. This is the cascade problem -- and it is unsolved.

---

## Table Stakes

Features users expect. Missing = the causal layer feels like a toy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Causal claim extraction** -- Larry identifies cause-effect statements from user text and room artifacts | Users won't manually tag claims. If Larry can't extract "A causes B because C" from natural conversation, the feature is dead on arrival. | Medium | LLM extraction with structured output. Must handle implicit causation ("revenue grew after we launched" = implied causal claim). Post-write hook triggers extraction after any artifact filing. |
| **Directed causal graph** -- KuzuDB stores CAUSES edges with mechanism + confidence fields | The whole point. Without directed edges that distinguish cause from effect, this is just another link. | Low | Already planned in PROJECT.md. CausalClaim node type + CAUSES/CASCADES_TO edges. Extends existing LazyGraph pattern. |
| **"Why?" chain traversal** -- trace back from an effect to root causes | Users already have /mos:root-cause. The causal graph should make root cause traversal automatic, not manual. Asking "why does Y happen?" and getting a chain is the minimum viable interaction. | Low-Medium | KuzuDB Cypher path traversal or NetworkX. Display as indented chain, not graph diagram. |
| **"So what?" forward trace** -- if X changes, what downstream effects exist? | The inverse of "why." Users need both directions. Forward trace is how you evaluate decisions: "if I change pricing, what breaks?" | Low-Medium | Same graph traversal, opposite direction. Reuses the same engine. |
| **Contradiction detection** -- flag when two causal claims conflict | Users already expect this from room-proactive intelligence. Causal contradictions ("A causes B" vs "A prevents B") are the most valuable contradictions to surface. | Medium | Compare CAUSES edges between same nodes with conflicting polarity. Surface via existing proactive intelligence loop. Fits naturally into the CONTRADICTS edge type. |

### Dependency Note
Extraction must come first. Everything else depends on having causal claims in the graph.

---

## Differentiators

Features that set MindrianOS apart. Not expected, but deliver the "aha" moment.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cascade simulation (plain language)** -- "If this assumption breaks, here's what falls" | Nobody does this for qualitative reasoning. Vensim does it for quantitative models. Kumu doesn't do it at all. This is the killer feature: show the user a domino chain in words, not graph theory. | Medium-High | See "Cascade Presentation" section below. Output is a numbered consequence chain, not a force-directed graph. |
| **Assumption-causal linking** -- every assumption in the room connects to the causal claims that depend on it | Board of Innovation assumption maps are static 2x2 grids. MindrianOS shows: "This assumption supports 7 downstream causal claims. If it breaks, here's the blast radius." Transforms assumption tracking from a checklist to a live impact map. | Medium | Wire assumption nodes to CausalClaim nodes via SUPPORTS edge. Blast radius = count of downstream CASCADES_TO from claims supported by the assumption. |
| **Convergence signals across reasoning types** -- when causal chains + HSI connections + reverse salients + analogies all point to the same node | This is the MWP moat in action. No tool on the market crosses causal reasoning with surprise connections with bottleneck detection with cross-domain analogies. When 4 analytical lenses converge on the same insight, that is real signal. | Medium | Cypher query walking Causal + HSI + RS + Analogy edges to find nodes with high in-degree across all types. Already sketched in PROJECT.md. |
| **Lightweight prediction tracking** -- falsifiable predictions with probability, resolution date, and outcome | Metaculus proves this works. PredictionBook proves it can be simple. Nobody embeds predictions inside a causal graph. MindrianOS's version: every causal claim can generate a testable prediction, and resolved predictions update the confidence of the parent claim. Closed-loop learning. | Low-Medium | REGISTRY.json per room. Fields: claim_id, prediction_text, probability (0-1), resolution_date, outcome (null/true/false), resolved_date. Larry prompts: "You said X causes Y. What would we observe if that's true? By when?" |
| **Bottleneck surfacing via betweenness centrality** -- "this node is the critical path for 12 causal chains" | Hughes reverse salient theory applied to the causal graph. Nodes with high betweenness centrality are the bottlenecks constraining the whole system. Users don't need graph theory -- Larry says: "Everything flows through [node]. If this breaks, 12 things downstream break with it." | Medium | NetworkX betweenness_centrality on causal subgraph. Present as "critical path" language, not graph metrics. |

---

## Anti-Features

Features to deliberately NOT build. These sound impressive but destroy usability or never get used.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Visual causal loop diagram editor** | CLD research is clear: diagrams with >12 elements overwhelm users. Building a visual editor is a massive UX effort (drag-drop, layout algorithms, zoom/pan) competing with Kumu which is free and already good at this. Users don't want to draw diagrams -- they want Larry to reason about causation. | Let Larry describe causal chains in natural language. Use existing De Stijl graph view for optional visualization. Never require users to manually draw causal maps. |
| **Quantitative simulation engine** | Stock-and-flow simulation (Vensim territory) requires users to specify mathematical relationships. Venture reasoning is qualitative: "more marketing spend probably increases pipeline." Forcing numerical precision on uncertain qualitative relationships produces false confidence. | Keep causal reasoning qualitative. Confidence levels (high/medium/low or 0-1 scale), not equations. "If A breaks, B and C are affected" -- not "B decreases by 23%." |
| **Formal causal inference (do-calculus, DAG identification)** | Pearl's causal inference framework requires observational datasets and careful identification of confounders. Venture intelligence operates on sparse qualitative claims, not statistical data. Implementing do-calculus would be technically impressive and completely useless for the target user. | Use LLM reasoning for mechanism identification. Use graph structure for chain traversal. Leave formal causal inference to causaLens and data scientists. |
| **Real-time collaborative causal mapping** | Multi-user simultaneous editing of a shared causal graph requires conflict resolution, operational transforms, and complex state synchronization. | Let Cowork handle collaboration natively. Causal claims file to the room like any other artifact. Team members see each other's claims in the graph. |
| **Prediction markets / betting mechanics** | Financial incentives distort reasoning in small-team contexts. Polymarket works for large liquid markets, not for a 3-person founding team. Gamification of predictions creates perverse incentives (sandbagging, anchoring to team consensus). | Simple probability + resolution date + outcome. No stakes, no markets, no leaderboards. Just honest calibration tracking. |
| **Automated causal discovery from text corpus** | Mining an entire room for all possible causal relationships produces noise. Every sentence with "because," "leads to," or "results in" would generate a claim. Signal-to-noise ratio would be terrible. | Extract causal claims selectively: during methodology sessions, when Larry identifies key assumptions, and when the user explicitly asks. Quality over quantity. Trigger extraction at filing time (post-write hook), not as a batch sweep. |
| **Mechanism specification forms** | Asking users to fill in structured fields for every causal claim (mechanism type, domain, evidence strength) adds friction for marginal benefit. | Larry should infer mechanisms from context, not demand them. If the user says "we grow because word of mouth," Larry extracts the mechanism. The user never sees a form. |

---

## Feature Dependencies

```
Causal Claim Extraction (TABLE STAKES)
  |
  v
Directed Causal Graph Storage (TABLE STAKES)
  |
  +---> "Why?" Chain Traversal (TABLE STAKES)
  |
  +---> "So What?" Forward Trace (TABLE STAKES)
  |
  +---> Contradiction Detection (TABLE STAKES)
  |
  +---> Assumption-Causal Linking (DIFFERENTIATOR)
  |       |
  |       v
  |     Cascade Simulation (DIFFERENTIATOR)
  |
  +---> Bottleneck Surfacing (DIFFERENTIATOR)
  |
  +---> Prediction Tracking (DIFFERENTIATOR -- can build in parallel)
  |       |
  |       v
  |     Closed-Loop Confidence Update
  |       (prediction resolves -> claim confidence changes)
  |
  +---> Convergence Signals (DIFFERENTIATOR)
          requires HSI + RS + Analogy edges to already exist
```

**Critical path:** Extraction -> Storage -> Traversal. Everything else layers on top.

**Parallel-safe:** Prediction tracking can be built alongside the core graph because it only needs a claim_id reference.

**External dependency:** Convergence signals require sufficient edge density across HSI, RS, and Analogy types. This is a late-stage feature that only becomes useful after users have populated their rooms with diverse analytical artifacts.

---

## Cascade Simulation: How to Present to Non-Experts

Research finding: CLD diagrams with >12 elements overwhelm even trained practitioners. Force-directed graph layouts are meaningless to users who don't read graph theory.

### The Right UX: Domino Narration

Instead of showing a graph, Larry narrates the cascade as a numbered consequence chain:

```
You asked: "What if our qualification timeline assumption is wrong?"

That assumption supports 3 causal claims in your room:

1. Qualification timeline (18 months) creates competitive moat
   -> If wrong: Competitors can qualify in parallel. Moat shrinks.

2. Long qualification -> customer lock-in -> recurring revenue stability
   -> If wrong: Customers can switch vendors. Revenue becomes volatile.

3. Qualification cost -> barrier to entry -> limited competition
   -> If wrong: Lower barrier means more entrants. Pricing pressure.

Blast radius: 3 direct claims, 7 downstream effects across
market-analysis, business-model, and competitive-analysis sections.

Most critical downstream effect:
  Revenue model assumes 85% retention. If qualification doesn't create
  lock-in, retention drops and your unit economics break at Year 2.

Want to:
  (a) Create a falsifiable prediction to test the timeline assumption?
  (b) Trace deeper into the revenue model impact?
  (c) Find analogies for markets where qualification didn't create moats?
```

### Design Principles for Cascade UX

1. **Words first, graph optional.** The primary output is natural language narration. The De Stijl graph view exists for users who want it, but Larry's narration is the default.

2. **Numbered consequences, not network diagrams.** Users understand "1, 2, 3 things break" better than "node A connects to nodes B, C, D with weighted edges."

3. **Blast radius as a single number.** "This affects 7 downstream claims across 3 room sections." One number communicates severity without requiring graph literacy.

4. **Identify the worst-case domino.** Don't just list consequences -- identify which one is most damaging. "The most critical downstream effect is..."

5. **Action-oriented endings.** Every cascade output ends with "what do you want to do about it?" -- test, trace deeper, or find alternatives.

6. **Progressive disclosure.** Start with the summary (3 claims affected, 7 downstream). User can ask to expand any branch. Never dump the full graph at once.

---

## Prediction Tracking: Practical Design

### What Works (from Metaculus/PredictionBook patterns)

| Element | Implementation | Why |
|---------|---------------|-----|
| Structured question | "Will [specific observable] happen by [date]?" | Forces falsifiability. Vague predictions can't be scored. |
| Probability estimate | 0-1 scale, displayed as percentage | Captures uncertainty. "70% confident" is more useful than "I think so." |
| Resolution criteria | What counts as true/false? Who judges? | Prevents retroactive rationalization. |
| Resolution date | When does this get checked? | Prevents predictions from living forever unresolved. |
| Outcome tracking | true/false/voided + actual date | Closed loop. The prediction actually gets resolved. |
| Calibration feedback | "Your 80% predictions came true 60% of the time" | The whole point: improve reasoning quality over time. |

### What to Skip

| Element | Why Skip |
|---------|----------|
| Brier score display | Too technical for most users. Show calibration curves instead ("you're overconfident at 80%+"). Only show Brier score to users who ask. |
| Community aggregation | Single-user or small-team context. No wisdom of crowds to aggregate. |
| Score leaderboards | Perverse incentives in small teams. |
| Continuous probability updates | Metaculus allows updating predictions over time. Overkill for personal tracking. One estimate at creation, one resolution. Keep it simple. |

### Larry's Role in Prediction Tracking

Larry should proactively prompt for predictions at natural moments:

- After a causal claim is extracted: "You said X causes Y. What would we observe in the next 6 months if that's true?"
- After a cascade analysis: "The most critical assumption here is [Z]. Want to set a prediction to test it?"
- During JTBD cycle (every 3-7 turns): "You have 3 predictions coming due this month. Want to review them?"
- After room-proactive contradiction detection: "This new information contradicts a prediction you made. Time to resolve it?"

### Prediction Storage

```
room/.predictions/REGISTRY.json

{
  "predictions": [
    {
      "id": "pred-001",
      "claim_id": "causal-017",
      "question": "Will qualification take >12 months for competitor X?",
      "probability": 0.75,
      "resolution_criteria": "Competitor X announces qualified product",
      "resolution_date": "2026-10-01",
      "created": "2026-04-03",
      "outcome": null,
      "resolved_date": null,
      "room_section": "competitive-analysis"
    }
  ]
}
```

---

## The 3-5 Features Users Will Actually Use

Based on research, these survive contact with real users vs. features that sound impressive in demos:

### Will Actually Use

1. **"Why does this happen?" chain traversal** -- The most natural interaction. User asks a question, Larry traces the chain. This is what users already try to do mentally. Making it automatic and graph-backed is immediately useful.

2. **"If this breaks, what else breaks?" cascade narration** -- Every founder lies awake worrying about this. A structured answer to "what's my blast radius if X goes wrong?" directly addresses anxiety and drives better decision-making.

3. **Contradiction surfacing** -- Users already value this from room-proactive intelligence. Adding causal contradictions (same cause, opposite effects claimed) to the existing contradiction pipeline is a natural extension that users don't need to learn.

4. **Assumption blast radius** -- "This assumption supports 7 downstream claims." A single number that changes how users prioritize what to validate. Simple, powerful, immediately actionable.

5. **Lightweight predictions** (conditional) -- Only if Larry prompts naturally. Users won't voluntarily go to a prediction tracker. But if Larry says "You just claimed X. Want to bet on it? 70%? Check back in 3 months?" -- some users will engage. Track adoption before investing more.

### Will NOT Use (despite sounding good)

- **Graph visualization of causal network** -- Users look at it once, say "cool," and never open it again. The De Stijl graph view already covers this. Don't build causal-specific visualization.
- **Manual causal claim creation** -- Nobody will manually tag "A causes B." Extraction must be automatic or it won't happen.
- **Calibration dashboards** -- Requires months of prediction data. By the time there's enough data, users have either adopted the habit or abandoned it. Build only after evidence of adoption.
- **Formal mechanism specification** -- Asking users to specify mechanism details adds friction for marginal benefit. Larry should infer mechanisms, not demand them.
- **Causal graph export/import** -- Interoperability sounds responsible but no user will import a causal graph from another tool (none exist) or export one (to where?).

---

## MVP Recommendation

### Phase 1: Core Causal Engine (must ship together)
1. **Causal claim extraction** -- Larry identifies and structures cause-effect-mechanism triples
2. **Directed causal graph** -- CausalClaim nodes + CAUSES/CASCADES_TO edges in KuzuDB
3. **"Why?" and "So what?" traversal** -- bidirectional chain walking via /mos:causal trace
4. **Contradiction detection** -- surface conflicting causal claims via proactive intelligence

### Phase 2: Differentiation (build immediately after Phase 1)
5. **Assumption-causal linking** -- wire existing room assumptions to causal claims
6. **Cascade simulation** (plain language narration) -- /mos:causal cascade
7. **Prediction tracking** -- /mos:causal predict with REGISTRY.json

### Defer to v1.8+
- **Convergence signals** -- requires all edge types (HSI, RS, Analogy, Causal) to have sufficient density in real rooms. Ship after users have populated causal graphs in practice.
- **Calibration feedback** -- requires resolved predictions to exist. Useful only after users have tracked predictions for weeks/months.
- **Bottleneck surfacing** -- requires enough causal claims to make betweenness centrality meaningful (~20+ nodes). Gate behind a density threshold.

---

## Sources

### Causal Reasoning Landscape
- [causaLens Causal Reasoning Lab](https://causalens.com/causal-reasoning-lab) -- Enterprise causal AI platform
- [Causal Knowledge Graph for Enterprise Innovation (2025)](https://link.springer.com/article/10.1007/s44443-025-00086-3) -- KG + causal inference integration
- [Causal AI Disruption Across Industries 2025-2026](https://acalytica.com/blog/causal-ai-disruption-across-industries-2025-2026) -- Market adoption data (70% of AI orgs)

### Knowledge Management Comparison
- [Notion vs Obsidian vs Roam 2026](https://www.yuanqilife.com/notion-vs-obsidian-vs-roam-research-note-taking-apps-2026/) -- Feature comparison confirming no causal features
- [Best PKM Tools (Nodus Labs)](https://support.noduslabs.com/hc/en-us/articles/13449999219484-Best-PKM-Tools-in-2024-Obsidian-vs-Roam-Research-vs-Evernote-vs-Notion) -- Linking capabilities, not causal

### Causal Mapping & Systems Dynamics
- [Kumu Causal Loop Diagrams](https://kumu.io/maryulseth/causal-loop-diagram-introduction-explanation) -- Visual causal mapping (free public, $9/mo private)
- [Vensim Software](https://vensim.com/software/) -- Systems dynamics simulation
- [Insight Maker](https://insightmaker.com/) -- Free browser-based CLD + simulation
- [MetaSD: Are CLDs useful?](https://metasd.com/2010/04/are-causal-loop-diagrams-useful/) -- Critical evaluation of CLD effectiveness

### CLD Usability Research
- [CLD Influence on Systems Thinking (2025)](https://www.sciencedirect.com/science/article/pii/S2451958825000284) -- Diagrams >12 elements overwhelm users
- [Creately CLD Guide](https://creately.com/guides/causal-loop-diagram/) -- Best practices for accessible CLDs

### Prediction Tracking
- [Metaculus Forecasting Platform Guide](https://www.predictionmarket.tools/news/metaculus-forecasting-platform-guide) -- UX patterns
- [Metaculus Review 2026](https://predictionmarketsreviews.com/reviews/metaculus) -- Brier scoring, calibration curves
- [LessWrong: Tracking Personal Forecasts](https://www.lesswrong.com/posts/R22HQJBiMnaSrr6cN/question-tracking-accuracy-of-personal-forecasts) -- Personal prediction tracking discussion
- [Brier Index (Forecasting Research)](https://forecastingresearch.substack.com/p/introducing-the-brier-index) -- Making scores interpretable

### Assumption Tracking
- [Board of Innovation Assumption Mapper](https://www.boardofinnovation.com/tools/assumption-mapper/) -- 2x2 importance vs certainty
- [Maze Assumption Mapping Guide](https://maze.co/blog/assumption-mapping/) -- Lean UX methodology
- [UXtweak Assumption Mapping Guide](https://blog.uxtweak.com/assumption-mapping/) -- Practical implementation

### Cascade / Ripple Effect
- [Ripple Effect Visualization in Supply Chains (2021)](https://www.tandfonline.com/doi/full/10.1080/00207543.2021.1987547) -- Systems dynamics approach to cascade viz
- [Cascade Effects in Business Continuity](https://continuity2.com/blog/cascade-effects-in-business-continuity-planning) -- Flowchart-based cascade communication for non-experts

---
*Feature research for: MindrianOS v1.7.0 Causal Reasoning Layer*
*Researched: 2026-04-03*
*Prior version archived: covers v3.0 MCP Platform research from 2026-03-24*
