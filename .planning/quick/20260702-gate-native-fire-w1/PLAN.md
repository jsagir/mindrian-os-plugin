---
kind: quick
slug: 20260702-gate-native-fire-w1
title: Gate Native Fire - Wave 1 (self-decoding trigger + doctrine)
date: 2026-07-02
authoritative_plan: .planning/research/2026-07-02-gate-native-fire-fix.md
wave: 1
scope: E1 + P1 + P3 (NOT E2, P2, P4 -- and NOT the Phase 209 rollout)
---

# Gate Native Fire - Wave 1

## Objective

Make Decision-Gate cards fire NATIVELY instead of being corrected by the Stop-hook backstop.
Execute EXACTLY Wave 1 items E1 + P1 + P3 of the adversarially-verified research plan
`.planning/research/2026-07-02-gate-native-fire-fix.md`, using its file:line citations as the work order.

## Tasks

### E1 - self-decoding trigger (engine plane)

Make `appendAskUserQuestionTrailer` (lib/hmi/selector-dispatcher.cjs ~:523-556) SELF-DECODING:
emit a BINDING imperative line that TELLS the model to fire AskUserQuestion NOW with the given
shape/options, instead of shipping a bare structural marker. Reuse the
scripts/room-naming-selector.cjs:156-160 "INSTRUCTION FOR LARRY" pattern (Canon Part 7).

Fence: the `askuserquestion_marker` SCALAR stays byte-frozen (it is what the engine-arm
concatenation reads positionally; tests trailer_format / post-filing-selector / 150.5 shape
fence / 148 frozen-contracts depend on it). The self-decoding line rides the FOOTER, which is
what the pickShape / renderRoomChooserCard path (the incident's actual fork) renders. Frozen
scalars byte-unchanged (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15).

### P1 - fire mandate in the agent body (prompt plane)

Add the Decision-Gates fire mandate to `agents/larry-extended.md` BODY (mirror the working
doctrine at commands/ignite.md:98-106): when a turn reaches a genuine Decision Gate, fire the
AskUserQuestion card with the gate options; never render an ASCII box or "type 1/2/3" prose.
Qualify line 110 ("End with a question or next step") so that AT a gate the question IS the card.
Preserve frontmatter; the connector.excluded + hitl_shape declarations stay intact.

### P3 - fire mandate in the auto-loaded skill (prompt plane)

Add the same mandate to the auto-loaded ui-system skill's Shape-F section
(`skills/ui-system/SKILL.md`), and QUALIFY the personality rule "End with a question or next
step" so that AT a gate the question IS the card, not prose. Preserve frontmatter.

## Verification

- node -c on the touched .cjs.
- Trailer suites green: test-selector-dispatcher-88-2-04, test-148-frozen-contracts,
  test-150-5-render-atomicity, test-post-filing-selector, test-acpt-06-dial-atomic-emission,
  test-f7-dial-gap-zero-confirm; run-all-148.sh; check-render-coverage.
- Shape gate: node scripts/check-shape-declaration.cjs --check (exit 0) before committing the md.
- NEW tests/test-gate-native-fire-w1.cjs: trailer self-decoding (binding + payload, old
  bare-marker form gone) + grep-tests that both docs carry the fire mandate.
- No em-dashes. Never --no-verify.

## Out of scope (Phase 209)

The ~86-body rollout (B1/B2/B3), the engine emission seam (E2), E3/E4, and the session-start
exemplar fix (H4). Do NOT touch ROADMAP.md.
