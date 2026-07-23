# Quick Task 260723-rln: Retire DARK-canon tester email, unify to cream M:OS - Research

**Researched:** 2026-07-23
**Domain:** HTML email re-skin (dark De Stijl -> cream M:OS Canonical Design System v1.1)
**Confidence:** HIGH (all hex values pulled verbatim from `mos-design-system.css`; contrast math computed directly)

## Summary

The current template (`references/design/newsletter-email-template.html`, its `.md` companion,
and the drafted content instance) is a self-consistent DARK-canon email: `#0D0D0D` body,
`#1A1A1A` card surfaces, `#F5F0E8` cream text, De Stijl primaries `#D40000`/`#0033A0`/`#FFD500`,
and a `#C8A43C` gold accent used for BOTH backgrounds (buttons, tabs) and text (links, logo,
command names). Re-skinning to the cream M:OS system is a direct hex substitution for the
Mondrian primaries and a text/surface polarity flip (light-on-dark -> dark-on-light) everywhere
EXCEPT the two locked terminal-island blocks (seed box, command chain), which keep a dark
background per CONTEXT.md.

The one non-trivial finding: `#C8A43C` gold, used today as a TEXT color (links, logo, command
names), **fails WCAG AA against the cream ground** (2.13:1, below the 4.5:1 body-text and even
the 3:1 large-text floor). It only stays usable as a BACKGROUND fill behind dark ink text
(button, challenge tab - already `ink-on-gold` in the current design, 8.76:1, unaffected by the
re-skin). Every gold TEXT usage must switch to M:OS `--blue` `#1E52E0` (the system's own semantic
link color, 5.62:1 on cream) or, for the one large-text logo mark, alternatively `--red` `#E11D22`
(4.27:1, passes 3:1 large-text floor but not body-text floor - blue is the safer universal
choice and is recommended for all of them).

The hero image (`dark-canon-confinement-hero.jpg`) already has a near-white/cream De Stijl-grid
background with red/yellow/blue color blocks - it will read cleanly against the new cream email
ground. It does NOT need regeneration. Its border needs to flip from cream-on-cream (currently
invisible against the new ground) to ink-on-cream, per the locked CONTEXT.md decision.

**Primary recommendation:** Apply the color-mapping table below as a literal find/replace of
hardcoded hex values across all three files, keep every structural element from today's earlier
redesign (260723-ooq) untouched, reuse the design system's own dark-terminal token (`#0c0c0d` /
`#e8e8e2`) for the two terminal-island blocks rather than inventing a new dark pairing, and flip
the hero image border from `#F5F0E8` to `#0C0C0D`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Code/command blocks stay dark (terminal-island treatment).** The challenge-seed Courier box
and the command-chain block KEEP a dark terminal-style treatment (dark background, gold/cream
monospace text) even inside the otherwise-cream email, matching the website's own established
De Stijl canon precedent: "Dark is reserved for terminal islands only" (website/CLAUDE.md). This
is not a full-dark email anymore, just these two code-shaped blocks staying dark as an
intentional terminal-island accent.

**Hero image.** Use judgment (deferred, "you decide"). The hero image already has a mostly
white/cream De Stijl-grid background itself, so it likely reads BETTER on a cream email ground
than it did on dark - probably just needs the frame/border color re-tuned (e.g. from
cream-on-dark border to an ink/black-on-cream border) rather than regenerating the image itself.
Confirm this holds visually during execution; regenerate only if the image genuinely does not
read well against the new cream ground.

### Claude's Discretion

- Exact M:OS canonical hex values to use (pull verbatim from
  `skills/ui-system/design-system/mos-design-system.css`, do not invent new ones).
- Exact panel/card re-skinning approach for the full-bleed Mondrian panels (STEP 0 callout,
  what's-new cards, triple-feature rail) - preserve the differentiated-shape structural win
  from the earlier same-day redesign (quick task 260723-ooq), just re-skin colors.
- Whether `email-template-standard.md` needs its Structure/Typography/Component-Pattern
  sections substantially rewritten or just its color-value rows updated.

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md `<specifics>` beyond scope notes (Gmail draft update is explicitly
the orchestrator's job, not this task's; editing the external memory file is explicitly not
possible from within this repo).
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Color token source of truth | Design system (`mos-design-system.css`) | - | Single canonical hex source; email hardcodes literal values from it (no CSS vars in email) |
| Email markup/structure | Static HTML artifact (`references/design/*.html`, `docs/testers/outbox/*.html`) | - | No server, no build step; inline styles only, hand-maintained |
| Documentation of the pattern | `email-template-standard.md` | - | Derived doc, kept in sync with the `.html`; `.html` wins on conflict |
| Hero image asset | External repo (`mindrian-website`, already deployed) | - | Out of scope for edits in this task; only the `<img>` border color changes, in the MindrianOS-Plugin repo's `.html` files |

## Standard Stack

Not applicable - this is a static hand-authored HTML email re-skin. No packages, no build
tooling, no dependencies to install. **Package Legitimacy Audit skipped** (no external packages
installed).

## Color Mapping Table (the core deliverable)

All "New" values are copied verbatim from `skills/ui-system/design-system/mos-design-system.css`
`:root` block (light/default theme, since email always renders in one fixed mode - email clients
do not reliably honor `prefers-color-scheme`, and the M:OS system's own default is cream/light).

### Ground + surfaces

| Old hex | Old role | New hex | New token | Where used in template |
|---------|----------|---------|-----------|------------------------|
| `#0D0D0D` | Body background, outer `<table>` wrapper | `#F4F2EC` | `--paper` | `<body style="background-color:#0D0D0D">`, outer `<table>` `background-color` (2 occurrences at top of file) |
| `#1A1A1A` | Card/surface bg (what's-new card 1 & 3, seed box, cmd-chain box) | `#FBFAF7` for card 1/3 (non-terminal); `#0C0C0D` for seed box + cmd-chain (terminal-island, see below) | `--panel` / terminal override | Card 1/3 `background-color:#1A1A1A`; seed box `background-color:#1A1A1A`; cmd-chain `background-color:#1A1A1A` |

### Text

| Old hex | Old role | New hex | New token | Notes |
|---------|----------|---------|-----------|-------|
| `#F5F0E8` (cream) | Primary text everywhere: headline, lede, card body text, logo "MINDRIAN", sign-off name | `#0C0C0D` | `--ink` | Applies wherever the surrounding bg is now light (paper/panel). Does NOT apply where the surrounding bg stays a saturated color panel (see "Full-bleed color panels" below) or a terminal-island block (stays light text on dark, see terminal section) |
| `#999999` (muted) | Secondary text: hero caption, byline "MindrianOS -" | `#5B5B5B` | `--muted` | Direct 1:1 swap, same role |

### De Stijl primaries (Mondrian bars, cap bands, highlight)

| Old hex | Old role | New hex | New token | AA note |
|---------|----------|---------|-----------|---------|
| `#D40000` | STEP 0 panel bg, top/bottom Mondrian bar segments, card-3 top-cap band, divider bar | `#E11D22` | `--red` | Decorative/panel bg only in this template - no body text sits directly on the thin bar segments. On the STEP 0 full-bleed panel, text MUST be light (`#F4F2EC` or `#fff`), not ink - see "Full-bleed color panels" below |
| `#0033A0` | Card-2 full-bleed panel, headline cap band, Mondrian bars, divider bar | `#1E52E0` | `--blue` | Same full-bleed-panel exception as red - card-2 body text must be light, not ink |
| `#FFD500` | Headline highlight span, card-1 top-cap band, Mondrian bars | `#FFC400` | `--yellow` | Headline highlight is TEXT color on the dark ink headline field (stays light-on-dark, unaffected - see headline exception below). Top-cap bands are 4px decorative strips, no text sits on them |
| `#111111` | Headline color-block field bg, triple-feature full-bleed panel bg, Mondrian bar accent squares | `#0C0C0D` | `--ink` | These two panels are the template's own pre-existing "black square" accents (Mondrian paintings use black grid blocks alongside primaries on white ground) - keeping them dark on a cream page is MORE authentically De Stijl than it was on the all-dark original. Text on both stays light (`#F4F2EC`), unchanged in polarity from today |

### Gold `#C8A43C` (needs to split by usage - the one non-mechanical finding)

| Old usage | Contrast on new cream `#F4F2EC` | Verdict | New treatment |
|-----------|----------------------------------|---------|----------------|
| Button bg (READ THE STORY), challenge tab bg - **dark ink text sits ON TOP of the gold** | Ink `#0C0C0D` on gold `#C8A43C` = 8.76:1 | PASSES easily | **No change needed.** Keep `#C8A43C` as the background fill; the button/tab already used dark text on gold (`#0D0D0D`, negligibly different from `--ink` `#0C0C0D`) |
| Logo "OS" mark (24px bold, sits on plain page bg) | Gold `#C8A43C` as text color on cream = 2.13:1 | FAILS both 3:1 (large text) and 4.5:1 (body) | Switch to `--blue` `#1E52E0` (5.62:1, passes both). `--red` `#E11D22` is a viable alternative for this specific large/bold case (4.27:1, passes 3:1 large-text floor only) if a brand-red accent is preferred to match the site's own `M<span style="color:red">:</span>OS` wordmark convention - blue is the safer default |
| Inline links (docs link "mindrian-os.com/docs", 3 blog links, sign-off "mindrian-os.com") | Same 2.13:1 - FAILS | Switch to `--blue` `#1E52E0` (5.62:1) - this is also M:OS's own semantic rule: "Blue = evidence / build / navigation" (SPEC.md law 2), links are literally blue's job |
| Command names in the command-chain terminal block (`/mos:new-project` etc, gold text on dark `#1A1A1A`) | Terminal-island block, stays dark bg | KEEP `#C8A43C` | This block keeps its dark bg per locked decision; gold-on-dark keeps working fine there (unrelated to the cream-ground contrast problem). See terminal section |

### Full-bleed color panels - text polarity exception

Three panels in this template are deliberate saturated-color full-bleed backgrounds (not neutral
card surfaces): the STEP 0 red panel, the what's-new card-2 blue panel, and (via the `#111111`
mapping above) the headline field + triple-feature panel. On a cream ground these stay dark/
saturated, so their text does **not** flip to ink - it stays light, matching M:OS's own verdict-
chip convention (`SPEC.md` / `M-OS-DESIGN-SYSTEM.md`: `.vd.dead{background:var(--red);color:#fff}`,
`.vd.build{background:var(--blue);color:#fff}`):

| Panel | New bg | Text color | Contrast |
|-------|--------|------------|----------|
| STEP 0 callout | `#E11D22` (red) | `#F4F2EC` (paper) or `#fff` | 4.77:1 (white), passes AA body |
| Card 2 (Windows reliability) | `#1E52E0` (blue) | `#F4F2EC` (paper) or `#fff` | 6.29:1 (white), passes AA comfortably |
| Headline field | `#0C0C0D` (ink) | `#F4F2EC` (paper) - unchanged from today's cream-on-black | already compliant, no change |
| Triple-feature rail | `#0C0C0D` (ink) | `#F4F2EC` (paper) - unchanged from today's cream-on-black | already compliant, no change |

Recommendation: use `#F4F2EC` (paper) rather than pure `#fff` for consistency with M:OS's "never
pure white" ground rule, even though it sits ON a colored panel rather than as the ground itself
- this keeps a single light value used throughout instead of introducing a second white.

### Cards 1 and 3 (top-cap band + neutral surface) - the mechanical case

These are NOT full-bleed color panels - they are neutral `#1A1A1A` surfaces with a thin 4px
color accent band. They follow the plain surface + text mapping, not the color-panel exception:

| Element | Old | New |
|---------|-----|-----|
| Card 1/3 surface bg | `#1A1A1A` | `#FBFAF7` (`--panel`) |
| Card 1/3 body text | `#F5F0E8` | `#0C0C0D` (`--ink`) |
| Card 1 top-cap band | `#FFD500` | `#FFC400` (`--yellow`, decorative strip, no text) |
| Card 3 top-cap band | `#D40000` | `#E11D22` (`--red`, decorative strip, no text) |

## Terminal-Island Treatment (locked decision - reuse the system's own precedent)

`mos-design-system.css` already defines a dark code-block token that is **deliberately
theme-independent** - it stays dark even when the page itself is in light/cream mode, which is
exactly the "terminal islands only" pattern this task is asked to reuse:

```css
pre.code{background:#0c0c0d;color:#e8e8e2;border:1px solid var(--edge);...}
:root[data-theme="light"] pre.code,@media (prefers-color-scheme:light){pre.code{background:#0c0c0d;color:#e8e8e2}}
pre.code .c{color:#8a8f98}   /* comment/muted annotation */
pre.code .p{color:#ffb454}   /* parameter/highlight - amber */
pre.code .s{color:#7ee787}   /* string - green */
```
Source: `skills/ui-system/design-system/mos-design-system.css` lines 82-84 [VERIFIED: codebase grep].

**Recommended mapping for the two terminal-island blocks (challenge-seed box, command chain):**

| Element | Old | New | Rationale |
|---------|-----|-----|-----------|
| Terminal block bg | `#1A1A1A` | `#0C0C0D` | Matches the system's `pre.code` background exactly (not a coincidence - `#0c0c0d` is the same literal hex as `--ink`, used here as a fixed dark bg regardless of page theme, exactly the established "terminal island" pattern) |
| Terminal body/gloss text | `#F5F0E8` | `#E8E8E2` | Matches `pre.code`'s text color almost exactly (negligibly cooler off-white vs the old warm cream) |
| Command names (gold, command-chain block) | `#C8A43C` | **Keep `#C8A43C`** | Already gold-on-dark, unaffected by the ground-color change; also already used elsewhere in this same email (button/tab bg) so keeping it avoids introducing a third gold hue. The system's own `.p` token (`#ffb454`) is a viable alternative if closer 1:1 token-matching is preferred, but is a materially different (more orange) hue - not recommended unless the planner wants strict token parity over visual continuity |
| Command gloss/explanation text (the muted annotation after each command) | `#F5F0E8` (same as command, undifferentiated) | `#8A8F98` | **Discretionary improvement, not required by CONTEXT.md.** Reuses the system's own `.c` (comment) semantic to visually separate "the command" (gold) from "what it does" (muted), rather than both being flat cream as today. Flag this as an optional quality upgrade for the planner to accept or skip - CONTEXT.md only locked "dark background, gold/cream monospace text," it did not require this differentiation |
| Seed box left border accent | `#C8A43C` (4px left border) | **Keep `#C8A43C`** | Structural/decorative border accent, not text - palette-independent per the locked decision's own framing ("gold/cream monospace text" describes the text treatment; the border is a structural continuation of the gold accent used throughout) |
| Terminal block border (optional) | none currently | Optional: `1px solid #111` (`--edge`) | `pre.code`'s own spec includes a border; the current template's terminal blocks do not have one. Adding one is a discretionary polish matching the system precedent, not required |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark terminal block on a light page | A new bespoke dark/gold pairing | The exact `#0c0c0d`/`#e8e8e2` pair already defined in `mos-design-system.css`'s `pre.code` | It is the system's own canonical "terminal island" token, deliberately made theme-independent for exactly this purpose - reusing it keeps this email consistent with every other M:OS HTML surface instead of inventing a fourth dark palette in the codebase |
| Link/text color that needs to work on cream | Guessing a darker gold by eye | `--blue` `#1E52E0` | It is both AA-compliant (5.62:1) AND semantically correct per M:OS law 2 ("Blue = evidence / build / navigation... never paint a label a primary for decoration") |

**Key insight:** every color decision in this re-skin reduces to "is this text sitting on a
light surface (paper/panel) or a saturated/dark panel (red/blue/ink)?" - light surface -> ink
text; saturated/dark panel -> light text. The only genuinely new judgment call is the gold split
(background-only use survives, text use does not), because gold was the one color in the old
palette used in both roles simultaneously.

## Hero Image Fit Check

Visually inspected `website/public/images/email/dark-canon-confinement-hero.jpg` (in the sibling
`mindrian-website` repo, path resolves to
`/home/jsagi/dev/mindrian-website/website/public/images/email/dark-canon-confinement-hero.jpg` -
NOT present anywhere under this repo) via the Read tool's image viewer.

**Assessment:** The image is a De Stijl-styled technical illustration of a tokamak reactor
cutaway on a near-white/cream ground, overlaid with a red/yellow/blue Mondrian grid pattern and
thin black construction lines. It already reads as a cream/paper-native asset - CONTEXT.md's
prediction is confirmed: **it reads better on the new cream ground than it did on the old
`#0D0D0D` dark body**, where it likely sat as a jarring bright-white rectangle against the black
page. **No regeneration needed.**

**Border fix required:** the current `<img>` border is `2px solid #F5F0E8` (cream-on-dark,
visible against the old black body). Against the new cream `#F4F2EC` body AND the image's own
near-white internal background, a cream border becomes **effectively invisible** - it would fail
to visually separate the image from the page at all. Fix: flip to `2px solid #0C0C0D` (ink),
consistent with the `.imgshow` component pattern already established in
`mos-design-system.css` (`border:1px solid var(--edge)`). Keep the 2px weight (bolder than the
system's 1px default) since the original spec intentionally used a heavier frame; only the hex
changes.

## Common Pitfalls

### Pitfall 1: Treating this as a pure find/replace without checking text polarity
**What goes wrong:** Naively swapping `#0D0D0D`->`#F4F2EC` and leaving `#F5F0E8` text unchanged
would produce near-invisible cream-on-cream text everywhere.
**Why it happens:** The old design has exactly one text color (`#F5F0E8`) used on every surface;
the new design needs at least two (`#0C0C0D` ink on light surfaces, `#F4F2EC` paper on dark/
saturated panels), so a single global hex swap is insufficient.
**How to avoid:** Use the per-surface tables above - map background first, then derive text
color from whether that background ended up light or dark/saturated.
**Warning signs:** Any body-copy `<div>` where the new background hex and new text hex are both
"light" (paper/panel/yellow) or both "dark" (ink/red/blue) is a contrast bug.

### Pitfall 2: Forgetting the gold split
**What goes wrong:** Leaving `#C8A43C` unchanged everywhere (since it "already exists in the
system's neighborhood") silently ships inaccessible link text (2.13:1, well under AA).
**Why it happens:** Gold is used for both backgrounds (compliant, keep) and text (non-compliant,
must change) in the same file - a single `grep -c "#C8A43C"` sweep for "did we touch gold" will
under-count the real issue.
**How to avoid:** Classify every `#C8A43C` occurrence by role (background-fill vs text-color)
before deciding whether to touch it. See the gold table above for the exact 8 occurrences and
their split verdicts.

### Pitfall 3: Applying the terminal-island dark treatment to the wrong element
**What goes wrong:** Accidentally re-skinning the seed box or command-chain block to the cream
palette (since they share the old `#1A1A1A` hex with cards 1/3, which DO get re-skinned to
cream).
**Why it happens:** Both "cards 1/3" and "the two terminal blocks" currently share the identical
`#1A1A1A` background hex, so a literal find/replace on `#1A1A1A` alone cannot distinguish them.
**How to avoid:** Locate by section number, not by hex - sections 9 (what's-new cards) go
cream/panel; sections 10-11 (challenge seed + command chain) stay dark/terminal. Cross-reference
against the "SECTION ORDER" comment block at the top of `newsletter-email-template.html`.

## What Does NOT Need to Change (palette-independent, leave untouched)

Confirmed structurally independent of color and must be preserved exactly as landed by today's
earlier redesign (260723-ooq):

- Panel shapes: full-bleed vs top-cap-band vs bordered-left differentiation across STEP 0/
  card-1/card-2/card-3/triple-feature (only their fill colors change, not their shape/technique)
- Headline sizing/weight: `font-size:38px;font-weight:900;letter-spacing:-0.01em;line-height:1.1`
- Hero image section placement (section 5, between lede and READ THE STORY button)
- 3+ `mindrian-os.com` link occurrences (currently 9 in the instantiated draft - unaffected by
  recoloring the link text)
- Sender-is-a-person convention (`Jonathan` / `Larry`, never "MindrianOS Team")
- No-emoji rule
- No-border-radius rule (hard rectangles - De Stijl law 3, unaffected by color)
- STEP 0 callout mandatory presence and copy structure
- `dir="ltr"` on the outer `<html>`/table + `text-align:left` on every content element (center
  only the Mondrian bars and button text)
- 640px fixed width, inline-styles-only, no `<style>` block, no web fonts (Impact/'Arial Black'/
  Helvetica/Arial/Courier/Consolas stack), no background images
- 14-row / 13-section structure and ordering
- 32px side padding throughout
- Mondrian bar segment WIDTHS (percentages) - only their fill colors change

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--blue` `#1E52E0` is the correct universal replacement for all gold TEXT usages (rather than `--red` for the logo specifically) | Gold split table | Low - both blue and red pass contrast for the large-text logo case; blue is recommended for consistency with link semantics, but a reasonable planner/executor could choose red for the logo mark without violating AA. Not a compliance risk, a stylistic judgment call flagged for visibility |
| A2 | Command gloss/annotation text should differentiate from command-name text using the system's muted `#8A8F98` token | Terminal-island section | Low - explicitly flagged as discretionary/optional, not a locked requirement. If skipped, gloss text can safely stay `#E8E8E2` (same as command text) without breaking any rule |
| A3 | Email clients render the M:OS system's default LIGHT/cream token values (not the `@media (prefers-color-scheme:dark)` override), since HTML email cannot rely on that media query firing consistently across clients (notably Outlook/older Gmail) | Color Mapping Table intro | Low-Medium - if a client DOES honor prefers-color-scheme and no explicit `color-scheme` meta/CSS is set, some email clients auto-dark-mode-invert inline colors unpredictably. This is a known general HTML-email risk independent of this task's re-skin choice, not something this task introduces or can fully solve within its scope |

**If this table is empty:** N/A - see above.

## Open Questions

1. **Should `email-template-standard.md`'s Structure/Typography/Component-Pattern sections be
   substantially rewritten, or just its color-value rows updated?**
   - What we know: CONTEXT.md left this to Claude's discretion. The `.md`'s Structure and
     Typography sections describe layout/font choices that are palette-independent (per the
     "what does NOT change" list above) - only the "De Stijl Color Palette" table and the
     hex-literals embedded in the "Component Patterns" code snippets actually reference colors.
   - What's unclear: whether the planner wants a full rewrite pass for polish or a minimal
     targeted edit.
   - Recommendation: minimal targeted edit - update the palette table's hex column, and update
     the hex literals inside the existing component-pattern code snippets (same technique as
     260723-ooq's prior reconciliation pass, which also did a targeted update rather than a
     rewrite). No structural rewrite needed since the underlying structure didn't change.

## Sources

### Primary (HIGH confidence)
- `skills/ui-system/design-system/mos-design-system.css` - full file read, exact hex values for
  every token (`--paper #F4F2EC`, `--panel #FBFAF7`, `--ink #0C0C0D`, `--muted #5B5B5B`,
  `--red #E11D22`, `--blue #1E52E0`, `--yellow #FFC400`, `--green #12A06A` [unused in this
  email], `--edge #111`, `pre.code` terminal token `#0c0c0d`/`#e8e8e2`/`.c #8a8f98`/`.p #ffb454`)
- `skills/ui-system/design-system/SPEC.md` and `M-OS-DESIGN-SYSTEM.md` - confirmed the semantic
  color laws (blue=nav/links, red=danger, ink-on-yellow/green never white, never pure white
  ground) and the verdict-chip white-on-blue/red convention used to derive the full-bleed panel
  text-polarity rule
- `references/design/newsletter-email-template.html` - full read, every current hex occurrence
  catalogued by section
- `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html` - confirmed the
  instantiated draft uses the identical hex set as the template (no divergence)
- Direct visual inspection of
  `website/public/images/email/dark-canon-confinement-hero.jpg` (read via image tool, resolved
  in the sibling `mindrian-website` repo, not present in this repo)
- WCAG 2.1 relative-luminance contrast ratios computed directly (sRGB->linear->relative
  luminance->contrast formula) for every color pairing flagged above, not estimated

### Secondary (MEDIUM confidence)
- None - no WebSearch was needed for this task; all facts were verifiable directly from the
  repo's own canonical files.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Color token values: HIGH - read verbatim from the canonical CSS source, no interpretation
- Contrast/AA verdicts: HIGH - computed directly via the WCAG formula, not asserted from memory
- Terminal-island token reuse: HIGH - the exact `pre.code` rule exists in the same file and is
  explicitly documented as theme-independent
- Hero image fit: HIGH - direct visual inspection performed, not inferred from CONTEXT.md's
  prediction alone
- Gold-split recommendation (blue vs red for the logo) and gloss-text differentiation: MEDIUM -
  both are defensible stylistic calls flagged explicitly as discretionary in the Assumptions Log

**Research date:** 2026-07-23
**Valid until:** No expiry concern - this is a static internal design-token reference, not a
fast-moving external dependency. Valid as long as `mos-design-system.css` v1.1 remains
canonical.
