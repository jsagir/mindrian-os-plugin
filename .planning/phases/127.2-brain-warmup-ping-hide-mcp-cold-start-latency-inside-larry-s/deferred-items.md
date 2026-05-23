# Phase 127.2 Deferred Items

Items surfaced during plan execution that fall outside the explicit plan scope. Logged for future patch beta consideration.

---

## DI-127.2-04-01 -- Sibling POSIX-leak sites in non-scoped scripts (Plan 04 Task 1 sweep)

**Discovered during:** Plan 127.2-04 Task 1 sweep for sibling Windows POSIX path leaks.
**Severity:** P2 (Windows + Git Bash users; silent failure on each invocation).
**Scope status:** Outside Plan 04 explicit sweep targets (`scripts/hsi-*`, `scripts/build-*`, `scripts/release.sh`).

**Sites found:**

| Script | Sites | Pattern |
|--------|-------|---------|
| `scripts/verify-release` | 4 | `python3 -c "import json; print(json.load(open('$PLUGIN_ROOT/.claude-plugin/plugin.json'))['version'])"` and similar; uses `$PLUGIN_ROOT`, `$MARKETPLACE_DIR` |
| `scripts/learn-from-usage` | ~2 | `python3 << 'PYEOF' ... open(analytics_file) ...`; reads paths from env vars (`ANALYTICS_FILE`, `ROOM_DIR`) |
| `scripts/track-analytics` | ~3 | Same heredoc pattern as `learn-from-usage`; reads `${ANALYTICS_FILE}`, `${ROOM_DIR}` |

**NOT vulnerable:**
- `scripts/discovery-cycle.cjs` — uses JS template literal `${step.script}` (not bash var); only affects in-process exec context.
- All explicit Plan 04 sweep targets (`scripts/hsi-*`, `scripts/build-*`, `scripts/release.sh`) — cleanly free of the pattern.

**Fix shape (when picked up):** Apply the `normwin()` shim pattern from Plan 04. For `verify-release` (script-style), use the `$NORMWIN_SHIM` bash-variable approach pioneered in `scripts/reapply-modifications`. For `learn-from-usage` + `track-analytics` (heredocs), inject the helper at top of the heredoc body and wrap every `open(...)` call.

**Recommended landing:** v1.13.0-beta.33 or v1.13.0 final cleanup beta; not a blocker for v1.13.0-beta.32 because:
- `verify-release` is run only on the maintainer release-cut machine (release.sh delegates), not on tester wires.
- `learn-from-usage` + `track-analytics` are session-end / on-demand telemetry surfaces; degrade silently (no analytics written) rather than crashing user-facing UX.

---

## DI-127.2-04-02 -- Windows + Git Bash CI matrix (per RCA Section 6 follow-up)

**Discovered during:** Plan 127.2-04 (Instance #4 RCA).
**Severity:** Process / infrastructure.
**Scope status:** Beyond plugin code; CI infrastructure change.

**Issue:** `scripts/release.sh` currently runs only on Linux + macOS. Instance #4 (Windows POSIX path leak in `scripts/room-registry`) existed for an unknown number of releases and was caught only on Jonathan's dogfood Windows box (the one Windows machine in the test loop). Add Windows + Git Bash to the CI matrix so this class of bug fails in pre-merge, not in tester hands.

**Recommended landing:** Phase 131 (proposed) or as part of v1.14.0 install-lifecycle hardening.

---

## DI-127.2-04-03 -- Cowork cross-tenant activation gap (per Instance #7 RCA Section 8)

**Discovered during:** Plan 127.2-04 (Instance #7 RCA).
**Severity:** Latent P1 in Cowork mode (not yet shipped at scale).
**Scope status:** Cowork-specific; not in v1.13.0 milestone.

**Issue:** The Class N `activation-reached-the-wire` gate added in Plan 04 asserts equality between the live install's MCP server version and `package.json` version-of-record. It assumes ONE active install per host. In Cowork (multi-tenant) mode, a single tenant running `/mos:update` could in-place-update the install while other tenants on the same host continue to serve the OLD version until they explicitly restart. The acceptance gate as currently structured cannot detect cross-tenant drift.

**Recommended landing:** Cowork v1 hardening track. The fix shape is likely "tenant-scoped Class N variant that asserts wire-version-equality across all reachable tenant sessions on the same install host." Defer until Cowork mode actually ships at scale.

---
