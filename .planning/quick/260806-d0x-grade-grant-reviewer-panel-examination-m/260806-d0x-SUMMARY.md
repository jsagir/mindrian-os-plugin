---
quick_id: 260806-d0x
status: complete
---

# Quick Task 260806-d0x: grade-grant reviewer-panel examination mode -- Summary

Implemented the navigator's fully-specified design verbatim (BONO-substrate reuse for
grade-grant's opt-in "Reviewer panel examination" mode). Nothing in the design was
redesigned; two small implementation-level gaps the design left open were filled in and
are called out explicitly below (not silent deviations).

## What shipped

- `lib/core/bono/reviewer-governance.cjs` (new) -- `REVIEWER_GOVERNANCE` (7 frozen
  category keys), `governanceForCategory`, `enforceReviewerGovernance`,
  `composeReviewerGovernedSeams` (mirrors `hat-governance.cjs::composeGovernedSeams`'s
  exact seam contract, minus the KAC-first onStep flag per the design's section (c)/D8).
  Re-exports (not duplicates) `assertHeterogeneity` + `lensDescriptor` from
  `hat-governance.cjs` -- verified by identity (`===`) in the test, not just shape.
- `lib/core/eureka/grade-grant-examine.cjs` (new) -- `buildReviewerSlots`,
  `runReviewerFanout` (the N2 fan-out-cap fix: batches the 7 `CATEGORY_VALUES` into two
  `runCellFanout` calls, 5 + 2, never raising `FUTURES_FANOUT_CAP`),
  `defaultReviewerDispatchCell` (mechanical, no LLM embedded -- reshapes injected findings
  or degrades to a neutral stub), `reviewerCellsToFindings` (pure reshape back into
  `scoreApplication`'s findings[] shape), `buildReviewerDebateOptions` (wires
  `deriveRulingVerb` + `buildRoadmap` into a real `runDebate(...)` call).
- `agents/grant-reviewer.md` (new) -- a genuine sibling to `persona-analyst.md`, not a
  repurpose. `allowed-tools: [Read, Glob]` only (no WebSearch/WebFetch/Brain). Two roles:
  (a) per-category reviewer cell, (b) ruling consolidator (the living home for the Notion
  "Tnufa Tech Assessment agent" stub's intent).
- `lib/core/eureka/grade-grant.cjs` -- ONE additive export, `deriveRulingVerb(verdict,
  rubric)`. All 18 pre-existing tests re-verified green, byte-diff limited to the new
  function + its module.exports entry.
- `commands/grade-grant.md` + `skills/grade-grant/SKILL.md` -- frontmatter
  `hitl_shape` -> `hitl_stages` (file-verdict F.8 unconditional, hypothesis-confirm F.1 /
  ruling F.5 panel-mode-only); Session Flow step 4 grows the opt-in 4a/4b sub-choice.
  SKILL.md regenerated via `build-skill-mirrors.cjs` (never hand-edited).
- `tests/test-reviewer-governance.cjs` (new, 7 checks) + `tests/test-grade-grant-examine.cjs`
  (new, 14 checks, including two REAL `runDebate`/`runDerivation` round-trips over a real
  room.db for both the supported and rejected paths -- no mocking the graph).
- Registries regenerated via their own generators (never hand-edited):
  `build-connector-registry.cjs` (new agent connector), `build-orchestration-projection.cjs`,
  `build-harness-manifest.cjs`. `build-skill-mirrors.cjs --check` clean. No new
  `ALLOWED_EDGE_TYPES` member (`MAPS_TO_SECTION` already covers every edge this mode
  writes). `check-shape-declaration.cjs --check`: the new surfaces (grade-grant.md,
  grant-reviewer.md) pass cleanly; the 53 WARN violations reported are 100%
  pre-existing on files this task never touched (verified by name -- admin.md,
  correct-reference-now.md, etc.), not a regression.

## Two implementation gaps the design left open, filled in (not silent)

1. **The ruling/residual-tension `finding` shape.** The design said the ruling cites "the
   failing criterion + its room_section as target_section" but did not specify the exact
   object shape `runDebate`'s existing `wireAccept`/`wireReject` call requires. Read
   `findings-wirer.cjs` + `evidence-claim.cjs`: `wireAccept`'s `finding` param must be a
   full EvidenceClaim-shaped object (`source`/`url`/`retrieved_at`/`evidence_tier`/
   `summary`, all required non-empty strings, `evidence_tier` from the closed
   `{Academic,Operational,Practitioner,None}` set). There is no external URL for an
   internal reviewer-panel ruling, so `buildReviewerDebateOptions` constructs a synthetic
   LOCAL handle (`source: 'grade-grant-reviewer-panel'`, `url: 'local:grade-grant-panel:
   <program>'`, `evidence_tier: 'Practitioner'`) rather than fabricating a fake external
   citation. Verified end-to-end: a real `EvidenceClaim` node + `INFORMS`/`REJECTED_BECAUSE`
   edge lands in a real room.db for both the supported and rejected paths (see the two
   round-trip tests in `tests/test-grade-grant-examine.cjs`).
2. **The connector block for the new agent.** The design named `agents/grant-reviewer.md`
   but did not specify its connector frontmatter. All 8 pre-existing agents carry one (no
   `connector.excluded:true` precedent for an agent in this repo), so `grant-reviewer.md`
   rides the frozen `context_block` reach with a new `grant-reviewer` sub_mode (mirrors how
   `persona-analyst.md` shares the same reach under `persona-hats`), `framework: null`
   (mirrors `grade-grant.md`'s own connector block -- no de Bono framework here),
   `web_scope: null` (this agent never opens a web leg, unlike `persona-analyst.md`'s
   per-hat scope).

## Verification run

```
node tests/test-grade-grant.cjs            18/18 checks passed (byte-unchanged floor)
node tests/test-reviewer-governance.cjs     7/7  checks passed
node tests/test-grade-grant-examine.cjs    14/14 checks passed
node scripts/build-connector-registry.cjs --check   -> OK
node scripts/build-orchestration-projection.cjs --check -> OK
node scripts/build-harness-manifest.cjs --check     -> OK
node scripts/build-skill-mirrors.cjs --check        -> OK
node scripts/check-render-coverage.cjs              -> 0 gap
```

## Deliberate non-deviations (confirmed against the design, not touched)

- `lib/core/navigation/synthetic-expert.cjs`'s `HAT_COLORS` allow-list -- untouched (D7).
  Every reviewer slot resolves `generate-fresh`; no `SyntheticExpert` filing this pass.
- `lib/core/close-loop-writer.cjs` -- not called anywhere in the new code (D6).
- `lib/core/bono/cell-fanout.cjs`, `debate-composition.cjs`, `expert-library.cjs` -- zero
  line changes; consumed exactly as shipped.
- No new `ALLOWED_EDGE_TYPES` member minted.

## Process note (GSD workflow)

This session ran as a spawned subagent with no `Agent`/`Task`-spawn tool available (checked
via `ToolSearch`), so the nested `gsd-planner` + `gsd-executor` subagent dispatch the
`/gsd-quick` workflow normally performs could not run. The planning (this PLAN.md) and
execution (this SUMMARY.md) ceremony was carried out directly in-session instead, following
the SAME task/verify/commit discipline the workflow specifies. Flagged here rather than
silently passed off as a normal `/gsd-quick` run.
