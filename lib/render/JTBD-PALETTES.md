# JTBD-PALETTES.md -- JTBD-aware Renderer Palette Documentation

> Phase 102 -- Context-aware rendering. The canonical source for JTBD -> palette mappings consumed by lib/render/render-v2.cjs (CLI surface) and downstream HTML-emitting phases (Phase 19 wiki-dashboard, Phase 25 export, Phase 30 presentation-generator).
>
> Owned by lib/render/render-v2.cjs (Phase 102-05 implementation). Read at module load by tests and downstream consumers, never mutated by user-data-bearing payloads. LOCAL-only per Canon Part 8.

---

## 1. Purpose

Phase 102 ships TWO palettes for the same set of JTBDs because the CLI surface and the HTML/dashboard surface have different semantic contracts. The CLI uses the 5-color contract from skills/ui-system/SKILL.md §4 (Green / Cyan / Yellow / Red / Gray) where color carries semantic meaning at the terminal (red = error, etc.). HTML / wiki / presentation / Cytoscape surfaces use Mondrian primaries (red / yellow / blue / black / white) for visual identity discipline -- rectilinear grids, primary blocks, large white space.

The dual-palette rule (Phase 102 D-06b) is: pick the palette by SURFACE, not by JTBD. The same JTBD renders red on CLI and could render blue on HTML -- and that is correct.

This file is canonical for both palettes. Phase 102-05 ships the CLI mapping wired into render-v2.cjs; the Mondrian mapping is documented for downstream HTML-emitting phases to honor.

---

## 2. CLI Semantic Palette (5-color contract)

Implementation: \`lib/render/render-v2.cjs\` -- \`JTBD_CLI_COLOR\` map. Applied as a single colored ■ glyph at the start of Zone 1 header (D-07). TTY-gated via \`process.stdout.isTTY\` so non-TTY captures (CI logs, JSON-mode emission) stay byte-clean and equal the strip-ANSI of the colored render (RENDER-102-05 invariant).

| JTBD handle | CLI color | Meaning anchor |
|---|---|---|
| \`decide-pursue\` | red | high-stakes commit decision |
| \`find-problem\` | yellow | questioning / ambiguity |
| \`understand-market\` | cyan | informational |
| \`find-bottleneck\` | red | blocker / urgent |
| \`prepare-pitch\` | green | forward action / success-flavored |
| \`validate-idea\` | yellow | challenge / scrutiny |
| \`compare-options\` | cyan | informational table |
| \`connect-domains\` | cyan | cross-reference |
| \`surface-contradiction\` | red | conflict |
| \`plan-execution\` | green | commitment |
| \`file-meeting\` | cyan | capture |
| \`audit-room\` | yellow | warning-flavored |
| \`explore\` | gray | no specific action |

Color -> ANSI SGR mapping (\`lib/render/render-v2.cjs\` \`ANSI\` constant):

| Token | ANSI sequence | Semantic role (SKILL.md §4) |
|---|---|---|
| red | \\x1b[31m | Errors only |
| yellow | \\x1b[33m | Warnings, caution |
| cyan | \\x1b[36m | Commands, paths, links |
| green | \\x1b[32m | Success, active, complete |
| gray | \\x1b[90m | Meta info, timestamps, hints |
| reset | \\x1b[0m | Reset to default |

Compact mode (D-08) drops the overlay entirely -- Zone 1 left-rail accent is omitted when the token budget exceeds 80%. The accent is a "luxury" feature; semantic body colors stay.

---

## 3. Mondrian Dual Palette (HTML / dashboard / presentation)

Used by HTML-emitting downstream phases ONLY (Phase 19 wiki-dashboard, Phase 25 data-room-export-v2, Phase 30 presentation-generator). Phase 102 renderer does NOT emit HTML -- this section is documentation, not active code.

Per Phase 102 D-06b, Mondrian primaries (red, yellow, blue, black, white) map by JTBD as follows:

| JTBD handle | Mondrian color |
|---|---|
| \`decide-pursue\` | red |
| \`find-problem\` | yellow |
| \`understand-market\` | blue |
| \`find-bottleneck\` | red |
| \`prepare-pitch\` | black (commitment / structural) |
| \`validate-idea\` | yellow |
| \`compare-options\` | blue |
| \`connect-domains\` | blue |
| \`surface-contradiction\` | red |
| \`plan-execution\` | black |
| \`file-meeting\` | blue |
| \`audit-room\` | yellow |
| \`explore\` | white (no specific action; the canvas) |

Mondrian shapes vocabulary (HTML surfaces only): square (■), circle (●), triangle (▲ ▼ ▶ ◀). The 12-glyph CLI vocabulary stays unchanged -- circle (●) is NOT in the CLI allowlist; HTML surfaces gain it.

The dual-palette rule prevents palette drift across surfaces and protects the De Stijl visual identity discipline downstream.

---

## 4. Surface Routing Rule

| Surface | Palette | Why |
|---|---|---|
| CLI / TUI (every /mos:* output) | 5-color semantic (red / yellow / cyan / green / gray) | Color carries semantic meaning at the terminal; user reads "red = error" muscle-memory (SKILL.md §4) |
| HTML dashboard / wiki / presentation / Cytoscape graph | Mondrian primaries (red / yellow / blue / black / white) | Visual identity discipline; rectilinear grid; primary blocks; large white space |

Renderers MUST pick by SURFACE. A CLI /mos:audit-room output uses yellow. The HTML wiki page for the same room uses yellow as well -- coincidentally the same here, but the mapping rules are independent. compare-options is cyan on CLI but blue on HTML; this is intentional.

---

## 5. Forward References (downstream consumers)

| Phase | Status | Consumes |
|---|---|---|
| Phase 19 wiki-dashboard | planned | Mondrian palette for JTBD-tagged page headers + sidebar accents |
| Phase 25 data-room-export-v2 | planned | Mondrian palette for HTML / PDF export theming |
| Phase 30 presentation-generator | planned | Mondrian palette for slide chrome + JTBD-anchored section colors |
| Phase 91 navigation-engine | planned | CLI palette via render-v2 (read-through; no direct dependency on this file) |

---

## 6. Pending SKILL.md Amendment (Phase 106 follow-on)

Phase 102 ships the CLI palette wired (D-06) and the Mondrian palette documented (D-06b). The formal skills/ui-system/SKILL.md amendment that encodes the dual-palette rule into the rendering style spec is queued as a Phase 106 follow-on. Phase 106 is a small subsequent phase, NOT in v1.12.3 scope.

When Phase 106 lands, skills/ui-system/SKILL.md §4 will gain a sub-section titled "Cross-surface palette rule" referencing this file as the canonical source.

---

## 7. Resolution Algorithm (parser contract)

render-v2.cjs reads JTBD_CLI_COLOR directly as a frozen object literal -- no Markdown parsing required. The mapping is duplicated here for human-readable documentation and downstream consumer reference.

If the JTBD argument is null OR not in the map OR compact mode is active OR process.stdout.isTTY is false, the renderer applies NO accent. The header zone passes through unchanged.

---

## 8. Invariants (regression fences for Plan 102-05)

1. **13 entries.** Both CLI and Mondrian tables MUST have exactly 13 rows (the canonical Phase 100 JTBD set). Adding a 14th JTBD requires Phase 100 vocabulary expansion + this file update + a HMI-102-XX requirement amendment.
2. **Closed CLI palette.** CLI palette tokens MUST be from {red, yellow, cyan, green, gray}. No auxiliary colors.
3. **Closed Mondrian palette.** Mondrian palette tokens MUST be from {red, yellow, blue, black, white}. No auxiliary colors.
4. **TTY gate.** The renderer MUST gate ANSI emission on process.stdout.isTTY. Non-TTY captures MUST be byte-identical to the strip-ANSI of TTY captures.
5. **Compact override.** Compact mode (token budget > 80%) MUST drop the Zone 1 color accent. Body semantic colors stay.

---

## Canon Refs

- **Part 3 (Tri-Context Decision Gate)** -- color overlay is part of the cognitive surface the navigator reads at every Decision Gate.
- **Part 7 (Reuse Before Build)** -- this file ships data-as-asset; no new module surface added.
- **Part 8 (The Graph Boundary)** -- the renderer reads this file LOCAL-only at module load; no Brain queries derive palette. JTBD handle at render time is a generic enum scalar (Canon-allowed framework handle), never a user-data string.

---

## See Also

- lib/render/render-v2.cjs -- consumer; Plan 102-05 implementation.
- tests/test-render-v2-color-overlay.cjs -- RENDER-102-05 regression fence.
- skills/ui-system/SKILL.md §4 -- the 5-color CLI contract (red / yellow / cyan / green / gray).
- docs/MINDRIAN-CANON.md Part 3 -- closed verb vocabulary (10 verbs); sets context for why JTBD-aware rendering matters.
- .planning/phases/102-context-aware-rendering/102-CONTEXT.md -- D-06 (CLI palette) + D-06b (Mondrian dual palette) decision records.
- .planning/phases/100-jtbd-inference-engine/ -- upstream JTBD handle producer.
