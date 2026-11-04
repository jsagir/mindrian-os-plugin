---
status: complete
quick_id: 261103-vi0
---
# 261103-vi0 summary

Root cause: the "380 typecheck" leg used run_if, which maps exit 77 (ENV GAP) to SKIPPED; the nested aggregator exits 0, so run-all-366 showed PASSED.
Fix: tests/run-all-380.sh uses run_strict_if for that leg (77 counts as FAILED). No auto-install (wall rule; release.sh Step 0.6c never installs, it prints the fix line).
Negative control: tests/test-380-gate-wiring.cjs W9 (fails on the old line, verified; passes on the new).

Verified: gate-wiring 40/0; wrapper exit 77 with deps missing; exit 0 with `npm ci --ignore-scripts` in ui/mos-face.
Full run-all-380 with deps installed: 18 passed, 2 failed, both outside this diff: engine tests (claude plugin test ETIMEDOUT in this session), egress (root node_modules absent in the fresh worktree; passes 29/0 with root deps linked).
Not run: run-all-366, release dry-run, real-room receipt. No push.
