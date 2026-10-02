# Release Process (MANDATORY)

Workspace rule: every commit, push, and release happens in `/home/jsagi/dev/MindrianOS-Plugin/`, never the `~/.claude/plugins/` install cache (see the WORKSPACE GUARD above).

## Version Consistency Rule

A release is only a release when all FIVE are in sync (any drift = silent version mismatches):

1. `CHANGELOG.md` has the version entry at the top
2. `.claude-plugin/plugin.json` `version` matches
3. `package.json` `version` matches
4. `git tag v<version>` points at the release commit
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` updated, `source.version` pinned to the exact release version (npm source, no `v` prefix; `ref`/`url` deleted -- D-01/D-06)

## Telling Theo

A real release also tells Theo. `release.sh` Step 5.6 fires a `repository_dispatch` at `jsagir/theo` (event `theo-resync`) immediately after the tag is verified at origin, so Theo can re-emit its command layer against the version that just shipped instead of discovering the drift on the next cut.

- `--no-theo-notify` is the audited opt-out, a SEPARATE flag from `--no-theo-check`; the release log names the flag and the consequence when engaged.
- `--dry-run` prints the step and sends nothing.
- The release lockstep count lives in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 place 8; this line carries no number of its own. See `docs/THEO-NOTIFY-CONTRACT.md` for the rulings and the working-decision ledger.
- The canon snapshot `data/framework-names.json` is in the lockstep too: `release.sh` refuses a cut until `node scripts/refresh-framework-names.cjs --live` has stamped it after Theo's re-emit (`--no-canon-snapshot-check` is the audited opt-out); the rule lives in RULE 5 of `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`.

## Release-cut listener

- Step 0.55, Theo leg: `scripts/release-cut-listener.cjs` calls Theo's release bridge before the stamp gates, stops the cut on the contract's stop codes and prints the apply line on code 20. This is what actually re-syncs Theo, since the Step 5.6 dispatch has no Theo-side receiver today.
- Step 9.6c, website leg: read-only, never aborts, reports each website version and count surface plus banned content.
- `--no-cut-listener` is the audited opt-out; `--dry-run` prints and runs nothing; report files land under `$HOME/.mindrian/release-cut-listener/`; details in RULE 5.

## Entry Point

Run `scripts/release.sh <version>` to enforce all five gates. Never bump versions by hand.

## How Users Upgrade

Third-party plugins do not auto-push (a stale user is correct-by-design). The two-command manual path (always include in user-facing docs):

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

Deep dive (marketplace-pinning, beta-gating, the 2026-04-13 incident): docs/autopsies/2026-04-13-wrong-workspace-incident.md. The vendored node_modules rule described there was RETIRED by Phase 341 (v2.0.0-beta.31): dependencies ship as `npm-shrinkwrap.json` inside the npm tarball and the loader installs them per machine; see docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 8.
