# Phase 150 Research (canonical GSD research artifact)

> Consolidates ALL the research from the 2026-06-09 design session so the GSD planner/executor has full context: the 14-agent internal investigation (5-agent memory audit + 4-agent understanding pass + 5-agent loop-closure revisit), the external Tavily validation of the technical + product bets, the Hooked retention rationale, the ICM / liquid-room successor context, and the plan-checker verdict. Companion docs (read alongside): 150-CONTEXT.md (scope + LOCKED decisions), 150-UNDERSTANDING.md (the reuse-seam map with file:line), 150-LOOP-MAP.md (what 150 closes vs companions).

## 1. What this phase is, in one sentence

Project the 6 per-folder memory markdown files (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER) into `room.db` as typed graph members via the `navigation.cjs` chokepoint, make them queryable LOCAL (getRoomContext) and REMOTE (typed Brain packet, generic handles only), feed them into the LarryReach dial + "what's next", wire the dial to actually RENDER (the 148+150 unlock), close the orphans, and ship a claim harness that proves the site's claims function. It is "the real 149" -- 149 bridged the developer's `.planning/` docs; 150 bridges the navigator's memory.

## 2. The internal investigation (14 agents -- the evidence base)

### 2a. The memory-cortex utilization audit (5 agents)
Verdict: **0 of 6 user memory MD files are graph members.** Confirmed by grep (`grep memory_artifact lib/` = 0). Specifics:
- **FEYNMAN.md is write-only** (2 writers, 0 consumers; not in readTriple/readQuadruple; the discover.md:170 seed-writer does not exist).
- **BRAIN.md** has 9 sections, ~4 used; `SECTION_WEIGHTS` is a dead import; `brainAnchors` has a consumer (projections.cjs:108) but no producer; `confidence_baseline` read by nobody. The dial uses BRAIN.md as ONE bit (the mode switch) -- the 40% `brain_confidence` actually comes from the room.db Brain packet, not BRAIN.md.
- **STATE.md** sensors are built and STARVED (`sensor-lagging-component` reads `ctx.lowFillSections`, `sensor-gate-approach` reads `ctx.venture_stage` -- no producer populates either).
- **USER.md** is greeting-only; `journey_stage` parsed then read by zero ranking/sensor (Canon Part 2a half-wired).
- **MINTO.md** governing-thought is a presence-gate + staleness hash; the MECE pyramid collapses to one display scalar.
- **ROOM.md** over-enforced (decision 15) but `identity_text` reaches 3 display sites, no router/selector.
- **The dev/user inversion (headline):** Phase 149 built a complete bridge (writer + reconcile + lineage + hook + typed packet) for the DEV `.planning/` docs; there is NO equivalent for the USER memory files.

### 2b. The understanding pass (4 agents) -- captured in 150-UNDERSTANDING.md
- **Consumption seams (140-148):** getRoomContext `legD` insertion (room-context.cjs ~:166); decide() starved inputs (`sensorCtx.lowFillSections` ~:622, `sensorTuple.stage` ~:618, threaded at intent-classifier.cjs ~:1220); dial `reachScores` adapter (dial-reach-orchestrator.cjs:143-151,220); `resolveArchetype` optional cortex arg (selector-dispatcher.cjs:130-137); the RENDER GAP (`buildReachList`:211 + `dial-presenter` have ZERO production callers; intent-classifier.cjs:1329 is the live decide() caller where the render must surface).
- **Connector spine (143.3):** the minimal Part-8-safe connector declaration (frozen-6 reach_id, frozen-3 posture, framework:null + filing:memory_event_only avoids the framework-resolution requirement); registered by being on a walked command/agent `.md`; dispatched by the intelligence-orchestrator with zero edits.
- **Dual-graph (130.7/110/149):** correlation_id = `sha256(name + '|' + primary_label)[:16]`, embedding-independent; the typed packet = `additionalProperties:false` teeth + maxLength:120 + projectText sha256-by-default; mirror artifact-brain-packet.cjs EXACTLY (build from node IDs + correlation_id + enum scalars, never properties prose, no network requires); clone test-149-brain-egress.cjs.
- **Claim harness:** clone run-all-146.sh (two-group); real fixture room.db (test-cascade-surface-e2e.cjs:1-50 pattern, `MINDRIAN_ROOMS_HOME` tmpdir, NO mocked Brain); class-m-brain-smoke L1-L5 as the live-Brain precondition that self-skips; `doctor --claims` sibling of `--acceptance`.

### 2c. The loop-closure revisit (5 agents) -- captured in 150-LOOP-MAP.md
- The retrieval spine (141), compute-store-act (142, EXECUTED), sensors (143), engine flip (144), selector (148) are ALL live; the loop breaks only where the cortex should feed it (4 links L1-L4).
- The SQL spine is HALF-WIRED: truth-claim WRITERS missing -- the Phase 108 `decision` EXTEND promotion NEVER shipped a writer; `find_stale_decisions` returns a silent empty set; a triple-ledger (MINTO decision_log + decisions_index table + f_selector_decision memory_event) with no `decision` graph node.
- The Brain side is built-but-dormant: `sendPacket` has ZERO production consumers (150 is the FIRST); Phase 132 live writes deferred (6 `:Person` real names in production Brain -- the one open LIVE Part 8 exposure); HELD nodes (no correlation_id) are un-joinable; the dual-graph-health gate is report-only.
- **Companions 150 does NOT close (named honestly):** 132 live writes, Part 10 ratification, the 119 nudge emission (Phase 115), the rest of the 108 truth-claim writers, 112/113/144.1. Record corrections: 95.5 and 142 are DONE (stale map notes).

## 3. External validation (Tavily, 2026-06-09) -- the bets are proven architectures

### 3a. Memory cortex as graph = a Temporal Knowledge Graph (TKG) for agent memory -- VALIDATED
- The pattern 150 implements is the established TKG-for-agent-memory architecture (Graphiti/Zep, 20,000+ GitHub stars; arXiv 2501.13956). "A temporal knowledge graph records when each fact was true and where it came from -- so it can answer what's true now, what was true then, and why." That is exactly 150 + the Phase-124 timeline.
- The dev/user-inversion fix is the documented reason graphs beat flat memory: "A document store may know a user mentioned a project and a vector DB may retrieve similar notes, but neither understands the relationships among people, actions, deadlines, dependencies. A knowledge graph preserves those links explicitly." (PuppyGraph).
- The returning-user reload is the literature's headline benefit: "When the customer returns weeks later, the system can reconstruct context instantly." This IS claim C1 ("picks up where you left off").
- **Bi-temporal note to honor:** TKGs track valid-time (true in the world) AND ingestion/provenance-time; superseded facts are invalidated, not deleted. 150's memory_event is ingestion-time; the `review_status` enum (stale/superseded/invalidated) already carries the valid-time semantics -- keep using it rather than hard-deleting.
- **Cautions from a practitioner post-mortem (Reddit "5 mistakes"):** (1) resolution != deduplication -- "naming is not identity"; use thresholds (>=0.95 auto-merge, >0.85 human review, <=0.85 new node) -- directly relevant to the correlation_id join + the HELD-node degradation; (2) do NOT build an immutable event-sourcing log layer before materializing the graph (RAM-expensive) -- so 150 materializes nodes directly via the chokepoint, no new event-store; (3) treat memory as infrastructure -- observable, composable, policy-driven -- validates the navigation.cjs chokepoint + typed-packet policy.

### 3b. Dual-graph + Part 8 = privacy-preserving federated knowledge graphs -- VALIDATED
- Federated-KG literature (FedRKG arXiv 2401.11089; FedR EMNLP-Findings 2022) confirms the exact 150 boundary: clients never disclose records to the server; only relation/handle tables cross (via Private Set Union), entity content stays local. 150's "generic handles only" packet is the textbook-correct design ("relation aggregation protects entity-level and graph-level privacy").
- **Caution -- the KG-reconstruction attack:** FedE leaked because it shipped entity SETS; a malicious server reconstructed the graph. 150's packet must never send an enumerable entity set that enables reconstruction -- the hash+enum-only discipline (never properties prose) + the adversarial egress test is the correct mitigation. This is why the 149-pattern (build from node IDs, never properties) is load-bearing.
- Entity-resolution-meets-graph (Senzing/Linkurious): "name is not identity." Reinforces the correlation_id caution -- a name-based hash join can collide ("Apple" company vs fruit). 150 mitigates by joining on `name|primary_label` (the label disambiguates) and degrading HELD/uncertain nodes to LOCAL-only rather than mis-joining.

### 3c. Liquid room successor = GraphRAG hierarchical community detection -- VALIDATED
- Microsoft GraphRAG (Edge et al. 2024) uses Leiden community detection to cluster nodes into HIERARCHICAL communities at multiple resolution levels, with per-community summaries. This is precisely the navigator's "liquid, fractal, budding sub-rooms" vision (Simon near-decomposability) -- a proven architecture, not speculation. PPR (HippoRAG) for personalized retrieval + weighted RRF for multi-signal fusion are the standard retrieval primitives.
- This validates the Phase-112 successor (Room Budding): community detection over the cortex graph is HOW a room would detect a forming sub-domain and bud a sub-room. It is OUT of 150 (the successor), but 150 is the precondition (the graph must hold the cortex first).

### 3d. Hooked retention -- VALIDATED, including the 150 punchline
- Hooked works in B2B/PLG daily-use tools: triggers = workflow cues, rewards = progress + insights + acknowledgment, investments = content + integrations + invites (umbrex; Nir Eyal). Maps cleanly to MindrianOS.
- The 150 thesis is the literature's headline: "Investment is the most neglected stage. Users who reach the investment phase are meaningfully more likely to remain active long-term." And StriveCloud: "an investment that makes the next session better than the last" -- that is 150's exact function (the cortex deposit loads the next trigger).
- Habit formation takes ~66 days (not 21); apps bridge it with structure: "triggers that fire on the right emotion, actions that take a single tap, rewards that vary, and an investment that makes the next session better." 150+148 supply the last two (the rendered one-tap action + the reloading investment). Ethics: MindrianOS is a Facilitator (real pain relieved, Hunt/Self reward, not manufactured anxiety).

## 4. Implementation guidance (patterns to follow, pitfalls to avoid)

### Patterns (reuse-before-build, Canon Part 7)
- `memory-artifacts.cjs` mirrors `planning-artifacts.cjs` (the 149 writer). `memory-cortex-packet.cjs` mirrors `artifact-brain-packet.cjs`. `reconcile-memory-runner.cjs` mirrors `reconcile-runner.cjs`. `test-150-brain-egress.cjs` mirrors `test-149-brain-egress.cjs`. `run-all-150.sh` mirrors `run-all-149.sh`. `run-all-claims.sh` mirrors `run-all-146.sh` (two-group). The connector declaration mirrors `commands/find-bottlenecks.md`/`agents/reverse-salient-agent.md`.
- All graph writes via `navigation.cjs` (Part 9). The cortex nodes are SYSTEM-BOOKKEEPING (created_by=system) EXCEPT `decision` which is a TRUTH-CLAIM node -> mint `review_status='proposed'`, never `confirmed` (only human `confirmNode` promotes; a `confirmed` mint is a Part 9 role-5 breach). This is the one canon subtlety the plan-checker flagged CLEAN in 150-01.

### Pitfalls (from internal + external research)
- Do NOT send entity sets / properties prose to the Brain (KG-reconstruction attack). Build packets from node IDs + correlation_id + enum scalars only; ship the adversarial egress test.
- correlation_id is a name|label hash, NOT identity -- degrade HELD/uncertain nodes to LOCAL-only; do not mis-join (3b caution).
- Do NOT over-build an event-sourcing/immutable-log layer (RAM); materialize nodes directly (3a caution 2).
- The dial RENDER is the load-bearing unlock -- without `buildReachList -> dial-presenter` wired into intent-classifier.cjs:1329, the engine decides and the navigator never sees it (no Hooked Action prompt). Frozen 148 contracts (MAX_K=3, 0.70/0.15, DIAL_REACH_K=6) stay byte-unchanged -- 150 FEEDS the selector, never re-architects it.
- 150 is the FIRST real `sendPacket` consumer -- it must prove the Part-8 guards fire in PRODUCTION, not just tests (its own adversarial egress test, not the dormant H5 fixtures).
- The starved sensors (lowFillSections/venture_stage) are built and abstaining -- 150 PRODUCES their input; it does NOT build new sensors (Phase 143 fence).

## 5. The plan structure (8 plans / 3 waves) -- plan-checker PASS (11/11, 0 blockers)
- **Wave 1:** 150-01 (memory_artifact writer + governing_thought/persona/decision nodes + lineage + run-all-150.sh) [MEM-01/02/07-decision]; 150-02 (typed memory-cortex Brain packet + adversarial egress test) [MEM-04].
- **Wave 2:** 150-03 (reconcile spine + hybrid trigger) [MEM-01]; 150-04 (getRoomContext legD + starved-sensor producers + brainAnchors + SECTION_WEIGHTS delete) [MEM-03/07].
- **Wave 3:** 150-05 (connector spine + cortex sensor) [MEM-05]; 150-06 (selector graph-driven + THE render unlock) [MEM-06/D-08]; 150-07 (FEYNMAN read-back + seed-writer) [MEM-08]; 150-08 (claim harness C1-C7 + doctor --claims + finalize run-all-150.sh) [MEM-09/D-09].
- Wave safety verified (intra-wave files disjoint; the intent-classifier.cjs touch by 150-04 vs 150-06 is cross-wave/sequential). 1 warning: the SECTION_WEIGHTS delete guard rests on the executor grep-confirming zero live consumer (already written into 150-04 Task 4).

## 6. Framework references
- Hooked Model (Eyal & Hoover) -- TARI loop; Investment-loads-Trigger is 150's retention lever. The Part 10 ratification gate ("Hooked re-score >= 55") becomes runnable once 150+148 close the loop; the claim harness C1 IS the returning-user reload test.
- ICM (Van Clief & McDermott 2026) -- folder structure IS the code; 150 makes the per-folder memory a graph member so the graph finally understands the ICM hierarchy.
- Simon (1962) near-decomposable hierarchy -- the fractal sub-room/liquid-room structure; validated by GraphRAG hierarchical communities.
- Temporal Knowledge Graph (Graphiti/Zep, arXiv 2501.13956) -- the proven agent-memory architecture 150 implements.
- Federated KG privacy (FedRKG arXiv 2401.11089, FedR EMNLP 2022) -- the proven dual-graph/Part-8 boundary.
- GraphRAG (Edge et al. 2024, Microsoft) -- Leiden communities + PPR + RRF; the liquid-room (Phase 112) successor.
