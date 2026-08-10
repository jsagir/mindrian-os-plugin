---
quick: brain-contract-post-contract05
date: 2026-08-11
slug: 20260811-brain-contract-post-contract05
type: quick
autonomous: true
files_modified:
  - scripts/probe-brain-contract.cjs
must_haves:
  truths:
    - "Probe leg c asserts brain_query is ADMITTED on a read key: bounded read Cypher returns 200 with rows, and a CREATE is refused IN-BAND with BoundedReadRefusal (HTTP 200), never executed"
    - "Probe leg b asserts text2cypher still refuses 403 MoatViolation, and brain_ask_anything is ABSENT from tools/list (delisted, not moat-gated)"
    - "Probe leg e stays HONESTLY RED (clearly-labeled expected-fail) while the 7 index DROPs await the operator checkpoint; it is neither deleted nor marked green"
    - "Live re-run against pws-brain-mcp.onrender.com exits 0 with legs a-d PASS and leg e labeled expected-red"
  artifacts:
    - path: "scripts/probe-brain-contract.cjs"
      provides: "Post-CONTRACT-05 live drift probe (5 legs, same architecture)"
  key_links:
    - from: "scripts/probe-brain-contract.cjs"
      to: "data/brain-surface-contract.json"
      via: "contract read (JSON stays byte-identical)"
      pattern: "brain-surface-contract\\.json"
---

# Quick: Update probe-brain-contract.cjs to post-CONTRACT-05 surface truths

## Problem

The brain repo's CONTRACT-05 wave (origin/main @ 8b40b30, deployed to
https://pws-brain-mcp.onrender.com on 2026-08-11) changed the live surface, and
the plugin's executable contract `scripts/probe-brain-contract.cjs` still
asserts the PRE-CONTRACT-05 truths. Two legs now assert the wrong world:

1. **Leg c is INVERTED.** The probe asserts brain_query REFUSES with 403
   MoatViolation on a read key. New live-verified truth: the bounded read tier
   ADMITS brain_query on a read key. `MATCH ... RETURN ... LIMIT` returns
   bounded rows (HTTP 200); `CALL vector_search.show_index_info() YIELD * RETURN * LIMIT n`
   executes bounded; a write attempt (`CREATE`) is refused IN-BAND with a
   BoundedReadRefusal message in the tool result text (HTTP 200, refusal in
   content, the write never executes).
2. **Leg b is HALF changed.** text2cypher still refuses 403 MoatViolation on a
   read key (UNCHANGED, keep). brain_ask_anything is now RETIRED from the live
   surface entirely: it no longer appears in tools/list at all. Calling it
   yields a JSON-RPC unknown-tool error, NOT a 403 MoatViolation. Total tool
   count stays 23 (brain_query joined the read surface as ask_anything left),
   but the probe must keep reading the live count, never hardcode it.
3. **Legs a, d, e are UNCHANGED.** Leg e (index dispositions) stays HONESTLY
   RED until the operator runs the 7 pending DROPs: keep it visible and red,
   do not delete it, do not mark it green.

Every fact above is live-verified as of 2026-08-11. No research needed.

## Scope guard: what does NOT change

- **`data/brain-surface-contract.json` stays byte-identical.** The hermetic
  test `tests/test-247-contract-client.cjs` (line ~172) asserts
  `retired_remote` equals exactly `['brain_ask_anything', 'text2cypher']` and
  `contract_version === 1`, and the contract's own `_note` names the
  brain-side hermetic self-test as FINAL AUTHORITY over both vendored copies.
  The post-CONTRACT-05 truths are encoded in the PROBE, not by unilaterally
  editing the co-owned contract file. brain_ask_anything is still retired,
  just MORE retired (delisted instead of moat-gated), so the contract list
  remains true.
- **The probe's architecture stays as-is:** mcpCall/callTool wire pattern,
  resolveBrainKey key loading (MINDRIAN_BRAIN_KEY env or ~/.mindrian.env,
  never printed), reportLeg PASS/FAIL with verbatim httpStatus + body
  evidence, exit 1 on any real failure. Change expected truths only.
- CJS only. No em-dashes anywhere (the existing double-hyphen `--` comment
  style is fine and stays).

## Tasks

<task type="auto">
  <name>Task 1: Rewrite legs b and c to the post-CONTRACT-05 truths, add an expected-red path for leg e, then live re-run against production</name>
  <files>scripts/probe-brain-contract.cjs</files>
  <action>
Edit `scripts/probe-brain-contract.cjs` in place. Five edits, then a live run.

**1. Header comment (lines ~27-47).** Update the five-leg description to the
new truths: leg b = text2cypher refuses 403 MoatViolation on a read key
(reachability retirement) AND brain_ask_anything is absent from tools/list
(delisting retirement, CONTRACT-05); leg c = brain_query is ADMITTED on the
bounded read tier: read Cypher returns bounded rows, a CREATE is refused
in-band with BoundedReadRefusal at HTTP 200 and never executes; leg e =
honestly red until the operator DROP checkpoint. Remove the now-false line
"including the ones that expect (and require) a 403" and the "admin-gated
tool" framing for brain_query. Cite CONTRACT-05 (brain repo @ 8b40b30,
deployed 2026-08-11) so the header explains WHY the truths changed.

**2. Leg a: hoist the listed names.** Capture the tools/list names array in a
variable visible to leg b (e.g. `let listedNames = []` above the leg, assigned
inside the success branch). Leg a's assertion (every loop_tools name present)
and its evidence shape (`total_tools_listed` printed from the LIVE list, never
a hardcoded 23) are unchanged.

**3. Leg b: per-tool retirement mode.** Keep iterating
`contract.retired_remote` (do not touch the JSON). Add a small mode map in the
probe, e.g.:
`const RETIREMENT_MODE = { text2cypher: 'refuse-403-moat', brain_ask_anything: 'delisted' };`
with `'refuse-403-moat'` as the default for any unmapped name (conservative,
preserves old behavior for future entries).
- `refuse-403-moat` (text2cypher): existing assertion verbatim: callTool with
  the trivial arg, require `!r.ok && r.httpStatus === 403 && /MoatViolation/i.test(r.bodyText)`.
- `delisted` (brain_ask_anything): two checks in one leg report.
  (i) PRIMARY: `!listedNames.includes(toolName)` (absent from tools/list).
  (ii) SECONDARY (the probe already has a call-and-expect-error pattern, so
  keep the reachability proof): callTool the tool, require `!r.ok` AND
  `!/MoatViolation/i.test(r.bodyText)` (a JSON-RPC unknown-tool error, which
  mcpCall surfaces as ok:false with the parsed.error JSON in bodyText, is the
  expected shape; assert error-and-not-moat, not an exact error-code string,
  to avoid brittleness). Leg passes only if both hold. Evidence prints the
  listed/not-listed verdict plus the verbatim call httpStatus + bodyText.

**4. Leg c: invert to bounded-read admission.** Replace the single 403
assertion with three sub-checks, each its own reportLeg line:
- c1 READ ADMITTED: `callTool('brain_query', { cypher: 'MATCH (n) RETURN n LIMIT 1' }, key)`;
  require `r.ok && r.httpStatus === 200` and that
  `JSON.stringify(r.result)` does NOT match `/BoundedReadRefusal|MoatViolation/i`
  and the result is non-empty (non-null, and if an array or `{records: [...]}`
  shape, at least one row). Use the exact live-verified `MATCH ... RETURN ... LIMIT`
  shape; do not send an unbounded query.
- c2 WRITE REFUSED IN-BAND: `callTool('brain_query', { cypher: 'CREATE (n:ContractProbeCanary) RETURN n' }, key)`;
  require `r.ok && r.httpStatus === 200` AND
  `/BoundedReadRefusal/i.test(JSON.stringify(r.result))`. HTTP 200 with the
  refusal in the tool result text is the NEW contract shape (in-band refusal,
  not a transport 403); a transport error or a missing refusal marker is a
  FAIL either way.
- c3 WRITE NEVER EXECUTED: `callTool('brain_query', { cypher: 'MATCH (n:ContractProbeCanary) RETURN n LIMIT 1' }, key)`;
  require `r.ok` and ZERO rows returned (empty array / empty records /
  no-rows result). This is live proof the refused CREATE did not write,
  using the read admission c1 just proved.
Handle result shapes tolerantly (callTool already returns parsed JSON, a
`{text}` wrapper, or the raw result); assert on the stringified payload plus a
loose row-count probe, never on one exact schema.

**5. Leg e: expected-red path, no green-washing.** Keep the existing
comparison logic verbatim. After computing `shouldBeAbsent` / `shouldBePresent`,
branch:
- Everything matches the contract -> PASS (unchanged; this is the future state
  after the operator runs the DROPs).
- EXACTLY the known pending state, meaning `shouldBePresent.length === 0` AND
  `shouldBeAbsent` (sorted) equals the full `contract.indexes.dropped` list
  (sorted, all 7 still present) -> print a clearly-labeled expected-red line,
  e.g. `[RED expected] Leg e: 7 dropped-index DROPs still pending the operator
  checkpoint (CONTRACT-04); honestly red, NOT a pass`, with the same evidence
  object, and do NOT flip `overallOk`. Implement via a small extension to the
  reporter (a third state or a dedicated `reportExpectedRed()` helper), not a
  rearchitecture.
- ANY other mismatch (a keep index missing, or a partial drop set) -> real
  FAIL as today.
Update the final summary line so the expected-red state prints something like
`=== ALL ASSERTED LEGS PASSED (leg e HONESTLY RED: 7 DROPs pending operator checkpoint) ===`
and exits 0; a real failure still prints the FAILED line and exits 1.

**6. Live re-run (the point of the exercise).** Run
`node --check scripts/probe-brain-contract.cjs`, then
`node scripts/probe-brain-contract.cjs` with the read key available via the
probe's existing MINDRIAN_BRAIN_KEY / ~/.mindrian.env pattern (no admin key).
Capture the full output for the SUMMARY. Expected per-leg results are in the
Verification section; if any leg deviates, STOP and report the verbatim
evidence instead of adjusting assertions to force green.
  </action>
  <verify>
    <automated>node --check scripts/probe-brain-contract.cjs && bash tests/run-all-247.sh && node scripts/probe-brain-contract.cjs; test $? -eq 0</automated>
  </verify>
  <done>
Probe encodes the post-CONTRACT-05 truths, hermetic 247 suite stays green
(contract JSON untouched), and the live run against production exits 0 with
legs a-d PASS and leg e clearly labeled expected-red. Output captured.
  </done>
</task>

## Verification

Live run: `node scripts/probe-brain-contract.cjs` against
https://pws-brain-mcp.onrender.com with a read-tier key
(MINDRIAN_BRAIN_KEY env or ~/.mindrian.env; the probe resolves it itself and
never prints the value). Expected results, leg by leg:

| Leg | Expected | Evidence to see |
|-----|----------|-----------------|
| a | PASS | All 6 loop_tools present; `total_tools_listed` printed from the live list (expected to read 23, but the number is observed, never asserted as a hardcoded literal) |
| b (text2cypher) | PASS | httpStatus 403, body matches MoatViolation (unchanged truth) |
| b (brain_ask_anything) | PASS | Absent from tools/list; the reachability call returns a JSON-RPC unknown-tool error, NOT 403 MoatViolation |
| c1 | PASS | `MATCH (n) RETURN n LIMIT 1` -> httpStatus 200, bounded rows, no refusal marker |
| c2 | PASS | `CREATE (n:ContractProbeCanary) ...` -> httpStatus 200 with BoundedReadRefusal in the tool result text (in-band refusal) |
| c3 | PASS | `MATCH (n:ContractProbeCanary) RETURN n LIMIT 1` -> zero rows (the CREATE never executed) |
| d (search) | PASS | No local-path leak in served hits (unchanged) |
| d (brain_search) | PASS | No local-path leak in served hits (unchanged) |
| e | RED expected (labeled, not PASS) | All 7 `contract.indexes.dropped` names still present, zero keep/keep_retired missing; line explicitly says the DROPs await the operator checkpoint |
| exit code | 0 | Summary line names leg e as honestly red |

Hermetic gates (no network):
- `node --check scripts/probe-brain-contract.cjs` passes.
- `bash tests/run-all-247.sh` fully green: the contract-client hermetic test
  still sees `retired_remote === ['brain_ask_anything', 'text2cypher']` and
  `contract_version === 1` because `data/brain-surface-contract.json` was not
  touched (`git diff --stat` shows exactly one file changed:
  `scripts/probe-brain-contract.cjs`).
- `grep -n "—" scripts/probe-brain-contract.cjs` returns nothing (no
  em-dashes introduced).

Deviation policy: any leg that does not match the table above is reported
verbatim (httpStatus + body evidence), NOT papered over by loosening the
assertion. Per the standing false-success watch, a red leg is never renamed
green to make the run pass.

## Commit

Single commit, conventional style, one file:

```
fix(brain-contract): update live probe to post-CONTRACT-05 surface truths

The brain repo's CONTRACT-05 wave (origin/main @ 8b40b30, deployed
2026-08-11) changed two of the probe's asserted truths:

- brain_query moved INTO the bounded read tier: a read key now gets
  bounded MATCH/RETURN/LIMIT rows at HTTP 200, and a write attempt is
  refused IN-BAND with BoundedReadRefusal in the tool result text (the
  old 403 MoatViolation assertion asserted the pre-CONTRACT-05 world).
- brain_ask_anything is retired from the live surface entirely: absent
  from tools/list (delisted), so calling it is a JSON-RPC unknown-tool
  error, not a 403. text2cypher keeps its 403 MoatViolation refusal.

Leg e (index dispositions) stays honestly red as a labeled expected-fail
until the operator runs the 7 pending DROPs (CONTRACT-04 checkpoint).
data/brain-surface-contract.json is untouched; the brain-side hermetic
self-test remains final authority over the vendored contract.

Live-verified against pws-brain-mcp.onrender.com on 2026-08-11: legs a-d
green, leg e expected-red, exit 0.
```

## Output

On completion write
`.planning/quick/20260811-brain-contract-post-contract05/SUMMARY.md` with the
captured live-run output (full per-leg PASS/RED lines and the summary line)
and the commit hash.
