# Phase 1: Install and Larry Talks - Research

**Researched:** 2026-03-20
**Domain:** Claude Code Plugin — zero-config install, agent personality, persistent Data Room, hooks, graceful degradation
**Confidence:** HIGH

## Summary

Phase 1 delivers the complete "install and it works" experience: one command installs the plugin, Larry responds immediately as the default agent with his full teaching personality, the Data Room initializes with DD-aligned sections, hooks manage session continuity, and everything works with zero external dependencies across all three Claude surfaces (CLI, Desktop, Cowork).

The critical research findings center on three areas. First, **Larry porting**: the V2 Larry personality across 8 files (51KB total) must be restructured for Claude Code's constraint model — an agent markdown file as the core personality plus reference files loaded on demand, not a monolithic system prompt. The V2 Ask-Tell Dial maps cleanly to a simplified mode engine for Phase 1, with Brain calibration data deferred to Phase 4. Second, **Data Room structure**: real VC due diligence data rooms use 8-10 standard sections that map well to the existing 8-section template, but naming should align with investor expectations (the CONTEXT.md decisions confirm DD-alignment). Third, **hook architecture**: the superpowers plugin demonstrates the proven pattern — a polyglot `run-hook.cmd` wrapper calling extensionless bash scripts that output JSON with `hookSpecificOutput.additionalContext` for context injection.

**Primary recommendation:** Build the agent first (Larry speaks on first message), then the Room scaffold with ROOM.md identity files, then hooks for session continuity, then commands for discoverability. The agent IS the product pitch — everything else supports it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rooms are per-project (not per-user). Each new project gets its own Data Room via `/mindrian-os:new-project`
- The 8 base sections are a starting template, not fixed. Structure follows ICM nested folder tree — rooms are like sub-agent contexts with sub-sub-agents
- Base room sections should be informed by real due diligence data room standards
- Generic parent room names with context-specific sub-room names
- Folder structure supports arbitrary nesting depth from day one
- Each room gets a ROOM.md (ICM Layer 0 identity)
- Room routing: methodologies have default target rooms, but Larry can override based on content analysis and ROOM.md rules
- Empty rooms show starter questions (2-3 seed questions)
- One project per workspace in Phase 1
- STATE.md is computed from filesystem truth via hook scripts, not maintained incrementally by Claude
- Rich state with all metadata: entry summaries, methodology provenance, gap analysis per room, room connections map
- Connections tracked as cross-references between rooms
- `/mindrian-os:new-project` does deep exploration (5-10 min) before creating rooms
- `/mindrian-os:room view`, `/mindrian-os:room add`, `/mindrian-os:room export`
- Larry personality: understated and curious, "I'm Larry. What are you working on?"
- Core Larry DNA: the challenge — pushes back on weak thinking, asks for evidence
- All 4 V2 voice aspects from day one: storytelling, challenging, mode switching, lexicon/terminology
- Phase 1 mode engine: Larry's natural judgment (no formula). Brain calibration in Phase 4.
- Contextual boundaries: always methodology-aware, no hard walls
- When user asks non-methodology questions: helps + nudges
- USER.md for user-specific context across sessions
- Context-aware return greeting
- Direct port of all 8 V2 Larry files into Claude Code equivalents
- Researcher must examine V2, V3, and V4 to determine best file structure
- `/mindrian-os:help` — Larry recommends 2-3 relevant commands based on room state
- `/mindrian-os:status` — shows room overview, venture stage, suggested next action
- Command names are action-oriented
- Progressive disclosure by VentureStage — start showing only 5-6 core commands
- Larry infers + confirms venture stage from room state
- Full command list: reconcile V4 Claude Desktop specs + V2 prompts + Brain bots
- Brain-ready interfaces from Phase 1 (but Brain itself is Phase 4)
- Brain fallback: silent fallback + status indicator
- References organized by ICM layer
- Skill loads routing index: lightweight index of all references
- Build full-power version first, free/paid tier split deferred

### Claude's Discretion
- Larry agent file size — balance personality vs context budget
- Room privacy handling for sensitive sections (legal, financial)
- Exact hook implementation details (SessionStart, PostToolUse, Stop)
- Context budget optimization — which skills auto-load vs on-demand

### Deferred Ideas (OUT OF SCOPE)
- Sub-room suggestions by Larry (Phase 3+)
- Free/paid tier split
- 9th DataRoomSection "research_angles" and "literary_analysis" from Brain
- Cross-user intelligence (Brain flywheel)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLGN-01 | One-command install, Larry responds immediately with zero config | plugin.json manifest exists; settings.json sets larry-extended agent; superpowers plugin proves this pattern works |
| PLGN-02 | Plugin manifest declares all commands, skills, agents, hooks, MCP config | plugin.json schema verified; all component paths documented in STACK.md |
| PLGN-03 | `/mindrian-os:help` shows commands with descriptions and starting points | Command file in commands/help.md; progressive disclosure by VentureStage |
| PLGN-04 | `/mindrian-os:status` shows Room state, active tier, available integrations | Command file in commands/status.md; reads STATE.md computed by hooks |
| PLGN-05 | Plugin context budget under 2% with all auto-loaded skills | V2 Larry is 51KB across 8 files — must be compressed; agent + 3-4 auto-load skills; methodology commands use disable-model-invocation |
| LARY-01 | Larry is default agent, all conversations flow through his personality | settings.json {"agent": "larry-extended"}; agent markdown body IS the system prompt |
| LARY-02 | Larry mode engine: conceptual 40%, storytelling 30%, problem-solving 20%, assessment 10% | V2 MODE_CALIBRATION.md provides full spec; Phase 1 uses natural judgment per CONTEXT.md |
| LARY-03 | Larry adapts voice by conversation context | V2 SYSTEM_PROMPT_V2.md conversation flow (turns 1-2 investigate, 3-4 earn frameworks, 5+ cross-domain, 8+ converge) |
| LARY-04 | Larry personality ported from 8 V2 files, redesigned for Claude Code | 8 files examined (51KB total); recommended restructure: agent body + 3 reference files |
| ROOM-01 | 8 Data Room sections initialized | DD-aligned sections researched; mapping to investor expectations documented |
| ROOM-02 | STATE.md computed from filesystem truth via hooks | Hook script computes state by scanning room directories; bash script pattern from superpowers |
| ROOM-03 | SessionStart hook loads Room state for session continuity | Superpowers proves pattern; script reads STATE.md + ROOM.md and injects via additionalContext |
| ROOM-04 | Stop hook persists session state | Script updates STATE.md with session summary before exit |
| ROOM-05 | `/mindrian-os:room` command for Room overview | Command reads STATE.md, displays per-section completeness |
| DEGS-01 | Fully functional with zero external dependencies (Tier 0) | No MCP servers in default .mcp.json; all references embedded in references/ |
| DEGS-02 | references/ provides embedded framework definitions and fallback data | Directory structure exists (methodology/, personality/, tools/); content to be populated |
| DEGS-03 | All features that depend on optional services have local fallbacks | Brain-ready interfaces defined but Phase 1 uses references/ exclusively |
| SURF-01 | Plugin works identically on CLI, Desktop, and Cowork | Polyglot hook wrapper (run-hook.cmd) handles cross-platform; agent format is universal |
| SURF-02 | Cowork gets 00_Context/ directory for shared project state | Cowork-specific initialization in new-project command |
</phase_requirements>

## Standard Stack

### Core
| Component | Format | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| Agent markdown | `.md` with YAML frontmatter | Larry's personality as default session agent | Claude Code's native agent format; `settings.json` sets it as default. Replaces Claude's system prompt entirely. |
| SKILL.md | `.md` with YAML frontmatter | Auto-loaded contextual skills (room-passive, larry-personality, pws-methodology) | Claude Code discovers skills by directory; `description` field controls auto-invocation. |
| hooks.json | JSON | SessionStart/PostToolUse/Stop event handlers | Claude Code's hook system; triggers scripts on lifecycle events. |
| Bash scripts | Extensionless files | Hook handlers for state computation and context injection | Zero dependencies; cross-platform via polyglot wrapper (proven by superpowers plugin). |
| plugin.json | JSON | Plugin manifest | Required by Claude Code; already exists at `.claude-plugin/plugin.json`. |
| settings.json | JSON | Default agent setting | `{"agent": "larry-extended"}` already exists at plugin root. |

### Supporting
| Component | Format | Purpose | When to Use |
|-----------|--------|---------|-------------|
| Reference markdown | `.md` in references/ | Framework definitions, personality files, routing index | On-demand loading by skills/agent. Keeps context budget low. |
| ROOM.md | `.md` with YAML frontmatter | Room identity (ICM Layer 0) | Created per Data Room section; defines purpose + starter questions. |
| STATE.md | `.md` with YAML frontmatter | Computed room state | Generated by hook scripts from filesystem scan; never hand-edited. |
| USER.md | `.md` | User-specific context (name, background, learning style) | Created on first interaction; Larry references across sessions. |
| Command markdown | `.md` | Slash commands (/mindrian-os:help, :status, :room, :new-project) | User-invoked actions with `disable-model-invocation: true` for side-effect commands. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash hook scripts | Python hook scripts | Python requires user to have it installed. Bash is zero-dep. Only use Python for complex computation (HSI scoring in Phase 2+). |
| Extensionless hook scripts | .sh files | Claude Code on Windows auto-prepends "bash" to .sh files, breaking the polyglot wrapper pattern. Superpowers uses extensionless — follow the proven pattern. |
| Monolithic agent prompt | Split agent + many skills | Monolithic exceeds useful prompt size and degrades instruction following. Split keeps agent lean (~2-3KB) with references loaded on demand. |

## Architecture Patterns

### Recommended Project Structure (Phase 1 deliverables)
```
MindrianOS-Plugin/
├── .claude-plugin/
│   └── plugin.json                    # Already exists
├── settings.json                      # Already exists: {"agent": "larry-extended"}
├── CLAUDE.md                          # Already exists: project guide
│
├── agents/
│   └── larry-extended.md              # DEFAULT AGENT: Larry personality core
│
├── skills/
│   ├── larry-personality/
│   │   ├── SKILL.md                   # Voice DNA, mode engine basics (auto-invoked)
│   │   ├── voice-dna.md               # Full style guide (reference)
│   │   ├── mode-engine.md             # Ask-Tell Dial patterns (reference)
│   │   └── framework-chains.md        # Framework delivery by mode (reference)
│   ├── room-passive/
│   │   └── SKILL.md                   # Room state awareness (auto-invoked, Phase 1: read-only)
│   ├── pws-methodology/
│   │   └── SKILL.md                   # Framework index + routing awareness (auto-invoked)
│   ├── context-engine/
│   │   └── SKILL.md                   # Session continuity, USER.md management
│   ├── room-proactive/               # Empty in Phase 1 (Phase 3)
│   └── connector-awareness/          # Empty in Phase 1 (Phase 4)
│
├── commands/
│   ├── new-project.md                 # /mindrian-os:new-project — deep venture exploration + room creation
│   ├── help.md                        # /mindrian-os:help — progressive command discovery
│   ├── status.md                      # /mindrian-os:status — room overview, venture stage
│   ├── room.md                        # /mindrian-os:room — view/add/export subcommands
│   └── [future methodology commands]  # Phase 2+
│
├── hooks/
│   ├── hooks.json                     # SessionStart, Stop handlers
│   └── run-hook.cmd                   # Polyglot wrapper (copied from superpowers pattern)
│
├── scripts/
│   ├── session-start                  # Load STATE.md + ROOM.md context into session
│   ├── on-stop                        # Compute and persist STATE.md from filesystem
│   └── compute-state                  # Shared: scan room dirs, generate STATE.md content
│
├── references/
│   ├── methodology/
│   │   └── index.md                   # Framework catalog (names + one-liners for routing)
│   ├── personality/
│   │   ├── lexicon.md                 # Larry's vocabulary and banned phrases
│   │   └── assessment-philosophy.md   # "Grade on thinking, not polish"
│   └── tools/                         # Empty in Phase 1 (Phase 2+)
│
└── docs/
    ├── THE-BRAIN.md                   # Already exists
    ├── ARCHITECTURE-DEEP-DIVE.md      # Already exists
    └── IDEA-DOCUMENT.md               # Already exists
```

### Pattern 1: Larry Agent as Session Personality

**What:** The `larry-extended.md` agent replaces Claude's default system prompt. Every message the user sends goes through Larry's personality, voice rules, and teaching approach.

**When to use:** This is the ONLY pattern for Phase 1. Larry IS the session.

**Key implementation detail:** The agent markdown body must be concise (~2-3KB) containing:
1. Core identity (who Larry is, what he does)
2. Voice rules (concise, provocative, warm but demanding)
3. The cardinal sin (never dump frameworks)
4. Conversation flow rules (turns 1-2 investigate, 3-4 earn frameworks, 5+ insights)
5. What he never/always does
6. Room awareness instructions (read ROOM.md, reference STATE.md)
7. USER.md instructions (remember and reference user context)
8. Pointer to larry-personality skill for deeper reference

**V2 content that goes into agent body vs reference files:**

| V2 File | Size | Destination | Rationale |
|---------|------|-------------|-----------|
| SYSTEM_PROMPT_V2.md | 9.5KB | **Agent body** (compressed to ~2.5KB) | Core personality, voice, conversation flow — must be in system prompt |
| STYLE_GUIDE.md | 3.9KB | **references/personality/voice-dna.md** | Detail the agent references on demand |
| MODE_CALIBRATION.md | 5.2KB | **skills/larry-personality/mode-engine.md** | Mode transition rules loaded by skill |
| SKILL.md | 6.6KB | **skills/larry-personality/SKILL.md** (compressed) | Skill metadata + mode overview |
| LEXICON.md | 4.7KB | **references/personality/lexicon.md** | Vocabulary reference loaded on demand |
| FRAMEWORK_CHAINS.md | 10.1KB | **skills/larry-personality/framework-chains.md** | Mode-specific framework delivery |
| INSIGHT_MODE.md | 5.9KB | **skills/larry-personality/mode-engine.md** (merged) | Part of mode engine reference |
| INVESTIGATIVE_MODE.md | 5.5KB | **skills/larry-personality/mode-engine.md** (merged) | Part of mode engine reference |

**Total V2: 51.4KB. Target: Agent body ~2.5KB + skill SKILL.md ~1KB + 3 reference files ~12KB = ~15.5KB total, loaded progressively.**

### Pattern 2: Room Initialization via Deep Conversation

**What:** `/mindrian-os:new-project` triggers a 5-10 minute guided conversation where Larry explores the venture, then creates a tailored Data Room folder structure based on what the user shared.

**When to use:** First interaction with a new workspace. This IS the onboarding.

**Implementation:**
```markdown
# commands/new-project.md
---
name: new-project
description: Start a new venture project with Larry — he'll explore your idea and create your Data Room
allowed-tools: [Read, Write, Bash, Glob]
---

## Instructions

1. Read USER.md if it exists (returning user context)
2. Greet casually: "I'm Larry. What are you working on?"
3. Deep exploration (5-10 min):
   - What problem are they solving? (problem-definition room)
   - Who has this problem? (market-analysis room)
   - What solution exists? (solution-design room)
   - What's the business model? (business-model room)
   - Any competition? (competitive-analysis room)
   - Team situation? (team-execution room)
4. Create room/ directory with 8 base sections
5. Create ROOM.md per section with purpose + 2-3 starter questions
6. Create USER.md with captured user context
7. Create initial STATE.md
8. Infer venture stage and confirm with user
```

### Pattern 3: Computed State via Hook Scripts

**What:** STATE.md is never maintained by Claude incrementally. Hook scripts scan the filesystem on SessionStart and Stop to compute truth.

**When to use:** Always. This prevents state drift.

**SessionStart hook flow:**
```
1. Script scans room/ directory tree
2. Counts entries per section
3. Reads ROOM.md files for section identity
4. Reads USER.md for user context
5. Generates rich context string:
   - Room overview (sections, entry counts, last modified)
   - Gap analysis (empty sections highlighted)
   - Cross-references detected
   - Venture stage inference
   - Suggested next action
6. Outputs JSON with additionalContext
```

**Stop hook flow:**
```
1. Script scans room/ directory tree
2. Computes STATE.md from filesystem truth:
   - Entry summaries (first line of each .md file)
   - Methodology provenance (metadata from entries)
   - Room completeness percentages
   - Cross-room connections
   - Session summary (from session context if available)
3. Writes STATE.md to room/
```

### Pattern 4: Progressive Disclosure by Venture Stage

**What:** Only show 5-6 commands initially, reveal more as the user progresses through venture stages.

**When to use:** `/mindrian-os:help` and `/mindrian-os:status` commands.

**Venture stages and associated commands:**

| VentureStage | Core Commands Available | Phase 1 Available |
|-------------|------------------------|-------------------|
| Pre-Opportunity | new-project, help, status, room | Yes |
| Discovery | + explore-trends, explore-domains, beautiful-question | Phase 2 |
| Validation | + analyze-needs, challenge-assumptions, validate | Phase 2 |
| Design | + structure-argument, think-hats, scenario-plan | Phase 2 |
| Investment | + build-thesis, assess-readiness, grade | Phase 2+ |

Phase 1 implements the stage inference logic and progressive disclosure framework. Actual methodology commands come in Phase 2.

### Anti-Patterns to Avoid

- **Monolithic agent prompt:** Never put all 51KB of V2 Larry into the agent body. Keep agent at ~2.5KB, load details via skills and references on demand.
- **Claude-maintained STATE.md:** Never ask Claude to update STATE.md inline. Hook scripts compute it from filesystem.
- **MCP in default config:** Never put Brain MCP in `.mcp.json` by default. It causes cold start delays and breaks the zero-config promise.
- **All skills auto-loaded:** Keep auto-invoked skills to 3-4 max (larry-personality, room-passive, pws-methodology). Everything else loads on demand.
- **Absolute paths in any file:** Use `${CLAUDE_PLUGIN_ROOT}` in hooks, `./` in plugin.json. Plugin root changes after installation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform hook execution | Custom bash/cmd wrapper | Superpowers' `run-hook.cmd` polyglot pattern | Handles Windows Git Bash detection, fallback gracefully. Battle-tested. |
| JSON escaping in hook scripts | Character-by-character loop | Superpowers' `escape_for_json()` bash function | Handles newlines, quotes, backslashes. Orders of magnitude faster than loops. |
| Hook output format | Ad-hoc JSON construction | `hookSpecificOutput.additionalContext` JSON format | Claude Code reads this exact field; Cursor uses `additional_context`. Check `CURSOR_PLUGIN_ROOT` vs `CLAUDE_PLUGIN_ROOT` for platform detection. |
| Agent default activation | Custom CLAUDE.md instructions | `settings.json` with `{"agent": "larry-extended"}` | Native Claude Code mechanism. Already works. |
| Skill auto-invocation control | Complex logic | YAML frontmatter: `user-invocable`, `disable-model-invocation` | Native Claude Code mechanism. Well-documented. |

## Common Pitfalls

### Pitfall 1: Context Window Starvation
**What goes wrong:** Loading too many skills, agent body too large, MCP tool descriptions consume budget. User gets degraded responses because Claude has no room for actual conversation.
**Why it happens:** V2 Larry is 51KB across 8 files. Naively porting all of it into auto-loaded content would consume 10%+ of Sonnet's 200K context.
**How to avoid:** Agent body under 3KB. Each auto-loaded skill SKILL.md under 500 lines (ideally under 200). Methodology commands use `disable-model-invocation: true`. Reference files loaded on demand only. Target: total auto-loaded content under 5KB.
**Warning signs:** Responses feel generic or Claude loses personality mid-conversation. `/mindrian-os:status` should report context budget estimate.

### Pitfall 2: STATE.md Consistency Drift
**What goes wrong:** If Claude is asked to maintain STATE.md incrementally, it deprioritizes bookkeeping when focused on the user's actual question. STATE.md drifts from filesystem reality.
**Why it happens:** Claude optimizes for the user's immediate need, not background state management.
**How to avoid:** Hook scripts compute STATE.md from filesystem truth. Claude reads STATE.md but never writes it. Hook scripts do the scanning and writing.
**Warning signs:** STATE.md shows different entry counts than actual files in room directories.

### Pitfall 3: V2 Prompt Porting Trap
**What goes wrong:** V2 Larry files assume Gemini personality, CopilotKit UI, Python backend, and stateful session state. Naively copying them creates a fighting personality — Claude tries to be Larry while also being Claude.
**Why it happens:** V2 prompts contain Gemini-specific instructions (action buttons, structured output schemas) and assume features that don't exist in Claude Code (status bar, agent switcher).
**How to avoid:** Redesign each V2 file for Claude Code. Extract the ESSENCE (voice, teaching patterns, mode engine logic) and express it in Claude Code's native format. Remove all V2-specific UI references, action buttons, CopilotKit state sync, and Gemini personality overrides.
**Warning signs:** Larry mentions "action buttons", "status bar", "panels", or uses Gemini-style structured outputs.

### Pitfall 4: Hook Script Timeout
**What goes wrong:** Hook scripts that scan large directory trees or make external calls exceed the timeout, causing SessionStart to fail silently.
**Why it happens:** No explicit timeout in hooks.json means default 600s, but slow hooks degrade user experience even if they complete.
**How to avoid:** Keep hook scripts under 2 seconds. For Phase 1 with small room directories, this is easy. Use `find` with `-maxdepth` to prevent deep recursion. Never make network calls in hooks (Brain MCP calls happen in conversation, not hooks).
**Warning signs:** Noticeable delay between starting Claude and Larry's first response.

### Pitfall 5: Cowork Surface Differences
**What goes wrong:** Plugin behavior differs across CLI, Desktop, and Cowork because hooks, agent loading, or file system access works differently.
**Why it happens:** Three surfaces have subtly different hook execution, agent loading, and tool availability.
**How to avoid:** Test on all three surfaces from Phase 1. The `00_Context/` directory for Cowork is an explicit requirement (SURF-02). Use `${CLAUDE_PLUGIN_ROOT}` consistently. Check for `CURSOR_PLUGIN_ROOT` for platform detection in hooks.
**Warning signs:** "Works on CLI but not Desktop" reports during testing.

## Code Examples

### Example 1: Larry Agent Markdown (larry-extended.md)

```yaml
---
name: larry-extended
description: |
  Larry is the PWS methodology teaching partner for MindrianOS.
  Use for all conversations about venture innovation, problem exploration,
  methodology guidance, structured thinking, and Data Room management.
  Larry speaks with warmth and intellectual rigor, using the Aronhime
  teaching methodology (30+ years at Johns Hopkins).
model: inherit
---
```

Body structure (abbreviated):
```markdown
You are Larry — a thinking partner modeled on Prof. Lawrence Aronhime.
You are NOT a textbook, NOT a chatbot, NOT a framework dispenser.

## Voice
Conversational. Provocative. Concise. Warm but demanding.
3-8 sentences default. Quick exchanges: 2-3. Longer ONLY when asked.

## The Cardinal Sin: Framework Vomit
NEVER dump frameworks. Apply them invisibly through questions.
Frameworks are tools in your back pocket — earn them in conversation.

## Conversation Flow
- First response: 1 sentence acknowledgment, 1 reframe, 1 question
- Turns 2-5: Follow their thread, introduce frameworks when earned
- Turn 5+: Cross-domain connections, name frameworks freely
- Escape hatch: "just tell me" → immediate delivery, zero resistance

## Room Awareness
- Read room/ROOM.md for project context on each turn
- Reference STATE.md for section completeness and gaps
- When user returns, greet with awareness of where they left off
- Read USER.md for user-specific context (name, background)

## What You Never Do
[Banned phrases and behaviors from LEXICON.md]

## What You Always Do
[Core teaching behaviors from STYLE_GUIDE.md]

For detailed voice patterns, see larry-personality skill.
For framework delivery by mode, see framework-chains reference.
```

### Example 2: SessionStart Hook Script

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Determine working directory (where user's project is)
WORK_DIR="${PWD}"
ROOM_DIR="${WORK_DIR}/room"

# Build context string
context=""

if [ -d "$ROOM_DIR" ]; then
  # Room exists — compute state
  state_summary=""
  for section_dir in "$ROOM_DIR"/*/; do
    [ -d "$section_dir" ] || continue
    section_name=$(basename "$section_dir")
    [ "$section_name" = ".git" ] && continue
    entry_count=$(find "$section_dir" -maxdepth 1 -name "*.md" ! -name "ROOM.md" | wc -l)
    room_md=""
    [ -f "${section_dir}/ROOM.md" ] && room_md=$(head -5 "${section_dir}/ROOM.md")
    state_summary="${state_summary}\n- ${section_name}: ${entry_count} entries"
  done

  # Read USER.md if exists
  user_context=""
  [ -f "${ROOM_DIR}/USER.md" ] && user_context=$(cat "${ROOM_DIR}/USER.md")

  # Read STATE.md if exists
  state_md=""
  [ -f "${ROOM_DIR}/STATE.md" ] && state_md=$(cat "${ROOM_DIR}/STATE.md")

  context="[MindrinanOS Room Context]\nRoom sections:${state_summary}"
  [ -n "$user_context" ] && context="${context}\n\nUser context:\n${user_context}"
  [ -n "$state_md" ] && context="${context}\n\nLast computed state:\n${state_md}"
else
  context="[MindrinanOS] No room initialized yet. Suggest /mindrian-os:new-project to get started."
fi

# Escape for JSON
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

escaped_context=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
else
  printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

### Example 3: hooks.json Configuration

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "async": false,
            "statusMessage": "Loading room context..."
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" on-stop",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

### Example 4: ROOM.md for a Data Room Section

```yaml
---
section: problem-definition
purpose: Define the core problem your venture addresses
stage_relevance: [Pre-Opportunity, Discovery]
default_methodologies: [domain-explorer, beautiful-question, trending-to-absurd]
---

# Problem Definition

This room captures the core problem your venture addresses — who has it, why it matters, and why now.

## Starter Questions

- What problem are you trying to solve, and who has it badly enough to change their behavior?
- What assumptions are you making about this problem that might not be true?
- Why hasn't this problem been solved already?
```

## V2 Larry Port Analysis

### File-by-File Assessment

| V2 File | Content Essence | Claude Code Destination | Port Complexity |
|---------|----------------|------------------------|-----------------|
| **SYSTEM_PROMPT_V2.md** (9.5KB) | Core identity, voice rules, conversation flow, problem classification, context intelligence, agent handoffs, Ask-Tell Dial, the Aronhime DNA | `agents/larry-extended.md` body (compressed to ~2.5KB). Remove: action buttons, AG-UI references, Erik mode, context engine layer descriptions | MEDIUM — need to extract essence from Gemini-specific wrapping |
| **STYLE_GUIDE.md** (3.9KB) | Voice, response length, signature openers, the reframe, voice modulation, tone by context | `references/personality/voice-dna.md` (mostly as-is, remove button references) | LOW — mostly portable as-is |
| **MODE_CALIBRATION.md** (5.2KB) | Phase-based dial curve, transition rules, saturation detection, misfire recovery, context signal mapping | `skills/larry-personality/mode-engine.md` (merge with Insight + Investigative) | MEDIUM — remove context engine signal references that assume V2 pipeline |
| **SKILL.md** (6.6KB) | Ask-Tell Dial overview, mode descriptions, signal → mode table, escape hatch, mode × problem type matrix | `skills/larry-personality/SKILL.md` (compressed to skill frontmatter + essential rules) | MEDIUM — needs compression to stay under skill budget |
| **LEXICON.md** (4.7KB) | PWS terminology, framework name rules, banned phrases, encouraged phrases | `references/personality/lexicon.md` (as-is, remove action button vocabulary) | LOW — directly portable |
| **FRAMEWORK_CHAINS.md** (10.1KB) | Mode-specific framework delivery for each problem type, cross-domain patterns, anti-patterns | `skills/larry-personality/framework-chains.md` (as-is) | LOW — directly portable, excellent reference content |
| **INSIGHT_MODE.md** (5.9KB) | Evidence → Insight → Warning structure, blind spot identification, synthesis techniques | Merge into `skills/larry-personality/mode-engine.md` | LOW — portable patterns |
| **INVESTIGATIVE_MODE.md** (5.5KB) | Question chain patterns, silent classification, devil's advocate techniques, teacher arc | Merge into `skills/larry-personality/mode-engine.md` | LOW — portable patterns |

### V3 and V4 Insights for Structure Decision

**V3 approach:** "Skill Overlay" — Larry + .md skills. 20 of 25 agents are Larry with different prompts. Only 5 custom nodes stay. This validates the "Larry as default agent + skill overlays" pattern.

**V4 approach:** Rooms + Skills triggered by Moments. Skills replace named agents. Autonomy Dial replaces Ask-Tell Dial. This is architecturally different but the personality content is the same.

**Recommended structure for Claude Code plugin:** Follow V3's "Skill Overlay" principle. Larry is the agent, skills provide domain-specific overlay, reference files hold detail. This maps naturally to Claude Code's agent + skills model.

### Key V2 Elements to REMOVE During Port

- Action buttons (Research, Think, Synthesize, Example, Give me the answer) — Claude Code has no UI buttons
- AG-UI / CopilotKit state sync references — not applicable
- Agent handoff instructions (SWITCH, DELEGATE, CONSULT) — Claude Code uses subagents differently
- Erik Mode (AI architecture partner) — separate concern, not Phase 1
- Context engine layer descriptions — V2-specific pipeline, not applicable
- Gemini-specific formatting instructions — Claude has its own formatting

### Key V2 Elements to PRESERVE

- The Aronhime DNA (double helix: Understanding + Application)
- Voice modulation cue (lower octave = short, punchy sentences)
- Signature openers ("Very simply...", "Think about it like this...")
- The Reframe (power move)
- Silent problem classification (4 types, never announced)
- Phase-based conversation curve (turns 1-2 → 3-4 → 5-7 → 8+)
- Escape hatch (immediate delivery on "just tell me")
- Framework vomit as cardinal sin
- All banned and encouraged phrases from LEXICON.md

## Data Room DD Alignment

### Research: Standard Due Diligence Data Room Sections

From VC data room best practices (Visible.vc, 4Degrees, GoingVC, Mars DD):

| DD Standard Section | MindrianOS Room | Alignment Notes |
|--------------------|-----------------|--------------------|
| Financials & Cap Table | **financial-model** | Direct match. Sub-rooms: projections/, cap-table/, metrics/ |
| Market Data & Research | **market-analysis** | Direct match. Sub-rooms: research/, public-reports/, tam-analysis/ |
| Competitive Landscape | **competitive-analysis** | Direct match. Sub-rooms: feature-comparison/, pricing/, landscape/ |
| Product & IP | **solution-design** | Maps to solution + IP. Sub-rooms: architecture/, ip/, roadmap/ |
| Team & Stakeholders | **team-execution** | Direct match. Sub-rooms: team/, advisors/, hiring-plan/ |
| Legal & Incorporation | **legal-ip** | Direct match. Sub-rooms: incorporation/, agreements/, ndas/ |
| Overview & Pitch | **problem-definition** | Problem + pitch. Sub-rooms: pitch/, thesis/, problem-statement/ |
| Business Model | **business-model** | Direct match. Sub-rooms: revenue-model/, unit-economics/, go-to-market/ |

### Recommended 8 Base Sections (DD-Aligned)

| Section Name | DD Alignment | Purpose | Example Sub-rooms |
|-------------|-------------|---------|-------------------|
| `problem-definition` | Overview, Investment Thesis | The core problem and why it matters | pitch/, thesis/, market-need/ |
| `market-analysis` | Market Data & Research | Market size, trends, customer segments | tam-analysis/, customer-research/, trends/ |
| `solution-design` | Product & IP | The solution, technology, architecture | product/, ip/, technical-architecture/ |
| `business-model` | Business Model | Revenue, unit economics, go-to-market | revenue-model/, unit-economics/, go-to-market/ |
| `competitive-analysis` | Competitive Landscape | Competition, positioning, differentiation | landscape/, feature-comparison/, positioning/ |
| `team-execution` | Team & Stakeholders | Team, advisors, hiring, execution plan | team/, advisors/, hiring-plan/ |
| `legal-ip` | Legal & Incorporation | Legal structure, agreements, IP protection | incorporation/, agreements/, ndas/ |
| `financial-model` | Financials & Cap Table | Financial projections, metrics, funding | projections/, cap-table/, metrics/ |

This matches the existing ROOM-01 requirement exactly and aligns with real DD expectations. Brain has 9 DataRoomSections (including `research_angles` and `literary_analysis`) — these can be added as optional rooms later per CONTEXT.md deferred items.

## Command Reconciliation (Phase 1 Scope)

### V2 Bots → V4 Claude Desktop Specs → Brain Bots → Phase 1 Commands

| V2 Bot | V4 Spec | Brain Bot | Phase 1 Command | Phase |
|--------|---------|-----------|-----------------|-------|
| lawrence | - | ThinkingPartner | (Default agent — Larry) | 1 |
| - | - | - | `/mindrian-os:new-project` | 1 |
| - | - | - | `/mindrian-os:help` | 1 |
| - | - | - | `/mindrian-os:status` | 1 |
| - | - | - | `/mindrian-os:room` | 1 |
| domain | claude-project-6 | DomainExplorer | `/mindrian-os:explore-domains` | 2 |
| minto | claude-project-1 | - | `/mindrian-os:structure-argument` | 2 |
| bono | claude-project-14 | BonoInnovation | `/mindrian-os:think-hats` | 2 |
| jtbd | - | CustomerNeedFinder | `/mindrian-os:analyze-needs` | 2 |
| redteam | claude-project-5 | DevilsAdvocate | `/mindrian-os:challenge-assumptions` | 2 |
| reverse_salient | claude-project-13 | ReverseSalient | `/mindrian-os:find-bottlenecks` | 2 |
| pws_investment | claude-project-15 | InvestmentAnalyst | `/mindrian-os:build-thesis` | 2 |
| grading | claude-project-7,11 | - | `/mindrian-os:grade` | 2 |
| tta | - | FutureExplorer | `/mindrian-os:explore-trends` | 4 |
| scurve | - | TimingAnalyst | `/mindrian-os:analyze-timing` | 4 |
| scenario | - | ScenarioPlanner | `/mindrian-os:scenario-plan` | 4 |
| validation | - | EvidenceValidator | `/mindrian-os:validate` | 4 |
| beautiful_question | claude-project-4 | QuestionReframer | `/mindrian-os:beautiful-question` | 4 |
| ackoff | - | - | `/mindrian-os:build-knowledge` | 4 |
| oracle | - | FuturesAdvisor | `/mindrian-os:explore-futures` | 4 |
| knowns | - | UncertaintyMapper | `/mindrian-os:map-unknowns` | 4 |
| nested_hierarchies | - | SystemsAnalyst | `/mindrian-os:analyze-systems` | 4 |
| rca | - | - | `/mindrian-os:root-cause` | 4 |
| macro_changes | - | - | `/mindrian-os:macro-trends` | 4 |
| dominant_designs | - | - | `/mindrian-os:dominant-designs` | 4 |
| user_needs | - | - | `/mindrian-os:user-needs` | 4 |
| leadership | - | - | `/mindrian-os:leadership` | 4 |
| pws_consultant | - | ProblemDiagnostician | (routing skill, not command) | 2 |
| erik | claude-project-9 | WorkflowArchitect | (internal skill, not command) | 4 |

**Phase 1 commands (5 total):** new-project, help, status, room, (Larry is the default agent, not a command)

**Phase 1 also creates:** The references/methodology/index.md routing index that lists ALL future commands with one-liner descriptions. This enables `/mindrian-os:help` to show progressive disclosure even though actual commands arrive in Phase 2+.

## Brain-Ready Interfaces

Phase 1 must define interfaces that Brain will plug into in Phase 4. These interfaces exist as documented conventions, not code:

| Interface | Phase 1 Implementation | Phase 4 Brain Implementation |
|-----------|----------------------|------------------------------|
| Framework suggestion | Read references/methodology/index.md | Call mcp__brain__suggest_methodology() |
| Chain recommendation | Read references/chains/static-chains.md (Phase 2+) | Call mcp__brain__suggest_chain() |
| Mode calibration | Natural judgment per CONTEXT.md | Call mcp__brain__get_teaching_context() |
| Room assessment | Filesystem scan via hooks | Call mcp__brain__grade_room() |
| Cross-domain connections | Larry's own knowledge | Call mcp__brain__find_connections() |

**Implementation:** The pws-methodology skill checks for Brain availability. If Brain MCP tools exist in the session, use them. If not, fall back to references/. This check is a simple conditional in the skill's instructions, not code.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V2: Gemini + CopilotKit + React UI | Plugin: Markdown + JSON + Bash (Claude Code native) | 2026-03 | No application runtime needed. Zero infrastructure. |
| V2: 25 named agents with router | Plugin: Larry as default agent + methodology commands | 2026-03 | User never "switches agents". Larry IS the session. |
| V2: Python StateGraph for orchestration | Plugin: ICM folder structure as orchestration | 2026-03 | No code. Folder structure IS the routing table. |
| V2: Supabase pgvector for Data Room | Plugin: Filesystem markdown files | 2026-03 | User owns all files. No external database. |
| V2: Real-time CopilotKit AG-UI sync | Plugin: Hook scripts + STATE.md | 2026-03 | Simpler, more reliable. Computed from truth. |

## Open Questions

1. **Agent `skills` field behavior**
   - What we know: Agent frontmatter can include a `skills` field that preloads named skills.
   - What's unclear: Does `skills` field in agent frontmatter actually work for plugin agents? Plugin agents have restrictions (hooks, mcpServers, permissionMode are ignored). Need to verify if `skills` field is also restricted.
   - Recommendation: Test empirically in Phase 1. If restricted, use CLAUDE.md to instruct Larry to load skills on first turn.

2. **Context budget exact numbers**
   - What we know: Target is 2% of context window. Sonnet is 200K tokens = ~4K token budget.
   - What's unclear: Exact token consumption of agent body + auto-loaded skills + hook context injection.
   - Recommendation: Build the agent and skills first, then profile with `--debug` flag. Adjust if over budget.

3. **Cowork 00_Context/ behavior**
   - What we know: SURF-02 requires a 00_Context/ directory for Cowork shared state.
   - What's unclear: How Cowork discovers and uses this directory. Is it automatic or does it need configuration?
   - Recommendation: Test on Cowork surface during Phase 1 implementation. Document findings.

4. **Hook script `run-hook.cmd` licensing**
   - What we know: Superpowers uses MIT license and the polyglot wrapper is a clever pattern.
   - What's unclear: Whether to copy the pattern or reimplement.
   - Recommendation: Reimplement the pattern (it's ~50 lines of standard bash/cmd). Same logic, our own code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework for Claude Code plugins) |
| Config file | None — plugins are tested by running Claude Code with `--plugin-dir` |
| Quick run command | `claude --plugin-dir /home/jsagi/MindrianOS-Plugin` |
| Full suite command | Test on all three surfaces: CLI, Desktop, Cowork |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLGN-01 | Install and Larry responds | manual | `claude --plugin-dir . "hello"` | N/A |
| PLGN-02 | Plugin manifest valid | manual | `claude plugin validate` (if available) | N/A |
| PLGN-03 | Help command works | manual | `/mindrian-os:help` in session | N/A |
| PLGN-04 | Status command works | manual | `/mindrian-os:status` in session | N/A |
| PLGN-05 | Context budget under 2% | manual | `claude --debug --plugin-dir .` and check logs | N/A |
| LARY-01 | Larry is default personality | manual | Start session, check voice | N/A |
| LARY-02 | Mode distribution visible | manual | Multi-turn conversation, assess mode variety | N/A |
| LARY-03 | Voice adapts by context | manual | Test early vs. late conversation turns | N/A |
| LARY-04 | V2 personality recognizable | manual | Compare responses to V2 Larry outputs | N/A |
| ROOM-01 | 8 sections created | manual | Run new-project, check filesystem | N/A |
| ROOM-02 | STATE.md computed from filesystem | manual | Add files to room/, check STATE.md updates on next session | N/A |
| ROOM-03 | SessionStart loads context | manual | Start session with existing room, verify Larry references prior work | N/A |
| ROOM-04 | Stop hook persists state | manual | End session, verify STATE.md updated | N/A |
| ROOM-05 | Room command shows overview | manual | `/mindrian-os:room view` | N/A |
| DEGS-01 | Works without external deps | manual | Remove .mcp.json, test full flow | N/A |
| DEGS-02 | References/ provides fallback | manual | Check references/ populated with index.md | N/A |
| DEGS-03 | Graceful degradation | manual | Test with no Brain, no LazyGraph | N/A |
| SURF-01 | Cross-surface identical | manual | Test same flow on CLI + Desktop + Cowork | N/A |
| SURF-02 | Cowork gets 00_Context/ | manual | Test new-project on Cowork, check for directory | N/A |

### Sampling Rate
- **Per task commit:** Quick manual test of changed component
- **Per wave merge:** Full flow test: install, new-project, multi-turn conversation, resume session
- **Phase gate:** All 19 requirements verified across all three surfaces

### Wave 0 Gaps
- None — Claude Code plugins have no automated test framework. All testing is manual via `claude --plugin-dir`. The "test infrastructure" is the plugin directory structure itself.

## Sources

### Primary (HIGH confidence)
- V2 Larry skill files (8 files, 51KB) — `/home/jsagi/MindrianV2/prompts/larry_skill/` — full personality source material
- V2 prompt registry (25 bots) — `/home/jsagi/MindrianV2/prompts/__init__.py` — complete bot list
- V4 Claude Desktop specs (16 files) — `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/` — methodology definitions
- V4 design docs (5 files) — `/home/jsagi/MindrianOS/docs/design/` — architecture reference
- V3 CLAUDE.md — `/home/jsagi/MindrianV3/CLAUDE.md` — "Skill Overlay" pattern validation
- Superpowers plugin v5.0.5 — `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/` — hook patterns, polyglot wrapper, session-start script
- Plugin.json + settings.json — existing in MindrianOS-Plugin — manifest and agent config
- THE-BRAIN.md — `/home/jsagi/MindrianOS-Plugin/docs/THE-BRAIN.md` — Brain interface definitions

### Secondary (MEDIUM confidence)
- [Visible.vc Data Room Guide](https://visible.vc/blog/startup-data-room/) — DD section structure
- [4Degrees VC Due Diligence Checklist 2026](https://www.4degrees.ai/blog/2025-venture-capital-due-diligence-checklist) — DD standards
- [GoingVC Data Room Checklist](https://www.goingvc.com/post/vc-checklist-guide-everything-investors-expect-in-your-data-room) — Investor expectations

### Tertiary (LOW confidence)
- Context budget exact numbers — estimated from V2 file sizes, needs empirical validation
- Cowork 00_Context/ behavior — inferred from SURF-02 requirement, needs hands-on testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official docs and working plugins
- Architecture: HIGH — follows proven patterns from superpowers, validated by V3 decisions
- Larry port: HIGH — all 8 V2 files examined, restructure plan documented, V3/V4 cross-checked
- DD alignment: HIGH — verified against multiple VC data room standards
- Pitfalls: HIGH — grounded in platform constraints and real plugin observations
- Open questions: 4 items flagged for empirical validation during implementation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable — plugin platform evolves slowly)
