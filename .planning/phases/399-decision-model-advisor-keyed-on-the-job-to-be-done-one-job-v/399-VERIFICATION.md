---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
verified: 2026-11-24T00:00:00Z
status: passed
score: 15/15 requirements verified (DA-01 to DA-15); 7/7 roadmap-level goal clauses verified
overrides_applied: 0
re_verification: false
gaps: []
deferred_owner_gated: "see section 'Owner-gated deferred items'; not gaps"
warnings:
  - "Stale comments: lib/core/decision-advisor/shortlist.cjs line 19 and lib/core/feyminto/next-move.cjs lines 38 and 271 still say MINDRIAN_DECISION_ADVISOR=off is the switch. After commit 587e2d646 the switch is =on (opt-in). Code is correct; comments are wrong."
  - "The v0 table is job-only (rows keyed <job>|*|*) and calibrated on labels from the same model run, so it is circular. Example: for job audit-room the top strong pick is /mos:whitespace. Opt-in default contains this."
---

# Phase 399 Verification Report

**Phase goal:** Decision-model advisor keyed on the job to be done: one job vocabulary, job labels on every capability, a provider-neutral decision adapter (Gemini Decision + Jev-compatible), a precomputed calibrated shortlist table feeding the existing single next-move selector (no live model call on the per-turn path), additive two-axis problem type, decision endpoint in egress policy OFF by default with a code-enforced labels-only validator, logging of shown-option probabilities and overrules, and a routing benchmark.
**Worktree:** /home/jsagi/dev/MindrianOS-Plugin-399, branch work/399-decision-advisor, HEAD 7fc912a0d
**Status:** passed
**Re-verification:** No, initial verification.

Method: SUMMARY claims were not trusted. The verifier ran the phase runner, ran data and function probes on the shipped code, and read the key source files and the two orchestrator commits.

## Test and gate evidence (PROVEN, run by the verifier)

| Command | Result |
|---|---|
| `bash tests/run-all-399.sh` | exit 0. 15 test files PASSED, 5 drift checks PASSED (decision table, job labels, command registry, skill mirrors, orchestration projection). |
| `node tests/test-395-truth-and-cost.cjs`, `test-395-truth-fixes.cjs`, `test-395-job-statements.cjs` | all PASSED (Phase 395 single-selector floor stays green). |
| `node tests/test-366-egress-policy.cjs` | PASS 24, FAIL 0 |
| `node tests/test-353-tripwires.cjs`, `test-355-part8-egress.cjs`, `test-359-devonly-tripwire.cjs` | PASS 5/0, 34/0, 9/0 (no key, no vendor host, no network in lib). |
| `node scripts/check-registry-drift.cjs --check` | OK, 0 findings |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node scripts/bench-decision-routing.cjs --out <scratch>` | runs; prints per-job top-3 recall; writes only to --out |
| `node evals/selection/score.cjs` (advisor unset) | B1 12 of 33, B2 10 of 38, B3 22 of 33. These equal the pre-399 base the orchestrator quoted. |
| `MINDRIAN_DECISION_ADVISOR=on node evals/selection/score.cjs` | B1 10 of 33, B2 9 of 38, B3 22 of 33. Confirms why the orchestrator made the advisor opt-in. |

Not re-run by the verifier: doctor --acceptance, check-shape-declaration, run-harness (the 399-10 SUMMARY reports them against base values; UNVERIFIED by me).

## Observable truths (goal clauses)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | One job vocabulary | VERIFIED | `data/job-vocabulary.json` has 20 ids and 20 job entries with summaries. Drift test `test-399-job-vocabulary.cjs` passes with a mutation control. |
| 2 | Job labels on every capability under one written rule | VERIFIED | 26 accepted command labels, 2 held absent, 5 doubtful kept (`data/job-label-rulings.json`: 26/2/5; `apply-job-labels --check` passes). Agent labels on 2 of 17 agents and 4 MCP tools, only where the written 4-part rule holds (`data/capability-job-labels.json`). Every unapplied item is listed with a reason code in `399-LABEL-REVIEW.md` (7 sections, incl. the 0.70-0.89 band sample list). This matches I-03 and D-07. |
| 3 | Provider-neutral adapter, Gemini and Jev-compatible | VERIFIED | `lib/core/decision-advisor/adapter.cjs`, `providers/gemini.cjs` (field `input`, noul/choice/score, 1000 max, sorts options), `providers/jev.cjs` (field `state`, `/v1/systemone`, no sort). `test-399-adapter.cjs` 35/35. |
| 4 | Precomputed calibrated table feeding the single selector, no live model call per turn | VERIFIED | `data/decision-advisor-table.json` (13 job rows, isotonic breakpoints stored, no raw probability or accuracy). `shortlist.cjs` reads one local JSON file. `next-move.cjs`, `command-resolver.cjs`, `selection-log.cjs`, `sensors.cjs` do not reference the adapter, providers or transport (grep returned nothing). The fence test `test-399-one-selector-fence.cjs` passes. Lookup is wired in `composeNextMove` (line 278) and `composeWorkflow` (line 223 `scoreFor`); `framework_run` (sensors.cjs 544-555) and `/mos:act` (act-command.cjs 491) pass job and level. |
| 5 | Additive two-axis problem type | VERIFIED | `lib/core/problem-axes.cjs`; round trip checked: UnDefined, IllDefined, WellDefined, Wicked all return the same four-value through `toFourValue(fromFourValue(x))`. `data/brain-shape-vocabulary.json` is not in the diff (Brain wire unchanged). |
| 6 | Endpoint OFF by default, code-enforced labels-only validator | VERIFIED | `data/egress-policy.json` `decision_advisor.default=false`. `lineAllowed(loadEgressPolicy(),'decision_advisor')` returns false. Test E2: a room override cannot turn it on. Validator probes: a changed `job_summary` returns `free_text_outside_label_set`; an extra key or free-text subject returns `unknown_key`. `scripts/decision-advisor-transport.cjs` validates, then checks the line (line 125), then sends; the capture-server test passes. |
| 7 | Logging of shown-option probabilities and overrules | VERIFIED | `lib/core/navigation/selection-log.cjs` (232 lines), called from `offer-closer.cjs` line 323 and `mcp/tools/gate.cjs` line 1843; `ground_truth_label` migration in `memory-ops.cjs`. `test-399-selection-log.cjs` 25/25, incl. K7 (a writer throw leaves the response unchanged). |
| 8 | Routing benchmark | VERIFIED | `scripts/bench-decision-routing.cjs` runs offline, deterministic, 5 folds by command, ECE and Brier, 4 shuffled orders for Jev, 1 for Gemini. Live mode refuses with `egress_line_off` (BM6). `test-399-bench.cjs` 11/11. |

## Requirements coverage (DA-01 to DA-15)

| ID | Plan | Code | Test | Status |
|---|---|---|---|---|
| DA-01 | 01 | `data/job-vocabulary.json` | test-399-job-vocabulary | SATISFIED |
| DA-02 | 02 | `data/job-label-rulings.json` taxonomy_disagreements (6 items, none guessed) | test-399-job-labels | SATISFIED |
| DA-03 | 02 | `scripts/apply-job-labels.cjs`, commands/*.md, registry | test-399-job-labels (26/2/5) | SATISFIED |
| DA-04 | 02, 03 | skill mirrors regenerated (`build-skill-mirrors --check` OK); `399-LABEL-REVIEW.md` sections 5-7 | test-399-job-labels, capability-labels | SATISFIED |
| DA-05 | 03 | `agents/research.md`, `agents/reverse-salient-agent.md`, `data/capability-job-labels.json` | test-399-capability-labels | SATISFIED |
| DA-06 | 04 | `adapter.cjs`, `labels-only.cjs` | test-399-adapter, advisor-fence | SATISFIED |
| DA-07 | 04, 05 | `providers/gemini.cjs`, PATH `/v1beta/decisions` | test-399-adapter P-legs, transport-capture | SATISFIED |
| DA-08 | 04, 05 | `providers/jev.cjs`, jev path via guarded dev client | test-399-adapter, transport-capture | SATISFIED |
| DA-09 | 04, 05 | `egress-policy.json` line off, `decision-advisor-transport.cjs`, validator | test-399-egress-line, transport-capture, test-366 | SATISFIED |
| DA-10 | 06 | `run-step-capabilities.json`, table builder, table, `shortlist.cjs` | test-399-run-steps, test-399-table | SATISFIED |
| DA-11 | 07, 08 | `next-move.cjs`, `command-resolver.cjs`, `sensors.cjs`, `act-command.cjs` | test-399-selector-advisor, workflow-advisor, one-selector-fence | SATISFIED |
| DA-12 | 06, 07 | `present.cjs` (band words, no-strong-pick, `hasRawNumber`), `sensors.cjs` line 306 | test-399-selector-advisor, table. Probe: audit-room sentence has band words and no number. | SATISFIED |
| DA-13 | 09 | `selection-log.cjs`, `memory-ops.cjs`, `offer-closer.cjs`, `gate.cjs` | test-399-selection-log | SATISFIED |
| DA-14 | 01 | `problem-axes.cjs`, `problem-type-router.cjs` | test-399-problem-axes | SATISFIED |
| DA-15 | 10 | `bench-decision-routing.cjs` | test-399-bench | SATISFIED |

No orphaned requirement. DA ids appear in the ROADMAP Phase 399 entry only (not in REQUIREMENTS.md, as stated by the task); every id is claimed by a PLAN `requirements:` field.

## Orchestrator changes outside the plans

| Commit | Change | Judgement against locked decisions |
|---|---|---|
| `ea8d1a7a5` | Gemini `PATH='/v1beta/decisions'`, `PATH_CONFIRMED=true`, key header comment, egress-policy `paths` field, T7 test updated | HONORS. D-04 and I-04 name "Decisions API v1beta". Only a path was set. No vendor host constant entered lib or scripts (fence tests 353, 355, 359 still pass). Line stays `default:false` (D-03, I-11). It does not do the Deferred item "read pricing, rate limits, data-use terms". The REST contract rests on the orchestrator's reading of the vendor page (UNVERIFIED by me; no network used). |
| `587e2d646` | `advisorEnabled()` is true only for `MINDRIAN_DECISION_ADVISOR==='on'`; tests opt in; S4 leg pins the unset default | HONORS. D-02 says the advisor advises and abstains when unsure; a default-off advisor is stricter than that. I-05, I-07 are met because the table feeds the one selector when on and no second authority exists. No locked decision requires default-on. I measured the base: with the advisor unset, eval B1/B2 equal the pre-399 base (12/33, 10/38). With it on, B1 drops to 10/33. The commit message says "lowered B1 and B2"; B2 is a "wrong set" count where lower is better (9 vs 10), so only B1 is a regression. Minor wording issue. |

## Anti-patterns

- Debt markers (TBD, FIXME, XXX) in the 81 non-planning text files changed by this phase: NONE.
- Em dash or en dash in phase-owned files: NONE (checked decision-advisor, test-399 files, problem-axes, selection-log, bench).
- Private research material (DO-NOT-OPEN batch, rubrics): not found in the diff. The fixture `recorded-job-command-yes-no.json` has only job, command, p (schema `mos.decision-recorded/1`).
- WARNING (not a blocker): stale `=off` comments in `shortlist.cjs` line 19 and `next-move.cjs` lines 38 and 271 (see frontmatter).
- WARNING (not a blocker): the v0 table is job-only. The finer key order (job, definition level, last command) is built but not populated; `conditioned_rows:false`. This is stated in the table `_note` and matches I-05 ("v0 from the recorded run").

## Owner-gated deferred items (NOT gaps, per CONTEXT Deferred list)

- Gemini Decision pricing, rate limits, data-use and output-training terms.
- User access choice (owner proxy or per-user key). The endpoint stays off until chosen.
- Second human labeller; any public accuracy number (none shipped; confirmed no accuracy in README/CHANGELOG for the advisor).
- Review of the 0.70-0.89 band: the sample list exists in `399-LABEL-REVIEW.md` section 7; the owner judges it.
- Release cut and push (push gate: owner reviews every commit ahead).
- Making the advisor default-on needs an independent measurement; the opt-in flag is the owner's switch.

The phase goal does not depend on any of these. Status is `passed`.

## Human verification

None required for the phase goal. The owner may want to confirm the orchestrator's opt-in ruling (commit 587e2d646) at the push review.

---

_Verified: 2026-11-24_
_Verifier: Claude (gsd-verifier)_
