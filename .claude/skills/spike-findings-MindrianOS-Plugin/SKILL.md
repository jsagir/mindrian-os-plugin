---
name: spike-findings-MindrianOS-Plugin
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building MindrianOS-Plugin's Jev (TypeSafe) ranking seats and the section framework ledger over Theo. Auto-loaded during implementation work.
---

<context>
## Project: MindrianOS-Plugin

Use TypeSafe's Jev (a System One model: typed choice / score / noul answers with
calibrated probabilities and a confidence value, no text generation) as the ranker for
MindrianOS decisions that are made over STRUCTURE, never over room content. Seats:
the per-section framework ledger (rank Theo's candidate frameworks for a room section
by fit, not graph degree), Theo-side judgments whose policy can be written down, and
next_gate option ordering. Explicitly NOT a seat: the Part 8 egress guard.

Spike sessions wrapped: 2026-09-17
</context>

<requirements>
## Requirements

- Canon Part 8 holds for every call: state carries generic methodology handles only
  (framework names, section slugs, problem-type and stage enums, quantized scalars). Zero
  room content, zero user text, zero artifact ids.
- Key lives in `~/.secrets/typesafe.env` (mode 600) as `TYPESAFE_API_KEY=`; never
  hardcoded, never printed, never committed. `MAIN.env` is globally git-ignored.
- Spike code is CJS, zero npm deps, native `fetch` (Node 22). The SDK is a real-build
  choice, not a spike dependency.
- Any future in-hook use is async and best-effort with backoff; a Jev outage can never
  block a turn.
- Vendor speed and cost figures are unverified until a spike measures them; the spike
  numbers are the only ones quoted.
- Dependency shape (navigator ruling 2026-09-17): users never carry a Jev dependency or
  key. Finite input spaces are scored once at dev time or in Theo's re-emission and
  SHIPPED AS DATA. Per-user inputs that are already Part-8-clean route
  plugin -> Theo -> Jev with Theo holding the one key. Jev never runs in a hook on a
  user's machine.
- IP egress ruling (navigator, 2026-09-17): what may cross to TypeSafe about a framework
  is its name, a JTBD statement (rendered from the Brain's closed job vocabulary on
  `jtbd_anchor`) and a glossary line (`definition`, else the first sentence of the
  description capped at 140 chars). Full Theo descriptions never cross unless the
  navigator runs it himself.
- Theo read contract, as measured: ROW_CAP=100 returns a text-only notice with ZERO rows;
  `Skip`, `Distinct` and `NodeUniqueIndexSeekByRange` are PLAN_REJECTED; a function-wrapped,
  parameterized predicate plans as NodeByLabelScan + Filter and passes. Any ledger builder
  pages by bucket, never by SKIP or by name range.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Jev typed decisions API | references/jev-typed-decisions-api.md | Contract, latency (p50 ~300 ms, cold ~800 ms, p95 up to 1.2 s), cost, 400-not-422, no 429 at 20-wide, wrapper shape |
| Section framework ledger | references/section-framework-ledger.md | Jev ranks Theo frameworks at Spearman 0.59-0.82 vs degree 0.06-0.13; blocked by Theo content (305 of 410 stubs); ships as data |
| Policy execution parity | references/policy-execution-parity.md | Stated rule 64/64 at confidence 0.90; withheld rule 40/64; state the policy, never let it be inferred |

## Source Files

Original spike source files are preserved in `sources/` for complete reference
(READMEs, runners, the hand-labeled fixture). Result logs, the pulled Theo framework
data and the rendered report stay in `.planning/spikes/` only.
</findings_index>

<metadata>
## Processed Spikes

- 001-jev-liveness-cost (VALIDATED)
- 002-jev-section-framework-ranker (PARTIAL)
- 003-jev-hook-latency-budget (VALIDATED)
- 004-jev-eureka-critic-parity (VALIDATED)
</metadata>
