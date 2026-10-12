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
updated: 2026-10-12T14:30:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 63b25583d and later on 2026-10-12, local dev workspace /home/jsagi/dev/MindrianOS-Plugin
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

## Technical Root Cause

PENDING

## Required Code Changes

PENDING; any pattern widening is measured against the 26-question positive corpus and the 522-question extended corpus so it does not reintroduce false positives (the sibling session's harness).

## Tests to Add or Update

- Extend the negative corpus test planned in the sibling session (tests/test-3692-lexicon-generic-entries.cjs or its successor) with one case per missed shape; each must block with the expected class, with and without a room.

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
