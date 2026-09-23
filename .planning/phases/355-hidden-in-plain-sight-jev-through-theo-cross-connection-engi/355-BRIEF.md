---
phase: 355
kind: brief
source_room_entry: ~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-hidden-in-plain-sight-jev-through-theo-design.md
source_mirror: ~/MindrianOS/research/2026-09-23-hidden-in-plain-sight-jev-through-theo-design.md
devpkg: algorithm-incorporation-devpkg (Drive zip 2026-09-23; 9 capabilities / 4 sprints)
compositing: Dev-Research Compositing rule (CLAUDE.md) -- room entry is the reasoning trail, this brief is the executable decision; keep cross-linked
---

# Phase 355 brief (verbatim copy of the room entry; edit the room entry first, then re-copy)

---
methodology: research
title: "Hidden in plain sight: the Jev-through-Theo design for MindrianOS's cross-connection engines (RS / HSI / whitespace / Eureka + the 9 devpkg capabilities)"
created: 2026-09-23
status: active
room_section: research
supersedes_in_part: 2026-09-23-algorithm-engines-external-service-rethink.md
sources: "three read-only research passes this session: plugin engine seams (dev/MindrianOS-Plugin), TypeSafe live docs (docs.typesafe.ai), Theo repo (~/Theo + loose handoff briefs); the algorithm-incorporation-devpkg Drive folder; the 2026-09-17 Jev spike findings"
---

# Hidden in plain sight: the Jev-through-Theo design (2026-09-23)

> Rethink, not inheritance. The July consolidation verdict in this room is demoted to
> one input (a comparability hint). The design below starts from the user's job and
> from what the three systems actually are today: the plugin's engines as they run,
> Jev as its docs specify it, Theo as its repo enforces it. Where this contradicts the
> earlier note filed today, section 5 says so explicitly.

## 0. The job, and the one design rule that falls out of it

The user's job: **surface the breakthrough opportunity that was already latent in my
material and I could not see.** "Hidden in plain sight" has four concrete causes in the
current machinery, and each maps to a capability:

- the same structural idea wears different words in different domains, so search misses
  it (vocabulary -> Terminology Translation);
- a real connection is found but nobody can say what kind it is or what to do with it
  (meaning -> Discovery Pattern Taxonomy, Bit-Flip-Spark);
- a plausible connection cannot be trusted because nothing checks it against known
  structure (trust -> KG-Verified Hallucination Detection, Eureka critic);
- the signals that would reveal it disagree, and the disagreement is averaged away or
  never noticed (tension -> Supervisor Reconciliation, Update Velocity).

The design rule, forced by the TypeSafe docs and confirmed by Theo's page-one rules:
**code finds, Jev judges the type, Theo proxies typed calls and interprets nothing,
Larry composes, a human ratifies.** Jev never emits a number ("Jev is not a calculator";
Score is weak in numerical calibration; counting unreliable; dates read as text --
`model-jaggedness/jev-1.13.md`). Theo never hosts judgment or memory (`CLAUDE.md:117-206`
in ~/Theo; caching refused even for expensive analytics, `find-whitespace.ts:97-100`).
So every magnitude, threshold, trajectory and count lives in the plugin's code; every
"what kind of thing is this" question is a closed-enum Jev question; every wire
crossing carries buckets and enums, never floats or room text.

## 1. What the three passes established (the load-bearing facts)

**Plugin engines, as they run today.**
- RS, HSI and Eureka run in-process CJS; whitespace does not. Phase 272's D-10 ruling
  fenced the port to RS + HSI Tier 1; `whitespace-command.cjs` still spawns four
  `python3` scripts unconditionally (`:140, :166, :384, :604`), no CJS whitespace
  engine exists, and `detect-reverse-salients.py` is still an unconditional spawn at
  `intelligence-cascade.cjs:471`.
- The Burt structural-hole producer from July's research **does not exist**. Only a
  named seam waits for it (`lib/core/eureka/tail-quadrant.cjs:32-40`, DG-1).
- **Sign-convention conflict.** `rs-math.cjs:401` (signed diff > 0 -> `structural_transfer`)
  and `hsi-lsa.cjs:130` (LSA > semantic -> `structural_transfer`) are opposite by design
  (`hsi-lsa.cjs:7-20`); `detect-reverse-salients.py:30-37` uses a third. One label,
  three meanings.
- Thresholds are self-declared uncalibrated: `rs-differential-scorer.cjs:450`
  "UNCALIBRATED... DEFAULTS, not validated thresholds"; dozens of literal floors
  (0.3/0.2/0.2, 0.15, 0.6, 0.8/0.4, 10th percentile, 0.05, 0.10).
- Purest regex-for-semantics seam: `hsi-spectral.cjs:112-118` classifies a sentence's
  thinking mode with five keyword regexes, then builds a Markov chain on it.
- Eureka's `verdictFromRubric` (`eureka-critic.cjs:358-364`) is already an explicit
  closed-enum policy; confidence comes from calibration buckets, never model
  self-report (`:581-587`). Spike 004 measured Jev holding it 64/64 with the rule stated.
- `find-connections` has no local scoring: two fixed Cypher patterns against Theo
  (`references/brain/query-patterns.md:126-157`), no `shortestPath` anywhere in the
  plugin, ranking is Larry prose; Phase 268 kept it out of MCP because the in-loop
  reasoning is load-bearing.
- "Plugin -> Theo -> Jev" is a ruling, not code: no Theo gateway in the plugin; the only
  production Jev use is dev-time (`scripts/build-section-command-ledger.cjs`, shipped
  as `data/section-command-ledger.json`).
- Writes: RS/HSI/whitespace write edges via `lazygraph-ops` + `node-insert` (both on
  navigation's allow-list), not `navigation.cjs` directly; Eureka's write-back rides
  the refine proposal, human-gated.

**Jev, per the live docs.**
- One call, many independent questions, evaluated in parallel, none sees another's
  answer; batch bounded only by ~32k tokens shared by state and questions
  (`primitives.md`, `models.md`). Choice max 255 options, Score 2-10 levels, Noul has
  no confidence (`api.md`).
- `jev-1.13.0`: $0.042 per 1M input tokens, output free (`models.md`); the cookbook
  measured 13 questions over a ~54,000-char document in one call at $0.000497 / 0.27 s
  (`cookbooks/parallel_questions.md`).
- Confidence is spread-based; act / caution / do-not-act ranges; "start conservative,
  test with your own data" (`confidence.md`). Add `none`/`other` when the list may not
  cover the input; pair a ranking Choice with an existence Noul (`semantic_find.md`).
- **A Noul and a Choice on the same question are not comparable** (0.22 vs 0.01
  measured; Noul + not-Noul summed to 1.19; `jaggedness` #8). Literal reading is
  failure mode #1: write boundary cases into criteria. State is not treated as hostile
  (`jaggedness` #6). Large state costs accuracy; filter in code first (`jaggedness` #5).
- Not trained on customer requests or responses (`models.md`); retention window not
  stated; zero-data-retention offered at enterprise tier (`legal.md`).

**Theo, per its repo.**
- Node 22 MCP server, 34 tools, stdio locally and Streamable HTTP on Render (one web
  service, starter plan, no workers, no cron, no queue; `render.yaml`). Neo4j Aura
  canon ~28k nodes / 452 Frameworks after Phase 18 (`MISSION-FINALIZE-THEO.md:50-54`).
  Aura has no graph-algorithm procedures. No vector-search tool today; `search` is
  Lucene fulltext and stamps `search_mode: 'lexical'` (`16-MOS-LEARNING.md`).
- Keyless public surface; exactly one outbound credential (`MINDRIAN_BRAIN_KEY` to
  `pws-brain-mcp`). **No Jev/TypeSafe key or client exists in Theo.**
- Part 8 is structural: content tools are `z.strictObject`, and the two
  network-crossing tools have no string field at all -- "room content cannot cross
  here because THERE IS NOWHERE TO PUT IT" (`find-bottlenecks.ts:245-251`).
- **The template for any external computation already exists:** `computeGraphMetric`,
  closed enum `pagerank | betweenness_centrality | community_detection`, two optional
  integers, three refusal codes with a `layer`, `backend` provenance passed through,
  refusal-inside-success, no cache, no retry (`src/analytics/compute-graph-metric.ts`).
  `find_whitespace` and `find_bottlenecks` are pure proxies to Memgraph behind it.
  The contract warns it "must not become a second general-purpose graph either Theo or
  Larry queries ad hoc" (`:88-92`).
- `find_connections` is native Cypher: `allShortestPaths((a:Framework)-[*..3]-(b:Framework))`
  over canon, endpoints resolved via `ALIAS_OF`, hop cap fixed at 3
  (`find-connections.ts:245-253`). This is the graph-path primitive the plugin lacks.
- Theo flags its own whitespace operationalization as open: "WHETHER COMMUNITY
  DETECTION IS THE RIGHT OPERATIONALISATION OF 'WHITESPACE' AT ALL IS OPEN QUESTION
  OQ-4 ... needs its own seed and a langtalks-graph-expert consult"
  (`find-whitespace.ts:61-66`).
- Cross-domain structure in canon is authored, not computed: lateral edges (`EXTENDS`,
  `CONTRASTS_WITH`, `COMPLEMENTS`, `PRODUCES_INPUT_FOR`) and `GUARDED_BY` watcher pairs
  enter as reviewed compile-only payloads with citations (`22-MOS-LEARNING.md`,
  `graph-rulebook.md:74-117`). No `pattern_type`, no analogy edge type, no stored
  community label. Framework quality: 306 of 419 on no semantic axis, 417 of 552 rows
  name-only (`MISSION-FINALIZE-THEO.md:198-200`, `16-MOS-LEARNING.md:72-76`).
- Theo's own docs on priority: `find_bottlenecks`/`find_connections`/`find_whitespace`
  "are NOT depended on by any shipped MindrianOS command; don't let them drive
  prioritization" (`SESSION-HANDOFF-theo-ingestion-2026-09-07.md:110-112`). Phase 20
  (pws-brain-mcp migration, D-06 Memgraph revisit) is the open phase that decides the
  external-analytics seam's future.

## 2. The architecture: three homes, one wire shape

Not "external MCP services" as a blanket move, and not "one local process" as a blanket
move. Three homes, chosen per what each step needs:

**Home A -- the room-local engine (plugin, in-process).** Finds candidates over the
room's own graph and holds every number. RS structural lag, HSI pair differential,
whitespace bridging (the Burt producer, to be built), Eureka Stage A gates, weak-signal
volume/acceleration series, update-velocity distances, temporal trajectories once a
corpus service delivers them. Writes only through the navigation chokepoint family.
This is where July's "one embedding space, one sign convention, calibrated floors"
comparability requirement lives -- as an invariant on this home, not as a ruling
against the other two.

**Home B -- Theo, as proxy and path source (stateless, typed).** Two roles, both
already in character: (1) the graph-path primitive (`find_connections`'
`allShortestPaths` over Framework canon) that KG-verification consumes; (2) the
`computeGraphMetric` seam, extended with a second enum family for *judgment*: Theo
passes a stated closed-enum policy plus quantized state to Jev and returns typed rows,
interpreting nothing. Theo holds the Jev key (the 09-17 ruling), which today means
adding exactly one outbound credential and one enum family to code that already has
the shape. Nothing accumulates here.

**Home C -- external computation services (behind the Home B seam, never as new tool
styles).** Memgraph analytics (exists, D-06 open), Jev judgment (new enum member), and a
corpus/temporal service for Temporal Convergence and Weak Signal literature series
(new; arXiv/Semantic Scholar; GPU-hours; results enter canon only as reviewed,
hash-anchored data through the `GUARDED_BY` door -- computed elsewhere, reviewed,
written once -- or land in the room graph via a plugin adapter).

**The one wire shape** (Homes A -> B -> C and back): closed enums, integer buckets,
quantized scalars, registry ids; no floats, no free text, no content ids. This is the
Eureka critic's existing egress format, whose safety this room already vetted
(federated-analytics precedent; four safeguards: quantize, aggregate before
calibrating, coarse confidence, rate-limit + dedupe). The TypeSafe docs add a fifth for
the Jev leg: **pass scalars as named buckets, not floats** (`jaggedness`, numeric
representations), and a sixth: **filter state in code first** because large state
degrades answers.

## 3. Per-capability design (the table that replaces guessing)

Primitive and question idiom come from the docs pass; "code supplies" is what Home A
must compute and pass as named JSON fields; "home" is where each part runs.

| Capability | Jev primitive | Question sketch (instructions / criteria) | Code supplies (state) | Home |
|---|---|---|---|---|
| #1 Terminology Translation | Choice over structural-concept ids + `none`; one Noul per candidate equivalent when expanding | "Which `concepts[]` entry describes the same structural idea as `term` used in `domain`?" / ids with canonical one-liners + `none` (`entity_alignment.md`) | `{term, domain, term_context, concepts:[{id, canonical, sample_terms}]}`; exact map lookup + embedding clustering stay in code | A (map) + B->C (expansion) |
| #2 Temporal Convergence | none for the numbers; optional Choice on a pair's *kind* after code fixes the trajectory | "How do `concept_a` and `concept_b` relate?" / closed kinds + `none` | `{concept_a, concept_b, trajectory_bucket, sample_titles}` | C (corpus service) -> canon as reviewed data / A |
| #3 Discovery Pattern Taxonomy | Choice over 8 pattern ids + `none`, each option `{what, not_for, examples}`; plus Noul "is this a genuine cross-domain discovery at all?" (Choice is relative, Noul absolute) | "Which discovery pattern does the finding in `finding` instantiate?" / the 8 patterns with boundary cases written in (`choice.md`, `classification_using_confidence.md`: below 0.9 report a coarser label) | `{finding:{source_domain, target_domain, structural_basis, evidence}}`; action implication is a registry lookup | A -> B -> Jev |
| #4 KG-Verified Hallucination Detection | path in code/Theo; Jev judges the path only: Choice `supports / contradicts / says_nothing` | "How does `path` relate to `claim`?" / verbatim `citation_check.md` criteria; auto-verdict at confidence >= 0.8 | `{claim, path:[{node, edge, node}...]}`; hop tiers (1-2 strong, 3 indirect, none unverified) computed in code | B (`find_connections`) + Jev; A stamps |
| #5 Weak Signal Scoring | volume/acceleration in code; Jev: Score "semantic novelty vs `established_clusters`" with situation levels; Noul relevance filter | levels "restates an established cluster" / "extends one" / "sits between clusters" / "fits none" (`classifying_rag_passages.md`, `composite-scoring.md`) | `{topic_terms, sample_titles, established_clusters:[{name, description}]}` | C (corpus) -> A |
| #6 Bit-Flip-Spark | none for authoring (generative model); Jev verifies: Noul "does `flip` contradict `bit`?", Noul "is `spark` supported by `evidence`?" | (`citation_check.md`, `sde_cascade.md`) | `{bit, flip, spark, evidence}` | A (Larry authors) + Jev verify |
| #7 Problem Decomposition | sub-questions not Jev; Jev classifies each: Choice `answerable / estimable / unknowable` + speculative Choice of search domain from a closed list | "Can `sub_question` be answered by searching existing literature?" (`intent-routing.md`, `fan-out.md`) | `{problem, sub_question, domains:[...]}` | A -> Jev; unknowables file as whitespace |
| #8 Supervisor Reconciliation | divergence detected in code on shared buckets (never compare a Noul to a Choice); Jev: Choice over closed reasons + one Noul per reason | "Why is `gap` empty despite `connection`?" / `regulatory_barrier / failed_prior_attempt / vocabulary_mismatch / genuine_blind_spot / other` (`consistency_noul_cookbook.md`) | `{gap, connection, evidence_a, evidence_b}` | A detects; Jev explains; Larry investigates |
| #9 Update Velocity | distances/counts in code; Jev: Score on the pair + Noul "does `new_entries` contradict `thought_now`?" | levels "same claim reworded" / "narrowed or qualified" / "changed in one material respect" / "reversed" (`entity_alignment.md`) | `{thought_prev, thought_now, new_entries:[...]}` | A only (room history) |
| RS bottleneck | structure/centrality in code; Jev on a code-nominated component: Choice failure category + `other`; Noul dependency per pair | "Does progress in `section_a` depend on `section_b`?" (`rerank_typesafe.md`) | `{section_a:{name, governing_thought}, section_b:{...}}` | A -> Jev |
| HSI surprise | cosine/differential in code; Jev reranks the code shortlist: Choice `structural_transfer / semantic_implementation / none` + Noul non-obviousness | "Would a practitioner in `a.domain` find the link to `b` non-obvious?" | `{a:{title, domain, summary}, b:{...}}` | A -> Jev |
| Whitespace bridge | Burt constraint in code; Jev: Noul "is bridging `cluster_a` and `cluster_b` a plausible move for this venture?", Noul "already covered by `room_entries`?" | (`semantic_find.md`: rank + exists-Noul in one request) | `{cluster_a, cluster_b, room_entries:[titles]}` | A -> Jev |
| Eureka verdict | Choice over the 4 verdict enums with the decision rule in the criteria; confidence gate; add `uncertain` | pass scalars as named buckets (`consistency_choice_cookbook.md`) | `{differential_bucket, similarity_bucket, transfer_type, rubric:{a..f}}` | A -> B -> Jev (already the shape) |

Reading the table: the "make it external" surface is #2 and #5 outright (corpus
services) plus the Jev leg for judgment. Everything else is Home A code plus one
Jev question. The HSI thinking-mode regexes (`hsi-spectral.cjs`) are the single best
first Jev question in the codebase: a Choice over five modes with examples, replacing
five regexes, over state that is one sentence.

## 4. The hidden-in-plain-sight loop, end to end (what the user experiences)

1. **Translate** the user's problem terms through the curated map (#1) before any
   search, so "critical vulnerability" also searches "reverse salient", "binding
   constraint", "single point of failure".
2. **Find candidates** in Home A: RS lag, HSI pairs, whitespace bridges (Burt), all
   with numbers that stay local.
3. **Label** each candidate with one of 8 discovery patterns + `none` (Jev Choice),
   and a Noul "genuine cross-domain discovery at all?" -- the finding now says what it
   is and what to do (registry lookup for the action implication).
4. **Verify** against known structure: Theo `find_connections` path (<= 3 hops over
   canon), then Jev citation-check Choice on the path; stamp strong / indirect /
   unverified. Unverified is surfaced as "may be novel or hallucinated -- verify with a
   domain expert", never suppressed.
5. **Reconcile** when signals disagree: code detects divergence on shared buckets,
   Jev names the likely reason from a closed list, Larry investigates at the point of
   disagreement instead of averaging.
6. **Say it in ten seconds**: Larry authors Bit / Flip / Spark; two Jev Nouls verify
   the Flip contradicts the Bit and the Spark is supported by the evidence.
7. **File as proposed**, through the navigation chokepoint, with `SOURCED_FROM`
   provenance to the room nodes and the verification stamp; a human gate promotes.
   Nothing writes to Theo canon; a canon-worthy lateral edge is emitted as a reviewed
   payload through the `GUARDED_BY` door.

Every wire crossing in this loop is enums, buckets and registry ids. The room's text
never leaves Home A except as the short glossary/JTBD lines the 09-17 ruling permits.

## 5. Where this supersedes the earlier note filed today

- **"The Burt structural-hole fix is already researched, build on it"** -> the
  research exists, the producer does not; it is Home A work to build, not to reuse.
- **"Whitespace appears to still be outside Phase 272"** -> confirmed definitively
  (D-10 ruling; four unconditional `python3` spawns).
- **"HSI's LSA cosine and weak-signal metrics become Jev Score judgments"** -> wrong.
  Numbers never go to Jev. Jev judges the semantic type of a pair or topic code already
  scored.
- **"Supervisor Reconciliation arbitrates local signals with Jev"** -> narrowed:
  divergence detection is code on shared buckets (Noul/Choice incomparability);
  Jev only explains a detected divergence over a closed reason list.
- **"Plugin -> Theo -> Jev with Theo as keyholder"** -> still the ruling, but now
  known to be zero lines of code on either side; Theo has no outbound Jev credential.
  The implementation is one enum family on the existing `computeGraphMetric` seam.
- **"Theo stays the methodology backend, these engines answer a different
  question"** -> sharper: Theo is also the *path source* for verification
  (`find_connections`), and Theo's own `find_whitespace` is a Memgraph proxy whose
  premise (community detection = whitespace) Theo itself marks as open (OQ-4).
- **"Consolidate the room-differential layer into one local substrate (July
  verdict)"** -> demoted to what it actually protects: one sign convention, calibrated
  floors, comparable differentials. That invariant holds on Home A. It says nothing
  about Homes B and C.

## 6. Defects that block "work perfect, per intent" no matter what Jev does

These are code, not judgment, and they come first:

- **One label, three meanings.** Pick one convention for `structural_transfer` /
  `semantic_implementation` across `rs-math.cjs`, `hsi-lsa.cjs`, and
  `detect-reverse-salients.py` (or retire the Python one). Until then, a pattern label
  in step 3 above would be judging a lie.
- **Uncalibrated floors presented as gates.** Either calibrate against real rooms and
  source the floors from data, or expose them as the devpkg's "what remains
  unverified" rather than as verdicts.
- **Whitespace's external-vocabulary dependency (SEED-018)** degenerates on small
  rooms; the Burt producer replaces it and is self-limiting on sparse graphs.
- **Naming honesty.** `scout-hsi` returns reference text, not compute; the MCP
  `whitespace_scan` tool is open-questions + unsupported-claims, not the whitespace
  engine. Both read as capabilities they are not.
- **No graph-path primitive in the plugin.** Do not build one; consume Theo's
  `find_connections` and declare `backend` in every stamp.

## 7. Open questions carried forward

- Theo Phase 20 (D-06): whether Memgraph stays as the external analytics service
  decides whether Home C attaches one seam or two. The Jev enum family does not depend
  on it; the corpus service does.
- Jev retention window for request bodies is not documented; the enterprise ZDR tier
  is. Decide before any per-user path goes live (dev-time ledgers are unaffected).
- Theo's vector layer is capacity without capability (Phase 16, SEARCH-01 deferred);
  Terminology Translation Phase 3 (embedding clustering) has no Theo-side tool to call.
- Theo's own note that its cross-domain tools are not depended on by any shipped
  command: the loop in section 4 would be the first shipped consumer of
  `find_connections`. That is either the reason to build it or the reason it was
  deprioritized; the navigator decides.
- Framework content quality (306/419 unplaced, 417/552 name-only) bounds how much
  step 4 can verify; SEED-096 (Theo content backfill) is upstream of everything here.

## 8. Recommended sequencing (one path, not a matrix)

1. Honesty pass on Home A (days): one sign convention, floors sourced or labeled
   unverified, naming fixes. Zero external dependencies; makes every later judgment
   judge something true.
2. Spearhead #4 KG-Verification: plugin adapter -> Theo `find_connections` -> Jev
   citation-check Choice via the seam; verification stamp on every cross-domain
   finding. Smallest build that touches all three homes and gives every other
   capability its trust line.
3. First Jev question in the codebase: HSI thinking-mode Choice replacing the five
   regexes; measure against the regexes on real rooms before switching.
4. Then #3 pattern labels, #6 Bit-Flip-Spark verification, #8 reconciliation --
   all Home A + one Jev question each.
5. Corpus services (#5, then #2) only after Phase 20 settles the seam.

## Cross-references

- `research/2026-09-23-algorithm-engines-external-service-rethink.md` (earlier note
  today; section 5 above lists what this supersedes)
- `research/2026-09-17-jev-typesafe-spikes-001-004-findings.md` (Jev-through-Theo
  ruling; 64/64 vs 40/64 result)
- `research/2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` (comparability
  invariant, now scoped to Home A)
- `research/2026-07-06-whitespace-structural-holes-algorithm/` (Burt method; producer
  still to build)
- `research/2026-07-05-eureka-critic-brain-mcp-plan/agent-05-stateless-critic-mcp-pattern.md`
  (wire-shape safety, four safeguards)
- ~/Theo: `src/analytics/compute-graph-metric.ts`, `src/mcp/content/find-connections.ts`,
  `find-whitespace.ts` (OQ-4), `CLAUDE.md` page-one rules, `docs/M-T-COORDINATION-PROTOCOL.md`
- dev/MindrianOS-Plugin: `lib/core/rs-math.cjs`, `lib/core/hsi-lsa.cjs`,
  `lib/core/hsi-spectral.cjs`, `lib/core/rs-differential-scorer.cjs`,
  `lib/core/eureka-critic.cjs`, `scripts/whitespace-command.cjs`,
  `lib/core/eureka/tail-quadrant.cjs`, `.planning/spikes/002/rank.cjs`
- docs.typesafe.ai: `api.md`, `primitives.md`, `models.md`, `confidence.md`,
  `model-jaggedness/jev-1.13.md`, cookbooks `citation_check`, `entity_alignment`,
  `semantic_find`, `consistency_noul_cookbook`, `parallel_questions`
- Drive folder `algorithm-incorporation-devpkg` (9 capabilities, 4 sprints)
- Mirror to `MindrianOS/research/` per the Dev-Research Compositing rule.
