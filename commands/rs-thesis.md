---
name: rs-thesis
description: Read the thesis for a prior Reverse Salient discovery
help_jtbd: "Revisit the saved thesis from a prior Reverse Salient discovery."
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

You are Larry. This command reads the thesis for one prior `RSDiscovery` by `discovery_id` from the local room database. Remote Brain and Aura access are disabled for this user data.

**Synopsis:**

    /mos:rs-thesis <discovery_id>
    /mos:rs-thesis <discovery_id> --json
    /mos:rs-thesis <discovery_id> --tier tier0

## What it does

1. Validates `<discovery_id>` against Canon Part 8 (`auditQueryString` on the bound parameter; throws `ExternalEgressViolation` if forbidden bytes appear).
2. The CLI reads `rs_discoveries` from the local room database with a parameterized ID. Only `tier0` is supported; other `--tier` values are refused.
3. The MCP tool `rs_thesis_read` requires a bound or operator-pinned room, opens it through the navigation read-only door, and returns structured thesis and metadata. It has no room-path input and does not use a registry or server fallback.
4. The CLI emits a Phase Gate-style transcript; Larry renders the MCP result for the navigator.

## UI Format

- **Body Shape:** E (Action Report) -- one-line lookup status + thesis body + metadata table
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- discovery_id + local tier
- **Zone 2:** Content Body -- thesis text plus a 4-row metadata table (rs_type, breakthrough_score, room_slug, created_at)
- **Zone 3:** Intelligence Strip -- local-only disclosure
- **Zone 4:** Action Footer -- next-step verbs (Bank Opportunity, Devil's Advocate, Synthesize)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with thesis body and metadata table.
- **Desktop MCP:** call `rs_thesis_read` with `discovery_id`; it reads only the bound or operator-pinned room through a read-only handle. The tool returns structured JSON; Larry renders the thesis and metadata.
- **Cowork:** use `rs_thesis_read`; it resolves the current session's bound room and reads local `room.db` only.

## Tier-0 LOCAL-only base (Canon Part 8, D-200-2 (b) unchanged half)

The thesis and its `RSDiscovery` / Author / Paper / Institution neighborhood are **LOCAL-only** user artifacts. Tier-0 resolution reads them straight from `room.db` with NO Brain call (Canon Part 8: people/paper data is LOCAL and NEVER egresses). The frontmatter carries no `mcp__mindrian-brain__*` tool, so whether Theo is reachable changes nothing:

- The CLI uses the local SQLite mirror and never contacts remote Brain or Aura.
- MCP uses the session-bound or operator-pinned room through a read-only SQLite handle. Unbound and registry-fallback sessions are refused.

This is the unchanged half of navigator decision D-200-2 (b): the local-only Tier-0 stays the base; the Brain never holds a discovery's bytes.

## Canon References

- **Canon Part 7 (Reuse Before Build):** the MCP reader reuses `session-room.cjs` and the navigation-owned read-only database door.
- **Canon Part 8 (Graph Boundary):** the `discovery_id` is audited and parameterized; it is never concatenated into SQL. The thesis is a LOCAL artifact and this command never queries Brain.

## Examples

    /mos:rs-thesis rs_disc_a1b2c3d4
    /mos:rs-thesis rs_disc_a1b2c3d4 --json
    /mos:rs-thesis rs_disc_a1b2c3d4 --tier tier0

## Error patterns

3-line error format:

    x No discovery_id provided
      Why: rs-thesis requires a discovery_id argument
      Fix: /mos:rs-thesis <discovery_id>

    x Discovery not found
      Why: no local row matched discovery_id <id> in the bound room
      Fix: /mos:rs-fetch <topic>

    x Unsupported tier
      Why: only the local SQLite tier is supported
      Fix: use --tier tier0 or omit --tier

## Voice

Larry direct:

> "Thesis: <body>. Breakthrough score 8 of 10. Filed 3 days ago. Worth Bank Opportunity?"

> "This is the saved local thesis for that discovery."
