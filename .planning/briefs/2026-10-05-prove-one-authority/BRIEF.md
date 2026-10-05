# MindrianOS: prove one authority, then generalize
## Consolidated implementation brief

Date: 5 October 2026  
Status: Proposed developer brief, not a ratified architecture or implementation sign-off.  
Basis: The two field investigations, Lawrence's subsequent architectural critique, and the repository excerpts retrieved in this conversation. No new repository audit, endpoint probe, implementation, or test execution was performed for this consolidation. Nothing was sent, committed, or written to a Mindrian room.

## 1. Decision

**Fix Room Identity end-to-end first. Extract the reusable authority pattern from that working fix. Apply it to the next consequential failure without introducing another parallel architecture.**

The combined problem is not primarily too many files, tools, or ledgers. It is that some paths independently establish the same state, while other paths report a state without establishing that the required work happened.

Lawrence's two formulations capture the diagnosis:

> First decide which component has authority for each job.
>
> The system reports a state it has not reached, and the report carries no marker of the gap.

The first architectural slice should therefore be a working room lifecycle, not five or six authority specifications written in parallel. Existing urgent repair work, including research integrity in Phase 369.2, should not wait for a new ontology.

The target loop remains:

**Workspace defines the job. Theo recommends a method. Mindrian selects an admissible action. The runtime executes and records the outcome. Existing room writers persist the result. Verification controls promotion. The human retains consequential decision authority.**

This is a proposed allocation of responsibilities, not proof that every connection already exists.

## 2. Evidence and limits

### What the field investigations establish

The Eliezer/Tnufa report describes a Windows/VS Code session in beta.57 where room.db existed but registration failed; governed MCP writes were refused and host filesystem writes were used; room indicators disagreed; and meeting claims lacked provenance edges. It also records a user judgment that the product was stronger at phrasing and surveying than at producing unexpected insights. These are that report's observations, not reproductions performed in this consolidation. [S1: sections 2.A-C, 2.F, R14-R15, Appendix B-C]

Lawrence's reports describe a different session where eleven artifacts accumulated without a room database. They report that governed writes worked after a database was created, that one failed research lane had substantial evidence on disk, and that declared document relationships were not reflected in the expected graph relationships. The same reports preserve the verification floor's successful refusal to promote an insufficiently checked premise. [S2: sections 2-6; S3: sections 2-6]

These observations support a common failure class. They do **not** establish that every host followed the same faulty code path.

### What the repository inspection adds

Earlier retrieved Mindrian source includes shared room-resolution and write-scope functions, an edge writer with a separate `written` result, room-readiness checking and registry-failure handling, a unified in-memory gate ledger with optional durable observers, and research execution-truth requirements in Phase 369.2. These are existing starting points, not reasons to build replacements. [S5]

Some earlier status records say a defect was open while later source excerpts show a related fix. Search results identified commit `ad0704e39433063748b2f19948a288491a37bdf9`, while file fetches also used moving `main`. This consolidation does not certify an installed release or a cross-host test result. Pin the actual baseline before editing.

Use qualified source identifiers in the implementation ledger. `TNUFA.D6` means governed writes refused; `LAWRENCE.D6` means counterevidence omitted. `TNUFA.R3` is a redundancy entry about next-move mechanisms; `LAWRENCE.R3` is the missing graph finding. Do not merge these identifiers merely because their suffixes match.

### What this consolidation corrects in the earlier recommendations

- Authority is a cross-cutting ownership property, not a new numbered layer system.
- A source-visible fix is not evidence of a deployed, tested fix on another host.
- A room anchor establishes location, not evidentiary support for a claim.
- An observed call or a file's existence is not, by itself, proof that the promised operation succeeded.
- Framework availability in Theo is not equivalent to an executable local implementation.
- Different source, release, installed, and runtime version labels are not inherently inconsistent. They become a defect when their meanings or provenance are conflated.

## 3. The minimum rule to implement

> **Only the designated owner may commit a consequential domain-state transition. A report of completion must be derived from that committed state and the contract's required checks. Missing or failed checks must remain visible downstream.**

This is the proposed operational form of the authority-and-attestation idea.

Do not collapse the jobs involved. A human supplies a decision. A gate mechanism validates its identity, scope and use. The transition owner changes the relevant domain state. The designated recorder persists the canonical outcome. A renderer displays it. Observers may record attempts and failures, but those observations cannot substitute for successful domain transitions.

In particular, **approved, applied, and read back are different states**. Approval can be recorded even when its requested effect fails; the failed effect must not be reported as completed. Single-use consumption and persistence must be designed for retries and crashes, not assumed correct simply because a ledger is consumed after an operation.

Attestation here means evidence that specified postconditions were reached. It does not prove that an interpretation is true, that a source supports the exact proposition, or that a human understood an explanation.

### Relation to existing architecture

Keep the existing Layer Contract, canon parts, MWP/ICM terminology, and interaction shapes. Add ownership to the existing component map:

`job | existing component | layer | decision owner | transition writer | evidence/readback | consumers | failure state | test`

Do not invent a one-to-one mapping between these different schemes. The exact mapping to Mindrian's Layer Contract must be read from that contract before implementation.

## 4. First worked example: Room Identity and readiness

### The question to make reliable

**For this session and this operation, what is the authorized target room, and is that room ready for the requested operation?**

This is not a demand for one global active-room pointer. The existing session model permits a bound set of rooms and a primary/default room. Preserve that distinction and legitimate nested-room scope. Identity, authorization, and readiness are related but separate checks. [S5: `session-binding.cjs`, `resolve-active-room.cjs`, `session-room.cjs`]

### Reuse the existing seams

| Existing location | Role in the first slice |
|---|---|
| `lib/core/navigation/room-birth.cjs` | Complete creation and readiness checking at the existing owner. |
| `lib/core/resolve-active-room.cjs` | Reconcile shared resolution rules instead of adding another resolver. |
| `lib/core/session-binding.cjs` | Read and write session scope; preserve bound-set and primary semantics. |
| `lib/mcp/session-room.cjs` | Keep MCP as an adapter to shared resolution/write authorization. |
| `scripts/room-registry`, `lib/core/room-open.cjs` | Address observed compatibility and diagnostic-loss failures. |
| `scripts/write-scope-check.cjs` and affected status/hook readers | Align supported callers and visible state with the same tested rules. |

Inspect exact symbols and callers at the pinned baseline. These paths are implementation candidates from prior reads, not a claim that each needs modification.

### Completion must be demonstrated

For a supported interactive creation path, show that the room's canonical path is correctly resolved; the database exists and supports the required operations; the canonical Room node exists; registration resolves to that same room; and the initiating session's binding reads back correctly. A controlled governed write/read test must target that room rather than a previous room.

A noninteractive migration or repair may have no session binding requirement. Record that as not applicable, not failed or silently absent. A view-cache refresh need not block all room use; required checks should correspond to the operation being authorized.

The earlier `_verifyRoomReady()` excerpt is the starting point. The inspected binding write was still described as fire-and-forget, and the Room-node insertion appeared in the born-wired sub-room branch. Extend and test those boundaries where they still fail; do not replace the entire birth implementation by assumption. [S5]

### Required failure tests

| Injected condition | Required observable outcome |
|---|---|
| Database missing, corrupt, or not writable | No ready-to-write result. A typed reason names the failed requirement. |
| Registration fails after scaffolding | No successful birth claim; explicit recoverable partial state or verified rollback. |
| Interactive binding cannot be persisted | Do not report that the session is operating in the newborn room. |
| Two sessions bind different rooms | Neither session's operation is redirected by the other's primary selection. |
| Parent and child rooms are involved | Preserve authorized nesting and resolve the actual target, not merely the first path segment. |
| Status is requested outside the room directory | Display the session's resolution or a labeled fallback, not invented emptiness. |
| Governed write is refused | No silent filesystem substitute represented as a governed filing. |
| Retry follows a partial failure | Resume, reconcile, or refuse explicitly without duplicating or damaging existing work. |

Tests should include the reported Windows/path/runtime shapes and the documented macOS compatibility shape on environments actually available. Report unexecuted matrix legs as untested. Never erase pre-existing user work as a generic rollback strategy.

### Done means a working sequence

**Create -> register -> bind -> inspect -> governed write -> read back -> restart/reconnect -> inspect again.**

The negative test must first fail for the intended reason. Then the actual remediation must make the same operation work. A test that merely detects a refusal is not a recovery test.

Only after this works, extract the small template:

`state | owner | evidence | legal transition | readback | failure behavior | projections`

No generic authority framework is required to finish this slice.

## 5. Where Theo, Workspace Architect, and runtime patterns fit

### Theo advises; local code resolves and executes

The proposed loop is:

`local room state -> permitted methodology descriptors -> Theo recommendation -> local capability resolution -> navigation decision -> execution contract -> observed outcome -> governed filing/readback`

Theo supplies framework definitions, relationships, alternatives, and methodological sequence suggestions. Mindrian owns whether a recommendation fits the current room, available evidence, capabilities, constraints, and approvals.

A recommendation is a semantic handle, not arbitrary executable code. A local mapping must verify whether that framework can be executed on this surface. A retrieved definition, draft orchestration record, instruction-only command, runnable capability, attempted execution, and verified effect are distinct conditions. Use existing status vocabularies where possible; these distinctions are not a requirement to add another universal enum.

If a framework has no runnable implementation, the system may use its retrieved material for explicitly labeled assisted reasoning. It must not claim the missing workflow executed.

A bounded chain can be recommended, but continuation should be reassessed at checkpoints. Changing evidence can make the original remainder inappropriate. No need to query Theo on every turn.

### The endpoint boundary remains to be checked

Lawrence proposes that Theo-specific interaction doctrine about Larry's Ask/Tell behavior, turn counts, or earned insight be removed from the methodology service contract. This consolidation adopts that responsibility boundary as a **proposal**, not as proof of what the current endpoint contains. [S4]

The narrow next probe is to capture current endpoint instructions and classify methodology guidance, interaction policy, and necessary service-use/privacy/safety constraints separately. Determine each call path's actual endpoint before changing configuration. Preserve protective service constraints. Do not send room content to Theo to conduct this probe.

### Borrow from Workspace Architect

The useful source patterns are Product / Factory / Process, explicit Inputs / Process / Outputs, focused context loading, separation of stable references from working artifacts, and editable intermediate outputs. The retrieved skill describes a sequential workspace design method, not an enforcement engine. [S7]

For Mindrian, treat these as stage-authoring guidance inside existing architecture. Do not impose another Layer 0-4 scheme on the current Layer Contract without a mapping. Do not copy a mandatory questionnaire into a session where the needed information already exists. Do not infer actual access control from folder layout.

Adopt **one primary job and one accountable result per stage**, while allowing a result to comprise several named files and graph records. Do not force a complex filing operation into one physical artifact merely to satisfy the external template.

A room is a durable decomposition of a problem; a run is an attempted sequence of transformations. These should be linked, not conflated. Nested sub-rooms should arise from distinct jobs and scope, not automatically from every workflow stage.

### Borrow selectively from icm-runtime

Useful patterns are frozen per-run contracts, explicit stage boundaries, observed tool/argument records, append-only execution history, enforcement-status disclosure, and bounded integrity seals. [S6]

The inspected implementation is not a finished answer to Mindrian's failures:

- `cmd_next`, listing and cleanup use output presence in places, while gate activity uses `stage_done` events. That is not one universal completion definition.
- The Claude hook permits a call when the checker itself fails unexpectedly, while the pi adapter blocks exceptions. Do not import a cross-host policy mismatch.
- Tool argument records are captured before execution. A matching call record is not proof of a successful remote effect.
- Seals cover selected evidence files. They establish detectable changes to those files, not factual validity or blanket integrity of every output.
- The documentation describes advisory-only enforcement on some surfaces, and best-effort transcript/stage attribution with concurrency limitations.

Reuse the ideas in existing Node/MCP execution paths. Do not install a second state-owning `.icm/` runtime beside the room graph and existing planners by default. Frozen contracts should identify the methodology version and authorized inputs without exporting or copying the entire Theo graph.

## 6. Trust, useful reasoning, and memory

### Preserve what worked

Lawrence reports that verification correctly withheld confirmation when support was insufficient, that unavailable sources remained distinguished from unpublished evidence, and that unsupported figures remained marked. Preserve these controls. Their presence in one room does not certify their execution in another. [S2: section 5]

Keep these separations:

`operational completion != epistemic resolution`  
`human approval != sufficient evidence`  
`source retrieved != source supports this proposition`  
`room membership != provenance`  
`zero recorded contradictions != contradiction check completed with adequate coverage`

A missing verification substrate must prevent silent promotion. It need not prevent clearly labeled exploratory drafts. A project can be administratively wrapped while claims and checks remain open.

### Make productive surprise accountable

Lawrence's challenge is that a missing insight leaves no failure artifact, while a broken guard attracts immediate attention. Responsibility for reasoning must include useful yield, not only posture. Do not create a separate Insight Authority to solve this. [S4]

Instrument the existing reasoning/reach path so it can distinguish not run, blocked, attempted with no candidate, candidate produced, candidate surfaced, and subsequent user assessment. These are proposed measurement distinctions, not claimed existing telemetry.

Record whether an offered connection, contradiction, missing variable, reframe, or falsifier was new to the navigator, useful, and taken into further work. Treat missing feedback as unknown. Attribute whether it arose from a tool, source reading, human intervention, or later review. Lawrence's own account explicitly separates these origins. [S3: sections 3-4]

Do not make novelty volume a success quota. One supported correction or well-defined problem may be more valuable than many opportunity cards. Useful, accurate, already-known work is not automatically a failure. [S3: section 1]

### Make the Subject Audit part of evaluation

Lawrence's Subject Audit asks what each tool is actually examining. Several different methods can share the same untested subject and produce correlated results. Preserve the maxim: **convergence tests consistency, not truth.** [S3: section 7]

A proposed test should use multiple frameworks that inherit the same premise. The system should identify the shared premise and avoid describing the outputs as independent corroboration. Explicitly naming the subject does not itself prove independence, but it makes the assumption inspectable.

### Do not rebrand the dial before its inputs exist

Before replacing turn thresholds with state-based posture, map the actual readers and semantics:

| Proposed input | Required proof before use |
|---|---|
| Problem state | Identify the persisted framing/rung and the reader actually consumed by navigation. |
| Evidence state | Identify the claim-standing/verification reader and its freshness and error behavior. |
| User behavior | Identify explicit choices or observable events; do not disguise inferred mental state as measured data. |
| Confidence | Identify what the value means and who produces it. Retrieval rank is not automatically confidence in a claim. |

Keep absent inputs explicit. The reader map is an investigation task, not a claim that all four already exist.

### Memory points; it does not certify

Project memories and session summaries should carry canonical claim/artifact references, source version, verification state, and unresolved checks. They can report what the previous session concluded. They must not silently promote that conclusion because a summary is easier to retrieve than its source.

If the underlying room is unavailable or stale, report that limitation. Do not let a shortened MEMORY.md entry become an independent owner of truth. This is a proposed application of the source reports' distinction between status and work product.

## 7. Follow-on work after the first example

Use consequence and dependency to choose the next slice. This table is a work map, not a mandatory serial programme that delays urgent repairs.

| Area | Apply the proven pattern | Reuse / preserve |
|---|---|---|
| Human decisions | Validate decision scope; persist approval and effect distinctly; test replay, failed commit, and restart recovery. | Existing gate ledger, durable records, and transition writers. |
| Claim filing | Commit the claim plus required real provenance, or record an explicitly permitted gap/exemption. Account for unresolved declared relationships. | `writeClaimNode`, `writeEdge`, filing paths, existing vocabularies. |
| Verification | Ratify/migrate vocabulary deliberately; preserve meanings of old records. Check evidence support separately from structural source location. | `verification.cjs`, `verification-floor.cjs`, existing ratification process. |
| Research execution | Give every accepted leaf/pass an operation identity and an accounted-for terminal outcome; reserve counterevidence/recovery budget; carry incomplete coverage into synthesis. | Phase 369.2, current grants, audit ledger, planner and filing gates. |
| Navigation | Separate proposals, selection and rendering; remove independent semantic recommendations from footers after routing consumers through the actual decision path. | Current engine, sensors, resolver, and surface adapters. |
| Capability/version identity | Distinguish declared, executable and observed capability; record source/release/install/runtime provenance separately. | Existing manifests, registries, release machinery and runtime inspection. |

A research grant does not authorize filing. An audit ledger is not an approval ledger. Several stores are legitimate when they record different facts and have explicit ownership; common names do not justify merging them.

Preserve root exceptions and legitimate cross-room references where the existing schema allows them. Do not impose universal foreign keys or manufacture provenance to make counts green. Do not reinterpret old numeric verification rungs under a newly ratified meaning without a migration.

For version identity, capture what is actually loaded: module/plugin root, available commit or build identity, package label, release identity and installed payload identity. An unavailable field stays unknown. Record this during the first room reproduction; do not make a version refactor a prerequisite for safety fixes.

Theo's copies of commands/sensors should be treated as generated operational projections, not co-authored runtime authority. A framework name collision needs disambiguated identity and provenance, not an assumption that one acronym must replace every legitimate variant.

## 8. Acceptance and developer handoff

### Release evidence

Extend the existing real-room release-test pattern rather than invent another release ceremony. Each receipt should identify the tested build, host, supported operation, expected checks, observed outcomes, unresolved failures and skipped checks. It should point to the work product and readback evidence, not merely a model-authored declaration of success. [S5]

Coverage must include the shipped path users invoke, not only a fixture that calls the ideal primitive directly. A green mock or helper-level test does not certify the installed adapter, permissions, packaging or runtime resolution.

For all result contracts, preserve compatibility consciously. `writeEdge.ok` was intentionally separated from `written`; a global change to the meaning of `ok` is not this project's first fix. An idempotent retry can legitimately succeed with no new row, provided the required resulting state is verified.

### Ready-to-use instruction for Claude Code

> Start with a read-only, commit-pinned reconciliation of Room Identity against the current code, installed payload and field reports. Mark each relevant item as reproduced, source-visible but untested, fixed with execution evidence, or unresolved.
>
> Trace every supported room-creation path through registration, session binding, the canonical Room node, governed writing and status readback. Reuse existing resolution and writing seams. Preserve multi-room bound sets and legitimate nested-room scope.
>
> Write failing tests for missing database, registration failure, binding failure, cross-session room bleed, governed-write refusal, and partial-failure retry. Make the tests fail for the actual defect. Implement the smallest end-to-end change that makes the authorized flow and its recovery path work.
>
> Do not report a successful transition from a subprocess exit code alone. Do not fabricate source edges, human approvals, test results or version identity. Preserve the verification floor and privacy boundaries. Do not broaden permissions to make a host refusal disappear.
>
> When the room flow passes, extract its minimal ownership/readback/failure contract into the existing architecture documentation. Map it to the Layer Contract; do not add a parallel ontology or generic manager. Carry the worked pattern into the next highest-consequence gap and the existing Phase 369.2 execution-truth work.
>
> Report exact changed files, tested commit and runtime, tests actually executed, observed results, remaining failures and untested surfaces. Keep fresh findings distinct from historical reports and proposed fixes. Record yield measurement as a named follow-on so useful reasoning does not lose indefinitely to visible guard repairs.

## 9. Decisions still requiring evidence or ratification

The current Theo endpoint instruction text and call-path mapping have not been probed for this consolidation. The final verification vocabulary remains a ratification/migration question. The four proposed posture inputs require a real reader map. Legacy provenance recovery requires source-specific evidence and exceptions, not invented links. Productive-surprise measures require an explicit evaluation design rather than a self-awarded novelty score.

These items should remain visible. They do not justify delaying the Room Identity exemplar or existing urgent integrity repairs.

## Bottom line

**Build one reliable authority, prove its effect, and reuse the pattern. Theo remains the methodological adviser; workspace contracts scope the work; existing runtime and room writers establish what happened; verification governs promotion. Evaluate useful reasoning alongside integrity, so Mindrian becomes neither an unreliable idea generator nor a perfectly careful surveyor.**

---

## Source register

The following are the sources used for this consolidation. File and repository contents were supplied or retrieved earlier in this conversation; none is represented as a new current-state audit.

### S1. Eliezer/Tnufa field report

User-pasted `MindrianOS QA and redundancy investigation: field session 2026-10-05`, beta.57, Windows 11 / Claude Code in VS Code. Component map, redundancy register R1-R18, defect register D1-D30, and mentor-session UX findings. Historical report; source-code and behavior statements require version-specific reproduction before patching.

### S2. Lawrence's developer report

`mindrianos-for-jonathan-2026-10-05.md`, titled *MindrianOS -- nineteen faults, in fix order*. It explicitly supersedes the four 4 October documents and the earlier 5 October triage. The older triage remains provenance, not an additional independent investigation.

Internal tension retained: the overview includes a 403 interpreted as literature absence, while sections 4-5 explicitly praise preservation of the session-reach/publication-gap distinction. This consolidation preserves the concrete fetch-path failure and that reporting distinction; it does not assert that every 403 was falsely narrated as nonpublication.

### S3. Lawrence's product account

`mindrianos-how-it-worked-2026-10-05.md`, titled *How Mindrian worked -- two rooms, two days, and what came out*. Used for method performance, human interventions, provenance of insights, Subject Audit, and closure/verification distinctions. Its subject-matter claims are not independently validated or adopted by this engineering brief.

### S4. Lawrence's later architectural reply

The user-pasted reply beginning `Sent nothing yet, wrote nothing to any room.` Used for Room Identity first; authority versus recording; relation to existing layer schemes; productive-surprise accountability; reader-map requirement; version identity; and the proposed Theo interaction-doctrine boundary. The reply explicitly says Lawrence had not seen the 30-defect report and could not inspect the full repository on that machine.

### S5. Prior Mindrian repository inspection

Repository: `jsagir/mindrian-os-plugin`. Search results identified `ad0704e39433063748b2f19948a288491a37bdf9`; fetched source also used `main`. Relevant retrieved material:

- `lib/core/navigation/room-birth.cjs`, including `_verifyRoomReady`, registry-failure rollback, session binding and born-wired Room-node insertion.
- `lib/core/resolve-active-room.cjs` search excerpts; `lib/core/session-binding.cjs`; `lib/mcp/session-room.cjs`.
- `scripts/write-scope-check.cjs`; `lib/mcp/tools/claim.cjs`.
- `lib/core/navigation/typed-claim.cjs`; `lib/core/navigation/edges.cjs`; `lib/core/navigation/CONTEXT.md`.
- `lib/core/navigation/verification.cjs`; `lib/core/navigation/verification-floor.cjs`; `data/verification-ladder.json`.
- `lib/mcp/gate-ledger.cjs`; gate-render/gate tooling excerpts and Oct 5 card-before-answer changes.
- `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md`; Phase 273 context/research.
- Phase 369.2 `ENGINEERING-BRIEF`, `LARRY-ANNEX`, and `PHASE0-STATUS`.
- `lib/mcp/tool-router.cjs` suggestion excerpts; release history and `scripts/real-room-run.cjs` references.

These observations support reuse and specific follow-up tests. They do not establish complete conformance or present deployment status.

### S6. ICM Runtime

Repository: `KakkoiDev/icm-runtime`. Earlier commit lookup returned `04a177f102b022a38bb4251ce0ad79213c84a532`.

Retrieved: `README.md`, `ARCHITECTURE.md`, `docs/REFERENCE.md`, `docs/ONBOARDING.md`, `skills/icm/runtime/icm.sh`, `gate-hook.sh`, and `icm-gate.ts`.

Useful patterns and limitations in section 5 are drawn from those excerpts. No runtime installation or local execution was performed here. A retrieved September 15 commit message also reports pre-existing gate-test failures; that report is not a fresh test run and is not treated as proof of the current suite's status.

### S7. ICM Workspace Architect

Repository: `blackghostosint/icm-workspace-architect`; retrieved commit `3b2ea08fba9b25c8b630303d68287523021fbd50`.

Retrieved: `README.md`, `skills/icm-workspace-architect/SKILL.md`, and the repository's `Interpretable Context Methdology.md` text. Used for Product / Factory / Process, context scoping, stage contracts, reference/working separation and human edit surfaces. No performance or security guarantee is inferred from the template.

### Repository addresses

```text
https://github.com/jsagir/mindrian-os-plugin
https://github.com/KakkoiDev/icm-runtime
https://github.com/blackghostosint/icm-workspace-architect
```
