# MindrianOS opportunity discovery: engine and platform feasibility research

**Research snapshot:** 18 October 2026  
**MindrianOS source examined:** local `/home/jsagi/dev/MindrianOS-Plugin`, package metadata `2.0.0-beta.70`; the shrinkwrap still labels itself beta.69, so release reproducibility is itself an open issue.  
**Research bundle examined:** `/mnt/c/Users/jsagi/Downloads/research/LATEST`, consolidated from `09102026/` plus the latest SME archive.  
**Scope:** inspect the seven named engine families and the platform boundary needed for a self-service user workflow. This is a source and documentation review, not a production-readiness certification. No engine was executed and no test suite was run.

## Executive assessment

**Yes, this system is achievable, if “the system” means a user-directed, locally governed opportunity-discovery workflow that can accumulate a portfolio of traceable candidates.** The repo already contains meaningful foundations: room binding, an MCP `research_run` facade, local perspective recall, approved public-search plans, run state, evidence cards, approval gates, and proposed-only evidence filing. These reduce the amount of new platform work.

**It is not yet demonstrated as an autonomous, always-running intelligence service that safely operates all seven reviewed engine packages.** The research package is mixed-maturity; several engines are related to existing MindrianOS functions but are not thereby proven to be the same implementation. BONO’s package copy is explicitly unreviewed, SME integration is design-only, external retrieval is not validated, and some ranking/scoring behavior has unresolved defects or weak evaluation.

The architectural choice should be **one MindrianOS-controlled user workflow and one unified engine capability boundary at first**, with individual, job-named operations behind it. That does not mean one giant engine or one MCP server per package. The workflow chooses the next useful job; a runtime executes that bounded job; a shared contract preserves provenance, uncertainty, permissions, and lifecycle state. Separate MCP servers/processes are justified later only by dependency isolation, trust, provider credential, or scaling requirements.

The first product should be **user-invoked and local-first**, not continuously watching. A room scan can build a durable opportunity portfolio and queue follow-up work. “Always searching” introduces scheduling, budget, freshness, consent, alert fatigue, and remote egress work that should follow a proven user-directed workflow.

## 1. What is observed, claimed, and proposed

| Status | Statement |
|---|---|
| **Observed in current platform source** | `lib/mcp/tools/research.cjs` registers one room-bound `research_run` facade. It includes planning, grants, quick/deep planning, evidence basket, filing, and perspective operations. Quick research rechecks the approved query grant before fetch, records run state, and performs a local room check without sending room text. |
| **Observed in current platform source** | Perspective recall is documented in the facade as local graph + ICM structure, without embeddings or network. It proposes candidate pairs and a plan; judgment remains with the host/user. The implementation is a perspective layer, not proof that every research-package engine is callable. |
| **Observed in current platform source** | The intelligence-orchestrator skill specifies one-reach arbitration, offer-before-fire, human gates, and proposed truth claims. The room-opportunity code separately provides room-level opportunity-bank operations. Cross-room aggregation/store exists, but current cross-room edges are constrained scalar/structural relationships, not a complete portfolio lifecycle. |
| **Reported by research bundle, not revalidated here** | Individual package review reports some offline checks, SME paper-example reproductions, RS test pass notes, and a graph prototype run. We did not rerun these. |
| **Open / not established** | Live retrieval quality, Windows command reliability, full caller contracts, real-user end-to-end quality, reproducible install, engine isolation, production security, latency/cost, and whether the current installed build matches this checkout. |
| **Proposed design** | A durable “opportunity record” should link the room question, source artifacts, engine/method/version, candidate mechanism, supporting and opposing evidence, assumptions, permission/egress record, state, owner, next test, and decision history. This is a design recommendation, not a claim about the current database schema. |

### One platform-version warning

The root `package.json` states `2.0.0-beta.70`, while `npm-shrinkwrap.json` states `2.0.0-beta.69`. That mismatch weakens confidence that a clean install reproduces the reviewed source tree. Resolve lockfile/package release identity before using an installation as a user pilot. This is source inspection, not proof of a failing install.

## 2. Reframed system problem

The user is trying to turn a growing, heterogeneous body of room material into a **portfolio of decision-worthy opportunities**, then choose which leads merit deeper investigation. The system must preserve how each lead was derived and what remains unknown, while reducing the need for a developer or Jonathan to manually select, run, interpret, and file engines.

**How might we help a user repeatedly discover and assess opportunities from local room material and approved external research, despite heterogeneous engine maturity and confidential inputs, without overwhelming the user with candidates or presenting hypotheses as facts?**

### System boundary

**Inside MindrianOS:** room/session binding; local artifact selection; user objective and constraints; engine selection and execution policy; run/job state; approval UI/gates; query audit and egress controls; evidence/source records; candidate portfolio; cross-room relationships; human decision and feedback capture.

**Outside MindrianOS:** model/provider availability and terms; external search/index quality; local host uptime and filesystem integrity; remote worker availability; the truth of a source; domain expert and institutional decisions. MindrianOS can record and constrain these, but cannot guarantee them.

### Human decisions that must remain explicit

1. Which room/material and objective are in scope.
2. Whether a proposed candidate is worth follow-up.
3. Whether exact external searches or any source text may leave the local machine.
4. Whether evidence supports a claim or merely motivates a test.
5. Whether a candidate is pursued, parked, rejected, or promoted to a confirmed claim.

### Case selection deferred

This is a system-level design review. It does not select a pilot room, define an organization-specific approval basis, or use case-specific output counts as system evidence. Those decisions belong to a later pilot plan. The platform still needs general controls for data classification, model/provider routing, and user-approved egress before it can safely handle any confidential material.

## 3. The seven engines: jobs, evidence, and integration posture

Engine labels below are **user-facing job names**, not just package names. “Hire when” is the JTBD instruction a user can act on. Package behavior is taken from `workflow/*/CONTEXT.md`, `REVIEW.md`, and the named package docs. Where a contract is vague or implementation maturity is unresolved, that is stated directly.

| Package | Proposed capability name | JTBD: when to hire it | What the reviewed package says it does | Inputs → outputs (at the useful contract level) | Maturity / caveats | Platform placement |
|---|---|---|---|---|---|---|
| **Eureka** | **Breakthrough Pair Scout** | “When I have a large set of room items and want a ranked shortlist of unexpected pairs that may unlock a new opportunity, find and explain the strongest candidates.” | The legacy/package command describes pair ranking, checks, and a critic. The current MindrianOS command explicitly says the standalone runner is retired: its live route is now a research-planner perspective that recalls cross-domain pairs from local graph + ICM structure, then plans approved research. | Current route: bound room → local recalled pairs + Stage A gates → plan → grant → approved quick research → evidence basket; candidate filing only on user approval. Legacy engine's internal pair-score result must not be presumed to be the current route's output. | Package review's Windows/install/critic issues matter only if reviving the retired runner. Current route has established controls but does not establish that the legacy embedding/critic implementation is running. More generally, a missing encoder/model must produce a visible failed/degraded status, never a “no opportunity” result. | Treat current perspective as the first-class behavior. Audit any planned legacy port against it; do not recreate the standalone engine by name. |
| **HSI / whitespace** | **Portfolio Gap Finder** | “When I want to know which themes, functions, or evidence areas in this room are conspicuously thin or absent, map the under-covered space.” | Embedding/reducer and graph interpretation identify empty or weakly represented regions in room material. | Room documents/nodes + embedding/reducer configuration → gap regions, representative items, coverage/surprise candidates. | PCA-vs-UMAP expectation differs in tests/code; native UMAP abort behavior open; changed pair count/selection needs caller validation. A geometric gap is not automatically a market opportunity or a meaningful absence. | Local analytical capability; return gaps with source exemplars and “why this may be an artifact” checks. Prefer explicit optional embedding setup; no silent fallback that hides method change. |
| **Analogies** | **Cross-Field Mechanism Finder** | “When the room’s current approaches are stuck or narrow, find mechanisms from another domain that solve a structurally similar problem.” | Retrieves or recalls local/fetched analogues and assesses structural fitness. TRIZ is reference-only/partial, not the selected method. | Target challenge + local examples or approved retrieved sources → analogy candidates, source trail, fitness rationale, mismatches. | Live sklearn behavior and embedding counts not established; seeded examples sparse; TRIZ matrix incomplete. Similar terms are not proof of shared mechanism. Query terms must be generic and approved before outbound search. | Divergence stage. Keep local recall separate from external retrieval. Use common research planner for any outbound search. |
| **Algorithms: Genesis** | **Cross-Domain Solution Generator** | “When I have a well-framed problem and want a structured pipeline to generate candidate solutions using patterns from other domains, produce a traceable set to review.” | Prompt/agent-driven cross-domain pipeline; grouped with unrelated materials only because review directory groups them. | Problem framing + candidate/domain sources → generated alternatives/patterns, which need source and method trace. Actual implementation contract requires source audit. | Test has ESM `require` issue; embedding/sentence-transformer behavior and citations not verified. Do not bundle with other Algorithms methods under a single user action. | Candidate stage only after source basis and reproducibility are fixed. Likely later than local MVP. |
| **Algorithms: Jason** | **Differential Claim Critic** | “When I have two explanations, plans, or candidate claims and need a systematic critique of their differences and weak points, compare them.” | Python differential-analysis critique sensor/judge and prompt. | Two explicit claims/plans plus criteria → differences/critique/possible adjudication. | Exact quality/evaluation contract and caller not established by package review; citations or model-generated judgments need source checks. | Optional critique pass after candidate creation; do not make it automatic on every result. |
| **Algorithms: Opposable Mind HMM** | **Perspective-Conflict Model (research prototype)** | “When I need to understand two opposing perspectives and their underlying assumptions, help structure the tension before a human decision.” | A written HMM/opposable-mind algorithm description, not a service. | Competing perspectives/assumptions → proposed state/model representation. | Not an executable service. Unsourced numerical claims must not be reported as results. Treat as design hypothesis, not engine integration. | Do not expose as runnable MCP tool. Could inform a future structured comparison workflow after method and claims are verified. |
| **BONO package** | **BONO Package: unreviewed debate workflow**; user-facing name deferred | “When I need a structured multi-perspective debate and a navigator ruling on a defined what-if, facilitate that deliberation.” | Package docs describe topic → research fan-out → hat/persona debate → navigator ruling. | Bounded question + evidence packets → structured views/debate/ruling recommendation. | The package is an original copy and explicitly unreviewed. Current MindrianOS `/mos:bono` is a separate governed workflow; do not represent package copy as current implementation or overwrite the existing one. | Use the existing governed MindrianOS route for now. Audit and compare package code before considering adoption. |
| **RS** | **Bottleneck Finder** (shared core) with **Explain the Stall**, **Find Needed Experts**, **Gather Bottleneck Evidence**, **Read a Bottleneck Thesis** | “When progress is stuck, identify the constraint that most limits progress; then hire the variant matching whether I need explanation, expertise, evidence, or to revisit a prior thesis.” | Shared reverse-salient detector; `rs-fetch` runs the multi-source discovery pipeline, `rs-explain` explains the current work, `rs-thesis` reads a prior saved thesis, and `rs-experts` resolves experts from previously fetched people/papers. | RS fetch: topic + optional upstream stage → domain/query matrix, retrieved sources, preprocessing, deterministic scores/classification, theses, commercial assessment, provenance/degraded-source status. Explain: room/work context → explanation. Experts: prior retrieved people/papers + Aura/local resolution. Thesis: existing discovery ID → saved thesis/evidence metadata. | RS review flags truncation at 2,000 chars, whitespace case, caller/network/model verification. Crucially, `rs-experts` docs say no Aura transport ships, so production invocation refuses with `AURA_TRANSPORT_ABSENT`; do not advertise expert lookup as available. `rs-thesis` is a readback, not new analysis. `rs-fetch` has broad external dependencies and requires egress/credential integration review. | Candidate local diagnostic should be the shared/local explain or a bounded room corpus pass. Treat `rs-fetch` as a separate approved research workflow; experts and thesis are follow-up tools with prerequisite states, not peer engines. |
| **SME Agent** | **Structural Analogy Mapper** | “When I have a specific source pattern and target problem, test whether their relationships map—not just their keywords—and derive candidate inferences to investigate.” | Structure mapping over explicit relational representations; separate access/retrieval, mapping, and inference testing stages. Mapping is deterministic for the represented structures. | Source structure + target structure → relation mapping, candidate inference(s), mapping report. | README reports 18 offline tests and paper-example reproductions, not rerun here. Live web access not tested; web access/retrieval is not its implemented mapping core. Exact-string novelty can miss semantic duplicates. High score means “worth testing,” not true. | Follow-up after a human selects an analogy. Never replace evidence gathering; pass compact explicit structures, not an uncontrolled room dump. |

### Important category correction

There are **seven package folders**, but “Algorithms” contains three different methods. The user-facing catalog should therefore not show seven generic peer “engines” as if each were one executable. It should show stable jobs with plain-language names. The initial hire menu could be: **Find a bottleneck; Find portfolio gaps; Find breakthrough pairs; Find mechanisms from other fields; Map a selected analogy; Critique two alternatives; Run a structured debate.** The Opposable Mind HMM remains an internal research method until it is executable and verified.

## 4. Platform layers required for a user-operated workflow

| Layer | Current evidence | Proposed responsibility | Failure if missing |
|---|---|---|---|
| **1. User surface / room context** | Existing commands, MCP tools, session-to-room binding, gates, and opportunity-bank operations. | Ask for objective, scope, desired outcome, constraints, and privacy class. Show what room sources were selected. Let a user choose an engine or accept a reasoned recommendation. | The user must know hidden engine vocabulary or Jonathan must manually interpret the room. |
| **2. Theo / framework guidance** | Theo binding and GraphRAG briefs exist in the research bundle; system-thinking review notes Theo’s available tools guide/retrieve frameworks but do not themselves inspect arbitrary case artifacts. Orchestrator prompt can apply frameworks to host-provided context. | Theo should recommend and explain the framework for a specific transformation (e.g. system map before gap scan; bottleneck before analogy). Host supplies bounded, permitted evidence and asks Theo to review stage outputs. | “Theo monitored the research” becomes an unsupported claim; framework guidance floats independently from actual artifacts. |
| **3. Objective and evidence preparation** | Quick research code has bounded local room checks and run folders. No single universal prepared-corpus contract for all package engines verified. | Select files by room/path/type; extract text; preserve source URI/path, checksum, version/time, permissions, and relevant spans. Avoid embeddings until selected method requires them. | Engines consume inconsistent, incomplete, or untraceable context; room updates invalidate prior interpretations without notice. |
| **4. Workflow/router** | Intelligence-orchestrator describes one reach per beat, offer-not-fire, gates, filing truth states. Research facade supports perspective operations and planning. | Select one primary job and optionally a dependent follow-up based on explicit trigger and expected user value. Explain recommendation and let the user redirect. Keep “portfolio scout” separate from “deep dive this candidate.” | Engine fan-out produces a large noisy pile; workflow duplicates work or silently chains expensive actions. |
| **5. Engine runner / adapters** | Mindrian uses Node MCP modules; package contains Node, Python, scripts, prompts, and data. Current `research_run` facade explicitly states it contains no engine logic. | Normalize invocation, validate inputs, isolate Python/native dependencies as needed, enforce timeout/cancel, capture stdout/errors, run/version metadata, and map outputs into a shared result contract. | A nominal MCP tool may fail due to Python environment, missing model, CLI quoting, native crash, or incompatible output while appearing like “no candidates.” |
| **6. Evidence/research planner** | `research_run` includes exact search approval, query revalidation, public-index fetch, audit, evidence rows/cards, run state, and gated file operation. | Reuse this path for external retrieval. Keep raw room source text local unless separately consented. Each claim needs source pointer and quote/hash/record identity as applicable. | Package-specific fetchers may bypass approval, leak room text, or create results with ambiguous provenance. |
| **7. Opportunity portfolio and graph** | Per-room opportunity-bank exists; cross-room aggregation/store exists but is narrower than a complete evidence-rich opportunity lifecycle. The desired compounding portfolio is not just one active-room answer. | Store every candidate as a versioned, linked record with status (candidate, evidence-gathering, decision-ready, pursued, parked, rejected), rationale, evidence/counterevidence, expiry/review date, and cross-room links. Preserve rejected candidates and why. | Candidates get lost, duplicated, silently promoted, or treated as validated because they recur in multiple rooms. |
| **8. Persistence / job control** | Research runs persist under `.mindrian/research-runs/<run_id>/`; some approval state is intentionally session/process scoped. No general long-running engine job queue/scheduler verified. | Persist jobs, checkpoints, idempotency keys, status, retry policy, cancellation, output artifacts, and resumable approval state. Treat session-scoped gates as approvals, not a durable job scheduler. | Crashes or restarts lose work; repeated calls duplicate paid or external actions; a sleep event looks like a negative result. |
| **9. Runtime and isolation** | Existing host is Node plus package Python scripts and dependencies; MCP is a calling/interface protocol, not a Python virtualenv or container. | Start with one host process plus child processes for Python jobs and per-family pinned virtual environments. Use containers only where native deps, untrusted code, deployment reproducibility, or resource quotas justify them. | Installing all dependencies globally creates conflicts; assuming MCP isolates code creates a false security boundary. |
| **10. Optional remote worker / service** | Not established in MindrianOS code. Sprites docs describe persistent disk, sleeping processes, Services restarting on wake, and private-by-default URL access. | Later send only a minimized, user-approved research capsule (objective, allowed excerpts or redacted candidate data, exact queries) to a remote job service with tenant/job auth, retention, egress policy, deletion, and return provenance. | A local-first promise is violated; sleeping worker loses in-memory progress; service endpoint or broad corpus export creates a confidentiality breach. |
| **11. Evaluation and learning** | Package review includes offline checks and limited prototypes. No production-quality end-to-end benchmark or automatic feedback-learning loop established. | Record human accept/reject/defer plus reason, compare outcomes with baseline, and use feedback only through an explicit versioned ranking/evaluation process. | The product claims it “learns” while merely storing decisions; popularity/repetition is mistaken for quality. |

MCP’s official docs distinguish prompts, resources, and tools by control: prompts are user-controlled templates, resources are application-controlled context, and tools are model-selected actions. That supports the interface choice, but MCP does not provide Mindrian’s business workflow, job persistence, safety policy, or engine runtime. [MCP server primitives](https://modelcontextprotocol.io/specification/draft/server/index) · [Current TypeScript SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/)

## 5. What the user workflow should feel like

### User asks for a portfolio scan

1. **Frame:** “Find opportunities in this room around [objective].” MindrianOS confirms room, scope, constraints, and whether the user wants local-only discovery or approved external research.
2. **Prepare:** list the material set and show exclusions/unsupported formats. Build a traceable local snapshot. Do not send it anywhere.
3. **Diagnose:** run a low-cost local pass (bottleneck and/or coverage gap) only where each adds a distinct view. Theo/framework guidance helps interpret which diagnostic to use; it does not silently substitute for the analysis.
4. **Discover:** invoke one or more justified candidate generators (e.g. breakthrough pairs or local analogy recall). Enforce candidate count/diversity caps and keep all results in candidate state.
5. **Triage:** merge duplicates; explain why each candidate exists; show source references, mechanism hypothesis, novelty uncertainty, and the next question. The user selects candidates for deep dive.
6. **Research:** form exact public search queries and show the egress gate. Only approved query strings go out. Search records return with identifiers and source pointers; do not treat search rank as evidence quality.
7. **Map/challenge:** use Structural Analogy Mapper only for a selected source-target pair; use Differential Claim Critic for genuinely competing claims; use existing governed BONO when deliberation is needed. Theo reviews the stage logic and missing checks using supplied artifacts.
8. **Decide and accumulate:** user marks pursue, defer, reject, or needs evidence. Mindrian stores a decision-ready opportunity with supporting and opposing evidence, reasons, and next test. Related leads from other rooms are linked only where permitted.

### Separate portfolio mode from deep-dive mode

- **Scout portfolio:** broad room-local scan; economical and repeatable; outputs a diverse, ranked queue of candidates with thin evidence and explicit uncertainties.
- **Deep dive:** one selected candidate; controlled external research; analogy mapping/critique; decision brief and experiment. More costly and approval-heavy.

This two-mode split prevents the common failure of running every engine on every item. It also fits the user's intent to compound multiple opportunities, rather than treating the only opened room as the only opportunity.

## 6. Proposed common engine contract

Every engine adapter should produce a common **Research Result Envelope**, even if its inner payload differs:

```json
{
  "job_id": "stable job handle",
  "capability": "bottleneck.find",
  "capability_version": "semver or source revision",
  "status": "completed | partial | needs_input | blocked | failed | cancelled",
  "scope": { "room_id": "...", "snapshot_id": "...", "source_refs": ["..."] },
  "method": { "name": "...", "configuration": {}, "model_or_dependency": "..." },
  "egress": { "occurred": false, "approved_query_ids": [] },
  "outputs": [{ "kind": "candidate | gap | mapping | critique", "id": "...", "content": {}, "source_refs": [] }],
  "uncertainties": [],
  "warnings": [],
  "resource_use": { "duration_ms": 0, "estimated_cost": null },
  "next_actions": []
}
```

The contract distinguishes **failed** from **completed with no candidates**, and **candidate hypothesis** from **supported claim**. It also allows one user-facing workflow to select engines without requiring their internal data structures to match. Do not use a free-text JSON blob as the sole provenance record; stable source IDs and run identity are required.

## 7. Runtime architecture: local first, remote later

```text
User / Claude host
  └─ MindrianOS room-bound MCP facade
       ├─ Theo-guided workflow (framework selection + review, host has context)
       ├─ Portfolio Scout / Deep Dive workflow state
       ├─ shared permissions, egress grants, audit and approval gates
       ├─ local room snapshot + provenance index
       ├─ Node capability modules
       └─ bounded Python child jobs (pinned per-family virtualenvs)
            ├─ HSI / whitespace
            ├─ RS
            ├─ SME mapping
            └─ future validated modules

Results → shared result envelope → candidate portfolio → human decision
                        │
                        └─ optional approved research capsule → remote worker
                            (not raw room by default; returns source/run provenance)
```

### Local runtime recommendation

1. Keep MindrianOS as the local policy and room-data authority.
2. Keep engine code in-process only when it is trusted, small, Node-native, and easy to cancel. For Python or native numerical libraries, invoke a bounded child process.
3. Give each Python family a reproducible virtual environment and lock/pin dependencies. Python packaging guidance describes virtual environments as isolated project environments. [Python packaging guide](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)
4. Add a container only when isolation/resource constraints or platform reproducibility justify the cost. Docker uses namespaces and cgroups for isolation/accounting, but its own docs warn that default configuration can provide incomplete isolation; a container is not equivalent to a complete data-loss prevention boundary. [Docker Engine security](https://docs.docker.com/engine/security/)
5. Treat the MCP server as a doorway and protocol adapter. The job runner is the component that owns subprocess timeouts, cancellation, output capture, resource limits, and dependency environments.

### Optional Sprite / remote paid service

Sprites can be useful for opt-in remote jobs, but not as the first execution dependency. Their docs state that disk persists while RAM and running processes do not; Services restart when a Sprite wakes, and URL access is private by default. Therefore, a submitted job must be durably recorded outside transient process memory and safely resumable. [Sprites lifecycle and services](https://docs.sprites.dev/working-with-sprites/)

For a paid remote service, MindrianOS should send a **research capsule**, not a room mount: user objective, selected/redacted snippets or derived structures, explicit permitted sources, approved queries, expiry, and a job token. Require user consent to that exact capsule and its destination. Return only attributable findings and source records. Offer cancellation and deletion. This is a proposed product policy; the current code’s local quick-search policy does not implement a Sprite service.

## 8. Portfolio model and compounding effect

The value compounds when the system retains **qualified, context-bound findings and their failed tests**, not when it accumulates unreviewed text.

### Suggested portfolio states

`candidate → selected_for_deep_dive → evidence_gathering → decision_ready → pursued | parked | rejected`

These are proposed lifecycle states, not verified existing states. Each transition should be explicit, attributable, and reversible where appropriate. A “confirmed” claim is a separate truth status requiring evidence and human review; it must not be inferred merely from being in a portfolio.

### Suggested records/stocks

- **Room snapshots:** input file identifiers/checksums, scope, and preparation status.
- **Open questions:** decision-relevant questions and owners.
- **Candidates:** unique opportunity hypotheses, with duplicate/related links and current state.
- **Evidence / counterevidence:** immutable source records linked to a specific claim or question.
- **Assumptions:** items needing verification with expiry/review trigger.
- **Runs/jobs:** capability/version, inputs, status, permissions, outputs, resource use.
- **Human decisions:** accept/reject/defer, rationale, timestamp, and review identity.
- **Reusable patterns:** extracted mechanism with context limits and origin; never detach a principle from its source and mismatch conditions.
- **Review capacity:** queue size and human time available; candidate volume should be bounded by this capacity.

Mindrian already has room opportunity storage and cross-room structural data, but this research did not verify one unified cross-room opportunity ledger with the lifecycle and evidence semantics above. The first release can still accumulate within a room, then link across rooms through explicit, privacy-aware references.

## 9. Bottlenecks and feedback loops to validate

| Suspected constraint | Observable symptom | Current evidence | Small first measure |
|---|---|---|---|
| **Material preparation and traceability** | Users cannot tell what the engine read; repeated preparation; unsupported files silently disappear. | Quick research has a bounded local file scan; universal cross-engine snapshot contract not established. | For a fixed room, measure included/excluded files, extraction failures, and source-reference coverage in every candidate. |
| **Objective framing** | Engine produces technically valid but irrelevant output. | Orchestrator and research planner include question/gate structures; no end-to-end user success data. | Capture reframe edits and proportion of candidates users say address the stated decision. |
| **Candidate review capacity** | Candidate count rises while decision-ready count stays flat. | Package rankings generate candidate lists; production throughput unknown. | Track review minutes per accepted/parked/rejected candidate; cap scout outputs and compare. |
| **Method dependency failures** | Empty results are interpreted as “no opportunity” when a model/reducer failed. | Research package review documents unresolved encoder/install/runtime behavior for Eureka and UMAP abort handling for HSI. | Every run returns explicit status and method/dependency identity; measure failure/partial rates. |
| **Evidence and provenance** | Attractive analogy survives because no one can locate source or falsifier. | Research package has query provenance mismatch and reported off-topic retrieval. | Sample every decision-ready candidate and audit source IDs, exact query, quote/location, and counterevidence. |
| **Approval latency and friction** | Users bypass search or become habituated to approving generic gates. | Current path already uses approvals and exact query grants; actual human friction unknown. | Measure time to approve, changed/rejected query fraction, and completion abandonment. |
| **Portfolio decay** | Old candidates look current; external facts or deadlines expire. | No unified expiry/freshness policy verified. | Assign review-by date based on source volatility; alert only on source change or approaching decision. |

Hypothetical reinforcing loop: better provenance → faster review → more candidates assessed → more useful accepted findings → more trust and reuse. Hypothetical balancing loop: more candidate generation → review backlog → slower decisions → lower trust. The system should test both; it does not currently have evidence of automatic learning from stored rejections.

## 10. Selection and recommended sequencing

Qualitative ratings, based on package and platform review; they are judgments, not measured scores.

| Candidate | Structural fit | Potential impact | Feasibility | Test cost | Main risk | Recommendation |
|---|---|---|---|---|---|---|
| **Shared local result/provenance contract + job runner** | High | High | High/medium | Medium | Overdesigning an ontology before user pilot | Build the smallest contract and make failures explicit; this enables every later engine. |
| **Portfolio Scout using current local perspectives + RS/HSI audit** | High | High | Medium | Low/medium | Duplicating current implementations while assuming equivalence | Pilot only after code-level behavior comparison; user sees source-backed shortlist, not engine internals. |
| **Selected analogy → SME mapping → approved research** | High | High | Medium | Medium | Structural mapping may look authoritative despite weak representations | Strong deep-dive workflow after candidates are user-selected; explicitly show mismatch/falsifier. |
| **Always-on autonomous web scout** | Medium | Potentially high | Low | High | Egress/privacy, false positives, cost, alert/review overload, provenance | Defer until user-directed scout shows acceptable precision and a job queue/consent model exists. |
| **One separate MCP server per engine** | Low/medium | Low | Low/medium | Medium/high | Service/config/version sprawl, duplicate policy and state | Reject for the first architecture. Separate code modules and jobs; deploy separate servers only for a real trust/dependency boundary. |
| **Automatically run all seven on every room** | Low | Medium/uncertain | Low | High | Heterogeneous inputs, redundant candidates, evaluation burden | Reject. Select by user job and observed bottleneck. |

### Why the first implementation is a platform slice, not seven adapters

The shared result envelope, local snapshot/provenance, durable job status, and user-selected hiring flow solve dependencies common to all engines. Without them, an adapter can execute but cannot reliably produce a reviewable decision. The first thin slice should therefore prove one end-to-end job (recommend **Bottleneck Finder** or **Portfolio Gap Finder**, depending on which source audit is cleaner), then prove that a selected candidate can enter approved external research and the durable portfolio.

## 11. First experiment

### Pilot design

Use one bounded, authorized room with a source-versioned snapshot and a known decision. Compare:

- **Baseline:** current MindrianOS workflow / human route, with the same material and time budget.
- **Pilot:** local snapshot → one diagnostic job (Bottleneck Finder or Portfolio Gap Finder) → one candidate-generation perspective → user triage → one approved deep dive if selected.

Blind-review the resulting shortlist with two people familiar with the room domain. Score whether each candidate is: relevant to the stated decision; source-traceable; meaningfully distinct; has a stated mechanism; and has a testable next question. Also measure user time, run failures, missing-source rate, and review time. Do not use raw candidate count as success.

**Experiment statement:** “We will test a local Portfolio Scout on one authorized room snapshot over two review sessions, measuring source-traceable candidates accepted for a next test, reviewer time per accepted candidate, preparation failures, and user time. We will continue if reviewers find at least three distinct candidates worth a concrete next test and the workflow reduces human assembly time versus baseline without lowering provenance completeness. We will revise if useful candidates appear but preparation or review friction dominates. We will stop or redesign if the shortlist mostly repeats room labels, cannot trace its claims to sources, or fails to outperform the baseline.”

This threshold is a proposed pilot criterion, not an existing benchmark. If fewer than three suitable candidates are plausible in the chosen room, set the threshold before running based on the room’s known opportunity density.

## 12. Three most promising transfers and one hybrid

### A. Reproducible science → evidence-carrying candidates

**Mechanism:** A finding is reviewable when the question, method, inputs, observations, interpretation, and falsifier remain connected.  
**Transfer:** Every candidate carries source references, run/version, assumptions, counterevidence, and the next falsifying question.  
**Mismatch:** Metadata alone does not make a source true or a method valid.  
**Status:** Source principle verified at a general design level; usefulness in Mindrian is a hypothesis.

### B. Operating-system service boundaries → one governed host, modular capabilities

**Mechanism:** A stable host exposes capabilities through contracts while implementations can be replaced; callers do not need to know each implementation's internals.  
**Transfer:** MindrianOS owns room context, approval, audit, and portfolio; engine capabilities are replaceable modules/process jobs. Use MCP to expose user/model-callable functions and contextual surfaces, not as the job scheduler itself.  
**Mismatch:** A local Python child process and remote multi-tenant server have different trust requirements; one interface does not imply one security boundary.  
**Status:** MCP primitives verified in official docs; topology is an architectural proposal.

### C. Creative divergence/convergence + scientific falsification → portfolio scout and deep dive

**Mechanism:** Keep broad candidate generation separate from later selection and testing.  
**Transfer:** Portfolio Scout generates a bounded, diverse candidate set; user selection triggers evidence gathering and SME mapping; claims stay provisional until tested.  
**Mismatch:** The package's ranking does not yet demonstrate diversity or superior quality.  
**Status:** Workflow hypothesis; test against a baseline.

### Hybrid: “Scout → Select → Challenge”

1. Local diagnostic mechanisms identify bottlenecks and uncovered space.
2. One candidate generator finds unusual pairings or cross-field mechanisms.
3. User selection limits expensive work.
4. Structural mapping tests whether the analogy's relations transfer.
5. Approved evidence gathering tests candidate inferences and their falsifiers.
6. Portfolio persistence records both outcomes and reasons.

The combination can outperform any single engine because it separates **where to look**, **what might work**, and **whether the mechanism survives scrutiny**. Its additional complexity is justified only if each stage reduces a known failure: blind search, weak candidates, unsupported analogy, or forgotten learning. Test the interaction by comparing the full sequence to each stage’s baseline on the same snapshot, not merely showing that each component returns output.

## 13. Critical uncertainties and verification work

### Before committing to implementation

1. Confirm exact installed/released MindrianOS version; reconcile beta.70 package vs beta.69 shrinkwrap.
2. Perform an equivalence audit: current `/mos:eureka`, whitespace, analogies, reverse-salient, and research perspectives versus package code. Do not infer parity from matching names.
3. Freeze per-engine JSON/input-output contracts and accepted status vocabulary. Explicitly distinguish failed, skipped, empty, partial, and successful runs.
4. Reconcile the research bundle's query approval/provenance mismatch before using any stored external results as evidence.
5. Resolve privacy classes and egress semantics: local text, derived structure, generic query, and approved excerpt are separate data categories.
6. Identify the source of truth for the opportunity portfolio across rooms and the consent rules for cross-room links.
7. Establish a representative baseline and evaluator rubric before ranking claims are used to route user attention.

### Before calling individual engines production-ready

- **Eureka:** real dependency install, Windows invocation, missing-status behavior, health checks, representative pair ranking vs baseline.
- **HSI:** choose/record reducer behavior; test native UMAP abort/recovery; explain effects of embedding model and corpus size.
- **Analogies:** verify live retrieval, source IDs, generic-query policy, embedding/library behavior, diversity, and structural-fit calibration.
- **Algorithms:** separately validate Genesis pipeline/citations; define Jason task and judge calibration; keep Opposable Mind as non-executable until evidenced.
- **BONO:** review package code and compare it line-by-line with the current governed MindrianOS workflow.
- **RS:** close truncation/whitespace/caller/network/model questions; ensure “no bottleneck” is distinct from analysis failure.
- **SME:** validate a real user problem, encoding sensitivity, alternative mappings, and the limits of candidate inference; implement access/retrieval separately.
- **Graph relations (adjacent prototype, not one of the seven):** ranking should remain experimental; the package review reports a temporal backtest with zero later edges in the top 200 for every compared method including baseline.

### Security and privacy verification

- For local execution, run engines with the minimum room paths and no inherited secrets they do not need.
- For network-enabled retrieval, route through the shared planner and log only the exact approved query and source metadata needed for audit.
- For remote execution, verify worker authentication, tenant separation, network egress, retention, deletion, backup handling, and reproducible job recovery before sending any nonpublic material.
- A container can help isolate processes and limit resources, but Docker docs explicitly discuss incomplete isolation risks and external connectivity. The data policy must be enforced by the host/runtime and network policy, not inferred from “containerized.”

## Sources

### Local source set

- Research bundle: `LATEST/README.md`, `REVIEW.md`, `INTEGRATION-RESEARCH.md`, `workflow/CONTEXT.md`, and all seven per-engine workflow contracts.
- MindrianOS: `package.json`, `npm-shrinkwrap.json`, `lib/mcp/tools/research.cjs`, `lib/core/research-planner/quick.cjs`, `skills/intelligence-orchestrator/SKILL.md`, `lib/core/opportunity-ops.cjs`, `lib/core/cross-room-aggregator.cjs`, `lib/core/cross-room-store.cjs`.
- Earlier systems analysis and Theo review: `docs/design/mindrian-opportunity-portfolio-system.md`, `docs/design/theo-systems-thinking-review.md`.

### External primary documentation

- [MCP server primitives](https://modelcontextprotocol.io/specification/draft/server/index) and [current TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/) — tools, resources, prompts and the current SDK surface. The repo's installed MCP package/version should be checked separately before upgrading.
- [Python Packaging User Guide: installing packages in virtual environments](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/) — dependency isolation.
- [Docker Engine security](https://docs.docker.com/engine/security/) — namespaces, cgroups, network behavior, and isolation limitations.
- [Sprites: working with Sprites](https://docs.sprites.dev/working-with-sprites/) — disk/process persistence, sleep/wake, services, and URL access defaults.

