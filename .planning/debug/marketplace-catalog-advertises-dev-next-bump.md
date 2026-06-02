---
kind: rca
slug: marketplace-catalog-advertises-dev-next-bump
status: resolved
severity: high
surface: release-pipeline (marketplace catalog) + user install
filed: 2026-06-02
filed_by: v1.13.0 post-finalize -- live tester report
observed_on:
  - v1.13.0 finalize (a tester installed/updated within 20 min and got 1.13.1-beta.1)
---

# RCA: marketplace catalog advertises the dev next-bump, not the released stable

## Summary
Minutes after the v1.13.0 finalize, a real tester ran `claude plugin install/update
mos@mindrian-marketplace` and landed on **1.13.1-beta.1** instead of the stable
**1.13.0**. The marketplace catalog on origin advertised `plugins[0].version =
1.13.1-beta.1` while `source.ref = v1.13.0`. Claude Code labels the install with the
catalog VERSION (1.13.1-beta.1) even though source.ref clones the v1.13.0 (stable)
code. Users were pushed onto a pre-release they never opted into.

## Root cause
`scripts/release.sh` Step 7.5 (Commit B, the "Phase 126.1 7-place lockstep" hotfix)
advanced `marketplace.json` `plugins[0].version` to NEXT_VERSION after EVERY cut,
including a finalize. The marketplace CATALOG is what users install NOW, so its
version must stay at the RELEASED version (NEW_VERSION). The dev next-bump belongs
ONLY in the plugin repo's plugin.json / package.json (the next dev cycle), never in
the catalog. source.ref was correct (v1.13.0); only the version field was wrong.

## Impact
Every user installing in the window after a finalize gets labeled with the dev
next-bump pre-release. They run the stable CODE (source.ref pins it) but are
mislabeled and, on a Claude Code build that resolves the catalog version as the
install target, may be pushed past the stable. High-visibility for testers.

## Fix (resolved 2026-06-02)
1. IMMEDIATE: corrected `~/mindrian-marketplace/.claude-plugin/marketplace.json`
   version 1.13.1-beta.1 -> 1.13.0 (source.ref already v1.13.0) and pushed. A fresh
   sandbox `claude plugin install mos@mindrian-marketplace` now lands 1.13.0
   (verified). Affected users relabel with `claude plugin marketplace update &&
   claude plugin update mos@mindrian-marketplace`.
2. STRUCTURAL: `release.sh` Step 7.5 (Commit B) NO LONGER touches marketplace.json.
   The catalog stays at NEW_VERSION (set in Step 4, committed by Commit A) with
   source.ref=vNEW_VERSION; only the plugin repo's plugin.json/package.json advance
   to NEXT_VERSION. The Commit B marketplace commit is now a deliberate graceful
   no-op. Dry-run echo + RULE 5 of docs/RELEASE-CEREMONY-RULING-SYSTEM.md updated.

## Prevention
RULE 5 amended: the marketplace catalog version advertises the released stable, never
the dev next-bump. A future release-pipeline self-test should assert
`marketplace.json.version === source.ref (minus the v)` after a cut.
