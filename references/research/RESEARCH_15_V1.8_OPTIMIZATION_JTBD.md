# RESEARCH_15: v1.8.0 Co-Work Adaptation - JTBD Optimization Against Claude Code Source Architecture

**Date:** 2026-04-05
**Version Target:** v1.8.0 (Co-Work Adaptation + Enhanced CLI Capabilities)
**Sources:** ccleaks.com, Anthropic docs, Zscaler/TrendMicro, community benchmarks, MindrianOS v1.7.1 codebase audit
**Depends on:** RESEARCH_14 (Claude Code Source Architecture)

---

## 1. User Archetypes & Core Jobs

MindrianOS serves three distinct user types. Each has different JTBD that map to different Claude Code optimization opportunities.

### 1.1 The Venturist (Innovation Founder / Intrepreneur)

**Core Job:** "Help me discover a defensible problem worth solving and build the evidence to prove it."

| Job Step | Current Pain | CC Optimization |
|----------|-------------|-----------------|
| Explore problem space | Cold-start every session, loses thread | KAIROS daily logs persist exploration state |
| Run methodologies | Sequential agent dispatch, slow | Coordinator parallel workers for /mos:act --swarm |
| File meeting insights | Manual paste, one transcript at a time | UDS inbox: Velma transcription pushes to room automatically |
| Build investor thesis | Grade + thesis run sequentially | Agent Teams: grade + thesis + competitive scan in parallel |
| Track funding pipeline | Context lost between grant cycles | Auto-Dream consolidates funding timeline across sessions |
| Present to stakeholders | Export rebuilds from scratch | Cached room analysis, incremental graph updates |

**Optimization Priority:** Context persistence (KAIROS), parallel methodology (Coordinator), meeting automation (UDS)

### 1.2 The Researcher (Lab Scientist / Academic)

**Core Job:** "Help me structure my thinking, connect findings across domains, and surface what I'm missing."

| Job Step | Current Pain | CC Optimization |
|----------|-------------|-----------------|
| Literature synthesis | Brain queries re-execute every session | Framework recommendation cache (10-min TTL) |
| Cross-domain discovery | /mos:find-connections runs single-threaded | Swarm: 3 domain scanners in parallel via Coordinator |
| Hypothesis tracking | Manual, no persistence | KAIROS logs + Auto-Dream = automatic hypothesis journal |
| Collaboration prep | Room context doesn't transfer | UDS: share room state between Claude instances |
| Evidence grading | Full room analysis on every session start | Tiered context loading (minimal/balanced/rich) |
| Publication export | Rebuilds Minto/MECE each time | Cached REASONING.md with STATE.md hash invalidation |

**Optimization Priority:** Caching (Brain, REASONING, analyze-room), tiered loading, cross-session persistence

### 1.3 The Student (PWS Learner / Academy User)

**Core Job:** "Guide me through structured innovation thinking without overwhelming me."

| Job Step | Current Pain | CC Optimization |
|----------|-------------|-----------------|
| Onboarding | Full context dump regardless of level | Context-budget-aware greeting (3 tiers) |
| Step-by-step guidance | Same depth for novice and expert | Model routing: Haiku for simple tasks, Opus for synthesis |
| Practice exercises | No persistence between practice sessions | KAIROS: "where you left off" across sessions |
| Progress tracking | Manual, no automatic assessment | TaskCompleted hook + Auto-Dream = learning journal |
| Ask questions | Full MCP overhead even for simple Q&A | MCP session profiles: "learn" profile = minimal tools |
| Portfolio building | Export rebuilds everything | Incremental graph: only new artifacts trigger recompute |

**Optimization Priority:** Tiered context loading, MCP profiles, KAIROS progress persistence

---

## 2. Cross-Archetype Optimization Map

### 2.1 Context Management (All Users)

**Current State:** session-start loads FULL context every time (USER.md + STATE.md + proactive signals + update check). No adaptation to user type, context budget, or session intent.

**v1.8.0 Target:** Tiered context loading based on context budget + user archetype.

| Tier | When | Loads | Token Cost | Best For |
|------|------|-------|-----------|----------|
| **Minimal** | >70% context used, or student simple Q&A | Room name + venture stage + last artifact | ~500 tokens | Students, quick checks |
| **Balanced** | 30-70% context, normal session | + STATE.md + last 3 artifacts + top 2 proactive signals | ~2,000 tokens | Researchers, daily work |
| **Rich** | <30% context, deep session, or venturist pipeline | + full proactive analysis + USER.md + REASONING confidence | ~5,000 tokens | Venturists, /mos:act chains |

**Implementation:**
```bash
# In session-start, after reading bridge file:
context_pct=$(cat /tmp/mindrian-context-state | jq '.usage_pct // 0')
if [ "$context_pct" -gt 70 ]; then
  CONTEXT_TIER="minimal"
elif [ "$context_pct" -gt 30 ]; then
  CONTEXT_TIER="balanced"
else
  CONTEXT_TIER="rich"
fi
```

**KAIROS Preparation:** When `tengu_kairos` goes live, daily logs replace the session-start cold-start entirely. Context tier becomes: read KAIROS log (persistent) + delta since last session (minimal).

### 2.2 Autocompact Tuning (All Users)

**Finding:** `AUTOCOMPACT_PCT_OVERRIDE` controls when compaction triggers. Capped at ~83% max. Default varies by model.

**Recommendation by user type:**

| User Type | Value | Rationale |
|-----------|-------|-----------|
| Venturist (pipeline/chain) | 75 | Long sessions, needs headroom for multi-step chains |
| Researcher (deep analysis) | 78 | Wants maximum context for cross-domain synthesis |
| Student (guided exercises) | 65 | Short sessions, compact early to stay fast |
| Default (unknown) | 72 | Safe middle ground for agentic workloads |

**Implementation:** Add to settings.json or per-room config:
```json
{
  "autocompact_pct": 72,
  "autocompact_profiles": {
    "venturist": 75,
    "researcher": 78,
    "student": 65
  }
}
```

### 2.3 MCP Session Profiles (All Users)

**Problem:** Current MCP load (Neo4j, Pinecone, Notion, Playwright, Render, Git, Tavily, Canva, Supabase, etc.) costs ~55K+ tokens per turn. That's 28% of a 200K window before the user types anything.

**Solution:** Session-specific MCP profiles that load only what's needed.

| Profile | MCP Servers | Token Cost | User Type |
|---------|------------|-----------|-----------|
| **learn** | None (CLI only) | ~0 | Students doing exercises |
| **think** | Neo4j Brain + Pinecone | ~3K | Researchers, methodology sessions |
| **build** | Git + Render + Supabase | ~5K | Venturists building product |
| **research** | Tavily + Pinecone + Neo4j | ~6K | Deep research sessions |
| **present** | Canva + Notion | ~4K | Export/presentation sessions |
| **full** | All servers | ~55K | Power users who need everything |

**Implementation:** Profile selector in session-start hook based on:
1. Explicit: user sets profile in room config or USER.md
2. Inferred: venture stage + last command pattern
3. Default: "think" (most common MindrianOS workflow)

### 2.4 Hook Optimization (All Users)

**Current Issues Found:**

| Issue | Impact | Fix |
|-------|--------|-----|
| post-write spawns HSI compute on EVERY write | Unnecessary CPU for minor edits | Debounce: skip if same file written within 30s |
| on-agent-complete scans 30s window | May miss slow agents or catch unrelated files | Use agent output path from SubagentStop event data |
| analyze-room recomputes from scratch every session | Wastes 1-2s on startup for unchanged rooms | Cache with STATE.md hash key (5-min TTL) |
| No hook execution batching | Swarm writes 3 artifacts = 3 separate HSI computes | Batch: queue writes, single HSI compute for batch |
| Bridge file at /tmp/ hardcoded | No multi-user support, no per-room isolation | Move to ~/.mindrian/bridge/{room-hash}.json |
| Pre-compact preserve window 10 min | Too long, wastes restore budget on stale state | Dynamic: 3 min for students, 10 min for venturists |

**New Hooks to Register (v1.8.0):**

| Hook | Purpose | User Benefit |
|------|---------|-------------|
| `UserPromptSubmit` | Detect session intent from first message | Auto-select context tier + MCP profile |
| `PreToolUse` | Context budget check before expensive tools | Prevent swarm dispatch when context nearly full |
| `Notification` | Desktop alerts for background agent completion | Venturist: "Your thesis analysis is ready" |
| `ConfigChange` | Hot-reload room config without restart | All: change MCP profile mid-session |
| `SessionEnd` | Write learning progress for students | Student: "You completed 3 exercises today" |

### 2.5 Agent Dispatch Optimization (Venturist + Researcher)

**Current /mos:act Issues:**

| Issue | Impact | Fix |
|-------|--------|-----|
| Swarm always dispatches 3 agents | Wastes budget when 1-2 sections weak | Dynamic: dispatch N agents = min(weak_sections, context_budget / agent_cost) |
| Chain always runs 3-5 steps | No early exit if user satisfied | Checkpoint between steps: "Continue to step 3?" |
| No cost estimation before dispatch | User surprised by token burn | Show estimated cost: "This will use ~150K tokens (3 agents x Opus)" |
| Framework selection re-queries Brain every time | Same room state = same recommendation | Cache: (room_path, STATE.md_hash) -> frameworks, 10-min TTL |
| Model routing ignores total operation budget | 3 Opus agents when 2 Sonnet would fit | Budget-aware: if total_cost > remaining_context * 0.6, downgrade models |

**Coordinator Mode Preparation:**

When `CLAUDE_CODE_COORDINATOR_MODE=1` goes live:
- /mos:act --swarm maps directly to Coordinator parallel dispatch
- Each framework-runner becomes a Coordinator worker
- Workers get isolated scratch dirs (`tengu_scratch`)
- HSI recomputation becomes the "synthesis" step after all workers complete
- Agent Teams for cross-room operations (/mos:pipeline across ventures)

**Agent Teams Mapping:**

| Current MindrianOS Agent | As Coordinator Worker | As Teammate |
|--------------------------|----------------------|-------------|
| framework-runner | Parallel methodology worker | Cross-room methodology |
| brain-query | Fast pre-flight query | Shared intelligence layer |
| grading | Assessment worker | Multi-venture comparison |
| research | Web research worker | Background evidence gathering |
| persona-analyst | Perspective generator | Multi-hat parallel analysis |
| investor | Adversarial reviewer | Independent challenge |
| opportunity-scanner | Grant scanner | Background monitoring |

---

## 3. JTBD-Specific Feature Enhancements

### 3.1 Venturist: "I need to pick up where I left off"

**Current:** on-stop writes session summary to room/.context/last-session.md. Next session-start reads STATE.md but loses conversational thread.

**v1.8.0:** 
- Pre-KAIROS: Enhanced last-session.md with structured fields (active_methodology, open_questions, next_suggested_action, confidence_level)
- Post-KAIROS: Read KAIROS daily log, inject as "Here's where you were" context
- Auto-Dream consolidation feeds Brain graph (cross-session pattern detection)

**Implementation:**
```bash
# In on-stop hook, write structured session summary:
cat > room/.context/last-session.md << EOF
# Last Session: $(date -u +%Y-%m-%dT%H:%M:%SZ)
## Active Methodology: ${LAST_FRAMEWORK}
## Open Questions:
${OPEN_QUESTIONS}
## Suggested Next Action: ${NEXT_ACTION}
## Confidence: ${CONFIDENCE}
## Artifacts Created: ${ARTIFACT_COUNT}
EOF
```

### 3.2 Researcher: "Don't make me re-explain my domain"

**Current:** USER.md captures preferences. Brain stores domain knowledge. But every session re-introduces Larry as if meeting for the first time.

**v1.8.0:**
- Session-start detects returning user (USER.md exists + session count > 3)
- Loads domain-specific greeting: "I see you're continuing your work on [domain]. Last time we identified [open question]."
- Tiered depth: new user = full intro, returning = domain context, expert = straight to work
- KAIROS prep: when live, daily log replaces this entirely

### 3.3 Student: "Tell me what to do next"

**Current:** /mos:suggest-next exists but requires explicit invocation. No automatic progress tracking.

**v1.8.0:**
- TaskCompleted hook tracks completed exercises per session
- SessionEnd writes progress to room/.context/learning-progress.md
- Next session-start: "Welcome back. You've completed 7 of 22 workbook tasks. Ready for Task 8: [name]?"
- MCP profile auto-selects "learn" (zero MCP overhead for exercises)
- KAIROS prep: learning journal becomes daily log, Auto-Dream summarizes learning patterns

### 3.4 All Users: "Don't waste my context on things I don't need"

**Current:** Full MCP load + full room analysis + full proactive signals every session.

**v1.8.0 Context Budget:**

| Component | Current Cost | v1.8.0 Target | Savings |
|-----------|-------------|---------------|---------|
| MCP tool definitions | ~55K tokens | ~3-6K (profiles) | 90% |
| Session-start context | ~5K tokens | ~500-5K (tiered) | 50-90% |
| Proactive signals | ~1K tokens | ~300-1K (confidence threshold) | 30-70% |
| Framework references | ~2K per invocation | ~2K (cached) | 0% first, 100% repeat |
| **Total per-turn overhead** | **~63K tokens** | **~6-14K tokens** | **78-90%** |

On a 200K window, this frees 49-57K tokens for actual conversation. On 1M window, the savings compound across longer sessions.

---

## 4. Implementation Roadmap for v1.8.0

### Phase 1: Context Optimization (No Architecture Change)

| Task | Effort | Impact | User |
|------|--------|--------|------|
| Tiered context loading in session-start | 2h | HIGH | All |
| Analyze-room caching (STATE.md hash key) | 1h | MEDIUM | All |
| Post-write debounce (30s same-file skip) | 1h | MEDIUM | All |
| Bridge file per-room isolation | 2h | LOW | Multi-room users |
| Framework recommendation cache | 2h | MEDIUM | Venturist, Researcher |

### Phase 2: MCP Profile System

| Task | Effort | Impact | User |
|------|--------|--------|------|
| Define 6 MCP profiles in settings.json | 1h | HIGH | All |
| Profile auto-detection from venture stage | 2h | MEDIUM | All |
| UserPromptSubmit hook for intent detection | 3h | HIGH | All |
| /mcp profile switching mid-session | 2h | MEDIUM | Power users |

### Phase 3: Agent Dispatch Enhancement

| Task | Effort | Impact | User |
|------|--------|--------|------|
| Dynamic swarm sizing (budget-aware) | 3h | HIGH | Venturist |
| Chain checkpointing (pause/resume) | 2h | MEDIUM | Venturist, Researcher |
| Cost estimation before dispatch | 2h | MEDIUM | All |
| Model downgrade when budget constrained | 2h | HIGH | All |

### Phase 4: KAIROS/Coordinator Preparation

| Task | Effort | Impact | User |
|------|--------|--------|------|
| Enhanced last-session.md (structured) | 1h | MEDIUM | All |
| KAIROS log detection in context-engine | 2h | HIGH (when live) | All |
| Coordinator worker-compatible agent outputs | 3h | HIGH (when live) | Venturist |
| UDS listener stubs in room-passive | 2h | MEDIUM (when live) | All |

### Phase 5: Co-Work Adaptation

| Task | Effort | Impact | User |
|------|--------|--------|------|
| MCP server profiles for Desktop/Cowork | 3h | HIGH | Desktop/Cowork users |
| Notification hook for background agents | 1h | MEDIUM | Desktop users |
| ConfigChange hook for hot-reload | 2h | MEDIUM | All |
| SessionEnd learning progress (students) | 2h | HIGH | Students |

---

## 5. Environment Variables Reference

### Safe to Configure (v1.8.0)

| Variable | Value | Purpose |
|----------|-------|---------|
| `AUTOCOMPACT_PCT_OVERRIDE` | 72 | Default compaction threshold |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | (model-specific) | Override context window |

### Monitor for Activation

| Variable | Gate | Purpose |
|----------|------|---------|
| `CLAUDE_CODE_COORDINATOR_MODE=1` | tengu_scratch | Parallel agent dispatch |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | N/A | Multi-session collaboration |

### Never Use

| Variable | Why |
|----------|-----|
| `USER_TYPE=ant` | Internal Anthropic flag, may trigger unexpected behavior |
| `CLAUDE_CODE_ABLATION_BASELINE=1` | Disables ALL safety features |
| `DISABLE_COMMAND_INJECTION_CHECK` | Security bypass |
| `CLAUDE_CODE_UNDERCOVER` | Hides Claude Code identity |

---

## 6. GrowthBook Gates to Monitor

| Gate | What It Unlocks | MindrianOS Impact |
|------|----------------|-------------------|
| `tengu_kairos` | Persistent memory | Replaces cold-start context rebuild |
| `tengu_harbor` | MCP allowlist | Must validate our MCP server passes |
| `tengu_cobalt_raccoon` | Auto-compact behavior | Affects hook timing |
| `tengu_portal_quail` | Memory extraction | Could replace USER.md system |
| `tengu_scratch` | Worker scratch dirs | Enables Coordinator workers |
| `tengu_ultraplan_model` | Planning model selection | Affects /mos:act chain planning |

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| KAIROS may not ship in current form | MEDIUM | Build compatible patterns, don't depend on it |
| MCP allowlist (tengu_harbor) may block our server | HIGH | Monitor, ensure schema compliance |
| Coordinator Mode API may change | MEDIUM | Use subagent pattern as fallback |
| Autocompact cap at 83% limits tuning range | LOW | 72% default is well within safe range |
| Agent Teams token cost scales linearly | MEDIUM | Budget-aware dispatch, model downgrade |
| ccleaks.com analysis may be inaccurate | LOW | Cross-reference with official docs when features ship |

---

## 8. Success Metrics

| Metric | Current (v1.7.1) | Target (v1.8.0) | Measurement |
|--------|-------------------|------------------|-------------|
| Session-start context cost | ~63K tokens | ~6-14K tokens | /context command |
| Cold-start time | 2-3s | 1-2s (cached) | Hook timing logs |
| Swarm dispatch failures (context overflow) | Unknown | 0 | Error tracking |
| Student onboarding friction | Full context dump | 3-tier progressive | User feedback |
| Cross-session context loss | HIGH | LOW (structured last-session.md) | Returning user test |
| MCP overhead per turn | ~55K tokens | ~3-6K tokens (profiled) | Token measurement |

---

*Cross-references:*
- *RESEARCH_14_CLAUDE_CODE_SOURCE_ARCHITECTURE.md (source architecture details)*
- *room/solution-design/2026-04-05-claude-code-source-optimization.md (data room filing)*
