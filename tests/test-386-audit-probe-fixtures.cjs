#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-39 (E-PROBE): hygiene and baseline arms for the second audit's
 * probe fixtures in tests/fixtures/386-audit-probes/.
 *
 * Arms:
 *   FX1  counts per file and per corpora group, unique ids
 *   FX2  no credential shape is stored in any fixture file
 *   FX3  reserved email domains only, no URL, no private path, fictional phones
 *   FX4  loader exports and run-time key building
 *   FX5  baseline-before.json header and one row per case
 *   FX6  README lines
 *   FX7  classifyAll is deterministic and makes no network call
 *
 * Part 8: synthetic rooms only, temporary HOME, no network.
 * The patterns below detect key shapes. They are patterns, never a key.
 * No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXDIR = path.join(__dirname, 'fixtures', '386-audit-probes');
const LOADER = path.join(__dirname, 'helpers', 'audit-probe-loader.cjs');

// Isolate HOME before any plugin code is required.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-39-'));
const TMP_HOME = path.join(TMP, 'home');
fs.mkdirSync(TMP_HOME, { recursive: true });
fs.mkdirSync(path.join(TMP, 'registry'), { recursive: true });
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
delete process.env.CLAUDE_ACTIVE_ROOM;

let failed = 0;
function arm(label, fn) {
  try {
    const msg = fn();
    console.log('ok - ' + label + (msg ? ' (' + msg + ')' : ''));
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message : String(e)));
  }
}
function need(cond, msg) {
  if (!cond) throw new Error(msg);
}
function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXDIR, name), 'utf8'));
}
function fixtureFiles() {
  need(fs.existsSync(FIXDIR), 'fixture directory missing');
  return fs.readdirSync(FIXDIR).sort().map(function (f) {
    return { name: f, text: fs.readFileSync(path.join(FIXDIR, f), 'utf8') };
  });
}

// ---- credential shape patterns (case-insensitive) ----
const KEY_PATTERNS = [
  /sk-[a-z0-9_-]{8,}/i,
  /ghp_/i,
  /github_pat_/i,
  /xox[a-z]-/i,
  /AKIA[A-Z0-9]{12,}/i,
  /AIza/i,
  /pk_live_/i,
  /rk_live_/i,
  /npm_/i,
  /glpat-/i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /bearer\s+[a-z0-9._~+/-]{8,}/i,
  /api_key\s*=\s*[a-z0-9._~+/-]{6,}/i,
];
function keyShapeHits(text) {
  const hits = [];
  KEY_PATTERNS.forEach(function (re, i) {
    if (re.test(text)) hits.push('pattern' + i);
  });
  const tokens = text.match(/[A-Za-z0-9_-]{32,}/g) || [];
  tokens.forEach(function (t) {
    if (/[0-9]/.test(t) && /[A-Za-z]/.test(t)) hits.push('longtoken');
  });
  return hits;
}

const RESERVED = /(\.example|\.test|\.invalid|\.localhost|(^|\.)example\.(com|net|org))$/i;

const EXPECTED_GROUPS = {
  'extended': 535, '354-generic': 31, 'positives_26': 26, 'compliant': 16, 'violation': 16,
  'negatives': 10, 'must_refuse': 10, '354-private': 10, 'known_leaks': 2,
};

function dupIds(list) {
  const seen = {};
  const dups = [];
  list.forEach(function (c) {
    if (seen[c.id]) dups.push(c.id);
    seen[c.id] = true;
  });
  return dups;
}

arm('FX1 counts and unique ids', function () {
  const p = readJson('p-cases.json');
  const adv = readJson('adversarial-cases.json');
  const cor = readJson('corpora-cases.json');
  need(p.length === 15, 'p-cases ' + p.length);
  need(adv.length === 23, 'adversarial-cases ' + adv.length);
  need(cor.length === 656, 'corpora-cases ' + cor.length);
  const g = {};
  cor.forEach(function (c) { g[c.group] = (g[c.group] || 0) + 1; });
  Object.keys(EXPECTED_GROUPS).forEach(function (k) {
    need(g[k] === EXPECTED_GROUPS[k], 'group ' + k + ' is ' + g[k]);
  });
  need(Object.keys(g).length === Object.keys(EXPECTED_GROUPS).length, 'unexpected extra group');
  [['p', p], ['adv', adv], ['corpora', cor]].forEach(function (pair) {
    const d = dupIds(pair[1]);
    need(d.length === 0, pair[0] + ' duplicate ids: ' + d.join(','));
  });
  return '15 + 23 + 656';
});

arm('FX2 no credential shape is stored', function () {
  const files = fixtureFiles();
  need(files.length > 0, 'no fixture files');
  files.forEach(function (f) {
    const h = keyShapeHits(f.text);
    need(h.length === 0, f.name + ' holds a key shape: ' + h.join(','));
  });
  return files.length + ' files';
});

arm('FX3 reserved emails, no URL, no private path, fictional phones', function () {
  const files = fixtureFiles();
  need(files.length > 0, 'no fixture files');
  files.forEach(function (f) {
    const emails = f.text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    emails.forEach(function (e) {
      const dom = e.split('@')[1];
      need(RESERVED.test(dom), f.name + ' has a non-reserved email domain: ' + dom);
    });
    need(!/https?:\/\//i.test(f.text) && !/\bwww\./i.test(f.text), f.name + ' holds a URL');
    need(!/MindrianRooms/.test(f.text), f.name + ' holds a private path (rooms folder)');
    need(!/\b[A-Za-z]:[\\/]/.test(f.text), f.name + ' holds a drive letter path');
    need(!/\/home\/|\/Users\/|\/mnt\//.test(f.text), f.name + ' holds a home folder path');
    const runs = f.text.match(/\+?\(?\d[\d\s()-]{7,}\d/g) || [];
    runs.forEach(function (r) {
      const digits = r.replace(/\D/g, '');
      if (digits.length >= 9 && /[\s()-]/.test(r)) {
        need(/555[\s-]?01\d\d/.test(r), f.name + ' holds a phone-like number outside 555-01xx: ' + r);
      }
    });
  });
  return files.length + ' files';
});

arm('FX4 loader exports and run-time key building', function () {
  need(fs.existsSync(LOADER), 'loader missing');
  const L = require(LOADER);
  ['FIXTURE_DIR', 'loadProbes', 'resolveParts', 'payloadFor', 'blockNetwork', 'makeRooms', 'classifyAll'].forEach(function (k) {
    need(L[k] !== undefined, 'export ' + k + ' missing');
  });
  const joined = L.resolveParts({ a: [{ join: ['ab', 'cd'] }, 'x'], b: { join: ['1', '2', '3'] } });
  need(joined.a[0] === 'abcd' && joined.a[1] === 'x' && joined.b === '123', 'resolveParts did not join');
  const rawP = readJson('p-cases.json');
  const rawP7 = rawP.filter(function (c) { return c.id === 'P7'; })[0];
  need(rawP7, 'P7 missing');
  need(keyShapeHits(JSON.stringify(rawP7)).length === 0, 'stored P7 holds a key shape');
  const probes = L.loadProbes();
  const p7 = probes.p.filter(function (c) { return c.id === 'P7'; })[0];
  need(p7 && typeof p7.payload.question === 'string', 'resolved P7 question is not a string');
  need(KEY_PATTERNS[0].test(p7.payload.question), 'resolved P7 does not match the sk- pattern');
  need(probes.p.length === 15 && probes.adv.length === 23 && probes.corpora.length === 656, 'probe counts');
  probes.p.forEach(function (c) {
    need(typeof c.key === 'string' && c.key.indexOf('P:') === 0, 'P key');
    const vals = Object.keys(c.payload).map(function (k) { return c.payload[k]; });
    need(vals.every(function (v) { return typeof v === 'string' || typeof v === 'object'; }), 'P payload value');
  });
  probes.adv.forEach(function (c) { need(typeof c.text === 'string' && c.key.indexOf('ADV:') === 0, 'ADV ' + c.id); });
  probes.corpora.forEach(function (c) { need(typeof c.q === 'string' && c.key.indexOf('C:') === 0, 'C ' + c.id); });
  return 'ok';
});

const VERDICTS = ['allow', 'ambiguous', 'block'];

function checkBaselineFile(name) {
  const b = readJson(name);
  ['schema', 'recorded_at', 'guard_head', 'network_calls', 'counts'].forEach(function (k) {
    need(b[k] !== undefined, name + ' header field ' + k + ' missing');
  });
  need(b.network_calls === 0, name + ' network_calls is ' + b.network_calls);
  need(b.guard_root_kind === 'export' || b.guard_root_kind === 'repo', name + ' guard_root_kind');
  need(Array.isArray(b.rows) && b.rows.length === 694, name + ' rows ' + (b.rows && b.rows.length));
  const seen = {};
  const tally = { total: 0, by_verdict: { allow: 0, ambiguous: 0, block: 0 }, by_set: {}, by_group: {} };
  b.rows.forEach(function (r) {
    need(/^(P|ADV|C):/.test(r.key), name + ' bad key ' + r.key);
    need(!seen[r.key], name + ' duplicate key ' + r.key);
    seen[r.key] = true;
    need(VERDICTS.indexOf(r.verdict) >= 0, name + ' bad verdict at ' + r.key);
    need(typeof r.class === 'string' && r.class.length > 0, name + ' bad class at ' + r.key);
    tally.total += 1;
    tally.by_verdict[r.verdict] += 1;
    tally.by_set[r.set] = tally.by_set[r.set] || { allow: 0, ambiguous: 0, block: 0 };
    tally.by_set[r.set][r.verdict] += 1;
    const g = r.group || r.set;
    tally.by_group[g] = tally.by_group[g] || { allow: 0, ambiguous: 0, block: 0 };
    tally.by_group[g][r.verdict] += 1;
  });
  need(JSON.stringify(b.counts) === JSON.stringify(tally), name + ' counts do not equal the row tallies');
  return b;
}

arm('FX5 baseline-before.json header and rows', function () {
  const b = checkBaselineFile('baseline-before.json');
  need(b.guard_head === 'f0df97036', 'guard_head is ' + b.guard_head);
  need(b.guard_root_kind === 'export', 'guard_root_kind is ' + b.guard_root_kind);
  return 'head ' + b.guard_head;
});

function readme() {
  const f = path.join(FIXDIR, 'README.md');
  need(fs.existsSync(f), 'README.md missing');
  return fs.readFileSync(f, 'utf8');
}
function line(text, re, label) {
  need(re.test(text), 'README line missing: ' + label);
}

arm('FX6 README lines', function () {
  const t = readme();
  line(t, /^cases_total: 694$/m, 'cases_total');
  line(t, /^p_cases: 15$/m, 'p_cases');
  line(t, /^adversarial_cases: 23$/m, 'adversarial_cases');
  line(t, /^corpora_cases: 656$/m, 'corpora_cases');
  line(t, /^key_cases_split: \d+$/m, 'key_cases_split');
  line(t, /^emails_rewritten: \d+$/m, 'emails_rewritten');
  line(t, /^names_rewritten: \d+$/m, 'names_rewritten');
  line(t, /^excluded_cases: .+$/m, 'excluded_cases');
  line(t, /^extended_unsourced_reviewed: yes$/m, 'extended_unsourced_reviewed');
  line(t, /^baseline_guard_head: [0-9a-f]{7,}$/m, 'baseline_guard_head');
  line(t, /^baseline_note: .+$/m, 'baseline_note');
  line(t, /^baseline_before_commit: f0df97036$/m, 'baseline_before_commit');
  line(t, /^head_matrix_head: [0-9a-f]{7,}$/m, 'head_matrix_head');
  line(t, /^head_matrix_changed: \d+$/m, 'head_matrix_changed');
  line(t, /^head_matrix_diff: .+$/m, 'head_matrix_diff');
  return 'ok';
});

arm('FX7 classifyAll is deterministic with zero network calls', function () {
  const L = require(LOADER);
  const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
  const lexMod = require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
  const net = L.blockNetwork();
  const rooms = L.makeRooms(path.join(TMP, 'rooms'));
  function run() {
    return L.classifyAll({
      classify: guard.classify,
      roomFor: rooms.roomFor,
      reset: lexMod._resetLexiconCache,
    });
  }
  const a = run();
  const b = run();
  need(a.length === 694, 'rows ' + a.length);
  need(JSON.stringify(a) === JSON.stringify(b), 'two runs differ');
  need(net.count() === 0, 'network calls: ' + net.count());
  net.restore();
  return '694 rows twice';
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
if (failed > 0) {
  console.log(failed + ' arm(s) failed');
  process.exit(1);
}
console.log('all arms passed');
