---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 11
subsystem: research-planner
tags: [evidence-rows, quote-first, content-hash, retraction, hash-anchoring, d-02a, d-03, d-07, d-18]

requires:
  - phase: 363-02
    provides: OpenAlex fixture bodies
  - phase: 363-03
    provides: additive normalized paper fields (is_retracted, type, venue, is_in_doaj)
provides:
  - lib/core/research-planner/evidence-rows.cjs - ROW_LABELS, REQUIRED_ROW_FIELDS, normalizeText, reconstructAbstract, contentHash, recordsIndex, validateRows, deterministicTermRows, renderRowCitation
  - tests/test-363-evidence-rows.cjs (R1-R10 plus consumer leg C1, 31 checks)
affects: [363-12, 363-13, 363-14]

key-files:
  created:
    - lib/core/research-planner/evidence-rows.cjs
    - tests/test-363-evidence-rows.cjs
  modified: []

key-decisions:
  - "Source type mapping for tierFor: OpenAlex article and review -> peer_reviewed (Academic). SOURCE_TYPES has no preprint member, so preprint, posted-content and every unknown type -> 'other' (Practitioner, never a guess upward)."
  - "A retracted record may only be labelled context. Beyond the plan's supports/contradicts/derivation, retest, scurve_ceiling, scurve_headroom and funding_signal on a retracted record are also dropped as retracted_support, because classifyLimiter ignores flags.retracted and would otherwise count them."
  - "record_id accepts the full OpenAlex URL or the bare W id; the row stores the canonical full id from the index."
  - "A leaf_id outside opts.leafIds is counted under missing_field (the closed drop set has no unknown_leaf bucket)."
  - "Model-supplied row_id, evidence_tier, source_type, source_url and any extra key are ignored: the row is built field by field, so code always sets them."
  - "content_hash is optional on input; when supplied and different from the recomputed hash the row drops as hash_mismatch."
  - "Quote match is a normalized substring of the title or the reconstructed abstract; an empty quote is missing_field."
  - "deterministicTermRows matches the normalized term as a substring (so 'sonic biofilm removal' matches 'ultrasonic biofilm removal'); the quote is the whole containing sentence, a title-only match quotes the title; the claim is a code-written LOCAL sentence."
  - "renderRowCitation(row) returns '[E-WS-1]'; with {withQuote:true} the quote follows as inert double-quoted text with injection spans stripped via stripInjectionSpans (exported by evidence-claim.cjs)."

requirements-completed: []

duration: ~20min
completed: 2026-09-29
---

# Phase 363 Plan 11: Quote-first, hash-anchored evidence rows Summary

**Every evidence row the engine keeps is now checked against the fetched OpenAlex record itself: quote must be a normalized substring of title or abstract, content hash recomputed, no score-like key, and a retracted work can only be context.**

## PLAN_BASE

`fb5a3fb527817472589abc072402f4c20f61a68b`

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | 3d2bb1859 | tests/test-363-evidence-rows.cjs |
| 2 GREEN | e9c270f3c | lib/core/research-planner/evidence-rows.cjs |
| extra leg | f94af4b25 | tests/test-363-evidence-rows.cjs (C1 consumer leg) |

All are ancestors of HEAD.

## What was built

- Reuse by require, no copy: `FORBIDDEN_ROW_KEYS` (via the same substring pattern as 361) and `tierFor` from `lib/core/dominant-design/evidence-pack.cjs`; `stripInjectionSpans` from `lib/core/navigation/evidence-claim.cjs`. `lib/core/dominant-design/*` untouched.
- `validateRows(rawRows, index, {leafIds, lane, retrievedAt})` returns `{rows, dropped}` with drop buckets missing_field, forbidden_key, unknown_record, unverified_quote, hash_mismatch, bad_label, retracted_support. Check order: forbidden key, required fields, label, funding fields, leaf, record, hash, quote, retraction.
- Row shape: `{row_id 'E-<LANE>-<n>', leaf_id, record_id, claim, quote, label, source_url, source_title, retrieved_at, content_hash, evidence_tier, source_type, flags {retracted, is_in_doaj, venue}, funder?, program?}`. `source_url` is the DOI URL, else the OpenAlex id URL.
- Labels (closed, frozen): supports, contradicts, context, derivation, retest, scurve_ceiling, scurve_headroom, funding_signal.
- Consumer proof (leg C1): validated rows go straight into 363-07 `classifyLimiter` (derivation -> physics, scurve_ceiling -> near_ceiling, basis_row_ids set) and 363-06 `rollUp` (supports -> leaf supported, support_count 1).

## Verification

- `node tests/test-363-evidence-rows.cjs`: PASS 31, FAIL 0, exit 0 (R1-R10 plus C1 and hygiene; zero fetch attempts).
- `git status --short -- lib/core/dominant-design/` empty; `git diff --stat fb5a3fb52 -- lib/core/dominant-design` empty.
- No non-ASCII characters in either file; the module matches dash and curly-quote characters by `\u` escapes only.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Retraction drop extended to retest, S-curve and funding labels**
- **Found during:** Task 2 (the 363-07 hand-back said classifyLimiter ignores `flags.retracted`; its current `rowsForLimiter` does filter retracted rows, but the contract note should not be relied on)
- **Issue:** the plan drops only supports, contradicts and derivation on a retracted record; a retracted retest or S-curve row could still reach limiter classification if a consumer did not filter. Dropping at the source makes that impossible regardless.
- **Fix:** only `context` survives on a retracted record; the others count as retracted_support.
- **Files:** lib/core/research-planner/evidence-rows.cjs; leg R7 (second) covers it.

**2. [Extra leg] C1 consumer leg** added at the orchestrator's invitation (commit f94af4b25).

Otherwise the plan executed as written. The test reaches the OpenAlex normalize step through `rs-fetcher-academic.cjs` `_test.parseOpenAlex` (there is no public normalizer export).

## Known Stubs

None.

## Threat Flags

None. No network, no fs, no new trust boundary; T-363-05, -06, -19 and -35 are mitigated (R3/R4, R8 render strip, R7, R5).

## Downstream contract notes

- 363-12/13: fetch records through `fetchSourceCached('openalex-v2', ...)`, take `items` (normalized papers with id, title, abstract, doi, type, is_retracted, venue, is_in_doaj), build `recordsIndex(items)` once per run, then `validateRows(modelRows, index, {leafIds, lane, retrievedAt})`. Rows are in `rows`; report `dropped` counts (an all-dropped set is not the same as no hits).
- No-model path (ambient child): `deterministicTermRows(items, term, {leafId, lane, label})` returns raw rows; pass them through `validateRows` like any other. Substring match, so a term inside a longer word matches.
- `record_id` may be the full OpenAlex URL or the bare W id. The kept row carries the full URL.
- Retracted records: only `label: 'context'` survives (flags.retracted true). 363-13 should surface a retracted-work note from `flags.retracted` rows and from `dropped.retracted_support > 0`.
- funding_signal rows carry `funder` and `program` (both required) and are the only rows with those keys.
- Rows never carry a score-like key; any consumer that adds one must not put it on the row (Canon Part 12).
- Model-supplied `row_id`, `evidence_tier`, `source_type`, `source_url` and extra keys are ignored; do not expect them to round-trip.
- `renderRowCitation(row, {withQuote:true})` is the only render helper; it strips injection spans and never prints the claim.
- The unit `dropped.missing_field` also counts a leaf_id outside `leafIds`.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/evidence-rows.cjs
- FOUND: tests/test-363-evidence-rows.cjs
- FOUND: 3d2bb1859, e9c270f3c, f94af4b25 (ancestors of HEAD)
