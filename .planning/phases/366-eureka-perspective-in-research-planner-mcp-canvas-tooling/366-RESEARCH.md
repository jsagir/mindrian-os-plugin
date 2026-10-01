# Phase 366: Eureka becomes a perspective of the research planner; the MCP canvas tooling; one home for Claude model routing - Research

**Researched:** 2026-10-01
**Domain:** research-planner perspectives (local-graph recall), MCP op surface, room-graph Theo readiness, release lockstep, blind-label spike
**Confidence:** HIGH for codebase facts (every file:line below was read in this session at HEAD 26d396d34); MEDIUM for the new RS/HSI graph math (a proposal, nothing measured yet); LOW for Theo-side behavior of the gated per-term lookup (depends on Theo tools not yet exercised from the plugin for this purpose).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Retiring the standalone runner
- **D-01:** `/mos:eureka` stays the name of the action. Only the engine behind it changes (navigator, verbatim: "eureka still a great action name, just not the engine").
- **D-02:** Retire now, alias first. In this phase `/mos:eureka` runs the perspective path as a quick run (recall, Stage A, plan, grant, run, prose, F.8 filing). The standalone runner (`scripts/eureka-portfolio-report.cjs` through `scripts/eureka-command.cjs`) stays reachable only behind an explicit legacy flag until the spike closes, then it is deleted. Users stop hitting the all-pairs loop the day the alias lands.
- **D-03:** The ambient run (Phase 355.1) uses the perspective's substrate and recall as its Eureka producer and hands the top candidates to the planner's `ambient.cjs` as an OFFER. No judge, no fetch, no filing in the background. One scorer everywhere (ADR-E5); the title-only `_eurekaAdapter` scorer retires with the runner.
- **D-04:** Banking on the new path is the planner's own `filing.cjs`: the F.8 basket card, `navigation.writeOpportunityNode` with lifecycle `candidate` and review_status `proposed`, `DERIVED_FROM` edges to both things, the Phase 355 stamp fields on `extraProps` (D-36..D-40 of 355). The runner's `bankStatements` retires with it. One filer for every perspective.
- **D-05:** The spike gold is labeled by the navigator, blind, on the three Phase 355 fixture rooms with the 355 protocol (`scripts/label-355-gold.cjs`, seeded shuffle, one sitting per arm's candidate file), so every number compares to the 44.8% baseline directly. Arms: Stage A only / Jev / Claude / Claude-then-Jev over the SAME candidates file, plus graph+lexical vs graph+lexical+vector recall. The bar is fixed before the run: useful rate above 44.8% with a Wilson interval that clears it, three repeats.

#### Canvas op shape for the five perspectives
- **D-06:** All five perspectives get the same shape in this phase: RS (find-bottlenecks), HSI, whitespace, find-analogies and find-connections (navigator, unprompted: "also find analogies, and cross-domain"). Each contributes a recall stage that writes `candidates.jsonl`, a question template in `question-templates.cjs` with a falsifier, and lenses in `families.cjs`; the judge, candidates, plan, research, prose and filing stages are shared. The reference-only stubs in the tool router (`analysis find-bottlenecks`, `intelligence whitespace`, `orchestration scout-hsi`) go away once their perspective op lands.
- **D-07:** On MCP, one perspective op set on `research_run`: ops `perspective_recall`, `perspective_candidates`, `perspective_judge` with a `perspective` enum (`eureka`, `rs`, `hsi`, `whitespace`, `analogies`, `connections`). The shipped `eureka_recall` / `eureka_candidates` / `eureka_judge` become the eureka case (kept as deprecated aliases for one release, per 355 D-26: never a silent rename). Tool count stays 45 (test-270 pin), one description, one annotation set, one connector entry.
- **D-08:** RS and HSI are re-derived from the local graph, no embeddings at all: RS bottlenecks from graph structure (dependency edges, degree, the lagging component), HSI divergence from lexical versus graph co-occurrence. This is new math. The Phase 355 direction convention (`lib/core/direction-convention.cjs`, `structural_transfer` / `semantic_implementation`) and the floor ledger (`data/floor-ledger.json`) are re-measured against the 355 fixture rooms and gold; the existing `rs-engine` / `hsi-engine` paths stay in place until that measurement lands (the spike's recall arms decide).
- **D-09:** find-analogies and find-connections recall locally from the same substrate and the Eureka cross-domain candidates. Analogies add a SAPPhIRE structural template filled at the statement stage; connections add the Theo lateral-path check on pairs whose canon handles resolve. Any web or Theo reach happens only as an audited planner query under a grant (363 D-04 / D-10), never inside recall. The offline rule holds for every recall stage.

#### Theo readiness: canon handles on nodes
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

### Folded Todos (planning constraints, not new scope)
- **Registry-drift gate** (`.planning/todos/2026-07-03-registry-drift-gate-...`): D-07's deprecated `eureka_*` op aliases and `/mos:eureka` must pass `scripts/check-registry-drift.cjs`; if the gate cannot see MCP op names, note it as the known gap 355 D-26 recorded.
- **F7 rescope** (`.planning/todos/2026-07-08-f7-rescope-212-213-against-registercapability.md`): check whether the SENS-13 eureka reach still fires once the ambient producer is the perspective (D-03); close the todo with that finding if moot.
- **Deck slide count** (`.planning/todos/2026-07-29-...`): unrelated; a closing task only if budget remains, else re-deferred with a note.
- **Never git stash mid-merge-conflict** (`.planning/todos/2026-07-12-...`): an execution rule for every plan in this phase.

### Deferred Ideas (OUT OF SCOPE)
- The egress policy file as a navigator-ruled artifact (Jev at runtime; the Haiku pre-step) - offered, not selected; see Claude's Discretion for the planning default.
- The semantic-index folder split (`lib/core/eureka/` -> `lib/core/semantic-index/` + `lib/core/eureka/`, ADR-E12), behind a reference-integrity gate; its own plan at the end of this phase or its own phase.
- SEED-099 resource guards and the algorithmic fixes to what remains of the standalone runner: Phase 368.
- SEED-101 newborn-room graph fixes, including the section column on `artifact_file` claims that D-10 would benefit from: Phase 367.
- Phase 364 (Scientific Roadmapping command) reuses the same planner; the perspective shape should not block it.
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed, to be minted as EPV366-01..28 in REQUIREMENTS.md)

The family prefix `EPV366` follows the REQUIREMENTS.md convention (`DRP363`, `HIPS`, `AMB`). Every row maps to a CONTEXT decision.

| ID | Description | Decision | Research Support |
|----|-------------|----------|------------------|
| EPV366-01 | Wave 1 (SEED-103, already on main: 00a6e5f85, 3c3b3d923, 0184220d4, merge ebd9090cf) is carried into `tests/run-all-366.sh` and into whatever "the release gate" is ruled to mean (see Open Question 1) | Deliverable 1 | `tests/run-all-seed103.sh` is 20/20 green at HEAD (measured this session); no phase aggregator is shelled by `scripts/release.sh` or `scripts/doctor.cjs --acceptance` today |
| EPV366-02 | One per-perspective module interface (`recall`, `TEMPLATE_ID`, `LENSES`, `FALSIFIER`, `RUN_ROOT`, `BUDGETS`, `questionSetFor`) plus a registry; eureka conforms with zero behavior change | D-06 | Architecture Pattern 1 |
| EPV366-03 | `research_run` gains `perspective_recall` / `perspective_candidates` / `perspective_judge` with a `perspective` enum; `eureka_*` stay as deprecated aliases returning the same shape plus a deprecation field; 45 tools; totalBytes within 10% of 48712 | D-07 | Pattern 2; test-270 headroom measured at 49318 bytes (1.24% over AFTER) |
| EPV366-04 | CLI door `perspective-recall` / `perspective-judge --perspective <enum>`; `eureka-recall` / `eureka-judge` kept as aliases; argv validator refuses free text | D-07, discretion | `scripts/research-planner.cjs:94-95,121-157` |
| EPV366-05 | RS perspective recall from local graph structure (no embeddings), its template, lenses, falsifier | D-06, D-08 | Pattern 4; fleet edge census |
| EPV366-06 | HSI perspective recall: lexical vs graph co-occurrence divergence, with a graph-variant direction classifier living in `direction-convention.cjs` | D-08 | Pattern 5 |
| EPV366-07 | Whitespace perspective recall shape reusing the existing `whitespace` template and `ws.*` lenses | D-06 | `question-templates.cjs:165-192` |
| EPV366-08 | Analogies perspective: recall from the eureka cross-domain candidates plus a SAPPhIRE structural template filled at the statement stage | D-09 | Pattern 6; `references/methodology/sapphire-encoding.md` exists |
| EPV366-09 | Connections perspective: recall plus the Theo lateral-path check only on resolved-handle pairs, only as an audited planner query | D-09 | `verification-stamp.cjs:390-420` |
| EPV366-10 | Every recall stage is offline: a net-guard test proves zero sockets for all six perspectives | D-09 | `tests/helpers/hygiene-355.cjs` |
| EPV366-11 | Router stubs (`analysis find-bottlenecks`, `intelligence whitespace`, `orchestration scout-hsi`) answer with a pointer to the `research_run` perspective op instead of a reference-only echo; `ALL_TOOL_COMMANDS` stays at 65 | D-06 | Pitfall 2 |
| EPV366-12 | One filer: a `cross_domain_transfer` opportunity candidate is produced by the pyramid, carries the pair endpoints, and `filing.cjs` files it with `writeOpportunityNode` (candidate, proposed), `DERIVED_FROM` to both things, and the 355 stamp fields on `extraProps`; `fileStampedOpportunity` moves out of the runner | D-04 | Pitfall 1 (the eureka kind is dead-wired today) |
| EPV366-13 | `/mos:eureka` is the quick-run alias on the perspective path; legacy flag reaches the runner; MCP `intelligence eureka-run` honors the same flag; "ZERO writes / ZERO network" wording removed | D-01, D-02 | Pattern 7 |
| EPV366-14 | Ambient: `_eurekaAdapter` uses perspective recall; top candidates become an offer through `ambient.cjs`; no Theo stamp, no fetch, no filing for the eureka producer | D-03 | Pattern 8 |
| EPV366-15 | Canon handle resolution at filing in `artifact_file` and the indexer, through the ONE resolver `verification-stamp.resolveEndpoint` extended with the translation table | D-10, D-14 | Pitfall 5 (eureka-recall resolves methodology differently) |
| EPV366-16 | Local `framework` nodes (`FRAMEWORK_NODE_ID`) minted before every `USES_FRAMEWORK` edge; `things.jsonl canon_handle` mirrors the edge | D-11 | `USES_FRAMEWORK` already in `ALLOWED_EDGE_TYPES` (`edges.cjs:900`) |
| EPV366-17 | Canon coverage statement in `graph-integrity-counts.cjs`, reported by `room-graph-integrity`, SENS-19 record updated | D-12 | Pattern 9 |
| EPV366-18 | Gated per-term Theo release: F.8 card, navigator yes, audit-ledger row, proposed translation row, navigator confirm | D-13, D-15 | Pattern 10, Open Question 3 |
| EPV366-19 | `<room>/references/canon-translations.md` format, parser, and its read in the resolver | D-14 | Pattern 10 |
| EPV366-20 | `/mos:doctor --fix` canon backfill module (`fix_supported: true`), per-room counts, idempotent | D-16 | Pattern 11 |
| EPV366-21 | Snapshot lockstep: `framework-names.json` carries a Theo stamp; release refuses a lagging stamp; RULE 5 place added in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` (not `VERSION-BUMP-CHECKLIST.md`, which WD-14 forbids) | D-17 | Pitfall 6 |
| EPV366-22 | One declared egress policy file read by the audit ledger; `--offline` sets every line false and the run still completes | Discretion | Pattern 12 |
| EPV366-23 | Spike harness: per-arm items files built from candidates, blind labels, Wilson bar fixed before the run, three repeats, a record file | D-05 | Pattern 13 |
| EPV366-24 | Spike re-measures the direction convention and floor-ledger rows for the graph RS/HSI against the 355 fixtures | D-08 | Pattern 5, Pitfall 9 |
| EPV366-25 | Runner retirement after the spike closes: delete the runner, migrate or retire its 38 tests, keep `run-all-*.sh` green | D-02 | Runtime State Inventory |
| EPV366-26 | Counter-metric pairs declared per stage (Phase 343 shape) | Discretion | Design section 8 |
| EPV366-27 | Perspective floors disclosed: `check-floor-ledger.cjs` scans `lib/core/research-planner/perspectives/*.cjs` and the ledger carries their rows | D-08, 355 D-46 | Pitfall 8 |
| EPV366-28 | Folded todos closed or re-deferred with a written finding | Folded todos | CONTEXT |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Hyphens only. No em-dash or en-dash anywhere (code, docs, tool descriptions). `tests/run-all-seed103.sh` already greps the seed files for `\xE2\x80\x94`.
- CJS only; switch-case argv routers; no Commander or yargs.
- Part 8: room content never egresses to the Brain; only generic methodology handles cross. D-13 is an explicit, narrow amendment of 355 D-10; it does not amend Part 8, so every Theo call still has to pass `lib/core/part8-egress-guard.cjs` (Pitfall 4).
- Part 9: `lib/core/navigation.cjs` is the single SQL chokepoint; nodes through `node-insert.cjs insertNode`, edges through `navigation.writeEdge`; `scripts/check-substrate.cjs --diff` runs on every commit and refuses new raw graph SQL.
- Part 11: every invocable surface is born wired or excluded with a declared HITL shape; generated registries are never hand-edited.
- Part 7: reuse before build (the perspective ops reuse the planner; no second runner, filer or ledger).
- Tri-Polar: every feature works on CLI, Desktop, Cowork (the MCP op set is the Desktop and Cowork door).
- Workspace guard: work only in `/home/jsagi/dev/MindrianOS-Plugin`; read the version with `node lib/core/repo-version.cjs`.
- Consult icm-architect, langtalks-graph-expert and Theo (through the guarded shim only) before graph-design assumptions (ROADMAP card says this explicitly).
- GSD workflow enforcement: edits only through a GSD command.

## Summary

The wave-1 Eureka perspective is on main and green (`bash tests/run-all-seed103.sh`: PASSED=20 FAILED=0, measured this session). Its two stage modules (`perspectives/eureka-recall.cjs`, `perspectives/eureka-judge.cjs`) are already the right shape to generalize: `buildSubstrate(db)` reads all nodes and edges once, `recallCandidates(substrate, roomDir, budgets)` runs three local lanes with the room graph as the exclusion set and a hard cap, `questionSetFor` hands the planner a question set, and `runJudge` writes Stage A verdicts. The MCP door (`lib/mcp/tools/research.cjs`) already carries `eureka_recall` / `eureka_candidates` / `eureka_judge` in one `OPS` enum with pagination and refusal hints. Generalizing to six perspectives is mostly mechanical: an interface, a registry, a `perspective` enum, and per-perspective recall math.

Three findings change the plan materially. First, **the eureka filing path is dead-wired today**: the eureka template declares opportunity kind `cross_domain_transfer` (`question-templates.cjs:287`), but `pyramid.cjs` only knows six kinds (`pyramid.cjs:46-48`) and has no branch for it, and `normalizeLeaf` (`pyramid.cjs:357-380`) drops the leaf's `candidate: {a, b, lanes}` field, so a eureka quick run can never put a pair on the F.8 basket and filing can never write `DERIVED_FROM` to both things (D-04). Second, **the 44.8% baseline was not measured on Eureka**: the 96 pairings in `tests/fixtures/355-rooms/pairings.items.json` are 47 HSI and 49 RS pairs; eureka was recorded as `substrate_unavailable` because the fixture rooms are pure markdown with no `room.db` (`scripts/measure-355-hit-rate.cjs:337-355`). The spike must index the fixture copies first, and the RS/HSI arms are the like-for-like comparison. Third, **the local graph is thin on the edges D-08 assumes**: a read-only census of the 31 local rooms finds INFORMS 4675, CONVERGES 3927, DESCRIBES 2675, BELONGS_TO 1032, but only 38 dependency-shaped edges (USES_COMPONENT 26, SUPPLIES_TO 12), SUPPORTS 5, CONTRADICTS 1, USES_FRAMEWORK 1, and zero `framework` nodes. Graph RS cannot lean on dependency edges; it has to work from section-level structure (INFORMS flow, degree, claim support).

Two house constraints also redirect CONTEXT wording: `USES_FRAMEWORK` already exists in `ALLOWED_EDGE_TYPES` (`lib/core/navigation/edges.cjs:900`) with an id helper `FRAMEWORK_NODE_ID` (`lib/core/navigation/reasoning-write.cjs:74-79`), so D-11 adds node minting, not the edge type; and `docs/VERSION-BUMP-CHECKLIST.md` deliberately does not exist (WD-14, re-ruled at 349-03), so D-17's lockstep place belongs in RULE 5 of `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`.

**Primary recommendation:** Land the perspective interface and the MCP/CLI op generalization first (pure refactor, eureka byte-stable), then fix the dead filing wire (pyramid kind + leaf pair carry + relocated stamped filer) before the alias, then Theo readiness, then the four new recall modules, and run the spike on indexed fixture copies with candidate files converted into the 355 items shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Perspective recall (six kinds) | Local engine (`lib/core/research-planner/perspectives/`) | Room DB read-only (`openRoomDbReadOnlyForCaller`) | Offline rule D-09; writes only run files under `<room>/.mindrian/` |
| Judge Stage A | Local engine (`eureka-judge.cjs`, generalized) | - | Free, deterministic, no model |
| Jev / Claude judge arms | Dev-time scripts (`scripts/`) | Host Claude session (subagent) | 355 D-44; test-353 tripwire bans Jev under `lib/`, `hooks/` |
| Plan, grant, fetch, evidence, verdict | Planner (`planner.cjs`, `quick.cjs`, `deep.cjs`) | OpenAlex adapter | One governed path (363 D-02a) |
| Filing | Planner `filing.cjs` through `navigation` | Gate ledger (`gate_answer`) | D-04 one filer; Part 9 chokepoint |
| MCP door | `lib/mcp/tools/research.cjs` | `lib/mcp/tool-router.cjs` (stub redirects) | Tri-Polar Desktop/Cowork door; 45-tool pin |
| CLI door | `scripts/research-planner.cjs` | `commands/*.md` doors | JSON-only argv |
| Canon handle resolution | `verification-stamp.cjs resolveEndpoint` (one resolver) | `artifact_file`, indexer, recall | D-10 exact match; one rule, many callers |
| Framework nodes and edges | Navigation chokepoint (`insertNode`, `writeEdge`) | Doctor `--fix` backfill | Part 9 |
| Canon coverage count | `graph-integrity-counts.cjs` | `room-graph-integrity` doctor module, SENS-19 | Phase 343 single home |
| Gated Theo term release | Planner audit ledger + gate ledger | brain-client through Part 8 guard | D-13 |
| Snapshot lockstep | `scripts/release.sh` + `scripts/release-lib/` | `scripts/refresh-framework-names.cjs` | D-17 |
| Ambient offer | `lib/core/ambient-run.cjs` adapter | `research-planner/ambient.cjs` | D-03 |

## Standard Stack

No new external packages. Everything is in-repo CJS on Node built-ins.

### Core
| Module | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| `node:sqlite` DatabaseSync | Node >= 22.16 (22.23.1 on the dev box) | room.db reads and writes | The repo's only DB driver [VERIFIED: node --version in WSL] |
| `zod` | already a dependency of `lib/mcp/tools/*.cjs` | MCP input schemas (`z.enum(OPS)`, `perspective` enum) | `research.cjs:41,590-603` [VERIFIED: codebase] |
| `eureka-recall.cjs` / `eureka-judge.cjs` | `lib/core/research-planner/perspectives/` | Template for every perspective | CONTEXT code_context [VERIFIED: codebase] |
| `verification-stamp.cjs` | `lib/core/` | `loadFrameworkNames`, `extractCarried`, `resolveEndpoint`, `toNodeProps`, `stampFindings` | 355 D-10 resolver [VERIFIED: codebase lines 232-316, 581-626] |
| `navigation.cjs` | `lib/core/` | `writeEdge`, `writeOpportunityNode`, `linkOpportunityEvidence`, `FRAMEWORK_NODE_ID`, `openRoomDbReadOnlyForCaller` | Part 9 chokepoint [VERIFIED: codebase] |
| `node-insert.cjs insertNode` | `lib/core/` | NOT-NULL-safe node writes; `epistemic_type` required; `on_conflict: 'nothing'` for idempotence | `node-insert.cjs:202-265` [VERIFIED: codebase] |
| `claude-routing.cjs` | `lib/core/` | Role `pair_judge` (opus, effort high) and `statement` | `claude-routing.cjs:47-66` [VERIFIED: codebase] |

### Supporting
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `scripts/label-355-gold.cjs` | Blind labeling CLI (`start/resume/status/emit/import`, seeded mulberry32 shuffle, `fixture_sha256` guard) | Spike sittings |
| `scripts/measure-355-hit-rate.cjs` | `wilson95(k, n)` (`:103`), `guardRoomPath`, temp-copy discipline | Spike record; copy its guard and Wilson, never re-derive |
| `scripts/eureka-jev-judge.cjs` | Dev-time Jev arm over `candidates.jsonl`, `--check` replay | Spike Jev arm (fixture rooms only) |
| `scripts/refresh-framework-names.cjs` | `--live` regenerates the snapshot via `brainClient.askOp('list_frameworks')`; `--check` offline | D-17 |
| `scripts/release-lib/theo-stamp-gate.sh` | The LAGGING gate shape, `MINDRIAN_THEO_STAMP_CMD` test seam, `--dry-run` carve-out | D-17 snapshot gate copies this shape |
| `lib/core/doctor/room-map-module.cjs`, `section-ruling-module.cjs` | `fix_supported: true` doctor modules | D-16 backfill shape |
| `tests/helpers/hygiene-355.cjs` | `scrubVendorKey`, `installNetGuard`, `makeChecker` | Every new hermetic test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-perspective files under `perspectives/` | One big `perspectives.cjs` | One file per job (ICM invariant 1) wins; the registry is a 20-line index |
| New MCP tool per perspective | Ops on `research_run` | D-07 locks one tool; test-270 pins 45 |
| Fuzzy canon matching | Translation table + gated Theo | D-10 forbids fuzzy; Theo's own `normalize_framework_name` refuses fuzzy too |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages (verified by reading the design, CONTEXT and every touched module; all are in-repo CJS on Node built-ins and the existing `zod`). slopcheck was not run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
 door (one of)                                    room.db (read-only)      per-section CONTEXT.md
 /mos:eureka | /mos:find-bottlenecks | ...  --+        |                          |
 MCP research_run op perspective_recall      |        v                          v
 CLI research-planner perspective-recall  ---+--> [perspective registry] --> [recall(db, roomDir, budgets)]
 ambient child (355.1 composition)        ---+         picks module            lanes + exclusion set + cap
                                                                                 |
                       <room>/.mindrian/<run-root>/<tag>/01_substrate/output/things.jsonl
                       <room>/.mindrian/<run-root>/<tag>/02_recall/output/candidates.jsonl  (edit surface)
                                                                                 |
             ambient path stops here: top-K -> ambient.cjs offer card (no judge, no fetch, no file)
                                                                                 |
                                                     [judge: Stage A + injected judgeFn]
                                                     03_judge/output/verdicts.jsonl
                                                                                 |
                                                     [questionSetFor -> planner.buildPlan]
                                                     .mindrian/research-runs/<run_id>/ (plan.json)
                                                                                 |
                                             F.0 grant card --gate_answer--> runQuick (OpenAlex, audited)
                                                                                 |
                                             pyramid.opportunityCandidates (needs cross_domain_transfer)
                                                                                 |
                                             F.8 basket --gate_answer--> filing.fileRun
                                                    writeOpportunityNode(candidate, proposed)
                                                    DERIVED_FROM -> a, DERIVED_FROM -> b, stamp extraProps
```

Theo readiness runs beside this, not inside it:

```
 artifact_file / indexer --> resolveEndpoint(framework, methodology, title, translations)
        hit:  insertNode('framework:<slug>', 'framework') then writeEdge(thing -> framework, USES_FRAMEWORK)
        miss: canon_handle null, counted; optional F.8 "release this term to Theo?" card
                    yes -> audit-ledger row -> brain-client (Part 8 guard) -> proposed row in references/canon-translations.md
                    navigator confirms row -> next resolve uses it
 graph-integrity-counts -> canon_coverage statement -> doctor room-graph-integrity, SENS-19
 doctor --fix canon-backfill -> walks the registry, idempotent mints, per-room counts
```

### Recommended Project Structure
```
lib/core/research-planner/perspectives/
├── index.cjs              # registry: id -> module; PERSPECTIVE_IDS frozen enum
├── shared.cjs             # run files, STATUS.md derivation, jsonl io, pairKey, tokenize (lifted from eureka-recall _test)
├── eureka-recall.cjs      # unchanged exports; implements the interface
├── eureka-judge.cjs       # becomes perspective-agnostic judge (or judge.cjs + eureka re-export)
├── rs-recall.cjs          # graph lagging-component recall
├── hsi-recall.cjs         # lexical vs graph divergence recall
├── whitespace-recall.cjs  # cross-section coverage gaps, reuses whitespace template
├── analogies-recall.cjs   # re-ranks eureka candidates for structural transfer; SAPPhIRE slots
└── connections-recall.cjs # resolved-handle pairs; thing -> framework -> thing walks
```

### Pattern 1: The perspective module interface (EPV366-02)
**What:** every recall module exports the same names the eureka module already exports, so the MCP and CLI doors dispatch by enum.
**Interface (derived from `eureka-recall.cjs:527-545` and `research.cjs:472-573`):**
```js
// lib/core/research-planner/perspectives/<id>-recall.cjs
module.exports = {
  ID: 'rs',                      // enum member
  TEMPLATE_ID: 'rs',             // key in question-templates TEMPLATES
  COMMAND: '/mos:find-bottlenecks',
  LENSES: ['rs.lagging', 'rs.known'],   // keys in families.LENS_FAMILY
  RUN_ROOT: path.join('.mindrian', 'perspectives', 'rs'),  // eureka keeps '.mindrian/eureka-perspective'
  BUDGETS: Object.freeze({ max_candidates: 200, max_leaves: 8 /* plus perspective floors */ }),
  STAGES,                        // shared ['01_substrate','things.jsonl'] ... from shared.cjs
  runRecall(roomDir, opts) -> { ok, tag, run_dir, counts, pairs_truncated, candidates, question_set },
  readCandidates(roomDir, tag) -> { header, candidates } | null,
  runDirFor(roomDir, tag),
  questionSetFor(recall, substrate, opts),
};
```
Keep eureka's `RUN_ROOT` (`.mindrian/eureka-perspective`) unchanged so wave-1 run folders, `scripts/eureka-jev-judge.cjs` and `tests/fixtures/seed103-mcp-eval.xml` keep working. Each candidate row keeps the shape `{a, b, section_a, section_b, title_a, title_b, lanes[], ...}` so the shared judge, the paginated read and the spike converter work for every perspective; perspective-specific scores ride extra keys (`lag_score`, `divergence`, `direction`). `judgeCandidates` (`eureka-judge.cjs:72-97`) is already perspective-agnostic except for `recall.runDirFor`; pass the module in.

### Pattern 2: MCP op generalization with deprecated aliases (EPV366-03)
- `OPS` (`research.cjs:55`) becomes `[...core, 'perspective_recall', 'perspective_candidates', 'perspective_judge', 'eureka_recall', 'eureka_judge', 'eureka_candidates']`.
- Add `perspective: z.enum(PERSPECTIVE_IDS).optional()` to `inputSchema` (`:590-603`); `perspective_*` refuse with `{reason:'perspective_required', hint}` when absent.
- The three `eureka_*` cases call the same handlers with `perspective:'eureka'` and keep `op: 'eureka_recall'` in the payload (the seed103 test checks `r1.op === 'eureka_recall'`, `tests/test-seed103-eureka-perspective.cjs:170`), plus `deprecated: true, use_instead: 'perspective_recall'`.
- `run_tag` regex `^[0-9TZ]{1,20}$` stays; the tag is only unique within a perspective's `RUN_ROOT`, so `perspective_candidates` must require `perspective` (a bare tag is ambiguous).
- Description: one string. test-234 requires >= 120 chars, <= 2048 BYTES (`test-234-tool-description-floor.cjs:92,108`), capital start, sentence terminator, no em-dash. The current description already names `eureka_recall` and the seed103 test greps it (`:167`); either keep that token in the new description or update the test in the same plan.
- Budget: test-270 measured 45 tools, 49318 total bytes vs AFTER 48712 (+1.24%); the drift alarm is 10% (`test-270-tool-schema-budget.cjs:41,427-431`), so about 4265 bytes of headroom remain before a deliberate re-baseline. A new enum field plus about 300 description bytes fits; record the delta in the test's re-baseline comment block the way 363-17 did (`:315-344`).
- `connectors` export (`research.cjs:676-686`) stays one entry; run `node scripts/build-connector-registry.cjs` to regenerate `data/mcp-tool-connectors.json` and `data/connector-registry.json` (never hand-edit).
- `tests/test-363-mcp-tool.cjs:395` lists only the ten core ops; extend it to assert the new ops parse.

### Pattern 3: CLI door (EPV366-04)
`scripts/research-planner.cjs` validates flags per subcommand (`:94-95`) and value shapes (`:137-157`, `case 'judge': return v === 'none'`). Add `'perspective-recall': { flags: ['--room','--perspective','--max','--tag','--mode'], need: ['--room','--perspective'] }` and `'perspective-judge'`, a `perspective` value shape checked against the frozen enum, and keep `eureka-recall` / `eureka-judge` as aliases that inject `--perspective eureka`. Recommendation: `perspective-recall --perspective rs` (one subcommand family, enum-validated) over `rs-recall` (five new subcommands to keep in parity).

### Pattern 4: RS from the local graph (EPV366-05) [proposal, MEDIUM]
Measured fact the math must respect (31 local rooms, read-only census this session): INFORMS 4675, CONVERGES 3927, DESCRIBES 2675, TAGGED_WITH 1383, BELONGS_TO 1032, STATES 436, REVERSE_SALIENT 229, WHITESPACE_DETECTED 215, DERIVED_FROM 132, HSI_CONNECTION 61, COMPETES_WITH 41, USES_COMPONENT 26, SUPPLIES_TO 12, SUPPORTS 5, CONTRADICTS 1, USES_FRAMEWORK 1. Dependency-shaped edges are 38 fleet-wide, so a Hughes lagging-component computation cannot be built on dependency edges alone.
Proposed computation, section as the component:
1. Component graph: collapse things to their section (the same `sectionOfNode` + one-hop inheritance the eureka substrate uses, `eureka-recall.cjs:127-136,213-235`). Directed section edges from INFORMS / ENABLES / USES_COMPONENT / SUPPLIES_TO / DERIVED_FROM between things in different sections, plus ICM declared couplings from per-section `CONTEXT.md ## Inputs` (`declaredCouplings`, `:260-279`) as directed "feeds" edges.
2. Per section, local signals (counts only): things, claims, claims with a SUPPORTS or SOURCED_FROM anchor, inbound flow, outbound flow, proposed-vs-confirmed ratio.
3. Lag score: a section is lagging when its upstream neighbors are developed and it is not; e.g. `lag = median(develop(upstream)) - develop(self)` where `develop` is a rank-normalized blend of things and anchored claims. Rank-normalize within the room so no absolute floor is needed (D-46: no band without a measured bucket).
4. Candidates: pairs (upstream thing, lagging-section thing) across the lagging boundary, excluded when already connected, capped. Lanes: `flow_boundary`, `icm_declared`, `support_gap`.
Falsifier template: "Evidence that the named section is not the constraint: downstream progress is blocked elsewhere, or the section is complete under other words." Lens family: `causal-link/v1` (`families.cjs:109`) fits ("does A's progress depend on B").

### Pattern 5: HSI from lexical vs graph co-occurrence (EPV366-06) [proposal, MEDIUM]
Today's direction convention classifies `signed_diff = lsa - semantic` (`direction-convention.cjs:29-30,93-101`): `> 0` is `structural_transfer` ("same meaning in different words"), `<= 0` is `semantic_implementation` ("same words with different meaning"). For a no-embedding HSI, map the two legs as: lexical leg = Jaccard over stopword-stripped tokens (already `eureka-recall._test.jaccard`); relational leg = graph co-occurrence, e.g. Jaccard (or Adamic-Adar) over each thing's neighbor set through DESCRIBES entities, shared framework nodes (after D-11), and section couplings. Then `signed_diff = relational - lexical`: high relation, low word overlap reads "same meaning in different words" (structural_transfer); high word overlap, no relation reads "same words with different meaning" (semantic_implementation). Put the graph-variant classifier inside `direction-convention.cjs` (leg H of `test-355-direction-agreement.cjs` requires that comparison-to-label code lives only there) and give it its own phrase-hash entry so `PHRASES_CONFIRMED` is not silently reused.
Re-measurement (D-08): the spike runs this recall on indexed copies of the three 355 rooms; the navigator's existing 96-pair gold has `direction_ok` per pair, so direction agreement for any new pair set needs new labels (pairs differ). `tests/test-355-direction-agreement.cjs`, `test-355-direction-convention.cjs`, `test-355-direction-readers.cjs`, `test-355-floor-sweep.cjs`, `test-355-eureka-ranking-pin.cjs` must stay green because rs-engine and hsi-engine remain the live path until the spike decides.

### Pattern 6: Analogies and connections recall (EPV366-08, -09)
- find-analogies today: SAPPhIRE + TRIZ, Brain tools plus `mcp__tavily__tavily-search` in `--external` mode with a Part 8 audit fence (`commands/find-analogies.md:36-39,55-56,84-85,126`); `references/methodology/sapphire-encoding.md` exists.
- find-connections today: Brain `brain_concept_connect` / `brain_cross_domain` patterns (`commands/find-connections.md:62-94`) and `scripts/stamp-connections.cjs --pair "<A>|<B>"` for the stamp.
- Analogies recall: take the eureka candidates (same substrate, same exclusion set) and keep pairs whose lanes include a relational signal (shared entity or framework node) with low lexical overlap: the structural-transfer half of Pattern 5. The SAPPhIRE template belongs at the statement stage: leaf slots `{function, behavior, structure}` per side filled from the room text by the host model, never by recall; the families composer receives only the short terms (`slotTerm`, `eureka-recall.cjs:443-450`).
- Connections recall: pairs where both endpoints carry a `canon_handle` (after D-10/D-11), plus local two-hop walks thing -> framework -> thing. The Theo lateral-path check is `verification-stamp.stampFinding` (`_theoOutcomeFor` calls `callTool('find_connections', {from, to})`, `:390-420`) and only ever with canon names. D-09 says it runs only as an audited planner step under a grant: add it as a planner evidence lane (not inside recall), and record it in the audit ledger with `provider: 'theo'`.

### Pattern 7: The `/mos:eureka` alias and the legacy flag (EPV366-13)
Callers of the runner (grep this session): `commands/eureka.md:107-230` and its mirror `skills/eureka/SKILL.md:105-228`; `lib/mcp/tool-router.cjs:1499-1600` (`intelligence eureka-run/status/report`, in-process on http, detached child on stdio); `lib/core/ambient-run.cjs:221,573` (stampRankedPairs, eurekaEndpoints, fileStampedOpportunity); `lib/core/doctor/class-s-eureka-smoke.cjs:389`; `scripts/measure-355-hit-rate.cjs:342` (comment only); `scripts/entity-extract.cjs:7,149,604` (comments, shape clone); comments in five `lib/core/eureka/*.cjs` files; 38 test files plus `run-all-216/218/219/341/355/363.1.sh`.
Recommendation: `/mos:eureka` with no argument (or `run`) runs the perspective quick run; `/mos:eureka --legacy <run|start|status|report|html|enable|reasoning-*>` reaches `scripts/eureka-command.cjs` and prints one deprecation line naming the retirement condition (the spike). On MCP, `intelligence eureka-run` accepts `{"legacy":true}` in its `context` JSON (the D-G flag precedent, `tool-router.cjs:1516-1525`); without it, answer with a pointer to `research_run perspective_recall`. Edit `commands/eureka.md` only, then run `node scripts/build-skill-mirrors.cjs`; the mirror is generated.

### Pattern 8: Ambient recall-as-offer (EPV366-14)
`EXEC_ORDER = ['eureka', 'find-bottlenecks', 'hsi', 'whitespace', 'find-connections']` (`ambient-run.cjs:75`). Swap `_eurekaAdapter`'s body (`:184-240`) to `eurekaRecall.buildSubstrate` + `recallCandidates` read-only, return findings with no stamp and a flag that `selectCardFinding` must skip (no background filing for eureka), and put the top-K candidates on `compResult.producers.eureka` for `maybeQuick`. `maybeQuick` today only reads `producers.whitespace` (`research-planner/ambient.cjs:295`) and runs a fetch when a standing grant covers it; the eureka branch must stop at `recordPlanOnly` (no fetch even with a grant, D-03). `hasPendingPlanOnly` allows one unsurfaced plan-only card per room (`:268-279`), so a eureka offer and a whitespace card compete; decide precedence or make the dedupe per template.

### Pattern 9: Canon coverage statement (EPV366-17)
`countGraphIntegrity` returns a flat bag (`graph-integrity-counts.cjs:309-355`); rules: counts only, `null` never `0` when unanswerable, no thresholds, fixed-literal SQL, no adjectives from the banned list (orphan, dangling, ... , low, high), and rule 2: no fix of any kind in this file or its caller. Add `things_with_canon_handle` and `things_without_canon_handle` computed from `USES_FRAMEWORK` edges into `framework`-typed nodes, over a fixed-literal "thing" type set (recommend `('Artifact','claim')`). Return `null` for both when the `nodes` table has no `type` column (schema `unreadable`). The doctor module lists fields at `room-graph-integrity-module.cjs:132-140` and prints prose at `:298`; add the two fields. SENS-19 (`sensor-priority.cjs:214-218`) sums only `edge_rows_missing_endpoint + claim_nodes_no_anchor_new` against 25 (`sensor-graph-integrity.cjs:76,101-103`); coverage should not enter that sum. "With a watched_by entry": the watched_by field is per sensor; amend SENS-19's `watched_by` string to name the coverage count, then run `node scripts/build-connector-registry.cjs --check` (its `sensorPriorityCompletenessErrors` gate reads these records).
Measured baseline for the planner (read-only, this session): 1071 Artifact nodes across 31 rooms; 56 resolve by the exact rule (2 via frontmatter `framework:`, 53 via `methodology:` through `command-registry.json`, 1 via title), about 5.2%.

### Pattern 10: Gated per-term Theo release and the translation table (EPV366-18, -19)
- Resolver order: `framework` -> `methodology` (through `command-registry.json`) -> `title` (`verification-stamp.cjs:291-315`). Add a `translations` member to its `ctx` (a Map term -> canon_name read from `<room>/references/canon-translations.md`), consulted after the three exact checks; a translated hit returns `via: 'translation'`. Keep `names.has(canon_name)` as a guard so a stale row never yields a non-canon name.
- File shape (D-14): YAML rows `{term, canon_name, ratified_at}`. A proposed row needs a distinguishable state; recommend `ratified_at: null` for proposed and an ISO date when the navigator confirms, with the resolver reading only ratified rows. `references/` is in `eureka-recall.cjs PRODUCT_SECTIONS` (`:125`), so the file is never a recall candidate.
- The audit ledger (`audit-ledger.cjs:19-24`) has a CLOSED key set; `validateRecord` refuses missing or extra keys. A Theo release row fits the existing keys with `provider: 'theo'`, `family: 'canon-term/v1'`, `template_id: 'canon-translation'`, `q: <released term>`, `grant_id` from the release gate decision. Do not add keys.
- The gate: mint a single-use `material_step` gate through `gate-ledger` and render it with `gate-render.renderGate` (the `mintApprovalGate` shape in `research.cjs:140-200`); the resumeFn performs the call and writes the proposed row.
- Which Theo tool: brain-client exposes `normalize_framework_name` (`brain-client.cjs:2058-2063`), which Theo implements as exact match plus an `ALIAS_OF` walk and explicitly NOT a spell-checker (`/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts`); there is no Theo "nearest name" op. A fulltext path exists (`brain_search` / `framework_search` index) behind `_typedFreeformGate`. See Open Question 3.

### Pattern 11: Doctor `--fix` backfill (EPV366-20)
Register a new module in `data/doctor-modules.json` with `cadence: 'always'`, `fix_supported: true`, a runner exporting `check(ctx)` and `fix(ctx)` (contract parity rules 5 and 8, `tests/test-doctor-module-contract-parity.cjs:72-107`). Do not put it in `room-graph-integrity-module.cjs` (check-only by its own header rule). Walk the registry with `readRegistry` from `lib/core/doctor/shared.cjs`, per-room try/catch (T-233-01 pattern from `graph-derive-heal-retrofit-module.cjs`). Idempotence is native: `insertNode(..., {on_conflict:'nothing'})` and `writeEdge`'s `ON CONFLICT(source, target, type)` upsert. Mint the framework node BEFORE the edge in the same transaction (Pitfall 7). Also mint nodes for any existing `framework:*` edge targets with no node row.

### Pattern 12: The egress policy file (EPV366-22, discretion)
No `_config/` convention exists in this repo (grep found none). Recommend a plugin-shipped default `data/egress-policy.json` with one line per egress from design section 6 (`vector_model_download`, `judge_jev`, `research`, `citation_check`, `prose`, `theo`, `entity_extraction`), each `{endpoint, default, scope}`, and an optional room override at `<room>/.mindrian/egress-policy.json`; the audit ledger refuses a write for a line that is false; `--offline` forces all false. Mark the path choice for navigator confirmation.

### Pattern 13: The spike harness (EPV366-23)
1. Copy each fixture room into `fs.mkdtempSync` (never run in place: `tests/fixtures/355-rooms/README.md`), index it (`lazygraph-ops` rebuild) and run entity extraction so DESCRIBES edges exist. Note the shared-entity lane depends on `scripts/entity-extract.cjs`, whose tier-2a classifier is the local embedding classifier and which may escalate to Haiku; run it with `--offline` and record which tiers ran (Pitfall 10).
2. Run each recall arm (graph+lexical; graph+lexical+vector) with a fixed tag; write `candidates.jsonl`.
3. Convert candidates into the 355 items shape `{pair_id, room, producer, a_excerpt, b_excerpt, direction_phrase, a_path, b_path}` (keys of `pairings.items.json`); reuse `buildExcerpt`, `pairId`, `directionPhraseFor` from `measure-355-hit-rate.cjs:142-167`. `pairings-unstamped` has `requiresPhrase: true` and shows `direction_phrase` (`label-355-gold.cjs:172-179`); use `directionPhraseFor(null)` ("no wording signal measured") for pairs with no measured direction so the direction question stays honest.
4. Label the UNION of candidates per recall arm once (dedupe by `pair_id`); each judge arm's useful rate is then the gold-useful share among the pairs that arm passes. This satisfies "over the SAME candidates file" and avoids four sittings over identical pairs.
5. Judges: Stage A only (`judgeCandidates` with no judgeFn); Jev (`scripts/eureka-jev-judge.cjs`, key at `~/.secrets/typesafe.env`, present on this machine); Claude (a Claude Code subagent on the user's plan writing a verdicts file is enough and needs no key; an API arm would use `claude-routing` role `pair_judge` and `ANTHROPIC_API_KEY`, which is unset on this machine); Claude-then-Jev (Jev over Claude's `useful` subset).
6. The bar (fixed before the run): adopt an arm only if its Wilson 95% lower bound exceeds 0.448. Minimum useful counts computed with the repo's `wilson95`: n=30 needs 19 (63.3%), n=50 needs 30 (60.0%), n=96 needs 53 (55.2%), n=150 needs 80 (53.3%), n=200 needs 104 (52.0%). The 355 baseline itself is [35.2%, 54.7%].
7. Record in a new `tests/fixtures/366-spike/` record file with a `--check` that recomputes it byte for byte (the `measure-355 --check` precedent).

### Anti-Patterns to Avoid
- **A second resolver:** `eureka-recall.canonHandleOf` (`:185-192`) checks `methodology` as a literal canon name, while `resolveEndpoint` maps it through `command-registry.json`. Measured: 53 of the 56 fleet resolutions come through the registry mapping, so the recall copy undercounts. Replace it with `resolveEndpoint`.
- **Raw SQL for framework nodes or edges:** `check-substrate.cjs --diff` blocks it at commit.
- **Renaming ops silently:** 355 D-26.
- **Hand-editing generated files:** `data/connector-registry.json`, `data/mcp-tool-connectors.json`, `data/command-registry.json`, `data/brain-orchestration-projection.json`, `data/harness-manifest.json`, `data/research-shape-ledger.json`, `skills/*/SKILL.md` mirrors.
- **Bands without buckets:** any new floor or band in a perspective must carry a ledger row and a measured bucket or be disclosed (355 D-46).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wilson interval | A new formula | `measure-355-hit-rate.cjs wilson95` (z 1.959963985) | Same number as the 355 record |
| Blind labeling | A new labeler | `label-355-gold.cjs` | Seeded shuffle, fixture hash guard, whitelist display |
| Canon resolution | Fuzzy or second matcher | `verification-stamp.resolveEndpoint` + translations | D-10; Theo also refuses fuzzy |
| Framework node id | A new slug rule | `navigation.FRAMEWORK_NODE_ID` | Same handle `gate_answer` writes today |
| Approval gates | A bespoke prompt | `gate-ledger.mintGate` + `gate-render.renderGate` + `gate_answer` | Part 3 one gate path |
| Query composition | LLM-composed queries | `families.composeForLeaf` + `auditQueryString` | Part 8 fence |
| Model ids | Literal `claude-*` strings | `claude-routing.resolveModelId(role)` | Tripwire test forbids others |
| Opportunity filing | A new writer | `writeOpportunityNode` + `linkOpportunityEvidence` + `writeEdge` | D-04, Part 9 |
| Floor disclosure | Inline magic numbers | `data/floor-ledger.json` + `check-floor-ledger.cjs` | D-19/D-22 of 355 |

**Key insight:** every hard part of this phase already exists once in the repo; the risk is a second copy that drifts.

## Runtime State Inventory

This phase retires a runner and renames ops, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `<room>/.mindrian/eureka/` (status.json, report md/json, ledger) from the runner; `<room>/.mindrian/eureka-perspective/<tag>/` from wave 1; `opportunity` nodes banked by `bankStatements` and ambient `fileStampedOpportunity` (fleet: 26 opportunity nodes); `USES_FRAMEWORK` edges to `framework:*` handles with no node (fleet: 1 edge, 0 framework nodes) | Leave runner outputs in place (read-only history); no migration of opportunity nodes (same writer, same props); the D-16 backfill mints missing framework nodes |
| Live service config | Theo: the plugin reads `list_frameworks` for the snapshot; no Theo-side config names the eureka ops | None for the rename; D-17 adds a Theo stamp read (see Open Question 4) |
| OS-registered state | None: the ambient child is spawned per trigger (`ambient-trigger.cjs`), no OS task names eureka (verified by grep of `scripts/`, `hooks/` for `schtasks`, `launchd`, `systemd`: none reference eureka) | None |
| Secrets/env vars | `TYPESAFE_API_KEY` (dev-time only, `~/.secrets/typesafe.env`); `MINDRIAN_MODEL_PAIR_JUDGE` / `MINDRIAN_EFFORT_PAIR_JUDGE` overrides; `EUREKA_ENTITY_MIN` (`eureka-judge.cjs:52`) | Keep names; document `EUREKA_ENTITY_MIN` as applying to the shared judge or rename with an alias |
| Build artifacts | Skill mirror `skills/eureka/SKILL.md`; generated registries; `data/research-shape-ledger.json` (must be rebuilt by `scripts/build-research-shape-ledger.cjs` when a template is added, as 3ee0f6a31 had to) | Regenerate by script in the same commit |

## Common Pitfalls

### Pitfall 1: The eureka opportunity never reaches the basket
**What goes wrong:** a eureka quick run files nothing even on a supported verdict.
**Why:** `cross_domain_transfer` is not in `pyramid.OPPORTUNITY_KINDS` and has no branch in `opportunityCandidates` (`pyramid.cjs:46-48,691-760`); `normalizeLeaf` drops `candidate` (`:357-380`); `filing.cjs` writes `DERIVED_FROM` only to the run home node and `SUPPORTS` to evidence rows (`filing.cjs:723-776`), with no stamp fields.
**How to avoid:** add the kind and a branch keyed on `eu:mechanism_transfer` leaves with `supports` rows and no `already_known` hit; carry a closed `pair: {a, b, perspective, run_tag}` on the leaf through `normalizeLeaf` and into the plan hash; in filing, write `DERIVED_FROM` to `pair.a` and `pair.b`, and merge `verificationStamp.toNodeProps(stamp)` plus `pws_stage` and `engine_mode` into `extraProps` (the exact merge in `eureka-portfolio-report.cjs:1879-1935`). Move `fileStampedOpportunity`, `_readPwsStage`, `_sourcedFromTarget` out of the runner first; `ambient-run.cjs:573` requires them for every producer.
**Warning signs:** `basketFor` returns no `opportunity:*` items for a eureka run.

### Pitfall 2: Removing a router stub breaks the surface fence
**What goes wrong:** D-06 says the stubs "go away", but `find-bottlenecks` and `find-analogies` are in `GEAR_SHIFT_EXITS` and must be MCP-reachable through `ALL_TOOL_COMMANDS`, pinned at 65 (`tests/test-205-surface-fence.cjs:119-139`).
**How to avoid:** keep the command names in the router enums; change only the response body to point at `research_run` with the right `perspective`. `scout-hsi` keeps its honesty sentence (355 D-23) until the HSI op lands.

### Pitfall 3: Adding a template breaks four pins
Adding `rs`, `hsi`, `analogies`, `connections` templates breaks `tests/test-363-pyramid.cjs` Y1 (exactly seven ids), `tests/test-363-structure.cjs` B3/B4/D6 (seven `template_frameworks`, handle-only params), and `build-research-shape-ledger --check` drift (commits d321d3f2d and 3ee0f6a31 show the exact fix). Each template's `framework` should be an exact canon name where one exists (verified in `framework-names.json` this session: `Reverse Salient Analysis` (find-bottlenecks), `HSI Semantic Surprise Analysis Assistant` (whitespace), `Four Lenses of Innovation` (find-analogies), `Usher's Model of Cumulative Synthesis` (find-connections) all resolve exactly); the eureka template's `Cross-Domain Opportunity Discovery` is recorded as a `theo_gap name_not_found`.

### Pitfall 4: The Part 8 guard and the gated term
D-13 sends a navigator-released ROOM term to Theo. Part 8 in CLAUDE.md is absolute and was not amended; `part8-egress-guard.classify` allows only proven move-set shapes and gates or blocks free-form text. A plain room term will classify ambiguous or content. The plan must define the released term as a typed packet with an explicit release receipt (gate id plus audit row) and either a known-tool-shape proof in the guard for `normalize_framework_name {raw}` with a receipt, or route through the guard's gate verdict. Treat this as a canon-sensitive change: write the reasoning into the plan and get the navigator's yes on the exact shape.

### Pitfall 5: Two resolvers
See Anti-Patterns. Wave-1 `things.jsonl.canon_handle` will change values once it uses `resolveEndpoint`; update `tests/test-seed103-eureka-perspective.cjs` expectations in the same plan.

### Pitfall 6: The lockstep file D-17 names does not exist on purpose
`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 is "the single home of the release lockstep count" and records WD-14 (re-ruled at 349-03): `VERSION-BUMP-CHECKLIST.md` is NOT created. Add the place there and in `.claude/includes/release-process.md`; `tests/test-349-docs-lockstep.cjs` pins that text. `framework-names.json` today carries `snapshot_date` (2026-09-23), `source`, `source_sha256`, but no plugin-version or Theo stamp field, so "the snapshot's Theo stamp lags" needs a new field written by `refresh-framework-names.cjs --live` and a gate shaped like `theo-stamp-gate.sh` (its `MINDRIAN_THEO_STAMP_CMD` seam, `--dry-run` reports without aborting, an audited opt-out flag). Note the inherent limit: a release cannot be stamped against a version not yet cut, which is why theo-stamp-gate is a LAGGING gate.

### Pitfall 7: Edges before nodes inflate SENS-19
`edge_rows_missing_endpoint` counts edges whose target has no node row (`graph-integrity-counts.cjs:198-200`) and SENS-19 fires when that plus new no-anchor claims reaches 25. `writeReasoningNode` already writes `USES_FRAMEWORK` to `framework:<slug>` with no node (`reasoning-write.cjs:193-206`). A backfill that writes edges first would push rooms over the sensor threshold. Mint the node first, same transaction.

### Pitfall 8: Perspective floors are invisible to the floor sweep
`check-floor-ledger.cjs SCAN_FAMILIES` covers `rs-*`, `hsi-*`, `eureka/*`, `eureka-critic`, whitespace scripts (`:48-56`), not `lib/core/research-planner/perspectives/`. Wave 1 already ships undisclosed floors (`lexical_floor: 0.08`, `lexical_top_k: 5`, `max_candidates: 200`, `eureka-recall.cjs:57-63`). Add the glob and ledger rows (status `disclosed`), or the new RS/HSI floors will slip in unrecorded.

### Pitfall 9: The baseline compares a different engine
The 96 baseline pairs are HSI (47) and RS (49) from embedding engines; none came from Eureka. State this in the spike record, compare RS-graph and HSI-graph arms to the RS and HSI slices of the baseline as well as to the pooled 44.8%, and do not claim "Eureka improved from 44.8%".

### Pitfall 10: "No embeddings" depends on a substrate built with embeddings
The shared-entity lane reads DESCRIBES edges, which `scripts/entity-extract.cjs` writes through a local embedding classifier (tier-2a) with an optional Haiku escalation. Recall is offline; its inputs may not have been. The spike must state the substrate build, and the vector-lane arm must not be confused with this.

### Pitfall 11: Shared files with Phases 367 and 368
Phase 367 extends `graph-integrity-counts.cjs` and changes `artifact_file` (SOURCED_FROM to the Artifact node, `source_section`); Phase 368 edits `eureka-command.cjs` and the ambient spawner. Sequence merges or carve disjoint functions; never `git stash` mid-merge (folded todo).

### Pitfall 12: Environment traps
- Hooks and tests need Node 22 (`node:sqlite`); `/usr/bin/node` is v20.19.5 in WSL. The pre-commit hook calls bare `node`; export the nvm v22 bin on PATH before committing.
- The working tree at research time has uncommitted changes to generated registries from another session and is 209 commits ahead of `origin/main`; `release.sh` Step 2.5 refuses a dirty tree.
- `commands/*.md` edits trigger: command-registry, connector-registry, orchestration-projection, skill-mirrors, shape-declaration, help-coverage, command-registration-check, reward-before-investment. `lib/mcp/tools/*.cjs` or `tool-router.cjs` edits trigger `check-tool-honesty.cjs`. `lib/core/*.cjs` edits trigger `check-render-coverage.cjs`. Every commit runs `check-substrate.cjs --diff` and `check-schema-aliases.cjs`.

### Pitfall 13: Jev sends room text
`eureka-jev-judge.cjs` sends `a_excerpt` / `b_excerpt` (room text, capped at 2400 chars) to TypeSafe. The spike-findings skill records "zero room content" for Jev calls and "users never carry a Jev dependency". Restrict the Jev arm to the synthetic fixture copies with a `guardRoomPath`-style containment check.

## Code Examples

### Deprecated alias dispatch in research.cjs
```js
// Source: lib/mcp/tools/research.cjs switch (lines 628-647), extended
case 'perspective_recall':   out = await opPerspectiveRecall(env, i.perspective); break;
case 'perspective_candidates': out = opPerspectiveCandidates(env, i.perspective); break;
case 'perspective_judge':    out = await opPerspectiveJudge(env, i.perspective); break;
case 'eureka_recall':        out = deprecate(await opPerspectiveRecall(env, 'eureka'), 'eureka_recall', 'perspective_recall'); break;
// deprecate(out, legacyOp, newOp) -> Object.assign(out, { op: legacyOp, deprecated: true, use_instead: newOp })
```

### Framework node then edge (idempotent)
```js
// Source: node-insert.cjs:202 insertNode, reasoning-write.cjs:74 FRAMEWORK_NODE_ID, edges.cjs writeEdge
const fid = navigation.FRAMEWORK_NODE_ID(canonName);            // 'framework:<slug>'
insertNode(db, fid, 'framework', JSON.stringify({ name: canonName }),
  { epistemic_type: 'observation', source_path: 'system:canon-framework', on_conflict: 'nothing' });
navigation.writeEdge(db, { source_id: thingId, target_id: fid, edge_type: 'USES_FRAMEWORK',
  properties: { relation: 'uses_framework', framework: fid.slice('framework:'.length), origin: 'canon-backfill' } });
```

### Wilson bar check
```js
// Source: scripts/measure-355-hit-rate.cjs:103 wilson95
const [lo] = wilson95(useful, shown);
const adopted = lo > 0.448;   // bar fixed before the run (D-05)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All-pairs eureka runner, AHP verdict, own filer | Capped local recall lanes + planner + one filer | SEED-103 wave 1 (2026-10-01) | Runner retires after the spike |
| RS/HSI pair divergence from LSA vs 384-dim embeddings | Proposed: graph vs lexical divergence | This phase (D-08) | Needs a new direction-convention variant and re-measurement |
| Hardcoded model ids per caller | `claude-routing.cjs` roles | SEED-103 wave 1 | Any new Claude call uses a role |

**Deprecated/outdated:**
- `eureka_recall` / `eureka_candidates` / `eureka_judge`: deprecated aliases for one release.
- "Report-only, ZERO writes / ZERO network" in `commands/eureka.md`: false since Phase 355 filing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Section-level lag score is the right "lagging component" for graph RS | Pattern 4 | RS arm fails the bar; spike decides |
| A2 | `relational - lexical` maps onto the existing direction meanings | Pattern 5 | Direction agreement drops; keep a separate phrase hash |
| A3 | `data/egress-policy.json` plus room override is acceptable in place of `_config/egress-policy.json` | Pattern 12 | Path rework |
| A4 | Labeling the union of candidates once satisfies "one sitting per arm's candidate file" | Pattern 13 | More sittings |
| A5 | A Claude Code subagent verdict file is an acceptable Claude arm | Pattern 13 | Need an API key and claude-routing |
| A6 | Proposed translation rows use `ratified_at: null` | Pattern 10 | Schema rework |
| A7 | "Thing" for the coverage count is `Artifact` + `claim` | Pattern 9 | Count disagrees with recall's thing set |

## Open Questions (RESOLVED)

All six were settled at plan time (2026-10-01); each RESOLVED line names the plan that carries the
answer. The navigator may overturn any of them at plan review.

1. **What is "the release gate" for test registration?** No phase aggregator (`run-all-355.sh`, `run-all-363.sh`, `run-all-seed103.sh`) is shelled by `scripts/release.sh`, `scripts/verify-release` or `scripts/doctor.cjs --acceptance` (grep this session). Recommendation: `tests/run-all-366.sh` that includes every seed103 leg, plus ask the navigator whether a doctor acceptance point should shell it.
   RESOLVED: `tests/run-all-366.sh` (written in plan 366-01 with every seed103 leg) is shelled by `scripts/release.sh` through `scripts/release-lib/suite-gate.sh`, fail closed, with an audited `--no-suite-check` opt-out (plan 366-06, Task 2; EPV366-01). No doctor acceptance point is added in this phase.
2. **Fold D-17 into RULE 5 place 8 or add place 9?** Place 8 is the Theo coupling; RULE 5 warns against restating the count. Recommendation: add place 9 ("canon snapshot freshness"), since D-17 says "one more lockstep place".
   RESOLVED: RULE 5 gains place 9 "canon snapshot freshness" in docs/RELEASE-CEREMONY-RULING-SYSTEM.md, never VERSION-BUMP-CHECKLIST.md (plan 366-06, Task 2; D-17).
3. **Which Theo call answers "nearest canon name"?** `normalize_framework_name` is exact plus alias walk only; `brain_search` fulltext exists behind a freeform gate. Recommendation: `normalize_framework_name` first, then a top-1 fulltext suggestion presented as proposed; consult Theo (`/home/jsagi/Theo`) on whether a Theo-side `suggest_framework_name` op belongs to the Theo companion work.
   RESOLVED: `normalize_framework_name` only, per term, behind a navigator yes on an F.8 card and an audited row; no `brain_search` / fulltext suggestion (plan 366-11, D-13; its acceptance greps `brain_search` to 0). The intent-led nearest-name resolver is filed as a Theo-side request (plan 366-24, Task 3; D-13 c).
4. **Where does the snapshot's Theo stamp come from?** `list_frameworks` rows carry no version. Options: the snapshot records the plugin version it was refreshed for plus Theo's `command_neighborhood` `mappedBy`; the gate compares to the current version.
   RESOLVED: `data/framework-names.json` carries `theo_stamp { mapped_by, plugin_version, refreshed_at }`, written only by `refresh-framework-names.cjs --live`; `scripts/release-lib/canon-snapshot-gate.sh` refuses a cut when `theo_stamp.mapped_by` is absent or differs from the current plugin version (LAGGING, like place 8) (plan 366-06, Task 1; D-17).
5. **Eureka offer vs whitespace card precedence in ambient** (`hasPendingPlanOnly`).
   RESOLVED: one pending plan-only card per room stays the rule (`hasPendingPlanOnly` unchanged); within one ambient pass the whitespace card goes first, and the eureka offer is recorded as a plan-only card only when that pass produced no whitespace card; never a fetch (plan 366-07, Task 2; D-03).
6. **Does SENS-13 still fire?** The eureka producer stops filing, so its SENS-13 side channel stops for eureka; the other producers still file through the relocated `fileStampedOpportunity`. Close the F7 todo with that finding.
   RESOLVED: yes for every producer except eureka. The eureka producer becomes offer-only and stops filing (so it no longer feeds SENS-13); the other producers file through the relocated `filing-stamped.cjs` `fileStampedOpportunity` and still feed SENS-13 (plan 366-07, finding recorded in its SUMMARY; plan 366-02 relocates the filer). The F7 todo is closed with that finding by plan 366-24, Task 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (nvm) | all tests, hooks | yes | v22.23.1 | none; `/usr/bin/node` v20.19.5 must not be used |
| python3 | `compute-whitespace-gaps.py` legs | yes | `/usr/bin/python3` | - |
| sqlite3 CLI | none required | no | - | `node:sqlite` |
| TypeSafe key | Jev spike arm | yes (file present, value not read) | - | Stage A only arm |
| ANTHROPIC_API_KEY | API Claude arm | no (unset) | - | Claude Code subagent arm |
| Theo key / reach | D-13, D-17 live paths | not probed (no network in research) | - | Hermetic seams (`MINDRIAN_THEO_STAMP_CMD`, injected `callTool`) |

**Missing dependencies with no fallback:** none for hermetic work. Live Theo reads need a reachable Theo at release time.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with `tests/helpers/hygiene-355.cjs makeChecker`; exit 0 pass, 77 env gap |
| Config file | none; aggregator `tests/run-all-366.sh` (Wave 0) modeled on `run-all-seed103.sh` |
| Quick run command | `wsl -e bash -c 'export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH; cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-366-<name>.cjs'` |
| Full suite command | `... && bash tests/run-all-366.sh` |

Every new test: set `MINDRIAN_ROOMS_HOME` to a mkdtemp BEFORE requiring repo modules, scrub vendor keys, install the net guard, assert zero attempts last, build room.db with `insertNode` (the seed103 pattern), never touch a live room.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EPV366-01 | seed103 legs inside the 366 aggregator | aggregator | `bash tests/run-all-366.sh` | no, Wave 0 |
| EPV366-02 | every registered perspective exports the interface; eureka outputs byte-stable | unit | `node tests/test-366-perspective-interface.cjs` | no |
| EPV366-03 | new ops parse; aliases return legacy op name + deprecation; 45 tools; budget; floor | integration | `node tests/test-366-mcp-perspective-ops.cjs`; `node tests/test-270-tool-schema-budget.cjs`; `node tests/test-234-tool-description-floor.cjs`; `node tests/test-363-mcp-tool.cjs` | partial |
| EPV366-04 | CLI refuses free text; enum enforced; aliases work | unit | `node tests/test-366-cli-perspective.cjs` | no |
| EPV366-05/06/07/08/09 | each recall on a planted fixture finds the planted pair, excludes known pairs, caps | unit | `node tests/test-366-recall-<id>.cjs` | no |
| EPV366-10 | zero sockets across six recalls | unit | `node tests/test-366-offline-recall.cjs` | no |
| EPV366-11 | stubs point at research_run; 65 pin; gear-shift exits reachable | unit | `node tests/test-205-surface-fence.cjs`; `node tests/test-366-router-redirects.cjs` | partial |
| EPV366-12 | supported eureka verdict yields basket item; filing writes node, two DERIVED_FROM, stamp props; ambient filer still works | integration | `node tests/test-366-eureka-filing.cjs`; `node tests/test-3551-ambient-run.cjs` | partial |
| EPV366-13 | alias path, legacy flag, no stale wording | static + unit | `node tests/test-366-eureka-alias.cjs`; `node scripts/build-skill-mirrors.cjs --check` | no |
| EPV366-14 | eureka adapter returns offer, no stamp, no filing; maybeQuick no fetch | unit | `node tests/test-366-ambient-offer.cjs` | no |
| EPV366-15/16/19 | resolver order incl. translations; node before edge; idempotent | unit | `node tests/test-366-canon-handles.cjs` | no |
| EPV366-17 | coverage fields; null on unreadable schema; banned-word check | unit | `node tests/test-366-canon-coverage-count.cjs`; existing 343 organ tests | no |
| EPV366-18 | no call without gate yes; audit row closed shape; proposed row written; guard verdict | unit (injected callTool) | `node tests/test-366-gated-term-release.cjs` | no |
| EPV366-20 | fix twice = same counts; parity rules | unit | `node tests/test-366-canon-backfill.cjs`; `node tests/test-doctor-module-contract-parity.cjs` | partial |
| EPV366-21 | lagging snapshot refuses; dry-run reports; opt-out audited; docs pin | unit (seam) | `node tests/test-366-snapshot-gate.cjs`; `node tests/test-349-docs-lockstep.cjs` | partial |
| EPV366-22 | offline forces all lines false; run completes Stage A only | unit | `node tests/test-366-egress-policy.cjs` | no |
| EPV366-23/24 | items conversion matches 355 shape; record `--check` recomputes | unit + manual sitting | `node tests/test-366-spike-harness.cjs`; navigator sitting is manual-only | no |
| EPV366-25 | after deletion no require of the runner remains; aggregators green | static | `node tests/test-366-runner-retired.cjs` | no |
| EPV366-26/27 | counter-metric declarations present; floor sweep covers perspectives | static | `node tests/test-355-floor-sweep.cjs`; `node scripts/check-floor-ledger.cjs` | partial |
| all | generators current, no em-dash | static | `node scripts/build-connector-registry.cjs --check`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-shape-declaration.cjs --check`; `node scripts/build-research-shape-ledger.cjs --check`; `node scripts/check-registry-drift.cjs` | yes |

### Sampling Rate
- **Per task commit:** the touched test plus `test-270`, `test-234`, `test-205`, `test-353-tripwires`.
- **Per wave merge:** `bash tests/run-all-366.sh` and `bash tests/run-all-363.sh`.
- **Phase gate:** run-all-366, run-all-363, run-all-355, run-all-seed103 green before `/gsd:verify-work`; the spike record `--check` green.

### Wave 0 Gaps
- [ ] `tests/run-all-366.sh` (run / run_if / em-dash leg, includes seed103 legs)
- [ ] A shared fixture builder for a two-to-four-section room.db with planted pairs per perspective
- [ ] `tests/fixtures/366-spike/` layout and the items converter

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | yes | gate ids bound to session via `gate-ledger.ledgerSessionKey`; basket approvals single-use (`research.cjs:451-470`) |
| V4 Access Control | yes | `resolveRoom` refuses unbound or mismatched rooms (`research.cjs:106-118`) |
| V5 Input Validation | yes | zod at the MCP edge; argv validator at the CLI; perspective enum |
| V6 Cryptography | no | content hashes only (`node:crypto`) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Room text egress to Brain via the term release | Information disclosure | Gate yes + audit row + Part 8 guard; only released term, never surrounding text |
| Spoofed approval to file | Spoofing | Single-use, session-scoped gate ids; a bare flag is never authority |
| Path traversal in translation file or spike paths | Tampering | Realpath containment (`resolveAndContain`, `guardRoomPath`) |
| Key in audit ledger | Information disclosure | `looksLikeKey` refusal (`audit-ledger.cjs:35-41`) |
| Runaway background compute | Denial of service | Recall caps; Phase 368 owns spawner guards |

## Sources

### Primary (HIGH confidence, read this session)
- `lib/core/research-planner/perspectives/eureka-recall.cjs`, `eureka-judge.cjs`; `lib/mcp/tools/research.cjs`; `scripts/research-planner.cjs`
- `lib/core/research-planner/question-templates.cjs`, `families.cjs`, `pyramid.cjs`, `filing.cjs`, `ambient.cjs`, `audit-ledger.cjs`, `CONTEXT.md`
- `lib/core/ambient-run.cjs`, `scripts/eureka-portfolio-report.cjs` (1800-1960), `scripts/eureka-command.cjs`, `lib/mcp/tool-router.cjs` (350-380, 1480-1620)
- `lib/core/verification-stamp.cjs`, `lib/core/navigation/edges.cjs`, `reasoning-write.cjs`, `typed-opportunity.cjs`, `graph-integrity-counts.cjs`, `lib/core/node-insert.cjs`, `lib/core/lazygraph-ops.cjs`, `lib/mcp/tools/views.cjs`
- `lib/core/sensors/sensor-priority.cjs`, `sensor-graph-integrity.cjs`, `lib/core/doctor/*`, `data/doctor-modules.json`, `tests/test-doctor-module-contract-parity.cjs`
- `lib/core/direction-convention.cjs`, `data/floor-ledger.json`, `scripts/check-floor-ledger.cjs`
- `scripts/label-355-gold.cjs`, `scripts/measure-355-hit-rate.cjs`, `tests/fixtures/355-rooms/*`
- `tests/test-270-*`, `test-234-*`, `test-205-*`, `test-353-tripwires.cjs`, `test-seed103-*`, `run-all-seed103.sh` (run green)
- `scripts/release.sh`, `scripts/release-lib/theo-stamp-gate.sh`, `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`, `scripts/refresh-framework-names.cjs`, `.git/hooks/pre-commit`
- `lib/core/part8-egress-guard.cjs`, `lib/core/brain-client.cjs`, `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts`
- Read-only censuses of 31 rooms under `/home/jsagi/MindrianRooms` (edge and node types; canon coverage)

### Secondary
- `.planning/REVIEWS/2026-10-01-eureka-v2-design.md`, `2026-10-01-eureka-architecture-review.md`, SEED-103, `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md`

### Tertiary (LOW)
- Graph RS and HSI formulas (Patterns 4 and 5) are proposals, unmeasured.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all in-repo, read directly
- Architecture: HIGH for the op/filing/Theo-readiness wiring; MEDIUM for the new recall math
- Pitfalls: HIGH - each tied to a file:line or a measured count

**Research date:** 2026-10-01
**Valid until:** 2026-10-15 (fast-moving: Phases 367 and 368 touch shared files)
