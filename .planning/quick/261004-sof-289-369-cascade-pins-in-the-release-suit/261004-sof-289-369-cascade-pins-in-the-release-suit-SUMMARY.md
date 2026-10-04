---
phase: quick
plan: 261004-sof
status: complete
commits: [cfd411ee6, aaf6a8c76]
---

# Quick 261004-sof: 289/369 cascade pins in the release suite gate

Two test pins moved to the behaviour Phase 289 and Phase 369 shipped on purpose. No lib/ change.

## R6b (tests/test-366-gated-term-release.cjs) - cfd411ee6

- Before: `wrong` refused with session_mismatch AND `right === null` (the stranger spent the gate).
- After: `wrong` refused with session_mismatch; `right` is the owning session's consume (the stored
  entry: non-null, `ok !== false`, has `resumeFn`); `calls.length === before`. Dated reason comment added.
- Measured: `PASS: 28 FAIL: 0` (was 27/1).

## M3 (tests/test-363-mcp-tool.cjs) - aaf6a8c76

- Diagnosis (one printed reply each): the grant approve reply still carries `chain_result` (ok:true,
  grant, decision_node_id), so those checks are unchanged. The TypeError came from the odd-answer
  check: an approve verdict on `not_now` now returns
  `{"ok":false,"reason":"chosen_not_approving","gate_id":...}` (gate left open, no resume), with no
  `chain_result`.
- Before: `odd.chain_result.ok === false`. After: `odd.ok === false && odd.reason === 'chosen_not_approving'`
  and no `chain_result` (nothing resumed); the no-grant-written check is kept. Dated comment added.
  Every other M3 check (ok, single use via `replayed`, room for M4/M5/M7) is untouched.
- Measured: `PASS: 15 FAIL: 0` (was 11/4; M4, M5, M7 recovered because M3 produces its room again).

## Release gate

`bash tests/run-all-366.sh` -> `PASSED=70 FAILED=0 SKIPPED=0 KNOWN=1`.

Not in scope (follow-on quick): tests/test-345-gate-ratify.cjs, tests/test-353-filing-gate.cjs.
