---
phase: quick-260723-m5d
plan: fix-01
subsystem: ui-system
tags: [design-system, code-review-fix, html-generators, dashboard]
dependency-graph:
  requires: [quick-260723-m5d plan 01 (260723-m5d-SUMMARY.md), 260723-m5d-REVIEW.md]
  provides: [cr-01-cascade-shadow-fix, cr-02-polarity-flip-contrast-fix]
  affects: [scripts/generate-deck.cjs, scripts/generate-hub.cjs, scripts/generate-lobby.cjs, dashboard/index.html]
key-files:
  modified:
    - scripts/generate-deck.cjs
    - scripts/generate-hub.cjs
    - scripts/generate-lobby.cjs
    - dashboard/index.html
decisions:
  - "CR-01 fixed via option (a) (remove colliding properties from each generator's own :root block) rather than option (b) (reorder mosStyleTag() later) because in all 3 files the generator's own :root block also declares OTHER properties (--bg/--surface/--border/--cream in deck; --teal/--cream/--dark/--white/--gray-* in hub and lobby) that must stay untouched, and those don't collide with the canonical names -- removing only the 4-5 colliding property lines is a strictly smaller, more surgical diff than reordering the whole injected block."
  - "deck.html, hub.html, and the SnapshotHub view (generate-snapshot.cjs) retain their own pre-existing internal dark palettes (--bg/--surface/--border/--cream, --dark/--white/--gray-*) by design -- CR-01 only concerns the 5 semantic tokens (--red/--blue/--yellow/--green/--muted) that collide with the canonical names. Full internal palette migration for these generators remains explicitly out of scope (same deferred 'full class migration' noted in the original plan and its own commit message)."
  - "CR-02's Cytoscape node/edge label colors were hardcoded to the resolved --ink literal (#0C0C0D) rather than var(--ink), because Cytoscape.js's own style DSL (JS style objects passed to cytoscape()) does not resolve CSS custom properties -- it expects literal color values, hex, rgb, or its own data()/mapData() functions. Since dashboard/index.html locks data-theme=\"light\" via the higher-specificity :root[data-theme=\"light\"] selector (wins over both the plain :root default and the @media (prefers-color-scheme:dark) override regardless of OS setting), --ink is guaranteed #0C0C0D at all times in this file, so hardcoding the resolved value introduces no drift risk."
  - "CSS hairline dividers (.chat-input-bar/.chat-right border) were pointed at the existing var(--ds-border) alias (already resolving to var(--rule)) rather than a new hand-rolled rgba literal, reusing the established token instead of inventing a new magic number."
metrics:
  duration: "~40 minutes"
  completed: "2026-07-23"
---

# Phase quick-260723-m5d Fix Plan: CR-01 + CR-02 Blocker Remediation Summary

Fixed both BLOCKER findings from `260723-m5d-REVIEW.md`: the CSS-cascade shadowing that silently defeated the M:OS canonical token injection in 3 of 4 HTML generators (CR-01, folding in the WR-02 `--muted` shadow), and the dark-to-light polarity flip in `dashboard/index.html` that left several hardcoded consumers unreadable against the new light canvas (CR-02).

## What Changed

### CR-01 -- Cascade shadowing in generate-deck.cjs, generate-hub.cjs, generate-lobby.cjs

**Root cause:** Each generator injects `mosStyleTag()`'s canonical `:root{--red:#E11D22;--blue:#1E52E0;--yellow:#FFC400;--green:#12A06A;--muted:#5B5B5B;...}` block right after `<head>`, but each file's own pre-existing `<style>` block (later in the same document) redeclared a second `:root` with the identical property names and the old hex values. Same-specificity `:root` rules resolve by source order, so the later (legacy) declaration always won -- the canonical tag rendered in the markup but had zero effect on the actual computed styles.

**Fix applied (option a, per the review's preferred path):** removed only the colliding property declarations from each generator's own `:root` block, leaving every other property (which doesn't collide with the canonical names) untouched:

| File | Removed from own `:root` | Kept in own `:root` (unrelated, no collision) |
|---|---|---|
| `scripts/generate-deck.cjs:130` | `--red`, `--blue`, `--yellow`, `--green`, `--muted` | `--bg`, `--surface`, `--border`, `--cream` |
| `scripts/generate-hub.cjs` `getFullCSS()` | `--red`, `--blue`, `--yellow` | `--teal`, `--cream`, `--dark`, `--white`, `--gray-100/200/300/500/700`, `--shadow-*`, `--radius*` |
| `scripts/generate-lobby.cjs` `getLobbyCSS()` | `--red`, `--blue`, `--yellow` | `--teal`, `--cream`, `--dark`, `--white`, `--gray-500/700` |

Neither hub nor lobby ever declared `--green` or `--muted` (they use `--teal`/`--gray-*` instead), so the collision there was narrower than in deck -- confirmed by grep before editing, not assumed.

No other line was changed in any of the 3 files (var(--red) etc. usages throughout each file automatically pick up the canonical value now that the local override is gone -- no reference-site edits needed).

Commit: `145dfcab`

### CR-02 -- Polarity-flip contrast break in dashboard/index.html

**Root cause:** the `--ds-bg -> var(--paper)` / `--ds-cream -> var(--ink)` alias (landed in the original plan) correctly reassigned roles but flipped the actual light/dark polarity (old `--ds-bg` was near-black `#0D0D0D`, now resolves to near-white `#F4F2EC`). Several hardcoded, non-variable consumers left over from the old dark theme were never migrated and still carry values tuned to read against the OLD dark canvas -- now nearly invisible against the new light one.

**Fix applied:**

| Consumer | File:lines | Old (invisible on light canvas) | New |
|---|---|---|---|
| Cytoscape node label `color` (base `node`, `.section-group`, `.artifact`, `.meeting`, `.speaker`, `.concept`) | dashboard/index.html:638,679,699,775,794,813 | `#F5F0E8` | `#0C0C0D` (resolved `--ink`) |
| Cytoscape active/hover node `border-color` | dashboard/index.html:715 | `#F5F0E8` | `#0C0C0D` |
| `.chat-input-bar` hairline | dashboard/index.html:332 | `rgba(245,240,232,0.1)` | `var(--ds-border)` (aliases to `var(--rule)`) |
| `.chat-right` hairline | dashboard/index.html:381 | `rgba(245,240,232,0.1)` | `var(--ds-border)` |
| Relationship-list hover wash (`buildRelationshipsHTML`) | dashboard/index.html:1368-1370 | `rgba(245,240,232,0.03/0.08/0.03)` | `rgba(12,12,13,0.03/0.08/0.03)` (ink-equivalent decimal RGB, same opacity ramp) |

Cytoscape's own JS style DSL does not resolve CSS custom properties, so those 7 instances were set to the literal resolved `--ink` hex rather than `var(--ink)`. Since `dashboard/index.html` hardcodes `data-theme="light"` and the `:root[data-theme="light"]` selector's attribute-selector specificity beats both the bare `:root` default and the `@media (prefers-color-scheme:dark)` override, `--ink` is guaranteed `#0C0C0D` in this file regardless of OS theme -- confirmed by reading the cascade in the `<style data-mos="v1.1">` block, not assumed.

The two CSS hairline dividers were pointed at the already-existing `--ds-border` alias (which resolves to `var(--rule)`) instead of hand-rolling a new rgba value.

Commit: `efdc6426`

## Verification

**CR-01 -- computed-style check (not just markup grep):** regenerated deck.html, hub.html, lobby.html against a scratch copy of `tests/fixtures/wiki-room-232`, loaded each in Playwright (chromium), and read `getComputedStyle(document.documentElement)` for `--red`/`--blue`/`--yellow`/`--green`/`--muted`. All 3 now resolve to the canonical values:

```
deck.html  {"red":"#E11D22","blue":"#1E52E0","yellow":"#FFC400","green":"#12A06A","muted":"#5B5B5B"}
hub.html   {"red":"#E11D22","blue":"#1E52E0","yellow":"#FFC400","green":"#12A06A","muted":"#5B5B5B"}
lobby.html {"red":"#E11D22","blue":"#1E52E0","yellow":"#FFC400","green":"#12A06A","muted":"#5B5B5B"}
```

Before the fix, these all resolved to the old shadowing hex (`#A63D2F`/`#1E3A6E`/`#C8A43C`/etc.) despite the canonical tag being present in the HTML source -- exactly the bug the review described.

Playwright CLI screenshots (`npx playwright screenshot`, per `feedback_playwright_cli.md`) of all 3 regenerated artifacts, read back via the Read tool: deck.html's artifact-count numerals now render in the brighter canonical yellow/green/blue; hub.html's "Overview" section accent bar renders in canonical red (`#E11D22`); lobby.html's door-tile yellow/red blocks render in the canonical saturated hues. Visual difference from the pre-fix (duller, browner) palette is clearly perceptible.

**CR-02 -- computed-style check + screenshot:** built `dashboard/data-room-dashboard.html` via `scripts/generate-standalone` against the same scratch room, loaded in Playwright, and confirmed:

```
--ds-bg: #F4F2EC (light paper)
--ds-cream: #0C0C0D (dark ink)
--ds-border: rgba(17,17,17,.14)
.chat-input-bar border-top-color: rgba(17,17,17,0.14)
.chat-right border-left-color: rgba(17,17,17,0.14)
```

Screenshot confirms the section-group node labels ("PROBLEM DEFINITION", "MARKET ANALYSIS", etc.) now render as legible dark text against the light cream canvas -- before the fix these would have rendered as near-invisible near-white-on-near-white. Contrast ratio of `#0C0C0D` text against `#F4F2EC` background is well above WCAG 2.1 AA (approximately 19:1), matching the repo's documented convention. Test fixture (`wiki-room-232`) has 0 graph edges and no artifact-level Cytoscape nodes wired into the spine feed, so individual `node`/`node.artifact`/`node.meeting`/etc. selectors could not be visually screenshotted with real data in this pass; the fix was verified structurally (grep confirms zero remaining `#F5F0E8` or `rgba(245,240,232,*)` instances in the file) and the `.section-group` label rendering (which uses the identical color fix) is direct visual proof the same value change produces legible contrast.

## Deviations from Plan

None. Both fixes applied exactly as scoped by the review's recommended remediation, no re-scoping beyond the 2 blockers plus the WR-02 `--muted` fold-in explicitly named in the task brief.

## Deferred (still open, per constraints -- not fixed in this pass)

- **WR-01** (`scripts/generate-snapshot.cjs` / `templates/shared.css`): the canonical tag is injected into SnapshotHub views but `shared.css`'s own `--ds-*` tokens were never aliased onto canonical tokens (no active shadowing bug since the names are namespaced and don't collide, just inert). Not trivial to fold into this pass (would require touching a 5th file, `templates/shared.css`, not named in either blocker) -- left open per the task's explicit "do not touch WARNING-level findings unless trivial" constraint.
- deck.html, hub.html, and the SnapshotHub view's own internal dark palettes (`--bg`/`--surface`/`--border`/`--cream` in deck; `--dark`/`--white`/`--gray-*` in hub/lobby/snapshot) remain unmigrated to canonical tokens -- this is the same "full class migration" gap the original plan's own SUMMARY.md flagged as out of scope (Rule 4 territory, architectural change), unaffected by either blocker fix.

## Self-Check: PASSED

- FOUND: `scripts/generate-deck.cjs` -- `:root` block no longer declares `--red`/`--blue`/`--yellow`/`--green`/`--muted`
- FOUND: `scripts/generate-hub.cjs` -- `getFullCSS()` `:root` block no longer declares `--red`/`--blue`/`--yellow`
- FOUND: `scripts/generate-lobby.cjs` -- `getLobbyCSS()` `:root` block no longer declares `--red`/`--blue`/`--yellow`
- FOUND: `dashboard/index.html` -- zero remaining `#F5F0E8` or `rgba(245,240,232,*)` literals (grep confirmed)
- FOUND commit `145dfcab` (CR-01) -- verified in git log
- FOUND commit `efdc6426` (CR-02) -- verified in git log
- Computed-style Playwright checks for both fixes passed as documented above
