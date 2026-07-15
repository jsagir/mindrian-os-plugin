# Phase 225: Per-session room binding and multi-session reconciliation (SEED-039) - Research

**Researched:** 2026-07-15
**Domain:** Session-to-room resolution, the intent-classifier tripwire gate, SQLite concurrency in room.db
**Confidence:** HIGH (every roadmap file:line claim independently re-verified against current dev-repo HEAD this session)

## Summary

SEED-039 was filed 2026-06-29 as a four-pillar design. Two days later Phase 194
(per-session-room-binding, COMPLETE 2026-07-01) shipped essentially the ENTIRE four-pillar
architecture. This is the single most important finding for planning: **Phase 225 is not a
greenfield build of the seed. It is a narrow gap-closure on top of Phase 194's already-shipped
substrate.** I read all four pillars in the live code and confirmed each is present:

- **Pillar 1 (per-session binding SET + primary + sticky):** `lib/core/session-binding.cjs` SHIPPED.
- **Pillar 2 (F.8 binding gate, graduated from advisory-nag):** `emitBindingGate` + `runBindingGate`
  in `scripts/intent-classifier.cjs` SHIPPED - but gated behind the line-509 early-return.
- **Pillar 3 (write-guard set-membership):** `session-binding.cjs::isRoomInWriteScope` SHIPPED.
- **Pillar 4 (lost-update reconcile via CAS + presence ledger):** `lib/core/navigation/reconcile-guard.cjs`
  (`checkLostUpdate`/`checkReconcile`) + `lib/core/session-presence.cjs` (`hasCoSession`) SHIPPED and wired.
- **The spine (doctor bind-time health + presence registration):** `session-presence.cjs::runBindCheck`
  + the `doctor.cjs --bind-check <roomDir>` flag SHIPPED.

The roadmap's 2026-07-15 self-correction is **CONFIRMED CORRECT in full**. The "shared
resolver-fragmentation with Phase 224" premise is stale: `resolveWriteRoom()` Leg 1, the
write-guard, and the write-index path all already converge on `room-root.cjs::resolveRoomRoot()`.
That resolver is settled, not fragmented. Phase 225's real remaining scope is exactly the two
narrow items the roadmap names.

**Primary recommendation:** Scope Phase 225 to two disjoint, narrow gaps on Phase 194's shipped
substrate: (1) the `intent-classifier.cjs:509` zero-score early-return that suppresses the F.8
gate on a conversational reframe that fingerprint-matches NO room (SEED-039 proving_case_2); and
(2) a doctor advisory health-check for the Phase-218 WAL-reset corruption window (SQLite < 3.51.3
+ live co-session), since the code-level concurrency defenses already exist and only the
environment condition remains undetected. Do NOT re-plan the four pillars; they shipped in 194.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect a conversational reframe that matches no known room | CLI hook (`intent-classifier.cjs` UserPromptSubmit tripwire) | - | The tripwire is the only surface that sees the raw user message and scores it against room fingerprints |
| Fire the "new project vs stay in primary" Decision Gate | CLI hook -> HMI renderer (`shape-f8-renderer.cjs`) | Desktop/Cowork (AskUserQuestion) | The gate is a Shape F.8 (Canon Part 3) Decision Gate; the renderer already exists |
| Resolve the write-target room | `lib/core/resolve-active-room.cjs::resolveWriteRoom` | `room-root.cjs`, `session-binding.cjs` | Already the ONE converged resolver (Phase 194/127.3); 225 reads it, does not modify it |
| Serialize concurrent room.db writes | `lib/core/room-db.cjs::openRoomDb` (busy_timeout) | - | Physical SQLITE_BUSY serialization; already fixed in Phase 218 D-05 |
| Detect logical lost-updates on a node edit | `lib/core/navigation/reconcile-guard.cjs::checkLostUpdate` | `navigation.cjs` chokepoint | CAS via `last_modified_at`; already shipped and wired (Phase 194-06) |
| Warn on the WAL-reset corruption window | `scripts/doctor.cjs` (a new advisory check) | `session-presence.cjs::hasCoSession` | Environment-only concern (SQLite version); doctor is the diagnostic home per Phase 217 |

## Verification Log (roadmap claims re-checked against current code)

Per this repo's own convention this session, every file:line claim was confirmed directly.

| Roadmap claim | Verified? | Evidence |
|---------------|-----------|----------|
| `intent-classifier.cjs:509` is `if (!best \|\| best.score === 0) return 0;` | **YES** | Read line 509 verbatim. It sits at the top of the scoring result handler, BEFORE the F.8 gate block at lines 511-548. |
| The F.8 binding gate is skipped when this fires | **YES** | The `_runBindingGate` call is at line 523, inside the block that line 509 returns before. On `best.score === 0` the function returns 0 and never reaches 523. |
| Phase 194 converged write-guard + write-index onto `room-root.cjs::resolveRoomRoot()` | **YES** | `resolveWriteRoom()` Leg 1 (resolve-active-room.cjs:208-215) calls `roomRoot.resolveRoomRoot(filePath)`. `session-binding.cjs` and `resolveSessionScope()` both exist and are the on-scope test. The resolver is settled. |
| Phase 218's WAL finding is a real second concurrency site | **PARTIAL** | Two distinct issues (see Pitfall 2 + State of the Art). The SQLITE_BUSY case is already FIXED (218 D-05). The WAL-reset corruption is an upstream SQLite < 3.51.3 bug, code-unfixable, environment watch item. |
| Phase 224's in-progress work does not touch this phase's scope | **YES** | Grepped all 224 plan `files:` blocks. 224 writes to intelligence-cascade.cjs, gsd-graph-derive-*.cjs, navigation/memory-events.cjs, graph-derive-classifier.cjs, graph-backfill.cjs, gsd-artifact-graph-hook.cjs. It READS `resolveWriteRoom` but edits ZERO files in 225's scope. `grep intent-classifier .planning/phases/224-*/*-PLAN.md` = NONE. |
| The debug-file `resolve-room EXIT:1` is a DIFFERENT resolver | **YES** | It is `scripts/resolve-room` (the CLI command pre-flight resolver) returning EXIT:1 because the room was never registered (`room-registry` exited 49). That is SEED-034 broken-pipe #1 (registration / write-path), squarely Phase 224 territory. It is NOT `resolve-active-room.cjs`, NOT `resolveWriteRoom`, NOT `room-root.cjs`, NOT `intent-classifier.cjs`. |

## Phase Requirements

> ROADMAP lists Requirements as TBD and no global REQ-XX ids are mapped (same pattern as Phase 224:
> "no global REQ-XX ids mapped to this phase"). The following are RECOMMENDED local requirements
> derived from this research, to be confirmed/renumbered at spec-phase.

| Rec ID | Description | Research Support |
|--------|-------------|------------------|
| REQ-1 | The tripwire fires a Decision Gate when a message matches NO known room (all scores 0) AND the session has a bound primary, offering "new project" vs "continue in `<primary>`" vs "no room / dev repo" | Line 509 early-return traced; proving_case_2; Jonathan's live re-derivation |
| REQ-2 | The zero-score gate is a DISTINCT gate from the off-scope gate (its candidate is not the arbitrary `best.name`) | On `best.score === 0`, `best.name` is the first corpus room by construction - semantically meaningless (see Pitfall 1) |
| REQ-3 | The new gate preserves the 83-07 never-block contract: any hook/render error degrades to exit-0 silence, never a hard-block | The existing gate block (531-548) already fails open; the new path must match |
| REQ-4 | `doctor.cjs` gains an advisory check that warns when bundled SQLite < 3.51.3 AND a live co-session is present in a room | Phase 218 WAL-reset finding (commit 298a1c84); `session-presence.cjs::hasCoSession` is the co-session probe |
| REQ-5 | No new invocable surface bypasses CIRS (Part 11): the gate reuses the shipped `shape-f8-renderer` + `runBindingGate` door, born WIRED | Canon Part 11; the existing gate already routes through the one governed door |
| REQ-6 | A phase-gate test (`tests/run-all-225.sh`) proves the reframe scenario fires the gate and a matched-room message still silences correctly (no regression on line 509's legitimate zero-score silences) | Nyquist validation enabled; `tests/run-all-194.sh` is the scaffold precedent |

## Standard Stack

**No new external packages.** This phase is pure Node CJS editing shipped `lib/core/*.cjs` and
`scripts/*.cjs`, using only Node built-ins (`node:fs`, `node:crypto`, `node:sqlite`). This matches
the project convention (CLAUDE.md: "CJS only, no TypeScript; no Commander or yargs").

### Core (all already on disk - this phase composes them)
| Module | Purpose | Role in 225 |
|--------|---------|-------------|
| `scripts/intent-classifier.cjs` | The UserPromptSubmit tripwire | The one file that needs the zero-score gate (line 509 region) |
| `lib/workflow/session-binding-consumer.cjs` | `runBindingGate` - the session-scope decision | Reused; the zero-score path calls it or a sibling |
| `lib/hmi/shape-f8-renderer.cjs` | Renders the F.8 multi-select Decision Gate | Reused verbatim for the new gate |
| `lib/core/session-binding.cjs` | Global per-session binding file (bound SET, primary, sticky) | Read for `primary` in the "continue in primary" option |
| `lib/core/session-presence.cjs` | Per-room presence ledger + `hasCoSession` | Read by the doctor WAL check |
| `lib/core/room-db.cjs::openRoomDb` | Opens room.db with busy_timeout=5000 + WAL | Already hardened (218 D-05); no change needed |
| `scripts/doctor.cjs` | The diagnostic spine (Phase 217 registry-driven) | Gains the advisory SQLite-version check (REQ-4) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing the existing `emitBindingGate` for the zero-score case | A brand-new gate function | Reuse is correct for rendering, but the zero-score case needs DIFFERENT option composition (no arbitrary `best.name`), so expect a distinct small branch, not a full new renderer |
| A doctor SQLite-version check | Pinning/bundling a newer SQLite | Out of this phase's control - Node bundles SQLite; the honest move is detect + warn, not vendor a build |

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. All dependencies are Node built-ins
(`node:fs`, `node:crypto`, `node:sqlite`, `node:os`, `node:path`) and in-repo `lib/core/*.cjs`
modules that already ship. No npm/PyPI/crates install occurs, so there is no slopcheck surface.

## Architecture Patterns

### System Architecture Diagram (the zero-score gap, current vs required)

```
User message
   |
   v
intent-classifier.cjs (UserPromptSubmit tripwire)
   |
   v
score message against every room fingerprint  -> scored[], best = highest
   |
   v
line 509:  if (!best || best.score === 0) return 0;   <-- CURRENT: silent exit
   |                                                       (reframe matches nothing -> NO gate)
   |  (only reached when best.score > 0)
   v
line 511-548: F.8 binding gate
   - on-scope (bound member)      -> silence
   - off-scope / unbound + healthy -> emitBindingGate(best.name, scored)
   |
   v
downstream write -> resolveWriteRoom() -> Leg 2 session.primary -> OLD room
                    (the write the reframe should have questioned lands unchallenged)
```

The required change intercepts the zero-score case BEFORE the blanket `return 0`, and when the
session HAS a bound primary, fires a distinct "no room matched" Decision Gate instead of silence.

### Pattern 1: The zero-score case is semantically distinct from off-scope
**What:** When `best.score === 0`, no room fingerprint matched. `best.name` is whatever room was
first in the deduped corpus (because `if (!best || s.score > best.score)` never re-assigns on a
0 > 0 comparison). It carries zero signal.
**When to use:** The new gate must NOT present `best.name` as a candidate. It presents the session
`primary` (from `session-binding.cjs`) + a "new project" option + the `__no_room__` sentinel.
**Example (the causal chain, from live code):**
```javascript
// scripts/intent-classifier.cjs:504-509 (verified verbatim)
if (!best || s.score > best.score) {
  best = { name: roomName, score: s.score, nameMatch: s.nameMatch, entityMatches: s.entityMatches };
}
// ...
if (!best || best.score === 0) return 0;   // <- suppresses the gate on a total-miss reframe
```

### Pattern 2: Fail-open is the load-bearing contract
**What:** Every binding/presence primitive returns a safe default and NEVER throws into a hook.
`isRoomInWriteScope` fails OPEN (a false block is worse than a false allow). The tripwire degrades
to exit-0. The new zero-score gate MUST inherit this: a render/require fault returns 0 (silence),
never a hard-block.
**Source:** `session-binding.cjs:100-105`, `intent-classifier.cjs:531-548` (the existing gate's
fail-open fallthrough to the legacy advisory).

### Anti-Patterns to Avoid
- **Removing line 509 outright:** would let the existing off-scope gate fire on the meaningless
  `best.name`, presenting an arbitrary room. Wrong. Add a zero-score-specific branch instead.
- **Adding a second room resolver:** the SEED-034 "four guessers" lesson. `resolveWriteRoom` is
  the ONE write-target resolver; do not introduce another. 225 reads it, never forks it.
- **Making the WAL concern a code fix:** the WAL-reset corruption is upstream SQLite < 3.51.3.
  Code cannot fix it. Detect and warn only.
- **Per-turn doctor runs:** `runBindCheck` is bind-time only by design (it can smoke-test Brain);
  per-turn x N sessions thrashes. Keep the WAL check advisory and cheap (a version string compare).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering the Decision Gate | A new multi-select renderer | `lib/hmi/shape-f8-renderer.cjs::renderShapeF8` | Already shipped, Part 3 Shape F.8 compliant, AskUserQuestion trailer wired |
| Reading the session primary | Re-parsing the session JSON | `session-binding.cjs::readSessionBinding` | Path-traversal guarded, fail-safe default, atomic |
| Detecting a live co-session | A new pid/mtime sweep | `session-presence.cjs::hasCoSession` / `listLiveCoSessions` | Pid-liveness + 5m stale window already implemented |
| Lost-update reconcile | A new version-stamp scheme | `navigation/reconcile-guard.cjs::checkLostUpdate` | CAS via `last_modified_at`, wired through the chokepoint |
| Concurrent-write serialization | A file lock around room.db | `openRoomDb`'s busy_timeout=5000 (218 D-05) | node:sqlite serializes physical writes; WAL readers never block writers |
| Session-id resolution | A new id scheme | `intent-classifier.cjs::resolveSessionId` | Composed everywhere; env hint + sha256(roomDir+day) fallback |

**Key insight:** Phase 194 already paid the architecture cost. The failure mode of Phase 225 would
be re-implementing shipped primitives. The plan should be a surgical branch in one function plus
one advisory doctor check, not a subsystem.

## Runtime State Inventory

This phase edits resolution logic; it does not rename anything. But Phase 194 already writes runtime
state that 225's gate reads and that any test fixture must account for.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Global per-session binding files at `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json` (bound SET, primary, sticky) | Read-only for 225; the zero-score gate reads `primary`. No migration. |
| Stored data | Per-room presence ledgers at `<roomDir>/.mindrian/sessions/<sessionId>.json` (session_id, pid, bound_at) | Read-only for the doctor WAL check via `hasCoSession`. No migration. |
| Stored data | Decision traces at `<roomDir>/.mindrian/decision-traces/<sessionId>.json` | Unchanged; the tripwire already persists to it. |
| Stored data | Node CAS stamps: `last_modified_at` on room.db nodes (reconcile-guard) | Unchanged; already written on every node edit. |
| Live service config | None - no external service holds this string. Purely local filesystem + room.db. | None (Canon Part 8: zero Brain egress, verified). |
| OS-registered state | None - no OS scheduler/daemon registers session bindings. | None. |
| Secrets/env vars | `CLAUDE_SESSION_ID` (session-id hint), `MINDRIAN_ROOMS_HOME` (rooms root). Read-only. | None; a missing `CLAUDE_SESSION_ID` degrades to the per-room-per-day sha256 fallback. |
| Build artifacts | None affected. | None. |

**The canonical question answered:** After 225's edits, what runtime state still carries stale
resolution? Nothing new - 225 changes WHEN a gate fires, not WHERE data lands. The only durable
side-effect of the new gate is a fresh binding write (the user's choice), which uses the shipped
`writeSessionBinding` atomic path.

## Common Pitfalls

### Pitfall 1: Presenting the arbitrary `best.name` on a zero-score match
**What goes wrong:** A naive fix removes line 509 and lets the existing gate fire on `best.name`.
On `best.score === 0`, `best.name` is the first room in the deduped corpus, not a real match.
The user gets asked "is this the `<random-room>` project?" - confusing and wrong.
**Why it happens:** `best` is assigned on the first `!best` iteration and only replaced when
`s.score > best.score`; `0 > 0` is false, so it sticks at corpus[0].
**How to avoid:** Branch on the zero-score case explicitly. Its candidates are `session.primary`
(if bound), a "new project" option, and `__no_room__` - never `best.name`.
**Warning signs:** A test where a reframe message surfaces a room whose fingerprint scored 0.

### Pitfall 2: Conflating the two Phase-218 SQLite concurrency issues
**What goes wrong:** Treating "the WAL finding" as one thing and trying to code-fix it.
**Why it happens:** The STATE.md and commit 298a1c84 describe TWO distinct subsystems at the same
room.db: (a) SQLITE_BUSY lock contention between the extraction worker and live conversation -
ALREADY FIXED by 218 D-05 (`busy_timeout: 5000` + `synchronous = NORMAL` on `openRoomDb`); and
(b) the WAL-reset checkpoint corruption race in upstream SQLite 3.7.0-3.51.2, fixed in 3.51.3 -
which D-05 "neither causes nor fixes" (commit 298a1c84 verbatim).
**How to avoid:** For 225, (a) is done - do not touch it. (b) is code-unfixable; the only correct
action is an advisory doctor check: warn when bundled SQLite < 3.51.3 AND a co-session is live.
**Warning signs:** A plan task that proposes new locking logic around room.db writes.

### Pitfall 3: Breaking the never-block contract (83-07)
**What goes wrong:** The new gate hard-blocks a turn on a render fault.
**Why it happens:** The tripwire is a hook; a thrown error or non-zero exit can interrupt the user.
**How to avoid:** Mirror the existing gate's fail-open fallthrough (531-548): wrap in try/catch,
return 0 on any fault, degrade to silence. The whole binding subsystem is fail-open by design.
**Warning signs:** A test that asserts a non-zero exit code from the tripwire.

### Pitfall 4: The per-room-per-day session-id collision in CLI tests
**What goes wrong:** Without `CLAUDE_SESSION_ID`, `resolveSessionId` hashes `roomDir + ISO-day`, so
two "sessions" in the same room on the same day share one binding file. A test that expects
isolated sessions on one day in one room will see cross-talk.
**Why it happens:** `resolveSessionId` fallback (intent-classifier.cjs:805-818), acceptable per
the 194 plan but a real test hazard.
**How to avoid:** Set `CLAUDE_SESSION_ID` explicitly in fixtures that need distinct sessions.

## Code Examples

### The zero-score gate branch (shape, not literal - planner refines)
```javascript
// scripts/intent-classifier.cjs, replacing the blanket line-509 return
if (!best || best.score === 0) {
  // No room fingerprint matched. If the session has a bound primary, this may be a
  // reframe / new-project signal (SEED-039 proving_case_2). Offer a distinct gate.
  try {
    const roomDir = resolveActiveRoomDir();
    const sessionId = resolveSessionId(roomDir);
    const binding = require('../lib/core/session-binding.cjs')
      .readSessionBinding(sessionId, { home: root });
    if (binding && binding.primary) {
      // Fire a "no room matched" F.8 gate: new project | continue in <primary> | no room.
      // Fails open: any fault returns 0 (silence), preserving the 83-07 contract.
      if (emitNoMatchGate({ primary: binding.primary, roomDir, sessionId })) return 0;
    }
  } catch (_e) { /* fail-open */ }
  return 0;  // unbound session, or gate unavailable -> legacy silence
}
```

### The doctor WAL advisory check (shape)
```javascript
// scripts/doctor.cjs - a cheap, advisory, LOCAL check
const { DatabaseSync } = require('node:sqlite');
const v = new DatabaseSync(':memory:').prepare('select sqlite_version() as v').get().v;
// semver-compare v < '3.51.3' AND session-presence.hasCoSession(...) for any active room
// -> WARN row (never a block): "SQLite <v> in the WAL-reset window; live co-sessions present"
```

## State of the Art

| Old (SEED-039 as filed, 2026-06-29) | Current (post-Phase-194, 2026-07-01) | When Changed | Impact on 225 |
|-------------------------------------|--------------------------------------|--------------|---------------|
| Four pillars unbuilt | All four pillars shipped | Phase 194 | 225 is gap-closure, not a build |
| Single global mutable `reg.active` race | `resolveWriteRoom` session-aware precedence (room-root -> session.primary -> demoted reg.active) | Phase 194-03 | The cross-session race (Pillar 1/4) is closed |
| Advisory-nag tripwire | F.8 Decision Gate (except the zero-score hole) | Phase 194-04 | Only the zero-score edge remains |
| Fragmented resolvers | Converged on `room-root.cjs::resolveRoomRoot()` | Phase 127.3 / 169-02 / 194 | The "resolver-fragmentation" premise is stale |
| SQLITE_BUSY 0ms hard-fail | busy_timeout=5000 + synchronous=NORMAL | Phase 218 D-05 | Physical write contention handled |

**Deprecated/outdated in the seed text:**
- The seed's "the primitive is wrong" framing and Pillars 1/3/4 as future work: mostly SHIPPED.
  Treat the seed as historical context, not a build spec. The roadmap correction supersedes it.
- SEED-039's `related` link to SEED-034 as a "shared resolver-fragmentation site": stale post-194.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The correct fix for the zero-score gate is to offer new-project / continue-in-primary / no-room (Pillar 2's exact shape), not auto-create a room | Requirements / Code Examples | Low - matches proving_case_2 and Jonathan's live diagnosis verbatim; but the exact option set + default is a spec-phase decision |
| A2 | The WAL-reset concern warrants only a doctor advisory, not a code change | REQ-4 / Pitfall 2 | Low - commit 298a1c84 states D-05 cannot fix it and it is upstream; but the navigator may want the extraction worker to additionally respect `hasCoSession` before checkpointing |
| A3 | Phase 224 will not edit `intent-classifier.cjs` before or during 225 | Verification Log | Low - confirmed against all current 224 plan `files:` blocks, but 224 is mid-flight (1/4 plans); re-grep at 225 plan-time |
| A4 | No CONTEXT.md exists for 225 yet, so there are no locked user decisions to honor | User Constraints | Low - phase dir holds only `.gitkeep`; run `/gsd-discuss-phase 225` first if locked decisions are wanted before planning |

## Open Questions

1. **Should the zero-score gate default to "continue in primary" (sticky) or force a choice?**
   - What we know: The seed's open-fork #1 leans "primary-as-default with one-key reassign." The
     sticky flag already exists in `session-binding.cjs`.
   - What's unclear: Whether the reframe case should re-prompt even when sticky is set (a sticky
     session explicitly asked not to be re-prompted).
   - Recommendation: Resolve at spec/discuss. Leaning: honor sticky for OFF-scope re-prompts, but
     a TOTAL-miss (zero-score) is a strong-enough new-project signal to prompt once even under
     sticky, then set the new choice sticky.

2. **Does the extraction worker (Phase 218) need to check `hasCoSession` before a WAL checkpoint?**
   - What we know: The WAL-reset race needs 2+ connections writing/checkpointing simultaneously.
   - What's unclear: Whether a cheap "skip checkpoint if a co-session is live" guard is worth it,
     or whether the doctor warning + eventual SQLite 3.51.3 is sufficient.
   - Recommendation: Start with the doctor advisory only (REQ-4). Add the worker guard only if the
     navigator wants belt-and-suspenders; it is a small, isolated addition to the drain worker.

3. **Requirement numbering:** ROADMAP says Requirements TBD with no global REQ-XX ids. Confirm at
   spec whether 225 uses local reqs (like 224) or maps to global REQUIREMENTS.md ids.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | >=22.5.0 (project floor) | - |
| `node:sqlite` (`DatabaseSync`) | room.db reads, WAL check | Yes | Bundled SQLite 3.51.2 (verified via commit 298a1c84) | The WAL check itself degrades to advisory if absent |
| `shape-f8-renderer.cjs` | The F.8 gate | Yes (shipped Phase 194) | - | Gate degrades to legacy silence (fail-open) |

**Missing dependencies with no fallback:** None.
**Note:** Bundled SQLite 3.51.2 IS in the WAL-reset-affected range (3.7.0-3.51.2). This is the
condition REQ-4's advisory detects; it is not a blocker for the phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in assert + bash aggregator (`tests/run-all-<phase>.sh`), the repo convention |
| Config file | none - each `tests/test-*.cjs` is self-running; `lib/memory/run-feynman-tests.cjs` registers them |
| Quick run command | `node tests/test-225-<name>.cjs` |
| Full suite command | `bash tests/run-all-225.sh` (to be created, scaffolded on `tests/run-all-194.sh`) |

### Phase Requirements -> Test Map
| Rec ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-1 | A zero-score reframe with a bound primary fires the gate | integration | `node tests/test-225-zero-score-gate.cjs` | Wave 0 |
| REQ-2 | The gate offers primary/new/no-room, never the arbitrary `best.name` | unit | `node tests/test-225-zero-score-gate.cjs` | Wave 0 |
| REQ-3 | A render fault degrades to exit-0 silence (never-block) | unit | `node tests/test-225-gate-degrade.cjs` | Wave 0 |
| REQ-4 | doctor warns on SQLite < 3.51.3 + live co-session; no warn otherwise | unit | `node tests/test-225-wal-advisory.cjs` | Wave 0 |
| REQ-6 | A matched-room message still silences (no regression on legitimate zero-score silences, e.g. unbound session) | integration | `bash tests/run-all-225.sh` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-225-<the-file-just-touched>.cjs`
- **Per wave merge:** `bash tests/run-all-225.sh` plus `bash tests/run-all-194.sh` (regression guard on the shipped substrate)
- **Phase gate:** full 225 suite green + `run-all-194.sh` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test-225-zero-score-gate.cjs` - covers REQ-1, REQ-2 (needs a fixture room set where the reframe message scores 0 against all fingerprints)
- [ ] `tests/test-225-gate-degrade.cjs` - covers REQ-3 (renderer-absent -> exit-0)
- [ ] `tests/test-225-wal-advisory.cjs` - covers REQ-4 (mock SQLite version + presence)
- [ ] `tests/run-all-225.sh` - phase aggregator on the run-all-194.sh scaffold
- [ ] Register the above in `lib/memory/run-feynman-tests.cjs`
- Existing infra reused: `tests/run-all-194.sh`, `tests/test-session-binding-*.cjs`, `tests/test-binding-gate-degrade.test.cjs` (the degrade-pattern precedent)

## Security Domain

Internal developer tooling; no auth/session-management/network surface. Canon Part 8 (zero Brain
egress) is the governing constraint and is already enforced by source-grep tripwires.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface |
| V3 Session Management | no | "Session" here is a local CLI session id, not an auth session |
| V4 Access Control | no | Local filesystem only |
| V5 Input Validation | yes | Session-id / room-slug path-traversal guard (`isSafeSlug`, already shipped in session-binding.cjs:45-53 and session-presence.cjs:40-44) - any new file path derived from a slug MUST route through it |
| V6 Cryptography | no | `sha256` used only as a non-security session-id hash; not a security control |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a crafted session-id / room slug used as a filename | Tampering | `isSafeSlug` reject on `..` before any filename use (already shipped; reuse it, do not re-derive) |
| A poisoned/corrupt binding file crashing the tripwire hook | Denial of Service | try/catch -> safe default; never throw into a hook (the fail-open contract, already shipped) |
| Brain egress of user room content via the gate | Information Disclosure | Canon Part 8 source-grep tripwires (rar.11/rar.12) + the local-only floor grep; the gate carries room slugs only, never prompt content |

## Sources

### Primary (HIGH confidence) - read directly this session
- `scripts/intent-classifier.cjs` lines 160-175, 230-330, 440-578, 805-845, 2095-2160 (tripwire, scoring, the line-509 gate, session-id, emitBindingGate)
- `lib/core/resolve-active-room.cjs` (full - resolveWriteRoom / resolveSessionScope convergence)
- `lib/core/room-root.cjs` (full - the converged resolveRoomRoot)
- `lib/core/session-binding.cjs` (full - Pillar 1 + Pillar 3)
- `lib/core/session-presence.cjs` (full - Pillar 4 substrate + runBindCheck spine)
- `lib/core/navigation.cjs` lines 45, 230-236 (reconcile-guard wiring - Pillar 4)
- `.planning/phases/194-per-session-room-binding/` (deferred-items.md + plan/summary set - proves the four pillars shipped)
- `.planning/phases/224-*/*-PLAN.md` (all `files:` blocks - disjointness proof)
- `.planning/debug/interns-round-eureka-david-session-2026-07-14.md` (the EXIT:1 = scripts/resolve-room finding)
- Git commit `298a1c84` (the SQLite WAL-reset finding, primary-source-verified against sqlite.org)
- `.planning/ROADMAP.md` lines 3209-3320 (Phase 224/225 entries + the 2026-07-15 corrections)
- `.planning/seeds/SEED-039-*.md` (full - the originating four-pillar design + both proving cases)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` (Phase 218 close-out narrative: D-05 busy_timeout, the WAL watch item)

### Tertiary (LOW confidence)
- None. Every claim in this research was verified against source or a primary-source-checked commit.

## Metadata

**Confidence breakdown:**
- Scope determination (2 narrow gaps, not a 4-pillar build): HIGH - all four pillars read in live code
- Line-509 zero-score gap: HIGH - traced verbatim, causal chain confirmed
- Phase 194 convergence / resolver settled: HIGH - resolveWriteRoom Leg 1 read directly
- Phase 218 WAL characterization: HIGH - commit message + STATE.md + D-05 code all cross-checked
- 224 disjointness: HIGH - all 224 plan files:blocks grepped; zero overlap
- Debug-file EXIT:1 attribution: HIGH - it is scripts/resolve-room (registration), not any 225 resolver

**Research date:** 2026-07-15
**Valid until:** 2026-07-22 (7 days - Phase 224 is mid-flight; re-grep 224's touched files at 225 plan-time per A3)

**Dev-research compositing reminder (CLAUDE.md):** This phase touches MindrianOS's own
architecture, so per the compositing rule the durable reasoning trail should also land in
`~/MindrianRooms/rethinking-mindrianos/research/` and mirror to `mindrianOS/research/`,
cross-linked to this RESEARCH.md. That is an execution/filing step, not a research blocker.
