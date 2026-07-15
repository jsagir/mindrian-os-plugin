---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
plan: 03
subsystem: eureka
tags: [reasoning-mode, mode-disclosure, html-export, de-stijl, faithful-judge, cjs, seed-058]

# Dependency graph
requires:
  - phase: 226-02
    provides: "scripts/eureka-portfolio-report.cjs mode:reasoning branch (reasoningStageSeed/Emit/Score, renderReasoningReport, buildUpgradeDelta) + the frozen JSON contract: provenance.run_mode==='reasoning', degrade_cause, honest-null encoder legs, mode field on every row"
  - phase: 216-02
    provides: "scripts/eureka-command.cjs thin dispatcher (run|start|status|report) + the status.json state machine + the reportDir/outMd/outJson path contract this plan extends"
  - phase: 211-03
    provides: "lib/core/eureka/lexical-overlap.cjs pure-CJS module shape (frozen constants, never-throws, _test export) mirrored by report-html.cjs"
provides:
  - "lib/core/eureka/report-html.cjs: renderReportHtml(json, opts) - a pure, zero-egress De Stijl html renderer whose non-collapsible top-of-document mode banner reads provenance.run_mode and can never be lost or defaulted (D6/G-4)"
  - "scripts/eureka-command.cjs html + reasoning-prompts + reasoning-score subcommands (thin pass-throughs, one governed door) + reasoning_await_mappings / reasoning_await_answers honest status states"
  - "commands/eureka.md reasoning-mode orchestration doc: the faithful-judge protocol (answer yes/no + one sentence, skeptical adversarial read, NEVER estimate a score), the html subcommand, Mode-on-every-result render anatomy"
  - "tests/test-226-mode-disclosure.cjs: the D6/G-4 three-surface proof (label + caveat present in md AND json AND html for one and the same reasoning run) + embedded-banner + doc-parity legs"
affects: [226-04, mos-eureka, eureka-command, report-html]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mandatory non-collapsible mode banner: renderReportHtml puts the run_mode banner as the FIRST body element (above the title), read straight from provenance.run_mode - reasoning renders a red 5-element caveat, any other mode names the string VERBATIM (never blanked, never defaulted)"
    - "Zero-egress shareable export: inline CSS only, no CDN font / no <script> / no external URL of any kind (Part 8 posture extended from the pipeline to the artifact); the test string-asserts no http(s):// in the output"
    - "One governed door: reasoning-prompts / reasoning-score are thin RUNNER.main pass-throughs with no scoring logic in the dispatcher; exit code 2 round-trips as a retriable status, never swallowed"
    - "HTML-escape every interpolated value (a room title carrying <script> cannot inject markup into a report a second reader opens)"

key-files:
  created:
    - lib/core/eureka/report-html.cjs
    - tests/test-226-mode-disclosure.cjs
  modified:
    - scripts/eureka-command.cjs
    - commands/eureka.md

key-decisions:
  - "The embedded banner names provenance.run_mode VERBATIM ('live (local embedding spine)' / 'offline (deterministic stub encoder)'), not a synthesized literal 'embedded'. Embedded provenance.run_mode is that descriptive string (line ~1195 of the runner), and SEED req 1 is 'name the mode string, never defaulted' - so the banner echoes exactly what the JSON carries. The test asserts the embedded run_mode STRING appears in the html."
  - "reasoning-prompts / reasoning-score forward --out outMd / --json outJson / --reasoning-workdir <default> so the reasoning report lands at the SAME default report location the html subcommand reads (byte-parity of location, no second path)."
  - "The html renderer reads the row's mode field when present and falls back to a mode derived from provenance.run_mode for embedded ranked rows (embedded ranked[] carry no mode field; only embedded statements[] do). The banner and every statement card still disclose the mode unambiguously."

patterns-established:
  - "renderReportHtml never throws: a malformed json (not an object, or no provenance) returns a minimal error page naming what was missing, so a shared-export pipeline degrades honestly instead of crashing"
  - "The CLI confirmation of the html subcommand prints a 'mode: <run_mode>' line - even the terminal echo discloses the mode (the label rides EVERYWHERE, not just in the artifact)"

requirements-completed: [REQ-5]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 226 Plan 03: Mode-Disclosure Surfaces (report-html + eureka-command + faithful-judge doc) Summary

**The mode:reasoning label is now impossible to lose across every consumer: a new pure De Stijl html renderer (renderReportHtml) opens with a mandatory, non-collapsible banner read straight from provenance.run_mode, the /mos:eureka html subcommand renders it zero-network from the existing portfolio-report.json, the reasoning-prompts/reasoning-score subcommands orchestrate the self-judging loop through the one governed door, the command doc teaches Larry the faithful-judge NEVER-estimate-a-score protocol, and a hermetic D6/G-4 test proves the label + caveat survive md AND json AND html for one and the same reasoning run.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 of 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- **Task 1 (report-html.cjs):** A pure, zero-dep, never-throws De Stijl renderer. `renderReportHtml(json, opts)` returns a complete self-contained html string (doctype, inline `<style>` only, no external URL of any kind - Part 8). The mandatory MODE BANNER is the FIRST body element (above the title, non-collapsible, not a footer): `run_mode === 'reasoning'` renders a red banner reading `REASONING MODE - LOWER-CONFIDENCE RESULT` plus the five-element caveat (basis weakness via degrade_cause, the two structurally-null legs, bar-held-at-parity, nothing banked, upgrade path); any other run_mode renders a yellow banner naming the mode string verbatim. Provenance table, ranked table (reasoning columns rank/pair/lsa_similarity/verdict/mode with NO differential/semantic cell; embedded columns rank/pair/score/banked/mode), statement cards carrying mode + banked visibly, and a conditional reasoning->embedded upgrade section. Every interpolated value is HTML-escaped (T-226-10). `_test` exports for `escapeHtml` + `buildModeBanner`.
- **Task 2 (eureka-command.cjs subcommands):** `outHtml(roomDir)` + `reasoningWorkdir(roomDir)` path helpers; `cmdHtml` reads outJson, renders, writes portfolio-report.html, and prints the path plus a `mode:` line (the CLI confirmation itself discloses the mode); `cmdReasoningPrompts` / `cmdReasoningScore` are thin RUNNER.main pass-throughs (no scoring logic in the dispatcher, the SEED-034 one-door rule in a comment) that translate exit codes to honest status states (`reasoning_await_answers`, and exit 2 -> retriable, never swallowed); `cmdRun` now surfaces a genuine degrade's `provenance.reasoning.state === 'await_mappings'` as status `reasoning_await_mappings`. USAGE + unknown-subcommand hint updated to the seven subcommands.
- **Task 3 (eureka.md doc + D6 test):** argument-hint extended to `[run|status|report|html]`; new `Subcommand: html` and `Reasoning mode (lower-confidence fallback)` sections documenting the six-step loop with the faithful-judge protocol stated verbatim (yes/no + one sentence of evidence, skeptical adversarial read, NEVER estimate a semantic-similarity or differential score, NEVER invent a number); Zone 2 anatomy now renders Mode on EVERY result and gives reasoning its own lsa_similarity/verdict column set (never a differential column); the encoder-degrade note now names the honest reasoning-mode flow instead of "an honest empty report". `tests/test-226-mode-disclosure.cjs` drives the real emitter degrade + reasoning stages in a hermetic room, spawns the REAL dispatcher `html` subcommand, and asserts the label + caveat on the same run across md, json, and html, plus the embedded-banner-names-its-mode leg and the doc-parity (no-rot) leg.

## Task Commits

1. **Task 1: report-html.cjs pure De Stijl renderer with mandatory mode banner** - `0013866d` (feat)
2. **Task 2: eureka-command html + reasoning-prompts/score subcommands + honest status states** - `93910fd3` (feat)
3. **Task 3: eureka.md reasoning orchestration + faithful-judge protocol + D6 three-surface test** - `1c15f41c` (feat)

## Files Created/Modified

- `lib/core/eureka/report-html.cjs` (created) - renderReportHtml + _test (escapeHtml, buildModeBanner); the zero-egress De Stijl renderer whose mode banner cannot be lost
- `scripts/eureka-command.cjs` (modified) - html / reasoning-prompts / reasoning-score subcommands, outHtml + reasoningWorkdir + reasoningSeedState helpers, reasoning_await_mappings surfacing in cmdRun
- `commands/eureka.md` (modified) - argument-hint, html + reasoning-mode sections, faithful-judge protocol, Mode-on-every-result render anatomy, honest-degrade note
- `tests/test-226-mode-disclosure.cjs` (created) - the D6/G-4 three-surface proof + embedded-banner + doc-parity legs

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-226-mode-disclosure.cjs` (D6/G-4, REQ-5) | exit 0 (label + caveat across md + json + html for one reasoning run; embedded banner + doc-parity) |
| `node tests/test-216-eureka-command.cjs` (existing dispatcher untouched) | exit 0 (44 assertions passed) |
| `node scripts/check-render-coverage.cjs` | exit 0 (16 covered, 0 gap; 204 wired) |
| `node scripts/build-connector-registry.cjs --check` (plan-checker fix: this plan edits eureka.md argument-hint frontmatter) | exit 0 (connector-registry: OK) |
| `node tests/test-226-field-contract.cjs` (plan-02 regression) | exit 0 (7 statements, 7 ranked; byte-parity + null legs) |
| Task 1 renderer verify (reasoning banner + no external URL) | exit 0 |
| Task 2 wiring grep + html no-report path | exit 0 |
| em-dashes across the 4 touched files | 0 |

## Decisions Made

- **Embedded banner echoes provenance.run_mode verbatim.** The embedded path stamps `run_mode: 'live (local embedding spine)'` / `'offline (deterministic stub encoder)'` (not a literal 'embedded'). SEED req 1 requires naming the mode string, never defaulting, so the banner echoes exactly what the JSON carries. The mode-disclosure test asserts the embedded run_mode STRING appears in the html and the reasoning caveat banner does NOT.
- **Reasoning subcommands forward the default report + workdir paths** so the reasoning report lands where the html subcommand reads it (byte-parity of location; no second path, one governed door).
- **The renderer tolerates embedded ranked rows carrying no `mode` field** (only embedded statements[] carry mode:'embedded'): it falls back to a provenance-derived mode for the ranked Mode column, while the banner and every statement card disclose the mode unambiguously.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated report-html.cjs might factor out helpers; all three tasks landed on their assigned files with no scope change and no architectural deviation.

## Known Stubs

None. The renderer's `n/a (no encoder)` cells for `differential_score` / `semantic_similarity` on reasoning rows are the intended, contract-required honest-absent values (the encoder is structurally unavailable on this path), matching the upstream plan-02 honest-null legs - not unwired stubs.

## Threat Flags

None. This plan introduces no new network endpoint, auth path, or trust-boundary schema change. The html export is the one new surface and it is zero-egress by construction (inline CSS only, asserted no-external-URL by the test), directly mitigating the T-226-11 egress threat and T-226-10 (every interpolated value HTML-escaped, unit-tested with a script-tag fixture) from the plan's own threat register.

## Next Phase Readiness

- Plan 226-04 (D5/D8/D3-negative legs, tests/run-all-226.sh phase gate, TEST_FILES registration, ENV-TUNING + CANON-PHASE-MAP docs, navigator calibration checkpoint) can register `test-226-mode-disclosure.cjs` in the phase aggregator alongside the plan-01/02 legs; the html surface and the reasoning-command subcommands it wires are now the stable disclosure spine 226-04's calibration checkpoint samples.
- The three new eureka-command subcommands and the report-html renderer are born through the one governed door; no separate fallback command exists (SEED one-command mandate held).

## Self-Check: PASSED

- Files: lib/core/eureka/report-html.cjs, scripts/eureka-command.cjs, commands/eureka.md, tests/test-226-mode-disclosure.cjs all present on disk.
- Commits: 0013866d, 93910fd3, 1c15f41c all present in git log.
