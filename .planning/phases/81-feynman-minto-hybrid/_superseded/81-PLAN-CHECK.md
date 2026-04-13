---
phase: "81"
reviewer: gsd-plan-checker
created: 2026-04-13
verdict: PASS_WITH_NOTES
---

# Phase 81 Plan Check

## Verdict: PASS_WITH_NOTES

All five plans are goal-backward complete, dependency-consistent, hard-constraint compliant (zero em-dashes, zero ESM, zero TypeScript, zero forbidden test frameworks, AAAK untouched), and every FEYNMINTO requirement traces to at least one plan's `requirements` frontmatter field with runnable verification. The five release gates for v1.10.2 are each explicitly owned by a 81-05 task. Two minor notes and several observations are attached below; none of them block execution.

## Coverage Matrix

| Requirement | Plan(s) with frontmatter coverage | Tasks that implement | Verified |
|---|---|---|---|
| FEYNMINTO-01 | 81-02, 81-03, 81-04, 81-05 | 81-04 task 10 (token count assertion < 1500), per-stage output bounds in 81-02/03 | yes |
| FEYNMINTO-02 | 81-04, 81-05 | 81-04 task 6/9 (byte-equivalent baseline preserves structural helpers) | yes |
| FEYNMINTO-03 | 81-01, 81-02, 81-03, 81-05 | 81-01 stage signatures, 81-02 stages 1+2 bodies, 81-03 stages 4+5 bodies + runFullPipeline | yes |
| FEYNMINTO-04 | 81-04, 81-05 | 81-04 task 6/7 tier fallback dispatch + AAAK footer, scenarios b/c/d/e | yes |
| FEYNMINTO-05 | 81-01, 81-05 | 81-01 tasks 3/4 budget-ops + llm-call gate, 81-05 `/mos:budget per-run` subcommand | yes |
| FEYNMINTO-06 | 81-01, 81-05 | 81-01 budget-ops monthly cap, 81-05 `/mos:budget cap` subcommand | yes |
| FEYNMINTO-07 | 81-05 | 81-05 tasks 1-3 regenerate-all + migration fixture + tests | yes |
| FEYNMINTO-08 | 81-04, 81-05 | 81-04 task 2 baseline capture + task 9 byte-equivalent assertion | yes |
| FEYNMINTO-09 | 81-01, 81-02, 81-03, 81-05 | Static grep assertion in feynman-stages.test.cjs forbidding execSync/spawn | yes |
| FEYNMINTO-10 | 81-01, 81-05 | 81-01 task 4 llm-call.cjs with fetch + MCP-stub surface detection, Decision #17 in 81-05 | yes |

Every FEYNMINTO requirement appears in at least one plan's `requirements` field AND has a task that actually implements it AND has a runnable verification command. No requirement is silently dropped, double-covered redundantly, or only covered by a vague "implement" task.

## Issues Found

### BLOCK (must fix before execution)

None.

### NOTE (should fix, non-blocking)

**1. [dependency_correctness / parallelism] 81-02 and 81-03 both modify `lib/memory/feynman-stages.cjs`, which is parallel-risky even if disjoint function bodies.**
- Plans: 81-02, 81-03
- Problem: Both plans are marked `parallel_safe: true` and touch the same file. 81-03's Risks section correctly identifies the merge-conflict risk and prescribes a land-order ("land 81-02 first, then 81-03 with runFullPipeline added on top"). This is a correct mitigation but it means the plans are NOT truly parallel-executable without serialization at commit time. The `parallel_safe: true` flag in frontmatter slightly overstates this. The underlying risk is documented in 81-03's Risks section and is manageable, so this is a NOTE not a BLOCK.
- Suggestion: Either (a) change 81-03's frontmatter to `parallel_safe: true` but add a `commit_order: after-81-02` hint, or (b) accept the documented mitigation as-is. The orchestrator should understand the "commit 81-02 first, then 81-03" rule even though both can run concurrently in separate sessions.

**2. [scope_sanity] 81-01 has 9 tasks and 81-05 has 20 tasks, both exceeding the 2-3 task target.**
- Plans: 81-01, 81-05
- Problem: 81-01 creates 9 discrete file groups (llm-call, budget-ops, feynman-prompts, feynman-stages skeleton, fetch shim, test runner, ROOM.md scaffold, plus test files for each). 81-05 has 20 tasks because it bundles commands + migration + docs + the 5 release gates. Per the plan-checker rubric, 4 is a warning and 5+ is normally a blocker.
- Why it is a NOTE and not a BLOCK here: the tasks in both plans are small and each one maps to an atomic commit. 81-01 is foundation-plumbing: every task is either a single-file-plus-test pair or a trivial scaffold (ROOM.md, .gitkeep). None of them is complex work. 81-05 is largely mechanical release-pipeline execution where each "task" is one gate. Splitting 81-05 into sub-plans would create dependency sequencing overhead without reducing the total work. Both plans have clear Files-to-create, Files-to-modify, and explicit acceptance criteria per task, which is the real quality measure.
- Suggestion: Accept as-is, but flag to the orchestrator that 81-01 and 81-05 will each take a larger execution window than a typical single-plan phase. If execution context starts degrading mid-plan, split 81-05 into 81-05a (commands + migration) and 81-05b (release gates). No pre-execution split required.

### OBSERVATION (fyi, no action required)

- **`attachAaakFooter` verification.** Phase constraint says AAAK is read-only. 81-04's Risks section includes a conditional branch for creating `lib/memory/aaak-footer.cjs` wrapper IF `attachAaakFooter` does not already exist in `aaak-compress.cjs`. Spot-check of `lib/memory/aaak-compress.cjs` confirms `attachAaakFooter` IS exported (line 393 of the current file), so the conditional path is not needed at execution time. The wrapper-fallback plan is still a good defensive measure in case the function is renamed between now and execution.
- **81-05 task 20 (post-hoc CHANGELOG cost update) is a clever anti-drift measure.** It lets 81-02's actual measured pricing flow back into the release CHANGELOG before the tag is cut. This is good discipline. Keep it.
- **81-04's tier-0 baseline capture happens at task 2, before any generator modifications land.** This is the correct order and 81-04's Risks section explicitly calls it out. Good.
- **`scripts/release.sh` exists** (confirmed by spot-check, 6423 bytes, executable). 81-05 task 18 tells the executor to prefer it over manual gates. Good.
- **The `--tier-0` flag is correctly added to `scripts/vault-section-minto-generator.cjs` in 81-04 task 6, not to `bin/mindrian-tools.cjs`.** This keeps the CLI flag close to the script that consumes it. 81-05 does not re-add it anywhere, avoiding duplication.
- **The Feynman engine skill at `~/.claude/skills/feynman-engine/` is never referenced as a modification target in any of the five plans.** Every plan that mentions the skill (81-01 prompts, 81-02 model notes, 81-04/05 verification checks) does so as a read-only reference. Constraint honored.
- **Stages 3 and 6 skip invariant is enforced with multiple overlapping guards**: comment markers in `feynman-stages.cjs`, `STAGES_3_AND_6_SKIPPED_NOTE` constant, static grep assertion in test, negative assertion on `_pipeline_meta.stages` in 81-03 full-pipeline test. Defense-in-depth is appropriate given this rule is easy to violate accidentally.
- **Recorded-fixture pattern is implemented consistently** across 81-01 (shim + test runner), 81-02 (stage1/2 fixtures), 81-03 (stage4/5 + full-pipeline fixtures), 81-04 (sample-section fixture + pre-81 baseline), 81-05 (migration-room fixture). The pattern aligns with 81-RESEARCH Section 3.
- **Tri-polar tradeoff is documented honestly** in 81-RESEARCH Section 2 (direct fetch requires `ANTHROPIC_API_KEY` on CLI/Desktop/Cowork; tier-0 fallback preserves Decision #1 zero-config promise). Plans reference this tradeoff rather than pretending it does not exist. The future v3.0 MCP sampling migration path is noted as downstream.
- **Decision #17 addition goes to BOTH `CLAUDE.md` and `.claude/includes/decisions.md`.** Without this, the include drift would be invisible to readers of CLAUDE.md alone. 81-05 tasks 9 and 10 handle both files.

## Parallelism Verification

**Claim:** 81-02 and 81-03 are `parallel_safe: true` relative to each other.

**Evidence:**
- Both plans modify `lib/memory/feynman-stages.cjs`.
- 81-02 fills in stubs for `feynmanStage1_essence` and `feynmanStage2_plainLanguage`.
- 81-03 fills in stubs for `feynmanStage4_mentalModel`, `feynmanStage5_sweetSpot`, AND adds a new function `runFullPipeline`.
- Each of stage1, stage2, stage4, stage5 is a discrete function body created (as a stub) in 81-01.
- The `runFullPipeline` addition is append-only to the module and references stages 1-5 only at call time, not at load time.

**Verdict:** The claim is CORRECT in principle - git's line-level merge handles disjoint function body edits cleanly. HOWEVER, true parallel execution still has two pitfalls:
1. If 81-03 commits `runFullPipeline` before 81-02 lands stages 1 and 2, the full-pipeline integration test in 81-03 will fail because stages 1/2 still throw NotImplementedError. This is a detectable failure, not a silent wrong, but it wastes an execution cycle.
2. Header comment updates in the same file (both plans update the comment block at the top) can conflict on a single line if both plans rewrite the full comment.

Both pitfalls are mitigated by 81-03's Risks section prescribing "land 81-02 first, then 81-03". The orchestrator should treat this as "parallel-capable, sequential-commit-preferred" rather than "true parallel". Refuting the claim outright would be wrong - the parallel-safe flag is a structural honesty about the fact that no function body is touched by both plans.

## Release Gate Verification (81-05)

| Gate | Owner task | Artifact | Status |
|---|---|---|---|
| 1. CHANGELOG.md [1.10.2] entry with 5 mandatory points (why 1.10.1 skipped, tier architecture, cost model, migration, semver deviation) | Task 11 | Full draft inline in 81-05 under "CHANGELOG Entry" | OK - all five points explicitly present in the draft |
| 2. `.claude-plugin/plugin.json` version -> 1.10.2 | Task 13 | 1-line bump | OK |
| 3. `package.json` version -> 1.10.2 | Task 14 | 1-line bump | OK |
| 4. Git tag `v1.10.2` created and pushed | Tasks 16 + 19 | commit + tag + push | OK |
| 5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` updated with `source.ref: v1.10.2` | Task 17 | Flagged as USER INSTRUCTION (cross-repo write) | OK - correctly handled as user-in-the-loop, not pretended-to-be-automated |

Additionally, task 18 prefers `scripts/release.sh` if it exists (it does) for automated gate execution with manual fallback. Task 20 reserves a post-hoc update slot for CHANGELOG cost figures observed during 81-02 fixture recording. The Version Consistency block in 81-05 Verification explicitly checks plugin.json, package.json, CHANGELOG, and git tag are all in sync.

**Beta-gating check:** 81-05 explicitly ships as stable `1.10.2`, not `1.10.2-beta.N`. Phase 81 is a feature release, not release infrastructure. The CHANGELOG version header reads `[1.10.2]`. The Risks section pre-flags any executor who might misread this.

**All five gates accounted for. Zero gate drift.**

## Deviation Audit

The planner self-flagged deviations in each plan's "Deviation Notes" section. Walking through every one:

**81-01 deviations:**

1. **`lib/memory/budget-ops.cjs` location** (user instruction overrides 81-RESEARCH proposal of `lib/core/budget-ops.cjs`). ACCEPTED - honors the user instruction, trivial to rename if reversed.
2. **Parsers implemented in 81-01, not 81-02.** ACCEPTED - scope shift forward, reduces 81-02/03 scope, net positive.
3. **`run-memory-tests.cjs` added in 81-01.** ACCEPTED - 81-RESEARCH Wave 0 scheduling.
4. **No MCP branch implementation (stub only).** ACCEPTED - matches 81-RESEARCH and CONTEXT's D-7 fallback-ready design.
5. **No changes to Feynman engine skill.** ACCEPTED - matches 81-RESEARCH Section 5 and hard constraint.

**81-02 deviations:**

6. **Sonnet vs Haiku A/B deferred to plan execution time.** ACCEPTED - within "Claude's Discretion" per 81-RESEARCH, stays Sonnet by default, follow-up task documents observation.
7. **`stage1-context.json` sibling fixture added.** ACCEPTED - additive to 81-RESEARCH, makes stage 2 fixtures self-contained, diffable.
8. **`scripts/record-feynman-fixtures.cjs` helper added.** ACCEPTED - quality-of-life improvement, can refuse to commit broken fixtures.

**81-03 deviations:**

9. **`runFullPipeline` orchestrator added in 81-03, not 81-04.** ACCEPTED - reduces 81-04 wiring complexity, puts budget defense-in-depth in one place, additive to 81-RESEARCH not contradictory.
10. **`full-pipeline/expected-shape.json` is a schema-lite file, not a recorded LLM response.** ACCEPTED - avoids redundancy with per-stage fixtures, clean design choice.
11. **Parallelism strategy documented in Risks.** ACCEPTED (see Parallelism Verification above).

**81-04 deviations:**

12. **Pre-81 entry point becomes `renderSectionMintoTier0` as an ALIAS, not a rename.** ACCEPTED - reduces blast radius, additive.
13. **Conditional `lib/memory/aaak-footer.cjs` wrapper if `attachAaakFooter` missing.** ACCEPTED as pre-flagged fallback. Spot-check confirms `attachAaakFooter` exists today, so the wrapper path will not trigger, but the defensive planning is good.
14. **`--tier-0` CLI flag lives in `vault-section-minto-generator.cjs`, not `bin/mindrian-tools.cjs`.** ACCEPTED - matches where `process.argv` is already consumed in that script.
15. **`expected-tier0-baseline.md` is a frozen committed snapshot, captured at task 2 before generator changes.** ACCEPTED - makes regressions visible via `git diff` instead of being laundered through test runtime.

**81-05 deviations:**

16. **`.planning/REQUIREMENTS.md` may not exist yet; task 8 creates it if missing.** ACCEPTED - conditional path based on repo state is the right call.
17. **Marketplace ref update is USER INSTRUCTION, not automated in-plan.** ACCEPTED - cross-repo write correctly flagged, not pretended to be automated.
18. **Release commit packaging: CHANGELOG + plugin.json + package.json + 81-05 code in one "release:" commit.** ACCEPTED - per release-process.md convention.
19. **No beta suffix (ships as `1.10.2` stable).** ACCEPTED - Phase 81 is feature release per 81-RESEARCH Section 7 and user directive, beta gating does not apply.
20. **Decision #17 added to BOTH `CLAUDE.md` and `.claude/includes/decisions.md`.** ACCEPTED - prevents invisible drift because CLAUDE.md reads the include.

**All 20 documented deviations are reasonable and justified. Zero undocumented deviations detected in spot-checks of plan content against CONTEXT and RESEARCH.**

## Recommendation

Proceed to execution via `/gsd:execute-phase 81` (recommended: new session to keep planning context clean).

Two NOTE-level observations are documented above. Neither blocks execution. The orchestrator should:
1. Execute 81-01 first (foundation, serial, blocks everything).
2. Execute 81-02 before committing 81-03 to avoid the disjoint-function-body merge pitfall (both sessions can run in parallel, but commit 81-02 before 81-03).
3. Execute 81-04 after both 81-02 and 81-03 have landed.
4. Execute 81-05 last, using `scripts/release.sh 1.10.2` for gates 13-17 where possible.
5. Expect 81-01 and 81-05 to each consume more context than a typical single-plan execution window - consider a fresh session per plan if context pressure mounts.

Plans verified. Phase 81 is cleared for execution.
