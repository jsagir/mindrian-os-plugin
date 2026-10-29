# MindrianOS Opportunity Portfolio System

**Status:** proposed system design, grounded in the current plugin and the 2026-10-18 review of `research/LATEST`. This is not an implementation claim or an engine-readiness certification.

## Purpose

Let a user build a growing, reviewable portfolio of opportunities from material in multiple MindrianOS rooms, then choose which opportunities deserve deeper research and a real-world test. A room is a bounded work context. The portfolio is the durable cross-room view. A deep dive is a focused investigation opened from a portfolio item.

**User job:** When I have a growing body of room material, technologies, research, and prior findings, I want MindrianOS to scout for commercialization opportunities and potential key breakthroughs, collect them across rooms with their origins intact, and help me decide which ones deserve deeper investigation.

**System outcome:** the user can repeatedly scout their own material and authorized sources, accumulate commercialization and breakthrough candidates across rooms, and move selected candidates to a justified next decision without Jonathan or a developer manually selecting and running the process.

Success means the user can independently:

1. Bring material into rooms and define the commercial or strategic search focus.
2. Run a scout on a room or an explicitly selected portfolio scope; later, opt into automatic re-scans when new material arrives.
3. Receive cross-room candidate commercialization paths and breakthrough signals, each with its source trail and reason for surfacing.
4. See candidates accumulate in a portfolio inbox, then relate, merge, prioritize, park, reject, or open a deep dive.
5. Return later and recover the full decision, evidence, and source trail.

It does not mean maximizing engine count, candidate count, or report length.

## Evidence labels used here

- **Observed implementation:** present in the current local plugin code or docs inspected for this design.
- **Package-reported:** described in `research/LATEST`; offline test counts and claims come from that package review and are not live integration verification.
- **Proposed:** system design that is not yet implemented.
- **Hypothesis:** a causal claim that needs a pilot.

The reviewed package is an R&D source tree. It is not wired wholesale into the current plugin runtime. The package review says no live service integrations or product test suites were run during its consolidation. Its `bono` package is an unreviewed original. Keep that distinct from the currently governed MindrianOS `/mos:bono` workflow.

**Observed current product pieces:** `opportunity-ops.cjs` reads and writes a room-local `opportunity-bank`; `cross-room-aggregator.cjs` proposes relationships between room sections; `cross-room-store.cjs` persists constrained scalar edge metadata; and the research MCP facade routes through the shared planner and approval gates. `test-355-gate-opportunity-promotion.cjs` documents the proposed-to-confirmed opportunity gate. These pieces do not together establish a portfolio-level opportunity lifecycle. The current `/mos:opportunities` prose also describes intelligence-cascade candidates as automatically banked. The new design therefore treats room candidate capture, promotion to the cross-room portfolio, and confirmation as distinct transitions and requires an implementation audit to map existing behavior precisely before changing it.

## 1. System boundary and architecture

### Actors and decisions

| Actor | Responsibility |
|---|---|
| User / navigator | Defines the outcome and scope; authorizes room coverage and outbound research; reviews candidates; makes final dispositions. |
| MindrianOS (MOS) workflow | Clarifies intent, selects the next useful job, explains routing, manages state and gates, and presents the decision-ready result. It must not claim that its orchestration is evidence. |
| Capability modules | Perform bounded work such as finding bottlenecks, candidate connections, structural mappings, or critiques. They return typed proposals and explicit failure states. |
| Research planner and providers | Prepare and run only approved outside queries, record sources and retrieval dates, and return evidence for claims. |
| Human domain reviewer | Reviews specialist-dependent questions, such as clinical, legal/IP, regulatory, market, or technical feasibility. |

The scout may automatically create **unreviewed candidate records** in the portfolio for results from a user-authorized local scope. Human approval is required to validate, advance, publish, commit resources, or make an external claim. This separates automatic accumulation from endorsement.

### Proposed layers

```text
User
  │ goal, portfolio scope, chosen next action
  ▼
MOS Opportunity Portfolio workflow
  intent + scope + routing + approvals + lifecycle + explanation
  │ typed capability requests
  ├────────► local room and portfolio capabilities
  ├────────► reviewed engine modules / isolated workers
  ├────────► shared research planner ── approved query ──► outside providers
  └────────► optional paid Scout service ◄── scoped, permission-checked capsules
  │ typed, evidence-linked results
  ▼
Portfolio registry ◄──── source-room references and room-local dossiers
  │
  └────────► selected deep dive ──► decision / experiment / outcome
```

**Proposed deployment:** start with engine-specific modules behind the existing MindrianOS MCP/runtime boundary and one MOS workflow layer above them. MCP is the capability interface, not the portfolio, policy engine, or autonomous researcher. Do not deploy one MCP server per engine by default. Split a capability into a separate server only when it needs a distinct trust owner, credentials, permission boundary, runtime, scaling profile, or release lifecycle.

### Engine execution environments

Yes: each package engine needs an execution environment for its actual work. **MCP is the door and contract; it does not itself install Python, compute vectors, run semantic analysis, or provide model access.** A Sprite is the remote Linux host; a container/OCI image or a tightly scoped child process is the per-engine runner. A container is a strong packaging and isolation choice, not a logical requirement for every existing MOS capability. Confirm OCI/container support in the selected Sprite setup before depending on it.

Each runner needs a versioned runtime profile:

| Work performed | Runtime envelope must provide | Required controls |
|---|---|---|
| Python analysis (HSI/whitespace, some RS and Algorithms jobs, SME) | Pinned Python version and dependencies; CPU/memory/time limits; optional native libraries only where required | Record package/model versions; fail visibly when a dependency is absent; no implicit network access |
| Vectorization and embeddings | The chosen encoder/model, dimensions, batching path, and storage/query interface; avoid silently mixing vector spaces | Record encoder provenance; keep source text/vector locality explicit; treat vectors as sensitive derived data |
| Semantic or structural analysis | The engine's declared input representation, analysis libraries/model endpoint, and output schema | Keep semantic similarity distinct from causal/structural correspondence; return mappings, assumptions, and limitations |
| Node.js/CJS engines and bridges (including parts of Eureka/RS/MOS) | Supported Node version, required native modules, and the canonical MindrianOS semantic/vector service where applicable | Use shared vector/provenance APIs instead of installing a competing encoder by accident |
| External research or model calls | No direct engine-owned credentials or unrestricted network; brokered provider access through the shared research planner/connectors | Approved query scope, egress allowlist, budget, source ledger, and secret isolation |

The exact profiles must be derived from each engine's real entry point, dependency files, and service calls. Do not assume every family needs every row. For example, an embedding-based engine can consume vectors produced by the canonical room service rather than loading another model; Python analysis may then read a scoped vector/artifact bundle. If that encoder is unavailable, return `encoder_unavailable`, not a successful empty scan. The current package review already flags encoder/dependency uncertainty in some paths, real sklearn behavior as unestablished for Analogies, an HSI UMAP failure-handling issue, and live SME web access as untested.

Every run receives a scoped input manifest and produces a typed output bundle with engine/runtime version, input artifact IDs, model/encoder provenance, status, logs, and evidence references. Read-only input by default; no runner can write room or portfolio state. The MOS intake service validates the result and performs the permitted write. This makes “which engine, with which Python/model/vectorizer, on which room snapshot?” answerable after a finding returns.

### Local-first ICM run and Theo's role

The best ICM form is a **pipeline per scout run that publishes into an opportunity record library**. The portfolio is the accumulating library; each ICM run is a short, auditable production line. `/icm-architect` is the design method for the folder contracts and edit surfaces. The ICM filesystem runner manages a run's stage artifacts; it is not the room watcher, event queue, portfolio database, or continuous scheduler.

| ICM stage | One job | Reads | Writes / human check |
|---|---|---|---|
| `01_scope_snapshot` | Define what this run may inspect and preserve an immutable input manifest | User's scout charter; selected room IDs; changed-artifact list; local permission flags | `scope.md` + snapshot hashes. User confirms included/excluded rooms and scan focus. |
| `02_gather_prepare` | Gather and normalize the authorized evidence set | Selected room artifacts; approved external sources; canonical local vectors/semantic index when available | `prepared-inventory.json` with stable IDs, source spans, provenance, and missing-data states. User checks that the evidence set matches the intended scope. |
| `03_framework_led_research` | Execute only the engine jobs required by Theo's framework plan | Prepared inventory; stage instructions; engine contracts and runtime profiles | `stage-results.json` and evidence-linked findings, including source refs, uncertainty, limitations, and falsifiers. |
| `04_monitor_and_refine` | Apply Theo's framework checks to results; direct a bounded follow-up if needed | Stage artifacts and engine results held by the MindrianOS host under the approved data boundary | The host records gaps, contradictions, missing provenance, or a pass; MOS gathers more evidence or reruns selected engines. Each iteration is capped and recorded. |
| `05_portfolio_triage` | Turn monitored candidate results into durable portfolio records | Candidate batch; current portfolio index for dedupe and relationships | User-selected create/merge/park/reject actions plus decision reasons; accepted records enter the portfolio inbox or active set with lineage. |

New or changed room material may enqueue another **bounded run** after the user enables a local watcher. It does not cause an unbounded model loop. Each run reads a change manifest, reuses unchanged local preparation when valid, and records a report. ICM's human-edited stage outputs make method selection and candidate handoffs inspectable; MOS code still enforces room binding, gates, queueing, budgets, and persistence.

**Theo's target role is framework director and research monitor.** It should select or sequence the appropriate framework for the user's objective and define stage inputs, expected outputs, and quality criteria. Engines operate on the prepared, gathered data. In the proposed host-mediated design, MindrianOS retrieves Theo's framework guidance, then the local host applies the criteria to engine results and directs a bounded follow-up when it finds missing coverage, weak provenance, contradictions, or unresolved assumptions. A future Theo case-review integration could do that evaluation directly only if it is explicitly designed and approved. The user still controls scope, approves external research, and makes portfolio decisions.

The current Theo Context tools available in this authoring environment return read-only methodology and review criteria; they do not accept case artifacts or evaluate a user's research. The MindrianOS host must hold the local case context and apply Theo's retrieved checks to ICM outputs. A product connector that autonomously supervises runs and inspects artifacts is not established; that remains a proposed capability to build and validate. Any artifact access must use the user's approved data boundary: local/private source content should not be sent to a remote Theo service unless the user explicitly authorizes that transfer and its retention terms. Theo does not replace the engine runtimes, MOS permission gates, portfolio persistence, or human decision.

The intended reasoning path (with the current host-mediated Theo boundary) is:

```text
User objective + approved scope → Theo framework plan → MOS/ICM gathers and prepares evidence
                                  ↓                                  ↓
                         stage contracts                   selected engines run on data
                                  ↑                                  ↓
                    MindrianOS host applies Theo checks ← engine results + provenance
                                  ↓
            bounded evidence gathering / targeted rerun until criteria or stop
                                  ↓
             evidence-linked candidates → local portfolio → user decision
```

This preserves the user's earlier idea of an MCP capability per engine while keeping the user-facing route unified. The modules can have distinct MCP tool names and contracts without multiplying server configuration.

### Paid continuous Opportunity Scout service

**Product hypothesis:** this can become a paid MindrianOS service that continuously cross-examines an authorized room/portfolio feed, finds new outside evidence, and returns candidate commercialization and breakthrough signals as the room evolves. The user is paying for continued coverage, source-grounded discovery, and a usable portfolio feed, not simply for a bundle of engines.

The user creates a **Scout Charter**: what opportunity types to find, which rooms/corpora are in scope, what may leave the device, allowed sources, cadence, and research/compute budget. MindrianOS local software observes changes and creates a minimal, permission-checked research capsule. The managed service compares that capsule with prior candidates and allowed external research, then returns an evidence-linked “discovery card” explaining:

- what changed or why this surfaced now;
- the proposed commercialization path, breakthrough signal, or both;
- which source-room artifacts and external sources connect;
- the causal/mechanism hypothesis, counterevidence, unknowns, and possible kill question;
- what the user can do next: deepen, ask for a specialist, park, reject, or dismiss.

New findings appear in an **unreviewed Scout inbox** and can be accumulated across rooms. The service does not silently alter room truth, claim that an idea is validated, or present a generated “Eureka” as guaranteed. The local portfolio remains the user's source of truth; the service returns proposals through a scoped, auditable sync.

**Product boundary:** each customer gets an isolated tenant/workspace, data and query retention controls, export/delete controls, run history, and a visible pause/opt-out. Cross-customer corpus sharing or learning from private content is off by default and would require separate, explicit opt-in. Service tiers and pricing are undecided; plausible usage dimensions are monitored rooms, scan cadence, external-source coverage, and research budget. Do not set prices until cost, usefulness, and support burden are measured.

**Sprite as one possible runtime:** a Sprite is the remote Linux VM/microVM host, not the same thing as an engine's Python/container environment. It can host the persistent scout service, which dispatches bounded runs to the correct per-engine process profile or isolated container if supported and validated in that setup. It should be a **background worker**, not the system of record and not an unrestricted agent with the user's room tree mounted into it. The paid Scout service is the product; Sprite is only one hosting/execution option.

```text
Local MindrianOS rooms + portfolio (source of truth)
  → explicit scope / permitted-data outbox
  → scheduled or event-triggered job
  → remote Sprite scout worker
      local corpus indexing → research planning → allowed-source retrieval
      → selective engine routing → dedupe + evidence-linked hypotheses
  → candidate batch with run/query/source lineage
  → local portfolio intake as unreviewed scout candidates
```

“Always running” should mean **always available for repeat discovery**, not necessarily burning compute or running every engine continuously. Fly.io documents that a Sprite's filesystem persists, while processes and RAM do not persist through sleep; services can restart on wake, and an incoming request can wake the Sprite. A scheduled trigger or local room event can therefore wake the worker for a batch, after which it can sleep. A continuously active session is also possible, but it is not needed for the first design. See [Sprite lifecycle and persistence](https://docs.sprites.dev/working-with-sprites/) and [Fly.io Sprites overview](https://fly.io/sprites/).

**Data boundary:** the remote copy is a distinct egress boundary. In particular, permission to use non-public JHU material with MindrianOS or a Hopkins Enterprise Claude account must not be assumed to authorize copying that material to a third-party cloud Sprite. Start with public, synthetic, or explicitly cleared/redacted material. Keep sensitive source material local unless its owner has separately approved this remote processing path. A Sprite can be configured to call external services through Connectors without putting provider credentials in the Sprite, and network egress can be allowlisted; those controls do not decide whether a particular source document may be transferred. See [Fly.io Sprite Connectors and egress controls](https://fly.io/sprites/claude-code/).

**Scout controls:**

- A user defines a durable scout charter: goals (commercialization, breakthrough signals, or both), included rooms/corpora, excluded material, allowed source families, query and compute budget, and cadence.
- New local material triggers a metadata/change event. Only approved fields or a redacted export enter the remote outbox; no open-ended room sync.
- External queries may run automatically only inside that pre-authorized charter. New domains, sensitive terms, or broader query scope pause for approval. Keep exact query, parent query, source, timestamp, cost/status, and source excerpt in the audit trail.
- Do not recursively trust search results as instructions or feed a generated summary back as evidence. Preserve original source IDs and claim-level provenance through every engine handoff.
- Route selectively. Cheap local diagnostics can run first; use Eureka/analogy/SME/critique only where the scout has a structurally defined question. Bound candidates, query depth, run frequency, and retries to prevent a runaway loop.
- The Sprite returns a proposed candidate batch. It cannot confirm an opportunity, edit room files, or write directly to the local portfolio database. Local intake validates schema, deduplicates, and stores entries as unreviewed candidates.
- Keep a pause switch, per-room opt-out, per-run ledger, source freshness, failure states, and a user-visible last-run / next-run status.

**Hypothesis:** continuous, bounded scans over a versioned portfolio can surface useful combinations that a one-time room analysis misses. The risk is a reinforcing noise loop: each generated lead produces more queries and more weak leads. Test against a fixed baseline and cap query fan-out before enabling broad autonomous research.

### In / out of system control

**Inside MindrianOS:** room binding; local reads; candidate and evidence identifiers; routing; persistence; approval gates; query ledger; result provenance; portfolio lifecycle; user-facing explanations; exports initiated by a user.

**Outside MindrianOS:** truth of user-provided material; external provider uptime and retrieval quality; source licensing; legal/clinical/regulatory determinations; reviewers' independent expertise; real-world experiment outcomes.

**Confidentiality boundary:** raw room material stays in its room by default. For rooms the user authorized for local scouting, the portfolio may store a locally generated, explicitly unreviewed title/summary, status, and references to originating room items. The user can correct or remove these records. A deep dive reads only the rooms explicitly selected for that investigation. Public or third-party research receives only approved query text through the shared planner; room text, private documents, and identifiers are not sent by engine adapters.

## 2. Opportunity portfolio as a system stock

The portfolio is a collection of distinct opportunity hypotheses with explicit lineage. It is separate from room content, an engine's raw candidate output, grant listings, and the room hierarchy.

### Portfolio item model (proposed)

```yaml
opportunity_id: stable-id
title: concise, locally generated, unreviewed name
summary: concise, locally generated, unreviewed description
candidate_types: commercialization | breakthrough | both
status: scout_candidate | needs_evidence | ready_for_review | deep_dive | test_proposed | active_test | parked | rejected | merged | stale
origin_refs:
  - room_id: stable-room-id
    artifact_id: stable-local-id
    relation: discovered_from | supports | challenges | related_to
discovery_signals:
  - capability_id: descriptive-versioned-id
    run_id: run-id
    signal: plain-language reason
claims: []
evidence_refs: []
counterevidence_refs: []
assumptions: []
uncertainties: []
relationships: []
next_action: user-readable action or null
decision_log: []
created_at: timestamp
updated_at: timestamp
review_after: date or null
```

Raw evidence remains in the source room or source record. A portfolio reference must resolve back to it or be explicitly marked unavailable. When two candidates are merged, preserve both origins and their separate evidence trails; never replace them with a single opaque match score.

### Stocks, inflows, outflows, and owners

| Stock | Unit and contents | Inflow | Outflow / expiry | Maintainer |
|---|---|---|---|---|
| Unprepared source material | File, note, transcript, dataset, or source record awaiting scoping | User import or approved connector | Prepared, excluded, or deleted; source may become stale | User and ingestion tools |
| Prepared, traceable room material | Artifact with stable ID, source, date, and permission state | Ingestion and preparation | Superseded, removed, or marked stale | Room services and user |
| Open framing questions | One unresolved question that can change routing or evaluation | User goal plus room diagnosis | Answered, explicitly assumed, or deferred | MOS workflow and user |
| Candidate signals | One raw engine proposal with method/run/source lineage | Engine run or user entry | Dedupe, assessment, or discard; raw run retained per policy | Capability module and MOS |
| Scout candidate inbox | One distinct, deduplicated commercialization lead or breakthrough signal with run and source lineage; explicitly unreviewed | Scout run over an authorized local scope, approved import, or manual entry | Merged, dismissed, promoted for deep dive, parked, or stale; preserve reason and lineage | Scout workflow and portfolio service |
| Portfolio opportunities | One distinct opportunity hypothesis accepted for ongoing assessment; separate from raw engine rows | User triage of an inbox candidate, manual creation, or merge | Rejected, merged, parked, stale, or archived with reason | Portfolio service and user |
| Claims and evidence | One claim-evidence relation with provenance and support/challenge status | Approved research, room source, or reviewer input | Superseded or stale, not silently deleted | Evidence ledger and reviewer |
| Assumptions and unknowns | One unverified premise or missing answer | Candidate assessment or critique | Verified, falsified, accepted as constraint, or deferred | MOS workflow, reviewer, user |
| Deep-dive work | One active investigation scope for a selected item | User opens a deep dive | Decision, pause, or close | User and MOS workflow |
| Human review queue | One item requiring a named human judgment | Readiness gate or specialist question | Accepted, returned for evidence, declined, or timed out | Portfolio owner |
| Decision and experiment outcomes | One recorded disposition or observed test result | User decision and later follow-up | Superseded by a later decision; retained as history | User and portfolio service |

Items do not expire merely because time passes. Sources, claims, and opportunities can become stale according to dates or changed conditions; the system should flag them for refresh instead of deleting them. Scout findings enter a bounded **unreviewed inbox** automatically; only user-triaged items become active portfolio opportunities. Human review capacity is a constrained stock; generation is not complete if it creates more unreviewed work than users can handle.

## 3. Flow and lifecycle

```text
Import / choose commercial or breakthrough focus and room scope
  → prepare material and provenance
  → run local scout across the authorized rooms and portfolio items
  → diagnose bottlenecks, landscape gaps, candidate combinations, and mechanisms as useful
  → deduplicate and explain each signal
  → automatically capture bounded results in an unreviewed portfolio inbox
  → user triages, merges, parks, rejects, or selects candidates for deep dive
  → assess selected portfolio item: mechanism, need, alternatives, execution
  → gather approved support and counterevidence
  → human decision: deep dive, test, partner, hold, reject, or merge
  → record result and review date
  → use retained outcomes to improve future retrieval and routing
```

This is a branching graph, not a mandatory seven-engine chain. A user may add an opportunity manually, run one capability only, skip diagnosis when the bottleneck is already known, or stop when evidence is insufficient. Each transition returns `ready`, `needs_input`, `not_run`, `no_candidates`, `blocked`, `provider_failed`, or `error` as appropriate. Failure must never be shown as “no opportunity found.”

### Lifecycle gates

1. **Scout signal → inbox candidate:** automatic only within the user's explicitly authorized local scope, with deduplication, source lineage, a run ID, and an unreviewed label. Apply candidate and run-size limits.
2. **Inbox candidate → active portfolio opportunity:** user can advance, merge, reject, or park. Preserve the originating signal and rejection reason when offered, without requiring a long explanation.
3. **Portfolio item → deep dive:** user chooses scope and rooms; show which source references will be read and which queries may be sent outside.
4. **Deep dive → evidence-ready:** every consequential claim has a source/date or an explicit unknown; support and counterevidence searches are both represented.
5. **Evidence-ready → decision:** the user decides. MOS may recommend a next test but cannot auto-confirm the opportunity.
6. **Test → outcome:** record observed result, date, and context. This is the only basis for claiming the system has learned which discovery methods perform better.

### Cross-room accumulation

Room A candidate and Room B candidate may be linked in the portfolio only through a user-visible relationship proposal. The portfolio stores references and user-approved metadata; it does not silently merge room prose. A cross-room deep dive requires an explicit set of rooms and displays that scope before reading. Existing cross-room section relevance can seed suggestions, but it is not an opportunity identity match.

## 4. Descriptive capability names and when to hire each

Names below are proposed user-facing names based on the package's documented jobs. They describe what the capability does, not that its result is validated. Where one folder contains distinct jobs, expose sub-capabilities rather than forcing one broad label.

| Current label | Proposed user-facing name | JTBD: when to hire it | Output and limit |
|---|---|---|---|
| Eureka | **Cross-Domain Opportunity Finder** | “When my room contains assets, problems, or technologies that may combine in an unexpected way, find candidate connections worth checking.” | Candidate pairs and reasons. A surprising match is a lead, not proof; encoder/provider readiness remains to be verified for the target runtime. |
| HSI | **Landscape Gap and Whitespace Scanner** | “When I need to see which parts of my room or selected landscape are thin, surprising, or missing, map coverage gaps for me.” | Gap/novelty candidates tied to room artifacts. Does not establish unmet demand or a viable market. Current package review flags reducer expectation and native UMAP failure handling. |
| Analogies | **Cross-Domain Mechanism Scout** | “When I have a bottleneck or objective and need a different way to solve it, find mechanisms from structurally relevant fields and explain what might transfer.” | Analogy candidates with source trail and mismatch. Does not establish that the transfer works; package retrieval and analogy fitness need target-context validation. |
| RS (`rs-explain`) | **Bottleneck Finder and Explainer** | “When progress is blocked, identify the limiting constraint and explain how it constrains the rest of the system.” | Bottleneck thesis and supporting room links. A reverse salient is a constraint diagnosis, not automatically a market opportunity. |
| RS (`rs-fetch`) | **Bottleneck Evidence Researcher** | “When a bottleneck is identified but its current state or evidence is missing, find approved sources that can confirm or challenge it.” | Source leads/evidence via approved research. Network/model path is not validated as a production integration. |
| RS (`rs-experts`) | **Bottleneck Specialist Finder** | “When a bottleneck needs specialist input, identify relevant people or groups from permitted, current sources.” | Expert candidates, not endorsements or confirmed availability. |
| RS (`rs-thesis`) | **Bottleneck Case Builder** | “When we have several bottleneck signals, synthesize a concise, traceable case and the main unresolved questions.” | Thesis summary linked to evidence; avoid treating a generated thesis as an observed fact. |
| Algorithms / Genesis | **Challenge Decomposer** | “When the problem is broad or mixed across domains, break it into a structured research brief and distinct subquestions.” | Decomposition, domain map, research tasks. Persona-framed research is synthetic perspective generation, not real expert testimony. |
| Algorithms / Jason | **Systems Critic** | “When a candidate or pitch sounds plausible, challenge assumptions, expose missing links, and name the next discriminating test.” | Critique, alternatives, and test suggestions. Some described graph/diagnostic dependencies are not verified in the current package. |
| Algorithms / Opposable Mind HMM | **Trade-off Integrator (experimental)** | “When two valid positions conflict, explore whether a new option can preserve the essential value of both.” | Candidate synthesis or state model. HMM framing and underlying evidence are under-specified; experimental only until validated. |
| SME Agent | **Structural Analogy Tester** | “When we have a source-domain mechanism and a target problem, test whether their causal relationships actually correspond and identify candidate inferences.” | Explicit relation mapping and candidate inference. It tests the encoding supplied; it is not a web researcher or proof engine. Live web path is untested. |
| Algorithms / BONO package | **Do not expose yet** | No hire statement until reviewed against current MOS Bono and the package is reviewed. | Current governed `/mos:bono` remains the decision-deliberation route. Do not conflate it with the unreviewed package copy. |
| Current MOS `/mos:bono` | **Decision Debate** | “When I need to examine a scoped decision from multiple perspectives before choosing a course of action, help me deliberate and record my decision.” | Governed MOS debate. The user decides; simulated perspectives are not evidence or customer research. |

These names are proposed labels, not command renames. Before exposing them, check for collisions with current commands, MCP identifiers, and other user-facing MOS capabilities.

## 5. Routing: select a job, not an engine bundle

The MOS intelligence layer should act as a transparent dispatcher over user jobs:

| User need or observable gap | First capability | Optional next step | Do not do |
|---|---|---|---|
| “What is holding this back?” | Bottleneck Finder and Explainer on selected room(s) | Bottleneck Evidence Researcher or Specialist Finder | Treat a bottleneck as an opportunity without a user/need path. |
| “What opportunities are hidden in this landscape?” | Local room grounding; Gap and Whitespace Scanner if coverage is suitable | Cross-Domain Opportunity Finder on a bounded set | Run every engine over every room by default. |
| “Could something from another field help?” | Cross-Domain Mechanism Scout | Structural Analogy Tester on user-selected candidates | Treat lexical/topic similarity as structural fit. |
| “Is this combination causal?” | Structural Analogy Tester or Systems Critic, depending on whether there are two encoded systems or one proposal | Approved evidence/counterevidence research | Ask research retrieval to prove a causal relation it only retrieved. |
| “What facts would change the decision?” | MOS frames the decision and missing claims | Approved research planner; a specialist review if needed | Send local material directly to an engine's ungoverned fetcher. |
| “Should I pursue, hold, or stop?” | Evidence completeness check, then current MOS Decision Debate if useful | User decision, experiment record | Use one aggregate score or package BONO as authority. |

### The scout has two distinct finding lanes

**Commercialization opportunities** ask whether an asset, technology, capability, or combination could create value for an identifiable user or buyer through a plausible path such as licensing, partnership, a product or service, a spinout, or adoption in an existing operation. A surfaced lead must say what the potential value path is and which pieces are unknown: need, buyer, technical fit, rights/ownership, alternatives, route to market, and execution constraints. A patent match or an engine similarity score is not a commercialization case.

**Potential key breakthroughs** ask whether a mechanism, combination, or removal of a limiting constraint could enable a materially different capability or outcome. The scout should say what may change, what bottleneck or limit it addresses, and what evidence would distinguish a breakthrough from an incremental improvement or a false connection. “Key breakthrough” remains a hypothesis label until domain evidence and a discriminating test support it.

Keep these as separate candidate types because their evidence differs. One finding can be both; preserve both labels and test paths instead of forcing one category. The scout does not declare a breakthrough or a viable business. It creates a traceable lead for assessment.

Routing should normally choose one primary capability and at most one dependent follow-up, unless the user requests broader exploration. The router explains: why this job was selected, what it will read, expected cost/latency if known, what it will return, and why any proposed follow-up is optional. The user can change the route.

## 6. Shared result contract and MCP surface

Every capability call should receive a bounded request:

```json
{
  "request_id": "...",
  "job": "diagnose_bottleneck | find_candidates | map_mechanism | critique | research_claims",
  "room_refs": ["..."],
  "artifact_refs": ["..."],
  "objective": "...",
  "constraints": ["..."],
  "approved_query_grant_id": null,
  "budget": {"max_candidates": 12, "max_sources": 8},
  "user_scope_confirmed": true
}
```

Every response should include:

```json
{
  "status": "complete | needs_input | not_run | no_candidates | blocked | provider_failed | error",
  "capability_id": "stable-name@version",
  "run_id": "...",
  "input_refs": [],
  "output_refs": [],
  "claims": [],
  "evidence_refs": [],
  "assumptions": [],
  "limitations": [],
  "egress": {"performed": false, "grant_id": null, "queries": []},
  "proposed_next_jobs": []
}
```

The schema is a proposed shared contract. It must be adapted to existing MOS epistemic types, gates, run records, room binding, and source filing before implementation. Do not add an engine-specific way to bypass the shared query approval, write, or session binding controls.

Suggested user-facing tools are grouped by job, not one opaque `run_all_engines` call:

- `opportunity_portfolio_list`, `opportunity_portfolio_get`, `opportunity_portfolio_update`
- `opportunity_discover` for a scoped local discovery plan and selected capability runs
- `opportunity_deep_dive` for a selected portfolio item, explicit room scope, and chosen questions
- capability modules such as `bottleneck_diagnose`, `whitespace_scan`, `analogy_candidates`, `structural_mapping`, `candidate_critique`
- shared existing research planner operations for exact query approval, retrieval, evidence filing, and grants

These names are illustrative; inspect the current MCP registry and naming rules before adding tools. Portfolio writes and external egress must use the existing gated paths.

## 7. The real bottlenecks and feedback loops

### Suspected bottlenecks

| Suspected constraint | Symptom / current evidence | System effect | Small test and measurement |
|---|---|---|---|
| Room-to-portfolio promotion | Room banks are room-scoped; current cross-room store records relationships, not full opportunity lifecycle. | Useful candidates can be stranded in rooms or duplicated across them. | Manually promote 10 candidates across 3 rooms into a prototype index; measure retrieval success, duplicate rate, lineage completeness, and user correction time. |
| Candidate quality and review burden | Package review flags unvalidated rankers, lexical matches, and open algorithm readiness items. | More generated candidates can increase review backlog without increasing accepted opportunities. | Compare a small shortlist and baseline with blinded domain reviewers; measure accepted-candidate yield and review minutes per accepted item. |
| Framing and source readiness | The engines need bounded inputs and stable identifiers; source preparation and provenance differ by engine. | Engines fail, produce empty output, or return non-auditable proposals. | Track `needs_input`, failure and empty states by job; measure time from import to first traceable candidate. |
| Evidence and falsification | Candidate generation is easier than confirming need, mechanism, differentiation, and execution. | Attractive hypotheses can be mistaken for defensible opportunities. | For each deep dive, record what claim changed the decision and whether counterevidence changed the case. |
| Human decision capacity | Portfolio growth can outpace available review. | Old candidates go stale and users stop trusting the portfolio. | Track open review count, age, and percentage with an explicit next action; trial WIP limits. |

### Feedback loops (hypotheses unless measured)

1. **Useful compounding loop:** traceable discoveries → user review → better-tagged portfolio items and reasons → better retrieval and routing → more relevant deep dives → recorded outcomes → calibrated future routing. This loop is not implemented merely by storing rejection text; a retrieval/routing component must actually use reviewed outcomes, and evaluation must guard against learning from noisy or private labels.
2. **Candidate overload loop:** wider engine fan-out → more weak candidates → review queue grows → fewer deep dives → less outcome feedback → weak routing persists → more candidates are generated to compensate. Control with bounded scopes, max-candidate budgets, triage gates, and review WIP limits.
3. **Provenance trust loop:** source references and uncertainty labels → faster review → more completed decisions → greater user willingness to revisit and share scoped items. Test with review time and return-use, not satisfaction alone.
4. **Automation concealment loop:** more automated handoffs → fewer visible decisions → errors survive longer → false confidence. Break it with visible run status, inspectable handoffs, explicit permission state, and human gates at promotion, egress, and disposition.

## 8. Portfolio quality and evaluation

Do not optimize one opaque score. A deep-dive dossier should separately address:

1. **Need:** who has what unmet job or costly bottleneck, and what supports that claim?
2. **Mechanism:** how does the proposed combination change the situation; which links are facts versus inference?
3. **Differentiation:** what alternatives and prior work are known? Patent hits are not legal novelty or freedom-to-operate opinions.
4. **Execution:** who can test, build, license, adopt, or partner; what constraints matter?
5. **Test:** what is the smallest discriminating experiment, its metric, threshold, and falsifier?

Portfolio metrics should include:

- share of items with resolvable source lineage;
- duplicate/merge rate and user correction rate;
- candidate-to-accepted-portfolio conversion;
- accepted-candidate yield under blind domain review;
- time and human minutes from material import to a decision-ready dossier;
- age of unresolved review items and share with a next action;
- deep-dive-to-test and test-to-recorded-outcome conversion;
- rate of support/counterevidence that materially changes a disposition;
- results by engine/version, including empty, failed, and not-run states.

Candidate count is a diagnostic, not a success metric. Historical JHTV opportunity cards are a comparator, not truth labels; the package redesign says the old room recorded zero critic-verified candidates.

## 9. Implementation sequence

### Build order

1. **Scout and portfolio contract:** define search goals, authorized room scope, candidate identity/deduplication, source references, commercial/breakthrough candidate types, statuses, review limits, and decision history.
2. **Portfolio inbox:** add a local registry under the configured Mindrian rooms home, reusing existing path resolution and storage conventions. Automatically store bounded, unreviewed local scout results with run IDs and room/artifact pointers; keep source bodies in source rooms. Provide list/get and gated triage/merge/park/reject/update operations.
3. **MOS scout front door:** provide “scout for opportunities,” “show my portfolio,” and “deep dive this opportunity.” The workflow explains coverage and gaps, selects a bounded room scope, and asks before cross-room reads beyond the approved scope or any outbound query.
4. **Capability contract:** implement one adapter at a time with typed status, run ID, inputs, outputs, limitations, and egress declaration. First reuse current MOS local capabilities and research planner rather than copying package fetchers.
5. **Pilot capability selection:** begin with local room/portfolio grounding and the existing bottleneck or whitespace capabilities; add **Cross-Domain Mechanism Scout** for scoped transfer discovery. Add **Structural Analogy Tester** only on selected candidates after encoding quality is reviewed. Do not include package BONO until reviewed.
6. **Evidence and decision dossier:** connect approved counterevidence research, human review, existing gated opportunity/claim promotion, and a concrete experiment record.
7. **Calibration:** run the bounded blind-review pilot in `research/LATEST/OPPORTUNITY-ENGINE-REDESIGN.md`. Only add automated ranking or learning after baselines and outcome labels exist.

### First engineering slice

Build a **bounded local scout feeding the portfolio inbox** as the first end-to-end slice. It should:

- run local discovery over an explicitly selected set of rooms and existing portfolio items;
- capture deduplicated, unreviewed candidates with stable IDs, source references, scout run/version, candidate type, and a plain-language reason for surfacing;
- list and retrieve candidates across registered rooms;
- show the source room and source artifact for every item;
- support merge with preserved origins, triage, park, reject with optional reason, and reopen;
- refuse cross-room reads or writes when scope/session binding is missing;
- retain an auditable decision history;
- leave current room-local opportunity bank behavior intact.

This tests the newly clarified product value: MindrianOS actively finds and accumulates commercialization and breakthrough leads beyond the one room currently open, then lets the user choose which deserve a deep dive. External research and automatic rescans on new material are follow-on capabilities, not prerequisites for the local scout pilot.

## 10. Smallest practical experiment

**We will test** a local opportunity scout that writes unreviewed candidates to a traceable portfolio inbox **with** 3 explicitly authorized rooms and 10 to 20 source artifacts **over** one working session plus a one-week return check, **measuring** source-lineage completeness, duplicate rate, reviewer-rated usefulness by commercialization/breakthrough lane, time to triage, and whether the user independently opens a cross-room deep dive. **We will continue if** every saved lead has a resolvable origin, the user can retrieve and triage leads without reopening each source room, and at least one cross-room lead is judged worth a defined next test. **We will revise or stop if** the scout mostly returns duplicate or unsupported matches, users cannot distinguish a lead from a validated opportunity, or triage cost exceeds the review effort saved.

Only after the local workflow proves useful, test the **paid continuous-service** hypothesis with users who have an authorized corpus. Offer a time-limited scout charter and a clear report/feed; measure whether new evidence or cross-room links produce additional candidates users actually deepen, ongoing review effort, retention, and stated willingness to pay at a specific proposed price. Revise if the service mainly repeats the user's existing research or creates more triage than decision value. Treat stated willingness to pay as weaker evidence than a real paid pilot.

This tests the portfolio system, not the scientific quality of any engine. Engine effectiveness requires a separate blinded comparison on an authorized, versioned corpus, with an agreed rubric and baseline.

## 11. Critical uncertainties to resolve before production code

1. Portfolio ownership and sharing: per local user, organization, or an explicit per-project portfolio? Current room registry is local; team synchronization is not assumed.
2. Which opportunity candidates qualify for promotion, and which room-level candidate types share the same identity contract?
3. Can each target engine consume stable room/artifact references, or does it require full text? If full text is needed, keep processing local and document it.
4. What data may appear in portfolio titles/summaries and central metadata, particularly for sensitive JHU technology disclosures?
5. What user-controlled action authorizes multiple rooms for a deep dive, and how is that scope displayed and revocable?
6. Which existing MOS epistemic type, review status, and gate APIs should be the portfolio's canonical promotion/decision state?
7. Which names collide with existing `/mos:` commands or MCP tools? The proposed capability labels need a registry audit.
8. Which algorithms have an executable, stable interface in the current environment? Package offline tests are not production integration proof.
9. Is the original package BONO meant to contribute anything distinct from the current MOS Bono flow? No package-derived inclusion until comparison and review.
10. What blind reviewer rubric, baseline, and acceptable effort threshold will be frozen before the engine pilot?
11. Will users authorize a remote service to process the required room-derived capsules, and what institution/vendor review is needed for confidential material?
12. Do repeated updates create enough fresh value to justify a subscription, after search cost, engine cost, and human review are counted?

## Source files reviewed

- `r-and-d/breakthrough-engines/README.md` and `SOURCE.md`
- `r-and-d/breakthrough-engines/engines/{algorithms,analogies,bono,eureka,hsi,rs,sme-agent}/`
- `/mnt/c/Users/jsagi/Downloads/research/LATEST/REVIEW.md`
- `/mnt/c/Users/jsagi/Downloads/research/LATEST/INTEGRATION-RESEARCH.md`
- `/mnt/c/Users/jsagi/Downloads/research/LATEST/OPPORTUNITY-ENGINE-REDESIGN.md`
- `lib/core/opportunity-ops.cjs`, `commands/opportunities.md`, `references/opportunities/opportunity-template.md`
- `lib/core/cross-room-aggregator.cjs`, `lib/core/cross-room-store.cjs`, `lib/workflow/cross-room-umbilical-closer.cjs`
- `lib/mcp/tools/research.cjs`, `lib/core/research-planner/`
- `tests/test-355-gate-opportunity-promotion.cjs`

**Verification limit:** this was a read-only design review. No tests, engine scripts, provider integrations, or external searches were run for this design.
