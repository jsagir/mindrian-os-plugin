#!/usr/bin/env node
'use strict';
/*
 * Quick task 260917-dia, Task C -- unify MINDRIAN_ROOMS_HOME then
 * MINDRIAN_ROOMS_ROOT precedence across every resolver.
 *
 * ROOT CAUSE (verified by grep, not re-derived here): lib/core/session-binding.cjs
 * and lib/core/resolve-active-room.cjs already honor MINDRIAN_ROOMS_HOME first,
 * falling back to MINDRIAN_ROOMS_ROOT; docs name HOME 3x against ROOT's 1x, so
 * HOME is the intended primary env var. Eleven other resolver sites disagreed:
 * six read ROOT only (HOME silently ignored), five read ROOT before HOME
 * (precedence inverted).
 *
 * Three legs:
 *   1. unit: lib/core/rooms-home-env.cjs roomsHomeEnv() -- HOME wins when both
 *      are set, each wins alone, null when neither is set.
 *   2. census: every literal `process.env.MINDRIAN_ROOMS_ROOT` occurrence under
 *      lib/ + scripts/ (excluding node_modules, *.test.cjs) is either inside the
 *      resolver module itself, on an expression where MINDRIAN_ROOMS_HOME
 *      appears first, or in the small explicit allowlist below.
 *   3. behavioral (RED today): spawn scripts/intent-classifier.cjs against a
 *      temp rooms-home fixture with ONLY MINDRIAN_ROOMS_HOME set and
 *      MINDRIAN_ROOMS_ROOT explicitly deleted from the child env, and assert it
 *      resolves the fixture room (the room name appears in the emitted F.8
 *      binding-gate options list, an observable that requires a resolved root).
 *
 * Node built-in assert only. No em-dashes. Temp dirs cleaned in a finally block.
 *
 * Run: node tests/test-260917-rooms-home-precedence.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------------------------------------------------------------------------
// Leg 1: unit -- roomsHomeEnv() precedence, exhaustive on the 4 env states.
// Save + restore both vars around every case so this cannot leak into its
// siblings (or into legs 2/3 below).
// ---------------------------------------------------------------------------
function runLeg1() {
  const { roomsHomeEnv } = require(path.join(REPO_ROOT, 'lib', 'core', 'rooms-home-env.cjs'));
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedRoot = process.env.MINDRIAN_ROOMS_ROOT;
  try {
    check('leg 1a: only HOME set -> returns the HOME value', () => {
      delete process.env.MINDRIAN_ROOMS_ROOT;
      process.env.MINDRIAN_ROOMS_HOME = '/tmp/only-home-fixture';
      assert.strictEqual(roomsHomeEnv(), '/tmp/only-home-fixture');
    });
    check('leg 1b: only ROOT set -> returns the ROOT value', () => {
      delete process.env.MINDRIAN_ROOMS_HOME;
      process.env.MINDRIAN_ROOMS_ROOT = '/tmp/only-root-fixture';
      assert.strictEqual(roomsHomeEnv(), '/tmp/only-root-fixture');
    });
    check('leg 1c: BOTH set -> returns the HOME value (HOME wins)', () => {
      process.env.MINDRIAN_ROOMS_HOME = '/tmp/both-home-fixture';
      process.env.MINDRIAN_ROOMS_ROOT = '/tmp/both-root-fixture';
      assert.strictEqual(roomsHomeEnv(), '/tmp/both-home-fixture');
    });
    check('leg 1d: neither set -> returns null', () => {
      delete process.env.MINDRIAN_ROOMS_HOME;
      delete process.env.MINDRIAN_ROOMS_ROOT;
      assert.strictEqual(roomsHomeEnv(), null);
    });
  } finally {
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    if (savedRoot === undefined) delete process.env.MINDRIAN_ROOMS_ROOT;
    else process.env.MINDRIAN_ROOMS_ROOT = savedRoot;
  }
}

// ---------------------------------------------------------------------------
// Leg 2: census -- walk lib/ + scripts/ (excluding node_modules, *.test.cjs)
// and assert every literal `process.env.MINDRIAN_ROOMS_ROOT` occurrence is
// covered by one of the three exceptions.
// ---------------------------------------------------------------------------

// Exception (a): the resolver module's own internal read is exempt by file.
const RESOLVER_MODULE_REL = path.join('lib', 'core', 'rooms-home-env.cjs');

// Exception (c): the deliberate ROOT -> HOME bridge that feeds the Phase 127.3
// chokepoint (scripts/intent-classifier.cjs resolveActiveRoomDir). Its direction
// already matches the target precedence (it makes HOME win downstream by
// copying ROOT's value INTO HOME only when HOME is absent) -- it is not a
// resolver site to rewire, just a compatibility shim, so it is allowlisted by
// exact line-content pattern (robust to line-number drift from other edits in
// the same file) rather than by line number.
const ALLOWLIST = [
  {
    fileRel: path.join('scripts', 'intent-classifier.cjs'),
    pattern: /process\.env\.MINDRIAN_ROOMS_ROOT\s*&&\s*!process\.env\.MINDRIAN_ROOMS_HOME/,
    why: 'the ROOT -> HOME compatibility bridge test (guards the copy below), not a resolver read',
  },
  {
    fileRel: path.join('scripts', 'intent-classifier.cjs'),
    pattern: /process\.env\.MINDRIAN_ROOMS_HOME\s*=\s*process\.env\.MINDRIAN_ROOMS_ROOT/,
    why: 'the ROOT -> HOME compatibility bridge copy itself, feeding the Phase 127.3 chokepoint',
  },
];

// How far back (lines) to look for a MINDRIAN_ROOMS_HOME read that establishes
// exception (b) for a multi-statement (not single `||` expression) resolver,
// e.g. scripts/explain-decision-command.cjs's two separate if-statements. Every
// real resolver in this repo is a tiny function, so a generous same-function
// window is safe without risking a false-clear from an unrelated HOME mention
// elsewhere in a large file.
const CENSUS_BACK_WINDOW = 25;

function walkCjsFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkCjsFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.cjs') && !e.name.endsWith('.test.cjs')) {
      out.push(full);
    }
  }
  return out;
}

function runCensus() {
  const files = [];
  walkCjsFiles(path.join(REPO_ROOT, 'lib'), files);
  walkCjsFiles(path.join(REPO_ROOT, 'scripts'), files);

  const violations = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    if (rel === RESOLVER_MODULE_REL) continue; // exception (a)

    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (_e) {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const envIdx = line.indexOf('process.env.MINDRIAN_ROOMS_ROOT');
      if (envIdx === -1) continue; // not an actual env read on this line

      // Exception (c): explicit allowlist, matched by content pattern.
      const allowed = ALLOWLIST.some((entry) => entry.fileRel === rel && entry.pattern.test(line));
      if (allowed) continue;

      // Exception (b), same-line expression: HOME token appears before the
      // ROOT env-read token on the SAME line (a `||` chain).
      const homeIdxSameLine = line.indexOf('MINDRIAN_ROOMS_HOME');
      if (homeIdxSameLine !== -1 && homeIdxSameLine < envIdx) continue;

      // Exception (b), same-function multi-statement: a MINDRIAN_ROOMS_HOME
      // mention within CENSUS_BACK_WINDOW lines above this one.
      let foundNearbyHome = false;
      for (let k = Math.max(0, i - CENSUS_BACK_WINDOW); k < i; k++) {
        if (lines[k].indexOf('MINDRIAN_ROOMS_HOME') !== -1) {
          foundNearbyHome = true;
          break;
        }
      }
      if (foundNearbyHome) continue;

      violations.push(rel + ':' + (i + 1) + ': ' + line.trim());
    }
  }
  return violations;
}

function runLeg2() {
  check('leg 2 census: every process.env.MINDRIAN_ROOMS_ROOT read honors HOME first (or is exempt)', () => {
    const violations = runCensus();
    assert.strictEqual(
      violations.length, 0,
      'ROOT-before-HOME (or ROOT-only) resolver site(s) found:\n' + violations.join('\n')
    );
  });
}

// ---------------------------------------------------------------------------
// Leg 3: behavioral (RED today) -- HOME-only spawn of the real classifier.
// ---------------------------------------------------------------------------

const ROOM = 'orbit-lantern';

function makeHomeOnlyFixture() {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'p260917-homeonly-rooms-'));
  const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'p260917-homeonly-fakehome-'));

  fs.mkdirSync(path.join(roomsHome, ROOM), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, ROOM, 'STATE.md'),
    '---\nproject: Orbit Lantern Works\n---\n# Orbit Lantern\nSignal Beacon Notes\n'
  );

  const registry = { active: ROOM, rooms: {} };
  registry.rooms[ROOM] = { slug: ROOM };
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  return { roomsHome, isolatedHome };
}

function spawnClassifierHomeOnly(roomsHome, isolatedHome, message, sessionId) {
  const env = Object.assign({}, process.env, {
    HOME: isolatedHome,
    MINDRIAN_ROOMS_HOME: roomsHome,
    CLAUDE_SESSION_ID: sessionId,
  });
  delete env.MINDRIAN_ROOMS_ROOT;
  return spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify({ prompt: message }),
    encoding: 'utf8',
    env: env,
    timeout: 30000,
  });
}

function runLeg3() {
  const { roomsHome, isolatedHome } = makeHomeOnlyFixture();
  try {
    check('leg 3 behavioral: HOME-only env (ROOT deleted) still resolves the fixture room', () => {
      const message = 'we are working on the orbit lantern signal beacon project today please';
      const res = spawnClassifierHomeOnly(roomsHome, isolatedHome, message, 'sess-260917-homeonly');
      assert.strictEqual(res.status, 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
      const out = res.stdout || '';
      assert.ok(
        out.indexOf(ROOM) !== -1,
        'the fixture room (' + ROOM + ') appears in the emitted output, proving the root ' +
          'resolved via MINDRIAN_ROOMS_HOME alone (MINDRIAN_ROOMS_ROOT was deleted from the ' +
          'child env). Fails today because the classifier reads MINDRIAN_ROOMS_ROOT only.'
      );
    });
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
    try { fs.rmSync(isolatedHome, { recursive: true, force: true }); } catch (_e) {}
  }
}

try {
  console.log('test-260917-rooms-home-precedence.cjs (260917-dia Task C): HOME-then-ROOT env precedence');
  runLeg1();
  runLeg2();
  runLeg3();
  console.log('');
  console.log('PASS test-260917-rooms-home-precedence.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-260917-rooms-home-precedence.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
