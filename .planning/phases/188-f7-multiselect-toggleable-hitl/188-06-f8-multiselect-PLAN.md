---
phase: 188-f7-multiselect-toggleable-hitl
plan: 06
type: execute
wave: 5
depends_on: [188-04, 188-05]
files_modified:
  - lib/hmi/shape-f8-renderer.cjs
  - lib/hmi/f8-action-capture-cli.cjs
  - lib/workflow/f8-fanout-consumer.cjs
  - lib/hmi/selector-dispatcher.cjs
autonomous: true
requirements: [SFS-01, SFS-02, SFS-03]
must_haves:
  truths:
    - "F.8 is registered in F_SUBSHAPES and renders a multiSelect toggle card through the door"
    - "The array-capture adapter maps N selectedOptions to N picks deterministically"
    - "One confirm fans out N independent typed edges through navigation.cjs"
    - "Brain confidence >=0.70 renders a pre-checked toggle; it never auto-applies; no single recommended marker"
  artifacts:
    - path: "lib/hmi/shape-f8-renderer.cjs"
      provides: "F.8 multiSelect renderer (MAX_TOGGLE_N paged, no recommended marker)"
      contains: "F.8"
    - path: "lib/hmi/f8-action-capture-cli.cjs"
      provides: "Array-capture adapter (N selectedOptions -> N picks)"
    - path: "lib/workflow/f8-fanout-consumer.cjs"
      provides: "Fan-out consumer (N edges on one confirm via navigation.cjs)"
  key_links:
    - from: "lib/hmi/selector-dispatcher.cjs"
      to: "lib/hmi/shape-f8-renderer.cjs"
      via: "requestedShape === 'F.8' branch + F_SUBSHAPES registration"
      pattern: "requestedShape === 'F.8'"
    - from: "lib/workflow/f8-fanout-consumer.cjs"
      to: "lib/core/navigation.cjs"
      via: "closeOffer per item over caller-supplied roomState.db"
      pattern: "closeOffer"
---

<objective>
SFS-01/02/03: build the F.8 Multi-Select Action Set - the core deliverable. Register F.8 on the SEED-020
door, render the multiSelect toggle card, capture the array of selected options deterministically, and
fan out N independent typed edges on ONE confirm through the Part-9 chokepoint. This lands AFTER the canon
ratifies F.8 (188-05, D-03 canon-first). Every net-new file clones a shipped f1-pick analog.

Purpose: the menu shape matches the decision shape - a SET of independent actions surfaces as a toggle
basket, not a single-select prose offer (the GIX motivating bug).
Output: F.8 renderer + array capture + fan-out consumer + dispatcher registration.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- SEED-020 single door: F.8 joins by an F_SUBSHAPES row + a `requestedShape === 'F.8'` branch mirroring the
  F.5 branch. NEVER bespoke AskUserQuestion construction. The multiSelect hint is already folded by
  archetypeToContractHints - render is NOT the work; capture + consume is.
- D-05: MAX_K=3 bounds ONLY the ranked candidate set - DO NOT TOUCH IT. The toggle set uses its own scalar
  MAX_TOGGLE_N (paged against the AskUserQuestion ~4-5 ceiling). Overflow PAGES, never truncates.
- D-06: NO single recommended marker on F.8. Brain confidence >=0.70 renders a PRE-CHECKED toggle (reuse the
  0.70 threshold, NO new scalar, NO glyph); pre-checked NEVER auto-applies - nothing fires until the single
  confirm. Use the approved-12 toggle glyphs check + empty-sq.
- Part 9: the consumer NEVER opens room.db. The caller passes roomState.db; closeOffer routes every write
  through lib/core/navigation.cjs. No better-sqlite3 / node:sqlite require. Fan-out is degrade-never-block PER
  ITEM (one bad toggle does not abort the confirmed set).
- Part 8: MOVE-SET handles (framework/reach_id/slug enums) only cross to Brain; CONTENT-SET stays LOCAL. Reuse
  brain_consult for ranking (D-08), mint NO 7th reach. The two-channel split (outcome keyword vs reach verb)
  is preserved per array element (passing the verb as {pick} silently coerces reject->accept).
- Reuse OUTCOMES = ['accept','defer','reject','Free-Text'] - do NOT mint a parallel enum.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# The clone analogs
@lib/hmi/shape-f5-renderer.cjs
@lib/hmi/f1-pick-capture-cli.cjs
@lib/workflow/f1-pick-consumer.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: F.8 renderer + F_SUBSHAPES registration + dispatch branch</name>
  <read_first>
    - lib/hmi/shape-f5-renderer.cjs:73-96 (verb-cap pattern), :98-149 (the {zones, contract} envelope), :64-65 (marker constants - F.8 uses NONE)
    - lib/hmi/selector-dispatcher.cjs:341 (F_SUBSHAPES), :710-713 (the F.5 branch to mirror), :211-227 (archetypeToContractHints multiSelect fold)
    - skills/ui-system/SKILL.md:441 (approved-12 glyph vocab: check + empty-sq)
    - lib/hmi/shape-f8-renderer.test.cjs (the Wave-0 contract this task turns GREEN)
  </read_first>
  <files>lib/hmi/shape-f8-renderer.cjs, lib/hmi/selector-dispatcher.cjs</files>
  <action>
    - shape-f8-renderer.cjs: clone the shape-f5-renderer {zones, contract} envelope; change shape -> 'F.8'.
      Emit a multiSelect toggle option set: cap by MAX_TOGGLE_N (a NEW scalar distinct from MAX_K, defined
      here; do NOT touch MAX_K), and PAGE overflow beyond the AskUserQuestion ceiling. NO single recommended
      marker (recommended:null for the single-marker sense); a candidate with Brain confidence >=0.70 renders
      as a PRE-CHECKED toggle (a preChecked flag on the option, reusing 0.70; never auto-applied). Toggle glyphs
      check / empty-sq.
    - selector-dispatcher.cjs: add 'F.8' to F_SUBSHAPES (:341); add a `requestedShape === 'F.8'` branch
      mirroring F.5 (:710), passing the candidate set + header + confidence map. This is the ONLY dispatcher
      edit in this plan.
  </action>
  <verify>
    <automated>node lib/hmi/shape-f8-renderer.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/shape-f8-renderer.test.cjs && node lib/hmi/selector-dispatcher.test.cjs</automated>
  </acceptance_criteria>
  <done>pickShape('F.8', ...) returns a multiSelect card with a MAX_TOGGLE_N-bounded/paged toggle set, no single recommended marker, >=0.70 pre-checked toggles; F.8 registered in F_SUBSHAPES; MAX_K untouched.</done>
</task>

<task type="auto">
  <name>Task 2: F.8 array-capture adapter</name>
  <read_first>
    - lib/hmi/f1-pick-capture-cli.cjs (singular captureCliPick; :46 OUTCOMES; :48-56 _normalizeOutcome; :61-65 _matchVerb; :103-108 sentence LOCAL lane; :119-125 CAPTURE_ADAPTER_CONTRACT)
    - lib/hmi/f8-capture.test.cjs (the Wave-0 contract this task turns GREEN)
  </read_first>
  <files>lib/hmi/f8-action-capture-cli.cjs</files>
  <action>
    Clone f1-pick-capture-cli.cjs to an ARRAY form: the AskUserQuestion F.8 answer carries
    `selectedOptions[]`; map EACH to its matching verb deterministically (reuse _matchVerb membership match,
    NOT fuzzy NLP) and return an ARRAY `[{verb, outcome}, ...]`. Reuse the OUTCOMES enum + _normalizeOutcome
    (do NOT mint a parallel enum). Carry raw navigator text on the optional `sentence` LOCAL lane per element
    ONLY - never a pick value / edge body / Brain packet (Part 8). Clone CAPTURE_ADAPTER_CONTRACT (CLI live,
    Desktop/Cowork documented seams). A pre-checked-but-unconfirmed toggle is NOT a selection until confirm.
  </action>
  <verify>
    <automated>node lib/hmi/f8-capture.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/f8-capture.test.cjs</automated>
  </acceptance_criteria>
  <done>The adapter maps N selectedOptions to N {verb, outcome} picks deterministically; reuses OUTCOMES; raw text rides the sentence LOCAL lane per element; unknown options degrade (no false match).</done>
</task>

<task type="auto">
  <name>Task 3: F.8 fan-out consumer (N edges on one confirm)</name>
  <read_first>
    - lib/workflow/f1-pick-consumer.cjs:44-49 (Part 9 header: never open room.db), :121-227 (the per-item consumeF1Pick body to clone), :157-166 (reach channel), :189-214 (closeOffer + two-channel split)
    - lib/workflow/f8-consumer.test.cjs (the Wave-0 contract this task turns GREEN)
    - lib/core/navigation.cjs (the Part-9 write chokepoint; closeOffer routes here)
  </read_first>
  <files>lib/workflow/f8-fanout-consumer.cjs</files>
  <action>
    Clone f1-pick-consumer.cjs to a FAN-OUT: loop the captured array and call closeOffer per item on ONE
    confirm, over the caller-supplied roomState.db (NEVER open room.db; no better-sqlite3 / node:sqlite
    require). Each item clones the per-item consumeF1Pick body: the OUTCOME channel passes the decision keyword
    (accept/defer/reject), the REACH channel looks up reach_id from the verb - keep them EXPLICIT and never
    conflated. Degrade-never-block PER ITEM: a cold / unmatched / malformed item returns a structured
    {ok:false, reason} no-op, writing nothing, and does NOT abort the rest of the confirmed set. Return an
    appliedCount. (D-09 what's-next re-entry is the CONSUMER of appliedCount>=1 downstream - do NOT wire the
    decide() re-entry here; that is a family consumer's job. Ship the fan-out + appliedCount.)
  </action>
  <verify>
    <automated>node lib/workflow/f8-consumer.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/workflow/f8-consumer.test.cjs && bash tests/run-all-188.sh; test $? -le 1</automated>
  </acceptance_criteria>
  <done>N confirmed toggles produce N closeOffer calls (N typed edges) on ONE confirm through navigation.cjs; the consumer opens no room.db; one bad toggle does not abort the set; appliedCount returned; two-channel split preserved.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| AskUserQuestion answer -> capture | untrusted selectedOptions matched deterministically to a closed verb set |
| consumer -> room.db | consumer never opens room.db; caller owns the handle (Part 9) |
| candidate handles -> Brain | only MOVE-SET handles cross; CONTENT-SET stays LOCAL (Part 8) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-06-01 | Spoofing | a fabricated/unknown option coerced into a valid verb | mitigate | deterministic _matchVerb membership; unknown -> degrade no-op |
| T-188-06-02 | Tampering | passing the verb as {pick} silently flips reject->accept | mitigate | two-channel split preserved per item; outcome keyword != reach verb |
| T-188-06-03 | Elevation | a pre-checked >=0.70 toggle auto-applies without confirm | mitigate | pre-checked is display-only; nothing fires until the single confirm |
| T-188-06-04 | Information disclosure | CONTENT-SET raw text egressing to Brain | mitigate | sentence LOCAL lane only; brain_consult sees MOVE-SET handles only |
| T-188-06-05 | Denial of service | one malformed toggle aborts the whole confirmed set | mitigate | degrade-never-block per item; structured {ok:false} no-op |
| T-188-06-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node lib/hmi/shape-f8-renderer.test.cjs`, `node lib/hmi/f8-capture.test.cjs`, `node lib/workflow/f8-consumer.test.cjs` GREEN.
- `node scripts/check-render-coverage.cjs` GREEN (F.8 routes through the door).
- Source-grep: no better-sqlite3 / node:sqlite require in the consumer; MAX_K byte-untouched.
</verification>

<success_criteria>
- F.8 renders + fans out N edges on ONE confirm via navigation.cjs.
- MAX_TOGGLE_N distinct from MAX_K; no single recommended marker; >=0.70 pre-checks (never auto-applies).
- Consumer never opens room.db; degrade-never-block per item; no em-dashes; zero new dependencies.
</success_criteria>

## Artifacts this phase produces
- `lib/hmi/shape-f8-renderer.cjs` (new; renderShapeF8; MAX_TOGGLE_N scalar)
- `lib/hmi/f8-action-capture-cli.cjs` (new; array-capture adapter)
- `lib/workflow/f8-fanout-consumer.cjs` (new; fan-out consumer; appliedCount)
- `lib/hmi/selector-dispatcher.cjs` (F.8 in F_SUBSHAPES + F.8 dispatch branch)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-06-SUMMARY.md` when done
</output>
