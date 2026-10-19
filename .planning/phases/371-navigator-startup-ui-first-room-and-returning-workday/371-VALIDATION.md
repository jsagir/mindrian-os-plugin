---
phase: 371
status: planned
nyquist_compliant: false
---
# Validation strategy

Real MCP lifecycle: tests/test-startup-flows.cjs and test-room-first-entry.cjs.
SDK UI/recovery/accessibility: tests/test-371-startup-ui.cjs (plan 03).
Gate proposal regression: tests/test-gpt-plugin-ui.cjs --browser.
Birth regressions: test-room-birth.cjs and test-36925-rid-birth.cjs/rft-birth.cjs.
Contracts: connector/orchestration/harness --check; render coverage; diff hygiene.
Visual evidence: actual rendered synthetic first/returning flows in narrow/wide
containers, manually inspected with the approved UI-SPEC as the baseline.
Host evidence: separate real ChatGPT smoke test; absent evidence stays pending.
Requirement-to-test matrix and actual results are recorded after execution.
