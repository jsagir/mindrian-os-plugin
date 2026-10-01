# Phase 366: Eureka becomes a perspective of the research planner; the MCP canvas tooling; one home for Claude model routing - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The Eureka question (which cross-domain pairs in a room share a mechanism nobody has connected
yet, and does the room already know it) is delivered through the one research planner (Phase
363), not through a standalone engine. This phase (1) makes `/mos:eureka` the quick-run alias on
the perspective path and retires the standalone runner behind a legacy flag; (2) gives all five
MOS-CANVAS perspectives (Eureka, RS / find-bottlenecks, HSI, whitespace, find-analogies,
find-connections) the same op shape on the planner: a recall file, a judge file, a paginated
candidates read, a question template with a falsifier, and the planner's own plan, research,
prose and filing; (3) makes room nodes Theo-ready through canon Framework handles as local
framework nodes and typed edges, with a gated path for the vocabulary gap; (4) carries the
already-merged wave 1 (recall and judge stages, the eureka template and lenses, the three MCP
ops, the CLI door, the dev-time Jev first pass, `lib/core/claude-routing.cjs`) into the release
gate; (5) runs the spike that picks the judge against the Phase 355 baseline.

Out of scope here: the egress policy file for Jev-at-runtime and the Haiku pre-step (the
navigator chose not to discuss it; it stays as the ROADMAP card describes, decided at plan
time or deferred, see Claude's Discretion); the semantic-index folder split (ADR-E12, its own
plan or phase); SEED-099's resource guards (Phase 368); SEED-101's newborn-room graph fixes
(Phase 367).

</domain>

<decisions>
## Implementation Decisions

### Retiring the standalone runner
- **D-01:** `/mos:eureka` stays the name of the action. Only the engine behind it changes (navigator, verbatim: "eureka still a great action name, just not the engine").
- **D-02:** Retire now, alias first. In this phase `/mos:eureka` runs the perspective path as a quick run (recall, Stage A, plan, grant, run, prose, F.8 filing). The standalone runner (`scripts/eureka-portfolio-report.cjs` through `scripts/eureka-command.cjs`) stays reachable only behind an explicit legacy flag until the spike closes, then it is deleted. Users stop hitting the all-pairs loop the day the alias lands.
- **D-03:** The ambient run (Phase 355.1) uses the perspective's substrate and recall as its Eureka producer and hands the top candidates to the planner's `ambient.cjs` as an OFFER. No judge, no fetch, no filing in the background. One scorer everywhere (ADR-E5); the title-only `_eurekaAdapter` scorer retires with the runner.
- **D-04:** Banking on the new path is the planner's own `filing.cjs`: the F.8 basket card, `navigation.writeOpportunityNode` with lifecycle `candidate` and review_status `proposed`, `DERIVED_FROM` edges to both things, the Phase 355 stamp fields on `extraProps` (D-36..D-40 of 355). The runner's `bankStatements` retires with it. One filer for every perspective.
- **D-05:** The spike gold is labeled by the navigator, blind, on the three Phase 355 fixture rooms with the 355 protocol (`scripts/label-355-gold.cjs`, seeded shuffle, one sitting per arm's candidate file), so every number compares to the 44.8% baseline directly. Arms: Stage A only / Jev / Claude / Claude-then-Jev over the SAME candidates file, plus graph+lexical vs graph+lexical+vector recall. The bar is fixed before the run: useful rate above 44.8% with a Wilson interval that clears it, three repeats.

### Canvas op shape for the five perspectives
- **D-06:** All five perspectives get the same shape in this phase: RS (find-bottlenecks), HSI, whitespace, find-analogies and find-connections (navigator, unprompted: "also find analogies, and cross-domain"). Each contributes a recall stage that writes `candidates.jsonl`, a question template in `question-templates.cjs` with a falsifier, and lenses in `families.cjs`; the judge, candidates, plan, research, prose and filing stages are shared. The reference-only stubs in the tool router (`analysis find-bottlenecks`, `intelligence whitespace`, `orchestration scout-hsi`) go away once their perspective op lands.
- **D-07:** On MCP, one perspective op set on `research_run`: ops `perspective_recall`, `perspective_candidates`, `perspective_judge` with a `perspective` enum (`eureka`, `rs`, `hsi`, `whitespace`, `analogies`, `connections`). The shipped `eureka_recall` / `eureka_candidates` / `eureka_judge` become the eureka case (kept as deprecated aliases for one release, per 355 D-26: never a silent rename). Tool count stays 45 (test-270 pin), one description, one annotation set, one connector entry.
- **D-08:** RS and HSI are re-derived from the local graph, no embeddings at all: RS bottlenecks from graph structure (dependency edges, degree, the lagging component), HSI divergence from lexical versus graph co-occurrence. This is new math. The Phase 355 direction convention (`lib/core/direction-convention.cjs`, `structural_transfer` / `semantic_implementation`) and the floor ledger (`data/floor-ledger.json`) are re-measured against the 355 fixture rooms and gold; the existing `rs-engine` / `hsi-engine` paths stay in place until that measurement lands (the spike's recall arms decide).
- **D-09:** find-analogies and find-connections recall locally from the same substrate and the Eureka cross-domain candidates. Analogies add a SAPPhIRE structural template filled at the statement stage; connections add the Theo lateral-path check on pairs whose canon handles resolve. Any web or Theo reach happens only as an audited planner query under a grant (363 D-04 / D-10), never inside recall. The offline rule holds for every recall stage.

### Theo readiness: canon handles on nodes
- **D-10:** A node gets its canon Framework handle at filing plus a one-time backfill: `artifact_file` and the indexer resolve frontmatter `framework:` / `methodology:` and the title against `data/framework-names.json` by the Phase 355 D-10 exact-match rule; a miss stays null and is counted. No fuzzy matching.
- **D-11:** The handle is graph-native: one local node per canon name (type `framework`, id derived from the canon name) and a `USES_FRAMEWORK` edge from the thing, written through `navigation.writeEdge` (add `USES_FRAMEWORK` to `ALLOWED_EDGE_TYPES` if absent). Every perspective can walk thing -> framework -> thing locally before asking Theo. The `canon_handle` field in `things.jsonl` mirrors the edge.
- **D-12:** The canon coverage count is a Phase 343 statement in `lib/core/navigation/graph-integrity-counts.cjs` (things with a handle, things without), reported by `/mos:doctor room-graph-integrity`, watched by SENS-19, with a `watched_by` entry; counts only (SEED-074), `null` never `0` on a legacy schema. The per-run field is a mirror.
- **D-13 (amends Phase 355 D-10; Part 8 holds):** the vocabulary gap (80.2% not_called in 355) closes through Theo, GATED PER TERM. An exact-match miss proposes the room term on an F.8 card; only terms the navigator releases are sent to Theo for a nearest canon name; the answer lands as a PROPOSED entry in the room's translation table that the navigator confirms. Nothing leaves the machine without a yes, the release is logged in the planner's audit ledger, and the 355 D-10 rule ("no Theo lookup to guess a name") is amended to allow exactly this gated path and nothing else.
- **D-14:** The translation table lives at `<room>/references/canon-translations.md` (ICM L3 factory material next to `SECTION-SCHEMA.md`), YAML rows `{term, canon_name, ratified_at}`, read by the resolver after the exact match and before giving up.
- **D-15:** A pair whose one side has no canon handle stamps `unverified` / `not_called` / `handle_unresolved` with Theo asked zero times (355 D-10 unchanged for the stamp), plus the F.8 card offering the gated release of the missing term so the next run can ask.
- **D-16:** The backfill runs once over every registered room through `/mos:doctor --fix`: mints framework nodes and `USES_FRAMEWORK` edges for exact matches (and ratified translations), reports counts per room, idempotent (a thing never gets a second edge to the same framework).
- **D-17:** `data/framework-names.json` stays current in release lockstep: Phase 349's release-to-Theo leading edge regenerates the snapshot on every plugin release, and `release.sh` refuses a cut when the snapshot's Theo stamp lags (one more lockstep place in `VERSION-BUMP-CHECKLIST.md`).

### Claude's Discretion
- The egress policy file (Jev at runtime under the planner's grant and audit ledger versus dev-time only; the Haiku entity pre-step as a planner egress line or a separate producer) was offered as a gray area and not selected. Default for planning: Jev stays dev-time only (355 D-44) and the spike runs it from `scripts/eureka-jev-judge.cjs`; the Haiku pre-step is NOT part of any recall stage (D-09, offline rule) and `--offline` disables it on the legacy path (Phase 368 owns the guard); a `_config/egress-policy.json` read by the audit ledger is planned as one file with one line per egress, defaults as in the design document section 6. The navigator can overturn any of this at the plan review card.
- Per-perspective budgets (max candidates, max judged, max leaves) and the ambient offer size per perspective.
- CLI door subcommand names for the perspective ops (`perspective-recall --perspective rs` versus `rs-recall`), as long as no free text rides argv.
- How the legacy flag is spelled and where its deprecation notice prints.
- Counter-metric pairs per stage, following the design document section 8 and the Phase 343 declaration shape.

### Folded Todos
The navigator folded all four matched todos. None is in this phase's domain; each is carried as a planning constraint or a small closing task, not as new scope:
- **Registry-drift gate - prevent silent command disappearance keyed to F-shape** (`.planning/todos/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md`): a constraint on D-07, the deprecated `eureka_*` op aliases and `/mos:eureka` must pass `scripts/check-registry-drift.cjs`; if the gate cannot see MCP op names, note it as the known gap 355 D-26 already recorded.
- **F7 rescope: re-plan Phases 212/213 against registerCapability** (`.planning/todos/2026-07-08-f7-rescope-212-213-against-registercapability.md`): the planner checks whether the SENS-13 eureka reach (Phase 213) still fires once the ambient producer is the perspective (D-03); if the todo is moot, close it with that finding.
- **Deck generation does not honor an explicit slide count on the first pass** (`.planning/todos/2026-07-29-deck-generation-ignores-explicit-slide-count-on-first-pass.md`): unrelated to the perspective path; a one-plan closing task at the end of the phase if the executor has budget, otherwise re-deferred with a note.
- **Never git stash mid-merge-conflict-resolution, it drops MERGE_HEAD** (`.planning/todos/2026-07-12-never-git-stash-mid-merge-conflict-resolution-it-drops-merge.md`): an execution rule for every plan in this phase (the merges of this phase's worktrees), not a deliverable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's design and evidence
- `.planning/REVIEWS/2026-10-01-eureka-v2-design.md` - the design: five jobs, measured facts, the pipeline as an ICM workspace, stage contracts, egress declared once, ADRs E12-E16, the spike (section 9), the order of work.
- `.planning/REVIEWS/2026-10-01-eureka-architecture-review.md` - what is wrong with the standalone engine (verified line references A1-A7, C1-C7, S1-S6), ADRs E1-E7, and section 10 (the ICM system-map re-review: `lib/core/eureka/` is the shared semantic index with about 40 outside importers; live / leftover / ghost universes).
- `.planning/seeds/SEED-103-retire-eureka-engine-keep-perspective-in-research-planner.md` - the seed, what shipped on the branch (now on main: commits 00a6e5f85, 3c3b3d923, 0184220d4, merge ebd9090cf), what is open.
- `.planning/research/2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md` - sources and citations (langtalks, mcp-builder, claude-api, dogfood counts).
- `.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-BRIEF.md` - the hand-off brief.
- `tests/run-all-seed103.sh`, `tests/test-seed103-eureka-perspective.cjs`, `tests/test-seed103-claude-routing.cjs`, `tests/fixtures/seed103-mcp-eval.xml` - wave 1's gate and eval.

### The measured baseline every arm is judged against
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-VERIFICATION.md` - 43 of 96 useful (44.8%), direction right 16 of 96, 80.2% not_called, 45 of 96 already known, the stamp mix.
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-26-SUMMARY.md` and `355-JEV-MEASUREMENT.md` - Jev usefulness 76.04% (n 96), citation check 95.35%, costs.
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-CONTEXT.md` - D-10 (local exact-match resolution, amended here by D-13), D-14 (judge none), D-36..D-40 (filing contract), D-44 (Jev dev-time only), D-46 (bands from measured buckets).
- `tests/fixtures/355-rooms/` and `scripts/label-355-gold.cjs` - the three fixture rooms and the blind-label protocol (D-05).

### The planner this phase builds on
- `lib/core/research-planner/CONTEXT.md` - the one plan-and-run engine; a command contributes questions, a lens and a falsifier; the file map.
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-CONTEXT.md` - D-02a (one governed path), D-04 (grants, two lifetimes), D-10 (a new term asks once before it leaves), D-12 (run home), D-13 (CONTRADICTS through navigation), D-14 (one runner), D-15 (writeOpportunityNode).
- `.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-FOLLOW-ONS.md` - open items the perspectives inherit (the `zone_term` sidecar for ambient runs, the opportunity-bank listing visibility, the pyramid overlap warning).
- `lib/core/research-planner/perspectives/eureka-recall.cjs` and `eureka-judge.cjs` - the shipped stage modules the other perspectives copy.
- `lib/mcp/tools/research.cjs` - the `research_run` tool: ops, annotations, the `eureka_*` ops to generalize (D-07).
- `scripts/research-planner.cjs` - the JSON-only CLI door (no free text on argv).

### Graph, ICM and the integrity organ
- `lib/core/navigation/graph-integrity-counts.cjs` - the single home of integrity statements (D-12 adds canon coverage).
- `lib/core/navigation/edges.cjs` - `ALLOWED_EDGE_TYPES` (D-11 adds `USES_FRAMEWORK` if absent); `lib/core/navigation/typed-opportunity.cjs` - `writeOpportunityNode` and the evidence-edge subset (D-04).
- `lib/core/verification-stamp.cjs` - `loadFrameworkNames`, `resolveEndpoint`, the degradation matrix (D-10, D-15).
- `data/framework-names.json` - the canon snapshot (D-17); `docs/VERSION-BUMP-CHECKLIST.md` and `release.sh` - the lockstep places.
- `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` - the ten invariants, the system-map form, who-verifies, orthogonality.
- `lib/core/scaffold-predicate.cjs` and `lib/core/section-registry.cjs` - the one scaffold predicate and `isIndexableArtifactFile` (Phase 363.1).
- `lib/core/direction-convention.cjs`, `data/floor-ledger.json` - what D-08 re-measures.

### Canon and house rules
- `CLAUDE.md` (Part 8 egress boundary, Part 9 chokepoints, Part 11 connectors), `docs/MINDRIAN-CANON.md`.
- `tests/test-353-tripwires.cjs` - no Jev client under `lib/` or `hooks/`; `scripts/eureka-jev-judge.cjs` is on its banned-for-hooks ledger.
- `tests/test-270-tool-schema-budget.cjs` (45-tool pin), `tests/test-234-tool-description-floor.cjs`, `tests/test-205-surface-fence.cjs` - the MCP surface pins D-07 must keep green.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/research-planner/perspectives/eureka-recall.cjs`: `buildSubstrate`, `recallCandidates` (lanes, exclusion set, cap), `writeRunFiles`, `deriveStatus`, `questionSetFor`, `readCandidates` - the template every other perspective's recall stage copies; `declaredCouplings` reads per-section `CONTEXT.md` Inputs (the ICM lane).
- `lib/core/research-planner/perspectives/eureka-judge.cjs`: `stageAGate`, `judgeCandidates` with an injected `judgeFn`, `JEV_USEFULNESS_BUCKET`, `writeVerdicts` / `readVerdicts`.
- `lib/core/research-planner/` (Phase 363): `planner.buildPlan`, `cardFor`, `question-templates.cjs` (`dim`, `TEMPLATES`, `templateForCommand`), `families.cjs` (`LENS_FAMILY`, `composeForLeaf`, the five families and their slots), `grants.cjs`, `audit-ledger.cjs`, `quick.cjs`, `deep.cjs`, `filing.cjs` (`fileRun`, the F.8 basket), `ambient.cjs` (`maybeQuick`).
- `lib/core/claude-routing.cjs`: roles, `resolveModelId`, `buildMessagesBody`, `textOf`, `routingTable` - any new model call in this phase goes through it (the tripwire test forbids a hardcoded id).
- `lib/core/verification-stamp.cjs`: `loadFrameworkNames`, `resolveEndpoint`, `extractCarried`; `lib/core/eureka-critic.cjs`: `_gate1`, `confidenceFromBucket`.
- `lib/core/ambient-run.cjs` and `scripts/scout-cadence-guard.cjs`: the 355.1 producer adapters, throttle, lock, budget (D-03 swaps the Eureka adapter's body, keeps the composition).
- `scripts/jev-devtime-client.cjs`, `scripts/jev-question-ceilings.cjs`, `scripts/eureka-jev-judge.cjs`: the dev-time Jev path for the spike.
- `scripts/label-355-gold.cjs`, `scripts/measure-355-hit-rate.cjs`, `tests/fixtures/355-rooms/`: the blind-label protocol and fixtures (D-05).
- `lib/core/eureka/room-native-substrate.cjs`, `candidate-exclusion.cjs`, `tri-modal-index.cjs::lexicalSearch` (FTS5): local recall helpers; `lib/core/hsi-engine.cjs`, `lib/core/rs-engine.cjs`, `lib/core/rs-differential-scorer.cjs`: the engines D-08 re-derives, kept as the comparison arm.

### Established Patterns
- One governed path (363 D-02a): a perspective never fetches, never files; the planner does.
- Reads through `navigation.openRoomDbReadOnlyForCaller`; writes through `node-insert.cjs` and `navigation.writeEdge`; typed claims land `proposed`; promotion only through `gate_answer`.
- No free text on the CLI door's argv; MCP ops refuse with a `reason` and a `hint`; pagination with `limit` / `offset` / `has_more` / `next_offset` / `total`.
- Hermetic tests: `tests/helpers/hygiene-355.cjs` (scrub keys, net guard, checker), an isolated `MINDRIAN_ROOMS_HOME` before requiring repo modules, exit 77 for an env gap, a `run-all-<phase>.sh` aggregator written once.
- Generated files are never hand-edited: `data/connector-registry.json`, `data/mcp-tool-connectors.json`, skill mirrors (`scripts/build-skill-mirrors.cjs`), the orchestration projection; the pre-commit hook regenerates and refuses drift.
- Counts only for any health-shaped output (SEED-074); bands only from measured buckets (355 D-46); numbers in prose only with a source.
- Hyphens only, no em-dashes; CJS only; node >= 22.16 (`node:sqlite`), the WSL dev machine needs the nvm v22 binary on PATH for hooks.

### Integration Points
- `lib/mcp/tools/research.cjs`: the `OPS` enum, the zod `inputSchema`, the `switch` dispatch (D-07); `register-core-tools.cjs` auto-discovers the file.
- `lib/mcp/tool-router.cjs`: the reference-only stubs (`analysis find-bottlenecks`, `intelligence whitespace`, `orchestration scout-hsi`, `INTELLIGENCE_COMMANDS` / `EUREKA_COMPUTE_COMMANDS`) and the `ALL_TOOL_COMMANDS` pin (65) in `tests/test-205-surface-fence.cjs`.
- `commands/eureka.md` (+ its skill mirror), `commands/find-bottlenecks.md`, `commands/explore-domains.md` / `whitespace.md`, `commands/find-analogies.md`, `commands/find-connections.md`: the doors; each declares a template through `question-templates.cjs` `doors`.
- `lib/core/ambient-run.cjs::_eurekaAdapter` and `EXEC_ORDER` (D-03).
- `lib/mcp/tools/views.cjs` (`artifact_file`) and `lib/core/graph-ops.cjs` / `lazygraph-ops.cjs` (the indexer): where the canon handle resolution attaches (D-10, D-11).
- `lib/core/doctor/room-graph-integrity-module.cjs` and `lib/core/sensors/sensor-priority.cjs` (D-12's statement and `watched_by`); `lib/core/doctor/` for the `--fix` backfill (D-16).
- `release.sh`, `docs/VERSION-BUMP-CHECKLIST.md`, Phase 349's dispatch step (D-17).

</code_context>

<specifics>
## Specific Ideas

- "Eureka still a great action name, just not the engine" (D-01).
- "The canvas can utilize the local graph and ICM structure instead of embeddings" (the ICM lane reads per-section `CONTEXT.md` Inputs; D-08 extends the rule to RS and HSI).
- "We might need to reform the nodes in the local graph in rooms to play better with Theo's" (D-10..D-17: framework nodes and `USES_FRAMEWORK` edges, mirroring Theo's own shape).
- "Make sure we properly route the current Claude models, maybe Haiku wrong for what we want" (shipped in wave 1: `claude-routing.cjs`, Opus default per role).
- The spike compares to 44.8% on the same three rooms with the same protocol, so the number means something.

</specifics>

<deferred>
## Deferred Ideas

- The egress policy file as a navigator-ruled artifact (Jev at runtime; the Haiku pre-step) - offered, not selected; see Claude's Discretion for the planning default.
- The semantic-index folder split (`lib/core/eureka/` -> `lib/core/semantic-index/` + `lib/core/eureka/`, ADR-E12), behind a reference-integrity gate; its own plan at the end of this phase or its own phase.
- SEED-099 resource guards and the algorithmic fixes to what remains of the standalone runner: Phase 368.
- SEED-101 newborn-room graph fixes, including the section column on `artifact_file` claims that D-10 would benefit from: Phase 367.
- Phase 364 (Scientific Roadmapping command) reuses the same planner; the perspective shape should not block it.

### Reviewed Todos (not folded)
None - the navigator folded all four matches (see Folded Todos).

</deferred>

---

*Phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling*
*Context gathered: 2026-10-01*
