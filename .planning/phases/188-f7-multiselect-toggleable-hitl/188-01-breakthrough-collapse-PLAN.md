---
phase: 188-f7-multiselect-toggleable-hitl
plan: 01
type: execute
wave: 2
depends_on: [188-00]
files_modified:
  - lib/hmi/selector-dispatcher.cjs
  - lib/core/breakthrough/scanner.cjs
  - scripts/check-pending-breakthrough.cjs
  - lib/core/telemetry/schema.cjs
  - lib/hmi/shape-f7-breakthrough-renderer.cjs
  - lib/core/breakthrough/verb-dispatch.cjs
  - lib/core/breakthrough/voice-scaffold.cjs
  - lib/core/breakthrough/ethics-fence.cjs
  - lib/hmi/selector-dispatcher.test.cjs
autonomous: true
requirements: [SFS-06]
must_haves:
  truths:
    - "Bare requestedShape 'F.7' routes to the canonical dial, not the breakthrough renderer"
    - "No dispatch/emit call site emits shape 'F.7' meaning the Breakthrough Surface"
    - "The breakthrough content (5-verb set) re-homes to the dial / F.1 next-move with its provenance floor intact"
    - "The telemetry sub_shape enum reflects the canonical ten (F.7 = dial; F.8, F.9 added)"
  artifacts:
    - path: "lib/hmi/selector-dispatcher.cjs"
      provides: "Bare F.7 -> dial delegation (breakthrough branch retired)"
      contains: "renderDialShape"
    - path: "lib/hmi/selector-dispatcher.test.cjs"
      provides: "F.7-routes-to-dial + no-breakthrough-path assertions"
  key_links:
    - from: "lib/hmi/selector-dispatcher.cjs"
      to: "lib/hmi/dial-selector.cjs"
      via: "F.7 branch delegates to renderDialShape (as F.7-dial does)"
      pattern: "renderDialShape"
    - from: "lib/core/breakthrough/scanner.cjs"
      to: "dial entry / F.1 next-move"
      via: "re-home of requestedShape:'F.7'"
      pattern: "F\\.1|dial"
---

<objective>
SFS-06: collapse the non-canonical "Breakthrough Surface" shape into the F.7 dial / F.1, freeing
canonical F.7 = the dial. Bare `F.7` currently mis-routes to `shape-f7-breakthrough-renderer.cjs`
(a shape OUTSIDE the canonical ten); after this plan bare `F.7` -> the canonical dial, and the
breakthrough's five verbs become a dial entry / F.1 next-move.

Purpose: the canon must know EXACTLY ten shapes (D-02a / D-10) before the canon amendment (188-05)
removes Breakthrough from canon prose. This is pure plumbing, autonomous-safe, ZERO canon byte.
Output: the six grep-verified call sites re-homed; the breakthrough SHAPE retired; the ethics/provenance
floor preserved at the new home.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- SCOPE FENCE (Pitfall 3): touch ONLY the SHAPE slot + the 6 grep-verified sites below. Do NOT touch the
  `lib/core/breakthrough/*` scoring / RS / reverse-salient DOMAIN logic (scanner scoring, RS writers stay live).
- Preserve the provenance HARD FLOOR: the breakthrough renderer refuses to render provenance-less content
  (`selector-dispatcher.cjs:743-746`; `ethics-fence.cjs` is the twin). Carry the `artifact_ids` floor to the
  new home. Do NOT drop the ethics fence in the move.
- SEED-020 single door: bare F.7 delegates to the SAME `dial-selector.cjs::renderDialShape` the `F.7-dial`
  branch uses. NEVER a bespoke construction.
- Frozen Part 3 scalars (MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15) untouched. Mints no reach/edge/node.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# The sites (read the exact line ranges)
@lib/hmi/selector-dispatcher.cjs
@lib/core/breakthrough/scanner.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reroute bare F.7 to the dial; retire the breakthrough dispatch branch</name>
  <read_first>
    - lib/hmi/selector-dispatcher.cjs:736-771 (the current F.7 breakthrough branch + the F.7-dial branch at :755-771 that delegates to renderDialShape)
    - lib/hmi/selector-dispatcher.cjs:332-336 (the umbrella-F comment: "does NOT resolve to F.7")
    - lib/hmi/dial-selector.cjs (renderDialShape signature)
  </read_first>
  <files>lib/hmi/selector-dispatcher.cjs</files>
  <action>
    Rewire the `requestedShape === 'F.7'` branch to delegate to `dial-selector.cjs::renderDialShape` (mirror
    the existing `F.7-dial` branch at :755-771: same safeRequire, same inputArgs envelope, same {shape, rendered}
    return). Retire the breakthrough-renderer branch (the `shape-f7-breakthrough-renderer.cjs` safeRequire +
    the breakthrough/more_count inputArgs). Update the branch comment to record the SFS-06 collapse (bare F.7 =
    canonical dial; Breakthrough is no longer a shape, per D-10). Leave `F.7-dial` working (it is F.7's render
    path, not a separate shape). Do NOT alter F_SUBSHAPES here beyond what SFS-06 requires (F.8/F.9 registration
    is 188-06/188-07); if `F_SUBSHAPES` needs no change for the reroute, leave it byte-identical.
  </action>
  <verify>
    <automated>node lib/hmi/selector-dispatcher.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/selector-dispatcher.test.cjs</automated>
  </acceptance_criteria>
  <done>pickShape('F.7', ...) returns a dial render (shape 'F.7-dial' or equivalent), NOT a breakthrough render; the breakthrough safeRequire is gone from the F.7 branch.</done>
</task>

<task type="auto">
  <name>Task 2: Re-home the 5 remaining breakthrough call sites + telemetry enum</name>
  <read_first>
    - lib/core/breakthrough/scanner.cjs:327 (dispatches requestedShape:'F.7')
    - scripts/check-pending-breakthrough.cjs:162 (emits shape:'F.7')
    - lib/core/telemetry/schema.cjs:89 (sub_shape enum comment F.0..F.7)
    - lib/core/breakthrough/verb-dispatch.cjs:33, voice-scaffold.cjs:49/59, ethics-fence.cjs:14 (F7_VERBS references)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md (the 6-site table)
  </read_first>
  <files>lib/core/breakthrough/scanner.cjs, scripts/check-pending-breakthrough.cjs, lib/core/telemetry/schema.cjs, lib/core/breakthrough/verb-dispatch.cjs, lib/core/breakthrough/voice-scaffold.cjs, lib/core/breakthrough/ethics-fence.cjs</files>
  <action>
    - scanner.cjs:327 - re-home the `requestedShape:'F.7'` dispatch: a scanner HUD surfacing routes to the
      dial entry; an offer-path surfacing routes to an F.1 next-move (Open Question 2 resolution: dial entry
      for register-HUD, F.1 next-move for the offer path). Breakthrough is a MOVE now, not a shape.
    - check-pending-breakthrough.cjs:162 - update the emitted `shape:'F.7'` to the new home shape (dial / F.1).
    - telemetry/schema.cjs:89 - reconcile the `sub_shape` enum comment to the canonical ten: F.7 = dial; ADD
      F.8, F.9. (Comment/enum only; no behavior change.)
    - verb-dispatch.cjs:33 / voice-scaffold.cjs:49,59 / ethics-fence.cjs:14 - re-point the `F7_VERBS`
      references to the new home for the verb set. PRESERVE ethics-fence provenance/artifact_ids enforcement
      (do NOT weaken the floor).
    Do NOT touch RS scoring / reverse-salient writers (scope fence).
  </action>
  <verify>
    <automated>grep -rn "requestedShape: *'F.7'\|shape: *'F.7'" lib/core/breakthrough/scanner.cjs scripts/check-pending-breakthrough.cjs | grep -v '^#' | wc -l | grep -qx 0 && echo NO-BREAKTHROUGH-F7</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/selector-dispatcher.test.cjs && bash tests/run-all-188.sh; test $? -le 1</automated>
  </acceptance_criteria>
  <done>No breakthrough call site emits/dispatches a bare Breakthrough 'F.7' shape; telemetry enum lists the canonical ten; ethics/provenance floor preserved at the new home; RS domain untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Retire the breakthrough renderer + extend the dispatcher test</name>
  <read_first>
    - lib/hmi/shape-f7-breakthrough-renderer.cjs (+ shape-f7-breakthrough-renderer.test.cjs if present) - the 5-verb F7_VERBS + provenance floor
    - lib/hmi/selector-dispatcher.test.cjs (the existing test to extend with the F.7-routes-to-dial assertion)
  </read_first>
  <files>lib/hmi/shape-f7-breakthrough-renderer.cjs, lib/hmi/selector-dispatcher.test.cjs</files>
  <action>
    Fold the 5-verb set into its new home (dial entry / F.1 next-move) and retire the breakthrough renderer
    module: either delete it or reduce it to a thin re-export that points callers at the new home while keeping
    the provenance floor. If a `shape-f7-breakthrough-renderer.test.cjs` exists, reconcile it (retire or repoint)
    so the suite stays green. Extend `selector-dispatcher.test.cjs` with the SFS-06 assertions from 188-00's
    contract: (1) pickShape('F.7') returns a dial render; (2) NO code path returns a Breakthrough-shape render
    for bare F.7; (3) F.7-dial still works. Keep the provenance floor covered by an assertion at the new home.
  </action>
  <verify>
    <automated>node lib/hmi/selector-dispatcher.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/selector-dispatcher.test.cjs</automated>
  </acceptance_criteria>
  <done>Breakthrough renderer retired/repointed; dispatcher test asserts bare F.7 -> dial and no breakthrough path; provenance floor still enforced at the new home; run-all-188 shows no regression.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| dispatcher -> renderer resolution | a bare F.7 must resolve to the door-governed dial, never a retired/bespoke renderer |
| breakthrough content -> new home | provenance-less content must be refused at the new home (ethics fence) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-01-01 | Elevation | provenance-less breakthrough content rendered after re-home | mitigate | carry the artifact_ids HARD FLOOR + ethics-fence enforcement to the new home; test asserts the floor |
| T-188-01-02 | Tampering | a missed dynamic dispatch of 'F.7' leaves a dead breakthrough route | mitigate | grep gate over scanner/check-pending; the per-shape coverage gate (188-03) catches an unrouted shape |
| T-188-01-03 | Denial of service | over-scoping into RS domain breaks a live feature | mitigate | scope fence: only the 6 sites; no RS scoring / writer edits |
| T-188-01-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node lib/hmi/selector-dispatcher.test.cjs` green (F.7 -> dial; no breakthrough path).
- `grep -v '^#'` over scanner.cjs + check-pending-breakthrough.cjs shows zero Breakthrough 'F.7' emissions.
- `bash tests/run-all-188.sh` no regression; `node scripts/check-render-coverage.cjs` still green.
</verification>

<success_criteria>
- Bare F.7 routes to the canonical dial; Breakthrough is no longer a shape.
- All 6 call sites re-homed; telemetry enum reconciled to the canonical ten.
- Provenance floor preserved; RS domain untouched; frozen scalars unchanged; no em-dashes.
</success_criteria>

## Artifacts this phase produces
- Rewired `lib/hmi/selector-dispatcher.cjs` F.7 branch (bare F.7 -> dial)
- Re-homed breakthrough call sites (scanner, check-pending, telemetry enum, verb-dispatch/voice-scaffold/ethics-fence)
- Retired/repointed `lib/hmi/shape-f7-breakthrough-renderer.cjs`
- Extended `lib/hmi/selector-dispatcher.test.cjs` (F.7-routes-to-dial + no-breakthrough-path)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-01-SUMMARY.md` when done
</output>
