---
quick: 260911-iko
verified: 2026-09-11T11:05:20Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Quick Task 260911-iko Verification Report

**Task Goal:** Per-install opaque header `x-theo-install-id` on every Theo call: minted once from crypto, stored in `~/.mindrian`, never derived from identity, rotated only by reinstall or `doctor --reset-install-id`.
**Verified:** 2026-09-11T11:05:20Z
**Status:** passed
**Re-verification:** No — initial verification

All evidence below was re-run independently in this session against HEAD (`4ef6e583`, on top of `ca5331bb`, `03af92f3`). No install-id value is reproduced anywhere in this report.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mint-once, reused across every later call/process | ✓ VERIFIED | `lib/core/install-id.cjs:188-209` `getInstallId` calls `peekInstallId` first, only mints on a miss, with a concurrent-winner re-check after write. Arm 1 + Arm 10 (drift guard vs `brain-prewarm.cjs::markerPath`) both pass: `node tests/test-339-install-id-header.cjs` → `# pass 16 / # fail 0`. |
| 2 | Both of `callTool`'s wire requests carry `x-theo-install-id` with a 32-lowercase-hex value | ✓ VERIFIED | Code read confirms `..._installIdHeaders()` spread at exactly 2 sites: `_ensureSession` init fetch (`brain-client.cjs:493`) and `callTool` tools/call fetch (`brain-client.cjs:713`). Independently re-run loopback proof (own throwaway script, own `http.createServer` on 127.0.0.1, own process, before requiring `brain-client.cjs`): `x-theo-install-id on 2/2 requests`, exit 0. Wire-site grep: `wire sites ok: 2`. |
| 3 | Header omitted, never an error, when the id cannot be minted/read | ✓ VERIFIED | `_installIdHeaders()` (`brain-client.cjs:322-333`) wraps `getInstallId()` in try/catch, returns `{}` on any failure or non-string id. Arm 14 (`MINDRIAN_HOME` under a regular file, ENOTDIR path) passes: no `x-theo-install-id` header recorded, `callTool` does not throw. |
| 4 | `doctor.cjs --reset-install-id` rotates, prints exactly `install id rotated`, prints nothing about the value, exits 0 | ✓ VERIFIED | Independently re-run in a throwaway `MINDRIAN_HOME`: `STDOUT: [install id rotated]`, no 32-hex substring in stdout, exit 0. Code read (`scripts/doctor.cjs:3161-3177`) confirms dispatch before `--acceptance`/class-flag block, failure path also never prints the value (`install id rotation failed (state dir not writable)`), always `process.exit(0)`. |
| 5 | No log line, doctor stdout, or brain-smoke JSON ever contains the id value; presence reported as boolean only | ✓ VERIFIED | `node scripts/doctor.cjs --brain-smoke --json` output scanned: `grep -oE '\b[a-f0-9]{32}\b'` → no match anywhere in the JSON. The only 40-char hex string present is `theo_health.build_sha` (a git SHA, not the install id). `install_id_present` is `true` (boolean). `class-m-brain-smoke.cjs:238-242` reads via `peekInstallId` only (never mints), wrapped in try/catch defaulting to `false`. `node lib/core/doctor/class-m-brain-smoke.test.cjs` → `PASSED: 22 / FAILED: 0`. |
| 6 | The id file holds only `{id, minted_at}`, no identity substrings | ✓ VERIFIED | Code read of `_atomicWrite` (`install-id.cjs:140-171`): `body = { id: id, minted_at: ... }`, nothing else. Atomic temp-then-rename write, `mode: 0o600` on write plus a `chmodSync(0o600)` belt on non-win32. Arms 3, 4, 6, 8, 9 all pass (file shape, mode, re-mint on corruption, no identity substring, comment-stripped source scan for forbidden tokens). |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/install-id.cjs` | mint-once/peek/reset + header name export, min 90 lines | ✓ VERIFIED | 232 lines. Exports exactly `getInstallId, installIdHeaderName, installIdPath, peekInstallId, resetInstallId` (verified via `Object.keys` check, matches plan's exact export-set assertion). `installIdHeaderName === 'x-theo-install-id'`. |
| `tests/test-339-install-id-header.cjs` | RED-first coverage, min 200 lines | ✓ VERIFIED | 432 lines, 16 arms, all pass: `# tests 16 / # pass 16 / # fail 0`. |
| `docs/THEO-INSTALL-ID.md` | one contract doc, contains `x-theo-install-id`, min 40 lines | ✓ VERIFIED | 104 lines. Contains all 9 required sections (what/wire contract/where it lives/where it rides/rotation/Canon Part 8 argument in full/bucket-key-never-entitlement/Tri-Polar/changing-this). Cross-linked from `commands/doctor.md:128`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `brain-client.cjs` | `install-id.cjs` | `require` + `_installIdHeaders()` spread | ✓ WIRED | `require('./install-id.cjs')` inside the memoized helper at `brain-client.cjs:325`. |
| `brain-client.cjs` | two fetch header blocks | `..._installIdHeaders()` spread | ✓ WIRED | Exactly 2 occurrences (grep on comment-stripped source), at `_ensureSession` init (:493) and `callTool` tools/call (:713). `/register` fetch (:381) deliberately excluded, with an inline comment naming the reason. |
| `scripts/doctor.cjs` | `install-id.cjs` | `--reset-install-id` → `resetInstallId()` | ✓ WIRED | `scripts/doctor.cjs:3168` calls `resetInstallId()`; independently re-run, rotates and prints the exact line. |
| `class-m-brain-smoke.cjs` | `install-id.cjs` | `peekInstallId()` → `install_id_present` | ✓ WIRED | `class-m-brain-smoke.cjs:238-240`, boolean-only, `peekInstallId` (not `getInstallId`) so a diagnostic run never mints. |
| `commands/doctor.md` | `scripts/doctor.cjs` `parseArgs` | flag-parity gate | ✓ WIRED (for this flag) | `--reset-install-id` present in `argument-hint` frontmatter and parsed by `parseArgs`. `tests/test-doctor-doc-parity.cjs` reports one violation, but it is a pre-existing, unrelated `--none` frontmatter mismatch — confirmed byte-identical at `e6aef0a0` (unmodified by any of this task's 3 commits). Not a regression introduced by this task. |

### Probe / Command Execution (re-run independently this session)

| Command | Exit | Result |
|---------|------|--------|
| `node tests/test-339-install-id-header.cjs` | 0 | `# tests 16 / # pass 16 / # fail 0` |
| `bash tests/test-127-03-canon-part-8-adversarial.sh` | 0 | `CANON PART 8 ADVERSARIAL AUDIT: PASS (delegation property holds across 6 Phase 127 sources)` |
| `node scripts/doctor.cjs --acceptance` | 0 | `Acceptance full: 20/20 points passed.` (tree clean, `git status --short` empty) |
| `node tests/test-339-theo-ask-e2e-live.cjs` | 0 | `Phase 339 (quick/260910-hni) live e2e smoke: PASS` — live Theo, PASSED not SKIPPED |
| `bash tests/run-all-339.sh` | 1 | `PASS=15 FAIL=1 SKIP=0` — the one failure (`test-339-update-path-single-source.cjs` Arm 5, `scripts/collect-cold-install-evidence.cjs:365`) reproduced byte-identically in a throwaway `git worktree` at `e6aef0a0` (node_modules symlinked in for parity), confirming pre-existing, not introduced by this task |
| `node tests/test-doctor-doc-parity.cjs` | 1 | Pre-existing `--none` frontmatter mismatch, confirmed byte-identical at `e6aef0a0` via the same worktree |
| `node lib/core/doctor/class-m-brain-smoke.test.cjs` | 0 | `PASSED: 22 / FAILED: 0` |
| `node scripts/build-skill-mirrors.cjs --check` | 0 | `OK (112 mirrors match expected content...)` |
| `node scripts/build-dist-bundles.cjs --check-stale` | 0 | `stale=false` |
| Loopback wire proof (independent throwaway script, own `http.createServer`) | 0 | `x-theo-install-id on 2/2 requests` |
| `node scripts/doctor.cjs --reset-install-id` (independent throwaway `MINDRIAN_HOME`) | 0 | stdout `install id rotated`, no 32-hex substring |
| `node scripts/doctor.cjs --brain-smoke --json` scanned for `[a-f0-9]{32}` | 0 | no match; `install_id_present: true` (boolean); only 40-hex match is `theo_health.build_sha` |
| Em-dash scan on `+` lines of `03af92f3`, `ca5331bb`, `4ef6e583` | 0 | clean, all three commits |
| `git diff e6aef0a0..HEAD -- hooks/hooks.json lib/core/part8-egress-guard.cjs lib/core/directive-envelope.cjs` | 0 | empty (untouched); no alias-table files appear in the 13-file changed-file list either |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` marker on any line added by the three commits (`git diff e6aef0a0..HEAD` on the touched files, `+` lines only). Pre-existing "placeholder" occurrences in `scripts/doctor.cjs` and `CHANGELOG.md` predate this task and are unrelated (version-of-record placeholder concept, historical changelog prose).

### Requirements Coverage

Quick task, `requirements: [IKO-01, IKO-02, IKO-03]` declared in PLAN frontmatter; no matching entries found in `.planning/REQUIREMENTS.md` (expected — this repo's REQUIREMENTS.md tracks phase-scoped work, not quick tasks). Not treated as an orphan/gap for a quick-task verification.

### Human Verification Required

None. Every must-have truth, artifact, and key link was verifiable programmatically (source read, independent test re-run, independent throwaway-script re-proof, worktree reproduction of pre-existing red legs).

### Gaps Summary

No gaps. Both pre-existing red legs named in the SUMMARY (`test-339-update-path-single-source.cjs` Arm 5, `test-doctor-doc-parity.cjs`'s `--none` mismatch) were independently reproduced at `e6aef0a0` in a throwaway `git worktree` (never `git stash`), byte-identical to their HEAD failures, confirming they predate and are unrelated to this task's three commits. `hooks/hooks.json`, the alias tables, `lib/core/part8-egress-guard.cjs`, and `lib/core/directive-envelope.cjs` are confirmed untouched. All contract clauses (D-01 through D-08) hold against the actual code, not just the SUMMARY's narrative.

---

_Verified: 2026-09-11T11:05:20Z_
_Verifier: Claude (gsd-verifier)_
