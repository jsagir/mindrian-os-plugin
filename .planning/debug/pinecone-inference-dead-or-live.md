---
status: investigating
kind: rca
trigger: "pinecone-inference-dead-or-live"
issue_id: "A2-5"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T08:05:00Z
updated: 2026-11-06T08:05:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` working tree of /home/jsagi/dev/MindrianOS-Plugin-release (plugin 2.0.0-beta.80), 2026-11-06
- **WIRE claims probe against:** none. The module was run only with a stub `fetchFn`, a fake key and synthetic strings. No network call was made.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run or read in this session), UNVERIFIED or ASSUMED.

verdict: DEAD

## Current Focus

hypothesis: lib/core/pinecone-inference.cjs has no runtime caller. It was ported in Phase 272 and kept on purpose by Phase 296 D-06.
test: search every tree for the module name and the exported function name, class each hit, then run the module offline with a stub.
expecting: 0 runtime callers; 2 gate checks that would pass a long body and a credential shape if the module were ever called.
next_action: owner decision (keep and record, hand to Phase 385 as a removal candidate, or gate it).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: AUDIT-2-DELTA.md item A2-5 (auditor hypothesis, marked NOT VERIFIED)
- Date first observed: 2026-11-05
- Related debug sessions: none

## Problem Statement

CLAUDE.md says Pinecone is retired and embeddings are local. lib/core/pinecone-inference.cjs still holds an `api.pinecone.io` sender whose only guard is `auditQueryString` on each text. The question is whether anything can call it.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: a retired surface has no sender.
actual: the file exists, exports `embedViaPineconeInference`, and a test and a residue gate assert it stays.
errors: none.
reproduction:
  1. Search the repo for `pinecone-inference` and `embedViaPineconeInference`.
  2. Classify each hit.
started: Phase 272-04 (commit 068d72f3b, 2026-08-31) added the module. Phase 296 (D-06) kept it.

## Scope and Impact

- Affected surfaces: none today (no caller).
- Affected commands: none.
- Affected users: none today.
- Version range: 2026-08-31 to beta.80.
- Severity: low (dead code with an unguarded sender shape).
- Blast radius: only a future caller.

## Eliminated

- hypothesis: a runtime caller exists through a dynamic require or a path built from pieces.
  evidence: the search used the file stem, the exported function name and the string `api.pinecone.io`. The only non-comment `api.pinecone.io` sender in lib, scripts, bin and hooks is the module itself (the other `PINECONE_API_KEY` reads are scripts/compute-hsi.py, scripts/export-pinecone-embeddings.cjs, scripts/consolidate-pinecone.py and tests; none requires this module). (PROVEN by grep)
  timestamp: 2026-11-06T08:00:00Z
- hypothesis: rs-backend-dispatch.cjs (added in the same commit) calls it.
  evidence: grep of lib/core/rs-backend-dispatch.cjs for `pinecone` returns 0 lines. Phase 272 DEFERRED-SCOPE.md says the external Pinecone corpus path is "not dispatch-wired" and was descoped by D-10. (PROVEN)
  timestamp: 2026-11-06T08:01:00Z

## Evidence

- timestamp: 2026-11-06T08:00:00Z
  checked: `grep -rIl "pinecone-inference\|embedViaPineconeInference"` over the repo, excluding node_modules, .git, .planning and .claude
  found: hits by class (PROVEN):
    - Definition: lib/core/pinecone-inference.cjs (exports one function, `embedViaPineconeInference`).
    - Runtime callers (lib, scripts, bin, hooks, commands, skills, agents, pipelines, data, package.json, .mcp.json, .claude-plugin): 0.
    - Tests: tests/272-pinecone-inference.test.cjs (offline, stub fetch), tests/run-all-272.sh (Part 8 exemption note and a file list), tests/296-pinecone-residue.sh and tests/run-all-296.sh (presence gate).
    - Documentation: CHANGELOG.md, lib/core/rs_cache.py (docstring comment), r-and-d/breakthrough-engines/engines/rs/shared/lib/core/rs_cache.py (copy of that comment).
  implication: verdict DEAD. Nothing at run time requires the module.
- timestamp: 2026-11-06T08:02:00Z
  checked: lib/core/pinecone-inference.cjs, read in full
  found: exports `embedViaPineconeInference(texts, opts)`. It returns early with `pinecone_api_key_missing` when `PINECONE_API_KEY` is unset (before any audit or fetch). With a key it runs `auditQueryString(text, 'pinecone-inference')` on each text, then POSTs `{model: 'multilingual-e5-large', parameters: {input_type, truncate: 'END'}, inputs: [{text}, ...]}` to `https://api.pinecone.io/embed` with an `Api-Key` header, then runs `auditQueryObject` on the response. It sends the text of each input in full. It has no size limit and no grant card. (PROVEN by read)
  implication: if it were live, it would send whole input texts to a third party. The guard is the Brain content scan only.
- timestamp: 2026-11-06T08:03:00Z
  checked: offline probe with a stub `fetchFn`, a fake key, synthetic strings (scratchpad script, not in the repo)
  found: a 7-word keyword query was sent (sent=true). A 2-sentence synthetic body with "Our", a company name and "runway" threw ExternalEgressViolation and was not sent. A 30-sentence synthetic paragraph with none of those words was sent. A fake credential-shaped string (sk-ant-api03 prefix, fake tail) was sent. With no key, nothing was sent. (PROVEN)
  implication: if live, the guard would block ordinary words and pass a long body and a credential shape. That is the reverse of the owner principle for Part 8 (shape and credentials decide, not a word list). The probe result depends on the current guard words and will move with plans 386-28 to 386-33.
- timestamp: 2026-11-06T08:04:00Z
  checked: CLAUDE.md line 115
  found: "e5 (multilingual-e5-large) ... embedded LOCALLY ... no network egress. Pinecone is RETIRED". (PROVEN)
  implication: CLAUDE.md and the file disagree on the word "retired". The file is the Phase 272 hosted-inference port that Phase 296 kept.
- timestamp: 2026-11-06T08:04:10Z
  checked: Phase 296 D-06 (.planning/phases/296-.../296-CONTEXT.md line 81) and CHANGELOG.md lines 1133 and 1136
  found: D-06 says `PINECONE_API_KEY` and the `pinecone` package stay, "still load-bearing for compute-hsi.py Tier 2 and lib/core/pinecone-inference.cjs (Phase 272, deliberately kept, out of scope here)". The CHANGELOG repeats it and names tests/296-pinecone-residue.sh as the two-sided gate. (PROVEN)
  implication: a prior owner decision keeps the file. The phrase "load-bearing" for this file is not true at run time (0 callers); it was a statement of intent.
- timestamp: 2026-11-06T08:04:20Z
  checked: tests/296-pinecone-residue.sh (read and run) and tests/272-pinecone-inference.test.cjs (run)
  found: P3 asserts the file exists and its non-comment source still contains `api.pinecone.io`. P5 asserts `require('./lib/core/pinecone-inference.cjs')` exits 0. Both scripts passed (`PASS`, `PASS test-272-pinecone-inference`). (PROVEN)
  implication: removing or editing the sender breaks 2 live gates, so any removal must update tests/296-pinecone-residue.sh, tests/272-pinecone-inference.test.cjs and tests/run-all-272.sh and override D-06.
- timestamp: 2026-11-06T08:04:30Z
  checked: Phase 385 plan 12 (385-12-PLAN.md, item R6) and AUDIT-2-DELTA.md item A2-5
  found: 385-12 R6 says the auditor verdict "dead" conflicts with D-06 and recommends "keep all of it in Phase 385"; a cleanup of the Pinecone name "needs its own decision that overrides D-06". It does not name this file's caller count. AUDIT-2-DELTA A2-5 says "NOT VERIFIED; remove if dead, or guard if live." (PROVEN by read)
  implication: this RCA supplies the missing caller proof for R6.
- timestamp: 2026-11-06T08:04:40Z
  checked: Phase 272 DEFERRED-SCOPE.md section 4
  found: the external Pinecone corpus path (the reason a hosted `/embed` call would be needed) was descoped by D-10 and "requires a PINECONE_API_KEY most end users do not have". The Python function this module ports (`_embed_topic_via_pinecone`) no longer exists in scripts or lib. (PROVEN by grep)
  implication: both the caller and the feature that would use it are gone.

## Technical Root Cause

- Site: lib/core/pinecone-inference.cjs, function `embedViaPineconeInference`.
- Cause: a port made for a feature (external Pinecone corpus, Mode B/C) that was descoped the same day by D-10. Phase 296 kept the file as a deliberate residue. No wire to it was ever added. It is dead code with a sender whose guard is the content scan only.
- Why it surfaces now: the second audit (A2-5) asked whether the file is live. The answer is no.

## Required Code Changes

None in this plan. No file is edited or deleted.

If the owner picks option B (removal candidate): plan 385-12 R6 would need to override D-06, delete lib/core/pinecone-inference.cjs, tests/272-pinecone-inference.test.cjs and their lines in tests/run-all-272.sh, and change assertions P3 and P5 of tests/296-pinecone-residue.sh. If the owner picks option C: a new plan must add a grant card, a credential-only check and an audit record; this is not recommended for a file with 0 callers.

## Tests to Add or Update

None in this plan.

## Non-Code Follow-ups

- Out-of-scope finding for the owner: scripts/consolidate-pinecone.py line 27 (tracked since 2026-03-25) holds a default value for `PINECONE_API_KEY` that has the shape of a real Pinecone key (prefix `pcsk_`). The bytes are not copied here. This is a stored credential in git history. It needs a rotation check and a removal of the default. No product file was edited in this plan. UNVERIFIED: whether the key is still valid (no network call was made).
- Part 8: the module sends input text to api.pinecone.io only if a caller passes text and `PINECONE_API_KEY` is set. No caller exists.
- Tri-Polar and cross-platform: not applicable to a module with no caller.
- CHANGELOG.md: none from this RCA.

## Resolution

root_cause: dead port of a descoped feature, kept by Phase 296 D-06.
fix: none applied. Awaiting the owner decision.
verification: caller search, offline test runs and stub probe recorded in Evidence (PROVEN).
files_changed: none
commits: see git log of this file
