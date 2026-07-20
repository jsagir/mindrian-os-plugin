# MindrianOS Canonical Design System v1.0
### De Stijl x Swiss Broadside - the house language for any artifact + Vercel

**Ratio:** 75% Swiss International Typographic Style (grid, grotesk display, air) +
25% De Stijl (Mondrian primaries carrying fixed meaning on warm off-white).
**Prime directive:** color is semantic, never decorative.

Live styleguide: `index.html` (self-contained, theme-aware, Artifact-safe).
Foundation CSS: `tokens.css`. Image recipe: `image-prompt-style.md`.

## Five laws
1. **Ratio** - 75/25. When in doubt, remove color and add air.
2. **Semantic color** - Red=kill/danger/trap, Blue=evidence/build/navigation, Green=go/opportunity/fit, Yellow=moonshot/prime/highlight. Never paint a label a primary for decoration.
3. **Flat + rectilinear** - no gradients, no border-radius (max 2px), no soft blur shadows. Only hard offset shadows (`8px 8px 0`, `18px 18px 0`) and flat planes.
4. **Hairline structure** - module lines are faked with `gap:1px` over a `--rule` background; cells are `--panel`. Structure is visible, not implied.
5. **Restrained motion** - draw-in once then rest; infinite pulse only on ONE focal node; always honor `prefers-reduced-motion`.

## Color tokens (meaning fixed; value flips per theme)
| Token | Light | Dark | Job |
|---|---|---|---|
| --paper | #F4F2EC | #0B0B0D | ground (never pure white) |
| --ink | #0C0C0D | #F3F2EE | text, structure, founder |
| --muted | #5B5B5B | #9a9a9e | secondary text |
| --panel | #FBFAF7 | #141417 | raised surfaces |
| --red | #E11D22 | #E11D22 | kill / danger / trap |
| --blue | #1E52E0 | **#6D9BFF** | evidence / build / nav |
| --green | #12A06A | #12A06A | go / opportunity / fit |
| --yellow | #FFC400 | #FFC400 | moonshot / prime / highlight |
| --edge | #111 | rgba(243,242,238,.34) | card/chip borders |
| --rule | 14% ink | 16% ink | hairlines, dividers |

**Non-negotiables:** blue MUST retune to `#6D9BFF` in dark (fails AA otherwise); green/yellow chips use **ink text, not white**; borders use `--edge` (softens in dark) not `--hair`.

## Typography (one grotesk)
- display: 800, clamp(2.6rem,9vw,7rem), tracking **-.045em**
- h2: 800, clamp(1.6rem,4vw,2.7rem), **-.02em**
- kicker numeral: 800, clamp(2.2rem,6vw,4.2rem)
- lede: muted, clamp(1rem,1.7vw,1.24rem)
- micro-label: 800, 12px, UPPER, tracking **.26em**
- body: 400, 17px, **tabular numerals** always (`font-feature-settings:"tnum" 1`)
- Tracking scale: eyebrow .32em / kicker-label .26em / pills .14em / nav .14em.

## Grid & devices
- Container `--maxw` 1180px, gutters clamp(18px,4vw,52px); section padding clamp(50px,8vw,104px).
- **Hairline module grid** is the signature. Prefer it over borders for any set of parallel facts/layers/cards.
- The single flourish: `18px 18px 0 yellow` offset shadow, reserved for the prime card.

## Components (all in `index.html`)
Nav (sticky, blurred, ink brand) · Hero (eyebrow + two-color display + squared pills) ·
Kicker section header (big ink numeral + wide-tracked ink label) · Pills/chips ·
Verdict chips (go/build/viable/ramp/moon/dead) · Layer panels (color-topped emit/catch/show) ·
Reframe callout (left red bar) · Problem row + fact grid · Bento cards (prime wide + offset
shadow, trap dashed, positional `01/07` rank ordinals) · **Knowledge-graph constellation** ·
**S-curve clock** · Citations + source-tier chips (acad/patent/policy) · Footer + signature squares.

## Data representations (always inline SVG - never a CDN)
**Knowledge graph:** node FILL = type (founder=ink, problem=panel/hollow, evidence=blue,
opportunity=green, killed=red, moonshot=yellow; stroke=--edge). Edge STROKE = relation
(default=muted draw-in-once, .kill=red solid, .sup=blue dashed no-anim). Focal glow only on
founder + prime. Legend mandatory.
**S-curve clock:** blue draw-in curve, red "you are here" node, hairline trend list beside it.

## Accessibility contract
- Retune blue in dark; ink-on-green/yellow chips; `:focus-visible` 2px blue; reduced-motion block. See `tokens.css`.

## Apply to a new artifact
1. Copy the `:root` tokens + the two a11y blocks (`tokens.css`).
2. Page shell: sticky nav -> hero -> numbered sections w/ kicker.
3. Reach for the hairline module grid before borders.
4. Assign every color by meaning.
5. Data -> inline SVG. Images -> the base recipe.
6. Ship both surfaces: raster via `assets/` on Vercel; data-URI + inline SVG for Artifacts.
