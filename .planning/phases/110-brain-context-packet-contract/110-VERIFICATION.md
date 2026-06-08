---
phase: 110-brain-context-packet-contract
verified: 2026-05-13T12:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "sendPacket end-to-end with a live Brain brain_packet tool"
    expected: "When the Brain repo ships a brain_packet MCP tool, sendPacket(packet, { db }) should return a schema-conformant { suggestions: [...] } payload and storeBrainSuggestions should land each as a brain_insight node with review_status: proposed; no brain_response_rejected should be logged."
    why_human: "The live Brain MCP server has no brain_packet tool as of v1.13.0-beta.3 (only brain_query / brain_write / brain_schema / brain_search / brain_stats / brain_ask). sendPacket correctly degrades to { advice: null, reason: 'brain_packet_tool_absent' } today. The __transport seam covers the in-process logic; the live wiring requires the Brain repo to ship the tool."
  - test: "D-08 layer-2 pre-commit hook blocking a real git commit (not just the subcommand in isolation)"
    expected: "git commit on a branch staging a lib/feature/foo.cjs with a bare sendPacket( not preceded by buildBrainPacket( should be blocked at .git/hooks/pre-commit with the [check-sendpacket] FAIL (D-08 layer 2) message. Adding buildBrainPacket( above it should allow the commit."
    why_human: "The unit test invokes check-schema-aliases.cjs --check-sendpacket via the MINDRIAN_HOOK_STAGED_FILES env seam, not through real git diff --cached staging. The installed hook is wired and byte-verified, but the full git index code path was not exercised as a real commit in this verification run."
  - test: "Canon Part 8 PR gate (brain-boundary-scan + Canon Custodian review)"
    expected: "The PR touching lib/core/brain-client.cjs should pass the brain-boundary-scan (check-brain-boundary.cjs -- not yet scaffolded) and receive explicit Canon Custodian sign-off per Canon Part 8 PR gate paragraph."
    why_human: "check-brain-boundary.cjs is still listed as 'pending / not yet scaffolded' in CANON-PHASE-MAP.md. The PR gate is a repository-layer gate, not a unit test. A manual reviewer must confirm sendPacket adds no parameter/log/side-channel that causes user data to reach the Brain."
  - test: "Release commit and npm lockstep publish"
    expected: "scripts/release.sh 1.13.0-beta.3 (or current beta number) enforces all 5 version-consistency gates (CHANGELOG / plugin.json / package.json / git tag / marketplace.json source.ref) and publishes @mindrian/os@next to npm."
    why_human: "The 5-gate release process and lockstep npm publish (scripts/release.sh Step 9.5) is a milestone-level action explicitly out of phase-plan scope per the Phase 109 precedent noted in 110-VALIDATION.md."
---

# Phase 110: Brain Context Packet Contract Verification Report

**Phase Goal:** Turn Canon Part 8 from "we audit for leaks" into "the wire format makes leaks structurally hard." Ship a typed JSON Schema for Brain Context Packets, per-job allowed input/output shapes for the closed-vocabulary Brain jobs (12 jobs per D-02), privacy modes with explicit user opt-in, schema validator middleware in lib/core/brain-client.cjs (invalid packets refuse to send, invalid responses refuse to ingest), test suite proving Canon Part 8 invariants hold for every shipped job type, dual-path rollout (legacy free-form + typed packet) deprecating to typed-only.

**Verified:** 2026-05-13T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | A typed JSON Schema exists at data/brain-packet-schema.json (draft 2020-12, all 12 D-02 jobs with in+out shapes, additionalProperties:false everywhere) | VERIFIED | File exists, 526 lines. node -e check confirms schema=$schema, $id, Origin enum, PrivacyMode enum, all 12 jobs present with in+out, all 12 in objects carry additionalProperties:false. build-brain-packet-schema.cjs --check exits 0 with 'brain-packet-schema: OK'. |
| 2 | scripts/build-brain-packet-schema.cjs --check tripwire exits non-zero on malformed schema (bad JSON, missing job def, unknown job, missing additionalProperties:false) | VERIFIED | test-brain-packet-schema-check.cjs PASS (19 assertions across 6 tests). Five distinct failure modes tested via MINDRIAN_BRAIN_PACKET_SCHEMA env seam. |
| 3 | buildBrainPacket returns origin: 'navigation_api' (D-08 layer 1) and privacy_mode as top-level fields; resolvePrivacyMode exported with per-call > config > default precedence | VERIFIED | grep confirms PRIVACY_MODES, resolvePrivacyMode, readRoomConfigPrivacyMode, roomHasExcerptApproval all exported from packet.cjs. test-navigation-packet-builder 16/16 (tests 11-16 cover origin stamp + privacy resolution chain including allow_excerpts cap-down). |
| 4 | EVENT_TYPES Set extended by 3 brain_* strings (brain_packet_rejected, brain_response_rejected, brain_legacy_path_used); size grew 32 -> 35 | VERIFIED | node -e confirms all 3 strings present and EVENT_TYPES.size === 35. memory-events.cjs grep shows Phase 110-02 extension block. test-navigation-memory-events 10/10. |
| 5 | brain-client.sendPacket() exists and enforces D-07 (reject hard / degrade soft), D-08 layer-3 origin allowlist, D-09 privacy caps | VERIFIED | node -e confirms typeof sendPacket === 'function'. test-brain-packet-validation-per-job PASS (117 assertions): 12 jobs x valid-in/good-out flow, malformed-in throws + logs brain_packet_rejected, off-spec-out degrades soft + logs brain_response_rejected + never throws, forged-origin throws, privacy config-caps enforced at schema layer, _warnLegacyOnce fires exactly once per session. |
| 6 | D-08 layer 2: scripts/check-schema-aliases.cjs --check-sendpacket exits non-zero on a bare sendPacket( not lexically preceded by buildBrainPacket( in the same staged file | VERIFIED | node -e confirms checkSendpacket exported, ALLOWED_SENDPACKET_FILES has 5 paths. test-brain-packet-precommit-hook PASS (5/5). Both hook source files have 6 occurrences of the new block keywords. |
| 7 | Pre-commit hook is wired: installed .git/hooks/pre-commit byte-matches scripts/hooks/pre-commit-room-minto-guard.sh; hook contains both the schema-drift tripwire and the --check-sendpacket guardian | VERIFIED | cmp -s returns 0 (installed-hook == source). .git/hooks/pre-commit exits 0 on clean tree. grep -c confirms 6 occurrences of build-brain-packet-schema and check-sendpacket in the installed hook. |
| 8 | Per-job round-trip: buildBrainPacket output validates against schema.$defs[job].in for all 12 jobs; adversarial 10-tripwire sweep proves no forbidden content (body/transcript/email/absolute-path/injection) leaks | VERIFIED | test-brain-packet-part8-invariant-per-job PASS (144 assertions). test-navigation-packet-part8-leak still PASS (8 tripwires). |
| 9 | All 9 PACKET-110-XX requirements registered as Complete in REQUIREMENTS.md; all 4 Phase 110 test suites registered in lib/memory/run-feynman-tests.cjs; bash tests/run-all-110.sh exits 0 (4/4) | VERIFIED | REQUIREMENTS.md shows 9 PACKET-110-0N rows all 'Complete'. run-feynman-tests.cjs has 8 Phase-110 references (4 comments + 4 path.join entries). run-all-110.sh: Total 4 / Passed 4 / Failed 0 in 10s. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| data/brain-packet-schema.json | Draft 2020-12 JSON Schema, 12 D-02 job $defs (in+out), additionalProperties:false everywhere, $id https://mindrian-os.com/schemas/brain-packet/1.0 | VERIFIED | 526 lines. All 12 jobs confirmed. ajv2020 strict-compile passes. |
| scripts/build-brain-packet-schema.cjs | --check tripwire with 4 failure modes + recovery line; MINDRIAN_BRAIN_PACKET_SCHEMA env seam | VERIFIED | 216 lines, mode 0755. exits 0 on shipped schema. test suite covers 5 failure cases. |
| lib/core/navigation/packet.cjs | buildBrainPacket emits origin + privacy_mode; resolvePrivacyMode, readRoomConfigPrivacyMode, roomHasExcerptApproval, PRIVACY_MODES exported | VERIFIED | grep confirms all 4 exports. test-navigation-packet-builder 16/16. |
| lib/core/navigation/memory-events.cjs | EVENT_TYPES extended by 3 brain_* strings; size 35 | VERIFIED | node -e: all 3 strings present, size=35. |
| lib/core/brain-client.cjs | sendPacket(), _warnLegacyOnce(), full ajv middleware, __transport seam, _test block with 7 seams | VERIFIED | typeof sendPacket === 'function', typeof _warnLegacyOnce === 'function'. 117-assertion test suite passes end-to-end. |
| lib/core/navigation.cjs | logMemoryEvent re-export as 14th export | VERIFIED | grep shows logMemoryEvent: memoryEvents.logEvent at line 65. Object.keys(n).length === 16 (14 documented + 2 lifecycle additions). |
| scripts/check-schema-aliases.cjs | --check-sendpacket subcommand; ALLOWED_SENDPACKET_FILES (5 paths); checkSendpacket lexical scan | VERIFIED | 78 new lines. All 3 symbols confirmed via grep. |
| scripts/hooks/pre-commit-room-minto-guard.sh | 2 new hook blocks (schema-drift + --check-sendpacket); byte-matches scripts/hooks/pre-commit | VERIFIED | 6 occurrences of new block keywords. cmp -s scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh = match. |
| .git/hooks/pre-commit | Installed, byte-matches source, exits 0 on clean tree, has both new blocks wired | VERIFIED | cmp -s installed-hook == source. exits 0. grep -c = 6. |
| tests/test-brain-packet-schema-check.cjs | 168 lines, 19 assertions, 6 tests (child_process via env seam) | VERIFIED | PASS (19 assertions across 6 tests). wc -l: 168. |
| tests/test-brain-packet-validation-per-job.cjs | 331 lines, 117 assertions (12 jobs x in/out + 3 sub-blocks) | VERIFIED | PASS (117 assertions). wc -l: 331. No MISSING stub markers. |
| tests/test-brain-packet-part8-invariant-per-job.cjs | 211 lines, 144 assertions (12 jobs x round-trip + adversarial sweep) | VERIFIED | PASS (144 assertions). wc -l: 211. |
| tests/test-brain-packet-precommit-hook.cjs | 132 lines, 5 cases (child_process hook test) | VERIFIED | PASS (5/5 assertions). wc -l: 132. |
| tests/run-all-110.sh | 4/4 GREEN exit 0 | VERIFIED | Total: 4 / Passed: 4 / Failed: 0 / Time: 10s |
| data/ROOM.md | Row for brain-packet-schema.json + cross-ref to build-brain-packet-schema.cjs | VERIFIED | Confirmed in 110-01-SUMMARY.md verification receipts; grep confirmed in test receipt. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| buildBrainPacket (navigation/packet.cjs) | origin: 'navigation_api' field on packet | D-08 layer 1 stamp | VERIFIED | test16_originStamp in test-navigation-packet-builder passes. Every packet gets origin set at construction. |
| sendPacket (brain-client.cjs) | schema.$defs[job].in ajv validation | _validatorFor(job, 'in') wrapper-with-inline-$defs pattern | VERIFIED | 117-assertion suite: malformed-in throws for all 12 jobs. |
| sendPacket response path | schema.$defs[job].out ajv validation | _validatorFor(job, 'out'); reject hard, degrade soft | VERIFIED | off-spec-out returns { advice: null, reason: 'response_schema_invalid' } for all 12 jobs; never throws. |
| sendPacket | memory_event logging for 3 brain_* types | _logEventBestEffort -> navigation.cjs::logMemoryEvent | VERIFIED | brain_packet_rejected logged on bad in; brain_response_rejected logged on bad out; brain_legacy_path_used logged by _warnLegacyOnce. |
| pre-commit hook | --check-sendpacket subcommand | scripts/check-schema-aliases.cjs dispatch | VERIFIED | cmp -s of installed hook == source; grep confirms both blocks wired; pre-commit exits 0 on clean tree. |
| pre-commit hook | schema-drift tripwire | build-brain-packet-schema.cjs --check (fires when schema or script is staged) | VERIFIED | hook block confirmed in both source files with 6 keyword occurrences. |
| resolvePrivacyMode | privacy_mode const per-job enforcement | schema.$defs[job].in.properties.privacy_mode: { const: 'local_summary_only' } | VERIFIED | config-caps sub-block in 117-assertion suite: allow_filenames packet rejected by per-job const. |
| 4 new test suites | lib/memory/run-feynman-tests.cjs TEST_FILES[] | path.join entries in Phase 110 comment block | VERIFIED | 8 Phase-110 references confirmed (4 comments + 4 path.join). |

---

### Data-Flow Trace (Level 4)

Phase 110 is a wire-contract and test phase; it does not render dynamic data. All artifacts are validators, schemas, hooks, and test suites. The key "data flow" is: `buildBrainPacket(db, job, focusNodeId, opts)` -> packet object -> `sendPacket(packet, opts)` -> ajv validate in -> callTool('brain_packet') -> ajv validate out -> return parsed | degrade. This is proven by the 117-assertion and 144-assertion suites, not by a rendering trace.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| brain-client.sendPacket | packet.origin | buildBrainPacket stamp | navigation_api (closed enum) | FLOWING -- enforced by D-08 layer-1 + layer-3 + schema enum |
| brain-client.sendPacket | validated in payload | schema.$defs[job].in via ajv | all 12 jobs validated end-to-end | FLOWING |
| brain-client.sendPacket | out response | Brain MCP (absent today) | degrades to { advice: null, reason: 'brain_packet_tool_absent' } | CORRECT DEGRADE -- Brain-side tool is out of scope |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| run-all-110.sh exits 0 (4/4 suites GREEN) | bash tests/run-all-110.sh | Total: 4 / Passed: 4 / Failed: 0 / Time: 10s | PASS |
| schema --check tripwire exits 0 | node scripts/build-brain-packet-schema.cjs --check | brain-packet-schema: OK | PASS |
| --check-sendpacket exits 0 on clean tree | node scripts/check-schema-aliases.cjs --check-sendpacket | (exit 0, no output -- empty staged set) | PASS |
| pre-commit hook exits 0 on clean tree | bash .git/hooks/pre-commit | (exit 0) | PASS |
| installed hook byte-matches source | cmp -s .git/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh | installed-hook == source | PASS |
| ajv NOT a direct dependency | grep '"ajv"' package.json | (no match, grep exit 1) | PASS |
| sendPacket function exported | node -e "typeof require('./lib/core/brain-client.cjs').sendPacket" | function | PASS |
| _warnLegacyOnce function exported | node -e "typeof require('./lib/core/brain-client.cjs')._warnLegacyOnce" | function | PASS |
| logMemoryEvent re-exported from navigation.cjs | node -e "typeof require('./lib/core/navigation.cjs').logMemoryEvent" | function | PASS |
| buildBrainPacket re-exported from navigation.cjs | node -e "typeof require('./lib/core/navigation.cjs').buildBrainPacket" | function | PASS |
| EVENT_TYPES has all 3 brain_* strings; size 35 | node -e "const m=require('./lib/core/navigation/memory-events.cjs'); ..." | true true true 35 | PASS |
| ajv2020 resolvable as transitive dep | node -e "const a=require('ajv/dist/2020').default||require('ajv/dist/2020'); console.log('ajv2020 resolvable:', !!a)" | ajv2020 resolvable: true | PASS |
| Phase-109 regression: test-navigation-packet-builder | node tests/test-navigation-packet-builder.cjs | 16/16 passed | PASS |
| Phase-109 regression: test-navigation-packet-part8-leak | node tests/test-navigation-packet-part8-leak.cjs | PASS (8 tripwires) | PASS |
| All 14 Phase-110 commits on main | git log --oneline --all grep | 14/14 found | PASS |
| All 9 PACKET-110 requirements Complete in REQUIREMENTS.md | grep PACKET-110 .planning/REQUIREMENTS.md | 9 Complete rows | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PACKET-110-01 | 110-01 | Brain packet schema artifact (data/brain-packet-schema.json -- draft 2020-12, 12 jobs, additionalProperties:false everywhere) | SATISFIED | File exists, 526 lines, all 12 jobs confirmed with in+out+additionalProperties:false. build-brain-packet-schema.cjs --check exits 0. |
| PACKET-110-02 | 110-01 | scripts/build-brain-packet-schema.cjs --check tripwire (malformed JSON/missing job/unknown job/missing additionalProperties:false -> non-zero) | SATISFIED | test-brain-packet-schema-check PASS (19 assertions / 6 tests -- covers all 4 failure modes). |
| PACKET-110-03 | 110-03 | sendPacket(packet, opts) -- D-08 layer-3 origin allowlist + unknown-job guard + ajv in-validation (reject hard, log brain_packet_rejected) + callTool transport (degrade soft on absent/error) + ajv out-validation (reject hard, degrade soft, log brain_response_rejected) | SATISFIED | test-brain-packet-validation-per-job PASS (117 assertions). 14 behaviors verified end-to-end in 110-03 plan. |
| PACKET-110-04 | 110-03 | Response-validate-then-degrade gate inside sendPacket: bad out -> degrade, log brain_response_rejected, NEVER throw, NEVER partial-ingest | SATISFIED | 117-assertion suite: off-spec-out returns { advice:null, reason:'response_schema_invalid' } for all 12 jobs; 0 throws logged on bad out path. |
| PACKET-110-05 | 110-04 | D-08 layer 2: scripts/check-schema-aliases.cjs --check-sendpacket; two pre-commit hook blocks wired + re-installed via setup-hooks.sh | SATISFIED | test-brain-packet-precommit-hook PASS (5/5). cmp -s = match. grep -c = 6 in installed hook. |
| PACKET-110-06 | 110-02 | buildBrainPacket returns origin: 'navigation_api'; EVENT_TYPES +3 strings; produced packet round-trips against schema.$defs[job].in | SATISFIED | test-navigation-packet-builder 16/16 (tests 11-16 cover origin). test-brain-packet-part8-invariant-per-job PASS (144 assertions -- round-trip confirmed for all 12 jobs). |
| PACKET-110-07 | 110-02 | Privacy-mode opt-up: resolvePrivacyMode per-call > config > default; allow_excerpts caps down absent Part-3 APPROVE; config-caps enforced structurally at schema layer | SATISFIED | resolvePrivacyMode confirmed exported. test-navigation-packet-builder test15 (privacyModeAllowExcerptsCapsDown). 117-assertion suite: config-caps sub-block confirms per-job const enforcement. |
| PACKET-110-08 | 110-03 | Dual-path + once-per-session deprecation: _warnLegacyOnce + _legacyPathWarned; as of v1.13.0-beta.3 no legacy job call site exists; v1.14.0 deletes the guard | SATISFIED | typeof _warnLegacyOnce === 'function'. 117-assertion suite dual-path sub-block: console.warn fires exactly once, brain_legacy_path_used logged exactly once. |
| PACKET-110-09 | 110-04 + 110-05 | D-08 layer-2 pre-commit check (part of D-11); per-job D-11 suite (a/b/c + d invariant): valid in flows, malformed in refused + logged, off-spec out degraded + logged, no forbidden content in buildBrainPacket output | SATISFIED | test-brain-packet-precommit-hook PASS (5/5). test-brain-packet-validation-per-job PASS (117 -- D-11 a/b/c). test-brain-packet-part8-invariant-per-job PASS (144 -- D-11(d) adversarial sweep, 10 tripwires per job). |

All 9 PACKET-110 requirements: SATISFIED. Confirmed Complete in .planning/REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | No TODO/FIXME/placeholder/MISSING markers found in any Phase 110 artifact | -- | -- |
| (none) | -- | No em-dashes or en-dashes in any Phase 110 file | -- | -- |
| (none) | -- | No ajv in package.json direct dependencies (transitive only) | -- | -- |
| (none) | -- | No stub implementations: all 4 test files are substantive (842 total lines; 0 MISSING markers) | -- | -- |

No blockers or warnings found. All anti-pattern scans clean.

---

### Known Good: D-05 through D-11 Compliance

| Decision Rule | Status | Evidence |
|---------------|--------|---------|
| D-05: ajv bundled, never direct dep | PASS | grep '"ajv"' package.json returns no match. node -e "require('ajv/dist/2020')" resolves via @modelcontextprotocol/sdk transitive. |
| D-06: data/brain-packet-schema.json + build-brain-packet-schema.cjs --check pre-commit tripwire | PASS | Schema at canonical path. --check exits 0. Both new hook blocks wired (6 occurrences). |
| D-07: sendPacket validates in before send (reject hard); validates out (degrade soft, never throw, never partial-ingest) | PASS | 117-assertion suite: bad-in throws, bad-out returns sentinel, never throws on bad-out path. |
| D-08: 3-layer origin guarantee (schema enum + pre-commit hook + brain-client allowlist); no nonce | PASS | Layer 1: origin stamped by buildBrainPacket. Layer 2: --check-sendpacket hook. Layer 3: sendPacket allowlist check runs first. test-brain-packet-precommit-hook 5/5. |
| D-09: local_summary_only default; allow_filenames via config flag; allow_excerpts via config AND Part-3 gate; config caps, never raises; no shipped allow_excerpts consumer | PASS | resolvePrivacyMode exported with correct precedence. allow_excerpts caps down (test15). config-caps enforced at schema const layer (117-assertion suite). roomHasExcerptApproval returns false (no shipped consumer). |
| D-10: dual-path through v1.13.0-final; once-per-session warn + brain_legacy_path_used; NO current legacy job call site; v1.14.0 deletes legacy path; raw-Cypher query/write/search PERMANENT | PASS | _warnLegacyOnce exported and tested. Dual-path sub-block in 117-assertion suite: warn fires exactly once. No legacy free-form job call site exists in the codebase. |
| D-11: per-job in/out validation tests + Part-8-invariant grep sweep + --check tripwire test + pre-commit-hook test; node assert + child_process; tests/run-all-110.sh | PASS | run-all-110.sh: 4/4 GREEN. 261 total assertions (117 validation + 144 part-8 invariant). --check tripwire tested by 19-assertion suite. Pre-commit hook tested by 5-case suite. |

---

### Human Verification Required

#### 1. sendPacket live Brain end-to-end

**Test:** In a fixture room with a MINDRIAN_BRAIN_API_KEY set, call `navigation.buildBrainPacket(db, 'suggest_next_move', focusId)`, then `brain-client.sendPacket(packet, { db })`. Confirm the Brain returns a schema-conformant out (a `{ suggestions: [...] }` shape), confirm storeBrainSuggestions lands each suggestion as a brain_insight node with `review_status: 'proposed'`, confirm no `brain_response_rejected` was logged.

**Expected:** A non-empty `suggestions` array returned and ingested as proposed nodes.

**Why human:** The live Brain MCP server has no `brain_packet` tool today. sendPacket correctly degrades to `{ advice: null, reason: 'brain_packet_tool_absent' }`. The __transport seam covers all in-process validation logic. This test requires the Brain repo to ship the tool first.

#### 2. D-08 layer-2 hook blocking a real git commit

**Test:** On a scratch branch, `git add` a new `lib/feature/foo.cjs` containing `const r = await require('../core/brain-client.cjs').sendPacket(packet);` with no `buildBrainPacket(` above it. Run `git commit -m test`. Confirm the commit is BLOCKED with the `[check-sendpacket] FAIL (D-08 layer 2)` message. Then add `const packet = require('../core/navigation.cjs').buildBrainPacket(db, 'suggest_next_move', focusId);` above the `sendPacket(` line. Run `git commit` again. Confirm it now succeeds.

**Expected:** First attempt blocked; second attempt passes.

**Why human:** Unit test covers the subcommand via the MINDRIAN_HOOK_STAGED_FILES env seam. The full git index code path (real `git diff --cached` staging) was not exercised in automated verification.

#### 3. Canon Part 8 PR gate

**Test:** At PR time, run the brain-boundary-scan (check-brain-boundary.cjs -- not yet scaffolded) over the Phase 110 diff. Confirm sendPacket adds no parameter/log/side-channel that causes user data to reach the Brain. Obtain Canon Custodian sign-off.

**Expected:** Scan passes (sendPacket sends only the typed packet constrained by additionalProperties:false; all logMemoryEvent calls are LOCAL). Custodian sign-off granted.

**Why human:** check-brain-boundary.cjs is listed as 'pending' in CANON-PHASE-MAP.md. The PR gate is a repository-layer gate, not a unit test.

#### 4. Release commit and npm lockstep publish

**Test:** After passing verification, run `scripts/release.sh 1.13.0-beta.3` (or the current beta number). Confirm it enforces all 5 version-consistency gates (CHANGELOG / plugin.json / package.json / git tag / marketplace.json source.ref) and publishes `@mindrian/os@next` to npm.

**Expected:** Release succeeds; @mindrian/os@next updated on npm.

**Why human:** The 5-gate release process and lockstep npm publish is a milestone-level action explicitly out of phase-plan scope per the Phase 109 precedent and 110-VALIDATION.md.

---

### Gaps Summary

None. All 9 PACKET-110 requirements are satisfied and Complete. All automated checks pass at 4/4. No blockers, no stubs, no anti-patterns. The 4 human verification items above are post-release-soak / tool-availability gates that do not block a `passed` status (all are either awaiting the Brain repo to ship a tool, or are process-level gates that cannot run without a real git staging or a Canon Custodian).

The Phase 110 acceptance gate is met: Canon Part 8 is hardened from "we audit for leaks" to "the wire format makes leaks structurally hard," proven by an executable contract that loops every shipped Brain job through both the schema validator and the adversarial sweep.

---

_Verified: 2026-05-13T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
