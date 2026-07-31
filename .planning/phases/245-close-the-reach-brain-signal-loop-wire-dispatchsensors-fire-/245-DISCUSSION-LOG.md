# Phase 245: Close the reach/Brain signal loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-
**Areas discussed:** Dial-ranking fusion mechanism, Brain re-derive trigger mechanism, hats
sensor trigger condition, context_block tie-break rule

Advisor mode active (`$HOME/.claude/gsd-core/USER-PROFILE.md` present). Calibration tier:
`minimal_decisive` (Vendor Philosophy: opinionated). NON_TECHNICAL_OWNER signal
(`learning_style: guided`) present in USER-PROFILE.md but overridden by direct evidence within
this same conversation (navigator is the project's own founder/developer, reading raw SQL
transaction code, Canon Part 3 vocabulary, and filing GSD phases against their own dev repo) —
gray areas were presented in full technical language rather than reframed to product-outcome
language, per this session's judgment call, noted for audit.

---

## Dial-ranking fusion mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded additive term in `reach-hedge-ranker.cjs` | Sensor signal already at the render callsite via `decision_trace.context_assembly.facts[]`; the hedge ranker already blends cortex+registry scores over the same 6 `reach_id`s | ✓ |
| RRF fusion via `eureka/hybrid-retrieve.cjs`'s `rrfFuse` | Reuses a shipped primitive but discards score magnitude the frozen 0.70/0.15 gate depends on; repo's own docs flag RRF's rank gaps as too flat for a 6-item bank | |

**User's choice:** Bounded additive term in `reach-hedge-ranker.cjs` (recommended option).
**Notes:** RRF kept as the documented fallback if a future signal source is not `reach_id`-keyed.

---

## Brain re-derive trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the shipped drain bug + flip `brain-derive`'s `connector.excluded` | The entire trigger/queue/drain pipeline already exists, hook-wired, tested; live-reproduced root cause is a 191ms-vs-100ms budget-accounting bug in `brain-derivation-drain.cjs` that silently vacuums the queue every turn without spawning | ✓ |
| New PostToolUse hook + new enqueue path | Would duplicate the existing `post-write` → `minto-debouncer` → `vault-section-minto-generator` cascade — a Part 7 violation, not demonstrated as needed | |

**User's choice:** Fix the shipped drain bug (recommended option).
**Follow-up:** Research flagged that the recommended fix also fires on `age_exceeded` (7-day
staleness), a third trigger beyond SPEC.md's originally-worded "governing-thought change or
explicit ask." Asked as a direct follow-up: navigator confirmed `age_exceeded` is a legitimate
third trigger, not scope creep. `245-SPEC.md` Requirement 2's Target and Acceptance sections were
amended accordingly (see `245-CONTEXT.md` D-11).

---

## hats sensor trigger condition

| Option | Description | Selected |
|--------|-------------|----------|
| New sensor `SENS-17` (`sensor-perspective-lock.cjs`) on `freshContradictions >= 2` | Trigger condition already written as doctrine (`SKILL.md:383`); signal already computed on `sensorCtx`; also repairs a found bug where 3 commands declare an unfireable `SENS-05` hats trigger | ✓ |
| Extend `sensor-circularity.cjs` (SENS-10) with a 5th cause | No new file, but keyword-only FALLBACK-tier detection; breaks the audited zero-collision property; overloads a sensor documented as exactly four causes | |

**User's choice:** New sensor SENS-17 (recommended option).
**Notes:** `>= 2` threshold (not `> 0`) is load-bearing — avoids a double-fire with SENS-08's
existing `cross_room` trigger on the same `freshContradictions` field. Flip-condition check
against the dial-rethink research's named ~25-30 sensor-count ceiling: confirmed not tripped
(17 → 18 implementations, 7-13 files of headroom).

---

## context_block tie-break rule

| Option | Description | Selected |
|--------|-------------|----------|
| Doctrine `SENS_PRIORITY` table as the tie branch in `reach-hedge-ranker.cjs` | Live-tested: the existing Hedge/MWU reranker is structurally blind to same-`reach_id` collisions (identical scores regardless of weights, falls through to file order) — this is genuine new work, not existing-mechanism wiring | ✓ |
| Per-sensor `trigger_tier` as the tie signal, priority table as sub-tie-break | More semantically justified, but the shipped classifier is turn-level not sensor-level — can't discriminate colliders without inventing per-sensor constants that reduce to a coarser copy of the priority table | |

**User's choice:** Doctrine `SENS_PRIORITY` table (recommended option).
**Notes:** This finding corrects two claims from the room's own 2026-07-31 dial-rethink research:
(1) the Hedge/MWU reranker does NOT already solve this collision (it was speculated as a possible
existing fix; live-tested and disproven); (2) the collision count is 12 of 18 sensors, not 11 of
17 (the room's grep missed SENS-01, which is defined inline rather than in its own file).

---

## Claude's Discretion

None — all 4 discussed areas reached an explicit navigator pick between researched options; no
area was left to Claude's judgment alone.

## Deferred Ideas

**Semantic vocab-sourcing from canonical docs** (navigator, raised mid-discussion after the 4
areas were picked) - deriving sensor trigger vocab from Brain/SKILL.md/command/MCP docs instead
of hand-duplicated per-sensor keyword lists, ranked via the local graph + probability/semantic
similarity, surfaced as JTBD-aligned options. Genuinely good, distinct idea with real prior art
(Phase 230's skill-description trigger-design principles) - not folded into Phase 245 because it
is broader than any of the 4 discussed areas and overlaps the same-day dial-rethink research's
already-decided "don't rewrite" verdict on the ranking-mechanism half, though not the
vocab-sourcing half specifically. Full writeup and recommended next step in `245-CONTEXT.md`'s
`<deferred>` section.

Requirement 5 (Part 8 egress-guard scoping check) was not selected as a discussion area — no
advisor research was run for it. Recorded in `245-CONTEXT.md` as open for the researcher/planner
to investigate directly rather than pre-decided here.

A reviewed-but-not-folded todo: `2026-07-17-ingest-skill-description-insight-to-brain.md`
(brain-ingestion, match score 0.6 via `todo.match-phase`) — a different problem (ingesting a new
insight into Brain's graph, blocked on admin-key access), not this phase's Brain-consult-timing
problem. Left open in its own todo file.
