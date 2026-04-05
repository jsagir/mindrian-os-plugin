# CLI Plugin UX Research: MindrianOS

**Domain:** Claude Code plugin UX optimization
**Researched:** 2026-03-25
**Overall confidence:** HIGH (based on official Claude Code docs + live plugin analysis)

---

## Executive Summary

MindrianOS has 41 slash commands, all prefixed with `/mindrian-os:`. This creates a discoverability and typing problem: every command requires 14 characters before the user even types the action. The plugin has a rich status line, hook system, and skill architecture already in place -- but the UX layer between Larry's intelligence and the user's terminal is underdeveloped.

This research investigates three specific areas: (1) how to make 41 commands discoverable and fast to invoke, (2) how to give visual feedback during processing, and (3) how to make methodology reasoning visible. The findings are grounded in Claude Code's actual plugin specification (fetched from official docs on 2026-03-25) and analysis of the GSD plugin as a reference implementation.

**Key constraint discovered:** Claude Code's plugin namespace is MANDATORY. Plugin skills are ALWAYS prefixed with `plugin-name:skill-name`. You cannot change this at the Claude Code level. The prefix IS the plugin name from `plugin.json`. This means the primary lever for shorter commands is changing the plugin name itself.

---

## Area 1: Slash Command UX

### How Claude Code Plugin Commands Actually Work

**Source:** Official Claude Code docs (code.claude.com/docs/en/plugins, code.claude.com/docs/en/skills)
**Confidence:** HIGH

Key facts verified from official documentation:

1. **Namespace is mandatory for plugins.** Plugin skills use `plugin-name:skill-name` format. This CANNOT be overridden. The `name` field in `plugin.json` IS the namespace prefix.

2. **The `name` field in plugin.json controls the prefix.** Changing `"name": "mindrian-os"` to `"name": "mo"` would make all commands `/mo:diagnose`, `/mo:grade`, etc. This is the single most impactful UX change available.

3. **No alias system exists.** Claude Code does not support command aliases. You cannot have both `/mindrian-os:diagnose` and `/mo:diagnose` pointing to the same command.

4. **Tab completion exists.** Users can type `/` then use tab to autocomplete. The description field is shown during autocomplete, plus the `argument-hint` frontmatter field shows expected arguments.

5. **Skill descriptions have a context budget.** The budget is 2% of context window (fallback: 16,000 chars). With 41 commands, descriptions compete for space. Commands with `disable-model-invocation: true` are excluded from this budget (their descriptions are not loaded). Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var.

6. **Skills can auto-activate without slash commands.** If `disable-model-invocation` is false (the default), Claude loads the skill description and can invoke it when the user's conversation matches. This means users can say "help me with jobs to be done analysis" without knowing `/mindrian-os:analyze-needs` exists.

### The Namespace Problem and Solution

**Current:** `/mindrian-os:diagnose` = 22 characters
**GSD reference:** `/gsd:new-project` = 16 characters

GSD uses a 3-character prefix. This is the pattern to follow.

**Recommended approach:** Change plugin name to `mo` (2 characters).

| Before | After | Savings |
|--------|-------|---------|
| `/mindrian-os:diagnose` (22) | `/mo:diagnose` (13) | 9 chars |
| `/mindrian-os:beautiful-question` (33) | `/mo:beautiful-question` (23) | 10 chars |
| `/mindrian-os:new-project` (25) | `/mo:new-project` (16) | 9 chars |

**Why `mo` and not `larry` or `mindrian`:** Two characters is the minimum that communicates identity. `mo` = MindrianOS. It matches the three-surface brand. `larry` would be 5 characters and conflates the personality with the platform. `mindrian` is 8 characters and barely shorter than the current prefix.

### Command Grouping Strategy

Claude Code does NOT support subdirectories-as-groups for plugin commands (unlike standalone `.claude/commands/` which can nest). All plugin commands are flat in the `/` menu.

**Recommended approach: Use naming conventions for visual grouping.**

Group commands by verb prefix for scannability in the autocomplete menu:

| Group | Commands | Purpose |
|-------|----------|---------|
| **analyze-*** | analyze-needs, analyze-systems, analyze-timing | Analytical frameworks |
| **explore-*** | explore-domains, explore-futures, explore-trends | Discovery/divergent thinking |
| **build-*** | build-knowledge, build-thesis | Construction/synthesis |
| **find-*** | find-bottlenecks, find-connections | Discovery/search |
| **challenge-*** | challenge-assumptions | Stress-testing |

This already exists partially. Reinforce it. The autocomplete menu sorts alphabetically, so verb prefixes create natural clusters.

### Discoverability Through Skills (The Bigger Lever)

The most powerful discoverability mechanism is NOT shorter command names -- it is skill auto-activation. When `disable-model-invocation` is false, Claude reads the description and invokes the skill when the conversation matches.

**Current state:** Most commands have `disable-model-invocation: true` (or omit it, defaulting to false -- needs audit).

**Recommended approach:** For the 26 methodology commands, set `disable-model-invocation: false` and write rich descriptions that match natural language patterns. Users should be able to say "help me think about who my customer is" and have Claude automatically invoke `analyze-needs`.

For infrastructure commands (`setup`, `update`, `export`, `room`, `pipeline`), keep `disable-model-invocation: true` -- these have side effects.

**Context budget concern:** With 41 commands and auto-invocation enabled on ~30 of them, descriptions will consume significant context. Keep descriptions under 120 characters each. At 120 chars x 30 commands = 3,600 chars, well within the 16,000 char budget.

### The Natural Language Gateway (Larry Already Does This)

The `help` command already routes users to commands based on venture stage. But this requires the user to know `/mo:help` exists.

**Better pattern:** The `larry-personality` skill is always active (auto-invocation enabled). Add a routing section to the personality skill that says: "When the user describes a problem that matches a methodology, suggest the specific command." This makes Larry the command discovery layer.

The user never needs to memorize 41 commands. They talk to Larry. Larry suggests the right one.

---

## Area 2: Visual Feedback During Processing

### What Claude Code Actually Supports

**Source:** Official docs + GitHub issues analysis
**Confidence:** HIGH

1. **Status line:** Full ANSI color support. Runs a shell script that receives JSON on stdin. Updates after each assistant message. Can show multiple lines. Supports Unicode, box drawing, progress bars. This is the ONLY persistent visual element plugins control.

2. **Hook `statusMessage` field:** In hooks.json, each hook can specify `"statusMessage": "Loading room context..."`. This appears as a brief status indicator while the hook runs. This is the secondary feedback channel.

3. **Markdown in responses:** Claude Code renders markdown in terminal output, but with significant bugs: bold/headers inconsistently styled, tables frequently misaligned, code blocks add leading whitespace. Treat markdown as "works for basic formatting" but do NOT rely on complex tables or nested formatting.

4. **ANSI in responses:** Claude's text output does NOT support ANSI escape codes. ANSI only works in the status line (which runs a separate process) and in Bash tool output. When Claude writes text, it is rendered through the markdown renderer -- not raw terminal output.

5. **Bash tool output:** Commands run via the Bash tool DO support full ANSI. A script run by Claude via `Bash(node script.js)` can print colored output that the user sees. This is the primary channel for rich visual feedback DURING a session.

### The MindrianOS Status Line (Already Built)

The `scripts/context-monitor` already provides a status line showing project name, room context, venture stage, gaps, and context window. This is good.

**Enhancement opportunity:** Add Larry's current "mode" (Investigative vs Insight) and the current methodology being applied. The status line updates after each assistant message, so it can reflect what Larry is currently doing.

```
[Opus] room: market-analysis | stage: Discovery | mode: Investigate (0.30) | 23% ctx
```

### Visual Feedback Patterns That Work

**Pattern 1: Session greeting banner (via SessionStart hook)**

The SessionStart hook already runs and can inject context. Enhance it to produce a structured greeting that Larry then incorporates into the response. The hook output appears as system context that informs Larry's first message.

**Pattern 2: Bash-rendered progress for heavy operations**

For commands that do significant work (like `file-meeting` which transcribes, classifies, and files), have the command instruct Claude to run a script that prints progress:

```bash
# The skill instructs Claude to run this
node "${CLAUDE_PLUGIN_ROOT}/scripts/file-meeting-progress.js" --step transcribe
# Script outputs: "[1/4] Transcribing audio..."
```

This creates visible progress markers in the conversation.

**Pattern 3: Structured markdown sections as visual anchors**

Since complex markdown is unreliable, use simple structures that render well:

```markdown
## Diagnosis Complete

**Problem Type:** Ill-defined, High-complexity
**Recommended:** /mo:map-unknowns, /mo:beautiful-question, /mo:explore-domains

---
```

Headers (`##`), bold (`**`), horizontal rules (`---`), and simple lists render reliably. Tables, nested formatting, and complex code blocks are fragile.

### Anti-Patterns to Avoid

1. **Do NOT use ANSI codes in skill markdown output.** They will render as literal escape characters, not colors.

2. **Do NOT build complex ASCII art in responses.** It depends on monospace rendering and terminal width. Simple box drawing is OK for small elements; large ASCII layouts will break.

3. **Do NOT rely on the status line for critical feedback.** It only updates after assistant messages and hides during permission prompts and autocomplete. It is supplementary, not primary.

4. **Do NOT use spinners or live-updating progress.** Claude Code does not support streaming terminal updates from plugins. Each Bash command runs and returns output; there is no live redraw.

---

## Area 3: Chain-of-Thought Visualization

### The Problem

When Larry applies a methodology (e.g., Six Thinking Hats, Minto Pyramid, JTBD analysis), the user sees nothing until a wall of text appears. The reasoning process -- which hat Larry is wearing, which pyramid level he is building, which assumption he is testing -- is invisible.

### What Works in Terminal Context

**Confidence:** MEDIUM (based on CLI UX research, not Claude Code specific)

**Pattern A: Section-by-section progressive output (RECOMMENDED)**

Claude naturally generates text sequentially. Structure the skill to instruct Claude to output one section at a time with clear headers:

```markdown
## White Hat: What Do We Know?

[analysis]

## Red Hat: Gut Feeling

[analysis]

## Black Hat: Risks and Dangers

[analysis]
```

This is not true "live" visualization, but it creates visual rhythm. The user sees each section appear in order, with clear labels showing which phase of the methodology they are in. This is the pattern that actually works in Claude Code.

**Pattern B: Methodology scaffolding at the start**

Before diving into analysis, output the framework structure as a roadmap:

```markdown
## Six Thinking Hats Analysis

I'll rotate through all six perspectives:
1. White Hat -- Facts and data
2. Red Hat -- Intuition and feelings
3. Black Hat -- Risks and caution
4. Yellow Hat -- Benefits and value
5. Green Hat -- Creative alternatives
6. Blue Hat -- Process and next steps

Starting with **White Hat**...
```

This sets expectations and creates a sense of progress as each section is completed.

**Pattern C: Unicode markers for state transitions**

Simple Unicode symbols work reliably across terminals:

```
[*] White Hat -- analyzing facts          (completed)
[*] Red Hat -- checking intuition          (completed)
[>] Black Hat -- evaluating risks          (current)
[ ] Yellow Hat                             (pending)
[ ] Green Hat
[ ] Blue Hat
```

Use `[*]` for complete, `[>]` for current, `[ ]` for pending. This renders as plain text and works everywhere.

**Pattern D: Tree visualization for hierarchical frameworks (Minto Pyramid, System decomposition)**

Unicode box-drawing characters render reliably in modern terminals:

```
Minto Pyramid
 +-- Answer: Municipal water systems need predictive maintenance
     +-- Supporting: 40% of US pipes exceed design life
     |   +-- Evidence: EPA infrastructure report 2024
     |   +-- Evidence: Case study -- Flint, MI
     +-- Supporting: Predictive maintenance reduces costs 30%
     |   +-- Evidence: McKinsey water utility study
     +-- Supporting: IoT sensor costs dropped 80% since 2018
         +-- Evidence: Sensor market analysis
```

Use `+--` instead of proper box drawing (`---`, `|`) because markdown rendering may interfere with Unicode box characters. ASCII tree prefixes are more portable.

### The Key Insight: Structure the SKILL.md, Not a Runtime Engine

The visualization is not a separate rendering system. It is instructions in the SKILL.md that tell Claude HOW to format output. This is cheaper, more reliable, and leverages Claude's natural capabilities.

Each methodology command's SKILL.md should include an "Output Format" section that specifies:

1. What sections to output and in what order
2. How to label each section (the "hat name", "pyramid level", "JTBD dimension")
3. What summary structure to use at the end
4. Whether to show a progress scaffold at the beginning

Example addition to `think-hats.md`:

```markdown
## Output Format

Begin with a brief scaffold showing all six hats and which order you'll address them.
As you complete each hat, use a ## header with the hat name and color.
After all hats, show a summary table:

| Hat | Key Finding | Tension |
|-----|-------------|---------|
| White | ... | ... |
| Red | ... | ... |
...

End with "## Blue Hat Synthesis" that ties the perspectives together.
```

### Anti-Patterns for Thinking Visualization

1. **Do NOT build a separate rendering engine.** No scripts that try to draw live progress trees. Claude's sequential output IS the visualization.

2. **Do NOT use emoji as methodology markers.** While tempting (a red hat emoji for Red Hat), emoji rendering varies wildly across terminals. Use text labels: "Red Hat" not a hat emoji.

3. **Do NOT create dense multi-column layouts.** Terminal width varies. Single-column, sequential output is the only reliable layout.

4. **Do NOT try to "update" previous output.** There is no mechanism to modify earlier text in the conversation. Each message is final.

---

## Synthesis: The Three-Layer UX Architecture

### Layer 1: Discovery (How users find commands)

| Mechanism | How It Works | Investment |
|-----------|-------------|------------|
| **Shorter prefix** | Change plugin name to `mo` | 1 line in plugin.json |
| **Auto-activation** | Enable model invocation on methodology skills | Audit 26 skill frontmatter |
| **Larry as router** | Personality skill suggests commands naturally | Already partially works |
| **argument-hint** | Show expected args in autocomplete | Add to frontmatter |
| **Verb-prefix naming** | Consistent naming creates visual groups | Already partially done |

### Layer 2: Feedback (How users know what is happening)

| Mechanism | How It Works | Investment |
|-----------|-------------|------------|
| **Status line** | Already built. Add mode/methodology state | Extend context-monitor |
| **Hook statusMessage** | "Loading room context..." during hooks | Already in hooks.json |
| **Bash progress scripts** | Print progress markers for heavy operations | New scripts for file-meeting, pipeline |
| **Section headers** | `##` headers in output create visual rhythm | SKILL.md output format sections |

### Layer 3: Reasoning (How users see the thinking)

| Mechanism | How It Works | Investment |
|-----------|-------------|------------|
| **Progress scaffold** | Show framework outline before diving in | Add to each methodology SKILL.md |
| **Section-by-section output** | One framework step per ## header | Add output format to each SKILL.md |
| **State markers** | `[*] done [>] current [ ] pending` | Add to output format template |
| **Tree notation** | ASCII trees for hierarchical frameworks | Add to Minto, system decomposition |
| **Summary tables** | Simple table at end of each framework | Add to output format template |

---

## Implementation Priority

### P0: Immediate (1 hour)

1. **Change plugin name to `mo` in plugin.json.** Biggest UX win per effort. All commands become `/mo:*`. Update CLAUDE.md references.

2. **Add `argument-hint` to commands that take arguments.** `pipeline`, `export`, `room`, `setup` all accept arguments. Show them in autocomplete.

### P1: High Impact (1 day)

3. **Audit and enable auto-invocation on methodology commands.** For the 26 methodology skills, set `disable-model-invocation: false` with concise descriptions. Keep infrastructure commands manual-only.

4. **Add output format sections to 5 most-used methodology commands.** Start with `diagnose`, `think-hats`, `structure-argument`, `grade`, `analyze-needs`. Add progress scaffolds and section headers.

5. **Extend status line with methodology state.** Show which framework Larry is currently applying.

### P2: Medium Impact (1 week)

6. **Add progress scripts for heavy operations.** `file-meeting` (transcribe, classify, file), `pipeline` (multi-step), `export` (render).

7. **Add output format template to all 26 methodology commands.** Standardize the pattern: scaffold at top, section headers, summary at bottom.

8. **Write natural-language routing into larry-personality skill.** "When the user describes X problem, suggest Y command."

### P3: Polish

9. **Create a visual command reference card.** A simple `/mo:help --quick` that shows commands grouped by verb prefix with one-line descriptions.

10. **Add session greeting intelligence.** Use SessionStart hook to surface 1-2 insights AND mention relevant commands the user might not know about.

---

## Context Budget Analysis

With 41 commands and auto-invocation enabled on ~30:

- **Budget:** 16,000 chars (fallback) or 2% of context window (20,000 chars for 1M context)
- **Current descriptions total:** ~4,100 chars (41 commands x ~100 char avg)
- **Skills (6 directories):** Each SKILL.md description adds ~150 chars = ~900 chars
- **Total:** ~5,000 chars -- well within budget

No risk of exceeding the context budget. Safe to enable auto-invocation broadly.

---

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- Official, fetched 2026-03-25
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins) -- Official, fetched 2026-03-25
- [Claude Code Status Line Documentation](https://code.claude.com/docs/en/statusline) -- Official, fetched 2026-03-25
- [Claude Code Slash Commands Documentation](https://code.claude.com/docs/en/slash-commands) -- Referenced via search
- [CLI UX Best Practices: Progress Displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) -- Evil Martians
- [UX Patterns for CLI Tools](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html) -- Lucas Costa
- [Claude Code ANSI Issues](https://github.com/anthropics/claude-code/issues/25346) -- GitHub, rendering bugs
- [Claude Code Markdown Rendering](https://github.com/anthropics/claude-code/issues/13600) -- GitHub, feature request
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) -- Community plugin reference
- GSD Plugin (`~/.claude/get-shit-done/`) -- Local analysis of reference implementation
