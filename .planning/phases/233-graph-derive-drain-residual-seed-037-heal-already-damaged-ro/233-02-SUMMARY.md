---
phase: 233-graph-derive-drain-residual-seed-037
plan: 02
subsystem: infra
tags: [graph-derivation, drain, backfill, producer-parity, canon-part-8, cjs, rca-4b, rca-4e]

# Dependency graph
requires:
  - phase: 169-graph-derivation-harness
    provides: the runDerivation composer, CASCADE_SUBSET, the enqueue-then-drain split
  - phase: 224-02
    provides: the LOCAL score-based producer default on BOTH the drain and the backfill, reconcileQueue, MAX_DERIVE_ATTEMPTS
  - phase: 232.1
    provides: openRoomDbReadOnlyForCaller, the read-only room.db door the parity test reads edges through
provides:
  - runDerivation's default deriveFn gated behind MINDRIAN_ALLOW_HOSTED_DERIVE + a funded-key check
  - deriveFn_required_no_hosted_default, a named synchronous contract error
  - tests/test-233-drain-backfill-producer-parity.cjs, the regression that pins one producer across both triggers
  - a drain header whose doctrine matches reconcileQueue and states the headless/in-session division of labor
affects: [233-03 (Section 9 HSI/pipeline work), any future runDerivation caller, any future edit to either derive trigger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate, do not delete: a dead default becomes unreachable-by-accident via an explicit env opt-in plus a funded-key proxy, so a deliberately-configured deployment keeps byte-identical behavior"
    - "Fail fast at the top of the composer: the contract throw lands before openRoomDb and before the first pair, so a forgotten argument can never half-open a room"
    - "Two-legged parity proof: a comment-stripped SOURCE assertion plus a LIVE assertion that swaps the shared module export for a recorder. Each leg was independently mutation-proven, because either alone passes on a case the other catches"
    - "Honesty check on a grep gate: A4 asserts the UNSTRIPPED source DOES contain the forbidden token, so the comment-stripped gate cannot pass vacuously"
    - "Fixture determinism on the TIME axis: when product behavior keys off mtime ordering, two 'identical' fixture rooms must be explicitly stamped, or filesystem timestamp granularity becomes an uncontrolled test variable"

key-files:
  created:
    - tests/test-233-derivation-default-gate.cjs
    - tests/test-233-drain-backfill-producer-parity.cjs
  modified:
    - lib/core/graph-derivation.cjs
    - scripts/gsd-graph-derive-drain.cjs
    - lib/memory/run-feynman-tests.cjs
    - CHANGELOG.md

key-decisions:
  - "GATE, not retire (233-CONTEXT.md leaves retire-vs-gate to discretion). A live code audit confirmed all 8 real runDerivation call sites already inject deriveFn, so removal and gating are behaviorally identical for everything shipped. Gating additionally preserves a deliberately-configured hosted deployment, which removal would silently break"
  - "Key PRESENCE, not a live balance probe, is the funded-key proxy. A balance probe is a network call this SYNCHRONOUS composer cannot make, and presence is the exact proxy graph-candidate-producer's own _resolveDefaultLlm already uses (anthropic_api_key_missing)"
  - "The throw is placed at the deriveFn resolution line, which is the second statement of the function body. It therefore precedes openRoomDb and every pair, satisfying the plan's 'never a live 400' requirement structurally rather than by ordering luck"
  - "The parity test proves parity TWICE, by source and by live invocation, because the plan's success criterion explicitly forbids proving it by re-reading the source and trusting it. Mutation testing showed the two legs catch DIFFERENT failure modes: a source-only mutant trips A2, and a mutant that keeps the literal token while resolving to a different function passes A2 and trips B2"
  - "The fixture rooms are mtime-stamped. buildAllPairs orders each pair by mtimeMs (correct: the INFORMS direction rule composes off older-informs-newer), so two separately-built rooms are only truly identical if their mtime RELATIONSHIPS match. They do not, reproducibly. Stamping removes the variable so the assertion measures which producer ran, not filesystem timing"

patterns-established:
  - "A test whose claim is 'X and Y do the same thing' must be mutation-proven in both directions before it is trusted, otherwise it is a comment with a test file around it"
  - "A newly-written test that fails intermittently is root-caused, not retried. The 2-in-6 flake here was a real defect in the test's fixture assumption and was traced to the exact mtime tie before any fix was written"

requirements-completed: ["4b", "4e"]

# Metrics
duration: 13min
completed: 2026-07-28
---

# Phase 233 Plan 02: Gate the dead hosted-API derive default + pin drain/backfill producer parity Summary

**`runDerivation` no longer silently falls back to a hosted Anthropic account that has been out of credit for months; and the long-standing prose claim that the headless drain and the in-session `/mos:graph --derive` backfill share one local producer is now a mutation-proven regression instead of a comment.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-27T21:18:41Z (base commit `7890e434`)
- **Completed:** 2026-07-27T21:31:11Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **RCA 4b closed.** `runDerivation`'s default `deriveFn` was an unconditional `require('./graph-candidate-producer.cjs').produceCandidates`, whose default transport is a direct fetch to `api.anthropic.com`. The RCA's Section 3 item 1 probed that account live and got `400 credit balance is too low`. So a caller who forgot to inject `deriveFn` did not get a contract error at the point of the mistake; it got working-looking code that failed later, over the network, for a reason unrelated to the actual bug. That is the exact "reachable by accident" footgun class this phase exists to close. The default is now resolved through `_resolveDefaultDeriveFn()`, which requires `MINDRIAN_ALLOW_HOSTED_DERIVE === '1'` **and** a non-empty `ANTHROPIC_API_KEY`, and otherwise throws `deriveFn_required_no_hosted_default` synchronously.
- **The gate is a gate, not a deletion.** An operator who deliberately sets both still gets `produceCandidates`, byte-identically. 233-CONTEXT.md left retire-vs-gate to discretion and required only that the dead default stop being reachable by accident.
- **Zero regression to every real caller, verified rather than assumed.** `grep -rn "runDerivation(" lib scripts tests --include=*.cjs` confirmed all 8 live call sites (the drain, the backfill twice, and five test files) already inject `deriveFn` explicitly. All five existing derivation suites were run **unmodified** afterward.
- **RCA 4e closed.** The drain header's intro paragraph still claimed it "runs `runDerivation` once per queued room, **and CLEARS the drained entry**". That stopped being true on 2026-07-23 when Phase 224-02 introduced `reconcileQueue`: only a SUCCEEDED entry clears, a FAILED entry is KEPT and retried up to `MAX_DERIVE_ATTEMPTS`. The header now says what actually happens and adds the explicit division of labor RCA 4e demanded. The already-correct "Failure discipline" paragraph below it is **byte-unchanged**, verified by diff against the pre-task file.
- **The core claim of this plan is proven, not asserted.** The plan's own success criterion says: confirm the headless drain and the in-session backfill wire the SAME local producer, "with a real code-path trace or a regression test, not an assertion". `tests/test-233-drain-backfill-producer-parity.cjs` does it twice over (see Verification Evidence), and **both legs were mutation-proven to catch different failure modes.**
- **Canon Part 8 held.** Zero Brain egress in any touched path. The gate makes an already-LOCAL Anthropic transport harder to reach by accident; it opens no new wire. The parity test satisfies the encoder probe with an injected `encodeFn` seam and never dials anything.

## Task Commits

1. **Task 1: Gate runDerivation's dead hosted-API default (4b)** - `861df5ec` (test, RED) then `91d3b07e` (feat, GREEN)
2. **Task 2: Drain/backfill producer parity + reconcile the drain doctrine comment (4e)** - `fb31472d` (fix)

_Task 1 was TDD: the 10-scenario suite was written and confirmed failing (`AssertionError: 1. no deriveFn + no opt-in throws synchronously`) before `_resolveDefaultDeriveFn` existed._

_Note: commits `47871ae2`, `41637d40`, `1d82c7a9`, `a2425c0b` interleaved in `git log` belong to a concurrent `quick-260728-051` session on this shared tree. They are not part of this plan._

## Files Created/Modified

- `lib/core/graph-derivation.cjs` - `_resolveDefaultDeriveFn()` plus the resolution-line swap; the function docblock now states the new contract
- `scripts/gsd-graph-derive-drain.cjs` - header intro paragraph only (reconcile behavior + DIVISION OF LABOR block); "Failure discipline" paragraph byte-unchanged
- `tests/test-233-derivation-default-gate.cjs` - 10 scenarios (11 assertions)
- `tests/test-233-drain-backfill-producer-parity.cjs` - 14 assertions across two independent proof legs
- `lib/memory/run-feynman-tests.cjs` - both new suites registered
- `CHANGELOG.md` - one Unreleased `### Fixed` bullet covering RCA 4b and 4e, repo voice, no em-dashes

`tests/run-all-233.sh` needed no edit: Plan 01 built it to glob-discover `tests/test-233-*.cjs`, exactly so downstream plans add coverage without touching it. That design paid off here.

## Decisions Made

All six key decisions are in the frontmatter. The two that matter most:

**Gate rather than retire.** The audit showed every shipped caller already injects `deriveFn`, which makes removal and gating behaviorally identical for everything in the tree today. The tiebreaker is the case they differ on: an operator who has deliberately wired a funded key. Removal breaks that person silently; gating keeps them working while still closing the accident path. Since the RCA mandates only that the dead default stop being reachable **by accident**, gating satisfies the requirement at strictly lower blast radius.

**Two proof legs, because one is not enough, and that is a measured fact.** The source leg (comment-stripped grep) and the live leg (swap the shared `classifier` export for a recorder and run both real default paths) were each mutation-tested against a deliberately broken `graph-backfill.cjs`. Mutant 1 replaced the assignment outright: **A2 caught it, B2 never ran.** Mutant 2 kept the literal `classifier.scoreBasedDeriveFn` token in a dead comma-expression position while live-resolving to a different function: **A2 passed, B1 passed, B2 caught it.** That is the "textually similar but functionally different" case the plan explicitly asked the live check to cover, and it is now demonstrated rather than hoped for. `lib/core/graph-backfill.cjs` was restored to byte-identical state after each mutant (`git diff --stat` empty, suite back to exit 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, in this plan's own new test] The parity test read the wrong `edges` columns**

- **Found during:** Task 2, first run of the new suite (B5 failed with 0 edges)
- **Root cause:** The test queried `SELECT source_id, target_id, edge_type FROM edges`. Those are the field names of the **finding** shape inside `candidateToFinding`, not the table's columns. `PRAGMA table_info(edges)` against a real fixture room.db shows `(source, target, type, properties, review_status)`; the writer maps finding fields down to column names on the way in. The edges had in fact landed correctly and identically in both rooms all along.
- **Fix:** Corrected the query and documented the finding-shape-vs-column-name distinction inline so the next reader does not repeat it. Added assertion B7 (both triggers land edges `proposed`, never auto-confirmed, Canon Part 3/9) since `review_status` was now in hand.
- **Files modified:** `tests/test-233-drain-backfill-producer-parity.cjs`
- **Committed in:** `fb31472d`

**2. [Rule 1 - Bug, in this plan's own new test] A reproducible 2-in-6 flake from an mtime-ordering assumption**

- **Found during:** Task 2, running the phase gate
- **Root cause (traced, not guessed):** `buildAllPairs` orders every pair `(a = older, b = newer)` by a strict `mtimeMs` comparison, because the INFORMS direction rule composes off older-informs-newer. That is correct product behavior. The test's fixture assumption was the broken part: it treated two separately-built fixture rooms as identical, but they are only identical if their files carry the same mtime **relationships**. A direct probe under parallel load reproduced the divergence and printed it: room A landed `framing-a@...530.24, domain-00@...538.25, framing-b@...538.25` (one strictly older, two tied) while room B landed all three at the identical `...954.7473`. Ties do not swap; distinct values do. The pair orientation flipped, and B3 failed for a reason with nothing to do with producer parity.
- **Fix:** `stampArtifactMtimes()` sets a fixed, strictly increasing, id-ordered mtime on every artifact in both rooms before either trigger runs, plus a new assertion B0 pinning that the two rooms enumerate the identical id set. This does not weaken the test; it removes an uncontrolled variable so B3/B6 measure which producer ran instead of filesystem timing. Also added a self-explaining `DIVERGED` dump before the B3 assertion so a future divergence reports what differed rather than only which line threw.
- **Verification:** the exact load pattern that produced 2 failures in 6 harness runs was re-run as 8 parallel invocations plus 6 further harness runs: **14 consecutive green.**
- **Files modified:** `tests/test-233-drain-backfill-producer-parity.cjs`
- **Committed in:** `fb31472d`

**3. [Rule 2 - Missing Critical] Feynman-runner registration for both new suites**

- **Issue:** The plan's `files_modified` did not list `lib/memory/run-feynman-tests.cjs`. Plan 01 hit the identical gap (its deviation 4) and established the precedent: an unregistered suite is orphaned from the repo's standing gate discipline and stops running the moment nobody types its filename.
- **Fix:** Both suites registered with a comment naming the load-bearing scenario in each (scenario 2 for the gate suite, the B leg for the parity suite), matching the file's existing convention.
- **Files modified:** `lib/memory/run-feynman-tests.cjs`
- **Committed in:** `fb31472d`

---

**Total deviations:** 3 auto-fixed (2 bugs in this plan's own new tests, 1 missing-critical registration)
**Impact on plan:** No scope creep. Both bugs were in test code written by this plan, found and root-caused before commit. Zero product code was changed beyond what the plan specified.

## Issues Encountered

**`tests/test-graph-derivation-verdict.cjs` fails 2 of 14 checks. PRE-EXISTING, not caused by this plan.** Proven, not assumed: `lib/core/graph-derivation.cjs` was temporarily restored to its base-commit bytes via `git checkout --` on that single file, the suite re-run, and the modified file restored. The base result is byte-identical to the post-change result, `VERDICT: {"passed":false,"checks":14,"failed":2}`, with the same two findings. Both failing checks assert that a per-section FEYNMAN body emitted during room healing carries a `## Timeline (auto)` section, which has no code path through `runDerivation`'s deriveFn resolution. The other 12 checks pass, including every derivation-composer check. Logged in full with a hypothesis to `deferred-items.md` in this phase directory. Per the executor scope boundary, not fixed here.

**`dashboard/graph.json` shows generated drift in the working tree.** Regenerated by a commit-time hook, and repo history shows it is swept in periodic `chore:` commits (`46211f8a`, `d6e0a7b4`), never per-task. Left uncommitted, consistent with that precedent.

**Concurrent-session interleaving.** A separate `quick-260728-051` session committed to this shared tree between this plan's commits, as the executor prompt anticipated. Every commit here staged files individually; no cross-contamination in either direction (`git show --stat` on each commit shows only this plan's files).

## Verification Evidence

- **RCA 4b gate, ground truth.** `node tests/test-233-derivation-default-gate.cjs` -> 11/11. The load-bearing assertion is scenario 2: the REAL cached `graph-candidate-producer` exports object is spied, so "the dead hosted transport was never reached" is a **measured call count of 0**, not an inference from reading control flow. Scenario 3 additionally asserts no `.mindrian/room.db` was created, proving the throw preceded `openRoomDb`. Scenario 6 proves the gate opens correctly on deliberate opt-in (same spy, call count 1). Scenarios 7-8 pin that an injected `deriveFn` is unaffected with the gate both closed and open.
- **Zero regression, full existing suite run unmodified.** `test-graph-derivation-loop` PASS, `test-derive-idempotence` PASS, `test-224-proposed-only` PASS, `test-224-migration` PASS, `test-graph-derivation-verdict` unchanged from base (see Issues). Also run and green: `test-224-encoder-skip`, `test-224-cost-bound`, `test-224-per-write-derive`, `test-224-backfill-idempotent`.
- **Producer parity, PROOF A (source, comment-stripped).** Both `scripts/gsd-graph-derive-drain.cjs` and `lib/core/graph-backfill.cjs` carry exactly 1 live `classifier.scoreBasedDeriveFn` assignment after stripping comments; neither carries a live `graph-candidate-producer` reference. **A4 proves the stripper is honest**, asserting the UNSTRIPPED drain source DOES contain that token in prose, so A3 cannot pass vacuously.
- **Producer parity, PROOF B (live, the plan's actual requirement).** The shared cached `classifier.scoreBasedDeriveFn` export is swapped for a recording stand-in; both modules then run their REAL default (non-injected) path over two fixture rooms. B1 and B2 show **both invocation lists non-empty**, which is only possible if both defaults resolved to that one export. B3 shows the identical 3-pair set. B4 shows both handed the producer the same D-04 seam shape (`scoreOpts` + `onOutcome`). B5/B6 read the cascade edges back off **both real room.db files** through the Phase-232.1 read-only door and compare them as sets: identical. B7 pins both landed `proposed`, never auto-confirmed.
- **Mutation proof that both legs are real gates** (see Decisions Made for the two mutants and their distinct catches). `lib/core/graph-backfill.cjs` restored byte-identical after each.
- **RCA 4e, acceptance criteria met exactly.** `grep -n "and CLEARS the drained entry" scripts/gsd-graph-derive-drain.cjs` -> no match. `diff` of the "Failure discipline" paragraph against the pre-task snapshot -> byte-identical. The full-file diff touches the intro paragraph and nothing else.
- **Phase gate.** `bash tests/run-all-233.sh` -> `Phase 233: PASS=6 FAIL=0`, run 6 consecutive times after the flake fix, plus 8 parallel invocations of the parity suite alone. 14 consecutive green under the exact load that previously produced 2 failures in 6.
- **Canon Part 8.** `grep -nE "https?://|fetch\(|axios|onrender|brain" lib/core/graph-derivation.cjs` returns nothing. The gate adds no transport; it makes an existing local one harder to reach.
- **No em-dashes** in any file created or modified (`grep -P '\x{2014}'` -> 0 on every touched file; 0 on the added CHANGELOG lines specifically).
- **No unintended deletions:** `git diff --diff-filter=D --name-only` empty on every commit.

## Next Phase Readiness

Ready. Wave 3 (`233-03`) is independent of everything here: Section 9 Defects #4/#5 are `compute-hsi.py` corpus scoping and structural node coverage, which touch no file this plan modified.

**One thing worth stating plainly, carried forward from 233-01's own closing note and now sharpened.** Plan 01's heal restores the retry SIGNAL for the ~16 damaged rooms. This plan governs whether that signal can convert into real edges, and the answer is **yes, and it always could**: both derive triggers already defaulted to the LOCAL score-based producer as of Phase 224-02, and that is now pinned by a live regression rather than trusted. The dead hosted transport was never on the path those rooms will take. What this plan removed is the possibility of a **future** caller silently landing on it. So the ~16 rooms need an in-session derive to actually run, not a further code fix.

---
*Phase: 233-graph-derive-drain-residual-seed-037-heal-already-damaged-ro*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 7 claimed files exist on disk. All 3 claimed task commits resolve in git log.
