---
quick_id: 261001-l8x
status: complete
date: 2026-10-01
files_modified: [README.md]
---

# Quick 261001-l8x: README refresh to current state -- SUMMARY

## Changed (each with its source)
- Version badge 2.0.0-beta.41 -> 2.0.0-beta.51. Source: tag `v2.0.0-beta.51` is the newest tag; `npm view @mindrian_os/cli` shows `latest` = `next` = 2.0.0-beta.51; CHANGELOG lists beta.52 as `[Unreleased] (in progress)`. package.json's beta.52 is the dev next-bump, not a release.
- Brain tool count clarified to "the six tools Larry calls on it". Source: `bin/mindrian-brain-mcp-client.cjs` registers exactly 6 tools (brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write). Theo itself serves a wider catalog; Larry reaches it through these six.
- Commands line now exact: 113 commands, 126 skills, 17 agents. Source: `ls commands/*.md` (113), `find skills -name SKILL.md` (126), `ls agents` (17), read 2026-10-01.
- New paragraph on the background cross-connection run and the strong / indirect / unverified finding stamp. Source: CHANGELOG 2.0.0-beta.51 (Phases 355 and 355.1), `commands/auto-explore.md` description.

## Verified, unchanged
- Theo graph figures (27,951 nodes, 452 frameworks, census dated 2026-09-11): `docs/BRAIN-GRAPH-CENSUS.generated.md` is the newest committed census. `scripts/build-brain-census.cjs` can regenerate it but writes files outside this task's scope (README only), so the dated figures stay.
- Install commands: package name `@mindrian_os/cli` with bin `{mindrian-os, cli}` (package.json); `bin/cli.js` implements `doctor` and `update`; marketplace path `claude plugin install mos@mindrian-marketplace` matches plugin name `mos`.
- Theo origin `https://theo-mcp.onrender.com`: `lib/core/brain-client.cjs` default BRAIN_URL.
- All linked docs exist.

## Not done, by design
- STATE.md not updated: a peer session is executing Phase 365 in this tree.
- No push: peer has unpushed commits on main.
