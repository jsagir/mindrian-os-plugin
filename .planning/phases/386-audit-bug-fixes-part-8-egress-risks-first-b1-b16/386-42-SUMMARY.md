---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "42"
subsystem: part8-egress
tags: [part8, sprouts, split-route, typed-claims]
requires: [386-01, 386-37]
provides:
  - lib/core/part8-split-route.cjs (sprouts_required outcome, split guide, validateSprouts, fileClaimsLocal, assembleLocal, runSplitRoute)
affects: [386-26, 386-27, 386-33, 386-43]
key-files:
  created:
    - lib/core/part8-split-route.cjs
    - tests/test-386-sprout-split-route.cjs
    - .planning/debug/part8-no-split-route-for-bodies-and-private-claims.md
decisions:
  - "sprout_route is sprout_call: sprouts travel as ordinary brain_ask and brain_search calls, not as a packet job (no packet job carries a free sprout without a room-derived string)"
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 42: Context-based split route Summary

The split route is built and proven on fixtures: a body or a private claim becomes typed local claims (proposed, via writeClaimNode) plus generic sprouts; only the sprouts reach the Brain client; the answer is assembled locally.

## What was built

- RCA `.planning/debug/part8-no-split-route-for-bodies-and-private-claims.md`: today outcome of 5 synthetic strings, census of the claim writer and the 12 packet jobs, and the route decision.
- `lib/core/part8-split-route.cjs`: SPROUTS_REQUIRED, ROUTE (sprout_call), CLAIM_TYPES (lazy getter over KNOWLEDGE_TYPES), SPLIT_GUIDE (5 lines), refusalMessage, sproutsRequiredResult (error egress_blocked kept), validateSprouts, sharesClaimRun (4 word run check, class not_sprout), fileClaimsLocal (all or nothing), assembleLocal, runSplitRoute.
- `tests/test-386-sprout-split-route.cjs`: arms SR1 to SR8 and SR5b. RED commit 8716bfa2f, GREEN commit e7dc09253.

## Key facts (PROVEN)

- Today a 47 word paragraph with a person name is blocked (room_content) with a one line refusal and no guide. A 3 sentence body with no name is allowed and sent unchecked. A short private claim is blocked (room_content, private_context). No refusal carries a guide.
- All 12 packet jobs require active_context and local_graph_summary (room-derived), so packet_job_carries_sprouts: no; sendPacket is parked. design_can_work: yes.
- Wire capture in SR5: no claim text and no run of 4 words of the paragraph. SR5b and SR6: 0 claims filed and 0 fetch calls on a rejection.

## Deviations from Plan

None in behavior. Two small notes: (1) the test builds its dash check from char codes because the file writer normalized escape sequences; (2) runSplitRoute applies the claim-run check before the guard class, so a leak is always class not_sprout.

## Verification

- node tests/test-386-sprout-split-route.cjs: ok SR1..SR8, SR5b.
- TEST_386_PREFIX=tests/test-386-sprout-split- bash tests/run-all-386.sh: PASSED.
- node tests/test-3692-guard-survey-gate.cjs: GATE: PASS, MEASURED_SHA256 identical before and after (685f11b8...).
- bash tests/run-all-196.sh: 7 passed, 0 failed (before and after).

## Self-Check: PASSED

Files exist: lib/core/part8-split-route.cjs, tests/test-386-sprout-split-route.cjs, the RCA. Commits d1c5b4d0a, 8716bfa2f, e7dc09253 and the RCA resolution commit exist.
