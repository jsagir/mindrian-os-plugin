# MindrianOS 1.6.0 "Powerhouse" - Complete Specification

Version: 1.6.0
Codename: Powerhouse
Status: In Development
Date: 2026-03-31

---

## Executive Summary

MindrianOS 1.6.0 transforms the plugin from a reactive teaching partner into a proactive, cost-optimized, parallel-processing venture intelligence engine. The upgrade is grounded in three research pillars: the ICM paper (Van Clief & McDermott 2026, arxiv 2603.16021), the Claude Code capability audit (ccleaks.com, 1,884 TypeScript files, 512K LOC), and Markov chain spectral theory (Seabrook & Wiskott 2022, arxiv 2207.02296).

Core deliverables:
- 6 new Claude Code hooks wiring the intelligence nervous system
- Per-agent model routing with venture-stage adaptive hints
- Parallel agent swarm execution across room sections
- Spectral OM-HMM upgrade to the HSI innovation discovery engine
- Scheduled sentinel intelligence (cron triggers)
- KAIROS/Daemon/Coordinator Mode preparation for day-one compatibility
- Formal Mindrian Workspace Protocol (MWP) specification

---

## Part 1: The Moat - Mindrian Workspace Protocol (MWP)

### 1.1 Theoretical Foundation

MWP is the formal name for MindrianOS's folder-as-architecture system. It synthesizes:

- Simon (1962) Architecture of Complexity: folder hierarchy = near-decomposable subsystems
- Rittel & Webber (1973) Wicked Problems: 10 characteristics managed via cross-section edge detection
- Van Clief & McDermott (2026) ICM: folder structure replaces multi-agent framework orchestration
- Minto (1987) Pyramid Principle: per-section REASONING.md with MECE verification
- Hughes (1983) Reverse Salients: HSI-computed innovation differential finds lagging components
- Seabrook & Wiskott (2022) Spectral Markov Theory: thinking-mode transition analysis for integrative quality
- Ashby (1956) Requisite Variety: 26 methodologies match wicked problem complexity
- Christensen/Ulwick JTBD: core job is time compression between insight and validated decision
- Aronhime (30 years): teaching graph calibrated from 100+ real projects

### 1.2 The Seven MWP Layers

Layer 1 - Folder Hierarchy: 8 DD-aligned sections as near-decomposable subsystems. Each maps to a due diligence domain: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model. Plus extended sections: team/, meetings/, personas/, opportunity-bank/, funding/.

Layer 2 - Artifact Provenance: YAML frontmatter on every artifact with methodology, date, depth, problem_type, venture_stage, room_section, pipeline, pipeline_stage, source. Enables resumption, audit, cascade detection, and command reprising.

Layer 3 - The Cascade Pipeline: 8 automated steps on every filing. Classify (haiku). Stamp artifact ID. Weave into KuzuDB (9 edge types). Refresh STATE.md. Map graph visualization. Discover connections (HSI + reverse salients). Version via git. Publish to presentation views.

Layer 4 - MINTO Reasoning Per Section: .reasoning/{section}/REASONING.md with governing thought, 3 MECE arguments, evidence. Frontmatter declares requires, provides, affects, confidence (high/medium/low), verification (must_be_true with status). Creates REASONING_INFORMS edges in KuzuDB forming a reasoning dependency graph.

Layer 5 - HSI Innovation Discovery: 3-tier hybrid similarity pipeline. Tier 0 keyword-only. Tier 1 TF-IDF/SVD + MiniLM embeddings + spectral OM-HMM (v1.6.0). Tier 2 adds Pinecone. Innovation differential = 0.6 * semantic_surprise + 0.4 * integrative_factor. Breakthrough potential = 0.7 * differential + 0.3 * min(lsa, semantic). Results feed KuzuDB as HSI_CONNECTION and REVERSE_SALIENT edges.

Layer 6 - Proactive Intelligence Loop: Every change triggers scan for INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, REASONING_INFORMS. Persisted in .proactive-intelligence.json with repeat suppression (threshold 3). User APPROVE/REJECT/DEFER decisions become graph data. Loop learns from every decision.

Layer 7 - Brain Enrichment: Remote Neo4j with 21K+ nodes, 65K+ relationships. 8 named query patterns: framework_chain, cross_domain, find_patterns, concept_connect, contradiction_check, gap_assess, search_semantic. Never required. Always amplifying.

### 1.3 The 9 KuzuDB Edge Types

1. INFORMS: wikilink [[reference]] between artifacts
2. CONTRADICTS: conflict detected via contradiction terms near wikilinks
3. CONVERGES: theme in 3+ artifacts across sections
4. ENABLES: explicit frontmatter declaration
5. INVALIDATES: explicit frontmatter declaration
6. BELONGS_TO: artifact membership in section
7. REASONING_INFORMS: section-to-section reasoning dependency from REASONING.md
8. HSI_CONNECTION: hidden innovation connection (hsi_score, lsa_sim, semantic_sim, surprise_type, breakthrough_potential, spectral_gap_avg, dominant_modes)
9. REVERSE_SALIENT: cross-section innovation opportunity (differential_score, innovation_type, innovation_thesis, spectral metadata)

---

## Part 2: Spectral OM-HMM Upgrade (IMPLEMENTED)

### 2.1 The Markov Chain Connection

The HSI pipeline's OM-HMM scorer was a keyword-density proxy (V4 legacy). Version 1.6.0 replaces it with genuine Markov chain spectral analysis based on Seabrook & Wiskott (2022).

### 2.2 How It Works

Step 1: Each sentence in an artifact is classified into a thinking mode (analytical, integrative, descriptive, evaluative, creative) using regex pattern matching.

Step 2: The sequence of thinking modes forms a Markov chain. A transition matrix is built with Laplace smoothing (alpha=0.1) to avoid zero rows.

Step 3: Eigenvalue decomposition of the transition matrix yields the spectral gap (1 - |lambda_2|). Larger gap = faster mixing = more diverse thinking mode transitions.

Step 4: The stationary distribution (left eigenvector for eigenvalue 1) reveals the long-run proportion of time in each mode.

Step 5: Four-component scoring replaces the legacy 3-component formula:
- Spectral gap (40%): Fast mixing across thinking modes
- Integrative weight (25%): Stationary distribution weight on integrative mode
- Mode diversity (20%): Shannon entropy of stationary distribution (Ashby's variety)
- Anti-absorption (15%): Penalty for getting stuck in single modes

Step 6: Short texts (< 5 sentences) fall back to legacy keyword scoring - insufficient data for meaningful transition matrices.

### 2.3 Spectral Metadata in Output

Each artifact in .hsi-results.json now includes a spectral profile:
- omhmm_score: composite score (0-100)
- spectral_gap: Markov chain mixing rate (0-1)
- dominant_mode: mode with highest stationary probability
- mode_entropy: normalized Shannon entropy (0-1)
- absorbing_score: tendency to get stuck (0-1)
- mode_distribution: full stationary distribution per mode
- method: "markov" or "legacy"

Each HSI pair includes:
- spectral_gap_avg: average of both artifacts' spectral gaps
- left_dominant_mode, right_dominant_mode

Room-level spectral summary in metadata:
- mean_omhmm, mean_spectral_gap
- dominant_mode_distribution across all artifacts
- spectral vs legacy artifact counts

### 2.4 Spectral Bonus in Reverse Salient Scoring

detect-reverse-salients.py v1.6.0 uses updated breakthrough formula:
- breakthrough = 0.60 * novelty + 0.25 * feasibility + 0.15 * spectral_gap_avg
- Pairs where both artifacts exhibit fast Markov mixing get up to 15% bonus
- Rewards genuine integrative thinking over keyword-stuffed artifacts

### 2.5 Files Changed

- scripts/compute-hsi.py: New functions (classify_sentence_mode, build_transition_matrix, compute_spectral_gap, compute_stationary_distribution, detect_absorbing_tendency, compute_artifact_spectral_profile). Legacy _compute_omhmm_legacy preserved as fallback. Output format extended with spectral metadata.
- scripts/detect-reverse-salients.py: score_breakthrough_potential updated with spectral bonus. Output includes spectral_gap_avg and dominant modes per reverse salient.

---

## Part 3: Hook Expansion (6 New Hooks)

### 3.1 PreCompact
Trigger: Before Claude autocompact at ~187K tokens.
Script: scripts/pre-compact
Action: Save room STATE.md, current methodology progress, last 5 filed artifacts, active MINTO confidence levels to /tmp/mindrian-session/pre-compact-context.md.
Impact: Larry never loses venture context during long sessions.

### 3.2 PostCompact
Trigger: After Claude autocompact completes.
Script: scripts/post-compact
Action: Restore saved context as additionalContext. Include venture stage, active section, MINTO governing thoughts, pending verification criteria.
Impact: Seamless continuity through memory compression.

### 3.3 FileChanged
Trigger: External file modification inside active room.
Script: scripts/on-file-changed
Action: Re-run cascade (classify, KuzuDB index, build-graph, compute-state). Check REASONING.md staleness for affected section.
Impact: External edits (VS Code, Obsidian, team git) auto-sync the graph.

### 3.4 CwdChanged
Trigger: User changes working directory.
Script: scripts/on-cwd-changed
Action: Check if new directory contains room/ or is registered. Auto-switch active room. Re-run session-start context.
Impact: Multi-room users just cd between ventures.

### 3.5 SubagentStop
Trigger: Agent completion.
Script: scripts/on-agent-complete
Action: Route framework-runner/grading/research/opportunity-scanner/persona-analyst output through post-write cascade. Surface brain-query/investor output without filing.
Impact: 8 agents feed directly into room cascade automatically.

### 3.6 TaskCompleted
Trigger: Pipeline stage completion.
Script: scripts/on-task-complete
Action: Update pipeline progress in STATE.md. Check next stage input readiness. Check REASONING.md staleness for affected sections. Surface "Stage N complete, ready for Stage N+1."
Impact: Semi-automatic pipeline progression.

---

## Part 4: Model Routing

### 4.1 Profile Table

| Agent | Quality | Balanced | Budget |
|-------|---------|----------|--------|
| larry-extended | opus | opus | sonnet |
| framework-runner | opus | opus | sonnet |
| grading | opus | opus | sonnet |
| investor | opus | sonnet | sonnet |
| brain-query | opus | sonnet | haiku |
| research | opus | sonnet | haiku |
| opportunity-scanner | sonnet | sonnet | haiku |
| persona-analyst | sonnet | sonnet | haiku |

### 4.2 Venture-Stage Adaptive Hints

| Stage | framework-runner | research | grading | investor |
|-------|-----------------|----------|---------|----------|
| Pre-Opportunity | sonnet | haiku | skip | skip |
| Discovery | opus | sonnet | sonnet | skip |
| Validation | opus | sonnet | opus | sonnet |
| Design | opus | sonnet | opus | sonnet |
| Investment | opus | opus | opus | opus |

### 4.3 Resolution Order (5 steps)

1. Per-agent override from room/.config.json
2. Venture-stage hint from STATE.md
3. Inherit (if profile = inherit, use parent session model)
4. Profile lookup from MODEL_PROFILES table
5. Default to sonnet

### 4.4 Cascade Step Routing

| Step | Model | Rationale |
|------|-------|-----------|
| Classify | haiku | Pattern matching |
| Detect edges | sonnet | Relationship reasoning |
| Proactive analysis | sonnet | Contradiction detection |
| HSI-to-KuzuDB | haiku | Data insertion |
| Compute STATE.md | none | Script aggregation |

### 4.5 Cost Impact

| Profile | Swarm Cost | Savings |
|---------|-----------|---------|
| All Opus (current) | ~$2.50 | 0% |
| Quality | ~$2.00 | 20% |
| Balanced | ~$0.85 | 66% |
| Budget | ~$0.35 | 86% |

### 4.6 User Command

/mos:models - show current profile and assignments
/mos:models set balanced - switch profile
/mos:models override grading opus - force specific agent
Config stored in room/.config.json (per-room).

---

## Part 5: Parallel Agent Patterns

### 5.1 /mos:act --swarm

Read STATE.md. Identify 3 highest-gap sections. Map to frameworks via problem-types.md. Resolve models per agent. Spawn 3 framework-runners in parallel via run_in_background. SubagentStop auto-files each output. HSI recomputation after all complete finds cross-agent innovation connections. Main Larry synthesizes.

### 5.2 /mos:persona --parallel

6 persona-analyst agents (one per De Bono hat) in parallel. All sonnet/haiku. Each writes to room/personas/. SubagentStop indexes to KuzuDB. Main Larry synthesizes.

### 5.3 /mos:grade --full

8 grading agents (one per section) in parallel. All opus (balanced+). Each checks REASONING.md verification criteria. Writes to room/.grades/. Main Larry synthesizes with percentile positioning.

### 5.4 /mos:research --broad

3 research agents: academic, market data, competitor intelligence. Parallel execution. Main Larry synthesizes and files.

### 5.5 Emergent Cross-Agent Intelligence

When 3 agents file simultaneously: each triggers cascade, cascades detect cross-artifact edges, HSI finds cross-agent innovation connections. Parallel execution + automatic cascade + graph intelligence = emergent discoveries no serial system produces.

---

## Part 6: Sentinel Mode (Scheduled Intelligence)

### 6.1 Cron Triggers

| Schedule | Task | Model |
|----------|------|-------|
| Monday 9am | Weekly room health check | haiku |
| Daily 8am | Grant deadline monitor | haiku |
| Friday | Competitor watch | sonnet |
| Sunday midnight | HSI recomputation | local compute |
| Sunday midnight | State snapshot | none |

### 6.2 Fallback

If CronCreate tool is gated: /mos:scout runs all 5 tasks manually. Pattern ready for when Cron ships.

---

## Part 7: Future-Proofing (ccleaks.com Preparation)

### 7.1 KAIROS Prep (Persistent Assistant - tengu_kairos gate)

Room format: room/.context/ directory with last-session.md, rejection-log.md, methodology-history.md, weekly-digest.md. These work today as manual files. When KAIROS activates, dream cycles consume them as input. Dream output targets weekly-digest.md.

STATE.md session log: one line per session (date, commands, artifacts, signals). Becomes dream input when tengu_onyx_plover activates.

### 7.2 Auto-Dream Prep (tengu_onyx_plover gate)

Weekly digest format designed for <25KB output limit. Cross-session pattern detection. Reverse salient tracking across weeks.

### 7.3 Coordinator Mode Prep (CLAUDE_CODE_COORDINATOR_MODE env var)

Pre-built .claude/teams/mindrian.json:
- Lead: larry-extended
- Members: framework-runner, grading, research, brain-query, investor, opportunity-scanner, persona-analyst
- Per-member model config matching MODEL_PROFILES table
- Agent addressing: agentName@mindrian

### 7.4 UDS Inbox Prep (UDS_INBOX build flag)

IPC message protocol for room-to-room intelligence:
- Format: source_room, target_room, signal_type (contradiction, convergence, connection), payload
- Use case: two venture rooms share customer segments or competitors
- When UDS ships: multi-room cross-venture intelligence automatic

### 7.5 Daemon Mode Prep (DAEMON build flag)

Daemon-compatible command wrappers:
- /mos:scout --daemon: persistent background research loop
- /mos:watch --daemon: monitor external sources continuously

### 7.6 Bridge Mode Prep (BRIDGE_MODE build flag)

Bridge API endpoint design for room operations:
- Web dashboard sends commands to running Larry session
- Mobile access to venture intelligence
- Slack/Discord integration triggers analysis

### 7.7 UltraPlan Prep (tengu_ultraplan_model gate)

/mos:deep-plan command wrapper:
- Injects room context into UltraPlan 30-minute session
- Go-to-market strategy, investment thesis generation, scenario planning at scale

### 7.8 Buddy Prep (BUDDY build flag, teaser Apr 1-7 2026)

Larry Buddy skin concept:
- De Stijl Mondrian-inspired visual pet
- Stats mapped to room metrics: Debugging=problem reframing depth, Wisdom=frameworks mastered, Chaos=contradictions found
- Visual venture health via pet mood/appearance

### 7.9 Scratchpad Prep (tengu_scratch gate)

Draft filing via session-scoped temp workspace:
- Methodology runs generate drafts in scratchpad
- Only file on user approval
- Quality gate between insight and room filing

### 7.10 Workflow Scripts Prep (WORKFLOW_SCRIPTS build flag)

Automated venture workflows:
- "When meeting filed, auto-run grading on affected sections"
- "When opportunity discovered, check against reverse salients"

### 7.11 Additional Hooks Available (16 more beyond the 6 wired)

| Hook | Potential Use | Priority |
|------|--------------|----------|
| PreToolUse | Intercept before tool execution | Low |
| PostToolUseFailure | Detect and log cascade failures | Medium |
| SessionEnd | Extended cleanup, push state to remote | Medium |
| TeammateIdle | Multi-agent coordination signal | Future (Coordinator) |
| ConfigChange | Detect Brain API key changes, auto-reconnect | Medium |
| PermissionRequest | Log permission patterns for user profiling | Low |
| PermissionDenied | Track denied operations for UX improvement | Low |
| UserPromptSubmit | Pre-process user input for room context | Medium |
| SetupHook | First-install onboarding flow | Low |

### 7.12 Hidden Commands Worth Investigating

| Command | MindrianOS Use |
|---------|---------------|
| /ctx-viz | Visualize room context usage in session |
| /btw | Side question without derailing methodology session |
| /subscribe-pr | Watch competitor GitHub repos |
| /dream | Manual trigger for memory consolidation |
| /force-snip | Force context snip to free space for deep sessions |

### 7.13 Environment Variables Worth Testing

| Variable | Use |
|----------|-----|
| AUTOCOMPACT_PCT_OVERRIDE | Tune when PreCompact fires |
| CLAUDE_CODE_MAX_CONTEXT_TOKENS | Override context window for deep sessions |
| MAX_THINKING_TOKENS | Override thinking budget for grading/methodology |

---

## Part 8: Opportunity Bank Integration

### 8.1 Room Connections

Each opportunity links to room sections via INFORMS, ENABLES, or CONVERGES relationships with reasoning. This makes the Opportunity Bank a graph-connected intelligence layer.

### 8.2 HSI Integration (1.6.0)

When opportunity filed, HSI checks against reverse salients. "This grant funds the capability gap between financial-model and solution-design that your reverse salient analysis identified."

### 8.3 Brain Enrichment

Brain suggests funding programs matched to user's active frameworks. "You're using Lean Startup + Blue Ocean. Brain suggests NSF SBIR Phase 1."

### 8.4 Cron Monitoring

Daily deadline alerts. Weekly opportunity scan with context-driven queries.

---

## Part 9: Cross-Domain Breakthrough Detection

### 9.1 Two Primary Opportunity Types

Structural Transfer (LSA > semantic): Same methods, different applications. Methods from one section can transfer to solve problems in another. Hughes' reverse salient - the method exists but hasn't been absorbed.

Semantic Implementation (semantic > LSA): Same concepts, different tools. Both sections think about the same problem but with different approaches. Integration creates new knowledge (Nonaka's SECI model).

### 9.2 Spectral Enhancement (1.6.0)

Pairs where both artifacts have high spectral gaps (fast Markov mixing) receive 15% breakthrough bonus. Genuinely integrative thinking produces better cross-domain connections than keyword-stuffed artifacts.

### 9.3 Future: Random Walk Innovation Pathways

Post-1.6.0 research: weight HSI_CONNECTION edges by breakthrough_potential, run PageRank variant on room graph, spectral clustering for innovation community detection.

---

## Part 10: Delivery Timeline

### Week 1 - Foundation

Day 1: lib/core/model-profiles.cjs + commands/models.md
Day 2: Wire model resolution into act, grade, research, persona, deep-grade commands
Day 3: scripts/pre-compact + scripts/post-compact + hooks.json entries
Day 4: scripts/on-file-changed + scripts/on-cwd-changed + hooks.json entries
Day 5: scripts/on-agent-complete + scripts/on-task-complete + hooks.json entries

### Week 2 - Parallel Intelligence

Day 6: --swarm flag on commands/act.md with parallel dispatch
Day 7: --parallel flag on commands/persona.md
Day 8: --full flag on commands/grade.md with REASONING.md verification
Day 9: --broad flag on commands/research.md
Day 10: Integration testing (swarm + SubagentStop + cascade + HSI)

### Week 3 - Sentinel + Persistence + Future-Proofing

Day 11: Test CronCreate, build /mos:schedule or /mos:scout fallback
Day 12: Weekly health check, grant monitor, competitor watch prompts
Day 13: room/.context/ directory, enhanced Stop hook, session logs
Day 14: .claude/teams/mindrian.json, IPC protocol doc, daemon wrappers
Day 15: End-to-end testing, CHANGELOG entry, version bump

---

## Part 11: Files Created or Modified

### New Files (19)

- lib/core/model-profiles.cjs
- commands/models.md
- commands/scout.md
- scripts/pre-compact
- scripts/post-compact
- scripts/on-file-changed
- scripts/on-cwd-changed
- scripts/on-agent-complete
- scripts/on-task-complete
- room/.context/last-session.md (template)
- room/.context/rejection-log.md (template)
- room/.context/methodology-history.md (template)
- room/.context/weekly-digest.md (template)
- room/.config.json (template)
- room/.snapshots/ (directory)
- room/.intelligence/ (directory)
- room/.grades/ (directory)
- .claude/teams/mindrian.json
- docs/MWP-SPECIFICATION.md

### Modified Files (15)

- hooks/hooks.json (6 new entries)
- commands/act.md (--swarm flag)
- commands/persona.md (--parallel flag)
- commands/grade.md (--full flag)
- commands/research.md (--broad flag)
- commands/deep-grade.md (model resolution)
- commands/new-project.md (.context/, .config.json creation)
- scripts/on-stop (enhanced session log)
- scripts/session-start (read .context/weekly-digest.md, reverse salients)
- scripts/post-write (model-routed cascade, HSI trigger)
- scripts/compute-state (REASONING.md staleness, HSI summary)
- scripts/compute-hsi.py (DONE - spectral OM-HMM upgrade)
- scripts/detect-reverse-salients.py (DONE - spectral bonus)
- lib/core/proactive-intelligence.cjs (cross-cascade detection)
- CHANGELOG.md (v1.6.0 entry)

### Unchanged (262 files)

Zero breaking changes. Purely additive. Backward compatible.

---

## Part 12: Success Metrics

### Quantitative

- Time to validate across 3 sections: 45min (serial) to 5min (swarm). 9x.
- Cost per swarm session: $2.50 to $0.85 (balanced). 66% reduction.
- Context loss events per 4-hour session: 2-3 to 0 (PreCompact/PostCompact).
- External edit sync: infinite (manual) to seconds (FileChanged).
- Agent filing: manual to automatic (SubagentStop).
- Proactive signals per week: 0 to 3-5 (cron).
- HSI accuracy: keyword-density to spectral Markov analysis.

### Qualitative

- P1 (Casual Explorer): Faster first value. Budget mode = cheap exploration.
- P2 (Pushback User): Persistent rejection memory. Stage-adaptive pacing.
- P3 (Strategic Builder): Background scouting. Parallel swarm. Cross-cascade discoveries.

---

## Part 13: The Compounding Moat

Every week of 1.6.0 operation deepens the moat:

- Every user decision (APPROVE/REJECT/DEFER) becomes graph data
- Every HSI computation refines innovation connections
- Every Brain query enriches local KuzuDB
- Every spectral profile builds the room's thinking-mode map
- Every cron run accumulates temporal intelligence
- Every session log feeds future KAIROS dream cycles

A competitor starting today faces:
- 7 MWP layers that must work together
- 9 KuzuDB edge types operating continuously
- Spectral Markov innovation discovery (research contribution)
- Opportunity Bank with graph-connected room_connections
- Proactive intelligence loop that learns from decisions
- Brain with 21K nodes and 65K relationships (never distributed)
- Teaching calibration from 100+ real projects (30 years)
- 10+ Claude Code features pre-wired for day-one activation

Prompts can be copied. The integrated system that makes them compound cannot.

---

## Research References

1. Simon, H. A. (1962). "The Architecture of Complexity." Proceedings of the APS.
2. Rittel, H. & Webber, M. (1973). "Dilemmas in a General Theory of Planning." Policy Sciences.
3. Van Clief, J. & McDermott, D. (2026). "Interpretable Context Methodology." arxiv 2603.16021.
4. Seabrook, E. & Wiskott, L. (2022). "Tutorial on Spectral Theory of Markov Chains." arxiv 2207.02296.
5. Hughes, T. P. (1983). "Networks of Power." Johns Hopkins University Press.
6. Minto, B. (1987). "The Pyramid Principle." Pearson.
7. Christensen, C. & Ulwick, A. (2003). "Jobs-to-Be-Done Framework."
8. Ashby, W. R. (1956). "An Introduction to Cybernetics." Chapman & Hall.
9. Knight, F. H. (1921). "Risk, Uncertainty and Profit." Houghton Mifflin.
10. Tetlock, P. (2015). "Superforecasting." Crown.
11. De Bono, E. (1985). "Six Thinking Hats." Little, Brown.
12. Nonaka, I. (1995). "The Knowledge-Creating Company." Oxford University Press.
13. Forrester, J. W. (1961). "Industrial Dynamics." MIT Press.
14. Meadows, D. (1999). "Leverage Points." Sustainability Institute.
