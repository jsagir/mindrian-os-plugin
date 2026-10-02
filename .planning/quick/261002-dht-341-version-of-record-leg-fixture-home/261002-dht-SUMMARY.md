---
quick_id: 261002-dht
status: complete
date: 2026-10-02
commits: [713ec08bf]
navigator_ruling: 2026-10-02 fixture-home approach for the 341 version-of-record leg
doctor_modules_changed: false
---

# Quick 261002-dht: 341 version-of-record leg runs doctor pre-tag against a fixture home

## Root cause (from 261002-r41, confirmed)

Arm 0 of `tests/test-341-version-of-record-source-version.cjs` ran
`doctor --acceptance --pre-tag` with the inherited env. Three pre-tag points read the install
under `$HOME`, so under `HOME=$(mktemp -d)` they failed on an empty home: install-state
(record absent), session-start-active-version (installed_plugins.json absent),
deployment-surfaces (3/6 surfaces missing). The failure was about the harness, not the code.

## How the three points resolve paths

All three honor HOME (os.homedir() on POSIX), so no doctor module needed a change:
- install-state: `<home>/.mindrian/install-state.json`, the 6-way version-of-record
  (installed_plugins.json, record, `.mindrian-last-version`, record `path_bin_version`),
  root via `lib/core/active-plugin-root.cjs`, `<root>/bin` presence.
- session-start-active-version: installed_plugins.json version vs the resolved root's
  `.claude-plugin/plugin.json` version.
- deployment-surfaces: `data/deployment-surfaces.json` with `$HOME` and `<active_root>`
  expanded (statusline shim marker, settings.json statusLine.command, `.mindrian-last-version`).

## Fix (713ec08bf, tests/ only)

- `makeFixtureHome(version)`: a marketplace-cache layout whose version dir is a symlink to this
  checkout (at its plugin.json version), installed_plugins.json, the install-state record, and
  the owned deployment surfaces. Shapes mirror the inline helpers of
  `tests/test-doctor-acceptance.cjs` (not exported there, so mirrored, not imported).
- Arm 0 runs the REAL doctor (DOCTOR_TEST_MODE and DOCTOR_TEST_FAIL_POINT stripped,
  MINDRIAN_OS_ROOT / CLAUDE_DESKTOP / COWORK_SESSION_ID cleared, surface CLI) with HOME set
  to the fixture; asserts the three home points are ok and exit 0.
- Arm 0b (negative): installed_plugins.json says `0.0.0-fixture-wrong`; asserts
  session-start-active-version is ok:false with the exact finding
  "plugin.json says <ver> but installed_plugins.json says 0.0.0-fixture-wrong" and a
  non-zero doctor exit.
- Why a symlinked marketplace cache rather than installPath = the checkout: pointing straight
  at the checkout classifies the topology as dev-clone (origin + install.sh), which drags in
  the dev-clone pre-commit hook surface and makes the leg depend on a local git hook. The
  symlink keeps the real install shape while still resolving to this checkout's plugin.json
  and bin/.

## Verification

- `HOME=$(mktemp -d) node tests/test-341-version-of-record-source-version.cjs`: 9/9 (Arm 0,
  Arm 0b, Arms 1-6).
- `HOME=$(mktemp -d) bash tests/run-all-341.sh`:
  - before: PASS=21 FAIL=1 SKIP=6 EXPECTED-RED=0 (version-of-record-source-version FAILED)
  - after:  PASS=22 FAIL=0 SKIP=6 EXPECTED-RED=0, exit 0
- Note: run while the test edit was uncommitted, the nested 310 leg 9 (scoped working-tree
  diff) fails on the dirty file; after the commit it SKIPs as designed.

## STATE row (for the orchestrator; not written here)

| 261002-dht | 341 version-of-record leg: doctor --acceptance --pre-tag runs against a fixture home (symlinked marketplace-cache at the checkout version) + wrong-version negative; run-all-341 21/1 -> 22/0 | 2026-10-02 | 713ec08bf | [261002-dht-341-version-of-record-leg-fixture-home](./quick/261002-dht-341-version-of-record-leg-fixture-home/) |
