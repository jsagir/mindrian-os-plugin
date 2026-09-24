# Handoff: Phase 355 results the Theo-side asked for (M-side to T-side), 2026-09-25

Status: durable entry per the M-T coordination protocol (`~/Theo/docs/M-T-COORDINATION-PROTOCOL.md`,
Section 5 of the original seams handoff: "After 355's verification: a dated entry with the measured
unverified rate, hub-inflation share, per-tier hit rate and the fixture rooms used"). Nothing here
edits Theo; every number below is a dated read from this repo's own Phase 355 artifacts, not a live
Theo measurement taken today -- re-measure before acting, per the protocol's own rule.

Owner (M-side): Phase 355, now CLOSED, `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/`.
Requested by: `docs/2026-09-23-HANDOFF-theo-phase-355-seams.md`'s own Section 5 ("What M-side sends
back, and when").
Live ping: no T-side session was identifiable at filing time; this file is the durable record, and
the ping follows when one appears (see the `ListAgents` note below).

## 1. To T-3 (canon coverage for cross-domain structure)

The seams handoff's T-3 ask: "the unverified rate and the hub-inflation share" measured on fixture
rooms, sent back as canon-coverage evidence, not a phase failure. Measured 2026-09-24/25 on three
Claude-authored fixture rooms (`tests/fixtures/355-rooms/`, business/operations ventures, never a
real user room):

| Room | Shape | Shown pairings |
|---|---|---|
| `room-ill-defined` | rural clinics losing patients between referral and follow-up | 32 |
| `room-extend` | a working cold-chain delivery service looking at an adjacent use | 26 |
| `room-control` | four distant domains with planted meaning bridges and false friends | 38 |

96 distinct pairings total (deduplicated across the HSI and reverse-salient producers, at most 30
per producer per room, similarity floor 0.2 -- lower than the engines' own 0.3 default, needed to
reach 20 shown pairings per room; eureka showed nothing, substrate unavailable on plain-markdown
fixture text).

**Unverified rate:** 85.4% of stamped pairings (82 of 96) landed `unverified`. Reason mix behind
those 82:

| Reason | Count |
|---|---|
| `handle_unresolved` | 77 |
| `no_path_within_3_hops` | 4 |
| `no_lateral_relation` | 1 |

**Not_called share:** 80.2% -- for those pairings at least one side carried no canon Framework name
under the plugin's own D-48 exact-match rule (frontmatter `framework:`, then `methodology:` through
the command registry, then the title), so `find_connections` was never asked. That is a vocabulary
gap between fixture-room prose and canon names on the M-side, not a Theo outage.

**Hub-inflation share:** 4 of 13 strong stamps (30.8%) have a path interior crossing a top-decile-
degree node. Degree source is an in-sample proxy (interior-node frequency across the strong paths
in this one record, top decile) -- no governed Theo call returns node degree, so this is the best
signal available from this side. Top-decile interior node: "PWS Value Proposition" (crossed 4
times). A high share would mean a strong stamp mostly certifies one shared textbook node rather
than a real transfer.

**Provenance-routed strong count:** 0 (a lateral path that also crosses a `BrainRecord` node or a
`SOURCED_FROM` edge, per the seams handoff's RESEARCH C6 reference). Diversity: 5 distinct interior
nodes across 13 strong stamps (0.385).

**Per-tier hit rate** (the navigator's own blind judgment, "is this useful," joined to the stamp
tier after judging, so the stamp could not anchor the label):

| Tier | Useful / judged | Rate | 95% Wilson interval |
|---|---|---|---|
| strong | 7 / 13 | 53.8% | 29.1% to 76.8% |
| indirect | 0 / 1 | 0.0% | 0.0% to 79.3% |
| unverified | 36 / 82 | 43.9% | 33.7% to 54.7% |

Read against the unstamped baseline (43/96 pooled, 44.8%, 95% Wilson 35.2% to 54.7%): the strong
interval does not sit above the baseline, so on these three fixture rooms the tier carries no
measured signal yet. This is a fixture-room finding on a small n, not a claim about the tier rule
itself, and no rule was changed on the strength of it.

**Theo `find_connections` latency**, measured plugin-side through `brain-client.cjs` on the dev
machine (the first plugin-side latency measurement of this tool): p50 1580 ms, p95 1761 ms, over
165 timed calls (min 1544 ms, max 3385 ms, nearest-rank percentiles). Zero non-200 responses across
the capture.

**Snapshot coverage:** `data/framework-names.json`, 410 live canon Framework names, snapshot dated
2026-09-23, `source_sha256: 3935848a1641ed126f6d91cc5243e7f80068340a191573579108d8c77437ea53`. The
one live capture this phase ran (355-14/355-25) was resolved against this exact snapshot hash.

**Observation, an input not a request:** `ADDRESSES_PROBLEM_TYPE`-only and `SOURCED_FROM`-only
paths stamp `unverified` under this plugin's own D-49 lateral-relation rule (a stamp only verifies
on a lateral Framework-to-Framework hop; a path that only ever touches a problem-type or a
provenance edge does not count). That rule is a plugin-side design choice, not a Theo request --
named here because it is a real input to how much of the unverified rate above is canon-coverage
versus rule-shape.

## 2. To T-2 (the citation-check judgment policy, proven before the seam exists)

The seams handoff's T-2 proposed a judgment-enum seam with Theo as the Jev keyholder, gated on
Theo's own Phase 20 deciding the external-analytics seam. Per the navigator's ruling recorded
there ("calibrate now, dev-time only"), this phase measured the policy's own quality before any
seam exists, so a future T-2 registry entry can be minted from a proven policy rather than a
drafted one.

**The policy text, verbatim** (`CITATION_RULE`, `scripts/jev-question-ceilings.cjs`):

> Apply in this order. (1) If a hop in `path` states a relation opposite to the one `claim`
> asserts, answer contradicts. (2) Else if the hops, read in order, directly show the relation
> `claim` asserts, answer supports. (3) Else answer says_nothing. A path that joins the two
> frameworks only through a broad shared node (a problem type, a stage, a general category) says
> nothing.

**Measured stated-vs-withheld agreement** (43 templated `{claim, path}` items, Jev model
`jev-1.13.0` pinned, zero network calls made from this file, offline replay only):

| Variant | Exact agreement with gold | Auto-verdict slice (confidence >= 0.8) |
|---|---|---|
| stated | 41/43 (95.35%) | 23/23 correct (100.00%) |
| withheld | 25/43 (58.14%) | 10/12 correct (83.33%) |

Stating the rule roughly doubles exact agreement (58.14% -> 95.35%) and roughly doubles the auto-
verdict slice's own coverage (27.91% -> 53.49%), while also raising that slice's accuracy (83.33%
-> 100.00%). This direction matches an earlier, unrelated item set's stated-vs-withheld finding
(the plugin's own spike work, 64/64 stated vs 40/64 withheld), now confirmed on a second,
phase-355-specific item set.

**Measured band:** high (`confidenceFromBucket({correct: 23, n: 23})` = high, >= 0.9, computed
from measured accuracy on this run -- never from Jev's own self-reported confidence number, per
this repo's own Tetlock-derived rule that a model's stated confidence is not evidence of its
accuracy).

**The future-seam rule, written down now, before any seam exists:** high band -> auto-verdict is
allowed at confidence >= 0.8; medium band -> every verdict goes to a human; low or unknown band ->
rewrite the question before this seam is used at all.

**Gold caveat, carried forward honestly:** the gold (`tests/fixtures/355-citation-pairs.json`) is
machine-labeled by an external model (`claude-opus-5.5`, `labeler_kind: external_model`) under a
navigator ruling, not the navigator's own blind labels (a real CLI defect blocked the navigator's
own sitting on this exact item set; root-caused and fixed within the same plan, not a change of
position). The gold's own verdict distribution across the 43 scored items is 35 `says_nothing` / 8
`contradicts` / 0 `supports` -- `supports` is structurally unreachable in this item set (no item
samples an `ALIAS_OF` path), so this calibration exercises a two-class effective gold, not the full
three-class schema `citation_check` itself supports. Every `contradicts` gold item is the synthetic
`contradicting` stratum this phase constructed itself, since Theo's canon returned zero naturally-
occurring `CONTRASTS_WITH` edges among the sampled pairs -- so the `contradicts` numbers above
measure Jev against a constructed contradiction, not one canon produced unprompted. A follow-up
item set sampling `ALIAS_OF` paths specifically is the natural next step if `supports` calibration
is wanted.

**No Jev verdict from this calibration reaches a runtime stamp.** `judge` stays the zod literal
`'none'` at runtime today; this is a dev-time measurement only, feeding this note.

## 3. To T-5 (backend field, and the description-mirror check)

The seams handoff's T-5 asked which field the plugin reads for "which graph answered" on
`find_connections`. Confirmed: the plugin sets the literal string `'theo'` itself
(`lib/core/verification-stamp.cjs`'s `BACKENDS = ['theo', 'unavailable', 'not_called']`, D-13/D-54)
-- it is not read back from a Theo response field today. This stands until Theo's own Phase 20 adds
a `served_as`/`backend` literal to `find_connections`'s success payload; when it does, the plugin
side should switch to reading it rather than asserting it.

Read-only Theo-side mirror check (355-05, `~/Theo/src` grepped for `scout-hsi` and
`whitespace_scan`, the two commands this phase's naming-honesty plan renamed the description of):
came back empty. Neither description is mirrored on the Theo side, so there is nothing to sync
here.

**Release-note item for the next plugin release** (out of this phase's own scope; recorded here
because `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`'s version-lockstep rule means the note itself
lands with the cut, not before): the direction convention is unified across every discovery engine
(one module, `lib/core/direction-convention.cjs`); stored HSI labels are re-derived from their
similarity pair at read time, never trusted from storage; `find_connections` narration on Claude
Desktop and Cowork is not yet checked live (D-50 -- Larry there narrates only a stamp a CLI run
already stored, and says "not yet checked" otherwise).

## 4. Boundaries of this handoff

- No cross-edits: nothing here touches `~/Theo`. `git -C ~/Theo status --short` shows nothing this
  session created.
- Numbers above are dated reads from Phase 355's own committed artifacts (355-VERIFICATION.md,
  355-JEV-MEASUREMENT.md, `tests/fixtures/355-rooms/hit-rate-record.json`,
  `tests/fixtures/355-theo-find-connections-responses.json`), not a live re-measurement taken
  today -- re-measure before acting, cite the call and the timestamp, per the M-T protocol.
- Live ping: `ListAgents` was checked at filing time; no T-side session was visible to ping. This
  file is the record regardless; a live ping is pending for the navigator to send when a T-side
  session next appears.
- Ship/flip/suspend stay human-held on both sides, unchanged from the seams handoff's own
  boundary section.
