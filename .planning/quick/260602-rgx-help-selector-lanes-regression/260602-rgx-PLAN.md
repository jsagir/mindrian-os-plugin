---
quick_id: 260602-rgx
slug: help-selector-lanes-regression
kind: quick
created: 2026-06-02
description: Regression test that locks the /mos:help selector-menu lane contract (all non-admin commands covered, admin/aliases excluded)
---

# Quick Task 260602-rgx: harden the /mos:help selector-menu feature

## Why
`/mos:help` was rebuilt as a Shape F drill-down selector (commands/help.md) over
`data/help-groups.json` (per-group `lane:` of start|methodology|explore|view), showing
ALL non-admin commands; only `visibility: admin` commands (`admin`, `dogfood-flush`) are
hidden. That feature shipped as ad-hoc edits with no regression test. This quick task
adds the missing test so a future edit cannot silently orphan a command from a lane,
leak an admin command into help, or drift the lane enum.

## Task boundary (do NOT change curation)
- Do NOT change which commands appear. Keep all 84 non-admin commands.
- Test-only + 1 additive runner registration. No production-logic change to the renderer
  or commands/help.md.

## Deliverable: tests/test-help-selector-lanes.cjs
A CJS node:assert test (zero new deps) asserting:
1. Every group in `data/help-groups.json` declares a `lane` in the closed set
   {start, methodology, explore, view}.
2. The 4 lanes collectively cover every non-admin command EXACTLY once: build the
   non-admin command set from `commands/*.md` (a command is non-admin when its
   frontmatter `visibility` is not `admin`) minus the `deprecated_aliases` keys; assert
   the union of all group command lists equals that set, with no command appearing in
   two groups (no dup) and none orphaned (full coverage).
3. No `visibility: admin` command (`admin`, `dogfood-flush`) and no `deprecated_aliases`
   key appears in any group.
4. `scripts/help-renderer.cjs` text view exits 0 and its stdout contains a `/mos:<cmd>`
   line for every non-admin command.

## Registration
Add the suite to `lib/memory/run-feynman-tests.cjs` additively (every existing entry
byte-unchanged).

## Verify
- `node tests/test-help-selector-lanes.cjs` -> all assertions PASS.
- `node scripts/check-help-coverage.cjs` -> exit 0 (zero regression).
- `node scripts/help-renderer.cjs` -> exit 0.

## Constraints
NO em-dashes (hyphens). CJS only, zero new deps. Atomic commits WITH hooks (never
--no-verify; the Phase 128 substrate guard + command-registry + brain-boundary scans
must pass). Write `260602-rgx-SUMMARY.md` on completion.
