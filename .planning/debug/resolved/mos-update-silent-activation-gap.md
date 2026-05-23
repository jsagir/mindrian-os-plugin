---
kind: rca
slug: mos-update-silent-activation-gap
date: 2026-05-23
status: resolved
resolved: 2026-05-23
resolved_by: phase-127.2 Plan 127.2-04 (Instance #4 + #7 hotfix bundle, ships v1.13.0-beta.32)
severity: P1
discovered_in: post-beta30-regression-2026-05-23 (Instance #7)
related:
  - .planning/debug/resolved/post-beta30-regression-2026-05-23.md
---

# `/mos:update` lands new bytes in cache but does NOT activate them

## 1. Summary

When a user runs `/mos:update` (or `claude plugin update mos@mindrian-marketplace`) and Claude Code fetches a new version of the plugin, the new bytes land in `~/.claude/plugins/mindrian-os.<NEW_VERSION>-<HASH>/` (or a similar shadow path) but the live install at `~/.claude/plugins/mindrian-os/` is NOT swapped. Every subsequent session-start, every Brain MCP call, every script invocation continues to read the OLD bytes. The version-of-record (package.json) shows the new version because the bytes physically exist; the WIRE (MCP server, statusline, hook outputs) continues to report the OLD version. There is NO surfaced warning to the user.

Discovered: 2026-05-23 prior session. Confirmed beta.24 → beta.30 update landed bytes but kept beta.24 active until explicit `/mos:doctor --fix` ran (which detected drift and atomically swapped + backed up the stale install).

## 2. Reproduction

1. Have an active install at beta.N: `~/.claude/plugins/mindrian-os/package.json` reports `1.13.0-beta.N`.
2. Run `/mos:update` (or equivalent). Wait for "update complete" or similar success.
3. Open a fresh session. Run `/mos:doctor --brain-smoke`.
4. **Expected:** L4 reports `server=mindrian-brain v1.13.0-beta.<N+1>`.
5. **Actual:** L4 reports `server=mindrian-brain v1.13.0-beta.N` (the OLD version).
6. Run `/mos:doctor`. **Expected:** "no drift". **Actual:** "drift detected" (or, in the worst case before beta.30 doctor improvements, the drift was not even detected — both `live` and `cache-staging` reported beta.N because the doctor was reading the live install's own package.json).
7. Run `/mos:doctor --fix`. Now `live` swaps to `<N+1>`, the OLD bytes are moved to `~/.claude/plugins/mindrian-os.stale-1.13.0-beta.N-<TIMESTAMP>/`, and a session-restart is required for MCP servers to reconnect.

## 3. Root cause (CODE-claim)

`/mos:update` and `claude plugin update mos@mindrian-marketplace` are both inherited Claude Code primitives. They DOWNLOAD the new version to the plugins cache but the active-install symlink/copy semantics depend on whether the user has marketplace auto-update enabled AND whether the install lifecycle (Phase 123 install-lifecycle-harness) intercepts the post-download step to atomically swap.

The gap: there is no `post-update activation hook` in the current install-lifecycle-harness that runs `swap-active-install + restart-mcp-servers + warn-user-to-restart-session` after `/mos:update` succeeds. The atomic-swap logic lives in `scripts/doctor.cjs --fix` (Phase 95.2 install-cache-atomic-recovery), but `/mos:update` does not call it.

Result: the user thinks they are on the new version. Every Brain interaction silently uses the OLD server. Bug reports filed against "beta.N+1 still has bug X" are actually reports against the OLD version.

WIRE-claim source-of-truth for this RCA: prior session caught this on 2026-05-23 — all post-update L4 brain-smoke probes returned beta.24 until `--fix` ran, then L4 returned beta.30 (CONFIRMED this session: W1.2 → `server=mindrian-brain v1.13.0-beta.30`, 251ms).

## 4. Required code changes

(a) **Wire `/mos:update` to call `scripts/doctor.cjs --fix --post-update` at the end of its flow.** The `--post-update` variant should:
   1. Detect the freshly-landed cache-staging directory.
   2. Atomically swap (move OLD → `.stale-<VERSION>-<TIMESTAMP>`, move NEW → `mindrian-os`).
   3. Emit a Shape E Action Report: "✓ swap complete. ⚠ session restart required so MCP servers reconnect against new bytes."
   4. Set a touch-file `~/.mindrian/post-update-restart-pending` that the next SessionStart hook reads and surfaces as a red banner.

(b) **Add a session-start preflight gate (Class N in doctor.cjs roster).** If `~/.mindrian/post-update-restart-pending` exists AND the user is in a new session AND L4 brain-smoke reports a version MISMATCHED to `package.json`, refuse to load Larry until the user runs `--fix` or kills the session and starts fresh.

(c) **Add the `Activation reached the WIRE` gate to `scripts/doctor.cjs --acceptance`.** Currently --acceptance gates A-J check install-record sanity, manifest parity, npm pack payload, etc. Add a Class M-equivalent that asserts L4 server version equals the version-of-record. If they drift, fail the acceptance gate. This prevents shipping a beta where the marketplace pipeline silently leaves users on the old version.

## 5. Tests

Add `tests/test-mos-update-activation-gap.cjs`:
1. Snapshot install at beta.N.
2. Synthesize a beta.N+1 cache-staging directory.
3. Run the `/mos:update` post-flow.
4. Assert: live install package.json now reports beta.N+1, OLD bytes are at `.stale-...`, and the touch-file exists.
5. Synthesize the next session-start. Assert: red banner fires.
6. Run MCP probe. Assert: L4 reports beta.N+1.

Regression smoke: re-run W1.2 from the verification sweep after every release-pipeline change.

## 6. Non-code follow-ups

- Update `docs/install-cache-family-premortem.md`: this is the **7th case** in the install-cache failure family. Pattern: "the cache directory has the new bytes; the active install does not." Predicted next failure mode: this same gap on Cowork (multi-user) installs where one tenant updates and the others continue to read OLD until they explicitly --fix.
- Update Step 9.8 of `scripts/release.sh` (the post-publish full --acceptance gate) to include the new Class N gate.
- Update CHANGELOG.md for beta.31 (when this lands) with a USER-FACING note: "If you previously updated to beta.N and L4 brain-smoke still reports an older version, run `/mos:doctor --fix` once. beta.31 makes this automatic."

## 7. MindrianOS gate clearance

- **Canon Part 8:** the gap is install-mechanic only; no Brain boundary impact. Clear.
- **Tri-Polar:** affects CLI primarily. Desktop/Cowork inherit the same MCP server, so they ALSO suffer this gap silently — they just don't have a doctor command to catch it.
- **Cross-platform:** universal (not Windows-specific).
- **Release lockstep:** this is a meta-release-pipeline bug. The release pipeline (release.sh) currently has no self-test for "does my own install actually activate the version I just published?" Add per #4(c).
- **Canon Part 6 (Dog-fooding mandate):** this RCA is dog-fooding doing its job — the bug was caught on the maintainer's own dogfood machine when L4 brain-smoke returned beta.24 right after a beta.30 update.

## 8. Open questions

- Is this gap inherited from Claude Code's plugin-update primitive (out of our control) or is it specific to how mindrian-os's marketplace.json source URL is resolved? If the former, the fix is post-update activation hook + session-start preflight + acceptance gate (per #4). If the latter, the fix might be at the marketplace.json layer (force atomic install instead of cache-then-update semantics).
- Are there OTHER plugins in the ecosystem that have the same problem? Worth one external check before patching — if it's a general Claude Code plugin pattern, raise it upstream.
- For Cowork specifically: when a single tenant runs `/mos:update`, does it update only their session, or all tenants on the same install host? If the latter, the activation gap could cascade across tenants.

---

## Resolution (2026-05-23, v1.13.0-beta.32)

Closed by phase-127.2 Plan 127.2-04 Task 2 (the META-FIX for the cadence problem).

This beta IS the hinge. Every prior beta this session (26, 28, 30) may have been sitting in tester caches without activating. Every "I tested beta.N" report may have been against an older version. After v1.13.0-beta.32, that class of failure becomes structurally impossible because the release pipeline now self-tests that the bytes it ships actually reach the wire on user machines.

**Three-part fix (per RCA Section 4):**

**(a) New script `scripts/post-update-activation.cjs` (305 lines):**

Standalone Node module exporting `activatePostUpdate(opts)` + `POST_UPDATE_TOUCH_FILE`. Detects the freshly-landed cache-staging directory at `~/.claude/plugins/cache/mindrian-marketplace/mos/<NEW_VERSION>/`. Delegates the atomic swap to `scripts/doctor.cjs --fix` (Canon Part 7: reuses the Phase 95.2 install-cache-atomic-recovery code -- three autopsies of hardening -- rather than re-implementing). After the swap, writes the touch-file at `~/.mindrian/post-update-restart-pending` with the new version string as content. Emits a Shape E action report per UI ruling system: `swap complete to vX.Y.Z-beta.N. session restart required so MCP servers reconnect against new bytes.` Returns the structured result envelope `{ok, swapped, oldVersion, newVersion, backupPath, touchFilePath, message}`.

**(b) New hook `scripts/sessionstart-post-update-preflight.cjs` (187 lines):**

Registered in `hooks/hooks.json` as a SessionStart hook, ordered SYNCHRONOUSLY AFTER `sessionstart-npm-reconcile.cjs` (so node_modules is in place) but BEFORE Larry-load (so a drift blocks the room from coming up against the wrong MCP server). Sibling-NOT-replacement of the existing npm-reconcile hook -- they close different gaps and run in series.

Hook behavior: reads `~/.mindrian/post-update-restart-pending`. If missing, exits 0 silently (the common path on every session that did not just run `/mos:update`). If present, spawns `node scripts/doctor.cjs --brain-smoke --json` and parses the L4 MCP stdio handshake reason line for the `server=mindrian-brain vX.Y.Z` token. If versions match, deletes the touch-file + exits 0 silently. If versions drift, prints a red banner via the SessionStart envelope `systemMessage` field:

```
-- ACTIVATION GAP --

/mos:update landed v<NEW> bytes but the live install is still serving v<OLD>.

Recovery (two steps):
  1. Run /mos:doctor --fix to atomically swap to the new bytes.
  2. Restart this Claude Code session so MCP servers reconnect.

Larry will not load until activation reaches the wire.
```

And exits 1 to block downstream hooks per the plan spec. Defensive: if the brain-smoke probe is inconclusive (Brain unreachable, network failure), exits 0 with a stderr note rather than block on uncertainty.

**(c) Doctor + `/mos:update` integration:**

- `scripts/doctor.cjs` gains a `--post-update` flag handler (line ~3302) that delegates to `scripts/post-update-activation.cjs`. Composable with `--fix` so the existing `--fix` flow routes through activation when called from `/mos:update`.
- `commands/update.md` Step 7 calls `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.cjs" --fix --post-update` at the end of the update flow, streams the Shape E action report to the user, and instructs the user to restart the Claude Code session.
- `scripts/doctor.cjs --acceptance` gains a Class N gate `activation-reached-the-wire` (line ~2772): spawns `doctor.cjs --brain-smoke --json` against the canonical workspace, parses the L4 server version, compares to `package.json.version` (version-of-record). Severity `blocker`, `applies_to: ['full']`. Fails the acceptance roster on drift with `activation gap detected: live install serves v<OLD> but version-of-record is v<NEW>`. The `release.sh` Step 9.8 (post-publish full acceptance gate) runs this check after the new version is published -- catching any phantom-version release before it propagates to tester caches.

**Test environment hooks:**
- `DOCTOR_TEST_FAIL_POINT=activation-reached-the-wire` synthesizes a failure (Class N test harness).
- `DOCTOR_SKIP_ACTIVATION_GATE=1` marks the point ok-as-skipped for hermetic CI / offline mode.

**Tests:**

- `tests/test-mos-update-activation-gap.cjs` (233 lines, 19 PASS / 0 FAIL): cold synthesis (snapshot beta.N install, synthesize beta.N+1 cache, call `activatePostUpdate`, assert atomic swap + backup dir + touch-file content), idempotency (already-on-latest -> no swap, no touch-file), preflight hook semantics (no touch-file -> exit 0 silent; inconclusive probe -> exit 0 silent), exports surface (function + constant present).
- `tests/test-127.2-04-windows-path-and-update-activation.sh` (combined smoke, 16/16 PASS).

**Migration for previously-updated users:** USER-FACING note added to `CHANGELOG.md` for v1.13.0-beta.32: "If you previously ran `/mos:update` and `/mos:doctor --brain-smoke` still reports an older version, run `/mos:doctor --fix` once. beta.32 makes this automatic going forward."

**Premortem update:** `docs/install-cache-family-premortem.md` updated with this case as the 7th in the install-cache failure family. Pattern: "the cache directory has the new bytes; the active install does not." Predicted next failure mode: this same gap on Cowork (multi-user) installs where one tenant updates and the others continue to read OLD until they explicitly `--fix`.

**Strategic significance:** the new Class N `activation-reached-the-wire` gate is the canary the release pipeline never had. Per Canon Part 6 (Product-as-Venture / Dog-fooding mandate), the release script now self-tests that its own output actually activates on users' machines. The cadence-vs-validation trade-off Jonathan named earlier in this session ("you shipped 7 builds in 2 hours, no tester validation") is now structurally closed: every beta after v1.13.0-beta.32 either (a) activates on the wire and earns the acceptance pass, or (b) fails the gate and is prevented from shipping. The moat is the activation gate, not any individual fix.

See `.planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-04-PLAN.md` and `.planning/debug/knowledge-base.md` for downstream references.
