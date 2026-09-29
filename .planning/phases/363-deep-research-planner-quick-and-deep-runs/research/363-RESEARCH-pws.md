# Phase 363 advisor notes - PWS as the research planner's brain
Date: 2026-09-29. Gray area: how much of the research plan PWS drives. No repo files edited.

## 1. Theo (guarded mindrian-brain shim) - what came back

### brain_ask (freeform NL)
- "Which frameworks structure research for an Ill-Defined problem, and in what sequence?" -> REFUSED, BRAIN_EGRESS_BLOCKED (class freeform_unproven). Constitutional refusal, not outage.
- "Recommend a framework chain for exploring an Undefined problem." -> REFUSED, same class.
- "What does Knowns and Unknowns Matrix Framework feed into?" -> answered, but OFF-TARGET: options Design Thinking / Disruptive Innovation / Red Teaming / Creative Destruction; problem_type IllDefined via heuristic, rung inferred, chain_coverage matched 1 of 6 (partial). Grounding rows were generic chapter snippets (quadrant, ch02b, ch07, bottleneck...), not Map Unknowns content. Treat as THIN.
=> Lesson: brain_ask is an unreliable planner seam; the planner must not depend on NL asks. Anchored Cypher is the reliable seam.

### brain_query (anchored Cypher) - LIVE, grounded
- OPTIONAL MATCH and untyped rel scans are rejected (PLAN_REJECTED: Optional / DirectedRelationshipTypeScan not on read allow-list). Use anchored MATCH only.
- Problem types are DomainConcept nodes keyed by `id` (UnDefined, IllDefined, WellDefined, Wicked), `name` is null.
- Framework counts per problem type (ADDRESSES_PROBLEM_TYPE): IllDefined 51, UnDefined 37, WellDefined 25, Wicked 18. So the ladder itself is well populated; WellDefined IS covered at the ladder level (SEED-097 D3 is specific to Scientific Roadmapping).
- Problem types per target framework:
  - Beautiful Question Framework: UnDefined
  - Knowns and Unknowns Matrix Framework: UnDefined
  - Trending to the Absurd: UnDefined, IllDefined
  - Dominant Design: UnDefined, IllDefined
  - Scenario Planning for High Uncertainty: UnDefined; Scenario Planning: UnDefined, IllDefined, Wicked
  - Reverse Salient Analysis: IllDefined, WellDefined
  - Red Teaming: UnDefined, IllDefined, WellDefined
  - Hypothesis-Driven Problem Solving: WellDefined
  - Scientific Roadmapping: UnDefined, IllDefined, Wicked
  - Analogical Reasoning / Analogies as discovery tool (Find Analogies): no ADDRESSES_PROBLEM_TYPE edge found (thin)
- Wicked frameworks (18): Scenario Planning, Six Thinking Hats, Systems Thinking, BONO-Innovation Framework, Causal Loop Diagrams, Cynefin Framework, Cynefin-Informed Sequential Innovation Discovery (+ Beautiful Question pedagogy variant), Feedback loops, Invention Disclosure Strategic Framework, PWS Value Proposition, PWS-Bias Devil's Advocate Agent, Process Mapping, Stock and Flow Diagrams, Systems lens, Theory of Change, Wicked Problem Detection Framework, Scientific Roadmapping.
- FEEDS_INTO (sequence edges):
  - Scientific Roadmapping -> Reverse Salient Analysis, Hypothesis-Driven Problem Solving, PWS Value Proposition, Three-Horizon Framework
  - Beautiful Question -> Beautiful Questions Bias Detection, Domain Selection, PWS Value Proposition
  - Knowns and Unknowns Matrix -> Cynefin Framework
  - Trending to the Absurd -> JTBD, Red Teaming, Scenario Planning, Domain Selection, PWS Value Proposition
  - Dominant Design -> Adoption-Capacity Theory, Reverse Salient Analysis
  - Reverse Salient Analysis -> Adoption-Capacity Theory, JTBD, Scenario Planning, Causal Loop Diagrams, PWS Value Proposition
  - Hypothesis-Driven Problem Solving -> Red Teaming
  - Red Teaming -> PWS Triple Validation Compass, Reverse Salient Analysis, Problem Definition Transformation Framework
- HAS_PROCESS_STEP (the thing option b needs) across the 10 target frameworks: ONLY Scientific Roadmapping (7) and Scenario Planning for High Uncertainty (5). Beautiful Question, Map Unknowns, RS, HDPS, Dominant Design, Trending to Absurd, Analogical Reasoning, Red Teaming: zero steps.
- USES_TECHNIQUE: Scientific Roadmapping 12, Beautiful Question 1, all others 0 in this set.
- SEED-097 live check already recorded that SR's step content sits under legacy property names and Theo's typed framework_step returns null label/runIt (D4) - so even the one fully stepped framework is not yet readable through the typed seam.

### brain_search (lexical)
- "Ill-Defined problem frameworks" -> chapter CONCEPT snippets (beautiful, fastdiag, ch08, ch11, growth, biodesign, ch02). Confirms the ladder semantics: Un-Defined = explore for opportunities, high uncertainty, long horizon; Ill-Defined = build a bank of opportunities; Well-Defined = solve it, low uncertainty, near term. "What changes rung to rung is specificity, not difficulty" (ch08). ch11: Un/Ill-Defined scoped with Reverse Salients, Life Cycle Analysis, Core Technology Extension.

### Grounding verdict
- LIVE + grounded: problem-type -> framework edges, FEEDS_INTO sequence edges, ladder semantics.
- THIN: per-framework process steps/techniques (only SR, Scenario Planning), brain_ask chain recommendations (refused or partial 1/6), Find Analogies problem-type tagging, SR typed step seam (D4).

## 2. Repo findings (read-only)
- lib/workflow/command-resolver.cjs composeWorkflow(chain): framework name -> first registry command, `optional:true` when none. Local registry only, zero Brain calls. The only door framework -> command.
- lib/core/recipe-maps.cjs: SENS10_CAUSE_RECIPES (cause -> ordered chain: autonomous_safe recon prefix -> /mos:bono material gate -> /mos:tell-synthesis) and NAMED_RECIPES (PWS_grading). Pattern to copy: a research SHAPE is a named recipe of bare command strings; posture comes from postureForCommand, never hardcoded. wrong_frame recipe already leads with beautiful-question; stuck_unlocated with find-bottlenecks; assertion_unvalidated with challenge-assumptions.
- lib/core/rs-query-matrix.cjs: deterministic 15 templates x 4 categories = 60 queries from a local domain analysis, FORBIDDEN_PATTERNS scan pre-input and per-template (ExternalEgressViolation). This is already "PWS lens + templated sub-queries" - the (a) pattern, in production for RS.
- lib/core/rs-nl-to-query.cjs: the single chokepoint turning NL into a Brain payload; unrecognized intents -> brain_query null. Structural reason the user's question can never be decomposed BY Theo: only generic handles cross.
- commands/diagnose.md (Problem Definition Transformation Framework, autonomous_safe), map-unknowns.md (Knowns and Unknowns Matrix Framework, autonomous_safe, F.8 independent matrix), beautiful-question.md (Beautiful Question Framework, autonomous_safe, F.9 fixed-order walk). All recon-prefix eligible.

## 3. External sources
- STORM (stanford-oval/storm; storm-project.stanford.edu/research/storm): "Perspective-Guided Question Asking: besides instructing the LLM to generate questions on a given topic, we include a specific perspective in the prompt to provide focus and prior knowledge"; perspectives mined from related Wikipedia articles; then simulated writer-expert conversation grounded in retrieval. Write-ups note plain question prompting underperforms without perspectives. => A perspective injected into LLM question generation is the proven lever. PWS frameworks are a far stronger perspective source than "related Wikipedia articles".
- LangChain open_deep_research (github.com/langchain-ai/open_deep_research; langchain.com/blog/open-deep-research): scope -> research brief -> supervisor decides whether to split into independent sub-topics -> sub-agents with isolated context -> supervisor reflects, spawns more if gaps -> single-shot report. Decomposition is generic LLM judgment.
- GPT-Researcher (langchain.com/blog/gpt-researcher-x-langchain): planner generates a set of research questions "that together form an objective opinion", execution agents crawl per question, planner aggregates. Generic decomposition; no falsifier step.
- Neither open_deep_research nor GPT-Researcher has an explicit counterevidence/falsifier search; STORM has multi-perspective but no falsification. This is the gap PWS fills.

## 4. Decision
Recommend (a), strengthened: PWS (via Theo edges) picks the research SHAPE, the lens sequence, and each lens's falsifier; the LLM fills sub-queries locally inside each lens (STORM-style perspective-guided). Where a framework has live typed steps (SR today once D4 lands; Scenario Planning), the deep run uses those steps as the plan skeleton. That is the upgrade path toward (b) per framework, gated on Theo authoring, not a global switch.
Reject (b) as default: step data exists for 2 of 10 frameworks; brain_ask refuses the planning question; Part 8 means Theo can never see the question to decompose it.
Reject (c): throws away the moat (WHEN/WHICH/SEQUENCE) and reduces MindrianOS to a GPT-Researcher clone with a label.

## 5. Mapping table (see handback)
| Problem type | Research shape | PWS frameworks driving plan steps (Theo-tagged) | Counterevidence / falsifier search | Default |
|---|---|---|---|---|
| Undefined | Landscape scan, breadth-first, many lenses | Beautiful Question (reframe) -> Knowns/Unknowns Matrix (unknowns become the query set) -> Trending to Absurd / Scenario Planning for High Uncertainty (5 live steps) / Dominant Design | An "unknown" is already answered in the literature; the trend breaks before the absurd extreme; a "driving force" is actually predetermined | Deep |
| Ill-Defined | Opportunity bank, fan-out across independent lenses | Reverse Salient, Dominant Design (FEEDS_INTO RS), Trending to Absurd, Scientific Roadmapping (7 steps, 12 techniques), Red Teaming; Find Analogies (untagged, thin) | RS: fixing the component does not move the outcome; SR: the bound is fundamental; Analogy: a transfer condition fails in the target; Whitespace: gap is covered under another term | Deep; Quick if one lens named |
| Well-Defined | Hypothesis test, narrow depth-first | Hypothesis-Driven Problem Solving -> Red Teaming (live FEEDS_INTO); Reverse Salient | Disconfirming evidence for the lead hypothesis; Red Team attack on the spec | Quick |
| Wicked | Systems map, bounded, never forced to converge | Scenario Planning, Systems Thinking / Causal Loop Diagrams, Cynefin, Six Thinking Hats, Scientific Roadmapping | Feedback loop reverses the intervention; stakeholder frame contradicts; keep "unresolved" | Deep, reviewed plan |
