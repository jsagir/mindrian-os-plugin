// 380-05 static budget gate (MOD380-05, T-380-17 to T-380-20).
//
// The claim: the face panel mod adds no hook that can starve a prompt. It runs no subprocess,
// its hook list is the pinned list, and it reads only the five environment variables that the
// budget names. The behavior proofs (tick budget, back-off, cut-off, no I/O on the prompt path)
// are the tests in ui/mos-face/tests/budget.test.ts, run by tests/test-380-engine-tests.cjs.
//
// Legs:
//   G1  claude plugin validate --json on ui/mos-face lists no $.process.run call, and the hook
//       sources hold no process.run outside a comment.
//   G2  the hook list equals the pinned list: session.start, the 13 command.run names,
//       prompt.submit, turn.start, tool.call, turn.complete and the 5 ui.render entries.
//   G3  the environment reads equal HOME, MINDRIAN_ROOMS_HOME, MOS_FACE_WORDS, NO_COLOR and
//       USERPROFILE.
//   G4  ui/mos-face/hooks/hooks.json holds the single key modules, and it lists only modules.
//   G5  no shell hook of the root hooks/hooks.json names mos-face.
// CJS, Node built-ins only. Hermetic: no network, no write. Exit 77 only when the claude CLI is
// missing and no static leg failed. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const HOOKS = path.join(MOD, 'hooks');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

const PINNED_HOOKS = [
  'session.start',
  'command.run{command=mos-state}',
  'command.run{command=mos-face}',
  'command.run{command=mos-style}',
  'command.run{command=mos-chip}',
  'command.run{command=mos-suggest}',
  'command.run{command=mos-ask}',
  'command.run{command=mos-refresh}',
  'command.run{command=mos-words}',
  'command.run{command=mos-text}',
  'command.run{command=mos-plain}',
  'command.run{command=mos-advice}',
  'command.run{command=mos-auto}',
  'command.run{command=theo-calls}',
  'prompt.submit',
  'turn.start',
  'tool.call',
  'turn.complete',
  'ui.render{component=Pane, requestId=mos-state}',
  'ui.render{component=AbovePrompt}',
  'ui.render{component=PromptHint}',
  'ui.render{component=Pane, requestId=theo-calls}',
  'ui.render{component=AssistantMessage}',
];
const PINNED_ENV = ['HOME', 'MINDRIAN_ROOMS_HOME', 'MOS_FACE_WORDS', 'NO_COLOR', 'USERPROFILE'];

// Split a validate list on top-level commas (a comma inside braces belongs to the entry).
function splitTop(list) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

// ---- G4, G5 and the source scan need no claude CLI ---------------------------------------
say('G4 the module hooks.json holds only the module list');
{
  const raw = fs.readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8');
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_e) { parsed = null; }
  check(parsed !== null && Object.keys(parsed).join(',') === 'modules', 'hooks.json has the single key modules');
  check(parsed !== null && Array.isArray(parsed.modules) && parsed.modules.length > 0 && parsed.modules.every((m) => typeof m === 'string' && /^\.\/[A-Za-z0-9._-]+\.(ts|tsx)$/.test(m)), 'every entry is a module path, no command string');
  check(!/"command"|"type"\s*:\s*"command"/.test(raw), 'hooks.json names no shell command');
}

say('G5 no shell hook of the plugin names the face module');
{
  const raw = fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf8');
  check(!/mos-face/.test(raw), 'the root hooks/hooks.json does not mention mos-face');
}

say('G1a the hook sources run no subprocess');
{
  const hits = [];
  for (const f of fs.readdirSync(HOOKS).filter((n) => /\.(ts|tsx)$/.test(n))) {
    fs.readFileSync(path.join(HOOKS, f), 'utf8').split('\n').forEach((line, i) => {
      if (/process\.run/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) hits.push(f + ':' + (i + 1));
    });
  }
  check(hits.length === 0, 'no process.run outside a comment' + (hits.length ? ' (' + hits.join(', ') + ')' : ''));
  check(!/python/i.test(fs.readFileSync(path.join(HOOKS, 'probe.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '')), 'probe.ts names no python outside a comment');
}

// ---- G1 to G3 read the validate inventory -------------------------------------------------
say('G1 to G3 the validate inventory');
let skipped = false;
{
  const has = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (has.status !== 0) {
    skipped = true;
    say('  SKIPPED (ENV GAP): the claude CLI is not on PATH');
  } else {
    const r = spawnSync('claude', ['plugin', 'validate', '--json', MOD], { encoding: 'utf8', timeout: 120000 });
    let notes = [];
    try {
      const data = JSON.parse(r.stdout);
      for (const c of data.contents || []) for (const n of c.notes || []) notes.push(String(n));
    } catch (_e) {
      notes = [];
    }
    const line = (prefix) => notes.find((n) => n.startsWith('./register.tsx ' + prefix)) || '';
    const hooksLine = line('hooks:');
    const callsLine = line('calls:');
    const envLine = line('env reads:');
    check(hooksLine !== '' && callsLine !== '' && envLine !== '', 'validate printed the hooks, calls and env reads lines');
    say('  ' + hooksLine);
    say('  ' + callsLine);
    say('  ' + envLine);

    const calls = callsLine.replace(/^.*?calls:\s*/, '');
    check(callsLine !== '' && !/\$\.process\.run/.test(calls), 'G1 the calls line lists no $.process.run');
    check(callsLine !== '' && /\$\.http\.fetch/.test(calls), 'G1 the calls line still lists the two reach fetches ($.http.fetch), so the scan is not blind');

    const found = splitTop(hooksLine.replace(/^.*?hooks:\s*/, ''));
    const missing = PINNED_HOOKS.filter((h) => !found.includes(h));
    const extra = found.filter((h) => !PINNED_HOOKS.includes(h));
    check(found.length === PINNED_HOOKS.length && missing.length === 0 && extra.length === 0,
      'G2 the hook list equals the pinned list (' + found.length + ' of ' + PINNED_HOOKS.length + ')' +
      (missing.length ? ' missing: ' + missing.join(' | ') : '') + (extra.length ? ' extra: ' + extra.join(' | ') : ''));

    const env = envLine.replace(/^.*?env reads:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean).sort();
    check(JSON.stringify(env) === JSON.stringify([...PINNED_ENV].sort()), 'G3 the env reads equal ' + PINNED_ENV.join(', ') + ' (got ' + env.join(', ') + ')');
  }
}

say('\n' + passed + ' passed, ' + failed + ' failed' + (skipped ? ', G1 to G3 skipped (claude missing)' : ''));
if (failed) process.exit(1);
process.exit(skipped ? 77 : 0);
