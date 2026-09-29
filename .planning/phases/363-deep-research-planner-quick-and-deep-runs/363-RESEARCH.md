# Phase 363: Deep Research Planner - quick and deep research runs - Research

**Researched:** 2026-09-29
**Domain:** Research planning and execution engine over the existing research spine (research-corpus, research-cache, Part 8 audit, gate ledger, navigation filing), PWS command research modes, research grants, OpenAlex
**Confidence:** HIGH for the repo seams, the Theo reads and the OpenAlex facts, all checked live today. MEDIUM for the numbers and policy choices, which are proposed and flagged `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- Theo-side authoring of process steps for the D-02 frameworks (only Scientific Roadmapping and Scenario Planning have steps today): Theo companion work alongside Theo SEED-015.
- SEED-098 Scientific Roadmapping command: triggers on SEED-097's Theo-side acceptance check.
- Remaining SEED-097 perspectives beyond the first slice (RS, HSI, Find Analogies, Eureka, Scientific Roadmapping) as research-mode fixtures: sequenced after the first slice per Astra V8.
- Optional cross-perspective portfolio synthesis (SEED-097 V3: optional, never required).
- A wrapped open-source agent as an offline benchmark baseline, if evaluation needs one.
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed DRP363 family)

The phase has no requirement IDs yet. This research proposes the **DRP363** family below, one ID per concrete requirement. **How it gets registered** (the DDR361 / AMB precedent, `.planning/REQUIREMENTS.md:3270-3353` and `:3611-3730`):

1. The plan set ratifies these IDs. The first plan (Wave 0) adds a section `### Phase 363 - Deep Research Planner (DRP363 family)` to `.planning/REQUIREMENTS.md`, directly after the `### Phase 355.1 - Ambient trigger (AMB family)` section and before `## Traceability`. It uses the same preamble wording DDR361 uses: "minted in the Phase 363 plan set (date), ratifying `363-RESEARCH.md`'s proposed family as amended by D-00..D-09, registered here at plan time as `- [ ]` rows, closed with measured proof or left open with a stated reason at phase close by `363-NN-PLAN.md`".
2. The same plan appends `plus DRP363-01..NN (Phase 363)` to the Traceability family list and adds `DRP363` to the "Caveat, carried on ... families" list (`REQUIREMENTS.md:3723`).
3. **Watch out:** that Traceability paragraph already disagrees with itself. It opens with "392 active requirements" and closes with "Roadmap phases must map all 373 active requirements" (`REQUIREMENTS.md:3613` vs `:3720`). Do not silently "fix" the number. Report it in the registration plan's SUMMARY as a pre-existing inconsistency.
4. `.planning/` files are force-tracked despite `.gitignore`, so commit with `git add -f`. Commit with `--only` on owned paths (shared tree).
5. The phase-close plan flips each row to `- [x]` with its proof, and adds a `docs/CANON-PHASE-MAP.md` row for `canon_parts: [3, 6, 7, 8, 9, 11, 12]`.

| ID | Description | Research Support |
|----|-------------|------------------|
| DRP363-01 | One Plan object (a Minto pyramid: SCQA, governing question, MECE key line, leaves with lens, source command, falsifier, audited queries, origin tag, researchable flag; plus mode knobs, stop rules, grant ref, return target, revision cap, plan_hash), validated in code | Pattern 1, Code Example 1 |
| DRP363-02 | MECE and coverage are checked deterministically. `issue-tree.cjs` validators handle overlap and falsifiability, and per-command coverage dimensions handle exhaustiveness. D-00 structural gate: at least one researchable leaf whose origin is not `user_stated` | Pattern 2, Pitfall 19 |
| DRP363-03 | Query families: composer template ids with typed slots. Every outbound string is audited before it can be returned. A refusal never echoes the string. No free text. Each string gets a sha256 `q_hash`. First family is `whitespace-gap/v1` | Pattern 3, Code Example 2 |
| DRP363-04 | Research grant with two lifetimes (standing F.0, per-run F.6), room-local, versioned, expiring and revocable. Every executed query is validated against a grant, with the D-04 re-ask reasons enumerated | Pattern 4, Code Example 4 |
| DRP363-05 | Append-only, room-local audit record per executed query with every D-04 field; never egresses | Pattern 4 |
| DRP363-06 | Corpus honesty: an OpenAlex HTTP failure, budget 429, timeout or network error is never typed `empty_valid`. `meta.count` and cost are carried. The optional API key goes in a header and never reaches a log, cache key or ledger | Pitfalls 1-3, Code Example 3 |
| DRP363-07 | Quick run: one pass, up to 3 queries, top 5 rows, one corpus, cache-first. Evidence card with a verdict computed in code. Quote-first rows checked against the fetched record text and its content hash | Pattern 5, Pattern 6 |
| DRP363-08 | Deep run: typed stop checks (cap, saturation, budget, plurality), breadth halving, mandatory counterevidence pass, F.3 extend-or-stop card, honest synthesis naming unresolved branches. The report is the updated pyramid with row ids | Pattern 7 |
| DRP363-09 | Escalation: a thin or contested quick card offers "run deep on this?" once and seeds the deep plan with the quick plan | Pattern 5 |
| DRP363-10 | Filing only on the navigator's yes: `research/<dated-slug>/` run home, EvidenceClaims `proposed`, SUPPORTS/CONTRADICTS edges to leaf nodes, contradictions kept as CONTRADICTS edges, pyramid roll-up to the originating section's reasoning. A grant never authorizes filing | Pattern 8 |
| DRP363-11 | Opportunities scooped (D-07): proposed opportunity nodes linked to run and rows (both directions). Funding and grant signals go through the existing `file-opportunity` path | Pattern 8, Pitfall 10 |
| DRP363-12 | Structure from Theo (D-02b, D-09): a research-shape ledger built from anchored reads (handles only) and shipped as data, with an optional live refresh that names its source. Local "is this scientific" detection. Logic Trees steps drive pyramid construction for scientific questions. The weakest branch picks the next framework | Pattern 9 |
| DRP363-13 | First-wave command research-planner modes (map-unknowns, root-cause, whitespace) use the question-set contract. Each command's existing session flow is byte-preserved. Born wired, with HITL declarations | Pattern 10 |
| DRP363-14 | One runner surface: `/mos:research` plan-run mode declared `hitl_stages` F.6/F.3/F.0/F.8, plus a `research_run` MCP tool. Tri-polar behavior stated. D-05 doc amendments (research.md, scout.md, scheduled-tasks.md) | Pattern 11, Pitfalls 14-17 |
| DRP363-15 | Ambient quick run under a standing grant inside the 355.1 ambient child: lock reused, separate research ledger, throttle, once per delta. With no grant, only a plan card is offered and nothing egresses | Pattern 12 |
| DRP363-16 | Acceptance: the Whitespace + OpenAlex two-section slice in both modes (offline replay, plus a live smoke that skips as ENV GAP), and the D-06 human rubric review of a map-unknowns plan. Floor-ledger rows hold the measured latency and yield | Validation Architecture |
| DRP363-17 | Part 8 sweep: a planted room marker never reaches argv, logs, the cache key, Theo args or the audit ledger. The only exception is an approved query string, and even then only inside the audit ledger and the outbound request | Security Domain |
</phase_requirements>

## Summary

This phase adds no new research technology. MindrianOS already has every heavy part of a deep-research agent:
- one Part-8-audited fetch chokepoint (`lib/core/research-corpus.cjs::fetchCorpusEnvelope`, audit at `:716`)
- a room-local TTL cache (`lib/core/research-cache.cjs`)
- a native OpenAlex adapter (`lib/core/rs-fetcher-academic.cjs:124-132`)
- an exact-string approval precedent with query validation and filing (`scripts/dominant-design-research.cjs`, `lib/core/dominant-design/*`)
- a deterministic MECE and falsifiability validator (`lib/core/issue-tree.cjs:103-148`)
- a gate ledger with single-use resume (`lib/mcp/tools/gate.cjs`, `lib/mcp/tools/chain.cjs`)
- a research run home with a graph node (`lib/core/eureka/research-filing.cjs::fileResearchArtifact`)
- a proposed-only opportunity writer (`navigation.writeOpportunityNode`)
- the 355.1 ambient child with its lock and ledger (`lib/core/ambient-run.cjs`, `scripts/scout-cadence-guard.cjs`)

What is missing is the **planner**: a Plan object shaped as a Minto pyramid, per-command question templates, a query-family composer, a grant ledger, a quick and deep run controller, and a verdict. Together these are a few hundred lines of deterministic CJS in one new folder, plus command-body sections.

Six findings change the plan shape. Each was checked live today.

1. **The OpenAlex path lies on failure.** A 429 (budget exhausted) or a 500 comes back from `fetchCorpusEnvelope` as `empty_valid`. I reproduced this with a stubbed fetch. For the Whitespace slice this would print "gap confirmed in the literature" when the provider was simply down. It must be fixed before any verdict code exists.
2. **OpenAlex now meters usage.** It introduced keys and usage-based pricing in 2026. A keyless call showed a $0.10/day budget (`x-ratelimit-limit-usd: 0.1`) and $0.001 per search. The adapter sends no key and drops `meta.count`, which the gap verdict needs.
3. **Theo's typed `framework_step` seam cannot read any scientific framework today.** It returns null `label`/`runIt` for Logic Trees, Scientific Roadmapping and Scenario Planning for High Uncertainty, plus an `ALIAS_CYCLE` refusal on Logic Trees. The anchored `brain_query` read works. So D-09 structure must come from anchored Cypher, built once at dev time and shipped as data.
4. **Quick runs do not need the Agent tool.** OpenAlex is fetched in-process with native `fetch`, so a quick run can run on all three surfaces through the MCP server process, the same process 355.1's ambient child already uses. Deep runs need model analysis per lane: they fan out on CLI and degrade honestly on Desktop and Cowork.
5. **"Quick pass or deep dive?" already exists in 23 command files** as a session-depth question. The research modes must use different words, or users and tests will confuse the two.
6. **`/mos:research` already holds a granted `Agent` token** (`data/subagent-dispatch-grants.json`), `plan_gated: true` and `reach_id: deep_research`. Making it the single runner avoids a Task grant row and a ratification checkpoint for every D-02 command.

**Primary recommendation:** build `lib/core/research-planner/` as the one engine, with a `CONTEXT.md` like `lib/core/navigation/`. Fix the OpenAlex honesty and metering gaps first. The D-02 commands only emit a validated question set. `/mos:research` (CLI) and a new `research_run` MCP tool (Desktop and Cowork) are the only surfaces that run plans. Ship Theo structure as `data/research-shape-ledger.json`.

## Project Constraints (from CLAUDE.md)

- **GSD owns all dev work**: no direct repo edits outside a GSD workflow. Commit only owned paths with `--only`, and use `git add -f` under `.planning/phases/**` (the memory file on tracked `.planning` files).
- **Canon Part 8**: no room content to Brain or Theo. Only framework names, problem-type ids and enums cross. Theo is reached only through the guarded path (`bin/mindrian-brain-mcp-client.cjs` or `lib/core/brain-client.cjs`, which runs `part8-egress-guard.cjs`), never `mcp__theo__*`.
- **Canon Part 3**: material choices go through a Decision Gate (Shape F, MAX_K=3).
- **Canon Part 7**: reuse before build. Justify every net-new surface against `commands/*.md`, `agents/*.md`, `pipelines/*/CHAIN.md`, `skills/*/SKILL.md`.
- **Canon Part 9**: room.db writes go only through `lib/core/navigation.cjs`. Claims land `proposed`, and only a human confirms.
- **Canon Part 11**: every new or changed invocable surface is born wired or excluded, with `hitl_shape`/`hitl_why` or `hitl_stages`. Plans that touch `commands/ skills/ agents/` carry a `cirs_relationship:` block and `11` in `canon_parts` (`scripts/check-cirs-declaration.cjs`).
- **Canon Part 12**: no grades, praise or counts in Larry's lines. No number appears unless an evidence row states it.
- **Tri-polar**: every feature is evaluated on CLI, Desktop and Cowork. A skip is a stated call.
- **Code**: CJS only, no TypeScript, zero new npm deps, native `fetch`. CLI entry points use the `process.argv` switch-case idiom. No em-dashes anywhere (hyphens only).
- **Verification**: `bash tests/run-all-363.sh`; `node scripts/build-connector-registry.cjs --check`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-render-coverage.cjs`; `node scripts/doctor.cjs --acceptance`.
- **Grounding**: Context7 for library APIs (none needed: no new library); Theo via the guarded path with handles only; icm-architect for room-structure questions (see Open Question 3).
- **Dev-research compositing**: the phase's findings also go to `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, mirrored to `mindrianOS/research/`. The orchestrator did this for the discuss trail (commit a8d955650). The phase-close plan must do it for the build results.
- **Never the Fable model**; planning agents are pinned to Opus per `.planning/config.json`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Framework questioning (turning a command's output into a question set) | Command body (Larry, the host model) | Engine (validates the question set) | Asking good questions is model work. The engine only checks structure (D-00 gate, MECE, falsifiers) |
| Problem-type classification (silent) | Local engine (`ambient-framing.cjs::resolveRoomRung`) | - | Already a non-keyword local chain (AMB-07). No egress |
| Framework fit and sequence, step structure (D-02b, D-09) | Data ledger built from Theo at dev time | Live anchored Theo read, handles only | Theo is the moat. Shipping it as data follows the house pattern (`scripts/build-*-ledger.cjs`) and removes the runtime dependency on `brain_query` access |
| Pyramid build, MECE and coverage checks | Local engine (`research-planner/pyramid.cjs` over `issue-tree.cjs`) | - | Deterministic. Model output is the input, never the checker |
| Query composition and Part 8 audit | Local engine (`research-planner/families.cjs` over `rs-egress-prompts.cjs::auditQueryString`) | - | The only source of outbound strings (lane-queries precedent) |
| Approval (grant) | Gate (AskUserQuestion on CLI, `gate_render`/`gate_answer` on MCP) | Room-local grant ledger (`.mindrian/`) | The human approves on a card. The ledger persists it, because MCP gate ids are in-memory and single-use |
| Fetch and cache | Local engine in-process (`research-corpus` + `research-cache`) | External corpus (OpenAlex) | Native fetch, one chokepoint, runs in the CLI script or in the MCP server process |
| Evidence extraction (quote-first rows) | Host model (quick) / Read-only analyst subagent (deep, CLI) | Engine validator (quote substring, content hash) | The model reads. Code verifies the quote exists in the fetched text |
| Verdict (settled / thin / contested / gap-confirmed) | Local engine (`verdict.cjs`) | Host model narrates only | Stops false success. Provider failure can never become "gap confirmed" |
| Filing (run home, evidence, edges, opportunities) | Local engine through `navigation.cjs` + `research-filing.cjs` | Room storage (room.db, `research/`, `opportunity-bank/`) | Part 9 single door. Proposed only |
| Ambient quick runs | 355.1 ambient child (MCP server process or Phase 117 child) | Engine `ambient.cjs` branch | Reuses the lock and throttle. Separate research ledger, so the strict ambient ledger schema is untouched |
| Tri-polar door | CLI script `scripts/research-planner.cjs` | MCP tool `research_run` | Same engine, two thin doors (the dominant-design-research.cjs and chain.cjs precedents) |

## Standard Stack

### Core (all internal, all existing; verified by reading the code today)

| Module | Purpose in 363 | Why standard |
|--------|----------------|--------------|
| `lib/core/research-corpus.cjs` (`fetchCorpusEnvelope`) | The only fetch path. Runs `auditQueryString(query,'research-corpus')` before dispatch (`:716`) and returns typed stage envelopes | Phase 130.5 single chokepoint, reused by `/mos:research` |
| `lib/core/rs-fetcher-academic.cjs` (`fetchOpenAlex`, `buildAcademicQuery`) | OpenAlex adapter. The URL chokepoint is at `:100-171` | The only place an academic URL is built |
| `lib/core/research-cache.cjs` | Cache-first reads and writes, 30-day TTL, key `source__slug__sha12` | One shared cache across research surfaces |
| `lib/lens-engine/source-lens-driver.cjs::fetchSourceCached` (`:263`, private today) | Cache-first plus typed-envelope fetch helper | Export it additively instead of copying it (Don't Hand-Roll) |
| `lib/core/rs-egress-prompts.cjs::auditQueryString` | The Part 8 string audit (FORBIDDEN_PATTERNS from `cross-room-aggregator.cjs:92-120`) | One fence, no private copies (Phase 196 precedent) |
| `lib/core/dominant-design/lane-queries.cjs` | Template for composer, audit and no-echo degrade (`:114-192`) | The Phase 361 precedent D-02a says to generalize |
| `lib/core/dominant-design/evidence-pack.cjs` | Row validator (five fields, forbidden score keys, tier map `:113-117`), artifact render, EvidenceClaim params | Generalize into `research-planner/evidence-rows.cjs` |
| `lib/core/eureka/online-pattern-query.cjs` | Frozen query families, abstraction as the fence, no send-anyway | Family precedent for the whitespace family |
| `lib/core/issue-tree.cjs` | `validateMECE`, `validateFalsifiability`, `toGraphEdges` (PART_OF / INFORMS / INVALIDATES / ROOT_CAUSES / ENABLES), `build()` | Already the "model generates, engine validates" pyramid engine (`/mos:diagnose` issue-tree mode) |
| `lib/core/ambient-framing.cjs::resolveRoomRung` | Silent problem-type classification: jtbd goal, ROOM.md, STATE.md, structural MINTO, then `unknown` | Non-keyword (AMB-07). Keyword classifiers are forbidden |
| `lib/core/futures/orchestrator.cjs::resolveFanoutCap` (`:76-82`, cap 5) | Clamps the deep lane count | The one fan-out cap authority |
| `lib/core/eureka/research-filing.cjs::fileResearchArtifact` (`:179`) | `research/<dated-slug>/<dated-slug>.md`, ROOM.md identity, memory_artifact node | Established top-level `research/` run home (Phase 219 D-16, url-ingest D-11) |
| `lib/core/navigation.cjs` (`fileEvidenceWithReadback`, `writeEdge`, `writeReasoningNode`, `writeOpportunityNode`, `linkOpportunityEvidence`) | All room.db writes | Part 9 single door |
| `lib/mcp/tools/gate.cjs`, `lib/mcp/gate-ledger.cjs`, `lib/mcp/tools/chain.cjs` | MCP approval: `material_step` gate with `resumeFn`, single-use | Same ladder `chain_run` uses |
| `scripts/scout-cadence-guard.cjs` (`acquireAmbientLock` `:919`, `AMBIENT_MAX_RUNS_PER_HOUR` `:359`) and `lib/core/ambient-run.cjs` | Ambient lock, throttle idiom, child budget (`AMBIENT_TOTAL_BUDGET_MS` = 4 min, `:71`) | 355.1 house precedent |
| `data/floor-ledger.json` + `scripts/check-floor-ledger.cjs` | Disclosed defaults for every cap, floor and throttle | D-03 requires the floor ledger |
| `zod` (^3.25.76, already a dependency) | MCP tool input schema only (355.1 rule: zod only at external edges) | Existing |

### Supporting

| Module | When to use |
|--------|-------------|
| `lib/core/brain-client.cjs::query` | Only for the dev-time ledger build and the optional live refresh (anchored `MATCH`, handles as `$params`) |
| `lib/core/recipe-maps.cjs::postureForCommand`, `lib/workflow/command-resolver.cjs::commandsForFramework` | Mapping a next framework (from FEEDS_INTO) to a `/mos:` command. The one framework-to-command door |
| `lib/core/publish-needs-default-lane.cjs` (CANONICAL_ROLES incl. `researcher`, `researcher_ind`) + `lib/core/user-md-ops.cjs` | D-09 "is this scientific" signal from USER.md `canonical_role` / `role_blend` |
| `lib/core/reasoning-ops.cjs::mergeReasoningFrontmatter` | Roll-up: write the run's supported and contradicted leaves into the originating section's REASONING.md `confidence.*` / `verification.must_be_true` |
| `lib/core/research-filing-selector.cjs::buildFilingSelector` | The existing F.1 filing card per finding (Mode A pre-fill at 0.7) |
| `tests/helpers/fixture-room-3551.cjs`, `tests/helpers/theo-replay-355.cjs` | Fixture room seeding through navigation, and Theo replay |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `lib/core/research-planner/` folder | Grow `lib/core/research-corpus.cjs` | That file is the fetch chokepoint. Mixing planner state in weakens the single-purpose audit door |
| Theo structure shipped as data | Live `brain_query` at run time | Ordinary-install `brain_query` access is unverified (the reads today used an env key; 2026-05 docs called raw Cypher admin-gated). Data keeps runs working keyless and replayable |
| `/mos:research` as the single runner | A runner body inside each D-02 command | Each command would need `Agent`/`Task` in `allowed-tools`, a grant row and a ratification checkpoint (361-07/361-08 precedent) |
| `research_run` MCP tool | CLI only | Quick runs would disappear on Desktop and Cowork, even though fetch is in-process and needs no Agent |
| Direct OpenAlex with an optional user key | OpenAlex proxied through Theo (SEED-097 "corpus service behind the Theo seam") | The proxy is Theo-side work (deferred). Direct fetch plus honest budget reporting ships now |

**Installation:** none. Zero new npm packages.

## Package Legitimacy Audit

No external package is installed by this phase. The stack is existing internal CJS plus `zod`, which is already a dependency. `slopcheck` is available on this machine (`/home/jsagi/.local/bin/slopcheck`), but there is nothing to check.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none new) | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 ENTRY A: navigator runs a D-02 command      ENTRY B: room delta (355.1 Stop hook / closeOutRoom)
 in research-planner mode                               |
        |                                               v
        v                                     ambient child (lock, throttle)
 [Larry fills question-set.json from the      -> whitespace producer finding (gap, sections>=2)
  framework's own output: quadrants, why-links,         |
  hats, gap]  (LOCAL prose, never egresses)             | (standing grant?) --no--> plan-only card, NO egress
        |                                               |yes
        v                                               v
 [plan build]<--- resolveRoomRung (local enum) <--- USER.md role (local enum, D-09 signal)
   |      \--- research-shape ledger (data) <--- optional live anchored Theo read (handles only)
   |  pyramid: SCQA -> governing Q -> MECE key line -> leaves{lens, falsifier, origin}
   |  checks: issue-tree validateMECE + validateFalsifiability + coverage dims + D-00 gate
   v
 [families composer] --template_id + typed slots--> auditQueryString --fail--> local-only (no echo)
   |  audited strings + q_hash
   v
 [grant check]  quick: standing grant (F.0 once)   deep: F.6 Plan Review card (edit -> recompose -> re-audit)
   |  no grant -> card only                        |  approve -> run grant (q_hash set, family, budget)
   v                                               v
 [fetch] research-cache hit? --yes--> cached records (provenance 'research-cache')
   |no
   v
 fetchCorpusEnvelope(openalex) --> typed envelope {ok | empty_valid | failed | blocked} + meta.count + cost
   |  every executed query -> audit ledger (append-only, room-local)
   v
 [rows] quick: host model | deep CLI: research-lane-analyst subagents (Read only)
   |  quote-first rows -> validator: quote is a substring of the fetched text, content_hash matches, tier in code
   v
 QUICK: verdict.cjs (typed envelopes + counts + floors) -> evidence card -> thin/contested? "run deep on this?"
 DEEP : controller: round++ | breadth halving | saturation | budget | cap | plurality
        -> out-of-family follow-up? F.3 card -> mandatory counterevidence pass -> honest synthesis
        -> updated pyramid (leaf status, row ids, unresolved branches)
   v
 [F.8 filing basket, only on yes] -> research/<dated-slug>/ (fileResearchArtifact)
        + EvidenceClaim (fileEvidenceWithReadback, proposed) + SUPPORTS/CONTRADICTS -> leaf hypothesis nodes
        + opportunity candidates (writeOpportunityNode + linkOpportunityEvidence) + REASONING.md roll-up
   v
 weakest branch -> next framework (ledger FEEDS_INTO + ADDRESSES_PROBLEM_TYPE) -> commandsForFramework -> offered next move
```

### Recommended Project Structure

```
lib/core/research-planner/
  CONTEXT.md             # folder contract (the lib/core/navigation/CONTEXT.md precedent)
  plan.cjs               # Plan schema, validatePlan, planHash, revision cap (DRP363-01)
  question-templates.cjs # per-command templates: coverage dims, lens ids, falsifier templates, researchable rules
  pyramid.cjs            # question-set -> pyramid; issue-tree validators; coverage; roll-up; weakest branch
  families.cjs           # query families (whitespace-gap/v1 first): compose + audit + q_hash (DRP363-03)
  grants.cjs             # grant ledger r/w/revoke/expire/version + validateExecutedQuery (DRP363-04)
  audit-ledger.cjs       # append-only .mindrian/research-audit.jsonl (DRP363-05)
  structure.cjs          # research-shape ledger read, live refresh, D-09 detect, Logic Trees mapping (DRP363-12)
  evidence-rows.cjs      # generalized row validator: quote-first + content hash + tier (from evidence-pack)
  verdict.cjs            # quick verdict rules, floors from data/floor-ledger.json
  run.cjs                # quick executor + deep controller state machine (DRP363-07/08)
  filing.cjs             # file-run orchestration through navigation + research-filing (DRP363-10/11)
  ambient.cjs            # standing-grant quick branch for the 355.1 child (DRP363-15)
scripts/research-planner.cjs          # CLI door: JSON-file inputs only, never argv text
scripts/build-research-shape-ledger.cjs + data/research-shape-ledger.json (--check)
lib/mcp/tools/research.cjs            # research_run MCP tool + connectors export
agents/research-lane-analyst.md       # deep-run analyst, tools: [Read] only, connector.excluded
tests/test-363-*.cjs, tests/run-all-363.sh, tests/helpers/fixture-room-363.cjs, tests/helpers/openalex-replay-363.cjs
```

`ROOM.md` is the identity file for **room** directories. Code folders use `CONTEXT.md`, as in `lib/core/navigation/CONTEXT.md`. No other `lib/core/*` subfolder has either file today (checked: dominant-design, unknowns, eureka, futures, recovery).

### Pattern 1: The Plan object is the pyramid (DRP363-01)

**What:** one JSON object is the whole plan: the Minto pyramid plus the run knobs. It is shown on the F.6 card, written to the run home on filing, and hashed (`plan_hash`) so an edit is detectable. Everything under `context`, `pyramid.scqa`, and `leaves[].question` is LOCAL prose. None of it is ever sent. Only `leaves[].queries[].q` (audited) crosses to the corpus.

**Why the D-00 check can be deterministic:** each leaf carries `origin`:
- `user_stated`: restates the navigator's question
- `framework_dimension`: a canonical dimension of the command's framework (a quadrant, a hat, a 6M category, a PESTEL force)
- `mece_gap`: a coverage dimension the user's framing left empty

The structural gate is: at least one researchable leaf with origin other than `user_stated`. Whether those leaves are good questions is the human rubric's job (D-06).

### Pattern 2: MECE by code where code can, by template where it cannot (DRP363-02)

- **Overlap** (mutual exclusivity): `issue-tree.cjs::validateMECE` (`:103-130`) flags siblings that share two or more content tokens. It is a heuristic that produces warnings. Show them on the F.6 card and never auto-suppress them (its own contract).
- **Falsifiability**: `validateFalsifiability` (`:135-148`) requires a `test` on every leaf. That is D-02c, satisfied by reuse: map `leaf.falsifier.text` to the node `test`.
- **Exhaustiveness** (collectively exhaustive): `validateMECE` only checks "at least 2 branches". Real exhaustiveness is a coverage check against the originating framework's **closed dimension set**, declared in `question-templates.cjs`. Each dimension must be covered by a leaf or explicitly marked `not_researchable` with a reason. The uncovered dimensions are the D-00 "questions you did not know to ask". Proposed dimension sets, all taken from the shipped references:
  - map-unknowns: the four quadrants (`references/methodology/map-unknowns.md:27-41`). Unknown-unknowns are flagged `not_researchable` per D-02, but "what would reveal it" can become a leaf.
  - root-cause: the why-chain links, plus Fishbone 6M for multi-cause (`references/methodology/root-cause.md:42-46`)
  - think-hats: six hats (`references/methodology/think-hats.md:34-44`). Red is `not_researchable` (emotions). White maps to missing facts, Black to counterevidence, Yellow to prior successes, Green to alternatives, Blue to the reframed question.
  - whitespace: the gap claim, plus the SEED-097 falsifier set (another term, irrelevant, extraction failure)
  - scenario-plan (later wave): `PESTEL_DOMAIN_ENUM` (`lib/core/futures/orchestrator.cjs:44-51`) x predetermined/uncertain
  - find-bottlenecks (later wave): technical / economic / behavioral constraint class (`references/methodology/find-bottlenecks.md:43`)

### Pattern 3: Query families = template id x typed slots, audited per string (DRP363-03)

Clone `lane-queries.cjs`: a frozen template table, one audited string per template, the first audit failure aborts with `{ok:false, degrade:'local-only', reason, family, template_id}`, and the string is never echoed. Add a `q_hash` (sha256 of the exact string) so grants and audit records key on hashes. The whitespace family is first (D-04 first grant scope). OpenAlex semantics matter here (Pitfall 3): plain `search=` is translated to full-text search with stemming and implicit AND, so exact-phrase templates must use double quotes, and synonym coverage uses an OR group. Proposed `whitespace-gap/v1` templates, all `[ASSUMED]` wording to be tuned with the replay fixtures:

| template_id | Role | Shape |
|-------------|------|-------|
| `ws.exact` | primary | `"{term}"` |
| `ws.synonym_cover` | falsifier: covered under another term | `"{term}" OR "{syn1}" OR "{syn2}"` (at most 3 synonyms, each audited) |
| `ws.prior_attempts` | falsifier: tried before | `"{term}" AND (review OR survey OR "systematic review")` |
| `ws.absence_reason` | context | `"{term}" AND (limitation OR barrier OR infeasible)` |

Slots come from the question set (the gap term and model-proposed synonyms) and are audited like any other string. See Pitfall 7 and Open Question 1 for the slot-novelty rule a standing grant needs.

### Pattern 4: The grant is a room-local ledger row; the gate is only the approval moment (DRP363-04/05)

MCP gate ids live in server memory, are single-use, and do not survive a restart (`gate_render` description, `lib/mcp/tools/gate.cjs:244`). So a grant must be **persisted** when it is approved:
- CLI: the command's AskUserQuestion answer, then `research-planner.cjs grant write <grant.json>`
- MCP: `gate_answer` approve on a `material_step` gate whose `resumeFn` writes the grant and, for deep runs, starts the fetch in the same call, as `chain_run` does

Both paths also write a `decision` reasoning node through `navigation.writeReasoningNode` so the approval is graph data. `gate_answer` already does this on MCP (`gate.cjs:385-420`).

- Store: `<room>/.mindrian/research-grants.json` for grants, and `<room>/.mindrian/research-audit.jsonl` for the append-only audit. This is the same place as `ambient-run-ledger.json` and `research-cache/`, and it is never filed or egressed. On filing, the run's slice of the audit ledger is copied into `research/<slug>/ledger.json` (SEED-097: the run home holds query approval and hashes).
- `validateExecutedQuery({q, q_hash, template_id, provider}, grant, state)` returns `{ok}` or `{ok:false, reask:<reason>}`. The reasons are the D-04 list: `outside_family`, `provider_not_in_policy`, `cap_exceeded`, `throttle_exceeded`, `audit_tripped`, `grant_expired`, `grant_reversioned`, `no_grant`, `multi_step`, plus `hash_not_approved` for a run grant's round one.
- Throttle: a separate `research-run-ledger.json` with its own `runs_window` shape. Do **not** add keys or producer ids to the 355.1 ambient ledger (Pitfall 18).

### Pattern 5: Quick run is one bounded pass with a verdict computed in code (DRP363-07/09)

1. Compose (up to 3 queries), then grant check, then cache-first fetch of the top 5 records per query.
2. Rows: the host model extracts quote-first rows.
3. Validate rows (Pattern 6).
4. Compute the verdict in `verdict.cjs` from typed envelopes, `meta.count`, and row labels. The model only narrates.

Proposed verdict rules `[ASSUMED]`; the floors go into `data/floor-ledger.json`:
- `unresolved` if **any** needed query returned `failed`/`blocked`. This one comes first, always. Provider failure can never become gap-confirmed.
- `gap-confirmed` only if the primary and the synonym-cover queries both ran live (or from fresh cache), both counts are at or below the disclosed floor, and the plurality check passed (the synonym template actually ran).
- `settled` (covered) if a primary or synonym count is above the floor and at least one validated row supports the leaf. This is the SEED-097 falsifier "covered under another term" firing.
- `contested` if validated rows include both `supports` and `contradicts`.
- `thin` otherwise (few hits, or hits without a validated row).

Escalation: a `thin` or `contested` card carries exactly one offer, "run deep on this?", which seeds a deep plan with this plan's pyramid and audited strings. It never auto-escalates.

### Pattern 6: Quote-first rows verified against the fetched text (hash anchoring)

The engine holds the fetched record, because fetch is in-process. So the validator can do what 361's could not (Tavily text was never stored):
- `content_hash = sha256(normalize(title + '\n' + abstract))`. Compute it at fetch time, store it in the run's records file and the audit ledger, and recompute it at validation.
- `row.quote` must be a whitespace-normalized **substring** of that record's title or abstract. A row that fails is dropped as `dropped_unverified_quote`, never hedged.
- Keep 361's rules: five required fields; any key containing score, confidence, strength, probability or rank is dropped as tampering; `evidence_tier` is set in code (OpenAlex works are `Academic` via `source_type: peer_reviewed` unless `type` says otherwise); `stripInjectionSpans` runs on render.
- The row id format stays `E-<LANE>-<n>` so citations look like 361's.

EvidenceClaim properties are a LOCKED schema (`lib/core/navigation/evidence-claim.cjs:128-150`) with no hash field. Keep the hash in the run home ledger and link it through the existing additive `artifact_path` key. Adding a property key is possible (the D-10 additive precedent), but it is not needed.

### Pattern 7: The deep controller is a deterministic state machine; the model does the reading (DRP363-08)

`run.cjs::nextDeepStep(state)` returns one of `dispatch_lanes`, `validate`, `reflect`, `extend_card` (F.3), `counterevidence`, `synthesize`, `done`. Recommended defaults `[ASSUMED]`, disclosed in the floor ledger:
- lanes = `resolveFanoutCap({fanout: 4})`
- rounds = 2
- queries per lane: round 1 up to 2, round 2 = `ceil(prev/2)` (breadth halving, dzhng)
- results per query = 5
- one mandatory counterevidence pass (one falsifier query per supported key-line branch)

Search budget with those defaults: at most 4 x 2 + 4 x 1 + 4 = 16 searches per deep run.

Stop at the first of these checks, recorded on the run as `stop_reason`:
- `cap`: round cap reached
- `saturation`: a round adds no new OpenAlex ids and no new validated rows
- `budget`: search cap reached, or `X-RateLimit-Remaining-USD` below the next call's cost
- `plurality_required`: a gap cannot be declared until its synonym template has run

Follow-up queries the model proposes after reflection are composed through `families.cjs`, never typed by hand. Strings inside the approved family and remaining budget run. Anything else halts on F.3 with the new audited strings (D-04).

Synthesis is the updated pyramid, rolled up in code:
- each leaf gets `supported | contradicted | contested | unresolved | not_run` with row ids
- each key-line branch aggregates its leaves
- the governing thought is marked `strengthened | weakened | split | unresolved`
- unresolved branches are listed by name (Jina "beast mode", made honest)

### Pattern 8: Filing through existing doors only (DRP363-10/11)

Everything below happens only after the navigator's yes, on the F.8 basket.
- **Run home:** `fileResearchArtifact(roomDir, {topicHandles, body, sources, slug})` writes `research/<YYYY-MM-DD>-<slug>/`, stamps ROOM.md identity, and registers a memory_artifact node (`lib/core/eureka/research-filing.cjs:179-215`). Put the plan, the pyramid, the query and hash ledger slice, the stop reason and the report in that folder.
- **Leaves as graph nodes:** `navigation.writeReasoningNode` with `nodeType:'open_question'` and `epistemicType:'hypothesis'` (allowed: `lib/core/node-insert.cjs:113-117`). `findOpenQuestions` (and so `whitespace_scan`) already reads `open_question` nodes.
- **Evidence:** `navigation.fileEvidenceWithReadback` per unique URL (one node per URL per session, `evidence-claim.cjs:159-167`; Pitfall 12), then `writeEdge` SUPPORTS or CONTRADICTS from the EvidenceClaim to the leaf node.
- **Held contradictions:** use `CONTRADICTS` edges through `writeEdge`, which `findContradictions` and `contradiction_check` already read. The `held_contradictions` table (`lib/core/memory-ops.cjs:103-111`) has **no navigation writer**, so writing it directly would be a second door (Part 9). See Open Question 4.
- **Opportunities (D-07):** use `navigation.writeOpportunityNode` (always `proposed`, lifecycle `candidate`) plus `linkOpportunityEvidence` (DERIVED_FROM / SUPPORTS / INFORMS only) to the run artifact node and the evidence nodes. The markdown card goes in `opportunity-bank/` with a link back to `research/<slug>/`. Use `room_content file-opportunity` (`lib/mcp/tool-router.cjs:1000-1021` -> `opportunity-ops.cjs::fileOpportunity:630-685`) **only for funding or grant signals**. Its schema is funder/program/amount/deadline, and it writes `status: filed` with no graph node (Pitfall 10).
- **Roll-up:** `reasoning-ops.mergeReasoningFrontmatter(roomDir, section, {confidence, verification})` on the originating section. MINTO.md is generated by `scripts/vault-section-minto-generator.cjs` / `scripts/feynman-minto-guardian.cjs`, so let the generator pick the change up rather than hand-editing MINTO.md (SEED-097: generated files are not hand-edited).

### Pattern 9: Theo structure as a shipped ledger plus live refresh (DRP363-12, D-09)

`scripts/build-research-shape-ledger.cjs` runs at dev time, the same pattern as `build-framework-command-ledger.cjs` and `build-section-command-ledger.cjs`. It makes anchored reads through `brain-client.query` with handles as parameters:
- R1: `MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(p) WHERE p.id = $pt RETURN f.name` for each of `UnDefined, IllDefined, WellDefined, Wicked`
- R2: `MATCH (f:Framework {name:$n})-[:FEEDS_INTO]->(g:Framework) RETURN g.name` for each framework in the D-02 and D-09 sets
- R3: `MATCH (f:Framework {name:$n})-[:HAS_PROCESS_STEP]->(s) RETURN s.order AS ord, s.name AS step` (sort locally; ORDER BY is untested)

It writes `data/research-shape-ledger.json` with `built_at`, `theo_frameworks`, per-framework `problem_types`, `feeds_into` and `steps`, and `--check` for drift. At run time `structure.cjs` reads the ledger. A live refresh is optional, and the plan records `structure.source: theo_live | theo_ledger | local_template` plus a reason, the same honesty 361's `theo-structure.cjs` shows. Use plain anchored `MATCH` only. `OPTIONAL MATCH` was reported rejected once and accepted once (Pitfall 6), and the build must not depend on it.

Live results today [VERIFIED: brain-client.query, env key, 2026-09-29]:
- Logic Trees (Issue, Hypothesis, Decision) steps, in order:
  1. "Choose tree type based on problem"
  2. "Apply MECE principle at each level"
  3. "Break down until actionable"
  4. "Prioritize branches by impact"
  5. "Prune low-value branches"
- Each step's `description` equals its name (thin content).
- Logic Trees has **no** ADDRESSES_PROBLEM_TYPE edge and **no** outgoing FEEDS_INTO. It is fed by Theory of Change.
- Scientific Roadmapping steps: Tension Qualification, Goal Quantification, Rung Placement and Type Selection, Forum Construction, Path Enumeration, Constraint Interrogation, Catalytic Ranking.
- Root Cause Analysis: WellDefined; FEEDS_INTO Systems Thinking and Problem Definition Transformation Framework; 0 steps.
- Hypothesis-Driven Problem Solving: WellDefined.
- Six Thinking Hats: IllDefined, Wicked.
- The Pyramid Principle: WellDefined.
- Knowns and Unknowns Matrix: FEEDS_INTO Cynefin Framework.

**How Logic Trees steps drive pyramid construction for scientific questions (D-09):**

| Logic Trees step | What the planner does (all local) |
|------------------|-----------------------------------|
| 1. Choose tree type based on problem | `tree_type` = `issue` (a "why" or "what" question; root-cause origin uses `issue-tree.normalizeKeyQuestion`), `hypothesis` (rung WellDefined, or HDPS in the sequence), or `decision` (a decision-gate origin). Store it in `pyramid.tree_type` |
| 2. Apply MECE principle at each level | `validateMECE` at every level, plus the coverage dimensions (Pattern 2) |
| 3. Break down until actionable | A leaf is done when it has a query family, a falsifier and a corpus, or when it is marked `not_researchable` with a reason. Depth cap is 3 levels `[ASSUMED]` |
| 4. Prioritize branches by impact | Order lanes by weakest support first, then by navigator priority on the F.6 card. Budget goes to the top `resolveFanoutCap` branches |
| 5. Prune low-value branches | F.6 "drop" edits. Each drop is recorded with a reason (Rejection is data: a REJECTED_BECAUSE edge on filing), and revisions are capped at 3 (gpt-researcher `max_plan_revisions`) |

Frameworks with zero steps (HDPS, Scientific Method, Adversarial Research Protocol, Root Cause Analysis) contribute only their position in the sequence. The ledger build logs them as `theo_gap` rows for the Theo companion work.

**Detecting "scientific" locally (no egress, no keyword classifier)** `[ASSUMED policy, needs navigator confirmation]`. Scientific = S1 or S2 or S5. S3 and S4 shape the tree but do not flip the flag on their own.

| Signal | Source | Counts toward scientific |
|--------|--------|--------------------------|
| S1 | The originating framework or command maps (via `frameworksForCommand`) into the ledger's scientific set (Scientific Roadmapping, Logic Trees, HDPS, Scientific Method, Adversarial Research Protocol, Research Validation and Early Business Framing) | yes |
| S2 | USER.md `canonical_role` is `researcher` or `researcher_ind`, or `role_blend` is researcher-dominant (`publish-needs-default-lane.cjs:48-58`) | yes |
| S3 | `resolveRoomRung` = `WellDefined` | no, sets `tree_type: hypothesis` |
| S4 | A leaf targets an academic corpus | no, only shapes the tree |
| S5 | The navigator toggles "treat as scientific research" on the F.6 card | yes |

Never classify the user's text. AMB-07 forbids the keyword classifier `brain-client._inferRungFromQuestion`.

**Next framework from the weakest branch (D-08 across):**
1. Find the branch with the lowest support (`contradicted`, `unresolved` or empty).
2. Take its lens framework and read the ledger's `feeds_into` list.
3. Filter that list by `problem_types` containing the room rung.
4. Map to a command with `commandsForFramework`.
5. Offer the result as the one next move.

If nothing maps, say so honestly. Do not invent a chain (`brain_ask` refuses chain asks).

### Pattern 10: Command research-planner mode is a thin section plus a question-set contract (DRP363-13)

Each first-wave command gains a `### Research planner` section after its existing flow. Leave the existing "Quick pass or deep dive?" line, Setup, and When Complete byte-identical (the DDR361-13 byte-preservation precedent; see Pitfall 4 on wording).

The section tells Larry to do four things:
1. Write `<scratch>/question-set.json` from the framework's own output, using the command's template: key line, leaves, origin, lens, falsifier, and `not_researchable` reasons.
2. Run `research-planner.cjs plan <question-set.json>`.
3. Show the returned card: F.0 for quick under no grant, the quick run itself when a standing grant covers it, or F.6 for deep.
4. Hand off to `/mos:research`'s plan-run section. The command itself fetches nothing and dispatches nothing.

So the D-02 commands need **no** `web_scope` change, **no** `Task` or `Agent` token, and no grant row. Their `hitl_shape` stays as is. The runner surface carries the Form B `hitl_stages`. The first wave is:
- **map-unknowns**: the D-06 minimum. The quadrant matrix is the purest D-00 question source.
- **root-cause**: the why-chain maps one-to-one onto `issue-tree.cjs` nodes and tests.
- **whitespace**: the origin of the D-06 slice.

think-hats is the best second-wave addition (a hat per deep lane maps directly). find-bottlenecks, scenario-plan, trending-to-absurd, beautiful-question, challenge-assumptions and explore-futures get template stubs only, or wait for a follow-on.

### Pattern 11: One runner surface, two doors (DRP363-14)

- **CLI:** `/mos:research` gains a plan-run mode (`/mos:research --plan <run_id>`). Its existing topic mode and URL mode stay unchanged. Its declaration moves from `hitl_shape: F.8` to Form B:
  ```yaml
  hitl_stages:
    - { stage: "deep plan review", shapes: ["F.6"], mode: "gate" }
    - { stage: "deep extend budget", shapes: ["F.3"], mode: "gate" }
    - { stage: "quick policy grant", shapes: ["F.0"], mode: "gate" }
    - { stage: "filing", shapes: ["F.8"], mode: "parallel" }
  ```
  The auto-dispatch rule at `commands/research.md:92-96` is amended per D-05. It already declares `Agent` (granted), `plan_gated: true`, and `web_scope: green`.
- **MCP:** a new `lib/mcp/tools/research.cjs` registers `research_run`, with `op` in `plan | run_quick | grant_status | grant_revoke | file`. It uses zod input schemas and returns cards through `gate-render.cjs::renderGate`. Deep execution returns an honest "the deep run executes in Claude Code; this plan is saved at research/<slug> and can be approved here" (the dominant-designs tri-polar precedent). Its `connectors` export declares `hitl_shape: 'F.6'`. Confirm whether MCP tool descriptors accept `hitl_stages`: `check-shape-declaration.cjs:187-322` handles `hitl_stages` generically, but no MCP tool uses it today.
- **Agent (deep, CLI only):** `agents/research-lane-analyst.md` has `tools: [Read]`, mirrored in `allowed-tools`, and `connector.excluded: true` plus a reason. Its input is a path to the lane's fetched-records JSON, the leaf question, and the falsifier. Its output is rows JSON. It can never fetch, write or reach Brain, and the host enforces that through `tools:` (361 Pitfall 1). Part 7 justification: no Read-only analyst exists. `dominant-design-researcher` has web tools and is locked to its lanes, and `agents/research.md` composes its own queries and has Brain tools.

### Pattern 12: Ambient quick runs ride the 355.1 child (DRP363-15)

The runtime order inside `runAmbientInChild` (`lib/core/ambient-run.cjs:686+`) is: acquire the lock, `runAmbientComposition`, then the new branch `researchPlanner.ambient.maybeQuick(roomDir, findings, {budgetMs, deps})`. The branch works like this:
1. Read the standing grant. No grant means it composes and writes a plan-only card, with no fetch.
2. Take only `whitespace` findings whose gap spans at least 2 sections. Fewer than 2 means `context_insufficient`, never an invented section (SEED-097 cohort rule).
3. Compose `whitespace-gap/v1`, validate against the grant, check its own throttle in `research-run-ledger.json`, fetch, validate and compute the verdict.
4. Write an **unfiled** evidence card to `.mindrian/research-runs/<run_id>.json`, surfaced once through the ambient card path for that delta hash.
5. Stay inside `AMBIENT_TOTAL_BUDGET_MS` (4 minutes, `ambient-run.cjs:71`).

Deep runs never start here (D-03). The pointer notes go into `commands/scout.md:359` and `commands/scheduled-tasks.md:269`: "grant-covered quick research runs execute in the 355.1 ambient child, never in this runner". The cadence runner itself stays zero-egress. The Stop hook is on CLI, and `stop_gate_check` -> `closeOutRoom` is on Desktop and Cowork (355.1 AMB-06), so the ambient quick path is tri-polar with no new hook.

### Anti-Patterns to Avoid

- **Model-typed query strings.** Every string comes from `families.cjs`, including follow-ups. A hand-typed edit is recomposed and re-audited, and a refusal has no send-anyway path.
- **Trusting `empty_valid` from the academic path** before the Wave 0 fix (Pitfall 1).
- **Keyword classification of the user's question** for problem type or "scientific". AMB-07 forbids it.
- **A second approval flow per command** or a per-command gate.json. One grant ledger.
- **Writing `held_contradictions` directly** or hand-editing MINTO.md. Use CONTRADICTS edges and the generators.
- **Filing on grant approval.** The grant authorizes fetching only.
- **Letting the deep report become a free essay.** It is the pyramid with row ids, and a statement without a row is phrased as a question or a labeled opinion (the 361 rule, `commands/dominant-designs.md:151`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache-first fetch with typed envelopes | A new cache wrapper | Export `fetchSourceCached` from `lib/lens-engine/source-lens-driver.cjs:263` additively | It already handles cache provenance, read failures and Part 8 `blocked/policy_blocked` typing |
| MECE and falsifier validation | A new tree validator | `lib/core/issue-tree.cjs` | Deterministic, tested (`tests/run-all-164.sh`), and its edge remap is locked to frozen edge types |
| Problem-type classification | A new rung detector | `ambient-framing.cjs::resolveRoomRung` | Non-keyword chain, already ruled (AMB-07) |
| Query audit | A private forbidden list | `auditQueryString` | One fence (Phase 196). Private copies drift |
| Run home and ROOM.md identity | New `research/` writer | `research-filing.cjs::fileResearchArtifact` | Nested-folder rule, atomic write, memory_artifact node |
| Evidence node write | Raw INSERT | `navigation.fileEvidenceWithReadback` | Part 9 plus readback and injection stripping |
| Opportunity node | New store | `navigation.writeOpportunityNode` + `linkOpportunityEvidence` | Proposed-only, append-only stage history |
| MCP approval and resume | A bespoke approval callback | `gate-ledger.cjs` `material_step` + `resumeFn` (the `chain.cjs` pattern) | Single-use and spoof-guarded (T-198-10) |
| Fan-out cap | A new constant | `resolveFanoutCap` | One cap authority |
| Throttle and lock | New lock file logic | `acquireAmbientLock` / `releaseAmbientLock` + the `runs_window` idiom | Stale-lock handling is already right (8 min) |
| Framework-to-command mapping | A lookup table | `commandsForFramework` / `composeWorkflow` | The only governed door (R4) |
| Theo structure at run time | Freeform `brain_ask` | Dev-time anchored reads shipped as data | `brain_ask` refuses chain asks (`freeform_unproven`) |

**Key insight:** every failure mode the surveyed deep-research agents have (model-fired queries, silent stops, flat source lists) is already fenced somewhere in this repo. The planner's job is to route through those fences, not to rebuild them.

## Runtime State Inventory

Included because 363 changes the shape of a shared cache and adds room-local state files that existing rooms will carry.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing rooms' `.mindrian/research-cache/*.json` entries are keyed `source__slug__sha12` (`research-cache.cjs:64-72`) and store only a `results` array: no `meta.count`, no new `select` fields | Version the cache namespace for the new adapter shape (for example source key `openalex@2`), so old entries are never read as carrying counts or quality fields. Code edit, no migration: old entries simply miss |
| Live service config | OpenAlex account and key: none configured on this machine (`OPENALEX_API_KEY` unset; checked) | User or operator setup step, documented. Keyless still works at the demo budget |
| OS-registered state | None. No new hook: the ambient branch rides the existing 355.1 Stop hook and `closeOutRoom` (verified in 355.1 CONTEXT AMB-06) | None |
| Secrets/env vars | New optional `OPENALEX_API_KEY`. Existing `OPENALEX_EMAIL` (default `noreply@mindrian-os.com`, `rs-fetcher-academic.cjs:126`). `TAVILY_API_KEY` unset on this machine | Send the key as an `Authorization: Bearer` header so it never lands in a URL, telemetry `query_text`, cache key or audit ledger (Pitfall 2) |
| Build artifacts | Regenerated `data/command-registry.json`, `data/connector-registry.json`, `data/mcp-tool-connectors.json`, `skills/*/SKILL.md` mirrors, `data/harness-manifest.json` (downstream digest drift, 361-07 precedent) | Regenerate and diff-inspect every hunk. Stage only files with real diffs |
| New room-local state | `.mindrian/research-grants.json`, `.mindrian/research-audit.jsonl`, `.mindrian/research-run-ledger.json`, `.mindrian/research-runs/` | New files. Schema-validate them as plain frozen-object validators, not zod (355.1 rule). A corrupt file quarantines (the `quarantineAmbientLedger` idiom), never crashes |

## Common Pitfalls

### Pitfall 1: A dead OpenAlex looks like a gap in the literature (CRITICAL)
**What goes wrong:** `fetchCorpusEnvelope({source:'openalex'})` returns `status: 'empty_valid'` on HTTP 429 and 500. I reproduced it today with a stubbed `fetch`. Both codes return `{"status":"empty_valid","failure_class":null}`.
**Why:** `rs-fetcher-academic.cjs:555-575` records `rate_limited`/`api_error` in `telemetry` and `continue`s, returning `results: []`. `research-corpus.cjs:201-208` only looks at `results.length === 0` and calls it a live zero-hit finding. Phase 221 converted the Tavily collapse sites but not the academic delegate's internal telemetry (`tests/test-221-envelopes.cjs` B4/C2 cover Tavily only).
**How to avoid:** in `adapterAcademicEnvelope`, read `envelope.telemetry`. If any record is not `ok`, return `failed` with a mapped `failure_class`: `rate_limited`/`api_error` become `http_error` (retryable), `timeout`/`network_error` become `network_timeout`, `api_key_missing` becomes `missing_credential`. The legacy array return is unchanged, so existing callers are unaffected. Add a `budget_exhausted` reason when the 429 carries `X-RateLimit-Remaining-USD: 0`.
**Warning signs:** a gap-confirmed card on a day OpenAlex was down, or on a keyless machine late in the day.

### Pitfall 2: OpenAlex is metered now, and the adapter sends no key
**What goes wrong:** keyless calls get a small daily budget, then 429s.
**Facts:**
- Keys were introduced 2026-02-13 with usage-based pricing [CITED: blog.openalex.org pricing post; groups.google.com openalex-users].
- Search costs $1 per 1,000 calls, list+filter $0.10 per 1,000, singleton lookups are free, and a free key gets $1/day [CITED: blog.openalex.org/openalex-api-new-features-and-usage-based-pricing].
- The key goes as `api_key=` or an `Authorization: Bearer` header. A budget overrun or more than 100 req/s returns 429 [CITED: help.openalex.org/api/authentication].
- Measured today on a keyless call: `x-ratelimit-limit-usd: 0.1`, `x-ratelimit-cost-usd: 0.001`, `meta.cost_usd: 0.001` [VERIFIED: live curl 2026-09-29].

**How to avoid:** optional `OPENALEX_API_KEY` sent as a Bearer header. Read `X-RateLimit-Remaining-USD` into the envelope so budget stops are honest. Keep the `mailto`. Disclose the budget in the floor ledger. Derived only, not measured: with the proposed caps a quick run is at most 3 searches (about $0.003) and a deep run at most 16 (about $0.016), so a keyless machine gets roughly 6 deep runs a day **if** the $0.10 budget is per client IP. That scoping is `[ASSUMED]`.

### Pitfall 3: `search=` is full-text, stemmed and implicitly ANDed, so raw counts mislead
**What goes wrong:** the live call for `search=dominant design` came back with `x_query.oql: "works where full text has (dominant design)"` and `count: 3399047` [VERIFIED: live 2026-09-29]. An unquoted term count is not a gap signal.
**How to avoid:** exact-phrase templates in double quotes. Boolean operators must be uppercase `AND`/`OR`/`NOT` [CITED: help.openalex.org/api/searching/]. The `filter=...search:` form is "no longer recommended" [CITED: same]. Consider `search.semantic` (exists [CITED: same]; price unverified) as a later falsifier lane for "covered under another term". Record the translated `x_query` on the audit record.

### Pitfall 4: "Quick pass or deep dive?" already means something else
**What goes wrong:** 23 command files ask "Quick pass or deep dive?" as a session-depth question (`grep -l` count today), and the three first-wave commands all do (`map-unknowns.md:67`, `root-cause.md:68`, whitespace uses subcommands). Reusing "quick"/"deep" for research runs collides in UI text and in tests that pin those lines.
**How to avoid:** name the research modes on cards as "quick research run" / "deep research run" and never touch the existing line. Pin the byte-preservation in `test-363-baseline.cjs`.

### Pitfall 5: The typed Theo step seam is empty; `brain_query` access may be operator-only
**What goes wrong:** `callTool('framework_step', {framework})` returns step ids with `label`, `runIt` and `researchDirective` all null for Logic Trees, Scientific Roadmapping and Scenario Planning for High Uncertainty. Logic Trees also returns an `ALIAS_CYCLE` refusal in `frameworkIdentities` [VERIFIED: live 2026-09-29]. 361's `theo-structure.cjs` "runnable step" test would classify all of them as `no_steps_in_canon`.
**Second risk:** today's anchored reads used an env key (`resolveBrainKey().source === 'env'`, likely the operator key). Pre-Theo docs recorded raw Cypher as admin-gated (`docs/CANON-RECALIBRATION-PROPOSAL.md:16`). Ordinary-install `brain_query` access on Theo is unverified.
**How to avoid:** build the structure ledger at dev time and ship it (Pattern 9). A live refresh is best-effort with a named `structure.source`.

### Pitfall 6: The egress guard marks anchored reads "ambiguous" and proceeds
**What goes wrong:** every anchored `brain_query` today came back with `egress_disclosure: {verdict:'ambiguous', egress_class:'freeform_unproven', disposition:'proceeded'}` [VERIFIED]. A test that asserts `allow` will fail. Also, `lib/core/part8-egress-guard.test.cjs` PB8-03 is a known pre-existing failure (`actual 'ambiguous'`, 361-07-SUMMARY).
**How to avoid:** assert "handles only in args" and `disposition !== 'blocked'`, never `verdict === 'allow'`. Classify the PB8-03 leg as pre-existing in the aggregator's notes. Do not "fix" it in 363 (peer 361-09 owns `part8-egress-guard.cjs`).
**Note:** the 363-RESEARCH-pws note found `OPTIONAL MATCH` rejected, while the coordinator saw it accepted. Use plain `MATCH` only.

### Pitfall 7: The Part 8 audit is a PII and financial blocklist, not a confidentiality check
**What goes wrong:** FORBIDDEN_PATTERNS (`cross-room-aggregator.cjs:92-120`) catch emails, currency, phone numbers, names with degrees, "Corp/Inc" names, a small gazetteer and meeting phrases. An unpublished compound code, an internal project name or a confidential mechanism term passes. Under a standing grant, ambient runs would send such slot values without the navigator ever seeing that exact string.
**How to avoid (recommended hardening, Open Question 1):** a slot-novelty rule. A standing grant covers template families, and the **first** time a new slot value would egress in a room, the run composes and offers a card instead of fetching. Once approved, the value joins the grant's `approved_slots`, so ambient runs only recombine strings a human has seen. This fits D-04's "must ask again" list as a stricter reading of "outside a family", but it needs navigator confirmation. The inverse risk: the audit also rejects some legitimate terms (`\b\d+(?:\.\d+)?[KMB]\b`, `percent`). Report such refusals as `local-only` with the template id, never with the string.

### Pitfall 8: The cache cannot answer the whitespace question
**What goes wrong:** `putCached` stores only `results`, so `meta.count` is lost, and the cache key ignores the adapter's `select` shape. A warm cache would feed the verdict a record list with no count and no quality fields.
**How to avoid:** cache the full normalized envelope (results, count, cost, x_query) under a versioned source key (Runtime State Inventory). The verdict requires `count` to be present, and a missing count is `unresolved`, never gap-confirmed.

### Pitfall 9: An ungated research egress already exists; do not route through it
`scripts/query-semantic-scholar.cjs` (`/mos:whitespace external`) builds queries from room artifact titles (`extractRoomKeywords`, `:86-210`). It calls no `auditQueryString`, has no approval, and keeps its own cache (`external-corpus-cache.json`). The 363 whitespace family must not reuse it. Flag it for a follow-on gate (out of scope; see Open Question 6). Do not silently fix it inside 363 (a scope and shared-tree risk).

### Pitfall 10: `file-opportunity` is a funding form, not a research opportunity writer
`opportunity-ops.cjs::fileOpportunity` (`:630-685`) writes funder, program, amount and deadline frontmatter with `status: filed`, and no graph node. Research-scooped opportunities (a gap, a transfer, a trend break) go through `writeOpportunityNode` (proposed) plus a markdown card. Only a funding or grant signal uses `file-opportunity`.

### Pitfall 11: `held_contradictions` has no Part 9 door
The table exists only as schema in `memory-ops.cjs:103-111` (plus a read in `scripts/memory-lifecycle.cjs:382`). Nothing in `navigation.cjs` writes it. D-08 names it, so see Open Question 4. The recommendation is CONTRADICTS edges.

### Pitfall 12: One EvidenceClaim per URL per session
`writeEvidenceClaim` ids are `EvidenceClaim:<sid>:<urlHash>` (`evidence-claim.cjs:159-167`). Two leaves citing the same paper in one session collapse into one node (361's documented Pitfall 3). Attach each leaf with its own SUPPORTS or CONTRADICTS edge rather than expecting per-leaf nodes, and make the per-run session id unique (`research:<run_id>`).

### Pitfall 13: MCP gate ids evaporate on restart
Gate ids are minted in-process and single-use. A grant approved on Desktop must be written to `.mindrian/research-grants.json` inside the `resumeFn`, or it is gone after the next server restart.

### Pitfall 14: A new MCP tool moves three pinned tests
- `tests/test-270-tool-schema-budget.cjs` records a measured AFTER on every tool-count change. The recorded protocol is to re-baseline deliberately with the percentage in the commit message (276-12, 358-05, 358-10 precedents).
- `tests/test-234-tool-description-floor.cjs` requires honest descriptions of at least 120 characters.
- `tests/test-198-contract-schema.test.cjs` enumerates the tool contract.

Plan the re-baseline as an explicit task.

### Pitfall 15: Registry regeneration drags the harness manifest
Regenerating `data/command-registry.json` or `data/connector-registry.json` makes `data/harness-manifest.json` stale, and the pre-commit hook fails closed. In 361-07 a direct Bash write of the manifest was denied by the auto-mode classifier. The workaround was: compute with the exported `buildManifest`/`serializeManifest`, diff, then apply with the Write tool (361-07-SUMMARY deviation 2).

### Pitfall 16: Dispatching subagents from each command costs a grant row each
`tests/test-265-swarm-task-grant.cjs` requires a ratified row in `data/subagent-dispatch-grants.json` for any command pre-approving `Task`/`Agent`. Route deep fan-out through `/mos:research`, which already holds a granted `Agent` row.

### Pitfall 17: "Zero-egress cadence runner" and "ambient child" are different processes
`commands/scout.md:359` and `commands/scheduled-tasks.md:269` state that `scout-cadence-runner.cjs` is Part 8 zero-egress. 355.1 put the stamped run in the Phase 117 fire child precisely because the cadence runner cannot egress (355.1 CONTEXT). The research quick run belongs in the ambient child. The two docs get a pointer, not a rule change.

### Pitfall 18: The ambient ledger schema is exact-key strict
`scout-cadence-guard.cjs` validates `AMBIENT_LEDGER_KEYS`, `AMBIENT_PRODUCER_IDS` and `AMBIENT_PRODUCER_OUTCOMES` as frozen sets (`:369-383`) and quarantines a ledger that does not match. Adding a `research` producer id would quarantine every live room's ledger. Use a separate `research-run-ledger.json`.

### Pitfall 19: `validateMECE` is a keyword heuristic
Two siblings sharing two content tokens triggers a warning, and exhaustiveness is only "at least 2 branches" (`issue-tree.cjs:103-130`). Treat warnings as card content for the navigator. Get real exhaustiveness from coverage dimensions (Pattern 2). Never claim "MECE verified" from this check alone.

### Pitfall 20: Literal em-dashes in test files
361-03, 361-04 and 361-07 all self-caught literal U+2014 and U+2013 characters in their own test sources (the assertion strings). Write the JavaScript unicode escapes (backslash, then `u2014` or `u2013`) in tests, never the literal characters, and keep the aggregator's em-dash guard.

### Pitfall 21: Shared tree with 361-09 and 361-10
Peers own `lib/core/dominant-design/theo-structure.cjs`, `lib/core/part8-egress-guard.cjs` (case_story arm) and `tests/test-361-*` (commit cb978ae52). Schedule any generalization of dominant-design modules after those land, and re-read files before editing (memory: two-session tree collision).

### Pitfall 22: The whitespace producer depends on a Python ML pipeline
`whitespace-results.json` comes from `scripts/compute-whitespace-gaps.py` (numpy, scikit-learn, sentence-transformers). Acceptance fixtures must **freeze** a `whitespace-results.json` with a gap that spans 2 sections, and must not run the Python pipeline in tests.

## Code Examples

### 1. Plan object (the pyramid) - proposed schema

```json
{
  "schema": "mos.research-plan/1",
  "run_id": "rp-2026-09-29-3f2a91c0",
  "mode": "quick",
  "origin": { "command": "/mos:whitespace", "framework": "HSI Semantic Surprise Analysis Assistant",
              "card_or_node_id": "whitespace-zone:...", "section": "opportunity-bank" },
  "context": { "rung": "IllDefined", "rung_source": "jtbd_goal",
               "scientific": { "is": true, "signals": ["S2:user_role:researcher"] },
               "cohort": { "sections": ["problem-definition", "market-analysis"], "node_ids": ["..."] } },
  "structure": { "source": "theo_ledger", "reason": "ledger built 2026-09-29; live refresh not requested",
                 "tree_type": "issue", "frameworks": ["Logic Trees (Issue, Hypothesis, Decision)"] },
  "pyramid": {
    "scqa": { "situation": "...", "complication": "...", "question": "...", "answer_hypothesis": "..." },
    "governing_question": "Is <gap> absent from the literature or only from this room?",
    "key_line": [ { "id": "K1", "label": "...", "dimension": "ws:gap_claim", "leaf_ids": ["L1"] },
                  { "id": "K2", "label": "...", "dimension": "ws:covered_elsewhere", "leaf_ids": ["L2"] } ],
    "coverage": { "dimensions": ["ws:gap_claim", "ws:covered_elsewhere", "ws:irrelevant", "ws:extraction_failure"],
                  "uncovered": [], "not_researchable": [{ "dimension": "ws:irrelevant", "reason": "navigator judgment" }] },
    "mece": { "warnings": [], "falsifiability": [], "passes": true }
  },
  "leaves": [ { "id": "L1", "parent": "K1", "question": "(LOCAL prose)", "origin": "framework_dimension",
                "lens": "ws.exact", "source_command": "/mos:whitespace", "researchable": true,
                "falsifier": { "text": "covered under another term", "template_id": "ws.synonym_cover" },
                "corpus": "openalex",
                "queries": [ { "template_id": "ws.exact", "q": "\"...\"", "q_hash": "sha256:...", "audit": "pass", "role": "primary" } ],
                "status": "open" } ],
  "budget": { "breadth": 1, "rounds": 1, "queries_per_round": 3, "results_per_query": 5, "max_searches": 3, "counterevidence": true },
  "stop_rules": ["cap", "budget", "plurality_required"],
  "grant_ref": { "grant_id": "g-...", "version": 1, "lifetime": "standing" },
  "revision": 0, "max_revisions": 3,
  "return_target": { "card_id": "...", "section": "opportunity-bank" },
  "plan_hash": "sha256:..."
}
```

### 2. Family composer (clone of the lane-queries shape)

```javascript
// Source: lib/core/dominant-design/lane-queries.cjs:114-167 (shape), lib/core/rs-egress-prompts.cjs:52 (fence)
const crypto = require('node:crypto');
const { auditQueryString } = require('../rs-egress-prompts.cjs');
const SURFACE = 'research-planner';
function qHash(q) { return 'sha256:' + crypto.createHash('sha256').update(q, 'utf8').digest('hex'); }
function composeFamily(familyId, slots, opts) {
  const fam = FAMILIES[familyId];                       // frozen table, e.g. 'whitespace-gap/v1'
  if (!fam) return { ok: false, degrade: 'local-only', reason: 'unknown_family' };
  const out = [];
  for (const t of fam.templates) {
    const q = t.render(slots);                           // quotes and OR-groups built here, never by the model
    if (typeof q !== 'string' || /[\r\n]/.test(q) || q.length > MAX_QUERY_CHARS) {
      return { ok: false, degrade: 'local-only', reason: 'bad_query', template_id: t.id };
    }
    try { (opts && opts.auditFn || auditQueryString)(q, SURFACE); }
    catch (_e) { return { ok: false, degrade: 'local-only', reason: 'egress_violation', template_id: t.id }; } // never echo q
    out.push({ template_id: t.id, role: t.role, q: q, q_hash: qHash(q), audit: 'pass' });
  }
  return { ok: true, family: familyId, queries: out };
}
```

### 3. Academic envelope honesty fix (the Wave 0 must-have)

```javascript
// Source: lib/core/research-corpus.cjs:181-216 (adapterAcademicEnvelope); telemetry shape rs-fetcher-academic.cjs:505-605
const bad = (envelope.telemetry || []).find(function (t) { return t && t.status !== 'ok'; });
if (bad) {
  const cls = (bad.status === 'timeout' || bad.status === 'network_error') ? 'network_timeout'
    : (bad.status === 'api_key_missing') ? 'missing_credential' : 'http_error';
  return retrievalEnvelope(source, { status: 'failed', failure_class: cls,
    retryable: cls !== 'missing_credential', error: 'academic_' + bad.status + (bad.http_status ? '_' + bad.http_status : ''),
    input: query });
}
// only then: results.length === 0 -> empty_valid (a live, successful zero-hit)
```

### 4. Grant record and the executed-query check

```json
{ "grant_id": "g-3c9e", "version": 1, "lifetime": "standing", "policy_version": "drp363-grant/1",
  "room_id": "<room slug>", "providers": ["openalex"], "fallback": null,
  "families": ["whitespace-gap/v1"], "approved_slots": ["..."],
  "caps": { "queries_per_run": 3, "results_per_query": 5 }, "throttle": { "runs_per_hour": 1 },
  "approved_at": "2026-09-29T10:00:00.000Z", "approved_via": { "surface": "cli", "decision_node_id": "decision:gate:..." },
  "expires_at": "2026-10-29T10:00:00.000Z", "revoked_at": null }
```

```javascript
// validateExecutedQuery -> { ok } | { ok:false, reask } ; reasons mirror D-04 exactly
if (!grant) return { ok: false, reask: 'no_grant' };
if (grant.revoked_at) return { ok: false, reask: 'grant_revoked' };
if (Date.parse(grant.expires_at) <= now) return { ok: false, reask: 'grant_expired' };
if (grant.policy_version !== CURRENT_POLICY) return { ok: false, reask: 'grant_reversioned' };
if (grant.providers.indexOf(q.provider) === -1) return { ok: false, reask: 'provider_not_in_policy' };
if (grant.families.indexOf(q.family) === -1) return { ok: false, reask: 'outside_family' };
// run grants: round-one strings must match the approved hash set exactly (the 361 query_mismatch rule)
if (grant.lifetime === 'run' && q.round === 1 && grant.approved_hashes.indexOf(q.q_hash) === -1) return { ok: false, reask: 'hash_not_approved' };
```

### 5. Anchored Theo read (dev-time ledger build; handles only)

```javascript
// Source: verified live 2026-09-29 via lib/core/brain-client.cjs query(); plain MATCH, params bound
const r = await brainClient.query(
  'MATCH (f:Framework {name: $n})-[:HAS_PROCESS_STEP]->(s) RETURN s.order AS ord, s.name AS step',
  { n: 'Logic Trees (Issue, Hypothesis, Decision)' });
// r.rows -> 5 rows, ord 1..5; r.egress_disclosure.verdict === 'ambiguous', disposition 'proceeded'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAlex keyless polite pool (`mailto`) | Keys plus usage-based budgets. Keyless is a demo budget (measured $0.10/day); a free key gives $1/day | 2026-02-13 (keys) / blog 2026-02-24 | The adapter and `data/research-sources.json` note ("No API key") are out of date |
| `filter=title_and_abstract.search:` | `search=` with boolean, quotes, `search.exact`, `search.semantic` | OpenAlex help, updated 2026-09-19 | Templates use `search=` with quoted phrases |
| Deep-research agents compose and fire their own queries | Plan review plus exact-string or family approval (Gemini "Edit plan", ChatGPT plan review; MindrianOS goes further with audited strings) | 2024-2026 (see 363-RESEARCH-approval.md) | D-04 grant model |
| `open_deep_research` as a reference implementation | Archived (GitHub `archived: true`) | 2026 (363-RESEARCH-oss.md) | Borrow ideas only |

**Deprecated/outdated in this repo:**
- `data/research-sources.json` openalex note "No API key. OpenAlex polite pool via OPENALEX_EMAIL": update it to name the optional key and the budget.
- `rs-fetcher-academic.cjs:130` `select` lacks `is_retracted`, `cited_by_count`, `primary_location`, `type`. Those fields exist (verified live), so journal-quality and retraction flags are feasible in 363 (Claude's Discretion item). I recommend `is_retracted` (drop or flag retracted works) and `primary_location.source.is_in_doaj` + `display_name` (shown, never scored) in 363. Defer predatory-journal lists (DOAJ/Stop Predatory Journals data vendoring) to a follow-on.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proposed caps: quick 3 queries / 5 rows / 1 corpus; deep 4 lanes / 2 rounds / halving / 1 counterevidence pass / 16 searches max | Patterns 5, 7 | Runs too thin or too costly. Mitigated because every value is a floor-ledger row with measured latency and yield at phase close |
| A2 | Verdict rules and floors (gap-confirmed needs count at or below floor on primary and synonym queries plus plurality) | Pattern 5 | Wrong verdicts. The floor value is disclosed, not calibrated (D-19 precedent) |
| A3 | Whitespace family template wording (`ws.exact`, `ws.synonym_cover`, `ws.prior_attempts`, `ws.absence_reason`) | Pattern 3 | Low recall. Tune on replay fixtures |
| A4 | The keyless OpenAlex budget is scoped per client IP | Pitfall 2 | Many users behind one NAT share $0.10/day |
| A5 | "Scientific" detection rule (S1 or S2 or S5) | Pattern 9 | Over- or under-routing to the Logic Trees structure |
| A6 | Standing-grant expiry default 30 days (mirrors the research-cache TTL) | Code Example 4 | Grants linger or nag. Needs a navigator ruling |
| A7 | The slot-novelty rule for standing grants | Pitfall 7 | Without it, confidential slot values can egress unseen. With it, the first ambient run on a new gap needs one card |
| A8 | Deep execution on Desktop and Cowork degrades to "runs in Claude Code" in 363 | Pattern 11 | Tri-polar gap on deep runs. A sequential in-session deep path is feasible later, because fetch is in-process |
| A9 | Pyramid depth cap 3, plan revision cap 3 | Pattern 9 | Overly shallow or unbounded editing |
| A10 | `research-lane-analyst` as a new Read-only agent is the right unit for deep analysis | Pattern 11 | If context budget allows, the main session could analyze sequentially instead, with no new agent |
| A11 | Ordinary-install `brain_query` may be refused on Theo | Pitfall 5 | If it is allowed, live refresh can be the default. The ledger still gives replayability |

## Open Questions (need navigator rulings; each has a proposed default)

1. **Standing-grant slot values (Pitfall 7).**
   - Known: D-04 binds families by template id. The Part 8 audit is a blocklist.
   - Unclear: whether a never-seen slot value under a family may egress ambiently.
   - Recommendation: the slot-novelty rule (first use of a new slot value asks once; then `approved_slots`). One `checkpoint:decision` in the grant plan.
   - Default until ruled: plan 363-06 (grants) ships the slot-novelty gate ON, as the safer reading of D-04, and carries the `checkpoint:decision`.
2. **Grant expiry and throttle values.**
   - Recommendation: 30-day expiry and 1 ambient quick run per room per hour (reuse the 355.1 value). Record both in the floor ledger. Re-measure after the acceptance runs.
   - Default until ruled: plan 363-06 records both as disclosed floor-ledger rows; plan 363-14 re-measures and updates them.
3. **Where the run home lives.**
   - Known: `research/` is **not** one of the 11 canonical sections (`room-skeleton-scaffold.cjs:68-79`, `section-registry.cjs:17-29`). It is an established top-level directory written by `fileResearchArtifact` and url-ingest, and it is detected by `user-archetype.cjs:163`.
   - Recommendation: reuse top-level `research/<dated-slug>/` (no new bucket, the Phase 219 D-16 contract), and link to the originating section via `MAPS_TO_SECTION` / `INFORMS` edges.
   - Default until ruled: top-level `research/<dated-slug>/` through `fileResearchArtifact`. Plan 363-09 (filing) carries the icm-architect consult (a SEED-097 mandatory consult) as a named task and adjusts before filing lands if the consult rules otherwise.
4. **`held_contradictions` versus CONTRADICTS edges (D-08 names the table).**
   - Recommendation: CONTRADICTS edges through `writeEdge`, and do not write the table. If the navigator wants the table populated, it needs a navigation writer first (Part 9), which is its own small task.
   - Default until ruled: CONTRADICTS edges through `navigation.writeEdge` only (plan 363-09). Navigator confirmation of this reading of D-08 is a checkpoint item in 363-09.
5. **Does the MCP `connectors` descriptor accept `hitl_stages`?**
   - Recommendation: declare `hitl_shape: 'F.6'` on the tool and put Form B on the `/mos:research` command. Verify with `check-shape-declaration.cjs --check` in the MCP plan.
   - Default until verified: the tool declares `hitl_shape: 'F.6'` and Form B `hitl_stages` go on `/mos:research`; plan 363-11 verifies with `scripts/check-shape-declaration.cjs --check`.
6. **The ungated Semantic Scholar egress (Pitfall 9).**
   - Recommendation: record it as a finding (RCA-template entry or seed) for a follow-on, and keep it out of 363's scope.
   - Default until ruled: out of 363 scope. Plan 363-15 records it as a follow-on finding (an RCA-template entry or a seed); 363 never routes through it.
7. **Opportunity-scanner path for funding signals (D-07).**
   - Known: `room_content file-opportunity` is the concrete writer.
   - Recommendation: confirm during planning whether `mos:opportunity-scanner` (an agent) is invoked or only named.
   - Default until ruled: funding and grant signals use `room_content file-opportunity`; research opportunities use `navigation.writeOpportunityNode` (plan 363-09). `mos:opportunity-scanner` is named, not invoked, in 363.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Engine, tests (`node:sqlite` timeout needs >=22.16) | yes | v22.23.1 | - |
| Python 3 | Only the existing whitespace pipeline (not run by 363 tests) | yes | 3.12.3 | Frozen `whitespace-results.json` fixtures |
| OpenAlex API (network) | Live smoke, real runs | yes (keyless, measured) | budget $0.10/day keyless | Replay fixtures, exit 77 on ENV GAP |
| `OPENALEX_API_KEY` | Production budget | no (unset) | - | Keyless demo budget, disclosed |
| `TAVILY_API_KEY` | Web lanes (not in the first grant scope) | no (unset) | - | Web lanes are not part of 363's first slice |
| Theo via `brain-client` | Ledger build, optional live refresh | yes (env key) | live 2026-09-29 | Shipped ledger, `tests/helpers/theo-replay-355.cjs` pattern |
| `slopcheck` | Package audit | yes | - | Not needed (no new packages) |

**Missing dependencies with no fallback:** none block execution.
**Missing dependencies with fallback:** `OPENALEX_API_KEY` (keyless budget), `TAVILY_API_KEY` (out of first scope).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain `node:assert/strict` scripts, exit 0 PASS / 1 FAIL / 77 ENV GAP (house convention, e.g. `tests/test-361-filing.cjs`) |
| Config file | none. Aggregator `tests/run-all-363.sh` is written ONCE in Wave 0, modeled on `tests/run-all-361.sh` (run / run_if / counters / em-dash guard / CIRS plan leg) |
| Quick run command | `node tests/test-363-<area>.cjs` (each under 30 s, offline, `globalThis.fetch` replaced by a thrower or replay) |
| Full suite command | `bash tests/run-all-363.sh` |

Hygiene for every 363 test (the 361 house rules):
- replace `globalThis.fetch` with a thrower, or with the OpenAlex replay helper (recorded bodies plus headers, including 429, 500, timeout, `meta.count`, and cost headers)
- spawn children with `NODE_OPTIONS=--require <fetch-thrower-preload>`
- create fixture rooms under `mkdtemp` only, seeded through navigation (`tests/helpers/fixture-room-3551.cjs` pattern)
- plant a `MARKER_PREFIX` in room prose for the Part 8 sweep
- write the backslash-`u2014` escape in test sources, never the literal dash character

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRP363-01 | Plan schema validates. `plan_hash` is stable, and changes on any leaf edit. Revision cap | unit | `node tests/test-363-plan-schema.cjs` | no, Wave 0 |
| DRP363-02 | Coverage dims per template. D-00 gate fails an all-`user_stated` plan. MECE and falsifier warnings surfaced | unit | `node tests/test-363-pyramid.cjs` | no, Wave 0 |
| DRP363-03 | Compose, audit, no echo on refusal, q_hash, quoting and OR-group rendering | unit | `node tests/test-363-families.cjs` | no, Wave 0 |
| DRP363-04 | Every D-04 re-ask reason. Standing vs run. Expiry, revoke, version. Persistence across a simulated restart | unit | `node tests/test-363-grants.cjs` | no, Wave 0 |
| DRP363-05 | Audit record has every D-04 field. Append-only. Never contains room markers beyond approved q | unit | `node tests/test-363-audit-ledger.cjs` | no, Wave 0 |
| DRP363-06 | 429 / 500 / timeout / network are `failed`, never `empty_valid`. `meta.count` carried. Key in header, never in URL, telemetry, cache key or ledger. Versioned cache namespace | unit | `node tests/test-363-corpus-honesty.cjs` | no, Wave 0 |
| DRP363-07 | Quick pass caps. Cache-first. Quote-substring and content-hash validation. Verdict rules, including provider failure -> `unresolved` | unit + replay | `node tests/test-363-run-quick.cjs` | no, Wave 0 |
| DRP363-08 | Deep controller: each stop reason, breadth halving, counterevidence mandatory, F.3 on out-of-family, honest synthesis lists unresolved | unit | `node tests/test-363-run-deep.cjs` | no, Wave 0 |
| DRP363-09 | Thin or contested card carries exactly one escalation offer and seeds the deep plan | unit | `node tests/test-363-run-quick.cjs` (leg) | no, Wave 0 |
| DRP363-10 | Nothing written before yes. Run home via `fileResearchArtifact`. EvidenceClaims proposed. SUPPORTS/CONTRADICTS edges. REASONING roll-up | integration | `node tests/test-363-filing.cjs` | no, Wave 0 |
| DRP363-11 | Opportunity node proposed and linked both ways. `file-opportunity` used only for a funding signal | integration | `node tests/test-363-filing.cjs` (leg) | no, Wave 0 |
| DRP363-12 | Ledger `--check`. Replayed Theo calls carry handles only. D-09 signals. Logic Trees mapping. Next-framework derivation | unit + replay | `node tests/test-363-structure.cjs` | no, Wave 0 |
| DRP363-13 | Command contracts: new section present, existing flow byte-identical, no Task/web_scope change, registry rows | contract | `node tests/test-363-command-contract.cjs` | no, Wave 0 |
| DRP363-14 | `/mos:research` Form B declaration. `research_run` over stdio (gate mint, `resumeFn` writes grant). D-05 doc text | contract + wire | `node tests/test-363-mcp-tool.cjs` | no, Wave 0 |
| DRP363-15 | Ambient: no grant -> plan card, zero fetch. Grant -> one run under lock and throttle. Sections<2 -> `context_insufficient` | integration | `node tests/test-363-ambient.cjs` | no, Wave 0 |
| DRP363-16 | Whitespace slice both modes on the two-section fixture (replay). Live smoke | e2e / smoke | `node tests/test-363-acceptance-whitespace.cjs`; `node tests/test-363-live-smoke.cjs` (77 without network) | no, Wave 0 |
| DRP363-16 | D-06 human rubric on a map-unknowns plan | manual (checkpoint) | rubric file `363-D06-RUBRIC.md` + `checkpoint:human-verify` | no, Wave 0 |
| DRP363-17 | Planted marker absent from argv, logs, cache keys, Theo args, audit ledger (except approved q) | sweep | `node tests/test-363-part8-sweep.cjs` | no, Wave 0 |

Existing legs the aggregator also runs:
- `bash tests/run-all-130.5.sh`, `run-all-131.sh`, `run-all-219.sh`, `run-all-221.sh` (research spine regression)
- `bash tests/run-all-164.sh` (issue-tree)
- `bash tests/run-all-3551.sh` (ambient)
- `bash tests/run-all-361.sh` (dominant-designs)
- `node tests/test-270-tool-schema-budget.cjs`, `node tests/test-234-tool-description-floor.cjs`
- generator `--check`s: command-registry, connector-registry, skill-mirrors, orchestration-projection, harness-manifest
- `node scripts/check-shape-declaration.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-floor-ledger.cjs`
- `node scripts/check-cirs-declaration.cjs --check .planning/phases/363-*/363-*-PLAN.md`
- the em-dash guard

Known pre-existing failures to classify, not fix:
- `lib/core/part8-egress-guard.test.cjs` PB8-03
- `tests/test-209-declared-implies-wired.cjs`

Both are documented in 361-07-SUMMARY. Re-confirm at run time.

### Sampling Rate
- **Per task commit:** the touched area's `node tests/test-363-<area>.cjs` plus any generator `--check` the task affects
- **Per wave merge:** `bash tests/run-all-363.sh`
- **Phase gate:** full suite green (pre-existing failures classified), `node scripts/doctor.cjs --acceptance` unregressed against its baseline, D-06 rubric checkpoint approved

### Wave 0 Gaps
- [ ] `tests/run-all-363.sh`: the aggregator, written once
- [ ] `tests/test-363-baseline.cjs`: byte fixtures for the preserved sections of map-unknowns / root-cause / whitespace / research.md
- [ ] `tests/helpers/fixture-room-363.cjs`: two-section cohort room (room.db via navigation, frozen `whitespace-results.json` whose gap spans `problem-definition` + `market-analysis`, USER.md role variants)
- [ ] `tests/helpers/openalex-replay-363.cjs`: recorded responses keyed by q_hash, with 429/500/timeout sentinels and rate-limit headers (the `theo-replay-355.cjs` sentinel idiom)
- [ ] `tests/fixtures/363-openalex/*.json`: recorded bodies. Capture live once with a key or keyless within budget, from generic phrases only
- [ ] `.planning/phases/363-.../363-D06-RUBRIC.md`: the written human rubric (D-00 criteria: leaves beyond the stated question, framework-grounded, falsifiable, researchable, non-duplicative)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no user auth surface). The OpenAlex key is a service credential | Env var, Bearer header, never logged |
| V3 Session Management | limited | Per-run session ids `research:<run_id>`. MCP session-scoped gate ids |
| V4 Access Control | yes | The grant is the authorization for egress. `validateExecutedQuery` runs before every fetch. Grants are room-scoped |
| V5 Input Validation | yes | Question-set JSON read from a file path (never argv text). Plain validators on ledgers. zod on MCP inputs. `stripInjectionSpans` on web prose. Quote-substring check |
| V6 Cryptography | yes (integrity only) | `node:crypto` sha256 for q_hash, content_hash, plan_hash. Never hand-rolled |
| V7 Error Handling and Logging | yes | Typed envelopes. Audit ledger records valid-empty vs provider-failure. Refusals never echo strings |
| V8 Data Protection | yes (core) | Part 8: room prose never leaves the machine except as an approved, audited query string. Theo gets handles only |
| V10 Malicious Code | yes | Fetched text is data (the agent contract "untrusted content"). The analyst agent has no write, web or Brain tools |

### Known Threat Patterns (Part 8 threat model for 363)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| T-363-01 Room prose leaks through a query slot | Information disclosure | Family composer only; `auditQueryString` per string; slot-novelty rule for standing grants; no free text |
| T-363-02 Room content reaches Theo | Information disclosure | Dev-time ledger with handles only; runtime live refresh sends framework names and problem-type ids only; sweep test on replayed args |
| T-363-03 Provider failure reported as "gap confirmed" | Tampering / Repudiation | Envelope honesty fix (Pitfall 1); verdict puts `unresolved` first; missing count means unresolved |
| T-363-04 The model changes an approved query | Tampering | q_hash match on round one (the 361 `query_mismatch` rule); follow-ups recomposed and validated against the family |
| T-363-05 Fabricated or paraphrased quote | Tampering | Quote-substring check against the stored record plus content_hash recompute |
| T-363-06 Prompt injection in abstracts steers the run | Elevation | Records are data; `stripInjectionSpans` on render; the analyst agent is Read-only; the controller, not the model, decides next steps |
| T-363-07 Ambient run egresses without consent | Elevation | No grant, no fetch. Grant validated per query. Throttle and lock. Deep never ambient |
| T-363-08 Grant spoofing or replay across rooms | Spoofing | Room-scoped grant file; MCP gate ids session-scoped and single-use; the decision node records approval |
| T-363-09 API key leaks into logs, URLs or ledgers | Information disclosure | Bearer header only; sweep test asserts the key is absent everywhere |
| T-363-10 Budget exhaustion (denial of wallet or service) | Denial of service | Caps, throttle, `X-RateLimit-Remaining-USD` budget stop, honest `budget_exhausted` |
| T-363-11 Filing without consent | Elevation | Grant never authorizes filing; F.8 basket; everything lands `proposed` |
| T-363-12 Peer-session drift swept into regenerated registries | Tampering | Diff-inspect every hunk; `--only` commits; sequence after 361-09/10 |

## Wave / Plan Decomposition (proposal for the planner)

Granularity is `fine` and parallelization is on. There are 15 plans across five waves. Each lists its file-disjointness where it runs in parallel.

**Wave 0 - foundations (363-01 first, then 363-02 and 363-03 in parallel)**
- **363-01** Test scaffolding and registration. Contents:
  - `tests/run-all-363.sh`, `test-363-baseline.cjs`
  - `tests/helpers/fixture-room-363.cjs`, `openalex-replay-363.cjs`, the recorded fixtures
  - the D-06 rubric draft
  - DRP363 rows in `REQUIREMENTS.md` (`- [ ]`) and the traceability lines
- **363-02** Corpus honesty and OpenAlex metering (DRP363-06). Files:
  - `research-corpus.cjs` (academic envelope typing)
  - `rs-fetcher-academic.cjs` (Bearer key, `meta.count`, cost and budget headers, additive `select`, limit-honoring `per-page`)
  - cache namespace versioning in `research-cache.cjs` or its caller
  - `data/research-sources.json` note
  - Regression gate: `run-all-130.5/131/219/221` green.
- **363-03** Export `fetchSourceCached` additively from `source-lens-driver.cjs`, with a regression leg. Small, and file-disjoint from 363-02.

**Wave 1 - engine core, pure CJS (four plans in parallel, disjoint files under `lib/core/research-planner/`)**
- **363-04** `plan.cjs` + `question-templates.cjs` + `pyramid.cjs` + `CONTEXT.md` (DRP363-01/02)
- **363-05** `families.cjs` (`whitespace-gap/v1`) (DRP363-03)
- **363-06** `grants.cjs` + `audit-ledger.cjs` + floor-ledger rows (DRP363-04/05). Holds the navigator `checkpoint:decision` on Open Questions 1 and 2.
- **363-07** `scripts/build-research-shape-ledger.cjs` + `data/research-shape-ledger.json` + `structure.cjs` (DRP363-12). Needs live Theo once to build; tests use replay.

**Wave 2 - run engine (363-08 then 363-09; 363-09 depends on 363-08's validators)**
- **363-08** `evidence-rows.cjs` + `verdict.cjs` + `run.cjs` quick executor and deep controller (DRP363-07/08/09)
- **363-09** `filing.cjs` (DRP363-10/11) + the CLI door `scripts/research-planner.cjs` (JSON-file inputs only; subcommands `plan`, `audit-query`, `grant`, `run-quick`, `next-step`, `validate-rows`, `verdict`, `file-run`, `status`)

**Wave 3 - surfaces (363-10 and 363-11 in parallel; 363-12 after both; 363-13 in parallel with 363-12)**
- **363-10** `/mos:research` plan-run mode, Form B `hitl_stages`, D-05 amendment, `agents/research-lane-analyst.md`, registry and skill-mirror regeneration, harness-manifest handling (DRP363-14, CLI half)
- **363-11** `lib/mcp/tools/research.cjs` `research_run` + connectors + test-270 re-baseline + test-234 floor + contract test (DRP363-14, MCP half)
- **363-12** Research-planner sections in map-unknowns, root-cause and whitespace (DRP363-13), with byte-preservation and registry regen. Runs after 363-10 so the handoff target exists.
- **363-13** Ambient branch `ambient.cjs` + the hook call in `ambient-run.cjs` + `research-run-ledger.json` + scout.md / scheduled-tasks.md pointers (DRP363-15). Coordinate with 355.1 file owners, and re-read `ambient-run.cjs` before editing.

**Wave 4 - acceptance and close (363-14 then 363-15)**
- **363-14** Whitespace slice acceptance in both modes (replay), live smoke, Part 8 sweep, floor-ledger measured values (DRP363-16/17). Also the D-06 rubric `checkpoint:human-verify` on a map-unknowns plan.
- **363-15** Phase close:
  - flip DRP363 rows
  - `docs/OPEN-HANDOFFS.md` entry
  - rethinking-mindrianos room mirror
  - `docs/CANON-PHASE-MAP.md` row
  - optional: register the dominant-designs lanes as a template set on the engine, with its 361 suite as the regression net, only if 361-09/10 have landed (D-02a generalization). Otherwise record it as a follow-on.

Critical path: 363-02 -> 363-08 -> 363-09 -> 363-10 -> 363-12 -> 363-14. Every plan that touches `commands/`, `agents/` or `skills/` carries a `cirs_relationship:` block and `11` in `canon_parts`.

## Sources

### Primary (HIGH confidence)
- Repo code read today (file:line cited inline): `lib/core/research-corpus.cjs`, `rs-fetcher-academic.cjs`, `research-cache.cjs`, `rs-egress-prompts.cjs`, `cross-room-aggregator.cjs`, `dominant-design/{lane-queries,evidence-pack,theo-structure}.cjs`, `scripts/dominant-design-research.cjs`, `agents/dominant-design-researcher.md`, `commands/{dominant-designs,research,map-unknowns,root-cause,whitespace,think-hats,find-bottlenecks,scout,scheduled-tasks}.md`, `lib/core/issue-tree.cjs`, `ambient-run.cjs`, `ambient-framing.cjs`, `scripts/scout-cadence-guard.cjs`, `lib/mcp/tools/{gate,chain,sensors,context}.cjs`, `lib/mcp/tool-router.cjs`, `opportunity-ops.cjs`, `navigation.cjs`, `navigation/{edges,evidence-claim,typed-opportunity,reasoning-write,research-preflight}.cjs`, `eureka/research-filing.cjs`, `eureka/online-pattern-query.cjs`, `lens-engine/source-lens-driver.cjs`, `memory-ops.cjs`, `node-insert.cjs`, `reasoning-ops.cjs`, `feynman-minto-invariants.cjs`, `frontmatter-schemas.cjs`, `room-skeleton-scaffold.cjs`, `section-registry.cjs`, `data/{research-sources,floor-ledger,subagent-dispatch-grants,framework-command-ledger}.json`, `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`, `scripts/check-{cirs-declaration,shape-declaration,floor-ledger}.cjs`, `tests/run-all-361.sh`, `tests/test-221-envelopes.cjs`, `tests/test-270-tool-schema-budget.cjs`
- Live checks 2026-09-29:
  - stubbed-fetch reproduction of the 429/500 -> `empty_valid` collapse
  - anchored Theo reads through `lib/core/brain-client.cjs` (Logic Trees and Scientific Roadmapping steps, problem types, FEEDS_INTO; handles only)
  - typed `framework_step` null-label result and `ALIAS_CYCLE`
  - one keyless OpenAlex call (generic phrase) for `meta.count`, fields, cost and rate-limit headers
- Phase docs: `363-CONTEXT.md`, `research/363-RESEARCH-{oss,modes,pws,approval}.md`, `SEED-097`, `355.1-CONTEXT.md`, `361-07-SUMMARY.md`, `361-UAT.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- [OpenAlex Authentication](https://help.openalex.org/api/authentication/): key passing, 429 on budget, 10x budget with key (last updated 2026-08-19)
- [OpenAlex Searching](https://help.openalex.org/api/searching/): boolean, quotes, `search.exact`, `search.semantic`, `.search` filters not recommended, search $1/1k vs list $0.10/1k (updated 2026-09-19)
- [OpenAlex blog: new features and usage-based pricing](https://blog.openalex.org/openalex-api-new-features-and-usage-based-pricing/): prices, $1/day free with key (posted 2026-02-24)
- [openalex-users: API keys required starting Feb 13](https://groups.google.com/g/openalex-users/c/rI1GIAySpVQ)

### Tertiary (LOW confidence)
- [CASRAI news on OpenAlex keys](https://casrai.org/news/openalex-api-keys-mandatory-usage-based-pricing-2026): claims a keyless $0.01/day budget, which contradicts the measured $0.10 header. The measured value is used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every module was read at the cited lines, and no new packages are involved.
- Architecture: HIGH for seams and doors. MEDIUM for the new module split (discretion) and the MCP `hitl_stages` question.
- Pitfalls: HIGH. The critical ones (1, 2, 3, 5) were reproduced or measured live today.
- Numbers and policies: MEDIUM to LOW. All proposed and tagged `[ASSUMED]`, with measurement planned in 363-14.

**Research date:** 2026-09-29
**Valid until:** 2026-10-13 for the OpenAlex terms (pricing moved within 2026) and the Theo seams (companion work may populate steps). 30 days for the repo seams, given peer phases.
