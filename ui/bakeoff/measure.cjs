#!/usr/bin/env node
'use strict';

/*
 * ui/bakeoff/measure.cjs -- Phase 369 plan 18 (BAKE369-03, D-05).
 *
 * One harness measures both production-built bake-off candidates on the nine
 * judged measures plus two extras, on this machine, on identical fixture rooms:
 *
 *   node ui/bakeoff/measure.cjs --candidate workroom|agent-native|both
 *                               [--out <file>] [--skip-build]
 *
 *   --candidate  which candidate(s) to set up, build and measure (required)
 *   --out        results file, default ui/bakeoff/results.json
 *   --skip-build keep the existing app/ and build output (no setup, no build)
 *
 * Measure, do not advocate: every number comes from a run here; a measure that
 * cannot be taken is recorded as { value: null, not_measured: '<reason>' },
 * never estimated. Each measure is { value, unit?, method, details }.
 *
 * Hermetic: servers, daemon and child writers run under a temp HOME and
 * MINDRIAN_ROOMS_HOME, no CLAUDE_* variables, telemetry off, loopback only.
 * Setup and build run under the real HOME (the package cache) because they
 * install dependencies; measurement never does. Playwright is resolved through
 * tests/e2e-369/lib/pw.cjs; its browser cache path is pinned before HOME moves.
 *
 * Pure scoring helpers are exported for tests/test-369-bakeoff-measure.cjs:
 * retainedLines, countForbiddenIo, diffStorage, convergence, packagingSummary,
 * parseSliceActions. No literal long dash in this file (U+2014 and U+2013 are
 * built at run time where needed). CJS, switch-case argv router.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BAKEOFF = __dirname;
const REAL_HOME = process.env.HOME || os.homedir();
const NODE_BIN_DIR = path.dirname(process.execPath);

const EXPECTED_ACTIONS = {
  listRooms: 'both',
  openRoom: 'human',
  readArtifact: 'both',
  listEvidence: 'both',
  proposeDecision: 'agent',
  approveDecision: 'human',
};

// The UI-SPEC contract CSP, verbatim (369-UI-SPEC.md, "Egress, Privacy and Offline").
const CSP_CONTRACT =
  "default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self'; frame-src 'none'; object-src 'none'";
// Measurement-only variant that isolates the style-src question from the
// script-src question (a framework's inline hydration payload is blocked by
// default-src 'self'). It is NEVER a shipped policy.
const CSP_STYLE_ONLY = CSP_CONTRACT + "; script-src 'self' 'unsafe-inline'";

const SKIP_DIRS = new Set(['node_modules', '.next', '.output', 'build', '.react-router', '.generated', 'dist', '.git']);

// ------------------------------------------------------------------ helpers

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function median(nums) {
  const a = nums.slice().sort((x, y) => x - y);
  if (a.length === 0) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

// Recursive file list. Symlinks are never followed (a pnpm tree is full of
// them); `skip` names directories not descended into.
function walkFiles(dir, skip, out) {
  const acc = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return acc;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      acc.push(abs);
      continue;
    }
    if (e.isDirectory()) {
      if (skip && skip.has(e.name)) continue;
      walkFiles(abs, skip, acc);
    } else {
      acc.push(abs);
    }
  }
  return acc;
}

// ------------------------------------------------------------ scoring helpers

// Lines of the workroom snapshot still byte-identical in the candidate's app
// tree. `by_content` matches a snapshot file's sha256 against every file in the
// tree (a transplanted file counts); `by_path` requires the same relative path.
function retainedLines(snapshot, appDir) {
  const files = walkFiles(appDir, SKIP_DIRS);
  const shas = new Map();
  for (const f of files) {
    let st;
    try {
      st = fs.lstatSync(f);
    } catch (_e) {
      continue;
    }
    if (!st.isFile()) continue;
    shas.set(path.relative(appDir, f).split(path.sep).join('/'), sha256(fs.readFileSync(f)));
  }
  const bySha = new Set(shas.values());
  let total = 0;
  let byContent = 0;
  let byPath = 0;
  const kept = [];
  for (const f of snapshot.files || []) {
    total += f.lines || 0;
    if (bySha.has(f.sha256)) {
      byContent += f.lines || 0;
      kept.push(f.path);
    }
    if (shas.get(f.path) === f.sha256) byPath += f.lines || 0;
  }
  const totalLines = typeof snapshot.total_lines === 'number' ? snapshot.total_lines : total;
  return {
    retained_lines: byContent,
    retained_lines_same_path: byPath,
    total_lines: totalLines,
    share: totalLines > 0 ? byContent / totalLines : 0,
    retained_files: kept,
  };
}

// Remove comments but keep strings and newlines, so a forbidden name inside a
// comment is not a hit and line numbers survive.
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let q = null;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') {
        out += src[i + 1] || '';
        i += 2;
        continue;
      }
      if (c === q) q = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      q = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const FORBIDDEN_IO = [
  /\brequire\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/,
  /\bfrom\s+['"](?:node:)?fs(?:\/promises)?['"]/,
  /\bimport\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/,
  /\brequire\(\s*['"](?:node:)?child_process['"]\s*\)/,
  /\bfrom\s+['"](?:node:)?child_process['"]/,
  /\bimport\(\s*['"](?:node:)?child_process['"]\s*\)/,
  /\b(?:execFile|execFileSync|execSync|spawnSync)\s*\(/,
];

// files: absolute paths. Counts direct file-system and process-spawn uses.
function countForbiddenIo(files) {
  const hits = [];
  for (const f of files) {
    let src;
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch (_e) {
      continue;
    }
    const lines = stripComments(src).split('\n');
    lines.forEach((line, i) => {
      if (FORBIDDEN_IO.some((re) => re.test(line))) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 140) });
    });
  }
  return { count: hits.length, hits };
}

// before / after: { cookies:[], localStorage:[], sessionStorage:[], indexedDB:[], files:[] }
function diffStorage(before, after) {
  const kinds = ['cookies', 'localStorage', 'sessionStorage', 'indexedDB', 'files'];
  const added = {};
  const removed = {};
  let count = 0;
  for (const k of kinds) {
    const b = new Set((before && before[k]) || []);
    const a = new Set((after && after[k]) || []);
    added[k] = [...a].filter((x) => !b.has(x)).sort();
    removed[k] = [...b].filter((x) => !a.has(x)).sort();
    count += added[k].length;
  }
  return { added, removed, count };
}

// samples: [{ ms, seen }] taken after the writes; expected: how many should show.
function convergence(samples, expected) {
  const s = (samples || []).slice().sort((x, y) => x.ms - y.ms);
  let best = 0;
  let at = null;
  for (const p of s) {
    if (p.seen > best) best = p.seen;
    if (at === null && p.seen >= expected) at = p.ms;
  }
  return { converged: at !== null, ms: at, missing: Math.max(0, expected - best), samples: s.length };
}

// Counts files, directories, bytes and node_modules content under `dir`.
function packagingSummary(dir) {
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  let nmFiles = 0;
  const packages = new Set();
  function visit(abs, inNm) {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const e of entries) {
      const p = path.join(abs, e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) {
        dirs += 1;
        const nm = e.name === 'node_modules';
        if (nm) {
          let pk;
          try {
            pk = fs.readdirSync(p, { withFileTypes: true });
          } catch (_e) {
            pk = [];
          }
          for (const q of pk) {
            if (q.name.startsWith('.')) continue;
            if (q.name.startsWith('@')) {
              let inner = [];
              try {
                inner = fs.readdirSync(path.join(p, q.name));
              } catch (_e) { /* skip */ }
              for (const x of inner) packages.add(q.name + '/' + x);
            } else {
              packages.add(q.name);
            }
          }
        }
        visit(p, inNm || nm);
      } else {
        files += 1;
        if (inNm) nmFiles += 1;
        try {
          bytes += fs.lstatSync(p).size;
        } catch (_e) { /* skip */ }
      }
    }
  }
  visit(dir, false);
  return {
    files,
    dirs,
    bytes,
    node_modules_files: nmFiles,
    has_node_modules: packages.size > 0,
    node_modules_packages: [...packages].sort(),
  };
}

// name -> exposure for every defineShellAction({ name: 'x', exposure: 'y' ... }).
function parseSliceActions(src) {
  const out = {};
  const re = /name:\s*['"]([A-Za-z]+)['"]\s*,\s*exposure:\s*['"]([a-z]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = m[2];
  return out;
}

// ------------------------------------------------------------- process helpers

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function listenerPids(port) {
  try {
    const out = cp.execFileSync('ss', ['-ltnpH', 'sport = :' + port], { encoding: 'utf8' });
    const pids = [];
    const re = /pid=(\d+)/g;
    let m;
    while ((m = re.exec(out)) !== null) pids.push(Number(m[1]));
    return [...new Set(pids)];
  } catch (_e) {
    return [];
  }
}

function httpGet(port, p, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: headers || {} }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function cleanEnv(extra) {
  const env = {
    PATH: NODE_BIN_DIR + ':/usr/local/bin:/usr/bin:/bin',
    LANG: 'C.UTF-8',
    DO_NOT_TRACK: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    AGENT_NATIVE_TELEMETRY_DISABLED: '1',
  };
  return Object.assign(env, extra || {});
}

// ------------------------------------------------------------------- candidates

const CANDIDATES = {
  workroom: {
    id: 'workroom',
    dir: path.join(BAKEOFF, 'workroom'),
    planTag: '(369-15)',
    testFile: 'tests/test-369-bakeoff-workroom.cjs',
    serveEnvExtra: {},
    outputRel: '.next/standalone',
    copyRun: { cmd: 'node', args: ['server.js'], env: { HOSTNAME: '127.0.0.1' } },
    sliceActionsFile: path.join('overlay', 'src', 'server', 'slice-actions.ts'),
    serverSourceDirs: [path.join('overlay', 'src', 'server'), path.join('overlay', 'src', 'app', 'api'), path.join('overlay', 'src', 'proxy.ts')],
    generatedServerDirs: [path.join('app', 'src', 'server'), path.join('app', 'src', 'app', 'api'), path.join('app', 'src', 'lib'), path.join('app', 'src', 'proxy.ts')],
    ui: {
      url: (room) => '/slice/' + room + '?artifact=STATE.md',
      evidence: '[data-testid="evidence-list"] li',
      ask: '[data-testid="ask-claude"]',
      gate: '[data-testid="gate-card"]',
      confirm: '[data-testid="gate-confirm"]',
      recorded: '[data-testid="gate-recorded"]',
      decisions: '[data-testid="decision-list"] li',
      askResponse: /\/api\/ask/,
      selectByClick: true,
    },
  },
  'agent-native': {
    id: 'agent-native',
    dir: path.join(BAKEOFF, 'agent-native'),
    planTag: '(369-16)',
    testFile: 'tests/test-369-bakeoff-agent-native.cjs',
    serveEnvExtra: {
      AUTH_DISABLED: 'true',
      AGENT_NATIVE_DISABLED_PLUGINS: 'agent-chat,integrations,terminal,onboarding,observational-memory,context-xray',
    },
    outputRel: '.output',
    copyRun: {
      cmd: 'node',
      args: ['server/index.mjs'],
      env: {
        HOST: '127.0.0.1',
        HOSTNAME: '127.0.0.1',
        NITRO_HOST: '127.0.0.1',
        AUTH_DISABLED: 'true',
        AGENT_NATIVE_DISABLED_PLUGINS: 'agent-chat,integrations,terminal,onboarding,observational-memory,context-xray',
      },
      portVars: ['PORT', 'NITRO_PORT'],
    },
    sliceActionsFile: path.join('overlay', 'server', 'lib', 'slice-actions.ts'),
    serverSourceDirs: [path.join('overlay', 'server'), path.join('overlay', 'actions')],
    generatedServerDirs: [path.join('app', 'server'), path.join('app', 'actions')],
    ui: {
      url: (room, node) => '/slice/' + room + '?path=STATE.md' + (node ? '&node=' + encodeURIComponent(node) : ''),
      evidence: '[data-testid="evidence"] li',
      ask: 'button.ask',
      gate: 'form fieldset',
      confirm: '[data-testid="confirm"]',
      recorded: 'p.locked',
      decisions: null,
      askResponse: /propose-decision/,
      selectByClick: false,
    },
  },
};

// --------------------------------------------------------------- fixture seeds

function hash31(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// The claim id a fixture seed produces (typed-claim.cjs CLAIM_NODE_ID, the
// same formula tests/test-369-claude-adapter.cjs uses).
function claimId(slug, variant, text) {
  const { CLAIM_NODE_ID } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-claim.cjs'));
  return CLAIM_NODE_ID('fixture-369-' + slug + '-' + variant, text);
}

const E2E_ROOM = 'room-e';
function e2eRoomSpec() {
  // Both claims point at a source, so an Approve meets the room's evidence
  // floor and ratifies (a claim with no source would be filed as needs
  // evidence and write no decision).
  const textX = 'Demand for the product is rising in the coastal region';
  const textY = 'Two competitors left the segment last year';
  const url = 'https://example.org/369-bakeoff-e2e-source';
  const sourceId = 'EvidenceClaim:fixture-369-' + E2E_ROOM + '-src-s1:' + hash31(url);
  return {
    slug: E2E_ROOM,
    variant: 'wide',
    migrate: true,
    seed: [
      { kind: 'claim', text: textX, variant: 'x' },
      { kind: 'claim', text: textY, variant: 'y' },
      { kind: 'source', url, retrieved_at: '2026-10-01T00:00:00Z', variant: 's1' },
      { kind: 'edge', source_id: claimId(E2E_ROOM, 'x', textX), target_id: sourceId, edge_type: 'SOURCED_FROM' },
      { kind: 'edge', source_id: claimId(E2E_ROOM, 'y', textY), target_id: sourceId, edge_type: 'SOURCED_FROM' },
    ],
  };
}

const ADAPTER_ROOM = 'room-p';
function adapterRoomSpec() {
  const slug = ADAPTER_ROOM;
  const textX = 'Demand for the product is rising in the coastal region';
  const idX = claimId(slug, 'x', textX);
  const url = 'https://example.org/369-bakeoff-source';
  const textL = 'Larry note about ' + idX + ': the regional sales report supports this.';
  const claimL = claimId(slug, 'l', textL);
  const sourceId = 'EvidenceClaim:fixture-369-' + slug + '-src-s1:' + hash31(url);
  return {
    selectedId: idX,
    selectedText: textX,
    larryClaimId: claimL,
    sourceId,
    spec: {
      slug,
      variant: 'wide',
      migrate: true,
      seed: [
        { kind: 'claim', text: textX, variant: 'x' },
        { kind: 'source', url, retrieved_at: '2026-10-01T00:00:00Z', variant: 's1' },
        { kind: 'claim', text: textL, variant: 'l' },
        { kind: 'edge', source_id: claimL, target_id: sourceId, edge_type: 'SOURCED_FROM' },
      ],
    },
  };
}

// -------------------------------------------------------------- shell lifecycle

class Shell {
  constructor(cand, opts) {
    this.cand = cand;
    this.opts = opts;
    this.out = '';
    this.child = null;
    this.port = 0;
    this.startedAt = 0;
  }

  async start() {
    const o = this.opts;
    this.port = await freePort();
    const base = {
      HOME: o.home,
      USERPROFILE: o.home,
      MINDRIAN_ROOMS_HOME: path.join(o.home, 'MindrianRooms'),
      MOS_DAEMON_URL: 'http://127.0.0.1:' + o.daemonPort,
      MOS_PROPOSAL_SOURCE: o.mode || 'fixed',
      PORT: String(this.port),
    };
    let cmd;
    let args;
    let cwd;
    let env;
    if (o.copyDir) {
      const run = this.cand.copyRun;
      cmd = run.cmd;
      args = run.args;
      cwd = o.copyDir;
      env = cleanEnv(Object.assign(base, run.env || {}));
      for (const v of run.portVars || []) env[v] = String(this.port);
    } else {
      cmd = 'bash';
      args = [path.join(this.cand.dir, 'serve.sh')];
      cwd = this.cand.dir;
      env = cleanEnv(Object.assign(base, this.cand.serveEnvExtra));
    }
    this.startedAt = Date.now();
    this.child = cp.spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    this.child.stdout.on('data', (c) => (this.out += c.toString('utf8')));
    this.child.stderr.on('data', (c) => (this.out += c.toString('utf8')));
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      try {
        const r = await httpGet(this.port, o.probePath || '/', {});
        if (r.status === 200) {
          this.readyMs = Date.now() - this.startedAt;
          return this;
        }
      } catch (_e) { /* not up yet */ }
      await sleep(150);
    }
    throw new Error('shell did not answer within 60 s: ' + this.out.slice(-300));
  }

  // pnpm detaches Nitro, so kill the process group AND the port listener, both
  // of which this harness spawned (nothing else is touched).
  async stop() {
    if (this.child) {
      try { process.kill(-this.child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    if (this.port) {
      for (const pid of listenerPids(this.port)) {
        try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
      }
    }
    await sleep(300);
  }
}

// ----------------------------------------------------------------- daemon bits

function startSseWatcher(port) {
  const events = [];
  const req = http.request({ host: '127.0.0.1', port, path: '/event', method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
    res.on('data', (c) => {
      const t = c.toString('utf8');
      if (t.includes('room.changed')) events.push({ at: Date.now(), text: t.slice(0, 200) });
    });
  });
  req.on('error', () => {});
  req.end();
  return { events, close: () => req.destroy() };
}

function writeClaimsFromChild(daemon, roomSlug, texts, tag) {
  const script =
    "const nav=require(process.argv[1]+'/lib/core/navigation.cjs');" +
    "const r=require(process.argv[1]+'/lib/core/room-db.cjs');" +
    'const db=r.openRoomDb(process.argv[2]);' +
    'try{JSON.parse(process.argv[3]).forEach(function(t,i){' +
    "var x=nav.writeClaimNode(db,{knowledge_type:'fact',text:t,sessionId:'bakeoff-'+process.argv[4]+'-'+i});" +
    "if(!x||x.ok!==true)throw new Error('write failed '+JSON.stringify(x));});}finally{r.closeRoomDb(db);}";
  const env = Object.assign({}, daemon.env);
  const res = cp.spawnSync(process.execPath, ['-e', script, REPO_ROOT, daemon.roomDirs[roomSlug], JSON.stringify(texts), tag], {
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (res.status !== 0) throw new Error('child writer failed: ' + (res.stderr || '').slice(0, 300));
}

async function latestSeq(client) {
  const res = await client.callTool({ name: 'room_changes', arguments: { collection: 'nodes', after: 0, limit: 1 } });
  const txt = (res.content || []).map((c) => c.text || '').join('');
  const d = JSON.parse(txt);
  return { ok: d.ok === true, latest_seq: d.latest_seq, epoch: d.epoch, raw: d.ok === true ? undefined : txt.slice(0, 160) };
}

// ----------------------------------------------------------------- page helpers

async function dumpStorage(context, page) {
  const cookies = (await context.cookies()).map((c) => c.name);
  let inPage = { localStorage: [], sessionStorage: [], indexedDB: [] };
  try {
    inPage = await page.evaluate(async () => {
      let idb = [];
      try {
        if (indexedDB.databases) idb = (await indexedDB.databases()).map((d) => d.name || '');
      } catch (_e) { /* none */ }
      return {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        indexedDB: idb,
      };
    });
  } catch (_e) { /* about:blank */ }
  return Object.assign({ cookies }, inPage);
}

function attachErrorCapture(page) {
  const cap = { console: [], page: [], http: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') cap.console.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => cap.page.push(String(e && e.message ? e.message : e).slice(0, 160)));
  page.on('response', (r) => {
    if (r.status() >= 400) cap.http.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, ''));
  });
  return cap;
}

async function waitCount(page, selector, atLeast, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const n = await page.locator(selector).count().catch(() => 0);
    if (n >= atLeast) return n;
    await sleep(50);
  }
  return page.locator(selector).count().catch(() => 0);
}

async function documentRendered(page, timeoutMs) {
  // STATE.md of the fixture room reads "Fixture room for ...": the BlockNote
  // document is rendered when that text is on the page inside a contenteditable
  // (false) editor.
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await page
      .evaluate(() => {
        const ed = document.querySelector('.bn-editor, [data-content-editable-leaf], .bn-container');
        const text = document.body ? document.body.innerText : '';
        const editable = document.querySelector('.bn-editor');
        return {
          editor: !!ed,
          text: /Fixture room/.test(text),
          editable: editable ? editable.getAttribute('contenteditable') : null,
        };
      })
      .catch(() => ({ editor: false, text: false, editable: null }));
    if (r.editor && r.text) return Object.assign({ rendered: true }, r);
    await sleep(100);
  }
  return { rendered: false, editor: false, text: false, editable: null };
}

// -------------------------------------------------------------------- measuring

function notMeasured(reason) {
  return { value: null, not_measured: reason };
}

function measureArchitecture(cand) {
  const allowed = [
    'ui/bakeoff/' + cand.id + '/',
    'ui/shared/',
    cand.testFile,
    '.planning/phases/369-',
  ];
  let files = [];
  try {
    const out = cp.execFileSync('git', ['log', '--format=', '--name-only', '--fixed-strings', '--grep=' + cand.planTag], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    files = [...new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))];
  } catch (e) {
    return notMeasured('git log failed: ' + e.message.slice(0, 120));
  }
  const outside = files.filter((f) => !allowed.some((a) => f.startsWith(a)));
  // Framework conventions bypassed: mechanical markers in the candidate's own
  // overlay and scripts (a bundler told to leave a module alone, a type or lint
  // check silenced, a framework default plugin disabled, a process singleton
  // placed on globalThis because the framework gives every route its own
  // bundle, a framework-owned route family removed).
  const markers = [
    { re: /globalThis/, note: 'process singleton on globalThis (framework bundles routes separately)' },
    { re: /webpackIgnore|turbopackIgnore|@vite-ignore/, note: 'bundler told to leave a module alone' },
    { re: /eslint-disable|@ts-ignore|@ts-expect-error/, note: 'lint or type check silenced' },
    { re: /AGENT_NATIVE_DISABLED_PLUGINS/, note: 'framework default plugins disabled' },
    { re: /agentTool:\s*false|mcpTool:\s*false/, note: 'framework agent or MCP exposure switched off per action' },
    { re: /uiOnly/, note: 'framework UI-only guard relied on' },
  ];
  const scan = [];
  const roots = [path.join(cand.dir, 'overlay')];
  for (const f of ['setup.sh', 'build.sh', 'serve.sh']) roots.push(path.join(cand.dir, f));
  const all = [];
  for (const r of roots) {
    let st;
    try { st = fs.statSync(r); } catch (_e) { continue; }
    if (st.isDirectory()) all.push(...walkFiles(r, SKIP_DIRS)); else all.push(r);
  }
  for (const f of all) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    src.split('\n').forEach((line, i) => {
      for (const m of markers) {
        if (m.re.test(line)) scan.push({ file: path.relative(REPO_ROOT, f), line: i + 1, note: m.note });
      }
    });
  }
  // Framework paths deleted before the build (the removal list).
  let removed = 0;
  const removeTxt = path.join(cand.dir, 'REMOVE.txt');
  if (fs.existsSync(removeTxt)) {
    removed = fs.readFileSync(removeTxt, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
  } else {
    const setup = fs.readFileSync(path.join(cand.dir, 'setup.sh'), 'utf8');
    const block = setup.match(/REMOVE=\(([\s\S]*?)\n\)/);
    if (block) removed = block[1].split('\n').filter((l) => /^\s*"/.test(l)).length;
  }
  const byNote = {};
  for (const s of scan) byNote[s.note] = (byNote[s.note] || 0) + 1;
  return {
    value: scan.length,
    unit: 'convention-bypass markers in the candidate overlay and scripts',
    method:
      'markers counted by regex over overlay/ and setup/build/serve scripts (each listed with file, line and a one-line note); files outside ui/bakeoff/<candidate>/, ui/shared/ and the candidate test, from git log --name-only over the candidate plan commits; removal-list entries counted from REMOVE.txt or the REMOVE array',
    details: {
      files_outside_candidate_and_shared: outside.length,
      outside_files: outside,
      plan_commit_files: files.length,
      framework_paths_removed: removed,
      bypass_markers_by_note: byNote,
      markers: scan,
    },
  };
}

function measureSurviving(cand) {
  const snapPath = path.join(BAKEOFF, 'workroom', 'snapshot.json');
  const appDir = path.join(cand.dir, 'app');
  if (!fs.existsSync(snapPath)) return notMeasured('ui/bakeoff/workroom/snapshot.json is absent');
  if (!fs.existsSync(appDir)) return notMeasured('candidate app/ is absent');
  const snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  const r = retainedLines(snapshot, appDir);
  return {
    value: r.retained_lines,
    unit: 'workroom snapshot lines byte-identical in the candidate app tree',
    method:
      'sha256 of every workroom snapshot file (35 files, ' + r.total_lines + ' lines) matched against every file in the candidate app/ tree (node_modules, build output and generated dirs excluded); lines counted from the snapshot',
    details: {
      total_lines: r.total_lines,
      share: Number(r.share.toFixed(4)),
      retained_lines_same_path: r.retained_lines_same_path,
      retained_files: r.retained_files,
    },
  };
}

function measureDependencies(cand, build) {
  let removed = [];
  let method;
  const patch = path.join(cand.dir, 'package-patch.json');
  const pkgPath = path.join(cand.dir, 'app', 'package.json');
  let remaining = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    remaining = {
      dependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
    };
  } catch (_e) { /* app absent */ }
  if (fs.existsSync(patch)) {
    const p = JSON.parse(fs.readFileSync(patch, 'utf8'));
    removed = p.remove || [];
    method = 'package-patch.json "remove" list (prefix patterns end in *), applied by setup.sh after npm ci; build_green from the build run in this harness';
  } else {
    const setup = fs.readFileSync(path.join(cand.dir, 'setup.sh'), 'utf8');
    const rm = setup.match(/pnpm (?:remove|uninstall)[^\n]*/g) || [];
    removed = rm;
    method = 'setup.sh searched for pnpm remove or uninstall commands (none means code removed, not packages); build_green from the build run in this harness';
  }
  return {
    value: removed.length,
    unit: 'package removal commands or patterns',
    method,
    details: { removed, build_green: build ? build.ok : null, remaining_in_app_manifest: remaining },
  };
}

function measureDirectFileIo(cand) {
  const overlayFiles = [];
  for (const d of cand.serverSourceDirs) {
    const abs = path.join(cand.dir, d);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (st.isDirectory()) overlayFiles.push(...walkFiles(abs, SKIP_DIRS).filter((f) => /\.(ts|tsx|js|cjs|mjs)$/.test(f))); else overlayFiles.push(abs);
  }
  const genFiles = [];
  for (const d of cand.generatedServerDirs) {
    const abs = path.join(cand.dir, d);
    let st;
    try { st = fs.statSync(abs); } catch (_e) { continue; }
    if (st.isDirectory()) genFiles.push(...walkFiles(abs, SKIP_DIRS).filter((f) => /\.(ts|tsx|js|cjs|mjs)$/.test(f))); else genFiles.push(abs);
  }
  const claudeAdapter = path.join(REPO_ROOT, 'ui', 'shared', 'src', 'claude-adapter.ts');
  const gen = genFiles.filter((f) => f !== claudeAdapter);
  const a = countForbiddenIo(overlayFiles);
  const b = countForbiddenIo(gen);
  return {
    value: b.count,
    unit: 'direct fs or child_process uses in the generated server source (overlay plus framework server dirs)',
    method:
      'countForbiddenIo (comments stripped; require and import of fs, node:fs, fs/promises, child_process; execFile, execFileSync, execSync, spawnSync) over the generated app server dirs, node_modules excluded, ui/shared/src/claude-adapter.ts excluded; the overlay-only count is reported beside it',
    details: {
      overlay_files_scanned: overlayFiles.length,
      overlay_hits: a.count,
      generated_files_scanned: gen.length,
      generated_hits: b.count,
      hits: b.hits.slice(0, 10).map((h) => ({ file: path.relative(REPO_ROOT, h.file), line: h.line, text: h.text })),
    },
  };
}

// ------------------------------------------------------------ the live arm runs

async function launchBrowser() {
  const helper = require(path.join(REPO_ROOT, 'tests', 'e2e-369', 'lib', 'pw.cjs'));
  const launched = await helper.launch();
  return { helper, browser: launched.browser };
}

// Run 1: adapter (room-proposal) source, a selected node reaches the proposal.
async function runSelectedState(cand, ctx) {
  const { startDaemon, stopDaemon } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-daemon-369.cjs'));
  const room = adapterRoomSpec();
  const staticBoundaries = {
    http_hops: 3,
    process_boundaries: ['browser', 'shell server', 'MindrianOS daemon'],
    processes_spawned_for_proposal: 0,
    note:
      'browser to shell action route (HTTP 1), shell to daemon adapter MCP session reading claim_read and graph_query (HTTP 2), shell to daemon gate_render on the human session (HTTP 3); counted statically from ' +
      (cand.id === 'workroom'
        ? 'ui/bakeoff/workroom/overlay/src/app/api/ask/route.ts and overlay/src/server/slice-actions.ts'
        : 'ui/bakeoff/agent-native/overlay/server/lib/slice-actions.ts (proposeDecision)'),
  };
  let daemon = null;
  let shell = null;
  let browser = null;
  try {
    daemon = await startDaemon({ rooms: [room.spec] });
    shell = await new Shell(cand, { daemonPort: daemon.port, home: ctx.home, mode: 'adapter', probePath: '/slice/' + ADAPTER_ROOM }).start();
    const b = await launchBrowser();
    browser = b.browser;
    const context = await browser.newContext();
    const page = await context.newPage();
    const cap = b.helper.captureEgress(page);
    const base = 'http://127.0.0.1:' + shell.port;
    const asks = [];
    page.on('response', async (r) => {
      if (cand.ui.askResponse.test(r.url()) && r.request().method() === 'POST') {
        let text = '';
        try { text = await r.text(); } catch (_e) { text = ''; }
        asks.push({ status: r.status(), text: text.slice(0, 4000) });
      }
    });
    const nodeId = room.selectedId;
    await page.goto(base + cand.ui.url(ADAPTER_ROOM, cand.ui.selectByClick ? undefined : nodeId), { waitUntil: 'load' });
    const nEv = await waitCount(page, cand.ui.evidence, cand.ui.selectByClick ? 2 : 1, 15000);
    let selectMethod;
    if (cand.ui.selectByClick) {
      // select the claim by its text in the evidence list
      await page.locator(cand.ui.evidence + ' button', { hasText: room.selectedText.slice(0, 30) }).first().click({ timeout: 8000 });
      selectMethod = 'click on the evidence list item';
    } else {
      selectMethod = 'URL query parameter ?node=<id> (the page has no clickable selection control)';
    }
    const askBtn = page.locator(cand.ui.ask);
    await askBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction((sel) => { const el = document.querySelector(sel); return el && !el.disabled; }, cand.ui.ask, { timeout: 20000 });
    const t0 = Date.now();
    await askBtn.click();
    let gateShown = false;
    try {
      await page.locator(cand.ui.gate).first().waitFor({ state: 'visible', timeout: 8000 });
      gateShown = true;
    } catch (_e) { /* no gate */ }
    await sleep(300);
    const askMs = Date.now() - t0;
    const body = asks.length ? asks[asks.length - 1] : null;
    const idInBody = body ? body.text.includes(nodeId) : false;
    let reason = null;
    if (body) {
      try { const j = JSON.parse(body.text); reason = j.reason || j.refused || j.message || j.error || null; } catch (_e) { reason = body.text.slice(0, 160); }
    }
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const copyLine = pageText.includes('About node ' + nodeId) || pageText.includes('write the node id ' + nodeId);
    const hosts = cap.hosts();
    return {
      value: gateShown && idInBody,
      unit: 'pass: the selected node id is in the returned proposal and a gate is rendered',
      method:
        'MOS_PROPOSAL_SOURCE=adapter (369-ADAPTER-RULING.md: room-proposal; no Claude process runs in the shell, so no fake-claude binary applies). Fixture room ' +
        ADAPTER_ROOM + ' holds the selected claim and a proposed claim filed about it that names its id and points at a source. The node is selected (' + selectMethod +
        '), "Ask Claude" is clicked, and the shell server response is read: pass when it carries the selected node id and the gate card is shown',
      details: {
        source: 'adapter (room-proposal)',
        selected_node_id: nodeId,
        selection_method: selectMethod,
        evidence_items_seen: nEv,
        ask_to_gate_ms: askMs,
        ask_http_status: body ? body.status : null,
        selected_id_in_proposal_response: idInBody,
        gate_shown: gateShown,
        refusal_or_error: gateShown ? null : reason,
        response_excerpt: gateShown ? undefined : body ? body.text.slice(0, 240) : 'no response observed',
        server_log_lines_naming_adapter_or_proposal: gateShown
          ? []
          : shell.out.split('\n').filter((l) => /adapter|proposal|claude-adapter/i.test(l)).slice(0, 4).map((l) => l.slice(0, 240)),
        copy_reference_line_on_page: copyLine,
        boundaries: staticBoundaries,
        non_loopback_hosts: hosts.filter((h) => !(h === '127.0.0.1' || h.startsWith('127.0.0.1:'))),
      },
    };
  } catch (e) {
    return notMeasured('adapter-mode run failed: ' + String(e && e.message ? e.message : e).slice(0, 200));
  } finally {
    try { if (browser) await browser.close(); } catch (_e) { /* best effort */ }
    if (shell) await shell.stop();
    if (daemon) await stopDaemon(daemon);
  }
}

// Run 2: the full slice end to end with the fixed source, plus every live measure.
async function runFullSlice(cand, ctx) {
  const { startDaemon, stopDaemon, restartDaemon, legacyClient } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-daemon-369.cjs'));
  const out = {};
  let daemon = null;
  let shell = null;
  let browser = null;
  let sse = null;
  let client = null;
  const serveCwd = cand.id === 'workroom' ? path.join(cand.dir, 'app', cand.outputRel) : path.join(cand.dir, 'app');
  try {
    daemon = await startDaemon({ rooms: [e2eRoomSpec()] });
    sse = startSseWatcher(daemon.port);
    client = await legacyClient(daemon.port, 'bakeoff-harness');
    await client.client.callTool({ name: 'room_bind', arguments: { room: E2E_ROOM } });

    // files before (server cwd and HOME), cold start
    const filesBefore = () => {
      const a = walkFiles(serveCwd, new Set(['node_modules'])).map((f) => path.relative(serveCwd, f));
      const h = walkFiles(ctx.home, null).map((f) => 'HOME/' + path.relative(ctx.home, f));
      return a.concat(h);
    };
    const before = filesBefore();
    shell = await new Shell(cand, { daemonPort: daemon.port, home: ctx.home, mode: 'fixed', probePath: '/slice/' + E2E_ROOM }).start();
    const spawnedAt = shell.startedAt;
    const b = await launchBrowser();
    browser = b.browser;

    // storage before: a blank context
    const context = await browser.newContext();
    const page = await context.newPage();
    const cap = b.helper.captureEgress(page);
    const errs = attachErrorCapture(page);
    const storageBefore = await dumpStorage(context, page);
    const base = 'http://127.0.0.1:' + shell.port;

    const tLoad = Date.now();
    await page.goto(base + cand.ui.url(E2E_ROOM), { waitUntil: 'load' });
    const doc = await documentRendered(page, 15000);
    const evCount = await waitCount(page, cand.ui.evidence, 1, 15000);
    const feedLiveMs = Date.now() - tLoad;

    // let the 5 s startup window close, then read server stderr
    await sleep(Math.max(0, 5200 - (Date.now() - spawnedAt)));
    const lines = shell.out.split('\n');
    const events = lines.filter((l) => /^\[[^\]]+\].*(error|fail|refus|unhandled|locked)/i.test(l));
    const raw = lines.filter((l) => /error|fail|refus|unhandled|DEPLOY_SETTINGS_REQUIRED/i.test(l));
    const browserErrors = errs.console.length + errs.page.length;
    out.startup_errors = {
      value: events.length + browserErrors,
      unit: 'server error events in the first 5 s plus browser console and page errors on first load',
      method:
        'cold production start from serve.sh under a temp HOME; server stdout and stderr lines matching /^\\[...\\].*(error|fail|refus|unhandled|locked)/i counted as events (raw error-looking lines counted beside them); Playwright console errors (type error) and uncaught page errors on the first load of the slice page. Candidate B known startup errors are a measure here, not something fixed',
      details: {
        server_error_events: events.length,
        server_error_looking_lines: raw.length,
        browser_console_errors: errs.console.length,
        browser_page_errors: errs.page.length,
        http_4xx_5xx_on_first_load: errs.http.length,
        http_errors: errs.http.slice(0, 8),
        sample_events: events.slice(0, 4).map((l) => l.slice(0, 140)),
        sample_console: errs.console.slice(0, 3),
        sample_page_errors: errs.page.slice(0, 3),
      },
    };

    // The slice: gate rendered as real UI
    const askBtn = page.locator(cand.ui.ask);
    await page.waitForFunction((sel) => { const el = document.querySelector(sel); return el && !el.disabled; }, cand.ui.ask, { timeout: 20000 });
    const seq0 = await latestSeq(client.client);
    const decisionsBefore = cand.ui.decisions ? await page.locator(cand.ui.decisions).count() : null;
    await askBtn.click();
    await page.locator(cand.ui.gate).first().waitFor({ state: 'visible', timeout: 15000 });
    const gateInfo = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type=radio]'));
      return { options: radios.length, preselected: radios.some((r) => r.checked) };
    });
    // Confirm
    const hintsBefore = sse.events.length;
    const tConfirm = Date.now();
    await page.locator(cand.ui.confirm).click();
    await page.locator(cand.ui.recorded).first().waitFor({ state: 'visible', timeout: 15000 });
    const recordedMs = Date.now() - tConfirm;
    let replicaViewMs = null;
    let replicaNote = null;
    if (cand.ui.decisions) {
      const t1 = Date.now();
      const n = await waitCount(page, cand.ui.decisions, decisionsBefore + 1, 8000);
      replicaViewMs = n >= decisionsBefore + 1 ? Date.now() - tConfirm : null;
      if (replicaViewMs === null) replicaNote = 'the decisions list did not grow within 8 s (waited ' + (Date.now() - t1) + ' ms)';
    } else {
      replicaNote = 'NOT MEASURED: this candidate page renders no decision or standing list from the replica after Confirm (only a confirmation message and the node list, whose rows show type and title, not standing)';
    }
    let seq1 = seq0;
    const tSeq = Date.now();
    while (Date.now() - tSeq < 4000) {
      seq1 = await latestSeq(client.client);
      if (seq1.latest_seq > seq0.latest_seq) break;
      await sleep(100);
    }
    const hintFired = sse.events.length > hintsBefore;
    const hintMs = hintFired ? sse.events[hintsBefore].at - tConfirm : null;

    out.gate_click_to_view_ms = {
      value: recordedMs,
      unit: 'ms from the Confirm click to the confirmation shown in the page',
      method:
        'Playwright click on Confirm, then wait for the confirmation element; counts only, one run, headless Chromium on this machine. The replica-driven view update (decisions list) is reported beside it where the page renders one',
      details: {
        confirm_to_replica_view_ms: replicaViewMs,
        replica_view_note: replicaNote,
        change_seq_before: seq0.latest_seq,
        change_seq_after: seq1.latest_seq,
        change_seq_incremented: seq1.latest_seq > seq0.latest_seq,
        room_changed_hint_fired: hintFired,
        confirm_to_hint_ms: hintMs,
        gate_options: gateInfo.options,
        gate_recommended_preselected: gateInfo.preselected,
        slice_steps: {
          document_rendered: doc.rendered,
          document_read_only: doc.editable === 'false',
          evidence_items: evCount,
          gate_rendered_as_ui: gateInfo.options >= 2,
          confirm_recorded: true,
          change_seq_incremented: seq1.latest_seq > seq0.latest_seq,
          hint_fired: hintFired,
        },
        time_to_feed_live_ms: feedLiveMs,
      },
    };

    // storage after
    const storageAfter = await dumpStorage(context, page);
    const after = filesBefore();
    const dStorage = diffStorage(
      Object.assign({}, storageBefore, { files: before }),
      Object.assign({}, storageAfter, { files: after })
    );
    // Files the tooling created that are not the app (the package manager's own caches).
    const homeAdded = dStorage.added.files.filter((f) => f.startsWith('HOME/'));
    const appAdded = dStorage.added.files.filter((f) => !f.startsWith('HOME/'));
    out.persistent_state = {
      value: dStorage.count,
      unit: 'items created by running the slice (cookies, local and session storage keys, IndexedDB databases, server-side files)',
      method:
        'Playwright storage dump (cookie names, localStorage and sessionStorage keys, indexedDB.databases()) from a blank context before and after the slice; recursive file listing of the server working directory (node_modules not descended) and the hermetic HOME before the cold start and after the slice',
      details: {
        cookies: dStorage.added.cookies,
        localStorage: dStorage.added.localStorage,
        sessionStorage: dStorage.added.sessionStorage,
        indexedDB: dStorage.added.indexedDB,
        server_files_added: appAdded.length,
        server_files_added_list: appAdded.slice(0, 12),
        home_files_added: homeAdded.length,
        home_files_added_sample: homeAdded.slice(0, 8),
      },
    };

    // steady state: one external write, view follows
    const evBase = await page.locator(cand.ui.evidence).count();
    const tW = Date.now();
    writeClaimsFromChild(daemon, E2E_ROOM, ['An external claim written by another process'], 'one');
    const nSteady = await waitCount(page, cand.ui.evidence, evBase + 1, 15000);
    const steadyMs = nSteady >= evBase + 1 ? Date.now() - tW : null;

    // CSP (contract verbatim, then the style-only isolation variant)
    out.csp_style_src_self = await runCsp(cand, shell, browser, base);

    // reconnect after a dropped connection
    out.reconnect = await runReconnect({ cand, page, daemon, restartDaemon, shell, steadyMs, evBase: await page.locator(cand.ui.evidence).count() });

    out.egress = { hosts: cap.hosts() };
    out._shell_out_tail = shell.out.slice(-300);
    await context.close();
    // a daemon handle may have been replaced by restart
    if (out.reconnect && out.reconnect._daemon) {
      daemon = out.reconnect._daemon;
      delete out.reconnect._daemon;
    }
  } catch (e) {
    out._error = String(e && e.stack ? e.stack : e).slice(0, 600);
  } finally {
    try { if (browser) await browser.close(); } catch (_e) { /* best effort */ }
    if (sse) sse.close();
    if (client) { try { await client.close(); } catch (_e) { /* best effort */ } }
    if (shell) await shell.stop();
    if (daemon) await stopDaemon(daemon);
  }
  return out;
}

async function runCsp(cand, shell, browser, base) {
  const results = {};
  for (const [name, policy] of [['contract', CSP_CONTRACT], ['style_only_isolation', CSP_STYLE_ONLY]]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errs = attachErrorCapture(page);
    try {
      await context.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__csp.push({ d: e.effectiveDirective, b: String(e.blockedURI).slice(0, 80) });
        });
      });
      await page.goto(base + cand.ui.url(E2E_ROOM), { waitUntil: 'load' }); // sets the session cookie, no header injected yet
      await context.route('**/*', async (route) => {
        if (route.request().resourceType() === 'document') {
          const resp = await route.fetch();
          const headers = Object.assign({}, resp.headers(), { 'content-security-policy': policy });
          await route.fulfill({ response: resp, headers });
        } else {
          await route.continue();
        }
      });
      await page.goto(base + cand.ui.url(E2E_ROOM), { waitUntil: 'load' });
      const doc = await documentRendered(page, 10000);
      const ev = await waitCount(page, cand.ui.evidence, 1, 6000);
      const violations = await page.evaluate(() => window.__csp || []).catch(() => []);
      const byDirective = {};
      for (const v of violations) byDirective[v.d] = (byDirective[v.d] || 0) + 1;
      results[name] = {
        policy,
        document_rendered: doc.rendered,
        evidence_items_rendered: ev,
        violations: violations.length,
        violations_by_directive: byDirective,
        style_src_violations: Object.keys(byDirective).filter((k) => /^style-src/.test(k)).reduce((n, k) => n + byDirective[k], 0),
        console_csp_messages: errs.console.filter((m) => /Content Security Policy|CSP/i.test(m)).length,
      };
    } catch (e) {
      results[name] = { error: String(e && e.message ? e.message : e).slice(0, 160) };
    } finally {
      await context.close();
    }
  }
  const c = results.contract || {};
  const s = results.style_only_isolation || {};
  return {
    value: c.document_rendered === true,
    unit: 'document rendered under the contract CSP verbatim',
    method:
      'the shell page is loaded in a fresh browser context; the document response is given the UI-SPEC contract Content-Security-Policy header by Playwright request interception (documents only, so the server and its cookie guard are untouched); violations counted from securitypolicyviolation events. Because default-src self also blocks a framework inline hydration payload, a second run adds script-src self unsafe-inline for the measurement only (never a shipped policy) to isolate what style-src self itself blocks',
    details: results,
    reading:
      s.document_rendered === true
        ? 'with scripts allowed to run, the document renders under style-src self with ' + s.style_src_violations + ' style-src violations'
        : 'the document did not render even with scripts allowed; see details',
    contract_style_src_violations: c.style_src_violations,
    isolation_style_src_violations: s.style_src_violations,
  };
}

async function runReconnect(o) {
  const { cand, page, daemon, restartDaemon } = o;
  try {
    const oldPort = daemon.port;
    const restarted = await restartDaemon(daemon);
    if (restarted.port !== oldPort) {
      return Object.assign(notMeasured('the restarted daemon came up on port ' + restarted.port + ' (was ' + oldPort + '); the shell server holds a fixed MOS_DAEMON_URL, so a reconnect cannot be exercised'), { _daemon: restarted });
    }
    const base = await page.locator(cand.ui.evidence).count();
    const texts = [];
    for (let i = 1; i <= 6; i += 1) texts.push('Reconnect claim number ' + i + ' written after the daemon restart');
    writeClaimsFromChild(restarted, E2E_ROOM, texts, 'rc');
    const t0 = Date.now();
    const samples = [];
    while (Date.now() - t0 < 30000) {
      const n = await page.locator(cand.ui.evidence).count().catch(() => 0);
      samples.push({ ms: Date.now() - t0, seen: Math.max(0, n - base) });
      if (n - base >= 6) break;
      await sleep(100);
    }
    const conv = convergence(samples, 6);
    let diagnostics;
    if (!conv.converged) {
      diagnostics = {};
      try {
        diagnostics.feed_probe = await page.evaluate(async (id) => {
          const r = id === 'workroom'
            ? await fetch('/api/feed/changes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collection: 'nodes', after: 0, limit: 3 }) })
            : await fetch('/mos/feed/changes?collection=nodes&after=0&limit=3');
          const t = await r.text();
          return { status: r.status, body: t.slice(0, 200) };
        }, cand.id);
      } catch (e) { diagnostics.feed_probe = { error: String(e).slice(0, 120) }; }
      diagnostics.server_log_tail = (o.shell.out || '').slice(-500);
      try {
        await page.reload({ waitUntil: 'load' });
        await sleep(5000);
        const n = await page.locator(cand.ui.evidence).count().catch(() => 0);
        diagnostics.after_page_reload_new_items_seen = Math.max(0, n - base);
      } catch (e) { diagnostics.after_page_reload_new_items_seen = 'reload failed: ' + String(e).slice(0, 80); }
    }
    return {
      value: conv.missing,
      unit: 'claims (of 6 written after a daemon restart) still missing from the evidence view after 30 s without a page reload; converged_ms is in details',
      converged_ms: conv.ms,
      method:
        'daemon SIGKILLed and respawned on the same port, rooms home and room.db (restartDaemon); 6 claims written from a child process through the room write door; the evidence view polled every 100 ms (page element count) for up to 30 s (spike 006 P5 method)',
      details: {
        converged: conv.converged,
        converged_ms: conv.ms,
        missing_after_30s: conv.missing,
        steady_state_one_write_to_view_ms: o.steadyMs,
        daemon_port_unchanged: true,
        samples: conv.samples,
        diagnostics,
      },
      _daemon: restarted,
    };
  } catch (e) {
    return notMeasured('reconnect run failed: ' + String(e && e.message ? e.message : e).slice(0, 200));
  }
}

// Run 3: the shipped form. Copy the output to a temp dir, start it with plain
// node and no build step, serve the slice, take first paint.
async function runPackagedCopy(cand, ctx, outDir) {
  const { startDaemon, stopDaemon } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-daemon-369.cjs'));
  const copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-18-copy-'));
  let daemon = null;
  let shell = null;
  let browser = null;
  try {
    cp.execFileSync('cp', ['-a', outDir + '/.', copyDir]);
    daemon = await startDaemon({ rooms: [e2eRoomSpec()] });
    shell = await new Shell(cand, { daemonPort: daemon.port, home: ctx.home, mode: 'fixed', copyDir, probePath: '/slice/' + E2E_ROOM }).start();
    const b = await launchBrowser();
    browser = b.browser;
    const base = 'http://127.0.0.1:' + shell.port;
    const fcps = [];
    let served = false;
    for (let i = 0; i < 3; i += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(base + cand.ui.url(E2E_ROOM), { waitUntil: 'load' });
      let paint = null;
      for (let t = 0; t < 50 && paint === null; t += 1) {
        paint = await page.evaluate(() => {
          const e = performance.getEntriesByName('first-contentful-paint')[0];
          return e ? Math.round(e.startTime) : null;
        });
        if (paint === null) await sleep(100);
      }
      if (paint !== null) fcps.push(paint);
      if (i === 0) {
        const n = await waitCount(page, cand.ui.evidence, 1, 15000);
        served = n >= 1;
      }
      await context.close();
    }
    return { served_from_copy: served, fcp_ms_runs: fcps, fcp_ms_median: median(fcps), start_to_ready_ms: shell.readyMs };
  } catch (e) {
    return { served_from_copy: false, error: String(e && e.message ? e.message : e).slice(0, 240), server_tail: shell ? shell.out.slice(-240) : '' };
  } finally {
    try { if (browser) await browser.close(); } catch (_e) { /* best effort */ }
    if (shell) await shell.stop();
    if (daemon) await stopDaemon(daemon);
    try { fs.rmSync(copyDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

function projectedPayload(outputSummary) {
  try {
    const { measurePayload, MAX_ENTRIES, MAX_UNPACKED } = require(path.join(REPO_ROOT, 'scripts', 'check-release-payload-ceiling.cjs'));
    const m = measurePayload(REPO_ROOT);
    if (!m.ok) return { measured: false, reason: m.reason };
    const entries = m.payload.files.length;
    const bytes = m.payload.unpackedSize;
    return {
      measured: true,
      today_entries: entries,
      today_unpacked_bytes: bytes,
      ceiling_entries: MAX_ENTRIES,
      ceiling_bytes: MAX_UNPACKED,
      projected_entries: entries + outputSummary.files,
      projected_bytes: bytes + outputSummary.bytes,
      within_entry_ceiling: entries + outputSummary.files <= MAX_ENTRIES,
      within_byte_ceiling: bytes + outputSummary.bytes <= MAX_UNPACKED,
    };
  } catch (e) {
    return { measured: false, reason: String(e && e.message ? e.message : e).slice(0, 160) };
  }
}

function runShell(cmd, args, cwd, env) {
  const t0 = Date.now();
  const r = cp.spawnSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 });
  return { ok: r.status === 0, status: r.status, seconds: Number(((Date.now() - t0) / 1000).toFixed(1)), tail: ((r.stdout || '') + (r.stderr || '')).slice(-400) };
}

// ------------------------------------------------------------------------ main

function checkParity() {
  const maps = {};
  for (const id of Object.keys(CANDIDATES)) {
    const f = path.join(CANDIDATES[id].dir, CANDIDATES[id].sliceActionsFile);
    maps[id] = parseSliceActions(fs.readFileSync(f, 'utf8'));
  }
  const want = JSON.stringify(EXPECTED_ACTIONS);
  const sortObj = (o) => JSON.stringify(Object.keys(o).sort().reduce((a, k) => ((a[k] = o[k]), a), {}));
  const norm = sortObj(EXPECTED_ACTIONS);
  for (const id of Object.keys(maps)) {
    if (sortObj(maps[id]) !== norm) {
      throw new Error('slice parity mismatch in ' + id + ': ' + JSON.stringify(maps[id]) + ' vs ' + want);
    }
  }
  return { ok: true, actions: EXPECTED_ACTIONS, checked: Object.keys(maps) };
}

function rxdbInfoScan(candidateIds) {
  const out = {};
  for (const id of candidateIds) {
    const c = CANDIDATES[id];
    const outDir = path.join(c.dir, 'app', c.outputRel);
    if (!fs.existsSync(outDir)) {
      out[id] = { scanned: false };
      continue;
    }
    let files = 0;
    let neutralised = 0;
    for (const f of walkFiles(outDir, new Set(['node_modules']))) {
      if (!/\.(js|mjs|cjs|css|html|json|map)$/.test(f)) continue;
      let src;
      try { src = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
      if (src.includes('rxdb.info')) files += 1;
      if (src.includes('rxdb.invalid')) neutralised += 1;
    }
    out[id] = { scanned: true, files_with_rxdb_info: files, files_with_neutralised_rxdb_invalid: neutralised };
  }
  return out;
}

async function measureCandidate(cand, opts, shared) {
  const result = {};
  const appDir = path.join(cand.dir, 'app');
  const buildEnv = Object.assign({}, process.env, { PATH: NODE_BIN_DIR + ':' + (process.env.PATH || ''), DO_NOT_TRACK: '1', NEXT_TELEMETRY_DISABLED: '1', HOME: REAL_HOME });
  let setup = null;
  let build = null;
  if (!opts.skipBuild) {
    // Fresh: the generated app/ is git-ignored and rebuilt from nothing.
    fs.rmSync(appDir, { recursive: true, force: true });
    setup = runShell('bash', [path.join(cand.dir, 'setup.sh')], cand.dir, buildEnv);
    if (!setup.ok) throw new Error(cand.id + ' setup.sh failed: ' + setup.tail);
    build = runShell('bash', [path.join(cand.dir, 'build.sh')], cand.dir, buildEnv);
    if (!build.ok) throw new Error(cand.id + ' build.sh failed: ' + build.tail);
  }
  const outDir = path.join(appDir, cand.outputRel);
  if (!fs.existsSync(outDir)) throw new Error(cand.id + ': no build output at ' + outDir + ' (run without --skip-build)');

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-18-home-'));
  fs.mkdirSync(path.join(home, 'MindrianRooms'), { recursive: true });
  const ctx = { home };
  try {
    result.architecture_distorted = measureArchitecture(cand);
    result.workroom_code_surviving = measureSurviving(cand);
    result.selected_state_reaches_claude = await runSelectedState(cand, ctx);
    const full = await runFullSlice(cand, ctx);
    result.persistent_state = full.persistent_state || notMeasured('full-slice run failed: ' + (full._error || 'no result'));
    result.reconnect = full.reconnect || notMeasured('full-slice run failed before the reconnect step: ' + (full._error || ''));
    if (result.reconnect) delete result.reconnect._daemon;
    result.startup_errors = full.startup_errors || notMeasured('full-slice run failed: ' + (full._error || 'no result'));
    result.dependency_removal = measureDependencies(cand, build);
    result.direct_file_write_replacement = measureDirectFileIo(cand);

    const summary = packagingSummary(outDir);
    const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const rootDeps = new Set(Object.keys(rootPkg.dependencies || {}));
    const notInRoot = summary.node_modules_packages.filter((p) => !rootDeps.has(p));
    const copy = await runPackagedCopy(cand, ctx, outDir);
    const payload = projectedPayload(summary);
    result.packaging = {
      value: summary.files,
      unit: 'files in the build output (the release entry count)',
      method:
        'setup.sh and build.sh run from nothing by this harness (wall seconds); output directory walked (' + cand.outputRel + '): files, directories, apparent bytes, traced node_modules; packages under node_modules compared with the root manifest dependencies; the output copied to a temp dir and started with plain node and no build step, the slice loaded in Chromium, first-contentful-paint median of 3 fresh page loads; projected payload = scripts/check-release-payload-ceiling.cjs measurePayload on the working tree plus the output',
      details: {
        setup_seconds: setup ? setup.seconds : null,
        build_seconds: build ? build.seconds : null,
        output_dir: cand.outputRel,
        output_files: summary.files,
        output_dirs: summary.dirs,
        output_bytes: summary.bytes,
        traced_node_modules_files: summary.node_modules_files,
        rule_8_violation_traced_node_modules: summary.has_node_modules,
        runtime_packages_in_output: summary.node_modules_packages.length,
        runtime_packages_not_in_root_manifest: notInRoot.length,
        runtime_packages_not_in_root_manifest_sample: notInRoot.slice(0, 12),
        starts_from_temp_copy_with_plain_node: copy.served_from_copy === true,
        temp_copy: copy,
        time_to_first_paint_ms: copy.fcp_ms_median === undefined ? null : copy.fcp_ms_median,
        projected_release_payload: payload,
      },
    };
    result.gate_click_to_view_ms = full.gate_click_to_view_ms || notMeasured('full-slice run failed: ' + (full._error || 'no result'));
    result.csp_style_src_self = full.csp_style_src_self || notMeasured('full-slice run failed: ' + (full._error || 'no result'));
    result._run = { error: full._error || null, egress_hosts: (full.egress && full.egress.hosts) || [] };
  } finally {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  shared.rxdb = shared.rxdb || {};
  return result;
}

function usage() {
  return [
    'usage: node ui/bakeoff/measure.cjs --candidate workroom|agent-native|both [--out <file>] [--skip-build]',
    '  --candidate  which candidate to set up, build and measure',
    '  --out        results file (default ui/bakeoff/results.json)',
    '  --skip-build keep the existing app/ and build output (no setup, no build)',
  ].join('\n');
}

async function main(argv) {
  let candidate = null;
  let out = path.join(BAKEOFF, 'results.json');
  let skipBuild = false;
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--candidate':
        candidate = argv[i + 1];
        i += 1;
        break;
      case '--out':
        out = path.resolve(argv[i + 1]);
        i += 1;
        break;
      case '--skip-build':
        skipBuild = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        return 0;
      default:
        console.error('unknown argument: ' + argv[i]);
        console.error(usage());
        return 2;
    }
  }
  if (!['workroom', 'agent-native', 'both'].includes(candidate)) {
    console.error(usage());
    return 2;
  }
  // Playwright's browser cache lives under the real HOME; the measured
  // processes get a temp HOME.
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(REAL_HOME, '.cache', 'ms-playwright');
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  const parity = checkParity();
  const ids = candidate === 'both' ? ['workroom', 'agent-native'] : [candidate];
  const results = {
    meta: {
      generated_at: new Date().toISOString(),
      machine: { platform: process.platform, release: os.release(), cpus: os.cpus().length, node: process.version, mem_gb: Math.round(os.totalmem() / 1e9) },
      parity,
      proposal_source_note:
        'adapter (room-proposal, 369-ADAPTER-RULING.md) for the selected-state measure; fixed (the deterministic source in ui/shared) for the full-slice end to end, because candidate B overlay does not wire the shipped adapter (see the selected_state measure)',
      csp_contract: CSP_CONTRACT,
    },
  };
  const shared = {};
  for (const id of ids) {
    console.log('== measuring ' + id);
    results[id] = await measureCandidate(CANDIDATES[id], { skipBuild }, shared);
  }
  results.meta.shared_findings = {
    rxdb_info_literal: {
      note:
        'both candidates bundle RxDB through ui/shared; its error-message link strings contain the literal rxdb.info (inert text, never fetched). A property of ui/shared, not of either chassis: recorded once. Candidate B build.sh rewrites the literal after the build, candidate A does not.',
      scan: rxdbInfoScan(ids),
    },
  };
  // Framework log lines can carry a literal long dash; the house rule is hyphens only.
  const text = JSON.stringify(results, null, 2).split(String.fromCharCode(0x2014)).join('-').split(String.fromCharCode(0x2013)).join('-');
  fs.writeFileSync(out, text + '\n');
  console.log('wrote ' + path.relative(REPO_ROOT, out));
  return 0;
}

module.exports = {
  retainedLines,
  countForbiddenIo,
  diffStorage,
  convergence,
  packagingSummary,
  parseSliceActions,
  stripComments,
  EXPECTED_ACTIONS,
  CSP_CONTRACT,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error('FATAL:', err && err.stack ? err.stack : err);
      process.exit(1);
    }
  );
}
