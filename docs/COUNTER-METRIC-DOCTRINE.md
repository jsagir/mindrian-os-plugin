# The Counter-Metric Doctrine

Phase 343 Plan 04 (CENSUS-08, WD-8, WD-9). This document states the rule that
every optimizing sensor or reach in this repository must declare a paired
watcher, names the one enforcement point that makes the rule real rather than
aspirational, carries the counting rule the first pair inherits verbatim, and
reads the first pair honestly.

## 1. The rule

Every sensor or reach that optimizes a quantity declares its paired watcher:
a second quantity that would catch the first one being pushed up without
limit. The declaration lives on the sensor's own record in
`lib/core/sensors/sensor-priority.cjs`, one home per fact, not a second table
that could drift out of step with the first. The build gate
(`scripts/build-connector-registry.cjs`'s `sensorPriorityCompletenessErrors`
function) fails closed on a missing declaration, so the rule is enforced
rather than requested: a sensor cannot ship without a pairing, in either
direction.

## 2. What a pair is

Each record in `SENS_PRIORITY` carries three relevant fields:

- `optimizes` -- a short noun phrase naming the quantity this sensor's firing
  pushes up, or explicit `null`.
- `watched_by` -- a short noun phrase naming the counter quantity that would
  catch that optimization going wrong, or explicit `null`.
- `why` -- one line stating the failure mode in plain language.

The authoring rule: `optimizes` names what more firing produces, `watched_by`
names the quantity that degrades if the first is maximized without limit, and
`why` states the failure in one line. Worked example, carried verbatim from
the sensor-priority.cjs header: SENS-06 (`artifact-filed`) optimizes the count
of artifacts filed; it is watched by the count of filed artifacts that are
later contradicted or never cited; the why is that an assistant rewarded for
filing will file more and worse.

`null` is a declaration, not a gap. An absent key is a build failure. The
distinction matters because a sensor nobody has thought about and a sensor
deliberately exempted from pairing must never look the same to a later
reader: the first is an oversight waiting to be found, the second is a
reasoned call with its own stated `why`. Two of the twenty sensors ship
`optimizes: null, watched_by: null` today: SENS-01 (`first-material`), a
one-shot structural turn-position fact rather than a quantity repeated firing
can push up, and SENS-05 (`jtbd-reweight`), a derived reweight of other
sensors' scores that is not itself a reach shown to the navigator.

## 3. The counting rule, inherited verbatim

`data/harness-policies/_schema.json`'s `_doc.promotion_rule_doc.counting_rule`
contributes one sentence this doctrine depends on, quoted exactly, source
named:

> "A JSONL row whose result is still the default 'fire' (unlabeled)
> counts as NEITHER a true positive NOR a false positive. Counting unlabeled
> rows as an implicit true positive, or excluding them from the denominator
> in a way that makes an unreviewed log read as a zero-percent false-positive
> rate, auto-satisfies any threshold and manufactures a false success."

It transfers because the filing-versus-contradiction pair has the same
failure mode a promotion verdict has: an unread log and a clean log are
indistinguishable from the count alone, and a verdict of MET on a log nobody
has read is always wrong.

## 4. The first pair, and how to read it

The first pair this doctrine ships (WD-9): claims filed, versus claims
carrying a `CONTRADICTS` edge, versus claims that are no edge's target.

The 2026-09-14 measured reading: 7,794 claims filed, 0 contradicted, 7,791
never cited. The honest interpretation: this means the filing metric and the
citation metric have decoupled. It does NOT mean the claims are wrong, and
this doctrine does not say so.

The counting rule's consequence, stated in one line: 0 contradicted reads as
"nobody has contradicted anything," never as a perfect score. Without the
counting rule, a reader sees "0 contradicted" and assumes the graph's claims
are clean. With it, the same number reads as an unread log, which is the
truth measured here: 7,791 of 7,794 claims are not the target of any edge at
all, so there has been no opportunity for a contradiction to register, let
alone a confirmation.

Drift warning: these numbers are a snapshot from 2026-09-14. Re-measure
before quoting them in any later plan, summary, or doctor run; do not copy
them forward as if they were current.

## 5. What this doctrine does not do

- It sets no threshold. A threshold is a health claim, and SEED-074's guard
  against unearned health and risk claims is deliberately not opened here.
- It produces no score. A divergence rendered as a single number invites
  exactly the optimization this rule exists to catch: a number that can be
  maximized in isolation, disconnected from what it was meant to represent.
- It never rides a reach. The pairing is metadata about a sensor, authored
  once in `lib/core/sensors/sensor-priority.cjs`, and must never appear in a
  reach's `evidence` bag: that would cross the Canon Part 8 boundary this
  file already respects (a frozen in-repo literal, derived from no turn
  text, room content, or user-suppliable value).

## 6. Named assumptions

Two assumptions from the `langtalks-graph-expert` consult (2026-09-14),
carried as assumptions, not as findings:

- ASSUMED (2026-09-14): the langtalks corpus reaches agent-evaluation
  literature only through `Memory`, four hops from the counter-metric
  concept; the specific pairing this doctrine authors, claims filed versus
  claims later contradicted or never cited, has no corpus precedent of its
  own and is this phase's own engineering decision, not a corpus-grounded
  pattern.
- ASSUMED (2026-09-14): nothing in the corpus pairs a filing metric with a
  contradiction or citation counter-metric anywhere; the pairing shape
  (a quantity plus its watcher, both keyed on one sensor id) is derived from
  the graph-engineering note's counter-metric-reviewer-node citation
  (4515:4598), not from a second, independent corpus source.

One still-open navigator question, marked OPEN, not answered here: what
divergence ratio between the filed count and the contradicted-or-cited count
counts as a finding worth surfacing, rather than a passive count sitting in
a doctor report. `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md` Section 6 tracks
this question and names `343-05-PLAN.md` as the plan it affects.

## 7. Measured, 2026-09-14: the shipped organ's fleet reading

Phase 343 Plan 05 (CENSUS-09) ships the computation this doctrine's Section 4
described in prose: `lib/core/navigation/claim-counter-metric.cjs` is the
statement home, `countClaimCounterMetric(db)` is the function, and
`lib/core/doctor/room-graph-integrity-module.cjs` reports its four counts
and its divergence boolean per room and as three room-counts in
`totals.claim_counter_metric`. This is the computation SENS-06's own
`watched_by` record in `lib/core/sensors/sensor-priority.cjs` names: SENS-06
(`artifact-filed`) optimizes the count of artifacts filed and is watched by
the count of filed artifacts that are later contradicted or never cited.
The declaration and the number now name each other in both directions.

The reading, produced by running the shipped organ against the live fleet
at execution time (`require('./lib/core/doctor/room-graph-integrity-module.cjs').check({flags:{cascadeRooms:true}})`,
the exact function `scripts/doctor.cjs`'s accumulative engine calls for this
module's `runner` entry): 55 rooms measured, of which 46 carried a
`claim_counter_metric` result (9 have no `room.db` yet, Tier 0). Of those
46: `claims_filed` 7,836, `claims_filed_past_citation_lag` 7,028 (18 rooms
could not answer the window question and are excluded from that sum, never
coerced to zero), `claims_with_contradicts_edge` 0,
`claims_no_incoming_edge_past_citation_lag` 7,026. Per room, the divergence
boolean split three ways: `rooms_diverged` 12, `rooms_not_diverged` 16,
`rooms_not_measurable` 18.

What this means: the filing metric and the citation metric are still
decoupled fleet-wide (0 contradicted, 7,026 of 7,028 past-lag claims
uncited), and that split is now visible per room rather than only as one
fleet-wide figure. It does NOT mean the 12 diverged rooms hold wrong
claims, and it does NOT mean the 16 not-diverged rooms are in any
particular condition: `rooms_not_diverged` includes both a room with a
real contradiction on record and a room where nothing has been filed past
the lag yet, and the boolean alone does not distinguish them.

Drift from the Section 4 research-time snapshot (7,794 filed, 0
contradicted, 7,791 never cited), stated rather than silently overwritten:
the fleet count grew from 46 to 55 registered rooms between the two
readings (rooms drift with every session that registers or files a claim),
and the "never cited" figure in Section 4 was a napkin count over the
research SQL rather than the shipped organ's citation-lag-gated statement,
which additionally excludes 18 rooms from the window count as
not-measurable instead of folding them into either side. The two figures
are close because the underlying graph has not changed shape, not because
they are the same measurement.

Deviation, recorded per this plan's own instruction to say so rather than
paper over it: `node scripts/doctor.cjs --json --cascade-rooms`, the
command this plan's acceptance criteria names, does NOT surface
`claim_counter_metric` in this environment, for a reason unrelated to this
plan's own code. `scripts/doctor.cjs`'s accumulative engine resolves the
"running" version via the LOCAL marketplace-cache install
(`~/.claude/plugins/cache/...`), which is pinned at `2.0.0-beta.37` on this
machine; `room-graph-integrity` (like `icm-part-wiring` from Phase 344,
confirming this is not specific to this plan) is registered at
`introduced_version: 2.0.0-beta.40` and is therefore DEFERRED by the
engine's own version-skew guard regardless of `--cascade-rooms` or `--all`.
This reading was instead produced by requiring
`lib/core/doctor/room-graph-integrity-module.cjs` directly and calling its
exported `check(ctx)`, the byte-identical function the engine's
`resolveAlwaysRunner` would invoke once the local marketplace cache catches
up to this repo's own version. The command and its exact output are
recorded in `343-05-SUMMARY.md`.
