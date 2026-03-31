# RESEARCH 11: Powerhouse 1.6.0 Session - Complete Record

Date: 2026-03-31
Session type: Deep research + implementation
Branch: ui/destijl-rebuild
Outcome: Spectral OM-HMM implemented, full 1.6.0 spec written

---

## Session Flow

This document records the complete reasoning chain from a single Claude Code session that produced the MindrianOS 1.6.0 "Powerhouse" specification and the spectral OM-HMM implementation. Each section maps to a conversation step and captures WHY each decision was made.

---

## Step 1: Claude Code Capability Audit (ccleaks.com)

### What We Did
Deep-researched ccleaks.com - a site that reverse-engineers Claude Code's TypeScript source (1,884 files, 512K LOC). Cataloged every feature, capability, and unreleased gate.

### Key Findings

**20 Hook Events (MindrianOS uses 3):**
SessionStart, SessionEnd, PreToolUse, PostToolUse, PostToolUseFailure, StopHook, PreCompact, PostCompact, SubagentStart, SubagentStop, TeammateIdle, TaskCreated, TaskCompleted, ConfigChange, CwdChanged, FileChanged, UserPromptSubmit, PermissionRequest, PermissionDenied, SetupHook.

MindrianOS only wires: SessionStart, PostToolUse(Write), Stop. 17 hooks untapped.

**Unreleased Features (Build-Flagged or Tengu-Gated):**
- KAIROS (tengu_kairos): Persistent assistant, dream cycles, push notifications
- Daemon Mode (DAEMON flag): `claude --bg` background tmux sessions
- UDS Inbox (UDS_INBOX flag): Cross-session IPC via Unix Domain Sockets
- Coordinator Mode (CLAUDE_CODE_COORDINATOR_MODE env): Multi-agent orchestration with XML task notifications
- UltraPlan (tengu_ultraplan_model): 30-minute remote Opus planning sessions
- Bridge (BRIDGE_MODE flag): Remote control via API
- Auto-Dream (tengu_onyx_plover): Memory consolidation after 24h+ and 5+ sessions
- Buddy (BUDDY flag): Virtual pet companion, teaser Apr 1-7 2026
- Scratchpad (tengu_scratch): Session-scoped temp workspace
- Workflow Scripts (WORKFLOW_SCRIPTS flag): Automated tool sequences

**Model Routing:**
- Plan Mode V2: 3 parallel exploration agents (Max/Enterprise), 1 (default)
- Fast Mode: 6x pricing ($30/M vs $5/M) for priority inference
- Model aliases: opus, sonnet, haiku, best (Opus 4.6)
- Unreleased model references: opus-4-7, sonnet-4-8

**32 Build-Time Feature Flags, 10 GrowthBook Gates, 120+ Environment Variables, 26 Hidden Commands.**

### Why This Matters
MindrianOS can use available hooks TODAY (PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted) without waiting for gated features. The gated features (KAIROS, Daemon, Coordinator) can be prepared for with format-compatible room structures.

---

## Step 2: MindrianOS Current Architecture Audit

### What We Did
Comprehensive exploration of MindrianOS-Plugin (276 files, 7 layers). Mapped every command (53), skill (7), agent (8), hook (3), pipeline (8), script (40), library module (37), template (13).

### Key Architecture Findings

**ICM-Native Design (Van Clief & McDermott 2026, arxiv 2603.16021):**
Folder structure IS agentic architecture. Room sections ARE near-decomposable subsystems (Simon 1962). No separate orchestration framework needed.

**5 ICM Layers Mapped to MindrianOS:**
- Layer 0 (Identity): Venture's problem formulation (STATE.md)
- Layer 1 (Routing): Problem type x wickedness -> agent/skill response
- Layer 2 (Contracts): Pipeline stage contracts encode cascade rules
- Layer 3 (Reference): Brain graph + methodology refs + assumption registry
- Layer 4 (Artifacts): Room entries = claims with validity + cross-refs

**Post-Write Cascade (8 steps):**
Classify -> Stamp artifact-id -> Weave (KuzuDB 9 edge types) -> Refresh STATE.md -> Map graph -> Discover (HSI + reverse salients) -> Version (git) -> Publish (presentation views)

**All 8 Agents Use model: inherit:**
larry-extended, framework-runner, grading, investor, brain-query, research, opportunity-scanner, persona-analyst. No cost optimization. No task-appropriate model selection.

### Why This Matters
The architecture is sound (ICM + Simon + Rittel-Webber) but underutilizes Claude Code's capabilities. The cascade pipeline is the perfect insertion point for new hooks and model routing. Every optimization flows through the cascade, not around it.

---

## Step 3: JTBD Cross-Reference

### What We Did
Researched MindrianOS's Jobs-to-Be-Done documentation across all repos. Found the core job statement, three synthetic personas (P1/P2/P3), and the product positioning.

### Core Job
"Reduce the time between insight and validated decision across every dimension of the venture simultaneously."

Key word: SIMULTANEOUSLY. The current system processes dimensions sequentially. The powerhouse transformation delivers on the "simultaneously" promise via parallel agent execution.

### Three Personas
- P1 (Casual Explorer): 50.5% dropout. Needs quick value. Budget model routing makes exploration cheap.
- P2 (Pushback User): Needs rejection memory. PreCompact/PostCompact prevent context loss.
- P3 (Strategic Builder): Needs background scouting, parallel swarm, cross-domain discovery.

### Why This Matters
Every optimization is evaluated against the core job. If it doesn't compress time-to-decision, it doesn't belong. The persona framework ensures P1/P2/P3 pain points are addressed.

---

## Step 4: Core Research Foundations

### What We Did
Cataloged all academic theories underpinning MindrianOS architecture. Found 19 distinct theoretical sources organized into 9 tiers.

### The Foundation Stack
1. Simon (1962) Architecture of Complexity - THE basis theorem. Folder structure = near-decomposable hierarchy.
2. Rittel & Webber (1973) Wicked Problems - 10 characteristics. Venture IS a wicked problem.
3. Van Clief & McDermott (2026) ICM - Folder structure as agentic architecture. arxiv 2603.16021.
4. Christensen/Ulwick JTBD - Core job: time compression.
5. Tetlock (2015) Superforecasting - Bayesian belief revision via contradiction detection.
6. Aronhime (30 years) Teaching Methodology - Mode engine, grading calibration.
7. Hughes (1983) Reverse Salients - Lagging components in expanding systems.
8. Forrester/Meadows Systems Dynamics - Loops, stocks, flows, leverage points.
9. Ashby (1956) Requisite Variety - 26 methodologies match wicked problem complexity.
10. Knight (1921) Risk vs Uncertainty - Risk managed, uncertainty navigated.
11. De Bono (1985) Six Thinking Hats - Multi-perspective analysis.
12. Minto (1987) Pyramid Principle - SCQA + MECE per-section reasoning.
13. Nonaka (1995) Knowledge Creation - SECI model (tacit to explicit).
14. Anthropic Interpretability Research (2025) - Claude thinks in concepts, plans destinations first, hallucination = recognition misfire.

### Why This Matters
The moat is not any single theory. It is the INTEGRATION of all 14+ theories into a working system. A competitor copying folder structure gets Layer 1. They need all layers working together plus 30 years of teaching calibration.

---

## Step 5: Feasibility Analysis

### What We Did
Separated available-TODAY capabilities from gated/unreleased features. Designed a realistic implementation path.

### Available Now
- 20 hook events (6 new ones to wire)
- Agent tool with run_in_background (parallel execution)
- Multiple Agent calls per message (swarm pattern)
- CronCreate/RemoteTrigger tools (in deferred registry, untested)
- Memory system, worktrees, plan mode

### Gated (Cannot Use Yet)
- KAIROS (tengu_kairos)
- Daemon Mode (DAEMON flag)
- UDS Inbox (UDS_INBOX flag)
- Coordinator Mode (env var)
- UltraPlan (tengu_ultraplan_model)
- Bridge (BRIDGE_MODE flag)
- Auto-Dream (tengu_onyx_plover)
- Buddy (BUDDY flag)
- Scratchpad (tengu_scratch)

### Decision
Build on what exists today (hooks, parallel agents, model routing). Prepare room formats for gated features so MindrianOS is day-one compatible when they ship.

---

## Step 6: ICM Deep Dive + Room Operations

### What We Did
Deep-read every CJS module, script, hook, and room operation to understand exactly what operates inside each room section.

### Key Module Inventory

**reasoning-ops.cjs (640 lines):** Manages .reasoning/{section}/REASONING.md lifecycle. YAML frontmatter with requires, provides, affects, confidence, verification. Creates REASONING_INFORMS edges.

**lazygraph-ops.cjs (412 lines):** KuzuDB wrapper. 9 edge types. Open-use-close pattern. Artifact indexing. Cypher queries. Schema initialization.

**proactive-intelligence.cjs (229 lines):** Parses analyze-room output. Persists to .proactive-intelligence.json. Repeat suppression (threshold 3). Cross-room relationship tracking.

**state-ops.cjs (47 lines):** Bash-wrapping only. Calls compute-state script.

**room-ops.cjs (93 lines):** Section discovery. Room analysis. Active room resolution (registry or fallback).

**graph-ops.cjs (143 lines):** Wrapper around lazygraph and bash scripts.

### Per-Section Intelligence

Each of the 8 sections has:
- Specific artifact types filed there
- Specific methodologies routing to it (via problem-types.md)
- Specific graph edges connecting it to other sections
- Intelligence operations (gap detection, contradiction, convergence)
- De Stijl color assignment

The section colors are semantic: rust (problem-definition), gold (market-analysis), gray (solution-design), green (business-model), orange (competitive-analysis), blue (team-execution), purple (legal-ip), teal (financial-model).

### Why This Matters
Understanding the exact CJS module chain is required for wiring new hooks. Each hook must call the right modules in the right order. The cascade pipeline is: room-ops -> state-ops -> reasoning-ops -> lazygraph-ops -> proactive-intelligence -> graph-ops.

---

## Step 7: GSD Model Routing Research

### What We Did
Deep-read GSD's model-profiles.cjs, core.cjs, init.cjs, and settings workflow to understand exactly how GSD assigns models per agent.

### GSD's Pattern (Proven)

**3 files:** model-profiles.cjs (table), core.cjs (resolveModel), config.json (user choice)

**12 agents mapped to 3 tiers:**
- quality: Opus everywhere except verification
- balanced: Opus for planning, Sonnet for execution/research/verification
- budget: Sonnet for writing, Haiku for research/verification
- inherit: All agents use parent session model

**4-step resolution:** override > runtime > profile > default

**Key insight:** Model quality matters most at the PLANNING stage (architecture decisions). Execution and verification can use lower tiers since they follow explicit instructions.

### MindrianOS Adaptation

Added venture-stage adaptive hints (unique to MindrianOS, GSD doesn't have this). Pre-Opportunity ventures use cheap models. Investment-stage ventures use Opus everywhere.

5-step resolution: override > stage-hint > runtime > profile > default

Per-room config (not global) because different ventures need different profiles.

---

## Step 8: Markov Chain Connection (Seabrook & Wiskott 2022)

### What We Did
User shared arxiv 2207.02296 - "Tutorial on Spectral Theory of Markov Chains." We connected it to the OM-HMM scorer in compute-hsi.py.

### The Connection

The HSI pipeline already had an "OM-HMM" (Observation Model Hidden Markov Model) scorer, but it was a simplified keyword-density proxy (V4 legacy). The Seabrook & Wiskott paper provides the mathematical framework to make it rigorous.

**The insight:** Texts that rapidly transition between thinking modes exhibit higher integrative thinking quality. The spectral gap of the thinking-mode Markov chain quantifies this mixing rate. Fast mixing = rich cross-domain thinking. Slow mixing (absorbing states) = shallow single-mode analysis.

### Spectral Components

1. **Transition matrix:** Sentence-level thinking mode classification -> state-to-state probabilities
2. **Spectral gap:** 1 - |lambda_2| from eigenvalue decomposition. Larger = faster mixing.
3. **Stationary distribution:** Long-run mode proportions. Left eigenvector for eigenvalue 1.
4. **Absorbing tendency:** High self-loop probability = stuck in single mode.

### New Scoring Formula (replaces keyword-density)
- 40% spectral gap (mixing rate)
- 25% integrative weight (stationary distribution)
- 20% mode diversity (Shannon entropy)
- 15% anti-absorption (penalty for stuck modes)

### Why This Matters
This transforms HSI from "keyword matching with extra steps" into "genuine mathematical innovation discovery." The spectral approach is a research contribution -- no competitor has Markov chain analysis applied to venture artifact thinking-mode detection. And it makes the breakthrough_potential scoring more accurate at finding genuine cross-domain connections vs superficial keyword matches.

---

## Step 9: Implementation

### What We Built

**scripts/compute-hsi.py changes:**
- 5 thinking modes: analytical, integrative, descriptive, evaluative, creative
- classify_sentence_mode(): regex-based sentence tagging
- build_transition_matrix(): Markov chain with Laplace smoothing (alpha=0.1)
- compute_spectral_gap(): eigenvalue decomposition
- compute_stationary_distribution(): left eigenvector
- detect_absorbing_tendency(): self-loop analysis
- compute_artifact_spectral_profile(): full profile per artifact
- compute_omhmm_score(): new 4-component formula
- _compute_omhmm_legacy(): preserved V4 fallback for short texts (< 5 sentences)
- Output extended: per-artifact spectral profile, per-pair spectral_gap_avg and dominant_modes, room-level spectral summary

**scripts/detect-reverse-salients.py changes:**
- score_breakthrough_potential(): new formula with 15% spectral bonus
  - 0.60 * novelty + 0.25 * feasibility + 0.15 * spectral_gap_avg
- Output extended: spectral_gap_avg, left_dominant_mode, right_dominant_mode per reverse salient

**docs/POWERHOUSE-1.6.0-SPEC.md:**
- 14-part specification covering all 1.6.0 deliverables
- MWP (7 layers), 9 edge types, spectral OM-HMM, 6 hooks, model routing, parallel agents, sentinel mode, 12 ccleaks future-proofing items, opportunity bank, cross-domain detection, timeline, files, metrics, references

### What Was NOT Built (Planned for Weeks 1-3)
- lib/core/model-profiles.cjs (model routing table)
- commands/models.md (user command)
- 6 new hook scripts (pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete)
- hooks/hooks.json updates
- --swarm, --parallel, --full, --broad flags on commands
- /mos:scout command
- room/.context/ directory structure
- .claude/teams/mindrian.json

---

## Step 10: The Five Powerhouse Modes

### Why We Named Them
The optimization layers needed a user-facing conceptual framework. Five modes capture what the system DOES, not how it's built:

**SENTINEL (Always Watching):** Cron triggers + FileChanged + PostCompact. Larry monitors continuously. Research foundation: Rittel-Webber (constant vigilance for wicked problems).

**SWARM (Parallel Intelligence):** run_in_background + multiple Agent calls + SubagentStop. 3-8 agents simultaneously. Research foundation: Simon (parallel subsystem processing accelerates evolution).

**ADAPTIVE (Stage-Aware Intelligence):** Venture-stage hints + model routing. Pre-Opportunity = cheap exploration. Investment = quality everywhere. Research foundation: Knight (uncertainty vs risk demands different cognitive tools).

**CASCADE (Self-Healing Intelligence):** 8-step post-write pipeline + SubagentStop auto-filing. Every change triggers automatic cross-reference detection. Research foundation: Simon (weak interactions between subsystems = value concentration).

**PERSISTENT (Never-Forgetting Intelligence):** room/.context/ + PreCompact/PostCompact + KAIROS prep. Cross-session continuity. Research foundation: Nonaka (knowledge creation across time).

---

## Step 11: The Moat Analysis

### What Makes MWP Uncopyable

7 layers that must work together. 9 KuzuDB edge types operating continuously. Spectral Markov innovation discovery (research contribution). Opportunity Bank with graph-connected room_connections. Proactive intelligence loop learning from APPROVE/REJECT/DEFER decisions. Brain with 21K nodes, 65K relationships (never distributed). Teaching calibration from 100+ real projects (30 years).

The compounding effect: every week of operation, every user decision stored as graph data, every HSI computation refining connections, every Brain query enriching local KuzuDB -- the moat deepens automatically.

### The Formula
Prompts can be copied. The graph that knows WHEN to use WHICH prompt, in WHAT sequence, calibrated by REAL teaching data -- that's the moat. And with spectral OM-HMM, the innovation discovery itself becomes a research contribution that requires both venture methodology expertise AND spectral graph theory expertise to replicate.

---

## Decision Log

| Decision | Reasoning | Alternative Considered |
|----------|-----------|----------------------|
| 6 new hooks (not all 17) | These 6 have immediate high-value room applications. Others are lower priority. | Wire all 17 hooks -- rejected as over-engineering |
| Per-room model config (not global) | Different ventures need different profiles | Global config -- rejected because Investment-stage venture needs Opus while exploration needs Haiku |
| Venture-stage adaptive hints | Cognitive demands change across lifecycle | Static profiles only -- rejected because Pre-Opportunity and Investment have fundamentally different needs |
| Spectral OM-HMM (not full NLP classifier) | Regex-based mode tagging is fast, dependency-free, and produces meaningful Markov chains | Fine-tuned classifier -- rejected as too heavy for room-level computation |
| Legacy fallback for short texts | < 5 sentences insufficient for meaningful transition matrix | Force spectral on all texts -- rejected because 3-sentence artifacts produce degenerate matrices |
| 15% spectral bonus in breakthrough scoring | Rewards genuine integrative thinking without dominating the formula | 30% bonus -- rejected as over-weighting spectral vs structural/semantic signals |
| 3-week delivery timeline | Each week delivers standalone value. Foundation (hooks + routing) first, then parallel patterns, then sentinel + persistence | Big-bang 1-week sprint -- rejected as too risky |
| Prepare for gated features (not wait) | Room format decisions cost nothing now and enable day-one compatibility | Ignore gated features -- rejected as missing the KAIROS/Daemon opportunity |

---

## Files Created This Session

1. docs/POWERHOUSE-1.6.0-SPEC.md -- Complete 14-part specification
2. docs/research/RESEARCH_11_POWERHOUSE_SESSION.md -- This document

## Files Modified This Session

1. scripts/compute-hsi.py -- Spectral OM-HMM upgrade (6 new functions, extended output format)
2. scripts/detect-reverse-salients.py -- Spectral bonus in breakthrough scoring

## Files Referenced But Not Modified

- All 37 lib/core/*.cjs modules (read for architecture understanding)
- All 53 commands/*.md (read for dispatch patterns)
- All 8 agents/*.md (read for model: inherit confirmation)
- hooks/hooks.json (read, modification planned for Week 1)
- settings.json (read for skill activation order)
- CLAUDE.md (read for architecture rules)
- references/methodology/index.md, problem-types.md (read for framework routing)
- All pipeline CHAIN.md files (read for stage contracts)
- scripts/session-start, post-write, on-stop, compute-state, analyze-room (read for hook chain)
- skills/room-passive/SKILL.md, room-proactive/SKILL.md (read for intelligence loop)
- references/reasoning/, templates/MINTO.md (read for MINTO structure)
- references/hsi/HSI-TOOLS-REFERENCE.md (read for HSI pipeline)
- lib/core/lazygraph-ops.cjs (read for 9 edge types)
- lib/core/proactive-intelligence.cjs (read for signal persistence)
- lib/core/reasoning-ops.cjs (read for REASONING_INFORMS edges)

## External Sources Researched

1. ccleaks.com -- Claude Code reverse-engineering site (full catalog)
2. arxiv 2603.16021 -- Van Clief & McDermott (2026) ICM paper
3. arxiv 2207.02296 -- Seabrook & Wiskott (2022) Spectral Theory of Markov Chains
4. GSD plugin source (~/.claude/get-shit-done/) -- Model routing architecture

---

## Next Steps (Week 1 Start)

1. Create lib/core/model-profiles.cjs
2. Create commands/models.md
3. Wire model resolution into act, grade, research, persona, deep-grade commands
4. Create scripts/pre-compact and scripts/post-compact
5. Create scripts/on-file-changed and scripts/on-cwd-changed
6. Create scripts/on-agent-complete and scripts/on-task-complete
7. Update hooks/hooks.json with 6 new entries
8. Test end-to-end: swarm dispatch -> SubagentStop -> cascade -> HSI recomputation

---

## Research Cross-References

This document connects to:
- RESEARCH_05_NESTED_SYSTEMS.md (Simon's architecture -- foundation for MWP Layer 1)
- RESEARCH_06_WICKED_PROBLEMS.md (Rittel-Webber -- foundation for MWP Layer 6)
- RESEARCH_07_HOW_CLAUDE_THINKS.md (Anthropic interpretability -- quality gates)
- RESEARCH_03_JTBD_THEORY.md (Christensen/Ulwick -- core job evaluation)
- LIVE_DATA_ROOM_JTBD_PAPER.md (Full theoretical grounding)
