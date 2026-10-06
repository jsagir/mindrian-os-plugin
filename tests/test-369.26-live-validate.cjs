// 369.26 live sources (plan 06): what the real `claude plugin validate` says about the repo tree of
// the mod. It proves the model hooks are registered on the two events, that every environment name
// and state key the engine lists is one the plan means, and that MOS_WORKSPACE_SAMPLE (the dev
// switch that plan 04's chooseViewModel needs a hook to spell) is listed on the REAL tree.
//
// MOS_WORKSPACE_SAMPLE is spelled by the render hooks of the band and the pane (plans 05 and 07),
// not by the model registrar (a live refresh never reads the sample). Until one of them lands, no
// file under src/ other than model/read.ts (a comment) spells it; this test then reports exit 77
// (ENV GAP, never a pass) for that one arm and says why, and it turns into a hard assertion the day
// a reader lands. Exit 77 when the claude binary is not on PATH. Read only; hyphens only.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');

let passed = 0;
let failed = 0;
let skipped = 0;
function scenario(name, fn) {
  try {
    const r = fn();
    if (typeof r === 'string' && r.startsWith('skip')) { skipped += 1; process.stdout.write('  skip ' + name + ' (' + r.slice(5) + ')\n'); return; }
    passed += 1; process.stdout.write('  ok ' + name + '\n');
  } catch (e) {
    failed += 1; process.stdout.write('  FAIL ' + name + '\n    ' + (e.stack || e.message || String(e)) + '\n');
  }
}

const HAVE_CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;
if (!HAVE_CLAUDE) {
  process.stdout.write('ENV GAP: claude is not on PATH\n');
  process.exit(77);
}

const v = spawnSync('claude', ['plugin', 'validate', MOD], { encoding: 'utf8' });
const out = (v.stdout || '') + (v.stderr || '');

function listed(label) {
  const m = new RegExp('src/register\\.tsx ' + label + ': ([^\\n]*)').exec(out);
  return m ? m[1].split(',').map((s) => s.trim()) : [];
}

scenario('validate passes on the real tree', () => {
  assert.strictEqual(v.status, 0, out);
  assert.ok(/Validation passed/.test(out), out);
});

scenario('the model hooks are registered on session.start and turn.complete', () => {
  const hooks = listed('hooks');
  assert.ok(hooks.includes('session.start'), 'hooks: ' + hooks.join(', '));
  assert.ok(hooks.includes('turn.complete'), 'hooks: ' + hooks.join(', '));
});

scenario('the live reads are the ones the plan means (HOME, USERPROFILE, MINDRIAN_ROOMS_HOME) and the model key is written', () => {
  const env = listed('env reads');
  for (const name of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME']) assert.ok(env.includes(name), 'env reads: ' + env.join(', '));
  assert.ok(listed('state writes').includes('mindrian-workspace.viewModel'));
  assert.deepStrictEqual(listed('env writes'), ['nothing']);
});

scenario('no fetcher writes state or calls the Brain (source greps)', () => {
  const dir = path.join(MOD, 'src', 'model', 'live');
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/BRAIN_SERVER|mindrian-brain|brain_/.test(text), f + ' names the Brain');
    assert.ok(!/\$\.state\.set|\bupdate\(/.test(text.replace(/\/\/[^\n]*/g, '')), f + ' writes state');
    assert.ok(!/fs\.write|gate_answer/.test(text.replace(/\/\/[^\n]*/g, '')), f + ' writes');
  }
});

scenario('MOS_WORKSPACE_SAMPLE is listed as an env read on the real tree', () => {
  const src = path.join(MOD, 'src');
  const spelled = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && /\$\.env\.get\(\s*['"]MOS_WORKSPACE_SAMPLE['"]/.test(fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, ''))) spelled.push(path.relative(MOD, p));
    }
  })(src);
  if (spelled.length === 0) return 'skip no hook under src/ spells $.env.get("MOS_WORKSPACE_SAMPLE") yet; the band and pane render hooks (plans 05 and 07) own that read';
  assert.ok(listed('env reads').includes('MOS_WORKSPACE_SAMPLE'), 'spelled in ' + spelled.join(', ') + ' but validate lists: ' + listed('env reads').join(', '));
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n');
if (failed > 0) process.exit(1);
process.exit(skipped > 0 ? 77 : 0);
