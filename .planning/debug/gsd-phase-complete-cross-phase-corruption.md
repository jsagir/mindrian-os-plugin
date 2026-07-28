---
status: gathering            # gathering | investigating | fixing | resolved
kind: rca
trigger: "gsd-phase-complete-cross-phase-corruption"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-28T08:45:00Z
updated: 2026-07-28T08:45:00Z
---

## Current Focus

hypothesis: `gsd_run query phase.complete <N>` (from the globally-installed
`~/.claude/gsd-core/bin/gsd-tools.cjs`, requiring `lib/phase.cjs` /
`lib/roadmap.cjs` / `lib/state.cjs`) rewrites `.planning/ROADMAP.md` and
`.planning/STATE.md` in full rather than patching only the targeted phase's
lines, and on this repo's current STATE.md/ROADMAP.md shape it both silently
mutated an UNRELATED phase's plan checkbox and regressed a field that had
already been correctly set by prior work.
test: ran `node ~/.claude/gsd-core/bin/gsd-tools.cjs query phase.complete 235`
against this repo (MindrianOS-Plugin, on `main`, right after Phase 235's two
plans were genuinely complete and committed) and diffed the result against the
pre-call committed state.
expecting: `phase.complete 235` should touch only phase-235-scoped lines in
ROADMAP.md (its own checkbox/progress-table row, already correct) and
STATE.md (advance Current Position to the next phase), and must never write
`[x]` against a plan with no SUMMARY.md and no commit.
next_action: none from this session (worked around by hand -- see Resolution).
A future session should pin down the exact write path in
`~/.claude/gsd-core/bin/lib/roadmap.cjs` / `lib/state.cjs` that produced the
241-04 mutation.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Tool at fault: `~/.claude/gsd-core/bin/gsd-tools.cjs` (globally installed
  GSD tooling, NOT part of this repo's own tracked code)
- Plugin version: MindrianOS-Plugin @ commit `4666486e` (HEAD at time of call)
- Reported by: Claude Code session executing `/gsd-execute-phase 235`
- Date first observed: 2026-07-28
- Related debug sessions: none

## Problem Statement

Running `gsd-tools.cjs query phase.complete 235` (the standard GSD
phase-completion step) after Phase 235's two plans were genuinely done wrote a
false `[x]` completion marker against `241-04-PLAN.md` -- a different phase's
plan, with no `SUMMARY.md` and no commit anywhere in git history -- and
separately regressed `STATE.md`'s `stopped_at` frontmatter field from the
correct `Completed 235-02-PLAN.md` back to the stale `Completed 234-02-PLAN.md`
(the prior milestone's last plan). Two `[gsd-tools] WARNING: STATE.md field
"Current Phase Name" not found` / `"Last Activity Description" not found`
lines printed on stderr during the same call, suggesting the tool's STATE.md
parser does not match this repo's actual (richer, narrative) STATE.md format
and silently falls back to some other, incorrect source for those fields.

## Symptoms

expected: `phase.complete 235` marks Phase 235 complete (already done by the
executor's own commit) and advances `STATE.md`'s Current Position to Phase
236, touching nothing else.
actual: `git diff` after the call showed (a) `.planning/ROADMAP.md` line for
`241-04-PLAN.md` flipped from `- [ ]` to `- [x] ... (completed 2026-07-28)`,
(b) dozens of unrelated blank-line/whitespace insertions scattered across the
236/241/242/243 ROADMAP sections (full-file reserialization, not a
line-targeted patch), (c) `STATE.md` frontmatter `stopped_at` changed from
`Completed 235-02-PLAN.md` to `Completed 234-02-PLAN.md`, `last_activity`
collapsed from a descriptive string to bare `2026-07-28`, `total_plans`
jumped from `2` to `13` (unverified whether correct for the wider v1.16.0
milestone), and a malformed velocity-table row `| 235 | 2 | - | - |` was
appended (does not match the file's existing `| Phase N PM | Xm | Y tasks | Z
files |` row format).
errors: (stderr, non-fatal, printed before the JSON result)
```
[gsd-tools] WARNING: STATE.md field "Current Phase Name" not found — update skipped. This may indicate STATE.md was externally modified or uses an unexpected format.
[gsd-tools] WARNING: STATE.md field "Last Activity Description" not found — update skipped. This may indicate STATE.md was externally modified or uses an unexpected format.
```
reproduction:
  1. On a repo where Phase N's plans are genuinely complete (SUMMARY.md +
     commits exist for all of them) and a DIFFERENT phase M has at least one
     `- [ ] M-0X-PLAN.md` line in ROADMAP.md with no corresponding
     SUMMARY.md/commit,
  2. Run `node ~/.claude/gsd-core/bin/gsd-tools.cjs query phase.complete <N>`
  3. `git diff .planning/ROADMAP.md` and observe whether any `- [ ]` line for
     a phase other than N flipped to `- [x] ... (completed <today>)`.
started: first observed this session (2026-07-28); no prior report found in
this repo's `.planning/debug/`.

## Scope and Impact

- Affected surfaces: cli (GSD workflow tooling only; no user-facing plugin
  surface)
- Affected commands: `/gsd-execute-phase`'s `update_roadmap` step (any phase
  completion that calls `phase.complete`)
- Affected users: any GSD session running phase-completion on a repo with
  concurrent multi-phase planning state in ROADMAP.md (this machine runs many
  concurrent worktree-agent sessions across phases, which is exactly this
  repo's normal operating condition per CLAUDE.md/STATE.md history)
- Version range: unknown (not bisected; `~/.claude/gsd-core` version not
  captured before this session)
- Severity: medium -- silent, would have shipped a false completion claim
  into git history if committed without independent verification; caught
  only because this session cross-checked `git diff` before committing per
  standing house rule (`feedback_false_success_silent_skip_gates_academy_testers.md`)
- Blast radius: any `.planning/STATE.md`/`ROADMAP.md` written by this GSD
  tooling version; not scoped to Phase 235's own code changes

## Eliminated

- hypothesis: a concurrent worktree-agent session genuinely completed
  241-04-PLAN.md at the same moment.
  evidence: `find .planning/phases -iname "241-04*"` returns only the PLAN.md
  (no SUMMARY.md); `git log --oneline --all --grep="241-04"` returns zero
  commits. No real work backs the `[x]` mark.
  timestamp: 2026-07-28T08:38:00Z

## Evidence

- timestamp: 2026-07-28T08:36:00Z
  checked: `git diff .planning/ROADMAP.md` immediately after `phase.complete
  235` returned
  found: a `- [x] 241-04-PLAN.md ... (completed 2026-07-28)` hunk plus
  scattered unrelated whitespace hunks across phases 236/241/242/243
  implication: the write path reserializes the whole ROADMAP.md file rather
  than patching only phase 235's lines, and something in that reserialization
  path incorrectly marks an unrelated plan complete
- timestamp: 2026-07-28T08:36:30Z
  checked: `git diff .planning/STATE.md` frontmatter
  found: `stopped_at` regressed to `Completed 234-02-PLAN.md`, `last_activity`
  lost its descriptive suffix, `total_plans` changed 2 -> 13, a malformed
  velocity-table row appended
  implication: the STATE.md writer also has a correctness gap, corroborated
  by the two stderr WARNINGs about fields not found in this repo's STATE.md
  format
- timestamp: 2026-07-28T08:40:00Z
  checked: `git checkout -- .planning/ROADMAP.md .planning/STATE.md` then
  manually re-applied only the Current Position pointer-advance to STATE.md
  found: this single hand-edit was sufficient and correct (Phase 235's
  ROADMAP.md/REQUIREMENTS.md completion markers were already correctly
  committed by the 235-02 plan executor's own commit `df19371b`, separate
  from this tool)
  implication: `phase.complete`'s only genuinely-needed output for this call
  was the STATE.md pointer-advance, and that alone is safe to do by hand when
  the tool's own output cannot be trusted without a diff review

## Technical Root Cause

Not yet isolated to a specific line. `~/.claude/gsd-core/bin/lib/roadmap.cjs`
and `~/.claude/gsd-core/bin/lib/state.cjs` are the two modules `phase.cjs`'s
`complete` verb calls into (per `gsd-tools.cjs`'s top-level requires); the
false `241-04` mark and the full-file whitespace reserialization both point
at a parse-mutate-reserialize round trip in one of these two files rather
than a targeted line patch. Not confirmed by reading the source this session
-- out of scope for a phase-235 dev session on a different repo's tooling.

- Site: `~/.claude/gsd-core/bin/lib/roadmap.cjs` and/or `lib/state.cjs`
  (unconfirmed function/line)
- Cause: unconfirmed; leading hypothesis is a markdown round-trip parser that
  misidentifies which checkbox line belongs to the phase being completed,
  possibly via a loose regex matching plan-ID-shaped strings across the whole
  file rather than scoping to the target phase's section
- Why it surfaces now: unconfirmed; possibly only manifests on ROADMAP.md
  files with many not-yet-started phases already scaffolded in detail (this
  repo's v1.16.0 ROADMAP.md pre-writes phases 236-243 in full before they are
  executed, which is unusual density for this tool to round-trip)

## Required Code Changes

Not filed -- root cause unconfirmed, and the tool lives outside this repo
(`~/.claude/gsd-core/`, not `/home/jsagi/dev/MindrianOS-Plugin`). A future
session investigating this should start in `~/.claude/gsd-core/bin/lib/roadmap.cjs`'s
checkbox-mutation function and `lib/state.cjs`'s frontmatter-field writer,
using this file's reproduction steps against a scratch copy of this repo's
ROADMAP.md/STATE.md as fixtures.

## Tests to Add or Update

Not filed in this repo -- the defect is in externally-installed tooling, not
MindrianOS-Plugin's own test suites (`tests/run-all-*.sh` cover this repo's
code, not `~/.claude/gsd-core`).

## Non-Code Follow-ups

- No CHANGELOG.md entry (not a MindrianOS-Plugin behavior change).
- No release-lockstep implication (tooling bug, not a shipped plugin defect).
- Process note: until this is root-caused, treat `phase.complete`'s ROADMAP.md
  and STATE.md output as a PROPOSAL to diff-review, never a trusted write --
  especially on this machine's concurrent-worktree-session working style.
  `git diff` every file it touches before committing; hand-correct STATE.md's
  minimal needed change (the Current Position pointer-advance) instead when
  in doubt, as this session did.

## Resolution

root_cause: not yet confirmed (see Technical Root Cause)
fix: not applied to the tool; worked around in this repo by discarding
`phase.complete 235`'s ROADMAP.md/STATE.md output entirely (`git checkout --`)
and hand-applying only the correct minimal STATE.md Current Position update.
verification: `git diff .planning/ROADMAP.md` empty after checkout (phase 235's
real completion markers, from the plan executor's own commit, intact and
unaffected); `git diff .planning/STATE.md` after the hand-edit showed exactly
the 3-line Current Position change, nothing else; committed at `0053a0b1`.
files_changed:
  - .planning/STATE.md (hand-edited Current Position only, this repo, not the tool)
commits: 0053a0b1 (this repo's workaround commit; no fix commit to
~/.claude/gsd-core exists yet)
