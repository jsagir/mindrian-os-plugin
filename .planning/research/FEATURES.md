# Feature Research

**Domain:** Context engineering optimization for AI coding assistant plugin (Claude Code)
**Researched:** 2026-04-07
**Confidence:** HIGH (verified against Claude Code docs, ecosystem tools, measured baselines)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any context-aware Claude Code plugin must have. MindrianOS already ships partial implementations of several -- this milestone completes them.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **CLAUDE.md diet (41KB to 20KB)** | Every token of CLAUDE.md is taxed on every interaction. 41KB = ~10K tokens of permanent overhead. Community consensus: keep under 2K tokens (8KB). MindrianOS is 5x over. | MEDIUM | Nothing -- standalone refactor | Extract theory/architecture to `references/` docs. Keep only routing instructions, identity, and UI enforcement in CLAUDE.md. Includes already add 5.6KB on top. Move moat/architecture/decisions to reference docs loaded on-demand. |
| **Progressive skill loading (stubs + on-demand)** | 55KB of skills always loaded = ~14K tokens. Ecosystem standard is lazy-loaded skills -- summary metadata first, full body only when triggered. Claude Code itself uses this pattern for MCP tool discovery (95% reduction). | HIGH | Skill refactoring | Split each SKILL.md into frontmatter stub (~200 bytes) + full body. Stub loaded at session start, body loaded when skill activates. 7 skills x 5-7KB each = massive savings. |
| **Context window usage monitoring** | Claude Code shows token % in terminal. Plugins that consume context must be transparent about their own overhead. Users expect to know "how much of my window did the plugin eat?" | LOW | Existing `context-monitor` script | Already partially built. Enhance with plugin-specific breakdown: CLAUDE.md tokens, skills tokens, hook injection tokens, room state tokens. |
| **Tiered context loading by budget** | When context is 70%+ full, loading 5K of room state is wasteful. Ecosystem pattern: tier loading based on remaining budget (minimal/balanced/rich). | LOW | Existing `session-start` hook | Already implemented (CTX-02). Refine thresholds and add skill-level tiering. |
| **STATE.md caching with TTL** | Recomputing full room state every session wastes hook execution time. If room hasn't changed, serve cached STATE.md. | MEDIUM | `compute-state` script, file watcher | Hash room directory tree. If hash matches cached hash, skip recompute. TTL of 1 hour for time-sensitive data (deadlines, opportunity state). |
| **Learnings rotation (bounded history)** | `.learnings.md` grows unbounded across sessions. Old learnings become noise, not signal. Unbounded files are a known context engineering anti-pattern. | LOW | Nothing -- standalone | Cap at 20 most recent entries. Rotate on write. Archive older entries to `.learnings-archive.md` (not loaded). |
| **Hook version headers** | Known Claude Code issue (Issue #18517, #15642): plugin hooks point to stale cached versions after updates. Hooks must self-identify their version. | LOW | `plugin.json` version field | Each hook script reads plugin.json version, compares to expected. Warns if stale. Since Claude Code 2.0.70, native auto-update exists for marketplace plugins, but self-hosted installs still need this. |

### Differentiators (Competitive Advantage)

Features that go beyond what any existing Claude Code plugin does. These leverage MindrianOS's unique ICM hierarchy.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **ICM-driven context traversal** | No other plugin uses folder hierarchy as context routing. Instead of flat-loading everything, traverse Layer 0 (identity) -> Layer 1 (routing) -> Layer 2 (room state) -> load ONLY relevant skills/references. This is MindrianOS's architectural moat applied to context. | HIGH | ICM hierarchy (already built), skill stubs | The hierarchy IS the context budget. Each layer decides what the next layer loads. Layer 0 (STATE.md venture_stage) determines which skills are relevant. A "seed-stage" venture doesn't need financial-model skills loaded. |
| **Per-room context profiles (.context-profile.json)** | Auto-generated from usage patterns: which skills fire most, which room sections get accessed, which Brain queries run. Next session pre-loads only what this room actually uses. | MEDIUM | Usage analytics (existing `track-analytics`), skill stubs | No other plugin personalizes context loading per project. Most load the same payload regardless of what the user does. This is the "Netflix recommendation" for context. |
| **Proactive context windowing at archetype thresholds** | Instead of reactive `/clear` suggestions, the system proactively switches to concise mode at archetype-specific thresholds (student: 65%, venturist: 75%, researcher: 78%). Preemptive, not reactive. | MEDIUM | Archetype detection (existing `user-archetype.cjs`), context-monitor bridge | Existing implementation handles thresholds. Enhancement: auto-shed low-priority context (proactive intelligence detail, learnings) before suggesting `/clear`. Shed silently, not with warnings. |
| **Stable prefix optimization for prompt caching** | Claude's prompt cache requires exact prefix matching. Session-start already separates stable prefix from dynamic suffix (lines 28-57 of session-start). Formalizing this enables cache hits across sessions -- the stable prefix never changes, so subsequent API calls within a session reuse the cached prefix. | MEDIUM | Session-start hook refactoring | Cache hierarchy: tools -> system -> messages. CLAUDE.md content is in system prompt. If CLAUDE.md prefix is stable (identity + routing), it caches. Dynamic room state goes in the suffix after the cache breakpoint. Current session-start already does this partially. |
| **Delta-based STATE.md updates** | Instead of full STATE.md recompute, detect what changed since last compute (new files, modified files, deleted files) and update only affected sections. Reduces hook execution time from 2+ seconds to <500ms for unchanged rooms. | HIGH | `compute-state` script refactoring | Use directory tree hash + per-section file hashes. On session start, compare hashes. Only recompute sections with changes. Store hash manifest in `.mindrian/state-hashes.json`. |
| **Context compression for Brain responses** | Brain MCP queries return rich graph data. Cache responses with 24h TTL, serve summaries instead of raw graph data in constrained contexts. | MEDIUM | Brain client (existing `brain-client.cjs`) | Brain responses are deterministic for same query. Cache in `.mindrian/brain-cache/`. Key = query hash. Serve compressed summary when context > 60%. |
| **npm distribution with integrity verification** | Ship via npm as primary install channel. Include git commit hash verification to prevent MITM on self-hosted installs. Native installer pattern for marketplace. | MEDIUM | Release process, `publish-ops` script | npm is no longer recommended for Claude Code itself (native installer preferred), but for PLUGINS npm remains the standard distribution. Add `--integrity` flag to verify package hash against published manifest. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create problems in this specific domain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time token counting** | "Show me exact token count at all times" | Token counting requires tokenizer (tiktoken or similar), adds dependency, and the count is approximate anyway since Claude Code's internal system prompt is opaque. Claude Code already shows percentage in statusline. | Use the existing percentage-based context-monitor. Enhance with category breakdown (plugin overhead vs conversation), not exact counts. |
| **Automatic context pruning (delete old messages)** | "Auto-delete old conversation turns to free space" | Claude Code manages its own compaction (server-side). Interfering with message history causes coherence loss. Plugin cannot and should not modify conversation state. | Proactive shedding of PLUGIN-injected context (room state, intelligence, learnings) -- the parts the plugin controls. Never touch conversation history. |
| **Per-file token budgets** | "Each skill file gets a max token budget" | Token budgets per file create arbitrary constraints. A 5KB skill that fires once is fine. A 500-byte skill that fires every turn is worse. Budget should be aggregate, not per-file. | Aggregate session budget with tiered loading. Track cumulative plugin overhead, not individual file sizes. |
| **LLM-based context summarization** | "Use Claude to summarize context before loading" | Adds an LLM call to every session start. Increases latency (2-5 seconds), costs tokens, and the summarization itself consumes context window. Defeats the purpose. | Extractive compression: rule-based selection of relevant sections based on room state and archetype. No LLM in the hot path. |
| **Cross-session memory database (SQLite/Redis)** | "Store all context in a database for retrieval" | Violates ICM principle: filesystem IS the architecture. Adds dependency, creates dual source of truth, breaks "every output is an edit surface." | `.mindrian/` directory with JSON/MD files. State in filesystem, queryable by scripts. Already proven with registry.json, brain-cache, bridge files. |
| **Dynamic skill injection mid-conversation** | "Load new skills when user mentions a topic" | Mid-conversation context injection is unreliable. Claude may not notice new system instructions added after conversation start. Creates inconsistent behavior. | Pre-load skill stubs at session start. Full skill body loads on first activation (explicit trigger), not on keyword detection. |
| **Compression via external embedding/RAG** | "Embed room content in Pinecone, retrieve on demand" | Adds infrastructure dependency (Pinecone), breaks Tier 0 "no dependencies" promise, retrieval quality varies, and latency is 1-3 seconds per query. | Keep context loading filesystem-based. Brain MCP handles RAG for enrichment (optional). Room context stays local and deterministic. |

## Feature Dependencies

```
[CLAUDE.md Diet]
    └──enables──> [Progressive Skill Loading] (diet creates headroom for skill stubs)
                      └──enables──> [ICM-Driven Context Traversal] (stubs are the traversal units)
                                        └──enables──> [Per-Room Context Profiles] (traversal generates usage data)

[STATE.md Caching + TTL]
    └──enables──> [Delta-Based STATE.md Updates] (caching provides baseline, delta updates refresh it)

[Context Window Monitoring]
    └──enables──> [Proactive Context Windowing] (monitoring provides the signal)

[Hook Version Headers]
    └──enables──> [npm Distribution] (versioning is prerequisite for package integrity)

[Brain Response Caching] ──independent──> (no dependencies, can ship anytime)

[Stable Prefix Optimization] ──requires──> [CLAUDE.md Diet] (diet stabilizes the prefix content)

[Learnings Rotation] ──independent──> (no dependencies, can ship anytime)
```

### Dependency Notes

- **CLAUDE.md Diet enables Progressive Skill Loading:** Cannot add skill stubs if CLAUDE.md is still 41KB. The diet creates the token headroom that makes lazy loading worthwhile.
- **Progressive Skill Loading enables ICM Traversal:** ICM traversal loads skills selectively. Without stubs, there is nothing lightweight to traverse -- you either load the full skill or nothing.
- **STATE.md Caching enables Delta Updates:** Delta detection needs a cached baseline to compare against. Without caching, every session does a full compute anyway.
- **CLAUDE.md Diet required for Stable Prefix:** The stable prefix must be lean and unchanging. A 41KB CLAUDE.md that includes theory and architecture docs cannot be a stable prefix -- it changes too often.
- **Hook Version Headers required for npm Distribution:** Package integrity verification depends on version identification being reliable. Stale hooks undermine distribution trust.

## MVP Definition

### Phase 1: Weight Reduction (ship first)

The foundation. Everything else builds on reduced baseline overhead.

- [ ] CLAUDE.md diet (41KB to ~20KB) -- moves theory to reference docs, keeps routing/identity/UI
- [ ] Learnings rotation (cap at 20 entries) -- prevents unbounded growth
- [ ] Hook version headers -- self-identifying hooks for staleness detection
- [ ] Stable prefix formalization in session-start -- enables prompt cache hits

### Phase 2: Smart Loading (ship second)

Progressive loading requires the weight reduction from Phase 1 to be meaningful.

- [ ] Progressive skill loading (stub + on-demand) -- 55KB always-loaded to ~3KB stubs
- [ ] STATE.md caching with TTL -- skip recompute when room unchanged
- [ ] Context window monitoring enhancement -- plugin overhead breakdown

### Phase 3: Intelligence (ship third)

Leverages ICM hierarchy and usage data, both of which need Phases 1-2 in place.

- [ ] ICM-driven context traversal -- hierarchy routes context loading
- [ ] Per-room context profiles -- auto-generated from usage patterns
- [ ] Delta-based STATE.md updates -- incremental instead of full recompute
- [ ] Proactive context windowing -- shed before warning

### Phase 4: Distribution + Caching (ship fourth)

Release infrastructure and optional Brain optimization.

- [ ] npm distribution with integrity verification
- [ ] Brain response caching (24h TTL)
- [ ] Git commit hash verification for self-hosted installs

### Future Consideration (post-milestone)

- [ ] Cross-room context sharing (load patterns from one room to bootstrap another) -- needs multi-room usage data first
- [ ] Adaptive archetype refinement (archetype adjusts mid-session based on behavior) -- needs baseline archetype data
- [ ] Plugin overhead dashboard (HTML view showing context budget allocation) -- nice-to-have, not core

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Tokens Saved |
|---------|------------|---------------------|----------|--------------|
| CLAUDE.md diet | HIGH | LOW | P1 | ~5K tokens (~50% of CLAUDE.md) |
| Progressive skill loading | HIGH | HIGH | P1 | ~11K tokens (~80% of skills) |
| Stable prefix optimization | HIGH | MEDIUM | P1 | Indirect (cache hits reduce API cost) |
| Learnings rotation | MEDIUM | LOW | P1 | Variable (prevents unbounded growth) |
| Hook version headers | MEDIUM | LOW | P1 | None (reliability, not tokens) |
| STATE.md caching + TTL | HIGH | MEDIUM | P2 | None (latency, not tokens) |
| ICM-driven context traversal | HIGH | HIGH | P2 | ~3-5K tokens (selective loading) |
| Delta STATE.md updates | MEDIUM | HIGH | P2 | None (latency, not tokens) |
| Context monitoring enhancement | MEDIUM | LOW | P2 | None (visibility, not savings) |
| Per-room context profiles | MEDIUM | MEDIUM | P3 | ~2-3K tokens (personalized loading) |
| Proactive context windowing | MEDIUM | MEDIUM | P3 | Variable (prevents degradation) |
| Brain response caching | MEDIUM | MEDIUM | P3 | ~1-2K tokens per cached query |
| npm distribution | HIGH | MEDIUM | P3 | None (distribution, not tokens) |
| Git hash verification | LOW | LOW | P3 | None (security, not tokens) |

**Projected total savings:** 23.6K fixed tokens to ~6K = 75% reduction (matching PROJECT.md target).
Breakdown: CLAUDE.md diet saves ~5K, progressive skill loading saves ~11K, ICM traversal saves ~3K, session-start optimization saves ~2K.

## Competitor Feature Analysis

| Feature | context-mode (mksglu) | Claude HUD | OpenClaw ContextEngine | MindrianOS Approach |
|---------|----------------------|------------|----------------------|---------------------|
| Tool output sandboxing | Core feature (98% reduction via FTS5) | No | DAG summarization | Not applicable -- MindrianOS overhead is system prompt + skills, not tool output |
| Context monitoring | No | Core feature (agent status + context %) | Internal metrics | Existing statusline + bridge file. Enhance with breakdown. |
| Progressive loading | No | No | Plugin-based strategies | Core differentiator: ICM hierarchy + skill stubs |
| Cache strategy | No | No | Plugin architecture | Stable prefix + STATE.md caching + Brain response caching |
| Prompt cache optimization | No | No | No | Stable prefix / dynamic suffix split (unique to MindrianOS) |
| Per-project personalization | No | No | No | Per-room context profiles (unique to MindrianOS) |
| Hierarchy-based loading | No | No | No | ICM Layer 0/1/2 traversal (unique to MindrianOS) |

**Key insight:** Existing ecosystem tools optimize for tool output and monitoring. MindrianOS's context problem is different: it is system prompt + skill overhead, not tool output. The ICM hierarchy approach to context routing has no ecosystem equivalent -- it is a genuine differentiator.

## Sources

- [Claude Code Context Window Management](https://claudefa.st/blog/guide/mechanics/context-management) -- optimization strategies, /context command
- [Claude Code 1M Context Window](https://claudefa.st/blog/guide/mechanics/1m-context-ga) -- 1M GA, 15% compaction reduction
- [Context Engineering for Coding Agents (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) -- systematic context engineering strategies
- [Lazy Skills: Token-Efficient Dynamic Agent Capabilities](https://boliv.substack.com/p/lazy-skills-a-token-efficient-approach) -- stub + on-demand pattern, 82% improvement
- [context-mode (mksglu)](https://github.com/mksglu/context-mode) -- 98% tool output reduction, 66K+ developers
- [Claude HUD](https://aitoolly.com/ai-news/article/2026-03-22-claude-hud-a-new-monitoring-plugin-for-claude-code-tracking-context-and-agent-activity) -- context monitoring plugin
- [Why More Tokens Makes Agents Worse (Morph)](https://www.morphllm.com/context-engineering) -- diminishing returns of context loading
- [Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- prefix stability, cache hierarchy, invalidation
- [Plugin Hook Staleness (Issue #15642)](https://github.com/anthropics/claude-code/issues/15642) -- CLAUDE_PLUGIN_ROOT stale version bug
- [Plugin Hook Settings Not Updated (Issue #18517)](https://github.com/anthropics/claude-code/issues/18517) -- hooks point to old versioned path
- [Token Optimization Best Practices](https://www.mintlify.com/affaan-m/everything-claude-code/guides/token-optimization) -- CLAUDE.md under 2K tokens, skills architecture
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- SessionStart, PreCompact, PostCompact lifecycle
- [OpenClaw ContextEngine Deep Dive](https://openclaws.io/blog/openclaw-contextengine-deep-dive) -- plugin-based context management architecture
- [Building AI Coding Agents (arXiv 2603.05344)](https://arxiv.org/abs/2603.05344) -- scaffolding, harness, context engineering
- [Adaptive Context Compression for LLMs (arXiv 2603.29193)](https://arxiv.org/html/2603.29193) -- compression techniques for long-running interactions

---
*Feature research for: Context Engineering Optimization (MindrianOS v1.9.0)*
*Researched: 2026-04-07*
