# Roadmap: MindrianOS Plugin -- v2.0.0 "Build the Loop"

**Previous milestone:** v1.16.0 "Infrastructure Remediation" (completed 2026-08-10; 12 phases 235-245, 67 plans; latest released tag v1.16.0-beta.13). Full v1.16.0 roadmap detail archived at `.planning/milestones/v1.16.0-ROADMAP.md`. This file covers ONLY v2.0.0. Phase numbering continues from 245; the first new phase is 246.

**Release train (navigator directives 2026-07-28 and 2026-08-10):** v2.0.0 work ships as `v2.0.0-beta.N` prereleases ONLY after the v1.16.0 train disposition is decided (finalize the v1.16.0-beta.x train or rule it into the v2.0.0 train explicitly) -- and Gate 0, the official v1.15.0 stable close-out, is STILL OPEN and carries forward (verbatim text in Progress below). No v2.0.0 release cut before both are settled. Planning and code work are not gated; release cuts are.

**Milestone identity:** navigator-approved at a live Decision Gate 2026-08-10 (`docs/2026-08-10-HANDOFF-build-the-loop-milestone.md`, which supersedes the tier0-removal handoff's SEQUENCING; that doc's evidence and blast-radius measurements stand). The registered v1.17.0 "MCP-First" slot is FOLDED IN by navigator ruling 2026-08-10 (Phase 248 below absorbs it). Seeds in scope: SEED-045 (Brain Orchestration Advisor), SEED-008 (Close the intelligence loop), SEED-011 (Brain Silent Identity), SEED-014 (Brain repo as deployment unit).

## Overview

Build the loop that makes MindrianOS a complete product: local context (room.db) fires a trigger -> a query goes to the methodology graph (Memgraph Brain) -> Larry operates the join and synthesizes -> the human ratifies the insight (HITL) -> context updates. This is a construction, not a subtraction: Tier 0 dies as a CONSEQUENCE of the loop existing, because the loop with its middle cut out is the hollow imitation the navigator named.

**The honesty invariant binds every phase: a user is never served methodology that did not come from the Brain, without being told.**

Sequencing is dependency-driven, mirroring the requirement families: live verification and the graph census first (everything downstream reads their output), then the Brain surface contract and the MCP-First fold-in in parallel (the remote and local halves of the loop), then context-driven enrichment (reads the census, writes through the contract), then the honesty rail and doctrine amendment (needs the enrichment queue live so a refusal can auto-queue), then the cache-aware trigger redesign (measurement can start early; the redesign lands after HONEST-01 so the rail it carries is the honest one), and the guard sweep strictly LAST -- never split from HONEST-02's doctrine amendment across releases, or docs would claim Brain-required while guards silently degrade.

Refusal doctrine ships BEFORE the hard dependency: the hard-require lands only when the graph can honor it (ENRICH-04's flagship readiness floor gates SWEEP-02). The Brain's own probes (2026-08-10) ground this order: curriculum prose is strong, orchestration structure is largely unbuilt, and the flagship framework scores 0/4 on the Brain's own readiness test today.

## Cross-Cutting Research Rules (bind every phase)

Carried from REQUIREMENTS.md; plan-phase must honor these during research:

- **Canon Part 8 untouchable:** this milestone changes WHEN the Brain is reached and how loudly failure surfaces, never WHAT crosses the wire. No LOCAL user data egresses, ever.
- **Grounding sources per CLAUDE.md:** langtalks-graph-expert for agent/graph/context-engineering concepts (`relationship_path` point-to-point; `query_relationship` BFS returns zero-edge payloads), Context7 for API contracts, claude-api skill + claude-code-guide agent for host behavior (hooks, matchers, MCP registration). Applies directly to Phases 246, 249, 250, 251.
- **Eval honesty (from the brain repo's own README):** a test that cannot fail is not evidence. Applies with force to Phase 249's enrichment evals and Phase 252's inverted fixtures.
- **Cross-repo:** plugin (this repo) + `jsagir/brain_ProblemsWorthSolving` (the server-side tool layer, local name `mindrian-brain-local`) + the Render deployment (`pws-brain-mcp.onrender.com`). A requirement is not done until the surface a user reaches is fixed. Applies directly to Phases 247 and 249.
- **Canon Part 7:** extend `brain-connector`; never mint a fourth brain skill. **Part 11 CIRS:** the refusal fork gets an explicit `hitl_shape`. **Tri-Polar:** refusal and binding behavior correct on CLI, Desktop, Cowork.
- **No em-dashes anywhere.** Hyphens only; there is a test fence.

Already-scoped inputs (routed in, not re-planned): `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md` (the plan of record), `docs/2026-08-09-HANDOFF-tier0-removal-milestone.md` (blast-radius measurements for Phase 252; sequencing superseded; section 6's no-always-on-skill-primitive finding binds Phase 251), `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` (diagnosed, Phase 248 input), `ProblemsWorthSolving-Brain/docs/2026-08-09-HANDOFF-brain-consumption-surface.md` (Phase 247 input, brain-repo side).

## Phases

**Phase Numbering:** integer phases are planned milestone work; decimal phases (e.g. 246.1) are urgent insertions. Numbering continues from v1.16.0's last phase directory (245).

- [ ] **Phase 246: Live Verification + Graph Census** - A fresh session proves the beta.13 Brain path live with the three-call test, and a tracked Cypher census maps the methodology graph's real structure and gaps
- [ ] **Phase 247: Brain Surface Contract** - The loop-serving tool set is THE declared cross-repo contract, the server-side-LLM tools get an explicit fate, and search stops leaking local paths (cross-repo with jsagir/brain_ProblemsWorthSolving)
- [ ] **Phase 248: MCP-First Room Resolution** - One shared room-resolution ladder replaces the eight resolver copies, and room_bind is authoritative and honest for its session (the absorbed v1.17.0 slot; the local-context half of the loop)
- [ ] **Phase 249: Context-Driven Enrichment** - Live readiness misses queue frameworks for structural enrichment with reviewable diffs and evals that can fail; the flagship frameworks reach the readiness floor
- [ ] **Phase 250: Honesty Rail + Doctrine Amendment** - The silent-fallback clause is dead everywhere, Decisions #1 and #8 are rewritten together as one unit, and graph-grounded answers carry provenance
- [ ] **Phase 251: Cache-Aware Trigger Redesign** - The per-turn injection's real prompt-cache cost is measured, injection goes stable-prefix/append-only, and the Brain reach rides the redesigned rail
- [ ] **Phase 252: Guard Sweep** - The 101 brain-optional guards route through the honesty rail, the tier-0-no-key fixture inverts to a refusal fixture, and docs and constitution agree in the same release (strictly LAST; never split from Phase 250's amendment across releases)

## Phase Details

### Phase 246: Live Verification + Graph Census

**Goal**: The loop's foundation is proven live and its gap map is on disk: a fresh session demonstrates the beta.13+ Brain path actually works end to end (the only verification that counts, after the restart-to-apply lesson of the pre-beta.13 session that reproduced both fixed defects live), and a Cypher census turns "the orchestration structure is largely unbuilt" from an impression into a tracked artifact every downstream phase reads.
**Depends on**: Nothing (first; everything downstream reads its output)
**Requirements**: LOOP-01, LOOP-02
**Success Criteria** (what must be TRUE):

  1. A fresh session on beta.13+ passes the three-call Brain test - brain_stats counts, brain_search "jobs to be done framework" results, and a synthesized methodology answer - with any failure reported verbatim in-turn, never silently.
  2. A Cypher census of the methodology graph is filed as a tracked artifact: total Framework nodes, frameworks with HAS_PHASE/HAS_STAGE/HAS_PROCESS_STEP/HAS_STEP structure, FEEDS_INTO and LEADS_TO edge counts, and top gaps ranked by expected-use.
  3. The census is citable downstream: Phases 247 and 249 plan against its numbers instead of re-probing the graph, and the 2026-08-10 probe findings (JTBD 0/4 with 4 aliases, TRIZ/SCAMPER/Five Whys absent as Framework nodes, empty discover_structure) are confirmed or corrected on the record.

**Plans**: 2 plans

Plans:

- [ ] 246-01-PLAN.md - LOOP-01 fresh-session three-call live verification (preflight + checkpoint:human-verify with the five-signature decode table)
- [ ] 246-02-PLAN.md - LOOP-02 two-lane graph census: builder + test fence, Lane A read-tier run committed first, Lane B admin-key operator checkpoint, finalize

### Phase 247: Brain Surface Contract

**Goal**: The Brain's tool surface is a declared, conformance-tested contract instead of an accretion: the loop-serving tools are THE contract in both repos, the two server-side-LLM tools get an explicit recorded fate (reasoning belongs to Larry, not the Brain), served responses stop leaking the author's local filesystem paths, and the 8 foreign-space vector indexes get a decided disposition per the brain repo's own never-re-embed rule. Cross-repo: this phase spans the plugin's client/tools AND `jsagir/brain_ProblemsWorthSolving`'s server tool layer, landing on the Render deployment - a requirement is not done until the surface a user reaches is fixed.
**Depends on**: Phase 246 (runs parallel with Phase 248; the live-verified surface and the census are the baseline being contracted)
**Requirements**: CONTRACT-01, CONTRACT-02, CONTRACT-03, CONTRACT-04
**Success Criteria** (what must be TRUE):

  1. Both repos declare the same loop-serving contract (normalize_framework_name, search, discover_structure, orchestration_readiness, feeds_into_chains, plus brain_stats for health), and a conformance test proves the deployed surface matches the declaration - a drift turns it red.
  2. brain_ask_anything and text2cypher are retired from the remote surface OR ship with a working sidecar; either way the decision is recorded with its reasoning (the Render deployment has no Ollama sidecar by design today).
  3. A served search response contains no local filesystem paths (source_file leak closed server-side), and the framework metadata field is either populated or removed from the payload - never silently empty.
  4. Each of the 8 foreign-space vector indexes has a recorded disposition per the brain repo's own rule (rebuild with the model that built it, or drop with proof nothing reads it), and an e5-dimension guard exists at index creation.

**Plans**: TBD

### Phase 248: MCP-First Room Resolution

**Goal**: The local-context half of the loop resolves rooms through ONE ladder that tells the truth: the eight independent gate-then-fallthrough resolver copies collapse into one shared resolver following the `resolve-active-room.cjs` precedent and the `isWritePathEnabled` precedence ladder (explicit flag wins, then confident host-tier detection, floor to false - the read path is the unfixed half of a gap whose write half Phase 234-05 already closed), and an explicit room_bind binds for the rest of its session regardless of flag state. This phase absorbs the registered v1.17.0 "MCP-First" slot by navigator ruling 2026-08-10.
**Depends on**: Phase 246 (runs parallel with Phase 247; a live-verified plugin is the baseline for CTX-03's before/after)
**Requirements**: CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE):

  1. ONE shared room-resolution ladder is the only resolver: the eight independent gate-then-fallthrough copies (7x `lib/mcp/tools/*` plus `lib/mcp/tool-router.cjs`'s `resolveWriteTargetDir`) all route through it, proven by a call-site census that excludes `tests/`; reintroducing an independent copy turns a gate red.
  2. An explicit room_bind is authoritative for the rest of its session regardless of `MINDRIAN_MCP_FIRST` state, and its return value honestly states whether the binding will apply - the unqualified `{ok:true, bound:true}` about an inert effect cannot be reproduced.
  3. The carried defect `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` closes with a live before/after demonstrated on all three surfaces (CLI, Desktop, Cowork).

**Plans**: 2 plans

Plans:

- [x] 248-01-PLAN.md - Nine-copy collapse: lib/mcp/session-room.cjs the ONE shared resolver, census gate, bound-session authority proof, doctrine re-point (CTX-01, mechanism half of CTX-02)
- [ ] 248-02-PLAN.md - Honest room_bind return + CTX-03 live before/after close-out

### Phase 249: Context-Driven Enrichment

**Goal**: The methodology graph grows where live usage proves it thin - never bulk: a real reach that hits an unready framework becomes a typed queue entry, the enrichment pipeline turns queue entries into reviewed graph structure with evals that can fail, the flagship duplicate collapses, and the frameworks the 25 methodology commands actually invoke reach the readiness floor that SWEEP-02's hard-require will stand on. Navigator's explicit direction: chains and pipelines are built according to context and relevancy; the backlog is built by live usage, no big-bang graph project. Cross-repo where writes land in the brain repo's graph.
**Depends on**: Phase 246 (the census is the gap map), Phase 247 (enrichment reads readiness and writes through the contracted surface)
**Requirements**: ENRICH-01, ENRICH-02, ENRICH-03, ENRICH-04
**Success Criteria** (what must be TRUE):

  1. When a live reach triggers a framework whose orchestration_readiness is 0-2/4, the miss is captured as a typed enrichment-queue entry (framework, missing dimensions, triggering context class - generic handles only, Part 8; no user bytes cross the wire).
  2. The enrichment pipeline turns a queue entry into graph structure (phases/steps, LEADS_TO flow, FEEDS_INTO edges) with a human-reviewable diff before any write, and each enriched framework ships a known-answer eval that CAN fail - a deliberately wrong answer turns it red.
  3. The 4 "Jobs to Be Done" aliases collapse to one canonical node with ALIAS_OF edges, and normalize_framework_name proves it by resolving every alias to the canonical node.
  4. Every framework the 25 methodology commands actually invoke reports orchestration_readiness >= 3/4 - the SWEEP-02 gate: the hard-require in Phase 252 does not land until this floor holds.

**Plans**: TBD

### Phase 250: Honesty Rail + Doctrine Amendment

**Goal**: Refusal doctrine ships before the hard dependency: a Brain failure or readiness miss surfaces to the user in-turn, plainly, and never as a quieter Larry; the constitution stops contradicting itself by rewriting Decisions #1 and #8 TOGETHER as one reviewable unit carrying the causal record of the weeks-long invisible outage; and Larry-served methodology carries provenance so graph-grounded answers are distinguishable from Larry-voice conversation without honesty becoming nagging. Extends `brain-connector` (Part 7 - no fourth brain skill); the refusal fork gets a declared hitl_shape (Part 11 / CIRS).
**Depends on**: Phase 249 (the enrichment queue must be live so a visible refusal auto-queues enrichment instead of dead-ending; the ENRICH-04 floor need not be complete - it gates Phase 252, not this phase)
**Requirements**: HONEST-01, HONEST-02, HONEST-03
**Success Criteria** (what must be TRUE):

  1. The silent-fallback clause is dead everywhere: a Brain failure or a 0-2/4 readiness miss surfaces to the user in-turn as a visible "the graph does not have this structured yet" (auto-queuing enrichment via ENRICH-01), and the "never mention failures to user" doctrine cannot be found in any shipped surface.
  2. The doctrine amendment rewrites Decisions #1 and #8 TOGETHER as one reviewable unit, with the causal record of the invisible outage inside the amendment text itself - on the record, not in a chat log; hitl_shape is declared for the refusal fork.
  3. Graph-grounded answers are visibly distinguishable from Larry-voice conversation on all three surfaces, and SEED-011 (Brain Silent Identity) resolves the key ceremony so provenance and refusal read as honesty, not nagging.

**Plans**: TBD

### Phase 251: Cache-Aware Trigger Hygiene (RESCOPED 2026-08-10 per the CACHE-01 measurement)

**Goal**: RESCOPED by navigator ruling 2026-08-10 after CACHE-01 measured the rail: the ep55
prefix-break hypothesis is FALSE for Claude Code (additionalContext lands inside the user turn
and EXTENDS the cache; 91-97% measured hit rates; ~USD 4-7/month real cost vs the feared
hundreds-per-session). Measurement: `.planning/phases/251-cache-aware-trigger-redesign/251-CACHE-MEASUREMENT.md`.
The phase is now a HYGIENE pass on the proven-safe rail: (a) suppress-when-unchanged injection
(hash vs previous turn - one measured session emitted 7/7 byte-identical blocks), (b) move the
invariant skeleton (FIRE-IF-FORK boilerplate, contract line) to SessionStart context for a
40-60% per-turn cut, (c) kill the verb-line duplication in the AskUserQuestion payload
(~300 B/block). The design rationale is still filed as first-party doctrine (the hook layer
remains corpus whitespace). Section 6 of the tier0 handoff still binds: the UserPromptSubmit
additionalContext rail is the mechanism that exists. Known open gaps carried honestly:
Desktop/Cowork unmeasured (Tri-Polar), compaction-acceleration needs its own experiment, and
the REAL felt cost is the 7 synchronous UserPromptSubmit hooks' latency (out of scope here;
candidate for a future phase).
**Depends on**: Phase 250 for the hygiene legs (CACHE-02/03 land after HONEST-01 so the rail carries the honest reach, not the silent one). CACHE-01 is DONE (2026-08-10).
**Requirements**: CACHE-01 (done), CACHE-02 (rescoped), CACHE-03 (rescoped)
**Success Criteria** (what must be TRUE):

  1. DONE - the cache cost is measured and filed as a tracked artifact; every later change cites the measurement, not the suspicion.
  2. The three hygiene items land with before/after byte counts recorded: suppress-when-unchanged, skeleton-to-SessionStart, duplication kill.
  3. The Brain reach rides the existing rail with an explicit block-size budget, and a live-session check confirms cache-read rates stay at or above the measured 91-97% baseline after the Brain reach is added.

**Plans**: TBD

### Phase 252: Guard Sweep

**Goal**: The loop's honesty becomes the codebase's only behavior: the brain-optional guard sites route through the honesty rail as visible refusal instead of silent degradation, the degradation test suite is re-pointed at refusal semantics, the tier-0-no-key acceptance fixture is repurposed (coverage kept, assertion inverted - never deleted) to prove the keyless path refuses correctly, and docs and constitution agree in the same release. Strictly LAST. Blast radius per the tier0 handoff measured at `632e230b` (101 isAvailable() sites across 47 files, 82 degradation tests, 121 Tier-0 docs, one sentinel chokepoint at `lib/core/tier0-messaging.cjs`) - RE-MEASURE before planning; the counts will have drifted.
**Depends on**: Phase 250 (HARD - the rail the guards route into, and the amendment this phase must ship WITH), Phase 249 (HARD - ENRICH-04's readiness floor is the SWEEP-02 gate), Phase 251 (strictly-last ordering; the sweep lands on the redesigned rail)
**Requirements**: SWEEP-01, SWEEP-02, SWEEP-03
**Success Criteria** (what must be TRUE):

  1. The 101 isAvailable() brain-optional guard sites (re-measured count) route through the honesty rail - visible refusal, not silent degradation - and the 82 degradation tests are re-pointed at refusal semantics; a census excluding `tests/` proves no silent-degradation guard survives.
  2. The tier-0-no-key acceptance fixture is REPURPOSED to assert the keyless path refuses correctly: coverage kept, assertion inverted, never deleted - the artifact that proved the install works without a key now proves it refuses honestly without one.
  3. Docs and constitution agree in the same release: no released state exists where docs claim Brain-required while guards silently degrade - this phase ships in the SAME release as Phase 250's HONEST-02 doctrine amendment, enforced as a release-train rule in Progress below.

**Plans**: TBD

## Progress

**Release train (gates RELEASE CUTS, not planning/code work):**

- **Gate 0 -- official v1.15.0 close-out FIRST:** finalize the v1.15.3-beta.x train to the stable v1.15.x release (`release.sh --finalize` flow: npm @latest, tag, marketplace pin, full lockstep per the release hard rules), closing Phase 234 as the last v1.15.0 phase. Per the standing rule (`feedback_dev_repo_fix_not_live_until_released`), v1.15.0 is not "shipped" until this release actually cuts and is picked up.
- **Gate 1 - v1.16.0 train disposition:** the v1.16.0-beta.x train (latest v1.16.0-beta.13) gets an explicit disposition - finalize to stable v1.16.0, or a recorded navigator ruling folding it into the v2.0.0 train. Decided AFTER Gate 0 per the same close-down-official-first directive.
- **Then v2.0.0 betas:** all v2.0.0 phase work releases as `v2.0.0-beta.N` prereleases (`release.sh --start-prerelease` to open the train); v2.0.0 finalizes to stable only when all 7 phases close. No v2.0.0 release cut before Gates 0 and 1.
- **Amendment-sweep lockstep (HARD):** no release - beta or stable - ships Phase 250's HONEST-02 doctrine amendment without Phase 252's sweep complete. The amendment text may merge earlier as a commit, but a cut that carries the rewritten Decisions #1/#8 while guards still silently degrade is the contradiction worse than either state. Phases 250 and 252 are never split across releases.

**Execution order (dependency waves):**

- **Wave 1:** Phase 246 (foundation; everything downstream reads its output). CACHE-01's read-only measurement may begin alongside.
- **Wave 2 (after 246, parallel):** Phase 247 (remote half: the contract) + Phase 248 (local half: the resolution ladder)
- **Wave 3 (after 246 + 247):** Phase 249 (enrichment reads the census, writes through the contract)
- **Wave 4 (after 249):** Phase 250 (the rail refuses into a queue that exists)
- **Wave 5 (after 250):** Phase 251 redesign legs (CACHE-02/03; CACHE-01 measurement already filed)
- **Wave 6 (strictly LAST, after 249 + 250 + 251):** Phase 252 (same release as 250's amendment)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 246. Live Verification + Graph Census | 0/2 | Not started | - |
| 247. Brain Surface Contract | 2/3 | In Progress|  |
| 248. MCP-First Room Resolution | 1/2 | In Progress | - |
| 249. Context-Driven Enrichment | 2/3 | In Progress|  |
| 250. Honesty Rail + Doctrine Amendment | 0/TBD | Not started | - |
| 251. Cache-Aware Trigger Redesign | 0/TBD | Not started | - |
| 252. Guard Sweep | 0/TBD | Not started | - |

**Coverage:** 19/19 v2.0.0 requirements mapped (LOOP-01..02 -> 246; CONTRACT-01..04 -> 247; CTX-01..03 -> 248; ENRICH-01..04 -> 249; HONEST-01..03 -> 250; CACHE-01..03 -> 251; SWEEP-01..03 -> 252). No orphans, no duplicates. Requirement source: `.planning/REQUIREMENTS.md` Traceability.

**Hygiene items (schedulable inside any phase, not requirements of the loop):** suspend the old `mindrian-brain` Render service + delete the dead `~/.claude.json` entry; file the upstream Claude Code `updatedToolOutput` bug report. Both carried from the handoffs, still open.
