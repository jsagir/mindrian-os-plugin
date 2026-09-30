---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 12
subsystem: research-planner
tags: [quick-run, verdict, evidence-card, escalation, cache-first, floor-ledger, d-03, d-04, d-07, d-16]

requires:
  - phase: 363-03
    provides: typed OpenAlex failures, envelope meta (count, cost, remaining, x_query)
  - phase: 363-04
    provides: fetchSourceCached('openalex-v2', ...) with counts carried in the cache
  - phase: 363-05
    provides: Plan and RunResult schemas, validatePlan, validateRunResult, planHash, BUDGETS
  - phase: 363-06
    provides: checkPyramid, rollUp, opportunityCandidates
  - phase: 363-08
    provides: query families, qHash, slotTerms
  - phase: 363-09
    provides: grants, validateExecutedQuery, appendAudit
  - phase: 363-11
    provides: recordsIndex, validateRows, deterministicTermRows, renderRowCitation
provides:
  - lib/core/research-planner/verdict.cjs - GAP_COUNT_FLOOR, VERDICTS, computeQuickVerdict, answerLine
  - lib/core/research-planner/quick.cjs - runQuick, evidenceCard, escalateToDeep, localRoomCheck
  - data/floor-ledger.json - 12 disclosed budget and floor rows
  - tests/test-363-run-quick.cjs - 18 checks (Q1-Q15 plus load, net guard, fetch restore)
affects: [363-13, 363-14, 363-15, 363-16, 363-17, 363-18, 363-20]

tech-stack:
  added: []
  patterns:
    - "Grant check for every search runs as a pre-pass before the first fetch, and again just before each fetch"
    - "Verdict is a fixed-order rule; a planned search that never ran counts as failed, never as zero hits"
    - "Cache-first through the one exported fetchSourceCached; a pre-363 cache entry without a count is a miss"
    - "Run state written atomically under <room>/.mindrian/research-runs/<run_id>/"

key-files:
  created:
    - lib/core/research-planner/verdict.cjs
    - lib/core/research-planner/quick.cjs
    - tests/test-363-run-quick.cjs
  modified:
    - data/floor-ledger.json

key-decisions:
  - "runQuick(roomDir, plan, opts): opts = {grant?, fetchEnvelopeFn?, rowsProvider?, budgetMs?, now?, trigger?, recordInLedger?}. fetchEnvelopeFn is the INNER corpus function taking {source:'openalex', query, limit}; runQuick maps the cache source 'openalex-v2' to provider 'openalex' around it. Default inner is fetchCorpusEnvelope."
  - "Grant lookup: a run grant for the plan's run_id first, else the newest standing grant. A caller-supplied opts.grant wins."
  - "Every planned search is validated before the first fetch; any re-ask returns {status:'reask', reason, query_index, card (F.0), proposal, new_terms} with zero fetches and zero audit records."
  - "Verdict extra guard: gap-confirmed additionally requires that no validated row supports the covered-elsewhere leaf (a row that shows the zone covered elsewhere beats a low count); settled requires the covered-elsewhere leaf to have support with no contradiction, otherwise the run falls through to contested or thin."
  - "Whitespace governing_status follows the computed verdict (gap-confirmed strengthened, settled weakened, contested split, thin and unresolved unresolved) instead of the raw roll-up, because in the gap tree a supporting row means the zone IS covered."
  - "A search that hits a spent OpenAlex budget (blocked, spend_limit_exceeded, or budget_exhausted in the envelope) stops the run with stop_reason budget; a slow fetch is raced against the remaining budgetMs and stops it with stop_reason time (audit outcome failed, failure_class network_timeout). Other failures do not stop the run."
  - "Ledger: runQuick records a navigator-started run in the run ledger; for trigger ambient it does NOT (363-09 contract: the ambient caller records at start, so counting again would double-count toward the hourly throttle). opts.recordInLedger overrides."
  - "escalateToDeep carries the quick run's audited round-one strings as plan.seed.quick_queries and clears leaf.queries so the deep composer (363-13) builds the deep set; perspective and pyramid are byte-identical clones; new run_id, version 1, revision 0, parent_plan_hash = planHash(quick plan)."
  - "A plan whose q does not hash to its q_hash is refused before any fetch (q_hash_mismatch); a query without slot_terms reads the owning leaf slots so the new-term ask cannot be skipped by omission."

patterns-established:
  - "Test seam: the replay fetch is swapped into globalThis.fetch only inside the injected fetchEnvelopeFn for the duration of one corpus call; the net guard stays installed otherwise and is asserted restored"

requirements-completed: [DRP363-09]

duration: ~75min
completed: 2026-09-29
---

# Phase 363 Plan 12: Quick research run with a code-computed verdict Summary

**A quick research run now checks the grant for every search before fetching, reads OpenAlex cache-first, validates hash-anchored rows, computes a verdict in code where a provider failure can never read as a gap, and hands back an evidence card that offers "run deep on this?" exactly once when the answer is thin or contested.**

## PLAN_BASE

`7420a241b828bc58d105f5688cda10abdbd7f05d`

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | c279bdb2f | tests/test-363-run-quick.cjs (16 failing checks before the modules existed) |
| 2 + 3 GREEN | 711f9ca18 | lib/core/research-planner/verdict.cjs, quick.cjs, data/floor-ledger.json, tests/test-363-run-quick.cjs (Q15 sweep fix) |
| follow-up | 10e0ada8d | lib/core/research-planner/quick.cjs (deep seed carries the audited strings) |

All are ancestors of HEAD (`git merge-base --is-ancestor`).

## What was built

### verdict.cjs

`const GAP_COUNT_FLOOR = 3;` (disclosed default, re-measured in 363-20), frozen `VERDICTS`, `computeQuickVerdict({queries, planned, rows, leaves, template})` returning `{verdict, plurality_ran, primary_count, cover_count, floor, reasons[]}`, and `answerLine(verdictResult, {rows})`.

Order: unresolved (any needed search failed, blocked, not run, or without a count; a whitespace plan with no primary search is unresolved) then gap-confirmed (primary and synonym cover both ran, both counts at or below the floor, nothing supports the covered-elsewhere leaf) then settled then contested then thin. Non-whitespace templates skip gap-confirmed and settle on "a leaf has support and no contradiction". The answer line names every number with "OpenAlex exact-phrase count" and never uses praise words.

### quick.cjs

- `runQuick` shape: `{status:'done', run, card, state_dir}`; `{status:'reask', reason, query_index, card, proposal, new_terms}`; `{status:'refused', reason, ...}` (plan_invalid, not_quick, plan_<status>, pyramid_<status>, no_fetch_queries, cap_exceeded, q_hash_mismatch, audit_write_failed, run_result_invalid, state_write_failed).
- Every executed search appends one 23-key audit record with outcome ok, empty_valid, failed, blocked or cache_hit (cache hit carries the cached count and cost 0).
- `localRoomCheck(roomDir, terms)` returns `{flagged, artifact_count, artifacts[{section, path}], terms_checked}`: fs only, canonical section folders, md and html, skips dot-directories (so `.mindrian` is never opened) and symlinks, capped at 400 files of 256 KB.
- `evidenceCard(run, plan)` returns `{shape:'evidence', title, question, options (2 or 3), body_md, payload}`. Options: "Review what to file (nothing is filed yet)", "Run deep on this" (thin or contested only), "Not now". One body line reads "Run deep on this?".
- `escalateToDeep(plan, run)` is pure and returns a deep plan that passes `validatePlan`.

### RunResult as shipped

All 26 `RUN_KEYS` of 363-05 plus one extra key `verdict_detail: {plurality_ran, primary_count, cover_count, floor, reasons}`. `queries[]` entries: `{leaf_id, leaf_ids, template_id, family, role, q, q_hash, round:1, outcome, failure_class, count, cost_usd, latency_ms, cache_hit, result_count}`. `grant_ref: {grant_id, lifetime, version}`. `records_path` is room-relative. `timings: {total_ms, budget_ms, per_query[], not_run[]}`. `filed` is always false. `escalation_offer` is `{text:'run deep on this?', kind:'deep_seed', plan_hash}` or null. State files: `plan.json`, `records.json` (records with content_hash, q_hash, leaf_ids), `rows.json` (rows and dropped), `run.json`, `card.json`.

### Per-leg replay routes (search shape: primary = no operator, cover = " OR ", prior = " AND (")

| Leg | primary | cover | prior | Result |
|-----|---------|-------|-------|--------|
| Q1 | gap_primary_zero | gap_primary_zero | gap_primary_zero | gap-confirmed, 3 audit records, literature_gap candidate |
| Q2 | gap_primary_zero | synonym_hits | gap_primary_zero | settled (deterministic synonym row supports L2) |
| Q3 | contested_rows | gap_primary_zero | gap_primary_zero | contested (model rows support and contradict L1) |
| Q4 | SENTINEL_429_BUDGET | gap_primary_zero | gap_primary_zero | unresolved, stop_reason budget, audit failed / http_error |
| Q5 | 500, timeout, network | gap_primary_zero | gap_primary_zero | unresolved each |
| Q6 | body without meta.count | gap_primary_zero | gap_primary_zero | unresolved |
| Q9 | gap_primary_zero | synonym_hits | prior_review_two | second run: 0 calls, 3 cache_hit records |
| Q12 | prior_review_two | synonym_hits | gap_primary_zero | thin (rows provider returns none), escalateToDeep seed |
| Q13, Q15 | contested_rows or gap_primary_zero | synonym_hits | gap_primary_zero or prior_review_two | card and Part 8 sweeps |

### Floor ledger

Twelve rows appended by string splice (pure addition, 156 inserted lines, 0 removed): the eleven `research-planner-plan.*` budget constants and `research-planner-verdict.GAP_COUNT_FLOOR`, each `disclosed`, `dependent_outputs ["research_run"]`, bare-name `line_anchor`. `node scripts/check-floor-ledger.cjs --check` passes (51 rows, 0 unresolved).

## Verification

- `node tests/test-363-run-quick.cjs`: PASS 18, FAIL 0 (Q1-Q15, module load, net guard zero attempts, global fetch restored to the guard), exit 0.
- `node scripts/check-floor-ledger.cjs --check`: exit 0.
- `grep -c "^const GAP_COUNT_FLOOR = 3;" lib/core/research-planner/verdict.cjs`: 1.
- `git diff` of data/floor-ledger.json shows 0 removed lines.
- No em-dash or en-dash literal in verdict.cjs, quick.cjs or the test (byte-level grep; the normalizers use `\u2014` and `\u2013` escapes).
- Not run (out of plan scope, per brief): the tests/run-all-* aggregators.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test sweep counted the fixture room's own room.db**
- **Found during:** Task 2 (Q15 markerHits 1)
- **Issue:** the fixture seeds the planted marker into `.mindrian/room.db` claims on purpose; the sweep walked every file under `.mindrian/`.
- **Fix:** the sweep skips `room.db*` (the room's local store) and checks everything the run itself wrote.
- **Files modified:** tests/test-363-run-quick.cjs
- **Commit:** 711f9ca18 (the RED commit's test file changed in the GREEN commit)

**2. [Rule 1 - Bug] Literal dash characters materialized in source on write**
- **Found during:** Task 3 verification (byte-level grep)
- **Issue:** the `[\u2014\u2013]` escapes in the noDash helpers landed as literal characters.
- **Fix:** restored to escape form before commit.
- **Files modified:** verdict.cjs, quick.cjs
- **Commit:** 711f9ca18

**3. [Rule 2 - Missing critical] Budget stop and extra verdict guards**
- Stop the run on a spent OpenAlex budget (Q4 asserts stop_reason budget), a pre-363 cache entry without a count is refetched, q/q_hash mismatch and missing slot_terms are guarded, and gap-confirmed refuses when a row shows the zone covered elsewhere. All are recorded under key-decisions.

**4. [Scope note] DRP363-09 marked complete, DRP363-07 already checked, DRP363-11 left open**
- DRP363-09 names only this plan and is fully delivered (one offer, seed from perspective, pyramid and audited strings, no auto-escalation). DRP363-07 was already checked by 363-11. DRP363-11 also names 363-14 (the yes-gated writes), so it stays open.

Plan text said "recordRun in the run ledger" unconditionally; runQuick records navigator runs only (see key-decisions) to keep the ambient throttle count correct.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-363-03 (unresolved first, Q4-Q6), T-363-07 (grant check before every fetch, Q7-Q8 show zero calls), T-363-10 (3-search cap, 5-record cap, time budget, grant caps), T-363-11 (card files nothing, `filed` false) and T-363-01 (only composed q strings fetch, Q15 sweep of audit, URLs, card and run files) are mitigated as planned.

## Downstream contract notes

- 363-13 (deep): reuse `localRoomCheck`, `evidenceCard` conventions and the audit fields; call `escalateToDeep` output as the deep plan seed (`plan.seed.quick_queries` holds the audited quick strings, `leaf.queries` is empty and must be composed and reviewed). The deep controller should also run its grant check as a pre-pass before the first fetch, as `runQuick` does.
- 363-14 (filing): read `<room>/.mindrian/research-runs/<run_id>/{plan,records,rows,run,card}.json`; `rows.json` has `{rows, dropped}`; every row carries `content_hash`; `run.opportunity_candidates` and `run.local_checks` are ready; `run.filed` is false until 363-14 files on the F.8 yes.
- 363-15/17 (CLI, MCP): a `reask` result carries the F.0 `card`, `proposal` and `new_terms`; on approval call `writeGrant` or `extendTerms` and rerun. Pass `fetchEnvelopeFn` only in tests; pass `rowsProvider({records, leaves, queries, plan})` to supply model rows (return `[]` for none); omit it for the deterministic no-model path. The `research_run` tool builds plans through the 363-15 facade, which must attach `queries` (with `q_hash`, `role`, `slot_terms`, `audit:'pass'`, `round:1`) to researchable leaves; `runQuick` accepts at most 3 distinct round-one searches across all OpenAlex leaves.
- 363-16/18 (ambient): pass `trigger:'ambient'`; record the run at start with `recordRun` yourself (runQuick does not record ambient runs) and `throttleState` gates the start. With no model, omit `rowsProvider`.
- Roles the verdict reads: `primary` (ws.exact), `falsifier_covered_elsewhere` (ws.synonym_cover); leaf dimensions `ws:gap_claim`, `ws:covered_elsewhere`, `ws:extraction_failure` (corpus `room`).
- Whitespace `run.governing_status` follows the verdict, not the raw roll-up; other templates use the roll-up.
- The whitespace-quick test plan is built inline in tests/test-363-run-quick.cjs (`makePlan`); 363-15 should own the real assembly path and 363-20 can lift that helper if it wants a shared fixture.
- tests/run-all-363.sh was not changed by this plan; add test-363-run-quick.cjs to it when the aggregator is next touched (363-20).

## Self-Check: PASSED

- FOUND: lib/core/research-planner/verdict.cjs, lib/core/research-planner/quick.cjs, tests/test-363-run-quick.cjs, floor-ledger rows.
- Commits c279bdb2f, 711f9ca18 and 10e0ada8d are ancestors of HEAD.
