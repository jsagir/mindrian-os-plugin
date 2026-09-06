---
date: 2026-09-06
severity: medium
status: resolved
detected_by: Claude Code session (an unscoped version-audit find/grep, surfaced during a routine MindrianOS/Theo status review)
resolved_by: QUICK-260906-t3s (lib/core/repo-version.cjs + scripts/check-worktree-hygiene.cjs + a doctor.cjs acceptance gate)
workspaces_involved:
  - ~/MindrianOS-Plugin/ (retired workspace path)
  - ~/dev/MindrianOS-Plugin/ (canonical workspace)
---

# Incident Autopsy: Worktree Version Contamination

## Summary

An unscoped find/grep for "the current plugin version" walked into one of 59
agent-session checkout directories under `.claude/worktrees/` and returned a
version from a frozen, months-old checkout as if it were current. The finding
reported was "install version drift, 5 weeks stale, manifests say
1.16.0-beta.7" -- but the repo was in fact at `2.0.0-beta.26` and shipping
multiple releases a day. The read was plausible-looking (a real file, valid
JSON, well-formed semver) and completely wrong, and nothing on the box was
ever going to catch it: there was no single governed answer to "what version
is this repo", so any tool or agent asking that question was free to walk the
tree and read whichever `plugin.json` it happened to hit first.

## Root Cause

This repo moved from `~/MindrianOS-Plugin/` to `~/dev/MindrianOS-Plugin/`. 59
checkout directories under `.claude/worktrees/` came along as plain
directories, but their linked-worktree admin records did not: all 46 orphans
carry a `.git` FILE whose content is
`gitdir: /home/jsagi/MindrianOS-Plugin/.git/worktrees/agent-<hash>` -- the
retired path. Git therefore cannot see them as worktrees at all any more.
`git worktree prune` reported nothing to prune, not because the tree was
healthy, but because from git's point of view there was nothing there to
prune -- the healthy signal and the broken one look identical. Sampled version
range in the fossils: `1.12.1-beta.1` through `1.15.3-beta.51`, oldest dated
May 2026. Total footprint: 3.9GB across 46 directories (13 more were still
correctly registered and untouched throughout this incident).

## Failure Modes Exposed

1. A directory move silently orphans worktree admin records. Git gives no
   warning at move time and no error afterward.
2. `git worktree prune` reports success on a tree with dozens of stranded
   checkouts. There is no distinct signal for "nothing to prune because
   everything is healthy" versus "nothing to prune because git has already
   forgotten the mess."
3. `.claude/worktrees/` is correctly gitignored, which also means no ordinary
   git surface (status, diff, log) would ever report the directories growing.
4. There was no single canonical answer to "what version is this repo", so
   any tool or agent asking that question could walk the tree and read
   whichever `plugin.json` it hit first, with no refusal path.
5. A stale checkout is a perfectly valid repo snapshot. Every heuristic a
   reader might use to sanity-check the answer (file exists, JSON parses,
   semver is well-formed) passes on the wrong answer.
6. When the fix's own classifier first ran for real, it found that EVERY
   single one of the 46 orphans held at least one file whose content was not
   in the object database -- not because 46 checkouts held irreplaceable work,
   but because the classifier's first cut counted routine local runtime-cache
   files (`.claude/settings.local.json`, `room/.mindrian/statusline-cache.json`,
   `room/.analytics.json`, `dashboard/graph.json`, `.mindrian/`-scoped test
   fixture state) as if they were real content. A first version of the walk
   also miscounted each checkout's own `.git` pointer file as unique content
   for the same reason. Both were fixed same-day, in the same task that found
   them (see Resolution).

## How It Was Detected

A Claude Code session was asked for a MindrianOS/Theo status update. It ran a
version check via an unscoped `find`/`grep` across the repo tree rather than
reading the canonical repo root directly, picked up one of the 46 fossils, and
reported a false "5 weeks stale, version drift" finding. A follow-up
`git worktree list` vs. on-disk-directory-count comparison (13 registered
against 59 directories present) surfaced the real shape of the problem within
the same session.

## Resolution

- `lib/core/repo-version.cjs`: the one canonical answer to "what version is
  this repo", mirroring the existing `lib/core/active-plugin-root.cjs`
  precedent. Its distinguishing behavior is the refusal: a resolved root whose
  path carries a `.claude/worktrees` or `worktrees/agent-*` segment throws a
  named error instead of returning a plausible-looking wrong version.
- `scripts/check-worktree-hygiene.cjs`: diffs `.claude/worktrees/*` on disk
  against `git worktree list`, classifies every unregistered directory
  (`registered` / `live-gitdir` / `safe-orphan` / `review`) by hashing its
  files and checking blob presence in the object database, and is the ONLY
  path in this repo allowed to delete one (`--prune --confirm`). A directory
  holding real uncommitted repo-source edits or a never-committed file is
  `review` and is never auto-deleted by any flag.
- A Decision Gate at the classifier's first live run against the real 46
  orphans, ratified by the navigator 2026-09-06: unique content confined to
  eight named ephemeral runtime-cache paths (see Failure Mode 6) is treated as
  non-blocking, the same way `.planning/` already was -- `--strict-planning`
  and `--strict-ephemeral` restore either to a blocker for anyone who
  disagrees.
- Measured outcome of the governed prune: 59 directories on disk before, 21
  after (13 registered, 8 held back as `review`); `.claude/worktrees/` went
  from 3.9GB to 2.2GB. The 8 `review` directories were sampled by hand (5 of
  7 `tracked_modified` hits cross-referenced against `git log`) and all
  five sampled were earlier, shorter drafts of features since finished and
  committed to `main` under a different, more complete form (for example
  `scripts/audit-active-phase-resolver.cjs` matches the shipped commit
  `709e9e57`, Phase 121.5) -- consistent with the root cause (a stranded
  mid-task snapshot, not lost work), but not exhaustively proven for all 8, so
  they were left for the navigator to close out by hand rather than deleted
  on a sample's strength.
- `scripts/doctor.cjs --acceptance` now carries a `worktree-hygiene` blocker
  point (Task 3 of this incident's fix) that fails whenever an unregistered
  checkout directory exists, naming the one-command fix in its finding. It
  reports red today, honestly, because the 8 `review` directories are still
  unresolved.

## Lessons

**A tool that refuses is safe; a tool that guesses is what caused this.**
`resolveRepoRoot()`'s whole value is the one path where it throws instead of
answering. The gigabytes were the symptom; the missing canonical read path was
the defect.

**"Nothing to prune" is not the same claim as "nothing is wrong."** `git
worktree prune` and this incident's own first classifier pass both looked
clean for the wrong reason before they looked clean for the right one -- prune
because git had already forgotten the orphans, the classifier because its
first cut didn't yet know which local files were routine cache noise versus
real content. A gate is only as honest as the thing it is actually checking.

**Widening what counts as "safe to delete" needs a ratified decision, not a
convenient assumption.** The ephemeral-cache allowlist reclaimed most of the
3.9GB, but it was added only after the classifier's strict-by-default first
run surfaced a concrete, evidenced finding and put it to the navigator as an
explicit choice -- exactly the discipline this fix's own design decisions
argued for before any evidence existed to test it against.

## Prevention Checklist (applied)

- [x] `lib/core/repo-version.cjs` exists with the worktree-contamination
      refusal (`resolveRepoRoot`, `readRepoVersion`).
- [x] `scripts/check-worktree-hygiene.cjs` exists: classify, `--prune
      --confirm` as the only governed delete path, hermetic test coverage
      (`tests/test-260906-t3s-worktree-hygiene.cjs`, 18 checks).
- [x] `scripts/doctor.cjs --acceptance` carries the `worktree-hygiene` blocker
      point.
- [x] This autopsy exists and CLAUDE.md's WORKSPACE GUARD references it.
- [x] The governed prune ran: 38 of 46 orphans deleted, 1.7GB reclaimed.
- [ ] **Residual, deliberately unchecked**: 8 directories remain classified
      `review` and were NOT deleted --
      `agent-a03b19249224cf3f5`, `agent-a2523a989d0497d7e`,
      `agent-a54ded32f86ecf4c7`, `agent-a732546586e585a5f`,
      `agent-a8818ef454b534bee`, `agent-ac96bbf8d3b379de6`,
      `agent-ae5b3c696682ae818`, `agent-afbe0fca027468a8b`. Sampling strongly
      suggests all are superseded drafts (see Resolution), but this was never
      exhaustively confirmed for all 8, so `doctor --acceptance` will keep
      reporting `worktree-hygiene` red until the navigator inspects and either
      manually clears each directory or ratifies a supersession call the same
      way the ephemeral-cache allowlist was ratified.

## References

- Root-cause evidence: `git worktree list --porcelain` (13 registered) vs.
  `.claude/worktrees/*` directory count (59 before the prune), and each
  orphan's own `.git` file content naming the retired
  `/home/jsagi/MindrianOS-Plugin/.git/worktrees/agent-<hash>` path.
- Fix: `lib/core/repo-version.cjs`, `scripts/check-worktree-hygiene.cjs`,
  `tests/test-260906-t3s-worktree-hygiene.cjs`, the `worktree-hygiene` entry
  in `scripts/doctor.cjs`.
- Quick task: `.planning/quick/260906-t3s-purge-orphaned-agent-worktree-checkouts-/`.
- Precedent: `docs/autopsies/2026-04-13-wrong-workspace-incident.md` -- the
  same hazard class (more than one path on the box that looks like the
  workspace), a different mechanism. That incident was a WRITE going to the
  wrong place; this one was a READ coming from the wrong place. The
  2026-04-13 guard (refuse to run under `~/.claude/plugins/`) could not have
  caught this: the read happened from the correct `pwd`, the corruption was in
  which file the search itself walked into.
