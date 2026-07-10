---
phase: 215-eureka-portfolio-fusion
plan: 05
requirements: [215-R6]
status: COMPLETE
---

# 215-05 SUMMARY -- the hard acceptance gate (real 2117-tech run + reproduction)

## What ran

**Task 1 (LIVE full-scale pass -- the load-bearing infra gate).** The composed
pipeline (`scripts/eureka-portfolio-report.cjs`) ran against the real 2117-tech
`jhtv-oliver-kuntz` room with the real encoder (`MongoDB/mdbr-leaf-ir`, 384-dim,
`MINDRIAN_EMBED_BATCH=32`, ~11GB free RAM, no OOM), `sqlite-vec` backend online
(vec0 available). Both 212-era blockers (c222ff7d embed batching, 73698c73 vec0
probe) are PROVEN fixed at full scale, not assumed:

- `--pairs full`: 2,073,661 cross-boundary pairs scored in ~25.5 min. Room
  `nodes` count 2372 identical before/after (Part 9: only derived `eureka_*`
  tables written). Zero network beyond the one-time model-weight fetch by
  model id (Part 8). Report kept at `evals/eureka/215-jhtv-portfolio-report.md`
  + `.json` (gitignored, real-room content never enters the repo).
- `--pairs graph`: 919 cited CONVERGES pairs scored. Report kept at
  `evals/eureka/215-jhtv-portfolio-report.graph-mode.md` + `.json` (DG-2
  comparison, also gitignored).

A blocking join bug was found and fixed mid-plan (commit `b4807e73`): the
runner keyed pairs by raw room node id, true only for the synthetic fixture;
the real import keys nodes `claim:<meeting>:<hash>` with the catalog C-number
as the trailing `source_path` token. Fixed via a `catalogId(row)` adapter.

A second bug was found and fixed (commits `16464460`, `1e1c6657`, `135eeb14`):
the runner's field contract (`primary_problem`/`problems`/`pair_count`,
`section`=domain) did not match what `scripts/csv-to-idea-graph.cjs` actually
emits (`primary_label`/`labels`/`summary`, `section`=lens-role,
`edge_count`/`degree`). This degenerated the attention axis (`pair_count` all
0) and saturated the composite score (50+ pairs tied at a ceiling), which is
why the pre-fix full-mode run only barely surfaced one of the two gems (rank
40) and missed the other. `tests/test-215-field-contract.cjs` is the permanent
regression guard, wired into `run-all-215` leg 5b.

**Task 2 (reproduction assertion).** After BOTH fixes landed and Task 1 was
re-run, the current state is:

- `--pairs full` (2.2M pairs): **neither** acceptance pair surfaces (not
  top-50, not tail-flagged). This is NOT a new bug -- it is honest evidence of
  substrate-scale dilution: real signal concentrated in the 919 cited
  CONVERGES pairs gets outranked by sheer combinatorial volume among millions
  of uncited cross-boundary pairs.
- `--pairs graph` (919 pairs): **both** acceptance pairs reproduce cleanly --
  arrhythmias {C16796,C03552} at rank 10 (score 0.745), cerebral aneurysm
  {C16742,C05004} at rank 16 (score 0.677) -- with full canonical Opportunity
  Statements (every `CLAUSE_LABELS` marker present, non-empty unmet-need
  slots, honest pending/false critic state).

## Navigator verdict (recorded verbatim from the Task 3 checkpoint)

Presented as two Decision Gates via AskUserQuestion. Navigator selected:

- **DG-2 (default acceptance substrate): "Graph is canonical (Recommended)."**
  Graph-pairs (the cited CONVERGES substrate) is the acceptance substrate.
  Full-catalog stays a supplementary, non-gating tail-gem sweep -- generated
  and kept on disk, cited in this SUMMARY, but not read by the reproduction
  test.
- **DG-1 (tail x Burt brokerage composition): "Confirm (Recommended)."**
  The tail runs `attention-growth-only` today (Phase 212.5's Burt
  structural-hole brokerage module does not exist yet; the `--brokerage` seam
  is live but dormant). Confirmed: compose brokerage into the tail once 212.5
  ships. This is a 215-follow-up wiring item ON 212.5, not new 215 code.

## Changes made to close the gate (post-verdict)

- `tests/test-215-reproduction.cjs`: re-pointed `JSON_PATH` from the
  full-catalog JSON to the graph-mode JSON; provenance assertion now checks
  `pairs_mode === 'graph'` (was `'full'`); header comment records the DG-2
  rationale and the dated navigator call.
- `tests/run-all-215.sh`: leg 6's `run_if` guard file changed from
  `215-jhtv-portfolio-report.json` to `215-jhtv-portfolio-report.graph-mode.json`.

## Verification (all green, post-change)

- `node tests/test-215-reproduction.cjs` -- exit 0, 16 assertions passed, both
  reproduced statement texts printed.
- `bash tests/run-all-215.sh` -- `PASS=8 FAIL=0 SKIP=0` (reproduction leg
  PASSED, not skipped).
- `bash tests/run-all-211.sh` -- `PASS=10 FAIL=0` (no regression).

## Env note

`MINDRIAN_EMBED_BATCH=32` (default) used for the 2117-node run; no OOM, no
need to drop to 16.

## Success criteria (215-R6) -- MET

- The real 2117-scale pass completed with the live encoder: YES (full mode,
  proven at scale).
- Both manual Opportunity Statements reproduced automated + ranked: YES, on
  the navigator-confirmed canonical substrate (graph-pairs).
- Navigator spot-check verdict recorded: YES (DG-1 confirm, DG-2 graph-canonical,
  both above).

Phase 215 (Eureka Portfolio-Scale FUSION) is COMPLETE: 215-01 through 215-05
all done, 215-R1 through 215-R6 satisfied.
