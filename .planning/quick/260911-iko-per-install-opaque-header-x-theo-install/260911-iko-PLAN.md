---
quick: 260911-iko
phase: quick-260911-iko
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [IKO-01, IKO-02, IKO-03]
canon_parts: [8, 6]
files_modified:
  - lib/core/install-id.cjs
  - tests/test-339-install-id-header.cjs
  - lib/core/brain-client.cjs
  - scripts/doctor.cjs
  - lib/core/doctor/class-m-brain-smoke.cjs
  - commands/doctor.md
  - skills/doctor/SKILL.md
  - dist/generic-claude-dir/.claude/skills/doctor/SKILL.md
  - dist/zed/.agents/skills/doctor/SKILL.md
  - dist/BUNDLE-VERSION.json
  - docs/THEO-INSTALL-ID.md
  - CHANGELOG.md
  - tests/run-all-339.sh

must_haves:
  truths:
    - "A user's first Brain call after install mints exactly one install id; every later call in every later process reuses the same id."
    - "Every wire request brain-client makes through callTool (the session initialize AND the tools/call) carries the header x-theo-install-id with a 32 lowercase hex value."
    - "When the id cannot be minted or read, the header is omitted and the Brain call proceeds byte-identically otherwise: no error, no throw, no degraded verdict."
    - "node scripts/doctor.cjs --reset-install-id rotates the id, prints exactly 'install id rotated', prints nothing about the value, and exits 0."
    - "No log line, no doctor stdout, and no brain-smoke report JSON ever contains the id value; the doctor reports presence as a boolean only."
    - "The id file holds only {id, minted_at} and contains no hostname, username, cwd, home path, account id, or Brain key substring."
  artifacts:
    - path: "lib/core/install-id.cjs"
      provides: "mint-once / peek / reset of the opaque per-install id plus the exported header name"
      exports: ["getInstallId", "peekInstallId", "resetInstallId", "installIdPath", "installIdHeaderName"]
      min_lines: 90
    - path: "tests/test-339-install-id-header.cjs"
      provides: "RED-first coverage for the mint, the wire header, the doctor flag, and the L0 presence row"
      min_lines: 200
    - path: "docs/THEO-INSTALL-ID.md"
      provides: "the one plugin-side record of the Theo header contract"
      contains: "x-theo-install-id"
      min_lines: 40
  key_links:
    - from: "lib/core/brain-client.cjs"
      to: "lib/core/install-id.cjs"
      via: "require + the _installIdHeaders() helper spread into both fetch header blocks"
      pattern: "install-id\\.cjs"
    - from: "lib/core/brain-client.cjs"
      to: "the two fetch header blocks (_ensureSession initialize, callTool tools-call)"
      via: "spread of _installIdHeaders()"
      pattern: "\\.\\.\\._installIdHeaders\\(\\)"
    - from: "scripts/doctor.cjs"
      to: "lib/core/install-id.cjs"
      via: "--reset-install-id handler calling resetInstallId()"
      pattern: "resetInstallId"
    - from: "lib/core/doctor/class-m-brain-smoke.cjs"
      to: "lib/core/install-id.cjs"
      via: "peekInstallId() feeding the L0 install_id_present boolean"
      pattern: "install_id_present"
    - from: "commands/doctor.md"
      to: "scripts/doctor.cjs parseArgs"
      via: "the flag-parity gate in tests/test-doctor-doc-parity.cjs"
      pattern: "--reset-install-id"
---

<objective>
Put a per-install opaque header on every Brain call so Theo can bucket traffic by install without ever learning who the install belongs to.

Purpose: Theo needs to tell "one install calling twice" from "two installs calling once". Today it cannot, and every substitute it could reach for (a key, a hostname, an account) would be user data crossing the Brain boundary, which Canon Part 8 forbids. A 128-bit coin flip minted locally and sent as a header is the one answer that gives Theo the bucketing and gives the user nothing to leak.

Output: `lib/core/install-id.cjs` (new, no new dependencies), the header wired into both of callTool's wire requests, `node scripts/doctor.cjs --reset-install-id` for rotation, a presence-only boolean on the doctor's L0 row, one contract doc, and RED-first tests.

**The contract, agreed with the Theo session on 2026-09-11 and recorded on Theo's side as `20-INPUT-per-install-header-decision.md`. Do not vary any clause. Every task action below cites the clause it implements.**

| ID | Clause |
|----|--------|
| D-01 | Header name `x-theo-install-id`, lowercase on the wire. Value: 32 lowercase hex characters from `crypto.randomBytes(16)`. Theo accepts `^[A-Za-z0-9_-]{16,64}$`; ours is the stricter subset `^[a-f0-9]{32}$`. |
| D-02 | Minted ONCE per install, on the plugin's first Brain call after install. Stored in the plugin state dir (`MINDRIAN_HOME` else `~/.mindrian/`), beside the pre-warm marker, as a small file holding only `{id, minted_at}`, mode 0600 where the platform supports it. |
| D-03 | Never derived from user, machine, account, room, path, hostname or key. Never logged. Never printed in full by doctor: doctor prints presence, and on rotation the word "rotated". The id itself is the user's to read from their own file. |
| D-04 | Sent as a header on EVERY call brain-client makes to the Brain origin through `callTool` (both fetch header blocks). Nothing else about the request changes. Bucket key ONLY: the plugin must never treat its presence or absence as identity or entitlement, and must keep working unchanged when the id cannot be minted or read (header omitted, never an error). |
| D-05 | Rotated only by explicit user action: reinstall (state dir removed) or `node scripts/doctor.cjs --reset-install-id`, which mints a fresh id, replaces the file, and prints "rotated" and nothing else about the value. |
| D-06 | Any change to the name or the pattern is announced to Theo first. The contract is recorded in ONE plugin doc so the next reader finds it. |
| D-07 | Canon Part 8: the id is opaque and content-free. The plan and the doc must state WHY it is a generic handle and not user data, and must forbid deriving it from anything identifying. |
| D-08 | Tri-Polar: `lib/core/brain-client.cjs` is the one transport all three surfaces reach the Brain through, so the header rides everywhere the shim runs. Say so. |
</objective>

<why_this_is_not_user_data>
D-07, stated once here and repeated in `docs/THEO-INSTALL-ID.md` so a future reader cannot re-open it by accident.

Canon Part 8 forbids USER DATA crossing LOCAL -> BRAIN. It does not forbid generic content-free handles: framework names and problem-type enums already cross that wire by design. The install id belongs to the second class, and here is the argument in plain terms.

The value is a coin flip, not a projection. It is 16 bytes straight out of the platform CSPRNG with no input at all. There is no function from the user, the machine, the account, the room, the path, the hostname or the Brain key to this value, so there is nothing to invert. A hash of an identifier would still BE that identifier wearing a hat: the same user on two installs would hash to the same bucket, and anyone holding the identifier could confirm a match. A random 128-bit value cannot do either. It carries exactly one bit of meaning: "the caller that sent this header before is the caller sending it now."

It is the user's own to read and the user's own to destroy. It sits in plaintext in their own state dir at mode 0600. They can open it, they can delete it, and `doctor --reset-install-id` replaces it on demand (D-05). Nothing about the plugin's behaviour changes when they do.

The forbidden move, written down so a later edit cannot drift into it: never derive the id from `os.hostname()`, `os.userInfo()`, `process.env.USER` / `USERNAME` / `LOGNAME`, the home directory path, `process.cwd()`, a MAC address, a machine id, an account id, a room name, the Brain key, or a hash of any of those. Task 1 ships a comment-stripped source scan that fails the suite if any of those tokens appears in `lib/core/install-id.cjs`.

The header is a bucket key and never an entitlement (D-04). The commercial gate is installing and updating, never a per-query check (`.claude/includes/moat.md`), and this header does not move that gate one inch. The plugin never reads the header back, never branches on it, and never refuses anything because of it.
</why_this_is_not_user_data>

<tri_polar>
D-08. `lib/core/brain-client.cjs` is the single transport every surface reaches the Brain through: the CLI scripts require it directly, the Desktop and Cowork stdio shim (`bin/mindrian-brain-mcp-client.cjs`) requires it, and the MCP server routes through it. One edit inside `callTool` therefore puts the header on all three surfaces with zero surface-specific code, which is the Tri-Polar rule satisfied by construction rather than by three parallel patches.

The state dir is the same `MINDRIAN_HOME` else `~/.mindrian` on all three, so one install has one id no matter which surface makes the first call. On Cowork specifically: the id is per INSTALL of the plugin, keyed to the machine's state dir. It is not per room and not per user, and nothing in this plan makes it either.
</tri_polar>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md

Read once, at the point of use, not up front:
- `lib/core/brain-prewarm.cjs` -- `markerPath(homeDir)` at :88-99 is the state-dir idiom Task 1 mirrors; the never-throws / never-stdout discipline is the posture Task 1 copies.
- `lib/core/brain-client.cjs` -- `_ensureSession`'s initialize fetch header block at ~:455-458 and `callTool`'s tools/call fetch header block at ~:674-677 are the two edit sites; the in-process Part 8 egress belt at ~:620-642 classifies `args` only and is NOT touched; `getApiKey`'s memo at :279-299 is the memoization idiom Task 2 copies.
- `scripts/doctor.cjs` -- `parseArgs` at :114 (flag defaults) and the case chain at ~:265-300; the `--bind-check` sibling dispatch at ~:3093 is the shape Task 2's handler copies (dispatched before the class-flag block, own exit-0 contract).
- `lib/core/doctor/class-m-brain-smoke.cjs` -- `_layer0` at :209-255 and its `opts.mockBrainUrl` / `opts.mockTheoHealth` seam convention.
- `tests/test-339-brain-prewarm-cold-start.cjs` -- the RED-first node:test idiom, the `freshHomeDir()` helper, and the `codeOf()` comment-stripping scanner Task 1 reuses.
- `tests/test-doctor-doc-parity.cjs` -- the gate that makes the `commands/doctor.md` edit in Task 2 mandatory rather than optional.
- `tests/run-all-339.sh` -- glob discovery plus the hand-maintained `EMDASH_TARGETS` list at :175-205.
- `lib/core/room-auto-create.cjs`:114 and `lib/core/lazygraph-ops.cjs`:275 -- the existing `crypto.randomBytes` / `randomUUID` idioms.
</context>

<source_audit>
Every source item, and the task that covers it. No item is deferred, simplified, or staged behind a "v1".

| Source | Item | Covered by | Status |
|--------|------|------------|--------|
| GOAL | Per-install opaque header on every Theo call | Task 2 | COVERED |
| GOAL | Minted once from crypto, stored in the state dir | Task 1 | COVERED |
| GOAL | Never derived from identity | Task 1 (runtime arm + source scan), Task 3 (doc) | COVERED |
| GOAL | Rotated only by reinstall or `doctor --reset-install-id` | Task 2 | COVERED |
| CONTEXT | D-01 name and value shape | Task 1 (mint + constant), Task 2 (wire) | COVERED |
| CONTEXT | D-02 mint-once, state dir, file shape, mode 0600 | Task 1 | COVERED |
| CONTEXT | D-03 never derived, never logged, never printed | Task 1, Task 2 (doctor + L0) | COVERED |
| CONTEXT | D-04 both header blocks, bucket-key-only, omit on failure | Task 2 | COVERED |
| CONTEXT | D-05 rotation via doctor flag | Task 2 | COVERED |
| CONTEXT | D-06 one plugin doc, announce-to-Theo rule | Task 3 | COVERED |
| CONTEXT | D-07 Part 8 argument written down | This plan's `<why_this_is_not_user_data>` + Task 3 doc | COVERED |
| CONTEXT | D-08 Tri-Polar statement | This plan's `<tri_polar>` + Task 3 doc | COVERED |
| CONSTRAINT | run-all-339 EMDASH_TARGETS registration | Task 3 | COVERED |
| CONSTRAINT | test-127-03 stays green (or allowlist with a reason) | Task 3 | COVERED |
| CONSTRAINT | run-all-339, doctor --acceptance, live e2e, loopback wire proof | Task 3 | COVERED |
| CONSTRAINT | Do not touch hooks/hooks.json, alias tables, part8-egress-guard.cjs, directive-envelope.cjs | All tasks (none appear in files_modified) | HONORED |

Deliberate exclusions, each with a reason so a later reader does not read them as oversights:

- **The `/register` fetch at `brain-client.cjs:353` does NOT get the header.** D-04 names callTool's two header blocks. Registration is a different endpoint with its own contract, and it runs before there is an established Brain session to bucket. Adding it there would be a change to Theo's registration surface that D-06 says must be announced to Theo first. If Theo later wants it, that is a separate, announced change.
- **No `docs/ENV-TUNING.md` edit.** This task introduces no environment variable. `MINDRIAN_HOME` turns out not to be documented in that file at all (verified by grep at planning time), so there is no existing entry to hang a cross-reference on. D-06 asks for ONE doc; that doc is `docs/THEO-INSTALL-ID.md`. `docs/ENV-TUNING.md` stays in `EMDASH_TARGETS` because it was already there, not because this task touches it.
- **No shared state-dir helper extracted from `brain-prewarm.cjs`.** Two call sites is below the threshold where coupling two never-throws modules beats a duplicated two-line expression, and extraction would mean editing a file whose pre-warm contract is pinned by its own test for zero behaviour gain. The duplication is made safe instead by a drift-guard test arm (Task 1, arm 10) asserting both modules resolve to the same directory. The extraction trigger is written into the code comment: a THIRD call site.
</source_audit>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Mint the opaque id (lib/core/install-id.cjs, RED first)</name>
  <files>lib/core/install-id.cjs (new), tests/test-339-install-id-header.cjs (new)</files>
  <behavior>
    Write `tests/test-339-install-id-header.cjs` FIRST, run it, watch it fail for the right reason (module not found), then implement. node:test plus node built-ins only. Zero network, zero spawn in this task. Every arm uses a fresh `fs.mkdtempSync` homeDir so no arm's write bleeds into another's assertions (the `freshHomeDir()` helper in `tests/test-339-brain-prewarm-cold-start.cjs`).

    Arm 1, mint-once (D-02): two `getInstallId({ homeDir })` calls return the identical string, and the state dir holds exactly one id file.
    Arm 2, shape (D-01): the value matches `/^[a-f0-9]{32}$/` AND independently matches Theo's accepted `/^[A-Za-z0-9_-]{16,64}$/`. Assert both, so a future loosening of ours is still checked against Theo's.
    Arm 3, file shape (D-02): `Object.keys(JSON.parse(raw)).sort()` deep-equals `['id','minted_at']` exactly, and `minted_at` parses to a valid Date.
    Arm 4, mode (D-02): `(fs.statSync(p).mode & 0o777) === 0o600`. Skip the assertion when `process.platform === 'win32'`, and say so in the skip message rather than silently passing.
    Arm 5, reset rotates (D-05): `resetInstallId({ homeDir })` returns a different valid id, the file now holds the new one, and a following `getInstallId` returns the new one.
    Arm 6, invalid content re-mints (D-02): seed the file with `{"id":"nope"}` and, separately, with `not json at all`; both cases return a fresh valid 32-hex id and rewrite the file. An unreadable id must never become a wire value.
    Arm 7, unwritable dir returns null without throwing (D-04): build a homeDir path that lives UNDER a regular file so `mkdirSync` fails with ENOTDIR (portable, no chmod games). `getInstallId` returns `null` and does not throw.
    Arm 8, no identity substring (D-03/D-07): assert the raw file text contains none of `os.hostname()`, `os.userInfo().username`, `process.cwd()`, the homeDir path itself, or a canary value placed in `process.env.MINDRIAN_BRAIN_KEY` for the duration of the arm.
    Arm 9, source-shape scan (D-07): read `lib/core/install-id.cjs` through the `codeOf()` comment-stripping helper copied from the prewarm test, then assert ZERO occurrences of `os.hostname`, `os.userInfo`, `process.env.USER`, `process.env.USERNAME`, `process.env.LOGNAME`, `process.cwd`, `MINDRIAN_BRAIN_KEY`, `resolve-brain-key`, and `createHash`. The comment strip is LOAD-BEARING and must not be removed: the module's own header comment names every one of those tokens in prose explaining what it must never do, so an unstripped scan would be self-invalidating.
    Arm 10, state-dir drift guard (D-02): `path.dirname(installIdPath(h))` equals `path.dirname(markerPath(h))` from `brain-prewarm.cjs`, checked three ways -- an explicit homeDir argument, a `MINDRIAN_HOME` env override (set and restored inside the arm), and the no-argument default.
    Arm 11, peek never mints (D-03): `peekInstallId({ homeDir })` on a fresh homeDir returns `null` AND creates no file; after a `getInstallId`, `peekInstallId` returns the same id.
    Arm 12, header name constant (D-01): `installIdHeaderName === 'x-theo-install-id'` and equals its own `toLowerCase()`.
  </behavior>
  <action>
Create `lib/core/install-id.cjs`. Pure CJS, no new dependencies, `require` only `fs`, `path`, `os`, `crypto`. Copy the posture of `lib/core/brain-prewarm.cjs` exactly: this module NEVER throws to its caller and NEVER writes to stdout (it can run inside an MCP stdio process where a stray stdout byte corrupts the JSON-RPC transport). A single `process.stderr.write` line guarded by `MINDRIAN_DEBUG` is permitted, and it must print the FILE PATH or an error message, never the id value (D-03).

Open the file with a header comment that states, in the plain terms of this plan's `<why_this_is_not_user_data>` section: what the id is for, why a CSPRNG value is a generic handle and not user data under Canon Part 8, and the explicit list of things it must never be derived from (D-07). Note in that comment that arm 9 of the test scans this file with comments stripped, so this prose is safe and must stay.

Exports, all five named (D-01):
- `installIdHeaderName` -- the frozen string constant `'x-theo-install-id'`.
- `installIdPath(homeDir)` -- `path.join(homeDir || process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian'), 'theo-install-id.json')`. This is the same resolution expression as `brain-prewarm.cjs::markerPath` at :88-99, deliberately duplicated rather than extracted; put a comment naming that sibling, naming arm 10 as the drift guard that makes duplication safe, and naming the extraction trigger (a third call site).
- `peekInstallId({ homeDir } = {})` -- read-only. Reads the file, `JSON.parse`es it, returns `obj.id` when it is a string matching `/^[a-f0-9]{32}$/`, otherwise `null`. NEVER mints, NEVER writes, NEVER throws. This exists so the doctor can report presence without a diagnostic run silently creating the thing it is diagnosing.
- `getInstallId({ homeDir } = {})` -- `peekInstallId` first; on a hit return it. On a miss, mint: `crypto.randomBytes(16).toString('hex')`, build `{ id, minted_at: new Date().toISOString() }` with those two keys and nothing else, `fs.mkdirSync(dir, { recursive: true })`, write to a sibling temp path (`theo-install-id.json.tmp-<pid>-<6 random hex>`) with `fs.writeFileSync(tmp, json, { encoding: 'utf8', mode: 0o600 })`, then RE-CHECK for a concurrent winner: if `peekInstallId` now returns a valid id, unlink the temp and return THAT id instead (two processes making their first Brain call at the same instant must converge on one bucket, not split it). Otherwise `fs.renameSync(tmp, final)` and, on non-win32, `fs.chmodSync(final, 0o600)` as a belt. Return the minted id. Every fs operation is wrapped; ANY failure returns `null` and leaves no temp file behind. Returning `null` rather than an unpersisted in-memory id is deliberate and must be commented: a volatile id would send a different value on every process and quietly break the one-install-one-id property the whole header exists to provide.
- `resetInstallId({ homeDir } = {})` -- mints unconditionally and REPLACES, skipping the concurrent-winner re-check (rotation must win over an existing file by definition). Same atomic temp-then-rename write, same mode, same never-throws contract, returns the new id or `null`.

No em-dashes anywhere in either file; hyphens only.
  </action>
  <verify>
    <automated>node tests/test-339-install-id-header.cjs</automated>
    <automated>node -e "const m=require('./lib/core/install-id.cjs');const ks=Object.keys(m).sort().join(',');if(ks!=='getInstallId,installIdHeaderName,installIdPath,peekInstallId,resetInstallId')throw new Error('export set drift: '+ks);if(m.installIdHeaderName!=='x-theo-install-id')throw new Error('header name drift');console.log('exports ok')"</automated>
  </verify>
  <done>All 12 arms pass. `lib/core/install-id.cjs` exports exactly the five named symbols, mints a 32 lowercase hex id once per state dir at mode 0600, re-mints on corruption, returns null instead of throwing on an unwritable dir, and contains no identity-derivation token outside its own comments.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ride the wire, rotate on demand, report presence only</name>
  <files>lib/core/brain-client.cjs, scripts/doctor.cjs, lib/core/doctor/class-m-brain-smoke.cjs, commands/doctor.md, skills/doctor/SKILL.md (generated), dist/ (generated), tests/test-339-install-id-header.cjs</files>
  <behavior>
    Append four arms to `tests/test-339-install-id-header.cjs`. Each wire arm must `delete require.cache[require.resolve(...)]` for BOTH `lib/core/brain-client.cjs` and `lib/core/install-id.cjs` before requiring, because `brain-client.cjs` resolves `BRAIN_URL` at module scope and memoizes both the key and the install-id header per process. Set `MINDRIAN_HOME`, `MINDRIAN_BRAIN_KEY` and `MINDRIAN_BRAIN_URL` BEFORE the require, and restore the previous env in a `finally`.

    Arm 13, the header rides every wire call (D-04): replace `globalThis.fetch` with a recorder that pushes `{ url, headers }` for each call and returns a minimal 200-shaped response object (`ok: true`, `status: 200`, a `headers.get()` returning `application/json`, and async `text()` / `json()` / `arrayBuffer()` stubs). `await callTool('theo_health', {})`. Assert at least 2 recorded requests (the session initialize plus the tools/call), and that EVERY recorded request carries `x-theo-install-id` with a value matching `/^[a-f0-9]{32}$/` equal to the id in the state file. Assert on the RECORDED REQUESTS only, never on callTool's return value: a minimal stub body may make callTool return `null`, and that is irrelevant to what this arm proves. Restore `globalThis.fetch` in a `finally`.
    Arm 14, the header is absent when the id is null (D-04): point `MINDRIAN_HOME` at a path under a regular file (the ENOTDIR trick from arm 7) so `getInstallId` genuinely returns `null` -- do not monkey-patch the module, prove the real degrade path. Same fetch recorder. Assert at least 2 recorded requests still happened, that NO recorded request has a header key equal to `x-theo-install-id` under a case-insensitive comparison, and that `callTool` did not throw.
    Arm 15, the doctor flag rotates (D-05): read the id, then `child_process.spawnSync('node', [doctorPath, '--reset-install-id'], { env: { ...process.env, MINDRIAN_HOME: tmp }, encoding: 'utf8' })`. Assert `status === 0`, `stdout.trim() === 'install id rotated'`, `stdout` contains no `/[a-f0-9]{32}/` substring, `stderr` is empty, and the on-disk id changed to a different valid 32-hex value.
    Arm 16, L0 reports presence and never the value (D-03): call `checkBrainSmoke(seams)` from `lib/core/doctor/class-m-brain-smoke.cjs` with the seam set the existing `lib/core/doctor/class-m-brain-smoke.test.cjs` already uses, plus the new `mockInstallId` seam, driving it BOTH ways. Assert `typeof result.layers[0].payload.install_id_present === 'boolean'` in both, that it is `true` when the seam yields an id and `false` when it yields `null`, and that `JSON.stringify(result)` contains no `/[a-f0-9]{32}/` substring in either case.
  </behavior>
  <action>
**`lib/core/brain-client.cjs` (D-04).** Add a module-private helper near the existing key memo at :279-299, following that same memo idiom: a lazily-computed, once-per-process `_installIdHeaders()` that requires `./install-id.cjs`, calls `getInstallId()`, and returns either `{ [installIdHeaderName]: id }` or the empty object `{}` when the id is not a string. Wrap the whole body in try/catch returning `{}`, so a missing or broken install-id module can never take a Brain call down. A per-process memo is correct here and must be commented as such: the id only changes on reinstall or on a `doctor --reset-install-id` run, and both of those happen in a different process.

Then spread `..._installIdHeaders()` into EXACTLY TWO header objects and nowhere else:
1. `_ensureSession`'s initialize fetch at ~:455-458, after `Authorization`.
2. `callTool`'s tools/call fetch at ~:674-677, after `Authorization`.

Change NOTHING else about either request: same method, same body, same `AbortSignal.timeout`, same retry budget, same status-to-sentinel mapping (82 degradation tests key on those sentinels). Do NOT add the header to the `/register` fetch at :353 -- see the deliberate exclusions in `<source_audit>`; put a one-line comment there stating that exclusion and its reason so a later reader does not read it as a miss.

Do NOT touch the Part 8 egress belt at ~:620-642. `classify()` runs on `args`, and headers are not payload: the install id never enters `args` and must never be added to them. Put that sentence in the comment above `_installIdHeaders()` so the relationship between the belt and the header is written down rather than inferred.

**`scripts/doctor.cjs` (D-05).** Three edits. (a) Add `resetInstallId: false` to the `parseArgs` flag defaults with a comment stating it is a SIBLING flag like `--report-registration-bug`, not a class flag, deliberately NOT added to the `--all` activation block, and carrying its own always-exit-0 contract. (b) Add `else if (arg === '--reset-install-id') flags.resetInstallId = true;` to the case chain around :265-300. (c) Add one line to `usageText()` alongside the other sibling flags. (d) Dispatch it in `main()` BEFORE the class-flag block and before `--acceptance`, in the position and shape `--bind-check` uses at ~:3093: require `lib/core/install-id.cjs`, call `resetInstallId()`, `console.log('install id rotated')` on a string result or `console.log('install id rotation failed (state dir not writable)')` on null, then `process.exit(0)` in both cases. Print nothing else. Never print the value, not even on the failure path (D-03).

**`commands/doctor.md`.** This is MANDATORY, not documentation polish: `tests/test-doctor-doc-parity.cjs` hard-fails when a flag parsed by `parseArgs` is not documented, and its `FLAG_RE` matches `--reset-install-id`. Add `[--reset-install-id]` to the `argument-hint` frontmatter line and one bullet to the sibling-flag list around :127 reading, in substance: `--reset-install-id` rotates the opaque per-install bucket key the plugin sends to Theo, prints `install id rotated`, never prints the value, and always exits 0. Do NOT add a cross-link to `docs/THEO-INSTALL-ID.md` yet -- that doc does not exist until Task 3, which adds the link.

**`lib/core/doctor/class-m-brain-smoke.cjs` (D-03).** In `_layer0` (:209-255), after the `payload` object is built, add an `opts.mockInstallId` seam defaulting to `() => require('../install-id.cjs').peekInstallId()` -- `peekInstallId`, NOT `getInstallId`, so a diagnostic run never mints the thing it is reporting on. Wrap the call in try/catch defaulting to `false`, and set `payload.install_id_present = typeof <result> === 'string'`. Extend the L0 docblock with a fourth lettered bullet (d) describing this row and stating outright that it carries the BOOLEAN only and never the value, tagged `T-iko-02`. Do not change L0's verdict logic: a missing install id is information, never a failure, exactly as the origin and health halves already are.

**Regenerate the mirrors.** `commands/doctor.md` is the read-only source of truth for `skills/doctor/SKILL.md`, which in turn feeds `dist/`. Run `node scripts/build-skill-mirrors.cjs` then `node scripts/build-dist-bundles.cjs`. Skipping this makes the `--check` arms in `tests/run-all-339.sh` fail in Task 3 for a reason that has nothing to do with this feature.

No em-dashes in any edited file.
  </action>
  <verify>
    <automated>node tests/test-339-install-id-header.cjs</automated>
    <automated>node tests/test-doctor-doc-parity.cjs</automated>
    <automated>node lib/core/doctor/class-m-brain-smoke.test.cjs</automated>
    <automated>node scripts/build-skill-mirrors.cjs --check &amp;&amp; node scripts/build-dist-bundles.cjs --check-stale</automated>
    <automated>node -e "const s=require('fs').readFileSync('lib/core/brain-client.cjs','utf8').split('\n').filter(l=>!/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');const n=(s.match(/\.\.\._installIdHeaders\(\)/g)||[]).length;if(n!==2)throw new Error('expected the header spread at exactly 2 fetch blocks, found '+n);console.log('wire sites ok: '+n)"</automated>
  </verify>
  <done>Both of callTool's wire requests carry `x-theo-install-id` when an id exists and omit it cleanly when it does not; `node scripts/doctor.cjs --reset-install-id` rotates and prints one line; the L0 row carries a boolean and no report JSON contains a 32-hex string; doc parity, the existing smoke test, and both generated-artifact `--check` gates are green.</done>
</task>

<task type="auto">
  <name>Task 3: Record the contract, register the harness, prove it live</name>
  <files>docs/THEO-INSTALL-ID.md (new), commands/doctor.md, skills/doctor/SKILL.md (generated), dist/ (generated), CHANGELOG.md, tests/run-all-339.sh</files>
  <action>
**`docs/THEO-INSTALL-ID.md` (D-06).** The ONE plugin-side record of this contract, written Feynman-simple and JTBD-oriented per the house convention. Sections, in this order:
1. What it is and what it is for, in two sentences: Theo needs to tell one install calling twice from two installs calling once, and this header is the smallest thing that answers that question.
2. The wire contract: header name `x-theo-install-id`, lowercase; value 32 lowercase hex from `crypto.randomBytes(16)`; Theo accepts `^[A-Za-z0-9_-]{16,64}$` and the plugin sends the stricter `^[a-f0-9]{32}$` subset (D-01).
3. Where it lives: `MINDRIAN_HOME` else `~/.mindrian/theo-install-id.json`, beside the pre-warm marker, holding only `{id, minted_at}`, mode 0600 where the platform supports it. Minted once, on the first Brain call after install (D-02).
4. Where it rides: every request `callTool` makes, which is both the session initialize and the tools/call. Explicitly NOT the `/register` call, with the reason (D-04 plus the exclusion note in this plan).
5. Rotation: reinstall, or `node scripts/doctor.cjs --reset-install-id` (D-05).
6. Canon Part 8: reproduce this plan's `<why_this_is_not_user_data>` argument in full, including the explicit forbidden-derivation list and the note that `tests/test-339-install-id-header.cjs` arm 9 enforces it with a comment-stripped source scan (D-07).
7. Bucket key, never entitlement: the plugin never reads the header back, never branches on it, and keeps working unchanged when it is absent. The commercial gate remains install-and-update, per `.claude/includes/moat.md` (D-04).
8. Tri-Polar: reproduce this plan's `<tri_polar>` note (D-08).
9. Changing this: any change to the name or the pattern is announced to Theo FIRST. Cite the Theo-side record, `20-INPUT-per-install-header-decision.md`, agreed 2026-09-11 (D-06).

**`commands/doctor.md`.** Extend the `--reset-install-id` bullet added in Task 2 with a cross-link to `docs/THEO-INSTALL-ID.md`, so the flag list is the door to the contract. Re-run `node scripts/build-skill-mirrors.cjs` and `node scripts/build-dist-bundles.cjs` after this edit.

**`CHANGELOG.md`.** Add an entry under the TOP-MOST version heading in the file, whatever version it names when you run -- a release ceremony is moving that placeholder concurrently, so read the current top heading rather than assuming a number. Do NOT create a new version heading and do NOT renumber anything. Use an `### Added` subsection headlined for what the user gets, in the house voice of the existing entries: Theo can now tell one install from another without learning anything about who the install belongs to; name the header, the 32-hex CSPRNG value, the `~/.mindrian/theo-install-id.json` file at mode 0600, the mint-once behaviour, the `--reset-install-id` rotation flag, the new `install_id_present` boolean on the doctor's layer 0, and the Part 8 position in one sentence (opaque handle, never derived from identity, never logged, never printed). Point at `docs/THEO-INSTALL-ID.md`.

**`tests/run-all-339.sh`.** Add four entries to the hand-maintained `EMDASH_TARGETS` array at ~:175-205, in a small block with a `Quick 260911-iko` comment mirroring the existing `Quick 260911-ddd` block: `lib/core/install-id.cjs`, `scripts/doctor.cjs`, `commands/doctor.md`, `docs/THEO-INSTALL-ID.md`. Do not add the new test file -- the loop already appends every discovered `tests/test-339-*` file. Do not soften the `found -eq 0` guard or the `EMDASH_MISSING` fence.

**`tests/test-127-03-canon-part-8-adversarial.sh` -- confirm, do not pre-emptively edit.** The prediction from reading it at planning time is GREEN: it scans a fixed list of six files, `lib/core/install-id.cjs` is not one of them, and the only file on that list this task touches (`lib/core/doctor/class-m-brain-smoke.cjs`) gains a boolean field name that matches none of its forbidden patterns (`fetch\(`, `http\.`, two host literals) and none of its leak-vocabulary tokens. Run it. If the prediction holds, change nothing. If it trips, add the tripping token to the appropriate allowlist WITH a written one-line reason in the file, exactly as `DOC_PROSE_ALLOWLIST` does in the doc-parity test -- never by deleting or weakening a pattern.

**Live loopback wire proof (never against Theo production).** Write a throwaway script in the session scratchpad directory (NOT in the repo, NOT in `tests/`) that: starts `http.createServer` bound to `127.0.0.1:0`; records `req.headers` for every request and answers each with a 200 `application/json` JSON-RPC body; sets `process.env.MINDRIAN_BRAIN_URL` to `http://127.0.0.1:<port>` and `process.env.MINDRIAN_BRAIN_KEY` to a throwaway literal BEFORE requiring `lib/core/brain-client.cjs` (that module resolves `BRAIN_URL` at module scope, so a require before the env set proves nothing); then awaits `callTool('theo_health', {})`; then prints ONLY the header NAME and the count of recorded requests that carried it, for example `x-theo-install-id on 2/2 requests`. It must never print the value. Close the server and exit 0 only when the count equals the request count.

**Live end-to-end, in this order, after the concurrent release ceremony has finished touching the tree (check `git status` read-only; do not run git write commands while it is running):**
1. `bash tests/run-all-339.sh` -- must end `FAIL=0`.
2. `node scripts/doctor.cjs --acceptance` -- must be 20/20. If a point fails ONLY because the working tree is dirty or because the version of record moved under the concurrent release, that is environment-attributable: name the exact failing point, re-run after the ceremony settles and after this task's own files are committed, and never soften the gate to make it pass.
3. `bash tests/test-127-03-canon-part-8-adversarial.sh` -- must exit 0.
4. `node tests/test-339-theo-ask-e2e-live.cjs` -- must PASS, not SKIP. A SKIP means no key resolved or Theo was unreachable, which is an unproven live path, not a green one.
5. The loopback proof script.

Commit LAST, and only once the release ceremony's own commits have landed. Stage only the files this plan names, path by path; never `git add -A`. End the commit message with the executing model's own `Co-Authored-By` trailer as given by its attribution instruction, then the line `Claude-Session: https://claude.ai/code/session_01HBgMttGjUp3zcYdCJkn3Zv`.

No em-dashes in any file touched by this task, including the CHANGELOG entry and the new doc.
  </action>
  <verify>
    <automated>bash tests/run-all-339.sh</automated>
    <automated>bash tests/test-127-03-canon-part-8-adversarial.sh</automated>
    <automated>node scripts/doctor.cjs --acceptance</automated>
    <automated>node tests/test-339-theo-ask-e2e-live.cjs</automated>
    <automated>node "$SCRATCHPAD/loopback-header-proof.cjs"</automated>
    <automated>grep -v '^#' tests/run-all-339.sh | grep -c 'lib/core/install-id.cjs' | grep -qx 1 &amp;&amp; grep -v '^#' tests/run-all-339.sh | grep -c 'docs/THEO-INSTALL-ID.md' | grep -qx 1 &amp;&amp; echo "emdash targets registered"</automated>
    <automated>test -f docs/THEO-INSTALL-ID.md &amp;&amp; grep -q 'x-theo-install-id' docs/THEO-INSTALL-ID.md &amp;&amp; grep -q 'THEO-INSTALL-ID' commands/doctor.md &amp;&amp; echo "contract doc linked"</automated>
  </verify>
  <done>The contract lives in one doc cross-linked from the doctor flag list; the CHANGELOG names the feature under the current unreleased heading; the four new production targets are registered in the em-dash fence; `run-all-339.sh` is FAIL=0; `doctor --acceptance` is 20/20; `test-127-03` is green with no pattern weakened; the live Theo e2e PASSES rather than SKIPS; and the loopback proof observed `x-theo-install-id` on every request callTool made, with the value never printed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin process -> Theo origin | An opaque header crosses an untrusted network on every Brain call. Canon Part 8 governs everything that crosses here. |
| plugin process -> local state dir | `MINDRIAN_HOME` else `~/.mindrian`, owned by the user. The id file is written here and is the user's to read, edit, or delete. |
| doctor / smoke report -> operator stdout | Diagnostic output a user may paste into an issue, a chat, or a bug report. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-iko-01 | Information disclosure | the header value itself | mitigate | Value is 16 CSPRNG bytes with zero input, so it is not a projection of any identifier and cannot be inverted. Task 1 arm 8 asserts no hostname, username, cwd, homedir, or key substring reaches the file; arm 9 scans `install-id.cjs` with comments stripped and fails on `os.hostname`, `os.userInfo`, `process.env.USER`/`USERNAME`/`LOGNAME`, `process.cwd`, `MINDRIAN_BRAIN_KEY`, `resolve-brain-key`, `createHash`. |
| T-iko-02 | Information disclosure | doctor stdout and the brain-smoke report JSON | mitigate | L0 carries `install_id_present` as a boolean only (Task 2). Task 2 arm 16 asserts `JSON.stringify(result)` contains no 32-hex substring; arm 15 asserts the same of `--reset-install-id` stdout, including its failure path. `MINDRIAN_DEBUG` stderr lines print paths, never values. |
| T-iko-03 | Spoofing | the header treated as identity | mitigate | D-04 makes it a bucket key only. The plugin never reads the header back, never branches on presence or absence, and never refuses anything because of it; the commercial gate stays at install and update time per `.claude/includes/moat.md`. A forged or absent value changes nothing on the plugin side. Recorded in `docs/THEO-INSTALL-ID.md` so a later edit cannot quietly widen it. |
| T-iko-04 | Tampering | the local id file | accept | The file sits at mode 0600 in the user's own state dir, and editing or deleting it is a user RIGHT (rotation, D-05), not an attack. A corrupted or invalid value re-mints rather than erroring (Task 1 arm 6), so tampering degrades to a new bucket and never to a broken Brain call. |
| T-iko-05 | Denial of service | an unwritable or unreadable state dir | mitigate | `getInstallId` returns `null` and never throws (Task 1 arm 7); `_installIdHeaders()` returns `{}` inside its own try/catch; the header is omitted and the call proceeds byte-identically otherwise (Task 2 arm 14). A belt that can crash a Brain call would be worse than the gap it closes. |
| T-iko-06 | Elevation of privilege | the header widened into an entitlement by a later change | mitigate | D-06's announce-to-Theo-first rule plus the bucket-key-only clause are written into `docs/THEO-INSTALL-ID.md` (Task 3), which is the door reached from `commands/doctor.md`'s flag list. |
| T-iko-SC | Tampering | npm / pip / cargo installs | not applicable | This plan adds ZERO dependencies. `lib/core/install-id.cjs` requires only `fs`, `path`, `os`, `crypto`. No package-manager install task exists, so the package legitimacy gate does not apply and no legitimacy checkpoint is required. |
</threat_model>

<verification>
Reachability of every must-have artifact, checked before execution:

- `lib/core/install-id.cjs` is reached at run time by `brain-client.cjs::_installIdHeaders` on the first Brain call of any process (all three surfaces), by `scripts/doctor.cjs`'s `--reset-install-id` handler, and by `class-m-brain-smoke.cjs::_layer0`. Three live consumers, none hypothetical.
- `tests/test-339-install-id-header.cjs` is reached by `tests/run-all-339.sh`'s glob (`tests/test-339-*.cjs`) with no runner edit required, and is auto-appended to the em-dash fence's target list by the same glob.
- `docs/THEO-INSTALL-ID.md` is reached from `commands/doctor.md`'s `--reset-install-id` bullet, which mirrors into `skills/doctor/SKILL.md` and `dist/`, so all three surfaces can find it.
- `--reset-install-id` is reached from `commands/doctor.md` (and therefore `/mos:doctor`) and from the CLI directly, and its documentation is enforced by `tests/test-doctor-doc-parity.cjs` rather than by anyone remembering.

No UNREACHABLE artifacts.
</verification>

<success_criteria>
- `node tests/test-339-install-id-header.cjs` passes all 16 arms.
- `bash tests/run-all-339.sh` ends `FAIL=0`, including both generated-artifact `--check` gates and the em-dash fence with the four new targets registered.
- `node tests/test-doctor-doc-parity.cjs` and `node lib/core/doctor/class-m-brain-smoke.test.cjs` pass.
- `bash tests/test-127-03-canon-part-8-adversarial.sh` exits 0 with no forbidden pattern deleted or weakened.
- `node scripts/doctor.cjs --acceptance` is 20/20 on a settled tree.
- `node tests/test-339-theo-ask-e2e-live.cjs` PASSES (not SKIP).
- The loopback proof reports `x-theo-install-id` on every request `callTool` made, and never prints the value.
- `grep -rn` finds no em-dash in any file this plan touched.
- `hooks/hooks.json`, the alias tables, `lib/core/part8-egress-guard.cjs`, and `lib/core/directive-envelope.cjs` are untouched.
</success_criteria>

<output>
Create `.planning/quick/260911-iko-per-install-opaque-header-x-theo-install/260911-iko-SUMMARY.md` when done. Record: the observed header NAME from the loopback proof and the request count it rode (never the value), the `--acceptance` point count, whether `test-127-03` needed an allowlist entry and why, and the version heading the CHANGELOG entry landed under.
</output>
