---
phase: quick-260717-jud
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md exists and is byte-identical to the approved verbatim content embedded in this plan"
    - "The spec file is committed to git (docs/ is tracked; commit runs from /home/jsagi/dev/MindrianOS-Plugin per the WORKSPACE GUARD)"
  artifacts:
    - path: "docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md"
      provides: "Skill fleet optimization design spec (trigger-accuracy + code-quality, approved in superpowers:brainstorming session)"
      contains: "# MindrianOS Skill Fleet Optimization"
  key_links:
    - from: "docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md"
      to: "git history"
      via: "docs commit"
      pattern: "skill-fleet-optimization|skill-optimization"
---

<objective>
Write the already-approved skill-fleet-optimization design spec to `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md` and commit it.

Purpose: The design was fully produced and approved in a superpowers:brainstorming session (clarifying questions asked and answered). This task is a literal file write of that approved content -- NOT content generation, NOT re-derivation, NOT summarization. The spec then becomes the input for a future GSD phase that plans the actual 124-skill pipeline.

Output: One new tracked file in `docs/superpowers/specs/` (joining the 4 existing design docs there), committed to main.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
No source-file reads are required. The complete file content is embedded verbatim in the `<verbatim_content>` section of this plan. Do not read `skills/` or re-verify any claim inside the spec -- the content is frozen as approved.

Workspace rule (project CLAUDE.md): run everything from `/home/jsagi/dev/MindrianOS-Plugin/`, never the `~/.claude/plugins/` install cache.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the approved spec verbatim and commit</name>
  <files>docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md</files>
  <action>
    Create `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md` using the Write tool. The file content is EXACTLY the text between the `BEGIN VERBATIM FILE CONTENT` and `END VERBATIM FILE CONTENT` sentinel lines in the `<verbatim_content>` section below -- exclusive of the sentinel lines themselves, with a single trailing newline at end of file.

    Hard constraints:
    - Copy character-for-character. Do NOT paraphrase, summarize, reformat, "improve", reflow, or re-derive any part of it. Do NOT add frontmatter, a title change, or any wrapper text.
    - Preserve every `--` double-hyphen sequence exactly as written (these are intentional per repo convention: hyphens, never em-dashes).
    - Preserve the fenced code block (the Data flow diagram) exactly, including its `->` arrows, `||` parallel marker, and indentation.
    - Preserve all backticked paths, URLs, and the `[STOP -- human approval gate]` bracket text exactly.
    - This content was approved by the user in a brainstorming session; any deviation is a fidelity failure, not an improvement.

    Then commit from `/home/jsagi/dev/MindrianOS-Plugin/` (WORKSPACE GUARD: confirm `pwd` is the dev workspace, not the plugin cache):
    `git add docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md && git commit -m "docs: add skill-fleet-optimization design spec (trigger-accuracy + code-quality, 2026-07-17)"`

    Commit ONLY this file -- no `git add -A`, no other staged paths.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && test -f docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md && head -1 docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md | grep -q '^# MindrianOS Skill Fleet Optimization -- Trigger-Accuracy + Code-Quality Design$' && [ "$(grep -c '^## ' docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md)" = "10" ] && grep -q 'once past this spec-writing step\.$' docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md && [ -z "$(git status --porcelain docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md)" ] && git log --oneline -1 -- docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md | grep -q 'skill-fleet-optimization'</automated>
  </verify>
  <done>File exists at the target path with the exact approved content (first line matches the H1 title, exactly 10 `##` sections: Problem, Goal, Workstream 1, Workstream 2, Data flow, Error handling, Testing / rollout safety, Output artifacts, Out of scope, Next step; final sentence intact), working tree is clean for that path, and a commit touching only that file is on the branch.</done>
</task>

</tasks>

<verbatim_content>
The following is the complete, frozen file content. Everything between the two sentinel lines (exclusive) is the file, byte for byte, plus one trailing newline.

BEGIN VERBATIM FILE CONTENT
# MindrianOS Skill Fleet Optimization -- Trigger-Accuracy + Code-Quality Design

- **Date**: 2026-07-17
- **Status**: design approved (superpowers:brainstorming session), spec written, pending user review of this file
- **Scope**: all 124 `SKILL.md` files under `skills/` in this repo (MindrianOS-Plugin's own skill catalog -- not the other plugins visible in a live Claude Code session, e.g. superpowers, vercel, supabase, gsd-*, which are separate installs)
- **Authority trail**:
  - `https://agentskills.io/skill-creation/optimizing-descriptions` -- external methodology for skill-description trigger-accuracy, fetched and read this session (eval-query design, train/validation split, the optimization loop, the official `skill-creator` reference tool at `github.com/anthropics/skills/tree/main/skills/skill-creator`)
  - Live repo trace this session: `skills/` (124 `SKILL.md` files confirmed via `find`; 0 have a dedicated `scripts/` subdirectory -- backing `.cjs` machinery lives in the shared top-level `scripts/`); `docs/superpowers/specs/` (existing convention, 4 prior design docs); `.planning/ROADMAP.md` (current phase: 229, in progress)
  - superpowers:brainstorming session this conversation -- clarifying questions asked and answered: (1) full fleet, all 124 skills, not a smaller pilot; (2) judge-funnel trigger-accuracy pass for all 124, bundled with a code-quality review pass for the script/workflow-backed subset, in one pipeline

## Problem

MindrianOS ships 124 skills. Each skill's `description` frontmatter field is the only thing an agent reads before deciding whether to load it (progressive disclosure) -- an under-specified description means the skill silently never fires when it should; an over-broad one fires when it shouldn't. This session already lived through two live instances of exactly this failure class from the opposite direction (`check-card-fire.cjs` over-firing on plain prose with no real gate present, `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`, now 3 confirmed instances). At 124 skills, many sharing a namespace and adjacent scope (`mos:find-connections` / `mos:find-analogies` / `mos:find-bottlenecks`; `mos:explore-domains` / `mos:explore-trends` / `mos:explore-futures`), the same failure class -- wrong skill fires, right skill doesn't, near-miss steals the fire -- is structurally likely across the catalog and has never been systematically measured.

Separately, roughly 10-20 of these skills are not pure prose -- they front real `.cjs` machinery in the shared `scripts/` directory (doctor, eureka, check-card-fire and its siblings, the reach/navigation engine). A wrong trigger on one of these isn't just a wasted context load, it's wrong or unwanted code execution. Those skills carry two independent risks -- does the description trigger correctly, and is the code behind it sound -- and the second one has already surfaced a real, still-open bug this session.

## Goal

One pipeline, two independent workstreams, one merged report. Nothing is auto-applied to any `SKILL.md` or backing script -- every proposed change (description rewrite or code-quality finding) is written to disk in the pipeline's own output only, gated behind explicit user approval before it touches the actual skill files.

## Workstream 1 -- Trigger accuracy (all 124 skills)

**1. Inventory.** Parse all 124 `skills/*/SKILL.md`. Extract `name`, `description`, body content. Detect script/workflow backing by grepping each skill's body for references to `scripts/*.cjs`, `bin/*.cjs`, or `Workflow(` usage. Group skills by namespace family (`mos:`, `gsd-`, and any ungrouped remainder) -- family membership drives query generation in step 2.

**2. Eval query generation, per family, not per skill.** For each family, one agent sees every skill in that family at once and writes eval queries so negative examples are real siblings, not generic noise -- per agentskills.io's own guidance, the highest-value negative test cases are near-misses that share keywords/concepts but need a different skill, and MindrianOS's own namespace families are full of exactly that shape. Target ~6-8 queries per skill for this first pass (lighter than agentskills.io's full 20 -- the full 20-query treatment is reserved for skills that get flagged in step 4). Each query is labeled with an `expected_skill` (or `none`), split into train (~60%) and validation (~40%) sets, stratified so both sets carry a proportional should-trigger / should-not-trigger mix.

**3. Cheap funnel pass, one call per query, not per skill.** A judge agent is given the query plus the **full 124-skill roster** (name + description for every skill, not just the target skill) and predicts which skill, if any, would fire. This mirrors real progressive disclosure -- Claude sees the whole roster every time, so competitive false-positives (two skills fighting over one query) and false-negatives (nothing fires when something should) are both caught -- and it costs roughly one call per query (~800-1,000 total across the fleet) instead of a full per-skill isolated real-invocation loop (~7,500 calls at agentskills.io's literal spec).

**4. Flag.** Any skill with a train-set miss (predicted skill != expected label on any train-set query) is flagged for the full rigorous treatment. A funnel judgment that is itself low-confidence or ambiguous also flags its skill -- fail open toward more scrutiny, never less.

**5. Full trigger-test loop, flagged skills only.** agentskills.io's literal loop: expand to the full ~20-query set, run each query 3x through a real subagent with the skill actually installed, observe genuine Skill-tool invocation (not judge simulation), compute trigger rate per query, revise the description against train-set failures only, up to 5 iterations, select the best-by-validation-pass-rate description rather than assuming the last iteration is best (overfitting risk is explicit in the source methodology).

## Workstream 2 -- Code quality (script/workflow-backed skills only, ~10-20 of the 124)

Independent of trigger-flag status -- every skill identified in step 1 as backed by real `.cjs` machinery gets a code-review pass over that machinery, using the same shape as this repo's own `code-review` skill: findings ranked by severity, then adversarially verified (a second, independent pass tries to refute each finding) before anything is reported. This is scoped to *reviewing existing machinery for defects*, not rewriting it -- the check-card-fire.cjs over-enforcement bug already logged this session (`.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`) is exactly the kind of finding this workstream exists to catch systematically instead of one live instance at a time.

## Data flow

```
Inventory (124 skills, family-grouped, script/workflow-backing flagged)
  -> per-family query generation (eval_queries.json per skill, train/val split)
  -> per-query funnel judge (full-roster context, ~1 call per query)
  -> flag (train-set miss OR low-confidence)
       -> flagged skills: full literal trigger-test loop (real invocation, iterate, select best-by-validation)
  || (parallel, independent) script/workflow-backed subset: code-review -> adversarial verify
  -> merge into one report: per-skill trigger verdict (unchanged / proposed description diff) + code-quality findings for the backed subset
  -> [STOP -- human approval gate] -> only approved changes get written to real SKILL.md / script files
```

## Error handling

- Query generation failure for a family: retry once, then skip that family and log it explicitly in the report as "not evaluated" -- never a silent drop (this repo's own recent history has two logged instances of silent-skip failures this exact session's memory surfaced; this pipeline does not add a third).
- Funnel judge disagreement or low-confidence verdict: treated as a flag, not a pass -- see step 4 above.
- Full trigger-test loop non-convergence after 5 iterations: keep the best-by-validation description, mark the skill "did not fully converge" in the report rather than silently presenting the last iteration as final.
- Code-review findings that fail adversarial verification: dropped from the report, not silently downgraded -- only CONFIRMED/PLAUSIBLE survivors are shown.

## Testing / rollout safety

Before spending the full 124-skill budget, smoke-test the harness itself on a small handful of already-known skills (implementation hygiene, not a re-opening of the "full fleet" scope decision) -- confirm the funnel's judgments roughly match manual expectation and the full-loop mechanics actually detect a real Skill-tool invocation before trusting either at scale.

## Output artifacts

- This spec: `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- Pipeline run artifacts (eval query sets, funnel results, full-loop iteration logs): a new scratch/report location under `.planning/` (exact path decided at planning time -- not `skills/` itself, so nothing pipeline-generated is mistaken for a shipped skill)
- Final report: per-skill trigger verdict + proposed description diffs, plus code-quality findings for the script/workflow-backed subset. Nothing in this list is a write to a real `SKILL.md` or script -- those writes happen only after explicit user review and approval, batched or per-skill at the user's discretion.

## Out of scope (this pass)

- Any Workflow-tool invocation to actually run the fleet-wide pipeline -- that is a future execution step requiring the user's explicit multi-agent-orchestration opt-in (per this session's own tool-use constraints), not something this design or its immediate implementation plan triggers on its own.
- Auto-applying any proposed description rewrite or code fix -- see Output artifacts above.
- Optimizing skills outside `MindrianOS-Plugin/skills/` (other installed plugins are out of scope by definition -- this repo does not own them).

## Next step

Hand this spec to `writing-plans`-equivalent planning inside this repo's own GSD machinery (this repo's `CLAUDE.md` requires GSD-gated file changes) to produce the executable plan -- given the scope (124-skill fleet, two workstreams, eventual Workflow orchestration), this is sized as its own GSD phase rather than a `/gsd-quick` task once past this spec-writing step.
END VERBATIM FILE CONTENT
</verbatim_content>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | Documentation-only write to a tracked docs/ path; no code executes, no package installs, no untrusted input crosses any boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | Spec content fidelity | mitigate | Verbatim-copy constraint + automated structural checks (H1 title, 10 section count, final-sentence grep) in Task 1 verify |
</threat_model>

<verification>
- Target file exists at `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- Content is the embedded verbatim block, unaltered (structural checks in Task 1's automated verify)
- Commit exists touching only that file; `git status --porcelain` for the path is empty
</verification>

<success_criteria>
- The approved design spec is on disk at the exact path named inside the spec itself, byte-identical to the approved content
- The spec is committed from the dev workspace with a docs-scoped commit message
- No other file in the repo was modified
</success_criteria>

<output>
Create `.planning/quick/260717-jud-write-skill-fleet-optimization-design-sp/260717-jud-SUMMARY.md` when done.
</output>
