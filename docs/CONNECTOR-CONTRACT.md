# The connector: Frontmatter Contract

> The `connector:` frontmatter block is the single source of truth for how any skill or command PLUGS INTO the reach spine (the sensor -> reach -> Decision-Gate -> resolve -> file wiring). This doc is the contract. Phase 143.3 (Connector Spine) generalizes Phase 122 (Workflow Layer): there, `frameworks:` frontmatter + a generated `command-registry.json` + a resolver made `framework -> command` reliable and self-extending; here, the `connector:` block + a generated `connector-registry.json` + the same resolver door do the same for the ENTIRE reach-wiring, not just the command edge.
>
> See also: `docs/COMMAND-FRONTMATTER.md` (the Phase 122 analog this mirrors) and `docs/WORKFLOWS.md` (the closed-loop Brain <-> registry <-> Larry join).

---

## 1. Why this exists

Any skill or command -- existing or future, whenever introduced -- must have a defined way to join the wiring. All conform to the SAME basic connectors and hooks; each declares ONLY the parts relevant to it; there is ONE main spine (the intelligence-orchestrator) that reads them. New surfaces auto-join by declaring; existing ones are retrofitted.

The `connector:` block on each skill/command is where wiring lives -- never hardcoded in the orchestrator. `data/connector-registry.json` is GENERATED from this frontmatter by `scripts/build-connector-registry.cjs`; it is never hand-written. A `--check` tripwire (the pre-commit hook and the test runner) fails the build if the committed registry is stale vs. the frontmatter, or a connector declares a `framework` that is not a resolvable Brain framework name (validated against `data/framework-names.json`, the FEEDS_INTO-linked subset).

This extends the existing frontmatter; it does not introduce a new metadata store. The same `commands/*.md` and `skills/*/SKILL.md` files that the registry already parses gain one new nested key block -- nothing more.

## 2. The connector: block and its 11 sub-keys

A standard, additive frontmatter block. Each surface declares ONLY the parts relevant to it; absent fields degrade (the surface simply does not participate in that hook).

| Sub-key | Type | Meaning |
|---------|------|---------|
| `connects_to_spine` | boolean | Opt-in flag. `true` = wired. Absent or `false` = legacy / not wired (untouched until retrofitted). The generator skips any surface where this is not `true`. |
| `sensor_triggers` | array of SENS ids (0..n) | Which sensor(s) surface this surface's reach. `[]` is valid (a surface that declares a reach but is not sensor-driven). |
| `reach_id` | one of the frozen 5 | The reach this surface participates in: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. NEVER a 6th id. |
| `sub_mode` | string (render label) | The intelligence-tool identity as a RENDER LABEL under that reach_id (e.g. `reverse-salient`). Free text, but registered. NEVER a new reach_id. |
| `framework` | string (EXACT name) | The EXACT Brain `:Framework` name matching `data/framework-names.json` -- the resolver key. MUST equal the surface's existing `frameworks:` value (Phase 122). |
| `posture` | one of the frozen 3 | The Hierarchical Navigator movement: `push_forward`, `hold`, or `pull_back`. |
| `hierarchy_rank` | integer | The Intelligence Hierarchy position used for one-reach-per-beat arbitration (lower wins ties after the Tensions > Bottlenecks > HSI > Convergences > Blind Spots order). |
| `filing` | one of: `fileEvidenceWithReadback`, `memory_event_only`, `none` | The write hook the orchestrator uses after APPROVE. |
| `plan_gated` | boolean | `true` ONLY for the `deep_research` escalation (the sanctioned exception that may chain a multi-angle plan). `false` everywhere else. |
| `web_scope` | `null` or one of `white` \| `green` \| `black` \| `yellow` \| `red` \| `blue` | The hat-scoped web access, when applicable (Part 2). `null` when the surface does not reach the web. |
| `surface` | string (Shape-F sub-shape) | The Shape-F sub-shape the Decision Gate renders as (e.g. `F.0`, `F.1`). |

## 3. The frozen banks (drift-tested)

The 5 reach_ids and the 3 postures stay FROZEN. The contract NEVER mints a 6th reach_id -- `sub_mode` carries the intelligence-tool identity as a render label instead.

- **The frozen 5 reach_ids:** `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. (Source of truth: `lib/core/sensors/sensor-types.cjs` REACH_IDS.)
- **The frozen 3 postures:** `push_forward`, `hold`, `pull_back`. (Source of truth: `lib/core/sensors/sensor-types.cjs` POSTURE_IDS.)

Drift tests assert any add or remove fails CI, mirroring the Phase 141 exactly-5 / exactly-3 invariants. A `sub_mode` is a render label only; it can be added freely without touching the frozen banks.

## 4. The additive-degrade rule

Each surface declares ONLY the parts relevant to it. Absent fields mean the surface does not participate in that hook -- there is no error, no fabrication, just non-participation:

- A connector whose `framework` returns no command from the resolver degrades to "run it manually".
- A sensor with no matching connector fires nothing (silent, honest).
- A surface with `connects_to_spine` absent or `false` is legacy -- untouched until retrofitted.
- A surface with `web_scope: null` does not reach the web; a surface with `filing: none` writes nothing.

No invented commands, no invented reaches. Degrade-don't-fabricate, everywhere.

## 5. The Part 8 boundary

`framework` and `web_scope` are GENERIC handles only. A connector NEVER carries user content -- it is a frozen-vocabulary enum field plus a published-methodology name plus a render label. There is no path by which a user's artifacts, meetings, assumptions, or decisions enter a connector.

The ONLY Brain touch in this whole spine is the generator's build-time, read-only `--refresh-names` allowlist read (it reads generic `:Framework` node names from the Brain to validate the `framework` values, mirroring `scripts/build-command-registry.cjs`). The generator, the `--check` tripwire, and the orchestrator never carry user-specific strings to the Brain. This is Canon Part 8: LOCAL data -> BRAIN is NO; the connector contract is structurally incapable of breaching it because its only Brain-bound value is a generic framework handle.

## 6. Worked examples (the 6 routing-table families)

These mirror the per-family connector values tabulated in `ROUTING-TABLE-intelligence-orchestrator.md`. The `framework` value MUST equal the surface's already-declared `frameworks:` entry.

### PUSH-02 -- reverse-salient (find-bottlenecks)

```yaml
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-02]
  reach_id: context_block
  sub_mode: reverse-salient
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 2
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.0
```

### PUSH-03 -- HSI / whitespace (score-innovation)

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: hsi
  framework: "HSI Semantic Surprise Analysis Assistant"
  posture: hold
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
```

### PUSH-04a -- cross-domain-connect (find-connections)

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-01]
  reach_id: brain_consult
  sub_mode: cross-domain-connect
  framework: "Usher's Model of Cumulative Synthesis"
  posture: hold
  hierarchy_rank: 1
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
```

### PUSH-04b -- cross-domain-analogy (find-analogies)

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: cross-domain-analogy
  framework: "Four Lenses of Innovation"
  posture: hold
  hierarchy_rank: 4
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
```

### PUSH-05 -- six-hats (think-hats)

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-05, SENS-07]
  reach_id: brain_consult
  sub_mode: six-hats
  framework: "Six Thinking Hats"
  posture: hold
  hierarchy_rank: 5
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
```

### PUSH-06 -- hat-scoped-research (research)

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-04]
  reach_id: deep_research
  sub_mode: hat-scoped-research
  framework: "Hypothesis-Driven Problem Solving"
  posture: hold
  hierarchy_rank: 6
  filing: fileEvidenceWithReadback
  plan_gated: true               # the SANCTIONED deep_research exception
  web_scope: green               # hat-scoped; Green affords deep-research
  surface: F.1
```

## 7. The delimiter convention

The connector block attaches as a delimited additive block in the YAML frontmatter, mirroring the Phase 122 `# --- Phase 122 workflow-layer frontmatter ---` pattern (see `commands/find-bottlenecks.md` line 6):

```yaml
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  # ... the relevant sub-keys ...
```

The delimiter makes the additive nature legible: everything above it is the surface's pre-existing frontmatter; the connector block is the new, self-contained wiring declaration.

## 8. Forward references

The generator (`scripts/build-connector-registry.cjs`) reads this contract and emits `data/connector-registry.json` with a `sensor_index` (sensor_id -> connectors[]) and a `framework_index` (framework -> surfaces[]). The intelligence-orchestrator skill reads only the generated registry at runtime, never a hardcoded table. The OPEN-1 dispatch-handle map (`data/dispatch-framework-map.json`) translates raw sensor dispatch handles to the EXACT framework names this contract's `framework` field carries, drift-tested against `data/framework-names.json`.
