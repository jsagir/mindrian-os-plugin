# Phase 366 spike rulings (D-02, D-05, D-08)

Date: 2026-10-02
Ruled by: the navigator, through one AskUserQuestion card at plan 366-20 Task 2.
Navigator's answer, verbatim: "Accept all six (Recommended)"

That answer adopts the six recommendations presented on the card, exactly as written below.
Earlier ruling in the same session, verbatim: "Label the 14 small, rule on vector"
(366-19 Task 2: only eureka-graph-lexical and hsi-graph were labeled; the vector arm is UNMEASURED).

## The measured record (tests/fixtures/366-spike/record.json, `node scripts/spike-366.cjs --check` green)

Bar (pre-registered in bar.json before any arm ran): adopt an arm only if its Wilson 95% lower
bound exceeds 0.448 on each of 3 repeats. The 0.448 is the RS/HSI engine-output baseline
(43 of 96 from rs-engine and hsi-engine); Eureka was substrate_unavailable on the bare fixtures.

| Recall arm | Useful / shown | Rate | Wilson 95% | Clears bar | Note |
|---|---|---|---|---|---|
| eureka-graph-lexical | 3 / 7 | 0.43 | [0.158, 0.750] | no | needs 6 of 7 to clear |
| hsi-graph | 4 / 7 | 0.57 | [0.251, 0.842] | no | HSI slice is 27 / 47 = 0.575; direction ok 5 of 7 |
| rs-graph | 0 shown | none | none | no | 0 pairs on the fixtures; RS slice is 16 / 49 = 0.327 |
| eureka-graph-lexical-vector | 96 shown, unlabeled | UNMEASURED | none | no | by ruling; no number exists |

| Judge arm (both measured recall arms) | Passed / useful | Clears bar |
|---|---|---|
| stage-a | passes all 7 (no filtering) | no |
| jev | 0, 1 useful, 0 over the three repeats (7 calls, 4,439 input tokens per repeat) | no |
| claude | the same single pair each repeat, gold useful but already known | no |
| claude-then-jev | 0 every repeat | no |

Label consistency: the two arms showed the same 7 pairs; the two blind useful labels agreed on 6 of 7.

## Rulings

judge: stage-a
Verbatim: "Accept all six (Recommended)". Adopted recommendation: Stage A only. No judge arm cleared
the bar, and "none clears" keeps Stage A only as the default.

recall: graph-lexical
Verbatim: "Accept all six (Recommended)". Adopted recommendation: keep graph plus lexical only; the
vector lane stays OFF. The vector arm is UNMEASURED by the earlier ruling "Label the 14 small, rule on
vector"; turning it on would reopen the vector_model_download egress line (default false).

engines: keep
Verbatim: "Accept all six (Recommended)". Adopted recommendation: rs-engine and hsi-engine stay the live
path. hsi-graph matches the HSI slice rate on a sample of 7 and rs-graph surfaced nothing on the
fixtures; moving ambient find-bottlenecks, the hsi producers and the command doors to the graph
perspectives would need a larger re-run in a follow-on, not this phase.

runner: retire
Verbatim: "Accept all six (Recommended)". Adopted recommendation: retire the standalone runner now (D-02).
The spike is closed; plans 366-21 and 366-22 proceed.

jev-runtime: dev-time
Verbatim: "Accept all six (Recommended)". Adopted recommendation: Jev stays dev-time only. It never
cleared the bar and was unstable across repeats (1, 0, 0 passes). The judge_jev line in
data/egress-policy.json stays default false; users never carry a Jev key.

haiku: separate-producer
Verbatim: "Accept all six (Recommended)". Adopted recommendation: the Haiku entity pre-step is a
separate producer that owns its own line, out of every recall stage (D-09). This matches the current
entity_extraction line (off inside this pipeline); no grant path is added.

## Follow-ons for plan 366-24

- No policy default changes: jev-runtime and haiku keep data/egress-policy.json as it is (judge_jev
  false, entity_extraction false, vector_model_download false). Nothing to edit there.
- Any spike re-run uses a distinct recall tag per arm (366-19 deviation 1) and a larger substrate so
  the graph arms reach a comparable n (the baseline n is 96; both measured arms showed 7).
- record.json carries `adoption.decision: null` by design (the harness never adopts); this file is the
  record of adoption.
- Mirror the record and these rulings to the rethinking-mindrianos research trail at close-out
  (366-24 Task 3).
