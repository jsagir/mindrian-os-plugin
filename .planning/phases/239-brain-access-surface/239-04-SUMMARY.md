---
phase: 239-brain-access-surface
plan: 04
subsystem: security
tags: [canon-part-8, mcp-tool-matcher, hook-matcher, brain-boundary, anti-impersonation, pii-sanitizer]

# Dependency graph
requires:
  - phase: 239-02
    provides: "lib/core/brain-response-sanitize.cjs BRAIN_TOOL_MATCHER authority, hooks/hooks.json re-pointed matchers"
  - phase: 239-03
    provides: "scripts/check-brain-tool-liveness.cjs enumerateLiveBrainTools/composeScopedNames/resolvePluginName/resolveServerName"
provides:
  - "tests/test-239-pii-sanitizer-liveness.cjs: the PostToolUse half of BRAIN-01, six legs (both live scopes fire, non-Brain passthrough, threat T3 foreign-server passthrough, superseded-name inertness, live mutation-and-restore proof)"
  - "lib/core/security/agentshield-scanner.cjs, lib/core/grill-engine.cjs, lib/core/eureka/online-pattern-query.cjs: zero remaining mcp__brain_ literals outside labelled superseded-example comments"
  - "tests/part8-egress-guard-hook.test.cjs: PB8-04 fixture repaired (resolves .planning/debug/resolved/part8-egress-guard-hook-fixture-stale-after-239-02.md), fixtures derived from live enumeration, threat-T3 negative case added"
  - "lib/core/part8-egress-guard.test.cjs: 7 in-process toolName fixtures moved to the bare form per the bare-vs-scoped decision rule"
affects: [239-07-verify-release-section-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare-vs-scoped decision rule: an in-process classify() call takes the BARE tool name (matching lib/core/bono/persona-research.cjs and brain-client.cjs's sendPacket belt); a hook or host matcher takes the SCOPED name (isBrainTool demands it)."
    - "Every live tool-name fixture derived at run time from scripts/check-brain-tool-liveness.cjs's enumerateLiveBrainTools() + composeScopedNames(), never hand-typed, with hand-typed literals reserved exclusively for deliberate negative fixtures (threat T3, the superseded dead name)."
    - "Zero-reference census guards (mva-detect.smoke.test.cjs, mva-orchestrator.test.cjs) are a distinct pattern from tool-name-liveness fixtures: the former assert NO reference in any form and must not be narrowed to track one specific live name."

key-files:
  created:
    - tests/test-239-pii-sanitizer-liveness.cjs
  modified:
    - lib/core/security/agentshield-scanner.cjs
    - lib/core/grill-engine.cjs
    - lib/core/eureka/online-pattern-query.cjs
    - lib/core/part8-egress-guard.test.cjs
    - tests/part8-egress-guard-hook.test.cjs
    - lib/core/mva-detect.smoke.test.cjs
    - lib/core/mva-orchestrator.test.cjs

key-decisions:
  - "agentshield-scanner.cjs's _scanBrainEgress default toolName: verdict is a LIVE call path (real production code on scanSurface's dispatch, reached whenever any future caller passes a string target without opts.toolName) but currently reached ONLY by test fixtures omitting opts.toolName; no shipped orchestrator (agentshield-run.cjs, agentshield-scan-cli.cjs) calls scanSurface('brain_egress', ...) today. Fixed to the BARE 'brain_query' form per the in-process decision rule, not the plan's must_haves artifact hint text ('contains: mindrian-brain__'), which conflicts with the plan's own deeper decision-rule analysis; documented as a deliberate deviation from the hint's literal wording, not its intent."
  - "part8-egress-guard.test.cjs got NO threat-T3 negative fixture: classify() has no tool-name authenticity check at all (that lives entirely in isBrainTool), so a foreign-server fixture there would assert nothing the module actually does. T3 coverage lives in tests/part8-egress-guard-hook.test.cjs (new) and tests/test-brain-response-sanitize.cjs (239-02)."
  - "mva-detect.smoke.test.cjs and mva-orchestrator.test.cjs's /mcp__brain_/ regexes were read first and left functionally UNCHANGED (comment-only): both are zero-reference census guards asserting NO Brain reference in any form inside deliberately Brain-free MVA source files, not tool-name-liveness fixtures. Narrowing them to the live matcher shape would weaken a defense-in-depth negative-literal set into a single-string tripwire."

patterns-established:
  - "A hook test (drives a script over stdin) and an in-process unit test (calls classify()/isBrainTool directly) take different tool-name forms for the same Brain concept -- SCOPED for the former, BARE for the latter -- and both must be recognized before editing a fixture, not assumed uniform."

requirements-completed: [BRAIN-01]

# Metrics
duration: 105min
completed: 2026-07-30
---

# Phase 239 Plan 04: PostToolUse Liveness Proof + Dead-Name Census Summary

**New tests/test-239-pii-sanitizer-liveness.cjs proves the inbound PII sanitizer fires on both live Brain scopes and stays inert on a foreign server or the dead name (with a live mutation-and-restore gate reopening proof); three non-test sources and four test files had their remaining `mcp__brain_` literals corrected or explicitly justified, resolving the part8-egress-guard-hook PB8-04 RCA and flipping `bash tests/run-all-196.sh` from 4/1/0 to 5/0/0.**

## Performance

- **Duration:** ~105 min
- **Started:** 2026-07-30 (first file read)
- **Completed:** 2026-07-30
- **Tasks:** 3 (plus RCA resolution)
- **Files modified:** 8 (1 new test, 3 non-test sources, 4 test files) + deferred-items.md + knowledge-base.md + RCA move

## Accomplishments

- `tests/test-239-pii-sanitizer-liveness.cjs` drives `scripts/brain-response-sanitize-hook.cjs` as a real child process across 6 legs: plugin-scoped live name fires the sanitizer (email PII rewritten to a `[REDACTED:xxxxxxxx]` placeholder), project-scoped live name fires it too (SSN PII rewritten), a non-Brain tool passes through untouched, a threat-T3 foreign server passes through unrewritten, the superseded dead name is inert, and a live mutation (revert `isBrainTool` to the pre-239 body, observe RED, restore byte-identical, observe GREEN) proves the gate is genuinely load-bearing. Every live name is derived at run time from `scripts/check-brain-tool-liveness.cjs`; the only two hand-typed literals are the deliberate negative fixtures for LEG 4 and LEG 5.
- `lib/core/security/agentshield-scanner.cjs`, `lib/core/grill-engine.cjs` (two sites): the dead `mcp__brain_query` / `mcp__brain_ask` defaults feeding in-process `classify()` calls are now the BARE form, matching the shipped `persona-research.cjs` / `sendPacket` precedent. `lib/core/eureka/online-pattern-query.cjs`'s stale comment now states the live matcher shape.
- `tests/part8-egress-guard-hook.test.cjs` (the RCA fix): every `tool_name` fixture is now a live SCOPED name derived from `scripts/check-brain-tool-liveness.cjs`, resolving `.planning/debug/resolved/part8-egress-guard-hook-fixture-stale-after-239-02.md`. Added a threat-T3 negative case. `bash tests/run-all-196.sh` moved from `Passed: 4 Failed: 1` to `Passed: 5 Failed: 0`.
- `lib/core/part8-egress-guard.test.cjs`: 7 in-process fixtures moved to the BARE form (functionally identical outcome, since `_isFreeFormTool`'s substring check matches either form; the fix removes the fabricated literal).
- `lib/core/mva-detect.smoke.test.cjs`, `lib/core/mva-orchestrator.test.cjs`: read first, left functionally unchanged with a verdict comment recorded in place (zero-reference census guards, not tool-name fixtures).
- `bash tests/run-all-239.sh`: the "BRAIN-01 PII sanitizer hook liveness" leg flipped from SKIPPED to PASSED; aggregate moved from `Passed: 5 Failed: 1 Skipped: 3` (post-239-03 baseline) to `Passed: 7 Failed: 1 Skipped: 1` (the remaining Failed/Skipped legs are 239-07's `verify-release` section 18 scope).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author tests/test-239-pii-sanitizer-liveness.cjs, the PostToolUse proof** - `9c2ce87e` (test)
2. **Task 2: Sweep the three non-test source files that still carry the dead tool name** - `eceb3560` (fix)
   - Follow-up: `5d8cb6c9` (docs) - logged a pre-existing, unrelated agentshield-e2e-smoke failure discovered during the regression sweep
3. **Task 3: Invert the remaining dead-name test fixtures** - `93e0b6e3` (test)
   - Follow-up: `26240326` (docs) - resolved the part8-egress-guard-hook-fixture-stale-after-239-02 RCA

_No TDD tasks in this plan; all three are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `tests/test-239-pii-sanitizer-liveness.cjs` - New, 6-leg PostToolUse liveness proof, ~290 lines.
- `lib/core/security/agentshield-scanner.cjs` - `_scanBrainEgress`'s default `toolName` moved from `'mcp__brain_query'` to bare `'brain_query'`; extensive comment recording the live-vs-fixture verdict and the bare-vs-scoped decision rule.
- `lib/core/grill-engine.cjs` - `buildArmAEgress`/`buildArmBEgress`'s `toolName` moved from `'mcp__brain_ask'` to bare `'brain_ask'` (2 sites).
- `lib/core/eureka/online-pattern-query.cjs` - Comment-only: corrected the stale `mcp__brain_.*` claim to state the live matcher shape.
- `lib/core/part8-egress-guard.test.cjs` - 7 sites moved from `mcp__brain_query`/`mcp__brain_ask` to bare form; header comment records the decision rule and why no T3 case was added here.
- `tests/part8-egress-guard-hook.test.cjs` - Rewritten to derive live scoped names at run time; added a threat-T3 negative case; the RCA fix.
- `lib/core/mva-detect.smoke.test.cjs`, `lib/core/mva-orchestrator.test.cjs` - Comment-only: recorded the zero-reference-census verdict in place.
- `.planning/phases/239-brain-access-surface/deferred-items.md` - Logged D-239-04-01 (pre-existing agentshield-e2e-smoke supply_chain baseline drift, out of scope).
- `.planning/debug/resolved/part8-egress-guard-hook-fixture-stale-after-239-02.md` - Moved from `.planning/debug/`, resolution note appended.
- `.planning/debug/knowledge-base.md` - New entry for the resolved RCA.

## Measured Before/After Values

**Task 1 (`tests/test-239-pii-sanitizer-liveness.cjs`), live run:**
```
ok  setup: derived a live plugin-scoped name (mcp__plugin_mos_mindrian-brain__brain_ask) and a live project-scoped name (mcp__mindrian-brain__brain_ask), neither hand-typed
ok  LEG 1: plugin-scoped live name fires the sanitizer -- seeded PII "jane@startup.com" rewritten to "[REDACTED:1aa8564f]"
ok  LEG 2: project-scoped live name fires the sanitizer -- seeded PII "123-45-6789" rewritten to "[REDACTED:01a54629]"
ok  LEG 3: non-Brain tool_name (Write) passes through, no hookSpecificOutput emitted, payload untouched
ok  LEG 4 (threat T3): foreign server name mcp__plugin_evil_evil-brain__brain_ask passes through unrewritten (anti-impersonation holds)
ok  LEG 5: superseded dead name mcp__brain_query is inert (passthrough) -- it never existed as a live production tool name
ok  LEG 6a: reverted isBrainTool reopens the dead seam -- the live plugin-scoped name from LEG 1 now falls through unrewritten
ok  LEG 6b: restore verified byte-identical, git diff --stat empty, LEG 1 green again
test-239-pii-sanitizer-liveness: all 6 legs PASSED (8 assertions ok)
```
`grep -cE "mcp__plugin_[a-z]|mcp__mindrian-brain__" tests/test-239-pii-sanitizer-liveness.cjs` -> 1 hit, exactly LEG 4's deliberate `mcp__plugin_evil_evil-brain__brain_ask` literal (the only exempt literal this grep pattern matches; LEG 5's `mcp__brain_query` does not match this specific pattern). `grep -cP '\x{2014}'` -> 0.

**Task 2 (census + regression sweep):**
```
grep -c "mcp__brain_" lib/core/security/agentshield-scanner.cjs lib/core/grill-engine.cjs lib/core/eureka/online-pattern-query.cjs
  -> 1, 1, 1 (all three are inside sentences explicitly labelling the superseded literal, quoted verbatim in each file's own diff)
git diff --stat lib/core/eureka/online-pattern-query.cjs -> comment lines only (verified by reading the diff)
git diff --stat dist/ CHANGELOG.md references/ -> EMPTY
grep -rlP '\x{2014}' <the 3 files> -> (no hits)

node lib/core/part8-egress-guard.test.cjs -> PASS
bash tests/run-all-196.sh -> Passed: 4 Failed: 1 Skipped: 0 (unchanged by Task 2; PB8-04 fix lands in Task 3)
node lib/core/security/agentshield-adapters.test.cjs -> PASS (AS-03/04)
node lib/core/security/agentshield-scanner.test.cjs -> PASS (AS-01/06/07)
node tests/agentshield-sessionstart-hook.test.cjs -> PASS (AS-05)
node tests/test-205-grill-engine.cjs -> PASS (12 checks)
node tests/agentshield-e2e-smoke.test.cjs -> FAILED, confirmed PRE-EXISTING (reverted this plan's 3 edits, re-ran, byte-identical failure: "e2e: agentshield-scan-cli.cjs must exit 0 against the live repo", caused by a supply_chain baseline drift on @huggingface/transformers and sqlite-vec, unrelated to BRAIN-01; re-applied this plan's edits afterward). Logged as D-239-04-01 in deferred-items.md.
```

**Task 3 (fixture inversion + mutation proof):**
```
Assertion counts (grep -c "assert\.", before -> after):
  lib/core/part8-egress-guard.test.cjs:        12 -> 12
  tests/part8-egress-guard-hook.test.cjs:      11 -> 14
  lib/core/mva-detect.smoke.test.cjs:          30 -> 30 (unchanged, comment-only)
  lib/core/mva-orchestrator.test.cjs:         106 -> 106 (unchanged, comment-only)

node lib/core/part8-egress-guard.test.cjs -> PASS
node tests/part8-egress-guard-hook.test.cjs -> PASS (PB8-04/05/07/08 + T3)
node lib/core/mva-detect.smoke.test.cjs -> 6 passed, 0 failed
node lib/core/mva-orchestrator.test.cjs -> 21 pass, 0 fail (node:test)

bash tests/run-all-196.sh:
  BEFORE (this plan's own baseline, confirmed live at session start): Passed: 4  Failed: 1  Skipped: 0
  AFTER:                                                              Passed: 5  Failed: 0  Skipped: 0

bash tests/run-all-239.sh:
  BEFORE (post-239-03 baseline, from 239-03-SUMMARY.md): Passed: 5  Failed: 1  Skipped: 3
  AFTER (this plan): Passed: 7  Failed: 1  Skipped: 1
    Per-leg: "BRAIN-01 dead-matcher literal census" PASSED, "239 test-file completeness" FAILED
    (missing tests/test-239-verify-release-section-18.cjs, sibling 239-07 scope),
    "BRAIN-01 tool liveness handshake + mutations" PASSED, "BRAIN-01 isBrainTool matcher unit"
    PASSED, "BRAIN-01 PII sanitizer hook liveness" PASSED (flipped from SKIPPED),
    "BRAIN-02 query egress canary + regressions" PASSED, "BRAIN-03 sendPacket parked census"
    PASSED, "BRAIN-01 verify-release section 18 wiring" SKIPPED (sibling 239-07 scope),
    "seam-liveness unit suite" PASSED.

MUTATION PROOF, transcribed:
  Reverted isBrainTool in lib/core/brain-response-sanitize.cjs to the pre-239 bare-prefix body.
  node tests/part8-egress-guard-hook.test.cjs -> FAILED:
    "AssertionError: PB8-04: CONTENT-SET on a Brain tool must exit 2 (block); 0 !== 2"
    (the EXACT failure mode .planning/debug/resolved/part8-egress-guard-hook-fixture-stale-after-239-02.md
    originally reported, reproduced on demand)
  Restored the file: git diff --stat lib/core/brain-response-sanitize.cjs -> EMPTY.
  Re-ran: node tests/part8-egress-guard-hook.test.cjs -> PASS again.

grep -c "mcp__brain_" lib/core/part8-egress-guard.test.cjs tests/part8-egress-guard-hook.test.cjs
  -> 2, 0. The 2 hits in part8-egress-guard.test.cjs are both inside the header comment
  explicitly naming the superseded literals ('mcp__brain_query' / 'mcp__brain_ask'), not fixtures.
grep -cE "mcp__plugin_mos|mcp__mindrian-brain__" tests/part8-egress-guard-hook.test.cjs -> 0
  (every live scoped name is derived at run time; zero hand-typed live literals)

mva-detect.smoke.test.cjs verdict: /mcp__brain_/ (line 181, inside the `forbidden` array at S6)
  matches the guard's own zero-reference census target (source files scripts/mva-detect.cjs,
  mva-classifier.cjs, mva-state.cjs), NOT a tool-name fixture -- left unchanged, comment added.
mva-orchestrator.test.cjs verdict: /mcp__brain_/ (line 332, inside Test 5's `forbidden` array)
  is the same zero-reference census pattern applied to mva-orchestrator.cjs's own source --
  left unchanged, comment added.

grep -rlP '\x{2014}' over all 8 files_modified -> only lib/core/mva-orchestrator.test.cjs,
  and those 4 hits (lines 175, 367, 480, 484) are PRE-EXISTING regex literals whose entire
  purpose is detecting em-dash ABSENCE elsewhere (assert.equal(x.match(/—/), null, ...));
  confirmed via `git diff ... | grep '^+' | grep -P '\x{2014}'` returning zero matches, i.e.
  none of this plan's own added lines contain an em-dash.
```

## Decisions Made

See frontmatter `key-decisions`. Restated:

1. **`agentshield-scanner.cjs` bare-form choice overrides the plan's must_haves hint text.** The plan's `must_haves.artifacts` block says this file should `contains: "mindrian-brain__"`, implying the SCOPED form. The plan's own Task 2 action text says the opposite for an in-process `classify()` call site (BARE form, matching shipped precedent), and explicitly instructs "verify by reading the surrounding call, do not apply the rule blind." Read `part8-egress-guard.cjs`'s `classify()`/`_isFreeFormTool` in full: `toolName` is consumed only via a substring `indexOf` check on `'brain_ask'`/`'brain_query'`, satisfied identically by either form, so the functional verdict is unaffected either way. Chose the BARE form per the plan's own deeper decision rule and to avoid embedding a plugin-specific scoped literal (`mos`/`mindrian-brain`) into a LOCAL, offline module that would drift again on a future rename. The live scoped forms are still named explicitly in the added comment (satisfying the hint's intent, not its literal wording).
2. **No T3 negative fixture added to `part8-egress-guard.test.cjs`.** `classify()` itself has zero tool-name authenticity logic; T3 is enforced entirely by `isBrainTool`, already covered by the new `tests/part8-egress-guard-hook.test.cjs` case and 239-02's `tests/test-brain-response-sanitize.cjs` case. Adding one here would assert nothing this specific module does.
3. **`mva-*` test files left functionally unchanged.** Read-first-before-editing confirmed both `/mcp__brain_/` regexes are zero-reference census guards (assert NO Brain reference in ANY form inside deliberately Brain-free source), not tool-name-liveness fixtures. Updating them to the live matcher shape would narrow a defense-in-depth negative-literal set to a single dead string, which is a regression in coverage, not an improvement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, the plan's own named RCA] Fixed `tests/part8-egress-guard-hook.test.cjs`'s stale dead-name fixture (PB8-04)**
- **Found during:** Task 3 (also flagged by the parallel-execution prompt as this plan's own known fix target)
- **Issue:** `scripts/part8-egress-guard-hook.cjs` calls `isBrainTool()` before `classify()`; the fixture's dead `mcp__brain_query`/`mcp__brain_ask` literals failed `isBrainTool` post-239-02, so the CONTENT-SET-on-a-Brain-tool case silently no-opped (exit 0 instead of the asserted exit 2).
- **Fix:** Every live fixture derived at run time from `scripts/check-brain-tool-liveness.cjs`; added a threat-T3 negative case.
- **Files modified:** `tests/part8-egress-guard-hook.test.cjs`
- **Verification:** `bash tests/run-all-196.sh` moved from `Passed: 4 Failed: 1` to `Passed: 5 Failed: 0`; mutation proof reproduced and then re-fixed the exact original failure.
- **Committed in:** `93e0b6e3` (Task 3), RCA resolved in `26240326`

### Deferred (not fixed, out of this plan's scope)

**1. `tests/agentshield-e2e-smoke.test.cjs` fails on a pre-existing `supply_chain` baseline drift** (`@huggingface/transformers`, `sqlite-vec` flagged `ambiguous`, not in `references/security/agentshield-baseline.json`). Confirmed pre-existing by reverting Task 2's edits and re-testing (byte-identical failure) before re-applying them. Entirely outside this plan's `files_modified` and outside BRAIN-01/02/03. Logged as `D-239-04-01` in `deferred-items.md`.

---

**Total deviations:** 1 auto-fixed (Rule 1, the plan's own named RCA target), 1 deferred (out-of-scope pre-existing baseline drift).
**Impact on plan:** The auto-fix is exactly this plan's declared scope (the RCA file explicitly named `239-04` as owner). The deferred item is a genuine pre-existing issue unrelated to Brain tool-name liveness; no scope creep.

## Issues Encountered

None blocking. The one cross-file discovery (agentshield-e2e-smoke's baseline drift) was investigated, root-caused, confirmed pre-existing via a revert-and-retest, and correctly logged rather than fixed out of scope.

## User Setup Required

None. No external service configuration required. This plan touches only tracked source and test files already in the repo.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan's `<threat_model>` in `239-04-PLAN.md` is fully addressed:
- T-239-T1 (matcher drift / PostToolUse): mitigated via `tests/test-239-pii-sanitizer-liveness.cjs`'s LEG 6 mutation proof.
- T-239-T3 (impersonation): mitigated via LEG 4 (new PII sanitizer test) and the new foreign-server negative case in `tests/part8-egress-guard-hook.test.cjs`.
- T-239-T7 (vacuous coverage / repudiation): mitigated by deriving every live fixture from the enumeration and by the two live mutation-and-restore proofs (Task 1's embedded LEG 6, Task 3's ad-hoc transcribed proof).
- T-239-04-A (agentshield-scanner runtime default): mitigated, verdict stated explicitly (live call path, no current production reacher) rather than fixed silently.

No new network endpoints, auth paths, or schema changes were introduced.

## Release Liveness (standing hard rule, restated per plan instruction)

None of this plan's changes touch `hooks/hooks.json` or any user-facing runtime hook wiring (that landed in 239-02/239-03). This plan's changes are test/dev-time artifacts plus in-process default corrections in `lib/core/security/agentshield-scanner.cjs` and `lib/core/grill-engine.cjs` that were never live in any shipped orchestrator path today. Per the standing memory rule (`feedback_dev_repo_fix_not_live_until_released.md`), any future phase that DOES wire these paths into a shipped orchestrator is not live for installed users until a release ships and is picked up via the two-command update.

## Next Phase Readiness

- `tests/run-all-239.sh`'s only remaining `Failed`/`Skipped` legs (`239 test-file completeness`, `verify-release` section 18 wiring) are entirely owned by sibling plan `239-07` -- untouched by this plan.
- No blockers. This plan's cross-phase scope fence held (zero files claimed by Phase 237/238 touched) and its cross-plan scope fence held (zero files claimed by sibling 239 plans' `files_modified` were modified; `lib/core/brain-response-sanitize.cjs` and `hooks/hooks.json` were only ever mutated-and-restored at test/verification runtime, never left changed).

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: tests/test-239-pii-sanitizer-liveness.cjs
- FOUND: lib/core/security/agentshield-scanner.cjs
- FOUND: lib/core/grill-engine.cjs
- FOUND: lib/core/eureka/online-pattern-query.cjs
- FOUND: lib/core/part8-egress-guard.test.cjs
- FOUND: tests/part8-egress-guard-hook.test.cjs
- FOUND: lib/core/mva-detect.smoke.test.cjs
- FOUND: lib/core/mva-orchestrator.test.cjs
- FOUND: .planning/debug/resolved/part8-egress-guard-hook-fixture-stale-after-239-02.md
- FOUND: commit 9c2ce87e (Task 1)
- FOUND: commit eceb3560 (Task 2)
- FOUND: commit 5d8cb6c9 (Task 2 follow-up docs)
- FOUND: commit 93e0b6e3 (Task 3)
- FOUND: commit 26240326 (Task 3 follow-up docs, RCA resolution)
