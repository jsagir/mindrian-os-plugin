---
phase: 175-deck-command-consolidation
plan: 02
subsystem: deck-design-ruleset
tags: [deck, deck-design, ruleset, warn-first, source-links, ai-image-provenance, brand-binding, cirs, deferred-enforcement, part-8, mindrian-os.com]

# Dependency graph
requires:
  - phase: 175-deck-command-consolidation
    provides: "175-01 commands/deck.md WARN-first deck-design ruleset doctrine (source links + brand auto-bind to logo->mindrian-os.com + AI-image provenance) -- this plan ships the enforcing --check; no file overlap with 175-01"
  - phase: 173-publish-jtbd-need-selector
    provides: "scripts/check-publish-needs.cjs LOCAL read-only validator + exit-code discipline (mirrored, inverted to WARN-first); 173-RESEARCH-tavily.md section 3 (Hebbia ISD source citation + the bottom-right 8-10pt tool+year AI-image provenance footer format)"
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: "scripts/build-connector-registry.cjs methodologyCommandsMissingConnector stderr-warn-without-exit-1 idiom (mirrored by the [deck-design WARN] CLI)"
provides:
  - "lib/core/deck-design-rules.cjs: the pure WARN-severity rule helpers (checkSourceLinks / checkImageProvenance / checkBrandBinding) + the DESIGN_SYSTEM (logo_link https://mindrian-os.com) and PROVENANCE_FORMAT (bottom-right, 8-10pt, AI: <tool>, <year>) constants"
  - "scripts/check-deck-design.cjs: the WARN-first --check CLI over a deck HTML file -- prints [deck-design WARN] lines to stderr, exits 0 even with warnings (D-04d)"
  - "tests/test-deck-design-check.cjs: the proof the --check WARNs (not fails) on a missing source link AND a missing AI-image provenance footer, and confirms the logo-to-mindrian-os.com binding"
affects: [175-03-registry-wiring-and-regression, deck-design-ruleset-hard-gate-flip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WARN-first --check: invert the build-connector-registry / check-publish-needs exit-1-on-violation discipline to exit 0 always, printing stderr WARN lines (CIRS deferred-enforcement, mirrors R6/R11; the hard-FAIL flip is a future amendment)"
    - "Pure rule helpers as a string-only CJS module: each checker is a pure function of the deck HTML string, returns { rule, severity, message } findings, reads no filesystem, makes no Brain/network call (Canon Part 8)"
    - "--strict flag RESERVED for the future hard-gate flip: documented but still exits 0 this phase so no surface depends on a hard gate that is not yet law"
    - "Operator-error exit code (2) distinct from a ruleset warning (exit 0): a missing/unreadable file argument is an operator error, not a deck-design miss"

key-files:
  created:
    - "lib/core/deck-design-rules.cjs (the three pure checkers + DESIGN_SYSTEM + PROVENANCE_FORMAT)"
    - "scripts/check-deck-design.cjs (the WARN-first CLI)"
    - "tests/test-deck-design-check.cjs (8 checks: 6 checker behaviors + 2 spawned-CLI assertions)"
  modified: []

key-decisions:
  - "TDD test file authored in Task 1 (the RED-then-GREEN substrate) rather than Task 2: the plan put tests/test-deck-design-check.cjs in Task 2, but Task 1 is tdd=true with its verify pointing at that same test, so the six checker behaviors had to exist as the Task-1 RED gate. Task 2 the CLI then turns the two spawned-CLI assertions green. Net file set is identical to the plan; only the authoring order shifted to honor the TDD verify."

requirements-completed: [R6, R7, R8]

# Metrics
duration: 12min
completed: 2026-06-23
---

# Phase 175 Plan 02: Deck-Design Ruleset (WARN-first --check) Summary

**Shipped the deck-design ruleset as a WARN-first --check: a pure rule library (lib/core/deck-design-rules.cjs) enforcing mandatory source hyperlinks (Hebbia ISD), AI-image provenance footers (bottom-right, 8-10pt, "AI: <tool>, <year>"), and the default MindrianOS Design System brand binding with the logo linking to https://mindrian-os.com; the CLI wrapper (scripts/check-deck-design.cjs) that prints [deck-design WARN] lines and exits 0 even with warnings; and the test proving WARN-not-FAIL behavior -- D-04d CIRS deferred-enforcement, the warning surface, not a hard gate.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-23
- **Tasks:** 2
- **Files created:** 3 (1 rule lib, 1 CLI, 1 test)

## Accomplishments

- `lib/core/deck-design-rules.cjs`: a pure, zero-dependency CJS module (Node built-ins only; no Brain, no network -- Canon Part 8). Exports:
  - `DESIGN_SYSTEM` -- the default Brand-Kit: `name: "MindrianOS Design System"`, `logo_link: "https://mindrian-os.com"`, `palette_source: "references/visual/palette.json"` (a constant string reference; the checkers never read it).
  - `PROVENANCE_FORMAT` -- the AI-image provenance footer contract: `position: "bottom-right"`, `min_pt: 8`, `max_pt: 10`, `template: "AI: <tool>, <year>"`.
  - `checkSourceLinks(html)` -- one warn finding per sourced-claim marker (`data-sourced`) that lacks a resolvable `href` (on the element or in its body); empty when there are no sourced claims or all are linked.
  - `checkImageProvenance(html)` -- one warn finding per AI-generated image (`data-ai` or an `ai-generated` class) lacking a conformant bottom-right / 8-10pt / "AI: <tool>, <year>" footer; empty when all AI images have conformant footers.
  - `checkBrandBinding(html)` -- one warn finding when the logo anchor does not link to `https://mindrian-os.com` (and no `data-user-brand` override is present); empty when the default binding holds or a user brand overrides it (R7).
  - Every finding carries `severity: "warn"` this phase; the hard-FAIL flip is deferred (D-04d).
- `scripts/check-deck-design.cjs`: the WARN-first CLI. Reads the deck HTML file LOCALLY, runs the three checkers, prints each finding as a `[deck-design WARN] (rule) message` line to stderr (mirroring the build-connector-registry.cjs `methodologyCommandsMissingConnector` stderr-warn idiom), prints a one-line summary count, and EXITS 0 even when warnings exist. A `--strict` flag is RESERVED for the future hard-gate flip (documented; still exits 0 this phase). A missing or unreadable file argument prints a usage line to stderr and exits 2 (operator error, distinct from a ruleset warning).
- `tests/test-deck-design-check.cjs`: 8 checks -- the six Task-1 checker behaviors against inline HTML fixtures plus two spawned-CLI assertions (the WARN-not-FAIL exit-0 proof over a fixture with a missing source link AND a missing AI-image provenance footer AND a non-mindrian-os.com logo; and the exit-2 operator-error proof for a missing file argument). Node built-ins only (assert, child_process, fs, os, path).

## Task Commits

Each task was committed atomically with targeted staging (the branch tip carries an interrupted release Commit-B -- a node_modules un-cache + plugin.json/CHANGELOG/package.json version bump -- that was NEVER touched):

1. **Task 1: lib/core/deck-design-rules.cjs (pure rule helpers) + tests/test-deck-design-check.cjs (RED-then-GREEN)** - `e8ecb708` (feat)
2. **Task 2: scripts/check-deck-design.cjs (WARN-first CLI)** - `e26d2736` (feat)

## Files Created

- `lib/core/deck-design-rules.cjs` - the three pure WARN-severity checkers + the DESIGN_SYSTEM and PROVENANCE_FORMAT constants the brand-binding and provenance checks bind to.
- `scripts/check-deck-design.cjs` - the WARN-first --check CLI (exit 0 always; --strict reserved; exit 2 on operator error).
- `tests/test-deck-design-check.cjs` - the 8-check proof (6 checker behaviors + 2 spawned-CLI assertions).

## Decisions Made

- **The TDD test file landed in Task 1, not Task 2.** Task 1 is `tdd="true"` and its `<verify>` runs `node tests/test-deck-design-check.cjs`, so the six checker behaviors had to exist as the Task-1 RED gate before the implementation could turn them GREEN. The plan listed the test file under Task 2; the only adjustment was authoring order (the test file in Task 1's commit alongside the rule lib). The net file set and content are exactly as the plan specifies; Task 2 (the CLI) turns the two spawned-CLI assertions green. This is the standard TDD execution flow (RED -> GREEN), not a scope change.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written, modulo the TDD authoring-order note above (the test file rode Task 1's commit so the Task-1 RED/GREEN cycle had its assertions). No bugs, no missing critical functionality, no blocking issues, no architectural changes.

## Authentication Gates

None - no external service, no auth, no network (Canon Part 8: the checkers and CLI are LOCAL and pure).

## Verification

- `node tests/test-deck-design-check.cjs` passes 8/8: all six checker behaviors plus the spawned-process WARN-not-FAIL assertion (exit 0 with `[deck-design WARN]` lines on stderr) and the exit-2 operator-error assertion.
- `node scripts/check-deck-design.cjs /dev/null` exits 0 (WARN-first) and prints a `[deck-design WARN]` brand-binding line plus the "WARN-first, not failing the build (D-04d)" summary.
- The checkers are pure (no Brain, no network -- Part 8 boundary scan clean on both new source files); `DESIGN_SYSTEM.logo_link === "https://mindrian-os.com"` confirmed.
- No em-dashes in any of the three files (hyphens only).

## Known Stubs

None. The `--strict` flag is intentionally a no-op-exit-0 this phase (RESERVED for the future hard-gate flip) and is documented as such in the CLI header and the SUMMARY; it is a forward-declaration, not a dead stub -- the deck-design ruleset hard-gate flip (a later phase, mirroring the Phase 172-13 connector-gate WARN->hard-FAIL flip) will activate it.

## Threat Flags

None. The new surface introduces no network endpoint, no auth path, no file write (the CLI reads one LOCAL file read-only), and no schema/trust-boundary change. The checkers are pure string functions; the only filesystem touch is the CLI's single `fs.readFileSync` of the deck HTML argument.

## Next Phase Readiness

- The deck-design ruleset --check exists and is WARN-first. Plan 175-03 wires `node tests/test-deck-design-check.cjs` (and optionally `node scripts/check-deck-design.cjs`) into the phase's test suite / regression aggregator.
- The interrupted release Commit-B (node_modules un-cache + version bump) on the branch tip was left untouched; only the three plan files entered the two task commits.

## Self-Check: PASSED

- FOUND: lib/core/deck-design-rules.cjs
- FOUND: scripts/check-deck-design.cjs
- FOUND: tests/test-deck-design-check.cjs
- FOUND: .planning/phases/175-deck-command-consolidation/175-02-SUMMARY.md
- FOUND commit: e8ecb708 (Task 1)
- FOUND commit: e26d2736 (Task 2)

---
*Phase: 175-deck-command-consolidation*
*Completed: 2026-06-23*
