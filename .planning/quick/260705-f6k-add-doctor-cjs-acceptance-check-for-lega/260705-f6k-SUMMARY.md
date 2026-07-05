---
phase: quick-260705-f6k
plan: 01
subsystem: doctor / install-state (Class I)
tags: [doctor, install-state, F11, acceptance-gate, windows]
requires:
  - scripts/doctor.cjs Class I (checkInstallState + performClassIFix)
  - readInstalledPluginsVersion (reused, not reimplemented)
provides:
  - Class I finding legacy-config-pin-drift
  - performClassIFix legacy-config-json reconcile branch (backup + version stamp)
  - tests/test-doctor-legacy-config-pin-drift.cjs
affects:
  - doctor --install-state
  - doctor --acceptance (install-state point rides the new finding)
tech-stack:
  added: none
  patterns:
    - backup-before-write to ~/.mindrian/backups/<name>.<ISO>.bak
    - STRING (not semver) version inequality, matching the 6-way version-of-record
    - class-flag-always-exit-0 graceful degradation preserved
key-files:
  created:
    - tests/test-doctor-legacy-config-pin-drift.cjs
  modified:
    - scripts/doctor.cjs
    - .planning/debug/windows-install-update-ux.md
decisions:
  - Reused readInstalledPluginsVersion for the live modern-version resolve (no reimplementation)
  - Conservative repair - only the mos.version field is mutated; enabled/installedAt untouched
  - No new acceptance point needed - the install-state healthy gate already carries the finding
metrics:
  duration: ~12m
  completed: 2026-07-05
  tasks: 3
  files: 3
---

# Phase quick-260705-f6k Plan 01: doctor Legacy-Config-Pin-Drift Check Summary

doctor now detects and --fixes the F11 recurrence class: a stale `mos.version` pin in the legacy `~/.claude/plugins/config.json` that disagrees with the modern `installed_plugins.json`, a drift that has poisoned command registration twice on the same Windows machine.

## What Was Built

1. **`readLegacyConfigPin(home)` helper** (scripts/doctor.cjs, next to `readInstalledPluginsVersion`). Reads the legacy `plugins/config.json`, resolves the mos pin via top-level `mos` -> `mindrian-os` -> a defensive `plugins`-wrapped fallback, and returns `{ version, key }` or `null`. The whole body is try/catch-wrapped: an absent or malformed legacy artifact degrades to `null` (the healthy fresh-install state), never an error.

2. **`legacy-config-pin-drift` finding** in `checkInstallState` (step 3b, after the record spot-check). Pushed only when the legacy pin is non-null AND the modern version is not `'unknown'` AND they differ (STRING inequality). Carries `legacyVersion`, `modernVersion`, `legacyKey` for the fix branch. Because the acceptance `install-state` point passes only on `status === 'healthy'`, the finding automatically rides `doctor --acceptance` with no new acceptance point.

3. **`performClassIFix` reconcile branch** for `f.id === 'legacy-config-pin-drift'`. Backs up config.json FIRST to `~/.mindrian/backups/config.json.<ISO>.bak`, re-reads the modern version LIVE (does not trust the stale finding payload; skips if `'unknown'`), re-resolves the pin key defensively, sets only `version`, and writes back. Every path is best-effort and pushes a recovery entry; nothing throws out of the fix loop.

4. **4-scenario test** (tests/test-doctor-legacy-config-pin-drift.cjs): agree / disagree+fix / config.json absent / installed_plugins.json absent, plus a source-grep guard that catches a silent revert of the doctor.cjs implementation. Asserts ONLY on the `legacy-config-pin-drift` id (the sandbox legitimately emits other findings), verifies the config.json rewrite is conservative (enabled/installedAt untouched), the `config.json.*.bak` backup exists, and the fix is convergent on re-run.

5. **F11 FIXED note** appended to `.planning/debug/windows-install-update-ux.md` (existing history untouched; items (b) and F8 explicitly left open).

## Verification

- `node tests/test-doctor-legacy-config-pin-drift.cjs` -> all 5 pass (guard + 4 scenarios).
- `node tests/test-doctor-class-i.cjs` -> all 11 pass (no regression).
- `node tests/test-doctor-acceptance-self-coverage.cjs` -> 6 passed, 0 failed (skip path stays green on legacy-free fixtures).
- `node scripts/doctor.cjs --install-state --json` -> exit 0 on this WSL machine (no legacy config.json present).
- No em-dashes anywhere (code, test, doc note, commit messages).

## Threat Model Coverage

- **T-f6k-01 (Tampering):** mitigated - backup-before-write; only the `version` field of the matched key is mutated; write happens only under explicit `--fix`.
- **T-f6k-02 (DoS):** mitigated - all reads try/catch to `null`/`'unknown'`; malformed config.json degrades to a skip, never throws or breaks the class-flag exit-0 invariant.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `d4af0519` feat(quick-260705-f6k): add legacy-config-pin-drift finding + --fix to doctor Class I
- `e2a3eda7` test(quick-260705-f6k): 4-scenario coverage for legacy-config-pin-drift
- `f2b348b8` fix(doctor): detect + fix legacy config.json vs installed_plugins.json version-pin drift (F11)

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/doctor.cjs
- FOUND: tests/test-doctor-legacy-config-pin-drift.cjs
- FOUND commit: d4af0519
- FOUND commit: e2a3eda7
- FOUND commit: f2b348b8
