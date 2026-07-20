# Image-Prompt Style v1 - a first-class design token

Cohesive imagery comes from a cohesive prompt recipe. The base recipe is fixed; only the
SUBJECT changes. That is what makes a multi-image deck read as one family.

## Base recipe (paste verbatim, swap only [ASPECT] and SUBJECT)
> Editorial magazine-cover illustration, hyper-modern Swiss International Typographic Style
> crossed with De Stijl. Warm off-white paper ground (#F4F2EC). Flat geometric composition,
> generous negative space, precise thin near-black ink linework, bold flat Mondrian-primary
> accents used sparingly - signal red #E11D22, electric blue #1E52E0, warm yellow #FFC400.
> High-key, restrained, subtle depth. No text, no words, no logos, no watermark. [ASPECT].
> SUBJECT: [one concrete scene].

## Aspect
- hero: "cinematic wide 16:9"
- opportunity/card: "wide 16:9"
- spot/icon: "square"

## Rules
- **Generate one image at a time.** Parallel calls can collide on temp filenames and overwrite.
- Save each with a **unique** name immediately after generation.
- Keep SUBJECT concrete and singular (one scene, one metaphor). Abstract diagrams render best.
- The exemplar `assets/exemplar-infrastructure.png` = SUBJECT "many agent + camera systems
  converging through one neutral hub into a surgeon viewport."

## Artifact vs Vercel delivery
- **Vercel:** reference `assets/*.png` directly.
- **claude.ai Artifact:** external hosts are CSP-blocked. Embed raster as a `data:` URI, and
  prefer inline SVG (graph, clock, nerve motif) which needs no assets at all.
