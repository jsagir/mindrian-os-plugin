---
phase: quick-260725-vvc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
autonomous: true
requirements: [QUICK-260725-VVC]
tags: [claude-md, rule-density, context-engineering, canon]
must_haves:
  truths:
    - "CLAUDE.md's Tri-Polar Design Rule heading and body no longer say MANDATORY / MUST; they state the three-surface check as the strong default plus a why-clause"
    - "CLAUDE.md's Part 6 Dog-Fooding and Part 7 Reuse-Before-Build summary lines drop must-honor/must-justify absolutes for strong-default phrasing plus a why-clause"
    - "CLAUDE.md's Part 12 Pedagogy line drops never grade, never compliment for a default-to phrasing plus a why-clause"
    - "CLAUDE.md's QA/RCA line drops Classify, never just report for a default-practice phrasing plus a why-clause"
    - "Every other line in CLAUDE.md, including the 5 named invariants (Part 8, WORKSPACE GUARD, version lockstep via release-process.md, Part 9, langtalks corpus-gap rule), is byte-identical to the pre-edit file"
    - "No em-dash character appears in the 4 edited spots"
  artifacts:
    - path: "CLAUDE.md"
      provides: "4 rule-density markers reworded to strong-default-plus-why-clause language, mirroring Part 11's already-shipped advisory-lint tone"
  key_links:
    - from: "the 4 reworded markers"
      to: "Part 11 Invocation Constitution paragraph (same file, unedited)"
      via: "matching register: strong default statement + short why-clause, no bare MUST/NEVER/MANDATORY"
      pattern: "strong default|default to"
---

<objective>
Soften 4 rule-density markers in CLAUDE.md from absolute enforcement language
(MANDATORY/MUST/NEVER) to strong-default-plus-why-clause language, per the
"give rules, then trust judgment" shift in the Anthropic context-engineering
article this session ingested via langtalks-graph-expert. This session already
graded this file's "Rules vs. judgment" dimension C- against that article;
this plan fixes the 4 markers identified, leaving the file's 5 genuine
invariants (Brain IP boundary/Part 8, workspace guard, version lockstep, Part
9 human-confirm-truth-claim, corpus-gap honesty) completely untouched, since
those guard real legal/business/governance/epistemic boundaries, not model
limitations.

Tone to mirror (already shipped in this file, do not edit it): Part 11's
Invocation Constitution bullet describes its own enforcement as "checked ...
as an ADVISORY lint signal as of Phase 210 (WARN with every violation
enumerated, never a block; --strict restores hard-fail)" - clearly stated,
clearly the intended default, not framed as an absolute the model has no room
to reason about.

Purpose: bring this file's rule-density closer to what current-generation
Claude models work best with, without touching anything that guards a real
invariant.
Output: CLAUDE.md with exactly 4 lines/bullets reworded, one atomic commit.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260725-vvc-soften-4-rule-density-markers-in-claude-/260725-vvc-CONTEXT.md

Repo-wide HARD RULE binding on the edit itself: no em-dashes anywhere; use
" - " (space-hyphen-space) the way this file already does elsewhere.

Scope discretion already resolved: CONTEXT.md's "Claude's Discretion" section
floats an optional 5th edit (a framing sentence near the top of Canon
Compliance Core distinguishing invariant Parts from strong-default Parts).
This plan does NOT include that edit - the task-level constraint "touch ONLY
these 4 markers, nothing else in the file" is stricter and takes precedence
over that optional invitation. Do not add it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reword the 4 rule-density markers in CLAUDE.md</name>
  <files>CLAUDE.md</files>
  <action>
Make exactly these 4 edits in CLAUDE.md (re-check current line numbers first,
they may have shifted; match old text byte-for-byte). Touch nothing else in
the file, no other file.

Marker 1, Tri-Polar Design Rule (near line 29-31). Old heading:
"## Tri-Polar Design Rule (MANDATORY)". Old body: "Every feature MUST be
evaluated through all three surfaces before it ships; a feature that only
works on one is incomplete." New heading: "## Tri-Polar Design Rule (STRONG
DEFAULT)". New body: "Evaluate every feature through all three surfaces
before it ships - a feature that only works on one leaves a gap on the other
two install targets, so treat a skip as a deliberate, stated call, not an
oversight."

Marker 2, Part 6 + Part 7 Canon bullets (near line 47-48). Old Part 6: "The
plugin is a venture in its own room and must honor its own canon; a
violation is a CONTRADICTS edge against it." New Part 6 body: "The plugin is
a venture in its own room; honoring its own canon here is the strong
default, since a real violation surfaces as a CONTRADICTS edge against it."
Old Part 7: "Search the 25 methodology commands first; the plan must justify
any net-new surface against them." New Part 7 body: "Search the 25
methodology commands first and justify any net-new surface against them,
since duplicating an existing command is the more common failure mode than
missing a genuine gap." Keep both bullets' bold Part labels and trailing
"Deep dive:" links unchanged.

Marker 3, Part 12 Pedagogy bullet (near line 51). Old: "never grade, never
compliment." New: "default to withholding grades and compliments, since
praise and scores pull attention onto Larry instead of the insight the user
just reached." Keep the rest of the bullet (invisibility clause, De Stijl
color mark clause, Deep dive link) unchanged.

Marker 4, QA/RCA bullet (near line 172). Old: "Classify, never just
report: every finding is WORKING, a known tracked bug, ENV GAP, or NEW
FAILURE. Only a NEW FAILURE warrants a fresh /gsd:debug session." New:
"Classify before reporting: default every finding to WORKING, a known
tracked bug, ENV GAP, or NEW FAILURE, since an unclassified finding leaves
the reader guessing whether it needs action; only a NEW FAILURE warrants a
fresh /gsd:debug session." (both keep the bold-lead-phrase and backtick
command formatting from the original bullet)

Minor phrasing may be adjusted from the above if needed, as long as each
edit: keeps the same factual content/intent, drops the absolute
MANDATORY/MUST/NEVER framing, adds a short why-clause, and uses no em-dash
character. After all 4 edits, re-scan the full file to confirm every other
line (Project, Stack, Conventions, Architecture, GSD Workflow Enforcement,
Dev-Research Compositing, langtalks consult rule, Developer Profile, Project
Skills, all 4 @include lines, Parts 3/8/9/11) is unchanged.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && ! grep -n "MUST be evaluated\|(MANDATORY)$\|never grade, never compliment\|Classify, never just report" CLAUDE.md</automated>
  </verify>
  <done>All 4 markers reworded to strong-default-plus-why-clause phrasing; grep for the 4 old phrases returns zero hits; no other content changed.</done>
</task>

<task type="auto">
  <name>Task 2: Diff-verify scope, em-dash sweep, commit</name>
  <files>(no new files - verifying and committing Task 1's edit to CLAUDE.md)</files>
  <action>
Run `git diff CLAUDE.md` and confirm the diff touches only the 4 marker
regions (Tri-Polar heading+body, Part 6 bullet, Part 7 bullet, Part 12
bullet, QA/RCA bullet) and nothing else - no changes to Part 3, Part 8,
Part 9, Part 11, the WORKSPACE GUARD section, the Verification section, the
@include lines, or any line below the QA/RCA section. If the diff shows any
unintended hunk, revert it before proceeding.

Em-dash sweep: grep the diff for the em-dash character; zero hits required
(repo HARD RULE, hyphens only).

Confirm the 5 named invariants are present verbatim and untouched: Part 8
Graph Boundary bullet, the WORKSPACE GUARD section, the release-process.md
version-lockstep include reference, Part 9 Memory Locality bullet, and the
"Consult langtalks-graph-expert" corpus-gap-honesty section.

Then make one atomic commit (workspace guard: confirm pwd is
/home/jsagi/dev/MindrianOS-Plugin, never the plugin cache) with message:

  docs(claude-md): soften 4 rule-density markers toward trusted judgment

  Reword Tri-Polar Design Rule, Part 6/Part 7 Canon summaries, Part 12
  Pedagogy, and QA/RCA classify line from MANDATORY/MUST/NEVER framing to
  strong-default-plus-why-clause language, mirroring this file's own
  already-shipped Part 11 advisory-lint tone. The 5 genuine invariants
  (Part 8, workspace guard, version lockstep, Part 9, corpus-gap honesty)
  are untouched.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && git show --stat HEAD -- CLAUDE.md | grep -q "CLAUDE.md" && git status --porcelain | wc -l</automated>
  </verify>
  <done>Diff scoped to exactly the 4 markers, em-dash sweep clean, one new commit containing the CLAUDE.md edit, working tree clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLAUDE.md prose -> Claude Code agent context | Plain-text project instructions loaded into every session; no external input crosses this edit |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vvc-01 | Tampering | CLAUDE.md rule-density markers | mitigate | Task 2 diffs the commit against the 4 named regions only; any unintended hunk is reverted before commit |
| T-vvc-02 | Repudiation | Softened invariant boundary | accept | The 5 genuine invariants (Part 8, workspace guard, version lockstep, Part 9, corpus-gap honesty) are explicitly excluded from this edit and verified untouched in Task 2 |
| T-vvc-SC | Tampering | npm/pip/cargo installs | accept | No package-manager installs in this plan; pure prose edit to one existing file |
</threat_model>

<verification>
- `git diff CLAUDE.md` before commit shows changes confined to the 4 marker regions
- grep for the 4 old absolute phrases ("MUST be evaluated", "(MANDATORY)", "never grade, never compliment", "Classify, never just report") returns zero hits post-edit
- The 5 named invariants (Part 8, WORKSPACE GUARD, version lockstep, Part 9, langtalks corpus-gap rule) are present and byte-identical to the pre-edit file
- No em-dash character in the edited regions
- One atomic commit exists containing the CLAUDE.md change
</verification>

<success_criteria>
- 4 rule-density markers reworded to strong-default-plus-why-clause language, matching Part 11's existing tone
- 5 genuine invariants and every other line in CLAUDE.md unchanged
- No em-dashes introduced
- One atomic commit
</success_criteria>

<output>
Create `.planning/quick/260725-vvc-soften-4-rule-density-markers-in-claude-/260725-vvc-SUMMARY.md` when done
</output>
