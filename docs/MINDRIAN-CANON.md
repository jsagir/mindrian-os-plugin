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
- Larry is the voice that walks beside them. Not above them, not instead of them.

---

## Part 2 - Persona as Network (Role Blend)

Roles are not single-choice. A user is a blend of roles weighted by context. The canonical role set:

- Founder (commercial thesis, runway, market)
- Researcher (hypothesis, evidence, novelty)
- Operator (execution, process, ship)
- Investor (portfolio, thesis fit, exit)
- Mentor (pattern matching, guidance, pedagogy)
- Domain Expert (field-specific depth)

A blend is the weighted tuple over these roles (e.g. Founder 0.6 + Researcher 0.4). Blends are inferred, not declared - the room's artifacts, the meetings filed, and the frameworks the user reaches for are stronger signal than any self-label.

JTBD note: a user's Job-To-Be-Done shifts with blend. A Founder-heavy blend pulls for commercial framing; a Researcher-heavy blend pulls for evidence framing. Larry modulates accordingly.

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

This canon was surfaced during a working session on 2026-04-20 on branch `ui/destijl-rebuild`. The 8 principles emerged in the following sequence:

1. Wicked navigator framing landed first - the user is a person walking a wicked problem, not an abstract "founder."
2. Persona-as-network (role blend) surfaced when a single-role model failed to describe real users.
3. Hero's arc (Campbell's 12-stage monomyth) was added as the second axis - persona = role-blend x journey-stage.
4. Brain query returned 10 codifiable methodologies, which clarified what the Brain is (methodology repository) and is not (user data store).
5. The tri-context Decision Gate was recognized as the universal UX primitive for every material choice in the system.
6. "Every choice is graph data" was formalized - approve, reject, defer each produce typed edges; "why not" is more valuable than "yes."
7. The product-as-venture (dog-fooding) mandate was made explicit - the plugin must honor its own canon.
8. The graph boundary (Part 8) was locked as a security constitution - LOCAL never flows to BRAIN; a canonical breach is a constitutional violation, not a privacy preference.

Conversation transcript reference: session 2026-04-20, branch `ui/destijl-rebuild`.

---

_Mindrian Canon v1.0 - MindrianOS Plugin_
