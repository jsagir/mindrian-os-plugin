# Phase 172 Deferred Items

Out-of-scope discoveries logged during plan execution. NOT fixed in the plan that found them.

## DI-172-09-01: orchestration-projection STALE (pre-existing, from Plan 172-12)

- **Found during:** Plan 172-09 execution (running `node scripts/build-orchestration-projection.cjs --check`).
- **Condition:** `data/brain-orchestration-projection.json` + `data/orchestration-command-ledger.json` are STALE. Regenerating flips `/mos:ingest-methodology` from `excluded` to `ranked` (ledger counts 68->69 ranked, 18->17 excluded).
- **Root cause:** Plan 172-12 commits `dc76f26a` (methodology-ingest step-5 thin CIRS caller + wire /mos:ingest-methodology) and `b9525a0a` (SENS-09 context branch) changed `commands/` surfaces but did NOT regenerate the projection/ledger in lockstep. The staleness predates Plan 172-09 and is entirely 172-12's intended surface change.
- **Why NOT fixed here:** Plan 172-09 touches only `lib/hmi/dial-*.cjs`, `lib/core/act-jtbd-blurb.cjs`, and tests - none are projection inputs (the generator scans `commands/*.md` + `skills/<dir>/SKILL.md` + `agents/*.md`). Regenerating would fold 172-12's intended change into a 172-09 commit, violating the per-task scope boundary. The diff confirms the only delta is `/mos:ingest-methodology` becoming `ranked`, which is 172-12's own wiring.
- **Resolution path:** A later 172 plan (or a 172-12 lockstep follow-up) should run `node scripts/build-orchestration-projection.cjs` and stage the regenerated `data/brain-orchestration-projection.json` + `data/orchestration-command-ledger.json`. The Plan 172-13 hard-FAIL gate flip will force this.
- **Note:** `tests/run-all-172.sh` runs the connector-registry `--check` (green) but NOT the projection `--check`, so the phase aggregator stays green (15/15) despite this pre-existing projection staleness.
