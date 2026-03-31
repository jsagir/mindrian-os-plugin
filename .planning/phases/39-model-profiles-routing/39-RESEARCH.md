# Phase 39: Model Profiles & Routing - Research

**Researched:** 2026-03-31
**Domain:** Per-agent model resolution, cost optimization, venture-stage adaptive routing
**Confidence:** HIGH

## Summary

Phase 39 implements a model routing system for MindrianOS's 8 agents, directly adapted from GSD's proven pattern (model-profiles.cjs + resolveModelInternal in core.cjs). The GSD implementation provides a complete reference: a MODEL_PROFILES lookup table, a 4-step resolution function, config.json-based user preferences, and per-agent overrides. MindrianOS extends this with a 5th resolution step (venture-stage adaptive hints read from STATE.md) and per-room configuration (room/.config.json instead of .planning/config.json).

The implementation is straightforward CJS module work -- no external dependencies, no new frameworks. The primary complexity is the 5-step resolution cascade (override > stage-hint > inherit > profile > default) and the integration points: 5+ command files need dispatch instructions updated, and the post-write cascade needs model-per-step routing for its background subprocesses.

**Primary recommendation:** Port GSD's model-profiles.cjs and resolveModelInternal() pattern verbatim, adding the venture-stage hint layer. Keep the module self-contained in lib/core/model-profiles.cjs with zero npm dependencies.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Default profile for new rooms is **quality** (opus for teaching/grading, opus for structured work, sonnet for scanning). MindrianOS users want the best teaching experience.
- D-02: Global defaults implementation is Claude's discretion. Consider ~/.mindrian/defaults.json or similar for users who want to set once and inherit.
- D-03: Commands resolve model via model-profiles.cjs, then include `model: {resolved}` in dispatch instructions to the agent. Agent .md frontmatter stays `model: inherit`. Matches GSD's proven pattern.
- D-04: Cascade steps (classify, edge detection, proactive analysis) get model assignment via script-level resolution. post-write script calls model-profiles.cjs and passes resolved model as argument or env var to each cascade step.

### Claude's Discretion
- Global defaults architecture (D-02)
- Stage hint override behavior (whether hints override explicit profile or only fill gaps)
- Config file location and structure details (room/.config.json recommended per research)
- /mos:models command UX details (display format, confirmation flows)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODEL-01 | lib/core/model-profiles.cjs with MODEL_PROFILES table mapping 8 agents to 4 profile tiers | GSD's model-profiles.cjs provides exact pattern: const table + getAgentToModelMapForProfile() + formatAgentToModelMapAsTable() |
| MODEL-02 | Venture-stage adaptive hints that auto-select model tier based on STATE.md venture stage | state-ops.cjs getState() reads STATE.md; stage hint table defined in POWERHOUSE spec Part 4.2 |
| MODEL-03 | /mos:models command for viewing current profile, switching profiles, and overriding specific agents | GSD's /gsd:set-profile + /gsd:settings provide UX pattern; commands/*.md prose format |
| MODEL-04 | Per-room configuration stored in room/.config.json with model_profile and model_overrides fields | GSD uses .planning/config.json with loadConfig(); MindrianOS adapts to room/.config.json |
| MODEL-05 | Cascade step model routing: haiku for classify, sonnet for edge detection and proactive analysis | scripts/post-write is the integration point; currently fires 4 background processes without model control |
| MODEL-06 | 5-step model resolution: override > stage-hint > runtime > profile > default | GSD's resolveModelInternal() implements 4 of 5 steps; MindrianOS adds stage-hint between override and runtime |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Plugin format**: Must conform to Claude Code plugin structure (commands/, skills/, agents/, hooks/, .mcp.json, settings.json, plugin.json)
- **No server infrastructure**: Plugin runs entirely in Claude's environment
- **Three surfaces**: All features must work across CLI, Desktop, and Cowork
- **CJS module pattern**: All lib/core/*.cjs use module.exports with function exports
- **Script pattern**: scripts/* are bash that call node for CJS logic
- **Command dispatch**: commands/*.md describe agent dispatch in prose, not code
- **No npm dependencies**: lib/core/index.cjs uses only Node.js built-ins (fs, path, os)
- **Release process**: Version bump in plugin.json + CHANGELOG.md entry required for user-facing changes
- Never use em-dashes in output

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path) | N/A | File I/O, path resolution | Zero-dependency constraint from CLAUDE.md |
| lib/core/index.cjs | existing | output(), error(), safeReadFile() | Established plugin pattern |
| lib/core/state-ops.cjs | existing | getState() for venture stage reading | Already exports room state reader |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GSD model-profiles.cjs | reference | Pattern source for MODEL_PROFILES table | Architecture reference only, not imported |
| GSD core.cjs resolveModelInternal | reference | Pattern source for 5-step resolution | Architecture reference only, not imported |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CJS module | JSON config file | CJS allows functions (formatTable, resolve); JSON is data-only |
| room/.config.json | room/STATE.md YAML frontmatter | Separate config file avoids STATE.md bloat; matches GSD pattern |
| Inline stage hints | External stage-hints.json | Inline in model-profiles.cjs keeps single source of truth |

## Architecture Patterns

### Recommended Project Structure
```
lib/core/
  model-profiles.cjs      # NEW: MODEL_PROFILES table, resolveModel(), stage hints
commands/
  models.md                # NEW: /mos:models command
room/.config.json          # NEW: per-room model config (created by /mos:models or room init)
~/.mindrian/defaults.json  # NEW: global defaults (optional, user-created)
```

### Pattern 1: MODEL_PROFILES Table (from GSD model-profiles.cjs)
**What:** Static const mapping agent names to model aliases per profile tier
**When to use:** Single source of truth for all model assignments
**Example:**
```javascript
// Source: GSD model-profiles.cjs (adapted for MindrianOS 8 agents)
const MODEL_PROFILES = {
  'larry-extended':      { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'framework-runner':    { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'grading':             { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'investor':            { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'brain-query':         { quality: 'opus', balanced: 'sonnet', budget: 'haiku'  },
  'research':            { quality: 'opus', balanced: 'sonnet', budget: 'haiku'  },
  'opportunity-scanner': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'persona-analyst':     { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};
```

### Pattern 2: Venture-Stage Adaptive Hints (MindrianOS-unique)
**What:** Stage-based model overrides that auto-downgrade/upgrade based on venture maturity
**When to use:** When profile = quality/balanced/budget AND room has a recognized venture stage
**Example:**
```javascript
// Source: POWERHOUSE-1.6.0-SPEC.md Part 4.2
const STAGE_HINTS = {
  'Pre-Opportunity': { 'framework-runner': 'sonnet', 'research': 'haiku', 'grading': null, 'investor': null },
  'Discovery':       { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'sonnet', 'investor': null },
  'Validation':      { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'opus',   'investor': 'sonnet' },
  'Design':          { 'framework-runner': 'opus',   'research': 'sonnet', 'grading': 'opus',   'investor': 'sonnet' },
  'Investment':      { 'framework-runner': 'opus',   'research': 'opus',   'grading': 'opus',   'investor': 'opus' },
};
// null = "skip" (agent should not be invoked at this stage)
```

### Pattern 3: 5-Step Resolution (extended from GSD's 4-step)
**What:** Cascading resolution that checks override > stage-hint > inherit > profile > default
**When to use:** Every time a command dispatches an agent
**Example:**
```javascript
// Source: GSD core.cjs resolveModelInternal() lines 1000-1031, extended
function resolveModel(roomDir, agentType) {
  const config = loadRoomConfig(roomDir);

  // Step 1: Per-agent override (always wins)
  const override = config.model_overrides?.[agentType];
  if (override) return override;

  // Step 2: Venture-stage hint
  const stage = parseVentureStage(roomDir);
  if (stage && STAGE_HINTS[stage]?.[agentType] !== undefined) {
    const hint = STAGE_HINTS[stage][agentType];
    if (hint === null) return 'skip'; // Agent should not run at this stage
    return hint;
  }

  // Step 3: Inherit profile = use parent session model
  const profile = String(config.model_profile || 'quality').toLowerCase();
  if (profile === 'inherit') return 'inherit';

  // Step 4: Profile lookup
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  return agentModels[profile] || agentModels['balanced'] || 'sonnet';

  // Step 5 is implicit: 'sonnet' default from the line above
}
```

### Pattern 4: Cascade Step Model Routing
**What:** Model assignment for post-write cascade background processes
**When to use:** In scripts/post-write when spawning classify, edge detection, HSI steps
**Example:**
```javascript
// Source: POWERHOUSE-1.6.0-SPEC.md Part 4.4
const CASCADE_MODELS = {
  'classify':           'haiku',   // Pattern matching, fast
  'detect-edges':       'sonnet',  // Relationship reasoning
  'proactive-analysis': 'sonnet',  // Contradiction detection
  'hsi-to-kuzu':        'haiku',   // Data insertion
  'compute-state':      null,      // Script aggregation, no LLM
};
```

### Pattern 5: Per-Room Config (room/.config.json)
**What:** Room-level configuration for model profile and overrides
**When to use:** Created by /mos:models or /mos:new-project; read by resolveModel()
**Example:**
```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "grading": "opus"
  }
}
```

### Pattern 6: Global Defaults (~/.mindrian/defaults.json)
**What:** User-level defaults that apply to all rooms unless overridden
**When to use:** User runs /mos:models set-default balanced; new rooms inherit this
**Recommendation:** Load order: room/.config.json > ~/.mindrian/defaults.json > hardcoded 'quality'
```json
{
  "model_profile": "balanced"
}
```

### Anti-Patterns to Avoid
- **Modifying agent .md frontmatter model field:** Agent files stay `model: inherit`. Resolution happens at dispatch time in the command, not in the agent definition. GSD does this and it works.
- **Storing model config in STATE.md:** STATE.md is for venture state, not plugin config. Keep config in room/.config.json.
- **Resolving models inside agent definitions:** Agents are dispatched by commands. Commands resolve the model before dispatch. Agents never self-resolve.
- **Hard-coding full model IDs:** Use aliases (opus/sonnet/haiku). The MODEL_ALIAS_MAP in GSD maps these to full IDs when needed. MindrianOS may need this for future non-Claude runtime support.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config file loading | Custom parser | JSON.parse + safeReadFile from index.cjs | JSON is the established pattern in this codebase |
| STATE.md stage parsing | Regex on full STATE.md | Parse YAML frontmatter or grep for venture_stage field | STATE.md format is already defined with known fields |
| Table formatting for /mos:models | Custom string builder | Adapt GSD's formatAgentToModelMapAsTable() | Already handles padding and separators |
| Config merging (room + global) | Deep merge utility | Shallow spread: {...globalDefaults, ...roomConfig} | Only 2 top-level keys (model_profile, model_overrides) need merging |

## Common Pitfalls

### Pitfall 1: Stage Hints vs Profile Conflict
**What goes wrong:** User sets profile to "budget" but stage hint says "opus" for grading at Investment stage. Which wins?
**Why it happens:** The 5-step resolution order puts stage-hint (step 2) before profile (step 4), so stage hints override profile choices.
**How to avoid:** Document this clearly. Stage hints are cost OPTIMIZATION hints, not cost REDUCTION. At Investment stage, the system upgrades models regardless of profile. If user explicitly overrides (step 1), that always wins.
**Warning signs:** User complains about unexpected opus usage on budget profile during Investment stage.

### Pitfall 2: "skip" Return Value from Stage Hints
**What goes wrong:** resolveModel returns "skip" for investor agent at Pre-Opportunity stage, but the command dispatches anyway.
**Why it happens:** Commands need to check for "skip" return and not dispatch the agent.
**How to avoid:** Commands that dispatch agents must handle the "skip" return: if resolveModel returns "skip", do not spawn the agent. Display a message like "Investor review not applicable at Pre-Opportunity stage."
**Warning signs:** Errors from trying to spawn an agent with model="skip".

### Pitfall 3: Missing room/.config.json
**What goes wrong:** resolveModel crashes on first use before user has configured anything.
**Why it happens:** room/.config.json doesn't exist until /mos:models is run or room is initialized.
**How to avoid:** loadRoomConfig must return sensible defaults when file doesn't exist. GSD's loadConfig does this with a defaults object + try/catch. Copy this pattern exactly.
**Warning signs:** Errors on first /mos:act before any model configuration.

### Pitfall 4: Cascade Steps Don't Use LLM Models
**What goes wrong:** Trying to pass model parameter to classify-insight (which is a bash grep script, not an LLM call).
**Why it happens:** The current cascade is keyword-based bash scripts, not LLM-powered subagents.
**How to avoid:** CASCADE_MODELS is a FUTURE integration point. Currently classify-insight is regex-based. The model routing for cascade steps applies when/if cascade steps are upgraded to LLM calls (e.g., via the Task tool). For now, document the table and wire it when cascade steps become LLM-powered.
**Warning signs:** Trying to pass --model to a bash script that doesn't accept it.

### Pitfall 5: Three-Surface Consistency
**What goes wrong:** /mos:models works on CLI but not on Desktop or Cowork.
**Why it happens:** Command is written as a CLI-only experience.
**How to avoid:** /mos:models is a commands/*.md file -- it works on all surfaces by definition. The model resolution in lib/core/model-profiles.cjs is surface-agnostic (pure Node.js). No surface-specific code needed.
**Warning signs:** None expected -- the plugin architecture handles this.

### Pitfall 6: Global Defaults File Location
**What goes wrong:** ~/.mindrian/ directory doesn't exist, defaults.json write fails.
**Why it happens:** First-time user hasn't created the directory.
**How to avoid:** mkdir -p before writing, or use safeReadFile pattern (return null if not found, use hardcoded defaults).
**Warning signs:** ENOENT errors when loading global defaults.

## Code Examples

### Loading Room Config with Fallback
```javascript
// Source: GSD core.cjs loadConfig() pattern, adapted for room/.config.json
function loadRoomConfig(roomDir) {
  const defaults = {
    model_profile: 'quality',  // D-01: default is quality for MindrianOS
    model_overrides: {},
  };

  // Try room-level config first
  const roomConfigPath = path.join(roomDir, '.config.json');
  const roomRaw = safeReadFile(roomConfigPath);
  if (roomRaw) {
    try {
      const parsed = JSON.parse(roomRaw);
      return { ...defaults, ...parsed };
    } catch (e) { /* fall through */ }
  }

  // Try global defaults
  const globalPath = path.join(os.homedir(), '.mindrian', 'defaults.json');
  const globalRaw = safeReadFile(globalPath);
  if (globalRaw) {
    try {
      const parsed = JSON.parse(globalRaw);
      return { ...defaults, ...parsed };
    } catch (e) { /* fall through */ }
  }

  return defaults;
}
```

### Parsing Venture Stage from STATE.md
```javascript
// Source: Adapted from state-ops.cjs getState() + STATE.md format
function parseVentureStage(roomDir) {
  const stateContent = getState(roomDir);
  if (!stateContent) return null;

  // STATE.md has a "Stage:" or "Venture Stage:" line
  const match = stateContent.match(/(?:Venture\s+)?Stage:\s*(.+)/i);
  if (!match) return null;

  const stage = match[1].trim();
  const validStages = ['Pre-Opportunity', 'Discovery', 'Validation', 'Design', 'Investment'];
  return validStages.find(s => s.toLowerCase() === stage.toLowerCase()) || null;
}
```

### Command Dispatch with Model Resolution
```markdown
<!-- In commands/act.md, add before Step 2 dispatch -->
## Step 1.5: Resolve Model

Run model resolution for the agent being dispatched:
```
node lib/core/model-profiles.cjs resolve <roomDir> framework-runner
```

If result is "skip", tell user: "Framework execution not available at current venture stage."
If result is a model name, include `model: {result}` in the agent dispatch.
```

### /mos:models Command Display Format
```
MindrianOS Model Profile
========================
Room: ~/projects/my-venture/room
Profile: balanced
Stage: Validation (adaptive hints active)

Agent               Model (resolved)
-------------------------------------------
larry-extended      opus (profile)
framework-runner    opus (stage: Validation)
grading             opus (stage: Validation)
investor            sonnet (stage: Validation)
brain-query         sonnet (profile)
research            sonnet (profile)
opportunity-scanner sonnet (profile)
persona-analyst     sonnet (profile)

Cascade Steps
-------------------------------------------
classify            haiku
detect-edges        sonnet
proactive-analysis  sonnet

Overrides: none
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All agents use session model | Per-agent model routing via profiles | GSD implementation (2026) | 66-86% cost savings on balanced/budget |
| Static model assignment | Venture-stage adaptive hints | MindrianOS 1.6.0 (new) | Auto-optimize cost based on venture maturity |
| Global config only | Per-room config + global defaults | MindrianOS 1.6.0 (new) | Different ventures can have different cost profiles |

**Model alias mapping (from GSD core.cjs line 994-998):**
- opus = claude-opus-4-0
- sonnet = claude-sonnet-4-5
- haiku = claude-haiku-3-5

These aliases are current as of the GSD codebase. MindrianOS should use aliases (not full IDs) and optionally support resolve_model_ids for future non-Claude runtime compatibility.

## Open Questions

1. **Stage hint override behavior**
   - What we know: Resolution order is override > stage-hint > inherit > profile > default
   - What's unclear: Should stage hints ONLY fill gaps (agents without explicit profile assignment) or should they override profile choices? The spec says stage hints are step 2 (before profile lookup), implying they override.
   - Recommendation: Stage hints override profile lookup. Per-agent overrides override stage hints. This matches GSD's escalation pattern and the spec's resolution order. Document clearly.

2. **Cascade steps -- are they LLM calls today?**
   - What we know: classify-insight is a bash grep script (no LLM). HSI computation is Python (no LLM). KuzuDB indexing is Node.js (no LLM). Edge detection and proactive analysis run via the Write hook cascade.
   - What's unclear: The cascade MODEL_PROFILES table implies LLM-powered cascade steps, but current implementation is all scripts.
   - Recommendation: Define CASCADE_MODELS table now as a forward-looking constant. Wire it when cascade steps become LLM-powered (potentially Phase 40 SubagentStop hook or Phase 41 parallel agents). For now, the table documents intent.

3. **resolve_model_ids for MindrianOS**
   - What we know: GSD supports resolve_model_ids: true/false/"omit" for non-Claude runtimes
   - What's unclear: Does MindrianOS need this? Claude Code plugin format implies Claude-only.
   - Recommendation: Add resolve_model_ids support but don't wire it yet. Return aliases by default. This future-proofs for Codex/OpenCode compatibility if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no automated test framework in plugin) |
| Config file | None -- plugin has no test config |
| Quick run command | `node lib/core/model-profiles.cjs resolve /tmp/test-room framework-runner` |
| Full suite command | Manual: create room/.config.json, test each resolution step |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODEL-01 | MODEL_PROFILES table has 8 agents x 4 profiles | smoke | `node -e "const m = require('./lib/core/model-profiles.cjs'); console.log(Object.keys(m.MODEL_PROFILES).length)"` | Wave 0 |
| MODEL-02 | Stage hints resolve correctly per venture stage | smoke | `node -e "const m = require('./lib/core/model-profiles.cjs'); console.log(m.resolveModel('/tmp/test-room', 'grading'))"` | Wave 0 |
| MODEL-03 | /mos:models command exists and is well-formed | smoke | `head -5 commands/models.md` | Wave 0 |
| MODEL-04 | room/.config.json loads with defaults when missing | smoke | `node -e "const m = require('./lib/core/model-profiles.cjs'); console.log(m.loadRoomConfig('/tmp/nonexistent'))"` | Wave 0 |
| MODEL-05 | CASCADE_MODELS table defined | smoke | `node -e "const m = require('./lib/core/model-profiles.cjs'); console.log(m.CASCADE_MODELS)"` | Wave 0 |
| MODEL-06 | 5-step resolution: override beats stage-hint beats profile | smoke | Create test room with override + stage + profile, verify override wins | Wave 0 |

### Sampling Rate
- **Per task commit:** `node -e "require('./lib/core/model-profiles.cjs')"` (import check)
- **Per wave merge:** Manual test of resolve flow with test room
- **Phase gate:** All 6 MODEL requirements verified via smoke tests

### Wave 0 Gaps
- [ ] lib/core/model-profiles.cjs -- the entire module (Wave 0 creates it)
- [ ] commands/models.md -- the command file
- [ ] Smoke test script for resolution cascade

## Sources

### Primary (HIGH confidence)
- GSD model-profiles.cjs -- exact pattern source, read in full (68 lines)
- GSD core.cjs resolveModelInternal() -- lines 994-1031, 4-step resolution logic
- GSD core.cjs loadConfig() -- lines 197-227, config loading with defaults
- GSD references/model-profiles.md -- profile philosophy, rationale for tier assignments
- GSD init.cjs -- model resolution at orchestration time (resolveModelInternal calls)
- POWERHOUSE-1.6.0-SPEC.md Part 4 -- MindrianOS profile table, stage hints, resolution order, cascade routing, cost impact
- RESEARCH_11_POWERHOUSE_SESSION.md Step 7 -- GSD model routing analysis and MindrianOS adaptation decisions

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-04 -- locked implementation choices from user discussion
- Existing agent .md files (all 8) -- confirmed `model: inherit` frontmatter pattern
- scripts/post-write -- confirmed cascade integration point (127 lines)
- lib/core/state-ops.cjs -- confirmed getState() available for stage reading

### Tertiary (LOW confidence)
- Cascade step LLM routing -- speculative, current cascade is non-LLM scripts. Table defined as forward-looking.
- resolve_model_ids need -- unclear if MindrianOS needs non-Claude runtime support

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- direct port of proven GSD pattern with complete source code access
- Architecture: HIGH -- resolution order, config loading, table structure all verified from GSD source
- Pitfalls: HIGH -- identified from GSD's own edge cases (missing config, inherit handling, alias mapping)
- Stage hints: MEDIUM -- MindrianOS-unique extension, no prior implementation to reference
- Cascade routing: LOW -- cascade steps are currently non-LLM; table is forward-looking

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, no external dependencies)
