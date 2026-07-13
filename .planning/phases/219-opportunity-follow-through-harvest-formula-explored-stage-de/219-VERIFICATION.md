# Phase 219: Live REQ-6 Verification (ador-ip-test)

**Run date:** 2026-07-13
**Room:** `~/MindrianRooms/ador-ip-test` (real, live room: 164 IP.com case-study artifacts, pre-218 scaffold, EMPTY opportunity bank)
**Executor start (UTC):** 2026-07-13T04:58:48Z
**Discipline:** 218-VERIFICATION before/after format - fixture-green is NECESSARY, never SUFFICIENT (218 lesson R1: fixture-green lied twice).

---

## 1. Offline Gates (Task 1 - nothing touches the live room until everything is green)

| # | Command | Exit | Result (verbatim counts) |
|---|---------|------|--------------------------|
| 1 | `bash tests/run-all-219.sh` | 0 | `Phase 219: PASS=11 FAIL=0 SKIP=0` - all SEVEN phase legs PASS (219-01 banking, 219-02 FTS5 degrade, 219-02 metadata, 219-03 harvest sensor, 219-04 qualification, 219-05 research contract, 219-05 explore chain), zero SKIP on phase legs; grep gates PASS (no raw node/edge INSERT, zero network, no command surface leaked); 218 substrate no-regression `PASS=13 FAIL=0 SKIP=0`; 211 engine no-regression `PASS=10 FAIL=0 SKIP=0` |
| 2 | `node scripts/build-connector-registry.cjs --check` | 0 | `connector-registry: OK` |
| 3 | `node scripts/check-shape-declaration.cjs --check` | 0 | Advisory WARNs only (pre-existing skills/vault + skills/visualize dual-declaration class, Phase 210 advisory posture - never blocks); zero violations on 219 surfaces |
| 4 | `node scripts/check-render-coverage.cjs` | 0 | `16 covered, 0 excluded, 0 gap (16 entries)`; md-keyspace `204 wired, 2 excluded, 0 unwired (206 declaring commands)` |
| 5 | `node tests/test-sensors-part8-sweep.cjs` | 0 | `sensors Part-8 5-tripwire sweep: 1 passed, 0 failed over 18 file(s)` - SPEC acceptance criterion 9, machine-checked |
| 6 | `node scripts/doctor.cjs --acceptance` | 0 | `Acceptance full: 14/15 points passed; failed: verify-release-clean-tree` |

**Honest note on gate 6:** the single FAIL point (`verify-release-clean-tree`) is 6-file tracked drift owned by CONCURRENT SIBLING SESSIONS (commands/eureka.md, evals/plurai/211-baseline.json, lib/core/research-corpus.cjs, package-lock.json, scripts/eureka-command.cjs, skills/eureka/SKILL.md) - the exact pre-documented item in `deferred-items.md` (logged by the 219-05 executor). Zero overlap with this plan's diff (this plan modifies only 219-VERIFICATION.md). All 219-owned acceptance points PASS, doctor itself exits 0.

**Verdict: GREEN BOARD. The live room may be touched.**

---

## 2. Live ador Run (pre/post) - Task 2

**Canonical room.db path (verified against lib/core):** `~/MindrianRooms/ador-ip-test/.mindrian/room.db` (`lib/core/room-db.cjs:103-104`: `<roomDir>/.mindrian/room.db`). The `.room-graph/graph.db` in this room is an OLD hand-built python case-study artifact (tables: nodes/edges/patent_detail + seed scripts) - NOT the plugin graph; untouched.

**Bank-state nuance (honest):** `opportunity-bank/` was NOT byte-empty - it holds 25 pre-existing, hand-authored case-study files (`opp-001`..`opp-015`, rubric, README - the old Reuven/IP.com work, loose files, pre-D-21 convention). The graph measure is the real one: **0 `opportunity` nodes, 0 pipeline-produced artifacts** at PRE.

### 2.1 PRE-state (queries against room.db, readOnly)

Query: `SELECT type, COUNT(*) FROM nodes GROUP BY type` / `SELECT type, COUNT(*) FROM edges GROUP BY type` / `SELECT COUNT(*) FROM nodes WHERE type='opportunity'`

| Measure | PRE value |
|---|---|
| total nodes | **70** (Artifact 57, Section 11, memory_event 2) |
| total edges | **57** (BELONGS_TO 57) |
| opportunity nodes | **0** |
| REJECTED_BECAUSE edges | **0** |
| memory_artifact nodes | **0** (old-schema room: capital-A `Artifact` type, pre-Phase-150) |

Matches the 219 scoping census exactly (70 nodes / 57 edges, pre-218 scaffold).

### 2.2 Leg 0 (Rule-3 blocking fix, plan-anticipated): memory-cortex reconcile

First `node scripts/entity-extract.cjs ~/MindrianRooms/ador-ip-test run` returned `{"artifacts":0,"entities":0,...}`. **Root cause traced:** `collectArtifacts` (`scripts/entity-extract.cjs:201-269`) tier (a) selects `type='memory_artifact'` rows and tier (b) requires a `sectionAnchor` derived from those same rows - this room has ZERO `memory_artifact` nodes (its graph predates Phase 150; node types are old-schema `Artifact`/`Section`). The production surface that mints them is the session-start memory-cortex reconcile (`scripts/session-start:1574-1640` -> `lib/core/memory/reconcile-memory-runner.cjs reconcileMemoryArtifacts`); this room never had a current-plugin session. Fix = run the SAME production function (not a reimplementation):

```
reconcileMemoryArtifacts(roomDir, {db}) -> {"upserted":68,"decision_nodes":0,"edges":28,"unchanged":0}
```

### 2.3 Leg 1: extraction + metadata (218 pass + Plan 02 slice) - PASS

`node scripts/entity-extract.cjs ~/MindrianRooms/ador-ip-test run` -> `status.json`:

```
{"state":"done","artifacts":116,"entities":1699,"edges":1750,"embedded":true,"metadata_applied":57,"metadata_skipped":0}
```

POST-extraction state (same queries as PRE):

| Measure | POST value |
|---|---|
| total nodes | **955** (company 776, memory_artifact 68, Artifact 57, governing_thought 28, Section 11, technology 11, market 2, memory_event 2) |
| total edges | **1545** (DESCRIBES 1413, BELONGS_TO 57, STATES 28, COMPETES_WITH 21, USES_COMPONENT 15, SUPPLIES_TO 11) |
| entity review_status | **789 proposed / 0 confirmed** (zero auto-confirm, per contract) |

**Metadata props live (SPEC acceptance 5, must_have truth 2): PASS.** Direct query over `memory_artifact` props shows frontmatter fields landed, e.g. `memory_artifact:business-model:MINTO -> {"methodology":"minto-pyramid","status":"active","created":"2026-05-31"}`, `memory_artifact:competitive-analysis:STATE -> {"status":"active","created":"2026-05-31"}`; 57 nodes carry applied metadata (matches `metadata_applied:57`).

**Extraction quality note (honest, feeds 2.6):** top-degree extracted "companies" include the known 218-residual noise class (standalone capitalized words in flowing prose): `TBD, Add, Generated, Edit, MECE-supporting, Feynman-MINTO, STATE, TODO...` alongside REAL domain entities (`Ador, Abbott, TwistDx, BioFire, Cepheid, Nanogen, BATM, NATlab, BSL-1.1`).

### 2.4 Leg 2: eureka run via the production dispatcher - RAN CLEAN, BANKED 0 (GAP-1)

`node scripts/eureka-command.cjs ~/MindrianRooms/ador-ip-test run` (the production path, exit 0; NEVER a manual baseline):

```
eureka-portfolio-report: banked 0 opportunity node(s), 0 evidence edge(s), 25 skipped (predicate critic)
... (414505 pairs scored, 25 ranked, 25 statements, 632 tail techs, mode room/live)
```

Provenance: `run_mode: "live (local embedding spine)"`, encoder `MongoDB/mdbr-leaf-ir`, `vec_backend: sqlite-vec`, `tail_suspect_noise: true` (self-flagged).

**GAP-1 (root cause traced, 218-class, fixture-green lie #3):** every one of the 25 statements carries `"critic": "pending", "banked": false`. `lib/core/eureka/opportunity-statement.cjs:273-292` (`runCriticGate`): the REAL Phase 212 critic's `stageA` is ASYNC (encoder-dependent); the synchronous statement emitter cannot await it, so on the real-module path it ALWAYS returns `{critic:'pending', banked:false}` ("A future async runner can await the real verdict"). Consequences, verified live:
- predicate `critic` (default): banks `st.banked===true` -> **0** (`eureka-portfolio-report.cjs:1015-1017`)
- predicate `all`: requires `st.critic !== 'pending'` -> **0** (`:1014`)
- predicate `critic+tail`: banks tail-flagged -> **0 on this report** (0 of 25 top-ranked statements are tail-flagged; verified from `portfolio-report.json`)

The plan-sanctioned discretion lever (`MINDRIAN_OPPORTUNITY_BANK_PREDICATE` tuning) is therefore INERT on a live CLI run - all three values bank 0. The 219-01 banking test is green because it injects a critic STUB that returns resolved verdicts; no production surface resolves per-statement verdicts today (`commands/eureka.md:210` still says banking is deferred; the `eureka_critic` MCP tool + `scripts/eureka-critic-run.cjs` are CALIBRATION surfaces over gold cards, not per-room-statement critics).

**Statement quality (the trap check at this leg):** the top-25 pairs are NOT memory_artifact-vs-memory_artifact (the cohort-stratification fix HELD - every pair is entity-vs-entity). But they ARE noise-entity-vs-noise-entity: rank 1 = `TBD x BSL-1.1`, then `BSL-1.1 x Add`, `BSL-1.1 x MECE-supporting`, `TBD x Feynman-MINTO`... - the 218-residual tier-1 extraction noise class dominating entity degree. The critic gate refusing to bank these is the system being honest, not broken; but the gate refuses EVERYTHING structurally, including any good statement.

### 2.5 Leg 3: harvest producer - RAN CLEAN, ZERO CANDIDATES (GAP-2)

`harvestCandidates(~/MindrianRooms/ador-ip-test, {})` -> `{"ok":true,"count":0,...}`; side-channel `.mindrian/last-opportunity-harvest.json` written with `schema_version:1, candidates:[]`. Per-lane emptiness, each query-verified against room.db:

| Lane | Yield | Query-verified reason |
|---|---|---|
| bridge | 0 | `BRIDGE_EDGE_TYPES = {RELATED_TO, CONVERGES, SUPPORTS, INFORMS}` (`opportunity-harvest.cjs:175-178`); the room has **0** edges of those types. Its real cross-entity edges are `COMPETES_WITH 21 / USES_COMPONENT 15 / SUPPLIES_TO 11` - the EXACT relationship edges the 218 extractor mints on a real room - and the lane does not ride them |
| contradiction | 0 | 0 `CONTRADICTS` edges in room.db |
| eureka_proposal | 0 | 0 `opportunity` nodes (GAP-1 upstream) |
| whitespace | 0 | 0 `WhitespaceZone` nodes (D-05: the lane reads graph nodes only, never whitespace-results.json) |
| meeting_filing | 0 | 0 `meeting` nodes; the 2 `memory_event` rows carry `kind: null` (auto_explore/spine_read plumbing, not meetings) |

**GAP-2 (root cause traced, 218-class, fixture-green lie #4):** the 219-03 fixture planted `RELATED_TO` bridges, so the bridge lane tested green - but a REAL post-218-extraction room's cross-entity signal lives in the extractor's relationship vocabulary (`COMPETES_WITH`/`SUPPLIES_TO`/`USES_COMPONENT`), which `BRIDGE_EDGE_TYPES` omits. The substrate HAS genuinely intersectional low-degree pairs the lane would have surfaced, e.g. (name, type, degree - all under the `HUB_DEGREE_CEILING=6` or near it):

```
COMPETES_WITH: Abbott (deg 10) -> TwistDx (deg 6)
COMPETES_WITH: BioFire (deg 3) -> Cepheid (deg 5)
COMPETES_WITH: BATM (deg 6) -> Ador (deg 13)
COMPETES_WITH: Nanogen (deg 5) -> Portside (deg 3)
```

(noise pairs exist too - `TODO x FTO`, `Surfaced x SQL` - which is what the Q-rubric + the human card exist to filter).

### 2.6 The 218-class check: verdict recorded honestly - **FAIL (pipeline dead-ends before qualification)**

- The named trap (banked opportunities as memory_artifact-vs-memory_artifact restatements): **vacuously avoided** - nothing banked at all. The cohort-stratification fix held (all eureka pairs entity-vs-entity).
- The REAL 218-class finding this live run caught (the exact thing fixture-green cannot): **two composed upstream gaps make the live pipeline structurally unable to produce a single candidate on the claim room.** GAP-1: eureka banking is unsatisfiable on any live run (sync emitter x async critic; all three predicate values bank 0). GAP-2: the harvest bridge lane's edge vocabulary omits the extraction relationship edges that ARE a real room's cross-entity signal.
- Per the plan: "record FAIL honestly and stop (the fix belongs upstream... silent acceptance is not)." **Stopping. No product source touched by this plan (files_modified = 219-VERIFICATION.md only).**

### 2.7 Task 2 items NOT REACHABLE (blocked by 2.6, recorded as such)

- **D-20 forced-path check** (`MINDRIAN_FORCE_ENGINE_ABSENT=1` -> [LLM manual scan (high effort)] OFFER at the qualification gate): the qualification card renders a CANDIDATE from the harvest side-channel; with `candidates:[]` there is no card to render, so the live forced-path invocation cannot execute. (The behavior itself is offline-green: test-219-qualify.cjs Test D-20, 12/12.)
- **D-21 placement + STATE.md pickup check**: nothing filed (nothing qualified/explored), so no live nesting to assert. (Offline-green: test-219-explore-chain.cjs D-21 group, 16/16.)
- **Task 2 automated verify** (`>=1 opportunity node in room.db`): FAILS by GAP-1/GAP-2 - recorded, not papered over.

### 2.8 Fix routing (owning plans, never patched forward here)

1. **GAP-1 -> owning surface: 219-01/eureka pipeline (upstream of this plan).** Ship the "future async runner" `opportunity-statement.cjs:280` names (await the real 212 `stageA` + Stage-B local-session judge), or a wired per-statement critic-resolution step on the /mos:eureka command surface, so `banked` can ever be true live. Until then REQ-1's live acceptance is unreachable by construction.
2. **GAP-2 -> owning surface: 219-03 harvest sensor.** Extend `BRIDGE_EDGE_TYPES` (D-04 additive-reuse justification: `COMPETES_WITH`/`SUPPLIES_TO`/`USES_COMPONENT` are associative cross-entity semantics, not provenance) AND extend the fixture to plant extraction-vocabulary bridges so fixture-green stops lying about real rooms.
3. **Aggravating (pre-known, 218-residual, NOT new):** tier-1 extraction noise dominates entity degree on MindrianOS-generated prose (`TBD`/`Add`/`Generated` as companies). Real entities are present; noise dilutes ranking. Owning surface: 218 extractor filters (or the deferred tier-2 escape hatch).

---

## 3. Navigator Checkpoint (card + explore) - Task 3

**BLOCKED (not reached, and not reachable):** the mandatory D-12 navigator checkpoint requires a real qualification card on a live candidate. With zero harvest candidates (Section 2.5) no SENS-14 fire, no card, nothing to Qualify/Skip/Explore. The checkpoint stays open until GAP-1/GAP-2 land upstream; then Task 2 legs 2-3 + the D-20/D-21 checks re-run on this room and this section gets the navigator record.

---

## 4. Corepower Validation

_(filled by Plan 07 - navigator-run on the Desktop machine)_
