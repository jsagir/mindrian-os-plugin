#!/usr/bin/env node
'use strict';

/**
 * Phase 369-16 (BAKE369-02) -- bake-off candidate B, the agent-native scaffold
 * with the D-05 vertical slice (ui/bakeoff/agent-native).
 *
 * Static arms (always; they read the committed scripts and overlay only):
 *   1. setup.sh pins @agent-native/core@0.198.8, exports both telemetry
 *      variables, deletes the scaffold's CLAUDE.md, .claude and .mcp.json (and
 *      the other agent-instruction files), pins BlockNote 0.51.4 exactly with
 *      no @blocknote/xl-* and no @modelcontextprotocol/sdk, links mos-ui-shared.
 *   2. every overlay action file declares agentTool false, mcpTool false and an
 *      authorize; the six files are exactly the six slice actions.
 *   3. slice-actions.ts declares exactly the name-to-exposure map the workroom
 *      candidate pins: { listRooms: both, openRoom: human, readArtifact: both,
 *      listEvidence: both, proposeDecision: agent, approveDecision: human };
 *      the human actions are also uiOnly in agent-native.
 *   4. the overlay holds no outside host, no v1 MCP SDK, no RxDB dev-mode, no
 *      file-system or process-spawn import, and no mcp.config.json (agent-native's
 *      own MCP client is never pointed at the MindrianOS daemon).
 *   5. LICENSE-agent-native.txt carries MIT and Builder.io.
 *   6. serve.sh binds 127.0.0.1, requires MOS_DAEMON_URL, never runs dev and
 *      refuses the framework's chat and agent plugins; .gitignore hides app/.
 *   7. D-13: the document reader is editable={false}; no long dash in any
 *      candidate file (the characters are built at run time).
 *
 * Built arms (--built; exit 77 when ui/bakeoff/agent-native/app/.output is
 * absent): the built output names no outside host; then a smoke run against the
 * hermetic flag-ON daemon with a seeded fixture room: GET /slice/<room> is 200,
 * every slice action runs over HTTP through the shared pool with the browser
 * session cookie (and is refused without it), the gate is minted on the human
 * session and answered once, agent-native exposes none of the slice actions
 * over its own MCP, and the server's startup error lines are counted and
 * printed. Run setup.sh and build.sh first.
 *
 * Hermetic: temp HOME and MINDRIAN_ROOMS_HOME, no live room, no session id.
 * No literal em-dash or en-dash in this file. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CAND = path.join(REPO_ROOT, 'ui', 'bakeoff', 'agent-native');
const OVERLAY = path.join(CAND, 'overlay');
const APP = path.join(CAND, 'app');
const OUTPUT = path.join(APP, '.output');
const BUILT = process.argv.includes('--built');

const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-16-'));
process.env.HOME = TEMP_HOME;
process.env.USERPROFILE = TEMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TEMP_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

// The expected slice, the same constant the workroom candidate's test pins.
const EXPECTED = {
  listRooms: 'both',
  openRoom: 'human',
  readArtifact: 'both',
  listEvidence: 'both',
  proposeDecision: 'agent',
  approveDecision: 'human',
};
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

function staticArms() {
  const setup = read(path.join(CAND, 'setup.sh'));
  const build = read(path.join(CAND, 'build.sh'));
  const serve = read(path.join(CAND, 'serve.sh'));
  const sliceActions = read(path.join(OVERLAY, 'server', 'lib', 'slice-actions.ts'));

  return [
    ['setup.sh pins the scaffold, telemetry off, hygiene deletions, exact BlockNote, no v1 SDK', () => {
      assert.match(setup, /@agent-native\/core@\$\{CORE_VERSION\}|@agent-native\/core@0\.198\.8/);
      assert.match(setup, /CORE_VERSION="0\.198\.8"/);
      assert.ok(setup.includes('DO_NOT_TRACK=1'), 'DO_NOT_TRACK=1');
      assert.ok(setup.includes('AGENT_NATIVE_TELEMETRY_DISABLED=1'), 'AGENT_NATIVE_TELEMETRY_DISABLED=1');
      assert.match(setup, /rm -f app\/CLAUDE\.md/);
      assert.match(setup, /rm -rf app\/\.claude/);
      assert.match(setup, /rm -f app\/\.mcp\.json/);
      assert.match(setup, /rm -f app\/AGENTS\.md/);
      assert.match(setup, /rm -rf app\/\.agents/);
      assert.match(setup, /BLOCKNOTE_VERSION="0\.51\.4"/);
      for (const pkg of ['core', 'react', 'mantine']) {
        assert.ok(setup.includes('@blocknote/' + pkg + '@${BLOCKNOTE_VERSION}'), '@blocknote/' + pkg + ' pinned');
      }
      assert.ok(setup.includes('--save-exact'), '--save-exact');
      assert.ok(!setup.includes('@modelcontextprotocol/sdk'), 'no v1 MCP SDK');
      assert.ok(!/pnpm add[^\n]*@blocknote\/xl-/.test(setup), 'no xl- package is added');
      assert.ok(setup.includes('mos-ui-shared@link:../../../shared'), 'links ui/shared');
      assert.ok(setup.includes('npx --yes "@agent-native/core@${CORE_VERSION}" create app --standalone --template chat'));
    }],
    ['setup.sh records the dependency removals and drops every TS path alias (D-17)', () => {
      for (const r of ['agent-chat.ts', 'provider-api-request.ts', 'chat.\\$threadId.tsx', 'components/chat', 'components/layout']) {
        assert.ok(setup.includes(r), 'removal list names ' + r);
      }
      assert.ok(setup.includes('delete cfg.compilerOptions.paths'), 'tsconfig paths dropped');
    }],
    ['overlay: exactly the six slice action files, each agentTool false, mcpTool false, authorize', () => {
      const dir = path.join(OVERLAY, 'actions');
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).sort();
      const want = Object.keys(EXPECTED).map((n) => kebab(n) + '.ts').sort();
      assert.deepEqual(files, want);
      for (const f of files) {
        const src = read(path.join(dir, f));
        assert.ok(/agentTool:\s*false/.test(src), f + ' agentTool: false');
        assert.ok(/mcpTool:\s*false/.test(src), f + ' mcpTool: false');
        assert.ok(/authorize:\s*requireBrowserSession/.test(src), f + ' authorize');
        assert.ok(!/agentTool:\s*true|mcpTool:\s*true/.test(src), f + ' never exposes itself');
      }
    }],
    ['slice-actions.ts declares exactly the name-to-exposure map', () => {
      const got = {};
      const re = /defineShellAction\(\{\s*name:\s*["'](\w+)["'],\s*exposure:\s*["'](\w+)["']/g;
      let m;
      while ((m = re.exec(sliceActions))) got[m[1]] = m[2];
      assert.deepEqual(got, EXPECTED);
      assert.ok(sliceActions.includes('createActionRegistry'), 'registered in the shared registry');
      assert.ok(sliceActions.includes('from "./pool"'), 'rooms only through the pool module');
    }],
    ['human-only actions are uiOnly; approveDecision is human', () => {
      for (const n of ['openRoom', 'approveDecision']) {
        const src = read(path.join(OVERLAY, 'actions', kebab(n) + '.ts'));
        assert.ok(/uiOnly:\s*true/.test(src), n + ' uiOnly');
        assert.equal(EXPECTED[n], 'human');
      }
      assert.ok(!/uiOnly:\s*true/.test(read(path.join(OVERLAY, 'actions', 'list-rooms.ts'))));
    }],
    ['overlay: one shared pool, no outside host, no v1 SDK, no dev-mode, no fs or spawn, no mcp.config.json', () => {
      const pool = read(path.join(OVERLAY, 'server', 'lib', 'pool.ts'));
      assert.ok(pool.includes('createSessionPool'), 'createSessionPool');
      assert.ok(pool.includes('mindrian-shell'), 'clientName mindrian-shell');
      assert.ok(pool.includes('MOS_DAEMON_URL'), 'daemon URL from MOS_DAEMON_URL');
      const bad = [/fonts\.googleapis/, /fonts\.gstatic/, /@modelcontextprotocol\/sdk/, /rxdb\/plugins\/dev-mode/, /node:fs|from ["']fs["']|require\(["']fs["']\)/, /child_process|execFile/, /@blocknote\/xl-/];
      for (const f of walk(OVERLAY, [])) {
        const src = read(f);
        for (const re of bad) assert.ok(!re.test(src), path.relative(OVERLAY, f) + ' matches ' + re);
        assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(src.replace(/\/\/.*$/gm, '')), path.relative(OVERLAY, f) + ' names an outside host');
      }
      assert.ok(!walk(OVERLAY, []).some((f) => /mcp\.config\.json/.test(path.basename(f))), 'no mcp.config.json');
    }],
    ['LICENSE-agent-native.txt carries the MIT notice and Builder.io', () => {
      const lic = read(path.join(CAND, 'LICENSE-agent-native.txt'));
      assert.ok(lic.includes('MIT'), 'MIT');
      assert.ok(lic.includes('Builder.io'), 'Builder.io');
      assert.ok(lic.includes('@agent-native/core'), 'names the package');
      assert.ok(/ships no licence file/.test(lic), 'says why it is carried by hand');
      assert.ok(setup.includes('LICENSE-agent-native.txt') && build.includes('LICENSE-agent-native.txt'), 'copied into app and output');
    }],
    ['serve.sh: loopback only, requires MOS_DAEMON_URL, never dev, no chat or agent plugins', () => {
      assert.ok(serve.includes('HOST=127.0.0.1'), 'HOST=127.0.0.1');
      assert.ok(serve.includes('NITRO_HOST=127.0.0.1'), 'NITRO_HOST=127.0.0.1');
      assert.ok(serve.includes('MOS_DAEMON_URL'), 'MOS_DAEMON_URL');
      assert.ok(/exit 2/.test(serve), 'refuses to start without it');
      assert.ok(!/pnpm exec agent-native dev|agent-native dev|pnpm dev/.test(serve.replace(/^#.*$/gm, '')), 'never runs dev');
      assert.ok(serve.includes('PORT:-8092'), 'default port 8092');
      assert.ok(serve.includes('AGENT_NATIVE_DISABLED_PLUGINS') && serve.includes('agent-chat'), 'agent-chat refused');
      assert.ok(serve.includes('DO_NOT_TRACK=1') && serve.includes('AGENT_NATIVE_TELEMETRY_DISABLED=1'));
      assert.ok(build.includes('DO_NOT_TRACK=1') && build.includes('AGENT_NATIVE_TELEMETRY_DISABLED=1'));
    }],
    ['.gitignore hides the generated app and node_modules', () => {
      const gi = read(path.join(CAND, '.gitignore')).split('\n').map((l) => l.trim());
      assert.ok(gi.includes('/app/') && gi.includes('node_modules/'));
    }],
    ['D-13: BlockNote displays only', () => {
      const reader = read(path.join(OVERLAY, 'app', 'components', 'document-reader.tsx'));
      assert.ok(/editable=\{false\}/.test(reader), 'editable false');
      assert.ok(/sideMenu=\{false\}/.test(reader) && /formattingToolbar=\{false\}/.test(reader));
    }],
    ['no long dash in any candidate B file', () => {
      const files = walk(OVERLAY, []).concat(['setup.sh', 'build.sh', 'serve.sh', '.gitignore', 'LICENSE-agent-native.txt'].map((f) => path.join(CAND, f)), [__filename]);
      for (const f of files) {
        const src = read(f);
        assert.ok(!src.includes(EM) && !src.includes(EN), 'long dash in ' + path.relative(REPO_ROOT, f));
      }
    }],
  ];
}

// ---------------------------------------------------------------- built arms

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

function request(port, method, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const h = Object.assign({}, headers || {});
    if (data) {
      h['content-type'] = 'application/json';
      h['content-length'] = Buffer.byteLength(data);
    }
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_e) { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timeout: ' + urlPath)));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function cookiesFrom(res) {
  const raw = res.headers['set-cookie'] || [];
  return raw.map((c) => c.split(';')[0]);
}

function listenerPids(port) {
  try {
    const out = cp.execFileSync('ss', ['-ltnpH', 'sport = :' + port]).toString();
    return Array.from(out.matchAll(/pid=(\d+)/g)).map((m) => Number(m[1]));
  } catch (_e) {
    return [];
  }
}

async function builtArms() {
  const { startDaemon, stopDaemon, legacyClient } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-daemon-369.cjs'));

  await test('built output names no outside host (fonts, rxdb.info, analytics, xl- exporters)', () => {
    const forbidden = ['fonts.googleapis', 'fonts.gstatic', 'rxdb.info', 'analytics.agent-native.com', '@blocknote/xl-'];
    const files = walk(OUTPUT, []).filter((f) => /\.(js|mjs|cjs|css|html|json|map)$/.test(f));
    assert.ok(files.length > 50, 'built files found: ' + files.length);
    const hits = [];
    for (const f of files) {
      const src = read(f);
      for (const k of forbidden) if (src.includes(k)) hits.push(k + ' in ' + path.relative(OUTPUT, f));
    }
    assert.deepEqual(hits, []);
    assert.ok(fs.existsSync(path.join(OUTPUT, 'LICENSE-agent-native.txt')), 'MIT notice next to the output');
  });

  let daemon = null;
  let server = null;
  let port = 0;
  let out = '';
  try {
    daemon = await startDaemon({
      rooms: [{ slug: 'room-a', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'Claim one' }, { kind: 'claim', text: 'Claim two' }] }],
    });
    port = await freePort();
    const env = Object.assign({}, process.env, { MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.port, PORT: String(port) });
    server = cp.spawn('bash', [path.join(CAND, 'serve.sh')], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    server.stdout.on('data', (c) => (out += c.toString('utf8')));
    server.stderr.on('data', (c) => (out += c.toString('utf8')));
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < 40000) {
      try {
        const r = await request(port, 'GET', '/slice/room-a');
        if (r.status === 200) { ready = true; break; }
      } catch (_e) { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(ready, 'serve.sh did not answer within 40 s: ' + out.slice(-400));

    let sid = null;
    let capability = null;
    await test('GET /slice/<room> is 200 and sets the HttpOnly SameSite=Strict browser cookie', async () => {
      const r = await request(port, 'GET', '/slice/room-a');
      assert.equal(r.status, 200);
      assert.ok(/<title>Room<\/title>/.test(r.text), 'slice route rendered');
      const raw = (r.headers['set-cookie'] || []).find((c) => c.startsWith('mos_sid='));
      assert.ok(raw && /HttpOnly/i.test(raw) && /SameSite=Strict/i.test(raw), 'cookie flags: ' + raw);
      sid = raw.split(';')[0];
    });
    await test('the production server listens on 127.0.0.1 only', () => {
      const out2 = cp.execFileSync('ss', ['-ltnH', 'sport = :' + port]).toString();
      assert.ok(out2.includes('127.0.0.1:' + port), out2);
      assert.ok(!/(0\.0\.0\.0|\*|\[::\]):/.test(out2.replace(/\s+/g, ' ').split(' ').filter((t) => t.endsWith(':' + port)).join(' ')), 'no wildcard bind: ' + out2);
    });
    await test('the browser UI capability route issues the cookie the human-only actions need', async () => {
      const r = await request(port, 'GET', '/_agent-native/ui-capability', { cookie: sid });
      assert.equal(r.status, 200);
      const cap = cookiesFrom(r).find((c) => c.startsWith('agent-native-ui-capability='));
      assert.ok(cap, 'capability cookie issued');
      capability = cap;
    });

    const origin = 'http://127.0.0.1:' + port;
    const human = () => ({ cookie: sid + '; ' + capability, origin, host: '127.0.0.1:' + port, 'x-agent-native-frontend': '1' });
    const call = (name, method, input, headers) => {
      let p = '/_agent-native/actions/' + name;
      let body;
      if (method === 'GET') {
        const q = new URLSearchParams(input || {}).toString();
        if (q) p += '?' + q;
      } else {
        body = input || {};
      }
      return request(port, method, p, headers || human(), body);
    };

    await test('listRooms through the shared pool lists the fixture room', async () => {
      const r = await call('list-rooms', 'GET', {});
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.ok, true, r.text);
      assert.ok(JSON.stringify(r.json.rooms).includes('room-a'), r.text);
    });
    await test('a slice action without the browser session cookie is refused', async () => {
      const r = await call('list-rooms', 'GET', {}, { origin, host: '127.0.0.1:' + port });
      assert.equal(r.status, 403, r.text);
      const w = await call('approve-decision', 'POST', { gate_id: 'gate-abcd', chosen: 'x', verdict: 'approve' }, { origin, host: '127.0.0.1:' + port, 'x-agent-native-frontend': '1' });
      assert.ok(w.status === 403 || w.status === 401, 'write refused: ' + w.status + ' ' + w.text);
    });
    await test('human-only actions refuse a caller that is not the signed-in UI', async () => {
      const r = await call('open-room', 'POST', { room: 'room-a' }, { cookie: sid, origin, host: '127.0.0.1:' + port });
      assert.equal(r.status, 403, r.text);
    });
    await test('openRoom binds this browser session to the room (human)', async () => {
      const r = await call('open-room', 'POST', { room: 'room-a' });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.ok, true, r.text);
    });

    let feedServed = false;
    try {
      const probe = await legacyClient(daemon.port, 'test-369-16-probe');
      const tools = await probe.client.listTools();
      feedServed = tools.tools.some((t) => t.name === 'room_changes');
      await probe.close();
    } catch (_e) { feedServed = false; }
    if (feedServed) {
      await test('listEvidence reads the room feed snapshot through the pool', async () => {
        const r = await call('list-evidence', 'GET', {});
        assert.equal(r.status, 200, r.text);
        assert.equal(r.json.ok, true, r.text);
        assert.ok(Array.isArray(r.json.docs) && r.json.docs.length >= 2, 'both seeded claims are in the snapshot: ' + r.text.slice(0, 300));
      });
      await test('the feed relay route pages room_changes for this browser session', async () => {
        const r = await request(port, 'GET', '/mos/feed/changes?collection=nodes&limit=50', { cookie: sid });
        assert.equal(r.status, 200, r.text);
        assert.equal(r.json.ok, true, r.text);
        assert.ok(Array.isArray(r.json.changes) && r.json.changes.length >= 2);
        const refused = await request(port, 'GET', '/mos/feed/changes?collection=nodes');
        assert.equal(refused.status, 403);
      });
    } else {
      console.log('  note room_changes is not served by this daemon yet (plan 13): the feed arms are not run');
    }

    let gate = null;
    await test('proposeDecision mints the gate on the human session with the recommendation', async () => {
      const r = await call('propose-decision', 'POST', { room: 'room-a', selectedNodeId: 'node-under-test', question: 'Does this claim have enough evidence?' });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.ok, true, r.text);
      gate = r.json.gate;
      assert.ok(gate && typeof gate.gate_id === 'string' && gate.gate_id.length >= 4);
      assert.equal(gate.recommended_id, 'approve_enough');
      assert.ok(gate.options.some((o) => o.id === gate.recommended_id && o.recommended === true));
    });
    await test('approveDecision answers the gate once on the same session and the room records it', async () => {
      const r = await call('approve-decision', 'POST', { gate_id: gate.gate_id, chosen: 'approve_enough', verdict: 'approve' });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.answered, true, r.text);
      assert.equal(r.json.ratified, true, r.text);
      const again = await call('approve-decision', 'POST', { gate_id: gate.gate_id, chosen: 'approve_enough', verdict: 'approve' });
      assert.equal(again.json.answered, false, 'single use');
    });
    await test('agent-native exposes none of the slice actions over its own MCP or agent', async () => {
      for (const p of ['/mcp', '/_agent-native/webmcp/manifest']) {
        const r = await request(port, 'GET', p, { cookie: sid });
        assert.ok(r.status >= 400, p + ' answered ' + r.status);
        for (const n of Object.keys(EXPECTED)) assert.ok(!r.text.includes(kebab(n)), p + ' names ' + n);
      }
    });

    await new Promise((r) => setTimeout(r, Math.max(0, 5000 - (Date.now() - t0))));
    // The "startup errors" data point (spike 007 saw a database-error toast):
    // bracket-prefixed server log events that name an error, within 5 s of
    // start, with the raw error-looking line count beside it.
    const lines = out.split('\n');
    const events = lines.filter((l) => /^\[[^\]]+\].*(error|fail|refus|unhandled|locked)/i.test(l));
    const raw = lines.filter((l) => /error|fail|refus|unhandled|DEPLOY_SETTINGS_REQUIRED/i.test(l));
    console.log('  startup errors: ' + events.length + ' error events, ' + raw.length + ' error-looking lines (server stdout and stderr, first 5 s)');
    for (const l of events.slice(0, 6)) console.log('    ' + l.slice(0, 150));
  } catch (err) {
    failed += 1;
    console.log('  FAIL built smoke setup');
    console.log('    ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (server) {
      try { process.kill(-server.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    if (port) {
      for (const pid of listenerPids(port)) {
        try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
      }
    }
    if (daemon) {
      try { await stopDaemon(daemon); } catch (_e) { /* best effort */ }
    }
  }
}

(async () => {
  console.log('test-369-bakeoff-agent-native' + (BUILT ? ' --built' : ''));
  if (BUILT) {
    if (!fs.existsSync(path.join(OUTPUT, 'server', 'index.mjs'))) {
      console.log('SKIP: no production output at ' + path.relative(REPO_ROOT, OUTPUT) + '; run setup.sh and build.sh');
      fs.rmSync(TEMP_HOME, { recursive: true, force: true });
      process.exit(77);
    }
    await builtArms();
  } else {
    for (const [name, fn] of staticArms()) await test(name, fn);
  }
  fs.rmSync(TEMP_HOME, { recursive: true, force: true });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
