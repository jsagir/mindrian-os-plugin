---
quick_id: 261001-lsd
slug: lean-startup-fixture-drift
date: 2026-10-01
type: test-data drift fix
files_modified:
  - tests/test-245-egress-contentless.cjs
  - tests/test-260906-fda-known-tool-shapes.cjs
---

# Quick 261001-lsd: re-pin the "lean startup" egress-guard fixtures

## Goal

Two tests assert that the brain_ask payload `{question: 'lean startup methodology'}`
is classified `ambiguous` / `freeform_unproven` by lib/core/part8-egress-guard.cjs.
Commit f55f004f6 (355-08) regenerated data/framework-names.json from the live Theo
list and "lean startup" became a canonical framework phrase, so the guard now
(correctly) proves the payload closed-vocabulary and allows it. The fixtures drifted;
the guard did not.

## Task 1: re-pin each fixture to a payload that still exercises the unproven-token path

- Replace 'lean startup methodology' with 'pottery kiln methodology' in both tests.
- Verify 'pottery' and 'kiln' appear nowhere in data/ or the guard source (grep).
- Keep the assertion unchanged (ambiguous / freeform_unproven). Do NOT edit
  lib/core/part8-egress-guard.cjs or data/framework-names.json (Canon Part 8).

## Verify

- node tests/test-245-egress-contentless.cjs and node tests/test-260906-fda-known-tool-shapes.cjs exit 0.
- bash tests/run-all-245.sh: only the SENS-08 tiebreak red remains.
- Guard siblings test-239*, test-257-envelope-passthrough, test-257-refusal-egress-kind, test-339*, test-246* stay green (pre-existing reds noted).
