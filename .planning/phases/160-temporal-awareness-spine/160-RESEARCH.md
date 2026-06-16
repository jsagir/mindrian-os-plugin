---
type: phase-research
phase: 160
slug: temporal-awareness-spine
milestone: v1.13.1
title: "Temporal Awareness - spine + Larry Reaches"
status: DRAFT (synthesis of 3-agent fan-out, 2026-06-16)
authority: jsagir@gmail.com
canon_parts: [Part 8 (LOCAL->BRAIN:NO), Part 9 (memory_event chokepoint)]
links: [spine (getRoomContext + memory_event), Larry Reaches Engine 1 (reach selection)]
sources:
  internal_graph: 3-agent fan-out agent A (graph/ICM temporal map)
  user_facing: 3-agent fan-out agent B (user-facing + Claude Code fit)
  external: 3-agent fan-out agent C (Tavily prior-art brief)
---

# Phase 160 - Temporal Awareness (spine + Larry Reaches)

## The problem (one paragraph)

Users speak in **relative time** - "yesterday", "next month", "you remember that thing from a couple weeks ago". MindrianOS stores only **transaction time** (`created_at` epoch ms) and surfaces it inconsistently, never resolves the user's relative language, computes "now" off a vulnerable `Date.now()`, and **discards recency at rank time**. The result: the system is time-aware for internal bookkeeping but time-opaque in conversation. Closing that gap is the cheapest path to the "feels different in one second" effect - and it is a direct **Hooked-model** lever (variable reward = "you raised this 3 days ago"; investment = work that visibly compounds over time).

## Killer-feature thesis (Hooked link)

An agent that recalls **when** feels like it has a memory, not a database. Relative-time recall is the *variable reward*; the accumulating timeline is the *investment* that makes leaving costly. This belongs at the **front** of every interaction (the greeting + every reach), not buried in a timeline view.

---

## Current state - what already exists (de-risks the build)

### Internal graph / ICM (agent A, file:line)
- **Timestamps already on every node, already indexed:** `created_at`, `last_seen_at`, `confirmed_at` (INTEGER epoch ms) - `lib/core/migrations/phase-109-nodes-provenance.cjs:31-51`.
- **memory_event chokepoint stamps `created_at` and has a clock-injection seam** for tests: `const nowFn = options.now || Date.now` - `lib/core/navigation/memory-events.cjs:459-495`. 63+ event types (Part 158 floor).
- **Bitemporal scaffolding already half-exists:** Phase 150.8 put optional `valid_from` / `valid_until` (epoch ms) as JSON on REFINES / ROOT_CAUSES / INSTANTIATES edges; the legacy `facts` table already has `valid_from` / `invalidated_at` (ISO) - `lib/core/memory-ops.cjs:39-40`. The pattern exists; it is not generalized.
- **Recency is captured but THROWN AWAY at rank time:** `getRoomContext` Leg D (cortex nodes Larry reasons over) sorts `ORDER BY type, id` - *alphabetical* - and does not even SELECT the date columns - `lib/core/navigation/room-context.cjs:162-165`. **This is the single highest-leverage, lowest-cost gap.**
- **Only ONE relative-time computation in the whole system:** the 30-day stale-decision check - `lib/core/navigation/insights.cjs:109-116`. No stale detection for claims / assumptions / opportunities.
- **`last_seen_at` conflates reads and writes** (no `last_modified_at`): a node *viewed* today looks as fresh as one *modified* today - `lib/core/navigation/transitions.cjs:258`.
- **No node-level valid-time, no point-in-time / time-travel, no bitemporal node model.**

### User-facing + Claude Code fit (agent B, file:line)
- **Relative-time RENDERING already exists** - reuse, don't rebuild: `humanDelta()` (`lib/core/feynman/timeline-renderer.cjs:64-78`) and `formatTimeAnchor()` (`lib/core/breakthrough/voice-scaffold.cjs:80-90`) already emit "3 days ago" / "this week" / "since YYYY-MM-DD".
- **Larry's return greeting omits time:** context-engine doctrine says "I see you were working on [topic]…" with **no time delta** - `skills/context-engine/SKILL.md:24`.
- **NL-time PARSING from user input is entirely absent.** Hook point if built: `lib/core/dual-path-detector.cjs` (intake) / `scripts/jtbd-update.cjs`.
- **The midnight bug:** plugin computes time from `Date.now()` at write (`lib/memory/sessionstart-banner-formatter.cjs:37`) and **ignores Claude Code's injected `currentDate`** ("Today's date is 2026-06-16"). A session crossing midnight can flip delta signs. **No "reference now" seam exists.**
- **Transcript timestamps ignored:** `scripts/transcript-ingest.cjs:100-142` reads turn content but not the per-turn `timestamp`; falls back to parse-time `Date.now()`.

---

## External prior art - patterns to adopt (agent C, sourced)

1. **Bitemporal four-field edge (Graphiti/Zep canonical form).** Each fact carries `valid_at`/`invalid_at` (real-world) + `created_at`/`expired_at` (system). Updates **close intervals, never delete** - fully auditable, replayable. Graphiti even rewrites stale fact text ("works as" → "used to work as"). Sources: Zep blog *Beyond Static Knowledge Graphs*; arXiv 2501.13956.
2. **Point-in-time query = one WHERE clause.** "As-known-at T_tx, valid-at T_v": `created_at <= T_tx AND (invalidated_at IS NULL OR invalidated_at > T_tx) AND valid_from <= T_v AND (valid_to IS NULL OR valid_to > T_v)`. NULL = open/unbounded. Ports to SQLite with no graph engine - **the moat is the schema, not the engine.**
3. **Timestamp attachment >> graph sophistication.** Mem0g beats OpenAI memory on temporal QA (58.1% vs 21.7%) chiefly because it *attaches timestamps*; OpenAI failed for omitting them. Source: arXiv 2504.19413.
4. **Relative-time resolution needs an explicit reftime.** Use a deterministic parser (**chrono-node**, JS, zero-dep, `ParsingReference {instant, timezone}`, `forwardDate` for "next quarter") anchored to one injected `<REFERENCE TIMESTAMP>`. Never let the LLM do raw date math - emit a symbolic form (`now - 1 day`) and resolve in code. Duckling's #1 bug is forgetting reftime. Sources: chrono README; OpenAI Temporal-Agents cookbook.
5. **Recency decay at retrieval (Stanford Generative Agents).** `score = recency + importance + relevance`, `recency = 0.995^(hours since access)`, min-max normalized. Source: arXiv 2304.03442.

---

## The synthesis - highest-leverage move

> **Inject ONE authoritative `<REFERENCE TIMESTAMP>` and dual-stamp every memory_event with a real-world `valid_at` (resolved from the user's relative language against that reference) alongside the `created_at` it already has.**

This single seam unlocks **all three** chosen scopes at once: relative-time resolution (speak + understand), recency decay (spine ranking), and bitemporal valid-time (point-in-time queries). Everything else is incremental on top. It is a few lines on machinery that already exists (clock seam + indexed `created_at` + Phase 150.8 valid-time JSON + `humanDelta()` renderer).

---

## Proposed wave plan (one phase, four waves; each wave ships a usable slice)

**Wave 1 - The reference clock (foundation, fixes the midnight bug).**
Establish `getReferenceNow()`: read Claude Code's injected `currentDate`, persist it to a context seam the plugin reads once per SessionStart, route time reads through the existing `options.now` seam. Replace ad-hoc `Date.now()` at the surfaces that render user-facing deltas. *Outcome: one trustworthy "now"; deltas stop flipping at midnight.*

**Wave 2 - Relative-time resolution + Larry speaks/understands (the killer feature).**
Add chrono-node-style deterministic resolution anchored to `getReferenceNow()` at the intake hook (`dual-path-detector`). Dual-stamp memory_events with resolved `valid_at`. Larry's greeting + responses gain time via existing `humanDelta()` ("you raised this 3 days ago"). *Outcome: the one-second "it remembers when" effect; Hooked variable-reward live.*

**Wave 3 - Recency in the spine (the Larry Reaches link).**
Flip `getRoomContext` Leg D off alphabetical onto recency-aware ranking (SELECT the date columns; blend `0.995^Δh` decay per Generative Agents). Make recency a **reach signal** in Engine 1 selection so "what we touched recently" can fire a reach. *Outcome: spine + Larry Reaches wired to time.*

**Wave 4 - Bitemporal valid-time generalization (+ sealing).**
Generalize the four-field pattern from Phase 150.8 edges to nodes / all claim types; non-lossy supersession (close `invalidated_at`/`valid_to`, never delete); add `last_modified_at` to disambiguate read vs write; one point-in-time query helper; extend stale detection beyond decisions. Tests via the clock seam. *Outcome: auditable temporal history; "what was true at phase X".*

**Wave 5 - Temporal-blindness sentinel + HITL date gate (the enforcement layer).**
Two halves, both rooted in one doctrine: **the human's asserted time wins over the system clock for real-world events.**
- **Filing-time HITL date gate.** Any artifact that records a real-world event - meetings first (`scripts/meeting-file-command.cjs`), then decisions/claims with an event date - MUST carry a `valid_at` before it files. If the user gave a date (explicit, or NL-resolved via Wave 2), use it. If absent, Larry asks "when was this?" via an F.1 selector and **follows the user's lead** - that answer becomes `valid_at`; the filing moment stays `created_at`. Never silently stamp `now` on a past event. Fits the existing HITL filing doctrine (nugget-routing approval; nothing files without the human).
- **Ongoing temporal-blindness scanner.** A continuously-running sensor (new insight-sensor row in the Phase 143 SENS framework; schedulable via the Phase 145 cadence) scans room.db for artifacts that slipped through *undated* (real-world-event nodes where `valid_at IS NULL`) and surfaces them - "3 artifacts have no date - when did these happen?" - for the human to anchor. This is the standing guard that keeps temporal blindness from re-accumulating.

> **Why Wave 5 needs Wave 4:** the HITL gate populates `valid_at` while `created_at` stays the filing time - that two-axis split is exactly the bitemporal node model Wave 4 ships. Wave 5 is the *capture + enforce* surface for the valid-time Wave 4 makes *storable*. They are one phase.

> Quick-bump option: **Waves 1+2** are the shippable killer-feature slice; 3/4/5 ride the same beta train per the locked "all in one phase" decision.

---

## Boundary + risk

- **Canon Part 8 (LOCAL->BRAIN:NO):** all temporal data - reference now, resolved `valid_at`, NL parse, recency scores - stays in room.db / local context. **Zero Brain egress.** NL-time parsing operates on local user text only. The Part 8 boundary scan (Phase 157) must stay GREEN.
- **Canon Part 9:** every new stamp flows through the `memory_event` chokepoint (`navigation.cjs::logMemoryEvent`); no side-door writes.
- **Reuse mandate (Part 7):** render via existing `humanDelta()` / `formatTimeAnchor()`; resolve via the existing `options.now` clock seam; extend the Phase 150.8 valid-time pattern rather than inventing one.
- **Risks:** (1) chrono-node is a new dependency - verify zero-dep + license before adding, or hand-roll a regex bank for the common cases. (2) Leg D ranking change touches the spine's hot path - needs a deterministic test + a frozen-output guard. (3) `last_modified_at` is a schema migration - additive, backfill from `created_at`.

## Locked decisions (navigator, 2026-06-16)
- **Scope:** all five waves ship in ONE Phase 160 (no fast-follow split). "Full scope" wins; bump rides the same beta train.
- **Resolver:** chrono-node vs hand-rolled - decide in SPEC after checking dependency tree + license against the plugin's zero-dep posture.
- **HITL doctrine:** human-asserted time beats system clock for real-world events; undated real-world artifacts are blocked at filing and swept by an ongoing sentinel.

## Open questions for SPEC
1. chrono-node dependency vs hand-rolled regex resolver (check transitive deps + license).
2. Does recency-as-reach-signal need a new EVENT_TYPE, or reuse `reach_presented`?
3. Timezone source - does Claude Code's `currentDate` carry an offset, or assume UTC + user-configured tz?
4. Which node types are "real-world-event" (gate-eligible)? Meetings certainly; decisions/claims with an event date - by type, or by a `has_event_date` flag?
5. Temporal-blindness sensor: new SENS row in the Phase 143 framework + Phase 145 cadence - net-new event type for `temporal_blindness_surfaced`?
6. HITL gate UX: F.1 date-selector at file time - block hard, or file-with-`valid_at:null`-then-nag? (Doctrine leans block for meetings, nag for lower-stakes.)
