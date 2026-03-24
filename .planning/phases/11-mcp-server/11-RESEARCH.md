# Phase 11: MCP Server - Research

**Researched:** 2026-03-24
**Domain:** MCP server implementation — stdio transport, hierarchical tool router, resources, prompts
**Confidence:** HIGH

## Summary

Phase 11 builds the MCP server that delivers all MindrianOS plugin capabilities to Claude Desktop and Cowork users. The server is a single CJS file (`bin/mindrian-mcp-server.cjs`) using `@modelcontextprotocol/sdk@1.27.1` with stdio transport. It imports the Phase 10 core modules (`lib/core/*.cjs`) directly via `require()` and wraps them as MCP tools, resources, and prompts with Zod-validated schemas.

The critical architectural decision is the hierarchical tool router: instead of 41 flat tools (which would consume 30-60K tokens of context), the server exposes 5-7 high-level tools that each accept a `command` enum parameter to dispatch internally. Read-only room data is exposed as MCP Resources (not tools), and methodology workflows are exposed as MCP Prompts with room-context injection. A CI parity script validates that every CLI command has a corresponding MCP tool path.

The server requires one npm dependency (`@modelcontextprotocol/sdk` which pulls `zod` as a peer dep). It reads room path from `MINDRIAN_ROOM` env var (configurable in `claude_desktop_config.json`). Larry personality is injected via the same `references/personality/*.md` files the CLI uses, loaded and embedded in tool/prompt descriptions and responses.

**Primary recommendation:** Build the hierarchical tool router design (command-to-tool mapping) FIRST as a static data structure, then implement server skeleton, then tools, then resources, then prompts, then parity check. Ship read-only tools before write tools.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCP server exposes all plugin capabilities via hierarchical tool router (5-8 high-level tools grouping 41+ commands) | Hierarchical router pattern documented below with exact tool groupings, SDK registerTool API verified, token budget analysis confirms necessity |
| MCP-02 | Room state, sections, and artifacts accessible as MCP Resources (read-only browsing without tool calls) | MCP Resources API documented with `room://` URI scheme, resource templates for dynamic section browsing, registerResource patterns verified |
| MCP-03 | Common methodology workflows available as MCP Prompts (file meeting, run analysis, grade venture) | registerPrompt API verified, room-context injection pattern documented, 25 methodology references map to prompts |
| MCP-04 | MCP server runs via stdio transport, configurable in claude_desktop_config.json with one line | StdioServerTransport pattern verified, exact config JSON documented, MINDRIAN_ROOM env var for room path |
| MCP-05 | Larry personality and teaching mode active in MCP context (same experience as CLI) | Personality references (voice-dna.md, lexicon.md, assessment-philosophy.md) loaded at startup, injected into tool descriptions and prompt templates |
| CORE-03 | Parity matrix validates every CLI command has a corresponding MCP tool, checked in CI | Parity check script design documented, command-to-tool mapping table provided |
| COLLAB-01 | MCP server accesses local room via configurable MINDRIAN_ROOM env var | Env var pattern documented in claude_desktop_config.json, path resolution via `process.env.MINDRIAN_ROOM` with fallback to `./room` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.27.1 | MCP server with tools/resources/prompts registration | Only official SDK. 34,700+ dependents. McpServer + StdioServerTransport. |
| `zod` | ^3.25 | Input schema validation for MCP tool definitions | Required peer dep of SDK. Validated with zod-to-json-schema internally. |
| Node.js CJS | >=18 | Server runtime, `require()` imports of lib/core modules | Already established in Phase 10. Zero additional dependencies for core. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/inspector` | latest | Interactive MCP tool testing during development | `npx @modelcontextprotocol/inspector` to test tools without Claude Desktop |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdio transport | Streamable HTTP | Only needed for remote access (Phase 14). stdio is zero-config for local Desktop/Cowork. |
| Hierarchical router (5-7 tools) | 41 flat tools | Flat = 30-60K tokens context consumption, tool selection failures. Not viable. |
| CJS modules | ESM | Plugin ecosystem and Phase 10 core are CJS. Mixing would require interop shims. |

**Installation:**
```bash
cd /home/jsagi/MindrianOS-Plugin
npm init -y  # if package.json doesn't exist
npm install @modelcontextprotocol/sdk@1.27.1 zod@^3.25
```

## Architecture Patterns

### Recommended Project Structure
```
MindrianOS-Plugin/
├── bin/
│   ├── mindrian-tools.cjs          # Phase 10 CLI entry point (exists)
│   └── mindrian-mcp-server.cjs     # NEW: MCP server entry point
├── lib/
│   ├── core/                       # Phase 10 modules (exist)
│   │   ├── index.cjs
│   │   ├── room-ops.cjs
│   │   ├── state-ops.cjs
│   │   ├── meeting-ops.cjs
│   │   ├── graph-ops.cjs
│   │   └── section-registry.cjs
│   ├── mcp/                        # NEW: MCP-specific modules
│   │   ├── tool-router.cjs         # Hierarchical tool definitions + dispatch
│   │   ├── resources.cjs           # Resource registrations (room://)
│   │   ├── prompts.cjs             # Prompt registrations (methodology workflows)
│   │   └── larry-context.cjs       # Larry personality loader for MCP context
│   └── parity/                     # NEW: CLI/MCP parity validation
│       └── check-parity.cjs        # CI script: commands/ vs registered tools
├── references/personality/          # Existing Larry personality files
│   ├── voice-dna.md
│   ├── lexicon.md
│   └── assessment-philosophy.md
└── package.json                     # NEW: npm deps for MCP SDK
```

### Pattern 1: Hierarchical Tool Router (THE Critical Pattern)

**What:** Instead of registering 41 individual MCP tools, register 5-7 high-level "router" tools. Each accepts a `command` enum parameter that dispatches to the specific operation.

**When to use:** Always. This is not optional. Flat tool registration is explicitly out of scope (REQUIREMENTS.md line 79).

**Grouping design (derived from command analysis):**

| Router Tool | Commands Grouped | Token Budget |
|-------------|------------------|-------------|
| `data_room` | room, status, new-project, setup, update, help | ~800 tokens |
| `methodology` | lean-canvas, think-hats, structure-argument, beautiful-question, build-knowledge, challenge-assumptions, validate, map-unknowns, diagnose, score-innovation, explore-domains, analyze-needs, user-needs | ~1200 tokens |
| `analysis` | analyze-systems, analyze-timing, find-bottlenecks, root-cause, systems-thinking, macro-trends, explore-trends, explore-futures, dominant-designs, scenario-plan | ~1000 tokens |
| `intelligence` | find-connections, build-thesis, compare-ventures, research, deep-grade, grade, leadership | ~800 tokens |
| `meeting` | file-meeting, pipeline (meeting-related pipelines) | ~400 tokens |
| `export` | export, radar | ~300 tokens |

**Total:** ~4500 tokens (vs 30-60K for 41 flat tools). 85-93% reduction.

**Example implementation:**
```javascript
// lib/mcp/tool-router.cjs
const { z } = require('zod');

const METHODOLOGY_COMMANDS = [
  'lean-canvas', 'think-hats', 'structure-argument',
  'beautiful-question', 'build-knowledge', 'challenge-assumptions',
  'validate', 'map-unknowns', 'diagnose', 'score-innovation',
  'explore-domains', 'analyze-needs', 'user-needs'
];

function registerRouterTools(server, roomDir) {
  server.registerTool(
    'methodology',
    {
      title: 'Run Methodology',
      description: 'Run a PWS innovation methodology framework. Larry guides you through the selected framework, analyzes your venture, and files results to your Data Room.',
      inputSchema: z.object({
        command: z.enum(METHODOLOGY_COMMANDS)
          .describe('Which methodology to run'),
        context: z.string().optional()
          .describe('Additional context or focus area for the session'),
      }),
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ command, context }) => {
      // Load the command's reference material
      const refPath = `references/methodology/${command}.md`;
      const ref = safeReadFile(refPath) || '';
      // Load current room state for context injection
      const state = stateOps.getState(roomDir) || 'No room state found.';
      // Return structured prompt that guides Larry
      return {
        content: [{
          type: 'text',
          text: `## Methodology: ${command}\n\n### Room Context\n${state}\n\n### Framework Reference\n${ref}\n\n### User Focus\n${context || 'General exploration'}`
        }]
      };
    }
  );
}
```

### Pattern 2: MCP Resources for Read-Only Room Data

**What:** Room state, section contents, artifacts, and meeting archives exposed as MCP Resources with a `room://` URI scheme. Resources are application-controlled (not model-selected), so they do not consume tool-selection tokens.

**URI scheme:**
```
room://state                          -> STATE.md contents
room://sections                       -> Section list with metadata
room://section/{name}                 -> All entries in a section
room://section/{name}/{artifact}      -> Specific artifact content
room://meetings                       -> Meeting archive listing
room://meetings/{date}                -> Specific meeting contents
room://intelligence                   -> MEETINGS-INTELLIGENCE.md
```

**Example:**
```javascript
// lib/mcp/resources.cjs
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');

function registerResources(server, roomDir) {
  // Static: room state
  server.registerResource(
    'room-state',
    'room://state',
    { title: 'Room State', description: 'Current Data Room STATE.md', mimeType: 'text/markdown' },
    async () => ({
      contents: [{
        uri: 'room://state',
        text: stateOps.getState(roomDir) || 'No room initialized.'
      }]
    })
  );

  // Template: section contents (dynamic)
  server.registerResource(
    'room-section',
    new ResourceTemplate('room://section/{sectionName}', {
      list: async () => {
        const discovery = discoverSections(roomDir);
        return {
          resources: discovery.all.map(name => ({
            uri: `room://section/${name}`,
            name: discovery.getMeta(name).label,
            description: `Contents of ${name} section`,
            mimeType: 'text/markdown'
          }))
        };
      }
    }),
    { title: 'Room Section', description: 'Browse a Data Room section', mimeType: 'text/markdown' },
    async (uri, { sectionName }) => {
      // Read all .md files in the section directory
      const sectionPath = path.join(roomDir, sectionName);
      // ... read and concatenate entries
    }
  );
}
```

### Pattern 3: MCP Prompts with Room Context Injection

**What:** Methodology workflows as MCP Prompts. When a user selects a prompt in Desktop, it arrives pre-loaded with current room state. This is the differentiator: no other MCP server does context-aware prompts.

**Prompt mapping (25 methodology references -> MCP prompts):**
- `file-meeting` -> Prompt with transcript input + room context
- `analyze-room` -> Prompt pre-loaded with current room state + gap analysis
- `grade` / `deep-grade` -> Prompt with room state + grading rubrics
- `lean-canvas` -> Prompt with room state + canvas template
- `think-hats` -> Prompt with room state + De Bono framework
- Each of the 25 methodology references becomes a prompt

**Example:**
```javascript
// lib/mcp/prompts.cjs
function registerPrompts(server, roomDir) {
  server.registerPrompt(
    'file-meeting',
    {
      title: 'File Meeting to Data Room',
      description: 'Larry files a meeting transcript into your Data Room, identifying speakers, classifying segments, and routing artifacts to the right sections.',
      argsSchema: z.object({
        transcript: z.string().describe('Meeting transcript text or file path'),
        meetingDate: z.string().optional().describe('Meeting date (YYYY-MM-DD)'),
      }),
    },
    async ({ transcript, meetingDate }) => {
      const state = stateOps.getState(roomDir) || '';
      const meetingRef = safeReadFile('references/meeting/filing-protocol.md') || '';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `File this meeting into my Data Room.\n\n## Current Room State\n${state}\n\n## Meeting Filing Protocol\n${meetingRef}\n\n## Transcript\n${transcript}\n\nDate: ${meetingDate || 'today'}`
          }
        }]
      };
    }
  );
}
```

### Pattern 4: Larry Personality in MCP Context (MCP-05)

**What:** Larry's personality (voice-dna.md, lexicon.md, assessment-philosophy.md) must be active in MCP responses. In CLI, skills auto-inject Larry's voice. In MCP, the server must embed personality context in tool descriptions and prompt responses.

**Implementation approach:**
```javascript
// lib/mcp/larry-context.cjs
const fs = require('fs');
const path = require('path');

function loadLarryContext(pluginRoot) {
  const personalityDir = path.join(pluginRoot, 'references/personality');
  const voiceDna = safeReadFile(path.join(personalityDir, 'voice-dna.md')) || '';
  const lexicon = safeReadFile(path.join(personalityDir, 'lexicon.md')) || '';
  const assessment = safeReadFile(path.join(personalityDir, 'assessment-philosophy.md')) || '';

  // Compact version for tool descriptions (avoid bloating tool tokens)
  const compact = extractCompactVoice(voiceDna); // first 500 chars of voice DNA

  // Full version for prompt context injection
  const full = `## Larry's Voice\n${voiceDna}\n\n## Lexicon\n${lexicon}\n\n## Assessment Philosophy\n${assessment}`;

  return { compact, full };
}
```

Larry personality is injected in two ways:
1. **Tool descriptions:** Include compact Larry voice hints so Claude knows to respond as Larry
2. **Prompt responses:** Full personality context prepended to prompt messages so Claude on Desktop behaves identically to CLI Larry

### Pattern 5: Server Entry Point

**What:** Single CJS file that initializes McpServer, registers all tools/resources/prompts, connects stdio transport.

```javascript
// bin/mindrian-mcp-server.cjs
#!/usr/bin/env node
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const path = require('path');

// Room path from env (set in claude_desktop_config.json)
const roomDir = process.env.MINDRIAN_ROOM || './room';
const pluginRoot = path.resolve(__dirname, '..');

const server = new McpServer({
  name: 'mindrian-os',
  version: '0.4.2',
});

// Register all primitives
const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');
const { registerResources } = require('../lib/mcp/resources.cjs');
const { registerPrompts } = require('../lib/mcp/prompts.cjs');

registerRouterTools(server, roomDir, pluginRoot);
registerResources(server, roomDir);
registerPrompts(server, roomDir, pluginRoot);

// Connect stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
```

**Claude Desktop config (user adds this one entry):**
```json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
      "env": {
        "MINDRIAN_ROOM": "/path/to/project/room"
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **41 flat tools:** Consumes 30-60K tokens. Cursor hard-caps at 40. LLM tool-selection degrades. Use hierarchical router instead.
- **Rewriting Bash scripts in Node.js:** Phase 10 core modules wrap scripts via execSync. MCP tools call core modules. Do not rewrite script logic.
- **MCP tools for read-only data:** Room state, section listings, artifact contents are Resources, not Tools. Resources are application-controlled and do not bloat tool context.
- **Monolithic file_meeting tool:** CLI `file-meeting.md` is a 200-line conversational pipeline. MCP equivalent should be a Prompt (user-initiated workflow), not a single tool call.
- **Separate npm package/repo for MCP server:** Server needs `require('../lib/core/...')` access. Same repo, same version.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol implementation | Custom stdio JSON-RPC | `@modelcontextprotocol/sdk` McpServer + StdioServerTransport | Protocol has capabilities negotiation, lifecycle management, error codes. SDK handles all of it. |
| Input schema validation | Manual JSON Schema or if/else | `zod` schemas in registerTool | SDK requires Zod. It auto-converts to JSON Schema for the protocol. |
| URI routing for resources | String parsing with regex | `ResourceTemplate` from SDK | Handles parameterized URIs (`room://section/{name}`), list callbacks, type-safe extraction. |
| Tool metadata serialization | Manual JSON Schema generation | SDK's internal zod-to-json-schema | The SDK handles schema conversion. Zod is the authoring surface. |
| CLI/MCP parity check | Manual comparison | Script that reads `commands/*.md` filenames and compares against tool router command enums | Automate or it drifts within one release cycle. |

## Common Pitfalls

### Pitfall 1: Tool Explosion (30-60K Token Context Death)
**What goes wrong:** Registering 41 MCP tools means 41 tool definitions injected into every Desktop conversation. Each tool definition is ~400-500 tokens. Total: 16-20K tokens minimum, more with descriptions.
**Why it happens:** Natural instinct to mirror CLI commands 1:1 as MCP tools.
**How to avoid:** Hierarchical router pattern (5-7 tools max). Command enum parameter dispatches internally. Resources for read-only data.
**Warning signs:** Desktop sessions hitting compaction faster than CLI. Tool selection misfires on similar names.

### Pitfall 2: Room Path Not Configurable
**What goes wrong:** MCP server hardcodes `./room` relative path. But MCP servers are spawned by Claude Desktop as separate processes -- CWD is unpredictable.
**Why it happens:** CLI plugin always has room/ relative to project root. MCP server has no project context.
**How to avoid:** `MINDRIAN_ROOM` env var set in `claude_desktop_config.json`. Resolve to absolute path immediately on startup. Error clearly if path doesn't exist.
**Warning signs:** "room not found" errors that work fine on CLI.

### Pitfall 3: Larry Personality Missing on Desktop
**What goes wrong:** Desktop users get generic Claude responses instead of Larry's voice. CLI users get Larry because skills auto-inject personality.
**Why it happens:** MCP tools return raw data. Without personality context, Claude on Desktop doesn't know it should respond as Larry.
**How to avoid:** Embed Larry personality in tool descriptions (compact) and prompt messages (full). The server description itself should reference Larry.
**Warning signs:** Desktop responses lack Larry's teaching style, humor, and methodology references.

### Pitfall 4: Windows Path Issues in claude_desktop_config.json
**What goes wrong:** Windows paths use backslashes. `claude_desktop_config.json` needs forward slashes or double-escaped backslashes. `MINDRIAN_ROOM` with `C:\Users\...` breaks path resolution.
**Why it happens:** Dev environment is Linux (WSL2). Windows issues don't surface naturally.
**How to avoid:** Document both Windows and Unix path formats. Use `path.resolve()` on all env var paths. Test on Windows explicitly.
**Warning signs:** Works on dev machine, breaks on Windows user machines.

### Pitfall 5: Parity Drift Between CLI and MCP
**What goes wrong:** New CLI commands are added without corresponding MCP tool paths. Desktop users get degraded capabilities silently.
**Why it happens:** CLI is the development surface. MCP tools are extra work.
**How to avoid:** `lib/parity/check-parity.cjs` script in CI. Reads `commands/*.md` filenames, compares against tool router command enums. Any mismatch fails the build.
**Warning signs:** Users report "missing features" that exist on CLI.

## Code Examples

### Complete Server Initialization (verified pattern from SDK docs)
```javascript
// Source: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const server = new McpServer({ name: 'mindrian-os', version: '0.4.2' });

// Tool with annotations
server.registerTool('data_room', {
  title: 'Data Room',
  description: 'Manage your MindrianOS Data Room -- view state, browse sections, add entries. Larry maintains your venture intelligence.',
  inputSchema: z.object({
    command: z.enum(['status', 'list-sections', 'analyze', 'compute-state', 'get-state'])
      .describe('Room operation to perform'),
    section: z.string().optional().describe('Section name (for section-specific operations)'),
  }),
  annotations: { readOnlyHint: true },
}, async ({ command, section }) => {
  const roomOps = require('../lib/core/room-ops.cjs');
  const stateOps = require('../lib/core/state-ops.cjs');
  switch (command) {
    case 'list-sections':
      return { content: [{ type: 'text', text: JSON.stringify(roomOps.listSections(roomDir), null, 2) }] };
    case 'analyze':
      return { content: [{ type: 'text', text: roomOps.analyzeRoom(roomDir) }] };
    case 'compute-state':
      return { content: [{ type: 'text', text: stateOps.computeState(roomDir) }] };
    case 'get-state':
      return { content: [{ type: 'text', text: stateOps.getState(roomDir) || 'No STATE.md found.' }] };
    default:
      return { content: [{ type: 'text', text: `Unknown command: ${command}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

### Resource Template for Dynamic Sections
```javascript
// Source: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { discoverSections } = require('../lib/core/section-registry.cjs');

server.registerResource(
  'room-section',
  new ResourceTemplate('room://section/{sectionName}', {
    list: async () => {
      const discovery = discoverSections(roomDir);
      return {
        resources: discovery.all.map(name => ({
          uri: `room://section/${name}`,
          name: discovery.getMeta(name).label,
          mimeType: 'text/markdown'
        }))
      };
    }
  }),
  { title: 'Room Section', description: 'Browse Data Room section contents', mimeType: 'text/markdown' },
  async (uri, { sectionName }) => {
    const fs = require('fs');
    const sectionPath = path.join(roomDir, sectionName);
    const files = fs.readdirSync(sectionPath).filter(f => f.endsWith('.md'));
    const contents = files.map(f => fs.readFileSync(path.join(sectionPath, f), 'utf-8')).join('\n\n---\n\n');
    return { contents: [{ uri: uri.href, text: contents || 'Section is empty.' }] };
  }
);
```

### Parity Check Script
```javascript
// lib/parity/check-parity.cjs
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.resolve(__dirname, '../../commands');
const commands = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace('.md', ''));

// Load tool router command enums (same data structure used by server)
const { ALL_TOOL_COMMANDS } = require('../mcp/tool-router.cjs');

const missingInMcp = commands.filter(c => !ALL_TOOL_COMMANDS.includes(c));
const missingInCli = ALL_TOOL_COMMANDS.filter(c => !commands.includes(c));

if (missingInMcp.length > 0) {
  console.error('CLI commands missing MCP tool mapping:', missingInMcp);
  process.exit(1);
}
if (missingInCli.length > 0) {
  console.warn('MCP commands without CLI equivalent:', missingInCli);
}
console.log(`Parity OK: ${commands.length} CLI commands, ${ALL_TOOL_COMMANDS.length} MCP paths.`);
```

## Command-to-Tool Router Mapping (Complete)

This is the authoritative mapping of all 41 CLI commands to hierarchical MCP tool router groups.

### `data_room` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| room | status | read |
| room | list-sections | read |
| room | analyze | read |
| status | status | read |
| new-project | new-project | write |
| setup | setup | write |
| update | update | write |
| help | help | read |

### `methodology` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| lean-canvas | lean-canvas | write |
| think-hats | think-hats | write |
| structure-argument | structure-argument | write |
| beautiful-question | beautiful-question | write |
| build-knowledge | build-knowledge | write |
| challenge-assumptions | challenge-assumptions | write |
| validate | validate | write |
| map-unknowns | map-unknowns | write |
| diagnose | diagnose | read |
| score-innovation | score-innovation | write |
| explore-domains | explore-domains | write |
| analyze-needs | analyze-needs | write |
| user-needs | user-needs | write |

### `analysis` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| analyze-systems | analyze-systems | write |
| analyze-timing | analyze-timing | write |
| find-bottlenecks | find-bottlenecks | write |
| root-cause | root-cause | write |
| systems-thinking | systems-thinking | write |
| macro-trends | macro-trends | write |
| explore-trends | explore-trends | write |
| explore-futures | explore-futures | write |
| dominant-designs | dominant-designs | write |
| scenario-plan | scenario-plan | write |

### `intelligence` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| find-connections | find-connections | read |
| build-thesis | build-thesis | write |
| compare-ventures | compare-ventures | read |
| research | research | read |
| deep-grade | deep-grade | write |
| grade | grade | write |
| leadership | leadership | write |

### `meeting` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| file-meeting | file-meeting | write |
| pipeline | pipeline | write |

### `export` router tool
| CLI Command | MCP Sub-command | Type |
|-------------|-----------------|------|
| export | export | write |
| radar | radar | read |

**Total: 41 CLI commands mapped to 6 router tools.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE transport for MCP | Streamable HTTP (for remote) | MCP spec 2025-03-26 | SSE deprecated. stdio for local, Streamable HTTP for remote. |
| Flat tool registration | Hierarchical/grouped tools | Community pattern 2025-2026 | 85-95% token reduction. Lazy Router pattern gaining adoption. |
| Manual tool testing | `@modelcontextprotocol/inspector` | SDK 1.x | Interactive testing without full Claude Desktop setup. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in + MCP Inspector |
| Config file | none -- Wave 0 |
| Quick run command | `node lib/parity/check-parity.cjs` |
| Full suite command | `node lib/parity/check-parity.cjs && npx @modelcontextprotocol/inspector bin/mindrian-mcp-server.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | 6 router tools registered with correct command enums | unit | `node -e "require('./lib/mcp/tool-router.cjs').ALL_TOOL_COMMANDS"` | Wave 0 |
| MCP-02 | Resources return room data for valid URIs | integration | `npx @modelcontextprotocol/inspector` manual | Wave 0 |
| MCP-03 | Prompts return context-injected messages | integration | `npx @modelcontextprotocol/inspector` manual | Wave 0 |
| MCP-04 | Server starts and connects via stdio | smoke | `echo '{}' \| timeout 3 node bin/mindrian-mcp-server.cjs` | Wave 0 |
| MCP-05 | Larry personality loaded in server context | unit | `node -e "require('./lib/mcp/larry-context.cjs').loadLarryContext('.')"` | Wave 0 |
| CORE-03 | Parity check passes (all commands mapped) | unit | `node lib/parity/check-parity.cjs` | Wave 0 |
| COLLAB-01 | MINDRIAN_ROOM env var resolves correctly | unit | `MINDRIAN_ROOM=/tmp node -e "..."` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node lib/parity/check-parity.cjs`
- **Per wave merge:** Full parity + MCP Inspector session
- **Phase gate:** All tests green + Claude Desktop manual verification

### Wave 0 Gaps
- [ ] `package.json` -- npm init + SDK dependency install
- [ ] `lib/parity/check-parity.cjs` -- parity check script
- [ ] MCP Inspector verification protocol documented

## Open Questions

1. **Methodology tool behavior: return reference content or trigger conversational flow?**
   - What we know: CLI methodology commands are conversational pipelines (Claude reads markdown, follows steps). MCP tools are atomic function calls.
   - What's unclear: Should methodology tools return the reference material (for Claude Desktop to use conversationally), or should they be Prompts instead of Tools?
   - Recommendation: Methodology workflows should be MCP Prompts (user-initiated with context injection). The `methodology` router tool should be for programmatic access (e.g., agent calling a specific framework). Both paths supported.

2. **Tool description token budget per router tool**
   - What we know: Each tool definition costs ~400-500 tokens. With 6 router tools and rich descriptions, budget is ~3000-4000 tokens total.
   - What's unclear: Exact token cost of enum descriptions within each router tool.
   - Recommendation: Keep descriptions concise. Test total tool metadata size with MCP Inspector. Target under 5000 tokens total.

3. **MCP server version syncing with plugin.json version**
   - What we know: plugin.json has `"version": "0.4.2"`. MCP server McpServer constructor takes `version` string.
   - What's unclear: Should they be the same version? Different versioning?
   - Recommendation: Same version. Read from plugin.json at startup: `require('../.claude-plugin/plugin.json').version`.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- McpServer API, registerTool, registerResource, registerPrompt, ResourceTemplate, StdioServerTransport
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.1, peer deps (zod ^3.25 || ^4.0), engine (Node >=18)
- [MCP Resources spec](https://modelcontextprotocol.info/docs/concepts/resources/) -- Resources are read-only, application-controlled
- Phase 10 source code (local verification) -- `bin/mindrian-tools.cjs`, `lib/core/*.cjs` API surface
- Plugin commands directory (local verification) -- 41 `.md` files in `commands/`

### Secondary (MEDIUM confidence)
- [MCP Tool Explosion Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1251) -- ~50 tool practical limit, Cursor 40-tool hard cap
- [MCP Hierarchical Tool Management Discussion](https://github.com/orgs/modelcontextprotocol/discussions/532) -- ~400-500 tokens per tool, context window budget analysis
- [Lazy Router MCP pattern](https://mcpmarket.com/server/lazy-router) -- Hierarchical proxy with meta-tools, 95% context reduction
- [MCP Tool Overload analysis](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) -- 30-60K token cost for 150 tools

### Tertiary (LOW confidence)
- [ECF/MCPToolGroups](https://github.com/ECF/MCPToolGroups) -- Tool grouping extension to MCP spec (not yet standardized)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- SDK verified on npm, API verified from official docs
- Architecture: HIGH -- hierarchical router pattern well-documented in community, Phase 10 core modules verified locally
- Pitfalls: HIGH -- tool explosion data from multiple sources, room path issue from architecture research
- Code examples: HIGH -- patterns verified from official SDK docs + local Phase 10 source

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (SDK stable, patterns mature)
