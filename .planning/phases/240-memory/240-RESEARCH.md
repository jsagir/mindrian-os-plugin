# Phase 240: Memory - Research

**Researched:** 2026-07-30
**Domain:** Agent working-memory-to-long-term-memory promotion triggers (Layer 1 -> Layer 2 JTBD), event-sourced memory-cortex write paths over `room.db`, and hermetic test isolation for a stateful per-user store
**Confidence:** HIGH (every claim below is either a file:line read on current `main` or a live observation run this session; two MCP grounding legs were unavailable and are declared as gaps, not papered over)

## Summary

This phase is mostly NOT a build. Two of its three requirements are already partly or wholly satisfied by code that landed after the ROADMAP text was written, and the research below replaces guesswork with measurement on all three.

**MEM-01 is the only real code defect, and it is a structural deadlock, not a threshold tweak.** Layer 2 promotion (`promoteIfEligible`) is gated behind an unconditional early return in the per-turn hook. Its `>= 3 turns` noise floor counts rows in a history array that ONLY grows on topic changes. So the counter that is supposed to detect continuous work can only be incremented by NOT working continuously. Live-proven: 12 consecutive same-topic turns against a seeded room produce 11 `no transition` early returns, exactly one promotion attempt (on turn 1, which fails at `turnCount=1`), and zero Layer 2 rows. Separately, the manual-override bypass reads two fields (`manual_set`, `trigger`) that the write path never persists, so it is dead code, and the real live store proves both defects: `~/MindrianRooms/.memory/jtbd-history.json` reads `"rooms": {}` after roughly two months, and every line in the live `audit.log` was written by a test fixture, not by real user work.

**MEM-02's root cause was already fixed and shipped** (commit `3c9afa2e`, the RCA's human-approved Option B). `writeGraphEdge` and `GRAPH_EDGE_LOG` are deleted; `logGraphTransition` routes all three lifecycle transitions into the `jtbd_transitioned` memory_event sink. I proved the full end-to-end claim live on current HEAD: a promote writes a real `memory_event` node into `room.db` and that node survives a real `rebuildGraph` byte-for-identity. **This means ROADMAP Success Criterion 2 is unsatisfiable exactly as worded** ("the pending log shrinks accordingly") and must be reframed by the planner, or the phase will chase the drainer the repo explicitly and deliberately chose NOT to build.

**MEM-03's census is now measured rather than assumed.** I ran 16 candidate JTBD/memory suites with `HOME` redirected to a throwaway sandbox. Exactly ONE leaks into `$HOME/MindrianRooms`: `tests/test-jtbd-auto-anchor-empirical.sh`. All 13 other memory/JTBD suites are hermetic. The leak's footprint is 9 paths, three of which its own cleanup trap misses, which is precisely why the fence must hash the whole `.memory/` directory rather than just `jtbd-history.json`.

**Primary recommendation:** Treat this as one real fix (MEM-01's deadlock plus its manual-override round-trip), one reframed-and-gated already-true behavior (MEM-02: build the regression gate and mutation proof, correct SC2's wording, do NOT build a drainer), and one single-file hermeticity fix plus a reusable fence (MEM-03). Reuse three existing primitives rather than inventing: `cur.turn_count` (read side already live and currently dead), `manualOverrideActive` (already exported and already used in production), and `withTmpRoot` (the canonical hermetic idiom in this very test family).

## Project Constraints (from CLAUDE.md)

Binding directives the planner must honor. These carry the same authority as locked decisions.

| Directive | Source | Consequence for this phase |
|-----------|--------|----------------------------|
| **No em-dashes anywhere; hyphens only** | CLAUDE.md Conventions (HARD RULE) | Every file this phase touches must be swept. Phase 236 and 239 both verified this explicitly at close. |
| **CJS only, no TypeScript**; `lib/core/*.cjs` ships as source | CLAUDE.md Code | All new code is `.cjs`. No build step. |
| **Zero new runtime dependencies** (Phase 87 invariant, restated in `across-session-memory.cjs:38`) | module header | No package installs this phase. See Package Legitimacy Audit. |
| **Canon Part 7 - Reuse Before Build** | CLAUDE.md Canon Core | Justify any net-new surface. Three existing primitives cover the three fixes; see Don't Hand-Roll. |
| **Canon Part 9 - Memory Locality**; `lib/core/navigation.cjs` is the single SQL navigation chokepoint | CLAUDE.md Canon Core + Architecture | Every `room.db` write goes through `navigation.cjs`. `logGraphTransition` already obeys this (lazy-requires `navigation.cjs`, `across-session-memory.cjs:365`). Do not add raw `node:sqlite` writes. |
| **Canon Part 8 - Graph Boundary (LOCAL -> BRAIN: NO)** | CLAUDE.md Canon Core | memory_event payloads carry scalars and enum handles only, never prose. `logGraphTransition`'s payload (`across-session-memory.cjs:366-372`) is already compliant; keep it that way. |
| **Canon Part 11 - Invocation Constitution (CIRS)** | CLAUDE.md Canon Core | If this phase adds any invocable surface, it is born WIRED or EXCLUDED with a declared HITL shape. Recommended scope adds none. |
| **Tri-Polar Design Rule** (CLI + Desktop + Cowork) | CLAUDE.md | A hook-behavior change affects all three. Phase 241-05 set the precedent: the shared `mindrian-core` Stop path needed the same wiring. Check whether `MINDRIAN_MCP_FIRST` routes the JTBD path to a daemon that also needs the trigger fix. |
| **GSD workflow enforcement**: no direct edits outside a GSD command | CLAUDE.md | Plans execute under `/gsd-execute-phase`. |
| **Verification**: `bash tests/run-all-<phase>.sh` before declaring done | CLAUDE.md | `tests/run-all-240.sh` does not exist yet. Wave 0 item. |
| **Dev-Research Compositing** | CLAUDE.md | This is MindrianOS-own-architecture work, so it composites with `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`. The three sibling 2026-07-28 RCAs are already filed there; this phase's trail belongs alongside them. |
| **RCA standard** for any new defect found mid-phase | CLAUDE.md | `docs/RCA-TEMPLATE.md`, filed to `.planning/debug/<slug>.md` with `git add -f`. |
| **Release lockstep**: never bump versions by hand | CLAUDE.md release-process | This phase cuts no release. ROADMAP Gate 0 governs the train. |

**Also load-bearing, from `.planning/config.json`:** `granularity: fine`, `parallelization: true`, `commit_docs: true`, `use_worktrees: false`, `nyquist_validation: true`, `plan_check: true`, `verifier: true`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-turn JTBD classification | Hook process (`scripts/jtbd-update.cjs`, UserPromptSubmit + Stop) | - | Registered at `hooks/hooks.json:408` (userprompt) and `:180` (stop). This is the only per-turn observation point in the JTBD path. |
| Layer 1 within-session state | Room filesystem (`<roomDir>/.mindrian/jtbd-state.json`) | - | Owned by Phase 100 `lib/hmi/jtbd-state.cjs`. D-01 invariant: `across-session-memory.cjs` NEVER writes it (`across-session-memory.cjs:33-36`). |
| Layer 2 across-session state | Per-user global store (`~/MindrianRooms/.memory/jtbd-history.json`) | Room `room.db` (memory_event journal) | Per-USER not per-team (`across-session-memory.cjs:100`, ROOM.md privacy contract at `:119-121`). |
| Layer 2 promotion decision | `lib/hmi/across-session-memory.cjs::promoteIfEligible` | - | Single gate. Two production callers. |
| Canon Part 4 graph signal | `lib/core/navigation.cjs` chokepoint -> `room.db` nodes table | - | Via `logJtbdTransition` (`spine-events.cjs:182-189`). Never a raw SQL write from the HMI tier. |
| Artifact reindex / graph rebuild | `lib/core/lazygraph-ops.cjs::rebuildGraph` | - | Owns ONLY `Artifact` + `Section` nodes and `BELONGS_TO` edges (`lazygraph-ops.cjs:81,84`). memory_event is explicitly not its property. |
| Test isolation boundary | Test process env (`MINDRIAN_ROOMS_HOME`) | Child-process env injection | `ROOMS_HOME()` re-reads the env on EVERY call (`across-session-memory.cjs:49-55`), by design, so a test can swap roots between calls without a module reload. |

**Tier-assignment warning for the planner:** MEM-01's turn counter must live in the **Layer 1 / room filesystem** tier (`jtbd-state.json`), not the Layer 2 tier. The Layer 2 module is forbidden from writing Layer 1 state by the D-01 invariant, and `jtbd-update.cjs` (the Phase 100 owner) is the correct writer. Putting the counter in the Layer 2 store instead would breach D-01 and would also be wrong: the counter is per-room within-session data.

## Standard Stack

No new libraries. This phase is entirely first-party edits plus tests against the existing substrate.

### Core (all already present)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `node:sqlite` `DatabaseSync` | built-in; **`engines.node >= 22.16.0`** | The `room.db` substrate that holds memory_event rows | Already the repo's fixed choice (Canon Part 9). Floor set by Phase 236 GRAPHDB-03: v22.16.0 is where the `timeout` constructor option actually works, not v22.13.0 where the module merely stops needing a flag. `[VERIFIED: live]` `node -e process.version` -> **v22.23.1** on this machine. `[CITED: .planning/phases/236-memory.../236-RESEARCH.md:134, :267]` |
| Node built-ins only (`fs`, `path`, `os`, `crypto`) | - | Everything in `lib/hmi/` and `scripts/` | Phase 87 zero-dependency invariant, restated at `across-session-memory.cjs:38`. `[VERIFIED: source read]` |
| `node:assert/strict` + hand-rolled pass counter | built-in | Test harness | No jest, no vitest anywhere in this repo. See Validation Architecture. `[VERIFIED: source read]` |
| Bash | - | Aggregators (`tests/run-all-<phase>.sh`) and shell suites | 114 `run-all-*.sh` aggregators exist. `[VERIFIED: ls]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-wrapped `BEGIN`/`COMMIT`/`ROLLBACK` | `better-sqlite3`'s `db.transaction(fn)` | **Not available.** `DatabaseSync` has no `transaction()` method. The repo documents this at `lazygraph-ops.cjs:551-553` and again at `:658-661`; Phase 236 confirmed it against the live prototype four independent times. Do not write a shim. `[CITED: 236-RESEARCH.md:156]` |
| A dwell-time trigger (`now - entered_at`) | A persisted turn counter | Dwell needs zero schema change (`entered_at` is already persisted at `jtbd-state.cjs:133`) but measures wall clock, not work. SC1 says "a real multi-turn session of continuous same-topic work", so turns are the faithful signal. Recommend the counter as primary, dwell as an optional secondary OR clause. |
| A per-turn `memory_event` counted via `navigation.findRecentChanges` | A field on `jtbd-state.json` | The event-counting idiom already exists (`venture-shape-nudge.cjs:107,138-158`, threshold 3, 24h window) and is the repo's precedent for "how many turns of work happened". BUT no per-turn memory_event is emitted today: `f_selector_decision` fires only on dial/reach decisions, and `logSpineRead` sits INSIDE the same post-early-return block (`jtbd-update.cjs:191-210`). This route requires emitting a new event first: strictly more surface. Note it for the Canon Part 7 discussion, do not pick it. `[VERIFIED: source read]` |

**Installation:** none. No `npm install` in this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. The Phase 87 zero-runtime-dependency invariant (`across-session-memory.cjs:38`) and the CLAUDE.md "CJS only, node built-ins" convention mean every dependency is already vendored or built in. `slopcheck` was therefore not run and no package table is emitted.

**If a plan proposes any package install, that is a scope escape** and should be challenged against Canon Part 7 before it reaches a checkpoint.

## Architecture Patterns

### System Architecture Diagram

The JTBD memory path, as it exists on current `main`. `[X]` marks a proven defect; `[OK]` marks proven-working.

```
USER TYPES A MESSAGE
        |
        v
  UserPromptSubmit hook  (hooks/hooks.json:408)
  node scripts/jtbd-update.cjs userprompt        <-- fires EVERY turn
        |
        +--> resolveActiveRoomDir()              (jtbd-update.cjs:129)  no room -> exit
        |
        +--> readOperator(roomDir)               (jtbd-update.cjs:147, :104-110)
        |        |
        |        +-- file absent -> defaults to 'JUST_TALK'  (operator.cjs:118,142)
        |
        +--> classify({...})                     (jtbd-update.cjs:153)
        |        |
        |        +-- threshold = JUST_TALK ? 0.8 : 0.6       (jtbd-classifier.cjs:193)
        |        +-- max score w/o operator affinity = 0.5 + 0.1 hysteresis = 0.6
        |        |
        |   [X] GATE 0: on a room with no operator file, score can never reach 0.8
        |        v
        +--> if (!result.jtbd) return            (jtbd-update.cjs:162-165)
        |
        v
  [X] GATE 1: if (!isTransition(current, result)) return    (jtbd-update.cjs:167-170)
        |          isTransition (jtbd-update.cjs:115-122):
        |            same jtbd AND |delta confidence| <= 0.15  -> FALSE -> EARLY RETURN
        |          ^^^ THIS is the topic-change-only trigger. Everything below is skipped.
        |
        v  (reached ONLY on a topic change)
  jtbdState.setCurrent(roomDir, {...})           (jtbd-update.cjs:175-181)
        |    writes current = {jtbd, confidence, entered_at, evidence, expires_at}
        |                                        (jtbd-state.cjs:132-138)
        |    appends ONE history row {from,to,trigger,at,evidence}
        |                                        (jtbd-state.cjs:139-141)
        |    [X] NOTE: `trigger` lands in the HISTORY row only, never in `current`
        |
        +--> SENS-05 jtbd-reweight -> navigation.logSpineRead   (jtbd-update.cjs:191-210)
        |
        v
  Phase 103-05 additive block                    (jtbd-update.cjs:213-257)
        |
        +--> turnCount = cur.turn_count ?? count(history rows where to === cur.jtbd)
        |                                        (jtbd-update.cjs:242-244)
        |    [X] cur.turn_count is NEVER a number (setCurrent drops it)
        |    [X] so the fallback always runs, and history only grew on transitions
        |
        v
  acrossSession.promoteIfEligible(roomSlug, {current, history})
                                                 (jtbd-update.cjs:245 -> across-session-memory.cjs:384)
        |
        +-- manual = cur.manual_set === true || cur.trigger === 'manual'
        |                                        (across-session-memory.cjs:395)
        |   [X] BOTH fields structurally absent from `current` -> manual ALWAYS false
        |
        +-- [X] GATE 2: if (!manual && turnCount < 3) return null   (:398)
        +--     GATE 3: if (!manual && confidence < 0.6) return null (:400)
        |
        v  (never reached on continuous work)
  atomicUpdateMemory()                           (:403 -> :154)
        |    O_EXCL lockfile + tmp+rename -> ~/MindrianRooms/.memory/jtbd-history.json
        |
        +--> appendAudit()                       (:434 -> :262)  -> .memory/audit.log
        |
        +--> logGraphTransition('promote', ...)  (:435 -> :355)
                 |
                 +-- resolveRoomDirForSlug(roomSlug)   (:339)  unregistered -> null -> no-op
                 |
                 v
           navigation.logJtbdTransition(roomDir, payload)   (:373)
                 |                                (spine-events.cjs:182-189)
                 +-- derives dedupe_key from [type, kind, from, to]
                 +-- no room.db -> {ok:false, reason:'no_room_db'}  graceful
                 |
                 v
           memory_events _emit -> INSERT INTO nodes (type='memory_event')
                                                 (memory-events.cjs:715, :724)
                 |
                 v
   [OK] room.db nodes table -- SURVIVES rebuildGraph
                 |
                 +-- rebuildGraph BEGIN                     (lazygraph-ops.cjs:668)
                 +-- clearIndexerOwnedRows(conn, ...)       (:126-152)
                 |     DELETE FROM edges WHERE type IN ('BELONGS_TO')
                 |     DELETE FROM nodes WHERE type IN ('Artifact','Section')
                 |     ^^^ 'memory_event' is NOT in the allowlist (:81) -> untouched
                 +-- _indexArtifactBody(...) per artifact   (:687, :719)
                 +-- COMMIT / ROLLBACK on throw             (:743, :745)

  SEPARATE ENTRY POINT (already bypasses GATE 0 and GATE 1):
    SessionStart -> scripts/memory-resume-nudge.cjs
      backfillFromWithinSession()                (memory-resume-nudge.cjs:90-123)
        walks registry -> jtbdState.getCurrent(roomDir)
        -> acrossSession.promoteIfEligible(slug, {current: cur, history: hist})   (:119)
        [X] hits the SAME turnCount deadlock (passes no turn_count)

  RETIRED (commit 3c9afa2e, RCA Option B):
    writeGraphEdge -> ~/MindrianRooms/.memory/graph-edge-pending.log
      DELETED. 13 orphan lines remain frozen on disk, never read, never written.
```

### Pattern 1: The scoped-ownership destructive wipe (the Phase 236 pattern MEM-02 rides)

**What:** A reindex may only DELETE row types it can fully REGENERATE. Everything else survives by construction, via an explicit frozen allowlist, inside one transaction.

**When to use:** Any destructive-then-repopulate path over a table that mixes derived and original rows with no discriminator column.

```javascript
// Source: lib/core/lazygraph-ops.cjs:81-84, :126-152, :668-745 (Phase 236 GRAPHDB-01)
const INDEXER_OWNED_NODE_TYPES = Object.freeze(['Artifact', 'Section']);
const INDEXER_OWNED_EDGE_TYPES = Object.freeze(['BELONGS_TO']);

function clearIndexerOwnedRows(conn, extraDerivedEdgeTypes) {
  const ph = (arr) => arr.map(() => '?').join(',');
  // 1. Indexer-owned edges FIRST (a legacy pre-169 room.db still carries the
  //    edges -> nodes FK, which would REJECT a now-scoped node delete).
  conn.prepare('DELETE FROM edges WHERE type IN (' + ph(INDEXER_OWNED_EDGE_TYPES) + ')')
    .run(...INDEXER_OWNED_EDGE_TYPES);
  // 2. Caller-derived edges, scoped by type AND by BOTH endpoints being
  //    indexer-owned node ids (endpoint ownership, not type alone).
  // 3. Indexer-owned nodes LAST.
  conn.prepare('DELETE FROM nodes WHERE type IN (' + ph(INDEXER_OWNED_NODE_TYPES) + ')')
    .run(...INDEXER_OWNED_NODE_TYPES);
}

// Caller owns the transaction. node:sqlite has NO transaction(fn) helper.
conn.prepare('BEGIN').run();
try {
  clearIndexerOwnedRows(conn);
  /* reindex */
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_) { /* ignore */ }
  throw err;
}
```

**Why this is the pattern MEM-02 rides, and nothing more:** `memory_event` is stored as a `nodes` row with `type = 'memory_event'` (`memory-events.cjs:724`). It is absent from `INDEXER_OWNED_NODE_TYPES`. Therefore it already survives. Phase 240 owes a regression gate that pins this for the specific `jtbd_transitioned` row an across-session promote writes, not a new mechanism.

### Pattern 2: Graceful-degradation envelope around every memory write

**What:** Every public function wraps its body in `try/catch`, logs to stderr, and returns `null`/`undefined`. A memory failure NEVER throws upward into Larry's turn.

```javascript
// Source: lib/hmi/across-session-memory.cjs:355-378 (the logGraphTransition wiring)
function logGraphTransition(kind, roomSlug, jtbd, extraProps) {
  try {
    const roomDir = resolveRoomDirForSlug(roomSlug);
    if (!roomDir) return null;               // unregistered room -> graceful no-op
    const navigation = require('../core/navigation.cjs');   // lazy; mirrors operator.cjs
    const payload = Object.assign({
      to: jtbd, kind: kind, roomSlug: roomSlug,
      created_by: 'system', source_path: 'across-session:' + kind,
    }, extraProps || {});
    return navigation.logJtbdTransition(roomDir, payload);  // no room.db -> {ok:false}
  } catch (err) {
    logStderr('logGraphTransition', err);
    return null;
  }
}
```

The same discipline appears at the hook layer: `jtbd-update.cjs:216,252-256` wraps the whole promotion block so "Phase 100 Stop hook behavior remains byte-identical above". **Any MEM-01 change must preserve this envelope.** A trigger fix that lets an exception escape breaks a hook that runs on every single user turn.

### Pattern 3: Hermetic root swap for the per-user store (the MEM-03 pattern to reuse)

**What:** `mkdtempSync` a throwaway root, set `MINDRIAN_ROOMS_HOME` to it, restore the prior value in `finally`, `rmrf` the root. Works because `ROOMS_HOME()` re-reads the env on every call.

```javascript
// Source: tests/test-across-session-memory.cjs:100-111 (the canonical idiom)
function withTmpRoot(fn) {
  const tmp = freshTmpRoot();                       // fs.mkdtempSync under os.tmpdir()
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = tmp;
  try {
    return fn(tmp);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    rmrf(tmp);
  }
}
```

For child processes, inject explicitly rather than relying on inheritance:

```javascript
// Source: tests/test-memory-hook-integration.cjs:104, :121, :479
spawnSync(process.execPath, [script], {
  env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home }),
});
```

Why the env-var route rather than the `HOME` route: `ROOMS_HOME()` prefers `MINDRIAN_ROOMS_HOME` and only falls back to `path.join(os.homedir(), 'MindrianRooms')` (`across-session-memory.cjs:53-55`). Overriding `MINDRIAN_ROOMS_HOME` is the sanctioned seam; overriding `HOME` also works but drags in every other home-relative path a subprocess might touch.

### Anti-Patterns to Avoid

- **Widening `INDEXER_OWNED_NODE_TYPES` "to be safe."** The header at `lazygraph-ops.cjs:60-69` says it explicitly: widening reintroduces the data loss at a narrower scope. If a plan needs the indexer to clean up something, that something must be fully regenerable from disk.
- **Adding a second consumer for a queue that already has one.** The Phase 241 planner note (ROADMAP.md:202) records exactly this trap: the MINTO RCA concluded "never wired" from a grep against the wrong file, and two drains would have raced. Before building any drainer, grep for extensionless bash wrappers too.
- **Having the Layer 2 module write Layer 1 state.** The D-01 invariant (`across-session-memory.cjs:33-36`) is explicit. The turn counter is written by `jtbd-update.cjs` / `jtbd-state.cjs`, read by `across-session-memory.cjs`.
- **A "remove the transaction wrap" mutation as proof of journal survival.** The Phase 236 test file warns in its own header (`test-236-rebuild-preserves-journal.cjs:24-32`) that removing the wrap does NOT redden survival scenarios, because the loss was on the happy path. A mutation proof built on that premise ships green with the bug intact. See Pitfall 4.
- **Asserting on `graph-edge-pending.log` shrinking.** Nothing reads or writes that file any more, by design. An assertion that it shrinks can only be satisfied by re-introducing a rejected design.

## Runtime State Inventory

This is a stateful-memory phase, so live runtime state matters as much as source. Every category was checked directly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data (live per-user store)** | `~/MindrianRooms/.memory/jtbd-history.json`: `{"version":1,"rooms":{},"last_updated":"2026-07-28T04:16:13.836Z"}` -- **empty rooms object**, last written by a TEST run. `~/MindrianRooms/.memory/audit.log`: 5 `promote` lines, all `roomSlug=test-jtbd-127.3-empirical`, dated 2026-05-31 to 2026-07-28. `~/MindrianRooms/.memory/graph-edge-pending.log`: exactly **13** lines, unchanged since 2026-07-28T02:42:14Z, all `action:promote`, slugs `test-jtbd-promote` and `test-jtbd-127.3-empirical`. `[VERIFIED: live read]` | **Data migration: NONE possible.** Both orphan slugs are absent from the current registry, so `resolveRoomDirForSlug` returns null and any replay is a structural no-op (RCA decision, already executed). **Code edit: none.** Leave as historical residue with a note. The 5 `audit.log` lines and the `.memory/ROOM.md` file are the MEM-03 leak's residue and are direct evidence for the SC3 hash gate. |
| **Live service config** | None. This phase touches no external service (no n8n, no Datadog, no Cloudflare, no Tailscale). The Brain MCP is not on this path: `across-session-memory.cjs:30-31` states the module does not query Brain. `[VERIFIED: source read + grep]` | None. |
| **OS-registered state** | None. No Task Scheduler entry, no pm2 process, no launchd plist references the JTBD memory path. The only registrations are Claude Code hooks in `hooks/hooks.json` (`:180` Stop, `:408` UserPromptSubmit, plus SessionStart at `:23` and PostToolUse `memory-completion-detector.cjs` at `:282`), which are read from the repo at session start, not OS-registered. `[VERIFIED: grep hooks.json]` | None, but note the plugin-cache reality: a hooks.json change is NOT live in a running session until a release ships and is picked up (standing HARD RULE, `.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`). Any manual end-to-end SC1 verification must run the scripts directly from the dev workspace, not rely on the installed plugin. |
| **Secrets / env vars** | `MINDRIAN_ROOMS_HOME` (the hermeticity seam, `across-session-memory.cjs:54`; also read independently at `memory-resume-nudge.cjs:93,127`). `MINDRIAN_DEBUG` (`jtbd-update.cjs:34`). `CLAUDE_ACTIVE_ROOM` / `MINDRIAN_ACTIVE_ROOM` (active-room override honored by `resolve-active-room.cjs`). `MINDRIAN_MCP_FIRST` (Tri-Polar daemon routing, `hooks/hooks.json:3` note). No secrets on this path. `[VERIFIED: grep]` | No key renames. **But:** `memory-resume-nudge.cjs:93` and `:127` each resolve `MINDRIAN_ROOMS_HOME` with their OWN inline fallback rather than calling the module's `ROOMS_HOME()`. That is a third copy of the same resolution and a latent drift site; note it, do not necessarily fix it (out of MEM scope, Canon Part 7 consolidation candidate). |
| **Build artifacts / installed packages** | None relevant. No egg-info, no compiled binary, no Docker tag. The plugin install cache `~/.claude/plugins/mindrian-os/` holds a stale copy of these scripts (see the WORKSPACE GUARD), which is why in-session behavior can lag the repo. `[VERIFIED: CLAUDE.md + standing memory rule]` | None. Do not run any GSD/git operation from the plugin cache. |
| **Working-tree state (planner hazard)** | `git status` is NOT clean: `lib/statusline/ctx-window.cjs`, `scripts/context-monitor`, `scripts/statusline-fallback-echo.cjs`, `package-lock.json`, and three statusline test files are modified; several untracked `.planning/debug/*.md` files exist. `[VERIFIED: git status]` | Unrelated to Phase 240. Flag to the navigator before execution so a plan's `git diff --quiet` style assertion does not trip on foreign changes, and so nothing gets swept into a Phase 240 commit. |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is a manual override active?" | A new `manual_set` flag plus new gate logic | **`jtbdState._internal.manualOverrideActive(current)`** -- `lib/hmi/jtbd-state.cjs:77-81`, exported at `:198` | It already exists, it is already exported, and it is ALREADY used in production for exactly this question at `scripts/jtbd-command.cjs:762-765` (deciding `kind:'override'` vs `kind:'set'`). It reads `current.expires_at`, which IS persisted (proven live). Canon Part 7. |
| "How many turns on this topic?" (read side) | A new field name and a new reader | **`cur.turn_count`** -- `across-session-memory.cjs:392-393` already prefers it when it is a number | The read side is already written and is currently dead code, because nothing ever writes the field. Only the WRITE side is missing. Reusing the existing name means zero change to the Layer 2 module and it fixes `memory-resume-nudge.cjs:119` for free. |
| Hermetic test isolation for the per-user store | A new fixture helper, or `HOME` juggling | **`withTmpRoot` / `freshTmpRoot`** -- `tests/test-across-session-memory.cjs:100-111`, plus explicit child env injection at `tests/test-memory-hook-integration.cjs:104,121,479` | Two existing suites in this exact family already do it correctly and were empirically confirmed hermetic this session. |
| Journaling a JTBD lifecycle transition | A new edge type, a new node type, a new hook | **`navigation.logJtbdTransition(roomDir, payload)`** -- `spine-events.cjs:182-189`, re-exported at `navigation.cjs:423` | Already wired at all three call sites (`across-session-memory.cjs:435,481,521`). Opens its own `room.db` handle, sets a `dedupe_key`, degrades to `{ok:false, reason:'no_room_db'}`. The RCA's rejected Option A would have needed a new frozen edge type in `edges.cjs`'s `ALLOWED_EDGE_TYPES` PLUS a JTBD node type that does not exist in the schema. |
| A scoped destructive wipe | A second raw-SQL delete site | **`clearIndexerOwnedRows(conn, extra)`** -- `lazygraph-ops.cjs:126-152` | One implementation, two call sites, deliberately co-located with the ownership constants so the two destructive reindex paths cannot drift. Adding raw graph SQL in `scripts/` would trip `scripts/check-substrate.cjs`. |
| A phase test aggregator | A hand-maintained execution list | **Glob discovery** -- `tests/run-all-236.sh` (globs `tests/test-236-*`, enumerates expected names in the header, has a `found -eq 0` anti-vacuity guard) | A hand list is a second place to forget something. The 236 runner says so in its own header and its `found -eq 0` guard was mutation-proven. |
| A transaction helper | A `transaction(fn)` shim over `DatabaseSync` | Explicit `BEGIN` / `COMMIT` / `ROLLBACK` | `DatabaseSync` has no `transaction()` method. Confirmed four times independently in Phase 236. Nested `BEGIN` is rejected by SQLite, which is why `rebuildGraph` calls `_indexArtifactBody` rather than `indexArtifact` (`lazygraph-ops.cjs:471-472`). |

**Key insight:** All three MEM requirements resolve to *connecting primitives that already exist* rather than adding surface. MEM-01's read side is built and dead; MEM-02's write side is built and working; MEM-03's isolation idiom is built and proven in two sibling suites. A plan that introduces new modules for any of the three has almost certainly missed the existing primitive.

## The Four Mandated Findings

Each of the four items the phase brief demanded is nailed down below with file:line and, where possible, a live observation. **None is left as an open question.**

### Finding 1 (MEM-01): the Layer 2 trigger, and why it is a deadlock rather than a threshold

**Where the promotion lives:** `lib/hmi/across-session-memory.cjs:384` -> `promoteIfEligible(roomSlug, withinSessionState)`.

**Its two production callers:**
1. `scripts/jtbd-update.cjs:245` -- the per-turn hook (UserPromptSubmit at `hooks/hooks.json:408`, Stop at `:180`).
2. `scripts/memory-resume-nudge.cjs:119` -- the SessionStart defensive backfill (`backfillFromWithinSession`, `:90-123`). This one ALREADY bypasses the topic-change gate, but hits the same counter deadlock.

**The exact condition that makes it topic-change-only** -- `scripts/jtbd-update.cjs:167-170`:

```javascript
if (!isTransition(current, result)) {
  debugLog(roomDir, 'no transition; same jtbd, delta within ' + PLUS_MINUS + '0.15');
  return;                                   // <-- unconditional early return
}
```

with `isTransition` at `:115-122`:

```javascript
function isTransition(prev, next) {
  if (!next || typeof next.jtbd !== 'string') return false;
  if (!prev || typeof prev.jtbd !== 'string') return true;      // cold start
  if (next.jtbd !== prev.jtbd) return true;                     // topic CHANGE
  const a = typeof prev.confidence === 'number' ? prev.confidence : 0;
  const b = typeof next.confidence === 'number' ? next.confidence : 0;
  return Math.abs(b - a) > CONFIDENCE_DELTA_THRESHOLD;          // 0.15
}
```

The Phase 103-05 promotion block sits at `:213-257`, **below** that return. So on continuous same-topic work the promotion is not merely gated, it is never invoked.

**The deadlock (this is the important part, and it is why raising a threshold cannot fix it):**

| Link | Location | Consequence |
|------|----------|-------------|
| `turnCount` prefers `cur.turn_count`, else counts history rows where `to === cur.jtbd` | `across-session-memory.cjs:392-394`; mirrored at `jtbd-update.cjs:242-244` | Two independent copies of the same fallback. |
| `setCurrent` builds `newCurrent` as exactly `{jtbd, confidence, entered_at, evidence, expires_at}` | `jtbd-state.cjs:132-138` | `turn_count` is **dropped**. So `typeof cur.turn_count === 'number'` is ALWAYS false in production, and the history fallback ALWAYS runs. |
| History rows are appended only by `setCurrent` | `jtbd-state.cjs:139-145` | And `setCurrent` is reached only after `isTransition` passes. |
| `NOISE_FLOOR_TURNS = 3` | `across-session-memory.cjs:76`, gate at `:398` | Needs 3 history rows targeting the same jtbd. |
| Classifier hysteresis adds +0.1 toward `currentJtbd` | `jtbd-classifier.cjs:178-180` | Actively SUPPRESSES the topic oscillation that is the only way to accumulate those rows. |

**Net:** reaching `turnCount >= 3` requires three separate transitions INTO the same jtbd, which requires leaving the topic and returning twice, against a classifier that is deliberately sticky. That is literally "fires only on topic changes", and in practice not even reliably then.

**LIVE PROOF** (hermetic sandbox, operator set to `BUILD_ROOM` so the classifier could clear its threshold, 12 identical strong-cue messages through the real hook):

```
2026-07-30T13:23:58.501Z event=userprompt jtbd=decide-pursue conf=0.800 (51.30ms)
2026-07-30T13:23:58.538Z no transition; same jtbd, delta within +/-0.15
... x11 identical lines ...
history rows: 1 | targeting decide-pursue: 1
current: {"jtbd":"decide-pursue","confidence":0.8,"entered_at":"...","evidence":[...],"expires_at":null}
Layer 2 store after 12 continuous turns: ABSENT
memory_event jtbd_transitioned rows in room.db: no room.db
```

Turn 1 transitioned and DID reach `promoteIfEligible`, which returned null at `turnCount = 1 < 3`. Turns 2-12 never reached it. Zero Layer 2 rows, zero memory_events, `room.db` never even created. `[VERIFIED: live observation 2026-07-30]`

**Corroborating live evidence from the real machine:** `~/MindrianRooms/.memory/jtbd-history.json` reads `"rooms": {}` with `last_updated` 2026-07-28 (a test run), and all 5 lines in the real `audit.log` carry the test slug `test-jtbd-127.3-empirical`. **In roughly two months of real use, not one genuine user promotion has ever occurred.** `[VERIFIED: live read]`

**What "continuous same-topic work" concretely looks like as a second trigger.** Grounded inventory of what is ACTUALLY observable at `jtbd-update.cjs` userprompt time:

| Signal | Observable? | Location | Grows on continuous same-topic work? |
|--------|-------------|----------|--------------------------------------|
| `current.entered_at` (ISO timestamp) | **Yes, already persisted** | `jtbd-state.cjs:133` | Yes, via `now - entered_at` (wall clock, not turns) |
| History rows targeting `cur.jtbd` | Yes | `jtbd-state.cjs:139-141` | **No** -- only on transitions |
| `cur.turn_count` | Read side yes, write side **no** | read `across-session-memory.cjs:392`; dropped at `jtbd-state.cjs:132-138` | Would, if written |
| The hook firing itself | Yes, every turn | `hooks/hooks.json:408` | Yes -- this is the per-turn tick |
| `f_selector_decision` memory_events in a window | Yes, but not per-turn | counted at `venture-shape-nudge.cjs:140-147` | Only on dial/reach decisions, not on every turn |
| `logSpineRead` per turn | **No** | `jtbd-update.cjs:191-210`, below the early return | No |
| `auto_blocked_by_manual` history rows | Only inside a 24h manual window, and still below the early return | `jtbd-state.cjs:117-119` | No |

**Recommended trigger (primary):** a persisted same-topic turn counter written into `current.turn_count`.
- The hook already runs every turn and already knows, before the early return, whether `result.jtbd === current.jtbd` (both values are in hand at `jtbd-update.cjs:150-159`).
- The READ side already exists and is dead (`across-session-memory.cjs:392`). Writing the field revives it with no change to the Layer 2 module.
- It fixes `memory-resume-nudge.cjs:119` for free, since that path reads the same `current` object.
- Write-side work needed: `jtbd-state.cjs` must carry `turn_count` onto `newCurrent` (or expose a small bump helper), and `jtbd-update.cjs` must increment it on a same-jtbd turn and reset it on a real transition.
- Structural change needed alongside it: the promotion block must become reachable on non-transition turns. Minimal shape is to convert `:167-170`'s `return` into a boolean (skip only `setCurrent` and the SENS-05 reweight) rather than moving the block, so Phase 100's documented "byte-identical above" contract is visibly preserved.

**Recommended trigger (secondary, optional OR clause):** dwell from `current.entered_at` -- zero schema change, catches long single-turn sessions. Do not use it as the ONLY signal: wall clock is not work.

**Recommended fix for the manual-override round-trip.** The gate at `across-session-memory.cjs:395` is:

```javascript
const manual = cur.manual_set === true || cur.trigger === 'manual';
```

**LIVE PROOF that both fields are structurally absent**, taken immediately after a real `/mos:jtbd set decide-pursue`:

```
current keys: jtbd,confidence,entered_at,evidence,expires_at
current.manual_set = undefined
current.trigger    = undefined
current.expires_at = 2026-07-31T13:21:55.105Z
GATE (across-session-memory.cjs:395) manual = false
promoteIfEligible result: null
DEFECT CONFIRMED: manual override did NOT bypass the turn gate
```
`[VERIFIED: live observation 2026-07-30]`

There is a **double** mismatch, and a plan that fixes only one will still be red:
1. `trigger` is written into the HISTORY row only (`jtbd-state.cjs:140`), never into `current`.
2. Even if it were, `scripts/jtbd-command.cjs:706` and `:768` pass `trigger: 'manual_set'`, and the gate compares against the string `'manual'`.

Recommended: make the gate read what IS persisted, via the existing exported predicate `manualOverrideActive(current)` (`jtbd-state.cjs:77-81`, exported `:198`, already used in production at `jtbd-command.cjs:762-765`), **and** additionally persist `manual_set` onto `newCurrent` so the write-then-read round-trip SC1 demands is literally true in both directions. Reconcile the `'manual_set'` vs `'manual'` string in the same change or drop the `trigger` leg of the gate entirely.

**Decision the planner must make, not assume:** `/mos:jtbd set` does NOT call `promoteIfEligible` at all (grep-confirmed: `scripts/jtbd-command.cjs` has zero call sites). So even with the gate fixed, an explicit manual set produces no Layer 2 row until the next `jtbd-update` turn or the next SessionStart backfill. If SC1's "the manual-override path" is meant to promote immediately, `jtbd-command.cjs` needs a call added. If it only means "the fields round-trip", the gate/field fix suffices. **Recommend surfacing this in `/gsd-discuss-phase`.**

### Finding 2 (MEM-02): the RCA's fix is already landed, and SC2 is unsatisfiable as worded

**Verified against HEAD of `main`, not against the RCA text.**

| RCA claim | Status on current `main` | Evidence |
|-----------|--------------------------|----------|
| `writeGraphEdge` at lines 332-346 | **DELETED** | Repo-wide grep for `writeGraphEdge`: zero hits outside `.planning/`. |
| `GRAPH_EDGE_LOG` at line 58 | **DELETED** | Same grep. The path helpers now end at `REGISTRY_FILE()` (`:63`). |
| `HAS_JTBD` anywhere | **Zero hits** in tracked source | Repo-wide grep. |
| `resolveRoomDirForSlug` added | **Present at `:339-353`**, exported for tests at `:630` | Source read. |
| `logGraphTransition` added | **Present at `:355-378`** | Source read. |
| Wired at 3 call sites | **Yes**: `promoteIfEligible` `:435`, `parkJtbd` `:481`, `completeJtbd` `:521` | Source read. Line numbers MOVED from the RCA's 403/443/483; the file is now 643 lines, not 494. |
| `memory-events.cjs` doc comment widened | **Yes, `:265-273`** now documents `promote`/`park`/`complete` alongside `set`/`override`/`clear` | Source read. |
| Test added | **`tests/test-jtbd-transition-graph-wiring.cjs`** exists, 14 `MINDRIAN_ROOMS_HOME` references, empirically hermetic | ls + census. |
| Commit | **`3c9afa2e`** "fix(103-05): route JTBD promote/park/complete into real memory_event sink" | `git log -- lib/hmi/across-session-memory.cjs`. |

**So the brief's question -- "new consumer script/hook, or ALSO calling `logJtbdTransition` alongside `writeGraphEdge`?" -- has a third answer: NEITHER, and it is already done.** `logGraphTransition` was wired **INSTEAD OF** `writeGraphEdge`, and the side-log producer was removed entirely. There is no drain to build and nothing to add at the three call sites.

**The already-accumulated entries:** exactly **13** lines, verified live, byte-unchanged since 2026-07-28T02:42:14Z. Both `roomSlug` values (`test-jtbd-promote`, `test-jtbd-127.3-empirical`) are absent from the current registry, so `resolveRoomDirForSlug` returns null for both and a replay through `logJtbdTransition` would be a structural no-op. **Answer: left as historical debt with a note. Not a one-time backfill. This decision was already made and executed by the RCA; do not re-litigate it.**

**THE SCOPE TENSION -- flag this to the navigator before planning.** ROADMAP.md:178 Success Criterion 2 reads:

> "Seeded `graph-edge-pending.log` entries are consumed into `memory_event` rows through the Phase 150 memory cortex, **the pending log shrinks accordingly**, and the promoted rows SURVIVE a subsequent `rebuildGraph`"

The emphasized clause is **unsatisfiable by design**. No code reads that file; no code writes it; the producer is deleted. The only way to make the log shrink is to build the RCA's Option A drainer, which was explicitly analysed, explicitly rejected, and human-approved against on 2026-07-28 (it would need a new frozen edge type in `edges.cjs`'s `ALLOWED_EDGE_TYPES` and a JTBD node type that does not exist in the schema). SC2 was written before that RCA resolved.

**Recommended reframing of SC2** (planner to confirm with the user):
> A JTBD promote/park/complete against a seeded room writes a real `jtbd_transitioned` `memory_event` row into that room's `room.db` through the Phase 150 memory cortex, and that row SURVIVES a subsequent `rebuildGraph` byte-for-identity; a mutation that adds `memory_event` to `INDEXER_OWNED_NODE_TYPES` turns the gate red. The retired `graph-edge-pending.log` is never re-created, and its 13 orphan lines are documented as frozen historical residue with no live producer or consumer.

That preserves every ounce of the criterion's real intent (the dead-letter queue is gone; promotions reach the cortex; they survive the rebuild) while being achievable and mutation-provable.

**LIVE END-TO-END PROOF that the survival half is already true on current HEAD:**

```
promote result: {"action":"promoted","jtbd":"decide-pursue"}
BEFORE rebuild: {"total":1,"jtbd":1,"ids":["memory_event:jtbd_transitioned:1785417648522:af4ff913"],"artifacts":0}
rebuildGraph: {"success":true,"artifacts":1,"sections":1,"subRooms":0}
AFTER  rebuild: {"total":1,"jtbd":1,"ids":["memory_event:jtbd_transitioned:1785417648522:af4ff913"],"artifacts":1}
VERDICT jtbd_transitioned survived: true
VERDICT rebuild did real work (artifacts>0): true
```
`[VERIFIED: live observation 2026-07-30, node v22.23.1]`

Also verified live: `bash tests/run-all-236.sh` -> **PASS=12 FAIL=0 SKIP=0** (one more than the 11 recorded in STATE.md:49, so an additional 236 test landed since close).

**What MEM-02 actually owes Phase 240:** a regression gate that pins this end-to-end path (promote -> memory_event -> rebuildGraph -> row still there) with a real mutation proof, so a future edit cannot silently remove it. This is the same "pin behavior the repo gets right but never asserted" shape as Phase 236 Plan 02, and STATE.md:43 records the justification: the repo has already been burned once by exactly that gap (Phase 233-03, RCA CLAIM-12).

### Finding 3 (MEM-02): the exact Phase 236 pattern to ride

**Confirmed.** The pattern is `clearIndexerOwnedRows` plus the two frozen ownership allowlists, called inside `rebuildGraph`'s own `BEGIN`/`COMMIT`/`ROLLBACK`:

| Element | Location |
|---------|----------|
| `INDEXER_OWNED_NODE_TYPES = Object.freeze(['Artifact', 'Section'])` | `lib/core/lazygraph-ops.cjs:81` |
| `INDEXER_OWNED_EDGE_TYPES = Object.freeze(['BELONGS_TO'])` | `lib/core/lazygraph-ops.cjs:84` |
| `clearIndexerOwnedRows(conn, extraDerivedEdgeTypes)` -- edges before nodes (legacy FK), endpoint-scoped derived edges | `lib/core/lazygraph-ops.cjs:126-152` |
| `rebuildGraph` `BEGIN` | `lib/core/lazygraph-ops.cjs:668` |
| `rebuildGraph` `COMMIT` / `ROLLBACK` | `lib/core/lazygraph-ops.cjs:743` / `:745` |
| Second call site (must not drift) | `scripts/build-ecosystem-graph.cjs` |
| Rationale block (read before touching) | `lib/core/lazygraph-ops.cjs:33-78` |
| `memory_event` is a `nodes` row with `type='memory_event'` | `lib/core/navigation/memory-events.cjs:715` (id mint), `:724` (INSERT) |

**Why survival holds by construction:** `'memory_event'` is not a member of `INDEXER_OWNED_NODE_TYPES`, so the scoped `DELETE FROM nodes WHERE type IN ('Artifact','Section')` cannot touch it. This is the reason Phase 236 was a HARD dependency, and it is now satisfied and live-verified.

**The correct mutation for the SC2 gate:** add `'memory_event'` to `INDEXER_OWNED_NODE_TYPES` (or revert `clearIndexerOwnedRows` to the pre-236 unscoped `DELETE FROM edges; DELETE FROM nodes;`). Either turns the survival assertion red.

**The WRONG mutation, which would make the gate vacuous:** removing the `BEGIN`/`COMMIT`/`ROLLBACK` wrap. `tests/test-236-rebuild-preserves-journal.cjs:24-32` warns about this in its own header, and Phase 236 Plan 02 proved it empirically (STATE.md:46: under wrap removal, "the WAL test's scenario 3 stayed GREEN, because 236-01's scoped DELETE means the irreplaceable rows are never touched even when atomicity is gone"). Scenario 2 measures the wrap; scenario 3 measures the DELETE scope; neither incidentally covers the other. **A Phase 240 plan that words its mutation as "remove the transaction wrap" ships green with the bug intact.** See Pitfall 4.

### Finding 4 (MEM-03): the leak, the full census, and the pattern to reuse

**The leak, exactly:** `tests/test-jtbd-auto-anchor-empirical.sh:57`

```bash
ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-${HOME}/MindrianRooms}"
```

When `MINDRIAN_ROOMS_HOME` is unset -- which is the normal case, including when `tests/run-all-127.3.sh:44` invokes it -- `ROOMS_HOME` becomes the REAL `~/MindrianRooms`. The script then derives `TEST_ROOM` (`:59`), `REGISTRY_FILE` (`:60`) and `MEMORY_FILE` (`:61`) from it, creates and REGISTERS a real room, and **injects that same real root into its node subprocesses** at `:184` and `:207` (`process.env.MINDRIAN_ROOMS_HOME = '${ROOMS_HOME}'`). It then asserts the real memory file exists (`:222-226`).

**THE CENSUS -- measured, not assumed.** I ran 16 candidate suites with `HOME` redirected to a throwaway sandbox. Any suite that resolves `ROOMS_HOME` from `HOME` materialises `$HOME/MindrianRooms` in the sandbox, which proves the leak without touching the real store.

| Suite | Exit | Leaked into sandbox `$HOME` |
|-------|------|------------------------------|
| **`test-jtbd-auto-anchor-empirical.sh`** | 0 | **`MindrianRooms/`, `.rooms/`, `.rooms/.room-graph/`, `.rooms/.room-graph/rooms.db`, `.rooms/registry.json`, `.memory/`, `.memory/jtbd-history.json`, `.memory/ROOM.md`, `.memory/audit.log`** |
| `test-129-state-transition-events.cjs` | 0 | none (hermetic) |
| `test-127.3-first-touch-nudge.cjs` | 0 | none (hermetic) |
| `test-hmi-compliance-e2e.cjs` | 1 | none (hermetic) |
| `test-hmi-poll-hook.cjs` | 0 | none (hermetic) |
| `test-hmi-status-command.cjs` | 0 | none (hermetic) |
| `test-jtbd-ui-self-compliant.cjs` | 0 | none (hermetic) |
| `test-jtbd-hook-integration.cjs` | 0 | none (hermetic) |
| `test-jtbd-command.cjs` | 0 | none (hermetic) |
| `test-across-session-memory.cjs` | 0 | none (hermetic) |
| `test-memory-command.cjs` | 1 | none (hermetic) |
| `test-memory-hook-integration.cjs` | 0 | none (hermetic) |
| `test-cross-room-memory.cjs` | 0 | none (hermetic) |
| `test-jtbd-transition-graph-wiring.cjs` | 0 | none (hermetic) |
| `test-navigation-chokepoint-hook.cjs` | 0 | `.mindrian/`, `.mindrian/telemetry/`, `.mindrian/telemetry/navigation-bypass.jsonl` |
| `test-connector-tier-d-hooks.cjs` | 0 | none (hermetic) |

`[VERIFIED: live observation 2026-07-30, sandboxed HOME]`

**Conclusions the planner can rely on:**

1. **`tests/test-jtbd-auto-anchor-empirical.sh` is the ONLY suite that leaks into the live memory store.** The RCA's suspicion is now confirmed by measurement. MEM-03's code fix is single-file.
2. **Its own cleanup trap misses three of the nine paths it creates:** `.memory/audit.log`, `.memory/ROOM.md`, and `.rooms/.room-graph/rooms.db`. The trap (`:67-...`) scrubs the room dir, the registry entry, and the test slug out of `jtbd-history.json` -- and nothing else. **This is why the real `audit.log` currently holds 5 test-written lines and why `jtbd-history.json` reads `"rooms": {}` while the audit log is non-empty.** Direct live confirmation of the residue.
3. **Therefore the SC3 hash gate must hash the WHOLE `.memory/` directory** (every file, recursively), not just `jtbd-history.json`. Hashing only `jtbd-history.json` would have passed cleanly on this very machine while `audit.log` was being polluted for two months. This is the single most important design note in MEM-03.
4. **Adjacent, different store, planner decision:** `tests/test-navigation-chokepoint-hook.cjs` `test6_runtimeSoftDefenseJsonl` (`:96-120`) deliberately writes `os.homedir()/.mindrian/telemetry/navigation-bypass.jsonl` and asserts the line count grew. That is a live-HOME write by a test, same defect class, but into `~/.mindrian/telemetry`, NOT the memory store. It is outside MEM-03's literal wording. **Recommend: note it, do not expand MEM-03's scope to cover it.** File it as a follow-up if the navigator wants it closed.
5. **Two suites exit nonzero even when hermetic** (`test-hmi-compliance-e2e.cjs`, `test-memory-command.cjs`). `test-memory-command.cjs`'s two failures are documented pre-existing (RCA verification section: "24/26, the 2 Brain Mode A failures are pre-existing and unrelated"). **The SC3 fence must not convert these pre-existing reds into false hermeticity alarms** -- it measures store mutation, not suite exit code.

**The existing pattern MEM-03's fence must reuse** (do NOT invent a new one):
- In-process: `withTmpRoot` / `freshTmpRoot` -- `tests/test-across-session-memory.cjs:100-111`. `mkdtempSync` + set `MINDRIAN_ROOMS_HOME` + restore prior value in `finally` + `rmrf`.
- For children: explicit `env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home })` -- `tests/test-memory-hook-integration.cjs:104, :121, :479`.
- The seam works because `ROOMS_HOME()` re-reads the env on every call by design (`across-session-memory.cjs:49-55`).
- For the shell suite specifically, the minimal fix is to make line 57 default to a `mktemp -d` root instead of `${HOME}/MindrianRooms`. Note the two subprocess injection sites (`:184`, `:207`) then follow automatically -- which is why the RCA judged this "nontrivial": both subprocesses (`scripts/room-registry create`, `scripts/jtbd-update.cjs`) need independent re-verification under a swapped root.
- **The aggregator matters:** `tests/run-all-127.3.sh:44` runs the leaking suite and sets no `MINDRIAN_ROOMS_HOME`. Verify the fix holds when invoked through the aggregator, not only standalone.

## Common Pitfalls

### Pitfall 1: A vacuous SC1 end-to-end test, because the operator gate fires FIRST

**What goes wrong:** A test drives `scripts/jtbd-update.cjs userprompt` against a fresh temp room, sees exit 0 and no error, and concludes the trigger fix works. It never reached the trigger.

**Why it happens:** `readOperator` (`jtbd-update.cjs:104-110, 147`) calls `operator.getCurrent`, which **defaults to `JUST_TALK`** when the operator file is absent (`lib/conversation/operator.cjs:118, :142`). `JUST_TALK` raises the classifier threshold from 0.6 to **0.8** (`jtbd-classifier.cjs:193`). The maximum score for a pure-cue message is `0.5` (token stratum, saturating at 3 cue matches) plus `0.1` hysteresis toward `currentJtbd` = **0.6**. The `+0.3` operator stratum only applies when the operator is in that JTBD's affinity set, and `JUST_TALK` is in nobody's. So on a fresh room the classifier can NEVER clear 0.8 and `jtbd-update.cjs` early-returns at `:162-165` -- one gate before `isTransition`.

**LIVE PROOF:** twelve turns on a fresh room logged `below_threshold, top:decide-pursue@0.60` every time. After `node scripts/operator-command.cjs set BUILD_ROOM` (BUILD_ROOM is in `decide-pursue`'s affinity set `["BUILD_ROOM","METHODOLOGY"]`), the very first turn logged `jtbd=decide-pursue conf=0.800`. `[VERIFIED: live observation 2026-07-30]`

**How to avoid:** any SC1 test that drives the real hook must (a) set the operator to a value in the target JTBD's affinity set, and (b) **assert that a classification actually happened** before asserting anything about promotion. The `MINDRIAN_DEBUG=1` log at `<roomDir>/.mindrian/jtbd-update.log` (`jtbd-update.cjs:69-77`) is the cheapest observation point: it distinguishes `classify null/below-threshold` from `no transition` from `event=userprompt jtbd=... conf=...`. Assert on which line appeared.

**Warning signs:** the test passes on the FIRST run against unmodified source. If SC1's gate is green before the fix exists, it is measuring nothing.

### Pitfall 2: Fixing the noise floor instead of the deadlock

**What goes wrong:** a plan lowers `NOISE_FLOOR_TURNS` from 3 to 1, or widens `CONFIDENCE_DELTA_THRESHOLD`, sees a promotion appear, and calls MEM-01 done.

**Why it happens:** the symptom ("no promotion") is one step from the noise floor, so the floor looks like the cause. It is not. With the floor at 1, promotion fires on the **transition turn only** and still never on turns 2-N, because `jtbd-update.cjs:169` returns before the promotion block is reached. Continuous work is still invisible; the phase's actual criterion ("fires on real continuous work, **not only on topic changes**") is still unmet.

**How to avoid:** the fix must change BOTH the reachability (the early return at `:167-170`) AND the counter's source (a `turn_count` that grows on same-topic turns). A plan that touches only one of the two cannot satisfy SC1.

**Warning signs:** the diff touches only `across-session-memory.cjs` constants. The reachability half lives in `scripts/jtbd-update.cjs`.

### Pitfall 3: Breaking the "byte-identical above" contract on a hook that runs every turn

**What goes wrong:** the promotion block is relocated above `setCurrent`, or the early return is removed outright, and now `setCurrent` runs on every same-topic turn -- rewriting `entered_at`, appending a history row per turn, and blowing through `HISTORY_MAX = 50` (`jtbd-state.cjs:23`).

**Why it happens:** `:167-170`'s return currently guards THREE things at once: the `setCurrent` write, the SENS-05 reweight fire, and the promotion. Removing it unblocks all three.

**How to avoid:** convert the return into a boolean and keep `setCurrent` and the reweight behind it. `jtbd-update.cjs:214-215` states the contract in its own words: "Phase 100 Stop hook behavior remains byte-identical above." Preserve the `try/catch` envelope at `:216, :252-256` unchanged, and keep the module's never-throw discipline: this script runs on **every** UserPromptSubmit and every Stop, on all three surfaces.

**Warning signs:** `jtbd-state.json` history growing by one row per turn; `entered_at` moving on a non-transition turn (which would also silently break the dwell signal).

### Pitfall 4: A vacuous MEM-02 mutation proof

**What goes wrong:** the plan writes "removing the transaction wrap turns this gate red", the executor removes the wrap, the gate stays GREEN, and the executor either reports a false pass or thrashes.

**Why it happens:** ROADMAP SC2 says the rows survive "riding Phase 236's transaction wrap", which invites exactly this mutation. But the wrap is not what protects them -- the **scoped DELETE** is. Phase 236 proved this twice: `tests/test-236-rebuild-preserves-journal.cjs:24-32` says so in its header, and STATE.md:46 records the live result (under wrap removal, the survival scenario stayed green precisely because the scoped DELETE never touches the irreplaceable rows).

**How to avoid:** word the mutation as **"add `'memory_event'` to `INDEXER_OWNED_NODE_TYPES`"** (`lazygraph-ops.cjs:81`) or "revert `clearIndexerOwnedRows` to an unscoped `DELETE FROM edges; DELETE FROM nodes;`". Both turn the survival assertion red for the right reason.

**Warning signs:** any plan text pairing "transaction wrap" with "journal survival" as cause and effect.

### Pitfall 5: An SC3 hash gate that hashes the wrong thing

**What goes wrong:** the fence hashes `~/MindrianRooms/.memory/jtbd-history.json` before and after the suite, sees an identical hash, and declares hermeticity. Meanwhile `audit.log` gained a line and `.memory/ROOM.md` was created.

**Why it happens:** the leaking suite's cleanup trap deliberately scrubs its slug out of `jtbd-history.json` (`:44-49` documents this: "so the test never pollutes real cross-session memory") but touches nothing else. **A `jtbd-history.json`-only hash would have read clean on this machine for two straight months while `audit.log` accumulated 5 leaked lines.**

**How to avoid:** hash **every file under `.memory/` recursively**, sorted by path, content plus relative path, plus the set of paths itself (so a created-then-deleted file and a never-created file are distinguishable from a created-and-left file). Consider also hashing `~/MindrianRooms/.rooms/registry.json`, since the leak registers and deregisters a real room there and `.rooms/.room-graph/rooms.db` is left behind.

**Warning signs:** the fence's file list is a single filename.

### Pitfall 6: The deliberately-seeded non-hermetic fixture becomes a real leak

**What goes wrong:** SC3 requires "a deliberately seeded non-hermetic fixture turns the fence red". Implemented naively, that fixture writes to the developer's REAL `~/MindrianRooms/.memory` in order to prove the fence bites -- so proving the fence works pollutes the exact store the fence protects.

**How to avoid:** seed the non-hermetic fixture against a **sandboxed `HOME`** (the technique used for the census in Finding 4): point `HOME` at a `mkdtemp` root, let the fixture leak into THAT, and have the fence hash the sandboxed store. The fence then observes a real mutation caused by a real leak, with zero risk to the developer's store. This is a `must_catch` / `must_not_catch` pair in the Phase 236-04 idiom (STATE.md:66).

**Warning signs:** the fixture's `expected-red` path has no `HOME` or `MINDRIAN_ROOMS_HOME` override.

### Pitfall 7: Assuming the running session picks up the fix

**What goes wrong:** the fix lands on `main`, a manual end-to-end check is run in the current session, nothing changes, and time is lost hunting a phantom bug.

**Why it happens:** standing HARD RULE (personal memory `feedback_dev_repo_fix_not_live_until_released.md`, proven by four independent occurrences over three weeks, open RCA at `.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`): a commit on `main` is NOT live until a release ships AND is picked up. A running session never hot-reloads. Hooks are loaded from the plugin install cache.

**How to avoid:** all SC1 verification runs the scripts **directly from `/home/jsagi/dev/MindrianOS-Plugin/`** with an explicit `MINDRIAN_ROOMS_HOME` and `CLAUDE_ACTIVE_ROOM`, as every probe in this research did. Never conclude anything from live in-session hook behavior.

### Pitfall 8: `state.record-session` corrupting tracking files

**What goes wrong:** `gsd-tools.cjs state.record-session` overwrites `stopped_at` / `last_activity` with a stale unrelated value read from the Session Continuity block instead of the passed argument.

**Why it happens:** open bug, `.planning/debug/gsd-phase-complete-cross-phase-corruption.md`. Hit and hand-corrected **four separate times** during Phase 236 alone (STATE.md:36) and again in 239.

**How to avoid:** hand-edit `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` directly, `git diff`-review every write, confirm scope to Phase 240's own lines. This is the pattern the last three phases converged on. Also note the harness classifier that blocks any Bash argv containing the literal token "complete" (hit in 236 and 237).

### Pitfall 9: Worktree base mismatch on parallel dispatch

**What goes wrong:** the first parallel wave FATALs on a worktree base mismatch.

**Why it happens:** `Agent(isolation="worktree")` bases new worktrees off `origin/main`, not local `HEAD`. This repo pushes only at release time, so local `main` runs far ahead (203 commits at Phase 239, STATE.md:26).

**How to avoid:** `config.json` sets `use_worktrees: false`, so this should not bite. But `parallelization: true`, so if any dispatch does use worktree isolation, push local `main` to `origin` (confirm a clean fast-forward first) BEFORE dispatching. Also note `references/personality/pws-lexicon-full.md`'s CRLF issue was renormalized in 239 and should not recur.

## Code Examples

### Reading the manual-override state the way production already does

```javascript
// Source: lib/hmi/jtbd-state.cjs:77-81 (exported at :198)
function manualOverrideActive(current) {
  if (!current || typeof current !== 'object' || !current.expires_at) return false;
  const expiresMs = Date.parse(current.expires_at);
  return !Number.isNaN(expiresMs) && expiresMs > Date.now();
}

// Already used in production for exactly this question:
// Source: scripts/jtbd-command.cjs:762-765
const priorOverrideActive = !!(mod._internal
  && typeof mod._internal.manualOverrideActive === 'function'
  && mod._internal.manualOverrideActive(state));
```

### What `setCurrent` actually persists (the round-trip surface MEM-01 must fix)

```javascript
// Source: lib/hmi/jtbd-state.cjs:132-141
const newCurrent = {
  jtbd: jtbd, confidence: confidence, entered_at: nowIso,
  evidence: evidence,
  expires_at: manual
    ? new Date(now.getTime() + DEFAULT_STALENESS_HOURS * MS_PER_HOUR).toISOString()
    : null,
};                                  // <-- no turn_count, no manual_set, no trigger
const transitionRow = {
  from: fromJtbd, to: jtbd, trigger: trigger, at: nowIso, evidence: evidence,
};                                  // <-- `trigger` lives ONLY here
```

Live-confirmed shape after a real `/mos:jtbd set`: `current keys: jtbd,confidence,entered_at,evidence,expires_at`.

### The gate that reads fields that are never written

```javascript
// Source: lib/hmi/across-session-memory.cjs:392-400
const turnCount = (typeof cur.turn_count === 'number')
  ? cur.turn_count                                          // never a number today
  : ((withinSessionState.history || []).filter(h => h && h.to === cur.jtbd).length);
const manual = cur.manual_set === true || cur.trigger === 'manual';   // always false

if (!manual && turnCount < NOISE_FLOOR_TURNS) return null;            // NOISE_FLOOR_TURNS = 3
if (!manual && (typeof cur.confidence === 'number' ? cur.confidence : 0) < NOISE_FLOOR_CONFIDENCE) return null;
```

### The event-count-in-a-window idiom (the alternative counter, for the Canon Part 7 record)

```javascript
// Source: lib/core/venture-shape-nudge.cjs:106-107, :138-158
const sinceMs = Date.now() - (24 * 60 * 60 * 1000);
recent = navigation.findRecentChanges(db, sinceMs, { limit: 200 });
// ...
let turnCount = 0;
for (const event of recent) {
  if (!event || event.eventType !== 'f_selector_decision') continue;
  const props = event.properties || {};
  if (props.venture_classified === true) turnCount += 1;
}
const surface = turnCount >= threshold;        // VENTURE_NUDGE_THRESHOLD = 3
```

Precedented, but requires a per-turn event that does not exist today. Documented for completeness, not recommended.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| `writeGraphEdge` -> `graph-edge-pending.log`, "drained by Phase 103-05 PostToolUse" | `logGraphTransition` -> `navigation.logJtbdTransition` -> `memory_events 'jtbd_transitioned'` | commit `3c9afa2e`, 2026-07-28 | **MEM-02's root fix is already shipped.** ROADMAP SC2 predates it and needs reframing. |
| `rebuildGraph` ran unconditional `DELETE FROM edges; DELETE FROM nodes;` | `clearIndexerOwnedRows` with a frozen ownership allowlist | Phase 236 GRAPHDB-01, closed 2026-07-29 | **MEM-02's "survive rebuildGraph" half is already true.** The HARD dependency is satisfied. |
| `engines.node >= 22.13.0` (module-unflagging floor) | `>= 22.16.0` (the floor where `timeout` actually works) | Phase 236 GRAPHDB-03, 2026-07-29 | Any new `openRoomDb` reasoning must use 22.16.0. On 22.13-22.15 `timeout: 5000` is silently discarded. |
| `jtbd_transitioned` `kind` documented as `set`/`override`/`clear` | ALSO `promote`/`park`/`complete` (across-session lifecycle) | 2026-07-28, `memory-events.cjs:265-273` | `kind` is a free-text scalar, NOT enum-enforced. The doc comment is the source of truth. If Phase 240 adds a kind value, widen that comment in the same change. |
| `gsd-tools.cjs state.*` write verbs | Hand-edited tracking files, `git diff`-reviewed | Converged during Phase 236, reaffirmed in 239 | Use hand edits. See Pitfall 8. |
| `runPreCommit` hard-fail | Advisory WARN with `--strict` / `MINTO_PRECOMMIT_STRICT` opt-in | Phase 241-04 | A missing MINTO.md or `governing_thought` warns rather than blocking commits. |

**Deprecated / outdated, do not reintroduce:**
- `HAS_JTBD` as an edge type. Zero hits in tracked source; not a member of `ALLOWED_EDGE_TYPES` (`lib/core/navigation/edges.cjs:32`); no JTBD node type exists to anchor it to.
- `graph-edge-pending.log` as a live queue. Producer deleted; 13 orphan lines frozen.
- `better-sqlite3` idioms (`db.transaction(fn)`, `fileMustExist`). Not present on `DatabaseSync`.
- The claim "Drained by Phase 103-05 PostToolUse". Corrected in three places by commit `3c9afa2e`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | Yes | **v22.23.1** (floor is `>=22.16.0`) | - |
| `node:sqlite` `DatabaseSync` | `room.db` / memory_event assertions | Yes | built-in, unflagged, `timeout` honored | - |
| Bash | aggregators, the leaking shell suite | Yes | - | - |
| `python3` | the leaking suite's registry cleanup fallback (`test-jtbd-auto-anchor-empirical.sh:73`) | Yes | - | If the hermeticity fix moves to a temp root, the Python cleanup path becomes largely unnecessary (a `rm -rf` of the temp root replaces it). Worth simplifying. |
| `git` | commits, mutation revert | Yes | - | - |
| **Context7 MCP** (`mcp__*Context7__*`) | `node:sqlite` transaction-semantics grounding (mandated) | **NO** | - | **Discharged two ways:** (1) live observation on v22.23.1 (the `rebuildGraph` survival probe in Finding 2); (2) the in-repo, already-Context7-grounded `.planning/phases/236-*/236-RESEARCH.md:134, :156, :267, :777`. |
| **`ctx7` CLI** | Context7 fallback | **NO** (not on PATH) | - | Same as above. Did NOT `npx --yes` it (forbidden: silently executes unverified packages). |
| **langtalks-graph-expert MCP** | agent/LLM memory-engineering concept grounding (mandated) | **NO** | - | Not consultable this dispatch. **Declared as a gap, not papered over.** See Open Questions Q1. |
| Brain MCP | not on this path | n/a | - | `across-session-memory.cjs:30-31`: this module does not query Brain. |

**Missing dependencies with no fallback:** none that block execution.

**Missing dependencies with fallback:** both mandated MCP grounding legs. Both returned `No such tool available`, which is the **documented upstream tool-stripping bug for agents with a `tools:` frontmatter restriction** (anthropics/claude-code#13898). This is the SAME condition Phase 236 recorded twice (STATE.md:48: "Context7 MCP tools were absent from this executor's tool set ... and `ctx7` is not on PATH, the same condition 236-01 recorded. Discharged by live observation instead"). Every substantive claim in this document is instead grounded in a file:line read or a live observation run this session, which for a phase entirely about this repo's own code is the stronger form of evidence.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None.** Plain `node` scripts using `node:assert/strict` plus a hand-rolled `ok`/`fail` pass counter, and plain `bash` suites. No jest, no vitest, no mocha anywhere. |
| Config file | none (by design) |
| Phase aggregator | `tests/run-all-<phase>.sh` -- **114 exist**; `tests/run-all-240.sh` does **not** (Wave 0) |
| Best exemplar to copy | `tests/run-all-236.sh` -- glob discovery (`tests/test-236-*`, both `.cjs` and `.sh`), expected names enumerated in the header so absence is visible by reading, `found -eq 0` anti-vacuity guard, `set -uo pipefail` (NOT `-e`) |
| Quick run command | `node tests/test-240-<name>.cjs` |
| Full suite command | `bash tests/run-all-240.sh` |
| Regression suites to re-run | `bash tests/run-all-236.sh` (currently PASS=12 FAIL=0), `bash tests/run-all-127.3.sh` (contains the leaking suite), `node tests/test-across-session-memory.cjs` (36/36; class 11's multi-process race is pre-existing flaky timing), `node tests/test-jtbd-transition-graph-wiring.cjs` (6 tests/14 assertions), `node tests/test-memory-hook-integration.cjs` (10/10), `node tests/test-129-spine-substrate.cjs` (15/15), `node tests/test-memory-command.cjs` (**24/26 expected**; 2 Brain Mode A failures are pre-existing), `node tests/test-150-brain-egress.cjs` (MEM-04 zero-prose invariant) |

### Phase Requirements -> Test Map

| Req | Behavior to prove | Test type | Automated command | Exists? |
|-----|-------------------|-----------|-------------------|---------|
| MEM-01 | N consecutive same-topic turns through the REAL `jtbd-update.cjs` hook produce a Layer 2 `in_flight` row (seeded room, operator in the target JTBD's affinity set, `MINDRIAN_ROOMS_HOME` hermetic) | integration | `node tests/test-240-jtbd-continuous-promotion.cjs` | **No -- Wave 0** |
| MEM-01 | Mutation: restoring the topic-change-only trigger (re-instating the unconditional `return` at `jtbd-update.cjs:167-170`) turns the above red | mutation | manual revert + re-run, documented in the plan | **No -- Wave 0** |
| MEM-01 | Manual-override write-then-read round-trip: after `/mos:jtbd set X`, the fields the gate at `across-session-memory.cjs:395` checks are present in `current` AND `promoteIfEligible` promotes at `turn_count = 1` | unit + integration | `node tests/test-240-jtbd-manual-override-roundtrip.cjs` | **No -- Wave 0** |
| MEM-01 | Non-vacuity: the test asserts a classification actually occurred (not `below_threshold`) before asserting promotion | guard inside the above | same command | **No -- Wave 0** |
| MEM-02 | promote/park/complete each write a real `jtbd_transitioned` memory_event, and each row survives a real `rebuildGraph` with identical id and byte-identical properties | integration | `node tests/test-240-jtbd-event-survives-rebuild.cjs` | **No -- Wave 0** (partially covered: `test-jtbd-transition-graph-wiring.cjs` proves the write; `test-236-rebuild-preserves-journal.cjs` proves generic survival; **no test joins the two**) |
| MEM-02 | Mutation: adding `'memory_event'` to `INDEXER_OWNED_NODE_TYPES` turns the above red (**not** removing the transaction wrap -- see Pitfall 4) | mutation | manual edit + re-run, documented in the plan | **No -- Wave 0** |
| MEM-02 | The retired `graph-edge-pending.log` is never re-created by any promote/park/complete | absence assertion | folded into the above | Partially: `test-jtbd-transition-graph-wiring.cjs` test 6 already asserts this |
| MEM-03 | Running the full JTBD suite leaves the ENTIRE `.memory/` tree byte-identical (recursive hash of every file plus the path set, before and after) | fence | `bash tests/test-240-memory-store-hermetic-fence.sh` | **No -- Wave 0** |
| MEM-03 | A deliberately seeded non-hermetic fixture turns the fence red, seeded against a **sandboxed HOME** so proving the fence never pollutes the real store (Pitfall 6) | must_catch / must_not_catch pair | same command | **No -- Wave 0** |
| MEM-03 | `tests/test-jtbd-auto-anchor-empirical.sh` is hermetic both standalone AND through `tests/run-all-127.3.sh` | integration | `bash tests/run-all-127.3.sh` under a sandboxed HOME | **No -- Wave 0** |

### Sampling Rate
- **Per task commit:** the single new `tests/test-240-*` file that task touches.
- **Per wave merge:** `bash tests/run-all-240.sh` plus `bash tests/run-all-236.sh` (the HARD-dependency regression) plus `node tests/test-across-session-memory.cjs`.
- **Phase gate:** `bash tests/run-all-240.sh` green, `bash tests/run-all-127.3.sh` green, `node scripts/doctor.cjs --acceptance`, `node scripts/build-connector-registry.cjs --check`, zero em-dashes across all phase-touched files, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-240.sh` -- glob-discovery aggregator in the `run-all-236.sh` shape, with a `found -eq 0` anti-vacuity guard and expected names enumerated in the header.
- [ ] `tests/test-240-jtbd-continuous-promotion.cjs` -- MEM-01 SC1 leg 1. Must include the operator-affinity setup and the classification non-vacuity assertion (Pitfall 1).
- [ ] `tests/test-240-jtbd-manual-override-roundtrip.cjs` -- MEM-01 SC1 leg 2.
- [ ] `tests/test-240-jtbd-event-survives-rebuild.cjs` -- MEM-02 SC2, joining the promote path to the rebuild path. Reuse `tests/helpers/fixture-room-236.cjs` (`buildFixtureRoom236`, `countPopulations`, `readNodeRow`).
- [ ] `tests/test-240-memory-store-hermetic-fence.sh` -- MEM-03 SC3, recursive `.memory/` hash plus the sandboxed-HOME must_catch pair.
- [ ] Possible shared helper: `tests/helpers/hermetic-rooms-home.cjs`, only if two or more of the above genuinely need it. Otherwise reuse `withTmpRoot` verbatim (Canon Part 7).
- [ ] Framework install: **none needed.**

## Security Domain

Local-only phase. No network surface, no new authentication, no new user input path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface. Layer 2 memory is per-USER by filesystem scope (`across-session-memory.cjs:100`, `:119-121`), not by credential. |
| V3 Session Management | no | No sessions. "Session" here means a Claude Code conversation, not an authenticated session. |
| V4 Access Control | **yes (indirect)** | **Canon Part 8 LOCAL -> BRAIN boundary.** memory_event payloads must carry scalars and enum handles only, never prose. `logGraphTransition`'s payload (`across-session-memory.cjs:366-372`) is already compliant: `to`, `kind`, `roomSlug`, `created_by`, `source_path`, plus scalar extras. **Keep it that way.** Regression guard: `node tests/test-150-brain-egress.cjs` (MEM-04 zero-prose invariant). |
| V5 Input Validation | **yes** | `roomSlug` is used to resolve a filesystem path (`resolveRoomDirForSlug`, `:339-353`). Today it is looked up in the registry by exact match and never concatenated raw, so there is no traversal surface. **A change that derives `roomDir` from `roomSlug` by string join would introduce one** -- note the existing defensive fallback at `isRoomOptOut` `:252` (`path.join(ROOMS_HOME(), roomSlug)`) which DOES join raw and is the one place worth a second look. |
| V6 Cryptography | **yes (hash only)** | MEM-03's fence needs a content hash. Use `node:crypto` `createHash('sha256')`. Never hand-roll. Note this is integrity checking, not a security control. |
| V7 Error Handling / Logging | **yes** | The graceful-degradation envelope IS the control here: `logStderr` truncates messages to 200 chars (`:86`), and audit lines carry only `timestamp | roomSlug | action | jtbd` (`:266`) -- no prose. Preserve both. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---------|--------|---------------------|----------------------|
| SQL injection into `room.db` | Tampering | Parameterized statements only, via the `navigation.cjs` chokepoint | Already held: `memory-events.cjs:724` uses bound parameters; `clearIndexerOwnedRows` never interpolates its constants (`lazygraph-ops.cjs:117-118` says so explicitly). Do not add raw SQL. |
| Path traversal via a crafted room slug | Tampering | Registry exact-match lookup, not string join | Held at `resolveRoomDirForSlug`. Watch `isRoomOptOut:252`. |
| Torn write / lost update on the shared global store | Tampering | `O_EXCL` lockfile + 2s TTL stale-lock recovery + tmp+rename | Already implemented, `across-session-memory.cjs:154-231`. A trigger change that fires promotion far more often **increases contention on this lock** -- see Open Questions Q3. |
| Unbounded log growth (local DoS) | Denial of Service | FIFO bounds | `audit.log` bounded at 10000 with a 1% sample-rate truncation (`:72-74`, `:269`); per-room arrays bounded at 100 with archive spillover (`:298-327`). **A much-more-frequent promotion path pushes both harder.** Q3. |
| Test writing into the live user store | Tampering | Hermetic root override + a gate, not habit | **This is MEM-03.** One confirmed leak. |
| User prose leaking to Brain | Information Disclosure | Canon Part 8 egress guard | Not on this path (`:30-31`). Regression-guarded by `test-150-brain-egress.cjs`. |

## Assumptions Log

Claims tagged `[ASSUMED]` above. Everything else is a file:line read or a live observation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended reframing of ROADMAP SC2 preserves the criterion's intent and will be accepted | Finding 2 | HIGH if rejected. If the user genuinely wants the RCA's Option A drainer (a real `HAS_JTBD` edge, a new frozen edge type, a new node type, a new hook), MEM-02's scope multiplies and the RCA's human-approved decision is reversed. **This is the single most important item to settle in `/gsd-discuss-phase` before planning.** |
| A2 | A persisted `current.turn_count` is the preferred second trigger over a dwell threshold or an event-count-in-window | Finding 1 | MEDIUM. All three are viable and grounded. The counter reuses a dead read path and needs the least new surface, but the user may prefer the zero-schema-change dwell approach. Cheap to switch at plan time; expensive after. |
| A3 | `manualOverrideActive(current)` is the intended semantics of "manual override" for the Layer 2 gate | Finding 1 | MEDIUM. It is the predicate production already uses for this question, but SC1's wording ("persists exactly the fields its own gate later checks") could be read as demanding the write side change instead. Recommended fix does both; if only one is wanted, the choice is the user's. |
| A4 | `tests/test-navigation-chokepoint-hook.cjs`'s write to `$HOME/.mindrian/telemetry/` is OUT of MEM-03's scope | Finding 4 | LOW. Different store, and MEM-03 says "memory store". But it is the same defect class and a reasonable person could scope it in. Cheap to add; should be an explicit call, not a silent omission. |
| A5 | An immediate promotion on `/mos:jtbd set` is NOT required by SC1 | Finding 1 | MEDIUM. `jtbd-command.cjs` has no `promoteIfEligible` call. If immediate promotion IS wanted, that is an additional call site and an additional test. |
| A6 | The unrelated working-tree modifications (statusline files) will be resolved or stashed before Phase 240 executes | Runtime State Inventory | LOW-MEDIUM. If they persist, any `git diff --quiet` style plan assertion trips on foreign changes and foreign files risk being swept into a Phase 240 commit. |
| A7 | The `MINDRIAN_MCP_FIRST` daemon path does not carry its own separate copy of the JTBD promotion trigger | Architectural Responsibility Map | MEDIUM. Phase 241-05 found exactly this class of gap: the shared `mindrian-core` Stop path was blind on Desktop, Cowork, AND CLI-under-the-flag. **Not verified this session.** A Tri-Polar parity check belongs in the plan. |

## Open Questions

1. **Both mandated MCP grounding legs were unavailable. Should an external leg be fired?**
   - What we know: `mcp__langtalks-graph-expert__*` and `mcp__*Context7__*` both returned `No such tool available` (the documented upstream tool-stripping bug for agents with a `tools:` frontmatter restriction); `ctx7` is not on PATH. This is the identical condition Phase 236 recorded twice (STATE.md:48).
   - What is unclear: whether an external conceptual leg (WebSearch on working-memory-promotion triggers, dead-letter-queue consumption, hermetic isolation for stateful systems) would add anything beyond what the in-repo evidence already establishes.
   - Recommendation: **do not fire WebSearch unasked.** The standing MCP-stack-awareness HARD RULE requires checking the stack and ASKING before web research. For a phase entirely about this repo's own code, file:line reads and live observation are the more authoritative sources anyway, and this document uses them throughout. If the navigator wants an external leg, authorize it explicitly and it can be added in `/gsd-discuss-phase`.

2. **What is the right threshold for "continuous same-topic work"?**
   - What we know: the existing turn floor is 3 (`NOISE_FLOOR_TURNS`, `across-session-memory.cjs:76`) and the confidence floor is 0.6 (`:77`). The repo's one other "how many turns" threshold is also 3 (`VENTURE_NUDGE_THRESHOLD`, `venture-shape-nudge.cjs:59`).
   - What is unclear: whether 3 same-topic turns is the right bar once the counter actually grows, or whether it will now fire too eagerly. Nobody has ever observed the promotion firing on real work, so there is no empirical baseline.
   - Recommendation: keep 3 for continuity with both existing thresholds, and make it a named constant so a follow-up can tune it from real data. Do NOT invent a new number without evidence.

3. **Does a much-more-frequent promotion path stress the lock and the FIFO bounds?**
   - What we know: today promotion effectively never fires. After the fix it could fire on most turns, in every open room. The global store is guarded by an `O_EXCL` lockfile with a 200ms retry budget and an unsafe read-merge-write fallback when the lock cannot be acquired (`:191-193, :212-231`). `test-across-session-memory.cjs` class 11 already has a known-flaky multi-process race check.
   - What is unclear: contention behavior under a realistically higher write rate, especially in Cowork with concurrent rooms. Also whether `audit.log`'s 1%-sample truncation (`:269`) keeps pace.
   - Recommendation: the promotion is idempotent for an existing `in_flight` row (it updates `last_seen`/`turn_count` in place rather than appending, `:412-416`), which bounds the growth. Still, add a modest contention assertion to the MEM-01 test, and note the risk. Consider whether promotion should fire only when `turn_count` CROSSES the threshold rather than on every turn past it -- that alone reduces write volume to roughly one per topic.

4. **Tri-Polar parity: does the daemon path need the same fix?** (A7)
   - What we know: `hooks/hooks.json:3` documents that under `MINDRIAN_MCP_FIRST` several hooks dispatch to `lib/mcp/adapter-client.cjs` instead of running locally. Phase 241-05 found the shared `mindrian-core` Stop path was blind on all three surfaces for the MINTO guardian.
   - What is unclear: whether the JTBD promotion path has an analogous daemon-side copy. **Not verified this session.**
   - Recommendation: a plan task should grep `lib/mcp/` for a JTBD promotion or `jtbd-update` equivalent before the phase closes, and either fix parity or state explicitly that the flag-ON path routes through the same `across-session-memory.cjs` module.

## Sources

### Primary (HIGH confidence -- live observation and first-party source read on current `main`)
- **Live probe: MEM-02 end-to-end survival.** promote -> `jtbd_transitioned` memory_event -> `rebuildGraph` -> row survives with identical id; artifacts=1. node v22.23.1, 2026-07-30.
- **Live probe: MEM-01 leg A.** 12 consecutive same-topic turns through the real hook -> 11 `no transition` early returns, 1 failed promotion attempt, zero Layer 2 rows, no `room.db`.
- **Live probe: MEM-01 leg B.** Real `/mos:jtbd set` -> `current keys: jtbd,confidence,entered_at,evidence,expires_at`; `manual_set` and `trigger` both `undefined`; gate `manual = false`; `promoteIfEligible` returns null.
- **Live probe: classifier gate.** Fresh room -> `below_threshold, top:decide-pursue@0.60` x12; after `operator set BUILD_ROOM` -> `jtbd=decide-pursue conf=0.800` on turn 1.
- **Live census: MEM-03.** 16 suites run with sandboxed `HOME`; exactly one leaks into `$HOME/MindrianRooms`, with its 9-path footprint enumerated.
- **Live read: the real store.** `~/MindrianRooms/.memory/{jtbd-history.json, audit.log, graph-edge-pending.log}`.
- **Live run:** `bash tests/run-all-236.sh` -> PASS=12 FAIL=0 SKIP=0.
- Source files read in full or in the cited ranges: `lib/hmi/across-session-memory.cjs` (643 lines, full), `lib/hmi/jtbd-state.cjs` (200 lines, full), `scripts/jtbd-update.cjs:1-269`, `scripts/memory-resume-nudge.cjs` (234 lines, full), `scripts/jtbd-command.cjs:680-800`, `lib/core/lazygraph-ops.cjs:30-195`, `lib/core/navigation/spine-events.cjs:12-38,178-210,445-456`, `lib/core/navigation/memory-events.cjs:255-300,693-742`, `lib/core/venture-shape-nudge.cjs:30-164`, `lib/hmi/jtbd-classifier.cjs:96-215`, `lib/core/memory-ops.cjs:130-200`, `hooks/hooks.json` (relevant registrations), `tests/test-across-session-memory.cjs:85-115`, `tests/test-236-rebuild-preserves-journal.cjs:1-90`, `tests/test-jtbd-auto-anchor-empirical.sh:40-80,210-240`, `tests/run-all-236.sh:1-45`, `tests/run-all-127.3.sh:30-60`, `lib/hmi/jtbd-taxonomy.json` (entries + affinity).
- `git log --oneline -- lib/hmi/across-session-memory.cjs` -> `3c9afa2e`, `d0eae787`.

### Secondary (HIGH-MEDIUM -- in-repo authoritative planning artifacts, themselves independently grounded)
- `.planning/debug/resolved/graph-edge-pending-undrained-dead-letter-queue.md` (269 lines, read in full). Status `resolved`; fix APPLIED. Its line references are STALE relative to current `main` (see the Finding 2 table); its reasoning and decisions are current.
- `.planning/phases/236-*/236-RESEARCH.md:134, :156, :267, :777` -- the Context7-grounded `node:sqlite` claims (no `transaction(fn)`; `timeout` floor v22.16.0 with a live `PRAGMA busy_timeout` readback).
- `.planning/STATE.md:19-53` -- Phase 239 and 236 closures: the hand-edit tracking discipline, the `state.record-session` corruption bug, the worktree-base gotcha, and the "wrap removal does not redden survival" empirical result.
- `.planning/ROADMAP.md:170-181` (Phase 240) and `:202` (the Phase 241 planner note on the false "never wired" conclusion).
- `.planning/REQUIREMENTS.md:45-47, :90-92` (MEM-01/02/03).
- `.planning/debug/knowledge-base.md:427-432`.
- `./CLAUDE.md` plus `.claude/includes/{architecture,moat,decisions,release-process}.md`.

### Tertiary (LOW -- declared gaps, not used as evidence)
- **Context7 MCP:** unavailable (`No such tool available`). `ctx7` not on PATH. Not used.
- **langtalks-graph-expert MCP:** unavailable (`No such tool available`). Not consultable this dispatch. Not used, not fabricated.
- **WebSearch:** deliberately NOT fired, per the standing MCP-stack-awareness HARD RULE (check the stack and ask first). See Open Questions Q1.

## Metadata

**Confidence breakdown:**
- **MEM-01 root cause and mechanism: HIGH.** Live-proven twice (the 12-turn probe and the manual-override probe), with every link in the deadlock traced to a file:line, and corroborated by the real store's empty `rooms` object after two months.
- **MEM-01 recommended fix shape: MEDIUM-HIGH.** The read side already exists and is dead code, which strongly constrains the design, but the exact write-side placement and the threshold are legitimate planner/user choices (A2, Q2).
- **MEM-02 current state: HIGH.** Verified against HEAD, not against the RCA text; the end-to-end survival claim was proven by a live probe this session.
- **MEM-02 scope tension (SC2 unsatisfiable as worded): HIGH** on the fact, **MEDIUM** on the recommended reframing being accepted (A1). This needs a human decision.
- **MEM-03 census: HIGH.** Measured across 16 suites with a sandboxed HOME, not inferred. The "only one leaker" conclusion is empirical.
- **MEM-03 fence design: HIGH.** The "hash the whole `.memory/` tree" requirement is derived from directly observed residue (5 leaked `audit.log` lines that a `jtbd-history.json`-only hash would have missed).
- **Pitfalls: HIGH.** Pitfalls 1 and 4 were each demonstrated live this session; 8 and 9 are recorded from the last two phase closures.
- **Tri-Polar daemon parity: LOW (A7, Q4).** Not verified. Explicitly flagged for a plan task.

**Research date:** 2026-07-30
**Valid until:** 2026-08-13 (14 days). Shorter than the usual 30 because this codebase moves fast: MEM-02's root fix landed two days before this research, Phase 236 closed one day before, and Phase 239 closed the same day. **Re-verify the Finding 2 line-number table against HEAD before executing any plan** -- the RCA's own line numbers went stale in under two weeks.
