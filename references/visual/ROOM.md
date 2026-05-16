---
type: visual_canon
purpose: De Stijl palette source-of-truth + glyph vocabulary canon for MindrianOS surfaces
canon_parts: [Part 3, Part 7, Part 10]
phase_origin: 121.5
plan_origin: 121.5-03
consumers:
  - lib/core/visual-ops.cjs
  - scripts/banner
  - scripts/context-monitor
  - templates/destijl-base.css
  - templates/shared.css
  - references/vault-kit/snippets/mindrian-destijl.css
  - lib/render/render-v2.cjs
  - lib/render/JTBD-PALETTES.md
---

# references/visual/ -- the De Stijl canon

`palette.json` is the single source of truth for every De Stijl hex value rendered by MindrianOS. The CI tripwire `scripts/check-palette-consistency.cjs` asserts every consumer file matches the canonical hex set.

## ODD 3 resolution (Phase 121.5, 2026-05-16)

Keep existing muted/earthy values. The external reference doc's brighter classic-Mondrian rebrand is a brand pivot, not an alignment; deferred to v1.14.0 if it ever comes. Canon Part 7 (consolidation, not rebrand).

## Provenance

Hex values copied verbatim from `lib/core/visual-ops.cjs` `DS_HEX` -- the shipping source of truth at the time of Phase 121.5-03. The current palette has been in production across v1.10 and v1.13 betas without complaint; consolidation preserves it.

## Future additions (deferred)

- `glyph-vocabulary.json` -- the SKILL.md section 3 12-glyph table as machine-readable. Surface-anchored meaning per ODD 4 (still open).
- `banner-templates.json` -- the ASCII banner geometry per surface (CLI / Desktop / Cowork).

Both deferred. Phase 121.5-03 ships `palette.json` only.

## Deferred consumer audits

Two CSS consumers were found to use surface-specific hex variants that intentionally diverge from the core palette and require their own audit pass:

- `templates/shared.css` -- dashboard-styling lighter/darker variants (surface elevation tones; brighter accent reds for hover states). Captured in `palette.json` `deferred_consumers` for audit-trail purposes.
- `references/vault-kit/snippets/mindrian-destijl.css` -- Obsidian-vault legibility variants tuned for Obsidian's default dark theme. Distinct surface; deferred to the Obsidian-vault color audit.

These remain unchanged by Phase 121.5-03. The CI tripwire `scripts/check-palette-consistency.cjs` excludes them via the `derived_files` allowlist; the deferred entries record the audit-trail.

When a future plan consolidates either surface, move the entry from `deferred_consumers` to `derived_files` and reconcile the variants.

## How to add a new hex

1. Add the key + hex to the right tier in `palette.json` (`base` / `palette_a_discovery` / `palette_b_build` / `extended`).
2. Add the consumer file to `derived_files` if it is not already listed.
3. Run `node scripts/check-palette-consistency.cjs` to confirm the CI tripwire passes.
4. Update the consumers to derive the value from `palette.json` (not hardcoded).

Hex values that drift from `palette.json` will fail the CI check.
