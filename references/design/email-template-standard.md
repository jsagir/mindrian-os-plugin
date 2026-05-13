# MindrianOS Official Email Template Standard

## Brand Name Rules (MANDATORY)

- **Correct:** MindrianOS (capital M, lowercase indrian, capital OS, NO hyphen)
- **Wrong:** MindianOS, Mindrian-OS, MINDRIANOS, mindrianos, Mindrian OS, MindRianOS
- **In headers/banners:** MINDRIANOS (all caps) is acceptable ONLY in De Stijl header blocks
- **In body text:** Always MindrianOS

## Layout Rules (MANDATORY)

### Direction and Alignment
- `dir="ltr"` on the outer wrapper table
- `text-align:left` on EVERY td, p, and content element
- No centered body text. Only center: footer Mondrian bar, footer credits, CTA buttons
- Fixed width: 600px outer table

### Structure
```
1. Mondrian Header (red block + blue block + accent bars)
2. Personal Message (left-aligned, from a person)
3. Content Sections (left-aligned, with accent borders)
4. Install Steps (if applicable, numbered with blue squares)
5. CTA Button (blue block, centered text only)
6. Footer (Mondrian mini-bar, credits, centered)
```

### De Stijl Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Background | #0a0a0f | Body, outer wrapper |
| Surface | #12121a | Code blocks, cards, sections |
| Border | #1e1e2e | Dividers, separators |
| Cream | #f5f0e8 | Primary text, headings |
| Muted | #a09a90 | Secondary text, descriptions |
| Dim | #666666 | Tertiary text, fine print |
| Red | #a63d2f | Header block, warnings, critiques |
| Blue | #1e3a6e | Header block, step numbers, links accent |
| Yellow | #c4a43c | Accent borders, warnings, API keys |
| Green | #2d6b4a | Success, shipped features, confirmations |
| Link Blue | #60a5fa | Hyperlinks, code references |
| Code Green | #22c55e | Terminal commands in code blocks |
| Amethyst | #6366f1 | Optional accent (updates, versions) |

### Typography (email-safe)
| Element | Font | Size | Color | Style |
|---------|------|------|-------|-------|
| Header brand | Trebuchet MS, Helvetica, sans-serif | 28-32px | #f5f0e8 | 900 weight, 4px letter-spacing, uppercase |
| Section heading | Trebuchet MS, Helvetica, sans-serif | 18-20px | #f5f0e8 | 900 weight, 3px letter-spacing, uppercase |
| Sub-heading | Trebuchet MS, Helvetica, sans-serif | 12-14px | #a09a90 | 900 weight, 2px letter-spacing, uppercase |
| Body text | Arial, Helvetica, sans-serif | 13-15px | #a09a90 | Normal, 1.7-1.8 line-height |
| Emphasis text | Arial, Helvetica, sans-serif | 13-15px | #f5f0e8 | Bold |
| Code inline | Courier New, monospace | 12-14px | #60a5fa | On #12121a background |
| Code block | Courier New, monospace | 13-15px | #22c55e | On #12121a background, 10-14px padding |
| Fine print | Arial, Helvetica, sans-serif | 10-11px | #444444 or #666666 | Normal |

### Component Patterns

#### Mondrian Header
```html
<table width="600"><tr>
  <td width="400" style="background:#a63d2f;padding:24px 28px;">
    <p style="...font-size:28px;...uppercase;color:#f5f0e8;">MINDRIANOS</p>
  </td>
  <td width="200" style="background:#1e3a6e;padding:24px 20px;">
    <p style="...font-size:10px;...color:#a09a90;">VERSION / CONTEXT</p>
  </td>
</tr></table>
<table width="600"><tr>
  <td width="400" style="background:#c4a43c;height:5px;">&nbsp;</td>
  <td width="200" style="background:#2d6b4a;height:5px;">&nbsp;</td>
</tr></table>
```

#### Accent Border Card (left border)
```html
<table width="100%"><tr>
  <td width="3" style="background:#a63d2f;">&nbsp;</td>
  <td style="background:#12121a;padding:16px 20px;text-align:left;">
    CONTENT
  </td>
</tr></table>
```
Colors: #a63d2f (red/warning), #1e3a6e (blue/info), #c4a43c (yellow/highlight), #2d6b4a (green/success)

#### Step Number
```html
<div style="width:28px;height:28px;background:#1e3a6e;text-align:center;line-height:28px;
  font-family:'Trebuchet MS',sans-serif;font-size:14px;font-weight:900;color:#f5f0e8;">1</div>
```

#### Code Block
```html
<table width="100%"><tr>
  <td style="background:#12121a;padding:10px 14px;text-align:left;">
    <code style="font-family:'Courier New',monospace;font-size:13px;color:#22c55e;">command here</code>
  </td>
</tr></table>
```

#### API Key / Highlight Box
```html
<table width="100%"><tr>
  <td width="3" style="background:#c4a43c;">&nbsp;</td>
  <td style="background:#12121a;padding:14px 16px;text-align:left;">
    <code style="font-family:'Courier New',monospace;font-size:15px;color:#60a5fa;">key-here</code>
  </td>
</tr></table>
```

#### CTA Button
```html
<table width="100%"><tr>
  <td style="background:#1e3a6e;padding:14px 20px;text-align:center;">
    <a href="URL" style="font-family:'Trebuchet MS',sans-serif;font-size:14px;font-weight:900;
      letter-spacing:2px;text-transform:uppercase;color:#f5f0e8;text-decoration:none;">LABEL</a>
  </td>
</tr></table>
```

#### Bullet List (Mondrian colored squares)
```html
<table cellpadding="0" cellspacing="0"><tr>
  <td width="6" style="background:#a63d2f;">&nbsp;</td>
  <td style="padding:0 0 0 10px;font-family:Arial,sans-serif;font-size:12px;color:#a09a90;text-align:left;">
    Content here
  </td>
</tr></table>
```
Rotate colors: #a63d2f, #1e3a6e, #c4a43c, #2d6b4a

#### Footer
```html
<table cellpadding="0" cellspacing="0" align="center"><tr>
  <td width="36" style="background:#a63d2f;height:3px;">&nbsp;</td>
  <td width="24" style="background:#1e3a6e;height:3px;">&nbsp;</td>
  <td width="16" style="background:#c4a43c;height:3px;">&nbsp;</td>
  <td width="16" style="background:#2d6b4a;height:3px;">&nbsp;</td>
</tr></table>
<p style="...font-size:11px;color:#a09a90;">Sender Name</p>
<p style="...font-size:10px;color:#444;">MindrianOS -- PWS Methodology by Prof. Lawrence Aronhime</p>
```

## Rules

1. **NO border-radius anywhere.** Hard rectangles only. De Stijl.
2. **NO emoji.** Ever.
3. **NO rounded buttons.** Square CTA blocks.
4. **NO background images.** Solid colors only.
5. **NO web fonts.** Email-safe only (Trebuchet MS, Arial, Courier New).
6. **ALL text left-aligned** except footer credits and CTA button text.
7. **ALL tables use inline styles.** No external CSS (email clients strip it).
8. **600px max width.** Fixed, not responsive (email clients handle poorly).
9. **Padding: 28px sides.** Consistent throughout.
10. **Sender is always a person** (Jonathan Sagir, Larry, etc.) -- never "MindrianOS Team."
