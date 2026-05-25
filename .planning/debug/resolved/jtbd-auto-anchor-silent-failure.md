---
status: resolved
resolved: 2026-05-24
resolved_by: phase-127.3
resolution_summary: "Chokepoint extraction (lib/core/resolve-active-room.cjs) + jtbd-update.cjs refactor + intent-classifier reroute + sibling-sweep tripwire + room-registry create bootstrap + retro-bootstrap + first-touch nudge. Ships v1.13.0-beta.34."
trigger: "Multi-hour Larry session in fresh room mof-procurement-workshop produced 24+ artifacts but JTBD memory layer empty for entire session; /mos:memory shows in_flight=0, parked=0, completed=0; jtbd-state.json never created; ~/MindrianRooms/.memory/ never bootstrapped"
created: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
kind: rca
canon_parts: [4, 8, 9]
source_of_truth:
  code_read_against: "origin/main HEAD (Phase 127.2 era, post v1.13.0-beta.30)"
  wire_probe_against: "Live /home/jsagi/MindrianRooms/mof-procurement-workshop/ room state"
  audit_date: "2026-05-24"
  reverify_rule: "Re-read scripts/jtbd-update.cjs lines 65-79 + /home/jsagi/MindrianRooms/.rooms/registry.json shape before treating findings as stale"
---

## Current Focus

hypothesis: scripts/jtbd-update.cjs resolveActiveRoom() returns null on every call because the registry-shape contract it reads against has never matched the registry-shape that scripts/room-registry writes
test: empirical -- ran the hook script against the real registry with debug enabled
expecting: silent exit 0 with no state file written
next_action: PROPOSE FIXES ONLY (per user instruction) -- no code change; relay to next phase

## Symptoms

expected:
  - User runs Larry in fresh room
  - User says something matching JTBD cues (e.g. "should we pursue", "what's the real problem")
  - jtbd-update.cjs UserPromptSubmit hook fires (line 272 of hooks/hooks.json)
  - Classifier returns a typed JTBD assignment with confidence >= 0.6
  - jtbd-state.setCurrent writes <roomDir>/.mindrian/jtbd-state.json
  - After 3+ same-jtbd turns, promoteIfEligible writes to ~/MindrianRooms/.memory/jtbd-history.json
  - /mos:memory shows in_flight: [{jtbd: ..., turn_count: N, ...}]

actual:
  - Multi-hour session, 24+ artifacts filed, 17 decisions recorded
  - jtbd-state.json file DOES NOT EXIST at <roomDir>/.mindrian/
  - ~/MindrianRooms/.memory/ directory DOES NOT EXIST
  - /mos:memory returns "in_flight: 0, parked: 0, completed: 0"
  - Every decision-traces/*.json entry shows intent_persona = {archetype: null, problem_type: null, ...}
  - Every routing entry shows "Tier 0 fallback: no quadruple available for sectionPath" with routing_source: legacy

errors: silent (hook returns exit 0 on every invocation with no output)

reproduction:
  1. Create a new room: bash scripts/room-registry create test-room test-room
  2. Set active: bash scripts/room-registry set-active test-room
  3. Start a Claude Code session in /home/jsagi/MindrianRooms/test-room/
  4. Type any message matching JTBD cues (e.g. "we should pivot")
  5. Inspect /home/jsagi/MindrianRooms/test-room/.mindrian/ -- no jtbd-state.json
  6. Run /mos:memory -- returns empty

started: Since 2026-04-26 (commit fcbbcf9a, when scripts/jtbd-update.cjs first shipped). The bug has existed in every release containing Phase 100 (v1.11.x onward).

## Eliminated

- hypothesis: H1 -- classifier not registered as a UserPromptSubmit hook
  evidence: hooks/hooks.json line 272 explicitly registers `node "${CLAUDE_PLUGIN_ROOT}/scripts/jtbd-update.cjs" userprompt` under UserPromptSubmit
  timestamp: 2026-05-24T00:00:00Z

- hypothesis: H2 (chicken-and-egg) -- across-session bootstrap requires a prior write
  evidence: lib/hmi/across-session-memory.cjs line 86-130 ensureDir() creates the directory on first call from promoteIfEligible. The actual reason it never gets bootstrapped is downstream: promoteIfEligible is never called because jtbd-update.cjs early-returns. Not a bootstrap design flaw -- a symptom of the upstream registry mismatch.
  timestamp: 2026-05-24T00:00:00Z

- hypothesis: H4 -- engine v1 quadruple resolution falls through to Tier 0
  evidence: PARTIALLY CORRECT but DIFFERENT ROOT CAUSE. The "Tier 0 fallback: no quadruple available for sectionPath" entries are real -- they come from lib/core/navigation-engine.cjs line 338. But the deeper reason intent_persona is all-null in every trace is that USER.md does not exist in fresh rooms (intent-classifier.cjs line 1042-1058 reads USER.md to fill the persona block; on absent file, returns null). This is a separate "fresh-room bootstrap" issue from the JTBD silent-failure but related: room creation does not seed any of the downstream pipeline files (USER.md, jtbd-state.json, .memory/).
  timestamp: 2026-05-24T00:00:00Z

## Evidence

- timestamp: 2026-05-24T00:00:00Z
  checked: /home/jsagi/MindrianRooms/.rooms/registry.json shape (v3)
  found: |
    Registry uses {version:3, root, active: "<slug>", rooms: {"<slug>": {path, ...}}}
    NOT {active_room: "<slug>", rooms: [...]} as resolveActiveRoom() expects.
    Direct read confirms: reg.active = "mof-procurement-workshop"; reg.active_room = undefined; Array.isArray(reg.rooms) = false; typeof reg.rooms = "object".
  implication: jtbd-update.cjs resolveActiveRoom() (line 71-79) hits the early-return on line 75 because `!reg.active_room || !Array.isArray(reg.rooms)` is true on every call. Returns null. Main() short-circuits at line 132 with `if (!roomDir) { debugLog(null, 'no active room; exit'); return; }`. Classifier never called.

- timestamp: 2026-05-24T00:00:00Z
  checked: Empirical hook execution
  found: |
    Ran: cd /home/jsagi/MindrianOS-Plugin && CLAUDE_USER_MESSAGE="should we pursue this idea" MINDRIAN_DEBUG=1 node scripts/jtbd-update.cjs userprompt
    Result: exit 0, NO state file created. Even with DEBUG=1 the script can't write the debug log because debugLog() requires a non-null roomDir.
  implication: Hook runs, hook silently exits, no observable side effect.

- timestamp: 2026-05-24T00:00:00Z
  checked: intent-classifier.cjs resolveActiveRoomDir() (line 71-86)
  found: |
    intent-classifier.cjs CORRECTLY reads `reg.active` (not reg.active_room) and CORRECTLY handles both array and object form for rooms via registeredRoomNames(). This is why intent-classifier hook DOES fire and DOES write decision-traces. The bug is isolated to jtbd-update.cjs (and any sibling script using the same incorrect shape).
  implication: Two scripts in the same plugin read the same registry file with two different contracts. intent-classifier is correct. jtbd-update is wrong. Contract drift between sibling code paths.

- timestamp: 2026-05-24T00:00:00Z
  checked: USER.md presence in mof-procurement-workshop
  found: |
    /home/jsagi/MindrianRooms/mof-procurement-workshop/USER.md does not exist.
    intent-classifier.cjs line 1042-1058 reads USER.md to populate userPersona; on absent, returns null. Hence the intent_persona = {archetype: null, ...} block in every decision trace.
  implication: Separate bug -- room creation script does not seed USER.md. Not the JTBD root cause, but a sibling bootstrap gap that causes the persona-stuck symptom Jonathan observed.

- timestamp: 2026-05-24T00:00:00Z
  checked: scripts/room-registry create subcommand (line 47-100)
  found: |
    Creates ROOMS_HOME/<RPATH>/ directory and registers entry in registry.json. Does NOT seed:
      - <roomDir>/.mindrian/jtbd-state.json
      - <roomDir>/.mindrian/operator-state.json
      - <roomDir>/USER.md
      - <roomDir>/ROOM.md (canon decision 15)
      - <roomDir>/STATE.md (Phase 100 reads from this for decisionsRecency)
      - ~/MindrianRooms/.memory/ (Phase 103 across-session)
  implication: Room creation is a minimal-bootstrap operation that leaves every downstream pipeline starved of the files it expects to find. The pipeline's "graceful degradation" then becomes "permanent silent failure" because the files are never seeded by anyone.

- timestamp: 2026-05-24T00:00:00Z
  checked: hooks.json SessionStart block + scripts/memory-resume-nudge.cjs
  found: |
    The SessionStart nudge (memory-resume-nudge.cjs) is correctly wired and DOES run on every session via the sessionstart-coordinator. But its `listInFlight(7)` call returns empty for first-time rooms because no JTBD has ever been promoted. The nudge falls through silently. No "establish your JTBD" first-touch prompt exists. The nudge is RESUMPTION-only, not FIRST-TOUCH.
  implication: Even if H1+H3 are fixed, first-time users get zero prompting to declare a JTBD. They have to either type a cue match by accident (now possible after fix) OR explicitly run /mos:jtbd. H5 was a real gap, separate from the registry bug.

## Resolution

root_cause: |
  THREE composing defects in two layers.

  PRIMARY (silent-failure root cause):
  scripts/jtbd-update.cjs lines 65-79 (resolveActiveRoom) reads against an obsolete registry shape:
    - Expects `reg.active_room` (string slug). Actual registry writes `reg.active` (string slug).
    - Expects `reg.rooms` to be an Array of {slug, abs_path, sealed, ...}. Actual registry writes `reg.rooms` as an Object keyed by slug, with entries shaped {path: <relative>, ...} (no abs_path, no slug, no sealed field).
  
  Both checks fail on EVERY call. The function returns null. main() short-circuits before the classifier runs. jtbd-state.json never gets written. ~/MindrianRooms/.memory/ never gets bootstrapped (because promoteIfEligible is never reached). /mos:memory legitimately reports 0/0/0 because no entry has ever been written. This has shipped this way since v1.11.x (commit fcbbcf9a, 2026-04-26).

  SECONDARY (sibling bootstrap gap):
  scripts/room-registry create does not seed USER.md (read by intent-classifier.cjs for persona), STATE.md (read by jtbd-update.cjs for decisionsRecency), .mindrian/jtbd-state.json (read by jtbd-update.cjs for currentJtbd hysteresis), or .mindrian/operator-state.json (read for operator stratum). All downstream readers handle absence gracefully, so the visible failure mode is "everything is null forever" rather than a crash.

  TERTIARY (first-touch UX gap):
  memory-resume-nudge.cjs is RESUMPTION-only. It nudges when a prior in_flight JTBD exists in another room. It does NOT prompt "you have no JTBD established, declare one" for first-time rooms. So even after the primary fix, the user has no guided path to anchor a JTBD on a fresh room.

fix: |
  Proposed (NOT applied per user instruction). See "Proposed Fixes" section in full report below.

verification: |
  PRIMARY: After patching resolveActiveRoom() to read reg.active and tolerate both rooms shapes, an empirical re-run of `CLAUDE_USER_MESSAGE="should we pursue this idea" MINDRIAN_DEBUG=1 node scripts/jtbd-update.cjs userprompt` should produce a .mindrian/jtbd-state.json file with current.jtbd = "decide-pursue" and confidence around 0.5-0.6 (one cue match, no operator, no recency).
  SECONDARY: After room creation seeds USER.md + STATE.md skeletons, the next decision-trace should show intent_persona with non-null fields (archetype derived from USER.md.canonical_role).
  TERTIARY: After adding a first-touch nudge that fires when /mos:memory shows 0/0/0 AND room is < 24h old, fresh-room users get a "what are you trying to do here?" prompt on first SessionStart.

files_changed: []

## Refuted Hypotheses (from user's H1-H5)

- **H1 REFUTED**: classifier IS registered as a UserPromptSubmit hook at hooks/hooks.json:272.
- **H2 PARTIALLY**: across-session-memory.cjs `ensureDir()` does create the directory lazily on first write. The bootstrap is fine. The reason it never fires is the upstream registry mismatch in jtbd-update.cjs.
- **H4 PARTIALLY**: the "Tier 0 fallback: no quadruple" message is real (navigation-engine.cjs:338), but it's a SEPARATE issue caused by the route-resolver not finding USER.md persona data, not by the engine itself silently falling through. Fixable independently by seeding USER.md on room creation.

## Confirmed Hypotheses (from user's H1-H5)

- **H3 CONFIRMED + AMPLIFIED**: room-registry create does not seed any of the downstream-pipeline files (USER.md, jtbd-state.json, STATE.md, .memory/, ROOM.md). But this is the SECONDARY bug. The PRIMARY bug is in jtbd-update.cjs (registry-shape mismatch), not in room creation.
- **H5 CONFIRMED**: SessionStart nudge is resumption-only. No first-touch prompt for fresh rooms. Loop forever risk is real but only matters AFTER H1/H3 are fixed -- right now the classifier can't run at all even if the user did set up a JTBD via /mos:jtbd manually (because the same broken resolveActiveRoom() would be called from any other script that copies the pattern).

## Proposed Fixes (ranked by impact)

### Fix 1 (CRITICAL, must ship in next beta): Fix the registry-shape contract in jtbd-update.cjs

**File**: scripts/jtbd-update.cjs lines 65-79

**Current (broken)**:
```js
function resolveActiveRoom() {
  const envRoom = process.env.CLAUDE_ACTIVE_ROOM;
  if (envRoom && typeof envRoom === 'string' && envRoom.length > 0) {
    return fs.existsSync(envRoom) ? envRoom : null;
  }
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_e) { return null; }
  if (!reg || !reg.active_room || !Array.isArray(reg.rooms)) return null;
  const room = reg.rooms.find(function (r) { return r && r.slug === reg.active_room; });
  if (!room || !room.abs_path || !fs.existsSync(room.abs_path) || room.sealed) return null;
  return room.abs_path;
}
```

**Proposed**:
```js
function resolveActiveRoom() {
  const envRoom = process.env.CLAUDE_ACTIVE_ROOM;
  if (envRoom && typeof envRoom === 'string' && envRoom.length > 0) {
    return fs.existsSync(envRoom) ? envRoom : null;
  }
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_e) { return null; }
  if (!reg) return null;
  // Support both legacy (active_room) and current (active) field name.
  const activeSlug = (typeof reg.active === 'string' && reg.active.length > 0) ? reg.active
                   : (typeof reg.active_room === 'string' && reg.active_room.length > 0) ? reg.active_room
                   : null;
  if (!activeSlug) return null;
  // Support both array form and object form for rooms field.
  let entry = null;
  if (Array.isArray(reg.rooms)) {
    entry = reg.rooms.find(function (r) { return r && (r.slug === activeSlug || r.name === activeSlug); });
  } else if (reg.rooms && typeof reg.rooms === 'object') {
    entry = reg.rooms[activeSlug] || null;
  }
  if (!entry) return null;
  if (entry.sealed === true || entry.status === 'sealed') return null;
  // Resolve room directory. abs_path wins if set; otherwise compose from home + (relative) path.
  let roomDir;
  if (typeof entry.abs_path === 'string' && entry.abs_path.length > 0) {
    roomDir = entry.abs_path;
  } else if (typeof entry.path === 'string' && entry.path.length > 0) {
    roomDir = path.isAbsolute(entry.path) ? entry.path : path.join(home, entry.path);
  } else {
    return null;
  }
  return fs.existsSync(roomDir) ? roomDir : null;
}
```

**Phase target**: ship as a Phase 127.2 hotfix (Plan 127.2-05 if continuing the Phase 127.2 sequence, or its own Phase 128 hotfix if Phase 127.2 has closed). Beta target: v1.13.0-beta.31 or v1.13.1-beta.1. CRITICAL because every prior beta has shipped this bug; the JTBD layer has been silently dead for every user since Phase 100 first shipped.

**Sibling sweep**: grep for `reg.active_room\|Array.isArray(reg.rooms)\|room.abs_path\|room.sealed === true` across scripts/ and lib/. Any other script copying this broken pattern needs the same fix.

### Fix 2 (HIGH, ship in same beta): Reuse-before-build via a shared room-resolution helper

Per Canon Part 7 (Reuse Before Build), the same registry-resolution logic exists in (at least) three places: intent-classifier.cjs, jtbd-update.cjs, across-session-memory.cjs. Extract to `lib/core/resolve-active-room.cjs` with one canonical implementation. Two contract-drift bugs already point at this need (the v1.13.0-beta.32 windows-room-registry-path-normalization-gap was a similar contract-drift class -- bash $REGISTRY_FILE leaking POSIX paths into Python open()).

Public API:
```js
module.exports = {
  resolveActiveRoom,  // returns { slug, abs_path } or null
  resolveActiveRoomSlug,
  resolveActiveRoomDir,
};
```

### Fix 3 (HIGH): Add a doctor probe for the JTBD pipeline

`scripts/doctor.cjs --check-jtbd` (mirrors the Phase 127.2 Plan 03 pattern for `--check-rs-engine`):
- Resolves active room via the shared helper
- If none, exits 1 with "No active room registered. Run /mos:rooms set-active <slug>."
- If active room exists, simulates a classifier call with a canned test cue and verifies a jtbd-state.json gets written (then removes it to avoid polluting real state)
- Reports OK / FAILED with actionable fix line

This makes the silent failure VISIBLE in the standard health-check flow. The Phase 127.2 Plan 03 pattern (rs-engine silent-failure) established this discipline; the same pattern applies here.

### Fix 4 (MEDIUM): Bootstrap downstream pipeline files on room creation

In `scripts/room-registry` create stanza, after `mkdir -p "${ROOMS_HOME}/${RPATH}"`, seed:
- `<roomDir>/STATE.md` (empty Decisions section -- jtbd-update reads from this)
- `<roomDir>/USER.md` (skeleton with canonical_role: null -- intent-classifier reads from this)
- `<roomDir>/ROOM.md` (per canon decision 15 -- every directory gets identity)
- `<roomDir>/.mindrian/` (directory only; do NOT seed jtbd-state.json since absent-file is correctly handled and writing an empty file would mask the legitimate first-write event)

The .memory/ directory should NOT be bootstrapped here -- it's per-USER not per-room, and across-session-memory.cjs ensureDir() handles it lazily on first promote.

### Fix 5 (MEDIUM): Add a SessionStart first-touch JTBD nudge

Extend memory-resume-nudge.cjs (or add a sibling first-touch-nudge.cjs) that fires when:
- active room exists AND
- jtbd-state.json absent OR current.jtbd is null AND
- room age < 7 days (so we don't pester users who've intentionally left it blank)

The nudge emits one line: "What are you trying to do here? Use /mos:jtbd set <id> or just describe it -- I'll detect." This addresses H5 and removes the forever-empty-loop risk.

### Fix 6 (LOW, separate phase): USER.md bootstrap for intent_persona

intent-classifier.cjs currently reports `intent_persona = all-null` on every trace because USER.md doesn't exist. Either:
(a) Seed USER.md on room creation (Fix 4 covers this), OR
(b) Have intent-classifier.cjs fall back to default archetype values when USER.md is absent (less invasive; same outcome).

Pair this with a /mos:user-md-init command that re-runs the user profile interview, similar to /mos:profile-user.

## Reproduction Steps

### To verify the bug exists on a fresh install:
1. `rm -rf ~/MindrianRooms/test-jtbd-bug && bash /home/jsagi/MindrianOS-Plugin/scripts/room-registry create test-jtbd-bug test-jtbd-bug`
2. `cd /home/jsagi/MindrianOS-Plugin && CLAUDE_USER_MESSAGE="we should pivot the venture" MINDRIAN_DEBUG=1 node scripts/jtbd-update.cjs userprompt`
3. `ls /home/jsagi/MindrianRooms/test-jtbd-bug/.mindrian/jtbd-state.json` → "No such file or directory"
4. `node -e "console.log(require('/home/jsagi/MindrianOS-Plugin/lib/hmi/across-session-memory.cjs').getRoomMemory('test-jtbd-bug'))"` → `{ in_flight: [], parked: [], completed: [] }`

### To verify the bug is fixed after Fix 1 applied:
1. Apply the proposed `resolveActiveRoom()` patch
2. Re-run step 2 above
3. `cat /home/jsagi/MindrianRooms/test-jtbd-bug/.mindrian/jtbd-state.json` → should show `{version: 1, current: {jtbd: "decide-pursue", confidence: ~0.5, ...}, history: [{from: "explore", to: "decide-pursue", ...}]}`
4. Re-run step 2 with the same message two more times to satisfy the 3-turn threshold for promoteIfEligible
5. `node -e "console.log(JSON.stringify(require('/home/jsagi/MindrianOS-Plugin/lib/hmi/across-session-memory.cjs').getRoomMemory('test-jtbd-bug'), null, 2))"` → should show in_flight = [{jtbd: "decide-pursue", turn_count: 3, ...}]
6. `ls ~/MindrianRooms/.memory/` → should now exist with jtbd-history.json, audit.log, ROOM.md

## MindrianOS Gate Sweep (RCA Template Section 5)

| Gate | Status | Note |
|---|---|---|
| Canon Part 8 Brain-boundary | PASS | Proposed fixes are local-only; zero Brain calls |
| Tri-Polar three-surface | PARTIAL | Fix 1 covers all three surfaces (CLI, Desktop, Cowork) since registry resolution is the same on all three. Fix 4 (room bootstrap) is CLI-only currently; Desktop and Cowork would need parallel paths. |
| Cross-platform | NEEDS CHECK | Should test Fix 1 against Windows + Git Bash since the prior Phase 127.2 Plan 04 found bash-vs-Windows path issues in adjacent code |
| Release lockstep | N/A (no release proposed in this RCA) |
| No em-dashes | PASS |
| Reuse-before-build | Fix 2 explicitly addresses this -- the bug is itself caused by violating Canon Part 7 (three sibling scripts each implementing their own registry-resolution) |

## Resolution

Closed by Phase 127.3 (`.planning/phases/127.3-jtbd-auto-anchor-fix/`) across 7 plans landing in v1.13.0-beta.34. The PRIMARY silent-failure root cause (`scripts/jtbd-update.cjs::resolveActiveRoom` reading against an obsolete registry shape since 2026-04-26 / commit fcbbcf9a) is sealed by extracting a single chokepoint helper at `lib/core/resolve-active-room.cjs` (Canon Part 7) and rerouting every sibling site through it; the SECONDARY fresh-room bootstrap gap is sealed by `scripts/room-registry create` now seeding USER.md / STATE.md / ROOM.md / .mindrian/ idempotently AND a new `bootstrap-missing` subcommand retro-seeding every pre-existing room on first post-127.3 invocation; the TERTIARY first-touch UX gap is sealed by a priority-3 nudge inside `scripts/memory-resume-nudge.cjs::contribute()` gated on ROOM.md mtime < 7 days; an empirical reproduction test, a sibling-sweep tripwire, and a chokepoint unit-test together aggregate under `bash tests/run-all-127.3.sh` and serve as the behavioral + structural + regression gate for every future release.

Plan-by-plan deliverables (each with its own SUMMARY at `.planning/phases/127.3-jtbd-auto-anchor-fix/127.3-NN-SUMMARY.md`):

- **Plan 127.3-00** (`127.3-00-SUMMARY.md`): extracted `lib/core/resolve-active-room.cjs` chokepoint helper tolerating both legacy (`reg.active_room` + Array `reg.rooms`) and current (`reg.active` + Object `reg.rooms`) registry shapes; returns `{ slug, abs_path }` or null; mirrors the Canon Part 7 precedent set by `lib/core/resolve-brain-key.cjs` (Phase 123).
- **Plan 127.3-01** (`127.3-01-SUMMARY.md`): refactored `scripts/jtbd-update.cjs` at both broken registry walks (lines 65-79 top-level resolver + lines 196-214 Phase 103-05 promote block) to import and call the chokepoint; THE primary silent-failure fix.
- **Plan 127.3-02** (`127.3-02-SUMMARY.md`): rerouted `scripts/intent-classifier.cjs::resolveActiveRoomDir` through the chokepoint with a MINDRIAN_ROOMS_ROOT to MINDRIAN_ROOMS_HOME env-var bridge so historical CWD-anchored callers continue to resolve correctly.
- **Plan 127.3-03** (`127.3-03-SUMMARY.md`): sibling-sweep tripwire `tests/test-127.3-sibling-sweep.sh` plus patched 4 sibling scripts (`hmi-compliance-poll.cjs`, `jtbd-command.cjs`, `operator-command.cjs`, `check-onboard-statusline.cjs`) to consolidate canonical-single-source registry resolution; `scripts/memory-completion-detector.cjs` (multi-room iteration site) deferred to Phase 129 per iteration-1 plan-check B-01 with a `# TODO Phase 129` allow-list marker.
- **Plan 127.3-04** (`127.3-04-SUMMARY.md`): extended `scripts/room-registry create` to seed USER.md (canonical_role: null) / STATE.md (empty Decisions section) / ROOM.md (Canon decision 15) / `.mindrian/` directory idempotently (D-02 honored: NO `jtbd-state.json` / `operator-state.json` seeded so legitimate first-write events stay in audit logs); added NEW `bootstrap-missing` subcommand plus a `~/MindrianRooms/.rooms/.bootstrap-127.3-done` sentinel auto-trigger for retro-seeding existing rooms.
- **Plan 127.3-05** (`127.3-05-SUMMARY.md`): first-touch JTBD nudge inside `scripts/memory-resume-nudge.cjs::contribute()`, priority 3, gated on `.mindrian/jtbd-state.json` absent AND ROOM.md mtime < 7 days (D-03 per-room gate); effective on both newly created rooms AND retro-bootstrapped existing rooms (where ROOM.md mtime reflects the moment the retro-pass stamped the room's identity).
- **Plan 127.3-06** (`127.3-06-SUMMARY.md`): empirical reproduction shell test `tests/test-jtbd-auto-anchor-empirical.sh` reproducing the RCA "Reproduction Steps" protocol verbatim, two-half pre-fix/post-fix protocol; aggregator `tests/run-all-127.3.sh` runs all 3 Phase 127.3 test suites (chokepoint unit-test + sibling-sweep tripwire + empirical reproduction); Plan 00 chokepoint unit-test registered in `lib/memory/run-feynman-tests.cjs` so every Feynman pass picks it up.

The chokepoint helper `lib/core/resolve-active-room.cjs` is the load-bearing Canon Part 7 extraction. Phase 129 (spine-repair-memory-event, v1.13.1-beta.3) absorbs the remaining 6 spine scripts (`mos-status`, `suggest-next`, `act`, `pipeline`, `operator`, `memory`) plus the deferred `memory-completion-detector.cjs` multi-room iteration site onto the same chokepoint, so 127.3 lands the infrastructure 129 reuses without double-work.

Pattern indexed at `.planning/debug/knowledge-base.md` as `jtbd-auto-anchor-silent-failure` so `gsd-debugger` surfaces "registry-shape contract drift between sibling scripts produces silent-dead pipelines" as a known-pattern hypothesis for the next investigator. User-readable summary in CHANGELOG.md under `## [Unreleased] -- v1.13.0-beta.34` with canonical W-04 heading schema (`### Fixed (JTBD auto-anchor silent-failure bundle, Phase 127.3 -- ships v1.13.0-beta.34)`).
