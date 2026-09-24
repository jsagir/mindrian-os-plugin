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

pending navigator sign-off
