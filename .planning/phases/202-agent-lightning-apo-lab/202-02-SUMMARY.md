---
phase: 202-agent-lightning-apo-lab
plan: 02
subsystem: testing
tags: [apo, seed-002, path-a, reward-blend, prompt-optimization, lab, cjs, recommend-then-ratify]

# Dependency graph
requires:
  - phase: 202-01
    provides: "buildRewardTable(events) -> per-reach reward table (the telemetry scoring term)"
provides:
  - "lab/apo/prompt-target.cjs: loadTarget(path) -> { frontmatter, body, path } (byte-lossless frontmatter split) + renderCandidate(target, bodyVariant) -> string (frontmatter preserved byte-identical, body swapped)"
  - "lab/apo/apo-loop.cjs: scoreCandidate(candidate, ctx) -> number (quality-primary blend, telemetry gated on activation) + runApo(target, opts) -> { best, candidates, rounds, spanPath } (propose -> score -> select, recommend-then-ratify, never writes commands/act.md)"
  - "lab/apo/.gitignore: runs/ -- span data is never committed, never shipped (Part 8)"
affects: [202-03-plurai-eval-gate, apo, reward-signal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "byte-lossless-fence-split: retain the RAW frontmatter block verbatim (comments/arrays/nested maps intact) rather than decode-to-object; renderCandidate re-emits fences with original single-newline framing so round-trip is byte-identical"
    - "quality-primary-blend: score = qualityTerm + (activated ? TELEMETRY_WEIGHT * telemetryTerm : 0); TELEMETRY_WEIGHT (0.15) caps telemetry influence so a quality lead > 0.15 can never be overturned"
    - "quality-lexicographic-select: selectBest sorts by quality term first, blended score as tiebreak -- makes quality primacy STRUCTURAL, not just weight-tuned"
    - "recommend-then-ratify: runApo writes span data to a gitignored runs dir and RETURNS a recommended candidate object; it NEVER writes the shipped prompt (Path A)"

key-files:
  created:
    - lab/apo/prompt-target.cjs
    - lab/apo/apo-loop.cjs
    - lab/apo/.gitignore
    - tests/test-202-apo-loop.cjs
  modified: []

key-decisions:
  - "Frontmatter parser: took the minimal fence-split path (retaining the raw block) because both existing lib/ parsers (brain-md-staleness.cjs, feynman/timeline-runner.cjs) decode YAML to an object and re-serialize lossily -- neither can reproduce commands/act.md byte-identical (it has block comments, list values, a nested connector: map) -- D-202-02-A"
  - "Quality primacy is enforced TWO ways: (1) telemetry term bounded by TELEMETRY_WEIGHT 0.15 in scoreCandidate, (2) selectBest is quality-lexicographic -- so telemetry can only decide between equal-quality candidates -- D-202-2"
  - "Material gate (Task 3 Step 1) treated as pre-approved per navigator (D-202-1 no Python vendored, D-202-2 quality-primary blend, D-202-3 optimize commands/act.md only, Path A recommend-then-ratify); not re-asked"

patterns-established:
  - "byte-lossless-fence-split for any prompt-file load/render round-trip"
  - "quality-lexicographic-select for reward blends where a primary term must never be overturned by a secondary term"

requirements-completed: [SEED-002-PathA, D-202-1, D-202-2, D-202-3, CANON-Part8]

# Metrics
duration: ~25min
completed: 2026-07-01
---

# Phase 202 Plan 02: APO Loop Core (SEED-002 Path A) Summary

**The lab-side propose -> score -> select optimization loop over one target prompt (commands/act.md): frontmatter-preserving load/render, a quality-primary reward blend (grading corpus first, telemetry secondary and gated on >=100-event activation), and a recommend-then-ratify loop that writes gitignored span data and RETURNS a recommended candidate -- it never edits the shipped prompt.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (each RED then GREEN)
- **Files created:** 4
- **Test result:** 10/10 PASS, exit 0

## Accomplishments

- Built `loadTarget` / `renderCandidate` (`lab/apo/prompt-target.cjs`): a byte-lossless `---` fence split that retains the RAW frontmatter block, so `renderCandidate` swaps ONLY the body and reproduces `commands/act.md` byte-for-byte when handed back its own body (proven against the real file in test 3).
- Built `scoreCandidate` (`lab/apo/apo-loop.cjs`): the quality-primary reward blend. Quality (injected grading-corpus score) is the primary term; the telemetry reward term is derived from `buildRewardTable` (202-01), added ONLY when `ctx.telemetry.activated === true`, and bounded by `TELEMETRY_WEIGHT` (0.15). A candidate that scores far higher on telemetry but lower on quality does NOT auto-win (test 7).
- Built `runApo` (`lab/apo/apo-loop.cjs`): propose -> score -> select over bounded rounds. `proposeFn` is the injected agent callback; `best` is a recommended candidate OBJECT; span data (variants, scores, round records) is written to the gitignored `lab/apo/runs/` and `runApo` NEVER writes `commands/act.md` (asserted byte-identical, test 9). Selection is quality-lexicographic for a structural primacy guarantee.
- Added `lab/apo/.gitignore` (`runs/`) so span data is never committed, never shipped (Part 8); `git check-ignore` on a written span file succeeds (test 10).

## Task Commits

Strict TDD, 3 RED/GREEN pairs (6 commits), base `f793a500`:

1. **Task 1 RED** test for prompt-target load/render - `0377138b`
2. **Task 1 GREEN** APO prompt-target load/render - `e790eec5`
3. **Task 2 RED** test for reward-blend scoring - `3ce591a6`
4. **Task 2 GREEN** APO reward-blend scoring - `09cceb2a`
5. **Task 3 RED** test for APO loop core - `7c2ddbc5`
6. **Task 3 GREEN** APO loop core, recommend-then-ratify - `28eb77cc`

**Plan metadata:** docs commit (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lab/apo/prompt-target.cjs` - byte-lossless frontmatter load + candidate render
- `lab/apo/apo-loop.cjs` - `scoreCandidate` (reward blend) + `runApo` (propose/score/select, Path A)
- `lab/apo/.gitignore` - `runs/` (span data never committed)
- `tests/test-202-apo-loop.cjs` - 10 assertions across the 3 tasks

## Decisions Made

- **Frontmatter parser (REUSE_PART7):** searched lib/ first. Two parsers exist (`brain-md-staleness.cjs` `parseFrontmatter`, `feynman/timeline-runner.cjs` `parseFrontmatter`/`serializeFrontmatter`) but BOTH decode YAML into a JS object and re-serialize from it -- a lossy round-trip that drops comments, collapses arrays, and cannot reproduce a nested mapping. `commands/act.md` carries block comments, list values, and a nested `connector:` object, so a decode-to-object parser cannot render it byte-identical. The plan's hard requirement is byte-identical frontmatter preservation, so I took the "else a minimal fence split" branch of the reuse rule, retaining the raw block verbatim. Reported here as required.
- **Quality primacy (D-202-2), enforced twice:** `scoreCandidate` bounds the telemetry term by `TELEMETRY_WEIGHT` (0.15, the canon frozen signal weight), and `selectBest` is quality-lexicographic (quality primary key, blended score tiebreak). Telemetry can only decide between candidates of equal quality; it can never overturn a quality lead.
- **Telemetry term derivation:** the candidate's reach reward is looked up from `buildRewardTable(telemetry.events)` by `candidate.reachKey`, falling back to the n-weighted corpus mean, clamped to [0,1]. This is the sole consumer of the 202-01 reward table in the blend (the declared key-link).

## Deviations from Plan

- **RED/GREEN split into separate commits (6 total).** The plan tasks each specified write-test -> run-fail -> implement -> run-pass -> single commit; per the TDD mandate this ran as separate RED and GREEN commits for a gate-visible history, matching 202-01's pattern.
- **Frontmatter parser: minimal fence-split path over reuse** (see Decisions) -- the existing lib/ parsers are byte-lossy and cannot satisfy the byte-identical requirement.
- No auto-fixes (Rules 1-3) were required; no architectural decisions (Rule 4) arose.

## Material Gate

Task 3 Step 1 is a MATERIAL GATE. The navigator pre-approved all four decisions (D-202-1 no Python agent-lightning vendored; D-202-2 quality-primary blend with telemetry secondary/gated; D-202-3 optimize commands/act.md only; Path A recommend-then-ratify). The gate was treated as satisfied and NOT re-asked, per the pre-clearance directive.

## Issues Encountered

None. The working tree carried unrelated dirty changes (`.planning/seeds/*` reorganization, `config.json`, a 195-02 plan, untracked scripts) and a possible concurrent 201 session; all six task commits staged only explicit per-file paths, and every `git show --stat` plus a full-range scan confirmed zero `.planning/seeds/`, zero `commands/act.md`, and zero `201-*` contamination.

## User Setup Required

None - lab-side, offline, no external service configuration.

## Next Phase Readiness

- `runApo` produces a recommended `commands/act.md` candidate for human ratification; 202-03 (plurai-eval-gate) can gate that recommendation before a human promotes it into the plugin.
- The reward blend is grading-corpus-only today (telemetry below the >=100-event activation gate); the telemetry term switches on automatically once a real activated corpus exists.

## Self-Check: PASSED

- All 4 created files + this SUMMARY present on disk.
- All 6 task commits (`0377138b e790eec5 3ce591a6 09cceb2a 7c2ddbc5 28eb77cc`) exist in `f793a500..HEAD`.
- `node tests/test-202-apo-loop.cjs` = 10/10 PASS, exit 0.
- `commands/act.md` byte-unchanged; `git check-ignore lab/apo/runs/x.json` succeeds.
- Zero `.planning/seeds/` / `commands/act.md` / `201-*` contamination in any 202-02 commit; zero network/Brain imports; no em-dashes.

---
*Phase: 202-agent-lightning-apo-lab*
*Completed: 2026-07-01*
