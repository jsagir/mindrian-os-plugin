# MindrianOS Distribution Paths

> Audience: anyone deciding how to ship or deploy the MindrianOS plugin --
> testers, institutional IT (NATO Defense College Rome, Hopkins, Hebrew
> University), and the maintainer cutting a release.
> Status: paths 1 + 3 + 4 work today; path 2 unblocks once `@mindrian_os/install`
> is published to npm (Phase 95.6 D-05a, the release.sh Step 9.5 publish gate).

Claude Code supports four canonical ways to distribute a plugin. They are not
mutually exclusive -- you pick whichever fits the deployment, and the same
plugin source backs all of them.

---

## The four paths

| # | Path | How | Status | Use this when... |
|---|------|-----|--------|------------------|
| 1 | Marketplace + GitHub source | `marketplace.json` -> `{"source": {"source": "github", "repo": "jsagir/mindrian-os-plugin"}}` with a `ref` pinned to a release tag. User: `/plugin marketplace add jsagir/mindrian-os-marketplace` then `/plugin install mos@mindrian-os-marketplace`. | Works today. This is what `mindrian-marketplace` currently does. | Default for testers. The immediate-now-unblocked path while npm publish (path 2) is pending. |
| 2 | Marketplace + npm source | `marketplace.json` -> `{"source": {"source": "npm", "package": "@mindrian_os/install", "version": "^1.13.0"}}`. User flow is identical to path 1; Claude Code resolves the npm package transparently. | Blocked on D-05a -- the `npm publish` Step 9.5 in `scripts/release.sh` plus the first beta.9 publish. Once that lands, this becomes the primary Path A. | After the publish lands. Cleanest distribution -- users never need to know it's npm under the hood. |
| 3 | ZIP / URL | `claude --plugin-url https://<stable-url>/mindrian-os-vX.Y.Z.zip` or `claude --plugin-dir ./mindrian-os-vX.Y.Z.zip`. Both `--plugin-url` and `--plugin-dir` accept a `.zip` archive natively. The archive is built by a release-time `npm run pack-zip` step producing `dist/mindrian-os-vX.Y.Z.zip` (that build step is a future D-05e deliverable; this doc just describes the path). | Works today (the `--plugin-url` / `--plugin-dir` invocations); the `pack-zip` build step is not yet wired. | Private / air-gap deployments where public npm or GitHub is not reachable. Try-before-install. NATO IT could host the `.zip` on their internal network. |
| 4 | CI / Docker pre-bake | At image-build time set `CLAUDE_CODE_PLUGIN_CACHE_DIR=/opt/claude-seed` and run `claude plugin marketplace add ...` + `claude plugin install mos@...` so the plugin installs into that directory, then `COPY /opt/claude-seed` into the image. At runtime, machines with `CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed` get MindrianOS pre-installed. `/plugin marketplace remove` and `/plugin marketplace update` are blocked on seed-managed plugins (admin-controlled state). | Works today. (The Dockerfile recipe + the bring-your-own-installer recipe are future D-05f deliverables; this doc describes the env-var contract.) | **THE RECOMMENDED NATO FACULTY DEPLOYMENT PATH.** It eliminates per-machine install variability entirely: faculty machines are image-baked with MindrianOS and get a working install at first launch with zero install-time failure surface and zero network calls at runtime. NATO faculty pre-test depends on this path being documented before 2026-05-23. Also the right path for any classroom / managed-fleet deployment. |

**"Use this when..." summary:**

- Public testers, today -> path 1 (marketplace + GitHub).
- Public testers, after the npm publish -> path 2 (marketplace + npm).
- Private / air-gap / power users -> path 3 (ZIP / URL).
- Institutional / classroom / managed fleets (NATO, Hopkins, etc.) -> path 4 (CI / Docker pre-bake). Highest reliability tier.

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

- `.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-PACKAGING-RESEARCH.md` Section 10 -- the four-path inventory, Tavily-validated, with the NATO pre-bake recommendation
- The install site (mindrianos-install-site.vercel.app) -- the user-facing surface; should surface all four paths
- `scripts/release.sh` Step 9.5 -- the `npm publish` lockstep gate (D-05a) that unblocks path 2
- `docs/install/BRAIN-SETUP.md` -- after install, how users connect the Brain MCP
- `.planning/milestones/v1.13.0-PRODUCTION-READINESS-AUDIT.md` -- recommends path 4 (SEED_DIR pre-bake) as the NATO faculty deployment vehicle
