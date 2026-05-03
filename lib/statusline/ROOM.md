# lib/statusline/

ICM Layer 0 identity for the statusline visibility subsystem (per CLAUDE.md decision #15).

## Purpose

Shared modules that support the MindrianOS statusline visibility surface across
CLI / Desktop / Cowork. Phase 106 (statusline-visibility-context-window-broadcast)
introduced this directory; the substrate is consumed by:

- scripts/context-monitor (CLI rich statusline renderer; Phase 106 D-02)
- scripts/statusline-fallback-echo.cjs (Desktop / Cowork prose echo; Phase 106 D-04)
- scripts/doctor.cjs class G (visibility detector; Phase 106 D-03)

## Modules

- banner-suppression.cjs - shouldSuppress(touchFileContent, currentVersion, now).
  24h timing + version-bump invalidation contract for the one-time visibility
  banner. Extracted from the Plan 106-03 inline contract. Pure function, no I/O.
- surface-detect.cjs - detectStatuslineSurface() returns 'CLI' / 'DESKTOP' /
  'COWORK'. Distinct from lib/mcp/surface-detect.cjs (which picks MCP transport
  at server startup; lowercase strings + transport field).

## Canon

- Part 3: statusline + fallback echo are LOCAL-context surfaces for the Decision Gate.
- Part 8: zero remote egress; reads are local files only. Telemetry stays local.

## Tests

- tests/test-statusline-banner-suppression.cjs - 5 contract tests (Plan 106-03
  fenced inline; Plan 106-04 swapped to require() the shared module).
- tests/test-surface-detect.cjs - 6 tests for the literal-string contract
  (CLI / DESKTOP / COWORK + never-null) and the explicit env override.
- tests/test-fallback-echo-compose.cjs - 7 tests for echo composition + per
  surface routing + banner suppression + graceful state-file absence.
- tests/test-fallback-echo-30day.cjs - 5 tests for the 30-day default-flip
  + explicit MINDRIAN_STATUSLINE_FALLBACK_ECHO override behavior.
