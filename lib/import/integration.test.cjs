'use strict';

/**
 * Phase 80 Plan 04 integration test.
 *
 * Exercises scripts/vault-import.cjs as a subprocess against the Wave 0
 * fixture vaults and asserts on filesystem state after the full pipeline
 * runs. Covers all four Locked Fix blockers plus the happy / collision /
 * dry-run / nested-refusal paths.
 *
 * Tests:
 *   1   happy path, --yes, tiny-vault end-to-end
 *   1b  team materialized (Blocker 2) -- team/core-team/jane-doe/ tree
 *   1c  meetings filed (Blocker 5)    -- room/meetings/ count matches
 *   1d  ROOM.md coverage (Blocker 1)  -- every imports/ subdir has ROOM.md
 *   2   collision path with collision-vault
 *   3   dry-run (no file moves into sections)
 *   4   Case C nested room refusal (exit 2)
 *   5   no source path -> exit 1
 *   6   skipStub honors .approved marker (Blocker 4)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const pluginRoot = path.resolve(__dirname, '../..');
const script = path.join(pluginRoot, 'scripts/vault-import.cjs');
const tinyVault = path.join(pluginRoot, 'lib/import/test-fixtures/tiny-vault');
const collisionVault = path.join(pluginRoot, 'lib/import/test-fixtures/collision-vault');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vi-' + prefix + '-' + crypto.randomBytes(4).toString('hex') + '-'));
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function scaffoldMinimalRoom(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '---\ngsd_state_version: 1.0\nstatus: executing\n---\n\n# Room\n');
}

function run(args, opts) {
  opts = opts || {};
  const res = spawnSync(process.execPath, [script].concat(args), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* soft */ }
}

function walkRoomMdMissing(root) {
  const missing = [];
  if (!fs.existsSync(root)) return missing;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(dir, entry.name);
      if (!fs.existsSync(path.join(sub, 'ROOM.md'))) missing.push(sub);
      walk(sub);
    }
  }
  walk(root);
  return missing;
}

function countMdFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'ROOM.md' && entry.name !== 'STATE.md' && entry.name !== 'MINTO.md') n++;
    }
  }
  walk(dir);
  return n;
}

// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('ok ' + name + '\n');
    passed++;
  } catch (e) {
    process.stderr.write('FAIL ' + name + '\n  ' + (e.stack || e.message) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1 + 1b + 1c + 1d: happy path + Blocker verifications
// ---------------------------------------------------------------------------
test('happy path + Blockers 1, 2, 5 via tiny-vault --yes', function () {
  const src = tmpDir('happy-src');
  const dst = tmpDir('happy-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);

    const r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'exit code 0 (stderr: ' + r.stderr + ')');

    // Locate import dir
    const importsRoot = path.join(dst, 'imports');
    assert.ok(fs.existsSync(importsRoot), 'imports/ exists');
    const importIds = fs.readdirSync(importsRoot);
    assert.equal(importIds.length, 1, 'exactly one import dir');
    const importDir = path.join(importsRoot, importIds[0]);

    // IMPORT-REPORT.md present
    assert.ok(fs.existsSync(path.join(importDir, 'IMPORT-REPORT.md')), 'IMPORT-REPORT.md exists');

    // MANIFEST stage state
    const manifestPath = path.join(importDir, '01-ingest/output/MANIFEST.json');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(m.stage_states.enrich.status, 'complete', 'enrich stage complete');
    assert.equal(m.stage_states.route.status, 'complete', 'route stage complete');

    // ----- Test 1b: team materialization (Blocker 2) -----
    // Jane Doe should land in team/core-team/ because she is tagged "co-founder"
    const janeDir = path.join(dst, 'team', 'core-team', 'jane-doe');
    assert.ok(fs.existsSync(janeDir), 'team/core-team/jane-doe/ exists');
    assert.ok(fs.existsSync(path.join(janeDir, 'jane-doe.md')), 'jane-doe.md materialized');
    assert.ok(fs.existsSync(path.join(janeDir, 'ROOM.md')), 'jane-doe/ROOM.md materialized');
    assert.ok(fs.existsSync(path.join(janeDir, 'mentions.md')), 'mentions.md materialized');
    assert.ok(fs.existsSync(path.join(janeDir, 'responsibilities.md')), 'responsibilities.md materialized');
    assert.ok(fs.existsSync(path.join(janeDir, 'contracts')), 'contracts/ dir materialized');

    // ----- Test 1c: meeting filing (Blocker 5) -----
    const meetingCount = countMdFiles(path.join(dst, 'meetings'));
    assert.equal(meetingCount, m.meetings.length, 'filed meeting count matches manifest.meetings.length (' + m.meetings.length + ')');
    assert.ok(m.meetings.length > 0, 'at least one meeting detected from tiny-vault');

    // ----- Test 1d: ROOM.md coverage of imports/ (Blocker 1) -----
    const missing = walkRoomMdMissing(importsRoot);
    assert.deepEqual(missing, [], 'every subdir under imports/ has ROOM.md');
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 2: collision path
// ---------------------------------------------------------------------------
test('collision path records collision and uses -imported- suffix', function () {
  const src = tmpDir('coll-src');
  const dst = tmpDir('coll-dst');
  try {
    copyDir(path.join(collisionVault, 'source'), src);
    copyDir(path.join(collisionVault, 'preexisting-room'), dst);

    // Force the source file title to "onboarding" so its slug matches the
    // preexisting room's problem-definition/onboarding/ folder and triggers
    // the -imported-{date} collision path. The fixture ships with
    // title: "Onboarding pain" which would slug to "onboarding-pain" and
    // never collide; this test owns the collision setup.
    fs.writeFileSync(
      path.join(src, 'onboarding.md'),
      '---\ntitle: onboarding\nsection: problem-definition\n---\nColliding body.\n'
    );

    const r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'exit 0 (stderr: ' + r.stderr + ')');

    const importsRoot = path.join(dst, 'imports');
    const importIds = fs.readdirSync(importsRoot);
    const importDir = path.join(importsRoot, importIds[0]);
    const m = JSON.parse(fs.readFileSync(path.join(importDir, '01-ingest/output/MANIFEST.json'), 'utf8'));

    assert.ok((m.collisions || []).length >= 1, 'at least one collision recorded');
    const collided = m.files.find(function (f) { return f.collision; });
    assert.ok(collided, 'a file is flagged collision:true');
    assert.ok(
      (collided.destination_folder || '').indexOf('-imported-') !== -1,
      'destination_folder has -imported- suffix (got: ' + collided.destination_folder + ')'
    );
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 3: dry-run
// ---------------------------------------------------------------------------
test('dry-run produces classifications.md but moves no files into sections', function () {
  const src = tmpDir('dry-src');
  const dst = tmpDir('dry-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);

    const r = run(['--path', src, '--room', dst, '--dry-run']);
    assert.equal(r.code, 0, 'exit 0');

    // classifications.md present
    const importsRoot = path.join(dst, 'imports');
    const importIds = fs.readdirSync(importsRoot);
    const classMd = path.join(importsRoot, importIds[0], '02-classify/output/classifications.md');
    assert.ok(fs.existsSync(classMd), 'classifications.md exists');

    // Section folders must NOT exist (no routing happened)
    assert.ok(!fs.existsSync(path.join(dst, 'problem-definition')), 'no problem-definition/ section');
    assert.ok(!fs.existsSync(path.join(dst, 'business-model')), 'no business-model/ section');
    assert.ok(!fs.existsSync(path.join(dst, 'inbox')), 'no inbox/ section');
    assert.ok(!fs.existsSync(path.join(dst, 'team')), 'no team/ materialized in dry-run');
    assert.ok(!fs.existsSync(path.join(dst, 'meetings')), 'no meetings/ filed in dry-run');
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Case C nested room refusal
// ---------------------------------------------------------------------------
test('Case C nested room refuses with exit 2', function () {
  const src = tmpDir('nested-src');
  const outer = tmpDir('nested-outer');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(outer);
    const inner = path.join(outer, 'sub-room');
    fs.mkdirSync(inner, { recursive: true });

    const r = run(['--path', src, '--room', inner]);
    assert.equal(r.code, 2, 'exit 2 for nested room (got ' + r.code + ', stderr=' + r.stderr + ')');
    assert.ok(/nested inside/.test(r.stderr), 'stderr mentions nested inside');
  } finally {
    cleanup(src);
    cleanup(outer);
  }
});

// ---------------------------------------------------------------------------
// Test 5: no source path
// ---------------------------------------------------------------------------
test('missing --path exits 1', function () {
  const r = run([]);
  assert.equal(r.code, 1, 'exit 1');
  assert.ok(/--path is required/.test(r.stderr), 'stderr mentions --path is required');
});

// ---------------------------------------------------------------------------
// Test 6: skipStub honors .approved marker (Blocker 4)
// ---------------------------------------------------------------------------
test('Blocker 4 -- .approved marker routes Larry-edited classifications back into manifest', function () {
  const src = tmpDir('skip-src');
  const dst = tmpDir('skip-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);

    // First run without --yes to populate classifications.md
    let r = run(['--path', src, '--room', dst]);
    assert.equal(r.code, 0, 'first run exit 0');

    const importIds = fs.readdirSync(path.join(dst, 'imports'));
    const importDir = path.join(dst, 'imports', importIds[0]);
    const classMd = path.join(importDir, '02-classify/output/classifications.md');
    assert.ok(fs.existsSync(classMd), 'classifications.md created');

    // Edit the random.md row: force section to problem-definition + decision AUTO
    let md = fs.readFileSync(classMd, 'utf8');
    const lines = md.split('\n');
    let edited = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('random.md') !== -1 && lines[i].startsWith('|')) {
        lines[i] = '| notes/random.md | problem-definition | 0.90 | edited by test | AUTO |';
        edited = true;
        break;
      }
    }
    assert.ok(edited, 'found random.md row to edit');
    fs.writeFileSync(classMd, lines.join('\n'));

    // Touch .approved
    fs.writeFileSync(path.join(importDir, '02-classify/output/.approved'), '');

    // Second run with --yes
    r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'second run exit 0 (stderr=' + r.stderr + ')');

    // Confirm classification persisted into manifest
    const m = JSON.parse(fs.readFileSync(path.join(importDir, '01-ingest/output/MANIFEST.json'), 'utf8'));
    const editedFile = m.files.find(function (f) {
      return f.source_path === 'notes/random.md';
    });
    assert.ok(editedFile, 'random.md in manifest');
    assert.ok(editedFile.classification, 'random.md has classification');
    assert.equal(editedFile.classification.section, 'problem-definition', 'section preserved from Larry edit');
    assert.equal(editedFile.classification.decision, 'AUTO', 'decision preserved from Larry edit');
    // And the file should have been routed into problem-definition/
    assert.equal(editedFile.destination_section, 'problem-definition', 'routed into problem-definition/');
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 7 (Phase 80-06): /mos: Usability Check section populated in report
// ---------------------------------------------------------------------------
test('Phase 80-06: IMPORT-REPORT.md has populated /mos: Usability Check section', function () {
  const src = tmpDir('usab-src');
  const dst = tmpDir('usab-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);

    const r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'exit 0 (stderr=' + r.stderr + ')');

    const importsRoot = path.join(dst, 'imports');
    const importIds = fs.readdirSync(importsRoot);
    const reportPath = path.join(importsRoot, importIds[0], 'IMPORT-REPORT.md');
    assert.ok(fs.existsSync(reportPath), 'report exists');

    const report = fs.readFileSync(reportPath, 'utf8');
    assert.match(report, /## \/mos: Usability Check/, '/mos: Usability Check heading present');
    // Must be populated -- placeholder text from 80-05 must be gone
    assert.ok(!/Placeholder -- populated by Phase 80 Plan 06/.test(report), 'placeholder text replaced');
    assert.match(report, /method: (mindrian-tools|compute-state|none)/, 'method line present');
    assert.match(report, /passed: (true|false)/, 'passed line present');

    // Also assert branding applied: at least one artifact in the room has the footer
    // and canonical frontmatter (proves Task 1 hook fires end-to-end too).
    const problemDir = path.join(dst, 'problem-definition');
    if (fs.existsSync(problemDir)) {
      let found = false;
      function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'ROOM.md' && e.name !== 'STATE.md' && e.name !== 'MINTO.md') {
            const c = fs.readFileSync(p, 'utf8');
            if (c.includes('MindrianOS') && /status: imported/.test(c)) { found = true; return; }
          }
        }
      }
      walk(problemDir);
      assert.ok(found, 'at least one problem-definition artifact has MindrianOS footer + canonical frontmatter');
    }
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('all passing\n');
