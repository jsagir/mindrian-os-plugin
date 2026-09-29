---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 09
subsystem: research-planner
tags: [research-grant, approval, audit-ledger, throttle, floor-ledger, d-04, d-10, d-11]

requires:
  - phase: 363-01
    provides: research-planner folder and test hygiene
  - phase: 363-08
    provides: FAMILIES template ids, slotTerms, isRawQueryEdit
provides:
  - lib/core/research-planner/grants.cjs - two-lifetime research grant ledger, fixed-order per-query check, first-new-term ask, hourly run throttle, F.0 grant card
  - lib/core/research-planner/audit-ledger.cjs - append-only, key-refusing audit ledger
  - data/floor-ledger.json - two disclosed D-11 policy rows
  - tests/test-363-grants.cjs (13 legs) and tests/test-363-audit-ledger.cjs (5 legs)
affects: [363-12, 363-13, 363-15, 363-17, 363-18, 363-20]

tech-stack:
  added: []
  patterns:
    - "Only writeGrant writes a grant, and only with an approved_via; builders return unapproved objects"
    - "Grant ledger, run ledger and audit ledger are three separate room-local files under .mindrian/"
    - "Corrupt grant or run ledger is renamed to <file>.<ms>.corrupt and reads as no grant (which means no fetch)"

key-files:
  created:
    - lib/core/research-planner/grants.cjs
    - lib/core/research-planner/audit-ledger.cjs
    - tests/test-363-grants.cjs
    - tests/test-363-audit-ledger.cjs
  modified:
    - data/floor-ledger.json

key-decisions:
  - "validateExecutedQuery(query, grant, state) takes the grant object (callers get it from findActiveGrant); it never reads the disk."
  - "readGrants and readRunLedger return objects ({grants, quarantined} / ledger + quarantined), not bare arrays."
  - "Throttle counts only ambient runs. throttleState -> {count, limit, allowed_next, exceeded}: allowed_next means a further run may start (count < limit); exceeded means more than the limit already started (count > limit). The current run is already counted in runs_in_window when its queries are checked, so throttle_exceeded fires only when a second run slipped in."
  - "new_term compares every slot_terms entry (term and synonyms) with the grant's approved terms and their synonyms, case-insensitive; run grants skip it (their q_hash set is the approval)."
  - "Run grant expires at approved_at + caps.time_budget_ms; standing at approved_at + 30 days."
  - "A filing key is refused at any depth of the grant object (file, filing, file_on_approve, files, file_on_grant)."

requirements-completed: []

duration: ~30min
completed: 2026-09-29
---

# Phase 363 Plan 09: Research Grants and Audit Ledger Summary

A persisted, scoped, expiring, revocable grant now authorizes every fetch, asks again on each D-04 reason and on the first new term, and every executed query leaves an append-only audit record.

PLAN_BASE: e8f579d76f20ce089fd6333f090ea08152e59157

## What was built

### grants.cjs

Exports: `CURRENT_POLICY ('drp363-grant/1'), GRANT_EXPIRY_DAYS (30), RESEARCH_RUNS_PER_HOUR (1), STANDING_SCOPE, REASK_REASONS, roomIdFor, readGrants, writeGrant, revokeGrant, extendTerms, findActiveGrant, buildStandingProposal, buildRunGrant, validateExecutedQuery, grantCard, readRunLedger, recordRun, throttleState`.

Grant file `.mindrian/research-grants.json`: `{schema:'mos.research-grant-ledger/1', grants:[...]}`. Each grant (schema `mos.research-grant/1`):

- both lifetimes: `grant_id (g-<8 hex>), version, lifetime (standing|run), policy_version, room_id (basename:sha256-12 of absolute path), providers ['openalex'], fallback null, families, caps, approved_at, approved_via {surface, decision_node_id}, expires_at, revoked_at`
- standing adds: `approved_terms [{term, synonyms[], approved_at, approved_via}]`, `throttle {runs_per_hour}`; caps `{queries_per_run:3, results_per_query:5, max_searches:3}`
- run adds: `approved_hashes[]` (round one), `run_id`; caps carry `time_budget_ms`

`writeGrant(roomDir, grant, {approved_via, now})` refuses with `approval_required`, `grant_never_authorizes_filing`, `standing_scope_exceeded`, `unknown_family`, `bad_grant`, `bad_lifetime`. Standing scope is openalex plus whitespace-gap/v1 only.

`validateExecutedQuery` order (REASK_REASONS): no_grant, room_mismatch, grant_revoked, grant_expired, grant_reversioned, provider_not_in_policy, outside_family (family not covered, or template_id not in that family), audit_tripped, new_term (standing), hash_not_approved (run, round 1), cap_exceeded, throttle_exceeded (standing plus ambient), multi_step (standing, round above 1).

Run ledger `.mindrian/research-run-ledger.json`: `{schema:'mos.research-run-ledger/1', runs_window:{start, count}, runs:[{run_id, ts, mode, trigger, delta_hash}], pending_cards:[]}`; last 50 runs kept. Separate from the 355.1 ambient ledger.

`grantCard` returns `{shape:'F.0', title, question, options[3], body_md, payload}` with the three fixed labels; the body names provider, fallback, corpus scope, template ids per family, caps, throttle, room scope, policy version, expiry date, how to revoke, every new term, and says the grant covers fetching only and filing still asks.

### audit-ledger.cjs

`.mindrian/research-audit.jsonl`, one line per executed query, keys exactly `AUDIT_KEYS` (23, the D-04 list, normalized to that order). `appendAudit` refuses a missing or extra key, a bad `part8_verdict` or `outcome`, wrong types, and any record whose text carries `Bearer `, `api_key=` or the live `OPENALEX_API_KEY` value. Only `fs.appendFileSync` touches the file. `readAudit(roomDir, {run_id})` skips torn lines; `sliceForRun` is the per-run view. No network code.

### Floor ledger

Two disclosed policy rows appended (pure addition, 26 added lines, 0 removed): `research-planner-grants.GRANT_EXPIRY_DAYS` (30) and `research-planner-grants.RESEARCH_RUNS_PER_HOUR` (1). `node scripts/check-floor-ledger.cjs --check` passes (39 rows).

## Commits

- fc5cc4d3d test(363-09): failing grant and audit-ledger legs (RED, 0/13 and 0/5)
- 731e14a9e feat(363-09): research grants, re-ask checks, audit ledger, D-11 floor rows (GREEN, 13/13 and 5/5)

Both are ancestors of HEAD.

## Verification

`node tests/test-363-grants.cjs` 13/13 PASS (G1-G13, including the fresh-child restart read); `node tests/test-363-audit-ledger.cjs` 5/5 PASS; `node scripts/check-floor-ledger.cjs --check` exit 0; both top-level consts present (`grep -c` prints 1 each); no em or en dash in any file written (tests spell them as unicode escapes); zero fetch attempts in every leg.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test literal dash characters**
- **Found during:** Task 2
- **Issue:** The test files as first written held literal dash characters inside a regex; the tree-wide dash scan flagged them.
- **Fix:** Replaced with `—` and `–` escapes (grants.cjs itself uses escapes in its card sanitizer).
- **Files modified:** tests/test-363-grants.cjs, tests/test-363-audit-ledger.cjs
- **Commit:** 731e14a9e

**2. [Rule 3 - Blocking] Floor-ledger edit method**
- **Found during:** Task 3
- **Issue:** Parse-and-reserialize with JSON.stringify reflowed the whole file (38 removed lines), breaking the pure-addition acceptance criterion.
- **Fix:** Restored the file with `git checkout -- data/floor-ledger.json` (no peer diff existed; status was clean before) and appended the two rows by string splice in the file's inline-array style.
- **Commit:** 731e14a9e

Otherwise the plan executed as written. Plan text said grants.cjs exports do not include `roomIdFor`; it is exported additionally (callers need it to build `state.room_id`).

## Downstream contract notes

- Build `state.room_id` with `grants.roomIdFor(roomDir)`. Get the grant with `findActiveGrant(roomDir, {now, lifetime?, run_id?})` and pass it to `validateExecutedQuery(query, grant, state)`; a null grant returns `no_grant`.
- Query object: `{q, q_hash, template_id, family, provider:'openalex', audit:'pass'|other, slot_terms[], round, trigger:'navigator'|'ambient'}`. `slot_terms` comes straight from 363-08 `composeFamily` output. State: `{room_id, now, searches_used, round, runs_in_window}`.
- Ambient flow (363-18): `throttleState(roomDir).allowed_next` gates starting a run; `recordRun(roomDir, {run_id, mode, trigger:'ambient', delta_hash})` at start; pass `throttleState(...).count` as `runs_in_window` for the queries of that run.
- `new_term` handling (363-15/17): collect `slotTerms(queries)`, show `grantCard(proposal, {newTerms})` or a small confirm, then `extendTerms(roomDir, grantId, [{term, synonyms}], {surface, decision_node_id})`; the grant version increments and the same query passes.
- Approval writers (363-15 CLI, 363-17 MCP inside gate_answer resumeFn) call `writeGrant` with `approved_via`; a run grant comes from `buildRunGrant(plan)` where plan leaves hold `queries` with `round`, `q_hash`, `family`, and plan.budget supplies caps and `time_budget_ms`.
- Every executed query (including cache_hit, blocked, failed) should call `appendAudit` with all 23 keys; `sliceForRun(roomDir, run_id)` is the run's audit view for evidence and the SUMMARY of a run (363-13/14).
- `isRawQueryEdit` stays in families.cjs; grants.cjs does not re-export it. Refuse raw edits before they reach grants.
- REQUIREMENTS DRP363-04 and DRP363-05 are also named by 363-15, 363-17, 363-18, 363-20 and 363-22, so they are left unchecked here.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-363-07, T-363-08, T-363-01, T-363-11, T-363-09 and T-363-32 are mitigated as planned (grant check before every fetch, room_id binding, new_term ask, filing-key refusal at any depth, key-shaped value refusal, quarantine on corrupt ledgers). Known limit: grant and run ledgers use read-modify-write without a lock, so two processes writing at the same instant can lose one update; the write itself is atomic (temp then rename). Acceptable for a single navigator per room; noted for Cowork (363-20).

## Self-Check: PASSED

Files found: grants.cjs, audit-ledger.cjs, both tests, floor-ledger rows. Commits fc5cc4d3d and 731e14a9e verified as ancestors of HEAD.
