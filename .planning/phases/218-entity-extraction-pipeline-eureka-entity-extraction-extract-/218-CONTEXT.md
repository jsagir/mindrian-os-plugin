# Phase 218: Eureka Entity Extraction - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract named domain entities (company/technology/market) and typed relationship edges (COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO) from room-artifact markdown prose into room.db, through the existing `lib/core/navigation.cjs` chokepoint, using ONLY tier-1 (regex/heading/capitalization) extraction. This closes the root-cause gap behind the shipped Eureka engine (Phases 211-216) reasoning over structural scaffold nodes instead of real domain content.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `218-SPEC.md` for full requirements, boundaries, and acceptance criteria (9 pass/fail checkboxes total, including the SQLite write-safety criterion added during discussion).

Downstream agents MUST read `218-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Tier-1 extraction: regex/heading/capitalization-based named-entity detection (companies, technologies, markets) from artifact markdown - zero network calls, zero LLM calls, by construction (Canon Part 8).
- Writing extracted entities and relationships into room.db exclusively through `lib/core/navigation/edges.cjs`'s `writeEdge()` and the existing node-write path, with `review_status='proposed'`.
- Additive extension of `ALLOWED_EDGE_TYPES` with domain-relationship edge types.
- Reuse of `lib/core/eureka/vector-store.cjs` for entity-node embedding.
- A runnable entry point (script or command, mirroring `eureka-command.cjs`'s start/status/report shape) that can be invoked standalone or ahead of an `/mos:eureka run`.
- Verification against at least one populated test room showing the before/after numbers in Requirement 5.
- SQLite write safety: `openRoomDb()` passes `{ timeout: 5000, ... }` to the `DatabaseSync` constructor plus `PRAGMA synchronous=NORMAL`; extraction batch writes wrapped in one explicit BEGIN/COMMIT/ROLLBACK.

**Out of scope (from SPEC.md):**
- Tier-2/tier-3 extraction (embedding-similarity clustering or LLM-based extraction) - deferred as a stretch goal only if tier-1 proves insufficient at verification time.
- Rewiring `/mos:find-connections` and `/mos:find-analogies` (TRIZ/SAPPhIRE) to read room.db - both bypass room.db entirely today; tracked as a separate follow-on phase (navigator-decided 2026-07-12).
- Retroactive backfill of every existing room in `~/MindrianRooms/`.
- Multi-room / portfolio-level entity resolution (Phase 215's territory).
- Any new command/skill surface beyond the minimum needed to invoke and observe the pipeline.
- SEED-037's fix (dead-API-account bug in `graph-candidate-producer.cjs`) - separate, different-grain issue.

</spec_lock>

<decisions>
## Implementation Decisions

### Entity type taxonomy
- **D-01:** Ship exactly three node types this phase: `company`, `technology`, `market`. No `person`/`funding_round`/`regulation`/`product` yet.
- **Rationale (advisor research, minimal_decisive tier):** tier-1's capitalization-only signal can't reliably distinguish additional proper-noun classes (person vs. company vs. product) - adding types now buys graph breadth at the cost of the exact mislabel noise this phase exists to eliminate. The frozen-Set pattern in `lib/core/navigation/typed-domain.cjs` makes adding more types a trivial additive edit later, once a tier-2 NER signal exists to type them correctly.

### Edge vocabulary
- **D-02:** Add exactly three new edge types to `ALLOWED_EDGE_TYPES`: `COMPETES_WITH`, `USES_COMPONENT`, `SUPPLIES_TO`. No `FOUNDED_BY`/`PARTNERS_WITH`/`TARGETS_MARKET`/`ACQUIRED_BY` yet.
- **Rationale:** matches the unbroken convention across the entire `ALLOWED_EDGE_TYPES` history (Phases 125 through 200-02) - add only the types this phase's writer actually emits. Speculative types with no producer this phase would be frozen constitutional vocabulary with no emitter (dead surface under Canon Part 11 born-wired). Mirror the Phase 200-02 idiom when adding (comment block citing this phase, additive only, after line ~632 in `edges.cjs`). Test precedent to follow: `tests/test-200-02-rs-edge-vocab.cjs` (floor-test style - assert named membership + prior-floor survival, never assert `.size`).

### Invocation surface
- **D-03:** Standalone dispatcher script, `scripts/entity-extract.cjs ROOM_DIR start/status/report`, cloning `eureka-command.cjs`'s detached-spawn + status.json shape exactly. No new `/mos:` command or subcommand in this phase.
- **Rationale:** this is literally what SPEC.md's in-scope line names ("script or command, mirroring eureka-command.cjs's shape"). Zero new command/skill surface means zero Canon Part 11 CIRS governance overhead (no connector registration, no HITL-shape declaration, no `doctor.cjs --acceptance` check). Open-work-close-per-invocation shape satisfies the `DatabaseSync` single-writer constraint for free.
- **Explicitly rejected:** a hidden/undocumented `/mos:eureka extract` subcommand - strictly worse than the script (still expands the command surface's behavior while being undocumented, which is exactly the ambiguity Part 11's "born wired or excluded" mandate exists to prevent).
- **Deferred, not rejected:** an automatic freshness-gated pre-step inside `/mos:eureka run` itself (skip re-extraction when a last-extraction marker is newer than the newest artifact mtime, reusing `eureka-command.cjs`'s existing status.json timestamp pattern). Good layer to add ON TOP of the standalone script once verification shows navigators actually hit the two-step manual-sequencing gap - not needed to satisfy this phase's own acceptance criteria.

### Test room for verification
- **D-04:** Use `aion-eureka-synergy` (real room, already touched this session) for Requirement 5's before/after numeric comparison. No dedicated synthetic fixture room this phase.
- **Rationale:** Requirement 5 is a directional regression proof (structural-vs-structural top-25 pair share drops below 50% from a measured 100%) - not a precision/recall claim. `aion-eureka-synergy`'s 100%-noise baseline (646 nodes/92 edges, top-25 all `memory_artifact`-vs-`memory_artifact`) is already measured and is the literal denominator the acceptance criterion needs. A synthetic fixture (the Phase 211 SEED-050 gold-set instinct) answers a genuinely different question - extraction *correctness*/recall against planted ground truth - which this phase's acceptance criteria don't require. Reserve a fixture room for later only if tier-1 recall proves insufficient at verification time (a calibration need, deferred alongside tier-2/3).

### SQLite write-safety implementation detail (locked via research + live empirical test, not just discussed)
- **D-05:** `openRoomDb()` passes `{ timeout: 5000, ...existing opts }` to the `DatabaseSync` constructor (not a separate `db.exec('PRAGMA busy_timeout=...')` call) plus `db.exec('PRAGMA synchronous=NORMAL')` (no constructor equivalent exists for this one). Extraction batch writes wrapped in one explicit `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Verified live on this machine (Node v22.22.2, real WAL-mode file, two `DatabaseSync` handles):** default (no `timeout`) fails in 0ms under write contention; `{ timeout: 2000 }` on the constructor waits ~2009ms before failing; `PRAGMA busy_timeout=2000` as an alternative also waits ~2007ms - confirms both routes hit the same `sqlite3_busy_timeout()` C API, constructor form preferred (can't be forgotten, applies from the first statement).
- **Framing for the executor (per external research review, confirmed sound):** the 5000ms value is a ceiling, not a promise - SQLite's busy handler uses exponential backoff with jitter internally, not a clean deadline. Actual contention in practice should resolve in milliseconds, since WAL readers never block on writers (only writer-vs-writer contention is possible, which is exactly the extraction-job-vs-live-write scenario this pipeline introduces). The 5s budget is insurance against a worst-case edge case, not the expected latency.

### Known upstream issue (non-blocking, logged 2026-07-12, post-execution)
- **Finding:** this machine's Node-bundled SQLite is `3.51.2` (confirmed live: `node -e "require('node:sqlite').DatabaseSync"` -> `sqlite_version()`). SQLite's own WAL documentation (verified primary source, `sqlite.org/wal.html#walresetbug`) confirms a data-race "WAL-reset" corruption bug affects **3.7.0 through 3.51.2 inclusive**, fixed in **3.51.3 (2026-03-13)**. This machine's version sits one patch below the fix.
- **Trigger conditions (verified against primary source):** WAL mode + 2 or more connections in separate threads/processes + simultaneous write/checkpoint activity - i.e. structurally the same "extraction worker vs. live conversation process" concurrency shape D-05 already exists to handle. No crash required; a live data race.
- **Severity vs. likelihood:** corruption is a serious consequence, but SQLite's own assessment is the trigger window is a genuine data race SQLite's own developers could never reproduce organically in testing (needed deliberately adversarial test logic); estimated real-world occurrence is comparable to SSD-failure/cosmic-ray rates.
- **Why this is NOT a Phase 218 blocker:** D-05's `{timeout:5000}` + `synchronous=NORMAL` + explicit BEGIN/COMMIT/ROLLARK change addresses lock-contention behavior (`SQLITE_BUSY`), which is an orthogonal SQLite subsystem from the WAL-reset checkpoint race. D-05 neither causes nor fixes this bug; the exposure pre-dates this phase and is a property of the bundled SQLite build, not of this phase's code.
- **Action for a future phase (not this one):** track whether a Node.js patch release bundles SQLite >=3.51.3 (or >=3.53.0, which re-ships the same fix); re-check `sqlite_version()` at that time. No code change belongs in Phase 218.
- **Provenance:** raised by an external research pass, verified live against primary sources this session (`sqlite.org/changes.html`, `sqlite.org/wal.html#walresetbug`) rather than accepted on citation alone. Durable copy: `~/MindrianRooms/rethinking-mindrianos/research/2026-07-12-eureka-entity-extraction-phase218-scoping/2026-07-12-eureka-entity-extraction-phase218-scoping.md` (addendum appended same session).

### Claude's Discretion
- Exact regex/heading-heuristic rules for tier-1 extraction (which capitalization patterns, code-span backtick handling, heading-context propagation) - follow whatever the planner/executor determines is the best fit once looking at real artifact prose in `aion-eureka-synergy`, per the tiered doctrine already established (SEED-037's structural-first-before-model doctrine).
- Exact `entity-extract.cjs` file layout and internal module boundaries - follow existing `lib/core/eureka/*.cjs` conventions; the pattern mapper should confirm the best home before planning.
- MISC-label-style disambiguation heuristics are NOT this phase's concern (that's tier-2 territory per the research) - do not build entity-type disambiguation beyond simple capitalization/heading-context rules.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own specs
- `.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-SPEC.md` - locked requirements, boundaries, constraints, acceptance criteria (9 checkboxes).
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-12-eureka-entity-extraction-phase218-scoping/2026-07-12-eureka-entity-extraction-phase218-scoping.md` - the full root-cause + prior-art + technical-validation research trail (Canon: this repo's CLAUDE.md Dev-Research Compositing mandate).

### Prior-phase patterns to follow (Part 7 reuse)
- `.planning/phases/216-eureka-user-facing-command-eureka-user-command-wrap-the-ship/216-CONTEXT.md` - the room-native-substrate-adapter pattern, fire-and-return (not block-and-wait) convention, report-only-no-banking v1 posture. This phase's script should follow the SAME fire-and-return shape.
- `.planning/phases/211-eureka-generator-mvp-tri-modal-room-db-sqlite-vec-xenova-all/211-CONTEXT.md` - the sqlite-vec/embeddings decisions (D1-D8) this phase must not contradict; the SEED-050 gold-set precedent referenced in the test-room decision above.

### Edge vocabulary precedent
- `lib/core/navigation/edges.cjs` (around line 632, `ALLOWED_EDGE_TYPES` frozen Set + `writeEdge()` chokepoint) - add the 3 new types here, additively, following the Phase 200-02 comment-block idiom.
- `tests/test-200-02-rs-edge-vocab.cjs` - the floor-test pattern to mirror for the new edge-type test.

### Related, non-duplicative efforts
- SEED-037 RCA: `.planning/debug/graph-derive-silent-clear-dead-api-derivation.md` - artifact-to-artifact semantic edges, different grain, status `investigating`.
- Phase 212.5 (`eureka-graph-substrate`) ROADMAP entry - whitespace-zone/structural-hole detection, also artifact grain, still 0 plans.

### Adjacent code this phase composes with (not modifies)
- `lib/core/room-db.cjs` (`openRoomDb`) - the DatabaseSync constructor call to update per D-05.
- `lib/core/eureka/vector-store.cjs` - reuse for entity-node embedding, no signature changes.
- `scripts/eureka-command.cjs` - the dispatcher shape (start/status/report, detached spawn) to clone for `scripts/entity-extract.cjs`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/navigation/edges.cjs`'s `writeEdge()` - the only sanctioned write path for new edges; validates against `ALLOWED_EDGE_TYPES`.
- `lib/core/eureka/vector-store.cjs`'s `ensureStore`/`insertVector` - existing per-node embedding storage, confirmed working live (sqlite-vec backend) this session.
- `scripts/eureka-command.cjs` - the exact dispatcher pattern (`ROOM_DIR start/status/report`, detached spawn via `child_process`, `status.json` polling) to clone.
- `lib/core/graph-derivation.cjs` - the propose-then-navigator-confirm HITL pattern (`review_status='proposed'`) this phase's new nodes must follow.

### Established Patterns
- Additive-only frozen Sets (`ALLOWED_EDGE_TYPES`) - never invented ad hoc, always reviewed through the same chokepoint, one comment block per phase that adds to it.
- Fire-and-return (D-05 in Phase 216's context) - never block-and-wait on a multi-minute run; detached spawn + status polling + honest "still running" message.
- Report-only v1 (Canon Part 9) - new capability renders/writes proposed data but does not auto-confirm; a navigator gate is a later phase's concern, not this one's.

### Integration Points
- `openRoomDb()` in `room-db.cjs` - the DatabaseSync constructor call needs the `{ timeout: 5000 }` addition (D-05).
- room.db `nodes`/`edges` tables - the sole write target; `whitespace_scan`, `contradiction_check`, `graph_query`, and `/mos:eureka` all read this same file/schema (confirmed via file:line fork this session) so they benefit automatically with zero code changes on their side.

</code_context>

<specifics>
## Specific Ideas

- The Prodrive cross-classification example (COMPETES_WITH in one artifact, USES_COMPONENT-implying property in another) is the concrete motivating case for why COMPETES_WITH + USES_COMPONENT specifically matter as a pair - the extraction heuristics should be validated against being ABLE to represent this exact pattern, even though `aion-eureka-synergy` (not corepower-isolation) is the actual test room.
- Two external research passes (transformers.js ESM/CJS claim, corrected; SQLite busy_timeout behavior, empirically verified) are both filed in the rethinking-mindrianos research entry and should inform the executor's confidence in the SQLite write-safety requirement specifically - it is not speculative, it was tested live on this machine.

</specifics>

<deferred>
## Deferred Ideas

- Tier-2 NER (ONNX models: `onnx-community/distilbert-NER-ONNX` 65.8MB, `onnx-community/bert-base-NER-ONNX` ~55MB) - confirmed via research to be untested on business/venture domain text (CoNLL-news-only training), so tier-1 must be verified first before any tier-2 investment. Not this phase's scope.
- Tier-3 relation extraction (GLiREL) - confirmed this repo already has Python-subprocess precedent (`intelligence-cascade.cjs`'s `execSync('python3 compute-hsi.py ...')`), so "GLiREL is Python-only" is not a hard blocker here - but a GLiREL sidecar would need `spawn` (long-lived process + async I/O + FastAPI health-check lifecycle), a meaningfully different `child_process` pattern than the existing `execSync` (blocking, one-shot) precedent. Whoever scopes tier-3 should not assume the `execSync` pattern is copy-pasteable.
- Auto pre-step inside `/mos:eureka run` with a freshness gate (see D-03 above) - good future layer, not required for this phase's acceptance criteria.
- Rewiring `/mos:find-connections`/`/mos:find-analogies` onto room.db - separate follow-on phase, navigator-decided 2026-07-12.
- Multi-room portfolio entity resolution/dedup - Phase 215 territory.
- Fleet-wide backfill of all existing rooms - separate follow-on once this phase proves out on 1 room.

### Reviewed Todos (not folded)
- "F7 rescope: re-plan Phases 212/213 against registerCapability before execution" (score 0.9) - reviewed, not folded. About Phases 212/213 registerCapability rewiring specifically, not entity extraction; the high keyword-match score was generic ("plan phases before rethinking"), not substantive overlap.
- "ignite persona card under-shows frozen role_blend vocabulary" (score 0.6) - reviewed, not folded. Unrelated domain (persona/onboarding, not graph/entity extraction).
- "Registry-drift gate - prevent silent command disappearance keyed to F-shape" (score 0.6) - reviewed, not folded. Unrelated domain (command registry drift detection).
- "Never git stash mid-merge-conflict-resolution, it drops MERGE_HEAD" (score 0.6) - reviewed, not folded. A general git-workflow lesson, not phase-specific.

</deferred>

---

*Phase: 218-entity-extraction-pipeline-eureka-entity-extraction-extract-*
*Context gathered: 2026-07-12*
