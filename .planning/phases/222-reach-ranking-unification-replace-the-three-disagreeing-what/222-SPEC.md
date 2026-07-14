# Phase 222: Reach ranking unification -- Specification

**Created:** 2026-07-14
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** 7 locked (Req 7 added 2026-07-14, same-session, after re-examining this phase against every finding from the game-theory-toolbox research thread -- see Requirement 7 and its Background note)

## Goal

When more than one reach candidate fires on a turn, the reach `suggest_next` returns, the
reach `reach_candidates` lists first, and the reach `resolveFireSkill` auto-fires all
become the SAME pick, and that pick is the one the existing D4 score (already computed by
`lib/hmi/dial-reach-orchestrator.cjs` via `lib/workflow/f-selector-ranker.cjs`) plus a new,
hand-rolled, outcome-learned adjustment would rank highest -- not simply whichever
candidate happens to sit first in `SENSOR_REGISTRY`'s canonical order.

## Background

Verified this session, file:line, against `/home/jsagi/dev/MindrianOS-Plugin` at commit
`fb995e83` (v1.15.3-beta.19):

- `lib/core/insight-sensors.cjs` `dispatchSensors` (:611-699) runs every sensor in
  `SENSOR_REGISTRY`'s fixed order and returns ALL non-null candidate reaches, in that
  order, with no score attached. This detection layer is correct and stays as-is -- it
  answers "did anything fire this turn," which is out of scope to rebuild (see Boundaries).
- `lib/core/navigation-engine.cjs` `resolveFireSkill` (:588-612) takes
  `sensorReaches[0]` -- literally the first array element -- as "the top reach," with an
  inline comment claiming registry order mirrors priority. No score is consulted.
- `lib/mcp/tools/sensors.cjs` `dispatchCandidateReaches` (:97-105) calls `dispatchSensors`
  directly and returns its raw array. `suggest_next` (:132-155) returns `reaches[0]`;
  `reach_candidates` (:157-172) returns the full unranked array. These are the exact MCP
  tools available to any client (including this session) -- both are on the unscored path.
- `lib/hmi/dial-reach-orchestrator.cjs` `buildReachList(roomState)` is a SEPARATE, already
  real, already-scored path: it applies the D4 blend (`ranker.rankForSelector`, the
  `0.40*brain_confidence + 0.30*(1-recency_decay)*investment_level +
  0.30*problem_type_bind*investment_level` formula, `f-selector-ranker.cjs:47-52,87`), the
  frozen recommend gate (score >= 0.70, margin < 0.15), and is already a consumer of
  `lib/workflow/reach-reject-reader.cjs`'s Phase-158 outcome-based reject penalty. It is
  called from `scripts/intent-classifier.cjs`, `lib/hmi/cortex-reach-adapter.cjs`, and
  others -- almost certainly what renders the CLI's own interactive reach cards. It is
  NOT called by `resolveFireSkill` or by either MCP sensors tool.
- `lib/workflow/offer-closer.cjs::closeOffer` (Phase 159) already persists real
  accept/reject outcomes to room.db. This is the reward signal a learned adjustment needs;
  it exists today and needs no new data collection.
- Same-session deep-research (107-agent fan-out, 2026-07-14) found no actively-maintained,
  permissively-licensed (MIT/Apache/BSD), native-dependency-free open-source library for
  multiplicative-weights/Hedge, Thompson-sampling bandits, Shapley value, or mechanism-
  design/auction algorithms suitable for this Node.js CJS codebase. Verdict: hand-implement
  directly against room.db, reading (not vendoring) River's `ThompsonSampling` class,
  `benedekrozemberczki/shapley`'s exact-enumeration method, and `vcg-auction.py` as algorithm
  references during porting, plus Arora-Hazan-Kale (2012) for the Hedge/MWU pseudocode.
- `strategic_rank` on whitespace zones (`scripts/compute-whitespace-gaps.py:302-304`,
  `1.0 / (i + 1)` positional-by-default, RS-bottleneck-boosted when matched) scores a
  DIFFERENT node type (WhitespaceZone, not reach candidates) and is explicitly OUT of
  this phase's scope -- captured instead in SEED-057
  (`synthesis-as-votable-expert-graph-native-game-theory`), which generalizes the
  expert-voting frame this phase builds to include candidate-*producing* experts, not
  just candidate-ranking ones. SEED-057 is deliberately deferred until this phase ships
  and is observed working.

## Requirements

1. **`suggest_next` and `reach_candidates` return the scored pick, not registry order.**
   - Current: `dispatchCandidateReaches` (`lib/mcp/tools/sensors.cjs:97-105`) returns
     `dispatchSensors`' raw array; `suggest_next` returns element `[0]`; `reach_candidates`
     returns the array unranked.
   - Target: when N>1 candidates fire on a turn, the array `reach_candidates` returns is
     ordered by the combined score (D4 blend + this phase's outcome adjustment, see
     Requirement 3), highest first; `suggest_next` returns that same top-ranked candidate.
     When exactly 0 or 1 candidate fires, behavior is unchanged (nothing to rank).
   - Acceptance: a fixture turn where >=2 sensors fire with distinct D4 scores returns
     them in score order (not registry order) from both tools; a fixture turn with 0 or 1
     firing candidate is byte-identical to today's output.

2. **`resolveFireSkill`'s auto-fire decision uses the same scored pick.**
   - Current: `resolveFireSkill` (`lib/core/navigation-engine.cjs:588-612`) maps
     `sensorReaches[0]` (registry order) to a canonical verb.
   - Target: `resolveFireSkill` maps the SAME top-ranked candidate Requirement 1 produces
     to a canonical verb -- one selection logic, two consumers, not two.
   - Acceptance: a fixture turn where the registry-order-first candidate and the
     highest-scored candidate differ produces a `fire_skill` verb matching the
     highest-scored candidate, not the registry-order one. A regression fixture confirms
     the Wicked-escalation precedence (:591-597, outranks any sensor reach) and the
     dead-Brain / empty-array degrade path (:582-585) are both untouched.

3. **A hand-rolled multiplicative-weights (Hedge) layer adjusts the D4 score from
   real outcomes, learned per-room.**
   - Current: the D4 blend's three weights (0.40 / 0.30 / 0.30) are static; Phase 158's
     reject-penalty discounts/suppresses but does not reweight the blend's components
     relative to each other.
   - Target: a new, dependency-free module treats {the D4 blend, the raw sensor-registry
     signal} as two weighted experts; weights update via the standard Hedge multiplicative
     rule (Arora-Hazan-Kale 2012) from Phase 159's existing outcome log (accept =
     low-loss, reject = high-loss for whichever expert's pick was shown); the combined,
     weight-blended score is what Requirements 1-2 consume. No new data collection, no
     new egress, room-local only (Part 8).
   - Acceptance: unit test constructs a synthetic outcome sequence where one expert is
     consistently right; after N updates (N env-tunable, default matches this repo's
     existing debounce convention, e.g. Phase 158's window) that expert's weight is
     strictly greater than the other's, and the combined score's argmax matches the
     consistently-right expert's pick for a held-out fixture turn.

4. **Zero new dependencies.**
   - Current: N/A (nothing built yet).
   - Target: `package.json` gains no new entries; all Requirement 3 logic is pure CJS
     against Node built-ins and this repo's own existing modules
     (`navigation.findRecentChanges`, room.db).
   - Acceptance: `git diff package.json package-lock.json` is empty after this phase's
     plans land; a CI grep tripwire (matching this repo's existing 5-tripwire pattern,
     e.g. Phase 90's) fails the build if any new `require()` target outside
     `node:*` or this repo's own `lib/`/`data/` trees appears in the new module(s).

5. **Frozen selector scalars are provably untouched.**
   - Current: `MAX_K=3`, `DIAL_REACH_K=6`, and the `0.70`/`0.15` recommend-gate constants
     are frozen elsewhere in this codebase (Part 3 canon; multiple prior phases assert
     "untouched").
   - Target: this phase changes HOW candidates are scored and weighted; it does not read,
     write, or parameterize any of the four frozen constants.
   - Acceptance: `tests/run-all-222.sh` includes a byte-diff regression leg (mirroring
     `test-148-frozen-contracts.cjs` / `test-205-frozen-six-guard.cjs`'s existing pattern)
     asserting `MAX_K`, `DIAL_REACH_K`, `RECOMMEND_FLOOR` (0.70), and `MARGIN_THRESHOLD`
     (0.15) are byte-identical to their pre-phase values.

6. **Reachability is proven, not assumed.**
   - Current: this codebase has a known failure class of "shipped but never wired" (Phase
     150.5 found 5 of 8 production sensors structurally dead on the live hook path despite
     passing tests).
   - Target: an end-to-end fixture proves the new scored path is what a live call to
     `suggest_next` / `reach_candidates` (via the MCP tool, not a unit-level function call)
     and a live call to the per-turn engine decision actually return -- not dead code
     sitting beside the old path.
   - Acceptance: `tests/run-all-222.sh` includes a reachability leg that drives
     `suggest_next` and `reach_candidates` through the real MCP tool registration (not a
     bypassed internal call) against a fixture room with >=2 firing sensors and asserts
     the returned order matches Requirement 1's acceptance check; a second leg does the
     same for `resolveFireSkill`'s `fire_skill` output.

7. **A failed weight-state read degrades visibly, never silently.** (added 2026-07-14,
   after re-examining this phase against SEED-059, filed same session)
   - Current: N/A -- Requirement 3's Hedge layer and its room.db side-table do not exist
     yet, so there is no degrade behavior to audit today. This requirement exists so the
     NEW code does not introduce the exact failure class this session's own QA-incident
     synthesis found three independent times (`.planning/debug/intern-qa-silent-degrade-
     pattern-three-independent-sessions-2026-07-14.md`, commit `a71e3f7f`; SEED-059).
   - Target: if the weight-state side-table is missing, corrupt, or unreadable when
     `rankFiredCandidates` needs it, the combiner falls back to the D4 blend alone
     (weights = equal/neutral), NOT a crash and NOT a silent wrong ranking -- and the
     fallback is recorded as a structured, checkable signal (a `memory_event`, e.g.
     `reach_weight_state_unavailable`, per SEED-059's proposed shape: a real signal a
     future audit can grep for, not just a caught exception). This is deliberately the
     SAME discipline SEED-059 asks for in general, applied narrowly to this phase's own
     new surface, not a rebuild of SEED-059 itself.
   - Acceptance: a fixture that deletes/corrupts the weight-state table before a
     `suggest_next` call still returns a valid ranked result (the D4-only fallback, not an
     error, not a hang); the same fixture asserts a `reach_weight_state_unavailable`
     memory_event was written; a fixture with a healthy table asserts NO such event fires
     (the signal is honest, not emitted unconditionally).

## Boundaries

**In scope:**
- Wiring `suggest_next`, `reach_candidates`, and `resolveFireSkill` onto one shared,
  scored selection (Requirements 1-2).
- A new, dependency-free multiplicative-weights adjustment layer, room-local, learned
  from the existing Phase 159 outcome log (Requirement 3).
- `run-all-222.sh` test harness with reachability and frozen-scalar regression legs
  (Requirements 5-6).
- Visible, disclosed degrade behavior for the new weight-state read, per SEED-059's
  fallback-disclosure discipline applied narrowly to this phase's own surface (Requirement 7).

**Out of scope:**
- SEED-009's full cross-tester gradient-descent learned ranker -- stays dormant at its
  own gate (>=30 testers AND >=1000 outcome edges, currently ~4 testers). This phase's
  combiner is room-local only and makes no claim toward that gate.
- `strategic_rank` / whitespace zone scoring -- a structurally separate candidate type
  (WhitespaceZone, not reach candidates); captured in SEED-057, deliberately deferred.
- SEED-057's synthesis-triggering expert (voting to CREATE a candidate, not rank one) --
  needs this phase's combiner built and observed first.
- Any new Brain egress -- this phase reads/writes room.db only (Part 8 boundary).
- Rebuilding or modifying individual sensor detection logic in `insight-sensors.cjs` --
  only the ranking/selection layer downstream of `dispatchSensors`'s existing output.
- Periodic Shapley-value attribution reporting (proposed in this session's conversation
  as a companion interpretability tool) -- genuinely useful but not required for
  Requirements 1-6 to be true; if pursued, it is a read-only offline report over the same
  outcome log and can land as a fast-follow without touching the hot path this phase
  modifies. Flagged here so it isn't silently forgotten, not committed as a requirement.
- Version numbering for the release this ships under -- `scripts/release.sh`'s job at
  ship time, not a spec-phase concern.

## Constraints

- Zero new npm dependencies (Requirement 4); CJS only, no TypeScript, no Python.
- The frozen Shape-F selector scalars (`MAX_K=3`, `DIAL_REACH_K=6`, `0.70`/`0.15`) are
  read-only inputs to this phase's logic, never modified (Requirement 5).
- Part 8 Graph Boundary: the multiplicative-weights layer is room-local; weight state
  is never aggregated across rooms and never enters a Brain Context Packet.
- Hot-path budget: this phase's new scoring/weighting logic runs inline in the per-turn
  path (`resolveFireSkill`, `suggest_next`), so it must stay within the existing per-turn
  budget class this codebase already enforces elsewhere (e.g. the sub-5ms sensor budget
  cited in the opportunity-harvest formula's A2) -- no embedding calls, no network I/O,
  no new synchronous file reads beyond what `dispatchSensors`/`dial-reach-orchestrator`
  already perform.

## Acceptance Criteria

- [ ] `suggest_next` and `reach_candidates` return candidates in combined-score order,
      not `SENSOR_REGISTRY` order, when >1 candidate fires (Req 1)
- [ ] `resolveFireSkill`'s `fire_skill` output matches the same top-ranked candidate
      (Req 2)
- [ ] A synthetic-outcome unit test shows the Hedge weight layer correctly upweights the
      consistently-right expert over N updates (Req 3)
- [ ] `git diff package.json package-lock.json` is empty; CI dependency-tripwire passes
      (Req 4)
- [ ] `tests/run-all-222.sh` frozen-scalar byte-diff leg passes for `MAX_K`,
      `DIAL_REACH_K`, `RECOMMEND_FLOOR`, `MARGIN_THRESHOLD` (Req 5)
- [ ] `tests/run-all-222.sh` reachability legs pass for both MCP tools and
      `resolveFireSkill` via real registration, not bypassed internal calls (Req 6)
- [ ] A corrupted/missing weight-state fixture still returns a valid D4-only ranked
      result and emits `reach_weight_state_unavailable`; a healthy-table fixture emits
      no such event (Req 7)
- [ ] `bash tests/run-all-222.sh` exits PASS with 0 FAIL, 0 SKIP

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                      |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | OK     | Single measurable behavior: one shared scored pick, 3 consumers |
| Boundary Clarity   | 0.90  | 0.70 | OK     | Whitespace/SEED-009/SEED-057/Brain-egress/sensor-rebuild all explicit out-of-scope |
| Constraint Clarity | 0.85  | 0.65 | OK     | Zero-deps evidence-backed this session; frozen scalars named; hot-path budget stated |
| Acceptance Criteria| 0.82  | 0.70 | OK     | 7 requirement-level + 7 phase-level pass/fail checks (Req 7 added same session) |
| **Ambiguity**      | 0.13  | <=0.20| OK    |                                                              |

Status: OK = met minimum. No dimension below minimum this pass. Req 7's addition did not
raise ambiguity -- it is a direct, low-ambiguity application of an already-filed seed
(SEED-059) to this phase's own new surface, not a fresh open question.

## Same-session re-examination (2026-07-14, post-filing)

After the seed-corpus curation pass and SEED-059's filing, this phase was re-checked
against every finding from the session, not just the eureka-reliability angle checked
earlier. Per-cluster verdict:

- **Eureka-reliability (SEED-034/058/039/027/029/026):** No effect on this phase, confirmed
  twice now. This phase's three data sources (`roomState.reachScores`, `dispatchSensors`'
  turn/ctx signals, Phase 159's `navigation.cjs`-routed outcome log) are all independently
  verified to never touch the room.db content-graph path SEED-034 diagnosed as broken.
- **Reach-ranking / learning-loop (SEED-057/008/009/002/055/056/054-BQ):** SEED-057 stays
  correctly deferred (needs this phase's combiner built and observed first, per its own
  trigger). SEED-009 stays out of scope (its own 30-tester/1000-edge gate, unrelated to this
  phase's room-local design). No change.
- **New sensors shipped since this phase's SPEC was written (SENS-13 eureka-bridge / Phase
  213, SENS-14 opportunity-harvest / Phase 219, SENS-15 url-ingest / Phase 220):** checked
  whether these introduce reach types needing new D4 priors -- they do not. All three fire
  EXISTING frozen `reach_id`s (`deep_research`, `context_block`), which already carry
  calibrated `roomState.reachScores` entries; the score is per-reach-id, not per-sensor, so
  newly added sensors inherit an already-established prior rather than defaulting to the
  uncalibrated 0.5 floor. No change needed to this phase's design.
- **Gate-firing / false-success (SEED-059):** the one genuine hit. Requirement 7 (above) is
  the direct result -- this phase's own new surface (the weight-state read) is exactly the
  shape of thing SEED-059 says has no disclosure convention yet; adding the requirement now,
  while building the surface, is cheaper than retrofitting it after SEED-059's own broader
  convention (if ever built) would otherwise have to reach back into this phase's code.
- **Already-shipped-but-unmarked findings (SEED-013/024/025/041/049/050 status corrections;
  SEED-053 already shipped as `chain_run`/`gate_answer`):** none touch this phase's scope.
  `chain_run` operates one layer downstream of this phase (executing a chosen reach's chain),
  not the selection layer this phase modifies -- adjacent, not overlapping.

Net effect: Requirement 7 added, nothing else changes. The phase's core wiring-fix framing
holds.

## Interview Log

Conducted as a same-session --auto pass: ambiguity was resolved through direct code
verification (not a live Socratic round) after an earlier framing (three disagreeing
rankers, treat as one build-from-scratch combiner) was corrected mid-session by tracing
actual callers rather than trusting a first-pass research summary. Key decisions locked
across the conversation, reconstructed here as the interview record:

| Round | Perspective     | Question / check                                    | Decision locked                                                        |
|-------|-----------------|-------------------------------------------------------|--------------------------------------------------------------------------|
| 1     | Researcher      | What exists today for reach ranking?                 | Two paths: unscored `dispatchSensors`-order (feeds MCP tools + auto-fire) vs. already-scored `dial-reach-orchestrator` (feeds CLI dial, already has Phase 158 outcome-penalty wired in) |
| 2     | Simplifier      | Is a whole new combiner needed?                       | No -- reuse the existing D4 score; only add a small Hedge weight layer on top; net-new is a wiring fix + ~50-100 lines, not a new ranking system |
| 3     | Boundary Keeper | Does `strategic_rank` belong in this phase?            | No -- different node type (WhitespaceZone), spun out to SEED-057 rather than diluting this phase's boundary |
| 3     | Boundary Keeper | Does the synthesis-triggering-expert idea belong here? | No -- needs this phase's combiner built and observed first; captured as SEED-057, explicitly gated on this phase shipping |
| 4     | Failure Analyst | What's this codebase's known failure mode for "shipped but unwired" work? | Phase 150.5's 5-of-8-dead-sensors finding -- Requirement 6 (reachability proof via real MCP registration, not internal calls) exists specifically to prevent a repeat |
| 4     | Failure Analyst | Should a library be vendored for the game-theory math? | No -- same-session deep-research (107 agents) found no maintained, permissively-licensed, native-dep-free option for any of the four algorithm families; hand-roll, cite references only |
| 5     | Seed Closer     | Version numbering / release timing?                    | Explicitly out of scope for SPEC -- `scripts/release.sh`'s job at ship time |

---

*Phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what*
*Spec created: 2026-07-14*
*Next step: /gsd-discuss-phase 222 -- implementation decisions (exact wiring point for the shared selection, Hedge update cadence, room.db schema for weight state)*
