# MindrianOS Official Email Template Standard

> **Canonical source:** `references/design/newsletter-email-template.html` is the
> canonical, authoritative source for the DARK tester-challenge email canon. This
> document is the derived component-pattern reference, kept in sync with it. If this
> doc and the template ever disagree, the template wins - update this doc to match,
> never the reverse.

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
| Background | #0D0D0D | Body, outer wrapper |
| Surface | #1A1A1A | Code blocks, cards, what's-new card 1/3 backgrounds |
| Cream | #F5F0E8 | Primary text, headings, hero-image border |
| Muted | #999999 | Secondary text, sign-off byline |
| Red | #D40000 | STEP 0 panel, top/bottom Mondrian bars, what's-new card 3 top-cap |
| Blue | #0033A0 | What's-new card 2 full-bleed panel, headline cap band, Mondrian bars |
| Yellow | #FFD500 | Headline highlight, what's-new card 1 top-cap, Mondrian bars |
| Gold/OS | #C8A43C | Logo "OS" mark, links, code accents, challenge tab, command-chain gold text |
| Black | #111111 | Headline color-block field, triple-feature full-bleed panel, Mondrian bar accents |

### Typography (email-safe)
| Element | Font | Size | Color | Style |
|---------|------|------|-------|-------|
| Logo/brand | Impact, 'Arial Black', Arial, sans-serif | 24px | #F5F0E8 (OS in #C8A43C) | 2px letter-spacing |
| Headline | Impact, 'Arial Black', Arial, sans-serif | 38px | #F5F0E8 (highlight #FFD500) | font-weight:900, letter-spacing:-0.01em (bold-Arial-aware) |
| Section heading | Impact, 'Arial Black', Arial, sans-serif | 16-20px | #F5F0E8 | Left-aligned, no letter-spacing override needed |
| Body text | Helvetica, Arial, sans-serif | 14-16px | #F5F0E8 | Normal, 1.6-1.65 line-height |
| Muted/byline text | Helvetica, Arial, sans-serif | 12px | #999999 | Normal |
| Code / seed prompt | Courier, Consolas, monospace | 12-13px | #F5F0E8 or #C8A43C | On #1A1A1A background |

### Component Patterns

#### Top/Bottom Mondrian Bar
```html
<table width="100%"><tr>
  <td width="38%" height="10" style="background-color:#D40000;font-size:1px;">&nbsp;</td>
  <td width="8%" height="10" style="background-color:#111111;font-size:1px;">&nbsp;</td>
  <td width="22%" height="10" style="background-color:#FFD500;font-size:1px;">&nbsp;</td>
  <td width="6%" height="10" style="background-color:#111111;font-size:1px;">&nbsp;</td>
  <td width="26%" height="10" style="background-color:#0033A0;font-size:1px;">&nbsp;</td>
</tr></table>
```

#### Full-Bleed Alert Panel (STEP 0 callout)
```html
<table width="100%" style="background-color:#D40000;"><tr>
  <td style="padding:18px 20px;text-align:left;">
    <div style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:18px;color:#F5F0E8;">TITLE</div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#F5F0E8;padding-top:8px;">Body copy directly on the red field.</div>
  </td>
</tr></table>
```
Cream text sits directly on the color field - this is a genuine full-bleed panel, not a rail on a dark card.

#### Top-Cap Band Card (what's-new cards 1 and 3)
```html
<table width="100%"><tr><td height="4" style="background-color:#FFD500;font-size:1px;">&nbsp;</td></tr></table>
<table width="100%" style="background-color:#1A1A1A;"><tr>
  <td style="padding:16px 20px;text-align:left;">CONTENT</td>
</tr></table>
```
Rotate the top-cap color: #FFD500 (card 1), #D40000 (card 3).

#### Full-Bleed Color Panel (what's-new card 2, triple-feature rail)
```html
<table width="100%" style="background-color:#0033A0;"><tr>
  <td style="padding:16px 20px;text-align:left;">CONTENT, cream text directly on the color field</td>
</tr></table>
```

#### Gold Tab / Flag (challenge section header)
```html
<table cellpadding="0" cellspacing="0"><tr>
  <td style="background-color:#C8A43C;padding:4px 10px;">
    <div style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#0D0D0D;">LABEL</div>
  </td>
</tr></table>
```

#### Seed / Code Box (gold left-border, Courier)
```html
<table width="100%"><tr>
  <td style="background-color:#1A1A1A;border-left:4px solid #C8A43C;padding:18px 20px;text-align:left;">
    <div style="font-family:Courier,Consolas,monospace;font-size:12px;color:#F5F0E8;">CONTENT</div>
  </td>
</tr></table>
```

#### Hero Image
```html
<img src="{{HERO_IMAGE_URL}}" alt="{{HERO_IMAGE_ALT}}" width="576"
  style="display:block;width:100%;max-width:576px;border:2px solid #F5F0E8;">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#999999;padding-top:8px;">{{HERO_IMAGE_CAPTION}}</div>
```
Src MUST be a real public HTTPS URL - local paths and `data:` URIs are stripped or blocked
by major email clients (Gmail, Outlook).

#### CTA Button (READ THE STORY)
```html
<table cellpadding="0" cellspacing="0"><tr>
  <td style="background-color:#C8A43C;padding:13px 26px;text-align:left;">
    <a href="URL" style="font-family:Impact,'Arial Black',Arial,sans-serif;font-size:16px;letter-spacing:1px;color:#0D0D0D;text-decoration:none;">READ THE STORY</a>
  </td>
</tr></table>
```

#### Footer / Sign-off
```html
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#F5F0E8;">
  SENDER NAME<br>
  <span style="color:#999999;">MindrianOS - <a href="https://mindrian-os.com" style="color:#C8A43C;text-decoration:underline;">mindrian-os.com</a></span>
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
