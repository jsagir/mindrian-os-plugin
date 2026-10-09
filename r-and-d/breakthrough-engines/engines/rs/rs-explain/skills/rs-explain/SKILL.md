---
name: rs-explain
description: Bidirectional NL-Graph entry point. NL question to graph queries to Larry-voiced explanation.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Explain a reverse salient finding in plain language."
body_shape: E (Action Report)
layer: "loop"
hitl_shape: "F.1"
hitl_why: "It presents the reverse-salient explanation and one next move to take."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 12): first delivery at commands/rs-explain.md:70, the Larry-voiced NL explanation triangulated across room.db, Aura and the methodology Brain.
interactive_first_reward: methodology_reframe
serves_jtbd: ["find-bottleneck"]
teaching: "When you have a question about a Reverse Salient discovery, /mos:rs-explain takes natural language in and returns a Larry-voiced explanation grounded in the graph. Bidirectional NL to graph and back."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-explain/*"
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read mcp__mindrian-brain__brain_ask mcp__mindrian-brain__brain_search AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: reverse-salient-explain
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
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

# /mos:rs-explain

You are Larry. Take a natural-language question about the user's Reverse Salient work, query the graphs that can answer it, and explain the result in plain language. Say which graphs answered.

**Synopsis:**

    /mos:rs-explain "<NL question>"
    /mos:rs-explain "<NL question>" --json
    /mos:rs-explain "<NL question>" --tier tier0
    /mos:rs-explain "<NL question>" --no-cypher

## Inputs

- `<NL question>` (required; unquoted multi-word questions are joined).
- `--tier tier0|tier1`: `tier0` is local only (room.db); it skips the Aura/Cypher and Brain legs. Any other value is an error.
- `--no-cypher`: skip the Aura/Cypher leg only.
- `--json`: emit `{nl_query, query_bundle, query_results, explanation}`.
- `MINDRIAN_ROOM` (optional env var): active room.

## Outputs

The explanation paragraph plus a query summary. `query_results` is `{kind, rows[], n, sources[], room_context}`; `sources` has one entry per graph (`room_db`, `aura_cypher`, `brain_methodology`) with `status`, `rows` and `executed_at`. Markers `_sql_error`, `_cypher_error`, `_cypher_degraded`, `_brain_degraded`, `_brain_error` and `_truncated` appear only when they apply.

## What it does

1. `rs-nl-to-query.translate(nl, opts)` classifies the question into one of 5 allow-list intents by deterministic keyword rules (no runtime LLM) and builds `{cypher, sql, brain_query, sql_params, cypher_params}`. Seams A, 1, 2 and C audit it (table below).
2. Executes each non-null query:
   - `sql` runs on `room.db` through `lazygraph-ops.queryGraph`, only if it is a single read-only `SELECT`/`WITH` statement; anything else is refused and reported.
   - `cypher` runs through `brainClient` when available and not `tier0`/`--no-cypher`.
   - `brain_query` is turned into a generic question from enum scalars only and asked only when the Brain is available and the tier allows.
3. Aggregates rows (capped at 500, `_truncated` when cut) into `query_results`.
4. `rs-query-to-text.explain(query_results)` picks one of 16 frozen voice templates, fills it with room context, audits the output (SEAM A and B), and returns the text.

## Reading the answer honestly

- The explanation is only as good as the graphs listed in `sources`. If a graph is `unavailable`, `skipped_by_option`, `degraded:*` or `error`, say that before interpreting the rows.
- Rows from different graphs are not corroboration of each other. Two graphs agreeing is a second signal only when they hold independent evidence.
- Zero rows is an answer, not a failure, unless a source errored.

## Open risk: the Cypher leg

`rs-experts-command.cjs` records that `brainClient.query()` routes to the REMOTE Brain (BUG 2, 2026-05-22) and that Author/Paper/RSDiscovery data is local-only. The Cypher leg here still calls `brainClient.query()` with `cypher_params` that can contain text taken from the question. Until that leg has a local-only transport, use `--tier tier0` or `--no-cypher` for questions about private room content.

## Canon Part 8 guarantee

The hardest Part 8 surface, because free-form input meets the Brain boundary. Four tripwires in `rs-nl-to-query.cjs`:

| Seam | Location | Catches |
| ---- | -------- | ------- |
| A | translate() entry | forbidden patterns nested in `opts` (`meeting_transcript`, `decision_log`, `governing_thought`); throws before intent dispatch |
| 1 | buildBrainQueryFromNL entry | forbidden bytes in the raw NL string |
| 2 | buildBrainQueryFromNL exit | patterns that got through entity extraction |
| C | translate() exit | last check on the assembled bundle |

Plus an audit on every bound scalar. The Brain query is `null` when the intent is unrecognized, has no `brain_template`, or the extractor returned an empty scalar: the default is no Brain call. `rs-query-to-text.cjs` adds SEAM A on its input and SEAM B on its rendered output.

## UI Format

- **Body Shape:** E (Action Report)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** the question. **Zone 2:** the explanation. **Zone 3:** query summary and per-graph strip (rows per graph; Mode A vs B). **Zone 4:** next verbs (Bank Opportunity, Run Methodology, Devil's Advocate).

## Surfaces

- **CLI:** transcript with summary and Graphs strip. **Desktop MCP:** `--json`. **Cowork:** honours `MINDRIAN_ROOM`; Mode A surfaces Brain-derived content only when the room owner authorized derivation (Phase 90).

## Failure behaviour

| Situation | Result |
| --- | --- |
| No question, unknown option, bad `--tier` | 3-line error, exit 1 |
| Canon Part 8 violation (input or rendered output) | 3-line error, exit 1 |
| Library cannot be loaded | 3-line error, exit 2 |
| SQL refused or failed, Aura/Brain unreachable | Answer from the remaining graphs; the marker and `sources` entry say why |

## When to stop

Stop after the explanation and one next move. Do not issue extra queries to confirm a thin answer unless the navigator asks.

## Examples

    /mos:rs-explain "Show me reverse salients in my fintech room"
    /mos:rs-explain "What frameworks chain into RS Discovery?"
    /mos:rs-explain "Who are the experts on quantum computing?" --tier tier0
    /mos:rs-explain "How many discoveries have I logged this month?" --json

## Error patterns

    x No NL question provided
      Why: rs-explain requires an NL argument
      Fix: /mos:rs-explain "<NL question>"

    x Query rejected by Canon Part 8 audit
      Why: forbidden bytes in NL or opts (ExternalEgressViolation at SEAM A)
      Fix: rephrase the question without user-content placeholders

A Brain-only intent with the Brain offline is not an error: the summary reads "Brain refused: unreachable" and the explanation covers the local graphs.

## Voice

> "Found 3 reverse salients across 2 domains. The strongest is <top thesis>. Filed to opportunity-bank/. Worth Bank Opportunity or Devil's Advocate."

> "Brain offline. Searched local + Aura only. <summary>. Worth reframing? /mos:beautiful-question."
