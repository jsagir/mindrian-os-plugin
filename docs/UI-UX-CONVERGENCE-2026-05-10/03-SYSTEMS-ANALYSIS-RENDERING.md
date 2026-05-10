---
methodology: analyze-systems
created: 2026-05-10
depth: deep
problem_type: ill-defined / complex
venture_stage: Design
room_section: solution-design
brain_mode: mode-a confirmed (produced Tier 0 while Aura was paused; re-run 2026-05-10 -- graph confirms the decomposition sub-chain "MAP THE HIERARCHY -> Hierarchy Mapping -> Systems Thinking -> Reverse Salient Analysis", all TYPICAL_AT Pre-Opportunity; see 00b)
---

# Systems Analysis -- The MindrianOS Rendering System

## Focal level

Not "the CLI UI" (too narrow). Not "the product" (too broad). **One render event** -- a moment where MindrianOS has something to show or ask, and has to decide how to express it.

## Level above -- the constraints (navigate, don't solve)

- **The host platforms** -- Claude Code / Desktop / Cowork. They decide what primitives exist: CLI has a statusline, hooks, an ANSI text stream; Desktop has *none of those*, pure conversation; Cowork has a partial widget surface + shared async state. You cannot put a statusline on Desktop.
- **The founder's brand rules** -- De Stijl 5-color, no-emoji, the 12-glyph vocabulary. Non-negotiable.
- **Anthropic's third-party-plugin safety policy** -- imposes the install friction (the "umpteenth no"). Correct-by-design; pre-empt it, don't remove it.

## Level below -- the subsystems

| # | Subsystem | What it is | State today |
|---|---|---|---|
| 1 | **Token core** | primitive -> semantic -> component tokens: colors, type scale, spacing, glyphs, component specs. The shared conceptual model. | **Does not exist as one artifact.** De Stijl values hardcoded in multiple places. Phase 121.5 is about to mint `palette.json` -- the *first piece only*. |
| 2 | **CLI renderer** | 4 zones, 5 body shapes (A-E), Shape F selectors, statusline, the `ui-system` skill | Shipped, mostly works -- but over-claims totality ("ALL output", "no exceptions") and has unacknowledged carve-outs (statusline emoji, the U+2B21 brand glyph). Works because it congealed first; the standard lives in one skill file's prose. |
| 3 | **Browser renderer** | dashboard (Cytoscape + intelligence panel), wiki, SnapshotHub export | Dashboard exists from a bespoke template; wiki barely works (Lawrence's P1 blocker, March); SnapshotHub not built. **No governing contract** -- the `ui-system` skill says "CLI" and doesn't cover it. |
| 4 | **Conversational renderer** | Larry's voice on Desktop/Cowork, the "prose state echo" that stands in for the statusline, conversational rendering of Shape F | Barely designed. The Desktop state echo "exists but is under-designed." F-shapes "render conversationally" per canon -- nobody specified *how*. |
| 5 | **State surface** | which room am I in, venture stage, what I decided, what's stale -- feeds Zone 1 + the statusline | The source-of-truth bug that handed Lawrence the wrong active room (the "core power" bug). On Desktop it has *no surface at all*. |

## The reverse salient

**Subsystem 1 -- the token core doesn't exist -- holds back the whole system.** Every other subsystem invents its own values. That's *why* there are ~13 contradictions (no single place to point at), *why* the dashboard template diverges from the `ui-system` skill, *why* the picker feels bolted-on (no shared component spec), *why* a dark mode would *add* colors instead of remapping the five. The CLI renderer only looks healthy because it congealed first -- but it's a standard living in prose, not in tokens.

**Level trap:** the JTBD analysis (`02`) said the *venture's* reverse salient is the **install stack** (Phase 95.6). True -- but a *different level*: distribution, one layer up. The token core is the reverse salient *of the rendering system*. Don't conflate them; don't let token work eat 95.6's oxygen. (And note: there is a *third* reverse salient one level up again -- the **activation layer**, see `09`.)

## Leverage analysis

- **Leverage point:** mint the token core as one canonical artifact -- extend Phase 121.5's `palette.json` into a full **surface-agnostic** token graph (colors + type + spacing + glyphs (with SVG variants) + component specs) + a resolution contract: *every renderer -- CLI, browser, conversational -- resolves against this; nothing redeclares.*
- **Cascade upward:** the `ui-system` skill stops over-claiming and just points at the tokens; the contradiction audit collapses (decide each conflict *once*, in the token file); the browser + conversational renderers get something to build against; the design team gets *one object to redesign* instead of 13 docs to reconcile; dark mode becomes a remap.
- **Unintended consequences:** (1) a token file is only as good as its enforcement -- no linter, it drifts (the stray-`U+2717`-glyph incident proves it); (2) over-tokenizing *too early* locks in CLI-isms that don't fit the browser -- the token core must be surface-agnostic (git->GitHub lesson: the browser is a different *decomposition*, not a re-skin; the conversational surface is a *third*); (3) it doesn't fix install -- separate reverse salient, separate level.
