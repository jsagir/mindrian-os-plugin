---
status: resolved
kind: rca
trigger: "part8-no-shape-test-for-sprouts-and-bodies"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T10:00:00Z
updated: 2026-11-06T10:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ e6ab6286b in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 37)
- **WIRE claims probe against:** none; no network; strings are synthetic; no guard code is called
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: The Part 8 guard has no shape test. Ordinary keywords meet word lists (over-blocking), and a pasted body is caught only when it happens to hit a word.
test: Measure words, sentences, lines, quoted spans and first-person statements on the 26 positives, the extended set, the 10 negatives, the 2 leak probes and the 10 must-refuse probes.
expecting: A shape rule with fixed thresholds that calls no corpus question a body.
next_action: Pin the shape test (RED), then build the pure module lib/core/part8-sprout-shape.cjs with no caller.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main (read with node lib/core/repo-version.cjs)
- Reported by: owner principle for Part 8, 2026-11-06 (PRD of Phase 386)
- Date first observed: 2026-11-06
- Related debug sessions: part8-egress-guard-room-lexicon-false-positive-blocks-theo, part8-egress-guard-under-blocks-key-shape-and-spelled-money

## Problem Statement

The guard cannot tell a short keyword query from a pasted body of text by shape. It uses word lists on ordinary keywords, which over-blocks short queries, and it misses a body that holds no listed word.

## Symptoms

expected: A short specific keyword query (a sprout) may leave the room. A paragraph, a quoted passage or several lines (a body) may not. Credentials are always blocked.
actual: No code measures size, sentence count, lines or quoted text. The only measures are word lists and patterns.
errors: none; the defect is a missing capability, not a crash
reproduction:
  1. Read lib/core/part8-egress-guard.cjs, function `classify` and the helpers it calls.
  2. Search for a count of words, sentences or lines. None exists.
  3. Observe that the verdict depends on lexicon and pattern hits only.
started: since the guard was built; made visible by the owner principle of 2026-11-06

## Reading of the owner principle (3 lines)

- Sprouts go out: a short specific keyword query for research or for the remote graph may leave the room.
- Bodies stay: a paragraph, a quoted passage or several lines of room text may not leave.
- The rule never cripples contextualised work: a word list that blocks an ordinary keyword is the wrong tool.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the guard is one function on all three)
- Affected commands: every route that sends free text to the Brain or to a web research line
- Affected users: all installs
- Version range: all versions with the guard
- Severity: medium (this plan changes no verdict; the later plans 386-25, 386-27 and 386-33 call the helper)
- Blast radius: plans 386-25, 386-27, 386-32 and 386-33

## Eliminated

- hypothesis: an existing helper already measures shape
  evidence: a search of lib/core for sentence and word counting in the guard path found none; the guard counts only lexicon and pattern hits
  timestamp: 2026-11-06T10:00:00Z

## Evidence

- timestamp: 2026-11-06T10:05:00Z
  checked: measurement script over tests/fixtures/3692/guard-survey-corpus.json, with the extended set rebuilt the way tests/test-3692-guard-survey-gate.cjs builds it (data/framework-names.json, commands/*.md descriptions, section-registry labels)
  found: see the Measurement block below. Counts only. No string is copied into this file except the corpus ids.
  implication: the proposed thresholds hold; no corpus question is a body

## Measurement

Method: words = whitespace tokens that hold a letter or digit. Sentences = split after a full stop, question mark or exclamation mark followed by a space and a letter, or at the end. Lines = count of newline characters after trimming. Quoted span = a pair of quotation marks around 4 or more words, a markdown blockquote line, or a code fence. First-person statement = my, our, we or I in subject position at the start of a clause, in a text that is not a question (a question starts with a wh-word, an auxiliary, explain, define, compare or describe, or ends with a question mark).

Sets and counts (n, words max, words 95th percentile, sentences max, sentences 95th percentile, lines max, quoted spans, first-person statements, classes under the proposed thresholds):

- positives_26: n=26, words max 12, p95 12, sentences max 1, p95 1, lines max 0, quoted 0, first-person 0; sprout 26, edge 0, body 0
- extended: n=535 (framework names 427, command descriptions 97, section labels 11), words max 27, p95 12, sentences max 2, p95 1, lines max 0, quoted 0, first-person 0; sprout 510, edge 25, body 0
- extended command descriptions only: n=97, words max 27, p95 17; sprout 72, edge 25, body 0 (the 25 edge strings are long but single or double sentence questions)
- negatives: n=10, words max 16, p95 16, sentences max 1, lines max 0, quoted 0, first-person 1 (X2); sprout 6, edge 4, body 0
- leak probes: n=2, words max 9; sprout 2 (GAP1, GAP2)
- must_refuse: n=10, words max 13; sprout 9, edge 1, body 0

Classes of the 10 negatives (id, class, words):

- X1 edge 13
- X2 edge 12 (first-person statement: our startup pivoted)
- X3 sprout 7
- X4 sprout 6
- X5 edge 16
- X6 sprout 10
- X7 sprout 9
- X8 sprout 8
- X9 edge 14
- X10 sprout 8 (my appears as an object inside a question, so it is not a statement)

Reading: the 26 positives reach exactly 12 words at the maximum, so the sprout limit cannot go below 12 without turning a corpus question into an edge. The longest extended string has 27 words, so the body limit of 40 words leaves a margin of 13 words. No corpus string has 2 sentences in the positives, and the extended maximum is 2, so the 3-sentence body limit leaves a margin of 1 sentence. Not one corpus string has a newline or a quoted span. The thresholds of the plan are unchanged by the measurement.

Anchored lines (read by the test and by plan 386-32):

sprout_max_words: 12
body_min_words: 40
body_min_sentences: 3
corpus_body_count: 0
negatives_sprout_count: 6
negatives_sprout_ids: X3,X4,X6,X7,X8,X10

Information for plan 386-32: 6 of the 10 negatives are sprouts by shape. A short private claim can be a sprout by shape: X7 (a confidentiality marker) and X10 (my customers and my pricing) are the private-context negatives that pass the shape test. X3 and X4 carry an identity or a credential and X6 carries an identifier; those are caught by credential and identifier rules, not by shape. X8 carries a money figure and is caught by the money rule. The owner must see this list when the line between sprout and body is chosen.

## Technical Root Cause

- Site: lib/core/part8-egress-guard.cjs, function `classify` and the lexicon, name and pattern rules it applies
- Cause: the guard has no shape test, so ordinary keywords meet word lists (over-blocking), and a body is caught only by a lucky word.
- Why it surfaces now: the owner principle of 2026-11-06 states that shape, not a word list, separates a sprout from a body.

## Required Code Changes

- Change 1:
  - Location: lib/core/part8-sprout-shape.cjs (new file)
  - Current behavior: no shape helper exists
  - Required behavior: export `classifyShape(value)` returning kind (sprout, edge or body), words, sentences, lines, quoted and firstPersonStatement; pure, Node built-ins only, no word list of names, companies, months, places or business words; a non-string is a body and never throws
  - Short-term patch: none; this plan adds the helper only
  - Long-term fix: plans 386-25, 386-27 and 386-33 call the helper; plan 386-32 records the owner decision on the line

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-386-sprout-body-shape.cjs
  - Given: synthetic sprouts, edges and bodies, the corpora, and the anchored lines of this file
  - When: classifyShape runs on each
  - Then: arms SH1 to SH6 pass; no corpus question is a body; the negatives have the recorded classes
  - Runner registration: picked up by tests/run-all-386.sh by glob

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: owned by plan 386-21.
- Canon Part 8: no Brain wire is touched and no verdict changes. The helper has no caller in this plan.
- Tri-Polar: the module is pure Node and has no surface-specific code; it is verified by construction on CLI, Desktop and Cowork.
- Cross-platform: no process, path or shell use; verified on Linux only, correct by construction elsewhere.

## Resolution

root_cause: The guard has no shape test, so ordinary keywords meet word lists and a body is caught only by a lucky word.
fix: added the pure module lib/core/part8-sprout-shape.cjs (classifyShape; thresholds 12 words, 40 words, 3 sentences, 2 newlines, quoted span of 4 or more words). No caller. No verdict change.
verification: node tests/test-386-sprout-body-shape.cjs passes SH1 to SH6 (RED before the module, GREEN after). corpus_body_count 0 of 561 questions. bash tests/run-all-196.sh: 7 passed, 0 failed. node tests/test-3692-guard-survey-gate.cjs: GATE PASS, MEASURED_SHA256 1b2fc8440d3a71833a2f692baad7bdba3099dc26ea579e524caf2624a4f8dd00 before and after (no verdict change). bash tests/run-all-386.sh reports test-386-sprout-body-shape.cjs PASSED. A 1 MB string classifies in 74 ms.
files_changed:
  - lib/core/part8-sprout-shape.cjs (new)
  - tests/test-386-sprout-body-shape.cjs (new)
  - .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md (new)
commits: see git log for 386-37 (RCA, RED test, module)
