---
phase: 188-f7-multiselect-toggleable-hitl
plan: 03
type: execute
wave: 2
depends_on: [188-00]
files_modified:
  - scripts/check-render-coverage.cjs
  - scripts/build-render-coverage.cjs
  - CLAUDE.md
autonomous: true
requirements: [SFS-10, SFS-12]
must_haves:
  truths:
    - "check-render-coverage.cjs carries a per-SHAPE predicate over the closed canonical ten F.0-F.9"
    - "The per-shape assertion over F.8/F.9 is GATED OFF until Wave C (renderers do not exist yet)"
    - "A synthetic missing shape fails the per-shape predicate closed (exit 1)"
    - "CLAUDE.md:46 membrane line stays accurate + additive; frozen scalars byte-identical"
  artifacts:
    - path: "scripts/check-render-coverage.cjs"
      provides: "Per-shape coverage predicate alongside the per-entry-point one"
      contains: "F.0"
    - path: "CLAUDE.md"
      provides: "Verified membrane line (additive, no re-bloat)"
      contains: "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen"
  key_links:
    - from: "scripts/check-render-coverage.cjs"
      to: "lib/hmi/selector-dispatcher.cjs"
      via: "hasCallSite over the F.x dispatch branches (read-only)"
      pattern: "hasCallSite"
---

<objective>
SFS-10 (code half) + SFS-12: extend `scripts/check-render-coverage.cjs` with a per-SHAPE predicate that
asserts every canonical shape in the closed set F.0-F.9 has (1) a resolvable renderer module and (2) a
`requestedShape === 'F.x'` dispatch branch. Author the extension NOW but GATE the assertion over the
not-yet-built F.8/F.9 OFF until Wave C (Pitfall 6: the gate must not fail closed mid-phase). Also do the
SFS-12 one-line accuracy check on CLAUDE.md:46 (additive, no re-bloat).

Purpose: born-wired (Part 11) for shapes - a shape that does not route through the door fails the build
closed. This is the structural guard that the whole ten-shape vocabulary stays coverage-gated.
Output: the per-shape predicate + its enable flag, the build-render-coverage generator update, the CLAUDE.md verify.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- CI-STABLE: the gate is release-wired (`node scripts/check-render-coverage.cjs` is in CLAUDE.md Verification).
  Pure code, no network, no agent. The new per-shape loop must not add any I/O beyond reading source files.
- WAVE-ORDER (Pitfall 6): author the per-shape predicate now, but its ASSERTION over F.8/F.9 only ENABLES in
  Wave C (188-07). Ship the predicate with a `SHAPES_UNDER_ASSERTION` set that is F.0-F.7 in this plan and is
  extended to F.0-F.9 by 188-07. The gate must stay GREEN at the end of this plan (F.8/F.9 not yet asserted).
- Assert over the closed canonical TEN F.0-F.9 (Open Question 3): treat `F.7-dial` as F.7's render path, NOT
  a separate shape. Do NOT drive the set off `F_SUBSHAPES` (which mixes the F.7-dial variant).
- SFS-12: CLAUDE.md:46 is ADDITIVE only. Frozen scalars MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15 stay
  byte-identical. NO re-bloat (Phase 187.2 discipline). Likely no edit is needed - verify, do not pad.
- Do NOT edit selector-dispatcher.cjs (188-01 owns it in this wave); READ it only via hasCallSite.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# The gate to extend
@scripts/check-render-coverage.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Per-shape coverage predicate (F.0-F.9 closed set), F.8/F.9 assertion gated OFF</name>
  <read_first>
    - scripts/check-render-coverage.cjs:120-161 (hasCallSite + routesThroughCardEmissionDoor), :169-230 (renderCoverageReport per-entry-point loop), :269-276 (exit contract)
    - scripts/build-render-coverage.cjs (the generator: hasCallSite detector the predicate reuses)
    - lib/hmi/selector-dispatcher.cjs:341 (F_SUBSHAPES) + the F.x dispatch branches (read-only)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md (the SFS-10 extension pattern)
  </read_first>
  <files>scripts/check-render-coverage.cjs, scripts/build-render-coverage.cjs</files>
  <action>
    Add a per-SHAPE predicate ALONGSIDE the existing per-entry-point `renderCoverageReport`. Define the closed
    canonical set `CANONICAL_SHAPES = ['F.0'..'F.9']` and an `SHAPES_UNDER_ASSERTION` set (this plan:
    ['F.0'..'F.7']; 188-07 extends it to the full ten). For each shape in `SHAPES_UNDER_ASSERTION` assert:
    (1) a resolvable renderer module exists (map shape -> module path; F.7 = the dial render path
    dial-selector.cjs, treat F.7-dial as F.7); (2) a `requestedShape === 'F.x'` branch exists in
    selector-dispatcher.cjs via the comment-aware `hasCallSite` / `generator.hasCallSite` detector. On a gap:
    self-naming error + recovery line + exit 1. Keep the existing per-entry-point loop and its STALE
    byte-compare intact. Update `build-render-coverage.cjs` only if the generator must expose the shape->module
    map or a helper the predicate reuses; do not change the existing generated registry semantics.
  </action>
  <verify>
    <automated>node scripts/check-render-coverage.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node scripts/check-render-coverage.cjs</automated>
  </acceptance_criteria>
  <done>Per-shape predicate lands; the gate stays GREEN (F.0-F.7 all route + resolve); F.8/F.9 are in CANONICAL_SHAPES but NOT yet in SHAPES_UNDER_ASSERTION; existing per-entry-point coverage + stale-compare unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the per-shape hard-fail FLOOR test + SFS-12 CLAUDE.md:46 verify</name>
  <read_first>
    - tests/test-per-shape-coverage-gate-hardfail.cjs (the Wave-0 stub to flip GREEN against the new predicate)
    - tests/test-render-coverage-gate-hardfail.cjs (the spawnCheckWithRegistry / temp-override pattern)
    - CLAUDE.md line 46 (the membrane line: "rendered through Shape F (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen)")
  </read_first>
  <files>CLAUDE.md</files>
  <action>
    Wire the per-shape predicate so the Wave-0 hard-fail test proves it: expose the predicate (or a
    synthesize-a-missing-shape override seam) so `tests/test-per-shape-coverage-gate-hardfail.cjs` can assert
    a missing shape exits 1 WITHOUT mutating a tracked file (temp-override pattern). Then run the SFS-12 check:
    verify CLAUDE.md:46 still reads the exact membrane line with the frozen scalars byte-identical. It almost
    certainly needs NO edit (F.8/F.9 are new sub-shapes; the line does not enumerate shapes and the scalars are
    unchanged). If and only if the line is inaccurate, make the minimal ADDITIVE one-line correction - never
    add shape enumerations or re-bloat. Record the verify outcome (edited vs no-op) in the SUMMARY.
    Note: the CLAUDE.md file is owned by THIS plan in this wave; make no other edit to it.
  </action>
  <verify>
    <automated>node tests/test-per-shape-coverage-gate-hardfail.cjs && grep -q "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" CLAUDE.md && echo SFS-12-OK</automated>
  </verify>
  <acceptance_criteria>
    <automated>node tests/test-per-shape-coverage-gate-hardfail.cjs</automated>
  </acceptance_criteria>
  <done>The hard-fail test flips GREEN against the new predicate (synthetic missing shape exits 1, temp-override, no tracked-file mutation); CLAUDE.md:46 verified accurate + additive with frozen scalars byte-identical.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| build gate -> release | an unrouted shape must fail the build closed (Part 11 born-wired) |
| gate authoring -> mid-phase greenness | the gate must not fail closed on not-yet-built F.8/F.9 |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-03-01 | Elevation | a bespoke shape ships without routing through the door | mitigate | per-shape predicate asserts renderer + dispatcher branch; fails closed on a gap |
| T-188-03-02 | Denial of service | gate fails closed mid-phase on missing F.8/F.9 | mitigate | SHAPES_UNDER_ASSERTION = F.0-F.7 here; 188-07 extends to F.0-F.9 after renderers land |
| T-188-03-03 | Tampering | CLAUDE.md membrane re-bloat / frozen-scalar drift | mitigate | additive-only verify; frozen-scalar FLOOR test (188-00) guards the tokens |
| T-188-03-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node scripts/check-render-coverage.cjs` GREEN at end of plan (F.0-F.7 asserted; F.8/F.9 not yet).
- `node tests/test-per-shape-coverage-gate-hardfail.cjs` GREEN (synthetic missing shape exits 1).
- `grep` confirms CLAUDE.md:46 membrane line + frozen scalars byte-identical.
</verification>

<success_criteria>
- Per-shape predicate authored, CI-stable, fails closed on a missing shape; F.8/F.9 assertion deferred to 188-07.
- CLAUDE.md:46 verified additive + accurate; frozen scalars unchanged.
- No em-dashes; zero new dependencies; selector-dispatcher.cjs not edited (read-only).
</success_criteria>

## Artifacts this phase produces
- Extended `scripts/check-render-coverage.cjs` (per-shape predicate + SHAPES_UNDER_ASSERTION flag)
- Possibly updated `scripts/build-render-coverage.cjs` (shape->module map helper, if needed)
- Verified `CLAUDE.md:46` (additive; new symbol: none unless a one-line correction was required)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-03-SUMMARY.md` when done
</output>
