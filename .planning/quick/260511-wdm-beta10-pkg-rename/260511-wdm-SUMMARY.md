---
quick_id: 260511-wdm
slug: beta10-pkg-rename
date: 2026-05-11
status: partial
reason: "Build + commit + tag done locally. Pushed to GitHub + marketplace. npm publish (@mindrian_os/cli) still pending a working token -- the @mindrian_os org was created moments ago; the tokens supplied so far either require 2FA (npm_6ob...) or are scoped too narrowly to see the new org (npm_sU4w3K..., 404 on PUT)."
---

# Quick Task 260511-wdm SUMMARY -- v1.13.0-beta.10 + npm package rename

## What shipped (commits on `main`)

- `40c4211` release(beta.10): rename npm package `@mindrian/os` -> `@mindrian_os/cli`; bump `package.json` + `.claude-plugin/plugin.json` to `1.13.0-beta.10`. Forward-looking refs swapped in `scripts/release.sh` (8 sites: comments + recovery-message text), `docs/install/PACKAGING-PATHS.md` (2), `tests/manual/95.6-windows-cold-install-acceptance.md` (2), `tests/test-release-npm-gate.sh` (1). `bin` field unchanged (`{"mindrian-os":"bin/cli.js"}`). Historical records (autopsy, FEEDBACK.md, the UI-UX-CONVERGENCE doc, the `[1.13.0-beta.9]` CHANGELOG entry) left intact -- they correctly describe the pre-rename state.
- `103a8fb` docs(beta.10): CHANGELOG `## [1.13.0-beta.10] - 2026-05-11` entry (Changed: the rename; Notes: re-cut of beta.9 content, Windows cold-install gate still waived, install paths live). No em-dashes.
- Tag: `v1.13.0-beta.10` -> `103a8fb`.

`bash tests/run-all-956.sh` -> **8/8 PASS** (before and after the rename; `test-release-npm-gate.sh` still green after its `@mindrian/os` -> `@mindrian_os/cli` swap).

## Shipped to GitHub + marketplace (orchestrator, 2026-05-11)

- `git push origin main --tags` -> `origin/main` advanced; tag `v1.13.0-beta.10` on GitHub.
- `~/mindrian-marketplace/.claude-plugin/marketplace.json`: `mos` -> `1.13.0-beta.10`, `source.ref` -> `v1.13.0-beta.10`; committed + pushed to `origin/master`.
- Install paths live: `claude plugin install/update mos@mindrian-marketplace --version 1.13.0-beta.10`; direct `install.sh` from the `v1.13.0-beta.10` tag.

## Still pending: npm publish

`npm publish --access public --tag next` for `@mindrian_os/cli@1.13.0-beta.10` -- needs a token that (a) has Read+Write on `@mindrian_os`-scoped packages and (b) bypasses 2FA (granular access token with "Bypass two-factor authentication for write actions" enabled), created by a member of the just-created `@mindrian_os` npm org. The two tokens supplied during this session don't qualify: `npm_6ob...` -> `403 two-factor authentication ... required`; `npm_sU4w3K...` -> `404 on PUT` (granular token scoped before the org existed). Until a working token lands (or `jsagir` runs `npm publish --otp=<code>` directly), `npx @mindrian_os/cli@next` / `npm i -g @mindrian_os/cli@next` are dead; the marketplace + install.sh paths work.

`npm pack --dry-run` clean: 590 files, ~1.8 MB packed, no `.planning/` / `docs/` / `mcp-server-brain/` / `tests/` / `release.sh` (the `files` allowlist works).

## Follow-ups

- Once the npm publish lands: update `~/mindrianos-install-site/` to advertise `npx @mindrian_os/cli@next` (mount the `NpmQuickInstall` component, currently gated; `app/page.tsx`), and run `gsd-tools phase complete 95.6`.
- `~/mindrianos-install-site/` and `docs/testers/outbox/2026-05-07-gary-laben-welcome.md` still carry `@mindrian/os` references + "open source" adjacent to "BSL-1.1" -- manual sweep (separate repos / gitignored).
- Promotion to a clean `1.13.0` (no suffix) still wants a Windows cold-install acceptance run (the gate doc is `tests/manual/95.6-windows-cold-install-acceptance.md`).
