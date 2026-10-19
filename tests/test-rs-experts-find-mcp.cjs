'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rs-experts-mcp-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const fixture = buildDeltaRoom('rs-experts-mcp');
process.env.MINDRIAN_ROOMS_HOME = fixture.roomsHome;
const navigation = require('../lib/core/navigation.cjs');
const mirror = require('../lib/core/rs-sqlite-mirror.cjs');
const { registerCoreTools } = require('../lib/mcp/register-core-tools.cjs');

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function harness(ctx) {
  const tools = new Map();
  const server = { tool() {}, registerTool(name, config, handler) { tools.set(name, { config, handler }); } };
  const report = registerCoreTools(server, ctx);
  assert.equal(report.complete, true);
  return tools;
}

async function main() {
  try {
    fixture.addClaims(1);
    fixture.bindSession('rs-experts-bound-session');
    await mirror.writeDiscovery({
      query_concept: 'prosthetic touch', doc_concept: 'haptic feedback',
      classification: 'structural_transfer', thesis: 'Local fixture thesis',
      breakthrough: { score: 0.5, dominant_dimension: 'impact', breakdown: {} },
    }, { roomDir: fixture.roomDir, context: {
      experts: [
        { name: 'Ada Local', institution: 'Local Mechanics Lab' },
        { name: 'Ben Local', institution: 'Local Sensors Group' },
      ],
      papers: [
        { id: 'paper:prosthetic-touch-a', title: 'Low cost tactile feedback for a prosthetic hand', source: 'fixture', authors: [{ name: 'Ada Local' }] },
        { id: 'paper:prosthetic-touch-b', title: 'Prosthetic touch sensor control', source: 'fixture', authors: [{ name: 'Ben Local' }] },
        { id: 'paper:unrelated', title: 'Remote sensing for agriculture', source: 'fixture', authors: [{ name: 'Ada Local' }] },
      ],
    } });

    const tools = harness({ fallbackRoomDir: fixture.roomDir, pluginRoot: path.resolve(__dirname, '..'), surface: 'desktop' });
    const registered = tools.get('rs_experts_find');
    assert.ok(registered);
    assert.equal(registered.config.annotations.readOnlyHint, true);
    assert.equal(registered.config.annotations.openWorldHint, false);
    assert.equal(registered.config.inputSchema.safeParse({ topic: 'prosthetic touch', limit: 1 }).success, true);
    assert.equal(registered.config.inputSchema.safeParse({ topic: 'prosthetic touch', room_path: fixture.roomDir }).success, false);

    const unbound = await registered.handler({ topic: 'prosthetic touch' }, { sessionId: 'rs-experts-unbound-session' });
    assert.equal(unbound.structuredContent.reason, 'no_bound_room');

    const dbPath = path.join(fixture.roomDir, '.mindrian', 'room.db');
    const before = digest(dbPath);
    const result = await registered.handler({ topic: 'prosthetic touch', limit: 1 }, { sessionId: 'rs-experts-bound-session' });
    const payload = result.structuredContent;
    assert.equal(payload.ok, true, JSON.stringify(payload));
    assert.equal(payload.host_service, 'rs_experts_find');
    assert.equal(payload.readiness, 'host_native');
    assert.equal(payload.local_only, true);
    assert.equal(payload.match_count, 2);
    assert.equal(payload.authors.length, 1);
    assert.equal(payload.authors[0].name, 'Ada Local');
    assert.equal(payload.authors[0].matched_paper_count, 1);
    assert.equal(payload.authors[0].papers[0].id, 'paper:prosthetic-touch-a');
    assert.equal(payload.partial, true);
    assert.ok(payload.omissions.some((item) => item.reason === 'author_result_limit'));
    assert.equal(registered.config.outputSchema.safeParse(payload).success, true);
    assert.equal(digest(dbPath), before, 'expert lookup leaves room.db byte-identical');

    const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'rs-experts-command.cjs'), 'prosthetic touch', '--limit', '1', '--json'], {
      encoding: 'utf8', env: { ...process.env, MINDRIAN_ROOM: fixture.roomDir },
    });
    assert.equal(cli.status, 0, cli.stderr);
    const cliPayload = JSON.parse(cli.stdout);
    assert.equal(cliPayload.host_service, 'rs_experts_find');
    assert.equal(cliPayload.authors[0].name, 'Ada Local');
    assert.equal(cliPayload.partial, true);
    assert.equal(digest(dbPath), before, 'CLI lookup leaves room.db byte-identical');

    const noMatches = await registered.handler({ topic: 'quantum biology' }, { sessionId: 'rs-experts-bound-session' });
    assert.equal(noMatches.structuredContent.ok, true);
    assert.equal(noMatches.structuredContent.match_count, 0, 'a complete empty corpus match is not an error');
    assert.equal(noMatches.structuredContent.partial, false);
    process.stdout.write('rs experts find MCP: PASS (bound local lookup, partial disclosure, no fallback, no mutation)\n');
  } finally {
    fixture.cleanup();
    fs.rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
});
