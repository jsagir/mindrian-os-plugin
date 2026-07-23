---
phase: 260723-twz
plan: 01
subsystem: email-templates
tags: [design-system, email-html, de-stijl, playwright-verification]
dependency-graph:
  requires: []
  provides:
    - CELL-LEVEL-BG-CANON
    - EVERY-CELL-IN-MULTIROW-PANELS
    - DOC-CANONIZATION-TWO-PLACES
    - VISUAL-UNCHANGED-VERIFIED
    - NO-GMAIL-DRAFT-TOUCH
    - NO-EMDASHES
  affects:
    - references/design/newsletter-email-template.html
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
    - references/design/email-template-standard.md
tech-stack:
  added: []
  patterns:
    - "Cell-level background-color (on td, not table) for all full-bleed email panels"
key-files:
  created: []
  modified:
    - references/design/newsletter-email-template.html
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
    - references/design/email-template-standard.md
    - /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md (outside repo, not committed)
decisions:
  - "Cell-level background-color is the canonical pattern for all future panels in this template family (Rule 12 in email-template-standard.md)"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-23"
---

# Phase 260723-twz Plan 01: Canonize Cell-Level Background-Color for Email Panels Summary

Retired the table-level background-color DOM pattern across both live email HTML surfaces, converting all 6 confirmed panel sites per file to cell-level background-color, with the visual result provably byte-identical before and after via Playwright screenshot comparison.

## What Was Done

**Task 1: Convert 6 table-level background-color sites to cell-level (both HTML files)**

Re-confirmed the site inventory via fresh grep before editing: 7 table-level `background-color` matches per file, 1 correctly excluded (the outer page-wrapper table, `#F4F2EC`, matches `body`'s own background as a client-compatibility fallback, not a panel) and 6 real sites requiring conversion, in this order:

1. STEP 0 red callout (`#E11D22`)
2. What's-new card 1 (`#FBFAF7`)
3. What's-new card 2 (`#1E52E0`)
4. What's-new card 3 (`#FBFAF7`)
5. Command-chain terminal box (`#0C0C0D`) - **two rows**, both converted (the command-names row and the docs-link caption row)
6. Triple-feature ink panel (`#0C0C0D`)

For each site, `background-color:#XXX;` was removed from the enclosing `<table style="...">` attribute (leaving the table with no `style` attribute at all, per the plan's instruction not to leave `style=""`), and prepended as the first style property on the direct-child `<td>`(s). The challenge-seed Courier box (already cell-level, its wrapping table already had no `style` attribute) and the outer page-wrapper table were left untouched, exactly as specified.

**Baseline and after screenshots (before/after comparison):**

- `playwright screenshot --browser chromium --viewport-size=800,1400 --full-page` against `file://` URLs for both HTML files, captured before any edits and again after all 6 conversions.
- `cmp -s` byte comparison: **both files reported byte-identical (exit 0)** — `TEMPLATE: IDENTICAL`, `OUTBOX: IDENTICAL`. This is a genuine byte-level proof, not a human eyeball check: the rendered cream M:OS Canonical Design System v1.1 look (full-bleed panels, top-cap cards, terminal-island blocks) is unchanged pixel-for-pixel.

**Counts before/after (both files):**

| Check | Before | After |
|---|---|---|
| `table[style*=background-color]` matches | 7 | 1 (only the excluded outer wrapper) |
| `td[style*=background-color]` matches | 28 | 35 (28 pre-existing + 7 newly added: 6 sites x 1, plus the command-chain box's second row) |

**Task 2: Canonize the rule in two documentation surfaces**

Part 1, `references/design/email-template-standard.md` (committed to this repo):
- Added new numbered Rule 12 to the "## Rules" list: cell-level background-color is mandatory, never table-level, because some email clients (including Gmail's compose editor) strip or mishandle table-level background-color.
- Updated the three affected Component Pattern snippets (Full-Bleed Alert Panel, Top-Cap Band Card, Full-Bleed Color Panel) to show `background-color` on the `td` line instead of the `table` line, matching the re-skinned template exactly. Added a one-line note under the Full-Bleed Color Panel snippet clarifying the triple-feature rail uses the same pattern with `#0C0C0D`.
- Left the Seed/Code Box snippet's HTML untouched (it already used cell-level background-color) and added one clarifying sentence noting this.

Part 2, `/home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md` (plain file edit, **outside this git repo, confirmed via `git ls-files --error-unmatch` to be outside the repository, and deliberately NOT committed**):
- Added a new dated paragraph to Part B, immediately after the existing "cream M:OS canon" paragraph, canonizing the cell-level rule and referencing quick task `260723-twz`.
- Updated the frontmatter `modified:` timestamp to the current UTC time. No other existing content in the file was altered.

## Deviations from Plan

None — plan executed exactly as written. One procedural note: `git add` initially reported `docs/testers` paths as "ignored by .gitignore" during a combined `add && commit` one-liner, but `git status` confirmed both files were already staged correctly (the gitignore warning did not block staging); the subsequent standalone `git commit` succeeded cleanly with both files included. No file content was affected.

## Verification Results

- `table[style*=background-color]` count: **1** in both files (only the excluded outer page-wrapper table remains).
- `td[style*=background-color]` count: **35** in both files (28 baseline + 7 newly relocated).
- Challenge-seed Courier box: confirmed untouched, its `td` still carries `background-color:#0C0C0D;border-left:4px solid #C8A43C` directly, its wrapping `table` still has no `style` attribute.
- Command-chain box: confirmed both rows (`padding:14px 20px 4px 20px` command-names row, `padding:0 20px 14px 20px` docs-link caption row) now carry `background-color:#0C0C0D` — no unstyled gap.
- Playwright before/after full-page screenshots: **byte-identical (`cmp -s` exit 0)** for both `newsletter-email-template.html` and the outbox instance.
- `email-template-standard.md`: Rule 12 present, all three affected snippets show cell-level background-color.
- `feedback_newsletter_story_challenge_playbook.md` (outside repo): contains `260723-twz` and `cell-level`, modified timestamp updated, and confirmed NOT committed to this repo.
- No em-dash found in any of the four edited files.
- No Gmail MCP tool (`create_draft`/`update_draft`/`list_drafts`/etc.) was called at any point in this session; no live Gmail draft was touched.

## Self-Check: PASSED

- FOUND: references/design/newsletter-email-template.html
- FOUND: docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
- FOUND: references/design/email-template-standard.md
- FOUND: /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md
- FOUND commit: 42d81ce4 (fix(260723-twz): canonize cell-level background-color for email panels -- squashed, single atomic commit covering Task 1's HTML conversions and Task 2's email-template-standard.md Rule 12 addition, per the explicit "commit atomically" constraint)

Note: this file itself (260723-twz-SUMMARY.md) lives under `.planning/quick/`, which is gitignored in this repo (`.gitignore` line 66, `.planning/*` with only `!.planning/debug/` carved out -- `.planning/quick/` has no such exception). It is intentionally NOT committed, consistent with the "Do not force-stage gitignored `.planning/` content" rule.
