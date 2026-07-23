---
phase: 260723-ooq
plan: 01
subsystem: email-canon + hero-image-pipeline + tester-outreach
tags: [newsletter, email-redesign, de-stijl, hero-image, memgraph, v1.15.3-beta.44, cross-repo]
dependency-graph:
  requires: []
  provides:
    - "references/design/newsletter-email-template.html (redesigned DARK-canon template)"
    - "references/design/email-template-standard.md (reconciled palette, canonical pointer)"
    - "website/public/images/email/dark-canon-confinement-hero.jpg (new hero asset, live)"
    - "MindrianOS-Plugin outbox entry for v1.15.3-beta.44 (drafted-not-sent)"
  affects: []
tech-stack:
  added: []
  patterns:
    - "Cross-repo image pipeline: generate (nano-banana-mcp-server, direct @google/genai call) -> compress (mindrian-website/website's sharp) -> commit + vercel --prod deploy -> curl-verify public URL, exact same pattern as this session's earlier blog hero image"
    - "Full-bleed table-cell-as-solid-color-block technique extended from thin Mondrian bars to content-scale panels (STEP 0 alert, one what's-new card, triple-feature rail)"
key-files:
  created:
    - website/public/images/email/dark-canon-confinement-hero.jpg
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md
    - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
  modified:
    - references/design/newsletter-email-template.html
    - references/design/email-template-standard.md
decisions:
  - "Palette reconciliation direction: updated email-template-standard.md to match the shipped newsletter-email-template.html (per RESEARCH.md's verified verdict), never the reverse. Removed the old muted ds-* palette, the unrelated Green/Link-Blue/Code-Green/Amethyst rows, and the Code-inline/Code-block hex values (#60a5fa, #22c55e) tied to the old #12121a background (plan-checker's recommended fold-in #2)."
  - "Panel differentiation: STEP 0 (full-bleed red), what's-new card 1 (yellow top-cap band), card 2 (full-bleed blue), card 3 (red top-cap band), triple-feature (full-bleed black bordered by red/yellow/blue strips), challenge header (small gold tab). All 5 previously-monotone sections now read as visually distinct shapes."
  - "Headline redesigned for the real bold-Arial fallback: font-size 38px, font-weight:900, letter-spacing:-0.01em, plus a color-block treatment (thin blue cap band above + warm-black field behind), since Impact is almost never installed on real recipient machines."
  - "Recipient count re-queried fresh at this execution's own timestamp (2026-07-23T15:31:50.167Z) rather than reused from the prior session. Logged queried_at, raw pre-filter row count (73), post-filter (49), post-dedup (43), and final (42) into the outbox log's frontmatter so a later auditor can confirm the query genuinely ran live (plan-checker's recommended fold-in #1)."
  - "No Gmail draft created or sent - static review files only, per this quick task's explicit NO-SEND-SCOPE constraint."
metrics:
  duration: "~1.5 hours"
  completed: 2026-07-23
---

# Phase 260723-ooq Plan 01: Full Visual Overhaul of the DARK-Canon Tester Email Summary

Redesigned the DARK-canon tester-challenge email template with full-bleed De Stijl Mondrian
panels replacing the monotone 6px-left-border-card repetition, a bold-Arial-aware headline,
and a new hero-image section carrying a freshly generated magnetic-vs-inertial confinement
image; reconciled the two conflicting palette docs into one canonical source; and instantiated
the redesign with real v1.15.3-beta.44/Memgraph/reliability-hardening content and a freshly
re-queried recipient count (42), as static review files only (no Gmail draft).

## What shipped

**Task 1 - COMPLETE.** Generated a new hero image (magnetic-confinement tokamak vs
inertial-confinement laser-target chamber, De Stijl framed, equal visual weight, no garbled
text) via a direct `@google/genai` call from `nano-banana-mcp-server` (same
`gemini-3.1-flash-image-preview` model/config the MCP server itself uses), compressed to
1800px/quality-82 JPEG via `sharp` from `mindrian-website/website`, committed to a new
`website/public/images/email/` path (kept separate from `images/blog/` per RESEARCH.md's
recommendation), and deployed to production via `vercel --prod --yes`. Live and verified:
`https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg` returns 200,
`content-type: image/jpeg`.

**Task 2 - COMPLETE.** Redesigned `references/design/newsletter-email-template.html`:
- STEP 0 update callout is now a genuine full-bleed `#D40000` red panel (cream text directly
  on the red field), not a rail-on-dark-card.
- What's-new card 1: `#1A1A1A` surface with a full-width `#FFD500` 4px top-cap band.
- What's-new card 2: genuine full-bleed `#0033A0` blue panel.
- What's-new card 3: `#1A1A1A` surface with a full-width `#D40000` 4px top-cap band.
- Challenge section header now carries a small full-bleed `#C8A43C` gold tab, echoing the
  logo row's colored squares.
- Triple-feature related-links rail is now a full-bleed `#111111` warm-black panel, bordered
  top and bottom by thin 3px red/yellow/blue strips, bookending the content body the way the
  top/bottom Mondrian bars bookend the whole email.
- New hero-image section (new section 5, between the lede and READ THE STORY): `{{HERO_IMAGE_URL}}`
  / `{{HERO_IMAGE_ALT}}` / `{{HERO_IMAGE_CAPTION}}` placeholders, hard-rectangle `#F5F0E8`
  border, no border-radius.
- Headline: `font-size:38px`, `font-weight:900`, `letter-spacing:-0.01em`, wrapped in a
  color-block treatment (`#111111` field behind it, thin `#0033A0` cap band above), designed
  for the real bold-Arial fallback rather than assuming Impact renders.
- Header comment updated to 13 sections; bottom send-check expanded from 10 to 11 items
  (new item 11: hero image has a real public HTTPS src, alt text, caption).

Reconciled `references/design/email-template-standard.md` to match the shipped template
exactly (Background #0D0D0D, Surface #1A1A1A, Cream #F5F0E8, Muted #999999, Red #D40000,
Blue #0033A0, Yellow #FFD500, Gold/OS #C8A43C, Black #111111; 640px; Impact/Arial
Black/Helvetica/Arial/Courier). Removed the old muted ds-* palette (#0a0a0f, #12121a,
#a63d2f, #1e3a6e, #c4a43c), the unrelated Green/Link-Blue/Code-Green/Amethyst rows, and the
old Code-inline/Code-block hex values (#60a5fa, #22c55e) that were tied to the old #12121a
background. Added a top-of-file note declaring the template canonical.

Verified via a Playwright screenshot (`playwright screenshot` through Bash, per the
`feedback_playwright_cli` hard rule) of a scratchpad preview with Task 1's real hero-image
URL filled in - confirmed all 5 differentiated panels render correctly, the hero image
renders inside its border with caption, and the headline reads with graphic punch as
rendered bold Arial. The scratchpad preview file was discarded after screenshotting; the
canonical template file itself still carries unfilled `{{PLACEHOLDER}}` tokens.

**Task 3 - COMPLETE.** Confirmed `v1.15.3-beta.44` as the real TOP RELEASED CHANGELOG entry
(not the `Unreleased -- v1.15.3-beta.45` entry above it, despite package.json/plugin.json
already showing beta.45 mid-flight). Re-queried the real active `brain_api_keys` recipient
count fresh at this execution's own timestamp: **42** (raw 73 rows, 49 after
`is_active=true AND last_request_at IS NOT NULL`, 43 after dedup by lowercased email, 42
after excluding sender `jsagir@gmail.com`). Logged the query timestamp
(`2026-07-23T15:31:50.167Z`) and every intermediate row count into the outbox `.md`
frontmatter, per the plan-checker's recommended fold-in, so a later auditor can confirm the
query genuinely ran live rather than reusing a cached number.

Instantiated the redesigned template with real, CHANGELOG-grounded content: headline card
(yellow top-cap) is the beta.38 Memgraph endpoint flip, card 2 (full-bleed blue) is the
beta.40/beta.42 Windows reliability trilogy combined into one card, card 3 (red top-cap) is
the beta.44 Stop-hook permanent-guardrail fix. Challenge is a magnetic-vs-inertial confinement
classify-first seed matching the hero image and the live "The Beam Nobody Has Won" post's
fusion-confinement section. All 3 triple-feature links plus the READ THE STORY link confirmed
live (200) before finalizing. `mindrian-os.com` appears 9 times across the instantiated HTML
(well over the 3+ requirement). Saved as a standalone renderable `.html` (matching the
`beta-36-40-update-email.html` precedent) plus an outbox `.md` log with
`status: drafted-not-sent`.

**No Gmail draft was created or sent at any point in this execution.** The `create_draft` /
`update_draft` / `list_drafts` Gmail MCP tools were never invoked.

## Commits

| Repo | Hash | Message |
|------|------|---------|
| mindrian-website | `1661d74` | feat(260723-ooq): add magnetic-vs-inertial confinement hero image for DARK-canon email |
| MindrianOS-Plugin | `3acbffd5` | feat(260723-ooq): redesign DARK-canon email template with full-bleed Mondrian panels |
| MindrianOS-Plugin | `044a4a88` | docs(testers): prepare v1.15.3-beta.44 everything-got-better outbox (drafted-not-sent) |

## Live URLs

- Hero image: `https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg` (200, `image/jpeg`)
- Story link: `https://mindrian-os.com/blog/the-beam-nobody-has-won` (200)
- Triple-feature links: `dominant-design-the-brick-that-won` (200), `maybe-a-tank-needs-to-be-an-ambulance` (200)

## Deviations from Plan

### Auto-fixed Issues

None requiring Rule 1-3 fixes beyond the two plan-checker-recommended fold-ins (both were
executed as explicit plan instructions, not autonomous deviations):

1. Logged `recipient_query_ran_at`, `recipient_query_raw_row_count`,
   `recipient_query_after_filter_count`, and `recipient_query_after_dedup_count` fields into
   the outbox `.md` frontmatter (not just the final deduped count).
2. Removed the old Code-inline/Code-block hex values (`#60a5fa`, `#22c55e`) tied to the old
   muted `#12121a` background from `email-template-standard.md`, alongside the rest of the
   muted-palette cleanup.

### Note on the plan's own automated verify commands (not a defect)

Two of Task 2's automated `<verify>` checks (`NO_STYLE_BLOCK_OK`, `NO_RADIUS_OK`) as literally
written (`grep -qi '<style'` / `grep -qi 'border-radius'` against the whole file) do not print
their `_OK` echo, because the template's own header/footer HTML comments self-document the
hard rules using the literal strings "NO `<style>` block" and "NO border-radius" - this was
already true of the original, pre-redesign file (verified by diffing against the original).
Confirmed via a comment-stripped grep that there is no actual `<style>` tag or CSS
`border-radius` property anywhere in the real markup. Not a regression; the check itself has a
pre-existing false-positive against this file's own documentation comments.

### Hero image content note

The generated hero image's bottom captions repeat the top labels ("MAGNETIC CONFINEMENT" at
top, then "MAGNETIC / MAGNETIC CONFINEMENT" again at the bottom of the left panel, same
pattern on the right). This is legible and not garbled (satisfies the plan's "no garbled or
illegible text" bar), just visually redundant. Judged acceptable rather than spending a
regeneration attempt, since both required properties (legible text, equal visual weight for
both architectures) are met.

## Known Stubs

None. All three deliverables (hero image, redesigned template, content instance) are fully
wired with real data - no placeholder values, no empty renders, no "coming soon" text.

## Threat Flags

None. All threat-register items (T-ooq-01 through T-ooq-06) were mitigated exactly as
planned: API keys stayed in their own `.env` files and were never printed/logged/committed;
only the aggregate recipient count (never individual emails) was written to the tracked
outbox log; all commits landed in the correct repos/workspace (never the plugin install
cache); no Gmail send mechanism was invoked.

## Self-Check: PASSED

- All 5 created/modified files confirmed present on disk (hero image, both palette/template
  docs, both outbox files).
- All 3 commit hashes (`1661d74`, `3acbffd5`, `044a4a88`) confirmed present in their
  respective repos' git history.
- Live hero-image URL re-verified 200 after all edits.
- All 3 triple-feature blog links + the READ THE STORY link re-verified 200.
- Grep sweep for em-dashes (`\xe2\x80\x94`) across every touched file in both repos: zero
  matches.
- Grep sweep confirms zero remaining `{{PLACEHOLDER}}` tokens in the instantiated `.html`
  (the one `{{PLACEHOLDER}}` grep hit remaining is literal documentation text in the
  canonical template's own header comment, not an unfilled slot).
- No Gmail MCP tool was invoked at any point in this execution (manually confirmed - no
  `create_draft`/`update_draft`/`list_drafts` calls were made).
