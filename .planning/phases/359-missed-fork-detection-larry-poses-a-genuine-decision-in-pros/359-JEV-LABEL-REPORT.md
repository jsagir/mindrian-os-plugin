# Phase 357 Jev Label Report

Run timestamp: 2026-09-24T13:37:43.575Z
Model: jev-latest
Policy sha256: 3f220267e874d7cdecac69dacc8a4941d799495a0c6bca04163dc25d9dd87924
Thresholds: yes >= 0.8, no <= 0.2, otherwise uncertain
Counts by agreement: no=17, yes=19

Jev labels are never auto-applied; every disagreement below needs a navigator ruling (D-12).

| id | source | hand | is_fork | already_answered | relevant | verdict | agree |
|----|--------|------|---------|-------------------|----------|---------|-------|
| syn359-fork-01 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-02 | synthetic-359 | block | yes | uncertain | no | pass | no |
| syn359-fork-03 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-04 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-05 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-06 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-07 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-08 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-09 | synthetic-359 | block | uncertain | no | no | pass | no |
| syn359-fork-10 | synthetic-359 | block | uncertain | no | no | pass | no |
| syn359-fork-11 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-12 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-13 | synthetic-359 | block | uncertain | no | no | pass | no |
| syn359-fork-14 | synthetic-359 | block | uncertain | no | no | pass | no |
| syn359-fork-15 | synthetic-359 | block | uncertain | no | no | pass | no |
| syn359-fork-16 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-fork-17 | synthetic-359 | block | yes | no | no | pass | no |
| syn359-ctrl-01 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-02 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-03 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-04 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-05 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-06 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-07 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-08 | synthetic-359 | pass | uncertain | no | no | pass | yes |
| syn359-ctrl-09 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-10 | synthetic-359 | pass | no | uncertain | no | pass | yes |
| syn359-ctrl-11 | synthetic-359 | pass | no | uncertain | no | pass | yes |
| syn359-ctrl-12 | synthetic-359 | pass | no | no | no | pass | yes |
| syn359-ctrl-13 | synthetic-359 | pass | uncertain | no | no | pass | yes |
| syn359-ctrl-14 | synthetic-359 | pass | yes | no | no | pass | yes |
| syn359-ctrl-15 | synthetic-359 | pass | yes | no | no | pass | yes |
| syn359-ctrl-16 | synthetic-359 | pass | yes | no | no | pass | yes |
| syn359-ctrl-17 | synthetic-359 | pass | yes | no | no | pass | yes |
| syn359-ctrl-18 | synthetic-359 | pass | yes | no | no | pass | yes |
| syn359-ctrl-19 | synthetic-359 | pass | yes | no | no | pass | yes |

## Disagreements for navigator ruling

- syn359-fork-01
- syn359-fork-02
- syn359-fork-03
- syn359-fork-04
- syn359-fork-05
- syn359-fork-06
- syn359-fork-07
- syn359-fork-08
- syn359-fork-09
- syn359-fork-10
- syn359-fork-11
- syn359-fork-12
- syn359-fork-13
- syn359-fork-14
- syn359-fork-15
- syn359-fork-16
- syn359-fork-17
## is_fork vs prose_fork (359)

Computed from this run rows, per synthetic-359 entry, comparing the is_fork Noul mapping against the hand prose_fork label. Nothing here is auto-applied (D-20). No entry text.

| id | prose_fork (hand) | is_fork (Jev) | result |
|----|--------------------|----------------|--------|
| syn359-fork-01 | true | yes | agree |
| syn359-fork-02 | true | yes | agree |
| syn359-fork-03 | true | yes | agree |
| syn359-fork-04 | true | yes | agree |
| syn359-fork-05 | true | yes | agree |
| syn359-fork-06 | true | yes | agree |
| syn359-fork-07 | true | yes | agree |
| syn359-fork-08 | true | yes | agree |
| syn359-fork-09 | true | uncertain | uncertain |
| syn359-fork-10 | true | uncertain | uncertain |
| syn359-fork-11 | true | yes | agree |
| syn359-fork-12 | true | yes | agree |
| syn359-fork-13 | true | uncertain | uncertain |
| syn359-fork-14 | true | uncertain | uncertain |
| syn359-fork-15 | true | uncertain | uncertain |
| syn359-fork-16 | true | yes | agree |
| syn359-fork-17 | true | yes | agree |
| syn359-ctrl-01 | false | no | agree |
| syn359-ctrl-02 | false | no | agree |
| syn359-ctrl-03 | false | no | agree |
| syn359-ctrl-04 | false | no | agree |
| syn359-ctrl-05 | false | no | agree |
| syn359-ctrl-06 | false | no | agree |
| syn359-ctrl-07 | false | no | agree |
| syn359-ctrl-08 | false | uncertain | uncertain |
| syn359-ctrl-09 | false | no | agree |
| syn359-ctrl-10 | false | no | agree |
| syn359-ctrl-11 | false | no | agree |
| syn359-ctrl-12 | false | no | agree |
| syn359-ctrl-13 | false | uncertain | uncertain |
| syn359-ctrl-14 | false | yes | disagreement |
| syn359-ctrl-15 | false | yes | disagreement |
| syn359-ctrl-16 | false | yes | disagreement |
| syn359-ctrl-17 | false | yes | disagreement |
| syn359-ctrl-18 | false | yes | disagreement |
| syn359-ctrl-19 | false | yes | disagreement |

Counts: agree=23, disagreement=6, uncertain=7 (sums to 36 of 36 synthetic-359 entries).

Disagreement ids (prose_fork true & is_fork no, or prose_fork false & is_fork yes):
- syn359-ctrl-14
- syn359-ctrl-15
- syn359-ctrl-16
- syn359-ctrl-17
- syn359-ctrl-18
- syn359-ctrl-19

Uncertain ids (is_fork mapped uncertain):
- syn359-fork-09
- syn359-fork-10
- syn359-fork-13
- syn359-fork-14
- syn359-fork-15
- syn359-ctrl-08
- syn359-ctrl-13

Nothing above is auto-applied to any fixture; every disagreement and uncertain id needs a navigator ruling (D-20).

