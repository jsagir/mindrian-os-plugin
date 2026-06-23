---
name: help
description: "Browse the 4-lane command map: question-tabs, arrow to a command, run it (text view with --list)"
help_jtbd: "Tab across the 4 lanes, arrow to a command, run it. The command menu as a selector."
argument-hint: [command-name | --list]
body_shape: F.1
body_shape_detail: F.1 Next Move (two-axis lanes-as-tabs via one AskUserQuestion call)
serves_jtbd: ["explore"]
teaching: "When the surface feels overwhelming, /mos:help is a selector: the 4 lanes are question-tabs, each lane's commands are the options, and the one you pick runs. Add --list for the full text view."
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

You are Larry. `/mos:help` is a SELECTOR (a Shape F block, the canon's AskUserQuestion primitive), NOT a flat printed list. The navigator switches lanes and arrows to a command, and it RUNS. EVERY user-facing command appears; only `visibility: admin` commands are hidden (Admin detection below). `--list` prints the full text view instead.

## Default `/mos:help` -- the two-axis lanes-as-tabs selector (TUI)

Source the lanes, groups, and commands from `data/help-groups.json` (each group carries `lane:` of start | methodology | explore | view; `_lanes` labels them). Join each command with its `commands/<name>.md` `help_jtbd:` for the one-line outcome. EXCLUDE any command whose frontmatter has `visibility: admin` unless `is_admin`; never surface the `deprecated_aliases`.

Render with ONE AskUserQuestion call carrying up to 4 questions -- one question per lane. This is the TWO-AXIS model:

- **The LANE axis (the tabs).** The 4 lanes (`start` / `methodology` / `explore` / `view`, labelled from `_lanes`: Start + navigate / Run a methodology / Explore + intelligence / View + manage) become the AskUserQuestion question-tabs. The host lets the navigator switch lanes -- the host owns whether that is Left/Right or Tab; do NOT claim a specific key. Each question's `header` is the short lane key (Start / Methodology / Explore / View) and its `question` is the lane label.
- **The COMMAND axis (the options).** Each lane-question's `options` are that lane's commands (the union of every group in that lane, in declaration order). Per option: `label` = `/mos:<command>`; `description` = that command's `help_jtbd:`. The navigator arrows Up/Down through the lane's commands and Enter selects.

Build all 4 questions in the SAME AskUserQuestion call so the lanes render as parallel tabs, not a sequential drill-down.

**Pagination (the 4-option cap).** AskUserQuestion shows at most 4 options per question. When a lane has more than 4 commands, show the first 3 commands + a 4th `More ->` option. Selecting `More ->` re-asks THAT lane (a fresh AskUserQuestion question for the lane) with the remaining commands, again 3 + `More ->` until exhausted. Every paginated re-ask also offers `Back` (return to the prior page of that lane). The `methodology`, `explore`, and `view` lanes each carry more than 4 commands, so each paginates; `start` fits in one page.

**Run.** On a `/mos:<command>` selection, RUN it via the Skill tool (`mos:<command>`). If the command needs an active room and none is set, say so and offer `/mos:rooms` or `/mos:new-project`. `More ->` continues that lane's pagination; `Back` returns to the prior page.

**Honesty about the host keymap.** This instruction structures the two axes -- lanes as question-tabs, commands as options -- but the plugin does NOT control the host's keybindings. Never name a specific tab-switch key to the navigator; the host owns whether lane-switching is a horizontal-arrow gesture or a tab gesture, and the host owns Up/Down + Enter for moving and selecting within a tab. Describe the AXES (switch lanes / arrow through commands), never the keystrokes. No bespoke scrollable widget, no custom keymap, no raw-mode TUI -- the AskUserQuestion primitive only (Canon Part 3 Shape F; SEED-020).

## Text view + non-interactive fallback (`/mos:help --list` / `--all`, Desktop, piped)

When the navigator runs `/mos:help --list` or `--all`, or AskUserQuestion is unavailable (piped / non-TTY / Desktop), emit the renderer's text view verbatim instead of the selector:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/help-renderer.cjs"
```

Fall back to `node ./scripts/help-renderer.cjs` if `CLAUDE_PLUGIN_ROOT` is unset. The renderer walks every group (all non-admin commands) and is the single source of truth for the TEXT view. DO NOT hand-compose the text view; DO NOT hardcode color escapes.

The text view is a De Stijl CARD layout: four color-coded lanes (start / methodology / explore / view), each command a 2-line Mondrian-block card with its `help_jtbd:` one-liner. Truecolor terminals get the DS palette; piped / ASCII terminals get the same card layout with zero ANSI.

## How the renderer composes output

- `data/help-groups.json` declares the 11 canonical groups (10 user-facing + Infrastructure) and which commands belong to each (D-07 LOCKED: Export / Publish / Hub trio replaces legacy "Output + Export").
- Each `commands/<name>.md` frontmatter declares `help_jtbd:` -- a one-line "what's in it for me" outcome description.
- The renderer joins them: groups on the outside, per-command JTBD lines on the inside.

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

`--all` and `--list` both render the TEXT view (the renderer's full walk of every non-admin group), NOT the selector -- see "Text view + non-interactive fallback" above. There is no truncation; every non-admin command appears.

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

- `data/help-groups.json` -- the canonical groups + commands declaration.
- `scripts/help-renderer.cjs` -- the bulletproof renderer.
- `scripts/check-help-coverage.cjs` -- the CI tripwire that enforces 100% `help_jtbd` coverage + 100% group membership.
- `lib/core/terminal-capability.cjs` -- the truecolor/ASCII probe (D-05 LOCKED; reusable across /mos:status, /mos:doctor, /mos:splash).
