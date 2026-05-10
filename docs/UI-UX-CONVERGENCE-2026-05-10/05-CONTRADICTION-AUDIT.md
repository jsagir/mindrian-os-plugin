---
type: contradiction-audit
created: 2026-05-10
scope: MindrianOS UI/UX corpus -- ui-system skill, MINDRIAN-CANON Part 3, the session-start enforcement prompt, the TODO entries, the design/slides skills
method: manual audit (no Brain dependency)
---

# UI/UX Contradiction Audit

~13 conflicts between authoritative design docs, ranked by how badly they bite, each with the two sides and the call that resolves it.

## HARD contradictions (two authoritative sources say opposite things)

**C1 -- The no-emoji rule contradicts itself.** `skills/ui-system/SKILL.md`: "NO EMOJI. EVER." Session-start UI-enforcement prompt: "NO EMOJI anywhere in output. NO exceptions." But `.planning/TODO.md` (Decisions Resolved): "ui-system skill no-emoji rule gains carve-out: statusline surface only," and the v1.10.4 changelog shipped "statusline redesign ... thematic emojis." *Call:* either the SKILL.md gets the statusline carve-out written into it explicitly, or the statusline emojis go. Pick one -- an agent reading the skill will strip something the product intentionally ships.

**C2 -- The semantic color contract is not the brand palette.** Session-start enforcement: "Colors: green=success, cyan=info, yellow=warning, red=critical, gray=muted." De Stijl brand palette (TODO + canon): cream / Mondrian-red / blue / yellow / green. Cyan and gray are not in the brand; blue and cream are not in the semantic set. *Call:* map semantic roles onto the De Stijl five (info -> blue; muted -> desaturated cream). Until that mapping exists, "info = cyan" and "De Stijl only" are in open conflict.

**C3 -- "ui-system governs ALL output / no command invents its own format" vs the dashboard.** SKILL.md offers exactly 5 body shapes (A-E) + the F selector family and claims totality. Session-start prompt mandates: "When generating a dashboard ... ALWAYS use scripts/generate-standalone ... NEVER generate HTML by hand -- the template at dashboard/index.html has full Cytoscape.js graph ... intelligence panel, layer toggles, and chat UI." None of the 5 body shapes describes an interactive graph dashboard. *Call:* the skill needs a sixth "shape" (or an explicit "browser surfaces are a separate contract" clause). It currently claims totality it doesn't have.

**C4 -- "CLI UI Ruling System" vs being cited as the authority for browser surfaces.** SKILL.md frontmatter says it governs "ALL MindrianOS terminal output." Title and scope both say *terminal*. But the v1.14.0 wiki plan and the session-start prompt treat it as the authority for the wiki and dashboard, which are browser. *Call:* ui-system grows a "Browser-Surface Rendering" section, or a sibling doc owns the browser and ui-system stops claiming "ALL output." (This is the gap closed by `08`'s dev-phase instructions, folded into Phase 121.5.)

**C5 -- The statusline brand glyph is a 13th glyph.** SKILL.md: "12 glyphs. One meaning each. No overloading," list = `■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →`. But the statusline brand mark is `⬡` (U+2B21 hexagon) -- "⬡ MindrianOS-Plugin" -- a glyph outside the locked 12, on a surface the skill governs, and the v1.14.0 entry says section headers must use "De Stijl symbols consistent with statusline." *Call:* either `⬡` joins the vocabulary as glyph #13 (the brand mark, meaning "MindrianOS"), or the statusline uses something from the 12.

**C6 -- F-shapes "implemented via AskUserQuestion primitive (Phase 88.2 invariant)" vs "renders conversationally on Desktop."** Canon Part 3: every Shape F sub-shape is "implemented via AskUserQuestion primitive (Phase 88.2 invariant)." Also Canon Part 3: on Desktop the Decision Gate "renders conversationally" (no keyboard nav, no AskUserQuestion widget on a chat surface). Both can't be true. *Call:* downgrade "invariant" to "the CLI/Cowork implementation"; define the Desktop conversational rendering of the same tri-context choice as a first-class variant, not a fallback.

## SOFT / latent contradictions (fine on paper, break on implementation)

**C7 -- "5-color palette only" vs the graph's semantic load.** The graph carries ~9 typed edge types (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES + decision edges + reverse-salient edges) plus multiple node types. You can't color-encode 9 edge types in 5 colors. Either the graph encodes by line-style/weight inside the 5, or it gets a sanctioned extension -- "5-color only" as written forbids the extension. *Unresolved.*

**C8 -- "5-color palette only" vs "light/dark toggle" vs "two themes (dark De Stijl + light PWS)."** Three statements coexist; is the wiki's light mode = the "light PWS" deck theme, = a strict remap of the dark five, or = a third palette? All three readings are currently supported by the docs. *Pick one.*

**C9 -- "Methodology commands use no shape (conversational)" vs canon Part 3 "any feature that asks the user to choose must route through Shape F."** A methodology session that ends in a choice has to be both "no shape" and "Shape F." The boundary inside a single methodology turn is unspecified. *Two rules that overlap with no precedence stated.*

**C10 -- "NEVER generate HTML by hand" vs the entire minisite + design-skill + slides-skill workflow.** The session-start prompt's blanket "never generate HTML by hand ... improvised HTML will always be inferior" is contradicted by the design skill (HTML presentations, banners, social photos), the slides skill (Chart.js HTML decks), and every project minisite (the Clarity-snippet rule assumes hand-authored public HTML). The rule *means* "don't hand-roll the dashboard"; as written it forbids things the product does daily.

**C11 -- Chart.js / ui-ux-pro-max chart tooling vs De Stijl enforcement.** The slides + design-system skills generate Chart.js visualizations and offer "25 chart types"; none inherit the 5-color palette or 12-glyph vocabulary. A `/mos:present` deck can ship charts in Chart.js defaults while the rest of the system is De Stijl-locked. No enforcement path connects them.

**C12 -- The Desktop "state echo" and the emoji carve-out.** Downstream of C1: on Desktop the statusline doesn't exist; a "one-line state echo" stands in for it. Does the state echo inherit the *statusline's* emoji carve-out or the *universal* no-emoji rule? Unspecified.

## Already resolved this session

**C13 -- v1.14.0 "out of scope" vs sub-plan 104-04.** The original v1.14.0 entry listed "Phase 88.2 F-shape rollout (orthogonal interactive-primitive work)" as flatly out of scope -- which contradicted 104-04 (click-red-wikilink-to-research + chat tool-call wiring), which *is* an interactive fork. Fixed in this session's `.planning/TODO.md` edit: F-shape *semantics* are obligated for any browser fork the sprint ships; the Phase 88.2 *rollout* is not pulled in.

## The pattern

The `ui-system` skill claims totality ("ALL output," "no exceptions," "no command invents its own format") that it can't actually back -- once you count the statusline emoji carve-out (C1), the `⬡` brand glyph (C5), the dashboard template (C3), the browser surfaces (C4), and the Desktop conversational rendering (C6). **The single highest-leverage fix is to make the skill honest about its boundaries** -- scope it explicitly to "terminal body shapes," name the sanctioned exceptions, stop saying "ALL." Most of C1-C6 dissolve the moment it stops over-claiming. That fix is folded into `08`'s Phase 121.5 instructions ("UI Canon: rewrite ui-system/SKILL.md").
