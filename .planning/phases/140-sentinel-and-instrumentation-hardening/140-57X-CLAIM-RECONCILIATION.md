# D-01a: 57x-Claim Denominator Reconciliation (Phase 140-03)

**Produced:** 2026-06-05
**Requirement:** HARD-04 implication D-01a
**Author:** Phase 140-03 executor
**Status:** Reconciled. One release-process flag raised (see Section 5).

---

## 1. Why this note exists

HARD-04 / D-01 relaxed the query-efficiency telemetry gate so the PostToolUse
hook (`scripts/query-efficiency-telemetry.cjs`) now writes a JSONL line for
EVERY Read/Grep/Glob turn in a resolvable room, not only turns that carry a
`/mos:` command context. Before the fix the hook always `exitSilent()`ed
because nothing in the repo ever set the `/mos:` signal it gated on, so the
telemetry file logged 0 events.

The published efficiency claim is "up to 57x" (README + CHANGELOG, the
"57x claim defensibility gate" entry around CHANGELOG line 2052). That claim
was defined as a `/mos:`-command-specific number: it measures how much smaller
a targeted `/mos:*` query's returned payload is versus the naive
"read the whole room" baseline.

D-01a is the integrity guard: relaxing the gate to ALL turns changes the
DENOMINATOR the claim is measured against. Cheap, low-baseline Reads (a user
inspecting a single file with no `/mos:` flow) drag the all-turns median down.
If the release gate read the relaxed all-turns median as if it were the
published number, it would silently redefine a public claim. We do not do that.

## 2. What changed in the aggregator

`scripts/scout-telemetry-aggregator.cjs` gained a `--mos-only` flag and a
`filterCommandPopulation()` step:

- **Default (no flag):** reports the new ALL-TURNS population (the relaxed
  denominator). This is the honest measure of overall query efficiency.
- **`--mos-only`:** restricts the median / top-5 / threshold-status to records
  whose `command` field starts with `/mos:` -- the SAME population the "up to
  57x" claim was defined against.

`RELEASE_GATE_THRESHOLD_X` is UNCHANGED at 40. Both views are always
available; neither overwrites the other.

## 3. Measurement on this box: NO_DATA

`~/.mindrian/telemetry/query-efficiency.jsonl` does NOT exist on the
plugin-dev box at reconciliation time (verified -- this matches the original
HARD-04 symptom: the gate never opened, so nothing was ever written). With no
JSONL, both runs report NO_DATA:

```
$ node scripts/scout-telemetry-aggregator.cjs --all
query efficiency telemetry summary (all-time, all turns)
  events: 0
  threshold status: NO_DATA

$ node scripts/scout-telemetry-aggregator.cjs --all --mos-only
query efficiency telemetry summary (all-time, /mos: turns only)
  events: 0
  threshold status: NO_DATA
```

So on THIS box there is no live all-turns-vs-/mos:-only delta to report yet --
the relaxed gate has not accumulated real traffic. The relaxation is what
makes accumulation possible going forward.

## 4. Synthetic proof the denominator shift is real and material

Because there is no live data, the denominator concern was validated with a
controlled synthetic JSONL (2 high-ratio `/mos:` turns + 2 cheap non-`/mos:`
Reads) against the new aggregator:

| Population | count | median | threshold status |
|-----------|-------|--------|------------------|
| all-turns | 4     | 26.5x  | RETUNE (< 40x)   |
| /mos:-only | 2    | 53.5x  | PASS (>= 40x)    |

The all-turns median (26.5x) falls BELOW the 40x release gate purely because
of the cheap non-`/mos:` Reads, while the `/mos:`-only median (53.5x) clears
it. This confirms: **the relaxed all-turns denominator can materially change
the headline number, so the published "up to 57x" claim MUST be read against
the `/mos:`-only population.** The `--mos-only` flag is the mechanism that
keeps that read available.

## 5. Release-process flag (the one follow-up this note raises)

ACTION FOR THE RELEASE PROCESS (not a Phase 140 code task):

> When the v1.13.1 (or any future) release "consumes the 57x claim before
> tagging," it MUST run the aggregator with **`--mos-only`** to validate the
> published "up to 57x" number. Reading the bare (all-turns) median as the
> claim's evidence would understate efficiency and could trigger a spurious
> RETUNE. The claim's denominator is the `/mos:` command population; the gate
> must measure it on that population.

The claim LANGUAGE itself ("up to 57x") does NOT need to change as a result of
the gate relaxation -- it remains a `/mos:`-specific claim and is still
measurable as such via `--mos-only`. Per CONTEXT Deferred Ideas, any actual
rewrite of README / CHANGELOG copy is a deferred release/docs concern and is
explicitly OUT OF SCOPE here; this note only surfaces the need and the exact
command the release gate should run. No copy was rewritten by this task.

## 6. Canon Part 8 confirmation

The relaxed gate adds no new JSONL field and no network surface. The line
still carries exactly the eight scalar fields (event, ts, command, tool,
tokens_used, tokens_naive_estimate, ratio, room_slug); `command` is `''` for
an all-turns turn. The aggregator reads only the LOCAL JSONL and emits scalars.
Part 8: clear.
