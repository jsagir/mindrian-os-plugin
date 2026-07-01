---
phase: 188-f7-multiselect-toggleable-hitl
plan: 07
type: execute
wave: 6
depends_on: [188-03, 188-06]
files_modified:
  - lib/hmi/shape-f9-renderer.cjs
  - lib/hmi/f9-ordered-capture-cli.cjs
  - lib/workflow/f9-ordered-consumer.cjs
  - lib/hmi/selector-dispatcher.cjs
  - scripts/check-render-coverage.cjs
autonomous: true
requirements: [SFS-04, SFS-05, SFS-10]
must_haves:
  truths:
    - "F.9 renders ordered per-item APPROVE/REJECT/DEFER through AskUserQuestion (no live widget), paged"
    - "F.9 consumer: APPROVE writes the edge, REJECT records NOT-applied+reason, DEFER leaves a CONTRADICTS pair"
    - "The per-shape coverage gate now asserts the FULL closed ten F.0-F.9 and is fully GREEN"
    - "A synthetic missing shape (including F.8/F.9) fails the per-shape gate closed"
  artifacts:
    - path: "lib/hmi/shape-f9-renderer.cjs"
      provides: "F.9 ordered gate renderer (one question per item, array order = meaning, paged)"
      contains: "F.9"
    - path: "lib/workflow/f9-ordered-consumer.cjs"
      provides: "Ordered consumer (APPROVE/REJECT/DEFER outcomes via navigation.cjs)"
    - path: "scripts/check-render-coverage.cjs"
      provides: "Per-shape assertion extended to the full ten F.0-F.9"
      contains: "F.9"
  key_links:
    - from: "lib/hmi/selector-dispatcher.cjs"
      to: "lib/hmi/shape-f9-renderer.cjs"
      via: "requestedShape === 'F.9' branch + F_SUBSHAPES registration"
      pattern: "requestedShape === 'F.9'"
    - from: "lib/workflow/f9-ordered-consumer.cjs"
      to: "lib/core/navigation.cjs"
      via: "per-item closeOffer / CONTRADICTS pair over caller-supplied roomState.db"
      pattern: "closeOffer|CONTRADICTS"
---

<objective>
SFS-04/05: build the F.9 Cascade / Reconcile Gate - the ordered sibling of F.8. Per-item
APPROVE/REJECT/DEFER over a sequence, expressed through AskUserQuestion (one question per item, array order
IS meaning), NEVER a live widget (the TTY wall, Phase 154). Builds on the F.8 capture machinery (D-02).
Then complete SFS-10: flip the per-shape coverage gate to assert the FULL closed ten F.0-F.9 so it goes
fully green now that F.8/F.9 exist.

Purpose: the ordered per-item gate (the GIX cascade case); and the born-wired coverage guard now covers
every canonical shape. This is the last plan - the phase closes fully green.
Output: F.9 renderer + ordered capture + consumer + dispatcher registration + the SFS-10 assertion flip.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- NO LIVE WIDGET (Pitfall 1): the `ordered` archetype is documented "NOT a live ordered widget - the TTY wall
  forbids it, Phase 154." F.9 emits per-item APPROVE/REJECT/DEFER through AskUserQuestion (multi-question card
  PRIMARY, one question per item in array order; sequence-of-turns FALLBACK per the confirmed default). Any
  F.9 path that does not return through pickShape is forbidden. Paging obligation inherited from F.8
  (>4-5 items -> page).
- Closed-vocab, NO marker: cascade bodies are CONTENT-SET, so recommended:null, freeTextOffered:false (mirror
  F.3/F.4). Ordered-outcome vocab is the closed {APPROVE, REJECT, DEFER} mapped onto the REUSED OUTCOMES enum
  (accept==APPROVE) - do NOT mint a parallel enum. If canon mandates literal APPROVE/REJECT/DEFER persisted
  tokens, add an alias_map (dispatcher aliasToCanonical precedent), never a normalize layer.
- DEFER = "rejection is data" (Decision 13 / SEED-039 Pillar 4): DEFER leaves BOTH claims as CONTRADICTS-linked
  competing claims. REJECT records NOT-applied + reason. APPROVE writes the edge.
- Part 9: the consumer NEVER opens room.db; caller passes roomState.db; all writes through navigation.cjs.
- SEED-039 is the CONSUMER, not the owner: do NOT pull SEED-039's version-stamp / multi-session machinery into
  188 (it is deferred). Ship F.9 the SHAPE; the multi-session reconcile rides it later.
- selector-dispatcher.cjs edit here is F.9 registration ONLY (F.8 landed in 188-06; do not touch it).
- SFS-10 flip: extend SHAPES_UNDER_ASSERTION to the full ten F.0-F.9; the gate must end fully GREEN.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# The clone analogs
@lib/hmi/shape-f5-renderer.cjs
@lib/hmi/shape-f3-renderer.cjs
@lib/hmi/reach-component-map.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: F.9 ordered-gate renderer + F_SUBSHAPES registration + dispatch branch</name>
  <read_first>
    - lib/hmi/shape-f5-renderer.cjs (the {zones, contract} envelope) + the F.8 renderer from 188-06 (the paging pattern)
    - lib/hmi/shape-f3-renderer.cjs:52-59 (closed-vocab contract block: mode:'closed', recommended:null, freeTextOffered:false)
    - lib/hmi/reach-component-map.json (the 'ordered' archetype "NOT a live widget" note; archetypeToContractHints sets hints.ordered = true only)
    - lib/hmi/selector-dispatcher.cjs:341 (F_SUBSHAPES) + the F.5 branch (:710) to mirror
    - lib/hmi/shape-f9-renderer.test.cjs (the Wave-0 contract this task turns GREEN)
  </read_first>
  <files>lib/hmi/shape-f9-renderer.cjs, lib/hmi/selector-dispatcher.cjs</files>
  <action>
    - shape-f9-renderer.cjs: clone the shape-f5 envelope + the F.8 paging pattern; change shape -> 'F.9'.
      Emit ONE question per cascade item in ARRAY ORDER (order is meaning), each with the closed ordered-outcome
      option set mapped onto the reused OUTCOMES enum (accept==APPROVE). recommended:null, freeTextOffered:false
      (CONTENT-SET, no marker). Paging obligation: >4-5 items -> page the questions (multi-question card primary).
      The renderer must NOT emit a live/scrolling reorder UI; it returns the {zones, contract} envelope only.
    - selector-dispatcher.cjs: add 'F.9' to F_SUBSHAPES (:341); add a `requestedShape === 'F.9'` branch
      mirroring F.5, passing items[] + header. F.9 registration ONLY.
  </action>
  <verify>
    <automated>node lib/hmi/shape-f9-renderer.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/shape-f9-renderer.test.cjs && node lib/hmi/selector-dispatcher.test.cjs</automated>
  </acceptance_criteria>
  <done>pickShape('F.9', items) returns one question per item in order, closed ordered-outcome options, no marker, paged past the ceiling, no live widget; F.9 registered in F_SUBSHAPES.</done>
</task>

<task type="auto">
  <name>Task 2: F.9 ordered capture + consumer (APPROVE/REJECT/DEFER)</name>
  <read_first>
    - lib/hmi/f8-action-capture-cli.cjs (the F.8 array adapter from 188-06; F.9 = array WITH position preserved, each element {item_id, outcome})
    - lib/workflow/f8-fanout-consumer.cjs (the F.8 fan-out consumer from 188-06; F.9 per-item resolves to one of three ordered outcomes)
    - lib/workflow/f9-consumer.test.cjs (the Wave-0 contract this task turns GREEN)
    - lib/core/navigation.cjs (the Part-9 chokepoint; closeOffer + CONTRADICTS edge writes route here)
  </read_first>
  <files>lib/hmi/f9-ordered-capture-cli.cjs, lib/workflow/f9-ordered-consumer.cjs</files>
  <action>
    - f9-ordered-capture-cli.cjs: clone the F.8 array adapter but PRESERVE POSITION - ordered = array with index
      preserved; each element carries {item_id, outcome}. Reuse OUTCOMES (accept==APPROVE). sentence LOCAL lane
      only.
    - f9-ordered-consumer.cjs: clone the F.8 fan-out consumer; per item, resolve the ordered outcome over the
      caller-supplied roomState.db (never open room.db): APPROVE -> closeOffer writes the edge; REJECT -> record
      NOT-applied + reason; DEFER -> leave BOTH as CONTRADICTS-linked competing claims (Decision 13). All writes
      route through navigation.cjs. Degrade-never-block per item. Do NOT import SEED-039 version-stamp machinery
      (deferred).
  </action>
  <verify>
    <automated>node lib/workflow/f9-consumer.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/workflow/f9-consumer.test.cjs</automated>
  </acceptance_criteria>
  <done>Ordered capture preserves position; APPROVE writes the edge, REJECT records reason, DEFER leaves a CONTRADICTS pair; all writes via navigation.cjs; consumer opens no room.db; no SEED-039 machinery pulled in.</done>
</task>

<task type="auto">
  <name>Task 3: Flip the SFS-10 per-shape assertion to the full ten; phase fully green</name>
  <read_first>
    - scripts/check-render-coverage.cjs (the per-shape predicate + SHAPES_UNDER_ASSERTION set authored in 188-03)
    - tests/test-per-shape-coverage-gate-hardfail.cjs (the FLOOR test that must stay green)
    - lib/hmi/selector-dispatcher.cjs (F.8 + F.9 now registered + branched)
  </read_first>
  <files>scripts/check-render-coverage.cjs</files>
  <action>
    Extend `SHAPES_UNDER_ASSERTION` from F.0-F.7 to the FULL closed ten F.0-F.9 (F.7 = the dial render path;
    F.8 = shape-f8-renderer.cjs; F.9 = shape-f9-renderer.cjs). The per-shape predicate now asserts every
    canonical shape resolves a renderer + a dispatch branch. Confirm the gate is fully GREEN (all ten route)
    and the hard-fail FLOOR test still proves a synthetic missing shape exits 1. Do not weaken the existing
    per-entry-point loop or the stale byte-compare.
  </action>
  <verify>
    <automated>node scripts/check-render-coverage.cjs && node tests/test-per-shape-coverage-gate-hardfail.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>bash tests/run-all-188.sh</automated>
  </acceptance_criteria>
  <done>The per-shape gate asserts the full ten F.0-F.9 and is fully green; the hard-fail FLOOR test still exits 1 on a synthetic missing shape; bash tests/run-all-188.sh is fully green (no SKIPs remaining for shipped modules).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| AskUserQuestion answer -> ordered capture | untrusted per-item outcomes matched to a closed ordered set, position preserved |
| DEFER -> graph | a deferred item must leave a CONTRADICTS pair, not silently drop (rejection is data) |
| coverage gate -> release | every canonical shape must route through the door or the build fails closed |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-07-01 | Elevation | F.9 built as a live/bespoke widget bypassing the door | mitigate | AskUserQuestion multi-question card only; every path returns through pickShape |
| T-188-07-02 | Repudiation | a DEFER silently drops instead of recording the competing claim | mitigate | DEFER leaves a CONTRADICTS-linked pair; consumer test asserts it |
| T-188-07-03 | Tampering | a parallel APPROVE/REJECT/DEFER enum needing a normalize layer | mitigate | reuse OUTCOMES (accept==APPROVE); alias_map only if canon mandates literal tokens |
| T-188-07-04 | Elevation | consumer opening room.db directly | mitigate | caller passes roomState.db; navigation.cjs chokepoint; source-grep proves no better-sqlite3 require |
| T-188-07-05 | Elevation | a shape ships without routing through the door | mitigate | per-shape gate asserts the full ten; fails closed on any gap |
| T-188-07-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node lib/hmi/shape-f9-renderer.test.cjs`, `node lib/workflow/f9-consumer.test.cjs` GREEN.
- `node scripts/check-render-coverage.cjs` fully GREEN over the ten F.0-F.9; `node tests/test-per-shape-coverage-gate-hardfail.cjs` GREEN.
- `bash tests/run-all-188.sh` fully green; `node scripts/check-hitl-stages.cjs` green; `node scripts/doctor.cjs --acceptance` clean.
- Source-grep: no better-sqlite3 / node:sqlite require in the F.9 consumer; no SEED-039 version-stamp import.
</verification>

<success_criteria>
- F.9 ordered per-item gate via AskUserQuestion (no live widget), paged; APPROVE/REJECT/DEFER outcomes correct.
- Per-shape coverage gate asserts the full ten and is fully green.
- Consumer never opens room.db; reuses OUTCOMES; no SEED-039 machinery; no em-dashes; zero new dependencies.
</success_criteria>

## Artifacts this phase produces
- `lib/hmi/shape-f9-renderer.cjs` (new; renderShapeF9; ordered gate, paged)
- `lib/hmi/f9-ordered-capture-cli.cjs` (new; ordered capture, position preserved)
- `lib/workflow/f9-ordered-consumer.cjs` (new; APPROVE/REJECT/DEFER; CONTRADICTS pair on DEFER)
- `lib/hmi/selector-dispatcher.cjs` (F.9 in F_SUBSHAPES + F.9 dispatch branch)
- `scripts/check-render-coverage.cjs` (per-shape assertion extended to the full ten F.0-F.9)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-07-SUMMARY.md` when done
</output>
