# Phase 188: Shape-F Selector System - full F.0-F.9 vocabulary + composition - Context

**Gathered:** 2026-06-30 (F.8-only) | **RE-SCOPED:** 2026-07-01 (full F.0-F.9 system)
**Status:** Ready for planning

> **This CONTEXT supersedes the 2026-06-30 F.8-only version.** The re-scope (navigator-directed
> against the f-shapes explainer, https://mindrian-f-shapes.vercel.app + `~/mindrian-f-shapes/index.html`)
> expands 188 from "F.8 multi-select only" to the COMPLETE ten-shape selector system + the
> engine-as-pipeline composition. F.9 is NO LONGER deferred - it is in scope. See
> `188-RESCOPE-CONTEXT.md` for the code inventory and family layering.

<domain>
## Phase Boundary

Phase 188 delivers the **complete Shape-F selector system**: all ten canonical shapes F.0-F.9 real,
declared, and render-coverage-gated, riding the SEED-020 single construction door
(`lib/hmi/selector-dispatcher.cjs` `pickShape`; 100% AskUserQuestion, no bespoke widgets), plus the
"an engine is a pipeline of shapes" composition model (`hitl_stages`). 188 is the FOUNDATION the
whole Shape-F family rides (190 declaration mandate, 192 consumers, 189 memory governance, 204 ignite
front door).

**The 7-part scope (12 requirements SFS-01..12):**

1. **F.8 Multi-Select Action Set (core).** Register `F.8` in `F_SUBSHAPES`
   (`selector-dispatcher.cjs:341`); new `shape-f8-renderer.cjs` on the existing `multiSelect`
   archetype (`reach-component-map.json`); array-capture adapter (clone `f1-pick-capture-cli.cjs`);
   fan-out consumer (clone `f1-pick-consumer.cjs`) writing N independent typed edges on ONE confirm
   through `navigation.cjs`. Pre-checked >=0.70 never auto-applied; no single recommended marker.
   (SFS-01 register+render, SFS-02 capture adapter, SFS-03 fan-out consumer.)
2. **F.9 Cascade / Reconcile Gate.** New `shape-f9-renderer.cjs` - ordered per-item
   APPROVE/REJECT/DEFER live widget (the `ordered` archetype is a stub today); depends on the F.8
   capture machinery; consumer per SEED-039. (SFS-04 renderer, SFS-05 consumer.)
3. **Collapse the F.7 collision.** Fold `shape-f7-breakthrough-renderer.cjs` (a "Breakthrough
   Surface" OUTSIDE the canonical 10) into the F.7 dial / F.1; free canonical F.7 = the dial; update
   all call sites + dispatcher routing (`selector-dispatcher.cjs:736-771`). (SFS-06.)
4. **Engine-as-pipeline-of-shapes (`hitl_stages`, NET-NEW).** A surface declares an ordered list of
   `{stage, shapes[], mode: parallel|ordered|gate}`; the 9 engine flows on the explainer page are the
   spec (BONO, RS family, trending-to-absurd, research, 3 pipelines). Composes F-shapes into staged
   flows; RELATES TO but does NOT duplicate `runChain` (which chains commands, not shapes). This is
   the contract Phase 190 enforces. (SFS-07.)
5. **F.3 / F.4 parity.** Flesh the header-only thin stubs to first-class parity (F.3 depth-state
   wiring; F.4 progressive harvest scopes). (SFS-08 F.3, SFS-09 F.4.)
6. **Per-shape coverage gate.** Extend `scripts/check-render-coverage.cjs` (today gates door-routing
   only) to assert every canonical shape F.0-F.9 has a registered renderer + dispatcher route.
   (SFS-10.)
7. **Canon v1.19 + CLAUDE.md awareness for ALL TEN shapes.** Each shape carries an explicit Canon
   v1.19 currency reconciliation (per-shape What/How/HITL + closed verb vocabulary checked against
   `docs/MINDRIAN-CANON.md` v1.19 Part 3 + Appendix D); F.8/F.9 ratified as NEW canon entries;
   the collapsed Breakthrough removed from any canon prose. CLAUDE.md:46 membrane line stays accurate
   + ADDITIVE (frozen scalars unchanged; no re-bloat, Phase 187.2 discipline). (SFS-11 canon amendment
   [NAVIGATOR-GATED], SFS-12 CLAUDE.md:46 accuracy check.)

**In scope:** all 12 requirements above.

**Out of scope (deferred to family consumers):** 190 (declaration mandate enforcement of
`hitl_stages`), 192 (the /mos:help selector + posture-dial CONSUMERS), 189 (memory governance), 204
(ignite room/command chooser). 188 builds the FOUNDATION; those ride it.

</domain>

<decisions>
## Implementation Decisions

### Canon Gate (the NAVIGATOR-GATED blocker - HALT here)
- **D-01 (carried, 2026-06-30):** The Part-10 navigator-authority override released Appendix-D
  entry-31's self-binding clause for the F.8 amendment (named accepted debt: no live two-gauge
  reading yet; mirrors the 184 R1 live A/B precedent). Rationale unchanged: F.8/F.9 gates ARE the
  mechanism that produces richer two-gauge readings, so blocking them on a reading is circular.
- **D-01a (RE-SCOPE, 2026-07-01) - NAVIGATOR GATE:** The amendment is now BROADER than the 6-30
  approval - it ratifies TWO new canon entries (F.8 + F.9) into Part 3 + Appendix D AND removes the
  non-canonical "Breakthrough Surface" from canon prose. An autonomous agent cannot ratify the
  constitution on the navigator's behalf. **SFS-11 execution PAUSES at a blocking checkpoint for a
  navigator APPROVE before any canon byte is written.** Planning 188 (this CONTEXT + PLAN.md) is
  autonomous-safe; ratifying + executing the canon amendment is NOT. Frozen scalars (MAX_K=3,
  DIAL_REACH_K=6, 0.70/0.15) stay byte-identical; the amendment mints no reach/edge/node and opens
  no Brain wire.
- **D-03 (carried):** Canon-first WITHIN the gated wave. Once the navigator APPROVES (D-01a), ratify
  F.8+F.9 entries in ONE atomic lockstep (canon amendment + one-line Part-3 prose + Breakthrough
  removal + FLOOR/coverage tests) BEFORE the dependent renderers land against ratified canon. Code
  that does not touch canon (capture/consumer plumbing, coverage-gate extension, F.3/F.4 parity) may
  land in earlier waves.

### Scope (RE-SCOPE reversal)
- **D-02 (REVERSED 2026-07-01):** The 6-30 decision "build F.8 ONLY, defer F.9" is SUPERSEDED. F.9 is
  now IN SCOPE (part 2 of the 7-part scope). Build order still respects the dependency: F.8 capture
  machinery (SFS-02) is the prerequisite the F.9 renderer/consumer (SFS-04/05) consume.
- **D-02a:** The Breakthrough Surface is NOT an eleventh canonical shape - it is collapsed INTO the
  F.7 dial / F.1 (D-10). The canon knows exactly ten shapes after this phase.

### Numbering & Reconciliation (carried)
- **D-04:** Ten canonical shapes are F.0-F.9. F.6 = Plan Review Round, F.7 = the dial
  (`dial-presenter.cjs`). F.8 = multi-select action set; F.9 = cascade/reconcile gate. Do NOT reuse a
  taken slot.
- **D-04b:** All shape additions are ADDITIVE: existing live shapes (F.0-F.2, F.5-F.7) stay
  byte-identical (entry-25/27 house style). `multiSelect:true` (F.8) and `ordered` (F.9) are the
  riding archetype primitives, not new canonical modes.
- **D-04c:** SEED-039's incorrect "F.7 multi-select" references reconcile to F.8 (render) + F.9
  (reconcile gate). FLAG in CONTEXT only - do NOT silent-edit SEED-039 (parallel session owns it).

### Frozen-contract guarantees (carried)
- **D-05:** MAX_K=3 bounds ONLY the ranked 1-of-N candidate set. The F.8 toggle set is a distinct,
  non-rivalrous object governed by its own scalar `MAX_TOGGLE_N` (paged; AskUserQuestion has a ~4-5
  options-per-question ceiling, so paging is an F.8 render obligation).
- **D-06:** F.8 carries NO single RECOMMENDED body glyph (0.70/0.15 gate + single-marker glyph stay
  single-select only, mirroring Mode B). Brain confidence >=0.70 renders as a PRE-CHECKED default
  toggle (reuses the 0.70 threshold, no new scalar, no glyph); pre-checked never auto-applies -
  nothing fires until the single confirm.
- **D-07:** Two object classes, Part-8 boundary between them: MOVE-SET (generic move handles -
  framework/reach_id/slug; methodology_tier metadata; Brain-eligible) vs CONTENT-SET (user content -
  nuggets, cascade bodies; LOCAL ONLY, never crosses to Brain).
- **D-08:** Brain-use trigger REUSES `brain_consult` (mint NO 7th reach; the 6-reach bank is frozen,
  per SENS-09). Fires ONLY when (a) >=2 independent candidates, (b) MOVE-SET class, (c) Brain
  reachable (mode_a); else degrade to local ranking. Confidence ORDERS/pre-checks toggles, never
  auto-applies.
- **D-09:** What's-next trigger = RE-ENTER `decide()` after a multi-select confirm commits its edges
  (appliedCount>=1). runChain (Phase 166) halts on the what's-next because an offer is never
  `autonomous_safe`. Candidate next-moves from the closed 10-verb set. No second resolver.

### Breakthrough collapse (RE-SCOPE, navigator-decided 2026-07-01)
- **D-10:** `shape-f7-breakthrough-renderer.cjs` folds into the F.7 dial / F.1. Bare `F.7` currently
  mis-routes to the Breakthrough renderer; after collapse, bare `F.7` -> the canonical dial (stored
  today as `F.7-dial`). Update ALL Breakthrough call sites + dispatcher routing
  (`selector-dispatcher.cjs:736-771`). Breakthrough content becomes a dial entry / F.1 next-move,
  not a distinct shape.

### Engine-as-pipeline (RE-SCOPE, net-new 2026-07-01)
- **D-11:** `hitl_stages` is a DECLARATION contract only in 188 (Phase 190 enforces it at build). A
  surface declares an ordered list of `{stage, shapes[], mode: parallel|ordered|gate}`. 188 ships:
  the schema, a validator, and the 9 explainer-page engine flows expressed in it as the reference
  fixtures. It composes existing F-shapes; it does NOT re-implement `runChain` (command chaining) -
  the two relate (a stage's `gate` mode may hand to runChain's safe-halt) but stay distinct.

### F.3 / F.4 parity (RE-SCOPE, navigator-decided 2026-07-01)
- **D-12:** F.3 and F.4 are header-only thin stubs today. Bring both to first-class parity: F.3 =
  depth-state wiring; F.4 = progressive harvest scopes. Parity means a registered renderer + a
  dispatcher route + a coverage-gate pass, at the same fidelity as F.0-F.2/F.5-F.7.

### Claude's Discretion (planner/researcher to size)
- Exact `MAX_TOGGLE_N` value + paging UX against the AskUserQuestion ceiling.
- Internal module names for the F.8 capture adapter + fan-out consumer, and the F.9 renderer/consumer
  (parallel the f1-pick pair naming).
- The `hitl_stages` schema's on-disk form (JSON schema file vs CJS validator vs frontmatter
  convention) - resolve in research against how `runChain`/reach-component-map are declared.
- Wave decomposition (canon-touching vs plumbing) so SFS-11 is isolatable behind the navigator gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Re-scope + phase research (primary - read first)
- `.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESCOPE-CONTEXT.md` - the full-system
  re-scope: code inventory (Explore agent 2026-07-01, file:line), 7-part scope, family layering,
  LOCAL command-subgraph substrate.
- `.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md` - F.8 design synthesis
  (four rulings, entry-31 blocker, sequence, F.9 addendum).
- `188-RESEARCH-1-selector-mechanics.md` / `-2-canon-reconciliation.md` / `-3-whats-next-trigger.md`
  / `-4-brain-use-trigger.md` - the four F.8 research strands (still valid for F.8/F.9 mechanics).

### Canon & CLAUDE.md (SFS-11/SFS-12 land here - NAVIGATOR-GATED)
- `docs/MINDRIAN-CANON.md` (Version: 1.19) - Part 3 (Shape F family) + Appendix D (entry-31
  self-binding clause; entries 25/27 additive house style). F.8 + F.9 entries land here; Breakthrough
  prose removed. Frozen scalars MAX_K=3 / DIAL_REACH_K=6 / 0.70-0.15 stay byte-identical.
- `CLAUDE.md:46` - the Part-3 membrane line ("rendered through Shape F (MAX_K=3, DIAL_REACH_K=6,
  0.70/0.15 frozen)"). SFS-12: one-line accuracy check, additive only, NO re-bloat.

### Seeds
- `.planning/seeds/SEED-020-*` - the single construction door (`selector-dispatcher.cjs pickShape`).
- `.planning/seeds/SEED-039-per-session-room-binding-and-multi-session-reconciliation.md` - the F.9
  consumer; carries wrong "F.7 multi-select" refs to reconcile (D-04c). Owned by parallel session.
- `.planning/phases/178-universal-gate-chokepoint/178-SEED-f7-multiselect-toggleable-hitl.md` -
  originating seed.

### UI / render contract
- `skills/ui-system/SKILL.md` - Part 3 sub-shape definition (header + keyboard + state-update hook);
  Mode B no-marker precedent; approved-12 glyph vocab incl. `check` + `empty-sq`.

### LOCAL command subgraph (Part 8 - zero Brain wire; substrate for command/reach option sets)
- `room/command-research/` (12 cluster rooms + 103 command sub-rooms) + `room/.room-graph/room.db`
  (12 `cmdcluster:*` + 103 `cmd:*` nodes + ~710 RELATED_TO edges), written via `navigation.cjs` by
  `scripts/file-command-research.cjs`. Any renderer listing commands/reaches reads this LOCAL graph.

</canonical_refs>

<code_context>
## Existing Code Insights

### Single construction door (SEED-020)
- `lib/hmi/selector-dispatcher.cjs` - `pickShape` (844), `appendAskUserQuestionTrailer` (528),
  `F_SUBSHAPES` registry (341), Breakthrough routing (736-771). Every shape rides this door.

### Live vs missing (Explore agent 2026-07-01)
- LIVE: F.0-F.7 (`shape-f0..f7` renderers). F.3/F.4 = header-only thin stubs (SFS-08/09 target).
- NOT BUILT: F.8 (multiSelect archetype exists in `reach-component-map.json`; no `F.8` in
  `F_SUBSHAPES`, no renderer, no capture/consumer); F.9 (`ordered` archetype is an explicit stub,
  "NOT a live ordered widget").
- F.7 COLLISION: bare `F.7` -> `shape-f7-breakthrough-renderer.cjs` (outside the canonical 10);
  the canonical dial is stored as `F.7-dial` (`dial-presenter.cjs`/`dial-selector.cjs`). (SFS-06.)

### Reusable clone pairs
- `lib/hmi/f1-pick-capture-cli.cjs::captureCliPick` (SINGULAR) -> clone to an ARRAY capture adapter
  for F.8 (SFS-02); F.9 ordered capture builds on it (SFS-05).
- `lib/workflow/f1-pick-consumer.cjs` (singular) -> clone to a fan-out consumer writing N typed edges
  on one confirm (SFS-03), all through `lib/core/navigation.cjs` (Part-9 chokepoint).
- `lib/core/sensors/sensor-methodology-decision.cjs` (~97-127) - SENS-03 builds companion sets;
  emit the `multiSelect` archetype when the companion list has >=2 handles.

### Composition / gate machinery
- `lib/core/navigation-engine.cjs` (~1111 `resolveOffer`) - `decide()` produces `offer_next_step`;
  post-confirm re-entry hooks here (D-09).
- `lib/core/chain-executor.cjs` (~337) - an offer is never `autonomous_safe` -> runChain halts on the
  what's-next (HITL safe-halt). `hitl_stages` (SFS-07) relates to but does NOT duplicate runChain.
- `scripts/check-render-coverage.cjs` - today gates door-routing only; SFS-10 extends it to assert a
  registered renderer + dispatcher route for every shape F.0-F.9.

### Established patterns
- Additive sub-shape house style (Appendix D entries 25/27): mint new shape, leave siblings
  byte-identical.
- Part-8 structural safety: default-deny audit query, prose hashed-not-sent, local scan bodyless,
  enrichment degrades-never-blocks. SENS-09 reuses `brain_consult` rather than minting a reach (D-08).

</code_context>

<specifics>
## Specific Ideas

Motivating example (real, 2026-06-29, GIX-Intelligence deep-grade session): a SET of independent
actions (12 meeting nuggets each routable to a different section, 3 independently-applicable pitch
fixes, 2 filing offers) surfaced as a single-select prose offer - the selector shape did not match
the shape of the decision. F.8 is the fix (menu shape matches decision shape); F.9 is its ordered
sibling (per-item APPROVE/REJECT/DEFER over a sequence). The f-shapes explainer
(https://mindrian-f-shapes.vercel.app + `~/mindrian-f-shapes/index.html`) is the visual spec for all
ten shapes + the nine engine-as-pipeline flows.

</specifics>

<deferred>
## Deferred Ideas

- **190 - declaration mandate:** enforces the `hitl_stages` contract at build time (188 ships the
  contract + validator + fixtures; 190 makes declaration mandatory).
- **192 - consumers:** the /mos:help selector + posture dial that CONSUME the ten-shape vocabulary.
- **189 - memory governance:** Shape-F memory templates (deferred from 191 D-04).
- **204 - ignite front door:** the room/command chooser riding 188's F.1/F.7 dial + LOCAL command
  subgraph.
- **SEED-039 multi-session reconcile:** the inward-pointed F.9 cascade (version-stamp nodes,
  lost-update raises a RECONCILE event). Owned by the parallel session that committed SEED-039.

</deferred>

---

*Phase: 188-f7-multiselect-toggleable-hitl (legacy dir name; re-scoped to shape-f-selector-system)*
*Context gathered: 2026-06-30 | Re-scoped: 2026-07-01*
