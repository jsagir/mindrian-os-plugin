---
phase: 260723-ooq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 - CROSS-REPO: mindrian-website (this repo)
  - website/public/images/email/dark-canon-confinement-hero.jpg
  # Task 2 - SIBLING repo (MindrianOS-Plugin), its own commit there
  - /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html
  - /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md
  # Task 3 - SIBLING repo (MindrianOS-Plugin), its own commit there
  - /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md
  - /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
autonomous: true
requirements:
  - NEWSLETTER-PLAYBOOK                    # feedback_newsletter_story_challenge_playbook (HARD RULE) - Part C image recipe, Part B DARK canon
  - D-1-HERO-IMAGE-CONFINEMENT              # CONTEXT.md: new generated asset, magnetic-vs-inertial confinement concept, echoes the-beam-nobody-has-won's fusion section
  - D-2-CONTENT-EMPHASIS-EVERYTHING-BETTER  # CONTEXT.md: broad "everything got better" framing, Memgraph headline + reliability-hardening proof points
  - D-3-RECIPIENT-RESCOPE-FRESH-QUERY       # CONTEXT.md: re-query active brain_api_keys FRESH, do not reuse stale 42-count
  - D-4-PALETTE-RECONCILE-TEMPLATE-CANONICAL # CONTEXT.md discretion, resolved by RESEARCH.md verdict: update email-template-standard.md to match newsletter-email-template.html, not the reverse
  - TESTER-EMAIL-CANON                      # feedback_tester_email_feynman_destijl_logo (HARD RULE)
  - WEBSITE-LINK-3X                         # feedback_mindrianos_email_website_link (HARD RULE)
  - NO-EMDASHES                             # feedback_no_emdashes (HARD RULE)
  - NO-SEND-SCOPE                           # CONTEXT.md + user constraint: do NOT create/send Gmail drafts in this plan
  - PLAYWRIGHT-CLI-ONLY                     # feedback_playwright_cli (HARD RULE) - Playwright via Bash, never the MCP plugin
  - NO-REAL-NAMES-IN-REPO                   # feedback_no_real_names_in_repo - recipient count only, never addresses

must_haves:
  truths:
    - "references/design/newsletter-email-template.html and references/design/email-template-standard.md share one identical DARK-canon palette (Red #D40000, Yellow #FFD500, Blue #0033A0, Gold/OS #C8A43C, Cream #F5F0E8, Surface #1A1A1A, Black #111111, Background #0D0D0D, Muted #999999), with email-template-standard.md explicitly stating the template is canonical and it is the derived reference."
    - "The redesigned template replaces the monotone 6px-left-border-plus-dark-card repetition with differentiated full-bleed Mondrian color panels for the STEP 0 callout, the 3 what's-new cards, and the triple-feature rail -- at least 4 of the 5 previously-identical sections now read as visually distinct shapes."
    - "The headline block is redesigned to carry graphic punch when rendered as bold Arial (the real fallback for nearly every recipient, since Impact is almost never installed), via explicit font-weight, adjusted letter-spacing, and a color-block treatment, not by relying on a display typeface most inboxes will never show."
    - "A new hero-image section exists in the template (between the lede and the READ THE STORY button), with a real, publicly hosted HTTPS image (not a local path, not a data: URI) showing the magnetic-vs-inertial confinement concept, framed with a hard-rectangle border and a one-line caption."
    - "A new content instance exists demonstrating the redesigned template with real, CHANGELOG-grounded copy: v1.15.3-beta.44 named in the STEP 0 callout, the Memgraph migration (beta.38) as the headline what's-new card, and this week's reliability-hardening fixes (beta.40/42/44) as supporting proof points, framed broadly as 'everything got better,' not a changelog dump."
    - "The real, active brain_api_keys recipient count is freshly re-queried at execution time (not the stale 42 from the prior session reused without re-verification) and recorded as a number in the new outbox log."
    - "Every hard rule from the newsletter playbook and the template's own header comment remains intact: DARK #0D0D0D background, inline styles only, no <style> block, no web fonts beyond Impact/Arial Black/Helvetica/Arial/Courier, no border-radius anywhere, no emoji, no em-dashes, sender is always a named person (never 'MindrianOS Team'), mindrian-os.com appears 3+ times, dir=ltr and text-align:left on every content element, 640px fixed width, STEP 0 update callout present and names the real released version."
    - "No Gmail draft was created or sent by this plan -- the content instance exists only as static files for founder review."
  artifacts:
    - path: "/home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html"
      provides: "Redesigned DARK-canon template: full-bleed Mondrian panel system, bold-Arial-aware headline, new hero-image slot, updated 13-section header comment + 11-item send check"
      contains: "HERO_IMAGE_URL"
    - path: "/home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md"
      provides: "Reconciled palette/typography/component-pattern doc, pointing at newsletter-email-template.html as the canonical source"
      contains: "#0D0D0D"
    - path: "website/public/images/email/dark-canon-confinement-hero.jpg"
      provides: "New hero image asset (magnetic vs inertial confinement, De Stijl grid + industrial sketch + photoreal fusion, 16:9), live at a public HTTPS URL under mindrian-os.com"
    - path: "/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md"
      provides: "Outbox log for the new content instance: real freshly-queried recipient count, real version, style_deviations, status drafted-not-sent"
      contains: "recipient_source"
    - path: "/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      provides: "Standalone renderable instance of the redesigned template, fully filled with real beta.44/Memgraph/reliability-hardening content"
  key_links:
    - from: "/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      to: "https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg"
      via: "img src (hero image section)"
      pattern: "images/email/dark-canon-confinement-hero"
    - from: "/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      to: "https://mindrian-os.com/blog/the-beam-nobody-has-won"
      via: "READ THE STORY button href (website link #1)"
      pattern: "blog/the-beam-nobody-has-won"
    - from: "/home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md"
      to: "/home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html"
      via: "top-of-file canonical-source pointer note"
      pattern: "canonical"
---

<objective>
Full visual overhaul of the DARK-canon tester-challenge email template (`references/design/newsletter-email-template.html`, in the sibling `MindrianOS-Plugin` repo): reconcile the two conflicting palette docs into one source of truth, break the monotone left-border-card repetition with full-bleed Mondrian panels, redesign the headline typography to look good as the real rendered font (bold Arial, since Impact is almost never installed) instead of pretending Impact will show, and add a real generated hero image. Then demonstrate the redesign with a new content instance about v1.15.3-beta.44 (the Memgraph-backed Brain migration) plus this week's reliability hardening, framed broadly as "MindrianOS is much more powerful now."

Purpose: three real, diagnosed problems currently degrade every DARK-canon challenge email: (1) `email-template-standard.md`'s muted palette contradicts the actually-shipped brighter palette in the template's own header comment, (2) five different content sections (STEP 0, all 3 what's-new cards, the triple-feature rail) wear the identical "#1A1A1A card + 6px colored rail" shape with zero visual hierarchy, (3) the headline typeface stack leads with Impact, a font almost nobody has installed, so it silently degrades to plain bold Arial for most recipients with none of the intended graphic punch. This is a from-scratch redesign, not a patch.

Output: a redesigned, canon-compliant `newsletter-email-template.html` + a reconciled `email-template-standard.md`, a new publicly-hosted hero image, and one fully-instantiated content demonstration (outbox `.md` log + standalone renderable `.html`) -- no Gmail draft is created or sent by this plan.

**Cross-repo map (read before starting):** the template + palette docs + outbox live in `/home/jsagi/dev/MindrianOS-Plugin` (a SIBLING repo, not this one). Hero-image generation deps live in `/home/jsagi/dev/nano-banana-mcp-server` (a THIRD repo). Hero-image compression (`sharp`) and public hosting live in `/home/jsagi/dev/mindrian-website` (THIS repo, `website/` subdirectory) -- this is the only repo whose deployed Next.js site can serve a public HTTPS image URL, which is why the image must be generated and hosted (Task 1) before the template (Task 2) or the content instance (Task 3) can reference a real `<img src>`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
Standing hard rule governing this whole task:
@/home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md

This quick task's own context + research (read in full before starting -- these live in the MindrianOS-Plugin repo, not this one, since that is where the template files being changed actually live):
@/home/jsagi/dev/MindrianOS-Plugin/.planning/quick/260723-ooq-full-visual-overhaul-of-the-dark-canon-t/260723-ooq-CONTEXT.md
@/home/jsagi/dev/MindrianOS-Plugin/.planning/quick/260723-ooq-full-visual-overhaul-of-the-dark-canon-t/260723-ooq-RESEARCH.md

Template being redesigned (Task 2) and the doc being reconciled to it (Task 2):
@/home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html
@/home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md

Prior real-content precedent for tone, filter logic, and outbox log shape (Task 3):
@/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-the-beam-nobody-has-won.md
@/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/beta-36-40-update-email.html

Content source of truth for Task 3 (use the TOP RELEASED entry, `[1.15.3-beta.44]`, NOT the `Unreleased -- v1.15.3-beta.45 (in progress)` entry above it, even though package.json/plugin.json already show 1.15.3-beta.45 mid-flight):
@/home/jsagi/dev/MindrianOS-Plugin/CHANGELOG.md

Hero image generation source (Task 1, run `node` from this directory so `@google/genai` resolves):
@/home/jsagi/dev/nano-banana-mcp-server/src/index.ts
@/home/jsagi/dev/nano-banana-mcp-server/decode-image.cjs

Hero image compression + hosting (Task 1, run `node` from `website/` so `sharp` resolves; this repo's own prior hero-image publish flow):
@/home/jsagi/dev/mindrian-website/.planning/quick/260723-inu-write-and-publish-a-new-mindrianos-newsl/260723-inu-SUMMARY.md

DO NOT TOUCH: the personal founder-voice email template (`email2-personal.html`, a different lighter-theme email used once this session -- out of scope here per CONTEXT.md). Do NOT create or send any Gmail draft (`create_draft`/`update_draft`/`list_drafts`) -- this plan produces static review files only.
</context>

<tasks>

<task type="auto">
  <name>Task 1 (mindrian-website + nano-banana-mcp-server): Generate and publicly host the new confinement-concept hero image</name>
  <files>website/public/images/email/dark-canon-confinement-hero.jpg</files>
  <action>
Per D-1 (CONTEXT.md): generate a NEW hero image built around the magnetic-vs-inertial confinement visual concept -- two competing fusion-reactor containment architectures, neither dominant, echoing the fusion-confinement section already added to the live `the-beam-nobody-has-won` blog post this session. No standalone image for this concept exists yet; this is a fresh asset, not a reuse of an existing file.

STEP 1A -- Generate. Write a standalone Node script to your scratchpad directory (untracked, not committed) that requires `@google/genai`, loads `GEMINI_API_KEY` from `/home/jsagi/dev/nano-banana-mcp-server/.env` (same pattern as `src/index.ts`), and calls `genai.models.generateContent` with `model: 'gemini-3.1-flash-image-preview'`, `config: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } }`. Prompt (fuse De Stijl Mondrian grid + industrial-design concept sketch + photoreal parts, per the newsletter playbook's Part C recipe): a single wide 16:9 composition showing TWO competing fusion-containment architectures side by side as one cohesive technical illustration -- a magnetic-confinement toroidal tokamak coil chamber on one side, an inertial-confinement laser-target capsule chamber on the other, cleanly labeled, no garbled or illegible text, neither one visually "winning" (equal visual weight, matching the era-of-ferment framing), De Stijl primary color accents (red/yellow/blue) on an industrial-sketch + photoreal-parts render. ONE cohesive subject (the two-architecture comparison itself), not two disconnected images. Run this script with `node <script>` from inside `/home/jsagi/dev/nano-banana-mcp-server` so its `node_modules` resolves. Write the raw base64 response to a scratchpad JSON file, then decode it to a raw image file (reuse the `Buffer.from(base64Data, 'base64')` pattern from `decode-image.cjs`).

STEP 1B -- Compress and place. From `/home/jsagi/dev/mindrian-website/website` (so `sharp` resolves from that workspace's `node_modules`), run a `node -e` one-liner requiring `sharp`, resizing the raw scratchpad image to width 1800px, JPEG quality 82, writing directly to `website/public/images/email/dark-canon-confinement-hero.jpg` (create the `images/email/` directory if it does not exist -- this is a new, deliberately separate path from `images/blog/`, per RESEARCH.md's Open Question recommendation, so future email-hero assets do not clutter the blog image directory).

STEP 1C -- Deploy and verify. Confirm the file is a valid JPEG (`file` command). Commit the new image in this repo (`git add website/public/images/email/dark-canon-confinement-hero.jpg`), then from `website/` run `npx --no-install vercel --prod --yes` to deploy. Verify the live public URL resolves: `curl -I https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg` must return `200` with an image content-type. This public HTTPS URL (not a local path, not a `data:` URI) is required because email clients (Gmail, Outlook) do not reliably render local files or most `data:` URIs -- Task 2 and Task 3 both depend on this real URL existing before they reference it.
  </action>
  <verify>
    <automated>test -f website/public/images/email/dark-canon-confinement-hero.jpg && file website/public/images/email/dark-canon-confinement-hero.jpg | grep -qi jpeg && echo IMAGE_OK</automated>
    <automated>curl -s -o /dev/null -w "%{http_code}" https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg | grep -q 200 && echo LIVE_IMAGE_OK</automated>
  </verify>
  <done>
- website/public/images/email/dark-canon-confinement-hero.jpg exists, is a valid ~1800px-wide JPEG, and shows one cohesive two-architecture confinement comparison (no garbled text, no duplicated/disconnected subject).
- Committed and deployed via Vercel; https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg returns 200.
  </done>
</task>

<task type="auto">
  <name>Task 2 (MindrianOS-Plugin): Reconcile the palette docs and redesign the DARK-canon template structure</name>
  <files>/home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html, /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md</files>
  <action>
Depends on Task 1's live image URL (used only for the throwaway screenshot preview in this task; the canonical template keeps `{{PLACEHOLDER}}` tokens, filled for real in Task 3).

STEP 2A -- Palette reconciliation (D-4, per RESEARCH.md's directly-verified HIGH-confidence verdict: update `email-template-standard.md` to match the shipped template, never the reverse -- the actually-sent emails all use the brighter palette, and the muted palette belongs to a different surface, the Data Room deck system). Rewrite `email-template-standard.md`'s "De Stijl Color Palette" table, "Typography" table, and every component-pattern hex snippet to match `newsletter-email-template.html` exactly: Background `#0D0D0D` (not `#0a0a0f`), Surface `#1A1A1A` (not `#12121a`), Cream `#F5F0E8` (unchanged), Muted `#999999` (collapse the old dual Muted/Dim rows into this one value), Red `#D40000` (not `#a63d2f`), Blue `#0033A0` (not `#1e3a6e`), Yellow `#FFD500` (not `#c4a43c`), Gold/OS `#C8A43C` (the accent/code/link color), Black `#111111`. Remove the Green/Link-Blue/Code-Green/Amethyst rows that do not exist in the shipped canon (they belong to the unrelated Data Room deck system per RESEARCH.md -- this doc's scope is the email canon only). Change every `600px`/`28px sides` reference to `640px`/`32px sides`, and the font stack from `Trebuchet MS, Helvetica, sans-serif` to `Impact, 'Arial Black', Arial, sans-serif` (headlines) / `Helvetica, Arial, sans-serif` (body) / `Courier, Consolas, monospace` (code), matching the canon. Add a prominent note at the very top of the file (above "Brand Name Rules"): state that `newsletter-email-template.html` is the canonical, authoritative source for the DARK tester-challenge email canon, and this document is the derived component-pattern reference kept in sync with it. Do not change any value in `newsletter-email-template.html` to match this doc -- the direction is one-way.

STEP 2B -- Full-bleed Mondrian panel redesign (breaking the monotone repetition). In `newsletter-email-template.html`, replace the identical "6px left-border + `#1A1A1A` card" shape currently used for 5 different sections (STEP 0 callout, all 3 what's-new cards, the triple-feature rail) with a differentiated panel system, extending the ALREADY-PROVEN table-cell-as-solid-color-block technique (used today only for the thin top/bottom Mondrian bars) to content scale:
  - STEP 0 UPDATE CALLOUT: a genuine full-bleed `#D40000` red panel across the full content width (not a 6px rail on a dark card) with cream text sitting directly on the red field, reading as a real alert block.
  - WHAT'S-NEW card 1 (headline/most important): `#1A1A1A` surface with a full-width `#FFD500` 4px top-cap band.
  - WHAT'S-NEW card 2: a genuine full-bleed `#0033A0` blue color panel with cream text (not a rail on dark).
  - WHAT'S-NEW card 3: `#1A1A1A` surface with a full-width `#D40000` 4px top-cap band.
  - The challenge/seed Courier gold-rail box is already differentiated by its monospace treatment; instead give its section header a small full-bleed `#C8A43C` gold tab/flag (echoing the logo row's colored squares) rather than plain text.
  - The triple-feature related-links rail becomes a full-bleed `#111111` warm-black panel bordered top and bottom by thin 3px red/yellow/blue strips, bookending the content body the same way the top/bottom Mondrian bars bookend the whole email.
  - Leave the top/bottom Mondrian bars and the logo row exactly as they are (already correct, already the proven technique).

STEP 2C -- New hero-image section. Insert a new section immediately after the LEDE and before READ THE STORY (masthead -> lede -> hero -> CTA, mirroring the blog's own reading order): a padded `<td>` containing `<img src="{{HERO_IMAGE_URL}}" alt="{{HERO_IMAGE_ALT}}" width="576" style="display:block;width:100%;max-width:576px;border:2px solid #F5F0E8;">` (hard-rectangle border, no border-radius) followed by a one-line cream caption `<div>` (`{{HERO_IMAGE_CAPTION}}`, Helvetica 12px, color `#999999`). Update the header comment's "HOW TO USE" and "SECTION ORDER" (now 13 sections; hero image is new section 5, everything after shifts down by one) to include the 3 new hero placeholders.

STEP 2D -- Headline typography, designed for the bold-Arial reality (most recipients do not have Impact installed, so it silently falls back to plain bold Arial today, losing all intended graphic punch). Increase headline `font-size` to `38px` (from 34px), add an explicit `font-weight:900` (Impact needs no weight declaration, but Arial does), change `letter-spacing` to a slightly negative `-0.01em` (bold Arial is visually wider than Impact's natural condensed look, so negative tracking compensates, replacing the old spacing that assumed Impact's built-in condensation), and wrap the headline in a color-block treatment (extend the existing `#111111` warm-black background down behind the headline row, or add a thin `#0033A0` cap directly above it) so the graphic punch comes from color-blocking, not from a typeface most inboxes will never actually render as designed. Update the bottom "10-ITEM SEND CHECK" comment into an 11-item check, adding: "Hero image has a real public HTTPS src (never local/scratchpad/data:), alt text present, caption present."

Preserve every hard rule verbatim throughout: DARK `#0D0D0D` bg, inline styles only, NO `<style>` block, no web fonts beyond Impact/Arial Black/Helvetica/Arial/Courier, no border-radius anywhere, no emoji, no em-dashes (hyphens only), sender always a named person, mindrian-os.com 3+ times, STEP 0 mandatory and version-naming, `dir="ltr"` + `text-align:left` on every content element except the bars and button/bar text, 640px fixed width.

STEP 2E -- Preview render (does not touch the canonical file). Copy the redesigned template to a scratchpad `.html`, replace every `{{PLACEHOLDER}}` (including the 3 new hero placeholders) with short sample values -- fill `{{HERO_IMAGE_URL}}` with Task 1's real live URL so the preview shows a real image, not a broken-image icon. Screenshot it via the Playwright CLI through Bash (per the `feedback_playwright_cli` hard rule -- Playwright via Bash, never the MCP plugin): `playwright screenshot --viewport-size=700,1600 <scratch-file-path> <scratch-png-path>`. Discard the scratchpad preview `.html` after (do not commit it); the canonical `newsletter-email-template.html` keeps its `{{PLACEHOLDER}}` tokens untouched.
  </action>
  <verify>
    <automated>! grep -qi '&lt;style' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && ! grep -qi '<style' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && echo NO_STYLE_BLOCK_OK</automated>
    <automated>! grep -qi 'border-radius' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && echo NO_RADIUS_OK</automated>
    <automated>! grep -qP "\xe2\x80\x94" /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md && echo NO_EMDASH_OK</automated>
    <automated>grep -q '{{HERO_IMAGE_URL}}' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && grep -q '{{HERO_IMAGE_ALT}}' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && grep -q '{{HERO_IMAGE_CAPTION}}' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && echo HERO_SLOT_OK</automated>
    <automated>grep -q '640' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && grep -q '640' /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md && echo WIDTH_640_BOTH_OK</automated>
    <automated>grep -qi 'font-weight:900' /home/jsagi/dev/MindrianOS-Plugin/references/design/newsletter-email-template.html && echo HEADLINE_WEIGHT_OK</automated>
    <automated>for hex in '#D40000' '#FFD500' '#0033A0' '#C8A43C' '#F5F0E8' '#1A1A1A' '#111111' '#0D0D0D'; do grep -qi "$hex" /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md || { echo "MISSING $hex in email-template-standard.md"; exit 1; }; done && echo PALETTE_RECONCILED_OK</automated>
    <automated>grep -qi 'canonical' /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md && echo CANONICAL_POINTER_OK</automated>
    <automated>! grep -qi '0a0a0f\|12121a\|a63d2f\|1e3a6e\|c4a43c' /home/jsagi/dev/MindrianOS-Plugin/references/design/email-template-standard.md && echo OLD_PALETTE_REMOVED_OK</automated>
    <human-check>View the Playwright screenshot of the instantiated preview (Task 1's real hero image filled in). Confirm: the STEP 0 callout, at least 2 of the 3 what's-new cards, and the triple-feature rail now read as visually distinct full-bleed panels rather than 5 identical dark cards with a thin rail. Confirm the headline reads with real graphic punch even rendered as bold Arial (check by disabling/no Impact font locally, or simply eyeballing the fallback since Impact is unlikely to be installed on this machine either). Confirm the hero image renders inside its hard-rectangle cream border with the caption beneath it, no broken-image icon.</human-check>
  </verify>
  <done>
- email-template-standard.md's palette/typography/component tables match newsletter-email-template.html's shipped values exactly (D40000/FFD500/0033A0/C8A43C/F5F0E8/1A1A1A/111111/0D0D0D/999999, 640px, Impact/Arial Black/Helvetica/Arial/Courier), with a top-of-file note declaring the template canonical. Old muted-palette values and the unrelated Green/Link-Blue/Code-Green/Amethyst rows are gone.
- newsletter-email-template.html has: a full-bleed red STEP 0 panel, at least one full-bleed colored what's-new card (not just a rail), a full-bleed bordered triple-feature panel, a new 3-placeholder hero-image section between the lede and the CTA button, and a bold-Arial-aware headline (font-weight:900, adjusted letter-spacing, color-block treatment).
- Every hard rule (no style block, no border-radius, no emoji, no em-dashes, 640px, dir=ltr, Impact/Arial Black/Helvetica/Arial/Courier only) still holds.
- A Playwright screenshot of a filled-in preview (using Task 1's real image URL) was reviewed and confirms the redesign renders correctly; the canonical file itself still carries `{{PLACEHOLDER}}` tokens, unfilled.
  </done>
</task>

<task type="auto">
  <name>Task 3 (MindrianOS-Plugin): Instantiate the v1.15.3-beta.44 / Memgraph / reliability-hardening content, re-query recipients fresh, save as a review-ready draft (no Gmail send)</name>
  <files>/home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md, /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html</files>
  <action>
Depends on Task 2's redesigned template and Task 1's live hero-image URL. Per D-3 (CONTEXT.md): this task's recipient count MUST be a fresh, real re-query at execution time, not the stale 42 reused from the prior session's outbox log without re-verification.

STEP 3A -- Confirm the real released version. Read the TOP RELEASED entry in `/home/jsagi/dev/MindrianOS-Plugin/CHANGELOG.md` -- this must be `[1.15.3-beta.44] - 2026-07-23`, NOT the `## [Unreleased] -- v1.15.3-beta.45 (in progress)` entry above it (package.json/plugin.json already show 1.15.3-beta.45 mid-flight, but CHANGELOG is the source of truth for what has actually SHIPPED and is safe to announce). Use `v1.15.3-beta.44` verbatim in the STEP 0 callout.

STEP 3B -- Re-query recipients fresh. Write a one-off Node script (scratchpad, untracked) using `/home/jsagi/dev/MindrianOS-Plugin/mcp-server-brain/.env`'s `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` to GET `brain_api_keys?select=email,is_active,last_request_at` via Supabase REST, filter `is_active=true AND last_request_at IS NOT NULL`, dedupe by lowercased email, exclude `jsagir@gmail.com`. Run it now and record the real numeric count. If the query fails (missing/invalid credentials, network error), STOP this task and surface a human-check escalation rather than guessing, fabricating, or reusing the prior session's 42 -- do not file the outbox log without a real, freshly-verified count.

STEP 3C -- Instantiate the redesigned template's placeholders with real, CHANGELOG-grounded content:
  - HEADLINE_PRE / HEADLINE_HIGHLIGHT: broad "everything got better" framing (D-2), e.g. pre "MINDRIAN'S BRAIN JUST GOT" highlight "A LOT MORE POWERFUL" (or an equally Feynman-simple equivalent) -- exactly one yellow-highlighted phrase.
  - LEDE_1/2: plain-English framing that the Brain moved to a faster, Memgraph-backed engine this week and several real cracks got fixed along the way. Feynman voice, no jargon.
  - HERO_IMAGE_URL = Task 1's real live URL (`https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg`); HERO_IMAGE_ALT describes the two confinement architectures; HERO_IMAGE_CAPTION ties it back to the fusion-confinement section of the live "The Beam Nobody Has Won" post.
  - STORY_SLUG = `the-beam-nobody-has-won` (the READ THE STORY button points at this EXISTING live post, which already contains the fusion-confinement section added earlier this session -- confirm it is still live with `curl -s -o /dev/null -w "%{http_code}"` returning 200 before finalizing; this is website link #1).
  - UPDATE_NOTE names `v1.15.3-beta.44` exactly and explains why: the challenge/content below leans on the new Memgraph-backed Brain routing.
  - WHATSNEW 1/2/3, using the grounded Feynman one-liners from RESEARCH.md nearly verbatim (do not invent new claims beyond what CHANGELOG actually supports): card 1 (yellow-cap, headline) = the beta.38 Memgraph endpoint flip ("the brain behind Larry moved to a faster house... every existing API key still works exactly the same"); card 2 (full-bleed blue) = the Windows reliability trilogy (beta.40 `os.rename`/`os.replace` fix + beta.42's two follow-on Windows fixes) combined into one card; card 3 (red-cap) = the beta.44 Stop-hook JSON-schema permanent-guardrail fix (4th recurrence, now structurally prevented).
  - CHALLENGE_TITLE / CHALLENGE_INTRO / SEED_PROMPT: a magnetic-vs-inertial confinement classify-first challenge (two competing containment architectures, neither dominant, echoing the hero image and the live post's fusion-confinement section), paste-ready with an `[OR DESCRIBE YOUR OWN FIELD]` bracket, matching the established "classify first, do not jump to picking a favorite" seed idiom.
  - MOS_CMD_1..6 + glosses: reuse the same 6 verified-real commands (`/mos:new-project`, `/mos:diagnose`, `/mos:user-needs`, `/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:challenge-assumptions`), glosses adapted to the confinement angle (docs link = website link #2).
  - TRIPLE_FEATURE_BODY: link `the-beam-nobody-has-won` + `dominant-design-the-brick-that-won` + `maybe-a-tank-needs-to-be-an-ambulance` (confirm all 3 return 200 via curl before finalizing).
  - REPLY_CTA + SENDER_NAME = `Jonathan` (sign-off = website link #3; confirm `mindrian-os.com` appears 3+ times total across the instantiated HTML).
  - No em-dashes anywhere (hyphens only).

STEP 3D -- Save the fully-instantiated file as a standalone renderable `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` (matching the `beta-36-40-update-email.html` precedent of a directly-openable sibling file, not just embedded in a log).

STEP 3E -- Write the outbox log `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md` with frontmatter matching the established shape (`type`, `version: v1.15.3-beta.44`, `status: drafted-not-sent`, `recipient_source` with the REAL freshly-queried count and exact filter/method, `subject`, `style_deviations` noting this is a template-redesign demonstration instance and explicitly that NO Gmail draft was created or sent per this quick task's scope), the plain-text body in a fenced block, and cross-references to Task 1's image URL, Task 2's redesigned template, and the CHANGELOG entries used (beta.38, beta.40, beta.42, beta.44).

STEP 3F -- Do NOT call any Gmail MCP tool (`create_draft`/`update_draft`/`list_drafts`) or any other send mechanism. This task produces static review files only, per the CONTEXT.md scope decision and this plan's constraint.

Commit both new outbox files as one commit in `/home/jsagi/dev/MindrianOS-Plugin` (from the dev workspace, never the `~/.claude/plugins` install cache -- WORKSPACE GUARD), separate from mindrian-website's Task 1 commit and Task 2's MindrianOS-Plugin commit.
  </action>
  <verify>
    <automated>test -f /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && test -f /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo FILES_OK</automated>
    <automated>grep -qi 'v1.15.3-beta.44' /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo VERSION_NAMED_OK</automated>
    <automated>grep -qiE 'recipient_source:.*[0-9]' /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && echo REAL_COUNT_RECORDED</automated>
    <automated>grep -qi 'drafted-not-sent\|status: drafted' /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && echo NOT_SENT_STATUS_OK</automated>
    <automated>test "$(grep -o 'mindrian-os.com' /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html | wc -l)" -ge 3 && echo WEBSITE_3X_OK</automated>
    <automated>! grep -qP "\xe2\x80\x94" /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && echo NO_EMDASH_OK</automated>
    <automated>grep -q 'images/email/dark-canon-confinement-hero' /home/jsagi/dev/MindrianOS-Plugin/docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo HERO_WIRED_OK</automated>
    <automated>for slug in the-beam-nobody-has-won dominant-design-the-brick-that-won maybe-a-tank-needs-to-be-an-ambulance; do code=$(curl -s -o /dev/null -w "%{http_code}" "https://mindrian-os.com/blog/$slug"); [ "$code" = "200" ] || { echo "DEAD LINK $slug"; exit 1; }; done && echo LIVE_LINKS_OK</automated>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && git log --oneline -1 -- docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md | grep -q . && echo SIBLING_COMMIT_OK</automated>
    <human-check>Open docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html in a browser (or view its Playwright screenshot). Confirm the redesigned full-bleed panels, the real hero image, and the bold-Arial-aware headline all render correctly with the real beta.44/Memgraph/reliability content. Confirm the recipient count looks sane (a real number, not a placeholder or an obviously stale reuse of 42 without re-verification). Confirm no Gmail draft was created (this task only produced static files).</human-check>
  </verify>
  <done>
- The real active brain_api_keys count was freshly queried at execution time (a number, with method recorded) and is not a blind reuse of the prior session's 42.
- Both new outbox files exist: the standalone renderable `.html` (real content, real hero image, redesigned panels) and the `.md` log (frontmatter with `recipient_source`, `status: drafted-not-sent`, `style_deviations`).
- All CHANGELOG-grounded claims (beta.38 Memgraph, beta.40/42 Windows fixes, beta.44 Stop-hook fix) are accurate and Feynman-simple; zero fabricated claims.
- mindrian-os.com appears 3+ times; zero em-dashes; the 3 triple-feature links and the READ THE STORY link are all confirmed live (200).
- Committed as its own separate commit in MindrianOS-Plugin (not mindrian-website, not the install cache).
- No Gmail draft was created or sent.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local -> nano-banana/Gemini image-gen API | External image-generation service; API key already provisioned in nano-banana-mcp-server/.env |
| local -> Vercel prod deploy | A public production deploy of a new static image asset under mindrian-os.com |
| local -> Supabase REST (brain_api_keys) | Read-only recipient-count query using mcp-server-brain's own service credentials |
| content instance -> future Gmail send | Explicitly deferred out of this plan's scope; no send action is taken |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ooq-01 | Tampering/leak | nano-banana Gemini API key | mitigate | Key stays inside nano-banana-mcp-server/.env, read only by a script run from that directory; never printed, logged, or committed. |
| T-ooq-02 | Information disclosure | Supabase SUPABASE_SERVICE_KEY | mitigate | Credentials read only from mcp-server-brain/.env at query time; never echoed to logs, commits, or the outbox file. Only the final numeric count is written to a tracked file. |
| T-ooq-03 | Information disclosure | Recipient email addresses | mitigate | No individual email address is ever written to any tracked file -- only the aggregate count and the query method/filter are recorded in the outbox log (feedback_no_real_names_in_repo). |
| T-ooq-04 | Tampering | Package installs | accept | No npm/pip/cargo installs in this plan; `sharp` and `@google/genai` already resolve in their existing repos (RESEARCH.md verified this directly). No Package Legitimacy Gate required. |
| T-ooq-05 | Repudiation/Integrity | Wrong-workspace commit | mitigate | Tasks 2 and 3 commit from `/home/jsagi/dev/MindrianOS-Plugin`, never the `~/.claude/plugins` install cache (WORKSPACE GUARD). |
| T-ooq-06 | Elevation / unintended send | Accidental Gmail send | mitigate | This plan never invokes `create_draft`/`update_draft`/`list_drafts` or any Gmail tool; the content instance is saved as static files only, per the explicit CONTEXT.md and user scope decision. |
</threat_model>

<verification>
Phase-level checks (run after all three tasks):
- https://mindrian-os.com/images/email/dark-canon-confinement-hero.jpg returns 200 (Task 1's hero image, live).
- newsletter-email-template.html and email-template-standard.md share one identical palette, with the .md file pointing at the .html as canonical (Task 2).
- The redesigned template has full-bleed panels replacing at least 4 of the 5 previously-monotone sections, a bold-Arial-aware headline, and a working hero-image slot (Task 2).
- The new outbox `.md` + `.html` exist with real, freshly-queried recipient count, real CHANGELOG-grounded content, zero em-dashes, mindrian-os.com 3+ times, and all referenced blog links live (Task 3).
- Three separate commits landed: one in mindrian-website (hero image), and two in MindrianOS-Plugin (template + palette reconciliation; new outbox content instance).
- No Gmail draft was created or sent at any point in this plan.
</verification>

<success_criteria>
- The DARK-canon template is visually redesigned: one reconciled palette (with email-template-standard.md pointing at the template as canonical), full-bleed Mondrian panels replacing the monotone left-border-card repetition, a headline redesigned to read well as real bold Arial, and a working hero-image slot -- all hard rules (DARK bg, inline styles only, no style block, no border-radius, no emoji, no em-dashes, sender is a person, mindrian-os.com 3+, STEP 0 mandatory, 640px, LTR) intact.
- A real, publicly-hosted hero image (magnetic vs inertial confinement concept) exists and is live at a stable HTTPS URL.
- A new content instance demonstrates the redesign with real, CHANGELOG-grounded v1.15.3-beta.44/Memgraph/reliability-hardening copy, a freshly re-queried real recipient count, and zero fabricated claims.
- No Gmail draft was created or sent -- this plan produced review-ready static files only, matching this session's established prepare-then-explicit-go-ahead pattern.
- All three repos (mindrian-website, MindrianOS-Plugin x2) have their own separate, correctly-scoped commits.
</success_criteria>

<output>
Create `.planning/quick/260723-ooq-full-visual-overhaul-of-the-dark-canon-t/260723-ooq-SUMMARY.md` when done, recording: the hero image's live URL, both MindrianOS-Plugin commit hashes, the mindrian-website commit hash, the real freshly-queried recipient count, and confirmation that no Gmail draft was created.
</output>
