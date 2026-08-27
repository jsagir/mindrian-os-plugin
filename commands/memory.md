---
name: memory
description: Inspect and operate on the three memory layers (within-session, across-session, cross-room).
help_jtbd: "Inspect what the room remembers about your sessions."
argument-hint: "[query <jtbd> | cross-room | resume | park <jtbd> | complete <jtbd> | --opt-out]"
body_shape: E (Action Report)
hitl_shape: "F.8"
hitl_why: "The three memory layers are queried and written as an independent set of operations in any order."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 23): first delivery at commands/memory.md:68, a cross-layer census of in_flight/parked/completed counts, a state readout rather than an analysis.
interactive_first_reward: "--none (diagnostic surface)"
body_shape_detail: 4-zone Shape E for default + park + complete + opt-out; Shape G (Comparison Matrix) for query when Phase 101 ships (Shape E fallback otherwise); Shape G Mode A or Shape E Mode B for cross-room depending on Brain availability; Shape F.6 (or F.1 fallback) for resume picker.
serves_jtbd: ["audit-room"]
teaching: "When you need to inspect what the room remembers, /mos:memory shows the three layers: within-session, across-session, and cross-room. Memory locality is a Canon Part 9 invariant."
locks_operator: null
min_tier: 0
concurrency: sequential
streams_events: false
disable-model-invocation: false
canon_parts: [4, 8]
phase: 103
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: memory-inspect
  posture: hold
  hierarchy_rank: 10
  filing: none
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

# /mos:memory

Inspect or operate on the three Mindrian memory layers per Canon Part 4 (every choice is graph data) and Canon Part 8 (graph boundary). The three layers are the navigator's working memory: within-session (per-room, this conversation), across-session (per-USER aggregate, survives Claude Code restarts), and cross-room (Brain-mediated when reachable, local synthesis when not).

## Layers

- **Within-session** (Phase 100): `<roomDir>/.mindrian/jtbd-state.json`. Per-room, per-session. Holds the active JTBD + recent transitions + classifier evidence. Owned by `lib/hmi/jtbd-state.cjs`. This command READS it but never writes to it.
- **Across-session** (Phase 103-02): `~/MindrianRooms/.memory/jtbd-history.json`. Global per-USER aggregation. Per-room arrays of in_flight / parked / completed JTBDs. Survives Claude Code restarts. Backs the "What was I working on last week?" query.
- **Cross-room** (Phase 103-03): Brain (Mode A) when reachable, plus filesystem scan (Mode B) at all times. Brain holds generic JTBD-graph structure only -- Canon Part 8 boundary preserved. The local synthesis works without Brain.

## Subcommands

The command runs `node $CLAUDE_PLUGIN_ROOT/scripts/memory-command.cjs <subcommand> [args...]` and prints the structured output verbatim. The script is the source of truth; do not paraphrase its output.

| Subcommand | Body shape | What it does |
|------------|-----------|---------------|
| `/mos:memory` | Shape E | Overview: current within-session JTBD + counts of in_flight / parked / completed across all rooms. |
| `/mos:memory query <jtbd>` | Shape G (or E fallback) | Per-JTBD across-room view. Rows = rooms, columns = state. Falls back to Shape E with note when Phase 101 not yet shipped. |
| `/mos:memory cross-room` | Shape G Mode A / E Mode B | Full cross-room landscape. Mode A enriches with Brain pattern hints; Mode B is local synthesis only. |
| `/mos:memory resume` | Shape F.1 (or F.6) | Interactive picker of in_flight JTBDs across rooms. Phase 101 promotes the F.1 picker to F.6 (JTBD-aware) when shipped. |
| `/mos:memory park <jtbd>` | Shape E | Move the named JTBD from in_flight to parked. Manual override of the auto-park heuristic (Phase 103 D-07). |
| `/mos:memory complete <jtbd>` | Shape E | Move the named JTBD to completed. Manual override; usually auto-detected via cascade pipeline (Phase 103 D-08). |
| `/mos:memory --opt-out` | Shape E | Disable across-session memory globally. Writes `~/MindrianRooms/.memory/.opt-out` sentinel. Re-enable by removing it. |

## Step 1: Parse the user's intent

Look at the invocation:

- `/mos:memory` (no args) -> overview Shape E
- `/mos:memory query <jtbd>` -> per-JTBD view
- `/mos:memory cross-room` -> full landscape
- `/mos:memory resume` -> in_flight picker
- `/mos:memory park <jtbd>` -> manual park transition
- `/mos:memory complete <jtbd>` -> manual complete transition
- `/mos:memory --opt-out` -> disable across-session memory

## Step 2: Execute

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/memory-command.cjs" $ARGUMENTS
```

If `CLAUDE_PLUGIN_ROOT` is unset (older Claude Code versions), fall back to:

```bash
node ~/.claude/plugins/mindrian-os/scripts/memory-command.cjs $ARGUMENTS
```

The script does the work:

1. Resolves the active room from `~/MindrianRooms/.rooms/registry.json`.
2. Honors the global opt-out sentinel at `~/MindrianRooms/.memory/.opt-out` (D-16) and the per-room sentinel at `<roomDir>/.mindrian/.memory-opt-out` (D-17).
3. Detects Cowork (`<roomDir>/00_Context/` present) and surfaces a Zone 3 warning per RESEARCH §8 Pitfall 8.
4. Renders a 4-zone Shape E (default), Shape G (query / cross-room Mode A), Shape F.1 / F.6 (resume), or Shape E confirmation (park / complete / opt-out).
5. When Phase 101 selectors are not yet on disk, gracefully degrades: Shape G falls back to Shape E with note; Shape F.6 falls back to Shape F.1.
6. Writes (park / complete) go through `lib/hmi/across-session-memory.cjs` atomic O_EXCL pipeline.

## Step 3: Render the output

The script outputs 4-zone shapes per `skills/ui-system/SKILL.md`. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes. Do not wrap in markdown code fences -- the renderer is the structural surface.

## Privacy contract (Canon Part 8)

Across-session memory is **per-USER**, NOT per-team. In Cowork, each user has their own `~/MindrianRooms/.memory/` scoped to their home directory. Team-shared continuity belongs in STATE.md Decisions section -- not in this layer. The Brain never sees your room contents; cross-room queries carry only generic JTBD identifiers + sha256 hashes + enum scalars (Phase 90 buildBrainQueryContext chokepoint).

To disable across-session memory:
- Globally: `/mos:memory --opt-out` (or `touch ~/MindrianRooms/.memory/.opt-out`).
- Per-room: `touch <roomDir>/.mindrian/.memory-opt-out`.

The script honors both sentinels at every write path. Reads continue to work in opt-out mode (so the Zone 3 warning can render); writes return early with an explicit "(opt-out engaged)" note.

## Examples

### Default overview

```
-- mindrianos -- memory -- overview --

  Within-session: prepare-pitch

  • in_flight  : 2
  • parked     : 1
  • completed  : 4

  ▷ /mos:memory cross-room
  ▷ /mos:memory resume
  ▷ /mos:memory query <jtbd>
```

### Cross-room (Mode B, Brain unreachable)

```
-- mindrianos -- memory -- cross-room --

  ■ prepare-pitch
     ├─ mindrianos (in_flight, 2026-04-30)
     ├─ mindrianos-venture (in_flight, 2026-04-29)
     └─ jhu-pilot (completed, 2026-04-25)

  ⚠ Brain unreachable; cross-room view local-only

  ▷ /mos:memory resume
  ▷ /mos:memory query <jtbd>
```

### Cross-room (Mode A, Brain reachable)

```
-- mindrianos -- memory -- cross-room --

  ■ prepare-pitch
     ├─ mindrianos (in_flight, 2026-04-30)
     └─ mindrianos-venture (in_flight, 2026-04-29)

  Patterns:
    • prepare-pitch → validate-idea (conf 0.71)

  ▷ /mos:memory resume
  ▷ /mos:memory query <jtbd>
```

### Park confirmation

```
-- mindrianos -- memory -- park --

  ✓ prepare-pitch: in_flight → parked

  ▷ /mos:memory
```

## Voice rules

When Larry surfaces the output conversationally:

- "Two jobs in flight across your rooms. `prepare-pitch` is alive in mindrianos and mindrianos-venture; `find-bottleneck` was parked last week."
- "Brain is offline; this is the local-only view. The cross-room patterns block lights up when you reconnect."
- "Want to resume? `/mos:memory resume` lists the picker."

NEVER:
- Apologize for the memory layer surfacing what it surfaces. The state IS the truth.
- Add "I ran the command" framing. The renderer is structural; let it speak.
- Suggest the user park or complete a JTBD they have not asked about. The user decides.

## Cross-references

- **Canon:** `docs/MINDRIAN-CANON.md` Part 4 (every park / complete is a typed graph edge), Part 8 (Brain holds generic methodology only; LOCAL bytes never leave the room).
- **Phase 100** (`/mos:jtbd`): the within-session layer this command extends.
- **Phase 101** (selector library): graceful upgrade path -- Shape G + Shape F.6 light up automatically when the selector library lands.
- **Phase 102** (render-v2): all subcommands flow through the shared 4-zone render contract.
- **Phase 103-05** (memory hooks): SessionStart resume nudge + Stop hook persistence build on this command's surface.

## Zone 4 (Action Footer)

After presenting results, suggest next actions:

> Want to pick up where you left off? -> /mos:memory resume
> Want what other rooms learned? -> /mos:memory cross-room
