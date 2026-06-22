# Mindrian Canon

Version: 1.14
Date: 2026-06-22
Status: Active
Author: Jonathan Sagir with Claude-as-Larry

---

## North Star

> Mindrian is compass and map for the wicked navigator. It does not solve the venture. It arms the person solving it with the right tool, at the right stage, against the right evidence, while guarding what is theirs.

---

## Part 1 - The Wicked Navigator

- The user is not a "founder," "researcher," or "operator" in the abstract. The user is a person walking through a wicked problem (Rittel and Webber 1973).
- Every feature is judged by whether it reduces time between insight and validated decision for that specific navigator in that specific stage of their journey.
- The room is the navigator's working memory made legible. The graph is their nervous system.
- Larry is the pedagogical guide who walks beside the navigator. Not above them, not instead of them. Larry operates with Brain (Full Loop) or without Brain (Local Only). The pedagogy is intrinsic to Larry, not dependent on Brain availability. When the Brain is unreachable, Larry still teaches from local context, local graph, and Tier 0 methodology fallbacks. When the Brain is reachable, Larry's teaching is enriched but never replaced.

---

## Part 2 - The Team Around the Navigator

The user is the wicked navigator. Mindrian spawns a context-built team around them, generated per-session from two engines and armed with four affordances. The team never impersonates the navigator. The team argues, proposes, disagrees, evidences. The navigator decides.

### Engine 1 - Domain Exploration (Act 1 in Context)

Engine 1 is the full Act 1 intelligence surface that runs before the team spawns. It is code-driven, powered by embeddings and HSI scoring infrastructure already shipped in the plugin.

Three layers, each algorithmic:

  DECOMPOSITION       Five lenses (Disciplinary, Stakeholder, System, Temporal, Scale). Primary domains -> subdomains -> focus areas. Each node carries supporting evidence, dissenting evidence, emerging trends.

  WHITESPACE MAP      Code-driven. /mos:whitespace wraps Python scripts that compute whitespace zones using sentence-transformers + LSA against the room's artifact corpus. Every whitespace node is a candidate Opportunity Bank ADD, HSI-scored for filing priority.

  REVERSE SALIENT +   Code-driven. Python scripts compute reverse salients (Hughes 1983 framework)
  CROSS-DOMAIN MATCH  against Pinecone embeddings (12,401 methodology nodes in Brain's semantic index). Cross-domain analogies surface where embedding similarity crosses threshold but source domains differ. Every match is a candidate Opportunity Bank ADD with HSI score. Command-level wrappers: /mos:find-bottlenecks, /mos:find-connections, /mos:find-analogies, /mos:score-innovation.

Output: enriched domain tree where every node carries its internal decomposition AND its Act 1 intelligence payload (whitespace + reverse salients + cross-domain analogies, all HSI-scored). Engine 2 (BONO Orchestration) reads this payload to shape the team and its beautiful questions.

Act 1 runs per session. Results cache to STATE.md with source-hash invalidation. Opportunity Bank ADDs surface at the next Decision Gate for user approval (APPROVE cascades to bank; REJECT reason becomes graph data per Part 4; DEFER queues to milestone audit).

Code references:
- `scripts/hsi-*` (Python, sentence-transformers + LSA)
- Pinecone 12,401 embeddings (Brain semantic search infrastructure)
- Existing /mos: commands: /mos:whitespace, /mos:find-bottlenecks, /mos:find-connections, /mos:find-analogies, /mos:score-innovation
- Phase 89 (reverse-salient-engine) formalizes the reverse-salient algorithm as a standalone engine consumed by Engine 1

### Engine 2 - BONO Orchestration

Classifies the problem on two axes: definition clarity (UDP / IDP / WDP) and system complexity (Simple / Complex / Wicked). Picks the hat sequence from four canonical patterns:

- Innovation (UDP-Simple/Complex): Blue -> White -> Red -> Green -> Yellow -> Black -> Blue
- Strategic (IDP/WDP-Complex/Wicked): Blue -> White -> Black -> Yellow -> Green -> Red -> Blue
- Crisis (any-Wicked): Blue -> Red -> White -> Black -> Yellow -> Green -> Blue
- Product (iterative): Blue -> Green -> Yellow -> Black -> Blue (loops)

Instantiates one team member per hat in the selected sequence.

### Team member identity

  Hat        de Bono cognitive stance (White / Red / Black / Yellow / Green / Blue).
  Name       main domain (from Engine 1).
  Surname    sub-domain specialization (from Engine 1).
  Archetype  optional fallback tag when decomposition is thin. One of seven SME lenses (Founder / Researcher / Operator / Investor / Mentor / Domain Expert / Student).

A high-value team member may be FILED as a reusable SyntheticExpert graph citizen (a queryable node promoted from the room/team/personas .md files) and RE-INVOKED as a hat in future runs. A SyntheticExpert is a truth-claim node: the navigator confirms which experts are worth keeping (Part 9 role 5). Per Part 8, the node carries generic-lens metadata only (hat/name/surname/archetype/beautiful_question/method/evidence_tier/scalars), never venture content. ROOM-LOCAL this phase; cross-room expert reuse is a deferred Part-8-gated amendment (E1 / D-164-S1).

Example (CAR-T biotech, IDP-Wicked, Strategic sequence):

  Blue    Dr. Orchestrator Session
  White   Dr. Oncology Immunotherapy
  Black   Dr. Regulatory IND
  Yellow  Dr. Finance BioPharma
  Green   Dr. Operations ClinicalTrials
  Red     Dr. Strategic Moat
  Blue    Dr. Orchestrator Synthesis

### Team affordances (all scoped by Part 8)

  BRAIN QUERY       Mid-thought methodology lookups. Stateless, no user data egress. Any hat can query the teaching graph during its turn.

  SUB-AGENT SPAWN   Delegate deep-dive work to specialized agents (research, opportunity-scanner, persona-analyst, investor, grading). Sub-agent inherits hat context, returns structured finding.

  OPPORTUNITY BANK  Always ambient. Three interactions:
                    - REACT    respond to a banked opportunity in current context.
                    - REFLECT  find patterns across multiple banked items.
                    - ADD      contribute a new opportunity with HSI score and domain tags.
                    All bank operations are local. Never egresses per Part 8.

  TOOL ACCESS       Three access classes. Every team member has all three, scoped by hat and Part 8:

                    - LOCAL GRAPH   Read and navigate the room's knowledge graph. SQL and Cypher queries, multi-hop traversals, cascade tracing, cross-relationship pattern matching. Every team member is expected to walk the graph before speaking.

                    - REMOTE BRAIN  Call, read, and use Brain intelligence. Methodology queries, framework chaining rules, teaching patterns calibrated from the curriculum. Stateless per Part 8. Queries carry only generic handles (framework names, phase identifiers, problem types), never user content.

                    - EXTERNAL WEB  Hat-scoped. White: Tavily + arxiv for data and research. Green: patents + arxiv + deep-research for innovation. Black: failure-case and risk searches. Yellow: success-case and benefit searches. Red: no external tool (intuition only). Blue: synthesis across the other hats' returns.

### Operating modes

  Serial    Hat sequence runs in order. Chain handoffs per BONO pattern.
  Parallel  All hats speak simultaneously on the same prompt.

### Output flow

Team output flows into the next Decision Gate's tri-context panels (LOCAL + BRAIN + SIGNAL). The navigator decides APPROVE / REJECT with reason / DEFER. Approved opportunities cascade to the Bank. Every decision becomes a typed graph edge in the user's local graph.

### The 9-role taxonomy

Used as archetype tags (for team members) AND as navigator regulatory types (for Part 8 protections):

  Founder / P3 Entrepreneur           trade secrets, strategic IP
  Researcher / P2                     pre-publication priority
  Researcher.IND / P2.IND             HIPAA, FDA 21 CFR Part 11, IRB
  Founder.grant / P.grant             attorney-client privilege
  Investor / P1 Portfolio Evaluator   LPA deal-flow confidentiality
  Operator                            (no added regulatory layer)
  Mentor                              (no added regulatory layer)
  Domain Expert                       (no added regulatory layer)
  Student / S                         FERPA

Citations: de Bono 1985 (Six Thinking Hats); Berger 2014 (A More Beautiful Question); Ulwick 2016 (Jobs-to-be-Done); Christensen 2016 (Competing Against Luck); Adizes 1988 (Corporate Lifecycles, PAEI); Heifetz and Linsky 2002 (Adaptive Leadership); Collins 2001 (First Who Then What); Tuckman 1965 (team stages).

### Part 2a - The Hero's Arc (Journey Stage)

The navigator also moves through stages. Campbell's twelve-stage monomyth is the reference arc:

Ordinary World -> Call to Adventure -> Refusal of the Call -> Meeting the Mentor -> Crossing the Threshold -> Tests, Allies, Enemies -> Approach to the Inmost Cave -> Ordeal -> Reward -> The Road Back -> Resurrection -> Return with the Elixir.

Persona is the product of two axes: `persona = role-blend x journey-stage`. A Founder at "Crossing the Threshold" needs different scaffolding than the same Founder at "Ordeal." The room, the frameworks Larry suggests, and the decision gates all shift with stage.

Citation: Campbell 1949 (Hero with a Thousand Faces); Vogler extension (The Writer's Journey) for practical 12-stage scaffolding.

---

## Part 3 - The Tri-Context Decision Gate

Every material choice in the system passes through a Decision Gate. The gate takes three contexts and returns one of APPROVE, REJECT (with reason), or DEFER.

The three contexts:

- LOCAL: room state, prior decisions, assumption registry, recent meetings.
- BRAIN: framework chaining rules, phase progressions, teaching patterns. Generic strategic intelligence, never user data.
- SIGNAL: outside world - grants, market data, competitive moves, scheduled sweeps. Public evidence.

### The 10 MindrianOS-native verbs (canonical vocabulary)

The Decision Gate does not ask the user "what do you want to do?" in free prose. It offers a choice drawn from a fixed vocabulary of ten verbs. Every fork in the system collapses to this set. The navigator selects one. The selection becomes a typed edge.

1. Run Methodology      - invoke a /mos:* command or methodology chain.
2. Reformulate          - /mos:beautiful-question or /mos:structure-argument. Re-express the problem before acting.
3. Spawn Sub-Agent      - dispatch research / opportunity-scanner / persona-analyst / investor / grading sub-agent.
4. Navigate Graph       - SQL/Cypher traversal on the local room graph. Walk the edges before deciding.
5. Devil's Advocate     - /mos:challenge-assumptions or Black Hat Red Team. Stress-test the current framing.
6. Scenario Plan        - /mos:scenario-plan or /mos:compare-ventures. Branch into futures.
7. Synthesize           - /mos:hat-briefing Blue Hat wrap or REFLECT on Opportunity Bank. Collapse branches back to insight.
8. Bank Opportunity     - ADD new opportunity to local Opportunity Bank with HSI score + domain tags.
9. Defer                - DEFER edge, queue the question for a milestone audit. The gate remembers.
10. Free-Text           - user types direction. Larry interprets and routes to one of the above, or asks for disambiguation.

The vocabulary is closed. New verbs require a canon amendment, not a command-level invention.

### 5 Shape F sub-shapes (block families)

The verbs cluster into five sub-shapes by decision moment. Each sub-shape is a selector-block family with a stable header, a stable keyboard, and a stable state-update hook. Commands map onto sub-shapes; commands never invent their own selector format.

- F.1 Next Move           - 3-5 options. The default after any discuss chunk. The most-used shape.
- F.2 Path Control        - 3-5 options. Plan / replan variants. Choosing structure, not content.
- F.3 Rabbit-Hole Depth   - exactly 5 options: Shallow / Medium / Deep / Extreme / Back. Depth selector before a branch.
- F.4 Insight Extraction  - exactly 5 options: Key insights / + contradictions / + actions / Create artifact draft / Back. Closing a discuss chunk.
- F.5 Branch Resolution   - 3-5 options: Continue / Merge / Compare / Park / Drop. Resolving parallel exploration.

All implemented via AskUserQuestion primitive (Phase 88.2 invariant).

### Option generation tier-awareness

The set of options surfaced at any given gate depends on tier availability. The canon recognizes two operating modes and a hardcoded fallback.

**Mode A (Full Loop).** Brain reachable. Options are generated by asking Brain for the top-k next verbs given the current phase, problem type, and hat sequence. Brain returns ranked candidates with confidence scores. RECOMMENDED marker appears only at confidence >= 0.7 (per Phase 88.2 invariant). Below 0.7, no option is marked. This is the pedagogically richest mode.

**Mode B (Local Only).** Brain unreachable, or user opted into offline mode. Options are generated from the local room's recent decision history and the Navigation Engine (Phase 91). The Navigation Engine is the Local-Only routing substitute: it reads STATE.md, the local graph, and the room's methodology cache to select plausible next verbs. No RECOMMENDED marker is rendered in Mode B. The 0.7 gate is a Brain-only concept.

**Tier 0 fallback.** When neither Brain nor local graph is sufficient (brand new room, empty STATE.md, first-session cold start), the gate renders a hardcoded minimal option set: Run Methodology / Reformulate / Free-Text. This keeps the navigator moving even when there is nothing to navigate against yet.

### The 3-layer loop

Every decision gate is part of a three-layer loop. The layers are named and ordered. Skipping a layer degrades the loop.

1. **Discuss** - the team member speaks. Output is prose, scoped by hat and beautiful-question. This is Layer 1.
2. **Selector** - one of the five F-sub-shapes renders. The navigator chooses a verb. This is Layer 2.
3. **State** - the selection writes to STATE.md (Decisions section) or TodoWrite (next-action row) and updates the local graph with a typed edge. This is Layer 3. Without Layer 3, progression gets buried in scrollback.

Mechanism: the gate is surfaced through the AskUserQuestion primitive. The user sees all three contexts at the decision boundary and picks one of the ten verbs via the appropriate F-sub-shape. The answer becomes an edge and updates state.

This gate is the universal UX primitive. Any feature that asks the user to choose something must route through the tri-context gate using one of the five F-sub-shapes. No bespoke dialogs, no framework-specific modals.

---

## Part 4 - Every Choice Is Graph Data

APPROVE, REJECT, and DEFER each produce a typed edge in the room's graph. The edge carries the three contexts that were on screen when the decision was made, the reason string, and a timestamp.

"Why not" is more valuable than "yes." A rejection with a captured reason teaches the next cross-relationship scan what not to surface again. Silent rejections (clicking away) are the system's failure mode - the gate must make reason-capture trivially low-friction.

### The typed-edge vocabulary (closed set)

Every typed edge in the room's graph is drawn from a closed, frozen allow-list (the constitutional counterpart of the closed verb vocabulary in Part 3). The vocabulary grows ADDITIVELY, never by per-phase invention, and a change that moves the frozen set is a canon amendment, not a command-level edit (Phase 108 frozen-taxonomy contract). The shipped vocabulary spans the decision-and-cascade edges (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES, DEFERRED, REJECTED, REJECTED_BECAUSE, FOLLOWS_FROM, SUPERSEDES, DERIVED_FROM, FILED_AS_DECISION, OPERATOR_TRANSITION), the structural and lineage edges (AFFILIATED_WITH, FEEDS_INTO, VALIDATES, STATES, SUPPORTS, DESCRIBES, NESTED_WITHIN), the dial-decision edges (PIVOTED, SELECTED_REACH), the Knowledge-rung relationship edges (REFINES, ROOT_CAUSES, INSTANTIATES), and the domain-taxonomy relationship edges (DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO). REFINES, ROOT_CAUSES, and INSTANTIATES were added by navigator-gated amendment (Appendix D entry 18): REFINES expresses a new claim that tightens or conditions a prior claim without invalidating it (the missing middle between INFORMS and CONTRADICTS); ROOT_CAUSES is the directional cause-to-effect edge; INSTANTIATES is the concrete-example-evidences-an-abstract-claim edge. DECOMPOSED_INTO, PART_OF, TAGGED_WITH, and RELATED_TO were added by navigator-gated amendment (Appendix D entry 21) to make domains, subdomains, and focus_areas first-class connected graph citizens: DECOMPOSED_INTO is the hierarchy edge (domain to subdomain, subdomain to focus_area); PART_OF is the structural-membership edge from any node to the domain or subdomain it belongs to; TAGGED_WITH is the lightweight categorization tag from any node to a domain or subdomain; RELATED_TO is the symmetric cross-domain relatedness edge between two taxonomy nodes. NESTED_WITHIN was added by navigator-gated amendment (Appendix D entry 23) as the room-lineage edge: a child room node NESTED_WITHIN its parent room node (source room:<child>, target room:<parent>), the graph-navigable representation of the nested-room fractal joint. It is a NEW dedicated lineage type, NOT a widening of PART_OF (which stays the domain-taxonomy structural edge whose targets are domain/subdomain/focus_area), so room-lineage walks never collide with the domain-taxonomy traversals.

All decision edges are graph-local. They live in the room, not in the Brain. See Part 8 for the locality constitution.

---

## Part 5 - Evidence Is Graded By Context

Claims, artifacts, and assumptions carry an evidence bar. Four tiers:

- Academic: peer-reviewed, replicated, citable to a primary source.
- Operational: internal experiment, measured outcome, repeatable procedure.
- Practitioner: pattern from one or more experienced operators, not yet measured.
- None: opinion, intuition, unsupported claim.

The threshold shifts by stage. Early exploration accepts Practitioner and None because the cost of a wrong direction is low and the cost of paralysis is high. Near a commit decision (funding, hiring, public launch), the gate demands Academic or Operational.

Evidence tier is a first-class property on every claim node. A room that is full of None-tier claims near a commit stage is a flag the proactive loop must surface.

---

## Part 6 - Product-as-Venture (Dog-Fooding Mandate)

The MindrianOS Plugin is itself a venture. It is built inside its own room. Every phase of plugin development is a room phase with artifacts, assumptions, and decisions. Phases backlink to prior phases via the canon.

Drift detection: if a plugin phase ships a feature that violates the canon (e.g. leaks LOCAL data to BRAIN, or bypasses the Decision Gate), the room's own cross-relationship scan must flag it as a CONTRADICTS edge against this document. The plugin must honor its own canon.

This is the dog-fooding mandate. We cannot credibly ship a product for the wicked navigator if we are not ourselves a wicked navigator inside our own room.

---

## Part 7 - Reuse Before Build

Before building a new command, skill, agent, or hook, the builder must search the 25 methodology commands first. Most features are existing features repointed.

The justification bar for net-new capability is explicit: the builder must answer, in the plan, "which of the 25 does this replace or extend, and why is repointing insufficient?" If the answer is weak, the plan does not ship. Surface area without integration is technical debt (see Moat Mandate).

Reuse compounds the moat. Net-new surface area dilutes it.

---

## Part 8 - The Graph Boundary (Security Constitution)

```
The Brain is a repository of strategic thinking tools. It is not, and must never become, a repository of user data.

The boundary is not a privacy preference. It is a constitutional property of the system:

LOCAL data -> BRAIN:  NO
BRAIN methodology -> LOCAL:  YES
LOCAL edges -> LOCAL graph:  YES
LOCAL edges -> BRAIN:  NO
SIGNAL (public data) -> LOCAL:  YES
SIGNAL -> BRAIN:  NO

The Brain holds generic methodology - framework chaining rules, phase progressions, teaching patterns calibrated from the curriculum. The Brain never holds a specific user's artifacts, rejections, meetings, or decisions.

A rejection edge is graph-local. A user's assumption registry is graph-local. A meeting transcript is graph-local. The cross-section scan runs locally. Decision history lives locally.

This means a canonical breach is any code path that writes user-specific bytes to the Brain MCP, or that queries the Brain with a payload containing user-specific strings (artifact bodies, meeting content, personal identifiers, proprietary numbers).

Allowed Brain queries carry only generic framework handles and phase identifiers. "What chains from SWOT to Porter Five Forces at phase 2?" is allowed. "Here is Lawrence's financial model - what does the Brain say?" is a breach.

Any feature that is ambiguous on this boundary goes through separate legal review - not a flag on this one.

### Personas this architecture protects

  P1 Portfolio Evaluator / Investor   LPA deal-flow confidentiality
  P2 Researcher                       pre-publication priority
  P2.IND Translational                HIPAA, FDA 21 CFR Part 11, IRB
  P3 Entrepreneur / Founder           trade secrets, strategic IP
  P.grant Grant-Seeker                attorney-client privilege
  S Student                           FERPA

For all of them, this architecture is not a feature. It is the precondition for using Mindrian at all.

### PR gate (vendor-neutral enforcement)

Every PR touching mcp-server-brain/, lib/core/brain-*, or any MCP tool that queries the Brain must pass the brain-boundary-scan check and receive explicit review from a Canon Custodian before merge.

The scan answers a single question: "Does this PR add any endpoint, parameter, log line, or side-channel that causes user data to reach the Brain?" If yes, the PR is blocked pending architectural and legal review. If the author is unsure, the default answer is yes, block.

The scan, the required check, and the review chain are enforced at the repository layer, not the policy layer. Tool selection (GitHub required checks, CODEOWNERS, stacked-PR enforcement, etc.) is an implementation detail documented separately.

### Violations are bugs

"Just this small exception" is the exact thought that breeds every privacy breach. The answer is no. The boundary is not negotiable. Cross-user intelligence, if ever built, is a separate product with a separate installer and a separate legal review. Not a flag on this one.
```

### The Brain's dual role (orchestration projection)

The Brain holds BOTH the teaching methodology AND a projection of Mindrian's own orchestration layer. The teaching methodology is the PWS thinking-tools graph this Part has always governed (framework chaining rules, phase progressions, teaching patterns calibrated from the curriculum). The orchestration layer is Mindrian's own generic machinery: the /mos commands, the 6 frozen reaches plus their sub_modes, the skills, the agents, the frameworks, and the connector spine that wires them. The Brain may hold a typed projection of that machinery alongside the methodology it already holds. This is an additive extension of what the Brain is constitutionally allowed to hold; it does not displace the teaching role and it does not weaken any boundary stated above.

Every node in that orchestration projection carries a `methodology_tier` property of exactly one of two values: `pws` or `mindrian-operation`. The `pws` tier marks the teaching IP frameworks (Cynefin, Meadows, JTBD, Reverse Salient, Six Thinking Hats, and the rest of the methodology graph). The `mindrian-operation` tier marks the machinery (the /mos commands, the 6 reaches plus sub_modes, the skills, the agents, the connector spine). `methodology_tier` is the boundary-keeper: it is the legibility marker that makes the projected machinery Part-8-legal, because it certifies that every projected node is generic machinery metadata (a command slug, a reach_id, a framework name, a tier, a typed edge) and NEVER a user's data. A node without a `methodology_tier` is not a legal projection node. The tier is what keeps the projection legible to this Part: a `mindrian-operation` node is generic plumbing metadata; a `pws` node is generic teaching metadata; neither carries a specific navigator's artifacts, rooms, meetings, or decisions.

The projection is a Brain-DERIVED LOCAL cache (see Part 9). The projection artifact is the local consumable: a committed local file that the navigation engine will read, mirroring the BRAIN.md derivation-resilience pattern. The Brain is the external cortex that the projection is shaped after, not a runtime dependency of it. No live Brain read and no live Brain write rides this projection. Live Brain write of the projection and continuous remote sync are deferred (continuous sync is Phase 137; the live write is a fast-follow), and live nav-engine consumption of the cache is deferred. This Phase-157 amendment sanctions the SHAPE the Brain may hold and the LOCAL cache the plugin may derive; it does not open any new wire to the Brain.

The projection carries ONLY generic machinery metadata: command slugs, reach_ids, sub_modes, framework names, `methodology_tier`, ranking inputs (hierarchy_rank, posture, sensor_triggers), and the typed edges between them (OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE). It never carries user content, room data, meeting transcripts, assumption registries, decisions, or personal identifiers. A build-time boundary scan over the projection artifact and its generator proves this by construction: a projection node or field that carries user-specific bytes is a Part 8 breach, caught before the artifact lands, exactly as the existing breach rules above demand. The LOCAL data -> BRAIN: NO invariant stated at the top of this Part is UNCHANGED and remains binding: the projection is a LOCAL artifact derived from the plugin's own generic machinery, so this amendment does NOT sanction any user-data egress, and the existing boundary scan, PR gate, and Canon Custodian review continue to apply in full.

Part 9 (Memory Locality and Interpretation) is the enforcement architecture for this boundary - it specifies where memory lives (SQL) and how the typed packet contract makes the LOCAL-to-BRAIN boundary structurally hard, not just audited.

---

## Part 9 - Memory Locality and Interpretation

The wicked navigator's working memory has structure: where memory lives, who is allowed to interpret it, and how proposed knowledge is promoted to trusted knowledge. The system honors a five-role separation:

> **Files preserve meaning.**
> **SQL remembers and navigates.**
> **Brain reasons over structured packets.**
> **Larry explains and acts.**
> **The human confirms truth.**

### The five roles

1. **Files (Markdown + frontmatter) preserve meaning.** ROOM.md / STATE.md / MINTO.md / FEYNMAN.md / BRAIN.md / USER.md / artifact files are the human-readable substrate. They are the surface every agent and every human can read directly. They are the source of meaning, but they are not the navigable memory.

2. **SQL (`room.db`) remembers and navigates.** The local SQLite graph is the authoritative *machine-readable* memory layer. It holds typed nodes, typed edges, provenance, validity status, and a memory event log. Every claim, assumption, evidence link, decision, and rejection lives here as a structured fact, not a free-text artifact. Larry asks SQL "what matters around this focus node?" and SQL returns a ranked, explained neighborhood. Without SQL, Larry would scan folders; with SQL, Larry navigates a graph.

3. **Brain reasons over structured packets, never raw memory.** Brain (the remote methodology repository) receives typed Brain Context Packets generated by SQL - never raw artifact text, never filenames, never user-identifying content (per Part 8 boundary). Brain returns advisory suggestions: recommended next move, framework chain, contradictions to investigate. Brain is the *external cortex* - it interprets patterns, but never owns the truth.

4. **Larry may propose and explain, but not silently confirm.** Larry surfaces Brain's advice, walks the user through SQL's neighborhood findings, and explains every recommendation as a graph path ("this contradicts assumption X which depends on evidence Y from meeting Z"). Larry can propose new claims, assumptions, decisions, and edges - but every proposal lands in SQL as `review_status: proposed`, never `confirmed`.

5. **The human confirms truth.** Promotion of a TRUTH-CLAIM node from `proposed` to `confirmed` requires a human decision - APPROVE, REJECT (with reason captured), or DEFER (per Part 3 Decision Gate). Rejection reasons become graph data (per Part 4). Confirmation is the only path to trusted memory. This is not a feature; it is the constitutional source of legitimacy in the system. The audit-node carve-out subsection below governs system-bookkeeping nodes (memory_event / audit / focus), which are exempt from this rule.

### Truth states (canonical)

Every node in `room.db` carries a `review_status` from a closed set: `proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`. Brain may *propose* a status; only user confirmation or system rules can *promote* a status. Status transitions are events in the memory log, never silent overwrites.

### Audit-node carve-out (truth-claim nodes vs system-bookkeeping nodes)

The human-confirm rule (role 5) applies to TRUTH-CLAIM nodes, not to every node in `room.db`. The two sets are distinct:

- **Truth-claim nodes** are the set {claim, CausalClaim, assumption, decision, opportunity} - the nodes that assert something about the venture's world. They are the nodes the navigator's legitimacy rests on. Promotion of a TRUTH-CLAIM node from proposed to confirmed (or to validated) REQUIRES a human `byUser` per role 5. No agent may shortcut a truth-claim into `confirmed`.

- **System-bookkeeping nodes** are memory_event (every `event_type`), audit, focus, and other internal navigation nodes. They record what the system DID, not what is TRUE about the venture. They MAY carry `created_by=system` and are EXEMPT from the human-confirm rule. A system-bookkeeping node carrying `review_status=confirmed` is an internal write-completed marker, not a claim of human-attributed truth.

The exact rule: **Only truth-claim nodes require a human `byUser` to reach `confirmed`; system-bookkeeping nodes are confirmed by the system rule that wrote them.** The carve-out is scoped to the closed system-bookkeeping set (memory_event / audit / focus); a too-broad reading that exempted a truth-claim type would breach role 5. This carve-out is what makes the system's own audit trail (for example `lib/core/navigation/focus.cjs` writing a `focus_changed` memory_event with `created_by=system review_status=confirmed`) canon-legal rather than a constitutional violation: an audit node is not a truth claim, so it never needed a human to be legitimate.

### What this means architecturally

- SQL is the local mind. Brain is the external cortex. Larry is the navigator. The human is the judge.
- No agent (Brain, Larry, sub-agents, hooks) may write a `confirmed`-status TRUTH-CLAIM node directly; every confirmed truth-claim node has a human attribution in its provenance. System-bookkeeping nodes (memory_event / audit / focus) are exempt per the audit-node carve-out.
- Brain calls are typed packets, not free-form prompts. The wire schema makes Part 8 leakage structurally hard, not just procedurally audited.
- The folder structure (Part 1, ICM Layer 0) gives meaning. The graph (Part 4) gives navigability. Part 9 is what binds them: the substrate that lets the navigator move through the wicked problem without losing track of what is known versus what is proposed.

### Implementing phase

Phase 109 (SQL Context-Memory Navigation Spine) is the implementing phase: `lib/core/navigation.cjs` ships the 13-function navigation chokepoint, `memory_event` becomes a first-class node type, and the instrumented acceptance test (`tests/test-navigation-acceptance.cjs`) asserts zero non-SQLite filesystem reads during the full navigation flow - proving by instrumentation, not by promise, that SQL is the local mind. Phase 108 ships the frozen schema/taxonomy contract this depends on. Phase 110 (Brain Context Packet Contract) hardens the typed-packet wire so Part 8's boundary is structurally enforced, not merely procedurally audited.

Phase 124 (FEYNMAN.md Temporal Awareness) is the FIRST Larry-explains surface to land on top of the Part 9 substrate: it appends a sentinel-bounded `## Timeline (auto)` section to each `FEYNMAN.md`, regenerated from `memory_event` via `lib/core/navigation.cjs`, byte-preserving the human-authored body across regeneration. The renderer (`lib/core/feynman/timeline-renderer.cjs`) is a pure function reading only via the navigation chokepoint; the runner (`lib/core/feynman/timeline-runner.cjs`) is the atomic-write orchestrator. Per Canon Part 6 (Product-as-Venture) the canon names the phase that implements the canon.

---

## Part 10 - Conversation as Product

> Larry IS the product. Conversation IS the surface. Rooms are receipts. Commands are internals.

The navigator does not "use a tool." The navigator talks to Larry. Everything else - the room, the graph, the /mos commands, the dial - is machinery that serves that conversation. The product surface is the dialogue, not the command palette.

### The five sub-claims

1. **Larry IS the product.** The default activation surface is Larry, not a command menu. A navigator who installs MindrianOS and says nothing still meets Larry. Implementing phase: Phase 114 (larry-default-activation).

2. **Conversation IS the surface.** The first touch is a persona-aware conversational turn, not a form. Larry reads role-blend x journey-stage (Part 2a) and meets the navigator where they are, whether they paste a CV or type a stuck-decision sentence. Implementing phase: Phase 115 (owned-emotion-dual-path-first-touch).

3. **Rooms are receipts.** The room is the legible by-product of the conversation, not a thing the navigator fills in. Persistent conversation carries across sessions (the unresolved-tension hook), the room generates as a receipt of work done (the 30-second MVA reward), and this is a formal invariant, not a convenience. Implementing phases: Phase 116 (unresolved-tension-hook), Phase 118 (30-second-mva-reward), Phase 119 (room-as-receipt-invariant).

4. **Commands are internals.** The /mos commands are the plumbing Larry reaches for, not the navigator's primary interface. Larry routes to the right command via the JTBD inference engine; the navigator never needs to memorize a command surface. Command-hiding in full is a v1.14.0 obligation; until then commands stay user-facing as a fallback while Larry routes heuristically. Implementing phase: Phase 100 (jtbd-inference-engine).

5. **The triple-filter intelligence runs automatically.** The Act 1 intelligence math (decomposition + whitespace + reverse salient + cross-domain match, Part 2 Engine 1) fires on first material without the navigator asking, and the variable-reward breakthrough scan surfaces the non-obvious. Implementing phases: Phase 117 (auto-explore-domains-on-first-material), Phase 120 (breakthrough-scan-category-g).

### Ratification provenance (navigator-authority override)

Part 10 was authored as a proposal (synthesized 2026-05-05) with a ratification gate that required BOTH a Hooked re-score >= 55/70 (Eyal 2014 composite) AND an empathy audit in which 4 of 5 testers report a "thinking partner" experience. The implementing code (Phases 114-120, plus the Phase 100 JTBD engine) ALL SHIPPED across the v1.13.0 milestone, but the gate was never run: the measured state (2026-06-05) was Hooked Variable Reward 0.0/10 (the dogfood box carried no reward telemetry to score) and 0/5 empathy observations recorded, because the tester round-2 validation week (Phase 150.7) never executed. The cohort experienced the pre-cure builds, never the cure.

On 2026-06-17 the navigator ratified Part 10 into this canon **on navigator authority**, explicitly overriding the empirical score gate. This is a navigator-LOCKED constitutional decision (Appendix D entry 20) applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19. The override is recorded truthfully and without euphemism: the empirical thresholds were NOT met and were NOT measured against real users; ratification rests on the navigator's judgment that the thesis is sound and the implementing code is shipped and stable, not on the gate's evidence bar. Per Part 5 (Evidence Is Graded By Context), the empirical validation (a real tester re-dose producing the two numbers) is DEFERRED to a v1.14.0 validation week as a post-ratification confirmation - it is no longer a precondition for Part 10 being binding canon, but its absence is a known, named debt. The gate record at `.planning/milestones/v1.13.0-PART-10-RATIFICATION-GATE.md` carries the measured-state evidence; Phase 150.7 closes as ratified-by-override.

---

## Part 11 - The Invocation Constitution (the Command Invocation Ruling System)

Ratified 2026-06-22 (navigator-LOCKED, Appendix D entry 25), in a disciplined-minimal form after a
three-reviewer adversarial pass. CLAUDE.md states the moat plainly: prompts can be copied; the graph
that knows WHEN to use WHICH prompt, in WHAT sequence is the moat. WHEN / WHICH / SEQUENCE is
INVOCATION. Until now invocation had no constitutional home - its doctrine was scattered across Part 2
(reaches), Part 3 (the gate + Shape F), Part 8 (the projection + methodology_tier), and Appendix D
entries 15/19 - and it regressed repeatedly (Phases 143.x, 144.1) because the governing contract lived
nowhere but an orphaned, WARN-only gate. The Graph Boundary (Part 8) and Memory Locality (Part 9) are
full Parts; the thing that decides what gets reached for is the same altitude.

### North Star

> Every capability MindrianOS can invoke is GOVERNED: it knows when it should be reached for, it is
> reachable by exactly one path, it explains itself, it chains usefully, it stays local, it is
> represented in the orchestration graph, and it cannot enter, change, or leave the system without the
> constitution knowing. A capability the engine cannot reach - or can reach two different ways - is a
> hole in the moat.

### The doctrine

- **The two wires.** A capability has a KNOWLEDGE wire (a `:Framework` node, Part 8) and a TRIGGER wire
  (a connector mapping a navigator CONTEXT to the capability). The system reaches only for capabilities
  that have the TRIGGER wire. Knowledge without trigger is a dark capability.
- **The dual graph (control plane / data plane).** The remote orchestration projection (Part 8,
  Appendix D entry 19) is the CONTROL plane - generic machinery topology, every node tagged
  methodology_tier (pws | mindrian-operation). The local room.db is the DATA plane. The invariant is
  Part 8 restated: control/policy flows down; user data NEVER flows up. The local capability view is a
  DERIVED, non-authoritative read-model of the control plane, version-stamped and rebuilt-not-mutated,
  consumed LOCAL-ONLY at decide/rank time (no live Brain call on the hot path - opens no new wire).
- **One governed path.** Every invocation resolves through one spine (dispatchSensors -> decide() ->
  resolver). No capability runs a second, ungoverned selection brain.
- **Born-wired lifecycle.** A capability cannot ENTER, CHANGE, or LEAVE without the constitution: a new
  or modified surface is wired or explicitly excluded, or it is rejected. Coverage is a lifecycle
  invariant enforced at every merge, not a number checked once.
- **Fractal coverage.** Coverage and chain health roll up across the nested-room hierarchy
  (NESTED_WITHIN, Part 4) via one scale-invariant operator, depth-bounded, aggregate-SCALAR-only across
  room boundaries (Simon near-decomposability), honoring Appendix D entry 23's rule that cross-room
  aggregation of NESTED_WITHIN edges is forbidden.

### The Command Invocation Ruling System (CIRS) - the closed ruling set

A closed constitution, the invocation-layer counterpart of Part 3's closed verb vocabulary and Part 4's
closed edge vocabulary. Every invocable surface MUST satisfy R1-R14; the gate enforces them; a change to
the closed set is a canon amendment (Part 6 mechanism), not a per-phase edit. Two rules (R6, R11) are
DECLARED-but-DEFERRED-ENFORCEMENT: the direction is law, but hard-FAIL enforcement is gated on substrate
existing (curated chain confidences; the scale-invariant rollup operator) - until then they hold as
warn/aspirational, so no unproven number is frozen as hard law.

- **R1** Two states, no third - WIRED (`connector:` block) or EXCLUDED (`connector:{excluded,reason}`).
  EXCLUDED-with-reason is a first-class conformant terminal state, NOT "dark". Unit of coverage: a
  surface = one command file, one skill SKILL.md, one agent file; sub-behaviors are not independently
  counted (finer granularity is a named future amendment - SEED-024).
- **R2** Born-wired - a new/modified surface fails the gate CLOSED unless it satisfies R1.
- **R3** Context-triggered - trigger keys on navigator problem-state (LOCAL via the navigation.cjs
  chokepoint, Part 9; enum/scalar only, Part 8); keyword is a fallback tier, not the basis. Triggers
  wire to the existing 6 reaches; no rule mints a 7th reach (precedent: SENS-09 reuses brain_consult).
- **R4** One governed path - invocation resolves through dispatchSensors -> decide() -> resolver; no
  second selection brain. Does not touch the Part 3 render contract (MAX_K=3, DIAL_REACH_K=6, the
  0.70/0.15 gate, the F.1 keyboard contract, the single-marker body glyph - all frozen, unchanged).
- **R5** Remote counterpart - every surface has a node in the Part-8 orchestration PROJECTION (control
  plane, methodology_tier-tagged generic machinery metadata, Appendix D entry 19), NOT a room.db Part-9
  node; non-framework commands get a `mindrian-operation` counterpart. A new room.db node type would be a
  separate Phase-108/Part-9 amendment (precedent: SyntheticExpert, entry 24).
- **R6** Earned chains (DEFERRED-ENFORCEMENT) - FEEDS_INTO carries curated confidence (v1), surfaced via
  the LOCAL projection; absent/uniform confidence is the defect to remove. Confidence lives on the
  PROJECTION's FEEDS_INTO (generic machinery, LOCAL cache), NOT the Part-4/Part-9 navigation
  ALLOWED_EDGE_TYPES FEEDS_INTO - no property is added to the frozen navigation edge, and no edge type is
  minted. ORDERING of surfaced chain candidates is Part 3's MAX_K ranker, not CIRS. Learned weights are a
  gated future (SEED-009; no Brain write rides them).
- **R7** Local-only at decide/rank - the projection is a derived read-model (control plane) with
  source-version + per-room checkpoint + freshness markers; restates LOCAL -> BRAIN: NO; opens no wire.
- **R8** Promotion path - dark -> `mindrian-operation` counterpart -> `pws` frontier framework
  (metadata reclassification within the sanctioned projection), navigator-gated (Part 3 + Part 9 role 5).
- **R9** Enforced, not aspirational - the gate is wired into pre-commit + release + doctor (the Phase
  150.9 doctor --drift engine) + the ingest pipeline; warn->report, then hard-FAIL once the baseline is
  wired/excluded. Three non-overlapping timeframes: born-gate (merge), doctor --drift (periodic),
  forward-declaration (planning).
- **R10** Lockstep on change - any add/modify/update/remove re-runs the gate and keeps the projection in
  lockstep (drift-detection over the machinery).
- **R11** Fractal coverage (DEFERRED-ENFORCEMENT) - coverage + chain monitoring rolls up across nested
  rooms via one scale-invariant operator over NESTED_WITHIN, depth-bounded, aggregate-SCALAR-only;
  reads child coverage scalars, never child lineage edges across room.db boundaries (entry 23).
- **R12** Forward-declaration & explainability - every future phase that adds/modifies/removes an
  invocable surface, OR consumes the spine, declares and explains how it USES and/or is USED BY CIRS via
  a `cirs_relationship:` block. This is a SPECIALIZATION of the existing canon_parts forward-compatibility
  rule (declaring any cirs_relationship field auto-implies 11 in canon_parts; the gate derives one from
  the other so they cannot disagree). Recorded via a CIRS column in CANON-PHASE-MAP, keyed on phase SLUG
  (absorbing the map's own number-collision warning). A phase touching a surface without a conformant
  declaration is gate-FAILED.
- **R13** Retirement - a removed surface transitions to a RETIRED ledger state with mandatory
  inbound-chain re-point-or-drop; the gate FAILS on a live FEEDS_INTO whose target is retired (no
  dangling counterpart, no orphaned chain).
- **R14** Trigger-overlap - two wired surfaces whose triggers fire on the same problem-state are a
  coverage-quality defect; the gate detects overlap (WARN minimum) and arbitration defers to the Part 3
  MAX_K ranker. (`autonomous_safe` is a required field of the R1 WIRED connector block, gate-governed -
  it decides auto-run-vs-halt for the post-gate runChain handoff, Part 3.)

### Relationship to the existing Parts (what this PULLS TOGETHER, what it does NOT change)

- **Part 2** - the reaches remain the team's affordances; the 6 reaches + 3 postures are frozen, unchanged.
- **Part 3** - reaches still render through Shape F + the 3-layer loop; MAX_K=3, DIAL_REACH_K=6, the
  0.70/0.15 gate, the single-marker body glyph, the F.1 keyboard contract are frozen. Part 11 governs the
  SUPPLY (which capabilities exist, are wired, trigger, chain); Part 3 governs the DEMAND-side decision
  surface (how the eligible set is ranked, rendered, chosen, recorded). A /mos:act standing suggestion
  below 0.70 carries NO RECOMMENDED marker and NO second body glyph.
- **Part 4** - chains/counterparts reuse existing edge vocabularies; Part 11 mints NO new edge type.
- **Part 7** - Part 11 is the structural expression of Reuse-Before-Build at the invocation layer:
  capabilities are repointed and wired, not rebuilt; the moat is made self-extending.
- **Part 8** - Part 11 is BOUNDED BY Part 8 and adds no new wire; the control plane is the entry-19
  projection it already sanctioned; methodology_tier remains the boundary-keeper; LOCAL->BRAIN: NO unchanged.
- **Part 9** - invocation reads/writes the local graph via the navigation.cjs chokepoint; calibration
  intent is journaled as memory_event; the proposed->confirmed gate is honored; Part 11 mints NO new node type.
- **Part 10** - invocation is the machinery that serves the conversation; Part 11 is HOW "commands are
  internals" is made true and safe (/mos:act becomes governed, self-explaining, intent-calibrated).

### Implementing phase

Phase 172 (contextual-invocation-coverage) is the implementing phase - it ships CIRS R1-R14 as code.
Phase 166 (gated-chain-executor / runChain - shipped on disk) is the runtime R4/R6 lean on. Per Part 6
(Product-as-Venture) the canon names the phase that implements the canon. 170 + 171 are the first
conformance targets, gated before release. The Part binds on ratification; 172 implements it over time
(Part-binding is decoupled from 172 being fully green).

### Ratification provenance

Proposed 2026-06-22 in the /gsd-discuss-phase 172 session after a 14-stream research fan-out, reviewed by
three independent adversarial reviewers (A canon-compliance: COMPLIANT-WITH-CONSTRAINTS; B adversarial:
OVERSPECIFIED/fold-in; C integration: RECONCILES-WITH-GAPS/keep-as-Part). Navigator ratified the
disciplined-minimal synthesis (keep the Part; R6/R11 deferred-enforcement; constraints C1-C6 + gap fixes
M1/M3/M6 folded in). Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism at a
navigator-LOCKED checkpoint, mirroring Parts 9 and 10. Evidence:
docs/CANON-PART-11-PROPOSAL-invocation-constitution.md + docs/CANON-PART-11-REVIEW-SYNTHESIS.md.

---

## Appendix A - Relationship to MWP

The canon adds the navigation axis (role-blend x journey-stage) and the security constitution (Part 8) on top of the MWP 7-layer integration surface. MWP-SPECIFICATION.md carries a forward-reference to this canon; canon-conformant features also satisfy MWP conformance clause 7.1.

See Part 9 (Memory Locality and Interpretation) for the constitution that binds the folder substrate (Part 1, ICM Layer 0) to the navigable graph (Part 4).

---

## Appendix B - Relationship to ICM Layers 0-4

| ICM Layer | Layer Role | Canon Part |
|-----------|------------|------------|
| Layer 0 - Identity | Who the navigator is right now | Part 1 - The Wicked Navigator |
| Layer 1 - Routing | Which agent/skill responds | Parts 2 and 2a - Role blend x journey stage |
| Layer 2 - Contracts | Pipeline stage cascade rules | Part 3 - Tri-Context Decision Gate |
| Layer 3 - Reference | Stable building blocks (frameworks, methodology) | Part 7 - Reuse Before Build |
| Layer 4 - Artifacts | Claims with validity + cross-refs | Part 4 - Every Choice Is Graph Data |

---

## Appendix C - Glossary

- Blend - the weighted tuple of role weights that describes the user's current working identity (e.g. Founder 0.6 + Researcher 0.4).
- Journey-stage - the user's current position in the 12-stage hero's arc (Campbell 1949).
- Decision Gate - the tri-context (LOCAL + BRAIN + SIGNAL) choice surface that converts a user's judgment into a typed graph edge.
- Tri-context - the three inputs surfaced at every Decision Gate: LOCAL room state, BRAIN methodology, SIGNAL public data.
- Local thinking - any bytes that describe this specific user's artifacts, meetings, assumptions, or decisions. Graph-local by constitution.
- Brain - the remote methodology repository (mindrian-brain.onrender.com). Strategic thinking tools only. Never a store for user data.
- Canonical breach - any code path that writes LOCAL bytes to BRAIN or embeds LOCAL strings in a BRAIN query payload. See Part 8.

---

## Appendix D - Canonization Provenance

This canon was forged in conversation between Jonathan Sagir (founder) and Claude-as-Larry on 2026-04-20 (branch `ui/destijl-rebuild`). It evolved through a sequence of user corrections that sharpened the framing at each step:

1. **Drift-detection need surfaced.** Phases 80-91 showed drift between stated intent and delivered artifacts. Brain query returned 10 codifiable methodologies; top 3 recommended were JTBD-Trace, MECE-Coverage, Cynefin-Domain-Drift.

2. **User correction 1: "Personas are network, not tree."** Corrected the model from hierarchical taxonomy to network of roles. Established persona-blend as weighted tuple inferred from context.

3. **User correction 2: "User is the wicked NAVIGATOR, not the wicked problem. Mindrian = compass + map."** Corrected the subject of wickedness. Problem space is wicked (Rittel and Webber). Venture is nested (Simon). User navigates both.

4. **User correction 3: Campbell's monomyth as categorization axis.** Added journey-stage as second dimension. Persona = role-blend x journey-stage.

5. **User correction 4: "Brain = repo of strategic thinking tools. Data is local. Local does the thinking."** Architectural invariant. Brain is methodology only, never data. Security became constitutional, not policy.

6. **User correction 5: Personas reframed as AI TEAM around navigator, not navigator's identity.** Each team member wears a de Bono hat plus SME lens, built from room context. Team complements the navigator regardless of the user's own role.

7. **User correction 6: JTBD-oriented chaining with beautiful questions per role.** Brain validated Six Thinking Hats, Beautiful Question Framework (Berger), Adaptive Leadership, First Who Then What, Tuckman, and Red Teaming as graph-backed anchors.

8. **User correction 7: The team-assembly pipeline is two engines plus four affordances.** Engine 1 decomposes topic (five lenses). Engine 2 classifies problem (UDP/IDP/WDP x Simple/Complex/Wicked) and runs BONO hat sequences. Team members have BRAIN QUERY, SUB-AGENT SPAWN, OPPORTUNITY BANK (REACT/REFLECT/ADD), and TOOL ACCESS affordances.

9. **User correction 8: Part 8 must carry persona protection table + PR gate + "violations are bugs" paragraph.** Amendment commit added these after initial canon drift was detected and corrected, using the canon's own mechanism on itself.

10. **User correction 9: "Larry with or without Brain is the pedagogical guide."** Larry's pedagogy is intrinsic, not dependent on Brain availability. Teaching persists in Local Only mode.

11. **User correction 10: "Engine 1 is Act 1, code-driven via embeddings + HSI."** Engine 1 is not just 5-lens decomposition. It is the full Act 1 intelligence surface: decomposition + whitespace map + reverse salient + cross-domain match, all algorithmic, all feeding Opportunity Bank ADDs with HSI scores. Powered by existing Python scripts (sentence-transformers + LSA) and Pinecone embeddings (12,401 methodology nodes). Phase 89 formalizes the reverse-salient algorithm.

12. **Codex external research input - Part 9 proposed (Phase 108) and ratified (Phase 109).** External research input from Codex (via Jonathan Sagir, 2026-05-03 sessions) framed `room.db` as Mindrian's "local mind" - the navigator's working memory made queryable as graph paths, never as folder scans. Phase 108 ships the schema reconciliation contract (RECONCILIATION.md, PROVENANCE.md, TRUTH-STATES.md, aliases.yml, PART-9-PROPOSAL.md, scripts/check-schema-aliases.cjs); Phase 109 ships the SQL navigation spine (lib/core/navigation.cjs single chokepoint with 13 functions; first-class memory_event nodes; instrumented acceptance test asserting zero non-SQLite reads during the navigation flow); Phase 109 release commit ratifies Part 9 by merging the proposal text into this canon. Brain wire schema enforcement (Phase 110) hardens Part 8 from procedural audit to structural prevention. The trio (108 + 109 + 110) is the Part 9 implementing cluster.

13. **Corpus figures corrected (2026-05-20).** A live read of the production Brain substrates -- Neo4j via the `my-neo4j` MCP, Pinecone via the `pinecone` MCP -- corrected stale counts carried since the canon's v1.0 draft. Neo4j: 15,298 nodes / 19,713 relationships (was "21K / 65K"). Pinecone `pws-brain`: 12,401 vectors at 1024-dim multilingual-e5-large (was "1,427"). Triggered during the Phase 127.1 re-scope; evidence in the Phase 127.1 deferred-items log (DI-127.1-01 + DI-127.1-02). Factual correction only -- no change to canon doctrine; version stays 1.4.

14. **Audit-node carve-out added (Phase 129.5, 2026-05-31).** Phase 129.5 (Truth-Machine Activation) amended Part 9 with the audit-node carve-out so the human-confirms-truth lever (role 5) could be wired without mislabeling the system's own audit trail as a constitutional violation. `lib/core/navigation/focus.cjs` writes a `focus_changed` memory_event with `created_by=system review_status=confirmed`; before the carve-out this read as an agent writing a confirmed node directly. The carve-out scopes role 5 to truth-claim nodes {claim, CausalClaim, assumption, decision, opportunity} and exempts system-bookkeeping nodes {memory_event, audit, focus}, so audit trails stay legitimate and are never permanently un-promotable. The carve-out was a LOCKED human decision (D-03) made via AskUserQuestion on 2026-05-30; this is the canon-amendment-on-itself mechanism (Part 6 dog-fooding) applied once more. Canon version bumped to 1.5.

15. **Reach-count amendment: the frozen bank moved 5 to 6 (Phase 148, 2026-06-09).** Phase 148 (LarryReach Selector Re-wire) mints `hats` as a REAL 6th machine reach_id, resolving the researcher's open question A1 in favor of a true machine token (NOT a sub_mode render label under brain_consult). This moves the frozen reach bank from 5 to 6. The reach count is a frozen constitutional property: Part 3 (Option generation tier-awareness) renders the Shape F selector against this bank, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so a phase that changes a frozen constitutional count must amend the canon using the canon's own mechanism. Plan 01 moved every lockstep surface together in one atomic wave so CI never went RED mid-phase: `sensor-types.REACH_IDS` (now length 6, `hats` appended), `dial-reach-orchestrator` `DIAL_REACH_K` 5 to 6, `dial-label-composer` template families (a render-only `hats` family with no `{framework}` egress slot, so it stays in the non-egress family class per Part 8), the `think-hats` connector repoint (`brain_consult` to `hats`), both SKILL doctrine fences (no-6th to no-7th), the carried drift suite (rewritten to assert 6 and green), and the connector `--check` tripwire (frozen 6). `MAX_K=3` and the frozen 0.70/0.15 recommend gate stayed UNCHANGED; only `DIAL_REACH_K` moved. This was a navigator-confirmed LOCKED decision (D-09, 2026-06-08) applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entry 14. Plan 02 (this docs-only plan) records the amendment in the canon and the phase map. Canon version bumped to 1.6.

16. **Corpus figures corrected (2026-06-11).** A fresh live read of the production Brain substrates -- Neo4j via the `my-neo4j` MCP, Pinecone via the `pinecone` MCP -- normalized the four Brain-number surfaces (docs/THE-BRAIN.md, docs/brain-setup.md, CLAUDE.md moat block, and this entry) onto ONE set, superseding the three conflicting sets that had accumulated (the entry-13 ratified 15,298 / 19,713 / 12,401 set among them). Neo4j: 27,804 nodes / 19,987 relationships. The node total now includes 12,401 MethodologyChunk substrate nodes -- the Phase 127.1 GraphRAG collapse moved the chunk corpus into Neo4j -- so the teaching-graph core is ~15.4K nodes; both figures are stated wherever the total appears so the substrate is never hidden. Top labels: MethodologyChunk 12,401; Concept 9,131; __Entity__ 4,357; Product 1,289; Chunk 1,167; Event 1,013; ProcessStep 650; Person 624; Framework 748. Pinecone `pws-brain`: 12,413 vectors at 1024-dim across five namespaces (core 8,555; materials 1,775; reference 1,690; tools 242; graphrag 144; books 7). Factual correction only -- no change to canon doctrine; version stays 1.6. (Mirrors the entry-13 corpus-figures-corrected procedure.)

18. **Edge-vocabulary amendment: REFINES + ROOT_CAUSES + INSTANTIATES added to the frozen allow-list (Phase 150.8, 2026-06-12).** Phase 150.8 (Meeting Micro-Knowledge DIKW Filing) amended Part 4's typed-edge vocabulary, adding three Knowledge-rung relationship edge types to the frozen `ALLOWED_EDGE_TYPES` closed set in `lib/core/navigation/edges.cjs`: REFINES (a new claim TIGHTENS or CONDITIONS a prior claim without invalidating it -- the missing middle between INFORMS-too-weak and CONTRADICTS-wrong), ROOT_CAUSES (the directional cause-to-effect edge, source=cause target=effect), and INSTANTIATES (a concrete example claim that EVIDENCES an abstract claim). The typed-edge vocabulary is a frozen constitutional property: Part 4 (Every Choice Is Graph Data) renders against this closed set, the Phase 108 frozen-taxonomy contract froze it, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so a phase that moves a frozen constitutional set must amend the canon using the canon's own mechanism. Code-wise the change is purely additive and reversible (every prior edge type landed additively without amendment); the load-bearing requirement was the constitutional discipline. The three deferred types (GENERALIZES / CONTRADICTS_CONDITIONALLY / SUPERSEDES_v2) stay OUT (SEED-023, v1.14.0), so writeEdge rejects them. The amendment landed as ONE atomic lockstep wave so CI never went RED mid-phase: the `edges.cjs` additive block (mirroring the Phase 150-01 STATES / SUPPORTS / DESCRIBES idiom verbatim), the canonical FLOOR test (`tests/test-edges-refines-rootcauses-instantiates-floor.cjs` -- membership + full FLOOR preserved + frozen Set + the TV-01 valid_from/valid_until round-trip + a made-up-type negative, never asserting `.size`), the C3 claim-harness fence extension (mints a REFINES edge on the real fixture), and this canon record moved together. `valid_from` / `valid_until` (DIKW-03 edge half / TV-01) ride the existing writeEdge `properties` JSON param with ZERO signature change; the claim/segment BODY never lands on the edge (Part 8 enum/scalar-only). This was a navigator-confirmed LOCKED decision (D-150.8, navigator-LOCKED 2026-06-12) applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14 and 15. Regression fences held: the new floor test green, `tests/claim-harness/run-all-claims.sh` 9/9, `tests/run-all-150.8.sh` 4/4, `tests/run-all-148.sh` 18/18. Canon version bumped to 1.7.

17. **F.7 dial-header reconciliation (Phase 150.6 Plan 04, FIX-09, 2026-06-11).** The Shape F.7 Decision Gate header drifted: skills/ui-system/SKILL.md:253-258 declared a tri-context header ("[CONTEXT] - REACH - decision gate" / "LOCAL / BRAIN / SIGNAL" / "Choose next reach:") while the shipped renderer (lib/hmi/dial-presenter.cjs) emitted only the flat legacy line "Larry can reach for:". The navigator resolved the canon-vs-code fork in favor of OPTION A -- RENDER THE DECLARED HEADER (a navigator-LOCKED decision, FIX-09 / DRIFT-11, 2026-06-11): dial-presenter.cjs now renders the full tri-context Decision Gate header on the engine arm (the header line, the LOCAL/BRAIN/SIGNAL line -- LOCAL derived from the cortex/reach signals already in hand, BRAIN only when a Brain-derived prior exists, SIGNAL "(none this turn)" when absent -- and the "Choose next reach:" prompt replacing the legacy "Larry can reach for:" prompt). One self-conflict in the SKILL declaration was corrected to match what shipped: the prompt-line glyph was declared "[right-triangle-filled]" (the FROZEN recommended-row marker), which would collide with the frozen single-marker body contract, so it ships as the approved "[arrow]" glyph and SKILL.md:257 was amended to match (truth-telling, not blessing drift). The FROZEN contracts are UNTOUCHED: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 RECOMMENDED gate, the body marker glyphs, the top-3-of-N footer, the F.1 keyboard contract, the appendAskUserQuestionTrailer coupling. Regression fences held: run-all-148.sh 18/18, run-all-150.5.sh + run-all-150.sh green; the dial-presenter render tests were extended with production-shaped header assertions. This was applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism (mirroring entries 14/15). Presentation reconciliation only -- no change to canon doctrine; version stays 1.6.

19. **Brain dual-role amendment: orchestration projection sanctioned + methodology_tier minted (Phase 157, 2026-06-15).** Phase 157 (brain-orchestration-graph-and-methodology-tiers) amended Part 8 (The Graph Boundary) to sanction the Brain holding a projection of Mindrian's own orchestration layer (the /mos commands, the 6 frozen reaches plus sub_modes, the skills, the agents, the frameworks, the connector spine) ALONGSIDE the teaching methodology it has always held. `methodology_tier` (pws | mindrian-operation) is minted as the first-class boundary-keeper property that makes the projected machinery Part-8-legal: `pws` marks the teaching IP frameworks (Cynefin, Meadows, JTBD, Reverse Salient, the hat framework, and the rest), `mindrian-operation` marks the machinery, and the tier certifies every projected node as generic machinery metadata, NEVER user data. The projection is a Brain-derived LOCAL cache (Part 9), and Phase 157 makes ZERO live Brain read/write: live Brain write of the projection and continuous remote sync are deferred (continuous sync is Phase 137 brain-mindrianos-sync-compat; the live write is a fast-follow), and live nav-engine consumption of the cache is deferred. The LOCAL data -> BRAIN: NO invariant is UNCHANGED and restated as still binding; the amendment sanctions the SHAPE the Brain may hold and the LOCAL cache the plugin may derive, opening no new wire to the Brain. The amendment is the FIRST gate, landing docs-only before any generator code: the projection generator (a sibling of `scripts/build-connector-registry.cjs`, Part 7 reuse) and its `--check` tripwire (STALE / UN-WIRED / UN-RANKED) land in the subsequent Phase 157 plans, gated behind this amendment. Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14, 15, and 18. This was the navigator-LOCKED decision D-03 (157-CONTEXT.md), navigator-LOCKED 2026-06-15. The amendment + header/footer Version 1.7 -> 1.8 + the CANON-PHASE-MAP Phase 157 row + v1.8 version-history row moved together as the docs-only gate. Canon version bumped to 1.8.

20. **Part 10 ratification by navigator authority (2026-06-17).** Part 10 (Conversation as Product) -- thesis "Larry IS the product; Conversation IS the surface; Rooms are receipts; Commands are internals" with five sub-claims implemented across Phases 114/115/116/118/119 (sub-claims 1-3), Phase 100 (sub-claim 4), and Phases 117/120 (sub-claim 5) -- was ratified into the canon body as a new Part 10. The original ratification gate required a Hooked re-score >= 55/70 AND 4 of 5 testers reporting a "thinking partner" experience; the implementing code ALL SHIPPED across v1.13.0 but the gate was never run (measured 2026-06-05: Hooked Variable Reward 0.0/10 with no reward telemetry on the dogfood box, 0/5 empathy observations recorded; the Phase 150.7 tester round-2 validation week never executed -- the cohort experienced the pre-cure builds, never the cure). The navigator overrode the empirical gate and ratified on navigator authority. Recorded truthfully and without euphemism: the thresholds were NOT met and were NOT measured against real users; ratification rests on the navigator's judgment that the thesis is sound and the implementing code is shipped and stable, not on the gate's evidence bar. Per Part 5 (Evidence Is Graded By Context) the empirical validation (a real tester re-dose producing the two numbers) is DEFERRED to a v1.14.0 validation week as post-ratification confirmation -- no longer a precondition for Part 10 being binding canon, but a known and named debt. Navigator-LOCKED 2026-06-17, applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19. Closes the Phase 150.7 gate and the CANON-PHASE-MAP "CODE SHIPPED, NOT YET RATIFIED" obligation. Gate evidence: `.planning/milestones/v1.13.0-PART-10-RATIFICATION-GATE.md`. Canon version bumped to 1.9.

21. **Edge-vocabulary amendment: DECOMPOSED_INTO + PART_OF + TAGGED_WITH + RELATED_TO added to the frozen allow-list (Phase 163, 2026-06-18).** Phase 163 (Trending-to-the-Absurd Harness / Visionary Innovation Companion) amended Part 4's typed-edge vocabulary, adding four domain-taxonomy relationship edge types to the frozen `ALLOWED_EDGE_TYPES` closed set in `lib/core/navigation/edges.cjs`: DECOMPOSED_INTO (the hierarchy edge, source=parent taxonomy node, target=child; legal endpoints domain->subdomain and subdomain->focus_area ONLY), PART_OF (the structural-membership edge, source=member node, target=the domain/subdomain it belongs to; legal source endpoints any node type -- claim/assumption/opportunity/Artifact/Section/trend/CausalClaim -- legal target endpoints domain/subdomain/focus_area), TAGGED_WITH (the lightweight categorization edge, source=any node, target=domain/subdomain, the connective taxonomy tag), and RELATED_TO (the symmetric cross-domain relatedness edge between two taxonomy nodes -- domain<->domain, subdomain<->subdomain -- when a theme spans them). The amendment makes domains, subdomains, and focus_areas first-class connected graph citizens (D-163-01), the connective taxonomy layer walkable from a domain to everything it touches and back. The typed-edge vocabulary is a frozen constitutional property: Part 4 (Every Choice Is Graph Data) renders against this closed set, the Phase 108 frozen-taxonomy contract froze it, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so a phase that moves a frozen constitutional set must amend the canon using the canon's own mechanism. Code-wise the change is purely additive and reversible (every prior edge type landed additively); the load-bearing requirement was the constitutional discipline. This was the navigator-LOCKED decision D-163-03 (163-CONTEXT.md), navigator-LOCKED 2026-06-17, ratified at a blocking checkpoint before the canon bytes landed (mirroring the Phase 148 D-09 reach-count amendment and the Phase 150.8 D-150.8 trio). The amendment landed as ONE atomic lockstep wave so CI never went RED mid-phase: the `edges.cjs` additive block (mirroring the Phase 150.8 REFINES/ROOT_CAUSES/INSTANTIATES idiom verbatim), the canonical FLOOR test (`tests/test-edges-domain-taxonomy-floor.cjs` -- membership + full FLOOR preserved + frozen Set + a per-edge writeEdge round-trip + a made-up-type negative, never asserting `.size`), the `tests/run-all-163.sh` phase aggregator, and this canon record moved together. The new edge properties are ENUM/scalar ONLY (the taxonomy node id + a relation enum); they ride the existing writeEdge `properties` JSON param with ZERO signature change, never carry prose, and never cross to Brain (Part 8). Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19. The floor test fence holds green. Canon version bumped to 1.10.

22. **Edge-vocabulary reconciliation: CONVERGES + INVALIDATES + ENABLES brought into the Part 9 frozen set to match Part 4 prose (Phase 168, 2026-06-18).** Phase 168 (Part 4 edge-vocabulary reconciliation) reconciled a code-vs-canon drift: Canon Part 4 prose has ALWAYS declared the cascade edges INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES, and the legacy `lib/core/lazygraph-ops.cjs` path (the Phase 84 cascade path) already wrote all three, but the Part 9 writeEdge chokepoint frozen `ALLOWED_EDGE_TYPES` closed set in `lib/core/navigation/edges.cjs` carried only INFORMS + CONTRADICTS and never caught up on CONVERGES, INVALIDATES, and ENABLES -- so the chokepoint REJECTED three edges the canon already blessed. Unlike entries 18 and 21 (which MINTED net-new edge types and changed the Part 4 prose), this entry changes NO Part 4 prose: the three were already listed there. The amendment record exists to document that the CODE was brought into line with the already-blessed prose (a RECONCILIATION, not a vocabulary expansion) plus the version bump. CONVERGES is the convergence cascade edge (an artifact's themes appear in 3+ other sections; CLAUDE.md cross-relationship rule 3); INVALIDATES is the assumption-stale edge (an artifact makes an existing assumption stale; rule 4); ENABLES is the unblocks edge (an artifact unblocks something in another section; rule 5). Phase 164's issue-tree must emit INVALIDATES / ENABLES via THIS chokepoint, so closing the drift was a blocking prerequisite (the Part 6 dog-fooding mandate: the plugin must honor its own canon; the drift was a self-CONTRADICTS this phase resolves). The typed-edge vocabulary is a frozen constitutional property: Part 4 (Every Choice Is Graph Data) renders against this closed set, the Phase 108 frozen-taxonomy contract froze it, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so a phase that moves a frozen constitutional set must amend the canon using the canon's own mechanism even when it is a reconciliation. Code-wise the change is purely additive and reversible. `BELONGS_TO` (used by the Phase 164 issue-tree branch-to-governing-problem) is NOT in Part 4 prose and is NOT added; the issue-tree REMAPS `BELONGS_TO` to `PART_OF` (the structural edge Phase 163 already froze), so no genuinely-new edge type is minted in this phase. The broader `lazygraph-ops.cjs` legacy-array two-vocabulary unification (HSI_CONNECTION / REVERSE_SALIENT / RESOLVES_VIA and the other extra types the legacy array carries) is named as a deferred follow-on, OUT of scope here. This was the navigator-LOCKED decision D-168 (split-out-first, navigator-LOCKED 2026-06-18), ratified at a blocking checkpoint BEFORE the canon bytes landed (mirroring the Phase 163 D-163-03 quad and the Phase 150.8 D-150.8 trio). The reconciliation landed as ONE atomic lockstep wave so CI never went RED mid-phase: the `edges.cjs` additive block (mirroring the Phase 163-01 DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO idiom verbatim), the canonical FLOOR test (`tests/test-edges-part4-cascade-floor.cjs` -- membership + full FLOOR preserved + frozen Set + a per-edge writeEdge round-trip + a made-up-type negative, never asserting `.size`), the `tests/run-all-168.sh` phase aggregator, and this canon record moved together. The edge properties are ENUM/scalar ONLY (a relation enum + scalar counts); they ride the existing writeEdge `properties` JSON param with ZERO signature change, never carry prose, and never cross to Brain (Part 8). Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19/21. The floor test fence holds green. Canon version bumped to 1.11.

23. **Edge-vocabulary amendment: NESTED_WITHIN minted as the room-lineage edge (Phase 169, 2026-06-19).** Phase 169 (Graph-Derivation Harness) amended Part 4's typed-edge vocabulary, adding ONE room-lineage edge type, NESTED_WITHIN, to the frozen `ALLOWED_EDGE_TYPES` closed set in `lib/core/navigation/edges.cjs` to give the D-169-11 fractal joint a LEGAL, graph-navigable representation: source = a healed/born CHILD room node id (`room:<child-slug>`), target = its PARENT room node id (`room:<parent-slug>`). The 8-agent ICM/fractal fan-out (verdict MISSING) proved the joint had no legal home today: PART_OF is the domain-taxonomy structural edge (consumed by `typed-domain.cjs` + `get-domains-for-trends.cjs`, legal targets domain/subdomain/focus_area), so a room is an illegal PART_OF target -- `writeEdge` checks type-membership but NOT endpoints, so a room->room PART_OF would write SILENTLY while breaching the frozen-endpoint contract (a Part 4 self-CONTRADICTS); and BELONGS_TO is NOT a member of the Part 9 navigation frozen set at all (it lives only in the legacy lazygraph EDGE_TYPES array, written via raw SQL, not this chokepoint), so a child-room BELONGS_TO parent-room via `navigation.writeEdge` would be REJECTED. The amendment is a NEW dedicated lineage type, NOT a widening of PART_OF endpoints, so room-lineage walks never pollute the domain-taxonomy traversals; it expresses the ICM/Simon nested-near-decomposable-hierarchy claim directly (the nested folder hierarchy IS the graph). The typed-edge vocabulary is a frozen constitutional property: Part 4 (Every Choice Is Graph Data) renders against this closed set, the Phase 108 frozen-taxonomy contract froze it, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so a phase that moves a frozen constitutional set must amend the canon using the canon's own mechanism. Code-wise the change is purely additive and reversible. This was the navigator-LOCKED decision D-169-11 (169-CONTEXT.md), navigator-ratified as option-a (mint NESTED_WITHIN; NOT option-b PART_OF widening; NOT option-c BELONGS_TO) at a blocking checkpoint BEFORE the canon bytes landed (mirroring the Phase 168 D-168 reconciliation, the Phase 163 D-163-03 quad, and the Phase 150.8 D-150.8 trio). The amendment landed as ONE atomic lockstep wave so CI never went RED mid-phase: the `edges.cjs` additive block (mirroring the Phase 168-01 CONVERGES/INVALIDATES/ENABLES idiom verbatim), the canonical FLOOR test (`tests/test-edges-room-lineage-floor.cjs` -- membership + full FLOOR preserved + frozen Set + a room->room writeEdge round-trip + a made-up-type negative, never asserting `.size`), the `tests/run-all-169.sh` phase aggregator (which also carries the Phase 168 cascade floor test to prove the frozen prior vocabulary is untouched), and this canon record moved together. The edge properties are ENUM/scalar ONLY (a relation enum + the parent slug handle, e.g. `{ relation:'nested', parent:'<parent-slug>' }`); they ride the existing writeEdge `properties` JSON param with ZERO signature change, never carry prose, and never cross to Brain (Part 8); NESTED_WITHIN is a LOCAL room.db edge in the child's db and cross-room aggregation of it is forbidden. Plans 04 (the rollup walk) and 07 (the heal lineage edge) BOTH consume this type, so it lands Wave 1, before any consumer. Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19/21/22. The floor test fence holds green. Canon version bumped to 1.12.

24. **Node-type amendment: SyntheticExpert minted as a truth-claim node (Phase 164, 2026-06-19).** Phase 164 (BONO Research/Debate Engine) amended the Phase-108 frozen node taxonomy and Part 9's truth-claim set, adding ONE node type, SyntheticExpert, to give the E1 reusable-expert citizen a LEGAL home: a high-value team member FILED from the room/team/personas .md files and promoted to a queryable graph node, re-invokable as a hat in future runs. SyntheticExpert is added as a truth-claim NODE type (the `TRUTH_CLAIM_TYPES` frozen Set in `lib/core/navigation/transitions.cjs` plus the `node_aliases` SyntheticExpert entry, resolution NEW, in the Phase-108 `aliases.yml`) BECAUSE a human confirms which experts are worth keeping (Part 9 role 5: the navigator decides). The single additive member AUTOMATICALLY human-confirm-gates a SyntheticExpert's proposed->confirmed promotion: the `promoteNodeStatus` guard keys on `TRUTH_CLAIM_TYPES.has(row.type)`, so an agent-attributed confirm is REJECTED and only a human byUser promotes, with ZERO change to the promoteNodeStatus signature or the closed TRANSITIONS table. The SyntheticExpert node carries generic-lens metadata ONLY (hat/name/surname/archetype/beautiful_question/method/evidence_tier/invocation_count/review_status/provenance), NEVER venture content; cross-room expert reuse is a DEFERRED Part-8-gated amendment, so this phase is ROOM-LOCAL with zero Brain egress (Part 8). The node taxonomy is a frozen constitutional property: the Phase 108 frozen-taxonomy contract froze it, and the Part 6 dog-fooding mandate requires the plugin to honor its own canon, so adding a node type is a canon amendment, not a per-phase edit. Code-wise the change is purely additive and reversible (mirroring the edges.cjs ALLOWED_EDGE_TYPES additive moves of entries 18/21/22/23). The companion edge-vocabulary work E2 was ALREADY DONE by Phase 168 (Appendix D entry 22: CONVERGES / INVALIDATES / ENABLES brought into the Part 9 frozen set; the Phase 164 issue-tree REMAPS BELONGS_TO to PART_OF, frozen by Phase 163), so this amendment carries ONLY the node type and touches no edge vocabulary. This was the navigator-LOCKED decision D-164-S1 (164-CONTEXT.md / the E1 amendment), navigator-ratified at a blocking checkpoint BEFORE the canon bytes landed (mirroring the Phase 169 D-169-11, the Phase 168 D-168 reconciliation, the Phase 163 D-163-03 quad, and the Phase 150.8 D-150.8 trio). The amendment landed as ONE atomic lockstep wave so CI never went RED mid-phase: the `transitions.cjs` additive member, the `aliases.yml` node_aliases entry (schema guard still green), this Part 2 expert-citizen mention + this Appendix D entry 24, the CANON-PHASE-MAP Phase 164 row + v1.13 version-history row, and the canonical FLOOR test (`tests/test-synthetic-expert-nodetype-floor.cjs` -- SyntheticExpert membership + the full prior truth-claim FLOOR preserved + frozen Set + an agent-attributed-confirm-rejected / human-confirm-ok promotion round-trip, never asserting `.size`) registered in `tests/run-all-164.sh`, all moving together. Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19/21/22/23. The floor test fence holds green. Canon version bumped to 1.13.

25. **Part 11 (The Invocation Constitution / CIRS) ratified (2026-06-22).** A new constitutional Part - the invocation/reachability layer, peer to Part 8 (Boundary) and Part 9 (Memory) - establishing the Command Invocation Ruling System (CIRS R1-R14) as a closed ruling set governing the lifecycle (born/modified/updated/removed) of every invocable surface (command, skill, agent). Until now invocation doctrine was scattered across Parts 2/3/8 + entries 15/19 and regressed repeatedly (Phases 143.x, 144.1) because the governing contract lived nowhere but an orphaned WARN-only gate. Proposed in the /gsd-discuss-phase 172 session after a 14-stream research fan-out, then put through a three-reviewer adversarial pass: A (canon-compliance) = CANON-COMPLIANT-WITH-CONSTRAINTS (C1-C6); B (adversarial) = OVERSPECIFIED, argued fold-into-Part-8; C (integration) = RECONCILES-WITH-GAPS, keep-as-Part (fold-in would re-scatter). The navigator ratified the synthesized disciplined-minimal form: KEEP as Part 11 (A+C altitude verdict), with R6 (earned chains) + R11 (fractal rollup) DECLARED-but-DEFERRED-ENFORCEMENT (hard-FAIL gated on substrate existing - answers B's premature-freeze attack), constraints C1-C6 (reaches/postures frozen; Shape F scalars frozen; R6 confidence on the PROJECTION FEEDS_INTO not the navigation edge; R5 counterpart is a projection node not a room.db node; no new Brain wire; cross-room NESTED_WITHIN aggregation forbidden) and the gap fixes (R13 retirement state, R14 trigger-overlap, autonomous_safe governed, R6 ranking-deferral to Part 3, R1 unit-of-coverage, R12 = canon_parts specialization keyed on slug) folded into the Part text. Part 11 mints NO new edge type, NO new node type, NO new reach, and opens NO new Brain wire - every primitive it leans on is already canon; what is NEW is the closed ruling set + the born-wired lifecycle gate. Navigator-LOCKED 2026-06-22, applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring Parts 9 and 10 (entries 12/20). Implementing phase: 172 (with Phase 166 runChain as the runtime; 170/171 as first conformance targets). Header/footer Version 1.13 -> 1.14. Evidence: docs/CANON-PART-11-PROPOSAL-invocation-constitution.md + docs/CANON-PART-11-REVIEW-SYNTHESIS.md.

Conversation transcript reference: session 2026-04-20, branch `ui/destijl-rebuild`. First canon draft shipped at commit 528abdd; cross-references at b7d95bd; amendment at this commit. Part 9 (Memory Locality and Interpretation) ratified at the Phase 109 release gate (2026-05-12).

---

## Appendix E - Beautiful Questions + Team Composition Rules + Handoff Triggers

### Beautiful questions (per SME archetype, Berger 2014 framework)

Each archetype opens with one question when instantiated as a team member:

  Founder        What if we are solving the wrong problem?
  Researcher     Why do we believe this is true?
  Operator       How would we actually ship this Monday?
  Investor       What has to be true for this to return 10x?
  Mentor         What did you learn that surprised you?
  Domain Expert  Where does this break against physical reality?
  Student        What would I ask if I did not already have an answer?

### Team composition rules (Brain-validated)

  R1  Problem discovery / Pre-Opportunity stage
      -> Researcher/White + Student/Green + Mentor/Red + Founder/Yellow

  R2  Ill-Defined to Well-Defined transition
      -> Founder/Yellow + Investor/Black + Domain Expert/White + Operator/Blue

  R3  Thesis build / Investment stage
      -> Investor/Black + Researcher/White + Operator/Blue + Mentor/Red

  R4  Wicked problem (8-10 wickedness score)
      -> Founder/Yellow + Investor/Black + Researcher/White + Student/Green + Mentor/Blue

  R5  Grant or translational track (P.grant, P2.IND)
      -> Researcher/White + Domain Expert/Black + Operator/Blue

  R6  Stuck or regression detected
      -> Mentor/Red + Student/Green + Devil's Advocate (Red Team)/Black

### Handoff triggers (chain mechanics)

  1. Risk surface identified     Yellow Hat Founder -> Black Hat Investor
  2. Evidence thin               Any hat -> White Hat Researcher
  3. Plan without owner          Green Hat Student -> Blue Hat Operator
  4. Navigator stuck / circular  Current hat -> Red Hat Mentor
  5. Jargon density high         Any hat -> Green Hat Student

Larry surfaces each handoff as a single Decision Gate line:

  "[Incoming member] is ready. Accept, reshape, or stay where we are?"

The navigator always decides.

---

_Mindrian Canon v1.14 - MindrianOS Plugin_

_Version history is maintained inline in docs/CANON-PHASE-MAP.md (Version history table)._
