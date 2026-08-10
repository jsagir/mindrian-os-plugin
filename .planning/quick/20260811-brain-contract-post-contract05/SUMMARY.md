---
phase: quick-20260811-brain-contract-post-contract05
plan: 01
status: complete
subsystem: brain-contract-probe
tags: [brain, contract-drift, live-probe, contract-05, moat]
requires:
  - data/brain-surface-contract.json
provides:
  - "Post-CONTRACT-05 live drift probe (5 legs: a-d asserted PASS, leg e labeled expected-red)"
affects:
  - scripts/probe-brain-contract.cjs
tech-stack:
  added: []
  patterns: [status-honest-probe-legs, labeled-expected-red-not-silent-green]
key-files:
  created: []
  modified:
    - scripts/probe-brain-contract.cjs
decisions:
  - "Leg c inverted from '403 MoatViolation admin-gated' to 'bounded-read ADMITTED' with three sub-checks (c1 read admitted, c2 write refused in-band, c3 write never executed) because CONTRACT-05 moved brain_query into the bounded read tier"
  - "Leg b's brain_ask_anything assertion corrected mid-execution after a live contradiction: absent from tools/list (delisting proof) AND still 403 MoatViolation on direct tools/call, NOT a JSON-RPC unknown-tool error, because the deny-by-default READ_TOOLS allowlist gate (brain repo c58e764) intercepts tools/call before registry dispatch, denying callers an existence oracle"
  - "data/brain-surface-contract.json stays byte-identical; the corrected truths live only in the probe, per the plan's scope guard and the contract's own _note naming the brain-side hermetic self-test as final authority"
metrics:
  duration: ~25m
  completed: 2026-08-11
  tasks: 1
  files: 1
  commits: 1
---

# Quick Task 20260811-brain-contract-post-contract05: Post-CONTRACT-05 Probe Truths Summary

Updated `scripts/probe-brain-contract.cjs` to the post-CONTRACT-05 deployed-surface truths (brain repo @ 8b40b30, deployed 2026-08-11): brain_query moved into the bounded read tier (leg c inverted to three admission sub-checks), and brain_ask_anything's retirement mode changed from moat-gated-but-listed to delisted-and-still-moat-gated-on-direct-call (leg b, corrected mid-session after a live contradiction surfaced and was root-caused). Leg e (index dispositions) stays honestly red, clearly labeled, pending the operator's 7 DROPs.

## What Was Built

One file, five edits, then a live re-run: `scripts/probe-brain-contract.cjs`.

1. **Header comment** rewritten to the post-CONTRACT-05 truths, citing brain repo @ 8b40b30 / deployed 2026-08-11, removing the now-false "admin-gated tool" framing for `brain_query` and the "including the ones that expect (and require) a 403" line.
2. **Leg a**: hoisted `listedNames` to a `let` above leg a's block so leg b can read it. Assertion and evidence shape (`total_tools_listed` from the live list, never hardcoded) unchanged.
3. **Leg b**: added a `RETIREMENT_MODE` map (`text2cypher: 'refuse-403-moat'`, `brain_ask_anything: 'delisted'`, default `'refuse-403-moat'` for any future unmapped entry). `text2cypher`'s assertion is verbatim unchanged. `brain_ask_anything`'s `'delisted'` mode requires both: absent from `tools/list` AND a direct `tools/call` returning `httpStatus 403` with a `MoatViolation` body naming it "not on the read allowlist" -- corrected from the plan's original draft (which expected a JSON-RPC unknown-tool error) after a live contradiction, see Deviations below.
4. **Leg c**: replaced the single 403 assertion with three sub-checks, each its own `reportLeg` line: c1 (bounded `MATCH...LIMIT` read admitted, HTTP 200, non-empty rows, no refusal marker), c2 (a `CREATE` write refused in-band with `BoundedReadRefusal` in the tool result text, HTTP 200, never a transport 403), c3 (a follow-up bounded read proving zero `ContractProbeCanary` rows exist -- the refused write never executed). Added a tolerant `_countRows()` helper handling array / `{records}` / `{rows}` / `{data}` / `{text}` result shapes.
5. **Leg e**: added a `reportExpectedRed()` helper and an `anyExpectedRed` flag. When the mismatch is exactly the known pending state (all 7 `contract.indexes.dropped` names still present, zero keep/keep_retired missing), it prints a `[RED expected]` line and does not flip `overallOk`. Any other mismatch (partial drop set, a keep index missing) still fails for real. Final summary line reports `=== ALL ASSERTED LEGS PASSED (leg e HONESTLY RED: 7 DROPs pending operator checkpoint) ===` and exits 0 in that state.
6. **Live re-run** against `https://pws-brain-mcp.onrender.com` with a read-tier key (`MINDRIAN_BRAIN_KEY` env, never printed).

## Why It Matters

The probe is the executable contract gate run before every release claim of "the Brain surface holds." Two of its five legs had drifted to assert the pre-CONTRACT-05 world (brain_query refuses; brain_ask_anything is moat-gated-but-listed). Left uncorrected, the probe would have hard-failed every future release gate against a genuinely healthy, correctly-evolved live surface -- a false-negative that trains operators to distrust or bypass the gate. `data/brain-surface-contract.json` was deliberately left untouched: the brain-side hermetic self-test is final authority over that co-owned file, and CONTRACT-05's changes are encoded where they belong, in the live-truth probe.

## Key Decisions

**Leg c inverted, not patched.** `brain_query` genuinely changed tier (admin-gated to bounded-read tier), so the old single 403 assertion was replaced wholesale with three independent proofs (admit / refuse-in-band / never-executed) rather than loosening the existing assertion to tolerate both worlds.

**Leg b's brain_ask_anything truth corrected mid-execution, not forced green.** The plan's original draft asserted that a direct `tools/call` to a delisted tool would surface a JSON-RPC unknown-tool error. The live probe returned `403 MoatViolation` instead -- a genuine contradiction. Per the plan's own deviation policy ("STOP and report the contradiction verbatim rather than bending the assertion to match"), execution halted and reported the raw evidence rather than editing the assertion to pass. The coordinator supplied the root cause: brain repo commit c58e764 added a deny-by-default `READ_TOOLS` allowlist gate that intercepts `tools/call` before registry dispatch, so any name not on the allowlist -- retired, admin-only, or never-existed -- draws the identical 403 MoatViolation. This is deliberate posture (no existence oracle for a read-tier caller). The probe's assertion and a new inline comment (explaining gate-before-registry ordering and the no-existence-oracle rationale) were both updated to the corrected truth.

**Leg e never silently marked green.** The `reportExpectedRed()` path is a third state, distinct from PASS and FAIL, that still surfaces evidence and still requires the pending-state condition to match exactly (all 7 dropped names present, zero keep/keep_retired missing) before it is allowed to not flip `overallOk`. Any partial or unexpected mismatch is a real FAIL.

## Verification

Hermetic gates, all green:
- `node --check scripts/probe-brain-contract.cjs` -- PASS
- `bash tests/run-all-247.sh` -- PASS=4 FAIL=0 SKIP=0 (contract-client hermetic test still sees `retired_remote` containing exactly `text2cypher` and `brain_ask_anything`, and `contract_version === 1`; `data/brain-surface-contract.json` confirmed byte-identical via `git diff --stat`, only `scripts/probe-brain-contract.cjs` changed)
- em-dash grep on `scripts/probe-brain-contract.cjs` -- no output, no em-dashes introduced

Live run against `https://pws-brain-mcp.onrender.com`, read-tier key, exit 0:

```
[PASS] Leg a: every loop_tools name present in tools/list
    evidence: {"total_tools_listed":23,"missing_loop_tools":[]}

[PASS] Leg b: retired tool "text2cypher" refuses with 403 MoatViolation on a read key
    evidence: {"httpStatus":403,"bodyText":"{\"error\":{\"code\":-32003,\"name\":\"MoatViolation\",\"message\":\"MoatViolation: tool \\\"text2cypher\\\" is not on the read allowlist\"}}"}
[PASS] Leg b: retired tool "brain_ask_anything" is delisted (absent from tools/list, allowlist-gate 403 MoatViolation on direct call)
    evidence: {"listed":false,"call_httpStatus":403,"call_bodyText":"{\"error\":{\"code\":-32003,\"name\":\"MoatViolation\",\"message\":\"MoatViolation: tool \\\"brain_ask_anything\\\" is not on the read allowlist\"}}"}

[PASS] Leg c1: brain_query bounded read is ADMITTED on a read key (MATCH...LIMIT)
    evidence: {"httpStatus":200,"row_count":1,"bodyText":"[{\"n\":{...real node data...}}]"}
[PASS] Leg c2: brain_query write attempt refused IN-BAND with BoundedReadRefusal (HTTP 200)
    evidence: {"httpStatus":200,"bodyText":"{\"text\":\"BoundedReadRefusal: bounded read is READ-ONLY. Writes, CALLs to write procedures, and storage/IO ops (LOAD CSV, STORAGE MODE, snapshot, data-directory locks) are refused. brain_write remains stdio-only and is not reachable from this tier.\"}"}
[PASS] Leg c3: refused CREATE never executed (zero ContractProbeCanary rows)
    evidence: {"httpStatus":200,"row_count":0,"bodyText":"[]"}

[PASS] Leg d: search("jobs to be done framework") serves no local-path leak
    evidence: {"httpStatus":200,"bodyText":"(clean)"}
[PASS] Leg d: brain_search("jobs to be done framework") serves no local-path leak
    evidence: {"httpStatus":200,"bodyText":"(clean)"}

[RED expected] Leg e: brain_stats index dispositions match the contract
    7 dropped-index DROPs still pending the operator checkpoint (CONTRACT-04); honestly red, NOT a pass
    evidence: {"indexes_seen":["vector","product_embeddings","person_embeddings","mindrian_methodology_vec_openai","mindrian_methodology_vec","framework_embeddings","entity_embeddings","creativework_embeddings","concept_embeddings"],"dropped_but_still_present":["framework_embeddings","concept_embeddings","creativework_embeddings","entity_embeddings","person_embeddings","product_embeddings","vector"],"keep_but_missing":[]}

=== ALL ASSERTED LEGS PASSED (leg e HONESTLY RED: 7 DROPs pending operator checkpoint) ===
EXIT_CODE=0
```

Matches the plan's Verification table exactly: legs a, b (both), c1-c3, d (both) PASS; leg e RED expected (labeled, not PASS); exit code 0.

## Deviations from Plan

### Auto-fixed / corrected during execution

**1. [Live contradiction, halted then corrected per coordinator root cause] brain_ask_anything's delisted-mode reachability truth.**
- **Found during:** Task 1, step 6 (first live re-run).
- **Issue:** The plan's draft truth for `brain_ask_anything` stated a direct `tools/call` to a delisted tool would surface a JSON-RPC unknown-tool error, not a 403. Live evidence showed the opposite: still `403 MoatViolation ... "not on the read allowlist"`, identical in shape to `text2cypher`'s refusal.
- **Action taken:** Per the plan's explicit deviation policy, execution halted immediately and the verbatim contradiction was reported rather than loosening the assertion to force green. No commit was made at that point.
- **Resolution:** Coordinator supplied the root cause -- brain repo commit c58e764's deny-by-default `READ_TOOLS` allowlist gate runs before registry dispatch on `tools/call`, so any non-allowlisted name (retired, admin-only, or nonexistent) draws the identical 403 MoatViolation; this denies callers an existence oracle by design.
- **Fix:** Leg b's `'delisted'` branch now requires both absence from `tools/list` (registry-level proof) AND a 403 MoatViolation naming the allowlist on direct call (gate-level proof). Added an inline comment above the `RETIREMENT_MODE` map explaining the gate-before-registry ordering and the no-existence-oracle rationale, so a future reader does not re-file this as a half-applied rollout.
- **Files modified:** `scripts/probe-brain-contract.cjs`
- **Commit:** `e665faa9`

No other deviations. All other legs matched the plan's stated live-verified truths on the first live run.

## Commits

| Hash | Message |
|------|---------|
| `e665faa9` | `fix(brain-contract): update live probe to post-CONTRACT-05 surface truths` |

## Self-Check: PASSED

- `FOUND: scripts/probe-brain-contract.cjs` (modified, present on disk)
- `FOUND: e665faa9` (commit present in `git log`)
- Live run exit code 0, confirmed by direct re-run
- `git diff --stat HEAD~1 HEAD` shows exactly one file changed: `scripts/probe-brain-contract.cjs`
- `data/brain-surface-contract.json` confirmed byte-identical (not in the diff)
