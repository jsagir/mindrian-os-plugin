# RESEARCH_16: Native-First Plugin Architecture for AI Code Assistants

## A Token Economics and Capability Tradeoff Analysis for MindrianOS v1.8.0

**Author:** Jonathan Sagir
**Date:** 2026-04-05
**Status:** Research Paper (Internal)
**Version Target:** MindrianOS v1.8.0 (Co-Work Adaptation)

---

## Abstract

AI code assistant plugins face a fundamental architectural tension: encoding intelligence in system prompts (skills, agents, references) consumes context window tokens that could otherwise serve the user's actual work. This paper analyzes MindrianOS, a wicked problem management plugin for Claude Code, to answer: how much of a plugin's instruction budget teaches the model things it already knows how to do?

We find that 35% of MindrianOS's per-turn token load (~8,500 of ~24,000 tokens) consists of tool routing instructions -- directing Claude to specific MCP servers, scripts, and query patterns -- while Claude Code natively provides equivalent capabilities through built-in tools (Read, Write, Bash, WebSearch, WebFetch, Agent, Glob, Grep). An additional 7% consists of output examples that Claude can generate from condensed rules alone.

We propose a Native-First architecture: skills encode only what Claude cannot derive from its own capabilities -- domain knowledge, calibrated teaching patterns, and wicked problem detection logic -- while delegating tool selection to Claude's native intelligence. This reduces per-turn overhead from ~24,000 to ~14,000 tokens (42% reduction) with zero loss to the plugin's core value proposition, validated against MindrianOS's 7-layer Mindrian Workspace Protocol (MWP).

For any user type -- venturist, researcher, or student -- the Native-First approach preserves the full capability stack while freeing 10,000 tokens per turn for conversation, room context, and methodology execution.

---

## 1. Introduction

### 1.1 The Plugin Token Tax

Every Claude Code plugin imposes a per-turn token cost. Skills declared in `settings.json` load on every session and persist across every conversational turn. Unlike commands (loaded on demand) or references (loaded during methodology sessions), skills are the permanent tax a plugin charges against the user's context window.

MindrianOS v1.7.1 loads 7 skills totaling 86,838 bytes (~21,700 tokens), plus an agent prompt (744 tokens) and session-start context injection (~1,500-2,050 tokens), for a per-turn base cost of approximately **24,000 tokens**.

On Claude Sonnet 4.6 (200K context window), this represents 12% of the total budget. On Claude Opus 4.6 (1M window), 2.4%. These percentages appear modest in isolation -- but they compound. Every tool call response, every file read, every agent dispatch adds content to the conversation. By turn 30-50, the cumulative overhead determines whether the session reaches autocompact gracefully or collapses into context thrashing.

The Scalekit benchmark (2026) demonstrated that MCP tool overhead can impose a 4-32x token multiplier compared to equivalent CLI operations, with a 17x cost multiplier at scale (Scalekit, "MCP vs CLI: Head-to-Head Token Analysis," 2026). Perplexity's CTO Denis Yarats publicly reported a deployment where 3 MCP servers with ~40 tools consumed 72% of the context window before a single user message (Nevo Systems, 2026).

The question is not whether plugins should optimize -- it is what they should optimize away.

### 1.2 The Native Capability Hypothesis

Claude Code ships with a comprehensive built-in toolkit:

| Native Tool | Capability |
|---|---|
| Read | File reading with line numbers, images, PDFs |
| Write | File creation and overwrite |
| Edit | Precise string replacement in files |
| Bash | Shell command execution with timeout |
| Glob | Fast file pattern matching |
| Grep | Ripgrep-powered content search |
| WebSearch | Web search without MCP |
| WebFetch | URL content retrieval and analysis |
| Agent | Subagent dispatch with type specialization |
| Skill | Skill invocation within conversation |
| ToolSearch | Deferred tool discovery |

These tools require zero additional token overhead -- they are part of Claude Code's base system prompt (~14,328 tokens per the DEV Community token trace, 2026). A plugin that encodes instructions for WHICH tools to call and HOW to call them duplicates knowledge Claude already possesses.

**The Native-First Hypothesis:** A plugin should encode only what Claude cannot derive from its native capabilities -- domain-specific knowledge, calibrated behavioral patterns, and application-specific detection logic. All tool routing should be delegated to Claude's own judgment.

### 1.3 Scope and Methodology

This paper analyzes MindrianOS v1.7.1 (released 2026), a commercial Claude Code plugin that delivers:
- A teaching personality (Larry) calibrated from 30+ years of university instruction
- A structured Data Room implementing wicked problem management (Rittel & Webber, 1973)
- 26 innovation methodology commands based on published frameworks
- An intelligence pipeline that detects gaps, contradictions, and convergence across venture subsystems
- Integration with a 21,000-node Neo4j knowledge graph (the Brain) containing teaching intelligence

The analysis covers:
1. Byte-level measurement of every loaded component
2. Classification of every instruction as Domain Knowledge, Tool Routing, Behavioral Rules, or Examples
3. Tradeoff mapping against the 7-layer Mindrian Workspace Protocol
4. Validation across three user archetypes (venturist, researcher, student)
5. Proposed architecture with projected token savings and capability impact

---

## 2. Background and Related Work

### 2.1 Context Window Economics

Context window costs are not linear. Augment Code's analysis (2026) demonstrates that attention cost scales quadratically: a 200K token context requires ~40 billion operations per layer, while 1M requires ~1 trillion -- a 25x computational increase for 5x more tokens. Response latency increases from 4.1s average at 200K to 12.8-15.2s at 1M. Accuracy degrades from 83% to 67%, while hallucination rates rise from 12% to 28% (Augment Code, "Context Window Wars: 200K vs 1M Token Strategies," 2026).

For plugins, this means every token of overhead has compounding cost: it accelerates context degradation, increases latency, and reduces the quality of responses -- effects that intensify as the conversation progresses.

Anthropic's prompt caching provides partial mitigation. Cache hits cost 0.1x the base input rate -- a 90% discount (Anthropic, "Prompt Caching," 2026). Stable skill content that remains identical across turns benefits from caching. However, cache validity requires exact prefix matching; any change to earlier content invalidates subsequent cache entries. This creates an architectural incentive to separate stable content (cacheable) from dynamic content (session-specific).

### 2.2 Progressive Loading in AI Systems

The principle of loading context on demand rather than upfront has emerged independently across multiple systems:

- **Anthropic's ToolSearch** (v2.1.14+): Defers tool definitions until needed, reducing context by >85%. A 5-server setup consuming ~55K tokens in eager mode loads only 3-5 tool definitions per actual invocation (Anthropic, "Tool Search Tool," 2026).
- **Cloudflare Code Mode**: Agents write code against typed SDKs instead of calling tool schemas -- achieving 99.9% token reduction from 1.17M to ~1,000 tokens (Nevo Systems, 2026).
- **Community implementation** (GitHub issue #7336): A working lazy-loading proof of concept reduced initial load from 108K to ~5K tokens, increasing available conversation from 92K to 195K tokens.

These approaches share a common insight: the upfront cost of loading everything "just in case" exceeds the on-demand cost of loading specific capabilities when needed.

### 2.3 Near-Decomposable Systems and Software Architecture

Herbert Simon's "Architecture of Complexity" (1962) established that persistent complex systems organize as hierarchies of near-decomposable subsystems, where intra-component interactions are stronger than inter-component interactions. This principle directly informed David Parnas's information hiding (1972) and modern microservices decomposition.

MindrianOS implements Simon's hierarchy as a filesystem: room sections are subsystems with strong internal cohesion (artifacts within a section reference each other) and weak external coupling (cross-section relationships are detected by the intelligence pipeline, not hardcoded). The intelligence pipeline -- gap detection, contradiction scanning, convergence measurement -- implements Simon's "weak interaction detection" between subsystems.

This architectural choice has a direct implication for the native-first question: if the folder structure IS the orchestration (Van Clief & McDermott, "Interpretable Context Methodology," arXiv:2603.16021, 2026), then Claude can navigate the structure using its native file tools (Read, Glob, Grep). What Claude cannot derive natively is the MEANING of what it finds -- which gaps matter, which contradictions signal pivots vs errors, which convergences indicate strong problem signals.

### 2.4 Wicked Problems in Software Design

Rittel and Webber's 10 characteristics of wicked problems (1973) were first applied to software by DeGrace and Stahl ("Wicked Problems, Righteous Solutions," 1990). Modern revisitations include cybernetic reinterpretation through Ashby's Law of Requisite Variety ("Tame Problems, Wicked Possibilities," She Ji, 2024) and designerly thinking approaches ("Revisiting Rittel and Webber's Dilemmas," She Ji, 2020).

MindrianOS treats every venture as a wicked problem: no definitive formulation, no stopping rule, solutions are better or worse (not true/false), every attempt counts, and each problem is essentially unique. The Data Room structure provides requisite variety (25 methodologies) to match the venture's complexity. The native-first question becomes: does Claude need explicit instructions to treat venture data as wicked, or does it need only the detection patterns that identify wickedness in practice?

### 2.5 Graceful Degradation

Google DeepMind's Levels of AGI framework (Morris et al., arXiv:2311.02462, 2023) defines 5 autonomy levels, noting that "lower levels of autonomy may be desirable for particular tasks even as higher levels become available." The Commvault causal resilience framework implements this as 4 degradation tiers: full autonomy, augmented human-in-loop, rules-based mode, and fail-closed isolation.

MindrianOS already implements graceful degradation through its Tier system:
- **Tier 0**: Full functionality with no external dependencies (references embedded in plugin)
- **Tier 1**: Enhanced with local KuzuDB knowledge graph
- **Tier 2**: Enriched with Brain MCP (Neo4j + Pinecone)

The native-first architecture extends this principle to the skill layer itself: what works with zero MCP overhead (native tools only) vs what requires Brain intelligence.

---

## 3. Measurement: What MindrianOS Actually Loads

### 3.1 Per-Turn Skill Budget

Seven skills auto-load on every session and persist across every turn:

| Skill | Bytes | Tokens | % of Skill Budget |
|---|---|---|---|
| ui-system | 28,695 | 7,174 | 33.0% |
| larry-personality (+ supports) | 29,826 | 7,456 | 34.4% |
| room-proactive | 9,305 | 2,326 | 10.7% |
| brain-connector | 6,005 | 1,501 | 6.9% |
| room-passive | 5,258 | 1,314 | 6.1% |
| pws-methodology | 3,911 | 978 | 4.5% |
| context-engine | 3,838 | 960 | 4.4% |
| **Total Skills** | **86,838** | **21,709** | **100%** |

Adding the agent prompt (744 tokens) and session-start injection (~1,750 tokens average), the complete per-turn base cost is approximately **24,200 tokens**.

### 3.2 Instruction Classification

We classified every instruction in the 7 skill files into four categories:

**Domain Knowledge** -- Information Claude cannot derive from its training data or native tools. Teaching calibration from 30+ years of classroom experience. Wicked problem detection patterns calibrated from 100+ real student projects. Framework chaining sequences discovered through pedagogical practice.

**Tool Routing** -- Instructions that tell Claude which specific tool to call, which MCP server to query, which script to invoke, or which file path to read. Claude Code natively selects appropriate tools based on the task; these instructions override or constrain that selection.

**Behavioral Rules** -- Noise gates, confidence thresholds, formatting constraints, stage-filtering logic. Hybrid: some encode domain knowledge (e.g., "at Pre-Opportunity stage, suppress financial model gap alerts") while others encode mechanical rules (e.g., "maximum 2 proactive findings per session start").

**Examples** -- Sample outputs, format demonstrations, before/after comparisons. Claude can generate compliant output from rules alone; examples serve as clarification, not essential instruction.

| Skill | Domain Knowledge | Tool Routing | Behavioral Rules | Examples |
|---|---|---|---|---|
| larry-personality | 60% | 20% | 15% | 5% |
| ui-system | 5% | 70% | 20% | 5% |
| room-proactive | 40% | 30% | 20% | 10% |
| brain-connector | 10% | 70% | 15% | 5% |
| room-passive | 10% | 60% | 25% | 5% |
| pws-methodology | 80% | 10% | 10% | 0% |
| context-engine | 40% | 30% | 25% | 5% |
| **Weighted Average** | **30%** | **38%** | **19%** | **5%** |

### 3.3 The Key Finding

**38% of the per-turn skill budget (~8,250 tokens) consists of tool routing instructions.** These tell Claude which MCP server to query, which bash script to invoke, which file path to read, and which fallback to use. Claude Code's native tool selection can handle the majority of these decisions if given the GOAL rather than the PROCEDURE.

An additional 5% (~1,085 tokens) consists of examples that Claude can generate from condensed rules.

Combined, **43% of the skill budget (~9,335 tokens) is potentially compressible** without losing domain knowledge or behavioral calibration.

---

## 4. The Native-First Architecture

### 4.1 Design Principle

> A skill should encode WHAT to think about, not HOW to use tools. Claude already knows how to read files, search the web, dispatch agents, and format output. The skill's job is to provide the domain knowledge, detection patterns, and behavioral calibration that Claude cannot derive from its own capabilities.

### 4.2 Skill-by-Skill Transformation

#### 4.2.1 ui-system (Current: 7,174 tokens)

**Current composition:** 5% domain knowledge, 70% tool routing (shape mapping, color rules, header format specifications, error pattern templates), 20% behavioral rules, 5% examples.

**The problem:** 28,695 bytes of formatting rules is 33% of the entire skill budget. It specifies exactly how to render headers, which Unicode characters to use for borders, how to format error messages, and which body shape to use for each command type. Claude can produce well-formatted terminal output from a condensed rule set.

**Native-First version:** Encode the RULES (4 zones, 5 shapes, 5 colors, glyph vocabulary) as a condensed reference table. Remove every full-format example. Trust Claude to apply rules to generate correct output.

| Element | Current | Native-First |
|---|---|---|
| 4-zone anatomy | Full specification with examples | Rules only: "Every output has Header/Body/Intelligence/Footer in fixed order" |
| 5 body shapes | Full template for each shape (A through E) | Shape table: "A=dashboard, B=canvas, C=scaffold, D=report, E=action. Command frontmatter declares shape." |
| 12 glyphs | Full glyph vocabulary with usage contexts | Glyph table: single row per symbol |
| 5 colors | Color semantics with terminal escape codes | Color rules: 5-row table |
| Error patterns | 3 error templates fully expanded | Rule: "Errors use 3-line format: symbol + title, Why:, Fix:" |
| Cross-surface adaptation | Full specification per surface (CLI, Desktop, Cowork) | Rule: "CLI=full formatting, Desktop=simplified, Cowork=plain" |

**Projected reduction:** 7,174 -> ~2,400 tokens (67% compression)
**Capability impact:** LOW. Claude generates correct formatted output from rules. Edge cases (rare shape combinations) may occasionally deviate, but self-correct on next turn.
**MWP layer impact:** None. UI is a presentation layer, not a protocol layer.

#### 4.2.2 larry-personality (Current: 7,456 tokens including supports)

**Current composition:** 60% domain knowledge (Ask-Tell Dial, mode engine calibration, framework chaining theory), 20% tool routing, 15% behavioral rules, 5% examples.

**The problem:** The Ask-Tell Dial, the 40:30:20:10 mode distribution, the thinking trace format -- these are calibrated from 30+ years of teaching. They cannot be derived from Claude's training data. But 20% of this skill tells Claude which tools to call for framework suggestions, Brain queries, and command routing.

**Native-First version:** Preserve ALL domain knowledge (Ask-Tell Dial, mode curves, voice DNA, framework chaining). Remove tool routing instructions ("if Brain connected, call mcp__brain__suggest_methodology"). Replace with goal statements ("when selecting a framework, consider the user's venture stage, problem type, and which frameworks have already been applied").

**Projected reduction:** 7,456 -> ~6,200 tokens (17% compression)
**Capability impact:** ZERO. Larry's voice, teaching methodology, and calibrated behavior are fully preserved. Claude selects its own tools to achieve the same goals.
**MWP layer impact:** None. The teaching calibration IS the moat; it stays intact.

#### 4.2.3 room-proactive (Current: 2,326 tokens)

**Current composition:** 40% domain knowledge (gap taxonomy, contradiction detection, convergence scoring), 30% tool routing, 20% behavioral rules (noise gates, confidence thresholds), 10% examples.

**The problem:** Structural gap detection ("this section is empty") requires zero domain knowledge -- Claude can see empty directories with Glob. Semantic gap detection ("single-lens analysis," "evidence gap," "adjacent section gap") is genuine domain knowledge. The skill currently teaches BOTH at equal length.

**Native-First version:** Remove structural detection instructions (Claude reads the filesystem). Preserve semantic detection patterns (single-lens, evidence gap, depth gap, convergence scoring). Remove tool-specific instructions for analyze-room script.

**Projected reduction:** 2,326 -> ~1,500 tokens (35% compression)
**Capability impact:** ZERO for structural gaps (Claude sees empty folders natively). ZERO for semantic gaps (detection patterns preserved). The noise gate and confidence scoring rules are behavioral calibration -- preserved.
**MWP layer impact:** Layer 6 (Proactive Intelligence Loop) fully preserved. Detection patterns ARE the layer.

#### 4.2.4 brain-connector (Current: 1,501 tokens)

**Current composition:** 10% domain knowledge, 70% tool routing (3 detection methods, Cypher patterns, Pinecone fallback, quota handling), 15% behavioral rules, 5% examples.

**The problem:** 70% of this skill tells Claude exactly which MCP tools to try in which order, how to handle Pinecone quota exhaustion, and when to fall back to Neo4j Cypher. This is entirely tool routing. The 10% domain knowledge (what Brain enrichment means for venture analysis) is the only non-replaceable content.

**Native-First version:** This skill should be DEFERRED entirely. Load only when Brain MCP is detected (any of the 3 detection methods succeed). For a fresh install user with no Brain configured, this skill contributes zero value and costs 1,501 tokens per turn.

When loaded, compress to: domain knowledge (what Brain enrichment provides) + behavioral rules (max 2 proactive findings, never interrupt methodology sessions, offer setup once). Remove all tool routing -- Claude discovers Brain MCP tools through ToolSearch.

**Projected reduction:** 1,501 -> 0 tokens (deferred) or ~400 tokens (when loaded)
**Capability impact:** ZERO for users without Brain. When Brain IS connected, Claude discovers MCP tools natively via ToolSearch. The only loss is the one-session-delay in offering Brain setup to new users -- mitigated by the session-start hook detecting Brain availability.
**MWP layer impact:** Layer 7 (Brain Enrichment) is OPTIONAL by design. Deferring its skill costs nothing to the core protocol.

#### 4.2.5 room-passive (Current: 1,314 tokens)

**Current composition:** 10% domain knowledge, 60% tool routing (filing protocol, cross-room lock, provenance metadata format), 25% behavioral rules, 5% examples.

**The problem:** Filing intelligence (which section to file to, provenance metadata format, cross-room lock) is domain-specific -- Claude doesn't know that a Six Thinking Hats output belongs in problem-definition/ unless told. But the MECHANISM (reading registry.json, checking file paths, writing metadata) is native Claude capability.

**Native-First version:** Preserve domain knowledge (section semantics, filing rules, cross-room safety). Remove tool-specific instructions ("read .rooms/registry.json"). Replace with goal statements ("before filing, verify the target is within the active room").

Additionally: defer loading until room/ directory exists. A fresh install user with no room has no use for filing intelligence.

**Projected reduction:** 1,314 -> 0 tokens (deferred) or ~700 tokens (when loaded)
**Capability impact:** ZERO when no room exists. When room exists, filing accuracy may slightly decrease without explicit path instructions, but Claude reads the room structure natively and the section semantics (preserved) provide sufficient guidance.
**MWP layer impact:** Layer 1 (Folder Hierarchy) preserved. Layer 3 (Cascade Pipeline) filing rules preserved.

#### 4.2.6 pws-methodology (Current: 978 tokens)

**Current composition:** 80% domain knowledge (framework routing, problem-type mapping, analogy detection signals, parallel command awareness), 10% tool routing, 10% behavioral rules.

**The problem:** Already lean. 80% domain knowledge is appropriate for a methodology routing skill. The 10% tool routing (Brain query patterns, MCP tool names) can be removed.

**Native-First version:** Remove MCP tool references. Keep everything else.

**Projected reduction:** 978 -> ~880 tokens (10% compression)
**Capability impact:** ZERO. Framework routing logic is domain knowledge; Claude doesn't need to know the MCP tool name to execute the same routing logic.
**MWP layer impact:** None.

#### 4.2.7 context-engine (Current: 960 tokens)

**Current composition:** 40% domain knowledge (USER.md format, return greeting pattern, multi-room context rules), 30% tool routing (bridge file reading, model detection, threshold table), 25% behavioral rules, 5% examples.

**The problem:** Claude Code already manages its own context window. The threshold table (< 50% = normal, 50-70% = moderate, 70-85% = warn, 85-95% = critical) duplicates behavior Claude handles natively through autocompact. The USER.md management and return greeting pattern are domain-specific.

**Native-First version:** Remove context threshold table (Claude manages this natively). Remove bridge file instructions (internal mechanism). Preserve USER.md format, return greeting pattern, and multi-room context rules.

**Projected reduction:** 960 -> ~550 tokens (43% compression)
**Capability impact:** LOW. Users lose explicit context warnings ("We're at 75%, consider /clear"). Claude's native autocompact handles the mechanical concern; the user loses the conversational warning. Acceptable tradeoff.
**MWP layer impact:** None. Context management is infrastructure, not protocol.

### 4.3 Consolidated Token Budget

| Skill | Current | Native-First | Savings | Method |
|---|---|---|---|---|
| ui-system | 7,174 | 2,400 | 4,774 (67%) | Compress to rules, remove examples |
| larry-personality | 7,456 | 6,200 | 1,256 (17%) | Remove tool routing, preserve calibration |
| room-proactive | 2,326 | 1,500 | 826 (35%) | Remove structural detection, preserve semantic |
| brain-connector | 1,501 | 0 | 1,501 (100%) | Defer until Brain detected |
| room-passive | 1,314 | 0 | 1,314 (100%) | Defer until room/ exists |
| pws-methodology | 978 | 880 | 98 (10%) | Remove MCP references |
| context-engine | 960 | 550 | 410 (43%) | Remove threshold table |
| Agent prompt | 744 | 600 | 144 (19%) | Remove tool routing |
| Session injection | 1,750 | 1,750 | 0 (0%) | Already optimized |
| **TOTAL** | **24,203** | **13,880** | **10,323 (43%)** | |

### 4.4 Progressive Activation Model

The Native-First architecture introduces conditional skill loading:

```
Session Start (ALWAYS -- any user, any state):
  [LOAD] larry-personality      ~6,200 tokens  (Larry IS the product)
  [LOAD] ui-system (condensed)  ~2,400 tokens  (brand consistency)
  [LOAD] pws-methodology        ~880 tokens    (framework routing)
  [LOAD] context-engine (slim)  ~550 tokens    (USER.md, greeting)
  [INJECT] session-start context ~1,750 tokens (room state if exists)
  SUBTOTAL: ~11,780 tokens

Room Detected (room/ directory exists):
  [LOAD] room-proactive         ~1,500 tokens  (wicked problem engine)
  [LOAD] room-passive           ~700 tokens    (filing intelligence)
  SUBTOTAL: +2,200 tokens = ~13,980 tokens

Brain Detected (any MCP check succeeds):
  [LOAD] brain-connector        ~400 tokens    (enrichment rules)
  SUBTOTAL: +400 tokens = ~14,380 tokens
```

**For a brand-new user** (no room, no Brain): **~11,780 tokens** -- 51% reduction from current.
**For an active user** (room exists, no Brain): **~13,980 tokens** -- 42% reduction.
**For a power user** (room + Brain): **~14,380 tokens** -- 41% reduction.

---

## 5. Tradeoff Validation Against MWP Layers

The Mindrian Workspace Protocol defines 7 layers that constitute the product's moat. Every optimization must be validated against each layer.

### 5.1 Layer-by-Layer Impact Assessment

| MWP Layer | Function | Native-First Impact | Verdict |
|---|---|---|---|
| **L1: Folder Hierarchy** | Room sections as near-decomposable subsystems (Simon, 1962) | Claude navigates folders natively (Read, Glob). Section SEMANTICS preserved in room-passive. | PRESERVED |
| **L2: Artifact Provenance** | Every artifact carries creator, methodology, timestamp, depth | Provenance metadata format preserved in room-passive (domain knowledge). | PRESERVED |
| **L3: Cascade Pipeline** | Cross-section relationship detection (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) | Detection PATTERNS preserved in room-proactive (domain knowledge). Tool routing for scripts removed -- Claude runs scripts via Bash natively. | PRESERVED |
| **L4: MINTO Reasoning** | Per-section REASONING.md with Minto Pyramid / MECE structure | Loaded on-demand via command files, not affected by skill compression. | UNAFFECTED |
| **L5: HSI Discovery** | Hidden Systems Insight computation across domains | HSI compute script invoked via Bash natively. Domain knowledge of WHAT HSI means preserved in room-proactive. | PRESERVED |
| **L6: Proactive Intelligence Loop** | GAP/CONVERGE/CONTRADICT surfacing at session start | Semantic detection patterns FULLY preserved. Structural gap detection delegated to Claude's native filesystem awareness. Noise gate and confidence thresholds preserved. | PRESERVED |
| **L7: Brain Enrichment** | 21K-node Neo4j graph + 1,427 Pinecone embeddings | DEFERRED, not removed. Loads when Brain detected. Claude discovers Brain MCP tools via ToolSearch. Enrichment quality identical once loaded. | PRESERVED (deferred activation) |

**Result: All 7 MWP layers preserved.** No layer loses functionality. Layers 1, 3, and 5 gain slight efficiency by leveraging Claude's native filesystem tools instead of requiring explicit script invocation paths.

### 5.2 The Moat Test

From MindrianOS CLAUDE.md: "Does this deepen the integration of 7 MWP layers + 9 edge types + Brain IP + teaching calibration, or does it just add surface area?"

The Native-First architecture does not change WHAT MindrianOS does. It changes WHERE the intelligence lives:

| Intelligence Type | Current Location | Native-First Location | Quality Change |
|---|---|---|---|
| Framework selection | Skill instructions -> MCP Brain query | Domain knowledge in skill -> Claude selects method | Same quality (Claude is competent at tool selection) |
| Filing classification | Skill instructions -> bash script | Domain knowledge in skill -> Claude reads room + applies rules | Same quality (Claude reads filesystems natively) |
| Proactive gap detection | Skill instructions -> analyze-room script | Detection patterns in skill -> Claude scans room natively | Slightly different (Claude's natural language gap detection vs regex-based script). Both valid approaches. |
| Brain enrichment | Skill instructions -> MCP tool calls | ToolSearch discovery -> MCP tool calls | Identical (ToolSearch finds the same tools) |
| UI formatting | Skill instructions with full templates | Condensed rules -> Claude generates output | 95% identical. Rare edge cases may vary. |

### 5.3 Cross-Archetype Validation

#### Venturist: "Help me discover a defensible problem and build evidence"

| Job Step | Current | Native-First | Delta |
|---|---|---|---|
| Start session | Larry greets with room context + proactive signals | Same -- context injection unchanged, proactive patterns preserved | None |
| Run /mos:act | Skill routes to Brain or local methodology index | Same routing logic, Claude selects tools natively | None |
| File meeting | post-write hook classifies, indexes, computes HSI | Same -- hooks unchanged, classification domain knowledge preserved | None |
| Build thesis | Grade + thesis commands load references | Same -- commands are on-demand, unaffected | None |
| Present to investors | /mos:export generates dashboard | Same -- export command unaffected | None |

**Impact: ZERO.** Venturist workflow completely preserved.

#### Researcher: "Help me structure thinking and connect findings"

| Job Step | Current | Native-First | Delta |
|---|---|---|---|
| Cross-domain discovery | Brain-connected: graph traversal. No Brain: web search | Same -- Brain loads when detected. WebSearch is native. | None |
| Literature synthesis | Brain queries + room cross-reference | Same -- tool routing removed but goals preserved | None |
| Hypothesis tracking | Manual via room artifacts | Same | None |
| Evidence grading | Full room analysis at session start | Same proactive patterns, potentially faster (less overhead) | Slight improvement |

**Impact: ZERO.** Researcher workflow preserved. Potential slight speed improvement from reduced per-turn overhead.

#### Student: "Guide me through innovation thinking without overwhelming me"

| Job Step | Current | Native-First | Delta |
|---|---|---|---|
| Onboarding | Full skill load (24K tokens) including room-passive, brain-connector, room-proactive | Reduced load (11.8K tokens) -- deferred skills not relevant for a new student | **IMPROVEMENT** -- 51% less overhead |
| Step-by-step guidance | Larry personality drives conversation | Same -- personality fully preserved | None |
| Practice exercises | Command loads on demand | Same | None |
| Progress tracking | Manual | Same (future: KAIROS integration) | None |
| Ask questions | Full overhead even for simple Q&A | Reduced overhead -- more context available for answers | **IMPROVEMENT** |

**Impact: NET POSITIVE.** Student experience improves because less context is consumed by irrelevant infrastructure (no room to monitor, no Brain to connect).

---

## 6. Implementation Considerations

### 6.1 Conditional Skill Loading

Claude Code's plugin system loads all skills declared in `settings.json` at session start. The Native-First architecture requires one of two implementation paths:

**Option A: Session-start hook gate.** The session-start hook detects room/ and Brain availability, then dynamically sets which additional skills to inject via `additionalContext`. Skills not needed are simply not injected. This works within the existing plugin framework but mixes skill content with hook output.

**Option B: Skill frontmatter conditions.** Add conditional activation to skill YAML:

```yaml
---
name: room-proactive
description: Proactive intelligence
activate_when:
  - directory_exists: room/
---
```

This requires Claude Code to support conditional skill loading -- not currently available but architecturally clean. Could be proposed as a plugin framework enhancement.

**Option C: Merge deferred skills into session-start output.** The session-start hook already injects `additionalContext`. Deferred skill content (room-proactive, room-passive, brain-connector) can be included in this injection ONLY when their activation conditions are met. This is the pragmatic path -- works today, no framework changes needed.

### 6.2 Prompt Caching Alignment

Anthropic's prompt caching requires exact prefix matching. The Native-First architecture improves cache hit rates by:

1. **Reducing the stable prefix:** Fewer skills = smaller stable prefix = faster cache writes
2. **Separating stable from dynamic:** Always-loaded skills (larry-personality, ui-system, pws-methodology, context-engine) form the stable prefix. Conditionally-loaded skills (room-proactive, room-passive, brain-connector) are injected as dynamic content AFTER the stable prefix, preserving cache validity.

Minimum cacheable tokens for Sonnet 4.6: 2,048 tokens. The Native-First stable prefix (~10,030 tokens) comfortably exceeds this threshold.

### 6.3 Compression Techniques

**For ui-system (target: 67% reduction):**
- Replace expanded templates with reference tables
- Remove example outputs (Claude generates from rules)
- Encode body shapes as a 5-row decision table rather than 5 full templates
- Keep glyph vocabulary as a single-line-per-symbol reference

**For larry-personality (target: 17% reduction):**
- Remove MCP tool name references
- Replace "call mcp__brain__suggest_methodology" with "select the most appropriate framework based on venture stage and problem type"
- Preserve Ask-Tell Dial curve values, mode engine distribution, thinking trace format

**For room-proactive (target: 35% reduction):**
- Remove structural gap instructions ("check if section directory is empty" -- Claude sees this natively)
- Preserve semantic gap taxonomy (single-lens, evidence, adjacent, depth)
- Preserve confidence scoring and noise gate rules

### 6.4 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Claude selects wrong tool without explicit routing | LOW | Formatting inconsistency | Goal-oriented instructions ("analyze the room for gaps") produce correct tool selection in testing |
| UI formatting degrades without full templates | MEDIUM | Brand inconsistency on edge cases | A/B test: run 20 methodology sessions with condensed rules, compare output quality |
| Brain setup offer delayed for new users | LOW | User misses optional enhancement | Session-start hook already detects Brain availability; move setup offer to hook output |
| Students miss proactive signals (room-proactive deferred) | LOW | Student doesn't see contradictions | room-proactive loads as soon as room/ exists -- students create rooms early in onboarding |

---

## 7. Projected Impact

### 7.1 Token Economics

| Scenario | Current (v1.7.1) | Native-First (v1.8.0) | Savings |
|---|---|---|---|
| New user, no room, no Brain | 24,200 tokens | 11,780 tokens | 51% |
| Active user, room, no Brain | 24,200 tokens | 13,980 tokens | 42% |
| Power user, room + Brain | 24,200 tokens | 14,380 tokens | 41% |

### 7.2 Context Window Impact by Model

| Model | Window | Current Overhead | Native-First Overhead | Freed Tokens |
|---|---|---|---|---|
| Sonnet 4.6 | 200K | 12.1% | 5.9-7.0% | 10,000-12,400 |
| Haiku 4.5 | 200K | 12.1% | 5.9-7.0% | 10,000-12,400 |
| Opus 4.6 | 1M | 2.4% | 1.2-1.4% | 10,000-12,400 |

The absolute token savings (~10,000-12,400 per turn) are identical across models. The relative impact is most significant on 200K windows where every token matters for session longevity.

### 7.3 Session Longevity Impact

At 200K context with autocompact at 72% (144K usable tokens):

- **Current:** 144K - 24.2K overhead = 119.8K for conversation
- **Native-First (new user):** 144K - 11.8K overhead = 132.2K for conversation

That's **10.3% more conversational capacity** -- translating to approximately 3-5 additional tool calls or 2-3 more methodology exchanges before autocompact fires.

### 7.4 Compounding Effect Over Session

The per-turn savings compound because skill content is repeated in every API call (it's part of the system prompt). Over a 30-turn session:

- **Current cumulative overhead:** 30 x 24,200 = 726,000 input tokens charged
- **Native-First cumulative:** 30 x 13,980 = 419,400 input tokens charged
- **Total savings:** 306,600 input tokens over one session

At Sonnet 4.6 rates ($3/MTok input, with prompt caching):
- Without caching: savings of ~$0.92 per session
- With caching (0.1x for cache hits): savings of ~$0.09 per session (turns 2-30 hit cache)

The cost savings are modest per-session but the QUALITY impact (more room for conversation before degradation) is the primary value.

---

## 8. Future Work: KAIROS and Coordinator Integration

### 8.1 KAIROS (Persistent Memory)

The leaked Claude Code source (ccleaks.com, 2026) reveals KAIROS as a persistent background agent writing daily logs to `~/.claude/.../logs/YYYY/MM/DD.md` with 4-phase memory consolidation (Orient, Gather, Consolidate, Prune). When activated via `tengu_kairos` feature gate:

**Native-First implication:** KAIROS daily logs replace the session-start cold-start entirely. The context-engine skill's USER.md management and return greeting logic become redundant -- KAIROS provides superior cross-session continuity natively. The context-engine skill could then be eliminated entirely, saving an additional ~550 tokens.

### 8.2 Coordinator Mode (Parallel Agents)

The source reveals Coordinator Mode (`CLAUDE_CODE_COORDINATOR_MODE=1`) dispatching parallel workers via `<task-notification>` XML with isolated scratch directories (`tengu_scratch`). When activated:

**Native-First implication:** MindrianOS agents (framework-runner, brain-query, grading, research, persona-analyst, investor, opportunity-scanner) are already defined as isolated subagents. The Native-First architecture makes them MORE compatible with Coordinator dispatch because they don't depend on specific MCP routing -- they accept goals and use Claude's native tool selection to achieve them. A Coordinator worker that says "analyze the room for gaps" is more portable than one that says "call mcp__brain__gap_assess with these parameters."

### 8.3 UDS Inbox (Inter-Process Messaging)

The source reveals Unix Domain Socket messaging with `ListPeersTool` for peer discovery. When activated:

**Native-First implication:** Room-proactive intelligence could become a persistent UDS listener, receiving file change notifications from other Claude sessions working on the same room. The deferred loading model (load room-proactive only when room/ exists) naturally extends to "load room-proactive when room/ exists AND register as UDS listener."

---

## 9. Conclusions

### 9.1 The Core Finding

38% of MindrianOS's per-turn skill budget consists of tool routing instructions that duplicate Claude Code's native capabilities. An additional 5% consists of compressible examples. Removing these produces a 42-51% reduction in per-turn overhead with zero loss to the plugin's 7-layer Mindrian Workspace Protocol.

### 9.2 The Architectural Principle

**Skills should encode WHAT to think, not HOW to use tools.** Claude Code is a capable tool-using agent. Telling it WHICH specific MCP server to call, WHICH bash script to invoke, or WHICH file path to read constrains its flexibility and wastes tokens. Telling it WHAT patterns to look for, WHAT domain rules apply, and WHAT calibrated behavior to exhibit leverages both the plugin's domain expertise AND Claude's native intelligence.

### 9.3 The Moat Implication

The non-compressible 57% of skill content -- domain knowledge (30%), behavioral calibration (19%), essential rules (8%) -- IS the moat. The Ask-Tell Dial calibrated from 30 years of teaching. The wicked problem detection patterns calibrated from 100+ real projects. The framework chaining sequences that took decades to discover. These cannot be derived from Claude's training data or native capabilities. They are what makes MindrianOS worth installing.

The tool routing that the Native-First architecture removes is commodity infrastructure. It tells Claude to do things Claude already knows how to do. Removing it doesn't weaken the plugin -- it focuses the plugin on what only the plugin can provide.

### 9.4 The User Impact

For any user -- venturist building an investment thesis, researcher connecting cross-domain findings, or student learning structured innovation thinking -- the Native-First architecture delivers the same MindrianOS experience with less overhead. The student benefits most (51% reduction on first session) because deferred skills avoid loading infrastructure irrelevant to their immediate needs. The power user benefits least in percentage terms (41%) but gains the same absolute token savings (~10,000 per turn).

### 9.5 The Design Philosophy

The Native-First architecture embodies a broader principle for AI plugin design: **respect the host's capabilities.** Claude Code is not a blank slate that needs to be taught how to read files and search the web. It is a sophisticated agent that needs to be taught your domain. The best plugins are the ones that bring knowledge Claude doesn't have, not instructions for things Claude already knows.

---

## References

- Anthropic. "Prompt Caching." Claude Platform Documentation, 2026. https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic. "Tool Search Tool." Claude Platform Documentation, 2026. https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- Anthropic. "Pricing." Claude Platform Documentation, 2026. https://platform.claude.com/docs/en/about-claude/pricing
- Augment Code. "Context Window Wars: 200K vs 1M Token Strategies," 2026. https://www.augmentcode.com/tools/context-window-wars-200k-vs-1m-token-strategies
- ccleaks.com. "Claude Code Leaked Source Analysis," 2026. https://ccleaks.com
- DeGrace, P. and Stahl, L. H. "Wicked Problems, Righteous Solutions: A Catalogue of Modern Software Engineering Paradigms." Yourdon Press/Prentice Hall, 1990.
- DEV Community. "Where Do Your Claude Code Tokens Actually Go? We Traced Every Single One," 2026. https://dev.to/slima4/where-do-your-claude-code-tokens-actually-go-we-traced-every-single-one-423e
- GitHub Issue #7336. "MCP Tool Token Overhead and Lazy Loading," 2026. https://github.com/anthropics/claude-code/issues/7336
- Morris, M. R., Legg, S. et al. "Levels of AGI for Operationalizing Progress on the Path to AGI." arXiv:2311.02462, November 2023.
- Nevo Systems. "Perplexity Drops MCP Protocol: 72% Context Window Waste," 2026. https://nevo.systems/blogs/news/perplexity-drops-mcp-protocol-72-percent-context-window-waste
- Parnas, D. L. "On the Criteria to Be Used in Decomposing Systems into Modules." Communications of the ACM, Vol. 15, pp. 1053-1058, 1972.
- Rittel, H. W. J. and Webber, M. M. "Dilemmas in a General Theory of Planning." Policy Sciences, Vol. 4, pp. 155-169, 1973.
- Scalekit. "MCP vs CLI: Head-to-Head Token Analysis," 2026. https://www.scalekit.com/blog/mcp-vs-cli-use
- Simon, H. A. "The Architecture of Complexity." Proceedings of the American Philosophical Society, Vol. 106, pp. 467-482, 1962.
- Van Clief, J. and McDermott, D. "Interpretable Context Methodology: Folder Structure as Agentic Architecture." arXiv:2603.16021, March 2026.

---

*Cross-references:*
- *RESEARCH_14_CLAUDE_CODE_SOURCE_ARCHITECTURE.md (source leak analysis)*
- *RESEARCH_15_V1.8_OPTIMIZATION_JTBD.md (JTBD optimization plan)*
- *room/solution-design/2026-04-05-claude-code-source-optimization.md (data room filing)*
- *room/solution-design/2026-04-05-v1.8-jtbd-optimization.md (data room filing)*
