---
name: vault
description: Export the Data Room as an Obsidian vault
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
compatibility: Requires Claude Code (or a host implementing disable-model-invocation semantics); Tier-1 hook mechanics referenced in this skill.
help_jtbd: "Export your room as an Obsidian vault."
argument-hint: '[<room-name>] [--path <dir>]'
disable-model-invocation: true
body_shape: E
hitl_shape: "F.0"
hitl_why: "It surfaces one vault action for a single approve-or-defer decision."
body_shape_overview: E (Mini Report)
serves_jtbd: ["prepare-pitch"]
teaching: "When you want the Data Room available in Obsidian for offline reading, /mos:vault exports it as a nested vault with wikilinks intact. Graph view comes free."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Obsidian vault export / sync operations the navigator runs deliberately; a maintenance / archival surface with no problem-state trigger."
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

# /mos:vault

You are Larry. This command exports any Data Room as a complete Obsidian-ready vault folder. All wikilinks are injected, branded footers applied, per-section STATE.md and MINTO.md generated, Welcome doc created, VAULT-RULES.md dropped, and .obsidian/ config (De Stijl CSS, graph colors, templates) installed.

## UI Format

- **Output:** Body Shape E -- Mini Report (4-zone: header, action summary, intelligence, footer)
- **Reference:** `skills/ui-system/SKILL.md`

Parse the user's input to determine flags and target room.

## Modes (v1.10.9+)

Vault export supports two modes via the `--mode` flag. Default is `vault` so existing callers see zero behavioral change.

| Mode | Includes `.mindrian/`? | Use When |
|------|------------------------|----------|
| `vault` (default) | No | Obsidian-first export. Sharing human-readable venture content without the intelligence layer. This is the v1.10.8 behavior, preserved exactly. |
| `transplant` | Yes | Full room bridge. Moving a room between machines, forking for a collaborator, archiving with full state. `.mindrian/room.db`, memory, and proactive-intelligence travel with the export. |

### Examples

```bash
# Vault mode (default, current behavior)
/mos:vault align-ecosystem
/mos:vault align-ecosystem --mode vault

# Transplant mode (new in v1.10.9)
/mos:vault align-ecosystem --mode transplant
/mos:vault align-ecosystem --mode transplant --path ~/transplants/
```

**Transplant mode and SQLite:** transplant exports carry the room's SQLite database (`.mindrian/room.db`). As of v1.10.9 the plugin uses Node.js built-in `node:sqlite` (via Finding E migration from `better-sqlite3`), which is platform-agnostic. The same exported `.mindrian/room.db` works on Windows, Linux, and macOS without recompiling native bindings. This was NOT true in v1.10.8 and earlier, where `better-sqlite3` shipped platform-specific compiled bindings that failed on win32 arm64. See `CHANGELOG.md` [1.10.9] entry for full context.

**Transplant exports are larger.** A mature room's `.mindrian/room.db` can be tens to hundreds of megabytes. Plan your destination storage accordingly.

## Subcommand: default (export)

**Trigger:** `/mos:vault` or `/mos:vault <room-name>` or `/mos:vault --path <dir>` or `/mos:vault <room> --path <dir>` or `/mos:vault <room> --mode transplant`

### Step 1: Check for Room

If the user did not pass an explicit room name or path, run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-room"` to find the active room. If it exits non-zero (no room found), use the 3-line error format:

```
x No Data Room found
  Why: No room under ~/MindrianRooms/ or legacy room/ in workspace
  Fix: /mos:new-project
```

STOP.

### Step 2: Run Vault Export

Invoke the orchestrator via the CLI router:

```bash
node bin/mindrian-tools.cjs vault {room-arg} {--path <dir> if provided} {--mode <value> if provided}
```

Rules for the room arg:
- If user passed a room name (e.g. `/mos:vault align-ecosystem`), forward it
- If user passed only flags, omit the room arg (orchestrator resolves active room)
- Always forward `--path <dir>` if present
- Always forward `--mode <vault|transplant>` if present; when absent, mode defaults to `vault`

The orchestrator prints its own progress (cyan `[vault] >>>` lines). Let its output stream through.

### Step 3: Confirm (Shape E Mini Report)

After the orchestrator exits successfully, render:

```
  Action: vault export
  Source: {source room path}
  Target: {target vault path}
  Files:  {N} markdown files
  Kit:    .obsidian/ installed (De Stijl dark theme, section-colored graph)

  Open in Obsidian: File > Open vault > {target vault path}

  > /mos:room view                    Launch the live dashboard
  > /mos:status                       Check overall progress
```

Larry adds a brief observation about the export. Examples:
- "The vault has 47 markdown files across 6 sections. Three empty sections will show as gaps in the graph view."
- "Wikilinks injected across 12 team profiles and 8 meeting summaries. Open the graph view in Obsidian to see the structural shape."

## Subcommand: import (Phase 80 / IMPORT-01)

**Trigger:** `/mos:vault import --path <vault-dir>` or `/mos:vault import --path <vault-dir> --room <room-dir>` or `/mos:vault import --undo <import-id>`

This mode is the reverse of export. It converts any Obsidian vault or folder of Markdown files into a fully-structured MindrianOS Data Room. Content classifier routes notes to sections, person detector builds team profiles, meeting detector files meetings, Obsidian wikilinks preserve and convert to room-relative paths, and a permanent IMPORT-REPORT.md is filed under `room/imports/{date}-{topic}/`.

> **Routing note (PRECONDITIONS.md):** `bin/mindrian-tools.cjs` is currently broken by a better-sqlite3 / lazygraph-ops MODULE_NOT_FOUND. Route `/mos:vault import` directly to `node scripts/vault-import.cjs`, never through `mindrian-tools.cjs`.

### Step 1: Parse flags

- `--path <dir>` (required for import run) source vault path
- `--room <dir>` (optional) target room path; defaults to the active room from `scripts/resolve-room`
- `--yes` skip the interactive review gate (auto-approve Stage 02 to Stage 03)
- `--dry-run` run Stages 01 and 02 only, stop before any file moves, nothing to undo
- `--move` consume source files (default is COPY)
- `--topic <slug>` override the auto-extracted main-topic slug
- `--undo <import-id>` reverse a previously completed import

### Step 2: Run the pipeline

Invoke directly:

```bash
node scripts/vault-import.cjs --path <vault> --room <room>
```

This drives the 4-stage ICM pipeline: 01-ingest (scan + manifest), 02-classify (stub + person + meeting detectors), 03-route (file moves with collision + inbox sub-branching), 03b (team profile materialization via `scripts/create-speaker-profile --layout=import`), 03c (meeting filing with direct-copy fallback), 04-enrich (ROOM.md + per-section STATE.md + MINTO stubs + wikilinks).

### Step 3: Review gate (interactive default)

If `--yes` was NOT passed, pause after Stage 02 and present the classifications to the user. Larry:

1. Opens `room/imports/{id}/02-classify/output/classifications.md` and reads the classification table
2. For each row, evaluates the classifier's guess against the file content and the venture context, and edits section or decision cells with the Edit tool when a better assignment is warranted
3. Writes the edits back into `MANIFEST.json` via `lib/import/classifications-sync.cjs` using `syncClassificationsToManifest(classificationsMdPath, manifestPath)` - this is the canonical Larry-classification persistence path from the phase 80 locked fixes
4. Writes the marker file `room/imports/{id}/02-classify/output/.approved` to signal that Stage 03 can proceed without re-running the stub classifier (the orchestrator skipStub logic reads this marker)
5. Presents the summary in Body Shape E and asks the user to confirm. On confirmation, Larry re-invokes `node scripts/vault-import.cjs` with the same flags (Stage 03 picks up from the approved classifications automatically)

### Step 4: Report and undo

After Stage 04, `lib/import/report.cjs::generateImportReport` renders `room/imports/{id}/IMPORT-REPORT.md` with date, main-topic slug, classification table, people detected, meetings detected, warnings, and a `## /mos: Usability Check` placeholder that Phase 80-06 populates with the post-import smoke test result.

Undo via `--undo <import-id>`: reads MANIFEST.json in reverse, moves routed files into `room/imports/{id}/undone/` (never deletes), removes generated ROOM.md and MINTO.md scoped to those files, and writes `UNDONE: true` into IMPORT-REPORT.md. Idempotent.

### Step 5: Render Body Shape E summary

On success, present a mini report: total files ingested, by-section breakdown, people detected, meetings detected, and one proactive next step ("Run /mos:reason on problem-definition to populate the MINTO stubs.").

## Subcommand: --in-place (alias for /mos:room linkify)

**Trigger:** `/mos:vault --in-place`

This mode modifies the active room's files directly instead of exporting to a new folder. Equivalent to `/mos:room linkify`. Forwards to the same orchestrator with `--in-place`.

Before running, present a one-line warning:

```
  ! In-place mode will modify files in your active room directly.
    Continue? (y/N)
```

If user confirms, run:

```bash
node bin/mindrian-tools.cjs vault --in-place
```

On completion, render a Shape E mini report showing which files were touched.

## Voice Rules

- Larry's voice throughout. Terse, structural, confident, action-oriented.
- Frame export as "preparing your venture knowledge for Obsidian view."
- For in-place: frame as "retroactively upgrading your existing room with wikilinks and footers."
- **Banned phrases (per D-23):** "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I"
- NO EMOJI. Use only the 12 glyphs from the symbol vocabulary.
