# Phase 363 - Open-source deep-research agents: what to learn, and how

Advisor research for gray area: study-and-reimplement vs wrap vs hybrid.
Date: 2026-09-29. Repo metadata pulled from the GitHub REST API the same day (`gh api repos/<r>`).
Star counts are a snapshot on that date. Everything else is from the repo README or source file named.

## 0. What MindrianOS already has (so the comparison is honest)

- `lib/core/research-corpus.cjs` - one CJS fetcher, `fetchCorpus` / `fetchCorpusEnvelope`, sources openalex/arxiv/pubmed (via `rs-fetcher-academic.cjs`), tavily, brain-cypher (generic handles only).
- `lib/core/research-cache.cjs` - shared TTL, source-keyed disk cache (`cacheKey`, `getCached`, `putCached`), already hashes.
- `lib/core/rs-query-matrix.cjs` - deterministic 60-query template matrix with `FORBIDDEN_PATTERNS` egress scan (`ExternalEgressViolation`).
- `lib/core/part8-egress-guard.cjs`, `part8-egress-ontology.cjs`, `rs-egress-*.cjs` - the Part 8 egress guard.
- `lib/core/rs-corpus-quality-gate.cjs` - offline degenerate-corpus detector.
- `lib/core/research-filing-selector.cjs` - F.1 filing gate for a ranked finding.
- `lib/core/rs-mind-map.cjs` - a mind-map module already exists.
- `commands/dominant-designs.md` research mode (Phase 361) + `scripts/dominant-design-research.cjs` + `agents/dominant-design-researcher.md`: compose lanes -> `audit-query` -> gate card (edit/drop lane, max 2 queries per lane) -> parallel Agent fan-out, one per approved lane, clamped by `futures/orchestrator.cjs::resolveFanoutCap` -> `validate-lane` against the approved set -> synthesis. This is already a supervisor/researcher fan-out with an approved-exact-string egress contract.
- `commands/research.md` (`reach_id: deep_research`, F.8 any-order basket, emits EvidenceClaim nodes).

Takeaway: MindrianOS already owns the runtime (Claude Code subagents), the retrievers, the cache, the egress guard and the filing gate. What it lacks is a PLANNER (plan object, mode knobs, iteration/stop logic, counterevidence lane, evidence-memory-grounded synthesis). That is exactly the part the OSS projects are good at, and it is mostly prompt-and-control-flow, not heavy code.

## 1. Per-project findings

### 1.1 assafelovic/gpt-researcher
- Repo: https://github.com/assafelovic/gpt-researcher - Apache-2.0, Python, last push 2026-09-26, 29,747 stars. Active.
- Plans: "planner and execution agents. The planner generates research questions, while the execution agents gather relevant information. The publisher then aggregates" (README "Architecture"). Inspired by Plan-and-Solve.
- Modes: `ReportType` enum in `gpt_researcher/utils/enum.py`: `research_report`, `resource_report`, `outline_report`, `custom_report`, `detailed_report`, `subtopic_report`, `deep`. Deep mode is tree-like recursive breadth/depth. Defaults in `gpt_researcher/config/variables/default.py`: `DEEP_RESEARCH_BREADTH: 3`, `DEEP_RESEARCH_DEPTH: 2`, `DEEP_RESEARCH_CONCURRENCY: 4`, `MAX_ITERATIONS: 3`, `MAX_SUBTOPICS: 3`, `MAX_SEARCH_RESULTS_PER_QUERY: 5`, `RETRIEVER: "tavily"`.
- Iteration / stop: bounded by depth and breadth parameters (fixed budget, not a judged stop).
- HITL: `multi_agents/` (LangGraph + AG2) has agents `plan_review.py`, `human.py`, `fact_checker.py`, `reviewer.py`, `reviser.py`. `task.json` has `include_human_feedback`, `max_plan_revisions: 3`, `guidelines`. `plan_review.py::route_human_feedback` returns accept/revise and raises `MaxPlanRevisionsExceededError` past the cap.
- Source quality / context: "Smart Context Filtering" - default filter is Jev by TypeSafe (scores passage usefulness to the question), falls back to local BM25 keyword ranking with no API key (`CONTEXT_FILTER=auto|jev|keyword|embeddings|none`). README reports a benchmark on 28 tasks (73% relevant passages kept with Jev vs 46% embeddings); that is the project's own benchmark.
- Also ships: MCP retriever (`RETRIEVER=tavily,mcp`), a separate MCP server (gptr-mcp), and a "Claude Skill" (`npx skills add assafelovic/gpt-researcher`).
- Novel for us: plan-review gate with a revision cap; usefulness-based passage filter with a free local fallback; the SAME Jev model MindrianOS already reaches through Theo (SEED-097 V6).

### 1.2 stanford-oval/storm (STORM + Co-STORM)
- Repo: https://github.com/stanford-oval/storm - MIT, Python (dspy), last push 2025-09-30, 31,521 stars. Slowing (no push in a year).
- Plans: two stages - pre-writing (research + outline) then writing. "Perspective-Guided Question Asking": discovers perspectives by surveying articles on similar topics, then uses them to steer question asking. "Simulated Conversation" between a writer and a grounded topic expert to generate follow-ups. Papers: https://arxiv.org/abs/2402.14207, Co-STORM https://www.arxiv.org/abs/2408.15232.
- Modes: not quick/deep; stages are toggles `do_research`, `do_generate_outline`, `do_generate_article`, `do_polish_article` - when False, the stage LOADS prior results. That is a checkpointed, resumable pipeline.
- Co-STORM: turn policy among LLM experts, a Moderator that asks questions "inspired by information discovered by the retriever but not directly used in previous turns", and a human who can observe or inject to steer. Keeps a dynamic hierarchical "mind map" as a shared conceptual space.
- Citations: article generated with citations from collected references.
- Novel for us: perspectives drive questions (maps directly onto MOS-CANVAS perspectives and hats); moderator mines retrieved-but-unused evidence for the next question; human steering mid-run; mind map as shared state.

### 1.3 langchain-ai/open_deep_research
- Repo: https://github.com/langchain-ai/open_deep_research - MIT, Python (LangGraph). GitHub reports `archived: true`; last commit 2026-08-10 (a dependency bump). Treat as a frozen reference, not a dependency.
- Plans: `deep_researcher.py` graph: `clarify_with_user` (skippable, `allow_clarification` default True) -> `write_research_brief` -> `research_supervisor` -> researchers -> `compress_research` -> final report.
- Supervisor tools: `ConductResearch` (delegate), `ResearchComplete` (stop), `think_tool` (reflection). Defaults in `configuration.py`: `max_concurrent_research_units` 5, `max_researcher_iterations` 6, `max_react_tool_calls` 10, `search_api` Tavily.
- Stop rules in `prompts.py`: supervisor "Scaling Rules" - simple fact-finding uses 1 sub-agent; comparisons use one sub-agent per compared element. Researcher "Hard Limits": stop after 5 search calls if right sources not found; "Stop Immediately When" 3+ relevant sources found.
- Citations: compression prompt demands "ALL of the sources", inline citations, a Sources section, "It's really important not to lose any sources"; final report assigns each unique URL one sequential number.
- HITL: current version only clarifies; the `legacy/graph.py` workflow had "human-in-the-loop planning" with "feedback and approval of report plans". README says legacy is less performant.
- Evidence of quality: README claims #6 on Deep Research Bench (overall 0.4344, 2025-08-02). Author blog on moving from workflow to agent: https://rlancemartin.github.io/2025/07/30/bitter_lesson/
- Novel for us: explicit brief artifact; scaling rules (fan-out proportional to question shape); ResearchComplete as an explicit stop signal; per-unit compression that must keep every source.

### 1.4 dzhng/deep-research
- Repo: https://github.com/dzhng/deep-research - MIT, TypeScript/Node, last commit 2026-04-11, 19,739 stars. Goal "<500 LoC".
- Plans: asks follow-up questions to refine direction, then generates SERP queries each with a `researchGoal`.
- Modes: `breadth` (recommended 3-10, default 4) and `depth` (recommended 1-5, default 2). Produces `report.md` (long) or `answer.md` (short answer mode).
- Iteration: `src/deep-research.ts` - each query returns `learnings` + `followUpQuestions`; recursion with `newBreadth = Math.ceil(breadth / 2)`, `newDepth = depth - 1`; next queries are built from prior goal + follow-ups + learnings. Stops at depth 0 (pure budget stop). Concurrency via `pLimit`.
- Citations: weak - a flat `## Sources` list of `visitedUrls`, not claim-level.
- Novel for us: the simplest correct recursion shape; breadth halving as depth grows keeps cost bounded; "learnings" as the compact carried state. Node, so trivially readable for a CJS port, but it is 500 LoC of prompts, not worth a dependency.

### 1.5 jina-ai/node-DeepResearch
- Repo: https://github.com/jina-ai/node-DeepResearch - Apache-2.0, TypeScript/Node, last commit 2026-05-01, 5,231 stars.
- Explicit positioning: "we focus solely on finding the right answers via our iterative process. We don't optimize for long-form articles". Loop: search -> read -> reason until answered or token budget exceeded.
- Plans: a "gaps" queue of sub-questions. Actions: answer, reflect, search, visit. Reflect adds deduplicated new sub-questions to the gaps queue.
- Iteration / stop: action masking - if reflect yields no new unique question, reflect is disabled next step; same for search (no new URLs) and visit (no new content). On budget exhaustion enters "Beast Mode" and forces a final answer. An answer to the original question is evaluated; if not "definitive" or lacking references, it is stored as a bad attempt and the loop continues.
- Evaluator types in `src/tools/evaluator.ts`: `definitive`, `freshness`, `plurality`, `completeness`, `strict`.
- Blog guide: https://jina.ai/news/a-practical-guide-to-implementing-deepsearch-deepresearch
- Novel for us: typed evaluators as stop criteria; action masking to prevent loops; honest forced-synthesis at budget end; bad attempts remembered.

### 1.6 huggingface smolagents examples/open_deep_research
- Repo: https://github.com/huggingface/smolagents/tree/main/examples/open_deep_research - Apache-2.0, Python, smolagents last push 2026-09-23 (29,570 stars for the library).
- Structure (`run.py`): a manager `CodeAgent` (actions written as Python code) with a managed `ToolCallingAgent` named `search_agent` (`max_steps=20`, `planning_interval=4`) over a `SimpleTextBrowser` plus `TextInspectorTool` (`text_limit = 100000`).
- README: 55% pass@1 on GAIA validation vs 67% for OpenAI Deep Research (their reported numbers).
- Novel for us: periodic re-planning every N steps (`planning_interval`). Code-as-action is not relevant to a no-sandbox plugin.

### 1.7 Alibaba-NLP/DeepResearch (Tongyi DeepResearch; the WebAgent repo redirects here)
- Repo: https://github.com/Alibaba-NLP/DeepResearch - Apache-2.0, Python, last commit 2026-02-27, 19,994 stars. `Alibaba-NLP/WebAgent` API lookup resolves to this repo.
- It is primarily a trained model (Tongyi-DeepResearch-30B-A3B, 128K context) plus inference scripts. Needs Serper, Jina reader, a summarization LLM, Dashscope, a Python sandbox.
- Inference paradigms: ReAct, and "Heavy" mode built on IterResearch (https://arxiv.org/abs/2511.07327): each round reconstructs a streamlined workspace from the question plus an evolving central report; "the evolving report preserves only validated findings while discarding exploratory dead-ends". Heavy mode runs agents in parallel, each producing a compact report, then synthesizes (blog https://tongyi-agent.github.io/blog/introducing-tongyi-deep-research).
- Sibling paper WebWeaver (https://arxiv.org/abs/2509.13312): planner interleaves evidence gathering with OUTLINE optimization; outline sections cite IDs in a memory bank; writer composes section by section, retrieving only that section's cited evidence.
- Novel for us: evolving report as the only carried memory (bounded context at any depth); outline-with-evidence-IDs then section-by-section writing. The training stack is irrelevant.

### 1.8 LearningCircuit/local-deep-research (LDR)
- Repo: https://github.com/LearningCircuit/local-deep-research - MIT, Python, last push 2026-09-29, 9,141 stars. Very active.
- Modes: "Quick Summary" (README: 30 seconds to 3 minutes with citations), "Detailed Research", "Report Generation", "Document Analysis". MCP server `ldr-mcp` exposes `search` (raw, no LLM), `quick_research`, `detailed_research`, `generate_report`, `analyze_documents`, `list_strategies`.
- Plans: multiple strategies; default `langgraph-agent` where the LLM picks which engines (arXiv, PubMed, Semantic Scholar, SearXNG, etc.) per query.
- Source quality: "Journal Quality System" - journal reputation scoring with predatory detection, powered by OpenAlex (CC0), DOAJ (CC0) and Stop Predatory Journals (MIT).
- Knowledge base loop: research -> download sources -> encrypted library -> index -> searchable in later research. Per-user SQLCipher DB, no telemetry. MCP server "local use only", no auth.
- Novel for us: quick/detailed/report as named tiers with a no-LLM raw search tier; journal-quality scoring from open data; research results feed a local library that later runs search first.

### 1.9 RUC-NLPIR/WebThinker
- Repo: https://github.com/RUC-NLPIR/WebThinker - MIT, Python, last push 2025-12-08, 1,470 stars. NeurIPS 2025 (https://arxiv.org/abs/2504.21776).
- A large reasoning model searches, explores pages and drafts report sections inside its own thinking, end-to-end; trained with RL. Needs a hosted open reasoning model.
- Novel for us: "draft while researching" (write sections as evidence arrives) - conceptually close to WebWeaver. Not reusable as code.

### 1.10 OpenScholar (AkariAsai/OpenScholar) and Ai2 ScholarQA (allenai/ai2-scholarqa-lib)
- OpenScholar: https://github.com/AkariAsai/OpenScholar - Apache-2.0, Python, last push 2025-08-13, 1,612 stars. Retriever + trained reranker; self-reflective generation with a `feedback` self-feedback loop and `posthoc_at` post-hoc citation attribution; supplements with Semantic Scholar API and web search.
- ScholarQA: https://github.com/allenai/ai2-scholarqa-lib - Apache-2.0, Python, last push 2026-06-25, 282 stars. Pipeline: query preprocessing (extract metadata filters, rephrase) -> Semantic Scholar snippet search + keyword search -> rerank (mxbai-rerank-large-v1) aggregated per paper -> (i) exact QUOTE extraction -> (ii) planning and clustering: outline of section headings and formats, quotes clustered to headings -> (iii) section generation from assigned quotes; list-format sections get comparison tables.
- Novel for us: quote-first synthesis (every claim in the report is tied to an extracted verbatim quote); outline built FROM evidence clusters, not before it; comparison tables for list sections.

### 1.11 Future-House/paper-qa (PaperQA2)
- Repo: https://github.com/Future-House/paper-qa - Apache-2.0, Python, last push 2026-09-25, 9,269 stars.
- Tools the agent calls in any order: paper search (LLM-generated keyword query), gather evidence (embed, top-k chunks, per-chunk scored summary in context of the query = RCS, LLM re-score), generate answer. Metadata includes citation counts with a retraction check.
- Bundled settings: `fast`, `high_quality` (`evidence_k` = 15, ToolSelector agent), `wikicrow`, `contracrow` ("find contradictions in papers, your query should be a claim"), `debug`.
- Novel for us: named quality presets = modes; a dedicated contradiction mode that takes a CLAIM as input (exactly a counterevidence lane); retraction checks as a source-quality gate.

### 1.12 nickscamara/open-deep-research
- Repo: https://github.com/nickscamara/open-deep-research - license NOASSERTION per GitHub API, TypeScript, last commit 2025-05-07, 6,292 stars. Next.js app on Vercel Postgres/Blob/NextAuth with Firecrawl search+extract.
- Nothing novel beyond Firecrawl extract; it is a hosted web app template. Anti-fit for a no-server plugin.

### 1.13 onyx-dot-app/onyx
- Repo: https://github.com/onyx-dot-app/onyx - GitHub license NOASSERTION; LICENSE file: MIT outside `ee/` directories, Onyx Enterprise License inside them. Python, last push 2026-09-29, 32,277 stars.
- A self-hosted enterprise search/chat platform with "Deep Research: in depth reports with a multi-step research flow" and 50+ connectors. A platform, not a component. Anti-fit (server infra).

## 2. Cross-project synthesis

1. Everyone separates PLAN from EXECUTE. The plan artifact is a brief (ODR), a set of research questions (gpt-researcher), perspectives + outline (STORM), a gaps queue (Jina), or outline-with-evidence-ids (WebWeaver/ScholarQA).
2. Quick vs deep is always a small set of budget knobs, not two systems: breadth/depth (dzhng, gpt-researcher), max iterations/concurrency (ODR), named presets (PaperQA2 fast/high_quality, LDR quick/detailed/report), paradigm switch (Tongyi ReAct vs Heavy).
3. Stop logic falls into three kinds: fixed budget (dzhng, gpt-researcher), judged completion with caps (ODR ResearchComplete + hard limits, Jina evaluator + beast mode), and training (Tongyi, WebThinker). Only the first two are usable here.
4. Citation quality ranges from a flat URL list (dzhng) to claim-level quote grounding (ScholarQA, PaperQA2, WebWeaver). The claim-level end is the only one compatible with MindrianOS hash-anchored evidence cards.
5. HITL plan review exists (gpt-researcher multi_agents, ODR legacy, Co-STORM steering) but is optional everywhere. In MindrianOS it is mandatory for egress (Part 8), which none of these projects model: all of them let the LLM freely compose and send queries.
6. Every project that is a full system brings its own LLM provider keys, server (LangGraph server, FastAPI, Next.js) or Python runtime. None is a library that plugs into Claude Code's own subagent runtime without adding a second model and a second research stack.

## 3. Gray area answer

| Option | Pros | Cons | Complexity | Recommendation |
|--------|------|------|------------|----------------|
| A. Study and re-implement natively (patterns, prompts and open data borrowed under MIT/Apache with attribution; no runtime dependency) | Planner lives on top of existing research-corpus / research-cache / audit-query / resolveFanoutCap / validate-lane seams, runtime is Claude Code subagents (already proven in Phase 361), every generated query still passes the Part 8 egress guard and approval policy, evidence stays hash-anchored and claim-level, CJS-only, no hosted service, satisfies Canon Part 7 (no second stack) | We own the control-flow and prompt tuning, no borrowed benchmark score carries over, must build our own eval fixtures (SEED-097 already requires them) | New planner module (plan schema + mode knobs + stop rules) plus one command/agent surface and a counterevidence lane; touches research-corpus, dominant-designs-style gate, filing selector -- Risk: prompt quality and stop rules need tuning; iteration must not let follow-up queries bypass audit-query | Rec (decisive): this is the path |
| B. Wrap one as a sidecar via its MCP server (gptr-mcp or ldr-mcp) or Claude Skill | Fastest path to a working "deep research" button, mature projects (gpt-researcher and LDR both actively maintained), quick/detailed tiers already exist in LDR | Needs a Python server plus its own LLM keys (a second model egress path), the sidecar's LLM composes and sends queries itself so the approved-exact-string contract and Part 8 guard are bypassed, returns a report not hash-anchored claim rows, duplicates research-corpus/cache (violates Part 7), no room/perspective awareness, one more install surface on CLI/Desktop/Cowork | New external runtime + MCP config + an adapter to turn reports into evidence rows -- Risk: Canon Part 8 egress breach, install drift across three surfaces, upstream churn (ODR already archived) | Not recommended; acceptable only as an offline benchmark baseline, never in the product path |

Hybrid note (folded into A, not a separate option): the only "components" worth adopting are license-compatible ARTIFACTS, not code: prompt structures (ODR scaling rules and citation rules, ScholarQA quote-extraction and clustering prompts, Jina evaluator types), and OPEN DATA (DOAJ and the Stop Predatory Journals list that LDR uses, OpenAlex fields already in our adapter). Jev as a passage filter is already reachable through Theo (SEED-097 V6); gpt-researcher's BM25 fallback shows a no-key local fallback is enough when Jev is unavailable.

Rationale: MindrianOS already owns every heavy part of a deep-research agent - the fan-out runtime (Claude Code subagents, proven by Phase 361 lanes), the retrievers (research-corpus / OpenAlex), the cache, the filing gate and the Part 8 egress guard - and is missing only the planner, which in every surveyed project is prompts plus a few hundred lines of control flow (dzhng does it in under 500 LoC). Wrapping any of them would import a second LLM, a Python server and, critically, an agent that composes and sends its own queries, which breaks the approved-query egress contract that no OSS project models; so learn the patterns, re-implement natively, and borrow only license-compatible prompts and open data with attribution.

## 4. Pattern ledger

| # | Pattern | Project(s) | What it does | MindrianOS mapping |
|---|---------|-----------|--------------|--------------------|
| 1 | Clarify, then write a research brief | ODR (`clarify_with_user`, `write_research_brief`), dzhng follow-up questions | Turns a vague ask into one explicit brief before any search | Planner emits a Plan object (question, perspective/lens, sources, query family, sequence, mode) filed to `research/`; clarify step skippable in quick mode. New seam: `research-plan` module. |
| 2 | Plan review gate with a revision cap | gpt-researcher `plan_review.py` (`max_plan_revisions` 3), ODR legacy HITL | Human accepts or revises the plan; bounded loop | Deep run: gate_render card on the Plan (reuse the Phase 361 edit/drop-lane card + `audit-query` re-check on every edit), cap revisions. Quick run: standing audited policy (SEED-097 decision 1). |
| 3 | Mode = budget knobs, not two systems | dzhng breadth/depth, gpt-researcher `DEEP_RESEARCH_*`, PaperQA2 `fast`/`high_quality`, LDR quick/detailed/report | Same pipeline, different caps | Quick = 1 lane, depth 0, 1 corpus, no iteration. Deep = N lanes (clamped by `resolveFanoutCap`), depth >= 1, counterevidence lane on. Knobs live in the Plan so the navigator can see and edit them. |
| 4 | Scaling rules for fan-out | ODR supervisor prompt | 1 sub-agent for simple fact-finding; one per compared element | Planner sizes lanes by question shape and by perspective (Whitespace: one lane per synonym family; comparison: one per element). |
| 5 | Learnings + follow-ups recursion with breadth halving | dzhng (`newBreadth = ceil(breadth/2)`), gpt-researcher deep | Each round returns compact learnings and new questions; next round narrower | Deep iteration: lane agents return claim rows + follow-up questions; next round's queries are composed from them BUT each passes `audit-query` and the approval policy (anti-pattern 1). |
| 6 | Gaps queue + action masking | Jina node-DeepResearch | Open sub-questions queued and deduplicated; actions that stopped yielding new info are disabled | Deep run keeps an open-question queue as graph `open_question` nodes (whitespace_scan already reads them); a lane that returns no new sources is not re-dispatched. |
| 7 | Typed stop evaluators + explicit completion signal | Jina (`definitive`, `freshness`, `plurality`, `completeness`), ODR `ResearchComplete` + hard limits (stop at 3+ relevant sources, stop after 5 failed searches) | Stop when the answer passes named checks, or at a hard cap | Per-perspective stop checks tied to SEED-097 falsifiers, e.g. Whitespace needs `plurality` (synonyms searched) before declaring a gap absent from literature. |
| 8 | Honest forced synthesis at budget end | Jina "Beast Mode" | When budget is spent, answer with what exists instead of silently stopping | Deep run ends with a report that lists unresolved questions and "insufficient evidence" states explicitly (addresses the false-success watch). |
| 9 | Perspective-guided questioning | STORM | Perspectives, not a generic prompt, generate the questions | MOS-CANVAS perspectives (RS, HSI, Whitespace, Analogies, Eureka, Roadmapping) and hats are the perspectives; planner generates questions per lens. Reuse persona/think-hats. |
| 10 | Moderator mines unused evidence; human can steer mid-run | Co-STORM | Next question comes from retrieved-but-unused material; human injects to redirect | Between deep rounds, surface a "retrieved but not yet used" digest and offer one steer card. `rs-mind-map.cjs` can hold the shared map. |
| 11 | Evolving report as the only carried memory | Tongyi IterResearch / Heavy mode | Each round rebuilds a small workspace: question + current report; dead ends dropped | Each deep round's subagent gets only the Plan + current run report + its lane; fits Claude Code subagent context isolation and keeps cost bounded. |
| 12 | Quote-first, outline-from-evidence synthesis | ScholarQA (quote extraction -> cluster to outline -> section write), WebWeaver (outline cites memory-bank IDs; section-by-section retrieval) | Every report claim traces to a verbatim quote; each section only sees its own evidence | Evidence rows = verbatim quote + source id + content hash (research-cache already hashes). Synthesis cites row hashes; a post-check verifies every cited hash exists. This IS the hash-anchored card contract. |
| 13 | Dedicated contradiction mode that takes a claim | PaperQA2 `contracrow`, OpenScholar self-feedback + post-hoc attribution | Searches specifically for evidence against a claim | Deep mode always runs a counterevidence lane per key claim; results recorded via `claim_verify` (rung 3 database/document, rung 4 primary source). |
| 14 | Usefulness-based passage filter with a free local fallback | gpt-researcher (Jev default, BM25 fallback) | Keep only passages that help answer the question | Jev via Theo (SEED-097 V6) where policy allows; local BM25 fallback in CJS so quick mode works with no key. |
| 15 | Source quality from open data | LDR Journal Quality System (OpenAlex, DOAJ, Stop Predatory Journals), PaperQA2 citation counts + retraction check | Down-rank predatory or retracted sources | Extend `rs-corpus-quality-gate.cjs` / OpenAlex adapter with venue reputation and retraction flags (confirm field availability at plan time); vendor CC0/MIT lists with attribution. |
| 16 | Checkpointed, resumable stages | STORM (`do_research`/`do_generate_outline`... load prior results when False), LDR research history | Each stage persists; reruns skip done stages | Run ledger in `research/` per SEED-097 (query approval/hash, result IDs/hashes, stage status); `research-cache` gives free reuse. |

## 5. Anti-patterns - what not to copy

1. LLM-composed queries sent straight to the web. Every surveyed agent lets its model write and fire queries, including recursive follow-ups. In MindrianOS every generated query, including iteration follow-ups, must pass `audit-query` / Part 8 guard and the run's approval policy.
2. Bringing a second model and server. gpt-researcher (FastAPI + React), ODR (LangGraph server), LDR (Python + SearXNG + Ollama), nickscamara (Next.js + Vercel Postgres), Onyx (platform). All violate no-hosted-service and add a second model egress.
3. One ever-growing context. IterResearch's critique ("context suffocation and noise contamination") applies to a naive Claude Code loop too; carry the evolving report, not the transcript.
4. The long report as the product. Jina explicitly rejects it; for MindrianOS the product is evidence cards and claim rows filed to sections, with the report optional and derived.
5. Flat source lists (dzhng `## Sources` of visited URLs). Not auditable; claim-level provenance only.
6. Volume as quality ("aggregate over 20 sources"). Use typed stop checks and source quality, not counts.
7. Pure fixed-budget stopping with no judgment, or judgment with no cap. Use both: typed checks plus hard limits.
8. Unbounded plan revision or silent budget stops (gpt-researcher caps revisions for a reason; Jina's beast mode refuses to stop silently).
9. Importing benchmark claims as acceptance. ODR's Deep Research Bench rank, smolagents' GAIA 55%, and gpt-researcher's Jev benchmark measure general QA/report tasks, not PWS strategic research. SEED-097's own fixtures and rubric are the acceptance.
10. Training-based methods (Tongyi RL, WebThinker, OpenScholar trained models). Take the inference paradigms only.
11. Depending on a frozen repo. ODR is archived; STORM has not been pushed since 2025-09-30.
12. Code-as-action (smolagents CodeAgent) - needs a sandbox, not appropriate for a plugin.
