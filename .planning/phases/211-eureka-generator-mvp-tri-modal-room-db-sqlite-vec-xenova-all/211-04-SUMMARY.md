---
phase: 211-eureka-generator-mvp
plan: 04
subsystem: testing
tags: [eval, gold-set, gray-matter, compression-metric, salient-verifier, plurai, seed-050]

# Dependency graph
requires:
  - phase: 211 (SEED-050)
    provides: the critic gold-set spec (6 case cards, COMPRESSION formula, two-gate rule)
provides:
  - evals/eureka/ gold-set directory (README schema + formula + two-gate rule)
  - 6 pseudonymous schema-valid case cards (archimedes-uq/-sterling/-darkmatter, davinci-salient, nichefoods-null, lovelace-lean)
  - tests/test-211-case-cards.cjs (gray-matter schema-drift guard + hash-based no-real-names deny-list)
  - evals/eureka/211-manual-baseline.md (honest deferral record; hand-scoring pending navigator)
affects: [212 grounding-guard, 213 eureka-reach-wiring, 214 find-analogies-online-leg, 202 apo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "eval gold cards = Markdown + YAML frontmatter parsed by gray-matter (house stack), prose body = manual Larry scenario script"
    - "no-real-names enforced mechanically via sha256(lowercased token) deny-list, empty by design so real names never enter the repo"
    - "human gold labels are hand-scored only; model self-scoring is forbidden (baseline-contamination guard, SEED-050)"

key-files:
  created:
    - evals/eureka/README.md
    - evals/eureka/cases/archimedes-uq.md
    - evals/eureka/cases/archimedes-sterling.md
    - evals/eureka/cases/archimedes-darkmatter.md
    - evals/eureka/cases/davinci-salient.md
    - evals/eureka/cases/nichefoods-null.md
    - evals/eureka/cases/lovelace-lean.md
    - evals/eureka/211-manual-baseline.md
    - tests/test-211-case-cards.cjs
  modified: []

key-decisions:
  - "Authored cards from SEED-050 + the plan's Naming-and-content-sources section + CONTEXT.md D8 + ROADMAP, because the referenced research file (2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md) is absent from the worktree"
  - "distractors modeled as a list of {label, text} objects for testability; darkmatter carries both restatement (the #1 false positive) and pseudoscience distractors"
  - "All 6 cards ship validated:candidate; none flip to true until the navigator confirms at the Task 3 checkpoint"
  - "Task 3 (run Larry + hand-score) STOPPED cleanly as a blocking human-verify checkpoint; recorded an honest deferral, no fabricated scores"

patterns-established:
  - "COMPRESSION formula: Score = CompressionDelta(hypothesis_in -> destination) x GuardGate x StatusQuoGate; Lured negative; arrival-without-compression ~0"
  - "two-gate validation: Gate A objective (lean_checkable) calibrates the judge first, Gate B human confirms every non-Lean case"

requirements-completed: []  # R211-GOLDSET is NOT fully complete: hand-scored baseline pending navigator (Task 3 checkpoint)

# Metrics
duration: ~10min
completed: 2026-07-05
---

# Phase 211 Plan 04: Eureka critic gold-set Summary

**Six pseudonymous, schema-valid COMPRESSION gold cards + the documented formula, two-gate rule, and a gray-matter schema-drift test; the run-Larry-and-hand-score baseline is authored-ready and cleanly deferred to the navigator (blocking human checkpoint).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-05T20:26:18Z
- **Completed:** 2026-07-05T20:36:00Z
- **Tasks:** 2 of 3 executed autonomously; Task 3 is a blocking human-verify checkpoint (deferred by design)
- **Files created:** 9

## Accomplishments

- `evals/eureka/README.md` freezes the card schema, the COMPRESSION formula (spelled correctly as `... x GuardGate x StatusQuoGate`), the salient-verifier label set (transferable / general_shallow / pseudoscience / restatement), the two-gate validation rule (Gate A objective / Gate B human), the hand-scoring rubric, and the no-real-names HARD RULE.
- Six pseudonymous gold cards, each schema-complete with a human-validated destination and `human_baseline_effort`, and a prose scenario script for running Larry manually:
  - `archimedes-uq` - clean positive (compression on a percolating UQ hypothesis).
  - `archimedes-sterling` - Lean-checkable forced_context control (Gate A); body notes the `archimedes-formal` content source and the canonical rename.
  - `archimedes-darkmatter` - Type-3 find-analogies GOLD, seeded on the abstracted `rare-signal-in-vast-background` pattern (a PART, never the whole doc), with the restatement paraphrase distractor (the #1 false positive) plus a pseudoscience drift distractor.
  - `davinci-salient` - the transfer case, no objective critic (Gate B only), the salient-verifier guards the persona's seductive-pairing temptation directly.
  - `nichefoods-null` - the `posture: solve` NULL-CONTROL encoding arrival WITHOUT compression (`compressed: no`, `null_control: true`) so the judge can never conflate confirmation with compression.
  - `lovelace-lean` - the math case authored fresh (Gate A), destination = a strong-induction restatement checkable by a proof assistant, with a seductive-but-wrong formalization distractor.
- `tests/test-211-case-cards.cjs` mechanically guards schema drift: gray-matter parse (Test 1), required keys + case-matches-stem (Test 2), exactly-one null-control + exactly-two lean_checkable invariants (Test 3), and a hash-based real-name deny-list (Test 4). RED proof captured; GREEN passes on the real cards (exit 0).
- `evals/eureka/211-manual-baseline.md` records an honest deferral (no fabricated scores) with the exact run-and-score steps and the validated-flip protocol for the navigator.

## Task Commits

1. **Task 1: README + 6 case cards** - `534f5b33` (feat)
2. **Task 2: schema-validation test** - `422cc541` (test; RED proof on scratch copy, GREEN on real cards)
3. **Task 3 deferral record** - `8fe0043a` (docs; blocking human checkpoint, not scored)

_Task 3's hand-scoring itself is NOT committed - it awaits real navigator judgment (see Deviations / Next)._

## Files Created/Modified

- `evals/eureka/README.md` - Card schema, COMPRESSION formula, two-gate rule, label set, rubric, no-real-names rule.
- `evals/eureka/cases/*.md` - The 6 gold cards (frontmatter + scenario script + scoring notes).
- `evals/eureka/211-manual-baseline.md` - Honest deferral record + navigator run-and-score template.
- `tests/test-211-case-cards.cjs` - gray-matter schema-drift guard + no-real-names deny-list mechanism.

## Decisions Made

- Cards were authored from the available authoritative sources (SEED-050, the plan's Naming-and-content-sources section, CONTEXT.md D8, ROADMAP) because the plan's referenced research file `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` is not present in the worktree. Content is faithful to those sources; no verbatim yaml transcription was possible for the absent file.
- `distractors` modeled as a list of `{label, text}` for mechanical testability while preserving the label-named form the plan specifies.
- All cards ship `validated: candidate`; nothing flips to `true` until the navigator confirms destinations/distractors/labels at the checkpoint.

## Deviations from Plan

### Blocking issue (documented, not auto-fixable)

**1. [Rule 3-adjacent - Missing referenced file] The card-content research file is absent from the worktree**
- **Found during:** Execution start (files_to_read + Task 1 read_first)
- **Issue:** `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` (the source of the verbatim card yamls, sections 3/5/10/11) does not exist in this worktree or the parent repo. This is a missing referenced file, not a package install.
- **Fix:** Authored the cards faithfully from the sources that DO exist (SEED-050 carries the persona dials, the null-control rationale, the restatement trap, the darkmatter card description; the plan body carries the per-card content spec; CONTEXT D8 + ROADMAP corroborate). Did NOT block, did NOT fabricate a research file.
- **Files affected:** all 6 cards + README
- **Verification:** All Task 1 acceptance greps pass; gray-matter parses all 6.

### Checkpoint (by design, not a deviation)

**Task 3 is a blocking `checkpoint:human-verify` and was NOT auto-executed.** Running Larry on each card and hand-scoring with the COMPRESSION formula produces the human GOLD labels the critic is later validated against; a model self-scoring here would contaminate the baseline (SEED-050 forbids synthetic gold, the same rule that forbids synthesizing `upload_data` records). No prior session approval exists for this human-judgment task. Per orchestrator instruction, the autonomous parts were completed and the checkpoint was stopped cleanly with an honest deferral.

---

**Total deviations:** 1 documented blocking-issue workaround (missing research file) + 1 by-design human checkpoint.
**Impact on plan:** No scope creep. Cards are content-faithful to the surviving sources. The only incomplete must-have is the hand-scored baseline, which is a human deliverable by design.

## Issues Encountered

- The research file referenced by the plan is absent (handled above). node_modules is not vendored in the worktree, but `require('gray-matter')` resolves via the parent repo's node_modules (Node walks up), so the test runs cleanly.

## Next Phase Readiness

**Ready:** Phase 212's Grounding Guard has its gold cards, formula, and two-gate rule on disk; the schema test guards drift; the label set (incl. restatement) is documented.

**Pending navigator action to fully close R211-GOLDSET (the CHECKPOINT):**
1. For each of the 6 cards in `evals/eureka/cases/`, open a fresh Larry session and play the persona per its scenario script (honor the `dials`).
2. Record per card: turns-to-destination (or Missed/Lured), any pseudoscience or status_quo_stuck turn, arrival grade (Full/Partial/Missed/Lured).
3. Hand-score each: `Score = CompressionDelta x GuardGate x StatusQuoGate`. Expected shape: archimedes-uq positive; nichefoods-null ~0; any Lured negative.
4. Fill the table in `evals/eureka/211-manual-baseline.md` and add the dated provenance line.
5. Flip `validated: candidate` to `true` on each card the run confirms; leave the rest candidate.
6. Re-run `node tests/test-211-case-cards.cjs` (must stay exit 0).

## Self-Check: PASSED

- All 9 created files present on disk (README, 6 cards, baseline, test).
- All 3 task commits found in git (534f5b33, 422cc541, 8fe0043a).
- `node tests/test-211-case-cards.cjs` exits 0.

---
*Phase: 211-eureka-generator-mvp-tri-modal-room-db-sqlite-vec-xenova-all*
*Completed (autonomous scope): 2026-07-05*
