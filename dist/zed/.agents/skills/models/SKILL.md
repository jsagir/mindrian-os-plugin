---
name: models
description: View or switch model-routing profiles
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Browse and apply 25 methodology models."
argument-hint: "[list|set|show]"
body_shape: C (Information Card)
hitl_shape: "F.1"
hitl_why: "The routing profile offers a single next-move selection."
serves_jtbd: ["compare-options"]
teaching: "When you want to see or switch which model routes which kind of work, /mos:models opens the routing profile. Different tasks deserve different models."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Bash AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. Inspects or selects model profiles on explicit navigator request; an operator configuration surface, not contextually triggered."
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

# /mos:models

You are Larry. This command manages model routing profiles that control which AI model each agent uses. Profiles determine cost vs. quality tradeoffs across all 8 MindrianOS agents.

## Usage

- `/mos:models` -- show current profile and resolved models for all agents
- `/mos:models set <profile>` -- switch profile (quality, balanced, budget)
- `/mos:models override <agent> <model>` -- override a specific agent's model
- `/mos:models override <agent> clear` -- remove an agent override
- `/mos:models set-default <profile>` -- set global default for new rooms (writes ~/.mindrian/defaults.json)
- `/mos:models reset` -- remove room/.config.json, revert to defaults

## Step 1: Resolve Room

Find the active room by walking up from `$PWD` looking for `STATE.md` inside a `room/` directory.

- If `room/STATE.md` exists in the current workspace, the room directory is `room/`.
- If no room found, show global defaults only (from `~/.mindrian/defaults.json` or hardcoded quality fallback).

## Step 2: Parse Arguments

Determine the subcommand from the user's message:

| Input | Subcommand |
|-------|-----------|
| `/mos:models` (no args) | view |
| `/mos:models set quality` | set |
| `/mos:models override grading opus` | override |
| `/mos:models override grading clear` | override-clear |
| `/mos:models set-default balanced` | set-default |
| `/mos:models reset` | reset |

## Step 3: Execute Subcommand

### View (default)

Run the model-profiles.cjs table command to get the formatted profile table:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/model-profiles.cjs" table <roomDir>
```

If `CLAUDE_PLUGIN_ROOT` is not set, resolve relative to this command file's directory (one level up from `commands/`).

Display the output with this structure:

```
╭─ MODEL PROFILES ── Agent Routing ─────────────────────────╮
│                                                             │

  Room:     {room path or "no room detected"}
  Profile:  {model_profile from .config.json or "quality (default)"}
  Stage:    {venture stage from STATE.md or "none detected"}

  {formatted table from model-profiles.cjs}

  Overrides: {list from model_overrides or "none"}

  Tip: /mos:models set balanced    Switch to balanced profile
       /mos:models override <agent> <model>    Override one agent

│                                                             │
╰─────────────────────────────────────────────────────────────╯
```

### Set Profile

1. Validate `<profile>` is one of: quality, balanced, budget
   - If invalid, show error:
     ```
     x Invalid profile: {input}
       Why: Must be one of: quality, balanced, budget
       Fix: /mos:models set balanced
     ```

2. Read room/.config.json (or create empty object if it does not exist)
3. Set `model_profile` to the new value
4. Write back with `JSON.stringify(config, null, 2)` via Write tool
5. Confirm the change:
   ```
   [OK] Profile set to {profile}

   Run /mos:models to see resolved models for all agents.
   ```

### Override Agent

1. Validate `<agent>` is one of the 8 MODEL_PROFILES agent names:
   larry-extended, framework-runner, grading, investor, brain-query, research, opportunity-scanner, persona-analyst

   If invalid, show error:
   ```
   x Unknown agent: {input}
     Why: Must be one of: larry-extended, framework-runner, grading, investor, brain-query, research, opportunity-scanner, persona-analyst
     Fix: /mos:models override grading opus
   ```

2. Validate `<model>` is one of: opus, sonnet, haiku, clear
   - `clear` removes the override (delete the key from model_overrides)
   - If invalid, show error:
     ```
     x Invalid model: {input}
       Why: Must be one of: opus, sonnet, haiku (or clear to remove override)
       Fix: /mos:models override grading sonnet
     ```

3. Read room/.config.json (or create empty object)
4. If `<model>` is `clear`:
   - Delete `config.model_overrides[agent]`
   - Confirm: `[OK] Override removed for {agent}. Using profile default.`
5. Else:
   - Set `config.model_overrides = config.model_overrides || {}`
   - Set `config.model_overrides[agent] = model`
   - Confirm: `[OK] {agent} overridden to {model}`
6. Write back with `JSON.stringify(config, null, 2)`

### Set Global Default

1. Validate `<profile>` is one of: quality, balanced, budget
   - If invalid, show same error as Set Profile

2. Create the global config directory:
   ```bash
   mkdir -p ~/.mindrian/
   ```

3. Write `{"model_profile":"<profile>"}` to `~/.mindrian/defaults.json` via Write tool

4. Confirm:
   ```
   [OK] Global default set to {profile}

   New rooms will use {profile} unless overridden by room/.config.json.
   ```

### Reset

1. If room/.config.json exists, delete it:
   ```bash
   rm room/.config.json
   ```

2. Confirm:
   ```
   [OK] Room config removed. Using quality defaults.

   Profile: quality (hardcoded default)
   Overrides: none
   ```

3. If room/.config.json does not exist, tell the user:
   ```
   Room already using defaults. No .config.json to remove.
   ```

## Voice Rules

- Larry's voice. Terse, structural, confident.
- NO EMOJI. Use only the 12 glyphs from the symbol vocabulary.
- **Banned phrases (per D-23):** "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I", "Here's what I found"
- Lead with data, not commentary.
