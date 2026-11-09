# Quick 261109-w4c Summary

Root cause (PROVEN): after the beta.83 cut, the latest released section is [2.0.0-beta.83] with no
face panel line, and [Unreleased] had none. W4 of tests/test-380-gate-wiring.cjs reads only
[Unreleased] and the section right below it, so it failed 5 of 6 assertions.

Fix: one bullet added at the end of "### Added" in [Unreleased] of CHANGELOG.md, with the same
wording as the beta.81 bullet. No released section touched. No version, no count, no em or en dash.

Verification:
- RED: node tests/test-380-gate-wiring.cjs, W4: 5 FAIL, 1 PASS.
- GREEN: same test, W4: 6 PASS.
- bash tests/run-all-380.sh: PASSED=17 FAILED=2 SKIPPED=1. "380 gate wiring" PASSED. The 2 FAILED are
  "380 installed layout" (no Claude login file, ENV GAP) and "380 shots harness" (Playwright
  screenshot failed). The 1 SKIPPED is "380 build" (ENV GAP). None relates to CHANGELOG.
- run-all-389: PASS=16 FAIL=0. run-all-374: PASS=20 FAIL=0 SKIPPED=1. run-all-370: PASS=14 FAIL=0.
  run-all-391: PASS=10 FAIL=0.
- run-all-366.sh was not run (main session runs it).
