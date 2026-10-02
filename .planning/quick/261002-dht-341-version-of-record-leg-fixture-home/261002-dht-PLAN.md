---
quick_id: 261002-dht
mode: quick --validate
date: 2026-10-02
navigator_ruling: 2026-10-02 fixture-home approach for the 341 version-of-record leg
files_modified:
  - tests/test-341-version-of-record-source-version.cjs
---

# Quick 261002-dht: run the 341 version-of-record leg's doctor pre-tag against a fixture home

## Problem (root cause from quick 261002-r41)

Arm 0 of `tests/test-341-version-of-record-source-version.cjs` spawns
`doctor --acceptance --pre-tag` with the inherited env. Under `HOME=$(mktemp -d)`, three
pre-tag points read the real install under `$HOME` and fail: install-state (record absent),
session-start-active-version (no installed_plugins.json), deployment-surfaces (3/6 paths
missing). Real HOME gives 19/19.

## How each point resolves its paths (read before the fix)

- install-state (`lib/core/doctor/install-state-module.cjs::checkInstallState`): reads
  `<home>/.mindrian/install-state.json`; spot-checks `active_version` against
  `<home>/.claude/plugins/installed_plugins.json`; resolves the root via
  `lib/core/active-plugin-root.cjs` (os.homedir(), so HOME; MINDRIAN_OS_ROOT wins if set);
  6-way version-of-record over IP/AV/SR/LV/PB (`<home>/.mindrian-last-version`, record
  `path_bin_version` else a live PATH probe); flags `<root>/bin` missing.
- session-start-active-version (doctor.cjs): reads installed_plugins.json, then compares the
  resolved root's `.claude-plugin/plugin.json` version to the recorded version.
- deployment-surfaces (`deployment-surfaces-module.cjs`): walks `data/deployment-surfaces.json`,
  expands `$HOME` and `<active_root>`; checks `<home>/.claude/statusline-mos` (marker),
  `<home>/.claude/settings.json` statusLine.command, `<home>/.mindrian-last-version`
  (= active version). Dev-clone hook only on topology dev-clone. Surface via
  MINDRIAN_STATUSLINE_SURFACE.

All three honor HOME. No doctor module change needed.

## Task 1: fixture home + negative case

- Build a fixture home in the test: a marketplace-cache layout
  `<home>/.claude/plugins/cache/mindrian-marketplace/mos/<ver>` symlinked to this checkout,
  installed_plugins.json pointing at it with `<ver>` = plugin.json version, the install-state
  record, `.mindrian-last-version`, the statusline shim with its marker, and settings.json
  statusLine.command. Helper shapes mirror tests/test-doctor-acceptance.cjs.
- Arm 0 spawns the real doctor (no DOCTOR_TEST_MODE) with HOME/USERPROFILE set to it,
  MINDRIAN_OS_ROOT/CLAUDE_DESKTOP/COWORK_SESSION_ID cleared, surface CLI; asserts exit 0 and
  the three points ok in --json.
- Arm 0b (negative): same fixture but installed_plugins.json carries a wrong version; asserts
  session-start-active-version is ok:false with the "plugin.json says ... but
  installed_plugins.json says ..." finding, and doctor exits non-zero.

verify: `HOME=$(mktemp -d) node tests/test-341-version-of-record-source-version.cjs` and
`HOME=$(mktemp -d) bash tests/run-all-341.sh`.
done: Arm 0 + Arm 0b pass under a temp HOME; run-all-341 FAIL drops by one.
