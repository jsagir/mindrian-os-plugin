---
phase: 194-per-session-room-binding
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/session-binding.cjs
  - lib/core/session-presence.cjs
autonomous: true
requirements: [PSB-01, PSB-11]

must_haves:
  truths:
    - "readSessionBinding(sessionId) returns {bound:[],primary:null,sticky:false} on a missing or corrupt file, never throws"
    - "writeSessionBinding lands the file via tmp+fsync+rename (atomic; a crash mid-write never corrupts the live file)"
    - "isAlive(pid) is true for a live pid and false for a dead one; listLiveCoSessions excludes self and dead/stale sessions"
    - "reap removes a presence file only when pid is dead OR mtime older than 300000 ms; a live pid is never reaped"
    - "a slug carrying a `..` segment is rejected before it is used as a write index"
  artifacts:
    - path: "lib/core/session-binding.cjs"
      provides: "readSessionBinding / writeSessionBinding over $MINDRIAN_ROOMS_HOME/.rooms/sessions/<sid>.json (global binding)"
      exports: ["readSessionBinding", "writeSessionBinding"]
    - path: "lib/core/session-presence.cjs"
      provides: "registerPresence / readPresence / listLiveCoSessions / heartbeat / reap / deregisterPresence over <room>/.mindrian/sessions/<sid>.json (per-room presence)"
      exports: ["registerPresence", "listLiveCoSessions", "reap", "deregisterPresence", "isAlive"]
  key_links:
    - from: "lib/core/session-presence.cjs"
      to: "process.kill(pid, 0)"
      via: "isAlive liveness probe cloned from write-lock.cjs:77"
      pattern: "process\\.kill\\("
---

<rules>
## RULES

- **Part 8 (LOCAL only):** both files write local JSON only. ZERO Brain/network token (the local-only floor greps these two modules first).
- **Fail OPEN / never throw into a hook:** every reader parses in try/catch and returns a safe default; every writer is fire-and-forget (outer try/catch that never rethrows).
- **A1/A4 CORRECTION context:** these primitives are the substrate the Wave-4 CAS reconcile rides on; the presence fast-path built here is what keeps the single-session case zero-cost.
- **Security V5:** parse session/presence JSON in try/catch -> safe default; path-traversal guard on any primary/bound slug (reject `..`, gate on fs.existsSync within the rooms root) BEFORE it is used as a write index.
- CJS only. NO em-dashes. The only new scalar is STALE_MS = 300000 (5m); it matches the shipped orphan-sweep window, NOT the 5s write-lock window, and is NOT a frozen-family scalar.
- Do NOT conflate the two files: `.rooms/sessions/<sid>.json` is GLOBAL binding ("my rooms"); `<room>/.mindrian/sessions/<sid>.json` is PER-ROOM presence ("this room's live sessions").
- Resumable: pure new files; re-running overwrites.
</rules>

<objective>
Build the two on-disk primitives the whole phase rides on, with no consumers yet: (1) `lib/core/session-binding.cjs` - the GLOBAL per-session binding file `{bound[] SET, primary, sticky, updated}` (PSB-01, D-01); (2) `lib/core/session-presence.cjs` - the PER-ROOM presence ledger `{session_id, pid, bound_at, updated}` with the pid-liveness fast-path + stale-reap helpers (PSB-11/12/13 substrate, D-09). Both clone shipped idioms verbatim (atomic write, safe-default-on-corruption, pid liveness) - this is composition, not invention.

Purpose: land the read/write substrate so Waves 2-5 only compose it.
Output: 2 new CJS modules + their green unit tests.
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
  <name>Task 1: session-binding.cjs - global per-session binding file (PSB-01)</name>
  <read_first>
    - scripts/intent-classifier.cjs:725-780 `persistDecisionTrace` (the atomic-write idiom to clone verbatim: mkdirSync recursive -> read-or-reset (catch->reset at 738) -> openSync(tmp,'wx') -> writeSync -> fsyncSync (ENOTSUP-tolerant) -> renameSync, all inside an outer try/catch that never throws).
    - lib/core/resolve-active-room.cjs:110-125 (safe-default-on-miss/corruption discipline: null-on-missing, null-on-parse-fail; mirror it but return the binding default instead of null) and :158 (the fs.existsSync abs_path gate to mirror for the path-traversal guard).
    - scripts/intent-classifier.cjs:709 `resolveSessionId` (the sessionId these files are keyed on; Pitfall 2: the CLI day-hash fallback can share an id - document, do not assume global uniqueness).
    - 194-RESEARCH.md Target 5 table (the binding-vs-presence schema split) + Pitfall 1/2.
  </read_first>
  <behavior>
    - readSessionBinding(missing file) -> {bound:[], primary:null, sticky:false}
    - readSessionBinding(corrupt/non-JSON file) -> same safe default, no throw
    - writeSessionBinding then readSessionBinding round-trips {bound, primary, sticky} and stamps `updated`
    - writeSessionBinding is atomic: no partial/corrupt live file is observable mid-write
    - a bound/primary slug containing `..` is rejected (not written as a write index) and reported via the safe path
  </behavior>
  <action>Create lib/core/session-binding.cjs exporting readSessionBinding(sessionId, {home}) and writeSessionBinding(sessionId, {bound, primary, sticky}, {home}). Resolve the dir as `$MINDRIAN_ROOMS_HOME/.rooms/sessions/` (home override for tests), keyed on sessionId. readSessionBinding: try/catch parse -> on any failure return the frozen safe default {bound:[], primary:null, sticky:false} (never throw). writeSessionBinding: clone the persistDecisionTrace atomic idiom byte-for-byte (mkdirSync recursive, openSync tmp wx, writeSync, fsyncSync best-effort ENOTSUP-tolerant, renameSync); stamp `updated` as an ISO string; wrap in an outer try/catch that never rethrows. Before accepting any slug into `bound` or `primary`, run a path-traversal guard: reject segments containing `..` and gate real slugs on fs.existsSync within the rooms root (mirror resolve-active-room.cjs:158); the reserved dev-repo sentinel `"__no_room__"` bypasses the existsSync gate but still passes the `..` check. Per D-01 `bound` is a SET (dedupe on write). Add a source-grep-clean header (no Brain/network token).</action>
  <verify>
    <automated>node tests/test-session-binding-file.test.cjs</automated>
  </verify>
  <done>test-session-binding-file.test.cjs passes: safe defaults on miss/corruption, atomic round-trip, `..` slug rejected, `__no_room__` accepted, bound deduped.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: session-presence.cjs - per-room presence ledger + liveness + reap (PSB-11)</name>
  <read_first>
    - lib/core/write-lock.cjs:76-85 `process.kill(pid, 0)` in try/catch (clone verbatim as isAlive(pid)) and :13 `STALE_THRESHOLD_MS = 5000` (do NOT copy the 5s - presence is a whole-session resource).
    - lib/core/framework-chain-composer.cjs:94 `RECENT_WRITE_WINDOW_MS = 5 * 60 * 1000` (the 5m window to adopt) and :285 (`if (now - fileStat.mtimeMs > RECENT_WRITE_WINDOW_MS) continue` mtime-compare pattern).
    - scripts/intent-classifier.cjs:725-780 (same atomic-write idiom as Task 1).
    - 194-PATTERNS.md "session-presence.cjs" Pitfall 3 (scan the OWN `<room>/.mindrian/sessions/` subdir only; never the `.mindrian/` root which holds decision-traces/, write.lock, hats/).
    - 194-RESEARCH.md Target 5 "The fast-path check" pseudo-code + "Stale-reap" reap condition.
  </read_first>
  <behavior>
    - isAlive(livePid) === true; isAlive(deadPid) === false
    - registerPresence writes {session_id, pid, bound_at, updated} atomically into <room>/.mindrian/sessions/<sid>.json
    - listLiveCoSessions(roomDir, mySid) excludes self, excludes dead pids, excludes updated older than STALE_MS -> empty array when no live co-session
    - heartbeat refreshes `updated` without rewriting bound_at
    - reap removes a file iff (!isAlive(pid) || now-updated > 300000); a live-pid file is never reaped regardless of mtime
    - deregisterPresence unlinks the session's presence file (idempotent - no-op if absent)
  </behavior>
  <action>Create lib/core/session-presence.cjs exporting isAlive(pid), registerPresence(roomDir, sessionId), heartbeat(roomDir, sessionId), readPresence(roomDir), listLiveCoSessions(roomDir, mySessionId), reap(roomDir), deregisterPresence(roomDir, sessionId). Define STALE_MS = 300000 (5m; document it matches framework-chain-composer.cjs:94, not the write-lock 5s). isAlive clones write-lock.cjs:77 verbatim. All scans target `<roomDir>/.mindrian/sessions/` ONLY (Pitfall 3). listLiveCoSessions: readdir that subdir, parse each in try/catch (skip unparseable), filter out mySessionId, keep only isAlive(pid) && (now - updated) < STALE_MS. reap: same scan, unlink any file where !isAlive(pid) || (now - updated) > STALE_MS. register/heartbeat use the Task-1 atomic idiom (tmp+fsync+rename); heartbeat updates only `updated`. deregisterPresence unlinkSync in try/catch (idempotent). Every reader parses in try/catch and skips corrupt entries (never throws). Source-grep-clean header.</action>
  <verify>
    <automated>node tests/test-presence-fast-path.test.cjs && node tests/test-presence-stale-reap.test.cjs</automated>
  </verify>
  <done>Both presence tests pass: fast-path empty when no live co-session, arms when a live co-session exists; reap drops dead/stale, keeps live-pid; scans only the sessions/ subdir.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| hand-edited/corrupt session or presence JSON -> reader | untrusted file content crosses into a hook path |
| session-file slug -> filesystem write index | a slug could attempt path traversal out of MindrianRooms |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-03 | Tampering / DoS | corrupt session/presence JSON | mitigate | parse in try/catch -> safe default `{bound:[],primary:null,sticky:false}` / skip-entry; never throw into the hook |
| T-194-04 | Tampering | path traversal via primary/bound slug | mitigate | reject `..` segments; gate real slugs on fs.existsSync within the rooms root before any write-index use |
| T-194-05 | Spoofing | recycled pid appears "alive" | accept | pid liveness is advisory + paired with the 5m mtime window; a false-live presence only ARMS the reconcile guard (never blocks) |
| T-194-06 | DoS | thousands of stale presence files | mitigate | reap keyed on sessionId bounds the dir to real sessions; runs on doctor cadence (Wave 5) |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-session-binding-file.test.cjs && node tests/test-presence-fast-path.test.cjs && node tests/test-presence-stale-reap.test.cjs` all pass.
- `node tests/test-194-local-only.test.cjs` still green (both new modules carry zero Brain/network token).
- `bash tests/run-all-194.sh` shows these three legs PASSED, the rest still SKIPPED.
</verification>

<success_criteria>
- The binding + presence substrate is on disk, atomic, corruption-safe, and consumer-free; Wave 2 can compose readSessionBinding and Wave 4 can compose listLiveCoSessions.
</success_criteria>

## Artifacts this phase produces (this plan)
- `lib/core/session-binding.cjs` (global per-session binding: read/write, atomic, safe-default, path-traversal guard)
- `lib/core/session-presence.cjs` (per-room presence: register/read/heartbeat/listLiveCoSessions/reap/deregister, pid-liveness, 5m stale window)

<output>
Create `.planning/phases/194-per-session-room-binding/194-02-SUMMARY.md` when done
</output>
