# Phase 230 Plan 07: Smoke Calibration Verdict

**Date:** 2026-07-18
**Scope:** LIVE end to end on the 13-record approved smoke set only (smoke-labels.json). No full 124-skill spend. No Workflow-tool orchestration. Both remain deferred behind Jonathan's explicit opt-in.

This document is the calibration verdict you decide from. It reports what the harness
actually did on your approved smoke set, computed by code against your pre-labels, so the
future full-fleet go / no-go is made on evidence, not on a self-declared pass. Read the
agreement table first, then the detector and code-review proofs, then the price.

---

## Headline: the judge does NOT yet agree with your pre-labels

**Funnel-vs-manual agreement: 30.0% (3 of 10 labeled skills). Tolerance: 85%. Result: FAIL (D7 run gate).**

The D7 hard run gate is the rule that says: do not spend the ~800-1,000-call fleet run until
the cheap judge roughly matches your manual expectation on a known set. On this smoke set it
does not. `checkSmokeAgreement` (deterministic code, reading the live artifacts against your
locked labels) returns 30%. The gate is red. The honest reading is below, because the raw 30%
overstates how wrong the judge is.

### Agreement table (computed, every skill, mismatches named)

| Skill | Role | You labeled | Funnel got | Match |
|-------|------|-------------|------------|-------|
| doctor | clear_fire | pass | flagged | XX |
| deck | clear_fire | pass | flagged | XX |
| find-connections | near_miss_pair | flagged | pass | XX |
| find-analogies | near_miss_pair | pass | pass | ok |
| explore-domains | near_miss_pair | pass | flagged | XX |
| explore-trends | near_miss_pair | flagged | flagged | ok |
| explore-futures | near_miss_pair | pass | flagged | XX |
| explore-opportunity | near_miss_pair | pass | flagged | XX |
| pipeline | weak_description | flagged | flagged | ok |
| jtbd | good_description | pass | flagged | XX |
| splash | not_evaluated_probe | not_evaluated | not_evaluated | ok (probe) |

Agree: find-analogies, explore-trends, pipeline. Plus the probe landed correctly.
(rooms and status carry no funnel label; their live verdicts are both flagged, shown for
completeness in the merged report, not scored here.)

### Why the raw 30% overstates the disagreement (three separate causes, not one bad judge)

1. **The funnel is catching REAL full-roster near-misses your isolated pre-labels could not
   see.** You labeled each skill judging it alone. The judge scores every query against all
   124 skills at once, which is the whole point of the funnel, and it routes to genuine
   competitors you did not have in view: deck -> `MOSDeckEngine`, doctor "room dashboard" ->
   `dashboard`, jtbd "what should I work on next" -> `suggest-next`, explore-futures
   "scenario planning" -> `scenario-plan`, explore-domains "emerging trends" -> `macro-trends`.
   These are not judge errors. They are the collisions the funnel exists to expose. On these,
   your pre-label was optimistic, not the judge wrong.

2. **A query-generation labeling artifact inflates the flag count.** Many `should_not_trigger`
   negatives were generated with `expected_skill = null`, but they actually have a correct
   target skill somewhere in the 124-roster. When the judge correctly routes such a negative
   to that real target (predicted != null), the flag rule scores it as a train miss on the
   skill under test. So some flags are an artifact of null-labeled negatives, not a real
   description defect. This is a harness-labeling issue to fix before the fleet run, not a
   description problem.

3. **A transport confound on doctor (does NOT change its verdict).** 4 of doctor's / deck's
   funnel units timed out (`deck-7`, `doctor-0/1/2`) during the congested early passes when
   the background job was repeatedly reaped and restarted. A not_evaluated unit flags its
   skill. doctor also had 1 genuine miss, so doctor flags with or without the timeouts, but
   the timeouts are noise on top. See the not-evaluated honesty section.

**What this means for your verdict:** the judge is stricter than your pre-labels, and most of
that strictness is defensible (real collisions). But 30% is still below tolerance, and two
fixable harness issues (null-labeled negatives, the transport timeouts) sit inside the number.
The correct next step is your call: re-label the smoke set against the full roster you have now
seen, fix the null-negative labeling, and re-run the smoke, OR accept that these descriptions
genuinely collide and treat the flags as real work. Either way, the fleet run does not launch
on a 30% gate.

---

## Detector re-proof (D7 detector leg, both directions, FRESH live captures)

The real-fire detector reads a genuine Skill fire out of `stream-json --verbose` JSONL (never
the json envelope, which has no reliable tool trace). Both directions proven on new captures
made this run:

| Capture | Query | fired | invoked |
|---------|-------|-------|---------|
| out/captures/doctor.jsonl | "run the doctor to diagnose my MindrianOS install ..." | true | mos:doctor |
| out/captures/offtopic-weather.jsonl | "what is the current weather forecast in Paris tomorrow" | false | (none) |

The firing capture invoked `mos:doctor` through the MCP methodology tool (`input.command`),
matching the Plan 03 pinned `SKILL_FIRE_TOOL` / `SKILL_INPUT_FIELD`. The off-topic query fired
nothing. The detector works in both directions on live bytes.

---

## Code-quality review (WS2, D4, both directions PROVEN)

| File | Role | Expected | Result |
|------|------|----------|--------|
| scripts/check-card-fire.cjs | ws2_defect (skill: rooms) | a finding on the over-enforcement class | 1 CONFIRMED (medium) |
| scripts/mos-status.cjs | ws2_clean (skill: status) | zero confirmed findings | 0 findings |

**The defect was caught.** The reviewer found, and the adversarial refute pass CONFIRMED, this
finding on check-card-fire.cjs:

> The BACKSTOP regex arm `[1] ... [2]` matches ordinary assistant prose that contains bracketed
> numeric citations or footnotes on one line, so a normal turn like "see sources [1] and [2]"
> is classified as an un-fired Decision Gate and gets blocked and force-re-prompted
> (over-enforcement on prose with no real decision present).

Verbatim evidence quote (anchored as a real substring of the file by deterministic code, D4):
`/\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|.../i`

This is exactly the over-enforcement class you logged three times (the 2026-07-05 todo:
gate/card firing on content with no real decision present). WS2 found it systematically.

**The clean control stayed clean.** mos-status.cjs produced zero findings. The adversarial
pass did not invent a defect on a file with no known defect (the D4 false-positive guard).

**Survival-rate note (read this before trusting the number):** survival rate is 100% (1
confirmed, 0 refuted). At n = 1 that is NOT a rubber-stamping signal, it is just a single
finding that happened to survive. The real anti-false-positive evidence here is the clean
control returning zero findings, not the survival ratio. At fleet scale, watch the survival
rate for a 0%-refuted-across-many pattern (the AI-SPEC rubber-stamping alert).

---

## No-silent-skip honesty (D5)

- **Reconciliation holds:** spawned 97 = ok 92 + not_evaluated 5 (checked by code on the live
  unit ledger, not the pipeline's own tally).
- **The induced probe is honest:** splash's single unit landed `not_evaluated` with reason
  `induced_probe`, and splash's skill-level verdict is `not_evaluated`, never absorbed as a
  pass. (Probe construction note in the deviations of the SUMMARY.)
- **4 real transport timeouts, surfaced not hidden:** `deck-7`, `doctor-0`, `doctor-1`,
  `doctor-2` timed out during the congested early passes and are recorded as `not_evaluated`
  (reason `timeout`), never counted as passes. Real not-evaluated rate excluding the probe is
  4 / 96 = 4.2%, just under the ~5% halt threshold. These are a smoke-environment artifact
  (the background job was reaped and resumed several times), not a skill problem, and they do
  not change any labeled skill's verdict.

---

## The price of the deferred fleet run (measured, not guessed)

Every number below is the mean of the REAL smoke envelopes, multiplied by the AI-SPEC fleet
volumes. The single most important cost finding: a judge call over the full 124-skill roster
costs about **$0.17**, not the cents the AI-SPEC assumed, because the prompt cache does not
persist across the hermetic (`--no-session-persistence`) spawns, so each call re-pays the
~50k-token roster+rubric as cache-creation.

| Bucket | Smoke mean/call | Fleet volume | Fleet projection |
|--------|-----------------|--------------|------------------|
| Funnel judge | $0.174 (n=92) | ~900 calls | ~$156 |
| Real trigger-test loop | $0.287 (n=2 captures) | ~900 calls | ~$259 |
| Code review (opus) | ~$1.50 (est, n=3) | ~30 calls | ~$45 |
| Query generation | $0.195 (n=9) | ~102 families | ~$20 |
| **Total** | | | **~$480** |

Smoke run actual spend: about **$23** (funnel $16.0, genqueries $1.8, captures $0.6, review
~$4.5 est). Full details in `out/smoke/projection.json`.

Note on the review estimate: the three opus review/refute calls ran live and produced the real
findings above, but the pipeline was completed through manual resume drivers (see the SUMMARY
deviations), so the individual review envelopes were not persisted to unit records; the $1.50
mean is an estimate from observed opus behavior, flagged as such in projection.json.

---

## DEFERRED (restated so the next session cannot miss it)

The full 124-skill run and any Workflow-tool / multi-agent orchestration are DEFERRED. They do
NOT launch now, and they do NOT launch on this verdict. They remain a separate future step
behind Jonathan's explicit multi-agent-orchestration opt-in (CONTEXT.md Execution mechanism
decision + Deferred Ideas). This plan built and smoke-tested the harness; it never triggers the
paid fleet run. On the current 30% agreement the fleet run is specifically NOT recommended
until the smoke calibration is reconciled (re-label against the full roster and fix the
null-negative labeling, then re-run the smoke).

---

## Navigator verdict (2026-07-18)

**"Calibrated -- close Phase 230 as-is, fleet run stays a separate future decision."** The mechanism proofs (bidirectional detector on fresh live captures, WS2 independently re-discovering the real check-card-fire.cjs defect while the clean control stayed clean, honest-degrade/reconciliation holding, nothing writing to a real file) are accepted as sufficient to close the phase. The 30% D7 number is accepted as informative, not blocking -- most of the gap is real full-roster collisions the isolated pre-labels could not see plus one disclosed harness labeling bug (null-negative queries), not a mechanism failure.

The reconciliation work (fix the null-negative labeling in `skillopt-genqueries.cjs`, re-label the smoke set against the now-visible full-roster collisions, re-run the 13-skill smoke, re-check D7) is captured as **SEED-061** (`.planning/seeds/SEED-061-skillopt-smoke-calibration-reconciliation.md`) rather than re-opening this phase or blocking its closure. The full 124-skill fleet run remains deferred behind the navigator's own explicit opt-in either way -- untouched by this verdict, and re-scoped to a subscription-usage framing (not a dollar cost) per the correction also made this session.

## Artifacts

- out/funnel/funnel-results.json (13 skills, reconciliation holds)
- out/funnel/units/ (97 unit records)
- out/queries/ (14 per-skill eval-query sets; splash trimmed to the single probe query)
- out/captures/doctor.jsonl, out/captures/offtopic-weather.jsonl (fresh detector captures)
- out/review/findings.json (1 CONFIRMED), out/review/findings-raw.json, out/review/units/
- out/report/skillopt-report.md + report.json (the first real merged report, STOP-gated)
- out/smoke/projection.json (the priced fleet estimate)
