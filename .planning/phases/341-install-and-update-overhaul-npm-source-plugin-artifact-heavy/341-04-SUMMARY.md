---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 04
subsystem: packaging
tags: [npm-pack, npm-shrinkwrap, harness-policy, files-allowlist, payload-ceiling, registry-drift]

# Dependency graph
requires:
  - phase: 341-01
    provides: "tests/run-all-341.sh aggregator + the two D-03/D-04 EXPECTED-RED tripwires this plan flips green"
  - phase: 341-02
    provides: "lib/core/eureka-deps-resolver.cjs + eureka-enable.cjs; every @huggingface/transformers consumer already resolves through it, so this plan's dependency removal needed zero consumer-side code change"
  - phase: 341-03
    provides: "Class S 5-layer split (model_installed advisory), so removing the heavy dependency here does not regress the blocker layers"
provides:
  - "package.json files: 23-entry runtime allowlist (4 negations), npm-shrinkwrap.json shipped"
  - "npm-shrinkwrap.json: the loader's npm ci --ignore-scripts input, zero dev entries, all 5 sqlite-vec platform packages"
  - "scripts/check-release-payload-ceiling.cjs + data/harness-policies/release-payload-ceiling.json (blocking)"
  - "scripts/check-registry-drift.cjs + data/harness-policies/registry-drift.json (logged)"
  - "lib/core/pitch-feedback-schemas.cjs self-test relocated off .planning"
  - "lib/brain/curation-batch.cjs loadNeo4jDriver honest operator-only failure"
affects: [341-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "npm shrinkwrap renames package-lock.json rather than generating a parallel file (npm 10.9.8, measured): once npm-shrinkwrap.json exists, npm install --package-lock-only updates it in place and will not recreate a separate package-lock.json"
    - "Env-seam inheritance through a spawn chain: a test can flip a harness policy's own runner behavior by setting an env var on the OUTER run-harness.cjs spawn, since spawnSync inherits process.env by default at every hop (test -> run-harness.cjs -> the policy's own spawned runner)"

key-files:
  created:
    - scripts/check-release-payload-ceiling.cjs
    - scripts/check-registry-drift.cjs
    - data/harness-policies/release-payload-ceiling.json
    - data/harness-policies/registry-drift.json
    - tests/fixtures/341-registry-drift-baseline.json
    - tests/test-341-shrinkwrap-no-dev.cjs
    - tests/test-341-shrinkwrap-platform-coverage.cjs
    - tests/test-341-payload-ceiling.cjs
    - tests/test-341-registry-drift.cjs
    - npm-shrinkwrap.json
  modified:
    - package.json
    - package-lock.json
    - lib/core/pitch-feedback-schemas.cjs
    - lib/brain/curation-batch.cjs
    - data/harness-manifest.json

key-decisions:
  - "package-lock.json and npm-shrinkwrap.json are byte-identical (0 diff): npm 10.9.8's `npm shrinkwrap` renames package-lock.json rather than producing a second file, and a subsequent `npm install --package-lock-only` treats an existing shrinkwrap as canonical and refuses to regenerate a separate lock. Restored package-lock.json as an identical copy so the plan's literal instruction to commit both together is honored; npm never publishes it regardless (F-6), only npm-shrinkwrap.json ships."
  - "curation-batch.cjs loadNeo4jDriver() confirmed operator-only via full caller graph (scripts/curation-132-03-dedup-held-rename.cjs, scripts/curation-132-05-pseudonymize.cjs, scripts/verify-phase-132.cjs -- all one-time migration/verification scripts, never a user command); now throws an honest operator-checkout message when mcp-server-brain/node_modules/neo4j-driver is absent instead of a raw MODULE_NOT_FOUND."
  - "Task 2's tier-failure test arm (arm 5) uses env-seam inheritance through the spawn chain (test -> run-harness.cjs -> the policy's own runner spawn) rather than run-harness.cjs's --root flag, because --root only changes which data/harness-policies/ directory is loaded, not which root the loaded policy's OWN runner measures -- the env var travels the whole chain for free since spawnSync inherits process.env by default at every hop. Task 3's arm 6 (logged-does-not-fail-the-tier) uses the identical mechanism."

requirements-completed: [D-02, D-03, D-04, D-05, D-08, D-13]

# Metrics
duration: 100min
completed: 2026-09-10
---

# Phase 341 Plan 04: The Payload Cut + Two Harness Policies Summary

**Cut package.json to a 23-entry runtime allowlist, removed @huggingface/transformers from dependencies, shipped npm-shrinkwrap.json (zero dev entries, all 5 sqlite-vec platform packages), and stood up two harness policies (release-payload-ceiling blocking, registry-drift logged) that keep the payload honest forever -- entryCount 1829-1831 / unpackedSize ~29.1 MB, both plan 341-01 EXPECTED-RED tripwires now green, doctor --acceptance --pre-tag 17/17.**

## Performance

- **Duration:** ~100 min (commit span 2026-09-10T06:51 to 2026-09-10T07:40 UTC-adjacent, plus prior reading/verification time not reflected in commit timestamps)
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 completed
- **Files modified:** 15 (10 new, 5 modified)

## Accomplishments

- `npm ci` restored the locked dependency set before any measurement (171 packages added, 0 vulnerabilities-relevant changes to the lock; `git status` clean afterward -- no drift from the research session's documented `slopcheck install` side effect).
- `package.json` `files` replaced the 5-entry CLI shim with the measured 23-entry runtime allowlist from 341-RESEARCH, verbatim, in the documented order, with four `!` negations. `@huggingface/transformers` removed from `dependencies` (D-03); every consumer already resolves through `lib/core/eureka-deps-resolver.cjs` (341-02), so zero consumer-side code changed.
- `npm-shrinkwrap.json` generated: 128 packages, zero `dev:true` entries, all five sqlite-vec platform packages (`darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `windows-x64`) each carrying `os`/`cpu`/`optional:true`; `sqlite-vec-windows-arm64` confirmed absent (no upstream package) and made VISIBLE as a passing-but-reported test arm rather than a silent gap.
- `npm pack --dry-run --json` measures **entryCount=1829-1831, unpackedSize=29,101,156-29,114,166 bytes (~27.75-27.77 MiB), size=8,936,433-8,942,158 bytes (~8.52-8.53 MiB)** across three measurement runs taken over this plan's span (small run-to-run variance from ordinary in-flight repo activity during a ~100-minute plan, including an unrelated concurrent commit landing mid-plan -- see Deviations). This sits within research's 1,836 / 29,015,424 / 8,912,616 measurement: 9.15% of the 20,000-entry ceiling, 10.85% of the 256 MiB ceiling.
- Closed both plan 341-01 EXPECTED-RED tripwires: `tests/test-341-payload-shrinkwrap-present.cjs` (PASS=4) and `tests/test-341-no-heavy-dep.cjs` (PASS=4).
- Closed the two at-risk runtime readers 341-RESEARCH flagged:
  - `lib/core/pitch-feedback-schemas.cjs`: self-test `outDir` moved from a `.planning/phases/229-*/schemas` path to `fs.mkdtempSync(path.join(os.tmpdir(), 'mos-pitch-schemas-'))`. Production callers (`scripts/huji-run-one.cjs`, `scripts/huji-eval.cjs`) never call `toJsonSchemas()`, so this is self-test-only.
  - `lib/brain/curation-batch.cjs` `loadNeo4jDriver()`: confirmed operator-only (see key-decisions), now fails with an honest message instead of `MODULE_NOT_FOUND` when the driver is absent (as it always is under the npm-installed artifact, since `mcp-server-brain/` was never in `files`).
- `scripts/check-release-payload-ceiling.cjs` (D-08): seven offline assertions over `npm pack --dry-run --json` -- entry/byte ceilings, shrinkwrap present, `.claude-plugin/plugin.json` present, no `scripts/release.sh`/`release-lib/`, no forbidden-path prefix, zero `hasInstallScript:true` across the shrinkwrap plus zero root lifecycle scripts. Rides the existing `harness-policies` doctor point at rung `blocking` -- zero new release.sh wiring.
- `scripts/check-registry-drift.cjs` (D-08, the folded 2026-07-03 todo): `diffRegistries` pure, `check()` resolves a baseline (env seam -> `git show <last-tag>:data/command-registry.json` -> the committed fixture fallback) and always states which source it used. Rides the same doctor point at rung `logged`, with a real `evidence_log` path and a `promotion_rule` authored before any evidence exists.
- `bash tests/run-all-341.sh`: `PASS=18 FAIL=0 SKIP=10 EXPECTED-RED=0` (up from plan 341-03's `PASS=12 SKIP=14 EXPECTED-RED=2` -- the 6 new `tests/test-341-*.cjs` legs flipped SKIP -> PASS, both EXPECTED-RED tripwires flipped to green PASS; the remaining 10 SKIPs are legs guarded on artifacts belonging to plan 341-05 and later).
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2` (the pre-existing Step 9.7 package-name-drift issue, documented, unrelated to this plan).
- `node scripts/doctor.cjs --acceptance --pre-tag`: **17/17 points passed**, including `harness-policies` (both new policies run and pass) and `eureka-smoke-stack-ready` (5 layers, `model_installed` reports `ok:true, advisory:true` on this dev checkout).

## Task Commits

Each task was committed atomically:

1. **Task 1: Cut package.json, generate npm-shrinkwrap.json, and close the two at-risk runtime readers** - `9c9e7de4` (feat)
2. **Task 2: Build the release-payload-ceiling gate runner and its blocking policy** - `4dd7a90e` (feat)
3. **Task 3: Build the registry-drift gate runner and its logged policy (the folded todo)** - `2eb48133` (feat)

## Files Created/Modified

- `package.json` - 23-entry `files` allowlist (`.claude-plugin`, `.mcp.json`, `settings.json`, `npm-shrinkwrap.json`, `hooks`, `commands`, `skills`, `agents`, `pipelines`, `output-styles`, `lib`, `!lib/wiki/editor-src`, `!lib/import/test-fixtures`, `scripts`, `!scripts/release.sh`, `!scripts/release-lib`, `bin`, `data`, `references`, `templates`, `assets`, `README.md`, `LICENSE`, `CHANGELOG.md`); `@huggingface/transformers` removed from `dependencies`.
- `package-lock.json`, `npm-shrinkwrap.json` - regenerated together; confirmed byte-identical (see key-decisions).
- `lib/core/pitch-feedback-schemas.cjs` - self-test `outDir` -> `os.tmpdir()`; added `const os = require('os')`.
- `lib/brain/curation-batch.cjs` - `loadNeo4jDriver()` now checks `fs.existsSync(driverPath)` and throws an honest operator-checkout message when absent.
- `scripts/check-release-payload-ceiling.cjs` - exports `measurePayload`, `check`, `MAX_ENTRIES` (20000), `MAX_UNPACKED` (268435456). CLI `--check`. Seam `CHECK_PAYLOAD_CEILING_ROOT`.
- `scripts/check-registry-drift.cjs` - exports `diffRegistries`, `check`. CLI `--check`. Seam `CHECK_REGISTRY_DRIFT_BASELINE`.
- `data/harness-policies/release-payload-ceiling.json` - `rung: blocking`, `applies_to: [pre-tag, full]`.
- `data/harness-policies/registry-drift.json` - `rung: logged`, `evidence_log: $MINDRIAN_HOME/registry-drift.jsonl`.
- `data/harness-manifest.json` - regenerated twice (once per new policy), `--check` green.
- `tests/fixtures/341-registry-drift-baseline.json` - committed fallback baseline, stripped to `{command, kind, surface, visibility}` per entry, 113 commands, dated `_note`.
- `tests/test-341-shrinkwrap-no-dev.cjs`, `tests/test-341-shrinkwrap-platform-coverage.cjs`, `tests/test-341-payload-ceiling.cjs`, `tests/test-341-registry-drift.cjs` - new tests, all `FAIL=0`.

## Record: npm ci

`npm ci` (Task 1, first action, before any measurement): `added 171 packages, audited 172 packages`, 15 vulnerabilities reported (1 low, 4 moderate, 10 high -- all pre-existing in this dependency set, out of this plan's scope per the scope-boundary rule; not introduced or touched by this plan). `git status` clean immediately after, confirming no drift remained from the research session's documented `slopcheck install` side effect (`@modelcontextprotocol/sdk`/`semver` version bump, already reverted per 341-RESEARCH's own note).

## Record: measured payload vs research

| Metric | 341-RESEARCH | This plan (measured across 3 runs) | Delta |
|---|---|---|---|
| entryCount | 1,836 | 1,829-1,831 | -5 to -7 (0.3-0.4%) |
| unpackedSize | 29,015,424 | 29,101,156-29,114,166 | +85,732 to +98,742 (0.3%) |
| size (packed) | 8,912,616 | 8,936,433-8,942,158 | +23,817 to +29,542 (0.3%) |

Explanation: research's numbers were measured 2026-09-09 against a hard-linked snapshot of the tree at that moment; this plan's measurements were taken 2026-09-10 against the live tree, which had ordinary in-flight repo activity (including a concurrent, unrelated commit landing mid-plan -- see Deviations) between the two measurement dates. A ~0.3% delta on both entry count and byte size is consistent with a handful of unrelated file edits elsewhere in the shipped tree (e.g. `.claude-plugin/`, `commands/`, `docs`-adjacent files that are NOT excluded), not a packaging regression. All three measurements sit comfortably within both ceilings (9.15% of the entry ceiling, 10.85% of the byte ceiling).

## Record: npm-shrinkwrap.json vs package-lock.json (closing assumption A7)

341-RESEARCH's A7 flagged that `npm shrinkwrap`'s equivalence to the committed lock was verified only from `--help` text, never executed. Measured this plan: **npm 10.9.8's `npm shrinkwrap` renames `package-lock.json` to `npm-shrinkwrap.json` in place (npm's own notice: "package-lock.json has been renamed to npm-shrinkwrap.json") -- it does not generate a second, parallel file.** Confirmed further: once `npm-shrinkwrap.json` exists, `npm install --package-lock-only` updates it in place and will NOT recreate a separate `package-lock.json` (verified live: ran the command a second time, `package-lock.json` did not reappear). The two files are therefore not merely "structurally equivalent" -- they are byte-identical by construction, since there is only ever one file on disk at a time under this mechanism. `package-lock.json` was restored as an explicit identical copy (`cp npm-shrinkwrap.json package-lock.json`) so the plan's literal instruction to commit both together is honored; per F-6 (341-01/341-RESEARCH), npm never publishes `package-lock.json` regardless of its presence, so only `npm-shrinkwrap.json` reaches the tarball.

## Record: ROOM.md count in payload

`npm pack --dry-run --json` payload contains **29** paths matching `(^|/)ROOM\.md$` (ICM Layer 0 identity files preserved across every shipped directory).

## Record: confirmed caller list for curation-batch.cjs loadNeo4jDriver (closing assumption A4)

Full repo grep for `curation-batch` and `loadNeo4jDriver` (excluding `.test.cjs` files and the definition site itself) found exactly three callers of the live path (`makeBatch(...).execute()`/`.rollback()`, which internally calls `loadNeo4jDriver()`):

- `scripts/curation-132-03-dedup-held-rename.cjs`
- `scripts/curation-132-05-pseudonymize.cjs`
- `scripts/verify-phase-132.cjs`

All three are one-time Phase 132 migration/verification scripts run by an operator from a dev checkout. `scripts/admin-brain-write.cjs` has its OWN separate `loadNeo4jDriver()` function (not this one) and does not call `curation-batch.cjs`'s version. No user-facing command (a `/mos:*` slash command, a hook, or an MCP tool) reaches this path. Confirmed operator-only; the guard added in Task 1 is safe.

## Record: reason each `!` negation exists

- `!lib/wiki/editor-src` - 9,119 entries / ~208 MiB nested `node_modules` build-source tree (npm's own `node_modules` exclusion is root-only, so a NESTED one needs an explicit negation). `lib/wiki/editor-dist/` is the runtime artifact and stays in `files` via the wholesale `lib` entry; excluding `editor-src` from the tarball does not break `editor-dist`, but `editor-src` stays in GIT for future rebuilds.
- `!lib/import/test-fixtures` - fixture-only bytes with zero runtime readers; drops the longest shipped relative path from about 101 to about 70 characters, buying 31 characters of Windows `MAX_PATH` headroom for zero risk (341-RESEARCH's "optional further reduction," taken here).
- `!scripts/release.sh` - `scripts/release.sh:750` runs an unanchored `grep -Eq '...|release\.sh'` against its own `npm pack --dry-run` output and `exit 1`s on a match; shipping `scripts/` wholesale would make the tarball contain `scripts/release.sh`, which the CURRENT release script cannot publish.
- `!scripts/release-lib` - same guard's rationale extended: release-ceremony internals with zero runtime reads, not needed by an installed plugin.
- `docs/` and `dist/` were deliberately NOT added to `files` (not negations, simple omissions): both have zero runtime readers (confirmed by 341-RESEARCH's grep audit, limited to `*.test.cjs` files for `docs/`), `release.sh:750` already refuses a tarball containing `docs/`, and `lib/core/update-path.cjs:34`'s own comment states that a runtime read of a doc path would be a distribution hazard.

## Record: which registry-drift tier-test form was used

Task 3's plan text offered two options for proving the `logged` rung does not fail the tier: pointing `run-harness.cjs` at an alternate root via `--root`, or asserting the `--policy release-payload-ceiling` review form. Neither fit directly: `--root` changes which `data/harness-policies/` directory is loaded, not which root the LOADED policy's own runner measures. Used a third, simpler mechanism instead: **env-seam inheritance through the spawn chain**. `spawnSync` inherits `process.env` by default at every hop, so setting `CHECK_REGISTRY_DRIFT_BASELINE` (or `CHECK_PAYLOAD_CEILING_ROOT` for Task 2's equivalent arm) on the OUTER `run-harness.cjs` spawn propagates all the way down to the policy's own INNER runner spawn, without needing any `--root`-style plumbing in `run-harness.cjs` itself. This exercises the real tier-evaluation code path end to end (both `run-harness.cjs`'s tier filter/evaluatePolicies AND the actual policy runner), which is a stronger proof than either of the plan's two suggested forms. Recorded here per the plan's own instruction to state which form was used and why.

## Decisions Made

See `key-decisions` in the frontmatter above (the npm-shrinkwrap.json/package-lock.json byte-identity finding, the curation-batch.cjs operator-only confirmation, and the env-seam-inheritance test mechanism used in both Task 2's and Task 3's tier-failure arms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan's stated mechanism does not match measured npm 10.9.8 behavior] `npm shrinkwrap` renames rather than generates a parallel file**
- **Found during:** Task 1, step 3 ("Run `npm install`... then `npm shrinkwrap`... Commit `package-lock.json` and `npm-shrinkwrap.json` together")
- **Issue:** The plan's action text assumes both files coexist as independently-generated siblings after `npm shrinkwrap` runs. Measured: npm 10.9.8 renames `package-lock.json` to `npm-shrinkwrap.json` in place (confirmed via the tool's own console notice), and a subsequent `npm install --package-lock-only` will not recreate a separate `package-lock.json` once a shrinkwrap exists.
- **Fix:** Restored `package-lock.json` as an explicit byte-identical copy of `npm-shrinkwrap.json` (`cp npm-shrinkwrap.json package-lock.json`) so the plan's literal instruction ("commit both together") is satisfied without fighting npm's actual mechanism. This closes assumption A7 more precisely than the plan anticipated: the two files are not merely "structurally equivalent," they are byte-identical, because there is only ever one canonical lockfile on disk under this npm version's shrinkwrap mechanism.
- **Files modified:** `package-lock.json` (restored as a copy; no separate generation was possible)
- **Verification:** `diff` confirmed 0 differences between the two files at commit time; `git status` clean after.
- **Committed in:** `9c9e7de4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 tooling-behavior correction, Rule 1)
**Impact on plan:** No scope creep. The fix satisfies the plan's literal instruction (both files present and committed) while accurately documenting what actually happens under npm 10.9.8, closing assumption A7 more conclusively than "verified only from --help" (341-RESEARCH's own caveat).

## Issues Encountered

- Mid-plan, an unrelated commit (`01ae0169`, "docs(341): add D-07a...", authored by the project owner, touching only `341-CONTEXT.md` and `341-DISCUSSION-LOG.md`) landed on `main` between this plan's Task 1 and Task 2 commits. Per the destructive-git-prohibition and incident-context rules governing this session: observed via `git log`, confirmed it touched zero files this plan declares, and left it untouched. Noted here only as an observation, not an action taken. It is the most likely explanation for the small (~0.3%) delta between this plan's own three payload measurements and 341-RESEARCH's snapshot (see the measured-payload table above) -- though the commit itself did not touch any file inside the `files` allowlist, so its effect (if any) on the measured entry/byte counts would be indirect at most.
- No other issues. All three tasks passed every listed acceptance-criteria command on first attempt after the initial `npm shrinkwrap` mechanism discovery documented above.

## User Setup Required

None - no external service configuration required. Zero real `npm publish`, zero real `git push`, zero download of the heavy embedding stack anywhere in this plan's verification. `npm ci`, `npm install --package-lock-only --ignore-scripts`, and `npm shrinkwrap` all touch only the local lockfile/tree; `npm pack --dry-run --json` is offline by construction (confirmed no registry call, per 341-RESEARCH's own measurement and this plan's own zero-network source-level greps on both new runners).

## Next Phase Readiness

- The tree is publishable by hand: `doctor --acceptance --pre-tag` is green (17/17), both plan 341-01 EXPECTED-RED tripwires are green, and `bash tests/run-all-341.sh` reports `FAIL=0 EXPECTED-RED=0`. Per D-13, this closes step 1 of the migration order; plan 341-05 (proving a COLD install on Windows/Mac/Linux) is the next gate before anything else ships.
- Plan 341-05 can read this plan's own measured `npm pack --dry-run --json` numbers directly rather than re-deriving them: entryCount ~1830, unpackedSize ~29.1 MB.
- The release ceremony itself (`scripts/release.sh` Step 6.7 replacement with the Pattern-1 shrinkwrap-generation sketch, Step 9.5's blacklist becoming this plan's ceiling assertion, the `tests/run-all-310.sh` step-block fixture regeneration) is explicitly OUT of this plan's scope, per the plan's own objective statement ("The release ceremony is NOT touched here; that is plan 341-05"). `tests/run-all-341.sh`'s remaining 10 SKIPs are all legs guarded on artifacts that plan and later plans in this phase create.
- No blockers.

## Self-Check: PASSED

- `package.json` `files` contains all 9 required literals, excludes `docs`/`dist` - CONFIRMED (`node -e` acceptance command, exit 0)
- `npm-shrinkwrap.json` exists, parses as JSON - FOUND
- `scripts/check-release-payload-ceiling.cjs` exists, `node --check` exits 0 - FOUND
- `scripts/check-registry-drift.cjs` exists, `node --check` exits 0 - FOUND
- `data/harness-policies/release-payload-ceiling.json` exists, schema-valid fields confirmed - FOUND
- `data/harness-policies/registry-drift.json` exists, schema-valid fields confirmed - FOUND
- `tests/fixtures/341-registry-drift-baseline.json` exists - FOUND
- `tests/test-341-shrinkwrap-no-dev.cjs`: PASS=4 FAIL=0 - CONFIRMED
- `tests/test-341-shrinkwrap-platform-coverage.cjs`: PASS=22 FAIL=0 - CONFIRMED
- `tests/test-341-payload-ceiling.cjs`: PASS=6 FAIL=0 - CONFIRMED
- `tests/test-341-registry-drift.cjs`: PASS=7 FAIL=0 - CONFIRMED
- Commit `9c9e7de4` (feat, Task 1) - FOUND in `git log --oneline`
- Commit `4dd7a90e` (feat, Task 2) - FOUND in `git log --oneline`
- Commit `2eb48133` (feat, Task 3) - FOUND in `git log --oneline`
- `bash tests/run-all-341.sh`: `PASS=18 FAIL=0 SKIP=10 EXPECTED-RED=0` - CONFIRMED
- `bash tests/run-all-310.sh`: `PASS=9 FAIL=0 SKIP=2` (zero regression) - CONFIRMED
- `node scripts/doctor.cjs --acceptance --pre-tag`: 17/17 points passed - CONFIRMED
- `node scripts/doctor.cjs --eureka-smoke --json`: 5 layers, `model_installed` present - CONFIRMED
- `git status --porcelain` empty (clean tree, only plan-declared files touched across all three tasks) - CONFIRMED

---
*Phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy*
*Completed: 2026-09-10*
