# Phase 16: Reasoning Engine - Research

**Researched:** 2026-03-25
**Domain:** Autonomous methodology orchestration, structured reasoning persistence, frontmatter-driven dependency graphs
**Confidence:** HIGH

## Summary

Phase 16 builds the intelligence layer that makes MindrianOS self-reasoning. It adds three interconnected capabilities: (1) per-section REASONING.md files with Minto/MECE structure and YAML frontmatter dependency graphs, (2) autonomous methodology orchestration where Larry chains tools in sequences captured as run artifacts, and (3) persistent chain-of-thought stored in room/.reasoning/ that future sessions read to understand section state.

The implementation follows established codebase patterns exactly. The new `reasoning-ops.cjs` core module mirrors persona-ops.cjs and opportunity-ops.cjs: pure Node.js, regex-based frontmatter parsing, structured file I/O. The CLI routing in mindrian-tools.cjs adds a `reasoning` command group following the same switch-case pattern as `persona`, `graph`, and `funding`. The MCP tool router extends the `data_room` group with reasoning subcommands.

**Primary recommendation:** Build reasoning-ops.cjs as the core module with 6 functions (generate, get, list, verify, run, frontmatter CRUD), register in mindrian-tools.cjs and tool-router.cjs, add REASONING_INFORMS edge type to LazyGraph schema, create the reasoning:// MCP resource, and hook into post-write for automatic reasoning staleness detection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each room section gets a REASONING.md with Minto/MECE structure
- YAML frontmatter with requires/provides/affects dependency graph (GSD SUMMARY.md pattern)
- Captures: WHY this section matters, key claims/assumptions, cross-section logic, what Larry would challenge
- Goal-backward verification: "What must be TRUE for this section to be complete?"
- Brain-informed: methodology connections from Neo4j graph (when connected)
- Feeds LazyGraph: reasoning edges become graph connections
- Template at references/reasoning/reasoning-template.md
- Larry autonomously chains: diagnose -> select-framework -> apply -> file -> cross-reference -> update-graph
- Each step is a tool call with structured output feeding the next
- The sequence is captured as a "methodology run" artifact in room/.reasoning/runs/
- Brain enriches at each step (if connected)
- The room folder structure IS the orchestration (ICM principle)
- Command: /mos:reason -- triggers autonomous reasoning on a section or the whole room
- Chain of thought is SAVED as .reasoning/ artifacts, not just displayed
- room/.reasoning/ directory per project (like room/.lazygraph/)
- Contains: per-section REASONING.md files, methodology run logs, thinking traces
- Future sessions read .reasoning/ to understand section state without re-analyzing
- CLI: blockquote traces (already built in v0.6.0 thinking traces)
- Desktop/Cowork: same traces embedded in MCP prompt responses
- Bash-based COT for CLI, markdown-based for non-CLI platforms
- mindrian-tools.cjs reasoning subcommands must be as capable as gsd-tools.cjs
- This is the MOAT -- the reasoning engine with full .cjs capabilities is the POWER BACKEND

### Frontmatter Schema (locked)
```yaml
---
section: problem-definition
generated: 2026-03-25
methodology_run: run-2026-03-25-001
requires:
  - section: market-analysis
    provides: "Customer validation data"
provides:
  - "Problem type classification"
  - "Wicked problem characteristics"
affects: ["solution-design", "competitive-analysis"]
confidence:
  high: ["Problem is wicked (8/10)", "TAM estimate 2-5B"]
  medium: ["Regulatory headwinds in EU"]
  low: ["China market timing"]
verification:
  must_be_true:
    - "Problem definition cites at least 2 customer data points"
    - "Wicked characteristics identified and scored"
  status: pending
brain_enriched: true
room_hash: abc123
---
```

### CLI Subcommands (locked)
- `reasoning get <section>` -- read REASONING.md for a section
- `reasoning generate <section>` -- generate/regenerate REASONING.md
- `reasoning verify <section>` -- check verification criteria
- `reasoning run <section>` -- execute full methodology run
- `reasoning list` -- show all sections with reasoning status
- Programmatic frontmatter read/write (like gsd-tools frontmatter get/set)

### Claude's Discretion
- Exact Minto/MECE section structure within REASONING.md body
- Methodology run artifact format
- How reasoning integrates with existing analyze-room output
- Cache invalidation strategy (when does reasoning become stale)
- How many sections can be reasoned about in one session

### Deferred Ideas (OUT OF SCOPE)
- Automatic reasoning staleness detection (reasoning invalidated when section content changes significantly)
- Cross-venture reasoning patterns (anonymized insights from multiple users)
- Reasoning quality scoring (meta-assessment of reasoning strength)
- Real-time reasoning updates during conversation (vs post-session persistence)
- Reasoning diff view (how reasoning evolved over time)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REASON-01 | Each room section generates a REASONING.md with Minto/MECE structured analysis, frontmatter dependency graph (requires/provides/affects), and goal-backward verification | Core module reasoning-ops.cjs with generateReasoning(), REASONING.md template, frontmatter CRUD functions |
| REASON-02 | Larry autonomously chains methodology tools in sequences (diagnose -> framework -> apply -> file -> cross-reference -> graph-update) captured as methodology run artifacts | Methodology run orchestration in reasoning-ops.cjs, run artifact format in room/.reasoning/runs/, room hash tracking for freshness |
| REASON-03 | Chain-of-thought is persisted as .reasoning/ artifacts that future sessions read to understand section state | .reasoning/ directory structure, per-section REASONING.md storage, run log persistence, session-start integration |
| REASON-04 | Reasoning visualization works across CLI (blockquote traces), Desktop (MCP prompts), and Cowork (shared state) -- showing logical flow in natural terms | reasoning:// MCP resource URI scheme, blockquote trace format from larry-personality SKILL.md, MCP prompt integration |
| REASON-05 | mindrian-tools.cjs provides programmatic frontmatter read/write for reasoning files (learned from gsd-tools.cjs patterns) | Frontmatter CRUD functions (get/set/merge) in reasoning-ops.cjs, CLI subcommands for frontmatter operations |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, crypto) | N/A | All file I/O, frontmatter parsing, hashing | Phase 10 decision: zero npm deps for core modules |
| KuzuDB (kuzu) | 0.11.3 | REASONING_INFORMS edge type in LazyGraph | Already installed, Phase 15 decision |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | 1.27+ | MCP tool/resource/prompt registration | Reasoning MCP integration |
| zod | (pulled by SDK) | Schema validation for MCP tool params | Reasoning command enum |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex frontmatter parsing | js-yaml npm package | Would break Phase 10 zero-dep decision; regex is established pattern used in persona-ops.cjs, opportunity-ops.cjs, lazygraph-ops.cjs |
| Custom run artifact format | JSON logs | Markdown run artifacts are human-readable AND machine-parseable; follows ICM principle |

## Architecture Patterns

### Recommended Project Structure
```
lib/core/reasoning-ops.cjs           # Core reasoning operations (NEW)
references/reasoning/
  reasoning-template.md               # REASONING.md template (NEW)
  run-template.md                     # Methodology run artifact template (NEW)
room/.reasoning/                      # Per-project reasoning artifacts (runtime, NEW)
  problem-definition/
    REASONING.md                      # Minto/MECE structured reasoning
  market-analysis/
    REASONING.md
  runs/
    run-2026-03-25-001.md             # Methodology run log
    run-2026-03-25-002.md
```

### Pattern 1: Core Module Structure (follows persona-ops.cjs exactly)
**What:** reasoning-ops.cjs follows the established module pattern
**When to use:** All reasoning operations

```javascript
// Source: lib/core/persona-ops.cjs (verified pattern)
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { discoverSections } = require('./section-registry.cjs');
const { safeReadFile } = require('./index.cjs');

// parseFrontmatter() — same regex/split as persona-ops.cjs and opportunity-ops.cjs
// No yaml library (Phase 13 decision: YAML frontmatter parsing uses regex/split)

function parseFrontmatter(content) { /* same implementation as persona-ops.cjs */ }
function reconstructFrontmatter(obj) { /* GSD pattern: serialize obj back to YAML string */ }
function spliceFrontmatter(content, newObj) { /* GSD pattern: replace frontmatter in content */ }
```

### Pattern 2: CLI Routing (follows mindrian-tools.cjs switch-case)
**What:** New `reasoning` command group in the CLI entry point
**When to use:** All reasoning CLI commands

```javascript
// Source: bin/mindrian-tools.cjs (verified pattern)
case 'reasoning': {
  switch (subcommand) {
    case 'get': {
      const section = argv[3] || null;
      const result = reasoningOps.getReasoning(roomDir, section);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }
    case 'generate': {
      const section = argv[3] || null;
      const result = reasoningOps.generateReasoning(roomDir, section);
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }
    // ... verify, run, list, frontmatter subcommands
  }
  break;
}
```

### Pattern 3: MCP Tool Registration (follows tool-router.cjs data_room pattern)
**What:** Reasoning commands added to the data_room tool group
**When to use:** Desktop/Cowork access to reasoning

```javascript
// Source: lib/mcp/tool-router.cjs (verified pattern)
// Add to DATA_ROOM_COMMANDS array:
const DATA_ROOM_COMMANDS = [
  // ... existing commands ...
  'reasoning-get', 'reasoning-generate', 'reasoning-verify',
  'reasoning-run', 'reasoning-list', 'reasoning-frontmatter'
];

// Add cases in data_room switch:
case 'reasoning-get': {
  const reasoningOps = require('../core/reasoning-ops.cjs');
  const result = reasoningOps.getReasoning(roomDir, section);
  return textResponse(JSON.stringify(result, null, 2));
}
```

### Pattern 4: LazyGraph Edge Extension (follows lazygraph-ops.cjs)
**What:** New REASONING_INFORMS edge type connecting sections via reasoning dependencies
**When to use:** When reasoning frontmatter `requires`/`affects` fields are populated

```javascript
// Source: lib/core/lazygraph-ops.cjs (verified pattern)
// Add to EDGE_TYPES array:
const EDGE_TYPES = [
  'INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES',
  'BELONGS_TO', 'REASONING_INFORMS'  // NEW
];

// Add to initSchema():
await conn.query(
  `CREATE REL TABLE IF NOT EXISTS REASONING_INFORMS(FROM Section TO Section, provides STRING)`
);
```

### Pattern 5: MCP Resource (follows resources.cjs room:// scheme)
**What:** reasoning:// URI scheme for reading reasoning artifacts
**When to use:** Desktop users browsing reasoning state

```javascript
// Source: lib/mcp/resources.cjs (verified pattern)
// New resource: reasoning://state
server.resource(
  'reasoning-state',
  'reasoning://state',
  { description: 'Reasoning status across all sections', mimeType: 'application/json' },
  async (uri) => { /* list all sections with reasoning status */ }
);

// New template resource: reasoning://section/{name}
server.resource(
  'reasoning-section',
  new ResourceTemplate('reasoning://section/{name}', { list: undefined }),
  { description: 'Reasoning for a specific section', mimeType: 'text/markdown' },
  async (uri, { name }) => { /* return REASONING.md content */ }
);
```

### Pattern 6: Frontmatter CRUD (learned from GSD gsd-tools.cjs)
**What:** Programmatic frontmatter get/set/merge for reasoning files
**When to use:** REASON-05 requirement

```javascript
// Source: ~/.claude/get-shit-done/bin/lib/frontmatter.cjs (verified pattern)
// Key GSD functions to replicate:
// 1. extractFrontmatter(content) -> obj  (parse YAML frontmatter)
// 2. reconstructFrontmatter(obj) -> string  (serialize back to YAML)
// 3. spliceFrontmatter(content, newObj) -> string  (replace frontmatter in file)

// MindrianOS reasoning-ops.cjs will expose:
function getReasoningFrontmatter(roomDir, section, field) {
  // Read .reasoning/{section}/REASONING.md, parse frontmatter, return field or all
}
function setReasoningFrontmatter(roomDir, section, field, value) {
  // Read, parse, update field, splice back, write
}
function mergeReasoningFrontmatter(roomDir, section, data) {
  // Read, parse, merge obj, splice back, write
}
```

### Pattern 7: Methodology Run Artifact
**What:** Run logs that capture the autonomous chaining sequence
**When to use:** REASON-02 requirement

```markdown
---
run_id: run-2026-03-25-001
section: problem-definition
started: 2026-03-25T14:30:00Z
completed: 2026-03-25T14:32:15Z
steps:
  - diagnose
  - select-framework
  - apply
  - file
  - cross-reference
  - update-graph
brain_enriched: false
room_hash: abc123
---

# Methodology Run: problem-definition

## Step 1: Diagnose
> Problem type: Wicked (8/10 characteristics)
> Venture stage: Pre-Opportunity

## Step 2: Select Framework
> Selected: Minto Pyramid (structured argument)
> Why: problem-definition needs claim hierarchy

## Step 3: Apply
> Key claims extracted: [...]

## Step 4: File
> Filed REASONING.md to .reasoning/problem-definition/

## Step 5: Cross-Reference
> 2 cross-references: INFORMS market-analysis, AFFECTS solution-design

## Step 6: Update Graph
> REASONING_INFORMS edges created: 2
```

### Pattern 8: .reasoning/ Directory Structure
**What:** Per-project reasoning artifact storage (like .lazygraph/)
**When to use:** All reasoning persistence

```
room/.reasoning/
  problem-definition/
    REASONING.md           # Minto/MECE structured reasoning for this section
  market-analysis/
    REASONING.md
  solution-design/
    REASONING.md
  runs/
    run-2026-03-25-001.md  # Methodology run log
    run-2026-03-25-002.md
```

### Anti-Patterns to Avoid
- **Hand-rolling YAML parsing library:** Use the same regex/split pattern as persona-ops.cjs. Do NOT introduce js-yaml or any npm dependency.
- **Storing reasoning in section directories:** Reasoning goes in room/.reasoning/, NOT alongside section artifacts. This keeps the section folders clean and reasoning separate from content.
- **Making reasoning blocking:** The generate/run commands produce file outputs. The actual reasoning content is generated by Larry (the LLM), not by the Node.js code. The code provides structure, templates, and frontmatter CRUD -- Larry fills in the reasoning.
- **Coupling to Brain:** All reasoning operations must work at Tier 0 (no Brain). Brain enrichment is additive, never required. The `brain_enriched` frontmatter field tracks whether Brain was available.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom YAML parser library | Regex/split pattern from persona-ops.cjs | Established codebase convention, zero deps |
| Frontmatter CRUD | Raw string manipulation | extractFrontmatter/reconstructFrontmatter/spliceFrontmatter (GSD pattern) | Battle-tested in GSD for months, handles edge cases |
| Dependency graph resolution | Custom DAG solver | Simple requires/provides/affects field traversal | Full DAG is premature; field traversal matches GSD SUMMARY.md pattern |
| Room hash computation | Full content diff | MD5 of STATE.md (same pattern as persona-ops.cjs room_hash) | Lightweight staleness signal sufficient for Phase 16 |
| Section discovery | Hardcoded section list | discoverSections() from section-registry.cjs | Already built (Phase 10), handles core + extended dynamically |

**Key insight:** The reasoning engine is infrastructure code, not reasoning code. It provides the FILE STRUCTURE for Larry to fill with reasoning. The actual Minto/MECE analysis is performed by the LLM at conversation time. The .cjs code handles: creating templates, parsing frontmatter, managing run artifacts, feeding LazyGraph edges, and providing CLI/MCP access.

## Common Pitfalls

### Pitfall 1: Confusing Code Reasoning with LLM Reasoning
**What goes wrong:** Trying to implement Minto/MECE logic in Node.js code
**Why it happens:** The word "reasoning engine" suggests algorithmic reasoning
**How to avoid:** The code provides STRUCTURE (templates, frontmatter, file management). Larry provides CONTENT (actual reasoning, claims, verification criteria). The engine is like a filing cabinet, not a brain.
**Warning signs:** If you're writing logic to "analyze" section content, you've crossed the line.

### Pitfall 2: Blocking Post-Write Hook
**What goes wrong:** Adding reasoning triggers to post-write that take >3s
**Why it happens:** Want automatic reasoning updates when artifacts change
**How to avoid:** Post-write already has 3s timeout budget (hooks.json). Keep reasoning triggers lightweight (hash check only). Full reasoning regeneration is explicit via `reasoning generate`.
**Warning signs:** post-write hook timing out, user seeing delays after file writes.

### Pitfall 3: Frontmatter Schema Complexity
**What goes wrong:** The reasoning frontmatter schema is more complex than any existing module (nested objects under `requires`, nested objects under `confidence`, nested objects under `verification`)
**Why it happens:** The locked schema has 3 levels of nesting
**How to avoid:** The parseFrontmatter() from persona-ops.cjs handles 1 level of list nesting. For the reasoning schema, we need the more capable GSD extractFrontmatter() that handles nested objects and arrays. Port the GSD version.
**Warning signs:** `requires` field parsing returns strings instead of objects.

### Pitfall 4: LazyGraph Schema Migration
**What goes wrong:** Adding REASONING_INFORMS to existing databases without handling existing DBs
**Why it happens:** KuzuDB schema is created in initSchema(), but existing DBs may not have the new edge type
**How to avoid:** Use `CREATE REL TABLE IF NOT EXISTS` (already the pattern). KuzuDB idempotent DDL handles this.
**Warning signs:** None expected -- IF NOT EXISTS is already used everywhere.

### Pitfall 5: MCP Tool Count Bloat
**What goes wrong:** Adding too many reasoning subcommands inflates the data_room enum
**Why it happens:** REASON-05 wants full frontmatter CRUD
**How to avoid:** Bundle frontmatter operations under a single `reasoning-frontmatter` command that accepts JSON `{ action: "get"|"set"|"merge", section, field, value }` in the section parameter. Same pattern as invoke-persona accepting JSON.
**Warning signs:** DATA_ROOM_COMMANDS array exceeding 30 items.

## Code Examples

### REASONING.md Template (references/reasoning/reasoning-template.md)
```markdown
---
section: {section}
generated: {date}
methodology_run: {run_id}
requires:
  - section: {dependency_section}
    provides: "{what it provides}"
provides:
  - "{what this section provides}"
affects: ["{affected_section_1}", "{affected_section_2}"]
confidence:
  high: []
  medium: []
  low: []
verification:
  must_be_true:
    - "{verification criterion 1}"
    - "{verification criterion 2}"
  status: pending
brain_enriched: false
room_hash: {hash}
---

# {Section Label} -- Reasoning

## Why This Section Matters

{Larry fills: strategic importance of this section in the venture context}

## Key Claims & Assumptions

### High Confidence
{Larry fills: claims with strong evidence}

### Medium Confidence
{Larry fills: claims needing more evidence}

### Low Confidence
{Larry fills: speculative claims}

## Minto Structure

### Situation
{Larry fills: current state of affairs}

### Complication
{Larry fills: what changed or challenges the situation}

### Question
{Larry fills: the key question this section answers}

### Answer
{Larry fills: the section's core argument}

## Cross-Section Logic

{Larry fills: how this section connects to others}

## What Larry Would Challenge

{Larry fills: devil's advocate perspective}

## Verification Criteria

{Larry fills: what must be TRUE for this section to be complete}

---
*Generated by MindrianOS Reasoning Engine. This is structured critical thinking, not professional advice.*
```

### Core generateReasoning() Function
```javascript
// Source: follows persona-ops.cjs generatePersonas() pattern
function generateReasoning(roomDir, sectionName) {
  const resolved = path.resolve(roomDir);
  const stateContent = safeReadFile(path.join(resolved, 'STATE.md'));
  if (!stateContent) return { error: 'No room STATE.md found' };

  const sections = discoverSections(resolved);
  if (sectionName && !sections.all.includes(sectionName)) {
    return { error: `Section not found: ${sectionName}` };
  }

  const targetSections = sectionName ? [sectionName] : sections.all;
  const reasoningDir = path.join(resolved, '.reasoning');
  fs.mkdirSync(reasoningDir, { recursive: true });

  const roomHash = crypto.createHash('md5').update(stateContent).digest('hex').slice(0, 7);
  const date = new Date().toISOString().split('T')[0];
  const generated = [];

  for (const section of targetSections) {
    const sectionReasoningDir = path.join(reasoningDir, section);
    fs.mkdirSync(sectionReasoningDir, { recursive: true });

    const template = loadReasoningTemplate();
    const content = template
      .replace(/\{section\}/g, section)
      .replace(/\{date\}/g, date)
      .replace(/\{hash\}/g, roomHash)
      .replace(/\{Section Label\}/g, section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    fs.writeFileSync(path.join(sectionReasoningDir, 'REASONING.md'), content, 'utf-8');
    generated.push(section);
  }

  return { generated, room_hash: roomHash, reasoning_dir: '.reasoning/' };
}
```

### listReasoning() Function
```javascript
function listReasoning(roomDir) {
  const resolved = path.resolve(roomDir);
  const reasoningDir = path.join(resolved, '.reasoning');
  const sections = discoverSections(resolved);

  return sections.all.map(section => {
    const reasoningPath = path.join(reasoningDir, section, 'REASONING.md');
    const content = safeReadFile(reasoningPath);
    if (!content) return { section, has_reasoning: false };

    const fm = parseFrontmatter(content);
    return {
      section,
      has_reasoning: true,
      generated: fm.generated || null,
      verification_status: fm.verification?.status || 'unknown',
      confidence_summary: {
        high: Array.isArray(fm.confidence?.high) ? fm.confidence.high.length : 0,
        medium: Array.isArray(fm.confidence?.medium) ? fm.confidence.medium.length : 0,
        low: Array.isArray(fm.confidence?.low) ? fm.confidence.low.length : 0,
      },
      brain_enriched: fm.brain_enriched === true || fm.brain_enriched === 'true',
      room_hash: fm.room_hash || null,
    };
  });
}
```

### verifyReasoning() Function
```javascript
function verifyReasoning(roomDir, sectionName) {
  const resolved = path.resolve(roomDir);
  const reasoningPath = path.join(resolved, '.reasoning', sectionName, 'REASONING.md');
  const content = safeReadFile(reasoningPath);

  if (!content) return { error: `No reasoning found for section: ${sectionName}` };

  const fm = parseFrontmatter(content);
  const criteria = fm.verification?.must_be_true || [];

  return {
    section: sectionName,
    criteria,
    status: fm.verification?.status || 'pending',
    provides: fm.provides || [],
    requires: fm.requires || [],
    affects: fm.affects || [],
  };
}
```

### Frontmatter CRUD (REASON-05)
```javascript
// Port from GSD gsd-tools.cjs frontmatter.cjs
function getReasoningFrontmatter(roomDir, section, field) {
  const resolved = path.resolve(roomDir);
  const filePath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(filePath);
  if (!content) return { error: `No reasoning for section: ${section}` };

  const fm = parseFrontmatter(content);
  if (field) {
    return field in fm ? { [field]: fm[field] } : { error: `Field not found: ${field}` };
  }
  return fm;
}

function setReasoningFrontmatter(roomDir, section, field, value) {
  const resolved = path.resolve(roomDir);
  const filePath = path.join(resolved, '.reasoning', section, 'REASONING.md');
  const content = safeReadFile(filePath);
  if (!content) return { error: `No reasoning for section: ${section}` };

  const fm = parseFrontmatter(content);
  fm[field] = value;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  return { updated: true, section, field, value };
}
```

### LazyGraph Integration
```javascript
// In reasoning-ops.cjs: create REASONING_INFORMS edges from frontmatter
async function syncReasoningToGraph(roomDir, sectionName) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const fm = getReasoningFrontmatter(roomDir, sectionName);
    if (fm.error) return fm;

    // requires: create edges FROM dependency TO this section
    const requires = fm.requires || [];
    for (const req of requires) {
      const depSection = typeof req === 'string' ? req : req.section;
      const provides = typeof req === 'string' ? '' : (req.provides || '');
      if (depSection) {
        await lazygraph.queryGraph(conn,
          `MATCH (s1:Section {name: '${esc(depSection)}'}), (s2:Section {name: '${esc(sectionName)}'})
           MERGE (s1)-[:REASONING_INFORMS {provides: '${esc(provides)}'}]->(s2)`
        );
      }
    }

    // affects: create edges FROM this section TO affected sections
    const affects = fm.affects || [];
    for (const affected of affects) {
      await lazygraph.queryGraph(conn,
        `MATCH (s1:Section {name: '${esc(sectionName)}'}), (s2:Section {name: '${esc(affected)}'})
         MERGE (s1)-[:REASONING_INFORMS {provides: ''}]->(s2)`
      );
    }

    return { synced: true, section: sectionName, edges_created: requires.length + affects.length };
  } finally {
    await lazygraph.closeGraph(db);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Thinking traces shown in conversation only | Persistent .reasoning/ artifacts | Phase 16 (new) | Future sessions read reasoning without re-analysis |
| Manual methodology selection | Autonomous chaining (diagnose -> framework -> apply -> file -> cross-ref -> graph) | Phase 16 (new) | Larry orchestrates tool sequences programmatically |
| analyze-room finds gaps but no reasoning WHY | REASONING.md captures WHY per section | Phase 16 (new) | analyze-room can reference reasoning to explain gaps |
| LazyGraph has artifact-to-artifact edges only | REASONING_INFORMS adds section-to-section edges from reasoning deps | Phase 16 (new) | Graph queries reveal reasoning dependency chains |

**Existing infrastructure leveraged:**
- Thinking trace format (larry-personality SKILL.md v0.6.0) -- already blockquote-based, cross-platform
- LazyGraph KuzuDB (Phase 15) -- schema extension only, no new infrastructure
- parseFrontmatter pattern (Phase 13/14) -- reuse with enhanced nesting support
- post-write hook (Phase 15) -- already indexes artifacts, can check reasoning freshness
- MCP tool router (Phase 11) -- add commands to existing data_room group
- section-registry.cjs (Phase 10) -- dynamic section discovery already handles reasoning integration

## Open Questions

1. **Frontmatter Nesting Depth**
   - What we know: persona-ops.cjs parseFrontmatter handles 1 level of list nesting. The reasoning schema has 2-3 levels (confidence.high is a list, requires is a list of objects with section+provides fields, verification.must_be_true is a nested list).
   - What's unclear: Whether to port GSD's more capable extractFrontmatter() or extend the existing parseFrontmatter().
   - Recommendation: Port the GSD extractFrontmatter() pattern into reasoning-ops.cjs. It handles arbitrary nesting with a stack-based approach. Keep it local to reasoning-ops.cjs (same as persona-ops.cjs has its own copy).

2. **analyze-room Integration**
   - What we know: analyze-room is a Bash script that outputs structured lines. Reasoning should augment its output.
   - What's unclear: Whether to modify the Bash script or have reasoning-ops.cjs provide a separate reasoning status check.
   - Recommendation: Add a new Section 6 "## Reasoning" to analyze-room output. Check for .reasoning/ existence and stale hashes. Keep it lightweight (hash comparison only, no content parsing).

3. **Methodology Run Concurrency**
   - What we know: Runs are sequential (diagnose -> framework -> apply -> file -> cross-ref -> graph).
   - What's unclear: Can multiple sections be reasoned about in parallel?
   - Recommendation: Sequential per section. The run artifact captures one section's reasoning chain. Multiple sections can be queued but each runs independently.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash + Node.js assertion scripts (project convention) |
| Config file | None -- inline test scripts in test/ |
| Quick run command | `node bin/mindrian-tools.cjs reasoning list ./test/fixtures/room` |
| Full suite command | `bash test/test-reasoning.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REASON-01 | generateReasoning creates REASONING.md with correct frontmatter | unit | `node -e "require('./lib/core/reasoning-ops.cjs').generateReasoning('./test/fixtures/room', 'problem-definition')"` | Wave 0 |
| REASON-02 | Methodology run creates artifact in .reasoning/runs/ | unit | `node -e "require('./lib/core/reasoning-ops.cjs').createRun('./test/fixtures/room', 'problem-definition')"` | Wave 0 |
| REASON-03 | .reasoning/ dir created with correct structure | unit | `node -e "require('./lib/core/reasoning-ops.cjs').listReasoning('./test/fixtures/room')"` | Wave 0 |
| REASON-04 | MCP resource returns reasoning data | integration | `node bin/mindrian-tools.cjs reasoning list ./test/fixtures/room --raw` | Wave 0 |
| REASON-05 | Frontmatter get/set/merge on reasoning files | unit | `node -e "const r = require('./lib/core/reasoning-ops.cjs'); r.setReasoningFrontmatter('./test/fixtures/room', 'problem-definition', 'brain_enriched', true)"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node bin/mindrian-tools.cjs reasoning list ./test/fixtures/room`
- **Per wave merge:** `bash test/test-reasoning.sh` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/test-reasoning.sh` -- covers REASON-01 through REASON-05
- [ ] `test/fixtures/room/.reasoning/problem-definition/REASONING.md` -- test fixture
- [ ] `references/reasoning/reasoning-template.md` -- template file
- [ ] `references/reasoning/run-template.md` -- run artifact template

## Sources

### Primary (HIGH confidence)
- `bin/mindrian-tools.cjs` -- verified CLI entry point pattern, switch-case routing
- `lib/core/persona-ops.cjs` -- verified module pattern, parseFrontmatter, generatePersonas
- `lib/core/lazygraph-ops.cjs` -- verified KuzuDB schema, EDGE_TYPES, initSchema
- `lib/core/graph-ops.cjs` -- verified open-use-close pattern for all graph operations
- `lib/mcp/tool-router.cjs` -- verified hierarchical router, DATA_ROOM_COMMANDS enum
- `lib/mcp/resources.cjs` -- verified room:// URI scheme, ResourceTemplate usage
- `lib/core/section-registry.cjs` -- verified discoverSections(), STRUCTURAL_DIRS
- `~/.claude/get-shit-done/bin/lib/frontmatter.cjs` -- verified extractFrontmatter, reconstructFrontmatter, spliceFrontmatter
- `~/.claude/get-shit-done/bin/gsd-tools.cjs` -- verified frontmatter CRUD commands pattern
- `hooks/hooks.json` -- verified PostToolUse hook structure, 3s timeout
- `scripts/post-write` -- verified graph index background trigger, room detection
- `skills/larry-personality/SKILL.md` -- verified thinking trace blockquote format

### Secondary (MEDIUM confidence)
- GSD execute-phase.md workflow -- verified orchestration pattern for autonomous chaining

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in codebase, patterns verified in source
- Architecture: HIGH -- every pattern traced to existing codebase implementation
- Pitfalls: HIGH -- identified from direct code reading of frontmatter parsers, hook timeouts, and MCP tool routing

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- all patterns are established project conventions)
