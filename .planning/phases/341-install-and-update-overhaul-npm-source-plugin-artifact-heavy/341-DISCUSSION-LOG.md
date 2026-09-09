# Phase 341: Install and update overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-09
**Phase:** 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
**Areas discussed:** Install-time downloads, Update and release shape, Eureka first-class (reopened by the navigator), plus two pre-discussion Decision Gates (overhaul path; registration) and one placement gate (Theo x Eureka -> Phase 342)
**Mode:** advisor (USER-PROFILE.md present), calibration minimal_decisive (vendor philosophy: opinionated), plain-language framing (learning_style: guided)

---

## Decision Gate (pre-discussion): overhaul path

| Option | Description | Selected |
|--------|-------------|----------|
| npm-source plugin | Marketplace points at @mindrian_os/cli; files whitelist = runtime tree; transformers on-demand | ✓ |
| archive-source tarball | Release zip via git archive + export-ignore; second artifact channel | |
| slim the git tag only | Keep git source; vendor only the pure-JS set; .planning/tests keep shipping | |

**User's choice:** npm-source plugin. **Registration:** new GSD phase (seed and room filing declined).

## Install-time downloads

| Option | Description | Selected |
|--------|-------------|----------|
| Shrinkwrap + loader npm ci | npm-shrinkwrap.json; loader runs npm ci --ignore-scripts; platform-correct per machine; 9.3 s cold measured | ✓ |
| bundleDependencies | Zero network, but packs only the publish host's sqlite-vec platform package (EBADPLATFORM for the rest) | |

**User's choice:** Shrinkwrap + loader npm ci.
**Notes:** Reverses the orchestrator's pre-research primary (bundle) on measured evidence; the nested `lib/wiki/editor-src/node_modules` packing trap (9,119 entries) recorded.

## Update and release shape

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt all four | Exact pin; tag stays the record, only Step 6.7 deleted; update.md to Check/Confirm/loader/Verify with SHA leg retired; two pre-tag harness policies | ✓ |
| Adopt, keep the SHA leg | Same, but keep the GitHub tag-ref call despite npm immutability | |
| Adopt, gate only at 9.8 | Ceiling post-publish only; failure costs a yank | |

**User's choice:** Adopt all four.

## Eureka delivery and verification (area reopened by the navigator: "this might be the moat")

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in enable + honest class S | /mos:eureka enable into ~/.mindrian/eureka-deps/, class S split + bug fix + slim arm, no-drift topology test | ✓ |
| First-run consent inside eureka-run | Prompt on first scan; rejected: detached path cannot render consent | |
| Skip class S on slim installs | DOCTOR_SKIP_EUREKA_SMOKE=1; vacuous blocker | |

**User's choice:** Opt-in enable + honest class S.
**Notes:** Navigator's verbatim constraint: "make sure the eurika engine is not only working but working with theo and in relvence to beta29. becouse this might be the moat !" Research established Eureka is 100 percent local (critic included), so "with Theo" resolved into the awareness/trigger leg and was placed in Phase 342.

## Placement gate: Theo x Eureka (and, per the navigator, "the RS engine, the whitespace, all all all intelligence layer")

| Option | Description | Selected |
|--------|-------------|----------|
| Own phase, 342, right after 341 | 341 carries a must-not-preclude constraint; 342 registers the engines as Theo-known handles | ✓ |
| Fold into 341 | One bigger phase, slower clone fix | |
| Plant as a seed only | Risk of sitting unconverted | |

**User's choice:** Own phase 342. Session binding: dev repo / no room, remembered for the session.

## Todos

| Option | Description | Selected |
|--------|-------------|----------|
| Fold none | All four keyword noise | |
| Fold the registry-drift gate | Release-time check; rides with the ceiling policy | ✓ (navigator: "fold in all neccery") |
| Fold the F7 rescope | Unrelated | |

## Claude's Discretion

One-install-location mechanics (install.sh fate, doctor --fix behavior); exact `files` list; `.planning` runtime readers; shrinkwrap generation placement.

## Deferred Ideas

Phase 342 (Theo-aware intelligence layer); Phase 285 (selective install); SEED-014 (server-side critic); cache-version prune command; Theo-side `declaration_side` schema drift.

## Grounding legs consulted

claude-code-guide (official Claude Code docs, verbatim quotes pinned); three gsd-advisor-researcher runs (local repo + official npm docs, read-only, no publish, no web search); langtalks-graph-expert (not in the corpus yet: the relationship query degenerated into a keyword BFS with zero edges); Theo (`command_neighborhood`, `normalize_framework_name`, generic handles only).
