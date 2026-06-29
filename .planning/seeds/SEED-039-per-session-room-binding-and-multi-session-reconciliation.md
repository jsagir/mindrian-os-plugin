---
kind: seed
status: open
created: 2026-06-29
canon_parts: [3, 6, 8, 9, 11]
severity: HIGH
related: [SEED-034 (graph-derivation-harness -- documents the WRITE-INDEX resolver disagreement; this seed is its session-concurrency sibling), SEED-037 (doctor-retrofit -- doctor is the verification spine reused here), Phase 83-06 (write-time scope guard), Phase 83-07 (mid-session intent classifier / the advisory tripwire), Phase 127.3 (resolve-active-room.cjs canonical single-source), Phase 169-02 (room-root.cjs walk-up resolver)]
proving_case: this very design session, 2026-06-29 -- the global registry active room flipped motj-ecosystem -> gix-intelligence between conversational turns with no user switch, demonstrating the single-global-active-room race live in the session designing its fix
source: navigator field observation 2026-06-29 (parallel sessions, one mutable active-room field)
absorbs: nothing (extends SEED-034 root-cause #1 into the session dimension)
---

# SEED: Per-Session Room Binding and Multi-Session Reconciliation

## The blunt diagnosis (the primitive is wrong, not the config)
"Active room" is stored as a SINGLE GLOBAL mutable string -- `reg.active` in
`$MINDRIAN_ROOMS_HOME/.rooms/registry.json` (`scripts/room-registry` set-active / get-active;
read by `scripts/intent-classifier.cjs:81-83` activeRoomFromRegistry and consolidated in
`lib/core/resolve-active-room.cjs`, Phase 127.3). One global field assumes one session, one
room, serially. The navigator runs N sessions on N rooms in parallel. A single mutable field
shared across parallel sessions is a RACE BY CONSTRUCTION. Setting it directly only wins the
race for one terminal until the next session clobbers it.

Live proof (this session): the active room flipped `motj-ecosystem` -> `gix-intelligence`
between turns with no user switch. The bug demonstrated itself inside the session designing
the fix.

## The seam: two subsystems, two models of "what room am I in"
1. **Write-indexing already abandoned the global field.** `lib/core/room-root.cjs` walks UP
   from the file to its `.room-root` sentinel and indexes there "regardless of the registry
   active room (root cause #1)" -- LOCATION-derived. (This is exactly SEED-034 root-cause #1.)
2. **The guards still trust the global field.** The advisory tripwire (`intent-classifier.cjs`,
   Phase 83-07, "Advisory only. Never blocks.") and the write-time block (Phase 83-06) both
   compare against `reg.active`. So one subsystem derives room from location and two derive it
   from a global race. The navigator feels the seam as spurious mismatch warnings and false
   write-blocks (e.g. editing the plugin's OWN CLAUDE.md, which is the NO-ROOM case the binary
   registry cannot even express).

## What ships today that this rides on (Part 7 reuse, mostly composition)
- **Session identity already exists.** `intent-classifier.cjs:364` resolveSessionId(); per-session
  files already written to `<room>/.mindrian/decision-traces/<session>.json:322`.
- **One canonical resolver.** `resolve-active-room.cjs` is the single reader -- session logic lands
  in ONE file and both guards inherit it.
- **One write chokepoint.** `lib/core/navigation.cjs` (Part 9) is the single SQL path for every typed
  edge and memory_event -- reconciliation has exactly one place to live.
- **The reconcile verbs already exist.** The cascade APPROVE / REJECT / DEFER (Part 3) and the
  CONTRADICTS edge (Part 9 frozen vocabulary) ARE the conflict-resolution primitives.
- **The drift detector already exists.** `scripts/doctor.cjs` already checks `.room-root` sentinel
  gaps and "active-room guard silence" -- it gains a concurrency job, not a rewrite (SEED-037 sibling).
- **The stale-reaper pattern already exists.** The worktree orphan-sweep (lock-owner dead + mtime > 5m)
  is the template for reaping dead session presence.

## The four pillars

### Pillar 1 -- Per-session room binding (a SET, with a primary)
New per-session file `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json`:
```json
{
  "bound": ["align-ecosystem", "motj-ecosystem"],
  "primary": "align-ecosystem",
  "sticky": true,
  "updated": "<iso8601>"
}
```
A session can SPAN rooms (navigator-confirmed: cross-room synthesis is a real workflow), so `bound`
is a set. `primary` is the default WRITE target so non-located writes stay unambiguous. `sticky`
suppresses re-prompting for the life of the session.

Resolution precedence in `resolve-active-room.cjs` (session-aware):
- **For writes:** `.room-root` walk-up (a file inside a room files there -- already true) ->
  `session.primary` -> global `reg.active` (DEMOTED to a seed-default for fresh sessions).
- **For the tripwire on-scope test:** on-scope iff top-scoring room is a member of `session.bound`.

### Pillar 2 -- The tripwire graduates from advisory-nag to an F.7 multi-select Decision Gate
`intent-classifier.cjs` stops merely warning. It fires a Shape F (Part 3) multi-select gate when:
the session is UNBOUND, or the top-scoring room is OUTSIDE `bound`. The gate controls:
- multi-select rooms (PLUS a "dev repo / no room" option -- this is what fixes the spurious
  CLAUDE.md block);
- single-select "primary write target" among the chosen;
- a sticky "remember for this session, stop asking" toggle.
The gate WRITES the binding. Fail-safe: a hook error never hard-blocks; the gate is conversational
and degrades to exit-0 (preserve the 83-07 never-block contract).

### Pillar 3 -- The write-guard becomes set-membership, not single-equality
Phase 83-06 blocks only when the resolved write room is NOT a member of `session.bound` (and is
not the dev-repo / no-room case). The false block on no-room writes disappears.

### Pillar 4 -- Graph reconciliation for N sessions in 1 room (the inverse case)
Binding does not help when two sessions are both ALLOWED into the same room and both mutate its
`room.db`. Reconciliation lives at the `navigation.cjs` chokepoint:
- **Appends reconcile for free.** New edges and memory_event nodes never truly conflict; SQLite WAL +
  busy_timeout serializes the physical write; each row is stamped with `session_id` (already resolved).
- **The real conflict is the lost update.** Two sessions edit the SAME node (a section governing
  thought, a STATE.md field, an assumption validity). Stamp each node with a version / last-writer.
  When a write targets a node whose version moved since the session read it, navigation.cjs does NOT
  overwrite -- it raises a RECONCILE EVENT.
- **The reconcile event reuses the cascade verbs.** "Session X changed this node while you held it:
  APPROVE (yours wins) / REJECT (keep theirs) / DEFER (keep both as CONTRADICTS-linked competing
  claims)." DEFER turns a clobber into graph history -- rejection-is-data (Decision 13). Nothing lost.

### The spine that threads all four -- the per-room presence ledger + doctor
New `<room>/.mindrian/sessions/` ledger: who is currently bound and live in this room.
- **doctor runs at bind-time, once against EACH newly-bound room** (the F.7 gate triggers it). It
  (a) verifies each room is structurally healthy BEFORE this session mutates it, and (b) registers
  this session in that room's presence ledger.
- **doctor does NOT run per-turn** (it smoke-tests Brain end-to-end; per-turn x N sessions would
  thrash). Cadence: bind-time + on reconcile events.
- The presence ledger is what Pillar 4 READS: navigation.cjs checks "is another live session bound
  here?" -- if none, FAST PATH, no version-check, no gate (keeps the common single-session case
  zero-friction). If yes, the version-check / reconcile gate arms.
- Session presence is cleared on session end, or stale-reaped on the worktree-orphan pattern.

## Open forks (resolve in planning, do not pre-decide here)
1. **Write-disambiguation** when a non-located write happens in a multi-room session:
   (a) primary-as-default with one-key reassign [leaning], vs (b) prompt-on-ambiguous single-select.
2. **Reconcile-default** on a detected lost-update:
   (a) auto-DEFER to competing CONTRADICTS claims [leaning -- never lose data], vs (b) prompt APPROVE/REJECT/DEFER.
3. **Presence teardown:** doctor-on-session-end (clean) vs stale-reap-only (robust to crashes). Likely both.

## Canon alignment
- **Part 3:** the F.7 binding gate and the reconcile event ARE Decision Gates (APPROVE/REJECT/DEFER, Shape F).
- **Part 6:** the plugin's own multi-room dev work must honor this; the no-room/dev-repo case is first-class.
- **Part 8:** entirely LOCAL -- session files, presence ledgers, node version stamps are local filesystem +
  room.db. ZERO Brain egress; the binding and reconciliation carry no user content to the Brain.
- **Part 9:** all graph writes stay on the navigation.cjs chokepoint; reconciled edges land `proposed`,
  a human confirms (DEFER becomes a competing-claim node, the "why not" captured).
- **Part 11 (CIRS):** the F.7 binding gate is a new invocable surface -- it must be born WIRED (R1/R2),
  resolved through the one governed path, not a second selection brain.

## Why now
- The single-global-active-room race is observable in the field (this session) and produces both
  spurious mismatch warnings and false write-blocks today.
- Every pillar is composition over shipped substrate: session-id, decision-traces store, the one
  canonical resolver, the navigation.cjs chokepoint, the cascade verbs, doctor, the orphan-sweep.
- SEED-034 already fixed the WRITE-INDEX resolver disagreement (root-cause #1) but left the GUARD
  and SESSION dimensions open; this seed closes them. Sequencing: canon leads (this SEED), code follows.
