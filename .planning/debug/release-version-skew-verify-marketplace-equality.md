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

## Cross-references

- `scripts/release.sh` (Step 2 verify call; Step 4 marketplace bump; Step 7.5 Commit B)
- `scripts/verify-release` (check #3 version sync)
- Phase 123 install-lifecycle-harness (introduced the two-commit Commit-B form)
- feedback_release_dual_website_lockstep memory (the 9.6 web-surface steps)
