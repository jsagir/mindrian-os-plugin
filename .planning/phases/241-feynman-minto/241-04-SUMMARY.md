---
phase: 241-feynman-minto
plan: 04
subsystem: infra
tags: [node, bash, feynman-minto, guardian, pre-commit, advisory-gate]

# Dependency graph
requires:
  - phase: 241-01
    provides: "runOnStop's soft walk deadline and captured systemMessage (F-1); this plan does not touch that code path"
  - phase: 241-02
    provides: "the retired stop-path vacuums and the real intent-classifier drain-and-act consumer (F-0); unrelated to this plan's edit site"
  - phase: 241-03
    provides: "both F-2 severity constants raised to critical (missing MINTO.md, missing governing_thought); this plan's real-commit fixture relies on the governing_thought constant to reach the >= error threshold"
provides:
  - "runPreCommit(roomDir, validators, opts) is advisory by default: enumerates every violation to stderr plus a counted WARN naming the restore path, then returns 0"
  - "preCommitStrictEnabled(opts) restores the pre-241 hard-fail contract via opts.strict, MINTO_PRECOMMIT_STRICT=1 env, or a --strict argv flag"
  - "scripts/hooks/pre-commit-room-minto-guard.sh and its canonical twin scripts/hooks/pre-commit are BOTH untouched (empty diff), per Resolution R-07"
  - "lib/memory/precommit-real-commit.test.cjs: SC3's real-git-commit proof, both directions, registered in run-feynman-tests.cjs"
affects: [241-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Advisory-default / --strict-opt-in idiom reused verbatim from scripts/check-shape-declaration.cjs (Phase 210): enumerate everything, WARN with a count and a restore path, never a silent no-op"
    - "Real-commit proof for a git-hook gate: install the canonical hook into a scratch repo's real .git/hooks/pre-commit and drive `git commit` for real, never call the guarded function directly"

key-files:
  created:
    - lib/memory/precommit-real-commit.test.cjs
  modified:
    - scripts/feynman-minto-guardian.cjs
    - lib/memory/feynman-minto-guardian.test.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Fixture correction, found empirically before writing any test: the plan's own fixture wording ('a section with no MINTO.md') was hand-verified against the real canonical hook to ALWAYS hard-block at a separate, older, unconditional gate (Phase 87-01a's ROOM.md+MINTO.md existence check, exit 2, no opt-out) BEFORE the script ever reaches the Feynman-MINTO guardian invocation further down the same file. Using that fixture would make every test in this plan observe the older gate's text instead of F-3's advisory/strict demotion. The fixture used instead seeds a MINTO.md that EXISTS (satisfying the older gate) but is missing governing_thought (Plan 03's F-2 fix aggregates this to critical), which is the shape that actually exercises runPreCommit's new branch through a real commit."
  - "Room root == scratch repo root in the real-commit fixtures, and nothing is ever staged with a dirname of '.' (the room root itself). getStagedFiles() reads `git diff --cached --name-only`, which is repo-root-relative; if roomDir were a subdirectory of the repo root, the guardian's own section computation (first path segment relative to roomDir) would silently misalign with the staged paths (first segment relative to repo root instead) and validateSection would never be called on the right section. Verified empirically (see Deviations) before locking the fixture shape."
  - "Threaded --strict through main()'s existing argv parsing (process.argv[2]=mode, process.argv[3]=roomDir) rather than adding a new parsing branch, since main() already only reads positional args 2 and 3 and process.argv.includes('--strict') is position-independent."
  - "opts is the third, optional parameter on runPreCommit -- every existing two-argument caller (all of Tests 1-3, 5-18 in feynman-minto-guardian.test.cjs, plus any production caller) keeps working unchanged."

patterns-established:
  - "A gate demoted to advisory must still enumerate every violation AND print a counted WARN naming both restore switches -- an exit 0 with empty stderr fails the acceptance bar even when the exit code is correct (T-241-15, this phase's own threat register)."
  - "When proving a git-hook gate by a real commit, hand-verify the fixture against the ACTUAL installed hook script before writing assertions -- an older, unrelated, unconditional gate elsewhere in the same script can silently make every test observe the wrong code path."

requirements-completed: [MINTO-02]

# Metrics
duration: ~70min
completed: 2026-07-28
---

# Phase 241 Plan 04: Demote runPreCommit to Advisory WARN with --strict Opt-In, Proven by Real Git Commits Summary

**`runPreCommit` is advisory by default (enumerates every violation, prints a counted WARN, exits 0), restores the pre-241 hard-fail contract via `--strict`/`MINTO_PRECOMMIT_STRICT=1`, and both directions are proven by an actual `git commit` against the canonical installed hook in a scratch repo, not by calling the function directly.**

## Performance

- **Duration:** ~70 min (file-reading + a hand-verification probe of the real hook script before writing any test, through final commit)
- **Started:** 2026-07-28 (approx, file-reading phase)
- **Completed:** 2026-07-28
- **Tasks:** 2/2
- **Files modified:** 3 (`scripts/feynman-minto-guardian.cjs`, `lib/memory/feynman-minto-guardian.test.cjs`, `lib/memory/run-feynman-tests.cjs`) + 1 created (`lib/memory/precommit-real-commit.test.cjs`)

## Accomplishments

- Closed finding F-3. `runPreCommit(roomDir, validators, opts)` gained a third optional parameter and a `preCommitStrictEnabled(opts)` helper, reusing `scripts/check-shape-declaration.cjs`'s (Phase 210) advisory-default/`--strict`-opt-in idiom verbatim, per RESEARCH.md's explicit reuse-before-build mandate. The advisory default path enumerates every violation to stderr exactly as before, then adds one counted WARN line naming both restore switches (`MINTO_PRECOMMIT_STRICT=1`, `--strict`), then returns 0 instead of 2. The strict path preserves the pre-241 hard-fail contract byte-for-byte, plus one added line naming which switch restored it.
- `scripts/hooks/pre-commit-room-minto-guard.sh` and its Phase 235-01 canonical twin `scripts/hooks/pre-commit` are BOTH untouched -- `git diff --stat` on both is empty, confirmed before and after every commit in this plan. A guardian return of 0 already propagates cleanly through the hook's existing `_GUARDIAN_EXIT -ne 0` check, per Resolution R-07.
- Proved SC3's literal requirement -- a REAL `git commit`, not `runPreCommit()` called as a function -- with a new `lib/memory/precommit-real-commit.test.cjs`. 4 tests, all driving an actual `git commit` against the canonical hook installed at a scratch repo's real `.git/hooks/pre-commit`: the guard actually fires (anti-vacuity), advisory default lands the commit with enumerated violations plus a counted WARN, `MINTO_PRECOMMIT_STRICT=1` rejects the commit and nothing lands, a clean room still commits with zero violation output (false-positive guard).
- Found and corrected a load-bearing fixture problem in the plan's own wording BEFORE writing any test (see Deviations): a missing-MINTO.md fixture cannot prove F-3's demotion through a real commit, because it always hits a separate, older, unconditional gate in the same hook script first.
- Rewrote `feynman-minto-guardian.test.cjs` Test 4 ("pre-commit blocks on error/critical severity, exit 2") into three scenarios covering the new contract: advisory default (exit 0, stderr enumerates + counted WARN naming both restore paths), `MINTO_PRECOMMIT_STRICT=1` (exit 2), `--strict` argv (exit 2).
- Registered the new test file in `lib/memory/run-feynman-tests.cjs` next to the other Phase 241 entry (`guardian-onstop-reaches-user.test.cjs`).
- Mutation-proven, not merely passing: hand-reverted the advisory branch to the bare pre-241 `return 2`, confirmed `precommit-real-commit.test.cjs` Test 2 goes RED, restored from a scratch backup, confirmed `git diff --stat` empty and both suites GREEN again.

## Task Commits

1. **Task 1: Demote runPreCommit to an advisory WARN with a strict opt-in, reusing the Phase 210 idiom** - `b879c92e` (fix)
2. **Task 2: Prove the demotion with a real git commit, both directions, mutation-proved** - `b88191c5` (test)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `scripts/feynman-minto-guardian.cjs` - `preCommitStrictEnabled(opts)` helper added; `runPreCommit`'s signature gained a third optional `opts` param; the terminal `if (worstSeverityIdx >= error)` block restructured into a strict branch (byte-preserved pre-241 behavior plus one line naming the restore switch) and an advisory branch (default: same enumeration, plus a counted WARN, `return 0`); `main()` threads `{ strict: process.argv.includes('--strict') }` into the `pre-commit` case; mode docstring and usage string updated; `preCommitStrictEnabled` added to `module.exports`
- `lib/memory/feynman-minto-guardian.test.cjs` - Test 4 rewritten into three sub-scenarios (advisory default, `MINTO_PRECOMMIT_STRICT=1`, `--strict` argv); header test map's Core section updated
- `lib/memory/precommit-real-commit.test.cjs` (new) - 4 tests driving a real `git commit` against the canonical installed hook in a scratch repo; `GUARDIAN_PRECOMMIT_STAGED` is only ever deleted from the child env, never assigned a path
- `lib/memory/run-feynman-tests.cjs` - registered the new test file immediately after `guardian-onstop-reaches-user.test.cjs` (the other Phase 241 entry)

## Decisions Made

See `key-decisions` in frontmatter. The two most load-bearing:

1. **The fixture correction.** The plan's own fixture description ("a section with no MINTO.md") does not and cannot exercise F-3's advisory/strict demotion through a real commit, because a totally-missing MINTO.md always hard-blocks at a separate, older, unconditional gate in the same hook script (see "Deviations from Plan" for the exact probe evidence). Corrected before any test was written, not discovered mid-implementation.
2. **Room root == repo root in every real-commit fixture**, and nothing is ever staged with dirname `.`. `getStagedFiles()`'s `git diff --cached --name-only` output is repo-root-relative; if the discovered Data Room root were a subdirectory, the guardian's own roomDir-relative section computation would silently misalign with the staged-path list and validate the wrong (or no) section. Verified empirically before locking the fixture shape (see Deviations).

## Grounding Consult (Mandatory)

`mcp__langtalks-graph-expert__*` tools are not present in this executor agent's toolset (only Read/Write/Edit/Bash are available), matching every prior 241-series plan (241-01, 241-02, 241-03). The phase's own `241-RESEARCH.md` already performed this consult at the phase level for the concepts this plan's design touches (a repair-ladder gate demoted from hard-block to advisory, self-repair loops, dead-letter-queue-adjacent debounce mechanics) and recorded an honest "not in corpus yet" for every mechanism-specific term queried: self-repair, self-correction, critic model, dead letter queue, background job queue, async worker, Minto pyramid, Feynman technique. "Reflection" and "guardrails" exist as loosely-connected entities related only via a shared episode co-mention, not a genuine documented architectural relationship. Per CLAUDE.md's own standing rule, "not in the corpus yet" is a valid, expected answer for this source; not re-attempted in this execution pass since the tool is unavailable to this agent, and no langtalks citation is fabricated anywhere in this plan's work.

**claude-api skill / claude-code-guide agent consult:** confirmed NOT APPLICABLE, per the executor prompt's own instruction to read and record this determination rather than skip it silently. This plan edits the body of a git pre-commit hook (`scripts/feynman-minto-guardian.cjs`'s `runPreCommit`, invoked from `scripts/hooks/pre-commit-room-minto-guard.sh`), which is a native git hook mechanism entirely separate from Claude Code's `hooks/hooks.json` matcher system. Phase 235-01 already performed and documented this exact consultation inline in the hook file's own header comment (read during this plan's setup): "git pre-commit hooks and Claude Code's `hooks/hooks.json` are separate systems; this change touches only the former. Evidence: `hooks/hooks.json` declares only Claude-Code-internal lifecycle events ... and contains zero references to `.git/hooks`, `pre-commit`, or `git commit`." This plan touches no hook matcher pattern, no MCP tool registration, and no subagent-registry behavior, so the claude-api skill / claude-code-guide agent consult does not apply here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own fixture description, caught empirically before implementation] The literal fixture wording ("no MINTO.md") cannot prove F-3's demotion through a real commit**
- **Found during:** Task 2 pre-implementation probe (before writing any test code)
- **Issue:** The plan's `<action>` text for Task 2 says to seed "one section directory holding a `ROOM.md` and NO `MINTO.md`." Before writing the test, this fixture shape was hand-verified against the real canonical hook (`scripts/hooks/pre-commit-room-minto-guard.sh`) in a scratch repo. Result: a directory inside a `.room-root` subtree that is missing MINTO.md ALWAYS hard-blocks with exit 2 at a SEPARATE, older, unconditional gate near the top of the same hook script (Phase 87-01a's ROOM.md+MINTO.md existence check, `scripts/hooks/pre-commit-room-minto-guard.sh` lines ~118-151), which runs BEFORE the script ever reaches the Feynman-MINTO guardian invocation further down the same file (lines ~303+). That older gate has no `--strict`/env opt-out and is entirely unrelated to F-3. Using the literal fixture would have made every test in this file observe the older gate's output instead of `runPreCommit`'s advisory/strict branch, and would have made Test 2 (advisory default exits 0) impossible to pass -- the commit would ALWAYS be rejected regardless of the F-3 fix.
- **Fix:** Seeded a MINTO.md that EXISTS (satisfying the older Phase 87-01a gate) but is missing `governing_thought` -- the exact breach Plan 03's F-2 fix raised to `SEVERITY.CRITICAL`. This fixture shape passes the older gate cleanly and reaches the guardian's `runPreCommit`, which is the code path this plan actually needs to prove.
- **Files modified:** `lib/memory/precommit-real-commit.test.cjs` (written with the corrected fixture from the start; no rewrite needed once the probe evidence was in hand)
- **Verification:** Probe commands run by hand before writing the test file (reproduced below); all 4 tests in the final file pass against the corrected fixture, and Test 1's own assertion (`combined.indexOf('[guardian]') !== -1`) would fail immediately if the older gate fired instead, since that gate's own message text is `"MindrianOS pre-commit guard: ROOM.md + MINTO.md invariant violated"`, never `"[guardian]"`.
- **Committed in:** `b88191c5` (Task 2 commit; the incorrect fixture shape was never committed)

**2. [Rule 1 - Bug in initial fixture layout, caught empirically before implementation] roomDir must equal the scratch repo root, or getStagedFiles()'s repo-root-relative paths silently misalign with the guardian's roomDir-relative section computation**
- **Found during:** Task 2 pre-implementation probe, same session as Deviation 1
- **Issue:** An initial probe nested the Data Room (`.room-root`) one level under the scratch repo root (mirroring `lib/memory/room-minto-hook.test.cjs`'s `myroom/` pattern). `getStagedFiles()` calls `git diff --cached --name-only` with no `cwd` override, so its output is relative to the git process's own cwd (the repo root). `runPreCommit(roomDir, ...)` then computes each section as `path.relative(roomDir, staged)`'s first path segment -- but when `roomDir` is a SUBDIRECTORY of the repo root, the staged paths are repo-root-relative, not roomDir-relative, so the computed "section" was the room's own directory name (e.g. `myroom`) instead of the real section (e.g. `section-a`), and `validateSection` was never invoked on the seeded breach at all. Confirmed by hand via a `node -e` probe that printed the mismatched section-candidate path before the fix.
- **Fix:** Every fixture in `precommit-real-commit.test.cjs` makes the scratch repo ROOT itself the Data Room (`.room-root` at the repo root, `market-analysis/` as the one section directly under it), and no file is ever staged with a dirname of `.` (the room root itself never appears in `git diff --cached`'s staged-dirs list, so the OLDER Phase 87-01a top-level gate never fires for the room root either).
- **Files modified:** `lib/memory/precommit-real-commit.test.cjs` (fixture builder `initRoomRepo` written with room root == repo root from the start)
- **Verification:** All 4 tests pass; Test 2 specifically asserts `git rev-parse HEAD` resolves (the commit landed) AND stderr names the seeded `governing_thought` breach, which would be impossible if the section computation were still misaligned.
- **Committed in:** `b88191c5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both caught by hand-verification BEFORE any test code was written, both confined to this plan's own new test file, zero production-code impact)
**Impact on plan:** Both corrections were necessary for the real-commit proof to prove what SC3 actually demands. Using the plan's literal fixture wording unmodified would have shipped a test file whose core assertions (advisory default exits 0; a real commit lands) could NEVER pass, regardless of whether `runPreCommit`'s own fix was correct -- the exact kind of vacuous-or-impossible gate this whole milestone is named after avoiding. Caught by hand-probing the real hook script's behavior before committing to a fixture shape, not discovered via a failing test after the fact.

## Probe Evidence (the hand-verification behind Deviations 1 and 2)

Commands run against the real canonical hook (`scripts/hooks/pre-commit-room-minto-guard.sh`) in a scratch repo, BEFORE any test code was written, to determine the correct fixture shape.

**Probe A -- confirms a missing MINTO.md always hard-blocks at the older gate, unconditionally:**
```
$ git commit -m test   # room root nested (myroom/), section-a/ has ROOM.md, NO MINTO.md
MindrianOS pre-commit guard: ROOM.md + MINTO.md invariant violated (2 issue(s)).
  MISSING MINTO.md: myroom
  MISSING MINTO.md: myroom/section-a
...
EXIT:1
```
This fires unconditionally -- no `--strict`, no `MINTO_PRECOMMIT_STRICT`, no advisory path -- and the guardian's own `[guardian]` text never appears, because the script exits before ever reaching the guardian invocation.

**Probe B -- confirms room root == repo root + a MINTO.md missing only governing_thought reaches the guardian, and reproduces the pre-241 hard-block (the fix had not landed yet at probe time):**
```
$ git commit -m test   # room root == repo root, section-a/MINTO.md has schema_version but no governing_thought
[guardian] pre-commit blocked by Feynman-MINTO violations:
  [section-a] critical: Missing or empty frontmatter field: governing_thought
[guardian] Fix violations or use --no-verify (at your own risk).

MindrianOS pre-commit guard: commit blocked by feynman-minto-guardian in room: <scratch-repo>
Fix violations or use --no-verify at your own risk.
EXIT:1
```
This is the exact fixture shape the final test file uses. After Task 1's fix landed, the same fixture produces the advisory output (verified in the Behavioral Proof section below).

## Behavioral Proof (advisory default and strict opt-in, both via real `git commit`, per standing_rules)

Reproduced directly from `precommit-real-commit.test.cjs`'s own passing run against the fixture in Probe B (post-fix):

**Advisory default (no flag, no env) -- exit 0, commit lands:**
```
[guardian] pre-commit advisory by Feynman-MINTO violations (Phase 241, not blocking):
  [market-analysis] critical: Missing or empty frontmatter field: governing_thought
[guardian] WARN: 1 violation detected; not blocking (set MINTO_PRECOMMIT_STRICT=1 or pass --strict to restore hard-fail).
```
`git rev-parse HEAD` resolves after this commit (the commit genuinely landed).

**`MINTO_PRECOMMIT_STRICT=1` -- exit 2, nothing lands:**
```
[guardian] pre-commit blocked by Feynman-MINTO violations:
  [market-analysis] critical: Missing or empty frontmatter field: governing_thought
[guardian] Fix violations or use --no-verify (at your own risk).
[guardian] strict mode: exiting 2 (MINTO_PRECOMMIT_STRICT=1 / --strict restores the pre-Phase-241 hard-fail contract).
```
`git rev-parse HEAD` does NOT resolve after this attempt (this is the fresh scratch repo's first commit; no commit ever landed).

**`--strict` argv flag -- same restore path, exit 2** (verified identically via `feynman-minto-guardian.test.cjs` Test 4c and confirmed with a direct guardian invocation during Task 1).

## Mutation Proof Evidence

Per standing_rules, the advisory branch was hand-reverted against a scratch backup of the real file, the observed RED output recorded, then restored and confirmed byte-identical (`git diff --stat` empty) with both suites returning to GREEN.

**Mutation applied:** replaced the entire strict/advisory `if (worstSeverityIdx >= SEVERITY_ORDER.indexOf('error'))` block in `runPreCommit` with the bare pre-241 body (`process.stderr.write(...); ...; return 2;`), removing the advisory branch entirely.

```
PASS Test 1: the guard actually fires (anti-vacuity)
FAIL Test 2: advisory default -- commit lands, violations enumerated + counted WARN
  AssertionError [ERR_ASSERTION]: advisory default: commit must exit 0; stderr=[guardian] pre-commit blocked by Feynman-MINTO violations:
  [market-analysis] critical: Missing or empty frontmatter field: governing_thought
[guardian] Fix violations or use --no-verify (at your own risk).

MindrianOS pre-commit guard: commit blocked by feynman-minto-guardian in room: /tmp/mos-precommit-t2-5kEn8s
Fix violations or use --no-verify at your own risk.

1 !== 0
PASS Test 3: strict opt-in -- commit rejected, nothing lands
PASS Test 4: a clean room still commits with zero violation output

precommit-real-commit tests: 3/4 passed
```

Correctly RED: with the advisory branch removed, EVERY invocation hard-blocks (matching pre-241 behavior), so Test 2's "advisory default exits 0" assertion fails exactly as expected. Test 3 (strict) and Test 4 (clean room) both still pass, as expected -- the mutation only removes the advisory path, it does not touch the strict path or the clean-room no-violation path.

**Restored:**
```
$ cp <scratch-backup> scripts/feynman-minto-guardian.cjs
$ git diff --stat scripts/feynman-minto-guardian.cjs
(empty)
$ node lib/memory/precommit-real-commit.test.cjs
precommit-real-commit tests: 4/4 passed
$ node lib/memory/feynman-minto-guardian.test.cjs
guardian tests: 18/18 passed
```

## Verification Commands Run

- `node -c scripts/feynman-minto-guardian.cjs` -> exit 0
- `node -e "const g=require('./scripts/feynman-minto-guardian.cjs'); if(g.runPreCommit.length < 2) process.exit(1)"` -> exit 0 (`runPreCommit.length === 3`); existing two-argument callers unaffected
- `grep -c 'MINTO_PRECOMMIT_STRICT' scripts/feynman-minto-guardian.cjs` -> 7 (>= 2 required)
- `grep -c "argv.includes('--strict')" scripts/feynman-minto-guardian.cjs` -> 2 (>= 1 required)
- `git diff --stat scripts/hooks/pre-commit-room-minto-guard.sh` -> empty
- `git diff --stat scripts/hooks/pre-commit` -> empty (the Phase 235-01 canonical twin)
- `node lib/memory/feynman-minto-guardian.test.cjs` -> **18/18 passed**
- `node lib/memory/precommit-real-commit.test.cjs` -> **4/4 passed**
- `grep -c 'GUARDIAN_PRECOMMIT_STAGED' lib/memory/precommit-real-commit.test.cjs` -> 3, all either a comment or a `delete env.GUARDIAN_PRECOMMIT_STAGED` -- never assigned a path
- `grep -c "'commit'" lib/memory/precommit-real-commit.test.cjs` -> 4 (>= 3 required; one real `git commit` invocation per test)
- `grep -c 'precommit-real-commit.test.cjs' lib/memory/run-feynman-tests.cjs` -> 1
- `node lib/memory/feynman-minto-invariants.test.cjs` -> **22/22 passed** (no regression from Plan 03)
- `node lib/memory/room-minto-hook.test.cjs` -> **7/7 passed** (the pre-existing, older Phase 87-01a gate this plan deliberately did not touch, still healthy)
- `node lib/memory/minto-debounce-consumer-census.test.cjs` -> **5/5 passed** (241-02 cross-plan interaction check)
- `node lib/memory/run-feynman-tests.cjs` (full 396-file mega-suite) -> attempted once with a 250s cap; hung indefinitely inside the same pre-existing, unrelated `test/84-smart-notebook-copilot.test.cjs` SQLite `'prepare' of undefined` failure that 241-01-SUMMARY.md and 241-03-SUMMARY.md already documented and independently reproduced. Process reached and printed results for every file registered before that hang point (confirmed no PASS/FAIL line for this plan's own new file yet, since it is registered after the hang point in file order); abandoned per the 241-03 precedent rather than burning session time on a file this plan does not touch. The five directly relevant suites above, run individually, are all green.
- Mutation proof: see dedicated section above (full observed RED and GREEN output).
- `grep -cP '\x{2014}|\x{2013}'` across all 4 modified/created files -> 0 (no em-dash characters)

## Issues Encountered

The `lib/memory/run-feynman-tests.cjs` mega-suite (396 registered files) hangs inside `test/84-smart-notebook-copilot.test.cjs`, a pre-existing issue unrelated to this plan's files (that test file already fails on a SQLite handle problem before the hang). This is the same class of pre-existing gap 241-01-SUMMARY.md and 241-03-SUMMARY.md both documented. Not fixed here -- out of this plan's scope (`test/84-smart-notebook-copilot.test.cjs` is not in `files_modified`), logged here for visibility rather than silently worked around.

## User Setup Required

None. `MINTO_PRECOMMIT_STRICT` is a new opt-in env var with no default-behavior impact (advisory is the default; the env var only matters if a navigator or CI pipeline chooses to set it). No new environment variable is required for default behavior.

## Next Phase Readiness

- `scripts/feynman-minto-guardian.cjs`'s `runPreCommit` is now the plan's edit site closed for this phase; the pre-commit hook scripts (`scripts/hooks/pre-commit-room-minto-guard.sh`, `scripts/hooks/pre-commit`) remain untouched, so Phase 235's concurrent hook consolidation had zero collision surface with this plan, confirmed by the empty diffs recorded above.
- `lib/memory/feynman-minto-guardian.test.cjs` and `lib/memory/feynman-minto-invariants.test.cjs` are both touched by Plans 01/03 and this plan; this plan deliberately did NOT touch `runOnStop`, the enqueue gate (`runSessionStart`'s `if (result.severity === 'critical')` block), or either severity constant, so 241-05 has a clean surface to land on.
- Per RESEARCH.md's Resolution R-06, this demotion is a PERMANENT advisory default (not time-boxed to "until F-0 ships"), matching the Phase 210 precedent and decoupling SC3 from F-0's fate. 241-05 (the closing plan) should not need to revisit this decision.
- MINTO-02 is now fully closed (both F-2 and F-3 halves); `REQUIREMENTS.md` and `ROADMAP.md` updated accordingly in this plan's own tracking commit, scoped to Phase 241 / plan 241-04 lines only, per the critical scope boundary for this session.

## Self-Check: PASSED

- FOUND: scripts/feynman-minto-guardian.cjs
- FOUND: lib/memory/feynman-minto-guardian.test.cjs
- FOUND: lib/memory/precommit-real-commit.test.cjs
- FOUND: lib/memory/run-feynman-tests.cjs
- FOUND: .planning/phases/241-feynman-minto/241-04-SUMMARY.md
- FOUND commit: b879c92e (Task 1) -- verified via `git log --oneline -5`
- FOUND commit: b88191c5 (Task 2) -- verified via `git log --oneline -5`, HEAD

---
*Phase: 241-feynman-minto*
*Completed: 2026-07-28*
