# Phase 254: Orchestration projection consumption wiring (suggest-next, act, server-side composition) - Research

**Researched:** 2026-09-02
**Domain:** Internal architecture - orchestration read-model consumption, MCP tool-handler composition, Canon Part 8 egress locus
**Confidence:** HIGH (every load-bearing claim was verified by reading or executing this repo's own source this session)

---

## Summary

Three of the four things the ROADMAP entry says this phase must do are **already shipped**, and one thing the ROADMAP entry treats as a hypothetical is **already running in production**. The phase as written would re-litigate settled ground and would miss the one defect that actually causes the user-visible failure.

What is actually true, measured this session:

1. **`decide()` already consumes the orchestration projection.** SEED-045 open item 1 ("wire `decide()` to consume the local projection cache") shipped in Phase 184 (`lib/core/reader/decide-projection-reader.cjs`) and Phase 191 (`lib/core/orchestration-candidate-lift.cjs`), both wired into `navigation-engine.cjs::decide()` at lines 1102-1143. The seed text is stale.
2. **`/mos:suggest-next` and `/mos:act` do NOT consume it, and never call `decide()` for chain selection.** Their chain comes from `lib/brain/chain-recommender.cjs::recommendFrameworkChain` plus `composeWorkflow`. Measured live: that path returns a **one-element chain** for every problem type, because the framework vocabulary it walks (`framework-chain-composer.cjs` `KNOWN_FRAMEWORKS`, 18 generic MBA names) shares **exactly one** name with the 28 PWS frameworks the registry and projection actually carry. `/mos:suggest-next` promises a "step-numbered command sequence" and structurally cannot produce more than one step.
3. **Server-side composition is not a proposal. It shipped twice.** `lib/mcp/tool-router.cjs:1462` (`orchestration` tool, `act`/`act-chain`/`act-dry-run`/`act-swarm`) calls `lib/mcp/brain-router.cjs::recommend()`, whose Tier 3 makes a live `brainClient.ask()` call. `lib/mcp/tools/sensors.cjs:198` (`suggest_next` tool) calls `chainRecommender.chainOfferForReach()`, which calls `brainClient.recommendChain()`. Both are `mindrian-os`-named handlers; both are invisible to the `mcp__*brain*` PreToolUse matcher. The navigator's open ruling is therefore not *"may we start"* but *"do we ratify and govern what already happens, or remove it."*
4. **The 239-05 prerequisite is already satisfied.** Plan 239-05 closed 2026-07-30, and Quick `260819-c8j` (commit `ca32b612`, 2026-08-19) added a Part 8 `classify()` belt at `brain-client.cjs::callTool()` line 527, the single dispatch seam all 16 wrappers flow through. The ROADMAP's "same-phase prerequisite" line is stale. **One real residual gap remains** and it is narrow (see Section 3.4): the belt blocks on `block` only; the hook additionally gates on `ambiguous`.

**Primary recommendation:** Re-scope this phase to (a) replace `recommendFrameworkChain`'s dead composer vocabulary with the shipped-but-unwired `lib/workflow/local-chain-recommender.cjs` as the primary chain source, keeping the current path as the honest floor (blend, never replace - proven necessary in Section 2.4); (b) ratify server-side composition as **already-shipped, now-governed**, and close the `ambiguous`-verdict gap in the `callTool` belt; (c) do not touch `decide()`. Phase 262's D-07 finding is sufficient confirmation and no fresh `:Framework` measurement is needed, **provided (b) does not widen the live-Brain surface** - see Section 6.

---

## User Constraints

**No `254-CONTEXT.md` exists.** `/gsd-discuss-phase` has not run for this phase; the phase directory holds only a `.gitkeep`. There are no locked decisions to honor and no deferred ideas to exclude. Everything below is Claude's discretion, subject to the navigator rulings named in the ROADMAP entry and to the project constraints in the next section.

**Carried constraints from the ROADMAP entry (treat as binding):**

- **Locked:** Per-turn `decide()`/sensor dispatch stays projection-fed. R7 (no live Brain call at `decide()`/rank time). This phase does not touch that path.
- **Open navigator ruling (blocking):** approve/reject server-side composition before this phase's plan locks its architecture. Section 3 lays out the real tradeoff.
- **Standing rule:** Theo forward-compatibility must be stated explicitly. Section 5.

---

## Project Constraints (from CLAUDE.md)

| # | Directive | Consequence for this phase |
|---|---|---|
| C-1 | **WORKSPACE GUARD.** All work in `/home/jsagi/dev/MindrianOS-Plugin/`, never the plugin install cache. | Plan tasks must not reference `~/.claude/plugins/`. |
| C-2 | **Canon Part 8 - Graph Boundary.** User data never egresses; Brain serves generic methodology only. | The projection is a LOCAL derived cache; reading it opens no wire. Any *new* live Brain call needs an explicit Part 8 argument, not an assumption. |
| C-3 | **Canon Part 3 - Tri-Context Decision Gate.** LOCAL + BRAIN + SIGNAL -> APPROVE/REJECT/DEFER through Shape F. MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen. | A richer chain must still render through the existing F.1 selector; no new render contract. |
| C-4 | **Canon Part 7 - Reuse Before Build.** Search the 25 methodology commands first; justify any net-new surface. | `local-chain-recommender.cjs` already exists and is tested. Building a second projection reader would be a Part 7 violation. |
| C-5 | **Canon Part 11 - Invocation Constitution (CIRS).** Every invocable surface born WIRED or EXCLUDED, with a declared `hitl_shape`/`hitl_stages`. R12 requires a `cirs_relationship:` block on any phase that consumes the spine. | This phase consumes the spine. Every plan needs a `cirs_relationship:` declaration or the gate FAILS the build. |
| C-6 | **No em-dashes anywhere.** Hyphens only. | Enforced by `tests/run-all-*.sh` no-em-dash fences and pre-commit. |
| C-7 | **CJS only, no TypeScript.** `lib/core/*.cjs` ships as source. | No build step, no TS. |
| C-8 | **GSD-only dev workflow.** No direct repo edits outside a GSD command. | Plans, not ad-hoc edits. |
| C-9 | **Dev-Research Compositing.** Every phase touching MindrianOS's own architecture composites with `~/MindrianRooms/rethinking-mindrianos/research/`. | This phase is squarely architecture work. A dated research-trail entry is required, cross-linked back to this file. |
| C-10 | **Consult ALL relevant grounding sources.** Theo is a standing consult for anything Brain-graph / framework-resolution / readiness-adjacent. | Section 5 discharges this. |
| C-11 | **Tri-Polar Design Rule.** Evaluate CLI + Desktop + Cowork; a skip must be a stated call. | Section "Tri-Polar Impact" below. |
| C-12 | **Verification.** `bash tests/run-all-<phase>.sh`, `scripts/verify-release`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/doctor.cjs --acceptance`. | Section 7. |

**Project skills:** `.claude/skills/` contains only `docu-optimizer` (CLAUDE.md/docs optimization). Not relevant to this phase. `icm-architect` is a standing consult for room-structure / local-graph work; this phase touches neither room scaffolding nor `room-db.cjs`/`navigation.cjs` schema, so it does not bind here. Stated as a deliberate skip, not an oversight.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain selection (which frameworks, in what order) | **Local read-model** (`data/brain-orchestration-projection.json` via `local-chain-recommender.cjs`) | Local registry (`command-registry.json` via `composeWorkflow`) as floor | R7: the projection is the sanctioned Brain-derived read-model. Registry is the honest fallback when the projection has no edge. |
| Framework -> command resolution | **Local registry** (`command-resolver.cjs::composeWorkflow`) | none | R4: one governed resolver. Never re-implement. |
| Posture / autonomy (`run` vs `halt`) | **Local registry** (`recipe-maps.cjs::postureForCommand`) | none | Phase 237-02 measured 48/112 disagreements when a second authority existed; 12 material commands auto-ran. One authority, absolutely. |
| Per-turn reach ranking at `decide()` | **Local read-model** (`decide-projection-reader` + `orchestration-candidate-lift`) | Sensor bank | Already shipped. Out of scope for this phase. |
| Live Brain enrichment of an *explicit* invocation | **MCP tool handler** (`lib/mcp/tools/*.cjs`, `lib/mcp/brain-router.cjs`) | `brain-client.cjs::callTool` belt | This is the server-side-composition surface. Already in production; needs governing, not inventing. |
| Part 8 egress enforcement | **`brain-client.cjs::callTool`** (in-process, fail-CLOSED) | `scripts/part8-egress-guard-hook.cjs` (host PreToolUse, fail-OPEN) | Phase 234 D-04: enforce server-side, not via client hooks. The hook is defence-in-depth. |
| Chain execution with safe-halt | **`lib/core/chain-executor.cjs::runChain`** | none | Phase 166. Both `act` and `chain_run` already ride it. |

---

## Phase Requirements

**None assigned.** `.planning/ROADMAP.md` reads `**Requirements**: TBD` for Phase 254, and `grep` of `.planning/REQUIREMENTS.md` returns zero rows carrying a 254 requirement ID. The v2.1.0 requirement families in flight (`RECON`, `TRUST`, `FIX`, `CER`, `FLOOR`, `TAIL`, `SEED-A`, `SEED-B`, `CARRY`) are all graph-integrity work owned by Phases 258-263.

**Planner action required:** this phase needs its own requirement IDs minted before plans lock. Suggested family, derived from the findings below (the planner should ratify, not assume):

| Proposed ID | Behaviour |
|---|---|
| `WIRE-01` | `/mos:suggest-next` produces a multi-step chain sourced from the projection when the projection has edges for the seed. |
| `WIRE-02` | When the projection has no edge for the seed, the surface degrades to the current registry-composed answer with a disclosed source, never to empty. |
| `WIRE-03` | `/mos:act --chain` composes from the same source as `suggest-next`; the two cannot disagree. |
| `WIRE-04` | The three framework vocabularies (`KNOWN_FRAMEWORKS`, `command-registry.json`, the projection) can no longer silently diverge - a drift gate fails the build. |
| `COMP-01` | Every `mindrian-os`-named tool handler that reaches the Brain is enumerated in one place and routes through the `callTool` belt. |
| `COMP-02` | The `callTool` belt's verdict handling matches the hook's, or the divergence is a stated, tested decision. |

One requirement per behaviour, and `SEED-A` (Phase 263) is named in the ROADMAP as "a direct input into Phase 254's consumption-wiring work" - the planner should check 263's status before locking `WIRE-04`.

---

## 1. What "the real Brain orchestration projection" actually is

### 1.1 The artifact

| Property | Value | Source |
|---|---|---|
| Path | `data/brain-orchestration-projection.json` | [VERIFIED: read] |
| Size | 131,565 bytes, git-tracked | [VERIFIED: `ls -la`] |
| Nodes | **384** (113 command, 126 skill, 97 sub_mode, 28 framework, 14 agent, 6 reach) | [VERIFIED: executed against the artifact] |
| Edges | **73** (53 `OPERATES`, 16 `FEEDS_INTO`, 2 `CROSS_DOMAIN_ANALOGUE`, 1 `CHAINS`, 1 `PREREQUISITE`) | [VERIFIED: executed] |
| Nodes carrying a `ranking` block | 93 | [VERIFIED: executed] |
| Chain-usable edges (`FEEDS_INTO` + `CHAINS` + `PREREQUISITE`) | **18**, each with `confidence` (0.60-0.82) and a `transform` handle | [VERIFIED: executed] |
| Generator | `scripts/build-orchestration-projection.cjs` (Phase 157-02), 60,997 bytes | [VERIFIED: read] |
| Drift gate | `node scripts/build-orchestration-projection.cjs --check` -> `orchestration-projection: OK` **today** | [VERIFIED: executed 2026-09-02] |
| Gate wiring | `scripts/hooks/pre-commit:212`, `scripts/release.sh:291`, `scripts/doctor.cjs:1015` | [VERIFIED: grep] |
| `ontology_ref` | `data/connector-registry.json + data/command-registry.json` | [VERIFIED: read from the artifact] |

**Correction to the historical record, load-bearing:** several docs still describe the projection as 207 or 249 nodes. It is 384. More importantly, the artifact's own `ontology_ref` names its sources as two **local** registries. The generator makes zero Brain calls (BOG-09, asserted in its header and confirmed by grep: no `brain-client` require, no `fetch`, no `http`). The phrase "Brain-derived" in canon means *shaped after the projection the Brain may hold under Part 8 entry-19*, not *populated by querying the Brain*. This matters for Section 6.

### 1.2 What "~85% shipped, never wired" means concretely

Four named readers of the projection exist. Two are live; two are dark.

| Reader | Status | Evidence |
|---|---|---|
| `lib/core/reader/decide-projection-reader.cjs` (Phase 184) | **LIVE.** Called from `navigation-engine.cjs:1104` on every `decide()` turn. | [VERIFIED: read] |
| `lib/core/orchestration-candidate-lift.cjs` (Phase 191) | **LIVE.** Called from `navigation-engine.cjs:1131`. Lifts a gate-cleared projection candidate into a `fire_skill` + command recommendation for the F.7 dial, gated at the frozen `RECOMMENDED_CONFIDENCE_FLOOR = 0.7`. | [VERIFIED: read] |
| `lib/core/recipe-maps.cjs::rankedNextReach()` | **DARK BY DESIGN.** Its own docblock says: *"CONTRACT-ONLY reader... Do NOT wire it into the loop."* | [VERIFIED: read, `recipe-maps.cjs:34-43` and `:230-234`] |
| `lib/workflow/local-chain-recommender.cjs` (Phases 172-10 / 172-15) | **DARK, AND SHOULD NOT BE.** Its own header says *"suggest-next reaches for this."* `grep` across `lib/`, `scripts/`, `bin/`, `commands/` finds **zero production consumers** - only `tests/test-chain-transform-composition.cjs`. | [VERIFIED: grep + read] |

**So "~85% shipped, never wired" resolves to:** the projection has a full multi-hop chain recommender with earned per-edge confidence, multiplicative path composition, and per-hop transform descriptors - built, tested, gated, and consumed by nothing. **That is the gap. It is a wiring job, not a build job.**

### 1.3 Proof it works (executed this session)

```
lr.recommendMultiHopChains({from:'S-Curve Analysis', maxHops:3})
->  [S-Curve Analysis -> Adoption-Capacity Theory]          conf 0.82   transform maturity-to-adoption
    [S-Curve Analysis -> Dominant Design]                   conf 0.69   transform maturity-prereq-design (PREREQUISITE)
    [S-Curve Analysis -> Adoption-Capacity -> Mullins Model] conf 0.6314 (0.82 * 0.77, multiplicative)

lr.recommendMultiHopChains({from:'Domain Selection', maxHops:3})
->  [Domain Selection -> Scenario Planning]                 conf 0.68   transform domain-to-scenario
    [Domain Selection -> Scenario Planning -> Futures Wheel] conf 0.4488 transform chain preserved per hop
```
[VERIFIED: executed against the committed artifact, 2026-09-02]

### 1.4 What is missing to actually wire it

Three edits, none architectural:

1. `scripts/suggest-next-command.cjs:304` currently calls `recommender.recommendFrameworkChain(opts)`. It needs a projection-first source with the current call as fallback.
2. `scripts/act-command.cjs` composes the same way (it requires `chain-recommender.cjs` at line 46 and calls the same function). Same edit, same source, so the two cannot disagree.
3. A seed-resolution step: `recommendMultiHopChains` takes a **framework name**, and the projection's names are the registry's canonical PWS names. The current seed producer (`problem-type-router`) already emits canonical names (verified: `Beautiful Question Framework`, `Domain Selection`, `PWS Triple Validation Compass`). So no new resolver is needed - but see Section 2.4 for why one of those three seeds returns empty from the projection.

---

## 2. What `recipe-maps.cjs` currently does, and what "instead of recipe-maps.cjs alone" means

### 2.1 `recipe-maps.cjs` is not the chain source

The ROADMAP's phrasing is misleading and the planner should not build against it literally. `lib/core/recipe-maps.cjs` is a **read-only three-map joiner**, each map read for exactly one job:

| Function | Job | Reads | Used by |
|---|---|---|---|
| `postureForCommand(cmd)` | The ONE posture/autonomy authority (`run` / `halt`). Unknown command -> withhold-default `halt`, never a fabricated `autonomous_safe`. | `data/command-registry.json` via `command-resolver.validateChainAutonomy` | `act-command.cjs`, `chain-executor.cjs`, `lib/mcp/tools/chain.cjs`, `explore-chain.cjs`, `debate-composition.cjs` |
| `wiringForReach(id)` | reach -> surface wiring | `data/connector-registry.json` | dispatch targets |
| `rankedNextReach()` | ranked next-reach from the projection | `data/brain-orchestration-projection.json` | **nothing** (contract-only) |
| `recipeForCause(c)` | SENS-10 cause -> ordered command chain (4 causes) | frozen in-file `SENS10_CAUSE_RECIPES` | Phase 205 pipelining |
| `recipeForName(n)` | named pipeline -> ordered chain (`PWS_grading` only) | frozen in-file `NAMED_RECIPES` | Phase 229 |
| `loadManifest()` | declared harness descriptor | `data/harness-manifest.json` | Phase 167/201 |

[VERIFIED: full file read]

**Therefore:** `recipe-maps.cjs` supplies **posture**, and two small **hardcoded recipe tables**. It does not supply the chain for `suggest-next` or for `act --chain`.

### 2.2 What actually supplies the chain today

```
scripts/suggest-next-command.cjs:304   recommender.recommendFrameworkChain(opts)
scripts/act-command.cjs (same import)  recommender.recommendFrameworkChain(opts)
                                        |
                            lib/brain/chain-recommender.cjs
                                        |
              lib/core/problem-type-router.cjs  (seed)  +  lib/core/framework-chain-composer.cjs (successors)
                                        |
                            lib/workflow/command-resolver.cjs::composeWorkflow
                                        |
                            data/command-registry.json  ->  /mos: commands
```
[VERIFIED: read both scripts end to end]

### 2.3 The measured defect (this is the phase's real justification)

Executed live against the committed tree, 2026-09-02:

| Problem type | `recommendFrameworkChain` returns | Resolved workflow |
|---|---|---|
| `ill-defined` | `["Beautiful Question Framework"]` | 1 step |
| `undefined` | `["Domain Selection"]` | 1 step |
| `well-defined` | `["PWS Triple Validation Compass"]` | 1 step |
| (none) | `["Beautiful Question Framework"]` | 1 step |

**Every problem type yields a one-element chain.** `/mos:suggest-next`'s own body text promises *"the framework chain AND the step-numbered command sequence"* and `renderSequence()` is built to print `1. ... 2. ... 3. ...`. It structurally cannot.

**Root cause, measured:** `framework-chain-composer.cjs::KNOWN_FRAMEWORKS` is a hardcoded list of **18 generic strategy frameworks** (`SWOT Analysis`, `Porter Five Forces`, `Value Chain Analysis`, `Business Model Canvas`, `Blue Ocean Strategy`, `Innovator's Dilemma`, `7 S Framework`, `Balanced Scorecard`, `Design Thinking`, `5 Whys`, `First Principles`, ...). The registry and the projection carry **28 PWS frameworks** (`Ackoff Pyramid`, `Adoption-Capacity Theory`, `Reverse Salient Analysis`, `Usher's Model of Cumulative Synthesis`, ...).

**Overlap: 1 of 18.** Only `Lean Canvas` appears in both. Three more are near-miss aliases that do not string-match:

| Composer name | Registry / projection name |
|---|---|
| `Mullins` | `Mullins Model` |
| `Beautiful Question` | `Beautiful Question Framework` |
| `Jobs-to-be-Done` | `Jobs to Be Done (JTBD)` |

[VERIFIED: executed a set-diff against both sources]

So `proposeNextFramework` is walking a vocabulary that shares almost nothing with the seed it is given, finds no successor, and returns the seed alone. **This is a live, user-visible defect, not a theoretical improvement.**

### 2.4 Replace, or blend? BLEND. This is not a preference.

Running `recommendMultiHopChains` from each of the three seeds the problem-type router actually produces:

| Seed (from `problem-type-router`) | Projection result |
|---|---|
| `Domain Selection` (undefined) | 2 chains, up to 2 hops |
| `PWS Triple Validation Compass` (well-defined) | (has no outbound chain edge) |
| **`Beautiful Question Framework` (ill-defined AND the no-type default)** | **`[]` - empty** |

[VERIFIED: executed]

`Beautiful Question Framework` is the seed for the **two most common cases** (ill-defined, and the no-problem-type default) and it has zero outbound chain edges among the projection's 18. A straight replace would turn today's honest one-step answer into **nothing** for the majority of real invocations.

**So "instead of `recipe-maps.cjs` alone" should be read as:** *projection-first with a disclosed registry floor.*

```
1. Try local-chain-recommender.recommendMultiHopChains(seed)   -> multi-hop, earned confidence
2. If empty -> fall through to recommendFrameworkChain + composeWorkflow (today's answer)
3. Either way -> composeWorkflow resolves frameworks to /mos: commands (the ONE door, R4)
4. Either way -> recipe-maps.postureForCommand supplies run/halt (the ONE authority)
5. Disclose the source in the render, per Decision 8 (honest refusal / no silent degrade)
```

`recipe-maps.cjs` is **not replaced at all** - its posture job is untouched and must stay untouched. Only the chain-selection input changes.

### 2.5 The third vocabulary, and the drift gate this phase should add

There are now three framework vocabularies that can silently disagree:

| Source | Count | Authority |
|---|---|---|
| `framework-chain-composer.cjs` `KNOWN_FRAMEWORKS` | 18 | hardcoded in source |
| `data/command-registry.json` (distinct declared `frameworks:`) | 28 | generated from command frontmatter |
| `data/brain-orchestration-projection.json` framework nodes | 28 | generated from the registry |

The registry and the projection agree (the projection is generated from the registry, so `--check` already guards them). The composer agrees with neither and nothing catches it. The 2026-08-20 archaeology already named this: *"recipe-maps.cjs reconciliation: generate or verify it against the projection so the two taxonomies cannot drift (a `--check` gate in the 157 generator style)."* That is `WIRE-04`.

---

## 3. The server-side composition question

### 3.1 What it concretely means architecturally

The MindrianOS MCP server (`lib/mcp/`) runs **locally** on the user's machine over stdio (and optionally Streamable HTTP). It registers `mindrian-os`-named tools: `suggest_next`, `reach_candidates`, `framework_run`, `orchestration`, `chain_resolve`, `chain_run`, `gate_render`, and so on.

"Server-side composition" = **one of those handlers, at explicit invocation time, calls `lib/core/brain-client.cjs` internally** and folds the Brain's answer into its own response, rather than returning a bare local answer and leaving the model to issue a separate `mcp__mindrian-brain__brain_*` call.

The three seams are structurally different and the ruling should distinguish them:

| Seam | Who initiates | Hook sees it? | `callTool` belt sees it? |
|---|---|---|---|
| **A. Model-issued Brain tool call** (`mcp__mindrian-brain__brain_ask`) | The model, by name | **Yes** (matcher fires) | No (never touches `brain-client.cjs`) - this is **H3**, Phase 257's |
| **B. CLI script -> `brain-client.cjs`** | A `/mos:` command's helper script | No (no MCP tool call) | **Yes** |
| **C. `mindrian-os` handler -> `brain-client.cjs`** | A `mindrian-os` tool invocation | **No** (tool name is `suggest_next`, not `mcp__*brain*`) | **Yes** - this is **H1**, Phase 254's |

### 3.2 SEED-053, and why it precedents this as Part-8-clean

`SEED-053` (`.planning/seeds/SEED-053-methodology-chain-as-mcp-tool-with-handoffs.md`, registered 2026-07-06) proposed exposing methodology chaining as a first-class MCP tool. It carries a **load-bearing Part 8 clarification** written specifically to correct a mid-conversation overstatement:

> *"the MindrianOS MCP server is LOCAL (stdio, runs on the user's machine, reads the local room). Exposing a chain-runner tool there is Part-8-CLEAN - the wall only bites on the eventual REMOTE Brain lift (SEED-014), where only generic framework handles cross. There is no Part 8 obstacle to this seed on the local server."*

Its Canon compliance section adds: *"The only Brain touch is the OPTIONAL `recommendFrameworkChain` leg (generic handles), which already honors the boundary."*

**The argument in one line:** Part 8 forbids *user content crossing to the Brain*. It does not forbid *a local process calling the Brain*. A local MCP handler is the same trust position as a local CLI script (seam B), which has always been sanctioned. **The seam is not the violation; the payload is.**

SEED-053 shipped as `chain_run` / `gate_answer` (confirmed in `222-SPEC.md:298`).

### 3.3 THE FINDING THE NAVIGATOR MOST NEEDS: this already ships, twice

Running the 2026-08-20 handoff's own Section 4.3 re-verification command this session:

```
$ git grep -n "brain-client" -- lib/mcp bin/mindrian-mcp-server.cjs
lib/mcp/brain-router.cjs:272:    brainClient = require('../core/brain-client.cjs');
lib/mcp/brain-router.cjs:414:    const brainClient = require('../core/brain-client.cjs');
```
[VERIFIED: executed 2026-09-02]

**Site 1 - `orchestration` tool, `act*` commands.** `lib/mcp/tool-router.cjs:1460-1462`:

```js
// Brain-driven act* commands use brain-router
if (command === 'act' || command === 'act-chain' || command === 'act-dry-run' || command === 'act-swarm') {
  const brainRouter = require('./brain-router.cjs');
  const rec = await brainRouter.recommend(roomDir, { intent: context || 'general' });
```

`brain-router.cjs` is a 3-tier router whose **Tier 3 is a live `brainClient.ask()` call with a 2s hard timeout** (`brainRoute()`, line 268-292). Its own header says: *"Called by orchestration router for act*, suggest-next commands."* [VERIFIED: read]

**Site 2 - `suggest_next` tool.** `lib/mcp/tools/sensors.cjs:196-201`:

```js
let chainOffer = null;
try {
  chainOffer = top ? await chainRecommender.chainOfferForReach(top, {}) : null;
} catch (_e) { chainOffer = null; }
```

`chainOfferForReach` (`lib/brain/chain-recommender.cjs:594`) calls `brainClient.recommendChain(problemType)` - a live Brain call - when the top reach carries a `brain_framework_chain` companion. Shipped by Quick `260819-c8j` (commit `5278e9cb`, 2026-08-19). Its own connector declaration says so in `hitl_why`: *"it may now make ONE optional read-only Brain call."* [VERIFIED: read]

**Consequence for the ruling.** The question on the table is no longer *"should we introduce server-side composition."* It is:

- **Ratify** - name both existing sites, put them under one governed enumeration, close the residual belt gap (3.4), and let this phase add a third site knowingly; **or**
- **Reject** - which means **removing two shipped, tested, released behaviours** (`orchestration act*` Tier 3, and `suggest_next`'s chain offer), not merely declining to add a third.

Rejecting is a real option and is not obviously wrong (it is the cleanest possible Part 8 story), but the navigator should rule knowing it is a **removal decision with a blast radius**, not a decline.

### 3.4 The 239-05 belt: shipped, and the ONE gap that remains

**The ROADMAP's prerequisite claim is stale.** Plan `239-05` completed **2026-07-30** (`239-05-SUMMARY.md`: *"raw-field classify-first Part 8 egress guard in `hatAwareRecommend()` and `suggestValidationSteps()`, both fail-closed and disclosed"* plus a labelled `query()` backstop).

**And it was superseded by something stronger.** Quick `260819-c8j` (commit `ca32b612`) added the belt at the **single dispatch seam**, `brain-client.cjs::callTool()` line 527:

```js
const callToolEgressGuard = require('./part8-egress-guard.cjs');
const callToolEgressVerdict = callToolEgressGuard.classify(args, { toolName: toolName });
if (callToolEgressVerdict && callToolEgressVerdict.verdict === 'block') {
  return { error: 'egress_blocked', tool: toolName, egress_class: ... };
}
```

Placement is deliberate and documented: **after** the key gate (so the no-key `null` contract is byte-unchanged) and **before** `_ensureSession` (so a blocked payload opens no socket at all). *"One guard in one function covers all 16 wrappers."* [VERIFIED: read `brain-client.cjs:502-540`]

There are now **five** classify sites in `brain-client.cjs` (lines 528, 782, 1146, 1260, 1941). Every server-side composition path - both existing sites and any this phase adds - flows through `callTool`, so it is already belted.

**The residual gap, and it is the only one:**

| Verdict | `part8-egress-guard-hook.cjs` (host PreToolUse) | `brain-client.cjs::callTool` belt |
|---|---|---|
| `block` | exit 2 (blocks) | returns `egress_blocked` sentinel (blocks) |
| **`ambiguous`** | **exit 2 + renders a Shape F.1 gate** (Reformulate / Cancel, no send-anyway) when Brain is available | **passes through silently** |
| `allow` | exit 0 | proceeds |
| internal error | **fail-OPEN** (exit 0, A3 accepted risk) | fail-open (degrade to existing behaviour) |

[VERIFIED: read both files side by side]

So the ROADMAP's phrase *"server-side calls bypass the per-tool-call egress-guard hook's name-matching"* is **correct in mechanism but wrong about the consequence it implies**. Server-side calls do bypass the hook's name matching - the hook matches `mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*` and a `suggest_next` invocation carries none of those tokens. But the belt underneath already catches the `block` case. **What genuinely gets lost is the `ambiguous` -> human gate.** A payload the classifier cannot confidently clear gets a navigator gate on the model-issued path and silently proceeds on the server-side path.

**Planner guidance:** this is a small, well-shaped, testable task, not a same-phase architectural prerequisite. Two honest options:

- **Option A (recommended):** make the belt disclose-and-proceed on `ambiguous` - attach a typed disclosure to the response (the `refusal-messaging.cjs` / `brain_refusal` idiom `brain-router.cjs:414-422` already uses) so the navigator sees it, without inventing an elicitation path inside a stateless server handler.
- **Option B:** make the belt fail-closed on `ambiguous` too. Simpler and stricter, but changes the behaviour of 16 wrappers at once and risks false blocks on the hot path. Needs its own canary suite before anyone considers it.

Do **not** attempt to render a Shape F.1 gate from inside `callTool`. The MCP layer already has the correct machinery for that (`lib/mcp/gate-render.cjs::renderGate`, used by `framework_run` at `sensors.cjs:354`); a gate belongs at the handler, not at the transport chokepoint.

### 3.5 The tradeoff, laid out for the ruling

**If APPROVED (ratify what ships, add knowingly):**

| Pro | Con |
|---|---|
| Matches Phase 234 D-04 ("enforce governance server-side, not via client hooks") - the enforcement point moves *toward* the belt, which is host-independent. | Widens the surface Theo's cutover must adapt (though `chain-recommender.cjs` is already on Theo's 7-file list - see 5.3). |
| Works on hosts with no MCP hook surface (Codex CLI fires PreToolUse for Bash only; ChatGPT connectors have no hook surface at all). The belt is the only enforcement there. | Puts a network call inside a tool invocation's latency budget. `brain-router` bounds it at 2s; `chainOfferForReach` is one call per pull on the top pick only. Any new site must state its bound. |
| SEED-053's Part 8 reasoning is explicit and canon-checked. | Phase 262's D-07 clean-projection finding **does not cover** a live-Brain path (Section 6). A new live call re-opens the 71-corrupted-name exposure. |
| No removal of shipped behaviour. | The `ambiguous` gap (3.4) must be closed in the same phase, or the phase ships a knowingly weaker gate on the growing path. |
| The projection-consumption half is **entirely local** and needs no live call at all - approving composition does not couple the two. | Two ungoverned sites become three governed sites; someone has to own the enumeration (`COMP-01`). |

**If REJECTED (server-side composition is not sanctioned):**

| Pro | Con |
|---|---|
| Cleanest possible Part 8 story: every Brain call is either model-issued (hook-visible) or CLI-script-issued (belt-visible), and no MCP handler hides one. | **Requires removing two shipped behaviours**, both released and tested: `orchestration act*` Tier 3, and `suggest_next`'s `chain_offer`. |
| Removes the `ambiguous`-gap exposure entirely rather than patching it. | Removing `suggest_next`'s chain offer regresses the hookless-surface path Quick `260819-c8j` was built to serve - Desktop and Cowork have no hooks, so they lose their only Brain-grounded next-move enrichment. |
| Simplifies the Theo cutover surface. | Contradicts Phase 234 D-04's already-ruled direction. |
| | Does **not** block this phase's primary work: the projection-consumption half is local-only and unaffected either way. |

**The decoupling that makes the ruling safe to take either way:** the chain-wiring work (Sections 1-2) reads a local JSON file and makes **zero** Brain calls. It is R7-clean, Part-8-clean, and Theo-neutral under either ruling. The planner should structure the phase so the wiring work is Wave 1 and the composition ruling gates only a later wave.

---

## 4. R7, and whether this phase touches `decide()`

### 4.1 What R7 says, verbatim

`docs/MINDRIAN-CANON.md:486` (Part 11, CIRS):

> **R7** Local-only at decide/rank - the projection is a derived read-model (control plane) with source-version + per-room checkpoint + freshness markers; restates LOCAL -> BRAIN: NO; opens no wire.

Restated by SEED-045's blocking constitutional correction:

> *"The advisor reads a LOCAL DERIVED CACHE, NEVER a live Brain query at decide()/rank time. This is non-negotiable."*

And by R4 (same section): *"invocation resolves through `dispatchSensors` -> `decide()` -> resolver; no second selection brain."*

### 4.2 Where `decide()` lives, and what it already does with the projection

`lib/core/navigation-engine.cjs:876`, `function decide(turn, context)`. [VERIFIED: read]

The projection is already consumed there, twice, before any return path:

- **line 1102-1116:** `projectionReader.offerProjectionCapabilities(...)` - the Phase 184 READER. Its header: *"Part 8: the projection is a LOCAL derived machinery cache (a local file read); ZERO Brain read/write, ZERO network."*
- **line 1129-1143:** `candidateLift.liftFiringCandidate(...)` - the Phase 191 lift. Its header: *"R2/R7 (Part 8): pure, synchronous, LOCAL-only. This module opens no db, forms no Brain packet, performs no network I/O."*

Both are wrapped in `try/catch` that degrades to `null` and never throws out of `decide()`.

### 4.3 Confirmation: the planned work does not touch that path

**Confirmed, on four independent grounds:**

1. **`suggest-next` never calls `decide()`.** `scripts/suggest-next-command.cjs` requires exactly five modules: `chain-recommender`, `command-resolver`, `f-selector-ranker`, `selector-dispatcher`, `jtbd-taxonomy.json`, plus a lazy `navigation.cjs` for best-effort telemetry. No `navigation-engine` require exists in the file. [VERIFIED: read full file]
2. **`act` calls `decide()` but only as `runChain`'s `decideFn`** (Phase 172-08, `act-command.cjs:76-88`). Its own comment: *"decide() reads LOCAL context only and opens no new Brain wire (Canon Part 11 R7 / Part 8: feeding decide() as decideFn opens no Brain egress)."* The change proposed here is to `act`'s **chain composition** (which happens before `runChain` is called), not to the per-step `decideFn`.
3. **`local-chain-recommender.cjs` is R7-clean by construction.** Its header: *"LOCAL-ONLY (INV-12 / R7): the recommender reads ONLY committed local files... There is no brain-client require, no fetch, no http."* Confirmed by grep. Wiring it into a command helper adds no wire.
4. **Server-side composition happens at explicit invocation time, not at `decide()`/rank time.** The 2026-08-20 archaeology already drew this line: *"the open architectural question is ONLY whether an EXPLICIT suggest-next/act invocation (command-time, not per-turn) or a server-side MCP tool composition may make a live call."* Command-time is a different seam from `decide()`-time and R7 does not reach it.

**Planner fence to write into the plans:** no plan in this phase may add a file to `lib/core/navigation-engine.cjs`'s `files_modified`, and no plan may add a `brain-client` require to any module reachable from `decide()`. A structural grep test (shaped like `tests/test-reader-r4-structural-184.cjs`) should assert this.

---

## 5. Theo forward-compatibility

**Verdict: the projection-consumption half has NO Theo-side analog and needs none. The server-side-composition half DOES have one, and it is already accounted for on Theo's adaptation list.** Stated plainly, per the standing rule.

### 5.1 Theo has no orchestration-projection concept, and that is a recorded decision

`/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts` names this repo's artifact by path and records the decision not to sync it:

> *"The contract's fourth input, `pattern_known`, reads a PLUGIN-SIDE artifact in the real Brain: `data/brain-orchestration-projection.json` (380 nodes, 73 edges, git-tracked)... **THAT PROJECTION IS NOT SYNCED INTO THEO IN PHASE 9.** Decided in `09-04-PLAN.md`'s objective... the score's inputs come from LIVE THEO QUERIES ONLY, and an input whose backing layer is absent contributes 0 with the absence visible in the payload rather than hidden in it."*

Theo answers `pattern_known` from its own live `orchestration_status` property instead, and emits `unsynced_inputs: ['pattern_known']` unconditionally so a caller can tell an unsynced zero from a genuine zero. [VERIFIED: read `orchestration-readiness.ts`, lines 1-50 and 300-400]

`09-04-SUMMARY.md` confirms: *"The plugin-side orchestration projection is not synced this phase."*

**Consequence:** the projection stays plugin-side, local, and Brain-independent under Theo exactly as it is today. **Wave 1 of this phase (the chain wiring) is a zero-diff surface at cutover.** Nothing to adapt, nothing to rediscover.

*(Note: Theo's header says 380 nodes; the artifact measures 384 today. A 4-node drift since Theo's 2026-08-31 re-measurement. Immaterial to the decision, worth not repeating a stale number.)*

### 5.2 Theo HAS a server-side composition analog, and it is more advanced than this repo's

Theo's Phase 05 "Operational Tool Absorption" already relocated five operational tools server-side: `src/mcp/operational/` contains `chain-run.ts`, `gate-render.ts`, `gate-answer.ts`, `room-bind.ts`, `graph-write.ts`. [VERIFIED: `ls`]

`chain-run.ts`'s header states the governing pattern, which this phase should read as a design constraint rather than a curiosity:

> *"THEO OWNS THE SCHEMA AND THE WIRE SHAPE. THE PLUGIN OWNS THE BEHAVIOUR... Theo re-declares the two-key input schema in zod 4 and returns through the one delegation seam; everything in between is the plugin's own captured handler closure, which wraps the plugin's own shipped chain executor. Theo mints no second executor."*

And, load-bearing for `WIRE-04` and for the posture authority:

> *"THEO CLASSIFIES NO COMMAND'S AUTONOMY. Not here, not anywhere. There is exactly ONE authority for 'may this step run unattended', it lives in the plugin's recipe maps... 05-RESEARCH.md records the measurement from the plugin's own Phase 237-02: when a second authority existed, 48 of 112 commands disagreed with the first, and 12 MATERIAL commands auto-ran as a result."*

**So Theo's own architecture already ratifies exactly the shape this phase's server-side composition would take** - a server-side handler composing over the plugin's shipped engines, with the plugin retaining sole authority over posture. That is a strong independent argument for the APPROVE side of Section 3.5.

### 5.3 The one file that changes, and it is already on Theo's list

Theo's 7-file plugin adaptation list (from `262-RESEARCH.md`, sourced from Theo's `09-MOS-LEARNING.md`):

`scripts/probe-brain-contract.cjs`, **`lib/brain/chain-recommender.cjs`**, `lib/core/enrichment-queue.cjs`, `bin/mindrian-brain-mcp-client.cjs`, `lib/core/resolve-brain-key.cjs`, `data/brain-surface-contract.json`, `BRAIN_TOOL_MATCHER`/`hooks/hooks.json`.

`chain-recommender.cjs` is the exact module `suggest_next`'s server-side composition runs through. Theo's learning doc names the change precisely:

> *"`lib/brain/chain-recommender.cjs` - Consumes the incumbent's frozen `recommend_chain` v1 payload. Theo's is `{problem_type, chain, evidence, coverage}` with a `refusal` block on the unknown-type path. The unknown-type guarantee is preserved in spirit and more honestly."*

**Two Theo-side facts this phase must not be surprised by:**

1. **`brain-router.cjs` is NOT on the list.** Its Tier 3 calls `brainClient.ask()` and reads `brainResult.next_gate.options[]`. Theo's `brain_ask` returns *"structured rows, never composed prose"* with two modes and three curated ops. **`next_gate` is an incumbent-only shape.** After the flip, `brain-router`'s Tier 3 will silently return null and fall through to Tier 2, with the `brain_refusal` disclosure not firing (because `isAvailable()` is still true). This is a **new, unlisted, uncovered consumer** - the same class of finding Phase 262 made about `check-flagship-floor.cjs`. **This phase should get `lib/mcp/brain-router.cjs` added to Theo's adaptation list**, which is a message to Theo's session, not a code change.
2. **`BRAIN_PROBLEM_TYPE_ALIASES` is already known-broken post-flip.** `recommend-chain.ts` names it: this repo's aliases project onto the incumbent's `'Undefined Problem'` / `'Ill-Defined Problem'` / `'Well-Defined Problem'`, and *"NONE of those three is a live Theo `DomainConcept` id"* (Theo's are `UnDefined`, `IllDefined`, `WellDefined`, `Wicked`, `Trinity`, `Compass`). Theo returns the honest-empty answer rather than an error. Theo's `deferred-items.md` carries it as **named plugin-side work**. If this phase touches the problem-type seed path at all, re-pointing those aliases is cheap to do now and expensive to rediscover later.

### 5.4 Answer to the standing rule, in one sentence

**The composition work targets a surface Theo will also need adapting** (`chain-recommender.cjs`, already listed; `brain-router.cjs`, *not* listed and this phase should get it added), **while the projection-consumption work targets a surface Theo has explicitly decided never to touch** - so the eventual flip is a small, enumerated diff on the composition half and a zero diff on the wiring half.

---

## 6. Is Phase 262's D-07 finding sufficient?

**Yes for the projection-consumption half. Conditionally no for the server-side-composition half.** 262's own gap ledger already says exactly this, and it is worth honoring rather than re-measuring.

### 6.1 What 262 measured

`docs/262-FLOOR-01-GAP-LEDGER.md` section 5 ("The D-07 Finding"), and `tests/test-262-sep-projection-probe.cjs`, measured against the committed artifact on 2026-09-02:

> *"the projection carries **0** `<SEP>` occurrences and exactly **28** framework nodes, every one of the 28 ratified floor names present byte-exact with `methodology_tier === 'pws'`."*

Its stated mechanism:

> *"the projection is a Brain-DERIVED LOCAL cache (BOG-09), with no live Brain read anywhere in its generator. A corrupted `name` on a Brain `:Framework` node (the 71 `<SEP>`-corrupted nodes, including the two phantoms 28757 and 28775 that break floor rows 1 and 2) has no path into the committed projection file, because nothing in the generator re-reads the live Brain at build time."*

Its explicit recommendation to this planner:

> *"Phase 254's projection consumption is measurably unaffected by the 71 corrupted names (0 occurrences in the artifact it actually reads), so 254 does not need to wait on FLOOR-01's remaining 8 rows."*

### 6.2 Independent re-confirmation this session

Rather than trust the summary, I re-measured directly against `data/brain-orchestration-projection.json`:

- 28 framework nodes, names enumerated: `Ackoff Pyramid | Adaptive Leadership | Adoption-Capacity Theory | Beautiful Question Framework | Domain Selection | Dominant Design | Four Lenses of Innovation | Futures Wheel | HSI Semantic Surprise Analysis Assistant | Hypothesis-Driven Problem Solving | Jobs to Be Done (JTBD) | Knowns and Unknowns Matrix Framework | Lean Canvas | MECE (...) | Mullins Model | PEST Analysis | Problem Definition Transformation Framework | PWS Triple Validation Compass | PWS Value Proposition | Red Teaming | Reverse Salient Analysis | Root Cause Analysis | S-Curve Analysis | Scenario Planning | Six Thinking Hats | Systems Thinking | The Pyramid Principle | Usher's Model of Cumulative Synthesis`
- Zero control-character / `<SEP>` / replacement-character matches.
- `node scripts/build-orchestration-projection.cjs --check` -> `orchestration-projection: OK`.
- The generator contains no `brain-client` require, no `fetch`, no `http`.
[VERIFIED: executed 2026-09-02]

### 6.3 The condition, and why it binds Section 3 to Section 6

262's ledger carries an honest scope limit:

> *"Honest scope limit: this answers the PROJECTION half of D-07 only. Phase 255's section-affinity ranking may read the live Brain directly rather than the committed projection, and that half is NOT covered by this measurement."*

**The same limit applies to Phase 254 the moment server-side composition is approved.** A `suggest_next` handler that calls `brainClient.recommendChain()` reads the **live** `:Framework` population, where the 71 corrupted names and the hop-depth-1 `ALIAS_OF` fork (262's traced defect: `normalize_framework_name({raw:'Scenario Planning'})` returns **2** "canonical" matches) are still present.

**Ruling for the planner:**

| Scope | Fresh measurement needed? |
|---|---|
| Wave 1 - projection consumption (local file read only) | **No.** 262's D-07 covers it, re-confirmed above, dated 2026-09-02. |
| Server-side composition wave (if approved) | **Yes.** One targeted probe: for each framework name a live composed call can return, assert it round-trips clean through `normalizeFrameworkName` without the alias fork. `chain-recommender.cjs` already has a `normalizeFrameworkName` retry leg to build on. |

---

## 7. Existing test and verification patterns to reuse

### 7.1 The aggregator convention

`bash tests/run-all-<phase>.sh`. The current best template is `tests/run-all-262.sh` (read this session). Its properties, all of which this phase should copy verbatim:

- **Glob discovery, not a list.** Globs `tests/test-262-*` (both `.cjs` and `.sh`). Adding a test file requires no runner edit.
- **The mandatory tests are still enumerated in the header comment**, so a missing one is visible by reading, even though the glob does the discovery.
- **A `found -eq 0` guard that FAILS.** *"A harness that discovers nothing must FAIL, not print green."* Provable without editing the file via a `TEST_262_PREFIX` override.
- **A no-em-dash fence** sweeping every file the phase touches, via `grep -P '\x{2014}'` (codepoint escape, so the runner does not trip its own sweep).
- `set -uo pipefail`, `cd` to repo root, bash only.

### 7.2 Test-file convention

Plain CJS, `node:assert`, no framework. Filename `tests/test-254-<slug>.cjs`. Some suites live under `lib/memory/*.test.cjs` and are registered in `lib/memory/run-feynman-tests.cjs` (the Feynman runner) - the newer convention is `tests/`.

### 7.3 Specific suites to model on

| Need | Model | Why |
|---|---|---|
| Prove a module makes **no** Brain call | `tests/test-recipe-maps-authority.cjs` (forbidden-token scan) and `tests/test-chain-executor-part8-leak.cjs` | Both already prove a clean surface by grepping executable source. |
| Prove `decide()` is untouched | `tests/test-reader-r4-structural-184.cjs` (READER-04 structural proof) | Proves "reader, never firer" by structure rather than by behaviour. |
| Egress proof with a real wire | `tests/test-239-query-egress-canary.cjs` + `tests/helpers/brain-capture-server.cjs` | The 7-leg canary with a live mutation leg. Section 5 of the 2026-08-20 handoff mandates modelling on it. |
| Locked-invariant test over handlers | `lib/mcp/no-instructions.test.cjs` | The named shape for "every Brain MCP tool handler routes through the guard" (`COMP-01`). |
| Projection reader behaviour | `tests/test-chain-transform-composition.cjs` | Already exercises `recommendMultiHopChains`; extend rather than duplicate. |
| Guard-census classification | `tests/test-252-guard-census.cjs` | **Trap:** census.1 fails the build for any UNCLASSIFIED file containing an executable `isAvailable(`/`ensureAvailable(` call. If this phase adds a guard call to a new file, that file must be classified first. `sensors.cjs` deliberately avoids the call for exactly this reason (`sensors.cjs:44-48`). |

### 7.4 Gates that must stay green

```bash
node scripts/build-orchestration-projection.cjs --check   # currently: OK
node scripts/build-connector-registry.cjs --check
node scripts/check-render-coverage.cjs
node scripts/check-substrate.cjs --diff                   # the pre-commit substrate trap
node scripts/doctor.cjs --acceptance
scripts/verify-release
```

**The substrate trap, named explicitly** (it bit 239-05): `brain-client.cjs` is **not** on `check-substrate.cjs`'s `ALLOWED_DIRECT_IMPORT` list. Adding a `roomDir`-to-db opener inside it trips the pre-commit guard. The sanctioned disclosure idiom is `_logEventBestEffort(options.db, ...)` with an optional caller-supplied handle, scalars only.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:assert` + `node:test` where used; no external runner. Node >= 22.16.0. |
| Config file | none (by design - CJS scripts, bash aggregators) |
| Quick run command | `node tests/test-254-<slug>.cjs` |
| Full suite command | `bash tests/run-all-254.sh` |
| Aggregator template | `tests/run-all-262.sh` (glob discovery + `found -eq 0` guard + no-em-dash fence) |

### Phase Requirements -> Test Map

Requirement IDs are proposed, not yet minted (see Phase Requirements section).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIRE-01 | `suggest-next` returns a multi-hop chain when the projection has edges for the seed | unit | `node tests/test-254-projection-chain-source.cjs` | Wave 0 |
| WIRE-02 | Empty projection result degrades to the registry answer with a disclosed source, never to empty | unit | `node tests/test-254-degrade-floor.cjs` | Wave 0 |
| WIRE-03 | `act --chain` and `suggest-next` compose from one source (no divergence) | integration | `node tests/test-254-one-chain-source.cjs` | Wave 0 |
| WIRE-04 | The three framework vocabularies cannot silently diverge | gate | `node scripts/build-orchestration-projection.cjs --check` extended, or a new `tests/test-254-vocabulary-drift.cjs` | Wave 0 |
| R7-fence | No module reachable from `decide()` gains a Brain require; `navigation-engine.cjs` byte-unchanged | structural | `node tests/test-254-r7-structural-fence.cjs` | Wave 0 |
| COMP-01 | Every `mindrian-os` handler reaching the Brain is enumerated and belted | structural | `node tests/test-254-composition-census.cjs` | Wave 0 |
| COMP-02 | `ambiguous` verdict on the server-side path is disclosed, not silent | integration (live wire) | `node tests/test-254-ambiguous-disclosure.cjs` (reuses `tests/helpers/brain-capture-server.cjs`) | Wave 0 |
| Regression | `suggest-next` / `act` existing suites stay green | integration | `node lib/memory/suggest-next-workflow.test.cjs`, `node tests/test-act-on-runchain.cjs`, `node tests/test-act-cross-class-chain.cjs` | **Exists** |

### Sampling Rate

- **Per task commit:** the single `node tests/test-254-<slug>.cjs` for the task, plus `node scripts/build-orchestration-projection.cjs --check` (already a pre-commit hook, so it runs whether or not the task remembers).
- **Per wave merge:** `bash tests/run-all-254.sh` plus the three existing regression suites named above.
- **Phase gate:** `bash tests/run-all-254.sh` green, `node scripts/doctor.cjs --acceptance` green, `scripts/verify-release` green, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/run-all-254.sh` - the glob aggregator (copy `tests/run-all-262.sh`'s structure, including the `found -eq 0` guard and the no-em-dash fence)
- [ ] `tests/test-254-projection-chain-source.cjs` - WIRE-01
- [ ] `tests/test-254-degrade-floor.cjs` - WIRE-02
- [ ] `tests/test-254-one-chain-source.cjs` - WIRE-03
- [ ] `tests/test-254-vocabulary-drift.cjs` - WIRE-04
- [ ] `tests/test-254-r7-structural-fence.cjs` - the R7 fence (model on `tests/test-reader-r4-structural-184.cjs`)
- [ ] `tests/test-254-composition-census.cjs` - COMP-01 (model on `lib/mcp/no-instructions.test.cjs`)
- [ ] `tests/test-254-ambiguous-disclosure.cjs` - COMP-02, **only if server-side composition is APPROVED**
- Framework install: none needed. `node:assert` + bash, already in use.

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Brain API key resolution ladder (`lib/core/resolve-brain-key.cjs`). This phase changes nothing there. |
| V3 Session Management | no | `_ensureSession` caches a validated-key marker with a 5-min TTL; untouched. |
| V4 Access Control | yes | The tier gate (HTTP 403 -> `tier_denied` sentinel) is the moat's authorization boundary. Any new composed call inherits it. Must not be bypassed or swallowed. |
| V5 Input Validation | yes | `zod` `z.strictObject` schemas on every MCP tool input (`sensors.cjs` uses `z.string().max(4000)`, `z.string().regex(/^[a-z0-9-]+$/)`). Any new tool parameter must carry a bound. |
| V6 Cryptography | no | `lib/core/correlation.cjs` is the single sha256 chokepoint; never hand-rolled, never touched here. |
| V-custom: **Canon Part 8 egress** | **yes, primary** | `lib/core/part8-egress-guard.cjs::classify()` at the `callTool` chokepoint + `scripts/part8-egress-guard-hook.cjs` as defence-in-depth. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User content leaking to the Brain via a composed handler | Information Disclosure | Classify the **raw** field before sanitize and before interpolation (the 239-05 pattern), plus the `callTool` belt. Two measured laundering vectors exist: the template's own word `Framework` reclassifies an embedded canary from `ambiguous` to `allow`, and `sanitizeCypherInput` strips the `@` the PII pattern keys on. |
| Cypher injection via an interpolated caller value | Tampering | `sanitizeCypherInput` + parameterized `$seed` bindings. Never interpolate a raw user string. |
| A second posture authority auto-running a material step | Elevation of Privilege | ONE authority (`recipe-maps.postureForCommand`). Measured cost of violating this: 48/112 commands disagreed, 12 material commands auto-ran (Phase 237-02). |
| Fire-and-forget chain execution bypassing the human gate | Elevation of Privilege | `runChain` auto-runs the `autonomous_safe` prefix only and HALTS at the first material step. A halt is a success, never an error. |
| Silent degrade concealing a Brain failure | Repudiation | Decision 8 (honest refusal everywhere): `null` is the transport-failure signal; a constitutional refusal is a **sentinel object** (`egress_blocked`, `tier_denied`, `invalid_key`), never `null`. Conflating them makes the refusal invisible. Preserve this distinction in any new path. |
| Host without an MCP hook surface (Codex CLI, ChatGPT connectors) | Bypass | The in-process `callTool` belt is host-independent and is the only enforcement on those hosts. This is the core argument of Phase 234 D-04 and of Section 3.5's APPROVE column. |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-hop chain composition with confidence | A new path walker | `lib/workflow/local-chain-recommender.cjs::recommendMultiHopChains` | Shipped, tested (`tests/test-chain-transform-composition.cjs`), mirrors the verified Brain SPFO model (`reduce(c=1.0, r \| c * coalesce(r.confidence, 0.5))`). Zero consumers is a wiring gap, not a quality signal. |
| Framework -> `/mos:` command resolution | A slug mapper | `lib/workflow/command-resolver.cjs::composeWorkflow` | R4: the SOLE door. `commandsForFramework` never touches the Brain (grep-guarded in its own header). |
| Run/halt posture | A safe-command list | `lib/core/recipe-maps.cjs::postureForCommand` | Measured: 48/112 disagreements and 12 material auto-runs when a second authority existed. Theo's `chain-run.ts` refuses to mint one for the same reason. |
| Chain execution with a human gate | A step loop | `lib/core/chain-executor.cjs::runChain` | Phase 166. `act` was the donor it was extracted from; `act` owns no loop today and must not regrow one. |
| Rendering a next-move selector | A bespoke `AskUserQuestion` payload | `lib/hmi/shape-f1-renderer.cjs::renderShapeF1` via `lib/hmi/selector-dispatcher.cjs::pickShape` | `commands/suggest-next.md:124` explicitly forbids hand-building the JSON. Free-Text is appended automatically; never suppress it. |
| Part 8 classification | A regex on the payload | `lib/core/part8-egress-guard.cjs::classify()` | Two measured laundering vectors defeat the naive version. Do not change what `classify()` does - it is consumed across `lib/`. |
| Rendering a gate from an MCP handler | A bespoke options block | `lib/mcp/gate-render.cjs::renderGate` | The shipped ladder (elicitation -> thin adapter -> headless text) used by `framework_run` and `gate_render`. |
| Reading room.db from a helper script | `require('node:sqlite')` | `lib/core/navigation.cjs` | Part 9 chokepoint. Neither `suggest-next-command.cjs` nor `brain-client.cjs` is on `check-substrate.cjs`'s `ALLOWED_DIRECT_IMPORT` list; a direct import trips pre-commit. |

**Key insight:** this phase's failure mode is not building the wrong thing. It is **building a second thing that already exists** - a second chain recommender, a second posture table, a second projection reader. Every one of those has a shipped owner and a test that fails the build if a rival appears. Canon Part 7 is not advisory here; it is enforced in CI.

---

## Common Pitfalls

### Pitfall 1: Believing the SEED-045 / ROADMAP text over the code
**What goes wrong:** the plan re-implements "wire `decide()` to consume the projection," which shipped in Phases 184 and 191.
**Why it happens:** SEED-045 is dated 2026-07-01 and lists it as open item 1; the ROADMAP entry copied that framing forward.
**How to avoid:** read `navigation-engine.cjs:1091-1143` before writing any task touching `decide()`.
**Warning signs:** a plan task named "add a projection read to decide()".

### Pitfall 2: Treating server-side composition as a greenfield decision
**What goes wrong:** the ruling is taken as "decline to add," when rejecting actually means **removing two shipped behaviours**.
**Why it happens:** the ROADMAP describes it as an "option."
**How to avoid:** put Section 3.3's two sites in front of the navigator before asking for the ruling.
**Warning signs:** a ruling recorded as "not approved, no action needed."

### Pitfall 3: A straight replace of `recommendFrameworkChain`
**What goes wrong:** the two most common invocation paths (ill-defined, and no-problem-type) go from a one-step answer to **empty**, because `Beautiful Question Framework` has no outbound projection edge.
**Why it happens:** the projection looks richer in aggregate (18 chain edges) so replacing feels strictly better.
**How to avoid:** blend. Projection first, registry floor, disclosed source. `WIRE-02` exists to catch this.
**Warning signs:** a test that only asserts the happy path from `S-Curve Analysis`.

### Pitfall 4: Citing 239-05 and concluding Part 8 is closed
**What goes wrong:** the record says "Part 8 enforcement is now in code," which is true for H1 and H2 and **false for H3**.
**Why it happens:** the belt genuinely is comprehensive at the `callTool` seam, and H3's path never touches `brain-client.cjs`.
**How to avoid:** this phase's summary must state explicitly which of H1/H2/H3 it closed. The 2026-08-20 handoff names this trap by name (section 2) and Phase 257's ROADMAP entry repeats it.
**Warning signs:** a summary claiming Part 8 coverage without naming H3 as still open.
**Extra:** `commands/suggest-next.md`'s frontmatter `allowed-tools` currently pre-approves `mcp__mindrian-brain__brain_query`, `read_neo4j_cypher`, and `brain_search` - an H3 direct-call surface **inside the very command this phase is wiring**. Note it; do not silently fix it (it is Phase 257's, and `read_neo4j_cypher` is a retired Neo4j-era name worth flagging separately).

### Pitfall 5: The guard-census trap
**What goes wrong:** a new module calls `brainClient.isAvailable()` and `tests/test-252-guard-census.cjs` census.1 fails the build.
**Why it happens:** census.1 fails for any UNCLASSIFIED file containing an executable `isAvailable(` / `ensureAvailable(` call.
**How to avoid:** classify the file first, or route availability through an already-classified module. `sensors.cjs:44-48` documents this exact avoidance and is the precedent to copy.
**Warning signs:** a new `lib/mcp/tools/*.cjs` file with a `brain-client` require.

### Pitfall 6: The substrate trap
**What goes wrong:** a `roomDir`-to-db opener added inside `brain-client.cjs` trips `scripts/check-substrate.cjs --diff` at pre-commit.
**Why it happens:** `brain-client.cjs` is not on `ALLOWED_DIRECT_IMPORT`.
**How to avoid:** use `_logEventBestEffort(options.db, ...)` with an optional caller-supplied handle, scalars only. 239-05 hit this and documented the workaround.

### Pitfall 7: Assuming `null` means "Brain is down"
**What goes wrong:** a new consumer treats a refusal as an outage, or vice versa.
**Why it happens:** `null` is the test-pinned transport-failure signal across ~82 degradation tests.
**How to avoid:** refusals are sentinel objects (`egress_blocked`, `tier_denied`, `invalid_key`). `chainOfferForReach` documents the sibling rule: `null` means "no companion, nothing to offer" and is deliberately NOT the same value as "Brain is down" (T-c8j-08).

### Pitfall 8: A stale node count
**What goes wrong:** a plan or test hardcodes 207 / 249 / 380 nodes.
**Why it happens:** every doc generation froze a different number. Measured today: **384**.
**How to avoid:** never hardcode. `--check` regenerates and compares; assert against the generator, not a literal.

---

## Runtime State Inventory

This is a wiring/refactor phase, so the inventory applies. It is short, which is itself the finding.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **None.** The projection is a git-tracked JSON file, not a datastore. `room.db` carries `memory_event` rows from `logSuggestionSurfaced` (`surface: 'suggest-next'`, commands + numeric scores + problem_type). Changing the chain source changes *future* row content only; no existing row becomes wrong. | Code edit only. No data migration. |
| **Live service config** | **None found.** No n8n workflow, Datadog dashboard, or external service references the projection or these command surfaces. Verified by grep across `lib/`, `scripts/`, `hooks/`, `.mcp.json`. | None. |
| **OS-registered state** | **None found.** No scheduler task, pm2 process, or launchd plist references `suggest-next-command.cjs`, `act-command.cjs`, or the projection. | None. |
| **Secrets / env vars** | Read-only touchpoints, all pre-existing: `MINDRIAN_ORCHESTRATION_PROJECTION` (path override, `recipe-maps.cjs:102`), `MINDRIAN_CONNECTOR_REGISTRY`, `MINDRIAN_HARNESS_MANIFEST`, `MINDRIAN_BRAIN_URL`, `MINDRIAN_BRAIN_KEY`, `MINDRIAN_BRAIN_TIMEOUT_MS`, `PART8_FORCE_BRAIN_AVAILABLE` (hook-script-only test seam; **never read by `brain-client.cjs::isAvailable()`** - 239-05's summary records this correction). | No key renamed. `local-chain-recommender.cjs` hardcodes its projection path with **no env override**, unlike `recipe-maps.cjs` - if a test needs to point it at a fixture, that seam must be added. |
| **Build artifacts** | `dist/generic-claude-dir/` and `dist/zed/` carry mirrored copies of `skills/act/SKILL.md`, `skills/pipeline/SKILL.md`, `skills/larry-personality/SKILL.md`, all of which mention `recipe-maps`. These are generated and go stale on a source edit. | Regenerate `dist/` if any skill body changes. `data/harness-manifest.json` carries digests of the three maps + four runtime surfaces and is `--check`-gated; a projection change requires a manifest regeneration in the same commit (`pre-commit-room-minto-guard.sh:417` enforces this). |

**The canonical question, answered:** after every file in the repo is updated, the only runtime system holding stale state is the generated `dist/` tree and `data/harness-manifest.json`, both of which have existing regeneration gates that fail the commit rather than drifting silently.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | Yes | >= 22.16.0 floor declared; `node:sqlite` warns "experimental" as expected | none needed |
| `data/brain-orchestration-projection.json` | Wave 1 | Yes | 384 nodes / 73 edges, `--check` OK | readers degrade to `[]` |
| `data/command-registry.json` | `composeWorkflow`, posture | Yes | 113 commands, 28 frameworks, 18 curated_chains | degrade to empty |
| `data/connector-registry.json` | `wiringForReach` | Yes | present | degrade to `[]` |
| Live Brain (`pws-brain-mcp.onrender.com`) | **only** the server-side composition wave | **Not probed this session** | - | Every consumer degrades: `isAvailable()` false -> local ranking with honest low confidence |
| Theo (`/home/jsagi/Theo`) | Section 5 reference read | Yes, on disk | Phase 9 in progress; **not deployable** (no remote hosting; its Phase 08.4 not started) | Plan against the CURRENT Brain, per the standing rule |
| Context7 MCP | library docs | **No** | - | `ctx7` CLI also not installed (`command -v ctx7` -> not found). **Immaterial:** this phase makes zero claims about any external library's API. Every claim here is grounded in this repo's or Theo's own source. |
| langtalks-graph-expert MCP | agent-orchestration concepts | **No** (MCP tools stripped from this agent context, the documented upstream `tools:`-frontmatter bug) | - | Stated honestly rather than papered over. The questions this phase asks are architecture-internal, not corpus questions; the authoritative sources here are the repo's own source and canon, which were read directly. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** live Brain (only matters for the composition wave; every path degrades honestly by design).

---

## Tri-Polar Impact (CLAUDE.md Tri-Polar Design Rule)

| Surface | Effect of Wave 1 (chain wiring) | Effect of the composition wave |
|---|---|---|
| **Claude Code CLI** | `/mos:suggest-next` and `/mos:act --chain` gain real multi-step chains. Hooks fire, so the PreToolUse Part 8 hook still covers any model-issued Brain call. | Belt covers it; hook does not. Net enforcement unchanged (belt is stricter on `block`, weaker on `ambiguous`). |
| **Claude Desktop** | Same improvement via the MCP `suggest_next` / `orchestration` tools. | **This is the surface that benefits most.** No hooks exist here, so the belt is the *only* enforcement and server-side composition is the *only* way to ground the answer. Rejecting removes `chain_offer`, which Quick `260819-c8j` built specifically for hookless surfaces. |
| **Cowork** | Same as Desktop. Shared `00_Context/`; the projection is read-only and per-install, so concurrent access is safe. | Same as Desktop. |

No surface is skipped.

---

## Open Questions

1. **Does the navigator ratify or remove the two shipped server-side composition sites?**
   - What we know: both are live, released, tested, and belted at `callTool`. SEED-053 and Theo's own Phase 05 both argue the pattern is clean.
   - What is unclear: whether the navigator's original question was asked in awareness that the answer had already shipped.
   - Recommendation: present Section 3.3 first, then ask. Frame it as *ratify-and-govern vs remove*, never as *approve vs decline*.

2. **`ambiguous` verdict on the server-side path: disclose, or fail closed?**
   - What we know: the hook gates it (Shape F.1, no send-anyway verb); the belt passes it through silently.
   - What is unclear: how often `ambiguous` actually fires in production. No telemetry read this session.
   - Recommendation: Option A (disclose-and-proceed, reusing the `brain_refusal` idiom). Measure first via `part8-egress-ontology.cjs::record`, then consider Option B.

3. **Should `framework-chain-composer.cjs::KNOWN_FRAMEWORKS` be repointed, deleted, or left as a generic-framework fallback?**
   - What we know: it shares 1 of 18 names with the live registry, and that mismatch is the root cause of the one-step-chain defect.
   - What is unclear: whether the 18 generic names are dead code or an intentional non-PWS fallback for users pasting external strategy work.
   - Recommendation: do not delete blind. Add the drift gate (`WIRE-04`) first so the divergence becomes visible, then decide with data. `detectCompletedFramework` and `parseFrameworkChainSection` also read that list and have other callers.

4. **`SEED-A` (Phase 263) is named as "a direct input into Phase 254's consumption-wiring work." Is 263 sequenced before or after this phase?**
   - What we know: ROADMAP puts 263 after 262 and describes SEED-A as re-sourcing the framework UN-WIRED gate from the live post-hygiene `:Framework` population.
   - What is unclear: whether 254 should wait for it or whether `WIRE-04` supersedes it locally.
   - Recommendation: the planner should read 263's current state before locking `WIRE-04`, to avoid two competing drift gates.

5. **`lib/mcp/brain-router.cjs` and Theo: who sends the message?**
   - What we know: it reads `brainResult.next_gate.options[]`, an incumbent-only shape, and it is not on Theo's 7-file adaptation list. Post-flip it degrades to Tier 2 silently with no refusal disclosure.
   - What is unclear: nothing technical; only ownership.
   - Recommendation: this phase adds it to Theo's adaptation list (a message to Theo's session, not a code change), exactly as Phase 262 did for `check-flagship-floor.cjs` and `build-brain-census.cjs`.

6. **`BRAIN_PROBLEM_TYPE_ALIASES` post-flip.** Theo's own `deferred-items.md` carries this as named plugin-side work: none of the incumbent's three canonical problem-type names is a live Theo `DomainConcept` id. If this phase touches the seed path, re-pointing is cheap now. Not this phase's requirement; flag it, do not absorb it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The proposed requirement IDs (`WIRE-01..04`, `COMP-01..02`) are a reasonable decomposition. | Phase Requirements | Low. The planner ratifies or replaces them; the behaviours behind them are all verified. |
| A2 | `framework-chain-composer.cjs::KNOWN_FRAMEWORKS`'s 18 generic names are stale rather than a deliberate non-PWS fallback. | 2.3, Open Q3 | Medium. If deliberate, deleting or repointing them breaks an undocumented use case. Mitigated by recommending the drift gate before any deletion. |
| A3 | `ambiguous` verdicts are rare enough that disclose-and-proceed (Option A) is acceptable. | 3.4 | Medium. Not measured. If `ambiguous` is common, Option A becomes a noisy disclosure rather than a control. Mitigated by measuring first. |
| A4 | The live Brain's availability and behaviour were not probed this session; every claim about live-Brain state is carried from Phase 262's dated 2026-09-02 measurements. | 6.3, Environment | Low for Wave 1 (local only). Real for the composition wave, which is why 6.3 requires its own probe. |
| A5 | No project skill beyond `docu-optimizer` exists, and `icm-architect` does not bind because no room-structure or `navigation.cjs`-schema work is in scope. | Project Constraints | Low. If the plan grows to touch `room-db.cjs` or section scaffolding, `icm-architect` becomes a standing consult and this assumption must be revisited. |

---

## Sources

### Primary (HIGH confidence - read or executed this session)

- `lib/core/recipe-maps.cjs` (full file), `lib/core/brain-client.cjs` (lines 440-600, 1880-1960 + grep for all classify sites), `lib/core/navigation-engine.cjs` (lines 1050-1170 + grep), `lib/core/reader/decide-projection-reader.cjs`, `lib/core/orchestration-candidate-lift.cjs`, `lib/workflow/local-chain-recommender.cjs`, `lib/workflow/f-selector-ranker.cjs` (grep), `lib/brain/chain-recommender.cjs` (header + `chainOfferForReach`), `lib/mcp/tools/sensors.cjs` (full file), `lib/mcp/brain-router.cjs`, `lib/mcp/tool-router.cjs:1435-1500`, `scripts/part8-egress-guard-hook.cjs` (full file), `scripts/suggest-next-command.cjs` (full file), `scripts/act-command.cjs` (header + requires), `scripts/build-orchestration-projection.cjs` (grep + `--check` executed)
- `data/brain-orchestration-projection.json` - executed node/edge/framework census and a `<SEP>` scan
- `data/command-registry.json` - executed framework and curated_chains census
- Live execution: `recommendFrameworkChain` across 4 problem types; `recommendMultiHopChains` across 4 seeds; set-diff of the three framework vocabularies
- `CLAUDE.md` + the four `@include` files (`architecture.md`, `moat.md`, `decisions.md`, `release-process.md`)
- `docs/MINDRIAN-CANON.md:470-510` (CIRS R3-R13, R7 verbatim)
- `docs/262-FLOOR-01-GAP-LEDGER.md` sections 5-6 (the D-07 finding)
- `.planning/phases/239-brain-access-surface/239-05-PLAN.md` + `239-05-SUMMARY.md`
- `.planning/seeds/SEED-043`, `SEED-045`, `SEED-053`
- `.planning/2026-08-20-ARCHAEOLOGY-complete-system-loop.md` (sections c, d, g)
- `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md` (the H1/H2/H3 table + section 4 re-verification, re-run this session)
- `.planning/ROADMAP.md` Phases 254, 257, 262, 263; `.planning/STATE.md` (254 context, Quick 260819-c8j ledger row)
- `tests/run-all-262.sh`, `tests/test-262-sep-projection-probe.cjs`
- **Theo:** `/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts`, `src/mcp/content/recommend-chain.ts`, `src/mcp/operational/chain-run.ts`, `.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` (tool-fate + adaptation tables), `09-04-SUMMARY.md`, `deferred-items.md`

### Secondary (MEDIUM confidence)

- `.planning/2026-08-20-BRIEF-complete-system-loop.md` and `-FINDINGS-` (same-session companions to the archaeology; corroborate the SEED-045 framing but carry the same stale open-item-1 claim this research corrects)
- `docs/CANON-PHASE-MAP.md` Phase 157 / 184 rows (corroborate the deferral history; node counts are stale)

### Tertiary (LOW confidence)

- None. No WebSearch or WebFetch was used; no external claim is made. Context7 and langtalks MCP were unavailable in this agent context (documented upstream `tools:`-frontmatter bug) and the `ctx7` CLI is not installed - stated honestly rather than worked around, because this phase makes zero claims about any external library's API surface.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| What the projection is, and what is unwired | **HIGH** | Artifact measured directly; all four readers read; consumer grep run across the whole tree. |
| `recipe-maps` role and the blend-vs-replace ruling | **HIGH** | Both code paths executed live; the empty-result regression on the two most common seeds was reproduced, not predicted. |
| Server-side composition already ships | **HIGH** | Two call sites read in source; the handoff's own re-verification command re-run and its output pasted. |
| 239-05 belt state and the residual `ambiguous` gap | **HIGH** | Plan, summary, and both guard implementations read side by side. |
| R7 / `decide()` untouched | **HIGH** | Four independent grounds, each verified in source. |
| Theo forward-compatibility | **HIGH** | Theo's own source and its MindrianOS-facing learning docs read directly. |
| Phase 262 D-07 sufficiency | **HIGH** | Ledger read and its measurement independently re-run against the same artifact. |
| Test/verification patterns | **HIGH** | Aggregator and model suites read. |
| Proposed requirement decomposition | **MEDIUM** | Derived from verified behaviours, but not navigator-ratified. |
| `ambiguous` frequency in production | **LOW** | Not measured. Named as Open Question 2 rather than assumed. |

**Research date:** 2026-09-02
**Valid until:** 2026-09-16 (14 days). Shortened from the 30-day stable default for two reasons: this repo's `main` moves daily, and the Theo cutover is *weeks, not months* away - every claim in Section 5 has a dated expiry attached to Theo's own Phase 08.4.
