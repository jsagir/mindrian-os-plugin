<!-- GENERATED FILE - DO NOT HAND EDIT. | Regenerate with: node scripts/build-dist-bundles.cjs -->

# Zed bundle: assets omitted by the flat-layout constraint

Zed loads skills from a FLAT `.agents/skills/<name>/` directory and does not descend into subdirectories (https://zed.dev/docs/ai/skills). Skills in this repo may carry spec-sanctioned `references/`, `scripts/` and `assets/` subdirectories for progressive disclosure. Those cannot ship in this bundle.

This file exists so the omission is RECORDED rather than silent. A skill listed below still loads on Zed, but any instruction in its SKILL.md body that points at one of these paths will not resolve there. The full content is always available in `dist/generic-claude-dir/` and in the source `skills/` tree.

- Skills in this bundle: 126
- Catalog name+description bytes: 13240 / 51200 (26% of the Zed budget)
- Skills with omitted subdirectories: 1
- Subdirectories omitted in total: 2

| Skill | Omitted subdirectory | Files |
|-------|----------------------|-------|
| `ui-system` | `design-system/` | `design-system/M-OS-DESIGN-SYSTEM.md`<br>`design-system/SPEC.md`<br>`design-system/image-prompt-style.md`<br>`design-system/mos-design-system.css` |
| `ui-system` | `rules/` | `rules/design-system.md`<br>`rules/dual-palette.md`<br>`rules/glyph-disambiguation.md`<br>`rules/shape-f-zero-and-six.md` |
