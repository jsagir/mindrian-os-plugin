---
phase: 183-meter-gate-exposure-transfer
plan: 02
subsystem: telemetry
tags: [meter, two-gauge, transfer, named-debt, part-5, part-8-local, navigation-chokepoint, subject-class]

# Dependency graph
requires:
  - phase: 183-01
    provides: gate_reached EVENT_TYPES member + lib/core/meter/gate-density-reader.cjs (Gauge 1)
  - phase: 158-reach-reject-reader
    provides: the reach-keyed pure-reader injection-seam idiom + the f_selector_decision reject substrate
  - phase: 109-sql-context-memory-navigation-spine
    provides: navigation.findRecentChanges chokepoint + the thin additive re-export idiom
  - phase: 123-install-lifecycle-harness
    provides: lib/core/resolve-brain-key.cjs (the active-key resolver used for subject_class)
provides:
  - lib/core/meter/transfer-reader.cjs (Gauge 2 SOURCE - three named-debt proxies)
  - lib/core/meter/two-gauge.cjs (the WELDED readTwoGauge - density+transfer pair or throws)
  - navigation.readTwoGauge (the one Part 9 door to the welded meter)
  - subject_class enum {maintainer|navigator|unknown} stamped on every reading (CORRECTION A)
  - transfer_uninstrumented third state, distinct from flat (CORRECTION B)
affects: [184-reader]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Welded read: the only export returns the density+transfer pair together or throws; no bare-density export (Pitfall 1 structural cure)"
    - "Named-debt proxy labelling on every transfer return (proxy_class:'named-debt') per Canon Part 5 honesty"
    - "subject_class derived read-time from a Part-8-clean one-way sha256 maintainer-key fingerprint seam + the existing dogfood-box marker; never stores/egresses the key"
    - "transfer_uninstrumented as a DISTINCT third state from flat; the regression guard licenses no verdict when the transfer substrate is empty"

key-files:
  created:
    - lib/core/meter/transfer-reader.cjs
    - lib/core/meter/two-gauge.cjs
  modified:
    - lib/core/navigation.cjs
    - tests/test-meter-two-gauge-weld.cjs

key-decisions:
  - "subject_class precedence: MINDRIAN_DOGFOOD_ROOM_DIR set -> maintainer; else a configured sha256 maintainer-key fingerprint matches the active key -> maintainer; fingerprint configured + active key present, no match -> navigator; otherwise unknown (never guess navigator)"
  - "quality_direction defaults to flat for a measured reading (METER cannot prove a transfer CLIMB without a Part-5 baseline), so the meter never declares a win on the named-debt proxies alone - the structural anti-engagement-machine guard; Phase 184 READER supplies the real direction"
  - "transfer_state = measured only when reject_total > 0 OR latency sample_count > 0; otherwise uninstrumented with transfer=null (never a fabricated zero)"
  - "Export the one latency reader under BOTH insightToValidatedDecisionLatency (plan contract) and insightToDecisionLatency (the floor pin import) so neither contract drifts"

patterns-established:
  - "Pattern: a Part-8-clean derived-scalar subject stamp via a one-way fingerprint seam (sha256 of the active key compared to a configured hash) - never the key, never a user id"
  - "Pattern: the welded read names BOTH single-direction regressions (volume-up-quality-flat Dealer + quality-up-by-starving-volume) in source so the floor test asserts them"

requirements-completed: [METER-02]

# Metrics
duration: 7min
completed: 2026-06-27
---

# Phase 183 Plan 02: METER Transfer + Welded Two-Gauge Read Summary

**The v1.19 welded two-gauge metric now exists at the telemetry layer: readTwoGauge returns Gauge 1 (invocation density) AND the Gauge-2 named-debt transfer source welded in one frozen object or throws - no bare-density path - stamped with a Part-8-clean subject_class (only `navigator` clears the entry-31 self-bind) and a transfer_uninstrumented third state distinct from flat, all zero Brain egress.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-27
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `lib/core/meter/transfer-reader.cjs` - the three named-debt Gauge-2 proxies, each reading LOCALLY via the Part 9 `navigation.findRecentChanges` chokepoint, each stamped `proxy_class:'named-debt'`, cold-starting safely, never throwing:
  - `rejectReasonCaptureRate` = COUNT(reject AND reason present) / COUNT(reject) over `f_selector_decision`, reading the PRESENCE of `properties.reason` only (the reason STRING is never echoed into a returned field). capture_rate is null on zero reject rows (honest cold-start; the dial does not write `f_selector_decision` in production today, ROADMAP:2846).
  - `insightToValidatedDecisionLatency` (+ `insightToDecisionLatency` alias) = median ms from each insight event (`reach_presented` / `auto_explore_finding_surfaced`) to the next `status_promoted` (the human-confirmed validated decision, Part 9 role 5).
  - `independenceTrend` = per-cycle invocation-density delta with the explicit "direction is not self-interpreting" caveat (falling density could be internalized method OR disengagement).
- `lib/core/meter/two-gauge.cjs` - the WELDED `readTwoGauge(db, sinceEpochMs, roomState)`: computes Gauge 1 and Gauge 2 in the same call, returns one frozen object carrying both halves, and THROWS rather than ever yielding a lone density. There is NO exported bare-density function. The two-directional regression guard names BOTH single-direction failures (`volume-up-quality-flat` = Dealer, `quality-up-by-starving-volume` = starved) as regressions.
- `navigation.readTwoGauge` - the thin additive re-export (mirrors `logMemoryEvent` / `writeEdge` / `getRoomContext`), the one Part 9 door to the welded meter.
- The full Phase-183 gate `bash tests/run-all-183.sh` is now 8/8 GREEN (the two Wave-1 RED pins pass), with the Part 8 grep-sweep clean and the reach-ids (6) + posture-ids (3) drift fences green.

## Final Review Corrections (both built in)

### CORRECTION A - subject_class stamp (maintainer vs navigator)
`readTwoGauge` stamps every reading with `subject_class`, an enum of `{ maintainer, navigator, unknown }`, derived AT READ TIME, Part-8-clean (a derived scalar enum; NEVER the key, NEVER a user identifier). Precedence:
1. `MINDRIAN_DOGFOOD_ROOM_DIR` set (the EXISTING maintainer/dogfood-box marker) -> `maintainer`.
2. a configured maintainer-key fingerprint (`MINDRIAN_MAINTAINER_KEY_SHA256`, the one-way sha256 hex of the maintainer key) matches `sha256(active key)` (resolved via the shipped `resolveBrainKey` helper) -> `maintainer`.
3. fingerprint configured + an active key present but no match -> `navigator` (positively a non-maintainer keyed live turn).
4. otherwise -> `unknown`. We do NOT guess `navigator` when no maintainer signal is resolvable - without a reference we cannot prove a reading is not the maintainer's, and the enum's correctness is load-bearing, so `unknown` is the honest default.

The source carries the required guard comment verbatim in spirit: "Only subject_class==navigator satisfies the entry-31 self-binding-clause precondition. A maintainer reading proves the instrument FIRES; it does NOT clear the self-bind." This is the structural guard against an entry-20-style override (the ~1287-request maintainer/dogfooding key reading masquerading as the navigator reading the clause named). The key itself is never stored or egressed - only a one-way sha256 fingerprint is compared.

### CORRECTION B - the transfer_uninstrumented THIRD state
`readTwoGauge` has three outcomes, not just "pair or throw":
1. the welded PAIR when the transfer substrate exists -> `transfer_state:'measured'`.
2. the pair with `transfer:null` + `transfer_state:'uninstrumented'` when the substrate is EMPTY (the f_selector_decision reject-capture / latency denominator cold-starts structurally empty on most production rooms) - NEVER a fabricated `transfer:0`.
3. THROW on a genuine welded-contract violation (a density assembled without the transfer slot present).

The two-directional regression guard treats `uninstrumented` as DISTINCT from `flat`: uninstrumented is NOT the Hooked Dealer regression and NOT the starving-volume inverse - it is no-instrument, which licenses NO regression verdict at all (`verdict:'transfer_uninstrumented'`). The source carries the comment: "A welded metric that cannot tell 'no quality' from 'no instrument' is blindfolded." The floor test asserts (a) no bare-density export, (b) the uninstrumented third state returns `transfer:null` + `transfer_state:'uninstrumented'` (not 0), and (c) `subject_class` present and one of the allowed enum values.

## Task Commits

1. **Task 1: the three named-debt Gauge-2 transfer proxies** - `cf2f2865` (feat)
2. **Task 2: the welded two-gauge read + navigation.readTwoGauge door** - `607738fe` (feat)

_TDD note: the Wave-1 RED pins (test-meter-transfer.cjs, test-meter-two-gauge-weld.cjs) served as the RED gate; each task turned its pin green (the GREEN gate). The floor pin was extended in Task 2 with the CORRECTION A/B assertions._

## Files Created/Modified
- `lib/core/meter/transfer-reader.cjs` (created) - the three named-debt Gauge-2 proxies.
- `lib/core/meter/two-gauge.cjs` (created) - the welded `readTwoGauge` + subject_class + transfer_state.
- `lib/core/navigation.cjs` (modified) - the thin additive `readTwoGauge` re-export (+ its require).
- `tests/test-meter-two-gauge-weld.cjs` (modified) - extended with the CORRECTION A/B assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Latency reader name mismatch between the plan contract and the floor pin**
- **Found during:** Task 1.
- **Issue:** The plan's artifacts list names the latency proxy `insightToValidatedDecisionLatency`, but the Wave-1 RED pin (`tests/test-meter-transfer.cjs`) imports `insightToDecisionLatency`. Honoring one name would leave the other contract broken.
- **Fix:** Export the one reader under BOTH names (`insightToValidatedDecisionLatency` as primary, `insightToDecisionLatency` as an alias).
- **Files modified:** `lib/core/meter/transfer-reader.cjs`.
- **Commit:** `cf2f2865`.

**2. [Rule 3 - Blocking] Part 8 grep-sweep tripped by the literal token `brain-client` in two-gauge.cjs comments**
- **Found during:** Task 2.
- **Issue:** The plan's action text says "import no packet.cjs / brain-client"; writing that literal into the header tripped the run-all-183.sh Part 8 sweep (which greps `lib/core/meter/*.cjs` for `brain-client` and is NOT a full-line-comment-stripped match for block-comment lines).
- **Fix:** Reworded to "no Brain client module" (a space, not the hyphenated token) in both two-gauge.cjs and the navigation.cjs re-export comment. Semantics unchanged; the sweep is clean (net_hits 0).
- **Files modified:** `lib/core/meter/two-gauge.cjs`, `lib/core/navigation.cjs`.
- **Commit:** `607738fe`.

## Deferred Issues (out of scope - SCOPE BOUNDARY)

**DI-183-01: `tests/test-158-reach-orchestrator-pure.cjs` fails (pre-existing).** Confirmed failing at `c9d7c860` (before any Plan-02 work). The purity assertion requires `dial-reach-orchestrator.cjs` to have exactly one require, but it also requires `../core/act-jtbd-blurb.cjs` - a file unrelated to METER and not in any Plan-02 file's require graph. NOT fixed here. Logged in `deferred-items.md`. The Phase-183 gate is 8/8 green; this is a Phase-158 maintenance item.

## Known Stubs

None that block the plan goal. The `transfer_uninstrumented` state is NOT a stub - it is the honest reading of a structurally-empty transfer substrate (the dial does not write `f_selector_decision` in production today, ROADMAP:2846), and the welded read reports it as a distinct state rather than a fabricated zero. capture_rate=null and the uninstrumented verdict are correct, honest cold-start readings, not placeholders.

## Authentication Gates

None.

## Canon Compliance
- **Part 5 transfer honesty:** all three proxies carry `proxy_class:'named-debt'` and the module header states none is a real transfer DELTA - METER is the Gauge-2 SOURCE/instrument. The welded read defaults `quality_direction` to `flat` for a measured reading (it refuses to declare a win without a real Part-5 transfer delta), the structural anti-engagement-machine guard.
- **Part 8 LOCAL-only:** the grep-sweep over `lib/core/meter/` returns zero network tokens (`fetch|http|curl|brain.mindrian|tavily|brain-client`); the meter makes zero Brain calls and imports no packet.cjs / Brain client. The reject `reason` STRING is never echoed into a returned field (capture-rate reads presence only). subject_class never stores or egresses the key - only a one-way sha256 fingerprint comparison.
- **No new frozen-set member:** Plan 02 adds reader/derivation modules ONLY. No new reach / posture / node / edge type. The reach-ids (6) + posture-ids (3) drift fences are green.
- **Frozen render contracts untouched:** MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, `appendAskUserQuestionTrailer` - the meter only READS; it changes nothing about what is offered.
- **No em-dashes** (hyphens only) in code, comments, or commits.

## Next Phase Readiness
- The welded read is the instrument Phase 184 READER's R1 A/B test consumes. The entry-31 self-binding clause (no Appendix D entry 32 until a real two-gauge reading from a LIVE NAVIGATOR on the gate) is now satisfiable structurally: `readTwoGauge` returns the pair and stamps `subject_class`, so a reading whose `subject_class === 'navigator'` clears the self-bind while a `maintainer` reading does not.
- Manual verification (per 183-VALIDATION.md) remains: a live conversational turn that fires a reach, then a `readTwoGauge` over the room confirming the pair returns and `subject_class` reads correctly. On a real external navigator's box (no dogfood marker, no fingerprint configured) `subject_class` reads `unknown` by design; to positively read `navigator`, the maintainer must configure `MINDRIAN_MAINTAINER_KEY_SHA256` so a non-matching key is provably non-maintainer.

## Self-Check: PASSED

All created files exist on disk (transfer-reader.cjs, two-gauge.cjs) and both task commits are present in git history (cf2f2865, 607738fe). The Phase-183 gate is 8/8 green.

---
*Phase: 183-meter-gate-exposure-transfer*
*Completed: 2026-06-27*
