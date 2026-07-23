---
phase: 260723-rln
plan: 01
subsystem: design-system
tags: [email-template, de-stijl, m-os-canonical-design-system, wcag-aa, cream-palette]

requires:
  - phase: 260723-ooq
    provides: "full-bleed Mondrian panel structural redesign, hero-image section, bold-Arial-aware headline sizing of the DARK-canon email template - this plan only re-skins its colors"
provides:
  - "references/design/newsletter-email-template.html re-skinned from the DARK canon to cream M:OS Canonical Design System v1.1"
  - "references/design/email-template-standard.md reconciled with the re-skinned template (targeted hex-value edit)"
  - "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html + .md re-skinned to match, zero content changes"
  - "WCAG AA fix: gold #C8A43C text on cream (2.13:1, fails AA) switched to blue #1E52E0 (5.62:1, passes AA) everywhere except the two locked terminal-island blocks"
affects: [future-newsletter-emails, tester-outbox-drafts]

tech-stack:
  added: []
  patterns:
    - "Terminal-island exception (D-01): dark #0C0C0D / #E8E8E2 token pair reserved for code/command blocks even on an otherwise-cream surface, matching pre.code's own theme-independent token in mos-design-system.css"
    - "Full-bleed dark panels (STEP 0 red, what's-new card 2, headline field, triple-feature panel) keep their dark polarity on the cream page as intentional De Stijl accents - only terminal islands and page/card grounds flip to light"

key-files:
  created: []
  modified:
    - references/design/newsletter-email-template.html
    - references/design/email-template-standard.md
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md

key-decisions:
  - "Gold #C8A43C's role is split, not mechanically replaced: kept as a background fill (READ THE STORY button, CHALLENGE tab, 8.76:1 AA-pass) and as terminal-island text (command names, seed-box border accent); every other text usage becomes blue #1E52E0."
  - "Hero image border flips cream -> ink (#0C0C0D) against the cream page (D-02); the image asset/src itself is untouched."
  - "email-template-standard.md received a targeted hex-value edit (palette table, typography table, 9 component-pattern snippets), not a structural rewrite, per RESEARCH.md's own recommendation."

requirements-completed:
  - D-01-TERMINAL-ISLAND-STAYS-DARK
  - D-02-HERO-BORDER-INK-NOT-REGENERATE
  - WCAG-AA-GOLD-TEXT-TO-BLUE
  - PALETTE-SOURCE-CSS-VERBATIM
  - STRUCTURAL-PRESERVATION-OOQ
  - MD-TARGETED-EDIT-NOT-REWRITE
  - NO-GMAIL-DRAFT-TOUCH
  - NO-EMDASHES

duration: 3min
completed: 2026-07-23
---

# Phase 260723-rln Plan 01: Retire the DARK-canon tester-challenge email design Summary

**Re-skinned the canonical newsletter template and its already-drafted v1.15.3-beta.44 content instance from the DARK tester-email canon to the cream M:OS Canonical Design System v1.1, fixing a real WCAG AA text-contrast failure (gold-on-cream, 2.13:1) while keeping the two terminal-island code blocks intentionally dark.**

## IMPORTANT FOR ORCHESTRATOR: standing rule superseded

`~/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md`
Part B currently states the tester-challenge email canon is "the DARK tester-email
canon... NOT the website's light paper look." **That rule is now superseded** by
this quick task: the canonical template (`references/design/newsletter-email-template.html`)
and its derived doc (`references/design/email-template-standard.md`) are re-skinned
to the cream M:OS Canonical Design System v1.1, matching every other HTML surface in
this repo. Terminal-island code/command blocks are the one intentional dark exception
(D-01), not the whole email.

This memory file lives outside the MindrianOS-Plugin repo and cannot be edited from
within this plan (constraint honored - it was not touched). The orchestrator should
update `feedback_newsletter_story_challenge_playbook.md` Part B to reflect this
supersession, or file a new memory entry marking Part B superseded-by-260723-rln.

## Performance

- **Duration:** ~3 min (commit-to-commit)
- **Started:** 2026-07-23T17:22:07Z
- **Completed:** 2026-07-23T20:21:18+03:00 (final task commit)
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments
- Canonical `newsletter-email-template.html` and its derived `.md` fully re-skinned to the cream palette, header comments rewritten to describe the new canon (D-01/D-02 called out explicitly), 11-item send check updated.
- Already-drafted `2026-07-23-v1.15.3-beta.44-everything-got-better.html` content instance re-skinned identically, with zero changes to headline copy, lede, version string, hero image URL, blog link hrefs, command names/glosses, or recipient-facing text.
- The one real accessibility bug found by RESEARCH.md (gold text at 2.13:1 contrast on cream, failing WCAG AA) is fixed everywhere gold was used as text outside the two locked terminal-island blocks - now blue #1E52E0 at 5.62:1.
- Verified in a real Playwright-rendered screenshot (`/tmp/cream-email-render.png`): cream ground throughout, ink text, blue links, gold restricted to background fills, terminal islands (challenge-seed box, command-chain box) correctly still dark with gold command names and #E8E8E2 gloss text, hero border flipped to ink.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-skin the canonical template and its derived doc** - `8ac68704` (feat)
2. **Task 2: Re-skin the already-drafted content instance** - `5a26e9ef` (feat)

_No plan-metadata docs commit made per this quick task's constraint: SUMMARY.md/STATE.md/PLAN.md are committed separately by the orchestrator, not by this execution._

## Files Created/Modified
- `references/design/newsletter-email-template.html` - Canonical template, full cream re-skin (all 14 sections), header/footer comments rewritten for the new canon
- `references/design/email-template-standard.md` - Palette table, typography table, and all 9 component-pattern snippets reconciled to the re-skinned template
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` - Identical cream re-skin applied to the drafted content instance, content byte-for-byte unchanged
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md` - `style_deviations` and opening prose updated to document the re-skin; cross-reference to `.planning/quick/260723-rln-.../` added; `gmail_draft_id`/`recipient_query_*`/`version`/`status` frontmatter facts untouched (verified: `recipient_query_final_count: 42` and `gmail_draft_id: "r-1370266653870026168"` both intact)

## Decisions Made
- Followed the plan's Color Mapping Reference literally, section by section, not by blind global hex find/replace (multiple old hexes map to different new hexes depending on role - most notably `#1A1A1A` splits into `#FBFAF7` for cards 1/3 vs `#0C0C0D` for the two terminal-island blocks).
- All hex values pulled verbatim from `skills/ui-system/design-system/mos-design-system.css` (confirmed via grep before editing: `--paper:#F4F2EC`, `--panel:#FBFAF7`, `--ink:#0C0C0D`, `--muted:#5B5B5B`, `--red:#E11D22`, `--blue:#1E52E0`, `--yellow:#FFC400`, terminal token `background:#0c0c0d;color:#e8e8e2` from `pre.code`).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verification checks passed on first attempt except one pre-existing checker artifact (see below), which is not a deviation from the plan's intent.

**Note on one verify sub-condition:** the plan's Task 1 `STRUCTURAL_PRESERVED_OK` check includes `! grep -qi 'border-radius' newsletter-email-template.html`. This sub-condition was already going to fail before any edit, because the file's own "HARD RULES" and "11-ITEM SEND CHECK" comment blocks legitimately contain the text "NO border-radius" (a rule to keep, not a CSS property to avoid). Confirmed via `git show HEAD~2:...` that this same text existed in the pre-edit original with an identical match count. No actual `border-radius:` CSS property exists in the file (`grep -c 'border-radius:'` = 0). This is a pre-existing checker artifact inherent to retaining the hard-rule comment text, not a defect introduced by this plan.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Evidence

- All automated `<verify>` checks for both tasks passed (NO_OLD_HEX_OK, GOLD_TEXT_TO_BLUE_OK, TERMINAL_ISLAND_OK, HERO_BORDER_INK_OK, GOLD_BG_KEPT_OK, MD_RECONCILED_OK, CONTENT_UNCHANGED_OK, MD_NOTE_UPDATED_FACTS_INTACT).
- `git diff` on the outbox `.html` normalized to hex-only substitutions on structurally identical lines - confirmed color-only change, no content/markup drift.
- Live Playwright CLI (`playwright screenshot --full-page`, via Bash per repo hard rule - never the MCP plugin) rendered the final `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` in real headless Chromium. Screenshot saved to `/tmp/cream-email-render.png` - visually confirms cream ground, ink text, blue links, gold-as-background-only, and both terminal islands (challenge-seed Courier box, command-chain table) rendering correctly dark.
- No Gmail MCP tool (`create_draft`/`update_draft`/`list_drafts`) was called at any point.
- The external memory file `feedback_newsletter_story_challenge_playbook.md` was not edited (see supersession note above).

## Next Phase Readiness
Both the canonical template and the drafted outbox instance are cream-consistent and ready for founder review. The Gmail draft (`r-1370266653870026168`) still reflects the OLD dark-canon content and was deliberately not touched by this plan - syncing it to the re-skinned `.html` (or re-creating the draft) is a separate, explicit follow-up for the orchestrator/founder to decide on.

---
*Phase: 260723-rln*
*Completed: 2026-07-23*

## Self-Check: PASSED

All claimed files verified present on disk (references/design/newsletter-email-template.html,
references/design/email-template-standard.md, docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html,
docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md, /tmp/cream-email-render.png,
this SUMMARY.md). Both task commits (`8ac68704`, `5a26e9ef`) verified present in `git log`.
