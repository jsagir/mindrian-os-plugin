---
quick_id: 261001-lsd
status: complete
date: 2026-10-01
---

# Quick 261001-lsd summary

## Root cause (confirmed)

- f55f004f6 touched exactly one file: data/framework-names.json (+426 / -28).
- `"lean startup"` occurrences in data/framework-names.json: 0 at f55f004f6^, 1 at f55f004f6.
- guard.classify({question:'lean startup methodology'}, brain_ask) on git-archive trees:
  - f55f004f6^: ambiguous / freeform_unproven
  - f55f004f6: allow / typed_question ("closed-vocabulary methodology question")
- So the verdict flip is caused purely by the data regeneration. The guard is correct;
  the fixtures were pinned to a phrase that is now canonical.

## Fix

Both fixtures re-pinned to 'pottery kiln methodology' (still methodology vocabulary
plus two unproven free-form tokens; grep finds neither token in data/ or the guard).
Assertions unchanged. Guard and data files untouched.

## Results

- test-245-egress-contentless: PASS (was FAIL)
- test-260906-fda-known-tool-shapes: PASS (was FAIL)
- run-all-245: PASS=18 FAIL=1, the 1 is test-245-tiebreak-deterministic (SENS-08 fixture drift, pre-existing, out of scope)
- Guard siblings (17 files: test-239*, test-257-envelope-passthrough, test-257-refusal-egress-kind, test-339*, test-246*): 16 green; test-339-update-path-single-source red, pre-existing and unrelated (Arm 5 finds the update-path literal in scripts/collect-cold-install-evidence.cjs:365, a file last changed 2026-09-10 and not touched here)
