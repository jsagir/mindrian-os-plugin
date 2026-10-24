'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rs-thesis-mcp-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const fixture = buildDeltaRoom('rs-thesis-mcp');
process.env.MINDRIAN_ROOMS_HOME = fixture.roomsHome;

const navigation = require('../lib/core/navigation.cjs');
const nodeInsert = require('../lib/core/node-insert.cjs');
const { registerCoreTools } = require('../lib/mcp/register-core-tools.cjs');

function harness(ctx) {
  const tools = new Map();
  const server = {
    tool() {},
    registerTool(name, config, handler) { tools.set(name, { config, handler }); },
  };
  const report = registerCoreTools(server, ctx);
  assert.equal(report.complete, true);
  return tools;
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function main() {
  try {
    fixture.addClaims(1); // creates the migrated room.db and local RS view
    fixture.bindSession('rs-thesis-bound-session');

    const db = navigation.openRoomDbForCaller(fixture.roomDir);
    assert.ok(db);
    try {
      nodeInsert.insertNode(db, 'rsdiscovery:fixture-01', 'RSDiscovery', JSON.stringify({
        thesis: 'A source-linked mechanism could relieve the identified bottleneck.',
        classification: 'structural_transfer',
        breakthrough_score: 7.5,
        room_id: fixture.slug,
        created_at: '2026-10-20T00:00:00Z',
      }), { epistemic_type: 'hypothesis', source_path: 'test:fixture', created_by: 'system' });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }

    const tools = harness({ fallbackRoomDir: fixture.roomDir, pluginRoot: path.resolve(__dirname, '..'), surface: 'desktop' });
    const registered = tools.get('rs_thesis_read');
    assert.ok(registered, 'the host-local thesis reader is registered');
    assert.match(registered.config.description, /Local-only and read-only/);
    assert.equal(registered.config.annotations.readOnlyHint, true);
    assert.equal(registered.config.annotations.destructiveHint, false);
    assert.equal(registered.config.annotations.openWorldHint, false);
    assert.equal(registered.config.outputSchema.safeParse({ ok: true, host_service: 'rs_thesis_read', readiness: 'host_native' }).success, true);
    assert.equal(registered.config.inputSchema.safeParse({ discovery_id: 'rsdiscovery:fixture-01' }).success, true);
    assert.equal(registered.config.inputSchema.safeParse({ discovery_id: 'rsdiscovery:fixture-01', room_path: fixture.roomDir }).success, false,
      'the tool rejects caller-provided room paths');

    const noBinding = await registered.handler({ discovery_id: 'rsdiscovery:fixture-01' }, { sessionId: 'unbound-session' });
    assert.equal(noBinding.structuredContent.reason, 'no_bound_room');

    const dbPath = path.join(fixture.roomDir, '.mindrian', 'room.db');
    const before = digest(dbPath);
    const result = await registered.handler({ discovery_id: 'rsdiscovery:fixture-01' }, { sessionId: 'rs-thesis-bound-session' });
    assert.equal(result.structuredContent.ok, true, JSON.stringify(result.structuredContent));
    assert.equal(result.structuredContent.host_service, 'rs_thesis_read');
    assert.equal(result.structuredContent.readiness, 'host_native');
    assert.equal(result.structuredContent.tier, 'tier0');
    assert.equal(result.structuredContent.local_only, true);
    assert.equal(result.structuredContent.thesis, 'A source-linked mechanism could relieve the identified bottleneck.');
    assert.equal(result.structuredContent.meta.rs_type, 'structural_transfer');
    assert.equal(result.structuredContent.room_binding.source, 'session.primary');
    assert.equal(registered.config.outputSchema.safeParse(result.structuredContent).success, true);
    assert.equal(digest(dbPath), before, 'the bound-room lookup leaves room.db byte-identical');

    const missing = await registered.handler({ discovery_id: 'rsdiscovery:missing' }, { sessionId: 'rs-thesis-bound-session' });
    assert.equal(missing.structuredContent.reason, 'discovery_not_found');
    process.stdout.write('rs thesis read MCP: PASS (bound local read, no fallback, no room mutation)\n');
  } finally {
    fixture.cleanup();
    fs.rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
});
