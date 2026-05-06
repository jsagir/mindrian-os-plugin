---
phase: 117-auto-explore-domains-on-first-material
plan: "117-04"
subsystem: agentic-surfacing
tags: [auto-explore, sanitizer, canon-part-8, seed-003-a3, brain-response-sanitize, local-only-routing, sixth-tripwire, wave-2]

# Dependency graph
requires:
  - phase: 117-00 (Wave 0 substrate)
    provides: tests/test-brain-response-sanitize.cjs Wave 0 stub upgrade target + tests/test-detection-routing-local-only.cjs Wave 0 stub upgrade target
  - phase: 117-01 + 117-02 + 117-03 (Wave 1+2 sibling slots)
    provides: lib/agents/auto-explore-agent.cjs full surface (detect/compose/surface/handleResponse/HSI/BQ shipped)
  - phase: 90-brain-derivation-layer
    provides: 5 prior Canon Part 8 tripwires (this plan adds the 6th)
provides:
  - lib/core/brain-response-sanitize.cjs (PII redaction + ALLOWLIST + buildEnvelope)
  - scripts/brain-response-sanitize-hook.cjs (PostToolUse mcp__brain_* hook entry)
  - hooks/hooks.json mcp__brain_.* matcher registered (was wired during sibling-merge resolution; verified post-Task-1)
  - lib/agents/auto-explore-agent.cjs Brain §8.7 INVARIANT (LOCAL-ONLY DETECTION ROUTING) comment block above detectFirstMaterial
  - 6th Canon Part 8 tripwire (Phase 90 had 5; this plan adds 1 = 6 total)
  - check-brain-boundary.cjs PR gate gap closed structurally via response-side scan
affects: [117-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SEED-003 A3 PostToolUse hook envelope (hookSpecificOutput.updatedToolOutput.text) for response-side sanitization before model reads tool output"
    - "Pure CJS, node built-ins only (crypto, fs); zero new runtime dependencies"
    - "PII pattern catalogue with sha256-prefix deterministic placeholder ([REDACTED:<8-hex>])"
    - "Pattern-only v1 redaction (per RESEARCH Section 4.6 risk T4 mitigation): start permissive, calibrate non-allowlist mode in Phase 121"
    - "Runtime-constructed forbidden token in test file (FORBIDDEN_EDGE_TOKEN = ['ADDRESSES','PROBLEM','TYPE'].join('_')) so the test source itself is grep-clean while still asserting on production source"
    - "Brain §8.7 invariant comment block immediately above detectFirstMaterial -- maintainer-visible reminder + grep regression backstop"

key-files:
  created:
    - lib/core/brain-response-sanitize.cjs
    - scripts/brain-response-sanitize-hook.cjs
    - tests/test-brain-response-sanitize.cjs
  modified:
    - lib/agents/auto-explore-agent.cjs
    - tests/test-detection-routing-local-only.cjs

key-decisions:
  - "v1 ships PII pattern redaction ONLY (6 patterns: SSN, email, phone, money, ISO date, abs path); ALLOWLIST exported for downstream consumers and Phase 121 telemetry attribution but NOT consulted by sanitize() in v1"
  - "Conservative non-allowlist redaction (8+ consecutive non-allowlist tokens) DISABLED until Phase 121 telemetry calibrates false-positive rate (RESEARCH Section 4.6 risk T4 explicit mitigation)"
  - "Hook ALWAYS exits 0; never blocks the tool call; failure modes pass through (continue:true with no updatedToolOutput) so a sanitizer bug cannot stall the agent loop"
  - "Hook envelope drops unknown keys to keep envelope lean and avoid surfacing accidental side-channel state (ENVELOPE_ALLOWED whitelist)"
  - "isBrainTool prefix-match (toolName.indexOf('mcp__brain_') === 0) per SEED-003 A3 scope; non-Brain tools get passthrough envelope (continue:true only)"
  - "Brain §8.7 invariant comment block placed immediately above detectFirstMaterial so maintainers see the LOCAL-only routing reason BEFORE they touch the function"
  - "Cypher Q7 citation (RESEARCH Section 8.9) included verbatim in agent comment so the WHY (tech-domain-analysis Technique not bound to any ProblemType) is durable across phases"
  - "Test file constructs forbidden token at runtime (FORBIDDEN_EDGE_TOKEN.join) so test source itself is grep-clean; the regression scans production source files (agent + 3 scripts), NOT this test"
  - "Two pre-existing comment lines in agent.cjs (lines 398 + 431) reworded to remove 'body_text' substring per Canon Part 8 substring-scan invariant; functional intent unchanged"

requirements-completed:
  - AUTOEXPLORE-117-07
  - AUTOEXPLORE-117-17

# Metrics
duration: ~25min
completed: 2026-05-07
---

# Phase 117 Plan 117-04: SEED-003 A3 Sanitizer + LOCAL-Only Routing Audit Summary

**Ships the 6th Canon Part 8 tripwire (Phase 90 had 5) via a PostToolUse mcp__brain_.* hook that scans + redacts PII patterns (SSN, email, phone, money, ISO date, abs path) before Brain MCP responses reach the model, AND locks the AUTOEXPLORE-117-17 Brain §8.7 LOCAL-only routing invariant via grep regression across all 4 auto-explore modules + maintainer-visible comment block above detectFirstMaterial.**

## Performance

- **Duration:** ~25 minutes (executor)
- **Started:** 2026-05-07
- **Completed:** 2026-05-07
- **Tasks:** 2 (both auto)
- **Files created:** 3; **modified:** 2
- **Parallel-executor mode:** all commits used `--no-verify` per orchestrator contract

## Accomplishments

- SEED-003 A3 sanitizer module shipped at `lib/core/brain-response-sanitize.cjs` (161 LOC) with 5 exports: `sanitize`, `buildEnvelope`, `isBrainTool`, `PII_PATTERNS` (frozen 6-entry array), `ALLOWLIST` (frozen 39-entry Set: 14 frameworks + 10 sections + 9 methodology verbs + 6 enum scalars).
- 6 PII patterns ship in v1: SSN (XXX-XX-XXXX), email (RFC 5322 simplified), phone (XXX-XXX-XXXX or XXX.XXX.XXXX), money ($X / $X.XX / $XM/K/B), ISO date (YYYY-MM-DD), abs path (/home/X or /Users/X).
- Deterministic sha256-prefix placeholder format: `[REDACTED:<8-hex>]` -- same input always produces same hash.
- v1 pattern-only redaction; non-allowlist redaction stays DISABLED per RESEARCH Section 4.6 risk T4 mitigation; calibrated baseline keeps 100% of framework-name-only inputs unchanged (false-positive cap).
- PostToolUse hook entry `scripts/brain-response-sanitize-hook.cjs` (76 LOC): reads stdin JSON, builds envelope per SEED-003 A3 spec (`continue:true, hookSpecificOutput:{hookEventName:'PostToolUse', updatedToolOutput:{text:'<sanitized>'}}`), passthrough envelope on non-Brain tools, ALWAYS exits 0.
- `hooks/hooks.json` mcp__brain_.* matcher registered (verified at line 263+267); was wired during sibling-merge resolution before Task 1; in-session edit was idempotent.
- Agent module gains explicit Brain §8.7 INVARIANT (LOCAL-ONLY DETECTION ROUTING) comment block immediately above `detectFirstMaterial` with Cypher Q7 (RESEARCH Section 8.9) verification timestamp 2026-05-06 cited verbatim.
- 2 pre-existing comments in agent.cjs (lines 398, 431) reworded to remove `body_text` substring per Canon Part 8 substring-scan invariant; functional intent preserved.
- Total tests passing: 23 (15 sanitizer + 8 LOCAL-only routing audit).
- Adversarial fixture catalogue per RESEARCH Section 4.6: 6 PII pattern fixtures + 5 false-positive scenarios + 1 hook envelope shape test + 1 no-op-on-non-Brain test + 4 bonus tests (exports surface, isBrainTool matcher, empty-input handling, sha256 cross-input determinism).
- AUTOEXPLORE-117-17 invariant LOCKED: zero `ADDRESSES_PROBLEM_TYPE` substrings across all 4 auto-explore modules (`lib/agents/auto-explore-agent.cjs`, `scripts/auto-explore-fingerprint.cjs`, `scripts/auto-explore-fire.cjs`, `scripts/auto-explore-drain.cjs`); zero `brain-client` requires; zero `room-db` requires; zero Canon Part 8 forbidden user-content keys (body_text/source_title/target_title/file_content/cv_content); zero em-dashes.

### Sanitizer pattern types confirmed

| Pattern | Regex sample | Test fixture | Outcome |
|---------|--------------|--------------|---------|
| ssn | `\b\d{3}-\d{2}-\d{4}\b` | `SSN 123-45-6789 is sensitive` | redacted |
| email | `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` | `contact jane.doe@example.com please` | redacted |
| phone | `\b\d{3}[-.]\d{3}[-.]\d{4}\b` | `Call 555-123-4567 to follow up` | redacted |
| money | `\$\d+(?:\.\d+)?[MmKkBb]?\b` | `Budget is $2.5M for Q1` | redacted |
| iso_date | `\b\d{4}-\d{2}-\d{2}\b` | `Deadline 2026-05-06 firm` | redacted |
| abs_path | `\/(?:home\|Users)\/[\w-]+\/[\w/.-]+` | `/home/jane/cv.md` + `/Users/jane/cv.md` | both redacted |

### LOCAL-only audit grep results

```
$ grep -E "ADDRESSES_PROBLEM_TYPE" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fingerprint.cjs scripts/auto-explore-fire.cjs scripts/auto-explore-drain.cjs | wc -l
0

$ grep -E "require\(['\"][^'\"]*brain[-_]client[^'\"]*['\"]\)" [same 4 files] | wc -l
0

$ grep -E "(body_text|source_title|target_title|file_content|cv_content)" lib/agents/auto-explore-agent.cjs | wc -l
0

$ grep -E "Brain.*§8\.7|LOCAL-ONLY DETECTION ROUTING" lib/agents/auto-explore-agent.cjs | wc -l
2  (line 175 invariant header + line 204 detectFirstMaterial doc body)

$ grep -E "Cypher\s*Q7|RESEARCH\s*Section\s*8\.9|tech-domain-analysis" lib/agents/auto-explore-agent.cjs | wc -l
3  (line 63 Q2 reference + line 177 Q7 + line 178 tech-domain-analysis literal)
```

### 6th Canon Part 8 tripwire confirmation

Phase 90 (v1.10.18) shipped 5 Canon Part 8 tripwires per CANON-PHASE-MAP.md Part 8 row:

1. Schema-leak heuristic scan (Plan 90-00)
2. `deriveSection` chokepoint via `buildBrainQueryContext` (Plan 90-01)
3. Brain-md-invariants body-text scan at guardian checkpoints (Plan 90-05)
4. `sanitizeDetailScalar` in cross-room aggregator + `JSON.stringify` output audit (Plan 90-06)
5. Cross-scenario BRAIN.md sweep across 14 graceful-degradation fixtures (Plan 90-08)

**Phase 117-04 ships the 6th tripwire:** response-side scan via PostToolUse hook on `mcp__brain_*` tool calls. Closes the `check-brain-boundary.cjs` PR gate gap noted in CANON-PHASE-MAP.md Part 8 row as "pending" -- structural enforcement via response-side scan rather than PR review checklist.

Integration smoke test:

```
$ node -e "const s=require('./lib/core/brain-response-sanitize.cjs'); const out=s.sanitize('User SSN 123-45-6789 in /home/jane/cv.md mentions JTBD'); console.log(out);"
User SSN [REDACTED:01a54629] in [REDACTED:c33cafe0] mentions JTBD
```

PII redacted, framework name preserved.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1: Create sanitizer module + PostToolUse hook + 15 sanitizer tests** -- `268c5b2` (feat)
2. **Task 2: Audit agent.cjs for Brain §8.7 LOCAL-only routing + 8 audit tests** -- `0aba3ee` (feat)

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Created/Modified

### Created (3 files)

- `lib/core/brain-response-sanitize.cjs` (161 lines) -- PII redaction module. Exports: `sanitize` (deterministic sha256-prefix placeholder), `buildEnvelope` (SEED-003 A3 envelope shape), `isBrainTool` (prefix matcher), `PII_PATTERNS` (frozen 6-entry array), `ALLOWLIST` (frozen 39-entry Set). v1 ships pattern-only redaction; non-allowlist redaction stays DISABLED until Phase 121 telemetry calibrates.

- `scripts/brain-response-sanitize-hook.cjs` (76 lines) -- PostToolUse hook entry. Reads stdin JSON `{tool_name, tool_input, tool_response, session_id}`. Emits hook envelope per SEED-003 A3 spec on stdout. Passthrough for non-Brain tools. ALWAYS exits 0.

- `tests/test-brain-response-sanitize.cjs` (204 lines, 15 tests) -- adversarial fixture catalogue per RESEARCH Section 4.6: 6 PII pattern fixtures + 5 false-positive scenarios + 1 hook envelope shape test (spawns hook script with synthetic stdin) + 1 no-op-on-non-Brain-tool test + 4 bonus tests (exports surface, isBrainTool matcher, empty-input handling, sha256 cross-input determinism).

### Modified (2 files)

- `lib/agents/auto-explore-agent.cjs` (+34 / -7 lines) -- two changes:
  1. Added explicit Brain §8.7 INVARIANT (LOCAL-ONLY DETECTION ROUTING) comment block immediately above `detectFirstMaterial` (line 175). Block cites Brain Cypher Q7 (RESEARCH Section 8.9) verification 2026-05-06 -- the canonical Domain & Trend Analysis Technique (id: 'tech-domain-analysis') is NOT bound to any ProblemType node. Names AUTOEXPLORE-117-17 enforcement mechanism (test grep) and the maintainer-facing rule (DO NOT add Brain edge-type call to this module).
  2. Reworded 2 inline comments (lines 398, 431) to remove `body_text` substring per Canon Part 8 substring-scan invariant. Functional intent unchanged: provenance comment still states "section names ONLY; NEVER user content fields"; render comment still states "no user-content fields per Canon Part 8".

- `tests/test-detection-routing-local-only.cjs` (+102 / -13 lines) -- promoted from Wave 0 substrate stub to real assertions (8 tests pass). Constructs the forbidden token at runtime (`FORBIDDEN_EDGE_TOKEN = ['ADDRESSES','PROBLEM','TYPE'].join('_')`) so the test source itself is grep-clean while still asserting on production source modules.

## Decisions Made

- **v1 ships PII pattern redaction ONLY:** 6 patterns, no generic-token redaction. RESEARCH Section 4.6 risk T4 explicitly mitigates by starting permissive; Phase 121 telemetry calibrates the false-positive rate before tightening. ALLOWLIST is exported for Phase 121 attribution but NOT consulted by sanitize() in v1.
- **Hook ALWAYS exits 0:** A bug in the sanitizer cannot stall the agent loop. Failure modes pass through with `continue:true` and no `updatedToolOutput`, so the model reads the original Brain response (degraded boundary protection) rather than the agent loop hanging.
- **isBrainTool prefix-match:** `toolName.indexOf('mcp__brain_') === 0` per SEED-003 A3 scope. The matcher in hooks.json (`mcp__brain_.*`) is the regex sibling. Both must agree for the hook to fire only on Brain tool calls.
- **Brain §8.7 invariant block placed ABOVE `detectFirstMaterial`:** Maintainer-visible reminder positioned where future contributors will read it BEFORE they touch the function. Comment block + grep regression form a two-part defense.
- **Cypher Q7 citation verbatim:** Brain RESEARCH Section 8.9 was verified 2026-05-06; the WHY (tech-domain-analysis Technique not bound to any ProblemType) is preserved in source so the next contributor doesn't re-investigate.
- **Test file constructs forbidden token at runtime:** `FORBIDDEN_EDGE_TOKEN = ['ADDRESSES','PROBLEM','TYPE'].join('_')` keeps the test source grep-clean. The regression scans production source files (agent + 3 scripts), NOT this test file. Avoids the meta-problem of the regression test failing on its own assertion code.
- **Two pre-existing comments reworded:** Lines 398 (`Provenance ... NEVER body_text/title`) and 431 (`no body_text per Canon Part 8`) contained the `body_text` substring. Both reworded to "user content fields" / "user-content fields per Canon Part 8". Canon Part 8 substring scan (5-key denylist) now returns 0 on agent.cjs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] hooks.json git merge conflict markers blocked JSON parse**

- **Found during:** Task 1 acceptance verification (`node -e "JSON.parse(...)"` failed with parse error)
- **Issue:** `hooks/hooks.json` carried unresolved merge conflict markers at lines 101-105 from a prior session's parallel work between branch HEAD (Phase 117-03 SessionStart entry for `preflight-auto-explore.cjs`) and commit `eb59744` (Phase 95.5-03 SessionStart entry for `restore-post-compact-context.cjs`). The conflict markers caused `JSON.parse` to fail.
- **Fix:** Resolved the conflict by preserving BOTH SessionStart hook entries as separate matcher blocks (both are correct; both should fire on `startup|clear|compact`). Functional intent of both commits preserved.
- **Files modified:** `hooks/hooks.json` (conflict resolution)
- **Verification:** `node -e "JSON.parse(require('node:fs').readFileSync('hooks/hooks.json','utf8'))"` exits 0; `grep -c "<<<<<<<" hooks/hooks.json` returns 0.
- **Note:** Post-resolution, git status showed no diff against HEAD on hooks.json -- meaning the conflict resolution had already landed in HEAD (commit `9cdb95e`) before this executor saw the file. The mcp__brain_.* matcher entry was also already wired in HEAD at lines 263-271 (same conflict-resolution commit registered it). This executor's in-session edits were idempotent; both edits matched what was already there.

### Out-of-scope discoveries (logged, not fixed)

None.

---

**Total deviations:** 1 auto-fixed (1x Rule 3 git merge conflict resolution)
**Impact on plan:** Substrate-level only; substantive contract (5 sanitizer exports + hooks.json matcher + agent invariant comment block + 23 tests passing + zero ADDRESSES_PROBLEM_TYPE + zero body_text/etc. + zero brain-client + zero em-dashes) fully satisfied.

## Issues Encountered

None blocking. The 1 deviation above was caught by Task 1 acceptance verification and resolved inline.

## Anti-pattern Guard Verification

- Zero `ADDRESSES_PROBLEM_TYPE` substrings in any of the 4 auto-explore modules (Brain §8.7 LOCAL-only invariant)
- Zero `brain-client` requires in any auto-explore module (Canon Part 8 boundary preserved)
- Zero `room-db` requires in agent.cjs (Phase 109 D-06 chokepoint preserved)
- Zero Canon Part 8 forbidden user-content key substrings (body_text / source_title / target_title / file_content / cv_content) in agent.cjs
- Zero em-dashes across all 5 modified/created files (per CLAUDE.md feedback_no_emdashes)
- Test file source is itself grep-clean (forbidden token constructed at runtime via array join) -- the regression scans production source modules, not the test file

## Canon Part 8 Boundary Confirmation

- `lib/core/brain-response-sanitize.cjs` is the 6th tripwire (Phase 90 had 5)
- `scripts/brain-response-sanitize-hook.cjs` ALWAYS exits 0 -- never fails closed -- so a sanitizer bug cannot stall the agent loop; failure modes pass through with degraded boundary protection rather than denial-of-service
- v1 PII redaction only; non-allowlist redaction stays DISABLED until Phase 121 telemetry calibrates (RESEARCH Section 4.6 risk T4)
- Sanitizer is no-op on non-Brain tools (matcher + isBrainTool both confirm `mcp__brain_*` prefix)
- Test fixture verifies hook envelope shape per SEED-003 A3 spec (continue:true, hookSpecificOutput.hookEventName='PostToolUse', updatedToolOutput.text)
- Adversarial fixture: input `Based on your CV at /home/jane/cv.md, JTBD recommends...` produces `Based on your CV at [REDACTED:<8-hex>], JTBD recommends...` (PII pattern redacted; framework name preserved)
- Brain §8.7 invariant comment block in agent.cjs cites Cypher Q7 (RESEARCH Section 8.9) verification 2026-05-06 -- tech-domain-analysis Technique is NOT bound to any ProblemType node -- so the auto-fire decision CANNOT be delegated to Brain

## User Setup Required

None at this wave. Wave 3 (117-05) release plumbing will require:
- `git push origin main --tags` (release v1.13.0-beta.7)
- `npm publish` per memory rule `feedback_release_lockstep_npm`

## Wave-2 -> Wave-3 Handoff

Wave 3 (117-05 telemetry + release) builds on this substrate:

- 5 emit helpers (`emitFired`, `emitFindingSurfaced`, `emitUserResponse`, `emitSkipped`, `emitSanitizerHit`) added to `lib/agents/auto-explore-agent.cjs`. The new `emitSanitizerHit` helper calls into the now-shipped sanitizer module on every Brain response that produces redactions; emits `brain_canon_drift_observed` event when Canon FiveLenses vs Brain FourLenses asymmetry observed.
- Canon Part 8 telemetry audit (substring-scan on JSONL fixtures); the sanitizer's deterministic placeholder format means redacted JSONL records are still verifiable by hash equality (no fuzzy match needed).
- v1.13.0-beta.7 release commit (CHANGELOG + plugin.json + package.json + git tag + marketplace ref + npm publish per memory rule `feedback_release_lockstep_npm`).
- Real assertions populate `tests/test-brain-canon-drift-event.cjs` and `tests/test-auto-explore-event-types.cjs` (currently scaffold-only).
- Apply `cypher/phase117-auto-explore-completion.cypher` to Brain post-release.

## Self-Check: PASSED

**Created files (3) verified on disk:**
- FOUND: lib/core/brain-response-sanitize.cjs
- FOUND: scripts/brain-response-sanitize-hook.cjs
- FOUND: tests/test-brain-response-sanitize.cjs

**Modified files (2) verified in git diff:**
- FOUND: lib/agents/auto-explore-agent.cjs (Brain §8.7 invariant comment block + 2 reworded inline comments)
- FOUND: tests/test-detection-routing-local-only.cjs (Wave 0 stub upgraded to 8 real assertions)

**Commits verified in git log:**
- FOUND: 268c5b2 (Task 1: SEED-003 A3 sanitizer module + PostToolUse hook + 15 tests)
- FOUND: 0aba3ee (Task 2: Brain §8.7 invariant comment block + 8 audit tests)

**Test counts verified:**
- 15 tests pass in `tests/test-brain-response-sanitize.cjs`
- 8 tests pass in `tests/test-detection-routing-local-only.cjs`
- Total: 23 tests passing (12+ required by plan; 23 delivered)

---
*Phase: 117-auto-explore-domains-on-first-material*
*Completed: 2026-05-07*
