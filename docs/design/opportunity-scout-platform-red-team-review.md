# Red-team review: opportunity-scout platform feasibility research

**Reviewed:** 18 October 2026  
**Target:** `docs/design/opportunity-scout-platform-deep-research.md`  
**Review type:** adversarial design and evidence review. This review inspected cited local implementation/docs and the report; it did not run package tests, execute engine code, or conduct a formal security assessment.

## Verdict

The report is a useful architecture hypothesis, but it is **not yet a verified feasibility case or build-ready specification**. Its strongest points are the distinction between candidate generation and evidence, the separation of current MindrianOS routes from package copies, and its recognition that user workflow and provenance matter more than engine count.

The main red-team concern is that a plausible architecture is being described with some of the confidence of an implemented system. The report should be treated as **conditional feasibility** until data egress, engine execution contracts, room/portfolio boundaries, and a fair pilot are resolved.

## Findings

### P1 — “Local-first” is not the same as “data stays local”

**Where:** target report sections 1–2, 5, 7, and 11.

**Attack:** A user may ingest confidential material locally, then ask Theo or a model host to frame, summarize, encode, critique, or generate queries from it. If inference runs through a hosted provider, source text or derived sensitive facts may leave the machine even when files and Python engines run locally. The report correctly treats a remote worker as separate egress, but its language can still lead a user to infer that a local workflow keeps the whole analysis local.

**Evidence:** Local source execution does not establish local model inference. `research_run` explicitly controls its own quick-search strings, but that is not a general statement about every model call in the host or every engine route.

**Required correction:** Define separate data paths and labels: (a) file/process locality, (b) model inference destination, (c) web/search egress, (d) remote worker transfer, and (e) persistence/telemetry. For each, state which fields leave, provider/account, retention boundary, and user/institution approval basis. Use “local execution with hosted inference” when that is the actual configuration.

**Release gate:** For any confidential deployment, record the approved account/provider and verify what the host sends to it. Approval for one model or service must not be inferred to cover another.

### P1 — Approval guarantees are scoped to a path, not to all engines

**Where:** target report sections 1, 5–7, and 13.

**Attack:** A package engine such as RS fetch, Analogies external mode, or Genesis may call its own provider/search integration. Routing all searches through `research_run` is a design requirement, not observed behavior. A tool-level gate in one facade does not constrain sibling commands, subprocesses, inherited credentials, or HTTP clients.

**Evidence:** `lib/mcp/tools/research.cjs` documents its exact egress behavior and says the facade holds no engine logic. Package commands declare different tools/fetchers. The report itself says package integrations and callers remain unverified, but later workflow language says “only approved query strings go out” without consistently limiting that claim to the governed path.

**Required correction:** Mark every outbound-capable engine route as **disabled until proven to call the shared planner**. Enforce at the runner boundary: deny network by default for local jobs; for research jobs accept only approved query IDs/strings; do not expose broad environment API keys to engine processes. Audit process-level network behavior and tool permissions before enabling each route.

**Release gate:** An engine is egress-ready only after tests demonstrate that no request occurs before approval, only approved fields are sent, refusal/offline mode sends nothing, and the audit matches actual requests.

### P1 — The proposed result envelope is too weak to establish provenance or safe replay

**Where:** target report section 6.

**Attack:** The envelope can say `egress.occurred: false` and provide `source_refs`, but nothing guarantees those declarations are truthful, binds the output to immutable input contents, or supports investigating a provider/network request after a disputed result. A mutable path such as `room/foo.md` is not a durable source identity. `capability_version` as semver or source revision is underspecified.

**Required correction:** Add at least:

- immutable input snapshot/document hashes, parser/extractor versions, and exact spans or row IDs;
- engine artifact digest/source revision, dependency lock digest, config hash, and model/provider identifier when applicable;
- trusted runner-generated egress events (request ID, destination class, approved query ID, timestamp, response/source IDs), separate from engine-declared metadata;
- output schema version, exit code/signal, timeout/cancel state, stdout/stderr references with secret redaction, and retry/idempotency key;
- content license/usage metadata and retention/deletion policy for retrieved sources;
- lineage links from candidate → claim/question → supporting and opposing evidence → decision.

The runner, not an engine, must author authoritative egress and execution facts.

### P1 — Cross-room portfolio accumulation may cross a privacy boundary

**Where:** target report sections 2, 4, and 8.

**Attack:** A portfolio that compounds across rooms can expose project existence, technology names, relationships, or decision status even if it stores only “scalar” cross-room edges. The report notices the current cross-room store is limited, but its proposed lifecycle does not specify tenant/owner boundaries, consent, per-room ACL checks, revocation, or what metadata is safe to aggregate.

**Required correction:** Define portfolio scope as one of: room-only; user-owned private index across explicitly opted-in rooms; or organization/shared portfolio. Start with room-only. For cross-room links, store opaque IDs and reauthorize reads on every traversal. Deletion and permission revocation must remove or suppress derived links. Do not treat scalar metadata as automatically non-sensitive.

### P1 — “Achievable” is too broad until user independence is measured

**Where:** executive assessment and first implementation recommendation.

**Attack:** The report proves that a workflow can be designed from existing components; it does not show that a user can perform the job without an expert operating the process. The current tool interface is an `op` multiplexer and several commands require choosing technical modes. A self-service workflow needs objective clarification, transparent engine selection, failure recovery, and user-understandable next actions.

**Required correction:** Phrase feasibility conditionally: “The local, user-directed workflow appears technically feasible; user independence and decision usefulness are unvalidated.” Define the user task and completion criteria before calling the platform achievable.

### P2 — MCP topology is recommended before usability and capability discovery are tested

**Where:** target report sections 1, 4, 7, and 10.

**Attack:** “One unified engine capability boundary” is not sufficiently precise. One server with many low-level tools can overwhelm tool discovery; a single `research_run` multiplexer can hide high-impact actions inside a wide `op` schema. Conversely, multiple MCP servers are not inherently bad when Python dependency or trust boundaries differ. MCP is a protocol boundary; it does not require one topology.

**Required correction:** Compare three actual host UX shapes with a user: (1) one high-level `opportunity_scout` workflow tool; (2) a workflow tool plus a small set of specialized tools; (3) separate server for an actual isolated runtime. Keep low-level engine operations internal unless users need them. Decide topology after measuring discoverability, approval clarity, and failure isolation.

### P2 — “Use one diagnostic + one generator” does not resolve engine-selection logic

**Where:** target report sections 5, 10, and 11.

**Attack:** “Run a bottleneck finder or gap finder, then a candidate generator” still assumes the router can infer which diagnostic applies, that both consume compatible prepared inputs, and that their outputs can be safely chained. The research prompt asks that actual behavior be verified; the report does not establish a common corpus/input contract for any complete set of engines.

**Required correction:** For the first pilot, make method selection explicit (one workflow, one engine, one bounded input) or use a deterministic user-selected route. Do not present automatic router selection as proven until a routing benchmark establishes correct method choice and safe degradation.

### P2 — The pilot’s “three candidates” threshold and two-reviewer setup can mislead

**Where:** target report section 11.

**Attack:** Three accepted candidates on one corpus could be too strict for a narrow scope and too easy for a large one. Two reviewers can disagree substantially, and candidates selected from a previously curated set are not an independent ground truth. “Blind review” is not truly blind if reviewers see source artifacts or recognize known candidates. The report's baseline is not operationally defined.

**Required correction:** Separate a **workflow/usability pilot** from a **quality/efficacy evaluation**. For the workflow pilot, measure setup time, successful completion, intervention count, error recovery, provenance completeness, and user ability to explain the next step. For efficacy, freeze a corpus snapshot and rubric before the run; compare against a documented human/current-process baseline; randomize candidate presentation and conceal method labels; have reviewers score independently; report agreement and adjudication; normalize yield by candidate/reviewer hours. Do not use candidate count as the sole threshold.

### P2 — The portfolio lifecycle risks conflating opportunity status with claim truth

**Where:** target report section 8.

**Attack:** `decision_ready → pursued | parked | rejected` is a business disposition; “confirmed” is an epistemic status. One state machine can accidentally promote a candidate to truth because a human chose to pursue it, or imply a rejection proves the underlying hypothesis false.

**Required correction:** Model two axes: `opportunity_disposition` (candidate, investigating, pursue, park, reject) and `claim_status` (unassessed, supported, contested, refuted, stale). Record who made each decision and the evidence basis. A pursued opportunity may still rest on unverified claims; a rejected lead can remain scientifically plausible.

### P2 — The package-version warning is overstated

**Where:** target report lines 4 and 29–31.

**Attack:** Package and shrinkwrap version disagreement is real, but by itself it does not prove a non-reproducible install. The report jumps from metadata mismatch to “weakens confidence a clean install reproduces the reviewed source.” That is a hygiene concern, not yet a demonstrated installation defect.

**Required correction:** Rephrase as “release metadata is inconsistent; inspect the lockfile and perform a clean install/build before pilot.” Do not assign causal impact without installation evidence.

### P3 — Alternatives are prematurely narrowed

**Where:** target report sections 10 and 12.

**Attack:** The report recommends RS/HSI diagnostics, but both have open implementation questions. In any room, the immediate constraint may be source/data readiness, objective framing, evaluator criteria, or an unavailable model—not a bottleneck diagnosis. A proposed workflow cannot assume a room's existing metrics or artifacts are compatible without checking their origin and structure.

**Required correction:** Make pilot-engine choice conditional on an implementation audit. First run a manual, low-cost benchmark of the actual current route versus one candidate engine on a frozen room subset; select whichever has the cleanest local contract and observable value. Keep HSI/RS as alternatives, not presumed first picks.

## Additional adversarial questions the report should answer

1. Can prompt-injected room content cause the model to invoke external tools, expose other room paths, or overwrite candidate records?
2. What prevents a child process from reading unrelated files, environment secrets, or other room data? Does it inherit the full environment and home directory?
3. Are package fetchers and model prompts allowed to transmit raw user topics, filenames, researcher names, or technology descriptions?
4. What happens when the host crashes after an external request succeeds but before the audit/result is persisted? Can retries duplicate requests or charges?
5. Can a user cancel a job, revoke its grant, delete its corpus snapshot, and verify the derived portfolio entries are removed?
6. How are stale sources, withdrawn papers, changed patents, or updated room artifacts surfaced to candidate owners?
7. Can an engine's score be calibrated across different versions, corpus sizes, and missing-source conditions? If not, are scores shown only within-run and labelled accordingly?
8. Is a “candidate opportunity” scientifically, commercially, or operationally actionable, and which evidence class supports each dimension?
9. Does the host/provider account retain or train on submitted content under its configured terms? The local filesystem architecture cannot answer this.
10. Is the user experience still self-service when the engine fails with a native crash, unavailable model, no API key, unsupported file, or zero candidate result?

## Required changes before treating the report as build-ready

1. Amend the privacy section to distinguish local processing from hosted model inference and all other egress.
2. Scope egress guarantees to the audited `research_run` path; disable package-specific fetchers until each is proven to share that control.
3. Strengthen the execution/evidence contract with runner-authored provenance, input hashes, dependency/model identity, and durable job lifecycle facts.
4. Define room-only portfolio access first; write explicit cross-room authorization and deletion semantics before aggregation.
5. Separate opportunity disposition from truth status.
6. Replace the single “three candidates” pilot gate with predefined usability and quality measures, a documented baseline, independent scoring, and a candidate-hour denominator.
7. Rephrase “achievable” as a conditional architecture assessment pending a self-service pilot.
8. Rephrase package/shrinkwrap mismatch as a release hygiene issue pending clean-install verification.

## Positive findings that survive red-team review

- Current Eureka perspective is correctly distinguished from the retired standalone engine.
- RS is correctly decomposed into different jobs, and `rs-experts` is correctly identified as unavailable without Aura transport.
- SME is correctly described as a mapper, not a retriever or validator; its score is not truth.
- Current `research_run` is a real, bounded approval path; its controls should be reused where appropriate.
- Rejecting “run every engine” and “one MCP server per engine” as defaults is reasonable, provided topology remains a measured product choice.
- The report separates source-grounded implementation observations from proposed platform design, though it should make that distinction even more explicit in the revised sections identified above.

## Red-team conclusion

Proceed to a **bounded prototype**, not an all-engine integration. First resolve the model-provider data path, then freeze one room snapshot and one user job. Keep external-capable engine routes disabled unless they use verified shared approval and auditing. Make the prototype fail visibly and resumably. Only claim user independence after a user completes the task without a developer selecting methods, repairing inputs, interpreting hidden failures, or manually moving results between tools.

