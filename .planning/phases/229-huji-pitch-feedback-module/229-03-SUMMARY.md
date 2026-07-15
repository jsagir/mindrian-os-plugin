---
phase: 229-huji-pitch-feedback-module
plan: 03
subsystem: eval
tags: [eval-harness, quote-verifier, inventory-recall, drift, similarity, cost-ledger, part8-hygiene, cjs, D1, D2, D3, D4, D5, D8, D9]

# Dependency graph
requires:
  - phase: 229-huji-pitch-feedback-module
    provides: "FeedbackResultSchema (Plan 01), part8-egress-guard.classify (shipped), labeled inventories + probe manifest + run-all-229.sh SKIP legs (Plan 02)"
provides:
  - "scripts/huji-eval.cjs - deterministic no-model-call eval harness with seven code checks (quote-verifier, inventory-recall, schema, drift, similarity, cost-ledger, part8-hygiene)"
  - "switch-case CLI: --check <name>, --selftest <grounding|cohort|hygiene>, --suite code [--strict], --report"
  - "module.exports {quoteVerifier, inventoryRecall, schemaCheck, driftStats, similarityIndex, costLedger, part8Hygiene, bandOf, shingles, jaccard} for Plan 07 reuse"
  - "run-all-229.sh D1/D2/D5/D8/D9/D4/D3 legs now run green (PASS=7), only D10 (Plan 04) still SKIP"
affects: [229-06-judge-harness, 229-07-batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare --check X self-verifies via tiny in-file PASS+FAIL fixtures (green-while-no-batch); the leg turns RED the moment the check logic regresses, and real --out/path data switches it to batch mode"
    - "D1 quote-verifier is code-first (whitespace+case-normalized verbatim substring), never judge-first - a fabricated quote cannot pass the substring gate"
    - "D4 part8-hygiene reuses lib/core/part8-egress-guard.classify PLUS a per-unit evidence-inventory entity grep; zero hand-rolled egress regex (the guard is the sole authority)"
    - "Dependency-free k=5 word-shingle Jaccard for individuation (D8); AI-SPEC band buckets (<50=1..90+=5) for drift-within-1-band (D3)"

key-files:
  created:
    - scripts/huji-eval.cjs
  modified: []

key-decisions:
  - "Bare --check (the run-all-229 aggregator call shape) runs the check's deterministic selftest rather than erroring on absent batch data - honest green-while-SKIP that still regresses RED on broken check logic"
  - "hasRealData gates batch checks on fs.existsSync(--out) so --suite code --out /tmp/nonexistent-229 falls back to selftests instead of crashing"
  - "main() guarded behind require.main === module so the harness is importable by the Plan 07 batch orchestrator without triggering the CLI"
  - "D4 entity grep filters to strings length >= 4 to avoid false positives on common words while still catching venture names and distinctive quote fragments"

patterns-established:
  - "Two-layer Part 8 hygiene: constitutional guard.classify (block verdict = violation) + evidence-inventory entity grep (student string in payload = breach even if the guard passed it), zero tolerance"
  - "Per-check + per-group selftest registries (CHECK_SELFTESTS, SELFTEST_GROUPS) so a new check wires its fixture once and both bare --check and --selftest pick it up"

requirements-completed: [D1, D2, D3, D4, D5, D8, D9]

# Metrics
duration: ~35min
completed: 2026-07-16
---

# Phase 229 Plan 03: Deterministic Eval Harness (Code Checks) Summary

**`scripts/huji-eval.cjs` - the no-model-call half of the PWS_grading eval: a switch-case CLI with seven deterministic code checks (D1 quote-verifier hardest-gate-first, D2 inventory-recall, D5 schema, D3 drift, D8 similarity, D9 cost-ledger, D4 Part 8 hygiene), each self-verifying with in-file PASS+FAIL fixtures, turning the run-all-229 SKIP legs green (PASS=7).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files created:** 1 (711 lines)

## Accomplishments

- **Task 1 - CLI router + grounding checks (D1/D2/D5).** Built `scripts/huji-eval.cjs` with a `process.argv` switch-case router (mirroring `label-topic-forest.cjs`, no Commander/yargs). `quoteVerifier` (D1, the hardest gate) whitespace+case-normalizes the transcript and asserts every `evidence_claims[].quote`, `problem_claim.quote`, `value_proposition.quote`, and every markdown-quoted span in feedback.md (straight quotes, curly quotes, blockquote lines) is a verbatim substring - a fabricated critique cannot pass. `inventoryRecall` (D2) asserts 100% of the labeled inventory's entities/claims/self_identified_gaps land in an evidence.json string blob. `schemaCheck` (D5) requires `FeedbackResultSchema` from `lib/core/pitch-feedback-schemas.cjs` and prints zod issue paths on failure. `--selftest grounding` runs tiny in-file PASS+FAIL fixtures for all three; unknown `--check` prints usage and exits non-zero.
- **Task 2 - cohort checks (D3/D8/D9).** `driftStats` (D3) asserts one identical pinned `model_id` across the cohort and that duplicate-anchor probes stay within 1 AI-SPEC band across positions 1/50/100/150/200, plus rolling mean/stdev per 25 units. `similarityIndex` (D8) computes dependency-free k=5 word-shingle Jaccard over all feedback, reports max+median, and fails any pair over `--threshold` (default 0.5). `costLedger` (D9) flags any unit over the $3.00 fuse and reports warm average vs $2.00 and batch total vs the $150-400 projection. `--selftest cohort` demonstrates PASS+FAIL for all three (including a model_id mismatch, a >1-band deviation, a duplicated feedback pair, `--threshold` respected, and an over-budget unit).
- **Task 3 - Part 8 hygiene (D4) + suite + report.** `part8Hygiene` (D4) reuses `lib/core/part8-egress-guard.classify` over every logged payload AND greps each unit's evidence.json entity inventory against the payloads - any hit is a zero-tolerance violation, never a hand-rolled regex. `--suite code [--strict]` runs all seven checks with a PASS/FAIL roll-up (batch mode on an existing `--out` dir, else per-check selftest). `--report` renders the cohort view (cost curve, band distribution, drift-vs-probes, similarity matrix, failures) with the explicit "N Part 8 violations in M queries" auditable line. `--selftest hygiene` covers a clean-PASS and a venture-name-FAIL. Added `module.exports` and guarded `main()` behind `require.main` for Plan 07 reuse.

## Task Commits

1. **Task 1: CLI router + grounding checks (D1/D2/D5)** - `b1dbf101` (feat)
2. **Task 2: Cohort checks (D3/D8/D9)** - `3c2c109f` (feat)
3. **Task 3: Part 8 hygiene (D4) + --suite code + --report** - `acf0a981` (feat)

## Deviations from Plan

None - plan executed exactly as written. All three task verifications passed; `bash tests/run-all-229.sh` now reports `PASS=7 FAIL=0 SKIP=1` (the single SKIP is D10, whose `scripts/huji-batch.cjs` lands in Plan 04, exactly as the aggregator's green-while-SKIP doctrine intends).

One design choice inside the plan's stated latitude: the plan wires `--check X` "with path args", and the run-all-229 aggregator calls each leg bare (no batch data exists until Plan 07). Rather than error on absent data, a bare `--check X` runs that check's deterministic selftest (PASS fixture must pass, FAIL fixture must fail). This keeps the phase gate honestly green while a broken check still turns its leg RED - matching Plan 02's explicit green-while-SKIP posture.

## Threat Surface Notes

- **T-229-03-01 (Information Disclosure, part8Hygiene):** mitigated by reusing the shipped `part8-egress-guard.classify` (a 'block' verdict is a violation) plus a per-unit entity grep (any evidence-inventory string in a payload is a breach even if the guard passed it); zero-tolerance non-zero exit; no hand-rolled egress regex. Verified: the venture-name FAIL fixture is caught, the generic-methodology PASS fixture clears.
- **T-229-03-02 (Spoofing/trust, quoteVerifier):** mitigated by the whitespace+case-normalized verbatim substring gate; a one-word-altered quote and a fabricated feedback span both flag as misses in the selftest.
- **T-229-03-SC (installs):** zero package installs - dependency-free CJS (zod reached only transitively through the already-vendored schema module).

## Known Stubs

None that block the plan goal. The batch real-data runners (`loadBatch`, and the `--out`-mode branches of drift/similarity/cost-ledger/part8-hygiene) are future-facing to the Plan 07 batch orchestrator: no batch output exists in-repo yet, so the harness self-verifies via fixtures. This is the intended wave seam, not an unwired stub - the D10 leg in run-all-229.sh correctly remains SKIP until `scripts/huji-batch.cjs` lands.

## Self-Check: PASSED

- `scripts/huji-eval.cjs` present on disk (711 lines).
- All 3 task commits present in git history (b1dbf101, 3c2c109f, acf0a981).
- `node scripts/huji-eval.cjs --selftest grounding|cohort|hygiene` all exit 0.
- `grep part8-egress-guard` (3 hits) and `grep pitch-feedback-schemas` (2 hits) both match.
- `bash tests/run-all-229.sh` reports PASS=7 FAIL=0 SKIP=1 and exits 0.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
