# Phase 354 Plan 12 -- Theo Integration Evidence

This file is the evidence record for THEO-01 (live certification), THEO-03
(live certification), and THEO-02 (release registry synchronization
disposition). It is appended to by each of this plan's tasks; nothing in it
is deleted or overwritten by a later task.

CTX-THEO-READONLY holds throughout: no write, deploy, dispatch or workflow
change was made to `/home/jsagi/Theo` in the production of this file.

---

## Live contract run

**Command:** `MINDRIAN_354_LIVE=1 node tests/test-354-theo-live-contract.cjs`

**Exit status:** `0` (full pass -- every one of the 9 live records asserted
`ok: true`)

**Duration:** ~11s wall clock (measured around the command)

**Environment:**
- Started (UTC): `2026-09-23T13:20:06Z`
- Node version: `v22.23.1`
- Repo HEAD at run time: `91e5397c2`
- Origin (default `lib/core/brain-client.cjs` URL, no override):
  `https://theo-mcp.onrender.com`
- Auth: `MINDRIAN_BRAIN_KEY` already resolved in this session's environment
  (no auto-registration attempt was needed; `ensureAvailable()` returned
  `true` on the first, synchronous `isAvailable()` check)
- Provider build/version: **not exposed** -- `brain_stats()` (the one
  read-only call `lib/core/brain-client.cjs` already wraps) returns
  `{ nodes, relationships, labels[], diagnostics }` and carries no
  `version`/`build`/`schema_version`/`graphrag_version` field of any kind on
  the live origin. Honestly recorded as `not exposed`, not fabricated.

**This run DID reach the live integration.** THEO-01 and THEO-03's live
certification clause is satisfied by this run, not merely by the hermetic
`tests/test-354-theo-journey.cjs` suite (Task 1) -- per the plan's own
truth: "a mock-only pass cannot certify the live integration."

### JSON records (9 total: 4 `recommend_chain` + 4 `taxonomy_ladder` + 1 `brain_ask`)

Argument values sent were, in every one of the 9 calls, one of: a closed
Theo rung enum (`UnDefined`/`IllDefined`/`WellDefined`/`Wicked`), the bare
integer `4`, or the single literal generic question string named in the
plan ("Which framework fits an ill-defined problem at the discovery
stage?"). No room path, no room content, no fs.readFileSync of any kind
crossed into any argument (confirmed: `grep -cE "fs\.readFileSync\("
tests/test-354-theo-live-contract.cjs` prints `0`).

```json
{"probe":"theo-live-contract-354-12","origin":"https://theo-mcp.onrender.com","node_version":"v22.23.1","provider_build":"not exposed","stats_digest":{"top_level_keys":["nodes","relationships","labels","diagnostics"],"array_lengths":{"labels":15}},"record_count":9,"all_ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:06.817Z","duration_ms":2060,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"UnDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Red Teaming","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:08.878Z","duration_ms":837,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"IllDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Design Thinking","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:09.715Z","duration_ms":1599,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"WellDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Red Teaming","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:11.314Z","duration_ms":849,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"Wicked","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Six Thinking Hats","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.163Z","duration_ms":268,"argument_keys":["rung"],"argument_values":{"rung":"UnDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"UnDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.431Z","duration_ms":245,"argument_keys":["rung"],"argument_values":{"rung":"IllDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"IllDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.676Z","duration_ms":219,"argument_keys":["rung"],"argument_values":{"rung":"WellDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"WellDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.895Z","duration_ms":221,"argument_keys":["rung"],"argument_values":{"rung":"Wicked"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"Wicked","threw":null,"ok":true}
{"tool":"brain_ask","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:13.116Z","duration_ms":3130,"argument_keys":["question","problem_type"],"argument_values":{"question":"Which framework fits an ill-defined problem at the discovery stage?","problem_type":"IllDefined"},"digest":{"top_level_keys":["answer_mode","rows","search_mode","effective_top_k","diagnostics","directive","next_gate","grounding"],"array_lengths":{"rows":8}},"first_framework_name":"Red Teaming","grounding_problem_type":"IllDefined","grounding_rung_source":"structured","threw":null,"ok":true}
```

### What each assertion proved, live

- **`recommend_chain` x4** (one per rung): every call returned an array
  `chain` (never a thrown exception, never an unhandled malformed shape).
  Each chain carried 4 ranked framework steps with a real framework name in
  first position (`Red Teaming`, `Design Thinking`, `Red Teaming`,
  `Six Thinking Hats` respectively -- genuinely different top candidates per
  rung, proof the origin is actually differentiating on the rung argument,
  not returning a static payload).
- **`taxonomy_ladder` x4** (one per Theo rung id): every call returned the
  real live shape (`{ rung, question_label, rungs: [{id, gloss, marked}],
  ladder }`) with `rungs` always length 4, and in every case EXACTLY one
  entry had `marked: true` and its `id` equaled the requested rung -- the
  taxonomy-casing fix (354-10) is proven live, not only against the local
  read-only `vocabulary.ts` checkout copy that plan's own regression used.
- **`brain_ask`** with `{ problem_type: 'IllDefined' }`: the composed
  envelope's `grounding.problem_type` read `'IllDefined'` and
  `grounding.rung_source` read `'structured'` -- proof the classification
  round-trip fix (354-09) carries the caller's already-known classification
  onto the live wire and through Theo's real composition, rather than
  falling back to `_inferRungFromQuestion`'s text heuristic (which would
  read `rung_source: 'inferred'`).

**THEO-01 and THEO-03 live certification: CLOSED by this run** (in addition
to the hermetic four-case proof in `tests/test-354-theo-journey.cjs`, Task
1). Both the classification round trip and the taxonomy-ladder casing fix
are now proven against the real, running production origin, not only
against a capture-server double or a local schema-file copy.

---
