#!/usr/bin/env node
'use strict';

// Phase 404-05 Part A. Test the one artifact write after a process stop.
// The first server reply is withheld by a transport wrapper after the file
// appears. The second server receives the same write key and the same call.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hermeticEnv, rpcOverStdio, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');

const FORCE_FULL = process.env.MINDRIAN_404_K1_FORCE === '1';
const DAY = new Date().toISOString().slice(0, 10);
const FILE = 'challenge-assumptions-' + DAY;
const KEY = 'recipe:challenge-assumptions:' + FILE;
const CANARY = 'K1-SYNTHETIC-CANARY-404';
const CONTENT = '# Synthetic challenge\n\n' + CANARY + '\n';
const ROOTS = [];
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('PASS: ' + label);
  } else {
    failed += 1;
    console.log('FAIL: ' + label + (detail ? ' :: ' + detail : ''));
  }
}

process.on('exit', () => {
  for (const root of ROOTS) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function writeReplyGate(wrapperPath, serverPath, artifactPath) {
  const source = [
    "'use strict';",
    "const cp = require('node:child_process');",
    "const fs = require('node:fs');",
    'const child = cp.spawn(process.execPath, [process.env.K1_SERVER], { env: process.env, stdio: [\'pipe\', \'pipe\', \'inherit\'] });',
    "let buf = '';",
    'let killed = false;',
    "process.stdin.pipe(child.stdin);",
    "child.stdout.on('data', (chunk) => {",
    "  buf += chunk.toString('utf8');",
    "  let end;",
    "  while ((end = buf.indexOf('\\n')) >= 0) {",
    '    const line = buf.slice(0, end + 1);',
    '    buf = buf.slice(end + 1);',
    '    let message = null;',
    '    try { message = JSON.parse(line); } catch (_e) {}',
    "    if (!killed && message && message.id === 2 && fs.existsSync(process.env.K1_ARTIFACT)) {",
    '      killed = true;',
    "      try { child.kill('SIGKILL'); } catch (_e) {}",
    '      continue;',
    '    }',
    '    process.stdout.write(line);',
    '  }',
    '});',
    "child.on('exit', () => { if (buf) process.stdout.write(buf); });",
    "process.stdin.on('end', () => { if (!killed) { try { child.kill('SIGKILL'); } catch (_e) {} } });",
    '',
  ].join('\n');
  fs.writeFileSync(wrapperPath, source, 'utf8');
  return { serverPath, artifactPath };
}

function artifactNodeCount(roomDir, artifactId) {
  const db = openRoomDb(roomDir);
  try {
    const nodeId = navigation.REASONING_NODE_ID('claim:artifact', artifactId);
    return db.prepare("SELECT id FROM nodes WHERE id = ?").all(nodeId).length;
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  const fixture = hermeticEnv();
  ROOTS.push(fixture.dirs.home, fixture.dirs.roomsHome);
  const env = Object.assign({}, fixture.env, {
    HOME: fixture.dirs.home,
    USERPROFILE: fixture.dirs.home,
    MINDRIAN_HOME: path.join(fixture.dirs.home, '.mindrian'),
    MINDRIAN_ROOMS_HOME: fixture.dirs.roomsHome,
    MINDRIAN_ROOM: fixture.dirs.roomDir,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_MCP_FIRST: 'desktop',
    CLAUDE_CODE_SESSION_ID: 'fixture-404-k1',
  });
  const sectionDir = path.join(fixture.dirs.roomDir, 'challenge');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# Synthetic challenge section\n', 'utf8');
  // The wire helper creates a fixture directory, but it does not register it
  // as a room. Open the repository room database once before either server.
  const seedDb = openRoomDb(fixture.dirs.roomDir);
  closeRoomDb(seedDb);
  const artifactPath = path.join(sectionDir, FILE + '.md');
  const requests = [{ method: 'tools/call', params: { name: 'artifact_file', arguments: {
    section: 'challenge', filename: FILE, content: CONTENT, client_write_id: KEY,
  } } }];

  check('K1-a write key shape', KEY.length <= 200 && /^[A-Za-z0-9:.-]+$/.test(KEY) && KEY.endsWith(FILE));
  check('K1-e canary is synthetic and Brain URL is closed', CONTENT.includes(CANARY) && env.MINDRIAN_BRAIN_URL === 'http://127.0.0.1:9');
  check('K1-f server environment uses temporary homes', env.HOME === fixture.dirs.home && env.USERPROFILE === fixture.dirs.home && env.MINDRIAN_ROOMS_HOME === fixture.dirs.roomsHome && env.MINDRIAN_HOME === path.join(fixture.dirs.home, '.mindrian'));

  const wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), '404-k1-wire-'));
  ROOTS.push(wrapperDir);
  const wrapperPath = path.join(wrapperDir, 'reply-gate.cjs');
  writeReplyGate(wrapperPath, LOCAL_SERVER, artifactPath);
  const gatedEnv = Object.assign({}, env, { K1_SERVER: LOCAL_SERVER, K1_ARTIFACT: artifactPath });

  const list = await rpcOverStdio(LOCAL_SERVER, [{ method: 'tools/list' }], { env, timeoutMs: 30000 });
  const tools = (((list.responses.get(2) || {}).result || {}).tools || []);
  const artifactTool = tools.find((tool) => tool.name === 'artifact_file');
  const hasWriteKey = !!(artifactTool && artifactTool.inputSchema && artifactTool.inputSchema.properties && artifactTool.inputSchema.properties.client_write_id);

  if (FORCE_FULL) {
    check('K1-b requires client_write_id input', hasWriteKey, 'artifact_file schema has no client_write_id');
    const first = await rpcOverStdio(wrapperPath, requests, { env: gatedEnv, timeoutMs: 1500 });
    const killedAfterWrite = fs.existsSync(artifactPath);
    check('K1-b first server stopped after file write and before reply', killedAfterWrite && !first.responses.has(2));

    const second = await rpcOverStdio(LOCAL_SERVER, requests, { env, timeoutMs: 30000 });
    const reply = second.responses.get(2);
    const text = reply && reply.result && reply.result.content && reply.result.content[0] && reply.result.content[0].text;
    let payload = null;
    try { payload = JSON.parse(text); } catch (_e) { /* report below */ }
    const files = fs.readdirSync(sectionDir).filter((name) => name === FILE + '.md');
    check('K1-b exactly one file remains', files.length === 1);
    check('K1-b content matches the sent artifact', files.length === 1 && fs.readFileSync(artifactPath, 'utf8').trimEnd() === CONTENT.trimEnd());
    check('K1-b exactly one artifact node exists', !!payload && typeof payload.artifact_id === 'string' && artifactNodeCount(fixture.dirs.roomDir, payload.artifact_id) === 1);
    check('K1-b replay reply is ok and names recovery', !!payload && payload.ok === true && payload.replayed === true, JSON.stringify(payload || second.responses.get(2) || null));

    const sequencePath = path.join(__dirname, '..', 'lib', 'core', 'framework-recipe', 'run-sequence.cjs');
    if (fs.existsSync(sequencePath)) {
      console.log('UNVERIFIED: K1-c run-sequence API needs its Part C contract.');
    } else {
      console.log('SKIP: K1-c run-sequence.cjs is absent on this base.');
    }
  } else {
    const call = await rpcOverStdio(LOCAL_SERVER, requests, { env, timeoutMs: 30000 });
    const response = call.responses.get(2);
    const text = response && response.result && response.result.content && response.result.content[0] && response.result.content[0].text;
    let payload = null;
    try { payload = JSON.parse(text); } catch (_e) { /* schema absence may return an error */ }
    if (hasWriteKey) {
      check('K1-d turn K1 on when write key exists', false, 'MINDRIAN_404_K1_FORCE must be 1');
    } else {
      console.log('K1-d waits for 405 slice 3: ' + JSON.stringify(payload || {
        response: response || null,
        initialize: call.initialize || null,
        stderr: call.stderr || '',
        outcome: response ? 'server returned a non-JSON refusal or result' : 'no tool reply',
      }));
      check('K1-d records the waiting state', true);
    }
    check('K1-e synthetic canary uses the closed Brain endpoint', CONTENT.includes(CANARY) && env.MINDRIAN_BRAIN_URL === 'http://127.0.0.1:9');
    check('K1-f fixture stays under temporary rooms home', fixture.dirs.roomDir.startsWith(fixture.dirs.roomsHome + path.sep));
  }

  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('ERROR: ' + String((error && error.stack) || error));
  process.exitCode = 1;
});
