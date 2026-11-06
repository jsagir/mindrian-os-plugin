---
phase: 388-ship-less-keep-tests-and-dead-weight-out-of-the-install
plan: 02
subsystem: packaging
tags: [runtime-need, fs-trace, differential, npm-pack, safe-set]
requires: [388-01]
provides:
  - 388-safe-set.tsv (462 verdicts with evidence; input of plan 388-03)
  - 388-RUNTIME-NEED.md (method, class table, doctor reads, owner-visible effects, UNVERIFIED list)
  - 388-probe-full.json (full install recorded twice; before state for plan 388-04)
  - 388-runtime-need-scan.cjs, 388-fs-trace-preload.cjs, 388-installed-diff.cjs
affects: [388-03, 388-04]
key-files:
  created:
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-runtime-need-scan.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-fs-trace-preload.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-installed-diff.cjs
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-safe-set.tsv
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-probe-full.json
    - .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-RUNTIME-NEED.md
  modified: []
key-decisions:
  - "A doctor lint that reads a file's text is not a need, but the file stays UNCERTAIN until the owner rules on lint coverage"
  - "Packaging walks (npm pack --dry-run) are counted apart from real reads"
  - "The test runner and its tests travel together"
duration: 1 session
completed: 2026-11-06
---

# Phase 388 Plan 02: Runtime need of the candidates Summary

One-line: of 462 candidates, 220 files (2,703,434 bytes, 5.84 percent of the package) are SAFE to leave out of the install (208 `*.test.cjs` files, 8 `.pyc`, 3 data files, 1 HTML template); 168 are UNCERTAIN, 60 NEEDED, 14 RULED-KEEP; the full and the reduced install behave the same in every stable probe.

## Verdict counts (PROVEN, from 388-safe-set.tsv)

| Verdict | Files | Bytes |
|---|---|---|
| SAFE | 220 | 2,703,434 |
| NEEDED | 60 | 325,209 |
| UNCERTAIN | 168 | 2,703,520 |
| RULED-KEEP (class T8, Phase 385 R9 and R10) | 14 | 41,849 |

The static scan alone said SAFE 358 (5,331,282 bytes). The fs trace of the installed layout then showed that two doctor source lints (`doctor.cjs` python-floor walk of scripts/, and `scripts/check-render-coverage.cjs`) read the text of 132 of those files. Those 132 became UNCERTAIN. A closure pass moved five more by hand (a kept script reads one data file; three font licence or provenance files; two python package markers; each reason is in the row).

## Differential and trace (PROVEN)

- 40 hook commands, MCP tool lists for two client identities (75 and 75), 8 read-only tool calls, 50 doctor points, 87 syntax checks: compare exits 0, no difference in any stable probe, 0 unstable probes.
- trace-check exits 0 for the final SAFE set. It exits 1 and names 132 paths for the static list (the check can fail).

## Deviations from Plan

1. [Rule 1 - Bug, plan 388-01] The reach scan of 388-measure.cjs did not read extensionless hook scripts (scripts/on-stop and others). Found by an independent substring cross-check of the SAFE rows. Fixed, outputs regenerated: candidates 495 to 462, commit adcadd4b6 ("fix(388-01)").
2. [Rule 2 - Missing critical] A packaging walk (`npm pack --dry-run` run by the release-payload-ceiling policy inside `doctor --acceptance`) stats every file. The trace now records the running script name and counts walk-only touches apart; otherwise the proof could not hold.
3. [Rule 2 - Missing critical] Static scan: the first data-citation logic missed the harness policies whose `runner` field is spawned (scripts/check-release-payload-ceiling.cjs, scripts/check-graph-derive-health.cjs). Now NEEDED (E6). Comments are ignored. Fonts, images and query files are matched by the wider token list.
4. TDD order: the self-tests of the scanner were written together with the scanner (the RED step was shown for the guard and the measure script, not for the scanner). Each of the 8 scanner tests passes, test 6 is the mutation.
5. Only 4 of 75 MCP tools carry readOnlyHint, so only 8 calls were made; the bound-room arm gave the same text as the unbound arm (UNVERIFIED).
6. The reduced run deleted 226 files; the final SAFE set is 220 (a subset). Not re-run separately.
7. The caller rule "offline" applied: no `npm ci`, linked layout only.
8. A sample of shipped tests was run from the extracted package to answer "can a user run a shipped test" (3 of 4 pass). The runner was started and stopped.

## Known Stubs

None.

## Self-Check

- All four self-tests exit 0 (guard 4, measure 4, scanner 8, installed-diff 5 groups).
- `388-installed-diff.cjs trace-check --full 388-probe-full.json --safe 388-safe-set.tsv` exits 0.
- `388-measure.cjs check 388-MEASURE.md` exits 0.
- `388-guard.cjs check 02` shows no changed path outside the phase folder.
- Scratch folders deleted. No product file changed.
