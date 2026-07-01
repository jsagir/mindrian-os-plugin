---
phase: 194-per-session-room-binding
plan: 05
type: execute
wave: 3
depends_on: ["194-03"]
files_modified:
  - scripts/write-scope-check.cjs
autonomous: true
requirements: [PSB-07, PSB-06]

must_haves:
  truths:
    - "The write-guard blocks ONLY when the resolved write room is NOT a member of session.bound AND is not the dev-repo/no-room case"
    - "A write to the dev repo / no-room (bound carrying __no_room__ or empty) is ALLOWED - the false plugin-CLAUDE.md block is gone"
    - "The resolved write room comes from resolveWriteRoom (.room-root -> primary -> reg.active), not a raw reg.active equality"
    - "Any parse/resolution failure exits 0 (fail-open) - a false block is worse than a false allow"
    - "The separate sealed-room block is untouched"
  artifacts:
    - path: "scripts/write-scope-check.cjs"
      provides: "set-membership PreToolUse guard inheriting session precedence from resolve-active-room.cjs"
      contains: "resolveSessionScope"
  key_links:
    - from: "scripts/write-scope-check.cjs"
      to: "lib/core/resolve-active-room.cjs resolveWriteRoom + resolveSessionScope"
      via: "replace the single-equality block with membership"
      pattern: "resolveWriteRoom"
---

<rules>
## RULES

- **D-04 (set-membership):** block iff the resolved write room is NOT in session.bound AND not the dev-repo/no-room case. The single-active-room equality is retired.
- **D-02 (ONE reader):** the write room and the scope come from resolve-active-room.cjs (resolveWriteRoom + resolveSessionScope), NOT a re-implemented resolver here. Inherit, do not duplicate.
- **PSB-06 fail OPEN:** preserve the header contract ("On any parse/resolution failure: exit 0 (fail-open). A false block is worse than a false allow") and `allow() { process.exit(0); }`. The guard is a workflow guardrail, NOT a security boundary.
- **Do NOT touch the sealed-room block** - that is a separate GUARDRAIL.md check; leave it byte-identical.
- **Part 8 (LOCAL only):** no room.db / Brain token added; the guard reads the filesystem session state only.
- CJS only. NO em-dashes.
- Resumable: single-file edit; disjoint from 194-04 (intent-classifier + consumer) - parallel-safe in Wave 3.
</rules>

<objective>
Flip the Phase 83-06 write-scope guard from single-active-room equality to session-set-membership (D-04/PSB-07). It resolves the write room through resolveWriteRoom (.room-root -> session.primary -> reg.active demoted) and blocks only when that room is not a member of session.bound and is not the dev-repo/no-room case. The false no-room block (the spurious plugin-CLAUDE.md write block) disappears. Fail-open is preserved end-to-end.

Purpose: make the write-guard honor per-session binding instead of a raced global field.
Output: 1 modified hook + green set-membership test.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
@lib/core/resolve-active-room.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace single-active-room equality with session-set-membership (PSB-07, PSB-06)</name>
  <read_first>
    - scripts/write-scope-check.cjs:248 `if (targetRoom !== activeRoom) { ... block ... }` (the exact equality block to flip; message 250-253, reason 253), :224 `readActiveRoom` reading `parsed.active` at :67 (DEMOTED to a fresh-session default), :14 the fail-open header contract, :152 `allow() { process.exit(0); }`, :244 the sealed-room block (leave untouched).
    - hooks/hooks.json:187 (the PreToolUse Write|Edit|MultiEdit wiring that runs this guard - unchanged).
    - lib/core/resolve-active-room.cjs resolveWriteRoom + resolveSessionScope (Wave 2; the inherited resolution).
    - 194-RESEARCH.md Target 2 "Write guard" (the exact block-iff condition) + Target 3 "the dev-repo/no-room branch".
  </read_first>
  <behavior>
    - resolved write room in session.bound -> allow (exit 0)
    - resolved write room NOT in bound AND not dev-repo/no-room -> block with reason
    - dev-repo/no-room write (bound carries __no_room__ or resolveWriteRoom yields no-room) -> allow (the false block is gone)
    - resolver/parse throws -> exit 0 (fail-open)
    - sealed-room path still blocks (untouched)
  </behavior>
  <action>In write-scope-check.cjs, replace the single-equality block at :248 with: resolve the target write room via resolveWriteRoom({filePath: target, sessionId}); compute resolveSessionScope({sessionId, topRoom: resolvedRoom}). Block iff the resolved room is NOT in session.bound (onScope false) AND it is not the dev-repo/no-room case (resolvedRoom is the `__no_room__` sentinel, or resolveWriteRoom returned no room, or bound carries `__no_room__`). Demote readActiveRoom/:67 `parsed.active` to a fresh-session default only (consumed via resolveWriteRoom leg 3, not as a direct equality). Keep the sealed-room block at :244 byte-identical. Preserve the fail-open contract: wrap the new resolution in try/catch and call allow()/exit 0 on any failure (the :14 header + :152 allow()). Resolve sessionId the same way the classifier does (compose, do not re-derive). No room.db/Brain token.</action>
  <verify>
    <automated>node tests/test-write-scope-set-membership.test.cjs</automated>
  </verify>
  <done>test-write-scope-set-membership.test.cjs passes: in-bound allow, off-bound block, dev-repo/no-room allow (false block gone), resolver-error fail-open, sealed-room block intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PreToolUse Write|Edit -> write-scope-check | untrusted target path + session state decides allow/block |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-12 | Denial of service | a resolution error hard-blocks a legitimate write | mitigate | fail-open: any parse/resolution failure calls allow()/exit 0 (83-06 contract, "a false block is worse than a false allow") |
| T-194-13 | Tampering | a corrupt binding grants an off-scope write | accept | the guard is a workflow guardrail not a security boundary (RESEARCH V4: fail-open by design); worst case degrades to the old racy allow, never a leak |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-write-scope-set-membership.test.cjs` passes.
- `node tests/test-194-local-only.test.cjs` green.
- `bash tests/run-all-194.sh` shows the set-membership leg PASSED alongside Waves 1-2 and 194-04.
</verification>

<success_criteria>
- The write-guard is set-membership, dev-repo/no-room writes are allowed, and fail-open is preserved.
</success_criteria>

## Artifacts this phase produces (this plan)
- `scripts/write-scope-check.cjs` flipped to session-set-membership (via resolveWriteRoom + resolveSessionScope); the false no-room block removed; fail-open + sealed-room block preserved.

<output>
Create `.planning/phases/194-per-session-room-binding/194-05-SUMMARY.md` when done
</output>
