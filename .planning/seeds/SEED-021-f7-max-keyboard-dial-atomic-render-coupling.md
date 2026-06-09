# SEED-021: F.7-max keyboard dial + atomic render coupling

- **Surface:** F.7 dial-TUI (`lib/hmi/dial-presenter.cjs`, `lib/hmi/shape-f1-renderer.cjs`, `scripts/intent-classifier.cjs` renderEngineDecisionWithDial) / Phase 144 engine arm
- **Class:** Architecture / reliability + UX capability gap
- **Filed:** 2026-06-09, from a live navigator report ("triangles, not toggleable with keyboard, no checkbox at all") + deep-research sweep of Claude Code's 7 native toggleable TUI components
- **Decided with navigator via live F.7-max demo card** (AskUserQuestion, single-pick previews + multiSelect checkboxes in one card)

## Finding 1: split-render failure mode (the bug class)

The F.7 dial is two decoupled halves:

| Half | Owner | Output |
|---|---|---|
| Picture | `dial-presenter.cjs` (script) | `▶`/`▷` glyphs + confidence column as a STRING |
| Live card | Larry (model tool-call) | AskUserQuestion -> keyboard-navigable picker |

When `routing_source == 'engine'` both fire. When the engine is silent (stale
session, legacy + tier_0, BRAIN.md absent), only the picture renders: triangles
that LOOK interactive but accept no keys. A renderer that draws an
interactive-looking control as static text, and depends on a separate model
tool-call to make it real, will always have this failure mode.

**Decision (navigator-selected): ATOMIC COUPLING.** Never emit the triangle
text unless the AskUserQuestion card fires in the same response. No card, no
picture. (Honest-fallback restyling was considered and NOT selected as the
gate; it may still serve Mode B / degraded installs, but the acceptance
criterion is atomicity.)

**Phase 144 acceptance criterion:** text triangles and live card are always
emitted atomically, never text-only.

## Finding 2: the host card has unused keyboard power (F.7-max)

Plugin constraint inventory (researched 2026-06-09): a plugin cannot render a
bespoke widget or a `[✓]` checkbox of its own -- the only host checkbox
(`/plugins` Installed tab) is host-owned and bugged as of June 2026. The ONLY
interactive surface a plugin gets is AskUserQuestion. But F.7 uses a fraction
of it:

| Host capability | F.7 today | F.7-max |
|---|---|---|
| `multiSelect: true` -> Space-toggle checkboxes | never used | Q2 modifier pane |
| `preview` -> side-by-side monospace panel (single-select only) | never used | Q1 De Stijl panels |
| Up to 4 questions per card | 1 | 2 (reach + modifiers) |
| Header chips, arrow/number keys, Other row | partial | full |

Key constraint: previews XOR checkboxes PER QUESTION, but both ride ONE card
across two questions. That is the maximal keyboard surface available.

## F.7-max spec (all four selected by navigator)

1. **De Stijl previews per reach.** Q1 single-pick gains a `preview` panel per
   reach: Mondrian block art (box-drawing + block glyphs, color budget per
   DESIGN-CANON), confidence bar, JTBD one-liner, evidence count. Previews are
   monospace markdown -- the De Stijl surface a plugin is allowed to draw.
2. **Checkbox modifier pane.** Q2 `multiSelect: true`: space-toggleable
   modifiers riding the same card (e.g. consult Brain first / file outcome as
   decision / open evidence trail). One reach per beat is PRESERVED: Q1 stays
   single-pick; modifiers decorate the chosen reach, they do not multiply it.
3. **Confidence bar glyphs.** Replace bare `NN%` with a bar in the option
   description: `████▓░░ 82%`. Dial states S1-S5 keep their marker semantics;
   the bar is a format-layer addition (dial-presenter, never the core).
4. **Tier-0 honest cold card.** Cold room (S3/S4) renders the CARD anyway with
   `--` confidence and "start anywhere" framing. Keyboard interactivity never
   disappears; only the ranking does. (Composes with atomic coupling: tier_0
   fires the card too, so there is never a text-only render on any tier.)

## Constraints honored

- SEED-020 (no bespoke widget): F.7-max is still 100% AskUserQuestion.
- MAX_K=3 / DIAL_REACH_K=6 / 0.70/0.15 frozen contracts untouched (Phase 148).
- Selector-decision edges unchanged: Q1 close still writes SELECTED_REACH /
  PIVOTED / recordSelectorMiss; Q2 toggles land as properties on the same
  decision event, not new edge types (Canon Part 4 vocabulary frozen).
- Canon Part 8: previews carry generic framework handles + room-local labels
  only; presenter still makes zero Brain calls.

## Priority

Medium. Finding 1 is the reliability fix (gates Phase 144 acceptance).
Finding 2 is additive UX riding the same render-unlock code path (150-06).
