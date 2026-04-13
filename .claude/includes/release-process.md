# Release Process (MANDATORY)

## Workspace Rule (CRITICAL — read first)

**The canonical development workspace is `/home/jsagi/MindrianOS-Plugin/`. Every commit, every push, every release happens here.**

`~/.claude/plugins/mindrian-os/` is NOT a dev workspace. It is where Claude Code installs the plugin for read access. It has a `dev` remote pointing at this workspace, but commits made there never reach GitHub. Working in it silently diverges from the release pipeline.

**Before any session that touches the plugin:**
1. `cd ~/MindrianOS-Plugin` (verify with `pwd`)
2. `git fetch origin main` (never work on a stale local clone)
3. `git status` (uncommitted drift should be stashed or explained)
4. If you find yourself at a path starting with `~/.claude/plugins/`, **STOP**. Change directory and restart the session.

`scripts/session-start` has a workspace guard that refuses to execute in the plugin cache directory. If you see the guard trip, you are in the wrong place.

**Known incident:** On 2026-04-13, a full GSD milestone (phases 76-80, Obsidian vault import, 42 commits) was executed in `~/.claude/plugins/mindrian-os/` instead of here. The work was valuable but invisible to GitHub. Root cause and recovery: `docs/autopsies/2026-04-13-wrong-workspace-incident.md`. Prevention: the workspace guard + this rule.

## Version Consistency Rule (MANDATORY)

A release is only a release when **all five** are in sync:

1. `CHANGELOG.md` has an entry for the version at the top
2. `.claude-plugin/plugin.json` `version` field matches
3. `package.json` `version` field matches
4. `git tag v<version>` exists pointing at the release commit
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` is updated with the new version AND its `source` has a `ref` field pinned to the tag

If any of these drift, users get silent version mismatches. The diagnostic Lawrence ran on 2026-04-13 found `plugin.json` saying 1.9.9 while the registry said 1.9.4 — a symptom of this drift.

**Run `scripts/release.sh <version>` (when it exists) to enforce all five gates. Never bump versions by hand.**

## Marketplace Source Must Be Pinned

The marketplace `source` URL **must include a `ref` field** pointing at a git tag:

```json
"source": {
  "source": "url",
  "url": "https://github.com/jsagir/mindrian-os-plugin.git",
  "ref": "v1.10.0"
}
```

Without `ref`, Claude Code clones whatever `origin/main` HEAD is at install time. Users then can never pin themselves to a stable version. Every install and every auto-update becomes a roll-the-dice. **Pinning the ref is non-negotiable.**

## The Standard Release Process

Every time you push changes to the plugin repo, follow this exact process:

## Step 1: Update CHANGELOG.md
Add a new entry at the top with the version number and date:
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added
- Feature description
### Fixed
- Bug fix description
### Changed
- Change description
```

## Step 2: Bump version in plugin.json
Update "version" in .claude-plugin/plugin.json to match the CHANGELOG version.

## Step 3: Commit with version tag
```bash
git add CHANGELOG.md .claude-plugin/plugin.json [changed files]
git commit -m "release: vX.Y.Z -- [one-line summary]"
git tag vX.Y.Z
```

## Step 4: Push with tags
```bash
git push origin main --tags
```

Users get notified automatically -- SessionStart checks GitHub CHANGELOG once per day and shows "[Update Available]" in Larry's greeting.

Never skip this process. Every push that changes user-facing functionality MUST bump the version.
