# Phase 157: Brain orchestration graph and methodology tiers - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A WIRING PIPELINE that projects Mindrian's own orchestration layer into a Brain-shaped graph: a generator reads the registries + a skills/agents walk and emits a typed orchestration projection (nodes with methodology_tier; OPERATES/CHAINS/FEEDS_INTO/CROSS_DOMAIN_ANALOGUE edges); a --check tripwire fails CI on any framework un-projected, un-wired-to-a-reach, or un-ranked (generalizing the /mos:futures un-wired gap). Canon Part 8 amendment lands FIRST. Live Brain write, continuous remote sync (Phase 137), and live nav-engine consumption are deferred. v1.14.0-candidate.
</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**11 requirements are locked.** See `157-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `157-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** canon Part 8 amendment FIRST; methodology_tier on every node; the generator (reads connector-registry + command-registry + skills/agents walk); per-file node grain; OPERATES + CHAINS/FEEDS_INTO/PREREQUISITE + CROSS_DOMAIN_ANALOGUE edges; framework->reach wiring completeness; ranking inputs exposed; --check drift tripwire (un-projected/un-wired/un-ranked); Brain-derived LOCAL cache shape; Part 8 generic-machinery-only; wired into pre-commit + Feynman runner.

**Out of scope (from SPEC.md):** live Brain write; continuous remote sync (Phase 137); nav-engine live consumption; superseding Phase 122; per-capability node grain; a capability taxonomy.
</spec_lock>

<decisions>
## Implementation Decisions

### Skills/agents projection (the connector-coverage gap)
- **D-01:** Skills carry NO connector frontmatter (0/13). Project each skill as a `mindrian-operation` node (name + tier ONLY), and EXEMPT skills from the framework->reach wiring-completeness gate (BOG-06) - skills are behavior loaded as context, not reach-dispatched like commands. Agents (7/9 have connector frontmatter) use their existing connector. No skill-frontmatter migration in this phase. The wiring-completeness gate applies to commands + frameworks, NOT skills.

### CROSS_DOMAIN_ANALOGUE edge source
- **D-02:** A hand-authored, version-controlled `data/cross-domain-analogues.json` that the generator reads (mirrors the `curated_chains` / `curated_extras` idiom already in `command-registry.json`). Explicit, `--check`'d, navigator-editable. Seeded with the 150.10 pairs (M4 leverage <-> reverse-salient, M3 archetype <-> four-lenses). NOT derived (no HSI/embedding - non-deterministic, wrong for a --check'd artifact); NOT spread across connector frontmatter.

### Canon amendment placement (BOG-01, navigator-gated, FIRST)
- **D-03:** Amend Canon Part 8 (the boundary section) to sanction the Brain's dual role (teaching methodology + Mindrian's own orchestration layer), with `methodology_tier` (pws / mindrian-operation) as the boundary-keeper that makes the machinery Part-8-legal. Record as an Appendix D entry + version bump - matching the established idiom (entries 14/15/18). NOT a new Canon Part. The amendment is the FIRST gate: no generator code commits before the navigator approves the LOCKED amendment text.

### Projection artifact + --check failure taxonomy
- **D-04:** ONE artifact: `data/brain-orchestration-projection.json` with `nodes[]` + `edges[]` (mirrors `connector-registry.json` layout + serialize/byte-compare). `--check` distinguishes THREE named failure modes, each with its own message + non-zero exit: **STALE** (repo drifted from the committed projection), **UN-WIRED** (a framework/command has no reach), **UN-RANKED** (a mindrian-operation node lacks ranking inputs). NOT per-tier files; NOT a single generic STALE.

### Systems-investigation reconciliation (157-RESEARCH.md, 2026-06-15 fan-out)
- **D-05:** A 5-agent systems-thinking fan-out on the what-next reach layer (filed as 157-RESEARCH.md) CONFIRMS and sharpens this phase:
  - **BOG-06 confirmed** - the connector registry is hand-maintained and demonstrably lets commands ship un-wired + dial-invisible (the `/mos:futures` gap this session); the generator + --check is the right structural fix.
  - **BOG-07 ELEVATED to load-bearing** - all 5 investigators independently flag the same opacity (navigator sees only a confidence % + a machine reach name, never the D4 score breakdown, the framework->command->reach chain, or the firing sensor). BOG-07 is NOT a nice-to-have data projection; it is the precondition for high-fidelity rejection reasons that fuel the layer's missing learning loop. The plan should treat exposing ranking inputs as a first-class deliverable, and the projection MUST carry the chain + sensor provenance, not just the score signals.
  - **Sequencing correction (the reverse salient is NOT in this phase)** - the single highest-leverage fix is closing the rejection->weight learning loop (REJECTED edges file but nothing reads them back; ensemble weights at `f-selector-ranker.cjs:287-290` are static priors never tuned; canon Decision 13 "rejection is data" is violated in spirit). That fix is **LOCAL-only and does NOT need the Brain orchestration graph.** It is OUT of Phase 157 scope (confirms the "nav-engine consumption deferred" boundary) and should be a tightly-scoped LOCAL follow-on (SEED-009 minimal form: a bounded, investment-scaled REJECTION_PENALTY mirroring the shipped `applyDecayWeight` PIVOT/DEFER hook). Phase 157 wires the SUPPLY side (frameworks->reaches, BOG-06) + the LEGIBILITY side (exposed inputs, BOG-07); it hands the DEMAND-side learning loop to that follow-on.
  - **Carry to discuss/plan:** the 6 open questions in 157-RESEARCH.md, especially (a) the empirical sensor-firability trace on a fresh room and (b) the actual outcome-edge count (SEED-009's >=1000 trigger vs the estimated <100), which decides whether any learned-weight work is even justified yet.

### Claude's Discretion
- The exact JSON field names + schema of the projection; the generator's internal module structure; the precise skills/agents walk traversal; how OPERATES edges are derived from the connector/command-registry maps; the `--check` message wording; the cache-contract schema doc. All left to research + planning. Constraint: mirror `build-connector-registry.cjs`; reuse, no new heavy dependency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec + source vision
- `.planning/phases/157-brain-orchestration-graph-and-methodology-tiers/157-SPEC.md` - locked requirements (BOG-01..11) - MUST read before planning
- `.planning/seeds/SEED-024-brain-as-orchestration-graph-framework-tiers.md` - the vision, the 3 pieces, the remote-sync clause, the 5 open questions
- `.planning/specs/brain-orchestration-graph-design.md` - the SEED-024 design spec

### The generator idiom to mirror (Part 7)
- `scripts/build-connector-registry.cjs` - buildRegistry / serializeRegistry / parseConnectorFrontmatter / --check byte-compare + STALE exit (THE pattern to mirror)
- `data/connector-registry.json` - 56 connectors; command -> reach_id/sub_mode/framework/hierarchy_rank/posture (a source + the ranking-input source)
- `data/command-registry.json` - Phase 122; 95 commands + framework_index + curated_chains (a source; SITS BELOW, not superseded)

### Canon (the amendment surface)
- `docs/MINDRIAN-CANON.md` Part 8 (the boundary section to amend) + Appendix D (the amendment-record idiom, entries 14/15/18) + the version-history line
- `docs/CANON-PHASE-MAP.md` (Part 8 row + version-history table to update)

### Prior-art the edges generalize
- `.planning/phases/150.10-systems-thinking-f-selector/` - the hand-wired CROSS_DOMAIN_ANALOGUE edges (M4<->reverse-salient, M3<->four-lenses) that seed data/cross-domain-analogues.json
- `lib/hmi/sensor-types.cjs` (REACH_IDS - the frozen 6 reaches) + `lib/hmi/reach-component-map.json` (reach->component map)

### Ranking + nav-engine (deferred consumer, contract target)
- `lib/core/navigation-engine.cjs` (decide() - the deferred consumer of the ranking inputs)
- `lib/hmi/f-selector-ranker.cjs` / the dial ranker (what "what fits" ranking looks like today)

### Dependency phases
- `docs/CANON-PHASE-MAP.md` Phase 137 (brain-mindrianos-sync-compat, NOT built, v1.14.0) - the remote-sync substrate this phase DEFERS to; SEED-024 absorbs/sequences it
- Phase 122 (command-registry + --check idiom) - the framework<->command source this sits above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-connector-registry.cjs`: the generator + --check idiom to mirror exactly (buildRegistry -> serializeRegistry -> byte-compare; --check exits non-zero + recovery message). The orchestration generator is a sibling of this.
- `data/connector-registry.json` (56 connectors): already carries reach_id, sub_mode, framework, hierarchy_rank, posture, sensor_triggers per command - the ranking-input source (BOG-07) and the command->reach wiring source (BOG-06).
- `data/command-registry.json` (Phase 122): framework_index + curated_chains - the framework->command (OPERATES) source + the curated_chains idiom D-02 mirrors.
- The pre-commit hook + Feynman runner already invoke `build-connector-registry.cjs --check` - the registration surface for the new --check (BOG-11).

### Established Patterns
- Generator -> serialized JSON artifact -> --check byte-compare on every commit (the anti-drift discipline; same family as Phase 150.9 doctor --drift).
- Canon amendments via the Part 6 dog-fooding mechanism: Appendix D entry + version bump (entries 14/15/18 are the template).
- Frozen closed sets (REACH_IDS=6, ALLOWED_EDGE_TYPES) - the projection's edge-type set should likewise be a documented closed set.

### Integration Points
- New: the orchestration generator (sibling to build-connector-registry.cjs), `data/brain-orchestration-projection.json`, `data/cross-domain-analogues.json`, the --check registration in pre-commit + Feynman runner, the Canon Part 8 amendment.
- Reads: connector-registry.json, command-registry.json, skills/ + agents/ walk, cross-domain-analogues.json.
- Does NOT touch: the live Brain (no write/query at runtime), Phase 122's command-registry (read-only source), the nav engine (the cache contract is defined but not consumed).

</code_context>

<specifics>
## Specific Ideas

- The motivating pain (this session): /mos:futures shipped un-wired because the connector-registry wasn't regenerated; --check caught it only on a manual run. The wiring-completeness gate (BOG-06, UN-WIRED failure mode) must make that failure automatic + by-construction.
- methodology_tier is the legibility keeper: pws = the teaching IP, mindrian-operation = the machinery; the Part 8 amendment turns on this distinction.
- The projection IS the Brain-derived local cache (Tier-0 resilient); the nav engine reading it is the deferred Phase-137-adjacent fast-follow.

</specifics>

<deferred>
## Deferred Ideas

- LIVE Brain write of the projection (one-time ingest) - fast-follow; needs the admin/Neo4j write path.
- CONTINUOUS remote sync (release-lockstep SYNC + CI drift-vs-Brain) - Phase 137 (brain-mindrianos-sync-compat); SEED-024 absorbs/sequences it.
- Nav-engine live CONSUMPTION of the cache for a ranked next-reach at decide() time - deferred; this phase defines the cache contract only.
- Superseding Phase 122's command-registry - it stays a read source.
- Per-capability (sub-file) node grain + a capability taxonomy - per-file grain only.
- Adding connector frontmatter to the 13 skills - skills stay name-only nodes for now (D-01).

</deferred>

---

*Phase: 157-brain-orchestration-graph-and-methodology-tiers*
*Context gathered: 2026-06-15*
