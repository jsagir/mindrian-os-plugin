---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 28
subsystem: ui-shell
tags: [packaging, release, rule-5, rule-8, dist, d-07, d-17, c2, licence-guard]
requires: [369-02, 369-03, 369-19, 369-20, 369-22, 369-24, 369-27]
provides:
  - scripts/build-ui-shell.cjs (build and --check freshness; dev-only, not in the tarball)
  - lib/ui-shell/dist (committed release build: Next standalone server + static client + manifest.json, no node_modules)
  - release.sh Step 2.4 UI freshness gate; RULE 5 paragraph and RULE 8 bullet; CHANGELOG [Unreleased] lines
  - tests/test-369-ui-dist-fresh.cjs (TS369-08: 11 arms including an installed-layout run)
  - launch.cjs fix: the real Next server is recognised after it renames its own process
affects: [369-29, 369-30, 369-31, 369.1]
requirements: [TS369-08]
canon_parts: [7, 8, 11]
key-files:
  created:
    - scripts/build-ui-shell.cjs
    - lib/ui-shell/dist/ (262 files)
    - tests/test-369-ui-dist-fresh.cjs
  modified:
    - package.json
    - scripts/release.sh
    - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
    - CHANGELOG.md
    - lib/ui-shell/launch.cjs
    - ui/shell/next.config.ts
key-decisions:
  - "The dist keeps the Next standalone layout: dist/server/server.js with the static client at dist/server/.next/static; manifest clientDir points there. Splitting client out would need server config changes for no gain."
  - "The plan's 'no new root dependency' truth is superseded by the 2026-10-03 ruling (next, react, react-dom are root dependencies since plan 19); this plan adds none. The bare-import check allows built-ins and root dependency names."
  - "sourceHash also covers scripts/build-ui-shell.cjs itself, so a change of build recipe makes the dist stale"
  - "Outside host names in vendor bundles are rewritten to .invalid at build time (the agent-native bake-off precedent), because UI-SPEC C2 as written needs zero literal occurrences and RxDB and emoji-mart carry inert doc and fallback links"
  - "Deterministic Next build id (the source hash) so the same sources rebuild to identical bytes except builtAt"
metrics:
  tasks: 2
  commits: 3
  completed: 2026-10-04
---

# Phase 369 Plan 28: Release-built UI shell dist, freshness gate and RULE wording Summary

The browser workspace now ships inside the plugin as a committed, reproducible release build (`lib/ui-shell/dist`, 262 files, 10.5 MB, no node_modules), the release has a Step 2.4 freshness gate that proves it matches the sources, and a real packed-and-installed layout starts the dist server through the launcher, signs the one-time link in and serves the page under its nonce CSP.

## What was built

- **scripts/build-ui-shell.cjs** (CJS, built-ins only, switch-case router, `build` default and `--check`). Build: refreshes the `ui/shell/node_modules/mos-ui-shared` copy from `ui/shared`, runs `next build` and `ui/shell/scripts/postbuild.mjs` directly with Node (telemetry off), copies the standalone output into `lib/ui-shell/dist/server`, sanitises it, verifies it and only then writes `manifest.json` (`serverEntry: server/server.js`, `clientDir: server/.next/static`, `sourceHash`, `builtAt`, `chassis: next@16.2.10`, `node_floor: >=22.18.0`, no plugin version). A failed verification removes the dist and exits 1. `--check` recomputes the hash and exits 1 with "lib/ui-shell/dist is stale: run node scripts/build-ui-shell.cjs and commit lib/ui-shell/dist".
- **Source hash**: sha256 over the sorted (path, content hash) pairs of 103 files (every file under ui/shell and ui/shared except node_modules, .next, `next-env.d.ts`, tsbuildinfo, plus the build script). Lockfiles are ordinary files under those directories, so they are in.
- **Sanitising and fail-closed checks**: (a) no node_modules directory; (b) every bare import specifier in the server output is a Node built-in or a root dependency name; (c) no outside host (see C2 below); (d) no `@blocknote/xl-`, `xl-pdf-exporter`, `xl-docx-exporter` (also checked in ui/shell's lockfile before building); (e) no absolute build-machine path (server.js and required-server-files.json carried the maintainer's repo path, now `.`; the server chdirs to its own directory and starts clean); (f) a source map that embeds an absolute path is removed (the 11 server maps are 53-byte stubs, none embeds a path, 0 removed); (g) literal em and en dash characters in vendor JavaScript become their unicode escape sequences (U+2014, U+2013), and become hyphens in non-script files.
- **release.sh** Step 2.4: one block after the erasable gate runs `node "$PLUGIN_DIR/scripts/build-ui-shell.cjs" --check` and aborts the cut with a red line naming the gate; the `--dry-run` preview list gained a Step 2.4 line (the real block is never reached under dry-run, the same shape as the erasable gate). release.sh never builds the UI.
- **RULE 5** gains one paragraph (the numbered list is unchanged and still ends at item 9, the dist carries no version string); **RULE 8** gains the no-node_modules bullet, worded with the 2026-10-03 ruling (next, react, react-dom) and the per-machine install growth. **CHANGELOG** [Unreleased]: an Added line for the workspace and the launch command `/mos:dashboard shell`, and a Changed line for next, react and react-dom joining the install (about 460 MB more on first install, tarball unchanged; plan 19 asked plan 28 to carry this).
- **package.json**: one added `files` line, `"!scripts/build-ui-shell.cjs"`.
- **tests/test-369-ui-dist-fresh.cjs**: arms 1a/1b (freshness, and a tampered hash and a missing manifest both exit 1), 2 (manifest and files), 3 (no node_modules), 4 (C2 byte scan including maps and fonts), 5 (bare imports, with a mutation that must flag `lodash` but not express, node:fs, zod), 6 (pack listing: manifest and server.js in, ui/ tools/ and the build script out, dist entry count equals files on disk), 7 (ceiling numbers, see below), 8 (installed layout), 9 (release.sh gate, no unchecked invocation, `bash -n`), 10 (licence guard).

## Verification

| Check | Result |
|-------|--------|
| `node scripts/build-ui-shell.cjs --check` | exit 0, source hash fa36f426f00b5062 over 103 files |
| Two consecutive builds from the same sources, `diff -r` | identical except `manifest.json` builtAt |
| `node tests/test-369-ui-dist-fresh.cjs` | 11 passed, 0 failed, 0 skipped, 1 known red (arm 7, below); about 30 s with a warm npm cache |
| Arm 8 installed layout | packed, extracted to `<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.56/`, `npm ci --ignore-scripts` (next, react, react-dom present), `node lib/ui-shell/launch.cjs start` from the installed directory: link 303 with Set-Cookie, `/` 200 text/html with a nonce CSP and no unsafe-inline, `stop` ends it |
| `launch.cjs start` on the built dist | no longer refuses "The workspace is not built in this install." (arm 8) |
| RULE 8: `find lib/ui-shell/dist -type d -name node_modules` | nothing |
| C2 / licence scans over every dist file (bytes, maps and fonts included) | 0 hits |
| walled-manifest 8/0, shrinkwrap-no-dev PASS=4, ts-erasable-gate 8/0, release-wiring PASS=8, release-shape-gate 5/5, engines-floor 5/0, launch-surface 17/0, shell-server 35/0 | green |
| `bash -n scripts/release.sh`; `grep -c 'build-ui-shell.cjs" --check' scripts/release.sh`; `grep -c "or code the bundler inlined"`; `grep -c "not a lockstep place"` | exit 0; 1; 1; 1 |
| `node scripts/check-release-payload-ceiling.cjs --check` | **exit 1 (RED), one finding: see "The payload ceiling is still red" below** |

### Final `npm pack --dry-run` (record for Phase 369.1)

| | entries | unpacked bytes | tarball bytes |
|--|--|--|--|
| before this plan (start of run, HEAD 2d0b27936) | 1,997 | 33,111,532 | 10,095,961 |
| after (HEAD 49a1a026a) | **2,259** | **43,605,022** | **13,189,710** |
| of which `lib/ui-shell/dist` | 262 | 10,491,301 | n/a |

That is 2,259 files and 41.6 MiB unpacked, inside the 20,000 entry and 256 MiB ceiling and inside the Desktop and Cowork limit of 5,000 files and 200 MB measured by Phase 369.1. Two things 369.1 should know: package.json `files` still contains a top-level `bin` entry (untouched by this plan; Chat and Cowork refuse a top-level `bin/`), and the 5,000 file and 200 MB figures describe the payload, not the installed tree: the per-machine `node_modules` after the loader's `npm ci` is about 511 MB (369-BAKEOFF-DECISION.md), which the dist does not change.

## The payload ceiling is still red (stated honestly, not caused by the dist)

`release-payload-ceiling` (blocking, `scripts/run-harness.cjs`) fails with exactly one finding: `npm-shrinkwrap.json declares hasInstallScript:true for: node_modules/sharp`. `sharp` is an optional dependency of `next`; it entered the shrinkwrap with plan 19's ruling "Next as a per-machine dependency" and plan 19 did not notice the gate went red. The plan's truth "the release-payload-ceiling policy still passes" cannot hold while that package is in the shrinkwrap, and neither a code change in this plan's files nor a hand edit of the shrinkwrap fixes it honestly (release step 6.7 regenerates the shrinkwrap). The numbers this plan controls are green: entries 2,259 of 20,000, bytes 43,605,022 of 268,435,456, shrinkwrap and plugin.json present, no forbidden prefix, no root lifecycle script.

Arm 7 asserts those numbers hard and treats the sharp finding as KNOWN RED: it passes only when sharp is the SOLE finding (any other finding, or a second install-script package, fails it), and `MOS_369_STRICT_CEILING=1` makes it fail on sharp too. This is a Rule 4 matter, not mine to decide. Options for the navigator: (1) keep sharp out of the install (the runtime does not need it; plan 19 showed the server starts without it) by an install-time or override change to the root manifest and a regenerated shrinkwrap; (2) amend the ceiling gate to exempt a named, non-load-bearing optional package, which weakens a security check; (3) accept the red until the ruling. Related inconsistency to resolve at the same time: RULE 8 says the loader runs `npm ci --ignore-scripts`, while the ceiling gate's comment and finding text say the loader's FIRST install passes no `--ignore-scripts`; which is true decides whether sharp's script ever runs on a user machine.

## Deviations from Plan

**1. [Rule 4 context, already ruled] "No new root dependency" and the server-build fallback.** The Shell server line in 369-BAKEOFF-DECISION.md and the ruling of 2026-10-03 already settled this: the Next standalone output ships WITHOUT its traced node_modules and `server.js` resolves `next` and `react` from the plugin root. This plan adds nothing to root `dependencies` (git diff on package.json is the one `files` line). The express-over-static-export fallback is not taken, so no amendment line was appended to the decision record.

**2. [Layout] No `dist/client` directory.** Next's standalone server serves `/_next/static` from `<server dir>/.next/static`; the client assets therefore live at `dist/server/.next/static` and `manifest.clientDir` says so. The manifest keys are the plan's six.

**3. [Rule 1 - Bug] Launcher could not stop or reuse the real shell server (plan 22 file `lib/ui-shell/launch.cjs`).** The first installed-layout run started the server, signed in and served the page, then `stop` printed "not running" and left the server alive. Root cause: Next's `start-server.js` sets `process.title = 'next-server (v16.2.10)'`, which replaces the command line in `/proc/<pid>/cmdline`, so `isOurShell()` (which looks for the server entry path in the command line) read the live server as stale, cleared the record and left it running; a second `start` would then have hit "port in use". Plan 22's tests use a plain-Node fake that never renames itself, so only the real dist exposed it. Fix: that title counts as ours only when the process working directory equals the server entry's directory (read from /proc, lsof as the fallback); anything else is still refused. Commit ec693e5ee. Two orphaned test servers from the failing runs were killed by hand (identified by their cwd under `mos-369-28-layout-*`).

**4. [Rule 3 - Blocking] C2 needed a build-time rewrite.** The built bundles contain inert text that UI-SPEC C2 forbids literally: RxDB error and notice links (`rxdb.info`, 18 files) and emoji-mart's default data URLs (`cdn.jsdelivr.net`, unreachable unless the emoji picker is given no data). Plan 18 and the workroom bake-off both recorded that plans 18 and 28 decide a rewrite; the build now rewrites those hosts to `*.invalid` (RFC 2606), the method the agent-native bake-off build used, and fails if any listed host remains. Browser egress is separately asserted by plan 29.

**5. [Rule 2 - Missing critical] Build id and hash.** (a) `ui/shell/next.config.ts` gained `generateBuildId` reading `MOS_UI_BUILD_ID` (the build script passes the source hash), because Next's random build id made every rebuild differ in 23 files and the plan requires the dist to be reproducible from sources. (b) The source hash includes the build script. Both are one-line scope additions outside `files_modified` (next.config.ts is a plan 19 file; change is three lines, the build passes typecheck).

**6. [Rule 3] Bare-import check false positives.** Two inert strings matched: `require("something")` inside a Turbopack runtime comment (comment-only lines are now skipped) and `from 'rxdb/plugins/` inside an RxDB message (a trailing-slash prefix is not a module path), plus ajv's code-generation template `require("ajv-formats/dist/formats")`, listed in `INERT_SPECIFIERS` with the reason. The mutation arm proves a real foreign import (`lodash`) is still flagged.

**7. [Test shape] Arm 7 tolerates exactly one known finding** (see the ceiling section). All other arms are as the plan lists; the plan's arm 8 daemon is the one the launcher starts itself (`ensureDaemon`), killed through the pidfile in the hermetic rooms home.

## Not run, and limits

- `bash scripts/release.sh --dry-run` was NOT run end to end: it prints a step list and exits before Step 2.4, so it cannot exercise the gate; the gate is covered by arm 1 (the exact command), arm 9 (presence, no unchecked build, `bash -n`) and test-353 and test-235. The block itself ran only through its command.
- Exact-floor Node 22.18.0 was not available (as in plan 03); the dist is plain JavaScript and the installed-layout arm ran on v22.23.1.
- The launcher's process identification still cannot work on Windows (no /proc or ps); pre-existing, not changed.
- A cold npm cache makes arm 8 download the full install (hundreds of MB); the warm cache lives in `os.tmpdir()/mos-369-28-npm-cache-<shrinkwrap hash>`.
- RULE 6: this release-infrastructure change (a new Step 2.4 gate, a new committed artifact class) ships as a beta first.
- Docs that still contradict the 2026-10-03 ruling were listed by plan 19 (CLAUDE.md line 138, `.planning/codebase/CONVENTIONS.md`, `.claude/includes/decisions.md` row 17); not edited here.

## Known Stubs

None.

## Threat Flags

None new. T-369-28-01 to -06 are covered: node_modules refusal in the build and arm 3, the sourceHash gate (arm 1), the C2 scan (arm 4), the bare-import check (arm 5), absolute-path removal and scrub (build verification), the xl-* scan (arm 10).

## Commits

- `ec693e5ee` fix(369-28): launcher recognises the real Next server after it renames its own process
- `4f3d314da` feat(369-28): release-built UI shell dist, built by scripts/build-ui-shell.cjs, no node_modules
- `49a1a026a` feat(369-28): Step 2.4 UI freshness gate, RULE 5 and RULE 8 sentences, release note, dist test

STATE.md and ROADMAP.md were not touched (orchestrator owns them); no version was bumped and release.sh was not run.
