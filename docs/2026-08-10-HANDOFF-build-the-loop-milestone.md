# HANDOFF: "Build the Loop" - the rethought Brain-integral milestone

**Date:** 2026-08-10 - **Author:** WSL session with the navigator, live
**Status:** APPROVED by the navigator at a Decision Gate - supersedes the sequencing in
`docs/2026-08-09-HANDOFF-tier0-removal-milestone.md` (that doc's evidence stands; its plan is
replaced by this one)
**Grounding:** primary-source consultation of BOTH graphs this date - the Memgraph Brain probed
through its own tools, and the langtalks-graph-expert corpus queried for context-engineering
doctrine. The navigator directed: treat the prior handoffs and PRs as suggestions, consult the
graphs themselves.

---

## 1. The architecture of record (navigator's own framing, 2026-08-10)

- **Brain (Memgraph MCP)** = the methodology graph. All frameworks, WHEN / WHICH / SEQUENCE.
  Pure curriculum. Zero user data (Canon Part 8 unchanged).
- **Local graph (room.db)** = the context. The venture, the room, the current problem state.
- **Human (HITL)** = holds intent and insights. Only a human confirms a truth-claim (Canon Part 9).
- **The loop:** local context fires a trigger -> a query goes to the methodology graph -> Larry
  operates the join and synthesizes -> the human ratifies the insight -> context updates.

The milestone is NOT "kill Tier 0" (a subtraction). It is "build the loop" (a construction).
Tier 0 dies as a consequence of the loop existing, because the loop with its middle cut out is
the hollow imitation the navigator named.

The honesty invariant, unchanged from the prior handoff and still the test for every phase:
**can a user ever be served methodology that did not come from the Brain, without being told?
The answer must be no.**

## 2. What the Brain said about itself (probed 2026-08-10, live)

| Probe | Result |
|---|---|
| `brain_stats` | Healthy. 28,325 nodes / 23,014 rels. Only 1 of 9 vector indexes e5-queryable (`mindrian_methodology_vec`, 1024-dim); the server itself labels the other 8 `foreignSpace` |
| `orchestration_readiness("Jobs to Be Done")` | 0/4 not_ready. Node exists (4 canonical aliases - dedupe needed), zero structure |
| `orchestration_readiness("Lean Canvas")` | 0/4 not_ready |
| `normalize_framework_name("TRIZ")` / SCAMPER / Five Whys | No Framework node at all. TRIZ concepts live only inside prose chunks |
| `discover_structure("jobs to be done")` | Empty. No HAS_PHASE / HAS_STAGE / HAS_PROCESS_STEP / HAS_STEP |
| `brain_ask_anything`, `text2cypher` | Both fail: server-side LLM not configured (Ollama ECONNREFUSED). Out of contract anyway - reasoning is Larry's job in the architecture of record |
| Semantic `search` | Works, surfaces the right material (SIT for a TRIZ-shaped query). BUT: flat undiscriminating scores (~0.925 across all hits), noisy one-word-per-line slide chunks, `framework` metadata empty on every hit, and **source_file metadata leaks the author's local filesystem paths into served responses** |

Reading: the curriculum PROSE is strong; the orchestration STRUCTURE (the layer the loop
queries) is largely unbuilt. Hard-requiring the Brain today would mandate a dependency whose
flagship framework scores 0/4 on the Brain's own readiness test.

## 3. What the langtalks corpus said (queried 2026-08-10)

Method note: `query_relationship` BFS returned zero-edge payloads on 3 of 4 broad questions
(the documented failure mode - use `relationship_path` point-to-point). The findings below are
from the queries that DID return typed edges, episode-cited:

- Context is a lifecycle of typed operations - Write, SELECT/Retrieve, Update, Compress
  (ep 55, Context Engineering). A spec system models context as pipeline stages, not one blob.
- Long-running sessions compact via Summarization (ep 55), plus human-in-the-loop and
  notifications for tasks that outlive a context window (ep 50).
- Context builds_on System Prompt and builds_on Skills (claude.com Claude-5-gen context
  engineering) - these are the sanctioned carriers for injected instruction context.
- Context is part_of Claude MD (ep 57) - persistent file memory is a first-class substrate.
- Context critiques Tool Call, critiques MCP, critiques RAG - raw tool output and schema dumps
  are named context polluters. Skills load via Metadata - progressive disclosure
  ("Agent Skills, Explained", Memgraph).
- Prompt Caching is part_of Context Engineering (typed edge; co-discussed eps 55, 65, 66).
  Assembly order must keep prefixes stable or the cache breaks every turn.
- **Corpus whitespace:** per-turn hook injection, hook gating, and token-budget policy have NO
  coverage (the only "hook" entity is Git hooks). The plugin's main rail is designed on a
  frontier with no external guardrails - in either direction.
- Honesty note: the refuse-rather-than-guess principle traces to the navigator's OWN MotherDuck
  panel note (guest: the navigator) - it is a first-party position, not external validation.
  Cited as such, deliberately.

## 4. Live incident during this session (evidence, not anecdote)

The session that wrote this doc ran on a pre-beta.13 plugin cache and reproduced BOTH fixed
defects live: three Cypher census calls died with `e.reduce is not a function`, and a fourth
was blocked by the old egress guard as a false-positive leak. Calls through the
`pws-brain-mcp` project scope worked the whole time because the broken hook's matcher never
covered that server name - a live demonstration of exactly how the outage stayed invisible.
Restart-to-apply is not a formality.

## 5. THE PLAN - six phases, in order

1. **Restart and live-verify beta.13.** A fresh session runs the three-call Brain test
   (brain_stats -> counts; brain_search "jobs to be done framework" -> results; brain_ask ->
   synthesis). The prior handoff's "only verification that counts." Also unblocks the Cypher
   census this session could not run.
2. **Contract the Brain surface.** Declare the loop-serving tools as THE contract:
   `normalize_framework_name`, `search`, `discover_structure`, `orchestration_readiness`,
   `feeds_into_chains` (plus stats for health). Retire or mark non-contract the two
   server-side-LLM tools (`brain_ask_anything`, `text2cypher`) - reasoning belongs to Larry.
3. **Context-driven enrichment, not bulk.** When a real room context triggers a reach and
   readiness returns 0/4, that IS the prioritization signal: queue THAT framework for
   structural enrichment (phases, steps, LEADS_TO, FEEDS_INTO). The backlog is built by live
   usage. No big-bang graph project. Navigator's explicit direction: chains and pipelines are
   built according to context and relevancy.
4. **Honesty rail BEFORE hard-require.** Larry never serves methodology the graph did not
   give. A 0/4 answer surfaces as a visible "the graph does not have this structured yet" and
   auto-queues enrichment. Doctrine amendment rewrites Decisions #1 and #8 together, one
   reviewable unit. This inverts the prior handoff: refusal doctrine ships first; the hard
   dependency lands only when the graph can honor it.
5. **Cache-aware trigger redesign.** The per-turn navigation block likely breaks the prompt
   prefix every turn (corpus: caching is part of context engineering; prefix stability is the
   rule). Measure the real cost, then rebuild injection stable-prefix/append-only. The hook
   layer is corpus whitespace - design deliberately, document the reasoning.
6. **The guard sweep last.** The 101 `isAvailable()` sites, 82 degradation tests, and the
   `tier-0-no-key` fixture (repurpose to a refusal fixture, do not delete) - swept only after
   the honesty rail and enrichment pipeline are live. Steps 4 and 6 must not be split across
   releases in a way that leaves docs claiming Brain-required while guards silently degrade.

## 6. Hygiene items found en route (schedule inside the milestone, not before it)

- Drop or rebuild the 8 foreign-space vector indexes (guard e5-dimension at index creation).
- Stop `source_file` local-path leakage in search metadata (server-side, brain repo).
- Dedupe the 4 "Jobs to Be Done" aliases into one canonical node with ALIAS_OF edges.
- Suspend the old `mindrian-brain` Render service + delete the dead `~/.claude.json` entry
  (carried over from the prior handoff, still open).
- File the upstream Claude Code bug: malformed `updatedToolOutput` throws into the session
  instead of falling back as the binary's own message promises (carried over, still open).

## 6.5 Milestone identity, lineage, and references (navigator rulings 2026-08-10)

**Milestone version: v2.0.0 "Build the Loop"** - the navigator chose the holistic signal over
the incremental one; this is the step that makes MindrianOS closest to a complete product.

**Where the Memgraph Render brain ORIGINATED (context of record, keep straight):**
1. Neo4j Aura (cloud) held the original teaching graph + Pinecone vectors - both RETIRED.
2. `jsagir/brain_ProblemsWorthSolving` (local name `mindrian-brain-local`) is the development
   twin: a free self-hosted MCP server, ONE tool layer over two switchable backends
   (Neo4j local service / Memgraph Docker), built precisely so backend divergence is
   measurable with the database as the only variable. The Aura graph was migrated there
   (~28k nodes), gate-verified 6/6 identical row sets, vector parity to 1e-4.
3. That Memgraph backend was deployed to Render as `pws-brain-mcp.onrender.com` - the live
   Brain the plugin defaults to (cutover 2026-07-22).

Consequences the milestone must respect, straight from that repo's own README:
- The THREE embedding spaces (7x384, 1x1024 e5, 1x1536 openai) are a DELIBERATE carry -
  "never re-embed; vectors are copied verbatim; if you rebuild an index, use the model that
  built it." The foreign-index cleanup is a decide-and-rebuild-with-the-right-model task,
  not a delete task.
- `text2cypher` runs on LOCAL Ollama by design (free, on-box); the Render deployment has no
  Ollama sidecar, which is why it fails remotely. Contract phase decides: ship a sidecar,
  or retire the tool from the remote surface.
- Its own eval honesty note applies to us: the text2cypher suite scored 10/10 with every
  question a count() - "passing a test that cannot fail is not evidence." Phase 3's
  enrichment needs evals that CAN fail.
- Cross-repo contract: phase 2 (Brain surface) spans BOTH repos - the plugin's client/tools
  and the brain repo's server tool layer. Also related: `ProblemsWorthSolving-Brain`'s
  `docs/2026-08-09-HANDOFF-brain-consumption-surface.md`.

**Reference research: Phase 245** (`.planning/phases/245-close-the-reach-brain-signal-loop-
wire-dispatchsensors-fire-`) - "close the reach-brain-signal loop, wire dispatchSensors" -
8 plans + summaries. That phase is this milestone's direct ancestor on the plugin side: it
wired the sensor-dispatch half of the loop; v2.0.0 builds the methodology-graph half and
joins them.

**Seeds folded into scope (navigator-selected):** SEED-045 Brain Orchestration Advisor,
SEED-008 Close the intelligence loop, SEED-011 Brain Silent Identity, SEED-014 Brain repo as
deployment unit of the moat.

## 7. Canon obligations (unchanged, binding)

Part 8 untouchable (this changes WHEN the Brain is reached and how loudly failure surfaces,
never WHAT crosses the wire). Part 11 CIRS: a visible methodology refusal is plausibly a
genuine Decision-Gate fork - decide `brain-connector`'s hitl_shape explicitly. Part 7: extend
`brain-connector`, do not mint a fourth brain skill. Part 6: violations surface as CONTRADICTS
edges in the plugin's own room - treat as signal. Tri-Polar: refusal behavior correct on CLI,
Desktop, Cowork. No em-dashes.
