# Release Process (MANDATORY)

Workspace rule: every commit, push, and release happens in `/home/jsagi/dev/MindrianOS-Plugin/`, never the `~/.claude/plugins/` install cache (see the WORKSPACE GUARD above).

## Version Consistency Rule

A release is only a release when all FIVE are in sync (any drift = silent version mismatches):

1. `CHANGELOG.md` has the version entry at the top
2. `.claude-plugin/plugin.json` `version` matches
3. `package.json` `version` matches
4. `git tag v<version>` points at the release commit
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` updated, `source.version` pinned to the exact release version (npm source, no `v` prefix; `ref`/`url` deleted -- D-01/D-06)

## Entry Point

Run `scripts/release.sh <version>` to enforce all five gates. Never bump versions by hand.

## How Users Upgrade

Third-party plugins do not auto-push (a stale user is correct-by-design). The two-command manual path (always include in user-facing docs):

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

Deep dive (marketplace-pinning, beta-gating, the 2026-04-13 incident): docs/autopsies/2026-04-13-wrong-workspace-incident.md. The vendored node_modules rule described there was RETIRED by Phase 341 (v2.0.0-beta.31): dependencies ship as `npm-shrinkwrap.json` inside the npm tarball and the loader installs them per machine; see docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 8.
