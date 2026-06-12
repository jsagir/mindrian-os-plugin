---
phase: quick-260612-cl7
plan: 01
subsystem: install-lifecycle
tags: [doctor, install-cache, marketplace-cache, update-checker, rca-fix]
requires: []
provides:
  - "Topology-aware checkInstallVersion (active-root read even when the legacy dir is present)"
  - "report.recoverySkipped state + skipped-render branch + skipped-by-design exit-0 semantics"
  - "check-version-and-sha.cjs LATEST resolution from the mindrian-marketplace catalog pin"
affects: [scripts/doctor.cjs, scripts/check-version-and-sha.cjs, /mos:update, post-update activation]
tech-stack:
  added: []
  patterns:
    - "Detector and gate must consult the SAME source of truth (resolver topology, not a path constant)"
    - "Skipped-by-design carries its own state field, render branch, and exit semantics"
    - "LATEST resolves from the published artifact (catalog pin), never main HEAD's placeholder"
key-files:
  created:
    - tests/test-doctor-class-a-vestigial-legacy.cjs
    - tests/test-check-version-latest-resolution.cjs
  modified:
    - scripts/doctor.cjs
    - scripts/check-version-and-sha.cjs
    - scripts/test-doctor-recovery.cjs
decisions:
  - "Catalog URL rides the branch-agnostic HEAD ref: the marketplace repo's default branch is master, not main (the plan's /main/ URL 404s live)"
  - "recoverySkipped only ever set under --fix, so read-only drift keeps exiting 1 (monitoring signal preserved, threat T-q260612-03 mitigation)"
  - "post-update-activation.cjs unchanged: doctor exit 0 + install.version === stagingVersion hits its existing 'already on latest' branch"
metrics:
  duration: "22 minutes"
  completed: "2026-06-12"
  tasks: 2
  commits: 5
---

# Quick Task 260612-cl7: Fix Doctor Marketplace-Cache Drift Deadlock Summary

Doctor's drift detector now reads the SAME active-root source of truth as its recovery gate, skipped-by-design recovery renders its reason and exits 0, and the update checker resolves LATEST from the marketplace catalog pin instead of main's never-released placeholder.

## What Was Done

### Task 1: Break the drift/recovery contradiction and the unknown-render (RCA P0a + P0b)

- **checkInstallVersion() topology-aware regardless of legacy-dir presence** (scripts/doctor.cjs): the marketplace-cache active-root read is hoisted ABOVE the legacy `INSTALL_DIR` read. On the RCA box (vestigial legacy dir at 1.13.0-beta.30 + cache at 1.13.1-beta.16) doctor now reports the active root's version, drift compare is 0, and the contradiction never forms. Adds informational `legacyDirPresent` boolean (feeds the deferred P1 class I reap). Any throw or non-marketplace-cache topology falls through to the existing legacy logic untouched.
- **Recovery-skip state recorded** (P0a defense + P0b): the class A recovery gate resolves `resolveActivePluginRoot()` ONCE; when marketplace-cache topology is what blocked recovery, `report.recoverySkipped = { reason: 'topology-marketplace-cache', detail }` is set instead of a silent fall-through. `recoverySkipped: null` initialized in the report literal (stable JSON shape).
- **Renderer three-way branch** (P0b): `recovery failed: <error>` (real failures only, no `|| 'unknown'` fallback) / `recovery skipped (topology marketplace-cache -- legacy install dir is vestigial)` (yellow glyph) / `recovery not attempted (gated)` (dim). The literal `recovery failed: unknown` is unreachable.
- **Exit semantics**: `_finalizeAndExit` suppresses the drift exit-1 when `recoverySkipped` is set (exit 0). Only ever set under `--fix`, so read-only drift keeps exiting 1; legacy exit codes 0/1/2/3/4 untouched. Exit-code contract comment extended.
- **New hermetic fence** `tests/test-doctor-class-a-vestigial-legacy.cjs` (5/5): v.1 coexistence exit 0 + active-root version; v.2 `--fix` exit 0 with null classARecovered/recoveryError + no unknown render; v.3 `--fix --post-update` activation succeeds; v.4 genuine drift under marketplace-cache -> recoverySkipped + exit 0 + skipped render, read-only exit 1 preserved; v.5 legacy-topology drift + atomic recovery byte-identical.

Commits: `5ee55987` (RED), `44625a2f` (GREEN).

### Task 2: Resolve LATEST from the marketplace catalog pin (RCA P2)

- **`resolveLatestFromCatalog(catalog)`**: pure, shape-validated pin reader (`plugins[]` entry name `mos` -> `.version`; anything malformed -> null, never a crash or unvalidated string in the shell-parsed output -- threat T-q260612-01 mitigation).
- **`fetchLatestVersion(deps)` resolution chain**: PRIMARY the mindrian-marketplace catalog pin (`{version, source: 'marketplace-catalog'}`); FALLBACK main plugin.json (`source: 'main-plugin-json-degraded'`, disclosed in REASON: " (degraded: resolved from main plugin.json placeholder, marketplace catalog unreachable)"); both-fail rejection preserves `STATUS=NETWORK_ERROR` exit 1. `deps.fetchJson` injection for hermetic unit tests. Generic `fetchJson(url)` helper factored from the old implementation (same User-Agent).
- **`require.main === module` guard + `module.exports = { resolveLatestFromCatalog, fetchLatestVersion, compareSemver }`** -- CLI behavior unchanged, module requirable without side effects.
- **Output protocol unchanged**: STATUS / LOCAL_VERSION / LATEST_VERSION / LOCAL_SHA / REMOTE_TAG_SHA / REASON keys and exit codes 0/1/2 byte-compatible for /mos:update.
- **New hermetic fence** `tests/test-check-version-latest-resolution.cjs` (5/5, zero network): pin parsing, malformed-shape nulls, fallback ordering with stub call-order/count assertions, offline rejection, require.main guard.
- **Live smoke evidence**: `node scripts/check-version-and-sha.cjs` now reports `LATEST_VERSION=1.13.1-beta.16` (the catalog pin) instead of the `1.13.1-beta.17` never-released placeholder -- the exact live bug from the RCA timeline.

Commits: `3068a8a3` (RED), `88603282` (GREEN).

### RCA resolution (plan output spec)

- `.planning/debug/doctor-marketplace-cache-drift-deadlock.md` moved to `.planning/debug/resolved/` with a resolution block; knowledge-base entry added (8th install-cache family case; detector-vs-gate source-of-truth split pattern). Commit: `89042d5a`.

## Verification Evidence

| Gate | Result |
|------|--------|
| tests/test-doctor-class-a-vestigial-legacy.cjs | 5/5 PASS |
| tests/test-check-version-latest-resolution.cjs | 5/5 PASS |
| tests/test-doctor-class-a-topology-drift.cjs | 4/4 PASS |
| tests/test-doctor-fix-renderer.cjs | 7/7 PASS |
| tests/test-doctor-class-i.cjs | 11/11 PASS |
| tests/test-doctor-class-j.cjs | 8/8 PASS |
| scripts/test-doctor-recovery.cjs | 17/17 PASS (was 8/15 pre-existing FAIL on unmodified main; see deviations) |
| tests/test-doctor-atomic-swap.cjs | 9/9 PASS |
| tests/test-doctor-plugin-disabled-state.cjs | 10/10 PASS |
| Grep gate: render line has no `\|\| 'unknown'` fallback | PASS (line 3364 renders `recovery failed: ${report.recoveryError}` only) |
| Export surface: `resolveLatestFromCatalog({plugins:[{name:'mos',version:'9.9.9'}]})` === '9.9.9' | PASS |
| No emojis on changed lines (repo glyph vocabulary only: yellow ⚠ on the skipped line) | PASS |
| Live smoke: LATEST resolves to catalog pin 1.13.1-beta.16 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Marketplace catalog URL: the repo's default branch is `master`, not `main`**
- **Found during:** Task 2 live smoke
- **Issue:** The plan's verified-fact-6 URL (`.../mindrian-marketplace/main/.claude-plugin/marketplace.json`) returns 404 live; the repo's default branch is `master`. The checker silently took the degraded fallback on every run.
- **Fix:** `CATALOG_URL` rides the branch-agnostic `HEAD` ref (follows the default branch, survives a future rename; verified 200 live with the `mos@1.13.1-beta.16` pin). Unit-test URL regex asserts repo + file identity, not ref spelling.
- **Files modified:** scripts/check-version-and-sha.cjs, tests/test-check-version-latest-resolution.cjs
- **Commit:** 88603282

**2. [Rule 3 - Blocking] scripts/test-doctor-recovery.cjs was a stale fence failing on unmodified main**
- **Found during:** Task 1 verification gate
- **Issue:** 7 failures on UNMODIFIED main (verified by stash round-trip): (a) the fixture builds a legacy dir + populated scratch cache with no installed_plugins.json and no topology pin, so since the 2026-05-31 topology guard the resolver classifies it marketplace-cache and recovery is gated off; (b) assertions read the pre-Phase-95.2 report shape (`report.recovered.recoveredVersion` on what is now an array; truthiness check on the always-present array).
- **Fix:** Pinned `MINDRIAN_OS_ROOT` at the scratch legacy path (the exact tests/test-doctor-atomic-swap.cjs idiom) + updated assertions to `classARecovered` / empty-array contracts. Now 17/17.
- **Files modified:** scripts/test-doctor-recovery.cjs
- **Commit:** 44625a2f

**3. [Rule 1 - Test fix] v.2 bare-'unknown' assertion scoped to recovery lines**
- **Found during:** Task 1 GREEN run
- **Issue:** The unrelated pre-existing `plugin-enabled-state` row legitimately renders "treated as enabled (unknown, not an error)" on hermetic fixtures, false-tripping the plan's whole-output bare-word check. That render is out of this RCA's scope.
- **Fix:** v.2 asserts no 'recovery failed' anywhere AND no 'unknown' on any recovery-related line (the RCA's actual dead string).
- **Files modified:** tests/test-doctor-class-a-vestigial-legacy.cjs
- **Commit:** 44625a2f

## Deferred Items (recorded per plan success criteria; NOT implemented here)

1. **P1 class I reap**: detect + archive the vestigial `~/.claude/plugins/mindrian-os/` dir under marketplace-cache topology; GC `mindrian-os.stale-*` / `*.downgrade-attempt-*` backups older than N days.
2. **P1 single-source-of-version-truth named check**: doctor asserts cross-source equality (statusline / legacy plugin.json / registry) and names the discrepancy.
3. **Part 6 dogfood-acceptance ACPT leg** for the legacy-dir + marketplace-cache coexistence fixture (the harness did not catch this deadlock class).
4. **P2(b) SHA-path inertness**: LOCAL_SHA/REMOTE_TAG_SHA both 'unknown' on the RCA box -- investigation item. (Note: the live smoke on this dev box now resolves REMOTE_TAG_SHA via the catalog-pinned version's tag; LOCAL_SHA inertness on user boxes remains uninvestigated.)

## Known Stubs

None -- no placeholder values or unwired data paths introduced.

## Threat Flags

None -- no new network endpoints, auth paths, or trust-boundary surface beyond the plan's threat model (the catalog fetch replaces ref spelling only; same github.com infrastructure, T-q260612-02 accepted disposition unchanged).

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 5ee55987 | test | failing fixture for the marketplace-cache drift deadlock (RED) |
| 44625a2f | fix | break the deadlock: topology-aware checkInstallVersion + recoverySkipped + render/exit semantics + recovery-fence repair (GREEN) |
| 3068a8a3 | test | failing unit test for marketplace-catalog LATEST resolution (RED) |
| 88603282 | fix | LATEST from the catalog pin (HEAD ref) + degraded fallback + require.main guard (GREEN) |
| 89042d5a | docs | RCA moved to resolved/ + knowledge-base entry |

## TDD Gate Compliance

Both tasks followed RED -> GREEN: `test(...)` commits 5ee55987 / 3068a8a3 landed failing suites first (Task 1: 4 of 5 failed, v.5 was the honest legacy baseline; Task 2: 5 of 5 failed), `fix(...)` commits 44625a2f / 88603282 flipped them green. No REFACTOR commits needed.

## Self-Check: PASSED

- tests/test-doctor-class-a-vestigial-legacy.cjs: FOUND
- tests/test-check-version-latest-resolution.cjs: FOUND
- .planning/debug/resolved/doctor-marketplace-cache-drift-deadlock.md: FOUND
- Commits 5ee55987, 44625a2f, 3068a8a3, 88603282, 89042d5a: FOUND in git log
