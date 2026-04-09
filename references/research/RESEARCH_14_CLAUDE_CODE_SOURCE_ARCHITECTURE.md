# RESEARCH_14: Claude Code Source Architecture - Plugin Optimization Intelligence

**Date:** 2026-04-05
**Source:** ccleaks.com (analysis of npm .map file leak, March 31 2026)
**Verified by:** Anthropic confirmed packaging error; security firms (Zscaler, Trend Micro, Bitdefender) analyzed malware variants
**Purpose:** Identify Claude Code internal patterns MindrianOS can align with for maximum integration

---

## 1. Background

On March 31, 2026, Anthropic accidentally shipped a 59.8MB JavaScript source map file inside `@anthropic-ai/claude-code` npm package v2.1.88. The Bun runtime generates full source maps by default, and the `.map` file was not excluded via `.npmignore`. This exposed ~513,000 lines of unobfuscated TypeScript across 1,906 files.

Anthropic confirmed: "A release packaging issue caused by human error, not a security breach."

The analysis site ccleaks.com catalogs the findings. Multiple fake repos (e.g., `leaked-claude-code/leaked-claude-code`) weaponized the event to distribute Vidar/GhostSocks malware via trojanized .7z binaries. Only ccleaks.com provides safe, read-only analysis.

---

## 2. Claude Code Internal Architecture

### 2.1 Major Directory Structure (from source)

| Directory | Purpose |
|-----------|---------|
| `coordinator/` | Conversation orchestration, multi-agent dispatch |
| `tools/` | 18+ specialized tools (bash, file ops, web, MCP) |
| `commands/` | 80+ slash commands |
| `services/` | API client, MCP management, authentication |
| `ink/` | Custom terminal UI (React-based rendering engine) |

### 2.2 Coordinator / Multi-Agent System

- Coordinator Mode breaks tasks into parallel pieces, assigns to worker agents
- Protocol: `<task-notification>` XML
- Worker isolation via scratch directories (`tengu_scratch` feature gate)
- Worker continuation via `SendMessage`
- CLI flags: `--spawn` (multi-agent mode), `--capacity <n>` (max parallel workers)
- Env: `CLAUDE_CODE_COORDINATOR_MODE=1`

### 2.3 Tool Dispatch Pipeline

- YOLO classifier (`classifyYoloAction()`) decides auto-approval
- Risk levels: LOW / MEDIUM / HIGH
- System uses Claude to evaluate its own tool use
- Bypass: `DISABLE_COMMAND_INJECTION_CHECK` (dangerous)

### 2.4 Memory Systems

**KAIROS (Persistent Assistant):**
- Feature gate: `feature('KAIROS')` + `tengu_kairos`
- Daily logs: `~/.claude/.../logs/YYYY/MM/DD.md`
- Four dream phases: Orient, Gather, Consolidate, Prune
- 15s max blocking budget, auto-backgrounds

**Auto-Dream (Memory Consolidation):**
- Triggers when: >=24h + >=5 sessions since last dream
- Output limit: <25KB
- Consolidates cross-session patterns

### 2.5 UDS Inbox (Inter-Process Messaging)

Cross-session IPC for multiple local Claude instances:
- Teammate syntax: `to: "researcher"`
- Local socket: `to: "uds:/.../sock"`
- Remote: `to: "bridge:..."`
- Peer discovery: `ListPeersTool` reads `~/.claude/sessions/`

### 2.6 Slash Command System

26 hidden/internal commands identified:
- `/ctx-viz` - context visualization
- `/ultraplan` - 30-minute autonomous planning
- `/dream` - memory consolidation trigger
- `/debug-tool-call` - raw JSON tool I/O
- `/agents-platform` - internal agent management dashboard
- Commands appear hard-coded, not dynamically registered

### 2.7 MCP Integration

- `tengu_harbor` feature gate = MCP allowlist
- `--computer-use-mcp` - Computer Use MCP server
- `--claude-in-chrome-mcp` - Chrome automation via MCP
- No public plugin API documented - integration is via tool registration

---

## 3. Feature Flags (32+ Build-Time)

### 3.1 Named Features

| Flag | Purpose | Status |
|------|---------|--------|
| KAIROS | Persistent memory across sessions | Gated |
| BUDDY | AI companion pet with species/stats | Unreleased |
| ULTRAPLAN | 30-min autonomous planning | Gated |
| VOICE_MODE | Push-to-talk interface | Compile false |
| BRIDGE_MODE | Remote control bridging | Gated |
| AUTO_DREAM | Memory consolidation | Gated |
| DAEMON_MODE | Background session management | Gated |
| COORDINATOR | Multi-agent task management | Gated |

### 3.2 GrowthBook Gates (tengu_* namespace)

| Gate | Controls |
|------|----------|
| `tengu_harbor` | MCP allowlist |
| `tengu_kairos` | Persistent memory |
| `tengu_ultraplan_model` | Planning model selection |
| `tengu_cobalt_raccoon` | Auto-compact behavior |
| `tengu_portal_quail` | Memory extraction |
| `tengu_scratch` | Worker scratch directories |
| `tengu_malort_pedway` | Computer use |

---

## 4. Environment Variables

### 4.1 Runtime Overrides (Safe)

| Variable | Effect |
|----------|--------|
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Override context window |
| `AUTOCOMPACT_PCT_OVERRIDE` | Override compact threshold |
| `CLAUDE_CODE_COORDINATOR_MODE=1` | Activate multi-agent |

### 4.2 Internal/Dangerous (Do Not Use)

| Variable | Effect |
|----------|--------|
| `USER_TYPE=ant` | Unlock all internal features |
| `CLAUDE_CODE_UNDERCOVER` | Undercover mode |
| `CLAUDE_CODE_ABLATION_BASELINE=1` | Disable ALL safety features |
| `DISABLE_COMMAND_INJECTION_CHECK` | Skip injection guard |
| `DISABLE_INTERLEAVED_THINKING` | Disable thinking |

---

## 5. MindrianOS Alignment Analysis

### 5.1 What's Already Aligned

| MindrianOS Pattern | Claude Code Internal | Alignment |
|--------------------|---------------------|-----------|
| 8 lifecycle hooks (hooks.json) | Internal hook events | STRONG - matches SessionStart, PreCompact, PostCompact, PostToolUse, CwdChanged, SubagentStop |
| Hierarchical MCP router (6 tools, 49 commands) | Token budget awareness | STRONG - stays under context limits |
| Agent isolation (framework-runner) | Coordinator worker isolation | STRONG - same dispatch pattern |
| Markdown-first commands | Internal command loading | STRONG - native format |
| PreCompact/PostCompact context preservation | Auto-compact system | ALIGNED - hooks into the right events |
| CwdChanged multi-room switching | Session context updates | ALIGNED - piggybacks on internal events |

### 5.2 Optimization Opportunities

**HIGH PRIORITY:**

1. **KAIROS Piggyback** - When `tengu_kairos` goes live, `context-engine` skill should detect KAIROS daily logs and read them instead of rebuilding from STATE.md. Path: `~/.claude/.../logs/YYYY/MM/DD.md`. Eliminates cold-start context loss.

2. **Coordinator Worker Pattern** - When `CLAUDE_CODE_COORDINATOR_MODE=1` becomes available, refactor `/mos:act` to dispatch framework-runner + brain-query + research agents as parallel Coordinator workers instead of sequential subagent calls. Use `--capacity` to control swarm size.

3. **UDS Inter-Agent Messaging** - When UDS inbox goes live, enable brain-query agent to push results directly to framework-runner via `to: "uds:/.../sock"` without roundtripping through orchestrator. Reduces token overhead.

4. **Autocompact Tuning** - Use `AUTOCOMPACT_PCT_OVERRIDE` to extend context window before compact fires. Gives MindrianOS more working memory before PreCompact hook needs to snapshot.

**MEDIUM PRIORITY:**

5. **tengu_harbor MCP Compatibility** - Ensure `mindrian-mcp-server.cjs` passes whatever validation the MCP allowlist requires. Monitor for schema changes.

6. **Memory Extraction (tengu_portal_quail)** - When active, could replace or augment the manual USER.md / MEMORY.md system with native extraction.

7. **Task Notification XML** - Coordinator uses `<task-notification>` protocol. Prepare agent output formats to be compatible if MindrianOS agents ever run as Coordinator workers.

**WATCH LIST:**

8. **ULTRAPLAN** - 30-min autonomous planning could replace `/mos:act` chain mode for complex methodology sequences
9. **DAEMON_MODE** - Background persistent sessions could enable always-on room monitoring
10. **BUDDY** - AI companion concept maps to room-proactive intelligence persona

### 5.3 What NOT to Do

- Do NOT use `USER_TYPE=ant` or safety bypass variables
- Do NOT attempt to activate gated features via env vars - they require server-side GrowthBook flags
- Do NOT distribute or reference the malware repo - only ccleaks.com for analysis
- Do NOT build dependencies on unreleased features - build compatible patterns that activate when features go live

---

## 6. Malware Warning

The GitHub repo `leaked-claude-code/leaked-claude-code` distributes:
- **Vidar v18.7** - information stealer (credentials, credit cards, browser data)
- **GhostSocks** - turns machine into criminal proxy node
- Delivered via `ClaudeCode_x64.7z` binary in GitHub Releases
- 790 stars / 987 forks (bot-inflated)
- Account created same day as leak, single repo, no history

Confirmed by: Zscaler ThreatLabz, Trend Micro, Bitdefender, BleepingComputer, Help Net Security.

**Only safe source for analysis: ccleaks.com**

---

## 7. Action Items

- [ ] Monitor ccleaks.com for new feature flag discoveries
- [ ] Add KAIROS detection to context-engine skill (future-proof)
- [ ] Prepare Coordinator-compatible agent output schemas
- [ ] Test `AUTOCOMPACT_PCT_OVERRIDE` impact on hook timing
- [ ] Validate MCP server against upcoming tengu_harbor requirements
- [ ] File follow-up research when any tengu_* gate goes live
