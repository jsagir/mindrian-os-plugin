---
quick_id: 261108-sng
type: quick
date: 2026-11-08
---

# Quick 261108-sng: Eureka live test knows the eureka CLI route; start note tells the restart truth

## Task 1: live capability test knows the dedicated CLI route named eureka

Files: tests/test-eureka-live-capability-run.cjs

The live catalog now has opportunity.run_pair_screen with routes.cli.executable = eureka. The test refused any dedicated route not in its known list. Add eureka to the known list and to the descriptive-CLI loop (a --help check, with no legacy alias). Do not run the test (it starts the real engine). Verify by node --check and by comparing the known list with the distinct catalog executables.

## Task 2: start note after Phase 374-10 (RED first)

Files: tests/test-374-start-note.cjs (new), lib/mcp/tools/eureka-capability-jobs.cjs

RED: new test pins the new sentences and the absence of the old phrase. Then reword the note: a finished job reads again after a restart from its saved record; a running job does not resume; the engine may mark it failed with server_restarted. Leave the JOB_NOT_FOUND message alone.

## Gates

bash tests/run-all-374.sh and --neighbors, test-270, build-connector-registry --check. Stop if the 384 golden, 267 snapshots or test-270 constants turn red.
