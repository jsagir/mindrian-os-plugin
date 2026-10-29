# Reverse-salient analysis of the MindrianOS opportunity-discovery system

**Scope:** system-level analysis of the proposed user-directed opportunity discovery platform. No case room was selected. This is an architecture analysis based on current MindrianOS source, the research-bundle review, and the proposed portfolio design; it is not a run of the room-scanning RS engine and makes no claim that a numerical RS score was computed.

## Finding

### Primary candidate reverse salient: the engine-to-decision handoff

The subsystem most out of phase with the rest of the design is the **operational handoff that turns a user's goal and permitted evidence into a bounded engine job, then turns its result into a traceable portfolio decision**.

This is more specific than “we need adapters” and broader than “we need a container.” It includes the contract for scope, source identity, invocation, runtime/dependency state, egress permission, failure status, result provenance, and next action. The reviewed engines do not yet share those contracts, and the current `research_run` facade explicitly owns planning/approval/facade behavior rather than engine logic. Current MindrianOS routes are therefore not evidence that all package engines are interchangeable or callable through one verified path.

**Constraint type:** socio-technical integration constraint (workflow contract + runtime state + evidence governance), with a technical execution component.

**Confidence:** medium as a design diagnosis; low-to-medium as a measured throughput diagnosis. It is supported by repository structure and review findings, but no user task timings, queue data, failure rates, or end-to-end evaluation were gathered.

## System map and value flow

```text
User goal and scope
  → permitted room/source selection
  → prepared, traceable evidence set
  → choose a job/method
  → execute in required runtime with permission limits
  → normalize result, provenance, uncertainty, and failure state
  → user reviews a small candidate set
  → evidence-backed portfolio decision / next experiment
```

The user gets value only when the chain reaches a decision or a useful next test. Faster pair generation does not increase end-to-end value if preparation, routing, interpretation, or review remains manual.

| Subsystem | Current evidence | Required for self-service | Gap signal |
|---|---|---|---|
| Goal and room binding | Room-bound MCP research facade and command flows exist. | User can state a goal, scope, exclusions, and desired decision without naming internal engines. | Intent still requires an operator to translate into a methodology/command. |
| Material preparation | Research quick path has a bounded local check; individual engines define different corpus assumptions. | One inspectable input manifest with stable references, extraction status, and snapshot identity. | Missing/unsupported material looks like an empty analytical result. |
| Method selection | Existing perspectives/routes and orchestration rules exist; seven packages have mixed roles and maturity. | Select one method from the user job and evidence readiness, with a reason and redirect option. | User or developer must know which package is runnable and what it consumes. |
| Runtime execution | Current repo runs Node modules and has Python/native methods; MCP itself is only an interface. | Bounded, reproducible job execution with clear status, cancellation, and dependency identity. | One missing model/library/transport blocks the run or is mistaken for “no finding.” |
| Egress and provenance | `research_run` has exact-query approval and audit on its path; package-specific network callers are not uniformly verified. | All outbound-capable jobs use the same enforceable broker and record actual requests. | Safety depends on which entry point happened to be used. |
| Result handoff | Some outputs write to room files/graph; cross-room relationship store exists; package output shapes differ. | Common result envelope plus a portfolio lifecycle that preserves lineage and separates proposal from truth. | Humans manually reinterpret, copy, dedupe, and file results. |
| Human review | Gates and proposed-only claims exist. | Candidate flow sized to available review capacity; decision/rejection reasons retained. | More outputs increase backlog rather than useful decisions. |

## Why this is the leading bottleneck hypothesis

The platform already has multiple analysis capabilities, approval primitives, room binding, and graph/opportunity storage. The limiting element is that these pieces do not yet establish one **end-to-end user job contract** across the reviewed package engines:

1. Several packages consume different representations and runtimes.
2. Similar names do not establish equivalent behavior; Eureka is a notable example where the standalone runner is retired in the current route.
3. Egress is safely controlled on a particular research path, but that does not establish enforcement over each package-specific fetcher or model call.
4. The current facade does not itself execute every engine, and some outputs require human/process interpretation before filing.
5. No common durable job/result contract has been verified for all packages.

If engine count or candidate generation increases before this handoff is solved, the likely result is more partial outputs, more operator work, and a larger review queue. This is a causal hypothesis to measure, not an observed production feedback loop.

## Cross-cutting use of RS tools

**Yes, RS can be used across the engine portfolio as a diagnostic and selected support capability. It should not automatically run as an extra analysis before and after every engine.** Its value is to identify which subsystem or evidence dependency is limiting the current user job, then inform routing or a follow-up.

| RS tool/capability | Reusable across engines? | Appropriate role | Boundary / condition |
|---|---|---|---|
| **Reverse-salient diagnosis** (`find-bottlenecks` / RS perspective) | Yes, selectively. | Before a workflow when the user says progress is stalled, or when orchestration telemetry suggests a repeated constraint; can identify whether the limiting factor is data readiness, method availability, evidence, or review. | Requires a defined system boundary and evidence. It is a hypothesis generator, not a generic quality score or mandatory first stage. Current room RS engine scans room artifacts and has side effects (cache/result files and graph edges); it is not currently a pure reusable function over arbitrary engine outputs. |
| **RS Explain** | Sometimes. | Explain a previously identified bottleneck in user language, with source/query status. | Current package explains graph-backed RS work. Its docs identify a remote Brain/Aura leg and advise Tier 0/no-Cypher for private room content until local transport is assured. Do not use it as a universal explainer for unrelated engine output without adapting its input contract. |
| **RS Fetch** | Only when evidence about the bottleneck is needed. | Gather academic/patent/industry signals around one bottleneck thesis, with source-level provenance and degraded-source reporting. | It is a network research workflow with credentials, budgets, rate limits, and source-specific behavior. Route through shared approval/egress policy before using it across capabilities. Do not call on every engine run. |
| **RS Experts** | Not as a currently available default. | Potential follow-up after research has produced relevant papers/authors. | Reviewed command states the Aura transport is absent and production invocation refuses. Also an expert lookup is a specific graph/data job, not a generic engine service. |
| **RS Thesis** | Yes as readback, not generation. | Retrieve and explain a thesis from an existing RS discovery, including evidence metadata if present. | It reads a stored result by discovery ID; it does not analyze a new engine output. |
| **RS shared helpers** (query audit, corpus normalization, dedupe, source records) | Potentially. | Reuse stable, well-tested primitives where their semantics match. | Do not copy whole RS behavior into every engine. Audit API contracts, data classes, license, side effects, and whether a helper assumes RS-specific ranking/scoring. |

The most promising shared interface is a **bottleneck diagnosis request** that accepts a bounded system/job map and evidence references, then returns: candidate limiting component, evidence supporting the diagnosis, missing evidence, confidence/uncertainty, and a falsifying observation. It should not receive arbitrary full room content by default.

## Feedback dynamics

### Harmful reinforcing loop (hypothesis)

`more engine integrations` → `more heterogeneous outputs` → `more manual translation and triage` → `slower user decisions` → `pressure to add more automation/engines` → `more heterogeneous outputs`.

This loop can make feature growth feel like progress while making the user less independent.

### Balancing loop to design

`explicit job contract + result provenance` → `lower interpretation cost` → `more user-reviewed candidates` → `recorded dispositions` → `better routing/evaluation evidence` → `more selective method use`.

This does **not** mean automatic learning exists. Human decisions only improve routing if a versioned mechanism consumes them and is evaluated.

### Next reverse salient after handoff improves

Likely next constraint: **human evaluation capacity and candidate quality calibration**. Once jobs reliably execute and results are traceable, the limiting question becomes whether reviewers can distinguish promising opportunities from plausible noise at acceptable effort. If candidates are too weak, route back to framing or source coverage; if review backlog grows, bound scan breadth and prioritize by expected decision value.

## Attack vector: relieve the handoff, not optimize a downstream engine

### Smallest useful intervention

Define and prototype one shared job/result contract around one already-supported local route. It should make these states impossible to confuse:

- completed with useful result;
- completed with no result above threshold;
- partial/degraded because a source or dependency was unavailable;
- blocked by missing input or approval;
- failed before meaningful analysis;
- cancelled or resumed.

The runner must own authoritative runtime, input snapshot, dependency, and egress records. The engine returns method-specific content; it cannot self-certify network behavior or claim its own output was filed.

### Measurement

For a bounded set of user tasks, record:

- proportion completed without developer intervention;
- user time from goal statement to a reviewable result;
- number of clarification/repair interventions;
- input/source-reference completeness;
- share of runs with explicit correct terminal status;
- outbound request approval compliance;
- reviewer time per candidate accepted for a next test;
- rate of duplicate, irrelevant, or untraceable candidates.

Do not use number of adapters, generated candidates, or report length as evidence that the bottleneck was relieved.

### Falsifiers

The handoff diagnosis weakens if the platform can already take representative jobs from a plain-language goal to evidence-linked portfolio disposition without manual method selection, input repair, output translation, or hidden failure interpretation, and the dominant delays instead come from source access, model latency, or human review. In that case, measure those constraints directly and re-rank the reverse salient.

## Action sequence

1. **Map the actual pathway:** for each current capability record input, read scope, runtime, outbound calls, side effects, result shape, failure modes, and human decision. Mark unknowns rather than infer parity from names.
2. **Create capability manifest:** user-facing JTBD name; prerequisites; local/remote classification; egress permissions; expected cost/time; output and known limitations; enabled/experimental/blocked status.
3. **Prototype the shared envelope and runner behavior:** use a current local route first; keep writing and network access outside the engine process by default.
4. **Use RS selectively:** run bottleneck diagnosis when the job is stalled or system evidence shows a bottleneck question. Make its finding a candidate that cites the observation and falsifier.
5. **Measure user independence:** test whether a user can start, understand partial/failure states, choose the next action, and preserve a candidate without developer intervention.
6. **Reassess the constraint:** after reducing handoff friction, identify the next reverse salient from measurements rather than assuming it.

## Important scope note

This analysis examines the platform as a system and intentionally does not select or use a particular customer room, institution, or opportunity corpus. The current `find-bottlenecks` implementation and room-specific RS engine were not executed here; no numeric RS score was calculated.

