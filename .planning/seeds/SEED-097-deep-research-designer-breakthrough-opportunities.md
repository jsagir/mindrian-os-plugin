---
id: SEED-097
status: dormant
priority: critical
planted: 2026-09-27
planted_during: Phase 355.1 close-out (after execution, before the release cut)
trigger_when: immediately after the Phase 355.1 release cut; the next phase to discuss, before any other new phase
scope: large (one phase: the MCP intelligence services and the research designer built together, with a Theo-side companion phase)
navigator_ruling: "2026-09-25: after 355.1, the next phase is the MCP-based intelligence layer from the ORIGINAL 355 ask. Do not narrow it."
---

# SEED-097: Deep Research Designer for breakthrough opportunities, built with the MCP intelligence services

The critical next phase. A research designer that turns the room's own signals into deliberate,
literature-scale research, so the breakthrough engine stops being limited to what is already in
the room. It is the MCP-based intelligence layer the navigator asked for at the start of Phase 355
(the pptx "Algorithmic Generation of Solutions", April 2025, and the algorithm-incorporation
devpkg zip), which 355 and 355.1 deliberately narrowed to room-local honesty groundwork (Home A).

## Built alongside the MCP intelligence layer, not after it (navigator, 2026-09-27)

The research designer and the MCP intelligence services are ONE critical phase, designed and
shipped together. Neither comes first. The designer is a consumer and a producer on the same
service layer:

| Intelligent service (MCP, typed, Home B/C) | What the research designer does with it |
|---|---|
| Engine services: RS, HSI, whitespace, eureka as typed MCP tools | Consumes their findings as query candidates (driver 2) |
| Lens service: hats / persona lenses | Asks it WHAT is worth researching for a finding (driver 1) |
| Pattern service: problem-type rung, discovery-pattern taxonomy, Terminology Translation, Problem Decomposition | Shapes each query's language and splits the question (driver 3) |
| Query composer + egress audit (Part 8) | The designer's own output: audited query strings awaiting navigator approval |
| Corpus service (Scopus, Semantic Scholar, arXiv / PubMed / patents) behind the Theo seam | Runs the approved queries; returns reviewed, hash-anchored rows |
| Judgment service: Jev through Theo as keyholder (Theo SEED-015) | Types each result (supports / contradicts / says nothing; pattern id; novelty) |
| Verification service: guarded `find_connections` on the shim | Stamps each research-backed pairing on every surface |

Design rule: one wire shape for all services (closed enums, integer buckets, quantized scalars,
registry ids; no free text, no room content), the 355 BRIEF's shape. The designer is the
orchestration that composes the services into a research loop: engine finding -> lens picks the
question -> pattern shapes the query -> navigator approves -> corpus answers -> Jev types it ->
stamp verifies -> one card, through 355.1's ambient path. Discuss-phase scopes the service
contracts and the designer loop together, so no service is built without the designer as its
first consumer and the designer never calls anything that is not a typed service.

## Each research runs on a cohort of context from across the room (navigator, 2026-09-27)

A research question is never framed from one finding alone. The designer assembles, per
research, a **context cohort**: the insights from DIFFERENT parts of the room that bear on the
question, read together. For example, an HSI pairing between two solution-design artifacts gets
its cohort from problem-definition (the governing question), market-analysis (who would care),
open questions and unsupported claims (the gaps), CONTRADICTS edges (the tensions), prior
REJECTED_BECAUSE decisions (what the navigator already ruled out) and the stage. The cohort is what
lets the lens and the pattern services ask the RIGHT question, and it is what makes a research
result land as a room-wide insight instead of a pair-local one.

Rules for the cohort:
- **Local graph first.** Built only from the room's local SQLite graph (`room/.room-graph/`
  room.db) through `lib/core/navigation.cjs` reads, the single chokepoint: graph neighborhoods,
  `room-delta-facts`, open questions, unsupported claims, contradictions, decision nodes. Reuse
  `context_assemble` (its four legs) and the navigation readers before writing anything new.
- **Cross-section by design.** A cohort must span at least two ICM sections (not two artifacts in
  one folder), chosen by graph distance and section role, not by keyword match. Its composition
  (which sections, which node types, how many) is recorded with every research run so a result can
  be traced back to the cohort that framed it.
- **Never egresses (Part 8).** The cohort stays on the machine. Only the typed query the navigator
  approves crosses; the cohort shapes the query, it is never sent with it.
- **Results come home to the right sections.** A corpus result is filed back (proposed, human
  ratified, Part 9) to the section(s) its cohort drew from, with typed edges to the cohort's
  nodes, so the next ambient run sees it as room delta.

## Mandatory consults for this phase

This phase MUST consult, at discuss-phase AND at plan-phase (not optional, CLAUDE.md standing
consults):
- **icm-architect skill:** the cohort's section model (ICM Layers 0-4, ROOM.md identities, which
  sections a research question should draw from, where results file back, how the room's folder
  structure stays the orchestration).
- **The local graph (SQLite room.db, `lib/core/navigation.cjs`, `lib/core/navigation/CONTEXT.md`):**
  which node and edge types make a cohort, the cohort query cost on a 10k-node room, the typed
  edges a research result writes back, and the chokepoint discipline. Consult the graph design
  owners' notes and run the existing navigation perf and invariant tests against a cohort reader.
- Also, per the grounding rules: langtalks-graph-expert (graph-augmented retrieval, context
  cohorts / community summaries), Context7 for any corpus API, and Theo for the corpus proxy and
  the judgment seam.

## Why This Matters

Today (after 355 and 355.1) every breakthrough finding is a connection between two things
ALREADY INSIDE the room, checked against the methodology graph. Nothing reaches outside: no web
call, no literature corpus (verified 2026-09-27: zero Tavily / WebSearch / Semantic Scholar /
arXiv / Scopus / http references in the ambient and stamp code). The origin deck's whole point was
the opposite: two encoders over thousands of papers per domain, where the unusual pairing hides.
The room can only surprise the user with what the user already wrote down. The research designer
closes that gap, and it is the moat move: WHEN to research, WHICH lens, WHAT query, in WHAT
sequence, decided by the graph and the engines, not by the user typing a search.

## The design shape (navigator's words, 2026-09-27)

Three drivers, one designer:

1. **Research driven by hats.** The Six Thinking Hats / persona lenses decide WHAT is worth
   researching (the white hat asks for the missing facts, the black hat for the prior failures and
   "someone tried this last year", the green hat for the adjacent domains, the yellow hat for the
   value case). Reuse before build: `/mos:think-hats`, `/mos:persona`, `agents/persona-analyst.md`.
2. **Queries driven by the engines.** RS (reverse salients), HSI (the lexical-vs-semantic
   differential), whitespace (structural holes) and eureka findings generate the query
   candidates. An engine finding is a question the corpus should answer, not only a card.
3. **Problem-pattern driven.** The problem type rung (undefined / ill-defined / well-defined /
   wicked, never keyword-inferred, per 355.1 AMB-07), the discovery pattern taxonomy (devpkg #3:
   analogical transfer, constraint relaxation, structural isomorphism, mechanism bridging,
   recombination, scale translation, temporal translation, negation insight), Terminology
   Translation (devpkg #1: "binding constraint" also searches "reverse salient", "bottleneck",
   "single point of failure") and Problem Decomposition (devpkg #7: 3-5 sub-questions, unknowables
   flagged as whitespace) shape the query language.

## What it must include (do not narrow)

- **Corpus behind the Theo seam (Home C):** Scopus (the deck's source), Semantic Scholar (devpkg
  Weak Signals), arXiv / PubMed / patents (devpkg Temporal Convergence, GPU hours, never in a
  request path). Results enter only as reviewed, hash-anchored data, computed elsewhere and written
  once, or land in the room graph through a plugin adapter.
- **Query egress (Canon Part 8):** the proven house pattern. A local composer builds the query
  string, it is audited, the navigator approves the exact string (or a standing policy for the
  ambient run, an open decision), and a fetcher runs it verbatim (Tavily, falling back to
  WebSearch), never rephrasing or supplementing. Templates: `agents/analogy-query-fetcher.md`,
  `agents/dominant-design-researcher.md`, `commands/find-analogies.md`, `commands/research.md`.
- **Runtime Jev judge (Home B):** Theo as the Jev keyholder with a `judgment` kind on the
  analytics seam. This is Theo's SEED-015 (`~/Theo/.planning/seeds/SEED-015-judgment-kind-on-the-analytics-seam-theo-as-jev-keyholder.md`),
  which needs the navigator's approval in the Theo session. Not to be confused with this repo's
  own SEED-015 (selective install profiles).
- **MCP surfaces:** the engines as typed MCP tools; a guarded `find_connections` passthrough on the
  Brain shim so Desktop and Cowork compute stamps (355 D-50 deferred it).
- **The remaining devpkg capabilities:** #2 Temporal Convergence, #3 Discovery Pattern Taxonomy,
  #5 Weak Signal Scoring, #6 Bit-Flip-Spark, #8 Supervisor Reconciliation, #9 Update Velocity, plus
  #1 and #7 above.
- **355.1 item 11:** a rank-only export from `scripts/eureka-portfolio-report.cjs` so the ambient
  eureka card uses the full AHP / tail-quadrant ranking (`355.1/deferred-items.md`).

## Open decisions for discuss-phase

1. Which corpus first (Scopus access and cost vs Semantic Scholar's free API).
2. Per-query navigator approval vs a standing, audited query policy for the ambient run.
3. Who pays for the corpus API and the GPU hours; where the corpus service runs.
4. How a hat lens maps to a query family (one hat, many queries? one query per hat per finding?).
5. The recall measure: the proposed fourth, research-type fixture room with planted known
   transfers (355-24 remark, still a pending ruling).

## When to Surface

**Trigger:** right after the 355.1 release cut. First phase to discuss: `/gsd-discuss-phase` on a
new phase created from this seed, with the five open decisions above at the top of the agenda.

## Scope Estimate

**Large.** Plugin phase (query composer, hat-to-query mapping, MCP tools, shim passthrough, corpus
adapter, Jev seats) plus a Theo companion phase (judgment kind, corpus proxy). Run the discuss and
research through the standing consults: icm-architect, langtalks-graph-expert, Context7, Theo.

## Breadcrumbs

- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-ORIGIN-CONCEPT.md` (the deck, slide by slide)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-BRIEF.md` (three homes, one wire shape, per-capability Jev table)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-INTENT.md` (who the engine serves; devil's advocate objections)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-VERIFICATION.md` (first hit rate: 43/96 useful; 85 percent unverified, 77 handle_unresolved)
- `.planning/phases/355.1-ambient-trigger-the-room-starts-the-breakthrough-run-sens-20/deferred-items.md` (item 11)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-algorithm-engines-external-service-rethink.md` (the original ask and the devpkg's 9 capabilities)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-27-ambient-trigger-room-starts-the-run.md`
- `commands/think-hats.md`, `commands/persona.md`, `agents/persona-analyst.md`
- `agents/analogy-query-fetcher.md`, `agents/dominant-design-researcher.md`, `commands/find-analogies.md`, `commands/research.md`, `agents/research.md`
- `lib/core/ambient-run.cjs` (the five producers this designer would feed from)
