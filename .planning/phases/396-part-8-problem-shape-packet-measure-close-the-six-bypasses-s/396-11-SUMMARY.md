---
phase: 396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 11
subsystem: part8-egress-guard
tags: [part8, session-owned-lexicon, p5, f8, room_check_unavailable, lexicon_scope, wave6, d-07]
requires: ["392-09"]
provides:
  - "part8-room-lexicon.cjs resolveLexiconRoom({sessionId, requireOwnership, home}) -> {status: bound | unbound | unavailable, roomDir, reason, lexicon_scope: session | machine_global}; a session resolves through resolveSessionRoom leg A only; unbound = empty lexicon; a corrupt binding, a traversal id, a throw or an unreadable room.db = unavailable; CLAUDE_ACTIVE_ROOM honoured as env_override; resolveLexiconRoomDir keeps the old string form (deprecated)"
  - "part8-egress-guard.cjs: opts.roomStatus unavailable blocks room_check_unavailable for every payload kind in classify (step 0b) and theoVerdict; opts.lexiconScope stamped as lexicon_scope; a sprout under an unreadable lexicon blocks room_check_unavailable (386-33 acknowledgement superseded)"
  - "scripts/part8-egress-guard-hook.cjs: session_id routed into the resolver; telemetry lands in the resolved room only with lexicon_scope on the row; MINDRIAN_PART8_DEBUG probe line"
  - "lib/core/brain-client.cjs: _resolveEgressRoomDir returns the typed result for CLAUDE_CODE_SESSION_ID or the machine-global room; the callTool belt, query() and _typedFreeformGate pass status and scope; every sentinel and the ambiguous disclosure carry lexicon_scope"
  - "lib/core/part8-egress-ontology.cjs: forwards lexicon_scope (closed value) into the memory_event row"
  - "tests/test-396-session-owned-lexicon.cjs (L0 to L12, 18 checks)"
affects: [392-12, 392-13, 392-15, 392-16]
tech-stack:
  added: []
  patterns: ["a typed resolver result (status, reason, scope) instead of string-or-null, so 'cannot check' is a value the guard can block on, never an empty lexicon", "the session leg counts only when the binding file exists and parses; the demoted reg.active leg is declined for a READ that protects room words", "every commit on the branch stays fail-closed: the mechanical call-site switch travelled with the typed resolver, the session routing in the next commit"]
key-files:
  created:
    - tests/test-396-session-owned-lexicon.cjs
  modified:
    - lib/core/part8-room-lexicon.cjs
    - lib/core/part8-egress-guard.cjs
    - scripts/part8-egress-guard-hook.cjs
    - lib/core/brain-client.cjs
    - lib/core/part8-egress-ontology.cjs
    - tests/test-3692-theo-verdict.cjs
    - tests/test-386-over-blocking-narrowed.cjs
    - tests/test-386-audit-probe-gate.cjs
decisions:
  - "With a session id only resolveSessionRoom leg A (session.primary) counts as bound. Leg B (reg.active, the fresh-session seed default for writes) is declined for the lexicon: the owner rule says an unbound session has an empty lexicon, so an unbound session never inherits a foreign room's words (two sessions never share a lexicon)."
  - "CLAUDE_ACTIVE_ROOM (operator pin, hermetic test seam) outranks the binding, reason env_override, lexicon_scope machine_global. It outranks the registry in resolveActiveRoom already; every existing hook test binds through it."
  - "A binding whose primary names a room that is not on disk is unbound (reason room_missing): there is nothing there to protect. A corrupt binding file, a traversal-shaped id, a resolver throw or an unreadable room.db is unavailable and blocks."
  - "The unavailable block sits at classify step 0b, after the operational and auth class allows (room_bind must still work so a user can rebind or repair the room; those tools never consult the lexicon) and before normalisation and the default-deny scan (nothing is sent either way, so the T-245-11 invariant, which guards the allow branches, is not weakened). An empty payload under unavailable blocks too (every kind, as the plan reads)."
  - "On the callTool belt the room is now resolved for every tool (status and scope apply to every tool; the lexicon still applies to the free-form tools only, as before), so 'unavailable' blocks every Brain tool at the shim as it does at the hook."
  - "The 386-33 owner acknowledgement (owner_ack_unreadable_db_lexicon: a clear sprout proceeds as room_check_skipped) is superseded by the 392 owner rule (CONTEXT wave 3: bound but unreadable or resolver failure = block room_check_unavailable). A sprout under an unreadable lexicon blocks with class room_check_unavailable; an edge or a body keeps sprouts_required with token class room_check_unavailable (the split guide). Four pins outside files_modified were flipped for that reason (listed under Deviations)."
  - "F8 settled on this machine: Claude Code exports CLAUDE_CODE_SESSION_ID to its MCP children (PROVEN by /proc/<pid>/environ of five live shim processes), so the shim under Claude Code CLI is session-scoped too; Desktop and Cowork stay machine-global and say so."
metrics:
  duration: "about 95 min of execution (2026-11-09 21:35Z first read to 23:10Z)"
  tasks: 2
  files: 9
  completed: 2026-11-09
---

# Phase 392 Plan 11: The session-owned room lexicon (P5) Summary

The Part 8 lexicon check now protects the room of THIS session: the CLI hook hands `session_id` to a typed resolver (`resolveLexiconRoom({sessionId, requireOwnership: true})`, through `resolveSessionRoom` and the binding file under `.rooms/sessions/`), an unbound session gets an empty lexicon and is allowed, a bound room whose `room.db` cannot be read or a resolver failure blocks every payload kind with `room_check_unavailable`, two sessions bound to different rooms never share a lexicon, and without a session id (the shim on Claude Desktop and Cowork) the check runs against the machine-global active room and the verdict, the sentinel and the telemetry row say so (`lexicon_scope: machine_global`). Replay unchanged: extended_blocked 8 of 535, must_refuse_blocked 10 of 10.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | failing test for the session-owned lexicon | 8067e58e1 | tests/test-396-session-owned-lexicon.cjs |
| 1 GREEN | typed resolver, the guard's unavailable block and scope stamp, the ontology field, the pin flips, the two call sites switched to the string form | ae44987c8 | lib/core/part8-room-lexicon.cjs, lib/core/part8-egress-guard.cjs, lib/core/part8-egress-ontology.cjs, scripts/part8-egress-guard-hook.cjs, lib/core/brain-client.cjs, tests/test-3692-theo-verdict.cjs, tests/test-386-over-blocking-narrowed.cjs, tests/test-386-audit-probe-gate.cjs |
| 2 GREEN | the hook, the telemetry room and brain-client routed through the session; the probe line | 464655889 | scripts/part8-egress-guard-hook.cjs, lib/core/brain-client.cjs, lib/core/part8-room-lexicon.cjs, tests/test-396-session-owned-lexicon.cjs |

STATE.md, ROADMAP.md and 396-WAVES.md were not edited (the orchestrator owns them on this branch; the foreign uncommitted ROADMAP.md and STATE.md edits and the untracked debug file and 393 directory were never staged or reverted). No `gsd-tools state.*` write was run for the same reason.

## RED failure lines

`node tests/test-396-session-owned-lexicon.cjs` on the tree at 2a49c426a (exit 1, 4 passed, 14 failed):

```
FAIL - L1 session B with room B's word exits 2 room_content; session A with room B's word exits 0
  session B exit 0 stderr:            (the hook resolved the machine-global room A; room B's word is not in A's lexicon)
FAIL - L2 ... session B exit 2 stderr: Canon Part 8: blocked (room_content, room_term). The question matched one term this room uses, 2 words long ...   (session B inherited room A's lexicon)
FAIL - L3 ... room A word under an unbound session exit 2   (the unbound session inherited room A)
ok   - L4 no session id: room A's word exits 2, room B's word exits 0   (today's machine-global behaviour, kept)
FAIL - L5 bound but unreadable room.db: generic exit 0   (null room, empty lexicon)
FAIL - L6 corrupt binding file: generic exit 0   (the resolver returned null and the check was skipped)
FAIL - L7 brain_ask {"question":"lean canvas steps"} -> {"verdict":"allow","class":"typed_question", ...}   (no roomStatus option)
FAIL - L8 resolveLexiconRoom returned "/tmp/.../rooms/gate-lexgen" (a bare string), expected the typed object for session B
FAIL - L9 room B rows after L1: 0   (telemetry went to the machine-global room)
FAIL - L10a not refused: {"ok":true}   (brain-client with CLAUDE_CODE_SESSION_ID = B let room B's word through)
FAIL - L10d ask: {"ok":true}   (corrupt binding, the call went to the wire)
FAIL - L10e lexicon_scope undefined on the machine-global refusal
FAIL - L10f {"ok":true}   (unreadable room, the call went to the wire)
FAIL - L11 hook present line missing
```

## The resolver (lib/core/part8-room-lexicon.cjs)

`resolveLexiconRoom(opts)` never throws and returns `{status, roomDir, reason, lexicon_scope}`:

| Case | status | roomDir | reason | lexicon_scope |
|------|--------|---------|--------|---------------|
| session with a binding whose primary is on disk, room.db readable or absent | bound | the room | session.primary | session |
| session with no binding file | unbound | null | no_binding | session |
| session whose primary names a room not on disk | unbound | null | room_missing | session |
| session whose binding file does not parse, or is not an object | unavailable | null | resolver_error | session |
| session id with a `..` segment | unavailable | null | resolver_error | session |
| session bound to a room whose room.db exists and cannot be read as a file (R_OK, or a non-file in its place) | unavailable | the room | room_unreadable | session |
| no session id, registry active room | bound | the room | reg.active | machine_global |
| no session id, no active room | unbound | null | no_active | machine_global |
| CLAUDE_ACTIVE_ROOM set to an existing directory (any session) | bound | the pin | env_override | machine_global |
| any throw | unavailable | null | resolver_error | by session presence |

The session path reads the binding file itself first (exists, parse), then calls `resolveSessionRoom({sessionId, requireOwnership: true, home})` and accepts only `source === 'session.primary'`. `readSessionBinding` collapses a corrupt file to the safe default, which is why the parse step is here: for the lexicon a corrupt binding is "cannot check", not "unbound". The traversal test is inlined (the one `isSafeSlug` applies) so `session-binding.cjs` is loaded only when a binding file exists; the hook's fresh-process module count stays flat for an unbound session (LZ5 below). `resolveLexiconRoomDir()` keeps the bare string form for the guard's own in-process fallback and is marked deprecated. `LEXICON_SCOPES` is exported.

## The guard (lib/core/part8-egress-guard.cjs)

- `classify` is now a wrapper: `_classifyUnscoped` plus `_stampLexiconScope`; step 0b (after 0a, before normalisation and the scan): `opts.roomStatus === 'unavailable'` returns `{verdict: 'block', class: 'room_check_unavailable', token_class: null, reason: <constant>}`. `theoVerdict` is the same wrapper over `_theoVerdictUnscoped`. Without `lexiconScope` the verdict has no `lexicon_scope` key (L7 asserts it).
- `_theoShapedVerdict` step 5: under an unreadable lexicon a sprout returns the `room_check_unavailable` block (it was `allow / room_check_skipped`); an edge or a body keeps `sprouts_required / room_check_unavailable`. `SR_REASONS.room_check_unavailable` now says "the call is blocked and nothing was sent" (OBU4's "room check could not run" regex still matches).
- The four internal resolver calls (`_genericContentVerdict`, `_theoShapedVerdict`, `theoVerdict`'s leaf loop, `_theoStringVerdict`) use `resolveLexiconRoomDir()`.

## The hook (scripts/part8-egress-guard-hook.cjs)

`resolveLexiconRoom({sessionId: sessionId || null, requireOwnership: true})` replaces `resolveLexiconRoom({})`; a throw or a malformed result is `unavailable`. `classify` receives `roomDir` (bound only), `roomStatus` and `lexiconScope`. `bestEffortRecord(verdictObj, sessionId, resolvedRoom)` writes to the resolved room only when `status === 'bound'` and `.mindrian/room.db` already exists (no db is minted), with `lexicon_scope` on the row; nothing is written for unbound or unavailable. `navigation.detectActiveRoom` is no longer used by the hook (the `NAVIGATION_PATH` constant is gone). With `MINDRIAN_PART8_DEBUG` set: one stderr line `part8 session: present|absent; lexicon_scope: session|machine_global`, never the id. Every other hook behaviour is unchanged (test-386-guard-fails-closed ALL PASS, test-3692 26/0).

## brain-client (lib/core/brain-client.cjs)

`_resolveEgressRoomDir()` returns the typed result for `process.env.CLAUDE_CODE_SESSION_ID || null` with `requireOwnership: true`; its docblock states the Desktop and Cowork consequence (machine-global, said so), that 392-SC5 is met on the CLI hook path, that the mindrian-os server never builds the shape in this phase, and the live reading below. The callTool belt (:499), `query()` (:814) and `_typedFreeformGate` (:1121) pass `roomDir` (bound only), `roomStatus` and `lexiconScope`; `_egressBlockedSentinel`, `_sproutsRequiredSentinel`, the non-free-form sentinel and the ambiguous disclosure carry `lexicon_scope` through `_copyLexiconScope` (closed value only). The same probe line under `MINDRIAN_PART8_DEBUG`.

## Telemetry (lib/core/part8-egress-ontology.cjs)

`record()` forwards `info.lexicon_scope` into the memory_event payload when it is `session` or `machine_global` (whitelist, no other key). L9: after the session B block, room B holds one `brain_egress_blocked` row with `lexicon_scope session` and room A gained exactly the session A allow row (`brain_egress_allowed`, `session`); the unbound run wrote nothing; the two no-session runs wrote two rows to room A with `lexicon_scope machine_global`; the unavailable runs wrote nothing to A, B or the unreadable room C; no row carries a question word or a session id.

## lexicon_scope outcomes per test leg (final tree, PROVEN)

| Leg | Session | Resolver status | lexicon_scope | Outcome |
|-----|---------|-----------------|---------------|---------|
| L1 | B, room B's word | bound (B) | session | hook exit 2 room_content; A with the same word exit 0 |
| L2 | A, room A's word | bound (A) | session | hook exit 2 room_content; B with the same word exit 0 |
| L3 | unbound | unbound | session | exit 0 for a generic question AND for room A's word (empty lexicon) |
| L4 | none | bound (A, reg.active) | machine_global | room A's word exit 2, room B's word exit 0 |
| L5 | bound to C, room.db chmod 000 | unavailable (room_unreadable) | session | exit 2 room_check_unavailable (generic and a 3-word sprout) |
| L6 | corrupt binding | unavailable (resolver_error) | session | exit 2 room_check_unavailable (generic and a 3-word sprout) |
| L7 | in process | unavailable (given) | session, machine_global | block room_check_unavailable for sprout, generic, edge, body, brain_search, brain_query, mcp__theo__search; operational tool still allowed |
| L10a/b | CLAUDE_CODE_SESSION_ID = B | bound (B) | session | ask(room B word) sentinel room_content, 0 bytes; ask(room A word) reaches the wire |
| L10c | unbound id | unbound | session | ask(generic) reaches the wire |
| L10d | corrupt id | unavailable | session | ask, search, query and the callTool belt: sentinel room_check_unavailable, lexicon_scope session, 0 bytes |
| L10e | unset | bound (A) | machine_global | ask(room A word) sentinel room_content with lexicon_scope machine_global; ask(room B word) reaches the wire |
| L10f | unreadable id | unavailable | session | ask(generic) sentinel room_check_unavailable, 0 bytes |
| L11 | probe | | | hook and brain-client print `present; session` and `absent; machine_global`; no id in any line; silent without the flag |

## The CLAUDE_CODE_SESSION_ID probe (F8)

Human check of the plan: PROVEN on this machine, not pending. Read-only probe on 2026-11-09 of the live processes: `pgrep -f mindrian-brain-mcp-client` found five shim processes (two beta.75 installs, one beta.81 install, one release worktree shim, one more beta.75) and every one of them has `CLAUDE_CODE_SESSION_ID=` in `/proc/<pid>/environ` (counted as present with `grep -c`; the value was never printed). The MCP server processes (`mindrian-mcp-server.cjs`) carry it as well. So Claude Code CLI exports the id to its MCP children: under Claude Code the shim's brain-client is session-scoped (lexicon_scope session), and the "absent" branch is the Claude Desktop and Cowork case (the Desktop shim has no env var and no SDK session id, RCA desktop-session-binding-fallback). How to read it live: start a Claude Code session with `MINDRIAN_PART8_DEBUG=1` in the environment, issue one brain_ask through the mindrian-brain shim, and read the shim's stderr (or the hook's stderr in the hook log) for `part8 session: present; lexicon_scope: session`. Not run live in this session (the plan's live reading is replaced by the /proc evidence, which is stronger: it is the actual environment of running shims).

Consequence for plan 392-12 option (a): the shim under Claude Code has a session id, so the shape can be built in the shim process there; on Desktop and Cowork the shim stays machine-global and the shape rides only on the paths that have a session id or a caller-built shape (brainRoute).

## Hook wall time

20-prompt generic sample, synthetic room bound through the registry and a binding file, `PART8_FORCE_BRAIN_AVAILABLE=1`, spawnSync per prompt (scratch script, not committed):

| Run | Tree | mean | max | exits |
|-----|------|------|-----|-------|
| quiet machine, before the change | 2a49c426a | 132 ms | 185 ms | 20 x 0 |
| while the 386 suite ran, after the change | working tree | 193 ms | 451 ms | 20 x 0 |
| A/B interleaved under the same load, run 1 | before (git archive 8067e58e1) / after | 287 / 198 ms | 1297 / 292 ms | 20 x 0 each |
| A/B interleaved under the same load, run 2 | before / after | 201 / 295 ms | 283 / 861 ms | 20 x 0 each |

The two trees trade places between runs, so the difference is load noise. The resolver's own cost, measured in process (500 warm calls): session bound (binding read, parse, resolveSessionRoom, registry, R_OK probe) 0.084 ms per call; session unbound (one existsSync) 0.006 ms; machine-global 0.031 ms; the old string form 0.029 ms; the first session-scoped call in a fresh process 2.0 ms including the lazy module loads. L12 in the test: mean 186 ms, max 196 ms over 5 runs (budget 2,000 ms). test-3692 V6 (10 hook spawns, p95 under 400 ms) passed.

## Replay matrix (scratch, not committed)

`node tests/helpers/part8-overblock-replay.cjs --record <scratchpad>/392-after-11-matrix.json --real-calls $HOME/.mindrian/part8-replay/real-calls.jsonl --guard-head 464655889`: 820 rows (694 fixture, 126 real-call), network_calls 0. extended_blocked 8 of 535 (not above 8), must_refuse_blocked 10 of 10. Every section of the matrix (total, by_verdict 730 / 2 / 88, by_set, by_group, by_tool, by_class, by_token_class) is byte-equal to the committed tests/fixtures/392-part8-replay/matrix-after-arm.json (392-09). No rule was loosened; the replay passes roomDir directly, so the session path is not on it and changes no row.

## Verification (final tree 464655889, PROVEN unless marked)

- `node tests/test-396-session-owned-lexicon.cjs`: 18 passed, 0 failed, 0 skipped (uid 1000, the chmod legs ran).
- `bash tests/run-all-396.sh`: discovered 16, PASS=16 FAIL=0 SKIP=0.
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0. LZ5 line: guard 172 to 11; hook 175 to 14 (174 before this plan: the fixture's session has no binding file, so the hook no longer opens the room's db); statusline 182 to 18. LZ6 ok.
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed.
- `node tests/test-386-guard-fails-closed.cjs`: ALL PASS. `node tests/test-386-memory-artifact-hook-room-scope.cjs`: all arms ok. `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0. `node tests/test-3692-theo-verdict.cjs`: PASS 26 FAIL 0 (V1g, V2e flipped). `node tests/test-386-over-blocking-narrowed.cjs`: OBU3, OBU4, OBU6 ok. `node tests/test-386-audit-probe-gate.cjs`: RESULT PASS (PG33U: sprouts block room_check_unavailable 510, edges and bodies sprouts_required/room_check_unavailable 25, credential joined block, lexicon sprout block).
- tests/test-389-seed-egress.cjs: ABSENT on this branch (rebase onto the release session's commits pending, D-07); not run.
- Dash check (em dash, en dash) on the nine files: 0 each.
- `git status --short` after the last commit: only the foreign ` M .planning/ROADMAP.md`, ` M .planning/STATE.md`, the untracked `.planning/debug/379-1-1-10-large-room-drain-clock-breach.md` and the untracked `.planning/phases/393-*` directory (never staged, never reverted). Post-commit deletion check on each of the three commits: no deletions.
- `node scripts/doctor.cjs --acceptance`: NOT RUN (UNVERIFIED; its version point runs `npm view`, and this plan ran under a no-network rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] lib/core/part8-egress-ontology.cjs forwards lexicon_scope (outside files_modified)**
- **Found during:** Task 2 design
- **Issue:** the plan's truth "every recorded row carries lexicon_scope" cannot hold: the ontology writer whitelists the memory_event payload keys (D-09 firewall), so a field the hook passes is dropped unless the writer forwards it. Writing the row from the hook directly would duplicate the writer (Part 7).
- **Fix:** one whitelisted key, `lexicon_scope`, copied only when it is `session` or `machine_global`.
- **Files modified:** lib/core/part8-egress-ontology.cjs
- **Commit:** ae44987c8

**2. [Rule 3 - Blocking, plan-directed] Four pins of the superseded 386-33 acknowledgement flipped (outside files_modified)**
- **Found during:** Task 1 GREEN (`bash tests/run-all-386.sh` would not stay green otherwise; the plan's action says "change :1432 so a sprout no longer passes under unavailable")
- **Issue:** tests/test-3692-theo-verdict.cjs V1g and V2e, tests/test-386-over-blocking-narrowed.cjs OBU3 and OBU6, tests/test-386-audit-probe-gate.cjs PG33U assert `allow / room_check_skipped` for a clear sprout under an unreadable room.db (owner_ack_unreadable_db_lexicon, 2026-11-06).
- **Fix:** each pin asserts `block / room_check_unavailable` with a comment naming plan 392-11 and the 392 owner rule that supersedes the acknowledgement; edge and body expectations unchanged; PG33U's RCA-line check and counts kept (the emit text says "exposure closed by plan 392-11").
- **Files modified:** the three test files above
- **Commit:** ae44987c8

**3. [Ordering, safety] The Task 1 commit also switched the hook's and brain-client's one call site each to resolveLexiconRoomDir()**
- The typed `resolveLexiconRoom` would otherwise have reached those two sites as an object, which `loadRoomLexicon` treats as "no room" (an empty lexicon: fail-open) at that commit. The mechanical switch keeps today's behaviour byte-identical at ae44987c8; the session routing is the Task 2 commit 464655889. Every commit on the branch is fail-closed.

**4. [Test fixture] The unreadable-room leg uses a third synthetic room (gate-segment) bound to its own session, not room A**
- The plan's text binds S1 to room A and makes A's db unreadable; the other legs need room A readable, so the unreadable case has its own room and session. Same assertion (bound but unreadable blocks every kind), no shared state between legs.

**5. [Reading] "before any other rule"**
- The unavailable block sits after the operational and auth class allows (step 0a): an operational Theo tool never consults the lexicon and must keep working when the room cannot be read, so the user can rebind or repair it. It sits before normalisation and the default-deny scan: nothing is sent either way, and the T-245-11 invariant guards the allow branches. Recorded here because 392-09 read the same phrase as "before any free-text rule" for shape_invalid.

**6. [Reading] An unbound session with the registry active**
- `resolveSessionRoom` leg B would hand an unbound session the registry's active room when it is inheritable. The plan's behaviour text (`S3 -> {status: 'unbound', roomDir: null, reason: 'no_binding'}`, "empty lexicon, allowed") and 392-SC5 want the opposite, so leg B is declined for the lexicon and only `source === 'session.primary'` counts. The call still goes through `resolveSessionRoom({sessionId, requireOwnership: true})` as the key link names.

### Not done, by evidence

- The plan's live human check (`MINDRIAN_PART8_DEBUG=1` in a live Claude Code session) was not run; the F8 question it was meant to settle is settled by the /proc evidence above (five live shim processes carry the variable). The probe line exists and is tested (L11) for the day it is wanted.

## TDD Gate Compliance

RED 8067e58e1 (test), GREEN ae44987c8 (feat, Task 1) and 464655889 (feat, Task 2). The RED test failed on 14 of 18 checks on the tree at 2a49c426a; it passes 18 of 18 at 464655889. No refactor commit.

## Known Stubs

None. The session path is wired end to end on the hook and the shim; `lexicon_scope` reaches the verdict, the sentinels, the disclosure and the telemetry row.

## Threat Flags

None new. T-392-31 mitigated (session.primary only; L1, L2, L3, L10a/b). T-392-32 mitigated (unavailable blocks every kind at the guard, the hook, the belt, query and the gate; L5, L6, L7, L10d, L10f). T-392-33 mitigated (the probe prints presence and scope only; L11 asserts no id in any line and silence without the flag). T-392-34a mitigated (lexicon_scope on the verdict, every sentinel, the disclosure and the row; the brain-client docblock names the Desktop and Cowork consequence). One narrowing recorded, not a new surface: the callTool belt now resolves the room (two small local file reads) for every Brain tool, so an unavailable room blocks non-free-form tools at the shim as it already does at the hook.

## Self-Check: PASSED

Files exist: lib/core/part8-room-lexicon.cjs, lib/core/part8-egress-guard.cjs, lib/core/part8-egress-ontology.cjs, scripts/part8-egress-guard-hook.cjs, lib/core/brain-client.cjs, tests/test-396-session-owned-lexicon.cjs, tests/test-3692-theo-verdict.cjs, tests/test-386-over-blocking-narrowed.cjs, tests/test-386-audit-probe-gate.cjs. Commits 8067e58e1, ae44987c8, 464655889 exist on work/part8-shape-packet. This SUMMARY is under `.planning/*` (force-tracked), added with `git add -f`.
