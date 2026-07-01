# Phase 191 IFACE (contracts-on-disk, the inter-wave bus)

Wave 1 (RECON) output. Every downstream wave (2 = Foundation, 3a/3b = Surfaces,
4 = Verify) builds against THIS file. No production code lives here; this is
the single shared contract, per the harness-as-code architecture (D-05, ref
`/mos:bono`). Anchors below were read directly off the current tree on
2026-07-01 and resolve at the cited file:line.

---

## 1. RULES (verbatim, present in every plan, D-05)

- R1 CJS only, no TypeScript. No em-dashes anywhere (hyphens only). Feynman prose.
- R2 Part 8 / Part 11 R7: read the LOCAL projection cache + LOCAL command subgraph ONLY. ZERO live Brain/Aura query at decide() or rank time. ZERO network. Every new surface passes the Part-8 leak sweep.
- R3 B2 (Phase 166): do NOT change decide()'s return shape. The candidate rides EXISTING fields (decision.fire_skill + trace.projection_offer).
- R4 Frozen Part 3 scalars UNCHANGED: MAX_K=3, DIAL_REACH_K=6, 0.70, 0.15. IMPORT RECOMMENDED_CONFIDENCE_FLOOR from navigation-engine.cjs; never hardcode or redefine the number.
- R5 Reuse before build (Part 7): the Phase-184 reader stays a PURE read-only surfacer (D-01, do NOT add a firing path there). Reuse rankForSelector, reachIdToSkillFamily, runChain, renderDial. NO new LarryReach (D-03).
- R6 Exclusive file ownership per plan (see files_modified). Build against 191-IFACE.md. Never edit a sibling plan's owned file.
- R7 Resumable + fail-closed: each plan is atomic; write a SUMMARY on completion.
- R8 Recommend-not-trigger: nothing material auto-runs; the navigator confirms in the F.7 dial; runChain (Phase 166) executes on confirm.

---

## 2. The lift-module signature (the one shared interface)

Net-new module: `lib/core/orchestration-candidate-lift.cjs` (does not exist yet
as of Wave 1; Wave 2 creates it). CJS, pure, synchronous, no Brain/network
(R2). This is the sole seam Waves 3a and 4 import.

```
liftFiringCandidate(input) -> LiftResult

input: {
  projectionOffer,   // decide-projection-reader.offerProjectionCapabilities() result; options[] all fires:false
  sensorReaches,     // decide()'s sensorReaches[] (top reach = [0])
  context,           // LOCAL enums/scalars only (roomState, packetOptional, problem_type)
  rankFn?,           // seam; default require('../workflow/f-selector-ranker.cjs').rankForSelector
  verbFn?,           // seam; default require('./navigation-engine.cjs').reachIdToSkillFamily
  gate?              // default require('./navigation-engine.cjs').RECOMMENDED_CONFIDENCE_FLOOR (0.70); NEVER a literal
}

LiftResult: {
  fire_skill_verb: string|null,        // canonical verb ONLY when winner confidence >= gate AND maps via verbFn; else null
  lifted_option: object|null,          // winning projection option enriched { ...option, fires:true, confidence, hitl_shape }
  command_recommendation: { command_slug: string, hitl_shape: string, confidence: number }|null,  // the D-03 candidate for the F.7 dial
  confidence: number,                  // 0..1 winner confidence sourced from rankFn (the D4 brain_confidence 0.40 prior); do NOT re-weight
  reason: string                       // 'lifted'|'below_gate'|'no_canonical_verb'|'no_offer'|'no_match'
}
```

Anchors for the seam defaults (resolved in current tree):
- `rankFn` default source: `lib/workflow/f-selector-ranker.cjs:484` (`function rankForSelector(args)`), exported at `lib/workflow/f-selector-ranker.cjs:609` (`rankForSelector,`).
- `verbFn` default source: `lib/core/navigation-engine.cjs:416` (`function reachIdToSkillFamily(reachId)`), exported at `lib/core/navigation-engine.cjs:1322` (`reachIdToSkillFamily: reachIdToSkillFamily,`).
- `gate` default source: `lib/core/navigation-engine.cjs:86` (`const RECOMMENDED_CONFIDENCE_FLOOR = 0.7;`), exported at `lib/core/navigation-engine.cjs:1314` (`RECOMMENDED_CONFIDENCE_FLOOR: RECOMMENDED_CONFIDENCE_FLOOR,`).

---

## 3. The confidence-join contract

Match a `projectionOffer` option's `command` slug (from
`surfaceAsOptionContent`, `lib/core/reader/decide-projection-reader.cjs:263-284`,
field `command` at line 271) to a `rankForSelector` scored entry's `command`
field (`lib/workflow/f-selector-ranker.cjs:576`, `command: cmd.command,`
inside the `scored.push({...})` block at lines 575-587). The matched entry's
`score` (0..1, `lib/workflow/f-selector-ranker.cjs:581`,
`score: Math.max(0, Math.min(1, adjustedScore)),`) IS the candidate
confidence.

No match on `command` slug means the option stays advisory: `fires:false`,
`reason: 'no_match'`. NO re-weighting of the matched score (D-02, discretion
note): the join reads the rankFn score as-is, it does not blend it with the
projection option's own ranking metadata.

---

## 4. The hitl_shape enum contract

Closed enum: `{'confirm', 'ask', 'hold'}`. Recommend-not-trigger (R8);
enum-only so it stays Part-8 safe (never prose, never a room artifact).

Derived from the winning projection option's `posture` /
`sub_mode` fields (surfaced by `surfaceAsOptionContent`,
`lib/core/reader/decide-projection-reader.cjs:263-284`, which carries
`sub_mode` at line 273; `posture` itself flows from the ranked node,
`lib/core/reader/decide-projection-reader.cjs:241-243` inside
`rankCapabilities`, `posture: typeof n.posture === 'string' ? n.posture : ...`).

Mapping (Wave 2 implements this table verbatim):
- `posture === 'push_forward'` -> `hitl_shape: 'confirm'` (the engine has a strong lead; the navigator confirms a single action).
- `posture === 'hold'` -> `hitl_shape: 'hold'` (the engine surfaces the option but the navigator must actively pull it forward; the projection-observed posture for this node is literally "hold").
- any other value, or a null posture -> `hitl_shape: 'ask'` (the conservative default; the navigator is asked rather than assumed).

---

## 5. The decide() wire contract (Wave 3a / 191-03)

After the reader returns `projectionOffer`
(`lib/core/navigation-engine.cjs:863-877`, the `try { ... projectionOffer =
projectionReader.offerProjectionCapabilities(...) }` block), `decide()` calls
`liftFiringCandidate`. When `fire_skill_verb` is non-null, `decide()` sets
`decision.fire_skill` to it (this is the EXISTING field, B2 unaffected: the
field already exists and is set elsewhere by `resolveFireSkill`,
`lib/core/navigation-engine.cjs:581-645`) and enriches `trace.projection_offer`
to additionally carry `lifted_option` + `command_recommendation`.

The reader itself is NOT modified (D-01); `lib/core/reader/decide-projection-reader.cjs`
stays a pure surfacer. The lift call and the `decision.fire_skill` /
`trace.projection_offer` enrichment happen entirely inside
`navigation-engine.cjs`, downstream of the reader call.

Insertion point: immediately after `lib/core/navigation-engine.cjs:877` (the
closing brace of the `try {...} catch (_e) { projectionOffer = null; }` block
that computes `projectionOffer`), applied on BOTH return paths that currently
attach `trace.projection_offer`:
- the tier_0 early-return path: `lib/core/navigation-engine.cjs:901`
  (`trace.projection_offer = projectionOffer;` inside the `if (!quadruple) {...}`
  block).
- the main (mode_a / mode_b) path: `lib/core/navigation-engine.cjs:1041`
  (`trace.projection_offer = projectionOffer;` inside the main body, just
  before the `chosen_rationale` composition at line 1043).

On both paths `decision.fire_skill` is set later via `resolveFireSkill(...)`
(tier_0 call site: `lib/core/navigation-engine.cjs:914`; main path calls
`resolveFireSkill` inside the same function body per the docblock at
`lib/core/navigation-engine.cjs:581-606`). Wave 3a's wiring computes the lift
result once (mirroring how `projectionOffer` itself is computed once at
line 863) and applies its `fire_skill_verb` as an ADDITIONAL source that
`resolveFireSkill`'s step ladder can defer to, without changing
`resolveFireSkill`'s existing precedence for wicked escalation (step 1,
`lib/core/navigation-engine.cjs:582-590`) or the sensor-reach branch (step 2,
`lib/core/navigation-engine.cjs:592-605`).

---

## 6. The F.7 render contract (Wave 3b / 191-04)

`lib/core/navigation-engine-offer.cjs:1-40` documents the offer resolver that
composes the single calibrated next-move; it is LOCAL-ONLY and SYNCHRONOUS
(A3 LOCKED, `lib/core/navigation-engine-offer.cjs:15-20`). The
`command_recommendation` (from Section 2 above) becomes the recommended
single ranked reach passed into this composition:

```
{ reach_id: '<D-03 brain_consult reach id>', label: command_recommendation.command_slug,
  score: command_recommendation.confidence, recommended: true }
```

That reach row is rendered by `dial-presenter.renderDial(reachList, opts)`
(`lib/hmi/dial-presenter.cjs:233-260`, `function renderDial(reachList, opts)`);
the per-row shape it expects is documented in the same block: `reach_id`,
`label`, `conf`, `recommended` (`lib/hmi/dial-presenter.cjs:252-257`, the
`rows = offered.map(...)` block). `DIAL_REACH_K` and `MAX_K` are UNCHANGED
(R4); this wire surfaces exactly one additional ranked reach, never a second
selection brain (D-03). F.8 basket rendering of multiple recommendations is
OUT OF SCOPE for this phase (rides Phase 188 per the CONTEXT.md deferred list).

---

## 7. The router-flip assertion contract (Wave 4 / 191-05)

`routeActivation(engineDecision, legacyActivation)`
(`lib/core/skill-activation-router.cjs:199-274`) flips `source` to `'engine'`
under Precedence Rule 1 (`lib/core/skill-activation-router.cjs:223-251`) when
`engineDecision.fire_skill` is non-null AND `validateVerb(fireSkillRaw)` is
true (`lib/core/skill-activation-router.cjs:225`). Wave 4 asserts:

```
routeActivation(decideOutput, legacy).source === 'engine'
```

for the case where `decide()` (post Wave 3a wiring) emits a canonical-verb
`fire_skill` sourced from the lift. Wave 4 does NOT re-implement
`routeActivation` (D-06): the router logic at
`lib/core/skill-activation-router.cjs:199-274` is read-only for this phase;
the assertion only proves the WIRE (decide -> fire_skill -> router flip),
matching the mechanism note in `191-CONTEXT.md` D-06 (the flip happens
downstream of `decide()`, not inside it; see also
`lib/core/navigation-engine.cjs:1032-1034`, the comment confirming
`routing_source` is not assigned inside `decide()`).

---

## 8. The B2 return-shape contract

`decide()`'s current top-level `decision` keys (from `shared.emptyDecision()`,
populated across `lib/core/navigation-engine.cjs`) that Wave 4 must assert are
UNCHANGED as a KEY SET (only VALUES of existing fields may change; no new
top-level key is added by this phase):

- `decision.fire_skill` (existing; set by `resolveFireSkill`,
  `lib/core/navigation-engine.cjs:581-645`; Wave 3a changes only its VALUE
  source, never its existence or type contract, string-or-null).
- `decision.suppress_skills` (existing; set by `resolveSuppressSkills`,
  `lib/core/navigation-engine.cjs:670-672`; untouched by this phase).
- `decision.persona_updates` (existing; set by `resolvePersonaUpdates`,
  `lib/core/navigation-engine.cjs:680-682`; untouched by this phase).
- `decision.decision_trace` (existing; the `trace` object built throughout
  `decide()`, first bound at `lib/core/navigation-engine.cjs:778`;
  `trace.projection_offer` is the ONLY trace field this phase enriches, per
  Section 5 above; every other trace key -- `brain_md_tier_mode`,
  `brain_md_staleness`, `brain_md_weight_applied`, `icm_scope`, `sql_signals`,
  `minto_reasoning`, `intent_persona`, `navigated_neighborhood`,
  `chosen_rationale`, `context_assembly`, `_meta` -- is unchanged by this
  phase).

Wave 4's assertion pattern: snapshot `Object.keys(decision)` and
`Object.keys(decision.decision_trace)` before and after the Wave 3a wire
lands, and diff them; the diff MUST be empty (B2, Phase 166 hard constraint).

---

## Verified anchors (resolved in current tree, 2026-07-01)

| Section | File | Lines | Anchor content |
|---|---|---|---|
| 2 | lib/workflow/f-selector-ranker.cjs | 484 | `function rankForSelector(args)` |
| 2 | lib/workflow/f-selector-ranker.cjs | 609 | `rankForSelector,` (export) |
| 2 | lib/core/navigation-engine.cjs | 416 | `function reachIdToSkillFamily(reachId)` |
| 2 | lib/core/navigation-engine.cjs | 1322 | `reachIdToSkillFamily: reachIdToSkillFamily,` (export) |
| 2 | lib/core/navigation-engine.cjs | 86 | `const RECOMMENDED_CONFIDENCE_FLOOR = 0.7;` |
| 2 | lib/core/navigation-engine.cjs | 1314 | `RECOMMENDED_CONFIDENCE_FLOOR: RECOMMENDED_CONFIDENCE_FLOOR,` (export) |
| 3 | lib/core/reader/decide-projection-reader.cjs | 263-284 | `surfaceAsOptionContent` (option `command` field, line 271) |
| 3 | lib/workflow/f-selector-ranker.cjs | 575-588 | scored item shape (`command`, `score`, `framework`, `why`) |
| 4 | lib/core/reader/decide-projection-reader.cjs | 241-243 | `posture` on the ranked candidate |
| 4 | lib/core/reader/decide-projection-reader.cjs | 273 | `sub_mode` on the surfaced option |
| 5 | lib/core/navigation-engine.cjs | 863-877 | `projectionOffer` computed once, try/catch |
| 5 | lib/core/navigation-engine.cjs | 901 | `trace.projection_offer` on the tier_0 path |
| 5 | lib/core/navigation-engine.cjs | 1041 | `trace.projection_offer` on the main path |
| 5 | lib/core/navigation-engine.cjs | 581-645 | `resolveFireSkill` (the fire_skill step ladder) |
| 6 | lib/core/navigation-engine-offer.cjs | 1-40 | offer resolver header, LOCAL-ONLY + SYNC |
| 6 | lib/hmi/dial-presenter.cjs | 213-260 | `renderDial(reachList, opts)` + row shape |
| 7 | lib/core/skill-activation-router.cjs | 199-274 | `routeActivation` |
| 7 | lib/core/skill-activation-router.cjs | 223-251 | Precedence Rule 1 (the `source: 'engine'` flip) |
| 8 | lib/core/navigation-engine.cjs | 778 | `decision` / `trace` bound at the top of `decide()` |
