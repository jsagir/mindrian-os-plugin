# Note: Additions to Theo's Adaptation List (Phase 262)

## 1. The Ask, Up Front

Add `scripts/check-flagship-floor.cjs` and `scripts/build-brain-census.cjs` to Theo's named
plugin adaptation list. Both are currently UNLISTED there - a genuine coverage gap this phase is
the one phase positioned to find, because Phase 262 is the only phase that actually runs the
floor gate.

The current 7-file list, so the recipient can see these two are additions to a known list rather
than a new one: `scripts/probe-brain-contract.cjs`, `lib/brain/chain-recommender.cjs`,
`lib/core/enrichment-queue.cjs`, `bin/mindrian-brain-mcp-client.cjs`,
`lib/core/resolve-brain-key.cjs`, `data/brain-surface-contract.json`, and
`BRAIN_TOOL_MATCHER` / `hooks/hooks.json`.

## 2. The Break, Precisely

The floor gate reads exactly two paths: `result.canonical_matches` (from
`normalize_framework_name`) and `result.readiness.readiness_score` (from
`orchestration_readiness`). Theo returns `{canonical, matched_via, coverage}` for the first tool
and `{framework, score, inputs, evidence, unsynced_inputs, coverage, diagnostics}` for the
second. Both reads degrade to `null` against Theo's shapes: `Array.isArray(undefined)` is
false, and `result.readiness` is undefined on Theo's payload. Both calls still report `ok: true`
- the transport succeeds, only the shape is unrecognized - so no `failures[]` entry was produced
before Plan 262-02's fix, and the VOID branch never fired.

Composed outcome before Phase 262's change: every one of the 28 enumerated frameworks would
read as a MISS, giving `0/28 PASS`, exit 1, `FLOOR DOES NOT HOLD`, indistinguishable from a
genuinely red floor. Theo's own documentation names this exact class "the single highest-risk
line": a consumer would have to notice that queries which used to return rows now consistently
return none, not see a crash or a type error.

## 3. Why the Already-Shipped Theo Fix Does Not Cover This

`lib/core/brain-client.cjs`'s `query()` was fixed for Theo's `{rows, diagnostics}` shape
(commits `719f4499` RED, `21fdd7bc` GREEN). The floor gate does not use `brain-client.cjs` at
all: `check-flagship-floor.cjs` imports `brainCall` from `scripts/build-brain-census.cjs`, which
requires only `node:fs`, `node:path`, and `lib/core/resolve-brain-key.cjs` - an independent
direct-fetch client for two entirely different tools than the ones `query()` wraps.

## 4. What Phase 262 Already Did, and What It Deliberately Did Not

Phase 262 added a fourth, small, additive tripwire (D-04): `probeFramework` now treats a
successful call whose payload it cannot read (a `null` `normalizeMatches` or `readinessScore`
where `ok === true`) as a new `failures[]` entry with `kind: 'unrecognized_shape'`, routing
through the existing VOID machinery (banner, exit 3, per-row detail, mandatory human re-run)
unchanged. The exact shape, quoted from `262-02-SUMMARY.md`:

```
{ probe: 'normalize', kind: 'unrecognized_shape', httpStatus: 200,
  detail: 'normalize_framework_name payload carried no numeric canonical_matches length; ...' }
{ probe: 'readiness', kind: 'unrecognized_shape', httpStatus: 200,
  detail: 'orchestration_readiness payload carried no numeric readiness.readiness_score; ...' }
```

This closes the silent-false-RED outcome named in Section 2: a post-flip run against Theo's real
shapes now VOIDs (banner, exit 3, mandatory human re-run) instead of silently reporting `0/28
PASS`.

What Phase 262 deliberately did NOT do: adapt the gate's readers to Theo's actual response
shape. `theo-mcp.onrender.com` returned `/health` 502 throughout this phase (measured
2026-09-02) and could not be exercised, so that adaptation is flip-day work and belongs with the
other 7 files on the list above, not with this phase's hermetic tripwire.

## 5. Three Consequences Theo's Side Should Price In

1. **`pattern_known` is hardcoded into `unsynced_inputs` unconditionally.** Theo's
   `orchestration-readiness.ts` (around lines 485-505) always emits `unsynced_inputs:
   ['pattern_known']`, regardless of the actual graph state. This caps readiness at 3 of 4 for
   every framework in the population, leaving the floor's `>= 3` threshold with zero headroom.
   The floor gets strictly harder to keep green after the flip, not easier.
2. **`brain_write` refuses unconditionally on Theo, with no write path behind it.** Every
   FLOOR-01 graph remediation this phase's work order names must land on the incumbent Brain
   BEFORE the flip, or be re-expressed as a Theo-side ingestion through Theo's own Phase 10
   framework-ingestion contract. This turns "schedule a window sometime" into a dated deadline
   rather than an open-ended one.
3. **The populations differ, and whether all 28 ratified floor names resolve on Theo is
   unmeasured and unmeasurable until the origin serves.** Theo's measured framework count
   (149, as of 2026-08-31) is smaller than the incumbent's 258 `:Framework` nodes the 28-name
   set was ratified against on 2026-08-11. Tag this as assumption A7 and name it a navigator
   re-ratification question against Theo's population, not an engineering one.

## 6. Delivery

This note is addressed to the parallel Theo-working session ("Brain-Theo graph reconciliation
execution"). Check for a reply there before assuming the open question about starting
plugin-side adaptation is still unanswered.

This is a message, not a code change. Nothing in `/home/jsagi/Theo/` was created or edited to
produce this note; every Theo-side file this note cites
(`src/mcp/content/normalize-framework-name.ts`,
`src/mcp/content/orchestration-readiness.ts`) was read only.
