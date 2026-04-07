# Architecture Research: Context Engineering Integration

**Domain:** Claude Code plugin context optimization
**Researched:** 2026-04-07
**Confidence:** HIGH (verified against official Claude Code docs + existing codebase)

## System Overview: Current vs Target

### Current Architecture (v1.8.8)

```
SESSION START
    |
    v
hooks/hooks.json --> run-hook.cmd --> scripts/session-start
    |
    |--- resolve-room (find active room)
    |--- user-archetype.cjs (detect archetype)
    |--- mcp-profiles.cjs (MCP profile)
    |--- compute-state (scan room dirs)
    |--- analyze-room (proactive intelligence)
    |--- build-jtbd-nudges (greeting nudges)
    |--- sync-rooms-graph (background, fire-and-forget)
    |--- sync-rooms-brain (background, fire-and-forget)
    |
    v
JSON output: { additionalContext: "stable_prefix + dynamic_suffix" }
    |
    v
Claude loads: CLAUDE.md (35KB) + includes (6KB) + 7 SKILL.md files (37KB)
             + skill extras (13KB) + session-start context (~2-5KB)
             = ~93-96KB always-on context
```

**Problem:** Claude Code natively loads skill descriptions into context for auto-discovery. With 7 always-active skills totaling 37KB of SKILL.md content plus 13KB of extras, combined with a 35KB CLAUDE.md and 6KB of includes, the fixed overhead is massive. On Sonnet (200K window), this consumes ~23.6K tokens before the user types a word.

### Target Architecture (v1.9.0)

```
SESSION START
    |
    v
hooks/hooks.json --> run-hook.cmd --> scripts/session-start
    |
    |--- resolve-room (unchanged)
    |--- user-archetype.cjs (unchanged)
    |--- context-profile.cjs (NEW: read .context-profile.json)
    |--- compute-state (unchanged, BUT cached via state-cache.cjs)
    |--- analyze-room (unchanged, BUT results cached)
    |
    v
JSON output: { additionalContext: "slim_prefix + targeted_dynamic" }
    |
    v
Claude loads: CLAUDE.md (20KB, theory extracted) + includes (3KB, trimmed)
             + 3 always-on skills (larry-personality, pws-methodology, ui-system ~15KB)
             + 4 conditional skills (descriptions only ~1KB until invoked)
             + session-start context (~1-3KB tiered)
             = ~40-42KB always-on context (56% reduction)
```

## Component Responsibilities

### Existing Components (Modified)

| Component | Current Role | v1.9.0 Change | Modification Type |
|-----------|-------------|---------------|-------------------|
| `CLAUDE.md` | 35KB monolith with architecture, moat, decisions, release process, full stack docs | Split to ~20KB core. Theory, stack docs, architecture deep-dives extracted to `references/` | **MODIFY** - content extraction, not structural change |
| `.claude/includes/*.md` | 6KB of architecture, moat, decisions, release-process | Trim to ~3KB. Remove duplicated content already in CLAUDE.md | **MODIFY** - deduplication |
| `skills/*/SKILL.md` | 7 skills, all auto-invocable, all loaded into context | Split into 3 always-on + 4 on-demand. On-demand skills get `disable-model-invocation: true` with supporting files pattern | **MODIFY** - frontmatter changes + content restructuring |
| `skills/larry-personality/` | SKILL.md (5KB) + framework-chains.md (5KB) + mode-engine.md (8KB) = 18KB total | SKILL.md stays always-on (~3KB trimmed). framework-chains.md and mode-engine.md become supporting files loaded on-demand via `[reference.md](reference.md)` pattern | **MODIFY** - progressive disclosure within skill |
| `scripts/session-start` | 400-line bash script handling all context assembly | Add cache reads, context-profile integration, slimmer stable_prefix | **MODIFY** - add caching layer calls |
| `scripts/compute-state` | Full room scan every session | Add delta detection: compare mtime of STATE.md vs room dirs, skip if unchanged | **MODIFY** - add short-circuit logic |
| `lib/core/user-archetype.cjs` | Detect venturist/researcher/student | Unchanged, already efficient | **NO CHANGE** |
| `settings.json` | Lists 7 skills with `when` conditions | Update skill list to reflect 3 always-on + 4 on-demand | **MODIFY** - skill list update |

### New Components

| Component | Purpose | Location | Integration Point |
|-----------|---------|----------|-------------------|
| `lib/core/context-profile.cjs` | Read/generate `.context-profile.json` per room | `lib/core/` | Called by `session-start` before tiered loading |
| `lib/core/state-cache.cjs` | Cache STATE.md computation with TTL, delta detection | `lib/core/` | Called by `session-start` instead of raw `compute-state` |
| `lib/core/brain-cache.cjs` | Cache Brain API responses with 24h TTL | `lib/core/` | Called by `brain-client.cjs` as middleware |
| `lib/core/learnings-rotation.cjs` | Rotate `.learnings.md` to keep last 20 sessions | `lib/core/` | Called by `learn-from-usage` script |
| `references/architecture-theory.md` | Simon, Rittel & Webber, ICM theory (extracted from CLAUDE.md) | `references/` | Referenced by skills when methodology sessions need theory |
| `references/stack-reference.md` | Full technology stack docs (extracted from CLAUDE.md) | `references/` | Referenced by development-focused skills |
| `references/moat-deep-dive.md` | Full moat analysis (extracted from CLAUDE.md) | `references/` | Referenced by Brain connector skill |

## Recommended Project Structure Changes

```
mindrian-os/                        # Plugin root
CLAUDE.md                           # MODIFY: 35KB -> 20KB (theory extracted)
.claude/
  includes/
    architecture.md                 # MODIFY: trim, deduplicate
    decisions.md                    # MODIFY: trim
    moat.md                         # MODIFY: trim
    release-process.md              # NO CHANGE (already small, 941B)
skills/
  larry-personality/
    SKILL.md                        # MODIFY: trim to ~3KB core
    framework-chains.md             # NO CHANGE (becomes lazy-loaded supporting file)
    mode-engine.md                  # NO CHANGE (becomes lazy-loaded supporting file)
  pws-methodology/
    SKILL.md                        # NO CHANGE (already 2KB, smallest skill)
  ui-system/
    SKILL.md                        # MODIFY: add disable-model-invocation: true
    ui-reference.md                 # NEW: detailed patterns (extracted from SKILL.md)
  room-passive/
    SKILL.md                        # MODIFY: add disable-model-invocation: true, trim
  room-proactive/
    SKILL.md                        # MODIFY: add disable-model-invocation: true, trim
  context-engine/
    SKILL.md                        # MODIFY: add disable-model-invocation: true, trim
  brain-connector/
    SKILL.md                        # MODIFY: add disable-model-invocation: true, trim
lib/core/
  context-profile.cjs               # NEW
  state-cache.cjs                   # NEW
  brain-cache.cjs                   # NEW
  learnings-rotation.cjs            # NEW
  brain-client.cjs                  # MODIFY: add cache layer
  [all other .cjs files]            # NO CHANGE
references/
  architecture-theory.md            # NEW (extracted from CLAUDE.md)
  stack-reference.md                # NEW (extracted from CLAUDE.md)
  moat-deep-dive.md                 # NEW (extracted from CLAUDE.md)
  document-generation.md            # NO CHANGE
  pws-profile-generation.md         # NO CHANGE
scripts/
  session-start                     # MODIFY: integrate caching + profiles
  compute-state                     # MODIFY: add delta detection
  learn-from-usage                  # MODIFY: integrate rotation
  [all other scripts]               # NO CHANGE
hooks/
  hooks.json                        # NO CHANGE (hook structure unchanged)
  run-hook.cmd                      # NO CHANGE
settings.json                       # MODIFY: update skill list
```

### Structure Rationale

- **Skills split into always-on vs on-demand:** Claude Code natively supports progressive disclosure. Setting `disable-model-invocation: true` removes the skill's description from context entirely. The skill still works when explicitly invoked via `/mos:skill-name`. For room-passive, room-proactive, context-engine, and brain-connector, these are background knowledge skills that Claude should use implicitly, not invoke explicitly. The solution: session-start hook injects a compact summary of what these skills do (~200 tokens) as part of additionalContext, rather than loading the full 22KB of SKILL.md content.

- **Supporting files pattern for larry-personality:** Official docs say "Keep SKILL.md under 500 lines. Move detailed reference material to separate files." The framework-chains.md and mode-engine.md files already exist as separate files but are currently loaded alongside SKILL.md. By referencing them with `[reference.md](reference.md)` pattern in SKILL.md, Claude loads them only when a methodology session needs deep framework chaining or mode engine details.

- **references/ for extracted theory:** CLAUDE.md currently contains ~15KB of theoretical content (Simon's Architecture of Complexity, ICM x Wicked Problem Management, Moat Formula, full stack documentation). This content is valuable during specific methodology sessions but unnecessary for every turn. Extracting to references/ makes it available via Read tool when needed.

## Architectural Patterns

### Pattern 1: Stub + Supporting Files (Progressive Skill Loading)

**What:** Reduce always-on skill content by splitting each skill into a compact SKILL.md stub (~500 lines / ~3KB) with detailed reference content in supporting files that Claude loads on demand.

**When to use:** Any skill that exceeds 3KB and contains reference material not needed on every turn.

**Trade-offs:** Slightly slower first-use of detailed features (one Read tool call). Much lower fixed context overhead. Claude Code natively supports this pattern per official docs.

**Example:**

```yaml
# skills/brain-connector/SKILL.md (trimmed stub)
---
name: brain-connector
description: Brain enrichment for Larry. Weaves graph context into responses.
disable-model-invocation: true
---

# Brain Connector

## When Active
Brain available when MINDRIAN_BRAIN_KEY set or Brain MCP configured.

## Quick Reference
- Query types: framework lookup, cross-reference, grading calibration
- Response format: JSON with confidence scores
- For detailed API patterns, see [brain-api-patterns.md](brain-api-patterns.md)
- For enrichment rules, see [enrichment-rules.md](enrichment-rules.md)
```

### Pattern 2: Hook-Injected Skill Summaries

**What:** Instead of loading 4 background skills as full SKILL.md files, the session-start hook injects a compact summary of their behaviors as part of additionalContext. This gives Claude awareness of what the skills do without the full instruction set.

**When to use:** Skills that provide background behavioral guidance (room awareness, proactive intelligence, context management) rather than explicit task instructions.

**Trade-offs:** Claude gets less detailed instructions for background behaviors. In practice, these skills define behaviors Claude already exhibits when given the room state context. The detailed instructions are redundant for experienced sessions. For edge cases, the full skill can still be invoked explicitly.

**Example:**

```bash
# In session-start, instead of relying on Claude loading all SKILL.md files:
SKILL_SUMMARIES="## Active Background Skills
- Room Passive: File new artifacts to appropriate room sections. Use [[wikilinks]] for cross-references.
- Room Proactive: After filing, scan for INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES edges.
- Context Engine: Manage USER.md, track sessions, adapt verbosity to context budget.
- Brain Connector: Query brain.mindrian.ai for framework enrichment when available."
```

### Pattern 3: State Cache with Delta Detection

**What:** Cache the output of compute-state in a JSON file with a TTL. On subsequent session starts, compare the modification times of room directories against the cache timestamp. If nothing changed, use cached state instead of re-scanning.

**When to use:** Session start for rooms with many sections and artifacts. compute-state currently scans every directory and counts files on every session start.

**Trade-offs:** Stale state for up to N minutes after external file changes. Mitigated by the FileChanged hook which can invalidate the cache. Cache miss costs one extra file read.

**Example:**

```javascript
// lib/core/state-cache.cjs
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedState(roomDir) {
  const cachePath = path.join(roomDir, '.context', 'state-cache.json');
  if (!fs.existsSync(cachePath)) return null;

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const age = Date.now() - cache.timestamp;
  if (age > CACHE_TTL_MS) return null;

  // Delta detection: check if any section dir is newer than cache
  const sections = fs.readdirSync(roomDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'));
  for (const s of sections) {
    const stat = fs.statSync(path.join(roomDir, s.name));
    if (stat.mtimeMs > cache.timestamp) return null; // invalidated
  }

  return cache.state; // cache hit
}
```

### Pattern 4: Context Profile Per Room

**What:** A `.context-profile.json` file in each room's `.context/` directory that captures the room's usage patterns and context preferences. Auto-generated from analytics, manually overridable.

**When to use:** Rooms with established usage patterns (5+ sessions). New rooms use defaults.

**Trade-offs:** One more file to maintain. Auto-generation handles this. Provides per-room context budgeting that the current global tiering cannot.

**Example:**

```json
{
  "version": 1,
  "generated": "2026-04-07T10:00:00Z",
  "context_preferences": {
    "always_load": ["larry-personality", "pws-methodology"],
    "load_on_demand": ["brain-connector", "room-proactive"],
    "never_load": [],
    "preferred_tier": "balanced"
  },
  "usage_signals": {
    "primary_commands": ["mos:act", "mos:pipeline", "mos:file"],
    "avg_session_length": 45,
    "brain_usage_frequency": "high",
    "methodology_depth": "deep"
  },
  "overrides": {}
}
```

### Pattern 5: CLAUDE.md Content Extraction

**What:** Extract theoretical and reference content from CLAUDE.md to separate files in `references/`, keeping CLAUDE.md focused on identity, constraints, key decisions, and active instructions.

**When to use:** When CLAUDE.md exceeds 20KB and contains content that is not needed on every turn.

**Trade-offs:** Claude must Read reference files when deep context is needed. For methodology sessions this adds one tool call. For routine interactions (90%+ of turns), the reduced CLAUDE.md loads faster and wastes less context.

**Content extraction plan:**

| Section in CLAUDE.md | Size | Action | Target |
|---------------------|------|--------|--------|
| What Is This? + Three Layers | ~1KB | KEEP - core identity | CLAUDE.md |
| Tri-Polar Design Rule | ~1KB | KEEP - active constraint | CLAUDE.md |
| The Moat (detailed) | ~3KB | EXTRACT summary, move details | references/moat-deep-dive.md |
| Architecture (Simon + ICM + Wicked) | ~8KB | EXTRACT summary, move theory | references/architecture-theory.md |
| Key Decisions table | ~1KB | KEEP - active reference | CLAUDE.md |
| Technology Stack (full) | ~8KB | EXTRACT entirely | references/stack-reference.md |
| Release Process | ~1KB | KEEP - active instruction | CLAUDE.md |
| MWP Moat Awareness | ~0.5KB | KEEP - active mandate | CLAUDE.md |
| Source Material table | ~1KB | EXTRACT | references/stack-reference.md |
| Room Structure Evolution | ~2KB | EXTRACT | references/architecture-theory.md |
| Plugin Structure diagram | ~0.5KB | KEEP - active reference | CLAUDE.md |

**Estimated result:** CLAUDE.md drops from 35KB to ~18-20KB. References gain ~15KB of content accessible on demand.

## Data Flow

### Session Start Flow (v1.9.0)

```
SessionStart hook fires
    |
    v
run-hook.cmd -> scripts/session-start
    |
    +---> resolve-room ---------> ROOM_DIR
    |
    +---> user-archetype.cjs ---> archetype, sessionCount, domain
    |
    +---> context-profile.cjs --> context_preferences (NEW)
    |         |
    |         +---> reads room/.context/.context-profile.json
    |         +---> if missing, generates from analytics
    |         +---> returns skill loading preferences
    |
    +---> state-cache.cjs ------> cached or fresh state (NEW)
    |         |
    |         +---> checks cache at room/.context/state-cache.json
    |         +---> delta detection against room dir mtimes
    |         +---> cache hit: return cached state (~0ms)
    |         +---> cache miss: call compute-state, write cache
    |
    +---> tiered context assembly (existing, with profile input)
    |         |
    |         +---> context_preferences.preferred_tier overrides
    |         +---> skill summaries injected (NOT full SKILL.md)
    |
    +---> brain-cache check (NEW, passive)
    |         |
    |         +---> warm cache entries listed in context profile
    |
    v
JSON output: { additionalContext: "slim_context" }
```

### Brain Query Flow (v1.9.0)

```
Claude decides to query Brain
    |
    v
brain-client.cjs (existing)
    |
    +---> brain-cache.cjs (NEW middleware)
    |         |
    |         +---> hash(query + params) -> cache key
    |         +---> check ~/.mindrian/cache/brain/{key}.json
    |         +---> if exists and age < 24h: return cached
    |         +---> if miss: proceed to Brain API
    |
    +---> Brain API call (existing)
    |
    +---> cache response (NEW)
    |
    v
Return response to Claude
```

### Learnings Rotation Flow (v1.9.0)

```
scripts/learn-from-usage (existing, called at session-start)
    |
    v
learnings-rotation.cjs (NEW)
    |
    +---> read room/.learnings.md
    +---> parse entries by date/session markers
    +---> if entries > 20 sessions:
    |         +---> keep most recent 20
    |         +---> archive older to room/.context/learnings-archive.md
    +---> write trimmed .learnings.md back
    |
    v
Bounded learnings loaded into context (existing tiered loading)
```

## Anti-Patterns

### Anti-Pattern 1: Moving Skills to Hook-Only Injection

**What people might do:** Remove all SKILL.md files and inject everything via session-start additionalContext.

**Why it's wrong:** Claude Code's skill system provides progressive disclosure, description-based discovery, and supporting file lazy loading for free. Bypassing it means reimplementing these features in bash. It also breaks the `/mos:skill-name` invocation pattern and makes skills invisible to `/help`.

**Do this instead:** Use `disable-model-invocation: true` for background skills + inject compact summaries via hook. Keep always-on skills as real SKILL.md files. Best of both worlds.

### Anti-Pattern 2: Splitting CLAUDE.md Into Many Small Includes

**What people might do:** Break CLAUDE.md into 10+ small files loaded via `@include`.

**Why it's wrong:** Claude Code loads CLAUDE.md + includes at session start. More files = more disk I/O at startup. The `@include` directives are resolved at load time, so the total context consumed is the same regardless of file count. The optimization comes from REMOVING content from CLAUDE.md, not splitting it.

**Do this instead:** Extract content to `references/` (not includes). Content in references/ is only loaded when Claude uses the Read tool to access it. Content in includes/ is loaded every session.

### Anti-Pattern 3: Complex Caching with External Databases

**What people might do:** Add SQLite or Redis for state caching.

**Why it's wrong:** Violates ICM principle (folder structure IS the architecture). Adds a dependency to a zero-dependency plugin. Creates a dual source of truth with STATE.md.

**Do this instead:** JSON files in `room/.context/` with mtime-based TTL. Filesystem IS the cache store. Zero dependencies.

### Anti-Pattern 4: Dynamic Skill Generation at Session Start

**What people might do:** Generate SKILL.md files dynamically based on room state.

**Why it's wrong:** Claude Code caches plugin files. Dynamically written SKILL.md files may not be picked up until `/reload-plugins`. The skill system expects static files, not generated content.

**Do this instead:** Use the hook-injected skill summaries pattern (Pattern 2) for dynamic content. Keep SKILL.md files static.

## Integration Points

### Internal Boundaries

| Boundary | Current Communication | v1.9.0 Change |
|----------|----------------------|----------------|
| session-start -> compute-state | Direct bash subprocess call | Add state-cache.cjs middleware (cache check before subprocess) |
| session-start -> analyze-room | Direct bash subprocess call | Results included in state cache (single cache, not separate) |
| brain-client.cjs -> Brain API | Direct HTTP via fetch | Add brain-cache.cjs as middleware layer |
| learn-from-usage -> .learnings.md | Direct file append | Add learnings-rotation.cjs call before append |
| CLAUDE.md -> skill content | Claude loads both at session start | Reduced CLAUDE.md + fewer always-on skills = less overlap |
| settings.json -> skill activation | `when` conditions (custom convention, NOT native Claude Code) | Replace with native `disable-model-invocation` frontmatter |

### External Service Integration

| Service | Current Pattern | v1.9.0 Change |
|---------|----------------|----------------|
| Brain MCP (brain.mindrian.ai) | Direct query per request | Add 24h response cache layer |
| Context bridge (/tmp/mindrian-context-state) | Read per session-start | No change (already efficient) |
| GitHub (check-update) | Once per day via cached check | No change |

### Critical Discovery: settings.json `when` Field

The current `settings.json` uses a `when` field for conditional skill loading:

```json
{ "name": "room-passive", "when": "dir_exists:room" },
{ "name": "brain-connector", "when": "env:MINDRIAN_BRAIN_KEY" }
```

**This is NOT a documented Claude Code feature.** Official plugin docs state settings.json only supports the `agent` key. The `skills` array and `when` conditions are either:
1. An undocumented internal feature that happens to work
2. A custom convention that is silently ignored

**Recommendation:** Do not rely on this. Use the native `disable-model-invocation: true` frontmatter in SKILL.md files instead, combined with hook-injected summaries. This is the documented, supported approach.

### npm Distribution Integration

| Aspect | Current | v1.9.0 |
|--------|---------|--------|
| Install method | `git clone` + `claude --plugin-dir` | `npm install -g mindrian-os` + `claude plugin install` |
| Update method | `git pull` in plugin dir | `npm update -g mindrian-os` |
| Version check | Custom `check-update` script | npm registry + existing `check-update` as fallback |
| Hooks + scripts | Bash scripts with `chmod +x` | Same, but npm handles file permissions on install |
| node_modules | In plugin root (committed or .gitignored) | In `${CLAUDE_PLUGIN_DATA}` (persistent across updates) |

## Build Order (Dependency-Aware)

The following order respects dependencies -- each phase builds on the previous.

### Phase 1: Weight Reduction (No New Components)

Changes that reduce context with zero new code:

1. **CLAUDE.md diet** - Extract theory/stack/moat details to `references/`
2. **Includes trim** - Deduplicate `.claude/includes/*.md` against trimmed CLAUDE.md
3. **Skill frontmatter** - Add `disable-model-invocation: true` to 4 background skills
4. **Skill content trim** - Apply supporting files pattern to larry-personality extras

**Dependencies:** None. Pure content changes.
**Risk:** LOW - all changes are reversible content edits.
**Expected impact:** ~50% of the total reduction (93KB -> ~55KB).

### Phase 2: Caching Layer (New Components, No Hook Changes)

New lib/core modules that can be tested independently:

1. **state-cache.cjs** - STATE.md caching with delta detection
2. **brain-cache.cjs** - Brain response caching with 24h TTL
3. **learnings-rotation.cjs** - .learnings.md rotation (20 session cap)
4. **context-profile.cjs** - .context-profile.json reader/generator

**Dependencies:** Phase 1 (skills already trimmed, so caching reduces remaining overhead).
**Risk:** LOW - new modules with no side effects until integrated.

### Phase 3: Session-Start Integration

Wire Phase 2 modules into session-start:

1. **Integrate state-cache.cjs** into session-start (replace raw compute-state call)
2. **Integrate context-profile.cjs** into tiered loading logic
3. **Inject skill summaries** for background skills (Pattern 2)
4. **Integrate learnings-rotation.cjs** into learn-from-usage

**Dependencies:** Phase 2 (modules must exist before integration).
**Risk:** MEDIUM - modifying the critical session-start path. Requires fallback logic.

### Phase 4: Release System Hardening

Independent of Phases 1-3, can run in parallel:

1. **Background update check** - Non-blocking Node.js detached process
2. **Hook staleness detection** - Version header comparison
3. **Git commit verification** - MITM prevention
4. **npm distribution** - package.json, .npmignore, install script adaptation

**Dependencies:** None (independent pillar).
**Risk:** MEDIUM for npm distribution (new install path to test).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 room, <50 artifacts | Current architecture is fine. Caching is overhead. Skip cache, use direct compute. |
| 1-5 rooms, 50-500 artifacts | Cache provides meaningful speedup. Context profiles differentiate room behaviors. |
| 5+ rooms, 500+ artifacts | Cross-room intelligence queries benefit most from Brain caching. Learnings rotation prevents context bloat. |
| Sonnet (200K window) | All optimizations critical. 23.6K -> 6K target is achievable with Phases 1-3. |
| Opus (1M window) | Weight reduction still valuable (faster prompt cache hits). Caching less critical but still beneficial for latency. |

## Sources

- [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) - Official skill loading, progressive disclosure, frontmatter fields, supporting files pattern [HIGH confidence - verified 2026-04-07]
- [Claude Code Plugins reference](https://code.claude.com/docs/en/plugins-reference) - Plugin structure, settings.json limitations, hook event types [HIGH confidence - verified 2026-04-07]
- [Claude Code Plugins guide](https://code.claude.com/docs/en/plugins) - Plugin development, settings.json only supports `agent` key [HIGH confidence - verified 2026-04-07]
- [Split Memory: Modular CLAUDE.md Strategy](https://mcpmarket.com/tools/skills/split-memory-modular-claude-md-strategy) - Third-party pattern for CLAUDE.md splitting [MEDIUM confidence - community source]
- Existing codebase analysis: CLAUDE.md (35KB), 7 skills (37KB + 13KB extras), session-start (407 lines), settings.json, hooks.json [HIGH confidence - direct file inspection]
- ByteByteGo context engineering article (referenced in PROJECT.md): Write/Select/Compress/Isolate strategies [MEDIUM confidence - third-party reference]

---
*Architecture research for: MindrianOS v1.9.0 Context Engineering Optimization*
*Researched: 2026-04-07*
