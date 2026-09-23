# 355-02 Task 1: The PWS author's ruling on the two direction phrases (D-35 step 2)

Recorded by Task 2 of plan 355-02, on 2026-09-23. This is the durable, machine-checked
record of the ruling that gates every fixture, citation pair, and direction fixture
built on top of `lib/core/direction-convention.cjs` from this point forward (D-35: the
PWS author confirms or replaces the two direction phrases BEFORE any of that is authored).

## Who

The PWS author (role only, never a personal name, per this repo's naming rule).

## When

2026-09-23.

## What was presented

1. The deck's own section 3 wording (`355-ORIGIN-CONCEPT.md`, "Two measures of
   similarity" and section 3's derivation): Latent Semantic Analysis is the "shallow"
   word-co-occurrence measure ("compares words"); Semantic Textual Similarity (BERT) is
   the "deep" whole-text measure ("compares meaning of whole text"). The deck itself
   never named which disagreement direction means what -- that derivation is
   `355-ORIGIN-CONCEPT.md` section 3's own contribution, not the deck's.
2. The two phrases exactly as shipped in `DIRECTION_MEANING` by plan 355-01:
   - `structural_transfer`: "same meaning in different words"
   - `semantic_implementation`: "same words with different meaning"
3. The none phrase used for whitespace zones and find-connections bridges (D-49),
   where no (lsa, semantic) pair exists to compare:
   - `NONE_MEANING`: "no wording signal measured"
4. The one-line meaning of each wire id: `structural_transfer` fires when semantic
   similarity measures higher than lexical similarity (the vocabulary bridge -- two
   fields describing one structure with disjoint terms); `semantic_implementation`
   fires when lexical similarity measures higher or equal to semantic similarity
   (the false friend -- shared vocabulary, different meaning).

## The ruling

**Confirmed.** All three phrases are approved exactly as shipped in
`lib/core/direction-convention.cjs` by plan 355-01. No replacement wording was given
for any of the three. `DIRECTION_MEANING` and `NONE_MEANING` stay byte-identical to
what plan 355-01 landed.

| Wire id | Confirmed phrase |
|---------|-------------------|
| `structural_transfer` | "same meaning in different words" |
| `semantic_implementation` | "same words with different meaning" |
| `none` (`NONE_MEANING`) | "no wording signal measured" |

## Phrase hash

`fba76597996550770774995f22602eb220054e2615a4d6e77212c01bc09cfe16`

Recomputed live at the point of this recording via:

```
node -e "const d=require('./lib/core/direction-convention.cjs');console.log(d.phraseHash())"
```

and found identical to the hash printed at the moment the checkpoint answer was given
(no drift between confirmation and stamping). This value is stamped into the module's
`PHRASES_CONFIRMED.phrase_hash` export and pinned by an equality assertion in
`tests/test-355-direction-convention.cjs` (`PHRASES_CONFIRMED.phrase_hash === phraseHash()`).

## The deck quote these phrases paraphrase

`355-ORIGIN-CONCEPT.md` section 3, "Read against the two notes filed today":

> The sign convention was never in the concept. The deck says "highest difference"
> and stops. It does not say which direction means what... today `rs-math.cjs`,
> `hsi-lsa.cjs` and `detect-reverse-salients.py` disagree on which sign is which. The
> honesty pass in Phase 355 should not pick a convention by majority vote of the code;
> it should derive the two directions from the deck's own semantics.

And section 1, slide 3 ("Two measures of similarity"): Latent Semantic Analysis,
"shallow" -- unsupervised word co-occurrence, "compares words". Semantic Textual
Similarity with a BERT transformer, "deep" -- similarity over the entire abstract at
once, "compares meaning of whole text".

## Binding effect

Any change to any of these three phrases after this ruling requires a NEW ruling
(a fresh PWS-author confirmation, a fresh date, a fresh phrase hash) and invalidates
every `direction_ok` label computed under the old hash (D-35). The equality assertion
in `tests/test-355-direction-convention.cjs` fails loudly the moment `phraseHash()`
diverges from `PHRASES_CONFIRMED.phrase_hash`, so a silent phrase edit cannot ship
without also updating this record and re-running the confirmation step.
