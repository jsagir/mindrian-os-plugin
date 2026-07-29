---
phase: 236-room-db-data-loss-fixes
plan: 04
subsystem: infra
tags: [node-sqlite, engines, version-floor, testing, bash, grep-gate, context7]

# Dependency graph
requires:
  - phase: 218-entity-extraction-pipeline
    provides: "the `timeout: 5000` write-safety option in lib/core/room-db.cjs (Phase 218-02 D-05), which is the specific option whose real version floor this plan establishes"
  - phase: 236-room-db-data-loss-fixes
    provides: "236-01's scoped rebuild DELETE, which the aggregator's permanent regression gate exists to protect"
provides:
  - "engines.node corrected from >=22.5.0 to >=22.16.0, the version where node:sqlite's `timeout` constructor option actually starts working"
  - "A ten-file Node floor census with a written disposition for every file, no unclassified survivor"
  - "tests/test-236-engines-floor.cjs, a four-scenario regression assertion pinning the floor and both reasons it exists"
  - "tests/run-all-236.sh, the phase test aggregator: glob discovery, found-eq-0 guard, self-tested unscoped-delete regression gate, non-vacuity leg"
affects: [236-02, 242-the-moat, any future release that regenerates package-lock.json, any future plan adding a tests/test-236-* file]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep gate whose negative self-test runs the EXACT pipeline the sweep runs, allowance filter included"
    - "Non-vacuity leg: assert the guarded token still EXISTS, so a gate cannot pass by having nothing to match"
    - "Version-floor census with a written disposition per file (CHANGED / REVIEWED-NO-CHANGE / NOT-TOUCHED)"

key-files:
  created:
    - tests/test-236-engines-floor.cjs
    - tests/run-all-236.sh
  modified:
    - package.json
    - CLAUDE.md
    - .planning/research/STACK.md
    - CHANGELOG.md
    - .github/workflows/agentshield-scan.yml
    - .planning/phases/236-room-db-data-loss-fixes/deferred-items.md

key-decisions:
  - "Floor set to >=22.16.0, not the lower >=22.13.0 unflagging floor: 22.13.0 leaves the 22.13-22.15 silent-no-op window open, where node:sqlite loads but drops the `timeout` option without throwing"
  - "CLAUDE.md hand-edited in lockstep with its sentinel source .planning/research/STACK.md, because gsd-tools generate-claude-md destroys two unrelated sections on this repo (missing CONVENTIONS.md and ARCHITECTURE.md sources)"
  - "scripts/session-start and scripts/sync-rooms-graph deliberately NOT moved to 22.16.0: they state the node:sqlite AVAILABILITY floor, a different and lower number (22.13.0), and bumping them to the engines floor would soft-fail sessions that actually work"
  - "The unscoped-delete allowance is by exact call shape in one test file, never by excluding the file, and the self-test proves a real exec in that same file is still caught"
  - "The aggregator header enumerates EIGHT mandatory tests, not the seven in the plan's acceptance criteria: 236-01 added an eighth mid-flight and 236-VALIDATION.md records the correction"

patterns-established:
  - "Self-test-before-trust: a grep gate runs synthetic probes through its full pipeline before it is believed over real files"
  - "Allowance-cannot-become-a-loophole: every documented allowance carries a must_catch probe proving a genuine violation in the same file still fires"
  - "Two-floor discipline: the AVAILABILITY floor (v22.13.0, module unflagged) and the CAPABILITY floor (v22.16.0, `timeout` option) are tracked as separate numbers, never collapsed"

requirements-completed: [GRAPHDB-03]

# Metrics
duration: 35min
completed: 2026-07-29
---

# Phase 236 Plan 04: Version Floor and Phase Aggregator Summary

**engines.node corrected to >=22.16.0 (the version where node:sqlite's `timeout` option actually works, not the lower version where the module merely loads), pinned by a four-scenario mutation-proven assertion, plus tests/run-all-236.sh with glob discovery and a self-tested unscoped-delete regression gate.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-29T14:13Z (approx, first file read)
- **Completed:** 2026-07-29T14:48Z
- **Tasks:** 3 of 3
- **Files created:** 2
- **Files modified:** 6

## The finding, in plain terms

A version floor is a promise: "install me on this or newer and I will work." The old promise said
Node 22.5.0 and it was wrong twice over, at two different depths.

The shallow wrongness: `node:sqlite` was born behind a startup flag at 22.5.0 and did not stop
needing that flag until **22.13.0**. So on 22.5 through 22.12 the very first line that matters,
`require('node:sqlite')` in `lib/core/room-db.cjs`, throws outright. The install was accepted and
the plugin was dead.

The deep wrongness, and the one GRAPHDB-03 actually names: since Phase 218-02 the room's database
is opened with a five second "wait your turn" setting, so two simultaneous writes queue instead of
one failing instantly. That setting is the `timeout` constructor option, and it was not added until
**22.16.0**. In the gap between 22.13 and 22.15 the module loads, the code reads correctly, and
`node:sqlite` accepts the option without recognising it and throws it away silently. Contended
writes still fail at zero milliseconds. Nothing warns. The write-safety fix ships, passes review,
and does nothing.

That is why the floor is 22.16.0 and not 22.13.0. Stopping at 22.13.0 would have closed the loud
failure and left the silent one wide open, which is the exact failure shape this whole phase exists
to close.

**Source:** Context7 against the Node.js v22.x API docs, specifically the `timeout` option's own
version-history entry in the DatabaseSync options table, NOT the module's separate unflagging entry.
Confirmed live in 236-RESEARCH.md Evidence E by a `PRAGMA busy_timeout` readback: `0` with an
unrecognised option name, `5000` with the real one.

## Accomplishments

- `package.json` `engines.node` moved `>=22.5.0` to `>=22.16.0`, with the reason cited in both
  CHANGELOG.md and CLAUDE.md and the source named.
- A live floor census across ten files, every one with a written disposition. No unclassified
  survivor.
- `tests/test-236-engines-floor.cjs`: four scenarios, all four independently mutation-proven RED.
- `tests/run-all-236.sh`: glob discovery, a load-bearing `found -eq 0` guard proven to exit 1, a
  comment-stripped unscoped-delete gate with a sixteen-probe negative self-test, and a non-vacuity
  leg. Sweeps 815 first-party `.cjs` files under `lib/`.
- Two genuine follow-up findings raised rather than silently half-fixed (see Deferred Findings).

## Task Commits

1. **Task 1: Correct the floor and sweep every other stated floor** - `bd00e9bb` (fix)
2. **Task 2: Floor regression assertion** - `5d0c1b0d` (test)
3. **Task 3: Phase 236 test aggregator** - `6289efdc` (test)

All three committed with hooks running normally. **No `COMMIT_NO_VERIFY` was needed.** The
`interactive_first_reward` guardian documented in the execution brief never fired, because this
plan stages no `commands/*.md` file.

## The floor census, all ten files

The plan named nine. A tenth was found live and is called out as such.

### CHANGED (4)

| # | File | What and why |
|---|------|--------------|
| 1 | `package.json:38` | `engines.node` `>=22.5.0` to `>=22.16.0`. THE floor. |
| 2 | `CLAUDE.md:117` | Technology Stack row, lockstep, now carrying the cited reason and the source. |
| 3 | `.planning/research/STACK.md:23` | **The tenth file, not in the plan's census.** `CLAUDE.md:117` sits INSIDE the `<!-- GSD:stack-start source:research/STACK.md -->` sentinel. Editing only the rendered surface would be reverted by the next regeneration, so both moved together. |
| 4 | `.github/workflows/agentshield-scan.yml:52` | Comment only. 236-RESEARCH.md Pitfall 9 named this as the confirmed drift site. Reviewed: the pin is `node-version: '22'`, which resolves to the latest 22.x and is **above** the new floor, so CI already exercises a runtime users have. Only the parenthetical was stale. This satisfies T-236-14's CI-review mitigation. |

### ADDED (1)

| # | File | What and why |
|---|------|--------------|
| 5 | `CHANGELOG.md` | New `[Unreleased]` `### Changed` entry. Verified additions-only: `git diff --numstat` reports **23 insertions, 0 deletions**. No historical entry rewritten. Lines 908, 3903, 3904 and 3906 state the old floor and are accurate records of what was true then. The entry states the T-236-14 consequence explicitly: npm will now refuse an install on 22.5.x through 22.15.x that it previously accepted. |

### REVIEWED-NO-CHANGE, raised as follow-up (2)

| # | File | What and why |
|---|------|--------------|
| 6 | `scripts/session-start:48,55-66` | The preflight tests `minor >= 5` and prints a `>= 22.5.0` message. It **does** let a genuinely broken Node through (22.5 to 22.12 return `ok`, then the require throws). Not fixed here: see Deferred Findings, its correct new value is **22.13.0**, not 22.16.0. |
| 7 | `scripts/sync-rooms-graph:230,235` | A comment plus the stderr message inside the `try/catch` around the require. Same finding, same correct value of 22.13.0, filed with the one above so the pair moves in a single commit. |

### REVIEWED-NO-CHANGE (2)

| # | File | What and why |
|---|------|--------------|
| 8 | `tests/test-session-start-node-preflight.cjs:25` | `EXPECTED_PREFIX` pins the exact preflight message. Per the plan it updates ONLY if `scripts/session-start` changes. It did not, so this did not. Changing the assertion without the preflight would be backwards. |
| 9 | `scripts/83-scope-injection.test.cjs:132` | A comment describing what plan 85-01 historically did. Accurate as history. Moves only with `scripts/session-start`. |

### NOT-TOUCHED (1)

| # | File | What and why |
|---|------|--------------|
| 10 | `package-lock.json:32` | Generated. Carries an engines mirror that updates through npm, never by hand. T-236-SC accepts **zero package-manager operations** in this plan, so no install was run. It refreshes on the next `npm install` the release train performs. |

**No `.nvmrc` exists.** Confirmed live with `ls`, not assumed.

### The sweep's blind spot, recorded rather than papered over

`grep -r` from the repo root does **not** descend into `.planning/`, because `.gitignore:79` is
`.planning/*` and grep in this environment is gitignore-aware. A repo-root sweep returns 6 files; a
separate explicit sweep of `.planning/` returns **33 more**. Every one of those 33 is a planning
artifact: RESEARCH docs analysing this very correction, historical SUMMARYs, superseded milestone
ROADMAPs. Same class as CHANGELOG history, NOT-TOUCHED. The single live surface among them was
`.planning/research/STACK.md`, which is why it appears as CHANGED above.

This matters beyond this plan: any future census that greps from the repo root will silently miss
everything under `.planning/`.

### Post-change sweep

Returns exactly the six classified survivors: `CHANGELOG.md`, `package-lock.json`,
`scripts/83-scope-injection.test.cjs`, `scripts/session-start`, `scripts/sync-rooms-graph`,
`tests/test-session-start-node-preflight.cjs`. **No unclassified survivor.**

### No version bump

`package.json` `version`, `.claude-plugin/plugin.json` and git tags are all untouched
(`git diff` empty on plugin.json). ROADMAP.md Gate 0 governs the release train, not this plan.

## Mutation proofs, all demonstrated live and reverted

Nothing below is asserted. Every one was run, its RED output observed, and reverted.

### Task 2, tests/test-236-engines-floor.cjs (7 mutations)

| # | Mutation | Result |
|---|----------|--------|
| A | `package.json` floor back to `>=22.5.0`, CLAUDE.md untouched | Scenario 1 RED, scenario 3 still green. Confirms 1 reads the manifest only. |
| B | A **real** full floor revert, `package.json` AND `CLAUDE.md` both | Scenarios **1 and 3 both RED**. This is the criterion the plan named. It takes both surfaces because scenario 3 reads CLAUDE.md, not package.json. |
| C | `timeout` dropped from BOTH `DatabaseSync` constructions | Scenario 4 RED: "no DatabaseSync construction passes a timeout option" |
| D | `timeout` dropped from ONE construction only | Scenario 4 RED: "some pass timeout and some do not", offending line named |
| E | The `node:sqlite` require moved behind a `try/catch` | Scenario 4 RED: "no longer requires node:sqlite on an executable line" |
| F | `--experimental-sqlite` planted in `bin/cli.js` | Scenario 4 RED, names the file and says the floor needs re-deriving |
| G | `FLOOR_MINOR` raised above the running v22.23.1 | Scenario 2 RED with the live runtime version in the message |

Green after every revert: `4 passed, 0 failed`, exit 0.

**Stronger than the plan asked for:** there are TWO `DatabaseSync` constructions in `room-db.cjs`
(the `allowExtension` branch and the plain one). Asserting only that "a timeout reaches a
construction" would pass while one branch silently lost its busy-wait window, so the test asserts
**every** construction carries it. Mutation D is the proof.

### Task 3, tests/run-all-236.sh (4 proofs)

| # | Proof | Result |
|---|-------|--------|
| 1 | Four of the five `test-236` files renamed away | The runner still discovered and ran the fifth. `PASS=4 FAIL=0`, exit 0. |
| 2 | **ALL five renamed away** | `!!! no tests/test-236-* files discovered`, **exit 1**, no green summary printed. The `found -eq 0` guard holds. |
| 3 | The exact original defect planted back into `lib/core/lazygraph-ops.cjs` as `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` | Sweep RED, naming the file and the line number. |
| 4 | The non-vacuity target swapped to a `lib/` subtree holding no `DELETE FROM nodes` | That leg RED with the vacuity message. |

All four reverted; `git status` clean between each.

## The unscoped-delete gate, and the thing it caught about itself

The gate catches a delete of the `nodes` or `edges` table that is **not** narrowed by a `WHERE`
clause: the table name followed by end of statement rather than by more SQL.

It runs a sixteen-probe negative self-test **before** it is trusted over real files. Both
`must_catch` and `must_not_catch` run the **exact** pipeline the sweep runs, allowance filter
included. A self-test that skipped the allowance would prove the pattern bites while saying nothing
about whether the allowance then swallows the bite, which is the more likely way a gate goes quietly
blind.

**The gate corrected itself on first contact with real files.** The written allowance was designed
for two lines in `lib/memory/test-rs-sqlite-mirror.cjs` (`.indexOf` calls checking rollback-SQL
ordering). The first real sweep run went RED on **two more** lines nobody predicted: `assert.ok`
calls whose failure *message* quotes the statement it was searching for. That is the sweep doing its
job. The allowance now covers all four, by exact call shape, and the header says plainly that two of
the four were unpredicted.

The allowance cannot become a hiding place: two `must_catch` probes prove that a real `conn.exec` of
an unscoped delete, **in that same file**, on an allowance-adjacent line, is still caught.

**Non-vacuity:** a separate leg asserts against UNSTRIPPED source that the literal `DELETE FROM
nodes` still exists somewhere under `lib/`. Without it, the sweep passing could mean "clean" or
could mean "there is nothing here to match", and only one of those is good.

**`scripts/hsi-to-graph.cjs` was NOT touched and gets NO allowance**, per the plan's overlap check.
It is Phase 242 / MOAT-01 territory. It also needs no allowance on two independent counts: the sweep
is scoped to `lib/` and that file lives under `scripts/`, and its deletes are already scoped
(`DELETE FROM edges WHERE type = ...`) so the pattern would not match them even if the sweep did
reach it. A speculative allowance for a file the gate cannot see would be a hole with no reason
behind it. This is stated in the runner header rather than left implicit.

## The full suite: what actually happens

```
bash tests/run-all-236.sh
```

**Result: GREEN. `Phase 236: PASS=8 FAIL=0 SKIP=0`, exit 0.**

Discovered and passed (5 test files):

- `test-236-ecosystem-graph-preserves-journal.cjs` (236-01) - 7/7
- `test-236-engines-floor.cjs` (236-04, this plan) - 4/4
- `test-236-open-broken-detected.cjs` (236-03) - 7/7
- `test-236-open-busy-detected.cjs` (236-03) - 14/14
- `test-236-rebuild-preserves-journal.cjs` (236-01) - 5/5

Plus the three gate legs: self-test PASSED, sweep PASSED (815 files under `lib/`), non-vacuity
PASSED.

**236-02 has not landed.** Its three named tests
(`test-236-backfill-default-preserves-journal.cjs`, `test-236-rebuild-crash-mid-transaction.cjs`,
`test-236-rebuild-wal-concurrent-read.cjs`) **do not exist on disk**, so the glob simply does not
find them. That is the literal, verified state. No expected-red leg exists, because a file that does
not exist cannot fail; it can only be absent. The runner header enumerates all eight by name
precisely so that absence is visible by reading, and the header states this limitation of glob
discovery in its own words rather than implying the green summary covers all eight.

## Seven versus eight mandatory tests

236-04-PLAN.md's acceptance criteria say "all seven mandatory test filenames from
236-VALIDATION.md". 236-VALIDATION.md's table actually lists **eight**, and says so explicitly:
236-RESEARCH.md named seven, then 236-01 found a **second** unscoped wipe site in
`scripts/build-ecosystem-graph.cjs` mid-flight and shipped an eighth test for it.

The runner header enumerates **eight** and explains the discrepancy in place. Writing seven would
have meant one real, landed, passing test being invisible in the checklist that exists to make
missing tests visible.

## Files Created/Modified

**Created:**
- `tests/test-236-engines-floor.cjs` - 4-scenario floor assertion, `EXPECTED_FLOOR` pinned as a named top-level const
- `tests/run-all-236.sh` - phase aggregator, executable, glob discovery, 3 gate legs

**Modified:**
- `package.json` - `engines.node` to `>=22.16.0`
- `CLAUDE.md` - Technology Stack row with the cited reason and source
- `.planning/research/STACK.md` - the sentinel source behind that row
- `CHANGELOG.md` - new `[Unreleased]` `### Changed` entry, additions only
- `.github/workflows/agentshield-scan.yml` - stale comment corrected, `node-version` unchanged
- `.planning/phases/236-room-db-data-loss-fixes/deferred-items.md` - two findings raised

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `gsd-tools query generate-claude-md` destroys two CLAUDE.md sections**

- **Found during:** Task 1
- **Issue:** `CLAUDE.md:117` sits inside the `<!-- GSD:stack-start source:research/STACK.md -->`
  sentinel, and CLAUDE.md's own Sentinel-Source Generation convention says the rendered file is
  never edited inside a sentinel. So the source was edited and the generator run. It reported
  `Generated 4/6 sections. Fallback: conventions, architecture.` and produced a diff of **8
  insertions, 22 deletions**: the live Conventions block (including the no-em-dashes rule) and the
  Architecture block were both overwritten with "not yet established" placeholders, the skills table
  row was swapped, and blank lines were injected into hand-written prose **outside** every sentinel.
  Root cause: `.planning/CONVENTIONS.md` and `.planning/ARCHITECTURE.md` do not exist, so the
  generator writes placeholder text over real content instead of leaving the section alone. Strict
  information loss.
- **Fix:** `git checkout -- CLAUDE.md`, then hand-edited the single stack row, keeping
  `.planning/research/STACK.md` edited in lockstep so the source and the rendered file agree and a
  future correct regeneration reproduces the same row.
- **Files modified:** `CLAUDE.md`, `.planning/research/STACK.md`
- **Verification:** `git diff CLAUDE.md` confirms one changed line. `grep -c "22.5.0" CLAUDE.md`
  returns 0, `grep -c "22.16.0"` returns 1.
- **Committed in:** `bd00e9bb`

**2. [Rule 2 - Missing Critical] Tenth census file: the sentinel source**

- **Found during:** Task 1
- **Issue:** The plan's nine-file census named `CLAUDE.md` but not
  `.planning/research/STACK.md`, the sentinel source it renders from. Changing only the rendered
  surface would have been silently reverted on the next regeneration, which is exactly the kind of
  drift Pitfall 3 warns about.
- **Fix:** Both changed in the same commit, with the relationship written into the commit message.
- **Files modified:** `.planning/research/STACK.md`
- **Committed in:** `bd00e9bb`

**3. [Rule 2 - Missing Critical] Two unpredicted false positives in the unscoped-delete allowance**

- **Found during:** Task 3
- **Issue:** The allowance was designed for two `.indexOf` lines. The first real sweep run went RED
  on two additional `assert.ok` lines in the same file whose failure *message* quotes the statement.
  Left unhandled, the gate would have shipped permanently red and been disabled by the next person
  to trip it.
- **Fix:** The allowance now covers all four by exact call shape. Two new `must_catch` probes prove
  a real exec in that same file is still caught. The header records that two of the four were
  unpredicted, because that is the evidence the gate discriminates.
- **Files modified:** `tests/run-all-236.sh`
- **Verification:** Proof 3 above (planted defect) turns the sweep RED.
- **Committed in:** `6289efdc`

**4. [Rule 2 - Missing Critical] One file changed beyond the plan's declared files_modified**

- **Found during:** Task 1
- **Issue:** The plan's `files_modified` lists four paths. `.github/workflows/agentshield-scan.yml`
  is classified REVIEW, and its comment cites `package.json engines` directly, so my change
  falsified it on the spot.
- **Fix:** Comment-only edit. `node-version` deliberately unchanged after review confirmed `'22'`
  resolves above the new floor. Zero behavior change.
- **Files modified:** `.github/workflows/agentshield-scan.yml`
- **Committed in:** `bd00e9bb`

**5. [Documentation accuracy] Eight mandatory tests enumerated, not seven** - see the section above.

---

**Total deviations:** 5 (1 blocking, 3 missing-critical, 1 documentation accuracy)
**Impact on plan:** No scope creep. Four of the five are lockstep or correctness consequences of the
floor change itself; the fifth is a doc-count correction backed by 236-VALIDATION.md.

## Deferred Findings (raised, deliberately not fixed)

Both are logged in full in
`.planning/phases/236-room-db-data-loss-fixes/deferred-items.md`.

### 1. Two runtime surfaces state the AVAILABILITY floor, and both say 22.5.0 when the real number is 22.13.0

Keep the two numbers apart. The **engines** floor is 22.16.0 (where `timeout` works). The
**availability** floor is 22.13.0 (where `require('node:sqlite')` stopped needing the flag).
`scripts/session-start` and `scripts/sync-rooms-graph` are both talking about the second one, and
both say 22.5.0, which is below both. `session-start`'s preflight therefore returns `ok` on 22.5 to
22.12 and then the require throws anyway.

Not fixed here for three reasons: (1) the correct new value for those two is **22.13.0, not
22.16.0**, and bumping them to the engines floor would soft-fail `session-start` (exit 0, no banner,
no scope injection) for 22.13 to 22.15 users whose plugin genuinely works; (2)
`tests/test-session-start-node-preflight.cjs:25` pins the exact message string and must move in the
same commit, making this a behavior change to a hook that fires every session; (3) neither file is
in this plan's `files_modified`.

Follow-up shape: one small plan moving both messages to `>=22.13.0` and the comparison to
`minor >= 13`, with the coupled test in the same commit. Optionally add the startup readback Pitfall
5 suggests: read `PRAGMA busy_timeout` back after opening and warn if it is `0` while `timeout` was
requested. That turns the 22.13-22.15 silent no-op into a visible runtime signal, which is this
milestone's whole theme, and degrades nothing.

### 2. `generate-claude-md` is unsafe on this repo

See deviation 1. Until `.planning/CONVENTIONS.md` and `.planning/ARCHITECTURE.md` exist, or the
generator learns to leave a section alone when its source is absent, CLAUDE.md must be hand-edited
in lockstep with its source and never regenerated.

## Issues Encountered

- The `generate-claude-md` destruction (deviation 1). Resolved by revert plus hand-edit.
- The two unpredicted grep-gate false positives (deviation 3). Resolved by tightening the allowance.
- `git add` refuses tracked-but-gitignored `.planning/` paths; `git add -f` is required, which is
  the established pattern for this repo and is what CLAUDE.md instructs.

## User Setup Required

None. No external service configuration. No package installs of any kind were performed
(T-236-SC holds).

**One user-visible consequence, stated in the CHANGELOG:** npm will now refuse an install on Node
22.5.x through 22.15.x that it previously accepted. That is deliberate and correct; the code
genuinely does not run safely there.

## Next Phase Readiness

- **GRAPHDB-03 is closed.** The floor is correct, cited on two surfaces, and pinned by a
  mutation-proven assertion.
- **The phase aggregator is live.** Any plan adding a `tests/test-236-*` file needs no edit to it.
- **236-02 is the only remaining plan in Phase 236.** When its three tests land they will be
  discovered automatically and the suite should read `PASS=11`.
- **The permanent regression gate is in place** protecting 236-01's fix from silent reinstatement in
  any future phase.
- **Blocker for the phase: none from this plan.**

## Self-Check: PASSED

All 8 claimed files verified present on disk:
`tests/test-236-engines-floor.cjs`, `tests/run-all-236.sh` (mode `-rwxr-xr-x`, executable
confirmed), `package.json`, `CLAUDE.md`, `.planning/research/STACK.md`, `CHANGELOG.md`,
`.github/workflows/agentshield-scan.yml`, `236-04-SUMMARY.md`.

All 3 claimed commits verified in `git log`: `bd00e9bb`, `5d0c1b0d`, `6289efdc`.

Zero em-dashes across every file this plan touched.

---
*Phase: 236-room-db-data-loss-fixes*
*Plan: 04*
*Completed: 2026-07-29*
