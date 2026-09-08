# Phase 318: SEED-061 - Skill-Optimization Smoke Calibration Reconciliation

## Domain

Fix the null-negative labeling bug SEED-061 names: a `should_not_trigger` eval query generated
with `expected_skill: null` sometimes has a real correct target skill elsewhere in the 124-skill
roster, and when the live funnel judge correctly routes it there, `classifySkills`'s flag rule
(`scripts/skillopt-funnel.cjs:339`) counts the correct routing as a TRAIN miss against the
unrelated skill under test, inflating the flag count with false alarms.

## Locked Scope (this phase, deliberately narrow)

This phase implements ONLY step 1 of SEED-061's four concrete next steps: the deterministic
labeling fix itself, offline-testable, zero live model calls required to prove it works.

**Explicitly deferred, NOT this phase's job** (per SEED-061's own step sequence and cost note):
- Step 2: re-labeling the 13-record `smoke-labels.json` against the now-visible full-roster
  collisions (deck/jtbd/explore-futures/explore-domains) - a human-judgment calibration pass,
  not a code fix.
- Step 3: re-running the 13-skill smoke (~$23-equivalent subscription usage per SEED-061's own
  cost note) - real subscription-quota spend, requires the same navigator opt-in framing
  SEED-061 itself insists on ("the fleet-run go/no-go conversation" language). Not spent here
  without that explicit go-ahead.
- Step 4: re-checking the D7 gate against the corrected labels and fixed negative-generation.

Closing this phase closes SEED-061's disclosed harness bug (the actual defect). Steps 2-4 stay
open as a follow-up that costs real subscription budget and navigator judgment calls this phase
does not make unilaterally.

## Decision: where the fix lives (deviation from the seed's literal file pointer)

SEED-061's own text names `scripts/skillopt-genqueries.cjs`, "the negative-generation step," as
the fix site. Tracing the actual architecture found a better, more natural fix point:

- `skillopt-genqueries.cjs` generates queries PER FAMILY (`buildFamilyVariable` shows each model
  spawn sees only its own family's sibling skills, by design - a deliberate cost/quality choice,
  not an oversight). The model that labels a negative `expected_skill: null` for family A
  genuinely cannot know family B exists. Fixing this at generation time would mean either
  restructuring per-family generation into a full-roster-aware single call (an architecture
  change well beyond this phase's scope) or bolting a second live-model call onto genqueries.cjs
  purely to re-check negatives (more subscription spend, exactly what this phase avoids).
- `skillopt-funnel.cjs`'s `enumerateQueries` (line 290) already reads every skill's generated
  query file into one array, roster-wide, BEFORE the funnel judge runs and BEFORE
  `classifySkills` applies the flag rule. This is the natural single point with full-roster
  visibility at exactly the right moment - no live call needed, pure data cross-reference over
  already-generated JSON.

**Decision: add the reconciliation pass to `enumerateQueries`'s output, in `skillopt-funnel.cjs`,
not to `skillopt-genqueries.cjs`.** Same bug, same seed, better fix site - discovered by tracing
the actual data flow rather than assuming the seed's file pointer was the precise line to edit.
Record this deviation plainly; it does not change what SEED-061 asked for.

## Decision: what "reconciliation" means, precisely (conservative, deterministic)

A `should_not_trigger` query with `expected_skill: null` is corrected to a real skill name ONLY
when its query text (whitespace/case normalized) is an EXACT match to a `should_trigger` query
registered under a DIFFERENT skill anywhere in the roster. No fuzzy/semantic matching - that
would require either a live judge call (subscription spend, explicitly deferred) or a heuristic
fragile enough to over-correct or under-correct in ways only a human should judge. A query with
no exact cross-roster match keeps `expected_skill: null` unchanged - the "bad negative" case
SEED-061 names as the alternative outcome, left as null rather than guessed at.

This means the fix closes the case SEED-061's own proving_case demonstrates concretely
(literal-duplicate negatives colliding with another skill's positive) without inventing a new,
unverified semantic-similarity mechanism this phase has no offline way to validate.

## Canonical Refs

- `.planning/seeds/SEED-061-skillopt-smoke-calibration-reconciliation.md` - the seed
- `.planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-07-CALIBRATION.md` - the proving case, lines 55-72 and 177-185 (the disclosed bug and SEED-061's own filing)
- `scripts/skillopt-funnel.cjs` - `enumerateQueries` (line 290, the fix's entry point), `classifySkills` (line 324, the flag rule this fix stops from false-alarming), `runSelftest` (line 511, the offline test harness this phase's own tests extend)
- `scripts/skillopt-genqueries.cjs` - `generateQueriesForFamily` (line 320), the per-family generation this phase does NOT modify, read only to confirm why the fix does not belong here
- `scripts/skillopt-eval.cjs` - `checkSmokeAgreement` (line 253), the D7 gate this phase's fix indirectly improves the input to, but does not itself touch (step 4, deferred)

## Deferred Ideas (out of this phase's scope)

- SEED-061 steps 2-4 (re-label smoke set, re-run 13-skill smoke at ~$23-equivalent subscription
  usage, re-check D7). Requires navigator go-ahead on the spend; not this phase's call.
- The full 124-skill fleet run (~$480-equivalent). Stays behind the navigator's own explicit
  multi-agent-orchestration opt-in per Phase 230's own CONTEXT.md, untouched by this phase.
- Any semantic/fuzzy cross-roster matching mechanism. Exact-match only, per the decision above.
