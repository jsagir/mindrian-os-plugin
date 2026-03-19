# Stack Research

**Domain:** Claude Code Plugin (AI methodology teaching tool)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Key Insight: This Is NOT a Traditional Software Stack

MindrianOS-Plugin is a Claude Code plugin. There is no application runtime, no package manager, no build system. The "stack" is **file formats, folder conventions, and configuration schemas** that Claude Code discovers and loads automatically. Every "technology choice" is a file structure decision.

The entire plugin is Markdown + JSON + optional shell scripts. That IS the stack.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Markdown** (SKILL.md, agents, commands) | CommonMark + YAML frontmatter | All skills, agents, commands, pipelines, references | Claude Code's native format. Skills are directories with `SKILL.md`. Agents are `.md` files with YAML frontmatter. Commands are `.md` files in `commands/`. This is not a choice -- it is a constraint. [HIGH confidence -- verified against official docs] |
| **JSON** (hooks.json, plugin.json, .mcp.json, settings.json) | Standard JSON | Hook configuration, plugin manifest, MCP server definitions, default settings | Claude Code discovers and parses these at specific paths. Schema is defined by Anthropic. [HIGH confidence -- verified against plugins-reference docs] |
| **Bash** (hook scripts) | bash 4+ | SessionStart context injection, PostToolUse intelligence pipeline, Stop hooks | Hook handlers execute shell commands via `type: "command"`. Superpowers plugin proves this pattern. Cross-platform via polyglot wrapper for Windows. [HIGH confidence -- verified from superpowers plugin source] |
| **YAML frontmatter** | Standard YAML between `---` markers | Skill metadata (name, description, disable-model-invocation, context, agent, allowed-tools) | Required for skill discovery and auto-invocation. `description` is the primary mechanism Claude uses to decide whether to load a skill. [HIGH confidence -- verified against official skills docs] |

### Plugin Manifest and Configuration

| File | Location | Purpose | Schema Notes |
|------|----------|---------|--------------|
| `plugin.json` | `.claude-plugin/plugin.json` | Plugin identity, version, metadata | Only `name` is required. Version uses semver. Custom component paths supplement (not replace) defaults. All paths relative, starting with `./` |
| `settings.json` | Plugin root | Default configuration | Currently only `agent` field is supported. Sets default agent for the plugin. MindrianOS uses `{"agent": "larry-extended"}` |
| `hooks.json` | `hooks/hooks.json` | Event handler definitions | Supports 22 event types. Key events: `SessionStart`, `PostToolUse`, `Stop`, `PreToolUse`. Matchers use regex. |
| `.mcp.json` | Plugin root | MCP server connections | Standard MCP config. Use `${CLAUDE_PLUGIN_ROOT}` for bundled servers, external URLs for remote servers. |
| `.lsp.json` | Plugin root | Language server config | Not needed for this plugin -- no code editing assistance required. |

### Supporting File Formats

| Format | Purpose | When to Use |
|--------|---------|-------------|
| **Markdown reference files** | Supporting docs alongside SKILL.md (e.g., `reference.md`, `examples.md`) | When skill content exceeds 500 lines. Progressive disclosure -- SKILL.md references them, Claude loads on demand. |
| **Shell scripts** (`.sh`) | Hook handlers, setup scripts, dynamic context injection | For SessionStart context injection, PostToolUse intelligence pipeline, computation scripts (HSI, grading). Must be `chmod +x`. |
| **Python scripts** (`.py`) | Complex computation that bash cannot handle | HSI scoring, export generators, LazyGraph queries. ElevenLabs plugin proves Python hook pattern works. Requires user has Python installed. |
| **JSON data files** | Static reference data, state snapshots | Framework definitions, chaining rules, rubric weights for Tier 0 fallback. |

---

## Plugin Directory Structure (Verified)

```
MindrianOS-Plugin/
├── .claude-plugin/
│   └── plugin.json              # Manifest (name, version, description, author)
├── commands/                     # Slash commands: /mindrian-os:larry, :room, :pipeline
│   ├── larry.md                  # /mindrian-os:larry <prompt>
│   ├── room.md                   # /mindrian-os:room <action>
│   ├── pipeline.md               # /mindrian-os:pipeline <methodology>
│   ├── setup.md                  # /mindrian-os:setup [brain|graph]
│   └── status.md                 # /mindrian-os:status
├── skills/                       # Auto-discovered by Claude
│   ├── larry-personality/        # Larry voice, mode engine, teaching style
│   │   ├── SKILL.md              # Core instructions (< 500 lines)
│   │   ├── voice-dna.md          # Full Larry style guide
│   │   └── mode-engine.md        # 40:30:20:10 distribution rules
│   ├── room-passive/             # Auto-capture, classify, file insights
│   │   └── SKILL.md
│   ├── room-proactive/           # Gap detection, contradictions, convergence
│   │   └── SKILL.md
│   ├── pws-methodology/          # Framework awareness, when to suggest what
│   │   ├── SKILL.md
│   │   └── framework-index.md    # 275+ frameworks reference
│   ├── connector-awareness/      # Detect and leverage available MCPs
│   │   └── SKILL.md
│   └── context-engine/           # ICM layer management, state aggregation
│       └── SKILL.md
├── agents/                       # Subagents invoked by Claude or user
│   ├── larry-extended.md         # Default agent (set in settings.json)
│   ├── research-pipeline.md      # Multi-step methodology execution
│   ├── room-analyst.md           # Room state analysis and recommendations
│   └── swarm-coordinator.md      # Parallel methodology execution
├── hooks/
│   └── hooks.json                # SessionStart, PostToolUse, Stop handlers
├── pipelines/                    # ICM stage contracts (NOT a Claude Code primitive)
│   ├── minto/                    # Minto Pyramid pipeline
│   │   ├── PIPELINE.md           # Stage contract definition
│   │   └── stages/               # Numbered stage files
│   ├── bono/                     # Six Thinking Hats pipeline
│   ├── hsi/                      # HSI scoring pipeline
│   ├── jtbd/                     # Jobs-to-be-Done pipeline
│   └── domain-explorer/          # Domain Explorer pipeline
├── references/                   # Layer 3: Factory (Tier 0 fallback data)
│   ├── methodology/              # 275+ framework definitions
│   ├── personality/              # Larry personality files
│   └── tools/                    # 59 innovation tool definitions
├── scripts/                      # Utility scripts for hooks and computation
│   ├── session-start.sh          # SessionStart hook: inject context
│   ├── post-tool-use.sh          # PostToolUse hook: room intelligence
│   └── hsi-compute.py            # HSI scoring computation
├── .mcp.json                     # Brain MCP (optional), research tools
├── settings.json                 # {"agent": "larry-extended"}
├── docs/                         # Architecture documentation
└── CLAUDE.md                     # Project-level instructions
```

### Critical Convention: Namespace Prefix

All plugin commands are namespaced as `mindrian-os:<command>`. The plugin name in `plugin.json` drives this automatically. Users invoke as `/mindrian-os:larry`, `/mindrian-os:room`, etc. Skills are namespaced as `mindrian-os:skill-name`.

---

## File Format Specifications

### SKILL.md Format (with Example)

```yaml
---
name: larry-personality
description: |
  Larry is the AI teaching personality for PWS methodology.
  Use when the user discusses venture innovation, asks for methodology guidance,
  or needs structured thinking about problem spaces, markets, or solutions.
  Larry speaks with warmth, uses metaphors from cooking and travel,
  and follows the 40:30:20:10 engagement distribution.
user-invocable: false
---

# Larry Personality Engine

## Voice DNA
Larry speaks as a warm, experienced mentor. Never robotic. Uses stories
and metaphors from real teaching experience.

## Mode Distribution
- 40% Conceptual: Frame the thinking, provide context
- 30% Storytelling: Illustrate with examples and metaphors
- 20% Problem-Solving: Guide through structured methodology
- 10% Assessment: Honest, calibrated feedback

## Additional Resources
- For complete voice guide, see [voice-dna.md](voice-dna.md)
- For mode engine rules, see [mode-engine.md](mode-engine.md)
```

**Key frontmatter fields for this plugin:**

| Field | Use in MindrianOS |
|-------|-------------------|
| `name` | Kebab-case, max 64 chars. Directory name used if omitted. |
| `description` | CRITICAL for auto-invocation. Write in third person. Include WHEN to use. Max 1024 chars. |
| `disable-model-invocation` | Set `true` for `/mindrian-os:setup` (side effects). Default `false` for teaching skills. |
| `user-invocable` | Set `false` for background knowledge skills (larry-personality, room-passive). |
| `context` | Set `fork` for research-pipeline to run in isolated subagent. |
| `agent` | When `context: fork`, specify which agent type (Explore, Plan, or custom). |
| `allowed-tools` | Restrict tools per skill. Room-passive needs Write; room-analyst needs Read, Grep, Glob. |

### Agent Format (with Example)

```yaml
---
name: larry-extended
description: |
  Larry is the default teaching agent for MindrianOS. Use when the user needs
  methodology guidance, venture innovation coaching, or structured thinking.
  Larry combines warmth with rigor, using PWS (Personal Wisdom System) frameworks.
  Invoke for any innovation, entrepreneurship, or methodology-related conversation.
model: inherit
---

You are Larry, the teaching personality of MindrianOS...

[Full system prompt for Larry as default agent]
```

**Agent fields:**
- `name`: Identifier, referenced in `settings.json` and `context: fork` skills
- `description`: When Claude should delegate to this agent. Include examples.
- `model`: Use `inherit` to use the session's model. Can override to specific model.

### hooks.json Format (with Example)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/post-tool-use.sh",
            "timeout": 3000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/on-stop.sh",
            "timeout": 2000
          }
        ]
      }
    ]
  }
}
```

**22 hook event types available.** The three most relevant for MindrianOS:

| Event | MindrianOS Use | Output Format |
|-------|---------------|---------------|
| `SessionStart` | Inject Larry personality context, load room STATE.md, detect available MCPs | `hookSpecificOutput.additionalContext` string |
| `PostToolUse` | After Write/Edit: classify content, detect insights, update room STATE.md | `hookSpecificOutput.additionalContext` string |
| `Stop` | Session summary, room state persistence, intelligence harvest | Exit code 0 for normal, exit code 2 to prevent stopping |

**Hook handler types:**
- `command` -- shell scripts (primary for this plugin)
- `prompt` -- LLM evaluation with `$ARGUMENTS` (useful for room-proactive intelligence)
- `agent` -- full agentic verification (complex but powerful for quality gates)
- `http` -- POST to external URL (useful for Brain MCP telemetry)

### .mcp.json Format (with Example)

```json
{
  "mcpServers": {
    "brain": {
      "type": "url",
      "url": "https://brain.mindrian.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${MINDRIAN_BRAIN_KEY}"
      }
    },
    "lazygraph": {
      "command": "npx",
      "args": ["@neo4j/mcp-neo4j", "--url", "${NEO4J_URI}", "--user", "neo4j", "--password", "${NEO4J_PASSWORD}"],
      "env": {}
    }
  }
}
```

**Note:** Both MCP servers are optional. The plugin must work without either. `connector-awareness` skill detects which are available at runtime.

### Pipeline Format (Custom Convention, NOT a Claude Code Primitive)

Pipelines are NOT a native Claude Code concept. They are a MindrianOS-specific convention: a folder of numbered stage files that skills and agents interpret.

```
pipelines/minto/
├── PIPELINE.md           # Pipeline metadata, purpose, prerequisites
├── stages/
│   ├── 01-situation.md   # ICM stage contract
│   ├── 02-complication.md
│   ├── 03-question.md
│   └── 04-answer.md
└── transforms.md         # How output maps to Room sections
```

Skills like `pws-methodology` and agents like `research-pipeline` READ these files and execute the stages. The pipeline folder is inert data -- no code, no execution. Claude interprets it.

---

## Environment Variables

| Variable | Available In | Purpose |
|----------|-------------|---------|
| `${CLAUDE_PLUGIN_ROOT}` | Skills, agents, hooks, MCP config | Absolute path to plugin installation. Changes on update. |
| `${CLAUDE_PLUGIN_DATA}` | Skills, agents, hooks, MCP config | Persistent directory that survives updates. At `~/.claude/plugins/data/mindrian-os-mindrian-marketplace/`. Use for state, caches, installed deps. |
| `${CLAUDE_SKILL_DIR}` | Skill content | Path to the specific skill's directory. Use to reference supporting files. |
| `$ARGUMENTS` | Skill/command content | User-provided arguments when invoking a skill. |
| `$ARGUMENTS[N]` / `$N` | Skill/command content | Positional arguments. |
| `${CLAUDE_SESSION_ID}` | Skill content | Current session ID. Useful for logging and state tracking. |
| `$CLAUDE_ENV_FILE` | SessionStart hooks only | Path to file where `export` statements persist env vars for the session. |

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Bash hook scripts | Python hook scripts | Bash has zero dependencies. Python requires user to have it installed (ElevenLabs requires setup command). For MindrianOS: SessionStart and PostToolUse hooks are lightweight context injection -- bash suffices. Use Python only for HSI computation scripts. |
| Markdown pipelines (custom convention) | Skills with `context: fork` for each stage | Fork creates isolated contexts that lose conversation history. Pipelines need to chain through the Room (Week 7 pattern) where output of one stage becomes input to the next. Markdown pipeline files are data that skills interpret -- more flexible. |
| `user-invocable: false` for background skills | `disable-model-invocation: true` | Background knowledge skills (larry-personality, room-passive) should be Claude-invoked, not user-invoked. `user-invocable: false` hides from `/` menu but keeps in Claude's context. `disable-model-invocation: true` does the opposite -- only user can invoke. |
| `${CLAUDE_PLUGIN_DATA}` for state | Writing state files in project directory | Plugin data dir persists across updates and is plugin-scoped. Room state (STATE.md) lives in the user's project directory because the user owns their work. Plugin configuration and caches go in PLUGIN_DATA. |
| Remote MCP URL for Brain | Bundled MCP server | Brain is the IP moat -- must never be distributed. Remote URL (`type: "url"`) connects to brain.mindrian.ai without shipping any server code. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **npm / Node.js dependencies** | Plugin is Markdown + JSON + bash. Adding node_modules creates install friction, version conflicts, and breaks the "zero infrastructure" promise. | Pure Markdown skills + bash scripts. If computation is truly needed, Python with stdlib only. |
| **TypeScript / compiled languages** | Build step means users cannot inspect or modify the plugin. Violates "every output is an edit surface" principle. | Plain Markdown. The plugin IS text files. |
| **Framework code (LangChain, LangGraph, etc.)** | ICM principle: folder structure IS orchestration. Framework code adds a layer between Claude and the methodology that prevents Claude from understanding and adapting. | ICM-native: folder structure + skills + agents. Claude reads the methodology definitions directly. |
| **Custom plugin loader / CLI** | Claude Code handles plugin discovery, loading, and namespacing. Custom loaders conflict with the platform. | Standard `commands/`, `skills/`, `agents/` directories. Let Claude Code discover them. |
| **`.claude-plugin/` for components** | Common mistake. Only `plugin.json` goes in `.claude-plugin/`. All components (commands, agents, skills, hooks) must be at plugin root. | Standard layout at plugin root. |
| **Absolute paths in config** | Plugin is cached to `~/.claude/plugins/cache/`. Absolute paths break after installation. All paths must be relative starting with `./` | `${CLAUDE_PLUGIN_ROOT}` for runtime paths. `./` for manifest paths. |
| **LSP servers** | No code editing assistance needed. This is a methodology teaching plugin, not a language tooling plugin. | Skills provide methodology guidance through natural language, not code analysis. |
| **`async: true` for critical hooks** | Async hooks cannot provide blocking decisions or context injection. SessionStart MUST be synchronous to inject Larry personality. | `async: false` (default) for SessionStart, PostToolUse. Consider async only for logging/telemetry. |

---

## Stack Patterns by Variant

**If building Tier 0 (free, no external services):**
- All 25 methodology prompts as commands in `commands/`
- Larry personality as `user-invocable: false` skill (auto-loaded by Claude)
- Framework definitions as static Markdown in `references/methodology/`
- Pipeline stage contracts as Markdown in `pipelines/<name>/stages/`
- Room state as STATE.md files in user's project directory
- No `.mcp.json` entries needed
- Hook scripts read/write local Markdown state files only

**If building Tier 1 (Brain MCP connected):**
- Same as Tier 0, plus `.mcp.json` with Brain remote URL
- `connector-awareness` skill detects Brain availability
- Skills conditionally call `mcp__brain__*` tools when available
- Graceful degradation: if Brain is down, fall back to `references/` static data

**If building Tier 2 (LazyGraph user graph):**
- Same as Tier 0/1, plus `.mcp.json` with user's Neo4j Aura
- PostToolUse hook creates graph nodes for filed insights
- Room-passive skill links concepts to graph edges
- LazyGraph requires user to run `/mindrian-os:setup graph`

---

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `plugin.json` version | Claude Code 1.x+ | Semver format. Must bump version for users to receive updates. Start at `0.1.0` for development, `1.0.0` for first marketplace release. |
| `hooks.json` schema | Claude Code 1.x+ | 22 event types as of March 2026. `prompt` and `agent` hook types are newer additions. |
| SKILL.md frontmatter | Claude Code 1.x+ | `context`, `agent`, `hooks` frontmatter fields are newer. `name`, `description`, `disable-model-invocation`, `user-invocable` are stable. |
| `.mcp.json` | MCP specification 2024+ | `type: "url"` for remote servers. Standard `command` + `args` for local servers. |
| `settings.json` | Claude Code 1.x+ | Only `agent` field currently supported. |
| Bash scripts | bash 4+ | Use `#!/usr/bin/env bash`. Cross-platform polyglot wrapper pattern (from superpowers) handles Windows. |

---

## Installation

There is no installation step for the plugin developer. The plugin is pure files.

For users:
```bash
# Install (one command)
claude plugin install mindrian-os@mindrian-marketplace

# That's it. Larry is active. Room is listening.
```

For development/testing:
```bash
# Run Claude Code with local plugin directory
claude --plugin-dir /home/jsagi/MindrianOS-Plugin

# Validate plugin structure
claude plugin validate
```

For marketplace distribution:
```bash
# Plugin must be in a marketplace with marketplace.json
# Version in plugin.json or marketplace.json (not both ideally)
# marketplace.json schema: https://anthropic.com/claude-code/marketplace.schema.json
```

---

## Sources

- [Plugins reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference) -- Complete plugin specification, manifest schema, environment variables, directory structure [HIGH confidence]
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills) -- SKILL.md format, frontmatter fields, auto-invocation, progressive disclosure [HIGH confidence]
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) -- All 22 hook events, JSON schemas, exit codes, input/output formats [HIGH confidence]
- [Plugin marketplaces - Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces) -- Distribution, versioning, marketplace.json schema [HIGH confidence]
- [Superpowers plugin v5.0.5](file:///home/jsagi/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/) -- Real-world reference: skills structure, SessionStart hook, agent format, hook scripts [HIGH confidence -- local inspection]
- [ElevenLabs TTS plugin v0.1.0](file:///home/jsagi/.claude/plugins/cache/elevenlabs/elevenlabs-tts/0.1.0/) -- Real-world reference: Python hooks, setup commands, daemon pattern [HIGH confidence -- local inspection]
- [GitHub - anthropics/claude-code plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) -- Plugin structure overview and community patterns [MEDIUM confidence]
- [Skill authoring best practices - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) -- Progressive disclosure, description optimization [MEDIUM confidence]

---
*Stack research for: Claude Code Plugin (AI methodology teaching tool)*
*Researched: 2026-03-19*
