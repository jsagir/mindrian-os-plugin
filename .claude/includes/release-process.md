# Release Process (MANDATORY)

Workspace rule: every commit, push, and release happens in `/home/jsagi/dev/MindrianOS-Plugin/`, never the `~/.claude/plugins/` install cache (see the WORKSPACE GUARD above).

## Version Consistency Rule

A release is only a release when all FIVE are in sync (any drift = silent version mismatches):

1. `CHANGELOG.md` has the version entry at the top
2. `.claude-plugin/plugin.json` `version` matches
3. `package.json` `version` matches
4. `git tag v<version>` points at the release commit
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` updated, `source.version` pinned to the exact release version (npm source, no `v` prefix; `ref`/`url` deleted -- D-01/D-06) (the same file carries the Desktop copy `mos-desktop` at plugins[1], built at Step 6.8; see RULE 5 in docs/RELEASE-CEREMONY-RULING-SYSTEM.md)

## Telling Theo

A real release also tells Theo, before anything is mutated. `release.sh` Step 0.55 (the release-cut listener's Theo leg, `scripts/release-cut-listener.cjs`) calls Theo's release bridge (`release_sync.py`) with the version being cut and the HEAD sha, so Theo re-emits its command layer against the version about to ship instead of discovering the drift on the next cut; it stops the cut on the bridge contract's stop codes and prints the apply line on code 20.

- `--no-cut-listener` is the audited opt-out, a SEPARATE flag from `--no-theo-check`; the release log names the flag and the consequence when engaged.
- `--dry-run` prints the call and runs nothing.
- The release lockstep count lives in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 place 8; this line carries no number of its own. The old Step 5.6 `repository_dispatch` (event `theo-resync`) and its `--no-theo-notify` flag were retired by quick 261002-byh because no Theo workflow received it; `docs/THEO-NOTIFY-CONTRACT.md` keeps that history, marked superseded.
- The canon snapshot `data/framework-names.json` is in the lockstep too: `release.sh` refuses a cut until `node scripts/refresh-framework-names.cjs --live` has stamped it after Theo's re-emit (`--no-canon-snapshot-check` is the audited opt-out); the rule lives in RULE 5 of `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`.

## Release-cut listener

- Step 0.55, Theo leg: `scripts/release-cut-listener.cjs` calls Theo's release bridge before the stamp gates, stops the cut on the contract's stop codes and prints the apply line on code 20. This is what re-syncs Theo (RULE 5 place 8's leading half).
- Step 9.6c, website leg: read-only, never aborts, reports each website version and count surface plus banned content.
- `--no-cut-listener` is the audited opt-out; `--dry-run` prints and runs nothing; report files land under `$HOME/.mindrian/release-cut-listener/`; details in RULE 5.

## The real-room rule

No cut without a real-room run read by a human (navigator ruling 2026-10-05). `release.sh` Step 2.6 refuses a cut unless `~/.mindrian/release-real-room/<HEAD sha>.json` exists, written by `node scripts/real-room-run.cjs --read-by "<your name>"` after you read its report; `--no-real-room-check` is the audited opt-out, `--desktop-verified mac|win` records the Desktop leg, and the doctor point `real-room-run` shows the latest receipt against HEAD. The receipt also carries a negative leg (the never-ready fixture, room.db missing and corrupted, every research job must refuse with a typed reason) and Step 2.6 refuses a receipt without it or whose negative leg ran. The rule lives in RULE 10 of `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`.

## Entry Point

Run `scripts/release.sh <version>` to enforce all five gates. Never bump versions by hand.

## How Users Upgrade

Third-party plugins do not auto-push (a stale user is correct-by-design). The two-command manual path (always include in user-facing docs):

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

Deep dive (marketplace-pinning, beta-gating, the 2026-04-13 incident): docs/autopsies/2026-04-13-wrong-workspace-incident.md. The vendored node_modules rule described there was RETIRED by Phase 341 (v2.0.0-beta.31): dependencies ship as `npm-shrinkwrap.json` inside the npm tarball and the loader installs them per machine; see docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 8.
