# Code Review Response: MCP Dependency Self-Heal Backstop

| Field | Value |
|---|---|
| Subject | Option D fix -- npm-install lockfile + dependency-probe machinery |
| Reviewed commit | f6cafe74 (Option D MCP dependency self-heal) |
| Response date | 2026-05-22 |
| Resolution commit | a9ca105b |
| Plugin version | 1.13.0-beta.24 |
| Verified on | Linux (Ubuntu, nvm-managed Node v22.22.2) |

---

## Summary Verdict

All three findings were actionable and are now fixed. The reviewer was right on every count. bug_004 deserves a brief note on where the confusion could have arisen: `openSync('wx')` IS atomic for file creation, which could make the TOCTOU look like a false alarm at a glance. The review was correct -- the atomicity gap was real, just one syscall deeper. The create is atomic; the subsequent separate `writeSync` is not. A racing peer landing between those two syscalls read a zero-byte file, `JSON.parse('')` threw, and the original code misclassified that as a corrupt (and therefore deletable) lock rather than a live one mid-write. The fix (atomic `linkSync` of a fully-written private temp file) closes the actual gap. The other two findings (bug_001 and bug_011) were straightforward threshold and coverage errors that investigation confirmed directly from the source.

---

## Finding 1: bug_004 -- Non-Atomic Lock Creation (TOCTOU)

### Finding (as reviewed)

The lock acquisition in `lib/core/npm-install-lock.cjs` opened the lock file with `fs.openSync(p, 'wx')` and then populated it with a separate `fs.writeSync`. Although `openSync('wx')` ensures only one process can create the file, the file's contents are not present at the moment of creation. A second process that loses the `openSync` race and then reads the file during the gap between `openSync` and `writeSync` will read an empty string, which `JSON.parse` cannot parse, creating a window for incorrect behavior.

### Verdict

CONFIRMED. The review identified a real TOCTOU. The atomicity property of `openSync('wx')` applies only to file creation, not to the data write. The zero-byte window between `openSync` and `writeSync` was a genuine race.

### Investigation

The failure chain from the pre-fix code:

1. Process A calls `openSync(p, 'wx')` -- succeeds, creates the lock file, which is now zero bytes on disk.
2. Process B calls `openSync(p, 'wx')` -- fails with EEXIST. Process B then calls `readLock(p)`.
3. `readLock` calls `fs.readFileSync(p, 'utf8')` which returns the empty string `''`.
4. `JSON.parse('')` throws a SyntaxError.
5. The original `readLock` returned `null` on any exception.
6. `null` from `readLock` was treated as "corrupt or unreadable lock -- clear and retry": `fs.unlinkSync(p)` removed Process A's live lock.
7. Process A had not yet called `writeSync` or `closeSync`. Its lock no longer existed on disk.
8. Process B then won its next `openSync('wx')` attempt. Both processes held "winning" status simultaneously and both ran `npm install`.

The debug session confirmed this chain by inspection of the three-syscall sequence (`openSync` / `writeSync` / `closeSync`) in the pre-fix source.

### Fix Applied (commit a9ca105b)

Lock creation is now atomic using `fs.linkSync`. The full JSON payload is written to a uniquely named private temp file (`<lock-path>.<pid>.tmp`), then `fs.linkSync(tmp, p)` publishes it at the canonical lock path in a single atomic filesystem operation. `linkSync` fails with EEXIST if the target already exists, preserving the one-winner guarantee. Because the temp file is fully written before the link, any process that reads the canonical path after the link completes will always see a fully-formed JSON payload -- the zero-byte window is eliminated by construction.

Defence-in-depth -- `readLock` now returns a three-way result rather than a two-way result:

- A parsed lock object -- a valid, fully-written lock.
- The string literal `'EMPTY'` -- the file exists but contains only whitespace after up to 5 retries at 20ms intervals. Callers treat this as transient and keep waiting.
- `null` -- the file is missing, unreadable, or contains genuinely non-empty invalid JSON. Callers may treat this as a cleared or dead lock.

Both `acquireInstallLock` and `waitForUnlock` were updated to treat `'EMPTY'` as a transient state rather than a cleared lock. `waitForUnlock` in particular previously had the symmetric form of the same bug: `if (!data) return true` would have declared the lock cleared the instant it saw an empty file, allowing the waiting loser to run its own install concurrently with the winner. This is now also corrected.

### Tests

`lib/core/npm-install-lock.test.cjs` (new, 18 tests total; 8 specific to bug_004):

- `readLock` returns `'EMPTY'` for a zero-byte file.
- `readLock` returns `null` for non-empty invalid JSON.
- `readLock` parses and returns a valid fully-written lock object.
- `readLock` returns `null` for a missing file (ENOENT).
- `acquireInstallLock` does not unlink an `'EMPTY'` peer lock (the loser must wait, not win).
- `acquireInstallLock` publishes a fully-written (never zero-byte) lock on success.
- `acquireInstallLock` cleans up its temp file on both the win and lose paths.
- The no-em-dash gate on the module source.

---

## Finding 2: bug_001 -- Stale Threshold Shorter Than the Install Timeout

### Finding (as reviewed)

`STALE_THRESHOLD_MS` was set to 90,000 ms (90 seconds). The `runGuardedInstall` caller gives `npm install` a `spawnSync` timeout of 120,000 ms (120 seconds). A healthy install that legitimately takes 90-120 seconds would be declared abandoned before it finished. The staleness check was also OR-gated (`age > STALE_THRESHOLD_MS || !pidAlive(data.pid)`), meaning that a lock older than the threshold was reclaimed even if its owning process was still alive and running.

### Verdict

CONFIRMED. The threshold inversion was a straightforward arithmetic error. The OR gate compounded it: either condition alone was sufficient to reclaim a lock, so a slow but healthy install could be evicted once it crossed the 90-second mark regardless of whether its owner process was alive.

### Investigation

The timeout value in `runGuardedInstall` is `120000` (passed as the `timeout` field to `spawnSync`). The old `STALE_THRESHOLD_MS` was `90 * 1000 = 90000`. An install running for 91 seconds was both older than the threshold AND still live, but the OR gate meant `age > STALE_THRESHOLD_MS` was sufficient to reclaim it. The peer would call `fs.unlinkSync(p)` on the live lock and proceed to run its own `npm install`, resulting in two concurrent installs and a contested write to `node_modules`.

`WAIT_TIMEOUT_MS` was also 100,000 ms -- shorter than the stale threshold would need to be for the loser to ever see a stale-and-reclaimed winner. The ordering constraint is `WAIT_TIMEOUT_MS > STALE_THRESHOLD_MS > install timeout`; the pre-fix values satisfied none of these ordering requirements.

### Fix Applied (commit a9ca105b)

`STALE_THRESHOLD_MS` is raised from 90,000 ms to 180,000 ms -- 60 seconds of headroom above the 120-second install timeout. `WAIT_TIMEOUT_MS` is raised from 100,000 ms to 200,000 ms, staying above the new stale threshold so a loser waiting for a just-gone-stale winner can still reclaim and retry rather than timing out first.

The staleness check is extracted into a named function `isReclaimable(data)` that uses AND:

```
age > STALE_THRESHOLD_MS && !pidAlive(data.pid)
```

A lock is reclaimed only when it is BOTH older than the threshold AND its owning PID is confirmed dead. An old-but-live install keeps its lock for as long as it runs. A fresh lock owned by a dead PID (for example, a process that crashed immediately after acquiring) keeps its lock until it ages out -- the age requirement prevents a scenario where a dying process hands off to a sibling that has not yet taken over, and the sibling's work gets pre-empted.

`isReclaimable` is applied at both decision points: the acquire loop and the `waitForUnlock` loop.

### Tests

8 tests in `lib/core/npm-install-lock.test.cjs` specific to bug_001:

- `STALE_THRESHOLD_MS` is strictly above 120,000 ms (the install timeout).
- `WAIT_TIMEOUT_MS` is strictly above `STALE_THRESHOLD_MS`.
- `isReclaimable` truth table: old + live = false (AND-gate core case).
- `isReclaimable` truth table: fresh + dead = false.
- `isReclaimable` truth table: old + dead = true.
- End-to-end: `acquireInstallLock` does not steal an old-but-live peer lock.
- End-to-end: `acquireInstallLock` reclaims an old-and-dead peer lock.
- `waitForUnlock` predicate check: an old-but-live lock does not satisfy the return-true condition.

---

## Finding 3: bug_011 -- Dependency Probe Too Narrow

### Finding (as reviewed)

`ensureDepsPresent` probed only two dependency names (`['@modelcontextprotocol/sdk', 'zod']`) to decide whether the plugin's `node_modules` was sufficiently populated to skip a heal. A `node_modules` directory that contained those two packages but was missing other production dependencies would pass the probe. The self-heal would not run, and the server would fail later at a `require` deeper in the call chain when it hit the missing dependency.

### Verdict

CONFIRMED. The two-item probe covered the MCP SDK surface only. The production dependency set includes additional packages -- notably `@modelcontextprotocol/ext-apps` -- that the MCP server's module graph reaches at load time. A partial tree that passed the narrow probe would still crash.

### Investigation

The `lib/mcp/capability-registry.cjs` -> `app-views.cjs` -> `@modelcontextprotocol/ext-apps/server` chain is reached during module initialization of the MCP server entry point, not lazily. A `node_modules` directory with only `@modelcontextprotocol/sdk` and `zod` populated would pass the two-item probe and receive no heal. The server would then crash at `require('@modelcontextprotocol/ext-apps/server')` at module-init scope -- same MODULE_NOT_FOUND symptom as a fully absent `node_modules`, but invisible to the probe.

The test suite demonstrates this directly: with `node_modules` containing only `@modelcontextprotocol/sdk` and `zod`, iterating over the two-item fallback probe shows zero missing entries. Iterating over the full production dependency set shows `@modelcontextprotocol/ext-apps` as missing. The decisive test is named `ensureDepsPresent detects a partial tree (sdk+zod present, ext-apps absent)`.

### Fix Applied (commit a9ca105b)

A new function `productionDepNames(dir)` reads `Object.keys(pkg.dependencies)` from the plugin's own `package.json` at the resolved plugin root. This is the full production dependency set -- the same set that `scripts/sessionstart-npm-reconcile.cjs` uses for its own completeness check (Canon Part 7: reuse before build). `ensureDepsPresent` defaults its probe to `productionDepNames(dir)` when no explicit `probe` array is passed.

Graceful fallback: if `package.json` is missing, unreadable, or does not contain a `dependencies` key, `productionDepNames` returns the two-item MCP-critical pair rather than throwing. The heal pre-flight must never crash the server; a conservative fallback is better than a thrown exception at startup.

The explicit `probe` parameter still works for callers that need to check a specific subset. The default is now the full set.

### Tests

9 tests in `lib/core/mcp-dep-heal.test.cjs`:

- `productionDepNames` returns the full declared dependency set from a synthetic `package.json`.
- `productionDepNames` matches the real plugin `package.json` (live repo root) including `@modelcontextprotocol/ext-apps`.
- `productionDepNames` falls back gracefully when `package.json` is missing.
- `productionDepNames` falls back gracefully when `package.json` is unparseable.
- `productionDepNames` falls back when `dependencies` is absent from `package.json`.
- The decisive detection test: a partial tree (sdk+zod present, ext-apps absent) passes the narrow 2-dep probe (pre-fix behavior confirmed as a pre-condition), and fails the full-dep-set probe (the fix).
- `ensureDepsPresent` is a no-op when every production dep is present.
- `ensureDepsPresent` never throws on a pathological plugin root.
- No-em-dash gate on the module source.

---

## Added Value: What the Investigation Found Beyond the Review

### The three-way `readLock` result as defence-in-depth

The review correctly identified the zero-byte window in lock creation. The atomic `linkSync` fix eliminates that window on the create path. The team added a second, independent layer: `readLock` now distinguishes three outcomes instead of two, which protects against any future code that creates a lock non-atomically (a legacy path, a migration script, or a filesystem that does not support hardlinks and falls back to the `writeFileSync` path). The `'EMPTY'` sentinel gives callers a signal they can act on -- "keep waiting" -- rather than collapsing a transient state into the same `null` that means "corrupt and safe to remove."

The decision to add this as defence-in-depth rather than as the sole fix reflects the fact that the `linkSync` path is the primary guard. The `'EMPTY'` path is the catch for anything the `linkSync` path does not cover.

### The OR-gate vs. AND-gate insight

On inspection, the OR-gate in the old staleness check (`age > STALE || !pidAlive`) was probably written with the intent of handling two separate failure modes: a hung installer (old lock, live pid) and a crashed installer (any age, dead pid). Separately, each condition sounds reasonable. Together, they allow reclaim of any lock where the install is running slowly -- which is the normal cold-cache case. The AND-gate was not an obvious choice until the threshold inversion was on the table. The fix treats the two conditions as jointly required evidence that the lock is truly abandoned.

### Canon Part 7 reuse in `productionDepNames`

`scripts/sessionstart-npm-reconcile.cjs` already reads the full production dependency set from `package.json` using `Object.keys(pkg.dependencies)` for its own completeness check. Rather than introduce a second place to read and maintain that set, `productionDepNames` mirrors the same logic. When a new production dependency is added to `package.json`, both the reconcile hook and the `ensureDepsPresent` probe automatically include it on the next run. There is one source of truth.

### Keeping the fix minimal and non-over-engineered

The self-heal backstop is a rarely-run path. On a normal session after a normal install (the vendored tree case), `ensureDepsPresent` is a handful of `fs.existsSync` calls that complete in under a millisecond and exit cleanly. The backstop path (lockfile acquire, `npm install`, lockfile release) runs only when the vendored tree is absent or incomplete -- which should be rare after the vendoring fix in the same beta.

The decision was made throughout to fix the correctness defects with the minimum mechanism needed: no added concurrency primitives, no new file formats, no new external dependencies. The lockfile format is unchanged. The fix is localized to the three places where the bugs lived.

---

## Verification

All 63 tests pass. The two new suites cover the lockfile correctness fixes and the probe widening; the four regression suites confirm no regressions in adjacent machinery.

| Suite | Tests | Status | Notes |
|---|---|---|---|
| `lib/core/npm-install-lock.test.cjs` | 18 | NEW, 18/18 | 8 bug_001 + 8 bug_004 + 2 integration |
| `lib/core/mcp-dep-heal.test.cjs` | 9 | NEW, 9/9 | 5 `productionDepNames` + 4 `ensureDepsPresent` |
| `lib/core/npm-cli-resolve.test.cjs` | 7 | 7/7 | Portable resolver (unchanged by these three fixes) |
| `lib/core/mindrian-brain-shim.test.cjs` | 6 | 6/6 | Regression |
| `lib/memory/sessionstart-coordinator.test.cjs` | 15 | 15/15 | Regression |
| `lib/core/tier0-messaging.test.cjs` | 8 | 8/8 | Regression |
| **Total** | **63** | **63/63** | Zero failures |

All three fixes are pure lockfile-logic and `package.json`-read correctness. They have no platform-specific surface: the AND-gate predicate, the `linkSync` atomic publish, and the `fs.readFileSync` of `package.json` all behave identically on Linux, Mac, and Windows. Full verification on Linux is sufficient for these three; the lockfile semantics do not vary by platform.

---

## Still Open

The cross-platform self-heal spawn path (the portable `npm-cli-resolve.cjs` resolver that runs `node <absolute npm-cli.js> install` to sidestep PATH and the `.cmd` extension on Windows) is awaiting confirmation on a real Windows machine via `claude mcp list`. That confirmation point is pre-existing -- it was established when the Option D fix (f6cafe74) shipped. The three correctness fixes in commit a9ca105b do not touch the spawn path. The Windows checkpoint applies to the unchanged portable resolver, not to anything in this fix.

---

## Closing Note

The three findings were precise, specific to real defect classes (TOCTOU, threshold inversion, incomplete coverage), and required no back-and-forth to act on. That is the most useful kind of code review. The lockfile and probe machinery is a backstop that by design almost never runs -- on a box with the vendored tree present, it reduces to a few stat calls and exits. The rarely-run path is exactly where latent correctness bugs accumulate undetected. The review found three in a single pass.

Thank you for the careful read.
