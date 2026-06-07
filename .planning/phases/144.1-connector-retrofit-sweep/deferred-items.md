# Deferred Items - Phase 144.1 connector-retrofit-sweep

Out-of-scope discoveries logged during plan execution. NOT fixed in the
discovering plan (scope boundary: only auto-fix issues directly caused by the
current task's changes).

## DI-144.1-A: test-connector-part8-boundary CHECK 2 fails on /mos:funding framework=null

- **RESOLVED (Plan 144.1-08, commit c210ac21):** CHECK 2 now exempts
  `framework === null` from the generic-name allowlist assertion. null is the
  legal WFL-01 no-framework config (a connector that fires no command on APPROVE),
  not smuggled user content; a non-null framework must still be a generic name in
  framework-names.json. test-connector-part8-boundary.cjs now exits 0 over the full
  53-connector registry (4/4 threat paths). See 144.1-08-SUMMARY.md.

---
### Original entry (now resolved)

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
- **Update (Plan 144.1-05):** Plan 05 added 3 MORE legitimately-null-framework
  connectors -- `agent:brain-query`, `agent:investor`, `agent:opportunity-scanner`
  (all `framework: null` + `filing: none` + no surface, the only WFL-01-legal
  null-framework shape, per the plan's explicit instruction and the CONNECTOR-CONTRACT
  additive-degrade rule). These share the SAME CHECK 2 gap as `/mos:funding`: the
  test asserts every connector framework is in the allowlist and does NOT exempt
  `null`. The SHIPPED generator `--check` (the canonical gate per the plan fences)
  is GREEN at 53 connectors; only this one test assertion does not tolerate a null
  framework. The fix is still test-side (exempt `framework: null` from CHECK 2's
  allowlist assertion) and remains out of scope for the agent-frontmatter plan.
  CHECK 1 (brain-client locality), CHECK 3, and CHECK 4 all PASS.
