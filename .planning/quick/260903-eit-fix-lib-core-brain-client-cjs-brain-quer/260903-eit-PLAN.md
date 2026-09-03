---
phase: quick/260903-eit-fix-lib-core-brain-client-cjs-brain-quer
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/brain-client.cjs
  - tests/test-brain-client-theo-rows-shape.cjs
autonomous: true
requirements: [QUICK-260903-EIT]
canon_parts: [8]

must_haves:
  truths:
    - "An unrecognized brain_query response shape returns a typed error discriminator, not a bare {records: []} that reads exactly like a legitimate no-match"
    - "An unrecognized shape also emits one human-readable warning line to stderr, once per process, naming the shape it could not recognize"
    - "The unrecognized-shape return still carries records: [] so no existing caller that reads result.records crashes"
    - "A genuine empty answer from any RECOGNIZED shape (bare [], {records: []}, Theo {rows: [], diagnostics}) carries NO error field, so error presence is the discriminator"
    - "Every recognized branch (null, bare array, {records}, Theo {rows}, error/text passthrough) behaves byte-identically to before"
    - "The warning names only the response's top-level KEY NAMES and JS type, never any value from the response body"
  artifacts:
    - path: "lib/core/brain-client.cjs"
      provides: "query() unrecognized-shape branch that returns a typed error envelope plus a warn-once stderr line"
      contains: "brain_query_unrecognized_shape"
    - path: "tests/test-brain-client-theo-rows-shape.cjs"
      provides: "Extended regression suite pinning the typed unrecognized-shape contract alongside the five recognized shapes"
      exports: []
  key_links:
    - from: "lib/core/brain-client.cjs query()"
      to: "the module-level warn-once flag"
      via: "the _legacyPathWarned idiom already in this file"
      pattern: "_queryShapeWarned"
    - from: "tests/test-brain-client-theo-rows-shape.cjs"
      to: "lib/core/brain-client.cjs _test seam"
      via: "a reset function so each unrecognized-shape case can observe its own warning"
      pattern: "_setQueryShapeWarned"
---

<objective>
Make `lib/core/brain-client.cjs`'s `query()` fail LOUDLY when the Brain returns a response shape it
does not recognize, instead of silently collapsing to `{ records: [] }`.

Purpose: the final line of `query()` (`return { records: [] };`, line 931) is the blind safety net.
It hands every caller an object that is byte-for-byte indistinguishable from "the Brain answered
correctly and nothing matched". A contract mismatch and a legitimate zero-row answer produce the
identical value. That is the failure mode that hid Theo's `{rows, diagnostics}` envelope until a
human read the code (quick task 260901-ipp, which added the `rows` branch). The branch closed ONE
known shape; the silent-empty hole itself is still open for the next one.

Output: the fallback keeps `records: []` for crash-safety but gains a typed `error` discriminator
plus a once-per-process stderr warning, and the existing regression suite is extended to pin the
new contract.
</objective>

<scope_fence>
IN SCOPE: making the unrecognized-shape path loud.

OUT OF SCOPE, explicitly:
- Adding support for any further Theo response shape. That is the larger Theo-flip integration
  effort (Theo Phase 08.4 gates it) and covers six other files listed in the 2026-09-01 handoff.
  This task adds ZERO new recognized shapes.
- Changing any of the five recognized branches (`null`, bare array, `{records}`, `{rows}`,
  `{error}`/`{text}`).
- Changing `search`, `smartSearch`, `schema`, `stats`, `write`, `ask`, `callTool`, the session
  handshake, the retry ladder, the 403/429 sentinels, or the Part 8 egress guard block at the top
  of `query()`.
- Teaching any CALLER to read the new `error` field. Callers stay untouched (see the caller-impact
  evidence below: every current caller is provably unaffected). Wiring callers to the new signal is
  a separate, later decision.
</scope_fence>

<evidence>
Read this session directly from `lib/core/brain-client.cjs`, not assumed. The prior audit named the
bug; this plan derives the fix shape from the actual current code.

**The current tail of `query()` (lines 896-931), verbatim structure:**

- `if (result == null) return null;` unreachable Brain / no API key. UNTOUCHED.
- `if (Array.isArray(result))` incumbent bare-array shape, wraps into `{records}` and hand-copies
  `egress_disclosure` off the array (Phase 254 / COMP-02, CR-01). UNTOUCHED.
- `if (result && Array.isArray(result.records)) return result;` already normalized, defensive.
  UNTOUCHED.
- `if (result && Array.isArray(result.rows))` Theo's `{rows, diagnostics}`, added 2026-09-01 by
  quick 260901-ipp via `Object.assign`. UNTOUCHED.
- `if (result && (result.error || result.text)) return result;` error / message passthrough.
  UNTOUCHED.
- `return { records: [] };` <- THE ONLY LINE THIS TASK CHANGES.

**Why the existing `error` field name is the right discriminator:** the branch immediately above the
fallback already treats `result.error` as the codebase's established "this is a failure, not data"
marker for a `query()` return value. Introducing a second, different convention for the same idea
would be the worse change.

**Why `records: []` must stay in the returned object:** its stated job is "never crash". Dropping it
would turn a silent-empty bug into a `TypeError` in any unguarded caller. Keeping it while adding a
sibling `error` field makes the failure detectable without making it fatal, which is exactly the
Canon "honest refusal" posture (decision 8: surface a failure in-turn, never conceal it).

**Caller-impact check, performed this session, so the additive fields are provably safe:**

| Caller | How it reads a query result | Impact of the added fields |
|--------|-----------------------------|----------------------------|
| `lib/core/research-corpus.cjs:519` | `(result && Array.isArray(result.records)) ? result.records : []` | none |
| `lib/core/brain-derivation.cjs:490` -> `renderRecords` (line 332) | branches on `Array.isArray(result.records)`, then `.matches`, else `{empty: true}`. Never reads `.error` | none |
| `scripts/build-connector-registry.cjs:1034` | `!result || !Array.isArray(result.records)` guard, then an explicit `deduped.length === 0` -> "keeping the committed snapshot" exit | none, already degrades safely |
| `scripts/build-command-registry.cjs:444` | same guard pattern | none |
| `scripts/check-dual-graph-health.cjs:315-318` -> `_firstRowValue` (line 278) | fail-closed: non-object, non-array `records`, or empty `records` all return `null` | none |
| `scripts/brain-derive-command.cjs`, `scripts/backfill-correlation-id.cjs`, `scripts/rs-explain-command.cjs`, `lib/core/doctor/class-m-brain-smoke.cjs` | all read `.records` behind `Array.isArray` guards | none |

No current caller branches on `.error` for a `query()` result, so this change alters observable
behavior for exactly zero existing call sites while making the signal available.

**The one thing that WILL break and must be fixed in the same change:**
`tests/test-brain-client-theo-rows-shape.cjs` case 6 asserts
`assert.deepEqual(fooResult, { records: [] })` and
`assert.deepEqual(badRowsResult, { records: [] }, ...)`. Those two `deepEqual` calls pin the OLD
silent contract. They are not collateral damage; updating them IS the behavior change, which is why
Task 1 rewrites them first as a RED test.

`lib/memory/brain-client-query-shape.test.cjs` was checked and contains NO assertion on the
fallback shape (grep for `records: []` and `deepEqual` returns nothing), so it needs no edit, only a
regression run. The many other `records: []` hits across `lib/memory/*.test.cjs` are mock RETURN
values feeding fake query functions, not assertions on `query()`, so they are unaffected.

**Warn-once idiom already in this file:** `_legacyPathWarned` + `_warnLegacyOnce(db)` (line 1939),
with the reset seam `_setLegacyWarned` exported under `module.exports._test` (line 2177). The file's
own comment calls this "the existing once-per-process warning pattern in this file". Reuse it
rather than inventing a logger.

**Why NOT a `memory_event` log:** `_logEventBestEffort(db, ...)` returns immediately when `db` is
falsy (line 1847), and `query()` has no `db` handle in scope. The one existing call inside `query()`
passes `undefined` (line 877), so it is already a permanent no-op there. A memory_event log would be
invisible. `console.warn` is the only channel that actually reaches a human from this function.
</evidence>

<grounding_consults>
Per this repo's CLAUDE.md "Consult ALL Relevant Grounding Sources During Dev Work (MANDATORY)" rule,
the consult decision is stated rather than silently skipped:

| Source | Warranted? | Why |
|--------|-----------|-----|
| The live code at `lib/core/brain-client.cjs:837-931` | YES, DONE | Primary source. Read this session. The fix shape is derived from the actual branch ladder, the actual `_legacyPathWarned` idiom, and the actual `_logEventBestEffort` db-guard, not from the prior audit's description. |
| Callers of `brain.query()` across `lib/` and `scripts/` | YES, DONE | Needed to prove the added fields are behavior-neutral. Table above. |
| `.planning/quick/260901-ipp-.../260901-ipp-SUMMARY.md` | YES, DONE | Establishes what the sibling fix already closed, so this task does not redo it or contradict it. |
| Theo (`/home/jsagi/Theo`) | NO | This task deliberately adds no Theo shape support. It makes the mismatch loud so the NEXT contract drift is discovered by a warning instead of a code read. Theo's own contract is unchanged by this and needs no re-reading. |
| `icm-architect` skill | NO | Binds to room structure, ICM/MWP architecture, and the local SQLite graph. This is a response-parsing branch in the remote-Brain HTTP client: zero room, zero schema, zero local-graph surface. |
| `langtalks-graph-expert` | NO | Its corpus covers agent/LLM engineering concepts. The question here is "what does this one function return on an unknown input", answered by the code itself. Defaulting to langtalks here is the failure mode the rule warns about. |
| Context7 | NO | No named-library API contract in question. Node built-ins only, zero new dependencies. |

If the executor finds the fix reaching into `navigation.cjs`, room schema, or edge vocabulary,
STOP: the diagnosis was wrong and `icm-architect` becomes required.
</grounding_consults>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@lib/core/brain-client.cjs
@tests/test-brain-client-theo-rows-shape.cjs
@tests/helpers/brain-capture-server.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite the unrecognized-shape cases in the existing suite to pin the typed error contract (RED)</name>
  <files>tests/test-brain-client-theo-rows-shape.cjs</files>
  <behavior>
    Replace the single case currently named "unexpected shapes retain the safety net: {foo} and
    malformed {rows} both collapse to {records: []}, never crash" (lines 188-207) with cases that
    pin the NEW contract. All five preceding cases stay exactly as they are and must keep passing.

    - Unrecognized object `{foo: 'bar'}`: result still has `records` as an array of length 0 (no
      crash), AND `result.error === 'brain_query_unrecognized_shape'`, AND `result.shape_type ===
      'object'`, AND `result.shape_keys` deep-equals `['foo']`. FAILS before Task 2.
    - Malformed `{rows: 'not-an-array'}`: same typed error contract, with `shape_keys` deep-equal
      to `['rows']`. This simultaneously keeps pinning the existing rule that the Theo branch guards
      on `Array.isArray(result.rows)` and never on mere key presence. FAILS before Task 2.
    - The warning fires: after resetting the warn-once flag via the `_test` seam and capturing
      `console.warn`, one unrecognized-shape query produces exactly one warn call whose text
      contains `brain_query_unrecognized_shape` and the offending key name. FAILS before Task 2.
    - The warning is once-per-process: with the flag NOT reset, a second unrecognized-shape query
      produces zero additional warn calls, while STILL returning the typed error object (the return
      value is per-call, only the console line is deduped). FAILS before Task 2.
    - Part 8 / no value leakage: send `{secret_field: 'CANARY7F3A2B'}`; assert the captured warning
      text does NOT contain `CANARY7F3A2B` while it DOES contain `secret_field`. Key names only,
      never values. FAILS before Task 2 (no warning exists yet).
    - Negative control, the discriminator actually discriminates: a RECOGNIZED empty answer
      (`{rows: [], diagnostics: {elapsed_ms: 3, row_cap: 200}}`) must have NO `error` key at all.
      Add this assertion to the existing "Theo genuinely empty" case rather than creating a new
      case. Passes today, must keep passing.
  </behavior>
  <action>
Edit `tests/test-brain-client-theo-rows-shape.cjs` in place. Do NOT create a second suite file:
this file already owns the brain_query response-shape contract and already contains the two
`assert.deepEqual(..., { records: [] })` assertions that pin the OLD silent behavior. Leaving them
in a second file's shadow would produce two suites asserting opposite contracts (Canon Part 7,
reuse before build).

Keep the existing harness exactly as-is: the `startCaptureServer` / `setToolScript` /
`resetToolScript` / `resetCaptured` reuse, the `sseBody` / `sseBodyForObject` helpers, the
`record(name, fn)` reporter, the load-order contract (env vars set, `require.cache` deleted, THEN
require `brain-client.cjs`), `node:assert/strict`, Node built-ins only, no new dependencies.

Keep the benign methodology `CYPHER` constant unchanged. Canon Part 8: never put room content, user
text, or personal identifiers into a cypher string. The `CANARY7F3A2B` string in the leakage test
goes in the RESPONSE payload the mock server sends back (inbound), never in an outbound cypher.

For the warn-capture cases, swap `console.warn` for a collector function inside a `try` and restore
it in a `finally`, so a failing assertion cannot leave the global patched for later cases. Reset the
warn-once flag between the cases that need a fresh warning by calling the `_test` seam Task 2 adds,
referenced as `brain._test._setQueryShapeWarned(false)`. Since Task 2 has not run yet, that call
will throw during the RED run: guard it with a `typeof` check so the case reports a clean assertion
failure instead of a `TypeError` stack, for example skip the reset when
`brain._test && typeof brain._test._setQueryShapeWarned === 'function'` is false and let the
downstream assertion be the thing that fails.

Update the file's header comment block: it currently says "Six cases" and describes case 6 as the
retained safety net. Rewrite that paragraph to describe the new contract and state the root cause in
one sentence: the blind `{records: []}` fallback was indistinguishable from a legitimate no-match,
so a future contract drift would repeat the 2026-09-01 Theo incident with no signal at all. Cite
this task directory (`quick/260903-eit`) alongside the existing 2026-09-01 citations.

Update the closing summary line's suite label if it names a case count.

No em-dashes anywhere in the file (repo hard rule); use hyphens.
  </action>
  <verify>
    <automated>node tests/test-brain-client-theo-rows-shape.cjs; test $? -ne 0 &amp;&amp; echo "RED as expected (unrecognized-shape contract not implemented yet)"</automated>
  </verify>
  <done>The suite runs and exits non-zero. The five recognized-shape cases (Theo populated, Theo genuinely empty, incumbent bare array, already-normalized, error passthrough) all report `ok`; only the new unrecognized-shape cases FAIL. A failure in any recognized-shape case means the test edit broke the harness, not that the product code is wrong: fix the test before moving on.</done>
</task>

<task type="auto">
  <name>Task 2: Replace the blind {records: []} fallback in query() with a typed error envelope plus a warn-once line (GREEN)</name>
  <files>lib/core/brain-client.cjs</files>
  <action>
In `lib/core/brain-client.cjs`, change ONLY the final line of `async function query(cypher, params)`
(currently `return { records: [] };` at line 931). Every branch above it stays byte-identical.

Add a module-level flag and a small helper near `query()`, mirroring the `_legacyPathWarned` /
`_warnLegacyOnce` idiom this file already documents as "the existing once-per-process warning
pattern in this file":

- A module-level `let _queryShapeWarned = false;`.
- A helper that takes the unrecognized `result` and returns the typed envelope. It must:
  - Compute `shape_type` as `typeof result` (arrays never reach here, they are caught by the
    `Array.isArray(result)` branch above, but keep an `Array.isArray` check in the helper anyway so
    it stays correct if it is ever called from elsewhere).
  - Compute `shape_keys` as the top-level own key NAMES only, and only when `result` is a non-null
    plain object. For a string, number, or boolean `result`, `shape_keys` is `[]` (never
    `Object.keys` of a string, which would yield character indices). Cap the list at 12 keys and cap
    each key name at 64 characters, so a hostile or malformed envelope cannot produce an unbounded
    log line.
  - CANON PART 8 RULE, state it in the code comment: key NAMES only, never values. A Brain response
    envelope's top-level key names are generic schema handles; its values may carry graph payload.
    The warning line and the returned `shape_keys` must never contain a value from the response
    body.
  - Emit `console.warn` exactly once per process, guarded by `_queryShapeWarned`. One line, no
    em-dashes, following the repo's 3-part error idiom in spirit: what happened, why it matters, what
    the caller gets. It must contain the literal token `brain_query_unrecognized_shape`, the
    `shape_type`, the joined `shape_keys`, and an explicit statement that this is a CONTRACT
    MISMATCH and NOT an empty answer. Prefix it `[mindrian-os]` like `_warnLegacyOnce` does.
  - Return `{ records: [], error: 'brain_query_unrecognized_shape', shape_type: <type>, shape_keys: <array> }`.
    `records: []` is retained deliberately: dropping it would convert a silent-empty bug into a
    TypeError in any unguarded caller. The `error` sibling is what makes it detectable.

Do NOT call `_logEventBestEffort` here. `query()` has no `db` handle in scope, so that helper's
`if (!db) return;` guard (line 1847) makes it a permanent no-op, exactly as it already is at line
877. A log nobody can receive is not a signal.

Export the reset seam so Task 1's warn-once cases can control the flag: add
`_setQueryShapeWarned: function (v) { _queryShapeWarned = !!v; },` to the existing
`module.exports._test` object (line 2164), immediately after `_setLegacyWarned` so the two
warn-once seams sit together.

Then update the normative block comment above `query()` (the `NOTE (2026-05-11, graph-on-graph P0
cont.): RESULT-SHAPE NORMALIZATION` paragraph, lines 820-835). Comments in this file are load-bearing
documentation: an undocumented contract change is an incomplete change. The sentence that currently
reads that "any other unexpected shape collapses to `{ records: [] }` so callers never crash" is now
WRONG and must be corrected, not merely appended to. State the new contract: an unrecognized shape
still returns an object carrying `records: []` so callers never crash, but it now ALSO carries
`error: 'brain_query_unrecognized_shape'` plus `shape_type` and `shape_keys`, and emits one
warn-once line. State the reason in one sentence: the bare `{records: []}` was byte-identical to a
legitimate no-match, which is precisely how the Theo `{rows, diagnostics}` drift went unnoticed
until a human read the code. Add a citation to this task directory (`quick/260903-eit`) alongside
the existing 2026-09-01 citations, and state the explicit non-goal: this recognizes no new shapes,
it only makes the mismatch audible.

Also correct the adjacent sentence in the 2026-09-01 NOTE block (lines 846-849) that describes
`diagnostics` as the discriminator against "the blind fallback's bare `{records: []}`". The fallback
is no longer blind or bare. Keep the point (diagnostics still survives normalization) but stop
describing the fallback as bare.

Do NOT touch: the `result == null` branch, the `Array.isArray(result)` branch and its
`egress_disclosure` hand-copy (Phase 254 / COMP-02, CR-01, WR-02), the `Array.isArray(result.records)`
branch, the `Array.isArray(result.rows)` Theo branch, the `result.error || result.text` passthrough,
the Part 8 egress guard block at the top of `query()`, or any other exported function.

No em-dashes; use hyphens.
  </action>
  <verify>
    <automated>node tests/test-brain-client-theo-rows-shape.cjs &amp;&amp; node lib/memory/brain-client-query-shape.test.cjs &amp;&amp; node tests/test-brain-client-params.cjs &amp;&amp; for t in tests/test-239-query-egress-canary.cjs tests/test-247-brain-client-403.cjs tests/test-247-contract-client.cjs tests/test-259-brain-client-429.cjs tests/test-259-brain-call-errorkind.cjs tests/test-245-brain-envelope-shape.cjs; do echo "== $t"; node "$t" || exit 1; done &amp;&amp; test "$(grep -v '^ *[*#/]' lib/core/brain-client.cjs tests/test-brain-client-theo-rows-shape.cjs | grep -c '—')" = "0" &amp;&amp; echo ALL_GREEN</automated>
  </verify>
  <done>`ALL_GREEN` prints. Every case in the extended suite passes, including the two typed-error cases, the warn-fires case, the warn-once-per-process case, the Part 8 no-value-leakage case, and the negative control proving a recognized empty answer carries no `error` key. `lib/memory/brain-client-query-shape.test.cjs`, `tests/test-brain-client-params.cjs`, and the six adjacent brain-client suites all still exit 0. Zero em-dashes in non-comment lines of both touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin -> remote Brain (`brain_query` over HTTPS) | Outbound cypher crosses the Canon Part 8 boundary; only generic methodology handles may cross. Untouched by this change: it is read-side only and adds zero outbound bytes. |
| remote Brain -> plugin (response envelope) | Untrusted, attacker-influenceable JSON is parsed by `callTool` and handed to `query()`. This is the surface the change touches. |
| plugin -> local stderr / captured logs | New. An unrecognized response envelope now influences a line of local log output. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EIT-01 | Information disclosure | the new warn line and `shape_keys` | mitigate | Emit top-level KEY NAMES only, never values, so response-body payload cannot reach a log. Pinned by the `{secret_field: 'CANARY7F3A2B'}` case in Task 1, which asserts the canary value is absent from the warning while the key name is present. |
| T-EIT-02 | Denial of service | log flooding from a misbehaving Brain answering every query with a bad shape | mitigate | `console.warn` is guarded by the module-level `_queryShapeWarned` flag, once per process, reusing the `_legacyPathWarned` idiom. The per-call signal rides on the returned `error` field, which costs no I/O. Pinned by the warn-once case in Task 1. |
| T-EIT-03 | Denial of service | unbounded key count or key length in a hostile envelope producing a giant log line | mitigate | Cap `shape_keys` at 12 entries and each key name at 64 characters before joining. |
| T-EIT-04 | Tampering | a non-object `result` (string / number) reaching the helper | mitigate | Compute `shape_keys` only for a non-null plain object; never `Object.keys` a string, which would emit character indices as key names. `records: []` is always present so no caller can be crashed by the new path. |
| T-EIT-05 | Spoofing | a hostile Brain sending `{error: 'brain_query_unrecognized_shape'}` to impersonate the local signal | accept | Reaching that branch requires `result.error` to be set, which is caught by the error/text passthrough one line EARLIER and returned unchanged. A Brain that wants to report a failure can already do so today; this adds no new trust in the response. No caller currently branches on `.error` for a query result (caller table in `<evidence>`), so nothing is exploitable. |
| T-EIT-06 | Information disclosure | Part 8 egress guard in `query()` | accept (unchanged) | Explicitly out of scope and untouched. The change is read-side only. |
| T-EIT-SC | Tampering | npm/pip/cargo installs | n/a | Zero new dependencies. Node built-ins only. No package-manager step in this plan, so no legitimacy gate is required. |
</threat_model>

<verification>
- `node tests/test-brain-client-theo-rows-shape.cjs` exits 0 with every case ok.
- `node lib/memory/brain-client-query-shape.test.cjs` still exits 0 (params forwarding plus bare-array normalization intact).
- `node tests/test-brain-client-params.cjs` still exits 0 (Finding I argument-shape regression intact).
- The six adjacent brain-client suites listed in Task 2's verify all exit 0.
- `git diff --stat` shows exactly two files: `lib/core/brain-client.cjs` and `tests/test-brain-client-theo-rows-shape.cjs`.
- `git diff lib/core/brain-client.cjs` shows the `result == null` branch, the `Array.isArray(result)` branch with its `egress_disclosure` hand-copy, the `Array.isArray(result.records)` branch, the `Array.isArray(result.rows)` Theo branch, the `result.error || result.text` passthrough, and the Part 8 egress guard block ALL UNCHANGED.
- No connector-registry or born-wired gate run is needed: no invocable surface is added (no command, agent, pipeline, or skill), so Canon Part 11 R1/R2/R16 declarations do not apply.
- Do NOT run `scripts/release.sh`. Explicit standing do-not; needs navigator go-ahead.
</verification>

<success_criteria>
- A `brain_query` response that matches none of the five recognized shapes reaches the caller as `{records: [], error: 'brain_query_unrecognized_shape', shape_type, shape_keys}` and prints one stderr warning, instead of an indistinguishable `{records: []}`.
- A legitimate zero-row answer from ANY recognized shape carries no `error` key, so the presence of `error` is a reliable discriminator rather than a heuristic.
- No caller crashes and no caller changes behavior: `records` is still an array on every non-null return.
- The next Brain contract drift announces itself in a log line on first occurrence instead of waiting for a human to read `brain-client.cjs`.
- The contract is pinned by the committed regression suite, so a future refactor re-opens the hole loudly.
</success_criteria>

<output>
Create `.planning/quick/260903-eit-fix-lib-core-brain-client-cjs-brain-quer/260903-eit-SUMMARY.md` when done.

Record in the summary:
- The exact helper and fallback return as shipped.
- The explicit statement that this task added ZERO new recognized response shapes, so the six
  remaining files on Theo's adaptation list (`scripts/probe-brain-contract.cjs`,
  `lib/brain/chain-recommender.cjs`, `lib/core/enrichment-queue.cjs`,
  `bin/mindrian-brain-mcp-client.cjs`, `lib/core/resolve-brain-key.cjs`,
  `data/brain-surface-contract.json`, `BRAIN_TOOL_MATCHER`/`hooks/hooks.json`) are untouched and
  still gated on Theo Phase 08.4.
- The known, deliberate non-regression: no caller currently reads the new `error` field, so no
  caller behavior changed. Note it as a candidate follow-up (teaching `build-connector-registry.cjs`,
  `check-dual-graph-health.cjs`, and `research-corpus.cjs` to distinguish a contract mismatch from an
  empty answer), NOT as work done here.
- That `tests/test-brain-client-theo-rows-shape.cjs` case 6 was rewritten rather than deleted, and why.

Per this repo's Dev-Research Compositing rule, this is a follow-on bug fix off an already-filed
research trail (`docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` finding
#1, and the `quick/260901-ipp` summary), not new architectural research. No new
`rethinking-mindrianos/research/` entry is required; cross-reference both existing sources instead.
</output>
