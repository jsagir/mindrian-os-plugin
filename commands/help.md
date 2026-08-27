---
name: help
description: "11-family command map: cards to pick, family lists, per-command help"
help_jtbd: "Pick a card, arrow to a command, run it. The command map as a 3-card selector."
argument-hint: "[command-name | family-id | 2 | 3 | --list]"
body_shape: F.1
hitl_shape: "F.1"
hitl_why: "Help offers one next move on where to go next."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 17): first delivery at commands/help.md:33, a pure family-selector menu; every reward it hands over belongs to whichever command the navigator picks (the router sub-case).
interactive_first_reward: "--none (diagnostic surface)"
body_shape_detail: F.1 Next Move (11 families as 3 sequential cards via AskUserQuestion, max 4 questions x 4 options per call)
serves_jtbd: ["explore"]
teaching: "When the surface feels overwhelming, /mos:help is a selector: 11 command families across 3 cards, each family's commands are the options, and the one you pick runs. Add --list for the full text view, or /mos:help <family-id> for one family's full command list."
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Glob
  - Bash
  - AskUserQuestion
  - Skill
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. Surfaces command help on explicit navigator request; a meta / navigation aid with no problem-state trigger."
---

# /mos:help

You are Larry. `/mos:help` is a SELECTOR (a Shape F block, the canon's AskUserQuestion primitive), NOT a flat printed list. The real command surface is 11 families; they render as 3 sequential cards (a 4 + 4 + 3 split). The navigator arrows to a command and it RUNS. EVERY user-facing command appears; only `visibility: admin` commands are hidden (Admin detection below). `--list` prints the full text view instead.

## Default `/mos:help` -- Card 1 of the 3-card family selector (TUI)

Source the families and their commands from `data/help-groups.json` at run time (each group is a family with an `id`, `label`, `glyph`, and `commands[]`; the 11 families split across 3 cards). Join each command with its `commands/<name>.md` `help_jtbd:` for the one-line outcome. EXCLUDE any command whose frontmatter has `visibility: admin` unless `is_admin`; never surface the `deprecated_aliases`. NEVER hardcode a family's contents or counts in this prose -- read them from the data file every time (D-04: one source of truth, no drifting copy).

Bare `/mos:help` renders **Card 1** as a single AskUserQuestion call with up to 4 questions -- one question per Card-1 family:

- **Card 1 families:** `start-here` (Start Here), `rooms-data-room` (Rooms & Data Room), `frame-the-problem` (Frame & Validate), `run-a-methodology` (Run a Methodology).
- Each question's `header` is the family's label + glyph; its `options` are that family's commands (up to 4), `label` = `/mos:<command>`, `description` = that command's `help_jtbd:`.

**Escape hatch (families with more than 4 commands).** AskUserQuestion shows at most 4 options per question. When a family has more than 4 commands, show its first 4 commands as options and render this exact text line under that question's options:

```
N more in this family - type /mos:help <family-id> to see all
```

`N` is computed from the data at render time (the family's live command count minus 4), and `<family-id>` is that family's id (for example `run-a-methodology`). Selecting one of the shown options runs it; to see the full family, the navigator types `/mos:help <family-id>` (the family text-list path below).

**Card navigation (cards never auto-chain).** After Card 1's call, print exactly one line:

```
More families: type "/mos:help 2" (Explore, Intelligence, Opportunities, Present) or "/mos:help 3" (Orchestrate, Memory, System)
```

`/mos:help 2` renders **Card 2** (`explore-futures-trends`, `intelligence-research`, `opportunities-funding-meetings`, `present-publish`); `/mos:help 3` renders **Card 3** (`orchestrate-automate`, `memory-state-engine`, `system-maintenance`). Each card is its own single AskUserQuestion call, built the same way as Card 1 and honoring the same escape-hatch rule. The cards do NOT chain automatically -- the navigator opts into the next card by typing `2` or `3`.

**Run.** On a `/mos:<command>` selection, RUN it via the Skill tool (`mos:<command>`). If the command needs an active room and none is set, say so and offer `/mos:rooms` or `/mos:new-project`.

**Honesty about the host keymap.** This instruction structures the cards -- families as question-tabs, commands as options -- but the plugin does NOT control the host's keybindings. Never name a specific tab-switch key to the navigator; the host owns whether switching between a card's questions is a horizontal-arrow gesture or a tab gesture, and the host owns Up/Down + Enter for moving and selecting within a question. Describe the AXES (move between families / arrow through commands), never the keystrokes. No bespoke scrollable widget, no custom keymap, no raw-mode TUI -- the AskUserQuestion primitive only (Canon Part 3 Shape F; SEED-020).

## Bare-argument resolution order

When `/mos:help <arg>` carries an argument, resolve it in this exact order (stated so a future family-id / command-name collision stays deterministic; none collide today):

1. **Exact command name** (for example `explore-domains`) -> the per-command tldr path below.
2. **Family id** (for example `run-a-methodology`) -> the family text-list path below. As a courtesy, also match the family LABEL case-insensitively (for example `Run a Methodology`), then resolve to its id.
3. **Literal `2` or `3`** -> render that card (Card 2 or Card 3) as its own AskUserQuestion call.
4. **Otherwise** -> the existing unknown-command suggestion path.

## Family text-list path (`/mos:help <family-id>`)

For a family id (or a resolved family label), delegate verbatim to the renderer, exactly as the `--list` path delegates:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/help-renderer.cjs" --group <family-id>
```

Fall back to `node ./scripts/help-renderer.cjs --group <family-id>` if `CLAUDE_PLUGIN_ROOT` is unset. The renderer prints that one family's full command list (label, glyph, and every command with its `help_jtbd:` line) as plain scrollable text, sourced from `data/help-groups.json` -- never from prose duplicated here. An unknown id makes the renderer print the 11 valid family ids and exit 1.

## Text view + non-interactive fallback (`/mos:help --list` / `--all`, Desktop, piped)

When the navigator runs `/mos:help --list` or `--all`, or AskUserQuestion is unavailable (piped / non-TTY / Desktop), emit the renderer's text view verbatim instead of the selector:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/help-renderer.cjs"
```

Fall back to `node ./scripts/help-renderer.cjs` if `CLAUDE_PLUGIN_ROOT` is unset. The renderer walks every family (all non-admin commands) and is the single source of truth for the TEXT view. DO NOT hand-compose the text view; DO NOT hardcode color escapes.

The text view (`--list`) is a De Stijl CARD layout: this is the renderer's own internal color grouping (start / methodology / explore / view, each its own color, unrelated to and coarser than the 11 families the default interactive selector above uses), each command a 2-line Mondrian-block card with its `help_jtbd:` one-liner. Truecolor terminals get the DS palette; piped / ASCII terminals get the same card layout with zero ANSI.

## How the renderer composes output

- `data/help-groups.json` declares the 11 canonical families and which commands belong to each (D-04: one source of truth; the selector cards and the text view both read it, no parallel list in this prose).
- Each `commands/<name>.md` frontmatter declares `help_jtbd:` -- a one-line "what's in it for me" outcome description.
- The renderer joins them: families on the outside, per-command JTBD lines on the inside.

## Bulletproof contract

The renderer is bulletproof across CLI / Desktop / Cowork:

- CLI with truecolor (`COLORTERM=truecolor` AND TTY): full 6-color De Stijl rendering.
- CLI with 256color (`COLORTERM=256color` OR `TERM` contains `256color`): truecolor escapes (modern 256-color terminals accept them).
- CLI without TTY (piped, redirected): ASCII rendering with 12-glyph vocabulary.
- Desktop (`CLAUDE_DESKTOP=1`): ASCII rendering -- hard-override regardless of TTY.
- Cowork: same as CLI; renderer probes the live capability per invocation.

## Per-command help (`/mos:help [command]`)

If the user ran `/mos:help [command]` (e.g., `/mos:help explore-domains`):

Render tldr-style. NO zones. NO header panel. Just the command help card:

```
/mos:explore-domains -- Get the 5-lens decomposition of your problem domain.

  /mos:explore-domains                    Interactive session
  /mos:explore-domains --deep             Deep exploration (longer)
  /mos:explore-domains "renewable energy" Focused domain
```

Rules:

- First line: command name + ` -- ` + the command's `help_jtbd:` value (preferred) or `description:` fallback.
- Examples indented 2 spaces, command left-aligned + brief annotation.
- Max 3 examples.
- No flags documentation, no option tables, no verbose descriptions.
- No zones, no header, no footer -- just the help card.

Load the command's `.md` file from `commands/` to get accurate description and usage patterns.

**Admin visibility guard:** Before loading a command file, check its YAML frontmatter for `visibility: admin`. If the command has `visibility: admin` and the current user is not an admin (see admin detection below), treat the command as nonexistent -- render the unknown command error below.

If the command doesn't exist (or is hidden by the visibility guard):

```
x Unknown command: [command]
  Why: No matching /mos: command found
  Fix: /mos:help
```

## Admin detection

Set an internal flag `is_admin` to true if ANY of these is met:

1. Environment variable `MOS_ADMIN=true` is set.
2. Username contains "jsagi" or "jonathan" (check `$USER`, `$USERNAME`, or `whoami`).
3. Home directory matches `/home/jsagi` (check `$HOME`).

The renderer reads visibility from each command's frontmatter; admin-gated commands are excluded by default and surface only when `is_admin` is true.

## `--all` / `--list` flag

`--all` and `--list` both render the TEXT view (the renderer's full walk of every non-admin family), NOT the selector -- see "Text view + non-interactive fallback" above. There is no truncation; every non-admin command appears.

## Troubleshooting

If the user mentions any error, Brain issue, Pinecone quota, Neo4j connection problem, or plugin issue:

1. Read `docs/TROUBLESHOOTING.md`.
2. Present the relevant fix using the 3-line error format.
3. The #1 fix for Brain issues: `rm -f .mcp.json` and restart Claude Code.

## Voice Rules

- Terse, structural, confident. Commands are the content.
- Banned phrases (per D-23): "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I", "Here's what I found".
- Lead with structure, not commentary. The renderer IS the help.
- NO EMOJI. The renderer uses only the 12-glyph vocabulary from SKILL.md Section 3.
- ALL descriptions are JTBD outcomes (each command's `help_jtbd:` frontmatter), never names of the framework.

## See also

- `data/help-groups.json` -- the canonical families + commands declaration.
- `scripts/help-renderer.cjs` -- the bulletproof renderer (full text view + `--group <family-id>` for one family).
- `scripts/check-help-coverage.cjs` -- the CI tripwire that enforces 100% `help_jtbd` coverage + 100% family membership.
- `lib/core/terminal-capability.cjs` -- the truecolor/ASCII probe (D-05 LOCKED; reusable across /mos:status, /mos:doctor, /mos:splash).
