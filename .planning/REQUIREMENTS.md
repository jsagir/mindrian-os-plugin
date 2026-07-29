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

- [ ] **GRAPHDB-01**: `rebuildGraph` cannot erase `memory_event` rows, confirmed truth-claims, decisions, or opportunity `stage_history`; the delete-then-reindex is wrapped in one transaction so a crash or concurrent reader never sees a partial/empty state (N-1, including the SQLite transaction/WAL-visibility implications the user asked to be explicit about).
- [x] **GRAPHDB-02**: A busy or mid-migration room.db open reports its real state (busy/broken) instead of collapsing into "no room db" / cold start (N-3). Closed by 236-03: `RoomDbBusyError` / `RoomDbBrokenError` thrown from a classified `openRoomDb`, keyed on the SQLite `errcode` observed on this runtime. Scoped to the READ-WRITE door; the read-only door (236-RESEARCH.md Pitfall 6) is a recorded, dated known gap.
- [ ] **GRAPHDB-03** (log only, no phase-blocking fix required): the `timeout:5000` write-safety option's real version floor is documented and `package.json` engines reflects it (N-2).

### Phase 237 -- Reach mechanism (depends on 235: CIRS is the posture-index source)

- [x] **REACH-01**: Approving a Decision Gate for a chain step causes that step's actual resolved command to run, not only a log line (R-1); the decorative per-step `decide()` call is removed in the same change (R-3 folds in).
- [x] **REACH-02**: `framework_run` and `chain_run` agree on which commands are material vs autonomous_safe, one authority, not two (R-2).
- [x] **REACH-03**: A candidate reach reflects the current session's own turn signals, not another concurrent session's stale marker (R-4).

### Phase 238 -- Decision Gates (depends on 235: shared seam-liveness helper)

- [ ] **GATE-01**: Answering a chain's halt gate resolves through the same ledger that minted it (G-1); `gate_answer` validates `chosen` against the card's actual options before ratifying (G-2).
- [ ] **GATE-03**: Gate minting and consumption are session-scoped; the retry-counter file write is atomic (no torn writes) (G-3).
- [ ] **GATE-04**: `check-card-fire.cjs`'s backstop pattern stops matching ordinary citation/footnote markers in prose (G-4), informed by this session's own logged over-fire instances.

### Phase 239 -- Brain-access surface

- [ ] **BRAIN-01**: The Part-8 egress guard and PII sanitizer hooks actually match the live Brain tool names (B-1).
- [ ] **BRAIN-02**: User-typed content (opportunity fields, Blue Hat notes) cannot reach a Brain query uninspected; the egress guard covers `query()`, not only the unused `sendPacket` door (B-3).
- [ ] **BRAIN-03** (decision, not a bug fix): `sendPacket`'s fate is decided explicitly, wire it to real jobs or park it with a dated note (B-2).

### Phase 240 -- Memory (depends on 236 landing first)

- [ ] **MEM-01**: Layer 2 (across-session) JTBD promotion fires for real, continuous work, not only on topic changes; the manual-override path persists the fields its own gate checks (M-1).
- [ ] **MEM-02**: `graph-edge-pending.log` entries get consumed (routed into `memory_event` rows via the Phase 150 memory cortex) instead of accumulating forever (M-2, debug session in progress this turn).
- [ ] **MEM-03**: The JTBD test suite cannot write into the user's live memory store (M-3).

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
| GRAPHDB-01 | Phase 236 | Pending |
| GRAPHDB-02 | Phase 236 | Complete |
| GRAPHDB-03 | Phase 236 | Pending (log-only) |
| REACH-01 | Phase 237 | Complete |
| REACH-02 | Phase 237 | Complete |
| REACH-03 | Phase 237 | Complete |
| GATE-01 | Phase 238 | Pending |
| GATE-03 | Phase 238 | Pending |
| GATE-04 | Phase 238 | Pending |
| BRAIN-01 | Phase 239 | Pending |
| BRAIN-02 | Phase 239 | Pending |
| BRAIN-03 | Phase 239 | Pending (decision) |
| MEM-01 | Phase 240 | Pending |
| MEM-02 | Phase 240 | Pending |
| MEM-03 | Phase 240 | Pending |
| MINTO-01 | Phase 241 | Complete (241-01) |
| MINTO-02 | Phase 241 | Complete (241-04) |
| MOAT-01 | Phase 242 | Complete (242-01) |
| MOAT-02 | Phase 242 | Complete (242-02) |
| GLYPH-01 | Phase 243 | Complete |

**Dependency notes (binding for scheduling):**

- Phase 235 first: precondition for 237 and 238 (posture-index source + shared seam-liveness helper); 239 soft-reuses the helper.
- Phase 236 parallel to 235 (urgent).
- Phase 240 STRICTLY after 236: promotions route into memory-cortex tables that `rebuildGraph` currently truncates. Never schedule 240 parallel-independent of 236, even if the wave tooling would allow it.
- Phases 241, 242, 243: no hard dependencies (242 soft-reuses 236's transaction/crash-injection proof pattern).
