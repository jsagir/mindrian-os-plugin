# Phase 89.1a Deferred Items

Items discovered during Phase 89.1a execution that are out-of-scope for this phase and deferred to a downstream phase.

## 1. brain-client search response shape mismatch with pullFromBrain

**Discovered during:** Plan 89.1a-04 Task 2 (live Brain smoke test)
**Severity:** non-blocking for Phase 89.1a close; blocking for Phase 89.1 consumer
**Phase to own:** 89.1 (domain analysis consumer) or 89.5 (engine orchestrator)

**Observation:**

Direct probe of `lib/core/brain-client.cjs::search('*', {namespace, topK})` against the production Brain endpoint returns:

```
{
  result: {
    hits: [
      { _id, _score, fields: { framework, title, content_hash, text, tier, source_file, ... } },
      ...
    ]
  },
  usage: {...}
}
```

`lib/core/rs-brain-substrate.cjs::pullFromBrain` expects:

```
{
  matches: [
    { id, values: [1024 floats], metadata: { framework_name, ... } },
    ...
  ]
}
```

Shape mismatches observed:

1. `result.matches` does not exist; actual path is `result.result.hits`.
2. Hits carry `fields` not `metadata`; field names are `framework`, `title` not `framework_name`.
3. Hits do NOT carry `values` (no 1024-dim vector returned on default search; vector embeddings require a different query path, likely a direct Pinecone call with include_values=true).

**Consequence:**

Under live Brain conditions, pullFromBrain falls through to `{ok: false, reason: 'malformed_response'}`, and loadSubstrate correctly graceful-degrades to Mode B3 (tier-0 empty substrate + warning). The architectural invariants I1 (Canon Part 8), I3 (atomic write), I4 (never throws), I5 (frozen mode enum), I7 (chokepoint) all hold correctly. What does NOT work: Mode A3 happy-path cache write with 1024-dim embeddings.

**Proposed remediation (for the owning phase):**

Two options, pick one:

1. **Shape adapter inside pullFromBrain.** Translate `result.result.hits[]` to `matches[]` with fetched-separately `values`. This requires either a follow-up brain-client call per hit (expensive for 1,427 embeddings) or a single bulk-fetch with include_values.
2. **New brain-client method.** Expose `brain-client::searchWithVectors(query, {namespace, topK, include_values: true})` that wraps a raw Pinecone query with include_values=true. Simpler caller contract, but requires brain-client surface expansion.

Either path preserves Canon Part 8 (same chokepoint, same allow-list, same preSendAudit). Neither introduces new runtime deps.

**Evidence:**

See `.planning/phases/89.1a-brain-methodology-substrate-loader/89.1a-LIVE-BRAIN-SMOKE.md` sections "Observed vs Expected" and "What This Smoke Did NOT Prove".

**Status:** filed 2026-04-24; awaiting Phase 89.1 planner pickup.
