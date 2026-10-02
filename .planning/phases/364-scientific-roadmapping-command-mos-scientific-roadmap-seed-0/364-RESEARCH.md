# Phase 364: Scientific Roadmapping command /mos:scientific-roadmap (SEED-098) - Research

**Researched:** 2026-10-02
**Domain:** Plugin-internal surface wiring (born-wired methodology command), the Phase 363 research-planner engine, the guarded Theo read path, cross-repo registry sync to Theo
**Confidence:** HIGH for wiring, gates and Theo facts (all measured on disk or live this session); MEDIUM for the door's module split and Stage B shape (recommendations, not precedent)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Locked (SEED-098 NR-1..NR-3, 2026-09-27)
- NR-1: find-bottlenecks, dominant-designs, explore-futures are BOUND as inputs (read their filed
  artifacts through navigation.cjs, or offer to run them at their own gate), never re-implemented.
  find_bottlenecks `not_scored` maps to `not_ready`, never `unreachable` (Theo 20.2).
- NR-2: enterable mid-journey from LOCAL room state through `lib/core/navigation.cjs`; entry resolver
  proposes an entry step at an F.1 entry gate (navigator may override to step 1); skipped steps
  recorded `not_run` with the stand-in artifact; never collides with explore-opportunity.
- NR-3: consistent with Theo's Scientific Roadmapping FEEDS_INTO/COMPLEMENTS Hypothesis-Driven
  Problem Solving edges; the plugin does not assert them, Theo Phase 25 verifies them.

#### Rooting (navigator ruling 2026-10-01)
- Primary rooting: Well-Defined with solution criteria known and the HOW unknown; secondary bridge
  from Ill-Defined innovation of meaning (meaning produces the WHAT).
- Entry check: the room has a needs or solution-criteria statement (what to deliver). If not, route
  back to define it first; never improvise the WHAT.
- Step 3 names the rung/output type; the filed plan names its rung.

#### Entry points (navigator requirement 2)
- Direct `/mos:scientific-roadmap`, `--from-hypothesis`, researcher persona (role_blend researcher),
  /mos:ignite Researcher or Door 3 Hypothesis (hypothesis_text as goal seed).

#### Systems layer (requirement 3)
- A Systems Thinking pass (bind /mos:systems-thinking or /mos:analyze-systems, ch06) BEFORE Path
  Enumeration and Constraint Interrogation; bound, not duplicated.

#### Hypothesis link (requirement 4)
- Stage B turns each ranked bottleneck into a falsifiable hypothesis (Hypothesis-Driven Problem
  Solving); HDPS steps 2 and 3 handed to /mos:research on the 363 engine; a refuted bottleneck drops.

#### Theo contract (25-PLUGIN-CONTRACT)
- Walk steps from framework_step in list order; never sort by sourceOrder; never write step text from
  memory; skip DEFINITION and ASIDE; a null label or runIt is refused honestly: "Theo has not authored
  this step yet". (Live 2026-10-02: all 7 steps return NULL label/runIt; the command must ship and
  behave correctly in that state.)
- Stage A: the 7 steps, a human gate each, claims filed as proposed.
- Output: room/research-plan/PLAN.md filed through the 363 F.8 basket; plan names its rung and steps run.
- No second engine: a door on the 363 `scientific-roadmapping` template; plans handed to /mos:research.
- Canon Part 8: only generic handles reach Theo, through the guarded mindrian-brain shim. Theo decides
  nothing. No skill writes canon.
- Thin coverage stated out loud: a thin recommend_chain / problem-type answer says "uncovered", never
  reads as a fit verdict (SEED-106 item 3). Business-terminated chains are never accepted as the spine
  (SEED-106 item 1). Scientific-method rubric (falsifiability, controls, priors, mechanism vs property)
  carried as a PLUGIN-SIDE labelled rubric until Theo ingests it (SEED-106 item 2).

#### Shape and registration (navigator 2026-10-02: "shape it properly", "registered on the command line")
- Frontmatter: kind methodology, autonomous_safe false, reach context_block, frameworks
  [Scientific Roadmapping, Hypothesis-Driven Problem Solving], produces room/research-plan/*,
  declared hitl_stages (entry F.1, per-step gates, F.8 filing basket) with hitl_why, canon_parts.
- Wired via /mos:new-surface then the registry sync (data/command-registry.json, recipe-maps,
  connector registry), never a hand MERGE. Born-wired, shape-declaration, projection and render gates
  pass (`build-connector-registry --check`, `check-shape-declaration`, `build-orchestration-projection
  --check`, `check-render-coverage`).
- CLI: the command resolves and runs as `/mos:scientific-roadmap`; Desktop/Cowork: reachable through
  the MCP methodology surface where the registry exposes it (Tri-Polar).

#### Theo awareness (navigator 2026-10-02: "make Theo aware", "Theo knows about it")
- Plugin side owns: the command-registry row Theo's registry sync reads, a handoff note to Theo
  (Theo Phase 25 part 3) naming the slug, frameworks and release in which it ships, and an entry in
  25-PLUGIN-CONTRACT's handoff log via the Theo session (cross-repo, messaged, not written from here).
- Theo-side USES_FRAMEWORK edge lands only after a plugin release carrying the command.

### Claude's Discretion
(open items from 364-INPUT, resolved with defaults)
- Slug: `/mos:scientific-roadmap` (already used by Theo Phase 25 and 25-PLUGIN-CONTRACT; `/mos:roadmap`
  rejected as colliding with GSD roadmap vocabulary).
- Two-framework registry storage: one primary framework (Scientific Roadmapping) plus a recipe edge
  to Hypothesis-Driven Problem Solving, following whatever the registry already does for any existing
  multi-framework command (planner to check and mirror; if none exists, primary + recipe edge).
- hierarchy_rank: read from connector-registry.json conventions for methodology commands of the same
  family (research/methodology); planner picks and states it.
- find-analogies as an optional NEXT_IN_RECIPE: include as optional, not required.

### Deferred Ideas (OUT OF SCOPE)
- Theo Phase 25 (Theo repo): sr-v1 provenance audit, authoring the 7 steps, problem-type / Systems
  Thinking / HDPS edges, the human-run canon write, and the USES_FRAMEWORK edge after release.
- Plugin release cut carrying the command (release.sh lockstep), then Theo sync.
- Theo ingest of scientific-method content (SEED-106 item 2).

### Peer coordination update (coordinator relay, 2026-10-02, supersedes the CONTEXT peer note)
jsagi-be is DONE with `lib/core/research-planner/*`, `lib/mcp/tools/research.cjs`, `views.cjs` and
`tool-router.cjs`; edits there are allowed now (no ownership constraint). Reuse the perspective shape in
`lib/core/research-planner/perspectives/` (registry in `index.cjs`). semantic-index modules moved to
`lib/core/semantic-index/` in 366-23; require from there.
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed family SRM364)

No IDs were minted yet. Proposed: one row per verifiable behaviour. The planner mints them into
`.planning/REQUIREMENTS.md` under `### Phase 364 - Scientific Roadmapping command (SRM364 family)`.

| ID | Description | Research Support |
|----|-------------|------------------|
| SRM364-01 | Canon snapshot carries `Scientific Roadmapping`: `data/framework-names.json` refreshed through `node scripts/refresh-framework-names.cjs --live` (writes `theo_stamp`), so the registry builders resolve the framework and the Part 8 guard classifies `framework_step({framework:"Scientific Roadmapping"})` as `known_tool_shape` allow, not `ambiguous` | Finding F1, Pitfall 1 |
| SRM364-02 | `commands/scientific-roadmap.md` exists, emitted by `scripts/build-new-surface.cjs` (11-key connector block) and then hand-completed with the rest of the frontmatter (kind methodology, autonomous_safe false, frameworks [Scientific Roadmapping, Hypothesis-Driven Problem Solving], produces `room/research-plan/*`, hitl_stages + hitl_why, layer, body_shape, serves_jtbd, teaching, help_jtbd, interactive_first_reward, allowed-tools with AskUserQuestion) plus the firing block | Findings F2, F3, F5 |
| SRM364-03 | Every generated artifact is regenerated by its builder and green under `--check` (command-registry, connector-registry, harness-manifest, orchestration projection, render-coverage registry, skill mirrors); no hand MERGE of any generated JSON | Finding F2 |
| SRM364-04 | Registry reciprocity: `framework_index["Scientific Roadmapping"]` and `framework_index["Hypothesis-Driven Problem Solving"]` both name `/mos:scientific-roadmap`; `commandsForFramework("Hypothesis-Driven Problem Solving")[0]` stays `/mos:research`; `recipe-maps.postureForCommand('/mos:scientific-roadmap')` returns halt; `wiringForReach('context_block')` includes it | Findings F2, F6 |
| SRM364-05 | `curated_chains` (hand-maintained block of `data/command-registry.json`) carries `command:/mos:scientific-roadmap` FEEDS_INTO `command:/mos:research`; find-analogies is an optional lower-confidence chain, not a NAMED_RECIPE | Finding F6, Pitfall 4 |
| SRM364-06 | The Theo step reader walks `framework_step` rows in returned list order, skips DEFINITION and ASIDE, refuses a runnable step with null label or runIt with the exact text "Theo has not authored this step yet", never sorts by sourceOrder, never falls back to the shipped ledger, the local template or model memory, and sends only `{framework: "Scientific Roadmapping"}` | Finding F4 |
| SRM364-07 | All-NULL live state (fixture of the measured 2026-10-02 payload) yields an honest refusal end to end (CLI script and MCP methodology output); an authored fixture walks all seven steps | Finding F4 |
| SRM364-08 | Entry check: no needs or solution-criteria statement in the room means route back to define the WHAT (never improvise it); the rung is read silently and the plan names it | Finding F7 |
| SRM364-09 | Entry resolver maps room state to a proposed entry step per the SEED-098 table, records skipped steps as `not_run` with the stand-in artifact, discloses `context_insufficient`, reads through `navigation.openRoomDbReadOnlyForCaller` only, writes nothing, never advances an opportunity stage, and offers explore-opportunity alongside when both apply | Finding F7 |
| SRM364-10 | Bound inputs (NR-1): filed reverse-salients, dominant-designs, futures and systems artifacts are read as inputs; the bound command is offered at its own gate when absent; none of their logic is re-implemented | Findings F7, F8 |
| SRM364-11 | `not_scored` maps to `not_ready` (never `unreachable`) through a new mapper in `lib/core/refusal-messaging.cjs`, RED leg first; REFUSAL_KINDS stays six | Finding F8 |
| SRM364-12 | The systems pass precedes Path Enumeration and Constraint Interrogation (enforced by the door's stage order, not by prose) | Finding F5 |
| SRM364-13 | Engine door: the question set rides template `scientific-roadmapping` (whose `doors` gains `/mos:scientific-roadmap`), binds `describeEngine().api_version === '1'` (fail closed on mismatch), plans through `planner.buildPlan`; no second engine, ledger, fetcher, cache or approval ledger (static scan) | Finding F9 |
| SRM364-14 | Stage B: each ranked assumed limiter becomes a falsifiable hypothesis leaf (claim, why it unlocks, refutation test, evidence tier) handed to `/mos:research` (F.6 plan review); a refuted limiter drops in the ranking through the existing ratchet | Finding F9 |
| SRM364-15 | Filing: `research-plan/PLAN.md` is written only on an approved F.8 selection; it names its rung and every step run or `not_run`; every claim lands `proposed`; discarded routes land as `REJECTED_BECAUSE` | Finding F10 |
| SRM364-16 | Part 8: static and runtime proof that only generic handles reach Theo, through `lib/core/brain-client.cjs` (guarded), never raw theo tools; net guard counter zero in offline tests | Findings F1, F4 |
| SRM364-17 | Tri-polar: MCP `methodology` enum carries `scientific-roadmap` (the four 65-pins move to 66 deliberately); its handler returns the command reference plus the Theo step status; Desktop runs the gates via gate_render/gate_answer and plans via research_run op plan | Finding F3 |
| SRM364-18 | Entry points: `--from-hypothesis`, ignite Researcher and Door 3 offer lines, researcher persona; Larry's natural-language trigger in the skill mirror | Finding F7 |
| SRM364-19 | Plugin-side scientific-method rubric (falsifiability, controls, priors, mechanism vs property) labelled as plugin content; a thin Theo coverage answer reads "uncovered" | Finding F11 |
| SRM364-20 | Theo handoff: a tracked `docs/2026-10-0X-PHASE-364-THEO-NOTIFY.md` naming slug, frameworks, curated chain, the alias-table row Theo must add, and the release; an OPEN-HANDOFFS row; a message to the Theo session. Zero writes to `/home/jsagi/Theo` | Finding F12 |
| SRM364-21 | Phase close: `tests/run-all-364.sh` green, CANON-PHASE-MAP row, research trail filed in both homes | Validation Architecture |
</phase_requirements>

## Summary

Everything this command needs already exists except three things: a way for the registry and the Part 8
guard to even recognize the name "Scientific Roadmapping", a small door module that reads Theo's steps
and the room's state, and the command file itself. The 363 engine (`perspective.cjs`,
`question-templates.cjs`, `planner.cjs`, `filing.cjs`) already models the seven operations, the
two-column limiter table, the catalytic ranking and the ratchet. This phase is wiring plus a thin door,
not a new engine.

The single most important finding: **"Scientific Roadmapping" is not in `data/framework-names.json`**
(snapshot dated 2026-09-23 via Theo `list_frameworks`; the sr-v1 batch landed 2026-09-24). Three things
fail closed on that today, measured: `build-command-registry.cjs` refuses the frontmatter
(`Unresolvable frameworks`), `build-connector-registry.cjs` refuses it the same way, and the Part 8
guard classifies `framework_step({framework:"Scientific Roadmapping"})` as `ambiguous` (live call this
session returned `egress_disclosure.verdict: ambiguous, disposition: proceeded`). The sanctioned fix is
`node scripts/refresh-framework-names.cjs --live` (the RULE 5 place 9 path that also writes the
`theo_stamp` the release gate needs). This is Wave 0 and needs network plus a human look at the
`stale_review` diff.

The second key finding concerns Theo awareness. Theo's sync (`/home/jsagi/Theo/scripts/build-command-layer.ts`)
reads exactly three plugin files: `data/command-registry.json`, `lib/core/recipe-maps.cjs` and
`data/connector-registry.json`. It derives USES_FRAMEWORK from `framework_index` (reciprocity enforced)
and from `connectors[].framework`, resolving every framework name through its own reviewed alias table
`.theo-graph/command-alias-table.yaml`, which has Hypothesis-Driven Problem Solving (line 343) but **no
Scientific Roadmapping row**. So after release, Theo will emit USES_FRAMEWORK to HDPS immediately and
will record a fail-closed `framework_unresolved` gap for Scientific Roadmapping until Theo Phase 25 adds
that alias row. Theo also hard-codes `EXPECTED_RECIPE_COUNT = 5` (line 303) and throws if
`recipe-maps.cjs` gains a recipe, so this phase must NOT add a NAMED_RECIPE. The plugin's release
(`scripts/release.sh` Step 5.6, THEO-NOTIFY) already dispatches the registry hash to Theo automatically.

**Primary recommendation:** Wave 0 refreshes the canon snapshot and lands RED tests; Wave 1 builds three
new door modules under `lib/core/research-planner/` (Theo step reader, entry resolver, door/basket) plus
a CLI script; Wave 2 emits the command through `/mos:new-surface`, completes its frontmatter, regenerates
every registry and wires the MCP enum; Wave 3 writes the Theo handoff doc and closes. Do not register
SR as a seventh recall perspective (reasons in Finding F9).

## Project Constraints (from CLAUDE.md)

- Work only from `/home/jsagi/dev/MindrianOS-Plugin/`; never the plugin cache. Read version with `node lib/core/repo-version.cjs` (measured `2.0.0-beta.56`).
- CJS only in `lib/core/*.cjs` per CLAUDE.md; process.argv switch routing for CLIs; no Commander/yargs. (Memory note says TS is now allowed plugin-wide via SEED-107; this phase has no reason to use it, and CLAUDE.md still says CJS, so stay CJS.)
- No em-dashes anywhere; hyphens only. Feynman-simplified, JTBD-oriented prose in the command body.
- Canon Part 8: only generic handles cross to Theo, and only through `lib/core/brain-client.cjs` / the guarded `mindrian-brain` shim; never `mcp__theo__*` for room-content work. Read-only in `/home/jsagi/Theo`.
- Canon Part 3: the material gate (ranking ratification) is a Tri-Context APPROVE / REJECT (reason) / DEFER, Shape F.
- Canon Part 7: reuse before build; justify the new surface against commands/, agents/, pipelines/, skills/.
- Canon Part 9: every truth claim lands `proposed`; only a human confirms.
- Canon Part 11: born WIRED (connector registry) AND born with a declared HITL shape (`hitl_stages` + `hitl_why`); `scripts/check-shape-declaration.cjs` is advisory WARN but must not gain a new WARN for this surface. Every PLAN touching commands/, skills/ or agents/ carries a `cirs_relationship:` block and `11` in `canon_parts` (`scripts/check-cirs-declaration.cjs --check <plan>`).
- Canon Part 12: Larry turns wear a De Stijl mark; withhold grades and praise.
- Tri-Polar: CLI, Desktop, Cowork; any skip stated, not silent.
- Verification: `bash tests/run-all-364.sh`, `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `doctor --acceptance`.
- GSD owns all dev work; `.planning/phases/**` files are force-tracked (`git add -f`), commit with `--only`; two-session collision protocol (never revert unowned diffs).
- Dev-research compositing: file the research trail in `~/MindrianRooms/rethinking-mindrianos/research/` and mirror to `~/MindrianRooms/mindrianOS/research/` at close.
- Grounding sources: Theo is a standing consult (read-only); Context7 not needed (no external library).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read Theo step content (framework_step) | Plugin core (`lib/core/research-planner/sr-steps.cjs`, new) via `brain-client.callTool` | Theo backend (remote MCP) | Theo owns content; the plugin only reads with a generic handle through the guarded client |
| Honest refusal on null steps | Plugin core (same module) | Command body / MCP handler render it | The refusal is a typed result; surfaces only render it |
| Entry check + entry resolver | Plugin core (`sr-entry.cjs`, new), read-only via `navigation.openRoomDbReadOnlyForCaller` + `ambient-framing.resolveRoomRung` | Room storage (room.db, room files) | Room state is LOCAL; navigation.cjs is the single SQL chokepoint |
| Perspective, ranking, ratchet, plan object | 363 engine (`perspective.cjs`, `planner.cjs`, `question-templates.cjs`) | - | D-18 reuse contract: no second engine |
| Question-set assembly, Stage B hypotheses, plan basket, PLAN.md render | Plugin core (`sr-door.cjs`, new) | 363 `filing.basketCard` / `checkAuthority` shape | A door contributes questions and a lens; the engine plans |
| Running research (fetch, evidence rows) | `/mos:research` (`scripts/research-planner.cjs`, `research_run` MCP) | - | The one governed runner (D-14) |
| Writing room artifacts and graph edges | `navigation.cjs` writers + `semantic-index/research-filing.cjs` | Room storage | One door into the room |
| Gate rendering | CLI: AskUserQuestion via firing block; Desktop/Cowork: `gate_render` / `gate_answer` | `lib/mcp/gate-ledger.cjs` | Existing Shape F seam |
| Command discovery | Registries (generated) | MCP `methodology` router enum (hand-listed) | Generated JSON is the truth; the MCP enum is the one hand-listed join |
| Theo awareness | Plugin registries + release Step 5.6 dispatch | Theo sync (Theo repo, Theo Phase 25) | Plugin emits; Theo reviews and writes canon |

## Standard Stack

No external packages. Everything is in-repo.

### Core (reuse by require)
| Module | Version / pin | Purpose | Why |
|--------|---------------|---------|-----|
| `lib/core/research-planner/perspective.cjs` | `describeEngine().api_version === '1'` (line 63, 273-283) | buildPerspective, rankByUnlock, nextBindingConstraint, loadSettled, nextVersion | The D-18 engine, SEED-098 reuse contract |
| `lib/core/research-planner/question-templates.cjs` | template `scientific-roadmapping` (lines 226-276) | dimensions `sr:*`, `validateQuestionSet` (line 509) | The question-set contract `mos.research-question-set/1` |
| `lib/core/research-planner/planner.cjs` | `buildPlan` (line 294), `cardFor` (459), `loadPlan` (115) | Plan building, F.6 card, status | The one planner |
| `lib/core/research-planner/filing.cjs` | `basketCard` (293), `checkAuthority` (456) | F.8 card shape, approval authority | Same basket semantics for plan filing |
| `lib/core/brain-client.cjs` | `callTool`, `recommendChain` | The guarded wire door | Part 8 belt runs inside `callTool` |
| `lib/core/part8-egress-guard.cjs` | `classify` (line 863), framework_step arm (511-518) | Proves the payload is a canonical handle | Needs the snapshot to carry the name |
| `lib/core/navigation.cjs` | `openRoomDbReadOnlyForCaller`, `writeClaimNode`, `writeEdge`, `REJECTED_BECAUSE` | Reads and proposed writes | Single SQL chokepoint |
| `lib/core/ambient-framing.cjs` | `resolveRoomRung` (line 227) | Silent rung read | Already used by `planner.buildPlan` |
| `lib/core/semantic-index/research-filing.cjs` | `fileResearchArtifact` | Research run home filing | Moved in 366-23; require from here |
| `lib/core/refusal-messaging.cjs` | `REFUSAL_KINDS` (line 207, six members) | Refusal kinds and copy | `not_ready` already exists |
| `lib/core/dominant-design/theo-structure.cjs` | `classifyCallResult` (line 135) | Precedent classifier for framework_step outcomes | Copy the pattern, not the degrade-to-reference behavior |

### Supporting (generators and gates, run, never hand-edit their outputs)
| Script | Writes | Check |
|--------|--------|-------|
| `scripts/build-new-surface.cjs` | `commands/<name>.md` skeleton, then shells out to `build-connector-registry` and `build-harness-manifest` (lines 435-439) | `--check --kind command --name scientific-roadmap` |
| `scripts/build-command-registry.cjs` | `data/command-registry.json` (preserves `curated_chains`) | `--check` |
| `scripts/build-connector-registry.cjs` | `data/connector-registry.json` | `--check` |
| `scripts/build-harness-manifest.cjs` | `data/harness-manifest.json` | `--check` |
| `scripts/build-orchestration-projection.cjs` | `data/brain-orchestration-projection.json` | `--check` |
| `scripts/build-render-coverage.cjs` | `data/render-coverage-registry.json` | `--check`; plus `scripts/check-render-coverage.cjs` |
| `scripts/build-skill-mirrors.cjs` | `skills/scientific-roadmap/SKILL.md` | `--check` |
| `scripts/stamp-firing-block.cjs` | the `<!-- mos:firing-block v2 -->` block in the command body | `check-render-coverage` md-keyspace |
| `scripts/refresh-framework-names.cjs` | `data/framework-names.json` (+ `theo_stamp`) | `--check` (offline) |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck not run (nothing to check).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 entry: /mos:scientific-roadmap | --from-hypothesis | ignite Researcher / Door 3 offer | Desktop methodology tool
                                   |
                                   v
                    [sr-entry] entry check (LOCAL, read-only)
              rung <- ambient-framing.resolveRoomRung (silent)
              WHAT statement? <- ratified goal / governing question / Door-3 claim
                     |                                   |
            no WHAT  v                          WHAT known v
     route back: define the WHAT first     [sr-entry] resolver over navigation reads:
     (offer analyze-needs / problem         filed reverse-salients, dominant-designs, futures,
      definition), STOP                     systems artifacts, opportunities + stage, hypotheses,
                                            prior research/<run>/plan.json
                                                      |
                                                      v
                                   F.1 ENTRY GATE: proposed step (override to 1);
                                   offers explore-opportunity too when both apply
                                                      |
                                                      v
   [sr-steps] brainClient.callTool('framework_step', {framework:'Scientific Roadmapping'})
        | (Part 8 guard: known_tool_shape once the snapshot carries the name)
        +--> brain_unavailable / egress_blocked / not_served / shape_refused / refused / no_steps
        |        -> typed honest refusal, STOP (no ledger, no local template, no memory)
        +--> rows[0].steps in LIST ORDER; skip DEFINITION/ASIDE; any runnable step with
                 null label or runIt -> "Theo has not authored this step yet", STOP
                                                      |  (authored)
                                                      v
   STAGE A (ordered): steps 1-4, each step text from Theo, each output F.0 approve/reject/defer
        -> systems pass gate (read filed systems/* or offer /mos:systems-thinking at ITS gate)
        -> step 5 Path Enumeration (F.4 harvest scope; dominant-designs/futures as candidate routes)
        -> step 6 Constraint Interrogation (F.8; reverse-salients enter as first ledger rows)
        -> step 7 Catalytic Ranking (F.0 Part 3 gate)   [rankByUnlock + nextBindingConstraint]
                                                      |
                                                      v
   [sr-door] question set mos.research-question-set/1, template_id scientific-roadmapping,
             command /mos:scientific-roadmap, perspective from Stage A -> validateQuestionSet
                                                      |
                                                      v
   STAGE B: each ranked ASSUMED limiter -> falsifiable hypothesis leaf (claim, unlock, refutation, tier)
            planner.buildPlan(room, qs, {mode:'deep'}) -> F.6 plan review -> handed to /mos:research
            (research runs under its own grant; a refuted limiter drops via the ratchet)
                                                      |
                                                      v
   F.8 FILING BASKET (nothing files without an approved selection):
     research-plan/PLAN.md (rung + steps run/not_run) | proposed step claims | REJECTED_BECAUSE discards
     | optional opportunity (default off)   -> navigation writers / fileResearchArtifact
```

### Recommended Project Structure (new files only, plus listed edits)

```
commands/scientific-roadmap.md                       # NEW, emitted by build-new-surface, hand-completed
skills/scientific-roadmap/SKILL.md                   # GENERATED by build-skill-mirrors
lib/core/research-planner/sr-steps.cjs               # NEW: framework_step reader + typed refusal (lazy brain-client)
lib/core/research-planner/sr-entry.cjs               # NEW: entry check + resolver (read-only, navigation door)
lib/core/research-planner/sr-door.cjs                # NEW: engine binding, question set, Stage B, plan basket, PLAN.md render + file
scripts/scientific-roadmap.cjs                       # NEW: CLI (entry | steps | question-set | plan | basket | file)
tests/test-364-*.cjs, tests/run-all-364.sh           # NEW
tests/fixtures/364-*/                                # NEW: live all-NULL payload, authored payload, entry rooms
docs/2026-10-0X-PHASE-364-THEO-NOTIFY.md             # NEW: tracked Theo handoff

EDITS (small, each deliberate):
data/framework-names.json                            # via refresh-framework-names --live (never by hand)
lib/core/research-planner/question-templates.cjs     # SCIENTIFIC_ROADMAPPING.doors += '/mos:scientific-roadmap' (keep explicit_only true)
lib/core/research-planner/CONTEXT.md                 # file-map rows for the three sr-* files
lib/core/refusal-messaging.cjs                       # theo refusal code mapper: not_scored -> not_ready
lib/mcp/tool-router.cjs                              # METHODOLOGY_COMMANDS += 'scientific-roadmap'; handler branch
tests/test-205-surface-fence.cjs, tests/test-366-router-redirects.cjs,
tests/test-366-eureka-alias.cjs, tests/test-eureka-mcp-tools.cjs   # 65 -> 66 pins, same commit as the enum
data/command-registry.json curated_chains            # hand-maintained block (preserved by the generator)
data/help-groups.json                                # add to group intelligence-research (line 109)
commands/ignite.md                                   # one offer line for Researcher / Door 3 (mirror regenerated)
lib/mcp/brain-router.cjs KNOWN_METHODOLOGIES         # optional: accept a Brain recommendation of the slug
docs/CANON-PHASE-MAP.md, docs/OPEN-HANDOFFS.md       # close-out rows
```

### Pattern 1: Theo step reader with honest refusal (no degrade)
**What:** One fixed handle, lazy client, typed outcome. Mirror `theo-structure.cjs` classification but
replace its "degrade to reference" branch with a refusal.
**When:** Every run, before Stage A.
```javascript
// Pattern source: lib/core/dominant-design/theo-structure.cjs:135-165, 239-300 (adapted; no reference fallback)
const HANDLE = 'Scientific Roadmapping';
const REFUSAL_TEXT = 'Theo has not authored this step yet';
const NON_RUNNABLE = new Set(['DEFINITION', 'ASIDE']);

async function readSrSteps(opts) {
  const o = opts || {};
  const client = o.brainClient || require('../brain-client.cjs'); // lazy: requiring this file opens nothing
  let result;
  try { result = await client.callTool('framework_step', { framework: HANDLE }); } // NO step_id: sr-v1-step-N fails PROCESS_STEP_ID_RE
  catch (_e) { return { ok: false, reason: 'call_threw' }; }
  const outcome = classify(result); // brain_unavailable | egress_blocked | not_served | shape_refused | refused | no_steps_in_canon | served
  if (outcome !== 'served') return { ok: false, reason: outcome };
  const steps = result.rows[0].steps;            // LIST ORDER as returned; never sort by sourceOrder
  const walk = [];
  for (const s of steps) {
    if (s && NON_RUNNABLE.has(s.stepKind)) continue; // skip DEFINITION and ASIDE
    if (!s || typeof s.label !== 'string' || !s.label || typeof s.runIt !== 'string' || !s.runIt) {
      return { ok: false, reason: 'step_unauthored', step_id: s && s.stepId, message: REFUSAL_TEXT };
    }
    walk.push(pick(s)); // whitelist: stepId, label, stepKind, runIt, thinkingMode, researchDirective, artifactRubric
  }
  return { ok: true, steps: walk, framework_status: result.rows[0].orchestrationStatus };
}
```
A null `stepKind` must be treated as runnable (the live state is null on everything), so the null
label/runIt rule refuses it. That is the honest path today.

### Pattern 2: Entry resolver over the navigation door (read-only)
**What:** Same read precedent as the 366 perspectives: open read-only through navigation, SELECT nodes,
close. No writes.
```javascript
// Pattern source: lib/core/research-planner/perspectives/rs-recall.cjs:391 and eureka-recall.cjs:177
const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
try {
  const rows = db.prepare('SELECT id, type, properties, source_path, source_section FROM nodes').all();
  // classify: source_path contains /reverse-salients/, /dominant-designs/, /futures/, /systems/;
  // type opportunity with stage; claim nodes from ignite Door 3 (knowledge_type assumption)
} finally { navigation.closeRoomDbForCaller && navigation.closeRoomDbForCaller(db); }
```
Verify the exact close function for read-only handles in the plan (rs-recall shows the precedent).

### Pattern 3: Door on the engine template
```javascript
// Source: lib/core/research-planner/planner.cjs:294-345, question-templates.cjs:509
const perspectiveMod = require('./perspective.cjs');
if (perspectiveMod.describeEngine().api_version !== '1') return refuse('engine_api_mismatch');
const qs = {
  schema: 'mos.research-question-set/1',
  template_id: 'scientific-roadmapping',     // explicit: the template stays explicit_only
  command: '/mos:scientific-roadmap',
  stated_question, scqa: { situation, complication, question },
  perspective: { tension, goal, rung_phrase, forum, paths, limiters, unlock_chains, tensions },
  key_line, leaves,                           // one hypothesis leaf per ranked assumed limiter (Stage B)
};
const shape = Q.validateQuestionSet(qs);      // perspective_missing is an error on this template
const built = planner.buildPlan(roomDir, qs, { mode: 'deep' });
```

### Pattern 4: Born-wired emission then hand-completion
```bash
# 1. emit the skeleton + regenerate connector registry and manifest (build-new-surface.cjs:435-439)
node scripts/build-new-surface.cjs --spec <scratch>/spec.json
# 2. hand-complete the frontmatter and body (the generator only writes name, description, connector)
# 3. regenerate everything that keys on commands/*.md, in this order
node scripts/build-command-registry.cjs
node scripts/build-connector-registry.cjs
node scripts/build-harness-manifest.cjs
node scripts/build-orchestration-projection.cjs
node scripts/stamp-firing-block.cjs            # if the body lacks the firing block
node scripts/build-render-coverage.cjs
node scripts/build-skill-mirrors.cjs
# 4. every --check green
```

### Recommended frontmatter (planner confirms each value)
```yaml
---
name: scientific-roadmap
description: Unlock the HOW for a goal whose WHAT is known, constraint-first, through Theo's Scientific Roadmapping steps
help_jtbd: "Turn a goal you can state but cannot yet reach into ranked, falsifiable constraint questions."
body_shape: "methodology"
layer: "loop"
hitl_stages:
  - stage: "entry-step"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "qualify-quantify-place-forum"
    shapes: ["F.9", "F.0"]
    mode: "ordered"
  - stage: "systems-pass"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "path-enumeration"
    shapes: ["F.4"]
    mode: "ordered"
  - stage: "constraint-interrogation"
    shapes: ["F.8"]
    mode: "parallel"
  - stage: "catalytic-ranking"
    shapes: ["F.0"]
    mode: "gate"
  - stage: "hypothesis-handoff"
    shapes: ["F.6"]
    mode: "gate"
  - stage: "filing"
    shapes: ["F.8"]
    mode: "parallel"
hitl_why: "An entry gate picks the starting step, the first four steps walk in order with an approve-reject-defer gate on each, a systems pass gate runs before paths are enumerated at a harvest scope, limiters are interrogated as an any-order basket, the ranking is ratified at a decision gate, the hypothesis plan is reviewed before research runs, and filing is an any-order basket."
interactive_first_reward: schema_preview
serves_jtbd: ["find-bottleneck", "validate-idea"]
teaching: "When you know what must be delivered but not how, /mos:scientific-roadmap walks Theo's Scientific Roadmapping steps to find the limits that are only assumed, ranks them by what they unlock, and hands the top ones to /mos:research as falsifiable hypotheses."
argument-hint: "[--from-hypothesis]"
kind: methodology
frameworks: ["Scientific Roadmapping", "Hypothesis-Driven Problem Solving"]
produces: "room/research-plan/*"
inputs: []
autonomous_safe: false
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: scientific-roadmap
  framework: "Scientific Roadmapping"
  posture: hold
  hierarchy_rank: 6
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
---
```
Rationale for choices the CONTEXT left open:
- **Two frameworks:** the registry already supports this (measured: `/mos:analyze-timing`,
  `/mos:structure-argument`, `/mos:trending-to-absurd`). Mirror `commands/structure-argument.md`'s
  RETRO-05 note: `frameworks:` lists both, the connector's single `framework:` keys the PRIMARY
  (Scientific Roadmapping). No "recipe edge" is needed to store HDPS; the FEEDS_INTO to /mos:research
  goes in `curated_chains`.
- **hierarchy_rank 6:** ranks are shared, not unique (measured: rank 6 holds `/mos:causal` and
  `/mos:research`). 6 puts it beside its runner partner `/mos:research` in the research family
  (`/mos:explore-opportunity` 5, `/mos:find-bottlenecks` 2). With `sensor_triggers: []` it is never
  sensor-surfaced, so the rank only orders it where it is already a candidate.
- **sensor_triggers []:** explicit entry only (like `/mos:explore-futures`, `/mos:explore-opportunity`).
  A new trigger would add a Theo `TRIGGERS` edge in Theo's sensor sync (SEAM 2) and a CONN-03 tuple.
  SENS-18 (`lib/core/sensors/sensor-roadmap-type.cjs`, roadmap-type classifier) is the natural future
  seam; out of scope here.
- **posture hold:** gated, `autonomous_safe: false`; `postureForCommand` maps hold to halt.
- **canon_parts:** a command frontmatter key only on a few commands (memory, mos, hmi-status, deck).
  Optional on the command; required on every PLAN (`canon_parts` with 11 plus `cirs_relationship`).
  Recommend `canon_parts: [3, 7, 8, 9, 11, 12]` on the plans; adding it to the command is harmless.

### Anti-Patterns to Avoid
- **Registering SR as a seventh recall perspective in `perspectives/index.cjs`.** That registry is the
  MOS-CANVAS pair-candidate pipeline (recall -> judge -> research -> file over candidate PAIRS
  `{a, b, section_a, section_b, ...}`, Stage A lanes, `makeCandidateStore`). SR is a gated seven-step
  walk producing a plan. Forcing it in would need fake pair candidates and a judge stage that means
  nothing, and it breaks `tests/test-366-perspective-interface.cjs` P1 (pins exactly six ids) and the
  MCP perspective-op loops. Reuse the perspective CONVENTIONS instead: frozen `ID / TEMPLATE_ID /
  COMMAND / RUN_ROOT` constants, `runDirFor(roomDir, tag)`, `questionSetFor(...)`, a derived STATUS.md
  through `perspectives/shared.cjs` `writeRunFiles`/`deriveStatus` if a scratch run home is wanted.
- **Using the 363 ledger or `srStepGuide` as step content.** See Pitfall 3.
- **Adding a NAMED_RECIPE to `recipe-maps.cjs`.** See Pitfall 4.
- **Calling `recommend_chain` for the spine.** SEED-106 item 1: chains terminate in business frameworks.
  Membership checks only (Finding F11).
- **Advancing an opportunity stage or auto-running explore-opportunity / systems-thinking /
  find-bottlenecks.** Offer at their own gates only.

## Key Findings (answers to the nine questions)

### F1. The canon snapshot does not carry the name (blocking, Wave 0)
- `data/framework-names.json`: `snapshot_date 2026-09-23`, source `theo list_frameworks`, 410 names, `curated_extras: ["Mullins Model"]`. "Scientific Roadmapping": absent; "Hypothesis-Driven Problem Solving", "Systems Thinking", "Reverse Salient Analysis", "Dominant Design", "Scenario Planning": present. [VERIFIED: node read]
- `scripts/build-command-registry.cjs` `loadFrameworkNames` (lines 240-252) validates every `frameworks:` entry against `framework_names UNION curated_extras`; line 375 collects unresolved; default run refuses to write (`Unresolvable frameworks`). `scripts/build-connector-registry.cjs` mirrors it (line 1265). [VERIFIED: code read]
- `lib/core/part8-egress-guard.cjs` framework_step arm (511-518) allows only `_isKnownFrameworkHandle`, which requires exact lowercase membership in `CANONICAL_PHRASES` (built at line 778 from the same file). Measured: `classify({framework:"Scientific Roadmapping"},{toolName:"framework_step"})` -> `ambiguous / unknown`; HDPS and RSA -> `allow / known_tool_shape`. A live `callTool` this session returned `egress_disclosure: {verdict: ambiguous, disposition: proceeded}`. [VERIFIED: live]
- Fix: `node scripts/refresh-framework-names.cjs --live` (one `list_frameworks` read through brain-client askOp; names only; writes `stale_review` and `theo_stamp`; `--check` offline). Theo's `list_frameworks` returns every `:Framework` (Theo `src/mcp/content/brain-ask.ts` ~297-310, no status filter), so the sr-v1 node and its four alias names will enter. The `--refresh-names` path inside `build-command-registry.cjs` is the OLDER writer (FEEDS_INTO slice, drops `stale_review`/`source_sha256`/`theo_stamp`); do not use it. [VERIFIED: code read]
- Consequence: the refresh also moves every other name changed in canon since 09-23 (Theo 20.2.1, 20.4 writes). The plan needs a human-verify checkpoint on the `stale_review` and diff, and a re-run of the egress, verification-stamp and 366 snapshot-gate tests that read this file (`tests/test-366-snapshot-gate.cjs`, `tests/test-3551-part8-egress.cjs`, `tests/test-245-egress-contentless.cjs`, `tests/test-354-egress-typed-question.cjs`, `tests/test-discover-part8.cjs`, `tests/test-355-stamp-truth.cjs`).

### F2. How /mos:new-surface wires a command today (Q1)
- `commands/new-surface.md` delegates to `scripts/build-new-surface.cjs --spec <file>`. `validateSpec` (133-170) enforces kind, slug, all 11 `CONNECTOR_KEYS` (88-100), frozen reach (6) and posture (3). `renderSurface` (192-230) writes ONLY `name`, `description`, the connector block and a one-paragraph body. `regenerateDownstream` (435-439) shells out to `build-connector-registry.cjs` then `build-harness-manifest.cjs`. `--check` asserts keys, frozen values, registration, manifest clean. [VERIFIED: code read]
- **Generated (never hand-edit):** `data/command-registry.json` (except its `curated_chains` block, hand-maintained and preserved, `loadCuratedChains`), `data/connector-registry.json`, `data/harness-manifest.json`, `data/brain-orchestration-projection.json` (walks commands/skills/agents, adds a node per command), `data/render-coverage-registry.json`, `skills/<name>/SKILL.md`.
- **Hand-edited:** the rest of the command frontmatter and body; `curated_chains`; `data/help-groups.json` (`check-help-coverage` hard-fails a non-admin command missing from a group); the MCP router enum (F3); `data/framework-names.json` only through its refresh script.
- **recipe-maps:** `lib/core/recipe-maps.cjs` is a read-only joiner (`postureForCommand` via command-resolver over command-registry; `wiringForReach` over connector-registry; `rankedNextReach` over the projection). A new command is "registered in recipe-maps" transitively by regenerating those three; no edit to `recipe-maps.cjs`.
- Baseline gates measured green this session: command-registry, connector-registry, orchestration-projection, harness-manifest, research-shape-ledger, render-coverage (198 wired / 2 excluded / 0 unwired), help-coverage, skill-mirrors (112), layer-declaration, reward-before-investment (113 compliant). Pre-existing reds NOT owned here: `build-framework-command-ledger --check` and `build-section-command-ledger --check` (plugin_version drift beta.48 / beta.54 vs beta.56); `build-command-irreversibility-ledger --check` WARN 10 (advisory, Jev dev-time scoring; the new command will be one more unscored WARN until a release-time rescore). `lib/parity/check-parity.cjs` already exits 1 with 49 CLI commands missing from MCP (not a gate). [VERIFIED: ran]

### F3. The MCP methodology enum is hand-listed (Q1, Tri-Polar)
- `lib/mcp/tool-router.cjs` `METHODOLOGY_COMMANDS` (352-357) is a literal array feeding `z.enum` on the `methodology` tool (registered ~1386-1392); `ALL_TOOL_COMMANDS` (468) spreads it. The handler calls `buildContext` -> `loadReference` (617), which serves `references/methodology/<cmd>.md` else `commands/<cmd>.md`. [VERIFIED: code read]
- Four tests pin `ALL_TOOL_COMMANDS` unique membership at 65: `tests/test-205-surface-fence.cjs:138-139`, `tests/test-366-router-redirects.cjs:113`, `tests/test-366-eureka-alias.cjs:130`, `tests/test-eureka-mcp-tools.cjs:123`. Adding `scientific-roadmap` moves them to 66 in the same commit. `tests/test-270-tool-schema-budget.cjs` allows 10 percent drift (passes today at 51,199 bytes). [VERIFIED: ran / grep]
- The `mindrian-brain` shim (`bin/mindrian-brain-mcp-client.cjs`) exposes only `brain_ask/query/schema/search/stats/write`. `framework_step` is NOT reachable to Desktop Larry through the shim. So on Desktop the Theo step read must happen inside the plugin's own MCP server: add a `scientific-roadmap` branch in the methodology handler that appends the `sr-steps` result (refusal or authored step list) to the reference, following the analysis handler's special case for find-bottlenecks (~1481). The handler is already `async`.
- Desktop plan path already exists: `research_run` op `plan` accepts any `question_set` (`lib/mcp/tools/research.cjs` `opPlan`, ~247), so an SR question set plans on Desktop without a new op. Gates: `gate_render` / `gate_answer`.
- Optional: `lib/mcp/brain-router.cjs` `KNOWN_METHODOLOGIES` (~124) is the exact-slug allowlist for a Brain-recommended command; add the slug so a later Theo recommendation is accepted. `lib/mcp/prompts.cjs` `METHODOLOGY_NAMES` adds an MCP prompt; optional, not required.

### F4. framework_step today and how to refuse (Q3)
- Only two plugin files call `framework_step`: `lib/core/dominant-design/theo-structure.cjs` (degrades to a local reference, which this command must NOT do) and the egress guard. `scripts/build-research-shape-ledger.cjs` reads Theo via raw Cypher at build time. [VERIFIED: grep]
- Live shape (measured this session through `brain-client.callTool`, generic handle only): `{rows:[{name, orchestrationStatus:"draft", steps:[7 x {stepId:"sr-v1-step-N", label:null, runIt:null, stepKind:null, thinkingMode:null, researchDirective:null, artifactRubric:null, charStart:null, sourceOrder:N, orchestrationStatus:null, sourceConstruct:null}]}], frameworkIdentities:{resolved:[...4 aliases]}, diagnostics, egress_disclosure}`. Matches CONTEXT's live fact. [VERIFIED: live]
- Theo's template sorts `ORDER BY p.char_start, p.id` (`/home/jsagi/Theo/src/mcp/content/framework-step.ts` FRAMEWORK_STEP_CYPHER); with all `char_start` null the order is by id, which is the list order the command must use as-is.
- Do not pass `step_id`: the guard's `PROCESS_STEP_ID_RE` (`a::b::pNN`) does not match `sr-v1-step-N`, so a step-scoped call would fall to ambiguous. Read the whole list once.
- Mapping Theo steps to the engine's perspective fields: map by case-insensitive label match to `SR_OPERATIONS` first; fall back to position only when exactly seven runnable steps come back; otherwise refuse the mapping with a typed `step_map_unresolved` and do not auto-fill perspective fields. [ASSUMED: design recommendation]

### F5. HITL shape declaration (Q4)
- Contract: `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` (F.0-F.9 meanings, lines 64-85), schema `data/hitl-stages-schema.json` (modes parallel / ordered / gate; any shape id in F.0-F.9; multi-shape stages allowed). `scripts/check-shape-declaration.cjs --check` is advisory (WARN) and currently prints existing WARNs for other skills; this surface must add none. [VERIFIED: ran]
- Multi-stage precedents: `commands/research.md` (six stages incl. F.6 plan review, F.8 filing), `commands/explore-futures.md` (F.2 then F.9), `commands/trending-to-absurd.md` (F.3 then F.9). SEED-098's draft used F.7 for ranking; F.7 means "ranked capability reaches (the dial)", so F.0 (Part 3 APPROVE / REJECT / DEFER) is the correct shape for ratifying the ranking. The recommended block is in the frontmatter above.
- Render coverage requires the body to carry the firing block (`<!-- mos:firing-block v2 -->`, stamp with `scripts/stamp-firing-block.cjs`) or an AskUserQuestion mention, and `allowed-tools` to include AskUserQuestion (`scripts/check-render-coverage.cjs` 293-333).

### F6. Multi-framework commands, ranks, NEXT_IN_RECIPE (Q5)
- Multi-framework precedent and rank conventions: see the frontmatter rationale above. `framework_index` is generated by scanning `commands/*.md` in sorted order, so `framework_index["Hypothesis-Driven Problem Solving"]` becomes `["/mos:research", "/mos:scientific-roadmap"]` and `commandsForFramework(...)[0]` stays `/mos:research` ("research" sorts before "scientific-roadmap"). `lib/memory/navigation-hook-resolver` relies on `[0]`; pin it with a test. [VERIFIED: code read]
- NEXT_IN_RECIPE in Theo is derived ONLY from `SENS10_CAUSE_RECIPES` and `NAMED_RECIPES` in `recipe-maps.cjs` (Theo `RECIPE_MAP_NAMES`, `build-command-layer.ts` ~296). There is no NAMED_RECIPE consumer in the plugin besides `recipeForName` and `pipelines/PWS_grading/CHAIN.md`. Recommendation: express "optional next: find-analogies" as an optional offer in the command body plus, if wanted, a lower-confidence `curated_chains` feeds_into entry (`command:/mos:scientific-roadmap` -> `command:/mos:find-analogies`); do not mint a recipe. The FEEDS_INTO to research goes in `curated_chains` like the existing `command:/mos:find-bottlenecks -> command:/mos:pipeline` entry; `build-orchestration-projection.cjs` supports `command:` endpoints and throws on a dangling one.

### F7. Entry check and resolver reads (Q7)
- Rung: `lib/core/ambient-framing.cjs` `resolveRoomRung(roomDir)` (227-247): ratified JTBD goal rung (`lib/hmi/jtbd-state.cjs` `getGoal`, 282), then ROOM.md `pws_stage`, then STATE explicit. Already the planner's silent rung read. [VERIFIED: code read]
- WHAT statement: no plugin surface carries a typed "needs statement" or "solution criteria" today (grep: zero hits across commands/lib/skills/references). Candidate stand-ins, in order: a ratified goal (`jtbdState.getGoal(roomDir)`, has text and rung), the current governing question (`navigation.readGoverningQuestionVersions`), a Door 3 hypothesis claim (`writeClaimNode`, knowledge_type assumption, `commands/ignite.md:154`). The F.1 entry gate shows the candidate and asks the navigator to confirm it IS the what-to-deliver; none present means route back (offer `/mos:analyze-needs` or a problem-definition move). This is an open question for the navigator (see Open Questions 1). [ASSUMED]
- Filed bound artifacts: commands produce `room/**/reverse-salients/*` (find-bottlenecks), `room/**/dominant-designs/*`, `room/**/futures/*` (explore-futures), `room/**/systems/*` (systems-thinking and analyze-systems). Read through `navigation.openRoomDbReadOnlyForCaller` and a SELECT over `nodes(id, type, properties, source_path, source_section)` (precedent `perspectives/eureka-recall.cjs:177`, `rs-recall.cjs:391`).
- Opportunities: `navigation.OPPORTUNITY_NODE_ID`, lifecycle set `candidate, qualified, explored, promoted, parked, retired` (`lib/core/navigation/typed-opportunity.cjs:81-83`); explore-opportunity owns qualified -> explored (`advanceOpportunityStage`). The resolver only reads.
- Prior runs: `perspective.loadSettled(roomDir)` reads `research/<run>/plan.json` ratchets; reuse it for the 7-to-1 re-survey entry.
- Persona: `readUserMd` role_blend (ignite Door 1 `role_blend={researcher:1.0}`, `commands/ignite.md:130`).

### F8. not_scored mapping (NR-1)
- `lib/core/refusal-messaging.cjs:207` `REFUSAL_KINDS` = six kinds, no `not_scored`; `tests/test-250-refusal-shapes.cjs` deepStrictEquals the set, so do NOT add a seventh kind. Add a small mapper (for example `kindForTheoRefusal(code)`: `not_scored -> not_ready`, unknown -> null, never `unreachable`), RED leg first (363-FOLLOW-ONS A7). [VERIFIED: code read]
- Theo `find_bottlenecks` returns `{refusal:{code:'not_scored', layer:'tool'}}` inside a success when no betweenness recompute exists (`/home/jsagi/Theo/src/mcp/content/find-bottlenecks.ts` ~414-432). No plugin code calls Theo's `find_bottlenecks` today (grep). It describes Theo's own canon, not the user's field, so the door should not call it; the mapper is the deliverable, and the door's Theo-result classifier uses it for any refusal code it sees.

### F9. The 363 engine contract and the minimal door (Q2)
- `describeEngine()` returns `{template_id:'scientific-roadmapping', engines, operations (7 names), forum_roles, roadmap_types, api_version:'1'}` (perspective.cjs 273-283). `buildPerspective` enforces the wish gate (`no_nameable_limiter`), quantified goal, 10X path, forum roles, the two-column limiter table and the ratchet (285-497).
- The template `scientific-roadmapping` (question-templates.cjs 226-276) has `doors: ['/mos:research']`, `explicit_only: true`. Registering the door = append `/mos:scientific-roadmap` to `doors` and keep `explicit_only: true` (so `templateForCommand` and `plannersForRoom` behavior stay unchanged); the door always passes `template_id` explicitly. `tests/test-363-pyramid.cjs:169` only asserts `/mos:research` is present. [VERIFIED]
- Ledger caveat: `structure.structureFor` (structure.cjs 147-188) copies the shipped ledger's SR steps (name, key_question, gates) into a plan when the engine is scientific-roadmapping. Those strings came from a `neo4j_direct` snapshot (2026-09-29) of the UNAUDITED sr-v1 batch's own property keys, and the ledger lists SR `problem_types: [UnDefined, IllDefined, Wicked]`, which contradicts the 2026-10-01 navigator ruling (WellDefined primary, IllDefined secondary; Theo 20.2.1 removed UnDefined and Wicked). See Pitfall 3.

### F10. Filing PLAN.md (output)
- The 363 F.8 basket (`filing.buildBasket`, 174) is built from a finished research RUN; there is no item kind for a plan filed before research. `fileResearchArtifact` writes `research/<dated-slug>/`. So `research-plan/PLAN.md` needs a door-side plan basket: reuse `filing.basketCard` (F.8, three options) and `filing.checkAuthority` semantics (approved selection required, grant never authority), with items: `research_plan` (PLAN.md, default on), one proposed claim per approved step, discarded routes (`REJECTED_BECAUSE`, an allowed edge type), optional opportunity (default off). Write through navigation writers; give `research-plan/` a ROOM.md identity (the `ensureDirIdentity` pattern in research-filing.cjs). Note `research/` and `research-plan/` both classify as `discovered` in `lib/core/icm-forest.cjs` (neither is a canonical section). [ASSUMED: design]

### F11. Coverage honesty and the rubric
- A membership-only coverage read is possible through `brain-client.recommendChain(problemType, maxSteps)`; the guard has a known arm for `recommend_chain` with the problem_type enum (part8-egress-guard.cjs 488-503). If Scientific Roadmapping is absent from the WellDefined answer, say "uncovered" and cite the navigator ruling as the rooting source. Never adopt the returned chain. `find_frameworks_for_problem_type` has NO guard arm (would be ambiguous); avoid it. [VERIFIED: code read]
- Scientific-method rubric: no plugin or Theo content exists; author it as plugin-side data (e.g. a frozen constant in `sr-door.cjs` with a `source: 'plugin-side rubric, not Theo content'` label) and test the label renders.

### F12. How Theo learns about the command (Q6)
- Theo reads `data/command-registry.json`, `lib/core/recipe-maps.cjs`, `data/connector-registry.json` from a pinned plugin clone (`scripts/plugin-pin.ts`, pinned at beta.51 `d2ebe214` after Theo Phase 24; `MINDRIAN_OS_ROOT` override). Canon now carries 113 MindrianCommand nodes, USES_FRAMEWORK 53 edges. [VERIFIED: Theo 24-SUMMARY.md]
- USES_FRAMEWORK = union of `framework_index` pairs and `connectors[].framework`, each resolved through `.theo-graph/command-alias-table.yaml`; unresolved names become `framework_unresolved` gaps, fail closed. HDPS has a `live_framework` row (line 343); Scientific Roadmapping has none. Reciprocity between `framework_index` and `commands[].frameworks` aborts the sync on any mismatch (the generator keeps them reciprocal). [VERIFIED: build-command-layer.ts ~1100-1200]
- FEEDS_INTO between commands comes from `curated_chains` endpoints with `command:` prefixes; WIRED_TO from connector `reach_id`.
- The release already notifies Theo: `scripts/release.sh` Step 5.6 (`scripts/release-lib/theo-notify-gate.sh`) dispatches the registry hash (`docs/THEO-NOTIFY-CONTRACT.md`, `docs/2026-09-16-PHASE-349-THEO-NOTIFY-CLOSE-OUT.md`).
- Plugin-side handoff therefore = registry row + curated chain + a tracked THEO-NOTIFY doc naming: slug, both frameworks, the curated chain, "add an alias-table row `framework: Scientific Roadmapping, live_framework: Scientific Roadmapping`", "recipe count unchanged (5)", "MindrianCommand count 113 -> 114", the release id when cut. Plus an OPEN-HANDOFFS row and a message to the Theo session (jsagi-f1) asking it to append the 25-PLUGIN-CONTRACT handoff log.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Perspective, limiter columns, ranking, ratchet | A second SR engine | `perspective.cjs` buildPerspective / rankByUnlock / nextBindingConstraint / loadSettled / nextVersion | D-18; one engine, one place to fix |
| Plan object, F.6 card, deep run | A command-local planner | `planner.buildPlan` / `cardFor`, `/mos:research` runner | D-14 one governed runner |
| Fetching, grants, audit ledger, cache | Any fetch in the door | `/mos:research` under its grant | No second fetcher or approval ledger |
| Registry JSON | Hand-edited registry rows | The `build-*` generators | `--check` fails on drift; Theo reads these bytes |
| Connector frontmatter | Hand-typed connector block | `scripts/build-new-surface.cjs` | Frozen-bank validation, born wired |
| Egress safety | A local allowlist for "Scientific Roadmapping" | Refresh `framework-names.json`; guard reads it | One vocabulary for guard, registry and stamp |
| Room reads | Direct `new DatabaseSync(room.db)` | `navigation.openRoomDbReadOnlyForCaller` | Single chokepoint |
| Gate cards | A bespoke widget or printed menu | Firing block + AskUserQuestion (CLI), `gate_render`/`gate_answer` (MCP) | SEED-021, render coverage |
| Refusal copy | Ad-hoc strings | `refusal-messaging.cjs` kinds; plus the contract's exact step refusal text | Closed vocabulary |
| Skill mirror | Hand-copied SKILL.md | `scripts/build-skill-mirrors.cjs` | Byte mirror with the documented exceptions |

**Key insight:** every piece of state this command touches is already generated, guarded or chokepointed. Hand-rolling any of it creates a second truth that Theo, the guard or a `--check` will disagree with.

## Runtime State Inventory

Not a rename phase, but it changes registries other systems read. Listed so nothing is silently out of sync.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Theo canon: 113 MindrianCommand nodes, no `/mos:scientific-roadmap`, no alias-table row for Scientific Roadmapping | Theo-side after release (Theo Phase 25 part 6); plugin writes the THEO-NOTIFY doc only |
| Live service config | Theo hosted sync reads the pinned plugin clone (beta.51); mindrian-website shows a command count (memory note: "commands 113"); release-cut listener checks website facts vs plugin count (`scripts/release-cut-listener.cjs`) | At release: website count 113 -> 114 per the version-bump fact-check rule; not this phase's code, but name it in the handoff |
| OS-registered state | None - verified: no hook, cron or scheduled task keys on command lists | None |
| Secrets/env vars | `refresh-framework-names --live` needs the Brain token (`~/.mindrian.env` present, `brain-client.isAvailable()` true this session) | None to change; the live step needs network |
| Build artifacts | `data/framework-names.json` snapshot (stale for this name), `data/research-shape-ledger.json` (SR problem_types stale vs ruling), `data/command-irreversibility-ledger.json` (will WARN unscored) | Refresh names in Wave 0; ledger rebuild deferred to after Theo 25 (record as follow-on); irreversibility rescore at release |

## Common Pitfalls

### Pitfall 1: The name is not in the canon snapshot
**What goes wrong:** `build-command-registry` refuses the new frontmatter; `build-connector-registry` refuses it; the Part 8 guard calls every `framework_step` for SR ambiguous.
**Why:** snapshot 2026-09-23 predates the sr-v1 batch (2026-09-24).
**How to avoid:** Wave 0 runs `node scripts/refresh-framework-names.cjs --live` with a human-verify checkpoint on the diff and `stale_review`; then re-run the egress and stamp tests listed in F1.
**Warning signs:** `Unresolvable frameworks (not in data/framework-names.json): /mos:scientific-roadmap -> "Scientific Roadmapping"`; `egress_disclosure.verdict: ambiguous` on the step read.

### Pitfall 2: Adding the MCP enum without moving the 65 pins
**What goes wrong:** four tests fail (`uniqueMcp.size === 65`).
**How to avoid:** enum change and the four pin changes in one commit, each pin's comment updated to say why (the 364 methodology addition).

### Pitfall 3: Presenting ledger or local-template text as step content
**What goes wrong:** `perspective.srStepGuide()` falls back to `LOCAL_STEP_TEMPLATE` (perspective.cjs 65-73, plugin-authored key questions) and `structure.structureFor` embeds the ledger's sr-v1 step text into the plan. Rendering either as "the step" violates "never write step text from memory" and shows unaudited canon text.
**How to avoid:** the door renders step text ONLY from `sr-steps` (framework_step). Engine operation names (`SR_OPERATIONS`) are internal keys. If a plan carries `structure.frameworks['Scientific Roadmapping']`, the door never displays it, and PLAN.md lists steps by Theo stepId + Theo label.
**Warning signs:** any test fixture where Theo returns all-null steps but a key question still appears in output.

### Pitfall 4: Minting a NAMED_RECIPE
**What goes wrong:** Theo's `parseRecipeMaps` throws (`recipe parse found 6 recipes, expected 5`), stopping Theo's whole command-layer sync until Theo re-measures.
**How to avoid:** no recipe; use `curated_chains` plus a body offer. If the navigator wants a recipe later, it is a coordinated change with Theo.

### Pitfall 5: Rooting from the stale ledger
**What goes wrong:** `research-shape-ledger.json` says SR addresses UnDefined/IllDefined/Wicked; the navigator ruled WellDefined primary, IllDefined secondary.
**How to avoid:** the door's rooting comes from a plugin-side constant citing the 2026-10-01 ruling (364-INPUT.md); `plannersForRoom` never offers SR anyway (explicit_only). Record the ledger rebuild as a follow-on after Theo 25.

### Pitfall 6: A null stepKind treated as non-runnable
**What goes wrong:** skipping null-kind steps would "succeed" with zero runnable steps and walk nothing silently.
**How to avoid:** only `DEFINITION` and `ASIDE` skip; null kind is runnable and therefore refused when label/runIt are null; zero runnable steps after skipping is its own refusal (`no_runnable_steps`).

### Pitfall 7: Writing during entry resolution
**What goes wrong:** minting a goal anchor or writing a memory_event while "just reading" (several navigation helpers write, e.g. `mintGoalAnchor`).
**How to avoid:** the resolver uses the read-only handle only; a test opens the room db before and after and asserts byte-equal node/edge counts.

### Pitfall 8: Tests touching the real registry or rooms
**How to avoid:** set `HOME`, `USERPROFILE`, `MINDRIAN_ROOMS_HOME` to `mkdtemp` dirs and delete `CLAUDE_ACTIVE_ROOM`, `CLAUDE_CODE_SESSION_ID`, `MINDRIAN_MCP_FIRST` BEFORE requiring any repo module (test-366-perspective-interface.cjs 31-37); `hygiene.scrubVendorKey()`, `hygiene.installNetGuard()`, net attempts 0 as the last check; exit 77 when `node:sqlite` is missing; inject a fake `brainClient` (`tests/test-361-theo-structure.cjs` `makeFake`, ~54-70).

### Pitfall 9: Peer-session collisions on shared files
`.planning/STATE.md`, `REQUIREMENTS.md`, `docs/OPEN-HANDOFFS.md` and the four pinned tests are hot. Commit with `--only`, verify shas are ancestors of HEAD, never revert unowned diffs.

## Code Examples

### Refusal mapper (RED first)
```javascript
// lib/core/refusal-messaging.cjs (new export; REFUSAL_KINDS unchanged)
const THEO_REFUSAL_TO_KIND = Object.freeze({ not_scored: 'not_ready' });
function kindForTheoRefusal(code) {
  return (typeof code === 'string' && Object.prototype.hasOwnProperty.call(THEO_REFUSAL_TO_KIND, code))
    ? THEO_REFUSAL_TO_KIND[code] : null; // never 'unreachable'
}
```

### Methodology handler branch (MCP, Desktop/Cowork)
```javascript
// lib/mcp/tool-router.cjs methodology handler, beside buildContext
let response = buildContext(pluginRoot, roomDir, command, context);
if (command === 'scientific-roadmap') {
  const sr = await require('../core/research-planner/sr-steps.cjs').readSrSteps({});
  response += '\n\n### Theo steps\n' + require('../core/research-planner/sr-steps.cjs').renderStatus(sr);
}
```

### Entry resolver table (SEED-098 NR-2) as data
```javascript
const ENTRY_RULES = Object.freeze([
  { when: 'prior_run_plus_new_evidence', step: 1, why: 're-survey with the prior ledger' },
  { when: 'hypothesis_in_flight',        step: 6, why: 'test the limiter the hypothesis depends on' },
  { when: 'rs_finding',                  step: 6, why: 'a claimed bound exists; classify it' },
  { when: 'design_or_futures',           step: 5, why: 'variants and scenarios are candidate routes' },
  { when: 'quantified_goal',             step: 3, why: 'baseline, unit, target, horizon exist' },
  { when: 'stated_goal',                 step: 2, why: 'the goal is not yet falsifiable' },
  { when: 'fresh',                       step: 1, why: 'qualify the tension first' },
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `build-command-registry --refresh-names` (FEEDS_INTO slice) | `refresh-framework-names.cjs --live` (list_frameworks, stale_review, theo_stamp) | Phase 355 / 366-06 | Use the newer writer; the release gate wants the stamp |
| Eureka standalone engine | Perspective registry (six ids) in the planner | Phase 366 | SR stays a door, not a seventh recall perspective |
| Theo synced at beta.42 | Theo pinned at beta.51 | Theo Phase 24 (2026-10-01) | Next sync re-pins to the release carrying this command |
| `find_bottlenecks` fabricated empties | refusal `not_scored` with `bottlenecks` absent | Theo 20.2 | Map to `not_ready` |

**Deprecated/outdated:** `research-shape-ledger.json` SR `problem_types` (pre-20.2.1, pre-ruling).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Step-to-operation mapping by label match then position-when-seven | F4 | Wrong mapping fills the wrong perspective field once Theo authors steps; refusal path unaffected |
| A2 | WHAT statement stand-ins (ratified goal, governing question, Door 3 claim) confirmed at the F.1 gate | F7 | Navigator may want a dedicated needs-statement artifact; the entry check would need a new typed node |
| A3 | `research-plan/PLAN.md` filed through a door-side plan basket reusing `basketCard`/`checkAuthority` semantics, not a new `filing.cjs` item kind | F10 | If the navigator wants it inside `filing.buildBasket`, the edit moves into filing.cjs |
| A4 | hierarchy_rank 6, sensor_triggers [], posture hold, serves_jtbd [find-bottleneck, validate-idea], interactive_first_reward schema_preview | Frontmatter | Low; all reversible, all checked by gates |
| A5 | The refresh moves other names too and the dependent tests stay green | F1 | A red egress/stamp test after refresh needs its own fix inside Wave 0 |
| A6 | Membership-only `recommend_chain` read is an acceptable coverage check under SEED-106 | F11 | If not, coverage disclosure becomes a static statement citing the ruling |

## Open Questions (RESOLVED)

All four resolved 2026-10-02: Q1-Q3 by the navigator rulings in 364-CONTEXT.md ("Navigator rulings 2026-10-02 (post-research)": stand-ins at the F.1 gate; entry then refuse at step 1 and offer /mos:research; executor runs the refresh, navigator reviews the diff); Q4 by the THEO-NOTIFY doc in plan 364-10.

1. **What counts as the "needs or solution-criteria statement"?**
   - Known: no typed node exists; ratified goal, governing question and Door 3 claim are available.
   - Unclear: whether the navigator accepts those stand-ins confirmed at the F.1 gate, or wants a dedicated artifact.
   - Recommendation: stand-ins confirmed at the F.1 gate; ask once at plan time.
2. **Should Stage A be walkable at all before Theo authors the steps?**
   - Known: contract says refuse on null steps; live state is all null.
   - Recommendation: no walking; the command still runs the entry check, the resolver and shows bound inputs, then refuses honestly at step 1 and offers `/mos:research` directly. Confirm with the navigator.
3. **Refresh timing for `framework-names.json`.** The `--live` refresh is network and moves many names; run it as the first Wave 0 task with a human-verify checkpoint, or ask the navigator to run it. Recommendation: executor runs it, navigator reviews the diff.
4. **Website and Theo counts at release.** Out of this phase, but the THEO-NOTIFY doc should name them so the release session does not miss them.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (>= 22.16 floor) | - |
| node:sqlite | room reads in tests | yes | built in | tests exit 77 |
| Brain/Theo endpoint + token | `refresh-framework-names --live`, live smoke | yes (`isAvailable() true`, `~/.mindrian.env` present, live `framework_step` answered) | theo-mcp.onrender.com | none for the refresh; all other tests offline with a fake client |
| Theo repo (read-only) | handoff facts | yes | `/home/jsagi/Theo` | - |

**Missing dependencies with no fallback:** none. **With fallback:** none needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node CJS test scripts (assert + `tests/helpers/hygiene-355.cjs` `makeChecker`), bash aggregator |
| Config file | none; `tests/run-all-364.sh` (Wave 0, written once, every leg behind `run_if`) |
| Quick run command | `node tests/test-364-<leg>.cjs` |
| Full suite command | `bash tests/run-all-364.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRM364-01 | snapshot carries the name; guard allows framework_step(SR) | unit | `node tests/test-364-canon-snapshot.cjs` (+ `node scripts/refresh-framework-names.cjs --check`) | no - Wave 0 |
| SRM364-02 | command frontmatter complete and valid | static | `node tests/test-364-command-contract.cjs` (+ `node scripts/build-new-surface.cjs --check --kind command --name scientific-roadmap`) | no - Wave 0 |
| SRM364-03 | every generator `--check` green | gate | `node tests/test-364-registry-gates.cjs` (spawns each `--check`) | no - Wave 0 |
| SRM364-04 | reciprocity, `commandsForFramework` [0], recipe-maps posture/wiring | unit | `node tests/test-364-registry-gates.cjs` | no - Wave 0 |
| SRM364-05 | curated chain present, projection accepts it | unit | `node tests/test-364-registry-gates.cjs` | no - Wave 0 |
| SRM364-06 | step reader order, skip, refusal text, no sort, handle-only args | unit (fake client) | `node tests/test-364-sr-steps.cjs` | no - Wave 0 |
| SRM364-07 | all-NULL fixture refuses end to end; authored fixture walks | integration (CLI child + MCP handler, fake client) | `node tests/test-364-refusal-e2e.cjs` | no - Wave 0 |
| SRM364-08 | no WHAT routes back; rung named | unit (fixture rooms) | `node tests/test-364-sr-entry.cjs` | no - Wave 0 |
| SRM364-09 | resolver table, not_run provenance, zero writes, explore-opportunity offer | unit (fixture rooms) | `node tests/test-364-sr-entry.cjs` | no - Wave 0 |
| SRM364-10 | bound artifacts read, offered when absent, no re-implementation | unit + static | `node tests/test-364-sr-entry.cjs` | no - Wave 0 |
| SRM364-11 | not_scored -> not_ready, REFUSAL_KINDS still six | unit (RED first) | `node tests/test-364-refusal-not-scored.cjs` (+ `node tests/test-250-refusal-shapes.cjs`) | no - Wave 0 |
| SRM364-12 | systems pass precedes steps 5 and 6 | unit (door state machine) | `node tests/test-364-sr-door.cjs` | no - Wave 0 |
| SRM364-13 | template door, api_version bind, buildPlan, no second engine | unit + static scan | `node tests/test-364-sr-door.cjs` | no - Wave 0 |
| SRM364-14 | Stage B leaves, F.6 handoff, refuted limiter drops | unit | `node tests/test-364-sr-door.cjs` | no - Wave 0 |
| SRM364-15 | PLAN.md only on approved selection; rung + steps; proposed; REJECTED_BECAUSE | integration (temp room) | `node tests/test-364-filing.cjs` | no - Wave 0 |
| SRM364-16 | Part 8: marker never reaches the fake client; net guard 0; no raw theo | sweep | `node tests/test-364-part8.cjs` | no - Wave 0 |
| SRM364-17 | MCP enum, 66 pins, handler output | integration (in-process MCP) | `node tests/test-364-mcp.cjs` (+ the four pinned tests) | no - Wave 0 |
| SRM364-18 | --from-hypothesis, ignite offer lines, skill mirror trigger | static | `node tests/test-364-command-contract.cjs` | no - Wave 0 |
| SRM364-19 | rubric labelled plugin-side; "uncovered" on thin answer | unit | `node tests/test-364-sr-door.cjs` | no - Wave 0 |
| SRM364-20 | THEO-NOTIFY doc names slug, frameworks, chain, alias row, counts; no file under /home/jsagi/Theo written | static | `node tests/test-364-theo-handoff.cjs` | no - Wave 0 |
| SRM364-21 | aggregator green, gates, doctor | phase gate | `bash tests/run-all-364.sh` and `node scripts/doctor.cjs --acceptance` | no - Wave 0 |

Manual-only: the live Theo smoke (`MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs`, opt-in, asserts the live answer is still all-NULL and refused, or authored and walkable) - live network, run once at close with navigator approval.

### Sampling Rate
- **Per task commit:** the touched `test-364-*.cjs` leg plus any pinned test it moves.
- **Per wave merge:** `bash tests/run-all-364.sh` plus the generator `--check` set.
- **Phase gate:** full aggregator green, `node scripts/doctor.cjs --acceptance` no new failing point, `bash tests/run-all-363.sh` and `bash tests/run-all-366.sh` no new failures (known reds matched by signature).

### Wave 0 Gaps
- [ ] `tests/run-all-364.sh` - aggregator, every leg via `run_if`, `run_known_if` for the two plugin_version-drift ledger reds
- [ ] `tests/fixtures/364-theo/framework-step-all-null.json` - the measured 2026-10-02 payload
- [ ] `tests/fixtures/364-theo/framework-step-authored.json` - seven authored steps plus one DEFINITION and one ASIDE interleaved
- [ ] `tests/fixtures/364-rooms/` builder (or extend `tests/helpers/fixture-366.cjs`): fresh, stated goal, quantified goal, design/futures filed, RS filed, hypothesis in flight, prior run
- [ ] RED legs: `test-364-refusal-not-scored.cjs`, `test-364-sr-steps.cjs`, `test-364-canon-snapshot.cjs`
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Brain token handled by brain-client only |
| V3 Session Management | yes (MCP) | session-keyed gate ledger (`lib/mcp/gate-ledger.cjs`), existing |
| V4 Access Control | yes | filing only on an approved F.8 selection; grant is never filing authority (`filing.checkAuthority`) |
| V5 Input Validation | yes | `validateQuestionSet`, frozen enums, Theo step whitelist pick, slug regex, zod on MCP |
| V6 Cryptography | no | none (sha256 hashes only through existing modules) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Room text leaking to Theo | Information disclosure | constant one-key handle, guard `known_tool_shape`, Part 8 sweep test with a planted marker |
| Oversized or hostile Theo payload | Tampering | whitelist only the eleven projected fields, cap string lengths, no `step_id` input from the room |
| Forged approval to file | Elevation | `approved:true` selection from the gate ledger only; unknown item ids refused |
| Silent fallback to fabricated steps | Repudiation (false success) | typed refusal, no fallback branch, tests assert null fixture yields refusal |
| Path traversal in run tags / slugs | Tampering | reuse `SAFE_SLUG` and run-tag regex patterns from `perspectives/shared.cjs` / research.cjs |

## Sources

### Primary (HIGH confidence)
- Plugin code read this session: `scripts/build-new-surface.cjs`, `scripts/build-command-registry.cjs`, `scripts/build-connector-registry.cjs`, `scripts/refresh-framework-names.cjs`, `scripts/check-render-coverage.cjs`, `scripts/build-skill-mirrors.cjs`, `scripts/check-cirs-declaration.cjs`, `lib/mcp/tool-router.cjs`, `lib/mcp/tools/research.cjs`, `lib/mcp/brain-router.cjs`, `lib/mcp/prompts.cjs`, `bin/mindrian-brain-mcp-client.cjs`, `lib/core/part8-egress-guard.cjs`, `lib/core/refusal-messaging.cjs`, `lib/core/recipe-maps.cjs`, `lib/core/dominant-design/theo-structure.cjs`, `lib/core/research-planner/{CONTEXT.md, perspective, question-templates, planner, structure, filing}.cjs`, `lib/core/research-planner/perspectives/{index, shared, rs-recall}.cjs`, `lib/core/ambient-framing.cjs`, `lib/core/navigation.cjs` exports, `lib/core/icm-forest.cjs`, `commands/{new-surface, research, structure-argument, analyze-timing, trending-to-absurd, find-bottlenecks, dominant-designs, explore-futures, systems-thinking, analyze-systems, explore-opportunity, ignite}.md`, `data/{command-registry, connector-registry, framework-names, research-shape-ledger, hitl-stages-schema, help-groups}.json`, tests 205/366/363/361/270.
- Live: guarded `brain-client.callTool('framework_step', {framework:'Scientific Roadmapping'})` (generic handle) and `part8-egress-guard.classify` probes.
- Theo (read-only): `scripts/build-command-layer.ts`, `.theo-graph/command-alias-table.yaml`, `src/mcp/content/{framework-step, find-bottlenecks, brain-ask}.ts`, `.planning/phases/24-*/24-SUMMARY.md`, `.planning/phases/25-*/{25-PLUGIN-CONTRACT, 25-INPUT-command-draft, 25-INPUT-problem-type-ruling}.md`.
- Planning: 364-CONTEXT.md, 364-INPUT.md, SEED-098, 363-22-SUMMARY.md, 363-FOLLOW-ONS.md (A5, A7).

### Secondary / Tertiary
- None. No web research was needed (no external library or time-sensitive vendor fact).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all in-repo modules, read and in several cases executed.
- Architecture: MEDIUM-HIGH - wiring path measured; the three-module door split and plan basket are recommendations.
- Pitfalls: HIGH - each one reproduced or read in code (snapshot miss, 65 pins, recipe count, ledger text, stale rooting).

**Research date:** 2026-10-02
**Valid until:** 2026-10-09 (fast-moving: Theo Phase 25 may author the steps and change the live answer; peer phases touch the pinned tests)
