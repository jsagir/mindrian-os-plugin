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

## 5. Forward references (Plans 04 and 05)

- **Plan 04 -- the `--check` drift tripwire.** A `--check` mode (mirroring the connector idiom; wired into the pre-commit hook + the Feynman runner) regenerates the projection in memory and exits non-zero on any of three failures:
  - **STALE** -- the repo's commands / skills / agents / frameworks diverge from the committed projection (someone edited a surface without regenerating).
  - **UN-WIRED** -- a framework / command / skill is missing from the projection OR a framework is not reachable via the OPERATES -> reach wiring (the generalization of the `/mos:futures` un-wired gap).
  - **UN-RANKED** -- a connector-declaring `mindrian-operation` node lacks its ranking inputs (`reach_id` / `hierarchy_rank` / `posture`). Plan 04 asserts the ranking fields are present on connector-derived nodes and ABSENT (legally exempt) on name-only skill nodes (D-01). When asserting an UN-RANKED failure fixture, Plan 04 targets a connector-declaring node stripped of its ranking inputs; it must NOT flag a name-only skill node, which is exempt by design. The `chain_layer_note` is present on the projection regardless of the chain layer being source-empty, so Plan 04 can assert its presence as the legible-empty-layer marker.
- **Plan 05 -- the boundary scan.** A build-time boundary scan over the projection artifact + its generator proves zero user-content fields by construction: every node field is a command slug, a reach_id, a sub_mode, a framework name, a `methodology_tier`, a ranking enum/scalar, or a SENS id; every edge is one of the five closed types between two node ids. A projection node or field carrying user-specific bytes is a Part 8 breach, caught before the artifact lands.

---

## 6. Canon anchors

- **Part 8 dual-role amendment** (`docs/MINDRIAN-CANON.md`, "The Brain's dual role (orchestration projection)" subsection): sanctions the Brain holding a typed projection of Mindrian's own orchestration layer alongside the teaching methodology, with `methodology_tier` as the boundary-keeper, and names the closed edge set (OPERATES, CHAINS, FEEDS_INTO, PREREQUISITE, CROSS_DOMAIN_ANALOGUE) + the ranking inputs (hierarchy_rank, posture, sensor_triggers) this contract carries.
- **Appendix D entry 19**: records the navigator-LOCKED amendment (D-03, 2026-06-15) via the Part 6 dog-fooding canon-amendment-on-itself mechanism, with the projection as a Brain-derived LOCAL cache (Part 9) and ZERO live Brain read/write.
- **Part 9** (Memory Locality): the projection is a LOCAL cache; files preserve meaning, SQL remembers and navigates, the Brain reasons over structured packets, never raw memory.
- **Part 7** (Reuse Before Build): the generator is a sibling of `build-connector-registry.cjs`, reusing its `listSourceFiles` walk + `build* -> serialize*` byte-compare + three-branch `main()` discipline.
