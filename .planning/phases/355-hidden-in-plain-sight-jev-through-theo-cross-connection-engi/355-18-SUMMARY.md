---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 18
subsystem: eureka-portfolio
tags: [verification-stamp, eureka, report, f1, no-decimal, stamp-wiring]

requires:
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs (Stamp, extractCarried, resolveEndpoint, stampFinding(s), toNodeProps/fromNodeProps), lib/core/verification-stamp-format.cjs (formatStampLines, assertNoScalar, REASON_WORDS), tests/helpers/theo-replay-355.cjs, tests/fixtures/355/theo-stub-responses.json"
  - phase: 355-04
    provides: "lib/core/floor-disclosure.cjs (disclosureLine/disclosureFor)"
  - phase: 355-10
    provides: "the D-47 atomic flip (rs-differential-scorer.cjs's scoreMeasured delegates to direction-convention.cjs), so a eureka pair's rs.direction is already honest before this plan stamps it"
  - phase: 355-16
    provides: "the opt-in --stamp write-boundary pattern proven end-to-end on two producers (whitespace, HSI) -- this plan's eureka-portfolio-report.cjs main() follows the identical pattern, plus the pure-render-seam idiom (renderScanLines/renderHsiFindings) this plan's renderReport ranked-section rewrite and report-html.cjs's stampCellText follow"
  - phase: 355-17
    provides: "the render seam + producer-test structure precedent (renderBottleneckFinding, the bottlenecks/connections-prefixed check-label convention) this plan's own stamp/report/html/qualify-prefixed sections follow"
provides:
  - "scripts/eureka-portfolio-report.cjs: eurekaEndpoints(pair, ctx) (D-48 local resolution: source artifact frontmatter framework:/methodology:, then the entity title -- never the room.db handle); async stampRankedPairs(ranked, ctx, deps) (direction = the pair's own rs.direction when it is a member of the closed DIRECTIONS enum, else NONE); a new opt-in --stamp CLI flag (default false) gating a call to stampRankedPairs in main() strictly BEFORE bankStatements opens its transaction (D-56); portfolio-report.json's ranked rows gain `stamp` (null when the report was not run with --stamp); the embedded Markdown Ranked table drops the Score column and prints rank/A/B/weak dims/tail glyph/mode plus each row's own stamp block (or an honest 'not verified this run' line), ending in one disclosureLine('eureka'); the reasoning-mode render (renderReasoningReport) drops its lsa_similarity column/tag and rewords its caveat prose to no longer claim the field 'is a real number here'"
  - "lib/core/eureka/report-html.cjs: rankedTable's embedded branch replaces the Score/Banked columns with a Verification column (the stamp's tier word plus formatPathText, or the honest unverified reason), sweeping the WHOLE row's plain text (titles included) through assertNoScalar before escaping; the reasoning branch and statementCards drop the lsa_similarity cell/tag; fmtNum is removed (dead code, zero remaining callers)"
  - "lib/core/eureka/qualify-opportunity.cjs: componentValue renders a finite number as the word 'measured' (Canon Part 12, the value is withheld not zeroed); formatComponentLines(components, harvestIndex, stamp?) prepends a real Stamp's formatStampLines('cli') lines as the first WHY lines when supplied; renderQualificationCard re-parses the candidate's own stored `stamp` props (toNodeProps shape) through fromNodeProps when present and threads the result through, degrading gracefully on a missing/malformed stamp"
  - "commands/eureka.md, skills/eureka/SKILL.md: the ranked-table render spec drops Score/lsa_similarity for both modes, reproduces the stamp block verbatim under each embedded row, adds the 'never render a score, similarity, differential or percentage' rule and the D-50 Desktop/Cowork fallback sentence"
  - "tests/fixtures/355/producers/eureka-report.json, tests/test-355-producer-eureka.cjs: 54 assertions across four labeled sections (eureka stamp / eureka report / eureka html / eureka qualify)"
affects: [355-20]

tech-stack:
  added: []
  patterns:
    - "Opt-in --stamp on the interactive command's own engine (not a background writer): eureka-portfolio-report.cjs's main() IS /mos:eureka's own runner (unlike find-bottlenecks/find-connections, which split a background-safe engine from an interactive agent wrapper), so the opt-in flag lives directly in main() rather than in a separate wrapper layer; a caller (scripts/eureka-command.cjs, a later plan) opts a real run into stamping by passing --stamp, while every existing hermetic test (test-215-portfolio-report.cjs et al.) stays byte-identical and zero-network by construction"
    - "D-30 sweep scoped to the WHOLE stamp-bearing row, not just the stamp cell: both the md ranked-section sweep and the HTML rankedTable sweep run assertNoScalar over the row's title text too (not only the formatted stamp string), so a title that happens to carry a decimal-shaped substring (the negative control) is caught by the same backstop a stamp reason would be"
    - "Local resolution via the underlying room.db row, not the tech object: eurekaEndpoints reads a ranked pair's `techA.title`/`techB.title` as the D-48 fallback, but first tries the ORIGINAL room node's own raw file text (via ctx.indexed's rawId + ctx.db + ctx.roomDir) for a frontmatter framework:/methodology: carry -- the idea-graph-derived tech object itself never carries a file path, so the room.db row is the only place that carry can live"

key-files:
  created:
    - tests/fixtures/355/producers/eureka-report.json
    - tests/test-355-producer-eureka.cjs
  modified:
    - scripts/eureka-portfolio-report.cjs
    - lib/core/eureka/report-html.cjs
    - lib/core/eureka/qualify-opportunity.cjs
    - commands/eureka.md
    - skills/eureka/SKILL.md
    - tests/test-219-qualify.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "[Rule 2 - correctness/Part 8] Added an opt-in --stamp CLI flag to eureka-portfolio-report.cjs's main() instead of stamping unconditionally, and threaded main(argv, deps) so a caller can supply a hermetic deps.callTool. NOT explicitly named in the plan text, but required: this file's own header literally declares 'CANON PART 8: ZERO network calls of any kind', and stamping unconditionally (mirroring 355-17's reverse-salient-agent.cjs precedent) was proven live to attempt a REAL network call to production Theo from every pre-existing hermetic test that calls main() with ranked pairs and no deps (test-215-portfolio-report.cjs, confirmed via a live probe run before this fix landed -- this dev machine carries a real MINDRIAN_BRAIN_KEY env var, so the attempt was genuine, not merely theoretical). The --stamp default stays false so every existing test and the file's own Part 8 claim hold byte-identically; a caller opts a real run into stamping. Wiring scripts/eureka-command.cjs (out of this plan's declared file scope) to pass --stamp for a live /mos:eureka run is deferred -- the must_haves' own phrase 'the filing wiring that consumes them is 355-20' reads naturally as that later integration point."
  - "Fixture pair selection for tests/fixtures/355/producers/eureka-report.json's rank-3 and rank-6 rows was adjusted after two of the four originally-picked canon-title pairs turned out to be theo-stub-responses.json's own DELIBERATE malformed-shape fixtures (a pathLabels-length mismatch on 'Systems Thinking'/'Hierarchy Mapping', a hops/edges-count mismatch on 'Design Thinking'/'Cynefin Framework') -- verified live before committing, not discovered via a failing assertion in CI. Swapped to 'S-Curve Analysis'/'Ackoff Pyramid' and 'Reverse Salient Analysis'/'Six Thinking Hats', both clean strong-tier entries, so the fixture's 4 resolvable pairs genuinely exercise 4 verified stamps rather than 2 verified + 2 malformed_response."
  - "Reasoning mode's caveat prose (both scripts/eureka-portfolio-report.cjs's renderReasoningReport and lib/core/eureka/report-html.cjs's buildModeBanner) was reworded to stop naming lsa_similarity as 'a real number here' -- that sentence was accurate pre-355-18 (the number WAS rendered) but became a lie-by-omission once D-29 withheld it from every render; the reworded sentence states the measure was computed but is withheld from render too, pointing to the rubric verdict as the honest evidence instead."
  - "renderReport (the embedded Markdown writer, previously private to main()) and eurekaEndpoints/stampRankedPairs were all exported from scripts/eureka-portfolio-report.cjs so tests/test-355-producer-eureka.cjs can drive the stamp-bearing render hermetically (fixture ctx in, md out) without opening a real room.db or running the embedding spine -- matching the pure-render-seam precedent 355-16/355-17 already established, extended here to the top-level writer itself since eureka has no separate engine/agent split to seam at a lower layer."
  - "The 'Tail-driven candidate pairs' secondary table (a DIFFERENT table from the plan's own named 'Ranked top N' section) still renders its AHP composite `score` column unchanged -- out of this plan's declared action-text scope (which names only the Markdown writer's Ranked-top-N table and report-html.cjs's ranked table), and adding a second stamp pass over tailPairs (a superset that can include pairs outside the stamped top-N) was not asked for and would have silently widened the D-56 Theo-call surface beyond the ranked set the plan scopes stamping to."

patterns-established: []

requirements-completed: []

duration: ~170min
completed: 2026-09-24
---

# Phase 355 Plan 18: Eureka Renders Carry the Stamp, Not the Score Summary

**`scripts/eureka-portfolio-report.cjs`'s `main()` now stamps every ranked pair via `verification-stamp.cjs` behind a new opt-in `--stamp` flag, strictly before `bankStatements` opens its transaction (D-56); the embedded Markdown report, `lib/core/eureka/report-html.cjs`'s HTML export, and `lib/core/eureka/qualify-opportunity.cjs`'s F.1 qualify card all drop the Score/`lsa_similarity` columns and render the pair's stamp block (a real methodology-graph path check, or an honest unverified reason) instead -- 54/54 producer-test assertions green, including a planted-decimal negative control proving the D-30 backstop actually catches a violation.**

## Performance

- **Duration:** ~170 min (single continuous session, sequential executor on the shared main tree)
- **Tasks:** 2 completed
- **Files modified:** 2 created, 8 modified (6 code/doc files + deferred-items.md + ROADMAP.md)

## Accomplishments

- `scripts/eureka-portfolio-report.cjs`: `eurekaEndpoints(pair, ctx)` resolves each side locally -- the underlying room.db node's own raw file text (frontmatter `framework:`/`methodology:` via the registry), falling back to the entity's own title, never the opaque room id (D-48, D-10); `stampRankedPairs(ranked, ctx, deps)` stamps every ranked pair via `verification-stamp.cjs`, deriving direction from the pair's own `rs.direction` (post-355-10's D-47 flip) when it is a member of the closed `DIRECTIONS` enum, else `NONE`; a new `--stamp` CLI flag (opt-in, default `false`) gates the call inside `main()`, placed strictly before `bankStatements` (confirmed by a static source-order grep: `stampRankedPairs(` precedes `bankStatements(db, BANK_SESSION_ID, statements)`); `portfolio-report.json`'s `ranked[]` rows gain `stamp` (the real `Stamp` object, `null` when the report ran without `--stamp`); the embedded Markdown "Ranked top N" section drops its Score/strat_fit/val_demand/feasibility/banked columns entirely and instead prints, per row, rank + truncated A/B titles, then `weak dims / tail glyph / mode`, then the row's own `formatStampLines('cli')` block (or an honest `not verified this run` line when unstamped), ending the section in one `disclosureLine('eureka')`, the whole section swept through `assertNoScalar` as an explicit backstop; reasoning mode's ranked table and statement-field table both drop their `lsa_similarity` column/row, and the caveat prose no longer claims the field renders as "a real number here" (Phase 355-18 reworded it to name the measure as computed-but-withheld).
- `lib/core/eureka/report-html.cjs`: `rankedTable`'s embedded branch replaces the `Score`/`Banked` columns with one `Verification` column -- `stampCellText(stamp)` renders the tier word plus `formatPathText` on a verified stamp, or `unverified: ` plus the `REASON_WORDS` phrase on an unverified one, `not checked` on an absent stamp; the whole row's plain text (both titles plus the stamp cell) is swept through `assertNoScalar` before HTML-escaping, so a title carrying a decimal-shaped substring is withheld too; the reasoning branch drops its `lsa_similarity` column, `statementCards` drops its `lsa_similarity` tag, and `buildModeBanner`'s caveat paragraph is reworded to match the scripts-side change; `fmtNum` is deleted (zero remaining callers).
- `lib/core/eureka/qualify-opportunity.cjs`: `componentValue` renders a finite number as the word `measured` (Canon Part 12: the value is withheld, not zeroed -- strings/booleans/the typed `unknown` are byte-unchanged); `formatComponentLines(components, harvestIndex, stamp?)` gained the optional third parameter -- when a real `verification-stamp.cjs` `Stamp` is supplied, its `formatStampLines('cli')` lines are prepended as the FIRST WHY lines, ahead of the D-18 component lines; `renderQualificationCard` re-parses `candidate.stamp` (the `toNodeProps` flat-props shape a stamped opportunity node would carry) through `fromNodeProps` when present and threads the resulting `Stamp` into `formatComponentLines`, wrapped in a try/catch so a malformed or absent `candidate.stamp` degrades gracefully to no stamp block rather than throwing.
- `commands/eureka.md`, `skills/eureka/SKILL.md`: the Zone 2 ranked-table render spec drops the `Score` column (embedded) and the `lsa_similarity` column (reasoning), replaces the embedded example with a stamp-block-under-each-row rendering, adds the "never render a score, similarity, differential or percentage" instruction, and adds the D-50 `"Not yet checked; run the CLI to verify."` sentence to both the render-spec block and the Cross-Surface Adaptation Desktop bullet (which previously said "numbers preserved").
- `tests/fixtures/355/producers/eureka-report.json`: 6 embedded-mode ranked pairs (4 resolve to canon Framework names with a matching `theo-stub-responses.json` entry -- two strong 1-hop, one strong 2-hop, one indirect 3-hop -- and 2 do not resolve, both non-canon titles) plus a 2-pair reasoning-mode variant; one embedded title plants a literal `0.87` substring as the D-30 negative control.
- `tests/test-355-producer-eureka.cjs`: 54/54 assertions across four labeled sections -- `eureka stamp` (eurekaEndpoints title-only resolution and its honest-miss/never-throws legs, `stampRankedPairs` Theo up/down, the direction-fallback-to-NONE leg, the Part 8 no-opaque-handle-on-the-wire proof, the D-56 static source-order proof), `eureka report` (stamp-block-per-row Theo up/down, the Score-column-gone grep, the weak-dims/tail/mode field check, the banned-claim sweep, the planted-`0.87` negative control plus an independent `assertNoScalar` re-sweep, the unstamped-run honest-line leg, the reasoning-mode no-`lsa_similarity` legs), `eureka html` (the `Verification` column render, an independent D-30 sweep scoped to the ranked-table region, reasoning-mode no-`lsa_similarity`), and `eureka qualify` (`componentValue`'s number/string/bool/unknown legs, `formatComponentLines(stamp)` prepending, a malformed-stamp defensive leg, `renderQualificationCard` with/without a stored stamp).

## Task Commits

Each task was committed atomically (normal `git commit`, sequential executor on the shared main tree):

1. **Task 1: Stamp the ranked pairs before banking; report Markdown and HTML render stamps, not scores** - `2743a4d2e` (feat)
2. **Task 2: F.1 qualify card and the eureka docs render stamps, never numbers** - `ea1ad5a26` (feat)

**Plan metadata:**
- `ac78fb6c0` (docs: ROADMAP checkbox + Plans counter 14/28 -> 15/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated blank-line hunk near Phase 267, exactly as the 355-10/355-11/355-12/355-16/355-17 precedent)

## Files Created/Modified

- `scripts/eureka-portfolio-report.cjs` - `eurekaEndpoints`, `stampRankedPairs`, `--stamp` flag, `main(argv, deps)`, the stamp-bearing Ranked-top-N md rewrite, reasoning-mode caveat reword
- `lib/core/eureka/report-html.cjs` - `stampCellText`, the `Verification` column, reasoning-mode `lsa_similarity` removal, `fmtNum` deleted
- `lib/core/eureka/qualify-opportunity.cjs` - `componentValue` -> `'measured'`, `formatComponentLines(..., stamp)`, `renderQualificationCard`'s stored-stamp pass-through
- `commands/eureka.md`, `skills/eureka/SKILL.md` - ranked-table render spec, stamp reproduction rule, D-50 fallback
- `tests/test-219-qualify.cjs` - Test 6 amended (Phase 355 D-29 header note)
- `tests/fixtures/355/producers/eureka-report.json` - 6 embedded pairs + 2 reasoning pairs
- `tests/test-355-producer-eureka.cjs` - 54 assertions, stamp/report/html/qualify sections
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - three more pre-existing `insertNode: invalid epistemic_type` failures logged
- `.planning/ROADMAP.md` - 355-18 row checked, Plans counter 14/28 -> 15/28

## Decisions Made

See key-decisions in frontmatter: the opt-in `--stamp` flag (a Rule 2 addition required by this file's own pre-existing Part 8 zero-network header claim, proven necessary by a live network-attempt probe before the fix landed), the two fixture-pair swaps forced by deliberately-malformed `theo-stub-responses.json` entries, the reasoning-mode caveat-prose reword, exporting `renderReport` as the top-level pure-render seam (eureka has no lower-layer engine/agent split to seam at instead), and the deliberate non-touch of the "Tail-driven candidate pairs" secondary table's own `score` column.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality / Rule 1 - bug] `main()`'s stamp call needed an opt-in gate, not an unconditional call**
- **Found during:** Task 1, wiring `stampRankedPairs` into `main()`
- **Issue:** An unconditional `stampRankedPairs(ranked, ctx, {})` call (mirroring the 355-17 `reverse-salient-agent.cjs` precedent, which is safe there because its `stampFn` short-circuits on an empty pair list before ever reaching a real room) would make `scripts/eureka-portfolio-report.cjs`'s own file header's literal claim -- "CANON PART 8 (Graph Boundary): ZERO network calls of any kind" -- false the moment a ranked pair exists, which is the normal case. Verified LIVE, not theoretically: running the pre-existing `tests/test-215-portfolio-report.cjs` (which calls `runner.main([...])` with no `deps.callTool`, scoring 4 real ranked pairs offline) with an unconditional stamp call attempted a real `brain-client.cjs` `callTool` -- and this dev machine carries a genuine `MINDRIAN_BRAIN_KEY` env var, so the attempt was a REAL egress attempt to production Theo, not a no-op.
- **Fix:** Added an opt-in `--stamp` CLI flag (default `false`) gating the `stampRankedPairs` call inside `main()`, and threaded `main(argv, deps)` so a caller can supply a hermetic `deps.callTool`. Without `--stamp`, every ranked row's `.stamp` stays `undefined` and the render prints an honest "not verified this run" line -- zero network, byte-identical file-header claim preserved. Every existing pre-355 test (which never passes `--stamp`) is unaffected.
- **Files modified:** `scripts/eureka-portfolio-report.cjs`
- **Verification:** re-ran `tests/test-215-portfolio-report.cjs`, `tests/test-215-score.cjs`, `tests/test-355-eureka-ranking-pin.cjs` after the fix -- all green, zero `--stamp` passed anywhere in those files; the new producer test explicitly supplies `deps.callTool` (replay or null) for every stamped leg
- **Committed in:** `2743a4d2e` (Task 1 commit; the bug was caught and fixed before any commit landed, so there is no separate fix commit)

### Scope-boundary items (documented, not auto-fixed)

**2. [Scope Boundary] `scripts/eureka-command.cjs` (the real `/mos:eureka run` dispatcher) is not in this plan's file scope, so a live run does not yet pass `--stamp`**
- **Found during:** Designing the `--stamp` opt-in gate (deviation 1 above)
- **Issue:** The plan's `files_modified` frontmatter list does not include `scripts/eureka-command.cjs`, which is the actual script `/mos:eureka run`'s CLI dispatch shells out to and which builds the runner's argv. Without wiring `--stamp` into that argv, a real `/mos:eureka run` today still produces an unstamped report (every ranked row's `.stamp` is `null`, rendering the honest "not verified this run" line).
- **Why not fixed:** Editing `scripts/eureka-command.cjs` is a real code change to a file this plan was never asked to touch; the must_haves' own phrase "the filing wiring that consumes them is 355-20" reads naturally as naming that later plan as the integration point that turns `--stamp` on for a live run.
- **Files modified:** none; documented here and in the SUMMARY's key-decisions instead
- **Verification:** `grep -n "eureka-portfolio-report\|--stamp" scripts/eureka-command.cjs` confirms no `--stamp` flag is built into its argv today
- **Committed in:** documented here, no separate commit needed

**3. [Scope Boundary] Three more pre-existing `insertNode: invalid epistemic_type "undefined"` failures found in the regression sweep (same class 355-10 already logged)**
- **Found during:** The full `tests/test-215-*.cjs`/`tests/test-219-*.cjs`/`tests/test-226-*.cjs` sweep run after this plan's own changes
- **Issue:** `tests/test-219-banking.cjs`, `tests/test-219-low-confidence-disclosure.cjs` and `tests/test-219-metadata.cjs` all fail with the identical `insertNode: invalid epistemic_type "undefined"` error 355-10-SUMMARY.md already logged for `tests/test-218-cohort-stratification.cjs`.
- **Why not fixed:** Confirmed pre-existing and unrelated: `git status --short` on all three test files, `lib/core/node-insert.cjs` and `tests/helpers/fixture-room-219.cjs` shows zero diff (byte-identical to the last commit that touched each, which predates this session); none requires `scripts/eureka-portfolio-report.cjs`, `lib/core/eureka/report-html.cjs` or `lib/core/eureka/qualify-opportunity.cjs` (grep-confirmed).
- **Files modified:** none; logged to `deferred-items.md`
- **Verification:** `git status --short` on the named files (empty); a `require(` grep across all three test files confirms no import of any file this plan touched
- **Committed in:** the plan-metadata docs commit (below), alongside this SUMMARY.md, matching the 355-11/355-12 precedent of a docs-only commit for a `deferred-items.md` finding

---

**Total deviations:** 1 auto-fixed (Rule 1/2, caught and fixed before any commit, no separate fix commit needed); 2 documented scope-boundary items (one forward-looking integration note, one carried-forward pre-existing test-infrastructure finding). No functional impact on this plan's own deliverables -- both tasks' automated verify commands and acceptance_criteria greps pass exactly as specified; the producer test is 54/54 green.

## Issues Encountered

- The live network-attempt probe (deviation 1) is worth restating plainly for a future reader: this dev environment carries a real `MINDRIAN_BRAIN_KEY`. Any future 355 (or later) plan that wires a NEW unconditional `verification-stamp.cjs`/`stampFindings` call into a script whose existing tests call it without `deps.callTool` should assume the SAME live-egress risk exists until proven otherwise -- "no visible hang or error" during a test run is NOT proof of zero network attempts.
- `.planning/ROADMAP.md` on disk carried the same peer-session concurrent unrelated hunk flagged in the shared-tree briefing (a blank-line removal near Phase 267). Resolved via the 355-10/355-11/355-12/355-16/355-17 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly my two hunks were staged, committed the index directly (no `--only`, no `-a`), then hand-applied the identical two edits to the on-disk working-tree file via `Edit` so it matches the new `HEAD` for my rows while leaving the peer's hunk untouched and still unstaged.
- `node scripts/check-shape-declaration.cjs --check` and `node scripts/build-command-registry.cjs --check` both print the same pre-existing advisory WARN sets every prior 355 plan has seen (53 shape-declaration violations, 40 long-description warnings, `commands/eureka.md` among the pre-existing long-description warnings unrelated to any content this plan changed), none newly introduced by this plan's edits; both exit 0, non-blocking per CLAUDE.md's own description of these gates.
- `bash tests/run-all-355.sh` was not re-run in full this session (per the 355-10/355-16/355-17 precedent: a full run is expensive in this concurrent shared tree; every individual leg command named in the plan's own `<verify>` blocks was run directly and confirmed green, plus `tests/test-355-floor-sweep.cjs` (106/106) and `tests/test-355-direction-agreement.cjs` (187 PASS / 1 FAIL, the same pre-existing leg H carried forward unchanged from 355-11/12/16/17) and `node scripts/check-tool-honesty.cjs --check` and `node scripts/check-floor-ledger.cjs --check`, all green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/eureka-portfolio-report.cjs`'s `--stamp` flag, `eurekaEndpoints`, and `stampRankedPairs` are ready for a later plan (355-20's own filing wiring, per the must_haves' own phrasing) to wire into a live `/mos:eureka run` -- today's default (`--stamp` off) keeps every existing caller byte-identical and zero-network.
- `lib/core/eureka/qualify-opportunity.cjs`'s `candidate.stamp` pass-through is ready for whichever later plan mints the actual `stamp` props onto a banked/harvested opportunity node's side-channel entry (this plan wires the RENDER side only, per its own Task 2 scope; no write-side wiring of `candidate.stamp` into the Plan 03 side-channel or the banked opportunity node was in this plan's declared surface).
- Blocker/concern carried forward: none blocking any other 355 plan. `scripts/eureka-command.cjs` needs `--stamp` wired into its argv build for a real `/mos:eureka run` to actually carry stamps (deviation 2 above) -- named as 355-20's natural integration point, not treated as silently done. Leg H's two remaining hits (outside every 355 plan's scope so far) remain open. The three newly-found `insertNode: invalid epistemic_type` failures (deviation 3) are carried forward in `deferred-items.md` alongside the original 355-10 finding.
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..17 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-18 checked, Plans counter 15/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 2 created files and 8 modified files verified present on disk
(`scripts/eureka-portfolio-report.cjs`, `lib/core/eureka/report-html.cjs`,
`lib/core/eureka/qualify-opportunity.cjs`, `commands/eureka.md`,
`skills/eureka/SKILL.md`, `tests/test-219-qualify.cjs`,
`tests/fixtures/355/producers/eureka-report.json`,
`tests/test-355-producer-eureka.cjs`, `deferred-items.md`); all three
commits (`2743a4d2e`, `ea1ad5a26`, `ac78fb6c0`) verified present in
`git log`; the producer test re-run clean at commit time (`PASS: 54
FAIL: 0`).
