---
name: heal
description: Heal a room's structural drift after plugin upgrade
argument-hint: "[room-dir]"
body_shape: E (Action Report)
body_shape_detail: 10-step heal table mirrors recipe provenance section
serves_jtbd: ["audit-room"]
teaching: "When a plugin upgrade leaves the room with structural drift, /mos:heal repairs the missing ROOM.md, broken backlinks, and stale section state. Use after every major version bump."
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - Write
---

# /mos:heal [room-dir]

You are Larry. This command repairs structural drift in a room after a plugin upgrade. It wraps the v1.11.0 room-wiring heal recipe (10 idempotent steps) and produces a typed `heal-log.json` envelope per Canon Part 4 (every choice is graph data).

The recipe was dog-fooded on the mindrianOS room itself on 2026-04-29. Source-of-truth: `~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md`.

## When to invoke

- After upgrading the plugin across a major version (v1.10.x to v1.11.x)
- When `/mos:status` surfaces `EMPTY -- GAP` on canonical sections that should have ROOMs
- When the on-stop invariant report shows `severity: error` violations
- When `minto-stale.json` shows `artifacts_newer_than_minto` for many sections
- Before generating a power demo, vault export, or first-contact viewer artifact

## Canon traceability

- **Part 7 (Reuse Before Build):** wraps existing `scripts/migrate-lazygraph.cjs` + `scripts/vault-section-state-generator.cjs` + `scripts/vault-section-minto-generator.cjs` + `scripts/compute-state`. Zero net-new methodology.
- **Part 4 (Every Choice Is Graph Data):** writes `<room>/.mindrian/heal-log.json` capturing every section touched + every transition + every result.
- **Part 8 (Graph Boundary):** heal is LOCAL-only. Reads STATE.md / ROOM.md / MINTO.md, runs local graph rebuild, writes local heal-log. Zero Brain queries; brain-derivation-queue is read-only in v1.11.1 (drain deferred to v1.12).

## Step 1: Resolve target room

If the user passed an argument, treat it as the absolute or relative room directory. Otherwise heal the current working directory.

```bash
ROOM_DIR="${1:-$PWD}"
```

If `ROOM_DIR` does not exist on disk, render the 3-line error pattern from `skills/ui-system/SKILL.md` Section 7 and stop.

## Step 2: Run the orchestrator

Invoke the 10-step heal orchestrator. The orchestrator is pure CJS and never throws on per-step failure (every step logs a status; mega-section MINTO writes that exceed FEYNMINTO-01 budget gracefully degrade with `status='blocked_feynminto_01'`).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/heal-command.cjs" "$ROOM_DIR"
```

Optional flags the orchestrator supports:

- `--dry-run` plan only, zero mutation. Useful for previewing what heal would touch.
- `--skip-step <N>` skip step N (1-10) on a re-run.
- `--section <name>` restrict step 7 (MINTO regeneration) to one section.

## Step 3: Read the heal-log envelope

After the orchestrator returns, read `<room>/.mindrian/heal-log.json`. The envelope schema:

```json
{
  "schema_version": "1.0",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "room_dir": "/abs/path",
  "backup_dir": ".heal-backup/<TS>",
  "steps": [
    { "step": "step_01_backup", "status": "ok", "duration_ms": 27, "details": { ... } },
    ...
  ],
  "summary": {
    "ok_count": 0,
    "skipped_count": 0,
    "blocked_count": 0,
    "error_count": 0,
    "exit_code": 0
  }
}
```

## Step 4: Render 4-zone output

Follow `skills/ui-system/SKILL.md` Section 1 strictly. No reordering. No invention.

### Zone 1 -- Header Panel

```
-- {room name} -- heal -- {venture stage from STATE.md frontmatter} --
```

If no STATE.md frontmatter exists yet (heal just bootstrapped the room), use `Pre-Opportunity` as the stage. If `room name` cannot be resolved, fall back to the basename of `$ROOM_DIR`.

### Zone 2 -- Content Body (Shape E: Action Report)

Mirror the recipe's "What this heal touched" provenance table. One row per orchestrator step, with status glyph + per-step details.

```
[heal] action: 10-step room wiring heal
[heal] source: scripts/heal-command.cjs (recipe 2026-04-29)
[heal] backup: .heal-backup/<TS>/

  step                              status        ms     detail
  step_01_backup                    [check]       27ms   N files copied to .heal-backup/<TS>/
  step_02_scaffold_sections         [check]       1ms    M sections created, K already present
  step_03_section_seed              [check]       4ms    P sections seeded
  step_04_lazygraph_rebuild         [check]       226ms  room.db: A artifacts, B sections, C nodes, D edges
  step_05_backfill_room_md          [check]       3ms    Q sections backfilled, R already present
  step_06_section_state             [check]       82ms   S sections with STATE.md
  step_07_section_minto             [warn]        528ms  T sections OK, U blocked_feynminto_01 (mega)
  step_08_queue_check               [check]       0ms    queue depth V, oldest enqueued YYYY-MM-DD
  step_09_root_state                [check]       1020ms STATE.md regenerated, W bytes
  step_10_invariant_scan            [dot]         0ms    no_report_yet (writes on next /mos:* call)

summary: ok=N blocked=M skipped=K error=0 exit_code=0
```

Glyph mapping (per `skills/ui-system/SKILL.md` Section 3):

- `status='ok'` or `status='ok_with_blocked'` -> `[check]` (green)
- `status='skipped'` -> `[dot]` (gray)
- `status` startswith `'blocked_'` -> `[warn]` (yellow)
- `status` startswith `'error_'` -> `[x]` (red)

The status column is a single ASCII glyph; the detail column is a one-line summary extracted from `step.details`.

### Zone 3 -- Intelligence Strip (conditional)

Only render this zone when at least one of the following is true. Maximum 3 lines. Each indented 2 spaces.

- Any step has `status` starting with `'blocked_feynminto_01'`
  -> `[warn] section <name> exceeded FEYNMINTO-01 budget; tier-0 fallback written`
- Any step has `status` starting with `'error_'`
  -> `[x] step <name> errored: <reason>`
- `step_08_queue_check.details.queue_depth > 0`
  -> `[empty-square] brain-derivation queue holds N entries (oldest M days); drain deferred to v1.12`

If none of these conditions fire, omit Zone 3 entirely.

### Zone 4 -- Action Footer (NEVER omit)

Three grounded next-commands. Primary marker `>` on the most relevant line, alternatives marked `>` as well per `skills/ui-system/SKILL.md` Section 1.

```
> /mos:status                review the regenerated STATE.md and per-section state
> /mos:dashboard             open the De Stijl knowledge-graph viewer over the rebuilt room.db
> /mos:scout                 run the next overnight intelligence sweep on the healed room
```

If any step status is `blocked_feynminto_01`, replace the third row with:

```
> /mos:open <section>/MINTO.md   review the tier-0 fallback MINTO; v1.12 will fix the budget
```

## What /mos:heal does NOT do (v1.11.1)

These items are explicitly deferred to v1.12. Do not surprise the user; surface them when relevant.

- **FEYNMINTO-01 budget scaling for mega-sections (BUG-1).** When a section has 40+ artifacts, the rendered source list alone consumes most of the 1500-token budget. v1.11.1 graceful-degrades with tier-0 fallback. v1.12 plan candidate: relax budget OR introduce sub-section hierarchy OR archive-folder pattern. Re-trigger condition: any monitored room with a 40+ artifact section reports inability to regenerate MINTO.
- **brain-derivation-queue auto-drain hook (BUG-2).** The queue is read-only in heal Step 8 (reports depth + age of oldest entry). Drain hook deferred to v1.12. Re-trigger condition: next session-start hook OR /mos:* command-completion hook is being modified for unrelated reasons; bundle the drain hook in.
- **Section auto-creation on plugin upgrade (BUG-5, recipe Open Issue 3).** When the plugin adds a new canonical section across versions, existing rooms do not auto-scaffold the new section directory on first /mos:* invocation. Heal Step 2 covers this for users running heal post-upgrade; the auto-scaffold-on-upgrade behavior remains unimplemented. Re-trigger condition: next plugin version adds a canonical section.

## Voice rules

- Terse, structural, confident. Per `skills/ui-system/SKILL.md` Section 6.
- Never apologize for blocked sections; surface them as a warn glyph in Zone 3 with the v1.12 candidate named.
- One insight per line. Never combine warning + queue depth into a single sentence.
- NO EMOJI. Use only the 12 glyphs from the symbol vocabulary.
- Never re-run heal automatically. The user always confirms before any second invocation.

## Error handling

If the orchestrator exits with code 2 (no-step-success), render the 3-line error pattern:

```
x heal completed with zero successful steps
  Why: every step errored; check .mindrian/heal-log.json for per-step reasons
  Fix: /mos:open .mindrian/heal-log.json
```

If the orchestrator crashes (uncaught exception, exit code != 0 and != 2), render:

```
x heal-command crashed
  Why: <error message tail from stderr>
  Fix: node scripts/heal-command.cjs <room-dir> --dry-run
```

The dry-run path is the safest path to surface what heal would attempt without mutating any room state.

## Provenance

This command was authored as the v1.11.1 GA closing artifact (Phase 94.1-01). The 10-step recipe was dog-fooded on the mindrianOS room itself during the 2026-04-29 wiring audit. Source: `~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md`. The orchestrator (`scripts/heal-command.cjs`) and the fixture suite (`lib/memory/heal-command.test.cjs`) ship under BSL 1.1.
