---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "38"
subsystem: egress
tags: [rca, pinecone, part-8, dead-code, owner-decision]
requires:
  - phase: 386-01
    provides: RCA conventions for this phase
provides:
  - RCA with the caller proof (verdict DEAD) for lib/core/pinecone-inference.cjs
  - Owner decision block with the anchored line decision: option-b
affects: [385-12]
tech-stack:
  added: []
  patterns: [stub-fetch probe of a sender guard with fake key and synthetic strings]
key-files:
  created:
    - .planning/debug/pinecone-inference-dead-or-live.md
  modified: []
key-decisions:
  - "Owner decision 2026-11-06, recorded as option B: hand lib/core/pinecone-inference.cjs to Phase 385 as a removal candidate. Owner words: we are not useing pinecone in the mos build. This overrides Phase 296 D-06 for this file."
requirements-completed: [E-PINE]
duration: 40min
completed: 2026-11-06
---

# Phase 386 Plan 38: Pinecone inference module Summary

The RCA proves lib/core/pinecone-inference.cjs is DEAD (0 runtime callers), and the owner's statement that the build does not use Pinecone is recorded as `decision: option-b`, a removal candidate for Phase 385 plan 12.

## Accomplishments

- Caller search over the repo found the definition, 3 test files (tests/272-pinecone-inference.test.cjs, tests/run-all-272.sh, tests/296-pinecone-residue.sh plus tests/run-all-296.sh) and docs only. Runtime callers: 0. `verdict: DEAD`.
- Read the module: it sends whole input texts to api.pinecone.io when `PINECONE_API_KEY` is set, with `auditQueryString` as its only guard.
- Stub-fetch probe with a fake key and synthetic strings: a 7-word keyword query went out, a 2-sentence body with "Our", a company name and "runway" was blocked, a 30-sentence paragraph and a credential-shaped string went out. No network call was made.
- Recorded what D-06, tests/296-pinecone-residue.sh (P3 and P5), CLAUDE.md and 385-12 R6 say. Both Pinecone tests pass today.
- Recorded the owner decision with the owner's words verbatim, the files a removal must edit, and a note that the broader Pinecone surfaces (rs-pinecone-bridge, 6 production requirers) stay with 385-12 R6.
- Flagged outside this plan: scripts/consolidate-pinecone.py line 27 holds a key-shaped default. The bytes are not copied anywhere.

## Task Commits

1. Task 1 (RCA): 989a3eeed
2. Task 2 (owner decision block): see the commit that follows this summary in git log of the RCA file

## Files Created/Modified

- .planning/debug/pinecone-inference-dead-or-live.md (created)

## Decisions Made

- option-b, with the reading stated in the block: the owner's words do not name A, B or C, and the recording agent mapped them to B.

## Deviations from Plan

The owner's answer was free text and not one of A, B or C. The coordinating session asked for it to be recorded as option-b with the words quoted. No product file was edited or deleted.

## Issues Encountered

None.

## Known Stubs

None.

## Next Phase Readiness

Plan 385-12 R6 picks up the removal candidate and the 3 test files. The stored key-shaped default in scripts/consolidate-pinecone.py needs a rotation check (UNVERIFIED validity).
