---
kind: seed
status: open
created: 2026-06-17
canon_parts: [6, 7, 8, 9]
severity: medium
sequence: after Phase 162 (graph-spine-single-authority-viz); strategic, not a bug
related: [SEED-024 (brain-as-orchestration-graph), Phase 157 (brain-orchestration-projection), Phase 143.3 (connector-spine-and-intelligence-orchestrator), Phase 144 (navigation-engine-legacy-engine-flip), Phase 122 (workflow-layer), the GSD workflow surfaces]
source: navigator concept seed (external term "harness as code" / "harness engineering")
sources:
  - https://martinfowler.com/articles/harness-engineering.html
  - https://www.anthropic.com/engineering/harness-design-long-running-apps
  - https://openai.com/index/harness-engineering/
  - https://www.langchain.com/blog/the-anatomy-of-an-agent-harness
  - https://zenodo.org/records/19166436
---

# SEED: Harness-as-code - declare and machine-enforce the MindrianOS agent harness

## The concept
"Harness as code" (a.k.a. harness engineering) means expressing the ENTIRE agent harness - everything
around the model that is NOT the model weights - as executable, versioned, declarative code/config in
the repo, the way infrastructure-as-code expresses cloud infra. The framing: **Agent = Model + Harness.**
The harness is what turns a raw LLM into a usable coding/research/venture agent.

A harness has four parts:
1. Orchestration - how prompts, tools, and code execution are sequenced.
2. Context assembly + routing - which memories, files, graph nodes, repos, tools go into each step.
3. Governance + constraints - tests, policies, architectural rules, guardrails (machine-enforced).
4. Convergence logic - loops/retries: "keep going until tests pass / diff is small / structure is valid".

"As code" adds three properties:
- Declarative + versioned (workflows/policies/context-sources in repo config, not a UI or ad-hoc scripts).
- Machine-enforceable (constraints enforced automatically in the toolchain, not just documented).
- Re-runnable + idempotent (run it repeatedly; once converged, reapplying does not churn the structure).

Mental model: Terraform defines infra; CI-as-code defines delivery; HARNESS-as-code defines how agents
may touch the codebase, what steps they must follow, and how success is verified - stored beside the code.

## Why this fits MindrianOS (we are already most of the way there)
MindrianOS already ships large parts of an agent harness as code - but they are not yet unified or named
as one declared, machine-enforced harness layer:

| Harness part | Already shipped (the as-code pieces) | Gap to close |
|--------------|--------------------------------------|--------------|
| Orchestration | the connector spine (Phase 143.3, data/connector-registry.json + generator + --check), the navigation engine decide() (Phase 144), the dial, the Workflow() runtime, GSD workflows | no single declared "harness manifest"; orchestration is spread across registries, the engine, hooks |
| Context assembly + routing | navigation.cjs chokepoint (Part 9), getRoomContext (Phase 141), getGraphExport (Phase 162), the Brain context packet (Phase 110) | context routing is per-consumer, not declared as one routing policy |
| Governance + constraints | the Canon enforced by check-* scripts (check-substrate, check-brain-boundary, check-schema-aliases), the frozen edge/reach vocabularies, the substrate allow-list pre-commit, the brain-boundary-scan | constraints are many separate scripts; not one declared policy set with a single runner |
| Convergence | GSD revision loops (plan-checker, verify), the Workflow loop-until-dry/budget patterns, resume-from-runId | convergence logic is per-workflow, not a reusable declared primitive |

So the seed is NOT "build a harness" - it is "NAME, UNIFY, and DECLARE the harness MindrianOS already
runs, so it becomes one versioned, machine-enforced, re-runnable layer" (Canon Part 7 reuse: repoint and
unify, do not rebuild).

## Why after Phase 162
Phase 162 establishes the discipline this generalizes: ONE spine door (getGraphExport / navigation.cjs)
for graph reads, a Part-8 boundary scan on a broad read, a fail-loud type map, a golden-snapshot gate.
That is a microcosm of harness-as-code (declared single door + machine-enforced constraint + re-runnable
verification). Harness-as-code lifts that pattern from one surface to the whole agent system.

## Required capability (exploration acceptance - this is a seed, not a plan)
1. A declared HARNESS MANIFEST (repo config) that names: the orchestration steps Larry/agents may run,
   the context-routing policy (what each step may read via the navigation chokepoint), the governing
   constraints (which check-* gates must pass), and the convergence rules (when a loop stops).
2. ONE harness runner that executes the manifest and is idempotent (re-running a converged room does not
   churn room.db or artifacts).
3. The existing check-* gates re-expressed as declared, composable policy entries the runner enforces on
   every agent run (not 12 separate ad-hoc scripts).
4. The connector spine + navigation engine + Workflow runtime referenced BY the manifest, not duplicated.

## Canon alignment
- Part 6 (dog-fooding): the plugin is a venture built in its own room; a declared harness is the plugin
  honoring its own orchestration as a first-class, versioned artifact.
- Part 7 (reuse before build): this is unification of shipped pieces, near-zero net-new orchestration.
- Part 8 (graph boundary): the harness manifest is GENERIC machinery metadata (steps, policies, gates) -
  exactly the methodology_tier=mindrian-operation projection Phase 157 sanctioned; it carries ZERO user
  data. The boundary scan becomes a declared, always-on harness policy rather than a hook bolted on.
- Part 9 (memory locality): the context-routing policy routes every read through navigation.cjs; the
  harness makes "SQL is the local mind" a declared invariant the runner enforces, not a convention.

## Reuse-before-build (Part 7)
Build on: the connector registry + generator + --check (143.3), the orchestration projection generator
(157), the navigation chokepoint (109), the GSD workflow runner, the check-* gate scripts. Net-new is the
manifest schema + the unifying runner + re-expressing the gates as declared policy. Do NOT add a new
orchestration framework (Canon: LangChain/CrewAI are explicitly out; Claude IS the model, the spine IS
the harness).

## Open questions for the phase that picks this up
- Manifest format: YAML/JSON config vs a thin CJS DSL (the plugin is CJS, no TypeScript build step).
- Does the harness manifest become part of the Brain orchestration projection (Phase 157) so it is a
  legible, tier-marked artifact, or stay purely local?
- Idempotence test: what is the canonical "converged room" fixture whose re-run must be a no-op?
