---
name: vault
description: Export the Data Room as an Obsidian vault
help_jtbd: "Export your room as an Obsidian vault."
argument-hint: '[<room-name>] [--path <dir>]'
disable-model-invocation: true
body_shape: E
hitl_shape: "F.0"
hitl_why: "It surfaces one vault action for a single approve-or-defer decision."
body_shape_overview: E (Mini Report)
serves_jtbd: ["prepare-pitch"]
teaching: "When you want the Data Room available in Obsidian for offline reading, /mos:vault exports it as a nested vault with wikilinks intact. Graph view comes free."
# Phase 265-21 (docs/reward-before-investment-rule.md, --none scripting override clause):
# vault is a deliberate lifecycle export/import command the navigator runs on purpose (mirrors
# commands/rooms.md, commands/mva-option.md, commands/pws-brain.md's own --none declarations),
# not a conversational entry flow with a first-reward moment to sequence.
interactive_first_reward: --none (scripting only)
ui_reference: skills/ui-system/SKILL.md
# Phase 265 ledger T-265-105 (data/subagent-dispatch-grants.json carries a reviewed "pending"
# row for commands/vault.md, reviewed_date 2026-08-27; ratification to "granted" is plan
# 265-23's single-write job, not this one). Task is added here as a pre-approval because
# import Step 3's threshold-gated review fans out one subagent per guessed-section group once
# the row count clears VAULT_REVIEW_FANOUT_THRESHOLD; allowed-tools is a pre-approval list,
# not a restriction list (frontmatter contract), so this removes the per-spawn permission
# prompt rather than granting a capability the command did not already have. Scoped to the
# invoking turn; clears on the next message.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  - Task
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

### Step 3: Review gate (interactive default, threshold-gated)

If `--yes` was NOT passed, pause after Stage 02 and review the classifications before Stage 03
routes a single file. This review is THRESHOLD-GATED: a small vault reviews in one pass exactly
as before; a large one fans out across a set of section-scoped subagents. Below the threshold,
cross-row consistency (two similar notes landing in the same section) is something one context
gives you for free and independent agents would destroy -- so the single pass stays the default
and the fan-out below is conditional, never automatic.

**THE THRESHOLD.** `VAULT_REVIEW_FANOUT_THRESHOLD` defaults to `40` rows, overridable via the
environment variable of the same name. This number is a judgment call, not a measurement: a
20-note vault is trivial to review in one context, a 300-note vault is not, and 40 is roughly
two sections' worth of notes -- the point where one context stops being able to read every file
body carefully and starts rubber-stamping the classifier's guesses instead of admitting it ran
out of room. `--dry-run` (Stages 01 and 02 only, no file moves, nothing to undo) is the natural
way to size a vault before deciding whether the fan-out is worth it.

#### PHASE 0 (SEQUENTIAL, orchestrator only)

1. Run `node scripts/vault-import.cjs --path <vault> --room <room>` through Stage 02 exactly as
   today.
2. Open `room/imports/{id}/02-classify/output/classifications.md` and COUNT THE ROWS.
3. **If the row count is BELOW `VAULT_REVIEW_FANOUT_THRESHOLD`,** run the EXISTING single-pass
   review unchanged and skip PHASE 1 and PHASE 2's fan-out mechanics entirely: for each row,
   evaluate the classifier's guess against the file content and the venture context, and edit
   section or decision cells with the Edit tool directly in `classifications.md` when a better
   assignment is warranted. Then jump straight to the shared PERSIST step at the end of PHASE 2
   below (the single-pass path never dispatches, but it converges on the same one persistence
   call as the fan-out path).
4. **If the row count is AT OR ABOVE the threshold,** continue to PHASE 1.

#### PHASE 1 (PARALLEL fan-out, threshold cleared)

**Batch by the stub classifier's guessed section, NOT by file.** Stage 02 has already produced
a first-pass section guess for every row, so the grouping is free. Each agent then owns a
coherent slice (all the candidates for `market-analysis`, say), which PRESERVES intra-section
consistency inside the agent and reduces the cross-agent surface to section BOUNDARIES only.
Batching by file instead would maximize that surface -- the opposite of what this shape buys.

Size the fan through `lib/core/dispatch-optimizer.cjs`'s `planDispatch(roomDir, opts)` and clamp
through `lib/core/futures/orchestrator.cjs`'s `resolveFanoutCap` (`FUTURES_FANOUT_CAP`, default
5). With 8 canonical Data Room sections plus the `inbox` bucket, the group count can exceed the
cap of 5 -- when it does, run the groups as two batches (for example 5 + 4) rather than raising
the cap, mirroring `commands/grade-grant.md`'s own two-batch idiom for its 7-category panel.

Dispatch with the Agent tool, `subagent_type: vault-section-reviewer` (the explicit type
string, resolving to `agents/vault-section-reviewer.md`). Do not pass any manual
background-execution parameter -- Claude Code runs spawned subagents in the background by
default under fork mode, the interactive default since 2.1.232. The platform caps concurrent
subagents at 20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); the two-batch idiom above already
stays well under that cap, but the 20 ceiling is the standing rule so a future author does not
reintroduce an unbounded fan-out.

Print a status block before dispatching:

```
[VAULT] Dispatching N section-group agents

  Rows reviewed: {row count}
  Threshold applied: {VAULT_REVIEW_FANOUT_THRESHOLD}

  Agent 1: market-analysis        [running]
  Agent 2: business-model         [running]
  Agent 3: financial-model        [running]
  ...
  Agent N: inbox                  [running]
```

**EACH SUBAGENT'S CONTRACT (one guessed-section group):**

- **Input:** the group's rows, the venture context summary from `room/STATE.md`, the section
  definitions table (purpose per canonical section), and Read access to the source files named
  in those rows.
- **Work:** for each row, read the file and confirm or correct the section and decision cells.
- **Returns:** the corrected rows as STRUCTURED DATA (not a markdown edit).
- **HARD CONSTRAINT: agents MUST NOT write to `classifications.md` or `MANIFEST.json`
  directly.** Concurrent writes from multiple parallel agents to one manifest is a corruption
  bug waiting to happen. Agents return data; the orchestrator writes once, in PHASE 2 below.
  `agents/vault-section-reviewer.md` carries no `Write` or `Bash` tool, so this constraint is
  structurally enforced, not just stated.

#### PHASE 2 (SEQUENTIAL reconcile, orchestrator only)

1. **DETECT CROSSING REASSIGNMENTS.** This is the structural risk a naive fan-out would miss,
   worked example: Agent A, reviewing the `business-model` group, may pull a file OUT into
   `financial-model`, while Agent B, reviewing `financial-model`, simultaneously pushes a
   near-identical file OUT into `business-model` -- neither saw the other's move. Detect these
   crossing pairs by comparing every agent's returned re-assignments against every other
   agent's, and resolve them with this rule: **a detected crossing pair is surfaced to the
   navigator as a single either-or choice** (which file actually belongs where) rather than
   silently applying both moves. Also detect the SOFTER version -- two near-identical files
   ending up in different sections because different agents judged them independently -- and
   flag it in the Step 5 summary rather than silently picking one.
2. **APPLY THE MERGED, RECONCILED ROWS INTO `classifications.md`.** Every agent returned its
   corrected rows as data, not a markdown edit (PHASE 1's hard constraint), so before anything
   can be persisted the orchestrator first writes each group's corrected `section` / `decision`
   / `evidence` cells into `classifications.md` itself, exactly as the single-pass path's Edit
   tool would have -- this is the same file, the same cells, updated in bulk from the fan-out's
   collected answers instead of one row at a time.

**PERSIST (shared by both the single-pass path above and the fan-out path here).**

However the rows were decided -- single-pass Edit-tool corrections below the threshold, or the
fan-out's merged, reconciled rows at or above it -- persistence is the SAME one call, made
exactly ONCE, from the orchestrator, never from an agent: `lib/import/classifications-sync.cjs`'s
`syncClassificationsToManifest(classificationsMdPath, manifestPath)`. This is already the
documented canonical persistence path from the phase 80 locked fixes; a second persistence path
must not be added, fan-out or not.

1. Call `syncClassificationsToManifest` once, over `classifications.md` as it now stands.
2. Write the marker file `room/imports/{id}/02-classify/output/.approved` ONLY after that call
   succeeds, to signal that Stage 03 can proceed without re-running the stub classifier (the
   orchestrator skipStub logic reads this marker). Then re-invoke
   `node scripts/vault-import.cjs` with the same flags for Stage 03, exactly as today.
3. Present the summary in Body Shape E and ask the user to confirm. **The fan-out speeds up
   the machine's PROPOSAL; it does not remove the human gate.** On confirmation, Stage 03 picks
   up from the approved classifications automatically.

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
