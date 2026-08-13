# Feature Research

**Domain:** MindrianOS Plugin v2.1.0 "Green the Floor" - flagship-floor enrichment, batch HITL ceremony, demand-ranked long tail
**Researched:** 2026-08-13
**Confidence:** HIGH (every source-map row verified against disk this session; complexity estimates MEDIUM)

Research question answered: how the milestone's user-facing capabilities should work across
(a) the batch payload-authoring ceremony, (b) the source-doc map for the 18 missing flagship
frameworks, (c) the PEST and Scenario Planning rulings, (d) the long-tail demand-ranking
behavior. Every finding converts to a testable requirement (marked **REQ-candidate**).

Grounding read in full this session: `scripts/check-flagship-floor.cjs`,
`data/flagship-floor-set.json`, the proven payload template
`ProblemsWorthSolving-Brain/payloads/reverse-salient-analysis.mjs` + `run-ingest.mjs`,
`lib/core/enrichment-queue.cjs`, the 2026-08-11 admin-sitting research trail
(`~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-admin-sitting-alias-collapse-execution/`),
and a full scan of `references/methodology/*.md` + `commands/*.md` frontmatter.

---

## (b) THE SOURCE MAP - 18 missing flagship frameworks -> best authoring source

This is the sizing artifact. "Complexity" estimates the payload-authoring effort against the
proven template (`reverse-salient-analysis.mjs`: phases from the doc's own numbered structure,
LEADS_TO spine, techniques only where the source names them, pattern_type only where
source-backed). Readiness dims: pattern_type / structure / techniques / flow.

**Cohort 1 - clean template fits.** Source doc has explicit turn-windowed phases, exactly the
find-bottlenecks.md shape the proven payload was authored from. Mechanical authoring.

| # | Framework (score) | Best source (path) | Chars | Structure in source | Complexity |
|---|---|---|---|---|---|
| 1 | HSI Semantic Surprise Analysis Assistant (0/4) | `references/methodology/score-innovation.md` | 6,809 | 5 turn-windowed phases | LOW |
| 2 | Lean Canvas (0/4) | `references/methodology/lean-canvas.md` | 5,284 | 4 turn-windowed phases | LOW |
| 3 | Six Thinking Hats (1/4) | `references/methodology/think-hats.md` | 6,679 | 4 phases + 6 named hats (= 6 natural Technique nodes) | LOW |
| 4 | Root Cause Analysis (2/4) | `references/methodology/root-cause.md` | 8,041 | 4 phases (DETECT/ANALYZE/CORRECT/EMBED) + 5 NAMED methods (5 Whys, Fishbone, Fault Tree, Barrier, Change) = 5 Technique nodes | LOW - best-shaped source in the whole set |
| 5 | Domain Selection (2/4) | `references/methodology/explore-domains.md` | 6,567 | 5 phases + IKA Scoring (named technique) | LOW |
| 6 | Knowns and Unknowns Matrix Framework (2/4) | `references/methodology/map-unknowns.md` | 5,681 | 4 phases + the 2x2 matrix | LOW |
| 7 | Dominant Design (0/4) | `references/methodology/dominant-designs.md` | 9,957 | 6 phases + Utterback-Abernathy model, S-Curve theory concepts | LOW-MEDIUM |
| 8 | The Pyramid Principle (0/4) | `references/methodology/structure-argument.md` | 6,084 | 5 phases (SCQA -> MECE tree -> 80/20 -> RCA -> Workplan) | LOW-MEDIUM (shares its doc with MECE, row 13) |
| 9 | PWS Value Proposition (0/4) | `references/methodology/value-proposition.md` | 10,246 | 5 phases + Three Gates + VPS formula + Value Canvas (named techniques) | MEDIUM (rich; choose phases as spine, gates/canvas as techniques) |
| 10 | Systems Thinking (0/4) | `references/methodology/systems-thinking.md` (primary) + `causal-loop-diagrams.md` (technique depth) | 12,573 + 5,074 | 4 phases + the Five Moves (M1-M5) + CLD Storytelling Method | MEDIUM (richest source; TWO structure candidates - phases vs moves - author must pick ONE spine and disclose) |

**Cohort 2 - judgment calls.** A source exists but attribution, shape, or authority needs a
navigator ruling embedded in the card. NOT mechanical.

| # | Framework (score) | Best source (path) | Gap / ruling needed | Complexity |
|---|---|---|---|---|
| 11 | Mullins Model (0/4) | `references/methodology/mullins-7-domains.md` (4,813) | 7 domains in 3 groups + scoring + decision rules - NOT sequential phases. pattern_type is matrix/parallel, structure via HAS_STAGE or HAS_STEP without a LEADS_TO chain -> lands 3/4 honestly (flow dim unsupported by source). Floor >=3 still clears. | LOW-MEDIUM |
| 12 | Futures Wheel (0/4) | `commands/futures.md` body (9,048) - NO references/methodology doc | The command body IS the methodology (ring model: 1st/2nd/3rd-order causal rings, D-01 guided-by-ring loop). Rings map to ordered stages. Secondary: `.planning/research/futures-wheel-agent-20260614/`. Ruling: command-body-as-source is a precedent extension (template used a reference doc). | MEDIUM |
| 13 | MECE (Mutually Exclusive, Collectively Exhaustive) (0/4) | `references/methodology/structure-argument.md` Phase 2 section ONLY | MECE is one phase inside the Pyramid Principle doc, not a standalone methodology there. Honest payload is technique-shaped and thin (likely 2-3/4 ceiling: pattern_type + techniques, weak structure). Two payloads from one doc (with row 8) - author together, disclose the shared source. | MEDIUM |
| 14 | Adaptive Leadership (0/4) | `references/methodology/leadership.md` (9,572) | Doc is "Leadership Coach" - Adaptive is 1 of 7 theories listed (line 14). The 4 phases belong to the coach persona, not to Heifetz's Adaptive Leadership specifically. Ruling: accept the doc as the PWS-house version of the framework (disclose), or the payload overstates its source. | MEDIUM |
| 15 | PWS Triple Validation Compass (2/4) | PARTIAL: `references/methodology/grade.md` (8,209; 5 phases, 6 scoring components) + `value-proposition.md` "Three Gates" (Is It Real / Can We Win / Is It Worth It - the "triple") | NO doc anywhere names "Triple Validation Compass" (repo-wide grep: zero hits outside command frontmatter). The concept is split across two docs. Ruling: which doc is authoritative, and whether the Three Gates (already claimed by PWS Value Proposition's payload, row 9) can also ground this one without double-attribution. | MEDIUM-HIGH |
| 16 | Hypothesis-Driven Problem Solving (2/4) | PARTIAL: `commands/research.md` (25,520; 7 pipeline stages) | The command is a research/evidence pipeline; hypothesis-driven methodology is implicit in its stage flow, never stated as a framework. Ruling: author stages-as-structure with disclosure, or hold for a real source doc. | MEDIUM-HIGH |
| 17 | Adoption-Capacity Theory (2/4) | PARTIAL: `references/methodology/analyze-timing.md` (7,072 - titled "S-Curve Analysis", shared frontmatter) + `commands/diffusion.md` (4,663, thin ACE description) + `lib/core/sensors/sensor-diffusion-adoption.cjs` | Weakest documented framework that has live commands. analyze-timing.md's 6 phases belong to S-Curve (already 4/4 via the untracked wave). The ACE engine is described, never documented as methodology. Ruling: thin honest payload (pattern_type + stage list from diffusion's ordered walk) vs write the missing reference doc first. | HIGH |
| 18 | Four Lenses of Innovation (0/4) | **NO SOURCE FOUND** (dedicated). `commands/find-analogies.md` invokes it but its body is the SAPPhIRE/TRIZ analogy engine; `pipelines/analogy/CHAIN.md` has a real 5-stage structure (Decompose -> Abstract -> Search -> Transfer -> Validate) but attributes to design-by-analogy, not Four Lenses; the only literal "Four Lenses" text is `systems-thinking.md:158` - a DIFFERENT four lenses (Structure/Dynamics/Boundaries/Leverage). | HIGH - blocked on a navigator ruling: (i) author a genuine Four Lenses reference doc first, (ii) re-attribute the payload to the analogy pipeline structure with disclosure, or (iii) re-attribute `find-analogies`/`find-analogies` skill frontmatter to a framework that has a source. "NO named read source = NO payload" (the template's own rule) forbids inventing one. |

**Honest sizing summary:** 10 mechanical payloads (Cohort 1), 7 judgment payloads (Cohort 2
rows 11-17), 1 blocked-on-ruling (row 18). The template proves ~1 payload per authoring
session-hour for Cohort 1 shapes; Cohort 2 roughly doubles that per framework because each
embeds a ruling.

**REQ-candidates from (b):**
- Every payload cites its source doc path + char count + read-in-full date in its header comment (template invariant, testable by grep).
- A payload for a framework whose source lacks a stated sequence does NOT emit LEADS_TO (no readiness-score chasing); floor >=3 tolerates this by design.
- MECE + Pyramid Principle payloads authored in the same batch, cross-referencing the shared source.
- Four Lenses gets a recorded navigator ruling BEFORE any payload work starts.
- Reconcile the untracked 2026-08-11/12 second-machine wave (Red Teaming, S-Curve, JTBD) before authoring anything - live-probe the current per-framework scores first so no payload is double-authored.

---

## (a) The batch ceremony - 38 writes without 38 interruptions

**Constraint stack (all non-negotiable):** every write is carded (nugget-routing HITL rule +
the proven ENRICH-02 cycle: payload -> `run-ingest.mjs` dryRun -> APPROVE card -> `--commit`
-> fixture eval); 38 individual cards produces rubber-stamping, which kills the card's
meaning; and the pipeline currently DAMAGES what it ingests (prop-drop on live-node re-ingest,
dedup self-loop minting - admin-sitting findings 2 + post-close-out), so commit order matters.

**Design principle: batch by decision-homogeneity, not by count.** A card stays meaningful
when every row on it needs the same KIND of judgment. Mixing a mechanical classification with
an attribution dispute on one card forces the navigator to context-switch per row - that is
what produces rubber-stamping, not row count.

### Ceremony tiers

**Tier A - the 20 pattern_type rulings (graph-wide 3/4 -> 4/4).** These are classification
rulings on existing nodes, zero content authoring. ONE digest card (or one per pattern_type
class if the evidence quality differs): a table of framework | proposed pattern_type |
one-line evidence. Navigator approves/edits per-row in a single sitting via AskUserQuestion.
Execution: guarded `brain_write` SETs (the proven finding-2 patch path) until the prop-drop
pipeline fix lands - after the fix, re-ingest also works, but the SET path is already proven
and cheaper for prop-only changes. **1-3 cards total.**

**Tier B - Cohort 1 payload waves (10 mechanical payloads).** Batch dry-run: a thin batch
wrapper over the existing runner (`run-ingest-batch.mjs` calling the same `ingestFramework`
with `dryRun: true` per payload - reuse, no second pipeline) emits ONE aggregate report:
framework | nodes | edges | by-label | by-edge | accepted/warn/reject | expected readiness
after. One digest card per wave of ~5 payloads carries the report plus a path to each full
dry-run output for spot-checks. Approve the wave, or check off exceptions row-by-row (the
card supports per-row rejection, never all-or-nothing). Then `--commit` each approved payload
individually (commits stay per-payload so a failure is isolated), then ONE floor re-run
(`check-flagship-floor.cjs`) + the per-payload fixture evals as the batch's eval leg.
**2 cards (two waves of 5).**

**Tier C - Cohort 2 individual cards (7 payloads + 2 rulings).** Each of rows 11-17 gets its
OWN card because each embeds a distinct navigator ruling (source authority, attribution,
honest-ceiling acceptance). PEST and Scenario Planning (section c) are ruling cards, not
payload cards. **~9 cards.**

**Total: ~12-14 interruptions instead of 38+, with judgment density HIGHER per card, not
lower.** The mechanical work concentrates into digests; the judgment work stays individual.

### Sequencing (load-bearing)

1. Reconcile the second-machine wave (fresh live floor run; refresh the miss list).
2. Pipeline fixes in the brain repo FIRST: prop-drop (`src/ingest/` validator/pipeline),
   dedup self-loop (`src/ingest/dedup.mjs` - same pass as prop-drop per the research trail),
   normalizeName alias-aware direct-match branch. Without these, every Cohort-1 commit on a
   live node silently drops `pattern_type` (false-success, the exact 2026-07-14 WATCH bug
   class) and can mint fresh self-loops.
3. Tier A can run BEFORE the pipeline fix (guarded SETs bypass the ingest pipeline).
4. Tier B/C commits run AFTER the pipeline fix. If fixes stall, the fallback is the proven
   two-step: ingest (structure lands) + guarded SET (prop lands) per payload - uglier, still
   honest, already executed once for reverse-salient.
5. Floor green -> SWEEP-02 fixture inversion lands last.

**REQ-candidates from (a):**
- Batch dry-run report generator exists and reuses `ingestFramework(payload, { dryRun: true })` - no second ingest path (testable: grep-fence).
- Every card supports per-row rejection; a rejected row never blocks the rest of the wave.
- No `--commit` for a Cohort-1/2 payload before the prop-drop fix merges OR the two-step SET fallback is explicitly invoked on the card.
- After each committed wave: `check-flagship-floor.cjs` re-run recorded, per-payload fixture (`tests/fixtures/framework-evals/*.json`, graph_regression class) added and passing via `probe-framework-evals.mjs`.
- Post-batch dedup audit: zero new ALIAS_OF self-loops (`MATCH (n)-[r:ALIAS_OF]->(n) RETURN count(r)` = 0 via read tier) - the regression the reverse-salient ingest proved possible.

---

## (c) The two recorded rulings

### PEST Analysis (matches=0 - no :Framework node exists)

**Recommended ruling: INGEST, not de-list.** The source is real:
`references/methodology/macro-trends.md` (8,167 chars) carries "Phase 3: PEST Systems
Analysis" with explicit Political / Economic / Social / Technological subsections, and
`/mos:macro-trends` genuinely invokes the framework (frontmatter `frameworks: ["PEST
Analysis"]`, uses=1). De-listing would shrink the ratified 28-name denominator and force a
re-ratification ceremony on `data/flagship-floor-set.json` to dodge work the repo already has
the source for.

Shape of the honest payload: NEW framework node (the validator supports new-node payloads -
the existence-aware branch is for live nodes); `pattern_type` matrix/parallel (four lenses,
no textual sequence); P/E/S/T as 4 structure components (HAS_STEP), NO LEADS_TO (the source
asserts no order) -> lands 3/4, clears the >=3 floor. Disclose in the payload header that
PEST is documented as a phase within Macro-Changes Analysis, the same disclosure pattern the
MECE payload uses.

Recorded as: one Tier-C card, outcome written into the payload header + the milestone
REQUIREMENTS entry. If the navigator instead rules de-list, the ruling artifact is an updated
`flagship-floor-set.json` (27 names, new `ratified_at`, reason field) PLUS re-attribution of
`commands/macro-trends.md` frontmatter - never a silent denominator edit.

### Scenario Planning (3/4 readiness, matches=6 - normalizeName double-count)

**Recommended ruling: FIX normalizeName, do not carve a floor-gate exception.** Root cause
is known and named (admin-sitting finding 3): post-collapse, the canonical node
direct-matches AND its alias branch lists it again - the count is an artifact of the
resolver, not graph ambiguity. The fix (alias-aware direct-match branch, brain repo, flagged
"one-line fix candidate, Rule-4 territory" in the research trail) repairs the CLASS: every
future alias collapse would otherwise reproduce this on its new canon. It deploys over
Render (HTTPS-served code), needing no Bolt checkpoint.

Why not the exception: the exactly-1 rule is load-bearing (Pitfall 7 - a multi-match makes
every readiness probe ambiguous because T6 takes exact-first LIMIT 1). A documented-exceptions
file in the gate converts a code truth into data special-casing and invites the next
exception. The gate's own header doctrine is "a navigator ruling changes DATA, not code" -
but this is not a ruling about the floor set; it is a resolver bug with a named fix.

Fallback ONLY if the fix is blocked at deploy time: a `documented_exceptions` block in
`flagship-floor-set.json` (`{ framework, accepted_matches, reason, expires }`) that
`check-flagship-floor.cjs` prints loudly on every run and that carries an expiry - an
exception that cannot go stale silently. Recorded either way as a Tier-C card outcome.

**REQ-candidates from (c):**
- PEST: post-ingest live probe shows matches=1, readiness>=3; floor row flips to PASS.
- Scenario Planning: post-fix `normalize_framework_name("Scenario Planning")` returns exactly 1; a brain-repo regression test pins the alias-aware branch (canon counted in ONE branch only - the finding-3 arithmetic lesson).
- If the exception fallback fires: gate output contains the exception line + expiry on every run (testable via evaluateFloor fixture).

---

## (d) Long-tail demand ranking (90 frameworks at 0/4) - queue-driven, never bulk

The machinery already half-exists and the doctrine is settled ("context-driven framework
enrichment prioritized by live readiness misses - never bulk", carried from v2.0.0).
`lib/core/enrichment-queue.cjs` (ENRICH-01) captures a typed entry per live readiness miss at
`<roomDir>/.mindrian/enrichment-queue.json`: canonical name (unique key, idempotent),
readiness_score, missing_dimensions, hit_count (incremented on re-hit), first_seen/last_seen,
context_class - generic handles only (Part 8 audited), soft cap 500 / hard cap 1000.

**What v2.1.0 adds - a READER, not a writer:**

1. **Demand rank = hit_count DESC, tiebreak last_seen DESC.** A framework nobody's live
   reach ever missed has zero demand and stays at 0/4 honestly - it is served by honest
   refusal + auto-queue (Decision #8), which IS the correct behavior, not a gap. Most of the
   90 never get enriched. That is the design working.
2. **A ranked worklist surface** (script or `/mos:` admin-visible report; reuse the queue's
   self-healing reader): top-N by demand with scores, missing dimensions, and - the useful
   join - whether a `references/methodology/` source doc exists for the name (the same scan
   this research ran, automated). Demand + source-in-hand = ready to author; demand +
   NO SOURCE = a source-authoring task first, surfaced honestly.
3. **Cross-room aggregation is safe and needed**: queues are per-room; entries are generic
   handles only, so a multi-room merge (registry-driven walk of `~/MindrianRooms/*/`) breaks
   no Part-8 boundary. Without it, demand fragments per room and under-counts.
4. **Dequeue path**: each item drawn from the worklist goes through the IDENTICAL Tier-B/C
   ceremony (payload -> dry-run -> card -> commit -> fixture -> floor-style probe). One
   framework per pull by default; a digest card only when >=3 queued items share Cohort-1
   shape. On commit, the queue entry is resolved (removed or marked), so hit_count restarts
   honestly if misses recur.

**Anti-feature (hard): bulk enrichment of the long tail.** Batch-generating 90 payloads from
thin or absent sources manufactures readiness the graph didn't earn, violates "NO named read
source = NO payload", floods the card ceremony into meaninglessness, and - per finding 2 -
would have silently dropped every pattern_type it wrote. The queue exists precisely so demand,
not completionism, spends the authoring budget.

**REQ-candidates from (d):**
- Worklist reader ranks by hit_count DESC / last_seen DESC (unit-testable, pure function over queue JSON fixtures).
- Worklist joins each entry against the source-doc scan and prints SOURCE / NO SOURCE per row.
- No batch path exists that commits >1 long-tail payload without a card per Cohort rules (grep-fence: nothing calls `ingestFramework` with `dryRun: false` outside the carded runner).
- Resolving a queue entry on successful enrichment is idempotent and logged as a memory event (existing `enrichment_queue_captured` sibling).

---

## Feature Landscape (roadmap view)

### Table Stakes (the milestone is incomplete without)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Pipeline fixes: prop-drop, dedup self-loop, normalizeName | Finding 2/3 + post-close-out finding; committing payloads through a damaging pipeline re-creates the bug class the milestone exists to close | MEDIUM | Brain repo `src/ingest/`; prop-drop + dedup are one pass |
| 18 flagship payloads (Cohorts 1+2) | The floor's 20 misses are 18 authorable + 2 rulings | HIGH (aggregate) | Source map above; Cohort 1 mechanical, Cohort 2 judgment |
| Tier A: 20 pattern_type rulings | 20 graph-wide frameworks at 3/4 missing ONLY pattern_type - cheapest readiness lift in the graph | LOW | Guarded SETs, 1-3 digest cards |
| PEST + Scenario rulings recorded | Floor cannot go green without both rows resolving | LOW-MEDIUM | Section (c) |
| Floor green + SWEEP-02 fixture inversion | The milestone's named exit gate | LOW (once above lands) | `check-flagship-floor.cjs` exit 0, then invert the fixture expectation |
| Second-machine wave reconciliation FIRST | Kickoff numbers (8/28) predate reconcile; authoring against stale scores wastes payloads | LOW | Fresh live run + record |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Digest-card batch ceremony | Keeps HITL meaningful at 38-write scale - decision-homogeneous batching is the difference between governance and rubber-stamping | MEDIUM | Section (a); reuses run-ingest + AskUserQuestion |
| Demand-ranked worklist with source-join | Turns the 90-framework tail from a guilt list into a priced queue; NO SOURCE rows surface the real bottleneck (source authoring, not payload authoring) | MEDIUM | Section (d) |
| Per-payload fixture evals as regression floor | Every enrichment becomes permanent, machine-checked ground truth (graph_regression class) | LOW (pattern proven) | Existing harness |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Bulk long-tail enrichment | "Just green everything" | Fabricated readiness from absent sources; card flood; prop-drop amplification | Demand queue, section (d) |
| One mega-card for all 38 writes | Fewest interruptions | Zero per-row judgment; rubber-stamp by design | Decision-homogeneous tiers, ~12-14 cards |
| Readiness-score chasing (inventing techniques/LEADS_TO) | 4/4 looks better than 3/4 | Violates the template's own "NO named source = NO payload at the sub-node level"; floor is >=3 on purpose | Author only what the source asserts |
| Floor-gate exception for Scenario Planning as first choice | Faster than a brain-repo deploy | Converts a resolver bug into permanent data special-casing; erodes the load-bearing exactly-1 rule | Fix normalizeName; exception only as expiring fallback |

## Feature Dependencies

```
Wave reconciliation ──precedes──> everything (fresh miss list)
Pipeline fixes (brain repo) ──required by──> Tier B/C payload COMMITS
Tier A pattern_type SETs ──independent of──> pipeline fixes (guarded-SET path)
18 payloads + PEST ruling + Scenario fix ──required by──> Floor green
Floor green ──required by──> SWEEP-02 fixture inversion
Enrichment queue (shipped, ENRICH-01) ──required by──> Demand worklist reader
Batch dry-run reporter ──enhances──> Tier B ceremony (not a blocker for Tier C)
```

## MVP Definition

### Launch With (v2.1.0 core)
- [ ] Wave reconciliation + fresh floor baseline - honest starting numbers
- [ ] Three pipeline fixes (brain repo) - nothing commits through a damaging pipeline
- [ ] Tier A digest batch (20 rulings) - cheapest lift, proves the digest-card shape
- [ ] Cohort 1 payloads (10) via two digest waves - the mechanical majority
- [ ] Cohort 2 payloads (7) via individual cards - incl. the Four Lenses ruling
- [ ] PEST ingest ruling + Scenario normalizeName fix - the last two floor rows
- [ ] Floor green -> SWEEP-02 fixture inversion - milestone exit gate

### Add After Validation
- [ ] Demand worklist reader + source-join - once the floor is green and the queue has real post-launch traffic
- [ ] Cross-room queue aggregation - when >1 active room produces queue entries
- [ ] v2.0.0 carry-fold: CACHE-03 live hit-rate, AVAIL-03 operator legs, Bolt checkpoint queue (7 index DROPs + Nested Hierarchies self-loop DELETE)

### Future Consideration
- [ ] Source-doc authoring for NO SOURCE long-tail entries that accumulate demand - the worklist reveals whether this is ever needed
- [ ] SEED-framework-coverage-live-population + SEED-075 (per milestone scope; sequence after floor green)

## Sources

All primary, read this session (HIGH confidence unless noted):
- `scripts/check-flagship-floor.cjs`, `data/flagship-floor-set.json` (gate logic + ratified 28)
- `ProblemsWorthSolving-Brain/payloads/reverse-salient-analysis.mjs`, `run-ingest.mjs` (proven template + runner)
- `lib/core/enrichment-queue.cjs` (ENRICH-01 mechanics: keys, caps, idempotency, Part-8 allow-list)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-admin-sitting-alias-collapse-execution/2026-08-11-admin-sitting-alias-collapse-execution.md` (5 findings + open threads + post-close-out self-loop)
- Full scan: `references/methodology/*.md` headings + sizes; `commands/*.md` `frameworks:` frontmatter; `skills/find-analogies/SKILL.md`, `skills/pws-methodology/SKILL.md`, `pipelines/analogy/CHAIN.md` (Four Lenses trace)
- `.planning/PROJECT.md` Current Milestone section (scope + kickoff floor state)
- Complexity estimates: MEDIUM confidence (derived from source-shape inspection vs the one proven payload, n=1 calibration point)

---
*Feature research for: MindrianOS Plugin v2.1.0 "Green the Floor"*
*Researched: 2026-08-13*
