# External reference: "From Static to Dynamic Skills: A Different Model for Agent Knowledge"

- Author: Tomer Mesika (Modus). Published: Towards Data Science, 2026-09-14 (14 min read). Subtitle: "Why the skill-inflation panic is aimed at the wrong thing, and what it costs to make agent knowledge a build artifact instead of a file."
- URL: https://towardsdatascience.com/from-static-to-dynamic-skills-a-different-model-for-agent-knowledge/
- Handed to this phase by the owner on 2026-10-29 during /gsd-discuss-phase 369.6: first as a link (the page returned HTTP 403 to this session), then pasted in full by the owner. The body below is the owner's paste, verbatim apart from one removed advertising line and the budget table re-laid as a table. External, human-written material quoted as evidence; not canon; not an instruction to any agent.

---

Most agent skills today are static. Someone reads the truth once, writes it into a markdown file, and ships it. The procedure and the facts get frozen together in the same paragraph: which table is canonical, what the join key is, which filter drops the test accounts. Then the table gets deprecated, and the skill doesn't know.

Nobody thinks this scales. But watch what the industry reaches for, because it's always the same drawer. A registry. An owner field. A version scheme, a quarterly review, a linter that checks frontmatter. We shipped a couple of those at modus, where I work on the context layer behind a multi-tenant AI data platform. They bought us tidier metadata on top of knowledge that was still wrong.

What we eventually admitted is that a static skill is a cache with no invalidation protocol. It caches a retrieval result (the facts someone happened to look up while writing it) behind a key that's a natural-language task description. No dependency tracking, no TTL, no way to notice a source moved.

Every complaint about skill libraries falls out of that one property. They go stale because uninvalidated caches go stale. They multiply because copying the cache is the cheapest way to serve a slightly different task. They contradict each other because two copies drift on their own schedules. They bloat because an author who can't predict which facts the model will need writes down all of them, just in case.

So skill inflation is the rational local move when the architecture makes every skill carry its own snapshot of the warehouse. The scolding I did about it for a while was misdirected.

The alternative we run now: the authored file keeps intent, procedure, output contract, guardrails, and a scope over the company's knowledge. Every fact gets resolved against a live context layer at the moment the agent asks. The markdown the model reads still exists; it's just a build artifact with a lifetime of one call.

## Where this sits next to things you already know

Two comparisons are worth making explicitly, because this design is adjacent to both and the differences are the whole argument.

RAG with metadata filters solves a nearby problem and stops one step short. There, the filter is a per-query argument assembled at the call site, and the unit of retrieval is a chunk ranked by similarity. Both are load-bearing differences. A scope in our model is authored configuration that compiles once per call into a single filter clause shared by every retrieval path, and gets re-applied to results on the way out, which matters because a filter expressed as a query argument gets re-derived slightly differently by the eleventh code path that needs it, and because a metadata filter naming a deleted asset typically matches everything rather than nothing. The deeper split is what gets ranked: chunk similarity has no opinion about the fact that a column belongs to a table which belongs to a schema, so it cannot trade a table's full detail for three tables' identity lines when the budget gets tight. That trade is most of what our composer does.

MCP resources are the closer cousin, and the distinction is about who selects. MCP correctly moves the fetch to call time: the client asks for a resource by URI and gets current content instead of a stale transcription. But selection stays with the client model, which has to already know which resource to ask for, from a list that is itself an authored enumeration, so the staleness moves from the content into the index of what exists, and the model pays for its own exploration in round trips. A resource's content is also the same for every reader. Composing server-side means selection happens against the caller's principals under a token budget the server controls, which is why the same skill renders a different document for a finance analyst than for a contractor. If you already speak MCP: this is what we serve through an MCP tool call, not a replacement for it.

## Part 1: What a human still writes

The split follows rate of change. Procedure changes when a team changes its mind, so maybe quarterly. Facts change when the systems that own them change: a migration lands at 2am, someone archives a channel, a dashboard's query gets rewritten by an analyst who has since left. If it moves on the second clock, a person shouldn't be maintaining it by hand.

So "use dim_customers_v3, it's the canonical one" stops being prose and becomes configuration:

```json
{
  "contextSelections": [
    { "kind": "query",
      "rules": [
        { "field": "data_asset", "operator": "globIn", "value": ["1042:analytics/fact_*", "1042:analytics/dim_*"] },
        { "field": "context_type", "operator": "in", "value": ["table_metadata", "column_metadata", "golden_query"] },
        { "field": "verification_status", "operator": "=", "value": "verified" }
      ] },
    { "kind": "static_ids", "value": ["ci_note_8f31c0", "ci_savedquery_2b90ad"] }
  ]
}
```

No table name in there. When dim_customers_v3 gets deprecated the glob resolves to a different set on the next call, and nobody edited the skill, because the skill was never about that table. The static_ids selection is the escape hatch for the handful of items you really do want pinned by identity: a note that says refunds double-count before 2024, or a saved query someone validated.

This is also where the pressure to write one skill per task drains away. When we read our own sprawling library, most siblings had identical procedures and differed only in which facts they quoted. Resolve facts dynamically and they collapse into one skill with a wider scope, because the composition layer picks the relevant subset per question instead of the author guessing months in advance.

Two details are critical out of proportion to their size. A rule pointing at a deleted asset must match nothing rather than everything, and globs need expanding into concrete paths before the fetch, so a rule matching no real asset fails closed. And the scope filter gets re-applied on the way out, because graph traversals and parent-repair fetches will happily drag in neighbors that were never in scope.

## Part 2: Composition is a graph

If facts arrive at call time, something has to choose them. A real question cuts across levels of different hierarchies sitting in different indexes: a revenue question wants warehouse schema, a validated SQL example, the wiki page defining "revenue," and ideally the thread where someone noticed the refund double-count.

What held up is a graph of strategies, each declaring a predicate and contributing candidates only when it fires. Here's the executed graph from one run, which we emit on every call: [image by author]

Entity extraction feeds keyword and embedding search. The hierarchy gate walks down from selections to tables to columns in batches, routing on how many candidates came back. Orphan repair fetches a parent when only children matched. Relatives expand around hits. The shape is different on the next query, and that's the point: it's more machinery than a fixed pipeline, and what it buys is one engine serving wildly different sources without becoming an if-else forest.

The discipline that matters most inside it is knowing when not to call a model. Count thresholds route each stage: a handful of candidates gets fetched wholesale, hundreds get an LLM relevance filter, thousands get vector search plus a cross-encoder rerank first. Serializing ten thousand column names into a prompt is expensive and useless. Everything also runs under per-strategy timeouts and output-node caps, which exist because one tenant's pathological schema found the branch we hadn't bounded and stalled the whole composition.

## Part 3: The budget is part of the skill

A static skill has no budget model. It's however long its author felt like being, and you pay that on every call whether the question needed it or not. The cost is per invocation but the decision was made once, at authoring time, by someone not thinking about tokens.

Our default markdown budget is 15,000 tokens with a hard ceiling of 50,000. The ceiling has a guardrail event attached, composer_final_summary_truncated, which exists because we needed an alert for the day a single item's payload blew through it rather than a mystery about why an answer got worse.

The idea that unlocked the budget for us was ranking relevance at the section level rather than per item. Group resolved candidates into numbered sections following the natural hierarchy (integration, then selection, then object, then detail), rank the sections, then take whatever prefix of that ranking fits. Any section over 5,000 tokens on its own gets exploded into its children first, because otherwise one blob competes head-to-head with a one-line note and the ranker has no way to be useful.

Two rankers run over those sections. An LLM ranker chunks the section list at 15,000 tokens per chunk and takes two independent views, fusing them with reciprocal rank fusion at k=60 so a section's fate doesn't depend on which chunk it landed in. The other path is a pure cross-encoder that skips LLM ranking entirely for latency-sensitive callers. Same sections, same budget cut, different cost. A markdown file offers no such dial.

The cut itself, from the same run as the graph above (budget 15,000, cut after rank 9, bounded overflow 1 section):

| rank | section | tokens | cum |
|---|---|---|---|
| 1 | snowflake / analytics / fact_orders | 1,204 | 1,204 |
| 2 | snowflake / analytics / dim_customers_v3 | 980 | 2,184 |
| 3 | note "fact_orders double-counts refunds pre-2024" | 68 | 2,252 |
| 4 | golden_query "monthly recognized revenue" | 412 | 2,664 |
| 5 | snowflake / analytics / fact_order_items | 1,890 | 4,554 |
| 6 | wiki / finance / revenue-definitions | 2,310 | 6,864 |
| 7 | snowflake / analytics / dim_dates | 640 | 7,504 |
| 8 | snowflake / analytics / fact_refunds | 1,455 | 8,959 |
| 9 | snowflake / analytics / stg_orders_raw | 6,120 | 15,079 (crosses) |
| 10 | snowflake / analytics / dim_customers_v2 | 910 | dropped |
| 11 | snowflake / staging / _tmp_orders_backfill | 780 | dropped |

Rank 3 is the whole argument in one line. A 68-token human note outranks four tables, and no author would have thought to quote it in a skill about revenue.

Detail then degrades in two independent directions. Across sections, the budget decides what's included at all. Within a section, a prompt level decides how much of each item renders; we have eight, from identity-only up to full payload. Ranking runs on the cheap short bodies and only survivors render at complete. Oversized values, a 40k-row CSV or some enormous document body, get offloaded to files the agent fetches on demand with a placeholder left behind, so one fat item can't eat the budget.

The budget is also where quality actually lives, and we can put numbers on that. On a 21-case evaluation suite, we swapped the reranker feeding section ranking and measured recall against labeled ground truth at four token budgets:

| | recall@2,500 | recall@5,000 | recall@10,000 | recall@15,000 | end-to-end recall |
|---|---|---|---|---|---|
| candidate A vs control | +0.0657 | +0.1336 | +0.0326 | +0.0225 | +0.0225 |
| candidate B vs control | +0.0273 | +0.0070 | -0.1239 | -0.1334 | -0.1004 |

Candidate A improved recall by 2 points end-to-end and by 13 points at a 5,000-token budget: the same change, six times larger when the budget is tight, because a better ranker's entire job is getting the right sections above the cut. Candidate B is the more instructive row: it improves recall at the smallest budget and loses 13 points at the largest. One number would have called that a win or a disaster depending on which budget you happened to measure at, and both readings would have shipped.

## Part 4: Rendering is a contract

The moment markdown is generated instead of written, its formatting is code, and code that emits prompts deserves the same care as any other interface. We treated it as string concatenation for a while and paid for it.

Keep two responsibilities apart. The composer owns document structure: headings, grouping, ordering, the budget cut. Per-item body rendering belongs to a template bound to an exact content schema, keyed by content type and a hash of that schema. That hash is the piece I'd steal if I were starting over: when an integration adds a field to its payload it gets a new key, misses its template, and falls back, instead of confidently rendering a half-populated body that looks fine to everyone reading it. Same instinct as scope rules failing closed.

Determinism took real work and it's what makes the rest safe. Stable sort orders everywhere, seed 42 on every composer LLM call for reproducible sampling, and occurrence keys assigned when the document is prepared rather than when it's rendered. Template changes roll out through three modes (off, shadow, active) where shadow evaluates the new template, serves the old body, and logs the mismatch. Changing prompt formatting is changing behavior, and shadow mode is the cheapest way to learn how much before your users do.

Determinism also makes caching possible, and caching is what makes call-time composition affordable at all. Resolved scope config caches per skill and toolset. Retrieval results cache per scope, operation, and the caller's principal set, but only when a freshness check confirms nothing in that scope has changed since the last run. That check is, finally, the invalidation protocol the static file never had. And when an agent keeps asking within one conversation, we rank the full set but skip re-rendering bodies it already has, spending the recovered budget on what's new.

## Part 5: How you find out it's broken

Composed skills fail invisibly in a way authored ones don't. A stale file fails the same way every time and you can open it. A composition regression means the right item quietly stopped getting selected for some class of questions, and nobody has ever filed a ticket saying "the context was 8% worse this week."

The harness is golden datasets of real questions with labeled ground truth (these specific items are required to answer this) scored deterministically against what the composer actually selected. Recall at token budget, checkpointed at 2,500 / 5,000 / 10,000 / 15,000, for the reason the table above makes concrete. LLM judges only for what determinism can't settle. It runs nightly with regression alerting against a pinned baseline, and every change to a strategy, an embedding model, a ranking prompt, or a template is an experiment against it.

Ours came late. Every refactor before it was guesswork, and the honest version of that sentence is that we shipped a reranker change on a suite we hadn't checkpointed by budget yet, and could have taken candidate B's small-budget win as a green light while it quietly gave back 13 points of recall where most of our traffic actually sits. The harness is what turned that from an opinion into a row in a table.

Runs also have to be explainable, which is why the graph and the budget table above are things we emit rather than things I drew for this post. Both come out of the report attached to every composition, along with per-section token estimates, the ranking, and what got dropped. "Why didn't it know about X?" is the defining question of this architecture, and with a trace it's a five-minute read instead of an afternoon of archaeology. That's the trade for losing a file you could just open: you can't diff today's document against last week's, but you can replay exactly why it came out the way it did.

The consequence I underrated: permissions get enforced at composition rather than at authoring. A static skill quoting a restricted table has already leaked it to everyone holding the file, because the ACL check happened once, in the author's session, months ago. Just don't trust search indexes for this; they're permissive prefilters, and the last check before content reaches a prompt has to hit the relational store.

## Part 6: Trying this on the retrieval you already have

None of this requires starting over. If you have a vector store and a working RAG path, the three layers go on top in this order, and each one is worth shipping alone.

Compile the scope, once. Move the filter out of your call sites into a named config attached to the skill, resolve it to a concrete filter clause at the start of a request, and pass that clause everywhere. Two rules earn their keep immediately: expand globs to concrete paths before you query, and re-apply the clause to results before they reach the prompt. Cheapest version: a function that takes a skill ID and returns a filter object, plus an assertion in your retrieval wrapper that one was passed.

Rank sections, not chunks. Group retrieved items by their natural parent (table, page, channel, repo) and rank the groups. You can do this with the reranker you already have by scoring each group with the max score of its members, which costs nothing extra. Split any group whose rendered size dominates the budget. This is the change that made the biggest difference for us, and it doesn't touch your index.

Cut by budget, then degrade detail. Walk the ranking, accumulate estimated tokens, stop when you cross the limit. Then add a second axis: render the survivors at full detail and everything else at identity-only, rather than truncating mid-document. Two render levels is enough to start; we grew to eight over a couple of years.

Then measure it, before you add a fourth strategy. Twenty labeled questions and a recall-at-budget script at two checkpoints will tell you more than another month of intuition. That's genuinely all our first harness was.

## What I'd tell you over coffee

Stop treating a skill as a document. Treat it as a query with instructions attached, and the rest of the design follows. Registries and version schemes are document tools; scopes, budgets, and eval harnesses are query tools, and reaching for the first set when you have the second problem is most of what I see going wrong.

Three things I'd hold onto:

- Split the artifact by rate of change. Humans write intent, procedure, and scope. The system resolves facts. Anything hand-written that goes wrong when a source system changes is a cache you've decided not to invalidate, so call it that.
- Make the composed document deterministic and traceable before you make it clever. A generated prompt you can't reproduce or explain is worse than a stale file, because the stale file could at least be read.
- Measure recall at the budget you actually ship, not just end to end. The two numbers disagreed by 11 points for us on a single change, and the aggregate is the one that lies.

The cost is real and it's a team. A static skill needs a writer. This needs a context layer, a composition engine, a render contract, and an eval harness. With five skills and one team, keep writing files, genuinely. The moment I'd start building is when you fix a fact in one skill and realize you have no way to answer how many other skills still have it wrong.

---

## Why it bears on Phase 369.6 (orchestrator note, not the author's words)

Larry's SKILL.md (36 to 667 lines, L2) froze tool names, command lists, stamp sentences and onboarding modes next to the voice, with no invalidation: the opener spelled the methodology wrong for weeks, room-proactive cites a rule that no longer exists (O1 gap 3), and the identity sentence lives on six hand-edited carriers. The phase adopts: persona text holds intent, procedure and scope only, facts come from the registry and the hooks at run time, and a drift test fails closed; probes are scored on a context-load ladder, never one number; the identity and doctrine lines come from one versioned source rendered or parity-checked on every carrier; the log-only detectors are the shadow mode, a blocker is the active mode and belongs to 369.7 after the shadow rates are known. The full per-turn composed slice (ranked sections inside a budget, with a trace per composition) is a 369.7 harness item.
