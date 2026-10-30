'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-a2s (S-1): the OLD vs NEW parity gate for the intent-classifier hook
 * (scripts/intent-classifier, the UserPromptSubmit hook that runs on every user prompt).
 *
 * OLD is "git archive" of BASE_SHA (tests/helpers/oracle-381.cjs buildOldTree), plus the
 * plugin-runtime paths of EXTRA_TREE_PATHS from the same sha (the regen reads commands/). NEW is
 * this tree. Each side runs through the bash wrapper, as hooks/run-hook.cmd does:
 *   bash <tree>/scripts/intent-classifier   (stdin = the payload, cwd = the case cwd)
 *
 * Same-path rule: each case is built once at a fixed path RUN (spawn-kit makeFixture({ at })),
 * then copied to TEMPLATE. Before each side, RUN is removed and restored with "cp -a TEMPLATE RUN",
 * so both sides see the same absolute paths. assertSafeTarget guards RUN, TEMPLATE and every
 * cwd. Nothing here reads or writes ~/MindrianRooms or ~/.mindrian.
 *
 * Channels compared per case (and per turn for C07):
 *   stdout   the stdout bytes
 *   exit     the exit code
 *   stderr   the stderr bytes
 *   manifest every path under RUN that was created, deleted or changed against TEMPLATE, with
 *            the file type (for *.db, *.db-wal, *.db-shm and *.db-journal only created/deleted)
 *   file     a sha256 of every regular file and symlink target under RUN (the db family is
 *            left out; its presence is in manifest)
 *   db       for every *.db file: table names and SELECT COUNT(*) per table, read from a COPY
 *            of the db family after the digest (a readOnly open of a WAL db creates -shm and
 *            -wal next to it, so the open never touches RUN)
 *   net      the net-guard log api list with the pids removed (Canon Part 8)
 *
 * Side-effect files the kit and the classifier write under RUN (listed for the reader; the
 * manifest shows them per case with -v):
 *   - rooms/<room>/.mindrian/decision-traces/<sid>.json (decision traces)
 *   - rooms/<room>/.mindrian/decision-traces/<sid>.binding-gate-offered.json and
 *     <sid>.zero-score-gate-offered.json (binding-gate offered markers)
 *   - the nav block hash sidecar (navBlockHashPath in scripts/intent-classifier.cjs)
 *   - rooms/.rooms/sessions/<sid>.json (the session binding store)
 *   - card-fire-reached.json (the card-fire side channel, CARD_FIRE_SIDECHANNEL_PATH)
 *   - memory_event rows in rooms/<room>/.mindrian/room.db (db channel)
 *   - rooms/<room>/.mindrian/pending-tier1-regen.json, minto-queue.json and the MINTO regen
 *     outputs of the detached tier-0 regens (C12)
 *   - tmp/.mindrian-legacy-warned (scripts/resolve-room Strategy 2, when the cwd holds rooms/)
 *
 * Normalisation (applied to stdout, stderr, file content and file names). N-0 is given by the
 * plan; N-1 to N-5 were each added for a byte that differed in a --determinism run (NEW vs NEW):
 *   N-0 TREE      the OLD tree dir, the prove-fail mutant dir and REPO are replaced with <TREE>
 *   N-1 TS        ISO 8601 timestamps to <TS>: decision traces ("ts", "at"), the session owner
 *                 file, the regen BRIEF.md ("generated_at", "modified")
 *   N-2 EPOCH     13-digit epoch ms within one day of the run to <EPOCH>: the card-fire side
 *                 channel ("ts")
 *   N-3 PID       "(node:<pid>)" to "(node:<PID>)": stderr (the node:sqlite ExperimentalWarning
 *                 and the circular-dependency warning that the hook prints today)
 *   N-4 DURATION  the value of a JSON key that ends in "_ms" to <MS>: decision traces
 *                 ("elapsed_ms", "decide_total_ms", "dispatchSensors_ms")
 *   N-5 OWNER PID the value of a JSON key "pid" to <PID>: the session owner file
 *                 rooms/<room>/.mindrian/sessions/<sid>.json
 *   No UUID rule was needed.
 *
 * C12 fixture note: the detached regen races the classifier in OLD and NEW alike. A regen that
 * reads room.db while the classifier holds it renders "room_db_unreadable", and the classifier
 * nav block reads whether MINTO.md exists. So C12 has no room.db, and its section MINTO.md is
 * generated into TEMPLATE once, one frozen day earlier. The race then leaves no trace in any
 * channel, and the positive control still proves that the hook's regen ran on each side
 * (MINTO.md carries the hook-run frozen timestamp).
 *
 * Retry rule (the hook has 200 ms budgets): when a case pair differs, the pair runs up to 2
 * more times. A DIFF is reported only when all 3 attempts differ; "retried=<k>" is printed.
 *
 * Modes:
 *   (default)       OLD vs NEW, every case, exit 0 only on 0 diffs
 *   --determinism   NEW vs NEW, every case
 *   --prove-fail    4 mutation arms on a temp copy of NEW (M-stdout, M-stderr, M-exit, M-file);
 *                   each must report a DIFF on its own channel
 *   --node-starts   C12 only, with a "node" shim first in PATH; prints node-starts OLD=<n> NEW=<m>
 *   --case a,b      only these cases
 *   --keep          keep the temp dirs and print them
 *   -v              print each case manifest
 *
 * Plain node, built-ins plus the repo test helpers. Hyphens only.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const oracle = require(path.join(REPO, 'tests', 'helpers', 'oracle-381.cjs'));
const kit = require(path.join(REPO, 'tests', 'fixtures', 'ups-harness-360', 'spawn-kit.cjs'));
const builders = require(path.join(REPO, 'tests', 'fixtures', 'room-381', 'build-fixture.cjs'));
const { assertSafeTarget } = builders;

const BASE_SHA = '05655557542ae068fb2f2368400d1899ff637d61';
const NET_GUARD = path.join(REPO, 'tests', 'helpers', 'net-guard-381.cjs');
const GOLDEN_DB = path.join(REPO, 'tests', 'fixtures', 'graph-export-golden-room', '.mindrian', 'room.db');
const CASE_IDS = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16'];
const FROZEN_DATE = '2026-01-15';
const FROZEN_TS = '2026-01-15T12:00:00.000Z';
// C12 pre-generation runs one day earlier, so the hook's regen (FROZEN_TS) always rewrites MINTO.md.
const PREGEN_DATE = '2026-01-14';
const PREGEN_TS = '2026-01-14T12:00:00.000Z';
const DB_FAMILY = /\.db(-wal|-shm|-journal)?$/;
// Normalisation rules beyond N-0 TREE, added only for bytes that differ in a --determinism run.
const NORM_RULES = [
  // N-1 TS: decision traces ("ts", "at").
  (s) => s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, '<TS>'),
  // N-2 EPOCH: the card-fire side channel ("ts").
  (s, now) => s.replace(/(^|[^0-9])(\d{13})(?![0-9])/g, (m, pre, d) => (Math.abs(Number(d) - now) < 86400000 ? pre + '<EPOCH>' : m)),
  // N-3 PID: stderr "(node:<pid>)" warning prefix.
  (s) => s.replace(/\(node:\d+\)/g, '(node:<PID>)'),
  // N-4 DURATION: decision traces ("elapsed_ms", "decide_total_ms", "dispatchSensors_ms").
  (s) => s.replace(/("[A-Za-z0-9_]*_ms"\s*:\s*)\d+/g, '$1<MS>'),
  // N-5 OWNER PID: the session owner file rooms/<room>/.mindrian/sessions/<sid>.json ("pid").
  (s) => s.replace(/("pid"\s*:\s*)\d+/g, '$1<PID>'),
];

// ---------------------------------------------------------------------------
// prompts (literals)
// ---------------------------------------------------------------------------
const PLAIN_BAKERY = 'let us plan the oven baking schedule for the sourdough croissant line next week';
const PLAIN_COPPER = 'can you summarise where we are and what we should look at next';
const METHODOLOGY = 'Run the Minto Pyramid and then Six Thinking Hats on the sourdough schedule assumption';
const COPPER_RICH = kit.CASES.fingerprint_bodies.copper_ledger_rich;
const UNICODE_PROMPT = 'Hebrew שלום עולם, emoji 🍞, combining é accent,\r\n'
  + 'CRLF line above\nLF line here\tand a tab\r\nend of the oven schedule note';
const WORDS = ['oven', 'schedule', 'sourdough', 'croissant', 'bakery', 'flour', 'proof', 'batch', 'morning', 'shift',
  'review', 'plan', 'assumption', 'customer', 'order', 'delivery', 'week', 'line', 'test', 'note'];

function longPrompt(n) {
  const parts = [];
  let len = 0;
  let i = 0;
  while (len < n) {
    const w = WORDS[i % WORDS.length];
    parts.push(w);
    len += w.length + 1;
    i += 1;
  }
  return parts.join(' ').slice(0, n);
}

// ---------------------------------------------------------------------------
// case building
// ---------------------------------------------------------------------------
function fixtureEnv(fx) {
  return {
    HOME: fx.home,
    MINDRIAN_HOME: fx.mh,
    CARD_FIRE_SIDECHANNEL_PATH: fx.sidechannel,
    MINDRIAN_ROOMS_HOME: fx.rooms,
    MINDRIAN_ROOMS_ROOT: fx.rooms,
    TMPDIR: fx.tmp,
  };
}

// The env of one side. ctx: { netLog, xdg, pathPrefix }.
function sideEnv(kase, ctx) {
  const env = Object.assign({}, kase.env, {
    PATH: (ctx.pathPrefix ? ctx.pathPrefix + ':' : '') + path.dirname(process.execPath) + ':/usr/bin:/bin',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    TZ: 'UTC',
    NODE_OPTIONS: '--require ' + NET_GUARD + (ctx.extraNodeOptions ? ' ' + ctx.extraNodeOptions : ''),
    NET_GUARD_381_LOG: ctx.netLog,
    MINTO_FROZEN_DATE: FROZEN_DATE,
    MINTO_FROZEN_TIMESTAMP: FROZEN_TS,
    XDG_CACHE_HOME: ctx.xdg,
  });
  Object.keys(ctx.extraEnv || {}).forEach((k) => { env[k] = ctx.extraEnv[k]; });
  return env;
}

function payload(prompt, sid, cwd) {
  return JSON.stringify({ prompt, session_id: sid, hook_event_name: 'UserPromptSubmit', cwd });
}

function copyGoldenDb(roomDir) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.copyFileSync(GOLDEN_DB, path.join(roomDir, '.mindrian', 'room.db'));
}

function bindPrimary(fx, sid, slug) {
  kit.writeBinding(fx, sid, { bound: [slug], primary: slug });
}

function addBreakthrough(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
  try {
    const t = Date.UTC(2026, 0, 15, 12, 0, 0);
    const cols = db.prepare('PRAGMA table_info(nodes)').all().map((r) => r.name);
    const ins = (id, type, status) => {
      if (cols.indexOf('review_status') >= 0) {
        db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) VALUES (?, ?, '{}', 'test:fixture', 'system', ?, ?, ?)")
          .run(id, type, status, t, t);
      } else {
        db.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, ?, '{}')").run(id, type);
      }
    };
    ins('a2s-artifact-1', 'artifact', 'confirmed');
    ins('a2s-artifact-2', 'artifact', 'confirmed');
    ins('a2s-breakthrough-1', 'breakthrough', 'proposed');
    ['a2s-artifact-1', 'a2s-artifact-2'].forEach((aid) => {
      db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DERIVED_FROM', '{}')").run('a2s-breakthrough-1', aid);
    });
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally {
    db.close();
  }
  ['-wal', '-shm'].forEach((s) => { try { fs.rmSync(path.join(roomDir, '.mindrian', 'room.db' + s), { force: true }); } catch (_e) { /* none */ } });
}

function debouncerSchemaVersion() {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'minto-debouncer.cjs'), 'utf8');
  const m = /const SCHEMA_VERSION = (\d+);/.exec(src);
  return m ? Number(m[1]) : 1;
}

function resolveDrainRoom(fx, cwd, env) {
  const r = spawnSync('bash', [path.join(REPO, 'scripts', 'resolve-room')], {
    cwd,
    env: Object.assign({}, env, { PATH: path.dirname(process.execPath) + ':/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }),
    encoding: 'utf8',
  });
  const out = String(r.stdout || '').trim();
  if (r.status !== 0 || !out) throw new Error('resolve-room found no room for C12 (status ' + r.status + ')');
  return assertSafeTarget(out);
}

function seedMintoQueue(roomDir, corrupt) {
  const sec = path.join(roomDir, 'problem-definition');
  if (!fs.existsSync(sec)) {
    fs.mkdirSync(sec, { recursive: true });
    fs.writeFileSync(path.join(sec, 'oven-note.md'), '# Oven note\n\nThe morning batch proofs for ten hours.\n');
  }
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const qp = path.join(roomDir, '.mindrian', 'minto-queue.json');
  if (corrupt) {
    fs.writeFileSync(qp, 'not json {');
    return;
  }
  const entries = [
    { section: 'problem-definition', enqueued_at: '2026-01-15T12:00:00.000Z', reason: 'parity-old-1', attempts: 0 },
    { section: 'problem-definition', enqueued_at: '2026-01-15T12:00:00.000Z', reason: 'parity-old-2', attempts: 0 },
    { section: 'problem-definition', enqueued_at: '2099-01-01T00:00:00.000Z', reason: 'parity-future', attempts: 0 },
  ];
  fs.writeFileSync(qp, JSON.stringify({ version: debouncerSchemaVersion(), entries }, null, 2));
}

function pregenerate(roomDir, env) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'vault-section-minto-generator.cjs'), '--write', roomDir, '--section', 'problem-definition'], {
    env: Object.assign({}, env, {
      PATH: path.dirname(process.execPath) + ':/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC',
      NODE_OPTIONS: '--require ' + NET_GUARD, MINTO_FROZEN_DATE: PREGEN_DATE, MINTO_FROZEN_TIMESTAMP: PREGEN_TS,
    }),
    encoding: 'utf8', timeout: 60000,
  });
  if (r.status !== 0 || !fs.existsSync(path.join(roomDir, 'problem-definition', 'MINTO.md'))) {
    throw new Error('C12 pre-generation failed (status ' + r.status + ')');
  }
}

function readLatestGateLabel(fx, sid) {
  let names = [];
  try {
    names = fs.readdirSync(fx.rooms, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '.rooms').map((e) => e.name).sort();
  } catch (_e) { names = []; }
  for (const n of names) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(fx.rooms, n, '.mindrian', 'decision-traces', sid + '.json'), 'utf8'));
      const traces = Array.isArray(parsed.traces) ? parsed.traces : [];
      for (let i = traces.length - 1; i >= 0; i -= 1) {
        const e = traces[i];
        if (!e || typeof e !== 'object') continue;
        if (e.kind === 'binding_gate_consumed') break;
        if (e.binding_gate_payload && Array.isArray(e.binding_gate_payload.options)) {
          const label = e.binding_gate_payload.options.find((l) => l !== 'dev repo / no room');
          if (typeof label === 'string' && label) return label;
        }
      }
    } catch (_e) { /* next room */ }
  }
  return null;
}

// buildCase(id, { at }) builds the case fixture at the fixed path `at` and returns the case
// descriptor: { id, fx, cwd, env, turns: [{ input(fx) }], control(fx), mustFire }.
function buildCase(id, opts) {
  const at = assertSafeTarget(opts.at);
  const fx = kit.makeFixture({ at });
  const rooms = fx.rooms;
  const sid = 'sample-session-a2s-' + id.toLowerCase();
  const kase = { id, fx, cwd: path.join(rooms, 'copper-ledger'), env: fixtureEnv(fx), turns: [], control: null, mustFire: false };
  const one = (prompt, s) => { kase.turns = [{ input: () => payload(prompt, s || sid, kase.cwd) }]; };
  const bakery = () => {
    kase.cwd = path.join(rooms, 'quantum-bakery');
    bindPrimary(fx, sid, 'quantum-bakery');
    copyGoldenDb(kase.cwd);
  };
  switch (id) {
    case 'C01': one(PLAIN_COPPER); break;
    case 'C02': bakery(); one(PLAIN_BAKERY); break;
    case 'C03': bakery(); one(METHODOLOGY); break;
    case 'C04': kase.turns = [{ input: () => JSON.stringify({ prompt: '' }) }]; break;
    case 'C05': kase.turns = [{ input: () => '' }]; break;
    case 'C06':
      kase.cwd = path.join(rooms, 'quantum-bakery');
      bindPrimary(fx, sid, 'quantum-bakery');
      one(COPPER_RICH);
      kase.mustFire = true;
      break;
    case 'C07': {
      const seq = kit.CASES.sequences.find((s) => s.id === 'r2-pending-answer');
      const label = (f) => readLatestGateLabel(f, sid) || 'copper-ledger';
      kase.turns = seq.turns.map((t) => ({
        input: (f) => payload(t.prompt.replace('{{LABEL}}', () => label(f)), sid, kase.cwd),
      }));
      break;
    }
    case 'C08': bakery(); addBreakthrough(kase.cwd); one(PLAIN_BAKERY); break;
    case 'C09': one(longPrompt(50000)); break;
    case 'C10': one(UNICODE_PROMPT); break;
    case 'C11': {
      const e = kit.CASES.entries.find((x) => x.id === 'harness-task-notification');
      kase.turns = [{ input: () => JSON.stringify(Object.assign({}, e.stdin, { cwd: kase.cwd })) }];
      break;
    }
    case 'C12':
    case 'C13': {
      // No room.db here, and the section MINTO is generated once into TEMPLATE: the detached regen
      // races the classifier in OLD and NEW alike (a regen that runs while the classifier holds
      // room.db renders "room_db_unreadable"; the classifier's nav block reads MINTO.md presence).
      // With both inputs fixed, the race leaves no trace in any channel, and the regen still
      // shows in the manifest (BRIEF.md "generated_at" is real time, so it always changes).
      kase.cwd = path.join(rooms, 'quantum-bakery');
      bindPrimary(fx, sid, 'quantum-bakery');
      fs.mkdirSync(path.join(kase.cwd, '.mindrian'), { recursive: true });
      const drainRoom = resolveDrainRoom(fx, kase.cwd, kase.env);
      if (!drainRoom.startsWith(at + path.sep)) throw new Error('C12 drain room is outside RUN');
      seedMintoQueue(drainRoom, id === 'C13');
      if (id === 'C12') pregenerate(drainRoom, kase.env);
      one(PLAIN_BAKERY);
      if (id === 'C12') {
        kase.control = () => {
          const pend = path.join(drainRoom, '.mindrian', 'pending-tier1-regen.json');
          let p;
          try { p = JSON.parse(fs.readFileSync(pend, 'utf8')); } catch (_e) { return 'pending-tier1-regen.json missing or not JSON'; }
          if (!p || !Array.isArray(p.pending) || p.pending.length !== 2) return 'pending-tier1-regen.json does not hold 2 entries';
          let q;
          try { q = JSON.parse(fs.readFileSync(path.join(drainRoom, '.mindrian', 'minto-queue.json'), 'utf8')); } catch (_e) { return 'minto-queue.json missing or not JSON'; }
          if (!q || !Array.isArray(q.entries) || q.entries.length !== 1 || q.entries[0].enqueued_at !== '2099-01-01T00:00:00.000Z') {
            return 'minto-queue.json does not keep only the 2099 entry';
          }
          let minto = '';
          try { minto = fs.readFileSync(path.join(drainRoom, 'problem-definition', 'MINTO.md'), 'utf8'); } catch (_e) { /* checked below */ }
          if (minto.indexOf('last_generated_at: "' + FROZEN_TS + '"') < 0) return 'the detached regen did not rewrite problem-definition/MINTO.md';
          return null;
        };
      }
      break;
    }
    case 'C14': {
      const missing = path.join(at, 'no-such-rooms-home');
      kase.env.MINDRIAN_ROOMS_HOME = missing;
      kase.env.MINDRIAN_ROOMS_ROOT = missing;
      kase.cwd = fx.devRepo;
      one(PLAIN_COPPER);
      break;
    }
    case 'C15': {
      builders.buildEdgeRoom(rooms, { today: new Date(Date.UTC(2026, 0, 15)) });
      const regPath = path.join(rooms, '.rooms', 'registry.json');
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      reg.rooms['edge-room'] = { slug: 'edge-room' };
      fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
      kase.cwd = path.join(rooms, 'edge-room');
      one(PLAIN_COPPER);
      break;
    }
    case 'C16': bakery(); one(PLAIN_BAKERY); break;
    default: throw new Error('unknown case ' + id);
  }
  assertSafeTarget(kase.cwd);
  if (!fs.existsSync(kase.cwd)) fs.mkdirSync(kase.cwd, { recursive: true });
  return kase;
}

// ---------------------------------------------------------------------------
// normalisation
// ---------------------------------------------------------------------------
function makeNorm(treeRoots) {
  const roots = treeRoots.filter(Boolean).slice().sort((a, b) => b.length - a.length);
  const now = Date.now();
  return function norm(input) {
    let s = Buffer.isBuffer(input) ? input.toString('latin1') : String(input);
    roots.forEach((r) => { s = s.split(r).join('<TREE>'); });
    NORM_RULES.forEach((rule) => { s = rule(s, now); });
    return s;
  };
}

// ---------------------------------------------------------------------------
// snapshot of RUN
// ---------------------------------------------------------------------------
function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function scanTree(root) {
  const m = new Map();
  oracle.listEntries(root).forEach((rel) => {
    const p = path.join(root, rel);
    let st;
    try { st = fs.lstatSync(p); } catch (_e) { return; }
    if (st.isSymbolicLink()) {
      let t = '?';
      try { t = fs.readlinkSync(p); } catch (_e) { /* keep ? */ }
      m.set(rel, { type: 'L', raw: 'L:' + t, buf: Buffer.from(t) });
    } else if (st.isDirectory()) {
      m.set(rel, { type: 'D', raw: 'D' });
    } else {
      let buf = Buffer.alloc(0);
      try { buf = fs.readFileSync(p); } catch (_e) { /* unreadable counts as empty */ }
      m.set(rel, { type: 'F', raw: sha(buf), buf });
    }
  });
  return m;
}

function dbCounts(file, scratch) {
  const dir = fs.mkdtempSync(path.join(scratch, 'db-'));
  try {
    ['', '-wal'].forEach((s) => {
      if (fs.existsSync(file + s)) fs.copyFileSync(file + s, path.join(dir, 'copy.db' + s));
    });
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(dir, 'copy.db'), { readOnly: true });
    try {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
      return names.map((n) => n + '=' + db.prepare('SELECT COUNT(*) AS c FROM "' + n.replace(/"/g, '""') + '"').get().c).join(',');
    } finally {
      db.close();
    }
  } catch (e) {
    return 'ERR:' + (e && e.message ? e.message : String(e));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function snapshot(run, tmplScan, norm, scratch, netLog) {
  const cur = scanTree(run);
  const manifest = [];
  const files = new Map();
  const dbs = new Map();
  const keys = new Set([...tmplScan.keys(), ...cur.keys()]);
  Array.from(keys).sort().forEach((rel) => {
    const a = tmplScan.get(rel);
    const b = cur.get(rel);
    const nrel = norm(rel);
    const isDb = DB_FAMILY.test(rel);
    if (!a) manifest.push('created ' + b.type + ' ' + nrel);
    else if (!b) manifest.push('deleted ' + a.type + ' ' + nrel);
    else if (a.type !== b.type) manifest.push('retyped ' + a.type + '->' + b.type + ' ' + nrel);
    else if (!isDb && a.raw !== b.raw) manifest.push('changed ' + b.type + ' ' + nrel);
    if (b && (b.type === 'F' || b.type === 'L') && !isDb) files.set(nrel, sha(norm(b.buf)));
  });
  cur.forEach((v, rel) => {
    if (v.type === 'F' && /\.db$/.test(rel)) dbs.set(norm(rel), dbCounts(path.join(run, rel), scratch));
  });
  let net = '';
  try {
    net = fs.readFileSync(netLog, 'utf8').split('\n').filter(Boolean).map((l) => l.replace(/^\d+ /, '')).join('\n');
  } catch (_e) { /* no log = no network attempt */ }
  return { manifest, files, dbs, net };
}

// ---------------------------------------------------------------------------
// detached children: wait until no process argv names RUN
// ---------------------------------------------------------------------------
function procsNaming(run) {
  let pids;
  try { pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)); } catch (_e) { return []; }
  const out = [];
  pids.forEach((pid) => {
    if (Number(pid) === process.pid) return;
    try {
      const c = fs.readFileSync('/proc/' + pid + '/cmdline', 'latin1');
      if (c.indexOf(run) >= 0) out.push(pid);
    } catch (_e) { /* gone */ }
  });
  return out;
}

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));
function waitNoProcs(run, maxMs) {
  const end = Date.now() + maxMs;
  for (;;) {
    if (procsNaming(run).length === 0) return true;
    if (Date.now() > end) return false;
    Atomics.wait(SLEEP_CELL, 0, 0, 100);
  }
}

// ---------------------------------------------------------------------------
// run one side of one case
// ---------------------------------------------------------------------------
function restoreRun(run, template) {
  assertSafeTarget(run);
  assertSafeTarget(template);
  fs.rmSync(run, { recursive: true, force: true });
  const r = spawnSync('cp', ['-a', template, run], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('cp -a TEMPLATE RUN failed: ' + String(r.stderr || '').trim());
}

function runSide(tree, kase, ctx) {
  restoreRun(ctx.run, ctx.template);
  fs.rmSync(ctx.netLog, { force: true });
  const env = sideEnv(kase, ctx);
  const turns = [];
  for (const t of kase.turns) {
    const input = t.input(kase.fx);
    const r = spawnSync('bash', [path.join(tree, 'scripts', 'intent-classifier')], {
      input, cwd: kase.cwd, env, timeout: 30000, maxBuffer: 1 << 26,
    });
    const procsDone = waitNoProcs(ctx.run, 30000);
    const snap = snapshot(ctx.run, ctx.tmplScan, ctx.norm, ctx.scratch, ctx.netLog);
    turns.push({
      stdout: r.stdout || Buffer.alloc(0),
      stderr: r.stderr || Buffer.alloc(0),
      status: r.status === null ? 'signal:' + r.signal : r.status,
      procsDone,
      snap,
      control: kase.control ? kase.control() : null,
    });
  }
  return turns;
}

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------
function firstLineDiff(a, b) {
  const x = a.split('\n');
  const y = b.split('\n');
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
  const p = x[i] === undefined || y[i] === undefined ? 0 : (() => {
    let c = 0;
    while (c < x[i].length && c < y[i].length && x[i][c] === y[i][c]) c += 1;
    return c;
  })();
  const from = Math.max(0, p - 40);
  const cut = (s) => JSON.stringify(s === undefined ? '<none>' : s.slice(from, from + 120));
  return 'line ' + (i + 1) + ' offset ' + p + ' A=' + cut(x[i]) + ' B=' + cut(y[i]);
}

function mapDiff(a, b) {
  const keys = Array.from(new Set([...a.keys(), ...b.keys()])).sort();
  for (const k of keys) {
    if (a.get(k) !== b.get(k)) return JSON.stringify(k) + ' A=' + String(a.get(k)).slice(0, 80) + ' B=' + String(b.get(k)).slice(0, 80);
  }
  return null;
}

function compareTurns(A, B, norm) {
  const out = [];
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i += 1) {
    const a = A[i];
    const b = B[i];
    const tag = n > 1 ? ' turn' + (i + 1) : '';
    if (!a || !b) { out.push({ channel: 'turns', detail: 'turn count differs' }); break; }
    if (String(a.status) !== String(b.status)) out.push({ channel: 'exit' + tag, detail: 'A=' + a.status + ' B=' + b.status });
    const so = [norm(a.stdout), norm(b.stdout)];
    if (so[0] !== so[1]) out.push({ channel: 'stdout' + tag, detail: firstLineDiff(so[0], so[1]) });
    const se = [norm(a.stderr), norm(b.stderr)];
    if (se[0] !== se[1]) out.push({ channel: 'stderr' + tag, detail: firstLineDiff(se[0], se[1]) });
    const ma = a.snap.manifest.join('\n');
    const mb = b.snap.manifest.join('\n');
    if (ma !== mb) out.push({ channel: 'manifest' + tag, detail: firstLineDiff(ma, mb) });
    const fd = mapDiff(a.snap.files, b.snap.files);
    if (fd) out.push({ channel: 'file' + tag, detail: fd });
    const dd = mapDiff(a.snap.dbs, b.snap.dbs);
    if (dd) out.push({ channel: 'db' + tag, detail: dd });
    if (a.snap.net !== b.snap.net) out.push({ channel: 'net' + tag, detail: firstLineDiff(a.snap.net, b.snap.net) });
    [['A', a], ['B', b]].forEach((p) => {
      if (!p[1].procsDone) out.push({ channel: 'procs' + tag, detail: 'side ' + p[0] + ' left a process naming RUN after 30 s' });
      if (p[1].control) out.push({ channel: 'control' + tag, detail: 'side ' + p[0] + ': ' + p[1].control });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// one case: build, template, run both sides with the retry rule
// ---------------------------------------------------------------------------
function runCase(id, sides, g) {
  const base = oracle.mkTmp('a2s-' + id.toLowerCase());
  const run = path.join(base, 'run');
  const template = path.join(base, 'template');
  const scratch = path.join(base, 'scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const kase = buildCase(id, { at: run });
  const c = spawnSync('cp', ['-a', run, template], { encoding: 'utf8' });
  if (c.status !== 0) throw new Error('cp -a RUN TEMPLATE failed');
  const tmplScan = scanTree(template);
  const ctx = (side) => ({
    run, template, scratch, tmplScan, norm: g.norm, xdg: g.xdg,
    netLog: path.join(base, 'net-' + side.name + '.log'),
    pathPrefix: g.pathPrefix || null,
    extraEnv: g.extraEnv || null,
  });
  let diffs = [];
  let attempt = 0;
  let A;
  let B;
  for (; attempt < 3; attempt += 1) {
    A = runSide(sides[0].tree, kase, ctx(sides[0]));
    if (g.singleSide) { B = A; break; }
    B = runSide(sides[1].tree, kase, ctx(sides[1]));
    diffs = compareTurns(A, B, g.norm);
    if (kase.mustFire && A[0] && A[0].stdout.length === 0) diffs.push({ channel: 'control', detail: 'OLD stdout is empty; the case does not fire' });
    if (diffs.length === 0 || g.noRetry) break;
    if (g.verbose) diffs.forEach((d) => console.log('  attempt ' + (attempt + 1) + ' differs: ' + id + ' ' + d.channel + ' ' + d.detail));
  }
  if (g.verbose) {
    [['A', A], ['B', B]].forEach((p) => {
      p[1].forEach((t, i) => {
        console.log('  manifest ' + id + ' side ' + p[0] + ' turn ' + (i + 1) + ' (' + t.snap.manifest.length + ' entries)');
        t.snap.manifest.forEach((l) => console.log('    ' + l));
      });
    });
  }
  const retried = Math.min(attempt, 2);
  if (!g.keep) fs.rmSync(base, { recursive: true, force: true });
  else console.log('  kept ' + base);
  return { id, diffs, retried, A, B };
}

function report(res, label) {
  if (res.diffs.length === 0) {
    console.log('PASS ' + res.id + (res.retried ? ' retried=' + res.retried : ''));
    return 0;
  }
  res.diffs.forEach((d) => console.log('DIFF ' + res.id + ' ' + d.channel + ' ' + d.detail + ' retried=' + res.retried + (label ? ' (' + label + ')' : '')));
  return 1;
}

// ---------------------------------------------------------------------------
// prove-fail
// ---------------------------------------------------------------------------
// The plugin-runtime paths that the hook or its detached regen read beyond the oracle-381 set
// (lib/core/feyminto/capability.cjs lists PLUGIN_ROOT/commands for the BRIEF.md next move).
const EXTRA_TREE_PATHS = ['commands', 'skills', 'agents', 'pipelines', 'hooks', 'templates', 'teams', 'output-styles', 'bin', 'settings.json', '.mcp.json'];

// OLD tree = oracle.buildOldTree(sha) plus EXTRA_TREE_PATHS from the same sha (read-only git use).
function buildOldSide(sha) {
  const tree = oracle.buildOldTree(sha);
  const ls = spawnSync('git', ['ls-tree', '--name-only', sha], { cwd: REPO, encoding: 'utf8' });
  if (ls.status !== 0) throw new Error('git ls-tree ' + sha + ' failed');
  const have = new Set(String(ls.stdout).split('\n').filter(Boolean));
  const extra = EXTRA_TREE_PATHS.filter((p) => have.has(p));
  if (extra.length) {
    const tar = path.join(tree, 'extra.tar');
    const a = spawnSync('git', ['archive', '-o', tar, sha].concat(extra), { cwd: REPO, encoding: 'utf8' });
    if (a.status !== 0) throw new Error('git archive of the extra paths failed: ' + String(a.stderr || '').trim());
    const x = spawnSync('tar', ['-xf', tar, '-C', tree], { encoding: 'utf8' });
    if (x.status !== 0) throw new Error('tar extract of the extra paths failed');
    fs.rmSync(tar, { force: true });
  }
  return tree;
}

function buildMutantTree() {
  const dir = oracle.mkTmp('mutant');
  ['scripts', 'lib', 'data', 'references', 'package.json', '.claude-plugin'].concat(EXTRA_TREE_PATHS).forEach((p) => {
    if (!fs.existsSync(path.join(REPO, p))) return;
    const r = spawnSync('cp', ['-a', path.join(REPO, p), path.join(dir, p)], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('cp -a ' + p + ' failed: ' + String(r.stderr || '').trim());
  });
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return dir;
}

function insertAfterLine2(file, stmt) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.splice(2, 0, stmt);
  fs.writeFileSync(file, lines.join('\n'));
}

function countOf(hay, needle) {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i >= 0) { n += 1; i = hay.indexOf(needle, i + 1); }
  return n;
}

function pickStdoutLiteral(stdoutText, src) {
  const lines = stdoutText.split('\n').map((l) => l.trim()).filter((l) => l.length >= 12);
  for (const l of lines) {
    for (let len = 24; len >= 12; len -= 4) {
      for (let i = 0; i + len <= l.length; i += 1) {
        const s = l.slice(i, i + len);
        if (!/^[A-Za-z][A-Za-z ]+[A-Za-z]$/.test(s)) continue;
        if (countOf(src, s) === 1) return s;
      }
    }
  }
  return null;
}

function proveFail(oldTree, g) {
  const mut = buildMutantTree();
  g.norm = makeNorm([oldTree, REPO, mut]);
  const cls = path.join(mut, 'scripts', 'intent-classifier.cjs');
  const wrap = path.join(mut, 'scripts', 'intent-classifier');
  const restore = () => {
    fs.copyFileSync(path.join(REPO, 'scripts', 'intent-classifier.cjs'), cls);
    fs.copyFileSync(path.join(REPO, 'scripts', 'intent-classifier'), wrap);
  };
  const OLD = { name: 'old', tree: oldTree };
  const MUT = { name: 'mutant', tree: mut };
  const gg = Object.assign({}, g, { noRetry: true });
  let ok = 0;

  // M-stdout: record OLD stdout of C06, flip one byte of a literal it contains.
  const rec = runCase('C06', [OLD, OLD], gg);
  const oldOut = rec.A[0].stdout.toString('utf8');
  const lit = pickStdoutLiteral(oldOut, fs.readFileSync(cls, 'utf8'));
  const arms = [
    {
      name: 'M-stdout', caseId: 'C06', channel: 'stdout',
      apply: () => {
        if (!lit) throw new Error('M-stdout: no literal of the OLD C06 stdout occurs exactly once in intent-classifier.cjs');
        const src = fs.readFileSync(cls, 'utf8');
        if (countOf(src, lit) !== 1) throw new Error('M-stdout: literal is not unique');
        const flipped = lit[0] === lit[0].toUpperCase() ? lit[0].toLowerCase() + lit.slice(1) : lit[0].toUpperCase() + lit.slice(1);
        fs.writeFileSync(cls, src.replace(lit, flipped));
        console.log('  M-stdout literal: ' + JSON.stringify(lit));
      },
    },
    { name: 'M-stderr', caseId: 'C02', channel: 'stderr', apply: () => insertAfterLine2(cls, "process.stderr.write('m');") },
    {
      name: 'M-exit', caseId: 'C02', channel: 'exit',
      apply: () => {
        const src = fs.readFileSync(wrap, 'utf8');
        const line = 'exec node "${SCRIPT_DIR}/intent-classifier.cjs" "$@"';
        if (countOf(src, line) !== 1) throw new Error('M-exit: the final exec line is not found exactly once');
        fs.writeFileSync(wrap, src.replace(line, 'node "${SCRIPT_DIR}/intent-classifier.cjs" "$@"\nexit 3'));
      },
    },
    {
      name: 'M-file', caseId: 'C02', channel: 'file',
      apply: () => insertAfterLine2(cls, "require('node:fs').writeFileSync(require('node:path').join(process.cwd(), '.parity-mutant'), 'm');"),
    },
  ];
  arms.forEach((arm) => {
    restore();
    arm.apply();
    const res = runCase(arm.caseId, [OLD, MUT], gg);
    const hit = res.diffs.some((d) => d.channel.split(' ')[0] === arm.channel);
    res.diffs.forEach((d) => console.log('DIFF ' + arm.caseId + ' ' + d.channel + ' ' + d.detail + ' (' + arm.name + ')'));
    console.log((hit ? 'PROVE-FAIL OK ' : 'PROVE-FAIL MISSED ') + arm.name + ' channel=' + arm.channel);
    if (hit) ok += 1;
  });
  restore();
  console.log('PARITY prove-fail: ' + arms.length + ' arms, ' + ok + ' detected');
  return ok === arms.length ? 0 : 1;
}

// ---------------------------------------------------------------------------
// node-starts
// ---------------------------------------------------------------------------
function nodeStarts(oldTree, g) {
  const shimDir = oracle.mkTmp('shim');
  const shim = path.join(shimDir, 'node');
  fs.writeFileSync(shim, '#!/usr/bin/env bash\necho "$$" >> "$NODE_SHIM_LOG"\nexec "' + process.execPath + '" "$@"\n', { mode: 0o755 });
  const counts = {};
  [['OLD', oldTree], ['NEW', REPO]].forEach((p) => {
    const log = path.join(shimDir, p[0] + '.log');
    fs.writeFileSync(log, '');
    const gg = Object.assign({}, g, { pathPrefix: shimDir, extraEnv: { NODE_SHIM_LOG: log }, noRetry: true });
    runCase('C12', [{ name: p[0].toLowerCase(), tree: p[1] }], Object.assign({}, gg, { singleSide: true }));
    counts[p[0]] = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length;
  });
  console.log('node-starts OLD=' + counts.OLD + ' NEW=' + counts.NEW);
  return 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { mode: 'default', cases: CASE_IDS.slice(), keep: false, verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--determinism') o.mode = 'determinism';
    else if (a === '--prove-fail') o.mode = 'prove-fail';
    else if (a === '--node-starts') o.mode = 'node-starts';
    else if (a === '--case') o.cases = String(argv[++i] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (a === '--keep') o.keep = true;
    else if (a === '-v') o.verbose = true;
    else throw new Error('unknown flag ' + a);
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  oracle.setKeep(o.keep);
  const xdgRoot = oracle.mkTmp('xdg');
  const g = { xdg: path.join(xdgRoot, 'cache'), keep: o.keep, verbose: o.verbose };
  fs.mkdirSync(g.xdg, { recursive: true });
  let code = 0;
  try {
    if (o.mode === 'determinism') {
      g.norm = makeNorm([REPO]);
      let diffs = 0;
      o.cases.forEach((id) => { diffs += report(runCase(id, [{ name: 'new-a', tree: REPO }, { name: 'new-b', tree: REPO }], g)); });
      console.log('PARITY determinism: ' + o.cases.length + ' cases, ' + diffs + ' diffs');
      code = diffs === 0 ? 0 : 1;
    } else if (o.mode === 'prove-fail') {
      const oldTree = buildOldSide(process.env.PARITY_261030_BASE_SHA || BASE_SHA);
      code = proveFail(oldTree, g);
    } else if (o.mode === 'node-starts') {
      if (!fs.existsSync('/proc')) { console.log('SKIP node-starts: no /proc'); return 0; }
      const oldTree = buildOldSide(process.env.PARITY_261030_BASE_SHA || BASE_SHA);
      g.norm = makeNorm([oldTree, REPO]);
      code = nodeStarts(oldTree, g);
    } else {
      const oldTree = buildOldSide(process.env.PARITY_261030_BASE_SHA || BASE_SHA);
      g.norm = makeNorm([oldTree, REPO]);
      let diffs = 0;
      o.cases.forEach((id) => {
        if (id === 'C12' && !fs.existsSync('/proc')) { console.log('SKIP C12: no /proc'); return; }
        diffs += report(runCase(id, [{ name: 'old', tree: oldTree }, { name: 'new', tree: REPO }], g));
        if (id === 'C16') {
          let n = 0;
          (function walk(d) {
            let ents = [];
            try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
            ents.forEach((e) => { if (e.isDirectory()) walk(path.join(d, e.name)); else n += 1; });
          })(path.join(g.xdg, 'mindrian-os'));
          console.log('compile-cache files=' + n);
        }
      });
      console.log('PARITY default: ' + o.cases.length + ' cases, ' + diffs + ' diffs');
      code = diffs === 0 ? 0 : 1;
    }
  } finally {
    if (o.keep) console.log('kept xdg ' + xdgRoot);
    oracle.cleanupTmp();
  }
  return code;
}

module.exports = { CASE_IDS, BASE_SHA, buildCase, sideEnv, restoreRun };

if (require.main === module) {
  process.exitCode = main();
}
