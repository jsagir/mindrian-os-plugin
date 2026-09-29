# Scientific Roadmapping read as a research-perspective builder (navigator source, 2026-09-29)

Source: the PWS Methodology article "Ideas live in the constraint layer, not the solution layer"
(September 2026), pasted by the navigator into the Phase 363 discuss thread. Its roadmap formats,
productive-tension criterion, forum design and domino test are credited in the article to Adam
Marblestone, "A Beginner's Guide to Scientific Roadmapping" (Convergent Research, 2025). The
constraint-layer framing, the rung mapping, the solo forum protocol and the ratchet condition are
the article's own reading. Author names are withheld here per the repo's no-personal-names rule.

## The one-line version

Do not ask what to build. Enumerate what the field treats as fixed, prove which of those are
actually physics, and the remainder is the idea list, already ranked by how many other things each
one unlocks.

## The seven operations as a research builder

| # | Step (graph name) | As an idea / research engine | Run it | Failure mode |
|---|---|---|---|---|
| 1 | Tension Qualification | Screens the search space: stay only where the field agrees the goal is valuable and disputes feasibility. No nameable physical constraint = a wish, kill the topic. | "Everyone agrees that ___ would change this field. Nobody agrees whether ___ is reachable this decade." | Fashionable topic (fashion is consensus) |
| 2 | Goal Quantification | Installs a gradient so ideas can be ranked. | Target with a unit and threshold, plus the result that would prove the direction wrong. | Quantifying the easy axis, not the one that matters |
| 3 | Rung Placement and Type Selection | Picks the search method and the kind of idea available (rung caps the ceiling). Un-Defined: Landscape / Vision (reframings). Ill-Defined: Manifesto / Technical Roadmap (programs). Well-Defined: Pipeline / Opportunity (optimizations). | Match the question to one phrasing; commit to the honest rung, even when higher. | Technical Roadmap in a domain with no physics |
| 4 | Forum Construction | The assumption set bounds the idea space. Three roles: frustrated insider, fresh entrant, physics grounder, to tell impossible from nobody-tried. Consensus is not the goal. | Solo protocol: write the three roles serially, in writing, on separate passes. | Recruiting people who agree; stump speeches |
| 5 | Path Enumeration | Generate by coverage, not association; MECE test the route list; 10X forces a full resurvey. | List routes; check overlap (not ME) and uncovered regions (not CE). | Stopping at currently funded routes (the attractor) |
| 6 | Constraint Interrogation | THE generative step. Every limiter is physics or assumed; no third column. Every assumed limiter becomes "what if we attacked ___, which this field treats as fixed?" Un-Impossible Decomposition: impossible -> hard in N specific ways. S-curve position says route around (near ceiling) or push (headroom). | Two literal columns, force every limiter; rewrite right-hand entries as questions. | Filing under physics because a senior person was confident |
| 7 | Catalytic Ranking | Rank by downstream unlock chain length, not novelty. The chain is ranking criterion, funding argument and significance section at once. | Write each unlock chain explicitly and count it. | Counting dominoes you would push yourself |

Loop 7 -> 1: solving a bottleneck reveals the next binding constraint. Ratchet: version the roadmap,
keep every discarded path with its reason, never re-litigate a settled constraint without new
physics. Institutional memory separates a pipeline from an oscillation.

Handoffs: feeds in from Problem Typology / Problem Taxonomy (rung classification); feeds out to
Reverse Salient Analysis (ranked, argued bottlenecks) and Hypothesis-Driven Problem Solving (every
assumed limiter is a falsifiable claim). Its real function in the chain is to carry an Un-Defined
question down to the rung where hypothesis testing becomes possible.

## What the Neo4j graph holds (direct read, 2026-09-29, framework content only)

- `Framework {name:'Scientific Roadmapping'}`: pattern_type cyclical; stages discovery,
  problem_definition, opportunity-identification, decision; chapter `bottleneck`; key_action
  "Convene the forum, then rank bottlenecks by downstream dominoes"; when_to_use / when_not_to_use
  as in step 1.
- 7 `ProcessStep` nodes with `order`, `description`, `key_question`, `gates`, `outputs`, chained by
  `LEADS_TO` 1 -> 7 and 7 -> 1.
- 12 `Technique` nodes: 10X Resurvey, Boundary Object Design, Domino Counting, Fundamental-vs-Assumed
  Test, MECE Decomposition, Participant Casting, Polyvocal Synthesis, Productive Tension Test,
  Quantified Stretch Goal, Rung Placement, Trading Zone Construction, Un-Impossible Decomposition.
- Edges: ADDRESSES_PROBLEM_TYPE UnDefined / IllDefined / Wicked; PREREQUISITE Problem Taxonomy
  (Search Gradient); FEEDS_INTO Reverse Salient Analysis, Hypothesis-Driven Problem Solving, PWS
  Value Proposition, Three-Horizon Framework; fed by S-Curve Analysis, The Innovation Landscape,
  Problem Typology; COMPLEMENTS Scenario Planning for High Uncertainty; aliases Field Roadmapping,
  Roadmapping, Tech Tree Mapping, Technology Roadmapping.
- Theo's typed `framework_step` returned empty labels for this framework on 2026-09-29; the graph
  itself has full content. The plugin must read it through a path that works (D-17 dev-time ledger
  plus a guarded runtime read), subject to the Brain IP ruling on what may ship as data.
