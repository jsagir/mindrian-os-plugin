'use strict';
// Phase 359-07 -- test-359-replay.cjs: the 359 measuring instrument's own test
// (FORK359-02, FORK359-05, FORK359-06, FORK359-07; SPEC R2, R5, R6, R7; D-22).
//
// Drives scripts/replay-card-fire.cjs as a CHILD PROCESS (the same boundary a
// real invocation crosses), except L9 which unit-tests the exported
// deriveDeclaredVariant in-process.
//
// Legs:
//   L1 pre-359 missed forks      L2 HEAD declared variants and controls
//   L3 CLI/MCP parity            L4 MCP payload (labels, What-if last)
//   L5 dogfood overlay           L6 hygiene (tmp dirs, baseline.json)
//   L7 baseline-359 (active once it exists)   L8 write-359 guards (temp corpus)
//   L9 deriveDeclaredVariant     L10 default mode has no fork359 key
//   --mutation (359-08): M1 arm removed, M2 free-text regex, HEAD control.
//
// Test hygiene (every spawn): TYPESAFE_API_KEY stripped; HOME,
// USERPROFILE and MINDRIAN_ROOMS_HOME redirected to a fresh mkdtemp dir;
// NODE_OPTIONS preloads a network-attempt detector that writes
// NETWORK_ATTEMPT_359 to stderr and throws. NETWORK_ATTEMPT_359 must never
// appear in any leg's stderr.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const REPLAY_SCRIPT = path.join(REPO, 'scripts', 'replay-card-fire.cjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay');

console.log('test-359-replay');

if (process.argv.indexOf('--mutation') !== -1 && !fs.existsSync(path.join(FIXTURES, 'baseline-359.json'))) {
  console.log('SKIP mutation: lands in 359-08');
  process.exit(0);
}

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const PRE359 = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'pre-359.json'), 'utf8')).pre_359_sha;
const SYN = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'prose-forks-359.json'), 'utf8')).entries;
const SYN_FORKS = SYN.filter(function (e) { return e.prose_fork === true; });

function tmpDirsMatching(prefixes) {
  return fs.readdirSync(os.tmpdir()).filter(function (n) {
    return prefixes.some(function (p) { return n.indexOf(p) === 0; });
  });
}
const ROOT_PREFIXES = ['replay-359-root-', 'replay-357-root-'];
const rootDirsBefore = new Set(tmpDirsMatching(ROOT_PREFIXES));

const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay359-preload-'));
const preloadPath = path.join(preloadDir, 'network-attempt-detector.cjs');
fs.writeFileSync(
  preloadPath,
  "'use strict';\n" +
  'globalThis.fetch = function () {\n' +
  "  process.stderr.write('NETWORK_ATTEMPT_359\\n');\n" +
  "  throw new Error('NETWORK_ATTEMPT_359');\n" +
  '};\n'
);

const allStderr = [];

function replay(args) {
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'replay359-test-home-'));
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = childHome;
  env.USERPROFILE = childHome;
  env.MINDRIAN_ROOMS_HOME = path.join(childHome, 'rooms');
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();
  const res = spawnSync(process.execPath, [REPLAY_SCRIPT].concat(args || [], ['--json']), {
    cwd: REPO,
    env: env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch (_e) { json = null; }
  allStderr.push(res.stderr || '');
  try { fs.rmSync(childHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  return { status: res.status, json: json, stdout: res.stdout, stderr: res.stderr };
}

function entryOf(json, id) {
  return json.entries.find(function (e) { return e.id === id; });
}

// ---------------------------------------------------------------------
// --mutation (359-08, SPEC R10, D-23, RESEARCH Pattern 3): a distinct
// invocation mode. Proves that (M1) deleting the declared arm and (M2)
// adding any free-text fork regex before the no-gate-signal return each
// make the standing replay fail, and that an unmutated HEAD copy passes.
// Every mutant lives in its own mkdtemp copy of a `git archive HEAD`;
// nothing is ever written into the working tree. Every mkdtemp is removed
// in a finally.
// ---------------------------------------------------------------------
if (process.argv.indexOf('--mutation') !== -1) {
  const MUT_ARGS = ['--source', 'synthetic-359', '--fork359', '--surface', 'cli'];
  const CHECK_REL = path.join('scripts', 'check-card-fire.cjs');
  const made = [];

  function buildHeadCopy(label) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-359-root-mutation-' + label + '-'));
    made.push(dir);
    const archivePath = path.join(dir, 'a.tar');
    const arch = spawnSync('git', ['archive', '-o', archivePath, 'HEAD', 'scripts', 'lib', 'data', 'package.json', '.claude-plugin'], { cwd: REPO, encoding: 'utf8' });
    if (arch.status !== 0) throw new Error('git archive failed: ' + arch.stderr);
    const tarx = spawnSync('tar', ['-xf', archivePath, '-C', dir], { encoding: 'utf8' });
    if (tarx.status !== 0) throw new Error('tar failed: ' + tarx.stderr);
    fs.rmSync(archivePath, { force: true });
    const nm = path.join(REPO, 'node_modules');
    if (fs.existsSync(nm)) {
      try { fs.symlinkSync(nm, path.join(dir, 'node_modules'), 'dir'); } catch (_e) { /* best-effort */ }
    }
    return dir;
  }

  function editCheck(dir, editFn) {
    const p = path.join(dir, CHECK_REL);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    const out = editFn(lines);
    fs.writeFileSync(p, out.join('\n'));
  }

  function findOne(lines, needle, what) {
    const idx = [];
    lines.forEach(function (l, i) { if (l.indexOf(needle) !== -1) idx.push(i); });
    if (idx.length !== 1) throw new Error(what + ': expected exactly 1 line containing "' + needle + '", found ' + idx.length);
    return idx[0];
  }

  try {
    const control = buildHeadCopy('control');
    const m1 = buildHeadCopy('M1');
    editCheck(m1, function (lines) {
      const a = findOne(lines, 'ANCHOR fork359-declared-arm', 'M1 anchor');
      if (lines[a + 1].indexOf('const forkDeclared = ') === -1) throw new Error('M1: the line after the anchor is not the forkDeclared line');
      lines[a + 1] = 'const forkDeclared = false;';
      return lines;
    });
    const m2 = buildHeadCopy('M2');
    editCheck(m2, function (lines) {
      const a = findOne(lines, 'if (!primaryHit && !backstopHit && !forkDeclared)', 'M2 anchor');
      lines.splice(a, 0,
        '// ANCHOR fork359-mutation-M2 (free-text fork regex, must fail the suite)',
        "if (/\\bor\\b[^\\n]*\\?/.test(outputText)) { return { intercept: true, reason: 'mutation-free-text-fork', degrade: false }; }");
      return lines;
    });

    const rc = replay(['--code-root', control].concat(MUT_ARGS));
    const r1 = replay(['--code-root', m1].concat(MUT_ARGS));
    const r2 = replay(['--code-root', m2].concat(MUT_ARGS));

    ok('mutation control: the unmutated HEAD copy exits 0 (exit ' + rc.status + ')', function () {
      assert.ok(rc.json, 'stdout did not parse: ' + rc.stderr);
      assert.equal(rc.status, 0);
      assert.equal(rc.json.counts.fork359.declared_catch_rate, 1);
      assert.equal(rc.json.counts.fork359.control_false_blocks, 0);
    });
    ok('mutation M1: the declared arm replaced by `false` exits non-zero with catch rate below 1 (exit ' + r1.status + ', declared_catch_rate ' + (r1.json && r1.json.counts.fork359.declared_catch_rate) + ')', function () {
      assert.ok(r1.json, 'stdout did not parse: ' + r1.stderr);
      assert.notEqual(r1.status, 0);
      const rate = r1.json.counts.fork359.declared_catch_rate;
      assert.ok(rate === null || rate < 1, 'declared_catch_rate was ' + rate);
    });
    ok('mutation M2: a free-text fork regex exits non-zero with control_false_blocks above 0 (exit ' + r2.status + ', control_false_blocks ' + (r2.json && r2.json.counts.fork359.control_false_blocks) + ')', function () {
      assert.ok(r2.json, 'stdout did not parse: ' + r2.stderr);
      assert.notEqual(r2.status, 0);
      assert.ok(r2.json.counts.fork359.control_false_blocks > 0, 'control_false_blocks was ' + r2.json.counts.fork359.control_false_blocks);
    });
    ok('mutation: NETWORK_ATTEMPT_359 never appeared', function () {
      assert.ok(allStderr.every(function (s) { return s.indexOf('NETWORK_ATTEMPT_359') === -1; }));
    });
  } catch (e) {
    total += 1;
    failures += 1;
    console.log('  FAIL mutation setup -- ' + (e && e.message ? e.message : String(e)));
  } finally {
    made.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ } });
    try { fs.rmSync(preloadDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
  console.log('');
  console.log((failures === 0 ? 'PASS ' : 'FAIL ') + (total - failures) + '/' + total);
  process.exit(failures === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------
// L1: on the pre-359 code the declared arm does not exist, so every prose
// fork is a missed fork, nothing is caught, and the bar fails as it must.
// ---------------------------------------------------------------------
const l1 = replay(['--code-root', 'git:' + PRE359, '--source', 'synthetic-359', '--fork359', '--surface', 'cli']);
ok('L1: pre-359 code root reports every synthetic prose fork as a missed fork (' + SYN_FORKS.length + ')', function () {
  assert.ok(l1.json, 'stdout did not parse: ' + l1.stderr);
  assert.equal(l1.json.counts.fork359.prose_forks, SYN_FORKS.length);
  assert.equal(l1.json.counts.fork359.missed_forks, SYN_FORKS.length);
});
ok('L1: pre-359 declared_caught is 0 and the replay exits 1 (the bar fails)', function () {
  assert.equal(l1.json.counts.fork359.declared_caught, 0);
  assert.equal(l1.json.counts.fork359.declared_catch_rate, 0);
  assert.equal(l1.status, 1);
});
ok('L1: the pre-359 root label names git:<sha>', function () {
  assert.equal(l1.json.code_root, 'git:' + PRE359);
});

// ---------------------------------------------------------------------
// L2: HEAD, both surfaces, declared variants and controls.
// ---------------------------------------------------------------------
const l2 = replay(['--source', 'synthetic-359', '--fork359', '--surface', 'both']);
const f2 = l2.json && l2.json.counts && l2.json.counts.fork359;
ok('L2: HEAD declared-variant run exits 0 with declared_catch_rate 1', function () {
  assert.ok(f2, 'no fork359 counts: ' + l2.stderr);
  assert.equal(l2.status, 0);
  assert.equal(f2.declared_catch_rate, 1);
  console.log('       fork359 = ' + JSON.stringify(f2));
});
ok('L2: zero control false blocks, zero declared missed forks', function () {
  assert.equal(f2.control_false_blocks, 0);
  assert.equal(f2.declared_missed_forks, 0);
  assert.ok(f2.controls >= 15, 'controls floor: ' + f2.controls);
  assert.equal(f2.variant_unbuildable, 0);
});
ok('L2: simple-binary variants are counted separately (at least 2), incl. the yes/no prefix quirk', function () {
  assert.ok(f2.simple_binary_excluded >= 2, 'simple_binary_excluded=' + f2.simple_binary_excluded);
  const ids = l2.json.entries
    .filter(function (e) { return e.fork359 && e.fork359.variant && e.fork359.variant.outcome === 'SIMPLE_BINARY_EXCLUDED'; })
    .map(function (e) { return e.id; });
  assert.ok(ids.indexOf('syn359-fork-16') !== -1, 'quirk id not in the simple-binary list: ' + ids.join(','));
  // RESEARCH Pitfall 5: a known limitation, printed, not asserted away.
  console.log('       simple-binary ids (known limitation, Pitfall 5): ' + ids.join(', '));
});
ok('L2: the Hebrew fork variant is caught', function () {
  const e = entryOf(l2.json, 'syn359-fork-17');
  assert.equal(e.fork359.variant.outcome, 'CAUGHT');
  assert.equal(e.fork359.variant.cli.reason, 'declared-fork-no-card');
});
ok('L2: every raw synthetic fork is a missed fork on HEAD too (no free-text guess exists)', function () {
  assert.equal(f2.missed_forks, SYN_FORKS.length);
});

// ---------------------------------------------------------------------
// L3: parity.
// ---------------------------------------------------------------------
ok('L3: declared and plain parity mismatches are 0 on the synthetic run', function () {
  assert.equal(f2.declared_parity_mismatches, 0);
  assert.equal(l2.json.counts.parity_mismatches, 0);
});
const l3 = replay(['--surface', 'both']);
ok('L3: --surface both over the default corpus (the R5 entries) exits 0 with parity_mismatches 0', function () {
  assert.equal(l3.status, 0, l3.stderr);
  assert.equal(l3.json.counts.parity_mismatches, 0);
});

// ---------------------------------------------------------------------
// L4: MCP payload.
// ---------------------------------------------------------------------
ok('L4: mcp_payload_mismatches is 0 on the synthetic run', function () {
  assert.equal(f2.mcp_payload_mismatches, 0);
});
ok('L4: a 4-label fork renders its fork_labels in order on MCP, What-if moonshot last', function () {
  const fork = SYN_FORKS.find(function (e) { return e.fork_labels.length === 4; });
  assert.ok(fork, 'no 4-label fork in the fixture');
  const e = entryOf(l2.json, fork.id);
  const labels = e.fork359.variant.mcp.card_labels;
  console.log('       ' + fork.id + ' MCP labels: ' + JSON.stringify(labels));
  assert.deepEqual(labels, fork.fork_labels);
  assert.ok(labels[labels.length - 1].indexOf('What if') === 0);
});

// ---------------------------------------------------------------------
// L5: dogfood overlay (active once ratified, plan 359-06).
// ---------------------------------------------------------------------
const overlay = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'dogfood-fork-labels-359.json'), 'utf8'));
if (!overlay.meta || overlay.meta.ratified !== true) {
  console.log('  SKIP L5: overlay not ratified until 359-06');
} else {
  const l5 = replay(['--fork359', '--surface', 'both']);
  ok('L5: default corpus plus the ratified overlay exits 0 and reports counts.fork359', function () {
    assert.ok(l5.json && l5.json.counts.fork359, 'no fork359 counts: ' + l5.stderr);
    assert.equal(l5.status, 0, l5.stderr);
    assert.equal(l5.json.counts.fork359.control_false_blocks, 0);
    assert.equal(l5.json.counts.fork359.declared_catch_rate, 1);
    console.log('       fork359 = ' + JSON.stringify(l5.json.counts.fork359));
  });
  ok('L5: the overlay reaches the dogfood entries (they count as controls, none as prose forks)', function () {
    const dogfoodIds = Object.keys(overlay.labels);
    const proseTrue = dogfoodIds.filter(function (id) { return overlay.labels[id].prose_fork === true; });
    const present = l5.json.entries.filter(function (e) { return e.source === 'dogfood'; });
    assert.equal(present.length, dogfoodIds.length);
    assert.equal(l5.json.counts.fork359.prose_forks, SYN_FORKS.length + proseTrue.length);
  });
  ok('L5: stderr carries no NETWORK_ATTEMPT_359', function () {
    assert.ok(l5.stderr.indexOf('NETWORK_ATTEMPT_359') === -1);
  });
}

// ---------------------------------------------------------------------
// L9: deriveDeclaredVariant in-process (the dogfood overlay carries no
// prose fork today, so the transcript path needs its own coverage).
// ---------------------------------------------------------------------
const replayMod = require(REPLAY_SCRIPT);
const forkDecl = require(path.join(REPO, 'lib', 'core', 'fork-declaration.cjs'));
const LABELS = ['Path A', 'Path B', 'What if we do neither and ask the customer first'];
function lastLine(text) { return String(text).split('\n').pop(); }
ok('L9: direct mode appends the declaration as the final line of output_text', function () {
  const v = replayMod.deriveDeclaredVariant({ id: 'x', envelope: { mode: 'direct', output_text: 'Two paths.\n\n' }, fork_labels: LABELS });
  assert.equal(v.id, 'x#decl');
  assert.equal(lastLine(v.envelope.output_text), forkDecl.formatDeclaration(LABELS));
  assert.deepEqual(forkDecl.parseForkDeclaration(lastLine(v.envelope.output_text)).labels, LABELS);
});
ok('L9: transcript mode appends to the last assistant text (string and block content)', function () {
  const mk = function (content) {
    return { id: 't', envelope: { mode: 'transcript', transcript: [
      { type: 'user', message: { role: 'user', content: 'hi' } },
      { type: 'assistant', message: { role: 'assistant', content: content } },
    ] }, fork_labels: LABELS };
  };
  const a = replayMod.deriveDeclaredVariant(mk('Pick one.'));
  assert.equal(lastLine(a.envelope.transcript[1].message.content), forkDecl.formatDeclaration(LABELS));
  const b = replayMod.deriveDeclaredVariant(mk([{ type: 'text', text: 'Pick one.' }, { type: 'tool_use', name: 'Read', input: {} }]));
  assert.equal(lastLine(b.envelope.transcript[1].message.content[0].text), forkDecl.formatDeclaration(LABELS));
});
ok('L9: a transcript with no assistant text yields null (variant_unbuildable)', function () {
  const v = replayMod.deriveDeclaredVariant({ id: 'u', envelope: { mode: 'transcript', transcript: [
    { type: 'user', message: { role: 'user', content: 'hi' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: {} }] } },
  ] }, fork_labels: LABELS });
  assert.equal(v, null);
});
ok('L9: the source entry is never mutated (deep copy)', function () {
  const src = { id: 'm', envelope: { mode: 'direct', output_text: 'Hello' }, fork_labels: LABELS };
  replayMod.deriveDeclaredVariant(src);
  assert.equal(src.envelope.output_text, 'Hello');
});

// ---------------------------------------------------------------------
// L10: default mode is unchanged (no fork359 key, same counts shape).
// ---------------------------------------------------------------------
ok('L10: a default run has no fork359 key in counts or entries', function () {
  assert.ok(!('fork359' in l3.json.counts));
  assert.ok(l3.json.entries.every(function (e) { return !('fork359' in e); }));
  assert.deepEqual(Object.keys(l3.json.counts), [
    'entries', 'evaluated', 'false_blocks', 'missed_forks', 'known_misses', 'known_false_blocks',
    'new_misses', 'excluded_partial', 'parity_mismatches', 'errors', 'unmarked_misses',
  ]);
  assert.equal(l3.json.counts.missed_forks, 0);
  assert.ok(l3.json.entries.every(function (e) { return e.source !== 'synthetic-359'; }));
});

// ---------------------------------------------------------------------
// L8: write-359 guards, run against a COPY of the corpus dir so the repo's
// own baseline-359.json (plan 359-08) is never written here.
// ---------------------------------------------------------------------
const copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay359-corpus-copy-'));
// baseline-359.json is excluded: L8 proves the write guards on a copy that has none (359-08).
for (const name of fs.readdirSync(FIXTURES)) { if (name === 'baseline-359.json') continue; fs.copyFileSync(path.join(FIXTURES, name), path.join(copyDir, name)); }
const baselineBytes = fs.readFileSync(path.join(copyDir, 'baseline.json'));
ok('L8: --baseline write-359 without --code-root git:<pre_359_sha> exits 2 and writes nothing', function () {
  const a = replay(['--corpus-dir', copyDir, '--baseline', 'write-359', '--surface', 'cli']);
  assert.equal(a.status, 2);
  const b = replay(['--corpus-dir', copyDir, '--baseline', 'write-359', '--code-root', 'pre-phase', '--surface', 'cli']);
  assert.equal(b.status, 2);
  assert.ok(!fs.existsSync(path.join(copyDir, 'baseline-359.json')));
});
ok('L8: --baseline write-359 with git:<pre_359_sha> exits 0 and writes baseline-359.json only', function () {
  const r = replay(['--corpus-dir', copyDir, '--baseline', 'write-359', '--code-root', 'git:' + PRE359, '--surface', 'cli']);
  assert.equal(r.status, 0, r.stderr);
  const b = JSON.parse(fs.readFileSync(path.join(copyDir, 'baseline-359.json'), 'utf8'));
  assert.equal(b.meta.pre_359_sha, PRE359);
  assert.equal(b.fork359.missed_forks, SYN_FORKS.length);
  assert.equal(Object.keys(b.verdicts).length, b.meta.entry_count);
  assert.ok(Object.keys(b.verdicts).every(function (k) { return b.verdicts[k] === 'block' || b.verdicts[k] === 'pass'; }));
  assert.ok(fs.readFileSync(path.join(copyDir, 'baseline.json')).equals(baselineBytes), '357 baseline.json changed');
});

// ---------------------------------------------------------------------
// L6: hygiene.
// ---------------------------------------------------------------------
ok('L6: no replay-359-root or replay-357-root dir left behind in os.tmpdir()', function () {
  const leftover = tmpDirsMatching(ROOT_PREFIXES).filter(function (n) { return !rootDirsBefore.has(n); });
  assert.deepEqual(leftover, []);
});
ok('L6: tests/fixtures/card-fire-replay/baseline.json is untouched', function () {
  const st = spawnSync('git', ['status', '--short', '--', 'tests/fixtures/card-fire-replay/baseline.json'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(st.stdout.trim(), '');
});
ok('L6: NETWORK_ATTEMPT_359 never appeared in any spawned run', function () {
  assert.ok(allStderr.every(function (s) { return s.indexOf('NETWORK_ATTEMPT_359') === -1; }));
});

// ---------------------------------------------------------------------
// L7: baseline-359 (active once plan 359-08 writes it).
// ---------------------------------------------------------------------
const baseline359Path = path.join(FIXTURES, 'baseline-359.json');
if (!fs.existsSync(baseline359Path)) {
  console.log('  SKIP L7: baseline-359 lands in 359-08');
} else {
  const b359 = JSON.parse(fs.readFileSync(baseline359Path, 'utf8'));
  const l7 = replay(['--code-root', 'git:' + PRE359, '--fork359', '--surface', 'cli']);
  ok('L7: baseline-359 pre_359_sha equals pre-359.json and missed_forks matches a fresh pre-359 run', function () {
    assert.equal(b359.meta.pre_359_sha, PRE359);
    assert.ok(l7.json && l7.json.counts.fork359, l7.stderr);
    assert.equal(b359.fork359.missed_forks, l7.json.counts.fork359.missed_forks);
    assert.ok(b359.fork359.missed_forks >= l1.json.counts.fork359.missed_forks);
  });
}

try { fs.rmSync(copyDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
try { fs.rmSync(preloadDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

console.log('');
console.log((failures === 0 ? 'PASS ' : 'FAIL ') + (total - failures) + '/' + total);
process.exit(failures === 0 ? 0 : 1);
