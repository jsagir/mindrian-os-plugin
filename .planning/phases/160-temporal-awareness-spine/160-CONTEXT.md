# Phase 160: temporal-awareness-spine - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Time as a human-led substrate across five waves: a reference clock, relative-time resolution + Larry speaking time, recency in the spine + reach engine, bitemporal valid-time on nodes, and a Shape F HITL date+sync gate + temporal-blindness sentinel. Wired to the spine (getRoomContext + memory_event) and Larry Reaches Engine 1. Part 8 LOCAL-only.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `160-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `160-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Reference-now seam reading CC currentDate (Wave 1)
- chrono-node relative-time resolution + Larry speaking time + dual-stamped events (Wave 2)
- Recency-ranked Leg D + recency as a reach signal (Wave 3)
- Bitemporal node columns + non-lossy supersession + point-in-time helper + generalized stale detection (Wave 4)
- Shape F HITL date+sync gate on meetings/dated-events + temporal-blindness sentinel (Wave 5)

**Out of scope (from SPEC.md):**
- Any Brain egress of temporal data (Part 8 LOCAL only)
- Community summaries / Ebbinghaus auto-pruning / outcome-weighted importance (defer)
- Cross-room unified temporal namespace
- Migrating legacy ISO timestamp tables (facts, sessions, assumptions) to epoch - only the nodes table changes
- Async/multi-LLM graph build (supersession stays synchronous in SQLite)
- Timezone configuration UI

</spec_lock>

<decisions>
## Implementation Decisions

### Capturing "now" (Wave 1)
- **D-01:** `getReferenceNow()` uses a HYBRID capture: a SessionStart hook seeds `~/.mindrian/reference-now.json` with `Date.now()` as a fallback floor, and Larry (who DOES see Claude Code's injected `currentDate` system-reminder, which hook subprocesses may not receive in stdin) corrects the seam via a tiny tool when the model-known date diverges from the seeded value. Degrades gracefully to `Date.now()` if Larry never runs (pure-script invocation). Rationale: the hook-can't-see-currentDate trap means a hook-only approach can never close the "CC knows the real date, plugin ignores it" gap; a Larry-only approach has no reference when the model is never invoked. The hybrid covers both.
- **D-01a:** The seam reader routes through the existing `options.now` clock seam (`lib/core/navigation/memory-events.cjs:459-495`) so tests inject a fixed reference.
- **D-01b:** `getReferenceNow()` is a PRECEDENCE LADDER, not a single source. Order: (1) injected `currentDate` wins for the calendar DATE (free, no network); (2) OPTIONAL online time-fetch as a clock-skew corrector - NTP-style: fetch ONCE per session, compute the offset between authoritative time and `Date.now()`, then apply `localclock + offset` (no per-call network); gives true time-of-day + timezone + immunity to a skewed local clock; (3) raw `Date.now()` floor. The online rung is OPTIONAL and degrades silently when offline (Tier-0 safe per canon). Part 8: a bare GET to a public time endpoint is SIGNAL -> LOCAL, carries ZERO user bytes; the simplest robust source is the `Date` HTTP response header (no API key, no JSON). Rationale: relative-time resolution is day/hour granularity and `currentDate` already fixes the date for free, so online fetch is a tie-breaker/skew-corrector, never a hard dependency.

### Gate enforcement seam (Wave 5)
- **D-02:** The date+sync gate's ENFORCEMENT lives in ONE shared `lib/core` filing chokepoint that `scripts/meeting-file-command.cjs` (CLI) and the MCP filing tool (Desktop/Cowork) both call. The rule ("no real-world-event artifact files without `valid_at`") is in one place; the Shape F selector RENDERS per surface (CLI AskUserQuestion, Desktop conversational, Cowork shared). Rationale: tri-polar by construction; per-surface enforcement is exactly where drift creeps in, and a filing hook is fragile/CLI-only.

### Recency math placement (Wave 3)
- **D-03:** Recency decay is computed APP-SIDE in JS after a recency-ordered SQL fetch (SELECT the date columns + `ORDER BY created_at DESC`, then blend `0.995^(delta-h)` per Generative Agents). A frozen-output golden-file fixture test (fixed node set -> fixed ranking) guards the spine hot path (Leg D). Rationale: cortex nodes are a small bounded set so SQL-vs-app speed is a rounding error; optimize for testability and a visible decay constant, not micro-perf. A decay constant buried in a SQL string cannot be frozen-tested.

### Sensor firing model (Wave 5)
- **D-04:** The temporal-blindness sentinel fires as a SCHEDULED backstop on the Phase 145 cadence; the R11 gate is the front line catching misses at the source. `has_event_date` is set EXPLICITLY at write time by node type (meeting = always; decision/claim flagged when the filing path detects an event date) - never inferred at read time, so the gate stays deterministic. Rationale: temporal blindness is slow-accumulating debt, not an urgent signal; per-turn firing taxes every turn for a phenomenon that does not move turn-to-turn.

### Claude's Discretion
- chrono-node integration shape (import surface, where the resolver module lives) - planner/researcher choice, constrained by D-01a (anchor to getReferenceNow) and the zero-dep posture already verified (chrono-node 2.9.1 MIT, zero transitive deps).
- Exact bitemporal migration file naming/sequencing - follow the `phase-109-nodes-provenance.cjs` additive-idempotent-backfill pattern.
- Whether recency-as-reach-signal reuses `reach_presented` or mints a new EVENT_TYPE (SPEC open question 2) - researcher decides against the frozen EVENT_TYPES contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase artifacts (read first)
- `.planning/phases/160-temporal-awareness-spine/160-SPEC.md` - Locked requirements (12), boundaries, acceptance criteria. MUST read before planning.
- `.planning/phases/160-temporal-awareness-spine/160-RESEARCH.md` - 3-agent synthesis: internal/user-facing current-state map (file:line), external prior art (Graphiti/Zep, chrono-node, Generative Agents recency), the highest-leverage move.

### Canon (boundary + memory constitution)
- `docs/MINDRIAN-CANON.md` Part 8 - LOCAL->BRAIN:NO; all temporal data stays local; the Phase 157 boundary scan must stay GREEN.
- `docs/MINDRIAN-CANON.md` Part 9 - memory_event chokepoint; every stamp flows through navigation.cjs::logMemoryEvent.
- `docs/MINDRIAN-CANON.md` Part 7 - reuse before build (humanDelta / formatTimeAnchor / f_selector_sync_confirmed / options.now seam).

### Code seams (current-state anchors, from the fan-out)
- `lib/core/migrations/phase-109-nodes-provenance.cjs:31-51` - existing node date columns (created_at/last_seen_at/confirmed_at, epoch ms, indexed); the additive-migration pattern to mirror for Wave 4.
- `lib/core/navigation/room-context.cjs:162-165` - getRoomContext Leg D `ORDER BY type, id` (the alphabetical sort to replace, Wave 3).
- `lib/core/navigation/insights.cjs:109-116` - the ONLY relative-time computation (findStaleDecisions, 30-day); generalize for Wave 4 R10.
- `lib/core/navigation/memory-events.cjs:459-495` - logEvent + the options.now clock seam (D-01a) + dual-stamp target (Wave 2 R4).
- `lib/core/navigation/transitions.cjs:258` - last_seen_at write (conflates read/write; add last_modified_at, Wave 4 R7).
- `lib/core/feynman/timeline-renderer.cjs:64-78` - humanDelta() (reuse for Larry speaking time, Wave 2 R3).
- `lib/core/breakthrough/voice-scaffold.cjs:80-90` - formatTimeAnchor() (reuse).
- `lib/core/dual-path-detector.cjs` - NL-time parse hook point (Wave 2 R2).
- `scripts/meeting-file-command.cjs` - meeting filing entry; the gate enforcement is extracted to a shared lib/core chokepoint this calls (D-02).
- Phase 143 SENS framework + Phase 145 cadence - the sentinel's home (D-04, Wave 5 R12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- humanDelta() / formatTimeAnchor(): relative-time RENDERING already exists - do not rebuild, reuse for R3.
- options.now clock seam in logEvent: the test-injection point for getReferenceNow (D-01a).
- Phase 150.8 edge valid_from/valid_until JSON + legacy facts.valid_from/invalidated_at: the bitemporal pattern to generalize to nodes (do not invent).
- f_selector_sync_confirmed / Shape F machinery (Phase 143/150): the gate's sync-edge surface (Wave 5 R11) reuses this.
- phase-109 migration: additive + idempotent + backfilled template for the Wave 4 node migration.

### Established Patterns
- Every stamp through the navigation.cjs memory_event chokepoint (Part 9).
- Frozen-output golden-file tests for hot-path determinism (Leg D guard, D-03).
- Part 8 boundary scan over any new code/data (must stay GREEN).
- Tri-polar: enforce in lib/core, render per surface (D-02).

### Integration Points
- getRoomContext (the spine) - Leg D ranking (R5) + reach scoring (R6).
- meeting-file-command.cjs + MCP filing tool - both call the shared gate chokepoint (D-02).
- SessionStart hook - seeds reference-now.json (D-01).
- Phase 145 scheduled cadence - hosts the sentinel (D-04).

</code_context>

<specifics>
## Specific Ideas

- The through-line the navigator wants front-and-center: `created_at` = when we filed it, `valid_at` = when it happened, the human owns `valid_at`. Larry SPEAKS time ("you raised this 3 days ago") and the gate FOLLOWS the user's lead on when.
- Hooked-model link is intentional and load-bearing: relative-time recall = variable reward; the accumulating timeline = investment. Must ride at the front of interaction, not buried in a timeline view.
- "add larry to the discussion" (this session): the temporal surfaces are Larry-voiced, not silent bookkeeping.

</specifics>

<deferred>
## Deferred Ideas

- Community summaries, Ebbinghaus auto-pruning, outcome-weighted importance - incremental on top of the recency blend; a follow-on, not v1.
- Cross-room unified temporal namespace (each room independent for now).
- Migrating legacy ISO timestamp tables (facts/sessions/assumptions) to epoch ms.
- Async/multi-LLM Graphiti-style graph build (supersession stays synchronous - a deliberate advantage).
- Timezone configuration UI beyond reading a CC offset.
- Transcript per-turn timestamp ingestion (transcript-ingest.cjs currently ignores it) - candidate enrichment, not in v1 scope.

None of these block Phase 160; all are noted so they are not lost.

</deferred>

---

*Phase: 160-temporal-awareness-spine*
*Context gathered: 2026-06-16*
