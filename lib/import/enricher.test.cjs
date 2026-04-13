'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  enrichRoom,
  buildRoomMdScaffold,
  buildSectionStateMd,
  teamProfilesFromManifest,
  MINTO_STUB
} = require('./enricher.cjs');

function mkTmp(label) {
  const dir = path.join(
    os.tmpdir(),
    'enricher-test-' + label + '-' + crypto.randomBytes(6).toString('hex')
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRoom(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '# STATE\n');
}

// Build a manifest with pre-routed files directly on disk at the given
// destination layout (we simulate Stage 03's output without invoking the
// router, since router is tested separately).
function makeRoutedFile(roomDir, section, slug, body) {
  const folderRel = path.join(section, slug);
  const folderAbs = path.join(roomDir, folderRel);
  fs.mkdirSync(folderAbs, { recursive: true });
  const abs = path.join(folderAbs, slug + '.md');
  fs.writeFileSync(abs, body || '# ' + slug + '\n');
  return {
    id: 'f-' + slug,
    source_path: slug + '.md',
    source_abs_path: abs,
    source_size: 1,
    source_mtime: new Date().toISOString(),
    source_hash: 'h',
    source_frontmatter: {},
    source_wikilinks: [],
    destination_section: section.split(path.sep)[0],
    destination_folder: folderRel,
    destination_path: path.join(folderRel, slug + '.md'),
    destination_abs_path: abs,
    collision: false
  };
}

function baseManifest(roomDir) {
  return {
    schema_version: '1.0',
    import_id: '2026-04-13-test',
    created_at: new Date().toISOString(),
    source_vault: '/fake/vault',
    destination_room: roomDir,
    mode: 'copy',
    status: 'in_progress',
    stage_states: {
      ingest:   { status: 'complete', completed_at: null, files_scanned: 0 },
      classify: { status: 'complete', completed_at: null, human_edited: false, edits_count: 0 },
      route:    { status: 'complete', completed_at: null, files_moved: 0, collisions: 0 },
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

// ---------- Test 1: ROOM.md scaffold at leaf folders ----------
(function test_room_md_scaffold() {
  const room = mkTmp('scaffold');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  m.files.push(makeRoutedFile(room, 'problem-definition', 'pricing'));
  m.files.push(makeRoutedFile(room, 'problem-definition', 'scaling'));
  const stats = enrichRoom(m);

  // Leaf ROOM.md should exist
  const leafRoom = path.join(room, 'problem-definition', 'onboarding', 'ROOM.md');
  assert.ok(fs.existsSync(leafRoom));
  const content = fs.readFileSync(leafRoom, 'utf8');
  assert.match(content, /icm_layer: 0/);
  assert.match(content, /problem-definition/);

  // Parent ROOM.md at section root should also exist.
  const sectionRoom = path.join(room, 'problem-definition', 'ROOM.md');
  assert.ok(fs.existsSync(sectionRoom));
  const secContent = fs.readFileSync(sectionRoom, 'utf8');
  assert.match(secContent, /child_count: 3/);
  assert.ok(stats.rooms_md_created >= 4);
  console.log('ok test_room_md_scaffold');
})();

// ---------- Test 2: per-section STATE.md (IMPORT-04) ----------
(function test_per_section_state_md() {
  const room = mkTmp('state');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  m.files.push(makeRoutedFile(room, 'business-model', 'pricing-model'));
  m.files.push(makeRoutedFile(room, path.join('inbox', 'suggested'), 'maybe-this'));
  m.files[2].destination_section = 'inbox';
  const stats = enrichRoom(m);

  const pdState = path.join(room, 'problem-definition', 'STATE.md');
  assert.ok(fs.existsSync(pdState));
  const pd = fs.readFileSync(pdState, 'utf8');
  assert.match(pd, /onboarding/);

  const bmState = path.join(room, 'business-model', 'STATE.md');
  assert.ok(fs.existsSync(bmState));

  const inboxState = path.join(room, 'inbox', 'STATE.md');
  assert.ok(fs.existsSync(inboxState));
  const inboxText = fs.readFileSync(inboxState, 'utf8');
  assert.match(inboxText, /maybe-this/);

  assert.equal(stats.state_md_created, 3);
  console.log('ok test_per_section_state_md');
})();

// ---------- Test 3: MINTO.md stub format ----------
(function test_minto_stub() {
  const room = mkTmp('minto');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  const stats = enrichRoom(m);
  const mintoPath = path.join(room, 'problem-definition', 'MINTO.md');
  assert.ok(fs.existsSync(mintoPath));
  const content = fs.readFileSync(mintoPath, 'utf8');
  assert.match(content, /WARNING: Empty scaffold\. Run `\/mos:reason/);
  assert.equal(stats.minto_stubs_created, 1);
  console.log('ok test_minto_stub');
})();

// ---------- Test 4: idempotent ----------
(function test_idempotent() {
  const room = mkTmp('idem');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  const first = enrichRoom(m);
  const second = enrichRoom(m);
  assert.ok(first.rooms_md_created > 0);
  assert.equal(second.rooms_md_created, 0);
  assert.equal(second.state_md_created, 0);
  assert.equal(second.minto_stubs_created, 0);
  console.log('ok test_idempotent');
})();

// ---------- Test 5: wikilink invocation ----------
(function test_wikilink_invocation() {
  const room = mkTmp('wl');
  makeRoom(room);
  const m = baseManifest(room);
  // Artifact body mentions "Jane Doe" (capital J, whole word).
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding', '# Onboarding\n\nJane Doe helped here.\n'));
  m.people.push({
    name: 'Jane Doe',
    slug: 'jane-doe',
    displayName: 'Jane Doe',
    role_bucket: 'core-team',
    profile_path: 'team/core-team/jane-doe/jane-doe.md'
  });
  const stats = enrichRoom(m);
  const written = fs.readFileSync(m.files[0].destination_abs_path, 'utf8');
  assert.match(written, /\[\[team\/core-team\/jane-doe/);
  assert.ok(stats.wikilinks_added >= 1);
  console.log('ok test_wikilink_invocation');
})();

// ---------- Test 6: source wikilink rewrite (IMPORT-08) ----------
(function test_source_wikilink_rewrite() {
  const room = mkTmp('swl');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  m.files[0].source_wikilinks = ['jane-doe', 'nonexistent-target'];
  m.people.push({
    name: 'Jane Doe',
    slug: 'jane-doe',
    displayName: 'Jane Doe',
    role_bucket: 'core-team',
    profile_path: 'team/core-team/jane-doe/jane-doe.md'
  });
  const stats = enrichRoom(m);
  const content = fs.readFileSync(m.files[0].destination_abs_path, 'utf8');
  assert.match(content, /Related: \[\[team\/core-team\/jane-doe\/jane-doe\.md\]\]/);
  assert.ok(stats.unresolved_wikilinks.some(function (u) { return u.link === 'nonexistent-target'; }));
  console.log('ok test_source_wikilink_rewrite');
})();

// ---------- Test 7: inbox sub-branches get ROOM.md ----------
(function test_inbox_room_md() {
  const room = mkTmp('inboxroom');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, path.join('inbox', 'suggested'), 'maybe-one'));
  m.files.push(makeRoutedFile(room, path.join('inbox', 'unclassified'), 'dunno'));
  m.files[0].destination_section = 'inbox';
  m.files[1].destination_section = 'inbox';
  enrichRoom(m);
  assert.ok(fs.existsSync(path.join(room, 'inbox', 'ROOM.md')));
  assert.ok(fs.existsSync(path.join(room, 'inbox', 'suggested', 'ROOM.md')));
  assert.ok(fs.existsSync(path.join(room, 'inbox', 'unclassified', 'ROOM.md')));
  assert.ok(fs.existsSync(path.join(room, 'inbox', 'suggested', 'maybe-one', 'ROOM.md')));
  console.log('ok test_inbox_room_md');
})();

// ---------- Test 8: failure tolerance ----------
(function test_failure_tolerance() {
  const room = mkTmp('ft');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'good'));
  // Add a phantom file with non-existent destination_abs_path.
  m.files.push({
    id: 'phantom',
    source_path: 'phantom.md',
    destination_section: 'problem-definition',
    destination_folder: path.join('problem-definition', 'phantom'),
    destination_path: path.join('problem-definition', 'phantom', 'phantom.md'),
    destination_abs_path: path.join(room, 'problem-definition', 'phantom', 'nope.md'),
    source_wikilinks: []
  });
  // Should not throw.
  const stats = enrichRoom(m);
  assert.ok(stats.rooms_md_created > 0);
  console.log('ok test_failure_tolerance');
})();

// ---------- Test 9: MWP edge naming declared ----------
(function test_mwp_edges_declared() {
  const room = mkTmp('mwp');
  makeRoom(room);
  const m = baseManifest(room);
  m.files.push(makeRoutedFile(room, 'problem-definition', 'onboarding'));
  enrichRoom(m);
  const content = fs.readFileSync(path.join(room, 'problem-definition', 'onboarding', 'ROOM.md'), 'utf8');
  assert.match(content, /<!-- mwp_edges:/);
  assert.match(content, /INFORMS/);
  assert.match(content, /CONVERGES/);
  console.log('ok test_mwp_edges_declared');
})();

// ---------- Helper: teamProfilesFromManifest shape ----------
(function test_team_profiles_shape() {
  const profiles = teamProfilesFromManifest({
    people: [{ slug: 'jane-doe', displayName: 'Jane Doe', role_bucket: 'core-team' }]
  });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'jane-doe');
  assert.equal(profiles[0].displayName, 'Jane Doe');
  assert.equal(profiles[0].category, 'core-team');
  assert.match(profiles[0].path, /team\/core-team\/jane-doe\/jane-doe\.md/);
  console.log('ok test_team_profiles_shape');
})();

console.log('ALL enricher tests passed');
