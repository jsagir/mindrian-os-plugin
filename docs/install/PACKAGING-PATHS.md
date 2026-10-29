# MindrianOS Distribution Paths

> Audience: anyone deciding how to ship or deploy the MindrianOS plugin --
> testers, institutional IT (NATO Defense College Rome, Hopkins, Hebrew
> University), and the maintainer cutting a release.
> Status (refreshed 2026-10-29, Phase 341): path 2 (marketplace + npm,
> package `@mindrian_os/cli`) is live and primary. Path 1 (marketplace + GitHub)
> is historical. Paths 3 and 4 still work. The archive source is the documented,
> unbuilt fallback.
> Proved: the cold install on Windows, macOS and Linux is NOT proved. The
> navigator waived that proof and it was not observed. See
> [COLD-INSTALL-PROOF-341](COLD-INSTALL-PROOF-341.md) for exactly what was and
> was not seen.

Claude Code supports four canonical ways to distribute a plugin. They are not
mutually exclusive -- you pick whichever fits the deployment, and the same
plugin source backs all of them.

---

## The four paths

| # | Path | How | Status | Use this when... |
|---|------|-----|--------|------------------|
| 1 | Marketplace + GitHub source (HISTORICAL) | `marketplace.json` -> `{"source": {"source": "github", "repo": "jsagir/mindrian-os-plugin"}}` with a `ref` pinned to a release tag. The user got a git clone of the release tag. | Retired as the primary path by Phase 341. See "Why path 1 was retired" below. | Never for a new deployment. |
| 2 | Marketplace + npm source (LIVE, PRIMARY) | `marketplace.json` -> `{"source":"npm","package":"@mindrian_os/cli","version":"<exact>"}`. User flow: `/plugin marketplace add jsagir/mindrian-os-marketplace`, then `/plugin install mos@mindrian-marketplace`. Claude Code resolves the npm package; the user never needs to know it is npm underneath. | Live. The marketplace source has been npm-shaped since 2.0.0-beta.31 (Linux update observed, see the proof record). Windows and macOS cold installs: waived, not observed. | Default for every user and tester. |
| 3 | ZIP / URL | `claude --plugin-url https://<stable-url>/mindrian-os-vX.Y.Z.zip` or `claude --plugin-dir ./mindrian-os-vX.Y.Z.zip`. Both `--plugin-url` and `--plugin-dir` accept a `.zip` archive natively. The archive is built by a release-time `npm run pack-zip` step producing `dist/mindrian-os-vX.Y.Z.zip` (that build step is a future D-05e deliverable; this doc just describes the path). | Works today (the `--plugin-url` / `--plugin-dir` invocations); the `pack-zip` build step is not yet wired. | Private / air-gap deployments where public npm or GitHub is not reachable. Try-before-install. NATO IT could host the `.zip` on their internal network. |
| 4 | CI / Docker pre-bake | At image-build time set `CLAUDE_CODE_PLUGIN_CACHE_DIR=/opt/claude-seed` and run `claude plugin marketplace add ...` + `claude plugin install mos@...` so the plugin installs into that directory, then `COPY /opt/claude-seed` into the image. At runtime, machines with `CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed` get MindrianOS pre-installed. `/plugin marketplace remove` and `/plugin marketplace update` are blocked on seed-managed plugins (admin-controlled state). OPEN QUESTION (341-RESEARCH assumption A8): see "Path 4: the open question" below. | Works today as an env-var contract. (The Dockerfile recipe + the bring-your-own-installer recipe are future D-05f deliverables.) | **THE RECOMMENDED NATO FACULTY DEPLOYMENT PATH**, once the A8 question is settled. It removes per-machine install variability: faculty machines are image-baked with MindrianOS and get a working install at first launch with zero network calls at runtime. Also the right path for any classroom / managed-fleet deployment. |

**"Use this when..." summary:**

- Everyone, today -> path 2 (marketplace + npm).
- Private / air-gap / power users -> path 3 (ZIP / URL).
- Institutional / classroom / managed fleets (NATO, Hopkins, etc.) -> path 4 (CI / Docker pre-bake), after the A8 question is answered.

---

## Path 2 in detail: the source shape and why the version is exact

The marketplace entry for the plugin is:

```json
{"source":"npm","package":"@mindrian_os/cli","version":"<exact>"}
```

The version is an exact release version (for example `2.0.0-beta.31`). It is
never a range and never a dist-tag. Two measured reasons (341-RESEARCH, D-01
and loader ground truth):

1. A range stops resolving. Measured on semver 7.8.0: the range
   `^2.0.0-beta.30` rejects `2.0.1-beta.1` and `2.1.0-beta.1`. A caret range
   silently stops matching once the patch or minor tuple moves.
2. The loader's cache hit is a literal string equality against the installed
   version. Only an exact pin can ever produce a cache hit. A dist-tag would
   also push every publish to every user, because `scripts/release.sh` Step 9.5
   promotes `@next` to `@latest`, and third-party plugins must never auto-push.

## What the loader does on the npm path

This is the part operators most need and cannot read from the docs. Measured
against Claude Code 2.1.266 (341-RESEARCH, F-1 to F-3):

1. The loader runs a real `npm install` of the package into a shared cache at
   `~/.claude/plugins/npm-cache`.
2. It copies ONLY the package directory from that cache into the versioned
   plugin cache. The hoisted dependencies are discarded, so the plugin arrives
   with no `node_modules`.
3. If a supported lockfile is in the plugin directory, it runs
   `npm ci --ignore-scripts` there, with a 60 second cap. That second install is
   the only thing that puts dependencies next to the plugin.

`npm-shrinkwrap.json` is the lockfile that makes step 3 work. `package-lock.json`
is never published by npm, so it cannot do this job. If `npm-shrinkwrap.json` is
missing from the tarball, the dependency install is skipped WITHOUT a log entry
and both MCP servers fail to load. `npm-shrinkwrap.json` is also not included
automatically in a tarball that has a `files` allowlist: it must be listed
explicitly. Phase 341 gates this at release time.

## Why path 1 was retired

Path 1 delivered a git clone of the release tag. The tag carried vendored
`node_modules`. Measured at tag `v2.0.0-beta.29` (341-FINDINGS, root cause
table): 410.3 MB in 8,880 files of `node_modules`, of which `onnxruntime-node` was
210.1 MB and `onnxruntime-web` was 128.2 MB. The result was `fatal: early EOF`
during `claude plugin update` on Windows and on Linux (341-FINDINGS, symptoms).
On the dev box, 392.6 MB of the 441 MB local `node_modules` was the embedding
stack (341-RESEARCH, D-03 row), which Phase 341 removed from `dependencies`.
The vendored `node_modules` rule is retired; dependencies now ship as
`npm-shrinkwrap.json` and the loader installs them per machine
(`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 8).

## Path 4: the open question

341-RESEARCH assumption A8 is OPEN for whoever owns the pre-bake path. The
pre-bake flow assumes the baked image carries a `node_modules` that the loader's
`npm ci` created. If the seed copy was taken before the dependency install ran,
a pre-baked fleet gets a plugin with no dependencies and no network at runtime.
Nobody has checked this. Do not treat path 4 as settled until someone builds one
image and confirms `node_modules` is inside the seed directory.

## Fallback: the archive source (documented, not built)

Decision D-05 kept a fallback and did NOT build it. The `archive` source is a
real path: an HTTPS zip, with a documented `sha256` check that refuses the
install on a mismatch. It needs neither git nor npm on the user's machine. It
requires Claude Code v2.1.224 or later (341-FINDINGS, platform docs). Its limits
are machine-enforced: a 256 MiB cap on the download, a 120 second HTTP timeout
and 5 redirects (341-RESEARCH, loader ground truth).

It was not built because 341-RESEARCH found no undocumented gotcha in the npm
path that would justify it, and it needs a hosting surface and a build step
that do not exist. The 256 MiB and 20,000-entry figures are the platform's
stated plugin ceiling, but the platform does not enforce them on the npm path
(341-RESEARCH, F-4); the `release-payload-ceiling` policy is the enforcement
for this artifact.

Revisit the archive source only if one of these becomes true:

- The npm path shows a failure the loader owns and we cannot fix (for example a
  loader first-install timeout; 341-RESEARCH assumption A1 is still unknown).
- npm registry reach fails for a real class of users, and path 3 does not cover
  them.
- A release cannot stay under the payload ceiling with the npm path.

## Where install.sh went

The shell installer `install.sh` is retired as of Phase 341. It was never one
of the four canonical paths. Its only unique behavior was to create a second
install location at `~/.claude/plugins/mindrian-os`, and to write hook and
statusline entries in `~/.claude/settings.json` keyed to that directory. That
second location was root cause B in the navigator's teardown: two answers to
where the plugin lives.

If you still have a copy of `install.sh`, do not run it. Use path 2 instead:

```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

The old location is torn down safely by `doctor --fix`, through
`scripts/migrate-legacy-install-location.cjs`. The order is fixed: verify that
nothing in `~/.claude/settings.json` still resolves through the old directory
(refuse if anything does), back the directory up to
`~/.mindrian/legacy-install-backup-<ISO>/` and verify the backup, and only then
remove it. It runs as a dry run unless `--apply` is given.

---

## Installing Claude Code itself

MindrianOS is a plugin; it needs Claude Code on the machine first. Install
Claude Code via Anthropic's native installer, not via npm:

- macOS / Linux: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows: `irm https://claude.ai/install.ps1 | iex`

The legacy `npm install -g @anthropic-ai/claude-code` still works but is
documented as deprecated in current Anthropic install guides, and Claude Code
surfaces an in-app warning to users running the old npm install telling them
to switch. MindrianOS install documentation recommends the native installer.

---

## Cross-references

- [COLD-INSTALL-PROOF-341](COLD-INSTALL-PROOF-341.md) -- the three-platform proof record. Status: WAIVED by the navigator, not observed.
- `.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-PACKAGING-RESEARCH.md` Section 10 -- the four-path inventory, Tavily-validated, with the NATO pre-bake recommendation
- The install site (mindrianos-install-site.vercel.app) -- the user-facing surface; should surface all four paths
- `scripts/release.sh` Step 9.5 -- the `npm publish` lockstep gate (D-05a)
- `docs/install/BRAIN-SETUP.md` -- after install, how users connect the Brain MCP
- `.planning/milestones/v1.13.0-PRODUCTION-READINESS-AUDIT.md` -- recommends path 4 (SEED_DIR pre-bake) as the NATO faculty deployment vehicle
