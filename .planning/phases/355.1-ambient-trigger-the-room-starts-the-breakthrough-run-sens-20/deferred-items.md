# Phase 355.1 Deferred Items

Out-of-scope or accepted-with-follow-up findings surfaced during 355.1 plan
execution, logged here rather than fixed in place. Each entry names the
plan that surfaced it, the accepting decision, and the concrete follow-up.

## 1. Ambient eureka adapter ranks by raw abs_diff only (plan 355.1-07)

**Surfaced:** plan 355.1-07 (ambient composition), documented in
`355.1-07-SUMMARY.md` tech-stack pattern "the eureka adapter's own ranking
is a deliberate simplification".

**Finding:** `lib/core/ambient-run.cjs`'s eureka adapter scores pairs with
the real `scoreMeasured`, sorted by `abs_diff`, top `AMBIENT_TOP_N`, then
stamped via the real `stampRankedPairs` / `eurekaEndpoints`. It does not run
`scripts/eureka-portfolio-report.cjs`'s full AHP-weighted /
tail-quadrant-ranking portfolio-dimensions pipeline. That file exposes no
isolated "rank only, never bank" export to compose against instead;
replicating its full ~2000-line `main()` pipeline inline was out of plan
355.1-07's reasonable scope.

**Accepted at:** the 355.1 checkpoint, 2026-09-27 (navigator ruling item 11,
`355.1-CHECKPOINT.md` `## Navigator ruling`). Accepted for Phase 355.1 as
filed; not overturned; not blocking plans 355.1-09 through 355.1-14.

**Follow-up:** extract a rank-only export from
`scripts/eureka-portfolio-report.cjs` in the upcoming MCP
intelligence-layer phase, so the ambient composition (and any other
in-process caller) can reuse the full AHP-weighted / tail-quadrant ranking
instead of the raw `abs_diff` simplification.

## 2. tests/test-3551-hooked-audit.cjs trips the em-dash leg (plan 355.1-08 file, surfaced during plan 355.1-09)

**Surfaced:** plan 355.1-09, Task 3's own `bash tests/run-all-3551.sh` full
run (the first full-aggregator run since plan 355.1-08 landed
`tests/test-3551-hooked-audit.cjs`, commit `55a10b272`).

**Finding:** `run-all-3551.sh`'s em-dash leg (section 9, `emdash_scan`)
globs every `tests/test-3551-*.cjs` file as "new 355.1 content" and greps
it whole for a literal U+2014. `tests/test-3551-hooked-audit.cjs` lines 90
and 116 contain the literal em-dash character INSIDE a string literal
(`auditText.indexOf('—') === -1`) used to assert the audited
markdown carries none -- the check needs the literal character to compare
against. This is a false positive in the em-dash leg's own whole-file scan
against a test file that legitimately carries the character as a
comparison literal, not as prose. Zero em-dashes exist in any of this
plan's own three files (`tests/test-3551-child.cjs`,
`lib/core/ambient-run.cjs`, `scripts/auto-explore-fire.cjs`, confirmed via
`grep -cP '\x{2014}'` against each, all 0).

**Scope:** out of plan 355.1-09's `<files>` list (`tests/test-3551-child.cjs`,
`lib/core/ambient-run.cjs`, `scripts/auto-explore-fire.cjs`); the file that
trips the leg was authored by plan 355.1-08 and neither read nor modified by
this plan. Per the executor's scope-boundary discipline, logged here rather
than fixed in place.

**Follow-up:** a future plan (or the phase's own close-out) should either
narrow `emdash_scan`'s `NEW_FILES` glob to exclude a legitimate comparison
literal, or have `tests/test-3551-hooked-audit.cjs` construct the character
via `String.fromCharCode(0x2014)` instead of a literal, so the leg's own
intent (catch em-dash PROSE, not a comparison literal) is preserved without
a false positive.

**Resolved:** plan 355.1-10 (orchestrator-assigned fix, ahead of its own
Task 1), commit `75cef3cfb`. `tests/test-3551-hooked-audit.cjs`'s two
em-dash assertions now compare against `EM_DASH_CHAR`
(`String.fromCharCode(0x2014)`, defined once), so the file holds no
literal U+2014 byte anywhere (`grep -c $'\xe2\x80\x94'
tests/test-3551-hooked-audit.cjs` prints 0). Behavior unchanged: the same
two assertions, same 18/18 pass. `bash tests/run-all-3551.sh` is back to
exactly the 4 baseline failures `355.1-BASELINE.md` documents.

## 3. tests/test-auto-explore-canon-part-8.cjs Test 2 fails pre-existing at HEAD (surfaced during plan 355.1-14 Task 3 verification)

**Surfaced:** plan 355.1-14, Task 3's own orchestrator-directed verify sweep
(`node tests/test-auto-explore-canon-part-8.cjs`, not named in
355.1-BASELINE.md's 4 documented gaps).

**Finding:** Test 2 ("hooks/hooks.json contains mcp__brain_.* matcher
invoking brain-response-sanitize-hook.cjs") asserts an exact matcher string
`entry.matcher === 'mcp__brain_.*'` on a `PostToolUse` entry. The current
`hooks/hooks.json` `PostToolUse` matcher for the sanitizer hook has since
been widened by a later, unrelated phase to
`"mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+)"`
(covering plugin-prefixed and non-`brain_`-suffixed server names), so the
test's exact-string comparison no longer matches even though
`brain-response-sanitize-hook.cjs` is still wired to the same matcher
family. Confirmed pre-existing and unrelated to plan 355.1-14: reverting
`hooks/hooks.json` to its HEAD state immediately before Task 3's own edit
(commit `798d6f0a9`, before the new async Stop entry was added) and
re-running the test reproduces the identical single failure.

**Scope:** out of plan 355.1-14's `<files>` list intent (the plan's own
`hooks/hooks.json` edit is scoped to the Stop array only, per its own
acceptance criteria: "every other entry deep-equals its BASE_3551 value").
Per the executor's scope-boundary discipline, logged here rather than
fixed in place.

**Follow-up:** a future plan (or phase close-out) should update
`tests/test-auto-explore-canon-part-8.cjs` Test 2's assertion to match the
matcher's current widened regex (or to a substring/family check) rather
than an exact legacy string, so the test again reflects the shipped
wiring.

## 4. `355.1-REVIEW.md` WARNING and INFO findings (surfaced by the 2026-09-27 code review, out of scope for the criticals-only fix pass)

**Surfaced:** `355.1-REVIEW.md` (deep review, 2026-09-27, `gsd-code-reviewer`),
during the same pass that raised CR-01..CR-04 (all 4 fixed; see that file's
own "Fix record" section). The navigator approved fixing the criticals
before the release cut; WARNING and INFO findings were explicitly out of
scope for that pass and are logged here, open, rather than fixed.

- **WR-01** (`lib/core/ambient-trigger.cjs:277-308`): `evaluateAndClaim`'s
  delta-state write and `claimAmbientRun`'s ledger write are two separate
  non-atomic file operations; a crash/kill between them leaves an
  inconsistent claim. Fix: write the delta-state side channel before (or as
  part of) the ledger claim, or make `tamper_or_stale` recovery symmetrical
  (CR-02's fix already makes the recovery side of this symmetrical; the
  ordering itself is unchanged).
- **WR-02** (`lib/core/ambient-run.cjs:298`): `_findBottlenecksAdapter`'s
  outcome ternary (`findings.length > 0 ? 'no_candidate' : 'no_candidate'`)
  is a no-op; both branches are identical. Fix: delete the ternary, or
  introduce a real distinguishing outcome value in
  `AMBIENT_PRODUCER_OUTCOMES` and use it consistently across all five
  adapters.
- **WR-03** (`scripts/scout-cadence-guard.cjs:672-678`): `claimAmbientRun`
  always bumps `runs_window.count` regardless of whether the claim ever
  leads to a completed run, so CR-01/CR-02's phantom-claim paths can exhaust
  the hourly cap on claims that never ran. CR-02's fix (this pass) releases
  `ledger.in_flight` on every abort path but deliberately leaves
  `runs_window.count` untouched -- this finding is the refund/no-count fix
  for that counter, explicitly deferred. Fix: only advance
  `runs_window.count` from `recordAmbientRun` (an actual attempt that
  reached composition), or refund it from the release path.
- **WR-04** (`lib/core/ambient-run.cjs:515-550`): no timeout wraps a single
  producer adapter's `await` inside `runAmbientComposition`'s loop; a single
  hung producer (e.g. an unbounded `rs-engine.py` subprocess) can stall the
  whole composition past its nominal 4-minute budget, feeding directly into
  CR-03's stale-lock scenario (CR-03 itself is fixed this pass; this finding
  is about not creating that condition in the first place). Fix: wrap each
  `adapterFn` call in a `Promise.race` against the remaining budget.
- **WR-05** (`lib/core/ambient-trigger.cjs:337-348`): detached-child
  survival under `spawnImpl` is unverified on native Windows (Job Object
  `CREATE_BREAKAWAY_FROM_JOB` semantics; only confirmed on Linux/WSL). Fix:
  confirm on real Windows, or document the known limitation if the child
  does not survive.
- **IN-01** (`lib/core/ambient-trigger.cjs:91`, `scripts/ambient-stop.cjs:30`,
  `lib/core/ambient-run.cjs:804`): the `MINDRIAN_AMBIENT_DEBUG` env var name
  is declared as a named constant in two files and used as a bare string
  literal in the third, so a future rename desyncs silently. Fix: export
  `AMBIENT_DEBUG_ENV` from one module and import it in the other two.
- **IN-02** (`lib/core/ambient-trigger.cjs:256-258`): `evaluateRoomDelta`'s
  outermost catch maps every uncaught exception to `'no_room'`, a
  misleading label for a genuine internal defect. Fix: introduce a distinct
  `'internal_error'` terminal decision for this catch.

**Follow-up:** a future plan should pick up WR-01 through WR-05 and IN-01/
IN-02 as its own scoped fix pass (or fold WR-03 in alongside any future
CR-02 revisit, since the two are related); none block the 355.1 release
train per the navigator's ruling recorded above.
