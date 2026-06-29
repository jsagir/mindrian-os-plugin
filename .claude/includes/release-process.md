# Release Process (MANDATORY)

## Workspace Rule (CRITICAL -- read first)

The canonical development workspace is `/home/jsagi/dev/MindrianOS-Plugin/`. Every commit, push, and release happens here. `~/.claude/plugins/mindrian-os/` is NOT a dev workspace -- it is the install cache; commits there never reach GitHub.

Before any session: `cd ~/dev/MindrianOS-Plugin` (verify with `pwd`), `git fetch origin main`, `git status`. If your path starts with `~/.claude/plugins/`, STOP, change directory, and restart. `scripts/session-start` has a workspace guard that refuses to run in the cache.

## Version Consistency Rule (MANDATORY)

A release is only a release when all FIVE are in sync:

1. `CHANGELOG.md` has the version entry at the top
2. `.claude-plugin/plugin.json` `version` matches
3. `package.json` `version` matches
4. `git tag v<version>` points at the release commit
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` is updated AND its `source.ref` is pinned to the tag

If any drift, users get silent version mismatches.

## Entry Point

Run `scripts/release.sh <version>` to enforce all five gates. Never bump versions by hand.

## How Users Upgrade

A stale user is correct-by-design: third-party plugins do not auto-push. The two-command manual upgrade path (always include this in user-facing docs):

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

## Deep Dive

Full ceremony detail -- vendored node_modules rule, marketplace-pinning rationale, the two update channels, pre-release/beta-gating discipline, and the 2026-04-13 wrong-workspace incident -- lives in docs/autopsies/2026-04-13-wrong-workspace-incident.md and the full release-process doc.
