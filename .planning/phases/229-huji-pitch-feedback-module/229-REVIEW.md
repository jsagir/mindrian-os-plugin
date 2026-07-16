---
phase: 229-huji-pitch-feedback-module
reviewed: 2026-07-16T12:53:44Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/huji-run-one-async.cjs
  - lib/memory/huji-run-one-async-parity.test.cjs
  - scripts/huji-pin-smoketest.cjs
  - tests/run-all-229.sh
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 229: Code Review Report

**Reviewed:** 2026-07-16T12:53:44Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the CASCADE-06 async twin (`runOneAsync`), its D14 sync/async parity gate, the
external-pin live smoketest probe, and the phase-229 aggregator shell script.

`runOneAsync` is a careful, faithful mirror of the shipped sync `runOne` (verified by direct
diff against `scripts/huji-run-one.cjs`, and by actually running the D14 parity test, which
passes). The one genuinely new translation point (`runClaudeAsync`, mapping `execFile`'s
reject-on-non-zero-exit semantics back onto `spawn-sync`'s `{status, error}` shape) is
correctly handled for the normal-non-zero-exit, ENOENT/spawn-failure, and timeout cases.

However, the function's own JSDoc explicitly labels `opts.subId` as **"untrusted external
input"** (it is the one value this async twin is specifically built to accept from a remote
MCP daemon caller), and that value is interpolated directly into `path.join()` calls that
control where files get created and written, with zero sanitization beyond "is a non-empty
string." This is a directory-traversal bug (present in the sync original too, but it lives
directly in the file under review and is worth fixing here regardless of provenance).

Beyond that headline finding, the async twin also reintroduces most of the synchronous,
blocking filesystem work it exists to route around (only the two `claude` spawns were
converted), and provides no protection against two concurrent calls for the same `subId`
racing on the same output/room paths — a hazard the sync twin didn't have to worry about
because its blocking nature incidentally serialized same-process calls. The pin-smoketest
probe has a temp-directory cleanup gap and a couple of minor logic/comment inconsistencies.
The parity test and the shell aggregator are solid; only minor consistency nits were found
there.

## Critical Issues

### CR-01: Unsanitized, attacker-documented "untrusted" subId used directly in filesystem path construction (directory traversal)

**File:** `scripts/huji-run-one-async.cjs:167,195,199-202`
**Issue:** The function's own JSDoc states `opts.subId` is `"the submission id (untrusted
external input)"` — this is the parameter explicitly designed to arrive from the external
MCP daemon this file was built to serve. The only validation applied is:

```js
if (typeof subId !== 'string' || subId.length === 0) return { ok: false, reason: 'invalid_subId' };
```

Immediately after, `subId` is interpolated directly into two `path.join()` calls that
control real filesystem writes:

```js
const unitOut = path.join(outDir, subId);
fs.mkdirSync(unitOut, { recursive: true });
const roomsDir = config.roomsDir || path.join(outDir, '..', 'rooms');
const roomDir = path.join(roomsDir, subId);
```

A `subId` such as `"../../../../tmp/pwn"` (or an absolute path, which `path.join` also
happily honors as a path segment on POSIX when combined with `..` traversal) escapes
`outDir`/`roomsDir` entirely. `scaffoldScratchRoom` then creates a directory tree and writes
`STATE.md`, `.config.json`, and a SQLite `room.db` at the attacker-chosen location; later,
`evidence.json`, `feedback.md`, `result.json`, and a `.done` marker are written there too.
This is a directory-traversal / arbitrary-directory-write primitive reachable from the one
input this file explicitly documents as untrusted. (The identical unsanitized pattern exists
in the sync ground-truth `scripts/huji-run-one.cjs:460-463`, so this is not new to the async
twin, but the vulnerable code executes directly in the file under review and should be fixed
here — and reported upstream for the sync twin — regardless of origin.)

**Fix:** Reject any `subId` that is not a safe path segment before it reaches `path.join`,
e.g.:

```js
const SAFE_SUB_ID = /^[A-Za-z0-9_-]{1,128}$/;
if (typeof subId !== 'string' || !SAFE_SUB_ID.test(subId)) {
  return { ok: false, reason: 'invalid_subId' };
}
```

and/or verify post-join containment as a defense-in-depth belt:

```js
const unitOut = path.join(outDir, subId);
if (path.relative(outDir, unitOut).startsWith('..')) {
  return { ok: false, reason: 'invalid_subId' };
}
```

Apply the same guard to `roomDir`'s construction. Given the STABILITY CONTRACT freezes the
reason-code set, `invalid_subId` is already available as the correct reason for this
rejection — no new reason code is required.

## Warnings

### WR-01: No re-entrancy guard for concurrent duplicate-subId calls

**File:** `scripts/huji-run-one-async.cjs:199-292`
**Issue:** The entire point of this file is to let an MCP daemon run multiple grading jobs
concurrently in one event loop (per the file's own header: "a long-lived Node event-loop
process ... must NEVER call the blocking spawn-sync primitive"). But nothing prevents two
concurrent `runOneAsync` calls for the *same* `subId` from racing on the identical
`unitOut`/`roomDir` paths: both would call `scaffoldScratchRoom` on the same `roomDir`
concurrently (concurrent `mkdirSync`, `STATE.md`/`.config.json` writes, `openRoomDb`/
`closeRoomDb` on the same SQLite file), and both would later `fs.writeFileSync` the same
`evidence.json`/`feedback.md`/`result.json`/`.done`. The sync twin (`runOne`) never had to
guard against this because `spawn-sync` blocks the whole process, so two same-process calls
could never physically overlap; the async twin removes that incidental protection without
adding an explicit one. This is exactly the kind of hazard a concurrency-enabling twin should
close, and it isn't mentioned anywhere in the STABILITY CONTRACT as a caller obligation.
**Fix:** Either document explicitly that callers MUST serialize by `subId` (and have the
external repo enforce it), or add an in-process guard (e.g. a `Map<subId, Promise>` the
function checks/sets at entry and returns the in-flight promise for a duplicate submission).

### WR-02: The "non-blocking" twin still performs multiple synchronous, blocking filesystem operations

**File:** `scripts/huji-run-one-async.cjs:200,205,228,231,255,269,272,274`
**Issue:** The header comment frames this file's entire reason for existing as keeping "the
loop stays free" by replacing `spawn-sync` with `execFile`. In practice, only the two
`claude` invocations were converted; everything else in the function remains fully
synchronous: `fs.mkdirSync` (200), the imported `scaffoldScratchRoom` (mkdirSync +
`writeFileSync`/`renameSync` x2 + `openRoomDb`/`closeRoomDb`, 205), `fs.writeFileSync` for
evidence.json (228), the imported `populateRoom` (231, itself presumably doing further sync
SQLite writes), `fs.writeFileSync` for feedback.md (255) and result.json (269),
`fs.readFileSync` of the full transcript (272), and `runGuardrails` (274, which itself does a
synchronous `fs.readFileSync` of the Brain query log inside `huji-run-one.cjs`). Individually
each is fast, but collectively this means the "MCP-daemon-safe" twin still blocks the event
loop for a nontrivial, unbounded (SQLite I/O, disk contention under concurrent load) portion
of every call — undermining the stated non-blocking guarantee this file exists to provide,
especially under the concurrent-daemon load scenario the file is designed for.
**Fix:** At minimum, document this as an accepted limitation (the docstring currently implies
totality: "the loop stays free"). If tightened further is needed, convert the hot-path
`fs.*Sync` calls here to `fs.promises` equivalents; the imported synchronous helpers
(`scaffoldScratchRoom`, `populateRoom`, `runGuardrails`) would need their own async twins to
fully close this gap, which is a larger follow-up.

### WR-03: Temp-directory cleanup is not guaranteed on exception (leaks a full git clone + scratch dir)

**File:** `scripts/huji-pin-smoketest.cjs:369-371,401,439-451`
**Issue:** `cloneParent` (line 369, containing a full local clone of the repo once the `git
clone` at line 374 succeeds) and `scratchCwd` (line 401) are created via `mkdtempSync` outside
of any `try/finally`. `cleanup()` is only invoked explicitly at specific points along the
happy/known-failure paths (e.g. lines 383, 394, 428). If an exception is thrown between
`scratchCwd`'s creation (401) and the final `cleanup([cloneParent, scratchCwd])` call (428) —
for example if `fs.mkdtempSync` itself throws (disk full, `/tmp` permission issue), or if
`writeFindings()`'s `fs.mkdirSync`/`fs.writeFileSync` (lines 299-300) throws — the exception
propagates to the outer `try { main(); } catch (e) { console.error(...); process.exit(1); }`
(lines 446-451), which does **not** call `cleanup()`. This leaks a full repo clone and a
scratch directory under the OS temp dir on every such failure.
**Fix:** Wrap the clone/spawn/classify/write lifecycle (from `cloneParent`'s creation through
`writeFindings`) in a single `try { ... } finally { cleanup([cloneParent, scratchCwd].filter(Boolean)); }`.

## Info

### IN-01: `--tag` with a missing value silently falls through to auto-detection

**File:** `scripts/huji-pin-smoketest.cjs:308-309`
**Issue:** `const overrideTag = tagFlagIdx !== -1 ? argv[tagFlagIdx + 1] : null;` — if `--tag`
is the last argument (no value follows), `argv[tagFlagIdx + 1]` is `undefined`, and
`if (overrideTag)` at line 345 is falsy, so the script silently ignores the flag and
auto-detects the newest recipe-bearing tag instead of erroring. A user who mistypes the
invocation gets a different, unannounced tag pinned rather than a clear usage error.
**Fix:** Treat a present-but-valueless `--tag` as a hard usage error:
```js
if (tagFlagIdx !== -1 && (tagFlagIdx + 1 >= argv.length)) {
  console.error('FAIL: --tag requires a value'); process.exit(1);
}
```

### IN-02: Hardcoded recipe version-band assumption is fragile to future release drift

**File:** `scripts/huji-pin-smoketest.cjs:98-107`
**Issue:** `listCandidateTags()` only accepts tags where `(major===1 && minor===15 &&
patch===3)` or `>= v1.16.0`. This is an intentional, documented snapshot of "the band that
first carries the recipe" today, but nothing re-verifies that assumption going forward: a
future recipe-bearing patch release at, say, `v1.15.4-beta.x` (before `v1.16.0` ships) would
be silently excluded from candidates, producing a false `no_tag_with_recipe`/stale-pin
verdict even though a valid newer tag exists.
**Fix:** Either broaden the band check (e.g. accept any `v1.15.x` where `x >= 3`), or add a
comment/CI reminder to revisit this band whenever a new `v1.15.x` line is cut.

### IN-03: `grepCount` builds a shell command string instead of using `execFileSync` with an argument array

**File:** `lib/memory/huji-run-one-async-parity.test.cjs:58-66`
**Issue:** `execSync(\`grep -RInE "${pattern}" "${dir}" --include='*.cjs' --include='*.js'\`, ...)`
interpolates `pattern`/`dir` into a shell string. Both call sites currently pass hardcoded
literals (`REPO`-relative paths, a fixed regex), so this is not exploitable today, but it's
an inconsistent pattern versus the rest of this phase's code (`scripts/huji-pin-smoketest.cjs`
consistently uses `execFileSync(cmd, [args...])` with no shell), and it becomes a command
injection risk the moment either argument is derived from anything less trusted.
**Fix:** Use `execFileSync('grep', ['-RInE', pattern, dir, '--include=*.cjs', '--include=*.js'], {...})`.

### IN-04: Parity test reads `scripts/huji-batch.cjs` without an existence guard, relying on a bare crash for the missing-file case

**File:** `lib/memory/huji-run-one-async-parity.test.cjs:167-172`
**Issue:** `tests/run-all-229.sh`'s D14 leg (line 128) guards this test's invocation only on
`scripts/huji-run-one-async.cjs` existing, not on `scripts/huji-batch.cjs`. Inside the test,
`fs.readFileSync(batchPath, 'utf8')` (batchPath = `scripts/huji-batch.cjs`) has no
`fs.existsSync` check first. If a future partial-phase-landing scenario has
`huji-run-one-async.cjs` present but `huji-batch.cjs` absent, this throws an uncaught ENOENT
that's only caught by the generic top-level `run().catch` handler (lines 239-242), producing
a raw stack trace instead of a targeted assertion message. Currently both files exist, so
this doesn't fire, but the guard is incomplete relative to what the test actually depends on.
**Fix:** `assert.ok(fs.existsSync(batchPath), 'scripts/huji-batch.cjs missing')` before reading it.

### IN-05: Comment claims "shallow-clone" but the `git clone` invocation has no `--depth` flag

**File:** `scripts/huji-pin-smoketest.cjs:368-374`
**Issue:** The comment at line 368 reads "Shallow-clone the resolved tag into a fresh dir
OUTSIDE this repo", but the actual command (`git clone --quiet --branch <tag> REPO_ROOT
clonePath`) has no `--depth` argument, so it performs a full local clone of the entire repo
history (hardlinked, so reasonably cheap on the same filesystem, but not "shallow" in the git
sense). Either the comment is inaccurate or the intended optimization was dropped.
**Fix:** Add `--depth`, `'1'` to the args array if a shallow clone was intended, or correct
the comment to say "local clone (hardlinked objects)" to match the code.

---

_Reviewed: 2026-07-16T12:53:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
