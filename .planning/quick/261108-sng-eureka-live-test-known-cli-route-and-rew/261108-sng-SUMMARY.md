---
quick_id: 261108-sng
status: complete
date: 2026-11-08
---

# Quick 261108-sng Summary

Two small fixes found by Phase 374.

## Fix 1: tests/test-eureka-live-capability-run.cjs

- The live catalog (/home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/data/capability-catalog.v1.json, read only) has one capability, opportunity.run_pair_screen, with routes.cli.executable = eureka (arguments run <input-folder>).
- Edit 1: `eureka` added to the known dedicated executables list (the assertion that failed).
- Edit 2: the descriptive-CLI loop now has the entry `['eureka', null]` and filters out the empty legacy name, so `uv run --project <root> eureka --help` must exit 0, the same as for the neighbor routes. Narrowest edit: the main eureka command has no legacy alias. The test already calls `eureka capability <id>` below, so the command is known to exist (pyproject script eureka = mindrian_eureka.cli:main, argparse prog eureka).
- NOT RUN (it starts the real engine and writes under ~/.mindrian). Verified statically: `node --check` passes. A node comparison of the known list with the distinct experimental/host_brokered executables in the catalog (minus eureka-workflow) gives missing = [].
- UNVERIFIED: that `eureka --help` exits 0 in the live engine (read from cli.py that prog is eureka; not executed).

## Fix 2: start note in lib/mcp/tools/eureka-capability-jobs.cjs

- Old: "This job exists only in the MindrianOS MCP process that started it and cannot resume after that process restarts."
- New: "This job is held by the MindrianOS MCP process that started it. A finished job can be read again after a restart from its saved record. A job that is still running when the host stops does not resume, and the engine may mark it failed with server_restarted." The poll and 30 minute sentences are kept.
- RED first: new tests/test-374-start-note.cjs (arms N1 to N3, fake in-process engine, scratch HOME). Before the edit: N1 and N2 FAIL, N3 ok. After: 3 ok.
- Pins: the JOB_NOT_FOUND runtime message ("Jobs cannot resume after the MindrianOS host process restarts") is unchanged, as is test-387-eureka-installed-layout. test-374-descriptions still passes (old description phrase absent). No pin was moved. The 384 golden, 267 snapshots and test-270 constants stayed green, untouched.

## Verification (all with env -u MINDRIAN_EUREKA_ROOT)

- `bash tests/run-all-374.sh --neighbors`: Phase 374 PASS=48 FAIL=0 SKIPPED=1 (test-374-live-restart.cjs, ENV GAP, as before); exit 0. Includes 384 parity, 267 and 387 neighbors, connector registry check.
- `node tests/test-270-tool-schema-budget.cjs`: 5 passed, 0 failed.
- `node scripts/build-connector-registry.cjs --check`: OK.
- ASCII and no em or en dash check on the changed files: see the commit report.

## Commits

Commits: d9e546f38 (fix 1), 41fefeb0b (fix 2).
