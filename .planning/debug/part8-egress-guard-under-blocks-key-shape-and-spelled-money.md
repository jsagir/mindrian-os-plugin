---
status: investigating
kind: rca
trigger: "part8-egress-guard-under-blocks-key-shape-and-spelled-money"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-10-12T14:30:00Z
updated: 2026-11-06T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ d4e295b38 (plan 386-31 re-check, 2026-11-06), release worktree /home/jsagi/dev/MindrianOS-Plugin-release; first written against 63b25583d on 2026-10-12
- **WIRE claims probe against:** none; the guard is called directly in-process with fetch replaced; 0 network calls
- **Date of audit:** 2026-10-12
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding; otherwise tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: The guard's content scan (scanForContent, Canon FORBIDDEN_PATTERNS in lib/core/cross-room-aggregator.cjs:92-111) and the identifier rule (_hasUnknownIdentifier, part8-egress-guard.cjs:935-942) match only uppercase key shapes and currency-symbol money, so a vendor-prefixed mixed-case API key and a money figure spelled with the word "dollars" pass the Part 8 guard to the Brain with or without a room bound.
test: Reproduce the two strings against classify() with no room and with a room; read the two pattern sets; enumerate the common key prefixes (sk-, ghp_, xoxb-, AKIA, AIza, pk_live_, rk_live_, npm_, glpat-) and spelled-money forms the patterns miss; measure against the 10-string negative corpus and the 26-question positive corpus so a widened pattern does not reintroduce false positives.
expecting: The two strings return allow generic_question today; a widened identifier pattern and a spelled-money pattern refuse them while the 26 positives still pass.
next_action: gsd-debugger reproduces, lists the missed shapes with their patterns, measures, proposes a pattern change with its false-positive cost; then one /gsd-quick.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.66 on main
- Reported by: the gsd-debugger of session part8-egress-guard-room-lexicon-false-positive-blocks-theo, 2026-10-12, while building a negative corpus (GAP1, GAP2 in that session's Evidence)
- Date first observed: 2026-10-12
- Related debug sessions: part8-egress-guard-room-lexicon-false-positive-blocks-theo (the false-positive sibling; this session is the false-negative direction), part8-egress-guard-blocks-pws-brain-mcp-unconditionally

## Problem Statement

Two strings that carry a credential shape or a money figure pass the Part 8 egress guard and would reach the Brain. The guard is meant to refuse both classes unconditionally.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A free-form Brain payload that contains a credential-like token (any common vendor key prefix, mixed case) or a money figure in any written form is refused by the content scan or the identifier rule, with or without a room bound.
actual: In the sibling session's negative-corpus run (scratch scripts under .planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/scripts/, outputs/), two first-draft negatives returned allow with no room and in every one of 34 room copies: GAP1 a vendor-prefixed mixed-case API key; GAP2 a spelled-out money figure of the form "750000 dollars". The uppercase key shape (X4) and the currency-symbol figure ($750K, X8) were refused.
errors: none; the defect is a silent allow
reproduction:
  1. node -e: require lib/core/part8-egress-guard.cjs; call classify({question: '<text with a vendor-prefixed mixed-case key>'}, {toolName: 'brain_ask'}) with no roomDir.
  2. Observe verdict allow, class generic_question.
  3. Repeat with '<text with 750000 dollars>'. Observe allow.
  4. Repeat with an all-uppercase key shape and with '$750K'. Observe block (identifier, content_set).
  The exact strings live in the sibling session's scripts/corpus.cjs (GAP probes); they are synthetic.
started: unknown first-bad; the content-set patterns date from Phase 196-03 (2026-07-01); the identifier rule from 369.2-01 (2026-10-05)

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (same classify function on every entry point: hook, callTool belt, typed free-form gate, query)
- Affected commands: every free-form brain_* call
- Affected users: every install
- Version range: present on main 2026-10-12; first-bad unknown
- Severity: high (a Part 8 leak class, not a false refusal; Canon Part 8 is absolute)
- Blast radius: any caller that forwards user text to the Brain

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-12T14:30:00Z
  checked: the sibling session's Evidence entry of 2026-10-12T21:10:00Z (negative corpus, 10 strings, 34 rooms plus no room) and its scripts/corpus.cjs GAP probes
  found: X4 (uppercase key shape) blocked as room_content/identifier; X8 ($750K) blocked as content_set; GAP1 (vendor-prefixed mixed-case key) and GAP2 ("750000 dollars") allowed in every configuration
  implication: the key pattern is case- or prefix-bound and the money pattern is symbol-bound; both need enumeration against real vendor shapes and written forms before a pattern change

## Plan 386-31 reproduction (2026-11-06, counts only, synthetic fakes built at run time)

14 fake credential shapes (lower-case sk-, sk-proj-, ghp_, github_pat_, xoxb-, AKIA key id, AIza, pk_live_, rk_live_, npm_, glpat-, a 3-part JWT, a Bearer header, an api_key= parameter), each placed in a brain_ask question and in a brain_query cypher (roomDir null, plugin prefix), and passed to auditWebCredential.

| Route | Blocked | Allowed | Class of each block |
|-------|---------|---------|---------------------|
| brain_ask question | 2 | 12 | AKIA: room_content/identifier; Bearer: room_content/name |
| brain_query cypher | 2 | 12 | the same 2 shapes, room_content |
| auditWebCredential | 2 | 12 | the Bearer shape and the api_key= shape only |

Which existing rule catches which form today: AKIA is caught by `_hasUnknownIdentifier` (an upper-case alphanumeric run with a digit and a letter). The Bearer header is caught only because its token reads as a proper name (`_hasUnknownProperName`). Nothing in FORBIDDEN_PATTERNS (lib/core/cross-room-aggregator.cjs) matches a vendor key shape. The lower-case and mixed-case vendor keys, the JWT and the api_key= parameter pass the Brain scan.

Money forms (brain_ask, "benchmarks for <form> saas"): `$750K` block (currency magnitude), `40 percent` block (percent word); allowed: two million dollars, 750000 dollars, 750k, 40%, one hundred thousand euros (5 of 7 pass). The existing patterns need a currency symbol, an upper-case K/M/B suffix or the word percent.

Corpus gate numbers at plan start (node tests/test-3692-guard-survey-gate.cjs, GATE PASS): pos26.blocked_no_room 0; pos26.induced [gate-segment:N6:room_term] (baseline equal); ext.blocked_no_room 37; ext.induced_total 0 (baseline 0); negatives.leaks []; must_refuse.failed []; known_leaks GAP1 allowed_in 7, GAP2 allowed_in 7 (both open); catalog measured 535 (B 427, C 97, D 11) against baseline 522, reported as NOTE.

## Technical Root Cause

The Brain content scan has no credential rule. FORBIDDEN_PATTERNS carries PII, currency-symbol and idiom patterns only. A key shape is caught by accident: the identifier rule (upper-case run with a digit) or the proper-name look. A lower-case or mixed-case vendor key (sk-, ghp_, xoxb-, AIza, pk_live_, npm_, glpat-), a JWT and an api_key= parameter match nothing, so they come back allow/generic_question (12 of 14 shapes). The web credential check has the same gap: it carries 2 rules (Bearer with 12 or more characters, api_key=) plus 3 env-var values, so it passes the same 12 shapes. PROVEN by the table above. GAP1 of the corpus baseline is this cause.

GAP2 (spelled money) is a different matter. Money written without a currency symbol, and `750k` or `40%`, are ordinary keywords in a short query (owner principle of 2026-11-06). They are not a leak by themselves; they matter in a body of text, and the shape rule of plan 386-32 and 386-33 decides that. No pattern is added for them here.

## Required Code Changes

1. `lib/core/cross-room-aggregator.cjs`: a frozen `CREDENTIAL_SHAPES` list (vendor-prefixed keys in any letter case, a 3-part JWT, Bearer with a token of 16 or more characters that holds a digit, api_key=), added to `FORBIDDEN_PATTERNS` and exported.
2. `lib/core/rs-egress-prompts.cjs`: `auditWebCredential` tests the same `CREDENTIAL_SHAPES` list (credentials only, no content pattern), keeps its 2 existing rules and its env-var check, and re-exports `CREDENTIAL_SHAPES`.
3. `lib/core/part8-egress-guard.cjs`: no private pattern copy (PB8-02). Change only if the corpus gate needs it.
4. Money, percent and k-suffix forms: no pattern. Forms that pass today (input for the decision table of plan 386-32): two million dollars, 750000 dollars, 750k, 40%, euro amounts. Forms that already block: $750K, 40 percent.
5. After the patterns land, run the corpus gate (zero FAIL rows, ext.induced_total at or below 0), then re-stamp with a reason.

## Tests to Add or Update

- tests/test-386-key-shapes-and-money.cjs (plan 386-31): K1 each fake shape blocks content_set on brain_ask, K2 on brain_query, K6 auditWebCredential refuses each, K7/K8/K9 pins (swot analysis allows; web check accepts ordinary words; short keyword queries with money words still allow).

## Non-Code Follow-ups

- CHANGELOG.md Fixed entry; release lockstep if it ships.
- knowledge-base.md block on resolve.
- The harness gate (quick 261012-sc0) carries these cases once they exist.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PENDING
fix: none yet
verification: none yet
files_changed: none
commits: none
