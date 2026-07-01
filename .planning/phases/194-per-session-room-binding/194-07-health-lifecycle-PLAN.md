---
phase: 194-per-session-room-binding
plan: 07
type: execute
wave: 5
depends_on: ["194-04", "194-05", "194-06"]
files_modified:
  - scripts/doctor.cjs
  - scripts/session-end-presence.cjs
  - scripts/reassign-primary.cjs
  - hooks/hooks.json
autonomous: true
requirements: [PSB-13, PSB-14, PSB-16]

must_haves:
  truths:
    - "doctor --bind-check <roomDir> returns {healthy, findings} from a LOCAL structural check (room dir + .room-root + room.db nodes/edges tables), never a Brain call, and registers presence"
    - "On unhealthy the bind still degrades exit-0 (advisory) - binding is never hard-blocked"
    - "SessionEnd removes the session's presence file from every bound room (clean-on-end)"
    - "doctor's cadence stale-reaps dead sessions (pid dead OR mtime>5m); a live pid is never reaped - BOTH teardown paths (D-08)"
    - "A one-key reassign switches session.primary among the bound set without a per-write prompt"
  artifacts:
    - path: "scripts/doctor.cjs"
      provides: "--bind-check job (local health + presence register) + presence stale-reap on cadence"
      contains: "bind-check"
    - path: "scripts/session-end-presence.cjs"
      provides: "SessionEnd presence deregister across all bound rooms"
      exports: ["deregisterAll"]
    - path: "scripts/reassign-primary.cjs"
      provides: "one-key primary reassign (rewrites session.primary via writeSessionBinding)"
  key_links:
    - from: "scripts/doctor.cjs"
      to: "lib/core/session-presence.cjs registerPresence + reap"
      via: "bind-check registers; cadence reaps"
      pattern: "registerPresence|reap"
    - from: "hooks/hooks.json"
      to: "scripts/session-end-presence.cjs"
      via: "SessionEnd hook wiring"
      pattern: "session-end-presence"
---

<rules>
## RULES

- **D-10 (doctor cadence):** the bind-check runs at BIND-TIME + reconcile cadence ONLY, never per-turn. It is a LIGHTWEIGHT LOCAL structural check, NOT the `--acceptance` Brain-smoke (which would thrash across N sessions - the exact anti-pattern D-10 forbids).
- **Part 8 (LOCAL only):** the bind-check makes NO Brain call; session-end-presence + reassign-primary touch local files only. The local-only floor greps session-end-presence.cjs + reassign-primary.cjs.
- **D-08 (teardown BOTH):** clean-on-end (SessionEnd deregister) AND stale-reap (pid dead + mtime>5m on doctor cadence). Both, not either.
- **PSB-16 (one-key reassign):** reuse the existing keypress/dial capture; do NOT build a new selector shape. Primary-as-default with a one-key switch, zero per-write prompt (D-06).
- **Fail OPEN (never-block):** an unhealthy bind-check still exits 0 with an advisory; binding is never hard-blocked.
- Frozen scalars untouched; STALE_MS=300000 reused from session-presence (not a frozen-family scalar). CJS only. NO em-dashes.
- Resumable: doctor + two new scripts + hook wiring; each independently commitable.
</rules>

<objective>
Close the lifecycle: the doctor bind-time job (PSB-14/D-10) that structurally health-checks a newly-bound room locally and registers its presence; both presence-teardown paths (PSB-13/D-08) - SessionEnd clean-on-end plus stale-reap on doctor cadence; and the one-key primary reassign UX (PSB-16/D-06). Everything fails open and stays local.

Purpose: make binding safe (health-checked before mutation) and self-cleaning (no orphan presence files), and give the navigator a zero-friction way to switch the primary write target.
Output: doctor --bind-check + reap cadence + SessionEnd deregister script + hook wiring + one-key reassign + green tests + full-suite gate.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
@lib/core/session-presence.cjs
@lib/core/session-binding.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: doctor --bind-check (local health + presence register) + stale-reap cadence (PSB-14, PSB-13 half)</name>
  <read_first>
    - scripts/doctor.cjs:105-268 `parseArgs` switch (add `--bind-check <roomDir>` as a SIBLING flag like `--acceptance` at :228; `usageText()` at :269 documents it), :688 `findRoomRoot` (reuse the `.room-root` sentinel predicate), :3331 the orphan mtime sweep `if (st.mtimeMs < cutoff) continue` (the cadence the presence reap rides).
    - lib/core/session-presence.cjs registerPresence + reap (Wave 1; called here, not reimplemented).
    - 194-RESEARCH.md Target 6 (the bind-check predicate: room dir exists + .room-root sentinel + .mindrian/room.db opens with nodes/edges tables; NO Brain call; return {healthy, findings}; register presence on green).
  </read_first>
  <behavior>
    - doctor --bind-check <healthy room> -> {healthy:true, findings:[]} and registers <room>/.mindrian/sessions/<sid>.json
    - doctor --bind-check <room missing room.db or tables> -> {healthy:false, findings:[...]}, exit 0 (advisory, never hard-block)
    - the bind-check makes zero Brain/network call
    - doctor's cadence reap removes dead/stale presence files (pid dead OR mtime>5m); live-pid untouched
  </behavior>
  <action>Add a `--bind-check <roomDir>` sibling flag to doctor.cjs parseArgs (mirror the --acceptance flag structure) with its own exit-code contract. Implement a lightweight LOCAL predicate (reuse findRoomRoot/:688): room dir exists + `.room-root` sentinel present + `.mindrian/room.db` opens and has `nodes` + `edges` tables. NO Brain call (Part 8). Return {healthy, findings}; on green call session-presence.registerPresence(roomDir, sessionId); on unhealthy still exit 0 and surface an advisory (never-block). Ride the existing orphan/mtime sweep cadence (:3331) to call session-presence.reap(roomDir) for the presence dir - keyed to bind-time + reconcile cadence, NEVER per-turn. Document usageText at :269. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-doctor-bind-check.test.cjs</automated>
  </verify>
  <done>test-doctor-bind-check.test.cjs passes: healthy->register, unhealthy->advisory exit 0, zero Brain call; reap drops dead/stale on cadence, keeps live-pid.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SessionEnd presence deregister (clean-on-end) + hook wiring (PSB-13 half, D-08)</name>
  <read_first>
    - lib/core/session-presence.cjs deregisterPresence (Wave 1; idempotent unlink) and lib/core/session-binding.cjs readSessionBinding (to enumerate the session's bound rooms).
    - hooks/hooks.json (the SessionStart block at :3 is the sibling to model; add a SessionEnd entry running this new script; the shipped sessionstart-coordinator.cjs is the SessionStart counterpart research names).
    - 194-RESEARCH.md Target 6 "Register / deregister presence" (deregister on SessionEnd for every bound room).
  </read_first>
  <behavior>
    - SessionEnd -> for each room in readSessionBinding(sid).bound, deregisterPresence(roomDir, sid)
    - deregister is idempotent (no-op if the presence file is already gone)
    - a parse/enumeration error is swallowed (never throws out of the hook)
  </behavior>
  <action>Create scripts/session-end-presence.cjs exporting deregisterAll({sessionId, home}): read readSessionBinding(sessionId).bound, and for each bound room (resolve its dir; skip the `__no_room__` sentinel) call session-presence.deregisterPresence(roomDir, sessionId). Wrap in try/catch that never throws. Wire a SessionEnd entry in hooks.json running this script (mirror the SessionStart wiring shape at :3). Source-grep-clean header (no Brain/network token). NO em-dashes.</action>
  <verify>
    <automated>node tests/test-presence-stale-reap.test.cjs && node -e "require('./scripts/session-end-presence.cjs').deregisterAll({sessionId:'x',home:process.env.TMPDIR||'/tmp'})"</automated>
  </verify>
  <done>SessionEnd deregisters presence across all bound rooms (idempotent, never throws); hooks.json carries the SessionEnd wiring; combined with Task 1 reap this is D-08 BOTH.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: One-key primary reassign UX (PSB-16, D-06)</name>
  <read_first>
    - lib/core/session-binding.cjs readSessionBinding + writeSessionBinding (Wave 1; the primary lives here).
    - 194-RESEARCH.md Open Question 2 (reuse the existing dial/keypress capture; primary-as-default with a one-key switch, no per-write prompt) + D-06.
    - 194-PATTERNS.md "Compose the shape, supply a new sink" (reuse capture, thin sink) - do NOT build a new selector shape.
  </read_first>
  <behavior>
    - reassign switches session.primary to the next (or chosen) member of session.bound and persists it via writeSessionBinding
    - a reassign to a room not in bound is rejected (safe no-op)
    - reassign never prompts per-write (zero-friction) and never throws
  </behavior>
  <action>Create scripts/reassign-primary.cjs: a one-key affordance that reads readSessionBinding(sessionId), switches primary among the bound SET (cycle to next member, or accept an explicit pick when supplied), and persists via writeSessionBinding (reuse the existing keypress/dial capture rather than a new surface, per Open Q2). Reject a target not in bound (safe no-op). Never prompt per-write (D-06 zero-friction); never throw. Source-grep-clean header. NO em-dashes.</action>
  <verify>
    <automated>node -e "const r=require('./scripts/reassign-primary.cjs'); if(typeof r.reassignPrimary!=='function') process.exit(1)"</automated>
  </verify>
  <done>reassign-primary cycles/sets session.primary among bound, rejects non-members, persists via writeSessionBinding, zero per-write prompt.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bind-check -> room.db open | an unhealthy/foreign room.db could error the check |
| SessionEnd hook -> filesystem | teardown deletes presence files based on the binding |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-19 | Denial of service | an unhealthy room hard-blocks binding | mitigate | bind-check exits 0 with an advisory on unhealthy; binding is never hard-blocked (never-block contract) |
| T-194-20 | Information disclosure | bind-check reaches Brain and thrashes across sessions | mitigate | the check is LOCAL-only (Part 8); the local-only floor greps the new scripts; D-10 forbids the per-turn Brain smoke |
| T-194-21 | DoS | orphan presence files accumulate on crash | mitigate | doctor-cadence stale-reap bounds the dir; SessionEnd clean-on-end covers graceful exits (D-08 BOTH) |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-doctor-bind-check.test.cjs && node tests/test-presence-stale-reap.test.cjs` pass.
- `node tests/test-194-local-only.test.cjs` green (session-end-presence + reassign-primary carry zero Brain/network token).
- PHASE GATE: `bash tests/run-all-194.sh` fully green with ZERO SKIP for landed reqs, then `node scripts/check-render-coverage.cjs --check` green (F.8/F.9 covered).
</verification>

<success_criteria>
- Binding is health-checked locally before mutation and self-cleans on both clean exit and crash; the navigator can switch the primary write target with one key; the full 194 suite is green.
</success_criteria>

## Artifacts this phase produces (this plan)
- `scripts/doctor.cjs` gains `--bind-check` (local health + presence register) + presence stale-reap on cadence
- `scripts/session-end-presence.cjs` (SessionEnd deregister across bound rooms) + hooks.json SessionEnd wiring
- `scripts/reassign-primary.cjs` (one-key primary reassign, zero per-write prompt)

<output>
Create `.planning/phases/194-per-session-room-binding/194-07-SUMMARY.md` when done
</output>
