# Phase 239 Deferred Items

## D-239-05-01: should hatAwareRecommend / suggestValidationSteps send user domain text to a methodology graph at all?

**Filed by:** 239-05 (BRAIN-02 guard-insert plan)
**Filed:** 2026-07-30
**Status:** OPEN, not resolved by this plan

**Context.** 239-05 inserted a raw-field, fail-closed Part 8 egress guard in
front of both `hatAwareRecommend()` and `suggestValidationSteps()`
(`lib/core/brain-client.cjs`). The guard-insert closes the live constitutional
breach (a canary typed into `opportunity.domain` or a Blue Hat
`methodology_notes` entry no longer reaches the Brain wire), but it does not
answer a deeper design question 239-RESEARCH.md raised and explicitly scoped
out (Open Question 4):

> Whether these two features should send user domain text to a methodology
> graph at all is a deeper Canon Part 8 design question. Part 8 says an
> ambiguous boundary case "goes through separate legal review."

**What changed, concretely.** Both functions now classify the raw
`problemType` / `blueNotes` entries (`hatAwareRecommend`) and the raw
`opportunity.domain` / `opportunity.problem` (`suggestValidationSteps`)
before any Cypher interpolation, and skip the Brain leg (return `null`) on
any non-`allow` verdict. Measured live in this plan: even a benign,
non-adversarial domain like `'general'` classifies `ambiguous` (no generic
methodology vocabulary match) and is now skipped, whereas before this plan it
sailed through uninspected. This is the INTENDED consequence of closing the
breach (239-RESEARCH.md Open Question 5), not a regression -- but it also
means both features will degrade to "no Brain enrichment" far more often in
practice than they did before Phase 239, because most real opportunity
domains and hat notes are ordinary prose, not methodology-vocabulary strings.

**The open question.** Is the correct long-term fix:
  (a) leave the guard as-is and accept the higher skip rate as the honest
      cost of enforcing the boundary, or
  (b) redesign these two features so the Brain-bound payload is a generic
      methodology HANDLE derived from the user's domain (e.g. an
      LLM-classified problem-type enum) rather than the user's raw domain
      text, so the guard can allow the common case without inspecting
      user-typed prose at all?

Option (b) is the shape `ask()`/`askOp()` already use elsewhere in this file
(generic handles only, never raw user content) and would likely raise the
allow rate back toward pre-239 levels without reopening the boundary. It is
explicitly OUT OF SCOPE for 239-05 (a guard-insert plan, not a feature
redesign) and is filed here per Canon Part 8's own text: an ambiguous
boundary case "goes through separate legal review," not a silent bless or a
silent delete inside a remediation-only milestone.

**Recommendation.** Do not resolve inside Phase 239. Raise as a candidate for
a future phase (or an RCA session if usage data shows the skip rate is
materially hurting the hat-briefing / opportunity-validation UX) once real
usage data on the new skip rate is available.

**Cross-references:**
- `.planning/phases/239-brain-access-surface/239-RESEARCH.md` Open Questions 4 and 5
- `.planning/phases/239-brain-access-surface/239-05-PLAN.md` (this plan's own `<success_criteria>` DEFERRED note)
- `lib/core/brain-client.cjs` `hatAwareRecommend()`, `suggestValidationSteps()`

## D-239-04-01: tests/agentshield-e2e-smoke.test.cjs fails pre-existing, unrelated to BRAIN-01

**Filed by:** 239-04 (this plan)
**Filed:** 2026-07-30
**Status:** OPEN, out of scope, not fixed

**Context.** Task 2's regression sweep discovered `node tests/agentshield-e2e-smoke.test.cjs`
fails: `AssertionError: e2e: agentshield-scan-cli.cjs must exit 0 against the live repo (clean at
the committed baseline)` (`1 !== 0`). Running `node scripts/agentshield-scan-cli.cjs` directly
shows the real cause: the `supply_chain` surface flags `@huggingface/transformers` and
`sqlite-vec` as `ambiguous` (2 NEW findings not in `references/security/agentshield-baseline.json`),
which is a dependency-baseline drift, not a Brain tool-name issue.

**Confirmed pre-existing, not caused by this plan.** Reverted all three of this plan's Task 2
edits (`git checkout -- lib/core/security/agentshield-scanner.cjs lib/core/grill-engine.cjs
lib/core/eureka/online-pattern-query.cjs`), re-ran the test: identical failure, byte-identical
message. Re-applied this plan's edits via `git apply` afterward; `git diff --stat` confirmed the
three files were restored to this plan's intended state.

**Why out of scope.** None of `agentshield-scanner.cjs`, `grill-engine.cjs`, or
`online-pattern-query.cjs`'s `mcp__brain_` census fixes touch `supply_chain` scanning,
`package.json` dependencies, or `references/security/agentshield-baseline.json`. This is a
dependency-drift finding entirely outside this plan's `files_modified` and outside BRAIN-01/02/03.
Per the SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current task's changes),
this is logged here rather than fixed.

**Recommendation.** A future session should either re-seed the baseline
(`node scripts/agentshield-scan-cli.cjs --write-baseline`, reviewed and committed explicitly) if
both packages are legitimate and accepted, or investigate why they are flagged `ambiguous` first.

**Cross-references:**
- `scripts/agentshield-scan-cli.cjs`
- `references/security/agentshield-baseline.json`
- `tests/agentshield-e2e-smoke.test.cjs`
