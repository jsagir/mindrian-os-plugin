# Design Spec: Brain as Orchestration Graph + Framework Tiers

Status: draft (seed SEED-024). Grounded in data/connector-registry.json (55 connectors) + data/command-registry.json (Phase 122). Canon-adjacent: requires a Part 6 dog-fooding canon amendment before ingestion.

## 1. Intent

Promote Mindrian's hand-maintained local orchestration registries into the Brain as a typed, queryable orchestration graph, so the navigation engine asks the Brain "what do I invoke / chain next" instead of reading a local table -- and so the Brain can chain the whole toolset the way the 150.10 session chained three reaches by hand.

## 2. Node model

Two tiers, one property:

- `methodology_tier: pws` -- teaching frameworks (existing Brain nodes: Cynefin, Meadows, JTBD, Reverse Salient Analysis, Systems Thinking, De Bono hats, etc.). Mostly already present; this spec TAGS them.
- `methodology_tier: mindrian-operation` -- the machinery, NEW typed nodes projected from the registries:
  - `Command` (or reuse existing label + the mos_command property) -- the 91+ /mos commands.
  - `Reach` -- the 6 frozen reach_ids + their sub_modes (context_block/systems-thinking-loop, etc.).
  - `Skill` -- the plugin skills (granularity TBD, open Q3).

Minimal new properties: `methodology_tier` (enum), `mos_command` (slug), `reach_id`, `sub_mode`. Several already exist in the schema (mindrian_internal, mos_command, methodology_by) -- reuse, do not duplicate.

## 3. Edge model

- `OPERATES` (Command -> Framework) -- the command runs the methodology. Source: connector-registry `framework` field per connector. NEW edge type (or reuse USES_FRAMEWORK which exists).
- `CHAINS` / `FEEDS_INTO` / `PREREQUISITE` (Framework->Framework, Reach->Reach) -- the chaining graph. FEEDS_INTO + PREREQUISITE already exist and carry the methodology chains; extend to reaches.
- `CROSS_DOMAIN_ANALOGUE` (Framework<->Framework) -- the leverage<->reverse-salient class of equivalence (already used; the 150.10 hand-writes are the prototype).
- `ADDRESSES_PROBLEM_TYPE` / `APPLIED_IN_STAGE` (existing) -- the "when to invoke" signal the nav engine ranks on.

## 4. Generation (Part 7 -- single source of truth)

The orchestration graph is GENERATED from data/connector-registry.json (the existing 55-connector map), NOT authored in Brain. A generator (mirror scripts/build-connector-registry.cjs idiom) emits the Brain projection; a `--check` tripwire (pre-commit + Feynman runner) keeps Brain in sync with the registry. This makes the connector-registry the single source of truth and prevents Brain<->registry drift (the exact Phase 122 pattern, generalized from command-registry to the whole orchestration graph).

## 5. Navigation-engine consumption (Part 9)

The navigation engine (lib/core/navigation-engine.cjs decide()) gains a Brain-orchestration query: given (problem_type, stage, fired_sensor, current_reach), ask Brain for the ranked next reach + its OPERATES command + its CHAINS targets. Two modes (mirror the existing Mode A / Mode B / Tier-0 tier-awareness):
- Mode A (Brain reachable): live orchestration query, confidence-ranked.
- Mode B / Tier-0: a Brain-derived LOCAL cache (like BRAIN.md derivation) so chaining still works offline.
Part 8: the query carries only generic handles (reach_id, framework name, problem-type enum) -- never user content.

## 6. Canon amendment (precondition)

Before any ingestion: amend MINDRIAN-CANON.md (Part 8 / a new clause) to record that the Brain holds Mindrian's own orchestration machinery (methodology_tier: mindrian-operation) as generic plugin metadata, distinct from pws teaching IP, and that BOTH remain not-user-data. Land via the Part 6 dog-fooding canon-amendment-on-itself mechanism (mirror Appendix D entries 14/15/18). The methodology_tier property is the legibility mechanism that keeps the Part 8 boundary clear.

## 7. Scope split (MVP vs full)

- **MVP / pilot (SEED-024 option C, deferred):** tag methodology_tier on existing nodes; add OPERATES edges for the commands already chained (systems-thinking, find-bottlenecks, find-analogies). Proves the model on ~5 nodes.
- **Full milestone:** generator + --check tripwire + the 55-connector projection + the nav-engine Brain-orchestration query + the canon amendment. This is the milestone-sized build.

## 8. Open questions

Carried from SEED-024: generated-vs-authored (answer: generated), local-cache-vs-live (answer: both, tier-aware), skill node granularity, OPERATES cardinality, relationship to Phase 122 command-registry (absorb or sit-above).

## 9. Pairing

The Futures Wheel Agent initiative needs this same Brain-orchestrated chaining substrate. Sequence: orchestration graph first (or in parallel), Futures Wheel consumes it.
