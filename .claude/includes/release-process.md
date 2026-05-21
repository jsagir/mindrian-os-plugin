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

## Vendored node_modules Rule (release-time lockstep surface)

The plugin ships its production `node_modules` with the released marketplace artifact so the bundled MCP servers (`mindrian-brain` + `mindrian-os`) have their dependencies present the instant the install cache lands -- no runtime `npm install`, no network, no startup race (debug session `mcp-servers-cache-missing-node-modules`). The marketplace install delivers only git-tracked files at the tagged ref, so the vendored tree must be git-tracked at the tagged release commit.

This is a **release-time** lockstep surface, not a `main` surface:

- `scripts/release.sh` Step 6.7 builds the tree fresh via `npm ci --omit=dev` (so it can NEVER drift from `package-lock.json`), runs an integrity gate (`npm ls --omit=dev` + MCP-critical-dep presence check), and `git add -f node_modules` into **Commit A** (the tagged release commit).
- Step 7.5 (Commit B, which becomes `main` HEAD) runs `git rm -r --cached node_modules`, so `main` HEAD never carries the vendored tree. Only the tagged release commits do; git deduplicates identical blobs across tags.
- The `npm pack` payload gate (Step 9.5) rejects `node_modules/` from the published npm tarball -- the npm channel resolves deps from the registry; only the git-distributed marketplace artifact carries the vendored tree.

**Prerequisite:** `package-lock.json` must be in sync with `package.json` (`npm ci` refuses a stale lock). `scripts/verify-release` checks this. If it fails, run `npm install` to resync the lock and commit it.

**Vendoring is only cross-platform-safe because every production dependency is pure JavaScript** (no native/compiled binaries). Re-audit when adding a dependency: a package with a `.node` addon, a `binding.gyp`, prebuilt platform binaries, or an install lifecycle script would make a single vendored tree platform-specific. If a native dep is ever added, this rule must change (per-platform trees, or drop vendoring for runtime install).

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

## How Users Actually Receive Updates (read this before you panic about staleness)

**A stale user is not a bug. It is a feature.**

Third-party plugin marketplaces in Claude Code intentionally do NOT auto-push updates. This is a safety decision by Anthropic: users should never get breaking changes pushed to them without explicit consent. The 2026-04-13 Lawrence incident partially looked like a "pipeline broken" issue, but the staleness half of it was correct-by-design. Lawrence's install never got updated because he never asked for an update.

### Two independent update channels

Claude Code has two separate auto-update mechanisms. Both are off by default for third-party plugins:

| Channel | How users enable/disable | Default for 3rd-party |
|---|---|---|
| Marketplace auto-update | `/plugin` -> Marketplaces -> select marketplace -> toggle auto-update | OFF |
| Claude Code release channel | `/config` -> Auto-update channel: `stable` or `latest` | `stable` (1 week behind) |

### The two-command manual upgrade path (what you tell users to run)

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

The first command is the one most users forget exists. If a user reports "I don't see the new version", 90% of the time the answer is "run `/plugin marketplace update` first, then the catalog will show v1.10.0 available".

### When writing release notes or user-facing docs

Always include the two-command upgrade path, not just the install path. Never apologize for users being stale -- it is correct-by-design behavior. If they want to be on the edge, they can enable marketplace auto-update themselves.

### Pre-release versions for beta testing

For release infrastructure changes (the release pipeline itself, hooks, migration scripts -- anything that is too dangerous to ship cold), use pre-release suffixes:

```json
{ "version": "1.11.0-beta.1" }
```

Users opt in with:

```bash
claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1
```

Only users who explicitly ask for a beta get it. Everyone else stays on stable. When the beta is validated, promote by re-releasing as `1.11.0` without the suffix.

**Release infrastructure ALWAYS ships as a beta first.** `/mos:doctor`, `release.sh`, pre-push hooks, session-start guards, migration scripts -- all of these go out as `X.Y.Z-beta.N` and get promoted after at least one external user (currently Lawrence) confirms they work. Bugs in release infrastructure are the hardest to recover from -- a broken release script can prevent you from shipping its own fix. Beta gating is the only safe path.

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
