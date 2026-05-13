---
phase: 123-install-lifecycle-harness
plan: 05
subsystem: install-lifecycle
tags: [cache-prune, doc-sweep, packaging, brain-access-url, canon-part-8]
dependency_graph:
  requires: [123-02, 123-03, 123-04]
  provides:
    - "lib/core/cache-prune.cjs (the cache-prune helper -- Canon Part 8 clean, never deletes active)"
    - "session-start on-version-change cache prune (auto-cleans orphan version dirs)"
    - "doctor --fix unconditional cache prune (recovery)"
    - "@mindrian_os/install package name now consistent across forward-facing doc/test surfaces"
    - "commands/setup.md line 145 + 209: correct brain-access URL"
  affects:
    - "lib/memory/run-feynman-tests.cjs (Phase-123 block) -- test-cache-prune.cjs registered"
    - "scripts/session-start (~L1274-1295) -- new BEGIN/END cache prune block"
    - "scripts/doctor.cjs (~L2097-2115) -- TODO Plan-5 marker replaced with cache-prune call"
tech_stack:
  added: []
  patterns:
    - "fs.readdirSync + fs.statSync mtime-DESC sort (deterministic prune ordering)"
    - "Active-version protection: belt + suspenders -- active is ALWAYS in keep-set + fs.rmSync path-basename guard"
    - "Skip-on-unreadable invariant: installed_plugins.json ENOENT / parse-error / no-mos-entry -> {skipped: true, reason} with zero mutation"
    - "Best-effort wrapping in session-start: '|| true' swallows prune failures so session startup is never blocked"
    - "doctor --fix recovery report: per-dir entries in report.recoveries (action: removed | no-op | skipped | errored)"
key_files:
  created:
    - "lib/core/cache-prune.cjs (208 lines -- pruneMarketplaceCache + 3 internal helpers, exports all 4)"
    - "tests/test-cache-prune.cjs (335 lines -- 6 hermetic scenarios)"
  modified:
    - "scripts/session-start (+22 lines -- BEGIN/END cache prune block inside on-version-change guard)"
    - "scripts/doctor.cjs (TODO Plan-5 marker -> 16-line try/catch cache-prune call in performClassJFix)"
    - "lib/memory/run-feynman-tests.cjs (Phase-123 block + test-cache-prune.cjs entry; 9 lines)"
    - "docs/install/PACKAGING-PATHS.md (2 occurrences of @mindrian_os/cli -> @mindrian_os/install)"
    - "tests/manual/95.6-windows-cold-install-acceptance.md (top-of-doc acceptance callout + 2 @mindrian_os/cli -> @mindrian_os/install)"
    - "docs/INSTALL-LIFECYCLE-HARNESS.md (supersession note + 5 line edits preserving past-vs-present meaning)"
    - "commands/setup.md (line 145 + line 209: mindrianos-jsagirs-projects.vercel.app/brain-access -> mindrianos.vercel.app/brain-access)"
decisions:
  - "Plan-05 ships cache-prune AND finishes the package-name + URL doc sweep -- one commit per task, atomic verification."
  - "cache-prune.cjs exposes 4 names from module.exports (pruneMarketplaceCache + readActiveVersion + listCacheVersions + sortByMtimeDesc) -- the 3 internal helpers are exposed for testability + future reuse (per CONTEXT D-22 'expose internal helpers')."
  - "Active-version protection is implemented at TWO layers: (1) keep-set always contains activeVersion regardless of mtime; (2) before any fs.rmSync the name === activeVersion belt-and-suspenders branch skips. cp.5 monkey-patches fs.rmSync to throw if called on the active path -- the test would FAIL if either guard ever weakened."
  - "session-start runs the prune ONLY on version change (inside the existing reconcile guard) -- matches CONTEXT D-22's 'cache pruning on update' framing. doctor --fix runs it UNCONDITIONALLY -- matches CONTEXT D-22's 'doctor --fix (unconditional)' framing. Two different mental models (auto-maintenance vs operator-asked-for-recovery)."
  - "session-start cache-prune block wrapped in '|| true' (best-effort) -- prune failure NEVER blocks session startup. doctor records errors as a structured report.recoveries entry instead (the operator sees the failure in --json output)."
  - "Tests gated on 'cp.6 Canon Part 8 grep' use a literal regex that also matches the docblock if naively written -- caught during GREEN; rewrote the docblock comment to describe the check without containing the literal tokens. Auto-fixed (Rule 1)."
  - "Doc-sweep filter for forward-facing-vs-historical: forward-facing = describes a future install command users should run / a current package name / a current URL. Historical = describes a past event that happened (autopsy, sent email, prior feedback, dated CHANGELOG entry). Forward-facing gets swept; historical stays as the record. Audit trail in this SUMMARY."
metrics:
  duration: 16m 40s
  completed: 2026-05-13
  tasks: 3
  files_created: 2
  files_modified: 7
  test_scenarios_added: 6
  test_scenarios_pass: "6 / 6"
  commits:
    - "e1d3d27 test(123-05) RED -- failing tests for cache-prune"
    - "4453292 (mis-credited to Phase 110 -- see Deviation 1) GREEN -- cache-prune.cjs + feynman-runner entry"
    - "f7e7460 feat(123-05) -- wire cache-prune into session-start + doctor --fix"
    - "8d61ffb docs(123-05) -- @mindrian_os/cli -> @mindrian_os/install sweep + setup.md URL fix"
---

# Phase 123 Plan 05: Cache prune + @mindrian_os/install doc sweep Summary

Plan-05 ships HARNESS-123-13 (cache-prune helper + the two wirings) and
HARNESS-123-14 (the forward-facing `@mindrian_os/cli` → `@mindrian_os/install`
doc/test sweep + commands/setup.md line 145's stale brain-access URL fix).

**One-liner:** A 100-line `pruneMarketplaceCache` helper plus its two
wirings (on-version-change in `session-start`, unconditional in
`doctor --fix`) cleans the marketplace-cache version-dir accumulation
that was the last loose thread from the v1.13.0-beta.12 Windows incident
-- and the doc/test sweep finishes the package-name rename the rest of
the phase set up.

---

## What shipped

### Cache prune (HARNESS-123-13)

`lib/core/cache-prune.cjs` exposes `pruneMarketplaceCache({home, marketplace, retainCount, dryRun})`:

- **Algorithm:**
  1. Read `<home>/.claude/plugins/installed_plugins.json`. If unreadable
     (ENOENT, parse error) or missing the `mos@mindrian-marketplace` entry
     -> return `{kept: [], removed: [], skipped: true, reason: <string>}`.
     Never guesses.
  2. Extract `activeVersion` from the entry.
  3. List `<home>/.claude/plugins/cache/<marketplace>/mos/<version>/`
     child dirs. If absent -> `{kept: [activeVersion], removed: [], skipped: false, reason: 'no cache dir to prune'}`.
  4. Sort by mtime DESC; build `keep = {activeVersion} ∪ (top-N non-active by mtime)`,
     where N = `retainCount` (default 2). So `|keep| = N + 1 = 3` total.
  5. Prune everything not in `keep`. Belt + suspenders: skip if
     `name === activeVersion` (defensive sentinel).
  6. `dryRun: true` reports the prune set without acting.

- **Canon Part 8 clean.** The forbidden-network-token grep on the source
  file exits 1 (no match). The `session-start` cache-prune block is also
  Canon Part 8 clean (the inline `node -e` script is pure-fs only).

- **Test coverage:** `tests/test-cache-prune.cjs` -- 6 hermetic scenarios:

  | Scenario | What it asserts |
  |----------|-----------------|
  | cp.1 | 5-dir cache (1.10.0 / 1.11.0 / 1.12.0 / 1.13.0-beta.9 / 1.13.0-beta.12); active = beta.12, retainCount = 2. Asserts `kept = {beta.12, beta.9, 1.12.0}`, `removed = {1.10.0, 1.11.0}`. On disk: 3 dirs remain, 2 dirs gone. |
  | cp.2 | Corrupt `installed_plugins.json` -> `skipped: true`, reason mentions the file, nothing on disk changed. |
  | cp.3 | `dryRun: true` -> same `removed` set reported, but all 5 dirs still on disk. |
  | cp.4 | Only the active dir exists -> `kept: [active]`, `removed: []`. |
  | cp.5 | Belt + suspenders: monkey-patch `fs.rmSync` to throw if called on the active path. Active is the OLDEST mtime (the mtime-DESC sort would NOT keep it by recency -- only active-version protection does). Asserts no throw + active dir untouched. |
  | cp.6 | Canon Part 8: forbidden-network-token grep on `lib/core/cache-prune.cjs` exits 1 (no match). |

  All 6/6 PASS in 0.1s. Registered in `lib/memory/run-feynman-tests.cjs`
  Phase-123 block; picked up automatically by `tests/run-all.sh`'s
  `test-*.cjs` glob.

### The two wirings

- **`scripts/session-start`** -- new `BEGIN cache prune (Phase 123, on version change) / END cache prune` block,
  placed AFTER the manifest reconcile (line ~1274) so owned surfaces are
  fresh BEFORE sibling cache dirs get touched. Runs the prune ONLY when
  `$PLUGIN_VERSION != $LAST_VERSION` or `-z $LAST_VERSION`. Logs to
  stderr: `cache-prune removed: <names> (kept: <names>)` on success or
  `cache-prune skipped: <reason>` on skip. Wrapped in `|| true` -- prune
  failure NEVER blocks session startup.

- **`scripts/doctor.cjs`** -- the `// TODO Plan-5: unconditional cache prune call lands here.`
  marker in `performClassJFix` (line 2097) replaced with a try/catch
  block that calls `pruneMarketplaceCache({home})` UNCONDITIONALLY and
  records the result in `report.recoveries`:

  | Outcome | Recoveries entry |
  |---------|------------------|
  | Skipped | `{ class: 'deployment-surfaces', surface: 'cache-prune', action: 'skipped', reason, ok: null }` |
  | Removed (per dir) | `{ class: 'deployment-surfaces', surface: 'cache-prune', action: 'removed', dir, ok: true }` |
  | No-op | `{ class: 'deployment-surfaces', surface: 'cache-prune', action: 'no-op', kept, ok: true }` |
  | Errored | `{ class: 'deployment-surfaces', surface: 'cache-prune', action: 'errored', error, ok: false }` |

  `grep -c "TODO Plan-5" scripts/doctor.cjs` returns 0 (the marker is replaced).

### Live dry-run on this dev box

The plan asked for a dry-run against `~/.claude/plugins/` on this box so
the operator can see what `session-start` would prune the next time the
plugin version changes. With:

- `installed_plugins.json` declaring `mos@mindrian-marketplace` version `1.12.5.1`
- cache dirs: `1.12.0/` (May 3), `1.12.5/` (May 3), `1.12.5.1/` (May 10)

Dry-run output:

```json
{
  "kept": [
    "1.12.5.1",
    "1.12.5",
    "1.12.0"
  ],
  "removed": [],
  "skipped": false,
  "reason": null
}
```

**Interpretation:** 3 dirs on disk, retainCount = 2 + active = 3 → all 3 are
kept, nothing pruned. No surprises. The next `session-start` after a
plugin update (which would write a 4th dir) will prune the oldest
non-active. Safe.

### Doc/test sweep (HARNESS-123-14)

The published npm package is `@mindrian_os/install` (was `@mindrian_os/cli`
during early v1.13.0 betas, was `@mindrian/os` even earlier). Plan-01 +
Plan-04 swept `scripts/release.sh` and `tests/test-release-npm-gate.sh`;
Plan-05 finishes the forward-facing surface inventory.

**Files swept (forward-facing surfaces):**

| File | Refs swept | Notes |
|------|-----------|-------|
| `docs/install/PACKAGING-PATHS.md` | 2 (line 6, line 20) | The "paths 1 + 3 + 4 work today; path 2 unblocks once `@mindrian_os/install` is published" status line + the path-2 marketplace-npm-source row. |
| `tests/manual/95.6-windows-cold-install-acceptance.md` | 2 (line 61, line 94) | Step-8 acceptance check + capture-artifact list. PLUS a new top-of-doc callout: "Acceptance gate (Phase 123): run `mindrian-os doctor --acceptance` on the Windows box and paste the output. The acceptance checklist supersedes most of the manual steps below." Per RESEARCH Pattern 4. |
| `docs/INSTALL-LIFECYCLE-HARNESS.md` | 2 forward-facing refs + 3 historical-context refs | The original spec doc. Forward-facing `@mindrian_os/cli` swept (line 91 `npx @mindrian_os/install`). Historical refs reframed in past tense to preserve meaning ("Fix Step 9.5: it used to name `@mindrian_os/cli`; the package is `@mindrian_os/install` now"). Top-of-doc supersession note added: the planning artifacts at `.planning/phases/123-install-lifecycle-harness/` supersede this doc where they differ; release-beta-smoke.sh is retired and replaced by `mindrian-os doctor --acceptance --pre-tag` + `mindrian-os doctor --acceptance`. |
| `commands/setup.md` | 0 `@mindrian_os/cli` refs; 2 URL refs swept | Line 145 + line 209: `mindrianos-jsagirs-projects.vercel.app/brain-access` (a Vercel preview URL that never went public) → `mindrianos.vercel.app/brain-access`. Per CONTEXT D-35 + RESEARCH Finding 10. The `chmod 600 ~/.mindrian.env` edit (D-34) is Plan-7's job, not this plan. |
| `tests/test-release-npm-gate.sh` | 0 (Plan-01 already swept) | Confirmed clean -- grep returns nothing. |

**Files deliberately left unchanged (audit trail):**

| File | Reason |
|------|--------|
| `tests/test-release-bump-algebra.cjs` | The `@mindrian_os/cli` reference at line 138-139 is a regression assertion -- it asserts the OLD name is GONE from `scripts/release.sh`. The assertion is correct as-is (Plan-01 added it). Leaving it sweeps the test's purpose. |
| `CHANGELOG.md` | All 4 `@mindrian_os/cli` + `@mindrian/os` references are in dated historical entries describing what was. Historical record stays. |
| `docs/autopsies/2026-05-09-gary-laben-install-failure.md` | Autopsy describing what happened on 2026-05-08. Historical -- describes past events. Leave as-is. |
| `docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md` | "@mindrian/os was unpublished -> 404" -- describes past failure. Historical -- leave as-is. |
| `docs/testers/outbox/2026-05-07-gary-laben-welcome.md` | Sent-email artifact; record of what was sent that day. Leave as-is. |
| `docs/testers/gary-laben/FEEDBACK.md` | Historical feedback record from Gary. Leave as-is. |
| `lib/memory/run-feynman-tests.cjs` (release-beta-smoke comments) | Plan-04 comments documenting that the script was retired. Correct as-is. |
| `tests/test-doctor-acceptance.cjs` (acc.6 + RELEASE_BETA_SMOKE) | Plan-04's test that asserts `scripts/release-beta-smoke.sh` is deleted. Correct as-is. |

**Verification grepset:**

| Check | Result |
|-------|--------|
| `grep -rln "@mindrian_os/cli" docs/install/ commands/ tests/test-*.sh scripts/release.sh` | (no match) -- forward-facing surfaces clean |
| `grep -q "mindrianos.vercel.app/brain-access" commands/setup.md` | TRUE (new URL present) |
| `grep -q "mindrianos-jsagirs-projects.vercel.app" commands/setup.md` | FALSE (old URL gone) |
| `grep -q "mindrian-os doctor --acceptance" tests/manual/95.6-windows-cold-install-acceptance.md` | TRUE (new callout present) |
| `grep -q "mindrian-os doctor --acceptance --pre-tag" docs/INSTALL-LIFECYCLE-HARNESS.md` | TRUE (supersession note present) |
| `git ls-files scripts/release-beta-smoke.sh` | (empty) -- Plan-04's deletion holds |

---

## Deviations from Plan

### 1. [Rule 3 - Blocking issue / parallel-agent contamination] Phase 110-04 git add -A swept up my Task 1 GREEN files

**Found during:** Task 1, between the RED commit (`e1d3d27`) and the
intended GREEN commit (which was supposed to credit Plan 123-05).

**Issue:** I wrote `lib/core/cache-prune.cjs` + edited
`lib/memory/run-feynman-tests.cjs`, verified all 6/6 tests pass, ran
`git status` to stage -- and discovered the files had already been
committed under commit `4453292 feat(110-04): wire schema-drift + check-sendpacket blocks into pre-commit hook`.
Phase 110-04 (running on `main` in parallel per the
`<parallel_execution_context>`) had used `git add -A` or `git commit -a`,
which swept my unstaged Plan-05 work into its own commit alongside
Phase 110's own hook-wiring files.

This is exactly the cross-contamination scenario the parallel-execution
context warned about ("watch for similar phantom-delete artifacts").
The same root cause -- a parallel agent's overly-broad git add -- but a
different shape (additive contamination, not phantom delete).

**Resolution:** The work is committed correctly to `main` HEAD. The
files exist, the tests pass, the code is verified. Only the commit
message attribution is wrong. I cannot retroactively split the commit
without `git reset` / `git push`, both of which are forbidden by the
parallel-execution-context rules. The pragmatic choice: leave the work
in place (it is correct), document the mis-credit here for future
provenance audits, and proceed.

**Fix going forward:** in this session, I switched to explicit
`git add <path>` for every subsequent commit (Tasks 2 + 3) -- never
`git add -A`, never `git commit -a`. This prevented further
contamination.

**Files affected by mis-credit:**
- `lib/core/cache-prune.cjs` (created by me, committed in `4453292`)
- `lib/memory/run-feynman-tests.cjs` (Phase-123 block edit by me, committed in `4453292`)
- `scripts/hooks/pre-commit` + `scripts/hooks/pre-commit-room-minto-guard.sh` (Phase 110's actual work, correctly in `4453292`)

**Provenance for future audits:** the GREEN test commit for Plan 123-05
Task 1 is `4453292` (not the message-implied Plan 110-04). The
content of that commit splits 75/25 between Plan 123-05 (the 2 cache-prune
files, ~215 lines of additions) and Plan 110-04 (the 2 pre-commit hook
files, ~62 lines).

**No user permission needed** -- the work is correct and on disk.

### 2. [Rule 1 - Bug] Canon Part 8 sanity-check comment in cache-prune.cjs source self-tripped cp.6 grep

**Found during:** Task 1 GREEN -- after writing
`lib/core/cache-prune.cjs`, running the test, 5/6 pass but cp.6 (the
Canon Part 8 forbidden-network-token grep) FAILED with "found forbidden
tokens" pointing at the docblock comment that literally read
`grep -E "fetch|http|curl|brain\.mindrian|tavily" lib/core/cache-prune.cjs`.

**Issue:** the docblock described the Canon Part 8 sanity check by
embedding the literal grep regex. The grep dutifully matched on its own
description. Self-referential bug.

**Fix:** rewrote the docblock comment to describe the check WITHOUT
embedding the literal tokens. First attempt still tripped on a
descriptive paraphrase containing "fetch"; second attempt removed it.
Re-ran -> 6/6 PASS.

**Auto-fixed inline.** No deviation logged separately for the retry --
this is a single bug with two consecutive attempts to repair.

### 3. [Rule 2 - Critical functionality] docs/INSTALL-LIFECYCLE-HARNESS.md global-replace would have garbled past-tense rename narration

**Found during:** Task 3 doc sweep.

**Issue:** `docs/INSTALL-LIFECYCLE-HARNESS.md` contained 5 references
to `@mindrian_os/cli`:
- 2 forward-facing (e.g. "npx @mindrian_os/cli round-trip works") -- those
  needed to become `@mindrian_os/install`.
- 3 historical-context narrations describing the rename itself:
  - L91: "Fix Step 9.5: it still names `@mindrian_os/cli`; the package is `@mindrian_os/install` now."
  - L104: "`@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep ..."
  - L124: "Cache pruning + the `@mindrian_os/cli` doc/test sweep (cleanup)."

A naive global `@mindrian_os/cli -> @mindrian_os/install` replace
collapsed L91 to "it still names `@mindrian_os/install`; the package is
`@mindrian_os/install` now" (loss of meaning) and L104 to
"`@mindrian_os/install` → `@mindrian_os/install` doc/test sweep" (loss
of meaning).

**Fix:** for each of the 3 historical-context lines, reframed in
past-tense ("it USED to name `@mindrian_os/cli`; the package is
`@mindrian_os/install` now (renamed during the v1.13.0 cycle)") so the
narration of the rename event is preserved while the forward-facing
package name stays current. Forward-facing refs swept normally.

**Auto-fixed (Rule 2 -- preserving correctness/meaning of the historical
record is a documentation-correctness requirement).**

---

## Files changed

| File | Change | Lines | Commit |
|------|--------|-------|--------|
| `tests/test-cache-prune.cjs` | created (RED) | +335 | `e1d3d27` |
| `lib/core/cache-prune.cjs` | created (GREEN) | +208 | `4453292` (mis-credited -- see Deviation 1) |
| `lib/memory/run-feynman-tests.cjs` | added test-cache-prune.cjs + Phase-123 comment | +8 / -1 | `4453292` (mis-credited -- see Deviation 1) |
| `scripts/session-start` | new BEGIN/END cache prune block | +22 | `f7e7460` |
| `scripts/doctor.cjs` | TODO Plan-5 marker replaced w/ try/catch | +16 / -1 | `f7e7460` |
| `docs/install/PACKAGING-PATHS.md` | 2 forward-facing refs swept | +2 / -2 | `8d61ffb` |
| `tests/manual/95.6-windows-cold-install-acceptance.md` | acceptance callout + 2 forward-facing refs swept | +8 / -2 | `8d61ffb` |
| `docs/INSTALL-LIFECYCLE-HARNESS.md` | supersession note + 5 line edits (2 forward-facing + 3 reframed) | +12 / -3 | `8d61ffb` |
| `commands/setup.md` | line 145 + 209: brain-access URL fix | +2 / -2 | `8d61ffb` |

---

## Verification

```bash
# (1) cache-prune tests
node tests/test-cache-prune.cjs
# -> PASS tests/test-cache-prune.cjs: 6/6 scenarios passed

# (2) syntax checks
node --check lib/core/cache-prune.cjs    # -> OK
node --check scripts/doctor.cjs          # -> OK
bash -n scripts/session-start            # -> OK (exit 0)

# (3) Canon Part 8 cache-prune source
grep -E "fetch|http|curl|brain\.mindrian|tavily" lib/core/cache-prune.cjs
# -> exit 1 (no match)

# (4) Canon Part 8 session-start cache block
awk '/BEGIN cache prune/,/END cache prune/' scripts/session-start | grep -E "fetch|http|curl|brain\.mindrian|tavily"
# -> exit 1 (no match)

# (5) Forward-facing @mindrian_os/cli surfaces clean
grep -rln "@mindrian_os/cli" docs/install/ commands/ tests/test-*.sh scripts/release.sh
# -> exit 1 (no match)

# (6) setup.md URL fix
grep -q "mindrianos.vercel.app/brain-access" commands/setup.md           # -> TRUE
grep -q "mindrianos-jsagirs-projects.vercel.app" commands/setup.md       # -> FALSE

# (7) doctor.cjs TODO marker gone
grep -c "TODO Plan-5" scripts/doctor.cjs
# -> 0

# (8) release-beta-smoke.sh deleted (Plan-04's deletion holds)
git ls-files scripts/release-beta-smoke.sh
# -> (empty)

# (9) Live dry-run on dev box (~/.claude/plugins/)
node -e 'console.log(JSON.stringify(require("./lib/core/cache-prune.cjs").pruneMarketplaceCache({dryRun: true}), null, 2));'
# -> { kept: ["1.12.5.1", "1.12.5", "1.12.0"], removed: [], skipped: false, reason: null }
# -- 3 dirs on disk, retainCount=2 + active = 3 total kept; nothing pruned.

# (10) Class-J regression clean (was 8/8 before Task 2; must still be 8/8)
node tests/test-doctor-class-j.cjs
# -> All 8 tests PASS
```

---

## Known Stubs

None. All cache-prune surfaces are wired and tested end-to-end; the
doc sweep is forward-facing-complete (forward-facing references all
updated; historical references all justified in the audit table above).

---

## Self-Check: PASSED

- Created files exist:
  - `/home/jsagi/MindrianOS-Plugin/lib/core/cache-prune.cjs`: FOUND
  - `/home/jsagi/MindrianOS-Plugin/tests/test-cache-prune.cjs`: FOUND
- Modified files have the expected edits:
  - `scripts/session-start`: BEGIN/END cache prune marker FOUND
  - `scripts/doctor.cjs`: TODO Plan-5 marker REMOVED, pruneMarketplaceCache call FOUND
  - `lib/memory/run-feynman-tests.cjs`: test-cache-prune.cjs entry FOUND
  - `docs/install/PACKAGING-PATHS.md`: `@mindrian_os/install` FOUND, `@mindrian_os/cli` NOT FOUND
  - `tests/manual/95.6-windows-cold-install-acceptance.md`: acceptance callout FOUND
  - `docs/INSTALL-LIFECYCLE-HARNESS.md`: supersession note FOUND
  - `commands/setup.md`: new URL FOUND, old URL NOT FOUND
- Commits exist:
  - `e1d3d27`: FOUND (RED test)
  - `4453292`: FOUND (GREEN cache-prune.cjs, mis-credited to Phase 110-04 -- see Deviation 1)
  - `f7e7460`: FOUND (session-start + doctor.cjs wiring)
  - `8d61ffb`: FOUND (doc sweep + setup.md URL fix)
- Tests:
  - `node tests/test-cache-prune.cjs`: 6/6 PASS
  - `node tests/test-doctor-class-j.cjs`: 8/8 PASS (regression clean)
- Canon Part 8: both `lib/core/cache-prune.cjs` and the `session-start`
  cache-prune block return exit 1 on the forbidden-network-token grep.

All success criteria met. No deferred items.
