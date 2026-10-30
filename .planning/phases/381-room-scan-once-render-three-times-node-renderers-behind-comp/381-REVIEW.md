---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
reviewed: 2026-10-30T05:00:00Z
depth: deep
base_sha: 65aaf329f
files_reviewed: 10
files_reviewed_list:
  - lib/core/room-scan.cjs
  - lib/core/room-render.cjs
  - lib/core/room-render-team.cjs
  - lib/core/room-render-analyze.cjs
  - lib/core/room-render-state.cjs
  - lib/mcp/stop-gate-handler.cjs
  - scripts/compute-team
  - scripts/analyze-room
  - scripts/compute-state
  - scripts/session-start-state
findings:
  critical: 0
  high: 2
  medium: 5
  low: 12
  total: 19
status: issues_found
---

# Phase 381: Code Review Report

**Reviewed:** 2026-10-30
**Depth:** deep (call chains traced into scripts/on-stop-state, scripts/session-start, lib/core/state-version.cjs, lib/core/scaffold-predicate.cjs, lib/vault/wikilink-builder.cjs, lib/core/intelligence-cascade.cjs, lib/core/room-ops-sync.cjs)
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The review looked only for defects that the parity harness cannot catch. Parity compares the new bytes with the old bash bytes, so it keeps every old hazard and it never runs on a host, a Node version or a timing that the fixtures do not have.

Two findings are HIGH:

- All three writers follow symlinks out of the room. A planted symlink causes a file outside the room to be overwritten (PROVEN on a scratch room).
- The new Node floor and the "node not on PATH" exit turn a working bash step into exit 1. The Stop hook then writes the literal text `# Data Room State\n\nError computing state.` over STATE.md (PROVEN with the test seam).

The rest are concurrency, resource and portability defects. No finding breaks Canon Part 8. The renderers and their transitive requires contain no network module, no URL and no Brain call.

Evidence legend: PROVEN = ran on a scratch copy in the session scratchpad. CODE = derived from the cited lines, not run. ASSUMED = could not run on this host (aarch64 Linux, Node v22.23.1, bash 5.2.21).

## Narrative Findings (AI reviewer)

## High

### HI-01: Every renderer write follows a symlink out of the room (TEAM-STATE.md, PROFILE.md.tmp, wikilink sweep)

**Files:**
- `lib/core/room-render-team.cjs:498` (`fs.writeFileSync(teamDir + '/TEAM-STATE.md', ...)`)
- `lib/core/room-render-team.cjs:569-577` (fixed `file + '.tmp'`, then `renameSync`)
- `lib/core/room-render-analyze.cjs:575-601` (`path.resolve(src)`, then `fs.writeFileSync(filePath, ...)`)
- `lib/core/room-scan.cjs:498-514` (`globFiles` keeps symlinks to files as section files)

**Issue:** The module header promises T-381-02 ("No walk ever enters a symlinked directory"). The writes do not honour that rule. Parity cannot catch this, because the old bash (`> file`, `awk > "$2.tmp" && mv`, `wikilink-file.cjs`) had the same behaviour. A room that comes from someone else (a shared Cowork folder, a cloned repository, an unpacked archive) can carry a planted symlink. One SessionStart or one Stop then damages a file outside the room. PROVEN on scratch rooms:

1. `team/TEAM-STATE.md -> <outside>/victim.txt`. Running `scripts/compute-team <ROOM>` replaced the outside file with the TEAM-STATE text.
2. `team/p1/PROFILE.md.tmp -> <outside>/victim3.txt`. The PROFILE.md has a `## Contributions` heading. Running `scripts/compute-team <ROOM>` wrote the whole rewritten profile into the outside file. After that, `PROFILE.md` itself was a symlink to the outside file. Every later run, and every agent write to that profile, now writes outside the room.
3. `problem-definition/link.md -> <outside>/victim4.md`. The outside file holds `[[market-analysis]]` and the display name of a team profile `<person-1>`. Running `scripts/analyze-room <ROOM>` (the SessionStart path) rewrote the outside file and inserted `[[team/members/<person-1-slug>/PROFILE.md|<person-1>]]`.

**Fix:** Refuse to write through a link, and keep every write inside the realpath of the room.
```js
// one helper, used by all three writers
function safeWriteInRoom(roomReal, target, data) {
  const dir = fs.realpathSync(path.dirname(target));
  if (dir !== roomReal && !dir.startsWith(roomReal + path.sep)) throw new Error('outside room');
  try { if (fs.lstatSync(target).isSymbolicLink()) throw new Error('symlink target'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = target + '.tmp.' + process.pid + '.' + crypto.randomBytes(4).toString('hex');
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o644);
  try { fs.writeFileSync(fd, data); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, target);
}
```
In the wikilink sweep, skip a source whose `lstat` is a symlink, or whose realpath is outside the room.

### HI-02: Node floor or a missing node now writes "Error computing state." over STATE.md at Stop

**Files:**
- `scripts/compute-state:12-16`, `scripts/compute-team:12-16`, `scripts/analyze-room:12-16` (`exit 1` when node is not on PATH)
- `lib/core/room-render.cjs:66-85` (floor 22.18.0, `exitCode = 1`)
- Consumers: `scripts/on-stop-state:119` (detached child) and `scripts/on-stop-state:135` (sync path): `state_content=$(compute-state ... || echo "# Data Room State\n\nError computing state.")`, then `state-write.cjs`

**Issue:** Before Phase 381, compute-state was bash. It degraded without Node (`scaffold predicate unavailable`) and still printed a full STATE.md. Now it has two new exit-1 paths: no `node` on PATH, and Node below 22.18.0. The SessionStart preflight (`scripts/session-start:56-69`) still accepts Node 22.5.0 and later. So a user on Node 22.5 to 22.17 passes the preflight. A GUI-launched host with a reduced PATH (nvm-managed node not on PATH) also runs the hooks. In both cases, the first Stop after a room change replaces the real STATE.md with one line of junk (literal backslash-n characters). SessionStart then reports "Could not compute room state" on every start. The renderers use no feature of Node 22.18. The floor is a policy and not a technical need. PROVEN: `MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=22.12.0 bash scripts/on-stop-state <ROOM> scripts` changed STATE.md to `# Data Room State\n\nError computing state.`.

**Fix:** Do not replace a valid STATE.md with an error text. In `on-stop-state` (both paths), keep the old file when compute-state fails:
```bash
if state_content=$("$2/compute-state" "$1" 2>/dev/null) && [ -n "$state_content" ]; then
  printf "%s\n" "$state_content" | node "$2/state-write.cjs" "$1" || true
fi
```
Also align the floor in one place. Either lower the renderer floor to the session-start preflight value, or raise the preflight to 22.18.0 so that the refusal is visible at SessionStart.

## Medium

### ME-01: The fixed PROFILE.md.tmp name and the unlocked compute-state callers race; a killed run can leave PROFILE.md empty

**Files:** `lib/core/room-render-team.cjs:569-581`, `lib/core/room-render-team.cjs:497-512`, `lib/core/room-render-state.cjs:511-517`

**Issue (CODE):** Only the detached Stop child holds `.mindrian/state-recompute.lock`. These callers run compute-state, and so `runTeam`, with no lock: `session-start-state do_state`, the `on-stop-state` sync path, `stop-gate-handler._closeOutStateMd` (2,000 ms kill), `intelligence-cascade` and `state-ops`. Two overlapping runs use the same `PROFILE.md.tmp`. Scenario: run A writes the tmp file. Run B opens the tmp file with O_TRUNC. Run A renames the now-empty inode to PROFILE.md. Run B is killed by the 2,000 ms timeout before its write. Result: PROFILE.md, a file with user content, is empty. A milder case: run B's `renameSync` gets ENOENT. Then `runTeam` returns code 1 at line 511 and skips every remaining profile. `TEAM-STATE.md` (line 498) is a truncating write. A concurrent Phase B read (`room-render-state.cjs:622-633`) can see an empty file and drop the Roles and Active lines from STATE.md.

**Fix:** Use a unique tmp name (pid plus random) and an atomic rename for TEAM-STATE.md and PROFILE.md, as in `state-version.cjs` `_atomicWrite`. Skip the rewrite when the new bytes equal the old bytes. Do not return early at line 511; record the error and continue with the next profile.

### ME-02: The fan-out limit of 32 is not enforced in the state renderer; the fan-out test measures a function that no renderer calls

**Files:** `lib/core/room-render-state.cjs:489`, `lib/core/room-scan.cjs:677-712`, `tests/test-381-room-scan.cjs:15`

**Issue (CODE):** `Promise.all(sections.map((s) => lastUpdated(s.globPath)))` starts every section at once. Each `lastUpdated` runs its own `pool(cands, 32, lstat)`. A room with 300 sections puts up to 9,600 lstat operations in flight. `room-scan.scanRoom` is the only function with a measured in-flight maximum (2 to 32), and no renderer calls it (`grep scanRoom lib scripts` finds only the vault scanner and the test). The PERF381 claim "no more than FAN_OUT operations in flight" is unproven for the shipped code.

**Fix:** `const dates = await pool(sections, 4, (s) => lastUpdated(s.globPath));`. Alternatively, flatten all candidates of all sections into one `pool(…, FAN_OUT, …)`. Add a fan-out assertion that runs `renderState` and not `scanRoom`.

### ME-03: Every file is held twice in memory for the whole run (Buffer plus string), and no renderer reads the Buffer

**Files:** `lib/core/room-scan.cjs:597-610` (`readOne` returns `buf` and `text`), `lib/core/room-scan.cjs:612-619`, `lib/core/room-render-analyze.cjs:169-182`, `lib/core/room-render-team.cjs:216-219`

**Issue (CODE):** `readTexts` keeps `{ buf, text }` for every section file until the renderer ends. `grep -n "\.buf\b" lib/core/room-render*.cjs` finds no reader. The old bash streamed each file through `sed | head -50` or `grep`. The new code reads every file completely, even when it only needs 50 frontmatter lines. Scenario: a room with 3,000 meeting-derived files of 300 KB each is about 0.9 GB of Buffers plus 0.9 to 1.8 GB of strings. Node can then abort (V8 heap or RSS). The exit code is 134 with a stack dump on stderr. In the Stop path this becomes the HI-02 overwrite. A file of more than about 512 MB is skipped without a message (`ERR_STRING_TOO_LONG` is caught at line 607).

**Fix:** Return only `text` from `readOne` (drop `buf`), or decode lazily. Release `files.texts` entries after the last block that needs them. For frontmatter-only readers (team), read a bounded prefix (for example the first 64 KB) with `fs.read` into a fixed buffer.

### ME-04: On Windows, the grep argument chunk of 96 KB exceeds the 32,767-character command-line limit, and the error is silent

**Files:** `lib/core/room-render-state.cjs:350-377`, `lib/core/room-render-analyze.cjs:425-453`

**Issue (ASSUMED, Windows not run):** `CHUNK_BYTES = 96 * 1024` is safe for Linux `ARG_MAX`. On Windows, `CreateProcess` refuses a command line of more than 32,767 characters. `spawnSync` then sets `r.error`, and `grepFileSet` returns an empty hit set without a message. Any section name with an ERE metacharacter takes this path. A dot is enough (`series-a.round`, `web3.0`). Scenario: such a section exists, and the room has more than about 250 content files with paths of about 130 characters. Then every INFORMS and CONTRADICTS edge to that section, and every STATE.md cross-reference line for it, disappears on Windows only. The old bash called grep once per file and did not have this limit.

**Fix:** Use `const CHUNK_BYTES = process.platform === 'win32' ? 24 * 1024 : 96 * 1024;`. When `r.error` is set, write one stderr line and fall back to the in-process JS test for that chunk. Do not return "no hits".

### ME-05: The wikilink sweep rewrites user files in place inside the process that callers kill on timeout

**Files:** `lib/core/room-render-analyze.cjs:587-605`; callers `lib/core/room-ops-sync.cjs:60` (10,000 ms), `lib/core/intelligence-cascade.cjs:573` (10,000 ms), hook timeouts in `hooks/hooks.json`

**Issue (CODE):** The old design ran `node scripts/wikilink-file.cjs` as a grandchild of `bash analyze-room`. An `execFileSync` timeout killed only the bash parent. The node writer then finished its write. Now `scripts/analyze-room` does `exec node`, so the timeout kills the process that is between `open(O_TRUNC)` and `write`. The section file, which is user-authored content, can be left empty or partial. The write is also a read-modify-write with no check. If a live session writes the same file between `readFileSync` (line 589) and `writeFileSync` (line 601), that edit is lost.

**Fix:** Write through a same-directory tmp file and `renameSync` (atomic). Before the rename, compare the current mtime and size with the values read at line 589, and skip on a change. Use the same helper as HI-01.

## Low

### LO-01: BASH_SIGNED_CHAR is wrong on darwin-arm64, so the row order depends on the host

**File:** `lib/core/room-scan.cjs:52`
**Issue:** The rule `process.arch === 'x64' || 'ia32'` treats arm64 as unsigned char. Apple's arm64 ABI makes `char` signed, so Homebrew bash 5 on Apple Silicon hashes with signed chars. mips and loong64 are signed too. The emulated order is therefore a function of `process.arch`. The same room with non-ASCII person or section names gives a different TEAM-STATE.md and analyze row order on x64 Linux and on arm64 Linux. That causes churn in a room that is shared across machines (Cowork). The signed arithmetic itself is correct: PROVEN against a C replica of bash 5.2 `hash_string`, compiled with `-fsigned-char` and `-funsigned-char`, on 4 valid UTF-8 keys (live x86 bash not run).
**Fix:** Use `process.arch === 'x64' || process.arch === 'ia32' || (process.platform === 'darwin' && process.arch === 'arm64')`. Better: now that the legacy bash is gone, choose one fixed order (for example `signed: true` on every host) so that the output does not depend on the machine.

### LO-02: The analyze cache key misses the modules that shape the output

**File:** `scripts/session-start-state:116-122`
**Issue:** Only `room-render.cjs`, `room-render-analyze.cjs` and `room-scan.cjs` invalidate the cache. The analyze output also depends on `lib/core/visual-ops.cjs` (`formatEdge`, the EDGE line bytes), `lib/vault/room-scanner.cjs` and `lib/vault/wikilink-builder.cjs`. A change to one of these keeps a stale cache for up to 24 hours. Impact is low for releases, because an update installs into a new versioned directory with new mtimes.
**Fix:** Add the three paths to the `-nt` chain, or compare one hash of the module set that is stored next to the cache.

### LO-03: The spawned tools inherit the caller locale; the JS paths assume C.UTF-8

**Files:** `lib/core/room-render-state.cjs:360`, `lib/core/room-render-analyze.cjs:317,436`, `lib/core/room-scan.cjs:328,353`
**Issue:** Ruling 3 defines the output under `LC_ALL=C.UTF-8`. The JS paths emulate that. The `grep`, `xargs` and `date` children receive `process.env` unchanged. Under `LANG=C` or a Latin-1 locale, `grep -liE` (case folding, `.` over bytes) and the `grep -q` BRE fallback give results that differ from the JS path for the same class of input. The output then depends on the locale only for "exotic" names.
**Fix:** Pass `env: Object.assign({}, process.env, { LC_ALL: 'C.UTF-8' })` to the grep and xargs spawns. Keep `date` on the user locale only if a test needs it.

### LO-04: Child processes have no timeout (or a 90-second one), and xargs is not memoized

**Files:** `lib/core/room-render-state.cjs:522`, `lib/core/room-render-state.cjs:360`, `lib/core/room-render-analyze.cjs:317,436`, `lib/core/room-scan.cjs:328,353,366-368`, `lib/core/room-render-analyze.cjs:729,745`
**Issue:** `compute-meetings-intelligence`, `grep` and `xargs` run with `spawnSync` and no timeout. If a section file is replaced by a FIFO between the listing and the grep, the SessionStart hook hangs until the hook timeout. `dateDToEpoch` allows 30,000 ms per step and has 3 steps, so it can take 90 s per distinct value. `xargsEcho` is not memoized. `valueOf(t, 'funder:')` runs twice per opportunity (lines 729 and 745). So 1,000 opportunities with an apostrophe in the funder name cause 2,000 xargs spawns.
**Fix:** Add `timeout` (for example 5,000 ms) and `killSignal` to every `spawnSync`. Memoize `xargsEcho` by value, as `dateDToEpoch` already is. Read `funder` once per opportunity.

### LO-05: The contradiction regex is O(occurrences x line length) on a long single line

**File:** `lib/core/room-render-analyze.cjs:494-502,528-529`
**Issue:** `/contradict[^\n]*T|conflict[^\n]*T|inconsisten[^\n]*T/iu` backtracks to the end of the line at each keyword. PROVEN: a 180 KB single-line file of repeated `conflict ` against the 7 non-self targets took 42,982 ms in Node. The old `grep -iE` took 6.6 s for one target on the same file, so the old code was also slow (a pre-existing class). The new code blocks the event loop and has no cancellation.
**Fix:** First test `l.toLowerCase().includes(target.toLowerCase())`, and run the regex only when the target occurs. Alternatively, find the last index of the target and test only for a keyword before it (linear).

### LO-06: The router crashes with a stack trace on EPIPE

**File:** `lib/core/room-render.cjs:100-102`
**Issue:** PROVEN for the same pattern: `node -e 'process.stdout.write(big)' | head -1` exits 1 with an `Unhandled 'error' event ... EPIPE` stack. The old bash died quietly from SIGPIPE. No in-repo caller pipes these scripts to `head` today (grep checked). A user command or a future hook that pipes them will show a stack trace.
**Fix:** `process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(process.exitCode || 0); });` before the write.

### LO-07: Room Map JSON is built by string concatenation from folder names

**File:** `lib/core/room-render-state.cjs:539-542`
**Issue:** A section folder name with `"`, `\` or a control character makes `JSON.parse` throw, and the Room Map is dropped without a message. A crafted name such as `x","entryCount":999,"stage":"Investment` injects fields into the diagram data. This is not code execution, but it is wrong output.
**Fix:** `vo.renderRoomDiagram(sections.map((s, i) => ({ name: s.name, entryCount: counts[i], stage, edges: [] })), { useColor: true })`. If the parity of the exotic case matters, record it as a named divergence.

### LO-08: stop-gate-handler reports success when persistState skipped or failed

**File:** `lib/mcp/stop-gate-handler.cjs:104-105`
**Issue:** `persistState` returns `{ status: 'version-mismatch' | 'error' }` and does not throw. `_closeOutStateMd` ignores the result and returns `true`. The close-out then reports a STATE.md write that did not happen. `intelligence-cascade.cjs:532-543` handles the same verdict correctly.
**Fix:** `const v = persistState(roomDir, out || ''); return !!v && v.status === 'ok';`

### LO-09: "Scan once" is not what ships; room-scan.scanRoom is dead in production

**Files:** `lib/core/room-scan.cjs:621-712`, `docs/ENV-TUNING.md` (new section: "reads the room once")
**Issue:** No renderer calls `scanRoom` or `describeEntry`. Each renderer walks the room again. In one compute-state run, every section directory is listed at least 4 times: globDirs, the predicate count, findDepth1 in lastUpdated, and the predicate list in scanList. That is about 90 lines of dead production code, tested only by its own test. The documentation claim is false.
**Fix:** Delete `scanRoom` and `describeEntry` (and their test legs), or wire the renderers to the snapshot. Correct the ENV-TUNING.md sentence.

### LO-10: Two clocks in one analyze run

**File:** `lib/core/room-render-analyze.cjs:769`
**Issue:** `FUND_STALE` uses `Date.now()`, but `OPP_DEADLINE` (line 740) uses `ctx.now`. A test that pins `ctx.now` cannot pin FUND_STALE. A run across midnight can disagree with itself.
**Fix:** Pass `now` into the funding loop: `const nowEpoch = Math.floor(now.getTime() / 1000);`.

### LO-11: The current_room line can never appear on Windows

**File:** `lib/core/room-render-state.cjs:229-234,269,275`
**Issue (ASSUMED, Windows not run):** `realLoose` uses POSIX rules only. A registry `abs_path` such as `C:\Users\<person-1>\MindrianRooms\<ROOM>`, or a room argument `C:/...`, does not start with `/`. It is joined to `process.cwd()`, and backslashes are not normalized. The comparison at line 275 then never matches, and STATE.md loses `current_room` on Windows.
**Fix:** When `process.platform === 'win32'`, compare `fs.realpathSync.native(path.resolve(x)).toLowerCase()` for both sides (catch to the loose form).

### LO-12: The project convention says bash stays authoritative; this phase inverts it

**Files:** `scripts/compute-team`, `scripts/analyze-room`, `scripts/compute-state` (each is now a 6-line `exec node`), project `CLAUDE.md` Conventions ("Bash scripts in `scripts/` stay authoritative; CJS wraps them.")
**Issue:** After plan 381-09, the CJS is authoritative and the bash only wraps it. The rule "hooks stay .cjs" holds. No new dependency was added (package.json unchanged). No em-dash or en-dash was found in the changed files. But the written convention now contradicts the code, and a later reviewer will flag it again.
**Fix:** Record the owner ruling in CLAUDE.md Conventions (an exception for the three room renderers) or in docs/MINDRIAN-CANON.md, with a link to 381-CONTEXT.md.

## Checked and not a defect

- Program text from room data: none. Every spawn uses argv arrays. Patterns follow `--`. `FALLBACK_PROGRAMS.profileRewrite` is constant, and the table and the file travel as `$1` and `$2`. An awk `var=value` operand is not possible, because the path never starts with an identifier followed by `=`.
- JS regexes from room text: `breToRegExp` and `contraRegExp` escape every metacharacter. Backreference ReDoS through the unescaped grep ERE pattern is blocked, because the pattern repeats the target in each alternative and GNU grep refuses it ("Invalid back reference"; PROVEN).
- The BashAssoc growth (x4 at 2 x buckets, head insert, rehash order) matches bash 5.2 hashlib. The signed branch arithmetic is correct (LO-01 covers only the arch selection).
- The `dateDToEpoch` memo key includes TZ, and unset TZ is different from empty TZ.
- Part 8: no `http`, `https`, `net` or `fetch` in the renderers or in their requires (visual-ops, scaffold-predicate, vault room-scanner, wikilink-builder).
- Out of scope, pre-existing, recorded for the owner: `lib/core/room-ops-sync.cjs:60` builds a shell string `bash "${scriptPath}" "${resolved}"`. A room path that contains `"` or `$(...)` reaches `/bin/sh` as program text.

---

_Reviewed: 2026-10-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
