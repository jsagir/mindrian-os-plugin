---
id: SEED-082
status: triggered
planted: 2026-08-25
triggered_at: 2026-09-11
planted_during: Theo Phase 6 (Command Sync & Parallel-Run Rollout) - planning, cross-repo (this repo is the source-of-truth side of Theo's SYNC-01 registry sync)
trigger_when: "when a phase proposes automating either sync direction (Theo content ingestion -> a /mos: command being authored here, or a release here changing data/command-registry.json / lib/core/recipe-maps.cjs -> a Theo sync payload), or when Theo's own SEED-001 framework-ingestion work is scoped and its output needs a way to reach a developer here, or if the two graphs are ever found stale relative to each other in production."
scope: small
trigger_evidence:
  measured_at: 2026-09-11
  fact_1_version_skew:
    theo_command_registry_version: "command-registry@2.0.0-beta.12"
    plugin_command_registry_version: "2.0.0-beta.33"
    beta_drift: 21
    note: "the existing scripts/build-command-registry.cjs --check pre-commit tripwire covers only the LOCAL registry against local commands/*.md; it is structurally incapable of seeing Theo-side skew"
  fact_2_sensor_projection_gap:
    theo_sensor_nodes: 0
    theo_mindriancommand_to_sensor_edges: 0
    theo_mindriancommand_to_reach_edges: 84
    note: "the Reach half of the same projection DID land (84 WIRED_TO -> Reach edges), proof the sync ran and silently carried only part of the payload rather than never running"
  fact_3_framework_sync_gap:
    total_commands: 113
    commands_declaring_frameworks: 49
    commands_with_empty_frameworks_array: 64
    methodology_commands: 50
    methodology_commands_declaring_frameworks: 49
    distinct_frameworks_named: 28
    theo_uses_framework_edges: 42
    theo_commands_with_uses_framework: 40
    gap_stated_correctly: "9 methodology commands plus alias resolution across the 28 named frameworks, NOT 71 missing links -- utility (57), meta (4) and mechanical (2) commands correctly declare no frameworks, since they front no framework"
  fact_4_sensor_never_synced_not_never_declared:
    theo_sensor_nodes: 0
    connector_registry_version: "2.0.0-beta.33"
    connector_registry_sensor_index_count: 14
    connector_registry_sensor_index_ids: ["SENS-01", "SENS-02", "SENS-03", "SENS-04", "SENS-05", "SENS-06", "SENS-07", "SENS-08", "SENS-09", "SENS-13", "SENS-14", "SENS-15", "SENS-17", "SENS-SHOW"]
    connectors_with_sensor_triggers: 72
    total_connectors: 209
    source_generator: "scripts/build-connector-registry.cjs, from commands/*.md frontmatter"
  fact_5_live_smoke_addendum: "Measured against the v2.0.0-beta.33 tag and live Theo, 2026-09-11: the live-smoke observation that 3 of 4 next_gate.options had zero command edges is a REGISTRY-AUTHORING fact, not a sync gap -- Design Thinking, Disruptive Innovation and Creative Destruction are declared by zero commands in data/command-registry.json, and they rank first because they are Theo's highest-degree Frameworks (291, 255, 189 respectively). No sync payload can move that note. The reachable sync target measured the same day: +11 USES_FRAMEWORK edges (42 -> 53), 40 -> 51 commands linked, 21 -> 28 frameworks with a command, zero edges removed. All 28 declared names resolve on Theo by exact match today (the unresolved set is empty)."
  mindriancommand_outgoing_census:
    PART_OF_Root: 113
    WIRED_TO_Reach: 84
    USES_FRAMEWORK_Framework: 38
    USES_FRAMEWORK_dual_labelled_Framework_or_Technique: 4
    NEXT_IN_RECIPE: 9
    FEEDS_INTO: 2
    Sensor: 0
  command_neighborhood_disposition: "Theo's command_neighborhood correctly references the declared declaration_side property (resolver-config.yaml:254, SENSE-03); its UnknownPropertyKeyWarning fires only because no writer has ever set it -- registry-sync territory, not a Theo query bug"
---

# SEED-082: Bidirectional command<->framework sync has no drift-detection mechanism, in either direction

## Why This Matters

Filed as the paired half of Theo's `.planning/seeds/SEED-005-bidirectional-command-framework-sync-drift-detection.md`, in response to a navigator question asked mid Theo Phase 6 planning (2026-08-25): "what happens when a new ingestion of framework work [happens] - will mindrianOS trigger command creation and vice versa?"

The honest answer, confirmed by reading both repos' actual mechanisms: **no,
neither direction triggers today, and that is deliberate, not an oversight**
- but the gap between "deliberately manual" and "silently stale" is real and
currently unaddressed on both sides.

**Direction 1: Theo ingests a new framework -> does this repo find out?**
No. A `/mos:` command is a hand-authored file (`commands/*.md` with
frontmatter, in this repo). `data/command-registry.json` is *generated*
FROM those files (`scripts/build-command-registry.cjs`, with a `--check`
drift tripwire already wired into `.git/hooks/pre-commit` - but that check
only catches this repo's own registry drifting from its own `commands/*.md`,
it says nothing about Theo). Theo's SEED-001 future ingestion work will grow
its chapter/concept layer from 33 chapters toward a ~1,400-node curated
spine, sourced from the real PWS Brain. None of that growth puts a signal in
front of any developer here saying "framework X now has real content in
Theo, consider authoring `/mos:x`."

**Direction 2: this repo ships a new command -> does Theo find out?**
No, and this one is already named as doctrine on Theo's side, just not
automated. Theo's own `CLAUDE.md` ("When MindrianOS ships a new command
(the sync contract)" section) already states the trigger condition in
words: "whenever `data/command-registry.json` or `recipe-maps.cjs` changes
in a MindrianOS-Plugin release, Theo's `MindrianCommand` layer needs a
corresponding sync payload - a GSD phase, not an ad hoc edit." But nothing
here currently *flags* that condition for whoever maintains Theo when a
release ships.

## Why NOT auto-execute (the constraint this seed must respect)

Both directions are intentionally NOT automatic, and any resolution of this
seed must keep it that way:

- This repo's own standing hard rule: GSD-only, no direct edits, no
  exceptions - a write that bypasses the reviewed GSD phase cycle is exactly
  the failure class this repo already guards against (see the pre-commit
  registry-drift tripwire itself, which flags rather than auto-fixes).
- Theo's own architecture doctrine, rule 5: "Recommends and executes only
  what it's told, never decides... never initiates, never chooses between
  options on its own, never acts without an explicit typed call."

An auto-trigger that *creates* a `commands/*.md` file here, or *executes* a
Cypher sync payload on Theo's side, on its own would violate both. What's
missing is strictly **detection and surfacing**, not automation of the
actual authoring/ingestion work.

## Proposed shape (not yet designed - this is the seed, not the plan)

A scheduled or pre-release check that diffs:
- `data/command-registry.json`'s `framework_index` array (this repo, source
  of truth for what commands claim to teach)
- Theo's live `Framework`/`Chapter`/`DomainConcept` node set (via a Theo
  content tool or direct query)

Surfaces two lists: frameworks named in `framework_index` with no matching
Theo content, and Theo frameworks/chapters with no matching command. Writes
the result somewhere a human actually looks - a normal GSD todo, a CI
annotation, or (on Theo's side) a `-MOS-LEARNING.md`-style doc - never an
auto-authored `commands/*.md` file, never an auto-executed Cypher write on
either side.

## When to Surface

**Trigger:** when a phase proposes automating either sync direction, when
Theo's SEED-001 is scoped, or when the two graphs are found stale relative
to each other in practice.

## Scope Estimate

**Small** - a detection/surfacing mechanism (a diff + a flagged list), not a
build of the actual ingestion or command-authoring pipeline. Likely a single
quick task or small phase once triggered.

## Breadcrumbs

- Theo's `.planning/seeds/SEED-005-bidirectional-command-framework-sync-drift-detection.md`
  - the paired seed, planted same session
- `scripts/build-command-registry.cjs` - confirms `data/command-registry.json`
  is generated from `commands/*.md`, not the reverse; the existing pre-commit
  `--check` tripwire this repo already has for the WITHIN-repo half of this
  problem
- `data/command-registry.json` - `framework_index` (28 entries as of
  2026-08-25) and `curated_chains` (18 `feeds_into` entries) - the fields a
  diff check would read from this side
- `lib/core/recipe-maps.cjs` - `NAMED_RECIPES`, the other authorized source
  Theo's own Phase 6 SYNC-01 already reads from
- Per this repo's own "Dev-Research Compositing" rule, also filed as a
  research entry in the `rethinking-mindrianos` Data Room
  (`~/MindrianRooms/rethinking-mindrianos/research/`), cross-linked back
  here

## Notes

Navigator-directed: "ok seed it in both sides mindrianos and in theo !"
Cross-repo pair with Theo's SEED-005.

## Trigger fired, 2026-09-11

This section is appended, not a rewrite of the 2026-08-25 analysis above, which stays as
originally filed. Filed as part of quick task 260911-axz (the Theo QA memo follow-ups).

Four measured facts, together, not any one alone, because each alone understates the gap:

**Fact one, version skew.** Theo answers from `command-registry@2.0.0-beta.12` while the plugin
ships `2.0.0-beta.33` -- 21 betas of drift. This repo's own `scripts/build-command-registry.cjs
--check` pre-commit tripwire covers the LOCAL `data/command-registry.json` against local
`commands/*.md` only, so it is structurally incapable of seeing this.

**Fact two, the never-projected layer.** Theo's graph holds 0 Sensor nodes, graph-wide, and 0
`MindrianCommand -> Sensor` edges, while the Reach half of the same projection DID land (84
`WIRED_TO -> Reach` edges) -- proof the sync ran and silently carried only part of the payload,
not that it never ran.

**Fact three, a small sync gap with a ready source, not an authoring gap.** `data/command-
registry.json` in this repo holds 113 commands, of which 49 carry a non-empty `frameworks` array
and 64 carry `frameworks: []`. Those 49 are 49 of the 50 `kind: methodology` commands (for
example `/mos:leadership` -> `["Adaptive Leadership"]`); every `utility` (57), `meta` (4) and
`mechanical` (2) command correctly declares none, since they front no framework. The 49 name 28
distinct frameworks. Theo carries 42 `USES_FRAMEWORK` edges across 40 commands. The gap is 9
methodology commands plus alias resolution across those 28 names, NOT 71 missing links -- an
assumption that every one of the 113 commands declares a framework is false and would send a
future reader hunting for a projection bug that does not exist.

**Fact four, never synced, not never declared -- the open design question.** Theo's graph holds 0
Sensor nodes, while `data/connector-registry.json` at `2.0.0-beta.33` already carries a top-level
`sensor_index` of 14 `SENS-*` ids (SENS-01 through SENS-09, SENS-13, SENS-14, SENS-15, SENS-17,
SENS-SHOW) and `sensor_triggers` arrays on 72 of its 209 connector entries, generated by
`scripts/build-connector-registry.cjs` from `commands/*.md` frontmatter. The source for a Sensor
projection already exists and is already generated. The one distinction a future sync payload
must decide, per that script's own comment (`~:1084-1097`): `sensor_index` is the CLAIM side
(which commands claim a sensor; derived from frontmatter; deliberately omits SENS-10, SENS-11,
SENS-12, SENS-16; can name ids with no implementation behind them), while
`lib/core/insight-sensors.cjs`'s `SENSOR_REGISTRY` is the EXISTENCE side (the runtime reach
functions). The two sides are ALLOWED to differ, by that script's own design. **The open design
question a sync payload must answer first: which side should Theo's Sensor nodes represent, the
claim side or the existence side?** This is recorded here as an open question, not resolved.

Supporting numbers, the full `MindrianCommand` outgoing census: `PART_OF` -> Root 113, `WIRED_TO`
-> Reach 84, `USES_FRAMEWORK` -> Framework 38 (plus 4 to dual-labelled Framework|Technique),
`NEXT_IN_RECIPE` 9, `FEEDS_INTO` 2, Sensor 0. Disposition recorded: Theo's `command_neighborhood`
correctly references the declared `declaration_side` property (`resolver-config.yaml:254`,
SENSE-03); its `UnknownPropertyKeyWarning` fires only because no writer has ever set it --
registry-sync territory, not a Theo query bug.

**Adjacent follow-up, explicitly OUT OF SCOPE for this quick task, recorded so it is not lost but
not acted on here:** `lib/mcp/brain-router.cjs` Tier 3 runs a 2000 ms hard `Promise.race` at
`:460`, and a cold Theo on Render loses that race silently. A session-start pre-warm plus a raised
bound is a separate item; nobody should act on it from this seed's trigger alone.
