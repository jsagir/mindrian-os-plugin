---
type: fix-summary
phase: 260723-rln-retire-the-dark-canon-tester-challenge-e
fixed: 2026-07-23
review: 260723-rln-REVIEW.md
findings_fixed: [CR-01, CR-02]
findings_deferred: [WR-01, WR-02, IN-01, IN-02]
---

# Fix Summary: 260723-rln code review BLOCKERs

Fixes the 2 confirmed BLOCKER findings from `260723-rln-REVIEW.md`. WR-01, WR-02,
IN-01, and IN-02 were left open per the fix task's explicit scope constraint (not
trivial to bundle, not requested).

## CR-01: Blue link text (#1E52E0) fails WCAG AA against dark #0C0C0D panels

**Root cause:** The blanket "gold text -> blue #1E52E0" re-skin rule was applied to
every text usage of gold, including two link locations that still sit on the dark
`#0C0C0D` terminal-island / full-bleed-ink backgrounds instead of the new cream
page ground. The 5.62:1 pass figure documented in the template's own header comment
was only ever computed against the cream background (`#F4F2EC`), not against
`#0C0C0D`.

**Fix:** Changed the two affected link/text colors from `#1E52E0` to the
terminal-text token `#E8E8E2` (the token already proven correct for surrounding
text in the same dark panels), keeping `text-decoration:underline`. Left every
other `#1E52E0` usage untouched after individually confirming each remaining
instance sits on the cream `#F4F2EC` page background (logo "OS" mark, Mondrian
bars, card-2 full-bleed blue panel background, sign-off link) where blue is the
correct AA-passing pairing.

**Files changed:**
- `references/design/newsletter-email-template.html`
  - Line 227 (was line 227 pre-edit): command-chain docs link `<a>` color
    `#1E52E0` -> `#E8E8E2`.
  - Line ~245 (placeholder): `{{TRIPLE_FEATURE_BODY_with_3_blog_links_color_#1E52E0}}`
    -> `{{TRIPLE_FEATURE_BODY_with_3_blog_links_color_#E8E8E2}}` (placeholder
    documentation token, keeps future editors from reintroducing the bug).
  - Updated the two explanatory HTML comments directly above sections 11 and 12
    (command chain, triple-feature panel) to state the correct token and cite the
    computed contrast ratios, so the template's own documentation no longer
    instructs future editors toward the failing color.
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html`
  - Line 164: command-chain docs link `<a>` color `#1E52E0` -> `#E8E8E2`.
  - Line 177: all three triple-feature blog links `<a>` color `#1E52E0` ->
    `#E8E8E2` (reverse-salient link, dominant-design link, ambulance link).

**Recomputed contrast ratios (WCAG relative-luminance formula, verified by hand):**

| Pairing | Before | After |
|---|---|---|
| `#1E52E0` text on `#0C0C0D` bg (command-chain docs link, triple-feature links) | **3.11:1 - FAILS AA** (needs 4.5:1) | n/a (color changed) |
| `#E8E8E2` text on `#0C0C0D` bg (same locations, new color) | n/a | **15.9:1 - PASSES AA and AAA** |

Computation: L(`#E8E8E2`) ≈ 0.80375, L(`#0C0C0D`) ≈ 0.00370. Contrast =
(0.80375 + 0.05) / (0.00370 + 0.05) = 0.85375 / 0.05370 ≈ **15.9:1**. This matches
and confirms the review's own figure for the terminal-text token, and is now the
actual color applied at the two previously-failing locations.

Links genuinely on the cream `#F4F2EC` page background (sign-off link, logo OS
mark) were left as `#1E52E0` and were not recomputed since the review already
verified that pairing (~5.6:1) passes AA and this fix task did not touch them.

## CR-02: Outbox `.md` self-contradicts on whether a real Gmail draft exists

**Root cause:** The frontmatter (`status: drafted`, `gmail_draft_id:
"r-1370266653870026168"`) and `style_deviations` bullet 3 were updated when the
real Gmail draft was filed later in the session, but the body's `## No Gmail
draft` section was written earlier in the session (before the draft existed) and
was never revisited, leaving it asserting the opposite of what the frontmatter
now states.

**Fix:** Renamed the section from `## No Gmail draft` to `## Gmail draft status`
and rewrote the body to match the frontmatter and the already-correct
`style_deviations` bullet 3: a real Gmail draft exists (id
`r-1370266653870026168`), To is the sender only, the real 42-recipient BCC list
was populated live inside the `create_draft` call and never written to any
tracked file, and the draft is NOT sent - a final founder go/no-go is still
required before pressing Send.

Also fixed the same stale claim ("no Gmail draft was created for this instance")
in the sibling `.html` file's own top-of-file header comment, since it asserted
the identical now-false claim and was already in scope for the CR-01 edit to that
file. Updated it to state the real draft ID, the BCC-population detail, and the
still-required founder go/no-go, pointing back at the `.md`'s corrected section
as the source of truth.

**Files changed:**
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md`
  - `## No Gmail draft` -> `## Gmail draft status`, body rewritten to state the
    draft exists and match frontmatter.
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html`
  - Top header comment's stale "no Gmail draft was created for this instance"
    line corrected to reflect the real filed draft, consistent with the `.md`.

No Gmail MCP tool was called during this fix task. The live Gmail draft itself
was not touched.

## Deferred (not fixed, per fix task scope)

- **WR-01** (STEP 0 red-panel cream text ~4.26:1, just under AA): pre-existing,
  not introduced by 260723-rln, not trivial to bundle (requires a hex color
  decision + re-verification). Still open.
- **WR-02** (`email-template-standard.md` mislabels command-chain gloss text as
  "cream"): doc-only wording drift in a file not touched by this fix task. Still
  open.
- **IN-01** (palette table in `email-template-standard.md` doesn't flag the
  dark-context exception for the docs-link blue): follow-on documentation task
  once CR-01's fix is confirmed; not touched here since it targets a file outside
  this fix task's explicit scope. Still open.
- **IN-02** (stale "DARK-canon template" framing in `style_deviations` bullet 6):
  cosmetic wording, not touched. Still open.

## Verification

- Grepped both HTML files for remaining `#1E52E0` usages after the fix; confirmed
  every remaining instance sits on the cream `#F4F2EC` page background (Mondrian
  bars, logo mark, card-2 full-bleed blue panel, sign-off link), not on
  `#0C0C0D`.
- Grepped the `.md` and `.html` for any leftover "no Gmail draft" / "no Gmail MCP
  tool" contradictory language; none remains.
- Grepped all three edited files for em-dash characters; none found.
