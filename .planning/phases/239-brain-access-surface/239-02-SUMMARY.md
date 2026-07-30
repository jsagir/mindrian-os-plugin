---
phase: 239-brain-access-surface
plan: 02
subsystem: security
tags: [canon-part-8, mcp-tool-matcher, hook-matcher, brain-boundary, anti-impersonation]

# Dependency graph
requires:
  - "239-01: tests/helpers/brain-capture-server.cjs, tests/run-all-239.sh"
provides:
  - "lib/core/brain-response-sanitize.cjs: BRAIN_TOOL_MATCHER exported constant, the single tool-name authority for the Brain MCP door"
  - "hooks/hooks.json: both Brain hook group matchers now equal BRAIN_TOOL_MATCHER, live on both plugin and project scope"
  - "tests/test-brain-response-sanitize.cjs: hooks.json-parity test case (converts future matcher drift into a red test)"
affects: [239-03-brain-tool-liveness, 239-04-hooks-json-fix, 239-07-verify-release-section-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One tool-name authority consumed by all three layers (hooks.json matchers + in-hook isBrainTool re-check), per 239-RESEARCH.md Pattern 2"
    - "Unanchored host matcher vs anchored in-code re-check, deliberate asymmetry documented in the source comment (T3 impersonation defense)"
    - "Assertions to INVERT rather than delete, per the Phase 243 precedent named in 239-RESEARCH.md Pitfall 5"

key-files:
  created: []
  modified:
    - lib/core/brain-response-sanitize.cjs
    - hooks/hooks.json
    - scripts/part8-egress-guard-hook.cjs
    - scripts/brain-response-sanitize-hook.cjs
    - tests/test-brain-response-sanitize.cjs

key-decisions:
  - "Test 10 (hook envelope shape) used the now-dead 'mcp__brain_query' literal as its tool_name fixture. After Task 1/2 correctly kill that dead name, the fixture would silently exercise the passthrough branch instead of the sanitize branch. Fixed in Task 3 to a live plugin-scoped name (mcp__plugin_mos_mindrian-brain__brain_query) so the test still proves what it claims to prove. This is a Rule 1 fix (a fixture the plan's own Task 1/2 changes broke), not a scope expansion -- the file was already in this plan's files_modified."
  - "tests/part8-egress-guard-hook.test.cjs (owned by sibling plan 239-04's files_modified) now fails bash tests/run-all-196.sh's PB8-04/05/07/08 leg, deterministically and reproducibly, because it ALSO fixtures the dead 'mcp__brain_query' / 'mcp__brain_ask' names and asserts the OLD (now-incorrect) behavior. This is the exact cross-plan handoff 239-RESEARCH.md Pitfall 3/5 and 239-PATTERNS.md predict: the fix is correctly scoped to this plan's files_modified, and the corresponding fixture inversion is explicitly owned by 239-04 (its files_modified lists tests/part8-egress-guard-hook.test.cjs, lib/core/part8-egress-guard.test.cjs, and two mva test files). Left untouched here per the cross-plan scope fence; documented as an expected, deferred regression rather than silently absorbed or silently ignored."

patterns-established:
  - "hooks.json-parity test pattern: any future phase adding a new hook matcher should add a companion test that walks hooks/hooks.json and asserts the matcher equals its exported module authority, so drift is caught by a red test rather than a silent no-op."

requirements-completed: [BRAIN-01]

# Metrics
duration: 30min
completed: 2026-07-30
---

# Phase 239 Plan 02: Close the B-1 Dead Seam at All Three Layers Summary

**Replaced the dead `mcp__brain_.*` literal (three independent copies: two `hooks.json` matchers plus the in-hook `isBrainTool` re-check) with one exported `BRAIN_TOOL_MATCHER` authority covering both plugin-scoped and project-scoped live Brain tool names, closing the PreToolUse egress guard and PostToolUse PII sanitizer gates that had been silently dead since the Brain server shipped inside the "mos" plugin.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-30T11:11:00Z (approx, first file read)
- **Completed:** 2026-07-30T11:29:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `lib/core/brain-response-sanitize.cjs` now exports `BRAIN_TOOL_MATCHER` (`mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*`), the single tool-name authority for the Brain MCP door. `isBrainTool` is now an anchored re-check (`^...$`) derived from that exact string, replacing the dead `indexOf('mcp__brain_') === 0` prefix test.
- Both `hooks/hooks.json` matchers (PreToolUse line 236, PostToolUse line 338) now equal `BRAIN_TOOL_MATCHER` byte for byte. Both hook scripts' comments were corrected to state reality instead of the false `mcp__brain_*` claim; zero functional code changed in either script.
- `tests/test-brain-response-sanitize.cjs`'s dead-name assertions are INVERTED (not deleted): both live scopes now assert `true`, the superseded `mcp__brain_query` / `mcp__brain_` forms now assert `false`. A new threat-T3 anti-impersonation test case and a new hooks.json-parity test case were added. Assertion count grew from 55 to 65.
- All three live mutation-and-restore proofs required by the plan (revert `isBrainTool`, stale one `hooks.json` matcher, delete the PostToolUse Brain group) were performed, observed RED with the correct failing assertion each time, and fully restored (`git diff --stat` empty on both mutated files after each restore).
- `bash tests/run-all-239.sh` Leg A (`BRAIN-01 dead-matcher literal census`) flipped from FAILED (per 239-01's baseline) to PASSED.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make lib/core/brain-response-sanitize.cjs the single tool-name authority** - `1f08a48e` (feat)
2. **Task 2: Re-point both hooks.json matchers and correct both hook-script comments** - `e5278d3c` (fix)
3. **Task 3: Invert the dead-name assertions and add the parity + T3 legs** - `760ca000` (test)

_No TDD tasks in this plan; all three are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `lib/core/brain-response-sanitize.cjs` - Added exported `BRAIN_TOOL_MATCHER` constant and a module-scoped compiled `_BRAIN_TOOL_RE`; `isBrainTool` now anchors against it. Docblocks rewritten to state the live name shape, both scopes, the anchoring asymmetry and its T3 reason, and a pointer to the sibling liveness gate (239-03).
- `hooks/hooks.json` - Both Brain hook group matchers (PreToolUse, PostToolUse) replaced with `BRAIN_TOOL_MATCHER`'s exact value. `git diff hooks/hooks.json` shows exactly 2 changed lines; no `command`, `timeout`, or other group touched.
- `scripts/part8-egress-guard-hook.cjs` - Comment above the `isBrainTool` re-check corrected (line ~140 region); code unchanged.
- `scripts/brain-response-sanitize-hook.cjs` - Header comments (lines 5, 9 region) corrected; code unchanged.
- `tests/test-brain-response-sanitize.cjs` - Test 10's fixture tool_name fixed (dead -> live), the `isBrainTool matcher` test case inverted with per-line Phase 239 rationale comments, a new T3 test case, and a new hooks.json-parity test case that walks the real file.

## Measured Before/After Values (transcribed per acceptance criteria)

**Task 1 (isBrainTool):**
```
BEFORE (per 239-RESEARCH.md, not re-derived):
  isBrainTool('mcp__plugin_mos_mindrian-brain__brain_query') === false
  isBrainTool('mcp__mindrian-brain__brain_query')            === false
  isBrainTool('mcp__brain_query')                            === true

AFTER (measured in this worktree):
  isBrainTool('mcp__plugin_mos_mindrian-brain__brain_query') === true
  isBrainTool('mcp__mindrian-brain__brain_query')             === true
  isBrainTool('mcp__plugin_mos_mindrian-brain__brain_ask')    === true
  isBrainTool('mcp__brain_query')                             === false
  isBrainTool('mcp__brain_')                                  === false
  isBrainTool('mcp__plugin_evil_evil-brain__brain_ask')       === false  (T3)
  isBrainTool('mcp__evil-brain__brain_ask')                   === false  (T3)
  isBrainTool('Read')                                         === false
  isBrainTool('mcp__supabase_query')                          === false
  isBrainTool('') / null / undefined                          === false / false / false
  BRAIN_TOOL_MATCHER === 'mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*'
grep -c "indexOf('mcp__brain_')" lib/core/brain-response-sanitize.cjs -> 0
grep -cP '\x{2014}' lib/core/brain-response-sanitize.cjs -> 0
```

**Task 2 (hooks.json + hook scripts):**
```
node -e "JSON.parse(...)" -> "valid json"
grep -c 'mcp__brain_\.\*' hooks/hooks.json -> 0
grep -c 'mcp__(?:plugin_\[a-z0-9_-\]+_)?mindrian-brain__\.\*' hooks/hooks.json -> 2

Programmatic parity one-liner (walks hooks.json, collects groups whose inner
command mentions part8-egress-guard-hook.cjs or brain-response-sanitize-hook.cjs):
  -> "ok 2"

Live matcher behavior:
  new RegExp('mcp__brain_.*').test('mcp__plugin_mos_mindrian-brain__brain_ask')                                  -> false (OLD)
  new RegExp('mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*').test('mcp__plugin_mos_mindrian-brain__brain_ask') -> true  (NEW)

Threat T3 negative on the unanchored host form:
  new RegExp('mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*').test('mcp__plugin_evil_evil-brain__brain_ask')    -> false

git diff hooks/hooks.json -> exactly 2 changed lines, no command/timeout/other-group touched
grep -c "mcp__brain_" scripts/part8-egress-guard-hook.cjs scripts/brain-response-sanitize-hook.cjs -> 0, 1
  (the single remaining occurrence in brain-response-sanitize-hook.cjs is inside a sentence
   explicitly labelling 'mcp__brain_.*' as the superseded dead literal, line ~12)
git diff --stat scripts/part8-egress-guard-hook.cjs scripts/brain-response-sanitize-hook.cjs
  -> comment-only changes in both files (verified by reading the diff; no line inside the
     try/catch bodies or function signatures changed)
```

**Task 3 (test inversion + mutation proofs):**
```
node tests/test-brain-response-sanitize.cjs -> exit 0, 17/17 subtests PASSED
grep -c "assert\." tests/test-brain-response-sanitize.cjs: BEFORE 55, AFTER 65 (strictly greater)
grep -c "prefix match per spec" tests/test-brain-response-sanitize.cjs -> 0

Mutation (a): reverted isBrainTool to indexOf('mcp__brain_')===0.
  node tests/test-brain-response-sanitize.cjs -> process exit 1 (pass 15, fail 2)
  Failing test named: "isBrainTool matcher: both live scopes true, superseded bare-prefix form false"
    (Test 10 also failed as expected collateral, since it now needs the corrected isBrainTool)
  Restored: git diff --stat lib/core/brain-response-sanitize.cjs -> empty; suite green again (17/17)

Mutation (b): staled hooks.json PreToolUse matcher back to 'mcp__brain_.*'.
  node tests/test-brain-response-sanitize.cjs -> process exit 1
  Failing test named: "hooks.json Brain matchers equal the exported BRAIN_TOOL_MATCHER authority"
  Restored: git diff --stat hooks/hooks.json -> empty; suite green again (17/17)

Mutation (c): deleted the PostToolUse Brain group from hooks.json.
  node tests/test-brain-response-sanitize.cjs -> process exit 1
  Failing assertion: "expected exactly 2 Brain hook groups in hooks.json, found 1" (1 !== 2)
    -- proves the parity test is NOT vacuous over an empty/reduced set
  Restored: git diff --stat hooks/hooks.json -> empty; suite green again (17/17)

No mutation remains in the final diff: git status --porcelain clean before Task 3's commit.

bash tests/run-all-239.sh Leg A before/after:
  BEFORE (239-01 baseline, from 239-01-SUMMARY.md):
    "--- BRAIN-01 dead-matcher literal census ---" ... ">>> BRAIN-01 dead-matcher literal census: FAILED"
    Summary: Passed: 2   Failed: 2   Skipped: 5
  AFTER (this plan):
    "--- BRAIN-01 dead-matcher literal census ---" ... ">>> BRAIN-01 dead-matcher literal census: PASSED"
    Summary: Passed: 3   Failed: 1   Skipped: 5
    (the remaining Failed leg is "239 test-file completeness", owned by sibling plans
     239-03 through 239-07 which have not landed yet)
```

## Decisions Made

- **Test 10 fixture repair (Rule 1).** `tests/test-brain-response-sanitize.cjs`'s hook-envelope test used the now-dead `mcp__brain_query` literal as `tool_name`. After the Task 1/2 fix correctly makes that name resolve to `false`, the hook would (correctly) take the passthrough branch and the test's assertions about `hookSpecificOutput` would fail. Updated the fixture to a live plugin-scoped name so the test still proves the sanitize-on-fire behavior it claims to prove. This file was already in this plan's `files_modified`, so this is a within-scope fix, not scope creep.
- **Cross-plan regression left untouched (deliberate, documented).** `bash tests/run-all-196.sh`'s `PB8-04/05/07/08 hook + F.1 gate + degrade` leg (backed by `tests/part8-egress-guard-hook.test.cjs`) now fails deterministically, because that file ALSO fixtures the dead `mcp__brain_query` / `mcp__brain_ask` names and asserts the pre-239 behavior. `239-04-PLAN.md`'s own `files_modified` explicitly claims `tests/part8-egress-guard-hook.test.cjs` (along with `lib/core/part8-egress-guard.test.cjs` and two `mva-*.test.cjs` files) for exactly this inversion treatment. Per the cross-plan scope fence and 239-RESEARCH.md's own Pitfall 3/5 framing, this is the anticipated, deferred half of the same fix -- not a bug this plan introduced carelessly. Re-ran `bash tests/run-all-196.sh` a second time to confirm the failure reproduces deterministically (not a sibling-collision artifact): both runs showed `Passed: 4   Failed: 1   Skipped: 0` with the identical failing leg.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Test 10's dead-name fixture broken by this plan's own Task 1/2 changes**
- **Found during:** Task 3
- **Issue:** `tests/test-brain-response-sanitize.cjs` Test 10 used `tool_name: 'mcp__brain_query'`, which the corrected `isBrainTool` now (correctly) resolves to `false`, causing the hook to take the passthrough branch instead of the sanitize branch the test asserts.
- **Fix:** Changed the fixture's `tool_name` to `mcp__plugin_mos_mindrian-brain__brain_query`, a live plugin-scoped name, so the test continues to exercise the positive-fire path.
- **Files modified:** `tests/test-brain-response-sanitize.cjs` (already in this plan's `files_modified`)
- **Commit:** `760ca000`

### Deferred (not fixed, out of this plan's scope)

**1. `tests/part8-egress-guard-hook.test.cjs` dead-name fixtures now fail `bash tests/run-all-196.sh`'s PB8-04/05/07/08 leg.** Root cause: same dead-literal problem this plan fixes, in a file this plan does not own. Owned by sibling plan `239-04` (`files_modified` explicitly lists it). Confirmed reproducible (ran the sweep twice, identical result both times), so this is a real, expected, deferred finding, not a sibling-collision artifact. No action taken here.

## Issues Encountered

None blocking. The one cross-file regression (above) was investigated, root-caused, confirmed reproducible, and correctly attributed to a sibling plan's ownership rather than fixed out of scope.

## User Setup Required

None. No external service configuration required. This plan touches only tracked source and test files already in the repo.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan's `<threat_model>` in `239-02-PLAN.md` is fully addressed by the delivered artifacts:
- T-239-T1 (matcher drift): mitigated via the single exported authority + the hooks.json-parity test (mutation (b)/(c) both confirmed RED).
- T-239-T3 (impersonation): mitigated via the anchored `isBrainTool` + bounded `[a-z0-9_-]+` prefix group; dedicated test case added and passing.
- T-239-T6 (fail-OPEN hook posture): documented as an accepted risk (A3), not flipped in this phase, per the plan's explicit instruction.
- T-239-T7 (vacuous coverage / repudiation): mitigated by inverting (not deleting) the superseded assertions and requiring three live observed-RED mutations, all performed and transcribed above.

No new network endpoints, auth paths, or schema changes were introduced.

## Release Liveness (standing hard rule, restated per plan instruction)

This `hooks/hooks.json` change on the `worktree-agent-acf1f8aa0b629f378` branch is NOT live for any installed user until it lands on `main`, a release ships, AND the user runs the two-command update (`/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace`). `~/.claude/plugins/mos/` install caches and any `dist/` artifacts still carry the old dead matcher until then. This is stated here per the standing memory rule (`feedback_dev_repo_fix_not_live_until_released.md`) and per `239-RESEARCH.md`'s own Runtime State Inventory section.

## Next Phase Readiness

- `lib/core/brain-response-sanitize.cjs`'s `BRAIN_TOOL_MATCHER` export is ready for `239-03`'s `scripts/check-brain-tool-liveness.cjs` and `tests/test-239-brain-tool-liveness.cjs` to consume as the claimed-name source for the live `tools/list` handshake comparison.
- `239-04` can now proceed with its own `files_modified` (the census-remaining literals in `agentshield-scanner.cjs`, `grill-engine.cjs`, `online-pattern-query.cjs`, `part8-egress-guard.test.cjs`, `tests/part8-egress-guard-hook.test.cjs`, both `mva-*.test.cjs` files) knowing the authority it needs to align against (`BRAIN_TOOL_MATCHER`) now exists and is stable.
- `239-07`'s `verify-release` section 18 can wire `checkHookMatcherLiveness` against the now-correct `hooks.json` matchers.
- No blockers. This plan's cross-phase scope fence held (zero files claimed by Phase 237/238 touched) and its cross-plan scope fence held (zero files claimed by sibling 239 plans' `files_modified` were modified, including the deferred `tests/part8-egress-guard-hook.test.cjs` regression documented above).

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*
