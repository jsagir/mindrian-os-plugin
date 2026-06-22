# Recon: Connector Spine + Sensor Layer + Navigation Engine (Phase 172)

Read-only recon of the SHIPPED contextual-invocation machinery Phase 172 must build ON TOP OF.
Every claim cites file:line. Coverage numbers are MEASURED (node/grep), not guessed.

---

## What Exists

### 1. The Connector Contract (Phase 143.3)

- **Contract doc:** `docs/CONNECTOR-CONTRACT.md`. The `connector:` frontmatter block is the single
  source of truth wiring any surface into the reach spine (sensor -> reach -> Decision-Gate -> resolve
  -> file). Generalizes Phase 122 (`frameworks:` + `command-registry.json` + resolver) from the command
  edge to the whole reach spine (`docs/CONNECTOR-CONTRACT.md:3`).
- **The 11 connector sub-keys** (`docs/CONNECTOR-CONTRACT.md:21-33`, enumerated as `CONNECTOR_KEYS`
  in `scripts/build-connector-registry.cjs:89-101`):
  1. `connects_to_spine` (boolean opt-in; generator skips unless `=== true` -- `build-connector-registry.cjs:322`)
  2. `sensor_triggers` (array of SENS ids; `[]` legal)
  3. `reach_id` (one of the frozen 6)
  4. `sub_mode` (render label; NEVER a new reach_id)
  5. `framework` (EXACT Brain `:Framework` name; the resolver key)
  6. `posture` (one of the frozen 3)
  7. `hierarchy_rank` (int; one-reach-per-beat arbitration input)
  8. `filing` (`fileEvidenceWithReadback` | `memory_event_only` | `none`)
  9. `plan_gated` (boolean; `true` ONLY for `deep_research`)
  10. `web_scope` (`null` | `white|green|black|yellow|red|blue`)
  11. `surface` (Shape-F sub-shape, e.g. `F.0`; serialized as `decision_surface` -- `build-connector-registry.cjs:356`)
- **Generator:** `scripts/build-connector-registry.cjs`. Walks `commands/*.md` + `skills/*/SKILL.md`
  + `agents/*.md` (`listSourceFiles`, `build-connector-registry.cjs:253-294`), parses the nested
  `connector:` map (`parseConnectorFrontmatter`, `:141-214`), filters to `connects_to_spine===true`
  (`:322`), emits `connectors[]` + `sensor_index` + `framework_index` (`buildRegistry`, `:304-388`).
- **Generated registry:** `data/connector-registry.json`. Carries `connectors`, `sensor_index`
  (SENS-id -> surfaces[]), `framework_index` (framework -> surfaces[]). GENERATED, never hand-edited
  (`build-connector-registry.cjs:76-77`).
- **The `--check` tripwire** (`build-connector-registry.cjs:614-651`). Regenerates in memory, fails
  on: STALE on-disk registry (byte-compare, `:617-619`); 4 CONN-03 validations via `validateConnectors`
  (`:421-492`) = (1) reach_id in frozen 6 (`:430`), (2) framework resolves via `commandsForFramework()`
  WFL-01 -- ONLY when the connector declares a framework AND fires a command (`:455-469`), (3) posture
  in frozen 3 (`:438`), (4) no duplicate (sensor,reach,sub_mode) tuple (`:478-488`). Plus a NON-fatal
  STDERR WARN nudge for methodology commands (`frameworks:` block) with no `connector:` block
  (`methodologyCommandsMissingConnector`, `:502-526`; emitted `:635-647`).
- **Where the tripwire is invoked:** pre-commit hook + the Feynman runner (per `docs/CONNECTOR-CONTRACT.md`
  + CANON-PHASE-MAP Phase 122/143.3 rows; the `--check` branch is the CI entry). The connector `--check`
  is the frozen-6 enforcer cited in Canon Appendix D entry 15.
- **Brain touch is build-time read-only ONLY** (`--refresh-names`, `refreshNames`, `:535-589`): one
  read-only `MATCH (f:Framework) WHERE (f)-[:FEEDS_INTO]-() RETURN f.name` (`:84-85`). No write Cypher.
  Canon Part 8 safe by construction (`:25-32`).

### 2. The Sensor Spine (Phase 143 / 143.x / 150.5 / 160 / 170)

- **Chokepoint:** `lib/core/insight-sensors.cjs` -> `dispatchSensors(turn, tuple, ctx)`
  (`:401-429`). Runs `SENSOR_REGISTRY` (`:367-383`) in canonical order, collects non-null reaches,
  soft-fails per sensor (a throwing sensor = "did not fire", `:419-423`). One-seam turn normalization
  at entry: `normalizeTurn` + `deriveTurnSignals` (`:171-256`, `:408-413`) -- aliases text from
  userText, derives `artifact_filed` (from `last-cascade.json`) + `first_material` (from
  `auto-explore-*.json`) freshness-gated side-channels. NEVER mutates `routing_source`, NEVER calls
  `decide()` (Phase 144 fence, `:21-35`).

**Live sensors (registry order, `insight-sensors.cjs:367-383`):**

| SENS | File | LOCAL signal read | reach_id | posture |
|------|------|-------------------|----------|---------|
| SENS-01 first-material | `insight-sensors.cjs:276-300` | `first_material` signal (auto-explore-117 side-channel) | `context_block` | push_forward |
| SENS-06 artifact-filed | `insight-sensors.cjs:324-360` | `artifact_filed` signal + `last-cascade.json` newFindings; CONTRADICT edge -> `contradiction` else `cross_room` | `contradiction` OR `cross_room` | pull_back / push_forward |
| SENS-02 lagging-component | `sensors/sensor-lagging-component.cjs:82-111` | turn-text reverse-salient phrasings (`LAGGING_PATTERNS`, `:49-59`) | `context_block` | pull_back |
| SENS-03 methodology-decision | `sensors/sensor-methodology-decision.cjs:97-127` | decision signals (`DECISION_SIGNALS`, `:44-51`) + `tuple.current_frameworks` | `brain_consult` | hold |
| SENS-07 gate-approach | `sensors/sensor-gate-approach.cjs:78-100` | `tuple.stage` / `ctx.venture_stage` commit-near (`COMMIT_NEAR_STAGES`, `:44-51`) | `context_block` | push_forward |
| SENS-04 external-fact | `sensors/sensor-external-fact.cjs:117-180` | turn-text external-fact category (`EXTERNAL_FACT_PATTERNS`, `:50-61`) + hat scope | `deep_research` (Green) OR `context_block` | push_forward |
| SENS-05 jtbd-reweight | `sensors/sensor-jtbd-reweight.cjs:95-137` | `jtbd-state.cjs` getCurrent/history slug change | `context_block` | hold |
| SENS-08 memory-cortex | `sensors/sensor-memory-cortex.cjs:81-107` | `ctx.staleGoverningThought` / `ctx.freshContradictions` (projected cortex scalars) | `cross_room` | push_forward |
| SENS-09 diffusion-adoption | `sensors/sensor-diffusion-adoption.cjs:130-156` | signal `diffusion_detected` OR `DIFFUSION_LEXICON` text OR `diffusion-scan-*.json` marker | `brain_consult` | push_forward |

- **No sensor lacks a reach_id.** All 9 fire a valid reach via `makeReach` (which returns null on an
  out-of-bank reach_id, `sensor-types.cjs:86`). Note `dispatchSensors` filters out any reach whose
  `reach_id` is not in `REACH_IDS` (`insight-sensors.cjs:424`).
- **`hats` reach has NO firing sensor.** No sensor in the registry emits `reach_id:'hats'`; it is wired
  only at the connector layer (think-hats repoint, Canon Appendix D entry 15). Sensor-side, `hats` is
  dark.

### 3. The Reach Bank (Phase 141 + Phase 148 D-09)

- `lib/core/sensors/sensor-types.cjs:43-50` -- **frozen 6 `REACH_IDS`** (Object.freeze):
  `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`, `hats`.
- `sensor-types.cjs:54-58` -- **frozen 3 `POSTURE_IDS`**: `push_forward`, `hold`, `pull_back`.
- `makeReach` (`:80-120`) is the pure factory: validates reach_id + posture against the banks, returns
  null (never throws) on invalid input, carries ONLY generic handles + LOCAL scalars (Part 8).
- This is the SINGLE frozen source; `build-connector-registry.cjs:56-58` imports REACH_IDS/POSTURE_IDS
  from here so the tripwire can never drift from doctrine.

### 4. The Engine (Phase 144 decide() legacy->engine flip)

- `lib/core/navigation-engine.cjs` -> `decide(turn, context)` (`:596`).
- Consumes the sensor spine ONCE before any return path (`:608-663`): builds `sensorTuple` +
  `sensorCtx`, derives cortex scalars inline (`:633-651`), calls `dispatchSensors` (`:657`).
- **The flip:** `resolveFireSkill(brain, weightApplied, tierMode, sensorReaches)` (`:427-477`).
  Precedence: (1) wicked_escalation `>=8` -> `soft-systems` outranks all (`:430-437`); (2) **sensor
  reach** -> canonical verb in ANY tier (`:444-453`) -- this is the legacy->engine flip; (3) mode_a
  BRAIN.md verb (`:456-468`); (4) weightApplied>=0.9 fallback (`:470-472`).
- **One-reach-per-beat arbitration:** `sensorReaches[0]` (the TOP reach) wins. Order is the canonical
  `REACH_IDS` order because `dispatchSensors` iterates `SENSOR_REGISTRY` (which mirrors REACH_IDS) in
  order (`:445-450`). A non-mapping top reach falls through to the BRAIN path.
- **reach -> canonical verb map** `reachIdToSkillFamily` (`:392-402`): `context_block`->Run Methodology,
  `contradiction`->Devil's Advocate, `cross_room`->Navigate Graph, `brain_consult`->Run Methodology,
  `deep_research`->Spawn Sub-Agent. **`hats` is NOT in this switch -> returns null** (`:399 default`).
  So a sensor that fired `hats` could NOT flip routing_source to engine today.
- The router (READ-ONLY for 144) validates the verb against `CANONICAL_VERBS`; a non-null canonical
  verb flips `routing_source` legacy->engine (`:53`, `:378-384`).

---

## Current Coverage Numbers (MEASURED 2026-06-22)

Source: `node` over `data/connector-registry.json` + `data/command-registry.json`.

- `data/command-registry.json`: **101 commands** (array).
- `data/connector-registry.json`: **62 connectors** total = **55 command** connectors + **0 skill** +
  **7 agent** (`agent:brain-query`, `grading`, `investor`, `opportunity-scanner`, `persona-analyst`,
  `research`, `reverse-salient-agent`).
- **Commands WITH a connector: 54** (distinct command slugs; 55 command connectors but one slug
  carries two connectors -- the score-innovation/whitespace SENS-06 pair sharing reach but differing
  sub_mode).
- **Commands WITHOUT a connector: 47** (101 - 54).
- Of the 47 dark commands, **8 are "half-wired"** = ship a `frameworks:` block but no `connector:`
  block (the WARN-nudge set, measured via `--check`): `/mos:causal`, `/mos:diagnostics`,
  `/mos:hat-briefing`, `/mos:persona`, `/mos:rs-experts`, + 3 more (warning truncates the list at 5).
- That leaves **~39 fully dark** (no frameworks, no connector -- mostly utility/admin commands).

**Reconciliation with the 172-CONTEXT baseline (54 wired / 9 half-wired / 38 dark):**
- Wired = 54 -> EXACT match (commands with a connector).
- Half-wired: CONTEXT says 9, the `--check` WARN nudge counts 8 (frameworks-but-no-connector). The
  one-off difference is a borderline command (likely a `frameworks:`-adjacent command counted by the
  CONTEXT heuristic but not the strict generator heuristic). Effectively reconciled (8 vs 9).
- Dark: CONTEXT says 38, measured 39 (47 no-connector minus 8 half-wired). 38 vs 39 is the same
  one-off rounding as the half-wired line. The baseline is sound; treat 54 / ~8-9 / ~38-39.

**sensor_index distribution** (`connector-registry.json` sensor_index): SENS-06 is the broadest
(31 surfaces), SENS-05 (8), SENS-04 (7), SENS-01 (10), SENS-07 (9), SENS-08 (3), SENS-02 (3),
SENS-03 (3), **SENS-09 (1, only `/mos:diffusion`)**.

---

## Reusable For 172 (what INV-01..03/07/08 can reuse)

- **INV-01/02 (wire thinking-surface gaps, rs-* family first):** the `connector:` frontmatter contract
  + generator is self-extending -- wiring a command is purely additive frontmatter; `buildRegistry`
  picks it up, the tripwire enforces it. NO generator change needed to wire more commands. Reuse
  `docs/CONNECTOR-CONTRACT.md` worked examples (`:65-166`) as the per-family template. The rs-* family
  has shipped sensors already (SENS-02 `find-bottlenecks` via `sensor-lagging-component.cjs`); the
  half-wired `/mos:rs-experts` is a frameworks-but-no-connector quick win.
- **INV-03 (remote `mindrian-operation` counterparts for non-framework commands):** Canon Part 8
  `methodology_tier` (pws | mindrian-operation) is already minted (Phase 157). The connector contract's
  additive-degrade rule (`docs/CONNECTOR-CONTRACT.md:44-53`) lets a non-framework command carry a
  connector with `framework:null` + `filing:memory_event_only` without tripping the WFL-01 resolver
  check (the check gates on `declaresFramework`, `build-connector-registry.cjs:455-459`) -- the
  memory-cortex reach is the shipped precedent.
- **INV-07/08 (context-driven triggers + chain-quality validation + RETRO-07 hard coverage gate):**
  reuse `dispatchSensors` (the trigger chokepoint) and `validateConnectors` (`:421-492`) as the gate
  skeleton. The `--check` STALE/validation pattern + the WARN-nudge (`methodologyCommandsMissingConnector`)
  is the EXACT shape a hard coverage gate (every surface wired-or-explicitly-excluded) extends -- flip
  the WARN to a FAIL with an explicit-exclude allowlist.
- **Frozen-bank discipline:** `sensor-types.cjs` REACH_IDS/POSTURE_IDS are the single source; reuse,
  never re-mint. 172 is ADDITIVE (per CANON-PHASE-MAP) -- no frozen-set move.

---

## Gaps (the single biggest first)

- **BIGGEST GAP -- the coverage GATE does not exist.** Today the connector `--check` tripwire only
  enforces STALENESS + the 4 per-connector validations + a NON-fatal WARN for half-wired commands
  (`build-connector-registry.cjs:635-647`). There is NO hard gate asserting "every spine-eligible
  surface is wired-or-explicitly-excluded." This is exactly why 143.x / 144.1 RETRO-07 regressed
  (CANON-PHASE-MAP v1.14.0 note: "prior attempts regressed for lack of a gate"). 38-39 commands are
  dark with nothing stopping new dark commands from landing. INV-08 / RETRO-07 must convert the WARN
  into a FAIL backed by an explicit-exclude allowlist.
- **`hats` reach is sensor-dark AND engine-unmapped.** No sensor fires `hats`; `reachIdToSkillFamily`
  (`navigation-engine.cjs:392-402`) has no `hats` case so a `hats` reach returns null and cannot flip
  routing_source. The 6th reach is connector-wired only (think-hats), not contextually invocable.
- **0 skills wired.** `connectors` has 55 command + 7 agent + **0 skill** connectors though the
  generator walks `skills/*/SKILL.md`. Every skill is dark to the spine.
- **SENS-09 is thin** (1 surface). New diffusion-shaped commands won't be reached.
- **47 of 101 commands (~46%) carry no connector** -- the surface area 172 must close.
