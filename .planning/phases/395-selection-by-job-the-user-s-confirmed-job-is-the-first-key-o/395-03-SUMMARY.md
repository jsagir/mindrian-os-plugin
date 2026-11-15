# 395-03 Summary: the per-turn hook reaches the selector

Date: 2026-11-15. Branch `work/395-selection-by-job`. Base of this slice: `d13600431`.

## What changed

* `scripts/intent-classifier.cjs` (15 added lines, 0 removed): new function `sectionSlugForEngine`; the context for `decide()` now carries `section` (slug of the section in focus, when it is a direct child of the room) and `surface: 'cli'`. Before, `decide()` never ran the selector on a real turn.
* New `tests/test-395-hook-reaches-selector.cjs` (11 checks); `tests/run-all-395.sh` lists it.

## What ran

* New test: 2 of 11 on untouched code, 11 of 11 with the change (executor and cold check).
* `bash tests/run-all-395.sh`: exit 0, 3 files.
* Suite 36925: same failing set before and after. Six single hook tests: same exit codes.
* Suite 3696: same leg list except `lib/memory/debouncer-drain-at-prompt.test.cjs` Test 5. That test is bimodal on untouched code (16 alternating runs on each copy; see `docs/designs/selection-path/runs/baseline/README.md`). Not caused by this slice.
* Cold check (`docs/designs/selection-path/runs/395-03/cold-check.md`): COMMIT, 0 blockers, 2 majors, 7 minors. Stdout byte-identical on 10 default-operator states; hook exit 0 with its block in 11 fault cases; no network, no new write.
* Added time, measured by the cold check (20 alternating runs, also by CPU time): 55 ms median in `decide()`, 65 ms for the hook process, 83 to 118 ms with a cold compile cache. The plan figure of 35 ms was low.

## What did not run

* A slow file system, Windows, a live Desktop or Cowork host.
* Suite 3696 a third time.

## Known limits

* A room that was just born has no `MINTO.md` in any section, so it has no section in focus and the selector is still not reached there.
* The focus is for the room, not for the session; `active-section.json` has no shipped writer.
* On an offer turn the offer is a selector id but not always the primary (plan 395-05).

## Carried to a later plan

* Major 1: `lib/core/feyminto/capability.cjs:102` loads `lib/mcp/tool-router.cjs` and 95 files of `zod` for every command, also on the `cli` surface. About 70 percent of the added time. Fix: compute the `mcp` marker only on demand.
* Major 2: the selector cost has no bound: `readRuns` (`lib/core/feyminto/next-move.cjs:414`) reads every research run, `gatherNest` (`:451`) reads 5 section files whole. Worst case built: 649 ms median, 1,737 ms maximum in `decide()`. On a slow file system the 5 s hook timeout can be passed (assumed, not measured). Fix: a time guard at the context literal and a cap on the runs read.
