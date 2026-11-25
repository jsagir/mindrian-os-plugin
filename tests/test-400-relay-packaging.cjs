#!/usr/bin/env node
'use strict';
// Phase 400 plan 13 (RL-04; O-08): the relay Render Blueprint, the operator README and the npm package boundary.
//   K1 npm pack ships 0 files under services/; package.json files has no services entry
//   K2 render.yaml: no rootDir, NODE_VERSION "22", no-install build, the start command, /health,
//      auto deploy off, one instance, secrets with sync: false and no value, user traffic "off", no key-like text
//   K3 every repo file the relay loads or reads is covered by a buildFilter path
//   K4 README.md names every owner-gated step and every env var with its config.cjs default
//   K5 no file under services/ holds an em dash or an en dash
// No network: npm pack --dry-run reads the local tree only; the K3 child uses an in-process fake fetch.
// No GEMINI_API_KEY is read from this machine. Hyphens only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const REL = path.join(REPO, 'services/decision-relay');
const YAML_PATH = path.join(REL, 'render.yaml');
const README_PATH = path.join(REL, 'README.md');

let pass = 0;
let fail = 0;
function leg(name, fn) {
  let ok;
  try { ok = fn(); } catch (e) { ok = 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400); }
  if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
}
function read(p) { return fs.readFileSync(p, 'utf8'); }

// ---- a small reader for the one render.yaml shape this file uses (no YAML dependency) ----
function codeLines(text) {
  return text.split('\n').map((l) => l.replace(/\s+#.*$/, '')).filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
}
function indentOf(l) { return l.length - l.replace(/^ +/, '').length; }
function unquote(v) { const s = v.trim(); return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s; }
// The scalar of the first `name:` line.
function scalar(lines, name) {
  const re = new RegExp('^\\s*(- )?' + name + ':\\s*(.*)$');
  for (const l of lines) { const m = re.exec(l); if (m) return m[2]; }
  return undefined;
}
// envVars entries: [{key, fields: {sub: raw}}]
function envVars(lines) {
  const out = [];
  let inEnv = false;
  let envIndent = -1;
  let cur = null;
  for (const l of lines) {
    if (/^\s*envVars:\s*$/.test(l)) { inEnv = true; envIndent = indentOf(l); continue; }
    if (!inEnv) continue;
    if (indentOf(l) <= envIndent && !/^\s*- /.test(l.slice(envIndent))) { inEnv = false; continue; }
    const k = /^\s*- key:\s*(\S+)\s*$/.exec(l);
    if (k) { cur = { key: k[1], fields: {} }; out.push(cur); continue; }
    const f = /^\s*([A-Za-z]+):\s*(.*)$/.exec(l);
    if (f && cur) cur.fields[f[1]] = f[2];
  }
  return out;
}
// buildFilter.paths list items.
function buildFilterPaths(lines) {
  const out = [];
  let state = 0;
  let pathsIndent = -1;
  for (const l of lines) {
    if (state === 0 && /^\s*buildFilter:\s*$/.test(l)) { state = 1; continue; }
    if (state === 1 && /^\s*paths:\s*$/.test(l)) { state = 2; pathsIndent = indentOf(l); continue; }
    if (state === 2) {
      const m = /^\s*- (.+)$/.exec(l);
      if (m && indentOf(l) >= pathsIndent) { out.push(unquote(m[1])); continue; }
      break;
    }
  }
  return out;
}
function covered(rel, filters) {
  return filters.some((f) => (f.endsWith('/**') ? rel.startsWith(f.slice(0, -2)) : rel === f));
}

leg('K1 npm pack --dry-run lists 0 paths under services/; package.json files has no services entry', () => {
  const pkg = JSON.parse(read(path.join(REPO, 'package.json')));
  const bad = (pkg.files || []).filter((f) => /^!?services/.test(f));
  if (bad.length > 0) return 'files entry ' + bad.join(',');
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { npm_config_update_notifier: 'false' }) });
  if (r.status !== 0) return 'npm pack exit ' + r.status + ' ' + String(r.stderr).slice(0, 300);
  const start = r.stdout.indexOf('[');
  const parsed = JSON.parse(r.stdout.slice(start));
  const files = parsed[0].files.map((f) => f.path);
  if (files.length < 100) return 'too few packed files ' + files.length;
  const under = files.filter((f) => f.startsWith('services/') || f.startsWith('services\\'));
  console.log('  K1 packed files: ' + files.length + ', under services/: ' + under.length);
  return under.length === 0 ? true : 'packed ' + under.slice(0, 3).join(',');
});

let FILTERS = [];
leg('K2 render.yaml: no rootDir; NODE_VERSION "22"; build, start, health, auto deploy off, one instance; secrets sync false; no key-like text', () => {
  const text = read(YAML_PATH);
  const lines = codeLines(text);
  if (/^\s*rootDir\s*:/m.test(text)) return 'rootDir key present';
  if (scalar(lines, 'type') !== 'web') return 'type ' + scalar(lines, 'type');
  if (scalar(lines, 'name') !== 'decision-relay') return 'name ' + scalar(lines, 'name');
  if (scalar(lines, 'runtime') !== 'node') return 'runtime ' + scalar(lines, 'runtime');
  if (scalar(lines, 'buildCommand') !== 'node --version') return 'buildCommand ' + scalar(lines, 'buildCommand');
  if (scalar(lines, 'startCommand') !== 'node services/decision-relay/server.cjs') return 'startCommand ' + scalar(lines, 'startCommand');
  if (scalar(lines, 'healthCheckPath') !== '/health') return 'healthCheckPath ' + scalar(lines, 'healthCheckPath');
  // autoDeployTrigger is the current Render field; autoDeploy is its deprecated twin (Render: the trigger wins if both).
  if (scalar(lines, 'autoDeploy') !== 'false') return 'autoDeploy ' + scalar(lines, 'autoDeploy');
  if (unquote(scalar(lines, 'autoDeployTrigger') || '') !== 'off' || !/^["']off["']$/.test(String(scalar(lines, 'autoDeployTrigger')).trim())) return 'autoDeployTrigger must be the quoted string off';
  if (scalar(lines, 'numInstances') !== '1') return 'numInstances ' + scalar(lines, 'numInstances');
  const env = envVars(lines);
  const by = {};
  for (const e of env) by[e.key] = e.fields;
  if (!by.NODE_VERSION || by.NODE_VERSION.value !== '"22"') return 'NODE_VERSION ' + JSON.stringify(by.NODE_VERSION);
  if (!by.RELAY_PROXY_HOPS || by.RELAY_PROXY_HOPS.value !== '"1"') return 'RELAY_PROXY_HOPS ' + JSON.stringify(by.RELAY_PROXY_HOPS);
  if (!by.RELAY_USER_TRAFFIC || by.RELAY_USER_TRAFFIC.value !== '"off"') return 'RELAY_USER_TRAFFIC ' + JSON.stringify(by.RELAY_USER_TRAFFIC);
  for (const k of ['GEMINI_API_KEY', 'RELAY_OPERATOR_TOKEN_SHA256']) {
    const f = by[k];
    if (!f) return k + ' missing';
    if (f.sync !== 'false') return k + ' sync ' + f.sync;
    if (Object.prototype.hasOwnProperty.call(f, 'value') || Object.prototype.hasOwnProperty.call(f, 'generateValue')) return k + ' has a value line';
  }
  for (const l of text.split('\n')) {
    if (/[0-9a-fA-F]{32,}/.test(l)) return 'a 32-plus hex run: ' + l.trim().slice(0, 40);
    if (/AIza/.test(l)) return 'AIza text';
  }
  FILTERS = buildFilterPaths(lines);
  for (const want of ['services/decision-relay/**', 'lib/core/decision-advisor/**', 'lib/core/problem-axes.cjs', 'lib/core/install-id.cjs', 'data/job-vocabulary.json', 'data/command-registry.json']) {
    if (FILTERS.indexOf(want) === -1) return 'buildFilter misses ' + want;
  }
  return true;
});

leg('K3 every repo file the relay loads or reads (require graph plus a full handleDecide run) matches a buildFilter path', () => {
  if (FILTERS.length === 0) return 'no buildFilter paths (K2 failed)';
  const token = 'k3-operator-token-0000';
  const child = [
    "'use strict';",
    "const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');",
    'const REPO = process.argv[1];',
    "const sampleText = fs.readFileSync(path.join(REPO, 'tests/fixtures/399/neutral-request-sample.json'), 'utf8');",
    'const seen = new Set(); const orig = fs.readFileSync;',
    'fs.readFileSync = function (p, ...a) { try { seen.add(path.resolve(typeof p === "string" ? p : (p instanceof URL ? p.pathname : String(p)))); } catch (_e) {} return orig.call(this, p, ...a); };',
    "const relayMod = require(path.join(REPO, 'services/decision-relay/relay.cjs'));",
    "require(path.join(REPO, 'services/decision-relay/server.cjs'));",
    "const labels = require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs'));",
    'labels.buildLabelCatalog(); const fp = labels.catalogFingerprint();',
    "const tok = process.argv[2]; const hash = crypto.createHash('sha256').update(tok).digest('hex');",
    'function answerFor(q) { if (q.type === "choice") { const ks = Object.keys(q.criteria); const pr = {}; ks.forEach((k) => { pr[k] = 1 / ks.length; }); return { type: "choice", choice: ks[0], probabilities: pr, confidence: 0.5 }; } if (q.type === "noul") return { type: "noul", noul: 0.25 }; return { type: "score", score: 0.5, probabilities: { 0: 0.2, 1: 0.3, 2: 0.5 }, confidence: 0.5 }; }',
    'const fetchImpl = async (_u, init) => { const b = JSON.parse(init.body); const answers = {}; for (const id of Object.keys(b.questions)) answers[id] = answerFor(b.questions[id]); return new Response(JSON.stringify({ answers, usage: { total_input_tokens: 5, total_output_tokens: 0 } }), { status: 200 }); };',
    "const relay = relayMod.createRelay({ env: { GEMINI_API_KEY: 'fake-k3', RELAY_OPERATOR_TOKEN_SHA256: hash }, fetchImpl, log: () => {}, upstreamOrigin: 'https://upstream.test.invalid' });",
    "relay.handleDecide({ headers: { authorization: 'Bearer ' + tok, 'x-mindrian-catalog': fp }, bodyText: sampleText, bytes: Buffer.byteLength(sampleText), address: '192.0.2.1' }).then((r) => {",
    '  for (const k of Object.keys(require.cache)) seen.add(k);',
    '  const files = [...seen].filter((p) => p.startsWith(REPO + path.sep)).map((p) => path.relative(REPO, p).split(path.sep).join("/")).sort();',
    '  process.stdout.write(JSON.stringify({ status: r.status, files }));',
    '});',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', child, REPO, token], { cwd: REPO, encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 30000 });
  if (r.status !== 0) return 'child exit ' + r.status + ' ' + String(r.stderr).slice(0, 400);
  const out = JSON.parse(r.stdout);
  if (out.status !== 200) return 'the handleDecide run did not reach 200: ' + out.status;
  if (out.files.length < 8) return 'too few files seen ' + out.files.length;
  const missing = out.files.filter((f) => !covered(f, FILTERS));
  console.log('  K3 relay files loaded or read: ' + out.files.length + ' (' + out.files.join(', ') + ')');
  return missing.length === 0 ? true : 'not covered by buildFilter: ' + missing.join(', ');
});

leg('K4 README.md names every owner-gated step, the unverified assumptions and every env var with its config.cjs default', () => {
  const t = read(README_PATH);
  const need = [
    [/OWNER-GATED/, 'the OWNER-GATED heading'],
    [/Blueprint Path/, 'Blueprint Path'],
    [/services\/decision-relay\/render\.yaml/, 'the Blueprint file path'],
    [/GEMINI_API_KEY/, 'GEMINI_API_KEY'],
    [/RELAY_OPERATOR_TOKEN_SHA256/, 'RELAY_OPERATOR_TOKEN_SHA256'],
    [/node:crypto/, 'minting with node:crypto'],
    [/sha256/i, 'sha256'],
    [/paid Gemini tier/i, 'the paid Gemini tier'],
    [/F-09/, 'F-09'],
    [/EEA/, 'EEA'],
    [/Switzerland/, 'Switzerland'],
    [/\bUK\b/, 'UK'],
    [/Render plan/, 'the Render plan'],
    [/price/i, 'the price'],
    [/RELAY_USER_TRAFFIC/, 'RELAY_USER_TRAFFIC'],
    [/O-10/, 'O-10'],
    [/release commit/i, 'deploy from the release commit'],
    [/Pitfall 12/, 'Pitfall 12'],
    [/one instance/i, 'one instance'],
    [/\bA2\b/, 'assumption A2'],
    [/\bA3\b/, 'assumption A3'],
    [/x-theo-install-id/, 'the install id header'],
    [/Authorization: Bearer/, 'the Bearer header'],
    [/x-mindrian-catalog/, 'the catalog header'],
    [/GET \/health/, 'the health route'],
    [/POST \/v1\/decide/, 'the decide route'],
    [/Theo is not changed/, 'Theo is not changed'],
    [/rate-limit/, 'the Theo rate-limit analog'],
    [/not a general Gemini endpoint/i, 'not a general Gemini endpoint'],
  ];
  for (const [re, what] of need) if (!re.test(t)) return 'README misses ' + what;
  // Every number env var in config.cjs, with its default on the same line.
  const src = read(path.join(REL, 'config.cjs'));
  const { DEFAULTS } = require(path.join(REL, 'config.cjs'));
  const pairs = [...src.matchAll(/(RELAY_[A-Z_]+): \['([A-Za-z]+)', \d+\]/g)].map((m) => [m[1], m[2]]);
  if (pairs.length < 12) return 'config.cjs NUMBERS parse ' + pairs.length;
  const lines = t.split('\n');
  for (const [name, field] of pairs) {
    const line = lines.find((l) => l.indexOf('`' + name + '`') !== -1 && /^\|/.test(l));
    if (!line) return 'README env table misses ' + name;
    if (line.indexOf(String(DEFAULTS[field])) === -1) return name + ' row lacks its default ' + DEFAULTS[field];
  }
  for (const name of ['PORT', 'RELAY_HOST', 'NODE_VERSION']) {
    if (!lines.some((l) => /^\|/.test(l) && l.indexOf('`' + name + '`') !== -1)) return 'README env table misses ' + name;
  }
  // The README never tells an agent to do an owner step, and holds no key-like text.
  if (/[0-9a-fA-F]{32,}/.test(t)) return 'a 32-plus hex run in README';
  if (/AIza/.test(t)) return 'AIza text in README';
  return true;
});

leg('K5 no file under services/ holds an em dash or an en dash', () => {
  const bad = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/[\u2013\u2014]/.test(read(p))) bad.push(path.relative(REPO, p));
    }
  };
  walk(path.join(REPO, 'services'));
  return bad.length === 0 ? true : 'dash in ' + bad.join(', ');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
