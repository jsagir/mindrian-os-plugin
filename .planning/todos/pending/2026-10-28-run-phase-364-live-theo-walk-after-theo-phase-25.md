---
created: 2026-10-28T19:18:34.000Z
title: Run Phase 364 live Theo walk after Theo Phase 25 closes
area: testing
files:
  - tests/run-all-364.sh
  - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md
  - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-VERIFICATION.md
---

## Problem

Phase 364 (/mos:scientific-roadmap) is verified on the plugin side (21 of 23 requirements PASS, aggregator green apart from known reds). It is not fully closed. The live Theo walk was never run. The 25 Theo step fixtures came from the Theo session's reported facts, not a live capture (follow-on A6). The command refuses honestly while Theo's steps are unauthored, so a real walk needs Theo Phase 25 to close first.

## Solution

When Theo Phase 25 closes: get navigator approval for live egress, run the opt-in live smoke with MOS_364_LIVE=1 (bash tests/run-all-364.sh), run one authored walk of the command, record a live fixture, then close follow-on A6 and the HUMAN_NEEDED row in 364-VERIFICATION.md. Blocks full close of Phase 364. Never run it without the navigator's approval.
