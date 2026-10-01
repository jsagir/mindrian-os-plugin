---
quick_id: 261001-q5t
status: complete
date: 2026-10-01
---

# Quick 261001-q5t Summary

- Root cause: 960a7a2ec (341-06) retyped the update-path literal in
  scripts/collect-cold-install-evidence.cjs, after be641e88d (339-02) had
  pinned D-08 single-source. Production side was wrong; test untouched.
- Fix: the script now requires `PLUGIN_UPDATE_COMMAND` from
  lib/core/update-path.cjs and builds the same note string from it.
- Verify: test-339-update-path-single-source PASS (0 failures).
  `bash tests/run-all-339.sh` PASS=15 FAIL=1; the one red (dist bundle
  staleness: bundle from 2.0.0-beta.36, live 2.0.0-beta.52) reproduces on a
  git archive of HEAD and is unrelated.
