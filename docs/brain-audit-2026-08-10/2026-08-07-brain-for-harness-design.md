# Designing the Render GraphRAG for the MindrianOS Harness

**Date:** 2026-08-07 · **Status:** design, not yet implemented · **Scope:** the consumption surface of `pws-brain-mcp` / `pws-brain-db`, not the graph content

> **Goal (navigator's words):** make the Render GraphRAG "work as designated, be perfectly designed to utilise the MindrianOS harness."
>
> This document answers *what the brain should expose and how the harness should reach it*. It deliberately does not cover graph-content versioning - see [The gap no source fills](#the-gap-no-source-fills).

> ## PARTIALLY SUPERSEDED, 2026-08-09
>
> **The research in this document holds. Its FRAMING does not.**
>
> Every section below treats the Brain as a Q&A surface reached by an agent that decides to ask it,
> and then argues about tool-surface design and question-class routing on that basis. That framing
> predates a finding from the consumer's own code:
>
> - `insight-sensors.cjs:135` - **"the Brain RECOMMENDS, never TRIGGERS"** (Phase 210 doctrine)
> - `SENS-01` attaches a `brain_framework_chain` companion carrying **ONLY a `problem_type` enum**
>   (Canon Part 8: generic handle only, never artifact bytes)
>
> So the consumer's LOCAL sensors are the tripwire and this Brain is the **armory**. Sensors supply
> WHEN; the Brain supplies WHICH and in WHAT SEQUENCE. Production is enum-in / ranked-chain-out, not
> free-text Q&A. Canon Part 8 is the reason it must be that way: this Brain cannot see room content,
> so it cannot trip on context.
>
> **What that changes here.** Section 2 (tool surface) and section 3 (route by question class) are
> arguing about the wrong surface: they optimise the path a human types into, not the path a sensor
> fires down. Section 4's ranking discussion becomes MORE important, not less, because ranking a
> framework chain IS the production job. And the open question about the eval set, already corrected
> once in this document, needs correcting again: the eval should score `problem_type -> ranked chain`
> on precision, recall and ordering, which can be done hermetically with no live graph and no LLM
> judge.
>
> Live carriers for this finding, because a document is a carrier that gets lost:
> `tests/eval-gate-baseline-integrity.test.mjs` (two `todo` entries that print in every run), the
> REVISION block in `docs/2026-08-09-GSD-TAKEOVER-nl-answer-quality.md`, and `CLAUDE.md`.

---

## Evidence base

Four talks, read in full from local transcripts in `langtalks-graph-expert/sources/research/transcripts/`. Surfaced by querying that repo's own graph (`multihop(Memgraph, GraphRAG)` → 3 shared sources, 1-hop `Memgraph --builds_on--> GraphRAG`).

| # | Source | Date | Weight |
|---|---|---|---|
| A | Meet Atomic GraphRAG - A Single, Unified Execution Layer (Memgraph) | 2026-02-18 | **highest** - architecture |
| B | Agent Skills, Explained: An Open Standard Meets Graph Engineering in Memgraph | 2026-02-16 | **high** - harness contract |
| C | From Data to Knowledge Graphs: Self-Improving AI Memory Systems (Cognee) | 2025-09-30 | medium - ingest hygiene |
| D | How GraphLogic built a traceable reasoning layer on Memgraph | 2026-07-03 | low - product talk, thin on engineering |

Where a heading below says NOT COVERED, no source addressed it. That is recorded deliberately; it is not an invitation to fill the gap from general knowledge.

---

## 1. The convergent finding

Two independent talks, from different speakers, arrive at the same conclusion about a tool surface shaped like ours.

**Source B** - on exposing many endpoints as MCP tools:

> "people started to expose their web API - so you have like a thousand endpoints in your API and they start to expose those thousand endpoints as functions or tools. And that takes **much more context than a thousand skills** with the name and description."

Because MCP loads *"the whole description, function prototype and everything immediately, and there are no limits to that."* Skills get three-tier progressive disclosure. MCP tools get none - every tool description is resident in every session, forever.

**Source A** - on what should replace pre-baked tools:

> "if you can just run atomic database queries is to use MCP because MCP is very standardized... in the database case you just need basically **run query tool** and then you execute those advanced queries through MCP."

Formula as stated: *"agentic runtime plus skills plus MCP and atomic graph is all you need."* And the knowledge currently frozen inside hand-written tools is supposed to live in a skill:

> "for each specific role like data analyst, lawyer, accountant, product manager... one should build like a concrete **agent skill** that will basically have **examples of those queries**, basically nudge LLM in the right direction."

**Restated for us:** the 19 hand-written read tools on `pws-brain-mcp` encode retrieval judgment in server code, where it is expensive to load, invisible to the agent, and frozen at authoring time. That judgment belongs in a skill.

### What MindrianOS already gets right

The plugin's brain client exposes **six** tools, not nineteen:

```
brain_ask · brain_query · brain_schema · brain_search · brain_stats · brain_write
```

The harness already performs the narrowing both sources recommend. `brain_query` (arbitrary Cypher) and `brain_schema` are precisely the atomic primitives Source A calls for. **The design risk is regression** - reading "utilise the harness better" as *expose more of the 19*. It is the opposite.

---

## 2. Tool surface - the target

Keep six. Change what two of them mean.

| Tool | Role | Change |
|---|---|---|
| `brain_schema` | structural entry point | **Promote.** Source A: *"schema is very very smart first step"*, to be run *"in any case except when you have a super large schema or it's obvious that you have to do vector search."* Our schema (181 Frameworks + Phase / ProcessStep / MethodologyChunk) fits in context. This is the cheapest structural win available. |
| `brain_query` | atomic Cypher | **Keep, guard.** Already moat-capped (`BRAIN_CYPHER_MAX_ROWS`, `MAX_BYTES`, `MAX_ESTIMATED_ROWS`, `TIMEOUT_MS`). This is the "run query tool" the architecture is built around. |
| `brain_search` | vector pivot | Keep. e5, 1024-dim, 9 indexes. |
| `brain_stats` | corpus census | Keep. |
| `brain_ask` | NL → answer | Keep as convenience; it must not become the only path. |
| `brain_write` | ingest | Keep, gate (§5). |

The remaining server-side tools are not deleted - they stay reachable on the admin surface. They stop being the *interface*.

---

## 3. Route by question type, not through one entry point

Source A names three question classes, each with its own pipeline:

**Analytical** - `show schema info` → generate Cypher → execute.

**Local** - *"pivot search first, text search or vector search depending on the question... then we do relevance expansion which can be BFS or DFS... and then ranking in the end."*

**Global** - community detection (Louvain) → per-community summaries → partial answers → final synthesis.

And they are expected to interleave inside one agent loop:

> "you can run some cipher but then you can go back to pivot search and relevance expansion and ranking... that whole agent can run for a while and figure out different things."

### Why this diagnoses a bug we already hit

`find_frameworks_for_problem_type` is a **hardcoded, frozen instance of the local pipeline** - pivot by problem type, expand along typed edges, rank, cap. Freezing it is what allowed the ranking step to degrade to an alphabetical slice capped at 15 rows, silently amputating everything from E-Z of a 44-framework result set. A pipeline the agent composes per question cannot fail that way invisibly: the ranking step is chosen in the open, per question, and its output is inspectable.

The fix already shipped (rank by `match_strength`, limit 60) is correct and should stay. The architectural point is that the *shape* - retrieval judgment frozen in server code - is what made a silent corpus amputation possible.

---

## 4. Ranking - a pluggable step, and an honest gap

Source A, verbatim:

> "Ranking in the end, because you have a certain amount of nodes which are hit and the question is what are the most relevant ones. The ranking could be like many different things, for example basic **node degree** or **page rank** or some other way. We also debated using LLM to actually rank the given nodes, but that's **quite expensive in terms of time**."

Ranking is a *pluggable structural step after retrieval*, not a score fused into it. Our `match_strength` ordering (`ADDRESSES_PROBLEM_TYPE > RELATES_TO > HAS_PHASE`) is a legitimate instance of this.

**NOT COVERED by any source:** hybrid scoring - any formula, weighting, or method for blending semantic similarity with graph-structural score. No source offers one. **Do not invent one and present it as sourced.** If we need hybrid ranking, it is our own experiment, and it needs its own eval.

---

## 5. Ingest: staging, re-ingest, and junk

### 5.1 A holding bin, not a silent commit

Source D describes two-pass curation with a human gate:

> "second pass is... it'll curate those and it'll **put those in a holding bin** to say I think this is relevant."

With the warning: *"you don't want a bunch of garbage in your system because then it's impacting your ability to reason."*

This is the architectural form of the bug where edges with unresolvable endpoints were written as zero-row MERGEs and **reported as success**. `nullEdgeEndpoints() → plan.warn` fixed the reporting. The target state is stronger: an unresolvable endpoint lands in staging and requires resolution. It is never silently committed and never reported as committed.

A holding bin is a Decision Gate. The harness already has that primitive.

### 5.2 Re-ingest is delete-then-replace

Source C rejected incremental update outright:

> "if we have an existing graph, we go and we **delete the chunk and all the nodes associated to it** or the document. So we clean that whole thing and then we replace... There is **no good way to do incremental updates** on unstructured data."

Rationale: chunk boundaries shift, so editing chunk 74 invalidates 75-onward.

This reframes the validator defect. The validator rejecting a valid re-ingest was treated as a validation bug and patched with an existence-aware two-tier warn. The architectural reading is different: **a repeat ingest is normal and expected**, and the correct primitive is a scoped delete of the document's subgraph followed by a rewrite - not a uniqueness check at all. Source C notes the delete logic is the genuinely hard part, built separately.

### 5.3 Junk entities: agreement voting

For an entity registry polluted with SQL operators and bare dollar amounts, Source C:

> "running multiple runs and then de-duplicating effectively the entities and in case they appear in **n runs out of 10**... if it's **eight out of 10** - then probably these entities exist and you're reducing the margin of error. **It gets expensive but it gets more accurate.**"

Plus adversarial cross-model checking: *"you ask a different LLM about one other LLM so that it cannot be biased by the previous answers... you go to Gemini and check 'hey does this make sense or not?'"*

Extraction flukes do not survive an 8-of-10 stability threshold. Note the cost is explicit and accepted, not hidden.

### 5.4 The ontology is the grounding layer

> "these ontologies can be defined **by hand**... we merge that with this LLM generated data thus **grounding** the data and giving it more accuracy... each of these steps is a layer that adds on top... because **LLMs do generate a lot of noise**."

And ingest paths split by determinism: *"if the data is deterministic - meaning it's a relational database or something - it's going to just populate the graph one-to-one, just the physical translation,"* with LLM-derived data layered above.

**Our 181 hand-curated Framework nodes are exactly this ontology.** They are the grounding layer, not merely content. Any LLM-derived material must layer on top of them and be reconciled against them - never merged as a peer. This is also the principled reason not to pour an auto-extracted corpus into the brain.

---

## 6. Provenance

Source D models the argument structure itself as graph content:

> "informal logic, the way we as humans think... you may have an argument, somebody may **rebuttal** your argument, what's the **evidence** based upon the **premise** you're putting forth? All of that can be put into the graph."

Motivation matches ours exactly - *"six months later, why did you make that decision? Well, I don't know, the AI said. That's not good enough."* Outcome: *"you can defend your decision."*

MindrianOS already holds this reasoning **in the harness** (`contradiction_check`, the Minto layer, `structure-argument`) over a graph that stores only conclusions. Moving premise / evidence / rebuttal into the graph as typed nodes would let the reasoning survive the session.

Our `provenance_note` slot (source-document claim vs. operator decision) is the seed of this and should not be widened into a key-per-case - the allowlist stays closed and short.

**Caveat:** Source D is a product talk. It describes no confidence levels, no edge properties, no citation nodes, no audit-trail primitive. Do not assume mechanism behind the concept.

---

## 7. Retrieval lenses

Source D applies role/lens scoping **before** extraction and retrieval, not as a post-filter:

> "he's logged in as his CIO profile... if he wanted to look at it from an enterprise architecture point of view - how the models think, **how looking at the information is different**... we also have things called **focus lenses**."

Source A independently recommends per-role skills carrying query examples.

We already have the lens vocabulary - personas, De Bono hats, the JTBD signal, problem-type classification. The change is *when* it applies: as a retrieval-shaping input, not a presentation-layer filter.

---

## 8. The skill contract

From Source B, the authoring constraints are hard numbers.

**Three tiers.** Metadata *"is always loaded... if you have a thousand skills, all of the metadata from every skill will be loaded immediately."* Instructions *"load when triggered."* *"Resources are loaded as they are needed."*

**Budgets.** `name` ≤ 64 chars · `description` ~1,000 chars · instructions *"should be under 500 lines"* · *"resources can be abundant."*

**Naming is routing.**

> "it is super important to **name the skill the way you will prompt it**... name the skill as you would write in a natural way."

Only `name` + `description` are always resident, so those two strings alone decide whether the brain is reached. Name in the navigator's language, not internal vocabulary.

**Separation of concerns.**

> "skills are like a knowledge base... MCP servers essentially provide the data from a database. They are the **plumbing and the pipeline** of the data... while the skill is **dictating what it wants to do**."

His worked example is our exact shape: *"you would have a skill for traversing memgraph... and then the actual MCP server would be responsible for getting to memgraph and reading the data."*

**Recovery, not rigidity.**

> "it's not intended for a skill to be very rigid... if it diverges from the problem you can provide in a skill **how it can recover**."

### Target skeleton

Observed in Memgraph's own published skill: **when-to-use / prerequisites / quick reference / instructions / references**.

```
skills/<navigator-language-name>/
  SKILL.md            # < 500 lines
    when to use       # question shapes that warrant the brain
    prerequisites     # key present, service reachable
    routing table     # question class -> primitive sequence (§3)
    recovery          # empty result, timeout, cold start
  references/
    cypher-patterns.md   # traversal shapes per question class
    schema.md            # node labels, edge types, what each means
    vector-indexes.md    # the 9 indexes, dims, what each covers
```

Per-tool Cypher signatures and index details go in `references/`, never in the body - mirroring Memgraph's practice of letting the agent *"go to the reference and try to find is there a definition for mgp.Vertex."*

**Concrete lead:** `github.com/memgraph/skills` publishes a **`memgraph-graphrag`** skill - *"how that pipeline can be built with memgraph, what prerequisites you need, how to build indexes inside, best practices built into that skill."* Spec home: `agentskills.io`. Read before authoring; adapt rather than invent.

**NOT COVERED by any source:** result shaping for an LLM - return-payload size, raw rows vs. summarized rows, how many rows is too many. Also NOT COVERED: empty-result handling and hallucination-on-empty-return. Our own SKILL.md convention of answering *"not in the corpus yet"* on an empty tool return is unsourced but correct, and stays.

---

## 9. Memgraph version leverage

Two upgrade-gated wins, both from Source A. Neither is verified against our deployment.

**Single-store vector search (3.8).** *"vectors and embeddings are now stored only inside index... the storage overhead in certain workloads was reduced for 80%."* Directly relevant: 12,401 × 1024-dim vectors on a 2 GB / 1 CPU Standard instance.

**Server-side embedding + `llm_complete` as a Cypher function.** Moves the embedding call inside the query instead of the Node layer, collapsing application glue. Source A's comparison of a Python community-summarization script against *"a single cipher statement doing all of that"* was *"like a 10x difference in terms of the code that has to be managed."*

**Config warning that applies to us now:**

> "when vector search is created or when embeddings are calculated those two things have to **share the same config**... the size of an embedding or the dimension of the vector search index. Those things have to be the same."

With 9 vector indexes and an external e5 sidecar, dimension drift between index creation and embedding calculation is a live risk with no current guard. Server-side params (3.9, unshipped) centralize this.

**NOT COVERED:** latency figures, RAM requirements, index sizing, and whether any of this is viable at 2 GB. Nothing in any source supports or refutes our current plan size. **Measure before upgrading.**

---

## The gap no source fills

Asked of the langtalks graph directly:

```
Q: how should a knowledge graph be versioned and rebuilt from source files
→ total_found: 0    "No matching nodes found."
```

And confirmed across all four full transcripts: **none discusses versioning graph content, rebuilding a graph from committed source files, migrations, or reproducibility.**

The closest adjacent primitives are weak. Source D has *"change events"* - a temporal delta log (*"this thing has changed six times over the last three months"*), used for Bayesian freshness reasoning, not a versioned source of truth. Source C has data-level versioning only - *"S3 buckets that everyone's using and delta data links"* - explicitly not schema-level.

Forty-four sources on graph databases, GraphRAG, agent memory and context engineering can tell us how to *retrieve* from a graph. None tells us how to *keep* one.

**Consequence:** the decision to put graph content in git and recompute vectors at build time is **unsourced**. That is not a reason to abandon it - it remains the right call, and the working precedent is in `langtalks-graph-expert` itself (`sources/*/extractions/*.jsonl` + `MANIFEST.json` + ingest scripts, rebuilt into `graph.json`). It is a reason to treat it as our own design decision, own the risk explicitly, and not cite these talks as support.

Migration ordering is likewise **NOT COVERED** by any source - no incremental-vs-rewrite guidance exists. Source A's only adjacent signal is that *"it's still required to do data modeling"*, and that a wrong answer in his demo traced to a modeling flaw rather than to retrieval: *"we have to fix that data modeling part and then it should be right."*

---

## Proposed order of work

Cheapest and most reversible first. Nothing here is started.

1. **Audit 19 → 6.** Enumerate the server-side tools, map to the six the plugin exposes, and record what capability is lost or duplicated. Evidence before design. *(Read-only.)*
2. **Read `github.com/memgraph/skills`**, specifically `memgraph-graphrag`. Adapt, do not invent. *(Read-only.)*
3. **Author the brain SKILL.md** to §8 - navigator-language name, routing table by question class, recovery paths, `references/` for Cypher and index detail.
4. **Promote `brain_schema`** to the documented first move for analytical questions.
5. **Add a dimension guard** between e5 output and the 9 vector indexes. Cheap; prevents a silent corruption class.
6. **Stage unresolvable writes** instead of committing them (§5.1) - the holding bin as a Decision Gate.
7. **Measure before any Memgraph upgrade** (§9). No source supports 2 GB viability either way.

Cutover of the old `mindrian-brain` (Neo4j Aura + Pinecone) and the dead `~/.claude.json` entry that is silently skipped for a missing `"type"` are tracked separately; neither blocks this work.

---

## Open questions

- Does hybrid ranking (semantic + structural) need to exist at all, given `match_strength` already works? No source offers a formula; this would be our own experiment and needs its own eval set.
- Is the 8-of-10 agreement threshold (§5.3) affordable for our ingest volume? Source C calls the cost explicit and accepted; we have not priced it.
- Should premise / evidence / rebuttal become graph nodes (§6), or stay in the harness? This is the largest schema decision on the table.
- ~~What is the eval set?~~ **ANSWERED, and the premise was wrong.** This document claimed "we have no equivalent". We do, and it predates this document by three weeks: `scripts/compare-text2cypher.mjs` plus a committed no-regression baseline at `tests/fixtures/eval-baseline.json`, gated by `gateBrainResults` and proven-failable by `tests/eval-gate-can-fail.test.mjs`. The real question is not what to build but what the existing measurement already says: **`nlAnswerAccuracy` is 0.14, two of fourteen natural-language questions yielding a useful grounded answer**, with the baseline naming arm-2 thinness as the cause. Every proposal in this document should be judged against whether it moves that number. Correction and detail: `docs/2026-08-09-HANDOFF-brain-consumption-surface.md` section 6.
