# Domain Pitfalls

**Domain:** Claude Code AI methodology plugin (25 bots, Data Room, ICM orchestration, pipeline chaining)
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that cause rewrites, user abandonment, or architectural dead-ends.

### Pitfall 1: Context Window Starvation from Plugin Overhead

**What goes wrong:** The plugin ships 25 methodology skills, multiple agents, hooks, MCP server definitions (Brain, LazyGraph, research tools), and rich CLAUDE.md instructions. Each component consumes context tokens before the user even speaks. MCP tool descriptions alone can consume 66K+ tokens. At 70% context utilization, Claude starts losing precision; at 85%, hallucinations increase. A plugin this large can push users into compaction loops where Claude forgets Larry's personality, loses Room state, and contradicts its own earlier methodology guidance.

**Why it happens:** Each skill/agent markdown file, each MCP tool description, and the CLAUDE.md itself are loaded into context. The system prompt alone is ~2.7K tokens, system tools ~16.8K, custom agents ~1.3K, memory files ~7.4K, skills ~1K -- and that is BEFORE your 25 methodology skills and Brain MCP tools are added. With Brain MCP (7 tools with rich descriptions) plus LazyGraph plus research tools, you can easily burn 30-50K tokens of context on plugin infrastructure.

**Consequences:** Users hit compaction mid-methodology. Larry loses voice consistency. Pipeline state gets lost between compaction events. Room intelligence fails because context about earlier entries is gone. The "just works" promise breaks on the very first complex session.

**Warning signs:**
- Users report Larry "forgetting" what was discussed earlier in session
- Pipeline steps repeat work already done
- Room proactive intelligence stops surfacing relevant connections
- Debug output shows compaction events during normal usage

**Prevention:**
- Design skills as TINY markdown files (under 200 tokens each) with instructions to read reference files on-demand rather than loading everything upfront
- Rely on Claude Code's Tool Search feature (auto-activates when tools exceed 10% of context) -- do NOT load all 25 methodologies simultaneously
- Structure methodology skills so only the ACTIVE methodology is in context; others are discoverable but deferred
- Keep CLAUDE.md lean (identity + routing rules only); move detailed instructions into skills that load on demand
- Use `PreCompact` hook to persist critical Room state before compaction
- Test with 200K context (Sonnet) not just 1M (Opus) -- most free-tier users will not have Opus

**Detection:** Add a SessionStart hook that logs approximate context consumption. Monitor for compaction frequency in user sessions.

**Phase to address:** Phase 1 (plugin skeleton). Context budget must be designed from day one. Retrofitting is a rewrite.

---

### Pitfall 2: STATE.md Consistency Drift Under File-Based Orchestration

**What goes wrong:** The Room hierarchy relies on STATE.md files at every level -- master STATE.md, per-room STATE.md, per-sub-room STATE.md. Claude is asked to read, update, and aggregate these on every interaction. In practice, Claude inconsistently follows file-update instructions: it skips updates when focused on the user's question, writes partial state, or updates one STATE.md but not its parent. Over a multi-session project, state files diverge from reality. The Room reports "3 entries in problem-definition" when there are actually 7.

**Why it happens:** File-based state management depends on Claude reliably executing side-effect instructions (updating STATE.md) while performing primary tasks (answering methodology questions). LLMs prioritize the user-facing task and deprioritize bookkeeping. Cross-session persistence compounds the problem -- each new session starts from potentially stale state files that Claude treats as ground truth.

**Consequences:** Room proactive intelligence makes wrong recommendations based on stale state. Pipeline chaining routes to wrong next steps. Users lose trust when the system says "you haven't explored market analysis" when they spent an hour on it. Convergence detection fails.

**Warning signs:**
- STATE.md timestamps lag behind actual file modifications
- Room section counts don't match actual file counts in directories
- Users manually correct Larry about what they've done
- Proactive suggestions repeat already-completed work

**Prevention:**
- Use hooks (PostToolUse on Write/Edit) to trigger state updates programmatically via scripts, NOT by asking Claude to remember
- Make STATE.md a computed artifact: a script scans actual files/directories and regenerates state, rather than Claude maintaining it incrementally
- Keep state simple: file existence and metadata (modified dates, word counts) rather than semantic summaries that drift
- SessionStart hook should always recompute state from filesystem truth
- Never trust STATE.md over filesystem reality -- use state as cache, files as source of truth

**Detection:** Build a validation hook that compares STATE.md claims against actual directory contents on SessionStart.

**Phase to address:** Phase 2 (Data Room). Must be solved before Room intelligence is built on top of it.

---

### Pitfall 3: Three-Surface Compatibility Is Not "Same Plugin, Same CLAUDE.md"

**What goes wrong:** The architecture assumes CLI, Desktop, and Cowork can use identical plugin code. In reality: Desktop may have different hook support or timing. Cowork has 00_Context/ conventions and multi-agent coordination that don't exist in CLI. CLI has no visual affordances for pipeline progress. Hooks behave differently across surfaces. MCP server lifecycle differs. A plugin developed and tested on CLI breaks silently on Desktop or Cowork.

**Why it happens:** "Three surfaces" sounds like a portability claim, but Claude Code CLI, Claude Desktop, and Claude Cowork are different products with different capabilities, different context management, and different agent models. The plugin spec is shared, but runtime behavior is not identical.

**Consequences:** Users on Desktop get broken hooks. Cowork users get confused by skills designed for single-agent CLI interaction. Pipeline visualization that works in CLI terminal doesn't render in Desktop. The "one plugin, three surfaces" promise becomes "works on CLI, sort-of works elsewhere."

**Warning signs:**
- Features tested only on one surface
- Hook scripts that assume terminal output
- Skills that reference CLI-specific interaction patterns
- No Cowork-specific 00_Context/ handling

**Prevention:**
- Identify surface differences EARLY: audit which hooks, agent behaviors, and MCP features are available on each surface
- Design skills as surface-agnostic markdown (no terminal escape codes, no CLI-specific instructions)
- Test on all three surfaces from the first milestone that has working skills
- Use feature detection, not surface detection: check if a capability exists rather than which surface you're on
- Accept that some features will be CLI-only or Cowork-only and document this clearly rather than pretending uniformity

**Detection:** Maintain a surface compatibility matrix that is updated with each new skill/command.

**Phase to address:** Phase 1 (skeleton) for structure decisions; Phase 3+ for ongoing testing.

---

### Pitfall 4: Prompt Porting Trap -- V2 Python Prompts Do Not Translate 1:1 to Claude Code Skills

**What goes wrong:** The 25 methodology prompts from MindrianV2 were written as Python system prompts for Gemini with CopilotKit orchestration. They assume: a stateful backend, a router that selects the right bot, a mode engine that modulates responses in real-time, and a UI that renders structured output. Naively copying these into SKILL.md files produces skills that are too long (context starvation), assume capabilities that don't exist (stateful mode tracking), reference UI components, and fight Claude's native personality rather than augmenting it.

**Why it happens:** "Port from V2" implies translation. But V2 prompts were designed for a fundamentally different runtime: Gemini + Python backend + CopilotKit state + React UI. Claude Code skills are stateless markdown read by Claude at session start or on-demand. The medium is different, so the message must be different.

**Consequences:** Skills that are 2000+ tokens each (25 of them = 50K tokens just for methodology definitions). Larry personality that conflicts with Claude's native voice. Mode engine that requires state tracking Claude cannot do without hooks. Router logic embedded in prompts that Claude ignores. Users get a worse experience than vanilla Claude because the prompts fight the model.

**Warning signs:**
- Skills reference UI components, buttons, or visual elements
- Skills include Python-style logic (if/else chains, state variables)
- Larry personality instructions override Claude's strengths rather than channeling them
- Skills longer than 500 tokens each

**Prevention:**
- REDESIGN each methodology for Claude Code, don't translate. Ask: "What would this methodology look like if it was born as a Claude Code skill?"
- Keep each skill under 300 tokens. Move detailed methodology knowledge into reference files that Claude reads on-demand
- Larry personality should be a thin layer (voice, tone, pedagogical approach) not a complete personality override
- Mode engine should use hooks (PostToolUse) to track mode distribution externally, not ask Claude to self-monitor
- Test each ported methodology against the ORIGINAL V2 output quality. If Claude's native ability + thin skill outperforms the heavy prompt, use the thin version

**Detection:** Measure token count per skill. Any skill over 500 tokens is a red flag. Compare output quality of heavy vs. thin prompts.

**Phase to address:** Phase 3 (methodology porting). But the PRINCIPLE must be established in Phase 1 (keep skills tiny).

---

### Pitfall 5: Room Proactive Intelligence Generates Noise, Not Signal

**What goes wrong:** The Room is designed to "detect gaps, contradictions, convergence; suggest next methodology; alert readiness." In practice, proactive intelligence that fires too often or too inaccurately trains users to ignore it. Every insight classified to the wrong section, every premature "you should try Bono next," every false contradiction alert erodes trust. After a week, users disable proactive features or ignore them entirely.

**Why it happens:** Proactive intelligence requires JUDGMENT about when to intervene, not just pattern detection. An empty room section is not necessarily a gap -- maybe the user is deliberately focused. A methodology output that contradicts an earlier one might be intentional refinement. Readiness thresholds are subjective. Building proactive intelligence that has the judgment of a master teacher (Larry's premise) requires the Brain -- but Tier 0 users don't have the Brain.

**Consequences:** Tier 0 users (the majority) get dumb proactive alerts that feel like clippy. Trust in Larry erodes. Users turn off hooks. The "Data Room as OS" value proposition collapses into "fancy folder structure."

**Warning signs:**
- Users dismiss proactive suggestions more than they act on them
- Proactive alerts fire on every session regardless of context
- False positive rate on contradictions exceeds 50%
- Gap detection doesn't account for user's stated focus area

**Prevention:**
- Start with PASSIVE intelligence only (auto-classify, auto-file) -- this is high-value, low-risk
- Add proactive intelligence incrementally, gated by confidence thresholds
- Tier 0 proactive should be limited to obvious signals: completely empty required sections after significant work, explicit contradictions in the same document, user requesting "what should I do next"
- Brain tier gets the full proactive suite because graph intelligence actually enables good judgment
- Every proactive suggestion must include a "why" that the user can evaluate
- Track acceptance/dismissal rates and tune thresholds

**Detection:** Log proactive suggestion events and user responses. Acceptance rate below 30% means the feature is noise.

**Phase to address:** Phase 2 (Room passive first), Phase 4+ (proactive, with Brain tier getting priority).

## Moderate Pitfalls

### Pitfall 6: Pipeline Chaining Assumes Linear Methodology Progression

**What goes wrong:** The Week 7 "pipeline chaining through Room" pattern (Domain Explorer -> Bono -> JTBD -> Minto -> Devil's Advocate) assumes a linear progression. Real innovation work is iterative and non-linear. Users want to revisit Domain Explorer after Devil's Advocate reveals flawed assumptions. Rigid chaining forces a waterfall through methodology steps.

**Prevention:**
- Design pipelines as DAGs (directed acyclic graphs) not linear chains
- Allow re-entry to any stage with preserved context from later stages
- Pipeline state should track "completed at least once" not "completed in order"
- Room state should support multiple passes through the same methodology with different framing
- The Week 7 pattern is a RECOMMENDED sequence, not an enforced one

**Phase to address:** Phase 4 (pipeline system).

---

### Pitfall 7: ICM Layer 3/Layer 4 Boundary Leaks IP

**What goes wrong:** ICM separates factory (Layer 3, your IP) from product (Layer 4, user's work). In a Claude Code plugin, the factory is distributed as readable markdown files. The "IP never distributed" claim for the Brain is sound, but Layer 3 reference files (275 framework definitions, chain suggestions, mode algorithm) are shipped in the plugin. Competitors can read references/ and have your Tier 0 intelligence.

**Prevention:**
- Accept that Tier 0 IP is open -- make it good enough to attract users, not so complete that Brain tier has no value
- Layer 3 references should be "what" (framework definitions) not "how" (chaining rules, grading calibration, mode intelligence)
- The real moat (chaining rules, grading, cross-framework intelligence) stays exclusively in Brain MCP
- Review every file in references/ with the question: "If a competitor reads this, can they replicate our differentiation?" If yes, move it to Brain
- Version and watermark reference files to detect unauthorized redistribution

**Phase to address:** Phase 3 (methodology porting) when populating references/.

---

### Pitfall 8: LazyGraph Creates a "Works on My Machine" Experience

**What goes wrong:** LazyGraph (user's Neo4j Aura Free) is optional. Users who enable it get a fundamentally better experience -- their knowledge graph grows, cross-project connections emerge, personal patterns surface. Users without it get flat files. This creates a bifurcated product where testimonials and demos show graph-enhanced features that most users never experience, leading to disappointment.

**Prevention:**
- Design ALL features to work excellently without LazyGraph first
- LazyGraph should enhance existing features, not enable new ones
- Never demo LazyGraph-dependent features without clearly labeling them as optional
- Consider whether LazyGraph complexity is worth it for Tier 0, or if it should be a Tier 1 (Brain) perk
- If kept in Tier 0, provide a dead-simple setup (one command, zero Neo4j knowledge required) and graceful degradation messaging

**Phase to address:** Phase 5+ (LazyGraph integration). Do NOT build it early -- it adds complexity before core value is proven.

---

### Pitfall 9: Hook Reliability Across Plugin Updates

**What goes wrong:** Hooks (SessionStart, PostToolUse, Stop) are the backbone of Room intelligence, state management, and pipeline orchestration. Hooks execute shell scripts or send HTTP requests. Plugin updates change `${CLAUDE_PLUGIN_ROOT}` (old path is gone). Scripts that install dependencies or generate state in PLUGIN_ROOT are wiped. Hook scripts that work in development break after the first `claude plugin update`.

**Prevention:**
- Store ALL persistent state in `${CLAUDE_PLUGIN_DATA}`, never in `${CLAUDE_PLUGIN_ROOT}`
- Use the `diff` + `npm install` pattern from official docs for dependency management across updates
- SessionStart hook should validate that all required state files exist and regenerate if missing
- Test the full install -> use -> update -> use cycle in CI before every release
- Hook scripts must be idempotent -- running them twice should produce the same result

**Phase to address:** Phase 1 (skeleton). Hook architecture must use PLUGIN_DATA from the start.

---

### Pitfall 10: MCP Server Cold Start Kills "Zero Config" Promise

**What goes wrong:** Brain MCP at brain.mindrian.ai is a remote server. If it has cold start latency (common with Aura Agent deployments), the first user interaction after install hangs for 5-30 seconds while the MCP server initializes. This destroys the "Larry talks immediately" promise. Even worse: if the server is down, and graceful degradation isn't properly implemented, users get cryptic MCP connection errors instead of Larry.

**Prevention:**
- Brain MCP must NOT be in the default .mcp.json -- it should be added only when user runs `/mindrian-os:setup brain`
- Default experience must be 100% local (Tier 0) with zero network calls
- Implement connection timeout (3 seconds) with automatic fallback to embedded references
- Pre-warm Brain MCP on SessionStart hook AFTER the user has already started interacting
- Display clear messaging: "Brain connected - enriched mode" vs "Running locally - all features available"
- Test the cold-start scenario explicitly: fresh install, first interaction, Brain server cold

**Phase to address:** Phase 1 (default experience must be local-only). Phase 5+ for Brain integration with proper fallback.

## Minor Pitfalls

### Pitfall 11: Plugin Name Collision and Namespacing

**What goes wrong:** Command names like `/mindrian-os:larry` or `/mindrian-os:room` must not collide with other plugins. If the plugin name changes (from "mindrian-os" to "mindrian" or "pws"), all user muscle memory and documentation breaks.

**Prevention:** Choose the final plugin name before any user-facing release. Use a distinctive prefix. Register the name on the Anthropic official marketplace early.

**Phase to address:** Phase 1.

---

### Pitfall 12: Methodology Skills Assume Domain Knowledge

**What goes wrong:** Skills written by the methodology creator (Lawrence, Jonathan) assume users know terms like "sub-domains," "Minto pyramid," "JTBD," "De Bono hats." New users who install the plugin to explore innovation methodology hit jargon walls.

**Prevention:** Every methodology skill must include a 1-sentence plain-language description of what it does and when to use it. Larry's personality should include "explain the framework before using it" as a core behavior. First-run experience should guide users through 2-3 methodologies with full context.

**Phase to address:** Phase 3 (methodology porting) and Phase 6 (onboarding).

---

### Pitfall 13: Over-Engineering the Plugin Before Validating Core Value

**What goes wrong:** The feature list is ambitious: 25 bots, 8 Room sections, proactive intelligence, pipeline chaining, LazyGraph, Brain integration, three surfaces, mode engine, grading, convergence detection. Building all of this before any user validates the core proposition ("Larry in Claude Code helps me with innovation methodology") risks months of work on features nobody uses.

**Prevention:** Ship the thinnest possible plugin first: Larry personality + 3-5 core methodologies + basic Room (passive filing only) + one pipeline. Get 5 users. Measure engagement. Then expand. The plugin format makes incremental expansion easy -- each new methodology is just a new .md file.

**Phase to address:** This is a ROADMAP-LEVEL concern. Phase 1-2 should produce a usable MVP. Phase 3+ should be informed by user feedback.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Plugin skeleton | Context budget blown by rich CLAUDE.md + all skills loading | Budget tokens from day one; measure with `--debug` |
| Data Room | STATE.md drift from filesystem reality | Compute state from files, don't maintain incrementally |
| Methodology porting | V2 prompts too long, assume wrong runtime | Redesign for Claude Code, 300-token skill limit |
| Pipeline system | Linear chaining assumption | DAG-based pipeline with re-entry |
| Brain integration | Cold start, MCP failures kill UX | Local-first default, async Brain connection |
| LazyGraph | Bifurcated experience, Neo4j complexity for users | Defer until core value proven, dead-simple setup |
| Three surfaces | Untested surface assumptions | Test on all three from first working milestone |
| Proactive intelligence | Noise-to-signal ratio kills trust | Start passive-only, add proactive with confidence gates |
| Marketplace release | Plugin name/structure locked prematurely | Finalize naming in Phase 1, test update cycle |
| Onboarding | Jargon wall for new users | Larry explains before using methodology terms |

## Sources

- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- Official plugin structure, hooks, MCP, distribution (HIGH confidence)
- [Claude Code Context Buffer: The 33K-45K Token Problem](https://claudefa.st/blog/guide/mechanics/context-buffer-management) -- Context consumption analysis (MEDIUM confidence)
- [Claude Code 1M Context Window GA](https://claudefa.st/blog/guide/mechanics/1m-context-ga) -- 1M context availability for Opus/Sonnet 4.6 (MEDIUM confidence)
- [Optimising MCP Server Context Usage in Claude Code](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) -- MCP tool token costs (MEDIUM confidence)
- [MCP server that reduces context consumption by 98%](https://news.ycombinator.com/item?id=47193064) -- Context Mode approach (LOW confidence)
- [Claude Code Plugin Best Practices for Large Codebases](https://skywork.ai/blog/claude-code-plugin-best-practices-large-codebases-2025/) -- Plugin development patterns (MEDIUM confidence)
- [How to Structure Claude Code for Production](https://dev.to/lizechengnet/how-to-structure-claude-code-for-production-mcp-servers-subagents-and-claudemd-2026-guide-4gjn) -- Production plugin architecture (MEDIUM confidence)
- [Plugin Marketplaces Documentation](https://code.claude.com/docs/en/plugin-marketplaces) -- Distribution and publishing (HIGH confidence)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) -- Official best practices (HIGH confidence)
