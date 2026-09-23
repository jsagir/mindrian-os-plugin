---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 16
subsystem: whitespace-hsi-producers
tags: [verification-stamp, whitespace, hsi, no-decimal, output-layer, floor-disclosure]

requires:
  - phase: 355-04
    provides: "data/floor-ledger.json, lib/core/floor-disclosure.cjs (disclosureLine/disclosureFor)"
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs (Stamp, extractCarried, resolveEndpoint, stampFinding(s), toNodeProps/fromNodeProps), lib/core/verification-stamp-format.cjs (formatStampLines, assertNoScalar), tests/helpers/theo-replay-355.cjs, tests/fixtures/355/theo-stub-responses.json"
  - phase: 355-09
    provides: "lib/core/direction-convention.cjs's classify()/NONE/NONE_MEANING wired into hsi-to-graph.cjs's existing surprise_type write"
  - phase: 355-11
    provides: "scout.md/SKILL.md's step 2/3 shape, scout-cadence-runner.cjs's whitespace-to-graph background call site"
  - phase: 355-12
    provides: "hsi-to-graph.cjs's D-07 surprise_type re-derivation (this plan builds the --stamp write next to it, not in place of it)"
provides:
  - "scripts/whitespace-command.cjs: pure render seams whitespaceEndpoints(finding, kind, ctx), renderScanLines(gaps, stamps), renderAnalyzeLines(zone, stamp, rank, total), renderNoveltyLines(scores, stamps); map/analyze/score subcommands now async, await stampFindings before printing; every rendered decimal replaced by a sparsity rank (map/analyze) or a novel/moderate/covered band word (score); require.main guarded, seams exported"
  - "scripts/whitespace-to-graph.cjs: --stamp flag; main(argv, deps) exported; resolves each gap's zone endpoints via whitespace-command.cjs's whitespaceEndpoints, awaits stampFindings BEFORE any BEGIN, merges toNodeProps(stamp) into the SAME addWhitespaceZone write; byte-identical without --stamp"
  - "scripts/hsi-to-graph.cjs: --stamp and --top <n> (default 10); main(argv, deps)/renderHsiFindings/hsiEndpoints exported; chooses the shown set (top-n by hsi_score, no new threshold), resolves each end's carried name LOCALLY from the artifact's own file, awaits stampFindings before the MOAT-01 BEGIN, merges toNodeProps(stamp) into the SAME HSI_CONNECTION write for shown pairs only, prints the stamped render to stdout after COMMIT; byte-identical without --stamp"
  - "lib/core/lazygraph-ops.cjs: addWhitespaceZone optionally merges an attached verification-stamp.cjs toNodeProps() shape onto the SAME WhitespaceZone write (Rule 2 addition, not in the plan's own files_modified, required to satisfy D-16's literal 'same write' constraint)"
  - "tests/fixtures/355/producers/whitespace-gaps.json, tests/fixtures/355/producers/whitespace-novelty.json: producer fixtures"
  - "tests/test-355-producer-whitespace-hsi.cjs: 58 assertions across whitespace (scan/analyze/score, replay+null, a planted-decimal negative control, the whitespace-to-graph --stamp node-prop leg) and hsi (a mkdtemp 272-room-plus-synthetic-canon-artifacts leg, replay+null, shown/non-shown edge-prop proofs)"
affects: [355-20, 355-23]

tech-stack:
  added: []
  patterns:
    - "Pure render seam + async subcommand: a subcommand resolves endpoints and awaits stampFindings, then hands (data, stamps) to a pure function that returns a line array; console.log(line) is the only I/O left in the subcommand itself, so the seam is testable without any file I/O or process spawn"
    - "D-30 backstop pass: every render seam's final return routes through verificationStampFormat.assertNoScalar(lines).lines, sweeping the WHOLE captured render (not only the stamp block) for a bare decimal or percent token before it ever reaches stdout"
    - "Opt-in --stamp on a graph writer: parse main(argv, deps), resolve+stamp BEFORE any BEGIN, merge toNodeProps(stamp) into the SAME existing write call, print the stamped render only AFTER COMMIT; without the flag every code path that reads the stamp map is a no-op, so a background caller (scout-cadence-runner.cjs, the cascade) stays byte-identical and Theo-free"
    - "Local title resolution for a Theo endpoint: hsiEndpoints reads the artifact's own file (frontmatter framework:/methodology:, else its first # heading, else the raw artifact id) and resolves through the closed local snapshot -- never asks Theo to resolve a name, never scans room body text beyond the one frontmatter block"

key-files:
  created:
    - tests/fixtures/355/producers/whitespace-gaps.json
    - tests/fixtures/355/producers/whitespace-novelty.json
    - tests/test-355-producer-whitespace-hsi.cjs
  modified:
    - scripts/whitespace-command.cjs
    - scripts/whitespace-to-graph.cjs
    - scripts/hsi-to-graph.cjs
    - lib/core/lazygraph-ops.cjs
    - commands/whitespace.md
    - skills/whitespace/SKILL.md
    - commands/scout.md
    - skills/scout/SKILL.md

key-decisions:
  - "lib/core/lazygraph-ops.cjs's addWhitespaceZone gained a small optional stamp-prop merge (Rule 2, missing critical functionality): D-16 requires the stamp to ride the SAME WhitespaceZone write, but addWhitespaceZone builds its `props` JSON from a fixed field whitelist that silently drops any extra key. Extending it to merge a closed, named set of stamp keys (verification/backend/direction/judge/path/path_labels/path_edges/path_len/reason) WHEN present on the caller's zone object is additive and backward-compatible: every pre-355 caller's zone object never carries these keys, so the merge loop is a no-op for them, confirmed by the whitespace-to-graph (no --stamp) test leg asserting zero zones carry a `verification` property. Not in this plan's own frontmatter files_modified list; added anyway since D-16's own must_haves truth ('the Part 9 cleanup of those writers is NOT widened here; no new raw INSERT line is added') is satisfiable only by extending the one existing writer's own field set, not by adding a second writer"
  - "whitespace-to-graph.cjs's zone endpoints reuse whitespace-command.cjs's exported whitespaceEndpoints with nearest_frameworks := the zone's own interpretation-enriched framework_chain (falling back to [brain_framework] when the chain is empty) -- the property this script already names `nearest_frameworks` on the written node (D-49's own vocabulary), rather than inventing a second endpoint-selection rule for the same concept across two scripts"
  - "hsi-to-graph.cjs's hsiEndpoints duplicates a one-line #-heading regex (not require()d from lib/core/artifact-id.cjs, whose extractTitle is not exported and D-55 forbids requiring scripts/ from lib/ in the other direction) rather than widening artifact-id.cjs's exports for a single caller outside this plan's declared file scope"
  - "The 272 fixture room's own artifacts carry no frontmatter and non-canon titles, so every real-content HSI pair in the Task 3 test resolves not_called by design (an honest, correctly-degraded outcome, not a bug); two synthetic canon-framework artifacts were added under a mkdtemp-only synthetic-355/ subdirectory (never committed to the fixture tree) so at least one pair exercises the full Theo-up/Theo-down contrast the plan's must_haves ask for"
  - "cmdExternal's paper-relevance decimal (out of the D-29 truth's named scope, but caught by the file-wide toFixed( acceptance grep) renders as a rank within the shown top 3 rather than a stamp: it is a literature match against Semantic Scholar, not a framework-pair Theo finding, so no verification stamp applies to it"
  - "Neither commands/whitespace.md nor skills/whitespace/SKILL.md invokes whitespace-to-graph.cjs interactively (confirmed by repo-wide grep: its only caller is scripts/scout-cadence-runner.cjs's SCHED-02 background step) -- the plan's 'where these docs invoke whitespace-to-graph interactively add --stamp' instruction has no call site to touch in either doc; documented here rather than silently treated as done"

patterns-established:
  - "Two-file render-seam split, one file requiring the other: scripts/whitespace-to-graph.cjs requires scripts/whitespace-command.cjs (guarded under require.main === module so requiring it never fires the CLI dispatcher) to reuse whitespaceEndpoints rather than duplicating the D-48/D-49 resolution rule a second time"

requirements-completed: []

duration: ~150min
completed: 2026-09-24
---

# Phase 355 Plan 16: Whitespace and HSI Producers Stamped at the Output Layer Summary

**`scripts/whitespace-command.cjs`'s map/analyze/score subcommands and `scripts/whitespace-to-graph.cjs`/`scripts/hsi-to-graph.cjs`'s opt-in `--stamp` write path now call `lib/core/verification-stamp.cjs` once per distinct framework pair before rendering or writing anything, replace every density/novelty/relevance decimal with a sparsity rank or a band word, print a `formatStampLines` block per finding ending in `disclosureLine`, and merge the stamp onto the SAME existing graph write (no new writer) -- all Theo-free unless a human runs the CLI or `--stamp`.**

## Performance

- **Duration:** ~150 min (single continuous session, sequential executor on the shared main tree)
- **Tasks:** 3 completed
- **Files modified:** 3 created, 8 modified

## Accomplishments

- `scripts/whitespace-command.cjs`: four pure exported seams (`whitespaceEndpoints`, `renderScanLines`, `renderAnalyzeLines`, `renderNoveltyLines`); `map`/`analyze`/`score` are now `async`, resolving endpoints locally then awaiting `stampFindings` before any line prints; the map density column/footer and the analyze Density line both become a sparsity rank (an integer, no new threshold); the score novelty column/footer and the `Novel (>0.8)`/`Covered (<0.4)` label text both become the band word (`novel`/`moderate`/`covered`) from the unchanged 0.8/0.4 comparison; `cmdExternal`'s relevance decimal becomes a shown-rank word (out of D-29's named scope but caught by the file-wide `toFixed(` grep); `main()` guarded under `require.main === module` so `whitespace-to-graph.cjs` can safely `require()` the seam
- `scripts/whitespace-to-graph.cjs`: `--stamp`; resolves each gap's zone endpoints (`nearest_frameworks := framework_chain`, falling back to `[brain_framework]`), awaits `stampFindings` before any `openGraph`/write, merges `toNodeProps(stamp)` into the SAME `addWhitespaceZone` call; `main(argv, deps)` exported; without `--stamp` byte-identical (proved by a dedicated test leg asserting zero zones carry a `verification` property)
- `scripts/hsi-to-graph.cjs`: `--stamp` and `--top <n>` (default 10); the shown set is the top-n pairs by the existing `hsi_score` order; `hsiEndpoints` resolves each side's carried name from the artifact's own file (frontmatter, else its first heading, else the raw id); `stampFindings` runs BEFORE the MOAT-01 `BEGIN` (confirmed: the `stampFindings` call textually precedes the first `BEGIN`); `toNodeProps(stamp)` merges into the shown pairs' `HSI_CONNECTION` edge properties in the SAME write; the stamped render prints to stdout only after `COMMIT`, ending in `disclosureLine('hsi')`; `main`/`renderHsiFindings`/`hsiEndpoints` exported
- `lib/core/lazygraph-ops.cjs`: `addWhitespaceZone` gained a small, additive, optional merge of a closed stamp-key set onto its existing `props` object -- a Rule 2 addition (see Deviations) required for D-16's "same write, no new writer" constraint to be literally satisfiable
- `commands/whitespace.md`/`skills/whitespace/SKILL.md`: map/analyze/score render rules updated for the rank/band-word text, the stamp-block-plus-disclosure reproduction instruction, and the D-50 `"Not yet checked; run the CLI to verify."` Desktop/Cowork fallback (3 occurrences each)
- `commands/scout.md`/`skills/scout/SKILL.md`: step 3's `hsi-to-graph.cjs` invocation gained `--stamp`; the Report list now tells Larry to reproduce the stamped lines and disclosure line verbatim, never a number, with the same D-50 fallback
- `tests/test-355-producer-whitespace-hsi.cjs`: 58/58 assertions -- whitespace scan/analyze/score legs (replay and null callTools, rows==findings==stamp-blocks, `NONE_MEANING` direction, disclosure-last, no-decimal/percent, a planted-`0.87`-in-a-zone_id negative control that proves the D-30 backstop actually catches a violation), the `whitespace-to-graph --stamp` node-prop leg (`fromNodeProps` re-parse, with vs. without `--stamp`), and the HSI leg (a mkdtemp copy of `tests/fixtures/272/room` plus two synthetic canon-framework artifacts, replay and null, shown-vs-non-shown edge-prop proofs)

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: whitespace-command render seams, stamps, band words, disclosure; the producer test** - `20e82f208` (feat)
2. **Task 2: whitespace-to-graph --stamp and the whitespace docs (Tri-Polar)** - `e05c03a9a` (feat)
3. **Task 3: hsi-to-graph --stamp prints stamped HSI findings; scout docs pass --stamp** - `9851ff5ae` (feat)

**Plan metadata:**
- `73a5d5d79` (docs: ROADMAP checkbox + Plans counter 12/28 -> 13/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated whitespace hunk near Phase 267, exactly as the 355-10/355-11/355-12 precedent)

## Files Created/Modified

- `scripts/whitespace-command.cjs` - render seams, async subcommands, no decimals
- `scripts/whitespace-to-graph.cjs` - `--stamp`, `main(argv, deps)` exported
- `scripts/hsi-to-graph.cjs` - `--stamp`/`--top`, `hsiEndpoints`/`renderHsiFindings` exported
- `lib/core/lazygraph-ops.cjs` - `addWhitespaceZone`'s optional stamp-prop merge
- `commands/whitespace.md`, `skills/whitespace/SKILL.md` - rank/band-word render rules, stamp reproduction, D-50 fallback
- `commands/scout.md`, `skills/scout/SKILL.md` - `--stamp` on the hsi-to-graph invocation, Report list update
- `tests/fixtures/355/producers/whitespace-gaps.json` - 5 zones (3 resolvable, 1 unresolvable, 1 single-name degenerate)
- `tests/fixtures/355/producers/whitespace-novelty.json` - 6 rows across all three D-29 bands
- `tests/test-355-producer-whitespace-hsi.cjs` - 58 assertions, whitespace + hsi sections

## Decisions Made

See key-decisions in frontmatter: the `lazygraph-ops.cjs` Rule 2 addition, the `nearest_frameworks := framework_chain` endpoint choice for `whitespace-to-graph.cjs`, the local `#`-heading duplication in `hsi-to-graph.cjs` over widening `artifact-id.cjs`'s exports, the synthetic-artifact test-room design (272's own content resolves not_called by design), `cmdExternal`'s rank-not-stamp treatment, and the finding that neither whitespace doc has an interactive `whitespace-to-graph.cjs` call site to add `--stamp` to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality] `lib/core/lazygraph-ops.cjs`'s `addWhitespaceZone` needed an optional stamp-prop merge**
- **Found during:** Task 2, implementing `whitespace-to-graph.cjs`'s `--stamp` write path
- **Issue:** D-16 requires "merge `toNodeProps(stamp)` into each `WhitespaceZone`'s existing properties through the SAME `lazygraph-ops` call" -- but `addWhitespaceZone(conn, zone)` builds its written `props` JSON from a fixed field whitelist (`brain_framework`, `density_score`, ... `created`), silently dropping any other key on the `zone` object passed in. Without a change here, a stamp attached to the zone object never reaches the write at all, and D-16's own "no new writer, no raw SQL" constraint rules out writing the stamp through a second `insertNode`/`INSERT` call.
- **Fix:** Added a closed, named 9-key stamp-field merge loop (`verification`, `backend`, `direction`, `judge`, `path`, `path_labels`, `path_edges`, `path_len`, `reason`) that only copies a key onto the written `props` object when the caller's `zone` object actually carries it. Every pre-355 caller (the two `whitespace-to-graph.cjs` call sites that pass no stamp keys, and any future caller that never attaches one) is byte-identical.
- **Files modified:** `lib/core/lazygraph-ops.cjs`
- **Verification:** `tests/test-355-producer-whitespace-hsi.cjs`'s "whitespace-to-graph (no --stamp)" leg asserts zero zones carry a `verification` property; the "--stamp" leg asserts both written zones re-parse cleanly through `fromNodeProps`
- **Committed in:** `e05c03a9a` (Task 2 commit)

### Scope-boundary items (documented, not auto-fixed)

**2. [Documented, not a deviation from a tested contract] Neither whitespace doc has an interactive `whitespace-to-graph.cjs` call site**
- **Found during:** Task 2's own action-text instruction "where these docs invoke whitespace-to-graph interactively add --stamp"
- **Issue:** A repo-wide grep for `whitespace-to-graph` across `.cjs`/`.md` confirms its only live caller is `scripts/scout-cadence-runner.cjs`'s SCHED-02 background step; neither `commands/whitespace.md` nor `skills/whitespace/SKILL.md` invokes it at all (map/analyze/score all call `whitespace-command.cjs` directly, which never shells out to `whitespace-to-graph.cjs`).
- **Why not fixed:** There is nothing to add `--stamp` to; inventing a new interactive call site in either doc would be a real behavior change (a new invocation this plan was not asked to add) rather than following the plan's literal instruction, which presupposes an existing call site.
- **Files modified:** none beyond the eight planned
- **Verification:** `grep -rn "whitespace-to-graph" --include=*.cjs --include=*.md .` (excluding CHANGELOG/docs/tests) shows exactly one live caller, `scripts/scout-cadence-runner.cjs`
- **Committed in:** documented in this SUMMARY, no separate commit needed

---

**Total deviations:** 1 auto-fixed Rule 2 addition (small, additive, backward-compatible, verified by a dedicated no-op test leg); 1 documented scope finding (no functional impact -- the instruction's precondition does not hold).
**Impact on plan:** None on any stated acceptance criterion -- all three tasks' automated verify commands and acceptance_criteria greps pass exactly as specified; the producer test is 58/58 green; the floor sweep, direction-readers, reverse-salient-telemetry, registry/shape/substrate gates all exit 0.

## Issues Encountered

- `git commit -m "..." --only -- <paths>` required the `-m` flag before `--only -- <paths>` (same ordering issue 355-11 logged) -- corrected on the first attempt this session, no retry needed.
- `.planning/ROADMAP.md` on disk carried the same peer-session concurrent unrelated whitespace hunk near Phase 267 flagged in the shared-tree briefing (a blank-line removal plus the 267 re-scope paragraph). Resolved via the 355-10/355-11/355-12 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly my two hunks were staged, committed the index directly (no `--only`, no `-a`), and confirmed via `git diff` after committing that the peer's hunk remains unstaged and untouched on disk.
- The real `tests/fixtures/272/room/.hsi-results.json` fixture's every `hsi_score` sits below the pre-existing `hsi-to-graph.cjs` `<= 0.3` write floor (max observed 0.1444), so a literal "mkdtemp copy of the 272 room, run as-is" would write zero `HSI_CONNECTION` edges and give the HSI test leg nothing to assert against for the D-16 node-prop proof. Resolved by copying the 272 room for its real artifact/section structure (satisfying the plan's own instruction) but writing a fresh, synthetic `.hsi-results.json` into the copy with three pairs whose scores clear the existing floor (two real 272 artifacts referenced by id for the "resolves to nothing" leg, two new synthetic canon-framework artifacts under a mkdtemp-only `synthetic-355/` subdirectory for the "resolves and verifies" leg) -- the pre-existing `<= 0.3` floor itself was not touched or worked around, only fed data that clears it.
- `node scripts/check-shape-declaration.cjs --check` prints the same 53 pre-existing WARN-level advisories every prior 355 plan has seen (none naming a file this plan touched); exit code 0, non-blocking per CLAUDE.md's own description of the gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/whitespace-command.cjs`'s `whitespaceEndpoints`/render seams and `lib/core/verification-stamp.cjs`'s adapter are proven end-to-end against two full producers now (whitespace, HSI); 355-17 (find-bottlenecks/find-connections) and 355-18 (eureka) can follow the exact same pattern: resolve locally, await `stampFindings` once before any print/write, merge `toNodeProps` into the existing writer, append `formatStampLines` + `disclosureLine` to every render.
- `lib/core/lazygraph-ops.cjs`'s `addWhitespaceZone` stamp-prop merge is a reusable precedent: any future writer that needs to ride an EXISTING `insertNode`-backed call with an optional stamp can follow the same closed-key, presence-gated merge idiom rather than adding a second writer.
- Neither `commands/whitespace.md` nor `skills/whitespace/SKILL.md` has an interactive path to `whitespace-to-graph.cjs`; if a later plan adds one (e.g. wiring `cmdMap` to persist zones into the graph interactively), it should pass `--stamp` at that call site per this plan's own precedent in `commands/scout.md`.
- `data/floor-ledger.json` needed no new row or anchor update: the pre-existing `whitespace-command.novelty-bands` anchor already covers the surviving `>= 0.8`/`>= 0.4` comparisons after the label-text removal; `node scripts/check-floor-ledger.cjs --check` confirms 0 unresolved hits.
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..14 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-16 checked, Plans counter 13/28) is the durable progress record instead.
- Blocker/concern carried forward: none blocking any other 355 plan. HIPS-04/HIPS-05 remain unregistered in `.planning/REQUIREMENTS.md` by design (355-27 registers and closes the whole HIPS family at phase close-out, per the 355-06 precedent already recorded there).

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 3 created files and 8 modified files verified present on disk
(`tests/fixtures/355/producers/whitespace-gaps.json`,
`tests/fixtures/355/producers/whitespace-novelty.json`,
`tests/test-355-producer-whitespace-hsi.cjs`, `scripts/whitespace-command.cjs`,
`scripts/whitespace-to-graph.cjs`, `scripts/hsi-to-graph.cjs`,
`lib/core/lazygraph-ops.cjs`, `commands/whitespace.md`,
`skills/whitespace/SKILL.md`, `commands/scout.md`, `skills/scout/SKILL.md`);
all four commits (`20e82f208`, `e05c03a9a`, `9851ff5ae`, `73a5d5d79`)
verified present in `git log`.
