---
phase: 205-larry-loop-elevation
plan: 01
subsystem: surface-routing-fence
tags: [SCOPE-item-0, D-Q6, CANON-Part8, navigator-vs-internal, generated-registry-single-source]
requires:
  - data/command-registry.json (generated; now carries the two-value `surface` tag)
  - scripts/build-command-registry.cjs (emits the surface tag from frontmatter)
provides:
  - lib/core/surface-fence.cjs - filterToNavigator + the navigator|internal partition read straight off the generated registry
  - lib/mcp/tool-router.cjs parity so the MCP surface honors the same fence
affects:
  - the ranker / suggest-next / Provoked surfacer can never offer internal plumbing (funding/file-meeting/doctor stay navigator-facing though not `methodology`)
tech-stack:
  added: []
  patterns: [generated-registry-single-source, pure-local-read, chokepoint-filter, cli-mcp-parity]
key-files:
  created:
    - lib/core/surface-fence.cjs
    - tests/test-205-surface-fence.cjs
  modified:
    - data/command-registry.json
    - lib/mcp/tool-router.cjs
    - scripts/build-command-registry.cjs
decisions:
  - "D-Q6: the registry `kind` field is the WRONG navigator/plumbing boundary (funding, file-meeting, doctor, heal, deck, show are navigator-facing yet not `methodology`). The correct boundary is a two-value `surface` tag {navigator, internal} emitted onto every registry entry by the generator - a single source of truth, never re-derived from Larry's recall."
  - "filterToNavigator is THE enforced fence (item-0 rule c): the ranker/router calls it at the chokepoint; it reads the surface tag off the generated registry, never hand-rolls a second copy of the partition."
  - "Part 8 safe: pure LOCAL read helper - no filesystem write, no network, no room.db mutation."
metrics:
  completed: 2026-07-01
  reconstructed: "SUMMARY authored 2026-07-02 from shipped commit a26cea62; the earlier pass landed code without a SUMMARY. No code changed."
---

# Phase 205 Plan 01: Surface-vs-Internal Routing Fence (D-Q6) Summary

Closed SCOPE item-0: the navigator-vs-plumbing routing fence. The registry `kind` field was the wrong boundary, so this plan added a two-value `surface` tag (navigator | internal) onto every entry in `data/command-registry.json` (emitted by `scripts/build-command-registry.cjs` from command frontmatter), and `lib/core/surface-fence.cjs` reads that tag straight off the generated registry as the single source of truth. `filterToNavigator` is the enforced chokepoint the ranker / suggest-next / Provoked surfacer call so plumbing is never offered to the navigator. MCP parity landed via `lib/mcp/tool-router.cjs`.

## State on entry

Landed out of order in a prior session as commit `a26cea62` (`feat(205-01): surface:navigator|internal routing fence (D-Q6) on CLI registry + MCP router parity`), an ancestor of `feat/v1.15`, with no SUMMARY. Reconstructed from the shipped source + live test run; no code changed.

## What shipped

- **`lib/core/surface-fence.cjs`** (created) - `filterToNavigator` + the memoized registry read; a PURE LOCAL read helper (no fs write, no network, no room.db mutation - Part 8 safe). Reads the `surface` tag off `data/command-registry.json`; never re-derives the D-Q6 partition.
- **`data/command-registry.json`** (regenerated) - every command entry now carries `surface: navigator|internal`.
- **`scripts/build-command-registry.cjs`** (modified) - emits the surface tag from frontmatter.
- **`lib/mcp/tool-router.cjs`** (modified) - MCP surface honors the same fence (CLI/MCP parity).
- **`tests/test-205-surface-fence.cjs`** (created) - 20 checks.

## Test results (live-verified)

```
$ node tests/test-205-surface-fence.cjs   -> 20 checks passed
$ bash tests/run-all-205.sh               -> ALL 205 TESTS PASS
```

## Canon

- Part 8: pure LOCAL read; no egress.
- Single source of truth: the generated registry, never Larry's recall.
- No em-dashes.

## Commits

- `a26cea62` feat(205-01): surface:navigator|internal routing fence (D-Q6) on CLI registry + MCP router parity
