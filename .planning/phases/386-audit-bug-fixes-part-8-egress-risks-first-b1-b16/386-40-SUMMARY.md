---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "40"
subsystem: part8-egress-guard-tests
tags: [part8, egress, probe-gate, regression, sprouts_required]
requires: [386-39, 386-28, 386-31, 386-33, 386-37, 386-27, 386-42]
provides:
  - tests/test-386-audit-probe-gate.cjs (arms PG0, PG28, PG31, PG33, PG33N, PG33I, PG33C, PG33S, PG33R, PG33U, PGM, PGX1, PGX2, --replay control)
  - tests/fixtures/386-audit-probes/expectations.json (pinned id lists and pairs)
affects: [tests/run-all-386.sh (picked up by glob)]
key-files:
  created:
    - tests/test-386-audit-probe-gate.cjs
    - tests/fixtures/386-audit-probes/expectations.json
  modified: []
decisions:
  - "The gate pins the live (class, token class) pair per identifier type. All four of credential, email, phone-like, SSN-like and name-plus-degree give content_set with no token class. The artifact-style id and the ID-like string give room_content/identifier."
  - "PG33C checks content_set per case (content_set_cases), so a body or an edge with content_set is a failure."
metrics:
  tasks: 3
  commits: 2
completed: 2026-11-06
---

# Phase 386 Plan 40: Audit Probe Regression Gate Summary

A gate re-runs the 694 audit probe cases against the live Part 8 guard and pins what plans 28, 31 and 33 must change. A replay of baseline-before.json proves the arms detect the old behavior.

## Result

- Live run: RESULT - PASS. Every arm is ok. No arm printed SKIP (decision option-e, not root, owner_ack lines present).
- Replay control (`--replay tests/fixtures/386-audit-probes/baseline-before.json`): FAIL for PG28, PG31, PG33, PG33C, PG33S (no SKIP for these arms). ok for PG0, PG33N, PG33R, PGX1, PGX2. PG33I does not fail (the credential and SSN-like types print SKIP in replay because they need a live call).
- Network attempts: 0. Fake secrets are built at run time. Fixture rooms only.
- Runner: `TEST_386_PREFIX=tests/test-386-audit-probe- bash tests/run-all-386.sh` reports test-386-audit-probe-gate.cjs and test-386-audit-probe-fixtures.cjs PASSED. `node tests/test-3692-guard-survey-gate.cjs` exit 0. `bash tests/run-all-196.sh` 7 passed, 0 failed.

## Live (class, token class) pairs, pinned

| Type | Case | Pair |
|------|------|------|
| credential | ADV:secret_fake_credential | content_set / none |
| email | ADV:email_plain, C:plurai:19, C:negatives:X3 | content_set / none |
| phone-like | ADV:phone_us | content_set / none |
| SSN-like (run time) | built in the arm | content_set / none |
| name plus degree | C:plurai:21 | content_set / none |
| artifact-style id | C:negatives:X6 | room_content / identifier |
| ID-like string | ADV:id_upper | room_content / identifier |

Types are told apart by the case list, because several share one pair. None of them is ever sprouts_required.

## Before and after matrix (PGM)

| Set or group | Before (allow / ambiguous / block) | After |
|---|---|---|
| ALL (694) | 587 / 1 / 106 | 618 / 0 / 76 |
| P | 5 / 1 / 9 | 5 / 0 / 10 |
| ADV | 9 / 0 / 14 | 7 / 0 / 16 |
| C | 573 / 0 / 83 | 606 / 0 / 50 |
| positives_26 | 26 / 0 / 0 | 26 / 0 / 0 |
| compliant | 16 / 0 / 0 | 16 / 0 / 0 |
| 354-generic | 31 / 0 / 0 | 31 / 0 / 0 |
| extended | 498 / 0 / 37 | 527 / 0 / 8 |
| negatives | 0 / 0 / 10 | 1 / 0 / 9 |
| violation | 0 / 0 / 16 | 4 / 0 / 12 |
| 354-private | 0 / 0 / 10 | 0 / 0 / 10 |
| must_refuse | 0 / 0 / 10 | 0 / 0 / 10 |
| known_leaks | 2 / 0 / 0 | 1 / 0 / 1 |

53 verdict changes. Key lines (before > after, live pair):

- P:P2 allow > block content_set. P:P4 allow > block room_content/private_context. P:P3 stays block (content_set).
- P:P7 allow > block content_set. Removing the key gives allow (strip control passes).
- P:P10 (runway) and P:P13 (standup) block > allow generic_question.
- ADV:secret_fake_credential, ADV:key_mixed, ADV:key_lower allow > block content_set. ADV:key_upper stays block (content_set).
- C:known_leaks:GAP1 allow > block content_set.
- P:P14 ambiguous > allow typed_read_shape.

## The 37 over-blocked generic questions (PG33)

29 sprouts are allow (generic_question). 8 stay blocked, all as edges by shape, all answered sprouts_required with token class edge_rule (never a plain block). The full prose rules and the name rule apply to an edge:

| Case | Words | Shape | Class |
|---|---|---|---|
| C:extended:C18 | 15 | edge | sprouts_required/edge_rule |
| C:extended:C21 | 15 | edge | sprouts_required/edge_rule |
| C:extended:C31 | 14 | edge | sprouts_required/edge_rule |
| C:extended:C42 | 14 | edge | sprouts_required/edge_rule |
| C:extended:C44 | 27 | edge | sprouts_required/edge_rule |
| C:extended:C64 | 14 | edge | sprouts_required/edge_rule |
| C:extended:C68 | 24 | edge | sprouts_required/edge_rule |
| C:extended:C91 | 15 | edge | sprouts_required/edge_rule |

The planning-time list of 8 edges equals the measured list. stays_split_edges needed no change.

## Private-claim sprouts that left the room as written (PG33R)

Measured released set equals the owner acknowledgement of the plan 386-32 RCA (owner_ack: yes, 2026-11-06): C:negatives:X8, C:plurai:24, C:plurai:26, C:plurai:29, C:plurai:31. The 14 marked cases are split, not sent: C:negatives:X7, C:negatives:X10 and the 12 split_probe_ids (all sprouts_required/private_marker).

## Unreadable room.db (PG33U, fixture room, chmod 000)

- 510 extended sprouts: allow, class room_check_skipped.
- 25 extended edges and bodies: block, sprouts_required, token class room_check_unavailable.
- 5 sprouts joined with a fake credential: block.
- A sprout with a fixture lexicon word: allow room_check_skipped (the acknowledged exposure; owner_ack_unreadable_db_lexicon: yes).

## Surfaces (PG33S)

For a body, an edge (C:extended:C18) and a private-marker sprout (P:P12): callTool returns egress_blocked with egress_class sprouts_required, route sprout_call and the 5 line split_guide, with 0 network attempts. The hook exits 2 with the guide. No 3-word window of the input appears in the result or in stderr.

## Deviations from Plan

**1. [Rule 1 - Bug in plan pin] allowed_refusal_classes widened to the measured lexicon kinds**
- Found during: Task 1 (measurement of PG33C pairs).
- Issue: the plan allows room_content only with room_term. The must_refuse cases give room_content with person, venture_name, claim and room_file (all room-lexicon kinds).
- Fix: expectations.json allows room_content with the lexicon kinds room_term, claim, person, venture_name, room_name, room_file, and with identifier only on listed identifier cases. A plain room_content with no token class, private_context or name still fails (PGX1 proves it).
- Commit: c4b21b798.

**2. [Rule 1 - Bug in plan pin] brain_write cases added to PG33C**
- Issue: P:P1, P:P5 (write_blocked) and P:P6 (content_set) are brain_write calls, block before and after (decision A of plan 02). The plan lists no pair for them.
- Fix: write_cases in expectations.json with the classes write_blocked and content_set.
- Commit: c4b21b798.

**3. [Rule 1] Credential and SSN-like types skipped in replay**
- ADV:secret_fake_credential is allow in the baseline and the SSN-like string is built at run time, so PG33I cannot check them without a live call. Both print SKIP in replay. This keeps PG33I from failing in replay as the plan requires.
- Commit: c4b21b798.

Task 2 changed no file: the measured released set, stays_split_edges and the pinned pairs already matched. Task 3 changed no file.

## Known observations (not gate failures)

- Under-blocks that exist in the baseline and are unchanged, so not pinned: ADV:suffix_money, ADV:email_obfuscated_at, ADV:email_obfuscated_words, ADV:phone_intl, ADV:address_us, ADV:address_intl and ADV:name are allow after the plans. Plan 386-33 allows address and name cases by design (owner principle). Obfuscated emails and international phone numbers are not covered by any plan 386 arm. PGM lists the verdict changes.
- P:P9 ("we raised two million dollars last quarter") was allow in the baseline and is now sprouts_required/edge_rule. It is outside the PG33N groups.
- The commit landed on branch main of the worktree, as the task set.

## Known Stubs

None.

## Threat Flags

None. No product file changed.

## Self-Check: PASSED

- tests/test-386-audit-probe-gate.cjs: FOUND.
- tests/fixtures/386-audit-probes/expectations.json: FOUND.
- Commit c4b21b798: FOUND.
