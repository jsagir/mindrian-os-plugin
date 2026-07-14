---
id: SEEDS-INDEX
status: live
last_curated: 2026-05-24
curated_by: seed-system curation pass (post v1.13.0-beta.32, pre-v1.13.0-final)
curated_for: making the next milestone-scoping conversation faster and more grounded
---

# MindrianOS SEEDs -- Authoritative Index

## Flagship next work -- the EUREKA two-in-a-box (registered 2026-07-02)

**SEED-049 and SEED-050 are the two MAJOR seeds slated next** (navigator-directed, 2026-07-02). They are a matched pair -- a generator and its critic -- and are built together: the generator run open-loop without the critic is a confident-noise fountain.

| Seed | Role | What it is |
|---|---|---|
| **SEED-049** -- Mindrian EUREKA Engine | GENERATOR | Tri-modal room.db + tri-source hybrid retrieval; the measured (bert-lsa, reproducible) cross-domain differential + bridge/whitespace signal that PROPOSES eurekas. "One engine, many lenses." The graph<->web moat named. |
| **SEED-050** -- The Eureka EVAL | CRITIC + TRUST | Salient-verifier judge + trustworthy synthetic data; verifies a proposed eureka is a REAL transferable salient (not confident noise) and proves the engine reaches a real insight FASTER. Instruments the Phase-213 gate; rides Plurai / IntellAgent. |

**Target:** Phases 211-213 (registered 2026-07-04 in `.planning/ROADMAP.md`; renumbered from the original aspirational "206-208" -- that range was never actually free, 209/210 already occupy it from the curing-sequence revert). SEED-048 (portfolio-scale FUSION, NOT part of this flagship pair) rides at Phase 215, after 214's pattern-transfer. **Research backing:** `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` (backs both). **HARD rule:** no real tester/advisor names in-repo -- role descriptors + pseudonyms only (ARCHIMEDES, DA VINCI, the pedagogy lead, the MIT founder, the TTO IP lead). Unrelated release-tooling note lives at SEED-051, not part of this cluster.

> NOTE: the milestone/bundle tables below were last curated 2026-05-24 and only cover through ~SEED-023. Seeds 024-052 exist as committed files but are not yet folded into those tables; a curation pass is due. This flagship block is the authoritative pointer for 049/050 until then.

## SEED-052 - GSD each /mos: command as its own mini-product (registered 2026-07-05)

Sibling to the Phase 213 real-intent scope addendum (2026-07-05) and the Phase 191 reopened-checklist follow-up: not new architecture, a product-management pass over all 107 commands (JTBD defensibility, admin/user-facing audience enforcement, F-shape audit against the "default to plain native AskUserQuestion unless justified" principle, chain accuracy vs the command-research corpus). Deliberately NOT actioned yet -- registered mid a live Windows commands-registration bug hunt, navigator chose to finish that bug first. Full detail: `SEED-052-gsd-each-command-as-mini-product.md`. Smallest experiment: pilot ONE cluster (of the 12 in `.planning/research/command-map/INDEX.md`) before committing to all 107.

## SEED-057 - Synthesis as a votable expert / graph-native game theory (registered 2026-07-14)

Sibling to Phase 222 (reach-ranking-unification, registered same session). Phase 222 fixes the immediate wiring bug (two disagreeing reach-ranking paths) and adds a hand-rolled multiplicative-weights combiner (zero new deps -- same-session deep-research found no viable open-source library for MWU/Hedge, Thompson-sampling bandits, Shapley value, or mechanism-design/auction algorithms that is simultaneously maintained, permissively licensed, and free of native deps for this Node CJS codebase). SEED-057 generalizes one step further, navigator-directed: treat whitespace's `strategic_rank` (and any candidate-producing surface) as a fourth expert class in that same combiner, one whose vote can be "synthesize a new candidate here" rather than "rank an existing one," routed through the already-shipped eureka engine (211-216) and opportunity-harvest formula (219). Deliberately NOT folded into Phase 222 -- needs the combiner built and observed first. Full detail: `SEED-057-synthesis-as-votable-expert-graph-native-game-theory.md`.

## SEED-058 - Eureka reasoning-mode fallback (registered 2026-07-14)

Sourced from the interns homework-tracker QA program (Eureka-assignment round), not a navigator-brainstormed seed. A 30-entry room ran `/mos:eureka`, got `pairs_scored: 0` and a "not enough entries" render -- the actual cause was `encoder_unavailable` (embedding model never cached) intersecting an empty room.db graph (SEED-034's already-open bug, independently reconfirmed by this same session -- see SEED-034's `proving_case_2`). SEED-058 is the complementary half SEED-034 does not cover: even once SEED-034's harness ships, a cold machine (encoder not yet fetched) or a brand-new room (graph too thin regardless of the write-path fix) still needs Eureka to produce a real, labeled, lower-confidence `mode: reasoning` result instead of a hard `pairs_scored: 0` stop -- reading raw room markdown directly rather than room.db. Full detail: `SEED-058-eureka-reasoning-mode-fallback.md`; incident record: `.planning/debug/interns-round-eureka-david-session-2026-07-14.md`.

## Purpose

The MindrianOS SEED system carries **deferred-but-load-bearing reasoning** forward across milestone boundaries so the next planning conversation does not have to re-discover the WHY of work that was previously scoped, brainstormed, or proven-with-a-spike but deliberately not executed yet. A seed is the artifact between "we had this thought" and "we have a phase planned for it."

A SEED is the right shape when:
- The reasoning is too long to live in a TODO line
- The trigger condition is non-obvious (depends on tester signal, schema stability, a different phase shipping, market readiness, etc.)
- The cost of re-discovering the reasoning later is higher than the cost of writing it down now
- An immediate phase is **wrong** -- not because the work is invalid, but because it would burn against the wrong empirical baseline

A SEED is the **wrong** shape when:
- The work has a clear next-phase home -- in that case it is a phase or a backlog line
- The reasoning is small enough to fit in a comment, a TODO, or a one-line note
- There is no genuine deferral logic -- "I'll get to it" is not a trigger

### Status vocabulary (canonical, closed set)

| Status | Meaning |
|---|---|
| `dormant` | filed, waiting for trigger. Default. |
| `dormant+spiked` | filed + a research spike or sub-probe artifact exists; cost/risk refined; promotion gate sharpened |
| `scheduled-vN.N.N` | trigger has fired conceptually; promoted to a target milestone but no phase yet |
| `shipped` | the seed's value landed via a named phase; seed kept as provenance |
| `superseded` | the seed's value was absorbed into a different phase; do not re-surface unless that phase drops the absorbing sub-plan |
| `merged-into-SEED-NNN` | this seed's content folded into another seed; the merged-into seed is the live source of truth |

### Bundle vocabulary

A **bundle** is a set of SEEDs that should be evaluated together because they share an architectural theme and likely-overlapping implementing phases. Bundles surface at milestone-scoping time: when one bundle SEED's trigger fires, the curator evaluates ALL SEEDs in the bundle, not just the one. Bundles are NOT a forced taxonomy -- a SEED whose theme genuinely doesn't overlap with anything stays at `bundle: none`.

---

## Source-of-Truth Preamble (per Phase 127.2 D-10 discipline)

This INDEX is the **navigable view** of the seed system. The 14 SEED-NNN-*.md files in this directory remain the source of truth for each individual seed's WHY / TRIGGER / SCOPE / ACCEPTANCE / BREADCRUMBS. If this INDEX disagrees with a SEED-NNN-*.md file on a fact (status, trigger, scope, related phases), the SEED file wins. If a SEED file is missing from this INDEX, the INDEX is stale -- re-run the curation pass.

The frontmatter normalization migration is **already applied** (status, scope, bundle, related_phases, related_seeds, canon_parts) across all 14 SEEDs. Any future drift between SEED frontmatter and this INDEX is a curation-pass debt item.

---

## Collision resolution (2026-05-24)

Two SEEDs were filed with id `SEED-003`:
- `SEED-003-claude-code-2-1-x-capability-adoption.md` (planted 2026-05-05)
- `SEED-003-brain-silent-identity.md` (planted 2026-05-19)

**Resolution rule:** chronologically-earlier + downstream-heavier seed keeps the id. The claude-code capability seed:
- Was planted FIRST (2026-05-05 vs 2026-05-19)
- Owns MULTIPLE downstream references: Phase 114 (= SEED-003 A1, shipped beta.2), Phase 117-04 sanitizer (= SEED-003 A3, shipped beta.8), `scripts/brain-response-sanitize-hook.cjs` body comment, `references/capability-radar/capabilities-index.md` cross-refs A1-A5, multiple CHANGELOG entries

The brain-silent-identity seed had ZERO non-seed references at the time of curation.

**Action taken:**
- `SEED-003-brain-silent-identity.md` renamed to `SEED-011-brain-silent-identity.md` (SEED-011 was the only free slot between 001 and 014)
- Frontmatter `id:` changed `SEED-003` -> `SEED-011`
- File body H1 changed `# SEED-003:` -> `# SEED-011:` with a renamed-from banner preserved at the top of the body for searchability
- Frontmatter `renamed_from:` field added carrying the rationale
- `CHANGELOG.md` line 127 updated from `**SEED-003 (Brain Silent Identity)**` to `**SEED-011 (Brain Silent Identity)**` with an inline pointer to the resolution rule

Anyone searching for the old slug `SEED-003-brain-silent-identity` will find this INDEX section + the renamed file's body banner.

---

## Bundles

| Bundle | SEEDs | Shared theme | Shared implementing-phase candidate | Activation logic |
|---|---|---|---|---|
| **nested-room-correctness** | SEED-001, SEED-004 | Multi-room and nested-room ergonomics: detection, creation wiring, the false-positive write-scope-check bug. The correctness layer that has to ship BEFORE Room Budding (Phase 112) and SnapshotHub auto-generated sub-rooms make this code path heavily trafficked. | Phase 112 (GraphRAG Retrieval + Room Budding) AND any v1.14.0 SnapshotHub work | When `/gsd:new-milestone` opens v1.14.0 OR Phase 112 enters discuss-phase, evaluate both. SEED-004 must ship BEFORE SEED-001 (write-scope correctness is a precondition for proactive sub-room creation). |
| **heuristics-defer-to-explicit-signals** | SEED-005 | Single-seed observation, not a multi-seed bundle yet. The proposed Canon Part 11 ("heuristics must yield to explicit signals") would absorb SEED-004 + SEED-005 as instances. Keeping as a single-seed slot because the Canon amendment hasn't been ratified. | Phase 100 (JTBD Inference Engine, deferred to v1.14.0) | Promote to true multi-seed bundle if/when Canon Part 11 is proposed. |
| **brain-wire-architecture** | SEED-010, SEED-011, SEED-014 | The Brain MCP wire surface: how the plugin talks to the Brain, whether it needs an API key ceremony, where the Brain repo lives, what the schema-aware diagnostician sits underneath. All three SEEDs propose changes to the boundary where plugin meets Brain. | Phase 127 family (127, 127.1, 127.2) + a candidate v1.14.0 Brain repo split phase | When `/gsd:new-milestone` opens v1.13.2 or v1.14.0 AND the milestone theme touches "Brain architecture", "deploy boundaries", "Part 8 enforcement infrastructure", or "tester onboarding friction", evaluate all three. Ordering: SEED-011 (silent identity) extends Phase 127's stdio shim direction; SEED-014 (repo split) is the structural cleanup that follows; SEED-010 (investigator skill) lands once the post-127 schema is stable. |
| **learning-loops** | SEED-002, SEED-009, SEED-057 | Calibrated learning from accumulated outcome data: SEED-002 is lab-side APO over command prompts; SEED-009 is per-room ranker weight adaptation; SEED-057 (added 2026-07-14) is a synthesis-triggering expert layered on Phase 222's combiner -- unlike 002/009 it is NOT corpus-gated (Phase 222 ships a room-local hand-rolled multiplicative-weights combiner below any tester-cohort threshold), its trigger is "Phase 222 ships" plus the next touch of the already-live eureka/opportunity-harvest surfaces. Evaluate SEED-057 separately from the 002/009 corpus-gate logic below. All three honor Canon Part 8 (data stays where it's owned). | TBD v1.14.0+ when corpus thresholds clear (SEED-002/009); TBD post-Phase-222 (SEED-057) | When `/gsd:new-milestone` opens v1.14.0+ AND (Phase 121 trajectory telemetry shows >=100 entries OR tester cohort >=30), evaluate SEED-002/SEED-009. SEED-009 is also gated on F-selector outcome edges >=1000. Evaluate SEED-057 whenever Phase 222 has shipped and either the eureka engine or opportunity-harvest formula is next touched. |
| **intelligence-layer-activation** | SEED-008 | Single-seed bundle by theme. The "compute-and-store-but-never-act" critique that the v1.13.0 milestone "The Closed Loop" was named to address. Partially resolved across Phases 117 / 95.5 / 129; residual scope worth re-evaluating at v1.13.0 final gate. | Phase 129 spine-repair-memory-event (the remaining home for residual spine routing) | When v1.13.0 final release-gate audit runs, re-evaluate whether residual scope is fully consolidated under 129 or worth a small follow-up phase. |
| **visible-room-wiki** | SEED-006 | The wiki sprint. Single-seed bundle (no other SEED shares this theme). The Phase 19 mandates + Wikipedia design spec + LLM-Wiki competitive bar all converge on one named arc ("The Visible Room") with a hard release gate (Lawrence preview). | Phase 126 (the wiki sprint phase, target v1.14.0; FUSED with Phase 123 SnapshotHub MVP because they share renderer DNA) | When `/gsd:new-milestone v1.14.0` opens AND Phase 110 + Phase 114 have BOTH shipped, expand the wiki sprint memo into Phase 126 CONTEXT.md. |
| **first-touch-coherence** | SEED-007 | First-touch greeting coherence: no stale version copy, no em-dashes, no BSL-1.1 mislabel. ABSORBED into Phase 121.5 Sub-plan F (Terminal Coherence Capstone). Bundle kept as a slot in case future first-touch concerns appear; SEED-007 is currently `superseded`. | Phase 121.5 Sub-plan F (shipping in v1.13.0 final) | Only re-evaluate if Phase 121.5 drops Sub-plan F. Otherwise this bundle is closed-by-implementation. |
| **capability-radar-adoption** | SEED-003 | Adoption backlog from `/mos:radar --fetch` across Claude Code 2.1.110-128. A1 + A3 SHIPPED; A2 + A4 + A5 remain dormant. Single-seed bundle by theme. | Phase 114 + Phase 117 absorbed parts; remaining items have no current phase home | Re-evaluate at any v1.13.x or v1.14.0 release-planning. If A2/A4/A5 are still un-shipped at v1.14.0 cut, split SEED-003 into per-candidate child seeds OR formally retire A2/A4/A5 as "won't ship". |
| **feynman-storytelling** | SEED-012 | The /mos:feynman-engine command with non-expert panel + loop-until-zero-confusion gate. Single-seed bundle. | v1.13.1 milestone (navigator-targeted) | Evaluate at `/gsd:new-milestone v1.13.1` scoping. The 6-stage pipeline + persona substrate already exist; only the panel-loop orchestrator and the file-gate are net-new. |
| **cross-platform-fragility-cleanup** | SEED-013 | Eliminate Python from the user machine via @xenova/transformers CJS port. Single-seed bundle by theme, but adjacent to SEED-014 (Brain repo split) and SEED-008 (analyzer-never-fires) at the architectural-cleanup tier. | Phase 134 (scaffolded, no PLAN.md yet) | Evaluate when trigger conditions fire (2+ tester install failures post-beta.30, OR `/gsd:new-milestone v1.14.0`). Pre-gate: 30-min Pinecone byte-compat sub-probe must pass before Phase 134 scaffolds plans. |

**Honest non-bundles:** SEED-005, SEED-006, SEED-007, SEED-008, SEED-012, SEED-013 are currently single-seed bundles. They are NOT forced into multi-seed bundles. If a future seed shares one of those themes, the bundle name is reserved; otherwise these stay solitary.

---

## Bidirectional seed <-> phase matrix

### Future phases -> seed coverage (orphan-phase view)

| Future phase | SEED source / motivator | Coverage status |
|---|---|---|
| Phase 100 jtbd-inference-engine (v1.14.0) | SEED-005 (intent-classifier upgrade is the natural home for the SEED-005 fix) | partial -- SEED-005 lands as a sub-fix inside 100; 100's broader scope is NOT seeded |
| Phase 112 graphrag-retrieval-room-budding (TBD) | SEED-001 (Room Budding logic touches the same multi-room registry SEED-001 governs) | partial -- SEED-001 lands as the wiring contract; 112's GraphRAG retrieval algorithms are NOT seeded |
| Phase 113 wasm-everywhere-spike (deferred) | SEED-002 (Phase 113 outcome affects whether agent-lightning runs lab-side vs per-user) | indirect -- 113 is upstream of SEED-002's trigger; not the implementing phase |
| Phase 121.5 terminal-coherence-capstone (v1.13.0 final) | SEED-007 (absorbed as Sub-plan F per ROADMAP line 1289) | full -- SEED-007 status flipped to `superseded` |
| Phase 127.2 Plan 01 (Brain warmup ping) | NONE | **ORPHAN PHASE** -- no seed motivated this; surfaced as immediate beta-cycle work post-Phase 127 stdio shim. Not retroactively seed-worthy. |
| Phase 128 substrate-contract-adr (v1.13.1) | NONE | **ORPHAN PHASE** -- emerged from 2026-05-16 Synthesis-Plan Absorption, not a seed. Architectural cleanup with no deferral history. |
| Phase 128.1 session-isolation (v1.13.1) | NONE | **ORPHAN PHASE** -- emerged from live concurrent-session bug, not a deferred reasoning artifact. |
| Phase 129 spine-repair-memory-event (v1.13.1) | SEED-008 (the residual "spine writes-but-doesn't-route-through-chokepoint" half of the activation-gap finding) | partial -- 129 covers the spine-routing residual; SEED-008's BRAIN.md derivation + post-compact + auto-explore halves landed in other phases |
| Phase 130 lens-engine-skeleton (v1.13.1) | NONE | **ORPHAN PHASE** -- emerged from 2026-05-16 Synthesis-Plan Absorption (dual-graph review). No prior seed; the seeding pattern was applied retroactively as SEED-009 (the DEFER half of the same verdict). |
| Phase 131 research-as-graph-aware-workflow (v1.13.1) | NONE | **ORPHAN PHASE** -- emerged from 2026-05-16 Synthesis-Plan Absorption. |
| Phase 132 dual-graph-correlation-hypergraph (v1.13.1) | NONE | **ORPHAN PHASE** -- emerged from 2026-05-17 dogfooding-curation session. Adjacent to SEED-010 (investigator skill consumes the same correlation_id substrate this phase ships). |
| Phase 134 cjs-port-of-python-analyzers (v1.14.0) | SEED-013 (the implementing phase; scaffolded CONTEXT.md, no PLAN.md) | full -- 134 is the named implementing phase if SEED-013 activates |

### SEEDs -> phase pairing (orphan-seed view)

| SEED | Status | Implementing phase (or candidate) | Orphan status |
|---|---|---|---|
| SEED-001 proactive-sub-room-suggestions | dormant | Phase 112 (Room Budding companion) -- candidate | NOT orphan -- has a candidate phase home |
| SEED-002 agent-lightning-lab-loop | dormant | TBD v1.14.0+ (post-corpus-threshold) | borderline orphan -- no named phase, but trigger is corpus-size-gated and explicit |
| SEED-003 claude-code-2-1-x-capability-adoption | dormant (partial-shipped) | Phase 114 (A1) + Phase 117-04 (A3) shipped; A2 + A4 + A5 unassigned | partial orphan -- A2/A4/A5 need phase home OR formal retirement at next curation pass |
| SEED-004 write-scope-check nested-room bug | scheduled-v1.14.0 | TBD v1.14.0 (small standalone phase; ship-before-SEED-001) | mildly orphan -- scheduled but no phase number reserved. Recommendation: reserve a phase slot at v1.14.0-beta.1 scoping. |
| SEED-005 strict-mode numeric-match false-positive | dormant | Phase 100 (intent-classifier upgrade, the natural home) | NOT orphan -- 100 is the named home, even if 100 itself is deferred to v1.14.0 |
| SEED-006 mindrian-wiki-sprint | scheduled-v1.14.0 | Phase 126 (the named implementing phase) | NOT orphan -- 126 is named |
| SEED-007 version-dynamic first-touch greeting | superseded | Phase 121.5 Sub-plan F (shipping v1.13.0 final) | NOT orphan -- absorbed |
| SEED-008 intelligence-layer activation gap | dormant (partially-shipped) | Phases 117 (shipped) + 95.5 + 129 -- distributed across multiple phases | NOT orphan -- the residual is the spine-routing piece in Phase 129 |
| SEED-009 learned-ranker-weights | dormant | TBD v1.14.0 (extension to shipped Phase 125) | borderline orphan -- no named phase, but explicit two-gate trigger (cohort + edge count) |
| SEED-010 neo4j-investigator-skill | dormant | TBD v1.13.2 | borderline orphan -- target milestone declared, no phase number reserved |
| SEED-011 brain-silent-identity | dormant | TBD v1.13.1 OR v1.14.0 (extends Phase 127's direction) | borderline orphan -- 3 architectural options scoped, no named phase |
| SEED-012 feynman-engine mom-test panel | dormant | TBD v1.13.1 (navigator-targeted) | borderline orphan -- design fully brainstormed; no phase number reserved |
| SEED-013 eliminate-python-from-user-machine | dormant+spiked | Phase 134 (CONTEXT.md scaffolded, no PLAN.md) | NOT orphan -- 134 is the named implementing phase |
| SEED-014 brain-mcp-separate-repo | dormant+spiked | TBD v1.14.0 (pre-gate: brain-boundary-scan PR-gate must land in monorepo first) | borderline orphan -- research artifact done, no phase number reserved |
| SEED-037 graph-derive-drain-heal-and-doctor-retrofit | scheduled-v1.14.0 (CRITICAL, NEXT-IN-LINE) | TBD v1.14.0-beta -- promote NEXT, ahead of remaining 166/165 feature work | NOT orphan -- navigator-directed as the critical next beta phase. Data-integrity defect: semantic-edge layer empty in ALL live rooms; the drain silently clears the retry signal on every SessionStart. RCA: .planning/debug/graph-derive-silent-clear-dead-api-derivation.md |

---

## Surfaced gaps

### Phases with NO seed coverage (architectural decisions that were never seeded)

1. **Phase 127.2 Plan 01 (Brain warmup ping)** -- emerged as immediate post-Phase-127 cycle work. Not retroactively worth seeding.
2. **Phase 128 substrate-contract-adr** -- emerged from the 2026-05-16 Synthesis-Plan Absorption session. ADR-class work that doesn't need a deferral seed.
3. **Phase 128.1 session-isolation** -- emerged from live concurrent-session bug. Bug-driven, not deferred-reasoning-driven.
4. **Phase 130 lens-engine-skeleton** -- emerged from 2026-05-16 dual-graph review. SEED-009 captures the DEFER half of the same verdict; the APPROVE half (Phase 130) was not separately seeded.
5. **Phase 131 research-as-graph-aware-workflow** -- emerged from 2026-05-16 Synthesis-Plan Absorption.
6. **Phase 132 dual-graph-correlation-hypergraph** -- emerged from 2026-05-17 dogfooding-curation session.

**Pattern observation:** the 2026-05-16 / 2026-05-17 synthesis sessions produced 4 phases (128, 130, 131, 132) without going through the seed-first discipline. This is fine when the work is architectural cleanup with no deferral history -- but the v1.13.1 EXECUTION-PLAN.md should arguably be backfilled with a `_synthesis-session_phases-128-130-131-132.md` provenance seed so the WHY survives the milestone cut.

### SEEDs with NO implementing phase (true orphans by strict definition)

After the curation pass: ZERO strict orphans. Every SEED has either:
- A named implementing phase (SEED-006 / SEED-013)
- An absorbing phase that shipped or is shipping (SEED-007 superseded; SEED-008 partially-distributed; SEED-003 partially-shipped)
- A candidate phase named in the related_phases array (SEED-001 / SEED-005)
- An explicit target_milestone and trigger gate (SEED-002 / SEED-004 / SEED-009 / SEED-010 / SEED-011 / SEED-012 / SEED-014)

The seven "borderline orphans" above need a phase number reserved at their target-milestone scoping conversation. Recommendation: when `/gsd:new-milestone v1.13.1` or `v1.14.0` opens, walk this matrix and assign phase numbers to the borderline orphans in the first scoping pass.

---

## Frontmatter normalization (migration applied 2026-05-24)

The canonical frontmatter shape (all 14 SEEDs now conform):

```yaml
---
id: SEED-NNN                       # required; SEED-NNN format
status: <canonical-status>         # required; from the closed status vocabulary above
planted: YYYY-MM-DD                # required; ISO date
planted_during: <string>           # required; human context
trigger_when: <string | block>     # required; what surfaces this seed
scope: <small | medium | large>    # required; closed vocabulary
bundle: <bundle-name | none>       # required; from bundles table or 'none'
canon_parts: [Part N, Part M]      # optional but recommended; array
related_phases: [N, M]             # required; array (use [] if none)
related_seeds: [SEED-NNN, ...]     # required; array (use [] if none)

# Optional fields:
implementing_phase: <string>       # name + status if a phase is the named implementer
target_milestone: vN.N.N           # if scheduled-vN.N.N
spike_artifact: <path>             # if dormant+spiked
research_artifact: <path>          # if dormant+spiked with a research doc
revised_cost: <string>             # if spike refined the cost estimate
key_findings: <block>              # if spike produced load-bearing findings
key_findings_from_spike: <block>   # synonym retained for SEED-013/014 compat
promotion_gate_after_spike: <block> # if spike refined the trigger gate
promotion_gate_after_research: <block> # synonym for SEED-014 pattern
pre_gate_required: <path>          # if a separate gate artifact must land first
companion_artifacts: [paths...]    # supporting documents
renamed_from: <string>             # if the SEED was renamed (provenance)
superseded_by: <string>            # if status is `superseded`
target_milestone: vN.N.N           # if scheduled to a specific milestone
ordering_constraint: <string>      # if must-ship-before-another-seed
arc_name: <string>                 # if part of a named arc
needs_author_touch: <string>       # flag for next curation pass if seed is ambiguous
---
```

### Per-SEED migration summary (applied)

| SEED | Pre-migration scope literal | Post-migration | Bundle assigned | Notes |
|---|---|---|---|---|
| SEED-001 | `medium` | `medium` | nested-room-correctness | + bundle, related_phases [112], related_seeds [SEED-004] |
| SEED-002 | `Large` | `large` | learning-loops | + bundle, related_seeds [SEED-009, SEED-011] |
| SEED-003 | `medium-large (5 distinct adoption candidates ...)` | `large` | capability-radar-adoption | + bundle, + implementing_phase (partial), + needs_author_touch flag (A2/A4/A5 still dormant) |
| SEED-004 | `Small` | `small` | nested-room-correctness | + bundle, + related_seeds [SEED-001, SEED-005] |
| SEED-005 | `Small` | `small` | heuristics-defer-to-explicit-signals | + bundle, + related_phases [100], + related_seeds [SEED-004] |
| SEED-006 | `Medium-Large` | `large` | visible-room-wiki | + bundle, scope literal normalized |
| SEED-007 | `Medium` (status: dormant) | `medium` (status: **superseded**) | first-touch-coherence | status changed from dormant to superseded; superseded_by + implementing_phase fields added per ROADMAP line 1289 |
| SEED-008 | `large` | `large` | intelligence-layer-activation | + bundle, + needs_author_touch flag (partially-shipped) |
| SEED-009 | `Medium-Large` | `large` | learning-loops | + bundle, scope literal normalized, related_seeds [SEED-002] |
| SEED-010 | `medium` | `medium` | brain-wire-architecture | + bundle, + target_milestone v1.13.2 |
| SEED-011 (was SEED-003) | `Medium-to-Large` | `large` | brain-wire-architecture | RENAMED from SEED-003; scope literal normalized; + bundle |
| SEED-012 | `Medium` | `medium` | feynman-storytelling | + bundle, + target_milestone v1.13.1 |
| SEED-013 | `large` | `large` | cross-platform-fragility-cleanup | + bundle; preserved all spike-derived fields (revised_cost, key_findings_from_spike, promotion_gate_after_spike, pre_gate_required) |
| SEED-014 | `large` | `large` | brain-wire-architecture | + bundle; preserved all research-derived fields (revised_cost, key_findings_from_research, promotion_gate_after_research, pre_gate_required) |

**Flagged needs-author-touch items (do not auto-resolve in the next curation pass; ask the author):**

- **SEED-003**: A1 + A3 shipped. Should this promote to `dormant+partial` status (new vocabulary entry) OR split into 5 per-candidate child seeds (A1/A2/A3/A4/A5) so the un-shipped ones are individually trackable? Curator's recommendation: split if any of A2/A4/A5 are still live at v1.14.0 cut.
- **SEED-008**: Most halves shipped (Phase 117 auto-explore, partial 95.5, Phase 129 spine routing). Residual scope is genuinely unclear -- is the "Larry acts on it" mid-session-injection loop FULLY covered by Phase 129, or does it need its own micro-phase? Curator's recommendation: re-evaluate at v1.13.0 final release-gate audit.

---

## Operations runbook

### To add a new SEED

1. Allocate the next free SEED-NNN id (currently 015 is next).
2. Create `SEED-NNN-<slug>.md` in this directory with the canonical frontmatter shape.
3. Required fields: `id`, `status`, `planted`, `planted_during`, `trigger_when`, `scope`, `bundle` (or `none`), `related_phases`, `related_seeds`.
4. If the seed is born with a research spike or sub-probe, set `status: dormant+spiked` and populate `spike_artifact` / `research_artifact` / `revised_cost` / `key_findings` / `promotion_gate_after_spike`.
5. Add a row to this INDEX's bundle table (if a new bundle) OR to an existing bundle's SEED list.
6. Add a row to the bidirectional matrix above.
7. If the seed has downstream references (a phase + a CHANGELOG entry + a script comment + ...), grep for the slug before committing so the cross-reference set is captured.

### To activate a dormant SEED

1. Confirm the trigger condition has actually fired (do not promote on a hunch; the seed was deferred for a reason).
2. Pick the implementing phase number. If it does not exist yet, reserve it in `/gsd:new-milestone` scoping OR create a Phase NNN scaffold with `/gsd:plan-phase NNN`.
3. Update the SEED's frontmatter: `status: scheduled-vN.N.N` + `implementing_phase: <phase-number>` + `target_milestone: vN.N.N`.
4. Update this INDEX's bidirectional matrix to reflect the named phase.
5. When the phase ships, update the SEED's `status: shipped` and add the implementing phase to the CHANGELOG entry for the release.

### To sync with a new phase

1. After `/gsd:plan-phase NNN` lands, grep this INDEX for any SEED that names that phase as `implementing_phase` OR in `related_phases`.
2. If the phase fully absorbs a SEED, update the SEED's status to `superseded` and add `superseded_by: <phase-name>`.
3. If the phase partially absorbs a SEED, update the SEED's `needs_author_touch` field with the residual-scope description so the next curation pass has a starting point.
4. Update this INDEX's bidirectional matrix.

### To run a curation pass

1. Read every SEED's frontmatter + first 30 lines.
2. Check that `status` matches reality (any dormant seed whose target phase shipped should be `superseded` or `shipped`).
3. Check the bidirectional matrix for new orphan phases (phases shipped or planned that have no seed coverage) -- these are NOT bugs, just observations.
4. Check the bidirectional matrix for new orphan seeds (seeds whose target phases were renumbered or absorbed elsewhere).
5. Update this INDEX. Bump `last_curated` and `curated_during` in the frontmatter.

### To resolve an id collision

(History: this happened once on 2026-05-19 when two seeds were independently filed as SEED-003.)

1. Apply the chronological + downstream-weight rule: the seed planted first AND with more downstream references keeps the id.
2. Rename the loser to the next free slot using `mv` (`.planning/` is gitignored, so plain mv -- no `git mv`).
3. Update the renamed file's frontmatter `id:` field.
4. Add a `renamed_from:` field to the renamed seed's frontmatter carrying the rationale.
5. Add a banner to the renamed seed's body H1 noting the rename for searchability.
6. Grep the entire codebase for the old slug; update each reference to point at the new id.
7. Document the collision + resolution in this INDEX's "Collision resolution" section.

---

_End of SEEDs INDEX. Source-of-truth for individual SEED reasoning lives in each `SEED-NNN-*.md` file._

## SEED-018 -- rs-engine corpus-quality degenerate output on hybrid multi-user topic

- **Planted:** 2026-05-28
- **Status:** dormant
- **Trigger:** any phase/debug touching rs-engine.py, rs_corpus, rs_hybrid, or /mos:rs-* output quality; tester report of degenerate output; v1.14.0 milestone scoping Phase 89 expansion
- **Scope:** medium (~4-5 plans)
- **Bundle:** rs-engine-corpus-quality
- **Top hypothesis:** room corpus loader includes .heal-backup/.private/.intelligence noise folders, inflating count to 706 + polluting matches
- **Companion artefacts:** ~/MindrianRooms/mindrianOS/.rs-engine-results-multi-user.json (the degenerate output); 2026-05-28 cross-tester GTM findings memo; Lawrence-facing Vercel deck
- **Witness:** Lawrence Aronhime (notified via Gmail draft)
- **Filed by:** Larry (autonomous, 2026-05-28 post-tester-calls session)

---

## Consolidation + Version Roadmap (2026-06-02)

**This section is the current live consolidation. It supersedes the bundle/matrix tables above wherever they disagree** (those were curated 2026-05-24 and stop at SEED-014 + the SEED-018 hand-append). Seed count is now **20** (001-020); the "14 SEEDs" preamble (line 45) and "015 is next" runbook note (line 226) are stale -- **the next free id is 021.** Individual SEED-NNN-*.md frontmatter remains source-of-truth.

### Newly-registered since the last curation pass (were missing from the matrix)

| SEED | Bundle | Scope | Status | One-line |
|---|---|---|---|---|
| SEED-015 selective-install-profile-system | install-surface-architecture | large | dormant | Opt-in install profiles (Pro maps to a profile) |
| SEED-016 mindrian-agentshield-security-scanner | security-infrastructure-expansion | large | dormant | Plugin-wide security scanner skin (generalizes the brain-boundary-scan) |
| SEED-017 hosted-pro-tier-stripe-billing | distribution-and-commercialization | large | dormant | Hosted Pro tier + Stripe; gates behind SEED-006 + SEED-015 |
| SEED-018 rs-engine-corpus-quality | rs-engine-corpus-quality | medium | dormant | Degenerate rs-engine output on hybrid multi-user topic (tester-facing bug) |
| SEED-019 part8-boundary-as-runtime-slm-guardrail | part8-runtime-enforcement | medium | dormant | Runtime SLM classifier on the Brain egress chokepoint |
| SEED-020 regulation-layer-larry-as-connector | regulation-layer | large | dormant | Cost/freshness/metacognition regulators surfaced through Larry (Feyminto voice) |
| SEED-021 f7-max-keyboard-dial-atomic-render-coupling | selector-ui | medium | active (navigator-decided 2026-06-09) | Atomic text/card render coupling (Phase 144 gate) + F.7-max: De Stijl previews, multiSelect modifier checkboxes, confidence bars, tier-0 honest cold card |
| SEED-022 icm-fractal-memory-contract | fractal-memory | large | dormant | Identity-begets-memory depth-3 recursion + umbilical v2 inheritance + born-wired HITL birth gate (SEED-004 precondition) + DRIFT.md 7th memory kind. Approved 2026-06-11; composes with SEED-001/Phase 136/Phase 112 |
| SEED-023 meeting-micro-knowledge-dikw-filing-engine | meeting-intelligence | large | partially-promoted (v1 slice -> Phase 150.8, 2026-06-11) | Typed micro-knowledge (knowledge_type x6 + conditions), Claimify 4-pass extraction, ACTA reanalyze probes, insight node layer, causal edge taxonomy amendment (REFINES/ROOT_CAUSES -- Canon Part 4 gate), Ackoff DIKW transcript-to-wisdom trigger. Verbatim research at research/2026-06-11-meeting-micro-knowledge-dikw-proposal.md |

### Housekeeping (re-status now, zero cost)

- **SEED-007** -- `superseded` by the shipped Phase 121.5 Sub-plan F. Treat as closed-by-implementation.
- **SEED-003** -- partial-shipped (A1/A3 landed). Flip to `superseded-by: Phase 138` (capability-radar-absorption-and-routing) when 138 ships; A2/A4/A5 carry forward into 138's living ledger.
- **SEED-008** -- re-status `dormant+partial`; residual is the spine-routing piece in Phase 129. Confirm full coverage at the v1.13.0 final gate.

### Version buckets (relevancy x urgency)

| Bucket | Seeds (urgency-ranked) | Notes |
|---|---|---|
| **v1.13.1** (in flight; finish-line only) | SEED-012 (feynman mom-test, navigator-targeted), SEED-008 residual | No NEW scope into the frozen residual chain (128/129/130/131/132/121.5). |
| **v1.13.2** (gated on Brain schema stable) | SEED-010 (neo4j investigator) | Hold until Phase 127 + Capability Map stop moving. |
| **v1.14.0** (major next) | **BUGS first:** SEED-004, SEED-005, SEED-018 -> reserve phase numbers first. **Core:** SEED-020, SEED-006. **Feature:** SEED-003->138, SEED-009, SEED-002. **Arch:** SEED-011, SEED-001, SEED-022 (fractal memory contract -- composes with 001/004), SEED-023 (meeting micro-knowledge DIKW engine -- GATE-0 precondition runs in Phase 150.6). | SEED-004 ships BEFORE SEED-001 AND SEED-022 (it is SEED-022's named precondition). The three highest-urgency items are defects, not features. |
| **v1.15.0+** (arch cleanup + commercialization) | SEED-013 (python elim / Phase 134), SEED-014 (brain repo split), SEED-015 (install profiles), SEED-016 (agentshield), SEED-017 (Pro tier) | SEED-017 = highest business relevancy, latest sequencing (gates behind 006 + 015). |
| **Trigger-gated** (event, not date) | SEED-019 (Part 8 PR-gate / Phase 110 wire enforcement), SEED-001 (room-proactive expansion / Phase 112), SEED-002 + SEED-009 (corpus thresholds) | Fire on the event; do not force into a milestone date. |

### Consolidation findings (act on these)

1. **Data-driven cluster:** SEED-002 + SEED-009 + SEED-020 all feed on the same Phase 121 telemetry + Phase 125 outcome-edge substrate. When any one's data gate clears, evaluate all three together (extend the `learning-loops` bundle to include `regulation-layer`).
2. **Security cluster:** SEED-019 (Part 8 runtime SLM guardrail) + SEED-016 (AgentShield) share the boundary-enforcement theme; co-evaluate when the Part 8 PR-gate opens.
3. **Commercialization chain:** SEED-017 (Pro tier) depends on SEED-006 (visible-room-wiki, the user-facing surface) + SEED-015 (install profiles, the tier mechanism). Sequence 006 -> 015 -> 017.
4. **Version conflict to resolve:** SEED-013 frontmatter implies v1.15.0 but its implementing Phase 134 is named v1.14.0. Reconcile at v1.14.0 scoping.
5. **The three v1.14.0 bugs (004/005/018) have no reserved phase numbers** -- assign them in the first v1.14.0 scoping pass before any feature seed.

### Gate before SEED-020 becomes a phase

SEED-020's metacognition regulator carries a load-bearing pre-condition (constraint 1, reflective-not-prescriptive): we must DESIGN AND RUN an experiment showing the reflective mirror BUILDS self-monitoring rather than replacing it. If that is unprovable, the metacognition regulator does not ship -- the cost and freshness regulators can proceed independently. This experiment is the entry criterion, not a version-bucket item.

_Consolidation by Larry, 2026-06-02. Next curation pass should fold this section's re-statuses back into the bundle/matrix tables above and bump `last_curated`._
