---
phase: quick
plan: 261004-v16
subsystem: research-planner
tags: [SEED-115, egress, web-search-lines, canon-part-8]
status: complete (no red from research-planner files; remaining reds pre-existing, listed below)
key-files:
  modified:
    - lib/core/research-planner/families.cjs
    - lib/core/research-planner/planner.cjs
    - lib/core/research-planner/grants.cjs
    - lib/core/research-planner/quick.cjs
    - lib/core/research-planner/plan.cjs
    - tests/test-seed104-grant-family-loop.cjs
    - tests/test-363-families.cjs
  created:
    - tests/test-v16-web-slot-prose.cjs
commits:
  - 6d789ed8a  test RED
  - affafb368  feat GREEN
  - 7b83bfb26  test seed104 pins moved
  - ad5991618  test F6 pins moved to the theo destination
---

# Quick 261004-v16: web search lines accept room phrases and questions

One-liner: `composableQuery()` (cap 200, markdown stripped, sentences and question marks allowed) is the slot rule for web destinations; the strict `composableTerm` rule stays for `theo` corpus leaves and `destination: 'theo'`.

## Measured

- RED (6d789ed8a): test-v16 W1, W2, W4, W5 FAIL (4 red); W3 (theo refuses prose) and W6 (dash guard) green from the start because they pin invariants.
- GREEN (affafb368): `node tests/test-v16-web-slot-prose.cjs` PASS: 7 FAIL: 0.
- `node tests/test-seed104-grant-family-loop.cjs` after GREEN: S1, S2, S8, E5 red (the legs that asserted the old refusal); after the move (7b83bfb26) PASS: 19 FAIL: 0. S0 golden (whitespace card, grant, queries) stayed byte-identical.
- First aggregator run (before the F6 move): run-all-363 PASSED=44 FAILED=5 SKIPPED=1 KNOWN=4; run-all-366 PASSED=69 FAILED=1 SKIPPED=0 KNOWN=1 (the one red was F6).
- Final run (after ad5991618): `bash tests/run-all-363.sh` PASSED=45 FAILED=4 SKIPPED=1 KNOWN=4; `bash tests/run-all-366.sh` PASSED=70 FAILED=0 SKIPPED=0 KNOWN=1. test-363-families PASS: 11 FAIL: 0.

## Moved assertions (test-seed104-grant-family-loop.cjs, dated comments name SEED-115 and 2026-10-04)

- S1: before, any destination refused prose with `term_not_composed`. After: web `composeForLeaf` composes the phrase (markdown stripped); `corpus: 'theo'` / `destination: 'theo'` still refuses with no echo; 201 chars is `bad_slot` on web, 81 chars is `bad_slot` on theo.
- S2: before, `writeGrant` / `extendTerms` refused prose. After: they accept a web phrase; over-cap (201) and control-character terms and synonyms are still refused before any write.
- S8 (stale prose plan): before `refused` / `term_not_composed`. After: `reask` (grant needed), no fetch, the card payload and body carry the exact string; `proposeGrant` accepts a phrase and refuses only over-cap.
- E5 (named in the plan only as the S7-S9 family of legs, same behaviour): `run_quick` now returns `reask`, reason not `term_not_composed`, zero fetches.

## F6 move (resolved, ad5991618)

`tests/test-363-families.cjs` F6 pinned the old rule. Now the same violation list runs with `{ destination: 'theo' }` (unchanged `bad_slot`, no echo), and on web only `'x'`, a 201-character value and a control character are `bad_slot`. Dated comment names SEED-115 and quick v16.

## Remaining reds in run-all-363 (all pre-existing, none from research-planner files)

- test-131-e2e.cjs: KNOWN (recorded signature matched).
- 216 no-regression: `Phase 216: PASS=8 FAIL=1`; first FAIL line `>>> 216-03 gate: shape declaration (strict): FAILED`.
- 220 no-regression: `Phase 220: PASS=11 FAIL=1`; the aggregator prints no FAIL line, only the count.
- run-all-221: `Phase 221: PASS=12 FAIL=2` (recorded 11/3, so better); no FAIL line printed.
- run-all-3551: `Phase 355.1: PASS=62 FAIL=6` (recorded 63/5); first FAIL `FAIL: H one rule: comparison-to-label code found only in lib/core/direction-convention.cjs ... (unresolved hits: lib/core/rs-chain-feeder.cjs, ...)`; others: dependency-diff, doctor acceptance, shipped ledger set vs registry (`missing: /mos:scientific-roadmap`).
- run-all-361: `PASSED=26 FAILED=3` (recorded 27/2): part8-egress-guard self-test, 209 declared-implies-wired, and `FAIL test-fileval-readback.cjs: database is not open`.
- no new dependency: `FAIL: dependency set changed; added=["dependencies:@modelcontextprotocol/ext-apps@^2.0.3", ...]`.
- test-fileval-readback.cjs run standalone: exit 1, `FAIL test-fileval-readback.cjs: database is not open` reproduces alone (recorded only, not fixed; zero references to research-planner).
- run-all-366: only KNOWN=1 (part8-egress-guard self-test), 0 FAILED.

## Deviations

- Test phrase in W2 uses "rural clinics", not "Tel Aviv": the Part 8 audit fence (`FORBIDDEN_PATTERNS` in cross-room-aggregator.cjs, called by `auditQueryString`) refuses `Haifa|Beersheba|Be'er Sheva|Ramat Gan|Tel Aviv|Jerusalem|Herzliya|Netanya` in any query string. The fence was not touched (constraint). Composition of such a phrase returns `egress_violation`.
- composableQuery turns double quotes and backslashes into spaces so the quoted template stays well formed.
- The F6 pin in test-363-families.cjs was outside the plan's file list; moved on the coordinator's explicit go-ahead.
- The grant card gains a "The exact search strings that will be sent, as written" block and `payload.queries`, only when a plan slot is a room phrase (keeps the whitespace golden identical). The plan view (`plan.cjs`) already printed "sent exactly as written".

## Open items for Phase 369.2

- The geo / PII fence blocks Israeli city names on every query; a room question naming one cannot leave. Needs the navigator's ruling on that fence (not touched here).
- Query composition from room questions (slots still come from the planner's terms); retire the per-term grant loop on web lines; fixture-room measurement (SEED-115 bar 5).
- A composed query over 200 chars (long phrase inside a template with OR synonyms) is `bad_slot`; shaping a long sentence into a short query is not built.
- Empty grant term entries are still skipped silently by `termsComposable` (unchanged).
