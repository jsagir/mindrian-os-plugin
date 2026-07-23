---
name: design-system
description: >
  M:OS Canonical Design System v1.1 mandate for every generated HTML artifact
  (decks, dashboards, exports, published wikis, snapshots, standalone/hub/lobby
  pages). Governs the HTML/browser surface exactly as SKILL.md's 4-zone system
  governs the terminal surface. Source of truth is
  skills/ui-system/design-system/mos-design-system.css + SPEC.md; loader is
  lib/ui/design-system.cjs mosStyleTag(). Cross-referenced by
  M-OS-DESIGN-SYSTEM.md section 12 and SKILL.md section 0.
---

# M:OS Canonical Design System (HTML artifacts) - MANDATORY

The terminal ruling (glyphs, 4-zone anatomy, 5 colors) governs CLI text. This rule governs
every **generated HTML artifact**: decks, dashboards, exports, published wikis, snapshots and
notes, standalone/hub/lobby pages, and any UI component rendered as HTML. If it renders as a
page, it obeys this system. No generator invents its own palette or typography.

## Source of truth
- CSS bundle to inline into every artifact: `skills/ui-system/design-system/mos-design-system.css`
- Written spec: `skills/ui-system/design-system/SPEC.md`
- Image recipe (the only sanctioned one): `skills/ui-system/design-system/image-prompt-style.md`

Always inline the CSS (self-contained, no external hosts) so artifacts stay Artifact-safe and
Vercel-ready.

## Five laws
1. **Ratio** - 75% Swiss International Typographic Style (grid, grotesk display, air) + 25% De Stijl (Mondrian primaries on warm off-white). When in doubt, remove color and add air.
2. **Semantic color** - Red=kill/danger/trap, Blue=evidence/build/nav, Green=go/opportunity/fit, Yellow=moonshot/prime/highlight, Ink=structure. Never paint a label a primary for decoration.
3. **Flat + rectilinear** - no gradients (a 1px structural grid is allowed), no border-radius (max 2px), no soft blur shadows. Only hard offset shadows and flat planes.
4. **Hairline structure** - module lines are faked with `gap:1px` over a `--rule` background; cells are `--panel`.
5. **Restrained motion** - draw-in once then rest; infinite pulse only on one focal node; always honor `prefers-reduced-motion`.

## Defaults (non-negotiable)
- **Warm cream ground, never black.** Set `data-theme="light"` on `<html>`; the toggle may flip to dark.
- **Blue retunes in dark** to `#6D9BFF` (the light blue fails AA on near-black).
- **Ink text on green/yellow chips**, never white.
- Borders use `--edge` (softens in dark), hairlines use `--rule`.
- Wordmark is **M:OS** (the colon accented in red), not "MindrianOS".
- `:focus-visible` outline + `prefers-reduced-motion` block are required.

## Isometric + structural futurism (v1.1)
- Clickable blocks rest extruded (`box-shadow:4px 4px 0`) and lift on hover (`translate(-4px,-4px) rotate(-.45deg)` + `14px 14px 0 ink`), press flat on active. Depth reads as structure, not glow.
- Registration ticks: 2px blue L-brackets at opposite corners of key panels via `::before`/`::after`.
- A faint 40px coordinate grid may sit under a hero (1px lines, the one permitted repeating-gradient).

## Imagery
Every generated image uses the base recipe in `image-prompt-style.md`; only the SUBJECT changes.
Generate one image at a time (parallel calls collide on temp filenames). Vercel: reference
`assets/*`. Artifacts: embed as `data:` URI and prefer inline SVG (graph, clock) which needs no asset.

## Data representations
Knowledge graph and S-curve clock are **always inline SVG**, never a CDN library. Node fill = type,
edge stroke = relation, legend mandatory. See SPEC.md.

## Applies to
`/mos:deck`, `MOSDeckEngine`, `/mos:dashboard`, `/mos:export`, `/mos:present`, `/mos:wiki` + publish,
`/mos:snapshot`, and the generators `generate-standalone`, `generate-hub`, `generate-lobby`,
`generate-snapshot`, `generate-deck`, `vault-export-orchestrator`. Any future HTML surface inherits this.
