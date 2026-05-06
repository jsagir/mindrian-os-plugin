# 2026-05-06 — Worktree Archive Manifest

**Type:** Operations breadcrumb (not a code autopsy)
**Date:** 2026-05-06
**Trigger:** Release-pipeline-gap incident (5 betas v1.13.0-beta.2 through .6 sat on local main, never reached origin or marketplace ref-pin)
**Pair with:** `docs/autopsies/2026-05-06-install-dir-missing-incident.md` (Phase 95.2 incident from same date)

## Summary

68 git worktree branches accumulated under `.claude/worktrees/agent-*` from gsd-executor parallel agent runs (Phases 12 through 117). On 2026-05-06 we audited them and discovered:

1. **The big defect was elsewhere.** 107 commits sat on local `main` never pushed to `origin/main`, including 5 release commits (v1.13.0-beta.2 through .6). Testers running `claude plugin update mos@mindrian-marketplace` were stuck on v1.13.0-beta.1. We pushed origin main + tags + marketplace ref-pin in this same session — testers now get current work.
2. **Worktree commits were largely preserved.** File-level audit confirmed near-zero recovery work was needed: code, tests, and configs from worktree branches were already on main via squash-merge commits like `bd353b0 feat(109-07,109-08,109-09): merge Wave 3 worktrees - navigation surface complete` and `22201c5 feat(109-01,109-00): merge Wave 1 worktrees + fix openRoomDb shim`. The "61 distinct orphan commits" reported by `git cherry main <worktree>` were patch-id misses (squash collapses N commits into one with a different hash) — not missing work.
3. **Worktree directories consume 3.7 GB.** 64 worktrees x ~58 MB each. We took a partial cleanup pass (16 unlocked branches removed, recovering ~1.5 GB), then stopped on the user's instruction `dont delete lets archive them, with bread cumbe if we did a mistake we can revert!`.

This manifest is the breadcrumb. Three groups of branches with three different recovery paths.

## Group A — 52 worktree branches archived to origin/archive/

All locked worktree branches were pushed to `origin/archive/<branch-name>` before any further cleanup. Recoverable forever from GitHub via:

```bash
git fetch origin
git checkout origin/archive/worktree-agent-<hash>
# or restore the local branch:
git branch worktree-agent-<hash> origin/archive/worktree-agent-<hash>
```

Branch list (push verification: `git ls-remote --heads origin 'archive/*' | wc -l` returns 52):

```
worktree-agent-a034ecdabf1ade1da    worktree-agent-ab1459e95d5588a8c
worktree-agent-a0558dab1502142d5    worktree-agent-ab939d3d1928cadac
worktree-agent-a077088d2468ee06b    worktree-agent-ab9d62ec8bc7d01ef
worktree-agent-a279b63865a84dfda    worktree-agent-abfebb0d76d6a2e51
worktree-agent-a2c42e084116a773d    worktree-agent-ac52e61fde08e8fcf
worktree-agent-a359114065850ec82    worktree-agent-ac96bbf8d3b379de6
worktree-agent-a3a1c19f8c6fb0e37    worktree-agent-ac9e74f99d29310d5
worktree-agent-a3c376f9cbf40e13d    worktree-agent-acc9a68bad2073536
worktree-agent-a42871292e1ee4b55    worktree-agent-ad16499ea7aa72f6e
worktree-agent-a4a676482e6861d19    worktree-agent-ad1b0370a706f2edb
worktree-agent-a51b4d4767bd88233    worktree-agent-ad53687a1186ef6f2
worktree-agent-a54ded32f86ecf4c7    worktree-agent-ad73bc860fe176305
worktree-agent-a5ae82cd2db0a67d3    worktree-agent-addc7dee51a93d8df
worktree-agent-a5eb9a5da452ea0a5    worktree-agent-ade909866fe0f5405
worktree-agent-a5f41e0ec45cb95de    worktree-agent-ae4ef46b87f893b8c
worktree-agent-a62c794857a03d66c    worktree-agent-ae5b3c696682ae818
worktree-agent-a64dba729c5ce4590    worktree-agent-ae867799d79161220
worktree-agent-a6c8be9ba0216bdaa    worktree-agent-aec5cf8759e73e5e6
worktree-agent-a6d547e98cd8a20c2    worktree-agent-aedf6041177e14a65
worktree-agent-a6e6ee2c6d5c1edab    worktree-agent-af0eca2947e063612
worktree-agent-a74f84afa10f8b7d9    worktree-agent-af464d2c542ec4e95
worktree-agent-a7d80a44ed3a5acb3    worktree-agent-afbe0fca027468a8b
worktree-agent-a7e5ce181321dfaf6
worktree-agent-a805a5a3a006fdcd9
worktree-agent-a80b5962c780c4728
worktree-agent-a8818ef454b534bee
worktree-agent-a9ed31c495bba46a6
worktree-agent-aa3791b437b8149e6
worktree-agent-aa4c8fe05e13f83e8
worktree-agent-aabbf470b9dea5b33
```

## Group B — 16 worktree branches deleted earlier in same session

These were removed before the user said `dont delete lets archive them`. Their commits remain in git's object database via reflog for ~90 days (default `gc.reflogExpire`). Recoverable via:

```bash
git reflog show --all | grep worktree-agent-<hash>
# Read the commit SHA from output, then:
git checkout <sha>
# or restore as a branch:
git branch worktree-agent-<hash> <sha>
# or push to archive remotely:
git push origin <sha>:refs/heads/archive/worktree-agent-<hash>
```

To find ALL deleted worktree branches (useful if specific names are forgotten):

```bash
git reflog --all 2>&1 | grep -E "worktree-agent-[a-f0-9]+@\{[0-9]+\}: branch: Created from origin/main" | awk '{print $4}' | sort -u
```

Audit finding (from `git cherry` patch-id check + file-level diff): all 16 branches' code work was already on main via squash-merge commits. Only file genuinely missing was a 4-line stub `tests/test-selector-dispatcher-operator-aware.cjs` from agent-ae5b3c696682ae818 — a Wave-0 placeholder superseded by `tests/test-selector-dispatcher-88-2-04.cjs` and siblings on main. **No real work was lost.**

## Group C — 52 worktree directories STILL on disk

`.claude/worktrees/agent-*` (52 directories totaling ~2.2 GB after partial cleanup). NOT removed. Each holds:

- A working tree at the branch tip
- Some have uncommitted changes (audit listed 17 as dirty; the dirty files were either already on main as tracked files, or stub placeholders since superseded)

To clean up locally (recovers ~2.2 GB) when ready:

```bash
# Force-remove all (branches already archived to origin/archive/ per Group A)
git worktree list --porcelain | grep '^worktree ' | awk '{print $2}' | grep '/agent-' | xargs -I {} git worktree remove --force --force {}
# (yes, --force --force is the syntax to override locks)

# Then drop the local branch refs (they remain available via origin/archive/):
git branch | grep "worktree-agent-" | tr -d ' *+' | xargs -I {} git branch -D {}
```

Recovery from origin/archive/ (after local removal):

```bash
git fetch origin
git checkout origin/archive/worktree-agent-<hash>
# Working tree state is the branch tip — uncommitted changes from the original worktree do NOT survive this round-trip; they were only on local disk.
```

If you need uncommitted changes from a specific worktree before removal, capture them first:

```bash
WT=.claude/worktrees/agent-<hash>
tar -czf ~/.mindrian/archive/2026-05-06-worktree-${hash}-uncommitted.tar.gz -C "$WT" $(git -C "$WT" status --porcelain | awk '{print $2}')
```

## Why this happened

Phase 117 plans (and many earlier phases) used `Task(subagent_type="gsd-executor", isolation="worktree", ...)` per the GSD execute-phase workflow. When parallel agents within a wave commit work, their commits land on the worktree-specific branch. The orchestrator was supposed to merge those branches back into main after the wave completed — and most did, via squash merges.

Bypass routes:
- Some agents bumped `plugin.json` + tagged + committed release commits on the WORKTREE branch instead of main. The worktree was then squash-merged with `feat(NN-MM,NN-PP): merge Wave N worktrees`, which preserved the file content but collapsed the per-task commit history.
- The squash-merge style accidentally included the version-bump commit content, so `plugin.json` got bumped on main too — but the corresponding `git tag vX.Y.Z` only ever existed on the worktree branch (or as a local tag never pushed).
- `scripts/release.sh` was the OFFICIAL release path and pushes correctly. But during phase execution the agents took a different path that ended up shipping locally only.

## Prevention layers shipped

Same session (2026-05-06):

1. **`scripts/preflight-release-drift.cjs`** (this commit's pair) — SessionStart hook (9th entry in `hooks/hooks.json`). Detects when local plugin.json or unpushed release commits drift from origin and surfaces a one-line warning at session start. LOCAL-only check (Canon Part 8 zero-network at hook time). Tested against the actual incident state — would have caught the 5-beta gap weeks ago.
2. **Push origin/main + tags + marketplace ref-pin** — pushed 107 commits + 5 tags (v1.13.0-beta.2 through .6) + updated marketplace `source.ref` from v1.13.0-beta.1 to v1.13.0-beta.6.

Future hardening (not in this session):

- Pre-push hook to refuse pushing if local plugin.json has been bumped without a corresponding push (defense-in-depth alongside the SessionStart warning).
- gsd-executor agent change to avoid making release commits at all — defer all release plumbing to `scripts/release.sh`. Agents should commit `feat(NN-MM)` content commits but never `release: vX.Y.Z` style.
- An audit script that runs `git ls-remote --heads origin 'archive/*'` and flags any worktree branch on disk whose archive ref is stale.

## Recovery quickstart

| Scenario | Command |
|----------|---------|
| Restore a Group A branch (52 archived) | `git fetch origin && git branch <name> origin/archive/<name>` |
| Restore a Group B branch (16 deleted) | `git reflog --all \| grep <name>` then `git branch <name> <sha>` |
| Restore Group C uncommitted changes | Already on local disk in `.claude/worktrees/agent-<hash>/` until removed |
| Push a recovered branch to archive | `git push origin <name>:refs/heads/archive/<name>` |
| List all archived branches on remote | `git ls-remote --heads origin 'archive/*'` |

Audit logs:

- File-level preservation audit: see `git log --oneline --grep "merge Wave"` for the squash-merge commits that captured worktree work.
- Patch-id false-positive audit: 194 commits flagged as orphans by `git cherry`; only ~61 were patch-id-distinct; file-level check showed ~zero distinct work missing.

## Note for future operators

If you see this manifest while investigating worktree-related issues: the answer to "should I delete the local worktrees?" is **yes, when ready** — Group A archives to origin make recovery trivial. The 2.2 GB disk recovery is real value, and locked-but-untouched worktrees from April/May 2026 are stale enough to be cleaned safely.

If you see worktree branches accumulating again WITHOUT being archived, that means the gsd-executor → orchestrator merge protocol regressed. Check `.claude/agents/gsd-executor.md` and `~/.claude/get-shit-done/workflows/execute-phase.md` for whether they include the merge-back step. The 2026-05-06 finding suggests this protocol was implicit (relying on squash-merge in execute-phase aggregation) rather than explicit (no documented "after wave completes, merge worktree branches into main" step).
