---
kind: quick
slug: 20260702-gate-native-fire-w1
title: Gate Native Fire - Wave 1 (self-decoding trigger + doctrine)
date: 2026-07-02
wave: 1
scope: E1 + P1 + P3
commits:
  - 0c2dab0e  # E1 dispatcher self-decoding trailer
  - e1edcdc9  # P1 larry-extended fire mandate
  - 37820c61  # P3 ui-system fire mandate
  - f20db95c  # test W1 acceptance
authoritative_plan: .planning/research/2026-07-02-gate-native-fire-fix.md
---

# Gate Native Fire - Wave 1 Summary

One-liner: made the AskUserQuestion trailer SELF-DECODING (a binding imperative line that tells
Larry to fire the card, not draw a box) and planted the same Decision-Gate fire mandate in the two
prompt surfaces Larry auto-loads (larry-extended body + ui-system Shape-F), so gates fire natively
instead of being corrected by the Stop-hook backstop.

## What changed and why

The incident: at a room-chooser Decision Gate Larry produced prose + an ASCII frame instead of
firing AskUserQuestion; the Stop-hook backstop paid the cost as a blocked turn + forced re-emit.
The research plan traced this to a chain; Wave 1 kills the two highest-leverage links:

- RC-1 (fire mandate absent from everything Larry loads) -> P1 + P3.
- RC-2 (the trigger that IS in context is non-imperative telemetry) -> E1.

### E1 - self-decoding trigger (yes)

lib/hmi/selector-dispatcher.cjs appendAskUserQuestionTrailer now mints, alongside the existing
marker, a BINDING imperative line and appends BOTH to rendered.zones.footer. Reuses the shipped
scripts/room-naming-selector.cjs:158-160 "INSTRUCTION FOR LARRY ... dispatch ... via
AskUserQuestion" pattern (Canon Part 7 reuse; no new renderer, no new dispatch branch).

Trailer, before/after (one-liner):
- Before: footer trailer was the bare structural marker only -- [AskUserQuestion contract:
  shape=F.1 verbs=4] (a "scalar string for introspection", zero imperative).
- After: footer carries the marker PLUS [BINDING: call the AskUserQuestion tool in THIS response
  with the 4 options above; do not reproduce this block as text (SEED-021)] -- the trigger now
  decodes itself.

Scope discipline / frozen-contract fence: the askuserquestion_marker SCALAR is left byte-identical
because the engine arm (scripts/intent-classifier.cjs:1010) reads it positionally in rendered.text
+ marker, and tests trailer_format / post-filing-selector / 150.5 shape fence / 148
frozen-contracts assert its exact shape. The self-decoding upgrade therefore rides the FOOTER (the
pickShape / renderRoomChooserCard path -- the incident's actual conversational fork). Serializing
the imperative onto the engine-arm scalar concat is E2, which is Phase 209 Wave 2 and deliberately
untouched here. Frozen scalars byte-unchanged: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15.

### P1 - agent-body fire mandate (yes)

agents/larry-extended.md gains a "Decision Gates -- fire the card, never draw the box (SEED-021)"
section (mirrors commands/ignite.md:98-106 verbatim in intent) and the "End with a question or next
step" line (Always Do) is qualified: at a gate the question IS the AskUserQuestion card, never prose
or an ASCII box. Frontmatter (connector.excluded + hitl_shape "F.1") preserved intact; shape gate
green.

### P3 - auto-loaded skill fire mandate (yes)

skills/ui-system/SKILL.md Shape-F section gains the same "Fire the card, never draw the box
(SEED-021)" mandate, documents the self-decoding trailer + its SEED-020 single-door source
(appendAskUserQuestionTrailer), and qualifies the "End with a question" personality rule so that at a
gate the question IS the card. ui-system is auto-loaded on every session, so this is the one global
always-in-context home. Frontmatter (connector.excluded) preserved intact.

## Verification (all green)

- node -c lib/hmi/selector-dispatcher.cjs + node -c tests/test-gate-native-fire-w1.cjs: clean.
- NEW tests/test-gate-native-fire-w1.cjs: 12/12 (trailer self-decoding: binding + payload, old
  bare-marker-only footer form gone, marker scalar still byte-frozen; P1/P3 grep-tests + frontmatter
  intact).
- Trailer / dial / frozen-contract suites: test-selector-dispatcher-88-2-04 19/19,
  test-148-frozen-contracts 7, test-150-5-render-atomicity 10, test-post-filing-selector 4/4,
  test-acpt-06-dial-atomic-emission 5, test-f7-dial-gap-zero-confirm 11, test-selector-dispatcher
  9/9, test-selector-dispatcher-88-2-05/06 0 fail, test-dial-render-states 0 fail,
  test-dial-end-to-end-states 11, test-150-render-unlock all, test-150-5-sensor-firability 22,
  test-retrieval-seed pass, dial-command-recommendation-191 24, claim-c2 pass.
- bash tests/run-all-148.sh: 18/18 (the frozen-contracts fence).
- node scripts/check-render-coverage.cjs: 16 covered, 0 gap.
- node scripts/check-shape-declaration.cjs --check: OK (128 declared, 5 skill-exempt) -- exit 0.
- em-dash / en-dash scan on all edited files: clean. No --no-verify; pre-commit hooks passed.

## Deviations / blockers

- Pre-existing failure (NOT caused by this work, logged in deferred-items.md):
  tests/test-selector-dispatcher-120-01.cjs T1 ("F_SUBSHAPES contains F.7 as the 8th entry") fails
  identically on committed HEAD (verified via git stash). F_SUBSHAPES is untouched by E1; out of
  scope. Belongs to a separate F.7 catalog issue.
- Scope note (not a deviation): E1's binding rides the footer only; the engine-arm scalar concat is
  E2 (Phase 209 Wave 2) and was deliberately not touched, per the "Wave 1 ONLY, no engine emission
  seam" instruction.

## Out of scope (Phase 209, untouched)

The ~86-body rollout (B1/B2/B3), E2/E3/E4, the PRIMARY side-channel (H3), the session-start
exemplar (H4), backstop tuning (H1/H2). ROADMAP.md untouched (Phase 209 already registers waves 2-4).

## Self-Check: PASSED

- lib/hmi/selector-dispatcher.cjs, agents/larry-extended.md, skills/ui-system/SKILL.md,
  tests/test-gate-native-fire-w1.cjs: all present with the changes.
- Commits 0c2dab0e, e1edcdc9, 37820c61, f20db95c: all present in git log.
