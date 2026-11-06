# Audit probe fixtures (Phase 386, plan 386-39)

These are the 3 probe files of the second audit, kept as regression fixtures for the Part 8 egress guard. They hold invented data only. They came from a download, so they were treated as untrusted data and vetted before they entered the repository.

Files:

- p-cases.json: 15 P cases (tool name and payload).
- adversarial-cases.json: 23 adversarial cases (one text each).
- corpora-cases.json: 656 corpus cases in 9 groups (extended 535, 354-generic 31, positives_26 26, compliant 16, violation 16, negatives 10, must_refuse 10, 354-private 10, known_leaks 2).
- baseline-before.json: the verdict and class of every case, recorded before plans 386-25, 386-28 and 386-31 changed the guard.
- baseline-head-matrix.json: the same matrix recorded from a later commit that already held those plans (see below).
- ../../helpers/audit-probe-loader.cjs: the loader, the run-time key builder and the offline classifier.

## What the vetting found and changed

- Key shapes: 10 cases held a key-shaped string. Each one is stored as an array of parts under a join key, cut right after the vendor prefix, and the loader joins the parts at run time. No file here stores a credential shape.
- Emails: 2 addresses used a real-looking domain. They now use a reserved example domain.
- Names: 5 cases held a name that is not in another tracked fixture (one of them matched the first name of a real person). They now use names that already exist in the synthetic rooms. The verdict and the class of each rewritten case stayed equal.
- must_refuse: the 10 cases had the id undefined in the source. They are renumbered must_refuse:1 to must_refuse:10 in file order. The room field is kept.
- Extended group: the text of all 535 questions was found in the framework names, the command descriptions or the section registry. No case needed a manual exclusion.
- No URL, no private path, no phone number outside the fictional 555-01xx range, no dash character.
- Proof of parity: all 694 rows give the same verdict, class and token class before and after the rewrites, on 2 versions of the guard.

## How to run

- Hygiene test: node tests/test-386-audit-probe-fixtures.cjs
- Load the cases: require the loader and call loadProbes(). Every string is resolved and every case has a key (P:id, ADV:id or C:id).
- Record a matrix: node tests/helpers/audit-probe-loader.cjs --record out.json [--root folder] [--head sha] [--note text]. The command uses a temporary HOME and synthetic rooms. It counts network attempts and the count must stay 0.

## Two baselines, two commits

baseline-before.json is the state before plans 386-25, 386-28 and 386-31. Those plans had already landed in HEAD when this plan ran, so the baseline was not recorded from HEAD. It was recorded from a git archive export of commit f0df97036, the planning-time commit. That commit is before plans 25, 28 and 31 and already holds the brain_write block of plan 386-04. Do not re-record baseline-before.json. Plan 386-40 compares against it.

baseline-head-matrix.json is a second matrix from a git archive export of the HEAD of that day. It shows the state after plans 25, 28 and 31, so plan 386-40 can show before and after.

Both exports ran in a scratch folder with a throwaway HOME and rooms folder, no network, and node_modules linked from the repository.

Readings that matter for plan 386-40 (verdict and class):

- Before (f0df97036): P2 allow move_set, P4 allow move_set, P7 allow generic_question, P14 ambiguous unknown. The key-shaped cases secret_fake_credential, key_mixed and key_lower were allowed.
- After (head matrix): P2 block content_set, P4 block room_content, P7 block content_set, P14 allow typed_read_shape. Those 3 key-shaped cases are blocked. Known leak GAP1 is blocked.
- Unchanged in both: 37 extended questions are blocked (36 by the name rule, 1 by content_set), and P10 and P13 are blocked by content_set. Plans 386-28, 386-31 and 386-33 decide what happens to those.

## Anchored lines

cases_total: 694
p_cases: 15
adversarial_cases: 23
corpora_cases: 656
key_cases_split: 10
emails_rewritten: 2
names_rewritten: 5
excluded_cases: none
extended_unsourced_reviewed: yes
baseline_before_commit: f0df97036
baseline_guard_head: f0df97036
baseline_note: none (the counts equal the planning-time reference: P 5 allow, 1 ambiguous, 9 block; adversarial 9 allow, 14 block; corpora 573 allow, 83 block; extended 498 allow, 37 block)
head_matrix_file: baseline-head-matrix.json
head_matrix_commit: 349b3275e
