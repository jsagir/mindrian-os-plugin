# Phase 91: Navigation Engine -- Discussion Log

> Audit trail only. Not input to planning, research, or execution agents.

**Date:** 2026-04-19
**Phase:** 91-navigation-engine

## Origin

2026-04-19 audit conversation established:
- Skill activation today is primitive (file-state + env only)
- Ask-Tell dial is downstream of skill selection, which is the missing engine
- Five signals already exist: ICM + SQL + Feynman-MINTO + Brain + intent/persona
- The engine that triangulates them into decisions does not exist

This became Phase 91 after Phase 88 (foundation) and Phase 90 (Brain layer) defined the inputs the engine needs.

## Decisions

### D-01: Engine is L5 Decision layer
Reads L3 Navigation substrate (SQL edges + quadruple memory). Produces decisions: which skill fires, which command surfaces, which to suppress. Not a text layer; a routing layer.

### D-02: Not a weighted score, a structured decision function
Earlier proposals (0.4 intent + 0.3 graph + 0.3 MINTO) were sketches. Real engine uses explicit rules per signal combination. Every decision has a trace. Every trace is explainable.

### D-03: Persona unification
Larry's 3-persona detection (TTO / Researcher / Business) mapped to Brain's 2-persona schema (Explicit / Implicit) via documented translation table. Persona becomes USER.md first-class property. Durable across sessions.

### D-04: Visible dial in statusline
Tyler meeting transcript quote: "my students almost unanimously said, 'We love the slider'." Dial becomes visible in statusline, position derived from engine state, updates per turn.

### D-05: /mos:explain-decision for trust
Every engine decision is explainable. New command surfaces the trace for user's last turn. Builds trust by showing the reasoning behind skill fires and offers.

### D-06: Minor version bump v1.11.0
User-facing behavior changes (skill activation, offers, dial visibility). Warrants minor bump, not patch. Backward-compatible with fallback where engine has no opinion.

### D-07: Dependencies locked
Requires Phase 88 (foundation) and Phase 90 (Brain layer). Cannot ship before both. Interface spec filed in Phase 90-09 defines the Brain query contract.

### D-08: Problem-type-aware routing
Engine reads BRAIN.md ProblemType classification. Routes skills by type: Undefined -> Exploration, Ill-Defined -> Problem-definition-seeking, Well-Defined -> Execution, Wicked -> Soft Systems + Rich Pictures escalation. Fixes the "Cynefin Cognitive Router" unfilled opportunity Brain has flagged.

### D-09: FEEDS_INTO chain composition
Brain has ~40 FEEDS_INTO edges. Engine uses them to pre-load next framework when user completes current one. Fixes "Composable Methodology Adapters" unfilled opportunity. Tyler + Adam transcripts both showed users wanted frameworks to chain, not discover manually.

### D-10: Phase order finalized
87 -> 88 -> 89 -> 90 -> 91 -> 92+ is the final sequence. 89 reverse-salient can consume Brain derivations when 90 ships but is not blocking.

## Claude's Discretion
- Exact trace format (structured JSON with typed fields)
- Decision-trace archive rotation (last 50 per session)
- Statusline dial color palette (respects ui-system 5-color contract)

## Deferred
- Multi-user collaborative decisions (Phase 92)
- Cross-user engine learning (v2.x)
- Mobile PWA engine surface (v2.x)
