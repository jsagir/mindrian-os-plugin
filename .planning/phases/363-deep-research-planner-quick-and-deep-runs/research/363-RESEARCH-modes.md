# Phase 363 gray area: where to draw the quick vs deep line
Researched 2026-09-29 by gsd-advisor-researcher. Calibration: minimal_decisive. No repo files edited.
Raw source copies: scratchpad/src/ (fetched from GitHub raw, main/master branches, 2026-09-29).

## 1. What the open-source projects actually do (verified in source, not README claims only)

### gpt-researcher (assafelovic/gpt-researcher)
- Report types (gpt_researcher/utils/enum.py): research_report, resource_report, outline_report, custom_report, detailed_report, subtopic_report, deep ("DeepResearch = 'deep'").
  https://github.com/assafelovic/gpt-researcher/blob/master/gpt_researcher/utils/enum.py
- Defaults (gpt_researcher/config/variables/default.py): MAX_ITERATIONS 3, MAX_SUBTOPICS 3, MAX_SEARCH_RESULTS_PER_QUERY 5, TOTAL_WORDS 1200, DEEP_RESEARCH_BREADTH 3, DEEP_RESEARCH_DEPTH 2, DEEP_RESEARCH_CONCURRENCY 4, MCP_STRATEGY "fast" (enum fast/deep/disabled).
  https://github.com/assafelovic/gpt-researcher/blob/master/gpt_researcher/config/variables/default.py
- Docs page says breadth default 4 and recommends total_words 2000; code says 3 and 1200. Docs and code disagree - trust code. Docs claim a deep run "takes around 5 minutes ... costs around $0.4 (o3-mini high)" - vendor claim, not measured here.
  https://github.com/assafelovic/gpt-researcher/blob/master/docs/docs/gpt-researcher/gptr/deep_research.md
- Lesson: quick (research_report) = one plan -> parallel search -> one report. Deep = tree: breadth queries per level, recurse depth levels, concurrency cap. The difference is the recursion, not the topic.

### dzhng/deep-research
- src/run.ts asks: breadth (recommended 2-10, default 4), depth (recommended 1-5, default 2), and "long report or a specific answer? (report/answer, default report)". Follow-up clarifying questions are asked ONLY in report mode.
  https://github.com/dzhng/deep-research/blob/main/src/run.ts
- src/deep-research.ts: each level generates up to `breadth` SERP queries; per query: search limit 5, timeout 15 s; extracts numLearnings=3 and numFollowUpQuestions; recurses with newBreadth = ceil(breadth/2), newDepth = depth-1 until depth 0. ConcurrencyLimit = FIRECRAWL_CONCURRENCY or 2. Two writers: writeFinalReport ("3 or more pages") vs writeFinalAnswer ("usually just a few words or maximum a sentence").
  https://github.com/dzhng/deep-research/blob/main/src/deep-research.ts
- Lesson: output shape is a separate axis from depth (answer vs report). Breadth halves each level - a built-in cost taper. Stopping rule is purely structural (depth counter).

### langchain-ai/open_deep_research
- configuration.py: allow_clarification True; max_concurrent_research_units 5 (min 1, max 20); max_researcher_iterations 6 (min 1, max 10; "number of times the Research Supervisor will reflect on the research and ask follow-up questions"); max_react_tool_calls 10 (min 1, max 30) per researcher step; search_api default tavily; max_content_length 50000.
  https://github.com/langchain-ai/open_deep_research/blob/main/src/open_deep_research/configuration.py
- Lesson: deep = supervisor that decomposes into sub-researchers (units), reflects, and re-dispatches up to an iteration cap; each sub-researcher has its own tool-call cap. Two caps: outer (supervisor reflections) and inner (tool calls per unit).

### jina-ai/node-DeepResearch
- README: "Keep searching, reading webpages, reasoning until an answer is found (or the token budget is exceeded)". Flowchart: CheckBudget -> if exceeded -> Beast Mode -> generate final answer. Actions are disabled when they stop paying: no new unique questions -> disable reflect; no new URLs -> disable search; no new content -> disable visit.
  https://github.com/jina-ai/node-DeepResearch/blob/main/README.md
- src/app.ts getTokenBudgetAndMaxAttempts: reasoning_effort low = 100,000 tokens / 1 bad attempt; medium (default) = 500,000 / 2; high = 1,000,000 / 4. Overridable by budget_tokens and max_attempts.
  https://github.com/jina-ai/node-DeepResearch/blob/main/src/app.ts
- Lesson: budget-based stopping plus a forced "answer with what you have" at exhaustion; saturation signals (nothing new) switch off actions. Effort presets map one word to two numbers.

### STORM / Co-STORM (stanford-oval/storm)
- STORM: two stages, pre-writing (research + outline) then writing (article with citations); perspective-guided question asking plus simulated writer-expert conversation. Runner defaults (knowledge_storm/storm_wiki/engine.py): max_conv_turn 3, max_perspective 3, max_search_queries_per_turn 3, search_top_k 3, retrieve_top_k 3.
  https://github.com/stanford-oval/storm (README) ; https://github.com/stanford-oval/storm/blob/main/knowledge_storm/storm_wiki/engine.py
- Co-STORM: human-in-the-loop discourse (observe or inject utterances), warmstart() then step(...), a live mind map as shared conceptual space. https://arxiv.org/abs/2408.15232
- Lesson: STORM = autonomous deep; Co-STORM = deep where the human steers mid-run. Perspectives are the breadth unit - maps directly onto SEED-097's MOS-CANVAS perspectives / lenses.

### LearningCircuit/local-deep-research
- README modes: Quick Summary ("answers in 30 seconds to 3 minutes with citations"), Detailed Research, Report Generation, Document Analysis. MCP tool table: quick_research 1-5 min, detailed_research 5-15 min, generate_report 10-30 min, search 5-30 s no LLM cost. Default strategy langgraph-agent (agentic, picks engines per query incl. arXiv, PubMed, Semantic Scholar).
  https://github.com/LearningCircuit/local-deep-research/blob/main/README.md
- Lesson: modes named by OUTPUT (summary vs report) and advertised by wall-clock band; quick still carries citations.

### Commercial reference points (descriptive only)
- OpenAI deep research: "may take anywhere from 5 to 30 minutes"; output is a report; runs in background with notification. https://openai.com/index/introducing-deep-research
- Gemini Deep Research: shows a research plan before starting; "Edit plan" lets the user change it in natural language; then Start research. https://blog.google/products-and-platforms/products/gemini/tips-how-to-use-deep-research
- Perplexity: not cited, no primary source pulled.

## 2. Pattern across all of them
| Dimension | Quick (everyone) | Deep (everyone) |
|---|---|---|
| Loop | one plan -> search -> synthesize pass | recursion/iteration (depth levels, supervisor reflections) |
| Breadth | a few queries (3 is the common default: STORM, dzhng numQueries, gptr MAX_SUBTOPICS) | fan-out units with concurrency cap (4-5 default) |
| Stop | fixed pass ends | depth counter (dzhng, gptr), iteration cap (ODR), token budget + forced answer (jina), saturation (jina) |
| Clarify / plan review | none | clarifying questions (ODR, dzhng report mode, OpenAI) or editable plan (Gemini) |
| Output | answer / summary with citations | long report with sources |
| Time band (vendor-stated) | 30 s - 5 min (LDR) | 5-30 min (OpenAI, LDR) |
Nobody in this set runs deep research unprompted. Nobody runs anything ambiently - ambient is MindrianOS-specific (355.1).

## 3. What MindrianOS already has
- commands/dominant-designs.md: "Quick pass or deep dive?" already exists. "Unattended runs take the quick pass" (inside /mos:act, chain_run). BUT its quick pass has NO web research; web research is deep-dive only, behind a query gate card (audit-query, at most 2 approved queries per lane, at most 4 lanes clamped by resolveFanoutCap, Tavily search_depth basic, max_results 10, worst case 8 searches, validate-lane rejects query_mismatch). This is already a deep-run shape: plan -> exact-string approval -> fan-out -> validate -> file after yes.
- commands/research.md: connector reach_id deep_research, plan_gated: true, posture hold, autonomous_safe true; driver is cache-first through research-cache -> fetchCorpus with the Part 8 pre-egress audit inside fetchCorpus; returns top 5 findings with typed research_mode/providers envelope and insufficient_evidence on a cold corpus. Auto-dispatch rule: a calling methodology NEVER auto-fires material research; it ASKS. `--broad` = fixed 3-lens preset of the same pipeline.
- 355.1 ambient: room starts the run itself via the Phase 117 fire child, autonomous_safe; the cadence runner is constitutionally zero-egress; throttle 1 run per room per hour, same delta hash never re-runs, per-room ledger + lock; child runtime measured p50 8.4 s, p90 11.6 s, max 166 s (n=135); only strong/indirect findings surface, once, via SENS-13.
- SEED-097: first discuss decision = per-query exact-string approval vs standing audited policy for ambient runs; cohort must span 2 ICM sections and never egresses; only the approved typed query crosses.

So the tension: 355.1 ambient runs today are zero-egress; /mos:research says never auto-fire material research. An ambient QUICK run with egress is a new permission, not a reuse. It is only defensible if the thing that egresses is exactly what the navigator has already pre-approved as a policy.

## 4. Options (minimal_decisive)
A. Loop-and-trigger line (two modes differ by loop, trigger and output; quick may be ambient under a standing audited policy).
B. One engine, knob-scaled (quick = depth 1 small breadth, deep = depth 2+; both navigator-started; gpt-researcher/dzhng style).
Recommendation: A.

## 5. Proposed shape for A (all numbers are PROPOSED DEFAULTS, precedent cited, to be measured in 363)
QUICK run
- Loop: exactly one pass. No recursion, no reflection. (all projects)
- Breadth: 1 question, <= 3 audited query strings (precedent: STORM max_search_queries_per_turn 3, dzhng numQueries 3), 1 corpus (OpenAlex first per SEED-097).
- Rows: top 5 kept (precedent: /mos:research top-5; gptr MAX_SEARCH_RESULTS_PER_QUERY 5).
- Stop: pass ends; cache-first so a warm cache costs zero egress.
- Output: evidence card - claim rows with source + hash anchor, a one-line answer, and a verdict: settled / thin / contested / gap-confirmed-in-literature. (dzhng "answer" shape, LDR quick summary)
- Trigger: navigator OR ambient. Ambient only when ALL hold: query strings come out of the existing composer + audit-query (no room content, Part 8), the corpus is on a navigator-approved standing policy list, 355.1 throttle/ledger/lock reused (1 per room per hour, same delta hash never re-runs), result lands as proposed (Part 9) and surfaces once through SENS-13. If no standing policy is on file, ambient quick degrades to "plan only": it composes the queries and offers them on a card, nothing egresses.
- Escalation: if verdict is thin or contested, or rows < a floor, the card offers ONE line "run deep on this?" carrying the quick run's plan as the seed of the deep plan. Never auto-escalates.
DEEP run
- Loop: decompose -> fan-out -> reflect -> re-dispatch; mandatory counterevidence pass before synthesis.
- Breadth/depth: lenses/perspectives as units (STORM perspectives, SEED-097 MOS-CANVAS), fan-out cap via resolveFanoutCap (dominant-designs precedent 4), depth 2 with breadth tapering (dzhng ceil(b/2)), reflection cap (ODR default 6 as the upper reference; propose lower, measure).
- Stop: first of: depth/iteration cap hit, saturation (no new sources or no new claims in a round - jina), or budget exhausted -> forced synthesis from what is in hand, with the unfinished branches listed (jina beast mode, made honest).
- Plan: shown and editable BEFORE any egress (Gemini Edit plan; dominant-designs gate card). Exact-string approval of the query set.
- Output: report + evidence ledger (every claim row hash-anchored, supports/contradicts, lanes not run, searched-not-found), filed only after the navigator says yes.
- Trigger: navigator only. Ambient may PROPOSE a deep run (the escalation line) but never start one.
- Surface: Claude Code (Agent fan-out). Desktop/Cowork: honest degrade, as dominant-designs already does.
