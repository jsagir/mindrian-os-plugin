# Phase 117 Hooked Variable Reward Rescore

> Generated: 2026-05-06T23:26:10.543Z
> Source: /home/jsagi/.mindrian/telemetry/v1.13/*.jsonl

## Methodology

Per Hooked (Eyal 2014) Variable Reward axis: surface novel findings with
unpredictable user-engagement payoff. Phase 117 baseline 4/10; target 7/10
measurable from auto_explore_* JSONL telemetry. Formula:

    VR = surfaced * distribution_weight * time_factor
    distribution_weight = (P(EXPLORE) * 1.0 + P(LATER) * 0.5 + P(SKIP) * 0.0)
    time_factor = 1.0 if median_latency < 30s else 0.7

## Aggregates

| Metric | Value |
|--------|-------|
| Auto-fires | 0 |
| Findings surfaced | 0 |
| User responses (total) | 0 |
| EXPLORE | 0 |
| SKIP | 0 |
| LATER | 0 |
| FREE_TEXT | 0 |
| Median response latency (ms) | 30000 |
| Distribution weight | 0.000 |
| Time factor | 0.70 |

## Variable Reward Score

**0.0 / 10**

TARGET NOT MET (< 7/10). Continue beta tuning.

## Per-Event Counts

- auto_explore_fired: 0
- auto_explore_finding_surfaced: 0
- auto_explore_user_response: 0

## Recommendations

- Zero surfaces detected. Verify auto-explore-fingerprint hook fires on first-material upload.
- Median response latency >= 30s; investigate F.1 surface friction (RECOMMENDED gate, copy length, persona suffix).
