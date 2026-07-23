---
phase: quick-260723-m5d
plan: 01
subsystem: ui-system
tags: [design-system, html-generators, dashboard, skills-docs]
dependency-graph:
  requires: [e9db0d1c (Phase 232-01 CSS bundle + loader + docs cherry-pick)]
  provides: [mosStyleTag-wiring-4-generators, dashboard-token-alias-layer, design-system-mandate-docs]
  affects: [scripts/generate-deck.cjs, scripts/generate-hub.cjs, scripts/generate-lobby.cjs, scripts/generate-snapshot.cjs, dashboard/index.html, dashboard/export-template.html, skills/ui-system/SKILL.md, skills/ui-system/rules/design-system.md]
tech-stack:
  added: []
  patterns: ["inline require() of lib/ui/design-system.cjs mosStyleTag() at HTML head call sites", "role-based CSS custom-property aliasing in place (no new competing :root blocks)"]
key-files:
  created:
    - skills/ui-system/rules/design-system.md
  modified:
    - scripts/generate-deck.cjs
    - scripts/generate-hub.cjs
    - scripts/generate-lobby.cjs
    - scripts/generate-snapshot.cjs
    - dashboard/index.html
    - dashboard/export-template.html
    - skills/ui-system/SKILL.md
decisions:
  - "Ported a9e1ee88's 2-line generator fix verbatim (data-theme=light + inline mosStyleTag() require), unchanged, no internal palette migration -- matches the plan's explicit 'do not touch any other line' scope boundary."
  - "Dashboard alias layer applied as in-place :root value edits (no second competing :root block), per the plan's explicit anti-cascade-ambiguity requirement."
  - "skills/ui-system/rules/design-system.md gained YAML frontmatter (name/description) that a9e1ee88's original version lacked, to match the sibling rules/dual-palette.md convention that postdates the branch cut."
metrics:
  duration: "~35 minutes"
  completed: "2026-07-23"
---

# Phase quick-260723-m5d Plan 01: Complete M:OS Canonical Design System v1.1 bake-in Summary

Wired all 4 CLI HTML generators to `mosStyleTag()` + `data-theme="light"`, baked the canonical M:OS token block plus a role-based CSS-variable alias layer into both dashboard templates, and authored the SKILL.md section 0 + rules/design-system.md mandate docs that `M-OS-DESIGN-SYSTEM.md` section 12 already forward-referenced -- landing the 6 files that commit `a9e1ee88` shipped but that never made it off its unmerged branch.

## What Changed

### Task 1 -- 4 HTML generators wired to mosStyleTag()

`scripts/generate-deck.cjs`, `scripts/generate-hub.cjs`, `scripts/generate-lobby.cjs`, `scripts/generate-snapshot.cjs`: each `<html lang="en">` on the head template literal became `<html lang="en" data-theme="light">`, with a new line immediately inside `<head>` containing `${require("../lib/ui/design-system.cjs").mosStyleTag()}`. Verbatim port of `a9e1ee88`'s 2-line fix, identical shape across all 4 files. No other line touched; executable bit (755) preserved on all 4 (confirmed via `ls -la` before and `node -c` syntax check after).

Commit: `fcd28852`

### Task 2 -- Canonical tokens + role-based alias layer, 2 dashboard templates

`dashboard/index.html` and `dashboard/export-template.html` (both statically served, zero templating -- CSS baked as literal text, no `require()` calls):

- Both `<html lang="en">` -> `<html lang="en" data-theme="light">`.
- Both get a new `<style data-mos="v1.1">` block (lines 12-32 of `skills/ui-system/design-system/mos-design-system.css`, copied verbatim: surfaces, De Stijl primaries, devices, dark-mode media query, and the `data-theme` light/dark override blocks), preceded by the mandated HTML comment, inserted immediately before each file's existing `<style>` tag.
- Existing `:root` blocks aliased **in place** (same property names, new values pointing at canonical tokens by ROLE, not name similarity) -- no second competing `:root` rule added.

**dashboard/index.html alias table applied:**

| Property | Old | New | Role |
|---|---|---|---|
| --ds-bg | #0D0D0D | var(--paper) | background |
| --ds-surface | #1A1A1A | var(--panel) | background |
| --ds-elevated | #2A2A2A | var(--panel) | background |
| --ds-cream | #F5F0E8 | var(--ink) | text |
| --ds-muted | #A09A90 | var(--muted) | muted text/border |
| --ds-border | #2A2A2A | var(--rule) | border |
| --ds-red | #A63D2F | var(--red) | accent |
| --ds-blue | #1E3A6E | var(--blue) | accent |
| --ds-yellow | #C8A43C | var(--yellow) | accent |
| --ds-green | #2D6B4A | var(--green) | accent |
| --ds-sienna / --ds-gray / --ds-amethyst / --ds-teal | (literal) | unchanged | legend/edge-type swatches, no canonical equivalent |

**dashboard/export-template.html alias table applied:**

| Property | Old | New | Role |
|---|---|---|---|
| --mondrian-red | #C23B22 | var(--red) | accent |
| --mondrian-blue | #1B3B6F | var(--blue) | accent |
| --mondrian-yellow | #E8B931 | var(--yellow) | accent |
| --mondrian-black | #1A1A1A | var(--ink) | body/topbar bg + text |
| --mondrian-white | #F7F3ED | var(--paper) | content-card bg |
| --mondrian-gray | #D4CFC7 | var(--muted) | muted text/border |
| --accent-green | #2D6B4A | var(--green) | status text |
| --accent-sienna | #B5602A | unchanged | status text, no canonical equivalent |
| --grid-border / --grid-border-thin | (references --mondrian-black) | unchanged declarations | inherits automatically |

Zero remaining hardcoded hex for any aliased property; sienna/gray/amethyst/teal (index.html) and accent-sienna (export-template.html) coexist as literal hex with no name collisions. Zero `require()` calls in either static file.

Commit: `e80e9403`

### Task 3 -- Skill mandate docs + regeneration + Playwright visual verification

- `skills/ui-system/SKILL.md`: new `## 0. HTML Artifact Design System -- M:OS canonical (MANDATORY)` section inserted immediately before `## 1. Four-Zone Output Anatomy`, ported verbatim from `a9e1ee88`'s diff. No existing section renumbered.
- `skills/ui-system/rules/design-system.md` (new file): YAML frontmatter added (`name: design-system` + description) to match the sibling `rules/dual-palette.md` convention -- `a9e1ee88`'s original had none. Body (five laws, defaults, isometric/structural-futurism, imagery, data representations, applies-to) ported verbatim from `git show a9e1ee88:skills/ui-system/rules/design-system.md`, 48 lines unchanged.

Commit: `41bb23d1`

## Regeneration + Playwright Verification

Built a scratch copy of `tests/fixtures/wiki-room-232` outside the tracked repo (`/tmp/.../scratchpad/room-*`), ran all 6 downstream artifact generators against it, and screenshotted each via `npx playwright screenshot` (CLI, not the MCP plugin, per `feedback_playwright_cli.md`). No `room.db`/graph-data fixture issue was encountered -- `build-graph-from-sqlite.cjs` ran cleanly against the fixture as-is (8 nodes, 0 edges), so the constraint's re-scaffold fallback was not needed.

All 6 artifact types carry `data-mos="v1.1"`, and grep confirms zero literal `${require(...)}` text leaked into any of the 6 outputs.

Per-artifact visual findings (Read back from PNG):

| Artifact | Ground | Notes |
|---|---|---|
| deck.html | dark (unchanged) | generate-deck.cjs's own internal `:root{--bg:#0a0a0f;...}` (its own separate dark palette, declared under different var names than the injected mosStyleTag() block) still controls `body{background:var(--bg)}`. Task 1's scope was the 2-line head wiring only -- no internal palette migration was in scope. This is the same "full class migration" deferred in `a9e1ee88`'s own commit message. |
| hub.html | dark header / white content cards | Own pre-existing internal palette, unaffected by the token overlay for the same reason as deck. |
| lobby.html | cream, black header banner | Already cream by lobby.cjs's own original design (unrelated to this plan's token work) -- matches the "cream ground" success criterion by coincidence of prior design, not by new wiring. |
| standalone.html (dashboard/index.html via generate-standalone) | **cream** | Confirms Task 2's alias layer worked: `--ds-bg` now resolves through `var(--paper)`, visibly cream where it was literal near-black `#0D0D0D` before. |
| export.html (dashboard/export-template.html via generate-export.cjs) | dark full-page shell, white content cards | `body{background:var(--mondrian-black)}` is a pre-existing selector (not touched by Task 2's explicit `:root`-only scope). `--mondrian-black` was `#1A1A1A` before and is now `var(--ink)` = `#0C0C0D` -- functionally the same near-black value, so **zero visual regression**, matching the plan's "zero visual contrast regressions" requirement. The page was never cream before this plan and Task 2's scope boundary (in-place `:root` value edits only, no selector/class changes) does not touch `body`'s own background rule. |
| snapshot (SnapshotHub index.html) | dark | Same as deck/hub: generator's own internal palette untouched, per Task 1's 2-line-only scope. |

**Known scope gap vs. the plan's `must_haves.truths` bullet:** the plan's frontmatter asserts a Playwright pass should show "a cream/light ground with no leftover dark-mode chrome" across all 6 artifact types. In practice, 3 of 6 (deck, hub, snapshot) retain their own pre-existing internal dark palettes because Task 1's action text explicitly scoped the fix to the 2-line head wiring only ("Do not touch any other line in these 4 files") and Task 2's scope was explicitly limited to the 2 dashboard templates' `:root` blocks. This is not a regression introduced by this plan -- it is the same gap `a9e1ee88`'s own commit message flagged as a deferred "Follow-up" ("full class migration of the two legacy templates to M:OS components; render-verify each artifact on cream"). Fixing it would require a full class migration, which both Task 1 and Task 2's action text explicitly place out of scope (Rule 4 territory -- architectural change, not auto-fixable under Rules 1-3). Flagging here rather than silently expanding scope.

No literal `${require(...)}` text rendered as page content in any of the 6 screenshots; no broken layout; export.html and standalone.html both correctly inherited the fix with zero code changes to `generate-standalone` or `generate-export.cjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a typo introduced during my own Task 2 edit**
- **Found during:** Task 2, immediately after editing dashboard/export-template.html
- **Issue:** transcribed `Menlo,Consonas,monospace` instead of `Menlo,Consolas,monospace` in the injected `--mono` token line
- **Fix:** corrected to `Consolas`
- **Files modified:** dashboard/export-template.html
- **Commit:** e80e9403 (fixed before commit, not a separate commit)

No other deviations. All 3 tasks executed per plan; the known scope gap documented above is a pre-existing tension in the plan's own success criteria vs. its explicit task-level scope boundaries, not an execution deviation.

## Verification Results

- `for f in scripts/generate-{deck,hub,lobby,snapshot}.cjs; do grep data-theme + mosStyleTag; done` -- all 4 pass (TASK1 OK).
- `grep -c 'data-mos="v1.1"' dashboard/index.html dashboard/export-template.html` -- both = 1 (TASK2 OK, plus role-alias grep checks all pass).
- All 6 regenerated artifact types grep `data-mos="v1.1"` -- all pass (TASK3 OK).
- `grep '## 0. HTML Artifact Design System' skills/ui-system/SKILL.md` and `test -f skills/ui-system/rules/design-system.md` -- both pass.
- Em-dash scan: zero matches in all 6 files this plan authored/edited content in (4 generators + SKILL.md + rules/design-system.md). The 2 dashboard files retain pre-existing em-dashes in untouched attribution/meta-tag lines (outside Task 2's explicit `:root`-only scope boundary) -- not introduced by this plan, not fixed per the scope boundary ("do not touch any other line/selector").
- Playwright screenshots of all 6 artifact types, read back via Read tool: confirmed above, table included.
- `node -c` syntax check passed on all 4 modified generator scripts.
- No package installs; no auth gates encountered.

## Known Stubs

None -- no new stub/placeholder data introduced.

## Threat Flags

None -- this plan only changed CSS/head wiring (per its own threat model's disposition), no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- FOUND: scripts/generate-deck.cjs (data-theme + mosStyleTag present)
- FOUND: scripts/generate-hub.cjs (data-theme + mosStyleTag present)
- FOUND: scripts/generate-lobby.cjs (data-theme + mosStyleTag present)
- FOUND: scripts/generate-snapshot.cjs (data-theme + mosStyleTag present)
- FOUND: dashboard/index.html (data-mos="v1.1" + alias table applied)
- FOUND: dashboard/export-template.html (data-mos="v1.1" + alias table applied)
- FOUND: skills/ui-system/SKILL.md (section 0 present)
- FOUND: skills/ui-system/rules/design-system.md (created, frontmatter + body present)
- FOUND commit fcd28852 (Task 1) -- verified in git log
- FOUND commit e80e9403 (Task 2) -- verified in git log
- FOUND commit 41bb23d1 (Task 3) -- verified in git log
