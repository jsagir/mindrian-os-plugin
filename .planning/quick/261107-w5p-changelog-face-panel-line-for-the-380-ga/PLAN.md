---
quick: 261107-w5p
type: docs
---

# Quick 261107-w5p: CHANGELOG carries the face panel line the 380 release gate reads

## Why

tests/test-380-gate-wiring.cjs W4 takes the first line that matches /face panel/i in the top
"## [Unreleased]" block of CHANGELOG.md (or, if none, in the section right below it) and checks it.
Neither holds such a line, so W4 fails 5 assertions and the release suite gate fails the cut.

## Task 1 (docs only)

Add ONE bullet at the end of the "### Added" list in the top [Unreleased] block of CHANGELOG.md:

- **The /m:os face panel stays in the plugin, for the Claude Code terminal.** It sends the framework name, the problem type and an optional short excerpt of your own words to Theo, and `/mos-words` turns the excerpt off. Desktop and Cowork do not draw it in this beta (Phase 380).

Limits: change no other line, heading or version. Leave the stray empty "- " bullet. No push, tag or release. No em-dashes or en-dashes. The words Larry, Brain, MCP, ICM do not appear in the bullet.

Verify: git diff CHANGELOG.md shows only the added line; node tests/test-380-gate-wiring.cjs W4 passes; node lib/core/repo-version.cjs prints 2.0.0-beta.80.
