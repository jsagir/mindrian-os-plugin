---
name: rs-thesis
description: Read the thesis for a prior Reverse Salient discovery
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Compose the thesis statement from your reverse salient findings."
body_shape: E (Action Report)
hitl_shape: "F.9"
hitl_why: "The reverse-salient thesis is assembled through ordered stages, a fixed-order walk."
serves_jtbd: ["find-bottleneck"]
teaching: "When you ran a Reverse Salient discovery earlier and want the thesis read back, /mos:rs-thesis surfaces the analytic conclusion in plain language. Best for revisiting old findings before a meeting."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-thesis/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read AskUserQuestion
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # RSDiscovery is USER DATA (Canon Part 8 -- LOCAL -> BRAIN: NO). The remote
  # Brain must never be called from this command. Always uses Tier 0 SQLite.
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
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

You are Larry. This command looks up the thesis text for a prior `RSDiscovery` by `discovery_id`. The lookup is tier-aware: it queries Aura first (Tier 1) when an Aura driver or env var is configured, and falls back to the local SQLite mirror (Tier 0) on `AuraUnreachableError`.

**Synopsis:**

    /mos:rs-thesis <discovery_id>
    /mos:rs-thesis <discovery_id> --json
    /mos:rs-thesis <discovery_id> --tier tier0

## What it does

1. Validates `<discovery_id>` against Canon Part 8 (`auditQueryString` on the bound parameter; throws `ExternalEgressViolation` if forbidden bytes appear).
2. Detects tier from `opts.tier`, `opts.driver`, `opts.aura_url`, or `process.env.NEO4J_URI`.
3. Tier 1 path: runs an Aura Cypher MATCH on `(rs:RSDiscovery {id: $discovery_id})` with parameterized `$discovery_id`. Returns the `thesis` field plus `breakthrough_score`, `rs_type`, `created_at` metadata.
4. Tier 0 path (or fallback on `AuraUnreachableError`): runs a SQLite `SELECT * FROM rs_discoveries WHERE id = ?` against the local `room.db`. Emits a `DEGRADED_NOTE` marker indicating Tier 0 mode.
5. Emits Phase Gate-style transcript on success (CLI) or JSON (`--json` for Desktop MCP / Cowork).

## UI Format

- **Body Shape:** E (Action Report) -- one-line lookup status + thesis body + metadata table
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- discovery_id + tier
- **Zone 2:** Content Body -- thesis text plus a 4-row metadata table (rs_type, breakthrough_score, room_slug, created_at)
- **Zone 3:** Intelligence Strip -- DEGRADED_NOTE on Tier 0 fallback only
- **Zone 4:** Action Footer -- next-step verbs (Bank Opportunity, Devil's Advocate, Synthesize)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with thesis body and metadata table.
- **Desktop MCP:** structured JSON via `--json`; MCP wrapper renders Larry's narration with the thesis as a quote.
- **Cowork:** honors `MINDRIAN_ROOM` env var; the lookup runs against the active room's local SQLite mirror in shared `00_Context/`.

## Tier-0 LOCAL-only base (Canon Part 8, D-200-2 (b) unchanged half)

The thesis and its `RSDiscovery` / Author / Paper / Institution neighborhood are **LOCAL-only** user artifacts. Tier-0 resolution reads them straight from `room.db` with NO Brain call and NO Brain key (Canon Part 8: people/paper data is LOCAL and NEVER egresses). The frontmatter carries no `mcp__mindrian-brain__*` tool, so a missing Brain key changes nothing:

- Brain key ABSENT -> Tier-0 SQLite read is authoritative (the writer is idempotent). No throw.
- Aura reachable -> Tier 1 Cypher MATCH on the local mirror.
- Aura unreachable -> Tier-0 SQLite fallback with a `DEGRADED_NOTE` marker.

This is the unchanged half of navigator decision D-200-2 (b): the local-only Tier-0 stays the base; the Brain never holds a discovery's bytes.

## Canon References

- **Canon Part 7 (Reuse Before Build):** consumes existing `lazygraph-ops.cjs` for SQLite reads and existing `brain-client.cjs` (Aura session) for Tier 1. Zero forks.
- **Canon Part 8 (Graph Boundary):** the `discovery_id` parameter is parameterized in both backends (NO string concatenation). Audited via `auditQueryString` BEFORE binding. The thesis is a LOCAL artifact; this command never queries Brain.

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
      Why: no row matched discovery_id <id> in either Aura (Tier 1) or SQLite (Tier 0)
      Fix: /mos:rs-fetch <topic>

    x Aura unreachable; Tier 0 used
      Why: AuraUnreachableError caught; falling back to SQLite mirror
      Fix: not actionable; Tier 0 read succeeded with DEGRADED_NOTE marker

## Voice

Larry direct:

> "Thesis: <body>. Breakthrough score 8 of 10. Filed 3 days ago. Worth Bank Opportunity?"

> "Aura unreachable. Read from local mirror. Tier 0 result is authoritative because the writer is idempotent."
