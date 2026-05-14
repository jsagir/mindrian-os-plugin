---
phase: 126
plan: 07
slug: install-state-schema-v2-migration
subsystem: install-lifecycle-harness
tags: [install-state, schema-migration, additive-only, atomic-write, canon-part-6, canon-part-7, canon-part-8, dog-fooding]
canon_parts: [6, 7, 8]
wave: 2
beta_target: v1.13.0-beta.15
hotfix_discipline: true
requires:
  - Phase 123 install-lifecycle-harness (v1.13.0-beta.13) -- ships install-state.json v1
  - lib/core/active-plugin-root.cjs (Phase 123 resolver, used to derive topology)
  - data/deployment-surfaces.json (Phase 123 manifest, unchanged by Plan 07)
provides:
  - lib/core/install-state.cjs (extracted read+write+migrate module)
  - tests/test-install-state-migration.cjs (6-case fixture)
  - schema_version: 2 sentinel + 3 new v2 fields (topology_class, last_acceptance_run, renderer_contract_version)
  - future-version detection + warn-and-defer (CONTEXT.md D3 hard invariant)
  - atomic write semantics (.tmp + fsync + rename; MOS_TEST_FORCE_FAIL=rename hook)
affects:
  - scripts/session-start (new migration block + schema-aware Phase 123 writer)
  - Plan 03 (acceptance-gate self-coverage) -- reads last_acceptance_run from v2
  - Plan 05 (release-flight pre-flight) -- writes last_acceptance_run to v2
  - Plan 01 (--fix renderer contract test) -- may set renderer_contract_version
tech-stack:
  added: []
  patterns:
    - "Atomic write (tmp + fsync + rename) mirrors Phase 95.2's atomic-swap precedent"
    - "MOS_TEST_FORCE_FAIL env-var injection mirrors scripts/doctor.cjs lines ~304-307"
    - "Additive-only migration via Object.assign({}, oldFields, newDefaults)"
    - "Defense-in-depth: migration runs at session-start head; writer-merge runs at session-start middle; both refuse to downgrade"
key-files:
  created:
    - lib/core/install-state.cjs (242 lines; 5 exports + SCHEMA_VERSION constant)
    - tests/test-install-state-migration.cjs (327 lines; 6 sub-tests)
    - .planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md (deferred-items log for the phase)
    - .planning/phases/126-install-lifecycle-harness-gaps/126-07-SUMMARY.md (this file)
  modified:
    - scripts/session-start (+79 -1; new Phase 126 migration block + schema-aware Phase 123 writer merge)
    - tests/run-all-126.sh (+1; CJS_SUITES entry for test-install-state-migration.cjs)
decisions:
  - "schema_version is integer (2), not semver string ('2.0.0') -- per CONTEXT.md D3 Open Question 5 settlement; simpler comparison for additive-only migrations"
  - "Future-version (schema_version > 2) is detected in TWO places: the migrator returns futureVersion:true without touching the file, AND the Phase 123 writer skips its write entirely. Belt-and-suspenders: if the migrator is bypassed (e.g., lib/core missing), the writer still refuses to downgrade"
  - "The migrator does NOT create the file when absent. Creation is session-start's job. The migrator is a transformer of existing state, not a state initializer"
  - "topology_class is derived from topology via a 5-case switch (marketplace-cache + direct + dev-clone -> healthy; not-found -> missing; legacy -> drifted; unknown -> drifted conservative default). dev-clone is healthy by definition (Plan 07 truth-statement matches CONTEXT.md D3 4-state taxonomy)"
  - "Atomic write uses fs.openSync + writeSync + fsyncSync(best-effort) + closeSync + renameSync. fsync is wrapped in try/catch -- some filesystems (e.g., test scratch dirs on certain mounts) do not support fsync, and failing fsync should NOT poison the write path"
  - "Phase 123 writer is made schema-aware additively (NOT replaced). The existing 9 D-04 keys remain byte-identical; the 4 v2 fields (schema_version + topology_class + last_acceptance_run + renderer_contract_version) append. tests/test-install-state-record.cjs Test 2 (9-key invariant) continues to pass"
  - "Stderr passes through (not 2>/dev/null) in the new migration block so users see the migration line AND the future-version deferral. Stdout is suppressed (>/dev/null) so the block does not pollute Claude Code's additionalContext JSON"
metrics:
  duration_seconds: 676
  duration_human: "11m 16s"
  task_count: 3
  files_created: 4
  files_modified: 2
  test_cases_added: 6
  commits: 3
  completed_date: 2026-05-14
---

# Phase 126 Plan 07: install-state.json Schema v2 + Migration Summary

**One-liner:** Extracts inline session-start install-state read/write into `lib/core/install-state.cjs` with additive-only v1->v2 schema migration, atomic-write crash safety, and future-version warn-and-defer detection -- so beta.13 testers (Lawrence, Gary) upgrade transparently to beta.15 without manual `/mos:doctor --fix`.

## What Shipped

Phase 123 (v1.13.0-beta.13) shipped `~/.mindrian/install-state.json` v1 with NO `schema_version` sentinel. Plan 07 evolves the schema to v2 with three new fields needed by sibling Phase 126 plans:

- `schema_version: 2` (integer sentinel for future migrations)
- `topology_class: "healthy" | "missing" | "drifted"` (Plan 03 reads this; classification beyond the bare `topology` string)
- `last_acceptance_run: { timestamp, passed, failed } | null` (Plan 03 + Plan 05 write this on each --acceptance run)
- `renderer_contract_version: string` (Plan 01 sets this; future drift triggers a topology re-classification)

The migration is **additive only**. v1 fields are preserved byte-identical. New fields get defaults. The write is **atomic**: `.tmp` + fsync + rename -- a crash between write and rename leaves the original file untouched. The future-version path (`schema_version > 2`, e.g., a user installed beta.16 then rolled back to beta.15) is **never downgraded silently**: the migrator warns to stderr and defers to `/mos:doctor --fix`.

## The Extracted Module: `lib/core/install-state.cjs` (242 lines)

Five exports + one constant + one underscore-prefixed test helper:

| Export | Type | Purpose |
| --- | --- | --- |
| `SCHEMA_VERSION` | const integer = 2 | The sentinel. Integer not semver string (CONTEXT.md D3 Open Question 5 settlement) |
| `readInstallState({home})` | (opts) -> object \| null | Reads `$HOME/.mindrian/install-state.json`. Never throws. Returns null on absent OR corrupt. Mirrors doctor.cjs class-I's "absent" finding |
| `writeInstallState({home, state})` | (opts) -> void | Atomic write: `.tmp` -> fsync (best-effort) -> rename. Honors `MOS_TEST_FORCE_FAIL=rename` env injection (mirrors scripts/doctor.cjs) so the crash-recovery contract is testable |
| `migrateIfNeeded({home})` | (opts) -> typed result | The 4-path entry point (see migration matrix below) |
| `deriveTopologyClass(topology)` | (string) -> 'healthy'\|'missing'\|'drifted' | 5-case switch derivation (also exported for unit testability) |
| `_statePath` | function | Test-only helper -- resolves `$HOME/.mindrian/install-state.json` for a given home |

Pure Node.js, zero new dependencies. Canon Part 8: LOCAL file I/O only ($HOME/.mindrian/). Zero network. Zero Brain queries.

## The 4 Migration Paths

| State on disk | `migrateIfNeeded` returns | File touched? |
| --- | --- | --- |
| Absent | `{migrated: false, fileAbsent: true}` | NO -- the migrator is a transformer, not an initializer. Creation is session-start's job |
| Present, no `schema_version` (v1) | `{migrated: true, fromVersion: 1, toVersion: 2}` | YES -- additive merge with defaults, atomic write back |
| Present, `schema_version === 2` | `{migrated: false, currentVersion: 2}` | NO -- already current, byte-identical |
| Present, `schema_version > 2` (future) | `{migrated: false, futureVersion: true, currentVersion: N, advice: 'run /mos:doctor --fix'}` + stderr warn `[install-state] schema_version N is newer than the plugin understands (2). Skipping migration; run /mos:doctor --fix.` | NO -- never downgrade silently |

## topology_class Derivation (5-case switch)

Per CONTEXT.md D3 + Plan 03 needs:

| topology (v1 field) | topology_class (v2 derived) | Why |
| --- | --- | --- |
| `marketplace-cache` | `healthy` | Standard Claude Code install path |
| `direct` | `healthy` | npx round-trip install (`@mindrian_os/install`) |
| `dev-clone` | `healthy` | Developer machine; clone with origin remote |
| `not-found` | `missing` | Resolver returned null root |
| `legacy` | `drifted` | Legacy hand-clone (pre-Phase 123) |
| `<anything else>` | `drifted` | Conservative default for new topologies |

## Session-start Integration: Belt-and-Suspenders

The migration is wired at TWO defense layers in `scripts/session-start`:

**Layer 1: Migration block (BEFORE the Phase 123 writer).** A new BEGIN/END Phase 126 Plan 07 block sits between line-104 `LAST_VERSION_FILE` read and line-107 Phase 123 `BEGIN install-state record` marker. It invokes `migrateIfNeeded({home: HOME})` via a node -e shim. Stderr passes through; stdout is suppressed. Errors are caught + logged but never crash session-start.

**Layer 2: Schema-aware Phase 123 writer.** The Phase 123 record-write block (lines 248-263 in the current session-start) derives a fresh `rec` from scratch on every session (active-plugin-root resolution + manifest walk + installed_plugins.json read). Without modification, this would clobber the v2 fields the migrator just added. The writer is made schema-aware additively:

- Reads the existing `$HOME/.mindrian/install-state.json` before writing.
- If `schema_version > 2`: SKIPS the write entirely (the LAST_VERSION_FILE rewrite still runs unconditionally).
- Otherwise: merges `schema_version` + `topology_class` + `last_acceptance_run` + `renderer_contract_version` from the existing file onto the new `rec` before writing. Defaults applied as defense-in-depth.

The Phase 123 9 D-04 keys remain byte-identical; the 4 v2 fields append. `tests/test-install-state-record.cjs` Test 2 (9-key invariant) continues to pass.

## Live Smoke Test (Task 3 Acceptance)

Per Plan 07 Task 3 acceptance criteria. Smoke test script staged at `/tmp/test-126-07-smoke.sh`. Both tests verified GREEN:

**Test A (v1 -> v2 transparent migration):**
- BEFORE: minimal v1 file `{active_version, active_root, topology, installed_at}` -- no schema_version.
- AFTER: file contains `schema_version: 2`, `topology_class: "healthy"`, `last_acceptance_run: null`, `renderer_contract_version: "unknown"`. All 9 Phase 123 D-04 keys also present (session-start's writer re-derived them, Pitfall 7 fix preserved).
- Stderr: `[session-start] install-state migrated v1 -> v2`.

**Test B (future-version untouched + stderr):**
- BEFORE: future file with `schema_version: 99` + `future_only_field: "hello-from-the-future"`.
- AFTER: byte-identical (sha256 hash match). The future_only_field is preserved. The Phase 123 writer skipped its write entirely (the LAST_VERSION_FILE rewrite still ran, which is correct -- it's an independent surface).
- Stderr: BOTH `[install-state] schema_version 99 is newer than the plugin understands (2). Skipping migration; run /mos:doctor --fix.` AND `[session-start] install-state future-version detected (schema_version=99); deferring to /mos:doctor --fix`.

## Test Stack (After This Plan; All GREEN)

| Test file | Plan | Result |
| --- | --- | --- |
| `tests/test-install-state-migration.cjs` (NEW, 6 sub-tests) | 126-07 Task 1 | 6/6 GREEN |
| `tests/test-install-state-record.cjs` (Phase 123) | 123-02 | 6/6 GREEN (no regression) |
| `tests/test-doctor-class-i.cjs` (Phase 123) | 123-03 | 11/11 GREEN (no regression) |
| `tests/test-doctor-class-j.cjs` (Phase 123) | 123-03 | 8/8 GREEN (no regression) |
| `tests/run-all-126.sh` aggregator | 126 (all plans) | 4/4 GREEN |

## The 6 Sub-Tests (Task 1 Fixture Contract)

| # | Path | Asserts |
| --- | --- | --- |
| 1 | no-file | migrateIfNeeded is a no-op; returns `{migrated:false, fileAbsent:true}`; does NOT create the file; readInstallState returns null |
| 2 | v1 -> v2 additive | schema_version: 2 added; v1 fields preserved byte-identical (deep-equal on the v1 subset); new v2 fields with correct defaults; no .tmp left dangling; return `{migrated:true, fromVersion:1, toVersion:2}` |
| 3 | v2 current | File byte-identical (mtime + sha256 hash); return `{migrated:false, currentVersion:2}` |
| 4 | future-version | File byte-identical; return `{migrated:false, futureVersion:true, currentVersion:3, advice:'run /mos:doctor --fix'}`; stderr emits `[install-state]` prefixed line |
| 5 | atomic crash | `MOS_TEST_FORCE_FAIL=rename` injection throws; original v1 file UNCHANGED (sha256 match); no partial migration |
| 6 | topology_class derivation (5 cases) | marketplace-cache + direct + dev-clone -> healthy; not-found -> missing; legacy -> drifted |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 123 writer wiping the migration's output**
- **Found during:** Task 3 live smoke test (Test A) -- the v1 file was successfully migrated to v2 by the new Plan 07 block, but the subsequent Phase 123 record-write block then derived a fresh record from scratch and WROTE OVER it, dropping the schema_version + topology_class + last_acceptance_run + renderer_contract_version fields.
- **Issue:** The Phase 123 writer (lines 248-263 in session-start) does not read the existing install-state.json before writing -- it always derives a fresh record. Without modification, the Plan 07 migration was downstream-meaningless within a single session: the migrator added the v2 fields, the Phase 123 writer immediately removed them.
- **Fix:** Made the Phase 123 writer schema-aware additively. Before the `fs.writeFileSync` call, the block now: (a) reads the existing file; (b) if `schema_version > 2`, skips the write entirely (the LAST_VERSION_FILE rewrite still runs); (c) otherwise, merges schema_version + topology_class + last_acceptance_run + renderer_contract_version from the existing file onto the new `rec` (with defaults as defense-in-depth). All 9 Phase 123 D-04 keys remain byte-identical; the 4 v2 fields append.
- **Files modified:** scripts/session-start (the Phase 123 writer block; same commit as Task 3 since both changes are part of the session-start integration)
- **Commit:** b98dc97

**2. [Rule 1 - Bug] Initial migration block swallowed stderr**
- **Found during:** Task 3 live smoke test (Test B) -- the future-version deferral message was suppressed because the initial migration block redirected `2>/dev/null`.
- **Issue:** The Plan 07 contract requires the future-version warn to surface to user-visible stderr (acceptance criterion: "verify the file is UNCHANGED + stderr emitted the deferral message"). The initial `2>/dev/null || true` idiom matched the surrounding Phase 123 block's pattern, but the Phase 123 block has no warns to surface (its node -e is pure writer code); Plan 07's block does.
- **Fix:** Changed `2>/dev/null` to `>/dev/null` (suppress stdout to not pollute additionalContext JSON; pass stderr through so users see the migration / future-version lines).
- **Files modified:** scripts/session-start (same commit as Fix 1)
- **Commit:** b98dc97

### Deferred Issues (Out of Scope, Logged)

**1. tests/test-doctor-acceptance.cjs Test acc.5 (release.sh Step 9 / Step 9.6 ordering)** -- Pre-existing failure, verified by `git stash` + re-run before any Plan 07 commit. Not in Plan 07's scope (release.sh ordering belongs to Plan 04). Logged to `.planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md` for routing to Plan 04 owner.

## Forward References

- **Plan 03 (acceptance-gate self-coverage):** writes `last_acceptance_run: { timestamp, passed, failed }` to the v2 install-state.json after each `--acceptance` run; reads it to detect stale gates.
- **Plan 04 (release pipeline hardening):** may set `renderer_contract_version` during release-time verification (Plan 01 fixes the renderer; Plan 04 records the contract version).
- **Plan 05 (release-flight pre-flight in --acceptance):** consumes `last_acceptance_run` to skip pre-flight checks that ran recently.
- **Plan 01 (--fix renderer contract test + fix):** the source of truth for `renderer_contract_version`'s value.

## Canon Provenance

- **Part 6 (dog-fooding mandate):** schema evolution surfaces only via shipped harness -- v1 was shipped in v1.13.0-beta.13; v2 ships in v1.13.0-beta.15. The migration is dog-fooded on the maintainer's own box (`~/.mindrian/install-state.json` lives there as the test substrate).
- **Part 7 (reuse-before-build):** Plan 07 EXTRACTS the inline session-start read/write into a module; does NOT re-architect the write path. The Phase 123 writer is extended additively, not replaced. ~90% of the integration is wiring; the only net-new is the `migrateIfNeeded` function and the 6-case fixture.
- **Part 8 (graph boundary / security):** LOCAL file I/O only. The module reads and writes `$HOME/.mindrian/install-state.json`; zero network calls; zero Brain queries. Verified by `tests/test-install-state-record.cjs` Test 4's BEGIN/END span grep against `fetch|http|curl|brain.mindrian|tavily` (6/6 GREEN).

## Self-Check: PASSED

- lib/core/install-state.cjs: FOUND
- tests/test-install-state-migration.cjs: FOUND
- scripts/session-start: MODIFIED (3 install-state.cjs references; bash -n exits 0)
- tests/run-all-126.sh: MODIFIED (CJS_SUITES entry added)
- .planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md: FOUND
- Commit 2bdedd6 (Task 1 RED): FOUND in git log
- Commit 0465457 (Task 2 GREEN): FOUND in git log
- Commit b98dc97 (Task 3 session-start wire): FOUND in git log

## Known Stubs

None. Zero stubs in lib/core/install-state.cjs, tests/test-install-state-migration.cjs, or scripts/session-start (verified via grep for TODO|FIXME|placeholder|coming soon|not available -- all 0 hits).
