---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 07
subsystem: testing
tags: [jev, typesafe, egress-guard, shared-client, builder, part8, fixture]

# Dependency graph
requires:
  - phase: 356-02
    provides: "scripts/jev-devtime-client.cjs (D-06..D-09 interface: loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES)"
  - phase: 356-03
    provides: "lib/core/irreversibility-ledger.cjs (commandTextHash, TEXT_HASH_BASIS), lib/workflow/command-resolver.cjs commandRow(cmd)"
  - phase: 356-05
    provides: "scripts/irreversibility-answer-key.cjs (readRegistryRows, sha256Hex)"
provides:
  - "scripts/jev-devtime-client.cjs: EGRESS_PROFILES.material_step_ledger and three additive optional exact_state_v1 fields (string_keys, question_max_len, question_strings_from_file_key)"
  - "scripts/build-command-irreversibility-ledger.cjs: scoring core (POLICY_REL, readPolicy, makeGuard, buildPayload, parseNoulAnswer, makeFixtureFetch, scoreAll)"
  - "tests/fixtures/356-jev-noul-responses.json: SYNTHETIC per-command p values for fixture builds"
  - "tests/test-356-egress.cjs: refusal legs, builder-injection leg, no-key-material legs"
  - "tests/test-356-policy.cjs: byte-identity, hash, empty-field normalization, strict-parsing legs"
affects: [356-09, 356-10, 356-13, 357, 354-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "question_strings_from_file_key: parses the referenced must_equal_file's bytes as JSON ONCE at guard construction, collects every string value anywhere in the parsed value into a Set, and requires every question string outside the fixed question sentence (instructions.rule, each boundary_cases element, criteria.true, criteria.false) to be a member of that Set -- refuses and names the offending key (e.g. irreversible.instructions.rule) before fetchImpl runs"
    - "string_keys: an additive exact_state_v1 field requiring named state keys to be strings, refusing (not silently coercing) a null/non-string value"
    - "question_max_len: caps instructions.question length per question, independent of the state max_len_by_key caps"
    - "Fixture mode drives the REAL payload/guard/parse path via a fake fetchImpl that parses init.body (RESEARCH Pitfall 9), never a shortcut that bypasses buildPayload or client.jev"
    - "scoreAll constructs the guard ONCE per build (not per row) and never ships a null entry: any non-200 status or malformed Noul answer aborts the whole build with SCORE_FAILED naming the command"

key-files:
  created:
    - scripts/build-command-irreversibility-ledger.cjs
    - tests/fixtures/356-jev-noul-responses.json
    - tests/test-356-egress.cjs
    - tests/test-356-policy.cjs
  modified:
    - scripts/jev-devtime-client.cjs

key-decisions:
  - "Split tests/test-356-egress.cjs across both tasks as the plan's task boundary implies (Task 1: refusal legs + a guarded PENDING placeholder for Task 2's legs; Task 2: replaced the placeholder with the real builder-injection and no-key-material legs), so each task's commit is self-contained and green standalone"
  - "The SYNTHETIC test policy used across tests/test-356-egress.cjs and tests/test-356-policy.cjs describes hypothetical, non-registry actions only (a local sandbox vs. an external service), never any real /mos: command's irreversibility judgment, honoring the coordination constraint that the real policy and blind label sheet are still being labeled by the navigator in a concurrent session (356-06)"
  - "The empty-field normalization leg enumerates the null-jtbd_summary commands from the RAW registry at run time rather than hard-coding the four RESEARCH-predicted slugs, so the test stays correct if the registry changes"

patterns-established:
  - "A profile's question_strings_from_file_key is validated at makeEgressGuard construction time (parses the referenced must_equal_file bytes as JSON, throws immediately on invalid JSON or a misconfigured key), not deferred to the first guard(payload) call"

requirements-completed: [R356-07, R356-01, R356-03, R356-08]

# Metrics
duration: ~70min
completed: 2026-09-23
---

# Phase 356 Plan 07: material_step_ledger egress profile and the irreversibility scoring core Summary

**Added EGRESS_PROFILES.material_step_ledger (byte-identical policy via must_equal_file, every question string traced back to that same file via a new question_strings_from_file_key guard field) plus scripts/build-command-irreversibility-ledger.cjs's scoring core (readPolicy/buildPayload/parseNoulAnswer/makeFixtureFetch/scoreAll), proven entirely against SYNTHETIC fixtures under temp roots.**

## Preflight

Per the plan's coordination note, `scripts/jev-devtime-client.cjs` was read from disk before any edit: none of the three optional exact_state_v1 fields (`string_keys`, `question_max_len`, `question_strings_from_file_key`) were present. Branch taken: ABSENT -- all three were added additively in this plan, alongside `EGRESS_PROFILES.material_step_ledger` itself (also absent). `data/jev-policies/command-irreversibility.json` was confirmed absent both before and after this plan's execution (356-06 owns drafting it after the blind label sheet is committed); this plan never opened or referenced it, the blind label sheet, or the sealed Claude pre-label file.

**Registry maxima measured** (`data/command-registry.json`, 113 commands, via `node`): longest `teaching` 535 chars (`/mos:bono`, 66.9% of the 800-char cap); longest `jtbd_summary` 75 chars (`/mos:analyze-systems`, 37.5% of the 200-char cap); longest `command` slug 29 chars (`/mos:feynman-timeline-refresh`, 45.3% of the 64-char cap). None exceeds 80% of its cap, so no cap adjustment was recorded as needed.

**Final `EGRESS_PROFILES` key list:** `section_command_ledger` (untouched), `material_step_ledger` (new, this plan).

**Three new optional `exact_state_v1` fields** (for 357 and 354-17, per the plan's output instruction): `string_keys` (array of state keys that must be strings, else refused naming the key), `question_max_len` (number; caps every question's `instructions.question` string length), `question_strings_from_file_key` (string; names a `must_equal_file` key whose file's parsed JSON supplies the allow-set every question's `instructions.rule`, `instructions.boundary_cases[]`, `criteria.true` and `criteria.false` must be drawn from). All three are additive: a profile without them behaves exactly as before (proven by `tests/test-356-jev-client.cjs` leg (k) additivity, which stayed green unchanged).

## Cross-session collision (mid-execution)

Between Task 1's `git add -f` and its intended `git commit`, a concurrent peer session (jsagi-25, Phase 354-10) ran a commit tool that committed whatever was staged in the shared working tree, sweeping Task 1's staged diff (the `scripts/jev-devtime-client.cjs` addition and the new `tests/test-356-egress.cjs`) into their own commit `f7ec913b6` ("docs(354-10): complete taxonomy ladder casing plan") instead of a commit of mine. Per the orchestrator's live alert:
- Content was verified intact and byte-identical to what this plan intended (`git diff HEAD -- scripts/jev-devtime-client.cjs tests/test-356-egress.cjs` returned empty; `git show --stat f7ec913b6` showed exactly the two expected files with the expected line counts).
- Not reverted, not re-added, not re-committed -- the content already lives at HEAD.
- From that point on, every subsequent stage+commit in this plan was done as a single tightly-coupled `git add -f ... && git commit ... --only -- ...` inside one Bash call, which is how Task 2's commit (`1c84d6361`) landed cleanly under its own message and hash.

This is documented as an execution-environment event, not a plan deviation under Rules 1-4 (nothing in the plan's own logic was wrong; the shared working tree raced two sessions' git operations).

## Performance

- **Duration:** ~70 min
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23
- **Tasks:** 2/2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `scripts/jev-devtime-client.cjs`: three additive optional `exact_state_v1` fields (`string_keys`, `question_max_len`, `question_strings_from_file_key`) plus `EGRESS_PROFILES.material_step_ledger` (frozen, exact top keys `{model, state, questions}`, `model === 'jev-latest'`, state keys `{slug, teaching, jtbd_summary, policy}` all required strings, per-key caps via `max_len_by_key`, `policy` required byte-identical to `data/jev-policies/command-irreversibility.json` via `must_equal_file`, one Noul question `irreversible` with every question string outside the fixed sentence traced to the policy file).
- `scripts/build-command-irreversibility-ledger.cjs`: the scoring core. `readPolicy(root)` reads and validates the D-01-shaped policy (refuses `INPUT_REFUSED` on a malformed shape). `makeGuard(root)` wraps `client.makeEgressGuard(EGRESS_PROFILES.material_step_ledger, {root})`. `buildPayload(row, policy)` builds the exact request body (fixed question sentence, policy fields verbatim). `parseNoulAnswer(json, command)` strictly validates the answer shape, storing `p` exactly as returned (never rounded). `makeFixtureFetch(fixture, sink)` drives the real payload/guard/parse path through a fake `fetchImpl` (not a shortcut). `scoreAll(rows, policy, opts)` constructs the guard once, sends one Noul per row through `client.pool` + `client.jev`, and aborts the whole build with `SCORE_FAILED` naming the command on any non-200 status or malformed answer -- never shipping a null entry. No local fetch, no local guard, no local `EGRESS_ALLOWED_` set; exactly one `require('./jev-devtime-client.cjs')`.
- `tests/fixtures/356-jev-noul-responses.json`: the exact SYNTHETIC fixture the plan specifies, marked `_note` as not Jev output and not the answer key.
- `tests/test-356-egress.cjs`: 82 checks. Refusal legs (each proving `EGRESS_REFUSED`, zero fetch calls, and refuse-never-strip): `state.room_path` injection, missing `jtbd_summary`, `teaching` over cap, `teaching` null, `state.policy` one byte changed, `state.policy` trailing newline removed, a second question id, an extra question key, `criteria` as an array, `instructions.rule` not from the policy file, a boundary case not from the policy file, `instructions.question` over cap, a disallowed top key, a wrong `model` value, and guard construction without `opts.root`. Also: the `section_command_ledger` parity corpus (16 cases) replayed unchanged; the builder-injection leg (an injected `room_path` in `scoreAll`'s payload rejects with `EGRESS_REFUSED`, `err.key === 'room_path'`, zero fetches); the no-key-material legs (a sentinel key is absent from `scoreAll`'s result and from every file under `data/`; the real key, when loadable, is compared silently against 125 files under `data/` and found absent).
- `tests/test-356-policy.cjs`: 27 checks. Byte-identity leg (one captured payload per registry command; `state.policy` matches the tmp policy file both as text and as raw bytes; `instructions.rule`/`boundary_cases`/`criteria`/the fixed question sentence all verbatim; every captured `Authorization` header carries the sentinel key). Hash leg. Empty-field normalization (the four registry commands with `jtbd_summary: null` are sent with `''` and hash accordingly). Strict-parsing leg (an out-of-range noul, a non-noul type, and an HTTP 500 all reject with `SCORE_FAILED` naming the command). A PENDING shipped-policy leg (shape-only checks; will activate once 356-06 lands the real policy file).

## Task Commits

Each task was committed atomically:

1. **Task 1: EGRESS_PROFILES.material_step_ledger and tests/test-356-egress.cjs refusal legs** - content landed on `main` inside peer commit `f7ec913b6` (jsagi-25, Phase 354-10; a shared-working-tree commit swept the staged index before this plan's own commit ran). Verified byte-identical to the intended diff; not re-committed. See "Cross-session collision" above.
2. **Task 2: Scoring core, synthetic fixture, tests/test-356-policy.cjs, and the no-key-material legs** - `1c84d6361` (feat)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `scripts/jev-devtime-client.cjs` - three additive optional `exact_state_v1` fields plus `EGRESS_PROFILES.material_step_ledger`
- `scripts/build-command-irreversibility-ledger.cjs` - new: the irreversibility scoring core
- `tests/fixtures/356-jev-noul-responses.json` - new: SYNTHETIC per-command Noul fixture
- `tests/test-356-egress.cjs` - new: refusal, parity, builder-injection and no-key-material legs
- `tests/test-356-policy.cjs` - new: byte-identity, hash, normalization, strict-parsing legs

## Decisions Made
- ABSENT branch confirmed for all three optional profile fields and `material_step_ledger` itself by reading `scripts/jev-devtime-client.cjs` from disk before any edit, per the coordination note.
- `tests/test-356-egress.cjs` was structured so Task 1's commit is standalone-green (a guarded `runTask2Legs()` placeholder prints `PENDING` until the builder exists), then Task 2 replaced the placeholder with the real legs -- documented above as a deviation from a strict single-file-single-task read, taken to keep both task commits independently runnable.
- Test policy content (`POLICY_OBJ`/`POLICY_TEXT` in both test files) is fully synthetic and describes hypothetical actions (local sandbox vs. external service), never any real registry command, per the coordination constraint against referencing real irreversibility judgments while 356-06 is still labeling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal em-dash character written by the Write tool instead of the intended unicode escape**
- **Found during:** Task 2, verification of the em-dash guard grep across all five 356-07 surface files
- **Issue:** `tests/test-356-policy.cjs`'s shipped-policy leg checked for the U+2014 em-dash codepoint using a literal character in the source string, but the file as written to disk contained a literal em-dash character in that line instead of an escape sequence, tripping the plan's own em-dash guard.
- **Fix:** Replaced the literal character with `String.fromCharCode(0x2014)`.
- **Files modified:** tests/test-356-policy.cjs
- **Verification:** `grep -c "$(printf '\xe2\x80\x94')" tests/test-356-policy.cjs` returns 0; `node tests/test-356-policy.cjs` still exits 0 (27 checks).
- **Committed in:** 1c84d6361 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, a tooling artifact caught by the plan's own em-dash guard before commit)
**Impact on plan:** No scope creep. Fix was a single-character correction inside a test file already being written for Task 2.

## Issues Encountered
The cross-session collision documented above (Task 1's content landing inside peer commit `f7ec913b6` rather than a commit of this plan's own) was surfaced live by the orchestrator mid-execution and handled per its instructions: verified intact, not reverted, not re-committed, and every subsequent commit in this plan was done as a single tightly-coupled `git add -f ... && git commit ... --only -- ...` to close the race window. No other issues.

## User Setup Required
None - no external service configuration required. This plan makes zero network calls (verified: `NET_ATTEMPTS === 0` in all three test suites run).

## Known Stubs
None. Both new code files are complete, runnable, non-placeholder implementations for the scope this plan owns (the scoring core only; threshold math, ledger assembly and the CLI are explicitly out of scope, landing in 356-09, per the plan's own objective). The shipped-policy leg in `tests/test-356-policy.cjs` is intentionally PENDING (prints and counts as passing) until 356-06 lands the real policy file -- this is documented, not silent.

## Next Phase Readiness
- `scripts/build-command-irreversibility-ledger.cjs`'s exports (`POLICY_REL`, `readPolicy`, `makeGuard`, `buildPayload`, `parseNoulAnswer`, `makeFixtureFetch`, `scoreAll`, plus `DEFAULT_LABELS_PATH`, `DEFAULT_LEDGER_PATH`, `MODEL`, `QUESTION_ID`, `QUESTION_TEXT`, `CONC`, `VENDOR_USD_PER_INPUT_TOKEN`, `TEXT_HASH_BASIS`) are ready for 356-09 (threshold math, ledger assembly, `require.main` CLI) and 356-10 (`--check`).
- Once 356-06 lands `data/jev-policies/command-irreversibility.json`, `tests/test-356-policy.cjs`'s shipped-policy leg activates automatically (no test edit needed) and `tests/test-356-jev-client.cjs` / `tests/test-356-egress.cjs` continue to pass unchanged (verified against SYNTHETIC policies of the same shape).
- The three new optional `exact_state_v1` fields are available for 357 and 354-17 to reuse if their own profiles need string-typed state keys, a question-length cap, or a from-file string allow-set; no coordination is required since the fields are purely additive per-profile opt-ins.
- No blockers for 356-09, 356-10, or 356-13.

## Self-Check: PASSED

- FOUND: scripts/jev-devtime-client.cjs
- FOUND: scripts/build-command-irreversibility-ledger.cjs
- FOUND: tests/fixtures/356-jev-noul-responses.json
- FOUND: tests/test-356-egress.cjs
- FOUND: tests/test-356-policy.cjs
- FOUND commit: f7ec913b6 (Task 1 content, landed inside a peer commit, verified byte-identical)
- FOUND commit: 1c84d6361 (Task 2)

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*
