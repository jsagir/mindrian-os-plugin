---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 09
subsystem: ui-system / mcp-apps / docs
tags: [design-canon-v3, ui-system, mcp-apps, seed, docs]
requires: []
provides:
  - "Scoped Design Canon v3 exception in skills/ui-system/SKILL.md (D-01)"
  - "Parked header on lib/mcp/app-html/mindrian-platform.html (D-02)"
  - "SEED-112: MCP App HTML CDN and dark-default debt (C10/C11) on record"
  - "Dated C12 retirement note on MCP-APPS-STRATEGIC-RESEARCH.md"
affects: [every UI-building agent that reads skills/ui-system/SKILL.md]
tech-stack:
  added: []
  patterns: ["house seed format", "text-pin test"]
key-files:
  created:
    - .planning/seeds/SEED-112-mcp-app-html-dark-theme-and-cdn-debt.md
    - tests/test-369-canon-scope-docs.cjs
  modified:
    - skills/ui-system/SKILL.md
    - lib/mcp/app-html/mindrian-platform.html
    - docs/research/MCP-APPS-STRATEGIC-RESEARCH.md
key-decisions:
  - "Exception wording is the UI-SPEC text verbatim (four fonts, incl. JetBrains Mono)"
  - "Seed number 112 was free at execution time; no rename needed"
requirements-completed: [CANON369-01, CANON369-02]
metrics:
  tasks: 2
  files: 5
completed: 2026-10-02
---

# Phase 369 Plan 09: Canon scope docs Summary

The UI shell is now the one named exception to the shipped v1.1 design system in `skills/ui-system/SKILL.md`; the orphan MCP page says it is parked; the CDN and dark-default debt in the three MCP App views is on record as SEED-112; and the "Tier 1 is the product" plan is dated as retired. Everything is pinned by a 5-scenario test.

## What was done

- **Task 1** (commit a381b1fe9): inserted the "Exception (2026-10-02, Phase 369)" paragraph after the section 0 "Applies to" line (2 added lines, 0 deleted); inserted one PARKED comment after `<!DOCTYPE html>` in `mindrian-platform.html` (1 added line, body unchanged); added the C12 status note under the title of `MCP-APPS-STRATEGIC-RESEARCH.md` (2 added lines).
- **Task 2** (commit 8b4f6ce97): wrote `SEED-112-mcp-app-html-dark-theme-and-cdn-debt.md` (house frontmatter, impact, measured file:line list, fix shape, why deferred) and `tests/test-369-canon-scope-docs.cjs`.

Seed debt measured: 10 outside-host references (Google Fonts preconnect and stylesheet in all three views, jsdelivr ext-apps script in all three, cdnjs Cytoscape in graph.html) and 3 dark-default sites (`--ds-bg: #1a1a1a` plus body background in dashboard, wiki, graph).

## Verification

- `node tests/test-369-canon-scope-docs.cjs`: PASS 5/5
- `node tests/test-143.2-doctrine-presence.cjs`: PASS
- `node tests/test-gate-native-fire-w1.cjs`: PASS (12 assertions)
- `git diff --stat` on app-views.cjs, surface-detect.cjs, dashboard.html, wiki.html, graph.html: empty before commit (untouched).

## Navigator note (font drift)

D-01 lists three fonts; the UI-SPEC and this exception list four, adding JetBrains Mono (status words, ids, legends, timestamps). The exception uses the UI-SPEC wording verbatim. The navigator can confirm or strike JetBrains Mono at plan 20's blocking font legitimacy checkpoint, the first point where the font set becomes packages; if struck, the SKILL.md paragraph and test scenario 1 need the same edit.

## Deviations from Plan

None - plan executed as written. Two small notes: SKILL.md and the research doc each show 2 added lines (one blank separator plus the paragraph); seed number 112 was still free.

## Known Stubs

None.

## Threat Flags

None. T-369-09-01 mitigated (exception names only the shell, additions-only diff, position pinned); T-369-09-03 mitigated (dated PARKED header, app-views.cjs reference check); T-369-09-02 accepted and filed as SEED-112.

## Self-Check: PASSED

All five files exist; commits a381b1fe9 and 8b4f6ce97 are in `git log`.
