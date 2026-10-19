---
phase: 371
status: local_passed
nyquist_compliant: true
wave_0_complete: true
human_acceptance: pending
---
# Phase 371 validation coverage

The checked runner is tests/run-all-371.sh. Supported Node 24 and an existing
Playwright installation are used; no root dependency is installed. The saved
371-local-acceptance.log ends with the runner's local PASS marker. This does not
mean the phase's human-host checkpoint has passed.

| Requirements | Executable evidence |
|---|---|
| 01, 02 | test-startup-flows: real clean home, preview, reject/defer, path containment, literal names, birth, collision and durable replay; phase UI first-user/receipt tests |
| 03 | test-room-first-entry: real selected-room views/context; phase tests for mismatched context/dashboard and invalidation on rebind |
| 04 | real fresh-process memory, checkpoint, next action and pending decisions; phase UI missing/unchanged/partial history, context/briefing retry and datetime/timezone tests |
| 05 | phase UI identical pending payloads, single-use next move and retained free-text message after handover failure; existing GPT decision/proposal regressions |
| 06, 07 | phase browser 320/390/600/960px, v5 type/font/CSP, picture/gate screenshots, keyboard/focus, forced colors, reduced motion, no-JS, 200 percent text scaling, missing-font fallback and refresh serialization |
| 08 local portion | runner plus real MCP, SDK/browser, runtime instructions, birth/identity/failure, generated-contract checks and code/UI audits |
| 08 real-host portion | 371-UAT.md checkpoint; no automated substitute claimed |

Regression outcomes: startup and room-first browser suites pass; GPT App/gate/
command/Theo proposal suite passes; initialize instructions 18/18; room birth
35/35; identity birth 7/7; failure/retry birth 6/6. Connector, orchestration and
harness --check pass; render coverage reports zero gaps; diff hygiene passes.

Every implementation task has executable sampling evidence; the manual host task
is explicitly marked as manual. No unlisted whole-repository test run is claimed.
