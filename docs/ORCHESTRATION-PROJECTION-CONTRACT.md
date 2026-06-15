# The Brain Orchestration Projection Contract

> `data/brain-orchestration-projection.json` is a GENERATED, Brain-DERIVED LOCAL cache of Mindrian's own orchestration layer (the /mos commands, the 6 frozen reaches + their sub_modes, the skills, the agents, the frameworks, and the typed edges that wire them). It is shaped after the projection the Brain may hold under the Canon Part 8 dual-role amendment (Appendix D entry 19), but it is a LOCAL file the navigation engine will read. It is NEVER edited by hand and it carries ONLY generic machinery metadata, never user content.
>
> Sibling of `docs/CONNECTOR-CONTRACT.md` (the `connector:` frontmatter contract this projection is derived from) and `docs/COMMAND-FRONTMATTER.md` (the Phase 122 framework-to-command analog).

Canon reference: `docs/MINDRIAN-CANON.md` Part 8 (The Graph Boundary, "The Brain's dual role (orchestration projection)" subsection) + Appendix D entry 19. Implementing phase: Phase 157 (brain-orchestration-graph-and-methodology-tiers).

---

## 1. What this artifact is (and is not)

| | |
|---|---|
| **Path** | `data/brain-orchestration-projection.json` |
| **Generator** | `scripts/build-orchestration-projection.cjs` (a Part 7 reuse sibling of `scripts/build-connector-registry.cjs`) |
| **Sources** | `data/connector-registry.json` + `data/command-registry.json` (read-only) + a `commands/` + `skills/` + `agents/` file walk + `data/cross-domain-analogues.json` |
| **Generated** | YES. Run `node scripts/build-orchestration-projection.cjs` to regenerate. The node list is fully DERIVED; there is ZERO hand-authored node list. |
| **Edit by hand** | NEVER. A hand edit drifts from the sources and `--check` (Plan 04) fails the build. |
| **Brain I/O** | NONE. It is a Brain-DERIVED LOCAL cache (Canon Part 9): no live Brain read, no live Brain write, no `brain-client` require, no `fetch`, no `http`. The Brain is the external cortex the projection is shaped after, never a runtime dependency. |
| **Boundary** | Part 8: ONLY generic machinery metadata (command slugs, reach_ids, sub_modes, framework names, methodology_tier, ranking enums/scalars, typed edges). NEVER user content, room data, meeting transcripts, assumption registries, decisions, or personal identifiers. |

The continuous remote sync (Phase 137) and the live Brain write of the projection are DEFERRED. The nav-engine consumption of this cache is DEFERRED. This contract defines the SHAPE the deferred consumer targets.

---

## 2. The node schema

Every node is an object with at minimum `{ id, kind, methodology_tier, name }`. A node lacking `methodology_tier` is NOT a legal projection node (the boundary-keeper, see section 4).

| Field | Type | On which nodes | Meaning |
|-------|------|----------------|---------|
| `id` | string | all | The kind-prefixed node id (see the id scheme below). |
| `kind` | one of `command` \| `skill` \| `agent` \| `framework` \| `reach` \| `sub_mode` | all | The file-level node kind (BOG-04, per-file grain). |
| `methodology_tier` | `pws` \| `mindrian-operation` | all (mandatory) | The Part-8 boundary-keeper. `pws` = teaching IP framework; `mindrian-operation` = machinery. |
| `name` | string | all | The human-readable handle (the surface name, framework name, reach id, or sub_mode). |
| `reach_id` | one of the frozen 6 | connector-derived command/agent nodes | The reach this surface participates in (ranking input, BOG-07). |
| `sub_mode` | string (render label) | connector-derived command/agent nodes | The intelligence-tool identity under that reach (ranking input). |
| `hierarchy_rank` | integer | connector-derived command/agent nodes | The Intelligence Hierarchy position for one-reach-per-beat arbitration (lower wins; ranking input). |
| `posture` | one of the frozen 3 | connector-derived command/agent nodes | The Hierarchical Navigator movement (`push_forward` \| `hold` \| `pull_back`; ranking input). |
| `sensor_triggers` | array of SENS ids | connector-derived command/agent nodes | The firing sensor(s) (ranking + provenance input). |
| `framework` | string (exact framework name) | connector-derived command/agent nodes | The framework the surface OPERATES (provenance input). |
| `chain_provenance` | object | connector-derived command/agent nodes | The framework -> command -> reach chain + firing sensors, so a why-block / rejection-reason can cite the FULL chain, not just score signals (BOG-07 elevated). Keys: `{ framework, command, reach_id, sub_mode, firing_sensors }`. |
| `ranking` | object | connector-derived command/agent nodes | The Plan 02 ranking block, retained for backwards compatibility (same scalars as the top-level fields). |

### The node id scheme (kind-prefixed)

| kind | id format | tier |
|------|-----------|------|
| command | `command:/mos:<base>` | mindrian-operation |
| skill | `skill:<dir>` | mindrian-operation |
| agent | `agent:<base>` | mindrian-operation |
| framework | `framework:<exact name>` | pws |
| reach | `reach:<reach_id>` | mindrian-operation |
| sub_mode | `sub_mode:<sub_mode>` | mindrian-operation |

Skills carry NO connector frontmatter (D-01): they are `name + tier` only, with NO ranking fields. They are EXEMPT from the ranking gate (Plan 04 enforces the exemption: an UN-RANKED skill node is legal; an UN-RANKED connector-declaring command/agent is a `--check` failure).

The ranking-input fields and `chain_provenance` are the BOG-07 ranking surface: every connector-derived `mindrian-operation` node carries `reach_id`, `sub_mode`, `hierarchy_rank`, `posture`, `sensor_triggers` (all enum/scalar, never user content), so the nav engine's "what fits" reach ranking can be computed from the projection ALONE. The pure helper `rankReachesForProblem(projection, { problemType, stage })` proves this: it reads only the projection and returns the candidate reaches ranked by best (lowest) `hierarchy_rank`, tie-broken by `reach_id` ascending.

---

## 3. The CLOSED edge-type set (BOG-05)

The projection emits EXACTLY these five typed edge kinds and ONLY these five. The set is `ALLOWED_EDGE_TYPES = Object.freeze(new Set([...]))` in the generator, mirroring the frozen-bank idiom of `lib/core/sensors/sensor-types.cjs` `REACH_IDS` and `lib/core/navigation/edges.cjs` `ALLOWED_EDGE_TYPES`. The `addEdge(type, from, to)` chokepoint THROWS at build time if `type` is not in the set OR if either endpoint is absent from `nodes[]` (referential integrity), so a malformed or dangling edge can NEVER land in the artifact.

Every edge is `{ type, from, to }` where `from` and `to` are node ids.

| Edge type | Direction | Meaning | Source |
|-----------|-----------|---------|--------|
| `OPERATES` | command -> framework | A /mos command OPERATES (runs) a framework. | `framework_index` inverse map in BOTH `command-registry.json` and `connector-registry.json`. >=1 per framework-declaring command (a HARD FLOOR). |
| `CHAINS` | framework -> framework | A sequential framework chain (do A, then B). | `command-registry.json` `curated_chains` entries with `kind: chain`. |
| `FEEDS_INTO` | framework -> framework OR reach -> reach | A progression where one stage feeds the next. | `curated_chains` entries with `kind: feeds_into`. May project reach -> reach progressions where the source declares them. |
| `PREREQUISITE` | framework -> framework | A prerequisite relation (B requires A first). | `curated_chains` entries with `kind: prerequisite`. |
| `CROSS_DOMAIN_ANALOGUE` | framework <-> framework | A cross-domain analogy: the same structural move recognized across two domains. | `data/cross-domain-analogues.json` `analogues[]` (the hand-curated 150.10 seeds). One edge per pair (>=2, a HARD FLOOR). |

### The curated_chains -> edge-type mapping

A `curated_chains` entry is `{ kind, from, to }`. The generator maps `kind` to an edge type:

| `curated_chains` kind | edge type |
|-----------------------|-----------|
| `chain` | `CHAINS` |
| `feeds_into` | `FEEDS_INTO` |
| `prerequisite` | `PREREQUISITE` |

`from` / `to` are resolved to node ids: a known framework name resolves to `framework:<name>`; a known reach id resolves to `reach:<id>`. An endpoint that resolves to neither makes `addEdge` THROW (referential integrity), so a `curated_chains` entry referencing an unknown framework/reach FAILS the build rather than emitting a dangling edge. An unknown `kind` also fails the build.

### CEILING, not floor: the source-empty chain layer

The closed set is a CEILING (the only types that may appear), NOT a floor (it does not require all five to appear). Today `data/command-registry.json` `curated_chains` is an EMPTY array `[]`, so the generator legitimately emits ZERO `CHAINS` / `FEEDS_INTO` / `PREREQUISITE` edges. Only `OPERATES` (>=1 per framework-declaring command) and `CROSS_DOMAIN_ANALOGUE` (one per analogue pair) are HARD FLOORS.

The empty chain layer is made LEGIBLE, never silent: the projection carries a top-level `chain_layer_note` string stating that the chain layer is SOURCE-EMPTY pending a populated `curated_chains`, plus the recovery action (populate `curated_chains` with `{ kind, from, to }` entries and regenerate). The generator NEVER fabricates chain edges to fill the gap.

To materialize the chain layer: add entries to `curated_chains` in `data/command-registry.json` (each `kind` in `chain | feeds_into | prerequisite`, each `from` / `to` a framework name or a reach id), then run `node scripts/build-orchestration-projection.cjs`.

---

## 4. The methodology_tier boundary-keeper rule (Part 8)

Every node carries `methodology_tier` of EXACTLY one of two values:

- `pws` -- the teaching IP frameworks (Cynefin, Meadows / Systems Thinking, JTBD, Reverse Salient Analysis, Four Lenses of Innovation, Six Thinking Hats, and the rest of the methodology graph). The `framework` kind is always `pws`.
- `mindrian-operation` -- the machinery (the /mos commands, the 6 reaches + sub_modes, the skills, the agents, the connector spine). Every non-`framework` kind is `mindrian-operation`.

`methodology_tier` is the boundary-keeper: it is the legibility marker that makes the projected machinery Part-8-legal, because it CERTIFIES that every projected node is generic machinery metadata (a command slug, a reach_id, a framework name, a tier, a typed edge) and NEVER a user's data. A `mindrian-operation` node is generic plumbing metadata; a `pws` node is generic teaching metadata; neither carries a specific navigator's artifacts, rooms, meetings, or decisions. A node WITHOUT a `methodology_tier` is not a legal projection node, and `--check` (Plan 04) rejects it.

The `LOCAL data -> BRAIN: NO` invariant (Part 8) is UNCHANGED. This projection is a LOCAL artifact derived from the plugin's OWN generic machinery; it opens no new wire to the Brain and sanctions no user-data egress. The existing boundary scan, PR gate, and Canon Custodian review continue to apply in full.

---

## 4a. The `--check` drift tripwire: the 3-mode failure taxonomy (Plan 04, BOG-08 / D-04)

`node scripts/build-orchestration-projection.cjs --check` regenerates the projection from the LIVE sources in memory, runs `validateProjection(projection)`, and exits non-zero on ANY of three NAMED failure modes (each with its own message + recovery line, mirroring `build-connector-registry.cjs --check`). `validateProjection` returns three categorized arrays `{ stale, unwired, unranked }` so each mode is independently testable without spawning a subprocess. The check makes ZERO Brain/network calls (Part 8).

| Mode | Fires when | Token | Skills |
|------|-----------|-------|--------|
| **STALE** | the serialized regeneration of the live sources differs byte-for-byte from the committed `data/brain-orchestration-projection.json` (a surface changed without regenerating) | `STALE` | n/a |
| **UN-WIRED** | a FRAMEWORK is missing from `nodes[]` OR is not reachable to one of the 6 frozen reaches (`REACH_IDS`) via any `OPERATES -> reach` chain, UNLESS the framework is in `data/orchestration-unwired-allowlist.json` with a documented reason (wired-XOR-allowlisted, the Phase 144.1 idiom). A framework reachable via a SIBLING command's connector counts as wired (a command lacking its OWN connector does NOT fire UN-WIRED as long as its framework reaches a reach elsewhere). | `UN-WIRED` | EXEMPT (D-01) |
| **UN-RANKED** | a connector-derived `mindrian-operation` node (one that declares a `reach_id`) lacks `reach_id`, `hierarchy_rank`, or `posture` | `UN-RANKED` | EXEMPT (D-01) |

UN-WIRED is FRAMEWORK-GRAINED (matches BOG-06 "every framework is reachable"): it is the generalization of the `/mos:futures` gap, where a framework shipped present-but-unwired because the connector registry was not regenerated. The gate fires on the FRAMEWORK, not on every command surface, and NEVER on a skill node (skills are name-only, behavior-as-context, not reach-dispatched, D-01).

The `--check` is registered in BOTH gate surfaces (BOG-11), mirroring the connector `--check` idiom exactly:

- **`scripts/hooks/pre-commit`** -- a staged-path guard runs `--check` when any of `commands/*.md`, `skills/*/SKILL.md`, `agents/*.md`, `data/connector-registry.json`, `data/command-registry.json`, `data/cross-domain-analogues.json`, `data/orchestration-unwired-allowlist.json`, or `data/brain-orchestration-projection.json` is staged, and rejects the commit (exit 2) with the recovery line on failure.
- **`lib/memory/run-feynman-tests.cjs`** -- `lib/memory/orchestration-projection.test.cjs` is registered in the `TEST_FILES` array, so the Feynman runner exercises the projection `--check` (and the un-wired fixture) on every run.

The wired-XOR-allowlisted ledger `data/orchestration-unwired-allowlist.json` is a bare JSON array of `{ framework, reason }`. A framework is EITHER reach-wired OR listed here with a reason; never both, never neither. Phase 157-04 Task 0 quantified the live framework-grained orphan set at exactly 2 and resolved each before the `--check` landed: `Problem Definition Transformation Framework` was WIRED (a connector block was added to `commands/diagnose.md`, reach_id `context_block`); `MECE (Mutually Exclusive, Collectively Exhaustive)` was ALLOWLISTED (it is a component under The Pyramid Principle, its `/mos:structure-argument` connector framework, so it reaches a reach via that node rather than as a standalone reach target). With both resolved, the clean live repo passes `--check` exit 0 by construction.

A deliberately un-wired fixture (`tests/fixtures/orchestration-unwired/UNWIRED-FIXTURE.md`) declares a framework with NO `connector:` block and proves `validateProjection` flags it UN-WIRED. The fixture lives under `tests/fixtures/` and is NEVER walked by the live generator's `listSourceFiles()` (which walks `commands/` + `skills/` + `agents/` only), so the real-repo `--check` stays exit 0.

## 4b. The hats reach + the sensor-firability assumption

**The hats reach is a first-class PRE-SCORED reach node, NOT an un-wired orphan.** Do NOT write "hats has no sensor" -- that is FALSE. `/mos:think-hats` carries `sensor_triggers: [SENS-05]` and `reach_id: hats` in `data/connector-registry.json` (Phase 148 D-09 minted `hats` as the real 6th machine reach_id). `hats` is one of the 6 frozen `REACH_IDS` and is NEVER silently dropped from the projection or the wiring-completeness matrix; it appears as a `mindrian-operation` reach node like the other five.

`hats` is EXEMPT from the sensor-FIRING leg of UN-WIRED for a specific, documented reason. The wiring-completeness gate checks STRUCTURAL reach-wiring (a framework reaches one of the 6 reaches via an `OPERATES -> reach` chain). The genuinely OPEN item -- RESEARCH Q6 -- is whether `SENS-05` FIRING at runtime actually MINTS the `hats` reach versus dispatching a DIFFERENT reach. That is a NAVIGATOR-gated decision (mint a dedicated `hats`-minting sensor, vs formally de-scope `hats` to pre-scored-only), NOT an engineer call. Either way `hats` stays a first-class reach node in the matrix; the open question is about runtime sensor->reach dispatch, never about the node's presence.

**The sensor-firability caveat.** The wiring-completeness gate ASSUMES sensors `SENS-02`..`05`/`07` fire on a fresh-room turn, but that firability is an EMPIRICAL validation (a live trace), not a code read. `--check` validates STRUCTURAL reach-wiring (a command/framework reaches one of the 6 reaches in the projection); it does NOT assert that the firing sensor actually mints a reach at runtime. That empirical leg -- proving a sensor fires and dispatches the expected reach on a real turn -- is OUT of this build-time gate's scope. The build-time `--check` answers "is every framework structurally wired to a reach?"; it does not answer "does the sensor fire and dispatch that reach at runtime?".

## 4c. Cache contract (the deferred nav-engine consumer target) (BOG-09)

`data/brain-orchestration-projection.json` IS the Brain-derived LOCAL cache the navigation engine will read at `decide()` time. This section specifies the consumable shape so the DEFERRED consumer has a stable target. The actual nav-engine read of this cache is deferred (157-CONTEXT deferred list); only the contract lands here.

### Brain-derived LOCAL cache, Tier-0 resilient

The projection is a Brain-DERIVED LOCAL cache, mirroring the BRAIN.md derivation-resilience pattern (Canon Part 9):

- The Brain is the EXTERNAL CORTEX the projection is SHAPED AFTER (the dual-role amendment, Appendix D entry 19, sanctions the SHAPE the Brain may hold). It is NOT a runtime dependency of the cache.
- The cache is REGENERATED DETERMINISTICALLY from LOCAL sources alone: the connector registry (`data/connector-registry.json`) + the command registry (`data/command-registry.json`) + the `commands/` + `skills/` + `agents/` file walk + the hand-curated analogue seed (`data/cross-domain-analogues.json`) + the wired-XOR-allowlisted ledger (`data/orchestration-unwired-allowlist.json`). NONE of these is the Brain.
- Therefore the cache SURVIVES A BRAIN OUTAGE (Tier-0 resilient): the nav engine reads the local file with NO live Brain dependency at read time. The same node + edge schema is available whether the Brain is reachable or not. There is NO live Brain read at generate time and NO live Brain read at the deferred consume time.

This is the same resilience contract BRAIN.md carries per folder: a Brain-derived artifact that, once derived, is a self-sufficient local consumable. The projection regeneration (`node scripts/build-orchestration-projection.cjs`) reads only local bytes; `--check` (section 4a) regenerates in memory and makes ZERO Brain/network calls.

### The exact consumable shape

The deferred nav-engine consumer reads this top-level shape:

```
{
  ontology_ref:      string,   // the source registries this projection is derived from
  generated_note:    string,   // the GENERATED-do-not-edit-by-hand marker
  chain_layer_note:  string,   // the legible source-empty-chain-layer marker (section 3)
  nodes:             Node[],   // every node carries the NODE_FIELD_ALLOWLIST fields (section 2)
  edges:             Edge[]    // every edge is { type, from, to } (section 3)
}
```

- **Node field allowlist** (the closed set of keys any node may carry; section 2 documents each): `id`, `kind`, `methodology_tier`, `name`, `reach_id`, `sub_mode`, `hierarchy_rank`, `posture`, `sensor_triggers`, `framework`, `chain_provenance`, `ranking`. The `chain_provenance` sub-block carries only `{ framework, command, reach_id, sub_mode, firing_sensors }` (the chain-provenance field names from Plan 03), all of which are themselves in the generic-machinery allowlist.
- **Edge field allowlist** (the closed set of keys any edge may carry): `type`, `from`, `to`.

These two allowlists are EXPORTED from the generator as frozen arrays `NODE_FIELD_ALLOWLIST` and `EDGE_FIELD_ALLOWLIST` (`scripts/build-orchestration-projection.cjs`), so the Part 8 boundary scan (section 4d) asserts against the SAME source of truth this section documents. A node/edge key outside the corresponding allowlist is a Part 8 breach, caught by the scan before the artifact lands.

### Deferred fast-follows (explicitly OUT of Phase 157)

| Deferred item | Where it lands | Why out of 157 |
|---------------|----------------|----------------|
| LIVE Brain WRITE of the projection | a fast-follow (needs the admin/Neo4j write path; a one-time ingest) | Phase 157 sanctions only the SHAPE the Brain may hold + the LOCAL cache the plugin derives; it opens no new wire to the Brain |
| CONTINUOUS remote sync (release-lockstep SYNC + CI drift-vs-Brain) | **Phase 137** (brain-mindrianos-sync-compat); SEED-024 sequences it | a separate phase with its own write path + drift gate |
| LIVE nav-engine CONSUMPTION of the cache (ranked next-reach at `decide()` time) | a deferred consumer | this phase EXPOSES the inputs + DEFINES the cache contract only; the read is downstream |

The `LOCAL data -> BRAIN: NO` invariant (Part 8) is UNCHANGED and remains binding across all three deferrals.

---

## 4d. The Part 8 boundary scan (Plan 05, BOG-09 / BOG-10)

`tests/test-orchestration-projection-part8-boundary.cjs` is the adversarial boundary scan that makes the locality CONSTITUTIONAL rather than assumed, mirroring the Phase 90 5-tripwire forbidden-substring sweep and the Phase 110 adversarial-seed idiom. It proves zero user-content egress BY CONSTRUCTION over FOUR surfaces: the projection artifact (`data/brain-orchestration-projection.json`), the generator (`scripts/build-orchestration-projection.cjs`), the analogue seed (`data/cross-domain-analogues.json`), and the wired-XOR-allowlisted ledger (`data/orchestration-unwired-allowlist.json`).

The scan asserts five things and exits non-zero on ANY breach:

1. **Field-allowlist sweep (BOG-10).** Every node key is in `NODE_FIELD_ALLOWLIST` and every edge key is in `EDGE_FIELD_ALLOWLIST` (the generator's exported frozen arrays); the `chain_provenance` and `ranking` sub-blocks are descended into and their keys are restricted to the same generic set. A key outside the allowlist FAILS (a candidate user-content field).
2. **Tier sweep (BOG-10 boundary-keeper).** `methodology_tier` is present on EVERY node and is exactly `pws` or `mindrian-operation`. A node without it is not a legal projection node.
3. **Forbidden-value heuristic sweep (the planted-secret tripwire).** No node or edge VALUE matches a user-content heuristic: a `room/` path segment, an at-sign email pattern, or free text longer than a documented short cap. The scan is adversarial: it SEEDS a planted user-content value into an in-memory copy of the projection and PROVES the heuristic catches it (RED), then confirms the REAL artifact is clean (GREEN). The scan is the PROOF, not an assertion.
4. **Zero-live-Brain sweep (BOG-09).** The generator source (comment lines filtered out) carries NO top-level `brain-client` require and NO `fetch` / `http` / `curl` / `brain.query` / `brain.write` call. This generator has NO Brain touch at all (unlike the connector `--refresh-names` sibling). The match is on the actual call/require SYNTAX, never a bare substring, so the header prose naming "Brain" does not self-invalidate the gate.
5. **Generic-machinery sources (BOG-10).** The analogue seed carries only `from` / `to` generic framework-NAME pairs + a `rationale` prose field (bounded, no user content); the allowlist carries only `framework` / `reason` machinery-metadata pairs.

The scan is registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES` so the Feynman runner enforces it on every run. It makes ZERO Brain/network calls.

---

## 5. Forward references

- **Plan 04 -- the `--check` drift tripwire (LANDED).** See section 4a for the now-shipped 3-mode taxonomy (STALE / UN-WIRED / UN-RANKED), the wired-XOR-allowlisted ledger, the un-wired fixture, and the pre-commit + Feynman-runner registration. The `chain_layer_note` is present on the projection regardless of the chain layer being source-empty (section 3), so it remains the legible-empty-layer marker.
- **Plan 05 -- the cache contract + the boundary scan (LANDED).** See section 4c for the Brain-derived LOCAL cache contract (the deferred nav-engine consumer target, Tier-0 resilient, the consumable shape, the deferred fast-follows) and section 4d for the adversarial Part 8 boundary scan that proves zero user-content fields by construction across the projection + generator + analogue seed + allowlist.

---

## 6. Canon anchors

- **Part 8 dual-role amendment** (`docs/MINDRIAN-CANON.md`, "The Brain's dual role (orchestration projection)" subsection): sanctions the Brain holding a typed projection of Mindrian's own orchestration layer alongside the teaching methodology, with `methodology_tier` as the boundary-keeper, and names the closed edge set (OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE) + the ranking inputs (hierarchy_rank, posture, sensor_triggers) this contract carries.
- **Appendix D entry 19**: records the navigator-LOCKED amendment (D-03, 2026-06-15) via the Part 6 dog-fooding canon-amendment-on-itself mechanism, with the projection as a Brain-derived LOCAL cache (Part 9) and ZERO live Brain read/write.
- **Part 9** (Memory Locality): the projection is a LOCAL cache; files preserve meaning, SQL remembers and navigates, the Brain reasons over structured packets, never raw memory.
- **Part 7** (Reuse Before Build): the generator is a sibling of `build-connector-registry.cjs`, reusing its `listSourceFiles` walk + `build* -> serialize*` byte-compare + three-branch `main()` discipline.
