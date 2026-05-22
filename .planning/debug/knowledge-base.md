# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## heal-command-cwd-misfire-scaffolds-spurious-sections — heal-command scaffolds wrong directory when shell CWD is polluted
- **Date:** 2026-05-17
- **Error patterns:** heal-command, cwd, process.cwd, room-dir, container, sub-rooms, spurious sections, STATE.md, scaffold, exit 0, misfire, parseCliArgs, runHeal
- **Root cause:** scripts/heal-command.cjs parseCliArgs() line 1007 fell back to process.cwd() with zero validation. runHeal() only checked directory existence before scaffolding all 10 steps. Any shell CWD pollution caused heal to silently target and scaffold the wrong directory with no error and exit 0.
- **Fix:** Three-part fix in scripts/heal-command.cjs: (1) assertIsRoom(dir) checks .room-root / STATE.md / ROOM.md sentinels; (2) isContainerDir(dir) detects 2+ direct child dirs each with .room-root and rejects with named list + exit 2; (3) parseCliArgs() tries resolveActiveRoomFromRegistry() before falling back to CWD. New test file: tests/test-heal-command-room-validation.cjs (12 tests).
- **Files changed:** scripts/heal-command.cjs, tests/test-heal-command-room-validation.cjs
---

## mcp-servers-cache-missing-node-modules - MCP servers crash MODULE_NOT_FOUND on the first session after a plugin update
- **Date:** 2026-05-22
- **Error patterns:** MODULE_NOT_FOUND, Cannot find module, @modelcontextprotocol/sdk, node_modules, plugin cache, claude plugin update, MCP servers, Failed to connect, brain unreachable, startup-order race, npm install, lockfile, TOCTOU, stale threshold, dependency probe, vendored deps
- **Root cause:** `claude plugin update` lands a fresh plugin cache with no node_modules (neither marketplace git-clone nor npm tarball ship dependencies). A reconcile hook installs them, but it ran ASYNC so Claude Code spawned the alwaysLoad MCP servers before the ~3s npm install finished -- both servers crashed at module load. The repair mechanism also had a cross-platform defect (bare spawnSync('npm') is dead on Windows where npm is npm.cmd, fragile on Mac under GUI-launch PATH gaps). A later code review of the self-heal backstop found three more correctness bugs: bug_004 non-atomic lock creation (openSync('wx') + separate writeSync left a zero-byte window a peer misread as corrupt and unlinked the live lock); bug_001 stale threshold (90s) shorter than the 120s install timeout with an OR-gated reclaim check (false-stale reclaim of a healthy long install); bug_011 dependency probe limited to sdk+zod (a partially-populated node_modules passed the probe, no heal ran, a deeper require crashed).
- **Fix:** Hybrid B+D. PART 1 vendored production node_modules shipped with the tagged marketplace artifact (release.sh Step 6.7 `npm ci --omit=dev` into Commit A only; main HEAD stays clean) -- deps present the instant the cache lands. PART 2 portable self-heal backstop: lib/core/npm-cli-resolve.cjs runs npm via its absolute npm-cli.js off process.execPath (no PATH, no .cmd, no shell:true). Reconcile hook flipped to async:false + ordered first. PART 3 backstop correctness: bug_004 atomic lock via fs.linkSync of a fully-written temp file + readLock three-way EMPTY/corrupt distinction; bug_001 STALE_THRESHOLD_MS 90s->180s, WAIT_TIMEOUT_MS 100s->200s, isReclaimable() AND-gate (reclaim only when BOTH old AND owner-dead); bug_011 productionDepNames() probes the full package.json dependencies set. semver promoted devDependency->dependency (it crashed /mos:doctor on production-only installs).
- **Files changed:** lib/core/npm-cli-resolve.cjs, lib/core/npm-cli-resolve.test.cjs, lib/core/npm-install-lock.cjs, lib/core/npm-install-lock.test.cjs, lib/core/mcp-dep-heal.cjs, lib/core/mcp-dep-heal.test.cjs, scripts/sessionstart-npm-reconcile.cjs, scripts/release.sh, scripts/verify-release, scripts/doctor.cjs, package.json, package-lock.json, CHANGELOG.md, .claude/includes/release-process.md, hooks/hooks.json, bin/mindrian-brain-mcp-client.cjs, bin/mindrian-mcp-server.cjs
---

