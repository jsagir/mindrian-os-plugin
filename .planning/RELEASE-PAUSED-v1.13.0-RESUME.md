# Release PAUSED -- v1.13.0 finalize blocked on npx-install-UX bug (2026-06-02)

The 130.5 -> 130.7 -> 131 -> 132 chain is COMPLETE, green, and committed on local main.
The release was PAUSED (user decision) on a longstanding `npx @mindrian_os/install`
bug, NOT a problem with the chain. Stable users are unaffected.

## Current state (local main, nothing pushed)

- HEAD: `00acfa7c release: v1.13.0-beta.42` (+ `2ba74382` bin-alias fix, `86f5d464` beta.41, `90507529` release self-test fix)
- version files + CHANGELOG: `1.13.0-beta.42` (CHANGELOG [Unreleased] was consumed into the beta.42 entry)
- working tree: CLEAN; plugin 109 commits ahead of origin (NOT pushed); marketplace local at `release: sync to v1.13.0-beta.42` (NOT pushed)
- local tags (unpushed): v1.13.0-beta.42, v1.13.0-beta.40, v1.13.0-beta.4 (orphan typo, pre-existing)
- node_modules tracked at HEAD (4029 files) -- pre-existing on origin/main since beta.37; release.sh Step 7.5 un-tracks on a completed cut
- npm dist-tags: `latest: 1.13.0-beta.36` (STABLE USERS SAFE), `next: 1.13.0-beta.42` (functional via `npm install`, broken via `npx`)
- websites (install-minisite + mindrian-website): deployed to beta.42 (live). They advertise `npx @mindrian_os/install`, which is broken; the marketplace install path works.

## The bug (root cause, fully diagnosed)

`npx @mindrian_os/install` does NOT work. The PACKAGE is fine:
`npm install @mindrian_os/install@1.13.0-beta.42` exits 0, links `.bin/install` + `.bin/mindrian-os`
to an executable `bin/cli.js` with a valid shebang, and running it works.
The failure is npx-specific: npx does not put the package bins on PATH, so the unscoped
package name segment `install` (which COLLIDES with coreutils `/usr/bin/install`) gets run
instead, or `mindrian-os` is "not found". This is a longstanding issue (the release.sh
Step 9.7 comment notes the same `mindrian-os: not found` against beta.36); the v1.13.0
finalize is the first cut to gate on it via the Step 9.7 npx self-test. My beta.42 bin-alias
addition (the `install` alias) did NOT fix it (the package was never the problem) and can be
reverted or kept harmlessly.

## Two latent RELEASE-INFRA bugs found + fixed during this attempt (both committed)

1. `90507529` -- doctor.cjs pre-tag self-test ran `release.sh --dry-run` with no mode; on a
   clean (just-bumped) finalize version that exits 1. Fixed: pass `patch` (valid on clean + suffixed).
2. `2ba74382` -- added an `install` bin alias (misdiagnosis of the npx bug; harmless, keep or revert).

Both would have stayed hidden without the beta-first path; the npx self-test (Step 9.7) is what
caught the install-UX bug BEFORE it reached stable users.

## RESUME steps (the deliberate npx-UX fix, then finalize)

1. Fix the npx install UX. Options (a product decision):
   - Rename the npm package off `install` to an npx-safe name (e.g. `@mindrian_os/cli`) so
     `npx @mindrian_os/cli` resolves; deprecate the old package; update README line 100 +
     both websites + release.sh package references.
   - OR change the documented install command to the working path
     (`claude plugin install mos@mindrian-marketplace`, the PRIMARY path, or `npm i -g ... && mindrian-os`)
     and update the Step 9.7 self-test to match.
2. Re-add a `## [Unreleased]` CHANGELOG section for the npx-UX fix.
3. `npm deprecate @mindrian_os/install@1.13.0-beta.41` and `@1.13.0-beta.42` (broken via npx) -- OPTIONAL but recommended.
4. Cut beta.43 via `release.sh --prerelease --allow-ahead`; the Step 9.7 npx self-test must PASS
   (verify a sandbox `npx` round-trip succeeds BEFORE relying on the gate).
5. `release.sh --finalize --allow-ahead` -> 1.13.0 (the doctor self-test fix from `90507529` lets finalize pass).

## Deferred items carried into v1.14.0 (independent of the release)

- Phase 132 bulk hypergraph reify (132-02), ~278-node wire-it (132-04), pseudonymize 6 internal :Person nodes -- DI-132-05-01/02.
- Phase 132 held-14 disposition (DI-132-LIVE-01) -- 7 archive-as-dup + 7 rename, per-node judgment; held nodes safe as-is. Snapshot at 132-LIVE-CLEANUP-SNAPSHOT.json. The 1 dedup pair (6831/22816) WAS collapsed live.
- Phase 137 (Brain<->MindrianOS sync harness) + Phase 138 (capability-radar) -- v1.14.0 backlog.
