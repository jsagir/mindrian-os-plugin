---
description: Show Navigation Engine decision trace for last turn
body_shape: F.1
argument-hint: "[--last N] [--session SESSIONID]"
serves_jtbd: ["audit-room"]
teaching: "When Larry made a recommendation and you want to know why, /mos:explain-decision shows the Navigation Engine trace for the last turn. Every recommendation has a graph path behind it."
disable-model-invocation: true
allowed-tools: Bash(node *)
---

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
node ${CLAUDE_PLUGIN_ROOT}/scripts/explain-decision-command.cjs $ARGUMENTS
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

## Cross-surface adaptation

- **CLI:** full power. Shape of output is plain text suitable for terminal rendering.
- **Desktop:** the same slash command runs when the plugin is connected. Larry may narrate the rendered trace conversationally; the underlying dispatcher is identical.
- **Cowork:** same as CLI. Each collaborator's session has its own trace file; `--session` allows cross-user audit when collaborators share trace files via the room.
