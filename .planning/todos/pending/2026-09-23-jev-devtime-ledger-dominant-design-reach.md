---
created: 2026-09-23
title: Dev-time Jev ledger for the Dominant Design reach (SENS-09 branch)
area: sensors
source: navigator ruling 2026-09-23 (jsagi-ec session) -- "Dev-time ledger", not runtime Jev
---

## Problem

Quick 260923-u8v shipped SENS-09's dominant-design branch with cue patterns sourced from Theo ch04 (era of ferment / locked design / convergence tells). The cues were checked against 22 hand-picked sentences only. The hit and miss rate is not measured on a real phrasing corpus.

## What to do

Follow the Phase 356/357 pattern: build a labelled phrasing corpus (positives, near-misses, unrelated), have Jev make a Choice under a stated closed-enum policy (`dominant_design_moment | adjacent_market_question | unrelated`) AT DEV TIME, and ship the result as data: the measured hit and miss rate, plus any cue additions or removals, pinned by a test. No runtime Jev, no user-side key (2026-09-17 ruling). The sensor stays deterministic, with one governed reach path.

## Links
- Quick task: `.planning/quick/260923-u8v-teach-larry-when-to-reach-for-dominant-d/`
- Sensor: `lib/core/sensors/sensor-diffusion-adoption.cjs` (`DOMINANT_DESIGN_CUES`)
- Theo side: Theo Phase 20.3 (the two ch04 FEEDS_INTO edges)
