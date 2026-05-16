---
name: dual-palette
description: >
  Phase 102 D-06b dual De Stijl palette rule. The 5-color CLI semantic palette
  (red / yellow / cyan / green / gray) is the BASE; the Mondrian primaries
  palette (red / yellow / blue / black / white) overlays HTML-emitting
  surfaces only. The dual-palette rule (Phase 102 D-06b): pick the palette by
  SURFACE, not by JTBD. Cross-references lib/render/JTBD-PALETTES.md as the
  canonical Phase 102 mapping source.
---

# Dual De Stijl Palette Rule

Phase 102 (context-aware rendering) shipped TWO palettes for the same set of
JTBDs because the CLI surface and the HTML/dashboard surface have different
semantic contracts. The dual-palette rule (Phase 102 D-06b) is:

> **Pick the palette by SURFACE, not by JTBD.**

The same JTBD can render red on CLI (semantic) and blue on HTML (Mondrian
primary) and that is correct. CLI uses the 5-color contract from
`skills/ui-system/SKILL.md` §4 where color carries semantic meaning at the
terminal (red = error, yellow = warning, etc.). HTML / wiki / presentation /
Cytoscape surfaces use Mondrian primaries (red / yellow / blue / black / white)
for visual identity discipline -- rectilinear grids, primary blocks, large
white space.

This rule documents the palette pair. It does NOT define authoritative hex
values -- that role belongs to:

- `lib/render/JTBD-PALETTES.md` -- the Phase 102 canonical mapping (active
  consumer: `lib/render/render-v2.cjs` `JTBD_CLI_COLOR` frozen object literal).
- `references/visual/palette.json` -- the consolidated De Stijl hex token file
  per Sub-plan D of Phase 121.5. Once it lands, every surface (`scripts/banner`,
  `lib/core/visual-ops.cjs` `DS_HEX`, `templates/destijl-base.css`,
  `templates/shared.css`, `references/vault-kit/snippets/mindrian-destijl.css`)
  derives from it; CI asserts agreement.

This rules file is documentation. Edit `JTBD-PALETTES.md` for behavior changes.

---

## 1. CLI Semantic Palette (BASE)

The 5-color CLI contract from SKILL.md §4. Applied as a single colored Zone 1
left-rail accent at the start of the header (`lib/render/render-v2.cjs`
`JTBD_CLI_COLOR` map). TTY-gated via `process.stdout.isTTY` so non-TTY captures
stay byte-clean.

| Token  | ANSI sequence | Semantic role                |
|--------|---------------|------------------------------|
| red    | `\x1b[31m`    | Errors only                  |
| yellow | `\x1b[33m`    | Warnings, caution            |
| cyan   | `\x1b[36m`    | Commands, paths, links       |
| green  | `\x1b[32m`    | Success, active, complete    |
| gray   | `\x1b[90m`    | Meta info, timestamps, hints |
| reset  | `\x1b[0m`     | Reset to default             |

Compact mode (>80% token budget) drops the Zone 1 accent. Semantic body
colors stay.

---

## 2. Mondrian HTML Palette (OVERLAY for HTML surfaces only)

Used by HTML-emitting downstream phases ONLY:

  - Phase 19 wiki-dashboard
  - Phase 25 data-room-export-v2
  - Phase 30 presentation-generator

Mondrian shapes vocabulary on HTML surfaces extends the 12-glyph CLI set with
`circle (●)`. CLI surfaces stay locked to the 12-glyph vocabulary; circle is
NOT in the CLI allowlist.

---

## 3. JTBD -> Palette Mapping (both surfaces)

Sourced from `lib/render/JTBD-PALETTES.md`. CLI and Mondrian mappings are
independent; the same JTBD can land on different colors per surface.

| JTBD handle             | CLI color | Mondrian color |
|-------------------------|-----------|----------------|
| `decide-pursue`         | red       | red            |
| `find-problem`          | yellow    | yellow         |
| `understand-market`     | cyan      | blue           |
| `find-bottleneck`       | red       | red            |
| `prepare-pitch`         | green     | black          |
| `validate-idea`         | yellow    | yellow         |
| `compare-options`       | cyan      | blue           |
| `connect-domains`       | cyan      | blue           |
| `surface-contradiction` | red       | red            |
| `plan-execution`        | green     | black          |
| `file-meeting`          | cyan      | blue           |
| `audit-room`            | yellow    | yellow         |
| `explore`               | gray      | white          |

13 entries on both sides. Adding a 14th JTBD requires Phase 100 vocabulary
expansion + `JTBD-PALETTES.md` update + HMI-102-XX requirement amendment.

---

## 4. Surface Routing

| Surface                                           | Palette                  | Why                                            |
|---------------------------------------------------|--------------------------|------------------------------------------------|
| CLI / TUI (every `/mos:*` output)                 | 5-color semantic         | Color carries semantic meaning at the terminal |
| HTML dashboard / wiki / presentation / Cytoscape  | Mondrian primaries       | Visual identity discipline; De Stijl grid      |

Renderers MUST pick by SURFACE. A CLI `/mos:audit-room` output uses yellow.
The HTML wiki page for the same room also uses yellow (coincidentally), but
the mapping rules are independent. `compare-options` is cyan on CLI but blue
on HTML; this is intentional.

---

## 5. Invariants (regression fences)

1. **13 entries.** Both CLI and Mondrian tables MUST have exactly 13 rows (the
   canonical Phase 100 JTBD set).
2. **Closed CLI palette.** CLI palette tokens MUST be from
   `{red, yellow, cyan, green, gray}`. No auxiliary colors.
3. **Closed Mondrian palette.** Mondrian palette tokens MUST be from
   `{red, yellow, blue, black, white}`. No auxiliary colors.
4. **TTY gate.** The renderer MUST gate ANSI emission on
   `process.stdout.isTTY`. Non-TTY captures MUST be byte-identical to the
   strip-ANSI of TTY captures.
5. **Compact override.** Compact mode (token budget > 80%) MUST drop the
   Zone 1 color accent. Body semantic colors stay.

---

## 6. Canon Refs

- **Part 3 (Tri-Context Decision Gate)** -- color overlay is part of the
  cognitive surface the navigator reads at every Decision Gate.
- **Part 7 (Reuse Before Build)** -- this rule documents data-as-asset; no
  new module surface added.
- **Part 8 (The Graph Boundary)** -- the renderer reads `JTBD-PALETTES.md`
  LOCAL-only at module load; no Brain queries derive palette. JTBD handle at
  render time is a generic enum scalar (Canon-allowed framework handle),
  never a user-data string.

---

## 7. See Also

- `lib/render/JTBD-PALETTES.md` -- canonical Phase 102 mapping.
- `lib/render/render-v2.cjs` -- consumer; `JTBD_CLI_COLOR` map.
- `tests/test-render-v2-color-overlay.cjs` -- RENDER-102-05 regression fence.
- `skills/ui-system/SKILL.md` §4 -- the 5-color CLI contract.
- `references/visual/palette.json` -- (planned, Phase 121.5 Sub-plan D) the
  consolidated De Stijl hex token file.
- `.planning/phases/102-context-aware-rendering/102-CONTEXT.md` -- D-06 + D-06b
  decision records.
