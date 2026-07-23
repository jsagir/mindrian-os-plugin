---
phase: 260723-m5d-complete-m-os-canonical-design-system-v1
reviewed: 2026-07-23T13:45:17Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - dashboard/export-template.html
  - dashboard/index.html
  - scripts/generate-deck.cjs
  - scripts/generate-hub.cjs
  - scripts/generate-lobby.cjs
  - scripts/generate-snapshot.cjs
  - skills/ui-system/SKILL.md
  - skills/ui-system/rules/design-system.md
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 260723-m5d: Code Review Report

**Reviewed:** 2026-07-23T13:45:17Z
**Depth:** quick (extended with targeted diff/cascade tracing per reviewer brief)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the three commits that make up this quick task (`fcd28852` wire 4 generators to `mosStyleTag()`, `e80e9403` bake canonical tokens into the 2 dashboard templates, `41bb23d1` doc mandate). I traced actual CSS cascade behavior rather than trusting that "the tag is present" means "the mandate is applied," and traced the dashboard's polarity change against every consumer of the aliased variables (CSS and inline JS/Cytoscape alike).

Two BLOCKERs found, both because a value-level or cascade-level consequence of the alias/injection wasn't traced all the way to its consumers:

1. In 3 of the 4 wired generators (deck, hub, lobby), the injected canonical `--red`/`--blue`/`--yellow` (and `--green` in deck) custom properties are immediately shadowed by a second, later `:root` block in the same document that redeclares the identical property names with the old non-canonical hex values. CSS gives the later same-specificity declaration priority, so the M:OS mandate has **zero visual effect** on these three outputs even though the tag renders in the HTML source.
2. `dashboard/index.html`'s `--ds-bg`/`--ds-cream` alias is a genuine **polarity flip** (dark bg -> light paper, light cream text -> dark ink), unlike `export-template.html`'s polarity-preserving alias. The flip breaks every hardcoded (non-variable) consumer left over from the old dark theme: Cytoscape node/edge label color `#F5F0E8` and several `rgba(245,240,232,x)` hover/hairline overlays, all of which were sized to read against the old dark canvas and are now close-to-invisible against the new light one.

The one thing specifically flagged in the task brief -- whether `--ds-cream` (used exclusively as text/border color) was aliased to `var(--ink)` rather than a background token -- **is correct** in both dashboard files; that particular landmine was avoided. `mosStyleTag()` is also defensively coded and confirmed safe (try/catch around the file read, returns `''` on any failure, never throws). No em-dashes were introduced by any of the three commits (pre-existing em-dashes in unrelated `<meta>` tags in both dashboard files predate this task and are out of scope).

## Critical Issues

### CR-01: Canonical color tokens are silently shadowed by legacy `:root` blocks in 3 of 4 wired generators -- the M:OS mandate has no visual effect there

**File:** `scripts/generate-deck.cjs:118-130`, `scripts/generate-hub.cjs:2264-2273` (`getFullCSS()` at line 780-786), `scripts/generate-lobby.cjs:641-649` (`getLobbyCSS()` at line 335-344)

**Issue:** Each of these three generators now emits, immediately after `<head>`, the canonical style tag:
```html
<style data-mos="v1.1">:root{ ... --red:#E11D22; --blue:#1E52E0; --yellow:#FFC400; --green:#12A06A; ... }</style>
```
But a few lines later in the same `<head>`, the file's own pre-existing (unmodified) `<style>` block re-declares `:root` with the SAME property names and the OLD hex values, e.g. `generate-deck.cjs`:
```css
:root{--red:#A63D2F;--blue:#1E3A6E;--yellow:#C8A43C;--green:#2A6B5E;--bg:#0a0a0f;...}
```
and `generate-lobby.cjs` `getLobbyCSS()`:
```css
:root { --red: #A63D2F; --blue: #1E3A6E; --yellow: #C8A43C; --teal: #2A6B5E; ... }
```
and `generate-hub.cjs` `getFullCSS()`:
```css
:root { --red: #A63D2F; --blue: #1E3A6E; --yellow: #C8A43C; --teal: #2A6B5E; ... }
```
Both blocks are `:root` selectors of identical specificity in the same cascade; per the CSS spec, the *later* declaration wins for a given property. Since the legacy block is textually later in every one of these three files, every downstream `var(--red)`, `var(--blue)`, `var(--yellow)` (and `var(--green)` in deck) reference in that file's own CSS resolves to the OLD literal hex, not the canonical M:OS value. Visually, deck.html, hub.html-family pages, and index.html (lobby) render byte-for-byte the same palette they did before this task -- the wiring changed the HTML source but not a single rendered pixel.

This is exactly the "sounds plausible but doesn't work" failure mode: `git log`/`git show` confirms the tag is emitted, but no verification was done that the tag's values actually reach the rendered page once cascade order is accounted for.

**Fix:** Either (a) delete/rename the colliding custom properties in each generator's own `:root` block (`--red`/`--blue`/`--yellow`/`--green`) and update every `var(--red)` etc. reference in that file to consume the canonical tokens directly, or (b) if the generator's palette must stay independent, rename its local tokens to a non-colliding namespace (e.g. `--deck-red`) so the canonical tag isn't clobbered. Add a lint/test step that renders one of these generated files and asserts `getComputedStyle(document.documentElement).getPropertyValue('--red').trim() === '#E11D22'` so a future silent-shadow regression fails CI instead of shipping quietly.

---

### CR-02: `dashboard/index.html` polarity flip (`--ds-bg` dark->light, `--ds-cream` light->dark) breaks un-migrated hardcoded Cytoscape colors and hover overlays -- graph labels become near-invisible

**File:** `dashboard/index.html:50-63` (alias block), consumed at `dashboard/index.html:638,679,699,775,794,813` (Cytoscape node/edge `'color': '#F5F0E8'`) and `dashboard/index.html:332,381,1368-1370` (`rgba(245,240,232,x)` overlays)

**Issue:** Before this task, `dashboard/index.html` had a self-consistent dark theme: `--ds-bg: #0D0D0D` (near-black canvas) paired with `--ds-cream: #F5F0E8` (near-white text/labels) -- confirmed via `git show e80e9403 -- dashboard/index.html`. The alias commit changed the *role* mapping correctly (`--ds-bg -> var(--paper)`, a background token; `--ds-cream -> var(--ink)`, a text token) but did not notice that `--paper` (#F4F2EC) and the old `--ds-bg` (#0D0D0D) are on **opposite ends of the light/dark spectrum** -- this is a polarity flip, not a same-polarity re-skin (contrast `export-template.html`, where `--mondrian-black -> var(--ink)` and `--mondrian-white -> var(--paper)` preserved the existing dark-anchor/light-anchor pairing, so no regression there).

Everything driven purely by the aliased CSS variables stays internally consistent (dark ink text on light paper backgrounds throughout the CSS rules). But the Cytoscape graph styling embedded in the `<script>` block was never touched and still hardcodes the OLD text color meant to read against the OLD dark canvas:
```js
{ selector: 'node', style: { 'background-color': 'data(color)', 'color': '#F5F0E8', 'text-valign': 'bottom', ... } }
```
Base `node`, `node.meeting`, `node.speaker`, and `node.concept` selectors all render their label with `text-valign: 'bottom'` (i.e. floating on the bare canvas, not inside a filled node shape) in `#F5F0E8` (near-white). `#cy { background: var(--ds-bg); }` now resolves to `#F4F2EC` (near-white paper). Near-white text on a near-white canvas is effectively unreadable -- this affects the majority of node types the "spine" graph feed emits (per the R4 comments in the same file, most node types other than `.artifact`/`.section-group` fall through to the base `node` selector).

The same root cause also breaks three hover/hairline affordances that hardcode the *old* `--ds-cream` RGB value directly instead of referencing the variable:
```css
.chat-input-bar { border-top: 1px solid rgba(245,240,232,0.1); }   /* line 332 */
.chat-right     { border-left: 1px solid rgba(245,240,232,0.1); }  /* line 381 */
```
and in `buildRelationshipsHTML()`:
```js
'background:rgba(245,240,232,0.03)' ... onmouseover 'rgba(245,240,232,0.08)' ... onmouseout 'rgba(245,240,232,0.03)'  // lines 1368-1370
```
These were originally a faint light-tint wash meant to read against a dark surface; at 3-10% opacity against the new near-white canvas they are now essentially invisible, so the relationship-list hover state and the two hairline dividers silently stop doing anything visible.

**Fix:** Either keep this specific dashboard on its original dark polarity (don't collapse `--ds-bg`/`--ds-cream` onto `--paper`/`--ink` -- alias them to the dark-mode token values instead, e.g. via `:root[data-theme="dark"]` overrides, or simply set `data-theme="dark"` on this page since it is a graph-visualization surface, not a document-reading surface), OR finish the migration by replacing every hardcoded `#F5F0E8` node/edge label color with `var(--ink)` and every `rgba(245,240,232,x)` overlay with an ink-based equivalent (e.g. `rgba(12,12,13,x)`), so the graph's own JS-driven styling tracks the same light-theme polarity the CSS was moved to.

## Warnings

### WR-01: `generate-snapshot.cjs`'s SnapshotHub views inject the canonical tag but the actual page CSS (`templates/shared.css`) still defines its own un-aliased dark `--ds-*` palette -- the mandate is wired but inert here too

**File:** `scripts/generate-snapshot.cjs:473` (mosStyleTag() call), `templates/shared.css:8-40`

**Issue:** Unlike deck/hub/lobby, `shared.css`'s tokens are namespaced (`--ds-bg`, `--ds-red`, etc.) so they don't collide with the canonical `--red`/`--blue`/`--yellow`/`--green` names -- no active shadowing bug. But `shared.css` was never touched to alias its own `--ds-*` tokens onto the canonical `--paper`/`--ink`/`--red` etc. (contrast the role-based alias layer that WAS added to `dashboard/index.html` and `dashboard/export-template.html`). `shared.css` still hardcodes `--ds-bg: #1a1a1a` and friends directly, per its own header comment "De Stijl Design System - Dark Theme". So the seven SnapshotHub views (`index.html`, `library.html`, `narrative.html`, etc.) get the canonical CSS custom properties injected into the page (unused), while every visible pixel is still driven by the old, un-migrated `--ds-*` values in `shared.css`. This isn't actively broken (no polarity flip like CR-02, since `shared.css` was never touched at all), but it means the "M:OS Canonical Design System v1.1... wired into 4 HTML generator scripts" claim is only true for `generate-snapshot.cjs` in the sense that the tag is present in the markup, not that the design system governs the output.

**Fix:** Apply the same role-based alias treatment done for the two dashboard templates to `templates/shared.css`'s `:root` block (map `--ds-bg -> var(--paper)`, `--ds-cream -> var(--ink)`, `--ds-red -> var(--red)`, etc.), or explicitly scope this file out of the v1 mandate with a documented reason if the SnapshotHub dark theme is intentionally exempt.

### WR-02: `getLobbyCSS()` / `getFullCSS()` / deck's inline `:root` also shadow `--muted`, further widening CR-01's blast radius

**File:** `scripts/generate-deck.cjs:130`

**Issue:** `generate-deck.cjs`'s own `:root` block also redeclares `--muted: #888`, which shadows the canonical `--muted: #5B5B5B` injected by `mosStyleTag()` for the same reason as CR-01 (later same-specificity `:root` wins). Called out separately from CR-01 because `--muted` is a role token (not one of the four semantic De Stijl colors) and might be missed when fixing CR-01 if the fix only touches `--red`/`--blue`/`--yellow`/`--green`.

**Fix:** Include `--muted` in the CR-01 remediation sweep for `generate-deck.cjs`.

## Info

### IN-01: Confirmed correct -- `--ds-cream` role mapping and `mosStyleTag()` safety

**File:** `dashboard/index.html:53`, `dashboard/export-template.html` (mondrian-white/black block), `lib/ui/design-system.cjs:7-18`

Two items the task brief specifically asked to verify came back clean:
- `--ds-cream: var(--ink)` in both dashboard files is aliased to a foreground/text token, matching its exclusive use as text/border color throughout the CSS -- the landmine the executor flagged was correctly avoided.
- `mosStyleTag()` / `readDesignSystemCss()` in `lib/ui/design-system.cjs` wrap the `fs.readFileSync` in try/catch, cache to `''` on any failure, and `mosStyleTag()` returns `''` (not a throw) when the CSS bundle is missing -- confirmed safe for all 4 call sites (`generate-deck.cjs:121`, `generate-hub.cjs:2264`, `generate-lobby.cjs:641`, `generate-snapshot.cjs:473`), each of which is a synchronous `require(...).mosStyleTag()` call inline in a template literal with no surrounding try/catch of its own (none needed, since the callee never throws).

No em-dashes were introduced by commits `fcd28852`, `e80e9403`, or `41bb23d1` (verified against the actual diffs, not just a raw grep of file contents -- the em-dashes present in `dashboard/index.html` and `dashboard/export-template.html` today are pre-existing `<meta>`-tag content untouched by this task).

---

_Reviewed: 2026-07-23T13:45:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
