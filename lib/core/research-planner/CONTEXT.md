# lib/core/research-planner/

## What this folder is

The one plan-and-run engine for research in MindrianOS. A command such as `/mos:whitespace`, `/mos:diffusion` or `/mos:dominant-designs` does not fetch anything on its own. It contributes three things: the questions worth asking, a lens, and a falsifier template (what result would prove the question wrong). The engine does everything else: it emits the plan, composes and audits every search string, asks the navigator to approve, fetches, iterates, writes evidence rows, and proposes what to file.

There is no per-command fetcher, no per-command cache, no per-command approval ledger and no per-command scheduler (D-02a). One engine means one place to fix a bug, one place to audit egress, and one Plan object that every surface reads.

Plain-English version: the plan is a written promise of what will be searched, for which sub-question, and why. The navigator reads the promise before anything leaves the machine. A quick run is that promise made small; a deep run is that promise made big and editable.

## File map

Each line says what a file reads, what it does, what it writes, and what a human checks. Files marked "planned" land in sibling plans of Phase 363; this table is the contract they build against.

| File | Reads | Does | Writes | Human check |
|------|-------|------|--------|-------------|
| `plan.cjs` (this plan) | a plan or run object | schemas, validators, `planHash`, `applyEdit`, `planReviewCard`, `BUDGETS` | nothing (pure) | the F.6 card lists every search string exactly as it will be sent |
| `question-templates.cjs` (planned) | command contributions | one template per lens: questions, lens, falsifier | nothing (pure) | each template names a falsifier |
| `pyramid.cjs` (planned) | the stated question, a framework's dimensions | builds the Minto pyramid (SCQA, key line, MECE, D-00 gaps) | the pyramid inside the plan | MECE warnings and uncovered dimensions are visible on the card |
| `perspective.cjs` (planned) | the plan, the rung, the forum passes | builds the research perspective in the constraint layer | the perspective inside the plan | tension, goal, falsifier, the two-column limiter table |
| `families.cjs` (planned) | leaf slots | composes query strings from fixed families | nothing (pure) | every string is short, plain and generic |
| `grants.cjs` (planned) | the navigator's approval | standing grants and per-run grants | the grant ledger | the grant names its lifetime |
| `audit-ledger.cjs` (planned) | composed strings | runs the Part 8 audit and records pass or refuse | a local ledger (never egressed) | a refusal names the leaf, never the string |
| `structure.cjs` (planned) | Theo handles, local templates | chooses tree type and frameworks | the structure inside the plan | the source (Theo or local) is stated |
| `evidence-rows.cjs` (planned) | fetched records | turns records into verbatim-quote rows with content hashes | row files under the run home | every row cites a hash that exists |
| `verdict.cjs` (planned) | rows | the quick verdict and the stop reason | the run result | the verdict names its evidence |
| `quick.cjs` / `deep.cjs` (planned) | a plan | run the plan under quick or deep caps | the run result and run record | the run stops where the plan says |
| `filing.cjs` (planned) | a run result | proposes filing; files only on approval | room artifacts through the existing filing gate | nothing files without a yes |
| `ambient.cjs` (planned) | the 355.1 ambient trigger | offers a run at the right moment | an offer, never a fetch | the offer is one short line |
| `sr-steps.cjs` | Theo `framework_step` and a membership-only `recommend_chain`, through brain-client | walks the Scientific Roadmapping steps in list order; refuses a step Theo has not authored | nothing | the exact refusal text, "Theo has not authored this step yet" |
| `sr-entry.cjs` | LOCAL room state, read-only | proposes the entry step for `/mos:scientific-roadmap` (a stamped finding in flight enters at step 6) | nothing | the F.1 entry card |
| `sr-door.cjs` | the entry, the steps, the room's bound inputs | walks the stages, builds the question set and Stage B; the plan is saved by `planner.buildPlan` | the plan object, through the planner | each stage gate and the F.6 card |
| `sr-filing.cjs` | an approved F.8 selection | files `research-plan/PLAN.md`, proposed claims and REJECTED_BECAUSE edges, only on approval | room artifacts through the existing filing gate | nothing files without an approved F.8 selection |

## Reuse inventory (Canon Part 7)

Search before build. Everything below already exists and is reused, not rewritten.

| Surface | How it is reused |
|---------|------------------|
| `/mos:research` | the one runner; the engine is its planner and iterator (D-14) |
| `/mos:dominant-designs` (research mode) | the precedent that lane queries, an approval card and a no-send-anyway audit already work; generalized here, not copied |
| `/mos:find-analogies --external` | the same audit fence; no send-anyway path |
| `/mos:diffusion` | the diffusion lens: Adoption-Capacity Theory as a question source for any research plan where adoption is disputed (D-19) |
| `/mos:structure-argument` and `/mos:mos-reason` | SCQA and REASONING.md; the pyramid rolls up into them |
| `lib/core/rs-query-matrix.cjs` | query family shapes |
| `lib/core/semantic-index/online-pattern-query.cjs` | the no-echo degrade shape for refused strings |
| `lib/core/research-corpus.cjs` | corpus access (OpenAlex adapter and the room corpus) |
| `lib/core/research-cache.cjs` | content-hash cache; free reuse of an identical fetch |
| `lib/core/rs-fetcher-academic.cjs` | the academic fetcher |
| `lib/core/rs-egress-prompts.cjs` `auditQueryString` | the Part 8 fence every outbound string passes |
| `lib/core/issue-tree.cjs` | tree shapes for the pyramid |
| `lib/core/ambient-framing.cjs` `resolveRoomRung` | the honest rung, read silently |
| `lib/core/futures/orchestrator.cjs` `resolveFanoutCap` | the clamp on requested lanes at run time |
| `lib/core/semantic-index/research-filing.cjs` `fileResearchArtifact` | the one filing door |
| `lib/core/navigation.cjs` writers | typed edges and nodes, only through the chokepoint |
| `lib/mcp/gate-ledger.cjs` and `lib/mcp/gate-render.cjs` | the approval ledger and the card renderer |
| the 355.1 ambient child | the trigger for an ambient offer |
| `/mos:scientific-roadmap` | a second door on the scientific-roadmapping template; no second engine |

## Borrowed patterns (D-01)

We studied open-source deep-research projects and learned patterns from them. Licenses below are as verified in `.planning/phases/363-deep-research-planner-quick-and-deep-runs/research/363-RESEARCH-oss.md`.

| Pattern taken | Project | License | What we took |
|---------------|---------|---------|--------------|
| Plan review gate with a revision cap | gpt-researcher | Apache-2.0 | the idea of accept or revise with `max_plan_revisions` 3; here `MAX_PLAN_REVISIONS` |
| Jev-first passage filter with a keyword fallback | gpt-researcher | Apache-2.0 | the idea that a no-key local fallback is enough |
| Perspective-guided questioning | STORM and Co-STORM | MIT | perspectives, not a generic prompt, generate the questions |
| Explicit research brief before any search, supervisor stop signal | open_deep_research | MIT | one written plan object; an explicit stop |
| Breadth halving as depth grows, learnings as carried state | dzhng/deep-research | MIT | the simplest bounded recursion shape |
| Gaps queue, typed stop evaluators, honest forced synthesis | node-DeepResearch (Jina) | Apache-2.0 | typed stop rules; never stop silently |
| Evolving report as the only carried memory | Tongyi DeepResearch | Apache-2.0 | carry the plan and the current run record, not a transcript |
| Journal quality from open data, local research history | local-deep-research | MIT | source-quality flags; resumable stages |
| Dedicated contradiction search that takes a claim | PaperQA2 | Apache-2.0 | a counterevidence lane per key claim |
| Quote-first evidence | ScholarQA and OpenScholar | Apache-2.0 | every claim traces to a verbatim quote and a hash |

No code, prompt text or runtime from those projects ships here. Nothing in `lib/core/research-planner/` requires any of them (DRP363-18). The patterns are ideas, re-implemented in plain CJS with node built-ins.

## What we do not copy

- LLM-composed queries sent straight to the web. Every string here is composed from fixed families and audited first.
- A second model or a hosted server. The engine runs in Claude Code with the plugin.
- One ever-growing context. Carry the plan and the run record.
- The long report as the product. The product is evidence rows and filed claims.
- Flat source lists. Provenance is claim-level.
- Volume as quality. Stops are typed checks plus hard caps.
- Silent budget stops or unbounded plan revision.
- Benchmark claims as acceptance. Phase 363 measures itself on PWS fixtures.

## Part 8 fences

- Only audited `leaves[].queries[].q` strings leave the machine, and only to the corpus.
- Pyramid prose, SCQA, leaf questions and the perspective are local. They never cross.
- Theo (the Brain) gets generic handles only: framework names and enums. No room text.
- An API key rides a header, never a URL or a query string.
- The audit ledger is local and never egresses.
- A refusal names the leaf, never the string that was refused. There is no send-anyway path.

## One reasoning store (D-08)

The pyramid is not a second store. It rolls up into the room's existing `REASONING.md` and graph edges. `MINTO.md`, if a human wants one, is generated from those. The run home under `research/` is the run record (queries, outcomes, rows), not a place where reasoning lives. If two places could hold the same claim, one of them is wrong.

## The research perspective (D-18)

The planner does not generate answers first. It builds a perspective in the constraint layer, following seven operations from Scientific Roadmapping:

1. Tension: keep only what the field agrees is valuable and disputes as reachable. No nameable physical constraint means a wish.
2. Goal: a target with a unit and threshold, plus the result that would prove the direction wrong.
3. Rung phrase: the honest kind of roadmap and idea for the question. The label itself is never shown to the navigator (silent classification, D-02b); only the roadmap type and the kind of idea appear.
4. Forum: three voices run one at a time - frustrated insider, fresh entrant, physics grounder. Disagreement is kept, not smoothed.
5. Paths: enumerated by coverage, checked for overlap and gaps, with a 10X resurvey.
6. Constraint interrogation: every limiter is sorted into physics (derived) or assumed (not re-tested). No third column. Assumed limiters become research questions.
7. Catalytic ranking: by how much each limiter unlocks downstream, not by novelty.

The ratchet is the run memory. Every revision keeps each discarded path, limiter or leaf with its reason, and a constraint that was settled is not re-argued without new evidence. `applyEdit` writes those records; a dropped branch never just disappears.

## SEED-098 reuse contract

A standalone Scientific Roadmapping command (SEED-098) reuses this engine and adds no second one. It registers a door on template id `scientific-roadmapping` in `question-templates.cjs` and calls `perspective.cjs` through its exported API. It adds no second engine, ledger or fetcher. The API version it binds to is `perspective.cjs` `describeEngine().api_version`; a bump there is a breaking change for that command and must be announced in its plan.
