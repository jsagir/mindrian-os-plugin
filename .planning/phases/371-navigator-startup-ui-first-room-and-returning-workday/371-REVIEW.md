---
phase: 371
status: clean
review_method: inline source and failure-boundary review
---
# Phase 371 code review

Scope: the startup App template/styles/assets, loadTemplate integration, existing
startup producers, new phase suite and prior startup regression changes. Existing
gate/birth/workday memory authorities were inspected as integration dependencies.
This is an inline review, not an independent or cross-AI review.

## Findings and resolution

1. FIXED: template identity injection matched only a bare body tag. Adding startup
   state attributes suppressed the shared bridge/header. A bounded body-tag regex
   now preserves attributes and injects the same existing scripts. Both startup
   browser suites and prior decision/dashboard browser regressions pass.
2. FIXED: separate host-context updates could replace saved memory with the
   briefing. The UI publishes one validated room snapshot containing both, clears
   it on rebind, and includes decision/intent with that same snapshot.
3. FIXED: a refresh allowed overlapping UI actions. It now serializes the request
   and accepts its own callback while blocking other actions. A held-response test
   proves serialization and preservation of an unsent same-view draft.
4. FIXED: missing packaged font bytes caused the entire template to disappear.
   Font reads now fall back to declared system families, without a network fetch.
   The failure-injection test verifies usable styles remain available.

## Result

No unresolved critical/warning source finding in this focused change. Text uses
textContent; exact gate payloads are retained for unknown replies; definitive
refusals do not create another room; binding/context/view identities are checked;
pending decisions disable room switching; confirmed intents survive handover
failure without another answer. Existing literal-argv room-birth, durable replay
and Brain separation tests are retained. No new invocable or execution path.

Limits: no formal security audit, independent reviewer or real ChatGPT host check
is claimed. The real host checkpoint is in 371-UAT.md and VERIFICATION.md.
