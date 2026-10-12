---
phase: quick-261012-sbz
plan: "01"
status: complete
severity: blocker
canon_parts: [7, 8]
commits:
  red: 3fea3e954
  green_with_changelog: c8e59445d
pre_change_sha: 0defa83361ac456fa1d7e81143a13d9093bb138e
commit_trailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
---

# Quick 261012-sbz Summary: Part 8 room lexicon drops names made only of methodology vocabulary (S1)

One-liner: `makeEntry` in `lib/core/part8-room-lexicon.cjs` now drops a room_term or room_file entry when every token is in the union of the guard vocabulary and the core section names (decision D-S1), so a generic methodology question reaches Theo when the bound room holds an artifact titled `business-model` or an entity named `Design`.

## Commits

| Step | sha | Paths |
|------|-----|-------|
| RED | 3fea3e954 | tests/test-3692-lexicon-generic-entries.cjs (new), tests/run-all-3692.sh (+1 line) |
| GREEN + CHANGELOG bullet | c8e59445d | lib/core/part8-room-lexicon.cjs, CHANGELOG.md (+1 line, 0 removed) |

Both commits end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` as the last line. Both were made with `git commit --only -- <paths>`. PLAN.md and SUMMARY.md are not committed (orchestrator commits docs). The CHANGELOG bullet is in the GREEN commit (orchestrator ruling 4), so there are 2 commits, not 3.

## Results

Fixture false positives (synthetic fixture room, 26 methodology questions, room bound):
- Before (RED run): 11 of 26 blocked (N1 room_file; N2, N5, N6, D1, D9, D13, D15, D17, D19 room_term; D3 room_file).
- After (GREEN run): 0 of 26 blocked. With no room bound: 0 of 26 before and after.

Legs (RED run -> GREEN run):
- L0 PASS -> PASS, L1 FAIL -> PASS, L2 FAIL -> PASS, L3 PASS -> PASS, L4 PASS -> PASS, L5 PASS -> PASS, L6 FAIL -> PASS, L7 FAIL -> PASS, L8 PASS -> PASS.
- RED line: `PASS: 5 FAIL: 4` exit 1. GREEN line: `PASS: 9 FAIL: 0` exit 0.

Negatives: 10 of 10 block with the room bound and with no room bound, with the expected classes (X1, X3, X5, X8, X9 content_set; X2, X7, X10 room_content/private_context; X4, X6 room_content/identifier). Before the change X4 gave room_term with the room bound.

Retention on the fixture (room bound): person -> room_content/person, two-word company -> room_term, venture_name from ROOM.md -> venture_name, claim sentence -> claim, one-word institution -> room_term. The V1f sentence "solar cold locker" still blocks room_term with the room bound and allows with no room.

CLI hook (L7): N1 and N5 exit 0; the person question and X2 exit 2. The hook and the in-process classify agree.

Other checks:
- `node tests/test-3692-theo-verdict.cjs` exit 0, file unchanged since the pre-change sha.
- `node lib/core/part8-egress-guard.test.cjs` exit 0.
- matchLexicon text is identical to the pre-change text (node compare: `matchLexicon identical: true`).
- `git diff --quiet <pre-sha>` over lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs, lib/core/refusal-messaging.cjs, scripts/part8-egress-guard-hook.cjs, tests/test-3692-theo-verdict.cjs: clean.
- Dash count (em and en) is 0 in every changed file.
- No network: fetch replaced in the test, L8 shows 0 calls.

## run-all-3692 totals

- Baseline (pre-change): `Phase 369.2: PASSED=70 FAILED=0 SKIPPED=0 KNOWN=0`.
- Final (after GREEN): `Phase 369.2: PASSED=71 FAILED=0 SKIPPED=0 KNOWN=0`.
- The only difference in the `>>> ` lines is one added line: `>>> 3692: lexicon drops generic-only room names (quick 261012-sbz): PASSED`.

## Survey measurement (34 scratch room copies existed; counts only)

Raw outputs stayed in the session scratchpad. Counts are in `261012-sbz-measure.txt` in this folder.

| Measure | Before | After |
|---------|--------|-------|
| 26 set, room-induced false positives | 30 of 884 (9 rooms; room_term 14, room_file 16) | 6 of 884 (1 room; room_term 6) |
| Extended set | not run before | 50 of 16490 (6 rooms; room_term 39, room_file 10, claim 1) |
| Negatives leaked with a room bound | 0 | 0 |
| Negatives allowed with no room | 0 | 0 |

Retention (entries the pre-change lexicon refused and the S1 lexicon no longer refuses): lost 205 of 9135 = room_file 71 of 937, room_term 134 of 1252. Lost 0 for claim (6884), person (11), venture_name (20), room_name (31). These numbers equal the expected values.

## Known residual (owner: quick 261012-sc0)

The token `segment` is in none of the five sources. An entity named `Segment` or `Customer Segment` stays in the lexicon and still blocks a customer-segment question such as N6. The 6 remaining false positives in the 26 set are room_term entries of this kind (PROVEN count 6 in 1 room; the cause class is ASSUMED from the plan and not traced entry by entry, to avoid reading room text).

Also accepted by the navigator (threat T-sbz-02): a real company whose whole name is methodology words (for example "Design Matrix") loses lexicon protection. venture_name and the content rules still cover the room's own name.

## Deviations from Plan

1. [Rule 3 - fixture hygiene] Ruling 7: the plan copies the 10 negatives literally from the debug corpus. Three strings in X1 (email domain), X5 and X9 used names that may be real (a hardware retailer, a robotics firm). I replaced them in the test only: `nimbusrobotics.example` -> `fennickrobotics.example`, `Nimbus Robotics` -> `Fennick Robotics`, `Calder gripper` -> `Thessaly gripper`, `Harbor Freight Partners` -> `Harbor Quill Partners`. The expected classes did not change (all 10 pass). The debug corpus file itself is not edited.
2. [Placement] The S1 rule sits after `if (tokens.length === 0) return null;` in `makeEntry`, not directly after `if (generic) return null;`. The behavior is the same: the empty-token case returned null before, and the rule only touches room_term and room_file. No other line of `makeEntry` changed.
3. [Orchestrator ruling 4] CHANGELOG bullet went into the GREEN commit, not a third docs commit. The plan's numstat guard passed: 1 added line, 0 removed.
4. A first edit of `tests/run-all-3692.sh` removed one space of padding on the web-lines line. I restored it before the commit; the committed diff is exactly 1 added line.

No auth gates. No package installs.

## Dirty tree note

`git status --short -- lib tests CHANGELOG.md` is empty after the last commit. HEAD is c8e59445d, so no peer commit landed during the run. The untracked `.planning/debug/*` files belong to other work and were not touched. The quick folder 261012-c6n was not touched.

## Debug session

The debug session Resolution is left for the main session, to be updated after the gate quick 261012-sc0.

## Self-Check: PASSED

- 3fea3e954 and c8e59445d are ancestors of HEAD (merge-base check).
- Files exist: tests/test-3692-lexicon-generic-entries.cjs, the changed lexicon, the quick-folder evidence files (pre-sha, baseline, red, green, final, measure).
