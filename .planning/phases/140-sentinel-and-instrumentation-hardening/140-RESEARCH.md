# Phase 140: Sentinel & Instrumentation Hardening - Research

**Researched:** 2026-06-04
**Domain:** Local sentinel scripts (bash + Node CJS + Python) + SQLite room.db write path + PostToolUse telemetry hook
**Confidence:** HIGH (all 5 bugs reproduced or deterministically confirmed against live code today)
**Milestone:** v1.13.1 "Larry Reaches" (LARRYREACH)

## Summary

This phase fixes the 5 scout-surfaced bugs (HARD-01..05) that block `/mos:scout` from being safe to auto-fire on a schedule (the Phase 145 hard prerequisite). The 5 bugs were recorded in a 2026-05-10 scout run (SEED-008). This research re-validated EACH against the live tree on 2026-06-04. **All 5 are still live.** Two were reproduced with the exact production code (HARD-01 arithmetic abort, HARD-02 NOT NULL failure); one is deterministically confirmed by code-reading plus the absence of any env-var setter and the CHANGELOG's own admission (HARD-04); two are confirmed by direct source inspection of the scanner skip-lists and the monitor's scan scope (HARD-03, HARD-05).

There is no library research to do here. This is a defect-fix phase against shipped MindrianOS scripts. The "standard stack" is the existing plugin stack (bash sentinels, Node `node:sqlite` DatabaseSync via `lib/core/lazygraph-ops.cjs`, Python HSI scripts). No new dependencies. No external services. Every fix is a LOCAL edit to an existing file plus a regression test.

**Primary recommendation:** Fix each bug at the cited file:line, add a focused regression test per bug (the test infra already exists -- `node:test` style `.test.cjs` files in `lib/` + bash smoke harnesses in `tests/`), and gate the scout HSI-to-graph step so a write failure surfaces instead of being swallowed by `2>/dev/null || true`. All work stays LOCAL (Canon Part 8: zero Brain egress -- confirmed below).

## User Constraints

> No CONTEXT.md exists for this phase yet (`has_context: false`). The constraints below are derived from REQUIREMENTS.md (LARRYREACH section), SEED-008, the SLICE-PHASE-MAP, and CLAUDE.md / Canon. The discuss-phase step (if run) may add or lock further decisions.

### Locked Decisions (from REQUIREMENTS.md HARD-01..05)
- **HARD-01** fix `sentinel-health-check` line 132 arithmetic syntax error
- **HARD-02** fix `hsi-to-graph.cjs` `NOT NULL constraint failed: nodes.source_path` (HSI edges never reach room.db)
- **HARD-03** exclude `.heal-backup/` from the HSI / reverse-salient scanner (backup-dir pollution)
- **HARD-04** query-efficiency telemetry hook (Phase 88.1-16) captures events instead of logging 0
- **HARD-05** deadline monitor scope includes `.planning/STATE.md` phase deadlines, not just `funding/` + `opportunity-bank/`

### Project Constraints (from CLAUDE.md / Canon)
- **Workspace guard:** all work runs from `/home/jsagi/dev/MindrianOS-Plugin/` (this is the canonical dev workspace; `~/.claude/plugins/` is the install cache and must never be edited).
- **No em-dashes** anywhere (HARD RULE). Hyphens only.
- **Tri-Polar rule:** evaluate every fix across CLI / Desktop / Cowork. (See Tri-Polar section -- these sentinels are CLI-script-driven; Desktop/Cowork invoke them via the same `/mos:scout` command surface and hooks.json bundle, so a fix at the script layer fixes all three.)
- **Canon Part 8 (Graph Boundary):** these are LOCAL sentinels. No fix may add Brain egress. Confirmed below: none of the 5 surfaces touch the Brain.
- **Reuse before build (Canon Part 7):** fix in place; do not introduce a new sentinel framework.
- **Release process:** any user-facing fix bumps the version in lockstep (CHANGELOG + plugin.json + package.json + tag + marketplace).

### Deferred Ideas (OUT OF SCOPE)
- Scheduled auto-firing of scout (that is Phase 145 SCHED-01/02; Phase 140 only makes scout SAFE to schedule).
- Wiring `MOS_COMMAND_CONTEXT` into every `/mos:*` command surface as a general mechanism is the minimal HARD-04 fix; a full Navigation-Engine-driven command-context propagation is Phase 144 scope.
- Bi-temporal edge model / facts-table resurrection (SLICE-A) -- not part of HARD-01..05.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARD-01 | fix `sentinel-health-check` line 132 arithmetic syntax error | Reproduced exact production failure: `scripts/sentinel-health-check:132` aborts under `set -euo pipefail` when a snapshot has zero edge-keyword matches, because `grep -ciE ... \|\| echo "0"` yields a two-line `0\n0`. Fix + warning-signs documented in Pitfalls. |
| HARD-02 | fix `hsi-to-graph.cjs` NOT NULL constraint failed: nodes.source_path | Reproduced against a Phase-109-migrated `room.db`: the bare `INSERT INTO nodes (id, type, properties)` at `scripts/hsi-to-graph.cjs:68-70` (and the Section upsert at :116-117) fails `NOT NULL constraint failed: nodes.source_path`. The migrated schema requires `source_path/created_by/created_at/last_seen_at` NOT NULL. Correct insert column-set documented from `lib/core/navigation/evidence-claim.cjs:110`. |
| HARD-03 | exclude `.heal-backup/` from HSI / reverse-salient scanner | `compute-hsi.py:100` `SKIP_DIRS` and `rs-engine.py:119` `SKIP_DIRS` both omit `.heal-backup`. `.heal-backup/<TS>/` is created by `heal-command.cjs:937,1021` and exists live in the dogfood room. The walker descends into it and indexes backup duplicates. |
| HARD-04 | query-efficiency telemetry hook captures events instead of logging 0 | The hook (`scripts/query-efficiency-telemetry.cjs:285-286`) hard-gates on a `/mos:` slash-command context that nothing in the repo ever sets. Grep confirms zero setters of `CLAUDE_SLASH_COMMAND` / `MOS_COMMAND_CONTEXT`. The hook always `exitSilent()`. CHANGELOG:2052-2057 documents this exact gap. |
| HARD-05 | deadline monitor scope includes `.planning/STATE.md` phase deadlines | `scripts/sentinel-deadline-monitor` scans only `$ROOM_DIR/funding/*/STATUS.md` (line 42) and `$ROOM_DIR/opportunity-bank/*.md` (line 84). It never reads `.planning/STATE.md`, so phase deadlines (e.g. NATO 2026-06-01) are invisible and it reports CLEAR. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Health-check drift arithmetic (HARD-01) | CLI script (bash) | - | `sentinel-health-check` is a pure bash sentinel; no UI tier. Output consumed by `/mos:scout` rendering. |
| HSI edge write to room.db (HARD-02) | Local data / SQLite (`room.db`) | CLI script | Write path is `hsi-to-graph.cjs` -> `lib/core/lazygraph-ops.cjs` (DatabaseSync). The schema contract is owned by the Phase 109 migration. |
| HSI / RS corpus scan (HARD-03) | CLI script (Python) | Local FS | `compute-hsi.py` / `rs-engine.py` walk the room filesystem; the skip-list is a filesystem-scan concern. |
| Query-efficiency telemetry (HARD-04) | CLI hook (PostToolUse) | Command surface | The hook fires on Read/Grep/Glob; the missing signal is command-context propagation from the `/mos:*` command layer into the hook env. |
| Deadline scan scope (HARD-05) | CLI script (bash) | Local FS + `.planning/` | The monitor walks room subtrees; extending scope to `.planning/STATE.md` is a scan-target addition. |

## Standard Stack

No new packages. This phase edits existing files in the shipped stack.

### Core (existing, unchanged)
| Component | Where | Purpose |
|-----------|-------|---------|
| Bash sentinels | `scripts/sentinel-*` | health-check, deadline-monitor, snapshot |
| Node `node:sqlite` DatabaseSync | `lib/core/lazygraph-ops.cjs`, `lib/core/room-db.cjs` | local room.db graph write/read |
| Python HSI | `scripts/compute-hsi.py`, `scripts/rs-engine.py`, `scripts/detect-reverse-salients.py` | corpus scan + scoring |
| PostToolUse hook | `scripts/query-efficiency-telemetry.cjs` (registered `hooks/hooks.json:195`) | LOCAL JSONL telemetry under `~/.mindrian/telemetry/` |
| scout aggregator | `scripts/scout-telemetry-aggregator.cjs` | reads the JSONL, renders median + top 5 |

**Installation:** none. No `npm install`, no `pip install`, no new dependency. **Package Legitimacy Audit is therefore N/A for this phase** (zero external packages added).

## Architecture Patterns

### System Architecture Diagram (the scout suite data flow)

```
/mos:scout  (commands/scout.md)
   |
   |-- bash sentinel-snapshot ROOM_DIR        -> .snapshots/STATE-<date>.md
   |
   |-- bash sentinel-health-check ROOM_DIR    -> reads STATE.md + latest snapshot
   |        |                                    -> arithmetic deltas  [HARD-01 aborts here, line 132]
   |        '-> .intelligence/health-<date>.md
   |
   |-- bash sentinel-deadline-monitor ROOM_DIR
   |        |   scans funding/ + opportunity-bank/  [HARD-05: misses .planning/STATE.md]
   |        '-> .intelligence/deadlines-<date>.md
   |
   |-- python compute-hsi.py ROOM_DIR --output .hsi-results.json
   |        |   os.walk(room) filtered by SKIP_DIRS  [HARD-03: .heal-backup not skipped -> dup artifacts]
   |        '-> .hsi-results.json (hsi_pairs + reverse_salients)
   |   python detect-reverse-salients.py ROOM_DIR   (reads .hsi-results.json, no own walk)
   |   node   hsi-to-graph.cjs ROOM_DIR 2>/dev/null || true
   |        |   openGraph() -> INSERT INTO nodes/edges
   |        '-> [HARD-02: NOT NULL constraint failed: nodes.source_path on a migrated room.db
   |             -> process.exit(1) -> swallowed by `|| true` -> edges silently never written]
   |
   '-- node scout-telemetry-aggregator.cjs
            reads ~/.mindrian/telemetry/query-efficiency.jsonl
            [HARD-04: file is empty / 0 events because the hook gate never opens]
```

### Pattern: correct node insert against the Phase-109 schema (for HARD-02)
The post-migration `nodes` table requires four NOT NULL columns the legacy insert omits. The canonical correct insert is the one already used by other Phase 109 writers:

```javascript
// Source: lib/core/navigation/evidence-claim.cjs:110 (live code, the correct pattern)
// INSERT INTO nodes
//   (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at)
// created_by must be one of: 'user','larry','import','brain','system'  (CHECK constraint)
// For hsi-to-graph, the correct values are:
//   source_path:   'system:hsi-to-graph'
//   created_by:    'system'
//   review_status: 'proposed'   (or leave DEFAULT)
//   created_at:    Date.now()
//   last_seen_at:  Date.now()
```
The Section-node upsert in `hsi-to-graph.cjs:116-117` and the HSI edge nodes must be widened to this column-set. Note the same bare-3-column pattern lives in `lib/core/lazygraph-ops.cjs` (the `indexArtifact` helper around :357-362 and the upserts at :729, :911) -- those are siblings of the same defect; scope decision for the planner: fix `hsi-to-graph.cjs` (the scout-surfaced site) at minimum, and decide whether to harden the `lazygraph-ops.cjs` helpers in the same wave (they fail identically on a migrated db when reached via `openGraph`, which does NOT run the Phase 109 migration -- see Pitfall 2).

### Anti-Patterns to Avoid
- **`grep -c ... || echo "0"`** for a numeric variable: `grep -c` prints `0` AND exits 1 on zero matches, so the `|| echo "0"` appends a SECOND line. The variable becomes `0\n0` and breaks `$(( ))`. Use `grep -c ...; true` then sanitize, or `| tr -dc '0-9' | head -c 8`, or `awk`/`wc -l` which exit 0. (HARD-01 root cause.)
- **`2>/dev/null || true`** around a write that can fail (scout line 164 wrapping `hsi-to-graph.cjs`): it converts a hard SQLite write failure into a silent no-op. The write bug (HARD-02) was masked for weeks because of this. Keep the swallow for graceful degradation, but the script itself should not exit 1 on the expected schema.
- **Gating a telemetry hook on an env signal nothing sets** (HARD-04): the hook is correct but unreachable. Either propagate the signal (`MOS_COMMAND_CONTEXT`) from the command layer, or relax the gate to a room-presence + tool-match condition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node insert column-set (HARD-02) | A new insert helper | Copy the column list + values from `lib/core/navigation/evidence-claim.cjs:110` (the live correct pattern) | The CHECK constraints on `created_by` and `review_status` are easy to violate; reuse the proven insert. |
| Numeric extraction from grep (HARD-01) | A custom parser | `wc -l` (exits 0) or `grep -c ...; true` + `tr -dc '0-9'` | Avoids the exit-code-1 double-zero trap entirely. |
| Phase deadline parsing (HARD-05) | A bespoke STATE.md parser | The existing frontmatter `grep -m1 '^deadline:'` pattern already in `sentinel-deadline-monitor:51` | Reuse the script's own extraction idiom; just add `.planning/STATE.md` as a scan target with its phase-deadline field names. |

**Key insight:** every one of these is a one-to-three-line fix in an existing file. The risk is regression, not complexity -- so the value is in the per-bug regression test, not in any new abstraction.

## Runtime State Inventory

> This is a defect-fix phase, not a rename/refactor. A full runtime-state inventory is not strictly required, but two items below matter because they determine whether a fix actually takes effect at runtime.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live `room.db` files exist in two states: UN-migrated 3-column `nodes` (e.g. `~/MindrianRooms/mindrianOS/.mindrian/room.db` today) AND Phase-109-migrated NOT-NULL `nodes` (any room exercised through the navigation spine). HARD-02 fires only on the migrated shape. | The HARD-02 fix must write the full NOT-NULL column-set so it works on BOTH shapes (a migrated db rejects the 3-col insert; an un-migrated db accepts the wider insert because extra columns simply do not exist -> so the fix must be schema-aware OR the writer must run the migration first). See Open Question 1. |
| Live service config | None. These sentinels read only local files. No external service config. | None. |
| OS-registered state | None today (CronCreate is deferred; `/mos:scout` is the manual trigger). Phase 145 will add scheduling -- out of scope here. | None. |
| Secrets / env vars | HARD-04 hinges on `MOS_COMMAND_CONTEXT` / `CLAUDE_SLASH_COMMAND` -- env var NAMES the hook reads but nothing sets. No secret values involved. | The fix sets/propagates `MOS_COMMAND_CONTEXT` (a context handle, not a secret) OR relaxes the gate. LOCAL only; Part 8 safe. |
| Build artifacts | `.heal-backup/<TS>/` directories are runtime artifacts created by `/mos:heal`; they accumulate in rooms and currently pollute HSI. The HARD-03 fix excludes them from the scan but does not delete them. | None beyond the skip-list edit. (Optional: a future heal-backup prune is out of scope.) |

**Telemetry file state:** `~/.mindrian/telemetry/query-efficiency.jsonl` does NOT exist on this box (verified) -> 0 events, exactly matching the HARD-04 symptom.

## Common Pitfalls

### Pitfall 1: HARD-01 fix that only handles the empty case, not the double-zero case
**What goes wrong:** A naive fix replaces `|| echo "0"` with a default that still produces a multi-line value, or only guards the empty-string case (which already coerces to 0 safely).
**Why it happens:** The empty-string case (`$(())` on `""`) silently yields 0, so it looks fine in a quick test. The actual failure is the TWO-LINE `0\n0` from `grep -c` exit-1.
**How to avoid:** Reproduce with a snapshot that has zero edge keywords (the `previous` snapshot in a fresh room). Sanitize every numeric capture: lines 81-82 (`bc` pipeline -> can emit empty), 85-86 (`grep -ciE || echo`), and the deltas at 118 + 132.
**Warning signs:** `syntax error in expression (error token is "0")` and `unbound variable` in the health-check output; script aborts before writing the report.

### Pitfall 2: HARD-02 fix that assumes openGraph runs the migration
**What goes wrong:** Adding `source_path` to the insert is necessary but not sufficient if you assume the db is always migrated. `hsi-to-graph.cjs` opens via `lib/core/lazygraph-ops.cjs openGraph()` which calls only `initSchema()` -- it does NOT run the Phase 109 migration (only `room-db.cjs openRoomDb()` does). So the writer can hit EITHER schema.
**Why it happens:** Two different open paths (`openGraph` vs `openRoomDb`) produce two different `nodes` schemas.
**How to avoid:** Make the writer robust to both: either (a) route `hsi-to-graph` through `openRoomDb` (which migrates, guaranteeing the wide schema and a valid insert), or (b) detect columns via `PRAGMA table_info(nodes)` and build the insert accordingly. Option (a) is cleaner and aligns with Canon Part 9 (room.db is the local mind; the migration is its contract).
**Warning signs:** `NOT NULL constraint failed: nodes.source_path` (migrated db) OR `table nodes has no column named source_path` (un-migrated db if you hardcode the wide insert without migrating).

### Pitfall 3: HARD-03 fixing only one scanner
**What goes wrong:** Adding `.heal-backup` to `compute-hsi.py:100` but forgetting `rs-engine.py:119` (or vice-versa) leaves one scan path still polluted.
**Why it happens:** There are two independent walkers with two independent `SKIP_DIRS` sets. `detect-reverse-salients.py` does NOT walk (it reads `.hsi-results.json`), so it inherits whatever `compute-hsi.py` produced -- fixing `compute-hsi.py` cleans the scout RS path, but the standalone `rs-engine.py` path (`/mos:find-*`) needs its own fix.
**How to avoid:** Fix BOTH `SKIP_DIRS` sets. Consider also adding `.snapshots`, `.intelligence`, `.heal` to both for consistency (they are other room-internal dot-dirs that should never be HSI artifacts) -- but scope that decision; HARD-03 only mandates `.heal-backup`.
**Warning signs:** reverse salients that are duplicates of one signal; artifact IDs containing `.heal-backup/` path segments.

### Pitfall 4: HARD-04 relaxing the gate in a way that breaks Canon Part 8
**What goes wrong:** Relaxing the `/mos:` context gate to "always fire" could start logging events for non-`/mos:` Read/Grep/Glob calls. The hook already restricts the JSONL to scalar counts + a LOCAL room slug (Part-8 safe), so over-logging is a noise/accuracy problem, not a leak -- but the cleaner fix is to actually propagate `MOS_COMMAND_CONTEXT` from the command surfaces so the 57x claim is measured on real `/mos:*` traffic.
**Why it happens:** The hook author (correctly, per the 2026-04-23 plan note + CHANGELOG:2052-2057) bet on Claude Code surfacing slash-command context in the PostToolUse envelope (branch a). It still does not. Branches (b)/(c) require an env var nobody sets.
**How to avoid:** The minimal correct fix is to export `MOS_COMMAND_CONTEXT=/mos:<name>` from the `/mos:*` command execution surface (the commands run bash blocks; set the env there) so branch (c) fires. Verify by running a `/mos:*` command and checking the JSONL gains a line. Keep the hook's LOCAL-only, scalar-only invariants intact (no new fields that could carry user strings).
**Warning signs:** JSONL still 0 lines after a `/mos:*` session; or (over-correction) JSONL lines whose `command` field is empty/non-`/mos:`.

### Pitfall 5: HARD-05 reading the wrong STATE.md
**What goes wrong:** `.planning/STATE.md` is the GSD plugin-dev state (phase deadlines), distinct from a user room's `room/STATE.md`. The deadline monitor takes `ROOM_DIR` as `$1`; `.planning/` is relative to the repo root, not the room.
**Why it happens:** Two files named `STATE.md` with different schemas and different locations.
**How to avoid:** Decide the scan target explicitly. For the dogfood (plugin-as-venture, Canon Part 6) case, the phase deadlines live in the repo's `.planning/STATE.md`. The fix should add a scan branch that looks for phase-deadline frontmatter/fields in `.planning/STATE.md` (resolve relative to repo root or accept an explicit path). Confirm the actual field name used for phase deadlines in `.planning/STATE.md` before writing the extractor (Open Question 2).
**Warning signs:** monitor reports CLEAR while a known phase deadline (NATO 2026-06-01) is days out.

## Code Examples

### HARD-01 reproduction (verified failing, 2026-06-04)
```bash
# Source: live scripts/sentinel-health-check lines 85-86 + 132
set -euo pipefail
current_edges=$(grep -ciE "INFORMS|CONTRADICTS|CONVERGES|ENABLES|INVALIDATES" "$CURRENT" || echo "0")
previous_edges=$(grep -ciE "INFORMS|CONTRADICTS|CONVERGES|ENABLES|INVALIDATES" "$PREVIOUS" || echo "0")
# When $PREVIOUS has 0 matches: grep prints "0" AND exits 1 -> "|| echo 0" appends -> previous_edges="0\n0"
edge_delta=$((current_edges - previous_edges))
# -> bash: syntax error in expression (error token is "0"); script aborts under set -e
```

### HARD-02 reproduction (verified failing, 2026-06-04)
```javascript
// Source: live scripts/hsi-to-graph.cjs:68-70 pattern against a Phase-109-migrated room.db
// db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?,?,?) ON CONFLICT(id) ...')
//   .run('market-analysis','Section','{}');
// -> Error: NOT NULL constraint failed: nodes.source_path
// (migrated nodes table: source_path/created_by/created_at/last_seen_at are all NOT NULL)
```

## State of the Art

Not applicable -- no fast-moving library here. The relevant "state" is internal: the Phase 109 (`lib/core/migrations/phase-109-nodes-provenance.cjs`) schema tightening is what turned `hsi-to-graph`'s previously-fine bare insert into a NOT NULL violation. HARD-02 is a regression introduced by Phase 109 hardening that never propagated to the HSI write path.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nodes (id, type, properties)` 3-col, NULL-tolerant | `nodes` with `source_path/created_by/created_at/last_seen_at` NOT NULL + CHECK constraints | Phase 109 (v1.13.0, 2026-05-12) | hsi-to-graph + the lazygraph-ops upsert helpers now fail on migrated dbs (HARD-02). |

## Tri-Polar Surface Impact

| Surface | Impact of these bugs | Impact of the fixes |
|---------|----------------------|---------------------|
| **CLI** | Direct: `/mos:scout` runs the bash + Node + Python scripts; HARD-01 aborts health-check, HARD-02 silently drops HSI edges, HARD-03 pollutes results, HARD-04 logs 0, HARD-05 misses deadlines. | Fixes land at the script layer -> CLI gets correct scout output immediately. |
| **Desktop** | Same scripts run under the hood when Larry narrates scout findings conversationally (scout.md "Desktop" section). Buggy scout -> Larry narrates wrong/empty findings. | Script-layer fix -> Larry narrates correct findings. No Desktop-specific code. |
| **Cowork** | Shared room; same `hooks.json` bundle + same `/mos:scout` command. Same bug exposure on shared room state. | Script-layer fix applies; no surface-specific code needed. |

All five fixes are at the shared script/hook layer, so they satisfy the Tri-Polar rule without surface-specific branches.

## Canon Part 8 (Graph Boundary) Confirmation

All 5 surfaces are LOCAL. Verified no Brain egress:
- `sentinel-health-check`, `sentinel-deadline-monitor`: bash, read local files, write local `.intelligence/*.md`. No network.
- `hsi-to-graph.cjs`: writes only to local `room.db` via `lib/core/lazygraph-ops.cjs` (DatabaseSync). No fetch/http.
- `compute-hsi.py`, `rs-engine.py`: local corpus scan + local `.hsi-results.json`. (External-corpus enrichment, when used, hits public OpenAlex/arXiv only and carries no user content -- but the HARD-03 fix touches only the local `os.walk` skip-list.)
- `query-efficiency-telemetry.cjs`: writes LOCAL JSONL under `~/.mindrian/telemetry/`, scalar counts + LOCAL slug only (documented invariant at lines 25-35; CANON-PHASE-MAP Part 8 lists it as Part-8-compliant). The HARD-04 fix must preserve these invariants (no new fields, no network).

No fix in this phase introduces a Brain query, a remote write, or a user-content egress. **Part 8: clear.**

## Validation Architecture

> nyquist_validation is enabled (config has `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (`.test.cjs` files in `lib/memory/`, `lib/core/`) + bash smoke scripts in `tests/` |
| Config file | none (node:test needs none); bash harnesses are self-contained |
| Quick run command | `node --test lib/memory/query-efficiency-telemetry.test.cjs` (single file) |
| Full suite command | `node --test` over `lib/` plus the relevant `tests/*.sh` smoke harnesses |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | health-check survives a zero-edge snapshot and writes a valid report | bash smoke | `bash tests/test-sentinel-health-check.sh` (fixture: room with empty previous snapshot) | NO - Wave 0 |
| HARD-02 | `hsi-to-graph.cjs` writes Section + edge nodes into a Phase-109-migrated room.db without NOT NULL failure | unit (node:test) | `node --test lib/core/hsi-to-graph.test.cjs` | NO - Wave 0 |
| HARD-03 | `compute-hsi.py` and `rs-engine.py` exclude `.heal-backup/` from artifacts | python/bash smoke | `bash tests/test-hsi-skip-heal-backup.sh` (fixture: room with `.heal-backup/<TS>/dup.md`) | NO - Wave 0 |
| HARD-04 | telemetry hook writes a JSONL line when `MOS_COMMAND_CONTEXT=/mos:x` is set; the existing test still passes | unit (node:test) | `node --test lib/memory/query-efficiency-telemetry.test.cjs` | PARTIAL - extend existing |
| HARD-05 | deadline monitor reports a `.planning/STATE.md` phase deadline | bash smoke | `bash tests/test-deadline-monitor-planning-state.sh` | NO - Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant test for the bug being fixed (e.g. `node --test lib/core/hsi-to-graph.test.cjs`).
- **Per wave merge:** `node --test` over touched `lib/` files + the new bash smoke harnesses.
- **Phase gate:** all 5 regression tests green + a manual `/mos:scout` run in a real (migrated) room showing health-check report written, HSI edges in room.db, telemetry JSONL gaining lines, and a phase deadline surfaced.

### Wave 0 Gaps
- [ ] `tests/test-sentinel-health-check.sh` -- HARD-01, zero-edge snapshot fixture
- [ ] `lib/core/hsi-to-graph.test.cjs` -- HARD-02, migrated-room.db fixture (use `openRoomDb` to migrate, then run the writer)
- [ ] `tests/test-hsi-skip-heal-backup.sh` -- HARD-03, both scanners
- [ ] extend `lib/memory/query-efficiency-telemetry.test.cjs` -- HARD-04, assert a JSONL line is written when `MOS_COMMAND_CONTEXT` is set
- [ ] `tests/test-deadline-monitor-planning-state.sh` -- HARD-05, `.planning/STATE.md` phase-deadline fixture

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bash | HARD-01, HARD-05 sentinels | yes | system bash | - |
| node (with `node:sqlite`) | HARD-02, HARD-04 | yes | Node >=18 (node:sqlite experimental, in use repo-wide) | - |
| python3 + sklearn/numpy | HARD-03 (compute-hsi, rs-engine) | check at plan time via `scripts/check-hsi-deps` | - | scout HSI step degrades gracefully if deps missing; HARD-03 edit is pure-Python skip-list so testable without sklearn by stubbing the walk |

No missing dependency blocks the fixes. The HARD-03 skip-list edit can be unit-tested by exercising `discover_artifacts` with a fixture room (the walk does not need sklearn).

## Security Domain

> `security_enforcement` not set to false in config -> treated as enabled. Relevance is low (local scripts, no auth/session/crypto), but two categories apply.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | The deadline parser (HARD-05) reads dates from STATE.md frontmatter; reuse the existing `portable_date_to_epoch` + `[ "$epoch" -eq 0 ] && continue` guard (already in `sentinel-deadline-monitor`) so malformed dates are skipped, not fatal. |
| V12/V13 Files & Data | yes (Canon Part 8 is the binding control) | No fix may egress LOCAL data to BRAIN. Telemetry stays LOCAL scalar-only. Verified above. |
| V2/V3/V4/V6 (auth/session/access/crypto) | no | These sentinels have no auth, session, access-control, or crypto surface. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LOCAL->BRAIN data leak via a new telemetry field (HARD-04) | Information Disclosure | Keep the JSONL scalar-only + LOCAL-slug-only invariant; the brain-boundary scan (Canon Part 8 PR gate) must pass. |
| Silently swallowed write failure (HARD-02 masked by `|| true`) | Repudiation / data integrity | Surface the failure in the script; let scout report a degraded HSI step instead of pretending success. |
| Path traversal via artifact IDs containing `.heal-backup/<TS>/...` (HARD-03) | Tampering | Excluding `.heal-backup` also removes spurious path-segmented artifact IDs from the graph. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The scout-surfaced HARD-02 failure originated from a Phase-109-migrated room.db (the dogfood room currently shows the un-migrated 3-col schema, but migrated rooms reproduce the exact error). | HARD-02 / Pitfall 2 | Low. The fix (write full NOT-NULL column-set, or migrate-then-write) is correct for both schemas regardless of which room triggered the original report. |
| A2 | `.planning/STATE.md` carries phase deadlines in a frontmatter or field form the deadline monitor can grep (HARD-05). The exact field name was not confirmed in this research. | HARD-05 / Open Question 2 | Medium. If phase deadlines live elsewhere (ROADMAP.md, REQUIREMENTS.md) or use an unexpected field name, the extractor must target the right file/field. Confirm before coding. |
| A3 | The minimal HARD-04 fix is to export `MOS_COMMAND_CONTEXT` from the `/mos:*` command surfaces (branch c), preserving the hook's Part-8 invariants. An alternative (relax the gate to room-presence + tool-match) is viable but changes what the 57x claim measures. | HARD-04 / Pitfall 4 | Medium. The choice affects measurement semantics; surface to discuss-phase / user. |

## Open Questions

1. **HARD-02 fix strategy: route `hsi-to-graph.cjs` through `openRoomDb` (migrate-then-write) vs. PRAGMA-detect columns vs. just widen the insert.**
   - What we know: `openGraph` does not migrate; `openRoomDb` does; migrated dbs require the wide NOT-NULL insert; un-migrated dbs reject the wide insert (no such column).
   - What's unclear: whether routing through `openRoomDb` has side effects in the scout context (it runs the full Phase 109 migration which is heavier than `openGraph`).
   - Recommendation: prefer migrate-then-write via `openRoomDb` for correctness and Canon Part 9 alignment; fall back to PRAGMA-detect if the migration is too heavy for the scout step. Decide in the plan.

2. **HARD-05: where exactly do phase deadlines live and under what field name?**
   - What we know: the requirement says `.planning/STATE.md` phase deadlines; the NATO 2026-06-01 example is a phase deadline.
   - What's unclear: the exact frontmatter/field key in `.planning/STATE.md` (and whether `.planning/STATE.md` is gitignored and must be read via path, not room subtree).
   - Recommendation: read `.planning/STATE.md` at plan time to confirm the deadline field name before writing the extractor.

3. **HARD-02 scope: fix only `hsi-to-graph.cjs`, or also the sibling bare-insert helpers in `lib/core/lazygraph-ops.cjs`?**
   - What we know: the same defect pattern exists in `lazygraph-ops.cjs` (indexArtifact + upserts at :357-362, :729, :911); they fail identically on a migrated db.
   - Recommendation: fix the scout-surfaced site (hsi-to-graph) to satisfy HARD-02; flag the lazygraph-ops siblings as a same-wave hardening candidate (they are a latent bug for any `openGraph`-then-migrated-db caller).

## Sources

### Primary (HIGH confidence - live code read + reproduction, 2026-06-04)
- `scripts/sentinel-health-check:81-86,118,132` - HARD-01 site; reproduced abort under `set -euo pipefail`.
- `scripts/hsi-to-graph.cjs:68-70,116-117` - HARD-02 site; reproduced `NOT NULL constraint failed: nodes.source_path` against `openRoomDb`-migrated `/tmp/hsiroom/.mindrian/room.db`.
- `lib/core/migrations/phase-109-nodes-provenance.cjs:37-48,292-308` - the NOT NULL + CHECK schema that HARD-02 violates.
- `lib/core/navigation/evidence-claim.cjs:110` - the correct wide-insert column-set to copy.
- `scripts/compute-hsi.py:99-100,133-166` and `scripts/rs-engine.py:119,180-181` - HARD-03 SKIP_DIRS sites (both omit `.heal-backup`).
- `scripts/heal-command.cjs:937,1021` - `.heal-backup/<TS>/` creation; confirmed live dir at `~/MindrianRooms/mindrianOS/.heal-backup`.
- `scripts/query-efficiency-telemetry.cjs:46-51,167-187,285-286` - HARD-04 gate; grep confirmed zero setters of `CLAUDE_SLASH_COMMAND` / `MOS_COMMAND_CONTEXT`; `~/.mindrian/telemetry/query-efficiency.jsonl` absent.
- `scripts/sentinel-deadline-monitor:42,84` - HARD-05 scope (funding/ + opportunity-bank/ only).
- `commands/scout.md:58-178` - the scout invocation sequence (which scripts run, the `2>/dev/null || true` swallow at line 164).
- `hooks/hooks.json:195` - telemetry hook registration.

### Secondary (HIGH-MEDIUM)
- `CHANGELOG.md:2052-2057` - documents the HARD-04 detection-path gap in the plugin's own words.
- `docs/MINDRIAN-CANON.md` Part 8 + Part 9 - Brain boundary + room.db schema contract.
- `docs/CANON-PHASE-MAP.md` - Part 8 row confirming telemetry hook is Part-8-compliant; Part 9 rows for Phase 108/109.
- `.planning/seeds/SEED-008` - the original 2026-05-10 scout finding (INPUT, validated above).
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-A.md` - the room.db schema/temporality context (HARD-02 sibling thread).

## Metadata

**Confidence breakdown:**
- HARD-01: HIGH - reproduced the exact abort with production code.
- HARD-02: HIGH - reproduced `NOT NULL constraint failed: nodes.source_path` against a migrated db.
- HARD-03: HIGH - direct source read of both SKIP_DIRS sets + confirmed live `.heal-backup` dir.
- HARD-04: HIGH - source read + grep for env-var setters (zero) + CHANGELOG admission + absent JSONL.
- HARD-05: HIGH - direct source read of the monitor's scan scope.
- Fix strategies: MEDIUM - three open questions (HARD-02 open-path strategy, HARD-05 field name, HARD-04 gate approach) need plan-time decisions.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable internal code; re-verify if Phase 141/142 touches `lib/core/lazygraph-ops.cjs` or `room-db.cjs` before this phase executes)
