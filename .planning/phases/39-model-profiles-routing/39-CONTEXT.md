# Phase 39: Model Profiles & Routing - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-agent model resolution system with 4 profile tiers (quality/balanced/budget/inherit), venture-stage adaptive hints, cascade step model assignment, /mos:models command, and per-room configuration. Foundation for Phase 41 (parallel agents need model resolution) and Phase 43 (sentinel needs cost control).

</domain>

<decisions>
## Implementation Decisions

### Profile Defaults
- **D-01:** Default profile for new rooms is **quality** (opus for teaching/grading, opus for structured work, sonnet for scanning). MindrianOS users want the best teaching experience.
- **D-02:** Global defaults implementation is Claude's discretion. Consider ~/.mindrian/defaults.json or similar for users who want to set once and inherit.

### Dispatch Mechanism
- **D-03:** Commands resolve model via model-profiles.cjs, then include `model: {resolved}` in dispatch instructions to the agent. Agent .md frontmatter stays `model: inherit`. Matches GSD's proven pattern.
- **D-04:** Cascade steps (classify, edge detection, proactive analysis) get model assignment via script-level resolution. post-write script calls model-profiles.cjs and passes resolved model as argument or env var to each cascade step.

### Claude's Discretion
- Global defaults architecture (D-02)
- Stage hint override behavior (whether hints override explicit profile or only fill gaps)
- Config file location and structure details (room/.config.json recommended per research)
- /mos:models command UX details (display format, confirmation flows)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Reference Implementation
- `~/.claude/get-shit-done/bin/lib/model-profiles.cjs` -- GSD's MODEL_PROFILES table, resolveModelInternal() function, MODEL_ALIAS_MAP
- `~/.claude/get-shit-done/bin/lib/core.cjs` -- 4-step resolution logic (lines 994-1031)
- `~/.claude/get-shit-done/bin/lib/init.cjs` -- cmdInitPlanPhase() model resolution at orchestration start
- `~/.claude/get-shit-done/references/model-profiles.md` -- Profile philosophy and rationale

### MindrianOS Architecture
- `docs/POWERHOUSE-1.6.0-SPEC.md` -- Part 4: Model Routing (profile table, stage hints, resolution order, cascade routing, cost impact)
- `docs/research/RESEARCH_11_POWERHOUSE_SESSION.md` -- Step 7: GSD Model Routing Research (full analysis)

### Existing Agent Definitions
- `agents/larry-extended.md` -- model: inherit (main teaching partner)
- `agents/framework-runner.md` -- model: inherit (methodology execution)
- `agents/grading.md` -- model: inherit (calibrated assessment)
- `agents/brain-query.md` -- model: inherit (GraphRAG retrieval)
- `agents/research.md` -- model: inherit (external intelligence)
- `agents/investor.md` -- model: inherit (adversarial review)
- `agents/opportunity-scanner.md` -- model: inherit (grant discovery)
- `agents/persona-analyst.md` -- model: inherit (De Bono perspectives)

### Existing Infrastructure
- `lib/core/index.cjs` -- Core utilities, output() function
- `lib/core/state-ops.cjs` -- computeState(), getState() for venture stage reading
- `scripts/post-write` -- Cascade pipeline (where cascade model routing plugs in)
- `hooks/hooks.json` -- Current hook definitions
- `settings.json` -- Plugin activation settings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- lib/core/index.cjs: output(), error(), safeReadFile() -- use for model-profiles.cjs exports
- lib/core/state-ops.cjs: getState() -- read venture stage for adaptive hints
- scripts/post-write: cascade pipeline -- integration point for cascade model routing

### Established Patterns
- CJS module pattern: all lib/core/*.cjs use module.exports with function exports
- Script pattern: scripts/* are bash that call node for CJS logic
- Command dispatch: commands/*.md describe agent dispatch in prose, not code

### Integration Points
- commands/act.md, grade.md, research.md, persona.md, deep-grade.md: all dispatch agents and need model resolution added
- scripts/post-write: cascade steps need model-per-step routing
- hooks/hooks.json: no changes needed for this phase (hooks expansion is Phase 40)
- room/.config.json: new file, created by /mos:models or room init

</code_context>

<specifics>
## Specific Ideas

### Profile Table (from POWERHOUSE-1.6.0-SPEC.md Part 4)

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

### Venture-Stage Hints (from spec)

| Stage | framework-runner | research | grading | investor |
|-------|-----------------|----------|---------|----------|
| Pre-Opportunity | sonnet | haiku | skip | skip |
| Discovery | opus | sonnet | sonnet | skip |
| Validation | opus | sonnet | opus | sonnet |
| Design | opus | sonnet | opus | sonnet |
| Investment | opus | opus | opus | opus |

### Resolution Order (5 steps)
1. Per-agent override from room/.config.json
2. Venture-stage hint from STATE.md
3. Inherit (if profile = inherit, use parent session model)
4. Profile lookup from MODEL_PROFILES table
5. Default to sonnet

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 39-model-profiles-routing*
*Context gathered: 2026-03-31*
