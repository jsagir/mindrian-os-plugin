---
phase: 240.1-context-layer-drift-detection
created: 2026-07-30
updated: 2026-07-30
purpose: >
  The phase-wide residual register. Every item this phase found and
  deliberately did not fix, with its citation, its evidence, its reason for
  staying open, and what closing it would take. Item 1 is the single most
  important entry in this file: it states plainly that this phase does NOT
  fix the `.planning/STATE.md` symptom that motivated it.
---

# Phase 240.1 (Context-Layer Drift Detection) - Deferred Items (residual register)

Eight items, per the plan's own must-have list. Every item carries what it
is, why it was out of scope, the evidence, and what would have to be true to
pick it up. Cross-link: the durable reasoning trail for this phase lives in
the `rethinking-mindrianos` Data Room at
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-30-context-layer-drift-detection/`,
cross-linked in both directions with this file and with the
`2026-07-30-motherduck-context-layer` entry, per the CLAUDE.md Dev-Research
Compositing mandate.

## Item 1: `.planning/STATE.md`'s own drift is NOT fixed by this phase

**This is the most important item in this register. State it plainly: the
symptom that motivated Phase 240.1 -- a `stopped_at` versus Current Position
self-contradiction, observed while two concurrent GSD sessions were writing
`.planning/STATE.md` -- lives in `.planning/STATE.md`, and that file's
generation is owned by `gsd-core`, a separately versioned tool installed at
`~/.claude/gsd-core/`, which this repo does not track in its own git history.
Nothing this phase shipped changes a single byte of `~/.claude/gsd-core`.**

**Two RCAs already exist for this symptom class and both concluded the fix
does not belong in this repo. Quoted verbatim:**

- `.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md`,
  `Required Code Changes` section (lines 219-226):

  > "None in this repo. If pursued, the fix belongs in `~/.claude/gsd-core`
  > (an external tool), not in `/home/jsagi/MindrianOS-Plugin`. No
  > MindrianOS-Plugin source, script, or doc requires a change to work around
  > this -- the manual frontmatter restoration applied twice this session is
  > a complete, low-cost workaround at the point of use."

- `.planning/debug/gsd-phase-complete-cross-phase-corruption.md`, its
  Technical Root Cause section (lines 170-177):

  > "Not filed -- root cause unconfirmed, and the tool lives outside this
  > repo (`~/.claude/gsd-core/`, not `/home/jsagi/MindrianOS-Plugin`). A
  > future session investigating this should start in
  > `~/.claude/gsd-core/bin/lib/roadmap.cjs`'s checkbox-mutation function and
  > `lib/state.cjs`'s frontmatter-field writer, using this file's
  > reproduction steps against a scratch copy of this repo's
  > ROADMAP.md/STATE.md as fixtures."

**The traced upstream mechanism, so the trail is not lost.** Read live
against the installed tool at `~/.claude/gsd-core/bin/lib/state.cjs`
(compiled output, not source-of-record, but the artifact that actually
runs):

- `writeStateMd` (`state.cjs:1085-1098`) calls `syncStateFrontmatter` (the
  disk-scan-derived frontmatter build) BEFORE `acquireStateLock` is taken:

  ```
  state.cjs:1091   const synced = syncStateFrontmatter(content, cwd);   // disk scan, OUTSIDE the lock
  state.cjs:1092   const lockPath = acquireStateLock(statePath, clock); // lock acquired AFTER
  ```

  Two concurrent sessions can each derive frontmatter from the same
  pre-write disk state and then serialize their writes, producing exactly
  the self-contradicting frontmatter this phase's motivating symptom
  described. The lock exists and is held across the write itself; it is
  simply acquired too late to prevent the read-side race.

- `gsd_state_version` already exists in `.planning/STATE.md`'s frontmatter
  and is completely inert. It is hardcoded on every regeneration:

  ```
  state.cjs:918   const fm = { gsd_state_version: '1.0' };
  ```

  and preserved at exactly one call site, the milestone-switch path:

  ```
  state.cjs:1485  gsd_state_version: existingFm['gsd_state_version'] || '1.0',
  ```

  Every other regeneration path overwrites it with the same hardcoded
  literal rather than reading the on-disk value, so the stamp cannot today
  detect or notify on a schema mismatch in `.planning/STATE.md` even though
  the field is present.

**What this phase did instead, per locked decision D-01.** CTXL-01 was
retargeted at planning time to the **per-room** `STATE.md` (the file
`scripts/compute-state` generates per `~/MindrianRooms/<room>/STATE.md`),
which is genuinely in-repo, genuinely fixable, and was proven broken this
session (`scripts/compute-state` blind-overwrote the room's `STATE.md` and
destroyed the `gsd_state_version` stamp `scripts/room-registry` seeds at room
birth). Plans 240.1-02 and 240.1-03 built `lib/core/state-version.cjs`'s
preserve-or-notify contract and wired it into all six per-room write sites
(see the write-site census reproduced in Item 2's sibling context below).
`.planning/STATE.md` was never a target of any 240.1-0[1-7] plan's
`files_modified` list.

**Any future fix belongs upstream, in `~/.claude/gsd-core`, not in this
repo.** A future session should start exactly where the second RCA points:
`~/.claude/gsd-core/bin/lib/roadmap.cjs`'s checkbox-mutation function and
`state.cjs`'s frontmatter-field writer, moving the `syncStateFrontmatter`
call to run AFTER `acquireStateLock`, and wiring `gsd_state_version` to be
read from disk rather than hardcoded.

## Item 2: `room-birth.cjs:986-990` invokes a bash script with `node`, and has therefore never once succeeded

`lib/core/navigation/room-birth.cjs:986-990` (STEP 3 of room birth) spawns
`scripts/compute-state` via `execSync('node ' + computeStateScript + ...)`.
`scripts/compute-state` is a bash script (`#!/usr/bin/env bash` at line 1),
so every invocation raises a `SyntaxError` the instant Node tries to parse
the bash comment on line 2. Reproduced live this session:

```
$ node scripts/compute-state /tmp
scripts/compute-state:2
# compute-state: Scan room/ directory and output STATE.md content
^
SyntaxError: Invalid or unexpected token
```

The call is wrapped in a bare `catch (_e)` with a "Tolerate" comment
(`room-birth.cjs:991-994`), so room birth's STEP 3 compute-state has never
once succeeded, and fails completely silently -- no log line, no
notification, no user-visible signal. This is filed as its own RCA by Task 2
of this plan: `.planning/debug/room-birth-compute-state-node-on-bash.md`.

**Not fixed here.** Folding an unrelated production fix into this phase
would blur its own mutation proofs (`240.1-RESEARCH.md` Open Question 4's
explicit recommendation, followed). `lib/core/navigation/room-birth.cjs`
itself is untouched by every commit in this phase (`git diff
lib/core/navigation/room-birth.cjs` against the phase's base commit is
empty).

**Classification.** This is an instance of the standing silent-skip and
false-success watch item this repo already tracks
(`feedback_false_success_silent_skip_gates_academy_testers` in personal
memory) -- a mechanism that reports success (or, here, simply never surfaces
its failure) while doing nothing.

## Item 3: `docs/MWP-SPECIFICATION.md`'s `## 3. The 9 KuzuDB Edge Types` heading is itself a stale-KuzuDB claim

The heading at `docs/MWP-SPECIFICATION.md:388` still reads `## 3. The 9
KuzuDB Edge Types`, directly contradicted by the file's own correction
banner at line 3:

> "CORRECTION (2026-06-14, KuzuDB-drift sweep): the local per-room graph is
> SQLite (`room/.room-graph/room.db`), NOT KuzuDB. ... Canonical rule: local
> graph is SQLite (do not reintroduce KuzuDB as a current claim)."

The body still carries 12 total mentions of "KuzuDB" (measured live this
session via `grep -c`), all below that same banner. Plan 240.1-04 inserted
its new `## 2.8 Semantic Layer vs Context Layer` section immediately before
this heading, deliberately without renaming it (that plan's Resolution 2,
recorded in `240.1-04-SUMMARY.md`): renaming the heading in the same plan
would have made that plan's own mutation proof ambiguous (was the gate
reddening on the missing 2.8 section, or on the heading rename?).

**`scripts/check-kuzu-reintroduction.cjs` cannot catch this.** Its own
source states the exclusion explicitly:

```
scripts/check-kuzu-reintroduction.cjs:37   *   - every .md file in docs/, references/ and pipelines/, which is excluded
scripts/check-kuzu-reintroduction.cjs:80   // Only three code extensions are ever read, so every .md file is excluded
scripts/check-kuzu-reintroduction.cjs:82   const SCAN_EXTENSIONS = new Set(['.cjs', '.js', '.mjs']);
```

So the machine gate that would normally catch a KuzuDB reintroduction is
structurally blind to this exact heading. Only `240.1-04`'s new
doctrine-presence gate (`tests/test-240.1-layer-doctrine-presence.cjs`)
polices KuzuDB language in this file, and it is scoped to the NEW section it
introduced, not to this pre-existing heading.

**What closing it would take:** a doc-hygiene-only task renaming `## 3. The
9 KuzuDB Edge Types` to its SQLite-accurate name and sweeping the remaining
11 body mentions, run as its own change (not folded into a CTXL-02 mutation
proof), with its own before/after diff review.

## Item 4: `lib/core/opportunity-ops.cjs` writes a different `STATE.md`, out of scope by design

`lib/core/opportunity-ops.cjs:1020` and `:1109` each write a `STATE.md` for
a fund sub-directory and an opportunity-bank sub-directory respectively
(`fs.writeFileSync(path.join(fundDir, 'STATE.md'), ...)` and
`fs.writeFileSync(path.join(oppDir, 'STATE.md'), ...)`). This is a different
artifact shape from the room-root `STATE.md` that `scripts/compute-state`
generates: it is a hand-rolled markdown body assembled from fund/opportunity
aggregate stats (stage counts, deadlines, top-relevance items), not the
compute-state-rendered frontmatter+body this phase's CTXL-01 targets.

Declared out of scope by plan 240.1-03's Resolution 4. Confirmed untouched
this session: `git diff lib/core/opportunity-ops.cjs` against the phase's
base commit is empty.

**What closing it would take:** a separate, explicit decision on whether
these sub-directory `STATE.md` files should also carry a version stamp,
made as its own requirement (not folded silently into CTXL-01, which the
ROADMAP and REQUIREMENTS text both scope to the room-root artifact).

## Item 5: existing rooms on disk carry no version stamp, and no backfill was run

Per `240.1-RESEARCH.md` Open Question 2, the chosen policy is treat-absent-
as-legacy: `lib/core/state-version.cjs`'s preserve-or-notify contract treats
a `STATE.md` with no version key as legacy v1 and stamps it forward on its
next natural regeneration (the same shape `lib/core/install-state.cjs`
already uses for its own schema migration). This is idempotent by
construction -- every room already regenerates its `STATE.md` on the next
`session-start`, `on-stop`, `on-task-complete`, `on-agent-complete`, cascade
Step 8, or `computeState()` call, whichever comes first -- so it needs no
migration script and no bulk-backfill pass.

**No bulk backfill was run, and none is needed.** Rooms under
`~/MindrianRooms/` that predate this phase will pick up the stamp
organically the next time any of the six write sites regenerates their
`STATE.md`, which per the observed write-site frequency (every session-stop,
every task-complete, every agent-complete) is expected within the room's
next active session, not on any fixed schedule this phase needed to force.

## Item 6: `room-skeleton-scaffold.cjs`'s templated `STATE.md.tmpl` carries no version stamp, reviewed, no change needed

`lib/core/room-skeleton-scaffold.cjs:300-310` writes
`templates/room-skeleton/STATE.md.tmpl` when scaffolding a new room, and
that template carries no version stamp of its own. Reviewed this session and
confirmed no change is needed:

- `isStateAuthored` (`room-skeleton-scaffold.cjs:120-136`) returns `true` for
  any frontmatter that either has `auto_created: false` OR lacks the
  `auto_created` key entirely -- so a registry-seeded room (whose `STATE.md`
  carries `gsd_state_version: 1.0` / `status: active` and no `auto_created`
  key at all, per `scripts/room-registry:127-131`) is treated as
  human-authored and is NEVER clobbered by the scaffold's own template
  write.
- A scaffold-born room (one that genuinely goes through
  `scaffoldRoomSkeleton` with no prior `STATE.md`) writes the unstamped
  template, but that room is then stamped forward on its first natural
  `computeState()` regeneration, per Item 5's legacy-forward policy -- the
  same idempotent path, no special-case needed.

Recorded here so the write-site census this phase produced is complete: this
is a seventh STATE.md-adjacent writer, reviewed, confirmed no-change.

## Item 7: `CHANGELOG.md:806` still carries the false "single Node chokepoint" claim

`CHANGELOG.md:806` states, describing an earlier fix:

> "`state-ops.cjs::computeState()` now persists at the single Node
> chokepoint, mirroring the pattern already correct in `scripts/on-stop` /
> `on-task-complete` / `on-agent-complete`."

`240.1-RESEARCH.md` Finding 1C measured this claim and found it false: five
other sites bypass `state-ops.cjs::computeState()` entirely (the
`intelligence-cascade.cjs` Step 8 cascade path, and the three bash hook
scripts `on-stop`/`on-task-complete`/`on-agent-complete`, plus the broken
`room-birth.cjs` STEP 3 invocation named in Item 2). Plan 240.1-02 corrected
the equivalent false claim inside `lib/core/state-ops.cjs`'s own doc comment
in the same edit that fixed the code (per that plan's own acceptance
criteria).

**Historical changelog entries are not rewritten.** `CHANGELOG.md` is an
append-only historical record of what shipped and when; amending a past
entry to match a later-discovered correction would misrepresent what that
entry's own release actually contained at the time. Recorded here instead,
so a future reader who greps the changelog for "single Node chokepoint" is
not misled into believing the current architecture still matches that
description -- the current, corrected description lives in
`lib/core/state-ops.cjs`'s own doc comment and in `240.1-RESEARCH.md`
Finding 1C.

## Item 8: pre-existing test failures observed while running this phase's regression battery

The full phase-gate run (Task 3 of this plan) surfaced the pre-existing
failures already tracked by Phase 240's own residual register
(`.planning/phases/240-memory/deferred-items.md`, item D-240-07), re-checked
live during this plan to confirm they have not changed shape:

1. `tests/test-memory-command.cjs`: the same two pre-existing failures
   (`FAIL cross-room Mode A: output mentions Brain Patterns block`, `FAIL
   cross-room Mode A: surfaces Brain hint verb (validate-idea)`) -- Brain
   Mode A rendering, unrelated to any file this phase touches.
2. `tests/test-hmi-compliance-e2e.cjs`: the same pre-existing
   `hooks.json byte-identity for Phase 99/100/103 Stop entries` failure
   (`hooks/hooks.json` confirmed untouched by every commit in this phase).
3. `tests/test-graph-derivation-verdict.cjs`: the same two pre-existing
   FEYNMAN-timeline-marker failures, unrelated to this phase's files.

No NEW failure was introduced by any Phase 240.1 commit. Full evidence and
exact command outputs are recorded in this plan's own SUMMARY.md under
"Phase Gate Results."
