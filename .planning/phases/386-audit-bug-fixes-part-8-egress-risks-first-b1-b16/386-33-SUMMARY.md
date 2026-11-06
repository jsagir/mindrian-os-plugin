---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "33"
subsystem: part8-egress
tags: [part8, over-block, sprouts, shape, sprouts-required, room-lexicon, gate-baseline]
requires: [386-32, 386-31, 386-37, 386-42, 386-27]
provides:
  - the guard decides a free-form string by shape (sprout, edge, body) and answers sprouts_required
  - ALWAYS_PATTERNS and PROSE_PATTERNS exports; FORBIDDEN_PATTERNS stays the union
  - loadRoomLexicon caches only a successful read
  - survey gate field accepted_sprout_negatives and the --stamp --accept flag
affects: [386-34, 386-40]
key-files:
  created:
    - tests/test-386-over-blocking-narrowed.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - lib/core/cross-room-aggregator.cjs
    - lib/core/rs-egress-prompts.cjs
    - lib/core/part8-room-lexicon.cjs
    - lib/core/brain-client.cjs
    - tests/test-3692-guard-survey-gate.cjs
    - tests/fixtures/3692/guard-survey-baseline.json
decisions:
  - "A private-claim marker on a sprout is: a private word, any my or our plus a word, a first or we clause after punctuation, a first-person statement. Measured: 0 hits on the allow corpora."
  - "The cypher key of brain_query is not shaped (plan 386-26 rule); it keeps the full default-deny list and the old rules."
  - "Unreadable room.db: a clear sprout is allow (room_check_skipped); an edge or body is sprouts_required with token_class room_check_unavailable."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 33: Context-based guard outcomes Summary

The Part 8 guard now separates a sprout from a body by shape. A clear sprout (a short keyword query) passes without the name rule and the deny-word rules; credentials, emails, phone-like and SSN-like numbers, artifact-style identifiers and room-lexicon terms still block with their own class; a body, an edge that fails a prose rule and a private-claim sprout get the class sprouts_required (token_class body_shape, edge_rule or private_marker, a constant reason with no input word). A failed room.db read is no longer cached.

## Results (PROVEN)

- tests/test-386-over-blocking-narrowed.cjs: RED at 28c44303c, GREEN at 93b785273, all arms pass (OB1 to OB3, OBP1 to OBP3, OBS1 to OBS7, OBE1, OBE2, OBM1, OBM2, OBL1, OBN1, OBN2, OBA1, OBC1, OBX, OBU1 to OBU6, OBK1, OBK2). OBU6 prints the acknowledged exposure.
- The measured plain-sprout leavers equal the owner acknowledgement: negatives X8 only; probe sprouts C:plurai:24, C:plurai:26, C:plurai:29, C:plurai:31 only. The 12 marked probe strings are sprouts_required.
- Corpus gate: PASS before and after. ext.blocked_no_room 37 to 8 (the 8 plugin-noun edges are now sprouts_required), ext.induced_total 0, pos26.blocked_no_room 0, retention and must_refuse unchanged. Baseline re-stamped with `--stamp --accept X8` (zero FAIL rows); accepted_sprout_negatives equals the RCA set.
- run-all-196 7/7, run-all-245 19/19, run-all-386 31/31. run-all-252: only the known census.1 and census.5b.
- Consumers of the Canon list: lib/memory/cross-room-aggregator.test.cjs, test-148, test-361, test-rs-*, test-355-* pass except five that fail at the pre-change commit too (test-rs-fetcher-academic, test-rs-chain-feeder-core, test-rs-nl-to-query, test-rs-sqlite-mirror, test-355-direction-agreement).
- run-all-3692 before the last test flips: 8 FAILED legs, of which closure, w1-closure, 354 typed question, 366 navigator release (G9 213) and 257 invariant were mine and are fixed (each re-run green alone); the rest are not mine (rs-fetcher academic, mux card before answer, no-new-dependency flexsearch).

## Tests flipped in place (class or sprout case, each with a plan 386-33 comment)

lib/core/part8-egress-guard.test.cjs (PB8-09: the 4 acknowledged rows allow), test-386-key-shapes-and-money (K7c: a currency magnitude sprout is allow, an edge is sprouts_required), test-386-typed-theo-allow-arms (TB4, TB5), test-3692-lexicon-generic-entries (L6, the stale X4 class), test-part8-name-class-methodology-names (C2, C3, N1 to N3 probe the name rule on an edge), test-3692-theo-verdict (V1b, V1d, V1g, V2e), test-245-brain-envelope-shape (funding round anchors), test-213-part8-boundary (offer text), test-257 (Arm 4 fixture is an edge), test-354-egress-typed-question, test-3692-closure (D11), test-3692-w1-closure (C5).

## Deviations from Plan

**1. [Rule 1/2 - verdict flips beyond class] Sprout cases flipped from block to allow**
- The plan says flip only the class and never the verdict. Several old tests asserted block for a short sprout that names a company, a person, a currency magnitude or a funding word (K7c, name-class C2/N1 to N3, 257 Arm 4, closure D11 room_term, 245 Series A, PB8-09 four rows, V1g). Those are the owner decisions of 2026-11-06 (sprouts go out; the owner declined the figure rule and the proper-name rule). The protective intent was kept: the same strings as edges stay refused (sprouts_required).

**2. [Rule 2 - marker is broader than the RCA row] Possessive marker**
- The 12 acknowledged-split probe strings need a my or our followed by any word, not only a venture noun. Consequence: an ordinary sprout such as "how do I use my notes with the lean canvas" is now sprouts_required. No corpus string is affected (0 hits). The RCA row R2 was corrected.

**3. [Rule 3 - sentinel vocabulary] Plan 27 sentinel gains token_class and reason**
- test-3692-theo-verdict V2c requires token_class on every refusal. brain-client now copies token_class and the constant reason of the verdict into the sprouts_required sentinel. No input byte.

**4. Gate flag**
- `--stamp --accept <ids>` was added to the survey gate so the accepted ids are written only through the stamp. C0 holds acceptance mutations (accepted id leaks reads OK, non-accepted leaks reads FAIL).

## Residual and flaky

- test-246-census-guard failed once (10 s hook child timeout under load) and passes alone.
- The shape rule does not apply to a Cypher string; a natural-language body that starts with a Cypher verb and holds an upper-case MATCH/RETURN/CALL/UNWIND keyword keeps the old path.

## Known Stubs

None.

## Threat Flags

None. Behavior reduces what leaves, except the acknowledged exposure (X8, four probe sprouts, and a sprout holding a room-lexicon term while room.db is unreadable).

## Self-Check: PASSED

Commits 28c44303c, 93b785273, the flip commit, a6cd170f7 and the RCA correction are on main. Owner acknowledgement lines equal the measured leavers.
