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
