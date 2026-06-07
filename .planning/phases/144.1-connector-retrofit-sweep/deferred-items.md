# Deferred Items - Phase 144.1 connector-retrofit-sweep

Out-of-scope discoveries logged during plan execution. NOT fixed in the
discovering plan (scope boundary: only auto-fix issues directly caused by the
current task's changes).

## DI-144.1-A: test-connector-part8-boundary CHECK 2 fails on /mos:funding framework=null

- **Found during:** Plan 144.1-04 (agents-walk) verification run.
- **Discovered by:** `node tests/test-connector-part8-boundary.cjs` -> CHECK 2 FAIL.
- **Symptom:** CHECK 2 ("registry generic-handles-only") asserts every connector
  `framework` is a generic name present in `data/framework-names.json`. The
  `/mos:funding` connector (`source: command`) carries `framework: null`, which
  is not in the allowlist, so CHECK 2 fails:
  `connector /mos:funding framework "null" is not a generic name`.
- **Pre-existing:** YES. `/mos:funding` was added by a prior plan (143.x / an
  earlier 144.1-0x batch); it is already in the committed
  `data/connector-registry.json` (the registry was at 46 before Plan 04).
  Plan 04 only added the agents/ walk to the generator -- it added ZERO new
  connectors (registry stays 46, no agent connector declared yet), so this
  failure is NOT caused by Plan 04.
- **Why deferred:** Out of scope for Plan 04. Plan 04's verification contract
  names only CHECK 1 (brain-client locality), which PASSES. CHECK 2 concerns a
  command connector's `framework: null`, a different surface owned by the command
  retrofit plans (143.x / 144.1-02/03), not the agents-walk plan.
- **Suggested fix (for the owning plan):** either give `/mos:funding` a generic
  framework handle that exists in `framework-names.json`, OR relax CHECK 2 to
  accept `framework: null` (a connector that fires no framework on APPROVE is a
  legitimate shape -- the validateConnectors WFL-01 guard already exempts a
  connector that does not fire a command). Decide in the command-connector plan,
  not here.
