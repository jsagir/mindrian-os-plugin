---
phase: quick
plan: 261004-v16
subsystem: research-planner
tags: [SEED-115, egress, web-search-lines, canon-part-8]
status: PARTIAL - STOPPED at Task 3 aggregators (one pin outside the named files is red)
key-files:
  modified:
    - lib/core/research-planner/families.cjs
    - lib/core/research-planner/planner.cjs
    - lib/core/research-planner/grants.cjs
    - lib/core/research-planner/quick.cjs
    - lib/core/research-planner/plan.cjs
    - tests/test-seed104-grant-family-loop.cjs
  created:
    - tests/test-v16-web-slot-prose.cjs
commits:
  - 6d789ed8a  test RED
  - affafb368  feat GREEN
  - 7b83bfb26  test seed104 pins moved
---

# Quick 261004-v16: web search lines accept room phrases and questions

One-liner: `composableQuery()` (cap 200, markdown stripped, sentences and question marks allowed) is the slot rule for web destinations; the strict `composableTerm` rule stays for `theo` corpus leaves and `destination: 'theo'`.

## Measured

- RED (6d789ed8a): test-v16 W1, W2, W4, W5 FAIL (4 red); W3 (theo refuses prose) and W6 (dash guard) green from the start because they pin invariants.
- GREEN (affafb368): `node tests/test-v16-web-slot-prose.cjs` PASS: 7 FAIL: 0.
- `node tests/test-seed104-grant-family-loop.cjs` after GREEN: S1, S2, S8, E5 red (the legs that asserted the old refusal); after the move (7b83bfb26) PASS: 19 FAIL: 0. S0 golden (whitespace card, grant, queries) stayed byte-identical.
- `bash tests/run-all-363.sh`: PASSED=44 FAILED=5 SKIPPED=1 KNOWN=4. `bash tests/run-all-366.sh`: PASSED=69 FAILED=1 SKIPPED=0 KNOWN=1.

## Moved assertions (test-seed104-grant-family-loop.cjs, dated comments name SEED-115 and 2026-10-04)

- S1: before, any destination refused prose with `term_not_composed`. After: web `composeForLeaf` composes the phrase (markdown stripped); `corpus: 'theo'` / `destination: 'theo'` still refuses with no echo; 201 chars is `bad_slot` on web, 81 chars is `bad_slot` on theo.
- S2: before, `writeGrant` / `extendTerms` refused prose. After: they accept a web phrase; over-cap (201) and control-character terms and synonyms are still refused before any write.
- S8 (stale prose plan): before `refused` / `term_not_composed`. After: `reask` (grant needed), no fetch, the card payload and body carry the exact string; `proposeGrant` accepts a phrase and refuses only over-cap.
- E5 (named in the plan only as the S7-S9 family of legs, same behaviour): `run_quick` now returns `reask`, reason not `term_not_composed`, zero fetches.

## STOP (first FAIL line)

`FAIL: F6 slot rule violations return bad_slot without echo (refused: "has \"quote\" insid: true vs false)` in `tests/test-363-families.cjs` (shown by run-all-363 and, through its 363 families leg, run-all-366). F6 pins the old rule (a quote, newline, parenthesis, `cats OR dogs`, `cats and dogs`, `not this` and 81 characters are `bad_slot`). Under the web rule these now compose. The file is outside the plan's file list, so it was not touched. Proposed move: run the same list with `{ destination: 'theo' }` (unchanged behaviour), and on web assert only `'x'`, 201 characters and a control character are `bad_slot`.

Other reds in the aggregators are not from this change: 216 / 220 / 221 / 3551 / 361 legs (dependency-set drift, doctor acceptance, `rs-chain-feeder.cjs` direction-convention, `test-fileval-readback` "database is not open", part8 self-test, 209 wired) sit outside research-planner; test-fileval-readback and test-355-direction-agreement have zero references to families.

## Deviations

- Test phrase in W2 uses "rural clinics", not "Tel Aviv": the Part 8 audit fence (`FORBIDDEN_PATTERNS` in cross-room-aggregator.cjs, called by `auditQueryString`) refuses `Haifa|Beersheba|Be'er Sheva|Ramat Gan|Tel Aviv|Jerusalem|Herzliya|Netanya` in any query string. The fence was not touched (constraint). Composition of such a phrase returns `egress_violation`.
- composableQuery turns double quotes and backslashes into spaces so the quoted template stays well formed.
- The grant card gains a "The exact search strings that will be sent, as written" block and `payload.queries`, only when a plan slot is a room phrase (keeps the whitespace golden identical). The plan view (`plan.cjs`) already printed "sent exactly as written".

## Open items for Phase 369.2

- The geo / PII fence blocks Israeli city names on every query; a room question naming one cannot leave. Needs the navigator's ruling on that fence (not touched here).
- Query composition from room questions (slots still come from the planner's terms); retire the per-term grant loop on web lines; fixture-room measurement (SEED-115 bar 5).
- A composed query over 200 chars (long phrase inside a template with OR synonyms) is `bad_slot`; shaping a long sentence into a short query is not built.
- Empty grant term entries are still skipped silently by `termsComposable` (unchanged).
