# Phase 399 CONTEXT: Decision-model advisor keyed on the job to be done

**Source:** owner handoff of 2026-11-24 ("preparing the plugin for the Gemini Decision model").
**Research trail (PRIVATE, never copy into this public repo):** `~/MindrianOS/research/2026-11-24-decision-advisor-handoff/`
(47 files: HANDOFF-mindrian-os-plugin.md, job-hub-spec-v0.md, jtbd-calibration-results-v0.md,
accepted-job-labels-v1.json, proposed-job-labels-agents-tools-v0.md, jtbd-calibration-gemini-pairs-v1.json,
job-match-gemini-skills-agents-tools.json, two-axis-gemini-60.json, cost-simulation-v0.md, scripts).
Rule: repo files may carry derived, labels-only data (job ids, command names, rescaled numbers). Do not
commit the research files, rubrics, calibration sets or the "DO-NOT-OPEN" batch file.

**Branch:** `work/399-decision-advisor` in worktree `~/dev/MindrianOS-Plugin-399`, cut from origin/main 24d5ccb6a.
Phase number 399 (397 and 398 are taken on the unpushed branch work/397-translational-panel-mod).
**Builds on:** Phase 395 (selection by job, merged, beta.87) and Phase 396 (Part 8 shape packet, merged; 396-14..16 open).
**canon_parts:** 8, 9, 12

## Owner decisions (locked, from the handoff)

- D-01 The job to be done is the key joining room, commands, skills, frameworks and Theo.
- D-02 The decision model ADVISES; the host LLM JUDGES. Advisor output is evidence, never instruction. Unsure -> abstain ("no strong pick").
- D-03 Only labels leave the machine (job id, problem type, names and public descriptions of commands/skills/agents/tools). No room content, ever.
- D-04 Stage one provider: hosted Gemini Decision (`gemini-decision-1`, Decisions API v1beta). Stage two: Jev-compatible (hosted Jev or self-hosted Kev-4B). Both behind one interface.
- D-05 Scope is capabilities that have run steps.
- D-06 Wicked is a complexity dimension, not a fourth exclusive problem type.
- D-07 26 accepted command job labels are applied; 2 held pairs and 5 doubtful existing labels are surfaced for owner review, NOT changed.

## Implementation decisions (this session, autonomous run; reversible)

- I-01 Canonical job vocabulary lives in ONE data file (`data/job-vocabulary.json`); registry, taxonomy and section canon are pinned to it by a drift test. Ids are the union (16 registry + section-canon 4, deduped against the taxonomy 13). Summaries for temporal-correction, build, navigate are added.
- I-02 Taxonomy vs registry disagreements (e.g. `/mos:validate-proposition` hook for decide-pursue) are resolved in favour of the accepted-labels list when it covers the pair; otherwise listed in a review file, not guessed.
- I-03 Agent and MCP-tool job labels: applied from the proposals file only where the proposal is unambiguous; everything else goes to `399-LABEL-REVIEW.md` for the owner.
- I-04 Adapter: `lib/core/decision-advisor/` with `adapter.cjs` (interface: shared context + typed questions yes/no | choice | score -> per-question probabilities), `providers/gemini.cjs` (field `input`, types `noul`/`choice`/`score`, <=1000 questions/request, stable option ids, alphabetical sort aware), `providers/jev.cjs` (field `state`, path `/v1/systemone`). Network only through the existing egress policy; tests use recorded fixtures and a capture server. No key in repo; key read from env only, never logged.
- I-05 NO live model call on the per-turn path. A precomputed table `data/decision-advisor-table.json` keyed on (job, problem definition level, last command) -> ranked shortlist with calibrated confidence. Built offline by a script from recorded provider outputs; this session builds v0 from the recorded Gemini run (labels-only probabilities) since no GEMINI_API_KEY is present on this machine.
- I-06 Calibration: fit a monotone rescaling (isotonic or Platt) on registry labels per release, stored with the table. Raw probabilities are never shown to the navigator.
- I-07 Wiring: the table FEEDS the existing single selector `composeNextMove` (`lib/core/feyminto/next-move.cjs`) and lets the advisor rank among `composeWorkflow`'s up-to-five commands (`lib/workflow/command-resolver.cjs`). No second resolver, ranker or posture authority; the single-authority tests must stay green. Job-direct routing to commands/skills without a framework mapping goes through the same selector.
- I-08 Shortlist reaches the host model as ranked options with a confidence band word plus an explicit "no strong pick"; never a raw number in navigator-visible text.
- I-09 Logging: record the calibrated probability of each shown option, CLI selector accepts (today only defers/rejects), decision-time features, and every overrule. Add a ground-truth column to `calibration_observations`; behavioural channel stays off.
- I-10 Two-axis problem type is ADDITIVE: new fields `definition_level` (un-defined | ill-defined | well-defined) and `wickedness` (Cynefin 0-3 rating + yes/no). The four-value enum stays as a derived compatibility view so the Phase 396 shape vocabulary, the Part 8 guard and the Brain wire do not change shape in this phase.
- I-11 Egress: the decision endpoint enters `data/egress-policy.json` OFF by default; a code-enforced labels-only payload validator rejects any free text outside the closed label set.
- I-12 Tests: a routing benchmark from capabilities with run steps (top-3 recall + calibration error), shuffled option order for non-sorting providers.

## Deferred (owner-gated, do not do in this phase)

- Reading Gemini Decision pricing, rate limits, data-use and output-training terms.
- Choosing user access: owner proxy holding the key vs each user's own key. Until chosen, the endpoint stays off.
- A second human labeller on disputed items; quoting any accuracy number publicly.
- Wicked test cases that are un-defined or well-defined (none exist).
- An answer key for framework-to-framework order.
- Review of the 0.70 to 0.89 band (183 pairs): this phase produces the sample list, the owner judges it.
- Real parallel step execution in workflows.
- Release cut and push (push gate: owner reviews every commit ahead).

## Verified facts (2026-11-24, this worktree)

- F1 `data/command-registry.json` uses 16 job ids: audit-room, build, compare-options, connect-domains, decide-pursue, explore, file-meeting, find-bottleneck, find-problem, navigate, plan-execution, prepare-pitch, surface-contradiction, temporal-correction, understand-market, validate-idea.
- F2 Commands carry `serves_jtbd:` in frontmatter; registry is generated by `scripts/build-command-registry.cjs`; drift check `scripts/check-registry-drift.cjs`.
- F3 17 agent files exist in `agents/`, none with job labels.
- F4 Four-value problem type consumers: lib/core/problem-type-router.cjs, navigation-engine.cjs, offer-presenter.cjs, ambient-framing.cjs, part8-egress-guard.cjs, rs-brain-substrate-prompts.cjs, lib/mcp/brain-router.cjs, scripts/intent-classifier.cjs.
- F5 Calibration code: lib/core/navigation/calibration-gate.cjs, calibration-log.cjs.
- F6 No GEMINI_API_KEY in this environment.
</content>
</invoke>

## Aware of Phase 400.2 (added 2026-11-25)

The personas section job is ruled validate-idea with explore (data/section-job-canon.json). Phase 400.2 (the persona, hats and research bundle, SEED-149) changes what /mos:persona does, so its serves_jtbd label (prepare-pitch today) is reviewed there. 400.2 is part of the next cut with 399 and 400.
