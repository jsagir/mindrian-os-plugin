# Phase 157: Brain orchestration graph and methodology tiers - Specification

**Created:** 2026-06-15
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 11 locked
**Milestone:** v1.14.0-candidate (canon amendment + local generator MVP; remote-sync clause = Phase 137, deferred)
**canon_parts:** Part 6 (dog-fooding canon-amendment-on-itself - the FIRST step), Part 7 (reuse - generate from the registries, never hand-author), Part 8 (only generic machinery metadata; methodology_tier keeps the boundary legible), Part 9 (Brain as external cortex; local cache is the consumable)

## Goal

Build a WIRING PIPELINE that projects Mindrian's own orchestration layer into a Brain-shaped graph and guarantees every framework (new and existing) is connected to the Larry reaches and carries its ranking signals. A generator reads the registries + a skills/agents walk and emits a typed orchestration projection (every command/reach/skill/framework a node with a `methodology_tier`; OPERATES + CHAINS/FEEDS_INTO/PREREQUISITE + CROSS_DOMAIN_ANALOGUE edges); a `--check` drift tripwire fails CI on anything un-projected, un-wired-to-a-reach, or un-ranked (the generalization of the gap that let `/mos:futures` ship un-registered earlier today). Live Brain write, continuous remote sync, and live nav-engine consumption are explicitly deferred.

## Background

**The intent vs actual (SEED-024).** Larry's reach/connector spine chains frameworks LOCALLY: `data/connector-registry.json` (56 connectors) maps command -> reach_id/sub_mode/framework, `data/command-registry.json` (Phase 122, 95 commands + `framework_index`) maps framework -> command. But the chaining + ranking INTELLIGENCE is split between hand-maintained registries and ad-hoc CROSS_DOMAIN_ANALOGUE edges wired by hand (the 150.10 session: M4 leverage <-> reverse-salient, M3 archetype <-> find-analogies+research). The Brain holds the PWS teaching graph (FEEDS_INTO/PREREQUISITE chains) but NOT, as a first-class typed layer, Mindrian's OWN machinery (commands/reaches/skills) or the OPERATES relationship between commands and the frameworks they run.

**The live pain this fixes (this session).** Phase 156 added `/mos:futures` with connector frontmatter, but it shipped **un-wired**: `data/connector-registry.json` was not regenerated, so the dial could not surface it until a manual `build-connector-registry.cjs` run. The `--check` tripwire caught it only because someone ran it. The navigator's requirement: a pipeline where introducing ANY new framework/command/skill is wired to the reaches + ranking automatically, and `--check` fails on any un-wired surface - by construction, not by remembering.

**Substrate to assemble (Part 7, verified 2026-06-15).** `scripts/build-connector-registry.cjs` is the generator idiom to mirror: `buildRegistry()` / `serializeRegistry()` / `parseConnectorFrontmatter()` / `--check` byte-compare + STALE exit. `data/command-registry.json` (Phase 122) is read as a source, not rebuilt. `methodology_tier` is genuinely net-new in the repo (only the `mindrian_internal` flag exists, on :Person nodes). The 150.10 hand-wired CROSS_DOMAIN_ANALOGUE edges are the manual prototype of the OPERATES/CHAINS layer.

**Delta.** No generator emits a Brain orchestration projection. No `methodology_tier` property is formalized. No `--check` validates framework->reach wiring completeness or ranking-input presence. Canon Part 8 does not yet sanction the Brain's dual role. This phase adds those; it does NOT write to the live Brain or build the continuous sync.

## Requirements

1. **Canon amendment FIRST (gating)**: Canon Part 8 is amended to sanction the Brain's dual role before any generator code lands.
   - Current: Part 8 frames the Brain as "a repository of strategic thinking tools... not user data" - no mention of an orchestration layer.
   - Target: A navigator-gated LOCKED amendment (Part 6 dog-fooding mechanism, like Appendix D entries 14/15/18) records that the Brain holds teaching methodology AND Mindrian's own orchestration layer, with `methodology_tier` as the boundary-keeper that makes the machinery Part-8-legal (generic, never user data). MINDRIAN-CANON.md + CANON-PHASE-MAP.md updated; version bumped.
   - Acceptance: `docs/MINDRIAN-CANON.md` contains the dual-role + methodology_tier amendment with an Appendix D entry; the canon version line is incremented; no generator code is committed before this lands.

2. **methodology_tier as a first-class property**: every projected node carries a tier.
   - Current: not present in the repo (only `mindrian_internal` exists).
   - Target: each node carries `methodology_tier`: `pws` (teaching frameworks - Cynefin, Meadows, JTBD, Reverse Salient, Six Hats, etc.) or `mindrian-operation` (the /mos commands, the 6 reaches + sub_modes, skills, the connector spine).
   - Acceptance: every node in the emitted projection has a `methodology_tier` of exactly `pws` or `mindrian-operation`; a node lacking it fails `--check`.

3. **Generator emits the orchestration projection (Part 7 reuse)**: from the registries + a skills/agents walk, never hand-authored.
   - Current: no orchestration-graph generator; chaining is split across hand-maintained registries.
   - Target: a generator (mirroring `build-connector-registry.cjs`) reads `connector-registry.json` + `command-registry.json` + a `skills/` + `agents/` walk and emits a serialized Brain orchestration projection artifact (e.g. `data/brain-orchestration-projection.json`). Phase 122's command-registry SITS BELOW it (read as a source, not superseded).
   - Acceptance: running the generator produces the projection artifact; the artifact's nodes derive from the registries (a framework/command absent from the sources is absent from the projection); the generator has zero hand-authored node list.

4. **Node granularity = per command/skill/agent/framework**: file-level, matching the registries.
   - Current: n/a.
   - Target: one node per /mos command, per skill, per agent (all `mindrian-operation`), and per framework (`pws`). No sub-capability decomposition.
   - Acceptance: the projection node count equals (commands + skills + agents + distinct frameworks) within a documented tolerance; no node is finer than file-level.

5. **Typed orchestration edges**: OPERATES + chaining + analogy edges in the projection.
   - Current: command->framework lives only in the connector/command registries (untyped as a graph edge); chaining is hand-wired.
   - Target: the projection encodes OPERATES (command -> framework, promoted from the registry map), CHAINS / FEEDS_INTO / PREREQUISITE (framework -> framework, reach -> reach), and CROSS_DOMAIN_ANALOGUE (the leverage<->reverse-salient class). Edge types are a documented closed set.
   - Acceptance: the projection contains >=1 OPERATES edge per command that declares a framework; the 150.10 hand-wired analogies (M4<->reverse-salient, M3<->four-lenses) appear as CROSS_DOMAIN_ANALOGUE edges; only the documented edge types are emitted.

6. **Framework -> reach WIRING COMPLETENESS (navigator requirement)**: every framework is reachable, and `--check` enforces it.
   - Current: a new command can ship with framework frontmatter but no reach wiring (the `/mos:futures` gap); nothing fails until someone manually regenerates.
   - Target: the projection makes the framework -> command (OPERATES) -> reach (connector `reach_id`/`sub_mode`) wiring explicit; the `--check` gate (BOG-08) FAILS when any framework/command/skill is missing from the projection OR is not wired to one of the 6 frozen reaches. This is the generalization of the futures-gap gate.
   - Acceptance: a deliberately un-wired fixture framework (declares a framework but no reach connection) makes `--check` exit non-zero with a clear "un-wired" message; the live repo passes once all surfaces are wired.

7. **Ranking inputs exposed (navigator "what fits")**: the projection carries the reach-ranking signals.
   - Current: ranking signals (`hierarchy_rank`, `posture`, sensor_triggers) live only in connector frontmatter; the orchestration layer does not expose them as a consumable.
   - Target: each `mindrian-operation` node carries the ranking-relevant signals from its connector (`reach_id`, `sub_mode`, `hierarchy_rank`, `posture`, `sensor_triggers`) plus its OPERATES/CHAINS edges, so the nav engine's "what fits" reach ranking can consume them from the projection. (Nav-engine consumption itself is deferred - see Out of scope.)
   - Acceptance: every `mindrian-operation` node that declares a connector exposes `reach_id` + `hierarchy_rank` + `posture` in the projection; a fixture query can rank candidate reaches for a given (problem-type/stage) from the projection alone.

8. **`--check` drift tripwire = the wiring pipeline gate**: fails CI on un-projected / un-wired / un-ranked surfaces.
   - Current: `build-connector-registry.cjs --check` catches connector-registry staleness only; nothing checks orchestration-projection drift.
   - Target: a `--check` mode (mirroring the connector idiom; pre-commit + Feynman runner) regenerates the projection in memory and exits non-zero when the repo's commands/skills/agents/frameworks diverge from the committed projection, OR a framework is un-wired (BOG-06), OR a `mindrian-operation` node lacks ranking inputs (BOG-07).
   - Acceptance: editing/adding a command without regenerating makes `--check` exit non-zero with a "STALE/un-wired" message + the recovery command; a clean repo exits 0.

9. **Brain-derived LOCAL cache shape (Tier-0 resilient)**: the projection is the consumable; no runtime Brain dependency.
   - Current: n/a.
   - Target: the projection artifact IS the Brain-derived local cache the nav engine will read (mirrors the BRAIN.md derivation resilience pattern). The cache shape is defined + documented; the actual nav-engine read is deferred but the contract is specified so the deferred consumer has a target.
   - Acceptance: the projection artifact is a committed local file with a documented schema; no code in this phase makes a live Brain query or write at runtime.

10. **Part 8 locality of the synced metadata**: only generic machinery, never user content.
    - Current: n/a (no projection yet).
    - Target: the projection contains ONLY generic machinery metadata - command slugs, reach_ids, framework names, methodology_tier, OPERATES/CHAINS edges. No user content, no room data, no personal identifiers.
    - Acceptance: a boundary scan over the projection artifact + generator finds zero user-content fields; methodology_tier is present on every node as the legibility marker.

11. **Generator + check wired into the existing gates**: pre-commit + Feynman runner, mirroring the connector idiom.
    - Current: `build-connector-registry.cjs --check` is in the pre-commit + Feynman runner.
    - Target: the orchestration-projection `--check` is registered in the same gate surfaces (pre-commit hook + Feynman runner), so the wiring pipeline is enforced on every commit, not on memory.
    - Acceptance: the pre-commit / Feynman runner invokes the orchestration `--check`; a CI run with a deliberately stale projection fails.

## Boundaries

**In scope:**
- Canon Part 8 amendment (dual role + methodology_tier), navigator-gated, FIRST
- `methodology_tier` (pws / mindrian-operation) on every node
- The generator (reads connector-registry + command-registry + skills/agents walk; emits the projection artifact)
- Per-file node granularity (command/skill/agent/framework)
- Typed edges: OPERATES, CHAINS/FEEDS_INTO/PREREQUISITE, CROSS_DOMAIN_ANALOGUE
- Framework->reach wiring-completeness enforcement
- Ranking-input exposure in the projection (hierarchy_rank/posture/reach_id/edges)
- `--check` drift tripwire (un-projected / un-wired / un-ranked) wired into pre-commit + Feynman runner
- The projection as a Brain-derived LOCAL cache (shape + schema defined)

**Out of scope (deferred):**
- LIVE Brain write of the projection - deferred (needs the admin/Neo4j write path; one-time ingest is a fast-follow)
- CONTINUOUS remote sync (the release-lockstep SYNC step + CI drift-vs-Brain) - this is Phase 137 (brain-mindrianos-sync-compat); SEED-024 absorbs/sequences it, NOT this phase
- Nav-engine live CONSUMPTION of the cache for a ranked next-reach at decide() time - deferred; this phase exposes the inputs + defines the cache contract only
- Superseding Phase 122's command-registry - it sits below as a source, not replaced
- Per-capability (sub-file) node decomposition - per-file grain only
- A capability taxonomy - not built

## Constraints

- The generator mirrors `scripts/build-connector-registry.cjs` (buildRegistry/serializeRegistry/--check byte-compare); no new heavy dependency.
- The generator READS `data/connector-registry.json` + `data/command-registry.json` + walks `skills/` + `agents/`; it never hand-authors the node list (Part 7).
- Only the documented closed set of edge types is emitted.
- Canon Part 8: the projection carries generic machinery metadata only; the canon amendment must land before generator code (BOG-01 gates the phase).
- No live Brain read/write at runtime in this phase (local cache only).
- HARD RULE: no em-dashes (hyphens only). Tri-Polar: the generator is a build-time CLI; the projection is consumed identically across CLI/Desktop/Cowork (a local artifact).

## Acceptance Criteria

- [ ] Canon Part 8 amended with the dual-role + methodology_tier (navigator-LOCKED); Appendix D entry + version bump; no generator code committed before it
- [ ] The generator emits a projection artifact derived from the registries (no hand-authored node list)
- [ ] Every node carries methodology_tier of exactly `pws` or `mindrian-operation`
- [ ] Node granularity is per command/skill/agent/framework (file-level)
- [ ] The projection contains OPERATES edges (>=1 per command declaring a framework) + the 150.10 CROSS_DOMAIN_ANALOGUE edges; only documented edge types
- [ ] A deliberately un-wired fixture framework makes `--check` exit non-zero with an "un-wired" message; the live repo passes
- [ ] Every mindrian-operation node exposes its ranking inputs (reach_id/hierarchy_rank/posture); a fixture can rank candidate reaches from the projection alone
- [ ] `--check` exits non-zero on a stale/un-wired/un-ranked projection and 0 when clean; it is registered in pre-commit + the Feynman runner
- [ ] The projection is a committed local file with a documented schema; zero live Brain read/write at runtime
- [ ] Part 8 boundary scan over the projection + generator returns zero user-content fields

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes                                                          |
|--------------------|-------|-------|--------|----------------------------------------------------------------|
| Goal Clarity       | 0.82  | 0.75  | ✓      | A wiring pipeline (generator + --check), not a static projection |
| Boundary Clarity   | 0.85  | 0.70  | ✓      | Live write / continuous sync / nav-consumption all deferred     |
| Constraint Clarity | 0.78  | 0.65  | ✓      | 122 sits-below; per-file grain; connector --check idiom         |
| Acceptance Criteria| 0.80  | 0.70  | ✓      | 10 pass/fail checks                                             |
| **Ambiguity**      | 0.18  | ≤0.20 | ✓      | Gate passed; all minimums met                                  |

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                                                 |
|-------|-----------------|-------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Scout           | What substrate exists?                     | build-connector-registry.cjs idiom; command-registry 95 cmds; methodology_tier net-new; Phase 137 NOT built |
| 1     | Researcher      | MVP boundary vs milestone?                 | Canon amendment + local generator + --check; DEFER live write/sync (Phase 137) + nav-engine consumption |
| 1     | Boundary Keeper | Canon amendment scope?                     | Formal Part 8 amendment + methodology_tier as boundary-keeper, navigator-gated, FIRST gate |
| 1     | Researcher      | Nav-engine consumption?                    | Brain-derived LOCAL cache (Tier-0 resilient); consumption deferred              |
| 2     | Boundary Keeper | Relationship to Phase 122?                 | 122 SITS BELOW - generator reads it as a source, not superseded                 |
| 2     | Simplifier      | Success pass/fail?                         | Projection + wiring drift-check + amended canon (no live-Brain dependency)       |
| 2     | Researcher      | Node granularity?                          | One node per command/skill/agent/framework (file-level)                          |
| 2+    | Navigator input | "must be a pipeline that wires any new + existing framework to the larry reaches, and the ranking what fits" | BOG-06 (framework->reach wiring completeness, the --check enforces it - generalizing the /mos:futures un-wired gap) + BOG-07 (ranking inputs exposed in the projection) added as first-class requirements |

---

*Phase: 157-brain-orchestration-graph-and-methodology-tiers*
*Spec created: 2026-06-15*
*Next step: /gsd-discuss-phase 157 - implementation decisions (how to build what's specified above)*
