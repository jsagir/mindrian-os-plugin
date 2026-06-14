# SEED-024: Brain as Orchestration Graph + Framework Tiers (when/how to invoke and chain the whole Mindrian toolset)

- **Planted:** 2026-06-14
- **Source:** Navigator (Jonathan) realization during the Phase 150.10 session, after hand-wiring systems-thinking <-> reverse-salient <-> find-analogies <-> research chains one CROSS_DOMAIN_ANALOGUE edge at a time. The generalization: stop hand-wiring; let the Brain hold the whole orchestration graph.
- **When:** v1.14.0+ milestone-sized. Pairs with the Futures Wheel Agent initiative (both need Brain-orchestrated chaining). Canon-adjacent (see below).
- **Status:** dormant

## The problem (intent vs actual)

Larry's reach / connector spine knows how to chain frameworks LOCALLY (data/connector-registry.json maps 55 connectors -> reach_id/sub_mode/framework; data/command-registry.json maps framework -> command). But the chaining INTELLIGENCE -- "given where the navigator is, which command/framework do I invoke next, and what does it chain to" -- is split between hand-maintained local registries and ad-hoc CROSS_DOMAIN_ANALOGUE edges the navigator wires by hand (as in the 150.10 session: M4 leverage <-> reverse-salient, M3 archetype <-> find-analogies + research).

The Brain already holds the PWS methodology graph (Cynefin, Meadows, JTBD, Reverse Salient, Systems Thinking, etc. with FEEDS_INTO/PREREQUISITE chains). What it does NOT hold, as a first-class typed layer, is Mindrian's OWN operating machinery -- the commands, reaches, skills -- and the OPERATES relationship between them and the methodologies they run. So Brain cannot yet answer "which Mindrian command operates this framework, and what should the navigator reach for next."

## The vision (3 pieces)

### 1. Ingest the whole toolset into Brain as a typed orchestration graph
Every command, reach, skill, and framework becomes a Brain node. Edges encode invocation + chaining: OPERATES (command -> framework), CHAINS / FEEDS_INTO / PREREQUISITE (framework -> framework, reach -> reach), CROSS_DOMAIN_ANALOGUE (the leverage<->reverse-salient class of equivalence). Brain becomes the ORCHESTRATION brain, not just the teaching brain: the navigation engine queries Brain ("given this problem-type / stage / fired sensor, what is the ranked next reach and its chain") instead of reading a hand-maintained local table.

### 2. A second-tier TYPE: methodology_tier
Differentiate two node classes:
- **methodology_tier: pws** -- the teaching frameworks (Cynefin, Meadows leverage points, JTBD, Reverse Salient Analysis, Systems Thinking, the De Bono hats, etc.). What the navigator is taught.
- **methodology_tier: mindrian-operation** -- Mindrian's own machinery (the /mos commands, the 6 reaches + sub_modes, the skills, the connector spine). How the navigator is served.

The distinction is already SEEDED in the Brain schema (mindrian_internal, mos_command, methodology_by properties exist) but is not formalized or complete. This piece makes it a first-class, queryable property on every relevant node.

### 3. Commands are OPERATORS of methodologies
A command node OPERATES one or more framework nodes (the connector-registry already encodes command -> framework; promote it to a typed Brain edge). /mos:systems-thinking OPERATES Systems Thinking; /mos:find-bottlenecks OPERATES Reverse Salient Analysis; /mos:find-analogies OPERATES Four Lenses of Innovation. This is the layer that lets Brain translate "reach for the leverage lens" into "invoke /mos:systems-thinking M4, which can chain to /mos:find-bottlenecks."

## Existing substrate (assemble, not rebuild -- Part 7)

- `data/connector-registry.json` -- 55 connectors, the command->reach/sub_mode/framework map (the LOCAL source of truth to project into Brain).
- `data/command-registry.json` -- Phase 122 framework->command registry + the --check tripwire idiom.
- Brain schema -- mindrian_internal / mos_command / methodology_by / brain_feeds_into / brain_prerequisite / brain_typical_at properties already exist on some nodes (partial tier seed).
- The 150.10 precedent -- the M4<->RS, M3<->analogy CROSS_DOMAIN_ANALOGUE edges written by hand are the manual prototype of what this automates.

## Canon-adjacency (do NOT ingest silently)

This expands the Brain's constitutional role. Canon Part 8 frames the Brain as "a repository of strategic thinking tools... not user data." Mindrian's commands/reaches/skills ARE generic plugin machinery (not user data), so writing them is Part-8-legal -- BUT the Brain's ROLE shifts from "teaching methodology repository" to "teaching methodology + Mindrian's own orchestration layer." That is a canon-level evolution and should land via a canon amendment (the Part 6 dog-fooding canon-amendment-on-itself mechanism), not a silent ingestion. The methodology_tier property is also what KEEPS the boundary legible: pws = the teaching IP; mindrian-operation = the machinery; neither is user data.

## Open questions (for the spec / discuss-phase)

1. Generated-vs-authored: is the orchestration graph GENERATED from connector-registry.json (single source of truth, --check tripwire like Phase 122) or authored in Brain? Generated is the Part 7 answer.
2. Local mirror vs Brain-only: does the navigation engine query Brain live for chaining, or read a Brain-derived local cache (Tier-0 resilience, like BRAIN.md derivation)?
3. Skills as nodes: skills are markdown behavior; what is the node granularity (one node per skill, or per capability)?
4. The OPERATES edge direction + cardinality (a command can operate several frameworks; a framework can be operated by several commands).
5. Does this absorb / supersede the Phase 122 command-registry, or sit above it?

## Pairing

Tackle alongside / before the Futures Wheel Agent initiative -- that agent also needs Brain-orchestrated chaining (seed/spec pending). The orchestration graph is the substrate both want.

## Provenance

Hand-wired chains written this session that this seed generalizes:
- M4 leverage <-> Reverse Salient Concept (CROSS_DOMAIN_ANALOGUE, both directions)
- M3 archetype <-> Four Lenses of Innovation (CROSS_DOMAIN_ANALOGUE)
- Leverage Point Local-Graph Excavation -> M4 / Leverage Points / Reverse Salient (PART_OF / RELATED_TO / CROSS_DOMAIN_ANALOGUE)
These were Part-8-clean generic-methodology writes to the production Brain (source_doc='iris-2026-session-2'); they are the working prototype of the OPERATES/CHAINS layer this seed would generate at scale.
