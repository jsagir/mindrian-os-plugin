# MindrianOS Official Email Template Standard

> **Canonical source:** `references/design/newsletter-email-template.html` is the
> canonical, authoritative source for the cream M:OS Canonical Design System v1.1
> tester-challenge email canon (re-skinned 2026-07-23, quick task 260723-rln, from
> the retired DARK canon). This document is the derived component-pattern reference,
> kept in sync with it. If this doc and the template ever disagree, the template
> wins - update this doc to match, never the reverse.

## Brand Name Rules (MANDATORY)

- **Correct:** MindrianOS (capital M, lowercase indrian, capital OS, NO hyphen)
- **Wrong:** MindianOS, Mindrian-OS, MINDRIANOS, mindrianos, Mindrian OS, MindRianOS
- **In headers/banners:** MINDRIANOS (all caps) is acceptable ONLY in De Stijl header blocks
- **In body text:** Always MindrianOS

## Layout Rules (MANDATORY)

### Direction and Alignment
- `dir="ltr"` on the outer wrapper table
- `text-align:left` on EVERY td, p, and content element
- No centered body text. Only center: top/bottom Mondrian bars, the gold READ-THE-STORY button text
- Fixed width: 640px outer table

### Structure
```
1. Top Mondrian bar (full-width colored strips)
2. Logo row (left-aligned, from a person)
3. Headline (color-block treatment, one yellow highlight)
4. Lede (Feynman, the why)
5. Hero image (hard-rectangle cream border + caption)
6. READ THE STORY button (gold block, centered text only)
7. STEP 0 update callout (full-bleed red panel)
8. What's-new cards (full-bleed panels / top-cap bands, differentiated)
9. Challenge + copy-paste seed (gold tab header + Courier gold-left-border box)
10. Command chain (gold cmd + cream gloss + docs link)
11. Triple-feature related links (full-bleed black panel, red/yellow/blue top+bottom strips)
12. Reply CTA + sign-off (person + website)
13. Bottom Mondrian bar (mirror of top)
```

### De Stijl Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Paper | #F4F2EC | Body, outer wrapper (cream ground) |
| Panel | #FBFAF7 | What's-new card 1/3 backgrounds (light surface) |
| Ink | #0C0C0D | Primary text, headings, hero-image border, headline field/triple-feature panel bg (full-bleed dark panels keep their polarity) |
| Muted | #5B5B5B | Secondary text, sign-off byline |
| Red | #E11D22 | STEP 0 panel, top/bottom Mondrian bars, what's-new card 3 top-cap |
| Blue | #1E52E0 | What's-new card 2 full-bleed panel, headline cap band, Mondrian bars, all non-terminal link text (logo OS mark, docs link, sign-off link) |
| Yellow | #FFC400 | Headline highlight, what's-new card 1 top-cap, Mondrian bars |
| Gold/OS | #C8A43C | RESTRICTED role: background fills only (READ THE STORY button, CHALLENGE tab, 8.76:1 AA-pass) plus text ONLY inside the two locked terminal-island blocks (command-chain command names, seed-box border accent) - no longer a general-purpose text color (fails AA at 2.13:1 on cream) |
| Terminal text | #E8E8E2 | Body/gloss text inside the two terminal-island blocks only (matches `pre.code`'s own text token) |

Terminal-island exception (D-01, locked): the challenge-seed Courier box and the
command-chain table are the sole two blocks that keep the old dark `#0C0C0D`
background - everywhere else re-skins to the cream ground above.

### Typography (email-safe)
| Element | Font | Size | Color | Style |
|---------|------|------|-------|-------|
| Logo/brand | Impact, 'Arial Black', Arial, sans-serif | 24px | #0C0C0D (OS in #1E52E0) | 2px letter-spacing |
| Headline | Impact, 'Arial Black', Arial, sans-serif | 38px | #F4F2EC (highlight #FFC400) | font-weight:900, letter-spacing:-0.01em (bold-Arial-aware); sits on the still-dark #0C0C0D full-bleed headline field, light text unchanged |
| Section heading | Impact, 'Arial Black', Arial, sans-serif | 16-20px | #0C0C0D | Left-aligned, no letter-spacing override needed |
| Body text | Helvetica, Arial, sans-serif | 14-16px | #0C0C0D (on cream/panel surfaces) or #F4F2EC (on full-bleed dark panels) | Normal, 1.6-1.65 line-height |
| Muted/byline text | Helvetica, Arial, sans-serif | 12px | #5B5B5B | Normal |
| Code / seed prompt | Courier, Consolas, monospace | 12-13px | #E8E8E2 body text, #C8A43C command names | On #0C0C0D terminal-island background (D-01, locked dark exception) |

### Component Patterns

#### Top/Bottom Mondrian Bar
```html
<table width="100%"><tr>
  <td width="38%" height="10" style="background-color:#E11D22;font-size:1px;">&nbsp;</td>
  <td width="8%" height="10" style="background-color:#0C0C0D;font-size:1px;">&nbsp;</td>
  <td width="22%" height="10" style="background-color:#FFC400;font-size:1px;">&nbsp;</td>
  <td width="6%" height="10" style="background-color:#0C0C0D;font-size:1px;">&nbsp;</td>
  <td width="26%" height="10" style="background-color:#1E52E0;font-size:1px;">&nbsp;</td>
</tr></table>
```

#### Full-Bleed Alert Panel (STEP 0 callout)
```html
<table width="100%" style="background-color:#E11D22;"><tr>
  <td style="padding:18px 20px;text-align:left;">
    <div style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:18px;color:#F4F2EC;">TITLE</div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#F4F2EC;padding-top:8px;">Body copy directly on the red field.</div>
  </td>
</tr></table>
```
Paper text sits directly on the color field - this is a genuine full-bleed panel, not a rail on a dark card. It keeps its dark/saturated polarity even on the cream page (De Stijl full-bleed accent), so text stays light.

#### Top-Cap Band Card (what's-new cards 1 and 3)
```html
<table width="100%"><tr><td height="4" style="background-color:#FFC400;font-size:1px;">&nbsp;</td></tr></table>
<table width="100%" style="background-color:#FBFAF7;"><tr>
  <td style="padding:16px 20px;text-align:left;">CONTENT</td>
</tr></table>
```
Rotate the top-cap color: #FFC400 (card 1), #E11D22 (card 3). Card surface is now the light panel #FBFAF7.

#### Full-Bleed Color Panel (what's-new card 2, triple-feature rail)
```html
<table width="100%" style="background-color:#1E52E0;"><tr>
  <td style="padding:16px 20px;text-align:left;">CONTENT, paper text directly on the color field</td>
</tr></table>
```

#### Gold Tab / Flag (challenge section header)
```html
<table cellpadding="0" cellspacing="0"><tr>
  <td style="background-color:#C8A43C;padding:4px 10px;">
    <div style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#0C0C0D;">LABEL</div>
  </td>
</tr></table>
```
Gold stays as a background fill with dark ink text on top (8.76:1, passes AA easily) - the one restricted, still-sanctioned use of gold.

#### Seed / Code Box (gold left-border, Courier) - locked terminal-island block (D-01)
```html
<table width="100%"><tr>
  <td style="background-color:#0C0C0D;border-left:4px solid #C8A43C;padding:18px 20px;text-align:left;">
    <div style="font-family:Courier,Consolas,monospace;font-size:12px;color:#E8E8E2;">CONTENT</div>
  </td>
</tr></table>
```
This block intentionally keeps its dark `#0C0C0D` background and `#E8E8E2` terminal text token - it does NOT re-skin to cream (D-01, matches the website's own terminal-island precedent).

#### Hero Image
```html
<img src="{{HERO_IMAGE_URL}}" alt="{{HERO_IMAGE_ALT}}" width="576" height="324"
  style="display:block;width:100%;max-width:576px;border:2px solid #0C0C0D;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#5B5B5B;padding-top:8px;">{{HERO_IMAGE_CAPTION}}</div>
```
Src MUST be a real public HTTPS URL - local paths and `data:` URIs are stripped or blocked
by major email clients (Gmail, Outlook). Border is ink `#0C0C0D` against the cream page (D-02); the image asset itself is untouched by the re-skin.

#### CTA Button (READ THE STORY)
```html
<table cellpadding="0" cellspacing="0"><tr>
  <td style="background-color:#C8A43C;padding:13px 26px;text-align:left;">
    <a href="URL" style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:16px;letter-spacing:1px;color:#0C0C0D;text-decoration:none;">READ THE STORY</a>
  </td>
</tr></table>
```

#### Footer / Sign-off
```html
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0C0C0D;">
  SENDER NAME<br>
  <span style="color:#5B5B5B;">MindrianOS - <a href="https://mindrian-os.com" style="color:#1E52E0;text-decoration:underline;">mindrian-os.com</a></span>
</div>
```

## Rules

1. **NO border-radius anywhere.** Hard rectangles only. De Stijl.
2. **NO emoji.** Ever.
3. **NO rounded buttons.** Square CTA blocks.
4. **NO background images.** Solid colors only (hero photo is the one sanctioned `<img>` exception, always a real public HTTPS URL).
5. **NO web fonts.** Email-safe only: Impact, 'Arial Black', Helvetica, Arial, Courier, Consolas.
6. **ALL text left-aligned** except the top/bottom Mondrian bars and the READ THE STORY button text.
7. **ALL tables use inline styles.** No external CSS, no `<style>` block (email clients strip it).
8. **640px max width.** Fixed, not responsive (email clients handle poorly).
9. **Padding: 32px sides.** Consistent throughout.
10. **Sender is always a person** (Jonathan Sagir, Larry, etc.) - never "MindrianOS Team."
11. **NO em-dashes.** Hyphens only.
