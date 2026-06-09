# Phase 148 - Deferred / Out-of-Scope Items

Items discovered during execution that are OUT OF SCOPE for the current plan
(SCOPE BOUNDARY rule: only auto-fix issues directly caused by the current
task's changes). Logged, not fixed.

## DI-148-01 - test-capability-dial-committed.cjs version pin is stale (pre-existing)

- **Discovered during:** Phase 148 Plan 01 (D-09 reach-count lockstep), running tests/run-all-141.sh.
- **Failure:** `LARRY-02: CHANGELOG top entry must name version 1.13.1-beta.7`.
- **Root cause:** tests/test-capability-dial-committed.cjs hardcodes
  `const VERSION = '1.13.1-beta.7'` (line 23) and asserts CHANGELOG.md top
  entry + plugin.json + package.json all read that exact version. The repo has
  since advanced to 1.13.1-beta.11 (plugin.json), so the pin no longer matches.
- **Relation to Phase 148:** NONE. This is a version/CHANGELOG pin from Phase
  141; it carries zero reach-count assertions (verified: no REACH_IDS / reach_id
  / DIAL_REACH_K / frozen-5 references in the file). My D-09 migration did not
  touch CHANGELOG, plugin.json, or package.json.
- **Disposition:** Deferred. A version-pinning test should track the release
  pipeline (the Phase 123 release.sh lockstep), not be hand-bumped per phase;
  out of scope for the reach-count lockstep.
