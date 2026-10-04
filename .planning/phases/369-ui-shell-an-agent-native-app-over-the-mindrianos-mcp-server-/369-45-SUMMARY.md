---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 45
subsystem: ui-shell-build
tags: [gap-closure, review, build, dist, freshness, egress, wr-16, wr-17, wr-18, rev369-14, ts369-08, d-07, d-17]
requires:
  - phase: 369-28
    provides: "scripts/build-ui-shell.cjs (build, --check, verifyOutput, sanitize, bare-import check, HOST_REWRITES) and tests/test-369-ui-dist-fresh.cjs arms 1-10"
  - phase: 369-44
    provides: "the dist at source hash bc057a5ce76adc60 and a clean ui/shell source tree"
  - phase: 369.1-08
    provides: "the sharp prune: the payload ceiling gate is 0 findings, so arm 7 is a full green"
provides:
  - "manifest.files: a sha256 for every dist file (270 files, manifest.json excluded); --check re-hashes them and refuses a changed, extra, missing or non-regular file"
  - "--check re-runs verifyOutput on the committed bytes (node_modules, bare imports, unhashed runtime imports, outside hosts, GPL xl-* names, absolute paths)"
  - "the source hash follows the resolved version and integrity of next, react, react-dom and ajv (RUNTIME_PACKAGES) from npm-shrinkwrap.json"
  - "a build refuses over a ui/shell/node_modules that drifted from ui/shell/package-lock.json; installLockSha256 is recorded in the manifest"
  - "BUILD_UI_SHELL_DIST is read by --check only; the build refuses while it is set; every rmSync goes through assertDistRemovable"
  - "INERT_HOSTS positive host allow-list (15 hosts, each with a reason, plus the .invalid class) replaces FORBIDDEN_HOSTS"
  - "builtin plus slash (buffer/, events/, punycode/) is a foreign package; any absolute path prefix or drive path fails"
  - "dist rebuilt at source hash 539768ed075ce362"
affects: [369-46, 369.1 release.sh Step 2.4, 369.1 Desktop payload gate]
tech-stack:
  added: []
  patterns: ["a freshness gate that proves bytes, output and inputs, not only the source hash", "positive allow-lists with a stated reason per entry instead of a deny list", "a test seam read in exactly one read-only command, and a destructive path guarded by real-path equality"]
key-files:
  created: []
  modified:
    - scripts/build-ui-shell.cjs
    - tests/test-369-ui-dist-fresh.cjs
    - lib/ui-shell/dist/ (rebuilt: manifest.json gains files and installLockSha256; static build-id directory renamed to 539768ed075ce3623370)
key-decisions:
  - "The source hash covers the resolved version plus integrity of the four RUNTIME_PACKAGES, NOT the whole root package.json or npm-shrinkwrap.json. Reason: Phase 369.1 edits the package.json files list and prunes the sharp entries in the shrinkwrap; neither changes a byte the dist runs, and hashing them would stale a good dist (and fail release Step 2.4) on every such edit. A bump of next, react, react-dom or ajv does stale it."
  - "installLockSha256 (the hidden lockfile of ui/shell/node_modules) is recorded in the manifest, not hashed: --check must work on a machine with no ui/shell/node_modules. The drift check runs at build time against package-lock.json, which IS hashed."
  - "verifyOutput refuses a bare import of any package outside RUNTIME_PACKAGES, so the hashed list cannot go stale quietly."
  - "Hosts are scanned as raw bytes (latin1) in every file; absolute paths in every file except fonts and images by extension (not by NUL sniffing)."
requirements-completed: [REV369-14]
requirements-advanced: [TS369-08]
duration: ~1h
completed: 2026-10-04
---

# Phase 369 Plan 45: The freshness gate proves the dist Summary

`node scripts/build-ui-shell.cjs --check` now fails on a hand-edited dist byte, an extra or missing file, a new outside host, a `buffer/` import, a build-machine path, a bumped runtime pin or a drifted walled install; and `BUILD_UI_SHELL_DIST` can no longer make the build remove anything.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 0f766b139 | arms 11a-d, 12, 13, 14 added to tests/test-369-ui-dist-fresh.cjs. 11 passed, 7 failed. First FAIL line: `FAIL arm 11a: the manifest carries a sha256 for every dist file (WR-16) - manifest.files is missing` |
| 2 | 3f559c57a | scripts/build-ui-shell.cjs, the test file's arm 4 and helper fixes, and the rebuilt dist, one commit; `--check` exit 0 |

## What was built

- **WR-16, bytes.** `build()` writes `files` (relative posix path to sha256, every dist file but manifest.json) into the manifest. `check()` re-hashes the dist, names every difference (changed, recorded-but-missing, present-but-unrecorded, symlink or other non-regular entry) and exits 1. `files` joined `REQUIRED_MANIFEST_KEYS`, so an old-format manifest reads as stale.
- **WR-16, output.** `check()` now calls `verifyOutput` on the committed dist: node_modules, bare imports, the new unhashed-runtime-import rule, outside hosts, GPL xl-* names, absolute paths.
- **WR-16, inputs.** `computeSourceHash(opts)` adds `@runtime/<name>` entries (version and integrity from the root npm-shrinkwrap.json) for `RUNTIME_PACKAGES = [next, react, react-dom, ajv]`; `opts.shrinkwrapPath` lets a test point it at a copy. A missing shrinkwrap entry is an error. `assertWalledInstallMatchesLock()` runs before every build: each installed package in `ui/shell/node_modules/.package-lock.json` must match `package-lock.json` (version, resolved, integrity) and its own on-disk package.json version, and a lock entry the install lacks must be `optional` (27 platform packages today).
- **WR-17.** The seam is read inside `check()` only. `build()` throws when `BUILD_UI_SHELL_DIST` is set. All three `rmSync` calls on the dist go through `assertDistRemovable`, which compares real paths with this repo's `lib/ui-shell/dist` (the repo root, ui/shell, lib, a home directory, the filesystem root and the temp directory are refused).
- **WR-18.** `INERT_HOSTS` (nextjs.org, react.dev, github.com, raw.githubusercontent.com, json-schema.org, www.w3.org, prosemirror.net, tinyurl.com, bit.ly, datatracker.ietf.org, 127.0.0.1, localhost, and the URL() placeholders a, n, x, each with a one-line reason) plus the reserved `.invalid` class; the scan covers http, https, ws and wss in every file as raw bytes. `foreignSpecifiers` passes only an exact built-in name, so `buffer/`, `events/`, `punycode/` are foreign; the old blanket trailing-slash skip is gone (the one real prefix, `rxdb/plugins/`, is a named inert specifier). The path check fails on `/home/ /Users/ /root/ /opt/ /var/ /srv/ /mnt/ /runner/ /__w/ /tmp/`, a drive letter plus backslash, and the repo root. `sanitize` no longer carries the unused parent-directory root.
- The dist was rebuilt (271 files, source hash 539768ed075ce362, build id directory renamed). `--check` prints `270 dist files verified` and exits 0 at the last commit.

## Verification

- `node scripts/build-ui-shell.cjs --check`: exit 0.
- `MOS_369_STRICT_CEILING=1 node tests/test-369-ui-dist-fresh.cjs`: 18 passed, 0 failed (arms 1-14 including arm 8's installed-layout run with a real server; arm 7 is a full-gate green, the sharp prune having landed: 2276 entries, 43,784,988 bytes unpacked, ceiling 20000 and 268,435,456).
- `node tests/test-369-shell-server.cjs`: 43 passed, 0 failed.
- `node tests/e2e-369/egress-and-canon.cjs`: PASS C1 through C11 (C2: 271 files, 13 host names).
- Mutation arms: one flipped byte in a chunk; an extra file; a removed file; `https://example.org`; `wss://stream.example.net`; `require("buffer/")`; `/root/build/x`; `C:\\build\\x` each exit 1 and name the offender (each with its manifest hash re-recorded so only the output checks can object); next version, react version and react-dom integrity changes change the hash; a change to a non-runtime shrinkwrap entry or an added package does not; `assertDistRemovable` refuses six directories; the build with the seam set exits 1, names `BUILD_UI_SHELL_DIST`, and a sentinel file survives.
- Dashes: `LC_ALL=C /usr/bin/grep -nP "\xE2\x80\x94|\xE2\x80\x93"` over both files prints nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test helper appended after a comment line**
- **Found during:** Task 2 first full run (arm 11d, the `buffer/` case)
- **Issue:** a server chunk ends with a `//# sourceMappingURL` line and no newline, so the appended `require("buffer/")` landed on a comment line, which the import scan skips by design.
- **Fix:** `appendTo` prepends a newline.
- **Files modified:** tests/test-369-ui-dist-fresh.cjs
- **Commit:** 3f559c57a

**2. [Rule 3 - Blocking] Arm 4 referenced the removed FORBIDDEN_HOSTS export**
- **Fix:** arm 4 keeps the six original raw-byte names as a local list and adds the `outsideHosts` allow-list check plus a reason-present check on every `INERT_HOSTS` entry.
- **Commit:** 3f559c57a

**3. [Rule 2 - Missing critical] Drive-letter pattern matched bytes inside a woff2**
- **Issue:** the new path scan flagged `p:\` inside a font.
- **Fix:** fonts and images are skipped by extension for the path scan (hosts are still scanned as raw bytes everywhere).

### Scope notes (stated, not silent)

- The objective text said the hash covers "the root package.json, npm-shrinkwrap.json"; the plan (the contract) says it must NOT hash them whole and tests that a changed `files` list or sharp entry does not change the hash. I followed the plan and hash only the resolved runtime packages (reason in key-decisions). This also keeps release Step 2.4 green while 369.1 edits those two files.
- `installLockSha256` is recorded in the manifest and not hashed (plan item (b) said hash it); hashing it would make `--check` fail on any machine without `ui/shell/node_modules`.
- `ajv` was added to `RUNTIME_PACKAGES` (the plan named next, react, react-dom "and any other bare import"): the dist imports it.
- Not in this plan's files, so not done: IN-07 (the `.test-fault-gate-*` seam in `lib/mcp/tools/gate.cjs`) and IN-11 (an allow-listed environment for `next build`, no `NEXT_PUBLIC_*` leak). The only test seam in `scripts/build-ui-shell.cjs` was `BUILD_UI_SHELL_DIST`, now closed.

## Handoff for Phase 369.1

No 369.1 expectation moved. `release.sh` Step 2.4 still just runs `build-ui-shell.cjs --check` (stronger now, exit 0 at 3f559c57a). `desktop-copy-gate.sh` only copies `lib/ui-shell/dist` and measures the payload; the manifest grew by about 25 KB (the files map), payload numbers stay well inside the ceiling. The dist hash changes ONLY when ui/shell, ui/shared, this script, or the resolved version/integrity of next, react, react-dom or ajv in npm-shrinkwrap.json changes; a 369.1 edit of the package.json files list or of any other shrinkwrap entry (sharp, optional platform packages) does not stale it. A 369.1 bump of one of those four packages DOES, and needs a 369 dist rebuild.

## Known Stubs

None.

## Threat Flags

None. The change removes surface (a destructive env seam) and tightens egress scanning; T-369-45-01 to -05 are mitigated as planned.

## Self-Check: PASSED

- scripts/build-ui-shell.cjs, tests/test-369-ui-dist-fresh.cjs, lib/ui-shell/dist/manifest.json exist.
- Commits 0f766b139 and 3f559c57a are ancestors of HEAD.
- `node scripts/build-ui-shell.cjs --check` exit 0.
