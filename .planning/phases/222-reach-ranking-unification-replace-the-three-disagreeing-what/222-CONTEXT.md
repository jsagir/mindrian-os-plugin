# Phase 222: Reach ranking unification - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

When more than one reach candidate fires on a turn, `suggest_next`, `reach_candidates`,
and the per-turn engine's auto-fire decision (`resolveFireSkill`) all resolve to the
same, real-scored pick, and a new hand-rolled multiplicative-weights layer adjusts that
score from live outcome data. This phase clarifies HOW to implement what SPEC.md already
locked; it does not revisit WHAT or WHY.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked** (updated 2026-07-14, two same-session focus passes after
this CONTEXT.md was first written: Req 7 added, Req 1 tightened with the real
`buildReachScoresFromCortex`/`cortexNodes` mechanism -- this section re-synced to match).
See `222-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `222-SPEC.md` before planning or implementing. Requirements
are not duplicated here.

**In scope (from SPEC.md):**
- Wiring `suggest_next`, `reach_candidates`, and `resolveFireSkill` onto one shared,
  scored selection, via `buildReachScoresFromCortex(ctx.cortexNodes || [])` -- the same
  function the CLI path already calls -- ranking only the turn-fired subset
  (Requirements 1-2).
- A new, dependency-free multiplicative-weights adjustment layer, room-local, learned
  from the existing Phase 159 outcome log. On the MCP call path specifically (no cortex
  nodes threaded in, D4 flat at 0.5 for every candidate), this adjustment is the ONLY
  differentiator between candidates, not an optional enhancement (Requirement 3).
- `run-all-222.sh` test harness with reachability and frozen-scalar regression legs
  (Requirements 5-6).
- Visible, disclosed degrade for the new weight-state read (missing/corrupt table falls
  back to D4-alone, never silently wrong, logs `reach_weight_state_unavailable`) --
  directly applies SEED-059's fallback-disclosure finding to this phase's own new
  surface (Requirement 7).

**Out of scope (from SPEC.md):**
- SEED-009's full cross-tester gradient-descent learned ranker.
- `strategic_rank` / whitespace zone scoring (captured in SEED-057).
- SEED-057's synthesis-triggering expert.
- Any new Brain egress.
- Rebuilding or modifying individual sensor detection logic in `insight-sensors.cjs`.
- Periodic Shapley-value attribution reporting (fast-follow candidate, not required).
- Threading real `cortexNodes` into the MCP tool call path (`buildSensorInputs`) so the
  D4 score is fully brain_confidence-anchored rather than the flat 0.5 floor -- a
  separate, later concern; this phase unifies ranking logic, not what feeds it.
- Version numbering for the release this ships under.

</spec_lock>

<decisions>
## Implementation Decisions

All four decisions below were auto-selected in `--auto` mode from recommendations
grounded directly in this session's code verification (not blind defaults). Each is
logged with the alternative considered and why it lost, per the audit requirement.

### Wiring point for the shared scored selection (Req 1-2)

- **D-01:** A new, pure function (working name `rankFiredCandidates(sensorReaches,
  roomState)`) in a new module owns the shared selection. It takes `dispatchSensors`'
  already-fired candidate array (a turn-dependent SUBSET of the 6 canonical reaches,
  detection logic untouched per SPEC boundaries) and ranks just those candidates using
  the same D4 inputs `dial-reach-orchestrator.cjs` already computes from
  `roomState.reachScores`. `resolveFireSkill` (`navigation-engine.cjs:588-612`) and
  `dispatchCandidateReaches` (`lib/mcp/tools/sensors.cjs:97-105`) both call this new
  function instead of taking `sensorReaches[0]` or the raw array.
- **Why not modify `dial-reach-orchestrator.cjs` directly:** it assumes a fixed
  universe of all 6 canonical reaches (`buildReachList(roomState)`), scored via
  session-level priors, not a turn-dependent fired subset. Forcing that assumption to
  also handle "rank only these N that fired this turn" would either break its existing
  6-reach contract (used by the CLI dial, multiple existing tests reference it, e.g.
  `test-dial-reach-orchestrator.cjs`, `test-148-frozen-contracts.cjs`) or require a
  parallel code path inside the same file, which is worse than a small new module.
- **Why not modify `insight-sensors.cjs`'s detection logic:** explicitly out of scope
  per SPEC.md Boundaries; detection (does X fire this turn) and selection (which fired
  candidate wins) are different concerns and this phase touches only the latter.

### Weight-state persistence (Req 3)

- **D-02:** Weight state lives in a small room.db side-table (NOT a parallel graph),
  following the precedent SEED-009 itself already proposes for exactly this class of
  problem (`.planning/seeds/SEED-009-learned-ranker-weights-from-outcome-edges.md`,
  "Schema additive: `ranker_weights` table in room.db... NOT a parallel graph; a side
  table that the ranker reads at score-time"). Atomic tmp+rename writes, matching the
  jtbd-state atomic-file model already used elsewhere in this codebase. Reads go through
  `navigation.findRecentChanges` per the Part 9 chokepoint discipline SEED-009 also
  names. Enum/scalar properties only, no freeform text, per the same Part 8 constraint
  SEED-009's Agent-A review already established for this exact kind of table.
- **Why not a new bespoke persistence pattern:** Part 7 (reuse-before-build) plus a
  directly-applicable, already-reviewed precedent sitting in this same repo's seed
  system. Inventing a different shape here would create two divergent patterns for the
  same problem class the day SEED-009 itself eventually ships.

### Hedge weight update cadence (Req 3)

- **D-03:** Updates are bounded, not per-event, mirroring Phase 158's existing debounce
  discipline (`lib/workflow/reach-reject-reader.cjs`'s reject-count window pattern) and
  SEED-009's own stated bound ("at most once per N events, e.g. N=50, to avoid thrash").
  Exact N ships as an env-tunable default (recommend N=50 as the starting point, matching
  SEED-009's own precedent number, not a freshly-invented one), re-derivable without a
  code change, consistent with this codebase's house rule of shipping thresholds as
  env-tunable rather than hardcoded (per the rethinking-mindrianos opportunity-harvest
  formula's identical practice for its own tunables, e.g. `DUP_T`, `MINDRIAN_HARVEST_COOLDOWN_MS`).
- **Why not update on every single outcome event:** thrash risk (a single noisy outcome
  swinging the weights, then correcting, then swinging again) with no accuracy benefit
  at this data scale, per the same reasoning Phase 158 and SEED-009 already applied to
  the adjacent penalty/weight-update problem.

### Test harness structure (Req 5-6)

- **D-04:** `tests/run-all-222.sh` mirrors the existing `tests/run-all-209.sh` /
  `tests/run-all-158.sh` structure (both confirmed present in this repo), not a new
  harness shape. Reachability legs (Req 6) follow the Phase 213-03 "born-wired proof"
  pattern already used elsewhere in this codebase (drive the real MCP tool
  registration and the real per-turn engine call, not a bypassed internal function
  call) specifically because this codebase has a documented failure class of exactly
  that gap (Phase 150.5: 5 of 8 production sensors were structurally dead on the live
  hook path despite all tests passing at the unit level).

### Claude's Discretion

None of the four decisions above were left open as "you decide, unconstrained" -- each
had a single evidence-backed recommendation from this session's code verification and
was auto-selected on that basis, logged above with the rejected alternative and why.
The genuinely open items (exact N for the debounce window beyond "matches SEED-009's
precedent," the specific room.db column names for the weight side-table) are ordinary
planner/researcher territory, not navigator judgment calls -- deferred to
`/gsd-plan-phase 222`, not captured here as a locked decision.

### Reviewed Todos (not folded)

Three pending todos matched Phase 222 by keyword score >= 0.4 via
`todo.match-phase`, reviewed and NOT folded (none are substantively about reach
ranking; folding them would be scope creep against SPEC.md's boundary, not a
legitimate phase-222 decision):

- `2026-07-08-f7-rescope-212-213-against-registercapability.md` (score 0.9) -- about
  Phases 212/213 (eureka substrate) re-planning against `registerCapability`; keyword
  overlap ("plan," "phases," "mindrianos," "room") is coincidental, not topical.
- `2026-06-28-ignite-persona-card-under-shows-frozen-role-blend-vocabulary.md`
  (score 0.6) -- an `/mos:ignite` persona-card display bug, unrelated to reach ranking.
- `2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md`
  (score 0.6) -- command-registration drift detection; adjacent domain (registry/
  F-shape) but a different failure class than this phase's ranking-selection problem.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/222-reach-ranking-unification-replace-the-three-disagreeing-what/222-SPEC.md` -- Locked requirements, boundaries, acceptance criteria. Read first.

### Prior art this phase reuses (Part 7)
- `.planning/seeds/SEED-009-learned-ranker-weights-from-outcome-edges.md` -- the
  `ranker_weights` room.db side-table pattern (D-02) and the N=50 debounce precedent
  (D-03) this phase follows; SEED-009 itself stays dormant/out of scope, only its
  already-reviewed schema/cadence pattern is reused.
- `.planning/seeds/SEED-057-synthesis-as-votable-expert-graph-native-game-theory.md`
  -- the sibling seed this phase's combiner is the substrate for; explicitly deferred,
  not in scope, but documents why Requirement 3's expert-weighting design should stay
  general enough for a future fourth expert class rather than hardcoding "exactly two
  experts" in a way that would need re-architecting later.

### Research grounding (this session, file:line verified)
- `lib/workflow/f-selector-ranker.cjs:47-52,87` -- the D4 scoring formula and `MAX_K=3`.
- `lib/core/insight-sensors.cjs:611-699` -- `SENSOR_REGISTRY` / `dispatchSensors`.
- `lib/core/navigation-engine.cjs:588-612` -- `resolveFireSkill`.
- `lib/mcp/tools/sensors.cjs:97-172` -- `dispatchCandidateReaches`, `suggest_next`,
  `reach_candidates`.
- `lib/hmi/dial-reach-orchestrator.cjs` (full file) -- the existing scored path
  (`buildReachList`, the frozen 0.70/0.15 recommend gate, `DIAL_REACH_K=6`).
- `lib/workflow/offer-closer.cjs::closeOffer` (Phase 159) -- the existing outcome log.
- `lib/workflow/reach-reject-reader.cjs::computeReachPenalties` (Phase 158) -- the
  existing crude penalty this phase's Hedge layer supersedes/subsumes, not duplicates.

### Zero-dependency verdict (this session, 107-agent deep-research pass)
- No separate doc yet -- findings are inline in `222-SPEC.md`'s Background section and
  this file's Decisions. Porting references only, never dependencies: River's
  `ThompsonSampling` class, `benedekrozemberczki/shapley`'s exact-enumeration method,
  `vcg-auction.py`, Arora-Hazan-Kale (2012) for the Hedge/MWU pseudocode.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/workflow/f-selector-ranker.cjs::rankForSelector` -- the D4 blend; this phase's
  new ranking function calls this rather than reimplementing scoring math.
- `lib/hmi/dial-reach-orchestrator.cjs`'s score-resolution helpers (`_resolveReachScore`,
  `_d4SignalFloor`) -- read as reference for how `roomState.reachScores` is consumed;
  the new module should follow the same read pattern, not diverge.
- `lib/workflow/reach-reject-reader.cjs::computeReachPenalties` -- Phase 158's existing
  outcome-based penalty; the new Hedge layer should compose with or supersede this
  cleanly, not run as a second, uncoordinated adjustment on top.
- `navigation.findRecentChanges` -- the Part 9 chokepoint for reading outcome-log data;
  the Hedge layer's weight-update trigger reads through this, never room.db directly.

### Established Patterns
- Atomic tmp+rename file/table writes for room-local adaptive state (jtbd-state model,
  SEED-009's proposed `ranker_weights` table) -- this phase's weight persistence follows
  this pattern.
- Env-tunable thresholds with documented defaults, never hardcoded and never silently
  carried across changes to the underlying scoring model (the opportunity-harvest
  formula's `DUP_T`/`MINDRIAN_HARVEST_COOLDOWN_MS` precedent; also this repo's own
  cross-embedder threshold-recalibration rule).
- `run-all-<phase>.sh` test harness shape, offline-runnable, no network/model downloads.
- Reachability-proof-over-unit-test discipline for anything touching the sensor/reach
  dispatch seam, direct consequence of the Phase 150.5 dead-sensor incident.

### Integration Points
- `resolveFireSkill` (`navigation-engine.cjs:588-612`) -- replaces its `sensorReaches[0]`
  line with a call to the new ranking function.
- `dispatchCandidateReaches` (`lib/mcp/tools/sensors.cjs:97-105`) -- replaces its direct
  `dispatchSensors` passthrough with a call to the same new ranking function before
  `suggest_next`/`reach_candidates` consume the result.
- Phase 159's outcome-write path (`offer-closer.cjs::closeOffer`) -- the Hedge layer's
  weight-update trigger reads from whatever this already writes; no new write site.

</code_context>

<specifics>
## Specific Ideas

No UI/visual specifics -- this phase is a backend ranking/selection change with no new
user-facing surface. The navigator's specific asks, captured verbatim in spirit:
"make sure the infrastructure is strong and there will be relevant harness that will
make it work properly" (Req 5-6, D-04) and "dynamically resolve instead of just decide"
(the entire Requirement 3 premise -- weights adapt from outcomes rather than being a
second hand-picked constant).

</specifics>

<deferred>
## Deferred Ideas

- **Periodic Shapley-value attribution reporting** -- genuinely useful companion
  interpretability tool, explicitly named a fast-follow candidate in SPEC.md, not
  required for this phase's acceptance criteria. Revisit once the Hedge layer has real
  outcome history to attribute.
- **`strategic_rank` / whitespace formula fix, and the synthesis-triggering expert** --
  captured fully in SEED-057, deliberately deferred until this phase ships and is
  observed working, plus at minimum SEED-058 (eureka reasoning-mode fallback) per
  SEED-057's own dependency-risk finding.
- **SEED-034 / SEED-058 (eureka engine reliability)** -- surfaced this session from an
  unrelated intern-QA incident; not this phase's concern directly, but SEED-057 (which
  extends this phase's combiner) is blocked on at least SEED-058 shipping first. Noted
  here so a future reader of this phase's history isn't surprised by the cross-reference.

### Reviewed Todos (not folded)
See `<decisions>` above -- three todos reviewed, none folded, reasons given inline.

</deferred>

---

*Phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what*
*Context gathered: 2026-07-14*
