---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "46"
subsystem: part8-egress-guard
tags: [part8, egress, identifiers, email, phone]
requires: [386-31, 386-33, 386-39, 386-40]
provides:
  - obfuscated email and international phone-like forms always block (content_set, token class none)
key-files:
  created:
    - tests/test-386-identifier-forms.cjs
    - .planning/debug/part8-always-block-misses-obfuscated-email-and-international-phone.md
  modified:
    - lib/core/cross-room-aggregator.cjs
    - tests/fixtures/386-audit-probes/expectations.json
decisions:
  - "Both rules are shape-bound; the plain-word email form excludes determiners and pronouns after the word at."
  - "No stamp: the corpus gate output is identical before and after (ext.induced_total 0)."
  - "suffix_money stays allow (money is body-only)."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 46: Obfuscated email and international phone forms Summary

Two frozen always-block patterns (obfuscated email, international phone-like) appended to ALWAYS_PATTERNS and FORBIDDEN_PATTERNS block these forms in every shape with the plain pair content_set/none.

## RCA numbers

- ordinary_blocked_by_email_rule: 0
- ordinary_blocked_by_phone_rule: 0
- ordinary_blocked_max: 0 (no owner decision needed)
- repro before the fix: all three probe forms allow/generic_question on brain_ask, brain_search, brain_query

## Commits

- 6d32d1668 RCA (Task 1)
- 893828652 RED test (Task 2)
- 80f7a29e6 fix (Task 3)
- 6cf09d543 RCA resolution

## Deviations from Plan

None. No pattern-count test pinned an absolute count, so no flip was needed. The expectations change also touched identifier_classes (email, phone_like) and content_set_cases, because the probe gate arm PG0 requires them to match structured_identifier_cases.

## Known pre-existing reds (not touched)

test-252-guard-census census.1 and census.5b; check-pending-breakthrough Test 12; test-237-autonomy-parity Leg 5; test-connector-tier-d-hooks CHECK 4; test-connector-part8-boundary CHECK 2; run-all-179 leg 179-08. None were run or changed by this plan.

## Self-Check: PASSED
