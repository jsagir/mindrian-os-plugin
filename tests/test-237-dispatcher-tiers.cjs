#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-07 -- two-tier dispatcher honesty gate (REACH-01, Task 1)
 * =======================================================================
 * Real behavior proven: lib/core/chain-step-dispatcher.cjs either genuinely
 * executes a script-backed step and verifies its artifact, or honestly
 * refuses a prompt-backed step with quality: null plus a machine-readable
 * requires_host_dispatch directive -- never a fabricated quality: 'high'.
 * This replaces lib/mcp/tools/chain.cjs's makeDefaultOnStep, which today
 * unconditionally returns quality: 'high' without ever resolving
 * step.command to anything runnable (237-RESEARCH.md, REACH-01).
 *
 * Nine legs:
 *   Leg 1 TIER 1 EXECUTES:       /mos:snapshot against a real seeded room
 *                                 genuinely spawns scripts/generate-hub.cjs
 *                                 and <roomDir>/exports/hub.html exists
 *                                 afterward. quality === 'high'.
 *   Leg 2 TIER 1 HONEST FAILURE: the same real command, but a room whose
 *                                 exports path is pre-occupied by a plain
 *                                 file, so generate-hub.cjs throws and exits
 *                                 non-zero. quality === 'low',
 *                                 executed === true, artifact absent. Never
 *                                 'high'.
 *   Leg 3 TIER 2 HONESTY:        a methodology command (no executable join)
 *                                 returns quality === null,
 *                                 tier === TIER_HOST_DISPATCH,
 *                                 executed === false,
 *                                 requires_host_dispatch === true, and
 *                                 dispatch.agent === 'framework-runner'.
 *                                 Asserts explicitly quality !== 'high'.
 *   Leg 4 ALLOWLIST CLOSED:      an unknown command (shell-metacharacter
 *                                 payload + a path-like string) routes to
 *                                 tier 2 and creates nothing.
 *   Leg 5 NO SHELL:              comment-stripped source scan -- no
 *                                 shell:true, no exec(, no execSync(, no
 *                                 template-literal command string passed to
 *                                 a child-process API.
 *   Leg 6 ARTIFACT CONTAINMENT:  a synthetic executable join whose
 *                                 `produces` escapes the room root is
 *                                 refused pre-spawn; quality === 'low' with
 *                                 a stated containment reason; nothing
 *                                 created outside the room.
 *   Leg 7 BOUNDED:                a synthetic executable join pointing at a
 *                                 script that sleeps past a small
 *                                 dispatchTimeoutMs override returns
 *                                 timed_out === true, quality === 'low',
 *                                 in seconds, not hung.
 *   Leg 8 PART 9:                  the dispatch writes its memory_event
 *                                 through lib/core/navigation.cjs only (no
 *                                 direct node:sqlite require, no direct
 *                                 room.db open in the module source); a row
 *                                 labelled chain_step_dispatched is
 *                                 observable after Leg 1's real dispatch.
 *   Leg 9 MUTATION:               a tmp copy of chain-step-dispatcher.cjs
 *                                 with the tier-2 quality: null textually
 *                                 replaced by quality: 'high' makes Leg 3's
 *                                 assertion fail, proving the honesty gate
 *                                 bites.
 *
 * The synthetic-join legs (6, 7) drive dispatchStep through the module's
 * own context.registryPath test-only override (see
 * chain-step-dispatcher.cjs::resolveExecutable's doc) rather than editing
 * data/command-registry.json. Leg 2 deliberately does NOT need a synthetic
 * join -- it uses the REAL /mos:snapshot command against a hostile real
 * room fixture (one of the two options the plan's own behavior spec names
 * for this leg), which is closer to the real defect surface. The working
 * tree's generated registry stays untouched by this file by construction
 * (it is never opened for write); byte-identity is documented in the
 * SUMMARY rather than re-asserted inside this file (a test file shelling
 * out to git would not be hermetic).
 *
 * Room fixture: seedRoom mirrors tests/test-241-guardian-tripolar-parity.cjs
 * (lines 94-114)'s own builder, extended with a real non-ROOM.md markdown
 * file per section (scripts/generate-hub.cjs's own SKIP_FILES list skips
 * ROOM.md, so a section needs a DIFFERENT .md file to render as a non-empty
 * card) so the hub generator produces a non-trivial hub.html, not an empty
 * shell. mkTmp + process.on('exit') cleanup pattern from the same file.
 * Hermetic env block (MINDRIAN_ROOMS_HOME / MINDRIAN_MCP_FIRST /
 * CLAUDE_ACTIVE_ROOM save-and-restore) from
 * tests/test-198-concurrency-mcp.test.cjs:31-45.
 *
 * Leg 9's mutation harness follows
 * tests/test-241-guardian-tripolar-parity.cjs:160-215: read the source, pin
 * the relative navigation.cjs require to an absolute repo path with a
 * per-needle assert.ok, apply the textual mutation, assert.notEqual(mutated,
 * src), write to a temp path, require(dest). Never mutates the working tree.
 *
 * WEAK RED (module-absent, expected before Task 2): this file's own
 * top-level require of lib/core/chain-step-dispatcher.cjs throws
 * MODULE_NOT_FOUND before any leg runs, so `node
 * tests/test-237-dispatcher-tiers.cjs` exits non-zero for that reason
 * alone. That RED is captured for the SUMMARY, but it is an absence, not a
 * proof of wrong behavior -- the REAL reproduction of the defect (driving
 * lib/mcp/tools/chain.cjs::_internal.makeDefaultOnStep against this same
 * fixture shape and observing quality: 'high' with exports/hub.html absent)
 * is captured separately in the SUMMARY, per the plan's own Task 1 action
 * paragraph, and is not re-enacted inside this file.
 *
 * Async shape: dispatchStep is async, so this file's body runs inside an
 * async main(), matching tests/test-198-chain-run-halt.test.cjs's own
 * shape (await chainTool.chainRun(...), main().then/.catch at the bottom).
 *
 * Harness idiom: assert(cond, label) / failures counter / process.exit,
 * matching tests/test-237-executable-seam.cjs and
 * tests/test-recipe-maps-authority.cjs. No test-runner framework.
 *
 * bash/node only. No em-dashes.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-step-dispatcher.cjs');
const NAVIGATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');
const ROOM_DB_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs');

// This require is deliberately at the top level, unguarded: before Task 2
// lands, this throws MODULE_NOT_FOUND and the whole file exits non-zero.
// That is the expected weak RED (see header).
const dispatcher = require(DISPATCHER_PATH);
const navigation = require(NAVIGATION_PATH);
const { openRoomDb, closeRoomDb } = require(ROOM_DB_PATH);

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// Hermetic env block (tests/test-198-concurrency-mcp.test.cjs:31-45).
// ---------------------------------------------------------------------------
const previousHome = process.env.MINDRIAN_ROOMS_HOME;
const previousFlag = process.env.MINDRIAN_MCP_FIRST;
const previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ACTIVE_ROOM;

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}

const CLEANUP_PATHS = [];
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  for (const p of CLEANUP_PATHS) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (previousHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
  else process.env.MINDRIAN_ROOMS_HOME = previousHome;
  if (previousFlag === undefined) delete process.env.MINDRIAN_MCP_FIRST;
  else process.env.MINDRIAN_MCP_FIRST = previousFlag;
  if (previousActiveRoomEnv === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
  else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoomEnv;
});

// ---------------------------------------------------------------------------
// Room fixture. seedRoom mirrors test-241-guardian-tripolar-parity.cjs's own
// builder; each section gets a NON-ROOM.md markdown file so
// scripts/generate-hub.cjs (whose SKIP_FILES list skips ROOM.md itself)
// renders real cards rather than an empty shell. Bootstraps .mindrian/room.db
// via room-db.cjs::openRoomDb directly (test-only bootstrap -- production
// code never requires room-db.cjs outside the navigation/ allow-list) so
// navigation.openRoomDbForCaller's own existsSync(.mindrian/room.db) gate
// finds a real db to open.
// ---------------------------------------------------------------------------
function seedRoom(tmp, opts) {
  const o = opts || {};
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nventure_name: Dispatcher Fixture Venture\nventure_stage: Discovery\n---\n# Dispatcher Fixture Venture\n'
  );

  if (o.exportsIsAFile) {
    // Hostile fixture for Leg 2: pre-occupy the exports path with a plain
    // FILE so generate-hub.cjs's own mkdirSync/writeFileSync sequence
    // throws (ENOTDIR) and the process exits non-zero -- a real,
    // unmodified /mos:snapshot honest-failure reproduction, no synthetic
    // registry join required.
    fs.writeFileSync(path.join(roomDir, 'exports'), 'not a directory\n');
  }

  const sections = ['problem-definition', 'market-analysis'];
  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + s + '\n\nIdentity text for ' + s + '.\n');
    fs.writeFileSync(
      path.join(dir, 'notes.md'),
      '# ' + s + ' Notes\n\nSubstantive content for ' + s +
        ' so the hub generator renders a real card, not an empty shell. ' +
        'This paragraph exists only to give the section body enough text ' +
        'for a non-trivial artifact check.\n'
    );
  }

  // Bootstrap .mindrian/room.db so navigation.openRoomDbForCaller's own
  // existsSync gate finds it (openRoomDbForCaller does NOT create the db
  // itself -- it only opens an already-present one).
  const bootstrapDb = openRoomDb(roomDir);
  closeRoomDb(bootstrapDb);

  return roomDir;
}

function readMemoryEventLabels(roomDir) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  if (!db) return [];
  try {
    const rows = db.prepare("SELECT properties FROM nodes WHERE type = 'memory_event'").all();
    return rows.map((r) => {
      try {
        return JSON.parse(r.properties).label;
      } catch (_e) {
        return null;
      }
    });
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

// ---------------------------------------------------------------------------
// Synthetic registry seam. Writes a temp registry JSON (shape:
// { commands: [...] }) and returns its path -- dispatchStep's own
// context.registryPath test-only override reads it. The declared `script`
// field must still resolve UNDER the real plugin root (scriptPathFor's own
// containment check is not test-relaxable), so synthetic entries point at
// the REAL scripts/generate-hub.cjs (Leg 6) or a small ephemeral sleep
// fixture written under the real repo's tests/ tree and deleted immediately
// after use (Leg 7) -- never at a path outside the plugin root.
// ---------------------------------------------------------------------------
function writeSyntheticRegistry(tmp, commands) {
  const registryPath = path.join(tmp, 'synthetic-command-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify({ commands: commands }, null, 2));
  return registryPath;
}

async function legTier1Executes() {
  const tmp = mkTmp('t23707-tier1-ok-');
  const roomDir = seedRoom(tmp);

  const step = { step: 1, command: '/mos:snapshot', framework: null };
  const outcome = await dispatcher.dispatchStep(step, null, { roomDir: roomDir });

  check(!!outcome.chain_output, '1a: dispatchStep returns a chain_output for a real Tier-1 dispatch');
  check(
    outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_EXECUTABLE,
    '1b: tier === TIER_EXECUTABLE for /mos:snapshot'
  );
  check(outcome.chain_output && outcome.chain_output.executed === true, '1c: executed === true');
  check(outcome.chain_output && outcome.chain_output.exit_code === 0, '1d: exit_code === 0');
  check(outcome.chain_output && outcome.chain_output.timed_out === false, '1e: timed_out === false');
  const expectedArtifact = path.join(roomDir, 'exports', 'hub.html');
  check(fs.existsSync(expectedArtifact), '1f: <roomDir>/exports/hub.html exists on disk afterward');
  check(
    outcome.chain_output && outcome.chain_output.artifact === expectedArtifact,
    '1g: chain_output.artifact names the resolved artifact path'
  );
  check(outcome.quality === 'high', "1h: quality === 'high' for a genuine successful Tier-1 dispatch");
}

async function legTier1HonestFailure() {
  const tmp = mkTmp('t23707-tier1-fail-');
  const roomDir = seedRoom(tmp, { exportsIsAFile: true });

  const step = { step: 1, command: '/mos:snapshot', framework: null };
  const outcome = await dispatcher.dispatchStep(step, null, { roomDir: roomDir });

  check(
    outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_EXECUTABLE,
    '2a: still routes through TIER_EXECUTABLE (the script join resolves; it just fails)'
  );
  check(outcome.chain_output && outcome.chain_output.executed === true, '2b: executed === true (it was actually spawned)');
  check(
    outcome.chain_output && outcome.chain_output.exit_code !== 0,
    '2c: exit_code is non-zero (generate-hub.cjs threw on the pre-occupied exports path)'
  );
  check(outcome.chain_output && outcome.chain_output.artifact === null, '2d: chain_output.artifact reported absent');
  check(outcome.quality === 'low', "2e: quality === 'low', never 'high', for a failed Tier-1 dispatch");
}

async function legTier2Honesty() {
  const tmp = mkTmp('t23707-tier2-');
  const roomDir = seedRoom(tmp);

  const step = { step: 1, command: '/mos:analyze-needs', framework: 'Jobs to Be Done (JTBD)' };
  const outcome = await dispatcher.dispatchStep(step, null, { roomDir: roomDir, targetSection: 'market-analysis' });

  check(
    outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_HOST_DISPATCH,
    '3a: a methodology command routes to TIER_HOST_DISPATCH'
  );
  check(outcome.chain_output && outcome.chain_output.executed === false, '3b: executed === false');
  check(
    outcome.chain_output && outcome.chain_output.requires_host_dispatch === true,
    '3c: requires_host_dispatch === true'
  );
  check(
    outcome.chain_output && outcome.chain_output.dispatch && outcome.chain_output.dispatch.agent === 'framework-runner',
    "3d: dispatch.agent === 'framework-runner'"
  );
  check(
    outcome.chain_output && outcome.chain_output.dispatch && outcome.chain_output.dispatch.room_path === roomDir,
    '3e: dispatch.room_path === roomDir'
  );
  check(
    outcome.chain_output && outcome.chain_output.dispatch && outcome.chain_output.dispatch.target_section === 'market-analysis',
    '3f: dispatch.target_section carries context.targetSection'
  );
  check(outcome.quality === null, '3g: quality === null for Tier 2, never a fabricated value');
  assert.notStrictEqual(outcome.quality, 'high', "3h: EXPLICIT assertion: quality !== 'high' for a Tier-2 refusal");
  check(true, "3h: quality !== 'high' for a Tier-2 refusal (explicit assert.notStrictEqual above)");

  return outcome;
}

async function legAllowlistClosed() {
  const tmp = mkTmp('t23707-allowlist-');
  const roomDir = seedRoom(tmp);
  const before = fs.existsSync(path.join(roomDir, 'exports', 'hub.html'));

  const hostileCommands = ['; rm -rf / #', '../../../../etc/passwd', '$(touch /tmp/t23707-pwned)'];
  for (const cmd of hostileCommands) {
    const step = { step: 1, command: cmd, framework: null };
    const outcome = await dispatcher.dispatchStep(step, null, { roomDir: roomDir });
    check(
      outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_HOST_DISPATCH,
      '4: unknown command ' + JSON.stringify(cmd) + ' routes to TIER_HOST_DISPATCH, spawns nothing'
    );
    check(outcome.quality === null, '4: unknown command ' + JSON.stringify(cmd) + ' never returns a fabricated quality');
  }
  const after = fs.existsSync(path.join(roomDir, 'exports', 'hub.html'));
  check(before === false && after === false, '4: no file was created inside the room by any hostile command string');
  check(!fs.existsSync('/tmp/t23707-pwned'), '4: no file was created outside the room (shell-metacharacter payload never reached a shell)');
}

function legNoShell() {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  const codeLines = src.split('\n').filter((line) => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  });
  const code = codeLines.join('\n');

  check(!/shell\s*:\s*true/.test(code), '5a: no shell:true in code (comments excluded)');
  check(!/[^a-zA-Z_]exec\(/.test(code), '5b: no exec( call in code (comments excluded)');
  check(!/execSync\(/.test(code), '5c: no execSync( call in code (comments excluded)');
  check(
    !/`[^`]*\$\{[^}]*\}[^`]*`\s*,?\s*\{[^}]*shell/.test(code),
    '5d: no template-literal command string passed alongside a shell option'
  );
  check(/spawnSync\(/.test(code), '5e: sanity -- the module does spawn via spawnSync (so this leg can actually fail)');
}

async function legArtifactContainment() {
  const tmp = mkTmp('t23707-containment-');
  const roomDir = seedRoom(tmp);
  const registryTmp = mkTmp('t23707-containment-registry-');

  const registryPath = writeSyntheticRegistry(registryTmp, [
    {
      command: '/mos:snapshot-traversal-fixture',
      executable: {
        script: 'scripts/generate-hub.cjs',
        args: ['${ROOM_DIR}'],
        produces: '../../escape-237-07.txt',
      },
    },
  ]);

  const step = { step: 1, command: '/mos:snapshot-traversal-fixture', framework: null };
  const outcome = await dispatcher.dispatchStep(step, null, { roomDir: roomDir, registryPath: registryPath });

  check(
    outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_EXECUTABLE,
    '6a: the join still resolves (a real script), so tier stays TIER_EXECUTABLE'
  );
  check(outcome.quality === 'low', "6b: quality === 'low' for a containment refusal");
  check(
    typeof (outcome.chain_output && outcome.chain_output.reason) === 'string' &&
      outcome.chain_output.reason.length > 0,
    '6c: chain_output carries a stated containment reason'
  );
  const escapedPath = path.resolve(roomDir, '..', '..', 'escape-237-07.txt');
  check(!fs.existsSync(escapedPath), '6d: no file was created outside the room root');
}

async function legBoundedTimeout() {
  const tmp = mkTmp('t23707-timeout-');
  const roomDir = seedRoom(tmp);
  const registryTmp = mkTmp('t23707-timeout-registry-');

  const sleepFixtureDir = path.join(REPO_ROOT, 'tests', '.tmp-237-07-sleep-fixture');
  CLEANUP_PATHS.push(sleepFixtureDir);
  fs.mkdirSync(sleepFixtureDir, { recursive: true });
  const sleepScriptPath = path.join(sleepFixtureDir, 'sleep-past-timeout.cjs');
  fs.writeFileSync(
    sleepScriptPath,
    "'use strict';\n// Test-only ephemeral fixture (Leg 7, tests/test-237-dispatcher-tiers.cjs). Deleted immediately after use.\nsetTimeout(() => process.exit(0), 5000);\n"
  );

  const relScriptPath = path.relative(REPO_ROOT, sleepScriptPath).split(path.sep).join('/');
  const registryPath = writeSyntheticRegistry(registryTmp, [
    {
      command: '/mos:sleep-fixture',
      executable: { script: relScriptPath, args: [], produces: null },
    },
  ]);

  const step = { step: 1, command: '/mos:sleep-fixture', framework: null };
  const started = Date.now();
  const outcome = await dispatcher.dispatchStep(step, null, {
    roomDir: roomDir,
    registryPath: registryPath,
    dispatchTimeoutMs: 300,
  });
  const elapsedMs = Date.now() - started;

  try { fs.rmSync(sleepFixtureDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  check(
    outcome.chain_output && outcome.chain_output.tier === dispatcher.TIER_EXECUTABLE,
    '7a: the sleep-fixture join resolves, so tier stays TIER_EXECUTABLE'
  );
  check(outcome.chain_output && outcome.chain_output.timed_out === true, '7b: timed_out === true, not a hang');
  check(outcome.quality === 'low', "7c: quality === 'low' for a timed-out dispatch");
  check(elapsedMs < 5000, '7d: this leg ran in seconds (elapsed ' + elapsedMs + 'ms), not the full 5000ms sleep');
}

function legPart9SourceScan() {
  const srcRaw = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  const codeLines = srcRaw.split('\n').filter((line) => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  });
  const code = codeLines.join('\n');
  check(!/node:sqlite/.test(code), "8a: no direct node:sqlite require in the module's own source");
  check(!/\bopenRoomDb\(/.test(code), '8b: no direct room-db.cjs openRoomDb( call (Part 9 chokepoint only)');
}

async function legPart9MemoryEvent() {
  const tmp = mkTmp('t23707-part9-');
  const roomDir = seedRoom(tmp);
  const step = { step: 1, command: '/mos:snapshot', framework: null };
  await dispatcher.dispatchStep(step, null, { roomDir: roomDir });

  const labels = readMemoryEventLabels(roomDir);
  check(
    labels.indexOf('chain_step_dispatched') !== -1,
    "8c: a memory_event row labelled 'chain_step_dispatched' is observable after a dispatch"
  );
}

async function legMutation() {
  const tmp = mkTmp('t23707-mutation-');
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');

  const pluginRootNeedle = "path.resolve(__dirname, '..', '..');";
  assert.ok(src.indexOf(pluginRootNeedle) !== -1, 'PLUGIN_ROOT computation not found; harness pin target drifted');

  const navRequireNeedle = "require('./navigation.cjs')";
  assert.ok(src.indexOf(navRequireNeedle) !== -1, 'navigation.cjs relative require not found; harness pin target drifted');
  let pinned = src.split(navRequireNeedle).join('require(' + JSON.stringify(NAVIGATION_PATH) + ')');
  assert.ok(pinned.indexOf(NAVIGATION_PATH) !== -1, 'navigation.cjs require pin did not apply');

  const tier2Needle = 'quality: null,';
  assert.ok(pinned.indexOf(tier2Needle) !== -1, 'tier-2 quality: null needle not found; source drifted');
  const mutated = pinned.split(tier2Needle).join("quality: 'high', /* MUTATION (Leg 9 proof): fabricated success reintroduced */");
  assert.notEqual(mutated, src, 'mutation must actually change the source');

  const dest = path.join(tmp, 'chain-step-dispatcher-mutated.cjs');
  fs.writeFileSync(dest, mutated);
  delete require.cache[dest];
  const mutatedDispatcher = require(dest);

  const roomDir = seedRoom(tmp);
  const step = { step: 1, command: '/mos:analyze-needs', framework: 'Jobs to Be Done (JTBD)' };
  const outcome = await mutatedDispatcher.dispatchStep(step, null, { roomDir: roomDir, targetSection: 'market-analysis' });

  check(
    outcome.quality === 'high',
    "9a: sanity -- the mutated copy DOES fabricate quality: 'high' for a Tier-2 step (the mutation took)"
  );
  check(
    outcome.quality !== null,
    "9b: THE MUTATION PROOF -- Leg 3's assertion (quality === null) fails against the mutated copy, proving the honesty gate bites"
  );
}

async function main() {
  await legTier1Executes();
  await legTier1HonestFailure();
  await legTier2Honesty();
  await legAllowlistClosed();
  legNoShell();
  await legArtifactContainment();
  await legBoundedTimeout();
  legPart9SourceScan();
  await legPart9MemoryEvent();
  await legMutation();

  console.log('');
  if (failures > 0) {
    console.error('test-237-dispatcher-tiers: ' + failures + ' FAILURE(S)');
    process.exit(1);
  } else {
    console.log('test-237-dispatcher-tiers: all checks passed');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
