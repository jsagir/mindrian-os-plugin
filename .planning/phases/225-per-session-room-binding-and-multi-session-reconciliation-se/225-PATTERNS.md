# Phase 225: Per-session room binding / multi-session reconciliation - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 3 (1 edit-in-place gate branch, 1 edit-in-place advisory check, 1 new test aggregator)
**Analogs found:** 3 / 3 (all analogs are siblings inside the SAME files being edited, or the
Phase-194 scaffold precedent named explicitly in RESEARCH.md)

No CONTEXT.md exists for 225. File list extracted from 225-RESEARCH.md's Standard Stack / Code
Examples / Validation Architecture sections.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `scripts/intent-classifier.cjs` (new zero-score gate branch, replaces line 509) | CLI hook / controller | request-response (stdin msg -> stdout JSON envelope) | The existing off-scope F.8 gate block, same file, lines 511-548 (`emitBindingGate` call site) | exact (same file, same function, adjacent branch) |
| `scripts/doctor.cjs` (new WAL-version advisory check) | CLI diagnostic / controller | request-response (invoked check -> stdout finding, never blocks) | The existing `--bind-check` never-block advisory block, same file, lines 2567-2615 | exact (same file, same never-block contract) |
| `tests/run-all-225.sh` (new) | test aggregator | batch | `tests/run-all-194.sh` (explicitly named as the scaffold in RESEARCH.md REQ-6 / Wave 0 Gaps) | exact (RESEARCH.md prescribes this analog directly) |
| `tests/test-225-zero-score-gate.cjs` (new) | test | request-response / unit-integration | `tests/test-binding-gate-degrade.test.cjs` (named in RESEARCH.md as "the degrade-pattern precedent") | role-match |

## Pattern Assignments

### `scripts/intent-classifier.cjs` (CLI hook, request-response) - the zero-score gate branch

**Analog:** the same file's existing off-scope F.8 gate, lines 493-548 (`best` scoring loop through
`emitBindingGate` call).

**The exact insertion point** (verified verbatim, line 509):
```javascript
// scripts/intent-classifier.cjs:504-509
if (!best || s.score > best.score) {
  best = { name: roomName, score: s.score, nameMatch: s.nameMatch, entityMatches: s.entityMatches };
}
// ...
if (!best || best.score === 0) return 0;   // <- THIS is the line the new branch replaces
```
Pitfall 1 (RESEARCH.md): on `best.score === 0`, `best.name` is corpus[0], not a real match --
never reuse `best.name` as a gate candidate in the new branch. Build a distinct options set
(session `primary` / "new project" / `NO_ROOM_LABEL`).

**Session-id + gate-call pattern to copy** (lines 520-526, the try/catch fail-open shape):
```javascript
let bindingGate = null;
try {
  const sessionId = resolveSessionId(resolveActiveRoomDir());
  bindingGate = _runBindingGate({ sessionId: sessionId, topRoom: best.name, home: root });
} catch (_e) {
  bindingGate = null; // fail-open: fall through to the legacy advisory
}
```
For the zero-score branch, replace `_runBindingGate` with a `readSessionBinding` read (see
`lib/core/session-binding.cjs` below) inside the identical try/catch/fail-open shape.

**Renderer composition pattern to copy verbatim** (`emitBindingGate`, lines 2095-2247):
- Lazy `require` of `lib/hmi/shape-f8-renderer.cjs` inside its own try/catch, returning `false` on
  any load fault (lines 2104-2112).
- Build an `options` array of `{ label, confidence }` where the pre-checked option gets `0.71`
  (the frozen 0.70 threshold + epsilon) and all others `0.10` (lines 2120-2136).
- Call `renderer.renderShapeF8({ options, header })`, guard `rendered && rendered.zones` (lines
  2138-2147).
- Trailer + side-channel composition, EACH in its own try/catch that never affects the rendered
  gate (lines 2166-2189) -- `selector-dispatcher.cjs::appendAskUserQuestionTrailer` and
  `card-fire-sidechannel.cjs::recordReachedGate`.
- `persistDecisionTrace(roomDir, sessionId, {...})` best-effort in its own try/catch (lines
  2217-2231) -- for the new gate, use a distinct `kind` (e.g. `'zero_score_gate'`) so
  `consumePriorBindingAnswer`'s sibling reader for this new gate is unambiguous.
- Final envelope shape: `{ hookSpecificOutput: { hookEventName: 'UserPromptSubmit',
  additionalContext }, systemMessage }`, written via `process.stdout.write(JSON.stringify(...))`
  with a raw-text last-resort fallback in its own try/catch (lines 2233-2245).
- Return `true` on success, `false` on any renderer/require fault -- the caller then falls through
  to `return 0` (legacy silence), never throwing.

**Error handling / never-block pattern** (Pitfall 3, REQ-3): every new try/catch in this file
degrades to `return 0` or `false`, never rethrows into the hook. Mirror lines 531, 537-548
verbatim: `if (bindingGate && !bindingGate.degraded && ...)` guards, `catch (_e) { /* fail-open */ }`.

---

### `scripts/doctor.cjs` (CLI diagnostic, request-response) - the WAL-version advisory check

**Analog:** the same file's `--bind-check` never-block block, lines 2567-2615.

**Pattern to copy** (never-block contract + report shape, lines 2578-2613):
```javascript
if (flags.bindCheck) {
  const presence = require(path.join(__dirname, '..', 'lib', 'core', 'session-presence.cjs'));
  // ... build a report object with { healthy, findings: [] }
  let report;
  try {
    report = presence.runBindCheck({ sessionId, roomDir, home });
  } catch (_) {
    report = { healthy: false, bound: [], primary: null, onScope: false, findings: ['bind-check-error'] };
  }
  if (flags.json) {
    console.log(JSON.stringify(report));
  } else {
    console.log((report.healthy ? 'OK' : 'ADVISORY') + '  doctor --bind-check: ' + (roomDir || '(no room dir)'));
    for (const f of (report.findings || [])) console.log('  - ' + f);
  }
  process.exit(0); // never-block: an unhealthy bind still exits 0 (advisory).
  return;
}
```
For REQ-4 (WAL advisory), the new check should follow the SAME shape: a cheap local probe
(`node:sqlite` version string compare + `session-presence.cjs::hasCoSession` per live room), a
`findings: []` array pushed with a WARN string only, and `process.exit(0)` (or fold into the
existing `--acceptance` roll-up using the WARN-not-fail idiom at doctor.cjs:1388-1390:
`finding = 'WARN: ' + ...`) -- never a hard-fail path. Per RESEARCH.md Code Examples:
```javascript
const { DatabaseSync } = require('node:sqlite');
const v = new DatabaseSync(':memory:').prepare('select sqlite_version() as v').get().v;
// semver-compare v < '3.51.3' AND session-presence.hasCoSession(...) for any active room
// -> WARN row (never a block)
```

---

### `lib/core/session-binding.cjs` (read-only dependency, not modified)

**Function to call:** `readSessionBinding(sessionId, opts)` (lines 55+). Wrapped in try/catch by
the caller; returns `safeDefault() = { bound: [], primary: null, sticky: false }` on any corrupt
or missing file (lines 21-25). Path-traversal guard `isSafeSlug` (lines 45-53) already rejects `..`
segments before any filename use -- reuse it, never re-derive a slug guard.

### `lib/core/session-presence.cjs` (read-only dependency, not modified)

**Function to call:** `hasCoSession(opts)` (lines 202-204), a thin wrapper over
`listLiveCoSessions(opts).length > 0`. Advisory/never-blocking by construction (comment at line
208: "liveness is advisory, so a false-live only keeps a file, it never blocks").

---

### `tests/run-all-225.sh` (test aggregator, batch)

**Analog:** `tests/run-all-194.sh` (full file header at lines 1-29, `run`/`run_if` helpers at
lines 31-52), explicitly named in RESEARCH.md REQ-6 and Wave 0 Gaps as the scaffold.

**Pattern to copy verbatim:**
```bash
#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}
```
Use `run_if` legs gated on each new test file's own existence (Wave-0-safe SKIP pattern) for
`test-225-zero-score-gate.cjs`, `test-225-gate-degrade.cjs`, `test-225-wal-advisory.cjs`. Per-wave
merge should ALSO invoke `bash tests/run-all-194.sh` as a regression guard (RESEARCH.md Sampling
Rate) -- add that as a final unconditional `run` leg, not a `run_if`.

---

## Shared Patterns

### Fail-open / never-block (Canon 83-07)
**Source:** `scripts/intent-classifier.cjs:531,537-548` and `scripts/doctor.cjs:2578-2613`.
**Apply to:** every new branch in both files. Every try/catch degrades to `return 0` / `false` /
`process.exit(0)`. Never throw into a hook; never a non-zero exit from an advisory check.

### Lazy `require` inside its own try/catch for cross-module composition
**Source:** `scripts/intent-classifier.cjs:2107-2111` (renderer), `2166-2169` (trailer),
`2175-2189` (side-channel), `scripts/doctor.cjs:2579` (presence).
**Apply to:** any new require of `session-binding.cjs`, `shape-f8-renderer.cjs`, or
`session-presence.cjs` from the zero-score gate branch or the doctor advisory check.

### Path-traversal guard reuse (Security V5)
**Source:** `lib/core/session-binding.cjs:45-53` (`isSafeSlug`), mirrored in
`lib/core/session-presence.cjs:40-44`.
**Apply to:** any new file path derived from a session-id or room slug. Do not re-derive; import
and reuse the existing guard.

### WARN-not-fail advisory string idiom
**Source:** `scripts/doctor.cjs:1388-1390` (`finding = 'WARN: ' + result.totalAmbiguous + ...`).
**Apply to:** the new REQ-4 WAL advisory finding string in `doctor.cjs`.

## No Analog Found

None. All three files-to-touch have exact same-file or explicitly-prescribed analogs (the phase is
gap-closure on a shipped substrate, per RESEARCH.md's central finding).

## Metadata

**Analog search scope:** `scripts/intent-classifier.cjs`, `scripts/doctor.cjs`,
`lib/core/session-binding.cjs`, `lib/core/session-presence.cjs`, `tests/run-all-194.sh`
**Files scanned:** 5 read directly this session (plus RESEARCH.md's own prior verified reads,
not re-read here to avoid duplicate ranges)
**Pattern extraction date:** 2026-07-15
