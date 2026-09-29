---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 03
subsystem: research-corpus
tags: [openalex, envelope-honesty, metering, api-key, d-16, wave-0]

requires:
  - phase: 363-01
    provides: run-all-363.sh aggregator
  - phase: 363-02
    provides: fixture and replay helpers (not consumed here; this plan stubs fetch inline)
provides:
  - adapterAcademicEnvelope reads telemetry before calling a zero-hit response empty_valid; a provider failure is status failed with a typed failure_class
  - budget_exhausted carried on a 429 with x-ratelimit-remaining-usd 0 and on a spent local budget
  - OPENALEX_API_KEY sent only as an Authorization Bearer header
  - additive envelope meta {count, cost_usd, remaining_usd, limit_usd, x_query}
  - quoted phrases and uppercase AND/OR/NOT reach the OpenAlex search parameter unchanged; per-page honors the limit (cap 200)
  - additive normalized paper fields is_retracted, type, cited_by_count, venue, is_in_doaj
affects: [363-08, 363-11, 363-12, 363-13]

key-files:
  created: []
  modified:
    - lib/core/research-corpus.cjs
    - lib/core/rs-fetcher-academic.cjs
    - data/research-sources.json
    - tests/test-363-corpus-honesty.cjs

key-decisions:
  - "Failure mapping: timeout and network_error -> network_timeout; rate_limited and api_error -> http_error; api_key_missing -> blocked/missing_credential (not retryable); a spent LOCAL rolling budget -> blocked/spend_limit_exceeded (not retryable, error carries budget_exhausted)"
  - "meta is attached to the envelope after construction (the envelope constructor drops unknown keys) and mirrored in payload.meta; meta.count is null when the provider did not report one, so a later verdict treats it as unresolved"
  - "normalizePaper copies the five additive fields only when the record already has them, so hand-built records keep their exact prior shape"

requirements-completed: [DRP363-06]

completed: 2026-09-29
---

# Phase 363 Plan 03: OpenAlex honesty and metering Summary

**A failed OpenAlex fetch can no longer read as "nothing in the literature": failures come back typed, the API key rides a Bearer header only, and counts, budget and quoted phrases travel intact.**

## PLAN_BASE

`f049370f0e393baaa21bbf6e1c5869d4c9f349ed` (the RED commit; the prior session's plan base is not recorded on disk).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED (prior session) | f049370f0 | tests/test-363-corpus-honesty.cjs |
| 2 + 3 GREEN (adopted diff, finished and verified) | 12c1c4862 | lib/core/rs-fetcher-academic.cjs, lib/core/research-corpus.cjs, data/research-sources.json, tests/test-363-corpus-honesty.cjs |

Both are ancestors of HEAD. Tasks 2 and 3 share one commit, as the plan's Task 3 action text directs.

## What was built

- `rs-fetcher-academic.cjs`: Bearer key in `buildAcademicQuery` (never in the URL); `per-page = min(max(1, limit), 200)` via a `perPage` option threaded from `fetchOneSource`; select list gains `type,cited_by_count,is_retracted,primary_location`; the ok telemetry record carries `meta` built from the body and the `x-ratelimit-*-usd` headers; a 429 with remaining 0 sets `budget_exhausted`; `parseOpenAlex` adds the five additive paper fields; `readNumberHeader`, `buildOpenAlexMeta`, `OPENALEX_SELECT` exported for tests.
- `research-corpus.cjs`: `adapterAcademicEnvelope` scans the source's telemetry for the first non-ok record before the zero-results check and returns `academicFailureEnvelope`; ok and empty_valid envelopes carry `meta` (count null when absent). The legacy array wrapper still degrades to [].
- `data/research-sources.json`: openalex note documents the optional key, the metered keyless budget (x-ratelimit-limit-usd 0.1 measured 2026-09-29) and typed failure.

Envelope `meta` fields: `count`, `cost_usd`, `remaining_usd`, `limit_usd`, `x_query`.

## Verification

- `node tests/test-363-corpus-honesty.cjs`: PASS 18, FAIL 0 (L1-L16 plus two hygiene legs).
- `node tests/test-221-envelopes.cjs`: exit 0. `tests/run-all-130.5.sh`: exit 0.
- `run-all-131.sh`, `run-all-219.sh`, `run-all-221.sh` exit 1, all pre-existing. Proven by running the same three aggregators in a scratch worktree at f049370f0 (node_modules symlinked in): failed-leg lists are byte-identical before and after (131: 2, 219: 13, 221: 43). Representative causes: `insertNode: invalid epistemic_type "undefined"`, research edge/event-type delta counts, and the 216-03 gate. None touch the research corpus.

## Deviations from Plan

### Adopted prior-session work

**1. [Process] Adopted uncommitted GREEN diff from a prior session**
- **Found during:** start of execution
- **Issue:** the prior session ended after the RED commit with a +217/-14 uncommitted diff in the four plan files.
- **Fix:** per the user's explicit ruling, read the diff against the plan task by task (Tasks 2 and 3 fully satisfied, no gaps), verified it, and committed it unchanged as 12c1c4862 with the adoption stated in the message. Nothing was reverted, stashed or reset.
- **Beyond-plan content in the diff (kept):** legs L15 (spent local budget -> blocked / spend_limit_exceeded, zero calls) and L16 (all failure and success shapes validate through `validateStageEnvelope`); the `spend_limit_exceeded` mapping for a spent local budget. These extend the plan's mapping consistently with the frozen 221 failure-class enum.

### Handling notes

- The plan says not to write STATE.md; the orchestrator instruction for this run overrides it. STATE.md carried an uncommitted frontmatter clobber from the prior session (stale `stopped_at`, `last_activity`, `percent` 39, Plan 1 of 22). It was hand-corrected rather than reverted.
- The scratch worktree used for the baseline was removed after use.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access; the key is a service credential on a header only (T-363-09 covered by L8).

## Self-Check: PASSED

- 12c1c4862 and f049370f0 are ancestors of HEAD.
- The four modified files exist and are committed; the plan's test exits 0.
