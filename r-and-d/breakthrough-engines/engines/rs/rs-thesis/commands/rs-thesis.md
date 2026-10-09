---
name: rs-thesis
description: Read the thesis for a prior Reverse Salient discovery
help_jtbd: "Read back the thesis from a prior reverse salient discovery."
body_shape: E (Action Report)
layer: "loop"
hitl_shape: "F.9"
hitl_why: "The reverse-salient thesis is assembled through ordered stages, a fixed-order walk."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 14): first delivery at commands/rs-thesis.md:55, a lookup of an already-computed thesis by discovery_id, a rendered log rather than fresh analysis.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["find-bottleneck"]
teaching: "When you ran a Reverse Salient discovery earlier and want the thesis read back, /mos:rs-thesis surfaces the analytic conclusion in plain language. Best for revisiting old findings before a meeting."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-thesis/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # RSDiscovery is USER DATA (Canon Part 8 -- LOCAL -> BRAIN: NO). The remote
  # Brain must never be called from this command. Always uses Tier 0 SQLite.
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-02]
  reach_id: context_block
  sub_mode: reverse-salient-thesis
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 5
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

# /mos:rs-thesis

You are Larry. Read back the thesis from a prior `RSDiscovery` by `discovery_id`, and say how well supported it is. A thesis is a template sentence; what makes it worth acting on is the evidence behind it.

**Synopsis:**

    /mos:rs-thesis <discovery_id>
    /mos:rs-thesis <discovery_id> --json
    /mos:rs-thesis <discovery_id> --tier tier0

## Inputs

- `<discovery_id>` (required, a single token). Audited with `auditQueryString` and bound as a parameter, never concatenated.
- `--tier tier0|tier1`: accepted, but only `tier0` exists. `tier1` is served as `tier0` and the output says so.
- `--json`: structured output.
- `MINDRIAN_ROOM` (optional env var): active room.

## Outputs

The thesis text and metadata: `rs_type`, `breakthrough_score`, `room_slug`, `created_at`. If the `rs_discoveries` row has the optional columns `confidence`, `confidence_basis`, `evidence`, `novelty_check_status`, they are shown too; if not, they are absent, never invented. JSON adds `tier`, `tier_note`, and `provenance {source, read_at}`. A thesis with no recorded evidence is labelled "a hypothesis, not a finding".

## What it does

1. Audits `<discovery_id>` (Canon Part 8).
2. Reads `SELECT * FROM rs_discoveries WHERE id = ? LIMIT 1` from the local `room.db` through `lazygraph-ops.queryGraph`. There is no Aura Tier 1 path and no Brain call: RSDiscovery is local user data (BUG 2 fix, 2026-05-22).
3. Prints the transcript or JSON.

## Where a thesis comes from

`rs-thesis-generator.generateThesis` is a deterministic template fill: "By applying X to Y, achieve Z because <mechanism> <bridge concept>." It uses no runtime LLM. On its own the sentence asserts nothing. `generateThesisRecord` wraps it with an evidence trail (extracted sentences with source id, URL and retrieval date), the fallbacks used, second-signal and novelty-check status, and a confidence score from fixed rules: 0.20 for the template alone, plus credit for sourced problem and method sentences, two or more sources, a confirmed second signal and a passed novelty check, minus penalties for a failed novelty check or fallback fields. With no evidence the score is capped at 0.35 ("unsupported"). Labels: under 0.30 unsupported, under 0.50 weak, under 0.75 moderate, otherwise strong.

## UI Format

- **Body Shape:** E (Action Report)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** discovery_id and tier. **Zone 2:** thesis plus metadata table. **Zone 3:** tier note or DEGRADED_NOTE when shown. **Zone 4:** next verbs (Bank Opportunity, Devil's Advocate, Synthesize).

## Surfaces

- **CLI:** transcript. **Desktop MCP:** `--json`; the wrapper quotes the thesis. **Cowork:** reads the active room's local mirror.

## Canon

- **Part 7:** reuses `lazygraph-ops.cjs` for the read; no forks.
- **Part 8:** `discovery_id` is parameterized and audited; the thesis is a LOCAL artifact and this command never queries the Brain.

## Failure behaviour

| Situation | Result |
| --- | --- |
| No id, extra argument, unknown option, bad `--tier` | 3-line error, exit 1 |
| Canon Part 8 violation in the id | 3-line error, exit 1 |
| No row for the id | "Discovery not found", exit 1 |
| `room.db` missing or unreadable | "Local read failed", exit 2 |
| Library cannot be loaded | 3-line error, exit 2 |

## When to stop

Stop after reading the thesis back with its confidence and one next move. Do not rewrite or strengthen the thesis; if the evidence is thin, say what evidence would change that and offer `/mos:rs-fetch` or Devil's Advocate.

## Examples

    /mos:rs-thesis rs_disc_a1b2c3d4
    /mos:rs-thesis rs_disc_a1b2c3d4 --json
    /mos:rs-thesis rs_disc_a1b2c3d4 --tier tier0

## Error patterns

    x No discovery_id provided
      Why: rs-thesis requires a discovery_id argument
      Fix: /mos:rs-thesis <discovery_id>

    x Discovery not found
      Why: no row matched discovery_id <id> in the local room.db
      Fix: /mos:rs-fetch <topic>

    x Local read failed
      Why: room.db could not be opened or queried
      Fix: check the active room (MINDRIAN_ROOM) and run /mos:rs-fetch

## Voice

> "Thesis: <body>. Breakthrough score 8 of 10. No evidence trail recorded, so I would treat this as a hypothesis. Worth Devil's Advocate before Bank Opportunity?"

> "Thesis: <body>. Confidence 0.78, two independent sources, novelty check passed. Filed 3 days ago. Worth Bank Opportunity?"
