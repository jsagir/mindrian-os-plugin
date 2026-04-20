---
phase: 91
name: navigation-engine
release_version: 1.11.0
parent_release: 1.10.14 (Phase 90 Brain Derivation Layer)
created: 2026-04-19
driver: 2026-04-19 audit established that MindrianOS skill activation is primitive (file-state and environment only; zero skills activate on problem-type, intent, reasoning gap, or Brain signal). The Ask-Tell dial is downstream of selection; selection is the missing engine. Phase 88 ships the per-folder memory triple foundation. Phase 90 adds Brain-authored layer on top. Phase 91 composes both into a decision layer that picks which skill, command, or framework fires next. This is the Navigation Engine -- L5 Decision reading L3 Navigation substrate.
authority_docs:
  - .planning/phases/91-navigation-engine/91-CONTEXT.md (this doc)
  - .planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md (L2 memory triple)
  - .planning/phases/90-brain-derivation-layer/90-CONTEXT.md (L2 Brain layer)
  - .planning/research/ui-ux-pathways/skill-offer-engine.md (origin concept, scope expanded here)
  - .planning/research/navigation-engine-brain-interface.md (from Phase 90-09, Brain query interface)
invariants:
  - Engine reads via folder-memory.cjs readQuadruple (Phase 90 contract); never parses files directly
  - Engine decisions are explainable (every fire includes trace of which signals contributed)
  - Engine respects active room scope (never fires skills from other rooms)
  - Engine never blocks user turn; all queries complete within UserPromptSubmit timeout (2s)
  - Graceful degradation: Brain layer absent falls back to triple-only decisions
  - Persona is durable: one taxonomy matched to Brain's 2-persona schema (Explicit/Implicit), derived from Larry's 3-persona detection (TTO/Researcher/Business)
  - Zero new runtime dependencies
  - CJS only, no build step
  - All prior phases' tests stay green
  - BSL 1.1 license
canon_parts: [Part 2, Part 2a, Part 3, Appendix E]
---

# Phase 91: Navigation Engine

## Milestone: v1.11.0

## Goal

Ship the decision layer that picks which skill, command, or framework fires based on triangulated signals from ICM + SQL + Feynman-MINTO + BRAIN + live intent/persona. The Navigation Engine is the L5 Decision layer in the five-layer architecture filed 2026-04-19.

Today skill activation is primitive (file-state and env only). The engine makes activation context-aware, brain-aware, and reasoning-aware. Visible dial position, persistent Larry persona, and skill discoverability all become emergent properties of the engine picking correctly rather than separate features.

This is where the product thesis ("speed up the eureka moment") becomes operational. Every user turn: engine reads quadruple memory + Brain derivations + intent + persona, decides which skill fires, surfaces next-step offers grounded in room state.

## The five-signal triangulation

| Signal | Source | Role |
|---|---|---|
| **ICM scope** | ROOM.md via folder-memory.cjs | Where is the user? Which section matches the intent? |
| **SQL relations** | room.db LazyGraph | What edges connect this scope? Contradictions, convergences, gaps, invalidations. |
| **Feynman-MINTO reasoning** | folder-memory readTriple | Is the reasoning sound? Where are weaknesses? What's the governing thought? |
| **BRAIN derivations** | folder-memory readQuadruple (Phase 90) | What patterns does Brain see? Wicked indicators? Framework predictions? Cross-room contradictions? |
| **Intent + persona** | UserPromptSubmit hook + USER.md | What did user just say? Who are they? What stage are they at? |

The engine is NOT a linear score. It is a structured decision function:

```
engine(turn) -> decision {
  fire_skill: "name" | null,
  offer_next_step: { command, reason } | null,
  suppress_skills: ["name", ...],  // e.g., don't offer methodology when user wants to vent
  persona_updates: { archetype, problem_type, venture_stage },
  decision_trace: {
    icm_scope,
    sql_signals,
    minto_reasoning,
    brain_patterns,
    intent_persona,
    chosen_rationale
  }
}
```

Every decision is traceable. The trace is how users understand "why did Larry do X?" when they ask.

## Why this needs Phases 88 + 90 as prerequisites

**Without Phase 88 (triple + invariants):**
Engine reads stale Feynman-MINTO, misses recent artifact writes, can't trust reasoning signal. Decisions fire on rotting data. User trust collapses.

**Without Phase 90 (Brain layer):**
Engine has triple-only view. Cannot access ProblemType classification, WickedIndicators, Framework chain predictions, cross-room contradictions. Brain remains ambient enrichment. Moat stays dormant.

**With both:**
Engine has stable, fresh, cross-referenced signal across the five dimensions. Decisions compound with every session. Brain analysis feeds future decisions. Moat becomes visible infrastructure.

This is why Phase 91 is numbered after 88 and 90, not before.

## Plans (10 plans, 5 waves)

### Wave 0 — Core engine + persona unification

**91-00: lib/core/navigation-engine.cjs core**
- Single module with main export: `decide(turn, context) -> decision`
- Reads: folder-memory.cjs readQuadruple for active section(s), intent-classifier output, USER.md persona
- Composition logic: structured decision function (not a weighted score; explicit rules per signal combination)
- Returns typed decision object with full trace
- Tests: 30+ fixtures covering combinations (weak-MINTO + strong-Brain, fresh-everything, Brain-absent, wicked-detected, etc.)
- Depends on: Phase 88 folder-memory, Phase 90 readQuadruple. Wave 0.

**91-01: Persona durability via USER.md**
- Promote persona from conversation-mode keyword detection to USER.md first-class property
- Mapping layer: Larry's 3-persona (TTO / Researcher / Business) maps to Brain's 2-persona (Explicit / Implicit) schema via documented translation table
- Persona set at first detection, updated on signal strong enough to override (not every turn)
- Persisted across sessions, read by engine on every turn
- Tests: detection flow, update threshold, mapping correctness, cross-session persistence
- Depends on: nothing. Wave 0.

### Wave 1 — Integration points

**91-02: UserPromptSubmit hook integration**
- Modify `scripts/intent-classifier` (UserPromptSubmit hook) to call navigation-engine.decide()
- Engine result injected into additionalContext so Larry's response respects decision
- Timeout: 2s hard cap (existing hook budget)
- Fallback: if engine times out, legacy skill activation continues (existing behavior)
- Tests: engine fires within budget, timeout graceful, injection correct
- Depends on: 91-00, 91-01. Wave 1.

**91-03: Skill activation routing**
- Replace file-state-only skill activation with engine-directed activation where engine has opinion
- Existing activation (dir_exists, env) preserved as fallback
- Engine decision: fire_skill overrides default activation; suppress_skills prevents listed skills from firing this turn
- Tests: engine-fires precedence, fallback on engine-no-opinion, suppress works
- Depends on: 91-02. Wave 1.

**91-04: Next-step offer presentation**
- When engine returns offer_next_step, Larry's response includes structured offer at end
- Offer format: one line, grounded in decision_trace signal ("Because your market-analysis MINTO shows weak TAM evidence, try /mos:validate")
- Max 1 offer per turn (noise gate)
- Tests: offer grounded, one-per-turn, suppression when decision says no offer
- Depends on: 91-00. Wave 1.

### Wave 2 — Explainability + visibility

**91-05: /mos:explain-decision command**
- New command `commands/explain-decision.md`
- Shows the decision trace for the user's last turn
- Format: which signals contributed, which skill fired, why, what was suppressed, what was offered
- User-facing debugging surface: "Why did Larry say that?"
- Tests: trace present after turn, trace cleared on clear, multiple turns show correct trace per turn
- Depends on: 91-00. Wave 2.

**91-06: Visible dial element in statusline**
- Extend `scripts/context-monitor` (statusline renderer) to show current dial position
- Format: `Larry: Investigate | Blend | Insight` with subtle color (respects ui-system contract)
- Dial position derived from engine state (not separate conversation-mode state)
- Tyler's quote from meetings audit: "my students almost unanimously said, 'We love the slider'"
- Tests: renders correctly across terminals, updates on engine decision
- Depends on: 91-00. Wave 2.

### Wave 3 — Problem-type + wicked-aware routing

**91-07: Problem-type aware skill routing**
- Engine reads BRAIN.md ProblemType classification (Phase 90 output)
- Routes skill activation based on problem type:
  - Undefined -> Exploration skills prioritized
  - Ill-Defined -> Problem-definition-seeking skills
  - Well-Defined -> Execution + validation skills
  - Wicked -> Soft Systems, Rich Pictures, Stakeholder Analysis (WickedIndicator escalation)
- Tests: each type routes correctly, wicked detected via Brain triggers soft-systems family
- Depends on: 91-00, Phase 90 ProblemType classification. Wave 3.

**91-08: Framework chain composition via Brain FEEDS_INTO**
- Engine reads BRAIN.md Framework Chain Predictions
- When user completes one framework, engine pre-loads next framework from Brain's FEEDS_INTO edges
- Composable methodology (Brain-flagged unfilled Opportunity from audit) becomes real
- Tests: framework A -> B transition detected, chain offered proactively, user override respected
- Depends on: 91-00, 91-07, Phase 90. Wave 3.

### Wave 4 — Release

**91-09: v1.11.0 five-gate release (minor version bump)**
- Minor version bump because skill activation behavior changes (architectural shift)
- CHANGELOG [1.11.0]: Navigation Engine. Five-signal triangulation. Persona durability. Visible dial. /mos:explain-decision. Problem-type routing. FEEDS_INTO chain composition.
- plugin.json 1.11.0
- package.json 1.11.0
- git tag v1.11.0
- marketplace.json ref pin
- All prior phase tests + 91-* tests green
- Migration note: existing behaviors preserved as fallback; engine enhances, never breaks
- Depends on: all prior plans. Wave 4.

## Wave execution plan

```
Wave 0 (parallel):  91-00 engine core, 91-01 persona durability
Wave 1 (parallel):  91-02 UserPromptSubmit integration, 91-03 skill routing, 91-04 offer presentation
Wave 2 (parallel):  91-05 explain-decision command, 91-06 visible dial
Wave 3 (parallel):  91-07 problem-type routing, 91-08 framework chain composition
Wave 4:             91-09 release gate
```

Estimated total: 8-10 days. More complex than Phase 88 or 90 because it touches user-facing behavior (skill activation, offer presentation, dial visibility).

## Dependencies

- Phase 88 v1.10.13 must ship first (folder-memory.cjs, triple, invariants)
- Phase 90 v1.10.14 must ship first (readQuadruple, BRAIN.md schema, ProblemType classification)
- Phase 87 v1.10.11 + v1.10.12 must ship first (via transitive deps)
- Phase 83 scope injection (shipped) for active-room enforcement
- existing UserPromptSubmit hook via intent-classifier (shipped)
- existing USER.md via context-engine skill (shipped, extended here)

## Risks

1. **User-visible behavior change.** Engine-directed skill activation is new. Users accustomed to current behavior may be surprised. Mitigation: minor version bump signals change, migration note in CHANGELOG, fallback to existing behavior when engine has no opinion.

2. **Engine decision latency.** 2s UserPromptSubmit budget. Querying folder-memory + building decision + logging trace could exceed. Mitigation: cache last-quadruple-read during turn, lazy BRAIN.md loading, engine has 1s soft budget leaving 1s headroom.

3. **Persona mismatch causing wrong skill fires.** Larry's 3-persona detection is keyword-based and imperfect. Engine acts on persona. Mitigation: update threshold requires stronger signal; persona-set-by-user command (`/mos:persona --set researcher`) overrides detection; explain-decision surfaces persona contribution.

4. **Dial visibility feels gimmicky if not meaningful.** Statusline dial must reflect real state, not arbitrary position. Mitigation: dial position derived from engine decision each turn, not stored state; updated in real-time; explicit reason visible in /mos:explain-decision.

5. **Offer noise.** Engine might offer next step too often. Mitigation: max 1 offer per turn; suppress if last 2 offers ignored; user-facing `--no-offers` flag if needed.

6. **Explainability trace budget.** decision_trace can be large. Mitigation: stored to `.mindrian/decision-traces/<session>.json` not memory; /mos:explain-decision reads from file; auto-rotated after 50 traces.

## Success criteria

1. `lib/core/navigation-engine.cjs decide()` composes five signals deterministically; 30+ fixture tests green
2. Persona is durable across sessions; mapping between Larry 3-persona and Brain 2-persona documented and tested
3. UserPromptSubmit calls engine within 2s budget; timeout fallback tested
4. Skill activation respects engine decisions where engine has opinion; legacy fallback preserved elsewhere
5. Next-step offer grounded in decision trace, max 1 per turn, noise-gated after ignores
6. /mos:explain-decision shows trace for last N turns
7. Statusline dial renders Larry: Investigate | Blend | Insight based on engine state
8. Problem-type classification from Brain routes skills appropriately (tested for each 4 types)
9. FEEDS_INTO framework chains offered proactively when applicable
10. Feynman suite + Phase 88 + Phase 90 tests + 91-* tests all green
11. 5-gate release: CHANGELOG 1.11.0, plugin.json 1.11.0, package.json 1.11.0, git tag v1.11.0, marketplace pin

## Out of scope (Phase 92+)

- Multi-user collaborative decisions (Phase 92 Collaborative Mode)
- Cross-user Brain learning from anonymized engine decisions (future)
- LaTeX / Overleaf integration (separate phase)
- Mobile / PWA surface (v2.x)
- Discord / Zulip multi-surface engine (Phase 92 or 93)

## Canonical References

### Primary
- `.planning/phases/91-navigation-engine/91-CONTEXT.md` (this doc)
- `.planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md` (L2 foundation)
- `.planning/phases/90-brain-derivation-layer/90-CONTEXT.md` (L2 Brain layer)
- `.planning/research/ui-ux-pathways/skill-offer-engine.md` (origin concept)

### Architectural
- Five-layer stack (2026-04-19): L1 ICM | L2 Memory quadruple | L3 Navigation substrate | L4 Assets | L5 Decision
- Per-folder quadruple: ROOM.md + STATE.md + Feynman-MINTO.md + BRAIN.md
- `docs/MWP-SPECIFICATION.md`

### Signal sources
- `lib/core/folder-memory.cjs readQuadruple` (Phase 88 + 90)
- `scripts/intent-classifier` (shipped)
- USER.md persona (extended in Phase 91-01)
- BRAIN.md ProblemType classification (Phase 90)
- room.db LazyGraph edges (Phase 84)
- Feynman-MINTO governing_thought (Phase 81)

### Forward pointers
- Phase 92 Collaborative Mode
- Phase 93 Discord/Zulip multi-surface
- Phase 94 Goose extension (MCP-based)
- Cross-user intelligence (v1.11+ or v2.x)

---

*Phase: 91-navigation-engine*
*Context gathered: 2026-04-19*
*Ready for: /gsd:plan-phase 91 (after Phase 88 + 90 ship)*
