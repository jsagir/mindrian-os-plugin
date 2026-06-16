# Phase 160: Temporal Awareness (spine + Larry Reaches) - Specification

**Created:** 2026-06-16
**Ambiguity score:** 0.19 (gate: ≤ 0.20)
**Requirements:** 12 locked

## Goal

MindrianOS resolves the user's relative time ("yesterday", "next month") against one authoritative reference clock, speaks time back ("you raised this 3 days ago"), ranks recent context above stale in the spine and reach engine, stores bitemporal valid-time on graph nodes, and enforces a human-owned `valid_at` on real-world-event artifacts - closing the gap from "time-aware for bookkeeping, time-opaque in conversation" to "time is a first-class, human-led substrate."

## Background

Current state (3-agent fan-out, see `160-RESEARCH.md`, file:line cited):
- Nodes already carry indexed `created_at` / `last_seen_at` / `confirmed_at` (epoch ms) - `lib/core/migrations/phase-109-nodes-provenance.cjs:31-51` - but `getRoomContext` Leg D sorts `ORDER BY type, id` (alphabetical) and never SELECTs them - `lib/core/navigation/room-context.cjs:162-165`.
- Only ONE relative-time computation exists (30-day stale-decision) - `lib/core/navigation/insights.cjs:109-116`. No NL-time parsing anywhere.
- The plugin computes "now" from `Date.now()` and ignores Claude Code's injected `currentDate` - `lib/memory/sessionstart-banner-formatter.cjs:37` - causing a midnight delta-flip bug.
- Relative-time RENDERERS already exist: `humanDelta()` - `lib/core/feynman/timeline-renderer.cjs:64-78`; `formatTimeAnchor()` - `lib/core/breakthrough/voice-scaffold.cjs:80-90`.
- Bitemporal scaffolding is half-built: `valid_from`/`valid_until` JSON on Phase 150.8 edges; legacy `facts.valid_from`/`invalidated_at`. No node-level valid-time, no point-in-time query.
- `memory_event` chokepoint has a clock-injection seam (`options.now`) - `lib/core/navigation/memory-events.cjs:459-495`.
- Meeting filing (`scripts/meeting-file-command.cjs`) stamps filing time; no date prompt, no gate.

This phase wires existing parts (de-risked) plus a chrono-node resolver, a node bitemporal migration, a Shape F date+sync gate, and a temporal-blindness sentinel.

## Requirements

### Wave 1 - Reference clock

1. **Reference-now seam**: One authoritative "now" sourced from Claude Code, not the system clock.
   - Current: time read from `Date.now()` at write; CC's injected `currentDate` ignored (`sessionstart-banner-formatter.cjs:37`).
   - Target: `getReferenceNow()` is a precedence ladder: (1) injected `currentDate` wins for the calendar date, (2) OPTIONAL online time-fetch as a clock-skew corrector (NTP-style fetch-once-per-session + offset; true time-of-day/tz; degrades silently offline), (3) `Date.now()` floor. Persists to a local seam; routes through the existing `options.now` clock seam. Online rung is Part 8 SIGNAL (bare GET, e.g. HTTP `Date` header, zero user bytes).
   - Acceptance: (a) with `currentDate=2026-06-16` injected and the system clock set to a different date, `humanDelta`-rendered surfaces compute against 2026-06-16; (b) a unit test injecting a fixed reference asserts the rendered delta; (c) with the online source unreachable, `getReferenceNow()` still returns a valid reference (degrades to currentDate/Date.now()) with no thrown error.

### Wave 2 - Resolve + speak

2. **Relative-time resolution (chrono-node)**: User NL-time resolves to absolute time.
   - Current: no NL-time parsing exists anywhere in the system.
   - Target: chrono-node (v2.9.1, MIT, zero transitive deps) resolves expressions ("yesterday", "last Tuesday", "next quarter") to epoch ms anchored to `getReferenceNow()`, `forwardDate` for future-biased phrases.
   - Acceptance: given reference 2026-06-16, a test table of ≥10 expressions resolves correctly (e.g. "last Tuesday"→2026-06-09; "next month"→2026-07-..).

3. **Larry speaks relative time**: The greeting and responses carry a time delta.
   - Current: greeting is "I see you were working on [topic]…" with NO time mention (`skills/context-engine/SKILL.md:24`).
   - Target: greeting + responses render a delta via existing `humanDelta()` ("you raised this 3 days ago").
   - Acceptance: greeting render for a topic node with `created_at` 3 days before reference-now contains the `humanDelta()` "3 days ago" string.

4. **Dual-stamp memory_events**: Real-world events carry both axes.
   - Current: `memory_event`s carry `created_at` only.
   - Target: real-world-event `memory_event`s also carry resolved `valid_at` (epoch ms), distinct from `created_at`, written through the Part 9 chokepoint.
   - Acceptance: a `memory_event` logged from "we met last Tuesday" has `valid_at` = resolved date and `created_at` = now; both present and distinct.

### Wave 3 - Recency in the spine (Larry Reaches link)

5. **Leg D recency ranking**: The spine ranks recent cortex nodes first.
   - Current: `getRoomContext` Leg D `ORDER BY type, id`; date columns not selected (`room-context.cjs:162-165`).
   - Target: Leg D selects `created_at`/`last_seen_at` and orders recency-aware (Generative-Agents `0.995^Δh` blend), deterministic.
   - Acceptance: given two cortex nodes identical but for `created_at`, the more recent ranks first; a frozen-output test guards determinism.

6. **Recency as a reach signal**: Recently-touched context can fire a reach.
   - Current: recency is unused in Engine 1 reach selection.
   - Target: recency contributes to reach-candidate ranking.
   - Acceptance: a recently-touched node yields a higher reach score than an identical stale node; a unit test asserts the ordering.

### Wave 4 - Bitemporal valid-time

7. **Bitemporal node columns**: Nodes carry valid-time + a true modified stamp.
   - Current: valid-time only as JSON on Phase 150.8 edges; nodes lack it; `last_seen_at` conflates read/write (`transitions.cjs:258`).
   - Target: additive idempotent migration adds `valid_from`/`valid_to`/`invalidated_at`/`last_modified_at` (epoch ms) to nodes; backfill `valid_from=created_at`, others NULL; `last_modified_at` updates on write only.
   - Acceptance: migration runs twice with no error and identical result; existing rows backfilled; reading a node does NOT change `last_modified_at`, writing does.

8. **Non-lossy supersession**: Superseded facts are closed, never deleted.
   - Current: contradictions handled via edges; no temporal closure.
   - Target: superseding B over A sets A's `invalidated_at=now`, `valid_to=B.valid_from`; A row persists.
   - Acceptance: after supersession A is still present with `invalidated_at` set; a point-in-time query as-of before supersession still returns A.

9. **Point-in-time query helper**: Historical state is reconstructable.
   - Current: cannot reconstruct state as of a past moment.
   - Target: one helper implementing `created_at <= T_tx AND (invalidated_at IS NULL OR invalidated_at > T_tx) AND valid_from <= T_v AND (valid_to IS NULL OR valid_to > T_v)`.
   - Acceptance: for a constructed 3-version timeline, the helper returns the correct fact at three distinct (T_tx, T_v) points.

10. **Stale detection beyond decisions**: All claim types can go stale.
    - Current: only `findStaleDecisions` (`insights.cjs:109-116`).
    - Target: generalized stale detection for claims/assumptions/opportunities with a configurable window (default 30 days).
    - Acceptance: a 31-day-old confirmed claim is flagged stale; a 29-day-old one is not.

### Wave 5 - HITL date gate + temporal-blindness sentinel

11. **HITL date+sync gate (Shape F) on meetings + dated events**: Human owns `valid_at`.
    - Current: meeting filing stamps `now`; no date prompt, no gate.
    - Target: filing a meeting (and any node flagged `has_event_date`) requires `valid_at`. If absent, a Shape F (F.1) selector prompts "when?" (sets `valid_at`; accepts free-typed relative time resolved by chrono-node) AND multi-select "relates to?" → writes sync edges via the existing `f_selector_sync_confirmed` machinery. `created_at` stays the filing moment. Pure ideas/assumptions stamp `valid_at = filing time` silently.
    - Acceptance: (1) filing a meeting with no date BLOCKS until `valid_at` is set via the selector; (2) a meeting given "last Tuesday" resolves `valid_at` correctly against `getReferenceNow()`; (3) multi-selecting a relation writes a sync edge and emits `f_selector_sync_confirmed`.

12. **Ongoing temporal-blindness sentinel**: Undated real-world artifacts are swept.
    - Current: nothing scans for undated artifacts.
    - Target: a sensor (new row in the Phase 143 SENS framework, schedulable via the Phase 145 cadence) lists real-world-event nodes where `valid_at IS NULL` and surfaces them for dating; emits `temporal_blindness_surfaced`.
    - Acceptance: with N undated real-world nodes present, the sentinel returns exactly those N; with zero present, it returns empty and surfaces nothing.

## Boundaries

**In scope:**
- Reference-now seam reading CC `currentDate` (Wave 1)
- chrono-node relative-time resolution + Larry speaking time + dual-stamped events (Wave 2)
- Recency-ranked Leg D + recency as a reach signal (Wave 3)
- Bitemporal node columns + non-lossy supersession + point-in-time helper + generalized stale detection (Wave 4)
- Shape F HITL date+sync gate on meetings/dated-events + temporal-blindness sentinel (Wave 5)

**Out of scope:**
- Any Brain egress of temporal data - Part 8 LOCAL only; not a feature, a hard boundary.
- Community summaries, Ebbinghaus auto-pruning, outcome-weighted importance - incremental, defer to a follow-on.
- Cross-room unified temporal namespace - each room stays independent.
- Migrating legacy ISO timestamp tables (`facts`, `sessions`, assumptions) to epoch - only the nodes table changes; legacy tables untouched.
- Async/multi-LLM graph build (Graphiti-style) - supersession stays synchronous in SQLite (a deliberate advantage over Graphiti's build latency).
- Timezone configuration UI - assume UTC + a single configured tz; read CC offset if present.

## Constraints

- **Dependency:** chrono-node 2.9.1 (MIT, zero transitive deps) is the ONLY new dependency; verified consistent with the 11 prod deps already shipped.
- **Part 8 (LOCAL→BRAIN:NO):** all temporal data - reference now, `valid_at`, NL parse, recency scores - stays local; the Phase 157 boundary scan must stay GREEN.
- **Part 9 (chokepoint):** every new stamp flows through `navigation.cjs::logMemoryEvent`; no side-door writes.
- **Part 7 (reuse):** render via existing `humanDelta()`/`formatTimeAnchor()`; gate via existing `f_selector_sync_confirmed`/Shape F; resolve via the existing `options.now` clock seam.
- **Migration discipline:** node migration is additive, idempotent, and backfilled (Phase 95.x precedent).
- **Hot-path safety:** the Leg D ranking change requires a deterministic frozen-output guard.

## Acceptance Criteria

- [ ] `getReferenceNow()` resolves to CC `currentDate` when injected; deltas compute against it, not the system clock
- [ ] `getReferenceNow()` degrades cleanly when the optional online time source is unreachable (returns a valid reference via currentDate/Date.now(), no thrown error); online rung carries zero user bytes (Part 8 SIGNAL)
- [ ] chrono-node resolves ≥10 relative expressions correctly against a fixed reference
- [ ] Larry's greeting includes a `humanDelta()` time delta for the last-touched topic
- [ ] real-world-event `memory_event`s carry distinct `valid_at` and `created_at`
- [ ] `getRoomContext` Leg D ranks recent cortex nodes above stale; determinism guard GREEN
- [ ] recency contributes to reach-candidate ordering (recent > identical stale)
- [ ] node bitemporal migration is idempotent + backfilled; `last_modified_at` updates on write only, not read
- [ ] supersession closes the old fact (`invalidated_at`/`valid_to`) without deleting; pre-supersession point-in-time query still returns it
- [ ] point-in-time helper returns correct facts for a 3-version timeline at 3 (T_tx, T_v) points
- [ ] stale detection flags a 31-day claim, not a 29-day claim
- [ ] filing a meeting with no date BLOCKS until `valid_at` is set via the Shape F selector
- [ ] a meeting given "last Tuesday" resolves `valid_at` correctly against `getReferenceNow()`
- [ ] gate multi-select writes a sync edge and emits `f_selector_sync_confirmed`
- [ ] temporal-blindness sentinel returns exactly the undated real-world nodes; empty when none
- [ ] Part 8 boundary scan stays GREEN (zero temporal-data egress to Brain)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                            |
|--------------------|-------|------|--------|--------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | 5 waves with named outcomes                      |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Gate scope = meetings + `has_event_date`; explicit out-of-scope |
| Constraint Clarity | 0.80  | 0.65 | ✓      | chrono-node locked; Part 8/9/7 constraints       |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 15 pass/fail checks; gate done-bar falsifiable   |
| **Ambiguity**      | 0.19  | ≤0.20| ✓      |                                                  |

Status: ✓ = met minimum.

## Interview Log

| Round | Perspective       | Question summary                              | Decision locked                                                       |
|-------|-------------------|-----------------------------------------------|-----------------------------------------------------------------------|
| pre   | Researcher (fan-out) | Current temporal state, internal + user-facing + prior art | 3-agent map; existing stamps/renderers; chrono/Graphiti/recency patterns |
| nav   | Navigator         | v1 scope                                       | Full scope: speak + recency + bitemporal (all waves)                  |
| nav   | Navigator         | Phase shape: split vs one phase                | All 5 waves in ONE Phase 160, single beta train                       |
| nav   | Navigator         | Ongoing temporal-blindness + HITL date         | Added Wave 5: sentinel + human-owned `valid_at`                       |
| 1     | Boundary Keeper   | Resolver / gate scope / gate UX                | chrono-node; meetings + `has_event_date`; Shape F multi-select sync   |
| 2     | Seed Closer       | Gate design confirm + done-bar                 | Shape F = valid_at + sync edges; done-bar = meeting-block + resolve + sentinel |

---

*Phase: 160-temporal-awareness-spine*
*Spec created: 2026-06-16*
*Next step: /gsd-discuss-phase 160 - implementation decisions (how to build what's specified above)*
