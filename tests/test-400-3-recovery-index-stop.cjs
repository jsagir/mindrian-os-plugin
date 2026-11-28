#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 wave 2 Goldfish W2-CD-05: a recovery whose index stopped on a busy room says so.
 *
 * lib/core/graph-backfill.cjs _recoverIndexAndReadBack writes readiness.index_stop when
 * graph-ops indexArtifactsStopOnBusy stops (room_db_busy or write_lock_held, plan 400.3-06a). Before this fix nobody
 * read it: the recovery card answered "The room record was rebuilt" with recovered true after a partial index.
 * Now the readiness carries index_stop, indexed and index_total and partial true, the gate answer carries
 * partial true, and the user-visible message says how many files of how many were indexed and why it stopped.
 *
 * Harness: the in-process fake server of tests/test-36925-readiness-gate.cjs, an isolated HOME and rooms home
 * (tests/helpers/isolated-home-36925.cjs). The busy stop is simulated: graph-ops indexArtifactsStopOnBusy is
 * replaced for the recovery call by a stub that indexes nothing and returns { indexed: 0, stopped }.
 *
 * Arms: S1 (room_db_busy), S2 (write_lock_held), S3 (no stop: the message and the flags of today).
 * Usage: node tests/test-400-3-recovery-index-stop.cjs
 *
 * Node built-ins only. Hyphens only. No network.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _config, handler) { tools[name] = handler; },
    server: { getClientVersion() { return { name: 'claude-code', version: '2.1.0' }; }, getClientCapabilities() { return {}; } },
  };
}
function parse(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  if (!text) return null;
  const marker = text.indexOf('\n\n## Suggested Next');
  try { return JSON.parse(marker === -1 ? text : text.slice(0, marker)); } catch (_e) { return null; }
}
const short = (v) => JSON.stringify(v).slice(0, 500);

const iso = H.mkIsolatedHome('recovery-index-stop');
const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
const SAVED_CWD = process.cwd();
function restoreEnv() {
  try { process.chdir(SAVED_CWD); } catch (_e) { /* best effort */ }
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
}
const dbFile = (roomDir) => path.join(roomDir, '.mindrian', 'room.db');
function removeDb(roomDir) {
  ['', '-wal', '-shm'].forEach((s) => { try { fs.rmSync(dbFile(roomDir) + s, { force: true }); } catch (_e) { /* ignore */ } });
}

async function main() {
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  process.chdir(iso.home);

  const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const views = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'));
  const gateTools = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const graphOps = require(path.join(ROOT, 'lib', 'core', 'graph-ops.cjs'));

  const ghostFallback = path.join(iso.home, 'no-such-boot-room');
  const ctx = { fallbackRoomDir: ghostFallback, surface: 'cli' };
  const server = makeFakeServer();
  toolRouter.registerRouterTools(server, ghostFallback, ROOT, { compact: '' }, 'cli');
  views.register(server, ctx);
  gateTools.register(server, ctx);

  let seq = 0;
  async function runCase(slug, stopWord) {
    const b = H.birthFixtureRoom({ iso, slug });
    const session = 's-' + slug;
    parse(await server.tools.room_bind({ room: slug }, { sessionId: session }));
    for (let i = 0; i < 3; i += 1) {
      fs.writeFileSync(path.join(b.roomDir, 'problem-definition', 'note-' + i + '.md'), '---\ntitle: note ' + i + '\n---\n\nA note.\n');
    }
    removeDb(b.roomDir);
    seq += 1;
    const refused = parse(await server.tools.artifact_file({
      section: 'problem-definition', filename: 'stop-' + seq, content: '---\ntitle: stop\n---\n\nA governed filing.\n',
    }, { sessionId: session }));
    const gateId = refused && refused.recovery_gate_id;
    const real = graphOps.indexArtifactsStopOnBusy;
    let seenTotal = -1;
    if (stopWord) {
      graphOps.indexArtifactsStopOnBusy = async (_root, files) => { seenTotal = Array.isArray(files) ? files.length : -1; return { indexed: 0, stopped: stopWord }; };
    }
    let ans = null;
    try {
      ans = gateId ? parse(await server.tools.gate_answer({ gate_id: gateId, chosen: ['recover'], verdict: 'approve' }, { sessionId: session })) : null;
    } finally { graphOps.indexArtifactsStopOnBusy = real; }
    return { refused, ans, seenTotal };
  }

  // S1: room_db_busy.
  {
    const c = await runCase('stop-busy', 'room_db_busy');
    const cr = c.ans && c.ans.chain_result;
    const rd = cr && cr.readiness;
    const msg = (cr && cr.message) || '';
    check('S1 the stub saw the files to index', c.seenTotal > 0, short(c));
    check('S1 readiness carries index_stop room_db_busy, indexed 0 and index_total', !!rd && rd.index_stop === 'room_db_busy' && rd.indexed === 0 && rd.index_total === c.seenTotal, short(cr));
    check('S1 the gate answer says partial: true', !!cr && cr.partial === true, short(cr));
    check('S1 the message says 0 of N files were indexed and that room.db was busy',
      msg.indexOf('0 of ' + c.seenTotal + ' files') !== -1 && /room\.db was busy/.test(msg) && /again/.test(msg), msg);
  }
  // S2: write_lock_held.
  {
    const c = await runCase('stop-lock', 'write_lock_held');
    const cr = c.ans && c.ans.chain_result;
    const msg = (cr && cr.message) || '';
    check('S2 write_lock_held: partial true and the message names the room lock',
      !!cr && cr.partial === true && cr.readiness && cr.readiness.index_stop === 'write_lock_held' && /room lock/.test(msg) && msg.indexOf('of ' + c.seenTotal + ' files') !== -1, short(cr));
  }
  // S3: no stop.
  {
    const c = await runCase('stop-none', null);
    const cr = c.ans && c.ans.chain_result;
    const msg = (cr && cr.message) || '';
    check('S3 no stop: recovered true, no partial flag, the message of today without an index line',
      !!cr && cr.recovered === true && cr.partial !== true && /^The room record was rebuilt/.test(msg) && !/were indexed/.test(msg), short(cr));
  }
}

main().then(() => {
  restoreEnv();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => { restoreEnv(); console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
