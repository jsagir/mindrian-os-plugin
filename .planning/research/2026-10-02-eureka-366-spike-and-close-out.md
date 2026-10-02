---
methodology: research
title: "Phase 366 close-out: the Eureka perspective spike record, the six navigator rulings, and the Theo-side intent-led resolver request"
created: 2026-10-02
status: active
room_section: research
informs: "dev/MindrianOS-Plugin Phase 366 (closed by plan 366-24); the Theo intent-led resolver request (D-13 c); follow-ons for Phases 349, 364, 367, 368"
follows: 2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md
related: 2026-10-01-deep-research-planner-363-close-out.md, 2026-09-25-phase-355-hidden-in-plain-sight-close-out.md
sources: "366-HANDOFF.md; 366-SPIKE-RULINGS.md; tests/fixtures/366-spike/record.json (node scripts/spike-366.cjs --check green); tests/fixtures/366-spike/bar.json; 366-11-SUMMARY.md; 366-20-SUMMARY.md"
---

# Phase 366 close-out: spike record, rulings, and the Theo-side request

Filed 2026-10-02. Research trail for the close of Phase 366 (Eureka as a perspective of the
research planner, MCP canvas tooling). It follows the 2026-10-01 entry
`2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md`, which asked the questions this phase
answered. Counts and rulings only; the spike ran on synthetic fixture rooms, and no client room
content appears here. Hyphens only.

Cross-links (the plugin repo, `dev/MindrianOS-Plugin`):

- `.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-HANDOFF.md`
  (what shipped, follow-ons, the Theo-side request; it links back here)
- `.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-SPIKE-RULINGS.md`
  (the six rulings, verbatim)
- `tests/fixtures/366-spike/record.json` (the measured record; `node scripts/spike-366.cjs --check`
  recomputes it byte for byte from committed inputs)
- `.planning/todos/pending/2026-10-01-theo-intent-led-canon-resolver.md` (the Theo request as a todo)

## What was asked, and the short answer

The 2026-10-01 entry asked whether Eureka should stay an engine. Phase 366 answered: no. Eureka is
now one of six perspectives of the research planner (eureka, rs, hsi, whitespace, analogies,
connections), every recall stage is offline, and the standalone runner is deleted. The spike asked
a narrower question: does any new recall arm or judge arm beat the old engines by a bar fixed in
advance? On this substrate, none did. So nothing was adopted, the old RS and HSI engines stay live,
and the judge stays Stage A only.

## The spike record

The bar was committed (`tests/fixtures/366-spike/bar.json`) before any arm ran: adopt an arm only
if its Wilson 95% lower bound exceeds 0.448 on each of 3 repeats.

The baseline note matters. 0.448 is the RS/HSI engine-output baseline from Phase 355 (43 useful of
96 shown, from `rs-engine` and `hsi-engine`; Wilson 95% [0.352, 0.548]). It is not a Eureka
baseline: Eureka was `substrate_unavailable` on the bare fixtures, so no arm here is "a change from
44.8%". Each rate is read against the pool and against two slices: HSI 27 of 47 = 0.575
([0.433, 0.705]) and RS 16 of 49 = 0.327 ([0.212, 0.466]).

### Recall arms, per repeat

| Arm | Repeat | Shown | Useful | Rate | Wilson 95% | Clears bar |
|---|---|---|---|---|---|---|
| eureka-graph-lexical | 1 | 7 | 3 | 0.43 | [0.158, 0.750] | no |
| eureka-graph-lexical | 2 | 7 | 3 | 0.43 | [0.158, 0.750] | no |
| eureka-graph-lexical | 3 | 7 | 3 | 0.43 | [0.158, 0.750] | no |
| hsi-graph | 1 | 7 | 4 | 0.57 | [0.251, 0.842] | no |
| hsi-graph | 2 | 7 | 4 | 0.57 | [0.251, 0.842] | no |
| hsi-graph | 3 | 7 | 4 | 0.57 | [0.251, 0.842] | no |
| rs-graph | 1 to 3 | 0 | none | none | none | no |
| eureka-graph-lexical-vector | 1 to 3 | 96, unlabeled | none | UNMEASURED | none | no |

eureka-graph-lexical would need 6 useful of 7 to clear at this n. The vector arm is UNMEASURED by
ruling (the navigator labeled only the 14 small items; no number exists for it).

### The RS and HSI slice comparisons

- HSI: hsi-graph's rate (0.57 on 7) matches the HSI slice of the engine baseline (0.575 on 47). Its
  lower bound (0.251) sits below both the slice and the pool, because 7 is a small sample. Same
  rate, not enough evidence to switch.
- RS: rs-graph surfaced 0 pairs on the fixtures, so there is nothing to compare with the RS slice
  (0.327). The graph RS recall needs a richer substrate before it can be measured.

### Judge arms (over both measured recall arms)

| Judge | eureka-graph-lexical, passed per repeat | hsi-graph, passed per repeat | Clears bar |
|---|---|---|---|
| stage-a | 7 (1 repeat recorded; deterministic, no filtering) | 7 (1 repeat recorded) | no |
| jev | 0, 1, 0 (7 calls, 4,439 input tokens per repeat) | 1, 0, 0 (same cost) | no |
| claude | 1, 1, 1 (the same pair; gold useful but already known) | 1, 1, 1 | no |
| claude-then-jev | 0, 0, 0 (1 call, 632 input tokens per repeat) | 0, 0, 0 | no |

Jev was unstable across repeats on identical inputs (1, 0, 0 passes) and never cleared the bar.

### Label consistency

The two measured arms showed the same 7 pairs. The navigator's two blind useful labels for those
pairs agreed on 6 of 7.

## The re-measured direction and floor rows

- Direction convention (graph variant, `classifyGraph` with its own phrase hash): hsi-graph showed a
  direction phrase on all 7 items and the direction was right on 5 of 7 ("same words with different
  meaning" 4 of 6; "same meaning in different words" 1 of 1). eureka-graph-lexical showed no phrase
  on any item, so it has no direction count. rs-graph showed nothing.
- Floor ledger: the rs-recall and hsi-recall rows, and the two eureka-recall rows that promised a
  spike re-measure, stay `disclosed`. Their provenance now says why no bucket could be measured:
  rs-graph had 0 pairs and no absolute lag floor; HSI has no divergence floor and 7 pairs sit far
  inside the caps; every eureka pair shown is above the lexical floor by construction.
  `check-floor-ledger --check` reads 62 rows, 0 unresolved.

## The six navigator rulings (366-SPIKE-RULINGS.md, 2026-10-02)

Ruled through one card. The navigator's answer, verbatim: "Accept all six (Recommended)". Earlier
ruling in the same session, verbatim: "Label the 14 small, rule on vector".

| Ruling | Value | What it means |
|---|---|---|
| judge | `stage-a` | No judge arm cleared the bar; Stage A only stays the default. |
| recall | `graph-lexical` | Graph plus lexical only; the vector lane stays OFF (UNMEASURED; turning it on would reopen the `vector_model_download` egress line, default false). |
| engines | `keep` | `rs-engine` and `hsi-engine` stay the live path; moving ambient find-bottlenecks, the hsi producers and the command doors to the graph perspectives needs a larger re-run in a follow-on. |
| runner | `retire` | Retire the standalone runner now (D-02). Done in 366-22. |
| jev-runtime | `dev-time` | Jev stays dev-time only; `judge_jev` stays default false; users never carry a Jev key. |
| haiku | `separate-producer` | The Haiku entity pre-step is a separate producer owning its own line, out of every recall stage; `entity_extraction` stays off inside this pipeline. |

No egress default changed, so `data/egress-policy.json` was not edited at close.

## The Theo-side request (D-13 c)

The vocabulary gap (80.2% `not_called` in Phase 355) now closes through Theo, gated per term and
led by intent: a room word that does not resolve offers a release card, and only a navigator yes
sends that one word. The plugin builds the full release envelope

```
{ raw, intent, section, perspective }
```

where `intent` is the room's JTBD handle (never prose), `section` a slug and `perspective` one of
the six ids. The Part 8 guard allows it only with the gate receipt (`navigator_released`), and the
audit ledger records it with the gate id. Today the wire carries `{ raw }` only, because Theo's
`normalize_framework_name` input is a strictObject with the single key `raw`. The one approved live
round trip (2026-10-02) sent one word and Theo answered a miss.

The request to Theo: a resolver that takes the envelope and resolves by intent and context to a
canon name, never fuzzy on the name alone. When Theo ships it, the plugin needs no guard change,
only a transport switch in `canon-release.cjs`.

## What we learned

1. A pre-registered bar did its job: it stopped a 4 of 7 result from reading as a win.
2. The fixture substrate is too thin for graph recall (7 pairs per arm, 0 for RS). The next spike
   needs a larger substrate and a distinct recall tag per arm, so the graph arms reach an n
   comparable to the baseline's 96.
3. Retiring the runner did not need the spike to "win". The perspective path is offline, and the
   one runner behavior it had lost (an authored FEYNMAN as a candidate, B51-01) was restored before
   the deletion, so the retirement stands on its own.
4. Name lookup is the wrong tool for the vocabulary gap. The intent and context have to travel with
   the word, and the side that owns the canon has to resolve it.
