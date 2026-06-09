---
kind: rca
slug: release-version-skew-verify-marketplace-equality
status: open-known-issue
severity: medium
discovered: 2026-06-09
discovered_during: v1.13.1-beta.12 release cut
component: scripts/release.sh + scripts/verify-release
---

# Release version-skew: verify-release demands plugin==marketplace equality, but Commit-B design intentionally skews them

## Symptom

`bash scripts/release.sh --prerelease --allow-ahead` aborts at Step 2 (pre-release
verification) with exactly one failed check:

```
x Version MISMATCH: plugin=1.13.1-beta.11 marketplace=1.13.1-beta.10
DO NOT RELEASE. Fix 1 failures first.
ABORT: Pre-release verification failed.
```

24/27 checks pass; only the version-consistency check fails. Nothing is published or
pushed (clean abort).

## Root cause

Two designs in the release system contradict each other:

1. **The two-commit "Commit B" design (Phase 123).** After releasing vN (Commit A,
   tagged), Commit B bumps `plugin.json` + `package.json` to the NEXT in-progress
   pre-release (e.g. beta.10 -> beta.11) and resets the CHANGELOG `[Unreleased]`
   heading. The marketplace repo gets NO Commit B by design -- its catalog stays at
   the last RELEASED version (beta.10) so installs advertise the released stable.
   Result between releases: `plugin.json` is ALWAYS one pre-release ahead of
   `marketplace.json`. The tags go even (beta.2/4/6/8/10); the working tree sits at
   the odd in-progress placeholder (beta.11).

2. **verify-release check #3** (`scripts/verify-release`, the `# 3. VERSION SYNC
   (plugin.json == marketplace.json)` block, ~lines 63-74) enforces STRICT equality
   `PLUGIN_VER == MARKET_VER` and `fail`s otherwise.

So check #3 fails on the NORMAL in-progress state. release.sh Step 2 runs
verify-release BEFORE the bump, so the very first real release attempt after any
Commit-B bump hits this. (The `--dry-run` path never catches it: it short-circuits
BEFORE Step 2.)

## Workaround used for beta.12 (2026-06-09)

1. Commit any dirty tracked files first (Step 8 dirty-guard also blocks; here it was
   the .planning/ROADMAP.md + STATE.md edits -- `git add -f`, they are gitignored).
2. Pre-sync `~/mindrian-marketplace/.claude-plugin/marketplace.json` `version` field
   to MATCH plugin (`beta.10 -> beta.11`). This is TRANSIENT and safe: release.sh
   Step 4 immediately overwrites marketplace version + `source.ref` to the NEW
   release version (beta.12) pointing at the real tag, so the unreleased beta.11
   value never gets committed/pushed. (Leave `source.ref` alone -- there is no
   beta.11 tag; do NOT point ref at an unreleased tag.)
3. Re-run `bash scripts/release.sh --prerelease --allow-ahead`. verify-release #3 now
   passes (plugin==marketplace==beta.11), the release bumps both to beta.12, tags,
   publishes, pushes. Confirmed: beta.12 shipped clean (tag at origin, npm @next,
   marketplace ref pinned, mindrian-os.com live).

## Proper fix (deferred -- beta-gate per CLAUDE.md release-infra rule)

Patch verify-release check #3 to TOLERATE the intentional in-progress skew. Acceptable
states should be EITHER:
- `marketplace == plugin` (just-released / pre-synced), OR
- `marketplace == plugin's immediate released predecessor` (the normal Commit-B
  in-progress state: plugin=beta.N+1, marketplace=beta.N).

Implement by computing the predecessor via `semver` and accepting both. Until then,
the workaround above is required on every release whose working tree carries a
Commit-B bump.

## Secondary cosmetic bug (same area)

The `--dry-run` "To run the actual release:" hint prints the bump mode WITHOUT the
leading dashes (`prerelease` instead of `--prerelease`), at the dry-run tail
(release.sh ~line 252). Copy-pasting it yields `unknown arg: prerelease`. The first
beta.12 attempt failed this way. Fix: echo `--$BUMP_MODE` (or the literal flag) in the
hint. Low severity.

## Sibling finding (2026-06-09): marketplace push landed on the wrong branch (beta.12 catalog miss)

During the beta.12 cut, `~/mindrian-marketplace` was checked out on a FEATURE branch
(`chore/canonical-domain-mindrian-os`), not its default/catalog branch `master`.
release.sh Step 4/7/9 edited + committed marketplace.json (-> `c39915f` beta.12) and
pushed on the CURRENT branch, so `master` (the branch `claude plugin marketplace`
actually reads) stayed at beta.10. The release reported success because its local
checks passed -- but the published catalog never advertised beta.12. Users (and the
maintainer's own `claude plugin update`) saw "already latest (beta.10)."

NOTE the marketplace repo's default branch is `master`, NOT `main` (the plugin repo
is `main`). `raw.githubusercontent.com/.../main/...` 404s; the catalog lives on
`master`.

Manual fix applied (2026-06-09): `git checkout master` in the marketplace repo,
`git checkout chore/canonical-domain-mindrian-os -- .claude-plugin/marketplace.json`
to grab the correct beta.12 version+ref, commit (`91f3c3d` "release: sync catalog to
v1.13.1-beta.12 (master)"), `git push origin master`. Then `claude plugin marketplace
update` + `claude plugin update mos@mindrian-marketplace` -> updated beta.10 -> beta.12.

### Proper guard for release.sh (deferred, beta-gate)
Before any marketplace commit/push, ASSERT the marketplace repo is on its default
branch:
```
MKT_DEFAULT=$(git -C "$MARKETPLACE_DIR" symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')   # = master
MKT_CUR=$(git -C "$MARKETPLACE_DIR" branch --show-current)
[ "$MKT_CUR" = "$MKT_DEFAULT" ] || { echo "ABORT: marketplace on '$MKT_CUR', expected default '$MKT_DEFAULT'"; exit 1; }
```
Same class as the plugin-repo workspace guard. Without it, a stray checked-out branch
silently misroutes the catalog push.

### KEEP FOR LATER (navigator 2026-06-09): do NOT delete `chore/canonical-domain-mindrian-os`
The branch is RELEVANT -- it carries the canonical-domain README change (commit
`14749ed` "set mindrian-os.com as canonical website in README"), which aligns with
the 2026-06-09 decision to make `mindrian-os.com` the single canonical web surface
(see feedback_release_dual_website_lockstep UPDATE + release.sh commit 89c6b398).
Review + merge that README change into `master` when convenient; until then the branch
stays. (Its other commit, `c39915f` beta.12 marketplace sync, is now redundant -- the
same change is on master via `91f3c3d`.)

## Cross-references

- `scripts/release.sh` (Step 2 verify call; Step 4 marketplace bump; Step 7.5 Commit B; the missing default-branch guard above)
- `scripts/verify-release` (check #3 version sync)
- Phase 123 install-lifecycle-harness (introduced the two-commit Commit-B form)
- feedback_release_dual_website_lockstep memory (the 9.6 web-surface steps; UPDATE 2026-06-09 single-surface canon)
- marketplace repo branch `chore/canonical-domain-mindrian-os` (KEEP -- canonical-domain README, merge later)
