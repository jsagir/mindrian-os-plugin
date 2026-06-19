# Phase 165: unknown-unknowns-blindspot-engine - Research

**Researched:** 2026-06-19
**Domain:** Deterministic blind-spot discovery engine (Horvitz/Lakkaraju DSP + UCB bandit port) over the room's confident-claim corpus, wired through the Part-9 navigation chokepoint and the Larry-Reaches connector spine.
**Confidence:** HIGH (every reuse anchor verified at file:line against current main; the reference port equations confirmed; the discretion items resolved within the LOCKED decisions).

---

<user_constraints>
## User Constraints (from 165-CONTEXT.md)

### Locked Decisions (D-165-01 .. D-165-10) -- DO NOT re-litigate
- **D-165-01 Hybrid oracle.** Two-tier: a CHEAP PROXY oracle labels every probed instance and writes findings as `review_status: proposed`; a small per-session HUMAN-confirm budget at the F.1 gate promotes the top-N to `confirmed` (Part 9 role 5). The bandit updates arm rewards on the PROXY signal continuously. Proxy = weighted blend of (a) contradiction density, (b) evidence-tier-vs-confidence mismatch, (c) staleness. All LOCAL, no Brain, no web. (Researcher finalizes weights/scalars -- see section 2 below.)
- **D-165-02 Ship FULL DSP + UCB bandit in v1.** Pattern-miner + DSP partition + UCB-with-custom-discount bandit, complete-to-spec (D-163-06 precedent). The bandit ranks WHICH partition to surface first.
- **D-165-03 Corpus = `confirmed` + Academic/Operational tier only.** The hunt space is genuinely-held, well-evidenced beliefs. (Reconciliation: the corpus is `EvidenceClaim` + `claim`/`CausalClaim` truth-claim nodes filtered on `review_status='confirmed'` AND `evidence_tier IN ('Academic','Operational')` -- see section 3; the tier lives on the `EvidenceClaim` node, NOT on `writeClaimNode`'s output.)
- **D-165-04 Room-local v1; cross-room deferred.** Active room only. (Mirrors 164 synthetic-expert ROOM-LOCAL precedent.)
- **D-165-05 Meetings are the oracle.** Not a new sensor -- a condition on two shipped ones. RESOLVE rides SENS-06's `contradiction` branch; RE-SCAN rides SENS-08 memory-cortex (stale governing-thought). Hash-delta + `SIGNAL_FRESHNESS_MS` gated.
- **D-165-06 Auto-fire at the next F.1 gate** (Larry reacts unprompted; Part 10 variable-reward), freshness-gated.
- **D-165-07 Wire `/mos:file-meeting` onto the connector spine** (currently an orphan -- confirmed). IN SCOPE.
- **D-165-08 FROZEN edges only:** `INVALIDATES`, `ROOT_CAUSES`, `ENABLES`, `FEEDS_INTO`. NO canon amendment (remap discipline, mirroring the issue-tree's INVALIDATED->INVALIDATES / RESOLVES_VIA->ROOT_CAUSES).
- **D-165-09 NO `Math.random` anywhere.** Arm + instance selection are index-deterministic; build (Workflow) and runtime scan resumable; bandit checkpoints per pull.
- **D-165-10 Pattern-mining LOCAL-only; ZERO Brain egress (Part 8).** Brain READ-ONLY for generic methodology handles only. All graph writes through `navigation.cjs`.

### Claude's Discretion (finalized in this research)
- Proxy-signal weights, DSP `lambda` weights, gamma cost-tradeoff defaults, per-session human-confirm budget size -- tuned at plan-phase, surfaced as config. **Recommended defaults in sections 2, 6.**
- The real `interPartition*Distance` computation (stubbed `return 1.0` in the reference) -- the port must implement it. **Specified in section 1.4.**

### Deferred Ideas (OUT OF SCOPE)
- Cross-room blindspot scan (Part-8-gated amendment).
- Live per-instance human oracle stream (richer interactive oracle).
- New edge types for blindspot semantics (only if the frozen set proves insufficient -- it does not; see D-165-08).
</user_constraints>

---

<phase_requirements>
## Phase Requirements (D-165 mapped to research support)

| D-ID | Requirement | Research Support |
|------|-------------|------------------|
| D-165-01 | Hybrid proxy + small human budget | Section 2: concrete LOCAL scalars + readers + recommended weights; Part-9 human gate via `navigation.confirmNode` (verified `lib/core/navigation.cjs:287`) |
| D-165-02 | FULL DSP + UCB bandit | Section 1: class roster, equations, the 6 port changes; deterministic substitution for the banned `Math.random` sampler |
| D-165-03 | `confirmed` + Academic/Operational corpus | Section 3: the reader idiom (`json_extract(properties,'$.evidence_tier')` + `review_status='confirmed'`); the `insights.cjs` reader precedents |
| D-165-04 | Room-local | Section 3: scan the active room.db only; rollup is OPT-IN (section 5) |
| D-165-05 | SENS-06 + SENS-08 trigger | Section 4: SENS-06 `sensorArtifactFiled` (`insight-sensors.cjs:317`), SENS-08 `sensorMemoryCortex` (`sensors/sensor-memory-cortex.cjs:81`), `SIGNAL_FRESHNESS_MS` (`insight-sensors.cjs:124`) |
| D-165-06 | Auto-fire at F.1 | Section 7: connector `sensor_triggers` + the f-selector-ranker rank-in (`lib/workflow/f-selector-ranker.cjs`) |
| D-165-07 | Wire file-meeting | Section 7: the connector block to add (rides an EXISTING reach, no 7th) |
| D-165-08 | Frozen edges + remap | Section 5: the edge-remap table mirroring `lib/core/issue-tree.cjs:49-62`; `writeIssueTreeEdges` chokepoint pattern (`issue-tree.cjs:242`) |
| D-165-09 | No Math.random; resumable | Section 1.2/1.3: index-deterministic arm + instance selection + per-pull checkpoint shape |
| D-165-10 | LOCAL-only, Part 8 | Section 8: Brain-touching paths flagged; all writes via `navigation.writeEdge`/`writeClaimNode` |
</phase_requirements>

---

## Summary

Phase 165 ports the Lakkaraju/Kamar/Caruana/Horvitz unknown-unknowns discovery algorithm (DSP partition + UCB-with-custom-discount bandit) into a deterministic, resumable, LOCAL-only blind-spot hunter over the room's confident-claim corpus. The five Horvitz components (`PatternMiner`, `DescriptiveSpacePartitioning`, `BanditForUnknownUnknowns`, `UnknownUnknownsOrchestrator`, plus the already-shipped `KnownsUnknownsMatrix` = `/mos:map-unknowns`) port verbatim in their MATH and change in exactly six ways the reference README names: the recast (model=belief, confidence=evidence-tier, oracle=proxy+human), no `Math.random` (index-deterministic sampling), a resumable per-pull checkpoint, the REAL `interPartitionDistance` (the reference stubs `return 1.0`), HSI as arm-priority, and typed-edge output through the `navigation.cjs` chokepoint.

**The critical reconciliation surfaced by this research:** `writeClaimNode` (Phase 150.8, `lib/core/navigation/typed-claim.cjs`) does NOT carry an `evidence_tier` field -- it carries `knowledge_type` and a hardcoded `confidence: 1.0`. The Part-5 evidence tier lives on the separate `EvidenceClaim` node (`lib/core/navigation/evidence-claim.cjs:48`, the four-tier `Academic|Operational|Practitioner|None` set) and on graded claims. So the D-165-03 corpus query is "truth-claim nodes (`claim`/`CausalClaim`/`EvidenceClaim`) with `review_status='confirmed'` AND a Part-5 tier of Academic or Operational", read via the `json_extract(properties,'$.evidence_tier')` idiom that `insights.cjs:226-232` already uses for opportunities. The planner must NOT assume `writeClaimNode` is the tier source.

Both sibling phases shipped TODAY (2026-06-19) and the reuse picture is now cleaner than when 165-CONTEXT was written: **164** shipped the issue-tree as a `sub_mode` of `/mos:diagnose` (NOT a standalone command), so the UU quadrant's "why is it wrong" consumer is `/mos:diagnose --issue-tree` already on the spine; **169** shipped `graph-derivation.cjs` (`runDerivation` + `candidateToFinding` + the recursive `rollupSubRooms` + `NESTED_WITHIN`), which is the canonical "write a critique-passed candidate as a PROPOSED truth-claim node + frozen cascade edge through the chokepoint" pattern -- 165's proxy-oracle finding-writer should clone `candidateToFinding` rather than roll its own. The canon is now **v1.13 / Appendix D entry 24**; 165 mints NO edge type (D-165-08 remap-only) and all four target edges are confirmed frozen.

**Primary recommendation:** Clone the `lib/core/issue-tree.cjs` deterministic-engine + edge-remap shape (NOT the futures orchestrator's async I/O shell) for the pure DSP/bandit math, clone `graph-derivation.cjs candidateToFinding` for the PROPOSED-node finding-writer, read the corpus through the `insights.cjs` reader idioms, attach the trigger to the two shipped sensors, and rank engine output into F.1 via `lib/workflow/f-selector-ranker.cjs`. Build under the harness-as-code 9-property ladder.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Confident-claim corpus query | Database / Storage (room.db via navigation.cjs) | -- | D-165-03/04: pure SQL read over the LOCAL room.db; the `insights.cjs` reader idiom; never Brain |
| Pattern-mine / DSP partition / UCB bandit | API / Backend (pure CJS `lib/core/unknowns/*.cjs`) | -- | D-165-02/09: deterministic, zero-I/O math; mirrors `issue-tree.cjs` purity |
| Proxy oracle (label every probed instance) | API / Backend (LOCAL scalars) | Database (reads claim props/edges) | D-165-01: cheap automated labels from contradiction density + tier/confidence mismatch + staleness |
| Human-confirm gate (top-N -> confirmed) | Frontend Server (F.1 Decision Gate / AskUserQuestion) | API (`navigation.confirmNode`) | D-165-01 + Part 9 role 5: only a human byUser promotes a truth-claim node |
| Finding write (PROPOSED node + frozen edge) | Database / Storage (navigation.cjs chokepoint) | -- | D-165-08/10: `writeClaimNode` + `writeEdge`, never raw SQL |
| Trigger (RESOLVE / RE-SCAN) | API / Backend (insight-sensors.cjs) | -- | D-165-05: a condition on SENS-06 + SENS-08, hash-delta + freshness gated |
| Rank-in to the selector | Frontend Server (f-selector-ranker -> F.1) | -- | D-165-06: engine output becomes a scored candidate reach, never auto-commits |
| 2x2 quadrant -> pipeline routing | API / Backend (rumsfeld-matrix.cjs) | -- | Each quadrant dispatches a different downstream reach |

---

## Standard Stack

This is a pure-internal CJS engine. **Zero new npm dependencies** (CLAUDE.md HARD RULE: pure-JS/CJS, no new deps, no `Math.random`, three-surface, no em-dashes). The "stack" is the existing shipped modules to clone/reuse.

### Core (clone / reuse -- verified at file:line on current main)
| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| Issue-tree engine | `lib/core/issue-tree.cjs` (269 lines) | The TEMPLATE for the deterministic engine: pure functions, module-load frozen-edge self-check (`:67`), `writeIssueTreeEdges` chokepoint (`:242`), edge-remap table (`:49-62`), explicit "ZERO `Math.random`, zero `Date.now`" doctrine (`:23-25`) | Sibling phase (164), exact same division-of-labour + edge-remap + determinism posture 165 needs |
| Graph-derivation composer | `lib/core/graph-derivation.cjs` (18,974 bytes) | `candidateToFinding(candidate)` (`:95`) + `runDerivation` (`:154`): the canonical "critique-passed candidate -> PROPOSED truth-claim node (`writeClaimNode`) + frozen cascade edge (`writeEdge`)" writer; `rollupSubRooms` (`:26`) recursive NESTED_WITHIN walk; `_candidateHash` (`:79`) stable sha256 id so a re-run does not re-mint | Shipped 169 TODAY; the proxy-oracle finding-writer should clone this, NOT roll its own |
| Navigation chokepoint | `lib/core/navigation.cjs` (427 lines) | `writeClaimNode` (`:177`), `writeEdge` (`:114`), `confirmNode` (`:287`), `logMemoryEvent`, `promoteNodeStatus` (`:94`) | Part-9 single door; ALL graph writes route here (D-165-10) |
| Claim corpus readers | `lib/core/navigation/insights.cjs` | `findUnsupportedClaims` (`:68`), `findStaleClaims` (`:146`), `findRelevantOpportunities` (`:208`, the `json_extract(properties,'$.field')` idiom `:226-232`) | The reader patterns for enumerating typed nodes by `type` + `review_status` + JSON props -- the corpus-adapter clones these SELECTs |
| Insight sensors | `lib/core/insight-sensors.cjs` (451 lines) | SENS-06 `sensorArtifactFiled` (`:317`, reach `contradiction`/`cross_room`), `SIGNAL_FRESHNESS_MS = 30*60*1000` (`:124`), `isFreshFile` (`:135`), `dispatchSensors` (`:392`), `SENSOR_REGISTRY` (`:360`) | D-165-05 trigger attaches here (no new sensor) |
| SENS-08 memory-cortex | `lib/core/sensors/sensor-memory-cortex.cjs` (112 lines) | `sensorMemoryCortex` (`:81`) reads `ctx.staleGoverningThought` + `ctx.freshContradictions` scalars, fires reach `cross_room` | D-165-05 RE-SCAN branch (stale governing-thought) |
| Reach struct + frozen banks | `lib/core/sensors/sensor-types.cjs` (127 lines) | `REACH_IDS` (6, frozen `:43`), `POSTURE_IDS` (3, frozen `:54`), `makeReach` (`:80`) | The closed reach bank a 165 sensor-condition must use (NO 7th reach) |
| Frozen edge set | `lib/core/navigation/edges.cjs` | `ALLOWED_EDGE_TYPES` (`:32`); `INVALIDATES` (`:405`), `ROOT_CAUSES` (`:320`), `ENABLES` (`:409`), `FEEDS_INTO` (`:242`) all confirmed members | Proves D-165-08's four edges are in-set; NO amendment needed |
| FEEDS_INTO chain precedent | `lib/core/rs-chain-feeder.cjs` (Phase 89.4) | `lookupUpstream`/`emitChainMetadata` chain-topology codification | The FEEDS_INTO declaration precedent (NOTE: it READS Brain for topology -- see section 8) |
| F.1 rank-in | `lib/workflow/f-selector-ranker.cjs` (Phase 125) | Where a candidate reach scores into the F.1 selector | D-165-06 auto-fire ranks here |
| Connector generator | `scripts/build-connector-registry.cjs` (27,388 bytes) | Regenerates `data/connector-registry.json` from `connector:` frontmatter | NEVER hand-edit the registry; regen after the file-meeting + map-unknowns frontmatter changes |
| Connector contract | `docs/CONNECTOR-CONTRACT.md` | The `connector:` frontmatter schema (all keys) | The schema the file-meeting + map-unknowns blocks must conform to |

### Supporting (engine modules to BUILD -- per the scoping doc P1 ladder)
| Module | Path (proposed) | Purpose |
|--------|------|---------|
| pattern-miner | `lib/core/unknowns/pattern-miner.cjs` | Support-bounded descriptive patterns over claim features (quartile numeric, `=` categorical, AND-combine to maxPatternLength) |
| dsp | `lib/core/unknowns/dsp.cjs` | DSP Algorithm 1: greedy set-cover partition maximizing the goodness function (with the REAL inter-partition distance) |
| bandit | `lib/core/unknowns/bandit.cjs` | UCB-with-custom-discount Algorithm 2; index-deterministic arm + instance selection; per-pull checkpoint |
| rumsfeld-matrix | `lib/core/unknowns/rumsfeld-matrix.cjs` | 2x2 categorize + quadrant->pipeline routing table |
| corpus-adapter | `lib/core/unknowns/corpus-adapter.cjs` | THE recast: reads the confident-claim corpus, extracts instance features, owns the proxy oracle |
| orchestrator | `lib/core/unknowns/orchestrator.cjs` | The pipeline: corpus -> mine -> DSP -> bandit(budget) -> analyze -> rank-in (clone the issue-tree single-build discipline, NOT the futures async shell) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloning `issue-tree.cjs` (deterministic single-build) | Cloning `lib/core/futures/orchestrator.cjs` (the CONTEXT-named template) | The futures orchestrator is a 56KB ASYNC I/O shell (HSI scans, RS reverse-salient, signal research -- `runHsiScan:470`, `runRingGate:859`). The DSP/bandit math is PURE and deterministic. The issue-tree's pure-build + frozen-edge-self-check + `writeIssueTreeEdges` shape is the closer fit for the math core. Use the futures orchestrator ONLY as the stage-sequencing reference for the outer `orchestrator.cjs`; clone issue-tree for the engine bodies. |
| Cloning `graph-derivation.cjs candidateToFinding` for finding-write | Cloning `lib/core/findings-wirer.cjs` (Phase 131) | `findings-wirer` is the RESEARCH-finding ACCEPT/REJECT/DEFER gate wirer (writes `EvidenceClaim` + INFORMS/CONTRADICTS/SUPERSEDES). It is a valid alternative for the human-gate ACCEPT path, but `candidateToFinding` is the closer fit for the proxy-oracle "candidate -> proposed claim + cascade edge" auto-label step. Use BOTH: `candidateToFinding` for proxy proposals; `findings-wirer.wireAccept`-style for the human-confirm promotion if a research-style finding is attached. |

**Installation:** None. `npm install` adds nothing. The engine is `lib/core/unknowns/*.cjs` + a `tests/run-all-165.sh` aggregator (mirror `tests/run-all-164.sh` / `tests/run-all-169.sh`).

**Version verification:** N/A -- zero external packages. Node `>=18` CJS, consistent with the shipped `lib/core/*.cjs` convention.

## Package Legitimacy Audit

> Not applicable. Phase 165 installs ZERO external packages (CLAUDE.md: no new deps; pure-JS/CJS). All code is internal `lib/core/unknowns/*.cjs` cloned from shipped siblings. No registry surface, no slopcheck target.

---

## 1. THE REFERENCE PORT (D-165-02 / D-165-09)

Source: `.planning/research/reference/unknown-unknowns-horvitz/README.md` (the only file in the reference dir -- the full JS source lives in the 2026-06-18 session transcript; the README is the durable algorithm contract). Paper: Lakkaraju, Kamar, Caruana, Horvitz (AAAI 2017, "Identifying Unknown Unknowns in the Open World"). `[CITED: reference/unknown-unknowns-horvitz/README.md]`

### 1.1 Class roster + public contract (preserved verbatim from the README)

| Class | Constructor / key params | Public methods | Role |
|-------|--------------------------|----------------|------|
| `KnownsUnknownsMatrix` | -- | `categorizeItem(item, awareness, knowledge)` -> KK/KU/UK/UU; `getMatrixSummary()`; `exportMatrix()` | The Rumsfeld 2x2 front-of-house = SHIPPED `/mos:map-unknowns`. Port = `rumsfeld-matrix.cjs` (adds quadrant->pipeline routing). |
| `PatternMiner` | `minSupport=0.1, maxPatternLength=3` | `minePatterns(instances, features)` -> `[{conditions:[{feature,operator,value}]}]` | Support-bounded descriptive patterns. Numeric features -> quartile `<=`/`>=` patterns; categorical -> `=`; AND-combines up to `maxPatternLength`. |
| `DescriptiveSpacePartitioning` (DSP, Algorithm 1) | `weights={lambda1..5}` | `partition(instances, confidenceScores, patterns)` -> `[{pattern, instances, centroid, meanConfidence}]` | Greedy set-cover: pick the pattern maximizing `coveredUncovered.size / goodness` until the space is covered. |
| `BanditForUnknownUnknowns` (UUB, Algorithm 2) | `gamma=0.2` | `initialize(partitions)`; `selectNextInstance(oracleFn, budget)` -> pull records `{time,arm,instance,utility,isUnknownUnknown,cumulativeUtility}` | UCB + custom discounting. First K steps: try each arm once; then UCB-with-discount arm selection. |
| `UnknownUnknownsOrchestrator` | `config` (see below) | `discoverUnknownUnknowns(data, modelPredictions, oracleFn)` | The pipeline: `createSearchSpace(conf>=confidenceThreshold)` -> `extractFeatures` -> `minePatterns` -> `dsp.partition` -> `bandit.initialize` -> `bandit.selectNextInstance(budget=floor(N*budget))` -> `analyzeDiscoveries` -> `generateRecommendations`. |

Reference config (defaults to carry into 165 config, tunable per D-165 discretion): `confidenceThreshold=0.65, budget=0.2, gamma=0.2, dspWeights={l1..4:1, l5:0.1}, minSupport=0.1, maxPatternLength=3`. Recommendations enum: `HIGH_RISK_PATTERN` (discoveryRate>0.5 & >2 found) / `MODEL_CONFIDENCE` (<0.1) / `EXPLORATION_NEEDED` (unexplored & >5).

### 1.2 The equations (preserved)
- **Utility (Eq.1):** `u = 1[isUnknownUnknown] - gamma*cost`
- **Goodness (Eq.2):** `lambda1*g1 - lambda2*g2 + lambda3*g3 - lambda4*g4 + lambda5*g5`, where `g1` = intra-partition feature distance, `g2` = inter-partition feature distance, `g3` = intra-partition confidence distance, `g4` = inter-partition confidence distance, `g5` = pattern length.
- **Discount (Eq.3, the custom discounting):** `currentArmSize / sizeAtPull`
- **UCB bound:** `sqrt(2*ln(sum effective counts) / N_t)`

### 1.3 The SIX things the port MUST change (the README names them; D-165-02/09/10)

1. **The recast (load-bearing).** `data/predictions` -> the room's `confirmed` claim corpus; `confidence` -> Part-5 evidence tier; `oracleFn` -> proxy oracle | human-confirm | `/mos:validate` | MVP. There is NO trained classifier. `corpus-adapter.cjs` owns this.
2. **No `Math.random`.** The reference `selectNextInstance` samples `Math.floor(Math.random()*len)` -- BANNED (CLAUDE.md + D-165-09). Replace with index-deterministic sampling (section 1.5).
3. **Resumable bandit.** Checkpoint per pull (arm state + remaining instances) so a scan killed mid-meeting-analysis resumes from the last arm (section 1.6).
4. **`interPartition*Distance` are stubbed `return 1.0`** -- the port must compute the REAL distance (section 1.4 -- this research's primary deliverable for the discretion item).
5. **HSI as arm-priority.** Wire HSI cross-domain surprise as the bandit's arm-selection priority (highest-surprise region probed first), per the scoping chain topology. (HSI scalars come from the shipped `scripts/hsi-*` / `compute-bayesian-surprise` diagnostics surface; READ as a per-partition scalar, never re-run inside the bandit's tight loop.)
6. **Output -> typed edges via `navigation.cjs`**, frozen vocab only (`INVALIDATES`/`ROOT_CAUSES`/`ENABLES`/`FEEDS_INTO`), LOCAL-only, zero Brain egress (Part 8). Clone the `issue-tree.cjs writeIssueTreeEdges` chokepoint pattern.

### 1.4 The REAL `interPartitionDistance` (discretion item -- RESOLVED) `[VERIFIED: reference README + edges.cjs + insights.cjs]`

The reference stubs both inter-partition terms (`g2` inter-partition FEATURE distance, `g4` inter-partition CONFIDENCE distance) as `return 1.0`, which makes the goodness function fail to discriminate (every candidate partition looks equally separated, so DSP degenerates to pure set-cover by size). The port must implement BOTH against sibling partition centroids, using ONLY LOCAL scalars.

**Each DSP partition carries a `centroid` (a feature vector) and a `meanConfidence` (a scalar in [0,1]).** Define the feature vector over the instance-feature schema from the recast (the shared IFACE):

```
instance := { claimId, section, domain, evidenceTier, confidence, governingHash, ageDays }
```

**`interPartitionFeatureDistance(P_i, partitions)` (replaces g2's stub `1.0`):**
The mean pairwise distance from `P_i.centroid` to every sibling centroid `P_j.centroid (j != i)`, where the per-feature distance is:
- NUMERIC features (`confidence`, `ageDays`, and the quartile-bucketed `evidenceTier` mapped Academic=4/Operational=3/Practitioner=2/None=1): normalized absolute difference `|a-b| / range`, where `range` is the corpus max-min of that feature (computed once over the corpus, so the metric is scale-free and deterministic).
- CATEGORICAL features (`section`, `domain`): Hamming / mismatch distance (0 if equal, 1 if different), since `section`/`domain` are enum-like handles (Part 8: enum handles, never prose).
- Aggregate: the unweighted mean across the feature dimensions, then the mean across siblings. Returns a scalar in [0,1].

**`interPartitionConfidenceDistance(P_i, partitions)` (replaces g4's stub `1.0`):**
The mean `|P_i.meanConfidence - P_j.meanConfidence|` across siblings `j != i` -- a scalar in [0,1] (confidence already lives in [0,1] so no normalization needed).

**Determinism (D-165-09):** both functions are pure over the partition set (no `Math.random`, no `Date.now`). Iterate siblings in stable id-sorted order so floating-point summation order is fixed and a re-run is byte-identical. When there is exactly ONE partition (no siblings), return `0.0` (a lone partition has zero inter-partition separation -- this is the correct edge value, NOT the stub `1.0`, and it makes the goodness penalty `-lambda2*g2` vanish, which is right).

**Why this matters:** with the stub, the DSP goodness function reduces to `lambda1*g1 + lambda3*g3 + lambda5*g5 - (constants)`, so the inter-partition SEPARATION (the whole point of "interpretable, well-separated regions") is invisible. The real metric makes well-separated high-confidence regions score higher, which is exactly where over-confidence (and thus blind spots) concentrates.

### 1.5 Index-deterministic sampling (replaces the banned `Math.random`; D-165-09) `[VERIFIED: CLAUDE.md HARD RULE + issue-tree.cjs:23]`

The reference's two random draws are (a) the first-K "try each arm once" arm order and (b) the within-arm instance pick. Replace BOTH with index-deterministic selection over stable-sorted collections:

- **Arm order (first K pulls):** iterate partitions in a stable deterministic order. Recommended: descending HSI arm-priority (port-change #5), ties broken by ascending partition id (the partition's stable pattern hash). This makes "try each arm once" the HSI-priority sweep the scoping doc wants.
- **Within-arm instance pick:** pick the next UNPROBED instance in a stable order. Recommended: ascending `claimId` (the `claim:`/`EvidenceClaim:` node id, already a stable hash), so the pick is reproducible and resumable. A secondary key of descending proxy-signal (probe the most-suspicious instance in the arm first) is acceptable and arguably better-targeted -- planner's discretion, but it MUST be a deterministic total order.
- **No reservoir sampling, no shuffling.** The reference's `Math.floor(Math.random()*len)` is replaced by a cursor into a sorted array.

This mirrors the issue-tree engine's explicit "Zero Math.random, zero Date.now in the build path (deterministic; any timestamp is caller-injected)" doctrine (`lib/core/issue-tree.cjs:23-25`). Confirmed `grep -c "Math.random" lib/core/futures/orchestrator.cjs` returns `0` -- the futures template is already clean, the precedent holds.

### 1.6 Resumable per-pull checkpoint (D-165-09)

The bandit state to checkpoint after each pull (a LOCAL JSON sidecar under `<roomDir>/.mindrian/`, mirroring the `last-cascade.json` side-channel idiom at `insight-sensors.cjs:324`):

```
checkpoint := {
  scanId,                       // stable id over (roomDir, corpusHash) so a re-scan of the same corpus resumes
  corpusHash,                   // sha256 over the sorted confident-claim node ids (detect a dirty corpus)
  pull,                         // monotone pull counter
  budget,                       // floor(N * budget) -- the bounded probe budget
  arms: [{ partitionId, effectiveCount, discountedMean, currentArmSize, sizeAtPull, probedInstanceIds: [...] }],
  cumulativeUtility,
  done: bool
}
```

On resume: if `corpusHash` matches, continue from `pull`; if it differs (the corpus went dirty -- a new meeting filed claims), START A FRESH scan (the freshness gate at section 4 already prevents thrash). `scanId` keys the checkpoint so a `Workflow({scriptPath, resumeFromRunId})` build re-run is a cache hit. No `Date.now` in the checkpoint key (deterministic).

---

## 2. PROXY-SIGNAL COMPOSITION (D-165-01 -- discretion item RESOLVED) `[VERIFIED: insights.cjs, edges.cjs, evidence-claim.cjs, sensor-memory-cortex.cjs]`

The proxy oracle labels every probed instance `isUnknownUnknown ∈ {0,1}` cheaply (no human, no Brain, no web). The recommended proxy = a weighted blend of three LOCAL scalars, thresholded. All three read directly off the room.db through `navigation.cjs` readers; NONE touch Brain (D-165-10).

### 2.1 The three LOCAL scalars, with exact source

**(a) Contradiction density** -- incident `CONTRADICTS` / `INVALIDATES` edges on the claim node.
- READ: count edges where `target = claimId` (or `source = claimId`) AND `edge_type IN ('CONTRADICTS','INVALIDATES')`. The edge table is queried via the same `db.prepare("SELECT ... FROM edges WHERE ...")` idiom `insights.cjs:76` uses (`NOT EXISTS (SELECT 1 FROM edges e WHERE e.target = n.id AND e.type = 'SUPPORTS')`). `CONTRADICTS` is frozen (`edges.cjs:153`), `INVALIDATES` is frozen (`edges.cjs:405`, brought into the chokepoint by Phase 168).
- SCALAR: `contradictionDensity = (count of incident CONTRADICTS|INVALIDATES) / (1 + total incident edges)` -- normalized to [0,1). A confirmed claim with contradicting edges against it is the loudest blind-spot signal.

**(b) Evidence-tier-vs-confidence mismatch** -- high held-confidence on a thin evidence tier.
- READ: the claim's `confidence` column + its Part-5 `evidence_tier`. **CRITICAL (reconciliation):** `confidence` is a real `nodes` column (`writeClaimNode` hardcodes `1.0` at `typed-claim.cjs:133`; `writeEvidenceClaim` sets it NULL; graded claims carry a real value). `evidence_tier` lives INSIDE `properties` JSON on `EvidenceClaim` nodes (`evidence-claim.cjs:86`), read via `json_extract(properties,'$.evidence_tier')` (the `insights.cjs:228` idiom). Map tier to a numeric floor: Academic=1.0, Operational=0.75, Practitioner=0.4, None=0.1.
- SCALAR: `tierMismatch = max(0, confidence - tierFloor(evidence_tier))` -- in [0,1]. A claim held at confidence 1.0 on a None/Practitioner tier is a high mismatch. (NOTE: D-165-03 restricts the CORPUS to Academic/Operational, so within-corpus mismatch is bounded; this signal still discriminates Operational-with-confidence-1.0 from Academic-with-confidence-1.0, and it is the live signal if the corpus filter is later relaxed.)

**(c) Staleness** -- governing-thought hash age.
- READ: the governing-thought hash staleness is ALREADY computed by the shipped memory-cortex / brain-md-staleness path. SENS-08 (`sensor-memory-cortex.cjs:53`) reads a derived boolean `ctx.staleGoverningThought`; the underlying scalar is the governing-thought hash age (the `governing_thought_hash` auto-invalidation Phase 90 shipped, surfaced via `lib/core/brain-md-staleness.cjs` + `lib/core/navigation/memory-cortex-packet.cjs`). For a PER-CLAIM staleness, use the claim node's `last_modified_at` write-time stamp (Phase 160-04, the field `findStaleClaims` keys on at `insights.cjs:170,175`) against the `SIGNAL_FRESHNESS_MS`-style window.
- SCALAR: `staleness = clamp01((nowRef - last_modified_at) / STALE_WINDOW_MS)` where `STALE_WINDOW_MS` defaults to the `findStaleClaims` 30-day window (`insights.cjs:144 DEFAULT_STALE_WINDOW_DAYS=30`). Use the injected `opts.now` seam (`insights.cjs:151`) so it is deterministic in tests (NOT a raw `Date.now` in the math path).

### 2.2 Recommended default weighting (config-surfaced, tunable per discretion)

```
proxyScore = w_contra * contradictionDensity
           + w_mismatch * tierMismatch
           + w_stale * staleness

defaults: w_contra = 0.5, w_mismatch = 0.3, w_stale = 0.2
isUnknownUnknown = (proxyScore >= PROXY_THRESHOLD)   // PROXY_THRESHOLD default 0.5
```

**Rationale for the weighting:** contradiction density is the strongest signal (a confirmed claim with an active CONTRADICTS edge is a blind spot already half-surfaced by the cascade), so it leads at 0.5. Tier/confidence mismatch is the Horvitz-native "confident-but-thin" signal at 0.3. Staleness is the weakest standalone signal (a stale-but-uncontested claim may just be settled) at 0.2, but it is the RE-SCAN trigger's native dimension so it stays in the blend. All weights + the threshold land in the engine config block alongside `confidenceThreshold`, `budget`, `gamma`, `dspWeights`.

**Cost term (Eq.1):** the proxy oracle's `cost` is constant and cheap (it is automated). Recommend `cost = PROXY_COST` default `0.0` for proxy-tier pulls (so `utility = isUnknownUnknown - gamma*0 = isUnknownUnknown` for proxy labels) and reserve a non-zero `cost` for the HUMAN tier (where a confirm spends the scarce budget). This makes the bandit free to probe widely on the proxy and the gamma cost-tradeoff bite only at the human gate.

### 2.3 The human tier (D-165-01 + Part 9 role 5)

The proxy labels write findings as `review_status: proposed` (clone `graph-derivation.cjs candidateToFinding` -> `writeClaimNode`). The top-N proxy-ranked candidates surface at the F.1 gate; the navigator APPROVE promotes via `navigation.confirmNode` (`navigation.cjs:287` -- the single human-confirm door; an agent-attributed confirm is REJECTED). **Recommended per-session human-confirm budget: 3** (mirrors `MAX_K=3` top-of-selector discipline -- the navigator sees at most 3 "here's where I bet you're wrong" candidates per gate, so it is a nudge not a dump). Config key `humanConfirmBudget` default `3`.

---

## 3. THE CONFIDENT-CLAIM CORPUS (D-165-03 -- query RESOLVED) `[VERIFIED: typed-claim.cjs, evidence-claim.cjs, insights.cjs]`

### 3.1 The reconciliation the planner MUST know

`writeClaimNode` (`lib/core/navigation/typed-claim.cjs:79`) writes `type='claim'`, `review_status='proposed'`, `confidence=1.0` (hardcoded `:133`), and a `properties` JSON carrying `knowledge_type` (fact/causal/heuristic/anomaly_cue/mental_model/assumption -- the `KNOWLEDGE_TYPES` set `:48`), `conditions`, `valid_from/until`, `source_speaker/segment`. **It does NOT write `evidence_tier`.** The Part-5 evidence tier (`Academic|Operational|Practitioner|None`, the `EVIDENCE_TIERS` set at `evidence-claim.cjs:48`) lives on the separate `EvidenceClaim` node `properties` (`evidence-claim.cjs:86`) and on GRADE-derived claim tiers.

So "confident-claim corpus = confirmed + Academic/Operational" resolves to a UNION over the truth-claim node types that carry a Part-5 tier, filtered on status + tier:

```sql
-- The corpus query (clone the insights.cjs reader idiom; LOCAL room.db only)
SELECT n.id, n.type, n.confidence, n.source_path, n.last_modified_at,
       json_extract(n.properties, '$.evidence_tier') AS evidence_tier,
       json_extract(n.properties, '$.knowledge_type') AS knowledge_type
FROM nodes n
WHERE n.type IN ('EvidenceClaim','claim','CausalClaim')
  AND n.review_status = 'confirmed'
  AND json_extract(n.properties, '$.evidence_tier') IN ('Academic','Operational')
```

- For `EvidenceClaim` the `evidence_tier` is always present (validated on write).
- For `claim`/`CausalClaim` minted by `writeClaimNode`, `evidence_tier` is ABSENT unless a GRADE pass added it; those rows fall out of the `IN ('Academic','Operational')` filter automatically (a missing `json_extract` returns NULL). This is CORRECT per D-165-03: an ungraded `confirmed` claim has no evidence tier, so it is not yet in the "well-evidenced belief" hunt space. The planner should document this so the corpus is understood as "graded-confirmed", not "all confirmed".

### 3.2 The reader function to add (corpus-adapter)

Add `findConfidentClaims(db, opts)` to the corpus-adapter (or as a new `insights.cjs` reader, mirroring `findStaleClaims:146` / `findUnsupportedClaims:68`): run the query above, return `[{ id, type, confidence, evidenceTier, knowledgeType, section, domain, lastModifiedAt }]`. Derive `section`/`domain` from `source_path` + any `PART_OF`/`TAGGED_WITH` domain edges (Phase 163 frozen) -- enum handles only (Part 8). This is the `createSearchSpace` input.

### 3.3 None/Practitioner are NOT double-counted (D-165-03)

Per CONTEXT, None/Practitioner-tier claims near a commit stage are already flagged by the Part-5 near-commit rule (canon Part 5: "a room full of None-tier claims near a commit stage is a flag the proactive loop must surface"). 165 does NOT re-flag them; the corpus filter excludes them by construction.

---

## 4. 164 + 169 RECONCILE (both shipped TODAY) `[VERIFIED: git log, diagnose.md, graph-derivation.cjs, MINDRIAN-CANON.md v1.13]`

### 4.1 164 reconcile -- the UU quadrant consumer is `/mos:diagnose --issue-tree`, NOT a new command

`git log` confirms 164 is COMPLETE on current main (`5186d8fa docs(164-06): ... Phase 164 COMPLETE`). 164 shipped:
- **The issue-tree as a `sub_mode` of `/mos:diagnose`** (NOT a standalone command). `commands/diagnose.md:27-39` carries `connector: { reach_id: context_block, sub_mode: problem-diagnosis, sub_modes: [problem-diagnosis, issue-tree], sensor_triggers: [SENS-01, SENS-06], posture: push_forward, filing: fileEvidenceWithReadback }`. The issue-tree mode "rides the SAME reach_id / framework / filing / posture" (`diagnose.md:21-26`), NO new reach_id minted.
- **The issue-tree ENGINE** at `lib/core/issue-tree.cjs` (the edge-remap + `writeIssueTreeEdges` chokepoint -- the template 165 clones).
- **The SyntheticExpert node type** (canon Appendix D entry 24, the v1.13 bump).
- **`/mos:bono`** on the frozen `hats` reach (the 6th reach, Phase 148).

**165 reconciliation:** the FEEDS_INTO chain-topology DOWN-targets (`challenge / issue-tree / validate-mvp / find-analogies / expert-fill`) must point at the NOW-SHIPPED surfaces:
- `issue-tree` -> `/mos:diagnose` `sub_mode: issue-tree` (reach `context_block`). **165 REUSES this as the UU-quadrant "why is it wrong" consumer; it does NOT re-implement the issue-tree.**
- `challenge` -> `/mos:challenge-assumptions` (the Devil's Advocate verb 5; Part 3).
- `expert-fill` -> `/mos:bono` White-hat / the SyntheticExpert path (164 GENESIS-TRANSLATION).
- `validate-mvp` -> `/mos:validate`.
- `find-analogies` -> `/mos:find-analogies` (Engine 1, `STRUCTURALLY_ISOMORPHIC` -- but NOTE that edge is NOT in the frozen set; the FEEDS_INTO chain edge is what 165 writes, the analogy edge is the consumer's concern).

So 165's downstream wiring is a set of `FEEDS_INTO` edges (the chain topology, frozen `edges.cjs:242`) from a UU finding node to these consumer surface handles -- it does NOT invoke them; it RANKS them into F.1 (D-165-06).

### 4.2 169 reconcile -- REUSE `graph-derivation.cjs` for the PROPOSED-node writer + the recursive rollup

`git log` confirms 169 is COMPLETE (`0ff8dfbd docs(169-06): ... phase 169 COMPLETE`). 169 shipped `lib/core/graph-derivation.cjs`:
- **`candidateToFinding(candidate)` (`:95`)** -- maps a critique-passed candidate to `{knowledge_type, text}` PROPOSED-node intent + the cascade edge intent (enum/scalar only, `:113` "Part 8: enum/scalar only").
- **`runDerivation({roomDir, runChain, selfCritiqueFn, deriveFn})` (`:154`)** -- only critique-PASSED candidates land as a PROPOSED truth-claim NODE via `navigation.writeClaimNode` (`:210-237` checks pre-state, never downgrades a `confirmed` node) + a frozen cascade edge via `navigation.writeEdge`. `_candidateHash` (`:79`, sha256) gives a stable id so a re-run does not re-mint.
- **`rollupSubRooms(parentRoomDir)` (`:26`)** -- walks the `NESTED_WITHIN` child links and ATTACHes each child's edges, RECURSIVELY (a sub-sub-room's edges reach the top-level).
- **The findings-wirer** (Phase 131 `lib/core/findings-wirer.cjs`) is the OLDER research-finding ACCEPT/REJECT/DEFER wirer (`writeEvidenceClaim` + INFORMS/CONTRADICTS/SUPERSEDES); 169's `candidateToFinding` is the newer, closer fit.

**165 reconciliation:**
- **The proxy-oracle proposal writer MUST clone `candidateToFinding` / `runDerivation`'s write step** (PROPOSED node via `writeClaimNode` + frozen edge via `writeEdge`, never roll its own raw SQL). This is the D-165-01 "writes findings as `review_status: proposed`" requirement -- 169 already built the canonical writer.
- **The corpus query CAN benefit from the recursive rollup (D-165-04 ROOM-LOCAL, so rollup is OPT-IN, NOT default).** D-165-04 locks v1 to the active room only. `rollupSubRooms` is available if the navigator later wants the hunt to span sub-rooms, but the v1 corpus query (section 3) reads ONLY the active room.db. Document the rollup as the deferred cross-room hook, NOT a v1 default (and cross-room aggregation of `NESTED_WITHIN` is forbidden per canon entry 23 -- it is a LOCAL room.db edge in the child's db).

### 4.3 Canon is v1.13 / Appendix D entry 24 -- 165 mints NO edge type (D-165-08)

`docs/MINDRIAN-CANON.md` header confirms **Version 1.13, 2026-06-19**, Appendix D entry 24 (SyntheticExpert, the 164 amendment). All four 165 target edges are confirmed FROZEN members of `ALLOWED_EDGE_TYPES` (`lib/core/navigation/edges.cjs`):
- `INVALIDATES` -- `:405` (Phase 168 reconciliation entry 22)
- `ROOT_CAUSES` -- `:320` (Phase 150.8 entry 18)
- `ENABLES` -- `:409` (Phase 168 entry 22)
- `FEEDS_INTO` -- `:242` (the artifact-lineage spine edge)

**165 is REMAP-ONLY (D-165-08): zero canon amendment, zero `edges.cjs` change, zero `tests/test-edges-*-floor.cjs` change.** Mirror the issue-tree's module-load self-check (`issue-tree.cjs:67`) so a remap that drifts out of the frozen set fails fast at require time.

---

## 5. THE EDGE REMAP + WRITE CHOKEPOINT (D-165-08) `[VERIFIED: issue-tree.cjs:49-265]`

165 follows the issue-tree's exact remap discipline (`lib/core/issue-tree.cjs:32-62`). The semantic-to-frozen mapping for the blind-spot engine:

| Engine emission (semantic) | Frozen edge | When |
|----------------------------|-------------|------|
| confident claim falsified (UU confirmed wrong on test) | `INVALIDATES` | a human-confirmed blind spot kills the claim |
| confirmed root cause of why-it-is-wrong | `ROOT_CAUSES` | the issue-tree leaf root cause (the consumer's emission; 165 may seed) |
| opportunity-bank seed from a confirmed correction | `ENABLES` | a corrected belief unblocks an opportunity (HSI-scored ADD) |
| chain topology (feeder -> engine -> consumer) | `FEEDS_INTO` | the up/down chain declaration (rs-chain-feeder precedent) |

**The write pattern (clone `issue-tree.cjs writeIssueTreeEdges:242`):** route EVERY emitted edge through `navigation.writeEdge(db, { source_id, target_id, edge_type, properties: { relation:'blind_spot', review_status:'proposed', ... } })`; return `{ written, rejected, results }`; a rejected edge (remap drift) is reported, never silently swallowed. PROPOSED nodes via `navigation.writeClaimNode`. Per Part 9, edges land PROPOSED; the human confirms via `confirmNode`.

**Module-load self-check (clone `issue-tree.cjs:67`):**
```js
const { ALLOWED_EDGE_TYPES } = require('./navigation/edges.cjs');
const EDGE_TYPES = Object.freeze({ INVALIDATES:'INVALIDATES', ROOT_CAUSES:'ROOT_CAUSES', ENABLES:'ENABLES', FEEDS_INTO:'FEEDS_INTO' });
for (const t of Object.values(EDGE_TYPES)) if (!ALLOWED_EDGE_TYPES.has(t)) throw new Error('edge ' + t + ' not frozen');
```

---

## 6. VERIFY THE REUSE ANCHORS (current main, file:line) -- DRIFT REPORT `[VERIFIED]`

| Anchor (CONTEXT claim) | Verified location | Status / drift |
|------------------------|-------------------|----------------|
| `lib/core/futures/orchestrator.cjs` (clone template) | EXISTS, 56,630 bytes, `module.exports:1285`, `Math.random` count = 0 | **DRIFT NOTE:** it is a heavy ASYNC I/O shell (`runHsiScan:470`, `runRingGate:859`, `runRSReverseSalient:1062`, `runSignalResearch:1156`), NOT a pure-math template. Use it for OUTER stage-sequencing reference only; clone `issue-tree.cjs` for the engine math bodies. The CONTEXT's "clone the futures orchestrator" is directionally right for the orchestrator stage shape but the pure DSP/bandit code should follow the issue-tree purity model. |
| `insight-sensors.cjs` SENS-06 (~L295 contradiction branch) | `sensorArtifactFiled` at `:317`; the contradiction branch (`isContradiction -> reach_id 'contradiction'`) at `:336-339`; comment block `:295` | CONFIRMED. The "~L295" pointer is the comment header; the function body is `:317-353`. Reach is `contradiction` (CONTRADICT finding) or `cross_room` (other). |
| SENS-08 (~L58 stale-governing) | `sensorMemoryCortex` in `lib/core/sensors/sensor-memory-cortex.cjs:81`; the `:58` pointer in `insight-sensors.cjs` is the REQUIRE comment (`:58-63`) | **DRIFT NOTE:** SENS-08 is NOT inline in insight-sensors.cjs at L58 -- it is REQUIRED there (`:63`) and DEFINED in `sensors/sensor-memory-cortex.cjs`. It reads DERIVED ctx scalars `ctx.staleGoverningThought` (bool) + `ctx.freshContradictions` (number), NOT a raw hash. The 165 RE-SCAN condition keys on these two ctx scalars. |
| `SIGNAL_FRESHNESS_MS` gate | `insight-sensors.cjs:124` (`30*60*1000`), `isFreshFile:135`, `deriveTurnSignals:164` | CONFIRMED. The hash-delta gate mirrors this freshness window (stat-before-parse, future-mtime guard `:139`). |
| `lib/core/navigation.cjs` corpus reader + write chokepoint | `writeClaimNode:177`, `writeEdge:114`, `confirmNode:287`, `promoteNodeStatus:94`, `logMemoryEvent` re-export | CONFIRMED (427 lines). The corpus READER is NOT a single function -- use the `insights.cjs` SELECT idioms (section 3). |
| `commands/map-unknowns.md` (KnownsUnknownsMatrix front-of-house) | EXISTS; `connector: { reach_id: context_block, sub_mode: unknowns-matrix, sensor_triggers: [], posture: hold, hierarchy_rank: 40, framework: "Knowns and Unknowns Matrix Framework", filing: fileEvidenceWithReadback }` (`:20-31`) | CONFIRMED. Already on the spine but `sensor_triggers: []` (not yet trigger-driven). 165 upgrades `sensor_triggers` to `[SENS-06, SENS-08]`. Framework name `"Knowns and Unknowns Matrix Framework"` EXISTS in `data/framework-names.json` (verified). Already in `data/connector-registry.json`. |
| `commands/file-meeting.md` (the ORPHAN) | EXISTS; **NO `connector:` block** (grep returned 0) | CONFIRMED ORPHAN (D-165-07). See section 7. |
| `scripts/build-connector-registry.cjs` (regen) | EXISTS, 27,388 bytes | CONFIRMED. Regen after frontmatter edits; never hand-edit `data/connector-registry.json`. |
| Phase 89.4 `rs-chain-feeder.cjs` (FEEDS_INTO precedent) | `lib/core/rs-chain-feeder.cjs` EXISTS | CONFIRMED. **BRAIN-TOUCHING (see section 8):** `lookupUpstream` queries Brain FEEDS_INTO topology via `brain-client.cjs::query` (`:9-12, :40-57`). 165's FEEDS_INTO chain DECLARATION is LOCAL (write via `navigation.writeEdge`); only generic methodology-handle lookups may ride Brain READ-ONLY (D-165-10). Do NOT clone the Brain-query path for the LOCAL chain writes. |
| Phase 125 f-selector-ranker (rank into F.1) | `lib/workflow/f-selector-ranker.cjs` EXISTS (+ `.planning/phases/125-f-selector-ranker`) | CONFIRMED. Engine output ranks here (D-165-06). |
| `lib/core/navigation/edges.cjs` frozen set | `ALLOWED_EDGE_TYPES:32`; all 4 target edges confirmed members | CONFIRMED. No amendment (D-165-08). |

**Net drift:** two pointer corrections (SENS-08 lives in `sensors/sensor-memory-cortex.cjs` not inline at L58; the futures orchestrator is an I/O shell not a math template) and one capability reconciliation (the corpus "reader" is the `insights.cjs` SELECT idiom + the `evidence_tier`-not-on-`writeClaimNode` fact). No anchor is missing. All four FEEDS_INTO consumer surfaces shipped (issue-tree as a diagnose sub_mode is the headline reconciliation).

---

## 7. THE FILE-MEETING ORPHAN + TRIGGER WIRING (D-165-07) `[VERIFIED: file-meeting.md, reanalyze.md, CONNECTOR-CONTRACT.md]`

### 7.1 Confirm the orphan
`commands/file-meeting.md` has NO `connector:` block (grep confirmed). Today the trigger leans on the navigator remembering `/mos:reanalyze` (which carries `sensor_triggers: [SENS-06], reach_id: contradiction, sub_mode: reanalyze, posture: hold, hierarchy_rank: 38, filing: none` -- `reanalyze.md:14-22`).

### 7.2 The connector block to ADD to `commands/file-meeting.md`

Ride an EXISTING reach (the frozen bank is 6 -- `context_block | contradiction | cross_room | brain_consult | deep_research | hats`; NO 7th, per `sensor-types.cjs:43` + `CONNECTOR-CONTRACT.md:37`). The filing event itself should dispatch the two trigger sensors. Recommended block:

```yaml
# --- Phase 165 connector (close the file-meeting orphan; D-165-07) ---
# The meeting-filing event dispatches the blind-spot trigger sensors. Rides the
# EXISTING 'contradiction' reach (a filed meeting that contradicts a confident
# claim = the oracle returning a true label). NO new reach_id (frozen bank = 6).
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06, SENS-08]
  reach_id: contradiction
  sub_mode: file-meeting
  framework: null
  posture: pull_back
  hierarchy_rank: 37
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
```

Rationale for the choices:
- `reach_id: contradiction` -- a meeting that contradicts a confident claim is the SENS-06 contradiction branch's native reach; it is the same reach `/mos:reanalyze` uses, so file-meeting and reanalyze share the contradiction lane (no 7th reach).
- `sensor_triggers: [SENS-06, SENS-08]` -- SENS-06 (a CONTRADICTS finding from the just-filed meeting = RESOLVE) AND SENS-08 (the meeting made the governing-thought hash stale = RE-SCAN). Both shipped (D-165-05).
- `posture: pull_back` -- a contradiction near a confident claim pulls back to re-set the stage (Part 5; matches the SENS-06 contradiction posture at `insight-sensors.cjs:339`).
- `hierarchy_rank: 37` -- one tighter than `/mos:reanalyze`'s 38 (lower wins ties; a fresh meeting-filing should out-rank a manual reanalyze on the same beat). Tunable.
- `framework: null` / `web_scope: null` -- file-meeting is not a single-framework methodology and does not reach the web.

### 7.3 The map-unknowns connector UPGRADE (the engine's front door)

`commands/map-unknowns.md:20-31` currently has `sensor_triggers: []`. 165 upgrades it to `sensor_triggers: [SENS-06, SENS-08]` so the engine auto-fires (D-165-06). Keep the existing `reach_id: context_block, sub_mode: unknowns-matrix, framework: "Knowns and Unknowns Matrix Framework"`. After both edits, **regen** via `scripts/build-connector-registry.cjs` (never hand-edit `data/connector-registry.json`).

### 7.4 The end-to-end chain (the gate sequence)
```
meeting filed (/mos:file-meeting)
  -> claim nodes (writeClaimNode) + CASC-01 cross-relationship cascade
  -> SENS-06 (CONTRADICTS against a confirmed Academic/Operational claim = oracle resolved a blind spot)
     AND/OR SENS-08 (ctx.staleGoverningThought = re-scan)
  -> hash-delta + SIGNAL_FRESHNESS_MS gate (a standup that added nothing confident -> no scan)
  -> UU engine: corpus (section 3) -> mine -> DSP -> bandit(proxy oracle, budget) -> rank
  -> candidate reach into f-selector-ranker
  -> F.1 Decision Gate: "Here's where you're most confident. That's exactly where I'd bet you're wrong -- probe?"
  -> APPROVE (top-N) -> navigation.confirmNode -> proposed blind spot promoted to confirmed
```

---

## 8. PART-8 BRAIN-BOUNDARY FLAGS (D-165-10) `[VERIFIED]`

Every Brain-touching path in the dependency surface, flagged:

| Path | Brain direction | Verdict for 165 |
|------|-----------------|-----------------|
| Pattern-mining over claim features (`pattern-miner.cjs`, `dsp.cjs`, `bandit.cjs`, `corpus-adapter.cjs`) | NONE | LOCAL-only by construction. Claim features (`section`, `domain`, `evidenceTier`, `confidence`) NEVER egress. Zero Brain require. The Part-8 grep gate (mirror `issue-tree.cjs` LOCAL doctrine + the `orchestrator.cjs:978` "grep gate ... is 0" precedent) must assert zero Brain egress + zero raw room.db writes. |
| `rs-chain-feeder.cjs::lookupUpstream` | Brain READ (FEEDS_INTO topology via `brain-client.cjs`) | **FLAGGED.** 165's FEEDS_INTO chain DECLARATION is a LOCAL `navigation.writeEdge`. Do NOT route the LOCAL chain writes through the Brain-query path. Brain READ is allowed ONLY for generic methodology handles (which framework chains a UU into) per D-165-10 -- never claim content. |
| Proxy oracle (section 2) | NONE | All three scalars (contradiction density, tier/confidence mismatch, staleness) are pure room.db reads. No Brain, no web. |
| Finding write (`writeClaimNode` + `writeEdge` + `confirmNode`) | NONE | The navigation chokepoint is LOCAL room.db only; the claim BODY never lands on an edge (Part 8 enum/scalar-only on edge properties). |
| `map-unknowns.md` "Brain Enhancement (Optional)" section | Brain READ (framework chain, generic handles) | Pre-existing, allowed (generic framework handles + problem_type enum only). 165 does not change it. |
| HSI arm-priority (port-change #5) | Reads shipped HSI scalars | The HSI scalars are computed by `scripts/hsi-*` (sentence-transformers + LSA, LOCAL corpus); 165 READS the per-partition scalar, never re-runs egress. Confirm the HSI source is the LOCAL room corpus, not a Brain query, before wiring. |

**Constitutional assertion for `tests/run-all-165.sh`:** a Part-8 boundary test (no claim content egress) + a frozen-edge assertion (only the 4 D-165-08 edges emitted) + a no-`Math.random` grep over `lib/core/unknowns/*.cjs` + a no-raw-`INSERT INTO`/`room.db` grep (all writes via `navigation.*`).

---

## Architecture Patterns

### System Architecture Diagram
```
                          MEETING FILED (/mos:file-meeting -- newly on spine)
                                        |
                                        v
                       writeClaimNode + CASC-01 cascade (proposed claims, edges)
                                        |
                   +--------------------+--------------------+
                   v                                         v
        SENS-06 sensorArtifactFiled                SENS-08 sensorMemoryCortex
        (CONTRADICTS vs confirmed claim             (ctx.staleGoverningThought
         = RESOLVE: oracle answered)                 = RE-SCAN: corpus dirty)
                   |                                         |
                   +---------------+-------------------------+
                                   v
                   HASH-DELTA + SIGNAL_FRESHNESS_MS gate  (no trivial-standup fire)
                                   |
                                   v
   +-------------------------- UU ENGINE (lib/core/unknowns/) -------------------------+
   |                                                                                   |
   |  corpus-adapter.findConfidentClaims(db)   <-- room.db: confirmed + Aca/Op tier    |
   |        (json_extract evidence_tier; insights.cjs reader idiom; LOCAL only)        |
   |                              |  instances + features (recast)                      |
   |                              v                                                     |
   |  pattern-miner.minePatterns -> dsp.partition (REAL interPartitionDistance, g2/g4) |
   |                              |  partitions (centroid, meanConfidence)              |
   |                              v                                                     |
   |  bandit.selectNextInstance(proxyOracle, budget)                                   |
   |     index-deterministic arm (HSI priority) + instance (sorted claimId);           |
   |     per-pull checkpoint -> <roomDir>/.mindrian/uu-scan.json (resumable)            |
   |     proxy label = w*contradictionDensity + w*tierMismatch + w*staleness >= thresh  |
   |                              |  ranked UU candidates                               |
   |                              v                                                     |
   |  rumsfeld-matrix routing  (KK = hunting ground; UU -> challenge/issue-tree/validate)|
   |  candidateToFinding (clone 169) -> writeClaimNode(proposed) + writeEdge(frozen)    |
   +-----------------------------------------------------------------------------------+
                                   |  candidate reach
                                   v
                   f-selector-ranker (Phase 125) -> F.1 Decision Gate
                   "where you're most confident = where I bet you're wrong -- probe?"
                                   |
                   APPROVE top-N (humanConfirmBudget=3) -> navigation.confirmNode
                                   v
                   proposed blind spot -> confirmed (Part 9 role 5; human byUser)
                                   |
                   FEEDS_INTO chain: down = challenge / diagnose(issue-tree) /
                                     validate-mvp / find-analogies / bono(expert-fill)
```

### Recommended Project Structure
```
lib/core/unknowns/
├── pattern-miner.cjs     # support-bounded descriptive patterns (deterministic)
├── dsp.cjs               # Algorithm 1 + REAL interPartition{Feature,Confidence}Distance
├── bandit.cjs            # Algorithm 2 UCB+discount; index-deterministic; per-pull checkpoint
├── rumsfeld-matrix.cjs   # 2x2 categorize + quadrant->pipeline routing table
├── corpus-adapter.cjs    # THE recast + findConfidentClaims + the proxy oracle
└── orchestrator.cjs      # pipeline stages (clone issue-tree single-build discipline)
tests/
├── run-all-165.sh        # the one-command phase gate (mirror run-all-164.sh / run-all-169.sh)
└── test-unknowns-*.cjs   # per-module + Part-8 boundary + frozen-edge + no-Math.random
```

### Anti-Patterns to Avoid
- **Re-implementing the issue-tree.** 164 shipped it as `/mos:diagnose --issue-tree`; 165 routes the UU quadrant TO it via FEEDS_INTO, never rebuilds it.
- **Rolling a raw `INSERT INTO nodes/edges`.** All writes go through `navigation.writeClaimNode` / `navigation.writeEdge` (clone `candidateToFinding` + `writeIssueTreeEdges`). The substrate-check gate (`scripts/check-substrate.cjs`) will reject a direct `room.db` open outside the navigation allow-list.
- **Treating `writeClaimNode` confidence/knowledge_type as the evidence tier.** The tier is Part-5 (`Academic|Operational|...`) on `EvidenceClaim`/graded claims, read via `json_extract`. Conflating `knowledge_type` (fact/causal/...) with `evidence_tier` would break the D-165-03 corpus filter.
- **Any `Math.random` / unseeded `Date.now` in the math path.** Index-deterministic sampling + caller-injected `opts.now` only.
- **Minting a 7th reach or a new edge type.** Frozen bank = 6 reaches, 4 target edges all frozen. Remap-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Write a proposed blind-spot node + cascade edge | Custom SQL writer | `navigation.writeClaimNode` + `navigation.writeEdge` (clone `graph-derivation.candidateToFinding`) | Part-9 chokepoint; idempotent UPSERT; no-downgrade-confirmed; substrate-gated |
| Promote proposed -> confirmed | Custom status update | `navigation.confirmNode` | Part-9 role 5 human-confirm guard; agent-attributed confirm REJECTED |
| Enumerate typed nodes by status/props | Ad-hoc query | `insights.cjs` reader idiom (`json_extract(properties,'$.field')`, `findStaleClaims` pattern) | Proven, deterministic, `opts.now` seam for tests |
| Frozen-edge enforcement | Manual string list | `require('./navigation/edges.cjs').ALLOWED_EDGE_TYPES` + module-load self-check (clone `issue-tree.cjs:67`) | Fails fast on remap drift |
| Connector registration | Hand-edit `data/connector-registry.json` | `scripts/build-connector-registry.cjs` regen | The registry is GENERATED; hand-edits drift |
| Stale-window time math | Raw `Date.now` subtraction | `findStaleClaims` window + `opts.now` seam | The ONLY relative-time idiom in the system (`insights.cjs:137`) |
| Recursive sub-room edge walk | Custom traversal | `graph-derivation.rollupSubRooms` (deferred, OPT-IN) | 169 shipped the NESTED_WITHIN recursion |

**Key insight:** every "engine output -> graph" step already has a shipped chokepoint (164 issue-tree, 169 graph-derivation, 131 findings-wirer). 165 is overwhelmingly a CLONE-and-recast job, not a build-from-scratch job; the genuinely net-new code is the recast (`corpus-adapter`), the proxy oracle, the REAL inter-partition distance, and the deterministic bandit.

## Common Pitfalls

### Pitfall 1: `evidence_tier` assumed on every `confirmed` claim
**What goes wrong:** the corpus query returns empty because `writeClaimNode` claims have no `evidence_tier`. **Why:** `writeClaimNode` writes `knowledge_type`, not `evidence_tier`. **Avoid:** filter the UNION over `EvidenceClaim` + graded `claim`/`CausalClaim`; document the corpus as "graded-confirmed". **Warning sign:** corpus size = 0 on a room with many confirmed claims.

### Pitfall 2: the goodness function does not discriminate (stub leak)
**What goes wrong:** DSP picks partitions by size only; blind-spot regions are not surfaced. **Why:** `interPartition*Distance` left at `return 1.0`. **Avoid:** implement section 1.4. **Warning sign:** every partition has identical goodness contribution from g2/g4.

### Pitfall 3: the scan re-fires on every standup
**What goes wrong:** noise; the navigator stops trusting Larry's nudge. **Why:** the hash-delta + freshness gate not wired. **Avoid:** gate on `corpusHash` change AND `SIGNAL_FRESHNESS_MS`. **Warning sign:** a scan fires after a meeting that asserted nothing confident.

### Pitfall 4: non-deterministic resume
**What goes wrong:** a resumed scan produces different findings than the interrupted one. **Why:** `Math.random` arm/instance selection, or unsorted iteration. **Avoid:** index-deterministic total order (section 1.5) + the `corpusHash` checkpoint guard. **Warning sign:** `tests/run-all-165.sh` flakes on the resume test.

### Pitfall 5: a proxy proposal auto-promotes to confirmed
**What goes wrong:** Part-9 role-5 breach; an agent confirms a truth-claim. **Why:** writing `review_status: confirmed` directly instead of `proposed`. **Avoid:** proxy writes PROPOSED only (clone `candidateToFinding`); only `confirmNode` (human byUser) promotes. **Warning sign:** the truth-machine guard rejects the write, or a blind spot appears confirmed without a gate.

## Runtime State Inventory

> Phase 165 is a greenfield engine build (new `lib/core/unknowns/*.cjs`) plus two frontmatter edits + a registry regen. It is NOT a rename/refactor/migration. The two frontmatter edits (`file-meeting.md` connector add, `map-unknowns.md` `sensor_triggers` upgrade) require a `scripts/build-connector-registry.cjs` regen of `data/connector-registry.json` (a generated, git-tracked artifact). No stored-data migration, no live-service config, no OS-registered state, no secret/env changes, no build-artifact rename. **Verified by:** the engine writes only `proposed` nodes/edges into the LOCAL room.db at runtime (no schema migration -- `writeClaimNode`/`writeEdge` use the existing tables); the build adds files, it does not rename any.

## Code Examples

### The DSP goodness with the REAL inter-partition distance (the discretion deliverable)
```js
// Source: derived from reference/unknown-unknowns-horvitz/README.md Eq.2 + the
// stub-replacement spec (section 1.4). Pure, deterministic, LOCAL.
function goodness(P, partitions, corpusRanges, w) {
  const g1 = intraFeatureDistance(P);                              // reference (kept)
  const g2 = interPartitionFeatureDistance(P, partitions, corpusRanges); // was return 1.0
  const g3 = intraConfidenceDistance(P);                           // reference (kept)
  const g4 = interPartitionConfidenceDistance(P, partitions);      // was return 1.0
  const g5 = P.pattern.conditions.length;                          // pattern length
  return w.l1*g1 - w.l2*g2 + w.l3*g3 - w.l4*g4 + w.l5*g5;          // Eq.2
}
```

### The proxy oracle (clone the insights.cjs reader idiom; LOCAL only)
```js
// Source: section 2; reads room.db scalars via the navigation chokepoint.
function proxyOracle(db, claimId, cfg, nowFn) {
  const contradictionDensity = readContradictionDensity(db, claimId);   // CONTRADICTS|INVALIDATES edges
  const tierMismatch        = readTierMismatch(db, claimId);            // confidence - tierFloor(evidence_tier)
  const staleness           = readStaleness(db, claimId, nowFn);        // (now - last_modified_at)/window
  const score = cfg.w_contra*contradictionDensity
              + cfg.w_mismatch*tierMismatch
              + cfg.w_stale*staleness;
  return { trueLabel: score >= cfg.proxyThreshold ? 1 : 0, cost: cfg.proxyCost /* 0 */ };
}
```

## State of the Art

| Old (CONTEXT-era) assumption | Current reality (2026-06-19) | Impact |
|------------------------------|------------------------------|--------|
| issue-tree is a downstream surface to point at | issue-tree shipped as `/mos:diagnose --issue-tree` sub_mode (164) | 165 REUSES it; FEEDS_INTO down-target is `context_block`/diagnose |
| "write findings as proposed" is net-new | `graph-derivation.candidateToFinding` shipped (169) | Clone it; do not roll your own |
| corpus reader = a single navigation function | the `insights.cjs` SELECT idiom + `evidence_tier` on EvidenceClaim | Corpus query is a UNION + `json_extract`, not one function |
| clone the futures orchestrator | futures orch is an async I/O shell | Clone `issue-tree.cjs` for the pure math; futures only for stage shape |
| canon v1.x | canon v1.13 / Appendix D entry 24 | All 4 edges frozen; 165 mints none |

**Deprecated/outdated:** the CONTEXT's "SENS-08 ~L58" inline pointer (it is a require at `:58-63`, defined in `sensors/sensor-memory-cortex.cjs`); "confidence" as a stored governing-thought-hash-on-claim (it is `ctx.staleGoverningThought` derived + per-claim `last_modified_at`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The DSP `centroid` carries the section/domain/tier/confidence feature vector and `meanConfidence` is a [0,1] scalar (per the README contract) | 1.4 | If the reference centroid shape differs, the inter-partition metric needs re-derivation; LOW risk (README is explicit). Validate against the transcript source if available. |
| A2 | HSI per-partition scalars are available from the LOCAL `scripts/hsi-*` surface without a Brain query | 1.3 #5, 8 | If HSI requires a Brain/Pinecone call, the arm-priority wiring must degrade to a LOCAL fallback (e.g. proxy-score priority) to stay Part-8-clean. MEDIUM -- confirm the HSI scalar source at plan time. |
| A3 | `humanConfirmBudget=3`, `w_contra/w_mismatch/w_stale = 0.5/0.3/0.2`, `proxyThreshold=0.5` are reasonable defaults | 2.2, 2.3 | These are tunable config, not load-bearing; wrong defaults under/over-rank but do not break correctness. LOW. |
| A4 | `hierarchy_rank: 37` for file-meeting (one tighter than reanalyze's 38) | 7.2 | A tie-break ordering choice; wrong value mis-prioritizes on a shared beat but is trivially tunable. LOW. |
| A5 | The corpus = graded-confirmed (ungraded confirmed claims excluded by the tier filter) is the intended D-165-03 reading | 3.1 | If the navigator intended ALL confirmed claims (tier-or-not) in the corpus, the filter must add a fallback tier. MEDIUM -- flag for confirmation; the CONTEXT says "Academic/Operational tier only" which supports the graded-only reading. |

## Open Questions

1. **Is the HSI arm-priority scalar LOCAL-derivable per partition without Brain?**
   - Know: HSI is computed by `scripts/hsi-*` over the LOCAL room corpus (Engine 1, Part 2); `compute-bayesian-surprise` is in the diagnostics surface.
   - Unclear: whether a PER-PARTITION HSI requires a Pinecone/Brain similarity call (which would be a Part-8 read of generic handles, allowed, but adds a dependency to the bandit loop).
   - Recommendation: compute the per-partition arm priority from LOCAL scalars (mean proxy-score + intra-partition confidence) as the v1 default; treat true HSI cross-domain surprise as an OPTIONAL enrichment read (cached, outside the bandit tight loop). Confirm at plan time.

2. **Does the navigator want the corpus to include ungraded `confirmed` claims (A5)?**
   - Know: D-165-03 says "Academic/Operational tier only".
   - Unclear: whether an ungraded-but-confirmed claim (no `evidence_tier`) should be swept in with a default tier.
   - Recommendation: graded-only (the strict reading); surface the corpus size at the gate so the navigator sees if it is too thin.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js CJS | the whole engine | (assumed) | >=18 | none needed |
| `lib/core/navigation.cjs` chokepoint | all writes | YES (427 lines) | current main | none |
| `lib/core/issue-tree.cjs` (clone template) | engine math + edge remap | YES (269 lines) | shipped 164 | clone futures orch shape |
| `lib/core/graph-derivation.cjs` (finding writer) | proposed-node writes | YES (shipped 169) | current main | findings-wirer.cjs |
| `scripts/hsi-*` (HSI arm priority) | bandit arm-priority enrichment | YES (Python, Engine 1) | shipped | LOCAL proxy-score priority |
| `scripts/build-connector-registry.cjs` | connector regen | YES (27KB) | current main | none (must regen) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** HSI per-partition scalar (fallback: LOCAL proxy-score arm priority).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` -- this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node CJS assert + a `tests/run-all-165.sh` bash aggregator (the shipped sibling idiom: `tests/run-all-164.sh`, `tests/run-all-169.sh`) |
| Config file | none -- bash aggregator runs `node tests/test-*.cjs` and greps for green |
| Quick run command | `node tests/test-unknowns-bandit.cjs` (single module, < 5s) |
| Full suite command | `bash tests/run-all-165.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-165-02 | DSP partition + UCB bandit produce ranked partitions | unit | `node tests/test-unknowns-dsp.cjs` / `test-unknowns-bandit.cjs` | Wave 0 |
| D-165-09 | zero `Math.random`; resume is byte-identical | unit + grep | `grep -rc "Math.random" lib/core/unknowns/` (= 0) + `test-unknowns-resume.cjs` | Wave 0 |
| D-165-01 | proxy oracle blends 3 LOCAL scalars; top-N gate via confirmNode | unit | `node tests/test-unknowns-proxy-oracle.cjs` | Wave 0 |
| D-165-03 | corpus = confirmed + Academic/Operational only | unit | `node tests/test-unknowns-corpus-adapter.cjs` (fixture room.db) | Wave 0 |
| D-165-08 | only the 4 frozen edges emitted; remap self-check | unit | `node tests/test-unknowns-frozen-edges.cjs` | Wave 0 |
| D-165-10 | zero Brain egress; no raw room.db write | grep gate | `node tests/test-unknowns-part8-boundary.cjs` (forbidden-substring sweep, mirror `orchestrator.cjs:978` precedent) | Wave 0 |
| D-165-05/07 | file-meeting connector regen + sensor wiring | integration | connector `--check` tripwire (`scripts/build-connector-registry.cjs --check`) | exists |
| D-165-06 | engine output ranks into F.1 | integration | `node tests/test-unknowns-rank-in.cjs` (f-selector-ranker) | Wave 0 |
| interPartitionDistance | real distance discriminates (not 1.0) | unit | `node tests/test-unknowns-dsp-goodness.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single affected `node tests/test-unknowns-<module>.cjs`.
- **Per wave merge:** `bash tests/run-all-165.sh` (all unit + the Part-8 + frozen-edge + no-random gates).
- **Phase gate:** `bash tests/run-all-165.sh` green + `scripts/build-connector-registry.cjs --check` clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-165.sh` -- the one-command phase gate (clone `run-all-164.sh`)
- [ ] `tests/test-unknowns-corpus-adapter.cjs` + a fixture room.db with confirmed/proposed/Academic/Operational/None claims -- covers D-165-03
- [ ] `tests/test-unknowns-dsp-goodness.cjs` -- asserts the REAL inter-partition distance discriminates (the stub-leak regression)
- [ ] `tests/test-unknowns-resume.cjs` -- interrupt + resume = byte-identical (D-165-09)
- [ ] `tests/test-unknowns-part8-boundary.cjs` -- forbidden-substring sweep (D-165-10)
- [ ] `tests/test-unknowns-frozen-edges.cjs` -- only the 4 frozen edges; remap self-check (D-165-08)

## Security Domain

> `security_enforcement` is not explicitly `false` in config (the workflow block has no such key) -- treated as enabled. This phase has no auth/session/web surface; the binding security constitution is Canon Part 8 (the graph boundary).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no user auth surface (LOCAL plugin) |
| V3 Session Management | no | -- |
| V4 Access Control | no | room-local file access only |
| V5 Input Validation | yes | the proxy oracle + corpus adapter validate node types / tiers against frozen sets (`EVIDENCE_TIERS`, `KNOWLEDGE_TYPES`, `ALLOWED_EDGE_TYPES`); reject invalid (the `writeClaimNode`/`writeEdge` defensive-return idiom) |
| V6 Cryptography | no | `_candidateHash` sha256 is a stable id, not a security primitive; no secrets |

### Known Threat Patterns for this stack (Canon Part 8 native)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Claim content (artifact body, meeting text) egressing to Brain via the pattern-miner | Information Disclosure | LOCAL-only mining; the `tests/run-all-165.sh` forbidden-substring Part-8 sweep (mirror Phase 90's 5-tripwire + `orchestrator.cjs:978` grep gate) |
| User content smuggled onto an edge property | Information Disclosure | edge properties are enum/scalar + node-id handles only (`findings-wirer.cjs:107`, `issue-tree.cjs:251` idiom); the prose lives on the NODE, never the edge |
| Raw `INSERT INTO room.db` bypassing the chokepoint | Tampering | `scripts/check-substrate.cjs` allow-list (only `lib/core/navigation/` opens room.db); 165 modules require `navigation.cjs`, never `room-db.cjs`/`node:sqlite` |
| An agent auto-confirming a proxy proposal | Elevation of Privilege | `navigation.confirmNode` truth-machine guard rejects agent-attributed confirms (Part 9 role 5) |
| New edge type / 7th reach minted | Tampering (constitutional) | frozen-set module-load self-check + connector `--check` tripwire; remap-only (D-165-08) |

## Sources

### Primary (HIGH confidence -- verified at file:line on current main)
- `lib/core/issue-tree.cjs` (1-269) -- the deterministic-engine + edge-remap + `writeIssueTreeEdges` + module-load self-check template
- `lib/core/graph-derivation.cjs` -- `candidateToFinding:95`, `runDerivation:154`, `rollupSubRooms:26`, `_candidateHash:79` (the proposed-node finding writer, shipped 169)
- `lib/core/navigation.cjs` -- `writeClaimNode:177`, `writeEdge:114`, `confirmNode:287`, `promoteNodeStatus:94`
- `lib/core/navigation/typed-claim.cjs` (1-144) -- `writeClaimNode` shape: knowledge_type, confidence=1.0, NO evidence_tier
- `lib/core/navigation/evidence-claim.cjs` (40-120) -- `EVIDENCE_TIERS:48`, `writeEvidenceClaim` (the evidence_tier source)
- `lib/core/navigation/insights.cjs` (60-260) -- `findUnsupportedClaims:68`, `findStaleClaims:146`, `findRelevantOpportunities:208`, the `json_extract` idiom `:226-232`
- `lib/core/insight-sensors.cjs` (50-451) -- SENS-06 `sensorArtifactFiled:317`, `SIGNAL_FRESHNESS_MS:124`, `isFreshFile:135`, `dispatchSensors:392`, `SENSOR_REGISTRY:360`
- `lib/core/sensors/sensor-memory-cortex.cjs` (1-112) -- SENS-08 `sensorMemoryCortex:81`
- `lib/core/sensors/sensor-types.cjs` (1-127) -- `REACH_IDS:43` (6), `POSTURE_IDS:54` (3), `makeReach:80`
- `lib/core/navigation/edges.cjs` -- `ALLOWED_EDGE_TYPES:32`; INVALIDATES:405, ROOT_CAUSES:320, ENABLES:409, FEEDS_INTO:242
- `commands/diagnose.md` (19-40) -- issue-tree as a sub_mode (164)
- `commands/map-unknowns.md` (20-31) -- the engine front door connector
- `commands/file-meeting.md` -- the ORPHAN (no connector block)
- `commands/reanalyze.md` (14-22) -- the SENS-06/contradiction/reanalyze precedent
- `docs/CONNECTOR-CONTRACT.md` (19-78) -- the connector frontmatter schema
- `docs/MINDRIAN-CANON.md` -- v1.13, Part 4 frozen edges, Part 5 tiers, Part 8 boundary, Part 9 roles
- `lib/core/futures/orchestrator.cjs` -- the stage-shape reference (Math.random count = 0)
- `lib/core/rs-chain-feeder.cjs` (1-60) -- the FEEDS_INTO chain precedent (Brain-READ flagged)
- `.planning/research/reference/unknown-unknowns-horvitz/README.md` -- the algorithm contract + the 6 port changes
- `.planning/research/2026-06-18-unknown-unknowns-blindspot-engine-scoping.md` -- the full scope + harness-as-code ladder
- `.planning/config.json` -- nyquist_validation: true

### Secondary (MEDIUM confidence)
- `data/connector-registry.json` (grep: map-unknowns/unknowns-matrix present) + `data/framework-names.json` ("Knowns and Unknowns Matrix Framework" present)
- `git log` (164 + 169 both COMPLETE on current main, 2026-06-19)

### Tertiary (LOW confidence)
- The exact reference JS source (centroid shape, sampler internals) lives in the 2026-06-18 session transcript, not in the repo; the README is the durable contract (A1).

## Metadata

**Confidence breakdown:**
- Standard stack / reuse anchors: HIGH -- every anchor verified at file:line; two pointer drifts corrected, one capability reconciliation surfaced.
- Reference port (equations, 6 changes, inter-partition distance, determinism): HIGH on the contract (README + CLAUDE.md + issue-tree precedent); MEDIUM on the exact reference source internals (A1, transcript-only).
- Proxy composition + corpus query: HIGH -- exact readers + JSON idiom + tier source verified.
- 164/169 reconcile + frozen edges + canon version: HIGH -- git log + diagnose.md + edges.cjs + canon header all verified.
- HSI arm-priority Part-8 cleanliness: MEDIUM (A2 / open question 1).

**Research date:** 2026-06-19
**Valid until:** 2026-07-03 (stable internal codebase; re-verify if a phase between 165 and execution touches `navigation/edges.cjs`, `insight-sensors.cjs`, or the connector registry).

## RESEARCH COMPLETE
