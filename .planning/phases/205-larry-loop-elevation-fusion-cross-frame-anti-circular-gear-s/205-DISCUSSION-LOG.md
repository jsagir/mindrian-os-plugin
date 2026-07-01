# Phase 205 - Discussion Log

> Human-reference only (audits/retrospectives). Not consumed by downstream agents.
> Session 2026-07-01, navigator: Jonathan Sagir.

## Context

CONTEXT.md pre-authored during the same session (FUSION cross-frame + anti-circular gear-shift, grounded in the Jonathan Sagir FUSION PRD, Lawrence Aronhime's Test 6 model, and Mordi+Eli tester feedback). Discussion focused on locking the gray areas so the planner does not re-ask.

## Gray areas selected for discussion

Q5 (frame boundary, BLOCKING), Q4 (confidence threshold, BLOCKING), Q6 (surface tag), Q1 (FUSION cadence). Q2/Q3 deferred to plan.

## Decisions

| Gray area | Options presented | Navigator chose | Note |
|---|---|---|---|
| Q5 frame boundary | derive from section nodes+topic-shift (recommended) / mint a Frame node / hybrid | **Mint a Frame node type** | Override of the derive-lean. Additive schema change to local node types; drift-test update required. Supersedes graph-readiness gap-1. |
| Q4 confidence threshold | 0.70 act + override <0.40 (recommended) / 0.80 conservative / start 0.70 defer to tuning | **Start 0.70, defer final to tuning** | 0.70 reuses the frozen Shape-F detent; exact value is a Bruce-harness tuning output. |
| Q6 surface tag | two-value navigator|internal (recommended) / three-value / keep kind + internal:true | **Two-value navigator | internal** | Spans CLI + MCP surfaces. |
| Q1 FUSION cadence | boundary-pass first (recommended) / continuous from start / boundary-only | **Boundary-pass first, add continuous if needed** | Continuous is the likely follow-on (German-resilience miss was mid-conversation). |

## Claude's discretion / recommendations carried

- Larry recommended "derive" for Q5; navigator chose "mint" - respected and recorded as an override.
- 0.70 anchored to the existing frozen Shape-F 0.70/0.15 detent for consistency.

## Deferred ideas

- Q2 job-test visibility (invisible-for-peers vs visible-for-learners).
- Q3 web-fetch on tell-mode sensitive personas (silent vs announce-but-do-not-ask).

## Known issue

ROADMAP.md body entry for Phase 205 reverted on cascade/reload; the phase-dir CONTEXT.md is the durable source. Flagged for a separate debug.
