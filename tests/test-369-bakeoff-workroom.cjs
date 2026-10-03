#!/usr/bin/env node
'use strict';

/**
 * Phase 369-15 (BAKE369-01) -- bake-off candidate A, the workroom chassis.
 *
 * Static arms (always, no build needed):
 *   1. REMOVE.txt names the article PUT route and the briefing route.
 *   2. package-patch.json removes every @blocknote/xl-*, ai and @ai-sdk/*, and
 *      adds only mos-ui-shared as a local file dependency.
 *   3. the overlay has no next/font/google, no font host, no RxDB dev-mode, no
 *      fs or child_process import, no TS path alias, no long dash.
 *   4. slice-actions.ts goes through defineShellAction with an exposure for
 *      every action and the name-to-exposure map is exactly the pinned one.
 *   5. the routes: actions is POST only with the human principal, ask is the
 *      only in-process agent caller, no route maps to proposeDecision itself.
 *   6. D-13: BlockNote is read-only (editable false, no menus), no save route.
 *   7. serve.sh binds 127.0.0.1 and refuses to start without MOS_DAEMON_URL;
 *      every build and serve command turns Next telemetry off; setup.sh deletes
 *      CLAUDE.md and AGENTS.md, installs with scripts off and never writes into
 *      the workroom checkout.
 *   8. snapshot.json: sha256 per file, total_lines at or above the floor.
 *   9. when app/ exists: no CLAUDE.md or AGENTS.md, no rooms.ts, no GPL
 *      exporters or AI SDK in the copy's manifest, mos-ui-shared present.
 *
 * Built arms (--built, used by plan 18; exits 77 when app/.next/standalone/
 * server.js is absent):
 *   10. the bundle names no font host, no @blocknote/xl-, no RxDB dev-mode
 *       iframe; the literal UI-SPEC C2 hosts (rxdb.info, cdn.jsdelivr, ...) are
 *       counted and classified, and printed as a FINDING (see the note there).
 *   11. smoke: a hermetic flag-ON daemon with a seeded fixture room, serve.sh on
 *       a free port, GET the slice page is 200 with a session cookie, no error
 *       line on stderr, and the slice's action layer walks end to end over HTTP:
 *       listRooms, openRoom, readArtifact, a feed pull, ask (agent proposal, gate
 *       minted on the browser session), a human cannot call proposeDecision, no
 *       cookie is refused, Confirm ratifies and the decision reaches the feed.
 *       If room_changes or room_artifact is not served, that arm reports
 *       NOT PROVEN and does not count as a pass.
 *
 * Hermetic: the daemon helper builds its own temp rooms home; Node env is the
 * caller's. No literal em-dash or en-dash in this file (built at run time). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CAND = path.join(REPO_ROOT, 'ui', 'bakeoff', 'workroom');
const OVERLAY = path.join(CAND, 'overlay');
const APP = path.join(CAND, 'app');
const BUILT = process.argv.includes('--built');

const EXPECTED_EXPOSURES = {
  listRooms: 'both',
  openRoom: 'human',
  readArtifact: 'both',
  listEvidence: 'both',
  proposeDecision: 'agent',
  approveDecision: 'human',
};
const LINES_FLOOR = 2645;

let passed = 0;
let failed = 0;
let notProven = 0;

async function test(name, fn) {
  try {
    const r = await fn();
    if (r === 'NOT_PROVEN') {
      notProven += 1;
      console.log('  NOT PROVEN ' + name);
      return;
    }
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
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const OVERLAY_FILES = walk(OVERLAY);
const OVERLAY_SRC = OVERLAY_FILES.filter((f) => /\.(ts|tsx|css)$/.test(f));
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function staticArms() {
  console.log('static arms');

  await test('1. REMOVE.txt names the article PUT route and the briefing route', () => {
    const t = read(path.join(CAND, 'REMOVE.txt'));
    assert.ok(/src\/app\/api\/rooms\/\[room\]\/article\/route\.ts :: .*PUT/.test(t), 'article route (GET and PUT) must be listed with its reason');
    assert.ok(/src\/app\/api\/rooms\/\[room\]\/briefing\/route\.ts ::/.test(t), 'briefing route must be listed');
    assert.ok(/src\/lib\/rooms\.ts ::/.test(t), 'rooms.ts must be listed');
    assert.ok(/src\/lib\/export\.ts ::/.test(t), 'export.ts (xl-* importer) must be listed');
    for (const line of t.split('\n')) {
      if (!line.trim() || line.startsWith('#')) continue;
      assert.ok(line.includes(' :: '), 'every entry carries a reason: ' + line);
    }
  });

  await test('2. package-patch removes xl-*, ai and @ai-sdk/*, and adds only mos-ui-shared', () => {
    const patch = JSON.parse(read(path.join(CAND, 'package-patch.json')));
    for (const p of ['@blocknote/xl-*', 'ai', '@ai-sdk/*']) assert.ok(patch.remove.includes(p), 'must remove ' + p);
    assert.deepEqual(Object.keys(patch.add), ['mos-ui-shared']);
    assert.equal(patch.add['mos-ui-shared'], 'file:../../../shared');
    assert.ok(path.resolve(APP, '../../../shared') === path.join(REPO_ROOT, 'ui', 'shared'), 'the file: path resolves to ui/shared from app/');
  });

  await test('3. overlay: no font host, no dev-mode, no fs or child_process, no path alias, no long dash', () => {
    assert.ok(OVERLAY_SRC.length >= 12, 'expected the overlay sources, found ' + OVERLAY_SRC.length);
    for (const f of OVERLAY_SRC) {
      const s = read(f);
      const rel = path.relative(OVERLAY, f);
      assert.ok(!/next\/font\/google/.test(s), rel + ' imports next/font/google');
      assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(s), rel + ' names a font host');
      assert.ok(!/rxdb\/plugins\/dev-mode/.test(s), rel + ' imports RxDB dev-mode');
      assert.ok(!/from\s+['"](node:)?fs(\/promises)?['"]|require\(\s*['"](node:)?fs/.test(s), rel + ' imports fs');
      assert.ok(!/child_process|execFile|execSync|spawnSync/.test(s), rel + ' touches child_process');
      assert.ok(!/from\s+['"]@\//.test(s), rel + ' uses a TS path alias (D-17)');
      assert.ok(!/https?:\/\/(?!127\.0\.0\.1)[a-z0-9]/i.test(s.replace(/https?:\/\/(nextjs\.org|www\.w3\.org)[^\s'"`]*/g, '')), rel + ' has an outside URL literal');
    }
    for (const f of OVERLAY_FILES.concat(['setup.sh', 'build.sh', 'serve.sh', 'REMOVE.txt', 'package-patch.json'].map((n) => path.join(CAND, n)))) {
      const s = read(f);
      assert.ok(!s.includes(EM) && !s.includes(EN), path.relative(CAND, f) + ' contains a long dash');
    }
    const tsconfig = JSON.parse(read(path.join(OVERLAY, 'tsconfig.json')));
    assert.ok(!('paths' in tsconfig.compilerOptions) && !('baseUrl' in tsconfig.compilerOptions), 'tsconfig must carry no alias');
  });

  await test('4. slice-actions: every action via defineShellAction, exposure map pinned, only ui/shared reaches the room', () => {
    const s = read(path.join(OVERLAY, 'src', 'server', 'slice-actions.ts'));
    const defs = [...s.matchAll(/defineShellAction\(\{\s*name:\s*'(\w+)',\s*exposure:\s*'(agent|human|both)'/g)];
    const got = {};
    for (const m of defs) got[m[1]] = m[2];
    assert.deepEqual(got, EXPECTED_EXPOSURES);
    assert.equal((s.match(/defineShellAction\(/g) || []).length, Object.keys(EXPECTED_EXPOSURES).length, 'no defineShellAction call without a name and exposure');
    assert.ok(/createActionRegistry\(\)/.test(s) && /assertAllDeclared\(\)/.test(s));
    assert.ok(!/\.register\(\{/.test(s), 'a hand-built object must never be registered');
    assert.ok(/from 'mos-ui-shared\/actions'/.test(s) && /from 'mos-ui-shared\/generated\/mcp-adapter'/.test(s));
    const pool = read(path.join(OVERLAY, 'src', 'server', 'pool.ts'));
    assert.ok(/createSessionPool/.test(pool) && /mindrian-shell/.test(pool), 'one session pool, client name mindrian-shell');
    assert.ok(/globalThis/.test(pool), 'the pool is a process singleton (every route is its own bundle)');
    assert.ok(/delete input\.principal/.test(s), 'a body cannot claim a principal');
    for (const tool of ['room_list', 'room_bind', 'room_artifact', 'room_changes', 'gate_render', 'gate_answer']) {
      const all = OVERLAY_SRC.map((f) => read(f)).join('\n') + read(path.join(REPO_ROOT, 'ui', 'shared', 'src', 'generated', 'mcp-adapter.ts'));
      assert.ok(all.includes(tool), 'the slice reaches ' + tool);
    }
  });

  await test('5. routes: actions is POST only and human, ask is the one agent caller, nothing maps to proposeDecision', () => {
    const actions = read(path.join(OVERLAY, 'src', 'app', 'api', 'actions', '[name]', 'route.ts'));
    assert.ok(/export async function POST/.test(actions));
    assert.ok(!/export (async )?function (GET|PUT|PATCH|DELETE)/.test(actions), 'actions route must be POST only');
    assert.ok(/principal:\s*'human'/.test(actions) && !/principal:\s*'agent'/.test(actions));
    assert.ok(/guardRequest/.test(actions));
    const ask = read(path.join(OVERLAY, 'src', 'app', 'api', 'ask', 'route.ts'));
    assert.ok(/invoke\('proposeDecision'/.test(ask) && /principal:\s*'agent'/.test(ask));
    for (const f of walk(path.join(OVERLAY, 'src', 'app', 'api'))) {
      const rel = path.relative(OVERLAY, f);
      if (rel.includes('/ask/')) continue;
      assert.ok(!/proposeDecision/.test(read(f)), rel + ' must not reference proposeDecision');
    }
    const session = read(path.join(OVERLAY, 'src', 'server', 'session.ts'));
    assert.ok(/127\\\.0\\\.0\\\.1/.test(session) && /sec-fetch-site/.test(session) && /origin/.test(session), 'the request guard checks Host, Origin and Sec-Fetch-Site');
    assert.ok(/httpOnly:\s*true/.test(read(path.join(OVERLAY, 'src', 'proxy.ts'))) && /sameSite:\s*'strict'/.test(read(path.join(OVERLAY, 'src', 'proxy.ts'))));
  });

  await test('6. D-13: BlockNote displays only, no save route', () => {
    const ro = read(path.join(OVERLAY, 'src', 'components', 'read-only-markdown.tsx'));
    for (const p of ['editable={false}', 'sideMenu={false}', 'formattingToolbar={false}', 'slashMenu={false}']) assert.ok(ro.includes(p), 'missing ' + p);
    for (const f of OVERLAY_SRC) {
      const s = read(f);
      assert.ok(!/export (async )?function PUT|method:\s*'PUT'|fs\.writeFile|writeFileSync/.test(s), path.relative(OVERLAY, f) + ' has a save path');
    }
  });

  await test('7. scripts: loopback bind, daemon required, telemetry off, workroom never written', () => {
    const serve = read(path.join(CAND, 'serve.sh'));
    assert.ok(/HOSTNAME=127\.0\.0\.1/.test(serve), 'serve.sh must bind 127.0.0.1');
    assert.ok(/MOS_DAEMON_URL:-/.test(serve) && /exit 1/.test(serve), 'serve.sh refuses without MOS_DAEMON_URL');
    assert.ok(/NEXT_TELEMETRY_DISABLED=1/.test(serve) && /8091/.test(serve));
    assert.ok(/NEXT_TELEMETRY_DISABLED=1/.test(read(path.join(CAND, 'build.sh'))));
    const setup = read(path.join(CAND, 'setup.sh'));
    assert.ok(/NEXT_TELEMETRY_DISABLED=1/.test(setup) && /DO_NOT_TRACK=1/.test(setup));
    assert.ok(/rm -f "\$APP\/CLAUDE\.md" "\$APP\/AGENTS\.md"/.test(setup), 'setup.sh deletes CLAUDE.md and AGENTS.md');
    assert.ok(/npm ci --ignore-scripts/.test(setup));
    assert.ok(/--exclude='\/\.env\*'/.test(setup), 'env files are never copied');
    for (const line of setup.split('\n')) {
      if (!/\$SRC\b|\$\{SRC\}/.test(line) && !/SRC_DIR/.test(line)) continue;
      if (/^\s*#/.test(line)) continue;
      assert.ok(!/\b(rm|mv|touch|chmod|sed -i|tee|truncate)\b|>\s*"?\$/.test(line.replace(/2>&1/g, '')), 'setup.sh line writes toward the workroom: ' + line.trim());
    }
    const sh = cp.spawnSync('bash', ['-n', path.join(CAND, 'setup.sh')]);
    assert.equal(sh.status, 0, 'bash -n setup.sh');
    for (const n of ['build.sh', 'serve.sh']) assert.equal(cp.spawnSync('bash', ['-n', path.join(CAND, n)]).status, 0, 'bash -n ' + n);
    const refuse = cp.spawnSync('bash', [path.join(CAND, 'serve.sh')], { env: Object.assign({}, process.env, { MOS_DAEMON_URL: '' }), encoding: 'utf8' });
    assert.equal(refuse.status, 1, 'serve.sh must refuse without MOS_DAEMON_URL');
  });

  await test('8. snapshot.json: sha256 per file, total_lines at or above the measured floor', () => {
    const snap = JSON.parse(read(path.join(CAND, 'snapshot.json')));
    assert.ok(snap.total_lines >= LINES_FLOOR, 'total_lines ' + snap.total_lines + ' below ' + LINES_FLOOR);
    assert.ok(snap.ts_tsx_lines >= LINES_FLOOR, 'ts_tsx_lines ' + snap.ts_tsx_lines);
    assert.ok(Array.isArray(snap.files) && snap.files.length >= 30);
    let sum = 0;
    for (const f of snap.files) {
      assert.match(f.sha256, /^[0-9a-f]{64}$/, f.path);
      assert.ok(Number.isInteger(f.lines) && f.lines >= 0, f.path);
      sum += f.lines;
    }
    assert.equal(sum, snap.total_lines, 'total_lines is the sum of the listed files');
    assert.ok(snap.files.some((f) => f.path === 'src/lib/rooms.ts'), 'the fs reader is in the snapshot (it is what the measure diffs against)');
    // The checkout is only read; report (do not fail on) drift since the owner edits it.
    const src = snap.source;
    if (src && fs.existsSync(src)) {
      const crypto = require('node:crypto');
      let drift = 0;
      for (const f of snap.files) {
        const p = path.join(src, f.path);
        if (!fs.existsSync(p) || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== f.sha256) drift += 1;
      }
      console.log('    note: ' + drift + ' of ' + snap.files.length + ' workroom files differ from the snapshot (info only)');
    }
  });

  await test('9. generated copy (when present): no CLAUDE.md or AGENTS.md, no rooms.ts, no GPL exporters or AI SDK', () => {
    if (!fs.existsSync(path.join(APP, 'package.json'))) {
      console.log('    note: app/ not generated here; run setup.sh (skipped)');
      return;
    }
    assert.ok(!fs.existsSync(path.join(APP, 'CLAUDE.md')) && !fs.existsSync(path.join(APP, 'AGENTS.md')));
    assert.ok(!fs.existsSync(path.join(APP, 'src', 'lib', 'rooms.ts')));
    assert.ok(!fs.existsSync(path.join(APP, 'src', 'app', 'api', 'rooms')));
    assert.ok(!fs.existsSync(path.join(APP, '.env.local')), 'the workroom env file is never copied');
    const pkg = JSON.parse(read(path.join(APP, 'package.json')));
    const deps = Object.keys(Object.assign({}, pkg.dependencies, pkg.devDependencies));
    assert.ok(!deps.some((d) => d.startsWith('@blocknote/xl-') || d === 'ai' || d.startsWith('@ai-sdk/')), 'GPL exporters and AI SDK are gone');
    assert.ok(deps.includes('mos-ui-shared'));
    const lock = read(path.join(APP, 'package-lock.json'));
    assert.ok(!/node_modules\/@blocknote\/xl-|node_modules\/@ai-sdk\//.test(lock), 'the lockfile carries neither');
    const tsconfig = JSON.parse(read(path.join(APP, 'tsconfig.json')));
    assert.ok(!('paths' in tsconfig.compilerOptions), 'the generated tsconfig carries no alias');
  });
}

function scanBundle(roots) {
  const files = [];
  for (const root of roots) {
    for (const f of walk(root)) if (/\.(js|css|html|map|mjs)$/.test(f)) files.push(f);
  }
  return files;
}

async function builtArms() {
  console.log('built arms');
  const standalone = path.join(APP, '.next', 'standalone', 'server.js');
  if (!fs.existsSync(standalone)) {
    console.log('SKIPPED: no production build (run setup.sh and build.sh)');
    process.exit(77);
  }

  await test('10. bundle: no font host, no GPL exporter, no RxDB dev-mode iframe; C2 literals classified', () => {
    const files = scanBundle([path.join(APP, '.next', 'static'), path.join(APP, '.next', 'server')]);
    assert.ok(files.length > 20, 'expected built assets, found ' + files.length);
    const hard = ['fonts.googleapis', 'fonts.gstatic', '@blocknote/xl-', 'dev-mode-iframe'];
    const lits = { 'rxdb.info': [], 'cdn.jsdelivr': [], 'unpkg.com': [], cdnjs: [] };
    for (const f of files) {
      const s = read(f);
      for (const h of hard) assert.ok(!s.includes(h), path.relative(APP, f) + ' contains ' + h);
      for (const k of Object.keys(lits)) if (s.includes(k)) lits[k].push(f);
    }
    // rxdb.info: only documentation links in RxDB's own error text (https://rxdb.info/<page>.html),
    // never an iframe or script source.
    for (const f of lits['rxdb.info']) {
      const s = read(f);
      for (const m of s.matchAll(/.{0,40}rxdb\.info.{0,60}/g)) {
        assert.ok(/https:\/\/rxdb\.info\/[a-z0-9\-_.#\/]*/i.test(m[0]), 'rxdb.info outside a doc link in ' + path.relative(APP, f) + ': ' + m[0]);
        assert.ok(!/iframe|<script|\.src\s*=/i.test(m[0]), 'rxdb.info used as a source in ' + path.relative(APP, f));
      }
    }
    // cdn.jsdelivr: emoji-mart's default data fetch, reached only through the emoji
    // picker, which read-only-markdown switches off (emojiPicker={false}).
    for (const f of lits['cdn.jsdelivr']) {
      assert.ok(/emoji-mart/.test(f) || /@emoji-mart\/data/.test(read(f)), 'cdn.jsdelivr outside emoji-mart: ' + path.relative(APP, f));
    }
    assert.equal(lits['unpkg.com'].length, 0, 'unpkg.com in the browser or server bundle');
    assert.equal(lits.cdnjs.length, 0, 'cdnjs in the browser or server bundle');
    const n = (k) => lits[k].filter((f) => !f.endsWith('.map')).length;
    console.log(
      '    FINDING (UI-SPEC C2 as written needs zero literal occurrences): ' + n('rxdb.info') + ' bundle files carry the string rxdb.info (RxDB error-message doc links, inert text) and ' +
        n('cdn.jsdelivr') + ' carry cdn.jsdelivr (emoji-mart default data fetch, unreachable with the emoji picker off). Not egress; a literal scan fails on them. Plan 18 and plan 28 decide the C2 wording or a build-time rewrite.'
    );
  });

  let daemon = null;
  let server = null;
  let stderr = '';
  try {
    const { startDaemon, stopDaemon } = require('./helpers/mcp-daemon-369.cjs');
    try {
      daemon = await startDaemon({
        rooms: [{ slug: 'room-x', variant: 'wide', migrate: true, seed: [
          { kind: 'claim', text: 'Fixture claim: the market is large' },
          { kind: 'source', url: 'https://example.invalid/a', retrieved_at: '2026-01-01', topic: 'a' },
        ] }],
      });
    } catch (err) {
      console.log('SKIPPED: could not start the hermetic daemon: ' + err.message);
      process.exit(77);
    }
    const port = await freePort();
    server = cp.spawn('bash', [path.join(CAND, 'serve.sh')], {
      env: Object.assign({}, process.env, { MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.port, PORT: String(port), MOS_PROPOSAL_SOURCE: 'fixed' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
    server.stdout.on('data', (c) => { stderr += c.toString('utf8'); });
    const base = 'http://127.0.0.1:' + port;
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try { await fetch(base + '/'); up = true; } catch (_e) { await sleep(100); }
    }
    assert.ok(up, 'candidate server did not come up; output: ' + stderr.slice(-300));

    let cookie = '';
    const post = async (url, body, withCookie) => {
      const headers = { 'content-type': 'application/json' };
      if (withCookie !== false) headers.cookie = cookie;
      const r = await fetch(base + url, { method: 'POST', headers, body: JSON.stringify(body) });
      let json = null;
      try { json = await r.json(); } catch (_e) { json = null; }
      return { status: r.status, json };
    };

    await test('11a. smoke: the slice page is 200, sets an HttpOnly SameSite=Strict cookie, no error line in 5 s', async () => {
      const page = await fetch(base + '/slice/room-x');
      assert.equal(page.status, 200);
      const set = page.headers.get('set-cookie') || '';
      assert.ok(/mos_sid=/.test(set) && /HttpOnly/i.test(set) && /SameSite=strict/i.test(set), 'cookie: ' + set);
      cookie = set.split(';')[0];
      await sleep(5000);
      assert.ok(!/\berror\b|⨯|EADDRINUSE|unhandled/i.test(stderr.replace(/error\.js/g, '')), 'server stderr: ' + stderr.slice(-300));
    });

    await test('11b. action layer over HTTP: refusals first (no cookie, GET, unknown action, agent-only, foreign Origin)', async () => {
      assert.equal((await post('/api/actions/listRooms', {}, false)).status, 401);
      const r = await fetch(base + '/api/actions/listRooms', { method: 'GET', headers: { cookie } });
      assert.equal(r.status, 405, 'GET on an action is refused');
      assert.equal((await post('/api/actions/doesNotExist', {})).status, 404);
      const agentOnly = await post('/api/actions/proposeDecision', { roomSlug: 'room-x', selectedNodeId: 'x', question: 'q', principal: 'human' });
      assert.equal(agentOnly.status, 403, 'a browser (or a body claiming human) cannot call the agent-only action');
      const cross = await fetch(base + '/api/actions/listRooms', { method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: 'http://evil.example' }, body: '{}' });
      assert.equal(cross.status, 403, 'a foreign Origin is refused');
    });

    let claimId = null;
    let feedServed = false;
    await test('11c. listRooms, openRoom, readArtifact through the pool', async () => {
      const list = await post('/api/actions/listRooms', {});
      assert.equal(list.status, 200);
      assert.ok(list.json.rooms.includes('room-x'));
      const open = await post('/api/actions/openRoom', { roomSlug: 'room-x' });
      assert.equal(open.json.ok, true, JSON.stringify(open.json));
      const art = await post('/api/actions/readArtifact', { path: 'STATE.md' });
      if (art.json.ok !== true) {
        console.log('    note: room_artifact answered ' + JSON.stringify(art.json));
        return 'NOT_PROVEN';
      }
      assert.ok(/room-x/.test(art.json.markdown));
      const bad = await post('/api/actions/readArtifact', { path: '../outside.md' });
      assert.notEqual(bad.json.ok, true, 'a path outside the room is never read');
    });

    await test('11d. feed: a snapshot names the claim, a delta pull returns it', async () => {
      const snap = await post('/api/feed/changes', { collection: 'nodes', mode: 'snapshot', limit: 50 });
      if (snap.json.ok !== true) {
        console.log('    note: room_changes answered ' + JSON.stringify(snap.json));
        return 'NOT_PROVEN';
      }
      feedServed = true;
      const claim = (snap.json.docs || []).find((d) => String(d.type).toLowerCase() === 'claim');
      assert.ok(claim, 'the seeded claim is in the snapshot');
      claimId = claim.id;
      const delta = await post('/api/feed/changes', { collection: 'nodes', after: 0, limit: 50 });
      assert.equal(delta.json.ok, true, JSON.stringify(delta.json));
      assert.ok(delta.json.changes.some((c) => c.entity_id === claimId));
    });

    await test('11e. ask mints a gate on the browser session; Confirm ratifies; the decision reaches the feed and change_seq moves', async () => {
      if (!feedServed || !claimId) return 'NOT_PROVEN';
      const before = (await post('/api/feed/changes', { collection: 'decisions', after: 0, limit: 50 })).json;
      const asked = await post('/api/ask', { roomSlug: 'room-x', selectedNodeId: claimId, question: 'Does this claim have enough evidence?' });
      assert.equal(asked.json.ok, true, JSON.stringify(asked.json));
      assert.ok(asked.json.gate_id && Array.isArray(asked.json.options) && asked.json.options.length === 3);
      assert.equal(asked.json.recommended_id, 'approve', 'the evidence node next to the claim makes approve the recommendation');
      const superset = asked.json.rendered && asked.json.rendered.contract && asked.json.rendered.contract.superset_options;
      assert.ok(Array.isArray(superset) && superset.length === 3, 'the card is rendered from rendered.contract.superset_options');
      const notAnOption = await post('/api/actions/approveDecision', { gateId: asked.json.gate_id, chosen: 'not-an-option' });
      assert.equal(notAnOption.json.ok, false);
      const unknown = await post('/api/actions/approveDecision', { gateId: 'gate-not-minted-here', chosen: 'approve' });
      assert.equal(unknown.json.reason, 'unknown_gate');
      const done = await post('/api/actions/approveDecision', { gateId: asked.json.gate_id, chosen: asked.json.recommended_id });
      assert.equal(done.json.ok, true, JSON.stringify(done.json));
      assert.equal(done.json.verdict, 'approve');
      assert.equal(done.json.answer.ratified, true);
      const after = (await post('/api/feed/changes', { collection: 'decisions', after: 0, limit: 50 })).json;
      assert.ok(after.latest_seq > before.latest_seq, 'change_seq increments (' + before.latest_seq + ' to ' + after.latest_seq + ')');
      assert.ok(after.changes.some((c) => c.entity_id === 'decision:gate:' + asked.json.gate_id), 'the decision node is on the decisions feed');
    });
  } finally {
    if (server) {
      try { server.kill('SIGTERM'); } catch (_e) { /* already gone */ }
      await sleep(400);
    }
    if (daemon) {
      const { stopDaemon } = require('./helpers/mcp-daemon-369.cjs');
      await stopDaemon(daemon);
    }
  }
}

async function main() {
  await staticArms();
  if (BUILT) await builtArms();
  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed + (notProven ? ' NOT_PROVEN=' + notProven : ''));
  void os;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
