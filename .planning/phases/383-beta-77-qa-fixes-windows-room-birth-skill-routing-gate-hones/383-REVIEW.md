---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
reviewed: 2026-11-05T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - lib/core/platform.cjs
  - lib/core/navigation/room-birth.cjs
  - lib/core/navigation/room-identity.cjs
  - lib/core/room-open.cjs
  - lib/core/room-auto-create.cjs
  - lib/core/graph-backfill.cjs
  - lib/core/doctor/room-runtime-module.cjs
  - lib/core/doctor/doubled-room-trees-module.cjs
  - lib/hmi/larry-reply-checks.cjs
  - lib/mcp/startup-operations.cjs
  - lib/mcp/tool-router.cjs
  - scripts/doctor.cjs
  - scripts/room-registry
  - scripts/session-start
  - scripts/check-voice-style.cjs
  - data/doctor-modules.json
  - data/harness-policies/voice-length.json
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 383: Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard (changed hunks since `de14e2dbd^`, plus callers read for context)
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The change set is sound on the main risks. Checked and found correct:

- No `shell: true` anywhere. All spawns use an argv array.
- No em-dash or en-dash in any changed line. No Brain or network call added (Canon Part 8).
- The resolver probes bash and Python by running them. It rejects the System32 and WindowsApps bash, any Windows bash whose `$OSTYPE` is not msys or cygwin, the Store stub (exit 9009 or the "Microsoft Store" and "was not found" text), and Python below 3.9.
- `birthRoom`, `prepareRoomCreation` and `autoCreatePlaceholderRoom` all run the environment check before the first write. In `prepareRoomCreation` the check runs before `mintCard`, so no gate is minted on a bad machine. The check repeats after the gate answer.
- In `scripts/room-registry`, the leak guard runs first, then the RPATH classification (drive path, absolute path, relative path), then `ensure_registry`. The non-Windows drive-path refusal happens before any write.
- The doubled-room delete is tightly bound. It uses unlink and rmdir only, with no recursive delete. It requires a byte-exact seed shape. It requires a real mirror room. It requires a digest match. It re-checks the shape and the symlink state of the leaf right before deleting. It is dispatched before the class-flag block in `doctor.cjs`, and the module exports no `fix`, so `--fix` and `--all` cannot reach it.
- The new regexes (`ROOM_RE`, `LENGTH_EXEMPT_RE`, the third-person matcher) have no nested quantifiers, so there is no ReDoS risk. The local `re` with the `g` flag has no shared `lastIndex` state.
- `bash tests/run-all-383.sh` ran here: PASS=16 FAIL=0.

No blocker was found. Five warnings and six info items follow.

## Warnings

### WR-01: Backslash UNC paths reach bash as raw arguments

**Status:** fixed in e049c2417

**File:** `lib/core/platform.cjs:446-448`
**Issue:** `spawnRoomRegistry` converts an argument to forward slashes only when it matches `/^[A-Za-z]:[\\/]/`. A UNC rooms home or room dir (`\\server\share\rooms`) does not match. It goes to bash with its backslashes intact, and bash eats them. The project rule says no backslash path may reach bash as a raw argument. I confirmed this with an injected `platform:'win32'` run. The argv contained `'\\\\srv\\share\\rooms'` unchanged. The same applies to a relative Windows path that uses backslashes.
**Fix:** Convert by shape of the value, not by drive prefix. Convert any argument that starts with `\\` or contains a backslash, for example `String(a).includes('\\') && /^(?:[A-Za-z]:|\\\\)/.test(a) ? toBashPath(a) : a`. Then `room-registry` should also accept `//server/share` as an absolute path. Its `case "$RPATH"` already treats a leading `/` as absolute.

### WR-02: Resolver probes block the event loop for up to many times 5 s, and a failure is never cached

**Status:** fixed in bb869a50f (30 s negative cache keyed on the probe env, 2 s probe timeout, pythonVersion reuses the cache)

**File:** `lib/core/platform.cjs:240-261, 336-352` and `lib/mcp/startup-operations.cjs:51, 67`
**Issue:** `resolveRoomRuntime` uses `spawnSync` with a 5000 ms timeout per candidate. On a broken Windows machine that is up to 6 bash candidates, a `where` call, and 4 Python candidates (twice for `py`). In the worst case that is more than 40 s of a blocked event loop inside the MCP server, which can trip the client timeout. Only an `ok` result is cached (`if (!injected && result.ok)`). So every `room_create` retry on a failing machine pays the full cost again. `room-open.pythonVersion` also passes `{env}`, which counts as injected, so it re-probes every time it is called.
**Fix:** Cache a failing result for a short time (for example 30 s), or cap the total probe budget (a deadline passed through `tried`). Skip the `where bash` call and the later Python candidates once a deadline passes. In `pythonVersion`, reuse the cached result when `env === process.env`.

### WR-03: `doubled-room-trees` listing truncates silently at 5000 entries, and the approved digest then covers a partial listing

**Status:** fixed in e7b5d5dda (sorted walk, `truncated` field, digest covers the partial mark, row says "partial listing")

**File:** `lib/core/doctor/doubled-room-trees-module.cjs:144-178`
**Issue:** `seen` counts entries across the whole rooms home, not per top-level folder. After `seen > MAX_ENTRIES` every remaining top folder breaks on its first entry. The listing is partial, and nothing says so. `check()` reports `ok` or lists fewer folders. The digest covers only what was reached. Traversal order is `stack.pop()` on `readdir` order, so which leaves survive a truncation depends on the filesystem. A navigator can approve a digest believing it is the whole list. The depth limit (16) also drops deeper folders without a note.
**Fix:** Return `truncated: true` in the listing when either limit trips. Have `check()` report `warn` with "listing incomplete, N entries scanned" and refuse to print a clean command. Make `clean()` return `{ ok:false, reason:'listing_truncated' }`. Sort `ents` before pushing so the order is deterministic.

### WR-04: `clean()` checks only the leaf for symlinks, not its parents

**Status:** fixed in c2bf133df (every parent lstat-checked and realpath-compared before each delete)

**File:** `lib/core/doctor/doubled-room-trees-module.cjs:247-263`
**Issue:** The "never follow a symlink" claim holds during the listing walk, because Dirent entries that are symlinks are skipped. At delete time `lstatSafe(leaf)` checks only the last path component. If an intermediate directory (`<home>/home`, `<home>/home/jsagi`) is replaced by a symlink between listing and clean, `lstat(leaf)` follows it. The unlink and rmdir then act outside the rooms home on any directory that happens to have the seed shape. The seed-shape check limits the damage to files byte-equal to the templates, so this is narrow. It still breaks the stated "never outside the rooms home" rule.
**Fix:** Before each delete, `lstat` every ancestor from `home` down (each must be a non-symlink directory). Also compare `fs.realpathSync(leaf)` to `path.join(fs.realpathSync(home), ...parts)` and skip the leaf on any difference.

### WR-05: The approval gate for `--clean-doubled-rooms` is by convention only

**Status:** skipped: decision, owner-run flag; documented in 7c28bcee1 (the digest is the consent token; the F.0 card is fired by the main session, D-02; a ledger-backed receipt is a later phase)

**File:** `scripts/doctor.cjs:3497-3528` and `lib/core/doctor/doubled-room-trees-module.cjs:239`
**Issue:** The digest is printed in the plain `check()` output (`action_lines`). Anyone, or any agent, that reads it can run `doctor --clean-doubled-rooms=<digest>` with no F.0 card and no `gate_answer`. The digest proves the list did not change. It does not prove a person approved it. The module header says the delete is "reached only after the navigator approves the F.0 card". Nothing in code enforces that, and no gate-ledger entry is checked or minted.
**Fix:** Either state in the header and the doctor help that this is a local, owner-run command and the card is doctrine only. Or bind the flag to a gate receipt: accept `--gate-id=<id>` and verify it against `gate-ledger` as an answered `approve` for this digest before calling `clean()`.

## Info

### IN-01: Failure shape is not uniform across `spawnRoomRegistry` results

**Status:** fixed in 97ddf456e

**File:** `lib/core/platform.cjs:469-487`
**Issue:** Only the `environment_not_ready` result carries `plain` and `tried`. The `timeout`, `spawn_error` and `exit_nonzero` results do not. `room-open.runRegistry` copies `plain` only for `environment_not_ready`, and otherwise falls back to a generic constant. This is correct today, but a caller that expects the documented `{ ok:false, reason, plain, tried }` on every failure will see `undefined`.
**Fix:** Add `plain: ''` and `tried: runtime.tried` to the three other failure objects. Or document that the shape applies to `environment_not_ready` only.

### IN-02: `MINDRIAN_BASH=bash` (a bare name) is rejected on Windows

**Status:** fixed in 5e0659971

**File:** `lib/core/platform.cjs:131-142` (`tryOne(cand, true)`)
**Issue:** Every entry in `fixedList` is checked with `exists(cand)`. A bare command name in `MINDRIAN_BASH` is never a file on disk, so it is recorded as `not_found`. I confirmed this with an injected run. The `where bash` fallback may still find a bash, but the explicit override is silently ignored.
**Fix:** Skip the `exists` check for a value with no path separator, or document that `MINDRIAN_BASH` must be an absolute path.

### IN-03: `room-registry` reports "py -3: not found" when `py` exists but `py -3` failed

**Status:** fixed in 656e2d44c

**File:** `scripts/room-registry:111-117`
**Issue:** `_rr_pyexe` is empty both when `py` is missing and when `py -3` exits non-zero (no Python 3 installed under the launcher). The tried list then says "not found" in both cases.
**Fix:** Record `py -3: failed` when `command -v py` succeeded and `_rr_pyexe` is empty.

### IN-04: Partial `clean()` failure prints no list of what was removed

**Status:** fixed in 68dfccd77

**File:** `scripts/doctor.cjs:3515-3522`
**Issue:** When `res.ok` is false and the reason is not `digest_mismatch`, the output says "Nothing more was deleted" and prints only the kept entries. It does not print `res.removed`, so a navigator cannot see which folders already went.
**Fix:** In that branch print `res.removed.forEach(...)` before the "Reason" line.

### IN-05: Comment says "fourth shadow rule" but the code labels it "Rule 5"

**Status:** fixed in c2de8cdf2

**File:** `scripts/check-voice-style.cjs:48, 222`
**Issue:** The header says "a fourth shadow rule", and the inline comment says "Rule 5". One of the two is stale and will mislead the next editor.
**Fix:** Make both say the same number. Count the rules in `scanTurn`.

### IN-06: `LENGTH_EXEMPT_RE` can exempt too much, and the CLI usage text names an unused flag

**Status:** fixed in 4b8b81bdf

**File:** `lib/hmi/larry-reply-checks.cjs:697` and `lib/core/platform.cjs:597`
**Issue:** `\bin full\b` and `\bin detail\b` match ordinary phrases such as "in full swing". The result is a shadow-log false negative, not a user-visible fault. Separately, the platform CLI usage string prints `room-runtime [--json]`, but `--json` is never read; the output is always JSON.
**Fix:** Tighten the exemption to request phrasings (for example `\b(?:answer|explain|show me) (?:it )?in (?:full|detail)\b`). Drop `[--json]` from the usage line, or read it.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
