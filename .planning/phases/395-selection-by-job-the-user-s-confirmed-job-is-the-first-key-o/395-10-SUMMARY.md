# 395-10 Summary: Theo job statements ship in the plugin (code; the live refresh follows)

Date: 2026-11-16. Base `74fda0093`. Planning and review on Opus 5.5, execution on Haiku 5.5. Owner rulings 21, 22, 25 to 29, 32.

## What changed

* New `lib/core/framework-jobs.cjs`: compose, validate and read `data/framework-jobs.json` (entries: name, `alias_of`, jobs with text, status ruled or draft, main, `pws_backed`, optional `basis`, draft `confidence` and `drafted_by`; closed key list; misaligned marks stop the refresh).
* `scripts/refresh-framework-names.cjs`: `--live` also reads the statement keys through a fixed Cypher in buckets, checks the rows against Theo's own counts, writes the jobs file; a degraded, capped or mismatched read writes nothing (exit 4). `--check` validates the jobs file when it exists.
* `lib/mcp/tools/sensors.cjs`: `suggest_next` field `next_move.method_job` shows the statement of the framework behind the proposed command (ruled first; drafts labelled; ruling 29 sentence when backed). No sort key, score or filter reads the file.
* New `tests/test-395-job-statements.cjs` (37 checks); `tests/run-all-395.sh` lists it.

## What ran

* Executor: new test fails before (module absent), 37 of 37 after; `run-all-395.sh` 11 of 11; `--check` passes and says the jobs file is absent; suites 36925 and 3696 same failing legs as before; scorer unchanged (B1 13 of 33, B2 8, B3 24 of 33, B4 4 of 5, pool 12, order 8).
* Cold check (`docs/designs/selection-path/runs/395-10/cold-check.md`): COMMIT, 0 blockers, 0 majors, 7 minors; commit `74fda0093` KEEP (2 minors). No network event in the new test; 40 of 40 forbidden-key fixtures refused; selector output byte-identical with and without the file except `method_job`.

## Carried

* m2: a crash between the 2 file writes can leave a new names file with an old or absent jobs file; fix later: write both temp files, then rename both. For the one live refresh: check `git diff --stat -- data` for both files.
* m1: release recovery texts (`scripts/release.sh:357`, `scripts/release-cut-listener.cjs:374`, `:383`, RULE 5 place 9) name only the names file.
* m3: a capped bucket with unusual names stops every refresh (safe). m5: `basis` and `drafted_by` are free strings up to 120 characters. m6: "owner approved" for the 70 earlier ruled statements and "a model wrote this" for drafts rest on Theo's records. m7: the spike-findings skill does not yet name the ruling 22 exception.
* 74fda0093 n1: a stored goal `explore` can no longer use change-rung. n2: brief blocks read a cut file whole with no byte ceiling.
