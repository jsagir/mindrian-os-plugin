# Mindrian Canon

Version: 1.0
Date: 2026-04-20
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

### Engine 1 - Domain Exploration

Five decomposition lenses: Disciplinary, Stakeholder, System, Temporal, Scale.

Output: Primary domains -> subdomains -> focus areas. Each node carries supporting evidence, dissenting evidence, emerging trends. Cross-domain convergence, synergy, and conflict are mapped.

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

- LOCAL: what the room already knows. Artifacts, prior decisions, assumption registry, recent meetings. This is the user's private thinking.
- BRAIN: what the methodology layer knows. Framework chaining rules, phase progressions, teaching patterns. This is generic strategic intelligence, never user data.
- SIGNAL: what the outside world is reporting. Grants, market data, competitive moves, scheduled sweeps. This is public evidence.

Mechanism: the gate is surfaced through the AskUserQuestion primitive. The user sees all three contexts at the decision boundary and answers with one of the three verbs. The answer becomes an edge.

This gate is the universal UX primitive. Any feature that asks the user to choose something must route through the tri-context gate. No bespoke dialogs, no framework-specific modals.

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

---

## Appendix A - Relationship to MWP

The canon adds the navigation axis (role-blend x journey-stage) and the security constitution (Part 8) on top of the MWP 7-layer integration surface. MWP-SPECIFICATION.md carries a forward-reference to this canon; canon-conformant features also satisfy MWP conformance clause 7.1.

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
- Brain - the remote methodology repository (brain.mindrian.ai). Strategic thinking tools only. Never a store for user data.
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

Conversation transcript reference: session 2026-04-20, branch `ui/destijl-rebuild`. First canon draft shipped at commit 528abdd; cross-references at b7d95bd; amendment at this commit.

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

_Mindrian Canon v1.1 - MindrianOS Plugin_
