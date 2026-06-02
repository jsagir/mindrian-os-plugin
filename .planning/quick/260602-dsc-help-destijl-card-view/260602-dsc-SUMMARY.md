---
quick_id: 260602-dsc
slug: help-destijl-card-view
kind: quick
created: 2026-06-02
completed: 2026-06-02
status: complete
commit: fa1959a7
---

# Quick Task 260602-dsc: De Stijl card view for /mos:help -- SUMMARY

## What shipped

The user-approved De Stijl CARD view is now the default `/mos:help` text
visualization. `scripts/help-renderer.cjs` no longer prints a flat
1-line-per-command list; it renders four color-coded lanes of 2-line Mondrian
cards, each carrying the command's `help_jtbd` one-liner.

## Changes

- **scripts/help-renderer.cjs** (modified)
  - Replaced `renderHelpColor` + `renderHelpAscii` with a single
    `renderHelpCards(groups, useColor)`.
  - Lanes iterate `LANE_ORDER = [start, methodology, explore, view]`; each lane
    collects commands from every group whose `group.lane` matches. Labels come
    from `groups._lanes` (with an inline fallback map); per-lane color + glyph
    from `LANE_META` (blue/yellow/green/red; the approved prototype glyphs).
  - `useColor=true` emits the DS 24-bit truecolor palette (mirrors
    `lib/core/visual-ops.cjs`); `useColor=false` emits the SAME card layout with
    zero ANSI via color helpers that collapse to `''`.
  - Header is a Mondrian red/yellow/blue block bar + "MindrianOS command map".
  - `renderHelp(opts)` dispatch unchanged in behavior:
    truecolor/256color -> `renderHelpCards(groups, true)`; else
    `renderHelpCards(groups, false)`.
  - `loadGroups`, `readCommandFrontmatter`, `main` preserved. Old
    `renderHelpColor` / `renderHelpAscii` dropped (verified zero external
    importers via `git grep`). `module.exports` now
    `{ renderHelp, renderHelpCards, loadGroups }`.

- **tests/test-help-cards-render.cjs** (new)
  - Color mode: asserts a DS truecolor escape (`\x1b[38;2;`) is present, plus a
    `/mos:<cmd>` + its `help_jtbd` for every non-admin command, plus all 4 lane
    labels.
  - ASCII mode (`useColor=false`): asserts ZERO `\x1b` escapes, same per-command
    + lane coverage.
  - Neither mode prints a `visibility:admin` command (admin, dogfood-flush) or a
    `deprecated_aliases` key.
  - Non-admin set derived from `commands/*.md` frontmatter minus
    `deprecated_aliases`, mirroring `scripts/check-help-coverage.cjs` and
    `tests/test-help-selector-lanes.cjs` (Canon Part 7 -- one visibility
    convention).

- **lib/memory/run-feynman-tests.cjs** (additive registration)
  - One new entry for `tests/test-help-cards-render.cjs` after the lane test;
    every prior entry byte-unchanged.

- **commands/help.md** (body-only)
  - One-line note that the text view is the DS card layout. Frontmatter +
    command registry unchanged (no regen needed).

## Curation frozen

The 84-non-admin / 4-lane contract locked by `tests/test-help-selector-lanes.cjs`
(quick task 260602-rgx) was not touched. This task changed only the
visualization, not which commands show.

## Verification (all green)

- `node tests/test-help-cards-render.cjs` -> 4/4 assertion blocks PASS
  (84 non-admin commands covered)
- `node tests/test-help-selector-lanes.cjs` -> 4/4 PASS (zero regression)
- `node scripts/check-help-coverage.cjs` -> `valid: true` (exit 0)
- `node scripts/help-renderer.cjs` -> exit 0 (cards eyeballed in color + ascii)
- pre-commit hooks -> `command-registry: OK` (committed without `--no-verify`)

## Constraints honored

No em-dashes (hyphens only). CJS, zero new dependencies. Atomic commit with
hooks active. Canon Part 3 (UI), Part 7 (reuse + DS palette mirror), Part 8
(filesystem only, zero network).

## Commit

`fa1959a7` -- feat(help): /mos:help text view becomes the De Stijl card layout (260602-dsc)
