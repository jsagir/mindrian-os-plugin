'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-projection-room-'));
const stateDir = path.join(roomDir, '.mindrian');
fs.mkdirSync(stateDir, { recursive: true });
const dbPath = path.join(stateDir, 'room.db');
const db = new DatabaseSync(dbPath);
db.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}')");
db.exec("CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}')");
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('claim:a', 'claim', JSON.stringify({ title: 'A', body: 'Source linked graph text.', source_path: '/private/secret.md', secret: 'never expose' }));
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('claim:b', 'claim', JSON.stringify({ title: 'B', body: 'Second graph text.' }));
db.prepare('INSERT INTO edges (source,target,type) VALUES (?,?,?)').run('claim:a', 'claim:b', 'CONTRADICTS');
db.close();
const dbHashBefore = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');

let resolution = {
  dir: roomDir, slug: 'projection-room', source: 'session.primary', room_id: 'room-123',
  room_identity: { state: 'ready' },
};
const sessionRoom = require('../lib/mcp/session-room.cjs');
const originalResolve = sessionRoom.resolveMcpSessionRoom;
const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
const savedActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
const savedHome = process.env.HOME;
const savedUserProfile = process.env.USERPROFILE;
sessionRoom.resolveMcpSessionRoom = () => resolution;
const tool = require('../lib/mcp/tools/eureka-graph-projection.cjs');

async function main() {
  const captured = new Map();
  tool.register({ registerTool(name, config, handler) { captured.set(name, { config, handler }); } }, {});
  const registered = captured.get('eureka_graph_project');
  assert.ok(registered, 'projection MCP tool is registered');
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['claim:a'] }).success, true);
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['claim:a'], room_path: roomDir }).success, false);
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['../private'] }).success, false);

  const response = await registered.handler({ node_ids: ['claim:b', 'claim:a'] }, { sessionId: 'projection-session' });
  const result = response.structuredContent;
  assert.ok(response.content[0].text.length < 1000, 'large projection payload is not duplicated into text content');
  assert.equal(result.ok, true);
  assert.equal(result.scope_id, 'room-123');
  assert.equal(result.snapshot.nodes.length, 2);
  assert.equal(result.snapshot.edges.length, 1);
  assert.equal(result.snapshot.meta.complete, true);
  assert.equal(result.partial, false);
  assert.equal(result.projection_complete, true);
  assert.deepEqual(result.projection_omissions, result.snapshot.meta.omissions);
  assert.equal(result.snapshot.meta.source_text_is_untrusted, true);
  assert.equal(result.snapshot.nodes[0].source_ref, 'mindrian-graph://node/claim%3Aa');
  assert.equal(JSON.stringify(result).includes('/private/secret.md'), false);
  assert.equal(JSON.stringify(result).includes('never expose'), false);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex'), dbHashBefore, 'projection leaves room.db bytes unchanged');

  const missingProjection = (await registered.handler({ node_ids: ['claim:a', 'claim:missing'] }, { sessionId: 'projection-session' })).structuredContent;
  assert.equal(missingProjection.ok, true);
  assert.equal(missingProjection.partial, true);
  assert.equal(missingProjection.projection_complete, false);
  assert.equal(missingProjection.projection_omissions.missing_nodes, 1);
  assert.equal(missingProjection.partial_policy, 'warn_and_continue');

  resolution = { dir: null, slug: null, source: 'none' };
  const unbound = (await registered.handler({ node_ids: ['claim:a'] }, { sessionId: 'unbound-session' })).structuredContent;
  assert.equal(unbound.ok, false);
  assert.equal(unbound.reason, 'no_bound_room');

  // Exercise the real resolver with no session binding and an empty registry.
  // This proves refusal without stubbing session-to-room resolution.
  const resolverHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-unbound-home-'));
  process.env.MINDRIAN_ROOMS_HOME = resolverHome;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  sessionRoom.resolveMcpSessionRoom = originalResolve;
  delete require.cache[require.resolve('../lib/mcp/tools/eureka-graph-projection.cjs')];
  const realTool = require('../lib/mcp/tools/eureka-graph-projection.cjs');
  const realCaptured = new Map();
  realTool.register({ registerTool(name, config, handler) { realCaptured.set(name, { config, handler }); } }, {});
  const realRegistered = realCaptured.get('eureka_graph_project');
  const realUnbound = (await realRegistered.handler({ node_ids: ['claim:a'] }, { sessionId: 'eureka-real-unbound-session' })).structuredContent;
  assert.equal(realUnbound.ok, false);
  assert.equal(realUnbound.reason, 'no_bound_room');

  // A registry active-room fallback is also refused by the same real resolver.
  fs.mkdirSync(path.join(resolverHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(resolverHome, '.rooms', 'registry.json'), JSON.stringify({
    active: 'projection-room', rooms: { 'projection-room': { abs_path: roomDir, status: 'active' } },
  }));
  const registryFallback = (await realRegistered.handler({ node_ids: ['claim:a'] }, { sessionId: 'eureka-registry-fallback-session' })).structuredContent;
  assert.equal(registryFallback.ok, false);
  assert.equal(registryFallback.reason, 'no_bound_room');
  fs.rmSync(resolverHome, { recursive: true, force: true });

  // Exercise a real bound-room resolution through the same resolver and
  // identity reader used by the host. This proves the adapter projects only
  // from a room explicitly bound to the caller's session.
  const isolated = require('./helpers/isolated-home-36925.cjs').mkIsolatedHome('eureka-bound-projection');
  try {
    const born = require('./helpers/isolated-home-36925.cjs').birthFixtureRoom({
      iso: isolated, slug: 'eureka-bound-projection', sessionId: 'fixture-birth',
    });
    const nav = require('../lib/core/navigation.cjs');
    const boundSession = 'eureka-projection-bound-session';
    const writeDb = nav.openRoomDbForCaller(born.roomDir);
    let boundNodeId;
    try {
      const claim = nav.writeClaimNode(writeDb, {
        knowledge_type: 'fact', text: 'A claim visible only in the bound-room fixture.',
        sessionId: boundSession, sourceSegment: 'eureka-projection-fixture',
      });
      assert.equal(claim.ok, true, JSON.stringify(claim));
      boundNodeId = claim.node_id;
    } finally { nav.closeRoomDbForCaller(writeDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(boundSession, {
      bound: [born.slug], primary: born.slug, sticky: true,
    }, { home: isolated.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const boundDbPath = path.join(born.roomDir, '.mindrian', 'room.db');
    const boundDbHash = crypto.createHash('sha256').update(fs.readFileSync(boundDbPath)).digest('hex');
    const realBound = (await realRegistered.handler({ node_ids: [boundNodeId] }, { sessionId: boundSession })).structuredContent;
    assert.equal(realBound.ok, true, JSON.stringify(realBound));
    assert.equal(realBound.room_binding.source, 'session.primary');
    assert.equal(realBound.scope_id, born.room_id);
    assert.equal(realBound.snapshot.nodes[0].id, boundNodeId);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(boundDbPath)).digest('hex'), boundDbHash,
      'real bound-session projection leaves room.db unchanged');
  } finally {
    isolated.cleanup();
    if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedUserProfile;
  }

  process.stdout.write('eureka graph projection: PASS (bound read-only snapshot, strict path rejection, unbound refusal)\n');
}

main().catch((error) => { process.stderr.write((error.stack || String(error)) + '\n'); process.exitCode = 1; })
  .finally(() => {
    sessionRoom.resolveMcpSessionRoom = originalResolve;
    if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
    if (savedActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = savedActiveRoom;
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedUserProfile;
    fs.rmSync(roomDir, { recursive: true, force: true });
  });
