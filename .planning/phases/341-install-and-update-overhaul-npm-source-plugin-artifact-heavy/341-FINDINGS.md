# Phase 341 - Findings prelude (verified 2026-09-09, pre-discuss)

Status: verified-on-two-platforms. Input to `/gsd-discuss-phase 341` and the phase researcher.
Every number below is measured on the named artifact; nothing is estimated.

## Trigger

Two independent failures of the documented update path, same day, same symptom:

- Windows 11, `mos 2.0.0-beta.27 -> beta.29`: `claude plugin update mos@mindrian-marketplace`
  aborted twice during `git clone`, second run deleted its 144 MB staging dir. Sustained clone
  rate ~9 MB/min. (Navigator-supplied QA teardown, reproduced in full in Appendix A.)
- Linux (this dev box), same command, same versions: `Failed to clone repository ... fatal:
  early EOF`, twice, at 120 s and 300 s+ foreground windows. Manual `git clone --depth 1
  --branch v2.0.0-beta.29` of the same tag SUCCEEDS (slow): 738 MB checkout, 16,597 files.
  Full clone + `git checkout v2.0.0-beta.29`: 755 MB.

## Root cause (mechanism, not just category)

`scripts/release.sh` Step 6.7 force-adds `node_modules` into the tagged release commit
(Commit A); Commit B strips it from `main` again. Its own comment justifies this with:
"every production dependency is pure JS - audited 2026-05-21 ... the 32M tree."

That premise expired on 2026-07-05: commit `a9aa9ea3` (Phase 211-01, local embedding spine)
added `@huggingface/transformers` to `dependencies`. Nobody re-ran the premise. Measured at tag
`v2.0.0-beta.29` (`git ls-tree -r -l`):

| In the git tag                                                     | Size     | Files  |
|--------------------------------------------------------------------|----------|--------|
| node_modules (total)                                               | 410.3 MB | 8,880  |
|   onnxruntime-node                                                 | 210.1 MB |        |
|   onnxruntime-web                                                  | 128.2 MB |        |
|   @img/sharp-libvips-* (arm64 only - host-dependent optional deps) |  32.3 MB |        |
|   @huggingface/transformers                                        |   9.1 MB |        |
|   everything else = the MCP-critical pure-JS set vendoring was FOR |  29.1 MB | 6,665  |
| .planning (GSD dev state; missed by the teardown census)           |  57.1 MB |        |
| tests                                                              |  44.2 MB |        |
| lib+scripts+commands+skills+agents+hooks+bin+refs+data+tmpl+assets+dist | 29.8 MB | 2,079 |
| tag minus node_modules/.planning/tests/evals/lab/test/test-fixtures/docs/dashboard | 31.0 MB | 2,185 |

23 native binaries ship to every user for every platform (`libonnxruntime.dylib` darwin/arm64
34.3 MB, `libonnxruntime.so.1` linux x64 33.5 MB + arm64 17.8 MB, `onnxruntime.dll` +
`DirectML.dll` + `dxcompiler.dll` for win32 x64 and arm64, three `ort-wasm-*.wasm` 14-25 MB
each). Git cannot delta-compress them, so every tag re-transfers ~380 MB.

`sharp` (and its @img/* libvips binaries) is pulled ONLY by `@huggingface/transformers`
(`npm ls sharp`). The whole ~380 MB goes away with that one dependency.

## Two corrections to the teardown that change the fix

1. `node_modules` is NOT installed after the clone - it IS the clone. Cache check on Linux
   (`~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.27`): the vendored tree lands
   verbatim (the arm64-only @img variants are present unchanged, `.git` stripped, `.planning`
   66 MB and `tests` 48 MB present). Therefore `.gitattributes export-ignore` does nothing for
   the loader path: it affects `git archive`, the loader runs `git clone`.
2. The graceful-degrade path already exists and is shipped: `lib/core/eureka/embedding-spine.cjs`
   lazy-requires transformers inside `getEncoder` (Canon decision #8) and returns
   `{success:false, error:'encoder_unavailable'}` when absent; Doctor class S probes it; the
   SessionStart `scripts/sessionstart-npm-reconcile.cjs` hook (sync, 120 s, cross-platform via
   `lib/core/npm-cli-resolve.cjs`) and `lib/core/mcp-dep-heal.cjs` `requireWithHeal` already
   self-heal a missing pure-JS dep set. The slim path needs no new mechanism.

Other reproductions: F6 (cache never pruned) confirmed on Linux - beta.23/.25/.27 retained at
597 MB each (1.8 GB). F2 (legacy `~/.claude/plugins/mindrian-os` second location) is ABSENT on
Linux; it is an `install.sh`-path artifact, not universal.

## Loader facts (official Claude Code docs, verbatim via claude-code-guide, 2026-09-09)

- Supported marketplace `source` types: relative path, `github`, `url`, `git-subdir`, `npm`,
  `archive`, `command`. (plugin-marketplaces.md, "Plugin Source Types")
- `npm` source schema: `package` (required; scoped allowed, e.g. `@org/plugin`), `version?`
  (version or range), `registry?`. Table row: "Installed via `npm install`". NOT documented:
  whether `.claude-plugin/plugin.json` must sit at tarball root, prerelease/dist-tag handling.
- `archive` source schema: `url` (HTTPS only; loopback/link-local/metadata hosts rejected on
  every redirect hop), `sha256?` ("verifies every download against it and refuses the install
  on a mismatch"). "Works without git or npm on the user's machine. Requires Claude Code
  v2.1.224 or later." "Claude Code refuses archives larger than 256 MiB."
- Size ceiling, documented under "Copy mode and link mode" (a `command`-source subsection):
  "Claude Code refuses to install a directory larger than 256 MiB or containing more than
  20,000 entries." Link mode ("use the files in place ... the size limits don't apply") is for
  local directories only. NOT stated for git sources: no cap, no clone timeout, no shallow vs
  full, no retry/resume. The 256 MiB figure is the platform's stated plugin ceiling and is the
  design target; the git-clone `early EOF` itself remains undocumented behavior.
- Node.js deps (plugins-reference.md, "Node.js package dependencies"): "Claude Code runs the
  install inside the copied version directory each time it creates one: when you install a
  plugin, when Claude Code updates a plugin to a new version, and at session start when an
  enabled plugin isn't cached yet". Runs ONLY when plugin root has `package.json` AND a
  supported lockfile (`package-lock.json`, `npm-shrinkwrap.json`, `bun.lock`, `bun.lockb`):
  `npm ci --ignore-scripts` / `bun install --frozen-lockfile --ignore-scripts`.
  "**60-second timeout:** Claude Code stops an install that runs longer and treats it as
  failed." "A failed or skipped install never blocks the plugin." "A timed-out install can
  leave a partial `node_modules` tree in the cached copy." "A plugin with a `package.json` and
  no lockfile is skipped without a log entry." And, for our chosen path: "For a plugin
  distributed through an npm source, use `npm-shrinkwrap.json`; npm excludes
  `package-lock.json` from published packages."
- `CLAUDE_PLUGIN_ROOT` = absolute path to the installed plugin dir; resolved in hooks, MCP
  configs. Orphaned cache versions are swept ~14 days after uninstall; no prune command for
  plugin versions. No `--force`/`--timeout`/`--verbose` flags; export-ignore not mentioned.

Open evidence question for research: the beta.27 cache on Linux holds the VENDORED tree intact
(8,874 files vs 8,880 in the tag; arm64-only @img variants unchanged). Under the documented
rule the loader should have run `npm ci --ignore-scripts` there (root has package.json +
package-lock.json) and, on this x64 box, replaced them. Either it did not run, timed out before
`npm ci` removed anything, or the cache predates the feature. Pin this before relying on the
loader's install at all.

The existing npm artifact `@mindrian_os/cli@2.0.0-beta.29`: 6 files, 674,080 bytes unpacked
(`files` whitelist = bin/cli.js, lib/core/active-plugin-root.cjs, README, LICENSE, CHANGELOG).
It is a CLI shim today, not the plugin.

## Decision (navigator, 2026-09-09, Decision Gate): npm-source plugin

Ship the npm tarball AS the plugin. Marketplace `source` becomes `npm` pinned to the version
(not a git ref). `package.json` `files` whitelist = runtime tree (.claude-plugin/, .mcp.json,
hooks/, commands/, skills/, agents/, lib/, scripts/, bin/, data/, references/, templates/,
assets/, dist/). `@huggingface/transformers` leaves `dependencies`; Eureka installs it on demand
(explicit, user-visible, into a side dir) with the existing `encoder_unavailable` degrade.

Dependency delivery - RATIFIED at the discuss step (2026-09-09, advisor research, navigator pick):
- `npm-shrinkwrap.json` at the plugin root; the loader runs `npm ci --ignore-scripts` on install/update
  (the documented npm-source path). Platform-correct by construction: sqlite-vec ships five platform
  packages as optionalDependencies and the shrinkwrap carries all five with os/cpu constraints, so a Windows
  box resolves sqlite-vec-windows-x64. Measured on this box (npm 10.9.8): `npm ci --ignore-scripts` for the
  127-package set 9.3 s cold cache / 4.3 s warm, about 6x headroom under the loader's documented 60 s
  cutoff; 139 installed packages scanned, zero preinstall/install/postinstall scripts, so `--ignore-scripts`
  costs nothing. Tarball measured 2,092 entries / 30.5 MiB. The existing backstop (mcp-dep-heal.cjs
  `requireWithHeal` + sessionstart-npm-reconcile.cjs) stays live for the timeout tail, not dead code.
  Keep `devDependencies` empty as stated policy: `npm ci` `omit` defaults to empty unless NODE_ENV=production.
- REJECTED, `bundleDependencies`: measured pack bundled only `sqlite-vec-linux-arm64` (the publish host's
  arch); the other four platform packages were absent and cannot be forced in as hard dependencies (npm
  refuses with EBADPLATFORM). Windows/Mac/x64-Linux would get `sqlite-vec` present but `require.resolve`
  throwing, silently degrading vector-store.cjs to cjs-fallback with no error surface, and neither self-heal
  detects it (both test only top-level `dependencies` dir existence). Publish output becomes host-dependent:
  the same defect class as Step 6.7's arm64-only @img/* vendoring. Also mutually exclusive with any
  lockfile (`npm ci` removes a present node_modules first).
- TRAP (measured): `files: ["lib"]` also packs `lib/wiki/editor-src/node_modules` (9,119 entries), pushing
  the tarball to 16,893 entries / 251.5 MiB, 4.5 MiB under the ceiling. npm's node_modules exclusion is
  root-only and root .gitignore does not prevent it. Exclude `lib/wiki/editor-src` explicitly (editor-dist
  is the runtime artifact); the ceiling policy asserts entry count + unpacked bytes, not packed size.

Projected: tarball ~2,092 entries / 30.5 MiB (measured `npm pack --dry-run` on the candidate tree); the
pure-JS deps (29 MB) resolve per machine at install. Both far under the 256 MiB / 20,000-entry ceiling.

Deleted outright: release.sh Step 6.7 vendoring and the Commit A/B node_modules churn; the
2026-05-21 "32M pure JS" premise; `install.sh` as a primary path; `/mos:update` Steps 6-7 and
the restart touch-file; doctor classes A/H and the two-topology halves of I/J.

Fallback if `npm` source has an undocumented gotcha: `archive` source (zip over HTTPS with the
documented `sha256` verification, no git or npm needed on the user's machine, Claude Code
v2.1.224+) fed by `git archive` + `export-ignore` (the one place the teardown's export-ignore
idea applies).

## Migration order (corrected from the teardown)

1. Dependency + `files` cut; ship beta.30 via `npm` source; prove cold install on Windows, Mac,
   Linux. Add a HARNESS POLICY (Phase 298 machinery, `data/harness-policies/`, blocking rung)
   that asserts published tarball size and entry count against the documented cap, so a future
   211-01-class dependency can never silently 13x the payload again.
2. Retire the second install location (`doctor --fix` that verifies nothing references
   `~/.claude/plugins/mindrian-os`, backs it up, removes it); delete `/mos:update` Steps 6-7.
3. Collapse `/mos:update` to Check, Confirm, loader, Verify (staging/checksum/swap are the
   loader's + npm's; keep only the verify leg and a restart banner where it is true).
4. Retire the doctor classes whose failure mode is now unreachable (the proof the overhaul
   worked).

Open items for discuss/research: exact `npm` source schema (scoped package + prerelease
version allowed?); does the loader require `.claude-plugin/plugin.json` at tarball root;
Windows path-length behavior of the loader's tarball extraction; whether `npm ci` runs for
npm-source installs or deps must ship via `bundleDependencies` (either works: the pure-JS set
is 29 MB); Phase 285 (SEED-015 selective install) sibling scope; the `.planning` runtime readers
(`lib/core/pitch-feedback-schemas.cjs:286` writes into a `.planning/phases/229-*` path from a
command - a dev path leaking into runtime; `drift-baseline`, `skillopt-schemas`,
`reconcile-runner` are scripts-only dev tooling).

## Appendix A - Navigator-supplied QA teardown (Windows 11, 2026-09-09), verbatim

(See the conversation transcript of 2026-09-09; the teardown text is reproduced in the phase
CONTEXT.md by the discuss step so this file stays a findings record, not a document dump.)
