#!/usr/bin/env node
'use strict';

// Plan 404-07, Task 1. This test uses a loopback MCP server and temp homes.
// The probe runs as a child process because the test covers its CLI contract.

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'tools', '404', 'probe-theo-context.cjs');
const SENTENCE = 'zz probe not a framework name zz';
const REFUSAL = 'FRAMEWORK_NOT_CANONICAL';
const SERVER_VERSION = 'probe-stub-1';
const SNAPSHOT_DATE = '2026-11-27';
const letters = count => 'x'.repeat(count);

let passed = 0;
let failed = 0;

async function check(label, run) {
  try {
    await run();
    passed += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } catch (error) {
    failed += 1;
    const message = error && error.message ? error.message.split('\n')[0] : String(error);
    process.stdout.write('FAIL: ' + label + ' :: ' + message + '\n');
  }
}

function makeTempEnvironment() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'probe404-canary-work-'));
  const home = path.join(root, 'home404-canary');
  const profile = path.join(root, 'profile404-canary');
  const mindrianHome = path.join(root, 'mindrian404-canary');
  const roomsHome = path.join(root, 'rooms404-canary');
  const room = path.join(roomsHome, 'room404-canary');
  for (const dir of [home, profile, mindrianHome, roomsHome, room]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(room, 'marker404-canary.txt'), 'marker404-canary');
  return { root, room };
}

function makeReply(kind, data) {
  if (kind === 'steps') {
    return { jsonrpc: '2.0', id: data.id, result: {
      content: [{ type: 'text', text: JSON.stringify({ steps: [{ title: 'stub step' }] }) }],
      structuredContent: { steps: [{ title: 'stub step' }] },
    } };
  }
  const refusalData = {};
  if (kind !== 'missing-upstream' && kind !== 'positive-upstream') refusalData.refusal = kind === 'other-code' ? 'OTHER_REFUSAL' : REFUSAL;
  if (kind !== 'missing-upstream') refusalData.upstream_calls = kind === 'positive-upstream' ? 1 : 0;
  if (kind !== 'refused-without-date') refusalData.canon_snapshot_date = SNAPSHOT_DATE;
  refusalData.canon_count = 321;
  return { jsonrpc: '2.0', id: data.id, error: {
    code: -32602,
    message: kind === 'other-code' ? 'OTHER_REFUSAL' : REFUSAL + ': no upstream call was made.',
    data: refusalData,
  } };
}

async function withStub(kindForCall, run) {
  const calls = [];
  const requests = [];
  const server = http.createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/mcp') {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      requests.push(raw);
      let message;
      try { message = JSON.parse(raw); } catch (_error) {
        response.writeHead(400).end();
        return;
      }
      if (!Object.hasOwn(message, 'id')) {
        response.writeHead(202).end();
        return;
      }
      let body;
      if (message.method === 'initialize') {
        body = { jsonrpc: '2.0', id: message.id, result: {
          protocolVersion: '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'probe-stub', version: SERVER_VERSION },
        } };
        response.setHeader('mcp-session-id', 'probe404-session');
      } else if (message.method === 'tools/call') {
        const params = message.params || {};
        calls.push({ name: params.name, args: params.arguments || {} });
        if (params.name !== 'framework_steps') {
          body = { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unknown tool' } };
        } else {
          const kind = kindForCall(calls.length - 1, params.arguments || {});
          body = makeReply(kind, { id: message.id });
        }
      } else {
        body = { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unknown method' } };
      }
      response.writeHead(body.error ? 400 : 200, {
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      });
      response.end(JSON.stringify(body));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run({
      url: 'http://127.0.0.1:' + server.address().port + '/mcp',
      calls,
      requests,
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

function runProbe(args, url, env) {
  const childEnv = {
    ...process.env,
    HOME: path.join(env.root, 'home404-canary'),
    USERPROFILE: path.join(env.root, 'profile404-canary'),
    MINDRIAN_HOME: path.join(env.root, 'mindrian404-canary'),
    MINDRIAN_ROOMS_HOME: path.join(env.root, 'rooms404-canary'),
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_ROOM: env.room,
  };
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [SCRIPT, ...args, ...(url ? ['--url', url] : [])], {
      cwd: path.join(env.root, 'work404-canary'),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 10000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status: timedOut ? null : status, signal, stdout, stderr });
    });
  });
}

async function inTemp(run) {
  const env = makeTempEnvironment();
  try {
    fs.mkdirSync(path.join(env.root, 'work404-canary'));
    await run(env);
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }
}

function outputText(result) {
  return String(result.stdout || '') + String(result.stderr || '');
}

async function main() {
  await check('PR1: four refusals write the exact contract projection', async () => {
    await inTemp(async env => withStub(() => 'refused', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 0, outputText(result));
      const record = JSON.parse(fs.readFileSync(out, 'utf8')).strict_canonical_check;
      assert.deepEqual(Object.keys(record).sort(), ['probe', 'server_snapshot_date', 'server_version', 'upstream_calls', 'verified_at'].sort());
      assert.equal(record.probe, 'refused');
      assert.equal(record.upstream_calls, 0);
      assert.equal(record.server_version, SERVER_VERSION);
      assert.equal(typeof record.verified_at, 'string');
      assert.equal(record.server_snapshot_date, SNAPSHOT_DATE);
      assert.equal(stub.calls.length, 4);
    }));
  });

  await check('PR2: served steps refuse the write', async () => {
    await inTemp(async env => withStub(index => index === 0 ? 'steps' : 'refused', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 1, outputText(result));
      assert.equal(fs.existsSync(out), false);
    }));
  });

  await check('PR3: a different refusal code refuses the write', async () => {
    await inTemp(async env => withStub(index => index === 0 ? 'other-code' : 'refused', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 1, outputText(result));
      assert.equal(fs.existsSync(out), false);
    }));
  });

  await check('PR4: absent or positive upstream counts refuse the write', async () => {
    for (const badKind of ['missing-upstream', 'positive-upstream']) {
      await inTemp(async env => withStub(index => index === 0 ? badKind : 'refused', async stub => {
        const out = path.join(env.root, 'contract.json');
        const result = await runProbe(['--write', '--out', out], stub.url, env);
        assert.equal(result.status, 1, outputText(result));
        assert.equal(fs.existsSync(out), false);
      }));
    }
  });

  await check('PR5: an accepted extra-key object refuses the write', async () => {
    await inTemp(async env => withStub((_index, args) => Object.hasOwn(args, 'extra') ? 'steps' : 'refused', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 1, outputText(result));
      assert.equal(fs.existsSync(out), false);
    }));
  });

  await check('PR6: an unavailable server exits 2 without a file', async () => {
    await inTemp(async env => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], 'http://127.0.0.1:9/mcp', env);
      assert.equal(result.status, 2, outputText(result));
      assert.equal(fs.existsSync(out), false);
    });
  });

  await check('PR7: exactly four fixed calls contain no room canary', async () => {
    await inTemp(async env => withStub(() => 'refused', async stub => {
      const result = await runProbe([], stub.url, env);
      assert.equal(result.status, 0, outputText(result));
      assert.equal(stub.calls.length, 4);
      assert.deepEqual(stub.calls[0], { name: 'framework_steps', args: { framework: SENTENCE } });
      const requests = stub.requests.join('\n');
      for (const canary of ['404-canary', 'marker404-canary']) assert.equal(requests.includes(canary), false);
      assert.ok(stub.calls.some(call => call.args.framework === letters(97)));
      assert.ok(stub.calls.some(call => call.args.framework === letters(129)));
    }));
  });

  await check('PR8: an unknown argument gives usage and makes no request', async () => {
    await inTemp(async env => withStub(() => 'refused', async stub => {
      const result = await runProbe(['--unknown'], stub.url, env);
      assert.equal(result.status, 2, outputText(result));
      assert.match(outputText(result), /usage/i);
      assert.equal(stub.requests.length, 0);
    }));
  });

  await check('PR9: usage names the default target without running that form', async () => {
    await inTemp(async env => withStub(() => 'refused', async stub => {
      const result = await runProbe(['--unknown'], stub.url, env);
      assert.equal(result.status, 2, outputText(result));
      assert.match(outputText(result), /data\/theo-context-contract\.json/);
      assert.equal(stub.requests.length, 0);
    }));
  });

  await check('PR10: no reported snapshot date is omitted', async () => {
    await inTemp(async env => withStub(() => 'refused-without-date', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 0, outputText(result));
      const record = JSON.parse(fs.readFileSync(out, 'utf8')).strict_canonical_check;
      assert.equal(Object.hasOwn(record, 'server_snapshot_date'), false);
    }));
  });

  await check('PR11: 97 and 129 character inputs are sent and a served 97 character value fails', async () => {
    await inTemp(async env => withStub((_index, args) => args.framework === letters(97) ? 'steps' : 'refused', async stub => {
      const out = path.join(env.root, 'contract.json');
      const result = await runProbe(['--write', '--out', out], stub.url, env);
      assert.equal(result.status, 1, outputText(result));
      assert.equal(stub.calls.length, 4);
      assert.ok(stub.calls.some(call => call.args.framework === letters(97)));
      assert.ok(stub.calls.some(call => call.args.framework === letters(129)));
      assert.equal(fs.existsSync(out), false);
    }));
  });

  process.stdout.write('RESULT: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
  process.exitCode = 1;
});
