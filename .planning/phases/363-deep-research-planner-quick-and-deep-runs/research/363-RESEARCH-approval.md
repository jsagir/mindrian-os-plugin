# Phase 363 - gray area: plan review and approval (deep plan gate + quick-run policy)

Researcher: gsd-advisor-researcher, 2026-09-29. Read-only; no repo file edited.

## 1. What the outside world does (sourced)

| System | Before-run human step | Plan shown and editable? | Budget knobs | Source |
|---|---|---|---|---|
| langchain-ai/open_deep_research (current) | `clarify_with_user` node: may end the run with one clarifying question; toggled by `allow_clarification`. Not a LangGraph `interrupt()`. | No plan approval. Flow is clarify -> research brief -> supervisor fan-out. | `max_researcher_iterations`, `max_concurrent_research_units`, `max_react_tool_calls` | raw.githubusercontent.com/langchain-ai/open_deep_research/main/src/open_deep_research/deep_researcher.py |
| open_deep_research legacy graph (plan-and-execute) | `human_feedback` node uses `interrupt()` and shows the report plan (sections). `True` = approve and start section writing; a string = feedback appended, plan regenerated. | Yes, sections; edited by natural-language feedback -> regenerate loop. | per-section search iterations | .../src/legacy/graph.py |
| gpt-researcher multi_agents | `include_human_feedback` in task.json; the Human agent asks "this plan of topics to research? {layout}" after the Editor plans the outline. Reply "no" = accept; any other text = feedback to replan. | Yes, section layout; feedback by text. Off by default in the doc example. | `max_sections`; core config `MAX_ITERATIONS`, `MAX_SUBTOPICS` (default 3 each) | docs.gptr.dev/docs/gpt-researcher/multi_agents/langgraph ; multi_agents/agents/human.py ; docs.gptr.dev config page |
| dzhng/deep-research | Generates follow-up clarifying questions, folds answers into the query. User sets breadth (default 4) and depth (default 2). | No plan approval; runs immediately after answers. | breadth, depth | raw.githubusercontent.com/dzhng/deep-research/main/src/run.ts |
| STORM / Co-STORM | STORM: no outline approval (research -> outline -> article -> polish). Co-STORM: the human steers mid-run by injecting utterances (`step(user_utterance=...)`) or observes; shared dynamic mind map. | Steering, not pre-approval. | - | github.com/stanford-oval/storm |
| LearningCircuit local-deep-research | Mode choice up front: `quick_research` (fast summary), `detailed_research`, `generate_report`; raw `search` per engine. | No documented plan approval. Quick vs deep is a named mode, not an approval tier. | strategy, iterations, questions per iteration | github.com/LearningCircuit/local-deep-research |
| Google Gemini Deep Research (app + API) | Generates a research plan; user clicks "Edit plan" (natural-language changes) or "Start research". API "collaborative planning: review, guide and refine the research plan ... before it begins execution". | Yes, plan editable in natural language before start. | daily request limits | blog.google tips-how-to-use-deep-research ; blog.google next-generation-gemini-deep-research ; workspace.google.com blog |
| OpenAI ChatGPT deep research | May ask clarifying questions and propose a research plan; user reviews/edits before it begins; user picks which sources it may use; can interrupt mid-run to refocus or change sources. | Yes, plan + source selection. | - | help.openai.com/en/articles/10500283-deep-research-in-chatgpt |
| LangChain HumanInTheLoopMiddleware (the mechanism, not a research agent) | `interrupt_on` per tool: `False` = auto-approve, `True` = interrupt, or `allowed_decisions` subset of approve / edit / reject / respond. | Edit = change tool args before execution. | - | docs.langchain.com/oss/python/langchain/human-in-the-loop |

### What we learn

1. The field has converged on plan-then-approve for the heavy mode: both large commercial products (Gemini, ChatGPT) and the plan-and-execute open-source designs (legacy open_deep_research, gpt-researcher with feedback on) show a plan and let the human edit it before any fetch.
2. Nobody approves every query string. The unit of approval is the plan (sections / sub-questions / sources), and queries are generated inside it. MindrianOS is stricter than all of them because of Canon Part 8: our unit must be the audited query string (or a family the audit can check), not only prose sub-questions.
3. Edit is mostly natural language -> regenerate, not field-by-field editing. dominant-designs Step 3 already does this the MindrianOS way: an edit goes back through `audit-query` before the card re-renders.
4. Quick modes (local-deep-research quick_research, dzhng with low depth) run with no plan gate at all. The standing-policy idea maps to LangChain's per-tool `interrupt_on: False`: pre-authorize a narrow tool/argument class, interrupt on everything else.
5. Mid-run steering (Co-STORM, ChatGPT interrupt) is a real pattern; for us it becomes a budget re-ask, not free steering, because every new query must re-pass audit.
6. Budget knobs everywhere are the same three: breadth (parallel units / sub-questions), depth (iterations), per-unit tool-call cap. These are what the plan card should expose.

## 2. What the repo already has (precedents)

- `agents/analogy-query-fetcher.md`, `agents/dominant-design-researcher.md`: fetch ONE approved LITERAL string, never compose/rephrase/expand; exempt from hitl_shape (pure worker, returns data). Keep unchanged.
- `commands/dominant-designs.md` Step 3: gate card lists lanes with the exact composed query; options Run / Edit or drop / no web; edits re-audited; approved set written to `gate.json`; `validate-lane --approved` discards rows on `query_mismatch`. Line 81: unattended runs take the quick pass; research only from a navigator answer. hitl_shape F.1.
- `commands/find-analogies.md` --external: composer -> audit -> AskUserQuestion approve web pass -> fan-out; `local-only` degrade has no send-anyway path. hitl_shape F.8.
- `agents/research.md`: `plan_gated: true`, `web_scope: green`, hitl_shape F.8.
- SEED-097 line 47-50 and 339-341: first discuss decision; "any standing policy must still bind provider, scope, query family and audit record"; "do not make the room wait for a human turn on every query".
- SEED-097 line 240-243: approval covers provider, filters, query expansions, fallback providers and pagination budget actually executed; a changed request must be covered or re-approved.
- SEED-097 line 564-578: run state `evidence request -> AUDITED -> APPROVAL_PENDING -> APPROVED -> FETCHING`; no external-corpus adapter callable before APPROVED; approval binds to the exact query hash.
- `lib/core/chain-executor.cjs`: halts at first material step; resume only via gate_answer (single-use gate id).
- 355.1 CONTEXT: ambient child, throttle 1 run per room per hour, disclosed floors in `data/floor-ledger.json`, one human checkpoint approving floors before wiring live. This is the house precedent for "approve a standing rule once, then run ambiently".
- HITL vocabulary (docs/HITL-SHAPE-DECLARATION-CONTRACT.md): F.0 Mini Decision Gate, F.3 Depth Budget, F.4 Harvest Scope, F.6 Plan Review, F.8 Unordered Basket; Form B `hitl_stages` for multi-stage surfaces.

## 3. Recommendation

One approval object, two lifetimes. The thing a human approves is a **research grant**: provider allowlist + corpus scope + query families (composer template ids) + budget + fallback rule. The audit record ties every executed query hash to the grant that covered it. This satisfies SEED-097's "approval binds to the exact query hash" without a human turn per string: the hash is bound to a grant, and the grant was approved by a human.

- **Deep run - run-scoped grant, approved on an F.6 Plan Review card before anything is fetched.**
  Card shows: the governing question and its decomposition (sub-questions, each tagged with lens and pattern); per sub-question the exact audited query strings for round one; sources/corpora per sub-question (OpenAlex, arXiv, PubMed, web via Tavily) and fallback; budget (breadth = sub-questions, depth = max iteration rounds, max queries per round, max results per query); counterevidence pass on/off; where results return (originating card/section).
  Editable: drop/add/reword a sub-question (reworded text recomposes and re-audits before re-render, dominant-designs Step 3 pattern), toggle a source, change budget within disclosed caps. Not editable: raw query strings typed by hand that skip the composer (typed text goes through composer+audit or is refused, find-analogies no send-anyway rule).
  Iteration: follow-up queries the composer generates from results may run without re-asking only if they fall inside an approved family, an approved provider, and remaining budget. Anything outside -> halt with an F.3 Depth Budget card (extend depth / stop and synthesize) showing the new audited strings.
  Deep never starts unattended (dominant-designs line 81 rule).
- **Quick run - standing grant (policy), approved once on an F.0 card, then runs ambiently.**
  Policy binds: provider(s) and one fallback; corpus scope (e.g. OpenAlex works only); allowed query families (composer template ids with typed slots, never free text); per-run caps (queries, results, pages) and a rate throttle (355.1-style per room per hour, value disclosed in the floor ledger); room scope; policy version and expiry; revocation.
  Audit record per executed query: policy id + version; query string and hash; composer template id; Part 8 audit verdict; provider, filters, pagination actually used; fallback used or not; timestamp; originating card/node id; result ids and content hashes; empty vs provider-failure distinction.
  Must re-ask (fall back to exact-string F.0 or promote to F.6) when: query not from an allowed family; provider or fallback not in policy; budget or throttle exceeded; audit trips or degrades; policy expired or version changed; first run in a room; the run wants to become multi-step (promotion to deep); the room has no grant at all.
- **Filing stays gated** in both modes (existing F.8 filing basket / F.0 per finding). A grant authorizes fetching, never filing.
- **Composition:** planner emits the plan + grant -> `gate_render` (F.6 or F.0) -> in `chain_run`, the fetch step is material and halts; `gate_answer` approve writes the grant and resumes the fan-out in the same call. Fetch agents unchanged: they get LITERAL strings plus the grant id; a `validate --approved` step (existing `query_mismatch` check) now checks each executed hash against either the per-run approved set or the standing grant. No new fetcher, scheduler or approval flow (SEED-097 V2).
- **HITL declaration for the planner surface (Form B):**
  ```yaml
  hitl_stages:
    - { stage: "deep plan review", shapes: ["F.6"], mode: "gate" }
    - { stage: "deep extend budget", shapes: ["F.3"], mode: "gate" }
    - { stage: "quick policy grant", shapes: ["F.0"], mode: "gate" }
    - { stage: "filing", shapes: ["F.8"], mode: "parallel" }
  ```
  Fetch worker agents stay `none`/exempt as today.

## 4. Risks to flag for the navigator

- MCP-stack-awareness HARD RULE says ask before web research. The standing grant IS that ask, made once and scoped; the navigator should rule that this satisfies the rule, or quick runs stay per-query.
- Query families only work if the composer is template-based with typed slots. Where the composer produces free-form strings (some rs-* paths), those strings cannot be policy-covered and must use per-query approval.
- Scope creep: a grant that is too wide (web, any family) is per-query approval in name only; start with the SEED-097 proving slice (OpenAlex only, whitespace-gap family).
- No numbers here are measured; budget defaults and throttle values must come from the floor ledger at plan time.

## Sources
- https://raw.githubusercontent.com/langchain-ai/open_deep_research/main/src/open_deep_research/deep_researcher.py
- https://raw.githubusercontent.com/langchain-ai/open_deep_research/main/src/legacy/graph.py
- https://docs.gptr.dev/docs/gpt-researcher/multi_agents/langgraph
- https://raw.githubusercontent.com/assafelovic/gpt-researcher/master/multi_agents/agents/human.py
- https://docs.gptr.dev/docs/gpt-researcher/gptr/config
- https://raw.githubusercontent.com/dzhng/deep-research/main/src/run.ts
- https://github.com/stanford-oval/storm
- https://github.com/LearningCircuit/local-deep-research
- https://blog.google/products-and-platforms/products/gemini/tips-how-to-use-deep-research
- https://blog.google/innovation-and-ai/models-and-research/gemini-models/next-generation-gemini-deep-research
- https://workspace.google.com/blog/ai-and-machine-learning/meet-deep-research-your-new-ai-research-assistant
- https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt
- https://docs.langchain.com/oss/python/langchain/human-in-the-loop
