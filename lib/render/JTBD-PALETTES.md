# JTBD-PALETTES.md -- JTBD-aware Renderer Palette + Verb Mapping

> Phase 102 -- Context-aware rendering. Maps the 13 canonical JTBD handles to a deterministic De Stijl color palette + the closed 10-verb MindrianOS-native vocabulary (Canon Part 3 § The 10 verbs) for Zone 1 header tinting and Zone 4 footer verb-suggestion ordering.
>
> Owned by `lib/render/render-v2.cjs` Phase 102 implementation. Read at render time, parsed deterministically, never mutated by user-data-bearing payloads. LOCAL-only per Canon Part 8.

---

## Status

- **Phase 102-00 (this file, Wave-0):** schema definition + 13-row mapping table shipped.
- **Phase 102-01 (sibling, Wave-1):** `render-v2.cjs` reads this file at module load, caches the parsed map in-memory, applies palette + verb-ordering at render time per RENDER-102-03 + RENDER-102-05.

## Why this lives here

`lib/render/` is the universal renderer's home. Putting palette + verb mappings as a sibling Markdown file (not JSON) means:
- Human-readable + editable; no build step to update.
- Sits BESIDE the only consumer (`render-v2.cjs`); no cross-module dependency graph.
- Same pattern as Phase 84 lib/scaffold/tier-0-mullins.json (data-as-asset alongside its loader).
- Markdown table is the single source of truth; the parser is tolerant (extra columns ignored, row order = priority).

## Canonical 5-color De Stijl palette

The palette is the UI Ruling System §1 5-color set (also referenced in REQUIREMENTS.md RULES-02 -- Obsidian variant). The renderer uses the CLI/SGR variant; the Obsidian variant in RULES-02 is for vault export.

| Token | CLI SGR | Hex (reference) | Semantic role |
|-------|---------|------------------|---------------|
| `red`    | `\x1b[31m` | `#C83D2F` | problem / critical / contradiction surface |
| `blue`   | `\x1b[34m` | `#2B5BA5` | business / structural / framework anchor |
| `gold`   | `\x1b[33m` | `#E8A838` | financial / action / opportunity surface |
| `cyan`   | `\x1b[36m` | `#4A9EAF` | competitive / info / signal |
| `green`  | `\x1b[32m` | `#4A8C5C` | solution / success / convergence |

`MOS_NO_COLOR=1` strips all SGR sequences byte-identically. Per RENDER-102-05 the canonical text content with overlay disabled MUST equal the strip-ANSI of the default render.

## Closed 10-verb MindrianOS-native vocabulary

Drawn verbatim from Canon Part 3 § The 10 MindrianOS-native verbs. Zone 4 verb-suggestion ordering may permute or subset, but MUST NEVER include a verb outside this set without a canon amendment.

1. Run Methodology
2. Reformulate
3. Spawn Sub-Agent
4. Navigate Graph
5. Devil's Advocate
6. Scenario Plan
7. Synthesize
8. Bank Opportunity
9. Defer
10. Free-Text

## JTBD -> palette + verb mapping (13 canonical JTBDs)

The 13 JTBDs are the Phase 100 jtbd-inference-engine canonical handles. Each row is one JTBD; columns are the renderer-relevant directives. Verb columns list the top-3 ordered Zone 4 suggestions (Tier 0 fallback when JTBD is absent or unmapped is always `Run Methodology / Reformulate / Free-Text`).

| JTBD handle | One-line job | Primary palette | Accent palette | Top Zone 4 verb #1 | Top verb #2 | Top verb #3 |
|-------------|--------------|------------------|-----------------|---------------------|--------------|--------------|
| `JTBD-EXPLORE` | Explore an unfamiliar problem space | `blue` | `cyan` | Run Methodology | Reformulate | Spawn Sub-Agent |
| `JTBD-DEFINE-PROBLEM` | Move from ill-defined to well-defined problem | `red` | `blue` | Reformulate | Run Methodology | Devil's Advocate |
| `JTBD-VALIDATE-ASSUMPTION` | Test whether a held belief survives evidence | `red` | `gold` | Devil's Advocate | Run Methodology | Navigate Graph |
| `JTBD-FILE-INSIGHT` | Capture a fresh insight into the room | `green` | `gold` | Bank Opportunity | Synthesize | Defer |
| `JTBD-RUN-FRAMEWORK` | Apply a methodology end-to-end | `blue` | `green` | Run Methodology | Synthesize | Spawn Sub-Agent |
| `JTBD-DECIDE-COMMIT` | Commit to a direction at a Decision Gate | `gold` | `red` | Synthesize | Devil's Advocate | Defer |
| `JTBD-FIND-OPPORTUNITY` | Surface a banked opportunity for action | `gold` | `cyan` | Bank Opportunity | Navigate Graph | Synthesize |
| `JTBD-CHALLENGE-FRAMING` | Stress-test the current framing | `red` | `cyan` | Devil's Advocate | Reformulate | Scenario Plan |
| `JTBD-PLAN-FUTURES` | Branch into scenarios | `cyan` | `blue` | Scenario Plan | Spawn Sub-Agent | Synthesize |
| `JTBD-SYNTHESIZE-INSIGHT` | Collapse parallel exploration to insight | `green` | `blue` | Synthesize | Bank Opportunity | Reformulate |
| `JTBD-NAVIGATE-CONTEXT` | Walk the local graph before deciding | `cyan` | `green` | Navigate Graph | Synthesize | Run Methodology |
| `JTBD-DEFER-DECISION` | Park a question for milestone audit | `gold` | `cyan` | Defer | Bank Opportunity | Free-Text |
| `JTBD-FREEFORM` | Type direction; Larry routes to a verb | `blue` | `cyan` | Free-Text | Reformulate | Run Methodology |

## Resolution algorithm (parser contract for Plan 102-01)

Pseudo-code:

```
function loadPalettes(filePath = 'lib/render/JTBD-PALETTES.md'):
    rows = parseMarkdownTable(filePath, anchor='## JTBD -> palette + verb mapping')
    return frozenMapOf(row.handle -> {
        primary: row.primary_palette,
        accent:  row.accent_palette,
        verbs:   [row.verb1, row.verb2, row.verb3]  // ordered, exactly 3
    })

function resolve(jtbdHandle):
    if jtbdHandle == null OR not in map:
        return TIER_0_FALLBACK   // { primary: 'blue', accent: 'cyan', verbs: ['Run Methodology', 'Reformulate', 'Free-Text'] }
    return map[jtbdHandle]
```

## Invariants (regression fences for Plan 102-01)

1. **13 rows.** Adding a 14th row MUST be paired with a Phase 100 JTBD vocabulary expansion + this file's row addition + a `RENDER-102-XX` requirement amendment.
2. **Closed verb vocabulary.** Every verb cell value MUST be a member of the 10-verb closed set. Test fence: intersection of all verb cells with the 10-verb set MUST equal the union of all verb cells.
3. **Palette tokens fixed.** Primary + accent columns MUST be from `{red, blue, gold, cyan, green}`. No auxiliary colors.
4. **Tier 0 fallback fixed.** `{ primary: 'blue', accent: 'cyan', verbs: ['Run Methodology', 'Reformulate', 'Free-Text'] }` is the canonical fallback. Test fence: when JTBD arg omitted OR unmapped, renderer applies this exact triple.
5. **Byte-stable order.** Row ordering of the JTBD table is the rendering priority; tests assert order-stability across reads.

## Canon refs

- **Part 3 (Tri-Context Decision Gate)** -- The 10-verb closed vocabulary; Zone 4 verb selection MUST NEVER step outside it.
- **Part 7 (Reuse Before Build)** -- This file ships data-as-asset; no new module surface added.
- **Part 8 (The Graph Boundary)** -- Renderer reads this file LOCAL-only at module load; no Brain queries derive palette or verb-ordering. JTBD handle at render time is a generic enum scalar (Canon-allowed framework handle), never a user-data string.

## See also

- `lib/render/render-v2.cjs` -- consumer; Phase 102-01 promotes the Phase 99-03 stub into the JTBD-aware implementation.
- `lib/render/render-v2.test.cjs` -- Phase 99-03 import-surface fence (preserved byte-identical across the 102 swap per RENDER-102-06).
- `tests/test-render-v2-jtbd-zone4.cjs` -- RENDER-102-03 regression fence (Plan 102-01 promotes the Wave-0 stub).
- `tests/test-render-v2-color-overlay.cjs` -- RENDER-102-05 regression fence (Plan 102-01 promotes the Wave-0 stub).
- `docs/MINDRIAN-CANON.md` -- Part 3 § The 10 MindrianOS-native verbs (canonical vocabulary).
- `.planning/phases/100-jtbd-inference-engine/` -- upstream JTBD handle producer (sibling phase).
