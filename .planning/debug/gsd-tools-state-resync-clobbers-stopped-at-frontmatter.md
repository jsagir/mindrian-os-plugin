---
status: investigating
kind: rca
trigger: "gsd-tools-state-resync-clobbers-stopped-at-frontmatter"
issue_id: ""
severity: low
surfaces: [cli]
brain_mode: local-only
canon_parts: []
created: 2026-07-25T07:40:00.000Z
updated: 2026-07-25T14:10:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: A shared resync path inside the local `gsd-tools.cjs` build (installed
at `~/.claude/gsd-core/bin/gsd-tools.cjs`, an external tool used by every GSD
skill in this repo, not code owned by MindrianOS-Plugin) rebuilds STATE.md's
YAML-frontmatter `stopped_at`/`last_updated`/`last_activity` fields from a
stale/incomplete disk scan whenever ANY `gsd_run query state.*` write command
runs -- even one whose stated purpose is unrelated (inserting a phase,
recording a session). The rebuilt values do not match the true latest state
already correctly recorded in STATE.md's own body log.
test: watched STATE.md frontmatter across two independent `gsd_run` calls in
the same session (`query phase.insert` then, after a manual fix, `query
state.record-session`) and diffed before/after each.
expecting: if confirmed, both calls independently regress the same 3 fields to
the same stale snapshot ("Completed 232-02-PLAN.md", 2026-07-20), regardless
of what each command's OWN documented purpose is.
next_action: none required to unblock the phase-232.1 pipeline (workaround
applied both times); flagging here so the next session that hits this doesn't
re-investigate from scratch. Root-causing the exact line inside gsd-core's
`state.cjs` / `buildStateFrontmatter` (or whatever `_diskScanCache`-backed
helper feeds it) is optional follow-up, not blocking.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: (not applicable -- bug is in the external `gsd-tools.cjs`
  build at `~/.claude/gsd-core/bin/gsd-tools.cjs`, not in this plugin's own
  code)
- Reported by: Claude Code session, mid-pipeline on Phase 232.1 (SEED-074
  "Suggested first move" -- room-graph density read)
- Date first observed: 2026-07-25
- Related debug sessions: none found (`grep -rn "resync\|disk-scan" .planning/debug/knowledge-base.md` = no hits)

## Problem Statement

`gsd_run query phase.insert` and, independently, `gsd_run query
state.record-session` each silently regress `.planning/STATE.md`'s
frontmatter `stopped_at`/`last_updated`/`last_activity` to a stale snapshot
(`Completed 232-02-PLAN.md`, `last_activity: 2026-07-20`) even though Phase
232 was actually fully closed (`232-06-PLAN.md`, 6/6 plans, `last_activity:
2026-07-25`) and STATE.md's own body log already correctly recorded that.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a `gsd_run query state.*` write command changes only the
field(s) its own documented contract targets (e.g. `phase.insert` -> ROADMAP.md
+ new phase dir only; `state.record-session` -> the body "Session Continuity"
`Last session:`/`Stopped at:` lines only).
actual: both commands ALSO silently rewrote the YAML-frontmatter
`stopped_at`/`last_updated`/`last_activity` keys to a stale value, on top of
their documented, correct change. `progress.total_phases` was correctly
recomputed (40->41) in the same rewrite, so the resync mechanism itself is not
wholly wrong -- only these three specific fields land on stale data.
errors: none thrown; no error text, no non-zero exit code. Both commands
reported success (`phase.insert` returned the correct new-phase JSON;
`state.record-session` returned `{"recorded": true, "updated": ["Last
session", "Stopped At"]}` -- accurately describing the fields IT intended to
touch, silent about the frontmatter side effect).
reproduction:
  1. Confirm `.planning/STATE.md` frontmatter reads
     `stopped_at: Completed 232-06-PLAN.md -- PHASE 232 CLOSED (6/6 plans)`,
     `last_activity: 2026-07-25 -- ...` (the correct, current state).
  2. Run `node ~/.claude/gsd-core/bin/gsd-tools.cjs query phase.insert 232
     "<any description>"` from this repo root.
  3. `git diff .planning/STATE.md` -- observe `stopped_at`/`last_updated`/
     `last_activity` regressed to `Completed 232-02-PLAN.md` / `2026-07-20`.
  4. Manually restore the 3 fields to their correct values via `Edit`.
  5. Run `node ~/.claude/gsd-core/bin/gsd-tools.cjs query state.record-session
     --stopped-at "<any label>" --resume-file "<any path>"`.
  6. `git diff .planning/STATE.md` again -- the SAME 3 fields regress to the
     SAME stale snapshot a second time, independently.
started: first observed 2026-07-25, this session (Phase 232.1 insertion +
discuss pass). Unknown whether this predates today; STATE.md's own history
(Roadmap Evolution entries for Phases 230/231/232) documents a DIFFERENT
`phase.add` defect (full description crammed into the title field) as an
already-known, already-worked-around class of gsd-tools quirk in this repo --
this is a distinct symptom, not a duplicate of that one.

## Scope and Impact

- Affected surfaces: cli only (this is a local `gsd-tools.cjs` CLI behavior;
  not reachable from Desktop/Cowork, which don't invoke gsd-tools).
- Affected commands: at minimum `query phase.insert`, `query
  state.record-session`. Unconfirmed whether other `state.*`/`phase.*` write
  verbs share the same resync path -- not tested beyond these two.
- Affected users: anyone running GSD phase-insert or discuss-phase workflows
  in this repo (or any repo using the same `~/.claude/gsd-core` install).
- Version range: unknown (gsd-core is an external, separately-versioned tool;
  no version string captured this session).
- Severity: low. Silent and cosmetic-only in observed cases so far (STATE.md
  frontmatter narrative fields, not `progress.*` counters, not ROADMAP.md, not
  any code path) -- but silent-and-wrong is exactly the failure class this
  repo's own `feedback_false_success_silent_skip_gates_academy_testers.md`
  personal-memory watch item tracks, so it is worth a name rather than being
  waved off.
- Blast radius: `.planning/STATE.md` frontmatter only, in every repo sharing
  this gsd-core install. Does not touch ROADMAP.md content, phase directories,
  or any MindrianOS-Plugin source.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: concurrent Claude Code session on this same repo wrote the stale
  value (a real, confirmed-active risk this session per the navigator's own
  working-tree-hygiene warning).
  evidence: single file mtime per event (`stat` showed one write, matching the
  command's own invocation time to the second), no lock files present, and the
  SAME stale target value (`232-02-PLAN.md`) reproduced on a SECOND, later,
  unrelated command (`state.record-session`) -- a concurrent session would
  need to coincidentally write the identical stale string twice at exactly
  the two moments this session ran a gsd-tools write command, which is not a
  plausible race.
  timestamp: 2026-07-25T14:10:00.000Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-25T07:37:58.000Z
  checked: `git diff .planning/STATE.md` immediately after `query phase.insert 232 ...`
  found: `stopped_at`/`last_updated`/`last_activity` regressed to
  `Completed 232-02-PLAN.md` / `2026-07-20`; `progress.total_phases` correctly
  40->41 in the same diff.
  implication: the resync path that recomputes `progress.*` also touches
  `stopped_at`/`last_updated`/`last_activity`, and gets the latter three wrong
  while getting the former right.
- timestamp: 2026-07-25T10:37:58.000Z
  checked: `ls -la .planning/phases/232-blocknote-wiki-convergence-.../` (all
  six `232-0N-PLAN.md` + `232-0N-SUMMARY.md` pairs)
  found: all 12 files present on disk, `232-06-SUMMARY.md` mtime 2026-07-20
  07:33 -- Plan 6 genuinely completed and summarized.
  implication: the stale value (`232-02-PLAN.md`) is not a "correct read of an
  older-but-still-valid state" -- it is definitively behind the true state
  already visible on disk and already correctly recorded in STATE.md's own
  body log before either command ran.
- timestamp: 2026-07-25T14:09:19.165Z
  checked: `git diff .planning/STATE.md` after `query state.record-session
  --stopped-at "Phase 232.1 context gathered" --resume-file ...`
  found: body "Session Continuity" `Last session:`/`Stopped at:` lines
  correctly updated (matches the command's own documented contract and its
  own JSON response); frontmatter `stopped_at`/`last_updated`/`last_activity`
  independently regressed AGAIN to the identical stale snapshot from the
  first occurrence.
  implication: at least two distinct `gsd-tools query` verbs share whatever
  code path produces this regression; it is not specific to `phase.insert`.
- timestamp: 2026-07-28T15:12:00.000Z
  checked: `git diff .planning/STATE.md` immediately after `query
  state.advance-plan` (Phase 241 Plan 05 execution, per this RCA's own
  process-note advice to always diff right after a `state.*` write verb).
  found: a THIRD, worse variant of the same regression. `stopped_at`/
  `last_updated`/`last_activity` regressed from the correct
  `Completed 241-04-PLAN.md` / 241-04's own activity line to a stale
  `Completed 241-02-PLAN.md` / 241-03's activity line -- confirming this is
  not specific to `phase.insert`/`state.record-session`; `state.advance-plan`
  shares the same defective path. NEW symptom beyond what this RCA already
  named: `progress.percent` ALSO regressed, from the correct `40` (6/15) to
  `11`, a value that does not correspond to any sensible ratio of the visible
  `completed_plans: 6` / `total_plans: 15` pair (both of which stayed
  numerically unchanged across the write) -- so `percent` is being recomputed
  from something OTHER than the two fields sitting right next to it in the
  same frontmatter block, using the same stale disk-scan snapshot that
  produces the `stopped_at` regression. The command's own JSON response
  (`{"advanced":true,"previous_plan":3,"current_plan":4,"total_plans":5}`)
  also disagrees with STATE.md's own milestone-scoped `total_plans: 15` --
  it appears to be tracking a DIFFERENT, phase-scoped "plan N of 5" counter
  that was itself one plan behind reality (241-04 had already completed
  before this call, yet `previous_plan` read 3, not 4).
  implication: `state.advance-plan` is a THIRD write verb sharing this
  defective resync path, and the blast radius is larger than previously
  documented -- `progress.percent` is not immune, contradicting this RCA's
  original Scope-and-Impact note that only narrative fields were affected.
  workaround applied: same as the two prior occurrences -- hand-restored the
  3 frontmatter fields plus `percent` to their correct pre-write values via
  `Edit`, confirmed via a second `git diff` that only the intended fields
  changed.

## Technical Root Cause

PENDING (symptom-level only). `gsd-core/bin/lib/state.cjs` (read this session
at a different offset) shows a `_diskScanCache` (module-scope `Map`, cached
per-cwd per-process) feeding `buildStateFrontmatter`, and a `shouldResync`
gate in `cmdStateUpdate` keyed on `['Progress', 'Total Plans in Phase', 'Total
Phases']` -- but `stopped_at`/`last_updated`/`last_activity` are not in that
list, so the exact call site that also rewrites them was not traced this
session (would require reading `buildStateFrontmatter`'s full body and
whatever calls it from `phase.insert`'s and `state.record-session`'s own
handlers, both in files not read this session). Not pursued further because
gsd-core is an external, separately-maintained tool outside this repo's own
codebase (`~/.claude/gsd-core/`, not `/home/jsagi/dev/MindrianOS-Plugin/`) --
tracing and fixing it is out of scope for the SEED-074 phase this RCA was
filed alongside.

- Site: unknown exact line; implicated file is
  `~/.claude/gsd-core/bin/lib/state.cjs` (`buildStateFrontmatter` and/or its
  `_diskScanCache`-backed caller), external to this repo.
- Cause: PENDING -- likely a disk scan that finds the wrong "most recent"
  phase-completion marker (232-02 instead of 232-06) and unconditionally
  overwrites the narrative frontmatter fields with it, regardless of which
  `state.*`/`phase.*` verb triggered the write.
- Why it surfaces now: unknown whether this is new or pre-existing;
  first observed today because this session ran `phase.insert` and
  `state.record-session` back-to-back and diffed STATE.md after each, which
  is not typical single-command usage.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

None in this repo. If pursued, the fix belongs in `~/.claude/gsd-core` (an
external tool), not in `/home/jsagi/dev/MindrianOS-Plugin`. No MindrianOS-Plugin
source, script, or doc requires a change to work around this -- the manual
frontmatter restoration applied twice this session is a complete, low-cost
workaround at the point of use.

## Tests to Add or Update

None in this repo (see above -- the defect is not in MindrianOS-Plugin code).

## Non-Code Follow-ups

- CHANGELOG.md: not applicable (no MindrianOS-Plugin behavior changed).
- Release lockstep: not applicable.
- Canon: not applicable.
- knowledge-base.md: add a summary block if/when this is confirmed root-caused
  or hit a third time, so a future session doesn't re-investigate from
  scratch.
- Process note: any GSD skill in this repo that calls a `gsd_run query
  state.*` or `phase.*` write verb should `git diff .planning/STATE.md`
  immediately after and re-verify the frontmatter `stopped_at`/
  `last_updated`/`last_activity` trio before trusting them, until this is
  confirmed fixed upstream.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PENDING (see Technical Root Cause).
fix: workaround only -- manually restored STATE.md's 3 frontmatter fields by
hand after each of the 2 occurrences this session (see the Phase 232.1
Roadmap Evolution entry in STATE.md for the first restoration's own note).
verification: `git diff .planning/STATE.md` confirmed the restored values
matched the true state (232 CLOSED 6/6, 2026-07-25) after each fix.
files_changed:
  - .planning/STATE.md (frontmatter restored twice, by hand)
commits: (STATE.md frontmatter fix rides the same commit as whatever GSD step
triggered each occurrence; not committed as a standalone fix)
