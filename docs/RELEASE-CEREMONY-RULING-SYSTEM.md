# Release Ceremony Ruling System

> Authoritative contract for cutting a MindrianOS release. Codified 2026-06-02 from
> the v1.13.0 finalize, which hit four latent bugs (finalize-path self-test, npx
> name collision, npx-by-name false alarm, partial-release split-brain). Every rule
> below exists because something broke without it. `scripts/release.sh` is the
> implementation; this document is the law it must honor. No release is "proper"
> unless every RULE here holds.

## RULE 0 -- Workspace + freeze

- Run ONLY from `/home/jsagi/MindrianOS-Plugin/` (never `~/.claude/plugins/*`). Confirm `pwd` + the CLAUDE.md WORKSPACE GUARD.
- `.planning/` is gitignored; stage planning artifacts with `git add -f`.
- Nothing is "released" until pushed. Local commits + local tags are reversible; treat them as a staging area until RULE 7 completes.

## RULE 1 -- The npm package is a SLIM installer, not the plugin

- The npm package `@mindrian_os/cli` ships ONLY the installer essentials: `bin/cli.js` + `lib/core/active-plugin-root.cjs` (+ README / LICENSE / CHANGELOG). `package.json:files` MUST stay this slim (~164KB, ~6 files).
- The CLI's job is to drive `claude plugin install mos@mindrian-marketplace`. It NEVER needs the plugin payload (lib/skills/commands/agents/...) -- that ships via the marketplace git artifact. Shipping the whole 8.5MB plugin in the npm tarball is a defect.
- Re-audit `files` whenever `bin/cli.js`'s requires change. Today its only non-node require is `active-plugin-root.cjs` (node-builtins-only). If the installer gains a require, add that file to `files` or the published bin breaks.

## RULE 2 -- The npm package name must be npx-safe

- `npx @mindrian_os/<seg>` derives the command from the unscoped segment `<seg>`. `<seg>` MUST NOT collide with a system command. `install` collides with coreutils `/usr/bin/install` -- BANNED. `cli` is safe. Re-check any rename against `command -v <seg>`.
- The bin map MUST include a bin whose key equals the unscoped segment, so `npx @mindrian_os/<seg>` resolves cleanly: `bin: { "mindrian-os": "bin/cli.js", "cli": "bin/cli.js" }`. Keep `mindrian-os` as the human-facing installed global command.

## RULE 3 -- The npx-publish self-test asserts INSTALLABILITY, not launcher runtime

- The Step 9.7 self-test (and the doctor `npx-roundtrip` acceptance check) MUST verify the published package via `npm install @mindrian_os/cli@<version>` into a sandbox, then assert: install rc 0, `bin/cli.js` PRESENT, `node --check` PARSES it, and the `.bin/mindrian-os` symlink exists.
- It MUST NOT assert `npx @pkg@version`'s runtime exit code. Reasons, both proven 2026-06-02: (a) the launcher shells out to `claude`/`git` that are absent in a bare sandbox, so a healthy package exits non-zero for an ENVIRONMENT reason; (b) npm 10.9.7's npx-by-name does not reliably link the package bin onto PATH (`sh: mindrian-os: not found`) even though `npm install` / `npm install -g` / marketplace / local-tarball-npx all work. Asserting the launcher runtime produced false `R.4 yank` aborts on every cut since beta.37.
- The package's user-facing `npx @mindrian_os/cli` is BEST-EFFORT (npm-version-sensitive). The blocking, advertised-as-primary install path is `claude plugin install mos@mindrian-marketplace`.

## RULE 4 -- Self-tests must be mode-robust

- Any self-test that shells `release.sh` (e.g. the doctor `release-dry-run-output` check) MUST pass an explicit bump mode (`patch`). A bare `release.sh --dry-run` requires a mode when the current version is a clean X.Y.Z; during `--finalize` the version is already clean by the time pre-tag self-tests run, so a bare dry-run exits 1 and aborts the finalize.

## RULE 5 -- Version sync (the single home of the lockstep count)

**This is the single home of the release lockstep count.** Any other file that mentions the lockstep points here and carries no number of its own (Phase 343 card (d), WD-12: the count was previously stated four different ways across four files, and every seventh-place addition before this one landed against a system that could not agree with itself on how many places already existed).

A release is a release only when ALL of the following are in sync (enforced by `release.sh`, never bumped by hand):
1. `CHANGELOG.md` top entry == NEW_VERSION (maintain a `## [Unreleased]` section between cuts; release.sh renames it).
2. `.claude-plugin/plugin.json` version.
3. `package.json` version.
4. git tag `v<version>` on Commit A.
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` version + `source.version == <version>` (npm source, `package: @mindrian_os/cli`, no `v` prefix; the git `ref`/`url` pin was retired by Phase 341 D-01/D-06 as of v2.0.0-beta.31, 2026-09-10).
6. The npm publish of `@mindrian_os/cli` at NEW_VERSION (Step 9.5).
7. The mindrian-website sync (Step 9.6b), which carries the npx COMMAND string (`npx @mindrian_os/cli`) -- update it on rename, not just the version.
8. Theo's command-layer re-emit against the version just released (Phase 343 Plan 07, WD-13; quick 261002-5v9 and quick 261002-byh, navigator rulings 2026-10-02), described here as ONE place with two halves. The LAGGING half: verified retroactively, at the START of the NEXT release, by `scripts/release-lib/theo-stamp-gate.sh` sourced into `release.sh`'s preamble and called at Step 0.6 before Step 1: it asserts Theo's `mappedBy` stamp equals the CURRENT plugin version and fails closed on a mismatch or an unreachable Theo. `--no-theo-check` is the audited opt-out; under `--dry-run` the gate reports the verdict without aborting (WD-20). The LEADING half: run on the SAME release, before any mutation, by the release-cut listener's Theo leg at Step 0.55 (`scripts/release-cut-listener.cjs`, called right before Step 0.6): it calls Theo's release bridge (`release_sync.py`, contract `docs/RELEASE-SYNC-CONTRACT.md` in the Theo repo) with the version being cut and the full HEAD sha, and stops the cut on every exit code that contract says stops. `--no-cut-listener` is its audited opt-out, a SEPARATE flag from `--no-theo-check`; under `--dry-run` it prints its call and runs nothing. The Phase 349 leading half, Step 5.6's `repository_dispatch` (event `theo-resync`) through `theo-notify-gate.sh` with its `--no-theo-notify` flag, was retired by quick 261002-byh: no Theo workflow ever received that event. `docs/THEO-NOTIFY-CONTRACT.md` keeps its history, marked superseded. These are ONE place, not two: they are the two directions of a single coupling between this repo and Theo, and splitting them into two numbered places would restate the lockstep count in a new way, which is the precise failure WD-12 recorded and this rule's single-home statement exists to prevent.
9. Canon snapshot freshness (Phase 366 Plan 06, D-17): `data/framework-names.json` `theo_stamp.mapped_by` equals the current version, verified offline by `scripts/release-lib/canon-snapshot-gate.sh` sourced into `release.sh`'s preamble and called at Step 0.6 (as Step 0.6b, right after place 8's lagging half), a LAGGING gate like place 8: it refuses the cut when the snapshot was never stamped or was stamped against an older version, and treats a missing or malformed snapshot as a READ FAILURE. Refresh with `node scripts/refresh-framework-names.cjs --live` after Theo's re-emit; that command reads Theo's `mappedBy` through the same call place 8's gate makes and writes `theo_stamp {mapped_by, plugin_version, refreshed_at}`. This gate plus that command is the delivered form of D-17's leading edge; place 8's leading half (Step 0.55) does not call it automatically. `--no-canon-snapshot-check` is the audited opt-out; under `--dry-run` the gate reports the verdict without aborting.

**The UI shell assets (Phase 369, plan 28).** The UI shell assets (Phase 369) in `lib/ui-shell/dist` are a release-built artifact checked at Step 2.4 by `scripts/build-ui-shell.cjs --check` against a recorded source hash. They carry no version string, so they are not a lockstep place and the numbered list above is unchanged. The maintainer builds and commits the dist for a release; `release.sh` never builds the UI.

**The release-cut listener (quick 261002-5v9, navigator ruling 2026-10-02).** `scripts/release-cut-listener.cjs` drives existing places rather than adding one, so the numbered list above is unchanged. Its Theo leg runs at Step 0.55, before place 8's lagging gate: it calls Theo's release bridge (`release_sync.py`, contract `docs/RELEASE-SYNC-CONTRACT.md` in the Theo repo) with the version `lib/core/repo-version.cjs` reports and the full HEAD sha, and stops the cut on every exit code that contract says stops (code 20 prints the navigator's apply and verify lines verbatim). Its website leg runs at Step 9.6c, right after place 7's Step 9.6b, as a read-only scan of the website repo's own `docs/VERSION-BUMP-CHECKLIST.md` surfaces (version strings, command counts, banned content); this repo still carries no copy of that file (WD-14 stands), and the leg never aborts because it runs after npm publish (RULE 7). A missing Theo or website checkout is a loud SKIPPED, never silent; `--no-cut-listener` is the audited opt-out for both legs; `--no-theo-check` does not skip the Theo leg, and when it is set every Step 0.55 fail-open line says nothing guards Theo freshness on that cut (place 8's gate is off too) instead of claiming the stamp gate still guards, while a Theo STOP there is lifted only by `--no-cut-listener`; under `--dry-run` the Theo leg prints its call and runs nothing. Since quick 261002-byh retired Step 5.6 (the `theo-resync` dispatch no Theo workflow received), this Theo leg is place 8's leading half.

The install minisite (formerly Step 9.6a) is NOT counted as a place here: it was retired on 2026-06-09, and `NO_MINISITE=1` is the default (`release.sh:113`).

**The VERSION-BUMP-CHECKLIST.md contradiction, resolved and cited.** Phase 343's WD-14 (RULED, STANDING, 2026-09-14): "`VERSION-BUMP-CHECKLIST.md` is NOT created in this repo. The seventh place is the `release.sh` step plus this rule's enumeration; the roadmap's reference to that filename is recorded as resolved." Phase 349's own roadmap card repeated the filename as deliverable 4 ("VERSION-BUMP-CHECKLIST.md and the release-process include name the step"), and the contradiction was put to the navigator at 349-03's blocking checkpoint on 2026-09-16. Ruling: option (a), WD-14 stands. Deliverable 4 is satisfied instead by this rule's place 8 (above) plus `.claude/includes/release-process.md`, per `docs/THEO-NOTIFY-CONTRACT.md`'s Navigator Ratification section. If you came here looking for `VERSION-BUMP-CHECKLIST.md`, it does not exist, and that is deliberate.

**A different six-count, not this one.** `lib/core/doctor/install-state-module.cjs`'s `collectVersionOfRecord` six-way comparison (IP, AV, SR, LV, PB, and the spot-checked installed plugin.json) is a runtime install-consistency check over artifacts already on a user's machine, not this release-cut lockstep. Conflating the two is the most likely error a later reader makes; they share no members and answer different questions.

**5a -- the catalog advertises the RELEASED stable, never the dev next-bump (load-bearing).** The marketplace `marketplace.json.version` is what `claude plugin install` LABELS users with NOW. It MUST equal the released `NEW_VERSION` with `source.ref == vNEW_VERSION`. Commit B's next-bump advances ONLY the plugin repo's `plugin.json` + `package.json` (the next dev cycle) -- it MUST NOT touch `marketplace.json`. A catalog that advances to the dev next-bump pushes users onto a pre-release they never opted into (2026-06-02: a tester installed `1.13.1-beta.1` minutes after the `1.13.0` finalize because the old Commit B bumped the catalog version; RCA `marketplace-catalog-advertises-dev-next-bump`). Invariant to assert post-cut: `marketplace.json.version === source.ref without the leading 'v'`.

## RULE 6 -- Beta-first for release infrastructure

- Any change to release.sh, doctor.cjs acceptance gates, session-start guards, hooks, or migration scripts ships as `X.Y.Z-beta.N` FIRST and is promoted to final only after the npx-install self-test passes and (ideally) one external smoke. Bugs in release infra are the hardest to recover from -- a broken gate blocks shipping its own fix.
- Finalize order: cut `--prerelease` (beta.N) -> the install self-test (RULE 3) must PASS -> then `--finalize` -> X.Y.Z.

## RULE 7 -- Ordering, reversibility, and partial-release recovery

- Order: bump (Step 3-4) -> pre-tag acceptance (6.6, HARD) -> Commit A + tag (7) -> npm publish (9.5) -> Commit B next-bump (7.5) -> push both repos (9) -> minisite (9.6a) + website (9.6b) -> install self-test (9.7, RULE 3) -> full acceptance (9.8).
- REVERSIBLE before push: version bumps (rolled back on a pre-tag abort), local Commit A/B, local tag. A pre-tag abort (Step 2.5 / 6.6) leaves NO public residue.
- IRREVERSIBLE once done: `npm publish`, the website git push, the minisite vercel deploy. If a gate AFTER publish aborts, you have a SPLIT-BRAIN (npm `@next` + websites at NEW_VERSION; plugin origin + tag + marketplace at the prior version). Recovery: either complete the push (`git push origin main --tags` + marketplace push) if the publish was healthy, OR `npm deprecate` the broken version and cut a successor. NEVER leave `@latest` pointing at a broken version -- betas live on `@next` (opt-in), `@latest` stays on the last good final.
- Broken published betas MUST be `npm deprecate`d with a message pointing at the successor.
- Step 9.7 now waits up to the propagation budget (`NPX_PROP_RETRIES` x `NPX_PROP_BACKOFF_S`, default 48 x 15s = 12 minutes, env-overridable) for an asynchronous npm publish to become visible before the install self-test runs, and proceeds on timeout because the self-test still gates (quick task 260917-o1y).

## RULE 8 -- Clean-tree + ahead guard

- `release.sh` aborts at Step 2.5 if the working tree is dirty (tracked files). Restore/commit drift first. A prior interrupted cut can leave uncommitted version bumps -- `git checkout -- plugin.json package.json CHANGELOG.md` (and the marketplace `marketplace.json`) to reset before re-cutting.
- `node_modules` is NOT tracked and is never vendored (Phase 341 D-03/D-04, v2.0.0-beta.31): the published tarball carries `npm-shrinkwrap.json` (generated at Step 6.7 behind `scripts/release-lib/shrinkwrap-gate.sh`) and the Claude Code loader runs its own `npm ci --ignore-scripts` per machine, so every platform resolves its own native packages. The `release-payload-ceiling` harness policy (blocking, Step 6.6 pre-tag) refuses a tarball over 20,000 entries or 256 MiB unpacked. Do not vendor `node_modules` again: the 2026-05-21 "32M pure JS" premise expired on 2026-07-05 (Phase 211-01 added the 380 MB embedding stack) and the resulting 755 MB tag that died in `git clone` on Windows and Linux is why Phase 341 exists.
- `lib/ui-shell/dist` ships no node_modules tree; its server resolves only root dependencies the loader installs (express, @modelcontextprotocol/client, zod, and, by the navigator's 2026-10-03 ruling "Next as a per-machine dependency", next, react and react-dom) or code the bundler inlined into the built files, and adds no package of its own to the install; the maintainer builds and commits it for a release, and release.sh only checks its freshness (Phase 369). The tarball stays slim; the per-machine install is what grows with the framework runtime (measured +460 MB in 369-BAKEOFF-DECISION.md).
- Use `--allow-ahead` when the chain is many commits ahead of origin (expected after a multi-phase build).

## RULE 9 -- Canon boundaries hold during the ceremony

- The npm package + minisite carry only generic install copy and version strings -- zero user data (Canon Part 8). The marketplace artifact is plugin bytes only.
- Every release commit passes the live pre-commit substrate guard + brain-boundary-scan. NEVER `--no-verify`.

---

## The ceremony, in order (operator runbook)

1. `pwd` + WORKSPACE GUARD; `git fetch origin main`; ensure clean tree (RULE 8).
2. Maintain `## [Unreleased]` in CHANGELOG with the cut's changes.
3. `bash scripts/release.sh --prerelease --allow-ahead` -> beta.N. Expect it to run to Step 9.8 GREEN. The install self-test (9.7, RULE 3) is the real proof the package installs.
4. If a post-publish gate aborts: diagnose per RULE 3 (is it a real package break, or the false-alarm class?). Recover per RULE 7.
5. Smoke: `npm install -g @mindrian_os/cli@<beta>` in a sandbox + `mindrian-os doctor`; or `claude plugin install mos@mindrian-marketplace --version <beta>`.
6. `bash scripts/release.sh --finalize --allow-ahead` -> X.Y.Z (RULE 6 order; RULE 4 lets the finalize self-test pass).
7. Verify RULE 5 five-place sync at origin; `npm dist-tag ls @mindrian_os/cli` shows `latest: X.Y.Z`.
8. `npm deprecate` any broken intermediate betas.

_This ruling system supersedes ad-hoc release knowledge. Amend it (not the script alone) when a new failure mode is found -- the script enforces; this document explains why._
