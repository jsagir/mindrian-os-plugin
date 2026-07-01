---
phase: 194-per-session-room-binding
plan: 03
type: execute
wave: 2
depends_on: ["194-02"]
files_modified:
  - lib/core/resolve-active-room.cjs
autonomous: true
requirements: [PSB-02, PSB-03, PSB-15]

must_haves:
  truths:
    - "resolveWriteRoom resolves .room-root walk-up FIRST, then session.primary, then reg.active demoted"
    - "reg.active is now reached only when a session is unbound and no .room-root wins (fresh-session seed-default)"
    - "resolveSessionScope reports onScope=true iff the top room is a member of session.bound; an unbound session is onScope=false"
    - "the existing no-SQLite/no-graph-token source-grep tripwire still passes (the new entry points stay filesystem-read-only)"
  artifacts:
    - path: "lib/core/resolve-active-room.cjs"
      provides: "resolveWriteRoom + resolveSessionScope, the ONE place session precedence lives; both guards inherit"
      exports: ["resolveWriteRoom", "resolveSessionScope"]
  key_links:
    - from: "lib/core/resolve-active-room.cjs"
      to: "lib/core/session-binding.cjs readSessionBinding"
      via: "require + compose in resolveWriteRoom/resolveSessionScope"
      pattern: "readSessionBinding"
    - from: "lib/core/resolve-active-room.cjs"
      to: "lib/core/room-root.cjs resolveRoomRoot"
      via: "leg 1 of the write precedence"
      pattern: "resolveRoomRoot"
---

<rules>
## RULES

- **Part 8 (LOCAL only):** the resolver stays READ-only over the filesystem session file; NO room.db token, NO Brain token. The shipped no-SQLite/no-graph source-grep tripwire (rar.11/rar.12) MUST stay green.
- **D-02 mandate - ONE reader:** session precedence lives in resolve-active-room.cjs ONLY, so both guards (intent-classifier tripwire + write-scope-check) inherit from one file. This is the SEED-034 four-guessers lesson - do NOT add a second resolver.
- **PSB-15 (reg.active demoted):** reg.active is no longer the write authority for a bound session; it is the fresh-session seed-default (leg 3 of resolveWriteRoom only).
- **Fail OPEN:** never throw; on any failure fall through to the demoted default (mirror resolveActiveRoom's never-throw discipline).
- CJS only. NO em-dashes. Additive only - do NOT change resolveActiveRoom's existing precedence or signature; add TWO new exports.
- Resumable: single-file additive edit; re-running is idempotent.
</rules>

<objective>
Add the two session-aware entry points to the ONE canonical resolver so both write-guards inherit session precedence from a single file (D-02): `resolveWriteRoom({filePath, sessionId, home})` implementing WRITE precedence (.room-root walk-up -> session.primary -> reg.active demoted, PSB-02/PSB-15) and `resolveSessionScope({sessionId, topRoom, home})` implementing the tripwire on-scope test (onScope iff topRoom in session.bound, PSB-03). No behavior change until Waves 3-4 wire the guards to these functions.

Purpose: land the resolution precedence in exactly one place before any guard calls it.
Output: 2 additive exports on resolve-active-room.cjs + their green unit tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
@lib/core/resolve-active-room.cjs
@lib/core/room-root.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: resolveWriteRoom - the D-02 write precedence with reg.active demoted (PSB-02, PSB-15)</name>
  <read_first>
    - lib/core/resolve-active-room.cjs:91-166 `resolveActiveRoom` (the existing precedence to WRAP as the demoted leg 3: env override 100 -> reg.active 120 -> legacy 122 -> null; never-throws; sealed/archived honored 142-143; fs.existsSync gate 158) and :188 `module.exports` (extend it).
    - lib/core/room-root.cjs `resolveRoomRoot(filePath)` (walk-up to the `.room-root` sentinel; MAX_DEPTH=12 at :30, PRIMARY_SENTINELS=['.room-root'] at :37) - leg 1.
    - lib/core/session-binding.cjs readSessionBinding (Wave 1; leg 2 reads `.primary`).
    - 194-RESEARCH.md Target 2 "Where session-awareness inserts" (the exact 3-leg precedence + `source` return field).
  </read_first>
  <behavior>
    - filePath under a `.room-root` -> returns that dir, source:'room-root' (wins over primary and reg.active)
    - no .room-root, session.primary set + room exists -> returns primary, source:'session.primary'
    - no .room-root, unbound session -> returns resolveActiveRoom result, source:'reg.active'
    - session.primary pointing at a non-existent room -> falls through to reg.active (does not return a dead room)
    - never throws; a corrupt binding file -> primary treated as null -> reg.active
  </behavior>
  <action>Add resolveWriteRoom({filePath, sessionId, home}) -> {slug, abs_path, source} to resolve-active-room.cjs. Leg 1: require room-root.cjs; if resolveRoomRoot(filePath) is non-empty, return that dir with source:'room-root'. Leg 2: else require session-binding.cjs; read readSessionBinding(sessionId).primary; if set AND the room exists (fs.existsSync within rooms root, reuse the :158 gate discipline), return it with source:'session.primary'. Leg 3: else return resolveActiveRoom({home}) with source:'reg.active' (the DEMOTED seed-default, PSB-15). Never throw; any failure in leg 1 or 2 falls through to the next leg. Extend module.exports at :188 with resolveWriteRoom. Keep the file's no-SQLite/no-graph header tripwire intact (this function touches only the filesystem session file).</action>
  <verify>
    <automated>node tests/test-resolve-write-room.test.cjs</automated>
  </verify>
  <done>test-resolve-write-room.test.cjs passes all four precedence cases; reg.active is reached only as leg 3; no room.db/Brain token introduced.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: resolveSessionScope - the D-02 tripwire on-scope test (PSB-03)</name>
  <read_first>
    - lib/core/session-binding.cjs readSessionBinding (Wave 1; the `.bound` SET the membership test reads).
    - scripts/intent-classifier.cjs main() score loop 441-462 and the single-equality silence test at :456 (`best.name === active`) - the test this scope function replaces in Wave 3.
    - 194-RESEARCH.md Target 2 "resolveSessionScope" (onScope = readSessionBinding(sessionId).bound.includes(topRoom); unbound -> onScope:false which fires the gate).
  </read_first>
  <behavior>
    - topRoom in session.bound -> {onScope:true, bound:[...]}
    - topRoom not in bound -> {onScope:false, bound:[...]}
    - unbound session (empty/absent binding) -> {onScope:false, bound:[]}
    - the `__no_room__` sentinel in bound -> a write resolving to no-room is on-scope (so the dev-repo case does not fire the gate once chosen)
    - never throws on a corrupt binding file (safe default -> onScope:false)
  </behavior>
  <action>Add resolveSessionScope({sessionId, topRoom, home}) -> {onScope, bound} to resolve-active-room.cjs. Read readSessionBinding(sessionId, {home}); onScope = bound.includes(topRoom). An unbound/empty binding yields onScope:false (this is precisely what graduates the tripwire to the F.8 gate in Wave 3). Treat the reserved `__no_room__` sentinel as a first-class member so a session that chose dev-repo/no-room is on-scope for a no-room write. Never throw. Extend module.exports with resolveSessionScope.</action>
  <verify>
    <automated>node tests/test-resolve-session-scope.test.cjs</automated>
  </verify>
  <done>test-resolve-session-scope.test.cjs passes: member->true, non-member->false, unbound->false, no-room sentinel handled, corrupt file safe.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| session binding file -> resolver | untrusted binding content informs write-room resolution |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-07 | Tampering | corrupt binding file skews resolution | mitigate | readSessionBinding returns safe default -> resolveWriteRoom falls through to reg.active; never throws |
| T-194-08 | Elevation of privilege | resolver reaches into room.db / Brain | mitigate | the shipped no-SQLite/no-graph-token source-grep tripwire (rar.11/rar.12) stays green; new entry points are filesystem-read-only |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-resolve-write-room.test.cjs && node tests/test-resolve-session-scope.test.cjs` pass.
- The file's existing no-SQLite/no-graph-token self-test (rar.11/rar.12) still passes.
- `bash tests/run-all-194.sh` shows the two resolution legs PASSED plus Wave-1 legs; the rest SKIPPED.
</verification>

<success_criteria>
- Session precedence lives in exactly one file; both guards can now inherit it in Wave 3.
</success_criteria>

## Artifacts this phase produces (this plan)
- `lib/core/resolve-active-room.cjs` gains `resolveWriteRoom` (.room-root -> session.primary -> reg.active demoted) and `resolveSessionScope` (bound-membership tripwire), additive exports; reg.active demoted to fresh-session seed-default.

<output>
Create `.planning/phases/194-per-session-room-binding/194-03-SUMMARY.md` when done
</output>
