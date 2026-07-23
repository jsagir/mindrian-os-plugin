---
phase: 260723-rln
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - references/design/newsletter-email-template.html
  - references/design/email-template-standard.md
  - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
  - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md
autonomous: true
requirements:
  - D-01-TERMINAL-ISLAND-STAYS-DARK       # CONTEXT.md locked: challenge-seed box + command-chain box keep dark terminal treatment, reuse pre.code token
  - D-02-HERO-BORDER-INK-NOT-REGENERATE   # CONTEXT.md locked: hero image border flips cream->ink, image asset itself untouched
  - WCAG-AA-GOLD-TEXT-TO-BLUE             # RESEARCH.md HIGH-confidence finding: gold #C8A43C fails AA as text on cream (2.13:1), must become blue #1E52E0 (5.62:1) except inside terminal islands
  - PALETTE-SOURCE-CSS-VERBATIM           # CONTEXT.md discretion: hex values pulled verbatim from skills/ui-system/design-system/mos-design-system.css, none invented
  - STRUCTURAL-PRESERVATION-OOQ           # CONTEXT.md + user constraint: preserve every 260723-ooq structural/layout element untouched, color-only re-skin
  - MD-TARGETED-EDIT-NOT-REWRITE          # CONTEXT.md discretion, resolved by RESEARCH.md recommendation: email-template-standard.md gets a targeted hex-value edit, not a structural rewrite
  - NO-GMAIL-DRAFT-TOUCH                  # User constraint: do not touch the live Gmail draft (r-1370266653870026168) or call any Gmail MCP tool
  - NO-EMDASHES                           # feedback_no_emdashes (HARD RULE)

must_haves:
  truths:
    - "Opening references/design/newsletter-email-template.html (placeholders filled) or docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html in a browser shows a cream #F4F2EC page background everywhere except the two locked terminal-island blocks (challenge-seed box, command-chain box), which still render #0C0C0D dark."
    - "No text renders as gold #C8A43C on any light/cream surface -- WCAG AA fails at 2.13:1 (below both the 3:1 large-text and 4.5:1 body-text floors, per RESEARCH.md's computed verdict); the logo 'OS' mark, the docs link, the 3 triple-feature blog links (drafted instance only), and the sign-off link all render in blue #1E52E0 (5.62:1, passes AA) instead."
    - "Gold #C8A43C still appears as background fills behind dark ink text (READ THE STORY button, CHALLENGE tab -- 8.76:1, passes AA easily) and as the command-chain's command-name text plus the seed-box left-border accent, both inside the locked dark terminal-island blocks (D-01), unchanged."
    - "The hero image border reads as a visible ink #0C0C0D frame against the cream page (D-02); the image asset itself (dark-canon-confinement-hero.jpg, hosted in the sibling mindrian-website repo) is not regenerated, re-hosted, or its src URL changed."
    - "Every palette-independent structural element from the 260723-ooq redesign survives untouched: differentiated panel shapes (full-bleed vs top-cap-band vs bordered-left), 38px/900-weight/-0.01em headline sizing, hero placement in section 5, 640px fixed width, dir=ltr plus text-align:left on content, no border-radius, no emoji, no em-dash, 3+ mindrian-os.com links, sender-is-a-person, STEP 0 callout mandatory presence."
    - "email-template-standard.md's palette table, typography table, and all 9 component-pattern snippets show the new cream-canon hex values and still declare newsletter-email-template.html as canonical; no old DARK-canon hex value (#0D0D0D, #1A1A1A, #F5F0E8, #0033A0, #D40000, #FFD500, #999999, #111111) remains in either references/design/ file."
    - "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md documents that its instantiated .html sibling has been re-skinned from the retired DARK canon to the cream M:OS Canonical Design System v1.1 (quick task 260723-rln), while its version/recipient-count/CHANGELOG-sourced content facts remain byte-for-byte unchanged."
  artifacts:
    - path: "references/design/newsletter-email-template.html"
      provides: "Re-skinned canonical DARK-to-cream email template; terminal-island (D-01) and hero-border (D-02) exceptions applied; header/footer comments updated to describe the new canon"
      contains: "#F4F2EC"
    - path: "references/design/email-template-standard.md"
      provides: "Reconciled derived doc matching the re-skinned template, targeted hex-value edit only (no structural rewrite)"
      contains: "#1E52E0"
    - path: "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      provides: "Re-skinned drafted content instance, same real beta.44/Memgraph/reliability-hardening content, new cream palette"
      contains: "#0C0C0D"
    - path: "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md"
      provides: "Doc-note update recording the DARK-canon retirement and cross-referencing quick task 260723-rln; no content-fact changes"
      contains: "260723-rln"
  key_links:
    - from: "references/design/newsletter-email-template.html"
      to: "skills/ui-system/design-system/mos-design-system.css"
      via: "literal hex match reusing the pre.code terminal token for the two locked dark blocks"
      pattern: "background-color:#0C0C0D;border-left:4px solid #C8A43C"
    - from: "references/design/newsletter-email-template.html"
      to: "WCAG AA contrast compliance"
      via: "gold-text-to-blue conversion on the logo OS mark and every non-terminal link"
      pattern: "color:#1E52E0;\">OS</span>"
    - from: "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      to: "references/design/newsletter-email-template.html"
      via: "identical re-skinned hex set applied to the instantiated content copy"
      pattern: "#FBFAF7"
---

<objective>
Retire the DARK-canon tester-challenge email design and re-skin it to the cream-default M:OS Canonical Design System v1.1 that already governs every other HTML artifact in this repo (decks, dashboards, wiki, exports, snapshots, hub/lobby). This is a literal, per-surface hex substitution of the palette across the canonical template, its derived doc, and the already-drafted content instance -- not a re-architecture. Every structural/layout win from today's earlier redesign (quick task 260723-ooq: differentiated full-bleed panels, bold-Arial-aware headline, the hero-image section) stays exactly as it landed; only fill/text colors change.

This reverses the standing rule in `feedback_newsletter_story_challenge_playbook.md` Part B ("the DARK tester-email canon... NOT the website's light paper look"). That memory file lives outside this repo (`~/.claude/projects/-home-jsagi/memory/`) and cannot be edited from within this plan; the SUMMARY produced by this plan must state clearly that the rule is now superseded so the orchestrator can decide how to record that externally.

Purpose: unify every MindrianOS HTML surface under one cream design system instead of maintaining two conflicting canons (dark tester-email vs. cream everything-else), while preserving the terminal-island precedent (code/command blocks stay dark, matching the website's own "dark is reserved for terminal islands only" rule) and fixing a real accessibility bug uncovered by research -- gold `#C8A43C` used as text color fails WCAG AA against a cream ground (2.13:1).

Output: `references/design/newsletter-email-template.html` and `references/design/email-template-standard.md` re-skinned to cream, and the already-drafted `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` + `.md` re-skinned to match, with zero content/version/recipient-count changes. No Gmail draft is touched.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260723-rln-retire-the-dark-canon-tester-challenge-e/260723-rln-CONTEXT.md
@.planning/quick/260723-rln-retire-the-dark-canon-tester-challenge-e/260723-rln-RESEARCH.md
@skills/ui-system/design-system/mos-design-system.css

Files being re-skinned (read each in full before editing -- every hex occurrence must be classified, not blindly find/replaced):
@references/design/newsletter-email-template.html
@references/design/email-template-standard.md
@docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
@docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md

Prior same-day structural redesign this task builds on (do not re-touch its layout decisions, only its colors):
@.planning/quick/260723-ooq-full-visual-overhaul-of-the-dark-canon-t/260723-ooq-SUMMARY.md

DO NOT TOUCH: the live Gmail draft `r-1370266653870026168` (no `create_draft`/`update_draft`/`list_drafts` call of any kind -- out of scope, handled by the orchestrator separately). DO NOT edit `~/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md` (outside this repo) -- only note in the SUMMARY that its Part B DARK-canon rule is now superseded.

## Color Mapping Reference (authoritative, from RESEARCH.md -- apply literally, do not re-derive or invent hex values)

Core test for every occurrence (RESEARCH.md's "Key insight"): is this text sitting on a light surface (paper/panel) or a saturated/dark panel (red/blue/ink/terminal)? Light surface -> ink text. Saturated/dark panel -> light text.

**Grounds and surfaces:**
- `#0D0D0D` (body/outer wrapper bg) -> `#F4F2EC` (`--paper`)
- `#1A1A1A` used as a plain card surface (what's-new cards 1 and 3) -> `#FBFAF7` (`--panel`)
- `#1A1A1A` used for the challenge-seed box or the command-chain table (the two locked terminal-island blocks, D-01) -> `#0C0C0D` (matches `pre.code`'s own bg token, theme-independent by design)
- `#111111` (headline color-block field bg, triple-feature full-bleed panel bg, Mondrian bar accent squares) -> `#0C0C0D` (`--ink`) -- these are full-bleed dark panels that KEEP their dark polarity even on the cream page (De Stijl black-square accent), text on them stays light

**Text:**
- `#F5F0E8` on a now-light surface (paper/panel: lede, card 1/3 body, section headings, sign-off name, challenge title/intro) -> `#0C0C0D` (`--ink`)
- `#F5F0E8` on a full-bleed saturated/dark panel that keeps its dark bg (STEP 0 red panel, what's-new card 2 blue panel, headline field, triple-feature panel) -> `#F4F2EC` (`--paper`), text polarity unchanged
- `#F5F0E8` inside the two terminal-island blocks (seed box body, command-chain gloss/caption text) -> `#E8E8E2` (matches `pre.code`'s own text token)
- `#999999` (hero caption, sign-off byline) -> `#5B5B5B` (`--muted`)
- Old near-black button/tab text `#0D0D0D` -> standardize to `#0C0C0D` (`--ink`) for consistency

**De Stijl primaries:**
- `#D40000` -> `#E11D22` (`--red`)
- `#0033A0` -> `#1E52E0` (`--blue`)
- `#FFD500` -> `#FFC400` (`--yellow`)

**Gold `#C8A43C` (the one non-mechanical split -- classify every occurrence by role before touching it):**
- KEEP `#C8A43C` where it is a BACKGROUND fill with dark ink text on top: READ THE STORY button, CHALLENGE tab (8.76:1, passes AA easily)
- KEEP `#C8A43C` as TEXT only inside the two locked terminal-island blocks (D-01): the command-chain's command-name text (the `<td>`-level `color:#C8A43C` covering all 6 `{{MOS_CMD_N}}` names), and the seed-box's `border-left:4px solid #C8A43C` structural accent (a border, not text)
- SWITCH every other TEXT usage of `#C8A43C` to `#1E52E0` (`--blue`, 5.62:1, passes AA, also M:OS's own semantic link color): the logo "OS" mark span, the docs link ("catalog at mindrian-os.com/docs" -- this link sits structurally inside the dark command-chain table, but as a hyperlink it takes the universal link-blue like every other link in the system; blue reads clearly against `#0C0C0D` too), the sign-off "mindrian-os.com" link, and (drafted instance only) the 3 triple-feature blog links

**Hero image border (D-02, locked):** `border:2px solid #F5F0E8` -> `border:2px solid #0C0C0D`. Do not touch the `<img src>` value or regenerate the asset.

**Terminal-island scope (D-01, locked) -- exactly these two blocks, nothing else:** (a) the challenge-seed Courier box (section 10), (b) the "THEN RUN THE CHAIN" command-chain table including its trailing "documented in the catalog" caption row (section 11). Both keep `#0C0C0D` background. Locate by section number per RESEARCH.md's Pitfall 3 warning -- `#1A1A1A` is shared by cards 1/3 (which DO re-skin to cream `#FBFAF7`) and these two blocks (which do NOT), so a blind find/replace on the hex alone cannot distinguish them.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Re-skin the canonical template and its derived doc to the cream M:OS system</name>
  <files>references/design/newsletter-email-template.html, references/design/email-template-standard.md</files>
  <action>
Apply the Color Mapping Reference above literally to both files. Work section by section, not by blind global hex replace (multiple old hexes map to different new hexes depending on role -- see reference).

In `newsletter-email-template.html`: re-skin every background-color and color declaration per the mapping (top/bottom Mondrian bars, logo row squares and text, headline cap band + field + highlight span, lede, hero border per D-02, READ THE STORY button, divider, STEP 0 full-bleed red panel, what's-new cards 1/2/3, CHALLENGE tab, seed box (terminal, D-01), command-chain table (terminal, D-01) including its command names (kept gold), gloss text, and docs link (switched to blue per the reference's link-blue rule), triple-feature full-bleed panel, reply CTA, sign-off name and link, bottom Mondrian bar). Then rewrite the top header comment block: retitle away from "the DARK challenge-email canon" to describe the cream M:OS Canonical Design System v1.1 canon with terminal-islands-stay-dark as the one intentional exception (cross-reference quick task 260723-rln and the retired 260723-ooq structural redesign it builds on); update the "HARD RULES" section's background/surface hex mentions; rewrite the "DE STIJL PALETTE" swatch list to the new hex values plus a note on gold's restricted role (background fills + terminal-island text only, no longer a general-purpose text color) and the terminal-island token. Leave the "SECTION ORDER" list unchanged (purely structural, no color content). Update the bottom "11-ITEM SEND CHECK" comment's item 2 (currently "#0D0D0D bg") to name the new `#F4F2EC` ground plus the `#0C0C0D` terminal-island exception.

In `email-template-standard.md` (targeted edit only, per RESEARCH.md's own recommendation -- do not rewrite the Structure or Layout Rules sections, they are palette-independent and already correct): update the top canonical-source note to drop the "DARK tester-challenge email canon" framing in favor of the cream canon (still declaring the `.html` canonical, `.md` derived, template wins on conflict). Rewrite the "De Stijl Color Palette" table's hex column and role descriptions to match the new mapping (Paper/Panel/Ink/Muted/Red/Blue/Yellow/Gold-restricted-role/terminal-text `#E8E8E2` as a new row). Rewrite the "Typography" table's color column for every row (Logo/brand, Headline, Section heading, Body text, Muted/byline, Code/seed prompt) per the mapping, noting the full-bleed-panel and terminal-island exceptions inline where relevant (Headline row keeps light text on its still-dark field). Update every hex literal inside all 9 "Component Patterns" code snippets (Top/Bottom Mondrian Bar, Full-Bleed Alert Panel, Top-Cap Band Card, Full-Bleed Color Panel, Gold Tab/Flag, Seed/Code Box, Hero Image, CTA Button, Footer/Sign-off) to match the corresponding re-skinned markup in the `.html` file exactly. The 11 numbered "Rules" at the bottom reference no hex values and need no change.
  </action>
  <verify>
    <automated>! grep -qE '#0D0D0D|#1A1A1A|#F5F0E8|#0033A0|#D40000|#FFD500|#999999|#111111' references/design/newsletter-email-template.html references/design/email-template-standard.md && echo NO_OLD_HEX_OK</automated>
    <automated>grep -q 'color:#1E52E0;">OS</span>' references/design/newsletter-email-template.html && grep -q 'href="https://mindrian-os.com/docs" style="color:#1E52E0' references/design/newsletter-email-template.html && grep -q 'href="https://mindrian-os.com" style="color:#1E52E0' references/design/newsletter-email-template.html && echo GOLD_TEXT_TO_BLUE_OK</automated>
    <automated>grep -q 'line-height:2;color:#C8A43C;text-align:left;' references/design/newsletter-email-template.html && grep -q 'background-color:#0C0C0D;border-left:4px solid #C8A43C' references/design/newsletter-email-template.html && echo TERMINAL_ISLAND_OK</automated>
    <automated>grep -q 'border:2px solid #0C0C0D' references/design/newsletter-email-template.html && echo HERO_BORDER_INK_OK</automated>
    <automated>grep -q 'background-color:#C8A43C;padding:13px 26px' references/design/newsletter-email-template.html && grep -q 'background-color:#C8A43C;padding:4px 10px' references/design/newsletter-email-template.html && echo GOLD_BG_KEPT_OK</automated>
    <automated>grep -q '640' references/design/newsletter-email-template.html && grep -q '640' references/design/email-template-standard.md && ! grep -qi 'border-radius' references/design/newsletter-email-template.html && ! grep -qP '\xe2\x80\x94' references/design/newsletter-email-template.html references/design/email-template-standard.md && grep -q 'font-size:38px;font-weight:900' references/design/newsletter-email-template.html && echo STRUCTURAL_PRESERVED_OK</automated>
    <automated>grep -qi 'canonical' references/design/email-template-standard.md && grep -q '#FBFAF7' references/design/email-template-standard.md && grep -q '#1E52E0' references/design/email-template-standard.md && echo MD_RECONCILED_OK</automated>
  </verify>
  <done>
- newsletter-email-template.html and email-template-standard.md contain zero old DARK-canon hex values; every mechanical surface/text pairing follows the Color Mapping Reference exactly.
- The logo OS mark, docs link, and sign-off link render blue #1E52E0; the READ THE STORY button and CHALLENGE tab keep gold #C8A43C as a background fill with ink text.
- The seed box and command-chain box (D-01) still show #0C0C0D background, #C8A43C command-name text, and #E8E8E2 gloss/body text -- visually distinct terminal islands inside the cream email.
- The hero image border is #0C0C0D ink (D-02); the image src is untouched.
- 640px width, no border-radius, no em-dash, and the 38px/900-weight headline sizing all survive unchanged.
- email-template-standard.md's palette, typography, and all 9 component-pattern snippets match the re-skinned template and still declare it canonical.
  </done>
</task>

<task type="auto">
  <name>Task 2: Re-skin the already-drafted content instance to match</name>
  <files>docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html, docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md</files>
  <action>
Apply the identical Color Mapping Reference from `<context>` to `2026-07-23-v1.15.3-beta.44-everything-got-better.html` (its markup mirrors the template 1:1, filled with real content instead of `{{PLACEHOLDER}}` tokens) -- same section-by-section substitutions: Mondrian bars, logo, headline, lede, hero border (D-02), READ THE STORY button, divider, STEP 0 panel, what's-new cards 1/2/3, CHALLENGE tab, seed box (terminal, D-01), command-chain table (terminal, D-01), triple-feature panel (this instance has 3 REAL blog links inside it -- switch all 3 from gold text to `#1E52E0` blue, per the reference's gold-split rule; the panel's own bg stays `#111111`->`#0C0C0D` ink, body text stays `#F5F0E8`->`#F4F2EC` paper, only the link color changes), reply CTA, sign-off. Do not alter any real content: the headline copy, lede copy, `v1.15.3-beta.44` version string, hero image `src` URL, blog link `href` values, command names/glosses, or recipient-facing text stay byte-for-byte identical -- this task changes colors only.

In `2026-07-23-v1.15.3-beta.44-everything-got-better.md` (documentation-only edit, no hex values exist in this file today): update the `style_deviations` list and the opening prose paragraph, both of which currently describe the instance as demonstrating "the redesigned DARK-canon template (quick task 260723-ooq)" -- rewrite those mentions to state the instance was subsequently re-skinned from the retired DARK canon to the cream M:OS Canonical Design System v1.1 (quick task 260723-rln), with the two terminal-island blocks (challenge-seed box, command-chain box) intentionally staying dark. Add a cross-reference line in the "Cross-references" section pointing at this quick task's own CONTEXT.md/RESEARCH.md/PLAN.md path (`.planning/quick/260723-rln-retire-the-dark-canon-tester-challenge-e/`). Do NOT change `version`, `status`, `gmail_draft_id`, `recipient_source`, any `recipient_query_*` field, `subject`, `story_slug`, `story_url`, or `hero_image_url` in the frontmatter -- these are historical facts about what was queried/drafted and must remain byte-for-byte unchanged. Do NOT call any Gmail MCP tool (`create_draft`/`update_draft`/`list_drafts`) at any point in this task.
  </action>
  <verify>
    <automated>! grep -qE '#0D0D0D|#1A1A1A|#F5F0E8|#0033A0|#D40000|#FFD500|#999999|#111111' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo NO_OLD_HEX_OK</automated>
    <automated>grep -q 'color:#1E52E0;">OS</span>' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && [ "$(grep -o 'style="color:#1E52E0;text-decoration:underline;"' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html | wc -l)" = "5" ] && echo GOLD_TEXT_TO_BLUE_OK</automated>
    <automated>grep -q 'line-height:2;color:#C8A43C;text-align:left;' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && grep -q 'background-color:#0C0C0D;border-left:4px solid #C8A43C' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo TERMINAL_ISLAND_OK</automated>
    <automated>grep -q 'border:2px solid #0C0C0D' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo HERO_BORDER_INK_OK</automated>
    <automated>grep -q "MINDRIAN'S BRAIN JUST GOT" docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && grep -q 'v1.15.3-beta.44' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && grep -q 'dark-canon-confinement-hero.jpg' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html && echo CONTENT_UNCHANGED_OK</automated>
    <automated>grep -qi '260723-rln' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && grep -q 'recipient_query_final_count: 42' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && grep -q 'gmail_draft_id: "r-1370266653870026168"' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md && echo MD_NOTE_UPDATED_FACTS_INTACT</automated>
  </verify>
  <done>
- docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html carries the identical cream re-skin as the template (no old DARK hex, gold text switched to blue outside the two terminal-island blocks, hero border ink, terminal blocks still dark).
- All real content (headline, lede, version, hero URL, blog links, command names/glosses, recipient-facing copy) is byte-for-byte unchanged from before the re-skin.
- docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md documents the DARK-to-cream re-skin and cross-references quick task 260723-rln, while version/status/gmail_draft_id/recipient_source/recipient_query_* facts remain untouched.
- No Gmail MCP tool was called at any point.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Plan scope -> live Gmail draft | The re-skinned .html content is NOT synced to the existing Gmail draft (r-1370266653870026168) by this plan; that draft still reflects the old DARK-canon content until the orchestrator updates it separately |
| Plan scope -> external memory file | The now-superseded standing rule lives outside this repo and is documentation-only; no write access is exercised or attempted |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rln-01 | Tampering/scope-creep | Gmail draft r-1370266653870026168 | mitigate | This plan never calls `create_draft`/`update_draft`/`list_drafts`; explicit DO-NOT-TOUCH instruction in `<context>` and both task actions |
| T-rln-02 | Repudiation | External memory file (feedback_newsletter_story_challenge_playbook.md) | accept | File lives outside repo write scope; plan only records supersession in its own SUMMARY, per explicit constraint |
| T-rln-03 | Tampering | Recipient/version content facts in the outbox `.md` | mitigate | Task 2 explicitly lists every frontmatter field that must stay byte-for-byte unchanged and verifies two of them (recipient count, gmail_draft_id) post-edit |
| T-rln-04 | Information disclosure | N/A -- no secrets, credentials, or PII touched | accept | Static HTML/Markdown color re-skin only; no network calls, no package installs, no credential access |
</threat_model>

<verification>
Phase-level checks (run after both tasks):
- No old DARK-canon hex value (#0D0D0D, #1A1A1A, #F5F0E8, #0033A0, #D40000, #FFD500, #999999, #111111) remains in any of the four target files.
- The two locked terminal-island blocks (challenge-seed box, command-chain box) still show `#0C0C0D` background with `#C8A43C` command-name text and `#E8E8E2` gloss text, in both the template and the drafted instance.
- Every non-terminal gold TEXT usage (logo OS mark, docs link, sign-off link, and in the drafted instance the 3 triple-feature blog links) now renders `#1E52E0` blue.
- The hero image border is `#0C0C0D` ink in both HTML files; the image `src`/asset itself is unchanged.
- email-template-standard.md still declares the `.html` canonical and its palette/typography/component tables match the re-skinned `.html` exactly.
- The outbox `.md` documents the re-skin and cross-references 260723-rln while its version/status/gmail_draft_id/recipient_source facts are untouched.
- No Gmail MCP tool was called; the external memory file was not edited.
</verification>

<success_criteria>
- Every HTML surface governed by this template (canonical + drafted instance) now renders the cream M:OS Canonical Design System v1.1 palette, with the two terminal-island code blocks as the sole intentional dark exception (D-01) and the hero image border flipped to ink (D-02).
- The one real accessibility bug found in research (gold text failing WCAG AA at 2.13:1 on cream) is fixed everywhere gold was used as text outside the terminal islands, without breaking gold's still-compliant background-fill usages (8.76:1).
- email-template-standard.md stays reconciled with the canonical template via a targeted edit, not a rewrite.
- All structural/layout wins from 260723-ooq (panel shapes, headline sizing, hero placement, 640px width, LTR, no-border-radius, no-emoji, no-em-dash, 3+ mindrian-os.com links, sender-is-a-person, STEP 0 callout) are untouched.
- No Gmail draft was touched; the external memory file was not edited (only flagged as superseded in the SUMMARY).
</success_criteria>

<output>
Create `.planning/quick/260723-rln-retire-the-dark-canon-tester-challenge-e/260723-rln-SUMMARY.md` when done, recording: confirmation that all four files are re-skinned and verified, and an explicit note that `feedback_newsletter_story_challenge_playbook.md` Part B's DARK-canon rule is now superseded by this task -- flagged for the orchestrator to decide how to record that outside this repo (this plan does not and cannot edit that file).
</output>
