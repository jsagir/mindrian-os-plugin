---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 03
subsystem: dominant-design
tags: [dominant-design, composer, part8, evidence, validator, pure-cjs, tdd]

# Dependency graph
requires:
  - phase: 361-01
    provides: DDR361 requirement family, tests/run-all-361.sh aggregator (guarded legs for this plan's test files)
provides:
  - lib/core/dominant-design/lane-queries.cjs (composeLaneQueries, auditEditedQuery, domainSlug, LANES, LANE_IDS, TAVILY_PARAMS)
  - lib/core/dominant-design/evidence-pack.cjs (validateLaneResult, tierFor, renderLaneArtifact, toEvidenceClaimParams, laneArtifactName, SOURCE_TYPES, FORBIDDEN_ROW_KEYS)
  - tests/test-361-lane-queries.cjs (10 legs)
  - tests/test-361-evidence-pack.cjs (16 legs)
affects: [361-04, 361-06, 361-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composer-audits-every-string precedent (online-pattern-query.cjs, Phase 214-02) reused for the dominant-design lane queries: try/catch around auditFn per candidate, first throw aborts and returns a local-only degrade naming only the family/lane, never the offending string"
    - "D-13 tier assignment lives entirely in code (tierFor), never a whitelisted input key on a claim row, so an agent cannot self-grade evidence"
    - "Evidence-row validator drop-not-hedge pattern: a five-field D-06 completeness check plus a case-insensitive substring regex over row keys (score/confidence/strength/probability/rank) filters tampering before any row reaches a rendered artifact or a filed EvidenceClaim"

key-files:
  created:
    - lib/core/dominant-design/lane-queries.cjs
    - lib/core/dominant-design/evidence-pack.cjs
    - tests/test-361-lane-queries.cjs
    - tests/test-361-evidence-pack.cjs
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "CR/LF domain check runs on the RAW input string before whitespace collapse (per the plan's literal behavior spec), so a newline embedded in the navigator's domain text cannot hide inside the single space collapseWhitespace would otherwise produce"
  - "Check order in composeLaneQueries: bad_domain (raw CR/LF) -> empty_domain (post-collapse) -> bad_domain (post-collapse length) -> per-lane egress_violation. In validateLaneResult: bad_shape -> unknown_lane -> query_mismatch -> per-row unsourced/scored filtering. Neither order is contradicted by the plan's must_haves; both are the natural dependency order (you cannot query-match or lane-match a non-object)"
  - "Forbidden-row-key check runs before the five-D-06-field completeness check per row, so a row that is both incomplete and score-carrying counts once as dropped_scored, not dropped_unsourced (not exercised by a plan-mandated test case, so this ordering is this plan's own discretion, documented here for the next reader)"
  - "toEvidenceClaimParams groups rows by source_url within a lane; the grouped summary is `[<row id>] <claim>` per row joined by newline, and evidence_tier for the group is the single highest TIER_RANK value across its rows (Academic > Operational > Practitioner) -- exact summary string format was left to this plan's discretion since D-06/D-07 do not specify it, only that grouping-by-URL and per-lane sessionId suffix are contracts (Pitfall 3)"
  - "renderLaneArtifact never shows the literal line 'No sourced evidence found for this lane.' when valid.error is set, even if rows.length is 0, per the plan's explicit 'never presented as a lane that found nothing' instruction; it shows 'Search did not run: <error>' instead, positioned above the '## Searched, not found' section"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-09-23
---

# Phase 361 Plan 03: Lane-query composer and evidence-pack validator Summary

**Built the two pure CJS modules the dominant-design research path stands on: `lane-queries.cjs` (the one audited source of every outbound Tavily string, D-03/D-04/D-05) and `evidence-pack.cjs` (the D-06 five-field validator with a code-only D-13 tier map, an honest D-07 empty/errored-lane renderer, and the per-URL EvidenceClaim filing-parameter builder).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-23T~18:50:00+03:00 (approx)
- **Completed:** 2026-09-23T19:17:00+03:00
- **Tasks:** 2 (both completed, plus one immediate self-caught fix commit)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `lib/core/dominant-design/lane-queries.cjs` composes exactly four lane queries in the fixed D-05 order (`variant_census`, `convergence_signals`, `s_curve_limits`, `discontinuity_signals`), auditing every composed string and every navigator edit through the shipped `auditQueryString` fence before it can be returned; a violation degrades to a local-only envelope naming only the lane, with zero echo of the offending text.
- `lib/core/dominant-design/evidence-pack.cjs` enforces the D-06 five-field minimum in code (a row missing any field, carrying a non-http(s) `source_url`, or carrying a score-like key is dropped and counted, never hedged), assigns the D-13 evidence tier from `source_type` alone (never an agent-supplied key), renders a full lane artifact even for an empty or errored lane (D-07), and groups filing parameters by `source_url` so two rows sharing a page never overwrite each other under one `EvidenceClaim` id.
- Both modules are pure: zero `fs`/`http`/`https`/`net` requires (proven both by an in-test source grep and by the plan's own `node -e` acceptance-criteria one-liners), no clock reads except the caller-supplied render options.
- `tests/test-361-lane-queries.cjs` (10 legs) and `tests/test-361-evidence-pack.cjs` (16 legs) both run RED-then-GREEN (module absent -> `MODULE_NOT_FOUND`, confirmed before writing either module) and now pass clean; `bash tests/run-all-361.sh` shows both new legs PASSED.

## Task Commits

Each task was committed atomically, plus one immediate self-fix:

1. **Task 1: Lane-query composer with the Part 8 audit fence** - `f48e0f2aa` (feat)
2. **Task 2: Evidence-pack validator, tier map, lane artifact renderer, filing params** - `a0bdd9071` (feat)
3. **Self-fix: literal em-dash in the two new test files' own no-em-dash assertions** - `ed27e3024` (fix)

_Base commit at plan start (`PLAN_BASE`): `bad45d6b5`_

## Files Created/Modified
- `lib/core/dominant-design/lane-queries.cjs` - `LANES`/`LANE_IDS` (frozen, fixed D-05 order), `TAVILY_PARAMS` (frozen), `MAX_QUERIES_PER_LANE`/`MAX_QUERY_CHARS`/`MAX_DOMAIN_CHARS`, `composeLaneQueries`, `auditEditedQuery`, `domainSlug`
- `lib/core/dominant-design/evidence-pack.cjs` - `SOURCE_TYPES`, `FORBIDDEN_ROW_KEYS`, `tierFor`, `validateLaneResult`, `renderLaneArtifact`, `toEvidenceClaimParams`, `laneArtifactName`
- `tests/test-361-lane-queries.cjs` - 10 legs: happy path, query text shape, empty/missing domain, forbidden-pattern domains with zero echo, CR/LF and over-length domain, third-call-throw contract, `auditEditedQuery` legs, frozen constants, `domainSlug`, module purity
- `tests/test-361-evidence-pack.cjs` - 16 legs: `SOURCE_TYPES`/`tierFor`, drop/keep counts, row whitelist and stable ids, unparseable-date and entities caps, over-40-row cap, `query_mismatch`/`unknown_lane`/`bad_shape`, empty-lane synthesis, `error` carry-through, non-empty/empty/errored render, source-cell link-vs-title, `toEvidenceClaimParams` grouping, `laneArtifactName`, `FORBIDDEN_ROW_KEYS` substring matching, module purity
- `.planning/ROADMAP.md` - Phase 361 progress line (2/8 -> 3/8) and the `361-03-PLAN.md` checkbox, verified with `git diff -U0` to touch only those two lines

## Decisions Made
- D-13 tier reading (already resolved in 361-CONTEXT.md, applied here in code): `standards_body` maps to Academic alongside `peer_reviewed`; `regulatory_filing` stays Operational with `company_primary` and `market_data`. `tierFor` coerces any unrecognized `source_type` to Practitioner (the safest default, never a guess upward).
- `FORBIDDEN_ROW_KEYS` is exported as the visible word list (`score`, `confidence`, `strength`, `probability`, `rank`); internally it becomes a single case-insensitive substring regex so `dominance_strength` and `relevance_score` are also caught, matching the plan's explicit worked example.
- `domainSlug` falls back to the literal string `'domain'` in the degenerate case of an all-punctuation, already-validated domain (never reached by `composeLaneQueries` in practice, since such a domain either fails the empty-domain check or the audit first) - a defensive Rule 2 addition so the function's own "never empty for a valid domain" contract holds unconditionally, not just for the tested inputs.
- Per the phase's sequential-execution instructions, this plan's `requirements` frontmatter lists DDR361-02/04/05/06/07, but every one of those rows' traceability entry in `.planning/REQUIREMENTS.md` names additional later plans (361-06 and/or 361-07) as co-owners. None of them name 361-03 as the LAST owning plan, so none were checked off here (`requirements-completed: []`); the last owning plan closes each row per the shared-tree rule "do not check off DDR361 rows another plan also owns."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, self-caught before completion] Literal em-dash character in this plan's own test files**
- **Found during:** running `bash tests/run-all-361.sh` after both task commits landed
- **Issue:** The no-em-dash-in-output assertions in `tests/test-361-lane-queries.cjs` (Test 10) and `tests/test-361-evidence-pack.cjs` (Tests 9 and 16) were written with a literal em-dash character (` -- `) in the test source instead of the intended ` -- ` JS escape sequence, tripping the aggregator's em-dash guard on the test files themselves (a bug this plan introduced, not a pre-existing one)
- **Fix:** Replaced the three literal em-dash occurrences with the ` -- ` escape sequence via `sed`; re-ran both test files (10 and 16 legs still pass) and the full aggregator (em-dash guard now PASSED)
- **Files modified:** `tests/test-361-lane-queries.cjs`, `tests/test-361-evidence-pack.cjs`
- **Commit:** `ed27e3024`
- **Note (self-reported, not auto-fixed further):** the fix commit's own message accidentally contains one literal em-dash in its subject line (an ironic repeat of the same slip while describing the fix). Per the git safety protocol, commits are never amended in this workflow; the commit content (the two `.cjs` files) is verified clean by the em-dash guard, and only the git commit message text (not a tracked file) carries the residual character. Flagging here rather than silently leaving it undocumented.

## Issues Encountered

**Two pre-existing, unrelated peer failures remain in `bash tests/run-all-361.sh` (classified, not touched, per this plan's explicit instructions):**
- `lib/core/part8-egress-guard.test.cjs` (PB8-03 assertion: `actual: 'ambiguous'`, `expected: 'allow'`) - confirmed via direct `node lib/core/part8-egress-guard.test.cjs` to fail identically outside this plan's own files; neither `lane-queries.cjs` nor `evidence-pack.cjs` touches Part 8's `_proveKnownToolShape` (that is 361-02's and 361-08's territory).
- `tests/test-209-declared-implies-wired.cjs` - not touched by either of this plan's two new files.
Both were named as known pre-existing failures in this session's own instructions and are left open for whichever session/phase owns them.

## Known Stubs

None. Both modules are complete pure implementations against the plan's full `<behavior>` specification; no placeholder logic, no hardcoded empty returns feeding a UI.

## Threat Flags

None beyond the plan's own declared `<threat_model>` (T-361-09..T-361-14), all of which are mitigated exactly as specified: every outbound string passes `auditQueryString` with zero echo on violation (T-361-09); `validateLaneResult` enforces the five-field minimum, http(s) URL, key whitelist and score-like-key drop (T-361-10); `query_mismatch` refuses a rephrased echo (T-361-11); `renderLaneArtifact` runs claim/title/quote through `stripInjectionSpans` and escapes table cells, restricting markdown links to clean http(s) URLs (T-361-12); `toEvidenceClaimParams` groups by URL with a per-lane session suffix (T-361-13); `evidence_tier` is never a whitelisted input key on a raw claim row, so an agent cannot inflate its own tier (T-361-14). No new network endpoint, auth path, or schema change was introduced - both modules remain pure with zero `fs`/network requires (verified by grep in both the test suite and the plan's own acceptance-criteria one-liners).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `lib/core/dominant-design/lane-queries.cjs` and `lib/core/dominant-design/evidence-pack.cjs` are ready for 361-04 (the `dominant-design-researcher` agent contract), 361-06 (the CLI that wires `compose-queries`/`validate-lane`/`file-pack` subcommands over these two modules), and 361-07 (the command upgrade) to `require` directly with zero further changes expected to either module's exported surface.
- `tests/run-all-361.sh` (written once by 361-01, never edited here) now shows both `tests/test-361-lane-queries.cjs` and `tests/test-361-evidence-pack.cjs` legs PASSED instead of SKIPPED.
- DDR361-02, DDR361-04, DDR361-05, DDR361-06 and DDR361-07 remain open (unchecked) in `.planning/REQUIREMENTS.md`: each one's traceability entry names 361-06 and/or 361-07 as an additional, later-closing owner. The next session working 361-06 or 361-07 should check the current text of each row's `Plans:` list before closing it, since this plan intentionally left all five open.

## Self-Check: PASSED

Both created library files and both created test files verified present on disk; all three commit hashes (`f48e0f2aa`, `a0bdd9071`, `ed27e3024`) verified present in `git log --oneline --all`; `node tests/test-361-lane-queries.cjs` and `node tests/test-361-evidence-pack.cjs` both exit 0 on the final on-disk state; `bash tests/run-all-361.sh` shows `PASSED=22 FAILED=2 SKIPPED=5` with the 2 failures being the pre-existing peer legs named above and the em-dash guard PASSED.

---
*Phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r*
*Completed: 2026-09-23*
