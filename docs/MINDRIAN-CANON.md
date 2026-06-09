# Mindrian Canon

Version: 1.6
Date: 2026-06-09
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

_Mindrian Canon v1.6 - MindrianOS Plugin_

_Version history is maintained inline in docs/CANON-PHASE-MAP.md (Version history table)._
