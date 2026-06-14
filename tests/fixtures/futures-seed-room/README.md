# Fixture: futures-seed-room (FW-06 HSI integration)

This fixture seeds the FW-06 file-then-register-then-scan integration test
(`tests/test-futures-hsi-integration.cjs`). It is NOT a pre-built room on disk;
the test generates consequences in a fresh temp directory and uses this README
only as the documented description of what the test materializes.

## What the test materializes

The integration test calls `generateRing` to produce a bounded ring of
consequences, then `registerConsequenceArtifacts` to:

1. file each consequence as a nested Obsidian artifact under
   `opportunity-bank/futures-<seed-slug>/<slug>/<slug>.md` (CLAUDE.md decision
   16), each folder carrying an ICM Layer 0 `ROOM.md` (decision 15), and
2. register each consequence as a `type='Artifact'` node in `room.db` keyed by
   its room-relative path id (the id `hsi-to-graph.cjs` gates on).

It seeds **>= 4 consequences spanning >= 2 PESTEL domains** (e.g. Technological,
Economic, Social, Legal) so a **cross-domain** `HSI_CONNECTION` edge can form.

## What the test asserts (FW-06 acceptance)

- `assertArtifactCountMatchesFiled` returns `ok:true` (Artifact node count ==
  filed consequence count) BEFORE the scan -- the LANDMINE #1 precondition.
- A negative case proves the guard HARD-FAILS (`ok:false`) when an Artifact node
  is missing, and `runHsiScan` refuses to call compute-hsi in that case.
- With `python3` present, `runHsiScan` produces `.hsi-results.json` AND >= 1
  `HSI_CONNECTION` edge in `room.db` in a single call.
- Without `python3` (Desktop/Cowork Tri-Polar), `runHsiScan` degrades cleanly
  (Tier 0 fallback, `degraded:true`) rather than crashing.

## Why a temp dir, not a committed room.db

`room.db` is a binary SQLite file with WAL sidecars and an environment-specific
schema migration state; committing one would rot. The fixture is data + the
documented shape; the test builds the live room each run. Part 8: everything is
LOCAL (filesystem + room.db); zero Brain egress.
