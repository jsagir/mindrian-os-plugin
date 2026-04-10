# Phase 55: Post-Write Integration + Prediction Registry - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss --auto)

<domain>
## Phase Boundary

Two deliverables: (1) Automatic causal candidate flagging in the post-write hook cascade -- lightweight regex heuristic that produces .causal-candidates.json without blocking. (2) Prediction/opportunity tracking -- /mos:causal predict generates falsifiable predictions with deadlines, stored in REGISTRY.json, typed by opportunity category, with Larry proactive prompts for overdue predictions and confidence propagation from outcomes.

Also includes ENGINE-09: research-backed examples via analogy engine as research orchestrator (Brain/Pinecone for teaching examples + Tavily for recent real-world examples, relevance from causal graph topology).

</domain>

<decisions>
## Implementation Decisions

### Post-Write Hook
- **D-01:** Causal candidate flagging runs AFTER HSI + RS in the post-write cascade, inside the existing background subshell. Async, non-blocking.
- **D-02:** Lightweight regex heuristic flags sentences containing causal keywords (because, causes, leads to, results in, enables, prevents, etc.). Outputs .causal-candidates.json.
- **D-03:** Candidates are NOT auto-committed to KuzuDB. User runs /mos:causal extract to review and confirm.
- **D-04:** Cross-reference step runs after causal claims are confirmed, linking to existing HSI/RS/Analogy edges via the functions from Phase 54.

### Prediction Registry
- **D-05:** REGISTRY.json at room/.predictions/ stores predictions with lifecycle: pending -> confirmed/refuted/expired.
- **D-06:** Predictions typed by opportunity category: business, research, new_business_model, funding, competitive, technical.
- **D-07:** Max 10 active predictions. Archive resolved to room/.predictions/archive/YYYY.json when exceeding 100 entries.
- **D-08:** Larry proactive prompts for overdue predictions via session-start hook (check deadlines, surface oldest unresolved every 5th session).
- **D-09:** Resolved predictions propagate confidence updates back to source CausalClaim nodes -- confirmed predictions boost confidence by 0.1, refuted predictions reduce by 0.2.

### ENGINE-09: Research-Backed Examples
- **D-10:** When an opportunity/prediction is generated, the analogy engine structures a search query from the causal graph topology.
- **D-11:** Two sources: Brain/Pinecone (Pattern 8: brain_search_semantic) for teaching examples + Tavily (mcp__tavily-mcp__tavily-search) for recent real-world examples.
- **D-12:** Results are presented inline, not auto-filed. User decides whether to file as evidence artifacts.

### Claude's Discretion
- Exact regex patterns for causal keyword detection
- REGISTRY.json schema details beyond required fields
- Prediction summary formatting
- Tavily search query construction from causal graph

</decisions>

<canonical_refs>
## Canonical References

### Post-Write Hook
- `scripts/post-write` -- Existing hook cascade (HSI -> RS -> hsi-to-kuzu). Add causal step after.
- `.planning/research/ARCHITECTURE-causal.md` -- Data flow: post-write cascade extension
- `.planning/research/PITFALLS-causal.md` -- Pitfall 4 (two writers), Pitfall 6 (over-extracting)

### Prediction Tracking
- `.planning/research/FEATURES-causal.md` -- Prediction tracking design (Metaculus/PredictionBook patterns)
- `.planning/research/PITFALLS-causal.md` -- Pitfall 3 (confidence miscalibration), Pitfall 8 (REGISTRY.json growth)

### Phase 52-54 Outputs
- `lib/core/lazygraph-ops.cjs` -- createCausalClaim(), crossRefCausalHSI/RS/Analogy(), exportCausalGraph()
- `scripts/causal-to-kuzu.cjs` -- CJS bridge for writing confirmed claims
- `scripts/compute-causal.py` -- NetworkX algorithms for analysis
- `scripts/causal-results-to-kuzu.cjs` -- Results bridge with cross-ref enrichment
- `commands/causal.md` -- Existing /mos:causal command (extract subcommand)

### Brain/Pinecone
- `references/brain/query-patterns.md` -- Pattern 8 (brain_search_semantic) for teaching examples

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/post-write` (127 lines) -- hook cascade pattern with background subshell
- `scripts/compute-hsi.py` -- regex pattern matching reference for causal keyword detection
- `hooks/hooks.json` -- hook registration (no new hooks needed -- extend post-write)

### Integration Points
- `scripts/post-write` -- Add causal flagging step after HSI/RS
- `commands/causal.md` -- Add predict subcommand
- `skills/room-proactive/SKILL.md` -- Add prediction deadline checking
- `hooks/scripts/session-start` -- Add prediction overdue check

</code_context>

<specifics>
## Specific Ideas

- Prediction categories should map to room sections (business -> business-model/, research -> problem-definition/, etc.)
- ENGINE-09 examples should feel like Larry naturally finding references, not a search engine
- Confidence propagation formula: confirmed = min(1.0, current + 0.1), refuted = max(0.0, current - 0.2)
- V2 "Examples" button is the reference UX for ENGINE-09

</specifics>

<deferred>
## Deferred Ideas

- Prediction calibration dashboard (needs 50+ resolved predictions -- v1.8.0+)
- Auto-filing research examples as room artifacts (user controls this)
- Prediction notification via external channels (email, Slack -- out of scope)

</deferred>

---

*Phase: 55-post-write-integration-prediction-registry*
*Context gathered: 2026-04-05 via smart discuss --auto*
