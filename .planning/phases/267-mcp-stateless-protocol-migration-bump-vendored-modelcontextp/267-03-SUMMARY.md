---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 03
subsystem: testing
tags: [zod4, dependency-bump, sdk-1.30.1, wire-contract, wave-0, mcp]

# Dependency graph
requires:
  - phase: 267-01
    provides: "tests/helpers/mcp-wire-267.cjs (hermetic stdio JSON-RPC helper), tests/fixtures/267/wire-snapshot-zod3.json, tests/fixtures/267/zod-importers-baseline.txt, 267-BASELINE.md"
provides:
  - "zod bumped to 4.6.5 (range ^4.2.0, the server package's own dependencies.zod range re-checked at execute time) and @modelcontextprotocol/sdk bumped to 1.30.1, in lockstep across package.json/package-lock.json/npm-shrinkwrap.json, zero registration-code changes"
  - "tests/fixtures/267/zod4-accepted-deltas.json: the pinned zod-4 wire-contract delta (37 tools lose additionalProperties:false at 40 nested sites; brain_query gains propertyNames on a z.record site; eureka_critic + question_set gain safe-integer int bounds; zero description diffs), measured on a scratch zod@4 install before the repo's own bump"
  - "tests/test-267-mcpv2-zod4-contract.cjs (MCPV2-03): the contract test every later plan runs to prove the zod-4 wire contract hasn't drifted further"
  - "tests/fixtures/267/wire-snapshot-zod4.json: post-bump wire snapshot for 267-05 and 267-11 to diff against"
  - "tests/test-198-contract-schema.test.cjs made zod-version-agnostic (reads _zod.def.type OR _def.typeName), same pre-existing contract failure preserved unchanged"
affects: [267-05, 267-06, 267-07, 267-08, 267-09, 267-10, 267-11, 267-12, 267-13, 267-14, 267-15, 267-16, 267-17, 267-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scratch-install zod-4 measurement: boot both stdio servers under a node -r Module._resolveFilename preload that redirects every require('zod'|'zod/...') to a scratch npm-installed zod@4, diff tools/list against the zod-3 snapshot, and pin the observed delta as a fixture BEFORE touching the repo's own dependencies -- so the accepted-delta fixture and the RED contract test both exist and are committed before the bump itself lands."
    - "zod-version-agnostic schema introspection: read the type kind from _zod.def.type (zod 4, lowercase) when present, else _def.typeName (zod 3, PascalCase), mapping both vocabularies onto one sample generator rather than branching the whole function on installed major."

key-files:
  created:
    - tests/fixtures/267/zod4-accepted-deltas.json
    - tests/test-267-mcpv2-zod4-contract.cjs
    - tests/fixtures/267/wire-snapshot-zod4.json
  modified:
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - tests/test-198-contract-schema.test.cjs

key-decisions:
  - "ZOD_RANGE pinned to ^4.2.0 (the @modelcontextprotocol/server package's own dependencies.zod range at execute time), not npm's auto-written ^4.6.5 -- after `npm install zod@^4.2.0` resolved and installed 4.6.5, npm's default save behavior wrote the RESOLVED version's caret (^4.6.5) into package.json/lockfiles rather than the literal range argument given on the CLI. Hand-corrected package.json to ^4.2.0 per the plan's explicit instruction, then regenerated both lockfiles from that corrected manifest via `npm install --package-lock-only` so all three files agree on the intended range, not npm's auto-resolved one."
  - "Measured deltas differ from the research's plan-time predictions in exact count (37 tools / 40 sites measured here vs. the research's '38 sites across 35 tools'; 2 safe-integer-bound sites measured here vs. the research's '1'), which is expected and explicitly sanctioned by the plan and CTX ('record what THIS run measures, never a literal') -- the delta is normal measurement-methodology variance (per-tool vs per-site counting), not a defect in either pass. The fixture and contract test pin the actual measured set."
  - "Corrected one research plan-time claim during Task 1 measurement: 267-RESEARCH.md's Code Examples section asserted 'require(\"zod/v4\") resolves to the same module instance as require(\"zod\") under zod 4 (plan-time check on 4.6.5: true)'. Live measurement on the scratch zod@4.6.5 install shows the two module NAMESPACE objects are NOT === (zod's package.json exports './' to index.cjs and './v4' to a different v4/index.cjs file). What IS true, and what actually matters for lib/core/pitch-feedback-schemas.cjs and lib/core/skillopt-schemas.cjs (the repo's two zod/v4 subpath importers): the underlying schema-building functions and class constructors ARE the same references (a.object === b.object, a.z.object === b.z.object, cross-instanceof checks pass, a schema built via one import path parses correctly and produces identical toJSONSchema output via the other). Full interop holds; only the module-namespace-identity framing was imprecise. Not a blocker -- documented here so a later plan does not re-derive this from scratch."
  - "package-lock.json was synced from npm-shrinkwrap.json (the file npm actually updates on install) via a scripted deep-copy of every non-'version' top-level key, explicitly preserving package-lock.json's OWN pre-existing root version fields (both top-level 'version' and packages[''].version) unchanged -- matching the exact relationship already established at 267-BASELINE (the two lockfiles differ from each other only in their own root version fields, and always have). Never hand-edited either JSON file directly; both lockfile-content commits are npm/script-generated."

requirements-completed: [MCPV2-03, MCPV2-12, MCPV2-19]

# Metrics
duration: ~50min
completed: 2026-09-24
---

# Phase 267 Plan 03: Zod 4 + SDK 1.30.1 Wave 0 Bump Summary

**zod bumped 3.25.76 -> 4.6.5 (range ^4.2.0) and @modelcontextprotocol/sdk bumped 1.29.0 -> 1.30.1 in lockstep, on v1, zero registration-code changes -- the wire-contract delta (37 tools losing additionalProperties:false at 40 sites, one z.record gaining propertyNames, two .int() fields gaining safe-integer bounds, zero description diffs) measured on a scratch install before the bump and pinned into a contract test that goes RED-to-GREEN across the two task commits.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-24T10:35:00Z (PLAN_BASE `f034d4194d46a565b7a5e872351cd3b6cdeb8976`)
- **Completed:** 2026-09-24T11:25:00Z
- **Tasks:** 2 (Task 2 split into two commits per its own instructions)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Re-checked all four version facts at execute time, never from the research snapshot (`npm view @modelcontextprotocol/server version dependencies.zod` = `2.1.0` / `^4.2.0`; `npm view @modelcontextprotocol/ext-apps version peerDependencies.zod` = `2.0.0` / `^4.2.0`; `npm view zod version` = `4.6.5`; `npm view @modelcontextprotocol/sdk@1.30.1 version dependencies.zod` = `1.30.1` / `^3.25 || ^4.0`). ZOD_RANGE = `^4.2.0`, confirmed to satisfy both the ext-apps peer and the sdk 1.30.1 range, matching the research's plan-time prediction exactly.
- Measured the zod-4 blast radius on a scratch `npm install --ignore-scripts zod@^4.2.0` (resolved 4.6.5) under a `Module._resolveFilename` preload, WITHOUT touching the repo's own `node_modules` or manifests: booted both `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs` under the redirect and diffed `tools/list` against `tests/fixtures/267/wire-snapshot-zod3.json`. Result: 37 local tools lose `additionalProperties:false` at 40 distinct nested JSON-Schema sites (some tools lose it at more than one path -- `chain_run`, `gate_render`, `identity_write` each at 2 paths); `brain_query`'s `params` field (a `z.record` site) gains `propertyNames:{type:"string"}` while its own top-level `additionalProperties:false` is preserved; `eureka_critic.schema_version` and `question_set.based_on_version` (both `.int()` fields) gain safe-integer `minimum`/`maximum` bounds. Zero description diffs anywhere (tools or prompts).
- Pinned the measured set into `tests/fixtures/267/zod4-accepted-deltas.json` and wrote `tests/test-267-mcpv2-zod4-contract.cjs` (MCPV2-03), which FAILED on the unchanged tree with only check (b) red ("zod 3 installed: accepted zod-4 delta not yet present") -- committed as the RED state.
- Bumped `zod` to `^4.2.0` (resolved 4.6.5) and `@modelcontextprotocol/sdk` to `^1.30.1` (resolved 1.30.1) in `package.json`, then brought `package-lock.json` into lockstep with `npm-shrinkwrap.json` (the file npm updates first) via a scripted `packages`-map copy that preserves each lockfile's own root version field. `npm ls zod` confirms exactly one deduped instance (4.6.5) across the whole dependency tree, including the two nested resolutions inside `@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/sdk`'s `zod-to-json-schema`.
- Rewrote `tests/test-198-contract-schema.test.cjs`'s `sampleForZodType()` to read the type kind from `_zod.def.type` (zod 4, lowercase) when present, else `_def.typeName` (zod 3, PascalCase), mapping both vocabularies onto the identical sample generator. The introspection no longer crashes with a `TypeError` under zod 4; the test still fails on the exact same pre-existing assertion ("context_assemble schema PARSES a synthesized sample input" -- the generator ignores `.min()`/`.max()` constraints, unrelated to zod version, named in `267-BASELINE.md`, out of this plan's scope), reproduced byte-identically before and after the rewrite.
- Wrote `tests/fixtures/267/wire-snapshot-zod4.json` (post-bump snapshot: 44 local tools, 6 brain tools) for 267-05 and 267-11 to diff against.
- Ran the full verification battery from `267-BASELINE.md`: every suite/test that had a pre-existing FAIL still fails with the SAME named leg(s), every suite that was green stayed green, `git diff $PLAN_BASE -- lib bin | wc -l` is `0` (zero registration or production code changed), `bash tests/run-all-267.sh` ends `FAIL=0` (PASS moved 20->21, SKIP moved 13->12, because the new zod4-contract test leg flipped from SKIP to PASS now that the file exists -- not a regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: Measure the zod-4 wire delta, pin it as the accepted set, write the RED contract test** - `17346e558` (test)
2. **Task 2a: Bump zod and @modelcontextprotocol/sdk in lockstep (package.json + both lockfiles)** - `bc761fa7e` (chore)
3. **Task 2b: Zod-version-agnostic test-198 rewrite + post-bump wire snapshot** - `4bb00c09e` (test)

_No plan-metadata-only commit was made separately; this SUMMARY.md and STATE/ROADMAP updates land in the standard final metadata commit._

## Files Created/Modified
- `tests/fixtures/267/zod4-accepted-deltas.json` - the pinned zod-4 wire delta (37 additionalProperties drops, 1 propertyNames gain, folded into the same tool-level entries; empty `app_views_schema_fix`/`prompts_fix` reserved for 267-09/267-10)
- `tests/test-267-mcpv2-zod4-contract.cjs` - MCPV2-03 contract test, 4 checks (description parity, pinned-delta equality gated by installed zod major, brain-shim `additionalProperties:false` guard, zod-importer CTX-boundary subset check)
- `tests/fixtures/267/wire-snapshot-zod4.json` - post-bump wire snapshot (44 local tools, 6 brain tools)
- `package.json` - `zod: "^4.2.0"`, `@modelcontextprotocol/sdk: "^1.30.1"`
- `package-lock.json`, `npm-shrinkwrap.json` - regenerated in lockstep, single deduped zod 4.6.5 instance
- `tests/test-198-contract-schema.test.cjs` - `sampleForZodType()` reads either zod-version's kind vocabulary; same pre-existing failure preserved

## Decisions Made
- ZOD_RANGE pinned by hand to `^4.2.0` after `npm install zod@^4.2.0` auto-wrote `^4.6.5` (npm's default save behavior records the resolved version's caret, not the literal CLI argument, when the argument is already a range) -- then regenerated both lockfiles from the corrected `package.json` via `npm install --package-lock-only` so all three files agree.
- `package-lock.json` synced from `npm-shrinkwrap.json` via a scripted deep-copy, explicitly preserving `package-lock.json`'s own pre-existing root version fields (unchanged from before this plan) rather than overwriting them to match `npm-shrinkwrap.json`'s root version -- matching the exact "differ only in their root version fields" relationship already established at `267-BASELINE.md`. First attempt at this script incorrectly synced the top-level `version` field too; caught and corrected before committing (verified via `node tests/test-267-mcpv2-lockstep.cjs` passing all 6 checks, including Check 2's "root version excluded" comparison).
- Measured delta counts differ from the research's plan-time predictions (37 tools/40 sites measured here vs. research's "38 sites across 35 tools"; 2 safe-integer-bound sites vs. research's "1") -- both are correct measurements taken with slightly different counting granularity (per-tool-with-a-diff vs. per-JSON-Schema-path); the CTX and plan both explicitly instruct recording what THIS run measures, never a research literal, so the fixture holds the actual measured set.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed.

### Corrected finding (not a deviation from the plan's own instructions, but a correction of a research claim carried into this plan's read_first material)

**1. `require('zod/v4')` is not the same module instance as `require('zod')` under zod 4, contrary to 267-RESEARCH.md's plan-time check**
- **Found during:** Task 1, step 2 (the `require('zod/v4')` same-instance confirmation the plan's action text explicitly asks for)
- **Issue:** 267-RESEARCH.md's Code Examples section states "confirm require('zod/v4') resolves to the same module instance as require('zod') under zod 4 (plan-time check on 4.6.5: true)". Live measurement on the scratch zod@4.6.5 install shows `require('zod') === require('zod/v4')` is `false` -- zod's own `package.json` `exports` map resolves `.` to `./index.cjs` and `./v4` to `./v4/index.cjs`, two distinct module files, so `require()` caches them as two separate module namespace objects.
- **Why this doesn't block the plan:** what actually matters for the repo's two `zod/v4` subpath importers (`lib/core/pitch-feedback-schemas.cjs`, `lib/core/skillopt-schemas.cjs`, both OUT of this plan's `files_modified` list and untouched) is functional interop, not `===` identity of the namespace object. Measured: `a.object === b.object` is `true`, `a.z.object === b.z.object` is `true`, a schema built via one import path is `instanceof` the other's schema class, `.safeParse()` works either way, and `a.toJSONSchema()` correctly serializes a schema built via `b`. Cross-import interop is fully intact; only the "same module instance" framing was imprecise.
- **Action taken:** documented here rather than filed as a bug, since nothing in the repo is broken and no plan acceptance criterion depends on `===` identity (only on the two `zod/v4` files continuing to work, which they do, verified by their own existing test coverage staying green in the suite battery below).
- **Files modified:** none (measurement/documentation only).
- **Commit:** n/a (informational finding, recorded in this SUMMARY per Rule 1's "state the root cause" debugging directive rather than silently carrying the imprecise claim forward).

---

**Total deviations:** 0 auto-fixed; 1 research-claim correction logged (not a plan deviation, no file changed).
**Impact on plan:** None. Every acceptance criterion passed; the corrected finding only affects future readers' confidence in one research sentence, not this plan's own scope or output.

## Issues Encountered
- `npm install zod@^4.2.0` did not save the literal `^4.2.0` range into `package.json` (npm's default `save-prefix`/`save-exact=false` behavior writes `<save-prefix><resolved-version>` when the install argument is already a semver range, not the literal argument text) -- corrected by hand per the plan's explicit "Set package.json ranges to `<ZOD_RANGE>`" instruction, then regenerated both lockfiles from the corrected manifest. Not a plan deviation; the plan's own action text anticipated exactly this need to set the range explicitly.
- `node -p "require('@modelcontextprotocol/sdk/package.json').version"` and `require('zod/package.json').version` under `node -e` sometimes print `undefined` depending on invocation shape (the package's `exports` map behavior), while a plain `fs.readFileSync` + `JSON.parse` always resolves correctly. Used the `fs`-based form for all version-verification checks in this SUMMARY to avoid a false negative; not a plan deviation, just a Node module-resolution quirk worth naming so a later plan doesn't misread a stray `undefined` as an install failure.
- `node scripts/doctor.cjs --acceptance` showed `verify-release-clean-tree` FAIL with a larger tracked-file-drift count than `267-BASELINE.md`'s "1 file(s)" while this plan's own Task 2 files were still uncommitted mid-execution (the check was run once, deliberately, to confirm the acceptance-battery shape before finalizing commits). This is the SAME pre-existing red class as baseline (a peer session's live uncommitted edit to `evals/plurai/211-baseline.json`), just observed at a moment when this plan's own in-flight files added to the count -- resolved once Task 2's two commits landed. Not logged to `deferred-items.md` (same root cause already logged there by 267-01, not a new finding).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dependency half of the migration is shipped and proven on v1: `tests/fixtures/267/zod4-accepted-deltas.json` and `tests/test-267-mcpv2-zod4-contract.cjs` exist for every later plan to extend (267-09 fills `app_views_schema_fix`, 267-10 fills `prompts_fix`) or re-run unchanged.
- `tests/fixtures/267/wire-snapshot-zod4.json` is the new comparison floor for 267-05 and 267-11.
- `evals/plurai/211-baseline.json` (peer-session modification), `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` and `docs/reviews/mindrian-system-atlas.html` (peer-session untracked files) remained present and untouched throughout this plan's execution, consistent with the documented multi-session shared-tree reality; `git status --short` was checked immediately before every commit and only this plan's own explicit paths were ever staged (`git commit --only -- <paths>`), never these peer files.
- No blockers for 267-04 or any later Wave-0/1 plan. Zero registration-code changes (`git diff $PLAN_BASE -- lib bin` is empty), so every later plan's own diff against `lib`/`bin` starts from a clean baseline.

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 4 files created/modified by this plan verified present on disk
(`tests/fixtures/267/zod4-accepted-deltas.json`,
`tests/test-267-mcpv2-zod4-contract.cjs`,
`tests/fixtures/267/wire-snapshot-zod4.json`,
`tests/test-198-contract-schema.test.cjs`), plus this SUMMARY.md. All
three task commits (`17346e558`, `bc761fa7e`, `4bb00c09e`) verified
present in `git log --oneline --all`. No missing items.
