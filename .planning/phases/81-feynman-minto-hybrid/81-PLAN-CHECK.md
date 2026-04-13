---
phase: "81"
reviewer: gsd-plan-checker
created: 2026-04-14
revision: 2
verdict: PASS_WITH_NOTES
---

# Phase 81 Plan Check (Revision 2)

## Verdict: PASS_WITH_NOTES

All four Revision 2 plans (81-01 through 81-04) are architecturally aligned with the CONTEXT.md Revision 2 reframe. Zero Revision 1 machinery appears as active scope; all mentions of `llm-call.cjs`, `budget-ops.cjs`, `ANTHROPIC_API_KEY`, `/mos:budget`, FEYNMINTO-05, and FEYNMINTO-06 appear only in "Out of Scope" negations or as explicit RETIRED markers. Every active FEYNMINTO requirement (01, 02, 03, 04, 07, 08, 09, 10) is covered by at least one plan. Zero em-dashes detected across all four files. CJS-only, node built-in assert only, zero new runtime dependencies. Dependency chain is linear and correctly declared as `parallel_safe: false`. All five release gates are addressed in 81-04 (with gate 5, marketplace.json, correctly flagged as a cross-repo user handoff). A small number of NOTE-level observations are recorded below; none are blockers.

## Revision 2 Architecture Compliance

- `llm-call.cjs`: OK - appears only in 81-01 Out of Scope negation and in `_superseded/` (not read).
- `budget-ops.cjs`: OK - same.
- `__test_fetch_shim.cjs`: OK - not referenced in any active plan.
- `/mos:budget` command: OK - appears only in 81-01 Out of Scope negation.
- `ANTHROPIC_API_KEY`: OK - appears only in 81-01 Out of Scope and 81-03 Out of Scope as explicit negation.
- `fetch('https://api.anthropic.com...')` or similar: OK - no such reference.
- Cost budget/meter/cap machinery: OK - absent from all active plans.
- FEYNMINTO-05 / FEYNMINTO-06 as active: OK - appear only as RETIRED markers in 81-04 task 1 and Requirements Covered.
- Tier-0 trigger framing: OK - correctly described as "no narrative provided" / "no Claude in the loop" in 81-03 (R-4 language), not "LLM unreachable" or "budget exceeded".

All architectural tripwires pass.

## Coverage Matrix

| Requirement | Plan(s) | Verified | Notes |
|---|---|---|---|
| FEYNMINTO-01 | 81-02 (integration test 15000-char bound), 81-04 (finalization) | yes | Bound is a conservative char proxy for the 1500-token target. Acceptable. |
| FEYNMINTO-02 | 81-01, 81-03 | yes | `--plan` and `--write` subcommands, zero external calls. |
| FEYNMINTO-03 | 81-01 (foundation), 81-02 (orchestrator) | yes | Prompts live in `lib/memory/feynman-prompts.cjs`, consumed by `commands/reason.md`. |
| FEYNMINTO-04 | 81-03 | yes | Tier-0 fallback wired via `runTier0()` single entry point. |
| FEYNMINTO-05 | RETIRED | - | Correctly marked RETIRED in 81-04, not re-introduced. |
| FEYNMINTO-06 | RETIRED | - | Same. |
| FEYNMINTO-07 | 81-04 | yes | `--regenerate-all` with backup directory and report file. |
| FEYNMINTO-08 | 81-03 | yes | Frozen baseline snapshot + regression test in `scripts/vault-section-minto-generator.integration.test.cjs`. |
| FEYNMINTO-09 | 81-01, 81-02 | yes | Single source of truth in library; drift check in 81-02 task 7 enforces equality between library exports and `commands/reason.md` inlined copies. |
| FEYNMINTO-10 | 81-02 | yes | Tri-polar surface coverage addressed in Requirements Covered: "works natively on CLI, Desktop, and Cowork because all three surfaces run slash commands in the same Claude session model; no surface-specific code". |

Exhaustive cross-check against PROJECT.md / ROADMAP.md: no requirements relevant to Phase 81 are silently dropped. The only two requirements absent from active plans are FEYNMINTO-05 and FEYNMINTO-06, which are correctly RETIRED per Revision 2.

## Issues Found

### BLOCK
None.

### NOTE

1. **Filename deviation from CONTEXT.md is consistent but double-documented.** CONTEXT.md R-2 says `commands/mos-reason.md`. All four plans use `commands/reason.md` and cite the actual existing filename. 81-01 and 81-02 Deviation Notes record this. 81-03 and 81-04 inherit the choice implicitly (they modify the same file). Not a blocker because the planner has correctly surfaced the deviation and the file actually exists. Recommendation: a one-line note in 81-04's Deviation Notes that Decision 17's description of the slash command should also say `commands/reason.md`, so CLAUDE.md does not drift from reality.

2. **Scope size at borderline for 81-01 and 81-04.** 81-01 has 10 numbered tasks and touches or creates 7 files. 81-04 has 12 tasks and touches 8 files plus a cross-repo handoff. Both are within the defensible range for "foundation" and "release" plans respectively, but the margin is thin. 81-02 (8 tasks) and 81-03 (9 tasks) are comfortable. No split required; flagging so execution phase can watch context usage.

3. **`MINTO_FROZEN_DATE` adoption is plan-by-plan rather than centralized.** 81-01 risk section acknowledges that `today()` in the preserved renderer may need wrapping. 81-03 risk section independently proposes the same wrapping. The planner's Deviation Notes flagged this as "MINTO_FROZEN_DATE env var OR regex-strip-date, both documented, user picks". The two plans do not explicitly hand off the chosen approach to each other. Recommendation: during execution of 81-01 task 7/8, commit to the env-var approach and record it in the Deviation Notes of both 81-01 and 81-03 so the frozen baseline in 81-03 is captured under the same convention.

4. **Fixture section folder structure vs Decision 16 compliance is asserted but not independently verified in this review.** 81-01 task 5 and 81-02 tasks 1-2 claim each fixture artifact lives in a named nested folder under `section/artifact-name/artifact-name.md`. This is correct per Decision 16. Flagging only because the runtime check (`node -e "require('./lib/vault/room-scanner.cjs').scanRoom(...)"`) is the acceptance test, and if that helper does not exist at the referenced path, the tasks will fail at execution time. Recommendation: as the first sub-step of 81-01 task 5, run `ls lib/vault/room-scanner.cjs` to confirm the helper exists before authoring the fixture.

5. **Integration test drift check in 81-02 task 7 is described but not fully specified.** The test is supposed to "extract the inlined prompt strings via regex-delimited blocks or named HTML comments" from `commands/reason.md` and assert equality with library exports. The plan leaves the delimiter choice to implementation. This is fine for a plan, but the execution agent will need to decide on HTML comment sentinels (e.g., `<!-- STAGE_1_ESSENCE start -->`) before writing `commands/reason.md` in task 6, so tasks 6 and 7 cannot be completed in isolation. Recommendation: execute task 6 and task 7 as a single commit pair.

### OBSERVATION

1. 81-02 task 6's temp file path uses `/tmp/mos-reason-<section>-<timestamp>.json` with `<roomDir>/.mos-reason-tmp/` as fallback. Both are documented in the slash command body per the Deviation Notes. Good.

2. 81-04 Risk 3 correctly identifies the hazard that `vault-regenerate-all.cjs` runs tier-0 unconditionally and notes the backup directory plus subsequent tier-1 loop as the belt-and-suspenders mitigation. The belt-and-suspenders reasoning is sound.

3. 81-04 correctly refuses beta-gating. Feature work ships to stable; the release-process include's beta rule applies to release infrastructure (release.sh, hooks, migration scripts), not to feature phases. The plan documents this explicitly.

4. The `FEYNMINTO_FROZEN_DATE` env-var used in every verification block is the right determinism primitive. Consistent across all four plans.

5. Every plan's Verification block includes a `grep -rn $'\u2014' ... && exit 1 || exit 0` em-dash guard. The guard excludes the plan files themselves, which is correct: the plan files contain hyphens only (verified: 0 em-dashes in 81-01/02/03/04).

## Dependency Chain Verification

| Plan | depends_on | parallel_safe | Correct? |
|---|---|---|---|
| 81-01 | [] | false | yes |
| 81-02 | ["81-01"] | false | yes |
| 81-03 | ["81-01", "81-02"] | false | yes |
| 81-04 | ["81-03"] | false | yes |

Linear 81-01 -> 81-02 -> 81-03 -> 81-04 chain confirmed. No `parallel_safe: true` declarations present. The Revision 1 "stages 1+2 vs stages 4+5" split is correctly dissolved: there is no parallel Feynman-stage plan pair.

## Release Gate Verification (81-04)

| Gate | Addressed in 81-04 | Task |
|---|---|---|
| 1. CHANGELOG.md [1.10.2] entry with all 7 required points | yes | task 8 |
| 2. `.claude-plugin/plugin.json` version = 1.10.2 | yes | task 9 |
| 3. `package.json` version = 1.10.2 | yes | task 10 |
| 4. git tag v1.10.2 | yes | task 12 (user-supervised close) |
| 5. marketplace.json `source.ref: v1.10.2` | flagged as cross-repo user handoff | Scope section + task 12 footnote |

Gate 5 is correctly flagged as a cross-repo handoff because `~/mindrian-marketplace/` is a separate repository. This matches the release-process.md instruction that the user must run that update manually (or the future `scripts/release.sh` will, once it exists). No beta-gating; feature work ships to stable.

## Deviation Audit

| # | Deviation | Documented In | Accepted? |
|---|---|---|---|
| 1 | `commands/reason.md` not `commands/mos-reason.md` | 81-01, 81-02 Deviation Notes | Accepted. Actual file on disk wins. |
| 2 | Inline prompts into slash command + drift-check test | 81-02 Deviation Notes + task 7 | Accepted. Drift check restores SSoT guarantee. |
| 3 | Temp file `/tmp/` primary with `<roomDir>/.mos-reason-tmp/` fallback | 81-02 Deviation Notes | Accepted. Addresses Cowork container edge case. |
| 4 | Single `runTier0()` entry point | 81-03 Deviation Notes + task 9 | Accepted. Maintainability justification holds. |
| 5 | Tier-0 pre-pass before tier-1 regen loop in `--regenerate-all` | 81-04 Deviation Notes + Risk 3 | Accepted. Belt-and-suspenders mitigation is sound; backup dir alone is sufficient, tier-0 pre-pass is strict improvement. |
| 6 | `MINTO_FROZEN_DATE` env var OR regex-strip-date | 81-01 Risk + 81-03 Risk | Accepted but see NOTE 3: commit to one approach during execution of 81-01 and hand off to 81-03. |

All six planner-flagged deviations are documented with justification. None are contested.

## Recommendation

Proceed to execution via `/gsd:execute-phase 81` (fresh session recommended).

The five NOTE items above are optional refinements and do not block execution. They can be addressed inline during implementation or rolled into the post-execution verifier pass. The plans are architecturally sound against the Revision 2 reframe, the coverage matrix is complete for all active requirements, the dependency chain is strictly linear, and the release gates are all addressed.
