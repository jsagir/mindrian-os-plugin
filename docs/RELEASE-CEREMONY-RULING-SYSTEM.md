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

## RULE 5 -- Version sync (the 5-place + lockstep)

A release is a release only when ALL are in sync (enforced by `release.sh`, never bumped by hand):
1. `CHANGELOG.md` top entry == NEW_VERSION (maintain a `## [Unreleased]` section between cuts; release.sh renames it).
2. `.claude-plugin/plugin.json` version.
3. `package.json` version.
4. git tag `v<version>` on Commit A.
5. `~/mindrian-marketplace/.claude-plugin/marketplace.json` version + `source.ref == v<version>`.
Plus the dual-website / install-minisite lockstep (Step 9.6a minisite, 9.6b mindrian-website) and the npm publish of `@mindrian_os/cli`. The minisite/website carry the npx COMMAND string (`npx @mindrian_os/cli`) -- update it on rename, not just the version.

**5a -- the catalog advertises the RELEASED stable, never the dev next-bump (load-bearing).** The marketplace `marketplace.json.version` is what `claude plugin install` LABELS users with NOW. It MUST equal the released `NEW_VERSION` with `source.ref == vNEW_VERSION`. Commit B's next-bump advances ONLY the plugin repo's `plugin.json` + `package.json` (the next dev cycle) -- it MUST NOT touch `marketplace.json`. A catalog that advances to the dev next-bump pushes users onto a pre-release they never opted into (2026-06-02: a tester installed `1.13.1-beta.1` minutes after the `1.13.0` finalize because the old Commit B bumped the catalog version; RCA `marketplace-catalog-advertises-dev-next-bump`). Invariant to assert post-cut: `marketplace.json.version === source.ref without the leading 'v'`.

## RULE 6 -- Beta-first for release infrastructure

- Any change to release.sh, doctor.cjs acceptance gates, session-start guards, hooks, or migration scripts ships as `X.Y.Z-beta.N` FIRST and is promoted to final only after the npx-install self-test passes and (ideally) one external smoke. Bugs in release infra are the hardest to recover from -- a broken gate blocks shipping its own fix.
- Finalize order: cut `--prerelease` (beta.N) -> the install self-test (RULE 3) must PASS -> then `--finalize` -> X.Y.Z.

## RULE 7 -- Ordering, reversibility, and partial-release recovery

- Order: bump (Step 3-4) -> pre-tag acceptance (6.6, HARD) -> Commit A + tag (7) -> npm publish (9.5) -> Commit B next-bump (7.5) -> push both repos (9) -> minisite (9.6a) + website (9.6b) -> install self-test (9.7, RULE 3) -> full acceptance (9.8).
- REVERSIBLE before push: version bumps (rolled back on a pre-tag abort), local Commit A/B, local tag. A pre-tag abort (Step 2.5 / 6.6) leaves NO public residue.
- IRREVERSIBLE once done: `npm publish`, the website git push, the minisite vercel deploy. If a gate AFTER publish aborts, you have a SPLIT-BRAIN (npm `@next` + websites at NEW_VERSION; plugin origin + tag + marketplace at the prior version). Recovery: either complete the push (`git push origin main --tags` + marketplace push) if the publish was healthy, OR `npm deprecate` the broken version and cut a successor. NEVER leave `@latest` pointing at a broken version -- betas live on `@next` (opt-in), `@latest` stays on the last good final.
- Broken published betas MUST be `npm deprecate`d with a message pointing at the successor.

## RULE 8 -- Clean-tree + ahead guard

- `release.sh` aborts at Step 2.5 if the working tree is dirty (tracked files). Restore/commit drift first. A prior interrupted cut can leave uncommitted version bumps -- `git checkout -- plugin.json package.json CHANGELOG.md` (and the marketplace `marketplace.json`) to reset before re-cutting.
- `node_modules` is tracked on origin/main (vendored for the marketplace MCP servers since beta.37). `release.sh` Step 6.7 vendors it into Commit A; Step 7.5 un-tracks it for main HEAD. Do not hand-fix the tracking.
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
