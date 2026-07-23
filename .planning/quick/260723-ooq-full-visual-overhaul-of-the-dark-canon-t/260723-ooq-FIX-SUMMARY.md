---
phase: 260723-ooq
fixed: 2026-07-23
findings_fixed: [WR-02, WR-03]
findings_not_touched: [WR-01, IN-01]
commit: f43e5e25
---

# Quick Task 260723-ooq: Code Review Fix Summary

Fixed the 2 warning-level findings from `260723-ooq-REVIEW.md` that were flagged as real,
blocking-adjacent issues. WR-01 (doc structure-list omission) and IN-01 (grammar nit) were
left untouched per explicit scope constraint - both accepted as minor.

## WR-03: Hero `<img>` missing `height` attribute (fixed)

**Root cause:** The hero-image section was new in this quick task's template redesign. The
`<img>` tag correctly carried `width="576"` and `alt="..."` but nobody set `height`, so Outlook's
Word-based rendering engine (which sizes off the HTML `width`/`height` attributes, not the CSS
`width:100%;max-width:576px`) had nothing to size the image against - risking either native-pixel
rendering (breaking the 640px layout) or a distorted aspect ratio.

**Fix:** Confirmed the real generated hero image's actual pixel dimensions at
`website/public/images/email/dark-canon-confinement-hero.jpg` (sibling `mindrian-website` repo):
**1800x1005px** (aspect ratio 1.791, not exactly 16:9's 1.778 - the generation brief said 16:9 but
the actual compressed/deployed JPEG is very slightly off that). Computed the correct proportional
height for the email's fixed `width="576"`: `576 x 1005/1800 = 321.6`, rounded to **`height="322"`**.

Applied to all three occurrences the review identified:
1. `references/design/newsletter-email-template.html:100` (the `{{HERO_IMAGE_URL}}` placeholder slot)
2. `references/design/email-template-standard.md:124` (the derived component-pattern doc's Hero Image example)
3. `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html:62` (the instantiated content copy)

Also added a line to the template's own 11-item send checklist (item 11) requiring "height
attribute present and matching the image's actual aspect ratio" - closing the gap the review noted
(the checklist didn't catch this omission before because it only asked for src/alt/caption).

## WR-02: Triple-feature block repeated the primary READ THE STORY link (fixed)

**Root cause:** The triple-feature section in the instantiated outbox `.html` was introduced with
"Three more pieces on the same shelf" and listed three links, but the first
(`the-beam-nobody-has-won`) was the exact same URL already pushed as the hero READ THE STORY CTA
earlier in the same email. Not "three more" - two more plus a repeat. A reader clicking the first
triple-feature link expecting new content would land back on the article they were already sent to.

**Fix:** Checked `website/src/app/blog/` in the sibling `mindrian-website` repo for other real, live
posts. Replaced the duplicate first link with `reverse-salient-case-study` (confirmed live, HTTP 200),
anchor text "the reverse salient in the wild." This post also ties directly back into this same
email's own command-chain copy (`/mos:find-bottlenecks - the reverse salient - the physical ceiling
either path hits`), making it a genuinely on-theme third piece rather than an arbitrary substitution.
The other two links (`dominant-design-the-brick-that-won`, `maybe-a-tank-needs-to-be-an-ambulance`)
were left unchanged - they were already correct, distinct, live posts.

Checked the `.md` counterpart (`2026-07-23-v1.15.3-beta.44-everything-got-better.md`) for the same
triple-feature link list: it does not duplicate that prose (its only blog-link reference is the
`story_url` frontmatter field, which correctly still points at `the-beam-nobody-has-won` - that's the
legitimate headline-story URL, unrelated to this finding). No `.md` edit was needed.

## Files Changed

- `references/design/newsletter-email-template.html` (hero `<img>` height + checklist item 11)
- `references/design/email-template-standard.md` (hero `<img>` height in component-pattern example)
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` (hero `<img>` height + triple-feature first link)

## Not Touched (accepted as minor, per constraint)

- **WR-01:** `email-template-standard.md` Structure list / Palette table omit the template's
  "divider" section. Left as-is.
- **IN-01:** Garbled sentence in the outbox `.md`'s recipient-query methodology parity paragraph.
  Left as-is.

## Verification

- No em-dashes introduced (`grep -n` for U+2014/U+2013 across all 3 changed files returns nothing).
- No Gmail draft created or touched at any point - all edits were static-file changes only.
- `git diff --cached --stat` confirmed exactly 3 files changed before commit, 5 insertions / 5
  deletions total (2-line `<img>` diffs x3 files, plus the checklist-item addition in the template).

## Commit

`f43e5e25` - `fix(260723-ooq): add hero image height + fix duplicate triple-feature link`
