---
quick: 260715-0nj
subsystem: eureka-portfolio-ranking
tags: [scaffold-pair-filter, ranking-regression, candidate-generation, live-verification, density-independence]
provides:
  - SCAFFOLD_NODE_TYPES both-scaffold candidate-pair exclusion in scripts/eureka-portfolio-report.cjs (step 4b)
  - scaffold_pairs_excluded provenance (JSON + markdown table)
  - tests/test-218-scaffold-pair-filter.cjs (scaffold-only empty + mixed one-side-survives proof)
  - live re-verification 72.0% -> 0.0% on the identical tier2-verified aion-eureka-synergy substrate
requires:
  - quick 260714-hzx (the tier-2 substrate + the 72.0% regression finding this closes)
  - lib/core/eureka/opportunity-harvest.cjs lines 519-521 (the both-scaffold skip precedent)
affects:
  - scripts/eureka-portfolio-report.cjs
  - tests/test-218-cohort-stratification.cjs
  - tests/test-218-noise-reduction.cjs
  - tests/run-all-218.sh
key-files:
  created:
    - tests/test-218-scaffold-pair-filter.cjs
  modified:
    - scripts/eureka-portfolio-report.cjs
    - tests/test-218-cohort-stratification.cjs
    - tests/test-218-noise-reduction.cjs
    - tests/run-all-218.sh
    - .planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md
    - CHANGELOG.md
decisions:
  - "EXCLUDE, not down-weight: scaffold pairs are substrate at every density, so exclusion (not proportional down-weight) is the only density-independent fix; extends the opportunity-harvest.cjs both-scaffold skip precedent to the portfolio ranking candidate set"
  - "Filter at candidate-GENERATION (step 4b), one post-enumeration pass covering all three pairs modes, NOT in portfolio-dimensions.cjs scoring math (912139c9 stratification byte-unchanged)"
  - "Narrow scope: only BOTH-scaffold pairs excluded; one-side (entity-vs-artifact) pairs survive"
metrics:
  duration: ~35m
  tasks: 3
  files_changed: 6
completed: 2026-07-15
---

# Quick 260715-0nj: Exclude scaffold-vs-scaffold pairs from the Eureka ranked-pair candidate set Summary

Both-scaffold (`memory_artifact` / `Artifact` on both endpoints) candidate pairs are now excluded from Eureka's ranked-pair candidate set at the pair-candidate generation layer in `scripts/eureka-portfolio-report.cjs`, closing the 72.0 percent structural-share regression quick task 260714-hzx traced. Verified live: the exact `room.db.tier2-verified` substrate that produced 72.0 percent (18/25) now produces 0.0 percent (0/25), with 741 scaffold pairs excluded and the ranked list still non-empty, proving the fix is density-independent rather than a re-densification artifact.

## What shipped

### Task 1 (commit 4e7201ef): the filter + suite update

- **`SCAFFOLD_NODE_TYPES`** frozen set (`memory_artifact`, `Artifact`) added near `ICM_TYPE_DENY`, with a header comment citing the `opportunity-harvest.cjs` lines 519-521 precedent and 260714-hzx provenance.
- **Step 4b both-scaffold exclusion** in `main()`: a single post-enumeration pass after all three pairs modes (graph, full, room) fill the candidate list and BEFORE scoring. A pair is excluded only when BOTH endpoints are in `SCAFFOLD_NODE_TYPES`; a missing `indexed` entry is defensively NOT treated as scaffold. One-side pairs are untouched (narrow scope). The scoring loop now iterates the filtered list.
- **Room-mode comment** updated to document the scaffold exception honestly (cited CONVERGES edges still always score EXCEPT both-scaffold).
- **Provenance**: `scaffold_pairs_excluded` added to the JSON provenance object (read from the run, never a literal) and a matching row in the markdown provenance table.
- **New test** `tests/test-218-scaffold-pair-filter.cjs`: Leg 1 (scaffold-only room ranks empty, exit 0, `scaffold_pairs_excluded > 0`); Leg 2 (mixed room ranks non-empty, zero both-scaffold ranked pairs, at least one one-side pair survives).
- **Adapted two existing tests** the filter broke:
  - `test-218-cohort-stratification.cjs` Leg 2: added one non-scaffold `Claim` node wired CONVERGES to all three artifacts, keeping every node at uniform degree 3 so the `validated_demand === 0.5` no-op proof still holds while the surviving ranked pairs are one-side Claim-vs-artifact.
  - `test-218-noise-reduction.cjs`: reworked to the stronger invariant (empty pre, non-empty post with structural share EXACTLY 0); the entity write-path legs (proposed-only review_status, entity minting) are byte-unchanged.
- **`run-all-218.sh`**: new `scaffold-pair` leg wired in.

### Task 2 (no repo commit): live re-verification on the exact 72.0 percent substrate

Ran against the real `aion-eureka-synergy` room on the SAME `room.db.tier2-verified` bytes the hzx appendix measured (density-independence proof, not a fresh re-extract):

1. `room.db.bak-260715-0nj` backed up first.
2. `room.db.tier2-verified` restored over `room.db` (md5-confirmed identical: `9813d331...`).
3. `node scripts/eureka-command.cjs ~/MindrianRooms/aion-eureka-synergy run --no-extract` (live local embedding spine).
4. Structural share measured via the same `typeById` join over `room.db` the suite uses.

| Metric | Before (260714-hzx) | After (260715-0nj) |
|--------|---------------------|--------------------|
| Substrate | `room.db.tier2-verified` (46 company, 39 memory_artifact) | SAME (byte-identical) |
| Top-25 structural share | **72.0% (18/25)** | **0.0% (0/25)** |
| Ranked count | 25 | 25 (non-empty) |
| Pairs scored | (dense scaffold clique) | 2783 |
| `scaffold_pairs_excluded` | n/a | **741** |
| Run mode | live | live |

Top-5 ranked pairs after the fix are entity-involving (`Aion Research Gen` x `AION`, `AION Labs` x its source artifact, three more `AION*` company pairs); pair 2 is a one-side `company`-vs-`memory_artifact` pair, confirming the narrow filter leaves one-side pairs intact. No STOP-and-report condition tripped: the ranked list is non-empty, the share is at 0.0 percent, and no `portfolio-dimensions.cjs` scoring-math change was needed. Both backups (`room.db.bak-260715-0nj`, `room.db.tier2-verified`) remain in place; the room is coherent (restored db + fresh post-fix report agree).

### Task 3 (commit 90400da1): documentation trail

- **218-VERIFICATION.md**: new "Scaffold-pair filter appendix" with the navigator decision (exclude), the mechanism, and the real 72.0 percent -> 0.0 percent numbers on the identical substrate, cross-referencing the 260714-hzx tier-2 appendix and the dev-research trail.
- **CHANGELOG.md**: Unreleased Fixed entry in house style (Quick task 260715-0nj).
- **Research addendum**: appended to the existing entry in `rethinking-mindrianos/research/2026-07-14-eureka-ranking-bug-and-what-why-classifier/` and mirrored byte-identical to `~/MindrianOS/research/` (cmp: IDENTICAL). These live outside this repo and were auto-committed by the data-room hook, not part of the repo commit.

## Deviations from Plan

**1. [Rule 3 - blocking, resolved] `.planning/` is gitignored, verification doc force-added.** As the plan anticipated ("`.planning/` is gitignored, so the verification doc needs `git add -f`"), the initial `git add` of 218-VERIFICATION.md was rejected; used `git add -f` per the hzx precedent. CHANGELOG.md is tracked normally.

**2. [Documented finding, not a scope expansion] Pre-existing em-dashes in CHANGELOG.md.** The plan's Task 3 automated verify includes `! grep -P "\x{2014}" CHANGELOG.md`, which fails because of ~40 pre-existing em-dashes in historical release-note entries (lines 846-4228, all predating this task). My additions (the new Unreleased Fixed entry, the VERIFICATION appendix, and the research addendum) are all em-dash-clean, individually verified. Per the executor scope boundary, pre-existing out-of-scope content in unrelated historical lines was NOT modified. The `cmp` byte-identical gate and the `260715-0nj` reference-count gates pass.

**3. [Observation, no filter expansion] One-side pairs confirmed the right boundary.** On the live room the surviving top-5 includes a one-side `company`-vs-`memory_artifact` pair (a real entity paired with the artifact it was extracted from), which is exactly the signal the narrow scope preserves. No evidence emerged that one-side pairs need handling; the filter was NOT expanded.

## Verification

- `bash tests/run-all-218.sh`: Phase 218 PASS=16 FAIL=0, Phase 211 PASS=10 FAIL=0, offline.
- `git diff --exit-code` clean on all five out-of-scope modules: portfolio-dimensions.cjs, room-native-substrate.cjs, entity-extractor.cjs, entity-classifier.cjs, embedding-classifier.cjs.
- Live: top-25 structural share 0.0 percent (0/25) on the tier2-verified substrate that produced 72.0 percent, measured via the room.db typeById join, `scaffold_pairs_excluded: 741` in provenance, ranked non-empty.
- Docs: 218-VERIFICATION.md appendix + CHANGELOG Unreleased entry + research addendum byte-identical in both homes (cmp IDENTICAL).
- Two atomic repo commits (fix, docs); my additions em-dash-free.

## Self-Check: PASSED

- `scripts/eureka-portfolio-report.cjs`: FOUND
- `tests/test-218-scaffold-pair-filter.cjs`: FOUND
- 218-VERIFICATION.md scaffold-pair filter appendix: FOUND
- Commit `4e7201ef` (fix): FOUND
- Commit `90400da1` (docs): FOUND
- Research addendum both homes, byte-identical (cmp IDENTICAL): FOUND
- Live backup `room.db.bak-260715-0nj`: FOUND
