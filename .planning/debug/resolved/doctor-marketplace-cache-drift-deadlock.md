---
kind: rca
slug: doctor-marketplace-cache-drift-deadlock
date: 2026-06-12
reporter: end-user dogfood session (Windows, Claude Code), relayed via Larry
severity: HIGH
component: scripts/doctor.cjs (Class A install-cache recovery) + scripts/post-update-activation.cjs
affected_versions: 1.13.1-beta.16 (live-observed); logic present since the marketplace-cache topology guard landed (Phase 95.2 / 123 family)
canon_gates: Part 6 (dog-fooding -- the harness must catch this), Part 8 (no Brain egress -- N/A, purely LOCAL)
status: RESOLVED 2026-06-12 (quick task 260612-cl7; commits 5ee55987 / 44625a2f / 3068a8a3 / 88603282)
---

> **RESOLUTION (2026-06-12, quick-260612-cl7):** P0a + P0b + P2(a) shipped.
> `checkInstallVersion()` is now topology-aware regardless of legacy-dir
> presence (active root wins; the vestigial legacy dir no longer trips drift);
> skipped-by-design recovery records `report.recoverySkipped`, renders
> `recovery skipped (topology marketplace-cache ...)` instead of the literal
> `recovery failed: unknown`, and exits 0 under `--fix` (read-only drift still
> exits 1); `check-version-and-sha.cjs` resolves LATEST from the
> mindrian-marketplace catalog pin (HEAD ref -- the repo's default branch is
> master, not main) with a disclosed degraded fallback to main plugin.json.
> Regression fences: tests/test-doctor-class-a-vestigial-legacy.cjs (5/5, the
> RCA fixture) + tests/test-check-version-latest-resolution.cjs (5/5) + the
> full pre-existing class A surface green. DEFERRED (not in this fix): P1
> class I reap of the vestigial legacy dir + stale-backup GC, P1
> single-source-of-version-truth named check, Part 6 ACPT coexistence leg,
> P2(b) SHA-path inertness investigation.

# RCA -- `/mos:update` post-update activation deadlocks on `marketplace-cache` topology when a legacy `mindrian-os/` dir coexists

## 0. One-paragraph summary

On a box that has BOTH a marketplace-cache install (registry -> `cache/.../mos/1.13.1-beta.16`) AND a legacy `~/.claude/plugins/mindrian-os/` directory (stuck at `1.13.0-beta.30`), `doctor --fix` enters a permanent contradiction: it **detects drift** against the legacy dir but **skips recovery** because the active topology is `marketplace-cache`, then **exits 1** unconditionally because drift was detected. `post-update-activation.cjs` shells `doctor --fix --json`, sees exit 1, and reports `activation failed: doctor exit 1` -- with NO `recoveryError`, which is why the user sees the useless string `recovery failed: unknown`. The native `claude plugin update` succeeded; only the doctor activation step is wedged. A restart does NOT help -- the deadlock is logical, not a file lock.

## 1. Timeline of the session

1. `/mos:update` -> `check-version-and-sha.cjs` reported `VERSION_DIFFERS`, local `1.13.1-beta.2` -> latest `1.13.1-beta.17`.
   - Side findings: `LOCAL_SHA=unknown` / `REMOTE_TAG_SHA=unknown` (SHA path inert); `LATEST=beta.17` is an `[Unreleased]` in-progress tag.
2. `claude plugin marketplace update` -> OK.
3. `claude plugin update mos@mindrian-marketplace` -> OK, "updated 1.13.1-beta.2 -> **1.13.1-beta.16**". Registry + cache + enabledPlugins all moved.
4. `migrate-stale-user-settings.cjs --apply` -> PASS, clean.
5. `doctor --fix --post-update` -> **exit 1**, `activation failed: doctor exit 1`.
6. Repeated `doctor --fix`, `--fix --all`, `--json`, and a second `--post-update`: identical. Live install never moved off beta.30; no `post-update-restart-pending` touch-file written.

## 2. Evidence (verified this session)

**Three coexisting install dirs:**
| Dir | Version | Role |
|---|---|---|
| `~/.claude/plugins/mindrian-os/` | `1.13.0-beta.30` | Legacy live dir (doctor's hardcoded `INSTALL_DIR`) |
| `~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.1-beta.16/` | `1.13.1-beta.16` | Marketplace-cache install (what the loader actually uses) |
| `mindrian-os.stale-1.13.0-beta.24-2026-05-23-1833`, `mindrian-os.downgrade-attempt-2026-05-23-0440` | -- | Dead backups from 2026-05-23 |

**Resolver vs install-version reader disagree:**
```
resolveActivePluginRoot() => { root: .../mos/1.13.1-beta.16, source: installed_plugins.json, topology: "marketplace-cache" }
doctor install check (INSTALL_DIR = ~/.claude/plugins/mindrian-os) => 1.13.0-beta.30
installed_plugins.json mos version => 1.13.1-beta.16
```

**Structured doctor output after `--fix`:**
```
fixRequested   = true
drift.detected = true   (compare: -1)
classARecovered = null   <- recovery never ran
recoveryError   = null   <- and recorded no error  -> renders as "unknown"
install.recoverable = true
```

**Non-lock proof (fs probes):**
```
parent plugins dir writable: YES
rename NON-loaded stale dir : OK
rename LIVE mindrian-os dir : OK   <- NOT locked; the initial "Windows lock" hypothesis was wrong
```

## 3. Root cause (source-level)

`scripts/doctor.cjs`:

- **Line 4007-4008** -- Class A recovery is gated OFF for marketplace-cache topology:
  ```js
  if (flags.fix && report.drift.detected && !flags.installState
      && resolveActivePluginRoot().topology !== 'marketplace-cache') {
        const result = performRecoveryAtomic(...);   // <- never reached here
  }
  ```
  The inline comment (4009-4015) asserts "with the topology guard above, `drift.detected` is already false for the healthy marketplace-cache case." **That assumption is violated** on this box.

- **Why drift is still detected:** the install-version check reads the hardcoded legacy `INSTALL_DIR` (`~/.claude/plugins/mindrian-os` = beta.30), while the cache latest is beta.16. beta.30 != beta.16 -> `drift.detected = true`. The drift detector and the recovery gate read **two different sources of truth** (legacy dir vs `resolveActivePluginRoot` topology). They contradict.

- **Line 4527** -- unconditional failure exit:
  ```js
  if (report.drift.detected) process.exit(1);
  ```
  Drift is detected -> exit 1, even though recovery was deliberately skipped and no error occurred.

- **`post-update-activation.cjs`** shells `doctor --fix --json`, treats non-zero as failure -> prints `activation failed: doctor exit 1`, never writes the `post-update-restart-pending` touch-file. Because `recoveryError` is null, the renderer at doctor.cjs:3328 falls back to the literal `'unknown'`.

**The deadlock:** the legacy `mindrian-os/` dir is orphaned -- recovery won't touch it under marketplace-cache topology, yet its stale version permanently trips drift detection and the exit-1 gate. No invocation can clear it, and a restart can't either (it is not a lock). The activation can NEVER succeed via tooling on this box.

## 4. Impact

- `/mos:update` Step 7 (post-update activation) fails 100% on any box with the legacy-dir + marketplace-cache combination.
- User is left believing the update failed, though the native loader is correctly on beta.16.
- The dead-sensor symptom (`routing_source: legacy` stamped on every hook this session) is consistent with the live runtime not being on beta.16's engine flip -- the version-source fragmentation makes "what is actually loaded" ambiguous across statusline (reported beta.2), legacy dir (beta.30), and registry (beta.16).

## 5. Recommended fixes (dev team)

**P0 -- break the contradiction.** The exit-1 gate (4527) must not fire for drift that the recovery branch intentionally refuses to act on. Either:
  (a) suppress `drift.detected` when topology is `marketplace-cache` AND the only "drifting" reader is the legacy `INSTALL_DIR` (make the drift detector topology-aware, matching the recovery gate's assumption), OR
  (b) make exit code reflect "recovery skipped by design" (exit 0) vs "recovery attempted and failed" (exit 1). Skipped-by-design must not read as failure to `post-update-activation.cjs`.

**P0 -- stop emitting `unknown`.** When `classARecovered` and `recoveryError` are both null but exit is non-zero, surface WHY (gated/skipped/topology) instead of the literal `'unknown'`. The renderer at doctor.cjs:3328 needs a "recovery skipped (reason)" branch.

**P1 -- reap the orphaned legacy dir.** Class I (install-state migration) should detect a vestigial `~/.claude/plugins/mindrian-os/` under marketplace-cache topology and archive it, so the legacy reader stops tripping drift. Also GC `mindrian-os.stale-*` / `*.downgrade-attempt-*` older than N days (two present from 2026-05-23).

**P1 -- single source of version truth.** Statusline (beta.2), legacy plugin.json (beta.30), and registry (beta.16) disagreed simultaneously. Doctor should assert cross-source equality as a named check and name the discrepancy.

**P2 -- checker hygiene.** (a) Resolve `LATEST` to newest PUBLISHED tag, not an `[Unreleased]` in-progress tag (reported beta.17). (b) Investigate why both SHAs resolve to `unknown` (the SHA-aware in-version-hotfix path is silently inert).

**Part 6 (dog-fooding):** `doctor --dogfood-acceptance` ACPT leg should include the legacy-dir + marketplace-cache fixture; the harness currently does not catch this deadlock class.

## 6. User-side workaround (safe, available now)

The legacy `~/.claude/plugins/mindrian-os/` dir is vestigial -- Claude Code's loader uses the cache (beta.16) per `installed_plugins.json`. Archiving the legacy dir + the two stale backups removes what drift detection compares against, so doctor goes green:

1. Close Claude Code.
2. Move `mindrian-os/`, `mindrian-os.stale-*`, `mindrian-os.downgrade-attempt-*` out of `~/.claude/plugins/` (archive, don't delete, until verified).
3. Reopen; run `/mos:help` (commands resolve from cache) and `/mos:doctor` (drift should clear).

## 7. Correction notice

An earlier draft of this report attributed the failure to a Windows file lock on the live dir held by the running session. Direct `fs.renameSync` probes disproved that (live dir renames fine). The true cause is the topology-gated recovery vs unconditional drift-exit contradiction documented in section 3. Recorded here for honesty per the RCA standard.
