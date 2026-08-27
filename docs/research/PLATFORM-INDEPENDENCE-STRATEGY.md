# MindrianOS Platform Independence Strategy

**Date:** 2026-04-09
**Sources:** Tavily deep search (3 rounds), Brain Neo4j, existing codebase audit
**Decision weight:** CRITICAL -- determines product direction

---

## The Three Pillars of Platform Independence

MindrianOS currently runs on Claude Code only. Three proven standards can make it run EVERYWHERE:

| Pillar | Standard | What It Does | Adoption |
|--------|----------|-------------|----------|
| **UI** | MCP Apps (ext-apps) | Interactive HTML inside any AI chat | Claude, ChatGPT, VS Code, Goose, Postman |
| **Discovery** | SKILL.md (agentskills.io) | Any agent finds and uses MindrianOS | Claude, Codex, OpenClaw, Gemini, Cursor, 26+ platforms |
| **Distribution** | CLI-Anything Hub + ClawHub + npm | Users install from any ecosystem | 28.8K stars (CLI-Hub), 13.7K skills (ClawHub) |

## Pillar 1: MCP Apps -- Visual Experience Everywhere

### What MindrianOS Already Has
- @modelcontextprotocol/ext-apps v1.5.0 in package.json
- 3 MCP Apps shipped (dashboard, wiki, graph) via lib/mcp/app-views.cjs
- registerAppTool + registerAppResource pattern in use
- bin/mindrian-mcp-server.cjs with 9 router tools, 66 commands

### What's Missing
- Existing apps are READ-ONLY (no callServerTool, no action buttons)
- No App class import in HTML templates (using manual postMessage)
- No CSP declarations for CDN resources
- No sendMessage or updateModelContext for bidirectional flow
- 3 apps out of potential 10+

### Upgrade Path (3 weeks)

**Week 1: Upgrade existing 3 apps**
- Import App class from ext-apps in all HTML templates
- Replace manual postMessage with app.connect() + app.ontoolresult
- Add callServerTool for data refresh
- Add CSP for Google Fonts + Cytoscape CDN
- Test on Claude Desktop + basic-host

**Week 2: Build Room Command Center (hero app)**
- Merge dashboard + status into Command Center
- Add APPROVE/REJECT/DEFER buttons (call room_content tools)
- Add mode selection widget
- Add "Suggested Next" panel
- Add section drill-down

**Week 3: Test cross-platform**
- Connect MCP server to ChatGPT via cloudflared tunnel
- Verify same dashboard renders on ChatGPT
- Screenshot proof of platform independence
- Test on VS Code Copilot

### Key APIs (validated via Tavily)

```javascript
// App class -- client-side in HTML
import { App } from "@modelcontextprotocol/ext-apps";
const app = new App();
await app.connect();

// Receive tool results
app.ontoolresult = (result) => { renderDashboard(result.data); };

// Call server tools from UI
const result = await app.callServerTool({
  name: "room_state",
  arguments: { command: "analyze" }
});

// Update model context silently
await app.updateModelContext({
  content: [{ type: "text", text: "User approved cascade #3" }]
});

// Send message as if user typed it
await app.sendMessage({
  role: "user",
  content: [{ type: "text", text: "I approved the impact on financial model" }]
});
```

```javascript
// Server-side registration
registerAppTool(server, 'room-command-center', {
  title: 'Room Command Center',
  schema: z.object({ action: z.string().optional() }),
  _meta: {
    ui: {
      resourceUri: 'ui://mindrian-os/command-center',
      csp: { resourceDomains: ['fonts.googleapis.com', 'cdn.jsdelivr.net'] }
    }
  }
}, handler);
```

### What MCP Apps CANNOT Replace
- SessionStart hooks (proactive intelligence at session start)
- PostToolUse hooks (cascade after every file write)
- File watchers (chokidar)
- Background processes

**Mitigation:** Lazy initialization on first tool call. Server-side catch-up computation.

---

## Pillar 2: SKILL.md -- Agent Discovery Everywhere

### The Standard (validated via Tavily)
- Open spec at agentskills.io (published Dec 2025 by Anthropic)
- 26+ platforms adopted: Claude Code, Codex CLI, OpenClaw, Gemini CLI, Cursor, VS Code Copilot, Goose, Windsurf, Amp, Factory, Roo Code, Trae, more
- Format: YAML frontmatter (name + description) + Markdown body
- Progressive disclosure: agents load only name+description at startup (~100 tokens), full body on activation

### What MindrianOS Already Has
- 20+ skills in skills/ directory (room-passive, room-proactive, larry-personality, etc.)
- These follow the SKILL.md format but are Claude Code-specific in their tool references

### What's Needed
- Generate agentskills.io-compliant SKILL.md files for every MindrianOS capability
- Package as installable skills on ClawHub (13.7K+ skills, vector search discovery)
- Register in CLI-Anything CLI-Hub (28.8K stars)
- Ensure cross-platform compatibility (no Claude-specific tool names in descriptions)

### Implementation

**MindrianOS meta-skill (discovery entry point):**
```yaml
---
name: mindrian-os
description: >
  AI innovation co-founder. PWS methodology teaching partner with Data Room,
  Opportunity Bank, and Brain knowledge graph. Use when user wants to explore
  a venture idea, diagnose a problem type, file a meeting, grade their venture,
  find opportunities, or build a Data Room. Installs 70+ methodology commands.
---
```

**Per-capability skills:**
```yaml
---
name: mindrian-diagnose
description: >
  Classify problem type (Undefined, Ill-Defined, Well-Defined, Wicked) and
  recommend methodology framework chain. Use when user says "what kind of
  problem is this", "diagnose my problem", "which framework should I use".
---
```

### Distribution Channels
1. **ClawHub:** `npx clawhub@latest install mindrian-os` (13.7K+ existing skills)
2. **CLI-Anything Hub:** Register as methodology CLI (28.8K stars, 41 CLIs, 23 categories)
3. **npm:** `npx mindrian-os --stdio` (standard MCP server install)
4. **agentskills.io registry:** Official cross-platform listing

### Security Note
ClawHub had 341 malicious skills found in Jan 2026 audit. MindrianOS should be verified publisher with signed skills.

---

## Pillar 3: CLI-Anything Compatibility -- Distribution at Scale

### What CLI-Anything Provides
- 7-phase pipeline for making software agent-native
- SKILL.md generation for every CLI
- CLI-Hub registry with 41+ CLIs across 23 categories
- Multi-platform: Claude Code, Codex, OpenClaw, Goose, Copilot
- --json flag for structured agent output
- REPL mode for stateful sessions

### What MindrianOS Adopts (interface patterns, not a rebuild)
1. **--json output mode** on mindrian-tools.cjs (agents parse reliably)
2. **CLI-Anything compatible SKILL.md** (discoverable by 28.8K star community)
3. **CLI-Hub registration** as first methodology/innovation tool in the registry
4. **REPL mode** for mindrian-tools.cjs (room context persists between commands)

### What MindrianOS Does NOT Adopt
- Python Click framework (we use Node.js CJS)
- 7-phase generation pipeline (we already have the CLI)
- Their test framework (we have our own)

---

## The Combined Architecture

```
                    MindrianOS v2.0
                    ===============

   Pillar 1: MCP Apps          Pillar 2: SKILL.md         Pillar 3: Distribution
   (Visual Experience)         (Agent Discovery)          (Reach)
   
   Room Command Center         mindrian-os meta-skill     ClawHub (13.7K skills)
   Knowledge Explorer          70+ per-command skills     CLI-Hub (28.8K stars)
   Methodology Workbench       agentskills.io compliant   npm (npx mindrian-os)
   Meeting Studio              Cross-platform portable    .mcpb Desktop Extension
   Opportunity Board                                      Claude Marketplace
   
         |                            |                          |
         v                            v                          v
   +---------------------------------------------------------+
   |         MindrianOS MCP Server                           |
   |         (bin/mindrian-mcp-server.cjs)                   |
   |                                                         |
   |  Tool Router (11 tools, ~64 commands; see test-234)     |
   |  MCP Apps (ui:// resources, 7+ HTML views)              |
   |  lib/core/* (shared business logic)                     |
   |  Brain client (remote MCP)                              |
   +---------------------------------------------------------+
         |                            |
         v                            v
   +------------------+     +------------------+
   | Room filesystem   |     | Brain MCP        |
   | (user's data)     |     | (brain.mindrian  |
   +------------------+     |  .ai - remote)   |
                             +------------------+

   Runs on: Claude Code (full power + hooks)
            Claude Desktop (MCP Apps + tools)
            ChatGPT (MCP Apps + tools)
            VS Code Copilot (MCP Apps + tools)
            Goose (MCP Apps + tools)
            Codex CLI (SKILL.md + tools)
            OpenClaw (SKILL.md + tools)
            Cursor (SKILL.md + tools)
            Any MCP-compliant client
```

---

## Business Impact

### Before (current)
- Locked to Claude Code
- Distribution: Claude marketplace only
- Users: Claude Code subscribers only
- Risk: Anthropic changes break everything

### After (with 3 pillars)
- Runs on 10+ platforms
- Distribution: 5+ channels (ClawHub, CLI-Hub, npm, marketplace, .mcpb)
- Users: Anyone with ANY AI subscription
- Risk: Distributed across platforms, no single dependency
- Moat preserved: Brain (21K nodes), grading calibration, methodology chaining stay server-side

### Timeline
- Phase 0 (1 week): Upgrade existing MCP Apps + generate SKILL.md files
- Phase 1 (2 weeks): Room Command Center + cross-platform test
- Phase 2 (2 weeks): 4 more MCP Apps + ClawHub/CLI-Hub registration
- Phase 3 (1 week): npm package + .mcpb + ChatGPT connector
- Total: 6 weeks to full platform independence

---

## Recommendation

DO ALL THREE. They're complementary, not competing:
- MCP Apps = how users SEE MindrianOS (visual)
- SKILL.md = how agents FIND MindrianOS (discovery)
- CLI-Anything/ClawHub/npm = how users GET MindrianOS (distribution)

The moat (Brain + methodology chaining + grading calibration) stays server-side regardless of which pillar delivers the experience. The UI can be copied. The intelligence graph cannot.

Start with Phase 0 (1 week): upgrade existing apps + generate cross-platform SKILL.md. That alone proves the architecture works on ChatGPT.
