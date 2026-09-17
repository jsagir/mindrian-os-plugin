---
phase: 260917-dia
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
mode: quick
requirements: [TASK-A, TASK-B, TASK-C]
files_modified:
  - lib/mcp/runtime-instructions.cjs
  - lib/mcp/no-instructions.test.cjs
  - data/harness-policies/contract-parity-larry.json
  - scripts/intent-classifier.cjs
  - tests/test-260917-binding-gate-offscope.cjs
  - lib/core/rooms-home-env.cjs
  - tests/test-260917-rooms-home-precedence.cjs
  - scripts/write-scope-check.cjs
  - scripts/gsd-graph-derive-sweep.cjs
  - scripts/brain-derivation-drain.cjs
  - scripts/memory-lifecycle.cjs
  - lib/core/cross-room-aggregator.cjs
  - lib/core/navigation/dashboard-helpers.cjs
  - scripts/brain-derive-command.cjs
  - scripts/feynman-timeline-refresh-command.cjs
  - scripts/memory-artifact-graph-hook.cjs

must_haves:
  truths:
    - "The MCP runtime instructions name mindrian-brain as the server hosting brain_*, so a Desktop/Cowork model stops calling the wrong server and getting 'No such tool'."
    - "A session already bound to room X, sent a message whose top lexical match is room Y, sees a gate that names X as the bound primary instead of claiming 'session unbound'."
    - "That same off-scope gate fires at most ONCE per session per off-scope room; a second identical turn is silent."
    - "The genuinely-unbound case still renders today's 'session unbound' wording, byte-identically."
    - "Every rooms-root resolver under lib/ and scripts/ honors MINDRIAN_ROOMS_HOME first and falls back to MINDRIAN_ROOMS_ROOT; with only HOME set, scripts/intent-classifier.cjs resolves the rooms root."
  artifacts:
    - path: "lib/core/rooms-home-env.cjs"
      provides: "The one shared HOME-then-ROOT env precedence resolver"
      exports: ["roomsHomeEnv"]
    - path: "tests/test-260917-binding-gate-offscope.cjs"
      provides: "Failing-first regression for the F.8 off-scope wording + per-session dedupe"
    - path: "tests/test-260917-rooms-home-precedence.cjs"
      provides: "Failing-first regression for the HOME/ROOT resolver asymmetry"
  key_links:
    - from: "scripts/intent-classifier.cjs emitBindingGate"
      to: "lib/core/session-binding.cjs readSessionBinding"
      via: "bound-primary lookup at the gate decision point"
      pattern: "readSessionBinding"
    - from: "scripts/intent-classifier.cjs resolveMindrianRoomsRoot"
      to: "lib/core/rooms-home-env.cjs roomsHomeEnv"
      via: "require + call"
      pattern: "roomsHomeEnv"
---

<objective>
Land three already-root-caused fixes from Lawrence's tester bug report as three
atomic commits. Root causes were verified today (2026-09-17) by direct code
reading; do NOT re-derive them, implement the fix and the proof.

A. lib/mcp/runtime-instructions.cjs never names WHICH MCP server hosts brain_*,
   so hookless surfaces (Desktop, Cowork) guess the wrong server.
B. The F.8 binding gate in scripts/intent-classifier.cjs mislabels an OFF-SCOPE
   lexical match as "session unbound", and has no dedupe, so it re-fires every
   turn of an already-bound session.
C. MINDRIAN_ROOMS_HOME vs MINDRIAN_ROOMS_ROOT precedence is inconsistent across
   11 resolver sites; HOME is the intended primary name but 6 sites are ROOT-only
   and 5 more put ROOT first.

Purpose: three live tester-facing defects, each with a verified origin.
Output: 3 commits (A, then B, then C), 2 new regression tests, 1 new shared
resolver module.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@lib/mcp/runtime-instructions.cjs
@lib/mcp/no-instructions.test.cjs
@data/harness-policies/contract-parity-larry.json
@scripts/intent-classifier.cjs
@lib/core/session-binding.cjs
@tests/test-225-zero-score-gate.cjs
</context>

<hard_boundaries>
Concurrent peer session owns these; do NOT open, edit, or stage them:
- scripts/part8-egress-guard-hook.cjs
- tests/test-260906-fda-known-tool-shapes.cjs
- tests/test-245-egress-contentless.cjs
- anything under .planning/spikes/

Phase 225 zero-score / no-match gate is CORRECT and out of scope. Read
`emitNoMatchGate`, `zeroScoreGateAlreadyOffered`, `markZeroScoreGateOffered`,
`zeroScoreGateMarkerPath` ONLY as the pattern to mirror. Never modify them, never
reuse their marker filename or their trace `kind` value.

Repo rules that bind every task here: no em-dashes in code comments, test output,
commit messages, or any prose (hyphens only). Canon Part 8: no room content may
reach the Brain; none of these three tasks adds a network path, keep it that way.
Run the named suite after each task before calling it done.
</hard_boundaries>

<tasks>

<task type="auto" tdd="false">
  <name>Task A: name the mindrian-brain server in RUNTIME_INSTRUCTIONS (3-place lockstep)</name>
  <files>lib/mcp/runtime-instructions.cjs, lib/mcp/no-instructions.test.cjs, data/harness-policies/contract-parity-larry.json</files>

  <discovered_constraints>
Pre-read finding that changes the shape of this task. The bug report called this a
"one-liner, no test needed". It is not. Both mention points are FROZEN by gates:

1. Byte budget. RUNTIME_INSTRUCTIONS measures 1944 bytes today against a
   SERVED_BUDGET_BYTES of 1950 (6 bytes of headroom) and a 2048-byte host cap that
   Claude Code enforces by SILENT TRUNCATION. Naming the server at two points costs
   roughly 40 bytes, so the budget constant must be raised.
2. The budget number 1950 lives in THREE places that must move together:
   lib/mcp/runtime-instructions.cjs header comment (lines 14 and 16),
   lib/mcp/no-instructions.test.cjs:91 `SERVED_BUDGET_BYTES`, and
   data/harness-policies/contract-parity-larry.json `byte_budget.limit`.
3. The BOUNDARIES paragraph (line 36, mention point 2) is pinned byte-identically
   by `PART8_BOUNDARIES_FROZEN` at lib/mcp/no-instructions.test.cjs:100 AND by a
   frozen phrase in contract-parity-larry.json. The test also asserts the served
   string ENDS with that paragraph.
4. The THEO clause (line 34, mention point 1) is pinned byte-identically by a
   second frozen phrase in contract-parity-larry.json.
  </discovered_constraints>

  <action>
Edit the RUNTIME_INSTRUCTIONS template literal in lib/mcp/runtime-instructions.cjs
at both brain_* mention points so the instructions state which MCP server hosts
brain_ask / brain_search / brain_query / brain_schema / brain_stats / brain_write.
The server is `mindrian-brain` (tool names are prefixed
`mcp__plugin_mos_mindrian-brain__`). It is NOT `mindrian-os`, which is a different
server on the same plugin and hosts none of those tools.

1. THEO clause (line 34): name the server inline. Reference wording that fits the
   budget: change "behind every brain_* call." to "behind every brain_* call
   (server: mindrian-brain)." You may reword, but the literal token
   `mindrian-brain` MUST appear in this sentence.
2. BOUNDARIES paragraph (line 36): name the server at its brain_* mention.
   Reference wording: change "room content NEVER enters brain_* calls" to "room
   content NEVER enters mindrian-brain brain_* calls". Change NOTHING else in that
   paragraph, and keep it LAST in the string (the endsWith assertion).
3. Measure the result with the file header's own command:
   `node -e "console.log(Buffer.byteLength(require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS,'utf8'))"`
4. Raise the budget to 2000 in all three places named in discovered_constraints.
   2000 keeps at least 48 bytes under the 2048 host cap. The measured string MUST
   come in at or under 2000; if your wording overshoots, tighten the wording, do
   NOT raise the budget past 2000.
5. Update `PART8_BOUNDARIES_FROZEN` at lib/mcp/no-instructions.test.cjs:100 to the
   new paragraph, byte-identically (copy-paste from the source, do not retype).
6. Update BOTH frozen phrases in data/harness-policies/contract-parity-larry.json
   (the BOUNDARIES string and the THEO string) byte-identically to the new text.
7. Rewrite the accounting sentence in the runtime-instructions.cjs header comment
   (lines 13-15) with the new budget, the new measured byte count, and the real
   headroom under both the budget and the 2048 cap. Add one short WHY line naming
   this fix: models on hookless surfaces were calling the wrong server.

Do not touch the persona/loop/glyph content. Hyphens only, no em-dashes.
  </action>

  <verify>
    <automated>node lib/mcp/no-instructions.test.cjs && node scripts/build-harness-manifest.cjs --check && node -e "const s=require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS; const n=(s.match(/mindrian-brain/g)||[]).length; if(n<2) throw new Error('mindrian-brain named '+n+' times, expected >=2'); const b=Buffer.byteLength(s,'utf8'); if(b>2000) throw new Error('over budget: '+b); console.log('ok',b,'bytes,',n,'server mentions');"</automated>
    <automated>git add -A &amp;&amp; git commit -m "fix(mcp): name mindrian-brain as the brain_* host in RUNTIME_INSTRUCTIONS" &amp;&amp; node tests/test-298-contract-parity.cjs</automated>
  </verify>

  <done>
`mindrian-brain` appears at both brain_* mention points in the served string.
Measured bytes are at or under 2000 and the budget reads 2000 in all three places.
`node lib/mcp/no-instructions.test.cjs` exits 0.
`node scripts/build-harness-manifest.cjs --check` exits 0.
`node tests/test-298-contract-parity.cjs` exits 0 on a clean tree (its final leg
asserts `git status --porcelain` is empty, so it runs AFTER the commit).
Committed as commit 1 of 3.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task B: F.8 binding gate - correct off-scope wording and add per-session dedupe</name>
  <files>tests/test-260917-binding-gate-offscope.cjs, scripts/intent-classifier.cjs</files>

  <root_cause>
Verified by direct code reading, do not re-derive.
`_runBindingGate({ sessionId, topRoom: best.name, home: root })` at
scripts/intent-classifier.cjs:643 returns `fire: true` whenever the CURRENT
message's top lexical-match room (`best.name`) is not a member of the session's
bound SET. That is an OFF-SCOPE mismatch, not an unbound session. The fire branch
at lines 657-674 calls `emitBindingGate`, which hardcodes
`const systemMessage = 'session unbound: choose which room(s) this session writes to';`
at line 2930 even when the session HAS a real bound primary. Separately, the
sibling zero-score gate guards its fire with `zeroScoreGateAlreadyOffered` at line
616 so it nags once; `emitBindingGate` has NO equivalent, so it re-fires on every
turn for the same off-scope room (confirmed live today across one continuous
session).
  </root_cause>

  <behavior>
Write tests/test-260917-binding-gate-offscope.cjs FIRST and prove it RED before
touching scripts/intent-classifier.cjs. Clone the spawn harness from
tests/test-225-zero-score-gate.cjs (its `makeFixture` + `spawnSync(process.execPath,
[CLASSIFIER], { env: ..., CLAUDE_SESSION_ID: ... })` block around lines 110-135)
rather than inventing a second harness. Node built-in `assert` only, temp dirs
cleaned in a finally block, no em-dashes.

Fixture: a temp rooms home with THREE rooms with disjoint fingerprints:
  - `quantum-bakery`   the BOUND primary (write via
    lib/core/session-binding.cjs writeSessionBinding: bound ['quantum-bakery'],
    primary 'quantum-bakery')
  - `copper-ledger`    off-scope room Y (the top lexical match for message 1)
  - `tin-orchard`      off-scope room Z (the top lexical match for message 3)
Set BOTH `MINDRIAN_ROOMS_HOME` and `MINDRIAN_ROOMS_ROOT` to the fixture in the
spawn env, so this test passes before AND after Task C changes which var wins.

Legs:
  1. RED-1 wording: send a message rich in `copper-ledger` fingerprint tokens.
     Assert stdout names `quantum-bakery` as the bound primary AND does NOT contain
     the literal `session unbound`. Fails today (today it says "session unbound").
  2. RED-2 dedupe: send the IDENTICAL message a second time in the SAME session.
     Assert no binding gate fired (stdout carries none of the gate's distinctive
     markers). Fails today (today it re-fires).
  3. GREEN no-regression, genuinely unbound: same message, NO binding file written.
     Assert the literal `session unbound: choose which room(s) this session writes
     to` still appears, byte-identically. Must pass before and after.
  4. GREEN no-regression, dedupe is per-room not a session mute: a third message
     rich in `tin-orchard` tokens, same session. Assert the gate DOES fire (naming
     `quantum-bakery` as the bound primary). Must pass after the fix.

Assert silence on the gate's OWN distinctive markers, never on empty stdout: the
always-on Phase-91 navigation engine also writes to stdout every turn.
  </behavior>

  <action>
After the test is RED on legs 1 and 2, implement in scripts/intent-classifier.cjs:

1. Add three helpers directly BELOW the existing `markZeroScoreGateOffered`
   (line 3016), mirroring that trio's structure and comments verbatim in shape but
   with a PARALLEL key so the two gates never share or clobber state:
   - `bindingGateMarkerPath(roomDir, sessionId)` returning
     `path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.binding-gate-offered.json')`.
     Note the filename differs from `.zero-score-gate-offered.json`.
   - `bindingGateAlreadyOffered(roomDir, sessionId, roomName)` reading that file,
     returning true only when `roomName` is already in the persisted `rooms` array.
     Whole body in try/catch returning false (fail-open to "not offered", so a read
     fault NEVER suppresses the gate). Same reasoning as the 225 helper: a dedicated
     marker file is used because the shared decision-trace file rotates at 50
     entries and would silently re-arm the gate mid-session.
   - `markBindingGateOffered(roomDir, sessionId, roomName)` appending `roomName` to
     that array (dedupe on append) and writing atomically via the same
     tmp + rename idiom. Fire-and-forget, never throws.
   Key the dedupe on (sessionId, off-scope room) rather than session alone so a
   NEW off-scope room still gets its one prompt.

2. In the fire branch (lines 657-674), inside the existing try block after
   `roomDir` and `sessionId` are resolved, read the session binding using the SAME
   call the zero-score path already uses at lines 605-607:
   `readSessionBinding(sessionId, { home: root })` from lib/core/session-binding.cjs.
   Derive `boundPrimary` = `binding.primary` when it is a non-empty string AND not
   `NO_ROOM_SLUG`, else null.

3. Still inside that branch, before calling `emitBindingGate`: if
   `bindingGateAlreadyOffered(roomDir, sessionId, best.name)` is true, `return 0`
   (silence). Do NOT fall through to the legacy advisory, which would re-emit the
   same nag in different words.

4. Pass `boundPrimary` into `emitBindingGate` as a new named arg on its existing
   args object (`boundPrimary: boundPrimary`), read defensively at the top of
   `emitBindingGate` alongside the other `a.*` reads so an old-shaped call site
   degrades to null rather than throwing.

5. Inside `emitBindingGate`, branch the two user-visible strings on `boundPrimary`:
   - line 2930 systemMessage: when `boundPrimary` is set, use wording of the shape
     "this session is bound to {boundPrimary}; this message also matches {best.name}
     - switch or stay?". When null, keep TODAY'S string byte-identically.
   - line 2857 renderShapeF8 header: when `boundPrimary` is set, use a header that
     names the bound primary and the off-scope match. When null, keep
     `'-- mindrianOS -- bind session -- select rooms --'` BYTE-IDENTICALLY:
     tests/test-209-primary-sidechannel.cjs:668 carries that literal.

6. Call `markBindingGateOffered(roomDir, sessionId, best.name)` inside
   `emitBindingGate` immediately before it `return true`s, guarded in its own
   try/catch, mirroring where `emitNoMatchGate` calls `markZeroScoreGateOffered`
   (around line 3149). `best.name` is already in scope there.

7. Add `bindingGateAlreadyOffered` and `markBindingGateOffered` to module.exports
   next to the existing `emitBindingGate` export.

Preserve the never-block contract throughout: every new path fails open to the
existing behavior, nothing new may throw into the hook. Hyphens only.

If `bash tests/run-all-194.sh` goes red on a leg that expects a second fire, the
dedupe scope is too wide: narrow it to apply only when `boundPrimary` is non-null
(so a genuinely unbound session keeps today's fire-every-turn behavior) and rerun.
  </action>

  <verify>
    <automated>node tests/test-260917-binding-gate-offscope.cjs</automated>
    <automated>bash tests/run-all-194.sh &amp;&amp; bash tests/run-all-225.sh</automated>
  </verify>

  <done>
tests/test-260917-binding-gate-offscope.cjs was RED on legs 1 and 2 before the
implementation (record the RED output in the commit body) and all four legs are
green after. `bash tests/run-all-194.sh` and `bash tests/run-all-225.sh` both pass.
The Phase 225 zero-score gate code path is untouched (`git diff` shows no change to
`emitNoMatchGate`, `zeroScoreGateAlreadyOffered`, `markZeroScoreGateOffered`, or
`zeroScoreGateMarkerPath`). Committed as commit 2 of 3, separate from Task A.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task C: unify MINDRIAN_ROOMS_HOME then MINDRIAN_ROOMS_ROOT precedence across every resolver</name>
  <files>lib/core/rooms-home-env.cjs, tests/test-260917-rooms-home-precedence.cjs, scripts/intent-classifier.cjs, scripts/write-scope-check.cjs, scripts/gsd-graph-derive-sweep.cjs, scripts/brain-derivation-drain.cjs, scripts/memory-lifecycle.cjs, lib/core/cross-room-aggregator.cjs, lib/core/navigation/dashboard-helpers.cjs, scripts/brain-derive-command.cjs, scripts/feynman-timeline-refresh-command.cjs, scripts/memory-artifact-graph-hook.cjs</files>

  <root_cause>
Verified by grep today, do not re-derive. lib/core/session-binding.cjs:30 and
lib/core/resolve-active-room.cjs (lines 243, 325, 420, 484, 547) honor
MINDRIAN_ROOMS_HOME first and fall back to MINDRIAN_ROOMS_ROOT. Docs name HOME 3x
and ROOT 1x, so HOME is the intended primary. Eleven other resolver sites disagree.
Exact inventory, all line numbers current:

ROOT-only (HOME is ignored entirely):
  1. scripts/intent-classifier.cjs:71        resolveMindrianRoomsRoot
  2. scripts/write-scope-check.cjs:60        resolveMindrianRoomsRoot
  3. scripts/gsd-graph-derive-sweep.cjs:51   resolveMindrianRoomsRoot
  4. scripts/brain-derivation-drain.cjs:75   resolveMindrianRoomsRoot
  5. scripts/memory-lifecycle.cjs:90-91      resolveRoomsRoot (note: it .trim()s)
  6. lib/core/cross-room-aggregator.cjs:65   ALLOWED_ROOT load-time IIFE

ROOT-first-then-HOME (precedence inverted):
  7. lib/core/navigation/dashboard-helpers.cjs:51-52  detectActiveRoom
  8. scripts/brain-derive-command.cjs:292-293         resolveActiveRoom
  9. scripts/feynman-timeline-refresh-command.cjs:84-85 resolveActiveRoom
 10. scripts/memory-artifact-graph-hook.cjs:93-94
 11. scripts/intent-classifier.cjs:909-911           resolveRoomsRootForNav

NOT a site: scripts/intent-classifier.cjs:925-926 is a deliberate ROOT -> HOME
bridge feeding the Phase 127.3 chokepoint. Its direction already matches the
target precedence. Leave it exactly as is.
  </root_cause>

  <behavior>
Write tests/test-260917-rooms-home-precedence.cjs FIRST and prove leg 3 RED.
Node built-in `assert` only, temp dirs cleaned in a finally block, no em-dashes.

  Leg 1 (unit, the shared resolver): `roomsHomeEnv()` returns the HOME value when
    only HOME is set; the ROOT value when only ROOT is set; the HOME value when
    BOTH are set; null when neither is set. Save and restore both env vars around
    every case so the test cannot leak into its siblings.
  Leg 2 (census, the "every resolver agrees" assertion in tractable form): walk
    every .cjs under lib/ and scripts/ excluding node_modules and *.test.cjs, and
    assert every remaining literal `process.env.MINDRIAN_ROOMS_ROOT` occurrence is
    either (a) inside lib/core/rooms-home-env.cjs, (b) on an expression where
    `MINDRIAN_ROOMS_HOME` appears FIRST, or (c) in a small explicit allowlist
    (scripts/intent-classifier.cjs the ROOT -> HOME bridge). Every allowlist entry
    carries a one-line WHY comment in the test.
  Leg 3 (behavioral, RED today): spawn scripts/intent-classifier.cjs against a
    temp rooms-home fixture with ONLY `MINDRIAN_ROOMS_HOME` set and
    `MINDRIAN_ROOMS_ROOT` explicitly DELETED from the child env, and assert it
    resolves the fixture rooms (assert on an observable that requires a resolved
    root, for example the fixture room name appearing in the emitted navigation
    block). Fails today because resolveMindrianRoomsRoot ignores HOME.
  </behavior>

  <action>
After leg 3 is RED, implement:

1. Create lib/core/rooms-home-env.cjs. Single export `roomsHomeEnv()` returning a
   trimmed non-empty string or null, precedence MINDRIAN_ROOMS_HOME then
   MINDRIAN_ROOMS_ROOT. It reads process.env on EVERY call (never caches at module
   load) so hermetic tests can flip the env. Never throws. Header comment names
   this fix's root cause and states that HOME is the primary name per docs.
   This is a pure helper module, not an invocable surface, so Canon Part 11
   born-wired declaration does not apply.

2. Rewire all 11 sites in the inventory to call `roomsHomeEnv()` in place of their
   inline env read. Preserve each site's OWN surrounding behavior exactly:
   - sites 1-4 keep their `fs.existsSync(envRoot)` guard and their homedir scan
     fallback, only the env READ changes;
   - site 5 keeps returning `''` (not null) when nothing resolves; the resolver
     already trims, so drop the redundant local `.trim()`;
   - site 6 keeps `path.resolve` and the `~/MindrianRooms` default, and keeps
     resolving at module load (do not change when it evaluates);
   - sites 7-11 keep their `|| path.join(..., 'MindrianRooms')` tail and, where
     present, their `rootsOverride` first position.

3. Site 6 (lib/core/cross-room-aggregator.cjs ALLOWED_ROOT) is the Part 8
   containment base and its existing test lib/memory/cross-room-aggregator.test.cjs
   sets ONLY `MINDRIAN_ROOMS_ROOT` at line 306-308. Run that test after rewiring.
   If an ambient MINDRIAN_ROOMS_HOME in the dev shell makes it resolve elsewhere,
   fix the TEST to set both vars (matching the pattern already used in
   lib/memory/session-start-triple-injection.test.cjs), never by special-casing the
   resolver.

4. Leave lib/core/session-binding.cjs and lib/core/resolve-active-room.cjs alone.
   They already have the correct precedence and they are the reference behavior;
   refactoring them into the shared resolver is out of scope for this commit.

Hyphens only, no em-dashes.
  </action>

  <verify>
    <automated>node tests/test-260917-rooms-home-precedence.cjs</automated>
    <automated>node lib/memory/cross-room-aggregator.test.cjs &amp;&amp; node tests/test-260917-binding-gate-offscope.cjs &amp;&amp; bash tests/run-all-194.sh &amp;&amp; bash tests/run-all-225.sh</automated>
  </verify>

  <done>
tests/test-260917-rooms-home-precedence.cjs leg 3 was RED before the implementation
(record the RED output in the commit body) and all three legs are green after.
All 11 inventory sites call `roomsHomeEnv()`; the census leg proves no ROOT-only
site remains outside the documented allowlist. lib/memory/cross-room-aggregator.test.cjs,
tests/test-260917-binding-gate-offscope.cjs, run-all-194 and run-all-225 all pass.
Committed as commit 3 of 3, separate from Tasks A and B.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user message -> intent-classifier hook | Untrusted prompt text drives room scoring and gate firing |
| env var -> filesystem path | MINDRIAN_ROOMS_HOME / MINDRIAN_ROOMS_ROOT become read and write roots |
| classifier -> Brain | Canon Part 8 boundary; must stay closed, no task here opens it |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dia-01 | Tampering | Task B marker file path built from sessionId | mitigate | sessionId reaches the path only after the existing resolveSessionId; mirror the 225 marker helper exactly, which composes path.join under roomDir and never accepts a caller-supplied absolute path |
| T-dia-02 | Denial of Service | Task B dedupe suppressing a legitimate gate | mitigate | bindingGateAlreadyOffered fails OPEN to false on any read fault, so a corrupt or unreadable marker never silences the gate; dedupe is keyed per off-scope room so a new room still prompts once |
| T-dia-03 | Elevation of Privilege | Task C widening ALLOWED_ROOT in cross-room-aggregator | mitigate | precedence change only, path.resolve + startsWith containment untouched; lib/memory/cross-room-aggregator.test.cjs is a required verify leg |
| T-dia-04 | Information Disclosure | Task A instructions text reaching a client | accept | the string is already served verbatim at MCP initialize; adding a server NAME discloses nothing beyond the tool list the client already receives |
| T-dia-05 | Tampering | Task A silent truncation at the 2048-byte host cap | mitigate | measured byte assertion in the verify command plus lib/mcp/no-instructions.test.cjs enforcing both the budget and the hard cap against the live wire response |
| T-dia-SC | Tampering | package installs | accept | no npm/pip/cargo install in any task; no new dependency is added |
</threat_model>

<verification>
Run in order; each task's suite must be green before its own commit.

Task A: `node lib/mcp/no-instructions.test.cjs`, `node scripts/build-harness-manifest.cjs --check`,
then post-commit `node tests/test-298-contract-parity.cjs` (needs a clean tree).
Task B: `node tests/test-260917-binding-gate-offscope.cjs`, `bash tests/run-all-194.sh`, `bash tests/run-all-225.sh`.
Task C: `node tests/test-260917-rooms-home-precedence.cjs`, `node lib/memory/cross-room-aggregator.test.cjs`,
`node tests/test-260917-binding-gate-offscope.cjs`, `bash tests/run-all-194.sh`, `bash tests/run-all-225.sh`.

Final sweep after commit 3: `git log --oneline -3` shows exactly three commits in
order A, B, C. `git diff HEAD~3 --stat` shows zero changes to
scripts/part8-egress-guard-hook.cjs, tests/test-260906-fda-known-tool-shapes.cjs,
tests/test-245-egress-contentless.cjs, and .planning/spikes/.
`git diff HEAD~3 -- scripts/intent-classifier.cjs | grep -c "emitNoMatchGate\|zeroScoreGateAlreadyOffered\|markZeroScoreGateOffered"`
returns 0 changed lines touching those identifiers.
</verification>

<success_criteria>
1. RUNTIME_INSTRUCTIONS names `mindrian-brain` at both brain_* mention points, at or
   under 2000 bytes, with the budget in lockstep across all three places.
2. An already-bound session sent an off-scope message sees wording that names its
   bound primary, and sees that gate at most once per off-scope room per session.
3. A genuinely unbound session still sees the byte-identical `session unbound`
   wording.
4. Every rooms-root resolver under lib/ and scripts/ honors HOME first then ROOT,
   proven by a unit leg, a census leg, and one end-to-end HOME-only spawn.
5. Three separate commits. Two new tests, each RED before its fix.
6. Phase 225 zero-score gate untouched. Peer-owned files untouched. No em-dashes.
</success_criteria>

<output>
Quick mode: no SUMMARY file required. Report back with the three commit SHAs, the
measured RUNTIME_INSTRUCTIONS byte count, and the RED-then-GREEN evidence for
tests/test-260917-binding-gate-offscope.cjs and
tests/test-260917-rooms-home-precedence.cjs.
</output>
</content>
</invoke>
