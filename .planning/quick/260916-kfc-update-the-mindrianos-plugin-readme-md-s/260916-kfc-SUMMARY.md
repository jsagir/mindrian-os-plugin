---
phase: quick-260916-kfc
plan: 01
subsystem: docs
tags: [readme, theo, brain, docs, onboarding]

requires: []
provides:
  - README.md names Theo as the Brain's current implementation, with the 2026-09-03 cutover, host, boundary rule, and local-embedding fact stated and linked
  - README.md corpus figures (27,951 nodes / 452 frameworks) carry a traceable source link to the dated census
  - README.md answers what/why/how for a newcomer in plain English, with MCP/Data Room/readiness score explained on first use
affects: [readme, npm-package-frontpage, github-frontpage]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - README.md

key-decisions:
  - "Named Theo in the README as the Brain's current implementation (not a rename), superseding quick task 260916-ef1's narrower 'never names Theo' scope fence"
  - "Attributed the 27,951/452 corpus figures to docs/BRAIN-GRAPH-CENSUS.generated.md (2026-09-11) rather than re-deriving or citing the retired docs/CORPUS-STATS.generated.md"
  - "Kept README's '20 years of teaching' over docs/THE-BRAIN.md's '30+ years' — logged as a follow-up, not resolved here (out of scope fence)"

patterns-established: []

requirements-completed: [QUICK-260916-kfc]

duration: 55min
completed: 2026-09-16
---

# Quick Task 260916-kfc: Update the MindrianOS Plugin README.md Summary

**Named Theo as the Brain's live backend in README.md, audited every other claim and link against the repo, and rewrote the opening/install framing so a newcomer can follow what MindrianOS is, why it exists, and how to start — three tasks, three commits, only README.md touched.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-16T11:02:00Z (approx, from context load)
- **Completed:** 2026-09-16T11:57:47Z
- **Tasks:** 3/3 completed
- **Files modified:** 1 (README.md)

## Accomplishments

- README.md now names Theo at the loop step, in the three-layer table's Brain row, in a new `## What Theo is` section (158 words, within the 120-180 target), and in the privacy section — each claim sourced from CLAUDE.md, docs/THE-BRAIN.md, docs/install/BRAIN-SETUP.md, and docs/THEO-INSTALL-ID.md.
- Full claim-and-link audit of the existing README (badge, corpus figures, install commands, six `/mos:*` commands, pricing, privacy paths, all relative links, all external URLs) found everything already correct except two gaps, both fixed: the corpus figures had no traceable source (added a census link) and the Theo docs had no home in the Links section (added one).
- Newcomer pass: added one plain-English mechanism sentence to the hero, led Install with the single working command, reframed the two field gotchas as things worth knowing rather than warnings, named `/mos:ignite` as the literal first move after install, and explained MCP, Data Room, and the readiness score on their first appearance in the document.
- Zero em-dashes, zero doctrine-fence-banned phrases, zero banned internal vocabulary (ICM, Tri-Polar, Canon Part, MWP, Phase N, reach_id, DIKW), zero banned hype words, in the final document.

## Task Commits

Each task was committed atomically:

1. **Task 1: Name Theo in the three places the Brain already appears, and add one compact Theo section** - `2f1c8fc9e` (feat)
2. **Task 2: Audit every remaining claim and every link, fix only what fails** - `16234284f` (docs)
3. **Task 3: The newcomer pass. What it is, why it exists, how to start, in plain English and an optimistic voice** - `c086706e4` (docs)

**Plan metadata:** committed separately by the orchestrator after this summary lands.

_No TDD tasks in this plan; each task is a single documentation-edit commit._

## Files Created/Modified

- `README.md` - Named Theo as the Brain's current implementation with cutover date, host, boundary rule, and local-embedding fact; attributed corpus figures to the dated census; added a plain-English mechanism sentence, reframed Install section, named `/mos:ignite` as the first move, and explained MCP/Data Room/readiness on first use.

## Claim-Check Log (Task 2, full audit)

| # | Claim | Source checked | Outcome |
|---|-------|-----------------|---------|
| 1 | Version badge `2.0.0-beta.41` | `git tag --list 'v2.0.0*'` (latest: v2.0.0-beta.41), CHANGELOG.md top RELEASED entry, `node lib/core/repo-version.cjs` (reports unreleased 2.0.0-beta.42) | PASS — badge correctly tracks shipped release, not working tree. No change. |
| 2 | Corpus figures 27,951 nodes / 452 frameworks (3 sites each) | `docs/BRAIN-GRAPH-CENSUS.generated.md` Census Meta + C1 (27951 nodes, 452 Framework nodes, dated 2026-09-11) | PASS on the numbers, FAIL on traceability — no source link existed. Fixed: added attribution line under the three-layer table linking the census. |
| 3 | Install commands (`npx @mindrian_os/cli`, `claude plugin marketplace add jsagir/mindrian-marketplace`, `claude plugin install mos@mindrian-marketplace`) | `package.json` name `@mindrian_os/cli`; `.claude-plugin/plugin.json` name `mos`; `~/mindrian-marketplace/.claude-plugin/marketplace.json` entry name `mos` | PASS — all correct. No change. |
| 4 | `mindrian-os update` / `mindrian-os doctor --all` | `bin/cli.js` (update + doctor subcommands confirmed); `scripts/doctor.cjs` line 316 (`--all` flag parsed) | PASS — `--all` is a real flag. No change. |
| 5 | "over a hundred commands across the skills, agents, and pipelines this plugin ships" | Disk enumeration: 113 files in `commands/*.md`, 126 `skills/**/SKILL.md`, 15 `agents/*.md`, 4 `pipelines/*/` | PASS — kept enumerated-from-disk phrasing per Canon Part 7/11, no literal count frozen in. No change. |
| 6 | Six `/mos:*` commands in the "Commands are internals" block | `commands/ignite.md`, `commands/discover.md`, `commands/beautiful-question.md`, `commands/file-meeting.md`, `commands/graph.md`, `commands/grade.md` — all confirmed present on disk | PASS — all six resolve. No change. |
| 7 | Pricing section (paid gate is the Claude plan + install/update, not per-query; Brain registers silently at no separate cost) | `.claude/includes/decisions.md` decision 1, `.claude/includes/moat.md` commercial-boundary paragraph | PASS — consistent. No change. |
| 8 | Privacy paths `~/MindrianRooms/` and `./.mindrian/` | Confirmed both exist on disk (`ls -la ~/MindrianRooms/`, `ls -la ./.mindrian`) | PASS. No change. |
| L1 | Relative markdown targets (CHANGELOG.md, LICENSE, docs/settings-template.json, docs/THE-BRAIN.md, docs/MINDRIAN-CANON.md, docs/install/BRAIN-SETUP.md, docs/THEO-INSTALL-ID.md, docs/BRAIN-GRAPH-CENSUS.generated.md) | `test -f` on each path | PASS — all exist. |
| L2 | External URLs (mindrian-os.com, /logo_dark.svg, /docs/install, /brain-access, github.com/jsagir/mindrian-marketplace) | `curl -s -o /dev/null -w '%{http_code}'` on each | PASS — all returned 200. |
| L3 | Anchor `#three-surfaces` | `## Three surfaces` heading confirmed present, unchanged position | PASS. |
| L4 | Links section coverage (website, marketplace, changelog, Brain access) | Visual inspection | PASS on original four, FAIL on Theo-doc coverage — added a fifth line pointing to THE-BRAIN.md / BRAIN-SETUP.md / THEO-INSTALL-ID.md. |

Net result: everything the README already asserted was true. The only two diffs Task 2 produced were adding a source link for numbers that were already correct, and adding a links-section entry for docs that Task 1 had just introduced.

## Follow-ups found, not fixed here

1. `docs/brain-setup.md` (lowercase) is stale: still reports Neo4j + Pinecone counts and calls the Brain "a paid-tier feature. Contact Jonathan for an API key," which contradicts today's free, silently-registered model. README correctly links `docs/install/BRAIN-SETUP.md` instead; the lowercase file itself needs a separate fix or retirement.
2. `CLAUDE.md` line 25 still reads `claude plugin install mindrian-os@mindrian-marketplace`, but the plugin id is `mos`. Out of this plan's `files_modified` fence (README.md only) — needs a separate CLAUDE.md edit.
3. README says "20 years of teaching" (three sites) while `docs/THE-BRAIN.md` says "30+ years." Kept the README's "20 years" because it is consistent across all three README occurrences and is the public figure; the drift between README and THE-BRAIN.md is unresolved and needs a decision on which figure is authoritative.

## Scope note: superseded prior fence

Quick task 260916-ef1 (earlier the same day) carried the must-have "The README says 'the Brain' and never names Theo," which was a scope fence holding that task's numerals-only correction to numerals only — it was not a permanent prohibition on naming Theo. This task's plan (260916-kfc) explicitly instructed naming Theo and superseded that fence. Theo is already public via CHANGELOG.md (named 46 times), skills/, and commands/, so naming it in README.md discloses nothing new (per the plan's threat model, T-kfc-01).

## Deviations from Plan

None — plan executed exactly as written, task order, scope fence (`README.md` only), and all `<done>` criteria honored. All three verify gates passed on first attempt with no auto-fix needed under Rules 1-3.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced; this plan only edited prose and links in a static markdown file.

## Threat Flags

None. Per the plan's threat model (T-kfc-01), the only new information disclosed (Theo's name and host) already ships publicly in CHANGELOG.md, skills/, and commands/. No new network endpoints, auth paths, or schema changes were introduced.

## Self-Check: PASSED

- FOUND: README.md (modified, exists)
- FOUND: commit 2f1c8fc9e (Task 1)
- FOUND: commit 16234284f (Task 2)
- FOUND: commit c086706e4 (Task 3)
- Verified: `git diff --name-only HEAD~3 HEAD` returns exactly `README.md`
- Verified: `node --test tests/test-250-doctrine-fence.cjs` exits 0 after each task
- Verified: `grep -c '—' README.md` returns 0
- Verified: all 5 external URLs return HTTP 200
- Verified: `commands/ignite.md` exists and `/mos:ignite` is named as the first move
