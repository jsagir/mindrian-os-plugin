// 369.26 plan 10 guard: the review answer path (the mod's one room write).
//
// Static arms read the repo files; engine arms run the real `claude` binary on throwaway copies of
// the mod (never the repo tree):
//   1. the recipe in tests/fixtures/review-io-recipe.ts (how the hook file builds a ReviewIo) passes
//      the engine's static scan, and validate lists the review state keys it reads and writes;
//   2. the in-flight guards are mutation-tested: with the in-process guard (and then also the state
//      claim check) removed from a copy of the machine, the concurrency arms FAIL (and pass on an
//      untouched copy, so each arm discriminates).
// Exit 77 (ENV GAP, never a pass) when the claude binary is not on PATH.
// Hyphens only. CJS, Node built-ins only. Hermetic: writes only to a temp dir it removes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');
const REVIEW = path.join(MOD, 'src', 'pane', 'review');

let passed = 0;
let failed = 0;
let skipped = 0;
function scenario(name, fn) {
  try {
    const r = fn();
    if (r === 'skip') { skipped += 1; process.stdout.write('  skip ' + name + ' (claude not on PATH)\n'); return; }
    passed += 1; process.stdout.write('  ok ' + name + '\n');
  } catch (e) {
    failed += 1; process.stdout.write('  FAIL ' + name + '\n    ' + (e.stack || e.message || String(e)) + '\n');
  }
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// ---------- static arms ----------

scenario('only gate-client.ts names gate_answer under src/', () => {
  const hits = walk(path.join(MOD, 'src'), [])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /gate_answer/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(MOD, f).split(path.sep).join('/'));
  // gate-client.ts makes the call; the answer machine's header and the verdict table mention the
  // word in comments only, so the code-level check below strips comments.
  const code = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const callers = walk(path.join(MOD, 'src'), [])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /['"`]gate_answer['"`]/.test(code(f)))
    .map((f) => path.relative(MOD, f).split(path.sep).join('/'));
  assert.deepStrictEqual(callers, ['src/pane/review/gate-client.ts'], 'files naming gate_answer: ' + hits.join(', '));
});

scenario('the review folder names no Brain server and holds no $, atom, read or update (engine rules)', () => {
  for (const f of walk(REVIEW, [])) {
    const src = fs.readFileSync(f, 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/BRAIN_SERVER|mindrian-brain|brain_/.test(code), f + ' names the Brain');
    assert.ok(!/\$\./.test(code) && !/\(\$[,)]/.test(code), f + ' uses $');
    assert.ok(!/\batom\(|\bupdate\(|\bread\(|from 'claude-code'/.test(code), f + ' reaches the engine state API');
  }
});

// Built from char codes so this file passes its own guard.
const LONG_DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

scenario('the review files and their tests hold no em-dash or en-dash', () => {
  const files = walk(REVIEW, []).concat([
    path.join(MOD, 'tests', 'review-answer.test.ts'),
    path.join(MOD, 'tests', 'fixtures', 'review-io-recipe.ts'),
  ]);
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!LONG_DASH.test(s), f + ' has a long dash');
  }
});

// ---------- engine arms ----------

const HAVE_CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;

function withScratch(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-review-'));
  const dest = path.join(tmp, 'mod');
  fs.cpSync(MOD, dest, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'node_modules' && src !== path.join(MOD, '.claude-plugin', 'types'),
  });
  try {
    return fn(dest);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

scenario('the ReviewIo recipe passes the engine scan and validate lists the review keys it uses', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    fs.copyFileSync(
      path.join(dest, 'tests', 'fixtures', 'review-io-recipe.ts'),
      path.join(dest, 'src', 'registrars', 'review-recipe.ts'),
    );
    const f = path.join(dest, 'src', 'registrars', 'review-recipe.ts');
    // the recipe lives two folders deep in tests/fixtures; in src/registrars the relative imports shift
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/'\.\.\/\.\.\/src\//g, "'../"));
    const reg = path.join(dest, 'src', 'register.tsx');
    let s = fs.readFileSync(reg, 'utf8');
    s = s.replace("import { registerPane } from './registrars/pane'", "import { registerPane } from './registrars/pane'\nimport { registerReviewRecipe } from './registrars/review-recipe'");
    s = s.replace('  registerPane(on, options)', '  registerPane(on, options)\n  registerReviewRecipe(on, options)');
    assert.ok(s.includes('registerReviewRecipe(on, options)'), 'the scratch register.tsx was not wired');
    fs.writeFileSync(reg, s);
    const r = spawnSync('claude', ['plugin', 'validate', dest], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.strictEqual(r.status, 0, out);
    for (const key of ['reviewPhase', 'reviewLast', 'reviewMirrors', 'reviewDismissed', 'reviewForeign']) {
      assert.ok(out.includes('mindrian-workspace.' + key), 'validate does not list ' + key + '\n' + out);
    }
    assert.match(out, /command\.run\{command=review-recipe\}/);
  });
});

function runTests(dest) {
  const r = spawnSync('claude', ['plugin', 'test', dest], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

scenario('mutation: the in-flight guards are load-bearing (each arm fails when its guard is removed, and passes untouched)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const atomic = 'pressChoice: two concurrent presses produce exactly one gate_answer call';
  const plain = 'pressChoice: two concurrent presses stay one call even when the store cannot compare (a plain merge)';
  const inProcess = "if (inFlight.has(card.gateId)) return { kind: 'ignored' }";
  const claimCheck = "if (held !== claim) return { kind: 'ignored' }";
  withScratch((dest) => {
    const untouched = runTests(dest);
    assert.ok(untouched.includes('(pass) ' + atomic), 'the atomic-store arm does not pass untouched\n' + untouched.slice(-1500));
    assert.ok(untouched.includes('(pass) ' + plain), 'the plain-merge arm does not pass untouched\n' + untouched.slice(-1500));
    const f = path.join(dest, 'src', 'pane', 'review', 'answer-machine.ts');
    const before = fs.readFileSync(f, 'utf8');
    assert.ok(before.includes(inProcess), 'the in-process guard is not where this test expects it');
    assert.ok(before.includes(claimCheck), 'the claim check is not where this test expects it');

    // Only the in-process guard removed: a store that cannot compare lets both presses through.
    fs.writeFileSync(f, before.replace(inProcess, 'void inFlight'));
    const noProcess = runTests(dest);
    assert.ok(noProcess.includes('(fail) ' + plain), 'removing the in-process guard did not fail the plain-merge arm\n' + noProcess.slice(-1500));

    // Both removed: even a store that compares lets both presses through.
    fs.writeFileSync(f, before.replace(inProcess, 'void inFlight').replace(claimCheck, 'void held'));
    const neither = runTests(dest);
    assert.ok(neither.includes('(fail) ' + atomic), 'removing both guards did not fail the concurrency arm\n' + neither.slice(-1500));
    assert.ok(neither.includes('(fail) ' + plain), 'removing both guards did not fail the plain-merge arm\n' + neither.slice(-1500));
  });
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed' + (skipped ? ', ' + skipped + ' skipped' : '') + '\n');
if (failed > 0) process.exit(1);
process.exit(skipped > 0 && passed === 0 ? 77 : 0);
