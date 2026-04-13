---
date: 2026-04-13
severity: high
status: resolved
detected_by: Lawrence Aronhime (user diagnostic output)
resolved_by: inline transplant + release pipeline mandate
commits_affected: 42
phases_affected: [76, 77, 78, 79, 80]
workspaces_involved:
  - ~/.claude/plugins/mindrian-os/ (wrong workspace)
  - ~/MindrianOS-Plugin/ (correct workspace)
---

# Incident Autopsy: Wrong-Workspace Parallel Development

## Summary

On 2026-04-13, a full GSD milestone (v1.9.8 Obsidian Vault Integration, phases 76-80, 42 commits, 12/12 tests green) was executed inside `~/.claude/plugins/mindrian-os/` -- the plugin cache directory -- instead of the canonical dev workspace at `/home/jsagi/MindrianOS-Plugin/`. The work was real and valuable but completely invisible to GitHub and to every user of the plugin. Simultaneously, an unrelated Claude Code session running in the correct workspace was shipping v1.9.6 (SQLite migration), v1.9.7 (SnapshotHub), v1.9.8 (brand lockup), and v1.9.9 (lobby generator + /mos:mullins) to GitHub. Neither session knew about the other. Lawrence hit the drift first -- his plugin cache showed `plugin.json` saying "1.9.9" while his registry said "1.9.4", and his diagnostic output is what triggered the investigation that surfaced the two universes.

## Root Cause

**The plugin cache directory has a git history and accepts commits.** `~/.claude/plugins/mindrian-os/` is a dev-mode plugin install with its own git remote (`dev`) pointing at the real workspace. Claude Code tooling does not refuse to run inside it. GSD does not refuse to plan phases there. The executor agents do not check `pwd` before writing files. Every guard that could have caught this was absent.

The cache directory was originally created as a way for Claude Code to READ the plugin. Someone (or some tool) at some point made it writable and git-initialized it so it could receive pushes from the real workspace via the `dev` remote. After that, nothing stopped work from flowing in the wrong direction: into the cache, with no way out to GitHub.

## Failure Modes Exposed

1. **Two identically named workspaces with different git identities** -- `~/.claude/plugins/mindrian-os/` uses `jsagir@gmail.com`, `~/MindrianOS-Plugin/` uses `theceo@eduba.io`. Two sessions of the same developer, on the same machine, working in parallel, each thinking they were THE workspace.

2. **The marketplace source URL has no ref pin.** `~/mindrian-marketplace/.claude-plugin/marketplace.json` points at `https://github.com/jsagir/mindrian-os-plugin.git` with no `ref` field. Users get whatever `origin/main` HEAD is at install time. There is no such thing as a stable "v1.9.4" install -- only snapshots of whenever the install happened.

3. **Version numbers live in 3 files with no enforcement.** `package.json`, `.claude-plugin/plugin.json`, and CHANGELOG head can all drift independently. On 2026-04-13 the real workspace had: package.json at 1.9.3, plugin.json at 1.9.9, CHANGELOG at 1.9.7, git tag v1.9.9. No CI gate. No release script. No pre-push hook. Nothing catches drift.

4. **Lawrence's auto-update never fires.** His install date is 2026-03-26. Between then and 2026-04-13 there were five releases (1.9.5-1.9.9) and he got none of them. The update detection only triggers manually via `/mos:update`, and there is no proactive "you are N versions behind" banner.

5. **CLAUDE.md references the correct workspace but doesn't enforce it.** The very first line of `CLAUDE.md` says `Working directory: /home/jsagi/MindrianOS-Plugin/`. But that's documentation, not mechanism. Nothing actually checks. A new Claude Code session spawned inside the cache dir reads its own local CLAUDE.md (same content) and happily continues.

6. **The plugin cache directory is gitignored in its own `.planning/` but not in `lib/`.** This meant commits to `lib/import/*` landed in real git history inside the cache dir, while `.planning/phases/*-PLAN.md` did not. The result is that 42 commits look real (because code files are tracked) but their planning context is invisible, making the mistake even easier to overlook at commit time.

## How It Was Detected

Lawrence's diagnostic dump, produced in response to his observation that "/mos: commands don't show". Lawrence's Claude Code ran a 10-section evidence-collection prompt and returned the output. The orchestrator (me, in the wrong workspace) analyzed the output and noticed:

- Lawrence's `plugin.json` in cache said 1.9.9 but registry said 1.9.4 (drift)
- Lawrence's `settings.json` had a stale `statusLine` pointing at `mos/1.3.0/` (drift)
- Lawrence had orphaned data dirs (`mos-mindrian-marketplace` AND `mindrian-os-mindrian-marketplace`) (rename history)
- Lawrence had a `temp_git_*` dir in cache (failed cleanup)

This triggered an investigation into our own release pipeline. That investigation found:

- `origin/main` on GitHub had 10 commits this local session didn't have (v1.9.6 SQLite migration, v1.9.7 SnapshotHub, v1.9.8 brand lockup, v1.9.9 lobby generator + /mos:mullins, plus fixes and MCP Platform App rebuild)
- This local session had 42 commits GitHub didn't have (phases 76-80)
- Merge base was 23d3b5a from 2026-04-10
- Author emails differed between the two sides
- The ACTUAL working directory referenced in CLAUDE.md was a sibling directory at `~/MindrianOS-Plugin/`

At that point the diagnosis was final: same person, same machine, two workspaces, 3 days of parallel work.

## Resolution

**Step 1: Stop pushing from the wrong workspace.** Never attempted to push `~/.claude/plugins/mindrian-os/` to GitHub. A force-push would have destroyed the v1.9.6-1.9.9 work on origin.

**Step 2: Transplant 42 commits via `git format-patch` + `git am --3way`.**
- Created `/tmp/phase-80-patches/` from 23d3b5a..HEAD in the cache dir (42 patch files)
- Stashed uncommitted work in the real workspace
- Created `merge/phases-76-80` branch from `main` in the real workspace
- Applied all 42 patches with `git am --3way`
- Resolved planning-file conflicts by preferring `--theirs` (the incoming phase 80 state)
- Auto-merged `bin/mindrian-tools.cjs`, `skills/room-passive/SKILL.md`, and `scripts/create-speaker-profile` (disjoint enough changes to merge cleanly)
- Final verification: `node lib/import/run-all-tests.cjs` returns 12/12 test files passing in the real workspace

**Step 3: Reset the cache dir (pending next session).** The cache dir's 42 local commits are now redundant with the merge branch in the real workspace. A clean reset via `git fetch origin main && git reset --hard origin/main` is required to prevent future accidental commits.

**Step 4: Add the workspace guard.** `scripts/session-start` in the real workspace now refuses to execute if PWD is under `~/.claude/plugins/`. This catches the mistake at session start before any file write can happen.

**Step 5: Add release pipeline mandate.** `.claude/includes/release-process.md` now documents the workspace rule, the version consistency gate (5 sources of truth must agree), and the marketplace-source-must-be-pinned rule.

**Step 6: File this autopsy.** Future Claude sessions reading CLAUDE.md will see the reference to this file and understand why the workspace guard exists.

## Lessons

### Structural

**The plugin install layout allows development in the install location.** This is a Claude Code plugin ecosystem design issue, not just a MindrianOS issue. Any plugin with a git history can accidentally become a fork of itself inside the install cache. Three possible mitigations at the ecosystem level, any of which would have prevented this:

1. Plugin cache directories should be a detached work tree (no HEAD, no branch, just a staged checkout)
2. Plugin cache directories should have a pre-commit hook installed by Claude Code that refuses commits
3. `claude plugin install` should set a `.claude-plugin/.install-marker` file that scripts check for

Until one of those ships upstream, we handle it at the project level with the `session-start` guard.

### Release Pipeline

**Version numbers must be enforced, not documented.** A CLAUDE.md section saying "every push bumps the version" is insufficient. The pipeline must:

- Refuse to push if `package.json` != `plugin.json` != CHANGELOG head
- Refuse to push without a matching git tag
- Refuse to accept a marketplace commit whose `version` does not match its `ref` tag
- Have a single `scripts/release.sh <version>` entry point that enforces all five gates and is the ONLY way to cut a release

### Multi-Session Awareness

**Claude Code doesn't know about its own parallel sessions.** If you have two Claude Code sessions running on the same machine, they don't see each other. This means the same developer can be two independent agents pushing conflicting work. Prevention requires discipline outside of Claude Code:

- Always `git fetch origin main` before starting work
- Always check `git log origin/main..HEAD` -- if non-empty, you're ahead; if the fetch showed new commits, you're behind
- If ahead AND behind, stop and reconcile before doing anything else

Add to session-start: fetch origin and warn on divergence. This is Phase 81 work in the v1.10.0 milestone.

### Error Budget

**This incident cost roughly 6 hours of orchestrator time** (the full phase 76-80 execution happened in the wrong place and had to be transplanted). But no user-visible data loss occurred. No force-pushes. No overwritten history. The 42 commits are now in the right place with full authorship preserved. The real cost was the rework to discover the problem, not the fix itself.

**Future incidents should be caught in the first 10 minutes** via the workspace guard. If the guard ever trips and a developer has to decide "is this really the wrong workspace or a false positive", they should read this file first.

## Prevention Checklist (applied)

- [x] `scripts/session-start` refuses to run under `~/.claude/plugins/`
- [x] `.claude/includes/release-process.md` documents the workspace rule as MANDATORY
- [x] This autopsy exists and is referenced from the release-process include
- [ ] **Pending**: `scripts/release.sh` that enforces the 5-gate version consistency rule (Phase 81 of v1.10.0)
- [ ] **Pending**: Marketplace `source.ref` field pinned to git tags (Phase 81 of v1.10.0)
- [ ] **Pending**: `/mos:doctor` command so users can self-diagnose without a 10-section bespoke prompt (Phase 82 of v1.10.0)
- [ ] **Pending**: `/mos:update` pre-flight showing CHANGELOG diff before upgrading (Phase 82 of v1.10.0)
- [ ] **Pending**: `git fetch origin main` + divergence warning at session start (Phase 81 of v1.10.0)

## References

- Lawrence's original diagnostic output: see conversation log 2026-04-13
- Git commits affected: `33c8d4a` (phase 80-06 complete) back to `fc29066` (phase 76-01 start)
- Transplant method: `git format-patch 23d3b5a..HEAD` from wrong workspace → `git am --3way` in correct workspace
- Merge branch name: `merge/phases-76-80` in `~/MindrianOS-Plugin/`
