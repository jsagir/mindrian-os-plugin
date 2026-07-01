---
phase: 188-f7-multiselect-toggleable-hitl
plan: 04
type: execute
wave: 3
depends_on: [188-00, 188-01]
files_modified:
  - lib/hmi/f3-depth-capture-cli.cjs
  - lib/workflow/f3-depth-consumer.cjs
  - lib/hmi/depth-state.cjs
  - lib/hmi/f4-scope-capture-cli.cjs
  - lib/workflow/f4-scope-consumer.cjs
  - lib/hmi/harvest-scope-state.cjs
  - lib/hmi/selector-dispatcher.cjs
autonomous: true
requirements: [SFS-08, SFS-09]
must_haves:
  truths:
    - "An F.3 depth pick (Shallow..Extreme) is captured and written to a per-room depth state"
    - "An F.4 scope pick accumulates progressively (each rung ADDS to the prior scope)"
    - "The F.3/F.4 consumers set state and re-enter the calling command; they never open room.db"
    - "F.3/F.4 keep their closed-vocab carve-out: recommended:null, freeTextOffered:false, no marker"
  artifacts:
    - path: "lib/hmi/depth-state.cjs"
      provides: "Per-room depth scalar state (getCurrent/setCurrent, atomic)"
      contains: "setCurrent"
    - path: "lib/hmi/harvest-scope-state.cjs"
      provides: "Per-room progressive harvest-scope state (accumulating)"
    - path: "lib/workflow/f3-depth-consumer.cjs"
      provides: "F.3 pick -> depth-state write, re-enter caller"
    - path: "lib/workflow/f4-scope-consumer.cjs"
      provides: "F.4 pick -> accumulated scope-state write, hand to synthesis"
  key_links:
    - from: "lib/workflow/f3-depth-consumer.cjs"
      to: "lib/hmi/depth-state.cjs"
      via: "setCurrent(depth) on a captured pick"
      pattern: "depth-state|setCurrent"
    - from: "lib/hmi/selector-dispatcher.cjs"
      to: "F.3/F.4 dispatch branches"
      via: "thread current depth/scope state into the branch"
      pattern: "requestedShape === 'F.3'|requestedShape === 'F.4'"
---

<objective>
SFS-08 / SFS-09: bring F.3 (depth) and F.4 (progressive harvest scope) to first-class parity with the
built shapes. Parity is NOT a renderer change - the F.3/F.4 renderers already emit correct closed-vocab
`{zones, contract}`. Parity is the MISSING capture + consumer + state layer that F.1 has and they do not.

Purpose: full ten-shape parity (D-12): F.3 depth-state wiring + F.4 progressive harvest scopes, each at
the same fidelity as F.0-F.2/F.5-F.7 (registered renderer + dispatcher route + coverage-gate pass).
Output: F.3/F.4 capture adapters, consumers, and per-room state modules; minimal dispatcher threading.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- PARITY IS THE CAPTURE/CONSUMER/STATE LAYER, NOT THE RENDER SURFACE (Pitfall 4). Do NOT add a RECOMMENDED
  marker or Free-Text to F.3/F.4 - the closed-vocab carve-out is intentional and enforced
  (`ensureFreeTextLast` respects freeTextOffered===false; recommended:null). Keep the renderers byte-identical.
- Part 9 chokepoint: the F.3/F.4 consumers NEVER open room.db. The caller passes roomState.db; state writes go
  through the per-room state module (atomic tmp+rename, modeled on jtbd-state.cjs) and any typed-edge writes
  route through lib/core/navigation.cjs. No better-sqlite3 / node:sqlite require in the consumer.
- Part 8: the pick is a closed enum (depth scalar / scope rung). Raw navigator text rides the LOCAL sentence
  lane only, never a Brain packet. CONTENT-SET stays local.
- The consumer SETS state and RE-ENTERS the calling command; it does NOT itself pick a canonical verb
  (the verb that follows F.3 is chosen by the calling command; SKILL.md:175).
- selector-dispatcher.cjs is owned by THIS plan in this wave (188-01 finished in wave 2). Thread ONLY the
  F.3/F.4 state input into their branches; do not touch other branches.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# The shapes + the clone models
@lib/hmi/shape-f3-renderer.cjs
@lib/hmi/shape-f4-renderer.cjs
@lib/hmi/f1-pick-capture-cli.cjs
@lib/hmi/jtbd-state.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: F.3 depth parity (capture + state + consumer)</name>
  <read_first>
    - lib/hmi/shape-f3-renderer.cjs (options ['Shallow','Medium','Deep','Extreme','Back']; recommended:null; freeTextOffered:false)
    - lib/hmi/f1-pick-capture-cli.cjs (the capture adapter to clone; _matchVerb membership match; OUTCOMES enum; sentence LOCAL lane)
    - lib/hmi/jtbd-state.cjs:27,56-70,83-85 (per-room JSON state, atomic tmp+rename, getCurrent/setCurrent)
    - lib/hmi/shape-f3-parity.test.cjs (the Wave-0 contract this task turns GREEN)
    - skills/ui-system/SKILL.md:170-180 (F.3 depth semantics; the calling command chooses the following verb)
  </read_first>
  <files>lib/hmi/f3-depth-capture-cli.cjs, lib/hmi/depth-state.cjs, lib/workflow/f3-depth-consumer.cjs</files>
  <action>
    - depth-state.cjs: clone the jtbd-state.cjs per-room atomic pattern (statePath under room .mindrian dir,
      atomic tmp+rename writer, getCurrent/setCurrent). Store a depth scalar (shallow/medium/deep/extreme).
    - f3-depth-capture-cli.cjs: clone f1-pick-capture-cli.cjs; map the closed F.3 pick (Shallow..Extreme / Back)
      to a depth value. Reuse the deterministic membership matcher; carry raw text on the sentence LOCAL lane
      only. Back returns to the previous shape (no state write).
    - f3-depth-consumer.cjs: clone the f1-pick-consumer.cjs structure MINUS the reach/edge channel; on a
      captured depth pick, call depth-state.setCurrent(depth) over the caller-supplied roomState (never open
      room.db), then signal re-entry to the calling command. Degrade-never-block on cold/absent state.
  </action>
  <verify>
    <automated>node lib/hmi/shape-f3-parity.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/shape-f3-parity.test.cjs</automated>
  </acceptance_criteria>
  <done>A picked depth is captured and written to depth-state, readable via getCurrent; the consumer opens no room.db; F.3 render stays closed-vocab (no marker, no Free-Text).</done>
</task>

<task type="auto">
  <name>Task 2: F.4 progressive-harvest parity (capture + accumulating state + consumer)</name>
  <read_first>
    - lib/hmi/shape-f4-renderer.cjs (options ['Key insights','+contradictions','+actions','Create artifact draft','Back']; recommended:null; freeTextOffered:false)
    - lib/hmi/depth-state.cjs (Task 1 - the per-room atomic state model to mirror)
    - lib/hmi/shape-f4-parity.test.cjs (the Wave-0 contract this task turns GREEN)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md "NET-NEW 3" (F.4 progressive-harvest semantics: each rung ADDS)
  </read_first>
  <files>lib/hmi/f4-scope-capture-cli.cjs, lib/hmi/harvest-scope-state.cjs, lib/workflow/f4-scope-consumer.cjs</files>
  <action>
    - harvest-scope-state.cjs: per-room atomic state (mirror depth-state.cjs) storing an ACCUMULATING scope
      set. Each rung ADDS to the prior scope ('Key insights' -> +contradictions -> +actions), not replaces.
      Provide addScope / getScope.
    - f4-scope-capture-cli.cjs: clone the F.3 capture adapter; map the F.4 progressive-ladder pick to a scope
      rung; closed-vocab; sentence LOCAL lane only.
    - f4-scope-consumer.cjs: on a captured scope pick, accumulate the scope via harvest-scope-state.addScope
      over the caller-supplied roomState (never open room.db); 'Create artifact draft' hands the accumulated
      scope to the synthesis path; re-enter the calling command. Degrade-never-block.
  </action>
  <verify>
    <automated>node lib/hmi/shape-f4-parity.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node lib/hmi/shape-f4-parity.test.cjs</automated>
  </acceptance_criteria>
  <done>Successive F.4 picks ACCUMULATE (each rung adds to the prior scope); 'Create artifact draft' hands the accumulated scope to synthesis; the consumer opens no room.db; F.4 render stays closed-vocab.</done>
</task>

<task type="auto">
  <name>Task 3: Thread F.3/F.4 state into their dispatch branches + coverage green</name>
  <read_first>
    - lib/hmi/selector-dispatcher.cjs:702-709 (the F.3/F.4 dispatch branches passing ONLY {header})
    - lib/hmi/depth-state.cjs + lib/hmi/harvest-scope-state.cjs (the current-state getters to thread)
    - scripts/check-render-coverage.cjs (the per-shape gate that must stay green with F.3/F.4 at parity)
  </read_first>
  <files>lib/hmi/selector-dispatcher.cjs</files>
  <action>
    Thread the current depth (F.3) / scope (F.4) state into their dispatch branches so the render can reflect
    the current state (e.g. current depth), passing it alongside {header} in inputArgs. Keep the render
    closed-vocab (do NOT introduce a marker). Do not touch any other branch. Confirm the per-shape coverage
    gate still resolves F.3/F.4 as fully routed (renderer + branch). This is the ONLY edit to
    selector-dispatcher.cjs in this plan.
  </action>
  <verify>
    <automated>node lib/hmi/selector-dispatcher.test.cjs && node scripts/check-render-coverage.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node scripts/check-render-coverage.cjs && bash tests/run-all-188.sh; test $? -le 1</automated>
  </acceptance_criteria>
  <done>F.3/F.4 branches thread current state; coverage gate green; dispatcher test green; F.3/F.4 render unchanged (closed-vocab preserved).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| F.3/F.4 pick -> state write | a closed enum crosses into per-room state; raw text stays on the LOCAL lane |
| consumer -> room.db | the consumer must never open room.db; the caller owns the handle (Part 9) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-04-01 | Tampering | a fuzzy/NLP match coerces an unknown pick into a valid depth/scope | mitigate | deterministic membership match (clone _matchVerb); unknown -> degrade no-op |
| T-188-04-02 | Information disclosure | raw navigator text egressing via a pick value / edge body | mitigate | Part 8 sentence LOCAL lane only; closed enum is the pick value; no Brain packet |
| T-188-04-03 | Elevation | consumer opening room.db directly (bypassing the chokepoint) | mitigate | caller passes roomState.db; state module atomic write; source-grep proves no better-sqlite3 require |
| T-188-04-04 | Tampering | a marker/Free-Text creeping into F.3/F.4 "for parity" | mitigate | keep recommended:null / freeTextOffered:false; parity test asserts closed-vocab |
| T-188-04-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node lib/hmi/shape-f3-parity.test.cjs` + `node lib/hmi/shape-f4-parity.test.cjs` GREEN.
- `node scripts/check-render-coverage.cjs` GREEN (F.3/F.4 at parity).
- Source-grep: no better-sqlite3 / node:sqlite require in either consumer.
</verification>

<success_criteria>
- F.3 depth-state wiring + F.4 progressive-harvest accumulation at first-class parity.
- Closed-vocab carve-out preserved (no marker, no Free-Text); consumers never open room.db.
- Coverage gate green; no em-dashes; zero new dependencies.
</success_criteria>

## Artifacts this phase produces
- `lib/hmi/f3-depth-capture-cli.cjs`, `lib/hmi/depth-state.cjs`, `lib/workflow/f3-depth-consumer.cjs`
- `lib/hmi/f4-scope-capture-cli.cjs`, `lib/hmi/harvest-scope-state.cjs`, `lib/workflow/f4-scope-consumer.cjs`
- F.3/F.4 dispatch-branch state threading in `lib/hmi/selector-dispatcher.cjs`

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-04-SUMMARY.md` when done
</output>
