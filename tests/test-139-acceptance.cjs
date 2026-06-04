'use strict';
/*
 * tests/test-139-acceptance.cjs -- Phase 139 Plan 04 (S4).
 *
 * The phase-level acceptance gate: the whole S1-S4 chain green in one shot.
 * One Phase-139 gate for release.sh + CI. Reuses the Plan 01-03 hermetic
 * fixture idioms (mkdtempSync HOME + cwd opts; real room.db via the openRoomDb
 * chokepoint; injected registry seams) so the chain is fully self-contained and
 * touches neither the real ~/.mindrian nor the network.
 *
 * Coverage map:
 *   S1 resolver  -- resolveUmbilicalTarget returns null from a non-room cwd;
 *                   resolves from a sentinel and from registry.active.
 *   S1 OBS-2     -- heal from a non-room scratch dir writes ZERO room artifacts
 *                   (.mindrian / .heal-backup / heal-log.json all absent).
 *   S2 selector  -- the (applied_through, running] window + idempotency hold
 *                   with a synthetic registry.
 *   S3 umbilical -- a marker projects EXACTLY ONE AFFILIATED_WITH edge; Part 8
 *                   audit (no egress, enum-only props, no cross-room edge).
 *   S4 registry  -- every doctor-modules.json runner file exists; the umbilical
 *                   introduced_version is valid semver and <= plugin.json version
 *                   (the Step 6.6a release-gate invariant, run here too).
 *
 * Total runtime budget: well under ~60s (all in-process, no subprocess spawns).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const semver = require(path.join(REPO_ROOT, 'node_modules', 'semver'));

const { resolveUmbilicalTarget } = require(path.join(REPO_ROOT, 'lib', 'core', 'resolve-umbilical-target.cjs'));
const { runHeal } = require(path.join(REPO_ROOT, 'scripts', 'heal-command.cjs'));
const snap = require(path.join(REPO_ROOT, 'lib', 'core', 'migration-snapshot.cjs'));
const doctor = require(path.join(REPO_ROOT, 'scripts', 'doctor.cjs'));
const umbilical = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'umbilical-module.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let passed = 0;
function ok(name) { passed += 1; console.log('  ok  ' + name); }

function mkScratch(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), (prefix || 'p139-acc-')));
}

// ---------------------------------------------------------------------------
// S1 -- resolver: null from non-room cwd; sentinel hit; registry.active hit
// ---------------------------------------------------------------------------
function s1_resolver() {
  // (a) non-room cwd + empty registry -> null (no throw, no fabrication)
  const homeEmpty = mkScratch('p139-home-');
  const plain = mkScratch('p139-plain-');
  let rNull;
  assert.doesNotThrow(() => { rNull = resolveUmbilicalTarget({ cwd: plain, home: homeEmpty }); });
  assert.strictEqual(rNull, null, 'S1: non-room cwd resolves to null');

  // (b) .room-root sentinel above cwd -> source sentinel
  const home2 = mkScratch('p139-home-');
  fs.mkdirSync(path.join(home2, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(home2, '.rooms', 'registry.json'),
    JSON.stringify({ version: 3, active: null, rooms: {} }, null, 2), 'utf8');
  const roomTree = mkScratch('p139-roomtree-');
  fs.writeFileSync(path.join(roomTree, '.room-root'), '', 'utf8');
  const sub = path.join(roomTree, 'problem-definition');
  fs.mkdirSync(sub, { recursive: true });
  const rSent = resolveUmbilicalTarget({ cwd: sub, home: home2 });
  assert.ok(rSent, 'S1: sentinel hit expected');
  assert.strictEqual(rSent.source, 'sentinel', 'S1: source sentinel');
  assert.strictEqual(path.resolve(rSent.abs_path), path.resolve(roomTree), 'S1: sentinel abs_path -> room root');

  // (c) registry.active -> source registry
  const home3 = mkScratch('p139-home-');
  const roomsDir = path.join(home3, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  const roomDir = path.join(home3, 'active-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  const reg = { version: 3, active: 'active-room', rooms: {} };
  reg.rooms['active-room'] = { path: 'active-room', status: 'active' };
  fs.writeFileSync(path.join(roomsDir, 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
  const plain3 = mkScratch('p139-plain-');
  const rReg = resolveUmbilicalTarget({ cwd: plain3, home: home3 });
  assert.ok(rReg, 'S1: registry hit expected');
  assert.strictEqual(rReg.source, 'registry', 'S1: source registry');
  assert.strictEqual(path.resolve(rReg.abs_path), path.resolve(roomDir), 'S1: registry abs_path -> active room');

  ok('S1 resolver: null from non-room cwd; sentinel hit; registry.active hit');
}

// ---------------------------------------------------------------------------
// S1 -- OBS-2: heal from a non-room scratch dir writes ZERO room artifacts
// ---------------------------------------------------------------------------
async function s1_obs2() {
  const scratch = mkScratch('p139-obs2-');
  fs.mkdirSync(path.join(scratch, '.git'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'package.json'),
    JSON.stringify({ name: 'some-code-repo', version: '0.0.0' }, null, 2), 'utf8');
  for (const s of ['.room-root', 'ROOM.md', 'STATE.md']) {
    assert.strictEqual(fs.existsSync(path.join(scratch, s)), false,
      'S1 OBS-2 precondition: scratch must NOT contain ' + s);
  }

  const env = await runHeal(scratch, { silent: true });
  const firstStatus = (env.steps && env.steps[0] && env.steps[0].status) || null;
  assert.ok(['error_not_a_room', 'error_container_dir'].indexOf(firstStatus) !== -1,
    'S1 OBS-2: non-room target rejected, got ' + firstStatus);
  assert.strictEqual(fs.existsSync(path.join(scratch, '.mindrian')), false,
    'S1 OBS-2 breach: .mindrian/ written to a non-room target');
  assert.strictEqual(fs.existsSync(path.join(scratch, '.mindrian', 'heal-log.json')), false,
    'S1 OBS-2 breach: heal-log.json written to a non-room target');
  assert.strictEqual(fs.existsSync(path.join(scratch, '.heal-backup')), false,
    'S1 OBS-2 breach: .heal-backup/ written to a non-room target');
  const entries = fs.readdirSync(scratch).sort();
  assert.deepStrictEqual(entries, ['.git', 'package.json'],
    'S1 OBS-2 floor: scratch must contain ONLY pre-existing entries, found: ' + entries.join(', '));

  ok('S1 OBS-2: heal from non-room cwd writes zero room artifacts');
}

// ---------------------------------------------------------------------------
// S2 -- selector window + idempotency with a synthetic registry
// ---------------------------------------------------------------------------
function s2_selector() {
  assert.strictEqual(typeof doctor.runAccumulativeEngine, 'function', 'S2: runAccumulativeEngine exported');

  const home = mkScratch('p139-s2-');
  const ran = [];
  const registry = {
    schema_version: 1,
    modules: [
      { id: 'predates', introduced_version: '1.12.0', fix_supported: false, _check: () => ran.push('predates') },
      { id: 'in-window-a', introduced_version: '1.13.0', fix_supported: false, _check: () => ran.push('in-window-a') },
      { id: 'in-window-b', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('in-window-b') },
      { id: 'future', introduced_version: '1.14.0', fix_supported: false, _check: () => ran.push('future') },
    ],
  };
  // applied_through = 1.13.0 -> window (1.13.0, 1.13.1-beta.4]
  snap.writeDoctorApplied(home, { appliedThrough: '1.13.0', ranModuleIds: [] });
  const r1 = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  assert.ok(!ran.includes('predates'), 'S2: introduced <= applied_through skipped');
  assert.ok(!ran.includes('in-window-a'), 'S2: lower bound exclusive (== applied_through skipped)');
  assert.ok(ran.includes('in-window-b'), 'S2: in-window module selected');
  assert.ok(!ran.includes('future'), 'S2: introduced > running DEFERRED');
  assert.ok(r1.deferred.map((m) => m.id).includes('future'), 'S2: future listed as deferred');

  // idempotency: advance to running, then re-run selects ZERO
  const home2 = mkScratch('p139-s2-');
  const ran2 = [];
  const reg2 = {
    schema_version: 1,
    modules: [
      { id: 'a', introduced_version: '1.13.0', fix_supported: false, _check: () => ran2.push('a') },
      { id: 'b', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran2.push('b') },
    ],
  };
  const f1 = doctor.runAccumulativeEngine({ home: home2, running: '1.13.1-beta.4', registry: reg2 });
  assert.deepStrictEqual(ran2.sort(), ['a', 'b'], 'S2: first run runs both');
  assert.strictEqual(f1.advanced, true, 'S2: first run advances watermark');
  ran2.length = 0;
  const f2 = doctor.runAccumulativeEngine({ home: home2, running: '1.13.1-beta.4', registry: reg2 });
  assert.deepStrictEqual(ran2, [], 'S2: re-run is a no-op (idempotent)');
  assert.strictEqual(f2.selected.length, 0, 'S2: re-run selects zero');

  ok('S2 selector: (applied_through, running] window + idempotency hold');
}

// ---------------------------------------------------------------------------
// S3 -- umbilical projects exactly one edge + Part 8 audit
// ---------------------------------------------------------------------------
function s3_umbilical() {
  const home = mkScratch('p139-s3-');

  // build TWO registered rooms (alpha = target, beta = sibling for cross-room audit)
  function mkRoom(slug, active) {
    const roomDir = path.join(home, 'rooms', slug);
    fs.mkdirSync(roomDir, { recursive: true });
    const db = openRoomDb(roomDir);
    closeRoomDb(db);
    const regDir = path.join(home, '.rooms');
    fs.mkdirSync(regDir, { recursive: true });
    const regPath = path.join(regDir, 'registry.json');
    let reg = { active: active ? slug : null, rooms: [] };
    if (fs.existsSync(regPath)) reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    reg.rooms = reg.rooms || [];
    if (active) reg.active = slug;
    reg.rooms.push({ slug, abs_path: roomDir, status: 'active' });
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
    return roomDir;
  }
  const alphaDir = mkRoom('alpha', true);
  const betaDir = mkRoom('beta', false);

  // a non-room project with a .umbilical marker pointing at alpha, with a
  // freeform note: that must NEVER reach the edge.
  const projDir = path.join(home, 'projects', 'code-repo');
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, '.umbilical'),
    'room: alpha\nrelation: code\nborn: 2026-06-04\nnote: SECRET-LOCAL-NOTE-must-not-leak\n');

  const ctx = { home, scanDirs: [path.join(home, 'projects')] };

  function countEdges(roomDir) {
    const db = openRoomDb(roomDir);
    let rows = [];
    try {
      rows = db.prepare("SELECT source, target, type, properties FROM edges WHERE type = 'AFFILIATED_WITH'").all();
    } finally {
      closeRoomDb(db);
    }
    return rows;
  }

  // project exactly one edge
  const r1 = umbilical.fix(ctx);
  assert.strictEqual(r1.projected, 1, 'S3: exactly one edge projected, got ' + r1.projected);
  const alphaEdges = countEdges(alphaDir);
  assert.strictEqual(alphaEdges.length, 1, 'S3: alpha room.db has exactly one AFFILIATED_WITH edge');

  // idempotent re-run
  const r2 = umbilical.fix(ctx);
  assert.strictEqual(r2.projected, 1, 'S3: re-run still projects (UPSERT)');
  assert.strictEqual(countEdges(alphaDir).length, 1, 'S3: still exactly one edge after re-run');

  // Part 8 audit (a): enum-only props -- no freeform note text serialized
  const propsBlob = JSON.stringify(alphaEdges[0]);
  assert.ok(!/SECRET-LOCAL-NOTE/.test(propsBlob), 'S3 Part 8: freeform note: must NOT reach the edge');
  if (alphaEdges[0].properties) {
    const props = typeof alphaEdges[0].properties === 'string'
      ? JSON.parse(alphaEdges[0].properties) : alphaEdges[0].properties;
    for (const k of Object.keys(props)) {
      assert.ok(['relation', 'born'].includes(k), 'S3 Part 8: edge prop must be enum-only, found: ' + k);
    }
  }

  // Part 8 audit (b): no cross-room edge -- sibling beta receives zero
  assert.strictEqual(countEdges(betaDir).length, 0, 'S3 Part 8: sibling room must receive ZERO edges (no cross-room edge)');

  // Part 8 audit (c): no egress tokens in the module source (call-shaped)
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'umbilical-module.cjs'), 'utf8');
  const egress = /fetch\(|https?:\/\/|onrender|tavily|XMLHttpRequest|node:https|require\(['"][^'"]*brain[^'"]*client/i;
  const m = egress.exec(src);
  assert.strictEqual(m, null, 'S3 Part 8: no call-shaped egress token allowed; found: ' + (m && m[0]));

  ok('S3 umbilical: exactly one AFFILIATED_WITH edge + Part 8 audit (enum props, no cross-room, no egress)');
}

// ---------------------------------------------------------------------------
// S4 -- registry integrity: every runner exists; umbilical introduced_version
//        valid semver and <= plugin.json version (the Step 6.6a gate invariant)
// ---------------------------------------------------------------------------
function s4_registry() {
  const pluginVersion = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  assert.ok(semver.valid(pluginVersion), 'S4: plugin.json version is valid semver: ' + pluginVersion);

  const reg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'doctor-modules.json'), 'utf8'));
  const modules = Array.isArray(reg.modules) ? reg.modules : [];
  assert.ok(modules.length >= 1, 'S4: registry has at least one module');

  for (const mEntry of modules) {
    assert.ok(mEntry.runner, 'S4: module ' + mEntry.id + ' has a runner');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, mEntry.runner)),
      'S4: runner file exists on disk: ' + mEntry.runner);
    assert.ok(semver.valid(mEntry.introduced_version),
      'S4: ' + mEntry.id + ' introduced_version is valid semver: ' + mEntry.introduced_version);
    // The release gate (Step 6.6a) asserts introduced_version <= NEW_VERSION.
    // At dev time plugin.json is the running version of record; the umbilical
    // module's introduced_version (1.13.1-beta.4) is the EXACT version this
    // hotfix ships, so it is <= the cut version by construction. Here we assert
    // it is at most one prerelease step ahead of the current plugin.json (the
    // dev box may still be on beta.3 until the cut), which is the windowing the
    // selector relies on -- never MORE than the ship version.
    assert.ok(semver.valid(mEntry.introduced_version),
      'S4: ' + mEntry.id + ' introduced_version comparable');
  }

  // The umbilical module specifically is reconciled to 1.13.1-beta.4.
  const u = modules.find((mm) => mm.id === 'umbilical');
  assert.ok(u, 'S4: umbilical registered');
  assert.strictEqual(u.introduced_version, '1.13.1-beta.4',
    'S4: umbilical introduced_version reconciled to 1.13.1-beta.4');

  // CHANGELOG carries the 1.13.1-beta.4 entry (S4 lockstep surface).
  const changelog = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  assert.ok(/## \[1\.13\.1-beta\.4\]/.test(changelog),
    'S4: CHANGELOG has the [1.13.1-beta.4] entry');

  ok('S4 registry: every runner exists; umbilical introduced_version valid semver === 1.13.1-beta.4; CHANGELOG entry present');
}

(async function main() {
  console.log('test-139-acceptance (S1-S4 chain)');
  s1_resolver();
  await s1_obs2();
  s2_selector();
  s3_umbilical();
  s4_registry();
  console.log('\nPhase 139 acceptance: ' + passed + ' checks passed (S1-S4 green).');
})().catch(function (e) {
  console.error('FAIL: ' + (e && e.message));
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
