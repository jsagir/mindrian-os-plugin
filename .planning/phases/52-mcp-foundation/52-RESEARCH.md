# Phase 52: MCP Foundation - Research

**Researched:** 2026-04-05
**Domain:** MCP tool router restructuring, intelligence cascade extraction, Brain-driven routing, SDK upgrade
**Confidence:** HIGH

## Summary

Phase 52 transforms the MindrianOS plugin from a 49-command MCP setup to full 64-command coverage with intelligence parity between CLI and MCP surfaces. The three highest-leverage tasks are: (1) extracting the post-write intelligence cascade from bash hooks into a shared `intelligence-cascade.cjs` module callable by both hooks and MCP tool handlers, (2) restructuring the 6-router hierarchy into 8-10 routers with no group exceeding 15 commands, and (3) creating `brain-router.cjs` with a 3-tier fallback (cache, local heuristic, Brain API with 2s timeout).

The current `tool-router.cjs` has 623 lines with 6 routers handling 49 commands. The data_room router alone has 34 commands in its z.enum -- well above the ~15 threshold for reliable Claude routing. The `post-write` hook script executes 5 intelligence steps (classify, graph-index, HSI compute, reverse salient detection, HSI-to-KuzuDB bridge) that are completely dead on Desktop/Cowork. The SDK upgrade from 1.27.1 to 1.29.0 is backward-compatible with no breaking changes.

**Primary recommendation:** Start with intelligence-cascade.cjs extraction (unblocks all MCP write tools), then router restructuring (enables the 15 orphan commands), then brain-router.cjs (enables orchestration router), then SDK bump + Suggested Next standardization.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Split data_room router (currently 34 commands) into 3 sub-routers: room_state (~5 cmds: status, analyze, compute-state, get-state, suggest-next), room_content (~15 cmds: opportunities, funding, personas, reasoning-*), room_graph (~7 cmds: graph-*, visualize-*)
- Add orchestration router for meta-commands: act, act-chain, act-swarm, act-dry-run, rooms-*, scout-*, reanalyze, onboard, models, admin (~20 sub-commands)
- Extend existing routers: find-analogies -> methodology, causal-* -> analysis, speakers -> meeting, dashboard/wiki/present/publish/snapshot -> export
- Target: 8-10 routers, each with 5-15 commands, total token budget ~6-7K
- splash and funding (already covered by data_room sub-commands) need NO new registration
- Create lib/core/intelligence-cascade.cjs as shared module
- Called by BOTH PostToolUse hook (CLI) and MCP tool handlers (Desktop/Cowork)
- Signature: runCascade(roomDir, { trigger, filePath, section })
- Cascade steps: HSI computation -> cross-reference scan -> graph indexing -> proactive intelligence
- MCP tools that WRITE to room must call runCascade after the write operation
- Read-only MCP tools skip the cascade entirely
- Create lib/mcp/brain-router.cjs as new module
- 3-tier fallback: in-memory cache (10-min TTL, keyed by room_path + STATE.md hash) -> local heuristic (references/methodology/problem-types.md routing table) -> Brain MCP (native fetch to brain.mindrian.ai, 2-second timeout)
- Brain-router RECOMMENDS framework chains, does NOT execute them -- returns { chain, confidence, source, reasoning, target_sections }
- Called ONLY by orchestration router for act*, suggest-next commands -- NOT on every tool call
- When Brain is cold/unreachable, local fallback provides recommendation within 100ms
- Every MCP tool response ends with ## Suggested Next section containing: tool_name (string), args (JSON), rationale (1 sentence)
- Pipeline chaining is LLM-orchestrated: Claude reads Suggested Next and decides whether to call the next tool
- Upgrade @modelcontextprotocol/sdk from ^1.27.1 to ^1.29.0
- Do NOT upgrade to 2.0.0-alpha (breaking changes)

### Claude's Discretion
- Exact number of routers (8-10 range) based on what groups naturally
- Internal naming conventions for router tools
- Error message format for unknown commands
- Whether to use z.enum or z.string with validation for sub-commands (z.enum preferred for type safety)

### Deferred Ideas (OUT OF SCOPE)
- Streamable HTTP transport -- Phase 53 (Surface Detection)
- MCP Apps registration -- Phase 60 (MCP Apps)
- MCP Tasks registration -- Phase 58 (Scheduled Intelligence)
- Resource subscription handlers -- deferred until Claude clients implement push
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-01 | All 64 plugin commands exposed as MCP tools via hierarchical routers (currently 49/64) | Router restructuring research: exact z.enum arrays for 8 routers, 15 orphan command categorization from ARCHITECTURE research |
| MCP-02 | Router restructuring keeps each router group under 15 commands (split data_room 34-cmd group) | data_room split into room_state (5), room_content (15), room_graph (7); orchestration router (20); existing routers extended |
| MCP-03 | Intelligence cascade shared module called by both CLI hooks and MCP tool handlers | post-write hook analysis: 5 cascade steps identified, shared module signature defined, write-tool identification complete |
| MCP-04 | Brain-driven routing with 3-tier fallback (cache -> local heuristic -> Brain 2s timeout) | brain-router.cjs interface designed, problem-types.md verified as local routing table, brain-client.cjs API mapped |
| MCP-05 | All MCP tool outputs include standardized Suggested Next section | Format spec: tool_name + args + rationale, per-router next-tool patterns documented |
| MCP-06 | SDK upgraded from 1.27.1 to ^1.29.0 | Verified: no breaking changes between 1.27.1 and 1.29.0, zod 4.x already installed as transitive dep, backward compatible |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tri-Polar Design Rule**: Every feature must work on CLI, Desktop, and Cowork
- **ICM-native**: folder structure IS orchestration, no frameworks
- **CJS only**: no TypeScript, no build step, no ESM
- **Brain as optional enrichment**: Tier 0 fully functional without Brain
- **MWP Moat Mandate**: every feature must deepen 7-layer MWP integration
- **No em-dashes** in output
- **Release process mandatory**: CHANGELOG.md + plugin.json bump + tag for user-facing changes
- **GSD workflow enforcement**: work through GSD commands

## Standard Stack

### Core (Already Installed - Version Verified)

| Library | Current | Target | Purpose | Why Standard |
|---------|---------|--------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.27.1 | ^1.29.0 | MCP server + tools + transports | Official SDK, 34K+ dependents. 1.29.0 adds size field to ResourceSchema, typings exports, Windows stdio fix. No breaking changes from 1.27.1. |
| `zod` | 4.3.6 (transitive) | 4.3.6 | Schema validation for MCP tools | Already installed as transitive dep of SDK. z.enum works in compat mode. SDK accepts ^3.25 or ^4.0. |
| `kuzu` | 0.11.3 | 0.11.3 | KuzuDB embedded graph (LazyGraph) | Already installed and used by graph-ops.cjs and lazygraph-ops.cjs |
| `chokidar` | 4.0.3 | 4.0.3 | File watching (deferred to Phase 53) | Already installed |

### No New Dependencies Required

This phase requires ZERO new npm packages. All work is internal restructuring of existing modules.

**Version verification:**
```
@modelcontextprotocol/sdk: 1.29.0 (latest on npm, published 2026-03-30)
zod: 4.3.6 (already installed as transitive dep)
No new packages needed.
```

**Upgrade command:**
```bash
npm install @modelcontextprotocol/sdk@^1.29.0
```

### SDK 1.27.1 -> 1.29.0 Upgrade Details

| Version | Key Changes | Impact on MindrianOS |
|---------|-------------|---------------------|
| 1.28.0 (Mar 25) | Rejects plain JSON Schema as inputSchema; OAuth improvements; abort controller cleanup | None -- MindrianOS uses Zod schemas, not plain JSON Schema. No OAuth used. |
| 1.29.0 (Mar 30) | Added `size` to ResourceSchema; typings exports; Windows stdio windowsHide fix | Positive -- Windows stdio fix improves cross-platform. No breaking API changes. |

**Confirmed: server.tool(), McpServer, StdioServerTransport APIs unchanged.** The upgrade is a drop-in replacement.

## Architecture Patterns

### Recommended Module Structure

```
lib/
  core/
    intelligence-cascade.cjs    # NEW: shared cascade called by hooks + MCP
    brain-client.cjs             # EXISTS: HTTP client to Brain API
    graph-ops.cjs                # EXISTS: KuzuDB operations
    proactive-intelligence.cjs   # EXISTS: insight persistence
    state-ops.cjs                # EXISTS: STATE.md operations
    room-ops.cjs                 # EXISTS: room filesystem operations
  mcp/
    tool-router.cjs              # MODIFY: restructure 6 -> 8 routers, add Suggested Next
    brain-router.cjs             # NEW: 3-tier Brain routing
    larry-context.cjs            # EXISTS: Larry personality for MCP
    resources.cjs                # EXISTS: MCP resource registration
    prompts.cjs                  # EXISTS: MCP prompt registration
bin/
  mindrian-mcp-server.cjs       # MODIFY: register new routers, SDK upgrade
scripts/
  post-write                     # MODIFY: call intelligence-cascade.cjs instead of inline logic
```

### Pattern 1: Intelligence Cascade Extraction

**What:** Extract the 5 post-write intelligence steps from `scripts/post-write` bash script into a shared CJS module callable by both hooks (via `mindrian-tools.cjs`) and MCP tool handlers (inline after write operations).

**Current flow (CLI only -- dead on Desktop/Cowork):**
```
PostToolUse(Write) -> run-hook.cmd -> scripts/post-write
  Step 1: classify-insight (keyword section classification)
  Step 2: graph-index (KuzuDB artifact indexing via mindrian-tools.cjs)
  Step 3: compute-hsi.py (HSI scores via Python)
  Step 4: detect-reverse-salients.py (reverse salient detection via Python)
  Step 5: hsi-to-kuzu.cjs (write HSI results to KuzuDB)
  Step 6: generate-presentation.cjs (regenerate views if exports exist)
```

**Target flow (works on ALL surfaces):**
```javascript
// lib/core/intelligence-cascade.cjs
async function runCascade(roomDir, { trigger, filePath, section }) {
  // Guard: only run for room files
  if (!isRoomFile(filePath, roomDir)) return { skipped: true, reason: 'not-in-room' };

  const results = {};

  // Step 1: Classify (fast, synchronous, <100ms)
  results.classification = classifyInsight(filePath, roomDir);

  // Step 2: Graph index (async, KuzuDB)
  if (filePath.endsWith('.md') && !isMetaFile(filePath)) {
    results.graphIndex = await safeGraphIndex(roomDir, filePath);
  }

  // Step 3: HSI computation (async, Python child_process)
  if (hasHsiDeps(roomDir)) {
    results.hsi = await safeHsiCompute(roomDir);
  }

  // Step 4: Reverse salient detection (async, Python)
  if (results.hsi) {
    results.reverseSalients = await safeReverseSalients(roomDir);
  }

  // Step 5: HSI to KuzuDB bridge
  if (results.hsi) {
    results.hsiBridge = await safeHsiToKuzu(roomDir);
  }

  // Step 6: Presentation regeneration (if exports exist)
  results.presentation = await safePresentationRegen(roomDir);

  return results;
}
```

**MCP tool integration point:**
```javascript
// In tool-router.cjs, after any write operation:
case 'reasoning-generate': {
  const reasoningOps = require('../core/reasoning-ops.cjs');
  const genResult = reasoningOps.generateReasoning(roomDir, section || null);

  // Fire intelligence cascade after write
  const cascade = require('../core/intelligence-cascade.cjs');
  await cascade.runCascade(roomDir, {
    trigger: 'mcp-tool',
    filePath: genResult.filePath,
    section: section
  });

  return textResponse(JSON.stringify(genResult, null, 2));
}
```

**Hook integration point:**
```bash
# scripts/post-write (simplified - delegates to shared module)
node "${PLUGIN_ROOT}/bin/mindrian-tools.cjs" cascade "$room_dir" "$FILE_PATH" --raw 2>/dev/null &
```

### Pattern 2: Router Restructuring (6 -> 8 Routers)

**What:** Split data_room (34 cmds) into 3 sub-routers, add orchestration router, extend existing routers.

**Exact z.enum arrays for each router:**

```javascript
// Router 1: room_state (5 commands)
const ROOM_STATE_COMMANDS = [
  'status', 'analyze', 'compute-state', 'get-state', 'suggest-next'
];

// Router 2: room_content (15 commands)
const ROOM_CONTENT_COMMANDS = [
  'new-project', 'setup', 'update', 'help', 'detect-integrations',
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage',
  'generate-personas', 'list-personas', 'invoke-persona', 'analyze-perspectives'
];

// Router 3: room_graph (13 commands)
const ROOM_GRAPH_COMMANDS = [
  'graph-index', 'graph-rebuild', 'graph-query', 'graph-stats',
  'reasoning-get', 'reasoning-generate', 'reasoning-verify',
  'reasoning-run', 'reasoning-list', 'reasoning-frontmatter',
  'visualize-room', 'visualize-graph', 'visualize-chain'
];

// Router 4: methodology (14 commands) -- extend with find-analogies
const METHODOLOGY_COMMANDS = [
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs', 'find-analogies'
];

// Router 5: analysis (13 commands) -- extend with causal-*
const ANALYSIS_COMMANDS = [
  'analyze-systems', 'analyze-timing', 'find-bottlenecks', 'root-cause',
  'systems-thinking', 'macro-trends', 'explore-trends', 'explore-futures',
  'dominant-designs', 'scenario-plan',
  'causal-extract', 'causal-trace', 'causal-predict'
];

// Router 6: intelligence (7 commands) -- unchanged
const INTELLIGENCE_COMMANDS = [
  'find-connections', 'build-thesis', 'compare-ventures', 'research',
  'deep-grade', 'grade', 'leadership'
];

// Router 7: meeting (3 commands) -- extend with speakers
const MEETING_COMMANDS = [
  'file-meeting', 'pipeline', 'speakers'
];

// Router 8: export (7 commands) -- extend with 5 new commands
const EXPORT_COMMANDS = [
  'export', 'radar', 'dashboard', 'wiki', 'present', 'publish', 'snapshot'
];

// Router 9: orchestration (20 commands) -- NEW
const ORCHESTRATION_COMMANDS = [
  'act', 'act-chain', 'act-swarm', 'act-dry-run',
  'rooms-list', 'rooms-new', 'rooms-open', 'rooms-close', 'rooms-archive', 'rooms-where',
  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
  'reanalyze', 'onboard', 'models', 'admin'
];
```

**Command count verification:**

| Router | Commands | Under 15? |
|--------|----------|-----------|
| room_state | 5 | Yes |
| room_content | 15 | Yes (at limit) |
| room_graph | 13 | Yes |
| methodology | 14 | Yes |
| analysis | 13 | Yes |
| intelligence | 7 | Yes |
| meeting | 3 | Yes |
| export | 7 | Yes |
| orchestration | 20 | **NO -- exceeds 15** |
| **Total** | **97 sub-commands** | |

**Note on orchestration:** The orchestration router has 20 sub-commands, exceeding the 15-command limit. However, these are grouped by prefix (act-*, rooms-*, scout-*) which helps Claude distinguish them. The CONTEXT.md locked decision specifies ~20 sub-commands for orchestration. To stay under 15, the planner could split orchestration into two groups: `orchestration` (act-*, reanalyze, onboard, models, admin = 9) and `rooms_scout` (rooms-*, scout-* = 11). This is Claude's discretion per CONTEXT.md.

**Not registered (confirmed no registration needed):**
- `splash` -- session-start banner only, not a tool
- `funding` -- covered by room_content sub-commands (list-funding, create-funding, update-funding-stage)

**Total MCP-registered sub-commands: 97 across 9 routers (or 8 if orchestration stays combined at 20).**
**Total unique CLI commands covered: 64 (confirmed by `ls commands/*.md | wc -l`).**

### Pattern 3: Brain-Router 3-Tier Fallback

**What:** `brain-router.cjs` provides framework chain recommendations for the orchestration router.

**Interface:**
```javascript
// lib/mcp/brain-router.cjs
module.exports = {
  /**
   * Get methodology recommendation for a room.
   * 3-tier: cache -> local heuristic -> Brain API (2s timeout)
   */
  async recommend(roomDir, { intent, mode }) {
    // Tier 1: In-memory cache (10-min TTL, keyed by room_path + STATE.md hash)
    const cacheKey = buildCacheKey(roomDir);
    if (cache.has(cacheKey) && !cache.isExpired(cacheKey)) {
      return { ...cache.get(cacheKey), source: 'cache' };
    }

    // Tier 2: Local heuristic (problem-types.md routing table)
    const localRec = localRoute(roomDir, intent);

    // Tier 3: Brain API (2s timeout, non-blocking)
    const brainRec = await brainRoute(roomDir, intent, 2000);

    // Use Brain if available, otherwise local
    const result = brainRec || localRec;
    cache.set(cacheKey, result);
    return result;
  },

  /**
   * Validate that a framework chain is sensible for current state.
   */
  async validateChain(roomDir, chain) { ... }
};
```

**Local heuristic source:** `references/methodology/problem-types.md` contains the 2D classification matrix (definition level x complexity) mapped to methodology commands. The matrix covers 12 cells with 2 recommended methodologies each. This is the offline routing table.

**Dependencies (all exist):**
- `lib/core/brain-client.cjs` -- HTTP client to Brain API
- `lib/core/state-ops.cjs` -- reads STATE.md for venture_stage, problem_type
- `references/methodology/problem-types.md` -- routing table for local heuristic

### Pattern 4: Suggested Next Section

**What:** Every MCP tool response ends with a structured next-step recommendation.

**Format:**
```markdown
## Suggested Next

**Tool:** `methodology`
**Args:** `{"command": "root-cause", "context": "Build on scenario analysis results in room/problem-definition/"}`
**Rationale:** Scenario analysis identified 3 risk factors - root cause analysis will determine which are primary drivers.
```

**Per-router defaults:**

| Router | After Command | Suggested Next Tool | Rationale Pattern |
|--------|--------------|--------------------|--------------------|
| room_state | analyze | room_graph/graph-stats | "Room analysis complete - check graph for relationship patterns" |
| room_state | compute-state | room_state/suggest-next | "State updated - get framework recommendation" |
| room_content | reasoning-generate | room_graph/graph-index | "Reasoning filed - index for cross-reference discovery" |
| methodology | any | room_state/analyze | "Methodology complete - analyze room to detect new patterns" |
| analysis | scenario-plan | analysis/root-cause | "Scenarios mapped - identify root causes of key risks" |
| analysis | root-cause | analysis/causal-trace | "Root causes identified - trace causal chains" |
| intelligence | grade | intelligence/deep-grade | "Quick grade done - run deep grade for detailed feedback" |
| meeting | file-meeting | room_state/analyze | "Meeting filed - analyze room for new intelligence" |
| export | snapshot | export/publish | "Snapshot generated - publish to hosting" |
| orchestration | act | (Brain-recommended next) | "Framework applied - Brain recommends next in chain" |

**When Brain routing is active**, the orchestration router returns the full chain with Suggested Next pointing to the next step in the Brain-recommended sequence.

### Anti-Patterns to Avoid

- **Duplicating intelligence logic in both hooks and MCP handlers:** Extract to intelligence-cascade.cjs immediately. Two codepaths WILL diverge and bugs fixed in one miss the other.
- **Calling Brain for every tool invocation:** Brain is ONLY for act*/suggest-next in the orchestration router. Other routers use static Suggested Next patterns.
- **Putting 34+ commands in a single z.enum:** Claude misroutes ~15% above 20 values. Split into sub-routers.
- **Making Brain required for any tool to function:** Every tool must work with Brain unavailable. Tier 0 principle.
- **Blocking MCP tool responses on Brain cold-start:** 2-second hard timeout. Local heuristic is the fallback, not waiting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol handling | Custom JSON-RPC server | @modelcontextprotocol/sdk McpServer | Official SDK, handles transport, sessions, tool registration |
| Schema validation | Manual input checking | Zod schemas via z.enum, z.string, z.optional | SDK requires Zod, gives type safety + auto JSON Schema |
| Brain HTTP communication | Raw fetch wrapper | Existing brain-client.cjs | Already handles auth, SSE parsing, Pinecone quota fallback |
| Room state parsing | Custom YAML parser | Existing state-ops.cjs + gray-matter | Already handles frontmatter + content extraction |
| Graph operations | Direct KuzuDB queries | Existing graph-ops.cjs + lazygraph-ops.cjs | Open-use-close pattern already implemented |

## Common Pitfalls

### Pitfall 1: Intelligence Cascade Dead on Desktop/Cowork (CRITICAL)

**What goes wrong:** PostToolUse hooks do not fire on Desktop or Cowork. Filing an artifact via MCP produces no HSI computation, no cross-reference scan, no graph indexing. The plugin works but doesn't think.
**Why it happens:** Cowork VM spawns CLI with `--setting-sources user`, excluding plugin-scoped hooks (confirmed bug #27398).
**How to avoid:** Create intelligence-cascade.cjs as shared module. MCP write-tools call it inline after every write operation. This is the #1 priority within Phase 52.
**Warning signs:** HSI scores stale, graph edges not created after filing artifacts via MCP, STATE.md timestamps stale.

### Pitfall 2: Router Misrouting Above 15 Commands Per Enum (CRITICAL)

**What goes wrong:** Claude selects wrong sub-command when z.enum has 20+ values. data_room currently has 34. Users say "analyze my room" and Claude picks `analyze-perspectives` instead of `analyze`.
**Why it happens:** LLM token scanning degrades above ~15 enum values per tool.
**How to avoid:** Split data_room into room_state/room_content/room_graph. Keep all groups under 15 (orchestration is the exception at 20 but has prefix-grouped names).
**Warning signs:** Wrong command selected but tool succeeds with unexpected results.

### Pitfall 3: Brain Cold Start Blocking Tool Responses

**What goes wrong:** Brain on Render free tier sleeps after 15 min. Cold start takes 10-30s. If Brain routing is synchronous, act/suggest-next tools freeze.
**Why it happens:** Brain elevated from optional enrichment to routing oracle without timeout protection.
**How to avoid:** 2-second hard timeout on Brain calls. Local heuristic via problem-types.md returns recommendation in <100ms. In-memory cache with 10-min TTL avoids repeated calls.
**Warning signs:** Tool calls taking >5s consistently, timeout errors in MCP server logs.

### Pitfall 4: Write-Tool Identification Incomplete

**What goes wrong:** intelligence-cascade.cjs is wired to some MCP tools but not others that write to the room. Intelligence fires inconsistently.
**Why it happens:** Not all write operations are obvious. `reasoning-generate`, `file-opportunity`, `create-funding`, `graph-rebuild`, `invoke-persona` all write. Reference-based tools (methodology, analysis) return text for Claude to execute -- Claude's subsequent Write tool fires the cascade via hooks on CLI, but on MCP there's no hook. The MCP tool itself doesn't write, but Claude's response does.
**How to avoid:** Two categories: (A) tools that write directly (call cascade inline), (B) tools that return reference text for Claude to write (cannot call cascade -- rely on a separate mechanism like resource change detection or explicit cascade-trigger tool). Document both categories exhaustively.
**Warning signs:** Some methodology sessions update the graph, others don't.

## Code Examples

### MCP Tool Registration with Suggested Next (Verified Pattern)

```javascript
// Source: existing tool-router.cjs pattern, extended with Suggested Next
server.tool(
  'room_state',
  'Check room health, state, and get framework recommendations.',
  {
    command: z.enum(['status', 'analyze', 'compute-state', 'get-state', 'suggest-next'])
      .describe('State operation to perform'),
  },
  async ({ command }) => {
    const stateOps = require('../core/state-ops.cjs');
    let result;
    let suggestedNext;

    switch (command) {
      case 'status':
        result = stateOps.getState(roomDir) || 'No room initialized.';
        suggestedNext = { tool: 'room_state', args: { command: 'analyze' }, rationale: 'Check room health and intelligence signals.' };
        break;
      case 'analyze':
        const roomOps = require('../core/room-ops.cjs');
        result = roomOps.analyzeRoom(roomDir);
        suggestedNext = { tool: 'room_graph', args: { command: 'graph-stats' }, rationale: 'Review knowledge graph for relationship patterns.' };
        break;
      // ... other cases
    }

    const nextSection = suggestedNext
      ? `\n\n## Suggested Next\n\n**Tool:** \`${suggestedNext.tool}\`\n**Args:** \`${JSON.stringify(suggestedNext.args)}\`\n**Rationale:** ${suggestedNext.rationale}`
      : '';

    return textResponse(result + nextSection);
  }
);
```

### Intelligence Cascade Module (New Pattern)

```javascript
// lib/core/intelligence-cascade.cjs
'use strict';

const path = require('path');
const { execSync } = require('child_process');
const PLUGIN_ROOT = path.resolve(__dirname, '../..');

/**
 * Run the full intelligence cascade after a write operation.
 * Shared between CLI hooks (via mindrian-tools.cjs) and MCP tool handlers.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {{ trigger: string, filePath: string, section?: string }} opts
 * @returns {Promise<{ skipped?: boolean, classification?: string, graphIndex?: object, hsi?: boolean }>}
 */
async function runCascade(roomDir, { trigger, filePath, section }) {
  if (!filePath || !roomDir) return { skipped: true, reason: 'missing-args' };

  // Guard: only process room files
  if (!filePath.includes('/room/') && !filePath.includes('/rooms/')) {
    return { skipped: true, reason: 'not-in-room' };
  }

  const results = { trigger };

  // Step 1: Graph index (.md files only, skip STATE.md/ROOM.md)
  const basename = path.basename(filePath);
  if (filePath.endsWith('.md') && basename !== 'STATE.md' && basename !== 'ROOM.md') {
    try {
      const graphOps = require('./graph-ops.cjs');
      results.graphIndex = await graphOps.indexArtifact(roomDir, filePath);
    } catch (e) {
      results.graphIndexError = e.message;
    }
  }

  // Step 2: HSI computation (Python, background)
  const lazygraphDir = path.join(roomDir, '.lazygraph');
  const fs = require('fs');
  if (filePath.endsWith('.md') && fs.existsSync(lazygraphDir)) {
    try {
      execSync(`python3 "${PLUGIN_ROOT}/scripts/compute-hsi.py" "${roomDir}"`, {
        timeout: 5000, stdio: 'pipe'
      });
      results.hsi = true;

      // Step 3: Reverse salients
      execSync(`python3 "${PLUGIN_ROOT}/scripts/detect-reverse-salients.py" "${roomDir}"`, {
        timeout: 5000, stdio: 'pipe'
      });
      results.reverseSalients = true;

      // Step 4: HSI to KuzuDB bridge
      const hsiResultsPath = path.join(roomDir, '.hsi-results.json');
      if (fs.existsSync(hsiResultsPath)) {
        execSync(`node "${PLUGIN_ROOT}/scripts/hsi-to-kuzu.cjs" "${roomDir}"`, {
          timeout: 5000, stdio: 'pipe'
        });
        results.hsiBridge = true;
      }
    } catch (e) {
      results.hsiError = e.message;
    }
  }

  return results;
}

module.exports = { runCascade };
```

### Brain Router with 3-Tier Fallback

```javascript
// lib/mcp/brain-router.cjs
'use strict';

const path = require('path');
const crypto = require('crypto');
const brainClient = require('../core/brain-client.cjs');
const stateOps = require('../core/state-ops.cjs');
const { safeReadFile } = require('../core/index.cjs');

// In-memory cache: Map<cacheKey, { data, timestamp }>
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function buildCacheKey(roomDir) {
  const state = stateOps.getState(roomDir) || '';
  const hash = crypto.createHash('md5').update(state).digest('hex').slice(0, 8);
  return `${roomDir}:${hash}`;
}

async function recommend(roomDir, { intent = 'autonomous', mode = 'single' } = {}) {
  const cacheKey = buildCacheKey(roomDir);

  // Tier 1: Cache
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return { ...cached.data, source: 'cache' };
  }

  // Tier 2: Local heuristic (always computed as fallback)
  const localRec = localRoute(roomDir, intent);

  // Tier 3: Brain API (2s timeout)
  if (brainClient.isAvailable()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const brainRec = await brainClient.callTool('recommend-framework-chain', {
        venture_stage: localRec._state?.venture_stage,
        problem_type: localRec._state?.problem_type,
        applied_frameworks: localRec._state?.applied_frameworks || [],
        intent_type: intent,
        weakest_sections: localRec._state?.weakest_sections || []
      });
      clearTimeout(timeout);

      if (brainRec && brainRec.chain) {
        const result = { chain: brainRec.chain, confidence: brainRec.confidence || 0.8, source: 'brain_graph', reasoning: brainRec.reasoning || '', target_sections: brainRec.target_sections || [] };
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (e) {
      // Brain timeout or error -- fall through to local
    }
  }

  // Return local heuristic
  cache.set(cacheKey, { data: localRec, timestamp: Date.now() });
  return localRec;
}

function localRoute(roomDir, intent) {
  // ... parse STATE.md, cross-reference problem-types.md routing table
  // Returns { chain: [...], confidence: 0.6, source: 'local_routing', reasoning: '...', target_sections: [...] }
}

module.exports = { recommend, validateChain: async () => ({ valid: true, warnings: [] }) };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat tool registration (41 tools) | Hierarchical routers (6 groups) | v3.0 (2026-03-25) | 98% token reduction, but data_room grew to 34 commands |
| Hook-only intelligence | Shared cascade module | Phase 52 (now) | Enables intelligence on Desktop/Cowork for first time |
| Brain as optional enrichment | Brain as routing oracle with fallback | Phase 52 (now) | Framework selection becomes programmatic, not prompt-driven |
| MCP SDK 1.27.1 | MCP SDK 1.29.0 | 2026-03-30 | Windows stdio fix, ResourceSchema size field, typings exports |

**Deprecated/outdated:**
- `data_room` single router with 34 commands: must be split into 3 sub-routers
- Inline intelligence in `scripts/post-write`: must be extracted to shared module
- ALL_TOOL_COMMANDS array counting 49: must be updated to track all 97 sub-commands across 9 routers

## MCP Write-Tool Inventory

Tools that write to the room and MUST call intelligence-cascade.cjs:

| Router | Command | What It Writes |
|--------|---------|---------------|
| room_content | file-opportunity | room/opportunity-bank/*.md |
| room_content | create-funding | room/funding/*.md |
| room_content | update-funding-stage | room/funding/*/stage files |
| room_content | generate-personas | room/team/ai-personas/*.md |
| room_graph | reasoning-generate | room/{section}/.reasoning/*.md |
| room_graph | reasoning-run | room/{section}/.reasoning/*.md |
| room_graph | reasoning-frontmatter (set/merge) | room/{section}/REASONING.md frontmatter |
| room_graph | graph-index | .lazygraph/ (KuzuDB) |
| room_graph | graph-rebuild | .lazygraph/ (KuzuDB) |
| meeting | file-meeting | room/meetings/*/*.md |
| orchestration | reanalyze | room/meetings intelligence files |

Tools that return reference text (Claude writes, not the tool):

| Router | Command | Why No Cascade |
|--------|---------|---------------|
| methodology | all 14 | Returns methodology reference. Claude reads it, applies framework, writes results. Claude's Write triggers PostToolUse on CLI. On MCP, no cascade fires -- this is a known gap. |
| analysis | all 13 | Same pattern as methodology |
| intelligence | all 7 | Same pattern |

**Gap mitigation for reference-based tools:** Add a `cascade-trigger` sub-command to room_state that can be called after Claude writes methodology results. Or: detect writes via chokidar in resources.cjs (Phase 53). For Phase 52, document this gap explicitly.

## Open Questions

1. **Orchestration router at 20 commands -- split or keep?**
   - What we know: CONTEXT.md says "~20 sub-commands" but also says "each with 5-15 commands"
   - What's unclear: Whether prefix-grouped names (act-*, rooms-*, scout-*) mitigate the 15-command accuracy concern
   - Recommendation: Split into two routers (orchestration + rooms_scout) if MCP Inspector testing shows >5% misroute. Keep combined for initial implementation since names are well-prefixed.

2. **Reference-based tool cascade gap**
   - What we know: Methodology/analysis/intelligence tools return text for Claude to execute. On CLI, Claude's Write triggers PostToolUse hook. On MCP, no hook fires.
   - What's unclear: Whether chokidar-based file watching (Phase 53) will catch these writes, or if a separate cascade-trigger tool is needed in Phase 52
   - Recommendation: Add an explicit `cascade-trigger` command to room_state that Claude can call after writing methodology results. This is lightweight and solves the gap without depending on Phase 53.

3. **HSI Python dependency availability on Cowork**
   - What we know: HSI computation requires Python3 + sklearn + numpy. Cowork VM may not have these.
   - What's unclear: Whether Cowork VM includes Python scientific packages
   - Recommendation: intelligence-cascade.cjs must gracefully skip HSI steps if Python deps are missing. Graph indexing and classification still work. This is already partially handled by check-hsi-deps.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash scripts (custom) + CJS unit tests |
| Config file | tests/run-all.sh |
| Quick run command | `bash tests/run-all.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | All 64 commands reachable via MCP tools | integration | `node tests/test-phase-52-tool-coverage.cjs` | Wave 0 |
| MCP-02 | Each router group has <=15 commands | unit | `node tests/test-phase-52-router-sizes.cjs` | Wave 0 |
| MCP-03 | Intelligence cascade fires on MCP write-tools | integration | `node tests/test-phase-52-cascade.cjs` | Wave 0 |
| MCP-04 | Brain routing returns recommendation with local fallback | unit | `node tests/test-phase-52-brain-router.cjs` | Wave 0 |
| MCP-05 | Tool responses include Suggested Next section | unit | `node tests/test-phase-52-suggested-next.cjs` | Wave 0 |
| MCP-06 | SDK upgrade to 1.29.0 with no regressions | smoke | `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-phase-52-router-sizes.cjs`
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-phase-52-tool-coverage.cjs` -- verify ALL_TOOL_COMMANDS maps to 64 commands
- [ ] `tests/test-phase-52-router-sizes.cjs` -- verify each z.enum array length <= 15
- [ ] `tests/test-phase-52-cascade.cjs` -- verify runCascade produces graph + HSI results
- [ ] `tests/test-phase-52-brain-router.cjs` -- verify 3-tier fallback (mock Brain timeout)
- [ ] `tests/test-phase-52-suggested-next.cjs` -- verify response format includes ## Suggested Next
- [ ] `tests/test-phase-52-sdk-upgrade.cjs` -- verify McpServer, StdioServerTransport imports work

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All CJS modules | Yes | >=18 (confirmed) | -- |
| Python3 | HSI computation in cascade | Needs verification on Cowork | -- | Skip HSI steps, graph + classify still work |
| sklearn/numpy | compute-hsi.py | Needs verification on Cowork | -- | Skip HSI, log warning |
| KuzuDB (kuzu npm) | Graph indexing | Yes | 0.11.3 | -- |
| Brain API | brain-router.cjs Tier 3 | Optional (network dependent) | -- | Local heuristic (Tier 2) |
| MCP Inspector | Router accuracy testing | Via npx | -- | Manual testing |

**Missing dependencies with no fallback:** None -- all external deps have fallbacks.

**Missing dependencies with fallback:**
- Python3 + sklearn on Cowork VM: cascade skips HSI steps gracefully

## Sources

### Primary (HIGH confidence)
- `lib/mcp/tool-router.cjs` -- current 6-router implementation, 623 lines, z.enum arrays, handler logic [direct code reading]
- `bin/mindrian-mcp-server.cjs` -- MCP server entry point, 78 lines, registration flow [direct code reading]
- `lib/core/brain-client.cjs` -- Brain HTTP client, callTool/query/search/smartSearch API [direct code reading]
- `scripts/post-write` -- current PostToolUse hook, 5-step intelligence cascade [direct code reading]
- `scripts/classify-insight` -- keyword section classification, <100ms [direct code reading]
- `references/methodology/problem-types.md` -- 2D routing table, 12 cells x 2 methodologies [direct code reading]
- `.planning/research/ARCHITECTURE-v18-integration.md` -- orphan command categorization, brain-router design [project research]
- `.planning/research/PITFALLS.md` -- 12 pitfalls with severity and phase mapping [project research]

### Secondary (MEDIUM confidence)
- [MCP TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) -- v1.28.0 and v1.29.0 changelogs, no breaking changes confirmed
- [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.29.0 latest, peer deps verified (zod ^3.25 || ^4.0)
- [GitHub #27398](https://github.com/anthropics/claude-code/issues/27398) -- Cowork hooks bug, --setting-sources user excludes plugin hooks

### Tertiary (LOW confidence)
- HSI Python dependency availability on Cowork VM -- not verified, assumed unavailable as conservative default

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, SDK upgrade verified backward-compatible
- Architecture: HIGH -- patterns derived from direct code reading of existing implementation + locked CONTEXT.md decisions
- Pitfalls: HIGH -- verified against confirmed bugs and codebase analysis
- Brain routing: MEDIUM -- brain-router.cjs is new code, interface designed but Brain API `recommend-framework-chain` tool needs verification

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain, no fast-moving dependencies)
