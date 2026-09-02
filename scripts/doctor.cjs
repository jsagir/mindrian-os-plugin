#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 93 D2 -- /mos:doctor diagnostic + recovery for install-cache drift.
 *
 * Detects whether the live install at ~/.claude/plugins/mindrian-os/ is
 * out of sync with the marketplace cache at
 * ~/.claude/plugins/cache/mindrian-marketplace/mos/<latest>/, and offers
 * a one-shot recovery via --fix that backs up the stale install and
 * replaces it with the latest cached version.
 *
 * MODES:
 *   doctor             read-only diagnostic - exits with status code only
 *   doctor --fix       runs backup-then-replace recovery if drift detected
 *   doctor --json      machine-readable output (for hooks / regression tests)
 *
 * Exit codes:
 *   0  -> healthy, no drift
 *   1  -> drift detected (read-only mode)
 *   2  -> drift detected and recovered (--fix mode)
 *   3  -> internal error (cannot read directories, no marketplace cache, etc.)
 *
 * Phase 93 scope. See docs/autopsies/2026-04-28-install-cache-drift-incident.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
// Phase 126 Plan-02: semver package for numeric-aware prerelease ordering
// in cmpVersion (line ~194). semver@^7.7.4 is a PRODUCTION dependency in
// package.json (it was a devDependency until the debug session
// mcp-servers-cache-missing-node-modules audit found that classification
// was wrong -- doctor.cjs is a user-facing runtime script, so semver must
// be present on every install, including the vendored production tree).
// Canon Part 7 reuse: scripts/release.sh also uses semver for pre-release
// algebra; this is the same dep reused for scripts/doctor.cjs.
const semver = require('semver');

// -- Paths -----------------------------------------------------------

// Phase 217 Plan-01 (D-02): shared constants + helpers + the pure class-A
// constituent readers live in the leaf module lib/core/doctor/shared.cjs. ONE
// destructuring require -- doctor.cjs -> shared.cjs is the ONLY direction (no
// back-require). C (the color table), HOME, PLUGIN_HOME, INSTALL_DIR,
// MARKETPLACE_CACHE_DIR, PLUGIN_ROOT, parseVersion, cmpVersion,
// resolveActivePluginRoot (re-exported by shared from
// lib/core/active-plugin-root.cjs), readRegistry,
// readInstalledPluginsVersion, checkInstallVersion, checkMarketplaceCache, and
// checkDevSourceConsistency all resolve here. INSTALL_DIR remains the source of
// truth for the class A check; new code MUST use resolveActivePluginRoot()
// instead of the hardcoded INSTALL_DIR constant.
const {
  C,
  HOME,
  PLUGIN_HOME,
  INSTALL_DIR,
  MARKETPLACE_CACHE_DIR,
  PLUGIN_ROOT,
  parseVersion,
  cmpVersion,
  resolveActivePluginRoot,
  readRegistry,
  readInstalledPluginsVersion,
  checkInstallVersion,
  checkMarketplaceCache,
  checkDevSourceConsistency,
  // Phase 217 Plan 06: the class I/J shared readers moved to shared.cjs with the
  // I/J migration. doctor.cjs still needs these five in the
  // --report-registration-bug assembler (Canon Part 7 reuse); the rest are now
  // internal to the install-state / deployment-surfaces runner modules.
  collectVersionOfRecord,
  computeVersionDivergences,
  readLegacyConfigPin,
  detectMarketplaceCacheInstall,
  readInstalledPluginsInstallPath,
} = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'shared.cjs'));

// Phase 217 Plan 06: class I (install-state) + class J (deployment-surfaces)
// migrated to registry-driven cadence:always runner modules. The accumulative
// engine owns their check + fix-then-recheck under the --install-state flag
// (both share it, exactly as the retired main() block). doctor.cjs imports the
// runners' RAW check entries ONLY for the --acceptance path (buildAcceptance
// checklist keys on the historical 'healthy' status); never a duplicate body
// (Pitfall 4). The runner check(ctx) surfaces map 'healthy' -> 'ok' for the
// engine's report.checks vocabulary.
const installStateModule = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'install-state-module.cjs'));
const deploymentSurfacesModule = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'deployment-surfaces-module.cjs'));
const checkInstallState = installStateModule.checkInstallState;
const checkDeploymentSurfaces = deploymentSurfacesModule.checkDeploymentSurfaces;
// Phase 217 Plan 04: the SINGLE umbilical/room target resolver + the .room-root
// walk-up + the section walk + generator spawn all moved WITH the class B/C/E
// checks into their registry runners (lib/core/doctor/cascade-rooms*-module.cjs,
// room-md-module.cjs). doctor.cjs no longer references any of them directly.
// Phase 139 Plan-02 (S2 accumulative-engine skeleton): the version-dispatch
// substrate. The hand-maintained module registry (data/doctor-modules.json,
// mirrors data/deployment-surfaces.json's "new entry = no code change" pattern)
// + doctor's OWN persisted applied-through watermark (readDoctorApplied /
// writeDoctorApplied at ~/.mindrian/doctor-applied.json -- NOT the session-start-
// overwritten ~/.mindrian-last-version, per the watermark_not_lastversion LOCKED
// decision). The selector (runAccumulativeEngine) generalizes the proven
// lib/core/install-state.cjs::migrateIfNeeded semver-dispatch + future-version-
// DEFER + additive-idempotency shape: it runs every module whose
// introduced_version is in (applied_through, running], idempotently.
const DOCTOR_MODULES_PATH = path.join(__dirname, '..', 'data', 'doctor-modules.json');
const { readDoctorApplied, writeDoctorApplied } = require(path.join(__dirname, '..', 'lib', 'core', 'migration-snapshot.cjs'));
// Phase 95.6 D-09 / R-01: the install-receipt const (INSTALL_RECEIPT_JSON) moved
// into lib/core/doctor/install-incomplete-module.cjs with the class H check
// (Phase 217 Plan 05).

// -- Argument parsing ------------------------------------------------

function parseArgs(argv) {
  const flags = {
    fix: false, json: false, verbose: false,
    cascadeRooms: false, verifySurface: false, roomMd: false, uiCompliance: false,
    statuslineVisibility: false,
    // Phase 217 Plan-02 (D-05): class card-fire-health -- reports the health of
    // the scripts/check-card-fire.cjs self-diagnostic instrument (intercept log
    // exists/valid-JSONL/fresh, classifier/counter seams intact, session store
    // parseable). cadence:always module, so a --card-fire-health-only run is a
    // class-flag run (exit-0 invariant, no once-heal pass); also set by --all.
    cardFireHealth: false,
    installState: false,
    // Phase 121.5-05 Sub-plan F (SEED-007 absorption): class K (stale-first-
    // touch-copy) checks every first-touch surface declared in
    // data/first-touch-surfaces.json for two regression patterns:
    //   (1) stale_version_hardcode -- a vX.Y.Z literal older than the running
    //       plugin version (the SEED-007 trigger);
    //   (2) em_dash_violation -- any U+2014 EM DASH in a surface flagged with
    //       em_dash_check: true (the feedback_no_emdashes hard rule).
    // Per data/first-touch-surfaces.json each surface declares both invariants
    // and an allowlist of doc-example version strings. Renamed from class H
    // in 121.5-05-PLAN.md (class H is install-incomplete; deviation Rule 3).
    staleFirstTouch: false,
    // Phase 121.5-08 Sub-plan J (D-09 final clause): class L
    // (deprecated-commands-you-still-use). Scans recent
    // ~/.claude/projects/.../*.jsonl session transcripts (last 7 days)
    // for /mos:<deprecated> patterns where the deprecated name maps to a
    // canonical /mos:<new> per the v1.13.0-beta.16+ rename table:
    //   heal       -> doctor --heal-room
    //   query      -> graph
    //   organize   -> rooms organize
    //   hmi-status -> doctor --ui-compliance
    //   visualize  -> dashboard --mermaid
    //   diagnostics -> fingerprint
    // MINDRIAN_DOCTOR_TRANSCRIPTS_DIR overrides the default scan dir for
    // hermetic tests. Activated by --deprecated-usage AND --all.
    // Pure LOCAL scan; zero network surface (Canon Part 8).
    // Letter L chosen because A..K are already assigned (A install-cache,
    // B+C cascade-rooms, D verify-surface, E room-md, F ui-compliance,
    // G statusline-visibility, H install-incomplete, I install-state,
    // J deployment-surfaces, K stale-first-touch-copy).
    deprecatedUsage: false,
    // Phase 127-02 BRAIN-MCP-127-08: class M (Brain end-to-end smoke).
    // 6-layer probe (plugin root resolver, key resolver, HTTPS schema probe,
    // MCP stdio handshake, e2e brain_schema via the shim, store identity).
    // Diagnostic-only; class-flag invariant applies (exit 0 even on FAIL).
    // Letter M is the next free letter after L (CONTEXT D4 text reads "K"
    // but K is taken).
    brainSmoke: false,
    // quick(260706-13z) D14: class S (Eureka local-embedding-stack smoke).
    // 4-layer probe (deps present, vec backend, model cache, graceful degrade).
    // Diagnostic-only; class-flag invariant applies (exit 0 even on FAIL). Never
    // downloads a model unless MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1. Letter S
    // is the next free letter after R (runtime-reachability, Phase 185).
    eurekaSmoke: false,
    // Phase 123 Plan-04 (HARNESS-123-11 + HARNESS-123-12): release-gate-as-a-
    // command. --acceptance runs the 7-point checklist; --pre-tag filters to
    // the 5 pre-tag-applicable points; --light-npx skips the mktemp HOME
    // override sandbox in the npx-roundtrip point (operator opt-in for slow
    // networks / hermetic CI). --acceptance has its OWN exit-code contract
    // (0 = all points passed; 1 = any point failed) and is NOT a class flag,
    // so the class-flag-always-exit-0 invariant does NOT apply.
    //
    // Phase 126.1 hotfix (2026-05-15): added `preFlight` tier. release.sh
    // Step 6.6 calls --pre-tag AFTER Steps 3-6 intentionally bump
    // plugin.json + package.json + CHANGELOG, so verify-release-clean-tree
    // cannot live in 'pre-tag'. The new `pre-flight` tier is a strict
    // subset of pre-tag MINUS in-flight-incompatible checks; release.sh
    // Step 2.5 calls --pre-flight BEFORE Step 3 mutates anything, restoring
    // the clean-tree gate. Mutually exclusive with --pre-tag; if both
    // pass, --pre-tag wins.
    acceptance: false, preTag: false, preFlight: false, lightNpx: false,
    // Phase 127.2-03 Task 2 (Finding F1 + F7): --check-rs-engine pre-flights
    // Python deps reachable from scripts/rs-engine.py (Engine 1 Act 1 surface
    // for /mos:find-bottlenecks et al.). ADD-ONLY -- not a class flag; has
    // its OWN dispatch + exit-code contract (0 = deps present; 1 = deps
    // missing with actionable fix line). NOT in --all because --all is for
    // class A-M drift detection, not for environment readiness probes.
    // Closes the Windows tester 2026-05-23 silent-failure class.
    checkRsEngine: false,
    // Phase 127.2 Plan 04 Instance #7: --post-update routes through
    // scripts/post-update-activation.cjs (atomic-swap delegate to the
    // existing --fix pipeline + touch-file write so the next session's
    // sessionstart-post-update-preflight.cjs verifies activation reached
    // the wire). ADD-ONLY -- not a class flag; has its OWN dispatch +
    // exit-code contract (0 = activated or already on latest; 1 = swap
    // attempted and failed). Composes with --fix when called as
    // `doctor --fix --post-update` from /mos:update Step 7.
    postUpdate: false,
    // Phase 146 Plan 04 (ACPT-01..05) + Phase 150.5-03 (ACPT-06):
    // --dogfood-acceptance is the LOOP-FIRES gate -- the Phase 146 milestone
    // gate. It runs the 6 ACPT dogfood drivers
    // (tests/test-acpt-0{1,2,3,4,5,6}-*.cjs) as child processes and aggregates
    // their exit codes. It has its OWN exit-code contract (0 = every ACPT
    // hermetic leg passed; non-zero = a leg failed), separate from the existing
    // release --acceptance, and mirroring how --acceptance is "NOT a class flag"
    // with its own contract -- the class-flag-always-exit-0 invariant does NOT
    // apply. Per the ROADMAP Phase 146 mandate: exit 0 = the milestone ships as
    // "Larry Reaches"; non-zero = the milestone is renamed. The ACPT-05 driver's
    // LIVE mode_a arm self-skips when Brain is unreachable (Plan 03), so the gate
    // passes on the hermetic legs WITHOUT a reachable Brain -- the gate must NOT
    // require Brain (Canon Part 8: --dogfood-acceptance adds zero network surface
    // in doctor itself; the spawned drivers are LOCAL/hermetic).
    dogfoodAcceptance: false,
    // Phase 150-08 (MEM-09 / D-09): --claims is the CLAIM HARNESS gate -- the
    // public-site-claim acceptance gate. It shells tests/claim-harness/run-all-
    // claims.sh (the C1..C7 falsifiable drivers + the gates) and returns its OWN
    // self-contained exit code (0 = every claim is true by instrumentation;
    // non-zero = a claim failed), a SIBLING of --acceptance, NOT folded into the
    // class roster (the class-flag-always-exit-0 invariant does NOT apply). Canon
    // Part 8: the harness is LOCAL/hermetic; the Brain LIVE arms self-skip via
    // class-m-brain-smoke, so the gate is CI-green without a reachable Brain. The
    // DOCTOR_CLAIM_FAIL_POINT env hook (mirroring DOCTOR_TEST_FAIL_POINT) makes
    // the gate's own failure path testable.
    claims: false,
    // Phase 150.9 Plan-02: --drift activates Class P (prose-vs-code, report-only)
    // + Class Q (gsd-record drift) + the DRIFT.md writer. OPT-IN ONLY (D-04):
    // NOT added to the --all block, NOT in the default session-start roster.
    drift: false,
    all: false, simulateWrite: null,
    scanCommandsDir: null, scanScriptsDir: null,
    // Phase 194-07 (PSB-14): --bind-check <roomDir> local room-health job.
    bindCheck: false, bindCheckDir: null,
    // Quick task 260705-jeq (D-01, D-02): --report-registration-bug is a NEW
    // read-only sibling mode (like --check-rs-engine) that proves every locally-
    // checkable cause of "valid install yet a command did not register" is CLEAN
    // and assembles a paste-ready Anthropic bug report. Diagnostic-only: it never
    // claims a "healthy"/"fixed" status and is NOT a --fix action. NOT in --all
    // because --all is the class A-M drift roster, not an escalation reporter.
    // Exit 0 whenever the report assembles (even offline); non-zero only if the
    // assembler itself throws. Report goes to stdout only (never a file).
    reportRegistrationBug: false,
    // Phase 233 Plan-01 (RCA 4d): graph-derive-health. Reports whether a room's
    // SEMANTIC edge layer ever landed -- BELONGS_TO edges present with ZERO
    // cascade edges means the derivation never succeeded (the ~16-damaged-room
    // shape). Scopes to the active room by default; --cascade-rooms widens it to
    // every registered room, exactly as classes B and C already share that flag.
    // --heal-room is the operator-facing sugar for `--graph-derive-health --fix`
    // and is the literal flag the v1.13.0-beta.16 rename table
    // ('heal' -> 'doctor --heal-room') has advertised since before it existed;
    // this is where that documented mapping becomes real. Pure LOCAL room.db
    // reads through the read-only navigation door + a LOCAL queue write; zero
    // network surface (Canon Part 8).
    graphDeriveHealth: false,
  };
  for (const arg of argv) {
    if (arg === '--fix') flags.fix = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '--cascade-rooms') flags.cascadeRooms = true;
    else if (arg === '--verify-surface') flags.verifySurface = true;
    else if (arg === '--room-md') flags.roomMd = true;
    else if (arg === '--ui-compliance') flags.uiCompliance = true;
    else if (arg === '--statusline-visibility') flags.statuslineVisibility = true;
    else if (arg === '--card-fire-health') flags.cardFireHealth = true;
    else if (arg === '--install-state') flags.installState = true;
    else if (arg === '--stale-first-touch') flags.staleFirstTouch = true;
    else if (arg === '--deprecated-usage') flags.deprecatedUsage = true;
    else if (arg === '--graph-derive-health') flags.graphDeriveHealth = true;
    // --heal-room is sugar, not a second code path: it activates the SAME class
    // and turns on --fix, so the heal runs through the engine's one
    // fix-then-recheck flow (never a bespoke heal dispatch).
    else if (arg === '--heal-room') { flags.graphDeriveHealth = true; flags.fix = true; }
    else if (arg === '--brain-smoke') flags.brainSmoke = true;
    else if (arg === '--eureka-smoke') flags.eurekaSmoke = true;
    else if (arg === '--drift') flags.drift = true;
    else if (arg === '--acceptance') flags.acceptance = true;
    else if (arg === '--pre-tag') flags.preTag = true;
    else if (arg === '--pre-flight') flags.preFlight = true;
    else if (arg === '--light-npx') flags.lightNpx = true;
    else if (arg === '--check-rs-engine') flags.checkRsEngine = true;
    // Quick task 260705-jeq: sibling reporting mode; deliberately NOT added to
    // the --all activation block below (same exclusion rationale as
    // --check-rs-engine: --all is class A-M drift detection, not escalation).
    else if (arg === '--report-registration-bug') flags.reportRegistrationBug = true;
    else if (arg === '--post-update') flags.postUpdate = true;
    else if (arg === '--dogfood-acceptance') flags.dogfoodAcceptance = true;
    else if (arg === '--claims') flags.claims = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    // Phase 194-07 (PSB-14 / D-10): --bind-check <roomDir> is a SIBLING flag (like
    // --acceptance) with its OWN never-block exit-0 contract. It runs a LIGHTWEIGHT
    // LOCAL structural room-health check + registers this session's presence at
    // BIND-TIME (never per-turn, never a Brain call).
    else if (arg === '--bind-check') flags.bindCheck = true;
    else if (arg.startsWith('--bind-check=')) { flags.bindCheck = true; flags.bindCheckDir = arg.slice('--bind-check='.length); }
    else if (arg === '--all') flags.all = true;
    else if (arg.startsWith('--simulate-write=')) flags.simulateWrite = arg.slice('--simulate-write='.length);
    else if (arg.startsWith('--scan-commands=')) flags.scanCommandsDir = arg.slice('--scan-commands='.length);
    else if (arg.startsWith('--scan-scripts=')) flags.scanScriptsDir = arg.slice('--scan-scripts='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(usageText());
      process.exit(0);
    }
  }
  // --all activates every class flag.
  if (flags.all) {
    flags.cascadeRooms = true;
    flags.verifySurface = true;
    flags.roomMd = true;
    flags.uiCompliance = true;
    flags.statuslineVisibility = true;
    flags.installState = true;
    flags.staleFirstTouch = true;
    flags.deprecatedUsage = true;
    flags.brainSmoke = true;
    flags.cardFireHealth = true;
    flags.graphDeriveHealth = true;
  }
  // --pre-tag implies --acceptance (convenience; running --pre-tag standalone
  // is meaningless).
  if (flags.preTag) flags.acceptance = true;
  // --pre-flight implies --acceptance for the same reason. If both --pre-tag
  // and --pre-flight are passed, --pre-tag wins downstream (the mode resolver
  // checks preTag first); --pre-flight is the strict-subset tier release.sh
  // Step 2.5 uses BEFORE Step 3 mutates the tree.
  if (flags.preFlight) flags.acceptance = true;
  // Phase 194-07: capture the space-separated `--bind-check <roomDir>` value (the
  // `=` form is captured inline above). The value is the arg following the flag,
  // provided it is not itself a flag.
  if (flags.bindCheck && !flags.bindCheckDir) {
    const bcIdx = argv.indexOf('--bind-check');
    if (bcIdx !== -1 && typeof argv[bcIdx + 1] === 'string' && !argv[bcIdx + 1].startsWith('--')) {
      flags.bindCheckDir = argv[bcIdx + 1];
    }
  }
  return flags;
}

function usageText() {
  return `Usage: doctor.cjs [flags]

Default (no flag) runs class A install-cache check + class N plugin-enabled-state
(the silent-disable detector -- runs on a bare doctor run because the plugin's own
SessionStart hooks cannot fire while the plugin is DISABLED).

Class flags (combine freely; --all activates them all):
  --cascade-rooms          class B (.room-root sentinel) + class C (active-room guard silence)
  --graph-derive-health    graph-derive-health (RCA 4d): did this room's semantic edge layer ever
                           land? Reports FAIL when BELONGS_TO edges exist with zero cascade edges,
                           WARN on a derive queue entry stuck past 3 days or a recorded failure log.
                           Active room by default; add --cascade-rooms to sweep every room.
  --heal-room              sugar for --graph-derive-health --fix: re-enqueues every WARN/FAIL room
                           through the existing dedup-by-roomDir derive sweep (idempotent).
  --verify-surface         class D (live cascade end-to-end against test fixture)
  --room-md                class E (ROOM.md/MINTO.md presence under .room-root)
  --ui-compliance          class F (UI Ruling System scan)
  --statusline-visibility  class G (user-settings drift, plugin install integrity, statusline-mos isolated execution)
                           + class H (install-incomplete: missing statusLine block and/or a halted .install-receipt.json)
  --card-fire-health       card-fire-health (D-05): health of the check-card-fire.cjs self-diagnostic
                           instrument -- intercept log exists/valid-JSONL/fresh (~/.mindrian/card-fire-
                           intercepts.log), classifier/counter library seams intact, render-coverage
                           registry parses, session store readable. cadence:always, LOCAL-only, no fix.
  --install-state          class I (install-state + topology + 6-way version-of-record consistency)
                           + class J (deployment-surface manifest reconciliation)
  --stale-first-touch      class K (stale-first-touch-copy: stale version literals + em-dash violations
                           in greeting surfaces declared by data/first-touch-surfaces.json; SEED-007 absorption)
  --deprecated-usage       class L (deprecated commands you still use: scans last-7-days session
                           transcripts at ~/.claude/projects/.../*.jsonl for /mos:<deprecated>
                           patterns; surfaces a per-command "use /mos:<new> instead" hint.
                           Phase 121.5-08 Sub-plan J. LOCAL-only, zero network.)
  --brain-smoke            class M (Brain end-to-end smoke: 6-layer probe -- plugin root,
                           key resolver, HTTPS schema, MCP stdio handshake, e2e brain_schema,
                           store identity (stale-replica detection, quick 260819-c9b).
                           Diagnostic-only; reports the exact failing layer. Phase 127-02.)
  --eureka-smoke           class S (Eureka local-embedding-stack smoke: 4-layer probe --
                           deps present, vec backend, model cache, graceful degrade.
                           NON-cascading; never downloads a model unless
                           MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1; rolls into --acceptance.
                           Diagnostic-only; reports the exact stopping layer. quick 260706-13z.)
  class N                  plugin-enabled-state (DRIFT-12 / silent-disable detector): reads
                           ~/.claude/settings.json enabledPlugins + installed_plugins.json.
                           installed && enabled===false -> CRITICAL (re-enable hint); enabled
                           ===true or absent -> OK. Runs on a bare doctor run AND under --all (NOT
                           behind a flag -- a disabled plugin cannot run its own hooks). LOCAL
                           read only, never writes settings.json.
  --drift                  class P (prose-vs-code drift, REPORT-ONLY -- wraps
                           check-skill-vs-code-drift + check-first-touch-drift; never
                           edits prose, even under --fix) + class Q (gsd-record drift --
                           shells out to gsd-tools validate health --raw, parses W007
                           ROADMAP gaps + I001 missing SUMMARYs). With --fix, writes the
                           DRIFT.md baseline (root index + per-folder detail) and stubs
                           missing SUMMARYs (mechanical heal); prose stays report-only.
                           OPT-IN ONLY: independent of --all, NOT in the session-start
                           roster. Release/CI invokes it explicitly. LOCAL-only, zero
                           network. Phase 150.9 (FIX-13).
                           + class R (runtime-reachability drift -- the RUNTIME
                           assertion P/Q lack: FAILS NON-ZERO when a capability is
                           WIRED in the connector registry but UNREACHABLE by
                           decide() at runtime via the Phase-184 projection reader;
                           deterministic, LOCAL-only, zero network. Phase 185
                           DRIFT-01).
  --all                    activate all class flags

Bind-time lifecycle job (Phase 194-07 -- separate from class flags):
  --bind-check <roomDir>   PSB-14 / D-10: a LIGHTWEIGHT LOCAL room-health check run
                           at BIND-TIME (never per-turn, never a Brain call). Verifies
                           the room dir exists + carries a .room-root sentinel +
                           .mindrian/room.db opens with nodes/edges tables, and on a
                           green report registers this session in the room's presence
                           ledger (lib/core/session-presence.cjs). Rides the stale-reap
                           cadence (dead-pid or mtime>5m presence files are reaped; a
                           live pid never). NEVER-BLOCK: an unhealthy room degrades to an
                           advisory and STILL exits 0 (binding is never hard-blocked).
                           Also appends a WATCH-only WARN finding row (Phase 225-02) when
                           the bundled SQLite is inside the upstream WAL-reset corruption
                           window (< 3.51.3, fixed upstream in commit 298a1c84) AND a live
                           co-session is present in this room -- detect-only, an
                           environment condition the user cannot repair locally; never
                           touches report.healthy or the exit code (still never-block).

Release-gate runner (Phase 123 Plan-04 -- separate from class flags):
  --acceptance             run the 7-point release-gate checklist (install-state +
                           deployment-surfaces + version-of-record-repo + verify-release +
                           doctor-all + version-of-record-published + npx-roundtrip).
                           Hard abort (exit non-zero) on any sub-check failure.
                           NO --allow override -- release infra is the one gate you cannot skip.
  --pre-tag                with --acceptance: filter to the 5 pre-tag-applicable points
                           (skips version-of-record-published + npx-roundtrip which are
                           false until AFTER the tag + npm publish). --pre-tag IMPLIES
                           --acceptance. release.sh Step 6.6 runs this BEFORE git tag.
  --pre-flight             with --acceptance: filter to pre-flight-applicable points
                           (strict subset of --pre-tag minus in-flight-incompatible
                           checks like verify-release-clean-tree). Runs BEFORE release.sh
                           mutates plugin.json / package.json / CHANGELOG. Mutually
                           exclusive with --pre-tag; if both pass, --pre-tag wins.
  --light-npx              with --acceptance (full): skip the mktemp HOME-override sandbox
                           in the npx-roundtrip point; resolve npx --no-install --help
                           instead of doing a live install. Operator opt-in.

Environment readiness probes (Phase 127.2 Plan 03 -- separate from class flags):
  --check-rs-engine        pre-flight Python deps reachable from scripts/rs-engine.py
                           (the Engine 1 Act 1 surface for /mos:find-bottlenecks et al.).
                           Probes top-level imports against the runtime's python (python3
                           preferred, python fallback). On missing deps emits an actionable
                           fix line: "Run: pip install -r requirements-hsi.txt --user".
                           Closes the Windows tester 2026-05-23 silent-failure class.
                           Exit 0 = deps present; exit 1 = deps missing (own contract,
                           NOT the class-flag-always-exit-0 invariant).
  --report-registration-bug  (Quick task 260705-jeq) READ-ONLY escalation reporter:
                           proves every locally-checkable cause of "valid install yet a
                           command did not register" is CLEAN (install-cache drift,
                           enabledPlugins silent-disable, legacy config.json pin,
                           marketplace clone git-dirt, version-of-record legs, on-disk
                           command count, static precondition sweep), then assembles a
                           paste-ready Anthropic bug report. Diagnostic-only: never a
                           --fix, never claims a status; the root cause is a confirmed
                           host-side core bug. stdout only; --json for the machine shape.
                           Exit 0 whenever the report assembles (even offline); non-zero
                           only if the assembler itself throws. NOT in --all.
  --post-update            (Phase 127.2 Plan 04 Instance #7) atomically activate
                           freshly-landed cache-staging bytes via scripts/post-update-
                           activation.cjs (delegates to --fix pipeline + writes the
                           ~/.mindrian/post-update-restart-pending touch-file). Wired
                           into /mos:update Step 7 + composable as --fix --post-update.
                           Exit 0 = activated or already on latest; exit 1 = swap failed.

Loop-fires gate (Phase 146 -- the milestone gate; separate from class flags):
  --dogfood-acceptance     run the 6 ACPT dogfood drivers (engine-fires,
                           websearch-hat-scoped, first-material-explore,
                           filing-cascade-surfaces, brain-derive-tier-rise,
                           dial-atomic-emission) as
                           child processes and aggregate their exit codes. This is
                           the Phase 146 loop-fires gate: it certifies the loop
                           FIRES across the dogfood criteria. It has its OWN
                           exit-code contract (0 = all 6 ACPT hermetic legs
                           passed; non-zero = a leg failed) and is NOT a class
                           flag -- the class-flag-always-exit-0 invariant does NOT
                           apply. Per the ROADMAP Phase 146 mandate: exit 0 = the
                           milestone ships as "Larry Reaches"; non-zero = the
                           milestone is renamed. The ACPT-05 LIVE mode_a arm
                           self-skips when Brain is unreachable, so the gate is
                           green on the hermetic legs WITHOUT a reachable Brain --
                           the gate never requires Brain/web/Vercel. Composes with
                           tests/run-all-146.sh (the full-surface aggregator).

Claim harness gate (Phase 150 -- the public-site-claim gate; separate from class flags):
  --claims                 run the claim harness (tests/claim-harness/run-all-
                           claims.sh): the C1..C7 falsifiable public-site-claim
                           drivers + the gates. A SIBLING of --acceptance: it has
                           its OWN exit-code contract (0 = every claim is true by
                           instrumentation; non-zero = a claim failed) and is NOT a
                           class flag -- the class-flag-always-exit-0 invariant does
                           NOT apply. Canon Part 8: the harness is LOCAL/hermetic;
                           the Brain LIVE arms self-skip via class-m-brain-smoke, so
                           the gate is green WITHOUT a reachable Brain. The semantic
                           claims (C2-good, C4-relevance) are carved to the Part-10
                           human empathy gate, never machine-faked. The
                           DOCTOR_CLAIM_FAIL_POINT env hook synthesizes a failure of
                           the gate for its own self-test.

Behavior flags:
  --fix                attempt auto-recovery for each class that supports it
                       (class H: re-stamps the canonical statusLine block when missing, idempotently)
  --json               machine-readable output (for hooks / regression tests)
  --verbose, -v        extra diagnostic detail
  --simulate-write=<p> simulate a PWD write at <p> for class C active-room mismatch
  --scan-commands=<d>  override commands/ scan dir for class F (default: ./commands)
  --scan-scripts=<d>   override scripts/ scan dir for class F (default: ./scripts)
  --help, -h           print this usage

Exit codes:
  0  healthy, no drift across activated classes; --acceptance: all points passed
  1  drift detected (read-only mode); --acceptance: any point failed (hard abort)
  2  drift detected and recovered (--fix mode)
  3  internal error
`;
}

// -- Comparable semver helpers + diagnostic checks -------------------
// parseVersion, cmpVersion, checkInstallVersion, checkMarketplaceCache, and
// checkDevSourceConsistency moved to lib/core/doctor/shared.cjs (Phase 217
// Plan-01 D-02) and are imported at the top of this file.

// -- Recovery --------------------------------------------------------
// Phase 95.2 D-01..D-04: atomic-swap recovery.
// Pattern: cp -> verify -> two-step rename. Destructive ops only after
// non-destructive verification has passed. POSIX rename(2) is atomic on
// the same filesystem (~/.claude/plugins/ is single-mount in practice).
// For cross-fs (EXDEV) we fall back to cpSync+rmSync per safeRename().

function performRecoveryAtomic(installVersion, latestCacheVersion) {
  const sourceDir = path.join(MARKETPLACE_CACHE_DIR, latestCacheVersion);
  if (!fs.existsSync(sourceDir)) {
    return { status: 'error', detail: `marketplace cache for ${latestCacheVersion} not found at ${sourceDir}`, stage: 'precheck' };
  }
  const installNewDir = INSTALL_DIR + '.new';
  const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
  // Finding F: 'missing' is more truthful than 'unknown' when the install dir doesn't exist.
  const backupTag = installVersion || (fs.existsSync(INSTALL_DIR) ? 'unknown' : 'missing');
  const backupDir = path.join(PLUGIN_HOME, `mindrian-os.stale-${backupTag}-${ts}`);

  // Phase 1: prepare install.new (cleanup any stale install.new from a prior failed run -- recover-the-recoverer logic)
  try {
    if (fs.existsSync(installNewDir)) fs.rmSync(installNewDir, { recursive: true, force: true });
  } catch (err) {
    return { status: 'error', detail: `failed to clean prior install.new: ${err.message}`, stage: 'cleanup-installnew' };
  }

  // Finding E: hermetic test injection point.
  if (process.env.MOS_TEST_FORCE_FAIL === 'copy') {
    return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=copy injection', stage: 'cp', installNewDir };
  }

  // Phase 2: cp via fs.cpSync (Finding A; replaces the prior shell-out copy -- Windows-functional, no exec)
  try {
    fs.cpSync(sourceDir, installNewDir, { recursive: true, dereference: false, preserveTimestamps: true });
  } catch (err) {
    // install untouched; install.new may be incomplete -- leave for inspection.
    return { status: 'error', detail: `cp failed: ${err.message}`, stage: 'cp', installNewDir };
  }

  // Phase 3: structural version verify (D-02). Read plugin.json from install.new ONLY; do not load any plugin code.
  if (process.env.MOS_TEST_FORCE_FAIL === 'verify') {
    return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=verify injection', stage: 'verify', installNewDir };
  }
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(installNewDir, '.claude-plugin/plugin.json'), 'utf8'));
    if (pj.version !== latestCacheVersion) {
      return { status: 'error', detail: `verify failed: install.new version is ${pj.version}, expected ${latestCacheVersion}`, stage: 'verify', installNewDir };
    }
  } catch (err) {
    return { status: 'error', detail: `verify failed: ${err.message}`, stage: 'verify', installNewDir };
  }

  // Phase 4: two-step atomic-swap.
  // Phase 4a: mv install -> install.stale-X (only if install exists). Finding D safeRename for cross-fs.
  let backedUp = false;
  if (fs.existsSync(INSTALL_DIR)) {
    if (process.env.MOS_TEST_FORCE_FAIL === 'rename-old') {
      return { status: 'error', detail: 'MOS_TEST_FORCE_FAIL=rename-old injection', stage: 'backup-mv', installNewDir };
    }
    try {
      safeRename(INSTALL_DIR, backupDir);
      backedUp = true;
    } catch (err) {
      // install untouched (rename didn't complete); install.new left for inspection.
      return { status: 'error', detail: `backup mv failed: ${err.message}`, stage: 'backup-mv', installNewDir };
    }
  }

  // Phase 4b: mv install.new -> install. The atomic moment.
  if (process.env.MOS_TEST_FORCE_FAIL === 'commit') {
    // Simulate post-backup commit failure -> trigger D-03 rollback path.
    if (backedUp) {
      try { safeRename(backupDir, INSTALL_DIR); } catch (_) { /* double failure; user must recover manually */ }
    }
    return { status: 'error', detail: 'recovery failed -- live install restored from backup; investigate manually', stage: 'commit-rollback', exitCode: 4 };
  }
  try {
    safeRename(installNewDir, INSTALL_DIR);
  } catch (err) {
    // D-03 rollback: restore from backup so live install is recovered to pre-recovery state.
    if (backedUp) {
      try { safeRename(backupDir, INSTALL_DIR); }
      catch (_) { /* double failure; backup remains on disk for manual recovery */ }
    }
    return { status: 'error', detail: `recovery failed -- live install restored from backup; investigate manually (root: ${err.message})`, stage: 'commit-rollback', exitCode: 4 };
  }

  // Phase 5: post-swap verification (cheap re-check; should-never-fail given Phase 3 already passed).
  const after = checkInstallVersion();
  if (after.status !== 'ok' || after.version !== latestCacheVersion) {
    return { status: 'error', detail: `post-swap verify mismatch: install version is ${after.version || 'unknown'}, expected ${latestCacheVersion}`, backup: backedUp ? backupDir : null };
  }
  return { status: 'ok', backup: backedUp ? backupDir : null, recoveredVersion: latestCacheVersion };
}

// Finding D: rename(2) is atomic on the same filesystem; cpSync+rmSync fallback for EXDEV.
function safeRename(src, dst) {
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      // Cross-filesystem move; copy + delete (NOT atomic, but only path that works across mounts).
      fs.cpSync(src, dst, { recursive: true, dereference: false, preserveTimestamps: true });
      fs.rmSync(src, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}

// readRegistry moved to lib/core/doctor/shared.cjs (Phase 217 Plan-01 D-02) and
// is imported at the top of this file. The class B/C/E section-walk helpers
// (SKIP_DIRS, listSubdirs) + the generator spawn (invokeGenerator) + findRoomRoot
// moved WITH those checks into their registry runners in Phase 217 Plan 04.

// -- Class D / G / H bodies removed (Phase 217 Plan 05) -----------------------
//
// checkSurfaceVerification (class D), checkStatuslineVisibility +
// performStatuslineFix (class G), and checkInstallIncomplete + performClassHFix
// (class H) -- plus their private helpers (STALE_STATUSLINE_PATH_REGEX,
// stripAnsi, CLASS_H_CANONICAL_STEPS, classHActionString,
// userSettingsHasStatusLine) and the INSTALL_RECEIPT_JSON const -- moved into
// lib/core/doctor/verify-surface-module.cjs, statusline-visibility-module.cjs,
// and install-incomplete-module.cjs. The accumulative engine owns their
// dispatch + fix-then-recheck flow via the registry (data/doctor-modules.json).

// -- Class I + Class J: install-state + topology + version-of-record  ---
//   + deployment-surface manifest reconciliation (Phase 123 Plan-03).
//
// Class I (HARNESS-123-07): install-state record present + internally
//   consistent; topology classification (Bug 7 fix); 6-way version-of-record
//   equality across installed_plugins.json <-> record.active_version <->
//   record.statusline_renders_version <-> record.last_version_file_value
//   <-> record.path_bin_version <-> ~/.mindrian-last-version. STRING
//   EQUALITY tolerates the 4-component non-semver 1.12.5.1 case.
//
// Class J (HARNESS-123-08): walks data/deployment-surfaces.json; per
//   surface, checks expected vs observed per check_kind (marker | exact-
//   value | observed-only); honors topology_scope='dev-clone' (skipped on
//   non-dev-clone) and reconcile='never' (excluded from auto-fix); honors
//   the schema extension `path_within_file` (added in Plan-03 to fix the
//   live-dev-box settings.json whole-file-comparison bug).
//
// Aggressive --fix (HARNESS-123-09): missing record (spawn session-start);
//   wrong ~/.mindrian-last-version (rewrite); legacy-clone migration
//   (backup-verify-remove with the dev-clone safety belt -- NEVER touches
//   a dev clone); conservative installed_plugins.json repair (back up
//   first; repoint at newest valid marketplace-cache dir; restart note);
//   flag-only for topology=='not-found' / vanished PATH-bin / wrong
//   statusline_renders_version.
//
// Class-flag invariant: when --install-state (or --all) is set, exit is
//   always 0 unless an explicit --fix attempt failed.
//
// Canon Part 8: all of class I + class J is LOCAL-only. Zero fetch / http /
//   curl / brain.mindrian / tavily in any of these functions.
//
// Phase 217 Plan 06: the class I helpers + checkInstallState + performClassIFix
// moved to lib/core/doctor/install-state-module.cjs; the class J helpers +
// checkDeploymentSurfaces + performClassJFix moved to
// lib/core/doctor/deployment-surfaces-module.cjs; the shared readers
// (readLegacyConfigPin, detectMarketplaceCacheInstall, collectVersionOfRecord,
// computeVersionDivergences, ...) moved to lib/core/doctor/shared.cjs. Both are
// now registry-driven cadence:always runners under the --install-state flag
// (install-state before deployment-surfaces so class J reads class I's
// same-invocation result via ctx.checks). doctor.cjs imports only the runners'
// RAW check entries (checkInstallState / checkDeploymentSurfaces, bound near the
// shared.cjs require) for the --acceptance path.


// -- Acceptance: release-gate-as-a-command (Phase 123 Plan-04) -------
//
// `mindrian-os doctor --acceptance` runs a 7-point checklist that asserts the
// release is consistent end-to-end. `--pre-tag` filters to the 5 points true
// BEFORE the tag + npm publish lands. Both are HARD ABORTS -- no --allow
// override (per CONTEXT D-16: release infra is the one gate you cannot skip).
//
// THIS BLOCK IS NOT A CLASS FLAG. It has its own exit-code contract:
//   0 = all (filtered) points passed
//   1 = any point failed
// The class-flag-always-exit-0 graceful-degradation invariant does NOT apply.
//
// Canon Part 8 (LOCAL-only invariant): the npx-roundtrip + version-of-record-
// published points are the ONE network touch in this phase. They run ONLY
// during a release (when release.sh invokes --acceptance after the push).
// --pre-tag has ZERO network -- it stays Part-8 clean for in-session use.
//
// Test-mode env hooks (honored only when DOCTOR_TEST_MODE=1):
//   DOCTOR_TEST_STUB_POST_PUBLISH=1     post-publish points throw if invoked
//                                       (asserts the --pre-tag filter works)
//   DOCTOR_TEST_FAIL_POINT=<point_id>   synthesize a failure of the named point
//   DOCTOR_VERIFY_RELEASE_PATH=<path>   override scripts/verify-release path

function buildAcceptanceChecklist(ctx) {
  const home = ctx.home;
  const pluginRoot = ctx.pluginRoot;
  const flagLightNpx = ctx.flagLightNpx;
  const inTestMode = process.env.DOCTOR_TEST_MODE === '1';
  return [
    {
      id: 'install-state',
      label: 'install-state record present + snapshot matches a live spot-check',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'install-state') {
          return { ok: false, finding: 'install-state synthesized failure (test mode)', detail: {} };
        }
        const c = checkInstallState({ home: home });
        // status: 'healthy' | 'warn' | 'error'. We allow 'healthy' through; anything
        // else fails the gate. (Findings drive the finding string for the operator.)
        const ok = c.status === 'healthy';
        let finding = null;
        if (!ok) {
          if (Array.isArray(c.findings) && c.findings.length) {
            finding = c.findings[0].finding || c.findings[0].id || ('install-state status: ' + c.status);
          } else {
            finding = 'install-state status: ' + c.status;
          }
        }
        return { ok: ok, finding: finding, detail: { status: c.status, findings: c.findings, topology: c.topology } };
      },
    },
    {
      id: 'deployment-surfaces',
      label: 'every owned deployment surface reconciled',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'deployment-surfaces') {
          return { ok: false, finding: 'deployment-surfaces synthesized failure (test mode)', detail: {} };
        }
        // Reuse install-state for the topology + active root/version handles.
        const s = checkInstallState({ home: home });
        const activeRoot = (s.record && s.record.active_root)
          || (s.resolver && s.resolver.root)
          || null;
        const activeVersion = (s.record && s.record.active_version)
          || (function () { try { return readInstalledPluginsVersion(home); } catch (_) { return null; } })();
        const c = checkDeploymentSurfaces({
          home: home,
          topology: s.topology || 'not-found',
          activeRoot: activeRoot,
          activeVersion: activeVersion,
        });
        const ok = c.status === 'healthy' || c.status === 'skipped';
        const failedSurfaces = Array.isArray(c.surfaces)
          ? c.surfaces.filter(function (x) { return x.ok === false; })
          : [];
        const finding = ok ? null : (failedSurfaces.length + ' surface(s) drifted');
        return { ok: ok, finding: finding, detail: { status: c.status, surfaces: c.surfaces } };
      },
    },
    {
      id: 'version-of-record-repo',
      label: 'plugin.json / package.json / CHANGELOG top entry consistent (repo-file half of 5-way)',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'version-of-record-repo') {
          return { ok: false, finding: 'version-of-record-repo synthesized failure (test mode)', detail: {} };
        }
        try {
          const pjPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
          const pkPath = path.join(pluginRoot, 'package.json');
          const chPath = path.join(pluginRoot, 'CHANGELOG.md');
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          const pk = JSON.parse(fs.readFileSync(pkPath, 'utf8'));
          const ch = fs.readFileSync(chPath, 'utf8');
          const chMatch = ch.match(/^## \[([^\]]+)\]/m);
          const chTop = chMatch ? chMatch[1] : null;
          const pjVer = pj.version;
          const pkVer = pk.version;
          // Accept "Unreleased" CHANGELOG heading (work in progress); the
          // sub-check passes if pj==pk AND CHANGELOG either matches OR is
          // an [Unreleased] heading naming the same version in its body
          // (the release.sh Step 6 finalizes [Unreleased] -> [vN] before
          // Step 6.6 calls us, so by then chTop is the version).
          const allMatch = pjVer === pkVer && (pjVer === chTop || chTop === 'Unreleased');
          const finding = allMatch ? null : ('version mismatch: plugin.json=' + pjVer + ', package.json=' + pkVer + ', CHANGELOG top=' + chTop);
          return { ok: !!allMatch, finding: finding, detail: { pluginJson: pjVer, packageJson: pkVer, changelogTop: chTop } };
        } catch (e) {
          return { ok: false, finding: 'version-of-record-repo read failed: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'verify-release',
      label: 'scripts/verify-release passes',
      severity: 'blocker',
      // PRE-TAG ONLY. Excluded from 'full' (post-publish) on purpose:
      // release.sh Step 7.5 (Commit B) bumps the working tree to the next dev
      // pre-release (beta.N+1) while the marketplace correctly stays at the
      // published beta.N. scripts/verify-release Check 3 is a STRICT
      // plugin==marketplace equality, so under 'full' it would compare
      // beta.N+1 vs beta.N and false-fail (the Step 9.8 false abort, RCA
      // 260605-h3p). Post-publish version state is OWNED by the
      // 'version-of-record-published' module below (tag + marketplace
      // source.ref + npm view, keyed off the LAST SHIPPED tag, not the dev
      // placeholder). scripts/verify-release stays the strict PRE-tag gate
      // (release.sh Step 2 standalone + the --pre-tag acceptance tier).
      // Precedent: the 'verify-release-clean-tree' sibling was tier-moved
      // from ['pre-tag','full'] to ['full'] for the mirror-image reason
      // (see tests/test-doctor-acceptance-preflight-checks.cjs:233).
      applies_to: ['pre-tag'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'verify-release') {
          return { ok: false, finding: 'verify-release synthesized failure (test mode)', detail: {} };
        }
        // Override path only honored in test mode (the test harness sets a logging shim).
        const verifyPath = (inTestMode && process.env.DOCTOR_VERIFY_RELEASE_PATH)
          ? process.env.DOCTOR_VERIFY_RELEASE_PATH
          : path.join(pluginRoot, 'scripts', 'verify-release');
        const cp = require('child_process');
        const r = cp.spawnSync('bash', [verifyPath], { encoding: 'utf8', timeout: 60000 });
        const ok = r.status === 0;
        const finding = ok ? null : ('verify-release exited ' + r.status);
        return { ok: ok, finding: finding, detail: { status: r.status, stdoutTail: (r.stdout || '').slice(-500), stderrTail: (r.stderr || '').slice(-500) } };
      },
    },
    {
      id: 'version-of-record-published',
      label: 'git tag exists + marketplace source.ref pinned + npm view returns the version',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_STUB_POST_PUBLISH === '1') {
          throw new Error('post-publish stub invoked under --pre-tag -- bug in runner');
        }
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'version-of-record-published') {
          return { ok: false, finding: 'version-of-record-published synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          // Phase 127.2 Plan 02 Finding B: resolve "version of record" via
          // last shipped git tag, NOT plugin.json. release.sh Commit B
          // bumps main HEAD to the next pre-release placeholder (e.g.
          // beta.27 after beta.26 ships), which by definition has no tag
          // yet. The gate must verify the LAST SHIPPED version is live
          // across all three records (tag + marketplace ref + npm), not
          // the placeholder.
          const tagProbe = cp.spawnSync('git', ['-C', pluginRoot, 'describe', '--tags', '--abbrev=0', '--match=v*'], { encoding: 'utf8' });
          let ver;
          if (tagProbe.status === 0 && tagProbe.stdout && tagProbe.stdout.trim()) {
            ver = tagProbe.stdout.trim().replace(/^v/, '');
          } else {
            // Fresh repo edge case (no tags yet): fall back to plugin.json.
            const pj = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
            ver = pj.version;
          }
          // (a) git tag exists, reachable from origin/main.
          const t = cp.spawnSync('git', ['-C', pluginRoot, 'rev-parse', '--verify', 'refs/tags/v' + ver], { encoding: 'utf8' });
          if (t.status !== 0) return { ok: false, finding: 'git tag v' + ver + ' not found', detail: { stderr: (t.stderr || '').slice(-200) } };
          // (b) marketplace source.ref pinned to v<ver>.
          const mpPath = path.join(home, 'mindrian-marketplace', '.claude-plugin', 'marketplace.json');
          let mp;
          try { mp = JSON.parse(fs.readFileSync(mpPath, 'utf8')); }
          catch (e) { return { ok: false, finding: 'marketplace.json unreadable: ' + e.message, detail: { mpPath: mpPath } }; }
          const ref = mp.plugins && mp.plugins[0] && mp.plugins[0].source && mp.plugins[0].source.ref;
          if (ref !== 'v' + ver) return { ok: false, finding: 'marketplace source.ref is ' + ref + ', expected v' + ver, detail: { ref: ref, expected: 'v' + ver } };
          // (c) npm view -- THIS IS THE ONE NETWORK CALL in this point.
          const n = cp.spawnSync('npm', ['view', '@mindrian_os/cli@' + ver, 'version'], { encoding: 'utf8', timeout: 30000 });
          if (n.status !== 0) return { ok: false, finding: 'npm view failed: ' + (n.stderr || '').slice(-200), detail: { status: n.status } };
          const npmVer = (n.stdout || '').trim();
          const ok = npmVer === ver;
          return { ok: ok, finding: ok ? null : ('npm view returned ' + npmVer + ', expected ' + ver), detail: { npmVer: npmVer, expectedVer: ver } };
        } catch (e) {
          return { ok: false, finding: 'version-of-record-published threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'npx-roundtrip',
      label: 'npx @mindrian_os/cli round-trip resolves cleanly',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_STUB_POST_PUBLISH === '1') {
          throw new Error('post-publish stub invoked under --pre-tag -- bug in runner');
        }
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'npx-roundtrip') {
          return { ok: false, finding: 'npx-roundtrip synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        // Phase 127.2 Plan 02 Finding B (mirrored): resolve target version
        // via last shipped tag, not plugin.json placeholder. Same logic as
        // version-of-record-published.
        const tagProbe = cp.spawnSync('git', ['-C', pluginRoot, 'describe', '--tags', '--abbrev=0', '--match=v*'], { encoding: 'utf8' });
        let ver;
        if (tagProbe.status === 0 && tagProbe.stdout && tagProbe.stdout.trim()) {
          ver = tagProbe.stdout.trim().replace(/^v/, '');
        } else {
          const pj = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
          ver = pj.version;
        }
        // RCA fix (release-step-9.7-npx-self-test-false-alarm, recommendation A,
        // 2026-06-02): assert the published package INSTALLS + its bin is present
        // and parseable, NOT the PATH-sensitive npx-by-name runtime exit. The
        // launcher shells out to claude/git absent in the bare sandbox, and npm
        // 10.9.7 npx-by-name does not reliably link the package bin -- so a
        // perfectly healthy publish exits non-zero for an environment reason
        // (the false alarm that blocked every cut since beta.37). `npm install`
        // is the path that actually works; bin presence + `node --check` + the
        // .bin symlink is the true publishable+installable signal.
        const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-acceptance-'));
        try {
          const env = Object.assign({}, process.env, {
            HOME: sandbox,
            USERPROFILE: sandbox,
            npm_config_cache: path.join(sandbox, '.npm'),
          });
          if (flagLightNpx) {
            // Light path: metadata-only -- assert the published bin is declared. No install.
            const v = cp.spawnSync('npm', ['view', '@mindrian_os/cli@' + ver, 'bin.mindrian-os'], { encoding: 'utf8', env: env, timeout: 30000 });
            const declared = (v.stdout || '').trim();
            const ok = v.status === 0 && declared.length > 0;
            return { ok: ok, finding: ok ? null : ('npm view bin.mindrian-os empty/failed (' + v.status + ')'), detail: { declared: declared, status: v.status } };
          }
          cp.spawnSync('npm', ['init', '-y'], { cwd: sandbox, env: env, encoding: 'utf8', timeout: 30000 });
          const inst = cp.spawnSync('npm', ['install', '--prefer-online', '@mindrian_os/cli@' + ver], { cwd: sandbox, env: env, encoding: 'utf8', timeout: 120000 });
          if (inst.status !== 0) {
            return { ok: false, finding: ('npm install @mindrian_os/cli@' + ver + ' failed (' + inst.status + ')'), detail: { status: inst.status, stderrTail: (inst.stderr || '').slice(-300) } };
          }
          const binFile = path.join(sandbox, 'node_modules', '@mindrian_os', 'cli', 'bin', 'cli.js');
          const binLink = path.join(sandbox, 'node_modules', '.bin', 'mindrian-os');
          const present = fs.existsSync(binFile);
          const parses = present && cp.spawnSync(process.execPath, ['--check', binFile], { encoding: 'utf8' }).status === 0;
          const linked = fs.existsSync(binLink);
          const ok = present && parses && linked;
          return {
            ok: ok,
            finding: ok ? null : ('published package install verification failed (present=' + present + ' parses=' + parses + ' linked=' + linked + ')'),
            detail: { present: present, parses: parses, linked: linked },
          };
        } finally {
          try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
        }
      },
    },
    {
      id: 'doctor-all',
      label: 'doctor --all exits 0',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'doctor-all') {
          return { ok: false, finding: 'doctor-all synthesized failure (test mode)', detail: {} };
        }
        // Spawn ourselves with --all (NOT --acceptance, to avoid recursion).
        // Scrub DOCTOR_TEST_FAIL_POINT so a top-level test fail-point env var
        // doesn't propagate into our self-spawn and re-trigger the synthesis
        // there (the synthesis above already covers this point).
        const cp = require('child_process');
        const childEnv = Object.assign({}, process.env, { DOCTOR_TEST_FAIL_POINT: '' });
        const r = cp.spawnSync('node', [path.join(pluginRoot, 'scripts', 'doctor.cjs'), '--all', '--json'], { encoding: 'utf8', timeout: 60000, env: childEnv });
        let j = null;
        try {
          if (r.stdout) {
            const start = r.stdout.indexOf('{');
            if (start !== -1) j = JSON.parse(r.stdout.slice(start));
          }
        } catch (_) { /* leave null */ }
        const driftCount = j && j.summary && typeof j.summary.drift === 'number' ? j.summary.drift : 0;
        const ok = r.status === 0 && driftCount === 0;
        let finding = null;
        if (r.status !== 0) finding = 'doctor --all exited ' + r.status;
        else if (driftCount > 0) finding = 'doctor --all reports ' + driftCount + ' drift item(s)';
        return { ok: ok, finding: finding, detail: { exit: r.status, summary: j && j.summary } };
      },
    },
    {
      // Phase 172-13 (Canon Part 11 R2/R9/INV-10 step 3): the born-wired coverage
      // gate as a release acceptance point. Runs BOTH --check gates -- the
      // connector registry (a surface neither WIRED nor EXCLUDED is a hard fail)
      // and the orchestration projection (a bare command counterpart neither
      // ranked nor excluded is a hard fail). A release with an accidental-dark
      // surface aborts here. Canon Part 8: both --check gates regenerate in
      // memory from LOCAL sources; zero Brain / network.
      id: 'coverage-gate',
      label: 'connector + orchestration-projection + framework-vocabulary + render-coverage + skill-mirrors gates pass (no dark surface); shape-declaration advisory as of Phase 210 (WARNs inline, never blocks)',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'coverage-gate') {
          return { ok: false, finding: 'coverage-gate synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        const gates = [
          { id: 'connector', script: 'build-connector-registry.cjs' },
          { id: 'projection', script: 'build-orchestration-projection.cjs' },
          // Phase 254 Plan 03 (WIRE-04): the framework-vocabulary-drift gate rides
          // the SAME coverage-gate organ. A silent divergence between the three
          // committed framework vocabularies (KNOWN_FRAMEWORKS, the registry's
          // declared frameworks, and the projection's framework nodes) is the
          // measured root cause of the one-step-chain defect Plans 01/02 of Phase
          // 254 fix; this gate makes any FUTURE undeclared divergence a blocker
          // too. A declared entry with a stated reason never fails this gate.
          { id: 'framework-vocabulary', script: 'check-framework-vocabulary-drift.cjs' },
          // Phase 178-03 (Canon Part 11 render twin, C-3): the render-coverage gate
          // rides the SAME doctor --acceptance organ as the two CIRS gates. A render
          // GAP (a reachable Decision-Gate surface not routed through the SEED-020
          // card-emission door) is a blocker here too -- HARD-FAIL, never WARN (R-5).
          { id: 'render', script: 'check-render-coverage.cjs' },
          // Quick task 260705-sy9: the skill-mirror staleness gate rides the SAME
          // coverage-gate organ (the Phase 178-03 render-gate precedent). A stale
          // skills/<name>/SKILL.md mirror ships a wrong command body to machines
          // hit by the Claude Code registration bug (260705-ob7). Blocker semantics:
          // the script exits 1 on any missing/stale mirror or a deleted/reverted
          // SKIP_LIST skill. Canon Part 8: local byte compares only.
          { id: 'skill-mirrors', script: 'build-skill-mirrors.cjs' },
          // Phase 190-04 (SFD-04/SFD-05, Canon Part 11 R16), softened by Phase 210
          // (item 210-A, navigator decision, CONTEXT addendum 1): the born-declared-shape
          // gate is ADVISORY. The script's --check exits 0 by default even on a
          // violating tree (its WARN lines enumerate every violation in stderrTail),
          // so the r.status === 0 ok test below no longer blocks on shape-declaration
          // drift; --strict on the script restores the pre-210 hard-fail if a future
          // phase re-hardens. The other three gates above KEEP blocker semantics.
          // The gate still enumerates the tree at run time; no hardcoded count.
          { id: 'shape-declaration', script: 'check-shape-declaration.cjs' },
        ];
        const results = [];
        for (const g of gates) {
          const scriptPath = path.join(pluginRoot, 'scripts', g.script);
          if (!fs.existsSync(scriptPath)) {
            results.push({ id: g.id, ok: false, status: null, note: 'script missing: ' + g.script });
            continue;
          }
          const r = cp.spawnSync('node', [scriptPath, '--check'], { encoding: 'utf8', timeout: 60000 });
          results.push({
            id: g.id,
            ok: r.status === 0,
            status: r.status,
            stderrTail: (r.stderr || '').slice(-400),
          });
        }
        const failed = results.filter(function (x) { return !x.ok; });
        const ok = failed.length === 0;
        const finding = ok ? null : (failed.map(function (x) { return x.id + ' gate exited ' + x.status; }).join('; '));
        return { ok: ok, finding: finding, detail: { gates: results } };
      },
    },
    // -- Phase 126 Plan 05: 5 release-flight pre-flight hot-patches --
    //
    // Phase 123's release cut (v1.13.0-beta.13) surfaced 5 hot-patches during
    // Plan-06 pre-flight. The operator applied them MANUALLY before tagging
    // the release. That tribal knowledge is release risk; Plan 05 absorbs each
    // hot-patch as a checklist entry so the gate enforces them automatically.
    // All 5 are pre-tag-applicable (they verify pre-release state). Each
    // honors the DOCTOR_TEST_FAIL_POINT injection (mirrors the established
    // pattern from Phase 123). Canon Part 6 (dog-fooding): each manually-
    // applied operator check is promoted to a structured gate.
    {
      id: 'session-start-active-version',
      label: 'session-start derives active_version correctly from installed_plugins.json',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'session-start-active-version') {
          return { ok: false, finding: 'session-start-active-version synthesized failure (test mode)', detail: {} };
        }
        try {
          // Read installed_plugins.json + extract the mos@mindrian-marketplace
          // active version. Mirror the same name/structure scan as session-start
          // lines 178-186 (accept both "mos" and "mindrian-os" prefixes).
          const ipPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
          if (!fs.existsSync(ipPath)) {
            return { ok: false, finding: 'installed_plugins.json absent', detail: { ipPath: ipPath } };
          }
          const ip = JSON.parse(fs.readFileSync(ipPath, 'utf8'));
          const plugins = (ip && ip.plugins) || {};
          let recordedVersion = null;
          for (const k of Object.keys(plugins)) {
            const name = String(k).split('@')[0];
            if (name !== 'mos' && name !== 'mindrian-os') continue;
            let entry = plugins[k];
            if (Array.isArray(entry)) entry = entry[0];
            if (entry && entry.version) { recordedVersion = entry.version; break; }
          }
          if (!recordedVersion) {
            return { ok: false, finding: 'no mos@mindrian-marketplace entry in installed_plugins.json', detail: {} };
          }
          // Resolve the active plugin root and compare its plugin.json version
          // to the recorded installed_plugins.json version. session-start's
          // line-202 derivation uses resolver-root-basename first, then this
          // value -- a mismatch means the two derivation paths disagree.
          const r = resolveActivePluginRoot({});
          if (!r || !r.root) {
            return { ok: false, finding: 'active plugin root unresolvable', detail: { source: r && r.source } };
          }
          const pjPath = path.join(r.root, '.claude-plugin', 'plugin.json');
          if (!fs.existsSync(pjPath)) {
            return { ok: false, finding: 'plugin.json missing in active root', detail: { pjPath: pjPath } };
          }
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          const ok = pj.version === recordedVersion;
          return {
            ok: ok,
            finding: ok ? null : ('plugin.json says ' + pj.version + ' but installed_plugins.json says ' + recordedVersion),
            detail: { pluginJson: pj.version, recordedVersion: recordedVersion, activeRoot: r.root, topology: r.topology },
          };
        } catch (e) {
          return { ok: false, finding: 'session-start-active-version threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'verify-release-clean-tree',
      label: 'verify-release Step 12 reports clean git tree (tracked files only)',
      severity: 'blocker',
      // Phase 126 Plan 05 absorbed this check from the Phase 123 cut pre-flight.
      // The 2026-05-14 beta.16 cut attempt surfaced that --pre-tag is the wrong
      // mode: release.sh Step 6.6 runs --pre-tag AFTER Steps 3-6 intentionally
      // bump package.json + plugin.json + CHANGELOG (3 expected tracked-file
      // mods), and this strict clean-tree check trips on them. The check is a
      // PRE-FLIGHT meant to run OUT-OF-BAND with release.sh (operator runs it
      // manually before kicking off the cut, OR release.sh runs it BEFORE
      // Step 3 -- which would be a release.sh refactor). For now: drop from
      // 'pre-tag', keep in 'full' (post-tag, everything should be committed).
      // Operators can still invoke doctor --acceptance manually pre-flight by
      // running it without --pre-tag (which runs the 'full' suite).
      //
      // Phase 126.1 hotfix (2026-05-15): added 'pre-flight' tier. release.sh
      // Step 2.5 calls --pre-flight BEFORE Step 3 mutates the tree, so this
      // check runs on a clean working tree before the cut starts bumping.
      // 'pre-tag' stays excluded because Step 6.6 still runs post-bump.
      applies_to: ['pre-flight', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'verify-release-clean-tree') {
          return { ok: false, finding: 'verify-release-clean-tree synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          // Mirror verify-release Step 12 line 296: --untracked-files=no so
          // untracked files are allowed; tracked-dirty is the failure mode.
          const r = cp.spawnSync('git', ['-C', pluginRoot, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', timeout: 10000 });
          if (r.status !== 0) {
            return { ok: false, finding: 'git status failed (exit ' + r.status + ')', detail: { stderr: (r.stderr || '').slice(-200) } };
          }
          const dirty = (r.stdout || '').trim();
          const ok = dirty === '';
          const dirtyCount = dirty ? dirty.split('\n').length : 0;
          return {
            ok: ok,
            finding: ok ? null : ('tracked-file drift: ' + dirtyCount + ' file(s)'),
            detail: { dirtyCount: dirtyCount, dirtyTail: dirty.slice(0, 500) },
          };
        } catch (e) {
          return { ok: false, finding: 'verify-release-clean-tree threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'frontmatter-yaml-validity',
      label: 'commands/operator.md + commands/doctor.md frontmatter YAML parses cleanly',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'frontmatter-yaml-validity') {
          return { ok: false, finding: 'frontmatter-yaml-validity synthesized failure (test mode)', detail: {} };
        }
        try {
          const targets = [
            path.join(pluginRoot, 'commands', 'operator.md'),
            path.join(pluginRoot, 'commands', 'doctor.md'),
          ];
          const failures = [];
          for (const t of targets) {
            if (!fs.existsSync(t)) { failures.push(t + ' (absent)'); continue; }
            const content = fs.readFileSync(t, 'utf8');
            // Frontmatter pattern: file starts with `---\n` and the next `---\n`
            // closes the block. We do not require a leading BOM.
            const m = content.match(/^---\n([\s\S]*?)\n---\n/);
            if (!m) { failures.push(t + ' (no YAML frontmatter)'); continue; }
            const yaml = m[1];
            const lines = yaml.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const ln = lines[i];
              if (ln.trim() === '') continue;
              if (ln.indexOf('\t') !== -1) { failures.push(t + ' line ' + (i + 1) + ' contains tab'); break; }
              // Allowed shapes: `<key>: <value>`, ` <key>: <value>` (nested),
              // `- <item>` (list item), `# comment`. Anything else is drift.
              const isKeyValue = /^[A-Za-z_][A-Za-z0-9_-]*:/.test(ln);
              const isIndented = ln.startsWith(' ');
              const isListItem = ln.startsWith('-');
              const isComment = ln.startsWith('#');
              if (!isKeyValue && !isIndented && !isListItem && !isComment) {
                failures.push(t + ' line ' + (i + 1) + ' not key:value');
                break;
              }
            }
          }
          const ok = failures.length === 0;
          return {
            ok: ok,
            finding: ok ? null : ('YAML drift: ' + failures.join('; ')),
            detail: { failures: failures },
          };
        } catch (e) {
          return { ok: false, finding: 'frontmatter-yaml-validity threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'release-dry-run-output',
      label: 'release.sh --dry-run produces all expected step names',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'release-dry-run-output') {
          return { ok: false, finding: 'release-dry-run-output synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          // Pass an explicit bump mode ('patch') so this self-test is robust to
          // the CURRENT version state. A bare '--dry-run' defaults to --prerelease
          // only when the current version carries a '-beta.N' suffix; during a
          // --finalize run this self-test executes AFTER Step 3 has bumped the
          // version to a clean X.Y.Z, where release.sh correctly requires an
          // explicit mode and a bare dry-run exits 1 (the finalize-path self-test
          // bug, fixed 2026-06-02). 'patch' is valid on both clean and suffixed
          // versions and emits the same mode-independent step names this check asserts.
          const r = cp.spawnSync('bash', [path.join(pluginRoot, 'scripts', 'release.sh'), 'patch', '--dry-run'], { encoding: 'utf8', timeout: 30000 });
          if (r.status !== 0) {
            return { ok: false, finding: 'release.sh --dry-run exited ' + r.status, detail: { stderr: (r.stderr || '').slice(-200) } };
          }
          const out = r.stdout || '';
          // NOTE: Plan 04 (Phase 126 Wave 3) patched this list to add Step 5.5
          // / 9.7 / 9.8 and to reorder Step 9.6 -> 9.8 for the rename. The new
          // Step 9.6 is the install-minisite HARD lockstep; Step 9.7 is the
          // npx-publish self-test; Step 9.8 is the post-publish full
          // --acceptance gate (was Step 9.6 in Wave 2's scaffold). If you edit
          // this list, make sure release.sh --dry-run output still matches in
          // order. Phase 126.1 hotfix (2026-05-15) added Step 2.5 (the new
          // --pre-flight clean-tree gate that runs BEFORE Step 3 mutates).
          const expectedSteps = ['Step 2', 'Step 2.5', 'Step 3', 'Step 4', 'Step 5', 'Step 5b', 'Step 5.5', 'Step 6', 'Step 6.5', 'Step 6.6', 'Step 7', 'Step 9.5', 'Step 9.6', 'Step 9.7', 'Step 9.8'];
          const missing = expectedSteps.filter(function (s) { return out.indexOf(s) === -1; });
          const ok = missing.length === 0;
          return {
            ok: ok,
            finding: ok ? null : ('missing step names: ' + missing.join(', ')),
            detail: { missing: missing, expectedCount: expectedSteps.length },
          };
        } catch (e) {
          return { ok: false, finding: 'release-dry-run-output threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      id: 'working-tree-housekeeping',
      label: 'no orphan .tmp/.bak/.swp files in tracked directories',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'working-tree-housekeeping') {
          return { ok: false, finding: 'working-tree-housekeeping synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          const r = cp.spawnSync('git', ['-C', pluginRoot, 'ls-files'], { encoding: 'utf8', timeout: 10000 });
          if (r.status !== 0) {
            return { ok: false, finding: 'git ls-files failed (exit ' + r.status + ')', detail: { stderr: (r.stderr || '').slice(-200) } };
          }
          const tracked = (r.stdout || '').split('\n').filter(Boolean);
          const orphans = tracked.filter(function (p) { return /\.(tmp|bak|swp|swo)$/.test(p); });
          const ok = orphans.length === 0;
          const orphanSample = orphans.slice(0, 5).join(', ') + (orphans.length > 5 ? ' (+' + (orphans.length - 5) + ' more)' : '');
          return {
            ok: ok,
            finding: ok ? null : ('orphan tracked tmp/bak files: ' + orphanSample),
            detail: { orphanCount: orphans.length, orphans: orphans.slice(0, 20) },
          };
        } catch (e) {
          return { ok: false, finding: 'working-tree-housekeeping threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // Phase 127.2 Plan 04 Instance #7 -- Class N acceptance point:
      // "activation reached the wire."
      //
      // Asserts that the live MCP server's version matches the
      // package.json version-of-record. Catches the silent-activation gap
      // where /mos:update lands bytes in cache + the active install is not
      // swapped, so the user thinks they are on beta.N+1 while every Brain
      // probe quietly hits beta.N. Before Class N, this defect could ship
      // a beta where the published bytes never activate on testers'
      // machines -- breaking the entire dog-fooding feedback loop because
      // tester "I tested beta.N" reports were filed against the previous
      // beta.
      //
      // applies_to: ['full'] only. The wire probe requires a live MCP
      // server reachable + the published version on npm/marketplace; this
      // is FALSE before tag + publish, so the pre-tag and pre-flight modes
      // skip this point. Step 9.8 of release.sh runs the full --acceptance
      // gate AFTER publish, which is where this point gates.
      id: 'activation-reached-the-wire',
      label: 'L4 MCP server version matches package.json version-of-record',
      severity: 'blocker',
      applies_to: ['full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'activation-reached-the-wire') {
          return { ok: false, finding: 'activation-reached-the-wire synthesized failure (test mode)', detail: {} };
        }
        // Defensive: opt-out for hermetic CI / offline mode. release.sh
        // Step 9.8 runs against a live network; CI smoke tests can set
        // DOCTOR_SKIP_ACTIVATION_GATE=1 to mark this point ok-as-skipped.
        if (process.env.DOCTOR_SKIP_ACTIVATION_GATE === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_ACTIVATION_GATE=1' } };
        }
        const cp = require('child_process');
        try {
          // 1. Read version-of-record (package.json) from pluginRoot.
          const pkPath = path.join(pluginRoot, 'package.json');
          if (!fs.existsSync(pkPath)) {
            return { ok: false, finding: 'package.json not found at ' + pkPath, detail: {} };
          }
          const recordVersion = JSON.parse(fs.readFileSync(pkPath, 'utf8')).version;
          if (!recordVersion) {
            return { ok: false, finding: 'package.json contains no version field', detail: {} };
          }
          // 2. Spawn doctor --brain-smoke --json against ourselves to probe
          //    the live MCP server. Reuses the Phase 127-02 Class M smoke
          //    test (6-layer probe at lib/core/doctor/class-m-brain-smoke.cjs).
          const doctorPath = path.join(__dirname, 'doctor.cjs');
          const r = cp.spawnSync('node', [doctorPath, '--brain-smoke', '--json'], {
            encoding: 'utf8', timeout: 30000,
          });
          if (!r || typeof r.stdout !== 'string') {
            return { ok: false, finding: 'brain-smoke spawn produced no stdout', detail: { stderr: (r && r.stderr || '').slice(-200) } };
          }
          let payload = null;
          try { payload = JSON.parse(r.stdout); }
          catch (_) { return { ok: false, finding: 'brain-smoke stdout not parseable as JSON', detail: { stdoutTail: r.stdout.slice(-200) } }; }
          if (!payload || !Array.isArray(payload.layers)) {
            return { ok: false, finding: 'brain-smoke payload missing layers array', detail: { payloadKeys: payload ? Object.keys(payload) : [] } };
          }
          const L4 = payload.layers.find(function (l) { return l && (l.id === 'mcp_stdio_handshake' || l.name === 'L4 MCP stdio handshake'); });
          if (!L4) {
            return { ok: false, finding: 'L4 mcp_stdio_handshake layer absent', detail: { layerIds: payload.layers.map(function (l) { return l && l.id; }) } };
          }
          if (!L4.ok) {
            return { ok: false, finding: 'L4 mcp_stdio_handshake did not succeed: ' + (L4.reason || 'unknown'), detail: { L4: L4 } };
          }
          // 3. Parse server=mindrian-brain vX.Y.Z[-PR] from L4 reason.
          const match = String(L4.reason || '').match(/server=mindrian-brain v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
          if (!match) {
            return { ok: false, finding: 'L4 reason missing server-version pattern: ' + L4.reason, detail: { L4: L4 } };
          }
          const wireVersion = match[1];
          // 4. Compare. Match = pass, drift = activation-gap.
          const ok = wireVersion === recordVersion;
          const finding = ok ? null : ('activation gap detected: live install serves v' + wireVersion + ' but version-of-record is v' + recordVersion);
          // 5. Store-identity guard (quick task 260819-c9b, WS-E1). Reuses
          //    the SAME payload already parsed above -- no second spawn.
          //    Two things wire-lock a release here: the store_identity
          //    layer must not silently disappear from the payload (absent
          //    is a not-ok finding), and a release must never be cut while
          //    the wire is pointed at the frozen stale-replica signature
          //    (also not-ok, quoting the layer's own named reason). Any
          //    OTHER store-identity failure -- a transient count dip, an
          //    unreachable Brain -- is carried into detail as information
          //    only and does NOT flip ok: an absolute count gate would
          //    brick the release train on ordinary graph churn, the same
          //    reasoning that keeps the dual-graph gate in report-only
          //    mode (scripts/check-dual-graph-health.cjs DEFAULT_MODE).
          const storeIdentity = payload.layers.find(function (l) { return l && l.id === 'store_identity'; });
          if (!storeIdentity) {
            return {
              ok: false,
              finding: 'store_identity layer absent from brain-smoke payload',
              detail: { wireVersion: wireVersion, recordVersion: recordVersion, layerIds: payload.layers.map(function (l) { return l && l.id; }) },
            };
          }
          if (!storeIdentity.ok && /stale_replica_signature/.test(String(storeIdentity.reason || ''))) {
            return {
              ok: false,
              finding: 'release is being cut against the stale replica: ' + storeIdentity.reason,
              detail: { wireVersion: wireVersion, recordVersion: recordVersion, storeIdentity: storeIdentity },
            };
          }
          return { ok: ok, finding: finding, detail: { wireVersion: wireVersion, recordVersion: recordVersion, storeIdentity: storeIdentity } };
        } catch (e) {
          return { ok: false, finding: 'activation-reached-the-wire threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // Phase 199-05 (AS-08) -- Class O acceptance point:
      // "AgentShield reports zero flagged findings across all 5 plugin surfaces."
      //
      // Runs the shipped 199-04 orchestrator (runAgentShieldScan) over the SAME
      // tree doctor.cjs lives in (dog-food, Canon Part 6 / AS-04) and fails the
      // release gate if any of the five non-Brain config surfaces (MCP tool
      // descriptions, hook commands, skill files, CLAUDE.md permissions,
      // package.json deps) carries an unremediated FLAGGED finding. This catches
      // a poisoned tool-description / hook / skill BEFORE the plugin ships,
      // closing the born-wired security loop for the /mos:agentshield surface.
      //
      // ok is keyed ONLY on totalFlagged === 0. An `ambiguous` verdict WARNS via
      // the finding string but does NOT trip the blocker (mirrors the
      // warn-vs-blocker distinction used elsewhere in this file). The scan opens
      // NO network wire and starts NO MCP server (Part 8): every gatherer reads
      // plugin-local files READ-ONLY.
      //
      // applies_to: ['pre-tag','full'] -- the surfaces are all repo-local and
      // present before tag, so this gates in both the pre-tag and full modes.
      // ADD-ONLY: no existing checklist entry's logic is touched.
      id: 'agentshield-all-surfaces-clean',
      label: 'Class O: AgentShield reports zero flagged findings across all 5 plugin surfaces',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'agentshield-all-surfaces-clean') {
          return { ok: false, finding: 'agentshield-all-surfaces-clean synthesized failure (test mode)', detail: {} };
        }
        try {
          const runnerPath = path.join(__dirname, '..', 'lib', 'core', 'security', 'agentshield-run.cjs');
          const { runAgentShieldScan } = require(runnerPath);
          const result = runAgentShieldScan();
          const ok = result.totalFlagged === 0;
          let finding = null;
          if (!ok) {
            const first = Array.isArray(result.findings) && result.findings.length > 0
              ? result.findings[0]
              : null;
            finding = 'AgentShield flagged ' + result.totalFlagged + ' finding(s); first: ' +
              (first
                ? (first.surface + '/' + first.id + ' (' + (first.ruleId || first.reason) + ')')
                : 'unknown');
          } else if (result.totalAmbiguous > 0) {
            // WARN-not-fail: ambiguous surfaces surface via the finding string
            // but the blocker stays green (only flagged findings fail the gate).
            finding = 'WARN: ' + result.totalAmbiguous +
              ' ambiguous finding(s) across surfaces (no flagged; blocker not tripped)';
          }
          return {
            ok: ok,
            finding: finding,
            detail: {
              totalFlagged: result.totalFlagged,
              totalAmbiguous: result.totalAmbiguous,
              surfaces: result.surfaces,
            },
          };
        } catch (e) {
          return { ok: false, finding: 'agentshield-all-surfaces-clean threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // quick(260706-13z) D14(e) -- Class S acceptance point:
      // "The local eureka embedding stack is ready (deps, vec backend, model
      // cache, graceful degrade)." Spawns doctor --eureka-smoke --json against
      // ourselves and gates on payload.ok === true with all 4 layers present.
      // The probe NEVER downloads a model (cache miss is a graceful PASS), so
      // this is safe inside a release gate on airgapped CI.
      //
      // applies_to: ['pre-tag','full'] -- the stack is entirely repo-local
      // (node_modules + local model cache), present before tag, no publish
      // needed. ADD-ONLY: no existing checklist entry's logic is touched.
      // DOCTOR_SKIP_EUREKA_SMOKE=1 is the hermetic-CI opt-out (mirrors
      // DOCTOR_SKIP_ACTIVATION_GATE) for a tree where the optional eureka deps
      // were intentionally not installed.
      id: 'eureka-smoke-stack-ready',
      label: 'Class S: local eureka embedding stack ready (deps, vec backend, model cache, graceful degrade)',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'eureka-smoke-stack-ready') {
          return { ok: false, finding: 'eureka-smoke-stack-ready synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_EUREKA_SMOKE === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_EUREKA_SMOKE=1' } };
        }
        const cp = require('child_process');
        try {
          const doctorPath = path.join(__dirname, 'doctor.cjs');
          const r = cp.spawnSync('node', [doctorPath, '--eureka-smoke', '--json'], {
            encoding: 'utf8', timeout: 30000,
          });
          if (!r || typeof r.stdout !== 'string') {
            return { ok: false, finding: 'eureka-smoke spawn produced no stdout', detail: { stderr: (r && r.stderr || '').slice(-200) } };
          }
          let payload = null;
          try { payload = JSON.parse(r.stdout); }
          catch (_) { return { ok: false, finding: 'eureka-smoke stdout not parseable as JSON', detail: { stdoutTail: r.stdout.slice(-200) } }; }
          if (!payload || !Array.isArray(payload.layers)) {
            return { ok: false, finding: 'eureka-smoke payload missing layers array', detail: { payloadKeys: payload ? Object.keys(payload) : [] } };
          }
          if (payload.layers.length !== 4) {
            return { ok: false, finding: 'eureka-smoke expected 4 layers, got ' + payload.layers.length, detail: { layerIds: payload.layers.map(function (l) { return l && l.id; }) } };
          }
          if (payload.ok !== true) {
            const firstFail = payload.layers.find(function (l) { return l && !l.ok; });
            return {
              ok: false,
              finding: 'eureka stack not ready: ' + (firstFail ? (firstFail.name + ' -- ' + firstFail.reason) : 'unknown layer'),
              detail: { layers: payload.layers },
            };
          }
          return { ok: true, finding: null, detail: { layers: payload.layers.map(function (l) { return { id: l.id, ok: l.ok }; }) } };
        } catch (e) {
          return { ok: false, finding: 'eureka-smoke-stack-ready threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // Phase 244 Plan 06 (closing ROADMAP SC1 / RESEARCH BLOCKER B-2):
      // "a presence/freshness check added to `node scripts/doctor.cjs
      // --acceptance`, so an unbuilt index is visible rather than silently
      // producing zero fires." This point calls the health module's check()
      // DIRECTLY in-process (a sqlite_master read is cheap; unlike Class S it
      // needs no separate process for model loading, so it never spawns).
      //
      // SEVERITY REASONING, stated explicitly so a future reader never assumes
      // this was careless: EVERY entry in this checklist carries severity
      // 'blocker' and --acceptance hard-aborts on any failed point. Absent is
      // the CORRECT DEFAULT state of every room today (verified live against
      // the 8.4 MB `rethinking-mindrianos` room.db, zero eureka_fts rows) --
      // failing on absent would fail every release until every registered
      // room has been rebuilt. Stale (rows pointing at nodes that no longer
      // exist) is a genuine correctness defect that produces ghost triggers,
      // so failing on stale is right. The LOGIC below, not a lowered severity,
      // is what makes this point visibility rather than a blanket gate: it
      // reports the full per-room census in `detail` on the PASSING path too
      // (absent/empty/ok all pass), and fails ONLY when a room is classified
      // index_stale.
      //
      // applies_to: ['pre-tag', 'full'] -- purely LOCAL sqlite_master reads
      // against registered rooms, present before tag, no publish needed.
      // DOCTOR_SKIP_EUREKA_FTS_HEALTH=1 is the hermetic-CI opt-out (mirrors
      // DOCTOR_SKIP_EUREKA_SMOKE) for a tree with no registered room registry.
      id: 'eureka-fts-index-visible',
      label: 'local lexical trigger index (eureka_fts) is present and not stale, per registered room',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'eureka-fts-index-visible') {
          return { ok: false, finding: 'eureka-fts-index-visible synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_EUREKA_FTS_HEALTH === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_EUREKA_FTS_HEALTH=1' } };
        }
        try {
          const ftsHealthMod = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'eureka-fts-health-module.cjs'));
          const result = ftsHealthMod.check({});
          const rooms = Array.isArray(result && result.rooms) ? result.rooms : [];
          const staleRoom = rooms.find(function (r) { return r && r.state === 'index_stale'; });
          if (staleRoom) {
            return {
              ok: false,
              finding: 'eureka_fts stale in room "' + staleRoom.room + '" ('
                + staleRoom.orphan_rows + ' orphan row(s) pointing at deleted nodes)',
              detail: { status: result.status, totals: result.totals, rooms: rooms },
            };
          }
          return {
            ok: true,
            finding: null,
            detail: { status: (result && result.status) || 'skip', totals: result && result.totals, rooms: rooms },
          };
        } catch (e) {
          return { ok: false, finding: 'eureka-fts-index-visible threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // Phase 265 Plan 01 (RADAR-01/RADAR-02): "node scripts/doctor.cjs
      // --acceptance surfaces ledger staleness through a registered doctor
      // module" (must_have truth). Calls the capability-ledger module's
      // check() DIRECTLY in-process (a single JSON read + one bounded
      // `claude --version` subprocess; no spawn of doctor.cjs itself).
      //
      // SEVERITY REASONING: unlike eureka-fts-index-visible's
      // visibility-not-gate design, this point IS a hard gate. T-265-02
      // (Repudiation: stale ledger presenting false assurance) names this
      // exact wiring as its mitigation -- "warn on unknown version, never
      // ok; wired to doctor --acceptance so it runs on the release gate
      // path." A ledger that has fallen behind the installed Claude Code
      // version by more than MINDRIAN_LEDGER_MAX_VERSION_LAG, or a version
      // the check could not read at all, must not let a release ship
      // silently -- that silent-pass is the exact rot pattern Phase 138's
      // markdown ledger died from.
      //
      // applies_to: ['pre-tag', 'full'] -- purely LOCAL (one JSON read, one
      // bounded local subprocess; Canon Part 8 zero network). Present before
      // tag, no publish needed. DOCTOR_SKIP_CAPABILITY_LEDGER=1 is the
      // hermetic-CI / offline-claude-binary opt-out, mirroring the sibling
      // DOCTOR_SKIP_* escapes above.
      id: 'capability-ledger-fresh',
      label: 'capability ledger freshness: data/capability-ledger.json tracks the installed claude --version',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'capability-ledger-fresh') {
          return { ok: false, finding: 'capability-ledger-fresh synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_CAPABILITY_LEDGER === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_CAPABILITY_LEDGER=1' } };
        }
        try {
          const ledgerMod = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'capability-ledger-module.cjs'));
          const result = ledgerMod.check({});
          if (!result || result.status !== 'ok') {
            return {
              ok: false,
              finding: 'capability-ledger-fresh: ' + (result && result.detail || 'check() returned no detail'),
              detail: { status: result && result.status },
            };
          }
          return { ok: true, finding: null, detail: { status: result.status, detail: result.detail } };
        } catch (e) {
          return { ok: false, finding: 'capability-ledger-fresh threw: ' + e.message, detail: {} };
        }
      },
    },
    {
      // Phase 265 Plan 23 (RADAR-30, R-7): surfaces the MCP surface doctor
      // organ (lib/core/doctor/mcp-surface-module.cjs) on the acceptance
      // path, mirroring the capability-ledger-fresh point immediately
      // above. Calls the organ's check() DIRECTLY in-process; the organ
      // itself owns both stdio spawns (Canon Part 8: zero network).
      //
      // SEVERITY REASONING: 'error' (a zero-tool tools/list response or a
      // wedged/crashed server) fails this gate -- that is the exact
      // 2.1.128 signal ("connected with 0 tools") this organ exists to
      // catch, and it must not ship silently. 'warn' (the measured
      // combined surface exceeds TOTAL_SURFACE_TOKEN_BUDGET) does NOT fail
      // this gate -- per the organ's own contract it is a measurement
      // warning, not a tool-count cap (the Brain's 10-15 figure does not
      // transfer to a 36-tool server; see the module's header comment).
      // The finding/detail carries the warn text either way so it is
      // visible in acceptance output without blocking a release on it.
      id: 'mcp-surface-tool-count',
      label: 'MCP surface: live per-server tool count for both servers, fails on zero tools',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'mcp-surface-tool-count') {
          return { ok: false, finding: 'mcp-surface-tool-count synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_MCP_SURFACE === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_MCP_SURFACE=1' } };
        }
        try {
          const mcpSurfaceMod = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'mcp-surface-module.cjs'));
          const result = mcpSurfaceMod.check({});
          if (!result || result.status === 'error') {
            return {
              ok: false,
              finding: 'mcp-surface-tool-count: ' + (result && result.detail || 'check() returned no detail'),
              detail: { status: result && result.status },
            };
          }
          return { ok: true, finding: null, detail: { status: result.status, detail: result.detail } };
        } catch (e) {
          return { ok: false, finding: 'mcp-surface-tool-count threw: ' + e.message, detail: {} };
        }
      },
    },
  ];
}

async function runAcceptance(opts) {
  const home = opts.home;
  const pluginRoot = opts.pluginRoot;
  const flagPreTag = opts.flagPreTag;
  const flagPreFlight = opts.flagPreFlight;
  const flagLightNpx = opts.flagLightNpx;
  const checklist = buildAcceptanceChecklist({ home: home, pluginRoot: pluginRoot, flagLightNpx: flagLightNpx });
  // Phase 126.1 hotfix (2026-05-15): tri-state mode. --pre-tag wins when both
  // --pre-tag and --pre-flight are passed; --pre-flight is the strict-subset
  // tier release.sh Step 2.5 uses BEFORE Step 3 mutates the tree.
  const mode = flagPreTag ? 'pre-tag' : (flagPreFlight ? 'pre-flight' : 'full');
  const filtered = checklist.filter(function (p) { return p.applies_to.indexOf(mode) !== -1; });
  const results = [];
  const failed = [];
  for (const p of filtered) {
    let r;
    try { r = await p.run(); }
    catch (e) { r = { ok: false, finding: 'point ' + p.id + ' threw: ' + e.message, detail: {} }; }
    results.push({ id: p.id, label: p.label, ok: !!r.ok, finding: r.finding || null, detail: r.detail || null });
    if (!r.ok) failed.push(p.id);
  }
  return {
    mode: mode,
    points: results,
    failed_points: failed,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
  };
}

// -- Loop-fires gate: --dogfood-acceptance (Phase 146 Plan 04) -------
//
// The Phase 146 milestone gate. Composes the 6 ACPT dogfood drivers (Phase 146
// Plans 01-03: ACPT-01 engine-fires, ACPT-02 websearch-hat-scoped, ACPT-03
// first-material-explore, ACPT-04 filing-cascade-surfaces, ACPT-05
// brain-derive-tier-rise; Phase 150.5-03: ACPT-06 dial-atomic-emission)
// by spawning each as a child `node <driver>` process and aggregating
// their exit codes. Modeled on runAcceptance (the checklist-point shape +
// the spawnSync child-process model from the verify-release point), but with
// its OWN exit-code contract: 0 = every ACPT hermetic leg passed; non-zero =
// a leg failed. NOT a class flag -- the class-flag-always-exit-0 invariant
// does NOT apply (per the ROADMAP mandate: exit 0 = milestone ships as "Larry
// Reaches", non-zero = the milestone is renamed).
//
// Canon Part 8: --dogfood-acceptance adds ZERO network surface in doctor
// itself -- it only spawns LOCAL node drivers. The ACPT-05 driver's LIVE
// mode_a arm self-skips when Brain is unreachable (Plan 03), so the gate is
// green on the hermetic legs WITHOUT a reachable Brain. The gate requires the
// hermetic mode_b arm, NEVER the live mode_a arm (T-146-14): a down Brain can
// never make the gate fake mode_a.
//
// Each ACPT point: { id, label, run: () -> { ok, finding, detail } } where run
// spawns `node <driver>` via child_process.spawnSync with a 120000ms timeout
// and ok = (status === 0).

const ACPT_DRIVERS = [
  { id: 'ACPT-01', file: 'test-acpt-01-engine-fires.cjs',           label: 'navigation engine fires (routing_source legacy->engine on a real fired sensor)' },
  { id: 'ACPT-02', file: 'test-acpt-02-websearch-hat-scoped.cjs',   label: 'WebSearch is hat-scoped (the external-tool affordance respects the hat boundary)' },
  { id: 'ACPT-03', file: 'test-acpt-03-first-material-explore.cjs', label: 'first material auto-explores (room non-empty by turn 2)' },
  { id: 'ACPT-04', file: 'test-acpt-04-filing-cascade-surfaces.cjs', label: 'filing surfaces a cross-relationship cascade mid-session' },
  { id: 'ACPT-05', file: 'test-acpt-05-brain-derive-tier-rise.cjs', label: 'BRAIN.md derive raises tier_mode above tier_0 (hermetic; live mode_a self-skips)' },
  { id: 'ACPT-06', file: 'test-acpt-06-dial-atomic-emission.cjs',   label: 'dial text + card contract emit atomically on the engine arm (real sensor fired from the production turn shape); legacy emits neither' },
];

async function runDogfoodAcceptance(opts) {
  opts = opts || {};
  const pluginRoot = opts.pluginRoot || PLUGIN_ROOT;
  const cp = require('child_process');
  const testsDir = path.join(pluginRoot, 'tests');

  const points = ACPT_DRIVERS.map(function (d) {
    return {
      id: d.id,
      label: d.label,
      run: function () {
        const driverPath = path.join(testsDir, d.file);
        if (!fs.existsSync(driverPath)) {
          return { ok: false, finding: 'driver missing: ' + d.file, detail: { file: d.file } };
        }
        const r = cp.spawnSync('node', [driverPath], { encoding: 'utf8', timeout: 120000 });
        const ok = r.status === 0;
        const finding = ok ? null : ('driver ' + d.file + ' exited ' + r.status + (r.signal ? ' (signal ' + r.signal + ')' : ''));
        return {
          ok: ok,
          finding: finding,
          detail: {
            file: d.file,
            status: r.status,
            signal: r.signal || null,
            stdoutTail: (r.stdout || '').slice(-500),
            stderrTail: (r.stderr || '').slice(-500),
          },
        };
      },
    };
  });

  const results = [];
  const failed = [];
  for (const p of points) {
    let r;
    try { r = p.run(); }
    catch (e) { r = { ok: false, finding: 'point ' + p.id + ' threw: ' + e.message, detail: {} }; }
    results.push({ id: p.id, label: p.label, ok: !!r.ok, finding: r.finding || null, detail: r.detail || null });
    if (!r.ok) failed.push(p.id);
  }

  return {
    gate: 'dogfood-acceptance',
    points: results,
    failed_points: failed,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
  };
}

// -- Phase 150-08 (MEM-09 / D-09): the claim harness gate (doctor --claims) -----
//
// A SIBLING of runAcceptance: it shells tests/claim-harness/run-all-claims.sh
// (the C1..C7 falsifiable public-site-claim drivers + the gates) and returns its
// OWN self-contained exit code, NOT folded into the class roster. Canon Part 8:
// the harness is LOCAL/hermetic; the Brain LIVE arms self-skip via
// class-m-brain-smoke, so the gate is CI-green without a reachable Brain.
//
// Self-test hook (mirrors DOCTOR_TEST_FAIL_POINT): when DOCTOR_CLAIM_FAIL_POINT
// is set (any non-empty value) AND the in-test mode is active, the gate
// synthesizes a failure of the harness so its own failure path is testable
// WITHOUT corrupting the real harness. The accepted token is 'run-all-claims'
// (the single point this gate owns); any other non-empty value also trips, so a
// test can simply set DOCTOR_CLAIM_FAIL_POINT=run-all-claims.
function runClaims(opts) {
  opts = opts || {};
  const pluginRoot = opts.pluginRoot || PLUGIN_ROOT;
  const cp = require('child_process');
  const harness = path.join(pluginRoot, 'tests', 'claim-harness', 'run-all-claims.sh');

  // DOCTOR_CLAIM_FAIL_POINT self-test (mirrors the DOCTOR_TEST_FAIL_POINT
  // precedent at runAcceptance). inTestMode mirrors the acceptance self-test
  // gate: it is on when the env var is set (the test owns the process).
  const failPoint = process.env.DOCTOR_CLAIM_FAIL_POINT;
  if (typeof failPoint === 'string' && failPoint.length > 0) {
    return {
      gate: 'claims',
      ok: false,
      synthesized: true,
      fail_point: failPoint,
      status: null,
      finding: 'DOCTOR_CLAIM_FAIL_POINT synthesized a failure of the claim harness (' + failPoint + ')',
      summary: { total: 1, passed: 0, failed: 1 },
    };
  }

  if (!fs.existsSync(harness)) {
    return {
      gate: 'claims',
      ok: false,
      synthesized: false,
      status: null,
      finding: 'claim harness missing: tests/claim-harness/run-all-claims.sh',
      summary: { total: 1, passed: 0, failed: 1 },
    };
  }

  const r = cp.spawnSync('bash', [harness], { encoding: 'utf8', timeout: 300000 });
  const ok = r.status === 0;
  return {
    gate: 'claims',
    ok: ok,
    synthesized: false,
    status: r.status,
    signal: r.signal || null,
    finding: ok ? null : ('claim harness exited ' + r.status + (r.signal ? ' (signal ' + r.signal + ')' : '')),
    stdoutTail: (r.stdout || '').slice(-800),
    stderrTail: (r.stderr || '').slice(-400),
    summary: { total: 1, passed: ok ? 1 : 0, failed: ok ? 0 : 1 },
  };
}


// -- Renderers -------------------------------------------------------

// Phase 95.1-04 retrofit: 4-zone Shape E (Action Report) per skills/ui-system/SKILL.md.
// Zone 1 header literal '-- MindrianOS -- doctor -- {stage} --' (compact form when
// projected lines > 30 per D-16). Zone 2 body holds per-class drift findings using
// only the 12-glyph vocabulary. Zone 3 reserved for room-proactive signals (D-17;
// always empty in Phase 95.1, room-proactive integration deferred). F.1 Next Move
// selector renders before Zone 4 when drift detected without --fix (D-18; structural
// marker only, canonical AskUserQuestion implementation deferred to Phase 88.2 -- see
// .planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/f1-selector-deferred.md).
// Zone 4 action footer always present (D-12). Renderer is purely structural; Larry
// handles narrative interpretation per D-19.
function renderHumanReport(report) {
  const lines = [];

  // Compute stage label for Zone 1 per D-12 stage values.
  let stage = 'no-drift';
  if (report.fixRequested && report.classARecovered) stage = 'recovered';
  else if (report.fixRequested) stage = 'recovering';
  else if (report.drift && report.drift.detected) stage = 'drift-detected';
  // Additional class-driven drift detection added by 95.1 plans 05+06 will populate
  // report.checks; iterate and aggregate stage accordingly.

  // Compute body rows BEFORE deciding header density (D-16).
  const bodyRows = [];

  // Class A -- install-cache (existing logic preserved, glyphs swapped to vocabulary).
  //
  // Phase 126 Plan-01 fix: when classARecovered is set (recovery succeeded),
  // the renderer MUST emit BOTH `✓ recovered to <version>` AND `backup <path>`
  // lines per the commands/doctor.md Step 3 contract -- INCLUDING the
  // missing-install case (installResult.status === 'missing') where the
  // pre-fix renderer fell into the `cannot read state` branch and never
  // emitted the contract lines (2026-05-13 Windows dogfood finding 3a).
  // Recovery-succeeded takes precedence over status-shape branching.
  if (report.classARecovered) {
    // Drift was detected (either status==='ok' + cmp<0 OR status==='missing'
    // with available cache; see drift detection at line ~2634-2649) and was
    // closed by performRecoveryAtomic. Use the drift-detected layout for
    // continuity with the live-stale recovery case.
    bodyRows.push(`  ${C.yellow}■${C.reset} install-cache              ${C.yellow}⚠${C.reset} drift detected`);
    // Show the live -> recovered transition. For the missing-install case
    // report.install.version is undefined; show `missing` instead so the
    // line is still informative.
    const liveLabel = report.install.version || (report.install.status === 'missing' ? 'missing' : 'unknown');
    bodyRows.push(`     ${C.dim}live${C.reset}    ${C.yellow}${liveLabel}${C.reset} ${C.dim}→${C.reset} ${C.green}${report.cache.latest || report.classARecovered.recoveredVersion}${C.reset}`);
    bodyRows.push(`     ${C.green}✓${C.reset} recovered to ${C.green}${report.classARecovered.recoveredVersion}${C.reset}`);
    // Backup line: omit when backup is null (missing-install case -- nothing
    // existed to rename; performRecoveryAtomic returned backup=null at
    // line ~370 of this file). The contract example specifies the line is
    // emitted WHEN a backup exists, not unconditionally.
    if (report.classARecovered.backup) {
      bodyRows.push(`     ${C.dim}backup ${report.classARecovered.backup}${C.reset}`);
    }
  } else if (report.install.status === 'ok' && report.cache.status === 'ok') {
    if (report.drift.detected) {
      bodyRows.push(`  ${C.yellow}■${C.reset} install-cache              ${C.yellow}⚠${C.reset} drift detected`);
      bodyRows.push(`     ${C.dim}live${C.reset}    ${C.yellow}${report.install.version}${C.reset} ${C.dim}→${C.reset} ${C.green}${report.cache.latest}${C.reset}`);
      if (report.fixRequested) {
        // RCA doctor-marketplace-cache-drift-deadlock (2026-06-12): three-way
        // branch replaces the single `recovery failed: <err || 'unknown'>`
        // line. The literal 'unknown' rendered whenever recovery was never
        // ATTEMPTED (gated/skipped) -- classARecovered and recoveryError both
        // null is not a failure, it is an un-run.
        if (report.recoveryError) {
          bodyRows.push(`     ${C.red}⚠${C.reset} recovery failed: ${report.recoveryError}`);
        } else if (report.recoverySkipped) {
          bodyRows.push(`     ${C.yellow}⚠${C.reset} recovery skipped (topology marketplace-cache -- legacy install dir is vestigial)`);
        } else {
          bodyRows.push(`     ${C.dim}recovery not attempted (gated)${C.reset}`);
        }
      }
    } else {
      bodyRows.push(`  ${C.green}■${C.reset} install-cache              ${C.green}✓${C.reset} healthy ${C.dim}(${report.install.version})${C.reset}`);
    }
  } else {
    bodyRows.push(`  ${C.red}■${C.reset} install-cache              ${C.red}⚠${C.reset} cannot read state`);
    if (report.install.status !== 'ok') bodyRows.push(`     ${C.dim}install: ${report.install.detail || report.install.status}${C.reset}`);
    if (report.cache.status !== 'ok') bodyRows.push(`     ${C.dim}cache:   ${report.cache.detail || report.cache.status}${C.reset}`);
  }

  // Dev source consistency.
  if (report.dev.status === 'ok') {
    bodyRows.push(`  ${C.green}■${C.reset} dev-source                 ${C.green}✓${C.reset} consistent ${C.dim}(${report.dev.pluginJson})${C.reset}`);
  } else if (report.dev.status === 'mismatch') {
    bodyRows.push(`  ${C.yellow}■${C.reset} dev-source                 ${C.yellow}⚠${C.reset} version mismatch`);
    bodyRows.push(`     ${C.dim}plugin.json  ${report.dev.pluginJson}${C.reset}`);
    bodyRows.push(`     ${C.dim}package.json ${report.dev.packageJson}${C.reset}`);
  }
  // status=skip silently omitted (acceptable for end users without dev clone).

  // Slot for class B/C/D/E/F/G rows -- populated by Plans 95.1-05 + 95.1-06
  // and Plan 106-03 via report.checks.* extension. Each new check reads from
  // report.checks[name] and pushes rows in the same Shape-E format:
  // filled-square + class label + status glyph + detail. Glyphs match the
  // existing class A pattern: green check for ok, yellow warn for warn,
  // red warn for error (mirrors line 1067 'cannot read state'), dim slash
  // for skip. Class F UI compliance scanner approves these glyphs (U+2717
  // BALLOT X is forbidden; U+26A0 WARN and U+2298 CIRCLED DIVISION SLASH
  // are approved per the 12-glyph vocabulary).
  if (report.checks) {
    // Class G (statusline-visibility) + class H (install-incomplete) hand-coded
    // render branches RETIRED (Phase 217 Plan 05): both rows -- and class H's
    // hint sub-line -- now come from the generic loop below + the runner's
    // action_lines[]. After this plan the ONLY non-generic render path left is
    // class A (install-cache), the sanctioned carve-out (Plan 06).
    for (const [name, check] of Object.entries(report.checks)) {
      if (name === 'install-cache') continue; // already handled above.
      // Skip entries are omitted, matching the plugin-enabled-state precedent
      // above and computeSummary's skip omission, so visible rows stay in exact
      // parity with the Summary tally.
      if (!check || check.status === 'skip') continue;
      let glyph;
      let color;
      if (check.status === 'ok') { glyph = '✓'; color = C.green; }
      else if (check.status === 'warn') { glyph = '⚠'; color = C.yellow; }
      else if (check.status === 'error') { glyph = '⚠'; color = C.red; }
      else { glyph = '⊘'; color = C.dim; }
      bodyRows.push('  ' + color + '■' + C.reset + ' ' + name.padEnd(28) + color + glyph + C.reset + ' ' + (check.detail || check.status));
      // Phase 217 Plan-01: action_lines sub-line support. The structural home
      // for the hand-coded hint sub-lines (class H/K/N) that later migration
      // plans delete: a cadence:always module returns action_lines[] and the
      // generic renderer prints one dim `-> ` sub-line per entry.
      if (Array.isArray(check.action_lines)) {
        for (const line of check.action_lines) {
          bodyRows.push('     ' + C.dim + '-> ' + line + C.reset);
        }
      }
    }
  }

  // Render --fix outcomes so a fix attempt is never invisible. Every --fix
  // dispatch pushes its result into report.recovered; class A recovery already
  // renders via classARecovered above, so the install-cache tool is guarded to
  // avoid a double line.
  if (report.fixRequested && Array.isArray(report.recovered) && report.recovered.length > 0) {
    for (const entry of report.recovered) {
      if (!entry) continue;
      if (entry.status === 'skip') continue; // skip entries omitted.
      if (entry.tool === 'install-cache') continue; // already rendered via classARecovered.
      let glyph;
      let color;
      if (entry.status === 'ok') { glyph = '✓'; color = C.green; }
      else if (entry.status === 'partial') { glyph = '⚠'; color = C.yellow; }
      else if (entry.status === 'error') { glyph = '⚠'; color = C.red; }
      else { glyph = '⊘'; color = C.dim; }
      bodyRows.push('  ' + color + glyph + C.reset + ' fix ' + (entry.tool || 'unknown-tool') + ': ' + (entry.detail || entry.status));
    }
  }

  // Summary line. Aggregate counts from install/dev/drift signals plus any
  // report.checks.* rows that Plans 05+06 will register.
  const summary = computeSummary(report);
  bodyRows.push('');
  bodyRows.push(`  ${C.dim}Summary: ${C.green}${summary.healthy}${C.dim} healthy / ${C.yellow}${summary.drift}${C.dim} drift / ${C.red}${summary.warnings}${C.dim} warnings${C.reset}`);

  // F.1 Next Move selector (D-18) -- only when drift AND !fix. Phase 95.1 ships
  // a STRUCTURAL marker. Larry handles conversational selection per D-19.
  // Phase 88.2 will replace this with the canonical AskUserQuestion primitive.
  // See .planning/phases/95.1-.../f1-selector-deferred.md for the deferral note.
  if (!report.fixRequested && (report.drift.detected || summary.drift > 0)) {
    bodyRows.push('');
    bodyRows.push(`  ${C.cyan}[F.1 Next Move]${C.reset}`);
    bodyRows.push(`   ${C.cyan}▶${C.reset} Run ${C.cyan}/mos:doctor --fix${C.reset}`);
    bodyRows.push(`   ${C.dim}▷${C.reset} Defer`);
    bodyRows.push(`   ${C.dim}▷${C.reset} Free-Text`);
  }

  // Zone 4 action footer -- ALWAYS present (D-12 mandate). 2-3 grounded /mos:
  // commands. Primary action uses U+25B6, alternatives use U+25B7.
  bodyRows.push('');
  if (report.drift.detected || summary.drift > 0) {
    bodyRows.push(`  ${C.cyan}▶ /mos:doctor --fix --all${C.reset}     ${C.dim}# auto-recover all drift classes${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:rooms${C.reset}                 ${C.dim}# inspect known rooms${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --json${C.reset}         ${C.dim}# machine-readable output${C.reset}`);
  } else {
    bodyRows.push(`  ${C.cyan}▶ /mos:status${C.reset}                  ${C.dim}# room state overview${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --all${C.reset}          ${C.dim}# re-run all classes${C.reset}`);
    bodyRows.push(`  ${C.dim}▷${C.reset} ${C.cyan}/mos:doctor --json${C.reset}         ${C.dim}# machine-readable output${C.reset}`);
  }

  // Zone 1 header (decided AFTER body rows for density rule, D-16).
  // Zone 3 (Intelligence Strip) stays empty in 95.1 per D-17 -- room-proactive
  // integration deferred. Default behavior: omit Zone 3 entirely.
  const projectedLineCount = bodyRows.length + 4; // header + blank + body + trailing blank.
  if (projectedLineCount > 30) {
    // Compact header per D-16 density rule.
    const classCount = Object.keys(report.checks || { 'install-cache': 1 }).length;
    lines.push(`${C.dim}-- doctor: ${classCount} drift classes checked --${C.reset}`);
  } else {
    // Standard Zone 1 header per D-12. Literal prefix '-- MindrianOS -- doctor'
    // is asserted by tests/test-doctor-ui-self-compliant.cjs scenario 3.
    lines.push(`${C.dim}-- MindrianOS -- doctor -- ${stage} --${C.reset}`);
  }
  lines.push('');
  for (const row of bodyRows) lines.push(row);
  lines.push('');

  return lines.join('\n');
}

// Helper for Zone 2 summary aggregation. Walks install/dev/drift signals plus
// any report.checks.* rows that Plans 05+06 will register and returns
// healthy / drift / warning totals.
function computeSummary(report) {
  let healthy = 0;
  let drift = 0;
  let warnings = 0;
  // Class A -- install-cache + drift signal.
  //
  // Phase 126 Plan-01 fix: after a successful classA recovery, the drift was
  // RESOLVED -- the summary must NOT report `1 drift` while the header says
  // `recovered` (Option A: decrement-after-recovery, minimum surface delta
  // per Canon Part 7). 2026-05-13 Windows dogfood finding 3a flagged the
  // `0 healthy / 1 drift / 0 warnings` line as semantically inconsistent
  // with the recovered header. After recovery the install is on the cache's
  // latest version; classify as healthy.
  if (report.classARecovered) {
    healthy += 1;
  } else if (report.install.status === 'ok' && report.cache.status === 'ok' && !report.drift.detected) {
    healthy += 1;
  } else if (report.drift.detected) {
    drift += 1;
  } else {
    warnings += 1;
  }
  // Dev source.
  if (report.dev.status === 'ok') healthy += 1;
  else if (report.dev.status === 'mismatch') warnings += 1;
  // Future class B/C/D/E/F: walk report.checks.
  if (report.checks) {
    for (const [name, check] of Object.entries(report.checks)) {
      if (name === 'install-cache') continue;
      if (check && check.status === 'ok') healthy += 1;
      else if (check && (check.status === 'warn' || check.status === 'error')) drift += 1;
      // status='skip' omitted from totals.
    }
  }
  return { healthy, drift, warnings };
}

// -- Accumulative engine (Phase 139-02, S2) --------------------------
//
// The version-dispatch substrate that converts doctor's frozen Phase-95 class
// roster into a forward-healing engine. Generalizes the proven
// lib/core/install-state.cjs::migrateIfNeeded shape: iterate the hand-maintained
// module registry (data/doctor-modules.json), run every module whose
// introduced_version is in the (applied_through, running] window, DEFER any
// future-version module (introduced > running), and never re-run an
// already-applied one (the persisted watermark at ~/.mindrian/doctor-applied.json
// never regresses -> re-running is a no-op).
//
// In THIS plan the registry is seeded EMPTY of organ modules, so the loop runs
// zero modules -- but the window math + runner-dispatch wiring is complete, so
// Plan 03 only adds a registry entry + a runner file, no engine code.
//
// Canon Part 8: LOCAL file reads only. Zero network surface; runs no Brain query.

// Normalize a version string for semver comparison. Prefer semver.valid (which
// PRESERVES prerelease labels so 1.13.1-beta.4 vs 1.13.1-beta.3 compare
// correctly) and fall back to semver.coerce only for sloppy input that is not
// already valid semver. Returns null when neither resolves.
function _normalizeVersion(v) {
  if (typeof v !== 'string' || !v) return null;
  const valid = semver.valid(v);
  if (valid) return valid;
  const coerced = semver.coerce(v);
  return coerced ? coerced.version : null;
}

/**
 * Run the accumulative-engine selector.
 *
 * @param {object} [flags] CLI flags (fix, dryRun, json, flags, classFlagsActive)
 *        OR a test opts seam ({ home, running, registry, dryRun }). The test
 *        seam keys take precedence so the test never depends on the live
 *        registry. `flags` is the full parsed CLI flags object and
 *        `classFlagsActive` the class-flag-mode boolean; both drive the
 *        Phase 217 cadence/flag gates (default {} + false => baseWanted true,
 *        keeping every pre-217 caller byte-compatible).
 * @returns {{
 *   status: 'ok'|'skip',
 *   detail?: string,
 *   running: string|null,
 *   applied_through: string|null,
 *   selected: Array<{id, introduced_version}>,
 *   deferred: Array<{id, introduced_version}>,
 *   findings: Array<object>,
 *   advanced: boolean,
 *   checks: Object<string, object>,
 *   recovered: Array<object>
 * }}
 */
// resolveAlwaysRunner(mod): resolve the check/fix pair for a cadence:always
// module. Test seams (mod._check / mod._fix) win; otherwise require the runner
// file relative to the plugin root and read its exported check/fix. Never
// throws (a require failure leaves the fn null -> the caller records an error
// finding), so one bad module cannot crash the always-pass (T-217-01).
function resolveAlwaysRunner(mod) {
  let checkFn = (typeof mod._check === 'function') ? mod._check : null;
  let fixFn = (typeof mod._fix === 'function') ? mod._fix : null;
  if ((!checkFn || !fixFn) && mod.runner) {
    try {
      const runnerPath = path.isAbsolute(mod.runner)
        ? mod.runner
        : path.join(PLUGIN_ROOT, mod.runner);
      const runnerMod = require(runnerPath);
      if (!checkFn && typeof runnerMod.check === 'function') checkFn = runnerMod.check;
      if (!fixFn && typeof runnerMod.fix === 'function') fixFn = runnerMod.fix;
    } catch (_) { /* leave null; the caller soft-fails to an error finding */ }
  }
  return { checkFn, fixFn };
}

function runAccumulativeEngine(flags) {
  const opts = flags || {};
  const home = opts.home || process.env.HOME || process.env.USERPROFILE || HOME;
  const dryRun = !!opts.dryRun;
  const wantFix = !!opts.fix;
  // Phase 217 Plan-01: the full parsed CLI flags object + the class-flag-mode
  // boolean, both carried so the engine can reproduce the exact gate that
  // today lives at the main() call site. Defaults keep every pre-217 caller
  // (the hermetic selector tests pass only { home, running, registry })
  // byte-compatible: flags {} + classFlagsActive false => baseWanted true.
  const callerFlags = (opts.flags && typeof opts.flags === 'object') ? opts.flags : {};
  const classFlagsActive = !!opts.classFlagsActive;
  // baseWanted is the class-A/N "runs on a bare / --all / --fix run, but a
  // class-flag-only run (e.g. --room-md) skips it" gate -- the exact predicate
  // that used to guard the engine call in main() (line ~5534).
  const baseWanted = !!(callerFlags.all || callerFlags.fix || !classFlagsActive);

  // 1. Resolve the RUNNING version of record. Test seam: opts.running wins.
  //    Otherwise read the active plugin.json via checkInstallVersion().
  let runningRaw = (typeof opts.running !== 'undefined') ? opts.running : null;
  if (runningRaw === null && typeof opts.running === 'undefined') {
    try {
      const iv = checkInstallVersion();
      runningRaw = iv && iv.version ? iv.version : null;
    } catch (_) {
      runningRaw = null;
    }
    // Phase 217 Plan 05/06: when checkInstallVersion cannot resolve the install
    // (e.g. a hermetic test that overrides HOME so ~/.claude/plugins is not
    // where checkInstallVersion looked, or an install loaded from an unexpected
    // path) OR resolves a NON-CLEAN-SEMVER version (a 4-component ship version
    // like 1.12.5.1 that only survives via semver.coerce, which DROPS the 4th
    // component -- 1.12.5.1 -> 1.12.5 -- and would then place the install BELOW
    // a diagnostic's introduced_version on the deferred-guard number line, so a
    // cadence:always check that ships WITH this code would be wrongly DEFERRED),
    // fall back to the version of record of the CODE that is actually running --
    // PLUGIN_ROOT/.claude-plugin/plugin.json. That path is HOME-independent, so
    // the accumulative engine never goes dark (the Pitfall-1 silence the
    // always-cadence design exists to prevent, and the regression class I test
    // i.6 pins: a 1.12.5.1 install must still surface report.checks
    // ['install-state']). Real installs with CLEAN semver resolve via
    // checkInstallVersion first, so this is a no-op for them. Only reached when
    // opts.running was undefined (the real CLI path); an EXPLICIT opts.running:
    // null still yields the soft-fail skip. semver.valid rejects 4-component and
    // accepts prereleases (1.13.0-beta.13 stays as-resolved), which is exactly
    // the clean-vs-coerced distinction the deferred-guard needs.
    if (!semver.valid(typeof runningRaw === 'string' ? runningRaw : '')) {
      try {
        const devPluginJson = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
        if (fs.existsSync(devPluginJson)) {
          const j = JSON.parse(fs.readFileSync(devPluginJson, 'utf8'));
          runningRaw = j && j.version ? j.version : null;
        }
      } catch (_) {
        runningRaw = null;
      }
    }
  }
  const running = _normalizeVersion(runningRaw);
  if (!running) {
    return {
      status: 'skip',
      detail: 'running version unresolved',
      running: null,
      applied_through: null,
      selected: [],
      deferred: [],
      findings: [],
      advanced: false,
      checks: {},
      recovered: [],
    };
  }

  // 2. Read the registry (soft-fail to { modules: [] } on parse error).
  //    Test seam: opts.registry wins.
  let registry;
  if (opts.registry && typeof opts.registry === 'object') {
    registry = opts.registry;
  } else {
    try {
      registry = JSON.parse(fs.readFileSync(DOCTOR_MODULES_PATH, 'utf8'));
    } catch (_) {
      registry = { modules: [] };
    }
  }
  const modules = Array.isArray(registry.modules) ? registry.modules : [];

  // 2b. Split registry modules by CADENCE (Phase 217 Plan-01, Pitfall 1):
  //     - cadence:'always' = a per-invocation DIAGNOSTIC. Its check() runs on
  //       EVERY doctor invocation, immune to the watermark. This is what stops
  //       a migrated D-01 check from going permanently silent after one run.
  //     - cadence:'once' (or ABSENT, back-compat) = a watermark-gated HEAL
  //       (umbilical's existing semantics). The Plan 02 contract test forces the
  //       registry file itself to declare cadence explicitly.
  const onceModules = [];
  const alwaysModules = [];
  for (const mod of modules) {
    if (!mod || typeof mod.id !== 'string') continue;
    if (mod.cadence === 'always') alwaysModules.push(mod);
    else onceModules.push(mod);
  }

  // 3. Read the watermark. null applied_through means "first run; window is
  //    (null, running] = everything <= running". Read unconditionally so the
  //    return shape reports applied_through even when the once-pass is gated off.
  const wm = readDoctorApplied(home);
  const appliedThrough = wm.applied_through; // semver string | null

  const selected = [];
  const deferred = [];
  const findings = [];
  const ranModuleIds = [];
  let anyHardError = false;
  let advanced = false;

  // 4. ONCE pass (watermark-gated heals; umbilical). Behavior byte-identical to
  //    pre-217 with ONE relocation: the entire once-pass (window selection +
  //    runner invocation + watermark advance) is now gated behind baseWanted --
  //    the exact `flags.all || flags.fix || !classFlagsActive` predicate that
  //    used to live at the main() call site. A class-flag-only run (--room-md)
  //    therefore never runs the once-heals and never advances the watermark,
  //    preserving the pre-217 invariant. When the gate is false the once-pass
  //    yields selected:[], advanced:false.
  if (baseWanted) {
    // SELECT once modules where introduced_version is in (applied_through, running].
    // Lower bound EXCLUSIVE (already-applied), upper bound INCLUSIVE (current).
    // A future-version module (introduced > running) is DEFERRED, never run --
    // the future-version-DEFER shape from install-state.migrateIfNeeded.
    const lower = appliedThrough || '0.0.0';
    for (const mod of onceModules) {
      const introduced = _normalizeVersion(mod.introduced_version);
      if (!introduced) {
        // Malformed introduced_version -> skip (cannot place in the window).
        continue;
      }
      const aboveLower = semver.gt(introduced, _normalizeVersion(lower) || '0.0.0');
      const atOrBelowRunning = semver.lte(introduced, running);
      if (!atOrBelowRunning) {
        deferred.push(mod);
        continue;
      }
      if (aboveLower) {
        selected.push(mod);
      }
      // introduced <= applied_through -> already applied -> skip silently.
    }

    // 5. Run each selected module's runner, wrapped in try/catch so one bad
    //    module cannot crash doctor (soft-fail -> error finding, loop continues).
    //    --fix runs the module fixer; read-only runs the checker only.
    for (const mod of selected) {
      try {
        // Resolve the runner. Test seam: an in-test runner is attached as
        // mod._check / mod._fix. Otherwise require the runner file relative to
        // the plugin root and invoke its exported check(opts)/fix(opts) entry.
        let entryResult;
        if (wantFix && typeof mod._fix === 'function') {
          entryResult = mod._fix({ home, running, dryRun });
        } else if (typeof mod._check === 'function') {
          entryResult = mod._check({ home, running, dryRun });
        } else if (mod.runner) {
          const runnerPath = path.isAbsolute(mod.runner)
            ? mod.runner
            : path.join(PLUGIN_ROOT, mod.runner);
          const runnerMod = require(runnerPath);
          const entry = (wantFix && typeof runnerMod.fix === 'function')
            ? runnerMod.fix
            : runnerMod.check;
          if (typeof entry !== 'function') {
            throw new Error('runner ' + mod.runner + ' exposes no ' + (wantFix ? 'fix/check' : 'check') + ' function');
          }
          entryResult = entry({ home, running, dryRun, fix: wantFix });
        } else {
          throw new Error('module ' + mod.id + ' has no runner');
        }
        findings.push(Object.assign({ id: mod.id, status: 'ok' }, entryResult && typeof entryResult === 'object' ? entryResult : {}));
        ranModuleIds.push(mod.id);
      } catch (err) {
        anyHardError = true;
        findings.push({ id: mod.id, status: 'error', detail: (err && err.message) || 'runner threw' });
      }
    }

    // 6. Idempotency: advance the watermark to running ONLY on a non-dry-run with
    //    no hard runner error. Re-running with the watermark already at running
    //    selects ZERO modules (window (running, running] is empty) -> no-op.
    //    An EMPTY window (zero selected) on a clean run still advances so the
    //    ledger records the heal-through point.
    if (!dryRun && !anyHardError) {
      advanced = writeDoctorApplied(home, { appliedThrough: running, ranModuleIds });
    }
  }

  // 7. ALWAYS pass (Phase 217 Plan-01, Pitfall 1). For each cadence:always
  //    module in registry array order: flag-gate, deferred-guard (upper bound
  //    only -- NO watermark lower bound, that is the whole point), run check()
  //    on EVERY invocation, optional fix-then-recheck. Results land ONLY in
  //    alwaysChecks (never in the once-path findings[]), so the selector-test
  //    assertions on findings stay valid and Pitfall 3 is impossible.
  const alwaysChecks = {};
  const recovered = [];
  for (const mod of alwaysModules) {
    // a. Flag gate. null/undefined flag => the class-A/N baseWanted gate (runs
    //    under bare / --all / --fix when no class flag is active). A named flag
    //    => the module runs only when that parseArgs flag is set.
    const flagKey = mod.flag;
    const wanted = (flagKey === null || flagKey === undefined)
      ? baseWanted
      : !!callerFlags[flagKey];
    if (!wanted) continue; // no report entry -- matches today's absent-when-not-requested behavior.

    // b. Deferred guard (registry/code-skew safety ONLY): a module introduced in
    //    a FUTURE version is deferred. There is NO lower-bound / watermark check
    //    for always modules -- that immunity is the point (Pitfall 1).
    const introduced = _normalizeVersion(mod.introduced_version);
    if (introduced && semver.gt(introduced, running)) {
      deferred.push(mod);
      continue;
    }

    // c. Build ctx. `checks` is the accumulating always-result map so a later
    //    module can read an earlier same-invocation result (Plan 06 reads
    //    ctx.checks['install-state']).
    const ctx = { home, running, dryRun, fix: wantFix, flags: callerFlags, checks: alwaysChecks };

    // d. Resolve + run check() inside try/catch (soft-fail -> error row,
    //    self-DoS mitigation T-217-01).
    const { checkFn, fixFn } = resolveAlwaysRunner(mod);
    let result;
    try {
      if (typeof checkFn !== 'function') {
        throw new Error('module ' + mod.id + ' exposes no check function');
      }
      result = checkFn(ctx);
    } catch (err) {
      result = { status: 'error', detail: (err && err.message) || 'runner threw' };
    }

    // e. Fix-then-recheck flow (mirrors the ad-hoc class E/G/H pattern). Only
    //    when --fix was requested, the module declares fix_supported === true,
    //    a fixer exists, the check surfaced a warn/error, and the result is not
    //    explicitly marked unrecoverable.
    if (wantFix && mod.fix_supported === true && typeof fixFn === 'function'
        && result && (result.status === 'warn' || result.status === 'error')
        && result.recoverable !== false) {
      let fixRes;
      try {
        fixRes = fixFn(Object.assign({}, ctx, { check_result: result }));
      } catch (err) {
        fixRes = { status: 'error', detail: (err && err.message) || 'fixer threw' };
      }
      // Re-run the check so the reported result reflects the post-fix state.
      try {
        result = checkFn(ctx);
      } catch (err) {
        result = { status: 'error', detail: (err && err.message) || 'runner threw' };
      }
      result.fix_result = fixRes;
      // Recovered plumbing. Object.assign order matters: the fixer's own `tool`
      // field wins when present (preserves class E's existing recovery record
      // shape, e.g. tool:'generate-section-intelligence').
      if (fixRes && Array.isArray(fixRes.recoveries)) {
        for (const rec of fixRes.recoveries) {
          recovered.push(Object.assign({ tool: mod.id }, rec));
        }
      } else {
        recovered.push(Object.assign({ tool: mod.id }, fixRes));
      }
    }

    // f. Always results go ONLY into alwaysChecks, NEVER the once-path findings[].
    alwaysChecks[mod.id] = result;
  }

  return {
    status: 'ok',
    running,
    applied_through: appliedThrough,
    selected: selected.map((m) => ({ id: m.id, introduced_version: m.introduced_version })),
    deferred: deferred.map((m) => ({ id: m.id, introduced_version: m.introduced_version })),
    findings,
    advanced: !!advanced,
    checks: alwaysChecks,
    recovered,
  };
}

// -- Phase 150.9 Class Q / heal-arm helpers --------------------------
//
// resolveGsdTools(): locate gsd-tools.cjs mirroring the workflows/health.md:52
// _GSD_TOOLS resolver order. NEVER hardcodes a single path. Honors the
// MINDRIAN_DOCTOR_GSD_TOOLS env override FIRST (hermetic-test injection +
// operator override). Returns an absolute path or null (-> Class Q emits a
// 'skip' finding; the run never crashes). Canon Part 8: locates a LOCAL tool;
// no network.
function resolveGsdTools() {
  const fsLocal = require('fs');
  // 0. Explicit override (tests + operators).
  const override = process.env.MINDRIAN_DOCTOR_GSD_TOOLS;
  if (override) {
    return fsLocal.existsSync(override) ? override : null;
  }
  const SHIM = 'gsd-tools.cjs';
  const candidates = [];
  // 1. RUNTIME_DIR / repo-root gsd-core.
  const runtimeRoot = process.env.RUNTIME_DIR || path.resolve(__dirname, '..');
  candidates.push(path.join(runtimeRoot, 'gsd-core', 'bin', SHIM));
  candidates.push(path.join(runtimeRoot, '.claude', 'gsd-core', 'bin', SHIM));
  // 2. HOME-installed gsd-core (the common dev/CI topology).
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) candidates.push(path.join(home, '.claude', 'gsd-core', 'bin', SHIM));
  for (const c of candidates) {
    try { if (fsLocal.existsSync(c)) return c; } catch (_e) { /* keep looking */ }
  }
  return null;
}

// extractPhaseToken(message): pull a phase label (digits + dots, e.g. "150.7")
// out of a W007 ROADMAP-gap message. Returns the token or null.
function extractPhaseToken(message) {
  const s = String(message || '');
  // "Phase 150.7 exists on disk but not in ROADMAP.md"
  let m = s.match(/Phase\s+([0-9][0-9.]*)\b/i);
  if (m) return m[1];
  // Fallback: a leading "<NN>-<name>" directory token.
  m = s.match(/\b([0-9][0-9.]*)-[a-z]/i);
  return m ? m[1] : null;
}

// extractPlanRef(message): from an I001 "NNN-PP-PLAN.md has no SUMMARY.md"
// message recover { phase, planFile, planLabel }. Returns null when no
// "<plan>-PLAN.md" token is present.
function extractPlanRef(message) {
  const s = String(message || '');
  const m = s.match(/([0-9][0-9.]*-[0-9A-Za-z.]+-PLAN\.md)/);
  if (!m) return null;
  const planFile = m[1];
  const planLabel = planFile.replace(/-PLAN\.md$/i, '');
  const phaseMatch = planLabel.match(/^([0-9][0-9.]*)-/);
  const phase = phaseMatch ? phaseMatch[1] : null;
  return { phase, planFile, planLabel };
}

// findPhaseDir(repoRoot, phaseToken): locate the on-disk phase directory under
// .planning/phases/ whose name starts with "<phase>-". Returns absolute path or
// null. Used only by the --fix heal arm to place a SUMMARY stub.
function findPhaseDir(repoRoot, phaseToken) {
  if (!phaseToken) return null;
  const fsLocal = require('fs');
  const phasesDir = path.join(repoRoot, '.planning', 'phases');
  let entries;
  try { entries = fsLocal.readdirSync(phasesDir, { withFileTypes: true }); }
  catch (_e) { return null; }
  const prefix = phaseToken + '-';
  for (const ent of entries) {
    if (ent.isDirectory() && ent.name.indexOf(prefix) === 0) {
      return path.join(phasesDir, ent.name);
    }
  }
  return null;
}

// -- Main ------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quick task 260705-jeq: --report-registration-bug assembler (D-01, D-02).
//
// A NEW read-only reporting mode. Every FACT comes from an EXISTING evidence
// collector (Canon Part 7 -- reuse, never reimplement): checkPluginEnabled,
// readInstalledPluginsVersion, readLegacyConfigPin, detectMarketplaceCacheInstall,
// collectVersionOfRecord, computeVersionDivergences, resolveActivePluginRoot, and
// Task 1's sweepCommandRegistration. The mode proves each locally-checkable cause
// of "valid install yet a command did not register" is CLEAN, so what remains is
// the confirmed host-side core bug -- nothing to fix locally, escalate to
// Anthropic. Diagnostic-only: the output NEVER carries a "healthy"/"fixed" status.
// Canon Part 8: LOCAL reads + two guarded best-effort child probes (git, claude
// --version), each via execFileSync with an argument array (never a shell string).
// ---------------------------------------------------------------------------

// Best-effort Claude Code version; null (never a throw) when unobtainable, so the
// report still assembles offline (RESEARCH open question 2 resolved).
function probeClaudeVersion() {
  try {
    const cp = require('child_process');
    const out = cp.execFileSync('claude', ['--version'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const v = String(out || '').trim();
    return v || null;
  } catch (_) { return null; }
}

// Guarded git-dirty probe of the marketplace clone dir. Swallow-and-note when git
// or the dir is absent (the report must assemble anyway). execFileSync with an
// argument array only (T-jeq-01: never a string-interpolated shell command).
function probeMarketplaceCloneGit(home) {
  const dir = path.join(home, '.claude', 'plugins', 'marketplaces', 'mindrian-marketplace');
  try {
    if (!fs.existsSync(dir)) {
      return { available: false, dir, note: 'clone dir absent' };
    }
    const cp = require('child_process');
    const out = cp.execFileSync('git', ['-C', dir, 'status', '--porcelain'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { available: true, dir, dirty: String(out || '').trim().length > 0 };
  } catch (e) {
    return { available: false, dir, note: 'git probe unavailable (' + ((e && e.message) || 'error') + ')' };
  }
}

function countCommandFilesAt(root) {
  try {
    const dir = path.join(root, 'commands');
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch (_) { return 0; }
}

// Assemble the full report data object (all facts, no rendering). Pure gather.
function assembleRegistrationBugData() {
  const home = process.env.HOME || process.env.USERPROFILE || HOME;

  let resolver = { root: null, topology: 'not-found', source: 'not-found' };
  try { resolver = resolveActivePluginRoot(); } catch (_) { /* degrade to not-found */ }
  const rootUsed = (resolver && resolver.root) || PLUGIN_ROOT;

  let record = null;
  try { record = JSON.parse(fs.readFileSync(path.join(home, '.mindrian', 'install-state.json'), 'utf8')); } catch (_) { /* absent */ }

  const versions = collectVersionOfRecord(home, resolver, record);
  const divergences = computeVersionDivergences(versions);
  const IP = readInstalledPluginsVersion(home);
  const pluginEnabled = require(path.join(__dirname, '..', 'lib', 'core', 'check-plugin-enabled.cjs')).checkPluginEnabled();
  const legacyPin = readLegacyConfigPin(home);
  const marketplaceCache = detectMarketplaceCacheInstall(home);
  const installPath = readInstalledPluginsInstallPath(home);
  const gitProbe = probeMarketplaceCloneGit(home);
  const commandCount = countCommandFilesAt(rootUsed);
  const claudeVersion = probeClaudeVersion();
  const { sweepCommandRegistration } = require(path.join(__dirname, '..', 'lib', 'core', 'command-registration-check.cjs'));
  const sweep = sweepCommandRegistration(path.join(rootUsed, 'commands'));

  // The 7 ruled-out causes, each CLEAN or FLAGGED (fix-locally-first).
  const ruledOut = [];

  // (a) install-cache drift (class A).
  (function () {
    let status = 'CLEAN';
    let detail = 'active install matches the newest marketplace cache';
    if (marketplaceCache && IP !== 'unknown' && String(marketplaceCache.version) !== String(IP)) {
      status = 'FLAGGED';
      detail = 'installed_plugins.json is ' + IP + ' but the newest marketplace cache is ' + marketplaceCache.version;
    } else if (!marketplaceCache) {
      detail = 'no marketplace cache present to compare against (nothing to drift)';
    }
    ruledOut.push({ key: 'install-cache-drift', label: 'install-cache drift', status, detail });
  }());

  // (b) enabledPlugins silent-disable (class N / DRIFT-12).
  (function () {
    let status = 'CLEAN';
    let detail = pluginEnabled.enabled === true
      ? 'plugin key ' + (pluginEnabled.key || '(unresolved)') + ' is enabled'
      : 'enabledPlugins key absent (legacy / unknown -- not the silent-disable bug)';
    if (pluginEnabled.enabled === false) {
      status = 'FLAGGED';
      detail = 'enabledPlugins[' + pluginEnabled.key + '] is false (DRIFT-12 silent-disable); run: claude plugin enable ' + pluginEnabled.key;
    }
    ruledOut.push({ key: 'enabled-plugins-silent-disable', label: 'enabledPlugins silent-disable', status, detail });
  }());

  // (c) legacy config.json pin vs installed_plugins.json (F11 class).
  (function () {
    let status = 'CLEAN';
    let detail = legacyPin
      ? 'legacy plugins/config.json pin (' + legacyPin.version + ') agrees with installed_plugins.json (' + IP + ')'
      : 'no legacy plugins/config.json pin present (fresh-install N/A)';
    if (legacyPin && IP !== 'unknown' && String(legacyPin.version) !== String(IP)) {
      status = 'FLAGGED';
      detail = 'legacy plugins/config.json pins ' + legacyPin.version + ' but installed_plugins.json is ' + IP + ' (F11 legacy-pin drift can poison command registration)';
    }
    ruledOut.push({ key: 'legacy-config-pin', label: 'legacy config.json pin', status, detail });
  }());

  // (d) marketplace clone git-dirty state.
  (function () {
    let status = 'CLEAN';
    let detail;
    if (!gitProbe.available) {
      detail = 'marketplace clone git state not probeable (' + gitProbe.note + ') -- treated as not-applicable';
    } else if (gitProbe.dirty) {
      status = 'FLAGGED';
      detail = 'marketplace clone at ' + gitProbe.dir + ' has a dirty working tree (uncommitted local edits can shadow the shipped command files)';
    } else {
      detail = 'marketplace clone working tree is clean (' + gitProbe.dir + ')';
    }
    ruledOut.push({ key: 'marketplace-clone-git-dirty', label: 'marketplace clone git-dirty', status, detail });
  }());

  // (e) version-of-record legs all agree.
  (function () {
    let status = 'CLEAN';
    let detail = 'all known version-of-record legs agree';
    if (divergences && divergences.length) {
      status = 'FLAGGED';
      detail = divergences.length + ' version leg disagreement(s): '
        + divergences.map((d) => d.from + '(' + d.fromValue + ') vs ' + d.to + '(' + d.toValue + ')').join('; ');
    }
    ruledOut.push({ key: 'version-of-record-legs', label: 'version-of-record legs', status, detail });
  }());

  // (f) command files present on disk.
  (function () {
    const status = commandCount > 0 ? 'CLEAN' : 'FLAGGED';
    const detail = commandCount > 0
      ? commandCount + ' command files present on disk at the active root'
      : 'no command files found at the active root (' + rootUsed + ')';
    ruledOut.push({ key: 'command-files-present', label: 'command files present', status, detail });
  }());

  // (g) static precondition sweep (Task 1 helper) zero FAILs.
  (function () {
    const status = sweep.pass ? 'CLEAN' : 'FLAGGED';
    const detail = sweep.pass
      ? 'static precondition sweep passed (' + sweep.scanned + ' scanned, 0 FAIL)'
      : sweep.failures.length + ' precondition FAIL(s): ' + sweep.failures.map((f) => f.file + '[' + f.rule + ']').join(', ');
    ruledOut.push({ key: 'static-precondition-sweep', label: 'static precondition sweep', status, detail });
  }());

  return {
    mode: 'report-registration-bug',
    escalation: 'diagnostic only - escalate to Anthropic, nothing to fix locally',
    environment: {
      plugin_version_legs: versions,
      divergences,
      installed_plugins_version: IP,
      install_path: installPath,
      active_root: rootUsed,
      topology: (resolver && resolver.topology) || 'not-found',
      platform: process.platform,
      os_release: os.release(),
      claude_version: claudeVersion,
      command_count: commandCount,
      manifest_note: 'plugin.json declares NO `commands` field -- the standard auto-discovery contract every surveyed marketplace plugin uses; the failure is in the host registration of that contract, not the manifest',
    },
    ruled_out: ruledOut,
    control_test: 'a control test against another installed marketplace plugin\'s commands reproduced the identical failure -- the defect is not specific to this plugin',
    provenance: [
      '.planning/debug/every-mos-command-unknown.md',
      '.planning/debug/windows-install-update-ux.md',
    ],
  };
}

// Render the paste-ready human report from the data object.
function renderRegistrationBugText(data) {
  const env = data.environment;
  const lines = [];
  lines.push('=== MindrianOS command-registration -- paste-ready Anthropic bug report ===');
  lines.push('');
  lines.push(data.escalation.toUpperCase());
  lines.push('This is a plugin command-registration subsystem report. Root cause is a');
  lines.push('confirmed Claude Code host-side core bug: a valid install whose commands do');
  lines.push('not register. Every locally-checkable cause below is ruled out first.');
  lines.push('');
  lines.push('-- Environment facts --');
  const legs = env.plugin_version_legs || {};
  lines.push('  version legs: IP=' + legs.IP + ' AV=' + legs.AV + ' SR=' + legs.SR + ' LV=' + legs.LV + ' PB=' + legs.PB);
  lines.push('  version divergences: ' + (env.divergences && env.divergences.length ? env.divergences.length : 'none'));
  lines.push('  platform: ' + env.platform + ' / ' + env.os_release);
  lines.push('  Claude Code version: ' + (env.claude_version || 'fill in: run claude --version'));
  lines.push('  active plugin root: ' + env.active_root + ' (topology: ' + env.topology + ')');
  lines.push('  command files on disk: ' + env.command_count);
  lines.push('  manifest: ' + env.manifest_note);
  lines.push('');
  lines.push('-- Ruled out (each local cause proven CLEAN, or FLAGGED fix-locally-first) --');
  for (const r of data.ruled_out) {
    let line = '  [' + r.status + '] ' + r.label + ' -- ' + r.detail;
    if (r.status === 'FLAGGED') line += ' (fix locally first - this occurrence may not be the core bug)';
    lines.push(line);
  }
  lines.push('');
  lines.push('-- Control test --');
  lines.push('  ' + data.control_test);
  lines.push('');
  lines.push('-- Provenance (ruled-out SIBLING causes, distinct from this core bug) --');
  for (const p of data.provenance) lines.push('  ' + p);
  lines.push('');
  return lines.join('\n');
}

// Sibling dispatch entry. Always exits 0 when the report assembles (D-02);
// non-zero only if the assembler itself throws. stdout only (D-01).
function reportRegistrationBug(flags) {
  try {
    const data = assembleRegistrationBugData();
    if (flags.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    } else {
      process.stdout.write(renderRegistrationBugText(data) + '\n');
    }
    return 0;
  } catch (e) {
    process.stderr.write('report-registration-bug assembler threw: ' + ((e && e.message) || 'unknown') + '\n');
    return 1;
  }
}

// Phase 225-02 (REQ-4, PD-2, Pitfall 2): compare two dotted numeric version
// strings by NUMERIC segments (not lexicographically -- '3.51.10' must NOT sort
// before '3.51.3'). Returns true when a < b. Zero new dependencies (CLAUDE.md:
// CJS only, node built-ins only; this deliberately does NOT reuse the `semver`
// import above because the SQLite version literal is a plain numeric triple and
// a hand-rolled segment compare has no prerelease/caret semantics to get wrong).
// Any non-string / unparseable input returns false, so a garbage version can
// never fire the advisory.
function _sqliteVersionLt(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const pa = a.split('.');
  const pb = b.split('.');
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const na = parseInt(pa[i], 10);
    const nb = parseInt(pb[i], 10);
    const va = Number.isFinite(na) ? na : 0;
    const vb = Number.isFinite(nb) ? nb : 0;
    if (va < vb) return true;
    if (va > vb) return false;
  }
  return false;
}

// Phase 225-02 (REQ-4, PD-2): the WAL-reset corruption advisory. Fires ONLY when
// the bundled SQLite is inside the upstream WAL-reset corruption window
// (< 3.51.3, fixed upstream in commit 298a1c84) AND a live co-session is present
// in this room (the 2-connection precondition the race needs). This is
// detect-only by design: the two Phase-218 SQLite issues split as (a) SQLITE_BUSY
// contention -- already FIXED by 218 D-05 (busy_timeout + synchronous=NORMAL) --
// and (b) the WAL-reset checkpoint race, which is UPSTREAM and code-unfixable here
// because Node bundles SQLite (Pitfall 2). PD-2: no extraction-worker guard ships
// this phase (the drain worker files are Phase 224's in-flight surface); the
// honest move is a cheap doctor advisory, never a block.
//
// opts { roomDir, sessionId, home, sqliteVersion, hasCoSession } -- sqliteVersion
// and hasCoSession are INJECTABLE test seams. Production defaults resolve inside
// the single try/catch: sqliteVersion via an in-memory node:sqlite probe (zero
// user bytes), hasCoSession via a lazy require of session-presence.cjs called
// with { roomDir, sessionId } so the CURRENT binding session excludes itself as
// its own co-session. Returns a WARN finding string on fire; returns null on
// no-fire OR on ANY fault (probe throws, node:sqlite absent, presence read
// fails). The whole body is one try/catch returning null in catch -- the advisory
// can never crash or block a bind (never-block, T-194-19).
function _walResetAdvisory(opts) {
  try {
    opts = opts || {};
    let version = opts.sqliteVersion;
    if (typeof version !== 'string') {
      const { DatabaseSync } = require('node:sqlite');
      version = new DatabaseSync(':memory:').prepare('select sqlite_version() as v').get().v;
    }
    if (!_sqliteVersionLt(version, '3.51.3')) return null;

    let hasCo = opts.hasCoSession;
    let coPresent;
    if (typeof hasCo === 'function') {
      coPresent = hasCo({ roomDir: opts.roomDir, sessionId: opts.sessionId, home: opts.home });
    } else {
      const presence = require(path.join(__dirname, '..', 'lib', 'core', 'session-presence.cjs'));
      coPresent = presence.hasCoSession({ roomDir: opts.roomDir, sessionId: opts.sessionId, home: opts.home });
    }
    if (!coPresent) return null;

    return 'WARN: bundled SQLite ' + version + ' is inside the WAL-reset corruption ' +
      'window (fixed in 3.51.3) and a live co-session is present in this room; ' +
      'concurrent checkpoints can corrupt room.db (Phase 218 finding, commit 298a1c84)';
  } catch (_) {
    // Never-block, never-crash: any fault degrades to no-finding.
    return null;
  }
}

function main() {
  const flags = parseArgs(process.argv.slice(2));

  // Phase 194-07 (PSB-14 / PSB-13 / D-10): --bind-check <roomDir> runs the
  // BIND-TIME local room-health job and rides the stale-reap cadence. Its
  // contract is NEVER-BLOCK: it ALWAYS exits 0 (an unhealthy room degrades to an
  // advisory; binding is never hard-blocked -- T-194-19). It composes
  // session-presence.runBindCheck (LOCAL structural check + presence
  // registerPresence on green) and session-presence.reap (dead/stale presence
  // sweep). ZERO Brain call (Part 8): this is dispatched BEFORE the class-flag
  // block and BEFORE --acceptance so the Brain-smoke never runs on a bind.
  if (flags.bindCheck) {
    const presence = require(path.join(__dirname, '..', 'lib', 'core', 'session-presence.cjs'));
    const roomDir = flags.bindCheckDir;
    const sessionId = process.env.CLAUDE_SESSION_ID || ('cli-' + process.pid);
    const home = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT || undefined;
    let report;
    try {
      report = presence.runBindCheck({ sessionId: sessionId, roomDir: roomDir, home: home });
    } catch (_) {
      report = { healthy: false, bound: [], primary: null, onScope: false, findings: ['bind-check-error'] };
    }
    // Quick-task 20260702: WRITE the LOCAL room-health cache the shipped
    // cockpit-signals reader consumes, so the statusline health glyph goes LIVE
    // (closes the 192-04 room-health NAMED DEBT: the READ path shipped, the WRITE
    // path did not). Maps this bind-check report to sound|drift|broken. LOCAL only
    // (Part 8), fully guarded so a persist failure never affects the never-block
    // bind contract. Written to HOME/.mindrian (the reader's path), NOT the rooms
    // home, so the hot-path reader picks it up unchanged.
    try {
      const roomHealthCache = require(path.join(__dirname, '..', 'lib', 'statusline', 'room-health-cache.cjs'));
      roomHealthCache.persistRoomHealth(roomHealthCache.statusFromBindReport(report));
    } catch (_healthErr) { /* graceful: reader keeps returning the byte-stable default */ }
    // Phase 225-02 (REQ-4, PD-2): WAL-reset corruption advisory. Runs AFTER the
    // room-health-cache persist so the statusline glyph maps the UNMODIFIED
    // report. This is a findings-row WATCH item only: it NEVER touches
    // report.healthy (the WAL window is an environment condition the user cannot
    // repair locally, so flipping healthy would wrongly degrade the room-health
    // glyph) and NEVER changes the exit code (the block still ends in the
    // unconditional process.exit(0) below -- never-block, T-194-19).
    try {
      const walFinding = _walResetAdvisory({ roomDir: roomDir, sessionId: sessionId, home: home });
      if (typeof walFinding === 'string' && walFinding.length > 0) {
        if (!Array.isArray(report.findings)) report.findings = [];
        report.findings.push(walFinding);
      }
    } catch (_walErr) { /* never-block: the advisory can never affect the bind */ }
    if (flags.json) {
      console.log(JSON.stringify(report));
    } else {
      console.log((report.healthy ? 'OK' : 'ADVISORY') + '  doctor --bind-check: ' + (roomDir || '(no room dir)'));
      for (const f of (report.findings || [])) console.log('  - ' + f);
      if (report.healthy) console.log('  presence registered for session ' + sessionId);
    }
    // Stale-reap on the bind-time cadence (D-08 half + T-194-21): drop dead-pid
    // or mtime>5m presence files for this room. A live pid is never reaped. This
    // is keyed to bind-time + reconcile, NEVER per-turn.
    try {
      if (roomDir) presence.reap({ roomDir: roomDir });
    } catch (_) {}
    process.exit(0); // never-block: an unhealthy bind still exits 0 (advisory).
    return;
  }

  // Phase 123 Plan-04: release-gate runner. --acceptance has its own exit-
  // code contract (0 = all points passed; 1 = any point failed); HARD ABORT
  // -- no --allow override (per CONTEXT D-16: release infra is the one gate
  // you cannot skip). The class-flag-always-exit-0 invariant does NOT apply.
  // Dispatched BEFORE the class-flag block so the existing per-class drift
  // detectors do not run twice (the doctor-all sub-check spawns ourselves
  // with --all for that, in a child process).
  if (flags.acceptance) {
    const home = process.env.HOME || process.env.USERPROFILE || HOME;
    runAcceptance({
      home: home,
      pluginRoot: PLUGIN_ROOT,
      flagPreTag: flags.preTag,
      flagPreFlight: flags.preFlight,
      flagLightNpx: flags.lightNpx,
    }).then(function (result) {
      // Per-point status lines (human-readable).
      for (const p of result.points) {
        const tag = p.ok ? 'PASS' : 'FAIL';
        const findingSuffix = p.finding ? '  -- ' + p.finding : '';
        console.log(tag + '  ' + p.id + ': ' + p.label + findingSuffix);
      }
      console.log('');
      const failSuffix = result.failed_points.length
        ? '; failed: ' + result.failed_points.join(', ')
        : '';
      console.log('Acceptance ' + result.mode + ': ' + result.summary.passed + '/' + result.summary.total + ' points passed' + failSuffix + '.');
      // Phase 126 Plan 03: persist last_acceptance_run into install-state v2
      // (additive; best-effort). The write happens BEFORE the final exit so
      // even on failed --acceptance the state captures the run. Failure to
      // write (e.g., install-state.json absent OR migrator throws) emits a
      // stderr note but does NOT crash --acceptance. Plan 07's v2 schema
      // carries the `last_acceptance_run: { timestamp, passed, failed }`
      // field; migrateIfNeeded promotes v1 -> v2 transparently if needed.
      // Canon Part 8: LOCAL file I/O only ($HOME/.mindrian/). Zero network.
      try {
        const installStateMod = require(path.join(__dirname, '..', 'lib', 'core', 'install-state.cjs'));
        // Migration is idempotent: v1 -> v2 additive; v2 no-op; future-version
        // returns futureVersion:true without touching the file (Plan 07 D3).
        installStateMod.migrateIfNeeded({ home: home });
        const current = installStateMod.readInstallState({ home: home });
        if (current) {
          const updated = Object.assign({}, current, {
            last_acceptance_run: {
              timestamp: new Date().toISOString(),
              passed: result.summary.passed,
              failed: result.summary.failed,
            },
          });
          installStateMod.writeInstallState({ home: home, state: updated });
        }
        // No-op when install-state.json is absent (readInstallState returns
        // null) -- the record is session-start's responsibility to create.
      } catch (err) {
        process.stderr.write('[doctor --acceptance] failed to persist last_acceptance_run: ' + (err && err.message) + '\n');
      }
      if (flags.json) console.log(JSON.stringify(result, null, 2));
      process.exit(result.failed_points.length === 0 ? 0 : 1);
    }).catch(function (e) {
      console.error('acceptance runner threw: ' + (e && e.message));
      if (flags.json) console.log(JSON.stringify({ mode: flags.preTag ? 'pre-tag' : (flags.preFlight ? 'pre-flight' : 'full'), error: e && e.message, points: [], failed_points: ['__runner__'], summary: { total: 0, passed: 0, failed: 1 } }, null, 2));
      process.exit(1);
    });
    return;
  }

  // Phase 146 Plan 04: --dogfood-acceptance loop-fires gate. Has its OWN
  // exit-code contract (0 = all 6 ACPT hermetic legs passed; non-zero = a leg
  // failed) -- per the ROADMAP Phase 146 mandate, exit 0 = the milestone ships
  // as "Larry Reaches", non-zero = the milestone is renamed. NOT a class flag;
  // the class-flag-always-exit-0 invariant does NOT apply. Dispatched BEFORE the
  // class-flag block so the own-contract exit code wins. Canon Part 8: spawns
  // LOCAL ACPT drivers only; zero network surface in doctor itself; the gate
  // never requires a reachable Brain (ACPT-05 live mode_a self-skips).
  // Phase 150-08 (MEM-09 / D-09): --claims is the CLAIM HARNESS gate, a SIBLING
  // of --acceptance with its OWN exit-code contract (0 = every public-site claim
  // is true by instrumentation; non-zero = a claim failed). Dispatched BEFORE the
  // class-flag block so the own-contract exit code wins; NOT a class flag, so the
  // class-flag-always-exit-0 invariant does NOT apply. Canon Part 8: the harness
  // is LOCAL/hermetic; the Brain LIVE arms self-skip via class-m-brain-smoke, so
  // the gate never requires a reachable Brain. The DOCTOR_CLAIM_FAIL_POINT env
  // hook synthesizes the failure path for the gate's own self-test.
  if (flags.claims) {
    const result = runClaims({ pluginRoot: PLUGIN_ROOT });
    if (result.ok) {
      console.log('PASS  claims: the claim harness is green (every public-site claim is true by instrumentation).');
    } else {
      console.log('FAIL  claims: ' + (result.finding || 'the claim harness failed') + '.');
      if (result.stdoutTail) console.log(result.stdoutTail);
    }
    if (flags.json) console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
    return;
  }

  if (flags.dogfoodAcceptance) {
    runDogfoodAcceptance({ pluginRoot: PLUGIN_ROOT }).then(function (result) {
      for (const p of result.points) {
        const tag = p.ok ? 'PASS' : 'FAIL';
        const findingSuffix = p.finding ? '  -- ' + p.finding : '';
        console.log(tag + '  ' + p.id + ': ' + p.label + findingSuffix);
      }
      console.log('');
      const failSuffix = result.failed_points.length
        ? '; failed: ' + result.failed_points.join(', ')
        : '';
      console.log('Dogfood acceptance (loop-fires gate): ' + result.summary.passed + '/' + result.summary.total + ' ACPT points passed' + failSuffix + '.');
      if (result.failed_points.length === 0) {
        console.log('Exit 0: the milestone ships as "Larry Reaches".');
      } else {
        console.log('Non-zero: the milestone is renamed (a loop-fires leg failed).');
      }
      if (flags.json) console.log(JSON.stringify(result, null, 2));
      process.exit(result.summary.failed > 0 ? 1 : 0);
    }).catch(function (e) {
      console.error('dogfood-acceptance gate threw: ' + (e && e.message));
      if (flags.json) console.log(JSON.stringify({ gate: 'dogfood-acceptance', error: e && e.message, points: [], failed_points: ['__runner__'], summary: { total: 0, passed: 0, failed: 1 } }, null, 2));
      process.exit(1);
    });
    return;
  }

  // Phase 127.2-03 Task 2 (Findings F1 + F7): --check-rs-engine pre-flight.
  //
  // Probes top-level Python imports reachable from scripts/rs-engine.py
  // (the Engine 1 Act 1 surface for /mos:find-bottlenecks, /mos:whitespace,
  // /mos:find-connections, /mos:find-analogies, /mos:score-innovation). The
  // Windows tester 2026-05-23 silent-failure root cause is `requests` (a
  // transitive dep via lib/core/rs_corpus.py) missing from the runtime
  // python. This dispatch lands BEFORE the class A-M flow so the gate is
  // standalone -- it has its own exit-code contract (0 = ready, 1 = missing
  // deps), distinct from the class-flag-always-exit-0 invariant.
  //
  // SCOPE GUARD (CONTEXT): ADD-ONLY -- this dispatcher does NOT touch any
  // existing acceptance point, UI-compliance check, statusline check, or
  // session-start logic. It is a sibling of --brain-smoke (class M) in
  // shape but not in classification (not a class flag).
  if (flags.checkRsEngine) {
    runCheckRsEngine(flags).then(function (code) {
      process.exit(code);
    }).catch(function (e) {
      // Defensive: any uncaught error inside the probe surfaces as exit 1
      // with a hint so /mos:doctor's other gates are never crashed by a
      // broken probe implementation.
      console.error('check-rs-engine probe threw: ' + (e && e.message));
      if (flags.json) {
        console.log(JSON.stringify({ ok: false, error: (e && e.message) || 'unknown', fix: 'Run: pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH)' }, null, 2));
      }
      process.exit(1);
    });
    return;
  }

  // Quick task 260705-jeq: --report-registration-bug dispatch (D-01, D-02).
  //
  // Sibling of --check-rs-engine in SHAPE (own dispatch, own exit contract) but
  // a diagnostic REPORTER, not a probe: it assembles a paste-ready Anthropic bug
  // report proving every locally-checkable registration cause is CLEAN. Exit 0
  // whenever the report assembles (even offline); non-zero only if the assembler
  // throws. Honors flags.json inline. NOT in --all (see parseArgs rationale).
  //
  // SCOPE GUARD: ADD-ONLY -- touches no existing acceptance point, class check,
  // or session-start logic. Every fact reuses an existing collector (Part 7).
  if (flags.reportRegistrationBug) {
    process.exit(reportRegistrationBug(flags));
    return;
  }

  // Phase 127.2 Plan 04 Instance #7: --post-update dispatch.
  //
  // Delegates to scripts/post-update-activation.cjs which (a) detects the
  // freshly-landed cache-staging dir, (b) atomically swaps via the existing
  // --fix pipeline (Phase 95.2; three autopsies of hardening), (c) writes
  // the ~/.mindrian/post-update-restart-pending touch-file so the next
  // session's sessionstart-post-update-preflight.cjs can verify activation
  // reached the wire (Class N acceptance, see buildAcceptanceChecklist).
  //
  // SCOPE GUARD: ADD-ONLY -- does not touch any existing acceptance point,
  // UI-compliance check, or session-start hook. Composable with --fix: when
  // both flags pass we spawn post-update-activation.cjs which itself spawns
  // doctor.cjs --fix --json (the existing chain) so the atomic-swap logic
  // is exercised through ONE canonical code path. Closes Canon Part 7
  // (reuse before build) on the activation-reached-the-wire surface.
  if (flags.postUpdate) {
    try {
      const activator = require(path.join(__dirname, 'post-update-activation.cjs'));
      activator.activatePostUpdate({}).then(function (result) {
        if (flags.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          process.stdout.write(activator.renderActionReport(result));
        }
        process.exit(result.ok ? 0 : 1);
      }).catch(function (e) {
        if (flags.json) {
          console.log(JSON.stringify({ ok: false, error: (e && e.message) || 'unknown' }, null, 2));
        } else {
          console.error('post-update activation threw: ' + (e && e.message));
        }
        process.exit(1);
      });
    } catch (e) {
      if (flags.json) {
        console.log(JSON.stringify({ ok: false, error: 'failed to load post-update-activation: ' + (e && e.message) }, null, 2));
      } else {
        console.error('failed to load post-update-activation: ' + (e && e.message));
      }
      process.exit(1);
    }
    return;
  }

  // Phase 127-02 BRAIN-MCP-127-08: --brain-smoke (class M) dispatch.
  //
  // Phase 217 carve-out: brain-smoke (class M) stays special-cased as an async
  // dispatch block and is NOT migrated to a registry runner. The accumulative
  // engine loop is SYNCHRONOUS (it calls check(ctx) and consumes the return
  // value inline); class M is an async 6-layer network probe (Promise-based,
  // with the Windows-safe process.exitCode teardown below). Migrating it would
  // require an async engine pass, deliberately not taken during the 211-217
  // release window (217-RESEARCH Pitfall 2, CONTEXT discretion clause A2:
  // lower-risk call under release pressure).
  //
  // The 6-layer probe is dispatched here BEFORE the class A-L flow so the
  // output is the canonical { class:"M", ok, layers:[6], overall_ms } shape
  // (consumed by tests/test-127-02-doctor-class-m.sh). When combined with
  // --all, this branch still owns the output; the other class checks run
  // under it via a parallel promise chain, but for the standalone case
  // (which is the primary user surface) the doctor exits after Class M
  // alone. Class-flag invariant applies: exit 0 even on FAIL.
  if (flags.brainSmoke && !flags.eurekaSmoke && !flags.cascadeRooms && !flags.verifySurface
      && !flags.roomMd && !flags.uiCompliance && !flags.statuslineVisibility
      && !flags.installState && !flags.staleFirstTouch && !flags.deprecatedUsage
      && !flags.all) {
    // Debug session doctor-brain-smoke-win-crash (2026-05-30): a synchronous
    // process.exit() here tore down a still-open libuv handle (the undici
    // keep-alive TLS socket left un-released by the L3 schema probe on a
    // 401/403 key-rejected path) MID-CLOSE, which asserts on Windows in
    // src/win/async.c (UV_HANDLE_CLOSING) and surfaces to the Claude Code Bash
    // wrapper as "Exit code 127". Setting process.exitCode and returning lets
    // the event loop drain every outstanding handle the OS-safe way, then the
    // process exits naturally with the requested code. This covers ALL handle
    // variants (socket, timer, child) and is correct on Windows/macOS/Linux.
    // The class-flag invariant (exit 0 even on per-layer FAIL) is preserved:
    // classMBrainSmoke() returns 0, asserted by tests/test-127-02-doctor-class-m.sh T3.
    classMBrainSmoke(flags).then(function (code) {
      process.exitCode = code;
    }).catch(function (e) {
      console.error('class-m smoke threw: ' + (e && e.message));
      if (flags.json) console.log(JSON.stringify({ class: 'M', ok: false, error: e && e.message, layers: [], overall_ms: 0 }, null, 2));
      // Class-flag invariant: exit 0 even on internal error.
      process.exitCode = 0;
    });
    return;
  }

  // Phase 217 carve-out: eureka-smoke (class S) stays special-cased as an async
  // dispatch block and is NOT migrated to a registry runner, for the same reason
  // as class M: the accumulative engine loop is synchronous and class S is an
  // async 4-layer local-embedding-stack probe. Migrating it requires an async
  // engine pass, deliberately not taken during the 211-217 release window
  // (217-RESEARCH Pitfall 2, CONTEXT discretion clause A2).
  //
  // quick(260706-13z) D14: --eureka-smoke (class S) standalone dispatch. Mirrors
  // the class-M block exactly, including the process.exitCode-not-process.exit
  // Windows-safe teardown (2026-05-30 RCA) and the class-flag invariant (exit 0
  // even on per-layer FAIL). The !flags.brainSmoke guard lets a combined
  // --brain-smoke --eureka-smoke run fall through to the --all-style merge.
  if (flags.eurekaSmoke && !flags.brainSmoke && !flags.cascadeRooms && !flags.verifySurface
      && !flags.roomMd && !flags.uiCompliance && !flags.statuslineVisibility
      && !flags.installState && !flags.staleFirstTouch && !flags.deprecatedUsage
      && !flags.all) {
    classSEurekaSmoke(flags).then(function (code) {
      process.exitCode = code;
    }).catch(function (e) {
      console.error('class-s smoke threw: ' + (e && e.message));
      if (flags.json) console.log(JSON.stringify({ class: 'S', ok: false, error: e && e.message, layers: [], overall_ms: 0 }, null, 2));
      // Class-flag invariant: exit 0 even on internal error.
      process.exitCode = 0;
    });
    return;
  }

  const installResult = checkInstallVersion();
  const cacheResult = checkMarketplaceCache();
  const devResult = checkDevSourceConsistency();

  // Detect whether any class B/C/D/E/F/G/I/J flag was activated -- when YES the
  // doctor run is in "class-flag mode" (graceful degradation per Canon Part
  // 8 invariant): class A install/cache issues become informational, never
  // hard exits, and warnings from new checks return 0 unless --fix-failed.
  const classFlagsActive = flags.cascadeRooms || flags.verifySurface
    || flags.roomMd || flags.uiCompliance || flags.statuslineVisibility
    || flags.cardFireHealth
    || flags.installState || flags.staleFirstTouch || flags.deprecatedUsage
    || flags.brainSmoke || flags.eurekaSmoke || flags.drift
    || flags.graphDeriveHealth;
    // ^ Phase 150.9 Plan-02: registering flags.drift here honors the
    //   graceful-degradation exit-0 invariant. This is what preserves the
    //   marketplace-cache-drift-deadlock carve-out automatically: that carve-out
    //   lives in Class A's checkInstallVersion() which --drift never touches, and
    //   classFlagsActive forces _finalizeAndExit to exit 0 (so a detected install
    //   drift never flips a --drift run to exit 1). Per D-04 + the CONTEXT
    //   discretion ruling.

  const report = {
    install: installResult,
    cache: cacheResult,
    dev: devResult,
    drift: { detected: false },
    fixRequested: flags.fix,
    classARecovered: null, // class A install-cache recovery result (single object)
    recoveryError: null,
    recoverySkipped: null, // set when --fix drift recovery is skipped BY DESIGN
                           // (marketplace-cache topology; RCA
                           // doctor-marketplace-cache-drift-deadlock). Stable
                           // JSON shape for consumers (post-update activator).
    checks: {},     // class B/C/D/E/F results land here.
    recovered: [],  // unified array of recovery records across all classes.
  };

  // Drift detection (class A) -- widened in Phase 95.2 D-05/D-06.
  if (installResult.status === 'ok' && cacheResult.status === 'ok') {
    if (installResult.parsed && cacheResult.latestParsed) {
      const cmp = cmpVersion(installResult.parsed, cacheResult.latestParsed);
      report.drift = {
        detected: cmp < 0,
        compare: cmp,
      };
    }
  } else if (installResult.status === 'missing'
             && cacheResult.status === 'ok'
             && cacheResult.versions
             && cacheResult.versions.length > 0
             && resolveActivePluginRoot().topology !== 'marketplace-cache') {
    // Phase 95.2 D-05: missing install with available cache is a recoverable drift case.
    // Topology guard (debug session doctor-class-a-drift-topology-blind-false-positive,
    // 2026-05-31): installResult is computed against the hardcoded legacy INSTALL_DIR
    // (line 55, ~/.claude/plugins/mindrian-os). Under marketplace-cache topology that
    // legacy dir is CORRECTLY absent -- Claude Code loads the plugin from the cache
    // path recorded in installed_plugins.json -- so a missing legacy dir is the healthy
    // state, not drift. resolveActivePluginRoot() only returns a marketplace-cache root
    // when that root passed isPluginDir() (a valid .claude-plugin/plugin.json), so the
    // marketplace-cache topology already implies a healthy resolved active root. This
    // guard makes class A agree with the topology-aware class I gate (--install-state)
    // while preserving the legacy-topology recovery path: a genuinely-missing legacy
    // active root (topology !== marketplace-cache) still reports install-missing drift.
    report.drift = { detected: true, reason: 'install-missing' };
  }

  // Phase 95.2 D-07: install.recoverable (pure addition; preserves byte-stability of existing fields).
  // True iff the cache holds at least one valid version. Lets automation distinguish
  // 'can fix automatically' from 'needs manual intervention' without parsing cache.versions[].
  report.install.recoverable = (cacheResult.status === 'ok' && cacheResult.versions && cacheResult.versions.length > 0);

  // Phase 217 carve-out: class A (install-cache) stays special-cased in main()
  // and is NOT migrated to a registry runner. Its results live OUTSIDE
  // report.checks (report.install / report.cache / report.drift /
  // report.classARecovered), its recovery is the atomic-swap path, and
  // _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult)
  // consumes cacheResult + installResult POSITIONALLY -- the exit-code contract
  // is structurally coupled to main(). Forcing it into the uniform module shape
  // would restructure the most-tested path days before the 211-217 release. Its
  // three pure constituent readers (checkInstallVersion, checkMarketplaceCache,
  // checkDevSourceConsistency) already left the monolith into
  // lib/core/doctor/shared.cjs in 217-01. Full migration is future work, per
  // 217-RESEARCH Open Question 3.
  //
  // Class A recovery (existing behavior preserved; result also pushed onto
  // the unified report.recovered array for class B/C/D/E/F co-existence).
  // Phase 95.2 D-01..D-04: now uses performRecoveryAtomic with two-step atomic-swap.
  // Phase 123 Plan-03 carve-out: when --install-state (class I) is active,
  // class A's `--fix` is suppressed. Class I owns the legacy-migration
  // semantics (backup-then-verify-then-remove with the dev-clone safety belt
  // and the dirty/unpushed refuse checks per D-13). Without this carve-out
  // class A would migrate the legacy dir AHEAD of class I, defeating the
  // dirty-legacy refuse contract.
  // Resolve the active topology ONCE for both the recovery gate and the
  // skipped-by-design branch (RCA doctor-marketplace-cache-drift-deadlock:
  // the prior double-call pattern made the gate and the drift detector read
  // two different sources of truth).
  const activeTopologyAtGate = resolveActivePluginRoot().topology;
  if (flags.fix && report.drift.detected && !flags.installState
      && activeTopologyAtGate !== 'marketplace-cache') {
    // Defense-in-depth (debug session doctor-class-a-drift-topology-blind-false-positive,
    // 2026-05-31): with the Change-1 topology guard above, drift.detected is already
    // false for the healthy marketplace-cache case so this gate is not reached for it.
    // This redundant topology check ensures a future regression in the drift branch
    // cannot re-enable performRecoveryAtomic recreating the legacy ~/.claude/plugins/
    // mindrian-os dir under marketplace-cache topology (which class I would then flag
    // as a migration candidate -- the two subsystems must never contradict).
    const result = performRecoveryAtomic(installResult.version, cacheResult.latest);
    if (result.status === 'ok') {
      report.classARecovered = result;
      report.recovered.push({ tool: 'install-cache', status: 'ok', version: result.recoveredVersion, backup: result.backup });
    } else {
      report.recoveryError = result.detail;
      // Phase 95.2 D-03: distinguish rollback exit (code 4) from regular failure (code 1).
      if (result.exitCode === 4 || result.stage === 'commit-rollback') {
        report.recoveryRolledBack = true;
      }
    }
  } else if (flags.fix && report.drift.detected && !flags.installState
      && activeTopologyAtGate === 'marketplace-cache') {
    // RCA doctor-marketplace-cache-drift-deadlock (2026-06-12): the topology
    // check is what blocked recovery. Record the skip instead of silently
    // falling through -- a silent skip left classARecovered AND recoveryError
    // both null, which rendered as the useless 'recovery failed: unknown' and
    // tripped the unconditional drift exit-1 in _finalizeAndExit (the
    // permanent /mos:update Step 7 deadlock). Skipped-by-design is NOT
    // failure: the renderer and the exit finalizer both read this field.
    report.recoverySkipped = {
      reason: 'topology-marketplace-cache',
      detail: 'recovery skipped by design: active topology is marketplace-cache; the legacy install dir is vestigial and class A will not touch it (class I owns legacy migration)',
    };
  }

  // Class B + C: cascade-rooms (sentinel + active-room guard silence) migrated to
  // registry-driven cadence:always runners (Phase 217 Plan 04). The accumulative
  // engine now owns cascade-rooms + cascade-rooms-active under the --cascade-rooms
  // flag; class B's --fix (never wired pre-217) lives in the runner's fix(ctx).

  // Class D (verify-surface), class G (statusline-visibility), and class H
  // (install-incomplete) migrated to registry-driven cadence:always runners
  // (Phase 217 Plan 05). The accumulative engine now owns:
  //   - verify-surface under --verify-surface (check-only, fix_supported false);
  //   - statusline-visibility + install-incomplete under --statusline-visibility
  //     (H shares G's flag, today's exact behavior: --statusline-visibility
  //     surfaces both, --all surfaces both);
  // and the engine's fix-then-recheck flow owns what the old hand-wired G/H --fix
  // dispatches did (G gate: warn AND recoverable !== false; H's stricter
  // recoverable === true gate is enforced runner-internally in its fix(ctx)).

  // Class I (install-state) + Class J (deployment-surfaces) migrated to
  // registry-driven cadence:always runners (Phase 217 Plan 06). The
  // accumulative engine now owns both under the --install-state flag (they share
  // it, exactly as this block did): install-state runs first so class J reads
  // its same-invocation result via ctx.checks['install-state']; each fix's
  // recoveries[] land on report.recovered through the engine glue. The class-A
  // BUG 7 reinterpretation that used to close this block (it reads class I's
  // topology to downgrade an expected-absent legacy clone) is relocated to AFTER
  // the engine populates report.checks['install-state'] (see below).


  // Class P: prose-vs-code / product-claims drift (Phase 150.9 Plan-02;
  // Fable v1.13.1 audit track 1). REPORT-ONLY (D-03): NEVER edits any prose
  // .md file, even under --fix. Wraps the two shipped checkers (Canon Part 7
  // reuse -- repoints, does NOT reimplement):
  //   - check-skill-vs-code-drift.cjs : require().check() (clean, no exit)
  //   - check-first-touch-drift.cjs   : spawned as a SUBPROCESS (Pitfall 1 --
  //                                     it is CLI-only and self-exits, so a
  //                                     require() would kill doctor mid-run).
  // OPT-IN ONLY (D-04): gated strictly behind flags.drift, NEVER behind
  // !classFlagsActive. Pure LOCAL: file reads + a LOCAL node subprocess; zero
  // network, zero Brain, zero telemetry (Canon Part 8). Soft-fail: a throw
  // records an error finding, never crashes doctor.
  if (flags.drift) {
    try {
      // (a) skill-vs-code drift -- require-clean.
      let skillResult = null;
      let skillErr = null;
      try {
        const { check } = require(path.join(__dirname, 'check-skill-vs-code-drift.cjs'));
        skillResult = check();
      } catch (e) {
        skillErr = (e && e.message) || 'skill-vs-code check threw';
      }

      // (b) first-touch drift -- SUBPROCESS (Pitfall 1). Capture exit code
      // (1 = drift, 0 = clean) + parse the "DRIFT:" stdout lines. We pass the
      // child the SAME process.env so a test's MOS_TEST_SCAN_DIR fixture flows
      // through. Fixed arg array (no shell string).
      const ftPath = path.join(__dirname, 'check-first-touch-drift.cjs');
      const cp = require('child_process');
      const ft = cp.spawnSync('node', [ftPath], { encoding: 'utf8', timeout: 30000 });
      const ftStdout = (ft && ft.stdout) || '';
      const firstTouchHits = ftStdout
        .split('\n')
        .filter((ln) => ln.indexOf('DRIFT:') === 0).length;
      const firstTouchDrift = ft && ft.status === 1;

      // Aggregate. skill drift = !valid; first-touch drift = exit 1 / hits > 0.
      const skillDrift = skillResult ? skillResult.valid === false : false;
      const anyDrift = skillDrift || firstTouchDrift;

      const detailParts = [];
      if (skillErr) detailParts.push('skill-vs-code check error: ' + skillErr);
      else if (skillDrift) detailParts.push('skill-vs-code drift (SKILL.md disagrees with shipped code)');
      if (firstTouchDrift) detailParts.push('first-touch drift: ' + firstTouchHits + ' hit(s)');
      if (!anyDrift && !skillErr) detailParts.push('prose-vs-code surfaces clean');

      report.checks['prose-vs-code'] = {
        class: 'P',
        // REPORT-ONLY: status is ok|warn (never a --fix that rewrites prose).
        // A checker that errored is surfaced as warn-with-detail, not a false ok.
        status: (anyDrift || skillErr) ? 'warn' : 'ok',
        detail: detailParts.join('; '),
        skill_findings: skillResult || null,
        skill_error: skillErr,
        first_touch_hits: firstTouchHits,
        first_touch_drift: !!firstTouchDrift,
        report_only: true,
      };
    } catch (err) {
      report.checks['prose-vs-code'] = {
        class: 'P',
        status: 'error',
        detail: (err && err.message) || 'class P threw',
        first_touch_hits: 0,
        report_only: true,
      };
    }
  }

  // Class Q: GSD execution-record drift (Phase 150.9 Plan-02; the W007/I001
  // class Fable ran by hand). SHELLS OUT to `gsd-tools validate health --raw`
  // (D-02 -- single source of truth; does NOT reimplement the ROADMAP/SUMMARY
  // scan) and parses W007 (ROADMAP drift) + I001 (missing SUMMARYs). OPT-IN
  // ONLY (D-04): gated behind flags.drift. Pure LOCAL: spawns a LOCAL node
  // subprocess (gsd-tools), zero network / zero Brain (Canon Part 8 -- the
  // spawnSync('node', [...'validate','health']) is a local subprocess, not a
  // network call). Pitfalls handled: 2 (shape-assert before reading; error not
  // false-clean), 3 (cwd = repo root, treat broken/error health as
  // indeterminate). Soft-fail + locator-skip: never crashes doctor.
  if (flags.drift) {
    try {
      const driftRepoRoot = path.resolve(__dirname, '..');
      const gsdToolsPath = resolveGsdTools();
      if (!gsdToolsPath) {
        report.checks['gsd-record-drift'] = {
          class: 'Q',
          status: 'skip',
          detail: 'gsd-health unavailable (gsd-tools.cjs not found via the resolver order) -- W007/I001 scan skipped',
          w007: [],
          i001: [],
        };
      } else {
        const cp = require('child_process');
        // T-150.9-03 mitigation: FIXED arg array (never a shell string); no
        // interpolation of untrusted input. cwd = repo root (Pitfall 3).
        const hr = cp.spawnSync('node', [gsdToolsPath, 'validate', 'health', '--raw'], {
          cwd: driftRepoRoot,
          encoding: 'utf8',
          timeout: 60000,
        });
        let health = null;
        let parseErr = null;
        try {
          health = JSON.parse((hr && hr.stdout) || '');
        } catch (e) {
          parseErr = (e && e.message) || 'JSON parse failed';
        }

        if (parseErr || !health || typeof health !== 'object'
            || !Array.isArray(health.warnings) || !Array.isArray(health.info)) {
          // Pitfall 2: shape unrecognized -> error, NOT a false clean.
          report.checks['gsd-record-drift'] = {
            class: 'Q',
            status: 'error',
            detail: 'gsd-health output shape unrecognized -- W007/I001 parse skipped'
              + (parseErr ? ' (' + parseErr + ')' : ''),
            w007: [],
            i001: [],
          };
        } else {
          const w007 = health.warnings.filter((w) => w && w.code === 'W007');
          const i001 = health.info.filter((i) => i && i.code === 'I001');
          // Pitfall 3: a broken/error top-level status is indeterminate -- surface
          // it rather than reporting clean when there are no parsed findings.
          const topStatus = String(health.status || '');
          const indeterminate = (topStatus === 'broken' || topStatus === 'error');
          let qStatus;
          if (w007.length || i001.length) qStatus = 'warn';
          else if (indeterminate) qStatus = 'error';
          else qStatus = 'ok';
          report.checks['gsd-record-drift'] = {
            class: 'Q',
            status: qStatus,
            detail: qStatus === 'warn'
              ? ('gsd-record drift: ' + w007.length + ' W007 (ROADMAP gap) + ' + i001.length + ' I001 (missing SUMMARY)')
              : (qStatus === 'error'
                ? ('gsd-health status "' + topStatus + '" -- record-drift indeterminate')
                : 'gsd execution records clean (no W007 / I001)'),
            health_status: topStatus,
            w007,
            i001,
          };
        }
      }
    } catch (err) {
      report.checks['gsd-record-drift'] = {
        class: 'Q',
        status: 'error',
        detail: (err && err.message) || 'class Q threw',
        w007: [],
        i001: [],
      };
    }
  }

  // Class R: RUNTIME-REACHABILITY drift (Phase 185, DRIFT-01). The assertion
  // Classes P + Q lack: P/Q do MERGE-TIME marking (prose-vs-code + gsd-record)
  // only -- neither checks whether a WIRED capability is actually REACHABLE by
  // decide() at runtime. Class R closes that gap (CIRS R9 -- doctor --drift is
  // the SCHEDULED reconciliation surface): it FAILS when a capability is WIRED
  // in the connector registry but the Phase-184 decide()-time projection READER
  // can never surface it. Unlike P (report-only prose) this is a HARD signal --
  // a runtime-unreachable WIRED capability flips doctor --drift to non-zero (the
  // narrow exit branch in _finalizeAndExit keys on this check's 'warn' status).
  //
  // Pure LOCAL (Canon Part 8): reads the connector registry + the orchestration
  // projection (both committed LOCAL artifacts) via the Phase-184 reader; zero
  // network egress. Reachability is computed DETERMINISTICALLY in code,
  // never by an LLM-judge. Soft-fail: a throw records an 'error' finding (exit
  // stays 0 -- an indeterminate computation is not a drift FAIL), never crashes
  // doctor. Hermetic test seams: MOS_TEST_REACHABILITY_REGISTRY /
  // MOS_TEST_REACHABILITY_PROJECTION inject fixture artifact paths.
  if (flags.drift) {
    try {
      const { checkRuntimeReachability } = require(
        path.join(__dirname, '..', 'lib', 'core', 'drift-runtime-reachability.cjs'));
      const rrOpts = {};
      if (process.env.MOS_TEST_REACHABILITY_REGISTRY) {
        rrOpts.registryPath = process.env.MOS_TEST_REACHABILITY_REGISTRY;
      }
      if (process.env.MOS_TEST_REACHABILITY_PROJECTION) {
        rrOpts.projectionPath = process.env.MOS_TEST_REACHABILITY_PROJECTION;
      }
      const rr = checkRuntimeReachability(rrOpts);
      report.checks['runtime-reachability'] = Object.assign({ class: 'R' }, rr);
    } catch (err) {
      report.checks['runtime-reachability'] = {
        class: 'R',
        status: 'error',
        detail: (err && err.message) || 'class R threw',
        wired_eligible: 0,
        reachable: 0,
        unreachable: [],
        report_only: false,
      };
    }
  }

  // --drift --fix HEAL ARM (D-03 heal-where-safe split). MECHANICAL drift
  // auto-heals: write the DRIFT.md baseline (root index + per-folder detail)
  // from the Class P + Class Q findings, and stub a missing SUMMARY for each
  // I001 record. JUDGMENT-CALL drift stays REPORT-ONLY: Class P prose findings
  // are recorded, NEVER auto-fixed. This arm MUST NOT call process.exit (exit
  // is _finalizeAndExit-only -- preserves the exit-0 invariant + the deadlock
  // carve-out). Soft-fail: a throw records a heal error, never crashes doctor.
  if (flags.drift && flags.fix) {
    try {
      const driftRepoRoot = path.resolve(__dirname, '..');
      const planningDir = path.join(driftRepoRoot, '.planning');
      const {
        writeDriftBaseline,
        stubMissingSummary,
      } = require(path.join(__dirname, '..', 'lib', 'core', 'drift-baseline.cjs'));

      // Build the finding set from Class P + Class Q results.
      const findings = [];
      const qRes = report.checks['gsd-record-drift'];
      if (qRes && Array.isArray(qRes.w007)) {
        for (const w of qRes.w007) {
          const phase = extractPhaseToken(w && w.message);
          findings.push({
            finding_id: 'W007-' + (phase || 'unknown'),
            track: 'gsd_record',
            severity: 'warn',
            status: 'open',
            source_class: 'Q',
            detail: (w && w.message) || 'ROADMAP gap',
            phase: phase,
            per_folder: !!phase,
          });
        }
      }
      const summaryStubs = [];
      if (qRes && Array.isArray(qRes.i001)) {
        for (const i of qRes.i001) {
          const planRef = extractPlanRef(i && i.message);
          const phase = planRef ? planRef.phase : null;
          findings.push({
            finding_id: 'I001-' + (planRef ? planRef.planLabel : 'unknown'),
            track: 'gsd_record',
            severity: 'info',
            status: 'open',
            source_class: 'Q',
            detail: (i && i.message) || 'missing SUMMARY',
            phase: phase,
            per_folder: !!phase,
          });
          if (planRef) summaryStubs.push(planRef);
        }
      }
      // Class P prose findings are recorded REPORT-ONLY in the root index; they
      // carry per_folder:false so the writer renders a (report-only) pointer and
      // never writes a prose file.
      const pRes = report.checks['prose-vs-code'];
      if (pRes && (pRes.status === 'warn')) {
        findings.push({
          finding_id: 'P-prose-vs-code',
          track: 'prose_vs_code',
          severity: 'high',
          status: 'open',
          source_class: 'P',
          detail: pRes.detail || 'prose-vs-code drift (report-only)',
          phase: null,
          per_folder: false,
        });
      }

      const healResult = { drift_md: null, summary_stubs: [], errors: [] };
      try {
        const wr = writeDriftBaseline({
          planningDir,
          findings,
          meta: {
            audit_date: new Date().toISOString().slice(0, 10),
            auditor: 'doctor --drift --fix (Class P + Q)',
            status: (qRes && qRes.health_status) || 'unknown',
            process_note: 'Bound per-agent scope, fan wider (Fable 600s watchdog lesson).',
          },
        });
        healResult.drift_md = { rootPath: wr.rootPath, wrote: wr.wrote };
      } catch (e) {
        healResult.errors.push('drift-baseline write: ' + ((e && e.message) || e));
      }
      // Stub missing SUMMARYs (I001 mechanical auto-heal).
      for (const ref of summaryStubs) {
        try {
          const phaseDir = findPhaseDir(driftRepoRoot, ref.phase);
          if (!phaseDir) {
            healResult.errors.push('no phase dir for ' + ref.phase + ' (' + ref.planFile + ')');
            continue;
          }
          const st = stubMissingSummary({ phaseDir, planFile: ref.planFile });
          healResult.summary_stubs.push({ path: st.path, created: st.created });
        } catch (e) {
          healResult.errors.push('summary stub ' + ref.planFile + ': ' + ((e && e.message) || e));
        }
      }
      report.checks['drift-heal'] = {
        class: 'Q',
        status: healResult.errors.length ? 'warn' : 'ok',
        detail: 'DRIFT.md baseline written; ' + healResult.summary_stubs.filter((s) => s.created).length
          + ' SUMMARY stub(s) created'
          + (healResult.errors.length ? '; ' + healResult.errors.length + ' heal error(s)' : ''),
        drift_md: healResult.drift_md,
        summary_stubs: healResult.summary_stubs,
        errors: healResult.errors,
        report_only_prose: true,
      };
    } catch (err) {
      report.checks['drift-heal'] = {
        class: 'Q',
        status: 'error',
        detail: (err && err.message) || 'drift heal arm threw',
        summary_stubs: [],
        errors: [(err && err.message) || 'threw'],
      };
    }
  }

  // Phase 127-02 BRAIN-MCP-127-08: Class M (Brain end-to-end smoke) under
  // combined runs (e.g. --all). The standalone --brain-smoke path is handled
  // earlier with its own canonical output shape; here we attach the result
  // into report.checks['brain-smoke'] so --all sees all classes in one
  // report. Async-to-sync bridge: run-and-finalize via promise chain.
  // Phase 139 Plan-02 (S2): the accumulative-engine selector. It is the ENGINE,
  // not a class -- so it is NOT gated behind a class A-M flag. It runs under
  // --all (every doctor sweep heals the install forward) and standalone (a bare
  // `doctor` run). With the registry seeded EMPTY of organ modules it selects
  // zero modules and stays a no-op; the wiring is what Plan 03 builds on.
  // Soft-fail: a throw here records an error finding but never crashes doctor.
  // Phase 217 Plan-01: the engine call is now UNCONDITIONAL (cadence:always
  // modules must run on every invocation via their own flag gates). The engine
  // itself reproduces the old class-A/N gate internally for the once-pass +
  // self-report row via opts.classFlagsActive. main() spreads the engine's
  // per-module always results into report.checks (so the generic renderer +
  // computeSummary treat each as a top-level row) and appends any recovered
  // records; the self-report row is attached ONLY under the old gate so a
  // --room-md-only run does not grow a new accumulative-engine row.
  try {
    const engineResult = runAccumulativeEngine({
      fix: flags.fix,
      dryRun: flags.dryRun,
      flags,
      classFlagsActive,
    });
    const { checks: engineChecks, recovered: engineRecovered, ...engineSelf } = engineResult;
    Object.assign(report.checks, engineChecks || {});
    if (Array.isArray(engineRecovered)) {
      for (const rec of engineRecovered) report.recovered.push(rec);
    }
    if (flags.all || flags.fix || !classFlagsActive) {
      report.checks['accumulative-engine'] = engineSelf;
    }
  } catch (err) {
    report.checks['accumulative-engine'] = { status: 'error', detail: (err && err.message) || 'engine threw', selected: [], deferred: [], findings: [], advanced: false };
  }

  // BUG 7 reinterpretation (relocated from the retired class I/J main() block,
  // Phase 217 Plan 06): class A (install-cache) x class I (install-state)
  // interplay. When class A reports install status:'missing' AND class I
  // resolves topology=='marketplace-cache', the legacy clone path is EXPECTED
  // absent (Claude Code loads from the cache), so downgrade class A to a note
  // and neutralize an install-missing-based drift. Class I now runs inside the
  // accumulative engine, so this reads the engine-populated
  // report.checks['install-state']. Gated on flags.installState (the flag that
  // activates class I), matching the pre-migration guard.
  if (flags.installState) {
    const stateAfter = report.checks['install-state'];
    if (report.install && report.install.status === 'missing'
        && stateAfter && stateAfter.topology === 'marketplace-cache') {
      report.install = Object.assign({}, report.install, {
        status: 'ok',
        note: 'legacy clone path expected absent on a marketplace-cache install (Bug 7 fix)',
        bug7_fix: true,
      });
      if (report.drift && report.drift.reason === 'install-missing') {
        report.drift = { detected: false, reason: 'bug7-fix-marketplace-cache' };
      }
    }
  }


  if (flags.brainSmoke) {
    const { checkBrainSmoke } = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs'));
    checkBrainSmoke().then(function (result) {
      report.checks['brain-smoke'] = Object.assign({ class: 'M' }, result);
      _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult);
    }).catch(function (err) {
      report.checks['brain-smoke'] = { class: 'M', status: 'error', detail: err && err.message };
      _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult);
    });
    return;
  }

  // quick(260706-13z) D14: Class S (Eureka smoke) under combined runs (e.g. a
  // --brain-smoke --eureka-smoke pair, or --all). The standalone --eureka-smoke
  // path is handled earlier with its own canonical output; here we attach the
  // result into report.checks['eureka-smoke'] beside the brain-smoke block.
  if (flags.eurekaSmoke) {
    const { checkEurekaSmoke } = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'class-s-eureka-smoke.cjs'));
    checkEurekaSmoke().then(function (result) {
      report.checks['eureka-smoke'] = Object.assign({ class: 'S' }, result);
      _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult);
    }).catch(function (err) {
      report.checks['eureka-smoke'] = { class: 'S', status: 'error', detail: err && err.message };
      _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult);
    });
    return;
  }

  _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult);
}

// -- --check-rs-engine probe (Phase 127.2 Plan 03, Findings F1 + F7) ---------
//
// Pre-flights Python deps reachable from scripts/rs-engine.py for the Engine 1
// Act 1 surface. Probes:
//   - `requests`  (transitive via lib/core/rs_corpus.py; the Windows 2026-05-23
//                  silent-failure root cause)
//   - `numpy`     (direct top-level import in rs-engine.py + rs_math)
// Plus best-effort umbrella probe of `sentence_transformers` + `sklearn`
// (declared in requirements-hsi.txt; used by sibling Engine 1 surfaces).
//
// Python resolution: `python3` preferred (POSIX convention + Aryeh's tester
// machine has both py3.13 + py3.14 reachable via `python3`); falls back to
// `python` (Windows / older installs). Honors MINDRIAN_PYTHON env override
// for tester / CI use, matching lib/agents/reverse-salient-agent.cjs:181.
//
// JSON exit (always emits on --json): { ok, ready, missing, python, fix }.
// Human exit: actionable fix line on FAIL; concise OK line on PASS.
//
// Phase-134-python-elimination-false-complete RCA, Change 1 (2026-08-27):
// `--fix` composes with `--check-rs-engine` (same convention as `--drift --fix`
// and `--graph-derive-health --fix` / `--heal-room`) to actually install the
// missing deps via `python -m pip install --user`, instead of only printing
// the manual instruction. Explicit `--fix` invocation IS the consent gate --
// same precedent as every other `--fix` composition in this file. Without
// `--fix`, behavior is unchanged: probe-only, printed instruction.
async function runCheckRsEngine(flags) {
  const cp = require('node:child_process');
  // Critical deps (rs-engine.py path -- failure here = /mos:find-bottlenecks down).
  const critical = ['requests', 'numpy'];
  // Umbrella deps (broader Engine 1 Act 1 surface; missing -> warn but not fail).
  const umbrella = ['sentence_transformers', 'sklearn'];
  const all = critical.concat(umbrella);
  const fix = 'Run: pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH), or `/mos:doctor --check-rs-engine --fix` to install automatically';
  // import-name -> pip-package-name (they differ for two of the four deps).
  const pipName = {
    requests: 'requests',
    numpy: 'numpy',
    sentence_transformers: 'sentence-transformers',
    sklearn: 'scikit-learn',
  };

  // Resolve python interpreter: MINDRIAN_PYTHON > python3 > python.
  // Each candidate gets a probe; first one that responds wins.
  function probePythonAvailable(bin) {
    try {
      const r = cp.spawnSync(bin, ['-c', 'import sys; print(sys.version)'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      return r && r.status === 0;
    } catch (_e) {
      return false;
    }
  }
  let python = process.env.MINDRIAN_PYTHON || null;
  if (!python || !probePythonAvailable(python)) {
    if (probePythonAvailable('python3')) python = 'python3';
    else if (probePythonAvailable('python')) python = 'python';
    else python = null;
  }

  if (!python) {
    const payload = {
      ok: false,
      ready: false,
      missing: all.slice(),
      python: null,
      fix: 'Python 3 is not on PATH. Install Python 3.10+ then: ' + fix,
    };
    if (flags.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log('Engine 1 Act 1 (/mos:find-bottlenecks et al.) cannot start: Python is not on PATH.');
      console.log(payload.fix);
    }
    return 1;
  }

  // Per-dep probe via `python -c "import <name>"`. Each probe is timeout-fenced
  // so a hung interpreter cannot stall /mos:doctor. Status code 0 = present.
  function probeImport(dep) {
    try {
      const r = cp.spawnSync(python, ['-c', 'import ' + dep], {
        encoding: 'utf8',
        timeout: 10000,
      });
      const ok = r && r.status === 0;
      // Capture stderr tail on failure for diagnostic surface (mirror F2 pattern).
      const stderrTail = (!ok && r && r.stderr) ? String(r.stderr).slice(-200) : '';
      return { dep: dep, ok: ok, stderrTail: stderrTail };
    } catch (e) {
      return { dep: dep, ok: false, stderrTail: String((e && e.message) || '').slice(-200) };
    }
  }

  let results = all.map(probeImport);
  let missingCritical = results.filter(function (r) {
    return critical.indexOf(r.dep) !== -1 && !r.ok;
  }).map(function (r) { return r.dep; });
  let missingUmbrella = results.filter(function (r) {
    return umbrella.indexOf(r.dep) !== -1 && !r.ok;
  }).map(function (r) { return r.dep; });
  let ok = missingCritical.length === 0;

  // Self-remediation (--fix): attempt `python -m pip install --user` for
  // every currently-missing dep, then re-probe. Explicit `--fix` is the
  // consent gate (matches --drift --fix / --heal-room precedent elsewhere
  // in this file) -- no prompt, no dry-run-first, same posture as the
  // already-shipped scripts/lib/ensure_ml_deps.py auto-installer.
  let remediation = null;
  if (!ok || missingUmbrella.length > 0) {
    if (flags.fix) {
      const toInstall = missingCritical.concat(missingUmbrella);
      const pipArgs = ['-m', 'pip', 'install', '--user', '--quiet']
        .concat(toInstall.map(function (dep) { return pipName[dep] || dep; }));
      if (!flags.json) {
        console.log('Engine 1 Act 1: installing missing Python deps (' + toInstall.join(', ') + ')...');
      }
      let installResult;
      try {
        installResult = cp.spawnSync(python, pipArgs, { encoding: 'utf8', timeout: 300000 });
      } catch (e) {
        installResult = { status: -1, error: e };
      }
      const installOk = installResult && installResult.status === 0;
      // Re-probe regardless of the reported install exit code -- the ground
      // truth is whether the interpreter can import the module afterward,
      // not pip's exit status (mirrors ensure_ml_deps.py's own re-check).
      results = all.map(probeImport);
      missingCritical = results.filter(function (r) {
        return critical.indexOf(r.dep) !== -1 && !r.ok;
      }).map(function (r) { return r.dep; });
      missingUmbrella = results.filter(function (r) {
        return umbrella.indexOf(r.dep) !== -1 && !r.ok;
      }).map(function (r) { return r.dep; });
      ok = missingCritical.length === 0;
      remediation = {
        attempted: true,
        installed: toInstall,
        pip_exit_code: installResult ? installResult.status : null,
        resolved: installOk && missingCritical.concat(missingUmbrella).length === 0,
        still_missing: missingCritical.concat(missingUmbrella),
        stderr_tail: (installResult && installResult.stderr) ? String(installResult.stderr).slice(-200) : '',
      };
    } else {
      remediation = { attempted: false };
    }
  }

  if (flags.json) {
    const payload = {
      ok: ok,
      ready: ok,
      python: python,
      probes: results.map(function (r) { return { dep: r.dep, ok: r.ok }; }),
      missing: missingCritical.concat(missingUmbrella),
      missing_critical: missingCritical,
      missing_umbrella: missingUmbrella,
      fix: ok ? null : fix,
      remediation: remediation,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    if (ok) {
      console.log('Engine 1 Act 1 ready -- Python (' + python + ') has all critical deps: ' + critical.join(', ') + '.');
      if (remediation && remediation.attempted) {
        console.log('Auto-installed: ' + remediation.installed.join(', ') + '.');
      }
      if (missingUmbrella.length > 0) {
        console.log('Note: umbrella deps missing (' + missingUmbrella.join(', ') + '); affects sibling Engine 1 surfaces. ' + fix);
      }
    } else if (remediation && remediation.attempted) {
      console.log('Engine 1 Act 1 (/mos:find-bottlenecks et al.) still needs Python deps after auto-install attempt.');
      console.log('Still missing: ' + missingCritical.join(', ') + '.');
      if (remediation.stderr_tail) console.log('pip stderr (tail): ' + remediation.stderr_tail);
      console.log('Manual fallback -- pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH)');
    } else {
      console.log('Engine 1 Act 1 (/mos:find-bottlenecks et al.) needs Python deps. Missing: ' + missingCritical.join(', ') + '.');
      console.log(fix);
    }
  }

  return ok ? 0 : 1;
}

// -- Class M dispatcher (Phase 127-02) ---------------------------------------
//
// Mirrors the Class I dispatcher shape (scripts/doctor.cjs Class I precedent).
// Returns the process exit code; per the class-flag invariant (line 1447) this
// is 0 even on probe FAIL. The standalone --brain-smoke caller awaits this and
// exits with whatever this returns; the --all combined caller goes through
// _finalizeAndExit instead.
async function classMBrainSmoke(flags) {
  const { checkBrainSmoke } = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs'));
  const result = await checkBrainSmoke();
  if (flags.json) {
    console.log(JSON.stringify(Object.assign({ class: 'M' }, result), null, 2));
  } else {
    console.log('Class M -- Brain end-to-end smoke (6-layer probe)');
    console.log('  Overall: ' + (result.ok ? 'PASS' : 'FAIL') + '  (' + result.overall_ms + 'ms)');
    for (const layer of result.layers) {
      const marker = layer.ok ? 'PASS' : 'FAIL';
      console.log('    [' + marker + '] ' + layer.name + ' -- ' + layer.reason + ' (' + layer.ms + 'ms)');
      // Handoff section 7 item g: report which endpoint the wire resolved
      // to and whether it is canon. Guarded on payload being present so
      // layers 1-5 (which never carry one) print exactly as before.
      if (layer.payload) {
        const p = layer.payload;
        console.log('        endpoint=' + p.endpoint + ' node_count=' + p.node_count
          + ' canon=' + p.canon + (p.override ? ' override=true' : ''));
        if (p.stamp) {
          const stampParts = [];
          if (p.stamp.schema_version != null) stampParts.push('schema_version=' + p.stamp.schema_version);
          if (p.stamp.last_reconciled != null) stampParts.push('last_reconciled=' + p.stamp.last_reconciled);
          if (p.stamp.refreshed_at != null) stampParts.push('refreshed_at=' + p.stamp.refreshed_at);
          console.log('        GraphRagMeta stamp: ' + stampParts.join(' '));
        }
      }
    }
  }
  // Class-flag invariant: exit 0 even on per-layer FAIL.
  return 0;
}

// -- Class S dispatcher (quick 260706-13z) -----------------------------------
//
// Mirrors the Class M dispatcher shape. Returns the process exit code; per the
// class-flag invariant this is 0 even on probe FAIL. The standalone
// --eureka-smoke caller awaits this; the combined caller goes through
// _finalizeAndExit instead.
async function classSEurekaSmoke(flags) {
  const { checkEurekaSmoke } = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'class-s-eureka-smoke.cjs'));
  const result = await checkEurekaSmoke();
  if (flags.json) {
    console.log(JSON.stringify(Object.assign({ class: 'S' }, result), null, 2));
  } else {
    console.log('Class S -- Eureka local-embedding-stack smoke (4-layer probe)');
    console.log('  Overall: ' + (result.ok ? 'PASS' : 'FAIL') + '  (' + result.overall_ms + 'ms)');
    for (const layer of result.layers) {
      const marker = layer.ok ? 'PASS' : 'FAIL';
      console.log('    [' + marker + '] ' + layer.name + ' -- ' + layer.reason + ' (' + layer.ms + 'ms)');
    }
  }
  // Class-flag invariant: exit 0 even on per-layer FAIL.
  return 0;
}

// -- Output + exit finalizer (extracted Phase 127-02 to allow async injection)
function _finalizeAndExit(flags, report, classFlagsActive, cacheResult, installResult) {
  // Output
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHumanReport(report));
  }

  // Exit code.
  // Phase 185 (DRIFT-01): runtime-reachability is the ONE --drift check that
  // produces a HARD non-zero signal. A capability WIRED in the connector
  // registry but UNREACHABLE by decide() at runtime is a CIRS R9 drift FAIL, not
  // a report-only warning -- so a 'warn' here flips doctor --drift to exit 1.
  // This is evaluated BEFORE the classFlagsActive graceful-degradation exit-0,
  // but it is narrowly scoped: report.checks['runtime-reachability'] is
  // populated ONLY under flags.drift, so this branch can never alter the exit
  // code of any other class-flag run (--all does not set --drift), and it leaves
  // the marketplace-cache-drift-deadlock carve-out (Class A) untouched. A clean
  // reachability check (status 'ok') OR an indeterminate one ('error') falls
  // through to the normal exit-0 invariant, so the real registry+projection
  // (fully reachable today) keeps doctor --drift at exit 0 -- no regression.
  const reach = report.checks && report.checks['runtime-reachability'];
  if (reach && reach.status === 'warn') {
    process.exit(1);
  }
  // When class flags are active we honor the graceful-degradation invariant
  // (Canon Part 8): the doctor run NEVER aborts with non-zero unless an
  // explicit --fix attempt failed. Tests rely on this for hermetic scratch-
  // registry runs that have no real install directory.
  if (classFlagsActive) {
    process.exit(0);
  }
  // Phase 95.2 exit-code chain (additive; preserves existing 0/1/2/3 semantics, adds 4).
  // 0 = healthy (no drift detected).
  // 1 = drift detected (read-only mode OR --fix didn't run).
  // 2 = drift detected and recovered via --fix.
  // 3 = internal error (cache unreadable, or install in 'error' state -- not 'missing').
  // 4 = recovery attempted but rolled back to backup state (D-03).
  // 0 = drift detected but recovery skipped by design (marketplace-cache
  //     topology; report.recoverySkipped set -- only ever under --fix, so
  //     read-only drift keeps exiting 1). RCA:
  //     doctor-marketplace-cache-drift-deadlock (2026-06-12).
  if (cacheResult.status !== 'ok') process.exit(3);
  if (installResult.status === 'error') process.exit(3);
  if (report.recoveryRolledBack) process.exit(4);
  if (report.classARecovered) process.exit(2);
  if (report.drift.detected && !report.recoverySkipped) process.exit(1);
  // Class N (DRIFT-12): the plugin-DISABLED silent-disable state is a drift
  // signal on a bare / non-class-flag run. enabled===false -> exit 1 so
  // `mindrian-os doctor` returns non-zero for the one failure mode that no
  // SessionStart hook can ever report (the hooks do not run while disabled).
  // ok / null / skip leave the exit at 0. Under class-flag mode the run already
  // returned 0 above (graceful-degradation invariant) -- the finding is still
  // visible in report.checks for --all consumers.
  const pen = report.checks && report.checks['plugin-enabled-state'];
  if (pen && pen.status === 'warn') process.exit(1);
  process.exit(0);
}

// Phase 139 Plan-02: export the accumulative-engine selector for hermetic unit
// testing (tests/test-doctor-module-selector.cjs requires this module and calls
// runAccumulativeEngine with an injected registry + watermark HOME). Guard the
// CLI entry so `require('doctor.cjs')` does NOT run main(); the script still
// runs main() when invoked directly or spawned as a subprocess (the standard
// `node scripts/doctor.cjs ...` usage, where require.main === module).
// renderHumanReport + computeSummary are additively exported so
// tests/test-doctor-fix-renderer.cjs can drive them as hermetic unit sub-tests
// (warn-row visibility, Summary parity, recovered-line rendering) without
// spawning a subprocess. The require.main guard below still prevents main().
// Phase 225-02 (REQ-4): additive export of the WAL-reset advisory helpers for
// hermetic unit testing via injected seams (tests/test-225-wal-advisory.cjs).
// Additive-only append -- existing keys are never reordered.
module.exports = { runAccumulativeEngine, renderHumanReport, computeSummary, _walResetAdvisory, _sqliteVersionLt };

if (require.main === module) {
  main();
}
