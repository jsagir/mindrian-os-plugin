# Phase 392 deferred items (out of scope, logged by executors)

| Found by | Date | Item | Why deferred |
|---|---|---|---|
| 392-10 | 2026-11-09 | `bash tests/run-all-339.sh` reports FAIL=1 on "dist bundle staleness (build-dist-bundles.cjs --check-stale)": "bundle was generated from 2.0.0-beta.52, the live plugin is 2.0.0-beta.81. Recovery: node scripts/build-dist-bundles.cjs". | Pre-existing on the branch (version-based, not a source diff); the dist bundle is a release-lockstep artifact outside this plan's files. Rebuild at the next release cut or by a quick task. |
| 392-10 | 2026-11-09 | Plan 392-10 names `node scripts/build-brain-census.cjs --check` as the census check; the script has no `--check` mode (its header lines 13-15 say so; it prints usage and exits 1). The census gate that exists is `node tests/test-254-composition-census.cjs` over `lib/mcp/brain-composition-census.cjs`. | Plan wording; later plans (392-11 to 392-16) that cite the same command should cite the test-254 check instead. |
