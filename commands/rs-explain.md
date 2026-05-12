---
name: rs-explain
description: Bidirectional NL-Graph entry point. NL question to graph queries to Larry-voiced explanation.
body_shape: E (Action Report)
serves_jtbd: ["find-bottleneck"]
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-explain/*"
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - mcp__mindrian-brain__brain_query
  - mcp__mindrian-brain__read_neo4j_cypher
---

# /mos:rs-explain

You are Larry. This command is the user-visible bidirectional NL-Graph loop in v1.11.0. The user types a natural-language question. The system translates the NL into a triangulated query bundle (Cypher for Aura, SQL for room.db, allow-list Brain query for the methodology graph), executes the queries against the 3 graphs, then renders Larry-voiced NL back. Raw data becomes insight. The whole loop is local-first and Canon Part 8-defended.

**Synopsis:**

    /mos:rs-explain "<NL question>"
    /mos:rs-explain "<NL question>" --json
    /mos:rs-explain "<NL question>" --tier tier0

## What it does

1. Calls `lib/core/rs-nl-to-query.cjs translate(nl_query, opts)` (Phase 89.5-02). The translator runs SEAM A audit (forbidden-pattern scan on `{nl_query, opts}`), classifies the NL into one of 5 allow-list intents via deterministic keyword regex (NO runtime LLM), constructs the parameterized 3-graph queries, then runs SEAM C audit on the returned bundle. Returns `{cypher, sql, brain_query, sql_params, cypher_params}`.
2. For each non-null query, executes against the appropriate runtime:
   - `sql` runs against `room.db` via `lazygraph-ops.queryGraph(conn, sql, sql_params)`.
   - `cypher` (Aura local) runs via `brainClient` / Aura session when reachable; Tier 0 skips it gracefully.
   - `brain_query` (the methodology graph) runs ONLY when non-null AND `brainClient.isAvailable()` is true; otherwise omitted.
3. Aggregates the rows into `query_results = {kind, rows[], room_context}`.
4. Calls `lib/core/rs-query-to-text.cjs explain(query_results, opts)` (Phase 89.5-03). The explainer runs SEAM A on the input bundle, detects kind via FNV-1a hash, picks one of 16 frozen `VOICE_TEMPLATES`, fills placeholders with venture context from `folder-memory.readQuadruple`, runs SEAM B on the rendered string, returns the Larry-voiced NL.
5. Emits the rendered NL (CLI) or full bundle including raw `query_results` (`--json`).

## UI Format

- **Body Shape:** E (Action Report) -- a single Larry paragraph with optional Mode A "Brain says" enrichment line
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- the NL question (echoed)
- **Zone 2:** Content Body -- the rendered explanation
- **Zone 3:** Intelligence Strip -- query summary (room.db rows, Aura rows, Brain rows; Mode A vs Mode B)
- **Zone 4:** Action Footer -- next-step verbs from the rendered explanation (Bank Opportunity, Run Methodology, Devil's Advocate)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with the rendered NL paragraph and a per-graph-row count strip.
- **Desktop MCP:** structured JSON via `--json` returns `{nl_query, query_bundle, query_results, explanation}` for MCP-aware consumers.
- **Cowork:** honors `MINDRIAN_ROOM`; the explanation surface is multi-user-safe because Mode A only surfaces Brain-derived BRAIN.md content when the room owner has authorized derivation per Phase 90.

## Canon Part 8 guarantee (load-bearing)

`rs-explain` is the hardest Canon Part 8 surface in v1.11.0 because arbitrary user free-form input meets the Brain boundary. The guarantee is enforced at four independent tripwires inside `rs-nl-to-query.cjs`:

| Seam | Location | Catches |
| ---- | -------- | ------- |
| A | translate() entry | forbidden patterns nested in `opts` (e.g. leaked `meeting_transcript`, `decision_log`, `governing_thought`); throws `ExternalEgressViolation` BEFORE buildBrainQueryFromNL runs |
| 1 | buildBrainQueryFromNL entry | forbidden bytes in the raw NL string itself; throws BEFORE intent dispatch |
| 2 | buildBrainQueryFromNL exit | forbidden patterns that snuck through entity-extractor regex; throws BEFORE the constructed Brain query is returned |
| C | translate() exit | last line of defense on the assembled bundle BEFORE the orchestrator sees it |

Plus 4 entity-extractor audits that run `auditQueryString` on every bound scalar before returning. The Brain query is OMITTED (set to `null`) when intent is unrecognized OR the intent has no `brain_template` OR the extractor returned an empty scalar -- the safe default is no Brain RPC at all. User content NEVER reaches the methodology Brain through this path.

`rs-query-to-text.cjs` adds a 2-seam audit (SEAM A on input bundle, SEAM B on rendered output) so even template-substitution leaks are caught BEFORE the user sees the rendered string.

## Examples

    /mos:rs-explain "Show me reverse salients in my fintech room"
    /mos:rs-explain "What frameworks chain into RS Discovery?"
    /mos:rs-explain "Who are the experts on quantum computing?"
    /mos:rs-explain "How many discoveries have I logged this month?" --json

## Error patterns

3-line error format:

    x No NL question provided
      Why: rs-explain requires an NL argument
      Fix: /mos:rs-explain "<NL question>"

    x Canon Part 8 audit failed
      Why: forbidden bytes in NL or opts (ExternalEgressViolation at SEAM A)
      Fix: rephrase the question without user-content placeholders

    x Brain offline; methodology answer unavailable
      Why: this question's intent maps to a Brain-only template; brainClient unreachable
      Fix: /mos:rs-fetch <topic> first; or rephrase to a LOCAL question

## Voice

Larry direct, pedagogical:

> "Found 3 reverse salients across 2 domains. The strongest is <top thesis>. Filed to opportunity-bank/. Worth Bank Opportunity or Devil's Advocate."

> "Brain offline. Searched local + Aura only. <summary>. Worth reframing? /mos:beautiful-question."
