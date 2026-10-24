---
name: rs-experts
description: Find authors linked to topic-matching papers in the local room
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Find authors connected to a documented knowledge gap in your room's research papers."
body_shape: D (Comparison Matrix)
layer: "loop"
hitl_shape: "F.8"
hitl_why: "A synthetic expert panel is generated as an independent set consulted in any order."
serves_jtbd: ["find-bottleneck", "connect-domains"]
interactive_first_reward: instant_brief
teaching: "When a documented gap may connect to people named in your research papers, /mos:rs-experts searches the selected room's local paper corpus and shows source-linked authors. It does not verify their current expertise or availability."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-experts/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read AskUserQuestion
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # Author/Paper/Institution nodes are LOCAL-only (populated by /mos:rs-fetch).
  # The remote Brain must never be called from this command.
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: reverse-salient-experts
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 4
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

# /mos:rs-experts

You are Larry. This command finds authors linked to papers already stored in the selected MindrianOS room. It searches local paper titles and abstracts for literal topic terms, then lists linked authors and institutions. It does not query Aura, Brain, or an external expert directory, and a publication match does not establish current expertise or availability.

**Synopsis:**

    /mos:rs-experts <topic>
    /mos:rs-experts <topic> --json
    /mos:rs-experts <topic> --limit 20

## What it does

1. Validates `<topic>` against Canon Part 8 (`auditQueryString`) before using it.
2. Opens the CLI room (`MINDRIAN_ROOM`, or the current directory) read-only, or resolves the bound/operator-pinned room for MCP.
3. Matches topic terms against local `Paper.title` and `Paper.abstract` fields when present. It follows local `AUTHORED_BY` and `AFFILIATED_WITH` edges and ranks by matched-paper count.
4. Returns paper IDs and titles, matched terms, and explicit partial-result metadata when limits omit records.

## UI Format

- **Body Shape:** D (Comparison Matrix) -- local paper matches and linked authors
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- topic + author count
- **Zone 2:** Content Body -- matched-paper counts with source paper IDs and titles
- **Zone 3:** Intelligence Strip -- matched terms and partial-result disclosure
- **Zone 4:** Action Footer -- next-step verbs (`/mos:persona` may be warranted; `/mos:rs-fetch` for fresh papers)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with local matched-paper counts.
- **Desktop MCP / Cowork:** use `rs_experts_find` with a bound session and topic; it returns typed local-only results and accepts no room path.
- **CLI:** `node scripts/rs-experts-command.cjs "<topic>" [--limit N] [--json]` reads `MINDRIAN_ROOM` or the current directory.

## Local corpus boundary

Expert lookup is **LOCAL-only from the selected room's `room.db`**. Author names and institution affiliations are user artifacts (Canon Part 8: people/paper data is LOCAL and NEVER egresses to Brain). The CLI and MCP reader never contact remote Brain, Aura, or a directory provider.

Degradation is clean by construction:

- An empty local match is a successful empty result, not a transport failure.
- If the room has no readable Paper/Author graph, the tool returns an explicit store-unavailable result.
- If scan/output limits or malformed records omit data, the result is explicitly marked partial.

## Canon References

- **Canon Part 7 (Reuse Before Build):** CLI and MCP use the same local search helper and the navigation-owned read-only database door.
- **Canon Part 8 (Graph Boundary):** topic terms are matched only against the selected room's stored paper records. They are never sent to Brain, Aura, a directory, or an external provider.

## Examples

    /mos:rs-experts "quantum brain imaging"
    /mos:rs-experts "fintech KYC" --json
    /mos:rs-experts "carbon capture" --limit 50

## Error patterns

Local records unavailable, 3-line format:

    x Local research records unavailable
      Why: the selected room has no readable Paper/Author graph
      Fix: set MINDRIAN_ROOM to a room containing room.db, then retry

A topic with genuinely zero matches is NOT an error pattern. It renders as an empty local result and may suggest `/mos:rs-fetch` for an approved corpus refresh.

    x Canon Part 8 audit failed
      Why: forbidden bytes in topic argument (ExternalEgressViolation)
      Fix: rephrase the topic without user-content placeholders

## Voice

Larry direct:

> "Found <N> authors linked to topic-matching papers already in this room. This does not confirm current expertise or availability."

> "No stored papers in this room matched those topic terms. /mos:rs-fetch can gather approved papers for a later local search."
