---
created: 2026-07-12T06:58:00.000Z
title: Never git stash mid-merge-conflict-resolution, it drops MERGE_HEAD
area: tooling
files:
  - CLAUDE.md
  - .git/MERGE_HEAD (the marker at risk)
status: completed
resolution: "Closed by plan 366-24 (2026-10-02): every Phase 366 merge and commit followed the rule; no exception found."
---

## Problem

Self-caught process error, 2026-07-11/12, while merging `worktree-agent-a7884b14e9b45ed48`
(card-discipline-decay fix) into `main`. Mid-conflict-resolution (CHANGELOG.md and
knowledge-base.md had unresolved `<<<<<<<` markers, `git status` showed `.git/MERGE_HEAD`
present), I ran `git stash` then `git stash pop` purely to peek at whether a test failure
was pre-existing on `main` before my fix (an investigative side-trip, not part of resolving
the conflict itself).

`git stash` during an unresolved merge does NOT preserve the merge-in-progress state.
Popping the stash back restored file CONTENTS correctly, but `.git/MERGE_HEAD` was gone.
The subsequent `git commit` therefore created a normal SINGLE-PARENT commit instead of a
proper 2-parent merge commit -- the branch's own commits were never actually linked into
main's DAG (`git log -1 --format="%P"` showed only one parent). The diff CONTENT was
correct throughout; only the git HISTORY/PROVENANCE was silently wrong.

Caught by manually checking parent count after the fact (not by any tool warning). Recovery
required `git reset --hard` back to the pre-merge commit and redoing the ENTIRE merge +
conflict resolution + a follow-on integration fix from scratch -- which also silently
discarded one small, already-applied, unrelated edit (a `commands/eureka.md`
`argument-hint` fix) that had to be redone separately.

Self-assessment on this (verbatim, from the same session): "Integration hygiene: a real
lapse, not just a close call... on a task explicitly framed around 'make sure everything
is authentic,' a self-inflicted git-history integrity mistake in the middle of doing
exactly that is a real miss, not a footnote."

## Solution

Standing rule, to be added somewhere durable (CLAUDE.md's git safety guidance, or a
project skill/hook if one governs merge conflict resolution): **NEVER run `git stash`
(or `git stash pop` / `git stash apply`) while a merge conflict is unresolved** -- i.e.
whenever `.git/MERGE_HEAD` exists. This holds even for a pure read-only side-investigation
that has nothing to do with resolving the conflict itself.

If you need to inspect a file's state on a DIFFERENT ref (e.g. "was this failing before my
fix?") while mid-merge, use one of:
- `git show <ref>:<path>` to read a file's content at another commit without touching the
  working tree at all.
- A separate scratch worktree (`git worktree add /tmp/scratch <ref>`) so the investigation
  runs in total isolation from the in-progress merge.

Never touch the working tree of the merge itself for a side-investigation. Consider a
defensive check too: before any `git stash` call, a quick `test -f .git/MERGE_HEAD && echo
"REFUSING: merge in progress"` guard would have caught this immediately rather than relying
on noticing a wrong parent count after the fact.

## Finding (2026-10-02, plan 366-24, Phase 366 close-out)

Every Phase 366 merge followed the rule. The phase had one merge, `ebd9090cf` (Merge branch
'seed-103-eureka-perspective', 2026-10-01), and it is a proper two-parent commit
(`git log -1 --format=%P ebd9090cf` names 2399b245d and 0184220d4). All 27 plans then committed
straight to main with `git add -f <paths>` and `git commit --only <paths>`, never `git stash`,
`git reset` or `git add -A`; the plan threat registers that name it (for example T-366-89 in
366-21) record it as held, and no 366 SUMMARY records a stash. Where a plan needed the base tree
to compare a red (366-23), it used a separate detached worktree, which is the alternative this
todo prescribes. No exception to name.

The standing rule itself already lives where every executor reads it (the GSD executor's
destructive-git prohibition forbids every `git stash` subcommand in shared trees and names
`git show <ref>:<path>` and a scratch worktree as the sanctioned alternatives). Closed.
