# Phase 241: Feynman-MINTO - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 8 (all EXISTING files, ZERO new files per RESEARCH.md's "Recommended Project Structure")
**Analogs found:** 8 / 8 (this phase's own RESEARCH.md already supplies the exact code excerpts; the additional value here is the FULL surrounding context, the reuse-idiom source, and the test-registry pattern)

## File Classification

This phase has no new files. Every "file in scope" below is an EDIT target; the "analog" is either (a) the SAME file's neighboring code the fix must slot into, or (b) a DIFFERENT file in this repo that already ships the idiom the fix should reuse.

| File to Edit | Role | Data Flow | Closest Analog (for the idiom, not the file itself) | Match Quality |
|---|---|---|---|---|
| `scripts/on-stop` (F-1, lines 453-461 + 543-550) | CLI hook script (bash) | request-response (Stop-hook stdin/stdout contract) | Itself -- lines 543-550 is the target the 453-461 fix must feed into | exact (same-file wiring fix) |
| `scripts/feynman-minto-guardian.cjs` (F-1 `runOnStop` 335-434; F-2 `validateSection` 169-184 + enqueue gate 269-279; F-3 `runPreCommit` 455-495) | CLI/service module (validator orchestrator) | CRUD-like (walk sections, aggregate, write report) + request-response (pre-commit exit code) | `scripts/check-shape-declaration.cjs:894-916` for F-3's advisory/--strict idiom | exact for F-3; itself for F-1/F-2 |
| `lib/core/feynman-minto-invariants.cjs` (F-2, lines 388-398) | shared core / pure validator | transform (file text -> violations[]) | Same file, lines 265-312 (the file-not-found CRITICAL path already exists as the pattern to mirror for severity naming, `SEVERITY.CRITICAL`) | exact |
| `lib/memory/validators/minto-invariants.cjs` (F-2, lines 30-37) | validator-registry adapter | transform | `scripts/feynman-minto-guardian.cjs:176-184` (the guardian's OWN existence-check, the actual F-2 fix target; this wrapper file is NOT to be edited per RESEARCH's anti-pattern warning) | role-match (do-not-edit reference) |
| `scripts/hooks/pre-commit-room-minto-guard.sh` (F-3, lines 220-232) | git hook / CLI wrapper | request-response (exit-code propagation) | Same file's own existing exit-code-propagation block (220-232) is the analog; F-3 changes what `feynman-minto-guardian.cjs pre-commit` RETURNS, not this file's propagation logic | exact (no change needed here unless a `--strict` flag must be threaded through) |
| `scripts/minto-debouncer.cjs` (F-0, no changes) | service module (queue) | CRUD (enqueue/drain/peek over `.mindrian/minto-queue.json`) | N/A -- reference only, exports already stable | exact (reference API) |
| `scripts/intent-classifier.cjs` (F-0/Option B, lines 1-60+) | CLI hook script (UserPromptSubmit) | request-response (stdin message -> stdout additionalContext) | `lib/memory/debouncer-drain-at-prompt.test.cjs` (Phase 88-05, already tests a drain-at-prompt block; confirms the EXPECTED shape for this hook even though it's a test file, not production) | role-match |
| `lib/mcp/stop-gate-handler.cjs` (F-0 discard site B, 124-133; Open Question 2 candidate for F-1) | shared core / MCP Stop-path handler | event-driven (Stop-hook close-out orchestration) | `scripts/on-stop`'s own Phase 88-13 guardian block (453-461) is the analog to port if Open Question 2 is answered "yes, wire Desktop/Cowork" | role-match |

## Pattern Assignments

### `scripts/on-stop` (F-1)

**Analog:** itself -- the fix connects two blocks already in this file.

**Current guardian invocation** (lines 453-461, exact):
```bash
# --- Phase 88-13 guardian: on-stop invariant verification + stale ghost pruning
# Runs every registered validator (minto-invariants + snapshot-integrity +
# queue-health + stale-lifecycle) AFTER the 88-06 drain + snapshot lands,
# writes .mindrian/invariant-report.json atomically, and CONSUMES
# stale-lifecycle ghost warnings to prune stale.json in-place. Timeout 1s
# so the guardian cannot eat into the 3000ms Stop-hook budget. Advisory
# (never exits non-zero). See 88-13-SUMMARY.md.
timeout 1 node "${PLUGIN_ROOT}/scripts/feynman-minto-guardian.cjs" on-stop "${ROOM_DIR}" >/dev/null 2>&1 || true
# --- end Phase 88-13 guardian on-stop ---
```

**Current final Stop-hook stdout contract, the fold-in target** (lines 543-550, exact):
```bash
SYSTEM_MESSAGE="$FINAL_SM" node -e "
  const msg = process.env.SYSTEM_MESSAGE || '';
  const out = {
    continue: true,
    systemMessage: msg
  };
  process.stdout.write(JSON.stringify(out) + '\n');
" 2>/dev/null || printf '{"continue": true}\n'

exit 0
```

**FINAL_SM construction immediately above** (lines 532-541, exact -- this is where the guardian's finding must be folded in):
```bash
FINAL_SM=""
if [ -n "$STOP_SUMMARY_LINE" ] && [ -n "$VOICE_SUMMARY_LINE" ]; then
  FINAL_SM="${STOP_SUMMARY_LINE} | ${VOICE_SUMMARY_LINE}"
elif [ -n "$STOP_SUMMARY_LINE" ]; then
  FINAL_SM="$STOP_SUMMARY_LINE"
elif [ -n "$VOICE_SUMMARY_LINE" ]; then
  FINAL_SM="$VOICE_SUMMARY_LINE"
else
  FINAL_SM="session ended: no active room"
fi
```

**Fix shape (per RESEARCH.md Anti-Patterns + Pitfall 1):** capture the guardian's own stdout (or read `.mindrian/invariant-report.json` after the guardian runs) into a shell var (e.g. `GUARDIAN_SM`), append it into `FINAL_SM` before the block at 543-550, and separately fix the `timeout 1 ... >/dev/null 2>&1 || true` line so a slow report-write still lands (raise/drop the timeout on the write/prune phase specifically, not the whole invocation). Capturing guardian stdout into a bash var: use `GUARDIAN_OUT=$(timeout 3 node ... on-stop "${ROOM_DIR}" 2>/dev/null || true)` then `node -e` to parse `GUARDIAN_OUT` for `.systemMessage`, mirroring the existing `PHASE88_START_MS=$(node -e "..." 2>/dev/null || echo 0)` capture idiom already used at line 339 of this same file.

---

### `scripts/feynman-minto-guardian.cjs` (F-1 runOnStop, F-2 severity + enqueue gate, F-3 runPreCommit)

**Analog for F-1:** itself, `runOnStop` (lines 335-434, full function already read). Key excerpt, the systemMessage emission the wrapper script must capture (lines 393-432):
```javascript
try {
  let worstIdx = -1;
  let worstSection = null;
  let worstCategory = null;
  let worstSeverity = null;
  for (const s of Object.keys(report.sections)) {
    const entry = report.sections[s];
    for (const v of (entry.violations || [])) {
      const idx = SEVERITY_ORDER.indexOf(v.severity);
      if (idx > worstIdx) {
        worstIdx = idx;
        worstSection = s;
        worstCategory = (v && v.category) || 'unknown';
        worstSeverity = v.severity;
      }
    }
  }
  if (worstIdx >= SEVERITY_ORDER.indexOf('error')) {
    const loc = worstSection === '__room__' ? 'room' : 'section ' + worstSection;
    const msg = 'guardian: ' + worstSeverity + ' in ' + loc + ' (' + worstCategory + ', glyph low)';
    const payload = { systemMessage: msg };
    process.stdout.write(JSON.stringify(payload) + '\n');
  }
} catch (_e) { /* advisory: never break on-stop on sysmsg failure */ }
return 0;
```
Note: `runOnStop` writes `.mindrian/invariant-report.json` via `writeJsonAtomic` (defined at lines 236-248, tmp+fsync+rename) BEFORE this systemMessage block runs (report write at ~382-385, prune at ~372-379, systemMessage at 393-432 -- all sequential). Any reordering for the "slow write must survive" half of F-1 (Open Question 3) means moving the report-write/ghost-prune earlier in this function, ahead of anything that could be slow.

**Analog for F-2 (existence-check severity):** the fix target itself, `validateSection` (lines 169-184, exact):
```javascript
function validateSection(roomDir, section, validators, ctx) {
  const sectionDir = path.join(roomDir, section);
  const all = [];
  // Existence check. If MINTO.md missing, emit one synthetic existence
  // violation so the report captures the contract breach without depending
  // on any one validator. The minto-invariants validator otherwise returns
  // null for missing MINTO (by design -- it's a content validator).
  if (!fs.existsSync(path.join(sectionDir, 'MINTO.md'))) {
    all.push({
      validator: 'existence-check',
      category: 'existence',
      severity: 'error',   // <-- F-2: change to 'critical'
      message: 'MINTO.md missing in section "' + section + '"',
      section: section,
    });
  }
  ...
```

**Analog for F-2 (enqueue gate, unchanged code, downstream consumer of the severity bump):** `runSessionStart` (lines 269-279, exact):
```javascript
function runSessionStart(roomDir, validators) {
  const ctx = { roomDir: roomDir, kind: 'session-start', now: Date.now() };
  const sections = walkSections(roomDir);
  const report = { version: 1, kind: 'session-start', at: new Date().toISOString(), sections: {} };
  for (const s of sections) {
    const result = validateSection(roomDir, s, validators, ctx);
    let action = 'none';
    if (result.severity === 'critical') {
      enqueueRegenSafe(roomDir, s, 'guardian:critical-repair');
      action = 'enqueued_regen';
    }
    ...
```
`enqueueRegenSafe` itself (lines 254-267) already wraps `require(DEBOUNCER_PATH)` + `dbnc.enqueue(...)` in try/catch with `logWarn` fallback -- this is the fail-open idiom to preserve, not touch.

**Analog for F-3:** the fix target, `runPreCommit` (lines 455-495, full function, exact):
```javascript
function runPreCommit(roomDir, validators) {
  const ctx = { roomDir: roomDir, kind: 'pre-commit', now: Date.now() };
  const staged = getStagedFiles();
  if (staged.length === 0) return 0;
  const sections = new Set();
  for (const rel of staged) {
    let normalized = rel;
    if (path.isAbsolute(rel)) {
      const rrel = path.relative(roomDir, rel);
      if (rrel.startsWith('..')) continue;
      normalized = rrel;
    }
    const parts = normalized.split(/[\/\\]/).filter(Boolean);
    if (parts.length === 0) continue;
    const section = parts[0];
    if (!fs.existsSync(path.join(roomDir, section, 'ROOM.md'))) continue;
    sections.add(section);
  }
  let worstSeverityIdx = -1;
  const messages = [];
  for (const s of sections) {
    const result = validateSection(roomDir, s, validators, ctx);
    for (const v of (result.violations || [])) {
      const idx = SEVERITY_ORDER.indexOf(v.severity);
      if (idx > worstSeverityIdx) worstSeverityIdx = idx;
      if (v.severity === 'critical' || v.severity === 'error') {
        messages.push('  [' + s + '] ' + v.severity + ': ' + (v.message || 'violation'));
      }
    }
  }
  if (worstSeverityIdx >= SEVERITY_ORDER.indexOf('error')) {
    process.stderr.write('[guardian] pre-commit blocked by Feynman-MINTO violations:\n');
    for (const m of messages) process.stderr.write(m + '\n');
    process.stderr.write('[guardian] Fix violations or use --no-verify (at your own risk).\n');
    return 2;   // <-- F-3: demote to WARN + return 0 by default, gated behind --strict/env
  }
  return 0;
}
```

**F-3's reuse idiom -- the FULL analog, `scripts/check-shape-declaration.cjs:894-916` (this repo, Phase 210), exact copy-pasteable source:**
```javascript
// Source: scripts/check-shape-declaration.cjs:894-916 (this repo, Phase 210)
const strict = argv.includes('--strict');
if (report.violations.length > 0) {
  if (strict) {
    // The pre-210 hard-fail contract, preserved as the --strict opt-in.
    console.error('strict mode: exiting 1 (--strict restores the pre-Phase-210 hard-fail contract)');
    process.exitCode = 1;
  } else {
    // Phase 210-02 (item 210-A): advisory default. Every violation is still
    // enumerated; only the exit-1 block is removed. Mirrors the doctor.cjs
    // WARN-not-fail pattern.
    console.error(
      'WARN: shape-declaration advisory (Phase 210): ' + report.violations.length +
        ' violation(s) detected; not blocking (run with --strict to restore hard-fail)'
    );
  }
}
```
**Applying this to `runPreCommit`:** keep the `process.stderr.write` enumeration block exactly as-is (this repo's Security-Domain section explicitly requires still enumerating every violation even when not blocking -- "never silently no-op"), change `return 2` to a WARN-reworded write + `return 0` UNLESS an opt-in flag (`--strict` CLI arg passed through `pre-commit-room-minto-guard.sh`, or `MINTO_PRECOMMIT_STRICT=1` env var) is set, in which case preserve `return 2`. `runPreCommit(roomDir, validators)`'s call site (the module's `main()`/CLI dispatcher, not shown above but visible at file top per the docstring's mode table) will need the `argv`/env check threaded in, mirroring `check-shape-declaration.cjs`'s `const strict = argv.includes('--strict');` line.

---

### `lib/core/feynman-minto-invariants.cjs` (F-2, governing_thought)

**Analog:** the SAME file's already-correct CRITICAL pattern for a sibling existence-style check (lines 269-284, exact -- this is the naming/shape to mirror):
```javascript
let stat;
try {
  stat = fs.statSync(filePath);
} catch (_err) {
  addViolation(
    violations,
    CATEGORIES.EXISTENCE,
    SEVERITY.CRITICAL,
    'File not found: ' + filePath
  );
  return {
    valid: false,
    violations: violations,
    severity: aggregateSeverity(violations),
  };
}
```

**Fix target itself** (lines 388-398, exact):
```javascript
if (
  typeof fm.governing_thought !== 'string' ||
  fm.governing_thought.length === 0
) {
  addViolation(
    violations,
    CATEGORIES.SCHEMA,
    SEVERITY.ERROR,   // <-- F-2: change to SEVERITY.CRITICAL
    'Missing or empty frontmatter field: governing_thought',
    'governing_thought'
  );
}
```
Note the sibling `schema_version` check immediately above (lines 379-387) uses the SAME `SEVERITY.ERROR` and is NOT named by RESEARCH.md as part of F-2's scope -- do not touch it unless the plan explicitly decides to (RESEARCH.md's F-2 code map cites only lines 388-398 for `governing_thought`).

---

### `lib/memory/validators/minto-invariants.cjs` (F-2 context -- DO NOT EDIT per RESEARCH.md's Anti-Patterns)

**Full file already read (62 lines).** The short-circuit RESEARCH explicitly warns against deleting:
```javascript
validate: function (sectionDir) {
  const mintoPath = path.join(sectionDir, 'MINTO.md');
  if (!fs.existsSync(mintoPath)) {
    // MINTO absence is handled by the guardian existence-check layer; this
    // validator is specifically about the content contract of an existing
    // MINTO.md. Returning null + empty here keeps aggregation deterministic.
    return { severity: null, violations: [] };
  }
  ...
```
This wrapper's `{severity: null, violations: []}` short-circuit is CORRECT design (two independent "missing file" signals is intentional layering per RESEARCH.md). The F-2 fix belongs ONLY in `scripts/feynman-minto-guardian.cjs:176-184` (guardian's own existence-check) and `lib/core/feynman-minto-invariants.cjs:388-398` (governing_thought). This file is reference-only for the plan, not an edit target.

---

### `scripts/hooks/pre-commit-room-minto-guard.sh` (F-3 exit-code propagation)

**Analog:** itself, lines 220-232 (exact, already the correct propagation shape -- likely needs a `--strict`/env passthrough addition, not a rewrite):
```bash
if [ -n "$_GUARDIAN_PLUGIN_ROOT" ] && [ -f "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" ] && command -v node >/dev/null 2>&1; then
  for _discovered_room in "${!_DISCOVERED_ROOTS[@]}"; do
    [ -z "$_discovered_room" ] && continue
    node "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" pre-commit "$_discovered_room"
    _GUARDIAN_EXIT=$?
    if [ "$_GUARDIAN_EXIT" -ne 0 ]; then
      echo "" >&2
      echo "MindrianOS pre-commit guard: commit blocked by feynman-minto-guardian in room: $_discovered_room" >&2
      echo "Fix violations or use --no-verify at your own risk." >&2
      exit "$_GUARDIAN_EXIT"
    fi
  done
fi

exit 0
```
Since F-3's fix makes `runPreCommit` return 0 by default (WARN, not block), THIS file needs no change for the default path -- exit 0 already propagates cleanly when the guardian itself returns 0. If the plan adds a `--strict` opt-in, this file's `node ... pre-commit "$_discovered_room"` call is where an extra arg (`--strict`) or env passthrough (`MINTO_PRECOMMIT_STRICT`) would be added, one line, no structural change. **Caution (Pitfall 4):** check Phase 235's completion status before editing this file -- it plans to consolidate the pre-commit hook to one canonical source.

---

### `scripts/minto-debouncer.cjs` (F-0 reference API, no changes)

**Exact exports** (line 353):
```javascript
module.exports = { enqueue, drain, peek };
```

**`enqueue(roomDir, section, reason)`** (lines 221-264) -- idempotent within the 10s `COALESCE_WINDOW_MS` coalesce window, throws `TypeError` on missing args, returns `{enqueued, coalesced}`.

**`drain(roomDir, opts)`** (lines 279-320, full function, exact -- this is the call any new consumer makes):
```javascript
function drain(roomDir, opts) {
  if (!roomDir || typeof roomDir !== 'string') {
    throw new TypeError('drain: roomDir (string) is required');
  }
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : 5000;
  const olderThanMs = (opts && typeof opts.olderThanMs === 'number') ? opts.olderThanMs : 0;

  const deadline = Date.now() + timeoutMs;
  const qp = queuePath(roomDir);

  if (!fs.existsSync(qp)) return [];
  if (Date.now() > deadline) return [];

  if (!tryAcquire(roomDir)) return [];
  try {
    if (Date.now() > deadline) return [];
    const queue = readQueueOrDefault(qp);
    const now = Date.now();
    const drained = [];
    const remaining = [];
    for (const e of queue.entries) {
      if (Date.now() > deadline) {
        remaining.push(e);
        continue;
      }
      const ts = Date.parse(e.enqueued_at);
      const age = Number.isNaN(ts) ? Number.POSITIVE_INFINITY : (now - ts);
      if (age >= olderThanMs) {
        drained.push(e);
      } else {
        remaining.push(e);
      }
    }
    if (drained.length > 0) {
      writeQueueAtomic(qp, { version: SCHEMA_VERSION, entries: remaining });
    }
    return drained;
  } finally {
    releaseLock(roomDir);
  }
}
```
Returns the drained entries array (`{section, enqueued_at, reason, attempts}[]`) -- this is what `intent-classifier.cjs`'s Option B nudge and the two stop-path discard sites (F-0) must actually INSPECT instead of discarding. `peek(roomDir)` (lines 330-351) is the read-only variant for a census/health-check without mutating the queue.

---

### `scripts/intent-classifier.cjs` (F-0/Option B target)

**Analog:** the module's own existing docstring contract (lines 1-27, exact) is the shape any new drain-and-nudge code must fit inside:
```javascript
/**
 * Phase 83-07: Mid-session intent classifier (Tier 2).
 *
 * UserPromptSubmit hook. Reads the user message from stdin (JSON payload
 * or raw text), scores it against every registered room plus every sealed
 * room under MindrianRooms, and writes a conversational warning to stdout
 * when the highest-scoring room is NOT the active room. Under the
 * UserPromptSubmit contract stdout is injected as additionalContext into
 * the conversation.
 *
 * Advisory only. Never blocks. Never exits non-zero on scope mismatch.
 * Only exits non-zero on internal error (and even then we prefer exit 0
 * so we do not pollute the conversation with error noise). Hard 200ms
 * budget; if exceeded mid-walk, exits 0 silently. Writes at most one
 * warning block per invocation.
 */
const BUDGET_MS = 200;
```
The existing `ZERO_SCORE_GATE_MIN_TOKENS` env-override idiom (lines 41-45, exact) is the pattern to copy for any new tunable this fix introduces (e.g. `olderThanMs` for the drain call):
```javascript
const ZERO_SCORE_GATE_MIN_TOKENS = (function () {
  const n = parseInt(process.env.MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS, 10);
  if (Number.isNaN(n) || n < 1) return 8;
  return n;
})();
```
**F-0/Option B fix shape (per RESEARCH.md Pattern 2):** inside the existing 200ms budget, add one `debouncer.drain(activeRoomDir, { olderThanMs: 30000 })` call (require `../scripts/minto-debouncer.cjs` or relative equivalent), and if the returned array is non-empty, append (or emit standalone) a one-line additionalContext nudge naming the pending sections, alongside/instead of the existing scope-mismatch warning already written to stdout. Do NOT add a network call, LLM call, or directory-wide re-scan inside this path.

---

### `lib/mcp/stop-gate-handler.cjs` (F-0 discard site B; Open Question 2 candidate for F-1)

**F-0 discard site, exact** (lines 124-133):
```javascript
function _closeOutMintoDrain(roomDir) {
  try {
    const debouncer = require(path.join(PLUGIN_ROOT, 'scripts', 'minto-debouncer.cjs'));
    if (typeof debouncer.drain !== 'function') return false;
    debouncer.drain(roomDir, { timeoutMs: 1500, olderThanMs: 0 });
    return true;
  } catch (_e) {
    return false;
  }
}
```
Same shape as `scripts/on-stop:345`'s CLI-side discard -- the drained array's return value is never inspected. Fix means either changing `olderThanMs` so this call stops vacuuming everything unconditionally, or (if this is also wired as an act-on-drain consumer) inspecting the return value the same way the `intent-classifier.cjs` fix does.

**Surrounding orchestration pattern, `closeOutRoom` (lines 232-239+, exact)** -- shows this file's existing best-effort/never-throw composition idiom, useful if F-1's Open Question 2 (Desktop/Cowork parity) is answered yes and a `_closeOutGuardianOnStop(roomDir)` sibling function needs to be added here, following the SAME shape as `_closeOutMintoDrain`/`_closeOutStateMd`/`_closeOutRecompile`:
```javascript
function closeOutRoom(roomDir, sessionId) {
  if (!roomDir || typeof roomDir !== 'string' || !fs.existsSync(roomDir)) {
    return { room_dir: null, sections: 0, stale: 0 };
  }
  _closeOutMintoDrain(roomDir);
  _closeOutRecompile(roomDir);
  const snap = _closeOutFolderMemorySnapshot(roomDir, sessionId);
  _closeOutStateMd(roomDir);
  ...
```
Every `_closeOut*` helper follows the identical try/catch-return-boolean pattern (see `_closeOutStateMd` 101-111, `_closeOutMemoryLifecycle` 113-122) -- a new `_closeOutGuardianOnStop` would use `execFileSync('node', [guardianPath, 'on-stop', roomDir], { timeout: N, encoding: 'utf8' })` mirroring `_closeOutStateMd`'s `execFileSync('bash', [...], { timeout: 2000, encoding: 'utf8' })` call at line 105, then parse the last stdout line for `{systemMessage}` the same way the CLI fix must.

## Shared Patterns

### Advisory-default / --strict opt-in demotion
**Source:** `scripts/check-shape-declaration.cjs:894-916` (Phase 210, full excerpt above)
**Apply to:** `scripts/feynman-minto-guardian.cjs`'s `runPreCommit` (F-3) only. This is the ONE reuse-before-build idiom RESEARCH.md names explicitly; do not invent a new flag naming scheme.

### Atomic write (tmp + fsync + rename)
**Source:** `scripts/feynman-minto-guardian.cjs:236-248` (`writeJsonAtomic`, already in use by `runOnStop`)
```javascript
function writeJsonAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const tmp = targetPath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    try { const fd = fs.openSync(tmp, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (_) {}
    fs.renameSync(tmp, targetPath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}
```
**Apply to:** any new write this phase introduces (there should be none beyond what already exists -- F-1/F-2/F-3 reuse existing writers).

### Fail-open require + call wrapping
**Source:** `scripts/feynman-minto-guardian.cjs:254-267` (`enqueueRegenSafe`)
**Apply to:** the `intent-classifier.cjs` F-0 fix's `require('.../minto-debouncer.cjs')` call -- wrap in the same try/catch-and-`logWarn`-or-silently-skip idiom so a missing/broken debouncer module cannot break the 200ms UserPromptSubmit budget.

### Env-var override with NaN/floor fallback
**Source:** `scripts/intent-classifier.cjs:41-45` (`ZERO_SCORE_GATE_MIN_TOKENS`)
**Apply to:** any new tunable this phase adds (e.g. F-3's `MINTO_PRECOMMIT_STRICT`, or an `olderThanMs` override for the F-0 drain call).

## No Analog Found

None. Every file in scope is an edit to an EXISTING module; RESEARCH.md's own Code Examples section already supplies verbatim current-state excerpts for every touch point, cross-checked and expanded above with full function bodies and neighboring context.

## Test Registry Pattern (for planner's Wave-0 test registration)

**Source:** `lib/memory/run-feynman-tests.cjs` (2069 lines total; `TEST_FILES` array starts line 33, this phase's neighborhood is lines 236-243 and 143 for the debouncer test).

**Exact registration idiom** (copy this shape for each new/extended test file):
```javascript
const TEST_FILES = [
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts.test.cjs'),
  ...
  // Phase 88-02: minto-debouncer queue (10s coalesce window + atomic
  // tmp+rename writes + write-lock composition). 12 tests: enqueue,
  // coalesce (earliest-wins), distinct sections, window-expired append,
  // drain olderThanMs, atomic write safety, ...
  path.join(REPO_ROOT, 'lib', 'memory', 'minto-debouncer.test.cjs'),
  ...
  // Phase 88-13: Feynman-MINTO guardian (scripts/feynman-minto-guardian.cjs)
  // with validator registry + four seed validators (minto-invariants,
  // snapshot-integrity, queue-health, stale-lifecycle). 16 tests: 10 core
  // modes (session-start, on-stop, pre-commit, clean-tmp) + 3 registry
  // (load + fail-open + id-collision) + 3 lifecycle validators ...
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-minto-guardian.test.cjs'),
];
```
Each entry is `path.join(REPO_ROOT, ...)` with a phase-tagged comment block immediately above describing WHAT the file tests and HOW MANY scenarios, in the exact prose style shown (phase number, one-line summary, scenario count, one clause per scenario). `REPO_ROOT = path.resolve(__dirname, '..', '..')` (line 31). Existing directly-relevant test files already registered: `lib/memory/minto-debouncer.test.cjs` (line 143), `lib/memory/feynman-minto-invariants.test.cjs` (line 117), `lib/memory/feynman-minto-guardian.test.cjs` (line 243). RESEARCH.md's Validation Architecture section names 4 NEW/extended test files this phase needs (`scripts/on-stop` end-to-end subprocess test for F-1's "reaches user" half, an injectable-slow-write test for F-1's second half, a production-call-site census extension to `feynman-minto-guardian.test.cjs` for F-0, and a real-git-commit integration test for F-3) -- each new file gets ONE new `path.join(REPO_ROOT, ...)` line with a `// Phase 241:` comment block in this exact style, inserted near its topically-nearest existing entry (e.g. the F-0 census test near line 143's debouncer entry or line 243's guardian entry; the F-3 real-commit test near line 243 or near `room-minto-hook.test.cjs` at line 80 which already does pre-commit-hook-adjacent work).

## Metadata

**Analog search scope:** `scripts/`, `lib/core/`, `lib/memory/`, `lib/memory/validators/`, `lib/mcp/`, `scripts/hooks/` -- all 8 files RESEARCH.md names, plus `scripts/check-shape-declaration.cjs` (Pattern 1 source) and `lib/memory/run-feynman-tests.cjs` (test registry source).
**Files scanned:** 10 (8 in-scope + 2 reuse-idiom sources)
**Pattern extraction date:** 2026-07-28
