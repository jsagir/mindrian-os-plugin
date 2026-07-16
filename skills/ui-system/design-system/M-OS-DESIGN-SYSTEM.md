# M:OS Canonical Design System

**De Stijl x Swiss Broadside. v1.1.** The house language for every M:OS deck, dashboard,
export, wiki, snapshot, page, and UI component. Self-contained, theme-aware (default cream),
Artifact-safe, Vercel-ready.

**Ratio:** 75% Swiss International Typographic Style (grid, grotesk display, air) +
25% De Stijl (Mondrian primaries carrying fixed meaning on warm off-white).
**Prime directive:** color is semantic, never decorative.

---

## 1. The five laws
1. **Ratio.** 75% Swiss, 25% De Stijl. When in doubt, remove color and add air.
2. **Semantic color.** Red = kill / danger / trap. Blue = evidence / build / navigation. Green = go / opportunity / fit. Yellow = moonshot / prime / highlight. Ink = structure. Never paint a label a primary for decoration.
3. **Flat + rectilinear.** No gradients (one exception: a 1px structural grid). No border-radius above 2px. No soft blur shadows. Only hard offset shadows and flat planes.
4. **Hairline structure.** Module lines are faked with `gap:1px` over a `--rule` background; cells are `--panel`. Structure is visible, not implied.
5. **Restrained motion.** Draw-in once, then rest. Infinite pulse only on one focal node. Always honor `prefers-reduced-motion`.

---

## 2. Color tokens

Meaning is fixed; the value flips per theme. Default is light (cream).

| Token | Light | Dark | Job |
|---|---|---|---|
| `--paper` | `#F4F2EC` | `#0B0B0D` | ground (never pure white) |
| `--panel` | `#FBFAF7` | `#141417` | raised surfaces |
| `--ink` | `#0C0C0D` | `#F3F2EE` | text, structure, founder |
| `--muted` | `#5B5B5B` | `#9a9a9e` | secondary text |
| `--red` | `#E11D22` | `#E11D22` | kill / danger / trap |
| `--blue` | `#1E52E0` | `#6D9BFF` | evidence / build / nav |
| `--green` | `#12A06A` | `#12A06A` | go / opportunity / fit |
| `--yellow` | `#FFC400` | `#FFC400` | moonshot / prime / highlight |
| `--edge` | `#111` | `rgba(243,242,238,.34)` | card / chip borders |
| `--rule` | `rgba(17,17,17,.14)` | `rgba(243,242,238,.16)` | hairlines, dividers |

**Non-negotiables:** blue MUST retune to `#6D9BFF` in dark (the light blue fails AA on
near-black); green/yellow chips use **ink text, not white**; borders use `--edge` (softens in
dark), hairlines use `--rule`.

```css
:root{
  --paper:#F4F2EC; --panel:#FBFAF7; --ink:#0C0C0D; --muted:#5B5B5B;
  --hair:#111; --edge:#111; --rule:rgba(17,17,17,.14);
  --red:#E11D22; --blue:#1E52E0; --yellow:#FFC400; --green:#12A06A;
  --shadow:18px 18px 0 var(--yellow); --maxw:1180px;
  --grot:"Helvetica Neue",Inter,system-ui,Arial,sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{--paper:#0B0B0D;--panel:#141417;--ink:#F3F2EE;--muted:#9a9a9e;--hair:#F3F2EE;
    --edge:rgba(243,242,238,.34);--blue:#6D9BFF;--rule:rgba(243,242,238,.16)}
}
:root[data-theme="light"]{--paper:#F4F2EC;--panel:#FBFAF7;--ink:#0C0C0D;--muted:#5B5B5B;--hair:#111;--edge:#111;--blue:#1E52E0;--rule:rgba(17,17,17,.14)}
:root[data-theme="dark"]{--paper:#0B0B0D;--panel:#141417;--ink:#F3F2EE;--muted:#9a9a9e;--hair:#F3F2EE;--edge:rgba(243,242,238,.34);--blue:#6D9BFF;--rule:rgba(243,242,238,.16)}
```
Set `<html data-theme="light">` so pages open cream regardless of OS preference; the toggle flips to dark.

---

## 3. Typography

One grotesk. A tight display, wide-tracked micro-labels, tabular numerals throughout.

| Role | Weight | Size | Tracking |
|---|---|---|---|
| display | 800 | `clamp(2.6rem,9vw,7rem)` | `-.045em` |
| h2 | 800 | `clamp(1.6rem,4vw,2.7rem)` | `-.02em` |
| kicker numeral | 800 | `clamp(2.2rem,6vw,4.2rem)` | `-.04em` |
| lede | 400 (muted) | `clamp(1rem,1.7vw,1.24rem)` | - |
| micro-label | 800 UPPER | 12px | `.26em` |
| body | 400 | 17px | - |

Tracking scale: eyebrow `.32em` / kicker-label `.26em` / pills `.14em` / nav `.14em`.
Numerals always tabular: `font-feature-settings:"tnum" 1`.

---

## 4. Grid, spacing, edges

- Container `--maxw` 1180px, gutters `clamp(18px,4vw,52px)`; section padding `clamp(50px,8vw,104px)`.
- **Hairline module grid** is the signature move. Prefer it over borders for any set of parallel facts, layers, or cards.
- Single flourish: `18px 18px 0 yellow` offset shadow, reserved for the prime card. Hover offset shadow `8px 8px 0 ink`. Never soft blur.

```css
/* hairline module grid: container = rule bg + 1px gap; cells = panel */
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;
  background:var(--rule);border:1px solid var(--rule)}
.facts div{background:var(--panel);padding:11px 13px}
```

---

## 5. Motion + accessibility (required)

```css
:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  [data-reveal]{opacity:1!important;transform:none!important}
}
```
Scroll-reveal: `[data-reveal]{opacity:0;transform:translateY(22px);transition:.6s cubic-bezier(.2,.7,.2,1)}` toggled by an IntersectionObserver adding `.in`.

**Always:** retune blue in dark, ink-on-green/yellow chips, focus rings, reduced-motion.
**Never:** white text on green/light-blue fills, infinite pulse on more than one node, gradients / blur / rounded pills, red on a non-kill element, external fonts / CDNs / graph libraries.

---

## 6. Components

### Nav (sticky, blurred, ink brand)
```css
nav.top{position:sticky;top:0;z-index:90;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--rule)}
nav.top .inner{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:12px clamp(18px,4vw,52px);font:800 11px/1 var(--grot);letter-spacing:.14em;text-transform:uppercase}
```
Wordmark: **M:OS** with the colon in red -> `M<span style="color:var(--red)">:</span>OS`.

### Hero (eyebrow + two-color display + squared pills)
```css
.eyebrow{font:800 12px/1 var(--grot);letter-spacing:.32em;text-transform:uppercase;color:var(--muted)}
h1.display{font-weight:800;font-size:clamp(2.6rem,9vw,7rem);line-height:.92;letter-spacing:-.045em;max-width:15ch}
h1.display .b{color:var(--blue)} h1.display .r{color:var(--red)}
```

### Kicker section header (big ink numeral + wide-tracked label)
```css
.kick{display:flex;align-items:baseline;gap:16px}
.kick .no{font-weight:800;font-size:clamp(2.2rem,6vw,4.2rem);line-height:.8;letter-spacing:-.04em;color:var(--ink)}
.kick .lab{font:800 12px/1.3 var(--grot);letter-spacing:.26em;text-transform:uppercase;color:var(--ink)}
```

### Pills + verdict chips (squared, semantic)
```css
.pill{font:700 10.5px/1 var(--grot);letter-spacing:.14em;text-transform:uppercase;padding:8px 12px;border:1.5px solid var(--edge);border-radius:0}
.pill.solid{background:var(--ink);color:var(--paper)} .pill.red{background:var(--red);color:#fff;border-color:var(--red)}
.vd{font:800 10px/1 var(--grot);letter-spacing:.1em;text-transform:uppercase;padding:7px 11px;border:1.5px solid var(--edge)}
.vd.go{background:var(--green);color:#111;border-color:var(--green)}      /* ink on green */
.vd.build{background:var(--blue);color:#fff;border-color:var(--blue)}
.vd.viable{background:transparent}
.vd.ramp{background:var(--yellow);color:#111;border-color:#111}
.vd.moon{background:transparent;border-style:dashed}
.vd.dead{background:var(--red);color:#fff;border-color:var(--red)}
```

### Layer panels + reframe (color-topped module row)
```css
.layer.emit{border-top:6px solid var(--red)} .layer.emit h4{color:var(--red)}
.layer.catch{border-top:6px solid var(--blue)} .layer.catch h4{color:var(--blue)}
.layer.show{border-top:6px solid var(--yellow);background:color-mix(in srgb,var(--yellow) 8%,var(--panel))}
.reframe{border-left:8px solid var(--red);padding:18px 22px;background:var(--panel);font-weight:700}
```

### Problem row + fact grid
```css
.prob{display:grid;grid-template-columns:clamp(70px,10vw,120px) 1fr;gap:clamp(14px,3vw,36px)}
.prob .pn{font-weight:800;font-size:clamp(2.2rem,7vw,4.6rem);line-height:.8;letter-spacing:-.05em;color:var(--red)}
.prob .pt em{font-style:normal;background:color-mix(in srgb,var(--yellow) 55%,transparent);padding:0 .15em}
```

### Bento cards (prime wide + offset shadow, trap dashed, rank ordinals)
```css
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
.op{grid-column:span 2;border:1px solid var(--edge);background:var(--panel);padding:20px;display:flex;flex-direction:column;gap:9px}
.op.prime{grid-column:span 3;box-shadow:var(--shadow)}   /* 18px 18px 0 yellow */
.op.trap{grid-column:span 6;background:transparent;border-style:dashed;opacity:.72}
.op .rk .ord{color:var(--ink);margin-right:8px}          /* positional 01 / 07 rank */
```

### Citations + source-tier chips
```css
ol.cites li{counter-increment:c;padding-left:50px;position:relative;border-bottom:1px solid var(--rule)}
ol.cites li::before{content:counter(c,decimal-leading-zero);position:absolute;left:0;font:800 13px/1 var(--grot);color:var(--ink)}
.tier.acad{background:var(--blue);color:#fff} .tier.pat{background:var(--ink);color:var(--paper)} .tier.pol{background:var(--yellow);color:#111}
```

---

## 7. Data representations (always inline SVG, never a CDN)

### Knowledge-graph constellation
- Node **fill = type**: founder=ink, problem=panel (hollow), evidence=blue, opportunity=green, killed=red, moonshot=yellow. Stroke always `--edge`.
- Edge **stroke = relation**: default=muted (draws in once), `.kill`=red solid, `.sup` (supersedes)=blue dashed, no animation.
- Focal glow (`np` pulse) only on founder + prime. Legend mandatory (12px square + `--edge` border + uppercase label).

```html
<circle class="gn founder glow" .../>          <!-- node -->
<path class="ed kill" d="..."/>                 <!-- edge -->
```
```css
.ed{stroke:var(--muted);stroke-dasharray:520;stroke-dashoffset:520;animation:draw 2.6s ease-out forwards;opacity:.5}
.ed.kill{stroke:var(--red);opacity:1} .ed.sup{stroke:var(--blue);stroke-dasharray:6 7;animation:none}
.gn{stroke:var(--edge);stroke-width:2}
@keyframes draw{to{stroke-dashoffset:0}}
```

### S-curve "clock" (timing / you-are-here)
Blue draw-in curve, red "you are here" node, hairline trend list beside it.
```css
.curve .s{fill:none;stroke:var(--blue);stroke-width:4;stroke-dasharray:900;stroke-dashoffset:900;animation:draw 3s ease-out forwards}
.curve .you{fill:var(--red)}
```

---

## 8. Structural futurism + isometric (v1.1)

Future, but every mark describes the grid it lives on.

```css
/* isometric clickables: rest extruded, lift on hover, press flat */
.op{box-shadow:4px 4px 0 var(--rule)}
.op:hover{transform:translate(-4px,-4px) rotate(-.45deg);box-shadow:14px 14px 0 var(--ink)}
.op:active{transform:translate(0,0) rotate(0);box-shadow:2px 2px 0 var(--edge)}
.op.prime:hover{transform:translate(-4px,-4px) rotate(-.3deg);box-shadow:22px 22px 0 var(--yellow),14px 14px 0 var(--ink)}
/* registration ticks: technical-drawing corner brackets, pure CSS */
.frame::before{content:"";position:absolute;top:-1px;left:-1px;width:14px;height:14px;border-top:2px solid var(--blue);border-left:2px solid var(--blue)}
.frame::after{content:"";position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-bottom:2px solid var(--blue);border-right:2px solid var(--blue)}
/* coordinate grid under hero: 1px structural lines (a grid, not a wash) */
header.hero::before{content:"";position:absolute;inset:0;z-index:-1;opacity:.5;
  background-image:repeating-linear-gradient(0deg,transparent 0 39px,var(--rule) 39px 40px),repeating-linear-gradient(90deg,transparent 0 39px,var(--rule) 39px 40px)}
@media (prefers-reduced-motion:reduce){.op:hover,.op.prime:hover{transform:none}}
```

---

## 9. Imagery (the prompt is a token)

Cohesive imagery comes from a cohesive prompt recipe. The base is fixed; only SUBJECT changes.

> Editorial magazine-cover illustration, hyper-modern Swiss International Typographic Style
> crossed with De Stijl. Warm off-white paper ground (#F4F2EC). Flat geometric composition,
> generous negative space, precise thin near-black ink linework, bold flat Mondrian-primary
> accents used sparingly - signal red #E11D22, electric blue #1E52E0, warm yellow #FFC400.
> High-key, restrained, subtle depth. No text, no words, no logos, no watermark. [ASPECT].
> SUBJECT: [one concrete scene].

- Aspect: hero = "cinematic wide 16:9"; card = "wide 16:9"; spot = "square".
- **Generate one image at a time** (parallel calls collide on temp filenames); save each uniquely.
- Keep SUBJECT concrete and singular. Abstract diagrams render best.

---

## 10. Delivery: Artifact vs Vercel

- **Vercel:** reference `assets/*.png` directly; deploy the folder.
- **claude.ai Artifact:** external hosts are CSP-blocked. Embed raster as a `data:` URI, and
  prefer inline SVG (graph, clock, nerve motif) which needs no assets at all.
- Every page is self-contained: inline all CSS, no external fonts or CDNs.

---

## 11. Apply to a new artifact
1. Copy the `:root` tokens + the two a11y blocks. That alone is ~60% of the look.
2. Page shell: sticky nav -> hero (eyebrow + two-color display + squared pills) -> numbered sections with the kicker.
3. Reach for the hairline module grid before borders.
4. Assign every color by meaning; if you can't name what a red means, it should not be red.
5. Data -> inline SVG. Images -> the base recipe, one SUBJECT per image.
6. Ship both surfaces: raster via `assets/` on Vercel; data-URI + inline SVG for Artifacts.

---

## 12. How it is baked into M:OS (ui-system)
- Single source of truth: `skills/ui-system/design-system/mos-design-system.css`.
- Loader: `lib/ui/design-system.cjs` -> `mosStyleTag()` returns the inlined `<style>`.
- Mandate: `skills/ui-system/SKILL.md` section 0 + `skills/ui-system/rules/design-system.md`.
- Every HTML generator (`generate-deck/hub/lobby/snapshot`, `generate-standalone`, dashboard
  + export templates) inlines the bundle and sets `data-theme="light"`.
- Applies to `/mos:deck`, `MOSDeckEngine`, `/mos:dashboard`, `/mos:export`, `/mos:present`,
  `/mos:wiki` + publish, `/mos:snapshot`, and any future HTML surface.

*M:OS Canonical Design System v1.1. Hard grid. Loud primaries. Quiet restraint.*
