---
phase: 363
name: Deep Research Planner - quick and deep research runs
gathered: 2026-09-29
status: ready_for_planning
promotes: SEED-097
canon_parts: [3, 6, 7, 8, 9, 11, 12]
---

# Phase 363: Deep Research Planner - quick and deep research runs - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The relevant PWS methodology commands become **research planners**. A command run in research mode
turns its own output into a research plan: the questions the user did not know to ask, the lens,
the sources, the audited queries and the falsifier. One shared plan-and-run engine then runs that
plan as a **quick run** (one pass, an evidence card) or a **deep run** (decompose, fan out,
iterate, counterevidence, a report plus an evidence ledger). Evidence comes back hash-anchored to
the card or section that started the run. The phase also delivers the approval model (a research
grant with two lifetimes) and a first acceptance case: SEED-097's Whitespace + OpenAlex slice, run
in both modes.

It is the MCP intelligence layer from the original Phase 355 ask (the April 2025 "Algorithmic
Generation of Solutions" deck plus the algorithm-incorporation devpkg), which 355 and 355.1
narrowed to room-local groundwork.

**Not in this phase:** new PWS frameworks, a second research stack, a hosted service, any runtime
dependency on an open-source deep-research project, Theo-side step authoring (Theo companion work
runs alongside Theo SEED-015), the SEED-098 Scientific Roadmapping command.

</domain>

<decisions>
## Implementation Decisions

### Governing principle (navigator, 2026-09-29, verbatim intent)
- **D-00:** Mindrian pushes the user to **ask the questions they do not know to ask**. The
  frameworks do this in structured ways: **a framework is a question-asking agentic system**. The
  planner operates the frameworks in accordance with, and appropriate to, the problem-type
  context, the gates, and the needs we understand the user has. Research is how the framework's
  questions get tested against the world, not a search box. Navigator words: "remember mindrian
  pushes users to ask questions he doesn't know to ask. the frameworks do this in structured ways
  and we need to operate them in accordance and appropriateness to the problem type context and
  gates [and] user needs we understand. frameworks are basically asking questions as an agentic
  system." Every downstream decision below serves D-00. A plan whose questions are only the
  user's own question restated fails D-00.

### Learning from open source
- **D-01:** Learn only; rebuild natively. Borrow patterns, and MIT/Apache prompt structures and
  open data with attribution. **No runtime dependency, no sidecar, no MCP wrap** of any
  open-source deep-research agent (gpt-researcher, STORM, open_deep_research, local-deep-research,
  etc.). Reason: every surveyed project lets the model compose and fire its own queries, which
  breaks the approved-audited-query contract and Part 8; wrapping also adds a Python server and a
  second LLM egress. A wrapped project is allowed only as an offline benchmark baseline. The
  pattern ledger in `research/363-RESEARCH-oss.md` (16 patterns plus "what not to copy") is the
  borrow list the planner works from.

### PWS commands become research planners
- **D-02:** The relevant PWS commands **become research planners for the user - a new way to use
  them** (navigator, verbatim: "according to relevance the commands become research planners for
  the user. it's a new way to use them"). A command gains a research-planner mode in which its own
  structured questioning produces the plan's questions and falsifiers. Examples the navigator named
  and their question source:
  - `/mos:map-unknowns`: known-unknowns become research questions; unknowables are flagged not
    researchable.
  - `/mos:root-cause` (5 Whys): each "why" answered by an assumption becomes a query to confirm or
    break that link.
  - `/mos:think-hats`: black hat -> counterevidence, yellow -> prior successes, white -> missing
    facts, and so on; one hat per lane.
  - `/mos:find-bottlenecks` (Reverse Salient): the lagging component -> intervention and failure
    literature.
  - `/mos:scenario-plan`: driving forces -> evidence on which uncertainties are actually moving.
  - `/mos:trending-to-absurd`: the trend -> where it breaks before the absurd extreme.
  - Candidates by the same pattern: beautiful-question, challenge-assumptions, dominant-designs
    (already has a research mode, Phase 361), explore-futures. The planner (researcher/planner
    agents) decides the first-wave set; D-06 fixes the minimum.
  All of these are `autonomous_safe: true` today.
- **D-02a (one governed path, Canon Part 7 and Part 11):** each command contributes its questions,
  lens and falsifier template; **one shared plan-and-run engine** does plan emission, query
  composition and audit, approval, fetching, iteration, evidence rows and filing proposals. No
  per-command fetcher, cache, approval ledger or scheduler. Phase 361's `/mos:dominant-designs`
  research mode is the precedent to generalize, not a parallel implementation to copy.
- **D-02b (relevance and Theo's role):** which command(s) get offered as planners is decided by
  relevance: the room's problem type (Undefined / Ill-Defined / Well-Defined / Wicked, classified
  silently), the room context, the active JTBD and gates. Theo helps by answering **which
  frameworks fit this problem type and in what order**, through anchored graph reads
  (problem-type -> framework edges, FEEDS_INTO), framework names and problem-type handles only,
  never room content or the user's question (Part 8). Research found Theo's freeform
  "recommend a chain" asks are refused (`freeform_unproven`) and only Scientific Roadmapping (7
  steps) and Scenario Planning for High Uncertainty (5 steps) have process steps, so **each
  command's own local templates supply the plan steps**; a command switches to Theo-driven steps
  only once Theo holds live steps for it. The problem-type -> research-shape mapping in
  `research/363-RESEARCH-pws.md` is the starting shape table (Undefined: landscape scan, deep;
  Ill-Defined: independent-lens fan-out, deep, quick when one lens is named; Well-Defined:
  hypothesis test, quick; Wicked: systems map, deep with a reviewed plan, "unresolved" is a valid
  outcome).
- **D-02c (falsifier is mandatory):** every lens carries an explicit counterevidence or falsifier
  search (the SEED-097 per-perspective falsifiers). This is the differentiator from the surveyed
  open-source agents, which have no explicit counterevidence step.

### Quick vs deep
- **D-03:** Split by **loop, trigger and output** (not two systems: one engine, mode = budget
  knobs, per the pattern ledger).
  - **Quick:** one pass. One question, a small audited query family, one corpus (OpenAlex first),
    cache-first. Returns an **evidence card**: hash-anchored rows, a one-line answer, a verdict of
    settled / thin / contested / gap-confirmed. May be started by the navigator **or by the room
    itself under a standing grant** (D-04). With no grant on file, the room composes the plan and
    offers it on a card; nothing egresses.
  - **Deep:** decompose -> one lane per lens (hats, SEED-097 perspectives) -> reflect -> second
    round -> **mandatory counterevidence pass**. Stops at the first of: depth/round cap,
    saturation (nothing new), budget spent; then an honest synthesis naming unresolved branches
    (never a silent stop). Returns a **report plus an evidence ledger**, filed only on the
    navigator's yes. **Navigator-started only**, never unattended (extends the dominant-designs
    "unattended runs take the quick pass" rule).
  - **Escalation:** a thin or contested quick card offers one line, "run deep on this?", and hands
    its plan over as the deep plan's seed.
  - **Numbers are proposed defaults, not measurements:** quick up to 3 queries, top 5 rows, 1
    corpus; deep fan-out capped via `resolveFanoutCap` (dominant-designs uses 4), depth 2 with
    breadth halving each level (dzhng precedent), a reflection cap below open_deep_research's
    default of 6, a time/token budget to be set. 363 measures latency and yield and records the
    values in a floor ledger; 355.1's measured child runtime (p50 8.4 s, p90 11.6 s, n=135) does
    not cover network fetches.

### Plan review and approval
- **D-04:** A **research grant with two lifetimes.**
  - **Deep: a per-run grant on an F.6 Plan Review card** before anything is fetched. The card
    shows sub-questions tagged with their lens and source command, the exact audited round-one
    query strings, corpora and fallback, the budget (breadth, rounds, queries per round, results
    per query), counterevidence on/off, and the return target. Editable: drop, add or reword a
    sub-question (reworded text is recomposed and re-audited before re-render), toggle sources,
    change budget within disclosed caps. Hand-typed raw query strings are refused (no send-anyway
    path, matching find-analogies). In-run follow-ups proceed without asking only inside an
    approved query family, provider and remaining budget; otherwise halt on an **F.3** extend-or-
    stop card showing the new audited strings.
  - **Quick: a standing grant approved once on an F.0 card.** It binds provider plus one fallback,
    corpus scope, allowed query families (composer template ids, never free text), per-run caps,
    a per-room hourly throttle (value from the floor ledger), room scope, policy version, expiry,
    and revocation. It must ask again when a query falls outside a family, the provider is not in
    the policy, a cap or throttle is exceeded, the Part 8 audit trips or degrades, the grant is
    expired or re-versioned, the room has no grant, or the run wants to go multi-step (promote to
    F.6).
  - **Audit record per executed query:** grant id and version, query string, hash and template
    id, Part 8 verdict, provider, filters and pagination used, fallback used or not, timestamp,
    originating card or node id, result ids and content hashes, valid-empty vs provider-failure.
  - **A grant authorizes fetching, never filing.** Filing stays gated (existing F.8 basket or F.0
    per finding); claims land `proposed`.
  - **First grant scope is narrow:** OpenAlex plus the whitespace-gap template family only.
  - **Planner surface declares** `hitl_stages`: deep plan review F.6 (gate), deep extend budget
    F.3 (gate), quick policy grant F.0 (gate), filing F.8 (parallel). The fetcher agents keep
    receiving literal strings, now with a grant id, and stay hitl-exempt.
- **D-05 (navigator ruling on the ask-before-web-research HARD RULE):** approving a scoped
  standing grant **is** the ask for later ambient quick runs inside that grant. Anything outside
  the grant asks again. The grant is visible and revocable, and the audit ledger records every
  query. This is a recorded, deliberate exception to `commands/research.md`'s "a methodology never
  auto-fires research" rule and to 355.1's no-egress cadence runner; both documents must be
  updated to point at the grant mechanism.

### Acceptance
- **D-06:** SEED-097's first slice is the first acceptance case, run in both modes: Whitespace +
  OpenAlex on a two-section room cohort, asking whether a scoped gap is absent from the
  literature or only absent from the room, with its falsifier (covered under another term,
  irrelevant, or an extraction failure). In addition, at least one question-asking command from
  D-02 (map-unknowns or root-cause recommended as the first) must produce a plan in research mode
  whose questions demonstrably go beyond the user's stated question (D-00 check), reviewed by a
  human against a written rubric. Benchmark scores from the surveyed projects are not acceptance.

### Minto / MECE is the plan's skeleton and the insight's return path
- **D-08 (navigator, 2026-09-29):** "Minto MECE can derive research: break the context and user
  intent into its MECE and Minto pyramid structure, understand how to build the research, understand
  the next framework that is relevant, and bring in insight from the research." Concretely:
  - **Down (plan):** the room context plus the user's intent becomes a Minto pyramid: the governing
    thought or question at the top (SCQA framing), a MECE key line of sub-questions beneath it,
    and leaves that are researchable questions. Each leaf is tagged with the framework lens that
    asks it (D-02) and its falsifier (D-02c). MECE is checked: no overlap between siblings, no gap
    that leaves the governing question unanswered. The questions the user did not know to ask
    (D-00) show up as the MECE gaps the user's own framing left open.
  - **Across (next framework):** the pyramid shows where support is weakest: an unsupported,
    contested or empty branch. That branch picks the **next relevant framework** (with Theo's
    problem-type and FEEDS_INTO reads, D-02b). The plan's sequence comes from the pyramid, not from
    a fixed chain.
  - **Up (insight):** evidence rows attach to their leaf as support or contradiction; results roll
    up the pyramid so the governing thought is restated, strengthened, weakened or split. A deep
    run's report is the updated pyramid with row citations, not a free-form essay. A contradiction
    is kept as a held contradiction, never smoothed over.
  - **Reuse, not rebuild:** `/mos:structure-argument` (Minto + SCQA + MECE), `/mos:mos-reason`
    and `lib/core/reasoning-ops.cjs` (REASONING.md, confidence, `verification.must_be_true`),
    `lib/core/feynman-minto-invariants.cjs`, the room's MINTO.md, the `held_contradictions`
    table. The planner writes and updates the pyramid through these; no second reasoning store.

### Scientific research: ask the graph how to structure it
- **D-09 (navigator, 2026-09-29):** when the research is scientific, the planner **asks Theo (the
  Neo4j teaching graph) how to structure the research**, because the graph already holds the
  relevant frameworks. Live anchored reads (2026-09-29, framework handles only):
  - Scientific-research frameworks present: Scientific Roadmapping (7 process steps), Logic Trees
    (Issue, Hypothesis, Decision) (5 steps), Hypothesis-Driven Problem Solving (0 steps), Scientific
    Method (0), Adversarial Research Protocol (0), Research Validation and Early Business Framing,
    Herbert Simon The Sciences of the Artificial.
  - FEEDS_INTO: Scientific Roadmapping -> Reverse Salient Analysis, Hypothesis-Driven Problem
    Solving, PWS Value Proposition, Three-Horizon Framework; Hypothesis-Driven Problem Solving ->
    Red Teaming.
  - Logic Trees is the graph's own MECE issue/hypothesis/decision tree: it is the natural Theo-side
    source for the D-08 pyramid's structure on scientific questions, and it has live steps.
  - Frameworks with live steps drive the plan's steps directly (D-02b upgrade path); frameworks
    with zero steps contribute their place in the sequence only, and the gap is logged for the
    Theo companion work (Theo SEED-015 / SEED-097 Theo-side authoring).
  - Reads are anchored `MATCH` by framework handle and problem type; the scientific question itself
    never goes to Theo (Part 8). Freeform `brain_search` / `brain_ask` on such questions is refused
    (`freeform_unproven`, observed 2026-09-29), so the planner must not depend on them.

### Opportunities scooped by research
- **D-07 (navigator, 2026-09-29):** "such research might scoop opportunities to be filed." A run,
  quick or deep, watches for opportunities, not only answers: a gap confirmed in the literature, a
  reverse salient with an intervention nobody has tried, a mechanism that transfers, a trend break,
  a funding or grant signal. Each is proposed as an opportunity candidate linked to its run and its
  evidence rows, and offered in the same filing basket as the run's claims (F.8, parallel;
  nothing files without approval). Filing reuses the existing opportunity surface
  (`room_content file-opportunity` / the `opportunity-bank/` section and, for grants, the
  Opportunity Bank / `mos:opportunity-scanner` path), never a new store. The run ledger in
  `research/` links to the filed opportunity; the opportunity links back (SEED-097 ICM filing
  rule: links, not copies). The grant (D-04) never authorizes this filing.

### Claude's Discretion
- Plan object schema, module names and where the plan-and-run engine lives (under `lib/core/`
  next to `research-corpus.cjs`, or a new folder with a `ROOM.md`).
- Which of the 16 ledger patterns land in 363 vs later, beyond the ones D-02c, D-03 and D-04
  require (counterevidence lane, typed stop checks, forced honest synthesis, quote-first
  evidence rows, plan review).
- The first-wave command set beyond the D-06 minimum.
- Whether journal-quality and retraction flags (LDR / PaperQA2 pattern, open data) land in 363 or
  a follow-on; confirm the OpenAlex fields exist before planning it.
- Passage filtering: Jev via Theo where policy allows, local BM25 as the no-key fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's evidence (discuss-phase research, 2026-09-29)
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/research/363-RESEARCH-oss.md` - 14 open-source deep-research projects verified on GitHub (license, language, last push), per-project architecture, the 16-pattern ledger and "what not to copy"
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/research/363-RESEARCH-modes.md` - how the projects define modes, knobs, stop rules (with source-verified defaults); plugin quick/deep precedents
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/research/363-RESEARCH-pws.md` - Theo responses (what is grounded vs thin), problem type -> research shape -> frameworks -> falsifier mapping, repo reuse points
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/research/363-RESEARCH-approval.md` - plan-review HITL patterns across the field, grant design, audit record, hitl_stages

### Seed and origin
- `.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md` - promoted seed: six independent perspectives and their falsifiers, Astra verdicts V1-V8, first slice, ICM filing and run memory, acceptance gates, open decision 6
- `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md` - downstream, depends on SEED-097's Theo-side authoring requirement
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-ORIGIN-CONCEPT.md` - the deck, slide by slide
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-BRIEF.md` - three homes, one wire shape
- `.planning/phases/355.1-ambient-trigger-the-room-starts-the-breakthrough-run-sens-20/355.1-CONTEXT.md` - ambient trigger rules (ledger, lock, throttle, no egress today)
- `~/MindrianRooms/mindrianOS/research/2026-09-27-mos-canvas-open-source-tooling-review.md` - component-level tooling decisions (sqlite-vec, OpenAlex, Crossref, Docling ...); not redone here

### Precedents to generalize
- `commands/dominant-designs.md` and `agents/dominant-design-researcher.md` - Phase 361 research mode: quick pass vs deep dive, query gate card, lanes, validate-lane rejection of edited queries
- `commands/find-analogies.md` and `agents/analogy-query-fetcher.md` - approved exact-string external fetch, no send-anyway path
- `commands/research.md` - `reach_id: deep_research`, `plan_gated: true`, cache-first `fetchCorpus`, the "never auto-fires research" rule D-05 amends

### Opportunity filing (D-07)
- `commands/opportunities.md`, `commands/explore-opportunity.md`, `commands/qualify-opportunity.md` - existing opportunity surfaces
- `lib/mcp/tool-router.cjs` - `room_content file-opportunity` schema and routing (note the 2026-07-06 active-room misroute todo)

### Minto / MECE reasoning layer (D-08)
- `commands/structure-argument.md` - Minto + SCQA + MECE argument structure
- `commands/mos-reason.md` and `lib/core/reasoning-ops.cjs` - Feynman-Minto REASONING.md per section, confidence, verification.must_be_true
- `lib/core/feynman-minto-invariants.cjs` - the invariants a pyramid must hold

### Canon and contracts
- `docs/MINDRIAN-CANON.md` Parts 3, 7, 8, 9, 11, 12
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - hitl_stages (Form B) declaration
- `.claude/includes/moat.md` - WHEN / WHICH / SEQUENCE is the moat (D-02b)
- `docs/GROUNDING-SOURCES.md` - Theo only through the guarded `mindrian-brain` shim

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/research-corpus.cjs` (`fetchCorpus`, Part 8 check before egress), `lib/core/research-cache.cjs`: the fetch and cache spine for both modes.
- `lib/core/rs-query-matrix.cjs`, `rs-nl-to-query.cjs`, `rs-query-to-text.cjs`: template-matrix query composition with egress audit; `rs-query-matrix` already implements "PWS picks the lens, templates fill the queries" for Reverse Salient.
- `lib/core/rs-fetcher-academic.cjs` (OpenAlex/arXiv/PubMed), `rs-fetcher-experts|industry|patents.cjs`: providers.
- `lib/core/rs-corpus-quality-gate.cjs`: source quality; extension point for journal and retraction flags.
- `lib/core/research-context-extractor.cjs`, `research-filing-selector.cjs`: context in, filing proposal out.
- `lib/core/recipe-maps.cjs` (NAMED_RECIPES, postureForCommand) and `lib/workflow/command-resolver.cjs` (`composeWorkflow`): the one governed framework -> command path; shape recipes belong here.
- `lib/core/chain-executor.cjs` `runChain` plus MCP `gate_render` / `gate_answer`: halt at the material fetch step, resume on approve.
- `resolveFanoutCap`, `audit-query`, `validate-lane` from the Phase 361 dominant-designs research mode.
- 355.1 ambient run ledger, per-room lock and throttle.
- `rs-mind-map.cjs`: candidate shared map for Co-STORM-style between-round steering.

### Established Patterns
- Fetcher agents receive literal approved strings and never compose or rephrase.
- Claims land `proposed`; only a human confirms (Part 9).
- Every invocable surface is born wired or excluded with a declared HITL shape (Part 11 R16).
- Theo reads use anchored `MATCH`; `brain_query` rejects OPTIONAL MATCH and untyped relationship scans.

### Integration Points
- Each D-02 command's command file gains a research-planner mode that hands its structured output to the shared engine.
- `research/` room section is the complete home of each run (plan, grant, queries and hashes, results, counterevidence, stop reason, report); `opportunity-bank/` gets a linked proposed opportunity (SEED-097 ICM filing rules).

</code_context>

<specifics>
## Specific Ideas

- Navigator's named frameworks for pushing research: Six Thinking Hats, Reverse Salient, scenario analysis, Trending to Absurd, Knowns/Unknowns, 5 Whys.
- Borrow list highlights (full ledger in the OSS research note): plan object with review and a revision cap (gpt-researcher `plan_review.py`); mode as budget knobs (dzhng, PaperQA2, local-deep-research); breadth halving per level (dzhng); gaps queue and action masking (Jina); typed stop checks and forced honest synthesis (Jina "beast mode"); perspectives generate questions (STORM); unused-evidence steering between rounds (Co-STORM); evolving report as the only carried memory (Tongyi IterResearch); quote-first evidence rows (Ai2 ScholarQA); contradiction mode per claim recorded via `claim_verify` (PaperQA2 `contracrow`); source quality from open data (DOAJ CC0, Stop Predatory Journals MIT).
- Do not copy: model-fired queries, own server or second LLM, one ever-growing context, the long report as the product, flat URL source lists, source count as quality, uncapped or silent stops, benchmark scores as acceptance, methods needing model training, code-as-action sandboxes. open_deep_research is archived and STORM unpushed since 2025-09-30: borrow ideas, not code.

</specifics>

<deferred>
## Deferred Ideas

- Theo-side authoring of process steps for the D-02 frameworks (only Scientific Roadmapping and Scenario Planning have steps today): Theo companion work alongside Theo SEED-015.
- SEED-098 Scientific Roadmapping command: triggers on SEED-097's Theo-side acceptance check.
- Remaining SEED-097 perspectives beyond the first slice (RS, HSI, Find Analogies, Eureka, Scientific Roadmapping) as research-mode fixtures: sequenced after the first slice per Astra V8.
- Optional cross-perspective portfolio synthesis (SEED-097 V3: optional, never required).
- A wrapped open-source agent as an offline benchmark baseline, if evaluation needs one.

</deferred>

---

*Phase: 363-deep-research-planner-quick-and-deep-runs*
*Context gathered: 2026-09-29*
