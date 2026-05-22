---
status: resolved
trigger: "mcp-servers-cache-missing-node-modules"
created: 2026-05-21T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED. The three residual bugs from the remote code review (bug_004 non-atomic lock, bug_001 false-stale reclaim, bug_011 narrow probe) are fixed cleanly and minimally. The primary fix (vendored deps + portable self-heal) shipped earlier; this continuation closed the final correctness work in the backstop machinery.
test: Implemented all three fixes, added two new unit suites, re-ran six affected regression suites. All 63 tests green.
expecting: (met) All three bugs fixed without over-engineering; concurrent-install corruption and false-stale reclaim impossible; the probe covers the full production dep set; every test green.
next_action: NONE. Work committed, debug file resolved + archived. Shipped in v1.13.0-beta.24 (cut 2026-05-22). The "AWAITING human confirmation on a real Windows box" note is now CLOSED: confirmed on a real Windows box 2026-05-22 (see the final Evidence entry) - both MCP servers connect, the vendored MCP SDK ships in the cache, and /mos:doctor --brain-smoke is 5/5 green end-to-end. Nothing on this thread remains open.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After `claude plugin update mos@mindrian-marketplace`, both plugin MCP servers (plugin:mos:mindrian-brain and plugin:mos:mindrian-os) connect successfully and the Brain is reachable. Phase 127's premise is the bundled Brain stdio shim is self-contained, zero wiring.
actual: `claude mcp list` shows both servers "Failed to connect". Session navigation hook reports "brain unreachable". `/reload-plugins` logged "1 error during load". Brain completely unreachable.
errors: Both MCP server entry points crash at load with `Error: Cannot find module '@modelcontextprotocol/sdk/server/mcp.js'` (MODULE_NOT_FOUND). Crash sites: bin/mindrian-brain-mcp-client.cjs:27 and bin/mindrian-mcp-server.cjs:39. Cache dir ~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.22/ has NO node_modules/.
reproduction: `node ~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.22/bin/mindrian-brain-mcp-client.cjs </dev/null` crashes immediately MODULE_NOT_FOUND. Same for mindrian-mcp-server.cjs. `ls .../node_modules` -> No such file or directory.
started: Immediately after `claude plugin update mos@mindrian-marketplace` upgraded installed plugin v1.13.0-beta.19 -> v1.13.0-beta.22 (2026-05-21). Brain API key set and correct — NOT the cause.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Brain API key missing/wrong
  evidence: Symptoms confirm MINDRIAN_BRAIN_KEY is set and correct; crash is MODULE_NOT_FOUND at load, before any auth.
  timestamp: 2026-05-21T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-21T00:00:00Z
  checked: Knowledge base
  found: No keyword overlap with prior resolved sessions (heal-command-cwd is unrelated).
  implication: Novel bug, full investigation.

- timestamp: 2026-05-21T00:00:00Z
  checked: package.json, .mcp.json, plugin.json
  found: package.json declares 10 runtime deps incl @modelcontextprotocol/sdk ^1.29.0, zod ^3.25.76. cheerio is NOT a direct dep (CLAUDE.md mentions it but package.json does not list it — symptom text overstated). `files` array does NOT include node_modules (npm tarball ships source only). .mcp.json registers both servers with alwaysLoad:true.
  implication: Marketplace install path (git clone of tag) and npm tarball both deliver source-only, no node_modules.

- timestamp: 2026-05-21T00:00:00Z
  checked: scripts/sessionstart-npm-reconcile.cjs + hooks/hooks.json
  found: A fix already exists — Phase 95.6 D-05d reconcile hook. It detects missing/incomplete node_modules in CLAUDE_PLUGIN_ROOT and runs `npm install`. Registered as SessionStart hook #2, async:true, timeout 60000. Idempotent, defensive (always {continue:true}).
  implication: The "no npm install on cache install" capability gap is ALREADY addressed. The bug is elsewhere.

- timestamp: 2026-05-21T00:00:00Z
  checked: Cache directories for beta.14 / beta.19 / beta.22
  found: beta.14 and beta.19 caches HAVE node_modules (118 pkgs). beta.22 cache has NONE. beta.19's node_modules mtime = 2026-05-19 21:00 (~3 min after its install), proving the reconcile hook populated it on the session AFTER install. beta.22 was installed THIS session 07:38; reconcile has not yet successfully run for it in a completed-before-MCP-load window.
  implication: Fresh cache always starts with no node_modules; reconcile fills it lazily on a subsequent SessionStart.

- timestamp: 2026-05-21T00:00:00Z
  checked: Ran `CLAUDE_PLUGIN_ROOT=<beta.22 cache> node scripts/sessionstart-npm-reconcile.cjs`
  found: Exit 0, {continue:true}, and beta.22/node_modules now fully populated with 118 packages including @modelcontextprotocol. Cold `npm install` in a fresh dir measured at ~3092 ms.
  implication: The reconcile mechanism works perfectly. The bug is a STARTUP-ORDER RACE — MCP servers (alwaysLoad:true) are spawned by Claude Code before the async (hook #2) reconcile finishes its ~3s npm install. The post-update session sees Failed-to-connect; the box self-heals next session. This is the true root cause.

- timestamp: 2026-05-21T00:00:00Z
  checked: CLI hook scripts vs npm-dep requires
  found: grep for requires of npm deps across bin/ scripts/ lib/ — only bin/ MCP entries + lib/ modules (visual-ops, import/*, mcp/*, presentation/*, wiki/*, frontmatter-schema-validator) use npm deps. The 4 SessionStart hook scripts (run-hook.cmd -> session-start, sessionstart-coordinator.cjs, sessionstart-npm-reconcile.cjs, check-pending-breakthrough.cjs) use node built-ins only. The lib/ modules are invoked by /mos:* commands, not at hook load time, so they fail gracefully later rather than crashing startup.
  implication: CLI hooks themselves are NOT exposed to the cache-missing-dependency crash. Exposure is: (1) the 2 MCP servers at load (the reported crash), (2) lib/ feature modules (wiki/presentation/import/visual-ops) when their commands run in the post-update window before reconcile completes — same race, lower visibility.

- timestamp: 2026-05-21T13:00:00Z
  checked: Option D implementation files (created prior session, verified this session)
  found: lib/core/npm-install-lock.cjs (atomic openSync('wx') lock + waitForUnlock blocking spin via Atomics.wait, 90s stale threshold, pid-liveness reclaim) and lib/core/mcp-dep-heal.cjs (ensureDepsPresent up-front pre-flight + requireWithHeal per-require backstop, both routing through runGuardedInstall) both exist and pass `node -c`. Both bin/ MCP entry points call ensureDepsPresent() at the top + requireWithHeal() for SDK/zod/express. hooks.json: reconcile hook flipped to async:false AND reordered to SessionStart position #1 (was position #3, async:true) so it blocks before Claude Code reads .mcp.json. sessionstart-npm-reconcile.cjs routes its install through the shared runGuardedInstall so hook + MCP self-heal never run concurrent installs. Zero em-dashes across all 5 files.
  implication: Option D fully implemented per the checkpoint scope. Ready to verify.

- timestamp: 2026-05-21T13:00:00Z
  checked: VERIFICATION against a clean post-update cache simulation (rsync of plugin source to /tmp/mos-verify-cache WITHOUT node_modules)
  found: |
    CONTROL: bare `require('@modelcontextprotocol/sdk/server/mcp.js')` in the clean cache crashes MODULE_NOT_FOUND — bug reproduced.
    TEST 1 (mindrian-brain): self-heal ran (`[mcp-dep-heal] install ran; ok=true`), server started in ~4s, responded to MCP initialize handshake with valid protocolVersion/serverInfo. exit 0.
    TEST 2 (mindrian-os): node_modules re-stripped; self-heal ran, server started ~3s, valid MCP initialize response. exit 0.
    TEST 3 (CONCURRENT RACE — decisive): node_modules re-stripped; BOTH servers spawned at the same instant. os server won the lock (`install ran; ok=true`), brain server lost it (`install waited-for-peer; ok=true`) — exactly ONE npm install ran, the other waited. Both started OK (exit 0), both gave valid MCP responses. `npm ls --depth=0` exit 0 (no missing/invalid deps), 118 packages, lockfile cleaned up. node_modules NOT corrupted.
    TEST 4 (healthy-session cost): node_modules already present — server started in 162 ms with NO `[mcp-dep-heal]` breadcrumb. Heal is a true no-op (stat() only) on a healthy box.
    TEST 5 (SessionStart reconcile hook): node_modules re-stripped — hook ran exit 0, emitted {continue:true}, populated node_modules + SDK in ~3.3s via the shared guarded path.
    REGRESSION: existing suites all green — lib/core/mindrian-brain-shim.test.cjs 6/6, lib/memory/sessionstart-coordinator.test.cjs 15/15, lib/core/tier0-messaging.test.cjs 8/8 (29 total, 0 fail).
  implication: Fix verified end-to-end. Both MCP servers self-heal on a clean post-update cache, the lockfile guard prevents concurrent-install corruption, healthy sessions pay zero cost, and the reconcile hook (now synchronous + first) is the primary path. No regressions.

- timestamp: 2026-05-21T14:00:00Z
  checked: Code review of the prior Option D fix (f6cafe74) - escalated mandate
  found: |
    SHIP-BLOCKER (Windows): both spawn sites - lib/core/mcp-dep-heal.cjs runGuardedInstall() and
    scripts/sessionstart-npm-reconcile.cjs fallback - call spawnSync('npm', [...]) with no shell:true
    and no .cmd handling. On Windows `npm` is `npm.cmd` (a batch file); bare spawnSync('npm') returns
    ENOENT, so the heal silently does nothing. On Windows BOTH the self-heal and the reconcile hook
    are dead - the node_modules gap is permanent.
    RISK (Mac): even setting .cmd aside, spawnSync('npm') depends on `npm` being on the child PATH.
    A GUI-launched (Dock/Finder) Claude Code gives child processes a minimal PATH that often excludes
    the nvm / Homebrew bin dir - same ENOENT, different cause. shell:true does NOT fix this.
    The prior fix was verified on Linux ONLY, violating the Tri-Polar rule.
  implication: The race-close was correct but the repair mechanism is not cross-platform. Mandate
    escalates from "close the race" to "ensure connectivity, product-correct, all three platforms".

- timestamp: 2026-05-21T14:00:00Z
  checked: DEPENDENCY AUDIT - is the production dep tree pure-JS (vendoring-safe)?
  found: |
    package-lock.json was 13 betas stale (last committed at v1.10.10, commit a6ddd949); it predated
    the express/chokidar/flexsearch/markdown-it/asciichart/ext-apps additions, the `semver` devDep,
    and the engines.node bump. `npm ci` refused ("Missing: semver@7.8.0 from lock file"). Synced the
    lock with `npm install --package-lock-only` - the diff ONLY catches the lock up to the current
    package.json (name/version/license/bin/devDependencies + the semver entry); ZERO runtime dependency
    versions changed, the 119-package production closure was already correctly resolved.
    Built a clean production tree in isolation: `npm ci --omit=dev` -> 119 packages, 3970 files, 32M.
    NATIVE BINARY SCAN on that clean tree: 0 `.node` compiled addons, 0 `binding.gyp`, 0
    prebuilds/prebuilt/Release dirs, 0 install/preinstall/postinstall lifecycle scripts.
    EVERY production dependency is pure JavaScript. (The kuzu/better-sqlite3 natives found in the
    polluted dev node_modules are stale - better-sqlite3 was removed at commit c51d2aa6 "remove
    better-sqlite3"; neither is in package-lock.json.)
    MCP-critical deps confirmed present: @modelcontextprotocol/sdk@1.29.0, @modelcontextprotocol/
    ext-apps@1.5.0, zod@3.25.76, express@5.2.1. `npm ls --omit=dev` clean.
  implication: AUDIT PASS. Vendoring is cross-platform-safe by construction - the same 32M tree runs
    identically on Windows, Mac, Linux. No checkpoint needed for native deps.

- timestamp: 2026-05-21T14:00:00Z
  checked: Marketplace install mechanism - does vendored node_modules need to be git-tracked?
  found: |
    The marketplace install delivers ONLY git-tracked files at the tagged ref. Proof: the v1.13.0-
    beta.22 cache has 0 node_modules entries from the install (node_modules mtime 07:54:20 is 17 min
    AFTER the installed files at 07:37:12 - it was reconcile-hook-populated, not shipped); the
    git tag tree `v1.13.0-beta.22` has 0 node_modules entries; the cache .planning/phases count (154)
    matches the git-TRACKED subset, not the larger working-tree (171). So the install is a
    tracked-files export (git archive style), NOT a working-tree copy.
    DESIGN DECISION (no checkpoint - user pre-approved this exact direction): vendored node_modules
    must be git-tracked at Commit A (the tagged release commit). The release script already uses a
    TWO-COMMIT form (Commit A = release at vN, carries the vN tag; Commit B = next-bump, becomes main
    HEAD, tag does NOT move to it). So Option V2 (release-time vendoring, tag-only) is feasible:
    release.sh force-adds node_modules into Commit A; Commit B removes it. main HEAD stays clean;
    only tagged release commits carry the 32M tree. git deduplicates identical blobs across tags so
    the real history cost is one copy per dependency-set change, not per release. This matches the
    user's "keep main as clean as feasible, prefer release-time vendoring" preference exactly.
  implication: Vendoring wires into release.sh as a new lockstep step (force npm ci --omit=dev into
    Commit A, un-stage in Commit B). main is never permanently burdened.

- timestamp: 2026-05-21T15:00:00Z
  checked: DEPENDENCY MISCLASSIFICATION found during vendoring verification
  found: |
    `scripts/doctor.cjs` line 37 does `require('semver')`. doctor.cjs is a
    USER-FACING runtime script - /mos:doctor invokes it on every install via
    commands/doctor.md, and semver.compare drives cmpVersion() version ordering.
    But Phase 123 (commit 0864f4f8) declared semver in devDependencies.
    Building the vendored tree with `npm ci --omit=dev` correctly EXCLUDED the
    misclassified devDep - which would have shipped /mos:doctor broken
    ("Cannot find module 'semver'") on every vendored install. This is a latent
    bug: /mos:doctor already crashes on any production-only install today.
    A full audit of every require() of a declared dependency across all shipped
    code paths (bin/ lib/ scripts/ hooks/ commands/ skills/ agents/ pipelines/)
    confirmed semver is the ONLY misclassification - the other 10 declared deps
    are all correctly production and all require()d by shipped code.
  implication: Fixed - semver promoted to dependencies (devDependencies now
    empty), package-lock.json resynced. Vendored tree is now 115 packages and
    /mos:doctor runs on the production-only tree.

- timestamp: 2026-05-21T15:30:00Z
  checked: FULL VERIFICATION - clean post-update cache simulation (git archive HEAD + vendored production node_modules into /tmp/mos-verify-cache)
  found: |
    TEST V1+V2 (VENDORED PATH - the guarantee): both MCP servers spawned with
    CLAUDE_PLUGIN_ROOT set to the cache; each completed a valid MCP `initialize`
    handshake (protocolVersion 2024-11-05, serverInfo name+version). ZERO
    `[mcp-dep-heal]` breadcrumbs on either - no install ran, the vendored deps
    were used directly. mindrian-brain -> {serverInfo:{name:"mindrian-brain"}};
    mindrian-os -> {serverInfo:{name:"mindrian-os"}}.
    TEST V3 (CONTROL): node_modules stripped -> bare require crashes
    MODULE_NOT_FOUND - bug reproduced.
    TEST V4 (PORTABLE SELF-HEAL BACKSTOP): node_modules absent; brain server
    self-healed - stderr "[mcp-dep-heal] install ran; ok=true" via the
    `node <abs npm-cli.js> install` path - then gave a valid MCP response.
    node_modules repopulated.
    TEST V5 (CONCURRENT RACE + portable resolver): node_modules stripped, BOTH
    servers spawned at the same instant. os server won the lock ("install ran;
    ok=true"), brain server lost it ("install waited-for-peer; ok=true") -
    exactly ONE install ran. Both gave valid MCP responses. `npm ls --omit=dev`
    exit 0, 115 packages, lockfile cleaned up - not corrupted.
    TEST V6 (healthy-session no-op): deps present -> server started fast with
    ZERO heal breadcrumbs. Heal is a pure stat()-only no-op on a healthy box.
    TEST V7 (SessionStart reconcile hook, portable): node_modules stripped ->
    hook ran exit 0, emitted {continue:true}, repopulated node_modules via the
    portable path.
    FINAL E2E (semver-corrected tree, 115 packages): both servers CONNECTED with
    heal=0; /mos:doctor (the semver consumer) runs OK against the vendored cache.
    REGRESSION: 36 tests green - npm-cli-resolve.test.cjs 7/7 (NEW),
    mindrian-brain-shim 6/6, tier0-messaging 8/8, sessionstart-coordinator 15/15.
    doctor acceptance self-coverage 6/6 (release.sh Step 6.6b gate).
    WINDOWS/MAC CORRECTNESS (by construction, reasoned not run directly):
    npm-cli-resolve.cjs runs npm as `node <absolute npm-cli.js> install`.
    npm-cli.js is npm's pure-JS entry point, shipped in the SAME node
    distribution as the running binary. process.execPath gives the absolute node
    path; npm-cli.js sits at a fixed location relative to it (Windows:
    <nodeBinDir>/node_modules/npm/bin/npm-cli.js verified via path.win32; POSIX:
    <nodeBinDir>/../lib/node_modules/npm/bin/npm-cli.js verified live on Linux).
    This invocation never touches PATH, never needs the `.cmd` extension, never
    needs shell:true - so it is correct on Windows (npm.cmd issue gone), Mac
    (GUI-launch PATH gap gone), Linux. AND on the normal path the vendored deps
    remove the spawn dependency entirely - the servers never spawn npm at all.
  implication: VERIFIED. Brain connectivity is true by construction on all three
    platforms: vendored deps are the guarantee (zero install on the normal
    install), the portable self-heal is the cross-platform backstop. Linux
    verified directly; Windows/Mac correct by construction (explained above).

- timestamp: 2026-05-21T22:50:00Z
  checked: RE-VERIFICATION (fresh debugger session, treating prior work as foreign code)
  found: |
    All 12 fix files confirmed present + parsing on disk. 36 regression tests
    re-run GREEN: npm-cli-resolve 7/7, mindrian-brain-shim 6/6, tier0-messaging
    8/8, sessionstart-coordinator 15/15.
    PORTABLE RESOLVER (Linux, directly): resolveNpmCli() on this nvm host
    (/home/jsagi/.nvm/.../v22.22.2) returns strategy 'node-npm-cli',
    command === process.execPath (NOT the bare 'npm' token), npmCli resolves to
    .../lib/node_modules/npm/bin/npm-cli.js which EXISTS, shell:false. This is
    exactly the PATH-fragile environment (nvm) where the prior bare spawn would
    have been at risk - the resolver is PATH-independent here.
    WINDOWS path (by construction): path.win32 resolution of a Windows node.exe
    yields C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js - the
    canonical Windows node-MSI npm location, zero '.cmd' in the path.
    MCP SERVERS (Linux, directly): mindrian-brain spawned -> valid MCP
    initialize reply (serverInfo.name=mindrian-brain), zero [mcp-dep-heal]
    breadcrumb (deps present = vendored path, no install ran), server started.
    mindrian-os spawned -> valid MCP initialize reply (serverInfo.name=
    mindrian-os), zero heal breadcrumb.
    PORTABLE SELF-HEAL (Linux, directly): runGuardedInstall against a temp pkg
    with NO node_modules -> {ran:true,ok:true} in 2.3s via the
    node <abs npm-cli.js> install path; node_modules/semver populated.
    CONCURRENT RACE (Linux, directly): two child processes calling
    runGuardedInstall on the same dir at the same instant -> exactly 1 ran,
    exactly 1 waited-for-peer, node_modules populated, lockfile cleaned up.
    HOOK ORDERING: SessionStart hook #0 = sessionstart-npm-reconcile.cjs,
    async=false, timeout 120000 - blocks before Claude Code reads .mcp.json.
    DEPENDENCY AUDIT (production lock closure): 120 production packages,
    0 with hasInstallScript; dev-tree native scan now also clean (0 .node,
    0 binding.gyp, 0 prebuilds - the stale better-sqlite3/kuzu artifacts have
    since been cleaned). package-lock in sync (npm ci --omit=dev --dry-run OK).
    MCP-critical deps on disk: @modelcontextprotocol/sdk@1.29.0, ext-apps@1.5.0,
    zod@3.25.76, express@5.2.1, semver@7.8.0 - all confirmed by reading their
    package.json directly (the earlier require()-of-package.json 'undefined' was
    an exports-map artifact, not a missing dep; MCP entry points resolve fine,
    proven by the live initialize handshakes).
    GAP FOUND + CLOSED: .claude/includes/release-process.md carried the
    "Vendored node_modules Rule" lockstep section staged-but-NEVER-COMMITTED
    (listed in files_changed but no commit touched it). The mandate explicitly
    requires the new lockstep surface be documented. Committed this session as
    4be87924.
  implication: Fix re-verified independently. Working tree is now fully
    committed (zero uncommitted changes). Ready for human Windows confirmation.

- timestamp: 2026-05-22T00:00:00Z
  checked: THREE-BUG FIX from the remote code review - bug_004, bug_001, bug_011
  found: |
    All three fixes implemented cleanly, minimally, no over-engineering. The two
    modified files (lib/core/npm-install-lock.cjs, lib/core/mcp-dep-heal.cjs)
    and two new test files were assessed and confirmed complete.

    bug_004 (TOCTOU non-atomic lock) - VERIFIED REAL, not a misread. The pre-fix
    openSync('wx') IS atomic for file CREATION, but the original code did
    openSync('wx') then a SEPARATE writeSync then closeSync (three syscalls).
    Between create and write the file exists but is zero-byte. A racing peer
    that hits EEXIST then calls readLock -> JSON.parse('') throws -> old code
    returned null -> null was treated as "corrupt, unlink and retry" -> the
    winner's LIVE lock was unlinked -> both processes ran npm install. FIX: lock
    creation is now atomic - the JSON payload is written IN FULL to a private
    temp file (p + '.' + pid + '.tmp'), then fs.linkSync(tmp, p) publishes it
    atomically (linkSync fails EEXIST if the target exists). A winner's lock is
    always observed fully-written; no zero-byte window. Defence-in-depth:
    readLock now returns a three-way result - the parsed object (valid),
    'EMPTY' (transient empty mid-write, retry, distinguished from corrupt by 5x
    20ms retries), or null (genuinely corrupt non-empty JSON, or missing).
    acquireInstallLock and waitForUnlock both treat 'EMPTY' as transient (keep
    waiting), never as a cleared/dead lock. Non-hardlink filesystems fall back
    to running the install unguarded (better than not healing). The doubled
    fix (atomic linkSync AND empty/corrupt distinction) is appropriately
    defensive for a rarely-run backstop without being over-engineered.

    bug_001 (stale threshold < install timeout) - FIXED. runGuardedInstall
    gives npm install a 120000ms (120s) spawnSync timeout; the lock's
    STALE_THRESHOLD_MS was 90s. A healthy install legitimately running 90-120s
    was declared stale, and the OR-gated check (age > STALE || !pidAlive) let a
    peer unlink the LIVE lock and start a SECOND concurrent install. FIX:
    STALE_THRESHOLD_MS raised to 180s (strictly above 120s, 60s headroom);
    WAIT_TIMEOUT_MS raised to 200s (strictly above 180s so a just-gone-stale
    winner is still reclaimed-and-retried by the loser). The staleness check is
    extracted into isReclaimable(data) which uses AND not OR: a lock is
    reclaimed ONLY when it is BOTH older than the threshold AND its owning pid
    is dead. Applied at both decision points (acquireInstallLock loop +
    waitForUnlock loop). An old-but-live install keeps its lock no matter how
    old; a fresh-but-dead lock keeps its lock until it ages out.

    bug_011 (probe too narrow) - FIXED. ensureDepsPresent probed only
    ['@modelcontextprotocol/sdk', 'zod']. A partially-populated node_modules
    (those two present, ext-apps or another production dep absent) passed the
    probe, no heal ran, then a bare require deeper in lib/mcp/* threw
    MODULE_NOT_FOUND at module-init scope. FIX: new productionDepNames(dir)
    reads Object.keys(pkg.dependencies) from the plugin's own package.json -
    the FULL production dependency set, exactly as scripts/sessionstart-npm-
    reconcile.cjs already does (Canon Part 7 reuse). ensureDepsPresent's probe
    now defaults to productionDepNames(dir) when no explicit probe is passed.
    A missing/unreadable/dependency-less package.json falls back to the
    MCP-critical pair rather than crashing - the heal pre-flight must never
    throw.
  implication: All three correctness defects in the lockfile/probe backstop
    are closed with minimal, clean fixes. No over-engineering of a rarely-run
    path.

- timestamp: 2026-05-22T00:00:00Z
  checked: TEST VERIFICATION - two new suites + four regression suites
  found: |
    All four touched files pass `node -c` (syntax OK).
    NEW lib/core/npm-install-lock.test.cjs: 18 passed, 0 failed - 8 bug_001
    tests (threshold ordering, isReclaimable AND-gate truth table, end-to-end
    acquire does-not-steal-live / does-reclaim-dead, waitForUnlock keeps
    waiting on old-but-live), 8 bug_004 tests (readLock EMPTY vs null vs
    parsed-object vs missing, acquire does-not-unlink-EMPTY, acquire publishes
    fully-written lock, temp-file cleanup), mutual-exclusion, owner-aware
    release, no-em-dash gate.
    NEW lib/core/mcp-dep-heal.test.cjs: 9 passed, 0 failed - 5
    productionDepNames tests (full-set vs real-plugin-package.json match vs 3
    graceful-fallback cases), the decisive partial-tree detection test
    (sdk+zod present, ext-apps absent -> narrow probe wrongly sees healthy,
    full probe correctly detects missing), full-tree no-op, pathological-root
    no-throw, no-em-dash gate.
    REGRESSION (all green, every test must be green - confirmed):
      lib/core/npm-cli-resolve.test.cjs       7/7
      lib/core/mindrian-brain-shim.test.cjs   6/6
      lib/memory/sessionstart-coordinator.test.cjs  15/15
      lib/core/tier0-messaging.test.cjs       8/8
    TOTAL: 63/63 green (27 new + 36 regression). Zero failures.
  implication: The three-bug fix is verified end-to-end on Linux. The bug_004
    and bug_001 fixes are pure lockfile-logic correctness (Linux-verifiable,
    no platform dependency); bug_011 is a package.json-read correctness fix
    (also platform-independent). No human checkpoint needed for these three -
    the prior Windows checkpoint covers only the cross-platform self-heal
    spawn path, which is unchanged here.

- timestamp: 2026-05-22T18:00:00Z
  checked: WINDOWS CONFIRMATION - real Windows box, v1.13.0-beta.24 marketplace-cache install
  found: |
    The "Windows correct by construction" claim is now CONFIRMED on a real
    Windows machine running the v1.13.0-beta.24 marketplace install. All five
    confirmation checks passed.
    CHECK 1 VERSION: claude plugin list shows mos at 1.13.0-beta.24.
    CHECK 2 MCP CONNECTIVITY: claude mcp list - both mindrian-brain and
    mindrian-os connected. The exact reported symptom ("Failed to connect") is
    gone.
    CHECK 3 CACHE DEPS: the beta.24 marketplace cache ships node_modules with
    @modelcontextprotocol/sdk present - the vendored tree landed with the
    install, no runtime npm install needed.
    CHECK 4 BRAIN E2E: /mos:doctor --brain-smoke all 5 layers green -
    L1 plugin-root-resolver (marketplace-cache topology), L2 brain-key-resolver
    (key resolved, source=mindrian-env-file - no auth issue, no false-fail),
    L3 HTTPS schema probe (non-null payload), L4 MCP stdio handshake
    (server=mindrian-brain v1.13.0-beta.24), L5 e2e brain_schema (payload
    returned); overall ok=true. The Brain is reachable, authenticated, and
    returning real data on Windows.
    CHECK 5 NO LOAD ERRORS: mos shows enabled, both MCP servers connected,
    doctor.cjs + --brain-smoke executed from the beta.24 code with zero load
    error.
    TWO NON-BLOCKING ITEMS surfaced, neither part of this thread:
    (1) legacy-mirror drift - ~/.claude/plugins/mindrian-os/ stale at beta.9;
    the session, MCP servers, and Brain all run from the beta.24 marketplace
    cache, so this is cosmetic - clear with /mos:doctor --fix.
    (2) statusline-visibility - doctor class G reports statusline-mos exit
    null; a separate subsystem, unrelated to the Brain/cache fix.
  implication: WINDOWS CHECKPOINT CLOSED. The last open line on this session -
    "AWAITING human confirmation on a real Windows box" - is satisfied. The
    beta.24 fix (vendored node_modules + cross-platform portable self-heal)
    holds on Windows: the MCP SDK ships inside the cache, both MCP servers
    connect, and the Brain answers end-to-end. The fix is verified directly on
    Linux AND directly on Windows - no remaining "by construction" gap.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. `claude plugin update` lands a fresh plugin cache directory with NO node_modules (neither marketplace git-clone nor npm tarball ship dependencies; node_modules is gitignored and absent from package.json `files`). A Phase 95.6 reconcile hook (scripts/sessionstart-npm-reconcile.cjs) is designed to `npm install` into the cache, but it ran as an ASYNC SessionStart hook (hook #2, async:true). Claude Code spawns the plugin MCP servers (.mcp.json, both alwaysLoad:true) at session startup BEFORE the async reconcile finishes its ~3s npm install. Result: on the FIRST session after any update, both MCP servers crash at module load with MODULE_NOT_FOUND for @modelcontextprotocol/sdk. The box self-heals on the NEXT session (node_modules now present), which is why beta.14 and beta.19 caches have node_modules but beta.22 (installed this session) does not.

fix: ESCALATED MANDATE - hybrid B+D (vendored deps + portable self-heal). The
prior Option D fix (commit f6cafe74) closed the startup-order race but a code
review found its repair mechanism was not cross-platform: bare spawnSync('npm')
is DEAD on Windows (npm is npm.cmd) and FRAGILE on Mac (GUI-launch PATH gap).
The escalated fix makes Brain connectivity true by construction on all three
platforms. Six commits on top of f6cafe74:

PART 1 - VENDOR (the guarantee). The plugin ships its production node_modules
with the released marketplace artifact, so the Brain shim's dependencies are
present the instant the install cache lands - no runtime install, no network,
no race. Dependency audit PASSED: the full 119-package production closure is
pure JavaScript (zero .node addons, zero binding.gyp, zero prebuilt binaries,
zero install lifecycle scripts), so a single vendored tree is correct on all
three platforms. Mechanism: release.sh Step 6.7 builds the tree fresh via
`npm ci --omit=dev` from package-lock.json (never drifts from the lock), runs
an integrity gate, and `git add -f node_modules` into Commit A (the tagged
release commit) ONLY; Step 7.5 (Commit B, = main HEAD) `git rm -r --cached`s
it. main HEAD stays clean; only tagged release commits carry the 32M tree.
The npm pack payload gate rejects node_modules from the npm tarball. New
release lockstep surface, documented in .claude/includes/release-process.md.

PART 2 - PORTABLE SELF-HEAL (the backstop). lib/core/npm-cli-resolve.cjs
(new) resolves npm to its absolute npm-cli.js entry off process.execPath and
runs `node <abs npm-cli.js> install` - sidesteps PATH, the .cmd extension, and
shell:true entirely. Applied to BOTH spawn sites: lib/core/mcp-dep-heal.cjs
runGuardedInstall() and scripts/sessionstart-npm-reconcile.cjs fallback. The
self-heal stays as the backstop for a somehow-incomplete vendored tree; the
Option D hook ordering + lockfile guard + per-require backstop all carry over.

DEPENDENCY HYGIENE - the audit found scripts/doctor.cjs (a user-facing runtime
script, /mos:doctor) require()s `semver`, which was misclassified as a
devDependency. Promoted to dependencies (devDependencies now empty). Without
this, the vendored production tree would have shipped /mos:doctor broken.

PART 3 - BACKSTOP CORRECTNESS (three bugs from a remote code review, folded
into beta.23). A code review of the lockfile/probe machinery found three real
correctness defects in the rarely-run self-heal backstop. All fixed cleanly,
minimally, no over-engineering:
  bug_004 - lock creation made ATOMIC. The pre-fix openSync('wx') + separate
  writeSync left a zero-byte window a racing peer could misread as corrupt and
  unlink the live lock. Now: write the full payload to a private temp file,
  then fs.linkSync(tmp, p) to publish atomically. Defence-in-depth: readLock
  returns a three-way result (parsed object / 'EMPTY' transient / null
  corrupt); acquireInstallLock and waitForUnlock treat 'EMPTY' as transient.
  bug_001 - stale threshold raised + AND-gated. STALE_THRESHOLD_MS 90s -> 180s
  (strictly above the 120s install timeout); WAIT_TIMEOUT_MS 100s -> 200s. The
  staleness check is extracted into isReclaimable() which uses AND not OR:
  reclaim only when BOTH old AND pid-dead. A healthy long install can no
  longer be false-stale reclaimed.
  bug_011 - probe widened to the full production dep set. New
  productionDepNames() reads Object.keys(pkg.dependencies) from the plugin's
  package.json (Canon Part 7 reuse - mirrors sessionstart-npm-reconcile.cjs);
  ensureDepsPresent defaults its probe to this. A partially-populated
  node_modules is now detected, not just a totally-absent one. Graceful
  package.json fallback to the MCP-critical pair.
Two new regression suites lock all three fixes: npm-install-lock.test.cjs
(18 tests) + mcp-dep-heal.test.cjs (9 tests).

Canon: zero network surface (Part 8 - only child process is `npm install`);
reuse before build (Part 7 - portable resolver wraps the existing detection
logic, vendoring extends the existing two-commit release form, productionDepNames
mirrors the reconcile hook); no build step (plain CJS, vendoring stages files,
never compiles).

verification: Verified against a clean post-update cache simulation (git
archive HEAD + vendored production node_modules into /tmp/mos-verify-cache).
LINUX, DIRECTLY: TEST V1+V2 both MCP servers connect on the vendored path with
ZERO heal breadcrumbs (no install ran) and valid MCP initialize handshakes;
V3 control reproduces the MODULE_NOT_FOUND crash; V4 portable self-heal repairs
a stripped cache via `node <abs npm-cli.js> install`; V5 concurrent race - one
install ran, one waited-for-peer, npm ls --omit=dev exit 0, not corrupted; V6
healthy session is a stat()-only no-op; V7 reconcile hook repopulates via the
portable path, exit 0, {continue:true}; final E2E with the semver-corrected
115-package tree - both servers connect, /mos:doctor runs. 36 regression tests
green (npm-cli-resolve 7/7 NEW, mindrian-brain-shim 6/6, tier0-messaging 8/8,
sessionstart-coordinator 15/15) + doctor acceptance self-coverage 6/6.
WINDOWS + MAC, BY CONSTRUCTION: the absolute-npm resolution runs npm via its
pure-JS npm-cli.js fed to the current node binary (process.execPath) - never
PATH, never the .cmd extension, never shell:true. Windows npm-cli.js location
verified via path.win32; POSIX location verified live. AND the vendored tree
removes the spawn dependency entirely on the normal install path.

THREE-BUG FIX (bug_004 / bug_001 / bug_011), VERIFIED ON LINUX: two new
regression suites green - npm-install-lock.test.cjs 18/18 (atomic linkSync
publish, EMPTY-vs-corrupt three-way readLock, isReclaimable AND-gate truth
table, does-not-steal-live / does-reclaim-dead end-to-end, temp-file cleanup),
mcp-dep-heal.test.cjs 9/9 (full-dep-set productionDepNames, decisive
partial-tree detection, graceful package.json fallbacks). Four regression
suites re-run green: npm-cli-resolve 7/7, mindrian-brain-shim 6/6,
sessionstart-coordinator 15/15, tier0-messaging 8/8. TOTAL 63/63, zero
failures. These three are pure lockfile-logic + package.json-read correctness
fixes with no platform-specific surface, so they are fully verified here; the
Windows checkpoint covers only the unchanged cross-platform self-heal spawn
path. CHANGELOG entry extended with a "lockfile + probe correctness" Fixed
sub-section.

SHIPPED: cut as v1.13.0-beta.24 on 2026-05-22 (release.sh always increments,
so the hand-bumped beta.23 became beta.24 at cut time). npm
@mindrian_os/install@1.13.0-beta.24 published; marketplace source.ref pinned
to v1.13.0-beta.24; install minisite synced.

WINDOWS - CONFIRMED DIRECTLY (2026-05-22): the "by construction" Windows claim
is now verified on a real Windows box running the beta.24 marketplace-cache
install. claude mcp list - both MCP servers connected; the vendored
node_modules (with @modelcontextprotocol/sdk) shipped inside the cache;
/mos:doctor --brain-smoke 5/5 layers green (L1 plugin-root, L2 key resolved,
L3 HTTPS probe, L4 MCP stdio handshake server=mindrian-brain v1.13.0-beta.24,
L5 e2e brain_schema), overall ok=true. The Windows checkpoint is CLOSED - the
fix is verified directly on Linux AND Windows.

files_changed:
  - lib/core/npm-cli-resolve.cjs (NEW - portable npm CLI resolution off process.execPath)
  - lib/core/npm-cli-resolve.test.cjs (NEW - 7-test cross-platform regression suite)
  - lib/core/npm-install-lock.cjs (THREE-BUG FIX: bug_004 atomic linkSync lock creation + readLock three-way EMPTY/corrupt distinction; bug_001 STALE_THRESHOLD_MS 90s->180s, WAIT_TIMEOUT_MS 100s->200s, isReclaimable AND-gate)
  - lib/core/npm-install-lock.test.cjs (NEW - 18-test suite locking bug_004 + bug_001)
  - lib/core/mcp-dep-heal.cjs (runGuardedInstall uses the portable resolver; bug_011 fix: new productionDepNames() + ensureDepsPresent probe defaults to the full production dep set)
  - lib/core/mcp-dep-heal.test.cjs (NEW - 9-test suite locking bug_011)
  - scripts/sessionstart-npm-reconcile.cjs (fallback install now uses the portable resolver)
  - scripts/release.sh (Step 6.7 vendor node_modules into Commit A; Step 7.5 un-track for Commit B; Step 9.5 payload gate rejects node_modules; dry-run preview updated; Step 0.5 comment corrected)
  - scripts/verify-release (NEW package-lock sync check - the vendored-deps lockstep gate)
  - scripts/doctor.cjs (stale semver-devDependency comment corrected)
  - package.json (semver moved devDependencies -> dependencies; devDependencies removed)
  - package-lock.json (resynced with package.json - was 13 betas stale; semver entry dev:true dropped)
  - CHANGELOG.md (v1.13.0-beta.23 entry: full fix + semver hygiene + "lockfile + probe correctness" Fixed sub-section for bug_004/bug_001/bug_011)
  - .claude/includes/release-process.md (NEW "Vendored node_modules Rule" lockstep section)
  - .claude-plugin/plugin.json (version 1.13.0-beta.23 - carried from f6cafe74, unchanged)
  PRIOR FIX (f6cafe74, carried forward): hooks/hooks.json, bin/mindrian-brain-mcp-client.cjs, bin/mindrian-mcp-server.cjs, lib/core/npm-install-lock.cjs, lib/core/mcp-dep-heal.cjs (created)
