---
phase: 120
slug: breakthrough-scan-category-g
status: scoped (ready for /gsd:plan-phase 120)
created: 2026-05-05
updated: 2026-05-16
milestone: v1.13.0
beta_target: final (Wave 2 remainder set, runs before Phase 121.5 capstone)
canon_parts: [Part 2 Engine 1, Part 3, Part 4, Part 5, Part 8, Part 10]
depends_on: [Phase 109 SQL navigation spine (shipped), Phase 117 auto-explore (shipped beta.8 -- the math layer that feeds breakthrough patterns), Phase 88.2 selector-block (provides F-shape primitive)]
dependents: [Phase 121.5 terminal-coherence-capstone (consumes F.6 in the surface-coherence sweep)]
estimated_days: 3
discuss_phase_completed: 2026-05-16 (twenty decisions D-01..D-20 locked via /gsd:discuss-phase)
hooked_audit_axis: Variable Reward 7/10 -> 9/10 + Trigger Internal +3
---

# Phase 120 -- Breakthrough Scan / Category G

**STATUS:** SCOPED 2026-05-16. Twenty decisions D-01..D-20 locked via discuss-phase pass on top of the 2026-05-05 stub. Ready for `/gsd:plan-phase 120`.

## Phase Boundary

Session-start scanner reads the room's existing content (room.db + Memory Event Log via Phase 109 navigation chokepoint) and detects four breakthrough pattern types. Renders the highest-scoring breakthrough in Larry-voice via a NEW F.6 selector with positive-framing rules. The user's own insights mirrored back -- "highest-nutrition variable reward" per Hooked Model. Hooked Fix 3 from the dormant 2026-04-12 audit. Implements Canon Part 10 sub-claim 5 (variable reward fires automatically; the math is the surface).

### IN SCOPE
- Four pattern detectors:
  1. **Convergence** -- multiple artifacts naming the same theme
  2. **Contradiction-resolved** -- a tracked tension was resolved
  3. **Cross-domain analogy** -- a pattern from another room/section applies (LOCAL only per Part 8 -- cross-domain means cross-section within the same room, NEVER cross-user or cross-room aggregation)
  4. **Reverse-salient closed** -- a lagging component caught up
- Two-tier firing model (soft-fire buffer + hard-fire surface) per D-01..D-06
- New F.6 Breakthrough Surface selector with 5 verbs per D-07..D-10
- Score-based top-1 surfacing with "More breakthroughs (N)" affordance per D-11..D-12
- Resurfacing cooldown + condition rules per D-13..D-15
- 4-rule positive-framing voice scaffold per D-17
- Hybrid ethics fence (HARD FLOOR Cypher provenance + SOFT BAND review queue + HARD CEILING auto-surface) per D-18
- Per-detector dismissal-rate canary auto-throttle per D-19
- Empty-state silence for new rooms per D-16

### OUT OF SCOPE
- AI-generated congratulations or manufactured breakthroughs (D-20 hard rule -- Cypher-provable from graph state alone or it does not surface)
- Cross-user breakthroughs or cross-room aggregation (Canon Part 8 invariant)
- Streak / gamification / engagement-optimizer dark patterns (Hooked ethics audit explicitly forbids)
- AI-driven retraining of detector weights from user behavior in v1.13.0 (the per-detector dismissal-rate canary is a static threshold; ML-tuned weights deferred to v1.14.0)
- Cross-detector convergence (e.g., "convergence + contradiction-resolved on same theme = super-breakthrough") -- treat as independent fires for v1.13.0; revisit if real data shows correlation patterns

## Implementation Decisions

### Detector thresholds + window (Area 1)

- **D-01: Two-tier firing model.** Soft-fire writes to a buffer but does NOT surface. Hard-fire surfaces via F.6. The buffer gives detectors time to confirm patterns are not transient and provides retraining signal when soft fires fail to escalate.
- **D-02: Soft-fire threshold.** 3 artifacts within the trailing window, confidence >= 0.25. Logs to `room.db` `breakthrough_buffer` table; does not call F.6.
- **D-03: Hard-fire threshold.** 4+ artifacts within window, OR 3 artifacts with cross-section linkage (an artifact references another section via wiki-link or graph edge), at confidence >= 0.35. This is the surface trigger.
- **D-04: Semantic similarity threshold.** Minimum 0.40 cosine similarity for theme-matching within a single room. NOT the corpus-level 0.30 differential. Rationale: Phase 120 operates within a single room where noise correlation is higher (same author, same vocabulary, same project frame), so the threshold pushes up.
- **D-05: Reverse-salient closed requires BOTH signals.** (a) Graph-level proof: an edge type or property combination that did not exist before now exists (Cypher query proves the closure structurally), AND (b) The lagging-component score crosses its baseline within the window. Single-signal closure is where false positives live -- score deltas can swing from normal artifact accumulation without a real closure event.
- **D-06: Window.** Since-last-session for continuity, capped at 14 days. Configurable per-room (`config.json` key `breakthrough_window_days`), default 14. Rationale: if a user returns after 30 days and the system fires "Look what you did 21 days ago," it reads as manipulative because they have emotionally moved on. The 14-day cap is the hard ethical fence.

### F.6 Breakthrough Surface (new F-shape) (Area 2)

- **D-07: Build NEW F.6, do not reuse F.4.** F.4 maps content-to-user-actionable-observation. Phase 120 maps user-actions-to-recognition-of-user-own-work. Different speech acts. The verbs must reflect that.
- **D-08: F.6 verbs (5 options, locked verbatim).**
  - `[Explore deeper]` -- drills into the artifact pair or graph edges that triggered detection. The engagement option.
  - `[Confirm]` -- positive feedback signal; increases weight on similar patterns via per-detector-type `user_engagement_prior` in the scoring function (D-12).
  - `[File as decision]` -- bridges to Phase 88.2 decision-log machinery. F.6 emits a `breakthrough_filed_as_decision` event; the breakthrough becomes a first-class decision with audit trail (Canon Part 4 -- every choice is graph data).
  - `[Dismiss]` -- negative training signal; suppresses similar patterns via cooldown (D-13) and feeds the per-detector dismissal-rate canary (D-19).
  - `[Back]` -- standard navigation escape.
- **D-09: "File as decision" event bridge.** When user picks this option, F.6 emits `breakthrough_filed_as_decision` via `navigation.cjs::logMemoryEvent`. This is the wire that makes Phase 120 a Canon Part 4 contributor (the breakthrough becomes a typed graph edge, not just a celebration moment).
- **D-10: "Dismiss" is MANDATORY.** Without it the detector only learns from confirmations -- a classic engagement-optimizer failure where the loop drifts toward whatever the user accepts even if accuracy is degrading. Every fired breakthrough MUST have a dismiss exit, both as user control AND as training signal AND as Hooked-ethics protection.

### Render cadence + multi-fire policy (Area 3)

- **D-11: Surface TOP 1 by score; hold others in "More breakthroughs (N)" affordance.** Surface-all dilutes signal. Round-robin punishes timely high-value signal. Score-based top-1 with a count affordance preserves sharpness while not hiding work.
- **D-12: Scoring function (locked formula).**
  ```
  score = (confidence × 0.4)
        + (recency_decay × 0.2)        // half-life ~3 days
        + (differential × 0.2)         // how much this breakthrough stands out vs room baseline
        + (artifact_count_log × 0.1)   // log(N) of artifacts contributing
        + (user_engagement_prior × 0.1)// per-detector-type prior, updated from Confirm/Dismiss history
  ```
  Tunable via `config.json`; the weights are the documented defaults, not magic numbers.
- **D-13: Dismissed resurfacing.** 7-day cooldown MINIMUM, AND only if new artifacts have been added to the convergence. Time passing alone does NOT license resurfacing -- that is manipulation. Both conditions required.
- **D-14: Confirmed: once-only.** Never resurface as a breakthrough. Resurfacing what the user already accepted is patronizing.
- **D-15: Filed as decision: never resurface as breakthrough.** But reference in future related breakthroughs ("this builds on the X decision you filed on date Y"). The decision becomes load-bearing for future patterns.
- **D-16: Empty-state for new room: SILENCE.** A placeholder like "Your breakthroughs will appear here as patterns emerge" fails the Hooked ethics test because it implies the system has detected something when it has not. Trust users to notice the difference between presence and absence. The session-start hook does nothing in the empty-state case (no F.6 invocation, no statusline echo).

### Voice prescriptiveness + Hooked ethics fence (Area 4)

- **D-17: 4-rule voice scaffold (Larry has discretion within the scaffold).**
  1. **Evidence requirement.** Must cite the specific artifact pair or graph edges that triggered detection. No "you have been doing great work on X" without "(artifacts #N, #M)" or equivalent inline link.
  2. **Mechanism clause.** Must include the "by Y" component: what the user did to cause it. Anchors recognition to user action, not to system inference.
  3. **Time anchor.** "in the last 8 hours" / "across this week" / "since Tuesday." Prevents the failure mode where vague timing makes mundane work feel momentous.
  4. **No quantitative superlatives without backing.** No "breakthrough," "biggest," "first" unless the graph confirms (e.g., highest differential score in this room's history). Frequency words like "consistent" or "repeated" only with count evidence.
- **D-18: Hybrid ethics fence (4-tier).**
  - **HARD FLOOR -- code-enforced.** Every surfaced breakthrough must have provenance edges in the graph that a Cypher query can return. If `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact)` returns nothing, the breakthrough CANNOT surface. Period. Every fire is auditable from graph state.
  - **HARD CEILING -- auto-surface.** Confidence > 0.50 WITH full provenance auto-surfaces.
  - **SOFT BAND -- review queue.** Confidence 0.35-0.50 goes into a review queue; sample 20% manually each week to check for drift. These become retraining data.
  - **Below 0.35.** Stays in soft-fire buffer (D-01), never surfaces.
- **D-19: Per-detector dismissal-rate canary (additional guardrail).** Track per-detector dismissal rate over a 100-fire rolling window. If rate crosses 30%, auto-throttle that detector to soft-fire-only until manually reviewed. This is the user-telling-us-with-the-dismiss-button signal -- catches drift before it shows up in any other metric.
- **D-20: Meta-principle -- every breakthrough Cypher-provable.** Every decision in Phase 120 must be testable from graph state alone. If you cannot write a Cypher query that proves a breakthrough is real, it does not surface. This single principle resolves most edge cases in the voice rules (D-17), the threshold logic (D-01..D-06), and the cooldown policy (D-13..D-15).

### Claude's Discretion

- Phase 117 math-layer integration shape (event-subscription vs direct read vs shared dispatcher) -- planner picks the existing pattern in `lib/core/navigation/` that matches; precedent set by Phase 119 D-01 (direct call from auto-explore-fingerprint into a sibling action).
- Specific Cypher schema for the `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact)` provenance query -- planner verifies against the existing room.db schema and emits a new node type `Breakthrough` if not present, plus the `DERIVED_FROM` edge type if not present (additive extension per Phase 110-03 / 124 / 125-00 / 129 precedent).
- Review queue surface for SOFT BAND (D-18) -- planner picks between (a) a `.rooms/review-queue.db` SQLite fallback (precedent: Phase 119-01 rooms-meta.db), (b) a `.planning/review-queue/` directory of YAML files for manual review, or (c) extending memory_event with a review_status field; recommend option (a) for consistency with Phase 119-01.
- Session-start hook insertion order with Phase 119 (`detectNoActiveRoom`) and Phase 117 (`detectFirstMaterial`) -- planner verifies the ordering invariant: Phase 119 fires FIRST (room must exist before breakthroughs can scan it), Phase 117 fires SECOND (math layer must populate before breakthroughs derive from it), Phase 120 fires THIRD (consumes both).
- F.6 sub-shape registration with Phase 88.2 selector dispatcher -- planner adds F.6 to the F-shape enum, mirrors the F.1/F.4 implementation pattern, and emits the canonical envelope shape so CLI/Desktop/Cowork surfaces all render uniformly.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 120 substrate (deps; shipped)
- `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md` -- the navigation chokepoint Phase 120 reads through (room.db + Memory Event Log)
- `.planning/phases/117-auto-explore-domains-on-first-material/117-CONTEXT.md` -- the math layer that populates the patterns Phase 120 detects (whitespace + reverse-salient + cross-domain analogy)
- `.planning/phases/88.2-uiux-selector-block/88.2-CONTEXT.md` -- the F-shape selector primitive Phase 120 extends with F.6
- `.planning/phases/119-room-as-receipt-invariant/119-CONTEXT.md` -- the session-start hook ordering anchor (Phase 119 fires FIRST, Phase 120 fires THIRD)

### Phase 120 framing authority
- `docs/MINDRIAN-CANON.md` Part 10 sub-claim 5 (variable reward fires automatically; the math IS the surface)
- `docs/MINDRIAN-CANON.md` Part 2 Engine 1 (Act 1 intelligence; pattern detection over local graph)
- `docs/MINDRIAN-CANON.md` Part 4 (every choice is graph data -- "File as decision" makes breakthroughs first-class decisions with audit trail per D-09)
- `docs/MINDRIAN-CANON.md` Part 5 (evidence is graded by context -- D-17 evidence requirement + D-18 confidence bands map to the four tiers Academic/Operational/Practitioner/None)
- `docs/MINDRIAN-CANON.md` Part 8 (graph boundary -- D-20 Cypher-provable principle is the structural enforcement)
- `docs/CANON-PHASE-MAP.md` Part 10 row for Phase 120 (the contract this phase delivers against)

### Substrate / chokepoint (per Canon Part 9)
- `lib/core/navigation.cjs` -- the SQL chokepoint; ALL reads + writes route through this; D-20 Cypher-provable principle implements the Canon Part 9 invariant structurally
- `lib/core/navigation/memory-events.cjs` -- the typed event enum Phase 120 extends additively with breakthrough events (likely: `breakthrough_surfaced`, `breakthrough_confirmed`, `breakthrough_dismissed`, `breakthrough_filed_as_decision`, `breakthrough_throttled` for the D-19 canary)

### Hooked Model audit
- `docs/research/hooked-audit-2026-04-12.md` (if present) -- the dormant audit identifying the 6 reward categories A-F and the Variable Reward axis baseline 4/10; Phase 120 implements the seventh category G that moves the axis from 7/10 (post-Phase-117) to 9/10
- The Trigger Internal +3 movement comes from the breakthrough's first-person mirror-back: the user's own work is the trigger, no external content needed

## Existing Code Insights

### Reusable Assets

- **Phase 117 math layer** -- whitespace gaps, reverse-salient pairs, cross-domain analogy zones already populate room.db per Phase 117 D-01..D-NN. Phase 120 reads these as INPUTS to the four detectors; does NOT recompute the math.
- **Phase 88.2 F-shape dispatcher** -- the selector-block primitive that renders CLI/Desktop/Cowork uniformly. Phase 120 registers F.6 with this dispatcher; planner mirrors the F.1/F.4 pattern.
- **Phase 109 navigation.cjs chokepoint** -- the SQL gateway. Phase 120 reads via `findRecentChanges` + `getArtifactsByTheme` (planner verifies the exact API surface against the Phase 109 13-function contract).
- **Phase 119 session-start cascade** -- the orphaned-directive scanner pattern (`scripts/check-pending-naming-decision.cjs`). Phase 120 can mirror this shape for its own session-start hook (`scripts/check-pending-breakthrough.cjs` or similar).
- **Phase 90 BRAIN.md derivation pipeline** -- if breakthrough patterns feed BRAIN.md per-section governing thought hashes, the derivation pipeline already exists. Planner verifies whether breakthroughs need to update BRAIN.md or stay purely room-local.

### Established Patterns

- **Additive event-type extension** (Phase 110-03, 124, 125-00, 129, 119) -- Phase 120's new breakthrough_* event types ride this pattern. Object.freeze invariant preserved; size grows additively.
- **Tri-surface adaptation** (CLI / Desktop / Cowork) -- inherited from Phase 88.2; Phase 120 does NOT invent surface adaptation, registers F.6 with the existing dispatcher.
- **Two-tier firing with buffer** (NEW pattern introduced by Phase 120) -- soft-fire writes to a buffer for confirmation + retraining signal; hard-fire surfaces. Future phases may adopt this pattern for similar high-stakes detection surfaces.
- **Cypher provenance enforcement** (D-20) -- structural Canon Part 8 enforcement via query-must-return-result. This is the most generalizable pattern in the phase; future Brain-bordering surfaces should adopt it.

### Integration Points

- Phase 117 math-layer output (the inputs the 4 detectors consume)
- Phase 119 session-start cascade insertion point (Phase 120 fires AFTER Phase 119 detectNoActiveRoom AND AFTER Phase 117 detectFirstMaterial)
- Phase 88.2 F-shape dispatcher (Phase 120 registers F.6 there)
- Phase 88's decision-log machinery (D-09 "File as decision" emits the bridge event)
- `room.db` schema (new `Breakthrough` node type + `DERIVED_FROM` edge type added additively per planner discretion)

## Specific Ideas

The user's verbatim framing (2026-05-16 discuss-phase):

- "Every decision here should be testable from graph state alone. If you can't write a Cypher query that proves a breakthrough is real, it shouldn't surface. That single principle resolves most edge cases in the voice rules, the threshold logic, and the cooldown policy."
- "Surface-all when 3 of 4 detectors fire is anti-pattern -- dilutes signal, overwhelms attention. Highest-nutrition wins, but the scoring needs to be defensible, not vibes."
- "Dismiss is missing from your draft and that's the most important item. Without it the detector only learns from confirmations -- a classic engagement-optimizer failure where the loop drifts toward whatever the user accepts even if accuracy is degrading."
- "Trust users to notice the difference between presence and absence" (D-16 empty-state silence)
- "Time passing alone doesn't license resurfacing -- that's manipulation" (D-13)

The user explicitly rejected: surface-all multi-fire, round-robin, F.4 reuse, placeholder empty-state, template-locked voice, pure code-enforcement of ethics, pure manual-review of ethics. Each rejection is captured in the corresponding D-NN decision.

## Deferred Ideas

- **AI-driven retraining of detector weights** -- the per-detector dismissal-rate canary (D-19) is static for v1.13.0; ML-tuned weights from accumulated Confirm/Dismiss history deferred to v1.14.0. The data infrastructure (per-detector-type `user_engagement_prior` in D-12) is ready to feed this.
- **Cross-detector convergence** -- "convergence + contradiction-resolved on the same theme = super-breakthrough" treated as independent fires for v1.13.0. Revisit in v1.14.0 if real data shows correlation patterns that warrant a meta-detector.
- **Cross-room breakthroughs** -- "you cracked X in this room, you also did Y in another room" forbidden by Canon Part 8 cross-room aggregation fence. Never builds (constitutional, not deferred).
- **Streak / gamification UI** -- explicitly out of scope per Hooked ethics audit. Never builds (constitutional, not deferred).
- **AI-generated congratulations** -- "Larry says nice things about your work even when no real pattern fires" -- forbidden by D-20 Cypher-provable principle. Never builds (constitutional, not deferred).
- **Auto-throttle recovery surface** -- when a detector is throttled per D-19 to soft-fire-only, the surface that signals "this detector needs manual review" deferred to Phase 121 housekeeping (likely surfaces via `/mos:doctor --breakthrough-throttled` or in the v1.13.0 release housekeeping pass).

---

*Phase: 120-breakthrough-scan-category-g*
*Context scoped: 2026-05-16 via /gsd:discuss-phase (twenty decisions D-01..D-20 locked)*
*Pre-scoping stub: 2026-05-05*
