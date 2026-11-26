'use strict';
// Phase 400.4 plan 06 (QA-F9): Eureka projection file excerpt.
// Legs E1 to E5: the contained reader and the projection fallback.
// Legs E6 and E7 are added with the tool wiring (Task 2).
// Local only: no network. Every room is a temp dir.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const containment = require('../lib/core/room-path-containment.cjs');
const projection = require('../lib/core/navigation/engine-projection.cjs');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400.4-excerpt-'));
const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400.4-excerpt-out-'));
const roomDir = path.join(tmpRoot, 'room');
fs.mkdirSync(path.join(roomDir, 'market-analysis', 'note-a'), { recursive: true });

const BODY_LONG = ('abcdefghij'.repeat(1000)); // 10,000 characters
const NOTE_A = path.join(roomDir, 'market-analysis', 'note-a', 'note-a.md');
fs.writeFileSync(NOTE_A, '---\ntitle: Note A\nsection: market-analysis\n---\n\n' + BODY_LONG);

function leg(name, fn) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
  } catch (e) {
    process.stdout.write('FAIL ' + name + ': ' + (e && e.message ? e.message.split('\n')[0] : e) + '\n');
    process.exitCode = 1;
    legFailures.push(name);
  }
}
const legFailures = [];
const asyncLegs = [];

// E1: frontmatter removed, first 4,000 characters of the body, truncated true.
leg('E1 reader returns the bounded body without frontmatter', () => {
  const r = containment.readContainedTextExcerpt(roomDir, 'market-analysis/note-a/note-a.md', { maxChars: 4000 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.text, BODY_LONG.slice(0, 4000));
  assert.equal(r.truncated, true);
  assert.equal(r.text.includes('title: Note A'), false);
  // A short file is not truncated.
  fs.mkdirSync(path.join(roomDir, 'market-analysis', 'short'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'market-analysis', 'short', 'short.md'), 'A short body.\n');
  const s = containment.readContainedTextExcerpt(roomDir, 'market-analysis/short/short.md', { maxChars: 4000 });
  assert.equal(s.ok, true);
  assert.equal(s.truncated, false);
  assert.equal(s.text.trim(), 'A short body.');
});

// E2: refusals, nothing outside the room is read.
leg('E2 reader refuses unsafe, wrong-type and escaping paths', () => {
  fs.writeFileSync(path.join(tmpRoot, 'outside.md'), 'OUTSIDE SECRET');
  fs.writeFileSync(path.join(outsideDir, 'leak.md'), 'LEAK SECRET');
  fs.writeFileSync(path.join(roomDir, 'x.txt'), 'plain text');
  try { fs.symlinkSync(path.join(outsideDir, 'leak.md'), path.join(roomDir, 'link.md')); } catch (_e) { /* skip when symlinks are not allowed */ }
  try { fs.symlinkSync(outsideDir, path.join(roomDir, 'linkdir')); } catch (_e) { /* skip */ }
  const cases = [
    ['../outside.md', 'path_outside_room'],
    ['/etc/passwd', 'path_outside_room'],
    ['a\u0000b.md', 'path_outside_room'],
    ['a/'.repeat(201) + 'b.md', 'path_outside_room'],
    ['x.txt', 'not_markdown'],
    ['missing/none.md', 'not_found'],
  ];
  for (const [rel, reason] of cases) {
    const r = containment.readContainedTextExcerpt(roomDir, rel, { maxChars: 4000 });
    assert.equal(r.ok, false, rel);
    assert.equal(r.reason, reason, rel + ' -> ' + r.reason);
    assert.equal(r.text, undefined);
  }
  if (fs.existsSync(path.join(roomDir, 'link.md'))) {
    const r = containment.readContainedTextExcerpt(roomDir, 'link.md', { maxChars: 4000 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'path_outside_room');
  }
  if (fs.existsSync(path.join(roomDir, 'linkdir'))) {
    const r = containment.readContainedTextExcerpt(roomDir, 'linkdir/leak.md', { maxChars: 4000 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'path_outside_room');
  }
  // A directory named like a markdown file is not a file.
  fs.mkdirSync(path.join(roomDir, 'dir.md'));
  const d = containment.readContainedTextExcerpt(roomDir, 'dir.md', { maxChars: 4000 });
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'not_found');
  // Never throws on odd input.
  assert.doesNotThrow(() => containment.readContainedTextExcerpt(null, null, null));
  assert.equal(containment.readContainedTextExcerpt(roomDir, 42, {}).ok, false);
});

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
  db.exec('CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
  return db;
}

const ART_ID = 'market-analysis/note-a/note-a';
const reader = (id) => {
  const r = containment.readContainedTextExcerpt(roomDir, id + '.md', { maxChars: projection.FILE_EXCERPT_CHARS });
  return r.ok ? r : null;
};

// E3: an Artifact with no text property gets the excerpt.
leg('E3 artifact without text gets the file excerpt', () => {
  assert.equal(projection.FILE_EXCERPT_CHARS, 4000);
  const db = makeDb();
  try {
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run(ART_ID, 'Artifact', JSON.stringify({ title: 'Note A', section: 'market-analysis', content_hash: 'abc' }));
    const out = projection.projectEngineSnapshot(db, { node_ids: [ART_ID], scope_id: 'room-1' }, { readArtifactText: reader });
    const node = out.snapshot.nodes[0];
    const expected = BODY_LONG.slice(0, 4000);
    assert.equal(node.text, expected);
    assert.equal(node.text_truncated, true);
    assert.equal(node.text_sha256, sha(expected));
    assert.deepEqual(out.text_from_file, { nodes: 1, char_cap: 4000 });
    assert.equal(out.snapshot.meta.omissions.empty_text_nodes, 0);
    assert.equal(Object.hasOwn(node, 'text_from_file'), false, 'snapshot node shape is unchanged');
  } finally { db.close(); }
});

// E4: a node with a text property keeps the base; a failing reader leaves it empty.
leg('E4 text property wins; failing reader leaves text empty and counted', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('claim:x', 'claim', JSON.stringify({ title: 'X', body: 'Own body text.' }));
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('art-with-text', 'Artifact', JSON.stringify({ title: 'T', text: 'Property text wins.' }));
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('art-empty', 'Artifact', JSON.stringify({ title: 'Empty' }));
    let calls = [];
    const spy = (id) => { calls.push(id); return 'SHOULD NOT BE USED'; };
    const withSpy = projection.projectEngineSnapshot(db, { node_ids: ['claim:x', 'art-with-text'], scope_id: 'room-1' }, { readArtifactText: spy });
    assert.deepEqual(calls, [], 'reader is not called when a text property exists or the type is not Artifact');
    const base = projection.projectEngineSnapshot(db, { node_ids: ['claim:x', 'art-with-text'], scope_id: 'room-1' });
    assert.deepEqual(withSpy.snapshot.nodes, base.snapshot.nodes);
    assert.equal(withSpy.text_from_file.nodes, 0);
    const thrower = () => { throw new Error('boom'); };
    const a = projection.projectEngineSnapshot(db, { node_ids: ['art-empty'], scope_id: 'room-1' }, { readArtifactText: thrower });
    assert.equal(a.snapshot.nodes[0].text, '');
    assert.equal(a.snapshot.meta.omissions.empty_text_nodes, 1);
    const b = projection.projectEngineSnapshot(db, { node_ids: ['art-empty'], scope_id: 'room-1' }, { readArtifactText: () => null });
    assert.equal(b.snapshot.nodes[0].text, '');
    assert.equal(b.snapshot.meta.omissions.empty_text_nodes, 1);
    assert.equal(b.text_from_file.nodes, 0);
  } finally { db.close(); }
});

// E5: no third argument gives the base output; omissions keep the 6 base keys.
leg('E5 no reader: output equals base and omissions keep six keys', () => {
  const db = makeDb();
  try {
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run(ART_ID, 'Artifact', JSON.stringify({ title: 'Note A' }));
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run('claim:y', 'claim', JSON.stringify({ title: 'Y', text: 'Why.' }));
    const req = { node_ids: [ART_ID, 'claim:y'], scope_id: 'room-1' };
    const noReader = projection.projectEngineSnapshot(db, req);
    const emptyOpts = projection.projectEngineSnapshot(db, req, {});
    assert.equal(noReader.snapshot_id, emptyOpts.snapshot_id);
    assert.deepEqual(noReader.snapshot.nodes, emptyOpts.snapshot.nodes);
    assert.equal(noReader.snapshot.nodes.find((n) => n.id === ART_ID).text, '');
    assert.deepEqual(Object.keys(noReader.snapshot.meta.omissions).sort(), [
      'edges_truncated', 'empty_text_nodes', 'excluded_system_nodes', 'missing_nodes', 'requested_nodes', 'text_truncated_nodes',
    ]);
    const withReader = projection.projectEngineSnapshot(db, req, { readArtifactText: reader });
    assert.deepEqual(Object.keys(withReader.snapshot.meta.omissions).sort(), Object.keys(noReader.snapshot.meta.omissions).sort());
  } finally { db.close(); }
});

// E6 and E7: the tool wiring, on a real bound isolated room.
asyncLegs.push((async () => {
  const iso = require('./helpers/isolated-home-36925.cjs');
  const savedEnv = {
    HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
    MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM: process.env.CLAUDE_ACTIVE_ROOM,
  };
  const isolated = iso.mkIsolatedHome('400.4-excerpt');
  try {
    const born = iso.birthFixtureRoom({ iso: isolated, slug: 'excerpt-room', sessionId: 'excerpt-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const session = 'excerpt-bound-session';
    const artDir = path.join(born.roomDir, 'market-analysis', 'note-b');
    fs.mkdirSync(artDir, { recursive: true });
    const body = 'The key note body. ' + 'x'.repeat(6000);
    fs.writeFileSync(path.join(artDir, 'note-b.md'), '---\ntitle: Note B\n---\n\n' + body);
    const wdb = nav.openRoomDbForCaller(born.roomDir);
    try {
      // Fill every NOT NULL column that has no default, so the insert survives schema growth.
      const row = { id: 'market-analysis/note-b/note-b', type: 'Artifact',
        properties: JSON.stringify({ title: 'Note B', section: 'market-analysis', content_hash: 'h' }) };
      for (const c of wdb.prepare('PRAGMA table_info(nodes)').all()) {
        if (c.notnull && c.dflt_value === null && !(c.name in row)) {
          row[c.name] = c.name === 'source_path' ? 'market-analysis/note-b/note-b.md' : (/_at$/.test(c.name) ? '2026-11-26T00:00:00Z' : 'system');
        }
      }
      const cols = Object.keys(row);
      wdb.prepare('INSERT INTO nodes (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')').run(...cols.map((k) => row[k]));
    } finally { nav.closeRoomDbForCaller(wdb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(session, {
      bound: [born.slug], primary: born.slug, sticky: true,
    }, { home: isolated.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;

    // Spy on the reader. The tool calls it through the module object.
    const realRead = containment.readContainedTextExcerpt;
    let readCalls = 0;
    containment.readContainedTextExcerpt = function spy() { readCalls += 1; return realRead.apply(this, arguments); };
    delete require.cache[require.resolve('../lib/mcp/tools/eureka-graph-projection.cjs')];
    const tool = require('../lib/mcp/tools/eureka-graph-projection.cjs');
    const captured = new Map();
    tool.register({ registerTool(name, config, handler) { captured.set(name, { config, handler }); } }, {});
    const registered = captured.get('eureka_graph_project');
    const dbPath = path.join(born.roomDir, '.mindrian', 'room.db');
    try {
      // E6
      const before = sha(fs.readFileSync(dbPath));
      const res = (await registered.handler({ node_ids: ['market-analysis/note-b/note-b'] }, { sessionId: session })).structuredContent;
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(res.snapshot.nodes[0].text, body.slice(0, 4000));
      assert.equal(res.text_from_file.nodes, 1);
      assert.equal(res.projection_omissions.empty_text_nodes, 0);
      assert.ok(readCalls >= 1);
      assert.equal(sha(fs.readFileSync(dbPath)), before, 'room.db bytes unchanged');
      process.stdout.write('PASS E6 handler carries the file excerpt, room.db unchanged\n');

      // E7
      fs.writeFileSync(path.join(born.roomDir, 'GUARDRAIL.md'), 'sealed\n');
      readCalls = 0;
      const sealed = (await registered.handler({ node_ids: ['market-analysis/note-b/note-b'] }, { sessionId: session })).structuredContent;
      assert.equal(sealed.ok, false);
      assert.equal(sealed.reason, 'room_sealed');
      assert.equal(readCalls, 0, 'no file read before the sealed refusal');
      process.stdout.write('PASS E7 sealed room refused before any file read\n');
    } finally {
      containment.readContainedTextExcerpt = realRead;
    }
  } catch (e) {
    process.stdout.write('FAIL E6/E7: ' + (e && e.message ? e.message.split('\n')[0] : e) + '\n');
    process.exitCode = 1;
    legFailures.push('E6/E7');
  } finally {
    isolated.cleanup();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
})());

function finish() {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
  if (legFailures.length) {
    process.stdout.write('400.4 eureka excerpt: FAIL (' + legFailures.join(', ') + ')\n');
    process.exitCode = 1;
  } else {
    process.stdout.write('400.4 eureka excerpt: PASS\n');
  }
}
Promise.all(asyncLegs).then(finish, (e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 1; finish(); });
void root;
