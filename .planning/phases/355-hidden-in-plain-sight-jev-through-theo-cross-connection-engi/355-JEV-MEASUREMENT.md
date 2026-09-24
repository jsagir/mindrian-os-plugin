# Phase 355 Plan 15: HSI Thinking-Mode Measurement (Jev vs Regex)

The phase's first Jev question (SPEC Req 5, HIPS-08; AI-SPEC D14): does one
Jev Choice label a sentence's thinking mode better than the existing
keyword-count regex in `lib/core/hsi-spectral.cjs`? The bar for "better" was
written into code before this run happened (D-45), so nothing below was
tuned after the fact.

## Sample size ruling (read this before the numbers)

The intended gold set was 120 to 132 sentences, 20+ per label. The navigator
blind-labeled 45 of the 132 before stopping, and ruled (2026-09-24, recorded
in `tests/fixtures/355-hsi-thinking-mode-sentences.json`'s `floor_ruling`)
that the 45 already labeled become gold now, with the other 87 left open in
the session file for a later resume. This measurement runs on that 45-item
partial gold, not the originally intended 120+. Per-mode counts: analytical
7, integrative 10, descriptive 10, evaluative 7, creative 11, **none 0**. No
`none` sentence was labeled at all in this partial set, so every `none`
number below reads "no gold examples", never 0/0 and never a false 100
percent. If the navigator later resumes labeling to 132 and re-emits the
gold file, this whole measurement re-runs against the larger set and this
file is superseded.

## Run facts

- Measured: 2026-09-24T04:54:07.149Z
- Model, every recorded response: `jev-1.13.0` (pinned; a different model on
  any single call would have aborted the run)
- Repeats: 3
- Calls: 135 (45 sentences x 3 repeats), `non_200: 0`
- Input tokens: 101,730 across all 135 calls
- Cost estimate: $0.00427266 at the vendor-documented $0.042 per million
  input tokens (output tokens are free)
- Question sha256: `3ad28aae0121ee583a974c097c14394544bba3d4c874506b2a4ac96f54a98a63`
- Gold fixture sha256: `1899a5fcac518ac54f76ddd5a97efd7dc69bb523693fdca2b1fbcdb0f7de96cd`
- Gold labeled at: 2026-09-24T04:33:11.960Z
- Responses recorded to `tests/fixtures/355-jev-hsi-responses.json` (sha256-keyed,
  offline replay through `--check`, zero network, zero key)

## Regex vs Jev

Three cuts, per repeat, argmax against the navigator's gold, no abstention
on either side (the regex never abstains either, so this compares like for
like per AI-SPEC Section 4).

| Repeat | Jev full-set accuracy (n=45, none counted) | Regex full-set accuracy | Gap (Jev minus regex) |
|---|---|---|---|
| 1 | 42.22% (19/45) | 48.89% (22/45) | -6.67 points |
| 2 | 42.22% (19/45) | 48.89% (22/45) | -6.67 points |
| 3 | 44.44% (20/45) | 48.89% (22/45) | -4.45 points |

The 5-mode subset accuracy is identical to the full-set number on every
repeat, because this partial gold has zero `none` examples to subtract.

**Per-mode recall** (correct answers for that gold label, divided by how
many gold examples carry that label):

| Mode | Gold n | Jev repeat 1 | Jev repeat 2 | Jev repeat 3 | Regex |
|---|---|---|---|---|---|
| analytical | 7 | 42.86% (3/7) | 42.86% (3/7) | 42.86% (3/7) | 42.86% (3/7) |
| integrative | 10 | 20.00% (2/10) | 20.00% (2/10) | 20.00% (2/10) | 20.00% (2/10) |
| descriptive | 10 | 50.00% (5/10) | 50.00% (5/10) | 60.00% (6/10) | 70.00% (7/10) |
| evaluative | 7 | 57.14% (4/7) | 57.14% (4/7) | 57.14% (4/7) | 42.86% (3/7) |
| creative | 11 | 45.45% (5/11) | 45.45% (5/11) | 45.45% (5/11) | 63.64% (7/11) |
| none | 0 | no gold examples | no gold examples | no gold examples | no gold examples |

The regex and Jev tie exactly on analytical and integrative recall on this
45-item set (the same 3 of 7, and the same 2 of 10, right and wrong for
both). Jev's own edge is on evaluative (+14.29 points over the regex on
every repeat). The regex's edge is on descriptive (+10 to +20 points) and
creative (+18.19 points, every repeat).

**Confusion matrices** (rows = gold, columns = predicted, label order
analytical / integrative / descriptive / evaluative / creative / none):

Jev, repeat 1:
```
              pred: analytical integrative descriptive evaluative creative none
gold analytical          3           1           3          0        0     0
gold integrative         2           2           3          2        0     1
gold descriptive         0           0           5          2        0     3
gold evaluative          0           0           2          4        0     1
gold creative            1           3           1          1        5     0
gold none                0           0           0          0        0     0
```

Jev, repeat 2: byte-identical to repeat 1's matrix above.

Jev, repeat 3 (descriptive shifts one item from evaluative to itself,
relative to repeats 1 and 2):
```
              pred: analytical integrative descriptive evaluative creative none
gold analytical          3           1           3          0        0     0
gold integrative         2           2           3          2        0     1
gold descriptive         0           0           6          1        0     3
gold evaluative          0           0           2          4        0     1
gold creative            1           3           1          1        5     0
gold none                0           0           0          0        0     0
```

Regex (identical pre-fix and post-fix on this gold, see the typo section
below):
```
              pred: analytical integrative descriptive evaluative creative none
gold analytical          3           1           3          0        0     0
gold integrative         2           2           4          2        0     0
gold descriptive         0           0           7          3        0     0
gold evaluative          0           0           3          3        1     0
gold creative            0           2           2          0        7     0
gold none                0           0           0          0        0     0
```

Both sides land 3 of 45 sentences that are gold `none`... there are none to
land, since this partial gold carries zero `none` examples; the empty
`none` row and column above are exactly that gap made visible, not a
rounding artifact.

**Jev accuracy split by confidence** (secondary analysis only, D14: this
never filters or replaces the argmax number above):

| Repeat | Confidence >= 0.9 (n, accuracy) | Confidence < 0.9 (n, accuracy) |
|---|---|---|
| 1 | n=27, 51.85% | n=18, 27.78% |
| 2 | n=28, 50.00% | n=17, 29.41% |
| 3 | n=28, 50.00% | n=17, 35.29% |

Jev is right more often when it is confident, on all three repeats, which
is the expected shape for a working confidence signal even though the
argmax number is what the bar is judged on.

**The regex's own bias, named explicitly (D14):** the regex answers `none`
0 percent of the time by construction (`THINKING_MODES_v1` has no `none`
entry; `classifySentenceMode` falls back to `descriptive` on a zero-match
sentence, never to `none`). On this 45-item gold, the regex's answer is
`descriptive` on 42.22% of items (19 of 45), and 10 of those 19 came from
the zero-match fallback (no keyword matched anything; the regex defaulted
to `descriptive` for lack of a better answer). That fallback share (10 of
45, 22.22% of the whole set) is the regex's blind spot this measurement is
supposed to surface, and it does: those are very likely candidates for a
`none` label the regex structurally cannot produce.

## Adoption bar

Fixed before this run, per D-45 and the AI-SPEC D14 dimension: adopt only
if Jev's full-set accuracy (none counted) beats the regex's by 10 points or
more, AND no single mode's Jev recall falls more than 5 points below the
regex's recall for that mode, holding on every one of 3 repeats.

Applied mechanically (`applyAdoptionBar`, `tests/fixtures/355-hsi-measurement-record.json`'s
`bar` field) against `regex_postfix` (the regex as it ships after this
phase's typo fix, the baseline a future adoption decision is actually
compared against):

| Repeat | Gap (points) | Bar needs >= 10 | Modes dropping > 5 points | Cleared |
|---|---|---|---|---|
| 1 | -6.67 | No | descriptive (-20.00), creative (-18.19) | No |
| 2 | -6.67 | No | descriptive (-20.00), creative (-18.19) | No |
| 3 | -4.45 | No | descriptive (-10.00), creative (-18.19) | No |

**Result: not cleared, on all 3 repeats.** This is not "inside run-to-run
noise" (that phrase is reserved for a bar that clears on some repeats and
not others; this one does not clear on any). Jev's full-set accuracy is
below the regex's on every repeat, by 4.45 to 6.67 points, the opposite
direction the bar needs; and two of the five measurable modes
(descriptive, creative) show Jev recall 10 to 20 points below the regex's,
well past the 5-point tolerance. The `none` mode could not be evaluated on
either side (zero gold examples, see the sample-size ruling above); it is
recorded as `skipped_modes: ["none"]`, not scored as a pass or a drop.

**What this result means at n=45, stated plainly:** the numbers say the
regex currently outperforms one Jev Choice on this particular 45-sentence
draw, on the two modes (descriptive, creative) where the regex's own
common-word patterns happen to align well with how these sentences were
written, and Jev has a real edge only on evaluative. The comparison the
bar actually needs, on the `none` dimension where the regex has a
structural blind spot, is not yet measurable at all (zero gold examples for
`none`). This is not evidence that Jev cannot help with thinking-mode
labeling; it is evidence that, on the specific 45 items labeled so far and
against the specific frozen question asked here, a single unaided Jev
Choice does not clear the fixed bar. A different outcome on the remaining
87 items, a different question wording (iterated on the tuning set, never
this gold set), or a distilled rule table (355-28, if ever pursued) are all
separate, unmeasured possibilities this run says nothing about either way.

## Regex typo (D-58)

The integrative pattern shipped with `anolog` instead of `analog`. The
measurement first ran with the pattern as shipped (`regex_prefix`); the
typo was then fixed in `lib/core/hsi-spectral.cjs` (`anolog` -> `analog`,
comment citing this file), and the regex side was recomputed from the
fixed file (`regex_postfix`) via `--regex-only`.

**Effect on this gold set: none.** `regex_prefix` and `regex_postfix` are
byte-identical across every field measured: full-set accuracy 48.89%,
every per-mode recall number, the confusion matrix, the descriptive share
(42.22%, 19 of 45 answers), and the zero-match fallback count (10 of those
19). None of the 45 gold sentences contains the substring "analog" (or
"anolog"), so the fix could not have changed a single answer on this
particular set. The typo fix is still real and still shipped; it simply
has no measurable effect on THIS gold. A future sentence containing
"analog" (for example, a description of an analog-to-digital conversion,
or an "analog" used as a metaphor) would now correctly count toward the
integrative pattern instead of silently missing it.

`scripts/compute-hsi.py` keeps the original `anolog` pattern unchanged
(D-05: the Python reference stays as-is; CJS and Python now diverge on the
word "analog" by design, since only the CJS path is live).

The adoption bar above is applied against `regex_postfix` (the shipped,
fixed baseline), which is what a real adoption decision would actually be
compared to; since the two are byte-identical here, applying it against
`regex_prefix` would have produced the identical result.

## Decision

**not_adopted.** Signed off by the navigator, 2026-09-24.

The bar (D-45) failed on all 3 repeats, mechanically applied against
`regex_postfix`. Jev's full-set accuracy (n=45, none counted) came in below
the regex's on every repeat, not above: 42.22% / 42.22% / 44.44% for Jev
against 48.89% for the regex, gaps of -6.67 / -6.67 / -4.45 points (the bar
needed +10 or more). Two of the five measurable modes dropped past the
5-point tolerance on every repeat: descriptive (-20.00 / -20.00 / -10.00
points) and creative (-18.19 points, every repeat). `none` could not be
evaluated on either side (zero gold examples in this partial 45-item set),
recorded as `skipped_modes`, not scored as a pass or a drop. Because the bar
did not clear on any of the 3 repeats, `not_adopted` was the only valid
option (D-45: the bar is never relaxed after results); the mixed-repeat
"inside run-to-run noise" wording does not apply here, since noise means
clearing on some repeats and not others, and this bar cleared on none.

**The navigator's reading for the record, beyond the mechanical bar
result:** both engines score under 50 percent against a fast, single-labeler
gold, so the gold itself is as much under test here as either engine is.
With only 7 to 11 gold examples per mode, one sentence moving from wrong to
right shifts a mode's recall by 9 to 14 points -- the per-mode numbers above
are that fragile at this sample size. The regex cannot answer `none` at all
by construction (`THINKING_MODES_v1` has no `none` entry); of its 19
descriptive answers on this 45-item set, 10 were the zero-match fallback
(no keyword matched anything), which is the regex's real blind spot and the
dimension this measurement was supposed to surface -- and could not, because
this partial gold carries zero `none` examples to measure against.

**What a future attempt needs:** complete the labeling sitting to the full
132 sentences (87 items remain open in the session file), re-emit the gold
without `--partial`, and re-measure. This measurement, taken at n=45 against
a partial gold with no `none` examples, is not evidence that Jev cannot help
with thinking-mode labeling -- it is evidence that a single unaided Jev
Choice does not clear the fixed bar on the specific 45 items labeled so far.
Per 355-15's own `must_haves`, adoption work (plan 355-28) runs only on an
`adopted` decision; with `not_adopted` recorded here, 355-28's own Task 1
gate reads this record and skips its three tasks, writing nothing under
`data/`.

---

## Citation-check calibration (D-46, AI-SPEC D15)

Measured: 2026-09-24T18:10:37.007Z. Model, every recorded response:
`jev-1.13.0` (pinned; a different model on any single call would have
aborted the run). Calls: 86 (43 templated items x 2 variants: rule stated,
rule withheld), `non_200: 0`. Input tokens: 45,275. Cost estimate:
$0.00190155 at the vendor-documented $0.042 per million input tokens
(output tokens are free).

The item file (`tests/fixtures/355-citation-pairs.items.json`) carries 43
templated `{claim, path}` items across 5 strata (`direct_lateral` 12,
`hub` 11, `three_hop` 4, `both_directions` 8, `contradicting` 8), plus 8
`no_path` entries that carry no `path` at all. Those 8 make ZERO Jev
calls: code decides `unverified` for a citation with no path to score
(D-46), so nothing about them is calibrated here -- only their count is
recorded.

8 of the 43 scored items are synthetic (`synthetic: true`): the entire
`contradicting` stratum, built by 355-14 Task 2's own fallback rule
because Theo's canon carried zero naturally-occurring `CONTRASTS_WITH`
edges among the sampled pairs. The other 35 are drawn directly from a
live Theo capture.

The gold (`tests/fixtures/355-citation-pairs.json`) is machine-labeled by
an external model (`claude-opus-5.5`, `labeler_kind: external_model`)
under the navigator's 2026-09-24 ruling recorded in 355-14-SUMMARY.md --
the navigator's own blind sitting on this exact set stands at 0/43 (a real
CLI defect, root-caused and fixed within that same plan, not a change of
position; the sentence gold in 355-15 above remains the navigator's own
blind labels, unaffected). The gold's own verdict counts across the 43
scored items: 35 `says_nothing`, 8 `contradicts`, 0 `supports`.

Two limitations from 355-14-SUMMARY.md carry into every number below:

1. **`supports` is structurally unreachable in this item set.** No item
   samples an `ALIAS_OF` path, so this calibration exercises a two-class
   effective gold (`says_nothing` vs `contradicts`), not the three-class
   schema the `citation_check` profile itself supports. A follow-up item
   set sampling `ALIAS_OF` paths specifically would be needed to measure
   `supports` at all.
2. **Every `contradicts` gold item is exactly the synthetic
   `contradicting` stratum** -- the 8 items where 355-14 constructed the
   contradiction itself, since Theo's canon returned none of these
   unprompted. The `contradicts` numbers below measure Jev against a
   constructed contradiction, not one the canon produced on its own.

The rule (`CITATION_RULE`, `scripts/jev-question-ceilings.cjs`), stated
verbatim to Jev in the `stated` variant and withheld entirely in the
`withheld` variant:

> Apply in this order. (1) If a hop in `path` states a relation opposite
> to the one `claim` asserts, answer contradicts. (2) Else if the hops,
> read in order, directly show the relation `claim` asserts, answer
> supports. (3) Else answer says_nothing. A path that joins the two
> frameworks only through a broad shared node (a problem type, a stage, a
> general category) says nothing.

### Stated vs withheld

| Variant | n | Exact agreement with gold | Auto-verdict slice (confidence >= 0.8) | Coverage | Human-routed share |
|---|---|---|---|---|---|
| stated | 43 | 41/43 (95.35%) | 23/23 correct (100.00%) | 53.49% | 46.51% |
| withheld | 43 | 25/43 (58.14%) | 10/12 correct (83.33%) | 27.91% | 72.09% |

Stating the rule roughly doubles exact agreement on this item set (58.14%
-> 95.35%) and roughly doubles the share of items the auto-verdict slice
would cover (27.91% -> 53.49%), while also raising the auto-slice's own
accuracy (83.33% -> 100.00%). The direction of this gap matches the
spike's earlier policy-execution-parity finding (64/64 stated vs 40/64
withheld; `.claude/skills/spike-findings-MindrianOS-Plugin`), on a
different, phase-355-specific item set.

### Band and the future seam

The stated-rule auto-verdict slice's measured accuracy is
`confidenceFromBucket({correct: 23, n: 23})` = **high** (23 of 23 correct,
>= 0.9 -- `lib/core/eureka-critic.cjs`). This band is computed from
measured accuracy on this run, never from Jev's own confidence number
(Tetlock #6; D-46) -- that is the entire point of `bandFromMeasured`.

The rule for a future seam, written down now, before any seam exists:
high band -> auto-verdict is allowed at confidence >= 0.8; medium band ->
every verdict goes to a human; low or unknown band -> rewrite the
question before this seam is used at all.

**No Jev verdict from this calibration reaches a runtime stamp this
phase.** `judge` stays the zod literal `'none'` at runtime (D-14); this is
a dev-time measurement only, feeding the Theo T-2 outbound note (355-27).

---

## Usefulness judge vs navigator (AI-SPEC D18)

Measured: 2026-09-24T18:10:47.516Z. Model, every recorded response:
`jev-1.13.0`. Calls: 96 (one per sitting-1 pairing,
`tests/fixtures/355-rooms/pairings.items.json`), `non_200: 0`. Input
tokens: 79,231. Cost estimate: $0.00332770 at $0.042 per million input
tokens.

Each pairing was sent to Jev as `{a_excerpt, b_excerpt, direction_phrase,
verification}` through the `usefulness_judge` profile -- `verification`
is the stamp TIER WORD from `tests/fixtures/355-rooms/stamps.json`
(`strong` / `indirect` / `unverified`), never a number. The excerpts are
synthetic dev-repo fixture text (three Claude-authored fixture rooms), not
user-room bytes, so this stays Part-8-clean. Jev answered one Choice per
pairing: `useful` / `not_useful` / `already_known` / `none`.

### Agreement with the navigator's blind `useful` / not label

Mapping (D-46): navigator `useful: true` <-> Jev choice `useful`;
navigator `useful: false` <-> any other Jev choice (`not_useful`,
`already_known`, `none`).

| | n | Agree | Rate |
|---|---|---|---|
| overall | 96 | 73 | 76.04% |
| unverified tier | 82 | 65 | 79.27% |
| strong tier | 13 | 7 | 53.85% |
| indirect tier | 1 | 1 | 100.00% |

Jev agrees with the navigator most often on `unverified` pairings (79.27%,
the tier with the most examples, 82 of 96) and least often on `strong`
pairings (53.85%, 13 examples) -- the reverse of what a verification tier
"helping" the judge would look like. `indirect` has only 1 example in this
fixture-room set; its 100% agreement is not a meaningful rate at n=1.

### `already_known`

Two different figures, both requested by AI-SPEC D18 and the plan's own
execution notes -- they answer different questions and must not be read
as the same number.

**`already_known` rate per tier** (share of Jev's OWN answers that were
`already_known`, regardless of whether the navigator agreed):

| Tier | n | Jev said already_known | Rate |
|---|---|---|---|
| unverified | 82 | 2 | 2.44% |
| strong | 13 | 0 | 0% |
| indirect | 1 | 0 | 0% |

**Agreement on the navigator's own `already_known` label** (Jev's
`already_known` choice vs the navigator's `already_known: true/false`
boolean, overall, all 96 pairings): 53 of 96 agree, **55.21%**. The
navigator marked 45 of 96 pairings `already_known: true`
(355-24-SUMMARY.md's own tally); Jev's `already_known` choice landed on
only 2 of 96 pairings total (both in the `unverified` tier) -- Jev is far
more reluctant to call a pairing already-known than the navigator was,
which is most of why the two `already_known` figures above diverge so
sharply from each other.

The navigator's `direction_ok` label was **not** judged by Jev in this
plan -- out of scope for D18 (AI-SPEC D18 asks about usefulness, not
direction correctness); no agreement figure for `direction_ok` exists in
this record.

**Jev's answers never enter the hit rate.** `355-VERIFICATION.md`'s hit
rate (D16, 355-25) is computed from
`tests/fixtures/355-rooms/judgments.json` (the navigator's blind sitting-1
judgments) alone; this section only measures how far a Jev usefulness
judge sits from that human gold, per AI-SPEC D18 -- it does not replace,
feed, or adjust the hit rate.
