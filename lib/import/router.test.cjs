'use strict';

/**
 * Tests for lib/import/router.cjs -- Phase 80 Stage 03.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const {
  routeFiles,
  pickSlug,
  slugifyTitle,
  resolveSectionSubpath,
  nextNonCollidingFolder,
  INBOX_SUGGESTED_THRESHOLD
} = require('./router.cjs');

function mkTmp(label) {
  const dir = path.join(
    os.tmpdir(),
    'router-test-' + label + '-' + crypto.randomBytes(6).toString('hex')
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRoom(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '# STATE\n');
}

function makeSourceFile(dir, name, content) {
  const abs = path.join(dir, name);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content || '# ' + name + '\n');
  return abs;
}

function baseManifest(roomDir, sourceVault) {
  return {
    schema_version: '1.0',
    import_id: '2026-04-13-problem-solution',
    created_at: new Date().toISOString(),
    source_vault: sourceVault,
    destination_room: roomDir,
    mode: 'copy',
    status: 'in_progress',
    main_topic: null,
    main_topic_source: null,
    stage_states: {
      ingest:   { status: 'complete', completed_at: null, files_scanned: 0 },
      classify: { status: 'complete', completed_at: null, human_edited: false, edits_count: 0 },
      route:    { status: 'pending', completed_at: null, files_moved: 0, collisions: 0 },
      enrich:   { status: 'pending', completed_at: null, wikilinks_added: 0, rooms_md_created: 0, minto_stubs_created: 0 }
    },
    files: [],
    people: [],
    meetings: [],
    collisions: [],
    warnings: [],
    undo: { is_undone: false, undone_at: null, undone_to_directory: null }
  };
}

function makeFile(id, abs, section, confidence, extras) {
  const f = {
    id: id,
    source_path: path.basename(abs),
    source_abs_path: abs,
    source_size: fs.statSync(abs).size,
    source_mtime: new Date().toISOString(),
    source_hash: 'hash-' + id,
    source_frontmatter: (extras && extras.source_frontmatter) || {},
    source_wikilinks: (extras && extras.source_wikilinks) || [],
    parent_folder: null,
    classification: {
      section: section,
      confidence: confidence,
      evidence: 'test',
      decision: 'AUTO',
      stage: 'classify'
    },
    collision: false
  };
  return f;
}

// ---------- Test 1: slug rules ----------
(function test_slug_rules() {
  assert.equal(slugifyTitle('Onboarding pain'), 'onboarding-pain');
  assert.equal(slugifyTitle('Hello, World!'), 'hello-world');
  assert.equal(slugifyTitle('A'.repeat(200)).length, 60);
  console.log('ok test_slug_rules');
})();

// ---------- Test 2: frontmatter title override ----------
(function test_frontmatter_title_override() {
  const f = {
    source_path: 'p.md',
    source_frontmatter: { title: 'Pricing model' }
  };
  assert.equal(pickSlug(f), 'pricing-model');
})();
console.log('ok test_frontmatter_title_override');

// ---------- Test 3: nested layout + full routing happy path ----------
(function test_nested_layout() {
  const root = mkTmp('nested');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  fs.mkdirSync(src, { recursive: true });
  const a = makeSourceFile(src, 'onboarding-pain.md', '---\ntitle: Onboarding pain\n---\nbody\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  routeFiles(m);
  const expectedFolder = path.join('problem-definition', 'onboarding-pain');
  const expectedPath = path.join(expectedFolder, 'onboarding-pain.md');
  assert.equal(m.files[0].destination_folder, expectedFolder);
  assert.equal(m.files[0].destination_path, expectedPath);
  assert.equal(m.files[0].destination_section, 'problem-definition');
  assert.ok(fs.existsSync(path.join(room, expectedPath)));
  console.log('ok test_nested_layout');
})();

// ---------- Test 4 + 5 + 6: inbox branching ----------
(function test_inbox_branching() {
  const root = mkTmp('inbox');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const hi = makeSourceFile(src, 'high.md', '# high\n');
  const lo = makeSourceFile(src, 'low.md', '# low\n');
  const edgeHi = makeSourceFile(src, 'edge-hi.md', '# edge hi\n');
  const edgeLo = makeSourceFile(src, 'edge-lo.md', '# edge lo\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f-hi', hi, 'inbox', 0.6));
  m.files.push(makeFile('f-lo', lo, 'inbox', 0.3));
  m.files.push(makeFile('f-edge-hi', edgeHi, 'inbox', 0.45));
  m.files.push(makeFile('f-edge-lo', edgeLo, 'inbox', 0.4499));
  routeFiles(m);

  const byId = {};
  m.files.forEach(function (f) { byId[f.id] = f; });

  assert.ok(byId['f-hi'].destination_folder.startsWith('inbox' + path.sep + 'suggested'));
  assert.ok(byId['f-hi'].destination_path.endsWith('high.md'));
  assert.ok(byId['f-lo'].destination_folder.startsWith('inbox' + path.sep + 'unclassified'));
  assert.ok(byId['f-edge-hi'].destination_folder.startsWith('inbox' + path.sep + 'suggested'));
  assert.ok(byId['f-edge-lo'].destination_folder.startsWith('inbox' + path.sep + 'unclassified'));

  // destination_section top-level should be "inbox"
  assert.equal(byId['f-hi'].destination_section, 'inbox');
  assert.equal(byId['f-lo'].destination_section, 'inbox');
  console.log('ok test_inbox_branching');

  // resolveSectionSubpath direct check
  assert.equal(
    resolveSectionSubpath({ section: 'inbox', confidence: 0.45 }, 'x'),
    path.join('inbox', 'suggested', 'x')
  );
  assert.equal(
    resolveSectionSubpath({ section: 'inbox', confidence: 0.44 }, 'x'),
    path.join('inbox', 'unclassified', 'x')
  );
  assert.equal(INBOX_SUGGESTED_THRESHOLD, 0.45);
})();

// ---------- Test 7 + 8: collision handling ----------
(function test_collision() {
  const root = mkTmp('collision');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  // Pre-existing room section with the same slug.
  fs.mkdirSync(path.join(room, 'problem-definition', 'onboarding'), { recursive: true });
  fs.writeFileSync(path.join(room, 'problem-definition', 'onboarding', 'onboarding.md'), '# old\n');

  const a = makeSourceFile(src, 'onboarding.md', '# new\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  routeFiles(m);

  const dateSlug = m.import_id.slice(0, 10);
  const expected = path.join('problem-definition', 'onboarding-imported-' + dateSlug);
  assert.equal(m.files[0].destination_folder, expected);
  assert.equal(m.collisions.length, 1);
  assert.equal(m.collisions[0].reason, 'destination_folder_exists');
  assert.equal(m.files[0].collision, true);

  // Test 8: N+1 collision
  const b = makeSourceFile(src, 'onboarding-2.md', '---\ntitle: onboarding\n---\n# newer\n');
  const m2 = baseManifest(room, src);
  m2.files.push(makeFile('f2', b, 'problem-definition', 0.9, { source_frontmatter: { title: 'onboarding' } }));
  routeFiles(m2);
  // Base exists AND -imported-{date} exists, so should be -imported-{date}-2
  assert.ok(m2.files[0].destination_folder.endsWith('-imported-' + dateSlug + '-2'));
  console.log('ok test_collision');
})();

// ---------- Test 9: refuse no STATE.md ----------
(function test_refuse_no_state() {
  const root = mkTmp('nostate');
  const room = path.join(root, 'room');
  fs.mkdirSync(room, { recursive: true });
  // No STATE.md written.
  const src = path.join(root, 'vault');
  const a = makeSourceFile(src, 'a.md', '# a\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  assert.throws(function () { routeFiles(m); }, /STATE.md/);
  // Nothing should have been written.
  assert.equal(fs.existsSync(path.join(room, 'problem-definition')), false);
  console.log('ok test_refuse_no_state');
})();

// ---------- Test 10: provenance frontmatter ----------
(function test_provenance() {
  const root = mkTmp('prov');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const a = makeSourceFile(src, 'a.md', '# a\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  routeFiles(m);
  const written = fs.readFileSync(m.files[0].destination_abs_path, 'utf8');
  assert.match(written, /_imported_from:/);
  assert.match(written, /source_vault:/);
  console.log('ok test_provenance');
})();

// ---------- Test 11: copy mode leaves source ----------
(function test_copy_mode() {
  const root = mkTmp('copy');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const a = makeSourceFile(src, 'a.md', '# a\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  routeFiles(m);
  assert.ok(fs.existsSync(a), 'source file must still exist in copy mode');
  console.log('ok test_copy_mode');
})();

// ---------- Test 12: move mode unlinks source ----------
(function test_move_mode() {
  const root = mkTmp('move');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const a = makeSourceFile(src, 'a.md', '# a\n');
  const m = baseManifest(room, src);
  m.mode = 'move';
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  routeFiles(m);
  assert.equal(fs.existsSync(a), false, 'source file must be unlinked in move mode');
  console.log('ok test_move_mode');
})();

// ---------- Test 13: meetings detour ----------
(function test_meetings_detour() {
  const root = mkTmp('meet');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const a = makeSourceFile(src, '2026-01-15-team-sync.md', '# sync\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'meetings', 0.9));
  m.meetings.push({ source_file_id: 'f1' });
  routeFiles(m);
  assert.equal(m.files[0].destination_section, 'meetings-pending');
  assert.ok(m.files[0].destination_folder.includes('meetings-pending'));
  assert.ok(m.files[0].destination_path.includes('imports' + path.sep));
  assert.ok(fs.existsSync(m.files[0].destination_abs_path));
  console.log('ok test_meetings_detour');
})();

// ---------- Test 14: manifest update ----------
(function test_manifest_update() {
  const root = mkTmp('mu');
  const room = path.join(root, 'room');
  const src = path.join(root, 'vault');
  makeRoom(room);
  const a = makeSourceFile(src, 'a.md', '# a\n');
  const b = makeSourceFile(src, 'b.md', '# b\n');
  const m = baseManifest(room, src);
  m.files.push(makeFile('f1', a, 'problem-definition', 0.9));
  m.files.push(makeFile('f2', b, 'business-model', 0.9));
  routeFiles(m);
  assert.equal(m.stage_states.route.status, 'complete');
  assert.equal(m.stage_states.route.files_moved, 2);
  assert.equal(m.stage_states.route.collisions, 0);
  assert.ok(m.stage_states.route.completed_at);
  console.log('ok test_manifest_update');
})();

// ---------- nextNonCollidingFolder direct ----------
(function test_next_non_colliding_direct() {
  const root = mkTmp('nncf');
  const room = path.join(root, 'room');
  makeRoom(room);
  // Fresh folder -- no collision.
  const r = nextNonCollidingFolder(room, path.join('section', 'x'), '2026-04-13');
  assert.equal(r.collided, false);
  assert.equal(r.folder, path.join('section', 'x'));
  console.log('ok test_next_non_colliding_direct');
})();

// ---------- create-speaker-profile --layout=import smoke test ----------
(function test_create_speaker_profile_layout_import() {
  const root = mkTmp('csp');
  // Script requires room_dir to exist.
  makeRoom(path.join(root, 'room'));
  const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'create-speaker-profile');
  const res = spawnSync('bash', [
    scriptPath,
    path.join(root, 'room'),
    '--layout=import',
    '--role-bucket=core-team',
    'jane-doe',
    'Jane Doe'
  ], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error('stdout:', res.stdout);
    console.error('stderr:', res.stderr);
  }
  assert.equal(res.status, 0, 'create-speaker-profile --layout=import must exit 0');
  const personDir = path.join(root, 'room', 'team', 'core-team', 'jane-doe');
  assert.ok(fs.existsSync(path.join(personDir, 'jane-doe.md')), 'jane-doe.md missing');
  assert.ok(fs.existsSync(path.join(personDir, 'ROOM.md')), 'ROOM.md missing');
  assert.ok(fs.existsSync(path.join(personDir, 'mentions.md')), 'mentions.md missing');
  assert.ok(fs.existsSync(path.join(personDir, 'responsibilities.md')), 'responsibilities.md missing');
  assert.ok(fs.existsSync(path.join(personDir, 'contracts')), 'contracts/ missing');
  assert.ok(fs.existsSync(path.join(personDir, 'contracts', 'ROOM.md')), 'contracts/ROOM.md missing');
  console.log('ok test_create_speaker_profile_layout_import');

  // Missing --role-bucket should exit 1.
  const res2 = spawnSync('bash', [
    scriptPath,
    path.join(root, 'room'),
    '--layout=import',
    'bob-smith',
    'Bob Smith'
  ], { encoding: 'utf8' });
  assert.notEqual(res2.status, 0, 'missing --role-bucket must fail');
  console.log('ok test_create_speaker_profile_missing_role_bucket');
})();

console.log('ALL router tests passed');
