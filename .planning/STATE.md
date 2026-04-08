---
gsd_state_version: 1.0
milestone: v1.8.8
milestone_name: Brain Graph Optimization + Pam-Proof Install
status: ready_to_plan
stopped_at: null
last_updated: "2026-04-07T00:00:00.000Z"
last_activity: 2026-04-07 - Milestone v1.8.8 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Centralize all Data Rooms under ~/MindrianRooms/ with ICM-compliant structure
**Current focus:** v1.8.6 milestone complete

## Current Position

Phase: 59.2 of 59.2 (Room Hierarchy Graph Layer)
Plan: 01 (complete)
Status: All phases complete (56, 57, 58, 59, 59.1, 59.2)
Last activity: 2026-04-06 -- dual-graph room hierarchy, sync scripts, Brain integration

Progress: [##########] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

## Accumulated Context

### Decisions

- resolve-room is the keystone script -- all other changes depend on it resolving ~/MindrianRooms/ first
- Phase 58 (Skill/UX) depends only on Phase 56, enabling parallel execution with Phase 57 if needed
- ICM Layer 0 = CLAUDE.md (identity), Layer 1 = INDEX.md (routing), Layer 2 = per-room STATE.md (contract)
- [Phase 56]: resolve-room uses 4-strategy cascade: central registry -> dir scan -> workspace registry -> legacy fallback
- [Phase 58]: Skills use resolve_room:active trigger; all display paths show ~/MindrianRooms/[name]/; session greeting references MindrianRooms on first encounter
- [Phase 59]: migrate-rooms uses cp -a (copy, never move); 5 legacy patterns detected; per-room confirmation; /mos:setup rooms added
- [Phase 59.1]: /mos:organize uses 4-tier degradation (Brain+KuzuDB -> Brain -> KuzuDB -> metadata); decisions stored locally in .rooms/decisions.json, promoted to graph edges when Brain available
- [Phase 59.2]: Dual-graph architecture (KuzuDB local + Neo4j Brain remote); graph never writes filesystem; fire-and-forget sync on session-start and room create/archive; brain-client.cjs write() method added

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- Update generate-presentation.cjs graph view to vis-network
- LaTeX export command: /mos:latex
- Desktop Data Room MCP: KuzuDB Windows build blocked
- Grading calibration data: 0/100+ Example nodes

### v1.9.0 -- Context Engineering Optimization (Next Milestone)

**Goal:** Cut the 23.6K fixed token overhead that consumes 12% of Sonnet budget before any room context loads.

**CLAUDE.md Diet (41KB -> ~20KB):**
- Move architectural theory (Simon, Rittel, ICM -- 8KB) to external docs/THEORY.md
- Move tech stack reference (18KB) to docs/STACK.md
- Keep only: identity, rules, key decisions, constraints, release process
- @include only what's needed per session, not everything

**Progressive Skill Loading (46KB always -> 5KB + on-demand):**
- Load 2-3 core skills at startup (ui-system, context-engine, room-passive)
- Lazy-load methodology skills only when /mos: command invoked
- Lazy-load brain-connector only when Brain is configured
- Target: 5KB startup overhead instead of 46KB

**Learnings Rotation:**
- .learnings.md grows unbounded today -- no garbage collection
- Add rotation: keep only last 20 sessions
- Add staleness detection: remove learnings older than 30 days
- Add dedup: merge similar learnings

**STATE.md Caching:**
- Currently recalculated from scratch every session start
- Add caching with 30-minute TTL + file-change invalidation
- Add "summary mode" for context budgets >60% -- inject key metrics only, not full table

**Brain Response Caching:**
- Same Brain query fetches fresh every time today
- Add 24h cache for identical queries
- Cache stored in .rooms/.brain-cache.json

**Proactive Context Windowing:**
- Currently reactive (user must /clear)
- Add proactive suggestion at archetype-specific thresholds
- Students: suggest at 65%, venturists: 75%, researchers: 78%
- Auto-switch to minimal tier before autocompact triggers

**ICM-Driven Context Loading (the big one):**
- Van Clief & McDermott say "folder structure IS the code" -- but also folder structure IS the context strategy
- ~/MindrianRooms/CLAUDE.md (Layer 0) tells the model WHERE it is
- ~/MindrianRooms/INDEX.md (Layer 1) tells the model WHERE to go -- which room to load
- Room/STATE.md (Layer 2) tells the model WHAT this room contains -- load only relevant sections
- Section/ROOM.md (Layer 3) tells the model WHAT this section needs -- load only relevant references
- Today: session-start loads everything flat. v1.9.0: session-start TRAVERSES the ICM hierarchy
- Load Layer 0 first (tiny). Read Layer 1 to find active room (tiny). Read Layer 2 to understand room state (small). Load ONLY the sections and skills relevant to the user's current context.
- The ICM hierarchy becomes the SELECT strategy from the ByteByteGo article -- the folder structure decides what enters the context window
- MindrianRooms/CLAUDE.md is not just identity documentation -- it becomes the context routing instruction
- Each room's CLAUDE.md (if we add one) could specify: which skills this room needs, which Brain queries are relevant, what references to pre-load
- This is ICM Layer 2 (Contracts) from the paper: "What do I do?" becomes "What context do I need?"

**Per-Room Context Profiles:**
- Each room gets a .context-profile.json: preferred skills, relevant frameworks, Brain query patterns
- session-start reads the profile and loads ONLY what this room needs
- A "cancer research" room loads different skills than a "venture pitch" room
- A room at "Pre-Opportunity" stage loads different frameworks than "Ready to Build"
- The profile is auto-generated from room usage (.analytics.json) and stage (STATE.md)

**Measured Impact Target:**
- Sonnet: 23.6K overhead -> ~6K (75% reduction, with ICM-driven loading)
- Opus: 23.6K overhead -> ~6K (same, budget allows richer per-section loading)
- Per-turn cost: halve again from the v1.8.4 optimization (10K -> 5K)
- Room-specific loading means a simple note-taking session doesn't load methodology skills at all

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-06T20:52:00Z
Stopped at: Completed 59.2-01 (Room Hierarchy Graph Layer) -- v1.8.6 milestone complete
Resume file: None
