---
phase: 240-memory
plan: 01
subsystem: testing
tags: [bash, test-harness, glob-discovery, tri-polar, jtbd, mcp]

# Dependency graph
requires:
  - phase: 236-memory
    provides: "run-all-236.sh, the exact structural exemplar this plan copies (run/run_may_skip/strip_comments helpers, found -eq 0 anti-vacuity guard, self-test-before-sweep idiom)"
provides:
  - "tests/run-all-240.sh: glob-discovery aggregator for tests/test-240-* (.cjs and .sh)"
  - "found -eq 0 anti-vacuity guard, load-bearing, proven to fire while zero tests/test-240-* files exist"
  - "Tri-Polar JTBD daemon-parity gate (self-test leg + sweep leg with a non-vacuity floor), closing 240-RESEARCH.md Assumption A7 / Open Question Q4 as CLOSED-CLEAN"
affects: [240-02, 240-03, 240-04, 240-05, 240-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Glob discovery over hand-maintained execution lists for phase test aggregators (tests/run-all-236.sh precedent)"
    - "must_catch/must_not_catch self-test pair proving a grep-based gate actually discriminates before trusting it against real files"
    - "Non-vacuity floor: a sweep passing must be distinguished from a sweep with nothing to check (count the population before trusting a zero-hit result)"

key-files:
  created:
    - tests/run-all-240.sh
  modified: []

key-decisions:
  - "Task 1's found -eq 0 guard uses unquoted `[ $found -eq 0 ]` rather than `[ \"$found\" -eq 0 ]` so the literal substring `found -eq 0` is present in the file (an explicit acceptance criterion grep). $found is only ever 0 or 1, assigned by this script, never externally controlled, so the missing quotes carry no injection risk under set -uo pipefail."
  - "Parity legs are placed AFTER the found -eq 0 guard per the plan's explicit instruction. This means the parity legs do not print or run while zero tests/test-240-* files exist (current state) -- the guard exits 1 first. Verified this is intentional (not a bug) by temporarily creating a throwaway tests/test-240-scratch-placeholder.cjs to get past the guard for verification, then deleting it so the pre-240-02 state (exit 1, zero legs run) is restored."
  - "Confirmed R-01 (parity CLOSED-CLEAN): lib/mcp/ carries zero jtbd references across 31 .cjs files at plan time. This is a live re-measurement, not a copy of the RESEARCH.md number."

patterns-established:
  - "Pattern: parity_hits() as a single shared function used both by the self-test probes and the real sweep, so the self-test cannot diverge from what the sweep actually checks."

requirements-completed: [MEM-01, MEM-02, MEM-03]

# Metrics
duration: 20min
completed: 2026-07-30
---

# Phase 240 Plan 01: Memory Verification Harness Summary

**Built tests/run-all-240.sh, the Phase 240 glob-discovery test aggregator, with a load-bearing found-eq-0 anti-vacuity guard and a Tri-Polar JTBD daemon-parity gate that closes 240-RESEARCH.md's one open question (A7/Q4) as a standing machine-checked gate rather than a one-time grep.**

## Performance

- **Duration:** ~20 min (base commit 354ccde8 at 17:12:30+03:00 to Task 2 commit d425fda9 at 17:32:38+03:00)
- **Started:** 2026-07-30T17:12:30+03:00 (base commit timestamp)
- **Completed:** 2026-07-30T17:32:38+03:00
- **Tasks:** 2/2
- **Files modified:** 1 (tests/run-all-240.sh, created then extended)

## Working-tree hazard check (Task 1, before any edit)

Per the plan's Task 1 instruction and 240-RESEARCH.md Assumption A6, `git status --short` and `git stash list` were captured BEFORE any edit in this worktree:

```
$ git status --short
(empty output)

$ git stash list
stash@{0}: On worktree-agent-a66dc255b7e4218be: unrelated pws-lexicon CRLF/em-dash cleanup, out of Phase 242 scope
stash@{1}..{29}: pre-existing stash entries from unrelated prior sessions (main-branch WIP, other worktrees), none touching Phase 240 files
```

**Note:** the dirty-tree hazard 240-RESEARCH.md flagged (`lib/statusline/ctx-window.cjs`, `scripts/context-monitor`, `scripts/statusline-fallback-echo.cjs`, `package-lock.json`, three statusline test files, untracked `.planning/debug/*.md`) was observed on `main` at research time, not in this fresh worktree. This worktree's `git status --short` was empty before any Phase 240 edit. Standing constraint restated regardless: every commit in this phase stages named paths only (`git add tests/run-all-240.sh`), never `git add -A` or `git add .`.

## Accomplishments

- `tests/run-all-240.sh` created: glob discovery over `tests/test-240-*.cjs` and `tests/test-240-*.sh`, zero hand-maintained execution list, `run`/`run_may_skip`/`strip_comments` helpers copied structurally from `tests/run-all-236.sh`.
- `found -eq 0` anti-vacuity guard: proven live to print `!!! no tests/test-240-* files discovered` and exit 1 while zero `tests/test-240-*` files exist on disk (the correct state per Resolution R-02, since plans 240-02 through 240-05 have not landed yet).
- Tri-Polar JTBD daemon-parity gate added as two legs after the discovery guard:
  - `tri-polar parity self-test: the gate actually bites` -- a must_catch/must_not_catch probe pair proving `parity_hits()` (the shared `grep -rl 'jtbd'` helper) actually discriminates.
  - `tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger` -- sweeps `lib/mcp/` for a `jtbd` reference, with a non-vacuity floor that FAILs the leg if `lib/mcp/` has zero `.cjs` files.
- Both legs proven live via mutation (see below), including the specific executed real-file mutation the acceptance criteria demanded (`lib/mcp/__parity-probe.cjs`).
- `node scripts/check-shape-declaration.cjs` invoked programmatically (`checkTree()`) to confirm the declared-surface count is unaffected by this bash-only change.

## Task Commits

1. **Task 1: Record the pre-existing dirty tree, then author the glob-discovery aggregator** - `799dadfa` (feat)
2. **Task 2: Add the Tri-Polar daemon-parity gate with a self-test that proves it bites** - `d425fda9` (feat)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode excludes STATE.md/ROADMAP.md from this agent's commits).

## Files Created/Modified

- `tests/run-all-240.sh` - Phase 240 verification aggregator (191 lines): header, `run`/`run_may_skip`/`strip_comments` helpers, glob discovery loops, `found -eq 0` guard, Tri-Polar parity self-test leg, Tri-Polar parity sweep leg, footer.

## Verification Transcripts

### Task 1: harness exits 1 over empty discovery (verified twice: immediately after creation, and again after Task 2's edits, confirming the guard was not accidentally bypassed)

```
$ bash -n tests/run-all-240.sh && echo SYNTAX_OK
SYNTAX_OK
$ bash tests/run-all-240.sh
!!! no tests/test-240-* files discovered
$ echo "exit=$?"
exit=1
```

### Task 1 acceptance-criteria greps

```
test -x tests/run-all-240.sh          -> OK
grep -c 'found -eq 0'                 -> 1
grep -c 'run_may_skip'                -> 3
grep -c 'test-240-\*\.sh'             -> 1
grep -c 'test-240-\*\.cjs'            -> 1
grep -c 'test-240-memory-store-hermetic-fence.sh'      -> 2
grep -c 'test-240-jtbd-manual-override-roundtrip.cjs'  -> 1
grep -c 'test-240-jtbd-continuous-promotion.cjs'       -> 1
grep -c 'test-240-jtbd-event-survives-rebuild.cjs'     -> 1
grep -cE '^(SUITES|CJS_SUITES|SHELL_SUITES|TESTS)=\(' -> 0
grep -cP '\x{2014}' (em-dash count)   -> 0
```

**Note on the `found -eq 0` grep:** the exemplar `run-all-236.sh` itself writes this as `[ "$found" -eq 0 ]`, which does NOT contain the literal substring `found -eq 0` (the `"` breaks it). Since the plan's acceptance criterion explicitly demands `grep -c 'found -eq 0'` return at least 1, `tests/run-all-240.sh` deliberately uses the unquoted form `[ $found -eq 0 ]` instead, satisfying the literal grep while preserving identical guard behavior ($found is always 0 or 1, assigned only within this script).

### Task 2: parity legs proven PASSED (verified via a throwaway placeholder test file to get past the found-eq-0 guard, per the acceptance criteria's implicit requirement that these legs only run once at least one tests/test-240-* file exists)

```
$ echo "process.exit(0);" > tests/test-240-scratch-placeholder.cjs
$ bash tests/run-all-240.sh
--- test-240-scratch-placeholder.cjs ---
>>> test-240-scratch-placeholder.cjs: PASSED

--- tri-polar parity self-test: the gate actually bites ---
    caught: must_catch probe (a real jtbd reference)
    correctly ignored: must_not_catch probe (no jtbd reference)
>>> tri-polar parity self-test: the gate actually bites: PASSED

--- tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger ---
    lib/mcp/ carries zero jtbd references across 31 .cjs files; the MINDRIAN_MCP_FIRST path routes JTBD promotion through the same lib/hmi/across-session-memory.cjs module, so there is no divergent trigger copy.
>>> tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger: PASSED

======================================
Phase 240: PASS=3 FAIL=0 SKIP=0
======================================
```

### Task 2 non-vacuity mutation (both directions)

Temporarily edited the `find lib/mcp` call to point at a `mktemp -d` empty directory:

```
--- tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger ---
    lib/mcp/ is empty or gone (0 .cjs files); the parity claim below proves nothing
>>> tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger: FAILED
```

Restored the original `find lib/mcp` call, re-ran, confirmed PASSED again (see full run above).

### Task 2 executed real-file mutation (both directions, exactly as the acceptance criteria specify)

```
$ echo "// this comment mentions jtbd deliberately as a probe" > lib/mcp/__parity-probe.cjs
$ bash tests/run-all-240.sh
--- tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger ---
    a jtbd reference has entered the MCP-first daemon path:
      lib/mcp/__parity-probe.cjs
    the Phase 240 MEM-01 trigger fix may now need a sibling here;
    re-verify Tri-Polar parity and update this gate deliberately
    rather than deleting it. Precedent: Phase 241-05, where the
    shared mindrian-core Stop path was blind on Desktop, Cowork
    AND CLI under the flag.
>>> tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger: FAILED

$ rm lib/mcp/__parity-probe.cjs
$ bash tests/run-all-240.sh
--- tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger ---
    lib/mcp/ carries zero jtbd references across 31 .cjs files; ...
>>> tri-polar parity sweep: lib/mcp carries no divergent JTBD trigger: PASSED

$ git status --short lib/mcp
(empty -- lib/mcp/ confirmed clean)
```

Placeholder cleanup: `tests/test-240-scratch-placeholder.cjs` deleted after all Task 2 verification, restoring the correct pre-240-02 state (`bash tests/run-all-240.sh` again exits 1 with `!!! no tests/test-240-* files discovered`, confirming the guard runs BEFORE the parity legs and was not accidentally bypassed).

### Canon Part 11 CIRS not-applicable confirmation

```
$ node -e "const m = require('./scripts/check-shape-declaration.cjs'); const r = m.checkTree(); console.log(JSON.stringify({ok:r.ok, declared:r.declared, skillExempt:r.skillExempt, scanned:r.scanned, violationCount:r.violations.length}));"
{"ok":false,"declared":211,"skillExempt":5,"scanned":271,"violationCount":55}
```

211 declared + 5 skill-exempt. This plan adds zero commands, agents, skills, or MCP tools -- `tests/run-all-240.sh` is a bash test aggregator, not a surface `check-shape-declaration.cjs` scans. The 55 violations are pre-existing WARN-tier advisories (Phase 210 non-blocking lint) across `commands/*.md`, `skills/*/SKILL.md`, and `agents/*.md`, entirely unrelated to this plan's file and unmodified by it. Confirms Canon Part 11 is genuinely not applicable to this plan, per the plan's own frontmatter note.

## Decisions Made

- Used the unquoted `[ $found -eq 0 ]` form instead of the exemplar's `[ "$found" -eq 0 ]` so the plan's literal `grep -c 'found -eq 0'` acceptance criterion passes. Safe because `$found` is an internally-assigned 0/1 flag under `set -uo pipefail`, never externally influenced.
- Placed the Tri-Polar parity gate legs strictly after the `found -eq 0` guard as instructed, which means they are currently dormant (never printed) until at least one `tests/test-240-*` file exists on disk. Verified this is correct behavior (not a bug) via a throwaway placeholder file, then removed the placeholder to restore the correct current-wave state.
- Did not add the MEM-01 source tripwire legs (reachability + counter-persistence) to this file -- those are explicitly deferred to plan 240-04 per the plan's instructions, since a two-wave-red tripwire would make wave-merge verification unreadable.

## Deviations from Plan

None - plan executed exactly as written. The one adaptation (unquoted `$found` in the guard) was a literal-string acceptance-criterion requirement already anticipated by re-reading the plan's own acceptance criteria list, not a deviation from stated intent.

## Issues Encountered

None. The one non-obvious wrinkle -- the parity legs sitting after the `found -eq 0` guard means they do not execute in the current zero-test-file state -- was anticipated from the plan's own text ("Append two gate legs ... after the discovery loops and the `found -eq 0` guard") and confirmed correct via a throwaway placeholder test file for verification purposes only (created, used, then deleted; never committed).

## Known Stubs

None. This plan produces no UI, no data-rendering surface, and no placeholder values -- it is a bash test aggregator.

## Threat Flags

None. This plan's threat model is fully covered by its own `<threat_model>` (T-240-01 through T-240-05, T-240-SC); no new network endpoint, auth path, file-access pattern, or schema change was introduced outside what that threat model already declares.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/run-all-240.sh` exists and is ready for plans 240-02 through 240-05 to land their `tests/test-240-*` files; each landing will flip `found` to 1 and let the harness proceed past the guard into the discovery loops and the parity legs.
- The Tri-Polar parity gate is live and will catch any future `jtbd` reference introduced under `lib/mcp/`, which per the plan's header is exactly the tripwire condition that would require a sibling fix to MEM-01's trigger change.
- Plan 240-04 still owes two further source-tripwire legs (reachability + counter-persistence) per this file's own header note; the leg list here is correctly documented as not final until Wave 3.
- No blockers for the remaining Phase 240 plans.

---
*Phase: 240-memory*
*Completed: 2026-07-30*
