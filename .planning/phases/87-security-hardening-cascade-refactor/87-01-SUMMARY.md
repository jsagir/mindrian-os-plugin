---
phase: 87-security-hardening-cascade-refactor
plan: 01
subsystem: security
tags: [cypher-injection, api-key-permissions, hsi-timeout, defence-in-depth, sanitization, bsl-1.1]

# Dependency graph
requires:
  - phase: 87-00
    provides: Feynman runner with exit-77 SKIP convention + cascade-e2e acceptance gate (baseline 19/19 must stay green)
  - phase: 87-02
    provides: atomic write-lock (baseline 19/19 required before 87-01 could bump to 20/20)
provides:
  - sanitizeCypherInput(str) whitelist /[a-zA-Z0-9 ._-]/ at 8 Cypher interpolation sites in brain-client.cjs
  - checkFilePermissions(envPath) refuses .env files with any group/world bit set (0o077 & mode != 0)
  - HSI_TIMEOUT_MS = 30000 named constant replacing 12 timeout:5000 sites in intelligence-cascade.cjs
  - Defence-in-depth numeric coercion for maxDepth / minConf / topK (Number + Math.max/min bounds)
  - Shared security-trifecta.test.cjs (20 tests, integrated into Feynman runner)
affects:
  - 87-10 (v1.10.11 release gate -- this plan is in Stream A)
  - 87-03 (cascade deduplication -- HSI timeout constant survives the refactor)
  - All future Cypher-building helpers in brain-client.cjs: sanitizer is the required gate

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist-first sanitization (deny by default) over blacklist/escape: every non-alphanumeric char stripped unless explicitly allowed"
    - "Pre-read .env permission gate: fs.statSync(mode) & 0o077 check blocks group/world-readable key files"
    - "Named-constant timeout: single definition, grep-enforceable 12-site invariant"
    - "Test surface via module.exports._test: keeps helpers pure and testable without widening the public API"

key-files:
  created:
    - lib/memory/security-trifecta.test.cjs (253 lines, BSL 1.1 inherited via repo header policy)
  modified:
    - lib/core/brain-client.cjs (sanitizer + permission check + 8 patched Cypher sites + numeric coercion + _test export)
    - lib/core/intelligence-cascade.cjs (HSI_TIMEOUT_MS constant + 12 replaced timeouts; 2 preserved 15000ms untouched)
    - lib/memory/run-feynman-tests.cjs (1-line addition registering security-trifecta test)

key-decisions:
  - "Whitelist /[a-zA-Z0-9 ._-]/ not blacklist: escape-based defences (.replace(/\"/g, '\\\\\"')) only cover one metachar and are trivially bypassable via backtick, newline, dollar-sign, or Cypher comment (//). CONTEXT.md lines 121-127 locked the whitelist."
  - "sanitizeCypherInput coerces null/undefined -> '' and non-string via String() defensively. Callers never crash, but values that cannot be sanitized (objects with throwing toString) silently become ''."
  - "Permission check returns true on Windows with stderr warning (once per process). NTFS ACLs do not map to POSIX mode bits; enforcing mode & 0o077 == 0 on NTFS would be meaningless false alarms."
  - "Permission stat failure returns false (fail-closed). A file we can't stat is one whose permissions we cannot verify; no key beats a key we cannot verify."
  - "Numeric interpolants (maxDepth, minConf, topK) coerced via Number() + Math.max/Math.min bounds. Belt-and-suspenders: object.toString() injection via a numeric parameter is unlikely but coerce anyway."
  - "HSI_TIMEOUT_MS named constant over inline 30000: future bumps are a one-line change; grep invariant 'timeout: HSI_TIMEOUT_MS' occurs exactly 12 times; 'timeout: 5000' must be 0; 'timeout: 15000' stays at 2 (generate-presentation.cjs intentional higher ceiling)."
  - "_test export keeps helpers pure and testable without widening public API. Convention: tests reach in via brain._test.sanitizeCypherInput, production callers use internal references."

patterns-established:
  - "Whitelist-first sanitization at the interpolation boundary (not at input validation): every Cypher-building function applies sanitizer immediately before string interpolation. Future Cypher helpers follow the same pattern."
  - "Permission-gate before secret read: every secret file read (API keys, tokens, credentials) must pass checkFilePermissions first. Failure returns false; read is skipped; warning printed to stderr."
  - "Named-constant timeout invariant: replace scattered magic numbers with one definition, enforce via grep count in the test suite."

requirements-completed:
  - SEC-01
  - SEC-02
  - SEC-03

# Metrics
duration: 14min
completed: 2026-04-19
---

# Phase 87 Plan 01: Security Trifecta (SEC-01 + SEC-02 + SEC-03) Summary

**Closed the confirmed Cypher injection vector (8 interpolation sites now pass through sanitizeCypherInput with a whitelist of [a-zA-Z0-9 ._-]), the confirmed API key file permission gap (checkFilePermissions refuses group/world-readable .env files), and the confirmed HSI premature-abort (12 timeout:5000 sites bumped to timeout:HSI_TIMEOUT_MS = 30000) in one atomic plan.**

## Performance

- **Duration:** approximately 14 min
- **Started:** 2026-04-19T (post 87-02 completion, same session)
- **Completed:** 2026-04-19
- **Tasks:** 2 completed (TDD RED + GREEN for Task 1-1; GREEN for Task 1-2 piggy-backed on same test file)
- **Files modified:** 3 (brain-client.cjs, intelligence-cascade.cjs, run-feynman-tests.cjs)
- **Files created:** 1 (security-trifecta.test.cjs)
- **Feynman suite:** 19/19 (pre) -> 20/20 (post, new test added and green)
- **Cascade-e2e:** exact-match baseline still green {INFORMS: 3, CONTRADICTS: 1, CONVERGES: 0, INVALIDATES: 1}
- **Zero runtime dependencies added.** Pure Node built-ins only.

## Accomplishments

- **SEC-01 closed.** sanitizeCypherInput applied at 8 Cypher interpolation sites in brain-client.cjs:
  - line 261 (smartSearch Neo4j fallback, queryText)
  - line 311 (enrichCausalEdges, sectionKeywords map)
  - line 317 (enrichCausalEdges, problemType CONTAINS)
  - line 436 (hatAwareRecommend, safeProblemType)
  - line 438 (hatAwareRecommend, avoidPatterns map)
  - line 508 (suggestValidationSteps, opportunity.problem)
  - line 509 (suggestValidationSteps, opportunity.domain)
  - line 675 (getFrameworkChain, entryFramework)
- **SEC-02 closed.** checkFilePermissions gates both getApiKey candidate paths (process.cwd()/.env and ~/.mindrian.env). Mode check: `(stat.mode & 0o077) !== 0` rejects 0644, 0664, any world/group-readable file. 0600 and 0400 pass. Windows returns true with a one-shot stderr warning.
- **SEC-03 closed.** HSI_TIMEOUT_MS = 30000 named constant in intelligence-cascade.cjs, replacing 12 prior `timeout: 5000` sites. The 2 intentional `timeout: 15000` sites (generate-presentation.cjs in runCascade + queueCascade) stay untouched.
- **Defence-in-depth.** Numeric interpolants in brain-client.cjs (maxDepth, minConf, topK) coerced via Number() and bounded with Math.max/Math.min before entering Cypher string.
- **Test coverage.** security-trifecta.test.cjs has 20 assertions covering:
  - sanitizeCypherInput: clean input preserved, Cypher injection payload stripped, each forbidden metachar (`"` `'` `` ` `` `{` `}` `$` `\`) absent from output, whitelist chars survive, null/undefined/non-string handled, newline stripped (no comment injection).
  - checkFilePermissions: exported, accepts 0600, rejects 0644, rejects 0664, accepts 0400, returns false for nonexistent file.
  - intelligence-cascade.cjs invariants: HSI_TIMEOUT_MS = 30000 defined, exactly 12 timeout:HSI_TIMEOUT_MS sites, zero remaining timeout:5000, 2 preserved timeout:15000.
  - brain-client.cjs invariants: 8+ sanitizer calls, 0 legacy `.replace(/"/g`, 3+ checkFilePermissions occurrences.
- **Feynman runner extended.** security-trifecta registered (Phase 87-01 comment tag). Count: 19 -> 20 tests, all green.

## Task Commits

1. **Task 1-1 (RED): add failing security trifecta test (SEC-01/02/03)** -- `e13f08f` (test)
   - 271 insertions: new lib/memory/security-trifecta.test.cjs (253 lines) + 3-line runner extension.
   - Red-phase verification: 1 passed, 19 failed (the 1 green was the "preserved timeout:15000" check which was already true pre-patch).
2. **Task 1-1 (GREEN): SEC-01/SEC-02 -- sanitizeCypherInput + checkFilePermissions** -- `35d114b` (fix)
   - brain-client.cjs: added both helpers, gated 2 .env reads, replaced 8 Cypher sites with sanitizer, added numeric coercion, exported helpers via `_test`.
   - Trifecta test: 17/20 (the 3 remaining failures are Task 1-2's cascade invariants, as planned).
3. **Task 1-2 (GREEN): SEC-03 -- bump HSI timeout 5000 -> 30000 across cascade** -- `e6a0e3a` (fix)
   - intelligence-cascade.cjs: new HSI_TIMEOUT_MS constant, 12 timeout replacements, preserved 2 intentional 15000 sites.
   - Trifecta test: 20/20. Feynman suite: 20/20. Cascade-e2e: baseline unchanged.

## Files Created/Modified

- `lib/core/brain-client.cjs` -- added `sanitizeCypherInput(value)` and `checkFilePermissions(envPath)` after BRAIN_URL; patched `getApiKey` to gate both .env candidate paths; replaced 8 `.replace(/"/g, '\\"')` instances with `sanitizeCypherInput(...)`; added numeric coercion for `maxDepth`, `minConf`, `topK`; exposed helpers via `module.exports._test`. Zero breakage to public API (`isAvailable`, `query`, `write`, `search`, `smartSearch`, `schema`, `stats`, `enrichCausalEdges`, `hatAwareRecommend`, `suggestValidationSteps`, `getFrameworkChain` unchanged).
- `lib/core/intelligence-cascade.cjs` -- added `HSI_TIMEOUT_MS = 30000` constant below existing `HSI_DEBOUNCE_MS`; replaced 12 `timeout: 5000` sites with `timeout: HSI_TIMEOUT_MS`. Preserved the 2 intentional `timeout: 15000` sites for `generate-presentation.cjs` (different script, documented higher ceiling out of scope).
- `lib/memory/security-trifecta.test.cjs` (NEW) -- 253 lines, 20 assertions covering SEC-01 / SEC-02 / SEC-03 + brain-client + intelligence-cascade file invariants. Runs standalone or inside feynman runner.
- `lib/memory/run-feynman-tests.cjs` -- 1-line addition registering security-trifecta with Phase 87-01 comment tag.

## Test Evidence

**Baseline (pre-patch):** `node lib/memory/run-feynman-tests.cjs` -> 19/19 passed.

**Post-RED (test added, no fix):** Trifecta test: 1 passed, 19 failed (expected).

**Post-Task-1-1 (SEC-01 + SEC-02 green):** Trifecta test: 17/20 passed (the 3 remaining failures are Task 1-2's cascade invariants).

**Post-Task-1-2 (SEC-03 green):** Trifecta test: 20/20 passed. Feynman suite: 20/20 passed. Cascade-e2e: `{INFORMS: 3, CONTRADICTS: 1, CONVERGES: 0, INVALIDATES: 1}` exact match. brain-client params regression suite: PASS (0 failures).

**Grep acceptance checks (Task 1-1):**
- `grep -c "sanitizeCypherInput" lib/core/brain-client.cjs` -> 10 (1 def + 8 call sites + 1 `_test` export; plan required >= 9).
- `grep -c "checkFilePermissions" lib/core/brain-client.cjs` -> 8 (1 def + 2 call sites in getApiKey + 5 doc/warn/mark references; plan required >= 3).
- `grep -c 'replace(/"/g' lib/core/brain-client.cjs` -> 0 (plan required 0; docstring at line 31 rephrased to avoid literal match).

**Grep acceptance checks (Task 1-2):**
- `grep -c "HSI_TIMEOUT_MS = 30000" lib/core/intelligence-cascade.cjs` -> 1 (plan required 1).
- `grep -c "timeout: HSI_TIMEOUT_MS" lib/core/intelligence-cascade.cjs` -> 12 (plan required 12).
- `grep -c "timeout: 5000" lib/core/intelligence-cascade.cjs` -> 0 (plan required 0).
- `grep -c "timeout: 15000" lib/core/intelligence-cascade.cjs` -> 2 (plan required 2; preserved at lines that host generate-presentation.cjs in runCascade and queueCascade).

## Decisions Made

See `key-decisions` frontmatter. In summary:

1. Whitelist-first, not blacklist/escape (closes injection vectors the legacy `.replace(/"/g, '\\"')` pattern left open: backtick, newline, `${...}`, Cypher comments).
2. sanitizeCypherInput defensive for null/undefined/non-string (returns '').
3. checkFilePermissions fails closed on stat errors and passes through on Windows with one-shot stderr warning.
4. Numeric interpolants coerced + bounded (defence-in-depth against `.toString()` tricks via object parameters).
5. HSI_TIMEOUT_MS named constant over inline 30000 (one-line future bumps; grep invariant).
6. `_test` export keeps helpers pure without widening the public surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Spec clarification] Test case for sanitizeCypherInput payload expected 'DROPTABLE--var' (no spaces); actual output is 'DROP TABLE --var' because space IS in the whitelist**

- **Found during:** Task 1-1 GREEN phase after initial RED passed 17/19.
- **Issue:** Plan's Test 2 in the action block stated `sanitizeCypherInput('DROP TABLE; --"\`\n${var}')` should return `'DROPTABLE--var'`. But the whitelist `/[a-zA-Z0-9 ._-]/` explicitly includes space (CONTEXT.md line 122). Space survives; only `;` `"` backtick `\n` `$` `{` `}` get stripped. Correct output is `'DROP TABLE --var'`.
- **Fix:** Test expectation corrected to `'DROP TABLE --var'`. Also added 6 additional `.includes` assertions proving each individual metachar (`;` `"` `` ` `` `\n` `$` `{`) is absent from the output, so the test is stronger than the plan's single-string equality check.
- **Files modified:** `lib/memory/security-trifecta.test.cjs` only (the test; the sanitizer is correct).
- **Verification:** 20/20 trifecta tests pass; feynman suite 20/20.
- **Committed in:** `35d114b` (GREEN phase; the test was authored post-RED but its fix traveled with the GREEN commit since the RED had authored an incorrect expectation).

**2. [Rule 3 - Doc hygiene] Rephrased sanitizer docstring to avoid matching the "legacy pattern" grep**

- **Found during:** Task 1-1 acceptance check.
- **Issue:** Initial docstring for sanitizeCypherInput contained the literal string `.replace(/"/g, '\\"')` as an explanation of what it replaces. The security-trifecta acceptance check `grep -c 'replace(/"/g' lib/core/brain-client.cjs` matched the docstring and reported 1 instead of 0.
- **Fix:** Rephrased docstring to describe the legacy pattern in prose ("single-quote-escape pattern that only escaped one metacharacter (double-quote)") without embedding the literal regex.
- **Files modified:** `lib/core/brain-client.cjs` (docstring only).
- **Verification:** `grep -c 'replace(/"/g' lib/core/brain-client.cjs` -> 0.
- **Committed in:** `35d114b` (same GREEN commit; caught before commit).

**3. [Rule 3 - Indentation variance] One of the 12 timeout:5000 sites had 6-space indent instead of 8**

- **Found during:** Task 1-2 first `replace_all` pass only replaced 11 of 12.
- **Issue:** Step 8 (compute-state) in runCascade uses a shallower indent (6 spaces) than the other 11 spawn sites (8 spaces inside nested try/catch blocks). The `replace_all` matched the exact string `        timeout: 5000,` (8 leading spaces) missing the `      timeout: 5000,` variant.
- **Fix:** Second targeted edit using the surrounding Step 8 context as the match string. Now all 12 timeouts point at HSI_TIMEOUT_MS.
- **Files modified:** `lib/core/intelligence-cascade.cjs`.
- **Verification:** `grep -c "timeout: 5000"` -> 0 (after). `grep -c "timeout: HSI_TIMEOUT_MS"` -> 12.
- **Committed in:** `e6a0e3a` (Task 1-2 commit).

---

**Total deviations:** 3 auto-fixed (1 test expectation correction, 1 docstring hygiene, 1 indentation variance). No architectural changes. No scope creep. Zero new runtime dependencies. Feynman suite grew 19 -> 20 as required.

## Issues Encountered

None beyond the deviations above. The legacy escape pattern was trivially replaceable once the sanitizer existed, and the HSI timeout bump was a pure find-and-replace.

## User Setup Required

None. This is pure internal defensive hardening. No environment variables, no external services, no user-facing configuration changes. Users on permissive .env files (chmod 644) will see a one-line stderr warning and fall through to MINDRIAN_BRAIN_KEY env-var path instead.

**Compatibility note for ops:** Any user with `~/.mindrian.env` or `cwd/.env` at mode 0644 (default on many systems) will stop getting their key auto-loaded after upgrading. They must `chmod 600 ~/.mindrian.env` OR export `MINDRIAN_BRAIN_KEY` in their shell. The stderr warning tells them exactly what to do. This is a SAFE REGRESSION -- before the patch their key was readable by any user on a multi-tenant box; after the patch it isn't.

## Known Stubs

None. sanitizeCypherInput is a 1-line whitelist regex; checkFilePermissions is a 10-line stat check; HSI_TIMEOUT_MS is a single constant. All three are fully wired to production call sites. No placeholder values, no TODO comments, no mock data.

## CHANGELOG Entry (for v1.10.11)

Recommended entry under `## [1.10.11]` -> `### Fixed`:

```
- Cypher injection vector closed in brain-client.cjs (SEC-01). sanitizeCypherInput()
  with whitelist [a-zA-Z0-9 ._-] is now applied at every Cypher interpolation site
  (8 total: smartSearch fallback, enrichCausalEdges, hatAwareRecommend,
  suggestValidationSteps, getFrameworkChain). The legacy .replace(/"/g, '\\"')
  pattern only escaped one metacharacter and was bypassable via backtick,
  newline, ${...} expansion, or Cypher comment. Numeric interpolants
  (maxDepth, minConf, topK) are now Number()-coerced and bounded for
  defence-in-depth.

- API key file permission check added (SEC-02). checkFilePermissions refuses to
  load MINDRIAN_BRAIN_KEY from a .env file with any group or world read bit
  set (mode & 0o077 != 0). 0600 and 0400 pass; 0644 and 0664 are rejected
  with a stderr warning instructing chmod 600. Applies to both the cwd .env
  and ~/.mindrian.env candidate paths. Windows returns true with a one-shot
  warning (NTFS ACLs are outside POSIX mode semantics).
  UPGRADE NOTE: Users with permissive .env files must chmod 600 or switch to
  MINDRIAN_BRAIN_KEY as a shell env var.

- HSI compute timeout bumped from 5000ms to 30000ms across the intelligence
  cascade (SEC-03). New HSI_TIMEOUT_MS constant in intelligence-cascade.cjs
  replaces 12 magic-number sites (compute-hsi.py, detect-reverse-salients.py,
  hsi-to-graph.cjs, classify-insight, check-hsi-deps, compute-state). Real
  rooms with 50+ artifacts were aborting mid-run under the 5s ceiling,
  producing partial .hsi-results.json and stale edges. The 2 intentional
  15000ms sites for generate-presentation.cjs stay intact.

- New Feynman test: lib/memory/security-trifecta.test.cjs (20 assertions).
  Feynman suite count 19 -> 20.
```

## Next Plan Readiness

- **87-01a (ROOM.md + MINTO.md git pre-commit hook installer):** Independent, can run in parallel. Does not touch brain-client or intelligence-cascade.
- **87-08 (Localhost live dashboard):** Independent, can run in parallel. Dashboard reads room.db + filesystem; does not interact with Brain.
- **87-10 (v1.10.11 release gate):** Now has 3/4 Stream A plans complete (87-00 cascade-e2e + 87-02 write-lock + 87-01 security trifecta). Waiting on 87-01a + 87-08.
- **87-03 (cascade deduplication, v1.10.12 Wave 2):** SAFE to run. HSI_TIMEOUT_MS constant carries through the refactor; extractor _runCascadeSteps(artifacts, options) will inherit the constant rather than re-hard-coding 30000.

**Wave 1 progress:** 3/4 Stream A plans complete after 87-00 + 87-02 + 87-01. Next up in parallel: 87-01a, 87-08.

## Self-Check: PASSED

All artifacts verified on disk:
- FOUND: lib/core/brain-client.cjs
- FOUND: lib/core/intelligence-cascade.cjs
- FOUND: lib/memory/security-trifecta.test.cjs
- FOUND: lib/memory/run-feynman-tests.cjs
- FOUND: .planning/phases/87-security-hardening-cascade-refactor/87-01-SUMMARY.md

All commits verified in git log:
- FOUND: e13f08f (Task 1-1 RED: failing security trifecta test)
- FOUND: 35d114b (Task 1-1 GREEN: SEC-01 + SEC-02 sanitizer + permission check)
- FOUND: e6a0e3a (Task 1-2 GREEN: SEC-03 HSI timeout 5000 -> 30000)

All tests verified green:
- node lib/memory/security-trifecta.test.cjs -> 20 passed, 0 failed
- node lib/memory/run-feynman-tests.cjs -> 20/20 passed, 0 skipped, 0 failed
- node test/fixtures/cascade-e2e/cascade-e2e.test.cjs -> exact-match baseline green
- node tests/test-brain-client-params.cjs -> PASS (0 failures, live smoke skipped)

All acceptance grep counts verified:
- grep -c sanitizeCypherInput  lib/core/brain-client.cjs        -> 10 (>= 9 required)
- grep -c checkFilePermissions lib/core/brain-client.cjs        -> 8  (>= 3 required)
- grep -c 'replace(/"/g'       lib/core/brain-client.cjs        -> 0  (== 0 required)
- grep -c "HSI_TIMEOUT_MS = 30000" lib/core/intelligence-cascade.cjs  -> 1 (== 1 required)
- grep -c "timeout: HSI_TIMEOUT_MS" lib/core/intelligence-cascade.cjs -> 12 (== 12 required)
- grep -c "timeout: 5000"      lib/core/intelligence-cascade.cjs -> 0  (== 0 required)
- grep -c "timeout: 15000"     lib/core/intelligence-cascade.cjs -> 2  (== 2 required)

---
*Phase: 87-security-hardening-cascade-refactor*
*Plan: 01*
*Completed: 2026-04-19*
