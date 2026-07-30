# Milestone v1.16.0 "Infrastructure Remediation" Requirements

Source: the 2026-07-28 nine-piece MindrianOS-Plugin infrastructure audit (24-agent scrutinize/red-team/rethink workflow, consolidated at `/tmp/claude-1000/-home-jsagi/c4225fce-73ca-43dc-90bc-1665bbeb7983/infra-scrutiny-consolidated.md`, published at https://claude.ai/code/artifact/a5cf197d-4dee-465c-b2f1-0f8bc67c7e4e). 35 findings, 21 marked HIGH (verified bug, own-RCA recommended). Sequenced by dependency per the audit's own cross-piece synthesis, not as 35 flat tickets.

## Cross-Cutting Research Consultation (binds every phase below)

- **langtalks-graph-expert (MANDATORY, per CLAUDE.md's standing rule):** every phase touching agent/LLM engineering concepts (dispatch, memory, RAG, reasoning, guardrails, MCP protocol) consults `mcp__langtalks-graph-expert__*` during planning and research, not training-data assumptions alone. Applies directly to phases 235 (CIRS/seam-liveness), 237 (reach), 238 (gates), 241 (Feynman-MINTO).
- **Claude Code / Claude API expertise:** phases touching hooks (`hooks/hooks.json`, `PreToolUse`/`PostToolUse`/`Stop` matchers), MCP tool registration, or subagent/agent-registry behavior consult the `claude-api` skill and, for direct product-behavior questions, the `claude-code-guide` agent, before changing matcher patterns or registry logic. Applies directly to phases 235 (CIRS), 237 (reach mechanism's chain_run/decide seam), 238 (Decision Gates), 239 (Brain-access hook matchers).
- **SQL / SQLite expertise:** phases touching `room.db` (`lib/core/room-db.cjs`, `lib/core/navigation/*`, any raw SQL) consult Context7 docs for `node:sqlite` (`DatabaseSync`, transaction semantics, WAL mode visibility, the `timeout` option's actual version floor) before writing or reviewing any transaction-wrapping fix. Applies directly to phase 236 (room.db data-loss) and phase 240 (memory, once it lands in the memory-cortex SQL tables) and phase 242 (the Moat's HSI-to-graph SQL writes).

## v1.16.0 Requirements

### Phase 235 -- CIRS leverage fix (do first, precondition for 237/238)

- [x] **CIRS-01**: The commit-time born-wired gate actually runs on every commit, in every worktree sharing this machine's hooks dir, not overwritten by a rival installer (C-1).
- [x] **CIRS-02**: A reusable seam-liveness assertion helper exists (hook matcher matches a live tool name, an enqueue has a registered consumer, a mint is consumable by its ratifier) and CIRS's own `--check` uses it for its surfaces (C-2, refined per this session's systems-thinking stress test to be a repo-wide helper, not CIRS-only).
- [x] **CIRS-03**: `scripts/release.sh`'s `--strict` flag on `check-shape-declaration.cjs` actually changes exit behavior instead of being swallowed by `|| true` (C-3, folds into CIRS-01).

### Phase 236 -- room.db data-loss (urgent, parallel to 235)

- [x] **GRAPHDB-01**: `rebuildGraph` cannot erase `memory_event` rows, confirmed truth-claims, decisions, or opportunity `stage_history`; the delete-then-reindex is wrapped in one transaction so a crash or concurrent reader never sees a partial/empty state (N-1, including the SQLite transaction/WAL-visibility implications the user asked to be explicit about). Closed across 236-01 and 236-02. 236-01 fixed the actual defect, which was DELETE SCOPE and not atomicity: an exported ownership allowlist (`INDEXER_OWNED_NODE_TYPES` = Artifact/Section, `INDEXER_OWNED_EDGE_TYPES` = BELONGS_TO) drives one scoped wipe shared by both destructive reindex sites, the second of which (`scripts/build-ecosystem-graph.cjs`) was found mid-flight. 236-02 then PINNED the transaction and WAL halves, which the repo already got right but had never asserted: the default `runDeriveBackfill` path (the one a caller reaches without knowing to opt out), a crash injected mid-rebuild leaving the room byte-equivalent with node and edge counts EXACTLY equal on reopen, and an out-of-process reader that took 4480 samples during a live rebuild on v22.23.1 and saw exactly 2 distinct snapshots, never an empty or partial one. All 7 mutations across the two plans demonstrated in both directions.
- [x] **GRAPHDB-02**: A busy or mid-migration room.db open reports its real state (busy/broken) instead of collapsing into "no room db" / cold start (N-3). Closed by 236-03: `RoomDbBusyError` / `RoomDbBrokenError` thrown from a classified `openRoomDb`, keyed on the SQLite `errcode` observed on this runtime. Scoped to the READ-WRITE door; the read-only door (236-RESEARCH.md Pitfall 6) is a recorded, dated known gap.
- [x] **GRAPHDB-03** (log only, no phase-blocking fix required): the `timeout:5000` write-safety option's real version floor is documented and `package.json` engines reflects it (N-2). Closed by 236-04: floor is **>=22.16.0**, the version where the `timeout` constructor option was added, NOT the lower >=22.13.0 where `node:sqlite` merely stopped needing `--experimental-sqlite`. On 22.13-22.15 the module loads and `timeout` is silently dropped, so the Phase 218-02 write-safety fix ships and does nothing. Source: Context7 against the Node.js v22.x API docs (`timeout` option version-history entry), confirmed live by a `PRAGMA busy_timeout` readback. Lockstep sweep of ten stated floors, every one with a written disposition; pinned by `tests/test-236-engines-floor.cjs` (4 scenarios, all mutation-proven). Two related surfaces (`scripts/session-start`, `scripts/sync-rooms-graph`) state the LOWER availability floor and are raised as a separate follow-up in `deferred-items.md`, because their correct value is 22.13.0 and not 22.16.0.

### Phase 237 -- Reach mechanism (depends on 235: CIRS is the posture-index source)

- [x] **REACH-01**: Approving a Decision Gate for a chain step causes that step's actual resolved command to run, not only a log line (R-1); the decorative per-step `decide()` call is removed in the same change (R-3 folds in).
- [x] **REACH-02**: `framework_run` and `chain_run` agree on which commands are material vs autonomous_safe, one authority, not two (R-2).
- [x] **REACH-03**: A candidate reach reflects the current session's own turn signals, not another concurrent session's stale marker (R-4).

### Phase 238 -- Decision Gates (depends on 235: shared seam-liveness helper)

- [x] **GATE-01**: Answering a chain's halt gate resolves through the same ledger that minted it (G-1); `gate_answer` validates `chosen` against the card's actual options before ratifying (G-2).
- [x] **GATE-03**: Gate minting and consumption are session-scoped; the retry-counter file write is atomic (no torn writes) (G-3).
- [x] **GATE-04**: `check-card-fire.cjs`'s backstop pattern stops matching ordinary citation/footnote markers in prose (G-4), informed by this session's own logged over-fire instances.

### Phase 239 -- Brain-access surface

- [x] **BRAIN-01**: The Part-8 egress guard and PII sanitizer hooks actually match the live Brain tool names (B-1). (Phase 239, gsd-verifier PASSED 2026-07-30)
- [x] **BRAIN-02**: User-typed content (opportunity fields, Blue Hat notes) cannot reach a Brain query uninspected; the egress guard covers `query()`, not only the unused `sendPacket` door (B-3). (Phase 239, gsd-verifier PASSED 2026-07-30)
- [x] **BRAIN-03** (decision, not a bug fix): `sendPacket`'s fate is decided explicitly, wire it to real jobs or park it with a dated note (B-2). (Phase 239: PARKED, see docs/architecture/SUBSTRATE-CONTRACT.md 2026-07-30 amendment)

### Phase 240 -- Memory (depends on 236 landing first)

- [x] **MEM-01**: Layer 2 (across-session) JTBD promotion fires for real, continuous work, not only on topic changes; the manual-override path persists the fields its own gate checks (M-1).
- [x] **MEM-02**: `graph-edge-pending.log`-shaped promote/park/complete events are consumed into `memory_event` rows via the Phase 150 memory cortex (M-2). REVISED 2026-07-30: the fix pre-dates this phase (commit `3c9afa2e`, `logGraphTransition` wired at all three lifecycle sites, `graph-edge-pending.log`/`writeGraphEdge` deleted entirely per the resolved RCA's Option B). Phase 240 Plan 05 closed the gap that was actually missing: the join test proving a promote survives a real `rebuildGraph` (riding Phase 236's transaction wrap), with both a correct-direction mutation (widening `INDEXER_OWNED_NODE_TYPES` reddens it) and a wrong-direction mutation (removing the BEGIN/COMMIT wrap does NOT redden it, a documented finding, not a gap) executed live.
- [x] **MEM-03**: The JTBD test suite cannot write into the user's live memory store (M-3). (Phase 240 Plan 02: owned mktemp root for tests/test-jtbd-auto-anchor-empirical.sh, pre-emptive sandbox in tests/test-jtbd-hook-integration.cjs, 5-leg recursive `.memory`/`.rooms` hash fence at tests/test-240-memory-store-hermetic-fence.sh.)

### Phase 240.1 -- Context-Layer Drift Detection (inserted 2026-07-30, urgent, informed by MotherDuck Guides research)

Source: a live, reproduced STATE.md self-contradiction this session (`stopped_at` referencing Phase 236 while `Current Position` said Phase 240 executing) from concurrent-session writes, plus MotherDuck's 2026-07-29 blog post "Context belongs in the warehouse" and the Bev Turnbaugh SF meetup talk (hosted by Uncork Capital).

- [x] **CTXL-01**: STATE.md's compute-state artifact carries a schema version stamp; a regeneration detecting a version mismatch surfaces a notification instead of silently overwriting. REVISED scope (240.1-RESEARCH.md, navigator-confirmed): targets the PER-ROOM STATE.md `scripts/compute-state` regenerates, not `.planning/STATE.md` (external gsd-core, already root-caused elsewhere as no in-repo fix available). `lib/core/state-version.cjs` wired into all 5 in-repo write sites; independently mutation-proven by `gsd-verifier`.
- [x] **CTXL-02**: room.db's graph schema and BRAIN.md each carry an explicit, documented SEMANTIC-layer (schema/structure) vs. CONTEXT-layer (business-term/institutional-knowledge) distinction, not an implicit conflation. `docs/MWP-SPECIFICATION.md` section 2.8 and `docs/BRAIN-MD-SCHEMA.md` section 5.1, pinned to `INDEXER_OWNED_NODE_TYPES` as the operational boundary; heading-anchored doctrine-presence gate mutation-proven, not vacuous on the bare words.
- [x] **CTXL-03**: A benchmark gate measures whether room context measurably improves Larry's answer accuracy on a fixed local task set, mirroring MotherDuck's DABStep methodology at MindrianOS's own scale. `scripts/ctxl-eval.cjs`, third instance of the `huji-eval.cjs`/`skillopt-eval.cjs` two-layer idiom; live-verified 12/12 selftest, 4 PASS + 2 correctly-skipped suite run, zero-spend `CTXL_EVAL_LIVE`-gated A/B leg.

### Phase 244 -- Semantic Trigger Tier (added 2026-07-30, post-milestone-close finding)

Source: live investigation this session into a real navigator-reported symptom ("natural language doesn't trigger the right skill"), root-caused to `lib/core/sensors/sensor-types.cjs`'s Phase 172-07 trigger-tier doctrine (Canon Part 11 R3), which has no content-relevance tier -- only `signal`/`context` (structural) and `keyword` (lexicon fallback), and `trigger_tier` itself is consumed by zero rankers today. Grounded via a langtalks-graph-expert corpus sweep, Tavily research (RRF, MMR, GraphRAG local/global search), and 244-RESEARCH.md's own live codebase investigation, which found the FTS5+bm25 lexical leg and RRF fusion ALREADY SHIP in production (`lib/core/eureka/tri-modal-index.cjs`, `hybrid-retrieve.cjs`, Phase 211-02/219-02) -- the gap is wiring, not invention. See `.planning/phases/244-semantic-trigger-tier/244-RESEARCH.md` for the full trail, including a corrected factual error in this phase's original stack-constraint rationale (Finding F-10).

- [x] **TRIG-01**: A new sensor mints a candidate reach by querying the already-shipped `tri-modal-index.lexicalSearch` (FTS5 + `bm25()`, no new index, no embedding call, no new dependency) over room.db's curated `nodes` (never raw `fragments`). Includes wiring the index's missing production lifecycle (it exists in no live room today). (Closed 2026-07-30, Phases 244-01/02/03/05/06: `TRIGGER_TIERS` grown to 4 + `isFallbackTier`, `lib/core/eureka/fts-index-lifecycle.cjs` lazy build-on-first-miss, the ghost-trigger reconcile inside `rebuildGraph`'s transaction, `SENS-16` `sensor-content-relevance.cjs`, and the `eureka-fts-index-visible` doctor visibility point.)
- [x] **TRIG-02**: `f-selector-ranker.cjs` fuses candidate scores across trigger-tier families via an optional `o.tierCandidates` argument (the `sens10`/`role_level` optional-signal idiom) calling the already-shipped `rrfFuse`, before the `MAX_K=3` cut. (Closed 2026-07-30, Phase 244-04: the optional `o.tierCandidates` seam + `_applyTierFusion` + `TRIG_RRF_K`, with `orchestration-candidate-lift.cjs::buildTierCandidates` as the live production supplier.)
- [x] **TRIG-03**: The top-K cut applies an MMR-shaped diversity term (reusing the already-shipped `lexicalOverlap` Jaccard primitive, `lexical-overlap.cjs:75`) so same-family candidates cannot crowd out a genuine cross-family hit, following the `_applySens10Flip`/`_applyRoleLevelBias` layered-adjustment-pass pattern already in production. (Closed 2026-07-30, Phase 244-07: `_applyMmrDiversity` + `MMR_LAMBDA_RELEVANCE` (canonical Carbonell orientation) + `TRIG_MMR_LAMBDA`.)

### Phase 241 -- Feynman-MINTO (F-0 already filed and open)

- [x] **MINTO-01**: The guardian's on-stop output reaches the user instead of `/dev/null`, and its report-write/ghost-pruning cannot be silently dropped by a 1-second timeout (F-1). (Closed 2026-07-28, Phase 241 Plan 01: `runOnStop` soft walk deadline + `scripts/on-stop` capture-and-fold, both legs mutation-proven.)
- [x] **MINTO-02**: The critical-repair severity ladder actually triggers on the breaches navigators hit (missing MINTO.md, missing governing_thought), not only two rare crash artifacts (F-2); pre-commit friction from the same dead loop is demoted to warn until the loop is live (F-3 folds in). (Closed 2026-07-28. F-2 half, Phase 241 Plan 03: both severity constants raised to critical, both breaches mutation-proven to reach the enqueue gate and land a real `.mindrian/minto-queue.json` entry. F-3 half, Phase 241 Plan 04: `runPreCommit` demoted to advisory WARN with a `--strict`/`MINTO_PRECOMMIT_STRICT` opt-in, proven by a real `git commit` in both directions, mutation-proven.)

### Phase 242 -- The Moat

- [x] **MOAT-01**: The HSI-to-graph edge rewrite is transaction-wrapped so a crash or concurrent reader never sees a zeroed scoring layer (MW-1, includes MW-2 and MW-3 as the same root cause).
- [x] **MOAT-02** (doc fix, no RCA): the PR checklist's KuzuDB warning sign is replaced with a real, machine-checked assertion (MW-4).

### Phase 243 -- Voice-glyph

- [x] **GLYPH-01**: The statusline's "who is speaking" signal reflects the actual glyph a turn opened with, not a fabricated default painted over by the stance color (V-1); V-2/V-3 route into the existing open `voice-signature-dark-runtime.md` RCA rather than a new one.

## Out of Scope

- Any new user-facing feature work. This milestone is remediation only.
- Full historical reconciliation of PROJECT.md/STATE.md drift noted during this milestone's setup (tracked as an instance of finding C-4, not its own phase).
- MW-4 style doctrine-rot findings get a light doc fix, not a full RCA-and-fix cycle, per the audit's own rethink verdict.

## Traceability

Filled by the roadmapper 2026-07-28. 23/23 v1.16.0 requirements mapped to exactly one phase each; no orphans, no duplicates. (GATE-02 does not exist as a REQ-ID: audit finding G-2 is folded into GATE-01 by design.) Phase detail: `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CIRS-01 | Phase 235 | Complete |
| CIRS-02 | Phase 235 | Complete |
| CIRS-03 | Phase 235 | Complete |
| GRAPHDB-01 | Phase 236 | Complete |
| GRAPHDB-02 | Phase 236 | Complete |
| GRAPHDB-03 | Phase 236 | Complete (log-only) |
| REACH-01 | Phase 237 | Complete |
| REACH-02 | Phase 237 | Complete |
| REACH-03 | Phase 237 | Complete |
| GATE-01 | Phase 238 | Complete |
| GATE-03 | Phase 238 | Complete |
| GATE-04 | Phase 238 | Complete |
| BRAIN-01 | Phase 239 | Complete |
| BRAIN-02 | Phase 239 | Complete |
| BRAIN-03 | Phase 239 | Complete (parked) |
| MEM-01 | Phase 240 | Complete |
| MEM-02 | Phase 240 | Complete (240-05) |
| MEM-03 | Phase 240 | Complete (240-02) |
| MINTO-01 | Phase 241 | Complete (241-01) |
| MINTO-02 | Phase 241 | Complete (241-04) |
| MOAT-01 | Phase 242 | Complete (242-01) |
| MOAT-02 | Phase 242 | Complete (242-02) |
| GLYPH-01 | Phase 243 | Complete |
| CTXL-01 | Phase 240.1 | Complete |
| CTXL-02 | Phase 240.1 | Complete |
| CTXL-03 | Phase 240.1 | Complete |
| TRIG-01 | Phase 244 | Complete (244-01/02/03/05/06) |
| TRIG-02 | Phase 244 | Complete (244-04) |
| TRIG-03 | Phase 244 | Complete (244-07) |

**Dependency notes (binding for scheduling):**

- Phase 235 first: precondition for 237 and 238 (posture-index source + shared seam-liveness helper); 239 soft-reuses the helper.
- Phase 236 parallel to 235 (urgent).
- Phase 240 STRICTLY after 236: promotions route into memory-cortex tables that `rebuildGraph` currently truncates. Never schedule 240 parallel-independent of 236, even if the wave tooling would allow it.
- Phases 241, 242, 243: no hard dependencies (242 soft-reuses 236's transaction/crash-injection proof pattern).
