# Phase 10: Shared Core + CLI Tools - Research

**Researched:** 2026-03-24
**Domain:** Node.js CJS shared core extraction, CLI entry point, dynamic filesystem discovery
**Confidence:** HIGH

## Summary

Phase 10 extracts a `bin/mindrian-tools.cjs` shared Node.js entry point from the existing 20 Bash scripts (4,193 lines total), following the proven GSD `gsd-tools.cjs` pattern already in production at `~/.claude/get-shit-done/bin/gsd-tools.cjs` with 40+ subcommands. The pattern is: a single CJS file routes `process.argv` to `lib/*.cjs` modules that wrap existing scripts via `child_process.execSync`. No npm dependencies are needed for this phase -- it is pure Node.js built-ins only.

The second deliverable is dynamic section discovery in `compute-state` and `analyze-room`. Both scripts currently hardcode a `SECTIONS` array of 8 DD-aligned section names. The `build-graph` script also hardcodes sections plus color/label maps. These must be refactored so that adding a new folder like `opportunity-bank/` to `room/` causes automatic discovery without code changes. The approach is: scan `room/*/` directories at runtime, classify into "core" (known 8 DD sections with metadata) and "extended" (any directory with .md files or STATE.md), and process both.

The critical constraint is that hook scripts (`session-start`, `on-stop`, `post-write`) must stay Bash and complete in under 2-3 seconds. Node.js cold start adds 200-500ms. The shared core is called by hooks for complex operations via `node bin/mindrian-tools.cjs <subcommand>`, but hooks remain the fast-path Bash entry points. All 41 existing CLI commands must continue working identically -- this phase is purely additive.

**Primary recommendation:** Replicate the GSD `gsd-tools.cjs` + `lib/*.cjs` pattern exactly. Start with `room-ops.cjs` and `state-ops.cjs` wrapping `compute-state` and `analyze-room`. Make dynamic section discovery a function in `room-ops.cjs` that both the Node.js modules and the refactored Bash scripts can consume.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | Plugin operations accessible via `mindrian-tools.cjs` single entry point callable by both CLI commands and MCP tools | GSD pattern provides exact blueprint: `gsd-tools.cjs` routes process.argv to `lib/*.cjs` modules. 20 existing scripts map to 5-6 core modules (room-ops, state-ops, meeting-ops, graph-ops, export-ops, intelligence-ops). Wrapping via `child_process.execSync` preserves existing behavior. |
| CORE-02 | Room sections auto-discovered dynamically (no hardcoded section list) -- new sections like opportunity-bank/ and funding/ register automatically | Three scripts have hardcoded SECTIONS arrays: `analyze-room` (line 17), `build-graph` (line 37), `render-pdf` (line 31). Refactoring to dynamic discovery requires: (1) scan `room/*/` directories, (2) classify as core (8 DD + known metadata) or extended (any dir with content), (3) preserve color/label metadata for core sections while assigning defaults for extended. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js CJS (built-in) | >=18 | `bin/mindrian-tools.cjs` entry point + `lib/core/*.cjs` modules | Zero dependencies. Proven by GSD pattern (40+ subcommands, daily production use). CJS because plugin ecosystem uses CommonJS. |
| `child_process.execSync` | Built-in | Wrap existing Bash scripts from Node.js modules | Preserves existing script behavior exactly. No rewrite risk. |
| `fs` / `path` | Built-in | File system operations, room directory scanning | Dynamic section discovery, artifact enumeration |
| Bash scripts (existing) | N/A | Authoritative computation layer (20 scripts, 4,193 lines) | Stay as-is. Hook entry points remain Bash for speed. Complex operations delegate to mindrian-tools.cjs. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `JSON.stringify`/`JSON.parse` | Built-in | Structured output from CLI subcommands | Always. MCP tools (Phase 11) and hooks consume JSON output from mindrian-tools.cjs. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `child_process.execSync` wrapping Bash | Rewrite all Bash in Node.js | Premature abstraction (Sandi Metz). 4,193 lines of battle-tested Bash. Rewrite introduces bugs with zero user value. Only rewrite when Rule of Three demands it. |
| `process.argv` routing | Commander/yargs | Claude is the caller, not a human. No help text, completion, or colored output needed. GSD proves process.argv works at 40+ subcommands. |
| Flat `lib/*.cjs` | Nested `lib/core/` + `lib/tools/` | Flat is sufficient for Phase 10. Phase 11 adds `lib/tools/` for MCP wrappers. Keep it simple now. |

**Installation:**
```bash
# No npm install needed for Phase 10
# Just create the files: bin/mindrian-tools.cjs + lib/core/*.cjs
```

## Architecture Patterns

### Recommended Project Structure
```
MindrianOS-Plugin/
  bin/
    mindrian-tools.cjs          # Single entry point (GSD pattern)
  lib/
    core/
      index.cjs                 # Shared helpers: output(), error(), safeReadFile()
      room-ops.cjs              # listSections(), analyzRoom(), computeState()
      state-ops.cjs             # readState(), computeState(), getVentureStage()
      meeting-ops.cjs           # computeMeetingsIntelligence(), computeTeam()
      graph-ops.cjs             # buildGraph(), parseWikilinks()
      export-ops.cjs            # renderPdf() -- wraps Python render-pdf
      section-registry.cjs      # CORE_SECTIONS metadata + dynamic discovery
  scripts/                      # UNCHANGED (existing 20 scripts stay)
```

### Pattern 1: GSD-Style CLI Entry Point
**What:** Single CJS file routes `process.argv[2]` to lib modules via switch-case. Each lib module exports functions callable both from CLI (via process.argv) and from `require()` (for MCP in Phase 11).
**When to use:** Every subcommand in mindrian-tools.cjs.
**Example:**
```javascript
// bin/mindrian-tools.cjs
#!/usr/bin/env node
const { error } = require('../lib/core/index.cjs');
const roomOps = require('../lib/core/room-ops.cjs');
const stateOps = require('../lib/core/state-ops.cjs');
const meetingOps = require('../lib/core/meeting-ops.cjs');
const graphOps = require('../lib/core/graph-ops.cjs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  switch (command) {
    case 'room':
      if (subcommand === 'list-sections') roomOps.listSections(args[2]);
      else if (subcommand === 'analyze') roomOps.analyzeRoom(args[2]);
      else error(`Unknown room subcommand: ${subcommand}`);
      break;
    case 'state':
      if (subcommand === 'compute') stateOps.computeState(args[2]);
      else if (subcommand === 'get') stateOps.getState(args[2]);
      else error(`Unknown state subcommand: ${subcommand}`);
      break;
    // ... more commands
  }
}

main().catch(e => { error(e.message); });
```

### Pattern 2: Bash Script Wrapping
**What:** Core modules call existing Bash scripts via `execSync`, parse their stdout, and return structured objects. Scripts remain authoritative; Node.js is the API layer.
**When to use:** Every core module function that has an existing Bash implementation.
**Example:**
```javascript
// lib/core/room-ops.cjs
const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

function analyzeRoom(roomPath) {
  const result = execSync(
    `bash "${SCRIPTS_DIR}/analyze-room" "${roomPath || './room'}"`,
    { encoding: 'utf-8', timeout: 10000 }
  );
  return parseAnalyzeOutput(result);
}

function parseAnalyzeOutput(raw) {
  const gaps = [], convergence = [], contradictions = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('GAP:')) {
      const [, type, section, confidence, message] = line.split(':');
      gaps.push({ type, section, confidence, message });
    }
    // ... parse CONVERGE:, CONTRADICT: lines
  }
  return { gaps, convergence, contradictions };
}

module.exports = { analyzeRoom, parseAnalyzeOutput };
```

### Pattern 3: Dynamic Section Discovery
**What:** Replace hardcoded SECTIONS arrays with runtime directory scanning. Core sections keep their metadata (colors, labels, gap messages). Extended sections get defaults.
**When to use:** Every function that iterates room sections.
**Example:**
```javascript
// lib/core/section-registry.cjs
const fs = require('fs');
const path = require('path');

const CORE_SECTIONS = {
  'problem-definition': { label: 'PROBLEM DEFINITION', color: '#A63D2F' },
  'market-analysis':    { label: 'MARKET ANALYSIS',    color: '#C8A43C' },
  'solution-design':    { label: 'SOLUTION DESIGN',    color: '#5C5A56' },
  'business-model':     { label: 'BUSINESS MODEL',     color: '#2D6B4A' },
  'competitive-analysis': { label: 'COMPETITIVE ANALYSIS', color: '#B5602A' },
  'team-execution':     { label: 'TEAM & EXECUTION',   color: '#1E3A6E' },
  'legal-ip':           { label: 'LEGAL & IP',         color: '#6B4E8B' },
  'financial-model':    { label: 'FINANCIAL MODEL',    color: '#2A6B5E' },
};

// Known extended sections with metadata
const EXTENDED_SECTION_META = {
  'opportunity-bank': { label: 'OPPORTUNITY BANK', color: '#C87137' },
  'funding':          { label: 'FUNDING',          color: '#3A7B5E' },
  'personas':         { label: 'AI PERSONAS',      color: '#7B4A8B' },
};

function discoverSections(roomDir) {
  if (!fs.existsSync(roomDir)) return { core: [], extended: [], all: [] };

  const dirs = fs.readdirSync(roomDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  const core = dirs.filter(d => d in CORE_SECTIONS);
  const extended = dirs.filter(d => !(d in CORE_SECTIONS)
    && d !== 'meetings' && d !== 'team');  // Skip structural dirs

  return {
    core,
    extended,
    all: [...core, ...extended],
    getMeta: (name) => CORE_SECTIONS[name]
      || EXTENDED_SECTION_META[name]
      || { label: name.toUpperCase().replace(/-/g, ' '), color: '#5C5A56' }
  };
}

module.exports = { CORE_SECTIONS, EXTENDED_SECTION_META, discoverSections };
```

### Pattern 4: Dual Output (JSON + stdout text)
**What:** Core functions return structured objects. The CLI entry point formats as JSON (for programmatic consumers) or text (for human/hook consumers). MCP tools (Phase 11) consume the objects directly via `require()`.
**When to use:** Every core function.
**Example:**
```javascript
// In room-ops.cjs
function listSections(roomDir) {
  const { core, extended, all, getMeta } = discoverSections(roomDir);
  return {
    sections: all.map(name => ({
      name,
      type: core.includes(name) ? 'core' : 'extended',
      ...getMeta(name)
    })),
    core_count: core.length,
    extended_count: extended.length
  };
}

// In mindrian-tools.cjs
const result = roomOps.listSections(args[2]);
output(result);  // JSON to stdout
```

### Anti-Patterns to Avoid
- **Rewriting Bash scripts in Node.js:** The 4,193 lines of Bash are battle-tested and fast. Wrap, don't rewrite. (Sandi Metz: "duplication is far cheaper than the wrong abstraction")
- **Adding `surface` or `mode` parameters to shared functions:** Shared core must be surface-agnostic. CLI vs MCP formatting happens in the delivery layer, never in core.
- **Putting MCP-specific code in lib/core/:** Core modules know nothing about MCP. They return objects. MCP tools wrap those objects with Zod schemas in Phase 11.
- **Breaking hook speed:** Never add Node.js-only logic to the hook critical path. Hooks stay Bash. They call `node mindrian-tools.cjs` only for non-time-critical operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom parser with flags/options | `process.argv` switch-case (GSD pattern) | Claude is the only caller. No help text or validation needed. GSD proves this works at 40+ subcommands. |
| JSON output formatting | Template strings | `JSON.stringify` + GSD `output()` helper | Handles escaping, large payloads (>50KB to tmpfile), raw mode. Already proven. |
| Frontmatter parsing | Custom YAML parser | Regex extraction from existing script output | The Bash scripts already parse frontmatter. Core modules consume their stdout. |
| Section color/label metadata | Database or config file | In-code `CORE_SECTIONS` constant object | Only 8+3 entries. Changes are code changes. No config file overhead. |

**Key insight:** Phase 10 is a thin Node.js API layer over existing Bash scripts. The value is callability from Node.js (for Phase 11 MCP), not reimplementation.

## Common Pitfalls

### Pitfall 1: Node.js Cold Start Exceeds Hook Budget
**What goes wrong:** Hooks have 2-3 second timeout. Node.js cold start is 200-500ms. If mindrian-tools.cjs is called in the hook critical path, it may timeout.
**Why it happens:** Developers test on warm Node.js processes. Cold start only surfaces on first invocation after system restart.
**How to avoid:** Hook scripts (session-start, on-stop, post-write) stay Bash. They call `node mindrian-tools.cjs` only for non-blocking operations or via background `&`. Measure cold start with `time node bin/mindrian-tools.cjs room list-sections ./room` on a fresh terminal.
**Warning signs:** Intermittent hook timeouts, especially on first session start after reboot.

### Pitfall 2: Premature Abstraction of Shared Core
**What goes wrong:** Extracting too much logic into Node.js before understanding how MCP tool I/O differs from CLI command I/O. Results in a shared core that neither surface fits cleanly.
**Why it happens:** Natural instinct to "clean up" while extracting. Sandi Metz: "duplication is far cheaper than the wrong abstraction."
**How to avoid:** Phase 10 wraps scripts via execSync. Functions return parsed objects from script stdout. No logic migration. Phase 11 will reveal what truly needs to be shared vs what needs surface-specific handling.
**Warning signs:** Core module functions with `if (mode === 'cli')` or `if (surface === 'mcp')` branches.

### Pitfall 3: Breaking Existing 41 Commands
**What goes wrong:** Modifying compute-state or analyze-room for dynamic section discovery breaks the output format that 41 CLI commands depend on.
**Why it happens:** Output format is implicit (stdout text parsed by Claude). No contract tests exist.
**How to avoid:** (1) Capture current output of `compute-state` and `analyze-room` on a test room as golden files. (2) After refactoring, diff against golden files. (3) Dynamic discovery must produce identical output for the 8 core sections. Extended sections are additive output only.
**Warning signs:** Larry's session greeting changes unexpectedly. Proactive intelligence stops surfacing gaps.

### Pitfall 4: Hardcoded Paths in Core Modules
**What goes wrong:** Core modules use relative paths that break when called from different working directories (hooks run from project root, MCP server runs from server directory).
**Why it happens:** `__dirname` resolves differently based on symlinks and working directory.
**How to avoid:** All path resolution uses `path.resolve(__dirname, '../../scripts')` for script paths and accepts `roomDir` as explicit parameter (never assumes CWD). Follow GSD pattern where `cwd` is always explicit.
**Warning signs:** "ENOENT: no such file" errors when same function works from one entry point but not another.

### Pitfall 5: Dynamic Discovery Includes Non-Section Directories
**What goes wrong:** `room/` contains `meetings/`, `team/`, and potentially `.git/`, `node_modules/`, or user temp folders. Dynamic discovery treats them as sections.
**Why it happens:** Naive `fs.readdirSync` without filtering.
**How to avoid:** Exclude: (1) hidden dirs (`.`-prefixed), (2) known structural dirs (`meetings`, `team`), (3) dirs without any .md content. A directory is a "section" if it contains at least one .md file or has a STATE.md.
**Warning signs:** `meetings` or `team` appearing as room sections in state output.

## Code Examples

### GSD Reference: Entry Point Pattern
```javascript
// Source: ~/.claude/get-shit-done/bin/gsd-tools.cjs (lines 128-178)
// This is the exact pattern to replicate

const fs = require('fs');
const path = require('path');
const { error } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    error('Usage: mindrian-tools <command> [args]\nCommands: room, state, meeting, graph, export');
  }

  switch (command) {
    case 'state': {
      const subcommand = args[1];
      if (subcommand === 'json') state.cmdStateJson(cwd, raw);
      else if (subcommand === 'compute') state.cmdComputeState(args[2]);
      else error(`Unknown state subcommand: ${subcommand}`);
      break;
    }
    // ...
  }
}

main().catch(e => { error(e.message); });
```

### GSD Reference: Output Helper
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/core.cjs (lines 35-56)
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `mindrian-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}
```

### Dynamic Section Discovery (for Bash scripts)
```bash
# Bash-side dynamic discovery (for analyze-room refactor)
# Replace hardcoded SECTIONS array with:

CORE_SECTIONS=(
  problem-definition market-analysis solution-design business-model
  competitive-analysis team-execution legal-ip financial-model
)

# Discover extended sections dynamically
SKIP_DIRS="meetings|team"
EXTENDED_SECTIONS=()
for dir in "$ROOM_DIR"/*/; do
  [ -d "$dir" ] || continue
  section_name=$(basename "$dir")
  [[ "$section_name" == .* ]] && continue
  # Skip core sections (already in array)
  printf '%s\n' "${CORE_SECTIONS[@]}" | grep -qx "$section_name" && continue
  # Skip structural directories
  echo "$section_name" | grep -qE "^($SKIP_DIRS)$" && continue
  # Must have at least one .md file or STATE.md
  if [ -f "$dir/STATE.md" ] || find "$dir" -maxdepth 1 -name "*.md" -print -quit | grep -q .; then
    EXTENDED_SECTIONS+=("$section_name")
  fi
done

# Combined array for iteration
ALL_SECTIONS=("${CORE_SECTIONS[@]}" "${EXTENDED_SECTIONS[@]}")
```

### Calling mindrian-tools.cjs from Hooks
```bash
# In session-start hook (non-blocking background call)
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Complex analysis delegated to Node.js (background, non-blocking)
node "$PLUGIN_ROOT/bin/mindrian-tools.cjs" room list-sections "$ROOM_DIR" > /tmp/mindrian-sections.json 2>/dev/null &

# Fast operations stay in Bash (foreground, time-critical)
state_output=$("${SCRIPT_DIR}/compute-state" "$ROOM_DIR" 2>/dev/null)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 8-section arrays | Dynamic directory scanning | Phase 10 | New sections auto-discovered; enables opportunity-bank, funding, personas |
| Bash-only script execution | Node.js wrapper + Bash scripts | Phase 10 | Enables `require()` from MCP server (Phase 11), structured JSON output |
| No shared core (scripts called directly) | `mindrian-tools.cjs` entry point | Phase 10 | Single source of truth for plugin operations; parity between CLI and MCP |

**Deprecated/outdated:**
- Nothing deprecated. All 20 Bash scripts continue to work. Phase 10 is additive.

## Open Questions

1. **Node.js cold start timing**
   - What we know: Cold start is typically 200-500ms on Linux. GSD uses this pattern daily without timeout issues.
   - What's unclear: Exact cold start time on the WSL2 dev environment with the specific scripts in this project.
   - Recommendation: Measure with `time node bin/mindrian-tools.cjs room list-sections ./room` after implementation. If >500ms, keep hook calls Bash-only and use mindrian-tools.cjs only from MCP (Phase 11) and non-hook CLI contexts.

2. **render-pdf (Python) section hardcoding**
   - What we know: `render-pdf` is a Python script with its own SECTIONS list (line 31). It is not called from hooks.
   - What's unclear: Whether the PDF renderer should also use dynamic discovery or if its section list should be managed separately.
   - Recommendation: Defer render-pdf refactoring. It is called explicitly by commands, not hooks. Add to Phase 10 scope only if time permits. For now, it can keep its hardcoded list.

3. **build-graph color/label metadata for extended sections**
   - What we know: `build-graph` uses SECTION_COLORS and SECTION_LABELS maps. New sections need colors for the De Stijl dashboard.
   - What's unclear: Whether the color assignment for new sections should be deterministic (hash-based) or configured.
   - Recommendation: Use the `EXTENDED_SECTION_META` constant with pre-assigned colors for known extensions (opportunity-bank, funding, personas). Unknown sections get a neutral default (#5C5A56).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash + Node.js assertion (no test framework -- validate via golden file diffs and CLI output checks) |
| Config file | none -- see Wave 0 |
| Quick run command | `node bin/mindrian-tools.cjs room list-sections ./room && echo "OK"` |
| Full suite command | `bash scripts/compute-state ./room > /tmp/test-state.md && diff /tmp/test-state.md tests/golden/compute-state.md` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | mindrian-tools.cjs executes same logic as Bash scripts | integration | `node bin/mindrian-tools.cjs state compute ./room \| diff - <(bash scripts/compute-state ./room)` | No -- Wave 0 |
| CORE-01 | All subcommands route correctly | smoke | `node bin/mindrian-tools.cjs room list-sections ./room && node bin/mindrian-tools.cjs state compute ./room` | No -- Wave 0 |
| CORE-02 | New section folder auto-discovered | integration | `mkdir -p /tmp/test-room/new-section && echo "# Test" > /tmp/test-room/new-section/entry.md && node bin/mindrian-tools.cjs room list-sections /tmp/test-room \| grep new-section` | No -- Wave 0 |
| CORE-02 | analyze-room discovers extended sections | integration | `bash scripts/analyze-room /tmp/test-room \| grep new-section` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node bin/mindrian-tools.cjs room list-sections ./room`
- **Per wave merge:** Full golden file diff for compute-state and analyze-room output
- **Phase gate:** All 41 commands produce identical behavior; dynamic discovery adds new sections without breaking core output

### Wave 0 Gaps
- [ ] `tests/golden/compute-state.md` -- golden file for compute-state output on test room
- [ ] `tests/golden/analyze-room.txt` -- golden file for analyze-room output on test room
- [ ] `tests/test-room/` -- minimal test room with 2-3 sections for automated testing
- [ ] Validation script that runs mindrian-tools.cjs subcommands and checks output

## Script-to-Module Mapping

This is the key reference for the planner -- which scripts map to which core modules.

| Script | Lines | Core Module | Functions to Extract | Priority |
|--------|-------|-------------|---------------------|----------|
| `compute-state` | 260 | `state-ops.cjs` | `computeState(roomDir)` -- returns structured state object | P0 (hook-critical) |
| `analyze-room` | 269 | `room-ops.cjs` | `analyzeRoom(roomDir)` -- returns gaps/convergence/contradictions | P0 (hook-critical) |
| `build-graph` | 657 | `graph-ops.cjs` | `buildGraph(roomDir, outputPath)` -- generates graph.json | P1 (command-critical) |
| `compute-meetings-intelligence` | 402 | `meeting-ops.cjs` | `computeMeetingsIntel(roomDir)` -- cross-meeting analysis | P1 |
| `compute-team` | 599 | `meeting-ops.cjs` | `computeTeam(roomDir)` -- team state computation | P1 |
| `render-pdf` | 588 | `export-ops.cjs` | `renderPdf(roomDir, outputPath, options)` -- PDF generation | P2 (defer) |
| `session-start` | 157 | N/A | Stays Bash -- hook entry point, calls other scripts | N/A |
| `on-stop` | 26 | N/A | Stays Bash -- hook entry point | N/A |
| `post-write` | 25 | N/A | Stays Bash -- hook entry point | N/A |
| `transcribe-audio` | 148 | `meeting-ops.cjs` | `transcribeAudio(filePath)` -- Velma API wrapper | P2 |
| `research-speaker` | 239 | `meeting-ops.cjs` | `researchSpeaker(name)` -- web research | P2 |
| `create-speaker-profile` | 134 | `meeting-ops.cjs` | `createSpeakerProfile(name, data)` -- profile generation | P2 |
| `classify-insight` | 59 | `room-ops.cjs` | `classifyInsight(text)` -- section routing | P2 |
| `serve-dashboard` | 91 | `graph-ops.cjs` | `serveDashboard(port)` -- local HTTP server | P2 |
| `check-update` | 51 | N/A | Stays Bash -- fast network check | N/A |
| `track-analytics` | 151 | N/A | Stays Bash -- background fire-and-forget | N/A |
| `learn-from-usage` | 168 | N/A | Stays Bash -- runs in hook | N/A |
| `backup-modifications` | 68 | N/A | Stays Bash -- file ops only | N/A |
| `reapply-modifications` | 36 | N/A | Stays Bash -- file ops only | N/A |
| `context-monitor` | 65 | N/A | Stays Bash -- bridge file writer | N/A |

**P0 scripts** (compute-state, analyze-room) are the minimum viable Phase 10 delivery. They are called by session-start and consumed by every command. Wrapping them in Node.js modules with dynamic section discovery satisfies both CORE-01 and CORE-02.

**P1 scripts** (build-graph, compute-meetings-intelligence, compute-team) should be wrapped in Phase 10 to provide a complete core for Phase 11 MCP tools.

**P2 scripts** can be deferred to Phase 11 or later -- they are called by specific commands, not by hooks or the intelligence pipeline.

## Hardcoded Section Arrays Inventory

Files requiring dynamic section discovery refactoring:

| File | Line | Current | Refactoring Approach |
|------|------|---------|---------------------|
| `scripts/analyze-room` | 17-26 | `SECTIONS=(problem-definition ...)` (8 entries) | Source from shared Bash function or `mindrian-tools.cjs room list-sections --names-only` |
| `scripts/build-graph` | 37-46 | `SECTIONS=(...)` + `SECTION_COLORS` + `SECTION_LABELS` | Source sections from shared function; metadata from `section-registry.cjs` |
| `scripts/render-pdf` | 31-41 | Python `SECTIONS = [...]` + `SECTION_COLORS` + `SECTION_LABELS` | Lower priority (P2). Can read from `section-registry.cjs` output or keep hardcoded for now. |
| `scripts/compute-state` | 24-29 | Implicit (iterates `$ROOM_DIR/*/`) | Already dynamic! Uses `for section_dir in "$ROOM_DIR"/*/`. Only the gap messages (lines 172-184) are hardcoded per section name. |

**Key finding:** `compute-state` is ALREADY partially dynamic -- it iterates all subdirectories. Only its gap messaging and venture stage inference are hardcoded. `analyze-room` and `build-graph` are the scripts that truly need dynamic section refactoring.

## Sources

### Primary (HIGH confidence)
- GSD reference implementation (`~/.claude/get-shit-done/bin/gsd-tools.cjs` + `lib/*.cjs`) -- exact pattern to replicate, verified locally
- Existing codebase: `scripts/*` (20 files, 4,193 lines total) -- analyzed for wrapping strategy
- `scripts/compute-state` (260 lines) -- already partially dynamic section iteration
- `scripts/analyze-room` (269 lines) -- hardcoded SECTIONS at line 17
- `scripts/build-graph` (657 lines) -- hardcoded SECTIONS + colors + labels

### Secondary (MEDIUM confidence)
- Node.js `child_process.execSync` docs -- standard API, no version concerns
- Sandi Metz "The Wrong Abstraction" -- informs the wrap-don't-rewrite strategy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, proven GSD pattern replicated exactly
- Architecture: HIGH -- GSD reference is production code in active daily use with 40+ subcommands
- Pitfalls: HIGH -- derived from direct codebase analysis (hardcoded arrays found, hook timing constraints documented in code comments)
- Dynamic discovery: HIGH -- compute-state already iterates `$ROOM_DIR/*/`; pattern confirmed working

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain -- Node.js CJS patterns do not change)
