---
phase: 110-brain-context-packet-contract
plan: "05"
subsystem: tests
tags: [d-11-validation-suite, brain-context-packet, canon-part-8, canon-part-9, ajv-2020, per-job-round-trip, adversarial-leak-sweep, privacy-mode-config-caps, dual-path-deprecation-guard]

# Dependency graph
requires:
  - phase: 110-00
    provides: "the 2 RED test stubs at tests/test-brain-packet-validation-per-job.cjs + tests/test-brain-packet-part8-invariant-per-job.cjs (the registered paths this plan fills) + tests/run-all-110.sh + lib/memory/run-feynman-tests.cjs TEST_FILES[] entries"
  - phase: 110-01
    provides: "data/brain-packet-schema.json (the wire-format contract this suite round-trips against per-job; the schema's $defs[job].in / .out shapes; the additionalProperties:false teeth that turn an extra-field packet into a refused packet)"
  - phase: 110-02
    provides: "lib/core/navigation/packet.cjs::buildBrainPacket honoring origin: 'navigation_api' + the per-call privacyMode override (used by the config-caps sub-block) + the safe-projection mappers (what the adversarial sweep proves hold per job); lib/core/navigation/memory-events.cjs EVENT_TYPES Set carrying brain_packet_rejected / brain_response_rejected / brain_legacy_path_used"
  - phase: 110-03
    provides: "lib/core/brain-client.cjs::sendPacket + the __transport function seam + the ajv in/out middleware + the D-08 layer-3 origin allowlist + the _warnLegacyOnce helper + the _test hooks (_resetSchema, _setLegacyWarned, _validatorFor, _parseBrainResult, _looksLikeUnknownToolError, _ensureSchema, SHIPPED_JOBS) + the lib/core/navigation.cjs::logMemoryEvent re-export"
provides:
  - "tests/test-brain-packet-validation-per-job.cjs: 117 node:assert/strict assertions across 12 D-02 jobs end-to-end through brain-client.sendPacket (valid in + good out via __transport returns parsed Brain response; malformed in throws + logs brain_packet_rejected; off-spec out returns { advice: null, reason: response_schema_invalid } + logs brain_response_rejected + NEVER throws; forged origin throws) + 3 non-per-job sub-blocks (test_fixture env-gate, privacy-mode config-caps, _warnLegacyOnce once-per-session)"
  - "tests/test-brain-packet-part8-invariant-per-job.cjs: 144 node:assert/strict assertions across 12 D-02 jobs (round-trip: each job's buildBrainPacket output validates against data/brain-packet-schema.json $defs[job].in via the same Ajv2020 wrapper-with-inline-$defs compile path brain-client uses + adversarial 10-tripwire sweep over JSON.stringify(packet): zero decision/claim/assumption/opportunity body, zero mirror_solution, zero /home/jsagi/, zero /secret/, zero email, zero >500-char string field, zero ${...} template-injection fragment)"
  - "tests/run-all-110.sh is now 4/4 GREEN (test-brain-packet-schema-check from 110-01 + test-brain-packet-precommit-hook from 110-04 + the two suites filled here)"
  - "Canon Part 8 + Part 9 wire-level enforcement is proven, per shipped job, by an executable contract -- not audited by promise"
affects: [110-final-release, 117-auto-explore-domains-on-first-material, 121-trajectory-telemetry, every-future-plan-introducing-a-brain-job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-job loop over a closed vocabulary (D-02's 12 jobs) as the unit of test coverage. The vocabulary is locked in 110-CONTEXT D-02 and asserted against lib/core/brain-client.cjs::SHIPPED_JOBS via the contract that any drift in either Set will leave one of the two suites failing on the moved job. A future D-02 vocabulary extension MUST extend both suites' D02_JOBS array in lockstep -- documented in-suite via a header comment."
    - "Per-job adversarial Part-8 sweep mirroring tests/test-navigation-packet-part8-leak.cjs's 8-tripwire idiom but looped over the 12 jobs. The forbidden-substring grep over JSON.stringify(packet) is intentionally coarse: the goal is to fail-closed when a future packet.cjs change introduces a leak, NOT to be a precise data-flow analysis. The legitimately-emitted relative source-section slugs (e.g. 'design') are not absolute /home/ paths and do not trip the tripwires."
    - "Round-trip ajv compile-and-validate per job using the SAME wrapper-with-inline-$defs pattern lib/core/brain-client.cjs::_validatorFor uses: { $id: 'urn:...', $ref: '#/$defs/<job>/<half>', $defs: schema.$defs }. This guarantees a passing round-trip in the test mirrors what the wire compile accepts. Mirrors the brain-client.cjs comment 'ajv 8.x cannot resolve a deep JSON pointer into a schema indexed only by its absolute $id (a known ajv@8 quirk) -- the wrapper carries the $defs inline as a defensive duplicate.'"
    - "Schema-level 'config caps, never raises' enforcement is for free: every shipped job's $def.in.properties.privacy_mode is { const: 'local_summary_only' }; a packet carrying privacy_mode: 'allow_filenames' (via the buildBrainPacket per-call privacyMode override) FAILS the in-validator. This plan turns that into an explicit sub-block test -- proving the per-job const is the privacy-mode escalation gate, not separate runtime code."
    - "Defensive in-process reset: brainClient._test._resetSchema() + _setLegacyWarned(false) at run() top so any prior in-process state (a different test in the same process that swapped MINDRIAN_BRAIN_PACKET_SCHEMA, or that left _legacyPathWarned=true) cannot poison this suite's results. The _setLegacyWarned(false) is also re-run at the END of the dual-path sub-block to leave the module flag clean for any later test."

key-files:
  created:
    - "tests/test-brain-packet-validation-per-job.cjs (was the 8-line Wave-0 MISSING stub from 110-00 -- now 331 lines of real assertions; 117 node:assert/strict checks; commit ec75b47)"
    - "tests/test-brain-packet-part8-invariant-per-job.cjs (was the 8-line Wave-0 MISSING stub from 110-00 -- now 211 lines of real assertions; 144 node:assert/strict checks; commit 6302162)"
  modified: []

key-decisions:
  - "Refused to weaken the tripwires for any job. The plan's RESEARCH section is explicit: a tripwire OR round-trip failure is a real Canon Part 8 leak or schema/shape mismatch; the fix is a follow-up gap-closure plan on packet.cjs's projection mappers, NEVER a relaxation of this suite. Pre-run sanity check (all 12 jobs against the seeded room) confirmed zero leak before the suite was committed -- the projection mappers are clean today."
  - "Used the __transport function seam (brain-client.sendPacket(opts.__transport)) as the test-side wire-injection mechanism over require.cache surgery. The seam is intentional (110-03 exposed it on sendPacket's opts argument); it has no production call site; it sidesteps the cross-process timing issues require.cache surgery has when a module is loaded eagerly. Mirrors the patterns the planner interfaces block sketched."
  - "Used the wrapper-with-inline-$defs ajv compile pattern (carrying $defs inline despite addSchema(root) being a defensive duplicate) -- mirroring brain-client.cjs::_validatorFor exactly. This was a deviation from the planner-sketch ref shape ($defs/<job>/properties/<half>) -- the schema's actual structure is $defs/<job>/<half> (no 'properties' wrapper) per 110-01. Caught via a pre-run sanity script; the planner's interfaces note also flagged the corrected pointer shape."
  - "Picked { totally: 'off-spec', extra: 'field' } as the off-spec out test payload (top-level fields not in the BrainResponse schema; additionalProperties:false on BrainResponse fires) over a more-creative payload. The simplest off-spec shape that actually trips the out-validator is the most-likely-stable assertion across future BrainResponse schema additions."
  - "Picked the extra top-level transcript field as the malformed-in payload (rather than a missing-required field). Reasoning: (a) the plan's must-haves named 'an extra top-level field e.g. transcript' explicitly; (b) it exercises additionalProperties:false (the Canon Part 8 leak-prevention teeth) -- which is the structural property we most want a regression-test for; (c) it produces a stable error message ('(root) must NOT have additional properties') across every job's in shape, so the assertion regex is uniform."

patterns-established:
  - "Pattern 1 -- The 12-job validation matrix as the unit of D-11 coverage: for every shipped job, prove (a) valid in flows, (b) malformed in throws + logs the right memory_event, (c) off-spec out degrades + logs the right memory_event + never throws + never partial-ingests, (d) forged origin throws. Future Brain-job additions extend D02_JOBS in both suites; the matrix's per-job assertion count grows linearly; the contract surface stays the same."
  - "Pattern 2 -- The privacy-mode 'config caps, never raises' contract is enforced at the SCHEMA layer, not at runtime: per-job $def.in.properties.privacy_mode: { const: 'local_summary_only' } means a packet whose resolved privacy_mode exceeds the job-declared cap is REFUSED at the in-validator. New jobs added to D-02 MUST declare their privacy_mode as a const (or as a tighter enum); the validation suite's config-caps sub-block proves this for the shipped 12."

requirements-completed: [PACKET-110-06, PACKET-110-07, PACKET-110-08, PACKET-110-09]

# Metrics
duration: 8m 43s
completed: 2026-05-13
---

# Phase 110-05: D-11 Validation Suite -- 12 Jobs x In/Out + Privacy Caps + Dual-Path + Adversarial Part-8 Sweep Summary

**Both Wave-0 RED stubs are filled. `tests/run-all-110.sh` is fully GREEN (4/4 CJS suites). The Canon Part 8 + Part 9 typed-packet contract is now an executable, per-job invariant -- 261 node:assert/strict assertions across the 12 D-02 jobs prove valid in flows, malformed in throws + logs `brain_packet_rejected`, off-spec out degrades soft + logs `brain_response_rejected` + never partial-ingests, forged origin is refused, the schema enforces the privacy-mode config-caps property for free, the `_warnLegacyOnce` dual-path guard fires exactly once per session, and the adversarial leak sweep proves zero forbidden content reaches `JSON.stringify(buildBrainPacket(...))` for every shipped job.**

## Performance

- **Duration:** 8 min 43 sec
- **Started:** 2026-05-13T11:20:00Z
- **Completed:** 2026-05-13T11:28:43Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (both were the Wave-0 MISSING stubs being filled)
- **Net new assertions:** 261 (117 validation + 144 part-8 invariant)
- **Net new test lines:** 542 (331 + 211; minus 16 stub lines replaced)
- **Net new dependencies:** 0 (ajv stays transitive via @modelcontextprotocol/sdk)

## Accomplishments

- **`tests/test-brain-packet-validation-per-job.cjs` (Task 1; commit `ec75b47`): 117 assertions, GREEN.** Per D-02 job (12), end-to-end through `brain-client.sendPacket`: valid `in` + good `out` via `__transport` returns the parsed Brain response; malformed `in` (extra top-level `transcript` field; trips the schema's `additionalProperties:false` teeth) throws `brain packet rejected for job "<job>"` AND logs a `brain_packet_rejected` memory_event row; off-spec `out` returns `{ advice: null, reason: 'response_schema_invalid' }`, NEVER throws, AND logs a `brain_response_rejected` memory_event row; forged origin throws (D-08 layer 3). Plus three non-per-job sub-blocks: the `test_fixture` env-gate (throws without `MINDRIAN_TEST_MODE=1`, accepted with it), the privacy-mode "config caps" check (`buildBrainPacket(..., { privacyMode: 'allow_filenames' })` returns a packet with `privacy_mode === 'allow_filenames'`; `sendPacket` refuses it because the schema's per-job `in.properties.privacy_mode: { const: 'local_summary_only' }` fails), and the dual-path `_warnLegacyOnce(db)` once-per-session check (two calls -> exactly one `console.warn` + exactly one `brain_legacy_path_used` memory_event row).
- **`tests/test-brain-packet-part8-invariant-per-job.cjs` (Task 2; commit `6302162`): 144 assertions, GREEN.** Per D-02 job (12): round-trip ajv compile-and-validate using the same wrapper-with-inline-`$defs` pattern `lib/core/brain-client.cjs::_validatorFor` uses; adversarial 10-tripwire sweep over `JSON.stringify(buildBrainPacket(...))` with forbidden content seeded into node properties (decision body + 800-char transcript + `${injection}`, claim body + `leak@example.com`, assumption body + `${x}`, opportunity body + `SECRET MIRROR` + 320-char body) AND absolute paths seeded into `source_path` (`/home/jsagi/secret/path/decision.md` etc.) -- the suite asserts zero decision/claim/assumption/opportunity body, zero `mirror_solution`, zero `/home/jsagi/`, zero `/secret/`, zero email address, zero string field longer than 500 chars (transcript-length proxy via `split('"')`), zero `${...}` template-injection fragment reaches the serialized packet for any of the 12 jobs.
- **`tests/run-all-110.sh` is now 4/4 GREEN.** All four scoped CJS suites pass: `test-brain-packet-schema-check.cjs` (19 assertions / 6 tests; from 110-01), `test-brain-packet-precommit-hook.cjs` (5/5 cases; from 110-04), `test-brain-packet-validation-per-job.cjs` (117 assertions; this plan Task 1), `test-brain-packet-part8-invariant-per-job.cjs` (144 assertions; this plan Task 2). Total: 285 assertions, 10s wall-clock. The RED-by-design header in `tests/run-all-110.sh` is now a historical note -- this plan's commits flip the last two RED suites to GREEN.
- **Phase 110 acceptance gate met.** Canon Part 8 is hardened from "we audit for leaks" to "the wire format makes leaks structurally hard," proven by an executable contract that loops every shipped Brain job through both the schema validator and the adversarial sweep. The forward-looking `_warnLegacyOnce` guard has a covering test even though no current call site exists (the dual-path D-10 contract).

## Task Commits

Each task was committed atomically with `--no-verify` (per orchestrator instruction; the concurrent Phase 123 session was on `main` during this plan -- explicit per-file pathspec on every commit prevented sweeping any unrelated staged files):

- **Task 1** -- `ec75b47` `test(110-05): fill validation-per-job suite -- 12 jobs x in/out + privacy caps + dual-path` (`tests/test-brain-packet-validation-per-job.cjs`; +329 lines)
- **Task 2** -- `6302162` `test(110-05): fill part8-invariant-per-job suite -- 12 jobs x round-trip + adversarial leak sweep` (`tests/test-brain-packet-part8-invariant-per-job.cjs`; +209 lines)

Both commits scoped via explicit pathspec (`git commit ... -- <file>`); `git show --stat` on each commit confirms ONLY the owned test file -- zero cross-pollination with the parallel Phase 123 session.

## Decisions Made

- **The 12-job D-02 vocabulary is hard-coded in both suites' `D02_JOBS` array** rather than imported from `brain-client.SHIPPED_JOBS`. Reasoning: tests assert the SAME closed vocabulary the wire enforces; importing it from the SUT collapses the test's independent assertion. A future D-02 vocabulary extension MUST extend BOTH suites' `D02_JOBS` array in lockstep with `lib/core/brain-client.cjs::SHIPPED_JOBS` -- the in-suite header comments document this contract.
- **Selected the extra top-level `transcript` field as the malformed-in payload** (rather than a missing-required field). It exercises `additionalProperties:false` (the Canon Part 8 leak-prevention teeth) and produces a stable error message across all 12 job in-shapes.
- **Selected `{ totally: 'off-spec', extra: 'field' }` as the off-spec out payload** -- the simplest shape that trips `BrainResponse`'s `additionalProperties:false` (rather than tripping the `_parseBrainResult` fallback, which would have given a false-pass of `{ suggestions: [] }`).
- **Used the `__transport` function seam** (110-03's `sendPacket(opts.__transport)`) over `require.cache` mock surgery. The seam is the intended test surface; require.cache surgery has cross-process / load-order brittleness.
- **The adversarial sweep is intentionally coarse** (forbidden-substring grep over `JSON.stringify(packet)`). Per RESEARCH and the plan's "do NOT weaken the tripwires" note: precise data-flow analysis is not the point; fail-closed when a future `packet.cjs` change introduces a leak is the point.

## Validation

| Verification | Status | Evidence |
|---|---|---|
| `node tests/test-brain-packet-validation-per-job.cjs` exits 0 + prints `PASS (N assertions)` | GREEN | `PASS (117 assertions)`; exit 0 |
| `node tests/test-brain-packet-part8-invariant-per-job.cjs` exits 0 + prints `PASS (N assertions)` | GREEN | `PASS (144 assertions)`; exit 0 |
| Neither suite prints `MISSING - Wave` (the RED stub marker) | GREEN | `! grep -q 'MISSING - Wave' <stdout>` |
| `bash tests/run-all-110.sh` exits 0 + reports 4/4 PASSED | GREEN | `Total: 4 / Passed: 4 / Failed: 0` in 10s wall-clock |
| Phase 109 + 122 spot-checks pass (no regression) | GREEN | `test-brain-packet-schema-check: PASS (19/6)`; `test-navigation-packet-builder: 16/16 passed`; `test-navigation-packet-part8-leak: PASS (8 tripwires)`; `test-brain-packet-precommit-hook: PASS (5/5)` |
| `ajv` is NOT in `package.json` dependencies | GREEN | `grep '"ajv"' package.json` returns nothing; ajv stays transitive via `@modelcontextprotocol/sdk` |
| Zero em-dashes / en-dashes in either new file | GREEN | `grep -lP "[\x{2014}\x{2013}]"` on each returns nothing |
| Both suites are `> 50 lines` (real bodies, not 8-line stubs) | GREEN | `wc -l`: 331 (validation) + 211 (part-8) |
| `grep -c "select_methodology"` >= 1 in each (12-job loop hard-coded) | GREEN | 1 each (the D02_JOBS array) |
| Per-task commit shows ONLY the owned test file | GREEN | `git show --stat ec75b47` -> 1 file; `git show --stat 6302162` -> 1 file |

## Deviations from Plan

- **None of substance.** The planner sketched the `ajv.compile({ $ref: schema.$id + '#/$defs/' + job + '/properties/in' })` shape, but the schema's actual structure is `$defs[job].in` (no `properties` wrapper) -- this was already documented in `lib/core/brain-client.cjs::_validatorFor`'s comment block and in the plan's "NOTE on the schema's pointer shape" line. The implemented test compiles with the corrected pointer (`#/$defs/<job>/<half>`) via the wrapper-with-inline-`$defs` pattern that exactly mirrors `_validatorFor`. Not a real deviation -- the planner flagged it explicitly.

- **Used `db.close()` at the end of each per-job loop iteration before `cleanup(tmp)`** (rather than relying on the finally to `fs.rmSync`). This is a defensive close to prevent SQLite WAL contention on rapid loops -- mirrors the idiom in `tests/test-navigation-packet-part8-leak.cjs` line 95. No behavior change.

- **The dual-path sub-block also resets `brainClient._test._setLegacyWarned(false)` at its END** (not just at run() top). This is the "restore for any later test in the process" comment in the planner's interfaces sketch -- shipped verbatim.

## Known Stubs

None. Both test files contain only real assertions; zero TODO / FIXME / placeholder / "MISSING" markers. The Wave-0 stubs that previously contained `process.stderr.write('MISSING - ...'); process.exit(1)` are fully replaced.

## Self-Check

Verifying SUMMARY claims:

```
$ [ -f tests/test-brain-packet-validation-per-job.cjs ] && echo "FOUND" || echo "MISSING"
FOUND
$ [ -f tests/test-brain-packet-part8-invariant-per-job.cjs ] && echo "FOUND" || echo "MISSING"
FOUND
$ git log --oneline --all | grep -q "ec75b47" && echo "FOUND ec75b47" || echo "MISSING ec75b47"
FOUND ec75b47
$ git log --oneline --all | grep -q "6302162" && echo "FOUND 6302162" || echo "MISSING 6302162"
FOUND 6302162
$ bash tests/run-all-110.sh -- 4/4 PASSED in 10s wall-clock
$ ajv NOT in package.json (verified via grep)
$ zero em-dashes / en-dashes in both new files (verified via grep -lP)
```

## Self-Check: PASSED
