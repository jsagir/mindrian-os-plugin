---
phase: 179-ignite-b1-starting-point-fix
plan: 01
subsystem: hooks / render-enforcement
tags: [ga-4, r-1-cure, card-fire-interceptor, stop-hook, render-coverage, part-8, tdd]
requires:
  - data/render-coverage-registry.json (Phase 178 R15 substrate)
  - scripts/check-render-coverage.cjs (R15 gate, not modified)
  - hooks/hooks.json (Stop block)
provides:
  - scripts/check-card-fire.cjs (the GA-4 Stop-hook turn-scan card-fire interceptor)
  - check-card-fire Stop-block registration (the R-1 runtime cure)
  - tests/run-all-179.sh (the Phase 179 single PASS/FAIL aggregator)
affects:
  - hooks/hooks.json (additive Stop entry; existing 5 entries byte-preserved)
tech-stack:
  added: []
  patterns:
    - Stop-hook stdin envelope idiom (mirrors operator-update.cjs)
    - deterministic exported predicate (mirrors check-render-coverage.cjs)
    - registry-keyed enumeration (reuse the Phase 178 R15 registry, no hand list)
    - LOCAL retry side-file for bounded escape (Part 8 LOCAL-only)
key-files:
  created:
    - scripts/check-card-fire.cjs
    - tests/test-ga4-card-fire-interceptor.cjs
    - tests/run-all-179.sh
  modified:
    - hooks/hooks.json
decisions:
  - "GA-4 detection = registry-keyed PRIMARY + ASCII-box output-text BACKSTOP (CONTEXT decision 1)"
  - "Enforcement = exit-2 block + hookSpecificOutput.additionalContext re-prompt forcing the AskUserQuestion card"
  - "Bounded escape = MAX_FORCE_RETRIES (3) then degrade=true + continue:true, no infinite loop (T-179-01 DoS mitigation)"
  - "ASCII-box glyph encoded as \\u25A0 escape, not the literal U+25A0 byte, so the source stays pure ASCII and the registry-keyed grep gate passes"
metrics:
  duration: "~5 min"
  completed: "2026-06-24"
  tasks: 2
  files: 4
---

# Phase 179 Plan 01: GA-4 Card-Fire Interceptor (the R-1 Cure, Wave 1) Summary

A deterministic Stop-hook turn-scan that moves AskUserQuestion card-fire enforcement
below the agent: a reached-Decision-Gate turn with no fired card is hard-blocked and
re-prompted via an exit-2 envelope, with a bounded escape (3 retries then graceful
degrade) so a card-incapable surface cannot be trapped.

## What shipped

- **`scripts/check-card-fire.cjs`** -- the GA-4 interceptor. Exported deterministic
  predicate `classifyCardFire(turn, registry) -> { intercept, reason, degrade }`:
  - PRIMARY: a render-coverage-registry gate-reaching surface (entries[] with
    `render_coverage: 'card-emission'`) ran this turn AND no AskUserQuestion fired
    -> intercept. The enumeration is DERIVED from `data/render-coverage-registry.json`
    (the Phase 178 R15 substrate), never hand-maintained.
  - BACKSTOP: the turn output text carries the ASCII-box gate glyphs
    (`[1] [2] [3]` / "type 1, 2, or 3" / the box glyph) with no fired card -> intercept,
    even for an off-registry surface.
  - Negatives: card already fired -> no intercept; no gate signal -> no intercept;
    render-only-excluded surface is not gate-reaching -> no intercept.
  - Bounded escape: a LOCAL retry side-file (`~/.mindrian/card-fire-retries.json`)
    keyed by turn-context hash; at `MAX_FORCE_RETRIES` (3) the predicate returns
    `degrade=true` and the envelope is `{ continue: true, suppressOutput: true }`.
  - Enforcement envelope mirrors `operator-update.cjs`: `additionalContext` ONLY
    inside `hookSpecificOutput`; exit-2 `decision: 'block'` on intercept.
  - Defensive: any internal error -> stderr + `{ continue: true, suppressOutput: true }`
    + exit 0. NEVER blocks the hook chain.
- **`hooks/hooks.json`** -- one additive Stop-block entry invoking
  `check-card-fire.cjs` (3000ms timeout). The existing 5 Stop entries are
  byte-preserved (Stop array length is now 6).
- **`tests/test-ga4-card-fire-interceptor.cjs`** -- the proof suite (22 assertions):
  the four required behaviors, the BACKSTOP, the envelope shape, registry-keyed
  enumeration, determinism, Part 8 LOCAL sweep, defensive non-throw.
- **`tests/run-all-179.sh`** -- the Phase 179 single PASS/FAIL aggregator; Wave 1
  green, later-wave suites (2-7) SKIP via a file-existence guard (mirrors
  run-all-178.sh's scaffold-state pattern), carries the frozen reach/posture drift
  fences.

## Verification (all green)

| Gate | Command | Result |
|------|---------|--------|
| Interceptor suite | `node tests/test-ga4-card-fire-interceptor.cjs` | PASS (22 assertions) |
| Predicate exported | `node -e "...classifyCardFire..."` | exit 0 |
| Part 8 LOCAL sweep | `grep -nE 'fetch\|http\|curl\|brain.mindrian\|tavily\|mcp__brain' scripts/check-card-fire.cjs` | zero matches |
| Registry-keyed | `grep -n 'render-coverage-registry' scripts/check-card-fire.cjs` | >=1 match (exit 0) |
| No em-dashes | `grep -nP '\x{2014}\|\x{2013}' scripts/check-card-fire.cjs` | zero matches |
| hooks.json valid JSON | `node -e "JSON.parse(...)"` | exit 0 |
| Interceptor registered in Stop | `node -e "...Stop.some.../check-card-fire/..."` | exit 0 |
| Existing Stop entries preserved | `node -e "...Stop.length>=6..."` | length 6, exit 0 |
| Phase 179 aggregator | `bash tests/run-all-179.sh` | 5 passed, 0 failed, 6 skipped; exit 0 |
| Phase 178 render gate not regressed | `node scripts/check-render-coverage.cjs --check` | render-coverage: OK |

Live Stop-hook smoke test confirmed end-to-end: a reached-no-card turn (against a
real registry entry) emits the `decision: 'block'` re-prompt envelope; an ordinary
turn and empty stdin both emit silent `{ continue: true, suppressOutput: true }`.

## Acceptance criteria (SPEC Req 1) satisfied

- A reached-gate-no-card fixture turn is intercepted and the card forced (not merely
  logged) -- positive PRIMARY test + live block-envelope smoke test.
- A non-gate turn produces ZERO forced cards -- negative test.
- The bounded escape releases after N retries with no infinite loop -- bounded-escape
  test (degrade=true at MAX_FORCE_RETRIES) + live degrade path.
- Coverage enumerates from the Phase 178 R15 render-coverage registry, not a
  hand-maintained gate list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ASCII-box glyph encoded as `■`, not the literal byte**
- **Found during:** Task 1 (the registry-keyed grep acceptance gate failed)
- **Issue:** The `ASCII_BOX_GLYPH_RE` regex included the literal U+25A0 box glyph and a
  stray NUL byte slipped into a string literal during editing; both made `grep` treat
  `check-card-fire.cjs` as a binary file, so the required
  `grep -n 'render-coverage-registry'` acceptance gate returned no output / exit 1.
- **Fix:** Replaced the literal glyph with its `■` JS-regex escape and stripped
  the NUL byte, so the source is pure ASCII text while the regex still matches the
  glyph at runtime. `file` now reports "Node.js script executable, ASCII text" and the
  grep gate passes.
- **Files modified:** scripts/check-card-fire.cjs
- **Commit:** c269276e

No architectural changes (Rule 4) were needed. No authentication gates occurred.

## TDD Gate Compliance

- RED: `test(179-01): add failing test` -- commit `1757cc47` (test fails: module not found)
- GREEN: `feat(179-01): GA-4 card-fire interceptor` -- commit `c269276e` (22 assertions pass)
- REFACTOR: none needed (clean on first GREEN).

## Known Stubs

None. The interceptor is fully wired (registry-keyed PRIMARY + BACKSTOP + bounded
escape + Stop-block registration). The later-wave suites in run-all-179.sh are
guarded SKIPs by design (the file-existence guard), not stubs.

## Self-Check: PASSED

- FOUND: scripts/check-card-fire.cjs
- FOUND: tests/test-ga4-card-fire-interceptor.cjs
- FOUND: tests/run-all-179.sh
- FOUND commit: 1757cc47 (RED)
- FOUND commit: c269276e (GREEN)
- FOUND commit: 93a6db03 (Task 2)
