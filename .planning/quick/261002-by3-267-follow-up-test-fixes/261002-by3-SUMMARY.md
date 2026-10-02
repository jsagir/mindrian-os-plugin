---
phase: quick-261002-by3
plan: 01
subsystem: tests
tags: [mcp-v2, test-only, 267-follow-up]
key-files:
  modified:
    - tests/test-257-strict-input-shapes.cjs
    - tests/test-198-contract-schema.test.cjs
    - tests/test-270-dynamic-tree.cjs
    - tests/test-270-resource-session-room.cjs
commits:
  - 122766d8a (Task 1, test-257)
  - e4733065e (Task 2, test-198-contract-schema)
  - fc7c6c552 (Task 3, test-270 x2)
completed: 2026-10-02
---

# Quick 261002-by3: 267 follow-up test fixes Summary

Closed Finding F-A (test-257 v1 before-vs-after legs retired, no more live npm install), Finding F-B (test-198-contract-schema on the v2 registerTool config) and the test-270 registerResource stub gap. Test-only; zero production or peer files touched.

## Task results

1. **test-257 (122766d8a).** Removed the scratch pre-migration shim, `findV1SdkFixture`, `buildPreMigrationScratchShim`, Arms E/F/G (before-vs-after), `schemaFieldNames/RequiredNames`, `PRE_MIGRATION_COMMIT`, `scratchDirs`. Added Arm E (post-only). Header carries `RETIRED 2026-10-02` with ruling, root cause and where each guarantee moved. The string `@modelcontextprotocol/sdk` appears 0 times. `node_modules/.package-lock.json` mtime unchanged (1790919523 before and after). Gate T1-OK.
   Run output: Z1, Z2, Z3, Z4a, Z4b, Z4c, A, C, D, E (post-only), E2 all `ok`; no UNEXPECTED ERROR, no SKIP; hygiene clean. One red: **Arm B** (`brain_query: ... captured: [{"name":"theo_health","arguments":{}}]`), the pre-existing theo_health boot race named in 267-BASELINE.md (same class as test-257-brain-tool-egress-invariant Arm 2). Not touched, as instructed. Final line: `strict input shapes: FAIL (1 failures)`.
2. **test-198-contract-schema (e4733065e).** Fake server now has `registerTool(name, config, handler)` only (v1 `tool()` dropped, duplicate-name throw kept). Two `getRegistrationHealth()` checks added (flag off, flag on), with failed module names in the label. Per-tool `inputSchema is a zod object` check. Numbers sample at `minValue`; unsatisfiable optional fields left absent with a visible note (`research_run: ... left absent: run_tag`). Parse uses the registered `inputSchema`; section (8) uses `<x>Tool.inputSchema`; unused `z` require removed. Result: exit 0, **240 assertions** (176 before the added checks; also grew from per-tool inputSchema checks and peer-added tools). Both health checks `ok`. Gate T2-OK.
   - Secondary (`tests/run-all-198.sh`): `>>> SPEC-2 contract-version + per-tool schema validity: PASSED`. The Part 8 local-only floor leg shows FAILED (pre-existing, 267-VERIFICATION-GATES.md row 4); only the head of the run was reviewed (output filtered, first ~30 lines), the rest not triaged.
3. **test-270 x2 (fc7c6c552).** Both stubs implement `registerResource(name, uriOrTemplate, config, cb)`; dynamic-tree also `registerTool(name, config, cb)`; v1 `resource()`/`tool()` deleted from both. Both print `PASS <file> (4 assertions)`. Gate T3-OK.

## Deviations from Plan

None. The plan executed as written. One judgment call: test-198's `z` require was removed because no code referenced it (only comments).

## Peer drift

None observed. test-198 section (6) completeness cross-check passed, including `research_run (declared in mcp-tool-connectors.json) is registered by the tools/ seam`.

## Known Stubs

None.

## Self-Check: PASSED

- 3 commits exist (122766d8a, e4733065e, fc7c6c552), each touching only its own task's test files (`git show --stat`).
- SUMMARY not committed, STATE.md/ROADMAP.md not written, nothing pushed.
