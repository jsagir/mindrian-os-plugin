---
name: explain-decision
description: Show Navigation Engine decision trace for last turn
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "See why Larry recommended what he recommended."
body_shape: F.1
hitl_shape: "F.1"
hitl_why: "It explains a decision and offers one next move to take."
argument-hint: "[--last N] [--session SESSIONID]"
serves_jtbd: ["audit-room"]
teaching: "When Larry made a recommendation and you want to know why, /mos:explain-decision shows the Navigation Engine trace for the last turn. Every recommendation has a graph path behind it."
disable-model-invocation: true
allowed-tools: Bash(node *), AskUserQuestion
# --- Phase 172-16 CIRS R1 WIRE (Canon Part 11; navigator-directed 2026-06-23) ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: decision-explain
  framework: null
  posture: hold
  hierarchy_rank: 16
  filing: memory_event_only
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

# /mos:explain-decision

User-facing audit surface for the Navigation Engine. Reads the decision
trace JSON written each turn by the UserPromptSubmit hook (Plan 91-02)
and renders a human-readable explanation of which signals contributed,
which skill fired, what was suppressed, and what was offered.

This is the answer to "Why did Larry do that?"

## Modes

- `/mos:explain-decision` -- render the most recent decision (default).
- `/mos:explain-decision --last 5` -- render the last N decisions in this session.
- `/mos:explain-decision --session SESSIONID` -- render decisions from a specific session (cross-session audit).
- `/mos:explain-decision --last 3 --session SESSIONID` -- combine both flags.

## Output shape

Per-turn block contains:

- Tier Mode (mode_a, mode_b, or tier_0) with a glyph classifier (check / warn / low).
- BRAIN.md signal: version, staleness, stale_reason, weight_applied, sections_consumed.
- RECOMMENDED marker: rendered, highest_confidence (Canon Part 3 Section 6 0.7 floor).
- Five-Signal Triangulation: ICM scope, SQL signals, Feynman-MINTO health, BRAIN patterns, Intent + Persona.
- Chosen rationale (the one-line "why this turn" string the engine emitted).
- Routing source (legacy fallback, engine, or mixed) when Plan 91-03 routing fired.
- Offer rendered (the exact "Offer:" line Larry surfaced) when Plan 91-04 produced one.

## Session resolution

When `--session` is not supplied, the command resolves the active session in this order:

1. `CLAUDE_SESSION_ID` environment variable.
2. `.mindrian/current-session.json` pointer file.
3. Most-recent `.mindrian/decision-traces/*.json` by mtime.

## Graceful fallback

The command never throws. It always exits 0 with one of:

- A rendered trace block (happy path).
- "No decisions recorded for this session." advisory (no trace file yet).
- "Decision trace file could not be parsed." advisory (malformed JSON).
- "No active room found." advisory (registry missing or no active room).

## Canon references

- **Canon Part 3 (Tri-Context Decision Gate, Section 8 trace contract):** every Decision Gate must be explainable. This command IS the audit surface that satisfies that obligation.
- **Canon Part 4 (Every Choice Is Graph Data):** the command READS from the graph-data surface (decision-traces/*.json). It is a pure audit lens; never writes back.
- **Canon Part 8 (Graph Boundary):** zero network surface. Reads only LOCAL `.mindrian/decision-traces/`. No Brain calls, no fetch, no shell-out.

## Invocation

Run the dispatcher via Bash:

```bash
node ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/explain-decision-command.cjs $ARGUMENTS
```

## Examples

```
/mos:explain-decision
/mos:explain-decision --last 3
/mos:explain-decision --session abc123def456
/mos:explain-decision --last 5 --session abc123def456
```

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Always (advisory paths included). The command is a read-only audit surface and never errors. |

## Loop-fires assertion surface (Phase 146)

`/mos:explain-decision` is the loop-fires assertion surface: the per-turn trace
it renders carries the `routing_source` (legacy vs engine), the fired `reach_id`,
and the posture -- the exact signals that prove the loop FIRED on a turn.

The Phase 146 loop-fires gate (the milestone gate that certifies the loop fires
across the full connector surface) is hosted at `doctor --dogfood-acceptance`
(the 5 ACPT dogfood drivers with their own exit-code contract) and at
`tests/run-all-146.sh` (the 5 ACPT drivers plus the re-run of
run-all-144/1441/145 for full-surface certification). Exit 0 there means the
milestone ships as "Larry Reaches". This command does not host the gate; it is
the read-only audit surface for inspecting an individual fired turn.

## Cross-surface adaptation

- **CLI:** full power. Shape of output is plain text suitable for terminal rendering.
- **Desktop:** the same slash command runs when the plugin is connected. Larry may narrate the rendered trace conversationally; the underlying dispatcher is identical.
- **Cowork:** same as CLI. Each collaborator's session has its own trace file; `--session` allows cross-user audit when collaborators share trace files via the room.
