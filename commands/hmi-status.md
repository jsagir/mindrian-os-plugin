---
name: hmi-status
description: Show the latest HMI compliance poll - operator-aware UI Ruling System drift summary, JTBD-priority-weighted violation list, read-only inspection (recovery via /mos:doctor --ui-compliance --fix)
argument-hint: "[--json]"
body_shape: E (Action Report)
body_shape_detail: 4-zone Shape E rendering of the side-channel at <roomDir>/.mindrian/last-hmi-poll.json (status + counts + top-5 priorities + operator-shape mismatches); --json emits raw envelope; graceful Shape E when poll absent or tier 0
serves_jtbd: ["audit-room"]
locks_operator: null
min_tier: 0
concurrency: sequential
streams_events: false
disable-model-invocation: false
canon_parts: [3, 7, 8]
phase: 105
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
---

# /mos:hmi-status

Read-only inspection surface for the Phase 105 HMI compliance poll. Renders the side-channel at `<roomDir>/.mindrian/last-hmi-poll.json` as a 4-zone Shape E (Action Report) per `skills/ui-system/SKILL.md`. The command NEVER auto-fixes - recovery is surfaced via Zone 4 action footer pointing at `/mos:doctor --ui-compliance --fix`, which the user invokes deliberately (Canon Part 3 - every choice is graph data).

The polling primitive at `scripts/hmi-compliance-poll.cjs` (Phase 105-01) is what writes the side-channel; the Stop hook at `scripts/hmi-compliance-update.cjs` (Phase 105-03) is what fires the poll on every user turn. This command only READS what those write. Per Canon Part 8 the read is purely LOCAL - no Brain queries, no network.

## What it shows

- **Doctor status + violation counts** - aggregated from the latest `node scripts/doctor.cjs --ui-compliance --json` run, broken down per kind (missing-body-shape, unauthorized-box-char, unauthorized-glyph, renderer-missing-zone1, renderer-missing-zone4).
- **Top 5 JTBD-weighted priorities** - violations on commands matched against the active JTBD's `methodology_hooks` are weighted 1.0; non-matches keep base weight 0.3; null JTBD uses uniform 0.5. Shape E rows show the file, weight, and matched JTBD when applicable.
- **Operator-shape mismatches** - commands whose declared `body_shape` does not fall within the family the active operator expects (Phase 99 substrate). Informational only - never auto-rewrites a command file.
- **Provenance footer** - timestamp + elapsed_ms + Mode A/B/0 marker so the navigator knows how fresh the poll is and which operating mode produced it.
- **Zone 4 action footer** - 2-3 grounded /mos: commands. Primary uses `▶`, alternatives use `▷`. The canonical recovery action is `▶ /mos:doctor --ui-compliance --fix`.

## How it works

The command is a pure side-channel reader. It does NOT run the doctor. It does NOT mutate state. It does NOT call the Brain. The execution path is:

1. Resolve the active room from `~/MindrianRooms/.rooms/registry.json` (Phase 83 substrate). If none: graceful Shape E pointing at `/mos:setup`.
2. Read `<roomDir>/.mindrian/last-hmi-poll.json`. If missing: graceful Shape E with `▶ /mos:doctor --ui-compliance` + `▷ node scripts/hmi-compliance-poll.cjs --once` to force a fresh poll.
3. Branch on `envelope.status`:
   - `ok` -> full Shape E with Zone 2 status + priorities + mismatches + Zone 4 recovery action.
   - `tier-0-skip` -> minimal Shape E pointing at `/mos:setup graph` (Brain unreachable AND local graph unusable).
   - `doctor-error` -> Shape E acknowledging the doctor failure + manual retry footer.
   - `no-active-room` -> defensive Shape E (same render as missing side-channel).
4. `--json` short-circuits to `JSON.stringify(envelope, null, 2)` for hooks and regression tests.

The script always exits 0. Read-only commands never block the user turn.

To force a fresh poll (the Stop hook runs once per turn, but you can re-poll on demand):

```bash
node scripts/hmi-compliance-poll.cjs --once
```

To recover from drift after inspecting:

```bash
/mos:doctor --ui-compliance --fix
```

## Step 1: Execute

Run via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/hmi-status-command.cjs" $ARGUMENTS
```

If `CLAUDE_PLUGIN_ROOT` is unset (older Claude Code versions), fall back to:

```bash
node ~/.claude/plugins/mindrian-os/scripts/hmi-status-command.cjs $ARGUMENTS
```

## Step 2: Render the output

The script outputs a 4-zone Shape E. Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

## Examples

### Default show (status: ok with 47 violations)

```
-- mindrianos -- hmi-status -- BUILD_ROOM/find-bottleneck --

  ■ Doctor status: warn (47 violations)
  ■ Counts: 47 missing-body-shape, 0 unauthorized-box-char, 0 unauthorized-glyph

  ■ Top 5 priorities (JTBD-weighted)
     ✓ commands/find-bottlenecks.md  weight 1.0  matched: find-bottleneck via methodology_hooks
     • commands/whitespace.md  weight 0.3
     • commands/explore-domains.md  weight 0.3
     • commands/diagnostics.md  weight 0.3
     • commands/find-analogies.md  weight 0.3

  ■ Operator shape mismatches
     ⚠ commands/foo.md  declared: B  operator BUILD_ROOM expects: E

  (polled 2026-05-01T15:50:47Z, elapsed 187ms, mode B)

  ▶ /mos:doctor --ui-compliance --fix
  ▷ /mos:doctor --ui-compliance --json
  ▷ /mos:hmi-status --json
```

### Default show (status: ok, zero violations)

```
-- mindrianos -- hmi-status -- JUST_TALK/no-jtbd --

  ■ Doctor status: ok (0 violations)

  (polled 2026-05-01T15:50:47Z, elapsed 92ms, mode B)

  ▷ /mos:hmi-status --json
  ▷ /mos:doctor --all
```

### No poll yet

```
-- test-room -- hmi-status -- no-poll-yet --

  ■ No poll has fired yet for this room

  ▶ /mos:doctor --ui-compliance
  ▷ node scripts/hmi-compliance-poll.cjs --once
```

### --json passthrough

```bash
$ /mos:hmi-status --json
{
  "schema_version": 1,
  "status": "ok",
  "polled_at": "2026-05-01T15:50:47.000Z",
  "operator": "BUILD_ROOM",
  "jtbd": "find-bottleneck",
  "tier": 1,
  "mode": "B",
  "doctor": { "status": "warn", "totalViolations": 47, "counts": { ... } },
  "operator_shape_mismatches": [ ... ],
  "priorities": [ ... ],
  "elapsed_ms": 187,
  "_provenance": { "phase": "105-01", "doctor_version": "1.12.3", "skill_ref": "skills/ui-system/SKILL.md" }
}
```

## Voice rules

When Larry surfaces the output conversationally:

- "47 commands missing body_shape. The top one matches your active JTBD - want to fix?"
- "Run /mos:doctor --ui-compliance --fix to auto-recover."
- "The poll is read-only - I never auto-fix without you saying so."

NEVER:
- Run /mos:doctor --ui-compliance --fix without the user asking.
- Re-poll silently when a fresh poll is < 5 minutes old.
- Re-show the example blocks above when speaking conversationally.

## See also

- `/mos:doctor --ui-compliance` - the underlying detector this command reads from.
- `/mos:operator` (Phase 99) - the operator state stratum the priority weighting reads.
- `/mos:jtbd` (Phase 100) - the JTBD state the weighting matches against `methodology_hooks`.
- `skills/ui-system/SKILL.md` - the UI Ruling System spec this command's renderer self-complies with.
- `docs/MINDRIAN-CANON.md` Part 3 - the tri-context Decision Gate. Recovery is user-driven, not auto.
- `docs/MINDRIAN-CANON.md` Part 7 - reuse-before-build. The renderer borrows the 4-zone scaffold from `scripts/doctor.cjs renderHumanReport`.
- `docs/MINDRIAN-CANON.md` Part 8 - graph boundary. Zero Brain queries; pure LOCAL read of side-channel + registry.
