// 369.26-03 guard: the mod's derived assets are byte-equal to their canonical sources, the
// contrast table in the UI-SPEC is re-measured from the asset, and no hex color literal exists
// in the mod's src/ (colors are read from the palette at run time, never baked in).
//
// Plain counters, nonzero exit tail (house harness). Hyphens only.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');

let passed = 0;
let failed = 0;
function scenario(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n    ' + String(err && err.message ? err.message : err).split('\n').join('\n    ') + '\n');
  }
}

function sameBytes(canonicalRel, derivedRel) {
  const a = path.join(REPO, canonicalRel);
  const b = path.join(REPO, derivedRel);
  assert.ok(fs.existsSync(a), canonicalRel + ' exists');
  assert.ok(fs.existsSync(b), derivedRel + ' exists (run node ui/mindrian-workspace-mod/scripts/sync-assets.cjs)');
  assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), derivedRel + ' differs from ' + canonicalRel);
}

// ---------- (1) byte equality of the derived assets ----------

scenario('assets/palette.json is byte-equal to references/visual/palette.json', () => {
  sameBytes('references/visual/palette.json', 'ui/mindrian-workspace-mod/assets/palette.json');
});

scenario('assets/framework-names.json is byte-equal to data/framework-names.json', () => {
  sameBytes('data/framework-names.json', 'ui/mindrian-workspace-mod/assets/framework-names.json');
});

scenario('sync-assets.cjs --check exits 0 when equal and names the asset', () => {
  const script = path.join(MOD, 'scripts', 'sync-assets.cjs');
  assert.ok(fs.existsSync(script), 'scripts/sync-assets.cjs exists');
  const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'exit ' + r.status + ': ' + r.stdout + r.stderr);
  assert.ok(/palette\.json/.test(r.stdout), 'output names palette.json');
});

scenario('sync-assets.cjs --check exits 1 on drift and says which asset', () => {
  const script = path.join(MOD, 'scripts', 'sync-assets.cjs');
  assert.ok(fs.existsSync(script), 'scripts/sync-assets.cjs exists');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-sync-'));
  try {
    // A copy of the script in a scratch mod tree under a scratch repo root: drift in assets/.
    const repo = path.join(tmp, 'repo');
    const mod = path.join(repo, 'ui', 'mindrian-workspace-mod');
    fs.mkdirSync(path.join(mod, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(mod, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'references', 'visual'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'data'), { recursive: true });
    fs.copyFileSync(script, path.join(mod, 'scripts', 'sync-assets.cjs'));
    fs.copyFileSync(path.join(REPO, 'references', 'visual', 'palette.json'), path.join(repo, 'references', 'visual', 'palette.json'));
    fs.copyFileSync(path.join(REPO, 'data', 'framework-names.json'), path.join(repo, 'data', 'framework-names.json'));
    fs.copyFileSync(path.join(REPO, 'references', 'visual', 'palette.json'), path.join(mod, 'assets', 'palette.json'));
    fs.copyFileSync(path.join(REPO, 'data', 'framework-names.json'), path.join(mod, 'assets', 'framework-names.json'));
    // Plan 15 appended the registry pair: the scratch repo carries both pairs too.
    for (const name of ['command-registry.json', 'section-job-canon.json']) {
      fs.copyFileSync(path.join(REPO, 'data', name), path.join(repo, 'data', name));
      fs.copyFileSync(path.join(REPO, 'data', name), path.join(mod, 'assets', name));
    }
    const run = () => spawnSync(process.execPath, [path.join(mod, 'scripts', 'sync-assets.cjs'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(run().status, 0, 'scratch copy starts equal');
    fs.appendFileSync(path.join(mod, 'assets', 'palette.json'), ' ');
    const r = run();
    assert.strictEqual(r.status, 1, 'drift exits 1, got ' + r.status);
    assert.ok(/palette\.json/.test(r.stdout + r.stderr), 'names the drifted asset');
    // Missing asset also exits 1.
    fs.rmSync(path.join(mod, 'assets', 'framework-names.json'));
    const r2 = run();
    assert.strictEqual(r2.status, 1, 'missing exits 1, got ' + r2.status);
    assert.ok(/framework-names\.json/.test(r2.stdout + r2.stderr), 'names the missing asset');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------- (2) the contrast table, re-measured from the asset ----------

function luminance(hex) {
  const n = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// job name (a Canon v5 role since C-30) -> palette key name (the mod's own mapping; values come from the asset).
const KEY = {
  evidence: 'mondrian_blue',
  contradiction: 'mondrian_yellow',
  assumption: 'mondrian_red',
  structure: 'mondrian_black',
  paper: 'cream',
};

// [text job, background job, expected ratio] from the UI-SPEC Color table and section 20.4.
const MEASURED = [
  ['paper', 'structure', 17.13],
  ['structure', 'paper', 17.13],
  ['paper', 'evidence', 9.82],
  ['structure', 'contradiction', 8.17],
  ['paper', 'assumption', 5.56],
  ['contradiction', 'structure', 8.17],
  ['evidence', 'structure', 1.75],
  // graphics (3.0 floor): evidence and assumption on paper, assumption on structure, yellow on blue
  ['evidence', 'paper', 9.82],
  ['assumption', 'paper', 5.56],
  ['assumption', 'structure', 3.08],
  ['contradiction', 'evidence', 4.68],
];
const FORBIDDEN = [
  ['paper', 'contradiction', 2.1],
  ['contradiction', 'paper', 2.1],
  ['structure', 'evidence', 1.75],
  ['evidence', 'structure', 1.75],
  ['assumption', 'structure', 3.08],
  ['contradiction', 'assumption', 2.65],
  ['evidence', 'assumption', 1.77],
];

function loadAssetBase() {
  const file = path.join(MOD, 'assets', 'palette.json');
  assert.ok(fs.existsSync(file), 'assets/palette.json exists');
  return JSON.parse(fs.readFileSync(file, 'utf8')).base;
}

scenario('measured text-on-block ratios equal the UI-SPEC table within 0.02', () => {
  const base = loadAssetBase();
  for (const [t, b, want] of MEASURED) {
    const got = ratio(base[KEY[t]], base[KEY[b]]);
    assert.ok(Math.abs(got - want) <= 0.02, t + ' on ' + b + ': measured ' + got.toFixed(2) + ', table ' + want);
  }
});

scenario('forbidden pairs match the table and every text pair stays below 4.5', () => {
  const base = loadAssetBase();
  for (const [t, b, want] of FORBIDDEN) {
    const got = ratio(base[KEY[t]], base[KEY[b]]);
    assert.ok(Math.abs(got - want) <= 0.02, t + ' on ' + b + ': measured ' + got.toFixed(2) + ', table ' + want);
    assert.ok(got < 4.5, t + ' on ' + b + ' is forbidden but measures ' + got.toFixed(2));
  }
});

scenario('the allowed text pairs all clear 4.5 (the block-edge pair is a graphic, not text)', () => {
  const base = loadAssetBase();
  for (const [t, b] of [['paper', 'evidence'], ['structure', 'contradiction'], ['paper', 'assumption'], ['paper', 'structure'], ['structure', 'paper']]) {
    const got = ratio(base[KEY[t]], base[KEY[b]]);
    assert.ok(got >= 4.5, t + ' on ' + b + ' measures ' + got.toFixed(2));
  }
});

scenario('gray_meta is not a job: the five job keys exist and none is gray_meta', () => {
  const base = loadAssetBase();
  for (const k of Object.values(KEY)) assert.ok(typeof base[k] === 'string', k + ' present');
  assert.ok(!Object.values(KEY).includes('gray_meta'));
  assert.ok(typeof base.success_green === 'string', 'success_green present');
});

scenario('the old job names are gone from src: no where, yourMove, problem, frame or reading used as a theme job', () => {
  const OLD = /['"](where|yourMove|problem|frame|reading)['"]|\b(theme|THEME)\.(where|yourMove|problem|frame|reading)\b|\bonFrame\b/;
  const hits = [];
  const walkSrc = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkSrc(abs); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      // The Sources reading state has a field called reading; that is not a theme job.
      const text = fs.readFileSync(abs, 'utf8').split('\n').filter((l) => !/'reading' in x/.test(l)).join('\n');
      if (OLD.test(stripComments(text))) hits.push(path.relative(MOD, abs));
    }
  };
  walkSrc(path.join(MOD, 'src'));
  assert.deepStrictEqual(hits, []);
});

// ---------- (3) no hex color literal in src/ ----------

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;,{(])\/\/[^\n]*/g, '$1');
}
const HEX = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})(?![0-9A-Za-z])/;

function srcFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...srcFiles(abs));
    else if (/\.tsx?$/.test(entry.name)) out.push(abs);
  }
  return out;
}
function hexHits(dir) {
  const hits = [];
  for (const f of srcFiles(dir)) {
    const text = stripComments(fs.readFileSync(f, 'utf8'));
    text.split('\n').forEach((line, i) => {
      if (HEX.test(line)) hits.push(path.relative(dir, f) + ':' + (i + 1) + ': ' + line.trim());
    });
  }
  return hits;
}

scenario('no hex color literal in ui/mindrian-workspace-mod/src (comments allowed)', () => {
  assert.deepStrictEqual(hexHits(path.join(MOD, 'src')), []);
});

scenario('mutation: the same arm catches a planted hex literal and ignores one in a comment', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-hex-'));
  try {
    fs.mkdirSync(path.join(tmp, 'theme'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'theme', 'ok.ts'), '// the old value was ' + '#1E3A6E' + '\n/* and ' + '#fff' + ' */\nexport const a = 1\n');
    assert.deepStrictEqual(hexHits(tmp), [], 'hex in comments is allowed');
    fs.writeFileSync(path.join(tmp, 'theme', 'bad.tsx'), "export const c = { backgroundColor: '" + '#1E3A6E' + "' }\n");
    assert.strictEqual(hexHits(tmp).length, 1, 'the planted literal is caught');
    fs.writeFileSync(path.join(tmp, 'theme', 'bad2.ts'), "export const d = '" + '#abc' + "'\n");
    assert.strictEqual(hexHits(tmp).length, 2, 'a short literal is caught too');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
