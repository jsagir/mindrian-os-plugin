# Phase 214: Eureka Pattern-Transfer + Find-Analogies - Research

**Researched:** 2026-07-06
**Domain:** Type-3 pattern transfer (SAPPhIRE/TRIZ analogy) + the ONLINE retrieval leg, wired to the shipped Phase 211 eureka substrate
**Confidence:** HIGH (validation against room prior art + live code; zero claims rest on web-only sources)
**Method:** Room-first per the standing navigator directive. Every major question below was answered by the rethinking-mindrianos room or by live repo code. No online research pass was needed; the one place the room flags itself as insufficient (the un-mirrored analogy-algorithm survey) is logged as an open question, not papered over.

## Summary

Phase 214's ROADMAP approach survives validation against the room's prior art almost intact, with one stale literal, one overstated dependency status, and one genuine unresolved seam. The core claims all check out against live code: `/mos:find-analogies` IS the decorative stub the rebuild-vs-surgery audit said it is (verified in `commands/find-analogies.md` today), the `archimedes-darkmatter` Type-3 gold case IS on disk with its restatement + pseudoscience distractors and a hand-scored baseline, and the Phase 211 engine this leg extends IS shipped (`lib/core/eureka/` five modules, tests green per the room's 2026-07-06 entry). The room's moat-embedding audit and the synthesis both order Phase 214 to execute as a REPLACEMENT of the stub on the one substrate, never a new pipeline, and the ROADMAP agrees.

Three corrections the planner must carry. First, the embedder is `MongoDB/mdbr-leaf-ir`, not `Xenova/all-MiniLM-L6-v2` - SEED-049 D10's model literal is stale against shipped code; reference the spine, never hardcode a model name. Second, the dependency chain is softer than the ROADMAP states: Phase 213 is an empty directory blocked on an unresolved debug track, and Phase 212 is planned but NOT executed (no critic artifacts on disk, despite the 212.5 ROADMAP text claiming the critic "[shipped in 212]" - that claim is false on disk today). Phase 214's command-level scope does not actually need 213; only the sensor-driven auto-routing does. Third, the "online leg vs Part 8" tension resolves cleanly once stated precisely: Part 8's letter governs the Brain wire (held, per the moat audit), the web is the SIGNAL channel, and what crosses outbound is ONLY the SAPPhIRE-abstracted pattern vocabulary - but the Phase 196 runtime hook only matches `mcp__brain_.*`, so the online egress path needs its own fence wiring (reuse `auditQueryString`, do not invent one).

**Primary recommendation:** Plan 214 as (a) wire find-analogies' fitness to the shipped `embedding-spine.cjs` + `scoreMeasured` two-leg fusion (text cosine + SAPPhIRE layer-match structural score), (b) build the online leg as abstracted-pattern-only egress gated through the existing `auditQueryString` fence with graceful degrade when Tavily is absent, (c) gate on the `archimedes-darkmatter` gold card (real bridge surfaces, restatement does NOT outrank it, pseudoscience refused), and (d) decouple from Phase 213 by scoping the sensor/reach wiring OUT (213 owns it).

## Validation Verdict: ROADMAP vs Room Prior Art

The navigator's primary question. Each row states the source that answered it.

| # | ROADMAP/seed claim | Verdict | Evidence |
|---|-------------------|---------|----------|
| V1 | find-analogies default tier is a decorative stub ("fitness 0.78/0.65/0.52 = model-generated decoration") | **AGREES - verified live** | Room: `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` (sec 3b, "FULLY STUBBED at the default tier") + the live Tier-0 self-admission in `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-cross-domain-ratification-analogies/2026-07-05-cross-domain-ratification-analogies.md` ("no fitness score in this document is computed"). Code: `commands/find-analogies.md:122-130` (Tier 0 = "generate 3-5 cross-domain analogies from your training knowledge") and lines 181-187 (the decorative decimals). Both sources and the code agree byte-for-byte. |
| V2 | `archimedes-darkmatter` is the validated Type-3 transfer case from 211's gold set | **AGREES - verified live** | Code: `evals/eureka/cases/archimedes-darkmatter.md` (gold_label arrival Full / salient transferable; restatement + pseudoscience distractors; "seed on the ABSTRACTED PATTERN, never the whole doc"). Baseline scored: `evals/eureka/211-manual-baseline.md:78` (Score 0.95, gold labels match). `211-CONTEXT.md:79` (D8). |
| V3 | Phase 214 extends the shipped 211 generator on ONE substrate (replacement, not a 5th pipeline) | **AGREES** | Room: `02-moat-embedding-audit.md` sec 3c ("Execute Phase 211/215 as a hard REPLACEMENT of ... find-analogies' stub") + `04-synthesis-rebuild-vs-surgery.md` structural change #2 and line ~173 ("a decorative stub in find-analogies"). Code: `lib/core/eureka/{embedding-spine,tri-modal-index,hybrid-retrieve,vector-store,lexical-overlap}.cjs` all shipped. |
| V4 | Embedder is `Xenova/all-MiniLM-L6-v2` (ROADMAP 211 header, SEED-049 D3/D10) | **CONFLICTS - stale literal** | Shipped code: `lib/core/eureka/embedding-spine.cjs:104` `DEFAULT_MODEL = 'MongoDB/mdbr-leaf-ir'` (384-dim, quick 260706-13z spike winner; MiniLM kept in `KNOWN_MODEL_DIMS` for env rollback only). Room lock: `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-phase212-blockers-fixed-node22-vec0-correction/...md` sec 3 ("Embedder locked to MongoDB/mdbr-leaf-ir for threshold calibration"). **Planner: never hardcode a model name in 214 - read the spine's default (`MINDRIAN_EMBED_MODEL` env, `encoderProvenance()`).** |
| V5 | "Depends on: Phase 213, 200, 201, 202, 203" | **PARTIAL CONFLICT - overstated** | Live state: `.planning/phases/213-.../` is EMPTY (no plans); 213 is BLOCKED on `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` (status: gathering, no verdict as of 2026-07-06). Phase 212 is PLANNED-NOT-EXECUTED: all 5 ROADMAP checkboxes unchecked, and `lib/core/eureka-critic.cjs`, `data/eureka-critic-tags.json`, `tests/run-all-212.sh` do NOT exist on disk. The 212.5 ROADMAP goal text saying the critic "[shipped in 212]" is FALSE on disk today. Phases 200/201/202/203 ARE complete (STATE.md ledger flips). See Dependency Reality below. |
| V6 | The online leg is Part-8-compatible, gated by "the Part-8 online fence (196)" (SEED-049 graduation entry) | **AGREES ON PRINCIPLE, GAP IN MECHANISM** | Room: `02-moat-embedding-audit.md` 3a Direction 1 - privacy boundary "HELD, genuinely structural"; the audited seams include `rs-differential-scorer.cjs:316-322` (`auditQueryString` before any bridge) and `commands/whitespace.md:465` (SIGNAL-only, keywords from titles/framework names only). Code: Phase 196 shipped (`lib/core/part8-egress-guard.cjs` + hook), BUT the runtime hook matcher is `mcp__brain_.*` ONLY (`hooks/hooks.json:216,318`) - Tavily/web egress is NOT covered by the 196 hook. 214 must route outbound query strings through the existing `auditQueryString` fence (`lib/core/rs-egress-prompts.cjs`). Detail in the Boundary section. |
| V7 | find-analogies needs TWO fitness signals (text cosine + structural), not one (SEED-049 D10) | **AGREES** | Room rubric exists and is concrete: `references/methodology/sapphire-encoding.md:334-343` (Surface 0.1-0.2 / Behavioral 0.3-0.5 / Structural 0.6-0.8 / Deep 0.8-1.0). The room's live Tier-0 run used exactly this qualitative rubric as its honesty stopgap. D10's acceptance target: measured fitness must rank-order consistently with the qualitative labels. |
| V8 | Node >=23.5 floor constrains sqlite-vec | **REFUTED - do not carry** | Room self-correction: `2026-07-06-phase212-blockers-fixed-node22-vec0-correction` sec 2 - vec0 loads on Node v22.22.2 via better-sqlite3 `allowExtension` (`vec_version()` = 0.1.9 live). The >=23.5 floor applies only to `node:sqlite`'s loadExtension, which the plugin does not use. |
| V9 | Type-3 runs on a THIN or empty room (SEED-049 D9) - no local-graph density floor, unlike Types 1/2 | **AGREES - no conflict with the whitespace research** | SEED-049 D9: Type 3 "needs a problem statement, not a populated graph"; empty rooms route to Type-3 online-only. The room's `2026-07-06-whitespace-structural-holes-algorithm` entry (Burt constraint, internal-edge-only) is Type-2/Phase-212.5 territory - a different mode. 214 must NOT re-implement structural-hole detection; the modes partition cleanly. |
| V10 | Write-back rides 201-03 + temporal delta rides Phase 160 (SEED-049 D11) | **AGREES - verified on disk** | `lib/core/graph-refine-loop.cjs` (dryRun default TRUE, human-gated, navigation.cjs chokepoint) and `lib/core/temporal/{point-in-time,recency-decay,supersession,date-sync-gate,dual-stamp,reference-now}.cjs` all exist. Zero new temporal or write-back infrastructure for 214. |

**Where the room's prior art leaves a genuine gap (the only one):** `00-seed-harvest.md` line 62 flags that the cross-domain/novelty analogy-algorithm surveys are NOT mirrored into the room (live only at mindrian-algorithm-rd.vercel.app). The 2026-07-06 whitespace entry closed the whitespace half of that gap via its own online pass; the ANALOGY half remains un-mirrored. This research does not re-run that survey because SEED-049's own 2026-07-04 validated web pass plus D10's concrete two-leg design already give 214 an executable spec - but the mirror should happen before Phase 215 re-points all lenses (Open Question Q3).

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md`:

- **Workspace guard:** all work in `/home/jsagi/dev/MindrianOS-Plugin/`, never the plugin cache.
- **Canon Part 8:** LOCAL -> BRAIN: NO. Writing user-specific bytes to the Brain is a constitutional breach. Ambiguous features go to separate review, not a flag.
- **Canon Part 7:** reuse before build - the plan must justify any net-new surface against the 25 methodology commands. Phase 214 is explicitly a surgery on an EXISTING command.
- **Canon Part 11 (CIRS):** every invocable surface born WIRED or EXCLUDED with a declared HITL shape. find-analogies already declares `hitl_shape: F.8` + connector block (`commands/find-analogies.md:6,28-39`) - 214 must preserve, not re-mint.
- **Canon Part 12:** Larry offers, never asserts; no grading, no compliments; De Stijl color mark per turn.
- **Tri-Polar rule:** the feature must work on CLI + Desktop + Cowork (find-analogies already declares tri-polar behavior; keep it true when fitness becomes measured).
- **Conventions:** CJS only, no TypeScript; no em-dashes anywhere; bash scripts stay authoritative; ROOM.md identity files; every phase declares `canon_parts:`.
- **Verification:** `bash tests/run-all-214.sh` pattern (aggregator per phase); `node scripts/doctor.cjs --acceptance`; born-wired gates (`build-connector-registry.cjs --check`, `check-render-coverage.cjs`).
- **Dev-Research Compositing:** findings file in BOTH `.planning/phases/214-*/` and `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked. This RESEARCH.md's key verdicts should be mirrored to the room at plan/execute time.
- **GSD workflow:** no direct repo edits outside a GSD command.
- **MCP stack awareness (user memory, HARD RULE):** check the MCP stack and ASK the user before web research at runtime - relevant to the online leg's UX: the `--external` mode should confirm before an outbound fetch pass, consistent with the existing AskUserQuestion firing block already stamped in the command.

## Phase Requirements

ROADMAP lists `Requirements: TBD` and no requirement IDs were provided. Derived behaviors the planner should formalize into requirements:

| Derived Req | Behavior | Research Support |
|-------------|----------|------------------|
| 214-A | find-analogies fitness scores are MEASURED (embedding-spine cosine), not LLM-narrated | V1, V4; SEED-049 D10 |
| 214-B | Two fused fitness legs: text/semantic + SAPPhIRE structural layer-match | V7; `sapphire-encoding.md:334-343` |
| 214-C | Online leg (pattern-abstracted web search) with Part-8-safe egress + graceful degrade | V6; Boundary section |
| 214-D | archimedes-darkmatter gate: real bridge surfaces, restatement does not outrank it, pseudoscience refused | V2; gold card distractor labels |
| 214-E | Verified write-back via graph-refine-loop (201-03), temporal delta via queryAsOf (Phase 160) | V10 |
| 214-F | Rank-order consistency: measured fitness agrees with qualitative Surface/Behavioral/Structural/Deep labels | SEED-049 D10 stopgap acceptance |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SAPPhIRE/TRIZ decomposition of the problem | Command prompt layer (Larry, `commands/find-analogies.md`) | `references/methodology/` (rubric + matrix data) | LLM reasoning task; the typed encoding schema already exists at `sapphire-encoding.md` |
| Text fitness (semantic leg) | LOCAL lib (`lib/core/eureka/embedding-spine.cjs`) | - | Part 8: embeddings over content must be local; spine already shipped |
| Structural fitness (layer-match leg) | LOCAL lib (new thin module or extension in `lib/core/eureka/`) | `sapphire-encoding.md` rubric | Deterministic scoring over typed SAPPhIRE fields; per-field cosine via the same spine |
| Cross-domain candidate retrieval (local room) | LOCAL lib (`hybrid-retrieve.cjs` rrfFuse + rerank) | `tri-modal-index.cjs` | Already shipped; 214 is a consumer, not a builder |
| ONLINE candidate retrieval | SIGNAL channel (Tavily MCP / WebSearch fallback) | `auditQueryString` fence before egress | SIGNAL -> LOCAL: YES; only abstracted pattern vocabulary crosses outbound |
| Brain enrichment (`--brain`) | Brain MCP (existing `brain_search`/cypher patterns) | 196 egress guard hook (already matches `mcp__brain_.*`) | Unchanged from today's command; generic handles only |
| Write-back of validated analogies | LOCAL (`graph-refine-loop.cjs`, navigation.cjs chokepoint) | `lib/core/temporal/` (dual-stamp, date-sync-gate) | Part 9; dryRun default TRUE, human-gated |
| Next-step recommendation after a transfer | `lib/brain/chain-recommender.cjs` (FEEDS_INTO) | - | SEED-049 D9: pass result type as seed; never hardcode a chain |

## Dependency Reality (load-bearing for wave structure)

Verified on disk 2026-07-06:

| Dependency | ROADMAP says | Actual state | Effect on 214 |
|-----------|--------------|--------------|---------------|
| Phase 211 | (implicit via 213) | **COMPLETE + hardened** - `lib/core/eureka/` shipped; both infra blockers fixed (batching OOM, vec0 probe); `run-all-211.sh` PASS=9 FAIL=1 (the 1 is a pre-existing env-dependent rerank leg) | The substrate 214 consumes. Ready. |
| Phase 212 | dependency of 213 | **PLANNED, NOT EXECUTED** - 5 PLAN files exist, zero SUMMARYs, `lib/core/eureka-critic.cjs` absent | 214's outputs are critic INPUTS eventually; 214 does not call the critic at runtime. Not a blocker for the fitness/online work. The 212.5 goal text claiming critic "[shipped in 212]" is wrong today. |
| Phase 212.5 | not listed | REGISTERED, 0 plans | Owns Type-2 structural-hole detection. 214 must not duplicate it. |
| Phase 213 | HARD dependency | **EMPTY DIR, BLOCKED** on curing-sequence debug (status: gathering) | Only the SENS-13 sensor/reach wiring genuinely needs 213. Command-level measured fitness + online leg do NOT. |
| Phase 200 | dependency | COMPLETE (RS discriminator, semantic-floor gate live) | `scoreMeasured` + egress audit available. |
| Phase 201 | dependency (201-03) | COMPLETE - `graph-refine-loop.cjs` on disk | Write-back path available. |
| Phase 202 | dependency | COMPLETE (APO lab) | Fire-rate tuning is a 213 concern; 214 uses nothing from 202 directly at MVP. |
| Phase 203 | dependency | COMPLETE (SENS-11 expert-skill live) | Only relevant to sensor-id hygiene (SENS-13 is 213's, not 214's). |

**Recommendation [my inference, from the verified states above]:** scope Phase 214 so it ships WITHOUT waiting for 213: (wave A) measured two-leg fitness in the command path, (wave B) the online leg + fence, (wave C) write-back + temporal + gold-card gate. Leave the "empty room routes to Type-3 automatically" behavior (SEED-049 D9's routing implication) as an explicit deferred note for 213, which owns sensor routing. If the planner instead honors the literal ROADMAP dependency, Phase 214 is blocked indefinitely behind an unresolved debug track - which contradicts the fact that none of 214's concrete D10 scope touches the 190/202/205 mechanisms under debug.

## Standard Stack

### Core (all already shipped - ZERO new dependencies)

| Library/Module | Version/Location | Purpose | Why standard |
|---------|---------|---------|--------------|
| `@huggingface/transformers` | ^4.2.0 (package.json:22) | Local embeddings via embedding-spine | 211 lock; validated by SEED-049 web pass |
| `sqlite-vec` | ^0.1.9 (package.json:34) | Vector leg (better-sqlite3 `allowExtension`) | 211 lock; Node 22 confirmed working (V8) |
| `lib/core/eureka/embedding-spine.cjs` | shipped | `getEncoder/embedTexts/cosineSimilarity/encoderProvenance`; DEFAULT_MODEL `MongoDB/mdbr-leaf-ir` 384-dim, batch 32 | THE one embedder; env-tunable `MINDRIAN_EMBED_MODEL`, `MINDRIAN_EMBED_BATCH` |
| `lib/core/eureka/hybrid-retrieve.cjs` | shipped | `rrfFuse/hybridRetrieve/rerank` (RRF_K room-tuned) | The fusion + rerank leg for candidate ranking |
| `lib/core/eureka/tri-modal-index.cjs` | shipped | `openIndex/indexNodes/lexicalSearch/vectorSearch/nodeText` | FTS5 + vec over room.db |
| `lib/core/rs-differential-scorer.cjs` | shipped | `scoreMeasured(textA, textB, {vectors})` with Part-8 figure-guard | The measured differential; 211-03 full-matrix reuse path |
| `lib/core/rs-egress-prompts.cjs` | shipped | `auditQueryString/auditQueryObject` -> throws `ExternalEgressViolation` | The outbound-query fence the online leg reuses |
| `lib/core/graph-refine-loop.cjs` | shipped (201-03) | propose -> fact-check -> refine; human-gated write-back | The MOAT loop's write-back half |
| `lib/core/temporal/*` | shipped (Phase 160) | `queryAsOf` (before/after delta), `dual-stamp`, `date-sync-gate`, `recency-decay`, `supersession` | D11: zero new temporal infra |
| `references/methodology/sapphire-encoding.md` | 355 lines | Typed SAPPhIRE encoding + the Surface/Behavioral/Structural/Deep fitness rubric (lines 334-343) | The structural-leg scoring spec |
| `references/methodology/triz-principles.md` + `triz-matrix.json` | 501 lines + data | TRIZ parameter mapping | Already referenced by the command |

### Supporting

| Surface | Purpose | When to use |
|---------|---------|-------------|
| `mcp__tavily__tavily-search` | Online leg fetches (AskNature/patents/academic per the command's existing `--external` spec) | When configured AND user confirms (MCP-stack-awareness rule); NOT in project `.mcp.json` - user-level; was 402-down on 2026-07-04 (SEED-049 verification log) |
| WebSearch fallback | Same job when Tavily unavailable | Navigator-approved precedent (SEED-049 2026-07-04 addendum used exactly this fallback) |
| `mcp__mindrian-brain__brain_search` / cypher | `--brain` enrichment (existing mode) | Unchanged; guarded by the 196 hook |
| `lib/brain/chain-recommender.cjs` | Next-framework lean after a Type-3 result | D9: seed FEEDS_INTO with the result type |
| `scripts/eureka-room-report.cjs` | The 211-05 vertical-slice runner pattern (pair enumeration, figure-guard try/catch, provenance header) | The style template for any 214 report/runner |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Per-field cosine + rubric bands for structural fitness | node2vec / KG-embeddings (SEED-049's architecture table names them for the structural leg) | node2vec needs a populated graph and a training step - heavy for a lens that must run on THIN rooms (D9). Rubric-band layer-match over typed SAPPhIRE fields is deterministic, cheap, thin-room-safe, and directly satisfies D10's rank-order acceptance. Defer node2vec to Phase 215's lens re-point. [my inference on ordering; both options are named in SEED-049 D10] |
| Extending the 196 PreToolUse hook matcher to Tavily tools | Calling `auditQueryString` inline before composing the search query | Hook extension changes a shipped Phase-196 surface and its tests; inline audit reuses the exact seam `rs-differential-scorer.cjs:318` already proves. Inline is smaller blast radius. Either satisfies "the Part-8 online fence"; planner picks. |

**Installation:** none. No new packages. (Version check run: `@huggingface/transformers` ^4.2.0 and `sqlite-vec` ^0.1.9 present in `package.json` [VERIFIED: repo package.json]; both are 211-era locks, not 214 additions.)

## Package Legitimacy Audit

**No new package installs in this phase.** All dependencies are already vendored/locked from Phase 211. slopcheck not run (nothing to check). Any plan task that discovers a need for a new package must re-open this audit and gate the install behind a checkpoint.

## Architecture Patterns

### System Architecture Diagram (Type-3 flow)

```
 problem statement (user or room STATE)
        |
        v
 [SAPPhIRE/TRIZ decomposition]  <- Larry, using references/methodology/
        |                          (typed yaml: state_change, action, parts,
        |                           phenomenon, real_effect, functional_keywords,
        |                           triz_parameters)
        v
 abstracted PATTERN (domain-generic; e.g. "rare-signal-in-vast-background")
        |
        +--------------------+----------------------+
        v                    v                      v
  LOCAL retrieval      ONLINE leg (SIGNAL)     BRAIN (--brain, optional)
  hybrid-retrieve      auditQueryString(q)     brain_search, generic
  over room.db         --> THROW = no fetch    handles only (196 hook)
  (tri-modal-index)    --> pass = Tavily/
        |                  WebSearch fetch
        |                    |
        v                    v
   candidates  <----- merge + dedupe
        |
        v
 [TWO-LEG FITNESS, fused]
   leg 1: text cosine        embedding-spine (DEFAULT_MODEL, never hardcoded)
   leg 2: structural         per-SAPPhIRE-field match -> rubric band
        |                    (Surface .1-.2 / Behavioral .3-.5 /
        v                     Structural .6-.8 / Deep .8-1.0)
 ranked comparison matrix (Body Shape D)  -> restatement trap check:
        |                                    high text-cosine + low structural
        v                                    = flag, never rank #1
 navigator picks (F.8 unordered set, AskUserQuestion firing block)
        |
        v
 [write-back, human-gated]  graph-refine-loop (dryRun TRUE default)
   + dual-stamp + date-sync-gate (dated sources)
   + queryAsOf before/after delta = the eureka signal
```

### Recommended Project Structure

```
lib/core/eureka/
├── embedding-spine.cjs      # existing - consume, do not modify defaults
├── hybrid-retrieve.cjs      # existing - consume
├── tri-modal-index.cjs      # existing - consume
├── analogy-fitness.cjs      # NEW - the two-leg fusion (text + structural rubric)
commands/find-analogies.md   # SURGERY - Tier 0 stays honest-LLM but the fitness
                             #   column becomes measured when the engine runs;
                             #   modes/--brain/--external structure preserved
tests/
├── test-214-analogy-fitness.cjs   # unit: two-leg fusion, restatement ordering
├── test-214-online-fence.cjs      # unit: auditQueryString gates every egress
├── run-all-214.sh                 # aggregator (run-all-211.sh pattern)
```

### Pattern 1: Consume the spine via provenance, never by model name
**What:** every embed call goes through `getEncoder()`/`embedTexts()`; reports carry `encoderProvenance()`.
**When:** all 214 fitness scoring.
**Why:** V4 - the model literal in SEED-049 D10 is already stale once; hardcoding repeats the bug class.

### Pattern 2: Abstraction IS the fence (online egress)
**What:** the ONLY strings composed into outbound web queries are the SAPPhIRE `functional_keywords`, TRIZ principle/parameter NAMES, and the abstracted function description - never artifact bodies, names, or figures. Then `auditQueryString(query)` runs before the fetch; a throw means no fetch, degrade to local-only with an honest note.
**Source precedent:** `rs-differential-scorer.cjs:316-322` (audit before bridge, verified by call-count tests) and `commands/whitespace.md:465` (SIGNAL-only keyword extraction) - both cited as HELD seams by the room's moat audit (3a Direction 1).
**Gold-card proof this works:** `archimedes-darkmatter`'s seed pattern "rare-signal-in-vast-background" is domain-generic by construction - the card itself mandates "seed on the ABSTRACTED PATTERN, NEVER the whole challenge doc" for test-validity reasons that double as boundary hygiene.

### Pattern 3: The restatement trap is a RANKING rule, not just a critic label
**What:** a candidate with high text-cosine but low structural layer-match is the paraphrase signature (`archimedes-darkmatter` distractor: "out-scores the real bridge on raw differential yet is not one"). The fitness fusion must let the structural leg gate the rank - high semantic alone cannot claim Structural/Deep bands.
**Why:** SEED-050's live finding (the 0.49 top-of-matrix paraphrase) and the gold card's `distractor_labels.restatement` both say high differential is NECESSARY, not SUFFICIENT. Phase 212's critic will eventually grade this too, but 214 cannot rank the paraphrase #1 while waiting for a critic that is not yet built (V5).

### Anti-Patterns to Avoid
- **A 5th embedding pipeline:** the moat audit's hard caveat ("must REPLACE, not ADD"). Any new `.py`, any second model default, any new vector dimension = the exact accretion disease.
- **Re-implementing Type-2:** structural-hole/betweenness detection belongs to Phase 212.5 (Burt constraint, internal-edge-only). 214 is pattern transfer OUTWARD, not gap detection inward.
- **Hardcoding a next-step chain after a transfer:** seed `recommendFrameworkChain` with the result type instead (D9).
- **Fabricating fitness when the engine is unavailable:** follow `fusion-router.cjs`'s "NEVER fabricate a differential_score" rule - Tier 0 without the engine stays qualitative (Surface/Behavioral/Structural/Deep prose labels, the room's own honest pattern), never fake decimals. This retires the decorative decimals rather than re-decorating them.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Embedding + cosine | any new encoder path | `embedding-spine.cjs` | One substrate (V3); batching/OOM already solved |
| Candidate fusion/rerank | custom ranking | `hybrid-retrieve.cjs` rrfFuse/rerank | RRF_K already room-tuned |
| Outbound query safety | new regex fence | `rs-egress-prompts.cjs` auditQueryString | Tested seam; FORBIDDEN_PATTERNS shared, no private copies (196 precedent) |
| Before/after research delta | diff mechanism | `temporal/point-in-time.cjs` queryAsOf | D11 explicit |
| Refuted-analogy revision | overwrite | `temporal/supersession.cjs` | History preserved (Decision 14) |
| Write-back | direct db writes | `graph-refine-loop.cjs` -> navigation.cjs | Part 9 chokepoint; pre-commit hook enforces |
| SAPPhIRE schema + rubric | new encoding | `references/methodology/sapphire-encoding.md` | 355 lines already shipped, rubric at 334-343 |
| Eval fixture format | new format | `evals/eureka/cases/*` house pattern | 211-04 convention |

**Key insight:** Phase 214 is almost pure ASSEMBLY. Every hard sub-problem (embed, fuse, fence, write-back, time, encode, eval) has a shipped, tested owner. The only genuinely new code is the two-leg fitness fusion (`analogy-fitness.cjs`, small) and the online-leg orchestration inside the command.

## Common Pitfalls

### Pitfall 1: Trusting the ROADMAP's dependency line literally
**What goes wrong:** 214 waits forever behind 213 (empty, blocked) and 212 (planned-not-executed).
**How to avoid:** Dependency Reality table above; scope the sensor wiring OUT.
**Warning sign:** any plan task that touches SENS-13, `decide()`, or the reach spine - that is 213's contract.

### Pitfall 2: The stale embedder literal
**What goes wrong:** plans copy "Xenova/all-MiniLM-L6-v2" from SEED-049 D10/211-CONTEXT into new code; fitness numbers become incomparable with the calibration lock (mdbr-leaf-ir).
**How to avoid:** V4. Reference `DEFAULT_MODEL` via the spine only.

### Pitfall 3: The paraphrase outranking the bridge
**What goes wrong:** raw `semantic - lexical` differential spikes on synonym-swaps; the gold card's restatement distractor wins.
**How to avoid:** structural leg gates the band (Pattern 3); gold-card gate asserts ordering (214-D).

### Pitfall 4: Online leg leaking local specifics
**What goes wrong:** a "helpful" query includes the venture's product name, a money figure (K/M/B pattern trips the figure-guard - proven live in 211-05's nichefoods deviation), or artifact prose.
**How to avoid:** compose queries ONLY from the abstracted pattern vocabulary; auditQueryString before every fetch; a throw degrades to local-only, never "send anyway" (196's D-01 precedent: no send-anyway verb).

### Pitfall 5: Tavily assumed available
**What goes wrong:** `--external` hard-fails; Tavily is user-level MCP (not in project `.mcp.json`) and was 402-down on 2026-07-04.
**How to avoid:** runtime-detect; WebSearch fallback is navigator-approved precedent; Tier-0 degrade is the floor. Also honor the MCP-stack-awareness rule: ask before web research.

### Pitfall 6: Whole-doc seeding in the eval
**What goes wrong:** seeding find-analogies with the full challenge doc leaks the answer and collapses the darkmatter test (the card says so explicitly).
**How to avoid:** the gate harness seeds `hypothesis_in`'s abstracted pattern verbatim from the card frontmatter.

## Code Examples

### Consuming the spine (provenance-safe)
```js
// Source: lib/core/eureka/embedding-spine.cjs exports (verified on disk)
const spine = require('../eureka/embedding-spine.cjs');
const vecs = await spine.embedTexts([sourceAbstract, candidateText]); // batched, never-throws envelope
const textFitness = spine.cosineSimilarity(vecs[0], vecs[1]);
const prov = spine.encoderProvenance(); // carry model id in every report row
```

### Fenced online egress
```js
// Source pattern: lib/core/rs-differential-scorer.cjs:314-322 (audit-before-bridge)
const { auditQueryString } = require('../rs-egress-prompts.cjs');
function safeOnlineQuery(functionalKeywords, trizPrinciple) {
  const q = `${trizPrinciple} ${functionalKeywords.join(' ')}`; // abstracted vocab ONLY
  auditQueryString(q); // throws ExternalEgressViolation -> caller degrades to local-only
  return q;
}
```

### Structural fitness from the rubric
```js
// Source: references/methodology/sapphire-encoding.md:334-343 band table
// Layers: state_change, action, parts, phenomenon, input, real_effect, effect
// Band: Surface (state only) 0.1-0.2 | Behavioral (+action+phenomenon) 0.3-0.5
//       | Structural (+real_effect) 0.6-0.8 | Deep (all 7) 0.8-1.0
// Per-field: cosine(sourceField, candidateField) >= threshold -> layer corresponds.
// Band position within range = mean of corresponding layers' cosines. [my inference:
// the rubric defines the bands; the per-field-cosine mechanism is the cheapest
// measured implementation consistent with D10's two-leg mandate]
```

### The before/after delta (D11)
```js
// Source: SEED-049 D11 (verified: lib/core/temporal/point-in-time.cjs exists)
const { queryAsOf } = require('../temporal/point-in-time.cjs');
// state BEFORE the fetch landed vs AFTER: the delta IS the eureka signal
```

## State of the Art (repo-local)

| Old approach | Current approach | When changed | Impact on 214 |
|--------------|------------------|--------------|--------|
| find-analogies Tier 0 decorative decimals | measured two-leg fitness (this phase) | 214 | The phase's whole point |
| Xenova/all-MiniLM-L6-v2 default | MongoDB/mdbr-leaf-ir (spike winner, calibration lock) | quick 260706-13z | Never hardcode model names |
| "sqlite-vec needs Node >=23.5" | refuted; better-sqlite3 allowExtension works on Node 22 | 2026-07-06 room correction | Drop the floor from all planning |
| Table-exists vec0 detection | probe-based `ensureVecLoaded()` | quick 260706-5b7 | Vector backend selection is already robust |
| Whole-array embed | batched (default 32, `MINDRIAN_EMBED_BATCH`) | quick 260706-4yl | Production-scale rooms embed safely |
| Part 8 as doctrine | runtime classify() hook on `mcp__brain_.*` | Phase 196 | Brain wire guarded; ONLINE wire still needs inline audit (V6 gap) |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Per-field cosine + rubric bands is an acceptable MVP structural leg (vs node2vec) [my inference, both named in SEED-049 D10] | Alternatives; Code Examples | Fitness ranks disagree with qualitative labels; gate 214-F catches it; node2vec fallback documented |
| A2 | Decoupling 214 from 213 (command-level scope only) is navigator-acceptable [my inference from verified dependency states] | Dependency Reality | If navigator insists on literal ROADMAP order, phase waits on the debug verdict; raise at plan Decision Gate |
| A3 | Inline auditQueryString satisfies "the Part-8 online fence (196)" without extending the hook matcher | Boundary/V6 | If a hook-level guarantee is required, add a PreToolUse matcher for `mcp__tavily__.*` reusing classify(); slightly larger blast radius |

All other claims are [VERIFIED: repo files/lines cited inline] or [CITED: room absolute paths cited inline].

## Open Questions

1. **Does 214 own the "empty room routes straight to Type-3" behavior (SEED-049 D9), or does 213?**
   - What we know: D9 says an empty room should never silently suppress Eureka and should route to Type-3 online-only. Routing is sensor/decide territory (213); the Type-3 capability itself is 214.
   - Recommendation: 214 ships the capability + a manual entry point; 213 wires the automatic routing. Record the seam in both phases' plans.
2. **Should the critic (212) verdict gate 214's ranked output once it ships?**
   - What we know: 212 is planned-not-executed; its Grounding Guard grades `transferable/restatement/pseudoscience` - exactly the darkmatter distractor labels.
   - Recommendation: design `analogy-fitness.cjs` output to carry the abstracted feature vector the critic will consume (differential, structural band, labels), so wiring is a one-line consumer later. Do not block on it.
3. **The un-mirrored cross-domain/novelty algorithm survey** (`00-seed-harvest.md:62`; whitespace half closed 2026-07-06, analogy half still live-site-only).
   - Recommendation: mirror it into the room before Phase 215's lens re-point; 214 proceeds on SEED-049's validated design without it.
4. **Tavily account state** (402 payment-required on 2026-07-04).
   - Recommendation: verify at execute time; WebSearch fallback already precedented.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | Yes | v22.22.2 (room-verified) | - |
| `@huggingface/transformers` | embedding-spine | Yes | ^4.2.0 in package.json | offline stub encoder test seam |
| sqlite-vec (vec0) | vector leg | Yes | 0.1.9 (`vec_version()` live-probed, room entry 2026-07-06) | CJS-cosine honest degrade (shipped) |
| better-sqlite3 allowExtension path | vec0 load | Yes | shipped | probe-based `ensureVecLoaded()` handles absence |
| Tavily MCP | `--external` mode | UNCERTAIN (user-level, 402 on 2026-07-04) | - | WebSearch (navigator-approved precedent); Tier-0 floor |
| Brain MCP | `--brain` mode | Yes (project .mcp.json, alwaysLoad) | - | Tier-0 floor (existing graceful degrade) |
| Plurai evaluators | eval gate | build-time only | - | `baseline_deferred` pattern (196/201/211 precedent) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bash aggregators + plain-Node CJS test files (house pattern, no test framework dep) |
| Config file | none (convention: `tests/run-all-<phase>.sh`) |
| Quick run command | `node tests/test-214-analogy-fitness.cjs` |
| Full suite command | `bash tests/run-all-214.sh` (Wave 0 gap) plus regression `bash tests/run-all-211.sh` |

### Phase Requirements -> Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|-------------|
| 214-A | measured fitness via spine | unit (offline stub encoder, 211 seam) | `node tests/test-214-analogy-fitness.cjs` | Wave 0 |
| 214-B | two-leg fusion | unit | same file | Wave 0 |
| 214-C | egress fence on every online query | unit (assert throw -> no fetch; grep zero network URLs in local path, 211-05 pattern) | `node tests/test-214-online-fence.cjs` | Wave 0 |
| 214-D | darkmatter gate: bridge > restatement; pseudoscience refused | integration (gold-card fixtures, directional truths only with stub encoder - 211-05 Test A pattern) | `node tests/test-214-darkmatter-gate.cjs` | Wave 0 |
| 214-E | write-back via chokepoint, dryRun default | unit | part of fitness/fence suites | Wave 0 |
| 214-F | rank-order matches qualitative labels | integration (rubric fixtures from the room's live Tier-0 run's four candidates) | part of darkmatter gate | Wave 0 |
| regression | 211 substrate untouched | existing | `bash tests/run-all-211.sh` | exists |

### Sampling Rate
- Per task commit: the touched unit test file
- Per wave merge: `bash tests/run-all-214.sh`
- Phase gate: run-all-214 + run-all-211 green + `node scripts/doctor.cjs --acceptance` + no em-dash sweep

### Wave 0 Gaps
- [ ] `tests/run-all-214.sh` aggregator (clone run-all-211.sh shape)
- [ ] `tests/test-214-analogy-fitness.cjs`
- [ ] `tests/test-214-online-fence.cjs`
- [ ] `tests/test-214-darkmatter-gate.cjs`

## Security Domain (Canon Part 8 is the governing standard here)

Generic ASVS categories are subsumed by the project's own constitutional boundary; the applicable controls:

| Boundary | Applies | Standard control |
|----------|---------|------------------|
| LOCAL -> BRAIN | yes (`--brain` mode) | Existing 196 hook (`mcp__brain_.*` matcher) + generic-handles-only queries (existing command Cypher uses categories/problem types only) - unchanged by 214 |
| LOCAL-derived -> WEB (the new surface) | yes (online leg) | Abstracted-pattern-only query composition + `auditQueryString` before every fetch; throw = degrade, never send-anyway (196 D-01 precedent) |
| SIGNAL -> LOCAL | yes (fetched results) | Allowed by Part 8 (`SIGNAL -> LOCAL: YES`); results file locally (whitespace.md:465 precedent: external data LOCAL-only, never to Brain) |
| Write path | yes | navigation.cjs chokepoint only (Part 9); graph-refine-loop human-gated, dryRun TRUE |
| Input validation | yes | `auditQueryObject` for structured payloads; figure-guard patterns (K/M/B) already in FORBIDDEN_PATTERNS |

**Known threat patterns for this phase:**

| Pattern | Category | Mitigation |
|---------|----------|------------|
| Local content leaking into web query strings | Info disclosure | Pattern 2 (abstraction is the fence) + auditQueryString |
| Fetched web content injected into write-back as fact | Tampering | graph-refine-loop's fact-check gate + human gate + date-sync-gate for dated claims |
| Paraphrase ranked as breakthrough | Integrity of output | structural-leg gating + darkmatter gate |
| Fabricated fitness under degrade | Integrity | fusion-router "never fabricate" rule; qualitative labels are the honest floor |

## Sources

### Primary (HIGH confidence - room prior art, absolute paths)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` - sec 3a (privacy boundary held / moat boundary porous), 3b (find-analogies FULLY STUBBED; LOCAL vs BRAIN split), 3c (consolidation verdict, "REPLACEMENT not addition")
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/04-synthesis-rebuild-vs-surgery.md` - structural change #2 (line ~169-189, names the find-analogies decorative stub), verdict consolidation-in-place
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-cross-domain-ratification-analogies/2026-07-05-cross-domain-ratification-analogies.md` - the live Tier-0 honesty note; the Surface/Behavioral/Structural/Deep qualitative practice 214-F formalizes
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/00-seed-harvest.md` - line 62 (un-mirrored analogy-algorithm survey gap)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-whitespace-structural-holes-algorithm/2026-07-06-whitespace-structural-holes-algorithm.md` - Type-2 boundary (212.5's method; 214 must not duplicate)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-06-phase212-blockers-fixed-node22-vec0-correction/2026-07-06-phase212-blockers-fixed-node22-vec0-correction.md` - mdbr-leaf-ir lock, Node-floor refutation, 211 hardening, 212 planned-critic-only

### Primary (HIGH confidence - live repo, verified this session)
- `commands/find-analogies.md` (stub verified: 122-130, 181-187; frontmatter connector/hitl_shape 6, 28-39; whitespace.md:465-analog SIGNAL discipline)
- `evals/eureka/cases/archimedes-darkmatter.md` + `evals/eureka/211-manual-baseline.md:78` + `211-CONTEXT.md` D8/D3
- `lib/core/eureka/embedding-spine.cjs` (DEFAULT_MODEL line 104, exports line 444), `hybrid-retrieve.cjs:235`, `tri-modal-index.cjs:308`
- `lib/core/rs-differential-scorer.cjs:77-93,314-318` (auditQueryString seam), `lib/core/rs-egress-prompts.cjs`, `lib/core/part8-egress-guard.cjs`, `hooks/hooks.json:216,318` (matcher `mcp__brain_.*` only)
- `lib/core/graph-refine-loop.cjs`, `lib/core/temporal/*` (all six D11 modules present)
- `references/methodology/sapphire-encoding.md:334-343` (rubric bands), `triz-principles.md`, `triz-matrix.json`
- `.planning/seeds/SEED-049-...md` (Type-3 definition, graduation Phase 214 entry, D9/D10/D11)
- `.planning/ROADMAP.md:2951-2960` (Phase 214), 2902-2927 (212/212.5), 2931-2949 (213 + blocker)
- `.planning/phases/213-.../` (empty - verified), 212 dir (plans only, no SUMMARYs), `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` (status: gathering)
- `docs/MINDRIAN-CANON.md:264-322` (Part 8 boundary table + breach definition)
- `package.json:22,34` (deps present; zero new installs)

### Secondary / Tertiary
- None. No web research was required; the room and the repo answered every major question. (Which source answered what: stub claim = room + code; gold case = code; embedder = code + room; dependency reality = code; boundary = canon + code + room; two-leg fitness = seed + repo rubric.)

## Metadata

**Confidence breakdown:**
- Validation verdicts (V1-V10): HIGH - every claim checked against live files this session
- Standard stack: HIGH - all shipped, zero new deps
- Structural-leg mechanism (A1): MEDIUM - the rubric is locked, the per-field-cosine implementation is my inference between two options SEED-049 itself names; gate 214-F makes it falsifiable
- Dependency decoupling recommendation (A2): MEDIUM - facts verified, the scoping call is a navigator Decision Gate item

**Research date:** 2026-07-06
**Valid until:** ~2026-07-20 (fast-moving: 212 execution, the curing-sequence verdict, or a 212.5 plan pass can each change the dependency picture; re-check the Dependency Reality table before planning)
