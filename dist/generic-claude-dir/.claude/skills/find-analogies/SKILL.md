---
name: find-analogies
description: Find cross-domain analogies with SAPPhIRE + TRIZ
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Find cross-domain analogies from 1,427 methodology embeddings."
body_shape: D (Comparison Matrix)
hitl_shape: "F.8"
hitl_why: "Cross-domain analogies are returned as an unordered set of candidates to pick from in any order."
serves_jtbd: ["connect-domains"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Step 1-2 flow: the abstracted functional pattern previews the
# SAPPhIRE/TRIZ candidate structure before the navigator invests in the
# gated External Mode fetch).
interactive_first_reward: schema_preview
teaching: "When the answer might live in another field, /mos:find-analogies runs SAPPhIRE and TRIZ against your problem to surface cross-domain matches. Most breakthroughs are borrowed structure."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Four Lenses of Innovation"]
produces: "room/**/analogies/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
# Phase 265 ledger T-265-105 (data/subagent-dispatch-grants.json carries a reviewed "pending"
# row for commands/find-analogies.md, reviewed_date 2026-08-27; ratification to "granted" is
# plan 265-23's single-write job, not this one). Task is added here as a pre-approval because
# --external's Step 4 fans out one subagent per navigator-APPROVED audited query, strictly
# after the AskUserQuestion approval card; allowed-tools is a pre-approval list, not a
# restriction list (frontmatter contract), so this removes the per-spawn permission prompt
# rather than granting a capability the command did not already have. Scoped to the invoking
# turn; clears on the next message.
allowed-tools: Read Write Glob Bash mcp__mindrian-brain__brain_query mcp__mindrian-brain__read_neo4j_cypher mcp__mindrian-brain__brain_search mcp__tavily__tavily-search AskUserQuestion Task
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: cross-domain-analogy
  framework: "Four Lenses of Innovation"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 1
  filing: fileEvidenceWithReadback
  plan_gated: false
  # Phase 265-13 Task 3 discovery (surfaced by the new declaration-truth
  # tripwire's WEB_SCOPE arm, not the Task 2 fetchCorpus-only sweep):
  # External Mode's own body names mcp__tavily__tavily-search (also in
  # allowed-tools) with a WebSearch fallback, gated by the Part-8 egress
  # composer + a navigator-approval AskUserQuestion before any fetch. This is
  # the same declaration-versus-reality defect Task 2 corrected for futures.
  web_scope: green
  surface: F.1
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:find-analogies

You are Larry. This command runs a compressed version of the Design-by-Analogy pipeline -- quick decomposition, abstraction, and cross-domain search in a single pass. For the full 5-stage pipeline with provenance, use `/mos:pipeline analogy`.

**Modes:**
- `/mos:find-analogies` -- LLM reasoning generates analogies (Tier 0, always available)
- `/mos:find-analogies --brain` -- Brain-enriched cross-domain search (Tier 2)
- `/mos:find-analogies --external` -- Full external research via Tavily (AskNature, patents, academic)
- `/mos:find-analogies --brain --external` -- All sources combined

## UI Format

- **Body Shape:** D -- Comparison Matrix (analogy candidates side by side)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- room name + "Analogy Discovery"
- **Zone 2:** Content Body -- Decomposition summary, then ranked analogies in comparison format
- **Zone 3:** Intelligence Strip -- structural fitness scores, analogy distances, TRIZ mapping
- **Zone 4:** Action Footer -- next steps (explore, transfer, full pipeline)

## Step 1: Check for Room

Check if a `room/` directory exists in the current workspace.

If no `room/` directory, use the 3-line error format:

```
x No project found
  Why: No room/ directory in workspace
  Fix: /mos:new-project
```

Then STOP.

## Step 2: Read Room Context

Read `room/STATE.md` for venture stage, problem type, and section fill levels.

If the user provided a specific problem or domain with the command (e.g., `/mos:find-analogies drug delivery`), use that as the focal point.

If no argument, identify the core challenge from room state -- look at problem-definition entries, existing contradictions, and the venture's primary domain.

## Step 3: Quick Decomposition (Compressed Stage 1-2)

Without running the full pipeline stages, perform a rapid extraction:

1. **Function**: What does the venture's core system DO? (domain-independent verb + object)
2. **Contradiction**: Where does improving one dimension worsen another?
3. **Functional Keywords**: 3-5 abstract search terms

Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/sapphire-encoding.md` for SAPPhIRE reference (if the file exists -- Tier 0 proceeds without it).

Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/triz-principles.md` for TRIZ parameter mapping (if the file exists -- Tier 0 proceeds without it).

Display the decomposition:

```
[DECOMPOSE] Quick Extraction

  Function: [domain-independent description]
  Contradiction: Improving [X] worsens [Y]
  TRIZ Parameters: [N] vs [M]
  Keywords: [keyword1], [keyword2], [keyword3]
```

## Step 4: Search (Mode-Dependent)

### Default Mode (Tier 0 -- LLM Reasoning)

Generate 3-5 cross-domain analogies from your training knowledge. For each:
- Source domain and specific system/mechanism
- How the structural mapping works
- Analogy distance (near/far/cross-domain)
- What principle could transfer

Prioritize FAR and CROSS-DOMAIN analogies -- near-domain analogies are obvious and less valuable.

**Honesty rule (no fabricated fitness).** Tier 0 WITHOUT the engine (Step 4.5) labels each candidate with a QUALITATIVE band word only -- Surface, Behavioral, Structural, or Deep (per `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/sapphire-encoding.md`, the structural-fitness table) -- followed by the sentence "fitness not computed - qualitative label only". It NEVER prints a numeric fitness it did not measure. The decorative decimal is retired: a band word is an honest floor, a fabricated number is a lie (the fusion-router never-fabricate rule).

### Brain Mode (`--brain`)

In addition to Tier 0, query Brain MCP:

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/brain/query-patterns.md` for `brain_cross_domain` and `brain_search_semantic` patterns

2. Run `brain_analogy_search` to find frameworks from different domains addressing the same problem type:
```cypher
MATCH (f1:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WHERE f1.category = $source_category
WITH pt, collect(f1) AS source_frameworks
MATCH (f2:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt)
WHERE NOT f2.category = $source_category
AND NOT f2 IN source_frameworks
OPTIONAL MATCH (f2)-[:CO_OCCURS]->(bridge:Framework)
WHERE bridge IN source_frameworks
RETURN f2.name, f2.category, f2.description, pt.name, bridge.name
ORDER BY bridge IS NOT NULL DESC
LIMIT 15
```

3. Run `brain_search_semantic` with the abstract function description as query text

4. Merge Brain results with LLM candidates, deduplicate, rank by structural fitness

### External Mode (`--external`)

**This section covers `--external` only; the other three modes are unchanged.** Default Tier 0
is one comparative reasoning act over the whole candidate set at once (prioritizing FAR and
CROSS-DOMAIN analogies requires seeing every candidate together, not a loop), and `--brain` is
two cheap queries -- neither has a per-item loop worth fanning out. `--external` is the one
mode with a real per-item loop: the composer emits N audited query strings, and each one needs
its own fetch plus a full structural extraction.

The online leg is FENCED: every outbound query is composed and audited by the shipped Part-8 egress composer, and NOTHING is fetched until the navigator approves (MCP-stack-awareness HARD RULE: ask before web research).

#### PHASE 0 (SEQUENTIAL, orchestrator, NON-NEGOTIABLE -- unchanged by the fan-out below)

1. **Compose (never hand-write a query).** Write ONLY the abstracted pattern vocabulary from Step 3 -- `{functionalKeywords, trizPrinciples, abstractFunction}` -- to `room/<section>/analogies/<slug>-pattern.json`, then run via Bash:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/analogy-fitness-report.cjs" compose-queries room/<section>/analogies/<slug>-pattern.json
   ```

   The composer is the ONLY source of outbound query strings. Never hand-compose a query, and never send one it did not return.

2. **Local-only degrade is honest.** If the envelope is `{ok:false, degrade:'local-only', ...}` (empty pattern, or a query tripped the egress audit), state the local-only fallback plainly and SKIP all fetching. There is no send-anyway path.

3. **Ask the navigator before any fetch.** If `{ok:true}`, fire an AskUserQuestion card asking the navigator to approve the web pass, showing the query count (`audited`) and the families. Do not fetch until they approve.

**No agent is dispatched before the navigator approves the web pass.** The fan-out in PHASE 1
below changes what happens AFTER approval; it changes nothing before it -- the two rules above
stay exactly as written, and the AskUserQuestion approval card always renders before any
`[ANALOGIES] Dispatching` status block.

#### PHASE 1 (PARALLEL fan-out, one agent per APPROVED audited query)

Clamp the fan through `lib/core/futures/orchestrator.cjs`'s `resolveFanoutCap`
(`FUTURES_FANOUT_CAP`, default 5). N is naturally small -- the composer's `audited` count is
typically a handful of query families -- so the speedup ceiling here is modest; this fan-out is
scoped narrowly for exactly that reason, not because the mechanism is any different from the
other Phase 265 fan-outs.

Dispatch with the Agent tool, `subagent_type: analogy-query-fetcher` (the explicit type
string, resolving to `agents/analogy-query-fetcher.md`). Do not pass any manual
background-execution parameter -- Claude Code runs spawned subagents in the background by
default under fork mode, the interactive default since 2.1.232. The platform caps concurrent
subagents at 20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); a handful of query agents stays well
under that cap, but the 20 ceiling is the standing rule so a future author does not reintroduce
an unbounded fan-out.

Print a status block on approval, before dispatching:

```
[ANALOGIES] Dispatching N query agents

  Approved queries: {audited count}
  Families: {family list}
```

**EACH SUBAGENT'S CONTRACT (one audited query), hard constraint first because it is the one
that could sink this implementation:**

- **THE AGENT RECEIVES EXACTLY ONE AUDITED QUERY STRING, VERBATIM, AND IS FORBIDDEN FROM
  COMPOSING, REPHRASING, EXPANDING, OR SUPPLEMENTING IT.** The agent prompt quotes the
  command's own rule: "The composer is the ONLY source of outbound query strings." An agent
  handed a topic and told to "search for analogies" would silently reinvent query composition
  and blow the Canon Part 8 egress fence -- passing the audited string through verbatim, and
  saying so in the dispatch prompt, is the entire mitigation.
- Also input: the abstract function description and the SAPPhIRE field schema.
- **Work:** fetch via `mcp__tavily__tavily-search`, falling back to `WebSearch` WITH THE
  IDENTICAL STRING on a Tavily error -- never re-compose. Then per result extract
  `{title, url, source_domain, sapphire{7 fields}, distance_class}`.
- **Returns:** the candidate array. Filed LOCALLY only. No agent writes to Brain: SIGNAL to
  LOCAL is yes, LOCAL to Brain is no. `agents/analogy-query-fetcher.md` carries no Brain tool
  and no `Write` tool, so this constraint is structurally enforced, not just stated.

#### PHASE 2 (SEQUENTIAL merge, orchestrator only)

1. **DEDUP ON MECHANISM IDENTITY, NOT ON URL.** This is the highest dedup risk of the Phase 265
   fan-outs. Query families are deliberately overlapping angles on the SAME abstract function,
   so a biomimicry query, a patent query, and an academic query all returning the same
   well-known mechanism is the EXPECTED case, not the edge case. Two candidates are the SAME
   mechanism when their SAPPhIRE `phenomenon` and `real_effect` fields describe the same
   physical or structural effect, even across different `source_domain` values and different
   URLs. Merge them into one candidate carrying every source URL as provenance. Getting this
   wrong inflates a popular mechanism's presence and corrupts the ranking: counting one
   mechanism three times is not the same as three mechanisms each appearing once.
2. **RUN THE FITNESS ENGINE ONCE** over the merged, deduped candidate set via Step 4.5's
   `node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/analogy-fitness-report.cjs" score <fitness-input.json>` -- NEVER per agent.
   Fitness is a comparative ranking ACROSS candidates, so five agents each scoring their own
   subset would produce five incomparable scales.
3. Apply the existing restatement rule verbatim: a restatement can never sit at Rank 1.
4. Render the provenance line exactly from `provenance.model` and `provenance.dim`, and
   preserve the degrade honesty rule: if the engine degrades, fall back to the qualitative band
   words with "fitness not computed - qualitative label only" and never a fabricated number.

**FLAG THE DEDUP RISK IN THE COMMAND ITSELF.** This is the highest dedup risk of the Phase 265
fan-outs; mechanism-identity dedup (step 1 above) is the specific mitigation. If the merged
candidate count ever equals the raw returned candidate count across multiple runs, that is a
signal the dedup is not firing and should be investigated, not celebrated.

**SIGNAL flows LOCAL only.** The merged, deduped result is filed LOCALLY only (to
`room/<section>/analogies/`), never to Brain. External web content is SIGNAL (public data) per
Canon Part 8: SIGNAL -> LOCAL is YES, LOCAL -> BRAIN is NO. No user-specific bytes are ever sent
outbound; only the audited abstracted pattern strings cross the wire.

**The alternative on record.** `/mos:pipeline analogy` is the full 5-stage version of this
compressed pipeline and is where a heavier fan-out would more naturally live; this plan
deliberately does the narrow version here.

For each fetched result, extract source title + URL, source domain, structural mapping to the venture, and analogy-distance classification.

## Step 4.5: Measured Fitness (the engine)

When the SAPPhIRE encodings are available (Tier 0 extracts them per `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/sapphire-encoding.md`), MEASURE the fitness instead of narrating it.

1. Write `{source, candidates}` with full SAPPhIRE encodings -- each candidate carries `{id, domain, text, sapphire:{state_change, action, parts, phenomenon, input, real_effect, effect}, source_tier, source_date?}` -- to `room/<section>/analogies/<slug>-fitness-input.json`.

2. Run the engine via Bash:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/analogy-fitness-report.cjs" score room/<section>/analogies/<slug>-fitness-input.json
   ```

3. Use the returned `rows` (rank, band, fused, restatementFlag) and `provenance` to render Step 5. The numbers are MEASURED; never hand-compute a decimal.

4. **Degrade honestly.** If the runner prints `{degrade:'qualitative-only', reason}` (the local encoder is unavailable), fall back to the Step-4 qualitative band labels with the "fitness not computed - qualitative label only" note. A missing engine means honest words, never a fake number.

## Step 5: Display Results

Format as comparison matrix (Body Shape D). When Step 4.5 ran, render the MEASURED columns straight from the runner rows; when it degraded, render the Band column with the qualitative word and leave Text/Fused blank.

```
[ANALOGIES] Cross-Domain Discovery

  Venture Function: [abstract description]
  Contradiction: [improving] vs [worsening]

  Rank | Source Domain | Mechanism        | Distance     | Text  | Band       | Fused | Source
  -----|---------------|------------------|--------------|-------|------------|-------|-------
  1    | [domain]      | [what transfers] | cross-domain | [txt] | Structural | [f]   | [tier]
  2    | [domain]      | [what transfers] | far          | [txt] | Behavioral | [f]   | [tier]
```

Under the matrix, print the provenance line exactly (values from the runner's `provenance`):

```
fitness measured by <provenance.model> (<provenance.dim>-dim)
```

The command text itself names NO model -- the model identity comes only from the runner output.

**Restatement rule.** A row the runner flagged `restatementFlag:true` renders a `[restatement]` marker and is ordered by the runner's band-first ranking. A restatement can never sit at Rank 1: a paraphrase reads alike but shares no structure, so band-first ordering keeps it below every genuine structural or deep transfer.

For the top 2 analogies, provide a brief structural mapping:
- What elements in the source map to what in the venture
- What principle transfers
- What does NOT transfer (known limitations)

## Step 6: Suggest Next Steps

Based on results:

1. **Strong analogy found (fitness > 0.6):** "This looks promising. Want to run the full pipeline (`/mos:pipeline analogy`) to build correspondence tables and stress-test the mapping?"

2. **Multiple candidates:** "I found [N] candidates across [domains]. Pick one to explore deeper with `/mos:pipeline analogy`, or I can `/mos:structure-argument` to build the transfer case."

3. **Weak results:** "The direct analogies are weak. Try `/mos:explore-domains` to map adjacent territories, or `/mos:find-connections` to discover unexpected bridges in the Brain graph."

4. **TRIZ principles found:** "Your contradiction maps to TRIZ Principles [N, M]. These are well-studied resolution patterns -- want me to explain them?"

### Write-back offer (human-gated, temporal-aware)

When the navigator has VALIDATED an analogy, offer to record it -- never write it directly:

1. Build the proposal with `toRefineProposal` semantics: `kind: analogy_transfer`, `valid_at` set from the source's date when the analogy cites a dated real-world source (else `null`).
2. Preview it through `graph-refine-loop` with `dryRun` left at its default TRUE. The navigator confirms before any write (Part 9 chokepoint -- never a direct db write).
3. The before/after room delta rides temporal `queryAsOf`; a later-refuted analogy is SUPERSEDED, never overwritten (Phase 160 temporal spine, SEED-049 D11 -- zero new temporal infrastructure).

Then seed `lib/brain/chain-recommender.cjs` `recommendFrameworkChain` with the Type-3 result lean (SEED-049 D9). The four suggestion bullets above stay as Larry prose; the chain-recommender lean is the machine-readable handoff, not a fixed next step.

## Voice

Larry at his most creative and cross-pollinating:
> "Your problem isn't unique -- it's structurally identical to how [source domain] handles [analogous challenge]. The solution? [transferred principle]."
> "You're stuck because you're thinking in [domain] terms. But functionally, what you're doing is [abstract function]. And that problem was solved beautifully by [source]."
> "The best ideas don't come from your industry. They come from domains that already solved your problem under a different name."

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Full output with comparison matrix, TRIZ details, structural mappings; runs `scripts/analogy-fitness-report.cjs` for measured fitness + provenance |
| **Desktop** | Conversational: Larry describes top 2-3 analogies with storytelling, offers to go deeper; when Bash is unavailable he falls back to the qualitative band words, never a fabricated number |
| **Cowork** | Writes analogy report to room/competitive-analysis/ for team review, tags with pipeline provenance |
