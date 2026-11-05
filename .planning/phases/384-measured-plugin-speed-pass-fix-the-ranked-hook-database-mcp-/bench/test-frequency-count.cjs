'use strict';
// Check file for frequency-count.cjs (plan 384-09, T-384-40).
// Node built-ins only. Prints "frequency-count: ALL PASS" or "frequency-count: <n> FAILED".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const COUNTER = path.join(__dirname, 'frequency-count.cjs');
let failed = 0;
function check(name, ok, detail) {
  if (!ok) {
    failed += 1;
    console.log('FAIL ' + name + (detail ? ' : ' + detail : ''));
  } else {
    console.log('ok   ' + name);
  }
}

function run(args) {
  return spawnSync(process.execPath, [COUNTER, ...args], { encoding: 'utf8' });
}

function line(o) {
  return JSON.stringify(o) + '\n';
}

function sessionText(opts) {
  const o = opts || {};
  let s = '';
  s += line({ type: 'user', message: { role: 'user', content: 'SECRETWORD-ALPHA' } });
  s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'SECRETWORD-DELTA' }] } });
  s += line({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/' + 'tmp/secret-path-BETA/file-GAMMA.md', content: 'x' } }],
    },
  });
  s += line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'SECRETWORD-ALPHA result' }] } });
  if (o.extra) {
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'echo SECRETWORD-ALPHA' } }] } });
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't3', name: 'mcp__plugin_mos_mindrian-brain__brain_query', input: {} }] } });
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't4', name: 'mcp__plugin_mos_mindrian-os__gate_answer', input: {} }] } });
  }
  s += 'this line is not json SECRETWORD-ALPHA\n';
  return s;
}

function makeProjects(sessions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-root-ZETA-'));
  const sub = path.join(root, '-x-' + 'Mindrian' + 'Rooms-fixture-room');
  fs.mkdirSync(sub);
  const other = path.join(root, '-x-other-project');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'sess-OTHER-eeee.jsonl'), sessionText());
  for (let i = 0; i < sessions; i += 1) {
    fs.writeFileSync(path.join(sub, 'sess-THETA-' + i + '-uuid.jsonl'), sessionText({ extra: i === 0 }));
  }
  return root;
}

function cleanup(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// FQ0: the counter exists.
check('FQ0 counter file exists', fs.existsSync(COUNTER));
if (!fs.existsSync(COUNTER)) {
  console.log('frequency-count: ' + failed + ' FAILED');
  process.exit(1);
}

// FQ3: no leak, counts right, one session.
{
  const root = makeProjects(1);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ3 exit 0', r.status === 0, 'status ' + r.status + ' ' + r.stderr);
  let j = null;
  try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* ignore */ }
  check('FQ3 output parses', !!j);
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  check('FQ3 one session counted (other folders skipped)', !!j && j.sessions === 1, JSON.stringify(j && j.sessions));
  check('FQ3 one prompt', !!j && j.totals && j.totals.prompts === 1, JSON.stringify(j && j.totals));
  check('FQ3 Write group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.write_edit === 1, JSON.stringify(j && j.totals && j.totals.tool_use));
  check('FQ3 Bash group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.bash === 1);
  check('FQ3 brain group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.brain === 1);
  check('FQ3 gate_answer group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.gate_answer === 1);
  const secrets = ['SECRETWORD-ALPHA', 'SECRETWORD-DELTA', 'secret-path-BETA', 'file-GAMMA', path.basename(root), 'sess-THETA', 'fixture-room', 'OTHER'];
  const all = text + '\n' + r.stdout + '\n' + r.stderr;
  for (const s of secrets) {
    check('FQ3 no leak of ' + s, !all.includes(s));
  }
  check('FQ3 stdout is basis and sessions only', /^basis: /m.test(r.stdout) && r.stdout.trim().split('\n').length <= 2, JSON.stringify(r.stdout));
  cleanup(root);
  cleanup(outDir);
}

// FQ4: fewer than 3 files gives the ASSUMED model basis.
{
  const root = makeProjects(2);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ4 exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ4 basis ASSUMED model', j.basis === 'ASSUMED model', j.basis);
  check('FQ4 model prompts 30 and ASSUMED', j.model && j.model.prompts_per_session === 30 && String(j.model.marker) === 'ASSUMED');
  check('FQ4 model Stop is derived from prompts', j.model && /derived/i.test(String(j.model.stop_note)));
  check('FQ4 model Read group 60 and Write group 20', j.model && j.model.read_grep_glob_per_session === 60 && j.model.write_edit_per_session === 20);
  cleanup(root);
  cleanup(outDir);
}

// FQ2: 3 files give a measured basis with a median and a p95.
{
  const root = makeProjects(3);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ2 exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ2 basis measured from 3 session files', j.basis === 'measured from 3 session files', j.basis);
  check('FQ2 per_session prompts has median and p95', j.per_session && j.per_session.prompts && typeof j.per_session.prompts.median === 'number' && typeof j.per_session.prompts.p95 === 'number');
  check('FQ2 no model section when measured', !j.model);
  cleanup(root);
  cleanup(outDir);
}

// Missing projects folder: zero sessions, ASSUMED model, no crash.
{
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', path.join(outDir, 'does-not-exist'), '--out', out]);
  check('FQ5 missing folder exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ5 missing folder gives 0 sessions and ASSUMED', j.sessions === 0 && j.basis === 'ASSUMED model');
  cleanup(outDir);
}

// Usage: no --out exits 2.
{
  const r = run([]);
  check('FQ6 no --out exits 2', r.status === 2, 'status ' + r.status);
}

if (failed === 0) {
  console.log('frequency-count: ALL PASS');
  process.exit(0);
}
console.log('frequency-count: ' + failed + ' FAILED');
process.exit(1);
