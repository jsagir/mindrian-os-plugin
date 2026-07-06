# Phase 215: Eureka Portfolio-Scale FUSION - Research

**Researched:** 2026-07-06
**Domain:** Portfolio-scale batch scoring + cross-domain combine over a real tech-transfer catalog (JHU/JHTV, 2117 technologies)
**Confidence:** HIGH (the plan is strongly corroborated by the room's own prior art; the two thin spots - AHP mechanics and the weak-signal claim - are now web-cited, not assumed)
**Task type:** VALIDATION of the ROADMAP approach against room prior art (per navigator directive), online research only where the room left a genuine gap.

---

## Summary

The ROADMAP's Phase 215 approach - **three-dimension scoring (strategic fit / validated demand / technical-economic feasibility) via AHP pairwise weighting, plus an explicit low-attention/high-growth-rate "weak-signal tail" flag instead of a flat top-N ranking** - is **not a new invention this phase must derive.** Every load-bearing piece of it is already written down, and it is written down in two places that agree with each other: SEED-048's own 2026-07-04 standalone WebSearch (which is where the 3-dimension structure, AHP, and the weak-signal thesis originally entered the plan), and the room's `2026-07-06-jhtv-d15` entry (which supplies the canonical Opportunity Statement output shape, the two real draft statements that are this phase's acceptance workload, and the 2117-tech real scale).

The validation verdict: the plan **AGREES** with prior art on the output shape, the reuse-before-build posture, the 3-dimension score, and the "surface the tail, do not just rank the top" instruction. It **CONFLICTS** with the room's operational reality in exactly one place the plan does not currently acknowledge - **the automated scoring pipeline the whole seed rests on cannot yet run at 2117-node scale end-to-end.** The `jhtv-d15` entry found the embedding-spine OOM and the vec0 offline failure; the follow-up `phase212-blockers-fixed` entry confirms BOTH were fixed on `main` (commits `c222ff7d`, `73698c73`). So the conflict is now closed at the infra layer, but Phase 215 still inherits a hard dependency: it must run the real MiniLM pass against the 2117-tech room and confirm the two manual draft statements reproduce, before any AHP layer on top means anything. The manual drafts exist precisely because the automated path was blocked; Phase 215's job is to make them automated and ranked.

One genuine open design question the room does NOT resolve, surfaced by the directive: should the AHP 3-dimension score **combine with** structural-hole betweenness (Burt) to flag the tail quadrant? The room gives Burt constraint/effective-size as the Phase 212.5 whitespace method, and the visual payoff (hub C04371, degree 44) is exactly a structural-hole signature. My inference: yes, they are complementary and should compose, but that is a plan-time decision, not a settled prior-art fact - see Open Questions.

**Primary recommendation:** Treat this phase as *wiring an already-specified scoring layer onto an already-fixed pipeline against an already-drafted acceptance set* - not as research into how to score. Reuse FUSION (205) + RS (200) + harness (201) + the 211 room-report runner per Canon Part 7. Store every candidate in the canonical Opportunity Statement shape (SEED-048 addendum, commit `360e4826`). Gate the tail-quadrant flag as a distinct output category, not a ranking tweak. Validate against the two real JHU pairs (arrhythmias C16796xC03552, cerebral-aneurysm C16742xC05004) as the acceptance workload.

---

## User Constraints

> No CONTEXT.md exists for Phase 215 (confirmed: `.planning/phases/215-.../` contains only this RESEARCH.md). Constraints below are derived from the ROADMAP scope + SEED-048 + CLAUDE.md Canon, treated with locked-decision authority per the standing navigator rule.

### Locked (from ROADMAP + SEED-048)
- **Three scored dimensions, not one flat score:** strategic fit / validated demand / technical-economic feasibility. [CITED: `.planning/ROADMAP.md` line 2964; SEED-048 line 32]
- **AHP pairwise weighting** for the shared question set (Mullins/Thiel/HEART/JTBD), not an ad-hoc 0-10 rubric. [CITED: SEED-048 line 33]
- **Explicit weak-signal tail flag:** surface high-growth-rate/low-average-attention candidates as a *distinct flagged category*, mirroring SEED-049's differential logic but over attention/growth signals. Do NOT just rank top scorers. [CITED: SEED-048 line 30; ROADMAP line 2964]
- **Canonical Opportunity Statement output shape** for every ranked candidate (the addendum formula, commit `360e4826`). [CITED: SEED-048 lines 40-52]
- **Reuse before build (Part 7):** reuse FUSION (Phase 205), RS (Phase 200), harness fan-out (Phase 201); mint no new engine. [CITED: SEED-048 line 20]
- **Part 8 boundary:** LOCAL per-room; only generic handles egress. The batch runs over the local room.db; no room bytes cross to the Brain. [CITED: SEED-048 line 20; CLAUDE.md Part 8]
- **Depends on Phases 211-214.** [CITED: ROADMAP line 2966]

### Claude's Discretion
- Whether the AHP weight vector is elicited once (fixed frozen weights) or per-run; consistency-ratio handling (see Pitfall 2).
- Whether the tail-quadrant flag composes structural-hole betweenness with the 3-dim score (see Open Q1).
- Batch execution shape: harness fan-out (one agent per tech, Part 201) vs the single-process 211 room-report full-matrix runner. The 211 runner already enumerates all cross-boundary pairs in one process; fan-out is the SEED's original framing but the 211 runner may already be sufficient at 481-node scale.

### Deferred / OUT OF SCOPE
- The stage-gate *routing UI / Vercel per-technology page* (SEED-048 line 17-19 proposed scope) is portfolio-triage surface, not scoring; it can ride a later phase. Phase 215's core is the *score + the tail flag + the banked statement*, not the operational mock-up.
- Multi-user / team permissions (the "controlling page" Oliver wanted) - named as an OPEN PRODUCT GAP in the testers synthesis, explicitly punted to product. [CITED: testers-synthesis line 237]

---

## Validation Verdict: ROADMAP approach vs room prior art

> This is the primary deliverable. Each row states AGREE / CONFLICT / GAP and which source answered it (room / web / code).

| ROADMAP claim | Verdict | Source that answered | Detail |
|---|---|---|---|
| 3-dimension score (strategic fit / validated demand / tech-econ feasibility) | **AGREE** | room (SEED-048 line 32) + web | The 3-dim structure is already locked in the seed; web confirms it maps to standard innovation-portfolio stage weighting (strategic fit at idea stage, market/customer validation at discovery, feasibility/unit-economics at scaling). [SEED-048 line 32; [Ricardo Vargas, AHP portfolio selection](https://ricardo-vargas.com/articles/analytic-hierarchy-process/)] |
| AHP pairwise weighting for the score | **AGREE (was GAP, now web-cited)** | web (room silent) | The room does NOT hold AHP - grep-clean across `research/`. It entered via SEED-048's own 2026-07-04 WebSearch, previously un-URL'd. Now cited: AHP (Saaty) is a structured pairwise-comparison weighting method, standard for portfolio/stage-gate criteria weighting. [[TransparentChoice AHP guide](https://www.transparentchoice.com/analytic-hierarchy-process); [Ricardo Vargas](https://ricardo-vargas.com/articles/analytic-hierarchy-process/)] |
| Weak-signal tail: "the gem hides in the low-attention/high-growth tail" | **AGREE (was GAP, now web-cited)** | web (room silent) | The room does NOT hold the weak-signal patent research - grep-clean. It entered via SEED-048's WebSearch, previously un-URL'd. Now cited: "patents related to weak rather than strong signals are more likely to be high-impact innovations"; weak signal = low average proportion + high growth rate. This is a direct empirical validation of the tail thesis. [[Identifying entrepreneurial discovery processes with weak and strong technology signals, PMC10445809](https://pmc.ncbi.nlm.nih.gov/articles/PMC10445809/); [Discovering weak signals of emerging topics, ScienceDirect S0306457324001535](https://www.sciencedirect.com/science/article/pii/S0306457324001535)] |
| Canonical Opportunity Statement output shape | **AGREE** | room (jhtv-d15 section 3) | The exact formula is written and committed (`360e4826`); Brain independently routed it to "PWS Value Proposition" (confidence 0.90, Part 8 generic query). [jhtv-d15 lines 43-45; SEED-048 lines 40-52] |
| "Combine three low into one high" (cross-domain combine) | **AGREE** | room (SEED-048) + web | Named in the seed; web supplies the methodological ancestor (Portfolio-based Technology Opportunity Discovery / technology-convergence networks). The combine reasons over WHICH dimension was weak - two techs each weak on market fit but strong on feasibility can combine. [SEED-048 lines 31-32] |
| Reuse FUSION/RS/harness, mint no engine | **AGREE** | code | `lib/core/fusion-router.cjs` (205), `lib/core/rs-differential-scorer.cjs` (200), `lib/core/chain-executor.cjs::runChain` (201), `scripts/eureka-room-report.cjs` (211 full-matrix runner) all exist and are the reuse surface. [repo, verified] |
| Runs at the real 2117-tech JHU scale | **CONFLICT (now resolved at infra layer)** | room (jhtv-d15 s2 + phase212-blockers) | jhtv-d15 found the automated pipeline could NOT complete end-to-end at 2117 nodes (embedding OOM ~26.7GB; vec0 offline fail). phase212-blockers-fixed confirms BOTH fixed on main (`c222ff7d` batching, `73698c73` vec0 probe). Phase 215 STILL inherits the obligation to run the real MiniLM pass and reproduce the two manual drafts. The plan does not currently name this dependency. [jhtv-d15 lines 28-33; phase212-blockers lines 20-35] |
| An AHP implementation may already exist to reuse (Part 7) | **GAP - none exists** | code | grep-clean: no AHP / analytic-hierarchy / pairwise-weighting scorer anywhere in `lib`/`scripts`/`data`. The only "pairwise" hits are sklearn cosine-similarity (RS engine), unrelated. AHP is genuinely net-new code for this phase - a small deterministic CJS module, not an engine. [repo grep, verified] |
| Tail flag should combine with structural-hole betweenness (Burt) | **GAP - open design question** | room (whitespace entry) + my inference | The room gives Burt constraint/effective-size as the *212.5 whitespace* method and the hub C04371 (degree 44) as the visual payoff, but never says the *215 AHP score* should compose with it. [my inference]: they are complementary - see Open Q1. [whitespace-structural-holes lines 49-54, 79-81] |

**Net:** the ROADMAP approach is CORRECT and well-grounded. No architecture change. The one thing the plan must ADD that it does not currently state: a real-scale reproduction gate (run the fixed pipeline against the 2117-tech room, confirm the two manual drafts) as the acceptance spine, because the manual drafts only exist *because* that path was blocked when they were written.

---

## Phase Requirements

> ROADMAP lists Requirements as TBD; no REQUIREMENTS.md exists for this milestone. No requirement IDs were provided. The planner derives requirements from the ROADMAP goal + SEED-048 + this validation table.

---

## Standard Stack

### Core (all already in-repo - Part 7 reuse, zero new runtime deps)
| Component | Location | Purpose | Why reuse |
|---|---|---|---|
| FUSION router | `lib/core/fusion-router.cjs` (205) | cross-frame combine (HORIZONTAL/LATERAL) | the "combine low into high" engine already exists; Part 7 |
| RS differential scorer | `lib/core/rs-differential-scorer.cjs` (200) | signed semantic/lexical differential; `scoreMeasured(a,b,{vectors})` | the per-pair bridge signal; already full-matrix (embed once, score many) |
| Room-report runner | `scripts/eureka-room-report.cjs` (211) | index -> embed once -> enumerate cross-boundary pairs -> ranked top-N md | the batch runner already exists; Phase 215 adds the 3-dim AHP layer + tail flag on its output |
| Chain executor | `lib/core/chain-executor.cjs::runChain` (201) | harness fan-out, bounded retry | if fan-out (one agent per tech) is chosen over single-process |
| Embedding spine | `lib/core/eureka/embedding-spine.cjs` | batched MiniLM (now `MINDRIAN_EMBED_BATCH`, default 32) | the OOM fix that makes 2117-scale possible |
| Vector store | `lib/core/eureka/vector-store.cjs` | probe-based sqlite-vec backend select | the vec0 fix (probe not table-existence) |
| Navigation chokepoint | `lib/core/navigation.cjs` | all typed edge read/write | Part 9 - the banked statement + score become graph data through here |

### Net-new (small, deterministic, NOT an engine)
| Component | Purpose | Why net-new is justified |
|---|---|---|
| AHP weight module | pairwise-comparison -> criteria weight vector over the 3 dimensions; total score = weights . dimension-scores | grep confirms no AHP exists; it is ~1 deterministic CJS file (Saaty eigenvector or geometric-mean approximation + consistency ratio), not a shared engine. Part 7 satisfied: reuse searched, none found. |
| Tail-quadrant classifier | flag low-average-attention / high-growth-rate candidates as a distinct category | mirrors SEED-049's differential (bert-high/lexical-low) but over attention/growth axes; a classifier over existing signals, not a new retrieval path |

**No `npm install` required.** This phase adds no external package (CJS + Node built-ins, per CLAUDE.md convention). **Package Legitimacy Audit is therefore N/A** - no external packages installed.

---

## Architecture Patterns

### Data flow (validated against the 211 runner + SEED-048 shape)

```
JHU catalog (room.db: 2117 claim nodes, real descriptions)
   |
   v
[211 runner] index -> embed ONCE (batched MiniLM) -> read vectors back
   |
   v
enumerate CROSS-BOUNDARY pairs (differ in root-domain OR node type)
   |
   +--> [RS scoreMeasured] signed semantic/lexical differential per pair  --> bridge signal
   |
   +--> [FUSION combine] where two low-scorers share job/structure       --> "three low into one high"
   |
   v
[AHP 3-dim scorer]  strategic fit | validated demand | tech-econ feasibility
   |                (weights from pairwise comparison, consistency-checked)
   v
   +--> RANK top-N (the obvious list)
   +--> [TAIL classifier] low-attention/high-growth quadrant  --> DISTINCT flagged category
   |
   v
[Opportunity Statement] canonical shape per candidate (360e4826)
   |  gated by SEED-050 critic (real, not confident noise) before banked
   v
banked, ranked candidate bank (score + which-dimension-was-weak + next steps)
```

**The real ranking substrate that already exists:** `evals/eureka/jhtv-idea-graph.json` - **481 nodes, 1362 edges** (verified), edge types `CONVERGES` (1038, the lens3 cross-domain pairs) + `CO_INVENTED` (324, the lens1 inventor bridges). Hub **C04371 = degree 44** (verified), median degree 4. This is the pre-built, cited, real substrate for the ranking/tail work - NOT the full 2117 (it is the subset of technologies appearing in a lens3 cross-domain pair). Built by `scripts/csv-idea-graph.cjs` (Part 8 clean: local CSV read + local write, zero network). [repo, verified]

### Pattern: the tail flag is a category, not a sort key
The weak-signal research is explicit - the gem is *disproportionately* in the low-attention tail, so a top-N sort actively buries it. Emit two lists: the ranked top-N AND the tail-quadrant flags. This mirrors SEED-049's differential (high semantic + low lexical = a real bridge, not a paraphrase) applied over attention/growth instead of semantic/lexical axes. [SEED-048 line 30]

### Anti-patterns to avoid
- **Flat single score.** The seed explicitly rejects it; you lose the ability to reason about WHICH dimension was weak, which is what the combine logic needs. [SEED-048 line 32]
- **Ranking-only output.** Buries the tail gem - the exact failure the weak-signal research warns against.
- **Re-deriving the combine logic.** FUSION (205) already does cross-frame combine; do not rebuild it. [SEED-048 line 44]
- **Trusting stale derived vectors.** The 211 runner already hit this (a prior offline run's stub vectors bled into a LIVE-labeled report). Gate on `idx.embedded === true`. [211-05-SUMMARY, fix `a1e13182`]

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Cross-domain pair combine | a new combine engine | `fusion-router.cjs` (205) | Part 7; the FUSION HORIZONTAL/LATERAL move is exactly "combine low into high" |
| Per-pair bridge signal | a new similarity scorer | `rs-differential-scorer.cjs::scoreMeasured` (200) | already full-matrix, already Part-8 figure-guarded |
| Batch enumeration + ranked report | a new runner | `scripts/eureka-room-report.cjs` (211) | already enumerates cross-boundary pairs and writes ranked top-N md |
| Structural-hole / betweenness (if used for tail) | a new graph-metrics lib | Burt constraint + effective size over `navigation.cjs` edges (the 212.5 method) | computable purely from the graph's own edges, no external vocabulary; immune to the SEED-018 degeneracy |
| The output statement | a new template | the canonical Opportunity Statement shape (`360e4826`) | already committed, already Brain-routed to PWS Value Proposition |

**Key insight:** Phase 215's only genuinely-new code is the AHP weight module and the tail classifier - both small, both deterministic. Everything else is composition of shipped engines. If a plan proposes a "portfolio scoring engine," that is a Part 7 violation.

---

## Runtime State Inventory

> This is a CODE + ARCH phase (not a rename), but it consumes real production data at scale, so the equivalent "what state must exist for this to run" audit applies.

| Category | Items found | Action required |
|---|---|---|
| Stored data | `jhtv-oliver-kuntz` room.db: 2117 real `claim` nodes with substantial `properties.text` (1800-2300 chars each), imported by `scripts/import-jhu-tech-csv.cjs`. VERIFIED present. | none - this is the acceptance workload; run against it |
| Derived index state | `eureka_*` / `eureka_vec*` tables persist in room.db across runs; stale stub vectors can bleed into a LIVE report | gate on `idx.embedded===true` (already fixed, 211 `a1e13182`); consider a `--fresh` reindex before the acceptance run |
| Source CSVs | `/mnt/c/Users/jsagi/Downloads/jhu-tech/` - `lens3_crossdomain_pairs.csv` (pre-computed cross-domain candidates), `jhu_technologies_engine.csv` (2117 descriptions), `lens1_inventor_clusters.csv`. VERIFIED present. | none - read-only inputs |
| Pre-built substrate | `evals/eureka/jhtv-idea-graph.json` (481 nodes / 1362 edges, C04371 deg 44). VERIFIED. | the ranking/tail substrate; may need regenerating if the graph schema changes |
| Model weights | `@huggingface/transformers` MiniLM is declared in package.json but NOT carried into build worktrees (`node_modules` not cross-worktree) | the real MiniLM run requires `npm install` first - this is why 211's real-room run is a navigator checkpoint, and Phase 215 inherits the same gate |
| Critic gate | SEED-050 critic (Phase 212, shipped) must pass each Eureka before it becomes a banked Opportunity Statement | wire the 215 output through the `eureka_critic` path; the two manual drafts have NOT yet passed the critic - treat them as unverified until they do [jhtv-d15 line 62] |

**Nothing found:** no OS-registered state, no secrets/env changes (the only env knob is `MINDRIAN_EMBED_BATCH`, already shipped).

---

## Common Pitfalls

### Pitfall 1: assuming the pipeline runs at scale because the infra bugs are "fixed"
**What goes wrong:** the embedding OOM and vec0 bugs are fixed on main, but that was verified against a 261-node dogfood room and unit tests, NOT against the 2117-tech JHU room end-to-end with the real MiniLM encoder. The two Opportunity Statements in the room are still MANUAL (built by hand from the CSVs) precisely because the automated tri-modal path could not run. [jhtv-d15 lines 47-49]
**How to avoid:** make "run the real MiniLM pass against the 2117-tech room and reproduce the two manual drafts" an explicit acceptance task, not an assumption. This is the single most load-bearing gate for the whole phase.
**Warning sign:** any plan that scores candidates without first proving the substrate embeds and enumerates at full scale.

### Pitfall 2: AHP consistency at 2117 x 2117 scale
**What goes wrong:** AHP pairwise comparison is O(n squared) in the number of items compared; naive AHP over 2117 technologies (~2.24M pairs) is intractable and inconsistent. [ROADMAP line: "2117 technologies (~2.24M possible pairs)"]
**Root cause:** AHP's pairwise strength is in weighting a SMALL number of CRITERIA, not ranking thousands of alternatives. [[TransparentChoice: when NOT to use pairwise comparisons in AHP](https://blog.transparentchoice.com/analytic-hierarchy-process/when-not-to-use-pairwise-comparisons-in-ahp)]
**How to avoid:** use AHP ONLY to weight the 3 dimensions (a 3x3 comparison matrix - trivial, one consistency check). Then score each technology on each dimension independently and combine `score = weights . dimensions`. Do NOT pairwise-compare technologies against each other. This is the standard portfolio-AHP pattern (weight criteria once, score alternatives against the weighted criteria). [[Ricardo Vargas, AHP portfolio](https://ricardo-vargas.com/articles/analytic-hierarchy-process/)]
**Warning sign:** any design that builds a pairwise matrix over technologies rather than over the 3 criteria. Also compute Saaty's Consistency Ratio on the 3x3 and reject CR > 0.1.

### Pitfall 3: the tail flag collapsing into noise on a sparse subgraph
**What goes wrong:** the same SEED-018 degeneracy the whitespace research documents - if the tail/whitespace signal is defined by ABSENCE against a large external vocabulary, a sparse subgraph makes almost everything look like a gap.
**How to avoid:** if betweenness/structural-hole is used for the tail, compute it from the graph's OWN edges (Burt constraint / effective size), which is self-limiting on sparse graphs - it honestly degrades to "not much whitespace yet" rather than a noise fountain. Report "insufficient structure" below a minimum cluster count; never fabricate. [whitespace-structural-holes lines 56-75]
**Warning sign:** a tail list that returns hundreds of "gems."

### Pitfall 4: banking an unverified Eureka as an Opportunity Statement
**What goes wrong:** a surprising pair is a curiosity, not a bankable opportunity. The two manual drafts in the room are explicitly flagged as NOT yet run through the SEED-050 critic. [jhtv-d15 line 62]
**How to avoid:** every candidate passes the critic (real vs confident-noise) BEFORE it is stored in the Opportunity Statement shape. The critic is the gate between Eureka and banked statement. [SEED-048 lines 46-52]

---

## State of the Art

| Old approach | Current approach | Source |
|---|---|---|
| Flat 0-10 vibe score | 3-dimension score with AHP-weighted criteria | SEED-048 line 33; web-confirmed |
| Rank by top score | ALSO surface the low-attention/high-growth tail as a distinct category | weak-signal patent research (web) |
| Invent the combine logic | reuse FUSION cross-frame combine (205) | SEED-048 line 44 |
| sqlite-vec needs Node >=23.5 (WRONG, was in 212-RESEARCH) | loads on Node 22.22 via better-sqlite3 + allowExtension | phase212-blockers-fixed section 2 (self-correction, `vec_version()=0.1.9`) |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | AHP should weight only the 3 dimensions (3x3 matrix), not pairwise-compare technologies | Pitfall 2 | if the plan tries pairwise over 2117 techs it is intractable; this is my inference from AHP scaling literature, strongly supported but a design call |
| A2 | The tail-quadrant flag should COMPOSE structural-hole betweenness (Burt) with the 3-dim AHP score | Open Q1 | if they should NOT compose, the tail flag is purely attention/growth-based and simpler; genuinely open |
| A3 | The 481-node idea-graph (not the full 2117) is an adequate ranking substrate for the acceptance run | Architecture | the full 2117 may surface tail gems the 481-subset omits; the 481 is only the lens3-paired subset |
| A4 | The 211 full-matrix runner is sufficient and harness fan-out (201) is optional | Standard Stack | if per-tech deep analysis (one FUSION/RS pass each) is required, fan-out is needed and single-process is insufficient |

**Note on A1/A2:** these are the two design calls the room does NOT settle. Everything in the Validation Verdict marked AGREE is prior-art-backed; A1-A4 are where the planner must decide or the navigator must confirm.

---

## Open Questions

1. **Should the tail-quadrant flag compose AHP score with structural-hole betweenness (Burt)?** [the directive's explicit question]
   - What we know: the room gives Burt constraint/effective-size as the *Phase 212.5 whitespace* method (computable from the graph's own edges, immune to the SEED-018 degeneracy). The hub C04371 (degree 44) is literally a structural-hole/high-betweenness signature - "the portfolio-fusion payoff made visual." The weak-signal research defines the tail by attention/growth, a different axis.
   - What's unclear: whether the tail flag = attention/growth quadrant ALONE, or attention/growth AND structural-hole position (a technology that is both under-watched AND bridges disconnected clusters is the strongest gem candidate).
   - Recommendation [my inference]: **compose them.** Attention/growth answers "is anyone watching this?"; betweenness answers "does connecting it unlock non-redundant value?" A gem is under-watched (weak signal) AND a broker (structural hole). But this is a plan-time decision - flag it for the discuss/plan step, do not assume. The Burt machinery is a Phase 212.5 deliverable, so a 215-212.5 dependency may exist if composition is chosen.

2. **Full 2117 vs the 481-node lens3 subset for the acceptance run?**
   - What we know: the 481-node graph is pre-built and cited; the full 2117 is in room.db.
   - Recommendation: run the ranked/AHP layer against the 481-node substrate for the fast loop, but the real-MiniLM reproduction gate (Pitfall 1) must hit the full 2117 room.db to confirm the manual drafts reproduce.

3. **Fan-out (201) vs single-process (211 runner)?**
   - What we know: SEED-048's original framing is one agent per technology (fan-out). The 211 runner already does full-matrix single-process.
   - Recommendation: single-process 211 runner is likely sufficient at this scale; reserve fan-out for if per-tech deep FUSION/RS analysis is required. Decide at plan time (A4).

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | all | yes | v22.22.2 | - |
| better-sqlite3 + sqlite-vec | vector store | yes (loads on Node 22) | vec0 v0.1.9 | offline stub encoder (deterministic) |
| `@huggingface/transformers` MiniLM | real semantic embeddings | declared, NOT in build worktree | ^4.2.0 | `npm install` required; else stub encoder (not embedding-quality) |
| JHU CSVs | acceptance substrate | yes | - | - |
| `jhtv-oliver-kuntz` room.db (2117 nodes) | acceptance workload | yes | - | - |
| SEED-050 critic (`eureka_critic`) | gating statements | yes (Phase 212 shipped) | - | - |

**Blocking with fallback:** the real MiniLM run needs `npm install` first (same gate as 211's navigator checkpoint). Without it, the offline stub produces real pairs but stub semantics - NOT acceptance-grade.

---

## Validation Architecture

> nyquist_validation is true in config. Included.

### Test Framework
| Property | Value |
|---|---|
| Framework | bash aggregators + node assertion scripts (house pattern) |
| Config file | none - `tests/run-all-<phase>.sh` convention |
| Quick run | `node tests/test-215-<unit>.cjs` |
| Full suite | `bash tests/run-all-215.sh` (to be created, modeled on `run-all-211.sh`) |

### Requirements -> Test Map
| Behavior | Test type | Command | Exists? |
|---|---|---|---|
| AHP weights the 3 dimensions, CR<=0.1 | unit | `node tests/test-215-ahp-weights.cjs` | Wave 0 |
| 3-dim score composes correctly | unit | `node tests/test-215-score.cjs` | Wave 0 |
| Tail-quadrant classifier flags low-attn/high-growth as distinct category | unit | `node tests/test-215-tail.cjs` | Wave 0 |
| Opportunity Statement emitted in canonical shape | unit | `node tests/test-215-opp-statement.cjs` | Wave 0 |
| Real-scale reproduction: 2117-tech run reproduces the two manual drafts | integration / human-verify | `node scripts/eureka-room-report.cjs --db jhtv-oliver-kuntz ...` + navigator spot-check | Wave 0 (blocking checkpoint) |
| Phase aggregator green | suite | `bash tests/run-all-215.sh` | Wave 0 |

### Sampling
- Per task commit: the relevant `node tests/test-215-*.cjs`
- Per wave merge: `bash tests/run-all-215.sh` + `bash tests/run-all-211.sh` (no regression on the dependency)
- Phase gate: full suite green + the real-MiniLM navigator spot-check verdict recorded

### Wave 0 gaps
- [ ] `tests/test-215-ahp-weights.cjs` - AHP 3x3 + consistency ratio
- [ ] `tests/test-215-tail.cjs` - tail-quadrant classifier
- [ ] `tests/test-215-opp-statement.cjs` - canonical shape
- [ ] `tests/run-all-215.sh` - aggregator (model on run-all-211.sh)
- [ ] Framework: `npm install` to bring MiniLM into the worktree for the real acceptance run

---

## Security Domain

> security_enforcement not set in config (absent = enabled). This phase adds no auth, no network endpoint, no user-input surface beyond local CSV/room.db reads.

### Applicable ASVS
| Category | Applies | Control |
|---|---|---|
| V5 Input Validation | yes | CSV/room.db text parsing already goes through the vetted `parseCsv` (RFC4180) + `scoreMeasured`'s Part 8 figure-guard (throws `ExternalEgressViolation` on K/M/B money figures) |
| V6 Cryptography | no | - |
| V2/V3/V4 auth/session/access | no | LOCAL-only, no auth surface |

### Threat patterns
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Room content leaking to Brain via a generic-methodology query | Information disclosure | Part 8 boundary: only generic handles egress; the batch runs LOCAL; the 211 runner makes zero network calls (verified: 0 URLs in source) |
| Real financial figures (market-size in Opportunity Statements) egressing | Information disclosure | `scoreMeasured` Part 8 figure-guard already catches K/M/B patterns and skips+counts the pair rather than aborting |
| Stale derived vectors mislabeled as LIVE | Tampering / integrity | gate on `idx.embedded===true` (211 fix `a1e13182`) |

---

## Sources

### Primary (HIGH - room prior art, absolute paths)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula/2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula.md` - sections 2 (the scale conflict), 3 (Opportunity Statement formula), 4 (the two real draft statements = acceptance workload)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-whitespace-structural-holes-algorithm/2026-07-06-whitespace-structural-holes-algorithm.md` - Burt constraint/effective-size, the SEED-018 degeneracy avoidance
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-phase212-blockers-fixed-node22-vec0-correction/...md` - confirms both infra blockers fixed (`c222ff7d`, `73698c73`) + the Node-floor self-correction
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-testers-and-investors-synthesis/...md` - the career-making vision (Oliver/Lawrence), the portfolio-operator gap, team-gap deferred
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-reverse-salient-ratification-gap/...md` - reverse-salient at portfolio scale (verdict->action gap)
- `.planning/seeds/SEED-048-portfolio-scale-fusion.md` - the seed (3-dim score, AHP, weak-signal thesis, Opportunity Statement addendum `360e4826`)

### Code (HIGH - repo, verified this session)
- `scripts/csv-idea-graph.cjs` + `evals/eureka/jhtv-idea-graph.json` (481 nodes / 1362 edges / C04371 deg 44 - node-verified)
- `scripts/eureka-room-report.cjs` + `.planning/phases/211-.../211-05-SUMMARY.md` (the full-matrix runner + its fixes)
- `lib/core/fusion-router.cjs` (205), `lib/core/rs-differential-scorer.cjs` (200), `lib/core/chain-executor.cjs` (201)
- grep verification: no AHP/analytic-hierarchy implementation exists in-repo

### Secondary (MEDIUM - web, closing the two room gaps)
- [Identifying entrepreneurial discovery processes with weak and strong technology signals (PMC10445809)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10445809/) - "patents related to weak rather than strong signals are more likely to be high-impact innovations"
- [Discovering weak signals of emerging topics, ScienceDirect S0306457324001535](https://www.sciencedirect.com/science/article/pii/S0306457324001535) - weak signal = low average proportion + high growth rate
- [Ricardo Vargas - AHP to select and prioritize portfolio projects](https://ricardo-vargas.com/articles/analytic-hierarchy-process/) - weight criteria, score alternatives, combine
- [TransparentChoice - AHP complete guide](https://www.transparentchoice.com/analytic-hierarchy-process) + [when NOT to use pairwise comparisons](https://blog.transparentchoice.com/analytic-hierarchy-process/when-not-to-use-pairwise-comparisons-in-ahp) - the O(n squared) scaling caveat (Pitfall 2)

---

## Metadata

**Confidence breakdown:**
- Validation verdict (plan vs room): HIGH - every AGREE row is backed by a room path or repo grep; the one CONFLICT is documented in the room itself and its fix is committed
- AHP mechanics: MEDIUM-HIGH - room silent, but web-cited and the scaling caveat is well-established
- Weak-signal tail thesis: MEDIUM-HIGH - room silent, web-cited to peer-reviewed sources
- Tail x structural-hole composition (Open Q1): LOW - genuinely open, my inference only
- Reuse map: HIGH - all engines verified present in-repo

**Research date:** 2026-07-06
**Valid until:** ~2026-08-05 (stable; the room prior art and repo state are current, the two web claims are from stable academic sources)

## RESEARCH COMPLETE
