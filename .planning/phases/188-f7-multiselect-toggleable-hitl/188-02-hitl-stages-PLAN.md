---
phase: 188-f7-multiselect-toggleable-hitl
plan: 02
type: execute
wave: 2
depends_on: [188-00]
files_modified:
  - data/hitl-stages-schema.json
  - data/hitl-stages-fixtures/bono.json
  - data/hitl-stages-fixtures/rs-family.json
  - data/hitl-stages-fixtures/trending-to-absurd.json
  - data/hitl-stages-fixtures/research.json
  - data/hitl-stages-fixtures/pipeline-1.json
  - data/hitl-stages-fixtures/pipeline-2.json
  - data/hitl-stages-fixtures/pipeline-3.json
  - data/hitl-stages-fixtures/rs-reverse-salient.json
  - data/hitl-stages-fixtures/rs-convergence.json
  - scripts/check-hitl-stages.cjs
autonomous: true
requirements: [SFS-07]
must_haves:
  truths:
    - "A surface can declare an ordered list of {stage, shapes[], mode: parallel|ordered|gate}"
    - "The 9 explainer engine flows are expressed as fixtures that validate against the schema"
    - "A malformed fixture fails the validator closed (exit 1) with a self-naming error"
    - "The validator is pure code: no network, no Brain wire, no pipeline execution"
  artifacts:
    - path: "data/hitl-stages-schema.json"
      provides: "The hitl_stages declaration contract + vocabulary enums (_doc idiom)"
      contains: "mode_vocabulary"
    - path: "scripts/check-hitl-stages.cjs"
      provides: "The pure-code validator gate (--check exits 1 on any violation)"
      exports: ["check"]
  key_links:
    - from: "scripts/check-hitl-stages.cjs"
      to: "data/hitl-stages-fixtures/*.json"
      via: "validate every fixture against the schema"
      pattern: "hitl-stages-fixtures"
---

<objective>
SFS-07: ship `hitl_stages` as a DECLARATION contract only (D-11): a surface declares an ordered list
of `{stage, shapes[], mode: parallel|ordered|gate}` composing F-shapes into staged flows. 188 ships the
schema, a pure-code validator, and the 9 explainer engine flows as reference fixtures. Phase 190 enforces
declaration at build; 188 does NOT execute the pipeline and does NOT re-implement runChain.

Purpose: this is the contract Phase 190 mandates and the whole Shape-F family composes against. It
follows the in-repo "registry-is-the-table" pattern (data JSON + a `scripts/check-*.cjs` gate).
Output: `data/hitl-stages-schema.json`, 9 fixtures under `data/hitl-stages-fixtures/`, `scripts/check-hitl-stages.cjs`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
- CJS only, node built-ins only. No em-dashes. Zero new packages.
- DECLARATION ONLY (Pitfall 2): 188 ships schema + validator + fixtures. Do NOT run a fixture end-to-end,
  do NOT re-implement runChain's gated loop. `hitl_stages` composes SHAPES; runChain chains COMMANDS. The
  ONLY seam is `mode: gate` (a gate stage MAY hand to runChain's safe-halt) - declare it, do not wire it.
- Registry-is-the-table: the schema file carries a `_doc` block (purpose + vocabulary + dispatch_rule),
  mirroring `reach-component-map.json`. A new flow joins by data, never by editing dispatcher code.
- The validator accepts shape ids F.0-F.9 by VOCABULARY (the closed ten-shape set), independent of whether
  the renderer has landed. This decouples the fixture wave from the renderer wave (F.8/F.9 land later).
- Pure-code CI gate: no network, no agent. `--check` exits 1 on any violation with a self-naming error + a
  recovery line (mirror `check-render-coverage.cjs` / `check-help-coverage.cjs` exit contract).
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# Idiom to clone
@lib/hmi/reach-component-map.json
@scripts/check-render-coverage.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: The hitl_stages schema (data JSON, _doc idiom)</name>
  <read_first>
    - lib/hmi/reach-component-map.json:2-24 (the _doc block: purpose + vocabulary array + dispatch_rule + default_on_miss)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-RESEARCH.md "NET-NEW 2" (the schema shape from D-11)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md (the _doc block to clone)
  </read_first>
  <files>data/hitl-stages-schema.json</files>
  <action>
    Author `data/hitl-stages-schema.json` in the reach-component-map `_doc` idiom. Include: `_doc.purpose`
    (registry-is-the-table; read by a resolver, checked by scripts/check-hitl-stages.cjs; declaration-only in
    188, enforced by Phase 190); `mode_vocabulary: ["parallel","ordered","gate"]`; `shape_vocabulary:
    ["F.0".."F.9"]` (the closed ten); `dispatch_rule` naming the gate-mode-is-the-only-runChain-seam boundary.
    Encode the record contract: `{ surface: <slug>, hitl_stages: [ { stage: <name>, shapes: ["F.x", ...],
    mode: "parallel"|"ordered"|"gate" } ] }`. This file IS the schema (the vocabulary + the shape), not a
    JSON-Schema $ref graph - mirror how reach-component-map declares its own vocabulary inline.
  </action>
  <verify>
    <automated>node -e "const s=require('./data/hitl-stages-schema.json'); if(!s._doc||!Array.isArray(s._doc.mode_vocabulary)||s._doc.shape_vocabulary.length!==10) process.exit(1); console.log('schema OK')"</automated>
  </verify>
  <acceptance_criteria>
    <automated>node -e "const s=require('./data/hitl-stages-schema.json'); process.exit(s._doc && s._doc.mode_vocabulary.length===3 && s._doc.shape_vocabulary.length===10 ? 0 : 1)"</automated>
  </acceptance_criteria>
  <done>Schema file parses; carries _doc with mode_vocabulary (3), shape_vocabulary (10 = F.0-F.9), and a dispatch_rule naming the runChain gate seam.</done>
</task>

<task type="auto">
  <name>Task 2: The 9 engine-flow fixtures</name>
  <read_first>
    - data/hitl-stages-schema.json (Task 1 - the contract each fixture must satisfy)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-CONTEXT.md (the 9 flows named: BONO, RS family, trending-to-absurd, research, 3 pipelines)
    - ~/mindrian-f-shapes/index.html (the visual spec for the nine engine-as-pipeline flows, if reachable; else use the CONTEXT flow list)
  </read_first>
  <files>data/hitl-stages-fixtures/bono.json, data/hitl-stages-fixtures/rs-family.json, data/hitl-stages-fixtures/trending-to-absurd.json, data/hitl-stages-fixtures/research.json, data/hitl-stages-fixtures/pipeline-1.json, data/hitl-stages-fixtures/pipeline-2.json, data/hitl-stages-fixtures/pipeline-3.json, data/hitl-stages-fixtures/rs-reverse-salient.json, data/hitl-stages-fixtures/rs-convergence.json</files>
  <action>
    Express the 9 explainer engine flows as fixtures in the schema idiom, one file per flow: BONO, the RS
    family (the RS-family umbrella plus its reverse-salient + convergence members if the explainer separates
    them - land exactly nine fixtures total matching the CONTEXT list: BONO, RS family, trending-to-absurd,
    research, pipeline-1, pipeline-2, pipeline-3, and the two remaining RS-family members to reach nine, per
    the explainer). Each fixture declares an ordered `hitl_stages` list with valid shape ids (F.0-F.9), a valid
    mode enum, and non-empty ordered stages. Where a stage is an independent action set use `mode:parallel`
    (F.8 is the natural parallel primitive); where order is meaning use `mode:ordered` (F.9/F.2); where a stage
    is a go/no-go checkpoint use `mode:gate`. If the explainer page is unreachable this session, derive the
    stage decomposition from the CONTEXT flow names and note the assumption in the fixture `_note`.
  </action>
  <verify>
    <automated>ls data/hitl-stages-fixtures/*.json | wc -l | grep -qx 9 && echo NINE-FIXTURES</automated>
  </verify>
  <acceptance_criteria>
    <automated>node -e "const fs=require('node:fs'),p='data/hitl-stages-fixtures';const f=fs.readdirSync(p).filter(x=>x.endsWith('.json'));if(f.length!==9)process.exit(1);for(const x of f){const j=JSON.parse(fs.readFileSync(p+'/'+x));if(!j.surface||!Array.isArray(j.hitl_stages)||j.hitl_stages.length===0)process.exit(1)}console.log('9 fixtures OK')"</automated>
  </acceptance_criteria>
  <done>Exactly 9 fixtures exist; each has a surface slug + a non-empty ordered hitl_stages list of valid {stage, shapes[], mode} records.</done>
</task>

<task type="auto">
  <name>Task 3: The pure-code validator gate</name>
  <read_first>
    - scripts/check-render-coverage.cjs:60-77 (header contract), :269-276 (the --check exit contract)
    - scripts/check-help-coverage.cjs:43-55 (the check() -> {valid, violations} shape)
    - data/hitl-stages-schema.json + the 9 fixtures (Tasks 1-2)
  </read_first>
  <files>scripts/check-hitl-stages.cjs</files>
  <action>
    Author `scripts/check-hitl-stages.cjs` cloning the check-help-coverage `check() -> {valid, ...violations}`
    shape + the render-coverage `--check` exit contract. It loads the schema + every fixture and validates:
    (1) every shape id is in the closed set F.0-F.9; (2) every mode is in {parallel, ordered, gate}; (3) every
    stage has a non-empty `shapes[]`; (4) `hitl_stages` is a non-empty ordered array; (5) `surface` is a
    non-empty string. On any violation: print a self-naming error + a recovery line and `process.exit(1)`; on
    success print `hitl-stages: OK` and exit 0. Export `check` for the test harness. Pure code: `node:fs` +
    `node:path` only, no network, no Brain, no pipeline execution.
  </action>
  <verify>
    <automated>node scripts/check-hitl-stages.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node scripts/check-hitl-stages.cjs && node -e "const {check}=require('./scripts/check-hitl-stages.cjs'); const r=check({surface:'x',hitl_stages:[{stage:'s',shapes:['F.99'],mode:'gate'}]}); process.exit(r.valid?1:0)"</automated>
  </acceptance_criteria>
  <done>Validator exits 0 on the 9 valid fixtures; a synthetic bad fixture (invalid shape id / mode / empty stages) fails closed with exit 1 and a named error; `check` is exported and pure.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| fixture data -> validator | untrusted declaration data validated before any consumer trusts it |
| hitl_stages -> runChain | the ONLY seam is mode:gate; must not become a second execution loop |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-02-01 | Tampering | a malformed/hostile fixture slips an invalid shape/mode | mitigate | validator fails closed on any out-of-vocabulary shape/mode/empty-stage; exit 1 |
| T-188-02-02 | Elevation | scope creep into a second gated loop (runChain duplication) | mitigate | declaration-only; no execution code; gate mode is declared, not wired |
| T-188-02-03 | Information disclosure | a validator reaching the network/Brain | mitigate | pure node:fs/node:path; source-grep proves no network/Brain require |
| T-188-02-SC | Tampering | npm/pip/cargo installs | accept | zero package installs (Phase 87 zero-dep) |
</threat_model>

<verification>
- `node scripts/check-hitl-stages.cjs` exits 0 over the 9 fixtures.
- A synthetic bad fixture fails closed (exit 1) with a self-naming error.
- Source-grep: no network / Brain / better-sqlite3 require in the validator.
</verification>

<success_criteria>
- Schema + 9 fixtures + validator shipped, all in the registry-is-the-table idiom.
- Validator is pure, CI-stable, fails closed; declaration-only (no execution, no runChain duplication).
- No em-dashes; zero new dependencies.
</success_criteria>

## Artifacts this phase produces
- `data/hitl-stages-schema.json` (the declaration contract + vocabulary)
- `data/hitl-stages-fixtures/*.json` (9 engine-flow reference fixtures)
- `scripts/check-hitl-stages.cjs` (pure-code validator gate, exports `check`)

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-02-SUMMARY.md` when done
</output>
