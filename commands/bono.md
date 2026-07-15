---
name: bono
description: Run a BONO research debate over a what-if hypothesis
help_jtbd: "Spawn a parallel research swarm, debate it as inter-hat arguments over a graph-proposed what-if, and land a navigator-confirmed synthesis."
body_shape: B (Semantic Tree)
hitl_stages:
  - stage: "topic-confirm"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "hypothesis-confirm"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "ruling"
    shapes: ["F.5"]
    mode: "gate"
hitl_why: "Bono halts at three navigator decision surfaces: topic-confirm (F.1) frames the scope and reads the room's JTBD, hypothesis-confirm (F.1) anchors the what-if the debate bears on, and ruling (F.5) resolves the governed positions into a verb."
body_shape_detail: A Shape F selector front door, then a governed parallel cell fan-out with per-persona research, then a governed sequential inter-hat debate as nested decision gates, then a MECE-Minto conclusion closed through the shared graph-write spine
serves_jtbd: ["explore", "decide-pursue"]
teaching: "When you have a wicked question and need a structured argument rather than one opinion, /mos:bono spawns a governed research swarm across the (subdomain x hat) grid, each persona bound to its hat's scrutiny discipline and its own wired sources, then debates the readings as a sequential inter-hat argument over a graph-proposed what-if hypothesis. The navigator confirms the topic, the hypothesis, and the ruling at three decision gates; the MECE-Minto synthesis files only on APPROVE and closes the loop into the room's logical graph."
interactive_first_reward: reframe_question
ui_reference: skills/ui-system/SKILL.md
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Six Thinking Hats"]
produces: "room/solution-design/*"
inputs: []
autonomous_safe: false
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - WebSearch
  - WebFetch
  - AskUserQuestion
# --- Phase 164-05 connector frontmatter (D-164-S4: the GENERATED front door) ---
# --- /mos:bono rides the FROZEN hats reach with a NEW bono sub_mode. It is NEVER
#     a 7th reach: the inter-hat debate IS a Six Thinking Hats surface, so it
#     shares the hats reach_id / framework with /mos:think-hats (six-hats) as a
#     second sub_mode. The connector block is GENERATED, not hand-minted: run
#     scripts/build-connector-registry.cjs so the tuple lands in
#     data/connector-registry.json and --check stays clean (no 7th reach, no
#     duplicate reach_id + sub_mode tuple). posture: hold, because the debate HALTS
#     at the three material Part 3 Decision Gates (topic-confirm + hypothesis-confirm
#     + ruling). web_scope: green, because the per-persona web research legs are now
#     first-class (direction stays SIGNAL -> LOCAL, proven by the Part 8 egress
#     guard: generic subdomain handles cross toward the public web, never LOCAL
#     content toward the Brain). ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-05]
  reach_id: hats
  sub_mode: bono
  framework: "Six Thinking Hats"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 4
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: green
  surface: F.1
---

# /mos:bono

You are Larry. This command is the front door for the BONO Research/Debate Engine: a navigator arrives with a wicked question and needs a structured ARGUMENT over it, not one flat opinion. `/mos:bono` runs a GOVERNED, twice-fanned research debate. Fan one spreads a research swarm across the (subdomain x hat) grid, each persona bound to its hat's scrutiny discipline and its own wired world-of-knowledge. Fan two debates the collected readings as a SEQUENTIAL inter-hat argument over a graph-proposed what-if hypothesis. The navigator confirms the topic, the hypothesis, and the ruling at three Decision Gates; the terminal MECE-Minto synthesis files to `solution-design/` only on APPROVE and CLOSES THE LOOP into the room's logical graph.

`/mos:bono` is ORCHESTRATION, not a new atom (Canon Part 7). It SEQUENCES the shipped BONO substrate: Engine 1 decomposition, the Wave-2 library-first team assembly (`lib/core/expert-library.cjs` `assembleTeam`), the Wave-4 parallel cell fan-out (`lib/core/bono/cell-fanout.cjs` `runCellFanout`), and the Wave-5 sequential debate composition (`lib/core/bono/debate-composition.cjs` `runDebate`). Phase 223 wires three governance seams onto that same substrate WITHOUT minting a new loop runtime, a new derivation loop, or a new edge type: `lib/core/bono/hat-governance.cjs` (`HAT_GOVERNANCE`, `assertHeterogeneity`, `composeGovernedSeams`), `lib/core/bono/persona-research.cjs` (`personaDispatchCell`, `validateCitations`), and the shared close-the-loop spine `lib/core/close-loop-writer.cjs` (`writeCloseLoop`, `findPriorConclusion`) plus the version-cut walker `lib/core/temporal/supersession.cjs` `walkSupersedesChain`. The ONLY net-new surface is this selector + the flow that wires the shipped pieces together.

The surface was scaffolded via the documented `/mos:new-surface` path (D-164-S4): the connector block above is GENERATED by `scripts/build-connector-registry.cjs`, pinned to the FROZEN `hats` reach + a `bono` sub_mode. It is NEVER a 7th reach (the inter-hat debate IS a Six Thinking Hats surface, so it shares the `hats` reach with `/mos:think-hats`).

#### The 8-phase governed flow

## 1. Topic-confirm + JTBD orientation

Render a Shape F selector (the AskUserQuestion primitive, Canon Part 3; see `skills/ui-system/SKILL.md`) gathering:

- **scope** -- the domain / subdomain grid the swarm will fan out over (seeded from Engine 1 decomposition).
- **purpose** -- what the debate is FOR (a decision, a thesis stress-test, a reframing).
- **substrates** -- which evidence sources the cells may reach (LOCAL graph + the hat-scoped public web legs; never Brain user data, Part 8).
- **hypothesis seed** -- a candidate "what if" Larry surfaces from the room graph; the navigator refines it at phase 5's gate.

Before rendering, read the room's active JTBD via `lib/hmi/jtbd-state.cjs` `getCurrent(roomDir)` and let it ORIENT the scope options (a validate-idea JTBD sharpens the grid toward the risky assumption; an explore JTBD widens it). This is the F.1 **topic-confirm** gate: the navigator picks; the selection becomes a typed edge (Part 4). No bespoke dialog.

## 2. Domain decomposition

Run Engine 1 decomposition over the confirmed scope to build the subdomain grid (the existing substrate, UNCHANGED). Each subdomain becomes one axis of the (subdomain x hat) cell grid the fan-out runs over.

## 3. Governed team assembly

Assemble the persona roster with the Wave-2 library-first `assembleTeam` (confirmed `SyntheticExpert` nodes first, generate the gaps, with the three anti-ossification guards -- a mandatory fresh slot, Black always re-derived, the reuse cap K < N; all unchanged). Then bind governance: each persona slot binds to `HAT_GOVERNANCE[hat]`'s scrutiny discipline (White cite-or-retract, Black ACH disconfirming-first, Yellow evidence-backed value, Green provocation-marked, Red no-justification, Blue anti-convergence judge). Run `assertHeterogeneity` over the assembled cells; if two cells share an identical lens, a duplicate-lens slot is RE-DRAWN before any research fires (Req 1: the heterogeneity mandate holds at assembly time, not after the fact).

## 4. Per-persona research fan

Launch the Wave-4 parallel `runCellFanout` over the (subdomain x hat) grid with `dispatchCell = personaDispatchCell` (Plan 01). Each cell runs `extractContext` -> `runSourceLens` -> `wireAccept` on a GENERIC subdomain handle only (Part 8); the accepted sources become that persona's wired INFORMS world-of-knowledge (an EvidenceClaim `proposed` node + an `INFORMS` edge through the navigation chokepoint). A persona may not later assert beyond its own wired set. `part8-egress-guard.classify` is the fail-closed pre-egress gate: only the generic handle crosses toward the public web, never LOCAL content toward the Brain (this is why `web_scope` is `green`, SIGNAL -> LOCAL). `planDispatch` sizes the fan and the fan cap stays the cost control; the fan is PARALLEL and is never re-run inside the debate loop (D-164-S2).

## 5. Hypothesis-confirm + governed debate

The F.1 **hypothesis-confirm** gate HALTS so the navigator confirms or edits the graph-proposed what-if. The confirmed hypothesis is the debate's anchor (the `hypothesisId` the per-hat derived relationships bear on).

Then hand the collected cell array into `runDebate` (Wave-5 `debate-composition.cjs`) as the runChain seed `previousOutput`, with `composeGovernedSeams` injected as its `{deriveFn, selfCritiqueFn, onStep}` options. The `deriveFn` stays SYNCHRONOUS over pre-resolved data (CR-01: any thenable is coerced to `[]` so no Promise reaches `runDerivation`). `validateCitations` rides the self-critique so no persona asserts beyond its wired sources. The debate is a runChain step sequence: one per-hat argument step per hat (the consolidator argues that hat's stance over ITS slice of the collected cells, governed by `enforceGovernance`), then the F.5 **ruling** gate HALTS and emits a verb in `supported | rejected | refined | undecided` plus a residual-tension record.

The graph writes COMPOSE on the shipped substrate (Canon Part 7), never a hand-rolled loop and never a direct navigation edge-writer call: the per-step DERIVED relationships ride `lib/core/graph-derivation.cjs` `runDerivation` (a PROPOSED truth-claim node + a frozen `CASCADE_SUBSET` edge through the chokepoint, governance-critiqued, idempotent).

## 6. MECE-Minto synthesis + unknowns matrix

Apply the Pyramid + MECE discipline of `/mos:structure-argument` to emit the conclusion as narrative-schema JSON (`lib/memory/narrative-schema.cjs` `validateNarrative`-conformant: `governing_thought` <= 250 chars, 3-5 `key_claims`, no em-dashes anywhere). Apply the `/mos:map-unknowns` Rumsfeld matrix to produce the unknowns base (the open questions the debate could not close). Reuse those two commands' vocabulary; do not re-derive the disciplines. `lib/memory/feynman-prompts.cjs` is NOT touched (a byte-checked SPEC constraint: the conclusion step borrows the Pyramid discipline, it does not edit the Feynman stage prompts).

## 7. Close the loop

Detect a re-run first: `findPriorConclusion(db, topic_hash)` (from `lib/core/close-loop-writer.cjs`) looks up any prior conclusion on the same topic. Then make ONE `writeCloseLoop` call carrying claims / relations / killed / conclusion / knowns / unknowns / opportunities, plus `priorConclusionId` when a confirmed prior exists. The writer is the ONE spine both 223 surfaces terminate through: D-01 dual write (opportunity bank .md FIRST, room.db node SECOND, one shared artifact_id) and D-02 proposed edges live INSIDE the writer; the command never bypasses it. Every node is born `review_status: proposed` (Part 9). After the write, run `bash scripts/compute-opportunity-state <roomDir>` so the bank rollup surfaces the new opportunity nodes (Req 4).

## 8. Version cut + --version-log

The SUPERSEDES chain is written by phase 7's supersede path (D-04: the SUPERSEDES edge binds NULL `review_status` -- it is mechanical bookkeeping; the new conclusion NODE is what the navigator ratifies). CONTRACT: `supersede` requires the prior conclusion to be CONFIRMED (confirmed -> superseded is the only legal transition). NEVER auto-confirm a prior conclusion to force a chain; confirmation is `confirmNode(byUser)` only (Part 9). A proposed prior yields a new proposed conclusion plus a DISCLOSED "no chain written: prior unconfirmed" outcome (the SEED-059 disclosed-thin-world convention), never a silent no-op and never an auto-confirm.

`--version-log` renders `walkSupersedesChain(db, newestConclusionId)` as a chain-order list: newest first, one line per conclusion with its `created_at` and a governing-thought snippet. A first run renders a single-entry log and ZERO SUPERSEDES edges (no false chain on a first run).

#### Hard rules (in-body)

- **All writes are LOCAL** through `lib/core/navigation.cjs`, reached ONLY through the `runDerivation` + `wireAccept` / `writeCloseLoop` chokepoints (Part 9). The command never calls the navigation edge-writer directly and never mints a new edge type; every semantic edge draws from the frozen `ALLOWED_EDGE_TYPES` set (`SUPPORTS` / `CONTRADICTS` / `CONVERGES` / `INFORMS` / `REJECTED_BECAUSE` / `SUPERSEDES` / `CASCADE_SUBSET`).
- **Everything the hats conclude is `proposed`** (Part 9): claims, the conclusion node, knowns, unknowns, and opportunities all land `review_status: proposed`. Only a human confirms a truth-claim node via `navigation.confirmNode(byUser)`. The engines propose; the navigator ratifies.
- **Brain is generic-methodology read-only** (Part 8): any hat's Brain leg carries framework names + problem-type enums ONLY, never venture content. Zero user-content egress; `part8-egress-guard.classify` is the fail-closed gate on every Brain-bound payload.
- **Governance is debate-only** (Plan 01 scope caution): `HAT_GOVERNANCE` disciplines the assembled personas and the debate steps; it is never live-conversation enforcement.
- **Tri-polar** (Canon Tri-Polar rule): on CLI the dial-TUI Shape F selectors drive the three gates + the composition runs via the shipped modules; on Desktop / Cowork the same gates render as a structured-prompt fallback (no TUI), with the navigator confirming the topic, hypothesis, and ruling conversationally.
- No emoji, no em-dashes; the 12-glyph UI vocabulary only; 3-line errors.

#### Offer high-value hats as reusable SyntheticExperts

At the ruling gate, offer the run's high-value hats for filing as reusable `SyntheticExpert` nodes (Wave-2 `offerExpertsForFiling`). The navigator APPROVEs which experts are worth keeping; promotion to `confirmed` rides `navigation.confirmNode(byUser)` (Part 9 role 5: the human confirms truth).

#### Decisions carried (D-164, updated for Phase 223)

The Phase-164 constitutional decisions still bind; Phase 223 only names the new modules they route through:

- **D-164-S2 (fan is parallel, never looped):** the (subdomain x hat) research fan runs through `runCellFanout` with `personaDispatchCell`, capped by `planDispatch`; the collected cells seed the debate as `previousOutput` and are never re-run inside `runDebate`.
- **D-164-S3 (two-layer critique):** the governance self-critique (`composeGovernedSeams`'s `selfCritiqueFn`, carrying `validateCitations`) rides the material debate steps AND is passed into `runDerivation`, so a bad debate step or a bad derived relationship is caught before it folds forward.
- **D-164-S4 (generated front door):** the connector block above is machine-generated by `scripts/build-connector-registry.cjs`; author it, then regenerate, never hand-trust the final block.
- **D-164-S5 (incremental filing):** each debate step journals via `pipeline-state.cjs` before the next runs, so a crashed run resumes from the cursor; the `isNext` HARD gate prevents a re-run of completed steps.

#### Cost controls

The three gates are the cost brake: `planDispatch` budget-caps the research fan, the topic-confirm gate bounds the grid before any web leg fires, and the hypothesis-confirm gate anchors the debate before the per-hat arguments run. A `quality: low` reading is caught by the governance self-critique BEFORE it propagates into the debate, so a thin cell never drives a conclusion.

#### Footer routing

When the navigator's intent is better served by a single-perspective hat surface or a persona lens, footer-route:

- `commands/think-hats.md` -- the six-hats single-pass surface (the `hats` reach `six-hats` sub_mode) when the navigator wants one structured pass rather than the full research debate.
- `commands/persona.md` -- the persona lens when the navigator wants to embody one team member rather than run the inter-hat argument.
- `commands/intel-pipeline.md` -- the JTBD-driven meta-orchestrator sibling when the navigator wants the calibrate-through-write-to-graph loop against the whole room rather than a single what-if debate.

All are sibling surfaces on the same governed spine; `/mos:bono` is the full governed research-debate orchestration, the others are the lighter single-surface entry points.
