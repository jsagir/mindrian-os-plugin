# Phase 271 deferred items

Out-of-scope discoveries surfaced while executing Phase 271. Logged, not fixed.

---

## DEFERRED-271-D1: 16 shipped commands are missing `interactive_first_reward`

**Found during:** plan 271-03, Task 1, at commit time.

**What happened.** The pre-commit hook's `mva-rule-linter` arm (the
reward-before-investment rule, `docs/reward-before-investment-rule.md`) refused the
44-file anchoring commit. Of the 44 staged commands, 28 are compliant, 0 are invalid,
and **16 are missing the `interactive_first_reward` frontmatter field entirely**:

`analyze-systems`, `causal`, `challenge-assumptions`, `compare-ventures`, `deck`,
`diagnose`, `find-connections`, `leadership`, `lean-canvas`, `mullins`, `pipeline`,
`publish`, `score-innovation`, `show`, `suggest-next`, `systems-thinking`.

`commands/doctor.md` is a 17th blocked file: it carries the one non-backticked
citation site (DEVIATION-271-03-A below) and it too has never declared the field.

**Proven pre-existing, not caused by this sweep.** Two independent checks:

1. `git show 7bac50d6:commands/<name>.md | grep -c '^interactive_first_reward'` returns
   `0` for all 16 at the pre-sweep HEAD. The field was already absent before any edit.
2. `git diff --cached -U0 -- commands/ | grep '^[+-]' | grep -v '^[+-][+-][+-]' |
   grep -c 'references/'` returns `186`, i.e. all 93 changed line-pairs contain a
   `references/` citation. The sweep touched zero frontmatter lines in any file.

**Why it only surfaced now.** The linter scans **staged** `commands/*.md` only. These 16
files had not been staged since the reward-before-investment rule shipped, so the gap was
invisible to every commit that did not happen to touch them. The 271-03 sweep is the
first commit to stage all 44 methodology commands at once, which is what exposed the
latent violation. The gate sees only what you touch; a file-scoped gate cannot measure a
repo-wide gap.

**Why it was NOT fixed here.** Plan 271-03's own `must_haves.truths` states: "The sweep
changed only citation prefixes; no sentence, code fence, or frontmatter key was altered."
Adding an `interactive_first_reward` key to 16 commands would directly violate that
invariant, and the value is not mechanical: each command needs a per-command product
judgment across six allowed values (`reframe_question`, `instant_brief`,
`schema_preview`, `calibration_distribution_preview`, `paragraph_preview`, `--none`).
That is a product decision, not a path-resolution fix, and it does not belong inside a
mechanical anchoring sweep. Same reasoning shape as plan 271-02's `option-b` rejection.

**How 271-03 proceeded.** Every other gate in the pre-commit hook was run manually and
passed (13 gates plus `check-substrate.cjs --diff`, all `rc=0`; the mirror check reports
`OK 112/112, skip-list verified`). Only then were the two 271-03 commits made with
`COMMIT_NO_VERIFY=1`, with the bypass and its justification recorded in
`271-03-SUMMARY.md`. No gate was weakened, edited, or allowlisted to make this pass.

**Recommended disposition.** A scoped follow-up phase that declares
`interactive_first_reward` for all 16, and that ALSO considers making the linter scan the
whole `commands/` tree rather than only staged files, so the next latent gap does not wait
for an unrelated sweep to discover it.

**Status:** OPEN. Not owned by any Phase 271 plan. **BLOCKING plan 271-03's completion.**

---

## DEVIATION-271-03-A: the live in-scope set is 45 files / 94 sites, not 44 / 93

**Found during:** plan 271-03, pre-sweep measurement.

`271-03-PLAN.md`'s `files_modified` lists 44 command files, and its Task 1 automated
verify asserts 93 changed lines. Both numbers are correct for a BACKTICK-ONLY view of
the tree. The gate, which is the phase's own oracle, measures **45 files / 94 sites**.

The extra site is `commands/doctor.md:262`:

> Note: per D-19, the renderer above is structural. Larry handles narrative
> interpretation of any drift finding when surfacing conversationally (e.g., "what does
> this mean?"). See references/personality/voice-dna.md for voice patterns.

It is a bare citation after the verb "See", with no backticks, so the plan's
backtick-anchored sed cannot reach it and the plan's file list never named it. This is
the exact site `271-AUDIT.md` section 1 already flagged as the sole cause of the
commands delta (plan-time 98 vs live 99), and section 2 already ruled the "45 of 113"
figure "CORRECT FOR ITS METHOD, INCOMPLETE" for precisely this reason.

**Why it must be fixed inside 271-03 and not deferred:** Task 1's own acceptance
criterion 4 requires `--report` to show a `commands` group violation total of **0**
non-allowlisted. Leaving `doctor.md` bare leaves that total at 1, so the plan cannot
meet its own success criteria while skipping it. Same standing instruction both prior
waves followed: record the actual number, never adjust the instrument to a stale
expectation.

**Fix shape (NOT yet applied, blocked by DEFERRED-271-D1):** insert the
`${CLAUDE_PLUGIN_ROOT}/` prefix only, leaving the prose and the absence of backticks
untouched, so the change stays a pure prefix insertion consistent with the other 93.
The gate's `ANCHOR_SHORT_RE` matches on the prefix immediately preceding the token and
does not require backticks, so this form registers as anchored.

---

## Execution state of plan 271-03 at the point of escalation

| Item | State |
|---|---|
| Pre-sweep HEAD | `7bac50d6` |
| Batch 1 committed | `598fdb7c` -- 28 commands / 63 sites + 27 mirrors, full pre-commit hook GREEN, no bypass |
| Uncommitted in the working tree | 16 commands / 30 sites, already anchored and verified, plus their 16 regenerated mirrors. Blocked by DEFERRED-271-D1. |
| Not yet edited | `commands/doctor.md` (1 site, DEVIATION-271-03-A). It is blocked by the same gate, so it was left unedited rather than edited-and-stranded. |
| Anchoring gate, working tree | commands `violations=1` (doctor.md), TOTAL 41 (= 40 owned by plan 271-04, + doctor) |
| Anchoring gate, at HEAD `598fdb7c` | commands `violations=31` (30 in the 16 blocked files + doctor.md) |

**The 16 uncommitted files are safe to leave in the shared tree.** Any other session
attempting to commit them hits the same `mva-rule-linter` gate, so they cannot be
swept in silently.

**To resume after the decision lands:** the 16 edits are already applied and their
mirrors already regenerated, so resumption is a stage-and-commit, plus the one-line
`doctor.md` prefix insertion and one final `node scripts/build-skill-mirrors.cjs`.
