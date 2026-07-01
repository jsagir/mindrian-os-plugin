# Phase 188: Shape-F Selector System (full F.0-F.9 + composition) - Research

**Researched:** 2026-07-01
**Domain:** HMI selector vocabulary (Shape F), AskUserQuestion render contract, declaration-registry composition, canon reconciliation
**Confidence:** HIGH (codebase is the primary source; every claim below is grounded in file:line)

> This RESEARCH.md is the RE-SCOPE UPDATE. It covers the net-new delta (F.9, hitl_stages,
> F.3/F.4 parity, Breakthrough collapse, coverage-gate extension, ten-shape canon awareness).
> The F.8 mechanics are SETTLED - they are cited from the four F.8 strand files, not re-derived:
> - `188-RESEARCH.md` was the prior F.8 synthesis; its content is now superseded by this file but
>   its four rulings are restated below under "Settled (F.8)".
> - `188-RESEARCH-1-selector-mechanics.md` (R1) - the multiSelect render primitive + capture gap.
> - `188-RESEARCH-2-canon-reconciliation.md` (R2) - the additive-sub-shape ruling + entry-31 gate.
> - `188-RESEARCH-3-whats-next-trigger.md` (R3) - re-enter decide() post-confirm.
> - `188-RESEARCH-4-brain-use-trigger.md` (R4) - reuse brain_consult, MOVE-SET vs CONTENT-SET.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 / D-01a (NAVIGATOR GATE):** The Part-10 navigator override released entry-31's self-binding
  clause for the amendment. The amendment is now BROADER: it ratifies TWO new canon entries (F.8 + F.9)
  into Part 3 + Appendix D AND removes the non-canonical "Breakthrough Surface" from canon prose.
  **SFS-11 execution PAUSES at a blocking checkpoint for a navigator APPROVE before any canon byte is
  written.** Planning is autonomous-safe; ratifying/executing the canon amendment is NOT. Frozen scalars
  (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) stay byte-identical; the amendment mints no reach/edge/node and
  opens no Brain wire.
- **D-02 (REVERSED):** F.9 is IN SCOPE. Build order respects the dependency: F.8 capture machinery
  (SFS-02) is the prerequisite the F.9 renderer/consumer (SFS-04/05) consume.
- **D-02a / D-10:** The Breakthrough Surface is NOT an eleventh shape - it collapses INTO the F.7 dial /
  F.1. After this phase the canon knows exactly ten shapes. Bare `F.7` -> the canonical dial.
- **D-03:** Canon-first WITHIN the gated wave. Once the navigator APPROVES, ratify F.8+F.9 in ONE atomic
  lockstep BEFORE dependent renderers land. Non-canon code (capture/consumer plumbing, coverage-gate
  extension, F.3/F.4 parity) may land in earlier waves.
- **D-04..D-04c:** Ten canonical shapes are F.0-F.9. F.6 = Plan Review Round, F.7 = the dial. F.8 =
  multi-select action set; F.9 = cascade/reconcile gate. Do NOT reuse a taken slot. All additions are
  ADDITIVE (existing shapes stay byte-identical, entry-25/27 house style). SEED-039's "F.7 multi-select"
  refs reconcile to F.8 (render) + F.9 (reconcile) - FLAG only, do NOT silent-edit SEED-039.
- **D-05:** MAX_K=3 bounds ONLY the ranked 1-of-N candidate set. The F.8 toggle set is governed by its
  own scalar `MAX_TOGGLE_N` (paged; AskUserQuestion ~4-5 options/question ceiling).
- **D-06:** F.8 carries NO single RECOMMENDED glyph. Brain confidence >=0.70 renders as a PRE-CHECKED
  default toggle (reuses 0.70, no new scalar, no glyph); pre-checked NEVER auto-applies.
- **D-07:** Two object classes - MOVE-SET (generic move handles; Brain-eligible) vs CONTENT-SET (user
  content; LOCAL ONLY, never crosses to Brain).
- **D-08:** Brain-use trigger REUSES `brain_consult` (mint NO 7th reach; 6-reach bank frozen). Confidence
  ORDERS/pre-checks toggles, never auto-applies.
- **D-09:** What's-next trigger = RE-ENTER `decide()` after a multi-select confirm commits (appliedCount>=1).
  runChain halts on the what's-next (an offer is never autonomous_safe).
- **D-11:** `hitl_stages` is a DECLARATION contract ONLY in 188 (Phase 190 enforces at build). A surface
  declares an ordered list of `{stage, shapes[], mode: parallel|ordered|gate}`. 188 ships: the schema, a
  validator, and the 9 explainer-page engine flows as reference fixtures. It composes existing F-shapes; it
  does NOT re-implement `runChain` (a stage's `gate` mode MAY hand to runChain's safe-halt, but they stay
  distinct).
- **D-12:** F.3 and F.4 -> first-class parity (F.3 depth-state wiring; F.4 progressive harvest scopes).
  Parity = registered renderer + dispatcher route + coverage-gate pass, at F.0-F.2/F.5-F.7 fidelity.

### Claude's Discretion
- Exact `MAX_TOGGLE_N` value + paging UX against the AskUserQuestion ceiling.
- Internal module names for the F.8 capture adapter + fan-out consumer, and the F.9 renderer/consumer
  (parallel the f1-pick pair naming).
- The `hitl_stages` schema's on-disk form (JSON schema file vs CJS validator vs frontmatter convention) -
  resolved in research below against the reach-component-map / connector-registry precedent.
- Wave decomposition (canon-touching vs plumbing) so SFS-11 is isolatable behind the navigator gate.

### Deferred Ideas (OUT OF SCOPE)
- **190** - declaration mandate enforcement of `hitl_stages` at build time.
- **192** - the /mos:help selector + posture-dial CONSUMERS.
- **189** - memory governance (F.8/F.9 pointed at the write path).
- **204** - ignite room/command chooser.
- **SEED-039** multi-session reconcile (the inward-pointed F.9 cascade; owned by a parallel session).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SFS-01 | F.8 register in `F_SUBSHAPES` + `shape-f8-renderer.cjs` on `multiSelect` archetype | SETTLED. Register in `selector-dispatcher.cjs:341`; add `requestedShape === 'F.8'` branch (mirror F.5 branch at :710); multiSelect fold already lives at :211-248 (`archetypeToContractHints`). |
| SFS-02 | F.8 array-capture adapter (clone `f1-pick-capture-cli.cjs`) | SETTLED. Clone `captureCliPick` -> array form; answer is an ARRAY of selectedOptions. Deterministic membership match per option (`_matchVerb`, :61). |
| SFS-03 | F.8 fan-out consumer (clone `f1-pick-consumer.cjs`) - N edges on ONE confirm through `navigation.cjs` | SETTLED. Clone `consumeF1Pick`; loop the array, call closeOffer per item; Part-9 chokepoint preserved (consumer never opens room.db - caller passes roomState.db). |
| SFS-04 | F.9 ordered per-item APPROVE/REJECT/DEFER renderer | NET-NEW. See "F.9 Ordered Gate". Express as AskUserQuestion multi-question card (one question per item) or a sequence of single-question turns. NOT a live TUI (TTY wall). |
| SFS-05 | F.9 consumer (per SEED-039) | NET-NEW. Builds on the F.8 array capture; each item resolves to one of three ordered outcomes; writes typed edges + (DEFER) leaves a CONTRADICTS-linked competing claim. |
| SFS-06 | Collapse `shape-f7-breakthrough-renderer.cjs`; free canonical F.7 = dial | NET-NEW (small, precise). Blast radius mapped below (3 dispatch/emit call sites + 4 content deps + telemetry enum). |
| SFS-07 | `hitl_stages` schema + validator + 9 engine-flow fixtures | NET-NEW. Registry-is-the-table pattern (data JSON + `scripts/check-*.cjs`). Relates to runChain, does not duplicate it. |
| SFS-08 | F.3 depth-state wiring to parity | NET-NEW. Gap analysis vs F.1/F.5 below. Needs capture+consumer+depth-state, not just a renderer. |
| SFS-09 | F.4 progressive harvest scopes to parity | NET-NEW. Gap analysis below. Needs capture+consumer+scope-state. |
| SFS-10 | Per-shape coverage gate extension (`scripts/check-render-coverage.cjs`) | NET-NEW predicate. Current gate is per-ENTRY-POINT; add a per-SHAPE loop over F.0-F.9. |
| SFS-11 | Canon v1.19 amendment (NAVIGATOR-GATED) | Specify WHAT the amendment contains (below); do NOT draft canon bytes. Blocking checkpoint. |
| SFS-12 | CLAUDE.md:46 membrane-line accuracy check | One-line additive check; frozen scalars unchanged; no re-bloat. |
</phase_requirements>

## Summary

The Shape-F family is a "registry-is-the-table" render system: a single construction door
(`lib/hmi/selector-dispatcher.cjs::pickShape`, :844) resolves a requested shape to a pure renderer
module, folds AskUserQuestion mode hints from a data file (`reach-component-map.json`), appends a
structural marker (`appendAskUserQuestionTrailer`, :528), and returns a `{shape, rendered}` envelope.
Every shape rides this door; nothing constructs AskUserQuestion outside it (SEED-020). Eight shapes are
live (F.0-F.7); F.3/F.4 are registered renderers but "thin" (renderer-only, no capture/consumer/state);
F.8/F.9 do not exist; bare `F.7` mis-routes to a non-canonical Breakthrough renderer.

The re-scope's net-new surface is four builds and two reconciliations. **F.9** is the ordered sibling of
F.8 and its single hardest constraint is the TTY wall (Phase 154): the `ordered` archetype is documented
as "NOT a live ordered widget," so F.9 must express per-item APPROVE/REJECT/DEFER through AskUserQuestion
itself (multi-question card or a sequence of turns), never a bespoke live widget. **`hitl_stages`** is a
declaration contract that follows the established data-JSON-plus-checker pattern (mirror
`reach-component-map.json` + `scripts/build-render-coverage.cjs`); it composes shapes, whereas runChain
composes commands - the two touch only at the `gate` mode. **F.3/F.4 parity** is not a renderer problem
(the renderers already emit valid `{zones, contract}`); it is the missing capture+consumer+state layer
that F.1 has and they do not. **The Breakthrough collapse** is surgically small: three dispatch/emit call
sites, four content dependencies, and one telemetry enum. The **coverage-gate extension** adds a new
per-shape predicate loop alongside the existing per-entry-point one. All of this is additive CJS with zero
Brain wire and zero new external packages.

**Primary recommendation:** Wave the work as [Wave A: non-canon plumbing that can land immediately -
F.3/F.4 parity, coverage-gate extension, Breakthrough collapse, hitl_stages schema+validator+fixtures] ->
[Wave B (BLOCKED on navigator APPROVE, D-01a): canon amendment atomic lockstep] -> [Wave C: F.8 then F.9
renderers/capture/consumers against ratified canon]. This isolates the one true human gate (SFS-11) while
letting ~60% of the phase proceed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shape render (F.0-F.9) | HMI (`lib/hmi/*`) | - | Pure renderers, zero I/O, zero Brain wire; the dispatcher is the only door |
| AskUserQuestion mode fold | HMI dispatcher | data file (`reach-component-map.json`) | Registry-is-the-table: archetype drives mode, never a hardcoded switch |
| Pick capture (turn N+1) | HMI capture adapter (per surface) | - | Thin glue: surface answer -> `{pick}` shape; deterministic enum match, no NLP |
| Fan-out / ordered persistence | Workflow consumer (`lib/workflow/*`) | Core navigation (`navigation.cjs`) | Consumer is shared core; ALL writes route through the Part-9 chokepoint |
| Depth/harvest state (F.3/F.4) | HMI state module (e.g. `jtbd-state.cjs` analog) | Core navigation | Parity requires a state read/write the renderer feeds, like F.6's round_id |
| `hitl_stages` declaration | data file + validator script | - | Declaration contract; Phase 190 (not 188) enforces at build |
| Stage composition of shapes | Core (composition) | Core `chain-executor` (gate mode only) | Composes shapes; hands to runChain safe-halt only at `gate` |
| Canon reconciliation | docs (`MINDRIAN-CANON.md`) + `CLAUDE.md` | - | NAVIGATOR-GATED; constitution edits are not autonomous-safe |
| Coverage assertion | `scripts/check-render-coverage.cjs` | data registry | Pure code predicate, CI-stable, no network/agent |

## Settled (F.8) - cite, do not re-derive

The F.8 mechanics are locked by the four strand files and D-04..D-09. Restated for the planner:

1. **The render primitive already exists.** `archetypeToContractHints` (`selector-dispatcher.cjs:211`)
   folds `{multiSelect:true}` when the archetype is `multiSelect`/`group`; the multiSelect archetype is
   already declared in `reach-component-map.json` for several sub_modes. Toggle glyphs `check` + `empty-sq`
   are in the approved-12 vocabulary (`skills/ui-system/SKILL.md:441`). Render is NOT the work.
2. **The work is CAPTURE + CONSUME.** `f1-pick-capture-cli.cjs::captureCliPick` is singular; F.8 needs an
   ARRAY adapter (SFS-02) and a fan-out consumer (SFS-03) writing N typed edges on ONE confirm through
   `navigation.cjs`. `shape-f8-renderer.cjs` is a thin renderer on the multiSelect archetype (SFS-01).
3. **Four rulings (from `188-RESEARCH.md`):** additive sub-shape not a mode-flag; MAX_K untouched
   (`MAX_TOGGLE_N` is a distinct scalar); no single glyph (>=0.70 pre-checks, never auto-applies);
   what's-next = re-enter `decide()` (`navigation-engine.cjs:~1111 resolveOffer`).
4. **Brain-use (R4):** reuse `brain_consult`, MOVE-SET only, mode_a only, degrade-never-block. Confidence
   ORDERS/pre-checks toggles, never auto-applies. Part 8 is structural (default-deny audit, prose hashed).

> Planner: treat the above as fixed contract. Do NOT open new investigation on F.8 - clone the f1-pick
> pair and register the shape. The delta below is where the new design work is.

---

## NET-NEW 1: F.9 Ordered Cascade / Reconcile Gate (SFS-04/05)

### The load-bearing constraint (pitfall #1)
`reach-component-map.json` documents the `ordered` archetype verbatim: *"an ordering follow-up prompt for
compose-a-chain (D-02; NOT a live ordered widget -- the TTY wall forbids it, Phase 154)."* And
`archetypeToContractHints` (`selector-dispatcher.cjs:219`) only sets `hints.ordered = true` (a passive
hint), never a widget. **SEED-020 forbids a bespoke TUI, and Phase 154 forbids a live ordered widget over
the TTY.** So F.9 CANNOT be a scrolling drag-to-reorder widget. It must be expressed through
AskUserQuestion.

### The mechanism (recommended)
AskUserQuestion natively supports **multiple questions in one card**, each with its own option set. F.9's
"ordered per-item APPROVE/REJECT/DEFER" maps cleanly onto this:
- Each cascade item becomes **one question**, presented in array order (order IS the meaning - Thread C in
  the F.8 addendum). Its options are the closed ordered-outcome set `{APPROVE, REJECT, DEFER}` (plus
  Free-Text only if the item class permits it; cascade bodies are CONTENT-SET so likely closed).
- The AskUserQuestion ~4-5 questions/options ceiling (same ceiling that forces F.8 paging, D-05) means F.9
  inherits the **paging obligation**: >4-5 items -> page the questions. This is a render obligation on
  `shape-f9-renderer.cjs`, exactly parallel to `MAX_TOGGLE_N`.
- **Fallback form** (if multi-question composition is awkward on a surface): a SEQUENCE of single-question
  turns, one item per turn, in order. This is the most honest reading of "ordered" and sidesteps the
  ceiling entirely, at the cost of more turns. Recommend the multi-question card as primary, the sequence
  as the documented fallback - mirror the F.1 capture-adapter's "CLI live / Desktop-Cowork seam-only"
  split (`CAPTURE_ADAPTER_CONTRACT`, `f1-pick-capture-cli.cjs:119`).

### File targets
| Target | Clone / model on | Note |
|--------|-----------------|------|
| `lib/hmi/shape-f9-renderer.cjs` (new) | `shape-f5-renderer.cjs` (open-vocab, tier/mode, marker discipline) + F.8 renderer for the paging pattern | Ordered outcome vocab is closed `{APPROVE, REJECT, DEFER}`; NO recommended marker on cascade bodies (CONTENT-SET, mirrors F.3/F.4 `recommended:null`, `freeTextOffered:false`) |
| F.9 dispatch branch in `dispatchShapeFSubShape` | the `F.5` branch (`selector-dispatcher.cjs:710`) | add `requestedShape === 'F.9'`; pass items[] + header |
| Register `'F.9'` in `F_SUBSHAPES` | `selector-dispatcher.cjs:341` | additive |
| F.9 ordered-capture adapter | the F.8 array adapter (SFS-02) | ordered = array WITH position preserved; each element carries `{item_id, outcome}` |
| F.9 consumer | the F.8 fan-out consumer (SFS-03) | per-item: APPROVE writes the edge; REJECT records NOT-applied + reason; DEFER leaves both as CONTRADICTS-linked competing claims (Decision 13, "rejection is data") - matches SEED-039 Pillar 4 |

### Integration points
- **navigation.cjs** is the single write chokepoint (Part 9); the consumer never opens room.db itself
  (`f1-pick-consumer.cjs` header, "Part 9" note) - the caller passes `roomState.db`.
- **SEED-039 is the CONSUMER, not the owner.** 188 ships F.9 the shape; SEED-039's multi-session reconcile
  (version-stamp nodes, lost-update RECONCILE event) rides it later. Do NOT pull SEED-039's version-stamp
  machinery into 188 - it is deferred (CONTEXT Deferred Ideas).

### Risks
- The `ordered` archetype hint (`{ordered:true}`) is a passive marker today; make sure F.9 does NOT get
  silently downgraded to "just set ordered:true and stop." The hint is necessary but not sufficient - the
  renderer must actually emit the per-item question set.
- APPROVE/REJECT/DEFER must map to the SAME outcome vocabulary the existing consumers use. Note
  `f1-pick-capture-cli.cjs:46` already defines `OUTCOMES = ['accept','defer','reject','Free-Text']`. Reuse
  that enum (accept==APPROVE) - do NOT mint a parallel {APPROVE,REJECT,DEFER} enum that then has to be
  normalized. Confirm the display labels vs the persisted enum (aliasToCanonical precedent, dispatcher :605).

---

## NET-NEW 2: `hitl_stages` - Engine-as-Pipeline-of-Shapes (SFS-07)

### The declaration form (resolved from precedent)
The codebase has one dominant pattern for declaration contracts: **a data JSON that IS the table, read by a
resolver, checked by a `scripts/check-*.cjs` / built by a `scripts/build-*.cjs` gate.** Examples with the
exact shape to imitate: `lib/hmi/reach-component-map.json` (+ `resolveArchetype`),
`data/connector-registry.json` (+ `build-connector-registry.cjs --check`), `data/dispatch-framework-map.json`,
`data/render-coverage-registry.json` (+ `build-render-coverage.cjs`). Every one carries a `_doc` block with
purpose + vocabulary + dispatch rule.

**Recommendation:** ship `hitl_stages` as **`data/hitl-stages-schema.json`** (the schema + the vocabulary
enums) plus **the 9 engine flows as fixtures** in the same "registry-is-the-table" idiom, plus a
**`scripts/check-hitl-stages.cjs`** validator (pure code, no network - mirror `check-render-coverage.cjs`
structure). Do NOT invent a frontmatter convention in 188; frontmatter enforcement is Phase 190's job
(D-11). 188 proves the schema against fixtures; 190 makes per-surface declaration mandatory.

### Schema (the contract, from D-11)
A surface declares an ordered list of stages:
```
{
  "surface": "<engine slug>",
  "hitl_stages": [
    { "stage": "<name>", "shapes": ["F.x", ...], "mode": "parallel" | "ordered" | "gate" }
  ]
}
```
- `mode: parallel` - the stage's shapes fire independently (an F.8 basket is the natural parallel primitive).
- `mode: ordered` - the shapes fire in sequence, order is meaning (F.9 / F.2 are the ordered primitives).
- `mode: gate` - the stage is a go/no-go checkpoint; **this is the ONLY seam to runChain** (a `gate` stage
  MAY hand to `runChain`'s safe-halt, `chain-executor.cjs:186` `{posture:'halt', autonomous_safe:false}`).

### The 9 reference fixtures (the spec)
The explainer page (`https://mindrian-f-shapes.vercel.app` + `~/mindrian-f-shapes/index.html`) is the visual
spec. The nine engine flows named in CONTEXT: BONO, the RS family, trending-to-absurd, research, and 3
pipelines. Each becomes one fixture expressed in the schema above. Recommendation: store them under
`data/hitl-stages-fixtures/` (or as an array in the schema file) and have `check-hitl-stages.cjs` validate
every fixture against the schema (valid shape ids F.0-F.9, valid mode enum, non-empty ordered stages).

### The runChain boundary (pitfall #2 - do NOT duplicate)
`runChain` (`lib/core/chain-executor.cjs:374`) is "the ONE shared gated loop," and it chains **commands**
(steps with posture/autonomous_safe verdicts), journaling `workflow_stage`. `hitl_stages` composes
**shapes**, not commands. They are NOT the same object and 188 must not re-implement runChain's loop. The
only legitimate contact: a `gate`-mode stage's go/no-go can be realized by runChain's existing safe-halt
(an offer is never autonomous_safe, so runChain halts - `chain-executor.cjs` "an offer is never
autonomous_safe" note). Model `hitl_stages` as pure declaration + validation in 188; leave execution
semantics to consumers.

### Risks
- Scope creep into runChain. Keep 188 to schema + validator + fixtures (D-11). If a task says "execute the
  pipeline," that is Phase 190+, not 188.
- The 9 flows may reference shapes not yet built (F.8/F.9). Validator should accept F.0-F.9 as valid ids by
  vocabulary (the ten-shape closed set), independent of whether the renderer has landed - this decouples
  the fixture wave from the renderer wave.

---

## NET-NEW 3: F.3 / F.4 Parity Gap Analysis (SFS-08/09)

### What "thin stub" actually means (measured, not assumed)
F.3 (`shape-f3-renderer.cjs`) and F.4 (`shape-f4-renderer.cjs`) are NOT header-only - they ARE registered
in `F_SUBSHAPES` (:341), they HAVE dispatch branches (`selector-dispatcher.cjs:702-709`), and they emit
valid `{zones, contract}` with closed-vocab option sets. The gap vs a fully-built shape is the **capture +
consumer + state** layer. Concretely, comparing to F.1:

| Facet | F.1 (full) | F.3 / F.4 (thin) | Parity work |
|-------|-----------|------------------|-------------|
| Renderer | `shape-f1-renderer.cjs` | present (`shape-f3/f4-renderer.cjs`) | none (renderers OK) |
| Dispatch branch | yes (:694) | yes (:702, :706) but passes ONLY `{header}` | thread the state input (depth / scope) into the branch |
| Capture adapter | `f1-pick-capture-cli.cjs` | NONE | clone an adapter: map the closed pick to a state value |
| Consumer / persistence | `f1-pick-consumer.cjs` -> closeOffer -> navigation.cjs | NONE (pick goes nowhere) | a consumer that writes the depth/scope state |
| State module | offer payload / decision_trace | NONE | F.3 depth-state; F.4 harvest-scope state (model on `jtbd-state.cjs` getCurrent, dispatcher :628) |
| Tier/mode | yes | closed-vocab, no marker (by design - keep) | none (F.3/F.4 correctly render `recommended:null`, `freeTextOffered:false`) |

### F.3 depth-state wiring (SFS-08)
F.3 options are `Shallow/Medium/Deep/Extreme/Back` (a depth scalar, `shape-f3-renderer.cjs:31`). Parity =
the pick actually SETS a depth state that a rabbit-hole/explore flow reads. Model the state read/write on
`jtbd-state.cjs` (`selector-dispatcher.cjs:626-636` shows the getCurrent pattern). The verb that FOLLOWS
F.3 is chosen by the calling command (`skills/ui-system/SKILL.md:175`) - so the consumer sets depth and
re-enters the caller, it does not itself pick a canonical verb.

### F.4 progressive-harvest scopes (SFS-09)
F.4 options are `Key insights / +contradictions / +actions / Create artifact draft / Back`
(`shape-f4-renderer.cjs:31`) - a progressive scope ladder wrapping the Synthesize verb. Parity = the pick
drives a progressive harvest (each rung ADDS to the prior scope). The consumer accumulates scope state and
hands to the synthesis path.

### Risk
Do NOT add a RECOMMENDED marker or Free-Text to F.3/F.4 in the name of "parity" - the closed-vocab carve-out
is intentional and enforced (`ensureFreeTextLast` respects `freeTextOffered === false`,
`selector-dispatcher.cjs:389`). Parity is about the capture/consumer/state layer, not the render surface.

---

## NET-NEW 4: Breakthrough Collapse Blast Radius (SFS-06)

### Scope discipline (pitfall #3)
There is a large "breakthrough" DOMAIN (`lib/core/breakthrough/*`, the RS reverse-salient family, ~60
files). **SFS-06 does NOT touch that subsystem.** It collapses ONLY the SHAPE renderer and the F.7 shape
slot. Breakthrough content becomes a dial entry / F.1 next-move (D-10), not a removed feature.

### The precise call sites (grep-verified 2026-07-01)
| # | Site | Current | Change |
|---|------|---------|--------|
| 1 | `lib/hmi/selector-dispatcher.cjs:736-771` | `requestedShape === 'F.7'` routes to `shape-f7-breakthrough-renderer.cjs` | reroute bare `F.7` -> the dial (`F.7-dial` path, :755); retire the breakthrough branch |
| 2 | `lib/core/breakthrough/scanner.cjs:327` | dispatches `requestedShape: 'F.7'` | re-home to F.1 next-move or the dial entry (breakthrough is a move, not a shape) |
| 3 | `scripts/check-pending-breakthrough.cjs:162` | emits `shape: 'F.7'` | update to the new home shape |
| 4 | `lib/hmi/shape-f7-breakthrough-renderer.cjs` (+ `.test.cjs`) | the renderer + its 5-verb `F7_VERBS` | fold content into F.1/dial; retire or repurpose the module |
| 5 | `lib/core/telemetry/schema.cjs:89` | `sub_shape` enum comment lists `F.0..F.7` | reconcile to the canonical ten: F.7 = dial; add F.8, F.9 |
| 6 | content deps: `lib/core/breakthrough/verb-dispatch.cjs:33`, `voice-scaffold.cjs:49/59`, `ethics-fence.cjs:14` | reference `F7_VERBS` / renderer bucket logic | re-point to the new home for the verb set |

### Mechanism
Bare `F.7` currently mis-routes (`selector-dispatcher.cjs:332-336` comment: "The umbrella 'F' branch does
NOT resolve to F.7 - breakthrough surfacing is opt-in"). After collapse, `F.7` -> the canonical dial
(stored today as `F.7-dial`). The cleanest path: make the `F.7` branch delegate to the same
`dial-selector.cjs::renderDialShape` the `F.7-dial` branch uses (:765), and retire the breakthrough branch.
Breakthrough's 5 verbs become a dial entry / F.1 candidate move.

### Risk
The breakthrough renderer enforces a HARD FLOOR (refuses to render provenance-less, `selector-dispatcher.cjs:743-746`;
`ethics-fence.cjs` is the twin). When re-homing the content, preserve the provenance/artifact_ids floor at
the new home - do not drop the ethics fence in the move.

---

## NET-NEW 5: Per-Shape Coverage Gate Extension (SFS-10)

### Current structure (measured)
`scripts/check-render-coverage.cjs` (303 lines) is a **per-ENTRY-POINT** gate: it reads
`data/render-coverage-registry.json` and, for each card-emission entry, asserts it routes through the door
via one of three pinned predicates (`routesThroughCardEmissionDoor`, :140): (a) the file calls `pickShape(`,
(b) it calls `appendAskUserQuestionTrailer(`, (c) it is a renderDial F.7-dial entry. It also does a STALE
byte-compare against the generator (`build-render-coverage.cjs`) and fails closed on any gap or drift.

### The extension (new predicate, not a rewrite)
SFS-10 adds a **per-SHAPE** assertion alongside the per-entry-point one: for every canonical shape in the
closed set F.0-F.9, assert (1) a registered renderer module exists and (2) a dispatcher route exists. The
natural source of truth is `F_SUBSHAPES` (`selector-dispatcher.cjs:341`) - but note it currently reads
`['F.0','F.1','F.2','F.3','F.4','F.5','F.6','F.7','F.7-dial']` (F.7-dial is a variant, F.8/F.9 absent). The
gate should assert the closed ten-shape set F.0-F.9 each has: a `requestedShape === 'F.x'` branch in
`dispatchShapeFSubShape` AND a resolvable renderer module. Model the predicate loop on the existing
`renderCoverageReport` structure (pure code, deterministic, comment-aware call-site detection via
`generator.hasCallSite`).

### Risk
The gate is release-wired (`node scripts/check-render-coverage.cjs` is in CLAUDE.md Verification). The new
per-shape loop must stay CI-stable (no network, no agent - the file's Part-8 header is explicit). Land the
gate extension AFTER F.8/F.9 renderers exist, or it fails closed on the missing shapes. Wave order matters:
gate extension is authored in Wave A but its ASSERTION over F.8/F.9 only goes green in Wave C.

---

## NET-NEW 6: Canon v1.19 + CLAUDE.md Awareness (SFS-11/12) - NAVIGATOR-GATED

### SFS-11 - specify WHAT, do NOT draft canon bytes (D-01a blocking checkpoint)
The planner must insert a `checkpoint:human-verify` (navigator APPROVE) BEFORE any canon byte is written.
The amendment, once approved, must contain (this is the spec, not the prose):
1. **Two new Appendix D entries** (F.8 multi-select action set; F.9 cascade/reconcile gate), in the
   additive entry-25/27 house style (siblings byte-identical).
2. **One-line Part 3 prose** acknowledging F.8 + F.9 as canonical sub-shapes of the ten-shape family, and
   reconciling the code-extant F.6 (Plan Review Round) + F.7 (dial) that the canon text under-documented.
3. **Removal of the "Breakthrough Surface"** from any canon prose (it is no longer a shape; D-10).
4. **Per-shape What/How/HITL currency check** for all ten against Part 3 + Appendix D + the closed 10-verb
   vocabulary (the SEED-021 "CANON v1.19 CURRENCY" pattern applied across all ten).
5. **Explicit invariants restated unchanged:** MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 byte-identical; mints no
   reach/edge/node; opens no Brain wire.

Version bump note: `188-RESEARCH.md` (prior) proposed v1.19 -> v1.20 for the amendment. Confirm the target
version with the navigator at the gate (the re-scope references "Canon v1.19" as the current baseline).

### SFS-12 - CLAUDE.md:46 accuracy check
`CLAUDE.md:46` reads: *"...rendered through Shape F (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen)."* (verified
in the loaded CLAUDE.md, Canon Compliance Core / Part 3 line). The check is: the line stays ACCURATE and
ADDITIVE - F.8/F.9 are new sub-shapes, the frozen scalars are unchanged, NO re-bloat (Phase 187.2
discipline). A one-line edit at most; likely no change is needed since the scalars are unchanged and the
line does not enumerate shapes. Verify, do not pad.

---

## Standard Stack / File Targets

No external packages. Everything is internal CJS (`lib/**/*.cjs`), node built-ins only (Phase 87 invariant),
zero new dependencies.

| Concern | File (new or edited) | Model / clone on |
|---------|---------------------|------------------|
| F.8 renderer | `lib/hmi/shape-f8-renderer.cjs` (new) | `shape-f5-renderer.cjs` + multiSelect fold |
| F.8 array capture | `lib/hmi/f8-*-capture-cli.cjs` (new; name = discretion) | `f1-pick-capture-cli.cjs` |
| F.8 fan-out consumer | `lib/workflow/f8-*-consumer.cjs` (new) | `f1-pick-consumer.cjs` |
| F.9 renderer | `lib/hmi/shape-f9-renderer.cjs` (new) | `shape-f5-renderer.cjs` + F.8 paging |
| F.9 ordered capture | `lib/hmi/f9-*-capture-cli.cjs` (new) | F.8 array adapter |
| F.9 consumer | `lib/workflow/f9-*-consumer.cjs` (new) | F.8 fan-out consumer + SEED-039 semantics |
| Shape registry | `lib/hmi/selector-dispatcher.cjs:341` (edit) | add `'F.8'`, `'F.9'` |
| Dispatch branches | `lib/hmi/selector-dispatcher.cjs:710+` (edit) | mirror the F.5 branch |
| F.3/F.4 capture+consumer+state | new adapters/consumers + a state module | `jtbd-state.cjs`, f1-pick pair |
| hitl_stages schema | `data/hitl-stages-schema.json` (new) | `reach-component-map.json` `_doc` idiom |
| hitl_stages fixtures | `data/hitl-stages-fixtures/` (new, 9 flows) | the explainer page spec |
| hitl_stages validator | `scripts/check-hitl-stages.cjs` (new) | `check-render-coverage.cjs` |
| Coverage gate extension | `scripts/check-render-coverage.cjs` (edit) + generator | existing `renderCoverageReport` |
| Breakthrough collapse | dispatcher :736-771, scanner :327, check-pending :162, telemetry :89 (edits) | dial branch :755 |
| Canon amendment | `docs/MINDRIAN-CANON.md` (NAVIGATOR-GATED edit) | Appendix D entry 25/27 |
| CLAUDE.md check | `CLAUDE.md:46` (verify; likely no edit) | - |

## Package Legitimacy Audit

**Not applicable.** This phase installs ZERO external packages. All work is internal CJS using node
built-ins only (Phase 87 zero-dep invariant, confirmed in every renderer header). No npm/PyPI/crates
surface exists to audit. slopcheck N/A.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AskUserQuestion construction | A bespoke widget / custom TUI for F.9 ordering | `pickShape` + `appendAskUserQuestionTrailer` (the SEED-020 door) | The TTY wall (Phase 154) forbids live widgets; SEED-020 forbids bespoke construction |
| Ordered per-item gate | A drag-to-reorder live UI | AskUserQuestion multi-question card OR sequence of single-question turns | Order is carried by array index + question order, not by a live reorder |
| SQL writes from the consumer | Opening room.db in the F.8/F.9 consumer | Caller passes `roomState.db`; consumer calls closeOffer; navigation.cjs is the chokepoint | Part 9 single chokepoint; consumer never requires better-sqlite3 |
| hitl_stages loop execution | Re-implementing runChain to run stages | Declaration + validator only in 188; `gate` mode hands to existing runChain | D-11: 188 is contract-only; runChain is the ONE gated loop |
| Verb / outcome enums | A parallel `{APPROVE,REJECT,DEFER}` enum | Reuse `OUTCOMES = ['accept','defer','reject','Free-Text']` (`f1-pick-capture-cli.cjs:46`) | Avoids a normalize layer; accept==APPROVE |
| Archetype dispatch | A hardcoded switch in the dispatcher | `reach-component-map.json` + `resolveArchetype` | Registry-is-the-table; a new archetype joins by a data row |
| Coverage assertion | An LLM/agent quality check | Pure-code predicate over the registry (existing gate) | CI-stable, deterministic, no network (Part 8) |

**Key insight:** The whole Shape-F family is a data-driven, single-door render system. Every net-new piece
is a CLONE of an existing pair plus a data-row registration - not a new mechanism. The one genuinely novel
design decision is how F.9 expresses "ordered" within the AskUserQuestion / TTY-wall constraints, and the
answer is "multi-question card or sequence of turns," never a widget.

## Common Pitfalls

### Pitfall 1: Building F.9 as a live ordered widget
**What goes wrong:** A drag/scroll reorder UI that violates the TTY wall and SEED-020.
**Why:** The word "widget" in the CONTEXT ("live widget") is aspirational; the archetype note is explicit
it is NOT a live ordered widget.
**Avoid:** Express F.9 as AskUserQuestion multi-question (one question per item, ordered) with paging.
**Warning sign:** Any F.9 code path that does not return through `pickShape`.

### Pitfall 2: Duplicating runChain in hitl_stages
**What goes wrong:** 188 grows a second gated loop.
**Why:** "pipeline of shapes" sounds like "chain of commands."
**Avoid:** 188 ships schema + validator + fixtures ONLY (D-11). Execution is 190+.
**Warning sign:** A task that "runs" a hitl_stages fixture end-to-end.

### Pitfall 3: Over-scoping the Breakthrough collapse into the RS/breakthrough domain
**What goes wrong:** Ripping out `lib/core/breakthrough/*` (a live feature).
**Why:** "collapse the Breakthrough" reads broader than it is.
**Avoid:** Touch ONLY the SHAPE (6 sites in the table above). The domain stays; the SHAPE slot frees.
**Warning sign:** Edits to `scanner.cjs` scoring, `ethics-fence.cjs` logic, or RS writers.

### Pitfall 4: Adding a marker or Free-Text to F.3/F.4 for "parity"
**What goes wrong:** Breaks the closed-vocab carve-out and its 7-assertion tests.
**Why:** Parity is misread as "make it look like F.1/F.5."
**Avoid:** Parity = the capture/consumer/state layer, not the render surface. Keep `recommended:null`,
`freeTextOffered:false`.
**Warning sign:** `ensureFreeTextLast` starts injecting Free-Text into F.3/F.4.

### Pitfall 5: Writing canon bytes before the navigator APPROVE
**What goes wrong:** An autonomous agent ratifies the constitution (D-01a violation).
**Why:** Canon-first sequencing (D-03) is misread as "do the canon edit now."
**Avoid:** SFS-11 is a BLOCKING checkpoint. Plan a `checkpoint:human-verify` before any
`docs/MINDRIAN-CANON.md` edit.
**Warning sign:** A Wave-A or Wave-B task edits MINDRIAN-CANON.md without a preceding approval gate.

### Pitfall 6: Coverage gate fails closed mid-phase
**What goes wrong:** The extended per-shape gate goes red because F.8/F.9 renderers do not exist yet.
**Why:** Gate extension is authored before the shapes land.
**Avoid:** Sequence the gate's ASSERTION over F.8/F.9 into Wave C (after the renderers). Author the code
earlier; enable the assertion last.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test scripts + `bash tests/run-all-<phase>.sh` (project convention; no jest/vitest) |
| Config file | none - each shape ships a `*.test.cjs` sibling (e.g. `shape-f7-breakthrough-renderer.test.cjs`) run by the phase runner |
| Quick run command | `node lib/hmi/shape-f9-renderer.test.cjs` (per-module, < 5s) |
| Full suite command | `bash tests/run-all-188.sh` (create if absent - see Wave 0) |
| Gate commands | `node scripts/check-render-coverage.cjs`, `node scripts/check-hitl-stages.cjs`, `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SFS-01 | F.8 registered + renders multiSelect card | unit | `node lib/hmi/shape-f8-renderer.test.cjs` | ❌ Wave 0 |
| SFS-02 | array capture maps N selectedOptions deterministically | unit | `node lib/hmi/f8-capture.test.cjs` | ❌ Wave 0 |
| SFS-03 | N typed edges on ONE confirm via navigation.cjs | integration | `node lib/workflow/f8-consumer.test.cjs` | ❌ Wave 0 |
| SFS-04 | F.9 renders ordered per-item APPROVE/REJECT/DEFER (paged) | unit | `node lib/hmi/shape-f9-renderer.test.cjs` | ❌ Wave 0 |
| SFS-05 | F.9 consumer: APPROVE writes edge, DEFER leaves CONTRADICTS pair | integration | `node lib/workflow/f9-consumer.test.cjs` | ❌ Wave 0 |
| SFS-06 | bare F.7 routes to the dial; no F.7 -> breakthrough path | unit | `node lib/hmi/selector-dispatcher.test.cjs` (F.7 branch) | ⚠️ extend existing |
| SFS-07 | 9 fixtures validate against the schema; bad fixture fails closed | unit | `node scripts/check-hitl-stages.cjs` | ❌ Wave 0 |
| SFS-08 | F.3 pick sets depth state | integration | `node lib/hmi/shape-f3-parity.test.cjs` | ❌ Wave 0 |
| SFS-09 | F.4 pick accumulates progressive harvest scope | integration | `node lib/hmi/shape-f4-parity.test.cjs` | ❌ Wave 0 |
| SFS-10 | per-shape gate green for all F.0-F.9; synthetic missing shape fails closed | unit/floor | `node scripts/check-render-coverage.cjs --check` | ⚠️ extend existing |
| SFS-11 | canon amendment present + frozen scalars byte-identical (FLOOR test) | floor | canon FLOOR test (grep MAX_K=3/DIAL_REACH_K=6/0.70/0.15 unchanged) | ⚠️ after gate |
| SFS-12 | CLAUDE.md:46 line accurate + additive | assertion | grep assertion in the phase runner | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched module's `*.test.cjs` (< 5s).
- **Per wave merge:** `node scripts/check-render-coverage.cjs` + `node scripts/check-hitl-stages.cjs`.
- **Phase gate:** `bash tests/run-all-188.sh` green + `node scripts/doctor.cjs --acceptance` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-188.sh` - the phase runner (model on `tests/run-all-187.sh`)
- [ ] `lib/hmi/shape-f8-renderer.test.cjs`, `shape-f9-renderer.test.cjs`, `shape-f3-parity.test.cjs`,
      `shape-f4-parity.test.cjs`
- [ ] `lib/workflow/f8-consumer.test.cjs`, `f9-consumer.test.cjs`
- [ ] FLOOR test for frozen scalars unchanged (canon amendment guard)
- [ ] FLOOR/hard-fail test for the per-shape coverage predicate (synthesize a missing shape, assert exit 1)
      - model on `tests/test-render-coverage-gate-hardfail.cjs`

## Wave Decomposition (canon-touching vs plumbing)

Per D-03 (non-canon code lands earlier; SFS-11 isolated behind the navigator gate):

**Wave A - pure plumbing (autonomous-safe, land immediately, no canon byte):**
- SFS-08/09 F.3/F.4 parity (capture+consumer+state).
- SFS-06 Breakthrough collapse (dispatcher reroute + call-site re-home + telemetry enum).
- SFS-07 `hitl_stages` schema + validator + 9 fixtures.
- SFS-10 coverage-gate extension code (assertion over F.8/F.9 deferred to Wave C).
- SFS-12 CLAUDE.md:46 accuracy verification (additive/no-op likely).

**Wave B - NAVIGATOR-GATED (BLOCKS on human APPROVE, D-01a):**
- SFS-11 canon amendment: ONE atomic lockstep - two Appendix D entries (F.8+F.9) + one-line Part 3 prose +
  Breakthrough removal + per-shape currency check + FLOOR/coverage tests. `checkpoint:human-verify` FIRST.

**Wave C - canon-dependent code (after Wave B ratifies):**
- SFS-01/02/03 F.8 renderer + array capture + fan-out consumer (against ratified canon).
- SFS-04/05 F.9 renderer + ordered capture + consumer (depends on F.8 capture machinery).
- Enable the SFS-10 per-shape assertion over F.8/F.9 (now that they exist) - gate goes fully green.

> Rationale: ~60% of the phase (Waves A) proceeds without the human gate. F.8/F.9 renderers are the only
> code that D-03 sequences AFTER the canon (they render against ratified canon entries). The gate extension
> is authored in A but its F.8/F.9 assertion only flips green in C to avoid a mid-phase fail-closed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AskUserQuestion supports multiple questions in one card (basis for the F.9 multi-question form) | F.9 | If the surface caps at one question/card, F.9 falls back to the sequence-of-turns form (documented fallback) - no design break, just more turns |
| A2 | `hitl_stages` should ship as data JSON + `check-*.cjs` (not frontmatter) in 188 | hitl_stages | If the navigator wants frontmatter now, some validator work shifts; but D-11 defers frontmatter enforcement to 190, so low risk |
| A3 | The Breakthrough collapse is limited to the 6 sites in the table (grep-verified) | SFS-06 | A missed dynamic dispatch of `'F.7'` would leave a dead route; mitigated by the coverage gate catching an unrouted shape |
| A4 | Canon version target is v1.19 -> v1.20 for the amendment | SFS-11 | Version number confirmed at the navigator gate; a different bump is a one-line change |
| A5 | Reuse `OUTCOMES = ['accept','defer','reject','Free-Text']` for F.9 (accept==APPROVE) | F.9 | If canon mandates literal APPROVE/REJECT/DEFER persisted tokens, add an alias_map (existing precedent, dispatcher :605) - no rework |
| A6 | F.3/F.4 parity is a capture/consumer/state gap, not a renderer gap | SFS-08/09 | If "parity" is later defined to include marker/tier behavior, more render work; but SKILL.md :175 confirms F.3 is deliberately closed-vocab |

## Open Questions

1. **F.9 multi-question vs sequence-of-turns as the shipped default.**
   - Known: both satisfy SEED-020 + the TTY wall; the ceiling forces paging on the multi-question form.
   - Unclear: which the navigator prefers as the canonical F.9 render.
   - Recommendation: ship multi-question-card as primary with paging, document sequence-of-turns as the
     surface fallback (mirror the F.1 CLI-live / Desktop-seam split). Confirm at the SFS-11 gate.

2. **Where the collapsed Breakthrough content lands (dial entry vs F.1 next-move).**
   - Known: D-10 says "a dial entry / F.1 next-move."
   - Unclear: which of the two for the primary path (scanner.cjs:327 currently dispatches the shape).
   - Recommendation: dial entry for the register-HUD surfacing; F.1 next-move for the offer path. Low risk;
     resolve in planning against scanner.cjs's call context.

3. **`F_SUBSHAPES` and the `F.7-dial` variant vs the per-shape gate's ten-shape set.**
   - Known: `F_SUBSHAPES` mixes canonical shapes with the `F.7-dial` variant.
   - Unclear: whether the per-shape gate asserts over the canonical ten (F.0-F.9) or over `F_SUBSHAPES`.
   - Recommendation: assert over the closed canonical ten (F.0-F.9); treat `F.7-dial` as F.7's render path,
     not a separate shape.

## Environment Availability

No external tools/services required. Pure node CJS, node built-ins only (Phase 87 zero-dep invariant).
`node >= 22.5.0` (per CLAUDE.md stack) is the only runtime dependency and is already the project baseline.
No Brain wire, no network, no database beyond the local `room.db` written through `navigation.cjs`.

## Security Domain

Canon Part 8 (Graph Boundary) is the governing security control, not ASVS web categories (this is a local
CLI render system, no auth/session/web surface).

| Control | Applies | Standard Control |
|---------|---------|-----------------|
| Part 8 LOCAL->BRAIN boundary | yes | CONTENT-SET (user content) LOCAL-only; only MOVE-SET handles are Brain-eligible; prose hashed-not-sent |
| Part 9 single write chokepoint | yes | All typed edges + memory_event nodes route through `navigation.cjs` only |
| Part 11 CIRS born-wired | yes | Every new shape/consumer born WIRED (registered + routed + coverage-gated) or EXCLUDED |
| Zero Brain wire (F.9 bodies) | yes | Cascade bodies are CONTENT-SET; never egress; brain_consult sees hashed/handle packets only |
| Default-deny audit | yes | MOVE-SET handles pass `auditQueryString` default-deny before any brain_consult |

**Threat note:** the primary "threat" in this domain is a constitutional breach (user content egressing to
Brain, or a bespoke selector bypassing the door). Both are structurally prevented: the consumer forwards
only enums/handles, and the coverage gate fails closed on any shape not routing through `pickShape`.

## Sources

### Primary (HIGH confidence - codebase, file:line verified 2026-07-01)
- `lib/hmi/selector-dispatcher.cjs` - the door: `F_SUBSHAPES` (:341), dispatch branches (:680-772),
  `archetypeToContractHints` (:211), `appendAskUserQuestionTrailer` (:528), `ensureFreeTextLast` (:386),
  Breakthrough F.7 branch (:736-771).
- `lib/hmi/reach-component-map.json` - archetype vocabulary; the `ordered` "NOT a live widget" note.
- `lib/hmi/shape-f3-renderer.cjs`, `shape-f4-renderer.cjs`, `shape-f5-renderer.cjs` - thin vs full compare.
- `lib/hmi/f1-pick-capture-cli.cjs`, `lib/workflow/f1-pick-consumer.cjs` - the clone pair; `OUTCOMES` (:46).
- `scripts/check-render-coverage.cjs` - the current per-entry-point gate + predicate structure.
- `lib/core/chain-executor.cjs` - runChain, autonomous_safe/halt (:186, :374) - the runChain boundary.
- `lib/core/breakthrough/scanner.cjs:327`, `scripts/check-pending-breakthrough.cjs:162`,
  `lib/core/telemetry/schema.cjs:89` - Breakthrough blast radius.
- `skills/ui-system/SKILL.md` - Part 3 sub-shape definition (:44, :72-82), F.3 closed-vocab note (:175),
  approved-12 glyph vocabulary (:441).
- `.planning/phases/188-f7-multiselect-toggleable-hitl/188-CONTEXT.md` + `188-RESCOPE-CONTEXT.md` +
  `188-DISCUSSION-LOG.md` - the re-scoped decisions (authoritative).
- `.planning/ROADMAP.md:3278-3294` - the 7-part scope + acceptance criteria.
- `CLAUDE.md` - Canon Compliance Core; Part-3 membrane line (:46); zero-dep + CJS conventions.

### Secondary (F.8 settled findings - cited, not re-derived)
- `188-RESEARCH.md` (prior synthesis; four rulings + F.9 addendum).
- `188-RESEARCH-1-selector-mechanics.md`, `-2-canon-reconciliation.md`, `-3-whats-next-trigger.md`,
  `-4-brain-use-trigger.md`.

### Referenced (visual spec)
- `https://mindrian-f-shapes.vercel.app` + `~/mindrian-f-shapes/index.html` - the ten shapes + nine
  engine-as-pipeline flows (the hitl_stages fixture spec). Not fetched this session; named as the spec.

## Metadata

**Confidence breakdown:**
- Standard stack / file targets: HIGH - every target is a file:line-verified clone of an existing pair.
- F.9 mechanism: HIGH on the constraint (TTY wall verified in the data file), MEDIUM on the exact shipped
  form (multi-question vs sequence - Open Question 1, A1).
- hitl_stages: HIGH on the pattern (four in-repo precedents), MEDIUM on on-disk form (A2).
- Breakthrough blast radius: HIGH - grep-verified 6 sites.
- Coverage gate: HIGH - full file read.
- Canon: HIGH on WHAT the amendment contains; the DOING is navigator-gated (out of autonomous scope).

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable internal codebase; re-verify if the dispatcher or reach-component-map
change before planning).

## RESEARCH COMPLETE
