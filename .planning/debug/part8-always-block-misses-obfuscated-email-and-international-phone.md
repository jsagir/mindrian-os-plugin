---
status: investigating
kind: rca
trigger: "part8-always-block-misses-obfuscated-email-and-international-phone"
issue_id: "E-IDENT"
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T18:00:00Z
updated: 2026-11-06T18:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 43cbedaed (working tree of /home/jsagi/dev/MindrianOS-Plugin-release).
- **WIRE claims probe against:** none. No Brain call, no network. `globalThis.fetch` and `net.Socket.prototype.connect` are throwers with a counter (0 calls). Throwaway HOME. No real room.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim is PROVEN (run in this session) unless marked UNVERIFIED or ASSUMED.

## Current Focus

hypothesis: the always-block list holds only the plain email at-sign form and a United States phone shape, so the same identifiers in an obfuscated or international form pass.
test: classify() on strings built at run time, then each candidate rule alone over the corpora.
expecting: the three probe forms are allow today; each candidate rule hits 0 ordinary questions.
next_action: write the RED test (ID1 to ID9), then append the two patterns.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: probe gate of plan 386-40 (SUMMARY)
- Date first observed: 2026-11-06
- Related debug sessions: part8-over-blocks-ordinary-theo-and-context-questions, part8-egress-guard-under-blocks-key-shape-and-spelled-money

## Problem Statement

An obfuscated email (name [at] domain [dot] tld) and an international phone-like number (+972 54 555 0198 style) pass the guard as generic questions. The plain forms block. The owner principle says emails and phone-like strings always block.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: block, class content_set, token class none (the pair of the plain email and the plain phone-like number), in every shape.
actual: allow, class generic_question, on brain_ask, brain_search and a brain_query cypher.
errors: none.
reproduction:
  1. Scratch script (not committed): /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/s46/repro.cjs
  2. classify() with a temporary HOME, roomDir null, on the three probe cases of tests/fixtures/386-audit-probes (read through tests/helpers/audit-probe-loader.cjs).
  3. Read the verdict and class.
started: the always-block list dates from Phase 196 and plan 386-33 (the split into ALWAYS and PROSE).

## Scope and Impact

- Affected surfaces: cli (hook and belt), desktop and cowork (belt).
- Affected commands: every free-form Theo or Brain call (brain_ask, brain_search, brain_query).
- Severity: medium (a person identifier leaves in a modified form; the plain form blocks).
- Blast radius: ALWAYS_PATTERNS and FORBIDDEN_PATTERNS consumers (auditQueryString, auditQueryObject). Appended patterns only; no pattern changes.

## Eliminated

- hypothesis: suffix_money carries a credential. NOT CONFIRMED. The string is "monthly sales reached 250K last quarter": a money figure, no vendor prefix, no token, no key parameter.
  evidence: classify returns allow/generic_question on brain_ask and brain_search.
  timestamp: 2026-11-06T18:00:00Z

## Evidence

- timestamp: 2026-11-06T18:05:00Z
  checked: live classify on the three probe cases, three tools (scratch repro.cjs, 0 network calls)
  found: all three are allow/generic_question on brain_ask, brain_search and brain_query.
  implication: the always-block list has no rule for these forms.

repro_email_obfuscated_at: allow/generic_question
repro_email_obfuscated_words: allow/generic_question
repro_phone_intl: allow/generic_question
plain_pair: content_set/none

- Tool detail (PROVEN): email_obfuscated_at, email_obfuscated_words and phone_intl are allow/generic_question on brain_ask, brain_search and brain_query. The plain forms (email_plain, phone_us) are block/content_set/none on all three tools. A body of 4 sentences that holds the obfuscated email is block/sprouts_required (class body_shape) today, not the identifier pair.
- Pattern read (PROVEN): _P_EMAIL needs "@" then a domain with a dot. _P_PHONE is the United States shape of 3, 3 and 4 digits with an optional "+1". "+972 54 555 0198" has groups of 3, 2, 3 and 4 digits, so it does not match.

### Candidate rules (shape-bound, not a word list)

Rule 1, obfuscated email (case-insensitive):
- Bracket form: a local part, an AT marker ("[at]" or "(at)", spaces allowed), a label, then dot markers ("[dot]", "(dot)" or a real dot) and a top-level label of 2 or more letters.
- Plain-word form: a local-part token, the word "at", a label, then the word "dot" and a top-level label, with more "dot label" pairs allowed. The label after "at" is not a determiner or a pronoun (the, a, an, this, that, my, our, your, its, his, her, their, each, every, any, some, all, one, it, us, me, you, them) and not a small set of ordinary nouns (least, most, first, last, once, home, work, launch, noon, night, scale). The top-level label is not the word "dot".

Rule 2, international phone-like: a plus sign that is not preceded by a word character or another plus sign, a country code of 1 to 3 digits, then digit groups (1 to 5 digits each, optional round brackets, separated by one space, dot or hyphen) and at least 8 digits in the run in all. A plus sign followed by a space does not match, so "3 + 2" does not match.

### False-positive measurement (each rule alone, scratch script measure.cjs)

Items measured (PROVEN, 742 strings): 15 P payloads, 23 adversarial cases, the 656 corpora cases (positives_26 26, extended 535, negatives 10, compliant 16, violation 16, 354-generic 31, 354-private 10, must_refuse 10, known_leaks 2) and the 3692 corpus lists (positives_26 26, negatives 10, must_refuse 10, known_leaks 1). The 522 derived extended questions of the survey gate are covered by the gate itself (ext.induced_total) and by the 535 materialised set. Count = cases that are allow today and that the rule matches.

- Rule 1 (obfuscated email) alone: 2 matches, both the intended hits (ADV:email_obfuscated_at, ADV:email_obfuscated_words). Ordinary matches: 0.
- Rule 2 (international phone-like) alone: 1 match, the intended hit (ADV:phone_intl). Ordinary matches: 0.
- Ordinary pins of my own (16 sentences, kept for arm ID3 of the test): at the dot com stage, look at the dot com bubble, 3 + 2 rule for 30 days, a time of day with "dot", +2 and +5 rules, 1+1=2, A+ with numbers, +30% over 12 months, a plus sign next to 972, arrive at home dot com, at scale dot com, at launch dot com, a list of +3 to +9. Rules 1 and 2 match none of them. A first draft without the determiner list matched "look at the dot com bubble"; the list closed it.
- The positive forms checked: 9 email forms (square brackets, round brackets, plain words, upper case, no spaces, a real dot after the bracket at, a chain of two dots) and 8 phone forms (+972 spaces, +44, +49 with a bracketed area code, hyphens, dots, +1, +33, +61 inside a sentence) all match.

ordinary_blocked_by_email_rule: 0
ordinary_blocked_by_phone_rule: 0
ordinary_blocked_max: 0

The count is 0, below the limit of 3. No owner decision is needed.

### suffix_money

String: "monthly sales reached 250K last quarter". Guard result: allow/generic_question on brain_ask and brain_search (on a brain_query cypher it is block/content_set, from the cypher line of the dollar and magnitude rules; not touched here). It is a money form. Money forms are body-only by the owner decision of plans 386-32 and 386-33. No vendor prefix, no token, no key parameter.

suffix_money: stays_allow
carries_credential_suffix_money: no

## Technical Root Cause

- Site: lib/core/cross-room-aggregator.cjs, constants _P_EMAIL, _P_SSN, _P_PHONE and the lists ALWAYS_PATTERNS and FORBIDDEN_PATTERNS.
- Cause: the always-block list holds only the plain email at-sign form and a United States phone shape. The same identifiers in an obfuscated or international form match no pattern, so the guard sees an ordinary question.
- Why it surfaces now: the second audit probe set (plan 386-39, 386-40) included these forms for the first time; no earlier plan 386 arm covers them.

## Required Code Changes

- Change 1:
  - Location: lib/core/cross-room-aggregator.cjs, constants near _P_PHONE and the lists ALWAYS_PATTERNS and FORBIDDEN_PATTERNS
  - Current behavior: obfuscated email and international phone-like numbers are allowed.
  - Required behavior: add two frozen patterns (Rule 1 and Rule 2 above) with a comment that cites plan 386-46. Append both to ALWAYS_PATTERNS and to the end of FORBIDDEN_PATTERNS. Do not change an existing pattern or its order.
  - Short-term patch: none.
  - Long-term fix: none needed.
- Change 2:
  - Location: tests/fixtures/386-audit-probes/expectations.json
  - Required behavior: add the three probe cases to structured_identifier_cases, to the email and phone_like entries of identifier_classes and to content_set_cases, so the probe gate (PG33I) covers them.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-386-identifier-forms.cjs
  - Given: a temporary HOME, strings built at run time
  - When: classify on obfuscated email and international phone forms, in a sprout, an edge and a body
  - Then: block with content_set and no token class; ordinary pins stay allow; pattern order is kept
  - Runner registration: tests/run-all-386.sh discovers tests/test-386-*.cjs
- Test 2:
  - Type: unit
  - Location: tests that pin the number of patterns (found by grep); flip to the found count plus 2, relative.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: plan 386-21 owns them.
- Baseline stamp: only if a corpus number improved (none expected; ext.induced_total stays 0).

## Resolution

root_cause: PENDING
fix: PENDING
verification: PENDING
files_changed:
  - PENDING
commits: PENDING
